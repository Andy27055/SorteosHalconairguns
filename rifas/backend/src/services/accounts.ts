import type {Prisma,PrismaClient} from '../generated/prisma/client.js';
import {atomic} from '../db.js';
import {AppError} from '../errors.js';
import {recordActivity} from './activity.js';

async function deletionPreview(tx:Pick<Prisma.TransactionClient,'user'|'order'|'freeTicketBenefit'>,actorId:string,id:string){
 const user=await tx.user.findUniqueOrThrow({where:{id},select:{id:true,username:true,email:true,fullName:true,firstName:true,lastName:true,dni:true,role:true,adminType:true,active:true}});
 if(user.id===actorId||user.adminType==='PRIMARY')throw new AppError(409,'La cuenta administradora principal debe conservar su acceso.');
 const orders=await tx.order.count({where:{userId:id}});
 const activeOrders=await tx.order.count({where:{userId:id,OR:[
  {status:{in:['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION','REFUND_PENDING']}},
  {status:'PAID',raffle:{status:{in:['DRAFT','ACTIVE','CLOSING']}}},
  {refundRequestedAt:{not:null},refundCompletedAt:null},
  {refundRequests:{some:{status:'PENDING'}}}
 ]}});
 const activeBenefits=await tx.freeTicketBenefit.count({where:{userId:id,revokedAt:null,remaining:{gt:0}}});
 return {user,orders,activeOrders,activeBenefits,canDelete:activeOrders===0&&activeBenefits===0};
}
export async function accountDeletionPreview(db:PrismaClient,actorId:string,id:string){return atomic(db,tx=>deletionPreview(tx,actorId,id));}
export async function deleteAccount(db:PrismaClient,actorId:string,id:string){
 return atomic(db,async tx=>{
  const preview=await deletionPreview(tx,actorId,id);
  if(!preview.canDelete)throw new AppError(409,'La cuenta tiene compras, reservas, reembolsos o números gratis pendientes. Sólo se puede desactivar hasta resolverlos.');
  // Freeze legacy identities too. Never replace the identity recorded at purchase time.
  const orders=await tx.order.findMany({where:{userId:id},select:{id:true,buyerEmail:true,buyerFirstName:true,buyerLastName:true,buyerDni:true}});
  for(const order of orders)await tx.order.update({where:{id:order.id},data:{
   userId:null,buyerEmail:order.buyerEmail??preview.user.email,
   buyerFirstName:order.buyerFirstName??preview.user.firstName??preview.user.fullName,
   buyerLastName:order.buyerLastName??preview.user.lastName??'',buyerDni:order.buyerDni??preview.user.dni??''
  }});
  await tx.freeTicketBenefit.updateMany({where:{userId:id},data:{userId:null}});
  await tx.emailVerification.deleteMany({where:{userId:id}});
  // Retain readable attribution for actions performed by a now deleted account.
  for(const log of await tx.auditLog.findMany({where:{actorId:id},select:{id:true,detail:true}})){
   const detail=log.detail&&typeof log.detail==='object'&&!Array.isArray(log.detail)?log.detail:{};
   await tx.auditLog.update({where:{id:log.id},data:{detail:{...detail,actorName:preview.user.fullName}}});
  }
  await tx.user.delete({where:{id}});
  await recordActivity(tx,{data:{actorId,action:'ACCOUNT_DELETED',entityId:id,detail:{name:preview.user.fullName,username:preview.user.username,preservedOrders:orders.length}}});
  return {ok:true,deleted:true};
 });
}
