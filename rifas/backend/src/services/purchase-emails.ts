import nodemailer from 'nodemailer';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../config.js';

const payloadSchema = z.object({ name: z.string(), raffle: z.string(), prize: z.string(), numbers: z.array(z.number().int()), amountCents: z.number().int(), paidAt: z.string(), orderId: z.string() });
export async function queuePurchaseEmail(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { raffle: { include: { prize: true } }, user: true } });
  if (order.status !== 'PAID') return;
  const email = order.buyerEmail || order.user?.email || '';
  const valid = z.email().safeParse(email).success && !email.endsWith('.invalid');
  await tx.purchaseEmail.upsert({ where: { orderId }, update: {}, create: {
    orderId, toEmail: email, status: valid ? 'PENDING' : 'SKIPPED', lastErrorCode: valid ? null : 'MISSING_RECIPIENT',
    payload: { name: [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ') || order.user?.fullName || 'Participante', raffle: order.raffle.title, prize: order.raffle.prize.name, numbers: order.numbers, amountCents: order.amountCents, paidAt: (order.paidAt || new Date()).toISOString(), orderId },
  } });
}
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
      if (job.order.status !== 'PAID') { await this.db.purchaseEmail.update({ where: { id }, data: { status: 'SKIPPED', lockedAt: null, lastErrorCode: 'ORDER_NOT_PAID' } }); continue; }
      try {
        const message = purchaseMessage(job.payload, this.cfg.frontendUrl);
        await this.sender.sendMail({ ...message, from: { name: 'Halcón Airguns', address: this.cfg.smtpFrom }, to: job.toEmail, messageId: `<halcon-purchase-${job.orderId}@${this.cfg.smtpFrom.split('@')[1]}>` });
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
