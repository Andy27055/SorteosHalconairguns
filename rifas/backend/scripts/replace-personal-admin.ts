import '../src/config.js';
import {prisma,atomic} from '../src/db.js';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {requestVerification} from '../src/services/verification.js';
const previousEmail='andy27055.2@gmail.com';
const primaryEmail='halconairguns@gmail.com';
const credentials=fileURLToPath(new URL('../.admin-accounts.local.json',import.meta.url));
try{
 const saved=JSON.parse(await readFile(credentials,'utf8')) as Record<string,{username:string;password:string}>;
 const previous=await prisma.user.findUnique({where:{email:previousEmail}});
 const destination=await prisma.user.findUnique({where:{email:primaryEmail}});
 if(previous&&destination&&previous.id!==destination.id)throw new Error('La cuenta de destino ya existe; no se fusionan historiales automáticamente.');
 const account=previous||destination;if(!account)throw new Error('No se encontró la cuenta que se debe reemplazar.');
 if(account.role!=='ADMIN')throw new Error('La cuenta de origen no es administradora.');
 const primary=await atomic(prisma,async tx=>{
  const primary=await tx.user.update({where:{id:account.id},data:{email:primaryEmail,username:'halcon-dev',fullName:'Halcón Airguns',firstName:'Halcón',lastName:'Airguns',dni:null,address:null,role:'ADMIN',adminType:'PRIMARY',active:true,...(previous?{emailVerifiedAt:null,tokenVersion:{increment:1}}:{})}});
  if(previous){
   await tx.emailVerification.updateMany({where:{userId:account.id,consumedAt:null},data:{consumedAt:new Date(),status:'SKIPPED'}});
   await tx.auditLog.create({data:{actorId:primary.id,actorRole:'ADMIN',action:'ADMIN_IDENTITY_REPLACED',entityId:primary.id,detail:{adminType:'PRIMARY',previousSessionsRevoked:true}}});
  }
  for(const email of ['osvaljgomez@gmail.com','jlgorosito43@gmail.com']){
   const user=await tx.user.findUniqueOrThrow({where:{email}});
   await tx.user.update({where:{id:user.id},data:{role:'ADMIN',adminType:'FUNCTIONAL',active:true,...(user.role!=='ADMIN'||user.adminType!=='FUNCTIONAL'||!user.active?{tokenVersion:{increment:1}}:{})}});
  }
  return primary;
 });
 const previousCredentials=saved[previousEmail]||saved[primaryEmail];
 if(previousCredentials)saved[primaryEmail]={...previousCredentials,username:primary.username};
 delete saved[previousEmail];
 await writeFile(credentials,JSON.stringify(saved,null,2)+'\n',{mode:0o600});
 await requestVerification(prisma,primary.id);
 console.log(JSON.stringify({previousLoginRemoved:!await prisma.user.findUnique({where:{email:previousEmail}}),primary:{email:primary.email,username:primary.username,adminType:primary.adminType},functionalAdmins:['osvaljgomez@gmail.com','jlgorosito43@gmail.com'],passwordPreserved:true,verificationQueued:true}));
}finally{await prisma.$disconnect();}
