import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { config } from './config.js';
import type { PrismaClient } from './generated/prisma/client.js';

const cfg = { ...config, production: true, demoAccessCode: 'only-for-tests-private-code-123', jwtSecret: 'test-demo-secret-not-used-anywhere-else' };
const db = {} as PrismaClient;
describe('demo privada antes de la página y de cualquier API', () => {
  it('cubre página, API y archivos sin consultar PostgreSQL', async () => {
    const app = createApp(db, cfg);
    const page = await request(app).get('/ingresar');
    expect(page.status).toBe(200); expect(page.text).toContain('Demostración privada');
    expect(page.text).not.toContain(cfg.demoAccessCode);
    expect(page.headers['content-security-policy']).toContain("script-src 'nonce-");
    expect((await request(app).get('/assets/index.js')).text).toContain('Demostración privada');
    for (const path of ['/api/raffles', '/api/admin/users', '/api/receipts/private']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401); expect(response.body.code).toBe('DEMO_ACCESS_REQUIRED');
    }
    expect((await request(app).post('/api/auth/login').send({login:'any',password:'any'})).status).toBe(401);
    const forged = `${Date.now()+3600000}.${'0'.repeat(64)}`;
    expect((await request(app).get('/api/config').set('Cookie', `halcon_demo=${forged}`)).status).toBe(401);
  });
  it('una clave correcta permite el sitio, pero no reemplaza los permisos de usuario', async () => {
    const app = createApp(db, cfg);
    const denied = await request(app).post('/__demo/access').type('form').send({code:'wrong'});
    expect(denied.status).toBe(401); expect(denied.headers['set-cookie']).toBeUndefined();
    const access = await request(app).post('/__demo/access').type('form').send({code:cfg.demoAccessCode});
    expect(access.status).toBe(303);
    const cookies = access.headers['set-cookie'];
    expect(cookies.join('')).toContain('Secure'); expect(cookies.join('')).toContain('HttpOnly');
    const cookie = cookies[0].split(';')[0];
    expect((await request(app).get('/api/config').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/admin/users').set('Cookie', cookie)).status).toBe(401);
    const restarted = createApp(db, {...cfg,jwtSecret:'new-process-secret'});
    expect((await request(restarted).get('/api/config').set('Cookie', cookie)).status).toBe(401);
  });
  it('el modo habitual no requiere clave y los intentos de acceso tienen límite', async () => {
    expect((await request(createApp(db,{...config,demoAccessCode:''})).get('/api/config')).status).toBe(200);
    const app = createApp(db,cfg);
    for (let i=0;i<10;i++) expect((await request(app).post('/__demo/access').type('form').send({code:'wrong'})).status).toBe(401);
    expect((await request(app).post('/__demo/access').type('form').send({code:cfg.demoAccessCode})).status).toBe(429);
  });
});
