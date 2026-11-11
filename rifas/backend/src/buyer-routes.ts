import { Router } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import type { AppConfig } from './config.js';
import { asyncRoute, AppError } from './errors.js';
import { idSchema, buyerRemovalSchema, refundCompletionSchema } from './schemas.js';
import { BuyersService, buyersWorkbook } from './services/buyers.js';
import { mailConfigured } from './services/purchase-emails.js';
export function buyerRouter(db: PrismaClient, cfg: AppConfig) {
  const router = Router(); const service = new BuyersService(db);
  router.get('/raffles/:id/buyers', asyncRoute(async (req, res) => { res.json({ ...await service.list(idSchema.parse(req.params.id)), mailEnabled: mailConfigured(cfg) }); }));
  router.post('/raffles/:id/buyers/remove',asyncRoute(async(req,res)=>{const input=buyerRemovalSchema.parse(req.body);res.json(await service.remove(req.user!.id,idSchema.parse(req.params.id),input.anchorOrderId,input.version));}));
  router.get('/raffles/:id/refunds',asyncRoute(async(req,res)=>res.json(await service.pendingRefunds(idSchema.parse(req.params.id)))));
  router.post('/orders/:id/refund-complete',asyncRoute(async(req,res)=>{const input=refundCompletionSchema.parse(req.body);res.json(await service.completeRefund(req.user!.id,idSchema.parse(req.params.id),input.reference,input.amountCents));}));
  router.get('/raffles/:id/buyers.xlsx', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id); const data = await service.list(id);
    const file = await buyersWorkbook(data.raffle.title, data.buyers);
    await db.auditLog.create({ data: { actorId: req.user!.id, action: 'BUYERS_EXPORTED', entityId: id, detail: { buyers: data.buyers.length, numbers: data.soldNumbers } } });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="compradores-${id}.xlsx"`, 'Cache-Control': 'private, no-store' }); res.send(file);
  }));
  router.get('/emails/status', asyncRoute(async (_req, res) => res.json({ enabled: mailConfigured(cfg), pending: await db.purchaseEmail.count({ where: { status: { in: ['PENDING','SENDING'] } } }), failed: await db.purchaseEmail.count({ where: { status: 'FAILED' } }) })));
  router.post('/emails/:id/retry', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const result = await db.purchaseEmail.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'PENDING', attempts: 0, lockedAt: null, nextAttemptAt: new Date() } });
    if (!result.count) throw new AppError(409, 'Sólo se pueden reintentar correos que fallaron.');
    await db.auditLog.create({ data: { actorId: req.user!.id, action: 'EMAIL_RETRY_REQUESTED', entityId: id } }); res.json({ ok: true });
  }));
  return router;
}
