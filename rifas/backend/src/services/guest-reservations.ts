import type { PrismaClient } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
import { expireOrders } from './orders.js';
export const GUEST_HOLD_MS = 10 * 60000;
export class GuestReservationsService {
  constructor(private db: PrismaClient) {}
  async current(tokenHash: string) {
    return atomic(this.db, async tx => {
      await expireOrders(tx);
      return tx.order.findFirst({ where: { guestTokenHash: tokenHash, userId: null, status: 'RESERVED' }, select: { id: true, raffleId: true, numbers: true, expiresAt: true } });
    });
  }
  reserve(tokenHash: string, clientHash: string, raffleId: string, numbers: number[]) {
    return atomic(this.db, async tx => {
      await expireOrders(tx);
      const existing = await tx.order.findUnique({ where: { guestTokenHash: tokenHash } });
      if (existing?.userId) throw new AppError(409, 'La reserva anterior ya está asociada a una cuenta. Actualizá la página.');
      if (existing?.status === 'RESERVED' && existing.raffleId === raffleId && existing.numbers.length === numbers.length && existing.numbers.every(n => numbers.includes(n))) return existing;
      const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
      if (!raffle) throw new AppError(404, 'Rifa no encontrada.');
      if (raffle.status !== 'ACTIVE') throw new AppError(409, 'Esta rifa no admite nuevas reservas.');
      if (numbers.some(n => n > raffle.totalTickets)) throw new AppError(400, 'Hay números fuera del rango de esta rifa.');
      const held = await tx.allocation.count({ where: { order: { userId: null, guestClientHash: clientHash, status: 'RESERVED', ...(existing ? { id: { not: existing.id } } : {}) } } });
      if (held + numbers.length > 20) throw new AppError(429, 'Hay demasiados números pendientes de iniciar sesión desde esta conexión. Ingresá para continuar.');
      if (await tx.allocation.count({ where: { raffleId, number: { in: numbers }, ...(existing ? { orderId: { not: existing.id } } : {}) } })) throw new AppError(409, 'Uno de esos números acaba de reservarse. Elegí otro.');
      const expiresAt = existing?.status === 'RESERVED' ? existing.expiresAt : new Date(Date.now() + GUEST_HOLD_MS);
      if (existing) {
        await tx.allocation.deleteMany({ where: { orderId: existing.id } });
        await tx.order.update({ where: { id: existing.id }, data: { guestTokenHash: null, ...(existing.status === 'RESERVED' ? { status: 'CANCELLED' } : {}) } });
      }
      const order = await tx.order.create({ data: { guestTokenHash: tokenHash, guestClientHash: clientHash, raffleId, numbers: [...numbers].sort((a,b) => a-b), unitPriceCents: raffle.ticketPriceCents, amountCents: raffle.ticketPriceCents * numbers.length, expiresAt, allocations: { create: numbers.map(number => ({ raffleId, number })) } } });
      await tx.auditLog.create({ data: { action: 'GUEST_RESERVED', entityId: order.id } });
      return order;
    });
  }
  claim(tokenHash: string, userId: string) {
    return atomic(this.db, async tx => {
      await expireOrders(tx);
      const order = await tx.order.findUnique({ where: { guestTokenHash: tokenHash }, include: { raffle: true, allocations: true } });
      if (!order) return null;
      if (order.userId === userId) return { id: order.id, raffleId: order.raffleId, numbers: order.numbers };
      if (order.userId) throw new AppError(403, 'Esta reserva ya pertenece a otra cuenta.');
      if (order.status !== 'RESERVED' || order.expiresAt <= new Date() || order.allocations.length !== order.numbers.length) throw new AppError(409, 'La reserva temporal venció. Ingresaste correctamente; volvé a la rifa para consultar la disponibilidad.');
      if (order.raffle.status !== 'ACTIVE') throw new AppError(409, 'La rifa ya no admite continuar esta reserva.');
      const held = await tx.allocation.count({ where: { order: { userId, status: { not: 'PAID' } } } });
      if (held + order.numbers.length > 20) throw new AppError(409, 'Tu cuenta ya tiene reservas pendientes. Revisalas en Mis números para continuar.');
      const updated = await tx.order.update({ where: { id: order.id }, data: { userId, guestClientHash: null, expiresAt: new Date(Date.now() + 5 * 60000) } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'GUEST_RESERVATION_CLAIMED', entityId: order.id } });
      return { id: updated.id, raffleId: updated.raffleId, numbers: updated.numbers };
    });
  }
  cancel(tokenHash: string) {
    return atomic(this.db, async tx => {
      const order = await tx.order.findUnique({ where: { guestTokenHash: tokenHash } });
      if (!order || order.userId || order.status !== 'RESERVED') return;
      await tx.allocation.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', guestTokenHash: null } });
    });
  }
}
