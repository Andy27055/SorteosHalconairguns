import ExcelJS from 'exceljs';
import type { PrismaClient } from '../generated/prisma/client.js';
export interface Buyer { email: string; lastName: string; firstName: string; dni: string; numbers: number[]; amountCents: number; incomplete: boolean; emailStatuses: string[] }
export class BuyersService {
  constructor(private db: PrismaClient) {}
  async list(raffleId: string) {
    const raffle = await this.db.raffle.findUniqueOrThrow({ where: { id: raffleId }, select: { id: true, title: true } });
    const orders = await this.db.order.findMany({ where: { raffleId, status: 'PAID', userId: { not: null } }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true, dni: true } }, confirmationEmail: { select: { status: true } } }, orderBy: [{ paidAt: 'asc' }, { id: 'asc' }] });
    const grouped = new Map<string, Buyer>();
    for (const order of orders) {
      const identity = { email: order.buyerEmail ?? order.user?.email ?? '', lastName: order.buyerLastName ?? order.user?.lastName ?? '', firstName: order.buyerFirstName ?? order.user?.firstName ?? '', dni: order.buyerDni ?? order.user?.dni ?? '' };
      const key = JSON.stringify([order.userId, identity]);
      const previous = grouped.get(key);
      if (previous) { previous.numbers = [...new Set([...previous.numbers, ...order.numbers])].sort((a,b) => a-b); previous.amountCents += order.amountCents; previous.emailStatuses.push(order.confirmationEmail?.status || 'NOT_QUEUED'); }
      else grouped.set(key, { ...identity, numbers: [...order.numbers].sort((a,b) => a-b), amountCents: order.amountCents, incomplete: Object.values(identity).some(v => !v), emailStatuses: [order.confirmationEmail?.status || 'NOT_QUEUED'] });
    }
    const buyers = [...grouped.values()].sort((a,b) => a.lastName.localeCompare(b.lastName, 'es') || a.firstName.localeCompare(b.firstName, 'es'));
    return { raffle, buyers, soldNumbers: buyers.reduce((sum,b) => sum+b.numbers.length,0) };
  }
}
export async function buyersWorkbook(title: string, buyers: Buyer[]) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'Halcón Airguns'; workbook.title = title;
  const sheet = workbook.addWorksheet('Compradores', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [{ header: 'Email', key: 'email', width: 36 }, { header: 'Apellido', key: 'lastName', width: 25 }, { header: 'Nombre', key: 'firstName', width: 25 }, { header: 'DNI', key: 'dni', width: 16 }, { header: 'Números comprados', key: 'numbers', width: 55 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF15140F' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCDA34B' } };
  for (const buyer of buyers) {
    let chunk: string[] = []; let length = 0;
    const add = () => { sheet.addRow({ email: buyer.email, lastName: buyer.lastName, firstName: buyer.firstName, dni: buyer.dni, numbers: chunk.join(', ') }); chunk = []; length = 0; };
    for (const number of buyer.numbers) {
      const value = String(number).padStart(3, '0');
      if (length + value.length + 2 > 30000) add();
      chunk.push(value); length += value.length + 2;
    }
    if (chunk.length) add();
  }
  for (const column of sheet.columns) column.numFmt = '@';
  sheet.autoFilter = { from: 'A1', to: `E${Math.max(1, sheet.rowCount)}` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
