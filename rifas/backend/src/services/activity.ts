import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
export async function recordActivity(tx:Pick<Prisma.TransactionClient,'user'|'auditLog'>,input:{data:Prisma.AuditLogCreateInput}){
  const {data}=input;
  const actorRole=data.actorRole??(data.actorId?(await tx.user.findUnique({where:{id:data.actorId},select:{role:true}}))?.role:null);
  return tx.auditLog.create({data:{...data,actorRole}});
}
const labels:Record<string,string>={
 RAFFLE_CANCELLED:'Canceló y eliminó una rifa de la venta',RAFFLE_CLOSE_REQUESTED:'Finalizó la venta de números y solicitó el resultado oficial',RAFFLE_AUTOMATIC_CLOSE_REQUESTED:'Se cerraron las ventas en la fecha prevista',RAFFLE_RESULT_CONFIRMED:'Se confirmó el ganador con el resultado oficial',ORDER_CANCELLED_AT_RAFFLE_CLOSE:'Se canceló la reserva sin pago al cerrar las ventas',
 ADMIN_IDENTITY_REPLACED:'Reemplazó la cuenta personal por la administración principal de Halcón',
 ACCOUNT_CREATED:'Creó una cuenta',AUTH_LOGIN:'Inició sesión',AUTH_LOGOUT:'Cerró sesión',PROFILE_UPDATED:'Actualizó los datos del perfil',PASSWORD_CHANGED:'Cambió la contraseña',EMAIL_VERIFIED:'Verificó su correo electrónico',EMAIL_VERIFICATION_REQUESTED:'Solicitó verificar el correo',
 ORDER_RESERVED:'Reservó números',ORDER_CANCELLED:'Canceló una reserva',TRANSFER_STARTED:'Eligió pagar por transferencia',RECEIPT_UPLOADED:'Subió un comprobante',GUEST_RESERVATION_CLAIMED:'Asoció su reserva a su cuenta',
 TRANSFER_APPROVED:'Aprobó un pago por transferencia',TRANSFER_REJECTED:'Rechazó un pago por transferencia',RAFFLE_CREATED:'Creó una rifa',RAFFLE_UPDATED:'Modificó una rifa',RAFFLE_DELETED:'Eliminó una rifa',RAFFLE_FINISHED:'Finalizó una rifa con el resultado de la Nocturna bonaerense',RAFFLE_DRAWN:'Realizó un sorteo (registro histórico)',
 PRIZE_CREATED:'Creó un premio',PRIZE_UPDATED:'Modificó un premio',PRIZE_DELETED:'Eliminó un premio',USER_ACCESS_UPDATED:'Cambió los permisos o el acceso de una cuenta',USER_DEACTIVATED:'Desactivó una cuenta',ADMIN_ACCOUNT_PROVISIONED:'Creó o habilitó una cuenta administradora',
 BUYER_REMOVED_REFUND_REQUESTED:'Dio de baja una compra e inició su reembolso',REFUND_COMPLETED_MANUALLY:'Registró un reembolso realizado',EXTERNAL_REFUND_RECORDED:'Registró una devolución externa',PAYMENT_ASSIGNED_MANUALLY:'Confirmó y asignó un pago manualmente',MP_PAYMENT_UPDATED:'Se actualizó el estado del pago en Mercado Pago',MP_CHECKOUT_CREATED:'Creó un enlace de Mercado Pago',RECEIPT_FILE_PURGED:'Se eliminó un comprobante vencido',
 BUYERS_EXPORTED:'Descargó el listado de compradores en Excel',EMAIL_RETRY_REQUESTED:'Reintentó enviar un correo',MP_PREFERENCE_CREATED:'Eligió pagar con Mercado Pago',MP_CHECKOUT_STARTED:'Inició un pago con Mercado Pago',
 ORDER_EXPIRED:'Venció el plazo de la reserva y se liberaron los números',GUEST_RESERVED:'Se reservaron los números antes de iniciar sesión',PAYMENT_NEEDS_ATTENTION:'El pago requiere una revisión manual',DUPLICATE_PAYMENT:'Se detectó un segundo pago para la compra',PAYMENT_IGNORED_AFTER_REFUND_REQUEST:'Se recibió una actualización de pago después de iniciar el reembolso',PAYMENT_STATUS_CHECKED:'Consultó el estado del pago',RECEIPT_CLEANUP_REQUESTED:'Ejecutó la limpieza de comprobantes vencidos',
};
export function activityLabel(action:string){return labels[action]||'Registró una actualización';}
export async function activity(db:PrismaClient,userId?:string,page=1){
  const users=await db.user.findMany({select:{id:true,fullName:true,username:true,role:true}});
  const map=new Map(users.map(u=>[u.id,u]));
  const orderIds=userId?(await db.order.findMany({where:{userId},select:{id:true}})).map(o=>o.id):[];
  const adminIds=users.filter(u=>u.role==='ADMIN').map(u=>u.id);
  const where=userId?{OR:[{actorId:userId},{entityId:userId},{entityId:{in:orderIds}},...orderIds.map(id=>({detail:{path:['orderIds'],array_contains:[id]}}))]}:{OR:[{actorRole:'ADMIN' as const},{actorRole:null,actorId:{in:adminIds}}]};
  // Limit in SQL; never expose the raw audit detail (which can contain private data).
  const rows=await db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50});
  const orders=await db.order.findMany({where:{id:{in:rows.map(r=>r.entityId)}},select:{id:true,raffle:{select:{title:true}},numbers:true}});
  const raffles=await db.raffle.findMany({where:{id:{in:rows.map(r=>r.entityId)}},select:{id:true,title:true}});
  return {items:rows.map(row=>{const actor=row.actorId?map.get(row.actorId):null;const order=orders.find(o=>o.id===row.entityId);const raffle=raffles.find(r=>r.id===row.entityId);const target=map.get(row.entityId);const name=row.detail&&typeof row.detail==='object'&&!Array.isArray(row.detail)&&typeof row.detail.name==='string'?row.detail.name:'';return {id:row.id,actor:actor?.fullName||actor?.username||'Sistema',description:activityLabel(row.action),context:order?`${order.raffle.title} · Números ${order.numbers.map(n=>String(n).padStart(2,'0')).join(', ')}`:raffle?.title||target?.fullName||name,createdAt:row.createdAt};}),page,total:await db.auditLog.count({where})};
}
