import { test, expect, type Page, type Route } from '@playwright/test';
const raffle={id:'rifa',title:'Rifa Halcón',prize:{id:'p',name:'Premio Halcón',description:''},prizeId:'p',description:'Rifa para prueba de interfaz',ticketPriceCents:500000,totalTickets:100,status:'ACTIVE',sold:0,available:100};
const reservation={id:'guest-order',raffleId:'rifa',numbers:[11,12],expiresAt:new Date(Date.now()+600000).toISOString()};
const user={id:'user',username:'cliente',email:'cliente@example.com',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',dni:'12345678',role:'USER'};
async function json(route:Route,data:unknown,status=200){await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});}
async function guestJourney(page:Page){
  let reserved=false;let loggedIn=false;
  await page.route('**/api/**',async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;
    if(path==='/api/auth/me')return json(route,loggedIn?{user}:{error:'Sin sesión'},loggedIn?200:401);
    if(path==='/api/raffles/rifa')return json(route,raffle);
    if(path==='/api/raffles/rifa/availability')return json(route,[]);
    if(path==='/api/guest-reservations'&&req.method()==='POST'){reserved=true;expect(req.postDataJSON().numbers).toEqual([11,12]);return json(route,{reservation},201);}
    if(path==='/api/guest-reservations')return json(route,{reservation:reserved?reservation:null});
    if(path==='/api/auth/login'||path==='/api/auth/register'){loggedIn=true;return json(route,{user,token:'token-simulado'},path.endsWith('register')?201:200);}
    if(path==='/api/guest-reservations/claim'){expect(reserved).toBe(true);reserved=false;return json(route,{order:{id:reservation.id}});}
    if(path==='/api/orders/guest-order')return json(route,{...reservation,raffle,userId:user.id,status:'RESERVED',unitPriceCents:500000,amountCents:1000000,createdAt:new Date().toISOString(),receipts:[]});
    if(path==='/api/profile')return json(route,user);
    if(path==='/api/config')return json(route,{mercadoPago:false,transfer:false,sandbox:true,transferHolder:'',transferAlias:'',transferCbu:''});
    return json(route,{error:'No previsto'},404);
  });
}
for(const register of [false,true]){
  test(`conserva números al ${register?'registrarse':'ingresar'} desde el teléfono`,async({page})=>{
    await page.setViewportSize({width:390,height:844});await guestJourney(page);await page.goto('/rifas/rifa');
    await page.getByRole('button',{name:'Número 11',exact:true}).click();await page.getByRole('button',{name:'Número 12',exact:true}).click();
    await page.getByLabel('Continuar con los números seleccionados').getByRole('button',{name:'CONTINUAR',exact:false}).click();
    await expect(page).toHaveURL(/\/ingresar$/);await expect(page.getByText('TUS NÚMEROS ESTÁN APARTADOS')).toBeVisible();await expect(page.getByText('011 · 012')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
    await page.screenshot({path:'playwright-artifacts/guest-hold-mobile.png',fullPage:true});
    if(register){await page.getByRole('link',{name:'Creá tu cuenta',exact:true}).click();await page.getByLabel('Nombre',{exact:true}).fill('Ana');await page.getByLabel('Apellido',{exact:true}).fill('Pérez');await page.getByLabel('Usuario',{exact:true}).fill('cliente');await page.getByLabel('Email',{exact:true}).fill('cliente@example.com');}
    else await page.getByLabel('Usuario o email').fill('cliente');
    await page.getByLabel('Contraseña',{exact:true}).fill('clave-de-prueba-123');await page.getByRole('button',{name:register?'CREAR MI CUENTA':'INGRESAR',exact:false}).click();
    await expect(page).toHaveURL(/\/compras\/guest-order$/);await expect(page.getByText('011',{exact:true})).toBeVisible();await expect(page.getByText('012',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'DATOS DEL COMPRADOR'})).toBeVisible();
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo({top:0,behavior:'instant'});});
    await page.screenshot({path:`playwright-artifacts/guest-${register?'register':'login'}-mobile.png`,fullPage:true});
  });
}
test('administrador consulta compradores y descarga un Excel por rifa',async({page})=>{
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return json(route,{user:{...user,role:'ADMIN'}});
    if(path==='/api/admin/stats')return json(route,{raffles:1,users:1,pendingReviews:0,attention:0,revenueCents:1000000});
    if(path==='/api/admin/raffles')return json(route,[raffle]);if(path==='/api/admin/prizes')return json(route,[raffle.prize]);
    if(path==='/api/admin/users'||path==='/api/admin/audit')return json(route,[]);if(path==='/api/admin/orders')return json(route,{items:[],total:0,page:1});
    if(path==='/api/admin/raffles/rifa/buyers')return json(route,{raffle,buyers:[{email:user.email,firstName:'Ana',lastName:'Pérez',dni:'01234567',numbers:[11,12],emailStatuses:['PENDING']}],soldNumbers:2,mailEnabled:false});
    if(path==='/api/admin/raffles/rifa/buyers.xlsx')return route.fulfill({status:200,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from('xlsx simulado de interfaz')});
    return json(route,{error:'No previsto'},404);
  });
  await page.goto('/admin');await page.getByRole('tab',{name:'Compradores',exact:true}).click();await page.getByLabel('Seleccioná una rifa').selectOption('rifa');
  await expect(page.getByText('01234567')).toBeVisible();const download=page.waitForEvent('download');await page.getByRole('button',{name:'DESCARGAR EXCEL'}).click();expect((await download).suggestedFilename()).toBe('compradores-rifa.xlsx');
  await page.screenshot({path:'playwright-artifacts/buyers-admin.png',fullPage:true});
});
