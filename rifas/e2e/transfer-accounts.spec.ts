import { test, expect, type Route } from '@playwright/test';
const accounts=[{id:'primary',holder:'Titular Uno',alias:'primera.prueba',cbu:''},{id:'secondary',holder:'Titular Dos',alias:'segunda.prueba',cbu:''}];
const user={id:'cliente',username:'cliente',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',email:'ana@example.com',dni:'12345678',role:'USER'};
async function json(route:Route,data:unknown,status=200){await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});}
for(const width of [320,390])test(`elegir segunda cuenta, recargar y subir comprobante a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});let status='RESERVED';let destination={};let sent=false;
  const order=()=>({id:'transfer-test',userId:user.id,raffleId:'rifa',raffle:{id:'rifa',title:'Rifa de prueba'},numbers:[11,12],unitPriceCents:500000,amountCents:1000000,status,method:status==='RESERVED'?null:'TRANSFER',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),receipts:[],...destination});
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return json(route,{user});if(path==='/api/profile')return json(route,user);
    if(path==='/api/config')return json(route,{mercadoPago:false,sandbox:true,transfer:true,transferAccounts:accounts,transferHolder:accounts[0].holder,transferAlias:accounts[0].alias,transferCbu:''});
    if(path==='/api/orders/transfer-test')return json(route,order());
    if(path==='/api/orders/transfer-test/transfer'){expect(route.request().postDataJSON()).toEqual({accountId:'secondary'});status='AWAITING_RECEIPT';destination={transferAccountId:'secondary',transferHolder:accounts[1].holder,transferAlias:accounts[1].alias,transferCbu:''};return json(route,order());}
    if(path==='/api/orders/transfer-test/receipt'){expect(route.request().headers()['content-type']).toContain('multipart/form-data');sent=true;status='UNDER_REVIEW';return json(route,{id:'receipt-test'},201);}
    return json(route,{error:'No previsto'},404);
  });
  await page.goto('/compras/transfer-test');await page.getByLabel('Cuenta para tu transferencia').selectOption('secondary');await expect(page.getByRole('button',{name:'ELEGIR TRANSFERENCIA',exact:true})).toBeEnabled();
  await page.screenshot({path:`playwright-artifacts/transfer-choice-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'ELEGIR TRANSFERENCIA',exact:true}).click();await expect(page.getByRole('heading',{name:'ENVIÁ TU COMPROBANTE'})).toBeVisible();
  await page.reload();await expect(page.getByText('Titular Dos',{exact:true})).toBeVisible();await expect(page.getByText('segunda.prueba',{exact:true})).toBeVisible();
  await expect(page.getByText('primera.prueba',{exact:true})).not.toBeVisible();
  await page.locator('#receipt-file').setInputFiles({name:'comprobante.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nprueba sin pago real')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`playwright-artifacts/transfer-receipt-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'ENVIAR PARA REVISIÓN'}).click();await expect(page.getByText('Estamos revisando tu transferencia.')).toBeVisible();expect(sent).toBe(true);
});
