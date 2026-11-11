import { test, expect, type Page, type Route } from '@playwright/test';
function receiptPdf(){
  const stream=(page:number)=>`BT /F1 18 Tf 35 540 Td (COMPROBANTE SIMULADO) Tj 0 -35 Td /F1 12 Tf (Sin valor bancario - pagina ${page}) Tj 0 -45 Td (Importe: ARS 10.000) Tj 0 -25 Td (Destino: cuenta de prueba) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',`<< /Length ${stream(1).length} >>\nstream\n${stream(1)}\nendstream`,`<< /Length ${stream(2).length} >>\nstream\n${stream(2)}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function json(route:Route,data:unknown,status=200){await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});}
async function fixture(page:Page,{pdf=true,expired=false,admin=true}={}){
  const user={id:'u',username:'admin',fullName:'Cliente de prueba',email:'test@example.com',role:admin?'ADMIN':'USER'};
  let reviewed='';let receiptRequests=0;
  const receipt={id:'receipt-demo',mimeType:pdf?'application/pdf':'image/png',size:1000,uploadedAt:new Date().toISOString(),deleteAfter:new Date(Date.now()+86400000).toISOString()};
  const order={id:'order-demo',userId:'u',user,raffle:{id:'r',title:'Rifa de prueba',prize:{name:'Premio'}},numbers:[11,12],amountCents:1000000,unitPriceCents:500000,status:'UNDER_REVIEW',method:'TRANSFER',transferHolder:'Titular de prueba',transferAlias:'cuenta.prueba',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),receipts:[receipt]};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return json(route,{user});
    if(path==='/api/config')return json(route,{transfer:true,mercadoPago:false,sandbox:true});
    if(path==='/api/admin/orders')return json(route,{items:reviewed?[]:[order],page:1,total:reviewed?0:1});
    if(path==='/api/orders/order-demo')return json(route,order);
    if(path==='/api/admin/stats')return json(route,{pendingReviews:1,revenueCents:0});
    if(path.startsWith('/api/admin/')&&route.request().method()==='GET')return json(route,[]);
    if(path==='/api/receipts/receipt-demo'){receiptRequests++;if(expired)return json(route,{error:'El comprobante ya no está disponible.'},410);return route.fulfill({status:200,headers:{'Content-Type':receipt.mimeType,'Content-Disposition':'attachment; filename="comprobante.pdf"','Cache-Control':'private, no-store'},body:pdf?receiptPdf():png});}
    if(path==='/api/admin/orders/order-demo/review'){const body=route.request().postDataJSON();if(body.decision==='reject')expect(body.note.length).toBeGreaterThanOrEqual(5);else expect(body.note).toBe('');reviewed=body.decision;return json(route,{ok:true});}
    return json(route,{error:'No previsto'},404);
  });
  return {reviewed:()=>reviewed,receiptRequests:()=>receiptRequests};
}

