import type {Prisma,PrismaClient,Order,Raffle} from '../generated/prisma/client.js';
import {atomic} from '../db.js';
import {AppError} from '../errors.js';
import {salesClosed} from './orders.js';
import {recordActivity} from './activity.js';
import {queueRefundRequestEmail} from './purchase-emails.js';

export const refundRequestSelect={id:true,orderId:true,numbers:true,amountCents:true,reason:true,status:true,decisionNote:true,createdAt:true,reviewedAt:true,refundOrderId:true} as const;
export const refundRequestsInclude={refundRequests:{select:refundRequestSelect,orderBy:{createdAt:'desc' as const}},refundParts:{select:{id:true,numbers:true,amountCents:true,status:true,refundCompletedAt:true}}} as const;

function eligible(order:Order&{raffle:Raffle},now:Date){
 if(order.status!=='PAID'||!order.paidAt||!['TRANSFER','MERCADO_PAGO'].includes(order.method||'')||order.amountCents<1)throw new AppError(409,'Sólo se puede solicitar la devolución de números con pago confirmado. Los números gratis no generan reembolso.');
 if(order.raffle.status!=='ACTIVE'||order.raffle.drawnAt||salesClosed(order.raffle.drawAt,now))throw new AppError(409,'La rifa debe estar activa y con su plazo de participación abierto.');
 if(order.refundRequestedAt||order.refundCompletedAt)throw new AppError(409,'Esta compra ya tiene una devolución en gestión.');
}
function amountFor(order:Order,numbers:number[]){
 if(!numbers.length||new Set(numbers).size!==numbers.length||numbers.some(n=>!order.numbers.includes(n)))throw new AppError(400,'Elegí únicamente números de esta compra, sin repetirlos.');
 if(order.unitPriceCents<1||order.amountCents!==order.numbers.length*order.unitPriceCents)throw new AppError(409,'El importe histórico necesita una revisión administrativa antes de solicitar una devolución.');
 return numbers.length*order.unitPriceCents;
}
async function allocated(tx:Prisma.TransactionClient,orderId:string,numbers:number[]){
 if(await tx.allocation.count({where:{orderId,number:{in:numbers}}})!==numbers.length)throw new AppError(409,'Los números ya no pertenecen a esta participación. Actualizá la compra.');
}

