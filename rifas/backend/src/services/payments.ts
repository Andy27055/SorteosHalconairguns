import { recordActivity } from './activity.js';
import {queueRaffleBuyerEmails} from './raffle-emails.js';
import { buyerSnapshot } from './buyer-identity.js';
import { queuePurchaseEmail,queueOrderEmail } from './purchase-emails.js';
import { releaseRefundNumbers } from './refund-state.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { atomic } from '../db.js';
import { expireOrders } from './orders.js';
export interface MpPayment { id: string | number; status: string; external_reference?: string; currency_id?: string; transaction_amount?: number; live_mode?: boolean; collector_id?: number; }
export interface Preference { id: string; init_point: string; sandbox_init_point?: string; }
export interface PaymentGateway {
  createPreference(body: unknown, key: string): Promise<Preference>;
  findPreference(orderId: string): Promise<Preference | null>;
  getPayment(id: string): Promise<MpPayment>;
  findPayments(orderId: string): Promise<MpPayment[]>;
}
export class MercadoPagoGateway implements PaymentGateway {
  constructor(private token: string) {}
  private async request<T>(route: string, body?: unknown, key?: string): Promise<T> {
    let response: globalThis.Response;
    try { response = await fetch(`https://api.mercadopago.com${route}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(key ? { 'X-Idempotency-Key': key } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) }); }
    catch { throw new AppError(502, 'Mercado Pago no respondió. Tu operación quedó registrada; podés volver a consultar su estado.'); }
    if (!response.ok) throw new AppError(502, 'No pudimos completar la consulta con Mercado Pago. Volvé a intentar desde tu compra.');
    return response.json() as Promise<T>;
  }
  createPreference(body: unknown, key: string) { return this.request<Preference>('/checkout/preferences', body, key); }
  async findPreference(id: string) {
    const data = await this.request<{ elements?: Preference[]; results?: Preference[] }>(`/checkout/preferences/search?external_reference=${encodeURIComponent(id)}`);
    const found = (data.elements || data.results || [])[0];
    return found ? this.request<Preference>(`/checkout/preferences/${encodeURIComponent(found.id)}`) : null;
  }
  getPayment(id: string) { return this.request<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`); }
  async findPayments(id: string) {
    const data = await this.request<{ results: MpPayment[] }>(`/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc&limit=20`);
    return data.results || [];
  }
}
export function validWebhook(signature: string, requestId: string, dataId: string, secret: string) {
  if (!secret || !requestId || !dataId) return false;
  const parts = Object.fromEntries(signature.split(',').map(v => v.trim().split('=')));
  if (!/^\d+$/.test(parts.ts || '') || !/^[0-9a-f]{64}$/i.test(parts.v1 || '')) return false;
  const expected = createHmac('sha256', secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}
export class PaymentsService {
  constructor(private db: PrismaClient, private cfg: AppConfig, private gateway: PaymentGateway) {}
  async checkout(userId: string, id: string) {
    if (!this.cfg.mpToken || !this.cfg.mpWebhookSecret || !this.cfg.apiUrl.startsWith('https://')) throw new AppError(503, 'Mercado Pago todavía no está configurado. Podés usar transferencia si está habilitada.');
    const claim = await atomic(this.db, async tx => {
      await expireOrders(tx);
      const order = await tx.order.findUnique({ where: { id }, include: { raffle: true } });
      if (!order) throw new AppError(404, 'Compra no encontrada.');
      if (order.userId !== userId) throw new AppError(403, 'No es tu compra.');
      if (order.checkoutUrl && order.status === 'PAYMENT_PENDING') return { order, ready: true, recover: false };
      if (!['RESERVED', 'PAYMENT_PENDING'].includes(order.status) || order.method === 'TRANSFER' || order.raffle.status !== 'ACTIVE') throw new AppError(409, 'Esta compra no admite iniciar un pago.');
      if (order.paymentCreatingAt && Date.now() - order.paymentCreatingAt.getTime() < 30000) throw new AppError(409, 'El enlace se está preparando. Esperá unos segundos y volvé a consultar.');
      const identity = order.buyerEmail && order.buyerFirstName && order.buyerLastName && order.buyerDni ? {} : await buyerSnapshot(tx, order.userId);
      await tx.order.update({ where: { id }, data: { ...identity, method: 'MERCADO_PAGO', status: 'PAYMENT_PENDING', paymentCreatingAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60000) } });
      return { order, ready: false, recover: !!order.paymentCreatingAt };
    });
    if (claim.ready) return { checkoutUrl: claim.order.checkoutUrl };
    let pref = claim.recover ? await this.gateway.findPreference(id) : null;
    if (!pref) pref = await this.gateway.createPreference({
      items: claim.order.numbers.map(number => ({ id: `${id}-${number}`, title: `${claim.order.raffle.title} · Número ${number}`, quantity: 1, unit_price: claim.order.unitPriceCents / 100, currency_id: 'ARS' })),
      external_reference: id,
      back_urls: { success: `${this.cfg.frontendUrl}/compras/${id}/resultado`, failure: `${this.cfg.frontendUrl}/compras/${id}/resultado`, pending: `${this.cfg.frontendUrl}/compras/${id}/resultado` },
      notification_url: `${this.cfg.apiUrl}/api/payments/webhook`, auto_return: 'approved',
      expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: new Date(Date.now() + 30 * 60000).toISOString(),
    }, id);
    const checkoutUrl = this.cfg.mpSandbox ? pref.sandbox_init_point : pref.init_point;
    if (!checkoutUrl || !/^https:\/\/(?:[a-z0-9-]+\.)*mercadopago\.(?:com|com\.ar)\//i.test(checkoutUrl)) throw new AppError(502, 'Mercado Pago no devolvió un enlace válido para el entorno configurado.');
    await atomic(this.db, async tx => {
      const current = await tx.order.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'PAYMENT_PENDING') throw new AppError(409, 'La compra cambió de estado mientras se generaba el enlace. Revisá su estado antes de pagar.');
      await tx.order.update({ where: { id }, data: { preferenceId: pref!.id, checkoutUrl, paymentCreatingAt: null } });
      await recordActivity(tx,{ data: { actorId: userId, action: 'MP_PREFERENCE_CREATED', entityId: id } });
    });
    return { checkoutUrl };
  }
  async apply(payment: MpPayment) {
    if (!payment.external_reference) return;
    return atomic(this.db, async tx => {
      const order = await tx.order.findFirst({ where: { OR: [{ id: payment.external_reference! }, { legacyReference: payment.external_reference! }] } });
      if (!order) return;
      if((order.refundRequestedAt||order.status==='REFUND_PENDING'||order.status==='REFUNDED')&&(!['refunded','charged_back'].includes(payment.status)||order.method!=='MERCADO_PAGO'||order.paymentId!==String(payment.id))){
        await recordActivity(tx,{data:{action:'PAYMENT_IGNORED_AFTER_REFUND_REQUEST',entityId:order.id,detail:{paymentId:String(payment.id),status:payment.status}}});return;
      }
      const markAttention = async (reason: string) => {
        await tx.order.update({ where: { id: order.id }, data: { status: 'NEEDS_ATTENTION', paymentId: String(payment.id), paymentStatus: payment.status, decisionNote: reason } });
        await recordActivity(tx,{ data: { action: 'PAYMENT_NEEDS_ATTENTION', entityId: order.id, detail: { reason, paymentId: String(payment.id) } } });
      };
      if (order.paymentId && order.paymentId !== String(payment.id) && ['PAID','REFUND_PENDING','REFUNDED'].includes(order.status)) {
        await recordActivity(tx,{ data: { action: 'DUPLICATE_PAYMENT', entityId: order.id, detail: { paymentId: String(payment.id) } } }); return;
      }
      if (order.method !== 'MERCADO_PAGO' || payment.currency_id !== 'ARS' || Math.round(Number(payment.transaction_amount) * 100) !== order.amountCents || payment.live_mode !== !this.cfg.mpSandbox) {
        await markAttention('El pago no coincide con medio, importe, moneda o entorno de la compra. Requiere conciliación.'); return;
      }
      if (payment.status === 'approved') {
        if (order.status === 'PAID' && order.paymentId === String(payment.id)) return;
        const raffle=await tx.raffle.findUniqueOrThrow({where:{id:order.raffleId}});
        if(raffle.status==='CANCELLED'){
          await tx.order.update({where:{id:order.id},data:{status:'REFUND_PENDING',paidAt:new Date(),paymentId:String(payment.id),paymentStatus:payment.status,refundRequestedAt:new Date(),refundAmountCents:order.amountCents,decisionNote:'El pago ingresó después de cancelar la rifa. Reembolso pendiente.'}});
          await tx.allocation.deleteMany({where:{orderId:order.id}});
          await queueRaffleBuyerEmails(tx,order.raffleId,'RAFFLE_CANCELLED',[order.id]);return;
        }
        if(raffle.status==='FINISHED'){await markAttention('El pago ingresó después de publicar el resultado. Revisar su devolución.');return;}
        const allocations = await tx.allocation.findMany({ where: { raffleId: order.raffleId, number: { in: order.numbers } } });
        if (allocations.length !== order.numbers.length || allocations.some(a => a.orderId !== order.id)) {
          await markAttention('Pago aprobado después de perder la reserva. Requiere asignación o devolución manual.'); return;
        }
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(), paymentId: String(payment.id), paymentStatus: payment.status, decisionNote: null } });
        await queuePurchaseEmail(tx, order.id);
        if(raffle.closedEarly&&raffle.status==='CLOSING')await queueRaffleBuyerEmails(tx,order.raffleId,'RAFFLE_EARLY_CLOSURE');
      } else if (['refunded','charged_back'].includes(payment.status)) {
        await releaseRefundNumbers(tx,order.id);
        await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED', paymentId: String(payment.id), paymentStatus: payment.status,refundRequestedAt:order.refundRequestedAt||new Date(),refundCompletedAt:order.refundCompletedAt||new Date(),refundAmountCents:order.amountCents,refundReference:`Mercado Pago ${payment.id}`,decisionNote:'El proveedor registró la devolución o contracargo de esta compra.' } });
        await queueOrderEmail(tx,order.id,'REFUND_COMPLETED');
      } else if (['rejected','cancelled'].includes(payment.status) && order.status === 'PAID') {
        return;
      } else if (['rejected','cancelled'].includes(payment.status)) {
        await tx.allocation.deleteMany({ where: { orderId: order.id } });
        await tx.order.update({ where: { id: order.id }, data: { status: 'REJECTED', paymentId: String(payment.id), paymentStatus: payment.status } });
        await queueOrderEmail(tx,order.id,'PURCHASE_REJECTED');
      } else {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: payment.status } });
      }
      await recordActivity(tx,{ data: { action: 'MP_PAYMENT_UPDATED', entityId: order.id, detail: { paymentId: String(payment.id), status: payment.status } } });
    });
  }
  async reconcile(id: string) {
    const order = await this.db.order.findUniqueOrThrow({ where: { id } });
    const payments = await this.gateway.findPayments(order.legacyReference || id);
    const approved = payments.filter(p => p.status === 'approved');
    // Un intento rechazado no debe liberar los números de otro intento acreditado.
    for (const payment of approved.length ? approved : payments) await this.apply(payment);
  }
  async webhook(id: string) { await this.apply(await this.gateway.getPayment(id)); }
}
