import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: path.join(root, '.env'), quiet: true } as dotenv.DotenvConfigOptions);
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true } as dotenv.DotenvConfigOptions);
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiUrl: (process.env.PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || randomBytes(48).toString('hex'),
  jwtHours: 8,
  mpToken: process.env.MP_ACCESS_TOKEN || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  mpSandbox: process.env.MP_SANDBOX !== 'false',
  transferAlias: process.env.TRANSFER_ALIAS || '',
  transferCbu: process.env.TRANSFER_CBU || '',
  transferHolder: process.env.TRANSFER_HOLDER || '',
  receiptDir: path.resolve(process.env.RECEIPT_STORAGE_PATH || path.join(root, '..', 'data', 'receipts')),
  frontendDist: path.resolve(root, '..', 'frontend', 'dist'),
};
export type AppConfig = typeof config;
export function validateConfig() {
  if (config.production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('REEMPLAZAR'))) throw new Error('JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres en producción.');
  if (config.production && !process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  if (config.production && (!config.frontendUrl.startsWith('https://') || !config.apiUrl.startsWith('https://'))) throw new Error('Las URLs públicas deben usar HTTPS.');
  if (config.mpToken && (!config.mpWebhookSecret || !config.apiUrl.startsWith('https://'))) throw new Error('Para Mercado Pago configurá MP_WEBHOOK_SECRET y PUBLIC_API_URL HTTPS.');
  if (config.production && (process.env.ADMIN_PASSWORD || '').length > 0) console.warn('Retirá ADMIN_PASSWORD del entorno después de ejecutar el seed.');
}
