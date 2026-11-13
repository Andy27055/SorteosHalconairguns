import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const networkLimit = (windowMs: number) => rateLimit({
  windowMs, limit: 3000, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Hay demasiadas operaciones desde esta conexión. Esperá unos minutos.' },
});

// Keep the existing per-person limit without grouping everyone on a shared IP.
export const authLimit = () => rateLimit({
  windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => {
    const identity = req.user?.id || [req.body?.login, req.body?.email, req.body?.username, req.body?.token]
      .find(value => typeof value === 'string') || '';
    return `${ipKeyGenerator(req.ip || 'unknown')}:${createHash('sha256').update(String(identity).trim().toLowerCase()).digest('hex')}`;
  },
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
});

// Bound buffers before multer receives a file. No waiting requests hold files in memory.
export function receiptCapacity(maxActive: number): RequestHandler {
  let active = 0;
  return (_req, res, next) => {
    if (active >= maxActive) {
      res.set('Retry-After', '3').status(503).json({ error: 'Hay varias cargas de comprobantes en curso. Esperá unos segundos y volvé a enviarlo.' });
      return;
    }
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
