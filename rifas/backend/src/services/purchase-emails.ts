import nodemailer from 'nodemailer';
import { z } from 'zod';
import type { Prisma, PrismaClient, OrderEmailKind } from '../generated/prisma/client.js';
import type { AppConfig } from '../config.js';

const payloadSchema = z.object({ name: z.string(), raffle: z.string(), prize: z.string(), numbers: z.array(z.number().int()), amountCents: z.number().int(), paidAt: z.string(), orderId: z.string(),note:z.string().optional(),reasonCode:z.string().nullable().optional(),refundAmountCents:z.number().int().nullable().optional() });
export async function queueOrderEmail(tx: Prisma.TransactionClient, orderId: string, kind: OrderEmailKind) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { raffle: { include: { prize: true } }, user: true } });
  if (kind==='PURCHASE_CONFIRMED'&&order.status !== 'PAID') return;
  const email = order.buyerEmail || order.user?.email || '';
  const valid = z.email().safeParse(email).success && !email.endsWith('.invalid');
  await tx.purchaseEmail.upsert({ where: { eventKey:`${kind}:${orderId}` }, update: {}, create: {
    orderId,kind,eventKey:`${kind}:${orderId}`, toEmail: email, status: valid ? 'PENDING' : 'SKIPPED', lastErrorCode: valid ? null : 'MISSING_RECIPIENT',
    payload: { name: [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ') || order.user?.fullName || 'Participante', raffle: order.raffle.title, prize: order.raffle.prize.name, numbers: order.numbers, amountCents: order.amountCents, paidAt: (order.paidAt || new Date()).toISOString(), orderId,note:order.decisionNote||'',reasonCode:order.rejectionReasonCode,refundAmountCents:order.refundAmountCents },
  } });
}
export async function queuePurchaseEmail(tx: Prisma.TransactionClient, orderId: string){return queueOrderEmail(tx,orderId,'PURCHASE_CONFIRMED');}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function purchaseMessage(payload: unknown, frontendUrl: string) {
  const p = payloadSchema.parse(payload);
  const numbers = p.numbers.map(n => String(n).padStart(3, '0')).join(', ');
  const amount = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.amountCents / 100);
  const url = `${frontendUrl}/compras/${encodeURIComponent(p.orderId)}`;
  return {
    subject: `Compra confirmada · ${p.raffle.replace(/[\r\n]/g, ' ')}`,
    text: `Hola ${p.name}:\n\nTu compra en Halcón Airguns está confirmada.\n\nRifa: ${p.raffle}\nPremio: ${p.prize}\nNúmeros: ${numbers}\nTotal acreditado: ${amount}\nReferencia: ${p.orderId}\n\nPodés ver tu compra en ${url}\n\n¡Gracias por participar!\nHalcón Airguns`,
    html: `<div style="font-family:Arial,sans-serif;color:#252219;max-width:620px;margin:auto"><div style="background:#14130f;color:#e1bd67;padding:24px;font-weight:bold">HALCÓN AIRGUNS</div><div style="padding:24px"><h1 style="font-size:24px">Tu compra está confirmada</h1><p>Hola ${escape(p.name)}, tus números ya están participando.</p><p><b>Rifa:</b> ${escape(p.raffle)}<br><b>Premio:</b> ${escape(p.prize)}<br><b>Números:</b> ${escape(numbers)}<br><b>Total acreditado:</b> ${escape(amount)}<br><b>Referencia:</b> ${escape(p.orderId)}</p><p><a href="${escape(url)}" style="background:#cda34b;color:#14130f;padding:12px 18px;display:inline-block;text-decoration:none">Ver mi compra</a></p><p>¡Gracias por compartir nuestra pasión!</p></div></div>`,
  };
}
export function notificationMessage(kind:OrderEmailKind,payload:unknown,frontendUrl:string){
  if(kind==='PURCHASE_CONFIRMED')return purchaseMessage(payload,frontendUrl);
  const p=payloadSchema.parse(payload);const numbers=p.numbers.map(n=>String(n).padStart(3,'0')).join(', ');
  const amount=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(p.amountCents/100);
  const title=kind==='PURCHASE_REJECTED'?'Tu compra fue rechazada':kind==='REFUND_REQUESTED'?'Baja confirmada y reembolso en gestión':'Reembolso registrado';
  let explanation=kind==='PURCHASE_REJECTED'?`Motivo del rechazo: ${p.note||'El pago no fue aprobado.'}`:kind==='REFUND_REQUESTED'?'Confirmamos la baja de tu compra. El reembolso por el medio de pago original se gestionará en un plazo estimado de 24 a 72 horas hábiles.':'El administrador o el proveedor registró la realización del reembolso por el medio de pago original. La acreditación puede depender de tu entidad bancaria.';
  if(kind==='PURCHASE_REJECTED'&&p.reasonCode==='INCORRECT_AMOUNT'&&!/24\s*(?:a|-|\u2013)\s*48/.test(p.note||''))explanation+='\nEl reembolso del importe efectivamente acreditado se gestionará en un plazo de 24 a 48 horas.';
  const refundAmount=p.refundAmountCents?`\nImporte del reembolso: ${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(p.refundAmountCents/100)}`:'';
  const url=`${frontendUrl}/compras/${encodeURIComponent(p.orderId)}`;
  const summary=`Rifa: ${p.raffle}\nPremio: ${p.prize}\nNúmeros de la compra: ${numbers}\nImporte de la compra: ${amount}${refundAmount}\nReferencia: ${p.orderId}`;
  return{subject:`${title} · ${p.raffle.replace(/[\r\n]/g,' ')}`,text:`Hola ${p.name}:\n\n${title}.\n\n${explanation}\n\n${summary}\n\nPodés consultar tu compra en ${url}\nHalcón Airguns`,html:`<div style="font-family:Arial,sans-serif;color:#252219;max-width:620px;margin:auto"><div style="background:#14130f;color:#e1bd67;padding:24px;font-weight:bold">HALCÓN AIRGUNS</div><div style="padding:24px"><h1 style="font-size:24px">${escape(title)}</h1><p>Hola ${escape(p.name)}:</p><p>${escape(explanation).replace(/\n/g,'<br>')}</p><p>${escape(summary).replace(/\n/g,'<br>')}</p><a href="${escape(url)}">Ver mi compra</a></div></div>`};
}
export interface EmailSender { sendMail(message: { from: { name: string; address: string }; to: string; subject: string; text: string; html: string; messageId: string }): Promise<unknown> }
export function mailConfigured(cfg: AppConfig) { return !!(cfg.smtpEnabled && cfg.smtpHost && z.email().safeParse(cfg.smtpFrom).success); }
export class PurchaseEmailWorker {
  private sender: EmailSender;
  constructor(private db: PrismaClient, private cfg: AppConfig, sender?: EmailSender) {
    this.sender = sender || nodemailer.createTransport({ host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpSecure, requireTLS: cfg.production && !cfg.smtpSecure, ...(cfg.smtpUser ? { auth: { user: cfg.smtpUser, pass: cfg.smtpPass } } : {}), connectionTimeout: 10000, socketTimeout: 20000, greetingTimeout: 10000, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
  }
  async process(limit = 20) {
    if (!mailConfigured(this.cfg)) return { enabled: false, sent: 0, failed: 0 };
    const now = new Date();
    const candidates = await this.db.purchaseEmail.findMany({ where: { OR: [{ status: 'PENDING', nextAttemptAt: { lte: now } }, { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - 5 * 60000) } }] }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: limit });
    let sent = 0, failed = 0;
    for (const { id } of candidates) {
      const lease = new Date();
      const claim = await this.db.purchaseEmail.updateMany({ where: { id, OR: [{ status: 'PENDING', nextAttemptAt: { lte: now } }, { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - 5 * 60000) } }] }, data: { status: 'SENDING', lockedAt: lease, attempts: { increment: 1 } } });
      if (!claim.count) continue;
      const job = await this.db.purchaseEmail.findUniqueOrThrow({ where: { id }, include: { order: { select: { status: true } } } });
      const expected={PURCHASE_CONFIRMED:'PAID',PURCHASE_REJECTED:'REJECTED',REFUND_REQUESTED:'REFUND_PENDING',REFUND_COMPLETED:'REFUNDED'} as const;
      if (job.order.status !== expected[job.kind]) { await this.db.purchaseEmail.update({ where: { id }, data: { status: 'SKIPPED', lockedAt: null, lastErrorCode: 'ORDER_STATUS_CHANGED' } }); continue; }
      try {
        const message = notificationMessage(job.kind,job.payload, this.cfg.frontendUrl);
        await this.sender.sendMail({ ...message, from: { name: 'Halcón Airguns', address: this.cfg.smtpFrom }, to: job.toEmail, messageId: `<halcon-${job.kind==='PURCHASE_CONFIRMED'?'purchase':job.kind.toLowerCase()}-${job.orderId}@${this.cfg.smtpFrom.split('@')[1]}>` });
        await this.db.purchaseEmail.updateMany({ where: { id, status: 'SENDING', lockedAt: lease }, data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastErrorCode: null } });
        sent++;
      } catch (error) {
        const code = String((error as { code?: string }).code || 'SEND_FAILED').replace(/[^A-Z0-9_]/gi, '').slice(0, 50);
        await this.db.purchaseEmail.updateMany({ where: { id, status: 'SENDING', lockedAt: lease }, data: { status: job.attempts >= 8 ? 'FAILED' : 'PENDING', lockedAt: null, lastErrorCode: code, nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000) } });
        failed++;
      }
    }
    return { enabled: true, sent, failed };
  }
}
