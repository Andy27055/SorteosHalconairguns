import {test,expect} from '@playwright/test';
const admin={id:'admin',username:'admin',fullName:'Administrador',email:'admin@example.invalid',role:'ADMIN',adminType:'PRIMARY',active:true};
const recipient={id:'recipient',username:'ana',fullName:'Ana Pérez',email:'ana@example.invalid',role:'USER',active:true};
const prize={id:'p',name:'Premio',description:''};
const raffle=(id:string,status:string)=>({id,title:`Rifa ${id}`,description:'',prizeId:'p',prize,ticketPriceCents:10000,totalTickets:100,numberStart:0,lotteryDigits:2,status,available:90,sold:10,drawAt:null});
for(const width of [390,320]){
 test(`el contador despliega filtros y ordena compras cerradas a ${width}px`,async({page})=>{
  await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({contentType:'application/json',body:JSON.stringify(p==='/api/auth/me'?{user:null}:p==='/api/raffles'?[raffle('cerrada','CLOSING'),raffle('activa','ACTIVE'),raffle('finalizada','FINISHED')]:[])});});
  await page.setViewportSize({width,height:844});await page.goto('/');
  const cards=page.locator('.raffle-cards').first();await expect(cards.locator('.raffle-card').first()).toContainText('Rifa activa');
  const filter=page.getByRole('button',{name:'Filtrar y ordenar rifas'});await expect(filter).toContainText('1 rifa activa');await filter.click();await page.getByText('Compras cerradas primero',{exact:true}).click();await expect(cards.locator('.raffle-card').first()).toContainText('Rifa cerrada');
  await filter.click();await page.getByText('Sólo compras cerradas',{exact:true}).click();await expect(cards.locator('.raffle-card')).toHaveCount(2);await expect(cards).not.toContainText('Rifa activa');
  await filter.click();await page.getByText('Sólo activas',{exact:true}).click();await expect(cards.locator('.raffle-card')).toHaveCount(1);await expect(cards).toContainText('Rifa activa');
  await filter.click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`playwright-artifacts/filtros-${width}.png`,animations:'disabled'});
 });
 test(`el administrador entrega números gratis para una rifa elegida a ${width}px`,async({page})=>{
  let loggedAsRecipient=false,grant:Record<string,unknown>|null=null;
  const current=raffle('activa','ACTIVE'),draft=raffle('borrador','DRAFT');
  await page.route('**/api/**',route=>{
   const request=route.request(),p=new URL(request.url()).pathname,json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(p==='/api/auth/me')return json({user:loggedAsRecipient?recipient:admin});
   if(p==='/api/admin/stats')return json({raffles:1,users:2,pendingReviews:0,attention:0});if(p==='/api/admin/users')return json([recipient]);if(p==='/api/admin/raffles')return json([current,draft]);if(p==='/api/admin/prizes')return json([prize]);
   if(p==='/api/admin/users/recipient/free-tickets'&&request.method()==='GET')return json([]);
   if(p==='/api/admin/users/recipient/free-tickets'){grant=request.postDataJSON();return json({id:'manual',...grant});}
   if(p==='/api/free-tickets')return json(grant?[{id:'manual',quantity:grant.quantity,remaining:grant.quantity,sourceRaffle:null,rank:null,reason:grant.reason,targetRaffle:grant.targetRaffleId===current.id?current:draft,revoked:false,available:grant.targetRaffleId===current.id,availableRaffles:grant.targetRaffleId===current.id?[current]:[]}]:[]);
   if(p==='/api/orders'||p==='/api/admin/orders')return json({items:[],total:0,page:1});if(p==='/api/raffles')return json([current]);if(p==='/api/guest-reservations')return json({reservation:null});return json([]);
  });
  await page.setViewportSize({width,height:844});await page.goto('/admin');await page.getByRole('tab',{name:'Participantes',exact:true}).click();await page.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Ana Pérez');await page.getByLabel('Cantidad de números gratis').fill('2');const targetRaffleId=width===390?current.id:draft.id;await page.getByLabel('Rifa donde puede usarlos').selectOption(targetRaffleId);await page.getByLabel('Motivo (opcional)').fill('Premio entregado por el organizador');
  await dialog.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'}).click();await expect(dialog).toBeHidden();expect(grant).toMatchObject({quantity:2,targetRaffleId,reason:'Premio entregado por el organizador'});
  loggedAsRecipient=true;await page.goto('/compras');await expect(page.getByText(/Entregado por administración/)).toBeVisible();await expect(page.getByText('2 número(s) gratis',{exact:true})).toBeVisible();
  if(width===320)await expect(page.getByText('Podrás elegir tus números cuando se active esta rifa.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`playwright-artifacts/entrega-manual-${width}.png`,animations:'disabled'});
 });
}
