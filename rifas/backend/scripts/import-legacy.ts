import '../src/config.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../src/db.js';
const schema=z.object({users:z.array(z.object({username:z.string(),password:z.string(),createdAt:z.string().optional()})),raffles:z.record(z.string(),z.object({title:z.string(),prize:z.string(),prizeDescription:z.string().optional(),ticketPrice:z.number().positive(),totalTickets:z.number().int().min(1).max(10000),status:z.enum(['active','draft','finished']),createdAt:z.string().optional()})),tickets:z.record(z.string(),z.record(z.string(),z.object({owner:z.string(),status:z.enum(['paid','pending']),externalRef:z.string().optional(),paymentId:z.string().optional(),expiresAt:z.string().optional(),reservedAt:z.string().optional(),boughtAt:z.string().optional()})))});
const source=process.argv[2];
if(!source){console.error('Uso: npm run db:import -w backend -- RUTA_DB_JSON [--apply]');process.exit(1);}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,24);
const data=schema.parse(JSON.parse(await readFile(path.resolve(source),'utf8')));
const userIds=new Map(data.users.map(u=>[u.username,`legacy-u-${hash(u.username)}`]));
const groups=new Map<string,{raffleId:string;owner:string;numbers:number[];status:'paid'|'pending';externalRef?:string;paymentId?:string;boughtAt?:string;reservedAt?:string;expiresAt?:string}>();
for(const [raffleId,tickets]of Object.entries(data.tickets))for(const [number,ticket]of Object.entries(tickets)){
  if(!data.raffles[raffleId]||!userIds.has(ticket.owner))throw new Error('Hay un ticket sin rifa o usuario asociado. Revisar el origen antes de importar.');
  const n=Number(number);if(!Number.isInteger(n)||n<1||n>data.raffles[raffleId].totalTickets)throw new Error('Hay números fuera del rango de la rifa.');
  const key=`${raffleId}|${ticket.owner}|${ticket.externalRef||ticket.paymentId||number}`;
  const group=groups.get(key);if(group){if(group.status!==ticket.status)throw new Error('Una referencia tiene estados mezclados; conciliar antes de importar.');group.numbers.push(n);}else groups.set(key,{...ticket,raffleId,numbers:[n]});
}
if([...groups.values()].some(g=>g.numbers.length>20))throw new Error('Hay una compra histórica con más de 20 números. Requiere adaptar el modelo antes de importarla; no se modificó el origen.');
if(data.users.some(u=>!/^\$2[aby]\$/.test(u.password)))throw new Error('Hay contraseñas sin hash bcrypt compatible. No se importan contraseñas en claro.');
console.log({usuarios:data.users.length,rifas:Object.keys(data.raffles).length,compras:groups.size,modo:process.argv.includes('--apply')?'importación':'simulación sin escrituras'});
try{
  if(process.argv.includes('--apply'))await prisma.$transaction(async tx=>{
    for(const u of data.users){const normalized=u.username.trim().toLowerCase();const username=/^[a-z0-9_.-]{3,30}$/.test(normalized)?normalized:`legacy-${hash(u.username)}`;await tx.user.upsert({where:{id:userIds.get(u.username)!},update:{},create:{id:userIds.get(u.username),username,email:`legacy-${hash(u.username)}@migration.invalid`,fullName:u.username,passwordHash:u.password,role:'USER',createdAt:u.createdAt?new Date(u.createdAt):undefined}});}
    for(const [legacyId,r]of Object.entries(data.raffles)){
      const prizeId=`legacy-p-${hash(legacyId)}`;const raffleId=`legacy-r-${hash(legacyId)}`;
      await tx.prize.upsert({where:{id:prizeId},update:{},create:{id:prizeId,name:r.prize,description:r.prizeDescription||''}});
      await tx.raffle.upsert({where:{id:raffleId},update:{},create:{id:raffleId,title:r.title,description:r.prizeDescription||'',prizeId,ticketPriceCents:Math.round(r.ticketPrice*100),totalTickets:r.totalTickets,status:r.status==='active'?'ACTIVE':r.status==='finished'?'FINISHED':'DRAFT',createdAt:r.createdAt?new Date(r.createdAt):undefined}});
    }
    for(const [key,g]of groups){
      const id=`legacy-o-${hash(key)}`;if(await tx.order.findUnique({where:{id}}))continue;
      const raffleId=`legacy-r-${hash(g.raffleId)}`;const unitPriceCents=Math.round(data.raffles[g.raffleId].ticketPrice*100);
      // El formato viejo no guardaba importe histórico: se deja constancia para conciliación.
      const status=g.status==='paid'?'PAID':'EXPIRED';
      await tx.order.create({data:{id,userId:userIds.get(g.owner)!,raffleId,numbers:g.numbers,unitPriceCents,amountCents:unitPriceCents*g.numbers.length,status,method:g.externalRef||g.paymentId?'MERCADO_PAGO':null,paymentId:g.paymentId,legacyReference:g.externalRef,expiresAt:g.expiresAt?new Date(g.expiresAt):new Date(),paidAt:g.boughtAt?new Date(g.boughtAt):null,createdAt:g.reservedAt?new Date(g.reservedAt):undefined,decisionNote:'Importación histórica. El sistema anterior no guardaba el importe cobrado: verificar contra el proveedor.',allocations:status==='PAID'?{create:g.numbers.map(number=>({raffleId,number}))}:undefined}});
      await tx.auditLog.create({data:{action:'LEGACY_ORDER_IMPORTED',entityId:id,detail:{legacyRaffleId:g.raffleId,priceSource:'current_legacy_raffle_price',pendingReleased:g.status==='pending'}}});
    }
  },{timeout:60000});
}finally{await prisma.$disconnect();}
console.log('Finalizado. El archivo original se conserva sin cambios. Los usuarios importados deben actualizar su email.');
