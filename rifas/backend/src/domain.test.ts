import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { addCalendarMonths, receiptMime } from './services/receipts.js';
import { validWebhook } from './services/payments.js';
import { registerSchema, reservationSchema, raffleSchema, reviewSchema } from './schemas.js';
describe('conservación de comprobantes', () => {
  it('vence a los tres meses calendario, ajustando el último día', () => expect(addCalendarMonths(new Date('2026-01-31T12:30:00Z'),3).toISOString()).toBe('2026-04-30T12:30:00.000Z'));
  it('respeta febrero de año bisiesto', () => expect(addCalendarMonths(new Date('2023-11-30T12:30:00Z'),3).toISOString()).toBe('2024-02-29T12:30:00.000Z'));
  it('conserva la hora y cruza el año', () => expect(addCalendarMonths(new Date('2026-10-31T03:01:02Z'),3).toISOString()).toBe('2027-01-31T03:01:02.000Z'));
  it.each([[Buffer.from('%PDF-1.7'),'application/pdf'],[Buffer.from([137,80,78,71,13,10,26,10]),'image/png'],[Buffer.from([255,216,255,224]),'image/jpeg'],[Buffer.from('<script>bad</script>'),null],[Buffer.alloc(0),null]])('reconoce contenido y rechaza archivos ajenos', (buffer,mime)=>expect(receiptMime(buffer)).toBe(mime));
});
describe('notificaciones de Mercado Pago',()=>{
  const secret='test-secret';const id='123';const requestId='request-1';const ts='1793410000';
  const hash=createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  it('acepta firma correcta',()=>expect(validWebhook(`ts=${ts},v1=${hash}`,requestId,id,secret)).toBe(true));
  it('rechaza otro identificador',()=>expect(validWebhook(`ts=${ts},v1=${hash}`,requestId,'456',secret)).toBe(false));
  it('rechaza firma vacía o mal formada sin fallar',()=>{expect(validWebhook('',requestId,id,secret)).toBe(false);expect(validWebhook(`ts=${ts},v1=xx`,requestId,id,secret)).toBe(false);});
  it('no permite webhook sin secreto',()=>expect(validWebhook(`ts=${ts},v1=${hash}`,requestId,id,'')).toBe(false));
});
describe('validaciones del dominio',()=>{
  const data={username:'participante',email:'user@example.com',fullName:'Usuario Ejemplo',password:'password-segura'};
  it('registro público descarta rol enviado por el cliente',()=>expect(registerSchema.parse({...data,role:'ADMIN'})).not.toHaveProperty('role'));
  it('rechaza nombres que contengan HTML',()=>expect(registerSchema.safeParse({...data,username:'<img src=x>'}).success).toBe(false));
  it('rechaza DNI con puntos y nombres vacíos',()=>{expect(registerSchema.safeParse({...data,dni:'12.345.678'}).success).toBe(false);expect(registerSchema.safeParse({...data,fullName:'   '}).success).toBe(false);});
  it.each([[1,1],[0],[1.2],Array.from({length:21},(_,i)=>i+1)])('rechaza selección inválida',numbers=>expect(reservationSchema.safeParse({raffleId:'test',numbers}).success).toBe(false));
  it('acepta selección válida',()=>expect(reservationSchema.parse({raffleId:'test',numbers:[1,100]}).numbers).toEqual([1,100]));
  it('rechaza precios negativos y cantidades fraccionarias',()=>expect(raffleSchema.safeParse({title:'Rifa',prizeId:'p1',ticketPriceCents:-100,totalTickets:1.5}).success).toBe(false));
});

describe('observación según la decisión del comprobante',()=>{
  it('permite aprobar sin observación o con un comentario breve',()=>{expect(reviewSchema.parse({decision:'approve'}).note).toBe('');expect(reviewSchema.parse({decision:'approve',note:'  '}).note).toBe('');expect(reviewSchema.parse({decision:'approve',note:'OK'}).note).toBe('OK');});
  it('exige un motivo válido al rechazar',()=>{for(const note of [undefined,'','   ','No'])expect(reviewSchema.safeParse({decision:'reject',note}).success).toBe(false);expect(reviewSchema.parse({decision:'reject',note:'  Importe incorrecto.  '}).note).toBe('Importe incorrecto.');});
});
