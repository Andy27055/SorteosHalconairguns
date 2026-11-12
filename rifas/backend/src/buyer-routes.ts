import { Router } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import type { AppConfig } from './config.js';
import { asyncRoute, AppError } from './errors.js';
import { idSchema, buyerRemovalSchema, refundCompletionSchema } from './schemas.js';
import { BuyersService, buyersWorkbook } from './services/buyers.js';
import { mailConfigured } from './services/purchase-emails.js';
import { recordActivity } from './services/activity.js';
export function buyerRouter(db: PrismaClient, cfg: AppConfig) {
  const router = Router(); const service = new BuyersService(db);
  router.get('/raffles/:id/buyers', asyncRoute(async (req, res) => { res.json({ ...await service.list(idSchema.parse(req.params.id)), mailEnabled: mailConfigured(cfg) }); }));
  router.post('/raffles/:id/buyers/remove',asyncRoute(async(req,res)=>{const input=buyerRemovalSchema.parse(req.body);res.json(await service.remove(req.user!.id,idSchema.parse(req.params.id),input.anchorOrderId,input.version));}));
  router.get('/raffles/:id/refunds',asyncRoute(async(req,res)=>res.json(await service.pendingRefunds(idSchema.parse(req.params.id)))));
  router.post('/orders/:id/refund-complete',asyncRoute(async(req,res)=>{const input=refundCompletionSchema.parse(req.body);res.json(await service.completeRefund(req.user!.id,idSchema.parse(req.params.id),input.reference,input.amountCents));}));
  router.get('/raffles/:id/buyers.xlsx', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id); const data = await service.list(id);
    const file = await buyersWorkbook(data.raffle.title, data.buyers,data.raffle.numberStart===0?Math.max(2,String(data.raffle.totalTickets-1).length):3);
    await recordActivity(db,{ data: { actorId: req.user!.id, action: 'BUYERS_EXPORTED', entityId: id, detail: { buyers: data.buyers.length, numbers: data.soldNumbers } } });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="compradores-${id}.xlsx"`, 'Cache-Control': 'private, no-store' }); res.send(file);
  }));
  router.get('/emails/status', asyncRoute(async (_req,res)=>{const pending={status:{in:['PENDING','SENDING'] as ('PENDING'|'SENDING')[]}},failed={status:'FAILED' as const};const counts=await Promise.all([db.purchaseEmail.count({where:pending}),db.raffleEmail.count({where:pending}),db.emailVerification.count({where:{...pending,consumedAt:null}}),db.purchaseEmail.count({where:failed}),db.raffleEmail.count({where:failed}),db.emailVerification.count({where:{...failed,consumedAt:null}})]);res.json({enabled:mailConfigured(cfg),pending:counts[0]+counts[1]+counts[2],failed:counts[3]+counts[4]+counts[5]});}));
  router.post('/emails/:id/retry', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data={status:'PENDING' as const,attempts:0,lockedAt:null,nextAttemptAt:new Date()};
    let count=(await db.purchaseEmail.updateMany({where:{id,status:'FAILED'},data})).count;
    if(!count)count=(await db.raffleEmail.updateMany({where:{id,status:'FAILED'},data})).count;
    if(!count)count=(await db.emailVerification.updateMany({where:{id,status:'FAILED',consumedAt:null},data})).count;
    if (!count) throw new AppError(409, 'Sólo se pueden reintentar correos que fallaron.');
    await recordActivity(db,{ data: { actorId: req.user!.id, action: 'EMAIL_RETRY_REQUESTED', entityId: id } }); res.json({ ok: true });
  }));
  return router;
}
