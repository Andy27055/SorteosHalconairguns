import '../src/config.js';
import { prisma, atomic } from '../src/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requestVerification } from '../src/services/verification.js';
import { recordActivity } from '../src/services/activity.js';
const credentials=fileURLToPath(new URL('../.admin-accounts.local.json',import.meta.url));
const accounts=[
 {email:'osvaljgomez@gmail.com',username:'osvaldo-gomez',fullName:'Osvaldo Javier Gomez',firstName:'Osvaldo Javier',lastName:'Gomez',adminType:'FUNCTIONAL' as const},
 {email:'jlgorosito43@gmail.com',username:'jose-gorosito',fullName:'Jose Luis Gorosito',firstName:'Jose Luis',lastName:'Gorosito',adminType:'FUNCTIONAL' as const},
 {email:'halconairguns@gmail.com',username:'halcon-dev',fullName:'Halcón Airguns',firstName:'Halcón',lastName:'Airguns',adminType:'PRIMARY' as const},
];
try{
 const saved:Record<string,{username:string;password:string}>=JSON.parse(await fs.readFile(credentials,'utf8').catch(()=>'{}'));
 const actor=await prisma.user.findFirst({where:{role:'ADMIN',active:true},orderBy:{createdAt:'asc'}});
 for(const input of accounts){
  const existing=await prisma.user.findFirst({where:{email:{equals:input.email,mode:'insensitive'}}});
  let password:string|undefined;
  if(!existing){password=randomBytes(18).toString('base64url');saved[input.email]={username:input.username,password};await fs.writeFile(credentials,JSON.stringify(saved,null,2)+'\n',{mode:0o600});}
  const passwordHash=password?await bcrypt.hash(password,12):undefined;
  const user=await atomic(prisma,async tx=>{
   const u=existing?await tx.user.update({where:{id:existing.id},data:{role:'ADMIN',adminType:input.adminType,active:true,...(existing.role!=='ADMIN'||!existing.active||existing.adminType!==input.adminType?{tokenVersion:{increment:1}}:{})}}):await tx.user.create({data:{...input,role:'ADMIN',passwordHash:passwordHash!}});
   if(!existing||existing.role!=='ADMIN'||!existing.active||existing.adminType!==input.adminType)await recordActivity(tx,{data:{actorId:actor?.id,actorRole:'ADMIN',action:'ADMIN_ACCOUNT_PROVISIONED',entityId:u.id}});
   return u;
  });
  if(input.adminType==='PRIMARY')await requestVerification(prisma,user.id);
  console.log(`${input.email}: ADMIN, ${existing?'cuenta conservada':'cuenta creada'}`);
 }
 console.log('Credenciales nuevas guardadas en backend/.admin-accounts.local.json (excluido de Git). No se enviaron correos desde este script.');
}finally{await prisma.$disconnect();}
