import {test,expect,type Page} from '@playwright/test';
const user={id:'admin',username:'admin',fullName:'Administrador',email:'admin@example.com',role:'ADMIN',emailVerifiedAt:null};
const raffle={id:'r',title:'Rifa Nocturna de prueba',description:'Premio de prueba',prizeId:'p',prize:{id:'p',name:'Premio'},totalTickets:100,numberStart:0,lotteryDigits:2,ticketPriceCents:10000,status:'FINISHED',winnerNumber:0,winnerDisplayName:'Ana P.',drawnAt:'2026-11-13T00:30:00Z',lotteryResult:{date:'2026-11-12',head:'5700',drawNumber:'12913',sourceUrl:'https://loteria.gba.gob.ar/resultados',checkedAt:'2026-11-13T00:30:00Z',sourceSha256:'a'.repeat(64)}};
async function fixture(page:Page,adminType:'PRIMARY'|'FUNCTIONAL'='FUNCTIONAL'){
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  const respond=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return respond({user:{...user,adminType}});
  if(p==='/api/raffles')return respond([raffle]);
  if(p==='/api/raffles/r')return respond({...raffle,status:'ACTIVE'});
  if(p==='/api/raffles/r/availability')return respond([]);
  if(p==='/api/config')return respond({mercadoPago:false,transfer:true});
  if(p==='/api/profile'||p==='/api/admin/users/admin')return respond(user);
  if(p.endsWith('/activity')||p==='/api/admin/audit')return respond({items:[{id:'event-1',actor:'Administrador',description:'Aprobó un pago por transferencia',context:'Rifa Nocturna de prueba · Números 00, 37',createdAt:'2026-11-13T00:30:00Z'}],page:1,total:1});
  if(p==='/api/admin/raffles')return respond([{...raffle,status:'ACTIVE'}]);
  if(p==='/api/admin/prizes')return respond([raffle.prize]);
  if(p==='/api/admin/users')return respond([user]);
  if(p==='/api/admin/orders')return respond({items:[],page:1,total:0});
  if(p==='/api/admin/stats')return respond({raffles:1,users:1,revenueCents:10000,pendingReviews:0,attention:0});
  if(p==='/api/admin/raffles/r/buyers')return respond({buyers:[],soldNumbers:0});
  if(p==='/api/auth/verify-email')return respond({ok:true});
  return respond([]);
 });
}
for(const width of [1280,320]){
 test(`anuncio e historial legibles a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.clock.install({time:new Date('2026-11-13T02:00:00Z')});await fixture(page);await page.goto('/');
  await expect(page.getByRole('region',{name:'Ganador de la última rifa cerrada'})).toContainText('Ana P.');await expect(page.getByRole('link',{name:'VER RESULTADO EN LOTERÍA'})).toHaveAttribute('href','https://loteria.gba.gob.ar/resultados');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`playwright-artifacts/ganador-${width}.png`,animations:'disabled'});
  await page.goto('/admin');await page.getByRole('tab',{name:'Actividad',exact:true}).click();await expect(page.getByText('Aprobó un pago por transferencia')).toBeVisible();await expect(page.getByText('TRANSFER_APPROVED')).toHaveCount(0);
  await page.getByRole('tab',{name:'Participantes'}).click();await page.getByRole('button',{name:'VER PERFIL E HISTORIAL'}).click();await expect(page.getByRole('dialog')).toContainText('HISTORIAL DE LA CUENTA');
  await page.screenshot({path:`playwright-artifacts/historial-${width}.png`,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test('muestra 00–99 y reemplaza sortear por finalizar',async({page})=>{
 await fixture(page);await page.goto('/rifas/r');await expect(page.getByRole('button',{name:'Número 0',exact:true})).toHaveText('00');await expect(page.getByRole('button',{name:'Número 99',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Número 100',exact:true})).toHaveCount(0);
 await page.goto('/admin');await page.getByRole('tab',{name:'Rifas',exact:true}).click();await expect(page.getByRole('button',{name:'FINALIZAR RIFA'})).toBeVisible();await expect(page.getByRole('button',{name:'SORTEAR',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'FINALIZAR RIFA'}).click();await expect(page.getByRole('dialog')).toContainText('Nocturna de la Provincia de Buenos Aires');
});
test('el enlace de correo exige confirmación explícita y permite elegir contraseña',async({page})=>{
 await fixture(page);await page.goto('/verificar-correo#enlace-de-prueba');await page.getByRole('checkbox').check();await page.getByLabel('Nueva contraseña').fill('MiClavePropia2026');await page.getByRole('button',{name:'CONFIRMAR MI CORREO'}).click();await expect(page.getByRole('heading',{name:'CORREO CONFIRMADO'})).toBeVisible();
});
test('avisa sobre spam y distingue controles principales de funcionales',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.goto('/registro');await expect(page.getByText('¿No encontrás nuestro correo?')).toBeVisible();await expect(page.getByText(/Revisá también la carpeta de spam/)).toBeVisible();
 const accounts=[{...user,id:'osvaldo',username:'osvaldo-gomez',fullName:'Osvaldo Javier Gomez',adminType:'FUNCTIONAL',active:true},{...user,id:'halcon',username:'halcon-dev',fullName:'Halcón Airguns',adminType:'PRIMARY',active:true}];
 await page.route('**/api/admin/users',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(accounts)}));
 await page.goto('/admin');await page.getByRole('tab',{name:'Participantes'}).click();const functionalRow=page.locator('.admin-list-row').filter({has:page.getByRole('heading',{name:'Osvaldo Javier Gomez'})});await expect(functionalRow.getByRole('button',{name:'Quitar administrador'})).toBeDisabled();await expect(functionalRow.getByRole('button',{name:'Desactivar'})).toBeDisabled();await expect(functionalRow).toContainText('Administrador funcional');
 await page.route('**/api/auth/me',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({user:{...user,adminType:'PRIMARY'}})}));await page.reload();await page.getByRole('tab',{name:'Participantes'}).click();await expect(functionalRow.getByRole('button',{name:'Quitar administrador'})).toBeEnabled();await expect(page.locator('.admin-list-row').filter({has:page.getByRole('heading',{name:'Halcón Airguns'})}).getByRole('button',{name:'Desactivar'})).toBeDisabled();
});
