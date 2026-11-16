import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient,type RaffleStatus,type OrderStatus} from './generated/prisma/client.js';
import {config} from './config.js';
import {createApp} from './app.js';
import {RefundRequestsService} from './services/refund-requests.js';
import {BuyersService} from './services/buyers.js';
import {OrdersService} from './services/orders.js';
import {PaymentsService,type PaymentGateway} from './services/payments.js';
import {PurchaseEmailWorker} from './services/purchase-emails.js';
import {cancelRaffle} from './services/raffle-lifecycle.js';
import {accountDeletionPreview} from './services/accounts.js';
import {activity} from './services/activity.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe.skipIf(process.env.RUN_DB_TESTS!=='true')('solicitudes de devolución por número y aprobación administrativa',()=>{
 const schema=`halcon_test_${randomUUID().replaceAll('-','')}`,connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
 const pool=new pg.Pool({connectionString,connectionTimeoutMillis:5000}),db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
 const cfg={...config,jwtSecret:'customer-refunds-isolated-secret-32-characters',smtpEnabled:false,mpSandbox:true,mpToken:'isolated-test-token'};
 const gateway:PaymentGateway={createPreference:async()=>{throw new Error('No external requests');},findPreference:async()=>null,getPayment:async()=>{throw new Error('No external requests');},findPayments:async()=>[]};
 const app=createApp(db,cfg,gateway),service=new RefundRequestsService(db),buyers=new BuyersService(db);
 let userId:string,otherId:string,adminId:string,prizeId:string;
 const token=(id:string)=>jwt.sign({sub:id,version:0},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
 const input=(numbers=[7],reason='Cambio de planes')=>({numbers,reason,requestId:randomUUID()});
 const approve=(id:string)=>service.review(adminId,id,{decision:'approve',note:''});
 beforeAll(async()=>{
  await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();
  try{await client.query(`SET search_path TO "${schema}"`);for(const folder of (await fs.readdir('prisma/migrations')).sort()){const sql=await fs.readFile(path.join('prisma/migrations',folder,'migration.sql'),'utf8').catch(()=>null);if(sql)await client.query(sql);}}finally{client.release();}
  userId=(await db.user.create({data:{username:'customer',email:'historico@example.com',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',dni:'12345678',passwordHash:'unused'}})).id;
  otherId=(await db.user.create({data:{username:'other',email:'other@example.com',fullName:'Otro Cliente',passwordHash:'unused'}})).id;
  adminId=(await db.user.create({data:{username:'primary',email:'primary@example.com',fullName:'Administrador',role:'ADMIN',adminType:'PRIMARY',passwordHash:'unused'}})).id;
  prizeId=(await db.prize.create({data:{name:'Premio'}})).id;
 },30000);
 afterAll(async()=>{await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema inválido');await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();},15000);
 async function purchase(){
  const raffle=await db.raffle.create({data:{title:'Rifa con devolución individual',prizeId,totalTickets:100,ticketPriceCents:12345,status:'ACTIVE'}});
  const order=await db.order.create({data:{userId,raffleId:raffle.id,numbers:[7,8,9],unitPriceCents:12345,amountCents:37035,status:'PAID',method:'TRANSFER',paidAt:new Date(),expiresAt:new Date(),buyerEmail:'historico@example.com',buyerFirstName:'Ana',buyerLastName:'Pérez',buyerDni:'12345678',allocations:{create:[7,8,9].map(number=>({raffleId:raffle.id,number}))}}});
  return {raffle,order};
 }
 it('el titular solicita números individuales; el importe es del servidor y aún no cambia su participación',async()=>{
  const {raffle,order}=await purchase();await db.raffle.update({where:{id:raffle.id},data:{ticketPriceCents:99999}});
  const result=await request(app).post(`/api/orders/${order.id}/refund-requests`).auth(token(userId),{type:'bearer'}).send({...input([9,7]),amountCents:1});
  expect(result.status).toBe(201);expect(result.body).toMatchObject({numbers:[7,9],amountCents:24690,status:'PENDING'});
  expect((await db.order.findUniqueOrThrow({where:{id:order.id}}))).toMatchObject({status:'PAID',numbers:[7,8,9],amountCents:37035,refundRequestedAt:null});
  expect(await db.allocation.count({where:{orderId:order.id}})).toBe(3);expect((await buyers.list(raffle.id)).soldNumbers).toBe(3);
  expect(await db.purchaseEmail.count({where:{orderId:order.id,kind:'REFUND_REQUEST_RECEIVED'}})).toBe(1);
 });
 it('protege autenticación, propiedad, listado administrativo y decisión',async()=>{
  const {order}=await purchase(),url=`/api/orders/${order.id}/refund-requests`;
  expect((await request(app).post(url).send(input())).status).toBe(401);expect((await request(app).post(url).auth(token(otherId),{type:'bearer'}).send(input())).status).toBe(403);
  const pending=await service.create(userId,order.id,input());
  expect((await request(app).get('/api/admin/refund-requests').auth(token(userId),{type:'bearer'})).status).toBe(403);
  expect((await request(app).post(`/api/admin/refund-requests/${pending.id}/review`).auth(token(userId),{type:'bearer'}).send({decision:'approve'})).status).toBe(403);
  expect((await request(app).get(`/api/orders/${order.id}`).auth(token(otherId),{type:'bearer'})).status).toBe(403);
  const own=await request(app).get(`/api/orders/${order.id}`).auth(token(userId),{type:'bearer'});expect(own.body.refundRequests[0]).not.toHaveProperty('requestKey');
 });
 it.each(['RESERVED','AWAITING_RECEIPT','UNDER_REVIEW','REJECTED','REFUND_PENDING','REFUNDED'] as OrderStatus[])('no solicita devolución con estado de compra %s',async status=>{
  const {order}=await purchase();await db.order.update({where:{id:order.id},data:{status}});await expect(service.create(userId,order.id,input())).rejects.toThrow('pago confirmado');
 });
 it.each(['DRAFT','CLOSING','FINISHED','CANCELLED'] as RaffleStatus[])('no solicita devolución de una rifa %s',async status=>{
  const {raffle,order}=await purchase();await db.raffle.update({where:{id:raffle.id},data:{status}});await expect(service.create(userId,order.id,input())).rejects.toThrow('activa');
 });
 it('excluye premios gratis y rifas con plazo vencido',async()=>{
  const {raffle,order}=await purchase();await db.order.update({where:{id:order.id},data:{method:'FREE_TICKET',amountCents:0,unitPriceCents:0}});await expect(service.create(userId,order.id,input())).rejects.toThrow('gratis');
  const second=await purchase();await db.raffle.update({where:{id:second.raffle.id},data:{drawAt:new Date(Date.now()-3600000)}});await expect(service.create(userId,second.order.id,input())).rejects.toThrow('activa');
 });
 it('rechaza listas vacías, repetidas o de otra compra',async()=>{
  const {order}=await purchase();for(const numbers of [[],[7,7],[99],[-1]]){const response=await request(app).post(`/api/orders/${order.id}/refund-requests`).auth(token(userId),{type:'bearer'}).send(input(numbers));expect(response.status).toBe(400);}
 });
 it('no duplica solicitudes al reintentar ni permite dos pendientes para una compra',async()=>{
  const {order}=await purchase(),body=input();const first=await service.create(userId,order.id,body);expect((await service.create(userId,order.id,body)).id).toBe(first.id);
  await expect(service.create(userId,order.id,input([8]))).rejects.toThrow('pendiente');await expect(service.create(userId,order.id,{...body,numbers:[8]})).rejects.toThrow('otros datos');
  expect(await db.refundRequest.count({where:{orderId:order.id}})).toBe(1);
 });
 it('aprobar parcialmente libera sólo lo elegido y conserva recibo, precio, resto y compra original',async()=>{
  const {raffle,order}=await purchase();await db.receipt.create({data:{orderId:order.id,storageKey:randomUUID(),mimeType:'application/pdf',size:20,sha256:'test',deleteAfter:new Date(Date.now()+86400000)}});
  const pending=await service.create(userId,order.id,input([7,9])),approved=await approve(pending.id);
  const original=await db.order.findUniqueOrThrow({where:{id:order.id}});expect(original).toMatchObject({status:'PAID',numbers:[8],amountCents:12345,originalNumbers:[7,8,9],originalAmountCents:37035});
  const part=await db.order.findUniqueOrThrow({where:{id:approved.refundOrderId!}});expect(part).toMatchObject({parentOrderId:order.id,numbers:[7,9],amountCents:24690,refundAmountCents:24690,status:'REFUND_PENDING',buyerEmail:order.buyerEmail,buyerDni:order.buyerDni});
  expect(await db.receipt.count({where:{orderId:order.id}})).toBe(1);expect((await buyers.list(raffle.id)).buyers[0]).toMatchObject({numbers:[8],amountCents:12345});
  expect((await db.order.aggregate({where:{raffleId:raffle.id,status:'PAID'},_sum:{amountCents:true}}))._sum.amountCents).toBe(12345);
  const adminActivity=await activity(db);expect(adminActivity.items.some(row=>row.description.includes('Aprobó una solicitud')&&row.context.includes('07, 09'))).toBe(true);
  const newer=await new OrdersService(db).reserve(otherId,raffle.id,[7]);await buyers.completeRefund(adminId,part.id,'Transferencia bancaria 123',24690);
  expect((await db.allocation.findUniqueOrThrow({where:{raffleId_number:{raffleId:raffle.id,number:7}}})).orderId).toBe(newer.id);expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('PAID');
 });
 it('aprobar todos los números devuelve la compra completa, sin crear una parte duplicada',async()=>{
  const {order}=await purchase(),pending=await service.create(userId,order.id,input([7,8,9])),approved=await approve(pending.id);
  expect(approved.refundOrderId).toBe(order.id);expect((await db.order.findUniqueOrThrow({where:{id:order.id}}))).toMatchObject({status:'REFUND_PENDING',refundAmountCents:37035});expect(await db.order.count({where:{parentOrderId:order.id}})).toBe(0);
 });
 it('permite otra solicitud sobre el resto, sin devolver más que el pago original',async()=>{
  const {order}=await purchase();const a=await service.create(userId,order.id,input([7]));const first=await approve(a.id);const b=await service.create(userId,order.id,input([8,9]));const second=await approve(b.id);
  const refunds=await db.order.findMany({where:{id:{in:[first.refundOrderId!,second.refundOrderId!]}}});expect(refunds.reduce((sum,o)=>sum+(o.refundAmountCents||0),0)).toBe(37035);expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).originalAmountCents).toBe(37035);
 });
 it('rechazar exige un motivo, conserva los números y permite una nueva solicitud',async()=>{
  const {order}=await purchase(),pending=await service.create(userId,order.id,input());
  expect((await request(app).post(`/api/admin/refund-requests/${pending.id}/review`).auth(token(adminId),{type:'bearer'}).send({decision:'reject',note:''})).status).toBe(400);
  await service.review(adminId,pending.id,{decision:'reject',note:'No corresponde por el motivo indicado.'});expect(await db.allocation.count({where:{orderId:order.id}})).toBe(3);expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('PAID');expect(await db.purchaseEmail.count({where:{orderId:order.id,kind:'REFUND_REQUEST_REJECTED'}})).toBe(1);expect((await service.create(userId,order.id,input([8]))).status).toBe('PENDING');
 });
 it('dos aprobaciones simultáneas crean una sola devolución',async()=>{
  const {order}=await purchase(),pending=await service.create(userId,order.id,input());const result=await Promise.allSettled([approve(pending.id),approve(pending.id)]);
  expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await db.order.count({where:{parentOrderId:order.id}})).toBe(1);expect(await db.purchaseEmail.count({where:{orderId:order.id,kind:'REFUND_REQUEST_APPROVED'}})).toBe(1);
 });
 it('dos solicitudes simultáneas no reservan dos devoluciones de los mismos números',async()=>{
  const {order}=await purchase();await Promise.allSettled([service.create(userId,order.id,input()),service.create(userId,order.id,input())]);expect(await db.refundRequest.count({where:{orderId:order.id,status:'PENDING'}})).toBe(1);
 });
 it('revalida la rifa al aprobar y permite rechazar después del cierre',async()=>{
  const {raffle,order}=await purchase(),pending=await service.create(userId,order.id,input());await db.raffle.update({where:{id:raffle.id},data:{status:'CLOSING'}});await expect(approve(pending.id)).rejects.toThrow('activa');expect(await db.allocation.count({where:{orderId:order.id}})).toBe(3);await service.review(adminId,pending.id,{decision:'reject',note:'La rifa ya se encuentra cerrada.'});
 });
 it('una cancelación administrativa reemplaza la solicitud por la devolución total',async()=>{
  const {raffle,order}=await purchase(),pending=await service.create(userId,order.id,input());await cancelRaffle(db,adminId,raffle.id);expect((await db.refundRequest.findUniqueOrThrow({where:{id:pending.id}})).status).toBe('CANCELLED');expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).refundAmountCents).toBe(37035);await expect(approve(pending.id)).rejects.toThrow('revisada');
 });
 it('el pago original de Mercado Pago sigue conciliando después de una devolución parcial',async()=>{
  const {order}=await purchase();await db.order.update({where:{id:order.id},data:{method:'MERCADO_PAGO',paymentId:`mp-${order.id}`}});const pending=await service.create(userId,order.id,input()),approved=await approve(pending.id);
  const payments=new PaymentsService(db,cfg,gateway),payment={id:`mp-${order.id}`,external_reference:order.id,status:'approved',currency_id:'ARS',transaction_amount:370.35,live_mode:false};await payments.apply(payment);
  expect((await db.order.findUniqueOrThrow({where:{id:order.id}}))).toMatchObject({status:'PAID',numbers:[8,9],amountCents:24690});
  await payments.apply({...payment,status:'refunded'});expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('REFUNDED');expect((await db.order.findUniqueOrThrow({where:{id:approved.refundOrderId!}})).status).toBe('REFUNDED');
 });
 it('un comprador desactivado puede recibir aprobación y no se elimina con solicitudes pendientes',async()=>{
  const target=await db.user.create({data:{username:'deactivated',email:'deactivated@example.com',fullName:'Cuenta',passwordHash:'unused'}}),{raffle,order}=await purchase();await db.order.update({where:{id:order.id},data:{userId:target.id}});
  const pending=await service.create(target.id,order.id,input());await db.user.update({where:{id:target.id},data:{active:false}});expect((await approve(pending.id)).status).toBe('APPROVED');
  const another=await service.create(userId,(await purchase()).order.id,input());await db.raffle.update({where:{id:(await db.order.findUniqueOrThrow({where:{id:another.orderId}})).raffleId},data:{status:'FINISHED'}});expect((await accountDeletionPreview(db,adminId,userId)).canDelete).toBe(false);
 });
 it('envía recepción, aprobación y rechazo por solicitud con importes exactos y destinatario histórico simulado',async()=>{
  const {order}=await purchase(),pending=await service.create(userId,order.id,input());const messages:{to:string;text:string;html:string;messageId:string}[]=[];
  const worker=new PurchaseEmailWorker(db,{...cfg,smtpEnabled:true,smtpHost:'smtp.example.invalid',smtpFrom:'sender@example.com'},{sendMail:async message=>{messages.push(message);}});
  await worker.process(1000);expect(messages.some(m=>m.messageId.includes(pending.id)&&m.text.includes('123,45')&&m.text.includes('siguen participando')&&m.to==='historico@example.com')).toBe(true);
  await approve(pending.id);await worker.process(1000);expect(messages.filter(m=>m.messageId.includes(pending.id))).toHaveLength(2);
  const other=await service.create(userId,order.id,input([8]));await service.review(adminId,other.id,{decision:'reject',note:'Revisar <datos> del motivo.'});await worker.process(1000);
  const rejected=messages.find(m=>m.messageId.includes(other.id)&&m.text.includes('rechazada'));expect(rejected?.html).toContain('&lt;datos&gt;');expect(rejected?.html).not.toContain('<datos>');expect(new Set(messages.map(m=>m.messageId)).size).toBe(messages.length);
 });
});