test('PDF privado en pop-up, cambio de página, zoom, descarga opcional y aprobación',async({page})=>{
  const fixtureState=await fixture(page);let downloads=0;page.on('download',()=>downloads++);
  await page.goto('/admin');await expect(page.getByRole('button',{name:'DESCARGAR COMPROBANTE',exact:true})).toHaveCount(0);
  expect(await page.evaluate(async()=>{try{await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]));return true;}catch{return false;}})).toBe(true);
  await page.getByRole('button',{name:'VER COMPROBANTE',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('img',{name:'Página 1 de 2 del comprobante'})).toBeVisible();await expect(dialog.locator('.receipt-preview-stage')).toHaveAttribute('aria-busy','false');
  expect(await dialog.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<data.length;i+=4)if(data[i]<200&&data[i+3])return true;return false;})).toBe(true);
  expect(downloads).toBe(0);await dialog.getByRole('button',{name:'Página siguiente'}).click();await expect(dialog.getByRole('img',{name:'Página 2 de 2 del comprobante'})).toBeVisible();
  await dialog.getByRole('button',{name:'Acercar comprobante'}).click();await expect(dialog.getByText('125%',{exact:true})).toBeVisible();await expect(dialog.locator('.receipt-preview-stage')).toHaveAttribute('aria-busy','false');
  await page.screenshot({path:'playwright-artifacts/receipt-popup-desktop.png'});
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'DESCARGAR COMPROBANTE'}).click();expect((await download).suggestedFilename()).toBe('comprobante-receipt-demo.pdf');expect(fixtureState.receiptRequests()).toBe(1);
  await dialog.getByRole('button',{name:'APROBAR TRANSFERENCIA',exact:true}).click();await expect(dialog.getByLabel(/Observación para el participante/)).toHaveJSProperty('required',false);await expect(dialog.getByRole('button',{name:'CONFIRMAR APROBACIÓN'})).toBeEnabled();await dialog.getByRole('button',{name:'CONFIRMAR APROBACIÓN'}).click();await expect(dialog).not.toBeVisible();expect(fixtureState.reviewed()).toBe('approve');
});
test('imagen y rechazo dentro del pop-up en teléfono',async({page})=>{
  await page.setViewportSize({width:390,height:844});const state=await fixture(page,{pdf:false});await page.goto('/admin');await page.getByRole('button',{name:'RECHAZAR',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('img',{name:'Comprobante de transferencia'})).toBeVisible();await expect.poll(()=>dialog.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await dialog.getByLabel(/Observación para el participante/).fill('El comprobante no corresponde a esta compra.');await dialog.getByRole('button',{name:'CONFIRMAR RECHAZO'}).click();await expect(dialog).not.toBeVisible();expect(state.reviewed()).toBe('reject');
});
test('PDF en teléfono y enlaces oficiales juntos en la cabecera',async({page})=>{
  await page.setViewportSize({width:320,height:844});await fixture(page);await page.goto('/admin');
  const links=page.getByRole('group',{name:'Canales oficiales de Halcón Airguns'});await expect(links.getByRole('link',{name:/YouTube/})).toHaveAttribute('href','https://www.youtube.com/@Jose_Osvaldo');await expect(links.getByRole('link',{name:/Tienda oficial/})).toHaveAttribute('href','https://halcon-airguns.com.ar');await expect(links.getByRole('link',{name:/Tienda oficial/})).toHaveAttribute('target','_blank');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('banner').screenshot({path:'playwright-artifacts/official-links-mobile.png'});
  await page.getByRole('button',{name:'APROBAR TRANSFERENCIA',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('img',{name:'Página 1 de 2 del comprobante'})).toBeVisible();await expect(dialog.locator('.receipt-preview-stage')).toHaveAttribute('aria-busy','false');
  expect(await dialog.evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);const bounds=await dialog.boundingBox();expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.height).toBeLessThanOrEqual(844);await page.screenshot({path:'playwright-artifacts/receipt-popup-mobile.png'});
  await dialog.getByRole('button',{name:'CERRAR',exact:true}).click();await expect(dialog).not.toBeVisible();
});
test('archivo vencido informa el error y no habilita descarga o aprobación',async({page})=>{
  await fixture(page,{expired:true});await page.goto('/admin');await page.getByRole('button',{name:'VER COMPROBANTE',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('ya no está disponible');await expect(dialog.getByRole('button',{name:'DESCARGAR COMPROBANTE'})).toBeDisabled();
});
test('el comprador puede ver su comprobante sin controles de revisión',async({page})=>{
  await fixture(page,{admin:false,pdf:false});await page.goto('/compras/order-demo');await page.getByRole('button',{name:'VER COMPROBANTE',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('img',{name:'Comprobante de transferencia'})).toBeVisible();await expect(dialog.getByRole('button',{name:'APROBAR TRANSFERENCIA'})).toHaveCount(0);
});
