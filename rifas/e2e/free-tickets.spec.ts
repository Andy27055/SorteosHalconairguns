import {test,expect} from '@playwright/test';
for(const width of [390,320])test(`canjea un premio eligiendo un número sin pagar a ${width}px`,async({page})=>{
 const user={id:'u',username:'ana',fullName:'Ana Pérez',firstName:'Ana',lastName:'Pérez',email:'ana@example.invalid',dni:'12345678',role:'USER'};
 const prize={id:'p',name:'Rifle',description:''};
 const raffle={id:'r',title:'La próxima rifa',description:'',prize,prizeId:'p',totalTickets:100,numberStart:0,lotteryDigits:2,ticketPriceCents:10000,status:'ACTIVE',awards:[{rank:1,prizes:[{prizeId:'p',name:'Rifle',description:'',quantity:1}]}]};
 let order:Record<string,unknown>|null=null,used=false,paymentRequests=0,redemptions=0;
 await page.route('**/api/**',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname,json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return json({user});if(p==='/api/profile')return json(user);
  if(p==='/api/config')return json({mercadoPago:true,transfer:true,transferAccounts:[],receiptMaxMb:5});
  if(p==='/api/guest-reservations')return json({reservation:null});
  if(p==='/api/free-tickets')return json([{id:'b',quantity:1,remaining:used?0:1,revoked:false,available:!used,rank:2,sourceRaffle:{id:'old',title:'Rifa anterior',status:'FINISHED'},targetRaffle:{id:'r',title:raffle.title,status:'ACTIVE'},availableRaffles:[{id:'r',title:raffle.title,status:'ACTIVE'}]}]);
  if(p==='/api/raffles')return json([raffle]);if(p.endsWith('/availability'))return json([]);if(p==='/api/raffles/r')return json(raffle);
  if(p==='/api/orders'&&request.method()==='POST'){const data=request.postDataJSON();order={id:'o',userId:'u',raffleId:'r',raffle,numbers:data.numbers,status:'RESERVED',unitPriceCents:10000,amountCents:10000,expiresAt:new Date(Date.now()+300000).toISOString(),createdAt:new Date().toISOString(),receipts:[]};return json(order);}
  if(p==='/api/orders/o/free-tickets'){used=true;redemptions++;order={...order,status:'PAID',method:'FREE_TICKET',unitPriceCents:0,amountCents:0,paidAt:new Date().toISOString()};return json(order);}
  if(p==='/api/orders/o')return json(order);if(p==='/api/orders')return json({items:order?[order]:[],page:1,total:order?1:0});
  if(p.endsWith('/checkout')||p.endsWith('/transfer'))paymentRequests++;
  return json([]);
 });
 await page.setViewportSize({width,height:844});await page.goto('/compras');await page.getByRole('link',{name:`ELEGIR EN ${raffle.title} ↗`}).click();
 await expect(page.getByText(/Tenés.*número\(s\) gratis/)).toBeVisible();await page.getByRole('button',{name:'Número 7',exact:true}).click();
 await page.locator('.purchase-summary').getByRole('button',{name:/RESERVAR Y CONTINUAR/}).click();
 const redeem=page.getByRole('button',{name:'USAR NÚMEROS GRATIS'});await expect(redeem).toBeEnabled();await redeem.click();
 await expect(page.getByText('Participación gratuita confirmada.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'PREMIO CANJEADO'})).toBeVisible();await expect(page.locator('.order-numbers')).toContainText('07');
 expect(paymentRequests).toBe(0);expect(redemptions).toBe(1);expect(order).toMatchObject({status:'PAID',method:'FREE_TICKET',amountCents:0,numbers:[7]});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`playwright-artifacts/canje-gratis-${width}.png`,animations:'disabled'});
});
