import { guestRouter } from './guest-routes.js';
import { transferAccounts } from './services/transfer-accounts.js';
import { buyerRouter } from './buyer-routes.js';
import { queuePurchaseEmail,queueOrderEmail } from './services/purchase-emails.js';
import { releaseRefundNumbers } from './services/refund-state.js';
import { Router } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authLimit as createAuthLimit, networkLimit, receiptCapacity } from './traffic.js';
import { PublicCache } from './services/public-cache.js';
import { LotteryService, publicRaffle } from './services/lottery.js';
import { activity, recordActivity } from './services/activity.js';
import { requestVerification, verifyEmail } from './services/verification.js';
import {cancelRaffle} from './services/raffle-lifecycle.js';
import path from 'node:path';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { AppError, asyncRoute } from './errors.js';
import { authentication, requireAdmin, owned, publicUser, issueToken, cookieOptions, isPrimaryAdmin } from './auth.js';
import { idSchema, registerSchema, loginSchema, raffleSchema, prizeSchema, reservationSchema, reviewSchema, roleSchema, profileSchema, identityFields, buyerSchema } from './schemas.js';
import { atomic } from './db.js';
import { OrdersService, expireOrders, expirable } from './services/orders.js';
import { PaymentsService, type PaymentGateway, validWebhook } from './services/payments.js';
import { ReceiptsService } from './services/receipts.js';
const userSelect = { id: true, username: true, email: true, fullName: true, role: true, adminType:true, active: true, createdAt: true,emailVerifiedAt:true } as const;
const receiptSelect = { id: true, mimeType: true, size: true, uploadedAt: true, deleteAfter: true, deletedAt: true } as const;
const orderInclude = { raffle: { include: { prize: true } }, receipts: { select: receiptSelect } } as const;
export function apiRouter(db: PrismaClient, cfg: AppConfig, gateway: PaymentGateway) {
  const router = Router();
  const publicReads = new PublicCache();
  router.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) res.once('finish', () => {
      if (res.statusCode < 400) publicReads.clear();
    });
    next();
  });
  const auth = authentication(db, cfg);
  const orders = new OrdersService(db);
  router.use('/guest-reservations', guestRouter(db, cfg));
  const payments = new PaymentsService(db, cfg, gateway);
  const receipts = new ReceiptsService(db, cfg.receiptDir);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
  router.use(['/auth', '/profile/verification', '/profile/password'], networkLimit(15 * 60000));
  const authLimit = createAuthLimit();
  const actionLimit = rateLimit({ windowMs: 60000, limit: 60, keyGenerator: req => req.user!.id, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas operaciones. Esperá un minuto.' } });
  const receiptSlot = receiptCapacity(cfg.receiptMaxConcurrent);
  router.get('/health', asyncRoute(async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); }));
  router.get('/config', (_req, res) => res.json({
    mercadoPago: !!(cfg.mpToken && cfg.mpWebhookSecret && cfg.apiUrl.startsWith('https://')),
    sandbox: cfg.mpSandbox, transfer: transferAccounts(cfg).length > 0, transferAccounts: transferAccounts(cfg),
    transferAlias: cfg.transferAlias, transferCbu: cfg.transferCbu, transferHolder: cfg.transferHolder,
    receiptMaxMb: 5, receiptRetentionMonths: 3,
  }));
  router.post('/auth/register', authLimit, asyncRoute(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { password, ...data } = input;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await atomic(db,async tx=>{const u=await tx.user.create({ data: { ...data, passwordHash, ...identityFields(data), role: 'USER' } });await recordActivity(tx,{data:{actorId:u.id,actorRole:'USER',action:'ACCOUNT_CREATED',entityId:u.id}});return u;});
    await requestVerification(db,user.id);
    res.status(201).json(issueToken(user, res, cfg));
  }));
  router.post('/auth/login', authLimit, asyncRoute(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findFirst({ where: { OR: [{ email: input.login }, { username: input.login }] } });
    // Comparación incluso para usuario inexistente para reducir diferencias temporales.
    const hash = user?.passwordHash || '$2b$12$6UyafE77iG3Pd8qD9Lwgtu7B9alY83zoEhWV5Nml8jqhSV6jL9s1u';
    const valid = await bcrypt.compare(input.password, hash);
    if (!user?.active || !valid) throw new AppError(401, 'Usuario o contraseña incorrectos.');
    await recordActivity(db,{data:{actorId:user.id,actorRole:user.role,action:'AUTH_LOGIN',entityId:user.id}});
    res.json(issueToken(user, res, cfg));
  }));
  router.get('/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user!) }));
  router.post('/auth/verify-email',authLimit,asyncRoute(async(req,res)=>{
    const input=z.object({token:z.string().max(200).regex(/^[a-z0-9]+\.[a-f0-9]{64}$/),password:registerSchema.shape.password.optional()}).parse(req.body);
    res.json(await verifyEmail(db,cfg,input.token,input.password));
  }));
  router.post('/profile/verification',auth,authLimit,asyncRoute(async(req,res)=>{const result=await requestVerification(db,req.user!.id);if(!result.alreadyVerified)await recordActivity(db,{data:{actorId:req.user!.id,action:'EMAIL_VERIFICATION_REQUESTED',entityId:req.user!.id}});res.json({...result,deliveryConfigured:!!(cfg.smtpEnabled&&cfg.smtpHost&&cfg.smtpFrom)});}));
  router.get('/profile/activity',auth,asyncRoute(async(req,res)=>{const page=z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);res.json(await activity(db,req.user!.id,page));}));
  router.post('/auth/logout', auth, asyncRoute(async (req, res) => {
    await db.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
    await recordActivity(db,{data:{actorId:req.user!.id,action:'AUTH_LOGOUT',entityId:req.user!.id}});
    res.clearCookie('halcon_token', { ...cookieOptions(cfg), maxAge: undefined }); res.json({ ok: true });
  }));
  router.get('/profile', auth, (req, res) => { const u = req.user!; res.json({ ...publicUser(u), dni: u.dni, address: u.address }); });
  router.put('/profile',auth,asyncRoute(async(req,res)=>{
    const data=profileSchema.parse(req.body);
    const result=await atomic(db,async tx=>{const current=await tx.user.findUniqueOrThrow({where:{id:req.user!.id}});if(data.email!==current.email)await tx.emailVerification.updateMany({where:{userId:current.id,consumedAt:null},data:{consumedAt:new Date(),status:'SKIPPED'}});const updated=await tx.user.update({where:{id:req.user!.id},data:{...data,...identityFields(data),...(data.email!==current.email?{emailVerifiedAt:null}:{})}});await recordActivity(tx,{data:{actorId:req.user!.id,action:'PROFILE_UPDATED',entityId:req.user!.id}});return updated;});
    res.json(publicUser(result));
  }));
  router.put('/profile/password', auth, authLimit, asyncRoute(async (req, res) => {
    const data = z.object({ currentPassword: z.string().max(128), password: registerSchema.shape.password }).parse(req.body);
    if (!await bcrypt.compare(data.currentPassword, req.user!.passwordHash)) throw new AppError(400, 'La contraseña actual no es correcta.');
    const hash = await bcrypt.hash(data.password, 12);
    await db.user.update({ where: { id: req.user!.id }, data: { passwordHash: hash, tokenVersion: { increment: 1 } } });
    await recordActivity(db,{data:{actorId:req.user!.id,action:'PASSWORD_CHANGED',entityId:req.user!.id}});
    res.clearCookie('halcon_token', { path: '/api' }); res.json({ ok: true });
  }));
  router.get('/raffles', asyncRoute(async (_req, res) => {
    res.json(await publicReads.get('catalog', async () => {
      const liveOrder = { NOT: { status: { in: [...expirable] }, expiresAt: { lt: new Date() } } };
      const list = await db.raffle.findMany({ where: { status: { notIn: ['DRAFT','CANCELLED'] } }, include: { prize: true, allocations: { where: { order: liveOrder }, select: { order: { select: { status: true } } } } }, orderBy: { createdAt: 'desc' }, take: 200 });
      return list.map(({ allocations, ...r }) => ({ ...publicRaffle(r), sold: allocations.filter(a => a.order.status === 'PAID').length, available: r.totalTickets - allocations.length }));
    }));
  }));
  router.get('/raffles/:id', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    res.json(await publicReads.get(`detail:${id}`, async () => {
      const raffle = await db.raffle.findFirst({ where: { id, status: { not: 'DRAFT' } }, include: { prize: true } });
      if (!raffle) throw new AppError(404, 'Rifa no encontrada.');
      return publicRaffle(raffle);
    }));
  }));
  router.get('/raffles/:id/availability', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data = await publicReads.get(`availability:${id}`, async () => {
      if (!await db.raffle.findFirst({ where: { id, status: { not: 'DRAFT' } }, select: { id: true } })) throw new AppError(404, 'Rifa no encontrada.');
      const items = await db.allocation.findMany({ where: { raffleId: id, order: { NOT: { status: { in: [...expirable] }, expiresAt: { lt: new Date() } } } }, select: { number: true, order: { select: { status: true } } }, orderBy: { number: 'asc' } });
      return items.map(a => ({ number: a.number, status: a.order.status === 'PAID' ? 'PAID' : 'HELD' }));
    }); res.json(data);
  }));
  router.get('/orders', auth, asyncRoute(async (req, res) => {
    await atomic(db, expireOrders);
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
    const where = { userId: req.user!.id };
    const items=await db.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip: (page-1)*20, take: 20 });
    res.json({ items:items.map(order=>({...order,raffle:publicRaffle(order.raffle)})), total: await db.order.count({ where }), page });
  }));
  router.post('/orders', auth, actionLimit, asyncRoute(async (req, res) => { const data = reservationSchema.parse(req.body); res.status(201).json(await orders.reserve(req.user!.id, data.raffleId, data.numbers)); }));
  router.get('/orders/:id', auth, asyncRoute(async (req, res) => {
    await atomic(db, expireOrders);
    const order = await db.order.findUnique({ where: { id: idSchema.parse(req.params.id) }, include: orderInclude });
    if (!order) throw new AppError(404, 'Compra no encontrada.'); owned(req, order.userId); res.json({...order,raffle:publicRaffle(order.raffle)});
  }));
  router.delete('/orders/:id', auth, actionLimit, asyncRoute(async (req, res) => res.json(await orders.cancel(req.user!.id, idSchema.parse(req.params.id)))));
  router.put('/orders/:id/buyer', auth, asyncRoute(async (req,res)=>{
    const id=idSchema.parse(req.params.id); const identity=buyerSchema.parse(req.body);
    await atomic(db,async tx=>{
      const order=await tx.order.findUniqueOrThrow({where:{id}});
      if(order.userId!==req.user!.id) throw new AppError(403,'No es tu compra.');
      if(order.status!=='RESERVED'||order.method||order.paymentCreatingAt) throw new AppError(409,'Los datos de esta compra ya fueron confirmados.');
      const current=await tx.user.findUniqueOrThrow({where:{id:req.user!.id}});
      if(identity.email!==current.email)await tx.emailVerification.updateMany({where:{userId:current.id,consumedAt:null},data:{consumedAt:new Date(),status:'SKIPPED'}});
      await tx.user.update({where:{id:req.user!.id},data:{...identity,fullName:`${identity.firstName} ${identity.lastName}`,...(identity.email!==current.email?{emailVerifiedAt:null}:{})}});
      await recordActivity(tx,{data:{actorId:req.user!.id,action:'PROFILE_UPDATED',entityId:req.user!.id}});
    });res.json({ok:true});
  }));
  router.post('/orders/:id/checkout', auth, actionLimit, asyncRoute(async (req, res) => res.json(await payments.checkout(req.user!.id, idSchema.parse(req.params.id)))));
  router.post('/orders/:id/reconcile', auth, actionLimit, asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const order = await db.order.findUnique({ where: { id } });
    if (!order) throw new AppError(404, 'Compra no encontrada.'); owned(req, order.userId);
    if (!cfg.mpToken) throw new AppError(503, 'Mercado Pago no está configurado.');
    if (order.method !== 'MERCADO_PAGO') throw new AppError(409, 'Esta compra no es de Mercado Pago.');
    await payments.reconcile(id);await recordActivity(db,{data:{actorId:req.user!.id,action:'PAYMENT_STATUS_CHECKED',entityId:id}});res.json({ ok: true });
  }));
  router.post('/orders/:id/transfer', auth, actionLimit, asyncRoute(async (req, res) => {
    const accounts = transferAccounts(cfg);
    if (!accounts.length) throw new AppError(503, 'La transferencia todavía no está configurada.');
    const input = z.object({ accountId: z.enum(['primary', 'secondary']).optional() }).parse(req.body || {});
    const account = input.accountId ? accounts.find(a => a.id === input.accountId) : accounts[0];
    if (!account) throw new AppError(400, 'La cuenta seleccionada no está habilitada.');
    res.json(await orders.startTransfer(req.user!.id, idSchema.parse(req.params.id), account));
  }));
  router.post('/orders/:id/receipt', auth, actionLimit, receiptSlot, upload.single('receipt'), asyncRoute(async (req, res) => res.status(201).json(await receipts.upload(req.user!.id, idSchema.parse(req.params.id), req.file))));
  router.get('/receipts/:id', auth, asyncRoute(async (req, res) => {
    const receipt = await db.receipt.findUnique({ where: { id: idSchema.parse(req.params.id) }, include: { order: { select: { userId: true } } } });
    if (!receipt) throw new AppError(404, 'Comprobante no encontrado.'); owned(req, receipt.order.userId);
    if (receipt.deletedAt || receipt.deleteAfter <= new Date()) throw new AppError(410, 'El comprobante se eliminó al finalizar sus tres meses de conservación.');
    if (!/^[a-z0-9-]{36}$/i.test(receipt.storageKey)) throw new AppError(500, 'Referencia de archivo inválida.');
    const extension = receipt.mimeType === 'application/pdf' ? 'pdf' : receipt.mimeType === 'image/png' ? 'png' : 'jpg';
    res.set({ 'Content-Type': receipt.mimeType, 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="comprobante-${receipt.id}.${extension}"` });
    res.sendFile(path.join(cfg.receiptDir, receipt.storageKey), error => { if (error && !res.headersSent) res.status(404).json({ error: 'El archivo no está disponible.' }); });
  }));
  router.post('/payments/webhook', asyncRoute(async (req, res) => {
    const dataId = typeof req.query['data.id'] === 'string' ? req.query['data.id'] : '';
    if (!validWebhook(String(req.headers['x-signature'] || ''), String(req.headers['x-request-id'] || ''), dataId, cfg.mpWebhookSecret)) throw new AppError(401, 'Firma de notificación inválida.');
    if (req.body?.data?.id && String(req.body.data.id).toLowerCase() !== dataId.toLowerCase()) throw new AppError(400, 'Identificador de notificación inconsistente.');
    if (req.body.type === 'payment') await payments.webhook(dataId);
    // Fallas de consulta/commit devuelven 5xx: el proveedor puede reintentar.
    res.sendStatus(200);
  }));
  router.use('/admin', auth, requireAdmin);
  router.use('/admin', buyerRouter(db, cfg));
  router.get('/admin/stats', asyncRoute(async (_req, res) => {
    const revenue = await db.order.aggregate({ where: { status: 'PAID' }, _sum: { amountCents: true } });
    res.json({ raffles: await db.raffle.count(), users: await db.user.count({ where: { active: true } }), pendingReviews: await db.order.count({ where: { status: 'UNDER_REVIEW' } }), attention: await db.order.count({ where: { status: 'NEEDS_ATTENTION' } }), revenueCents: revenue._sum.amountCents || 0 });
  }));
  router.get('/admin/prizes', asyncRoute(async (_req, res) => res.json(await db.prize.findMany({ orderBy: { createdAt: 'desc' } }))));
  router.get('/admin/prizes/:id', asyncRoute(async (req, res) => res.json(await db.prize.findUniqueOrThrow({ where: { id: idSchema.parse(req.params.id) } }))));
  router.post('/admin/prizes', asyncRoute(async (req, res) => {const input=prizeSchema.parse(req.body);res.status(201).json(await atomic(db,async tx=>{const p=await tx.prize.create({data:input});await recordActivity(tx,{data:{actorId:req.user!.id,action:'PRIZE_CREATED',entityId:p.id,detail:{name:p.name}}});return p;}));}));
  router.put('/admin/prizes/:id', asyncRoute(async (req,res)=>{const id=idSchema.parse(req.params.id),input=prizeSchema.parse(req.body);res.json(await atomic(db,async tx=>{const p=await tx.prize.update({where:{id},data:input});await recordActivity(tx,{data:{actorId:req.user!.id,action:'PRIZE_UPDATED',entityId:id,detail:{name:p.name}}});return p;}));}));
  router.delete('/admin/prizes/:id', asyncRoute(async (req,res)=>{const id=idSchema.parse(req.params.id);await atomic(db,async tx=>{const p=await tx.prize.delete({where:{id}});await recordActivity(tx,{data:{actorId:req.user!.id,action:'PRIZE_DELETED',entityId:id,detail:{name:p.name}}});});res.json({ok:true});}));
  router.get('/admin/raffles', asyncRoute(async (_req, res) => {
    const [raffles, totals] = await Promise.all([
      db.raffle.findMany({ include: { prize: true }, orderBy: { createdAt: 'desc' } }),
      db.order.groupBy({ by: ['raffleId'], where: { status: 'PAID' }, _sum: { amountCents: true } }),
    ]);
    const revenue = new Map(totals.map(total => [total.raffleId, total._sum.amountCents || 0]));
    res.json(raffles.map(raffle => ({ ...raffle, revenueCents: revenue.get(raffle.id) || 0 })));
  }));
  router.get('/admin/raffles/:id', asyncRoute(async (req, res) => res.json(await db.raffle.findUniqueOrThrow({ where: { id: idSchema.parse(req.params.id) }, include: { prize: true } }))));
  router.post('/admin/raffles', asyncRoute(async (req, res) => {
    const input = raffleSchema.parse(req.body);
    if (input.status === 'FINISHED') throw new AppError(400, 'Creá la rifa como borrador o activa.');
    const digits=input.lotteryDigits===undefined?(input.totalTickets===100?2:null):input.lotteryDigits;
    if(input.status==='ACTIVE'&&(!digits||input.totalTickets>10**digits))throw new AppError(400,'Antes de activar la rifa, definí cuántas cifras del primer premio se usarán. La fecha prevista es opcional.');
    res.status(201).json(await atomic(db,async tx=>{const r=await tx.raffle.create({data:{...input,numberStart:0,lotteryDigits:input.lotteryDigits===undefined?(input.totalTickets===100?2:null):input.lotteryDigits}});await recordActivity(tx,{data:{actorId:req.user!.id,action:'RAFFLE_CREATED',entityId:r.id}});return r;}));
  }));
  router.put('/admin/raffles/:id', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id); const input = raffleSchema.parse(req.body);
    res.json(await atomic(db, async tx => {
      const raffle = await tx.raffle.findUniqueOrThrow({ where: { id } });
      if (raffle.drawnAt||['CLOSING','CANCELLED'].includes(raffle.status)) throw new AppError(409, 'Una rifa cerrada conserva sus datos históricos. Podés cancelarla desde Eliminar rifa.');
      if(input.status==='ACTIVE'&&(raffle.numberStart===0||raffle.status!=='ACTIVE')&&(!(input.lotteryDigits??raffle.lotteryDigits)||input.totalTickets>10**(input.lotteryDigits??raffle.lotteryDigits!)))throw new AppError(400,'Definí las cifras antes de activar la rifa.');
      const allocated = await tx.allocation.findFirst({ where: { raffleId: id }, orderBy: { number: 'desc' } });
      if (allocated && allocated.number >= raffle.numberStart+input.totalTickets) throw new AppError(409, 'La cantidad no puede dejar afuera números asignados.');
      if(await tx.order.count({where:{raffleId:id}})){
        if((input.drawAt?new Date(input.drawAt).getTime():null)!==(raffle.drawAt?.getTime()||null)||input.totalTickets!==raffle.totalTickets||(input.lotteryDigits!==undefined&&input.lotteryDigits!==raffle.lotteryDigits))throw new AppError(409,'La fecha, cantidad de números y cifras se conservan cuando ya hay compras. Configurá estas reglas antes de abrir una rifa nueva.');
      }
      const pending = await tx.order.count({ where: { raffleId: id, status: { in: ['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION'] } } });
      if (input.status !== raffle.status && pending) throw new AppError(409, 'Resolvé las compras pendientes antes de cambiar el estado.');
      if (input.status === 'FINISHED' && raffle.status !== 'FINISHED') throw new AppError(409, 'Usá Finalizar rifa para verificar y registrar el resultado oficial.');
      const updated = await tx.raffle.update({ where: { id }, data: input });
      await recordActivity(tx,{ data: { actorId: req.user!.id, action: 'RAFFLE_UPDATED', entityId: id } }); return updated;
    }));
  }));
  router.delete('/admin/raffles/:id', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const {reason}=z.object({reason:z.string().trim().max(1000).default('')}).parse(req.body||{});
    res.json(await cancelRaffle(db,req.user!.id,id,reason));
  }));
  router.post('/admin/raffles/:id/finish',asyncRoute(async(req,res)=>res.json(await new LotteryService(db).finish(req.user!.id,idSchema.parse(req.params.id)))));
  router.post('/admin/raffles/:id/draw',(_req,_res,next)=>next(new AppError(410,'El sorteo aleatorio fue retirado. Usá Finalizar rifa para consultar la Nocturna bonaerense.')));
  router.get('/admin/orders', asyncRoute(async (req, res) => {
    const status = z.enum(['ALL','UNDER_REVIEW','NEEDS_ATTENTION','PAID','PAYMENT_PENDING','AWAITING_RECEIPT']).default('ALL').parse(req.query.status);
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const where = status === 'ALL' ? {} : { status };
    res.json({ items: await db.order.findMany({ where, include: { ...orderInclude, user: { select: {...userSelect,dni:true,firstName:true,lastName:true} } }, orderBy: { createdAt: 'desc' }, skip: (page-1)*25, take: 25 }), total: await db.order.count({ where }), page });
  }));
  router.post('/admin/orders/:id/review', asyncRoute(async (req, res) => { const input = reviewSchema.parse(req.body); res.json(await receipts.review(req.user!.id, idSchema.parse(req.params.id), input.decision, input.note,input.reasonCode)); }));
  router.post('/admin/orders/:id/resolve', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data = z.object({ decision: z.enum(['assign','refund_recorded']), note: z.string().trim().min(10).max(500) }).parse(req.body);
    res.json(await atomic(db, async tx => {
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { raffle: true } });
      if (order.status !== 'NEEDS_ATTENTION') throw new AppError(409, 'La compra no está pendiente de conciliación.');
      if (data.decision === 'assign') {
        if (order.paymentStatus !== 'approved' || order.raffle.status !== 'ACTIVE' || order.raffle.drawnAt || order.decisionNote?.startsWith('El pago no coincide')) throw new AppError(409, 'No se puede asignar sin pago aprobado, importe y moneda coincidentes y rifa activa.');
        const existing = await tx.allocation.findMany({ where: { raffleId: order.raffleId, number: { in: order.numbers } } });
        if (existing.some(a => a.orderId !== id)) throw new AppError(409, 'Hay números asignados a otra persona. Debés conciliar una devolución.');
        const missing = order.numbers.filter(n => !existing.some(a => a.number === n));
        if (missing.length) await tx.allocation.createMany({ data: missing.map(number => ({ number, raffleId: order.raffleId, orderId: id })) });
      } else {
        await releaseRefundNumbers(tx,id);
      }
      const result = await tx.order.update({ where: { id }, data: { status: data.decision === 'assign' ? 'PAID' : 'REFUNDED', paidAt: data.decision === 'assign' ? new Date() : order.paidAt, decisionNote: data.note, reviewedBy: req.user!.id,...(data.decision==='refund_recorded'?{refundRequestedAt:order.refundRequestedAt||new Date(),refundCompletedAt:new Date(),refundAmountCents:order.decisionNote?.startsWith('El pago no coincide')?null:order.amountCents,refundReference:data.note}:{}) } });
      if (data.decision === 'assign') await queuePurchaseEmail(tx, id);
      else await queueOrderEmail(tx,id,'REFUND_COMPLETED');
      await recordActivity(tx,{ data: { actorId: req.user!.id, action: data.decision === 'assign' ? 'PAYMENT_ASSIGNED_MANUALLY' : 'EXTERNAL_REFUND_RECORDED', entityId: id, detail: { note: data.note } } }); return result;
    }));
  }));
  router.get('/admin/users', asyncRoute(async (_req, res) => res.json(await db.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' }, take: 500 }))));
  router.get('/admin/users/:id', asyncRoute(async (req, res) => res.json(await db.user.findUniqueOrThrow({ where: { id: idSchema.parse(req.params.id) }, select: {...userSelect,firstName:true,lastName:true,dni:true,address:true} }))));
  router.get('/admin/users/:id/activity',asyncRoute(async(req,res)=>{const id=idSchema.parse(req.params.id);await db.user.findUniqueOrThrow({where:{id}});const page=z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);res.json(await activity(db,id,page));}));
  router.post('/admin/users', asyncRoute(async (req, res) => {
    const data = registerSchema.parse(req.body); const { password, ...userData } = data;
    const passwordHash=await bcrypt.hash(password,12);
    res.status(201).json(await atomic(db,async tx=>{const u=await tx.user.create({data:{...userData,passwordHash,...identityFields(userData),role:'USER'},select:userSelect});await recordActivity(tx,{data:{actorId:req.user!.id,action:'ACCOUNT_CREATED',entityId:u.id}});return u;}));
  }));
  router.put('/admin/users/:id', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id); const data = roleSchema.parse(req.body);
    if (id === req.user!.id && (data.role !== 'ADMIN' || !data.active)) throw new AppError(409, 'No podés quitar tu propio acceso administrativo.');
    res.json(await atomic(db, async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id } });
      if(!isPrimaryAdmin(req.user!)&&(user.role==='ADMIN'||data.role==='ADMIN'))throw new AppError(403,'Sólo el administrador principal puede gestionar permisos o modificar el acceso de otros administradores.');
      if(user.adminType==='PRIMARY'&&(data.role!=='ADMIN'||!data.active))throw new AppError(409,'La cuenta administradora principal debe conservar su acceso.');
      if (user.role === 'ADMIN' && (data.role !== 'ADMIN' || !data.active) && await tx.user.count({ where: { role: 'ADMIN', active: true } }) < 2) throw new AppError(409, 'Debe quedar un administrador activo.');
      const result = await tx.user.update({ where: { id }, data: { ...data,adminType:data.role==='ADMIN'?(user.adminType||'FUNCTIONAL'):null, tokenVersion: { increment: 1 } }, select: userSelect });
      await recordActivity(tx,{ data: { actorId: req.user!.id, action: 'USER_ACCESS_UPDATED', entityId: id, detail: data } }); return result;
    }));
  }));
  router.delete('/admin/users/:id', asyncRoute(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    if (id === req.user!.id) throw new AppError(409, 'No podés desactivar tu propia cuenta.');
    await atomic(db, async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id } });
      if(user.role==='ADMIN'&&!isPrimaryAdmin(req.user!))throw new AppError(403,'Sólo el administrador principal puede desactivar a otros administradores.');
      if(user.adminType==='PRIMARY')throw new AppError(409,'La cuenta administradora principal debe conservar su acceso.');
      if (user.role === 'ADMIN' && await tx.user.count({ where: { role: 'ADMIN', active: true } }) < 2) throw new AppError(409, 'Debe quedar un administrador activo.');
      await tx.user.update({ where: { id }, data: { active: false, tokenVersion: { increment: 1 } } });
      await recordActivity(tx,{ data: { actorId: req.user!.id, action: 'USER_DEACTIVATED', entityId: id } });
    }); res.json({ ok: true });
  }));
  router.get('/admin/audit', asyncRoute(async (req,res)=>{const page=z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);res.json(await activity(db,undefined,page));}));
  router.post('/admin/receipts/purge', asyncRoute(async (req,res)=>{const result=await receipts.purge();await recordActivity(db,{data:{actorId:req.user!.id,action:'RECEIPT_CLEANUP_REQUESTED',entityId:'receipts',detail:result}});res.json(result);}));
  return router;
}
