import {test,expect} from '@playwright/test';
const primary={id:'primary',username:'developer',fullName:'Desarrollador',email:'dev@example.invalid',role:'ADMIN',adminType:'PRIMARY',active:true};
const customer={id:'customer',username:'ana',fullName:'Ana Pérez',email:'ana@example.invalid',role:'USER',active:true};
for(const width of [390,320])test(`crea y elimina cuentas conservando la confirmación a ${width}px`,async({page})=>{
 let accounts=[primary,customer],created:Record<string,unknown>|null=null,deleted:Record<string,unknown>|null=null;
 await page.route('**/api/**',route=>{
  const request=route.request(),p=new URL(request.url()).pathname,json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return json({user:primary});
  if(p==='/api/admin/users'&&request.method()==='POST'){created=request.postDataJSON();return json({id:'new-account',...created});}
  if(p==='/api/admin/users')return json(accounts);
  if(p==='/api/admin/users/customer/deletion-preview')return json({user:customer,orders:3,activeOrders:0,activeBenefits:0,canDelete:true});
  if(p==='/api/admin/users/customer/permanent'){deleted=request.postDataJSON();accounts=[primary];return json({ok:true,deleted:true});}
  if(p==='/api/admin/stats')return json({users:accounts.length,raffles:0,pendingReviews:0,attention:0});
  if(p==='/api/admin/orders')return json({items:[],total:0,page:1});return json([]);
 });
 await page.setViewportSize({width,height:844});await page.goto('/admin');await page.getByRole('tab',{name:'Participantes',exact:true}).click();
 await expect(page.locator('.admin-list-row').filter({hasText:'Desarrollador'}).getByRole('button',{name:'ELIMINAR CUENTA',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'+ CREAR CUENTA',exact:true}).click();let dialog=page.getByRole('dialog');
 for(const [label,value] of [['Nombre','Cuenta'],['Apellido','Prueba'],['Usuario','prueba'],['Correo electrónico','prueba@example.invalid'],['Contraseña inicial','ClaveDePrueba2026']])await dialog.getByLabel(label,{exact:true}).fill(value);
 await dialog.getByLabel('Tipo de cuenta').selectOption('ADMIN');await dialog.getByRole('button',{name:'CREAR CUENTA',exact:true}).click();await expect(dialog).toBeHidden();expect(created).toMatchObject({role:'ADMIN',sendVerification:true,username:'prueba'});
 await page.locator('.admin-list-row').filter({hasText:'Ana Pérez'}).getByRole('button',{name:'ELIMINAR CUENTA',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog).toContainText('Compras en el historial: 3');
 const button=dialog.getByRole('button',{name:'ELIMINAR DEFINITIVAMENTE'});await expect(button).toBeDisabled();await dialog.getByLabel('Escribí CONFIRMAR para eliminar esta cuenta').fill('CONFIRMAR');await expect(button).toBeEnabled();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:`playwright-artifacts/eliminar-cuenta-${width}.png`,animations:'disabled'});
 await button.click();await expect(dialog).toBeHidden();expect(deleted).toEqual({confirmation:'CONFIRMAR'});await expect(page.locator('.admin-list-row').filter({hasText:'Ana Pérez'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('un administrador funcional no ve las herramientas de creación y eliminación del desarrollador',async({page})=>{
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({contentType:'application/json',body:JSON.stringify(p==='/api/auth/me'?{user:{...primary,adminType:'FUNCTIONAL'}}:p==='/api/admin/users'?[customer]:p==='/api/admin/stats'?{users:1,raffles:0,pendingReviews:0,attention:0}:p==='/api/admin/orders'?{items:[],total:0,page:1}:[])});});
 await page.goto('/admin');await page.getByRole('tab',{name:'Participantes',exact:true}).click();await expect(page.getByRole('button',{name:'+ CREAR CUENTA',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'ELIMINAR CUENTA',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Desactivar',exact:true})).toBeEnabled();
});
