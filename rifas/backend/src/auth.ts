import type { Request, RequestHandler, Response } from 'express';
import type { PrismaClient, User } from './generated/prisma/client.js';
import jwt from 'jsonwebtoken';
import type { AppConfig } from './config.js';
import { AppError, asyncRoute } from './errors.js';
declare global { namespace Express { interface Request { user?: User } } }
export const publicUser = (u: User) => ({ id: u.id, username: u.username, email: u.email, fullName: u.fullName, role: u.role });
export const cookieOptions = (cfg: AppConfig) => ({ httpOnly: true, secure: cfg.production, sameSite: 'lax' as const, path: '/api', maxAge: cfg.jwtHours * 3600000 });
export function issueToken(user: User, res: Response, cfg: AppConfig) {
  const token = jwt.sign({ sub: user.id, version: user.tokenVersion }, cfg.jwtSecret, { expiresIn: `${cfg.jwtHours}h`, issuer: 'halcon-airguns', audience: 'halcon-web', algorithm: 'HS256' });
  res.cookie('halcon_token', token, cookieOptions(cfg));
  return { user: publicUser(user), token };
}
export function authentication(db: PrismaClient, cfg: AppConfig): RequestHandler {
  return asyncRoute(async (req, _res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer /i, '') || req.cookies?.halcon_token;
    if (!token) throw new AppError(401, 'Iniciá sesión para continuar.');
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'], issuer: 'halcon-airguns', audience: 'halcon-web' }) as jwt.JwtPayload; }
    catch { throw new AppError(401, 'Tu sesión venció. Volvé a ingresar.'); }
    const user = await db.user.findUnique({ where: { id: String(payload.sub) } });
    if (!user?.active || user.tokenVersion !== payload.version) throw new AppError(401, 'Tu sesión ya no está activa.');
    req.user = user; next();
  });
}
export const requireAdmin: RequestHandler = (req, _res, next) => { if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'Necesitás permisos de administrador.')); next(); };
export function checkOrigin(cfg: AppConfig): RequestHandler {
  return (req, _res, next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method) || req.path === '/payments/webhook') return next();
    const origin = req.headers.origin;
    if (origin && origin !== cfg.frontendUrl && origin !== cfg.apiUrl) return next(new AppError(403, 'Origen de solicitud no permitido.'));
    // Cookies se usan sólo desde el sitio; clientes sin Origin deben usar Bearer.
    if (!origin && req.cookies?.halcon_token && !req.headers.authorization) return next(new AppError(403, 'La solicitud requiere un origen válido.'));
    next();
  };
}
export function owned(req: Request, ownerId: string) { if (req.user!.id !== ownerId && req.user!.role !== 'ADMIN') throw new AppError(403, 'No tenés acceso a esta operación.'); }
