import {test,expect} from '@playwright/test';
const admin={id:'admin',username:'admin',fullName:'Administrador',email:'admin@example.invalid',role:'ADMIN',adminType:'PRIMARY',active:true};
const buyer={id:'inactive',username:'cliente',fullName:'Cliente desactivado',email:'nuevo@example.invalid',role:'USER',active:false};
const raffle={id:'cancelled',title:'Rifa cancelada de prueba',status:'CANCELLED',prizeId:'p',prize:{id:'p',name:'Premio',description:''},description:'',totalTickets:100,ticketPriceCents:10000};
const now='2026-11-15T18:00:00.000Z';
for(const width of [390,320])test(`separa comprobantes y devoluciones, y registra el reembolso a ${width}px`,async({page})=>{
 let completed=false,requestBody:Record<string,unknown>|null=null;
 const unknownAmount=width===320;
 const refund=()=>({id:'refund',userId:buyer.id,user:buyer,raffle,raffleId:raffle.id,status:completed?'REFUNDED':unknownAmount?'REJECTED':'REFUND_PENDING',method:'TRANSFER',numbers:[7],unitPriceCents:10000,amountCents:10000,refundAmountCents:completed?unknownAmount?10025:10000:unknownAmount?null:10000,createdAt:now,expiresAt:now,refundRequestedAt:now,refundCompletedAt:completed?now:null,refundReference:completed?'Devolución bancaria 123':null,buyerFirstName:'Nombre',buyerLastName:'Histórico',buyerEmail:'original@example.invalid',buyerDni:'12345678',decisionNote:'Devolución pendiente por cancelación.',receipts:[]});
 const review={...refund(),id:'review',status:'UNDER_REVIEW',refundRequestedAt:null,refundCompletedAt:null,raffle:{...raffle,status:'ACTIVE',title:'Rifa en revisión'}};
 await page.route('**/api/**',route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return json({user:admin});
  if(p==='/api/admin/stats')return json({users:2,raffles:1,pendingReviews:1,pendingRefunds:completed?0:1,attention:0});
  if(p==='/api/admin/raffles')return json([raffle]);if(p==='/api/admin/users')return json([admin,buyer]);if(p==='/api/admin/prizes')return json([raffle.prize]);
  if(p==='/api/admin/orders'){const filter=url.searchParams.get('status'),items=filter==='REFUND_PENDING'?(completed?[]:[refund()]):filter==='REFUNDED'?(completed?[refund()]:[]):[review];return json({items,total:items.length,page:1});}
  if(p==='/api/admin/orders/refund/refund-complete'){requestBody=req.postDataJSON();completed=true;return json({ok:true});}
  return json([]);
 });
 await page.setViewportSize({width,height:844});await page.goto('/admin');const navigation=page.getByRole('tablist',{name:'Secciones de administración'});await expect(navigation.getByRole('tab')).toHaveCount(7);await expect(page.getByRole('button',{name:'APROBAR TRANSFERENCIA',exact:true})).toBeVisible();await expect(page.locator('.admin-order')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`playwright-artifacts/menu-administracion-${width}.png`,animations:'disabled',fullPage:true});
 await navigation.getByRole('tab',{name:'Devoluciones',exact:true}).click();const panel=page.locator('.refunds-panel');await panel.getByLabel('Mostrar devoluciones').selectOption('REFUND_PENDING');await expect(panel.getByText('Rifa cancelada de prueba',{exact:true})).toBeVisible();await expect(panel.getByText('Nombre Histórico',{exact:true})).toBeVisible();await expect(panel).toContainText('original@example.invalid');await expect(page.getByRole('button',{name:'APROBAR TRANSFERENCIA',exact:true})).toBeHidden();await expect(panel.getByRole('button',{name:'VER COMPROBANTE',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'REGISTRAR REEMBOLSO REALIZADO'}).click();const dialog=page.getByRole('dialog'),submit=dialog.getByRole('button',{name:'REGISTRAR DEVOLUCIÓN'});await expect(submit).toBeDisabled();await dialog.getByLabel('Referencia del reembolso (mín. 5 caracteres)').fill('Devolución bancaria 123');await dialog.getByLabel('Escribí CONFIRMAR para registrar la devolución').fill('CONFIRMAR');
 if(unknownAmount){await expect(submit).toBeDisabled();await dialog.getByLabel('Importe efectivamente devuelto (ARS)').fill('100,25');}else await expect(dialog.getByLabel('Importe efectivamente devuelto (ARS)')).toBeDisabled();
 await expect(submit).toBeEnabled();await submit.click();await expect(dialog).toBeHidden();expect(requestBody).toEqual({confirmation:'CONFIRMAR',reference:'Devolución bancaria 123',amountCents:unknownAmount?10025:10000});await expect(panel.getByText('No hay devoluciones pendientes.',{exact:true})).toBeVisible();
 await panel.getByLabel('Mostrar devoluciones').selectOption('REFUNDED');await expect(panel.locator('.refund-card')).toHaveCount(1);await expect(panel.getByText('Devolución bancaria 123',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'REGISTRAR REEMBOLSO REALIZADO'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`playwright-artifacts/devolucion-realizada-${width}.png`,animations:'disabled',fullPage:true});
});
