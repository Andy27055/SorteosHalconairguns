import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from './generated/prisma/client.js';
import {config} from './config.js';
import {createApp} from './app.js';
import {LotteryService,LOTTERY_URL} from './services/lottery.js';
import {notificationMessage,PurchaseEmailWorker} from './services/purchase-emails.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {BuyersService} from './services/buyers.js';

describe.skipIf(process.env.RUN_DB_TESTS!=='true')('varios premios y puestos oficiales (PostgreSQL aislado)',()=>{
 const schema=`halcon_test_${randomUUID().replaceAll('-','')}`,connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
 const pool=new pg.Pool({connectionString});const db=new PrismaClient({adapter:new PrismaPg({connectionString},{schema})});
 const cfg={...config,smtpEnabled:false,jwtSecret:'awards-test-secret-not-used-in-production'};
 const app=createApp(db,cfg),now=new Date('2026-11-15T00:30:00Z');
 let adminId:string,userId:string,p1:string,p2:string,legacyId:string;
 const token=(id:string)=>jwt.sign({sub:id,version:0},cfg.jwtSecret,{issuer:'halcon-airguns',audience:'halcon-web',algorithm:'HS256',expiresIn:'1h'});
 beforeAll(async()=>{
  // The real calendar can be Sunday; the award scenarios run on a working draw day.
  vi.useFakeTimers({toFake:['Date'],shouldAdvanceTime:true,advanceTimeDelta:1});vi.setSystemTime(new Date('2026-11-16T18:00:00Z'));
  await pool.query(`CREATE SCHEMA "${schema}"`);const client=await pool.connect();
  try{await client.query(`SET search_path TO "${schema}"`);for(const folder of (await fs.readdir('prisma/migrations')).sort()){
   const sql=await fs.readFile(path.join('prisma/migrations',folder,'migration.sql'),'utf8').catch(()=>null);if(!sql)continue;
   if(folder==='202611140001_multiple_awards'){
    // Seed the historical schema directly: the current Prisma client knows columns added later.
    legacyId='legacy-before-multi';
    await client.query('INSERT INTO "Prize" (id,name,description) VALUES ($1,$2,$3)',['legacy-prize','Premio anterior','Descripción histórica']);
    await client.query('INSERT INTO "User" (id,username,email,"fullName","passwordHash") VALUES ($1,$2,$3,$4,$5)',['legacy-user','legacy','legacy@example.invalid','Ganador anterior','unused']);
    await client.query('INSERT INTO "Raffle" (id,title,"prizeId","totalTickets","ticketPriceCents",status,"winnerNumber","winnerDisplayName","winnerOrderId","lotteryResult") VALUES ($1,$2,$3,100,100,\'FINISHED\',37,$4,$5,$6)',[legacyId,'Rifa anterior','legacy-prize','Ganador A.','legacy-order',JSON.stringify({head:'5737'})]);
    await client.query('INSERT INTO "Order" (id,"userId","raffleId",numbers,"unitPriceCents","amountCents",status,"expiresAt","updatedAt") VALUES ($1,$2,$3,ARRAY[37],100,100,\'PAID\',$4,$4)',['legacy-order','legacy-user',legacyId,now]);
   }
   await client.query(sql);
  }}finally{client.release();}
  adminId=(await db.user.create({data:{username:'admin-awards',email:'admin@example.invalid',fullName:'Admin',role:'ADMIN',adminType:'FUNCTIONAL',passwordHash:'unused'}})).id;
  userId=(await db.user.create({data:{username:'buyer-awards',email:'ana@example.com',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',dni:'12345678',passwordHash:'unused'}})).id;
  p1=(await db.prize.create({data:{name:'Rifle',description:'Original'}})).id;p2=(await db.prize.create({data:{name:'Mira',description:'Accesorio'}})).id;
 },30000);
 beforeEach(async()=>{await db.lotteryDraw.deleteMany();});
 afterAll(async()=>{await db.$disconnect();if(!/^halcon_test_[a-f0-9]{32}$/.test(schema))throw Error('Esquema inválido');await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();vi.useRealTimers();},15000);
 const awards=()=>[{rank:1,prizes:[{prizeId:p1,quantity:1},{prizeId:p2,quantity:2}]},{rank:2,prizes:[{prizeId:p1,quantity:1}]}];
 const body=()=>({title:'Rifa con premios',prizeId:p1,totalTickets:100,ticketPriceCents:10000,lotteryDigits:2,status:'ACTIVE',awards:awards()});
 async function create(){const response=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send(body());expect(response.status).toBe(201);return response.body;}
 const paid=(id:string,numbers:number[])=>db.order.create({data:{userId,raffleId:id,numbers,unitPriceCents:10000,amountCents:10000*numbers.length,status:'PAID',paidAt:now,expiresAt:now,buyerEmail:'ana@example.com',buyerFirstName:'Ana',buyerLastName:'Pérez',allocations:{create:numbers.map(number=>({raffleId:id,number}))}}});
 const source=(numbers=['5737','1245'])=>async(day:string)=>({date:day,head:numbers[0],numbers:Array.from({length:20},(_,i)=>numbers[i]||'0000'),drawNumber:'12915',sourceUrl:LOTTERY_URL,sourceSha256:'a'.repeat(64),checkedAt:now.toISOString(),extract:''});
 it('la migración conserva el premio y ganador de rifas anteriores',async()=>{
  const raffle=await db.raffle.findUniqueOrThrow({where:{id:legacyId},include:{awards:{include:{prizes:true}}}});
  expect(raffle.awards).toHaveLength(1);expect(raffle.awards[0].winningNumber).toBe(37);expect(raffle.awards[0].winnerOrderId).toBe(raffle.winnerOrderId);expect(raffle.awards[0].prizes[0].name).toBe('Premio anterior');
 });
 it.each([[100,2,37],[1000,3,237],[10000,4,1237]])('calcula las cifras al crear y cierra %i números con resultado 1237',async(totalTickets,digits,number)=>{
  const {lotteryDigits:_ignored,...input}=body();
  const response=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send({...input,totalTickets});
  expect(response.status).toBe(201);expect(response.body.lotteryDigits).toBe(digits);expect(response.body.numberStart).toBe(0);
  const order=await paid(response.body.id,[number,7]);
  const result=await new LotteryService(db,source(['1237','0007'])).finish(adminId,response.body.id,now);
  expect(result.status).toBe('FINISHED');
  const slots=await db.raffleAward.findMany({where:{raffleId:result.id},orderBy:{rank:'asc'}});
  expect(slots.map(a=>a.winningNumber)).toEqual([number,7]);expect(slots.map(a=>a.officialNumber)).toEqual(['1237','0007']);
  const email=await db.purchaseEmail.findFirstOrThrow({where:{orderId:order.id,kind:'RAFFLE_WINNER'}});
  expect(notificationMessage('RAFFLE_WINNER',email.payload,'https://test.invalid').text).toContain(String(7).padStart(digits,'0'));
 });
 it('conserva pendiente un resultado fuera del rango sin aplicar un módulo a la cantidad',async()=>{
  const {lotteryDigits:_ignored,...input}=body();
  const response=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send({...input,totalTickets:150});
  expect(response.status).toBe(201);await paid(response.body.id,[87,7]);
  const result=await new LotteryService(db,source(['1237','0007'])).finish(adminId,response.body.id,now);
  expect(result.status).toBe('CLOSING');expect(result.closingNote).toContain('237');expect(result.winnerNumber).toBeNull();
 });
 it('reutiliza premios entre puestos, conserva cantidades y fija sus descripciones',async()=>{
  const r=await create();expect(r.awards[0].prizes).toHaveLength(2);expect(r.awards[1].prizes[0].prizeId).toBe(p1);
  await db.prize.update({where:{id:p2},data:{name:'Mira editada'}});
  const publicRaffle=await request(app).get(`/api/raffles/${r.id}`);expect(publicRaffle.body.awards[0].prizes.some((p:{name:string;quantity:number})=>p.name==='Mira'&&p.quantity===2)).toBe(true);
  await expect(db.prize.delete({where:{id:p2}})).rejects.toThrow();await db.prize.update({where:{id:p2},data:{name:'Mira'}});
 });
 it('un ganador recibe varios premios y puestos aunque se repita el mismo número oficial',async()=>{
  const r=await create(),order=await paid(r.id,[37]);
  const result=await new LotteryService(db,source(['5737','1237'])).finish(adminId,r.id,now);
  expect(result.status).toBe('FINISHED');
  const slots=await db.raffleAward.findMany({where:{raffleId:r.id},orderBy:{rank:'asc'}});expect(slots.map(a=>a.winnerOrderId)).toEqual([order.id,order.id]);expect(slots.map(a=>a.winningNumber)).toEqual([37,37]);
  const emails=await db.purchaseEmail.findMany({where:{orderId:order.id,kind:'RAFFLE_WINNER'}});expect(emails).toHaveLength(1);
  const message=notificationMessage('RAFFLE_WINNER',emails[0].payload,'https://test.invalid');expect(message.text).toContain('1.º puesto');expect(message.text).toContain('2.º puesto');expect(message.text).toContain('2 × Mira');
  const adminEmail=await db.raffleEmail.findFirstOrThrow({where:{raffleId:r.id,kind:'RAFFLE_RESULT_ADMIN'}});expect(JSON.stringify(adminEmail.payload)).toContain('Mira');
  await new LotteryService(db,source()).finish(adminId,r.id,now);expect(await db.purchaseEmail.count({where:{orderId:order.id,kind:'RAFFLE_WINNER'}})).toBe(1);
 });
 it('la misma persona puede ganar con compras distintas y los datos públicos siguen enmascarados',async()=>{
  const r=await create(),a=await paid(r.id,[37]),b=await paid(r.id,[45]);await new LotteryService(db,source()).finish(adminId,r.id,now);
  const publicRaffle=(await request(app).get(`/api/raffles/${r.id}`)).body;
  expect(publicRaffle.awards.map((p:{winnerDisplayName:string})=>p.winnerDisplayName)).toEqual(['Ana P.','Ana P.']);
  expect(JSON.stringify(publicRaffle)).not.toContain('ana@example.com');expect(publicRaffle).not.toHaveProperty('winnerOrderId');expect(publicRaffle.awards.every((p:object)=>!Object.hasOwn(p,'winnerOrderId'))).toBe(true);
  const owned=(await request(app).get(`/api/orders/${a.id}`).auth(token(userId),{type:'bearer'})).body;expect(owned.raffle.awards.every((p:object)=>!Object.hasOwn(p,'winnerOrderId'))).toBe(true);
  expect(await db.purchaseEmail.count({where:{orderId:{in:[a.id,b.id]},kind:'RAFFLE_WINNER'}})).toBe(2);
 });
 it('un puesto sin vender no publica ni envía resultados parciales',async()=>{
  const r=await create();await paid(r.id,[37]);const service=new LotteryService(db,source());
  expect((await service.finish(adminId,r.id,now)).status).toBe('CLOSING');
  expect((await db.raffleAward.findMany({where:{raffleId:r.id}})).every(a=>a.winnerOrderId===null)).toBe(true);
  expect(await db.purchaseEmail.count({where:{order:{raffleId:r.id},kind:'RAFFLE_WINNER'}})).toBe(0);
  await paid(r.id,[45]);expect((await service.resolve(r.id,now)).status).toBe('FINISHED');
 });
 it('dos cierres simultáneos conservan todos los puestos y no duplican avisos',async()=>{
  const r=await create(),order=await paid(r.id,[37,45]);
  const result=await Promise.allSettled([new LotteryService(db,source()).finish(adminId,r.id,now),new LotteryService(db,source()).finish(adminId,r.id,now)]);
  expect(result.some(r=>r.status==='fulfilled')).toBe(true);
  expect((await db.raffle.findUniqueOrThrow({where:{id:r.id}})).status).toBe('FINISHED');
  expect(await db.raffleAward.count({where:{raffleId:r.id,winnerOrderId:order.id}})).toBe(2);
  expect(await db.purchaseEmail.count({where:{orderId:order.id,kind:'RAFFLE_WINNER'}})).toBe(1);
  expect(await db.raffleEmail.count({where:{raffleId:r.id,kind:'RAFFLE_RESULT_ADMIN'}})).toBe(1);
 });
 it('los premios se pueden editar antes de reservas y se congelan desde la primera',async()=>{
  const r=await create();const changed={...body(),awards:[{rank:1,prizes:[{prizeId:p1,quantity:2}]},{rank:2,prizes:[{prizeId:p2,quantity:1}]}]};
  expect((await request(app).put(`/api/admin/raffles/${r.id}`).auth(token(adminId),{type:'bearer'}).send(changed)).status).toBe(200);
  expect((await request(app).post('/api/orders').auth(token(userId),{type:'bearer'}).send({raffleId:r.id,numbers:[10]})).status).toBe(201);
  expect((await request(app).put(`/api/admin/raffles/${r.id}`).auth(token(adminId),{type:'bearer'}).send(body())).status).toBe(409);
  expect((await request(app).put(`/api/admin/raffles/${r.id}`).auth(token(adminId),{type:'bearer'}).send({...changed,title:'Título corregido'})).status).toBe(200);
 });
 it('no acepta premios inexistentes ni concede creación a clientes',async()=>{
  const before=await db.raffle.count();
  const invalid={...body(),awards:[{rank:1,prizes:[{prizeId:p1,quantity:1},{prizeId:'missing',quantity:1}]}]};
  expect((await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send(invalid)).status).toBe(400);
  expect(await db.raffle.count()).toBe(before);
  expect((await request(app).post('/api/admin/raffles').auth(token(userId),{type:'bearer'}).send(body())).status).toBe(403);
 });
 async function freeWinner(quantity=1){
  const owner=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.com`,firstName:'Ana',lastName:'Pérez',fullName:'Ana Pérez',dni:'12345678',passwordHash:'unused'}});
  const prize=await request(app).post('/api/admin/prizes').auth(token(adminId),{type:'bearer'}).send({name:'Número gratis',kind:'FREE_TICKET'});expect(prize.status).toBe(201);
  const input={...body(),awards:[{rank:1,prizes:[{prizeId:prize.body.id,quantity}]}],prizeId:prize.body.id};
  const response=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send(input);expect(response.status).toBe(201);
  const order=await paid(response.body.id,[37]);await db.order.update({where:{id:order.id},data:{userId:owner.id,buyerEmail:owner.email}});
  // Editing the catalog must not change an already offered free ticket.
  await db.prize.update({where:{id:prize.body.id},data:{kind:'ITEM'}});
  const closed=await new LotteryService(db,source(['5737'])).finish(adminId,response.body.id,new Date());expect(closed.status).toBe('FINISHED');
  const benefit=await db.freeTicketBenefit.findFirstOrThrow({where:{userId:owner.id}});
  return {owner,benefit,source:response.body.id,orderId:order.id};
 }
 async function reserveFor(owner:string,raffleId:string,numbers:number[]){const r=await request(app).post('/api/orders').auth(token(owner),{type:'bearer'}).send({raffleId,numbers});expect(r.status).toBe(201);return r.body;}
 const redeem=(owner:string,id:string)=>request(app).post(`/api/orders/${id}/free-tickets`).auth(token(owner),{type:'bearer'});
 it('entrega el beneficio una sola vez y lo fija a la primera rifa que se activa',async()=>{
  const draftInput={...body(),status:'DRAFT'},draft=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send(draftInput);
  const earlier=await create();
  const won=await freeWinner(2);expect(won.benefit.quantity).toBe(2);expect(won.benefit.targetRaffleId).toBeNull();
  await new LotteryService(db,source()).finish(adminId,won.source,new Date());expect(await db.freeTicketBenefit.count({where:{userId:won.owner.id}})).toBe(1);
  expect((await request(app).put(`/api/admin/raffles/${draft.body.id}`).auth(token(adminId),{type:'bearer'}).send({...draftInput,status:'ACTIVE'})).status).toBe(200);
  const other=await create();
  const eligible=(await request(app).get('/api/free-tickets').auth(token(won.owner.id),{type:'bearer'})).body[0].availableRaffles.map((r:{id:string})=>r.id);
  expect(eligible).toContain(draft.body.id);expect(eligible).not.toContain(other.id);expect(eligible).not.toContain(earlier.id);
  const wrong=await reserveFor(won.owner.id,earlier.id,[9]);expect((await redeem(won.owner.id,wrong.id)).status).toBe(409);
  const notNext=await reserveFor(won.owner.id,other.id,[10]);expect((await redeem(won.owner.id,notNext.id)).status).toBe(409);
  const order=await reserveFor(won.owner.id,draft.body.id,[7,8]);expect((await redeem(userId,order.id)).status).toBe(403);
  expect((await request(app).get('/api/free-tickets')).status).toBe(401);
  const privateList=await request(app).get('/api/free-tickets').auth(token(userId),{type:'bearer'});expect(privateList.body.some((b:{id:string})=>b.id===won.benefit.id)).toBe(false);
  expect((await redeem(won.owner.id,order.id)).body).toMatchObject({status:'PAID',method:'FREE_TICKET',amountCents:0,unitPriceCents:0});
  expect((await redeem(won.owner.id,order.id)).status).toBe(200);expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}})).remaining).toBe(0);
  expect(await db.freeTicketUse.count({where:{orderId:order.id}})).toBe(1);expect(await db.allocation.count({where:{orderId:order.id}})).toBe(2);
  const buyers=await new BuyersService(db).list(draft.body.id);expect(buyers.buyers[0]).toMatchObject({numbers:[7,8],amountCents:0});
  const email=await db.purchaseEmail.findFirstOrThrow({where:{orderId:order.id,kind:'PURCHASE_CONFIRMED'}});expect(notificationMessage('PURCHASE_CONFIRMED',email.payload,'https://test.invalid').text).toContain('Importe a pagar: $0');
  const winnerEmail=await db.purchaseEmail.findFirstOrThrow({where:{orderId:won.orderId,kind:'RAFFLE_WINNER'}});expect(notificationMessage('RAFFLE_WINNER',winnerEmail.payload,'https://test.invalid').text).toContain('USAR NÚMEROS GRATIS');
  const adminRaffles=await request(app).get('/api/admin/raffles').auth(token(adminId),{type:'bearer'});expect(adminRaffles.body.find((r:{id:string})=>r.id===draft.body.id).revenueCents).toBe(0);
 });
 it('dos canjes simultáneos no gastan dos veces el mismo premio',async()=>{
  const won=await freeWinner(),target=await create(),other=await create(),a=await reserveFor(won.owner.id,target.id,[20]),b=await reserveFor(won.owner.id,target.id,[21]);
  const responses=await Promise.all([redeem(won.owner.id,a.id),redeem(won.owner.id,b.id)]);expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  expect(await db.order.count({where:{id:{in:[a.id,b.id]},status:'PAID'}})).toBe(1);expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}})).remaining).toBe(0);
 });
 it('no consume el premio con datos incompletos, saldo insuficiente o una reserva vencida',async()=>{
  const won=await freeWinner(),target=await create(),many=await reserveFor(won.owner.id,target.id,[30,31]);
  expect((await redeem(won.owner.id,many.id)).status).toBe(409);
  const one=await reserveFor(won.owner.id,target.id,[32]);await db.user.update({where:{id:won.owner.id},data:{dni:null}});
  expect((await redeem(won.owner.id,one.id)).status).toBe(400);await db.user.update({where:{id:won.owner.id},data:{dni:'12345678'}});
  await db.order.update({where:{id:one.id},data:{expiresAt:new Date(Date.now()-1000)}});expect((await redeem(won.owner.id,one.id)).status).toBe(409);
  expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}})).remaining).toBe(1);
  expect(await db.freeTicketUse.count({where:{benefitId:won.benefit.id}})).toBe(0);
 });
 it('dar de baja una participación gratis restituye el premio sin generar un reembolso',async()=>{
  const won=await freeWinner(),target=await create(),order=await reserveFor(won.owner.id,target.id,[40]);expect((await redeem(won.owner.id,order.id)).status).toBe(200);
  const service=new BuyersService(db),buyer=(await service.list(target.id)).buyers[0];await service.remove(adminId,target.id,buyer.id!,buyer.version!);
  expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('CANCELLED');expect(await db.allocation.count({where:{orderId:order.id}})).toBe(0);
  expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}})).remaining).toBe(1);expect(await service.pendingRefunds(target.id)).toHaveLength(0);
  await expect(service.remove(adminId,target.id,buyer.id!,buyer.version!)).rejects.toThrow();
  const messages:{subject:string;text:string}[]=[];
  await new PurchaseEmailWorker(db,{...cfg,smtpEnabled:true,smtpHost:'test.invalid',smtpFrom:'compras@example.com'},{sendMail:async message=>{messages.push(message);}}).process(500);
  expect(messages.some(m=>m.subject.startsWith('Participación gratuita anulada')&&m.text.includes(order.id)&&m.text.includes('no corresponde un reembolso de dinero'))).toBe(true);
  expect((await db.purchaseEmail.findFirstOrThrow({where:{orderId:order.id,kind:'PURCHASE_CONFIRMED'}})).status).toBe('SKIPPED');
 });
 it('cancelar la próxima rifa restituye el premio y permite elegir en su reemplazo',async()=>{
  const won=await freeWinner(),target=await create(),order=await reserveFor(won.owner.id,target.id,[50]);await redeem(won.owner.id,order.id);
  expect((await request(app).delete(`/api/admin/raffles/${target.id}`).auth(token(adminId),{type:'bearer'}).send({})).body.refundsPending).toBe(0);
  expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}}))).toMatchObject({remaining:1,targetRaffleId:null,revokedAt:null});
  const next=await create();
  const again=await reserveFor(won.owner.id,next.id,[51]);expect((await redeem(won.owner.id,again.id)).status).toBe(200);
 });
 it('cancelar la rifa de origen revoca los premios pendientes de canje',async()=>{
  const won=await freeWinner(),target=await create();await request(app).delete(`/api/admin/raffles/${won.source}`).auth(token(adminId),{type:'bearer'}).send({});
  const order=await reserveFor(won.owner.id,target.id,[60]);expect((await redeem(won.owner.id,order.id)).status).toBe(409);
  expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}})).revokedAt).not.toBeNull();
 });
 it('el premio no pasa a rifas posteriores si se deja cerrar la siguiente',async()=>{
  const won=await freeWinner(2),next=await create();await db.raffle.update({where:{id:next.id},data:{status:'FINISHED',drawnAt:new Date()}});
  const other=await create(),order=await reserveFor(won.owner.id,other.id,[70]);expect((await redeem(won.owner.id,order.id)).status).toBe(409);
  const benefit=await db.freeTicketBenefit.findUniqueOrThrow({where:{id:won.benefit.id}});expect(benefit.remaining).toBe(2);expect(benefit.targetRaffleId).toBe(next.id);
 });
 it.each(['DRAFT','ACTIVE'])('entrega manual fija a una rifa %s y no permite canjear en otras',async status=>{
  const owner=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.com`,fullName:'Cliente manual',firstName:'Cliente',lastName:'Manual',dni:'12345678',passwordHash:'unused'}});
  const targetResponse=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send({...body(),status});expect(targetResponse.status).toBe(201);const target=targetResponse.body;
  const input={quantity:2,targetRaffleId:target.id,reason:'Premio manual',requestId:randomUUID()},endpoint=`/api/admin/users/${owner.id}/free-tickets`;
  const granted=await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send(input);expect(granted.status).toBe(201);
  expect((await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send(input)).body.id).toBe(granted.body.id);expect(await db.freeTicketBenefit.count({where:{userId:owner.id}})).toBe(1);
  const list=(await request(app).get('/api/free-tickets').auth(token(owner.id),{type:'bearer'})).body;expect(list[0]).toMatchObject({sourceRaffle:null,targetRaffle:{id:target.id,status},available:status==='ACTIVE'});
  if(status==='DRAFT')expect((await request(app).post(`/api/admin/raffles/${target.id}/activate`).auth(token(adminId),{type:'bearer'})).status).toBe(200);
  const reserved=await reserveFor(owner.id,target.id,[80]);expect((await redeem(owner.id,reserved.id)).status).toBe(200);
  const other=await create(),later=await reserveFor(owner.id,other.id,[81]);expect((await redeem(owner.id,later.id)).status).toBe(409);
  expect((await request(app).post(endpoint).auth(token(userId),{type:'bearer'}).send({...input,requestId:randomUUID()})).status).toBe(403);
  expect((await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send({quantity:1,requestId:randomUUID()})).status).toBe(400);
  await db.raffle.update({where:{id:other.id},data:{status:'CLOSING'}});expect((await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send({...input,targetRaffleId:other.id,requestId:randomUUID()})).status).toBe(409);
  expect(await db.auditLog.count({where:{action:'FREE_TICKETS_GRANTED_MANUALLY',entityId:owner.id}})).toBe(1);
 });
 it('asigna saldo manual anterior sin duplicarlo ni alterar los canjes registrados',async()=>{
  const owner=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.com`,fullName:'Cliente',firstName:'Ana',lastName:'Perez',dni:'12345678',passwordHash:'unused'}}),first=await create();
  const granted=await request(app).post(`/api/admin/users/${owner.id}/free-tickets`).auth(token(adminId),{type:'bearer'}).send({quantity:2,targetRaffleId:first.id,requestId:randomUUID()});expect(granted.status).toBe(201);
  const used=await reserveFor(owner.id,first.id,[82]);expect((await redeem(owner.id,used.id)).status).toBe(200);await db.freeTicketBenefit.update({where:{id:granted.body.id},data:{targetRaffleId:null}});
  const next=await create(),endpoint=`/api/admin/users/${owner.id}/free-tickets/${granted.body.id}/target`;
  expect((await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send({targetRaffleId:next.id})).status).toBe(200);
  expect((await request(app).post(endpoint).auth(token(adminId),{type:'bearer'}).send({targetRaffleId:next.id})).status).toBe(200);
  expect(await db.freeTicketBenefit.count({where:{userId:owner.id}})).toBe(1);expect((await db.freeTicketBenefit.findUniqueOrThrow({where:{id:granted.body.id}})).remaining).toBe(1);
  expect((await db.order.findUniqueOrThrow({where:{id:used.id}})).status).toBe('PAID');const order=await reserveFor(owner.id,next.id,[83]);expect((await redeem(owner.id,order.id)).status).toBe(200);
 });
 it('crea diez números del 0 al 9 y determina el ganador con la última cifra',async()=>{
  const response=await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send({...body(),totalTickets:10,lotteryDigits:1,awards:[{rank:1,prizes:[{prizeId:p1,quantity:1}]}]});expect(response.status).toBe(201);expect(response.body.lotteryDigits).toBe(1);
  await paid(response.body.id,[7]);const result=await new LotteryService(db,source(['1237'])).finish(adminId,response.body.id,now);expect(result.status).toBe('FINISHED');expect(result.winnerNumber).toBe(7);
  for(const totalTickets of [1,9])expect((await request(app).post('/api/admin/raffles').auth(token(adminId),{type:'bearer'}).send({...body(),totalTickets})).status).toBe(400);
 });
});
