import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from './generated/prisma/client.js';
import { config, type AppConfig } from './config.js';
import { prisma } from './db.js';
import { errorHandler, AppError } from './errors.js';
import { checkOrigin } from './auth.js';
import { apiRouter } from './routes.js';
import { MercadoPagoGateway, type PaymentGateway } from './services/payments.js';
export function createApp(db: PrismaClient = prisma, cfg: AppConfig = config, gateway: PaymentGateway = new MercadoPagoGateway(cfg.mpToken)) {
  const app = express();
  if (cfg.production) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'", cfg.frontendUrl, cfg.apiUrl], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: cfg.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', checkOrigin(cfg), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, apiRouter(db, cfg, gateway));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'Endpoint no encontrado.')));
  if (existsSync(path.join(cfg.frontendDist, 'index.html'))) {
    app.use(express.static(cfg.frontendDist));
    app.get('*', (_req, res) => res.sendFile(path.join(cfg.frontendDist, 'index.html')));
  } else app.get('/', (_req, res) => res.json({ app: 'Halcón Airguns', api: '/api', frontend: cfg.frontendUrl }));
  app.use(errorHandler);
  return app;
}
