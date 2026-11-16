import {grantFreeTickets} from './free-tickets.js';
import { recordActivity } from './activity.js';
import { createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { expireOrders,salesClosed } from './orders.js';
import { queueOrderEmail } from './purchase-emails.js';
import {queueRaffleBuyerEmails,queueAdminResultEmails} from './raffle-emails.js';
import {boundedText,fetchHistoricalNocturna} from './lottery-history.js';
import {awardInclude,prizeText} from './award-config.js';
import {lotteryDigitsFor} from '../numbering.js';

export const LOTTERY_URL='https://loteria.gba.gob.ar/resultados';
export function argentinaDay(date=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function nocturnaDay(date=new Date()){return new Date(`${argentinaDay(date)}T12:00:00Z`).getUTCDay()!==0;}
export interface LotteryResult {date:string;head:string;numbers?:string[];drawNumber:string;sourceUrl:string;sourceSha256:string;checkedAt:string;extract:string}
export function parseNocturna(html:string,day:string):LotteryResult {
  const sections=html.split(/<h3\b[^>]*>/i).slice(1);
  const section=sections.find(s=>/^Quiniela Nocturna\s*</i.test(s));
  if(!section)throw new AppError(503,'La fuente oficial cambió de formato. No se finalizó la rifa.');
  const block=section.split(/<div\s+class="sorteo"/i)[0];
  const date=block.match(/class="fechaSorteo"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*</);
  const draw=block.match(/class="nSorteo"[^>]*>\s*Sorteo N[°º]\s*(\d+)\s*</);
  const pairs=[...block.matchAll(/<span>\s*(\d{2})\s*<\/span>\s*<span>\s*(\d{4}|----)\s*<\/span>/g)];
  if(!date||!draw||`${date[3]}-${date[2]}-${date[1]}`!==day||pairs.length!==20||pairs.some((p,i)=>Number(p[1])!==i+1||!/^\d{4}$/.test(p[2])))throw new AppError(409,'La Nocturna de la fecha prevista todavía no tiene un resultado oficial completo. Volvé a consultar cuando se publique.');
  return {date:day,head:pairs[0][2],numbers:pairs.map(p=>p[2]),drawNumber:draw[1],sourceUrl:LOTTERY_URL,sourceSha256:createHash('sha256').update(block).digest('hex'),checkedAt:new Date().toISOString(),extract:block};
}
export function officialNumbers(result:LotteryResult,required=1){
  let numbers=result.numbers;
  if(!numbers){
    try{const parsed=JSON.parse(result.extract);if(Array.isArray(parsed.numbers))numbers=parsed.numbers;}catch{}
    if(!numbers){const pairs=[...result.extract.matchAll(/<span>\s*(\d{2})\s*<\/span>\s*<span>\s*(\d{4})\s*<\/span>/g)];if(pairs.length===20&&pairs.every((p,i)=>Number(p[1])===i+1))numbers=pairs.map(p=>p[2]);}
  }
  if(!numbers&&required===1)return [result.head];
  if(!numbers||numbers.length!==20||numbers.some(n=>typeof n!=='string'||!/^\d{4}$/.test(n))||numbers[0]!==result.head)throw new AppError(503,'El extracto oficial no permite verificar todos los puestos. El resultado queda pendiente.');
  return numbers;
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
      const raffle=await tx.raffle.findUniqueOrThrow({where:{id},include:{...awardInclude,prize:true}});
      if(raffle.status==='DRAFT')throw new AppError(409,'Un borrador todavía no empezó. Dale de alta antes de finalizar la rifa.');
      if(raffle.status==='CANCELLED')throw new AppError(409,'La rifa fue cancelada y no admite un resultado nuevo.');
      if(raffle.status==='FINISHED'||raffle.status==='CLOSING')return raffle;
      if(!nocturnaDay(now))throw new AppError(409,'Los domingos no hay Nocturna bonaerense. La rifa no puede finalizarse ese día.');
      if(raffle.totalTickets<10)throw new AppError(409,'Una rifa debe tener al menos 10 números para poder finalizarse.');
      const closedEarly=!automatic&&(!raffle.drawAt||now<raffle.drawAt);
      const resultDate=argentinaDay(now);
      const result=await tx.raffle.update({where:{id},data:{status:'CLOSING',closingAt:now,resultDate,closedEarly,closingNote:'Las ventas están cerradas. Esperando la Nocturna bonaerense del día del cierre y la revisión de pagos pendientes.'}});
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
    let initial=await this.db.raffle.findUniqueOrThrow({where:{id}});
    if(initial.status==='FINISHED')return initial;
    if(initial.status!=='CLOSING'||!initial.closingAt)throw new AppError(409,'La rifa no tiene un cierre pendiente.');
    const closingDay=argentinaDay(initial.closingAt);
    if(initial.resultDate!==closingDay){
      await atomic(this.db,async tx=>{
        const changed=await tx.raffle.updateMany({where:{id,status:'CLOSING',closingAt:initial.closingAt,resultDate:initial.resultDate},data:{resultDate:closingDay}});
        if(changed.count)await recordActivity(tx,{data:{action:'RAFFLE_RESULT_DAY_FIXED',entityId:id,detail:{previousDate:initial.resultDate,resultDate:closingDay}}});
      });
      initial=await this.db.raffle.findUniqueOrThrow({where:{id}});
      if(initial.status==='FINISHED')return initial;
      if(initial.status!=='CLOSING'||!initial.resultDate)throw new AppError(409,'La rifa cambió durante la consulta. Revisá su estado.');
    }
    const digits=lotteryDigitsFor(initial.totalTickets);
    if(initial.lotteryDigits!==digits)throw new AppError(409,`Esta rifa conserva una regla anterior. Debe revisarse antes de aplicar ${digits} cifras según su cantidad de números.`);
    const official=await this.official(initial.resultDate!);
    return atomic(this.db,async tx=>{
      await expireOrders(tx,now);
      const raffle=await tx.raffle.findUniqueOrThrow({where:{id},include:{...awardInclude,prize:true}});
      if(raffle.status==='FINISHED')return raffle;
      if(raffle.status!=='CLOSING'||raffle.resultDate!==initial.resultDate||raffle.lotteryDigits!==initial.lotteryDigits||raffle.totalTickets!==initial.totalTickets)throw new AppError(409,'La rifa cambió durante la consulta. Revisá su estado.');
      if(await tx.order.count({where:{raffleId:id,status:{in:['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION']}}}))throw new AppError(409,'Resolvé las compras pendientes antes de finalizar la rifa.');
      const awards=raffle.awards.length?raffle.awards:[await tx.raffleAward.create({data:{raffleId:id,rank:1,prizes:{create:{prizeId:raffle.prizeId,name:raffle.prize.name,description:raffle.prize.description,kind:raffle.prize.kind,quantity:1}}},include:{prizes:true}})];
      const numbers=officialNumbers(official,awards.length);
      const winners=[];
      for(const award of awards){
        if(award.rank>winners.length+1||!award.prizes.length)throw new AppError(409,'La configuración de puestos y premios está incompleta.');
        const officialNumber=numbers[award.rank-1],number=Number(officialNumber.slice(-digits));
        const allocation=await tx.allocation.findUnique({where:{raffleId_number:{raffleId:id,number}},include:{order:{include:{user:true}}}});
        if(number<raffle.numberStart||number>=raffle.numberStart+raffle.totalTickets||allocation?.order.status!=='PAID')throw new AppError(409,`El número oficial ${String(number).padStart(raffle.lotteryDigits!,'0')} del puesto ${award.rank} no tiene una compra pagada. La rifa queda pendiente hasta definir la regla para números no vendidos.`);
        const order=allocation.order,first=order.buyerFirstName||order.user?.firstName||'Participante',last=order.buyerLastName||order.user?.lastName||'';
        winners.push({award,number,officialNumber,orderId:order.id,winnerDisplayName:`${first}${last?` ${last[0]}.`:''}`});
      }
      for(const winner of winners)await tx.raffleAward.update({where:{id:winner.award.id},data:{winningNumber:winner.number,officialNumber:winner.officialNumber,winnerOrderId:winner.orderId,winnerDisplayName:winner.winnerDisplayName}});
      const first=winners[0];
      const result=await tx.raffle.update({where:{id},data:{status:'FINISHED',winnerNumber:first.number,drawnAt:now,winnerOrderId:first.orderId,winnerDisplayName:first.winnerDisplayName,lotteryResult:official as unknown as Prisma.InputJsonValue,closingNote:null},include:awardInclude});
      await grantFreeTickets(tx,id,now);
      for(const orderId of new Set(winners.map(w=>w.orderId)))await queueOrderEmail(tx,orderId,'RAFFLE_WINNER');
      await queueAdminResultEmails(tx,id);
      await recordActivity(tx,{data:{action:'RAFFLE_RESULT_CONFIRMED',entityId:id,detail:{winnerNumber:first.number,winners:winners.map(w=>({rank:w.award.rank,number:w.number,prizes:prizeText(w.award.prizes)})),date:official.date,head:official.head,drawNumber:official.drawNumber,sourceUrl:official.sourceUrl,sourceSha256:official.sourceSha256}}});
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
export function publicRaffle<T extends {lotteryResult:Prisma.JsonValue;winnerOrderId:string|null;cancellationBuyers?:Prisma.JsonValue;awards?:Prisma.RaffleAwardGetPayload<{include:{prizes:true}}>[]}>(raffle:T,now=new Date()){
  const {lotteryResult,winnerOrderId:_private,cancellationBuyers:_buyers,awards,...rest}=raffle;
  const result=lotteryResult as unknown as LotteryResult|null;
  return {...rest,...(awards?{awards:awards.map(({winnerOrderId:_order,...award})=>award)}:{}),lotteryResult:result?{date:result.date,head:result.head,drawNumber:result.drawNumber,checkedAt:result.checkedAt,sourceSha256:result.sourceSha256,...(result.date===argentinaDay(now)?{sourceUrl:LOTTERY_URL}:{})}:null};
}
