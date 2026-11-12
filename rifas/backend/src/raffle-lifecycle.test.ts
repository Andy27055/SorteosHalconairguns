import {describe,it,expect} from 'vitest';
import {parseHistoricalText} from './services/lottery-history.js';
import {raffleMessage} from './services/raffle-emails.js';
const positions=Array.from({length:20},(_,i)=>`${i+1} ${i===0?'3966':String(1000+i)}`).join(' ');
const official=`11/11/2026 EXTRACTO OFICIAL QUINIELA MULTIPLE 12912 Realizado a las PROVINCIA NOCTURNA 21:02 3966 1º Premi ${positions} SANTA FE NOCTURNA`;
describe('extracto histórico oficial',()=>{
 it('verifica Provincia, Nocturna, fecha y veinte posiciones, incluida la cabeza',()=>expect(parseHistoricalText(official,'2026-11-11')).toMatchObject({head:'3966',drawNumber:'12912',numbers:expect.arrayContaining(['3966','1019'])}));
 it('rechaza otra fecha o jurisdicción',()=>{expect(()=>parseHistoricalText(official,'2026-11-12')).toThrow();expect(()=>parseHistoricalText(official.replace('PROVINCIA','CIUDAD'),'2026-11-11')).toThrow();});
 it('rechaza un primer premio contradictorio o posiciones faltantes',()=>{expect(()=>parseHistoricalText(official.replace('1 3966','1 5555'),'2026-11-11')).toThrow('inconsistentes');expect(()=>parseHistoricalText(official.replace('20 1019',''),'2026-11-11')).toThrow('incompleto');});
});
describe('avisos del ciclo de una rifa',()=>{
 const payload={raffleId:'r',title:'Rifa\r\nprueba',name:'Ana <script>',date:'2026-11-12',numbers:[0,37],reason:'Problema <b> & organización',digits:2,winnerName:'Ana Pérez',winnerEmail:'ana@example.com',winnerNumber:37,head:'5737'};
 it('informa cancelación con motivo opcional, números y devolución en gestión',()=>{const mail=raffleMessage('RAFFLE_CANCELLED',payload,'https://halcon.example.com');expect(mail.text).toContain('canceló');expect(mail.text).toContain('00, 37');expect(mail.text).toContain('24 a 72 horas hábiles');expect(mail.html).toContain('&lt;b&gt;');expect(mail.html).not.toContain('<script>');expect(mail.subject).not.toMatch(/[\r\n]/);expect(raffleMessage('RAFFLE_CANCELLED',{...payload,reason:null},'https://halcon.example.com').text).not.toContain('Motivo:');});
 it('el cierre anticipado no inventa un ganador ni asegura un resultado aún no publicado',()=>{const mail=raffleMessage('RAFFLE_EARLY_CLOSURE',payload,'https://halcon.example.com');expect(mail.text).toContain('2026-11-12');expect(mail.text).toContain('esperará');expect(mail.text).not.toContain('Ganador:');});
 it('el aviso privado a los administradores incluye quién ganó y el número',()=>{const mail=raffleMessage('RAFFLE_RESULT_ADMIN',payload,'https://halcon.example.com');expect(mail.text).toContain('Ganador: Ana Pérez');expect(mail.text).toContain('Número ganador: 37');expect(mail.text).toContain('ana@example.com');expect(mail.text).toContain('/admin');});
});
