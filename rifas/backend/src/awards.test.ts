import {describe,it,expect} from 'vitest';
import {raffleSchema} from './schemas.js';
import {officialNumbers,parseNocturna,publicRaffle} from './services/lottery.js';
import {sameAwards} from './services/award-config.js';
import {notificationMessage} from './services/purchase-emails.js';

const base={title:'Rifa varios premios',prizeId:'p1',ticketPriceCents:10000,totalTickets:100};
const officialHtml=()=>`<h3>Quiniela Nocturna</h3><p class="fechaSorteo">12/11/2026</p><p class="nSorteo">Sorteo N°12913</p>${Array.from({length:20},(_,i)=>`<span>${String(i+1).padStart(2,'0')}</span><span>${i===0?'5737':'1245'}</span>`).join('')}`;
describe('puestos y premios de una rifa',()=>{
 it('utiliza dos cifras para cien números y rechaza reglas incompatibles',()=>{
  expect(raffleSchema.parse(base).lotteryDigits).toBe(2);
  for(const lotteryDigits of [null,1,3,4])expect(raffleSchema.safeParse({...base,lotteryDigits}).success).toBe(false);
 });
 it.each([[10,1],[11,2],[50,2],[100,2],[101,3],[1000,3],[1001,4],[10000,4]])('calcula automáticamente las cifras para %i números', (totalTickets,digits)=>{
  expect(raffleSchema.parse({...base,totalTickets}).lotteryDigits).toBe(digits);
  expect(raffleSchema.parse({...base,totalTickets,lotteryDigits:digits}).lotteryDigits).toBe(digits);
  expect(raffleSchema.safeParse({...base,totalTickets,lotteryDigits:digits===2?3:2}).success).toBe(false);
 });
 it.each([1,2,9])('rechaza una rifa de %i números',totalTickets=>{expect(raffleSchema.safeParse({...base,totalTickets}).success).toBe(false);});
 it('permite varios premios por puesto y reutilizarlos en otros puestos',()=>{
  const result=raffleSchema.parse({...base,awards:[{rank:1,prizes:[{prizeId:'p1',quantity:1},{prizeId:'p2',quantity:2}]},{rank:2,prizes:[{prizeId:'p1',quantity:1}]}]});
  expect(result.awards).toHaveLength(2);
 });
 it('rechaza puestos repetidos, saltados, vacíos o más de veinte',()=>{
  for(const awards of [[],[{rank:2,prizes:[{prizeId:'p1'}]}],[{rank:1,prizes:[]}],Array.from({length:21},(_,i)=>({rank:i+1,prizes:[{prizeId:'p1'}]}))])expect(raffleSchema.safeParse({...base,awards}).success).toBe(false);
 });
 it('rechaza cantidades inválidas y duplicados dentro del mismo puesto',()=>{
  for(const prizes of [[{prizeId:'p1',quantity:0}],[{prizeId:'p1',quantity:1.5}],[{prizeId:'p1',quantity:1},{prizeId:'p1',quantity:1}]])expect(raffleSchema.safeParse({...base,awards:[{rank:1,prizes}]}).success).toBe(false);
 });
 it('comparar reglas no depende del orden de carga y sí de cantidades y puestos',()=>{
  const first=[{rank:1,prizes:[{prizeId:'p1',quantity:1},{prizeId:'p2',quantity:2}]}];
  expect(sameAwards(first,[{rank:1,prizes:[...first[0].prizes].reverse()}])).toBe(true);
  expect(sameAwards(first,[{rank:1,prizes:[{prizeId:'p1',quantity:2}]}])).toBe(false);
 });
 it('conserva los veinte resultados y recupera evidencia histórica ya guardada',()=>{
  const result=parseNocturna(officialHtml(),'2026-11-12');
  expect(result.numbers).toHaveLength(20);
  expect(officialNumbers({...result,numbers:undefined},3)).toEqual(result.numbers);
  expect(officialNumbers({...result,numbers:undefined,extract:JSON.stringify({numbers:result.numbers})},3)).toEqual(result.numbers);
 });
 it('no inventa puestos faltantes en una fuente incompleta',()=>{
  const result={...parseNocturna(officialHtml(),'2026-11-12'),numbers:undefined,extract:''};
  expect(officialNumbers(result,1)).toEqual(['5737']);
  expect(()=>officialNumbers(result,2)).toThrow('todos los puestos');
  expect(()=>officialNumbers({...result,numbers:['5737']},1)).toThrow();
 });
 it('los correos de un ganador incluyen todos sus puestos y los premios obtenidos',()=>{
  const message=notificationMessage('RAFFLE_WINNER',{name:'Ana',raffle:'Rifa',prize:'Catálogo',numbers:[37,45],amountCents:10000,paidAt:'2026-11-14',orderId:'o',winnerNumber:37,lotteryDate:'2026-11-14',lotteryHead:'5737',digits:2,wonAwards:[{rank:1,number:37,officialNumber:'5737',prizes:'Rifle <b>'},{rank:2,number:45,officialNumber:'1245',prizes:'2 × Mira'}]},'https://test.invalid');
  expect(message.text).toContain('1.º puesto');expect(message.text).toContain('2.º puesto');expect(message.text).toContain('Mira');expect(message.html).not.toContain('Rifle <b>');
 });
});
