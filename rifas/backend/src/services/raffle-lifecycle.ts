import type {PrismaClient,Prisma} from '../generated/prisma/client.js';
import {atomic} from '../db.js';
import {recordActivity} from './activity.js';
import {paidBuyers} from './buyers.js';
import {queueRaffleBuyerEmails} from './raffle-emails.js';

export async function cancelRaffle(db:PrismaClient,actorId:string,id:string,reason='',now=new Date()){
 return atomic(db,async tx=>{
  const raffle=await tx.raffle.findUniqueOrThrow({where:{id}});if(raffle.status==='CANCELLED')return {ok:true,alreadyCancelled:true};
  const buyers=await paidBuyers(tx,id);
  const paid=await tx.order.findMany({where:{raffleId:id,status:'PAID'},select:{id:true,amountCents:true}});
  await tx.raffle.update({where:{id},data:{status:'CANCELLED',cancelledAt:now,cancellationReason:reason.trim()||null,cancellationBuyers:JSON.parse(JSON.stringify(buyers)) as Prisma.InputJsonValue,closingNote:'Rifa cancelada por un administrador.'}});
  // Queue against the original paid orders before changing their state. No payment is refunded here.
  await queueRaffleBuyerEmails(tx,id,'RAFFLE_CANCELLED',paid.map(o=>o.id));
  for(const order of paid)await tx.order.update({where:{id:order.id},data:{status:'REFUND_PENDING',refundRequestedAt:now,refundAmountCents:order.amountCents,reviewedBy:actorId,decisionNote:`Rifa cancelada por un administrador.${reason.trim()?` Motivo: ${reason.trim()}`:''}`}});
  await tx.order.updateMany({where:{raffleId:id,status:{in:['RESERVED','AWAITING_RECEIPT','PAYMENT_PENDING']}},data:{status:'CANCELLED',decisionNote:'La rifa fue cancelada por un administrador. Si ya pagaste, contactá a Halcón para verificar el ingreso y gestionar la devolución.'}});
  await tx.order.updateMany({where:{raffleId:id,status:'UNDER_REVIEW'},data:{status:'NEEDS_ATTENTION',decisionNote:'Rifa cancelada. Verificar la acreditación y gestionar la devolución si el pago ingresó.'}});
  // Preserve historical allocations of a published result; otherwise there are no numbers left for sale.
  if(!raffle.drawnAt)await tx.allocation.deleteMany({where:{raffleId:id}});
  await recordActivity(tx,{data:{actorId,action:'RAFFLE_CANCELLED',entityId:id,detail:{reason:reason.trim()||null,buyers:buyers.length,paidOrders:paid.length}}});
  return {ok:true,alreadyCancelled:false,buyers:buyers.length,refundsPending:paid.length};
 });
}
