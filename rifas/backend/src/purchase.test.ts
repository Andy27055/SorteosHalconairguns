import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buyersWorkbook } from './services/buyers.js';
import { purchaseMessage, notificationMessage, mailConfigured } from './services/purchase-emails.js';
import { config } from './config.js';
describe('Excel de compradores',()=>{
  it('genera XLSX real con columnas solicitadas, DNI de texto y números completos',async()=>{
    const bytes=await buyersWorkbook('Rifa de prueba',[{email:'buyer@example.com',firstName:'Ana',lastName:'Pérez',dni:'01234567',numbers:[1,23,100],amountCents:300000,incomplete:false,emailStatuses:['PENDING']}]);
    const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);const sheet=book.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([, 'Email','Apellido','Nombre','DNI','Números comprados']);
    expect(sheet.getCell('D2').value).toBe('01234567');expect(sheet.getCell('E2').value).toBe('001, 023, 100');
    expect(sheet.getCell('B2').value).toBe('Pérez');expect(sheet.getCell('C2').value).toBe('Ana');
  });
  it('los textos que comienzan con = siguen siendo texto y no fórmulas',async()=>{
    const bytes=await buyersWorkbook('Rifa',[{email:'test@example.com',firstName:'=HYPERLINK("malicioso")',lastName:'Apellido',dni:'12345678',numbers:[2],amountCents:100,incomplete:false,emailStatuses:[]}]);
    const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);expect(book.worksheets[0].getCell('C2').type).toBe(ExcelJS.ValueType.String);
  });
});
describe('confirmación de compra por correo',()=>{
  const payload={name:'Ana <script>',raffle:'Rifa & premio',prize:'Premio',numbers:[1,23],amountCents:1000000,paidAt:'2026-11-07T12:00:00Z',orderId:'order-1'};
  it('incluye rifa, números, total y enlace a la compra',()=>{const mail=purchaseMessage(payload,'https://halcon.example.com');expect(mail.text).toContain('001, 023');expect(mail.text).toContain('Rifa & premio');expect(mail.text).toContain('/compras/order-1');expect(mail.text).toContain('10.000');});
  it('escapa datos de usuarios en el HTML',()=>{const mail=purchaseMessage(payload,'https://halcon.example.com');expect(mail.html).toContain('&lt;script&gt;');expect(mail.html).not.toContain('<script>');});
  it('no habilita envíos sin configuración SMTP explícita',()=>expect(mailConfigured({...config,smtpEnabled:false,smtpHost:'',smtpFrom:''})).toBe(false));
  it('el rechazo incluye el comentario escapado y el plazo correcto para monto incorrecto',()=>{const mail=notificationMessage('PURCHASE_REJECTED',{...payload,note:'Importe <incorrecto> & recibido',reasonCode:'INCORRECT_AMOUNT'},'https://halcon.example.com');expect(mail.text).toContain('24 a 48 horas');expect(mail.html).toContain('&lt;incorrecto&gt;');expect(mail.html).not.toContain('<incorrecto>');});
  it('la baja informa gestión en 24 a 72 horas hábiles y no asegura que el dinero ya salió',()=>{const mail=notificationMessage('REFUND_REQUESTED',payload,'https://halcon.example.com');expect(mail.text).toContain('24 a 72 horas hábiles');expect(mail.text).toContain('en gestión');expect(mail.text).not.toContain('ya fue devuelto');});
});
