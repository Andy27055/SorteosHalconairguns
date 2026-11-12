import { recordActivity } from './activity.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import type { PrismaClient, EmailVerification } from '../generated/prisma/client.js';
import type { AppConfig } from '../config.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { mailConfigured, type EmailSender } from './purchase-emails.js';

export function verificationToken(job: Pick<EmailVerification,'id'|'email'|'expiresAt'>, secret:string) {
  return `${job.id}.${createHmac('sha256',secret).update(`verify:${job.id}:${job.email}:${job.expiresAt.toISOString()}`).digest('hex')}`;
}
export async function requestVerification(db:PrismaClient,userId:string) {
  return atomic(db,async tx=>{
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
    if(user.emailVerifiedAt)return {alreadyVerified:true};
    const recent=await tx.emailVerification.findFirst({where:{userId,email:user.email,consumedAt:null,expiresAt:{gt:new Date(Date.now()+60000)},OR:[{status:{in:['PENDING','SENDING']}},{status:'SENT',createdAt:{gt:new Date(Date.now()-60000)}}]}});
    if(!recent){
      await tx.emailVerification.updateMany({where:{userId,consumedAt:null},data:{consumedAt:new Date(),status:'SKIPPED'}});
      await tx.emailVerification.create({data:{userId,email:user.email,expiresAt:new Date(Date.now()+24*3600000)}});
    }
    return {alreadyVerified:false};
  });
}
export async function verifyEmail(db:PrismaClient,cfg:AppConfig,token:string,password?:string) {
  if(!/^[a-z0-9]+\.[a-f0-9]{64}$/.test(token))throw new AppError(400,'Enlace de verificación inválido.');
  const id=token.split('.')[0];
  const hash=password?await bcrypt.hash(password,12):undefined;
  return atomic(db,async tx=>{
    const job=await tx.emailVerification.findUnique({where:{id},include:{user:true}});
    if(!job||!job.user.active||job.consumedAt||job.expiresAt<=new Date()||job.email!==job.user.email)throw new AppError(400,'El enlace venció o ya fue utilizado. Solicitá uno nuevo desde tu perfil.');
    const expected=verificationToken(job,cfg.jwtSecret);
    if(token.length!==expected.length||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw new AppError(400,'Enlace de verificación inválido.');
    await tx.user.update({where:{id:job.userId},data:{emailVerifiedAt:new Date(),...(hash?{passwordHash:hash,tokenVersion:{increment:1}}:{})}});
    await tx.emailVerification.updateMany({where:{userId:job.userId,consumedAt:null},data:{consumedAt:new Date(),status:'SKIPPED'}});
    await recordActivity(tx,{data:{actorId:job.userId,actorRole:job.user.role,action:'EMAIL_VERIFIED',entityId:job.userId}});
    return {ok:true};
  });
}
export class VerificationEmailWorker {
  private sender:EmailSender;
  constructor(private db:PrismaClient,private cfg:AppConfig,sender?:EmailSender){
    this.sender=sender||nodemailer.createTransport({host:cfg.smtpHost,port:cfg.smtpPort,secure:cfg.smtpSecure,requireTLS:cfg.production&&!cfg.smtpSecure,...(cfg.smtpUser?{auth:{user:cfg.smtpUser,pass:cfg.smtpPass}}:{}),connectionTimeout:10000,socketTimeout:20000,greetingTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
  }
  async process(limit=10,email?:string){
    if(!mailConfigured(this.cfg))return {enabled:false,sent:0};
    const now=new Date(),stale=new Date(now.getTime()-5*60000);
    const where={...(email?{email}:{}),consumedAt:null,OR:[{status:'PENDING' as const,nextAttemptAt:{lte:now}},{status:'SENDING' as const,lockedAt:{lt:stale}}]};
    const jobs=await this.db.emailVerification.findMany({where,take:limit,orderBy:{createdAt:'asc'}});let sent=0;
    for(const job of jobs){
      const lease=new Date();const claim=await this.db.emailVerification.updateMany({where:{id:job.id,...where},data:{status:'SENDING',lockedAt:lease,attempts:{increment:1}}});if(!claim.count)continue;
      const user=await this.db.user.findUnique({where:{id:job.userId}});
      if(!user?.active||user.email!==job.email||user.emailVerifiedAt){await this.db.emailVerification.update({where:{id:job.id},data:{status:'SKIPPED',lockedAt:null}});continue;}
      try{
        // Lifetime starts when sending, so a locally queued invitation does not arrive expired.
        const current=await this.db.emailVerification.update({where:{id:job.id},data:job.expiresAt<=now&&!job.sentAt?{expiresAt:new Date(now.getTime()+24*3600000)}:{}});
        if(current.expiresAt<=now)throw Object.assign(new Error('expired'),{code:'EXPIRED'});
        const url=`${this.cfg.frontendUrl}/verificar-correo#${verificationToken(current,this.cfg.jwtSecret)}`;
        await this.sender.sendMail({from:{name:'Halcón Airguns',address:this.cfg.smtpFrom},to:job.email,subject:'Confirmá tu correo · Halcón Airguns',text:`Tu cuenta de Halcón Airguns está creada. Confirmá que este correo te pertenece en ${url}\nEl enlace es personal, de un solo uso y vence en 24 horas. También podés establecer una contraseña propia. Si no esperabas este correo, ignoralo.`,html:`<h1>Confirmá tu correo</h1><p>Tu cuenta de Halcón Airguns está creada.</p><p><a href="${url}">CONFIRMAR MI CORREO</a></p><p>Enlace personal, de un solo uso, válido por 24 horas. Podés establecer tu contraseña al confirmar.</p>`,messageId:`<halcon-verify-${job.id}@${this.cfg.smtpFrom.split('@')[1]}>`});
        await this.db.emailVerification.updateMany({where:{id:job.id,status:'SENDING',lockedAt:lease},data:{status:'SENT',sentAt:new Date(),lockedAt:null,lastErrorCode:null}});sent++;
      }catch(error){await this.db.emailVerification.updateMany({where:{id:job.id,status:'SENDING',lockedAt:lease},data:{status:job.attempts>=7?'FAILED':'PENDING',lockedAt:null,lastErrorCode:String((error as {code?:string}).code||'SEND_FAILED').replace(/[^A-Z0-9_]/gi,'').slice(0,50),nextAttemptAt:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000)}});}
    }return {enabled:true,sent};
  }
}
