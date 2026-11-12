import './config.js';
import { PrismaClient, Prisma } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://halcon:halcon_local@localhost:5432/halcon', connectionTimeoutMillis: 5000, max: 10 }) });
export async function atomic<T>(db: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10000 }); }
    catch (error) {
      if ((error as {code?: string}).code === 'P2034' && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error('No se pudo completar la transacción.');
}
