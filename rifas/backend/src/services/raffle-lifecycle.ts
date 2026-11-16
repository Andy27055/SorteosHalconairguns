import {restoreFreeTickets,bindNextFreeTickets} from './free-tickets.js';
import type {PrismaClient,Prisma} from '../generated/prisma/client.js';
import {atomic} from '../db.js';
import {recordActivity} from './activity.js';
import {paidBuyers} from './buyers.js';
import {queueRaffleBuyerEmails} from './raffle-emails.js';
import {AppError} from '../errors.js';
import {raffleSchema} from '../schemas.js';
import {supersedeRefundRequests} from './refund-state.js';
import {awardInclude} from './award-config.js';

export async function activateRaffle(db:PrismaClient,actorId:string,id:string,now=new Date()){
 return atomic(db,async tx=>{
  const raffle=await tx.raffle.findUniqueOrThrow({where:{id},include:awardInclude});
  if(raffle.status!=='DRAFT'||raffle.drawnAt)throw new AppError(409,'Sólo se puede dar de alta una rifa en borrador. Actualizá el listado.');
  const valid=raffleSchema.safeParse({...raffle,status:'ACTIVE',drawAt:raffle.drawAt?.toISOString()||null,awards:raffle.awards.length?raffle.awards.map(a=>({rank:a.rank,prizes:a.prizes.map(p=>({prizeId:p.prizeId,quantity:p.quantity}))})):undefined});
  if(!valid.success)throw new AppError(400,'Revisá los datos, las cifras y los premios del borrador antes de darlo de alta.');
  const result=await tx.raffle.update({where:{id},data:{status:'ACTIVE',openedAt:raffle.openedAt||now},include:awardInclude});
  if(!raffle.openedAt&&result.openedAt)await bindNextFreeTickets(tx,result.id,result.openedAt);
  await recordActivity(tx,{data:{actorId,action:'RAFFLE_ACTIVATED',entityId:id}});
  return result;
 });
}

export async function cancelRaffle(db:PrismaClient,actorId:string,id:string,reason='',now=new Date()){
 return atomic(db,async tx=>{
  const raffle=await tx.raffle.findUniqueOrThrow({where:{id}});if(raffle.status==='CANCELLED')return {ok:true,alreadyCancelled:true};
  const buyers=await paidBuyers(tx,id);
  const paid=await tx.order.findMany({where:{raffleId:id,status:'PAID'},select:{id:true,amountCents:true,method:true}});
  await tx.raffle.update({where:{id},data:{status:'CANCELLED',cancelledAt:now,cancellationReason:reason.trim()||null,cancellationBuyers:JSON.parse(JSON.stringify(buyers)) as Prisma.InputJsonValue,closingNote:'Rifa cancelada por un administrador.'}});
  // Queue against the original paid orders before changing their state. No payment is refunded here.
  await queueRaffleBuyerEmails(tx,id,'RAFFLE_CANCELLED',paid.map(o=>o.id));
  for(const order of paid)await supersedeRefundRequests(tx,order.id,'La rifa fue cancelada. La devolución de la compra se gestiona por la cancelación.',actorId);
  await tx.freeTicketBenefit.updateMany({where:{awardPrize:{award:{raffleId:id}},revokedAt:null},data:{revokedAt:now}});
  await tx.freeTicketBenefit.updateMany({where:{targetRaffleId:id,awardPrizeId:{not:null},revokedAt:null},data:{targetRaffleId:null}});
  for(const order of paid)if(order.method==='FREE_TICKET'){await restoreFreeTickets(tx,order.id,now);await tx.order.update({where:{id:order.id},data:{status:'CANCELLED',reviewedBy:actorId,decisionNote:'Rifa cancelada. Se restituyó el premio de números gratis para su rifa asignada o, si era un premio autom?tico, para la pr?xima apertura. Sin reembolso de dinero.'}});}else await tx.order.update({where:{id:order.id},data:{status:'REFUND_PENDING',refundRequestedAt:now,refundAmountCents:order.amountCents,reviewedBy:actorId,decisionNote:`Rifa cancelada por un administrador.${reason.trim()?` Motivo: ${reason.trim()}`:''}`}});
  await tx.order.updateMany({where:{raffleId:id,status:{in:['RESERVED','AWAITING_RECEIPT','PAYMENT_PENDING']}},data:{status:'CANCELLED',decisionNote:'La rifa fue cancelada por un administrador. Si ya pagaste, contactá a Halcón para verificar el ingreso y gestionar la devolución.'}});
  await tx.order.updateMany({where:{raffleId:id,status:'UNDER_REVIEW'},data:{status:'NEEDS_ATTENTION',decisionNote:'Rifa cancelada. Verificar la acreditación y gestionar la devolución si el pago ingresó.'}});
  // Preserve historical allocations of a published result; otherwise there are no numbers left for sale.
  if(!raffle.drawnAt)await tx.allocation.deleteMany({where:{raffleId:id}});
  await recordActivity(tx,{data:{actorId,action:'RAFFLE_CANCELLED',entityId:id,detail:{reason:reason.trim()||null,buyers:buyers.length,paidOrders:paid.length}}});
  return {ok:true,alreadyCancelled:false,buyers:buyers.length,refundsPending:paid.filter(o=>o.method!=='FREE_TICKET').length};
 });
}
