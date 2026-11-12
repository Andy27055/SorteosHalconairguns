import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {z} from 'zod';
import type {Prisma,PrismaClient,RaffleEmailKind} from '../generated/prisma/client.js';
import type {AppConfig} from '../config.js';
import {mailConfigured,type EmailSender} from './purchase-emails.js';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const payloadSchema=z.object({raffleId:z.string(),title:z.string(),name:z.string(),date:z.string().nullable(),reason:z.string().nullable().optional(),numbers:z.array(z.number().int()).optional(),winnerNumber:z.number().int().nullable().optional(),winnerName:z.string().optional(),winnerEmail:z.string().optional(),digits:z.number().int().optional(),head:z.string().optional()});
async function enqueue(tx:Prisma.TransactionClient,raffleId:string,kind:RaffleEmailKind,email:string,payload:Prisma.InputJsonValue,adminUserId?:string){
 const normalized=email.trim().toLowerCase();const valid=z.email().safeParse(normalized).success&&!/\.(invalid|local)$/.test(normalized);
 const eventKey=`${kind}:${raffleId}:${createHash('sha256').update(normalized||'missing').digest('hex')}`;
 await tx.raffleEmail.upsert({where:{eventKey},update:{},create:{raffleId,kind,eventKey,toEmail:normalized,adminUserId,payload,status:valid?'PENDING':'SKIPPED',lastErrorCode:valid?null:'MISSING_RECIPIENT'}});
}
export async function queueRaffleBuyerEmails(tx:Prisma.TransactionClient,raffleId:string,kind:'RAFFLE_CANCELLED'|'RAFFLE_EARLY_CLOSURE',orderIds?:string[]){
 const raffle=await tx.raffle.findUniqueOrThrow({where:{id:raffleId}});
 const orders=await tx.order.findMany({where:{raffleId,...(orderIds?{id:{in:orderIds}}:{status:'PAID'})},include:{user:true}});
 const recipients=new Map<string,{name:string;numbers:number[]}>();
 for(const order of orders){const email=(order.buyerEmail||order.user?.email||'').trim().toLowerCase();const old=recipients.get(email);const name=[order.buyerFirstName,order.buyerLastName].filter(Boolean).join(' ')||order.user?.fullName||'Participante';recipients.set(email,{name,numbers:[...new Set([...(old?.numbers||[]),...order.numbers])].sort((a,b)=>a-b)});}
 for(const [email,recipient]of recipients)await enqueue(tx,raffleId,kind,email,{raffleId,title:raffle.title,name:recipient.name,numbers:recipient.numbers,date:raffle.resultDate,reason:raffle.cancellationReason,digits:raffle.lotteryDigits||2});
}
export async function queueAdminResultEmails(tx:Prisma.TransactionClient,raffleId:string){
 const raffle=await tx.raffle.findUniqueOrThrow({where:{id:raffleId}});
 const winner=raffle.winnerOrderId?await tx.order.findUnique({where:{id:raffle.winnerOrderId},include:{user:true}}):null;
 const admins=await tx.user.findMany({where:{role:'ADMIN',active:true}});
 for(const admin of admins)await enqueue(tx,raffleId,'RAFFLE_RESULT_ADMIN',admin.email,{raffleId,title:raffle.title,name:admin.fullName,date:raffle.resultDate,winnerNumber:raffle.winnerNumber,winnerName:[winner?.buyerFirstName,winner?.buyerLastName].filter(Boolean).join(' ')||winner?.user?.fullName||'Participante',winnerEmail:winner?.buyerEmail||winner?.user?.email||'',digits:raffle.lotteryDigits||2,head:String((raffle.lotteryResult as Record<string,unknown>)?.head||'')},admin.id);
}
export function raffleMessage(kind:RaffleEmailKind,payload:unknown,frontendUrl:string){
 const p=payloadSchema.parse(payload);const title=kind==='RAFFLE_CANCELLED'?'Rifa cancelada por un administrador':kind==='RAFFLE_EARLY_CLOSURE'?'Cierre anticipado de la rifa':'Resultado de la rifa';
 const explanation=kind==='RAFFLE_CANCELLED'?`Un administrador canceló la rifa ${p.title}.${p.reason?`\nMotivo: ${p.reason}`:''}\nTus números ya no participan. El reembolso de tu compra se gestionará en un plazo estimado de 24 a 72 horas hábiles por el medio de pago original. Podés consultar su estado desde tu cuenta.`:kind==='RAFFLE_EARLY_CLOSURE'?`Un administrador finalizó anticipadamente la venta de números de ${p.title}.\nSe usará el primer premio de la Quiniela de la Provincia de Buenos Aires, Nocturna, del ${p.date}. Se esperará a su publicación oficial y a la resolución de pagos pendientes para confirmar al ganador.`:`La rifa ${p.title} ya tiene ganador.\nGanador: ${p.winnerName}\nCorreo del ganador: ${p.winnerEmail}\nNúmero ganador: ${String(p.winnerNumber).padStart(p.digits||2,'0')}\nFecha de la Nocturna: ${p.date}\nPrimer premio oficial: ${p.head}`;
 const numbers=p.numbers?.length?`\nNúmeros de tus compras: ${p.numbers.map(n=>String(n).padStart(p.digits||2,'0')).join(', ')}`:'';
 const url=kind==='RAFFLE_RESULT_ADMIN'?`${frontendUrl}/admin`:`${frontendUrl}/compras`;
 const text=`Hola ${p.name}:\n\n${explanation}${numbers}\n\nConsultá el detalle en ${url}\nHalcón Airguns`;
 return {subject:`${title} · ${p.title.replace(/[\r\n]/g,' ')}`,text,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>${escape(title)}</h1><p>${escape(text).replace(/\n/g,'<br>')}</p><p><a href="${escape(url)}">Ver detalle</a></p></div>`};
}
export class RaffleEmailWorker{
 private sender:EmailSender;
 constructor(private db:PrismaClient,private cfg:AppConfig,sender?:EmailSender){this.sender=sender||nodemailer.createTransport({host:cfg.smtpHost,port:cfg.smtpPort,secure:cfg.smtpSecure,requireTLS:cfg.production&&!cfg.smtpSecure,...(cfg.smtpUser?{auth:{user:cfg.smtpUser,pass:cfg.smtpPass}}:{}),connectionTimeout:10000,socketTimeout:20000,greetingTimeout:10000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});}
 async process(limit=20){
  if(!mailConfigured(this.cfg))return {enabled:false,sent:0,failed:0};
  const now=new Date();const eligible={OR:[{status:'PENDING' as const,nextAttemptAt:{lte:now}},{status:'SENDING' as const,lockedAt:{lt:new Date(now.getTime()-5*60000)}}]};
  const jobs=await this.db.raffleEmail.findMany({where:eligible,take:limit,orderBy:{createdAt:'asc'},select:{id:true}});let sent=0,failed=0;
  for(const {id}of jobs){const lease=new Date();const claim=await this.db.raffleEmail.updateMany({where:{id,...eligible},data:{status:'SENDING',lockedAt:lease,attempts:{increment:1}}});if(!claim.count)continue;
   const job=await this.db.raffleEmail.findUniqueOrThrow({where:{id},include:{raffle:true}});
   const admin=job.adminUserId?await this.db.user.findUnique({where:{id:job.adminUserId}}):null;
   const stale=job.kind==='RAFFLE_RESULT_ADMIN'?(job.raffle.status!=='FINISHED'||!admin?.active||admin.role!=='ADMIN'||admin.email!==job.toEmail):job.kind==='RAFFLE_CANCELLED'?job.raffle.status!=='CANCELLED':job.raffle.status==='CANCELLED';
   if(stale){await this.db.raffleEmail.updateMany({where:{id,status:'SENDING',lockedAt:lease},data:{status:'SKIPPED',lockedAt:null,lastErrorCode:'RAFFLE_OR_RECIPIENT_CHANGED'}});continue;}
   try{await this.sender.sendMail({...raffleMessage(job.kind,job.payload,this.cfg.frontendUrl),from:{name:'Halcón Airguns',address:this.cfg.smtpFrom},to:job.toEmail,messageId:`<halcon-raffle-${job.id}@${this.cfg.smtpFrom.split('@')[1]}>`});await this.db.raffleEmail.updateMany({where:{id,status:'SENDING',lockedAt:lease},data:{status:'SENT',sentAt:new Date(),lockedAt:null,lastErrorCode:null}});sent++;}
   catch(error){await this.db.raffleEmail.updateMany({where:{id,status:'SENDING',lockedAt:lease},data:{status:job.attempts>=8?'FAILED':'PENDING',lockedAt:null,lastErrorCode:String((error as {code?:string}).code||'SEND_FAILED').replace(/[^A-Z0-9_]/gi,'').slice(0,50),nextAttemptAt:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000)}});failed++;}
  }return {enabled:true,sent,failed};
 }
}
