import {describe,it,expect} from 'vitest';
import {parseNocturna,argentinaDay,publicRaffle,LOTTERY_URL} from './services/lottery.js';
import {salesClosed} from './services/orders.js';
import {notificationMessage} from './services/purchase-emails.js';
export function officialHtml(day='12/11/2026',head='5737'){
 const numbers=Array.from({length:20},(_,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><span>${i===0?head:'1234'}</span></div>`).join('');
 return `<h3>Quiniela Matutina<i></i></h3><span>9999</span><h3>Quiniela Nocturna<i class="fa-solid"></i></h3><div class="datosSorteo"><p class="fechaSorteo">${day}</p><p class="nSorteo">Sorteo N°12913</p><div class="bolillas">${numbers}</div></div><h3>Otro juego</h3>`;
}
describe('fuente oficial y fecha argentina',()=>{
 it('extrae sólo la cabeza nocturna de Provincia y conserva evidencia',()=>{const r=parseNocturna(officialHtml(),'2026-11-12');expect(r.head).toBe('5737');expect(r.drawNumber).toBe('12913');expect(r.sourceUrl).toBe(LOTTERY_URL);expect(r.sourceSha256).toMatch(/^[a-f0-9]{64}$/);expect(r.extract).toContain('5737');});
 it('rechaza resultados de otra fecha',()=>expect(()=>parseNocturna(officialHtml('11/11/2026'),'2026-11-12')).toThrow('todavía'));
 it('rechaza datos provisionales o incompletos',()=>{expect(()=>parseNocturna(officialHtml('12/11/2026','----'),'2026-11-12')).toThrow();expect(()=>parseNocturna(officialHtml().replace('<span>20</span>','<span>19</span>'),'2026-11-12')).toThrow();});
 it('falla cerrado ante cambios en la fuente',()=>expect(()=>parseNocturna('<h1>Sin resultados</h1>','2026-11-12')).toThrow('formato'));
 it('usa el calendario argentino incluso cuando UTC ya cambió de día',()=>expect(argentinaDay(new Date('2026-11-13T02:59:59Z'))).toBe('2026-11-12'));
 it('oculta el enlace diario al pasar la medianoche argentina y omite datos privados',()=>{const raffle={id:'r',lotteryResult:parseNocturna(officialHtml(),'2026-11-12') as never,winnerOrderId:'private'};expect(publicRaffle(raffle,new Date('2026-11-13T02:59:59Z')).lotteryResult).toHaveProperty('sourceUrl');const next=publicRaffle(raffle,new Date('2026-11-13T03:00:00Z'));expect(next).not.toHaveProperty('winnerOrderId');expect(next.lotteryResult).not.toHaveProperty('sourceUrl');expect(next.lotteryResult).not.toHaveProperty('extract');expect(next.lotteryResult?.head).toBe('5737');});
 it('cierra las ventas antes del resultado aunque el administrador ponga una hora posterior',()=>{const draw=new Date('2026-11-13T01:00:00Z');expect(salesClosed(draw,new Date('2026-11-12T23:59:59Z'))).toBe(false);expect(salesClosed(draw,new Date('2026-11-13T00:00:00Z'))).toBe(true);});
 it('el correo al ganador identifica número, fecha y rifa sin publicar DNI ni email',()=>{const mail=notificationMessage('RAFFLE_WINNER',{name:'Ana <b>',raffle:'Rifa prueba',prize:'Premio',numbers:[37],winnerNumber:37,lotteryDate:'2026-11-12',lotteryHead:'5737',digits:2,amountCents:10000,paidAt:'2026-11-12T22:00:00Z',orderId:'o1'},'http://localhost:5173');expect(mail.text).toContain('Número ganador: 37');expect(mail.text).toContain('2026-11-12');expect(mail.text).toContain('/compras/o1');expect(mail.html).not.toContain('<b>');});
});
