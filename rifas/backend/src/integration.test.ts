import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { OrdersService } from './services/orders.js';
import { PaymentsService, type PaymentGateway } from './services/payments.js';
import { ReceiptsService } from './services/receipts.js';
import { config } from './config.js';
import { createApp } from './app.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('integración PostgreSQL aislada: RUN_DB_TESTS=true',()=>{
  const schema=`halcon_test_${randomUUID().replaceAll('-','')}`;
  const connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
  const pool=new pg.Pool({connectionString,connectionTimeoutMillis:5000});
  const db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
  const directory=path.join(os.tmpdir(),schema);
  let userId:string,otherId:string,raffleId:string;let orderService:OrdersService;
  beforeAll(async()=>{
    if(!connectionString)throw new Error('Definí TEST_DATABASE_URL o DATABASE_URL.');
    await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();
    try{await client.query(`SET search_path TO "${schema}"`);for(const folder of (await fs.readdir('prisma/migrations')).sort()){const sql=await fs.readFile(path.join('prisma/migrations',folder,'migration.sql'),'utf8').catch(()=>null);if(sql)await client.query(sql);}}finally{client.release();}
    userId=(await db.user.create({data:{username:'db-user',email:'user@example.com',fullName:'Usuario Test',passwordHash:'not-used'}})).id;
    otherId=(await db.user.create({data:{username:'db-other',email:'other@example.com',fullName:'Otro Test',passwordHash:'not-used'}})).id;
    const prize=await db.prize.create({data:{name:'Premio de prueba'}});
    raffleId=(await db.raffle.create({data:{title:'Rifa prueba',prizeId:prize.id,totalTickets:100,ticketPriceCents:500000,status:'ACTIVE'}})).id;
    orderService=new OrdersService(db);
  },30000);
  afterAll(async()=>{
    await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema de pruebas inválido.');
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();
    const resolved=path.resolve(directory);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||path.basename(resolved)!==schema)throw new Error('Ruta de pruebas inválida.');
    await fs.rm(resolved,{recursive:true,force:true});
  },15000);
  it('dos reservas simultáneas dejan un solo propietario',async()=>{const results=await Promise.allSettled([orderService.reserve(userId,raffleId,[1]),orderService.reserve(otherId,raffleId,[1])]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await db.allocation.count({where:{raffleId,number:1}})).toBe(1);});
  it('la reserva de varios números es indivisible',async()=>{await expect(orderService.reserve(userId,raffleId,[1,2])).rejects.toThrow();expect(await db.allocation.count({where:{raffleId,number:2}})).toBe(0);});
  it('mantiene el precio histórico',async()=>{const o=await orderService.reserve(userId,raffleId,[3]);await db.raffle.update({where:{id:raffleId},data:{ticketPriceCents:600000}});expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).amountCents).toBe(500000);});
  it('vencer libera números y conserva la compra',async()=>{const o=await orderService.reserve(userId,raffleId,[4]);await db.order.update({where:{id:o.id},data:{expiresAt:new Date(Date.now()-60000)}});await orderService.reserve(otherId,raffleId,[4]);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('EXPIRED');});
  it('un comprobante requiere revisión y sólo lo carga su propietario',async()=>{
    const o=await orderService.reserve(userId,raffleId,[5]);await orderService.startTransfer(userId,o.id);const receipts=new ReceiptsService(db,directory);const buffer=Buffer.from('%PDF-1.7\ncomprobante-test');
    const r=await receipts.upload(userId,o.id,{buffer,size:buffer.length,mimetype:'application/pdf'} as Express.Multer.File);
    expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('UNDER_REVIEW');
    await expect(receipts.upload(otherId,o.id,{buffer,size:buffer.length,mimetype:'application/pdf'} as Express.Multer.File)).rejects.toThrow('No es tu compra');
    await receipts.review('admin-test',o.id,'approve','Acreditación verificada en cuenta.');expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('PAID');expect(r.deleteAfter>r.uploadedAt).toBe(true);
  });
  it('rechaza archivos disfrazados de PDF',async()=>{const o=await orderService.reserve(userId,raffleId,[6]);await orderService.startTransfer(userId,o.id);await expect(new ReceiptsService(db,directory).upload(userId,o.id,{buffer:Buffer.from('<html>'),size:6,mimetype:'application/pdf'} as Express.Multer.File)).rejects.toThrow('no coincide');});
  it('elimina el archivo vencido y conserva compra y metadatos',async()=>{
    const o=await orderService.reserve(userId,raffleId,[7]);await orderService.startTransfer(userId,o.id);const receipts=new ReceiptsService(db,directory);const buffer=Buffer.from('%PDF-1.7\nretention');
    const r=await receipts.upload(userId,o.id,{buffer,size:buffer.length,mimetype:'application/pdf'} as Express.Multer.File);const stored=await db.receipt.findUniqueOrThrow({where:{id:r.id}});await db.receipt.update({where:{id:r.id},data:{deleteAfter:new Date(Date.now()-60000)}});
    expect((await receipts.purge()).removed).toBe(1);expect((await db.receipt.findUniqueOrThrow({where:{id:r.id}})).deletedAt).not.toBeNull();expect(await db.order.findUnique({where:{id:o.id}})).not.toBeNull();await expect(fs.access(path.join(directory,stored.storageKey))).rejects.toThrow();expect((await receipts.purge()).removed).toBe(0);
  });
  const cfg={...config,mpToken:'test-token',mpWebhookSecret:'test-secret',apiUrl:'https://api.example.com',mpSandbox:true};let creates=0;
  const gateway:PaymentGateway={createPreference:async()=>{creates++;return{id:randomUUID(),init_point:'https://www.mercadopago.com.ar/checkout/v1/test',sandbox_init_point:'https://sandbox.mercadopago.com.ar/checkout/v1/test'};},findPreference:async()=>null,getPayment:async()=>{throw new Error('not called');},findPayments:async()=>[]};
  it('reutiliza enlace y confirma el webhook duplicado una sola vez',async()=>{
    const o=await orderService.reserve(userId,raffleId,[8]);const service=new PaymentsService(db,cfg,gateway);const before=creates;const first=await service.checkout(userId,o.id);const second=await service.checkout(userId,o.id);expect(first.checkoutUrl).toBe(second.checkoutUrl);expect(creates-before).toBe(1);
    const payment={id:'payment-8',status:'approved',external_reference:o.id,transaction_amount:o.amountCents/100,currency_id:'ARS',live_mode:false};await service.apply(payment);await service.apply(payment);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('PAID');expect(await db.auditLog.count({where:{entityId:o.id,action:'MP_PAYMENT_UPDATED'}})).toBe(1);
  });
  it('no confirma importe equivocado',async()=>{const o=await orderService.reserve(userId,raffleId,[9]);const service=new PaymentsService(db,cfg,gateway);await service.checkout(userId,o.id);await service.apply({id:'payment-9',status:'approved',external_reference:o.id,transaction_amount:0.01,currency_id:'ARS',live_mode:false});expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('NEEDS_ATTENTION');});
  it('pago tardío no quita el número al nuevo titular',async()=>{
    const o=await orderService.reserve(userId,raffleId,[10]);const service=new PaymentsService(db,cfg,gateway);await service.checkout(userId,o.id);await db.order.update({where:{id:o.id},data:{expiresAt:new Date(Date.now()-60000)}});const newer=await orderService.reserve(otherId,raffleId,[10]);await service.apply({id:'payment-10',status:'approved',external_reference:o.id,transaction_amount:o.amountCents/100,currency_id:'ARS',live_mode:false});expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('NEEDS_ATTENTION');expect((await db.allocation.findUniqueOrThrow({where:{raffleId_number:{raffleId,number:10}}})).orderId).toBe(newer.id);
  });
  it('no permite borrar una rifa con compras',async()=>{await expect(db.raffle.delete({where:{id:raffleId}})).rejects.toThrow();});
  it('la base impide dos asignaciones del mismo número',async()=>{const a=await db.allocation.findFirstOrThrow({where:{raffleId}});await expect(db.allocation.create({data:{raffleId,number:a.number,orderId:a.orderId}})).rejects.toThrow();});
  it('flujo HTTP completo: reservar, transferir, adjuntar privado y aprobar como administrador',async()=>{
    const admin=await db.user.create({data:{username:'db-admin',email:'admin@example.com',fullName:'Admin Test',passwordHash:'not-used',role:'ADMIN'}});
    const apiConfig={...config,jwtSecret:'db-integration-secret-never-used-in-production',receiptDir:directory,transferHolder:'Titular ficticio de pruebas',transferAlias:'simulacion.no.transferir'};
    const app=createApp(db,apiConfig,gateway);
    const bearer=(id:string)=>jwt.sign({sub:id,version:0},apiConfig.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
    const reserved=await request(app).post('/api/orders').auth(bearer(userId),{type:'bearer'}).send({raffleId,numbers:[21,22]});expect(reserved.status).toBe(201);const orderId=reserved.body.id;
    expect((await request(app).post(`/api/orders/${orderId}/transfer`).auth(bearer(userId),{type:'bearer'})).status).toBe(200);
    const uploaded=await request(app).post(`/api/orders/${orderId}/receipt`).auth(bearer(userId),{type:'bearer'}).attach('receipt',Buffer.from('%PDF-1.7\nhttp-test'),{filename:'test.pdf',contentType:'application/pdf'});expect(uploaded.status).toBe(201);
    expect((await request(app).get(`/api/receipts/${uploaded.body.id}`).auth(bearer(otherId),{type:'bearer'})).status).toBe(403);
    expect((await request(app).get(`/api/receipts/${uploaded.body.id}`).auth(bearer(userId),{type:'bearer'})).status).toBe(200);
    expect((await request(app).post(`/api/admin/orders/${orderId}/review`).auth(bearer(userId),{type:'bearer'}).send({decision:'approve',note:'No debe permitirse'})).status).toBe(403);
    expect((await request(app).post(`/api/admin/orders/${orderId}/review`).auth(bearer(admin.id),{type:'bearer'}).send({decision:'approve',note:'Acreditación verificada en prueba.'})).status).toBe(200);
    expect((await db.order.findUniqueOrThrow({where:{id:orderId}})).status).toBe('PAID');
  });
  it('un usuario llamado admin registrado públicamente sigue siendo participante',async()=>{
    const app=createApp(db,config,gateway);const response=await request(app).post('/api/auth/register').send({username:'admin',fullName:'Prueba de permisos',email:'nombre-admin@example.com',password:'test-password-123',role:'ADMIN'});
    expect(response.status).toBe(201);expect(response.body.user.role).toBe('USER');
  });
  it('una conciliación no puede asignar un pago cuyo importe no coincide',async()=>{
    const admin=await db.user.findUniqueOrThrow({where:{username:'db-admin'}});
    const o=await orderService.reserve(userId,raffleId,[23]);const service=new PaymentsService(db,cfg,gateway);await service.checkout(userId,o.id);
    await service.apply({id:'bad-payment-23',status:'approved',external_reference:o.id,transaction_amount:1,currency_id:'ARS',live_mode:false});
    const token=jwt.sign({sub:admin.id,version:0},config.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
    const result=await request(createApp(db,config,gateway)).post(`/api/admin/orders/${o.id}/resolve`).auth(token,{type:'bearer'}).send({decision:'assign',note:'Intento de asignación de prueba.'});
    expect(result.status).toBe(409);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('NEEDS_ATTENTION');
  });
});
