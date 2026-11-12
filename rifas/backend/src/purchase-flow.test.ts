import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';
import { createApp } from './app.js';
import { GuestReservationsService } from './services/guest-reservations.js';
import { OrdersService } from './services/orders.js';
import { PaymentsService, type PaymentGateway } from './services/payments.js';
import { ReceiptsService } from './services/receipts.js';
import { BuyersService } from './services/buyers.js';
import { PurchaseEmailWorker } from './services/purchase-emails.js';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('reservas visitantes, compradores Excel y cola de correos (PostgreSQL)',()=>{
  const schema=`halcon_test_${randomUUID().replaceAll('-','')}`;
  const connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
  const pool=new pg.Pool({connectionString,connectionTimeoutMillis:5000});const db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
  const receiptDir=path.join(os.tmpdir(),schema);
  const cfg={...config,jwtSecret:'guest-integration-secret-not-used-in-production',frontendUrl:'http://localhost:5173',apiUrl:'https://api.test.invalid',mpToken:'test-token',mpWebhookSecret:'test-secret',mpSandbox:true,smtpEnabled:false,receiptDir,transferHolder:'Titular de prueba',transferAlias:'solo.pruebas',transferCbu:'',transferHolder2:'Segundo titular de prueba',transferAlias2:'segunda.solo.pruebas',transferCbu2:''};
  const gateway:PaymentGateway={createPreference:async()=>({id:randomUUID(),init_point:'https://www.mercadopago.com.ar/checkout/test',sandbox_init_point:'https://sandbox.mercadopago.com.ar/checkout/test'}),findPreference:async()=>null,getPayment:async()=>{throw new Error('No se llama al proveedor real');},findPayments:async()=>[]};
  const guests=new GuestReservationsService(db);const orders=new OrdersService(db);const payments=new PaymentsService(db,cfg,gateway);
  const app=createApp(db,cfg,gateway);let userId:string,otherId:string,adminId:string,raffleId:string;let paidId:string;
  const token=(id:string)=>jwt.sign({sub:id,version:0},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
  beforeAll(async()=>{
    await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();try{await client.query(`SET search_path TO "${schema}"`);for(const dir of (await fs.readdir('prisma/migrations')).sort()){const sql=await fs.readFile(path.join('prisma/migrations',dir,'migration.sql'),'utf8').catch(()=>null);if(sql)await client.query(sql);}}finally{client.release();}
    userId=(await db.user.create({data:{username:'buyer',email:'ana@example.com',firstName:'Ana',lastName:'Pérez',fullName:'Ana Pérez',dni:'01234567',passwordHash:await bcrypt.hash('test-password-123',4)}})).id;
    otherId=(await db.user.create({data:{username:'other',email:'other@example.com',fullName:'Otro usuario',passwordHash:'not-used'}})).id;
    adminId=(await db.user.create({data:{username:'admin',email:'admin@example.com',fullName:'Administrador',passwordHash:'not-used',role:'ADMIN'}})).id;
    const prize=await db.prize.create({data:{name:'Premio'}});raffleId=(await db.raffle.create({data:{title:'Rifa de prueba',prizeId:prize.id,totalTickets:100,ticketPriceCents:500000,status:'ACTIVE'}})).id;
  },30000);
  afterAll(async()=>{await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema inválido');await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();if(path.dirname(path.resolve(receiptDir))!==path.resolve(os.tmpdir())||path.basename(receiptDir)!==schema)throw new Error('Directorio inválido');await fs.rm(receiptDir,{recursive:true,force:true});});
  it('dos visitantes no reservan el mismo número',async()=>{
    const results=await Promise.allSettled([guests.reserve(hash('a'),hash('client-a'),raffleId,[1]),guests.reserve(hash('b'),hash('client-b'),raffleId,[1])]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  it('al reclamar se conserva la compra y no se vuelven a elegir números',async()=>{
    const order=await guests.reserve(hash('c'),hash('client-c'),raffleId,[2,3]);
    await expect(orders.reserve(otherId,raffleId,[2])).rejects.toThrow();
    const claimed=await guests.claim(hash('c'),userId);expect(claimed?.id).toBe(order.id);expect(claimed?.numbers).toEqual([2,3]);
    expect((await guests.claim(hash('c'),userId))?.id).toBe(order.id);await expect(guests.claim(hash('c'),otherId)).rejects.toThrow('otra cuenta');
    expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).userId).toBe(userId);
  });
  it('cookie privada conserva la reserva durante un login real',async()=>{
    const agent=request.agent(app);const reserved=await agent.post('/api/guest-reservations').set('Origin',cfg.frontendUrl).send({raffleId,numbers:[4,5]});expect(reserved.status).toBe(201);expect(String(reserved.headers['set-cookie'])).toContain('HttpOnly');expect(reserved.body.reservation).not.toHaveProperty('guestTokenHash');
    const login=await agent.post('/api/auth/login').set('Origin',cfg.frontendUrl).send({login:'buyer',password:'test-password-123'});expect(login.status).toBe(200);
    const claim=await agent.post('/api/guest-reservations/claim').set('Origin',cfg.frontendUrl);expect(claim.status).toBe(200);expect(claim.body.order.id).toBe(reserved.body.reservation.id);expect(claim.body.order.numbers).toEqual([4,5]);
    expect((await agent.get(`/api/orders/${claim.body.order.id}`)).status).toBe(200);
  });
  it('también conserva la reserva al crear una cuenta',async()=>{
    const agent=request.agent(app);const r=await agent.post('/api/guest-reservations').set('Origin',cfg.frontendUrl).send({raffleId,numbers:[6]});
    const registration=await agent.post('/api/auth/register').set('Origin',cfg.frontendUrl).send({username:'new-buyer',firstName:'Nuevo',lastName:'Cliente',email:'new@example.com',password:'test-password-123',dni:'23456789'});expect(registration.status).toBe(201);expect(registration.body.user.firstName).toBe('Nuevo');
    const claim=await agent.post('/api/guest-reservations/claim').set('Origin',cfg.frontendUrl);expect(claim.body.order.id).toBe(r.body.reservation.id);
  });
  it('una reserva vencida libera el número y no puede reclamarse',async()=>{
    const r=await guests.reserve(hash('expired'),hash('expired-client'),raffleId,[7]);await db.order.update({where:{id:r.id},data:{expiresAt:new Date(Date.now()-1000)}});
    const availability=await request(app).get(`/api/raffles/${raffleId}/availability`);expect(availability.body.some((n:{number:number})=>n.number===7)).toBe(false);await expect(guests.claim(hash('expired'),userId)).rejects.toThrow('venció');
  });
  it('los reintentos no duplican ni extienden el plazo de visitante',async()=>{
    const a=await guests.reserve(hash('retry'),hash('retry-client'),raffleId,[8]);const b=await guests.reserve(hash('retry'),hash('retry-client'),raffleId,[8]);expect(a.id).toBe(b.id);expect(a.expiresAt.getTime()).toBe(b.expiresAt.getTime());
  });
  it('cancelar visitante libera sus números',async()=>{await guests.reserve(hash('cancel'),hash('cancel-client'),raffleId,[9]);await guests.cancel(hash('cancel'));expect(await db.allocation.count({where:{raffleId,number:9}})).toBe(0);});
  it('el pago exige datos completos de comprador',async()=>{const r=await orders.reserve(otherId,raffleId,[59]);await expect(payments.checkout(otherId,r.id)).rejects.toThrow('nombre, apellido');});
  it('permite elegir la segunda cuenta y conserva el destino para cargar y revisar el comprobante',async()=>{
    const settings=await request(app).get('/api/config');expect(settings.body.transferAccounts).toHaveLength(2);expect(settings.body.transfer).toBe(true);
    const order=await orders.reserve(userId,raffleId,[70]);
    const bad=await request(app).post(`/api/orders/${order.id}/transfer`).auth(token(userId),{type:'bearer'}).send({accountId:'no-existe'});expect(bad.status).toBe(400);
    const started=await request(app).post(`/api/orders/${order.id}/transfer`).auth(token(userId),{type:'bearer'}).send({accountId:'secondary'});expect(started.status).toBe(200);expect(started.body.transferHolder).toBe('Segundo titular de prueba');expect(started.body.transferAlias).toBe('segunda.solo.pruebas');
    const original=cfg.transferAlias2;cfg.transferAlias2='alias.actualizado.pruebas';
    try {const repeated=await request(app).post(`/api/orders/${order.id}/transfer`).auth(token(userId),{type:'bearer'}).send({accountId:'secondary'});expect(repeated.body.transferAlias).toBe(original);expect(repeated.body.expiresAt).toBe(started.body.expiresAt);} finally {cfg.transferAlias2=original;}
    const changed=await request(app).post(`/api/orders/${order.id}/transfer`).auth(token(userId),{type:'bearer'}).send({accountId:'primary'});expect(changed.status).toBe(409);
    const uploaded=await request(app).post(`/api/orders/${order.id}/receipt`).auth(token(userId),{type:'bearer'}).attach('receipt',Buffer.from('%PDF-1.7\narchivo de prueba'),{filename:'prueba.pdf',contentType:'application/pdf'});expect(uploaded.status).toBe(201);
    expect((await request(app).get(`/api/receipts/${uploaded.body.id}`).auth(token(otherId),{type:'bearer'})).status).toBe(403);
    const adminOrder=await request(app).get(`/api/orders/${order.id}`).auth(token(adminId),{type:'bearer'});expect(adminOrder.body.transferAccountId).toBe('secondary');expect(adminOrder.body.status).toBe('UNDER_REVIEW');
    await request(app).post(`/api/admin/orders/${order.id}/review`).auth(token(adminId),{type:'bearer'}).send({decision:'reject',note:'Rechazo simulado; no se transfirió dinero.'}).expect(200);
  });
  it('confirmación Mercado Pago guarda identidad y una única notificación',async()=>{
    const r=await orders.reserve(userId,raffleId,[60,61]);paidId=r.id;await payments.checkout(userId,r.id);expect(await db.purchaseEmail.count({where:{orderId:r.id}})).toBe(0);
    const payment={id:'payment-confirmed',status:'approved',external_reference:r.id,transaction_amount:r.amountCents/100,currency_id:'ARS',live_mode:false};await payments.apply(payment);await payments.apply(payment);
    const stored=await db.order.findUniqueOrThrow({where:{id:r.id}});expect(stored.buyerFirstName).toBe('Ana');expect(stored.buyerLastName).toBe('Pérez');expect(stored.buyerDni).toBe('01234567');expect(await db.purchaseEmail.count({where:{orderId:r.id}})).toBe(1);
  });
  it('aprobación de transferencia también genera confirmación y agrupa números del comprador',async()=>{
    const r=await orders.reserve(userId,raffleId,[63]);await orders.startTransfer(userId,r.id);await db.order.update({where:{id:r.id},data:{status:'UNDER_REVIEW'}});await db.receipt.create({data:{orderId:r.id,storageKey:randomUUID(),mimeType:'application/pdf',size:10,sha256:'hash-test',deleteAfter:new Date(Date.now()+86400000)}});
    await new ReceiptsService(db,'not-used').review(adminId,r.id,'approve','Acreditación verificada en prueba.');
    expect(await db.purchaseEmail.count({where:{orderId:r.id}})).toBe(1);const list=await new BuyersService(db).list(raffleId);expect(list.buyers).toHaveLength(1);expect(list.buyers[0].numbers).toEqual([60,61,63]);
  });
  it('no confirma moneda o entorno incorrectos, ni pagos sin información del entorno',async()=>{
    for(const [number,changes] of [[71,{currency_id:'USD'}],[72,{live_mode:true}],[73,{live_mode:undefined}]] as const){
      const r=await orders.reserve(userId,raffleId,[number]);await payments.checkout(userId,r.id);
      await payments.apply({id:`payment-invalid-${number}`,status:'approved',external_reference:r.id,transaction_amount:r.amountCents/100,currency_id:'ARS',live_mode:false,...changes});
      expect((await db.order.findUniqueOrThrow({where:{id:r.id}})).status).toBe('NEEDS_ATTENTION');expect(await db.purchaseEmail.count({where:{orderId:r.id}})).toBe(0);
    }
  });
  it('otro intento de pago no desconfirma una compra ya acreditada',async()=>{
    await payments.apply({id:'different-invalid-attempt',status:'rejected',external_reference:paidId,transaction_amount:0.01,currency_id:'ARS',live_mode:false});
    expect((await db.order.findUniqueOrThrow({where:{id:paidId}})).status).toBe('PAID');
  });
  it('cambiar el perfil no reescribe los datos históricos de la venta',async()=>{
    await db.user.update({where:{id:userId},data:{firstName:'Nombre actualizado',email:'updated@example.com'}});const list=await new BuyersService(db).list(raffleId);expect(list.buyers[0].firstName).toBe('Ana');expect(list.buyers[0].email).toBe('ana@example.com');
  });
  it('recuperar un checkout interrumpido conserva la identidad original',async()=>{
    const r=await orders.reserve(userId,raffleId,[65]);await payments.checkout(userId,r.id);
    await db.order.update({where:{id:r.id},data:{checkoutUrl:null,paymentCreatingAt:new Date(Date.now()-60000)}});
    await db.user.update({where:{id:userId},data:{firstName:'Otro nombre',email:'another@example.com'}});
    await payments.checkout(userId,r.id);
    const stored=await db.order.findUniqueOrThrow({where:{id:r.id}});expect(stored.buyerFirstName).toBe('Nombre actualizado');expect(stored.buyerEmail).toBe('updated@example.com');
  });
  it('sólo un administrador puede ver compradores o descargar el Excel',async()=>{
    expect((await request(app).get(`/api/admin/raffles/${raffleId}/buyers`)).status).toBe(401);
    expect((await request(app).get(`/api/admin/raffles/${raffleId}/buyers.xlsx`).auth(token(userId),{type:'bearer'})).status).toBe(403);
    const response=await request(app).get(`/api/admin/raffles/${raffleId}/buyers.xlsx`).auth(token(adminId),{type:'bearer'}).buffer(true).parse((res,callback)=>{const chunks:Buffer[]=[];res.on('data',(c:Buffer)=>chunks.push(c));res.on('end',()=>callback(null,Buffer.concat(chunks)));});
    expect(response.status).toBe(200);expect(response.headers['content-type']).toContain('spreadsheetml');const book=new ExcelJS.Workbook();await book.xlsx.load(response.body);expect(book.worksheets[0].getCell('D2').value).toBe('01234567');expect(book.worksheets[0].getCell('E2').value).toBe('60, 61, 63');
  });
  it('sin SMTP no marca correos como enviados',async()=>{expect((await new PurchaseEmailWorker(db,cfg,{sendMail:async()=>{throw new Error('No debe enviar');}}).process()).enabled).toBe(false);expect((await db.purchaseEmail.findFirstOrThrow({where:{orderId:paidId}})).status).toBe('PENDING');});
  it('dos trabajadores no duplican los correos y usan la dirección guardada al comprar',async()=>{
    const pending=await db.purchaseEmail.count({where:{status:'PENDING'}});
    const messages:{to:string;text:string;messageId:string}[]=[];const sender={sendMail:async(message:{to:string;text:string;messageId:string})=>{messages.push(message);}};
    const mailCfg={...cfg,smtpEnabled:true,smtpHost:'smtp.test.invalid',smtpFrom:'compras@example.com'};
    await Promise.all([new PurchaseEmailWorker(db,mailCfg,sender).process(),new PurchaseEmailWorker(db,mailCfg,sender).process()]);
    expect(messages).toHaveLength(pending);expect(new Set(messages.map(m=>m.messageId)).size).toBe(pending);expect(messages.every(m=>m.to==='ana@example.com')).toBe(true);expect(messages.some(m=>m.text.includes('60, 61'))).toBe(true);expect((await db.purchaseEmail.findFirstOrThrow({where:{orderId:paidId}})).status).toBe('SENT');
  });
  it('un fallo SMTP conserva la compra y permite reintentar el mensaje',async()=>{
    const r=await orders.reserve(userId,raffleId,[64]);await payments.checkout(userId,r.id);await payments.apply({id:'payment-retry',status:'approved',external_reference:r.id,transaction_amount:r.amountCents/100,currency_id:'ARS',live_mode:false});
    const mailCfg={...cfg,smtpEnabled:true,smtpHost:'smtp.test.invalid',smtpFrom:'compras@example.com'};
    await new PurchaseEmailWorker(db,mailCfg,{sendMail:async()=>{throw Object.assign(new Error('fallo simulado'),{code:'ETIMEDOUT'});}}).process();
    let job=await db.purchaseEmail.findFirstOrThrow({where:{orderId:r.id}});expect(job.status).toBe('PENDING');expect(job.attempts).toBe(1);expect((await db.order.findUniqueOrThrow({where:{id:r.id}})).status).toBe('PAID');
    await db.purchaseEmail.update({where:{id:job.id},data:{nextAttemptAt:new Date(Date.now()-1000)}});await new PurchaseEmailWorker(db,mailCfg,{sendMail:async()=>{}}).process();job=await db.purchaseEmail.findUniqueOrThrow({where:{id:job.id}});expect(job.status).toBe('SENT');expect(job.attempts).toBe(2);
  });
});
