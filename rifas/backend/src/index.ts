import { PurchaseEmailWorker } from './services/purchase-emails.js';
import { VerificationEmailWorker } from './services/verification.js';
import {RaffleEmailWorker} from './services/raffle-emails.js';
import {LotteryService} from './services/lottery.js';
import { config, validateConfig } from './config.js';
import { prisma, atomic } from './db.js';
import { createApp } from './app.js';
import { ReceiptsService } from './services/receipts.js';
import { expireOrders } from './services/orders.js';
validateConfig();
await prisma.$connect();
const receipts = new ReceiptsService(prisma, config.receiptDir);
const emails = new PurchaseEmailWorker(prisma, config);
const verificationEmails=new VerificationEmailWorker(prisma,config);
const raffleEmails=new RaffleEmailWorker(prisma,config);
const lottery=new LotteryService(prisma);
let mailRunning=false;
async function sendEmails(){if(mailRunning)return;mailRunning=true;try{await emails.process();await verificationEmails.process();await raffleEmails.process();}catch{console.error('[correos] No se pudo procesar la cola. Se reintenta en el siguiente ciclo.');}finally{mailRunning=false;}}
let maintenanceRunning = false;
async function maintain() {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try { await atomic(prisma, expireOrders); await receipts.purge(); }
  catch (error) { console.error('[mantenimiento]', error instanceof Error ? error.message : 'Error'); }
  finally { maintenanceRunning = false; }
}
await maintain();
void sendEmails();
const timer = setInterval(maintain, 60000);
const mailTimer = setInterval(sendEmails, 30000);
let closingRunning=false;
async function finishScheduled(){if(closingRunning)return;closingRunning=true;try{const result=await lottery.runScheduled();if(result.failed)console.error(`[rifas] ${result.failed} cierres no se pudieron procesar. Se reintentarán en el próximo ciclo.`);}catch{console.error('[rifas] No se pudo completar el cierre automático. Se reintentará en el próximo ciclo.');}finally{closingRunning=false;}}
void finishScheduled();
const closingTimer=setInterval(finishScheduled,60000);
const server = createApp().listen(config.port, config.host, () => console.log(`Halcón Airguns API: http://localhost:${config.port}`));
server.on('error', async () => { clearInterval(timer); clearInterval(mailTimer);clearInterval(closingTimer); console.error(`No se pudo abrir el puerto ${config.port}. Revisá PORT o cerrá el otro servidor que lo esté usando.`); await prisma.$disconnect(); process.exit(1); });
async function close() { clearInterval(timer); clearInterval(mailTimer);clearInterval(closingTimer); server.close(); await prisma.$disconnect(); process.exit(0); }
process.on('SIGTERM', close); process.on('SIGINT', close);
