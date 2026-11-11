import type { Prisma } from '../generated/prisma/client.js';
// Preserve the historical draw; numbers can be sold again only before a draw.
export async function releaseRefundNumbers(tx: Prisma.TransactionClient, orderId: string) {
  const order=await tx.order.findUniqueOrThrow({where:{id:orderId},select:{raffle:{select:{drawnAt:true,status:true}}}});
  if(!order.raffle.drawnAt&&order.raffle.status!=='FINISHED')await tx.allocation.deleteMany({where:{orderId}});
}
