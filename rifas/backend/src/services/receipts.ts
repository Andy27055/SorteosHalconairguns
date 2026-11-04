import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '../generated/prisma/client.js';
import { atomic } from '../db.js';
import { AppError } from '../errors.js';
export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
export function receiptMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}
export class ReceiptsService {
  constructor(private db: PrismaClient, private directory: string) {}
  async upload(userId: string, orderId: string, file?: Express.Multer.File) {
    if (!file || !file.size || file.size > 5 * 1024 * 1024) throw new AppError(400, 'Elegí un PDF, JPG o PNG de hasta 5 MB.');
    const mimeType = receiptMime(file.buffer);
    if (!mimeType || mimeType !== file.mimetype) throw new AppError(400, 'El archivo no coincide con un PDF, JPG o PNG válido.');
    const key = randomUUID();
    const uploadedAt = new Date();
    const deleteAfter = addCalendarMonths(uploadedAt, 3);
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(path.join(this.directory, key), file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      return await atomic(this.db, async tx => {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Compra no encontrada.');
        if (order.userId !== userId) throw new AppError(403, 'No es tu compra.');
        if (order.status !== 'AWAITING_RECEIPT' || order.method !== 'TRANSFER' || order.expiresAt < uploadedAt) throw new AppError(409, 'La compra no admite comprobantes o el plazo venció.');
        const receipt = await tx.receipt.create({ data: { orderId, storageKey: key, mimeType, size: file.size, sha256: createHash('sha256').update(file.buffer).digest('hex'), uploadedAt, deleteAfter } });
        await tx.order.update({ where: { id: orderId }, data: { status: 'UNDER_REVIEW' } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'RECEIPT_UPLOADED', entityId: orderId, detail: { receiptId: receipt.id, deleteAfter: deleteAfter.toISOString() } } });
        return { id: receipt.id, uploadedAt, deleteAfter };
      });
    } catch (error) { await fs.unlink(path.join(this.directory, key)).catch(() => {}); throw error; }
  }
  review(actorId: string, id: string, decision: 'approve' | 'reject', note: string) {
    return atomic(this.db, async tx => {
      const order = await tx.order.findUnique({ where: { id }, include: { receipts: true, allocations: true } });
      if (!order) throw new AppError(404, 'Compra no encontrada.');
      if (order.status !== 'UNDER_REVIEW' || order.method !== 'TRANSFER') throw new AppError(409, 'Esta compra no está pendiente de revisión.');
      if (decision === 'approve' && (!order.receipts.some(r => !r.deletedAt && r.deleteAfter > new Date()) || order.allocations.length !== order.numbers.length)) throw new AppError(409, 'No se puede aprobar sin comprobante vigente y todos los números asignados.');
      if (decision === 'reject') await tx.allocation.deleteMany({ where: { orderId: id } });
      const updated = await tx.order.update({ where: { id }, data: { status: decision === 'approve' ? 'PAID' : 'REJECTED', paidAt: decision === 'approve' ? new Date() : null, decisionNote: note, reviewedBy: actorId } });
      await tx.auditLog.create({ data: { actorId, action: decision === 'approve' ? 'TRANSFER_APPROVED' : 'TRANSFER_REJECTED', entityId: id, detail: { note } } });
      return updated;
    });
  }
  async purge(now = new Date()) {
    await fs.mkdir(this.directory, { recursive: true });
    const due = await this.db.receipt.findMany({ where: { deletedAt: null, deleteAfter: { lte: now } } });
    let removed = 0;
    for (const receipt of due) {
      if (!/^[a-z0-9-]{36}$/i.test(receipt.storageKey)) throw new Error('Clave de almacenamiento inválida.');
      try { await fs.unlink(path.join(this.directory, receipt.storageKey)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await this.db.receipt.updateMany({ where: { id: receipt.id, deletedAt: null }, data: { deletedAt: now } });
      await this.db.auditLog.create({ data: { action: 'RECEIPT_FILE_PURGED', entityId: receipt.orderId, detail: { receiptId: receipt.id } } });
      removed++;
    }
    // Recupera archivos huérfanos de caídas entre filesystem y commit; nunca se borra fuera de esta carpeta.
    const known = new Set((await this.db.receipt.findMany({ select: { storageKey: true } })).map(r => r.storageKey));
    for (const key of await fs.readdir(this.directory)) {
      if (!/^[a-z0-9-]{36}$/i.test(key) || known.has(key)) continue;
      const file = path.join(this.directory, key);
      const stat = await fs.stat(file);
      if (stat.isFile() && stat.mtimeMs < now.getTime() - 24 * 3600000) await fs.unlink(file);
    }
    return { removed };
  }
}
