import type {Prisma,PrismaClient} from '../generated/prisma/client.js';
import {atomic} from '../db.js';
import {AppError} from '../errors.js';
import {expireOrders,salesClosed} from './orders.js';
import {reserveInOrder} from './reservation-queue.js';
import {buyerSnapshot} from './buyer-identity.js';
import {queueOrderEmail} from './purchase-emails.js';
import {recordActivity} from './activity.js';
import type {z} from 'zod';
import {manualFreeTicketsSchema} from '../schemas.js';

export async function bindNextFreeTickets(tx:Prisma.TransactionClient,raffleId:string,openedAt:Date){
 await tx.freeTicketBenefit.updateMany({where:{targetRaffleId:null,awardPrizeId:{not:null},revokedAt:null,remaining:{gt:0},createdAt:{lte:openedAt},awardPrize:{award:{raffleId:{not:raffleId},raffle:{status:'FINISHED'}}}},data:{targetRaffleId:raffleId}});
}
async function manualTarget(tx:Prisma.TransactionClient,id:string){
 const raffle=await tx.raffle.findUnique({where:{id}});
 if(!raffle||raffle.totalTickets<10||!['DRAFT','ACTIVE'].includes(raffle.status)||raffle.drawnAt||(raffle.status==='ACTIVE'&&salesClosed(raffle.drawAt)))throw new AppError(409,'Elegí un borrador o una rifa activa con ventas abiertas.');
 return raffle;
}

