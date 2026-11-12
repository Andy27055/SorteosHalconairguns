import { recordActivity } from './activity.js';
import { createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { expireOrders,salesClosed } from './orders.js';
import { queueOrderEmail } from './purchase-emails.js';
import {queueRaffleBuyerEmails,queueAdminResultEmails} from './raffle-emails.js';
import {boundedText,fetchHistoricalNocturna} from './lottery-history.js';

export const LOTTERY_URL='https://loteria.gba.gob.ar/resultados';
export function argentinaDay(date=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export interface LotteryResult {date:string;head:string;drawNumber:string;sourceUrl:string;sourceSha256:string;checkedAt:string;extract:string}
export function parseNocturna(html:string,day:string):LotteryResult {
  const sections=html.split(/<h3\b[^>]*>/i).slice(1);
  const section=sections.find(s=>/^Quiniela Nocturna\s*</i.test(s));
  if(!section)throw new AppError(503,'La fuente oficial cambió de formato. No se finalizó la rifa.');
  const block=section.split(/<div\s+class="sorteo"/i)[0];
  const date=block.match(/class="fechaSorteo"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*</);
  const draw=block.match(/class="nSorteo"[^>]*>\s*Sorteo N[°º]\s*(\d+)\s*</);
  const pairs=[...block.matchAll(/<span>\s*(\d{2})\s*<\/span>\s*<span>\s*(\d{4}|----)\s*<\/span>/g)];
  if(!date||!draw||`${date[3]}-${date[2]}-${date[1]}`!==day||pairs.length!==20||pairs.some((p,i)=>Number(p[1])!==i+1||!/^\d{4}$/.test(p[2])))throw new AppError(409,'La Nocturna de la fecha prevista todavía no tiene un resultado oficial completo. Volvé a consultar cuando se publique.');
  return {date:day,head:pairs[0][2],drawNumber:draw[1],sourceUrl:LOTTERY_URL,sourceSha256:createHash('sha256').update(block).digest('hex'),checkedAt:new Date().toISOString(),extract:block};
}
export async function fetchNocturna(day:string):Promise<LotteryResult>{
  try{
    if(day!==argentinaDay())return await fetchHistoricalNocturna(day);
    try{return parseNocturna(await boundedText(LOTTERY_URL),day);}
    catch(error){if(error instanceof AppError&&error.status===409)return await fetchHistoricalNocturna(day);throw error;}
  }catch(error){if(error instanceof AppError)throw error;throw new AppError(503,'No pudimos verificar el resultado en Lotería de la Provincia. Las ventas siguen cerradas y se reintentará la consulta.');}
}
export class LotteryService {
  private failedReads=new Map<string,{until:number;error:unknown}>();
  constructor(private db:PrismaClient,private source:(day:string)=>Promise<LotteryResult>=fetchNocturna){}
  async requestClose(actorId:string|null,id:string,now=new Date(),automatic=false){
    return atomic(this.db,async tx=>{
      const raffle=await tx.raffle.findUniqueOrThrow({where:{id}});
      if(raffle.status==='CANCELLED')throw new AppError(409,'La rifa fue cancelada y no admite un resultado nuevo.');
      if(raffle.status==='FINISHED'||raffle.status==='CLOSING')return raffle;
      const closedEarly=!automatic&&(!raffle.drawAt||now<raffle.drawAt);
      const resultDate=closedEarly||!raffle.drawAt?argentinaDay(now):argentinaDay(raffle.drawAt);
      const result=await tx.raffle.update({where:{id},data:{status:'CLOSING',closingAt:now,resultDate,closedEarly,closingNote:'Las ventas están cerradas. Esperando el resultado oficial y la revisión de pagos pendientes.'}});
      const reservations=await tx.order.findMany({where:{raffleId:id,status:'RESERVED'},select:{id:true}});
      if(reservations.length){const ids=reservations.map(o=>o.id);await tx.allocation.deleteMany({where:{orderId:{in:ids}}});await tx.order.updateMany({where:{id:{in:ids}},data:{status:'CANCELLED',decisionNote:'La reserva sin pago se canceló al cerrar las ventas de la rifa.'}});await tx.auditLog.createMany({data:ids.map(entityId=>({actorId,actorRole:actorId?'ADMIN' as const:null,action:'ORDER_CANCELLED_AT_RAFFLE_CLOSE',entityId}))});}
      if(closedEarly)await queueRaffleBuyerEmails(tx,id,'RAFFLE_EARLY_CLOSURE');
      await recordActivity(tx,{data:{actorId,actorRole:actorId?'ADMIN':null,action:automatic?'RAFFLE_AUTOMATIC_CLOSE_REQUESTED':'RAFFLE_CLOSE_REQUESTED',entityId:id,detail:{resultDate,closedEarly}}});
      return result;
    });
  }
  private async official(day:string){
    const stored=await this.db.lotteryDraw.findUnique({where:{date:day}});if(stored)return stored.payload as unknown as LotteryResult;
    const failed=this.failedReads.get(day);if(failed&&failed.until>Date.now())throw failed.error;
    try{const result=await this.source(day);if(result.date!==day||!/^\d{4}$/.test(result.head)||result.sourceUrl!==LOTTERY_URL)throw new AppError(503,'El resultado oficial no coincide con la fecha o fuente requerida.');const saved=await this.db.lotteryDraw.upsert({where:{date:day},update:{},create:{date:day,payload:result as unknown as Prisma.InputJsonValue}});return saved.payload as unknown as LotteryResult;}
    catch(error){this.failedReads.set(day,{until:Date.now()+30000,error});throw error;}
  }
  async resolve(id:string,now=new Date()){
    const initial=await this.db.raffle.findUniqueOrThrow({where:{id}});
    if(initial.status==='FINISHED')return initial;
    if(initial.status!=='CLOSING'||!initial.resultDate)throw new AppError(409,'La rifa no tiene un cierre pendiente.');
    if(!initial.lotteryDigits||initial.totalTickets>10**initial.lotteryDigits)throw new AppError(409,'Falta definir la cantidad de cifras para esta rifa antes de finalizarla.');
    const official=await this.official(initial.resultDate);
    return atomic(this.db,async tx=>{
      await expireOrders(tx,now);
      const raffle=await tx.raffle.findUniqueOrThrow({where:{id}});
      if(raffle.status==='FINISHED')return raffle;
      if(raffle.status!=='CLOSING'||raffle.resultDate!==initial.resultDate||raffle.lotteryDigits!==initial.lotteryDigits||raffle.totalTickets!==initial.totalTickets)throw new AppError(409,'La rifa cambió durante la consulta. Revisá su estado.');
      if(await tx.order.count({where:{raffleId:id,status:{in:['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION']}}}))throw new AppError(409,'Resolvé las compras pendientes antes de finalizar la rifa.');
      const number=Number(official.head.slice(-raffle.lotteryDigits!));
      const allocation=await tx.allocation.findUnique({where:{raffleId_number:{raffleId:id,number}},include:{order:{include:{user:true}}}});
      if(number<raffle.numberStart||number>=raffle.numberStart+raffle.totalTickets||allocation?.order.status!=='PAID')throw new AppError(409,`El número oficial ${String(number).padStart(raffle.lotteryDigits!,'0')} no tiene una compra pagada. La rifa queda pendiente hasta definir la regla para números no vendidos.`);
      const order=allocation.order;
      // Public display never includes email, DNI, address or a full customer record.
      const first=order.buyerFirstName||order.user?.firstName||'Participante';
      const last=order.buyerLastName||order.user?.lastName||'';
      const winnerDisplayName=`${first}${last?` ${last[0]}.`:''}`;
      const result=await tx.raffle.update({where:{id},data:{status:'FINISHED',winnerNumber:number,drawnAt:now,winnerOrderId:order.id,winnerDisplayName,lotteryResult:official as unknown as Prisma.InputJsonValue,closingNote:null}});
      await queueOrderEmail(tx,order.id,'RAFFLE_WINNER');
      await queueAdminResultEmails(tx,id);
      await recordActivity(tx,{data:{action:'RAFFLE_RESULT_CONFIRMED',entityId:id,detail:{winnerNumber:number,date:official.date,head:official.head,drawNumber:official.drawNumber,sourceUrl:official.sourceUrl,sourceSha256:official.sourceSha256}}});
      return result;
    });
  }
  private async attempt(id:string,now:Date){
    try{return await this.resolve(id,now);}catch(error){if(!(error instanceof AppError)||![409,503].includes(error.status))throw error;await this.db.raffle.updateMany({where:{id,status:'CLOSING'},data:{closingNote:error.message}});return this.db.raffle.findUniqueOrThrow({where:{id}});}
  }
  async finish(actorId:string,id:string,now=new Date()){
    const raffle=await this.requestClose(actorId,id,now);return raffle.status==='FINISHED'?raffle:this.attempt(id,now);
  }
  async runScheduled(now=new Date()){
    const scheduled=await this.db.raffle.findMany({where:{status:'ACTIVE',drawAt:{not:null}},orderBy:{drawAt:'asc'},take:200});let requested=0,finished=0,failed=0;
    for(const raffle of scheduled){if(!salesClosed(raffle.drawAt,now))continue;try{await this.requestClose(null,raffle.id,now,true);requested++;}catch(error){if(!(error instanceof AppError&&error.status===409))throw error;}}
    const pending=await this.db.raffle.findMany({where:{status:'CLOSING'},orderBy:{closingAt:'asc'},take:200});
    for(const raffle of pending){try{if((await this.attempt(raffle.id,now)).status==='FINISHED')finished++;}catch{failed++;}}
    return {requested,finished,failed};
  }
}
export function publicRaffle<T extends {lotteryResult:Prisma.JsonValue;winnerOrderId:string|null;cancellationBuyers?:Prisma.JsonValue}>(raffle:T,now=new Date()){
  const {lotteryResult,winnerOrderId:_private,cancellationBuyers:_buyers,...rest}=raffle;
  const result=lotteryResult as unknown as LotteryResult|null;
  return {...rest,lotteryResult:result?{date:result.date,head:result.head,drawNumber:result.drawNumber,checkedAt:result.checkedAt,sourceSha256:result.sourceSha256,...(result.date===argentinaDay(now)?{sourceUrl:LOTTERY_URL}:{})}:null};
}
