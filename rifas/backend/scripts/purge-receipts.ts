import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { ReceiptsService } from '../src/services/receipts.js';
try { console.log(await new ReceiptsService(prisma, config.receiptDir).purge()); }
finally { await prisma.$disconnect(); }