export async function grantFreeTickets(tx:Prisma.TransactionClient,raffleId:string,now:Date){
 const awards=await tx.raffleAward.findMany({where:{raffleId},include:{prizes:true,winnerOrder:true}});
 const next=await tx.raffle.findFirst({where:{id:{not:raffleId},openedAt:{gte:now},status:{notIn:['DRAFT','CANCELLED']},totalTickets:{gte:10}},orderBy:[{openedAt:'asc'},{id:'asc'}],select:{id:true}});
 for(const award of awards)for(const prize of award.prizes){
  if(prize.kind!=='FREE_TICKET')continue;
  if(!award.winnerOrder?.userId)throw new AppError(409,'El ganador del número gratis debe tener una cuenta para recibir su premio.');
  await tx.freeTicketBenefit.upsert({where:{awardPrizeId:prize.id},update:{},create:{userId:award.winnerOrder.userId,awardPrizeId:prize.id,quantity:prize.quantity,remaining:prize.quantity,targetRaffleId:next?.id,createdAt:now,validFrom:now}});
 }
}
export async function restoreFreeTickets(tx:Prisma.TransactionClient,orderId:string,now=new Date()){
 const uses=await tx.freeTicketUse.findMany({where:{orderId,restoredAt:null}});
 for(const use of uses){
  await tx.freeTicketBenefit.update({where:{id:use.benefitId},data:{remaining:{increment:use.quantity}}});
  await tx.freeTicketUse.update({where:{id:use.id},data:{restoredAt:now}});
 }
}
export class FreeTicketsService {
 constructor(private db:PrismaClient){}
 async assignPending(actorId:string,userId:string,id:string,targetRaffleId:string){
  return atomic(this.db,async tx=>{
   const benefit=await tx.freeTicketBenefit.findUnique({where:{id},include:{targetRaffle:{select:{status:true}}}});
   if(!benefit||benefit.userId!==userId||benefit.awardPrizeId||benefit.revokedAt||benefit.remaining<1)throw new AppError(409,'Este beneficio no admite una asignación manual.');
   if(benefit.targetRaffleId===targetRaffleId)return {id,targetRaffleId};
   if(benefit.targetRaffleId&&benefit.targetRaffle?.status!=='CANCELLED')throw new AppError(409,'El beneficio ya tiene una rifa asignada.');
   const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(!user.active)throw new AppError(409,'Reactivá la cuenta antes de asignarle una rifa.');
   await manualTarget(tx,targetRaffleId);
   await tx.freeTicketBenefit.update({where:{id},data:{targetRaffleId}});
   await recordActivity(tx,{data:{actorId,action:'FREE_TICKETS_TARGET_ASSIGNED',entityId:userId,detail:{benefitId:id,targetRaffleId,quantity:benefit.remaining}}});
   return {id,targetRaffleId};
  });
 }
 async grant(actorId:string,userId:string,input:z.infer<typeof manualFreeTicketsSchema>,now=new Date()){
  return atomic(this.db,async tx=>{
   const grantKey=`${actorId}:${input.requestId}`,reason=input.reason.trim();
   const existing=await tx.freeTicketBenefit.findUnique({where:{grantKey}});
   if(existing){if(existing.userId!==userId||existing.quantity!==input.quantity||existing.targetRaffleId!==input.targetRaffleId||existing.reason!==reason)throw new AppError(409,'La solicitud ya se utilizó con otros datos.');return {id:existing.id,quantity:existing.quantity,remaining:existing.remaining,targetRaffleId:existing.targetRaffleId};}
   const user=await tx.user.findUnique({where:{id:userId}});
   if(!user)throw new AppError(404,'Usuario no encontrado.');
   if(!user.active)throw new AppError(409,'Reactivá la cuenta antes de otorgarle números gratis.');
   await manualTarget(tx,input.targetRaffleId);
   const benefit=await tx.freeTicketBenefit.create({data:{userId,quantity:input.quantity,remaining:input.quantity,grantedBy:actorId,grantKey,reason,targetRaffleId:input.targetRaffleId,createdAt:now,validFrom:now}});
   await recordActivity(tx,{data:{actorId,action:'FREE_TICKETS_GRANTED_MANUALLY',entityId:userId,detail:{quantity:input.quantity,targetRaffleId:input.targetRaffleId,reason,benefitId:benefit.id}}});
   return {id:benefit.id,quantity:benefit.quantity,remaining:benefit.remaining,targetRaffleId:benefit.targetRaffleId};
  });
 }
 async list(userId:string){
  const benefits=await this.db.freeTicketBenefit.findMany({where:{userId},include:{awardPrize:{select:{name:true,award:{select:{rank:true,raffle:{select:{id:true,title:true,status:true}}}}}},targetRaffle:{select:{id:true,title:true,status:true,drawAt:true,totalTickets:true}}},orderBy:{createdAt:'asc'}});
  return benefits.map(b=>{
   const sourceRaffle=b.awardPrize?.award.raffle||null;
   const r=b.targetRaffle;
   const targetRaffle=r?{id:r.id,title:r.title,status:r.status}:null;
   const availableRaffles=!b.revokedAt&&b.remaining>0&&(!sourceRaffle||sourceRaffle.status==='FINISHED')&&r&&r.status==='ACTIVE'&&r.totalTickets>=10&&!salesClosed(r.drawAt)?[targetRaffle!]:[];
   return {id:b.id,quantity:b.quantity,remaining:b.remaining,revoked:!!b.revokedAt,sourceRaffle,rank:b.awardPrize?.award.rank||null,reason:b.reason,targetRaffle,availableRaffles,available:availableRaffles.length>0,createdAt:b.createdAt};
  });
 }
 async redeem(userId:string,orderId:string){
  const initial=await this.db.order.findUnique({where:{id:orderId},select:{raffleId:true,userId:true}});
  if(!initial)throw new AppError(404,'Reserva no encontrada.');
  if(initial.userId!==userId)throw new AppError(403,'No es tu reserva.');
  return reserveInOrder(this.db,initial.raffleId,()=>atomic(this.db,async tx=>{
   await expireOrders(tx);
   const order=await tx.order.findUniqueOrThrow({where:{id:orderId},include:{raffle:true,allocations:true}});
   if(order.method==='FREE_TICKET'&&order.status==='PAID')return order;
   if(order.userId!==userId||order.status!=='RESERVED'||order.method||order.preferenceId||order.paymentCreatingAt)throw new AppError(409,'Esta reserva ya no admite usar números gratis.');
   if(order.raffle.status!=='ACTIVE'||salesClosed(order.raffle.drawAt)||order.expiresAt<=new Date()||order.allocations.length!==order.numbers.length)throw new AppError(409,'La reserva venció o la venta de la rifa ya cerró.');
   const benefits=await tx.freeTicketBenefit.findMany({where:{userId,targetRaffleId:order.raffleId,revokedAt:null,remaining:{gt:0},OR:[{awardPrizeId:null},{awardPrize:{award:{raffleId:{not:order.raffleId},raffle:{status:'FINISHED'}}}}]},orderBy:[{createdAt:'asc'},{id:'asc'}]});
   let needed=order.numbers.length;
   if(benefits.reduce((sum,b)=>sum+b.remaining,0)<needed)throw new AppError(409,'No tenés suficientes números gratis para esta reserva. Reservá por separado los números que quieras pagar.');
   const identity=await buyerSnapshot(tx,userId);
   for(const benefit of benefits){
    const quantity=Math.min(needed,benefit.remaining);if(!quantity)break;
    const changed=await tx.freeTicketBenefit.updateMany({where:{id:benefit.id,revokedAt:null,remaining:{gte:quantity}},data:{remaining:{decrement:quantity}}});
    if(changed.count!==1)throw new AppError(409,'El beneficio cambió. Actualizá la compra antes de continuar.');
    await tx.freeTicketUse.create({data:{benefitId:benefit.id,orderId,quantity}});needed-=quantity;
   }
   const result=await tx.order.update({where:{id:orderId},data:{...identity,status:'PAID',method:'FREE_TICKET',unitPriceCents:0,amountCents:0,paidAt:new Date(),decisionNote:'Participación confirmada mediante premio de números gratis. Sin pago.'}});
   await queueOrderEmail(tx,orderId,'PURCHASE_CONFIRMED');
   await recordActivity(tx,{data:{actorId:userId,action:'FREE_TICKETS_REDEEMED',entityId:orderId,detail:{quantity:order.numbers.length}}});
   return result;
  }));
 }
}
