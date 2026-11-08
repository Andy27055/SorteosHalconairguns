import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { PrismaClient, User } from './generated/prisma/client.js';
import { createApp } from './app.js';
import { config } from './config.js';
const cfg={...config,jwtSecret:'test-secret-very-long-for-isolated-tests',frontendUrl:'http://localhost:5173'};
const user={id:'user-1',role:'USER',active:true,tokenVersion:0,username:'cliente',email:'cliente@example.com',fullName:'Cliente'} as User;
const db={user:{findUnique:vi.fn()},prize:{findMany:vi.fn()},order:{findUnique:vi.fn()}} as unknown as PrismaClient;
const token=(extra={})=>jwt.sign({sub:user.id,version:0,...extra},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
describe('matriz de permisos sin base de datos',()=>{
  it('permite previsualizar imágenes locales sin habilitar scripts externos', async()=>{
    const response=await request(createApp(db,cfg)).get('/api/config');
    expect(response.headers['content-security-policy']).toContain("img-src 'self' data: blob:");
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
  });
  beforeEach(()=>{vi.mocked(db.user.findUnique).mockResolvedValue(user);vi.mocked(db.prize.findMany).mockResolvedValue([]);});
  it.each(['/api/admin/prizes','/api/admin/raffles','/api/admin/users','/api/admin/orders','/api/orders'])('GET %s requiere autenticación',async route=>expect((await request(createApp(db,cfg)).get(route)).status).toBe(401));
  it.each(['/api/admin/prizes','/api/admin/raffles','/api/admin/users','/api/admin/orders'])('GET %s impide acceso de participante',async route=>expect((await request(createApp(db,cfg)).get(route).auth(token(),{type:'bearer'})).status).toBe(403));
  it('administrador puede listar premios',async()=>{vi.mocked(db.user.findUnique).mockResolvedValue({...user,role:'ADMIN'});expect((await request(createApp(db,cfg)).get('/api/admin/prizes').auth(token(),{type:'bearer'})).status).toBe(200);});
  it('rechaza sesión revocada',async()=>{vi.mocked(db.user.findUnique).mockResolvedValue({...user,tokenVersion:1});expect((await request(createApp(db,cfg)).get('/api/auth/me').auth(token(),{type:'bearer'})).status).toBe(401);});
  it('rechaza cuenta desactivada',async()=>{vi.mocked(db.user.findUnique).mockResolvedValue({...user,active:false});expect((await request(createApp(db,cfg)).get('/api/auth/me').auth(token(),{type:'bearer'})).status).toBe(401);});
  it('bloquea origen ajeno en escritura',async()=>expect((await request(createApp(db,cfg)).post('/api/orders').set('Origin','https://otro.example')).status).toBe(403));
  it('no devuelve propietarios ni credenciales en configuración',async()=>{const response=await request(createApp(db,cfg)).get('/api/config');expect(response.status).toBe(200);expect(response.body).not.toHaveProperty('mpToken');expect(response.body).not.toHaveProperty('jwtSecret');});
  it('rechaza notificaciones sin firma',async()=>expect((await request(createApp(db,cfg)).post('/api/payments/webhook').send({type:'payment',data:{id:'1'}})).status).toBe(401));
  it('otro participante no puede leer una compra ajena',async()=>{const fakeDb={...db,$transaction:vi.fn(async fn=>fn({order:{findMany:vi.fn().mockResolvedValue([])}})),order:{findUnique:vi.fn().mockResolvedValue({id:'order',userId:'other-user'})}} as unknown as PrismaClient;expect((await request(createApp(fakeDb,cfg)).get('/api/orders/order').auth(token(),{type:'bearer'})).status).toBe(403);});
});
