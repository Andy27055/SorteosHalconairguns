import { Router } from 'express';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from './generated/prisma/client.js';
import type { AppConfig } from './config.js';
import { authentication } from './auth.js';
import { asyncRoute } from './errors.js';
import { reservationSchema } from './schemas.js';
import { GuestReservationsService, GUEST_HOLD_MS } from './services/guest-reservations.js';
import { networkLimit } from './traffic.js';
export const guestHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function guestRouter(db: PrismaClient, cfg: AppConfig) {
  const router = Router(); const service = new GuestReservationsService(db);
  const options = { httpOnly: true, secure: cfg.production, sameSite: 'lax' as const, path: '/api', maxAge: GUEST_HOLD_MS };
  const token = (value: unknown): string | null => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
  router.get('/', asyncRoute(async (req, res) => {
    const value = token(req.cookies?.halcon_guest);
    const reservation = value ? await service.current(guestHash(value)) : null;
    res.json({ reservation });
  }));
  router.post('/', networkLimit(GUEST_HOLD_MS), (req, res, next) => {
    const value = token(req.cookies?.halcon_guest) || randomBytes(32).toString('hex');
    req.cookies.halcon_guest = value;
    res.cookie('halcon_guest', value, options);
    next();
  }, rateLimit({ windowMs: GUEST_HOLD_MS, limit: 12, keyGenerator: req => guestHash(req.cookies.halcon_guest), standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Esperá unos minutos antes de crear otra reserva o iniciá sesión.' } }), asyncRoute(async (req, res) => {
    const input = reservationSchema.parse(req.body);
    const value = token(req.cookies?.halcon_guest) || randomBytes(32).toString('hex');
    const clientHash = createHmac('sha256', cfg.jwtSecret).update(`guest:${value}`).digest('hex');
    const order = await service.reserve(guestHash(value), clientHash, input.raffleId, input.numbers);
    res.cookie('halcon_guest', value, { ...options, maxAge: Math.max(1000, order.expiresAt.getTime() - Date.now()) });
    res.status(201).json({ reservation: { id: order.id, raffleId: order.raffleId, numbers: order.numbers, expiresAt: order.expiresAt } });
  }));
  router.post('/claim', authentication(db, cfg), asyncRoute(async (req, res) => {
    const value = token(req.cookies?.halcon_guest);
    const order = value ? await service.claim(guestHash(value), req.user!.id) : null;
    res.clearCookie('halcon_guest', { path: '/api', httpOnly: true, secure: cfg.production, sameSite: 'lax' });
    res.json({ order });
  }));
  router.delete('/', asyncRoute(async (req, res) => {
    const value = token(req.cookies?.halcon_guest); if (value) await service.cancel(guestHash(value));
    res.clearCookie('halcon_guest', { path: '/api' }); res.json({ ok: true });
  }));
  return router;
}
