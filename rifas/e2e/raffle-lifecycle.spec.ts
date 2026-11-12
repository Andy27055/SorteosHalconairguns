import {test,expect,type Page} from '@playwright/test';
const admin={id:'functional',username:'osvaldo',fullName:'Administrador funcional',email:'admin@example.com',role:'ADMIN',adminType:'FUNCTIONAL',emailVerifiedAt:'2026-11-01T12:00:00Z'};
async function fixture(page:Page,initial='ACTIVE'){
 let phase=initial;let reason:string|undefined;const events:string[]=[];
 const raffle=()=>({id:'r',title:'Rifa de revisión',prizeId:'p',prize:{id:'p',name:'Premio de prueba'},description:'Rifa para revisar el cierre',ticketPriceCents:10000,totalTickets:100,numberStart:0,lotteryDigits:2,status:phase,drawAt:'2026-12-01T00:00:00Z',...(phase==='CLOSING'?{closingAt:'2026-11-12T18:00:00Z',resultDate:'2026-11-12',closedEarly:true,closingNote:'Todavía no se publicó la Nocturna.'}:{}),...(phase==='CANCELLED'?{cancellationReason:reason||null}:{}),...(phase==='FINISHED'?{winnerNumber:37,drawnAt:'2026-11-01T00:00:00Z'}:{})});
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;const json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return json({user:admin});
  if(p==='/api/admin/stats')return json({raffles:1,users:1,revenueCents:10000,pendingReviews:0,attention:0});
  if(p==='/api/admin/raffles')return json([raffle()]);
  if(p==='/api/admin/prizes')return json([raffle().prize]);
  if(p==='/api/admin/users')return json([admin]);
  if(p==='/api/admin/orders')return json({items:[],page:1,total:0});
  if(p==='/api/admin/audit')return json({items:[],page:1,total:0});
  if(p==='/api/admin/raffles/r/buyers')return json({raffle:{id:'r',title:'Rifa de revisión',status:phase},buyers:[{id:'o',firstName:'Ana',lastName:'Pérez',email:'ana@example.com',dni:'12345678',numbers:[37],emailStatuses:['SENT'],orders:[],amountCents:10000}],soldNumbers:1,mailEnabled:true});
  if(p==='/api/admin/raffles/r/refunds')return json([]);
  if(p==='/api/admin/raffles/r/buyers.xlsx'){events.push('excel');return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from('PK-fixture-xlsx')});}
  if(p==='/api/admin/raffles/r'&&route.request().method()==='DELETE'){events.push('cancel');reason=route.request().postDataJSON().reason;phase='CANCELLED';return json({ok:true,buyers:1,refundsPending:1});}
  if(p==='/api/admin/raffles/r/finish'){events.push('finish');phase='CLOSING';return json(raffle());}
  if(p==='/api/raffles/r')return json(raffle());
  if(p==='/api/raffles/r/availability')return json([{number:37,status:'PAID'}]);
  if(p==='/api/config')return json({mercadoPago:false,transfer:true});
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"Ruta no prevista en la prueba"}'});
 });
 return {events,get reason(){return reason;}};
}
for(const width of [1280,320]){
 test(`funcional descarga Excel antes de cancelar con motivo a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const state=await fixture(page);await page.goto('/admin');await page.getByRole('tab',{name:'Rifas',exact:true}).click();await page.getByRole('button',{name:'Eliminar',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('1 comprador');await page.getByLabel('Motivo de cancelación (opcional)').fill('Cambio en la disponibilidad del premio.');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'DESCARGAR EXCEL ANTES DE ELIMINAR'}).click();expect((await download).suggestedFilename()).toBe('compradores-r.xlsx');await expect(page.getByText('Excel descargado.',{exact:false})).toBeVisible();expect(state.events).toEqual(['excel']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`playwright-artifacts/cancelar-rifa-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'ELIMINAR Y AVISAR'}).click();await expect(dialog).toBeHidden();expect(state.reason).toBe('Cambio en la disponibilidad del premio.');expect(state.events).toEqual(['excel','cancel']);await expect(page.getByText('Rifas canceladas',{exact:true})).toBeVisible();await expect(page.locator('.admin-list-row').filter({hasText:'Rifa de revisión'})).toHaveCount(0);await page.goto('/rifas/r');await expect(page.getByRole('heading',{name:'RIFA CANCELADA'})).toBeVisible();await expect(page.getByText('Cambio en la disponibilidad del premio.')).toBeVisible();
 });
 test(`cierre anticipado disponible para funcional con fecha futura a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const state=await fixture(page);await page.goto('/admin');await page.getByRole('tab',{name:'Rifas',exact:true}).click();await page.getByRole('button',{name:'FINALIZAR RIFA',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Nocturna de hoy');await page.getByRole('button',{name:'CONFIRMAR CIERRE'}).click();await expect(page.getByRole('dialog')).toBeHidden();expect(state.events).toEqual(['finish']);await expect(page.getByRole('button',{name:'ACTUALIZAR RESULTADO'})).toBeVisible();await page.goto('/rifas/r');await expect(page.getByRole('heading',{name:'VENTAS CERRADAS'})).toBeVisible();await expect(page.getByText('Todavía no se publicó la Nocturna.')).toBeVisible();await expect(page.getByRole('button',{name:/Número \d/})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test('permite eliminar una rifa ya finalizada y dejar el motivo vacío',async({page})=>{const state=await fixture(page,'FINISHED');await page.goto('/admin');await page.getByRole('tab',{name:'Rifas',exact:true}).click();await page.getByRole('button',{name:'Eliminar',exact:true}).click();await expect(page.getByLabel('Motivo de cancelación (opcional)')).not.toHaveAttribute('required','');await page.getByRole('button',{name:'ELIMINAR Y AVISAR'}).click();await expect(page.getByRole('dialog')).toBeHidden();expect(state.reason).toBe('');expect(state.events).toEqual(['cancel']);});
