import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: path.join(root, '.env'), quiet: true } as dotenv.DotenvConfigOptions);
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true } as dotenv.DotenvConfigOptions);
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
  demoAccessCode: process.env.DEMO_ACCESS_CODE || '',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiUrl: (process.env.PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || randomBytes(48).toString('hex'),
  jwtHours: 8,
  dbPoolMax: z.coerce.number().int().min(1).max(100).default(10).parse(process.env.DB_POOL_MAX),
  receiptMaxConcurrent: z.coerce.number().int().min(1).max(32).default(4).parse(process.env.RECEIPT_MAX_CONCURRENT),
  mpToken: process.env.MP_ACCESS_TOKEN || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  mpSandbox: process.env.MP_SANDBOX !== 'false',
  transferAlias: process.env.TRANSFER_ALIAS || '',
  transferCbu: process.env.TRANSFER_CBU || '',
  transferHolder: process.env.TRANSFER_HOLDER || '',
  transferAlias2: process.env.TRANSFER_ALIAS_2 || '',
  transferCbu2: process.env.TRANSFER_CBU_2 || '',
  transferHolder2: process.env.TRANSFER_HOLDER_2 || '',
  smtpEnabled: process.env.SMTP_ENABLED === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  receiptDir: path.resolve(process.env.RECEIPT_STORAGE_PATH || path.join(root, '..', 'data', 'receipts')),
  frontendDist: path.resolve(root, '..', 'frontend', 'dist'),
};
export type AppConfig = typeof config;
export function validateConfig() {
  if (config.demoAccessCode && config.demoAccessCode.length < 24) throw new Error('La clave de demostración debe tener al menos 24 caracteres.');
  if (config.production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('REEMPLAZAR'))) throw new Error('JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres en producción.');
  if (config.production && !process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  if (config.production && (!config.frontendUrl.startsWith('https://') || !config.apiUrl.startsWith('https://'))) throw new Error('Las URLs públicas deben usar HTTPS.');
  if (config.mpToken && (!config.mpWebhookSecret || !config.apiUrl.startsWith('https://'))) throw new Error('Para Mercado Pago configurá MP_WEBHOOK_SECRET y PUBLIC_API_URL HTTPS.');
  if (config.smtpEnabled && (!config.smtpHost || !z.email().safeParse(config.smtpFrom).success || !Number.isInteger(config.smtpPort) || config.smtpPort < 1 || config.smtpPort > 65535)) throw new Error('Completá SMTP_HOST, un email SMTP_FROM válido y un puerto válido antes de habilitar los correos.');
  if (config.production && (process.env.ADMIN_PASSWORD || '').length > 0) console.warn('Retirá ADMIN_PASSWORD del entorno después de ejecutar el seed.');
}