export class RefundRequestsService {
 constructor(private db:PrismaClient){}
 async create(userId:string,orderId:string,input:{numbers:number[];reason:string;requestId:string},now=new Date()){
  return atomic(this.db,async tx=>{
   const order=await tx.order.findUniqueOrThrow({where:{id:orderId},include:{raffle:true,user:{select:{active:true}}}});
   if(order.userId!==userId)throw new AppError(403,'Sólo el titular puede solicitar la devolución de sus números.');
   if(!order.user?.active)throw new AppError(401,'Tu cuenta ya no está activa.');
   const numbers=[...input.numbers].sort((a,b)=>a-b),requestKey=`${userId}:${input.requestId}`,reason=input.reason.trim();
   const existing=await tx.refundRequest.findUnique({where:{requestKey}});
   if(existing){if(existing.orderId!==orderId||JSON.stringify(existing.numbers)!==JSON.stringify(numbers)||existing.reason!==reason)throw new AppError(409,'La solicitud ya fue utilizada con otros datos.');return existing;}
   eligible(order,now);const amountCents=amountFor(order,numbers);await allocated(tx,orderId,numbers);
   if(await tx.refundRequest.count({where:{orderId,status:'PENDING'}}))throw new AppError(409,'Esta compra ya tiene una solicitud pendiente de aprobación.');
   const result=await tx.refundRequest.create({data:{orderId,numbers,amountCents,reason,requestKey,createdAt:now}});
   await queueRefundRequestEmail(tx,result.id,'REFUND_REQUEST_RECEIVED');
   await recordActivity(tx,{data:{actorId:userId,action:'CUSTOMER_REFUND_REQUESTED',entityId:orderId,detail:{requestId:result.id,numbers,amountCents}}});
   return result;
  });
 }
 async list(status:'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED',page:number){
  const where={status};return {items:await this.db.refundRequest.findMany({where,include:{order:{include:{raffle:{select:{id:true,title:true,status:true,totalTickets:true,drawAt:true,drawnAt:true}},user:{select:{fullName:true,email:true,firstName:true,lastName:true,dni:true}}}}},orderBy:{createdAt:'asc'},skip:(page-1)*25,take:25}),total:await this.db.refundRequest.count({where}),page};
 }
 async review(actorId:string,id:string,input:{decision:'approve'|'reject';note:string},now=new Date()){
  return atomic(this.db,async tx=>{
   const admin=await tx.user.findUnique({where:{id:actorId},select:{role:true,active:true}});
   if(!admin?.active||admin.role!=='ADMIN')throw new AppError(403,'Necesitás permisos de administrador.');
   const request=await tx.refundRequest.findUniqueOrThrow({where:{id},include:{order:{include:{raffle:true}}}});
   if(request.status!=='PENDING')throw new AppError(409,'La solicitud ya fue revisada o reemplazada por otra gestión.');
   const note=input.note.trim();
   if(input.decision==='reject'){
    if(note.length<5)throw new AppError(400,'Explicá el motivo del rechazo con al menos cinco caracteres.');
    const result=await tx.refundRequest.update({where:{id},data:{status:'REJECTED',reviewedBy:actorId,reviewedAt:now,decisionNote:note}});
    await queueRefundRequestEmail(tx,id,'REFUND_REQUEST_REJECTED');
    await recordActivity(tx,{data:{actorId,action:'CUSTOMER_REFUND_REJECTED',entityId:request.orderId,detail:{requestId:id,numbers:request.numbers,note}}});return result;
   }
   const order=request.order;eligible(order,now);
   if(amountFor(order,request.numbers)!==request.amountCents)throw new AppError(409,'El importe de la compra cambió. Revisá la solicitud.');
   await allocated(tx,order.id,request.numbers);
   const remaining=order.numbers.filter(n=>!request.numbers.includes(n));
   const decisionNote=`Solicitud de devolución aprobada por administración. Reembolso de los números indicados en gestión en un plazo estimado de 24 a 72 horas hábiles.${note?` Observación: ${note}`:''}`;
   const snapshot={originalNumbers:order.originalNumbers.length?order.originalNumbers:order.numbers,originalAmountCents:order.originalAmountCents??order.amountCents};
   let refundOrderId=order.id;
   if(remaining.length){
    await tx.order.update({where:{id:order.id},data:{...snapshot,numbers:remaining,amountCents:order.amountCents-request.amountCents}});
    const part=await tx.order.create({data:{parentOrderId:order.id,userId:order.userId,raffleId:order.raffleId,numbers:request.numbers,unitPriceCents:order.unitPriceCents,amountCents:request.amountCents,status:'REFUND_PENDING',method:order.method,expiresAt:now,paidAt:order.paidAt,refundRequestedAt:now,refundAmountCents:request.amountCents,reviewedBy:actorId,decisionNote,buyerEmail:order.buyerEmail,buyerFirstName:order.buyerFirstName,buyerLastName:order.buyerLastName,buyerDni:order.buyerDni,transferAccountId:order.transferAccountId,transferHolder:order.transferHolder,transferAlias:order.transferAlias,transferCbu:order.transferCbu}});
    refundOrderId=part.id;
   }else await tx.order.update({where:{id:order.id},data:{...snapshot,status:'REFUND_PENDING',refundRequestedAt:now,refundAmountCents:request.amountCents,reviewedBy:actorId,decisionNote}});
   await tx.allocation.deleteMany({where:{orderId:order.id,number:{in:request.numbers}}});
   await tx.purchaseEmail.updateMany({where:{orderId:order.id,kind:'PURCHASE_CONFIRMED',status:{in:['PENDING','FAILED']}},data:{status:'SKIPPED',lastErrorCode:'REFUND_APPROVED'}});
   const result=await tx.refundRequest.update({where:{id},data:{status:'APPROVED',reviewedBy:actorId,reviewedAt:now,decisionNote:note,refundOrderId}});
   await queueRefundRequestEmail(tx,id,'REFUND_REQUEST_APPROVED');
   await recordActivity(tx,{data:{actorId,action:'CUSTOMER_REFUND_APPROVED',entityId:order.id,detail:{requestId:id,refundOrderId,numbers:request.numbers,amountCents:request.amountCents,remainingNumbers:remaining}}});return result;
  });
 }
}
