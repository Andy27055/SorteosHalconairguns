import { config, validateConfig } from './config.js';
import { prisma, atomic } from './db.js';
import { createApp } from './app.js';
import { ReceiptsService } from './services/receipts.js';
import { expireOrders } from './services/orders.js';
validateConfig();
await prisma.$connect();
const receipts = new ReceiptsService(prisma, config.receiptDir);
let maintenanceRunning = false;
async function maintain() {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try { await atomic(prisma, expireOrders); await receipts.purge(); }
  catch (error) { console.error('[mantenimiento]', error instanceof Error ? error.message : 'Error'); }
  finally { maintenanceRunning = false; }
}
await maintain();
const timer = setInterval(maintain, 60000);
const server = createApp().listen(config.port, () => console.log(`Halcón Airguns API: http://localhost:${config.port}`));
server.on('error', async () => { clearInterval(timer); console.error(`No se pudo abrir el puerto ${config.port}. Revisá PORT o cerrá el otro servidor que lo esté usando.`); await prisma.$disconnect(); process.exit(1); });
async function close() { clearInterval(timer); server.close(); await prisma.$disconnect(); process.exit(0); }
process.on('SIGTERM', close); process.on('SIGINT', close);
