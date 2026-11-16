import {test,expect,type Page} from '@playwright/test';
const p1={id:'p1',name:'Rifle',description:'Rifle de prueba'},p2={id:'p2',name:'Mira',description:'Mira de prueba'};
const user={id:'admin',username:'halcon-dev',email:'admin@example.invalid',fullName:'Administrador de prueba',role:'ADMIN',adminType:'PRIMARY'};
async function fixture(page:Page,initial:unknown[]=[],publicRaffles:unknown[]=[]){
 let raffles=initial,catalog=[p1,p2],saved:Record<string,unknown>|null=null;
 await page.route('**/api/**',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname;
  const json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return json({user});
  if(p==='/api/config')return json({mercadoPago:false,transfer:true});
  if(p==='/api/guest-reservations')return json({reservation:null});
  if(p==='/api/admin/stats')return json({raffles:raffles.length,users:3,pendingReviews:0,attention:0});
  if(p==='/api/admin/prizes'&&request.method()==='POST'){const body=request.postDataJSON();const prize={id:'p3',...body};catalog=[...catalog,prize];return json(prize);}
  if(p==='/api/admin/prizes')return json(catalog);
  if(p==='/api/admin/users')return json([]);
  if(p==='/api/admin/orders')return json({items:[],total:0,page:1});
  if(p==='/api/admin/raffles'&&request.method()==='POST'){
   saved=request.postDataJSON();const data=saved!;
   const configured=(data.awards as {rank:number;prizes:{prizeId:string;quantity:number}[]}[]).map(a=>({...a,prizes:a.prizes.map(item=>({...item,name:catalog.find(p=>p.id===item.prizeId)!.name,description:''}))}));
   const raffle={...data,id:'new',prize:p1,awards:configured,revenueCents:0};raffles=[raffle];return json(raffle);
  }
  if(p==='/api/admin/raffles')return json(raffles);
  if(p==='/api/raffles')return json(publicRaffles);
  if(p.endsWith('/availability'))return json([]);
  if(p.startsWith('/api/raffles/'))return json(publicRaffles[0]||{});
  if(p==='/api/admin/audit'||p.endsWith('/activity'))return json({items:[],page:1,total:0});
  return json([]);
 });
 return ()=>saved;
}
for(const width of [390,320]){
 test(`muestra ceros iniciales y conserva la selección en rifas grandes a ${width}px`,async({page})=>{
  const totalTickets=width===320?10000:1000,zero=width===320?'0000':'000',seven=width===320?'0007':'007';
  const raffle={id:'r',title:'Rifa grande',description:'',prizeId:'p1',prize:p1,totalTickets,numberStart:0,ticketPriceCents:10000,status:'ACTIVE'};
  await page.setViewportSize({width,height:844});await fixture(page,[],[raffle]);await page.goto('/rifas/r');
  await expect(page.getByRole('button',{name:'Número 0',exact:true})).toHaveText(zero);
  await page.getByRole('button',{name:'Número 7',exact:true}).click();await expect(page.locator('.selected-numbers')).toContainText(seven);
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.getByRole('button',{name:'Número 100',exact:true})).toHaveText(width===320?'0100':'100');
  await expect(page.locator('.selected-numbers')).toContainText(seven);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`playwright-artifacts/numeros-${totalTickets}-${width}.png`,animations:'disabled'});
 });
 test(`configura puestos, reutiliza premios y crea uno dentro del asistente a ${width}px`,async({page})=>{
  const saved=await fixture(page);await page.setViewportSize({width,height:844});await page.goto('/admin');
  await page.getByRole('tab',{name:'Rifas',exact:true}).click();await page.getByRole('button',{name:'+ NUEVA RIFA'}).click();
  const dialog=page.getByRole('dialog');await expect(page.getByLabel('Cifras de cada resultado')).toHaveCount(0);await expect(dialog).toContainText('Se usan las últimas 2 cifras');await page.getByLabel('Título',{exact:true}).fill('Rifa con varios premios');await page.getByLabel('Precio por número (ARS)').fill('1500');await page.getByLabel('Cantidad de puestos premiados').fill('2');
  if(width===320){await page.getByLabel('Cantidad de números',{exact:true}).fill('1000');await expect(dialog).toContainText('000 a 999');await expect(dialog).toContainText('1237 → 237');}
  await dialog.getByRole('button',{name:'SIGUIENTE',exact:true}).click();
  const fields=dialog.locator('.award-editor');await expect(fields).toHaveCount(2);
  await fields.first().getByRole('button',{name:'+ CREAR PREMIO',exact:true}).click();await page.getByLabel('Nombre del nuevo premio').fill('Funda nueva');await page.getByLabel('Descripción del nuevo premio').fill('Funda creada durante la configuración');await page.getByRole('button',{name:'GUARDAR Y ASIGNAR PREMIO'}).click();
  await expect(fields.first().getByLabel('Premio 1',{exact:true})).toHaveValue('p3');
  await fields.first().getByRole('button',{name:'+ AGREGAR OTRO PREMIO'}).click();await fields.first().getByLabel('Premio 2',{exact:true}).selectOption('p1');await fields.first().getByLabel('Cantidad',{exact:true}).first().fill('2');
  await fields.nth(1).getByLabel('Premio 1',{exact:true}).selectOption('p1');
  await page.screenshot({path:`playwright-artifacts/premios-config-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:'SIGUIENTE',exact:true}).click();await page.getByLabel('Estado',{exact:true}).selectOption('ACTIVE');
  await expect(dialog).toContainText('2 × Funda nueva');await page.screenshot({path:`playwright-artifacts/premios-revision-${width}.png`,animations:'disabled'});
  await dialog.getByRole('button',{name:'PUBLICAR RIFA'}).click();await expect(dialog).toBeHidden();
  expect(saved()).toMatchObject({totalTickets:width===320?1000:100,lotteryDigits:width===320?3:2,prizeId:'p3',awards:[{rank:1,prizes:[{prizeId:'p3',quantity:2},{prizeId:'p1',quantity:1}]},{rank:2,prizes:[{prizeId:'p1',quantity:1}]}]});
  await expect(page.getByRole('heading',{name:'Rifa con varios premios',exact:true})).toBeVisible();
 });
 test(`publica todos los premios ganados por una misma persona a ${width}px`,async({page})=>{
  const raffle={id:'r',title:'Rifa finalizada',description:'',prizeId:'p1',prize:p1,totalTickets:100,numberStart:0,lotteryDigits:2,ticketPriceCents:10000,status:'FINISHED',winnerNumber:37,winnerDisplayName:'Ana P.',drawnAt:'2026-11-15T00:30:00Z',lotteryResult:{date:'2026-11-14',head:'5737',drawNumber:'12915',sourceUrl:'https://loteria.gba.gob.ar/resultados',sourceSha256:'a'.repeat(64),checkedAt:'2026-11-15T00:30:00Z'},awards:[{rank:1,winningNumber:37,officialNumber:'5737',winnerDisplayName:'Ana P.',prizes:[{prizeId:'p1',name:'Rifle',description:'',quantity:1}]},{rank:2,winningNumber:37,officialNumber:'1237',winnerDisplayName:'Ana P.',prizes:[{prizeId:'p2',name:'Mira',description:'',quantity:2}]}]};
  await page.setViewportSize({width,height:844});await fixture(page,[],[raffle]);await page.goto('/');
  const winners=page.getByRole('region',{name:'Ganadores de la última rifa cerrada'});await expect(winners).toBeVisible();await expect(winners.getByText('Ana P.',{exact:true})).toHaveCount(2);await expect(winners).toContainText('2 × Mira');await expect(winners).toContainText('1237');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await winners.scrollIntoViewIfNeeded();await page.screenshot({path:`playwright-artifacts/premios-ganadores-${width}.png`,animations:'disabled'});
 });
}
