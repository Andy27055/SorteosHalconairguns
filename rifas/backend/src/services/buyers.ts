import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { queueOrderEmail } from './purchase-emails.js';
import { releaseRefundNumbers } from './refund-state.js';
export interface BuyerPurchase {id:string;numbers:number[];amountCents:number;method:string|null;paidAt:string|null;updatedAt:string}
export interface Buyer { email: string; lastName: string; firstName: string; dni: string; numbers: number[]; amountCents: number; incomplete: boolean; emailStatuses: string[];id?:string;version?:string;orders?:BuyerPurchase[] }
const buyerInclude={user:{select:{id:true,email:true,firstName:true,lastName:true,dni:true}},emails:{where:{kind:'PURCHASE_CONFIRMED'},select:{status:true}}} as const;
type BuyerRecord=Prisma.OrderGetPayload<{include:typeof buyerInclude}>;
function groupBuyers(orders:BuyerRecord[]){
  const grouped=new Map<string,Buyer&{id:string;version:string;orders:BuyerPurchase[]}>();
  for(const order of orders){
    const identity={email:order.buyerEmail??order.user?.email??'',lastName:order.buyerLastName??order.user?.lastName??'',firstName:order.buyerFirstName??order.user?.firstName??'',dni:order.buyerDni??order.user?.dni??''};
    const key=JSON.stringify([order.userId,identity]);const purchase={id:order.id,numbers:order.numbers,amountCents:order.amountCents,method:order.method,paidAt:order.paidAt?.toISOString()||null,updatedAt:order.updatedAt.toISOString()};const existing=grouped.get(key);
    if(existing){existing.numbers=[...new Set([...existing.numbers,...order.numbers])].sort((a,b)=>a-b);existing.amountCents+=order.amountCents;existing.orders.push(purchase);existing.emailStatuses.push(order.emails[0]?.status||'NOT_QUEUED');}
    else grouped.set(key,{...identity,id:order.id,version:'',numbers:[...order.numbers].sort((a,b)=>a-b),amountCents:order.amountCents,incomplete:Object.values(identity).some(v=>!v),emailStatuses:[order.emails[0]?.status||'NOT_QUEUED'],orders:[purchase]});
  }
  return [...grouped.values()].map(b=>({...b,version:createHash('sha256').update(JSON.stringify([b.email,b.firstName,b.lastName,b.dni,b.orders])).digest('hex')})).sort((a,b)=>a.lastName.localeCompare(b.lastName,'es')||a.firstName.localeCompare(b.firstName,'es'));
}
export class BuyersService {
  constructor(private db: PrismaClient) {}
  async list(raffleId: string) {
    const raffle = await this.db.raffle.findUniqueOrThrow({ where: { id: raffleId }, select: { id: true, title: true } });
    const orders = await this.db.order.findMany({ where: { raffleId, status: 'PAID', userId: { not: null } }, include:buyerInclude, orderBy: [{ paidAt: 'asc' }, { id: 'asc' }] });
    const buyers=groupBuyers(orders);
    return { raffle, buyers, soldNumbers: buyers.reduce((sum,b) => sum+b.numbers.length,0) };
  }
  async remove(actorId:string,raffleId:string,anchorOrderId:string,version:string){
    return atomic(this.db,async tx=>{
      const anchor=await tx.order.findUniqueOrThrow({where:{id:anchorOrderId}});
      if(anchor.raffleId!==raffleId||anchor.status!=='PAID'||!anchor.userId)throw new AppError(409,'La compra ya no figura entre los compradores confirmados. Actualizá el listado.');
      const current=await tx.order.findMany({where:{raffleId,userId:anchor.userId,status:'PAID'},include:buyerInclude,orderBy:[{paidAt:'asc'},{id:'asc'}]});
      const buyer=groupBuyers(current).find(b=>b.orders.some(o=>o.id===anchorOrderId));
      if(!buyer||buyer.version!==version)throw new AppError(409,'Las compras del comprador cambiaron. Cerrá la ventana y actualizá el listado antes de confirmar.');
      const now=new Date();
      for(const order of buyer.orders){
        await releaseRefundNumbers(tx,order.id);
        await tx.order.update({where:{id:order.id},data:{status:'REFUND_PENDING',refundRequestedAt:now,refundAmountCents:order.amountCents,reviewedBy:actorId,decisionNote:'Baja solicitada por administración. Reembolso en gestión en un plazo estimado de 24 a 72 horas hábiles.'}});
        await tx.purchaseEmail.updateMany({where:{orderId:order.id,kind:'PURCHASE_CONFIRMED',status:{in:['PENDING','FAILED']}},data:{status:'SKIPPED',lastErrorCode:'ORDER_REMOVED'}});
        await queueOrderEmail(tx,order.id,'REFUND_REQUESTED');
      }
      await tx.auditLog.create({data:{actorId,action:'BUYER_REMOVED_REFUND_REQUESTED',entityId:raffleId,detail:{orderIds:buyer.orders.map(o=>o.id),numbers:buyer.numbers,amountCents:buyer.amountCents}}});
      return{ok:true,orders:buyer.orders.length};
    });
  }
  async pendingRefunds(raffleId:string){
    const orders=await this.db.order.findMany({where:{raffleId,refundRequestedAt:{not:null},refundCompletedAt:null},include:{user:{select:{email:true,firstName:true,lastName:true,dni:true}}},orderBy:{refundRequestedAt:'asc'}});
    return orders.map(o=>({id:o.id,email:o.buyerEmail||o.user?.email||'',firstName:o.buyerFirstName||o.user?.firstName||'',lastName:o.buyerLastName||o.user?.lastName||'',dni:o.buyerDni||o.user?.dni||'',numbers:o.numbers,amountCents:o.amountCents,refundAmountCents:o.refundAmountCents,requestedAt:o.refundRequestedAt,reason:o.decisionNote,reasonCode:o.rejectionReasonCode}));
  }
  async completeRefund(actorId:string,orderId:string,reference:string,amountCents:number){
    return atomic(this.db,async tx=>{
      const order=await tx.order.findUniqueOrThrow({where:{id:orderId}});
      if(!order.refundRequestedAt||order.refundCompletedAt||!['REFUND_PENDING','REJECTED'].includes(order.status))throw new AppError(409,'Esta compra no tiene un reembolso pendiente.');
      if(order.refundAmountCents&&amountCents!==order.refundAmountCents)throw new AppError(400,'El importe debe coincidir con el reembolso pendiente.');
      await releaseRefundNumbers(tx,orderId);
      await tx.order.update({where:{id:orderId},data:{status:'REFUNDED',refundCompletedAt:new Date(),refundReference:reference,refundAmountCents:amountCents,reviewedBy:actorId,decisionNote:`Reembolso realizado. Referencia: ${reference}.`}});
      await queueOrderEmail(tx,orderId,'REFUND_COMPLETED');
      await tx.auditLog.create({data:{actorId,action:'REFUND_COMPLETED_MANUALLY',entityId:orderId,detail:{reference,amountCents}}});return{ok:true};
    });
  }
}
export async function buyersWorkbook(title: string, buyers: Buyer[]) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'Halcón Airguns'; workbook.title = title;
  const sheet = workbook.addWorksheet('Compradores', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [{ header: 'Email', key: 'email', width: 36 }, { header: 'Apellido', key: 'lastName', width: 25 }, { header: 'Nombre', key: 'firstName', width: 25 }, { header: 'DNI', key: 'dni', width: 16 }, { header: 'Números comprados', key: 'numbers', width: 55 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF15140F' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCDA34B' } };
  for (const buyer of buyers) {
    let chunk: string[] = []; let length = 0;
    const add = () => { sheet.addRow({ email: buyer.email, lastName: buyer.lastName, firstName: buyer.firstName, dni: buyer.dni, numbers: chunk.join(', ') }); chunk = []; length = 0; };
    for (const number of buyer.numbers) {
      const value = String(number).padStart(3, '0');
      if (length + value.length + 2 > 30000) add();
      chunk.push(value); length += value.length + 2;
    }
    if (chunk.length) add();
  }
  for (const column of sheet.columns) column.numFmt = '@';
  sheet.autoFilter = { from: 'A1', to: `E${Math.max(1, sheet.rowCount)}` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
