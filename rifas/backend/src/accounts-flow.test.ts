import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient,type OrderStatus,type RaffleStatus} from './generated/prisma/client.js';
import {config} from './config.js';
import {createApp} from './app.js';
import {BuyersService,buyersWorkbook} from './services/buyers.js';
import {OrdersService} from './services/orders.js';
import {accountDeletionPreview,deleteAccount} from './services/accounts.js';
import {activity,recordActivity} from './services/activity.js';
import ExcelJS from 'exceljs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe.skipIf(process.env.RUN_DB_TESTS!=='true')('gestión de cuentas e historial (PostgreSQL aislado)',()=>{
 const schema=`halcon_test_${randomUUID().replaceAll('-','')}`;
 const connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
 const pool=new pg.Pool({connectionString,connectionTimeoutMillis:5000});
 const db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
 const cfg={...config,jwtSecret:'isolated-account-management-secret-32-characters',smtpEnabled:false};
 const app=createApp(db,cfg);
 let primaryId:string,functionalId:string,clientId:string,prizeId:string;
 const token=(id:string)=>jwt.sign({sub:id,version:0},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
 const account=()=>db.user.create({data:{username:`u${randomUUID().slice(0,18)}`,email:`${randomUUID()}@example.com`,fullName:'Nombre Histórico',firstName:'Nombre',lastName:'Histórico',dni:'12345678',passwordHash:'unused'}});
 const raffle=(status:RaffleStatus='ACTIVE')=>db.raffle.create({data:{title:'Rifa histórica',prizeId,totalTickets:100,ticketPriceCents:10000,status}});
 const order=(userId:string,raffleId:string,status:OrderStatus='PAID')=>db.order.create({data:{userId,raffleId,numbers:[37],unitPriceCents:10000,amountCents:10000,status,expiresAt:new Date(Date.now()+3600000),allocations:{create:{raffleId,number:37}}}});
 const remove=(id:string,actor=primaryId,confirmation='CONFIRMAR')=>request(app).delete(`/api/admin/users/${id}/permanent`).auth(token(actor),{type:'bearer'}).send({confirmation});
 beforeAll(async()=>{
  await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();
  try{await client.query(`SET search_path TO "${schema}"`);for(const folder of (await fs.readdir('prisma/migrations')).sort()){const sql=await fs.readFile(path.join('prisma/migrations',folder,'migration.sql'),'utf8').catch(()=>null);if(sql)await client.query(sql);}}finally{client.release();}
  primaryId=(await db.user.create({data:{username:'primary',email:'primary@example.com',fullName:'Principal',role:'ADMIN',adminType:'PRIMARY',passwordHash:'unused'}})).id;
  functionalId=(await db.user.create({data:{username:'functional',email:'functional@example.com',fullName:'Funcional',role:'ADMIN',adminType:'FUNCTIONAL',passwordHash:'unused'}})).id;
  clientId=(await account()).id;prizeId=(await db.prize.create({data:{name:'Premio'}})).id;
 },30000);
 afterAll(async()=>{await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema inválido');await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();},15000);

 it.each(['USER','ADMIN'])('el principal crea %s sin exponer la contraseña ni permitir otro principal',async role=>{
  const email=`${randomUUID()}@example.com`,username=`u${randomUUID().slice(0,12)}`,password='ClaveDePrueba2026';
  const result=await request(app).post('/api/admin/users').auth(token(primaryId),{type:'bearer'}).send({firstName:'Cuenta',lastName:'Nueva',username,email,password,role,adminType:'PRIMARY',sendVerification:true});
  expect(result.status).toBe(201);expect(result.body).not.toHaveProperty('password');expect(result.body).not.toHaveProperty('passwordHash');expect(result.body.role).toBe(role);expect(result.body.adminType).toBe(role==='ADMIN'?'FUNCTIONAL':null);
  const saved=await db.user.findUniqueOrThrow({where:{id:result.body.id}});expect(await bcrypt.compare(password,saved.passwordHash)).toBe(true);expect(await db.emailVerification.count({where:{userId:saved.id,status:'PENDING'}})).toBe(1);
  expect((await request(app).post('/api/auth/login').send({login:username,password})).status).toBe(200);
 });
 it('rechaza altas inválidas y correos duplicados; conserva permisos funcionales anteriores',async()=>{
  const payload={firstName:'Nombre',lastName:'Apellido',username:'nueva-cuenta',email:'primary@example.com',password:'ClaveDePrueba2026'};
  expect((await request(app).post('/api/admin/users').auth(token(primaryId),{type:'bearer'}).send({...payload,password:'corta'})).status).toBe(400);
  expect((await request(app).post('/api/admin/users').auth(token(primaryId),{type:'bearer'}).send(payload)).status).toBe(409);
  expect((await request(app).post('/api/admin/users').auth(token(functionalId),{type:'bearer'}).send({...payload,role:'ADMIN'})).status).toBe(403);
  expect((await request(app).post('/api/admin/users').auth(token(clientId),{type:'bearer'}).send(payload)).status).toBe(403);
  expect((await request(app).post('/api/admin/users').send(payload)).status).toBe(401);
  const created=await request(app).post('/api/admin/users').auth(token(functionalId),{type:'bearer'}).send({...payload,email:'functional-client@example.com'});expect(created.status).toBe(201);expect(await db.emailVerification.count({where:{userId:created.body.id}})).toBe(0);
 });
 it('sólo el principal puede consultar o ejecutar la eliminación definitiva y debe escribir CONFIRMAR',async()=>{
  const target=await account();
  for(const actor of [functionalId,clientId]){expect((await remove(target.id,actor)).status).toBe(403);expect((await request(app).get(`/api/admin/users/${target.id}/deletion-preview`).auth(token(actor),{type:'bearer'})).status).toBe(403);}
  expect((await request(app).delete(`/api/admin/users/${target.id}/permanent`).send({confirmation:'CONFIRMAR'})).status).toBe(401);
  expect((await remove(target.id,primaryId,'confirmar')).status).toBe(400);expect(await db.user.findUnique({where:{id:target.id}})).not.toBeNull();
  expect((await remove(primaryId)).status).toBe(409);expect((await request(app).get(`/api/admin/users/${primaryId}/deletion-preview`).auth(token(primaryId),{type:'bearer'})).status).toBe(409);
 });
 it('borra la cuenta y verificaciones, invalida sesiones y permite reutilizar usuario y correo',async()=>{
  const target=await account();await db.emailVerification.create({data:{userId:target.id,email:target.email,expiresAt:new Date(Date.now()+3600000)}});
  expect((await remove(target.id)).status).toBe(200);expect(await db.user.findUnique({where:{id:target.id}})).toBeNull();expect(await db.emailVerification.count({where:{userId:target.id}})).toBe(0);
  expect((await request(app).get('/api/auth/me').auth(token(target.id),{type:'bearer'})).status).toBe(401);
  expect(await db.auditLog.count({where:{entityId:target.id,action:'ACCOUNT_DELETED',actorId:primaryId,actorRole:'ADMIN'}})).toBe(1);
  const recreated=await db.user.create({data:{username:target.username,email:target.email,fullName:'Otra cuenta',passwordHash:'unused'}});expect(recreated.id).not.toBe(target.id);
 });
 it.each(['RESERVED','PAYMENT_PENDING','AWAITING_RECEIPT','UNDER_REVIEW','NEEDS_ATTENTION','REFUND_PENDING'] as OrderStatus[])('impide borrar con gestión pendiente %s, pero permite desactivar',async status=>{
  const target=await account(),r=await raffle('CANCELLED');const purchase=await order(target.id,r.id,status);
  expect((await accountDeletionPreview(db,primaryId,target.id)).canDelete).toBe(false);expect((await remove(target.id)).status).toBe(409);
  expect((await request(app).delete(`/api/admin/users/${target.id}`).auth(token(primaryId),{type:'bearer'})).status).toBe(200);
  expect((await db.user.findUniqueOrThrow({where:{id:target.id}})).active).toBe(false);expect((await db.order.findUniqueOrThrow({where:{id:purchase.id}})).userId).toBe(target.id);
 });
 it.each(['DRAFT','ACTIVE','CLOSING'] as RaffleStatus[])('impide borrar un comprador confirmado mientras su rifa está %s',async status=>{
  const target=await account(),r=await raffle(status);await order(target.id,r.id);expect((await remove(target.id)).status).toBe(409);
 });
 it('también protege reembolsos pendientes en compras rechazadas y números gratis sin usar',async()=>{
  const target=await account(),r=await raffle('CANCELLED');const purchase=await order(target.id,r.id,'REJECTED');await db.order.update({where:{id:purchase.id},data:{refundRequestedAt:new Date()}});
  expect((await remove(target.id)).status).toBe(409);await db.order.update({where:{id:purchase.id},data:{refundCompletedAt:new Date()}});
  const benefit=await db.freeTicketBenefit.create({data:{userId:target.id,quantity:2,remaining:1,grantedBy:primaryId,grantKey:randomUUID()}});
  expect((await remove(target.id)).status).toBe(409);await db.freeTicketBenefit.update({where:{id:benefit.id},data:{revokedAt:new Date()}});expect((await remove(target.id)).status).toBe(200);expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:benefit.id}})).userId).toBeNull();
 });
 it('conserva comprador, números, ganador, correos, beneficios usados y Excel al borrar una cuenta histórica',async()=>{
  const target=await account(),r=await raffle('FINISHED');const purchase=await order(target.id,r.id);
  await db.raffle.update({where:{id:r.id},data:{winnerOrderId:purchase.id,winnerDisplayName:'Nombre H.',winnerNumber:37}});
  const award=await db.raffleAward.create({data:{raffleId:r.id,rank:1,winnerOrderId:purchase.id,winnerDisplayName:'Nombre H.',winningNumber:37}});
  const benefit=await db.freeTicketBenefit.create({data:{userId:target.id,quantity:1,remaining:0,grantedBy:primaryId,grantKey:randomUUID(),uses:{create:{orderId:purchase.id,quantity:1}}}});
  await db.purchaseEmail.create({data:{orderId:purchase.id,eventKey:randomUUID(),toEmail:target.email,payload:{name:target.fullName},status:'SENT'}});
  const result=await remove(target.id);expect(result.status).toBe(200);
  const historical=await db.order.findUniqueOrThrow({where:{id:purchase.id}});expect(historical).toMatchObject({userId:null,buyerEmail:target.email,buyerFirstName:target.firstName,buyerLastName:target.lastName,buyerDni:target.dni,numbers:[37],amountCents:10000,status:'PAID'});
  expect(await db.allocation.count({where:{orderId:purchase.id}})).toBe(1);expect(await db.purchaseEmail.count({where:{orderId:purchase.id}})).toBe(1);expect(await db.freeTicketUse.count({where:{benefitId:benefit.id}})).toBe(1);expect((await db.raffleAward.findUniqueOrThrow({where:{id:award.id}})).winnerOrderId).toBe(purchase.id);
  const buyers=await new BuyersService(db).list(r.id);expect(buyers.buyers[0]).toMatchObject({email:target.email,firstName:target.firstName,lastName:target.lastName,dni:target.dni,numbers:[37]});
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await buyersWorkbook(r.title,buyers.buyers,2));expect(workbook.worksheets[0].getCell('A2').value).toBe(target.email);expect(workbook.worksheets[0].getCell('E2').value).toBe('37');
 });
 it('no reemplaza la identidad original de una compra aunque el perfil haya cambiado',async()=>{
  const target=await account(),r=await raffle('FINISHED');const purchase=await order(target.id,r.id);await db.order.update({where:{id:purchase.id},data:{buyerEmail:'original@example.com',buyerFirstName:'Original',buyerLastName:'Comprador',buyerDni:'87654321'}});
  expect((await remove(target.id)).status).toBe(200);expect((await new BuyersService(db).list(r.id)).buyers[0]).toMatchObject({email:'original@example.com',firstName:'Original',lastName:'Comprador',dni:'87654321'});
 });
 it('revisa el estado otra vez al confirmar y no confía en la vista previa',async()=>{
  const target=await account(),r=await raffle();expect((await accountDeletionPreview(db,primaryId,target.id)).canDelete).toBe(true);await order(target.id,r.id);expect((await remove(target.id)).status).toBe(409);
 });
 it('conserva la atribución de las acciones del administrador eliminado',async()=>{
  const target=await account();await db.user.update({where:{id:target.id},data:{role:'ADMIN',adminType:'FUNCTIONAL'}});
  await recordActivity(db,{data:{actorId:target.id,action:'PRIZE_CREATED',entityId:prizeId,detail:{name:'Premio registrado'}}});
  expect((await remove(target.id)).status).toBe(200);expect((await activity(db)).items.some(row=>row.actor===target.fullName&&row.description==='Creó un premio')).toBe(true);
 });
 it('una reserva simultánea y una eliminación nunca dejan una compra activa sin cuenta',async()=>{
  const target=await account(),r=await raffle();await Promise.allSettled([deleteAccount(db,primaryId,target.id),new OrdersService(db).reserve(target.id,r.id,[37])]);
  const saved=await db.user.findUnique({where:{id:target.id}}),purchases=await db.order.findMany({where:{raffleId:r.id}});
  if(!saved)expect(purchases).toHaveLength(0);else expect(purchases[0]?.userId).toBe(target.id);
 });
});
