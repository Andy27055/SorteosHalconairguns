import { recordActivity } from './activity.js';
import { buyerSnapshot } from './buyer-identity.js';
import type { TransferAccount } from './transfer-accounts.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { reserveInOrder } from './reservation-queue.js';
export const expirable = ['RESERVED', 'PAYMENT_PENDING', 'AWAITING_RECEIPT'] as const;
export function salesClosed(drawAt:Date|null,now=new Date()){
  if(!drawAt)return false;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(drawAt);
  return now.getTime()>=Math.min(drawAt.getTime(),new Date(`${day}T21:00:00-03:00`).getTime());
}
export async function expireOrders(tx: Prisma.TransactionClient, now = new Date()) {
  const expired = await tx.order.findMany({ where: { status: { in: [...expirable] }, expiresAt: { lt: now } }, select: { id: true } });
  if (!expired.length) return;
  const ids = expired.map(o => o.id);
  await tx.allocation.deleteMany({ where: { orderId: { in: ids } } });
  await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: 'EXPIRED' } });
  await tx.auditLog.createMany({data:ids.map(entityId=>({action:'ORDER_EXPIRED',entityId}))});
}
export class OrdersService {
  constructor(private db: PrismaClient) {}
  reserve(userId: string, raffleId: string, numbers: number[]) {
    return reserveInOrder(this.db, raffleId, () => atomic(this.db, async tx => {
      await expireOrders(tx);
      const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
      if (!raffle) throw new AppError(404, 'Rifa no encontrada.');
      if (raffle.status !== 'ACTIVE') throw new AppError(409, 'Esta rifa no admite reservas.');
      if(salesClosed(raffle.drawAt))throw new AppError(409,'La venta de números ya cerró para la Nocturna prevista.');
      if (numbers.some(n => !Number.isInteger(n)||n < raffle.numberStart || n >= raffle.numberStart + raffle.totalTickets)) throw new AppError(400, 'Hay números fuera del rango de la rifa.');
      const held = await tx.allocation.count({ where: { order: { userId, status: { in: ['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION'] } } } });
      if (held + numbers.length > 20) throw new AppError(409, 'Podés mantener hasta 20 números pendientes a la vez.');
      if (await tx.allocation.count({ where: { raffleId, number: { in: numbers } } })) throw new AppError(409, 'Uno de esos números acaba de reservarse. Elegí otro.');
      const order = await tx.order.create({ data: {
        userId, raffleId, numbers: [...numbers].sort((a,b) => a-b), unitPriceCents: raffle.ticketPriceCents,
        amountCents: raffle.ticketPriceCents * numbers.length, expiresAt: new Date(Date.now() + 5 * 60000),
        allocations: { create: numbers.map(number => ({ raffleId, number })) },
      } });
      await recordActivity(tx,{ data: { actorId: userId, action: 'ORDER_RESERVED', entityId: order.id } });
      return order;
    }));
  }
  cancel(userId: string, id: string) {
    return atomic(this.db, async tx => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new AppError(404, 'Compra no encontrada.');
      if (order.userId !== userId) throw new AppError(403, 'No es tu reserva.');
      if (!['RESERVED', 'AWAITING_RECEIPT'].includes(order.status) || order.preferenceId || order.paymentCreatingAt) throw new AppError(409, 'La operación tiene un pago o revisión en curso y no puede liberarse desde aquí.');
      await tx.allocation.deleteMany({ where: { orderId: id } });
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
      await recordActivity(tx,{ data: { actorId: userId, action: 'ORDER_CANCELLED', entityId: id } });
      return { ok: true };
    });
  }
  startTransfer(userId: string, id: string, account?: TransferAccount) {
    return atomic(this.db, async tx => {
      await expireOrders(tx);
      const order = await tx.order.findUnique({ where: { id }, include: { raffle: true } });
      if (!order) throw new AppError(404, 'Compra no encontrada.');
      if (order.userId !== userId) throw new AppError(403, 'No es tu compra.');
      if (order.method === 'TRANSFER' && ['AWAITING_RECEIPT', 'UNDER_REVIEW', 'PAID'].includes(order.status)) {
        if (account && order.transferAccountId && account.id !== order.transferAccountId) throw new AppError(409, 'Esta compra ya tiene una cuenta de destino confirmada. Usá los datos que figuran en la compra.');
        return order;
      }
      if (order.status !== 'RESERVED' || order.preferenceId || order.paymentCreatingAt || order.raffle.status !== 'ACTIVE') throw new AppError(409, 'Esta reserva ya no admite cambiar el medio de pago.');
      const updated = await tx.order.update({ where: { id }, data: { ...await buyerSnapshot(tx, order.userId), ...(account ? { transferAccountId: account.id, transferHolder: account.holder, transferAlias: account.alias, transferCbu: account.cbu } : {}), method: 'TRANSFER', status: 'AWAITING_RECEIPT', expiresAt: new Date(Date.now() + 24 * 3600000) } });
      await recordActivity(tx,{ data: { actorId: userId, action: 'TRANSFER_STARTED', entityId: id, detail: { accountId: account?.id || null } } });
      return updated;
    });
  }
}
