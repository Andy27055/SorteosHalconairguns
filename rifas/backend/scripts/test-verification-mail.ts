import {config,validateConfig} from '../src/config.js';
import {prisma} from '../src/db.js';
import {mailConfigured} from '../src/services/purchase-emails.js';
import {VerificationEmailWorker,requestVerification} from '../src/services/verification.js';
import nodemailer from 'nodemailer';
try{
 validateConfig();
 if(!mailConfigured(config))throw new Error('Completá SMTP_HOST, SMTP_FROM y SMTP_ENABLED=true en backend/.env.');
 const user=await prisma.user.findUniqueOrThrow({where:{email:'halconairguns@gmail.com'}});
 if(user.emailVerifiedAt){console.log('El correo del administrador principal ya está verificado. No se envió otra prueba.');}
 else{
  const transport=nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpSecure,auth:{user:config.smtpUser,pass:config.smtpPass},connectionTimeout:15000,socketTimeout:20000});
  try{await transport.verify();}catch{throw new Error('No se pudo autenticar con SMTP. Revisá host, puerto, usuario y contraseña de aplicación.');}
  await requestVerification(prisma,user.id);
  const result=await new VerificationEmailWorker(prisma,config).process(10,user.email);
  const job=await prisma.emailVerification.findFirst({where:{userId:user.id},orderBy:{createdAt:'desc'},select:{status:true,sentAt:true,lastErrorCode:true}});
  console.log(JSON.stringify({recipient:user.email,...result,...job}));
 }
}finally{await prisma.$disconnect();}
