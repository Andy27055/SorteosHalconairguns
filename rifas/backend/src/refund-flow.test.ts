import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';
import { createApp } from './app.js';
import { OrdersService } from './services/orders.js';
import { ReceiptsService } from './services/receipts.js';
import { BuyersService,buyersWorkbook } from './services/buyers.js';
import { PaymentsService,type PaymentGateway } from './services/payments.js';
import { PurchaseEmailWorker,notificationMessage } from './services/purchase-emails.js';
import ExcelJS from 'exceljs';

describe.skipIf(process.env.RUN_DB_TESTS!=='true')('baja, rechazo, reembolso y notificaciones transaccionales',()=>{
  const schema=`halcon_test_${randomUUID().replaceAll('-','')}`;const connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
  const pool=new pg.Pool({connectionString,connectionTimeoutMillis:5000});const db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
  const cfg={...config,jwtSecret:'refund-test-secret-not-for-production',mpToken:'test-token',mpWebhookSecret:'test-secret',apiUrl:'https://api.test.invalid',mpSandbox:true,smtpEnabled:false};
  const gateway:PaymentGateway={createPreference:async()=>({id:randomUUID(),init_point:'https://www.mercadopago.com.ar/test',sandbox_init_point:'https://sandbox.mercadopago.com.ar/test'}),findPreference:async()=>null,getPayment:async()=>{throw new Error('Sin consultas reales');},findPayments:async()=>[]};
  const app=createApp(db,cfg,gateway);const orders=new OrdersService(db);const receipts=new ReceiptsService(db,'not-used');const buyers=new BuyersService(db);const payments=new PaymentsService(db,cfg,gateway);
  let userId:string,otherId:string,adminId:string,prizeId:string;
  const token=(id:string)=>jwt.sign({sub:id,version:0},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
  beforeAll(async()=>{
    await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();try{await client.query(`SET search_path TO "${schema}"`);for(const dir of (await fs.readdir('prisma/migrations')).sort()){const sql=await fs.readFile(path.join('prisma/migrations',dir,'migration.sql'),'utf8').catch(()=>null);if(sql)await client.query(sql);}}finally{client.release();}
    userId=(await db.user.create({data:{username:'refund-buyer',email:'original@example.com',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',dni:'01234567',passwordHash:'not-used'}})).id;
    otherId=(await db.user.create({data:{username:'other',email:'other@example.com',fullName:'Otro Cliente',firstName:'Otro',lastName:'Cliente',dni:'23456789',passwordHash:'not-used'}})).id;
    adminId=(await db.user.create({data:{username:'admin',email:'admin@example.com',fullName:'Admin',role:'ADMIN',passwordHash:'not-used'}})).id;
    prizeId=(await db.prize.create({data:{name:'Premio de prueba'}})).id;
  },30000);
  afterAll(async()=>{await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema inválido');await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();});
  const raffle=async()=>db.raffle.create({data:{title:'Rifa de prueba',prizeId,ticketPriceCents:500000,totalTickets:100,status:'ACTIVE'}});
  async function transfer(raffleId:string,numbers:number[],paid=true){const o=await orders.reserve(userId,raffleId,numbers);await orders.startTransfer(userId,o.id);await db.order.update({where:{id:o.id},data:{status:'UNDER_REVIEW'}});await db.receipt.create({data:{orderId:o.id,storageKey:randomUUID(),mimeType:'application/pdf',size:20,sha256:'test',deleteAfter:new Date(Date.now()+86400000)}});if(paid)await receipts.review(adminId,o.id,'approve','Acreditación verificada para prueba.');return o;}
  const removal=async(raffleId:string)=>{const b=(await buyers.list(raffleId)).buyers[0];return{anchorOrderId:b.id,version:b.version,confirmation:'CONFIRMAR'};};
  it('sólo al aprobar se incorpora a compradores y los números nunca se venden dos veces',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1,2],false);expect((await buyers.list(r.id)).buyers).toHaveLength(0);await expect(orders.reserve(otherId,r.id,[1])).rejects.toThrow();
    await receipts.review(adminId,o.id,'approve','Acreditación bancaria verificada.');const list=await buyers.list(r.id);expect(list.buyers[0].numbers).toEqual([1,2]);const availability=await request(app).get(`/api/raffles/${r.id}/availability`);expect(availability.body).toEqual([{number:1,status:'PAID'},{number:2,status:'PAID'}]);
  });
  it('exige administrador y la palabra CONFIRMAR exacta en el servidor',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1]);const body=await removal(r.id);const url=`/api/admin/raffles/${r.id}/buyers/remove`;
    expect((await request(app).post(url).send(body)).status).toBe(401);expect((await request(app).post(url).auth(token(userId),{type:'bearer'}).send(body)).status).toBe(403);
    for(const confirmation of ['', 'confirmar',' CONFIRMAR '])expect((await request(app).post(url).auth(token(adminId),{type:'bearer'}).send({...body,confirmation})).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('PAID');
  });
  it('la baja agrupa compras, conserva el historial, libera números y los quita del Excel',async()=>{
    const r=await raffle();const a=await transfer(r.id,[1,2]);const b=await transfer(r.id,[3]);const body=await removal(r.id);
    await request(app).post(`/api/admin/raffles/${r.id}/buyers/remove`).auth(token(adminId),{type:'bearer'}).send(body).expect(200);
    const list=await buyers.list(r.id);expect(list.buyers).toHaveLength(0);expect(list.soldNumbers).toBe(0);expect(await db.order.count({where:{id:{in:[a.id,b.id]},status:'REFUND_PENDING'}})).toBe(2);expect(await db.allocation.count({where:{raffleId:r.id}})).toBe(0);
    const book=new ExcelJS.Workbook();await book.xlsx.load(await buyersWorkbook(list.raffle.title,list.buyers));expect(book.worksheets[0].rowCount).toBe(1);
    expect(await db.purchaseEmail.count({where:{orderId:{in:[a.id,b.id]},kind:'REFUND_REQUESTED'}})).toBe(2);await orders.reserve(otherId,r.id,[1]);expect((await buyers.pendingRefunds(r.id))).toHaveLength(2);
  });
  it('rechaza una baja si los datos cambiaron desde que se abrió la ventana',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1]);const body=await removal(r.id);await db.order.update({where:{id:o.id},data:{buyerDni:'87654321'}});
    expect((await request(app).post(`/api/admin/raffles/${r.id}/buyers/remove`).auth(token(adminId),{type:'bearer'}).send(body)).status).toBe(409);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('PAID');
  });
  it('dos bajas simultáneas no duplican avisos ni la devolución pendiente',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1]);const b=await removal(r.id);const results=await Promise.allSettled([buyers.remove(adminId,r.id,b.anchorOrderId,b.version),buyers.remove(adminId,r.id,b.anchorOrderId,b.version)]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(await db.purchaseEmail.count({where:{orderId:o.id,kind:'REFUND_REQUESTED'}})).toBe(1);
  });
  it('un webhook de aprobación repetido no revive una compra dada de baja ni quita números revendidos',async()=>{
    const r=await raffle();const o=await orders.reserve(userId,r.id,[1]);await payments.checkout(userId,o.id);const payment={id:'refund-mp',status:'approved',external_reference:o.id,transaction_amount:o.amountCents/100,currency_id:'ARS',live_mode:false};await payments.apply(payment);
    const b=await removal(r.id);await buyers.remove(adminId,r.id,b.anchorOrderId,b.version);const newer=await orders.reserve(otherId,r.id,[1]);await payments.apply(payment);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('REFUND_PENDING');
    await payments.apply({...payment,id:'another-payment',status:'refunded'});expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('REFUND_PENDING');await payments.apply({...payment,status:'refunded'});await payments.apply(payment);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).status).toBe('REFUNDED');expect((await db.allocation.findUniqueOrThrow({where:{raffleId_number:{raffleId:r.id,number:1}}})).orderId).toBe(newer.id);
  });
  it('registrar una devolución exige referencia e importe y emite una sola confirmación',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1]);const b=await removal(r.id);await buyers.remove(adminId,r.id,b.anchorOrderId,b.version);const url=`/api/admin/orders/${o.id}/refund-complete`;const body={confirmation:'CONFIRMAR',reference:'Transferencia devuelta referencia 123',amountCents:o.amountCents};
    expect((await request(app).post(url).auth(token(userId),{type:'bearer'}).send(body)).status).toBe(403);expect((await request(app).post(url).auth(token(adminId),{type:'bearer'}).send({...body,amountCents:1})).status).toBe(400);
    await request(app).post(url).auth(token(adminId),{type:'bearer'}).send(body).expect(200);expect((await buyers.pendingRefunds(r.id))).toHaveLength(0);expect(await db.purchaseEmail.count({where:{orderId:o.id,kind:'REFUND_COMPLETED'}})).toBe(1);
    expect((await request(app).post(url).auth(token(adminId),{type:'bearer'}).send(body)).status).toBe(409);
  });
  it('monto incorrecto registra rechazo y devolución pendiente sin inventar cuánto recibió el banco',async()=>{
    const r=await raffle();const o=await transfer(r.id,[1],false);await receipts.review(adminId,o.id,'reject','El importe transferido es incorrecto.','INCORRECT_AMOUNT');const stored=await db.order.findUniqueOrThrow({where:{id:o.id}});expect(stored.status).toBe('REJECTED');expect(stored.refundRequestedAt).not.toBeNull();expect(stored.refundAmountCents).toBeNull();
    const job=await db.purchaseEmail.findFirstOrThrow({where:{orderId:o.id,kind:'PURCHASE_REJECTED'}});const message=notificationMessage(job.kind,job.payload,cfg.frontendUrl);expect(message.text).toContain('24 a 48 horas');expect((await buyers.pendingRefunds(r.id))).toHaveLength(1);
    await buyers.completeRefund(adminId,o.id,'Devolución del monto realmente recibido',300000);expect((await db.order.findUniqueOrThrow({where:{id:o.id}})).refundAmountCents).toBe(300000);
  });
  it('datos incorrectos y pago no realizado notifican el motivo sin prometer reembolsos inexistentes',async()=>{
    for(const code of ['INCORRECT_DETAILS','PAYMENT_NOT_MADE']){const r=await raffle();const o=await transfer(r.id,[1],false);await receipts.review(adminId,o.id,'reject',`Motivo confirmado: ${code}`,code);const stored=await db.order.findUniqueOrThrow({where:{id:o.id}});expect(stored.refundRequestedAt).toBeNull();expect((await buyers.pendingRefunds(r.id))).toHaveLength(0);const job=await db.purchaseEmail.findFirstOrThrow({where:{orderId:o.id}});expect(notificationMessage(job.kind,job.payload,cfg.frontendUrl).text).not.toContain('24 a');}
  });
  it('preserva las asignaciones y el resultado si el sorteo ya fue realizado',async()=>{
    const r=await raffle();await transfer(r.id,[1]);await db.raffle.update({where:{id:r.id},data:{status:'FINISHED',drawnAt:new Date(),winnerNumber:1}});const b=await removal(r.id);await buyers.remove(adminId,r.id,b.anchorOrderId,b.version);expect(await db.allocation.count({where:{raffleId:r.id}})).toBe(1);expect((await db.raffle.findUniqueOrThrow({where:{id:r.id}})).winnerNumber).toBe(1);await expect(orders.reserve(otherId,r.id,[1])).rejects.toThrow();
  });
  it('no da de baja otra identidad del mismo usuario sin mostrarla en la confirmación',async()=>{
    const r=await raffle();const old=await transfer(r.id,[1]);await db.user.update({where:{id:userId},data:{firstName:'Nombre nuevo'}});const newer=await transfer(r.id,[2]);const list=await buyers.list(r.id);expect(list.buyers).toHaveLength(2);const target=list.buyers.find(b=>b.id===old.id)!;await buyers.remove(adminId,r.id,target.id,target.version);expect((await db.order.findUniqueOrThrow({where:{id:newer.id}})).status).toBe('PAID');
  });
  it('el emisor simulado envía tipos distintos con destinatarios históricos y sin duplicarlos',async()=>{
    const r=await raffle();await transfer(r.id,[1]);const rejected=await transfer(r.id,[2],false);await receipts.review(adminId,rejected.id,'reject','Motivo de rechazo de prueba.');const removed=await transfer(r.id,[3]);const list=await buyers.list(r.id);const buyer=list.buyers[0];await buyers.remove(adminId,r.id,buyer.id,buyer.version);
    await db.user.update({where:{id:userId},data:{email:'new@example.com'}});const messages:{to:string;text:string;messageId:string;subject:string}[]=[];const sender={sendMail:async(message:typeof messages[number])=>{messages.push(message);}};const mailCfg={...cfg,smtpEnabled:true,smtpHost:'smtp.test.invalid',smtpFrom:'sender@example.com'};
    await Promise.all([new PurchaseEmailWorker(db,mailCfg,sender).process(1000),new PurchaseEmailWorker(db,mailCfg,sender).process(1000)]);expect(new Set(messages.map(m=>m.messageId)).size).toBe(messages.length);expect(messages.every(m=>m.to==='original@example.com')).toBe(true);expect(messages.some(m=>m.subject.includes('rechazada'))).toBe(true);expect(messages.some(m=>m.text.includes('24 a 72 horas hábiles'))).toBe(true);expect(messages.some(m=>m.subject.includes('Reembolso registrado'))).toBe(true);expect((await db.order.findUniqueOrThrow({where:{id:removed.id}})).status).toBe('REFUND_PENDING');
  });
});
