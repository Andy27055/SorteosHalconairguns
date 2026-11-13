import express, { type Response } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { AppConfig } from './config.js';

const ttl = 4 * 3600000;
const cookieName = 'halcon_demo';
const equal = (left: string, right: string) => timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
function loginPage(res: Response, status = 200, error = '') {
  const nonce = randomBytes(18).toString('base64');
  res.set('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.status(status).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demostración privada · Halcón Airguns</title><style>body{margin:0;background:#11110f;color:#f1ede3;font:16px Arial,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:min(92%,460px);padding:28px;background:#1b1b17;border:1px solid #cda34b66}h1{color:#e1bd67;font-size:24px}p{line-height:1.6;color:#cac4b7}label{display:block;margin:24px 0 10px}.control{display:flex;min-width:0}input{box-sizing:border-box;min-width:0;width:100%;min-height:48px;padding:12px;background:#11110f;color:#fff;border:1px solid #897447;font-size:16px}.toggle{min-width:72px;margin:0;background:#343024;color:#e1bd67;border:1px solid #897447}.enter{width:100%;min-height:48px;margin-top:20px;background:#cda34b;color:#11110f;font-weight:bold;border:0}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid #e1bd67;outline-offset:3px}.error{color:#ffc1b0}</style></head><body><main><h1>HALCÓN AIRGUNS</h1><p>Demostración privada. Ingresá la clave que te compartió el desarrollador.</p>${error ? `<p role="alert" class="error">${error}</p>` : ''}<form method="post" action="/__demo/access"><label for="demo-code">Clave de la demostración</label><div class="control"><input id="demo-code" name="code" type="password" required maxlength="100" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="toggle" type="button" id="toggle" aria-controls="demo-code" aria-pressed="false">Mostrar</button></div><button class="enter" type="submit">ENTRAR A LA DEMOSTRACIÓN</button></form></main><script nonce="${nonce}">const input=document.getElementById('demo-code'),button=document.getElementById('toggle');button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));});</script></body></html>`);
}

// Enabled only by the temporary demo launcher. Protects the entire site and API.
export function demoAccess(cfg: AppConfig) {
  const router = express.Router();
  if (!cfg.demoAccessCode) return router;
  const signature = (expiry: string) => createHmac('sha256', cfg.jwtSecret).update(`demo:${expiry}:${cfg.demoAccessCode}`).digest('hex');
  const validCookie = (cookie: unknown) => {
    if (typeof cookie !== 'string' || !/^\d{13}\.[a-f0-9]{64}$/.test(cookie)) return false;
    const [expiry, mac] = cookie.split('.');
    return Number(expiry) > Date.now() && Number(expiry) <= Date.now() + ttl && equal(mac, signature(expiry));
  };
  router.use((_req, res, next) => { res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }); next(); });
  const attempts = rateLimit({ windowMs: 10 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, res) => loginPage(res, 429, 'Demasiados intentos. Esperá diez minutos antes de volver a probar.') });
  router.post('/__demo/access', attempts, express.urlencoded({ extended: false, limit: '1kb' }), (req, res) => {
    if (typeof req.body?.code !== 'string' || req.body.code.length > 100 || !equal(req.body.code, cfg.demoAccessCode)) {
      loginPage(res, 401, 'La clave de demostración no es correcta.'); return;
    }
    const expiry = String(Date.now() + ttl);
    res.cookie(cookieName, `${expiry}.${signature(expiry)}`, { httpOnly: true, secure: cfg.production, sameSite: 'lax', path: '/', maxAge: ttl });
    res.redirect(303, '/');
  });
  router.use((req, res, next) => {
    const header = req.headers['x-demo-access-code'];
    if (validCookie(req.cookies?.[cookieName]) || (typeof header === 'string' && header.length <= 100 && equal(header, cfg.demoAccessCode))) { next(); return; }
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.status(401).json({ code: 'DEMO_ACCESS_REQUIRED', error: 'El acceso a la demostración venció. Abrí la página principal e ingresá su clave nuevamente.' }); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.status(401).end(); return; }
    loginPage(res);
  });
  return router;
}
