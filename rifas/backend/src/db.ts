import { config } from './config.js';
import { PrismaClient, Prisma } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { transactionConflict } from './transaction-conflict.js';
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://halcon:halcon_local@localhost:5432/halcon', connectionTimeoutMillis: 5000, max: config.dbPoolMax }) });
export async function atomic<T>(db: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10000, maxWait: 5000 }); }
    catch (error) {
      if (transactionConflict(error) && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, (20 + Math.random() * 40) * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('No se pudo completar la transacción.');
}
