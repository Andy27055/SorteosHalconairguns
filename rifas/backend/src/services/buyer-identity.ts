import type { Prisma } from '../generated/prisma/client.js';
import { buyerSchema } from '../schemas.js';
import { AppError } from '../errors.js';
export async function buyerSnapshot(tx: Prisma.TransactionClient, userId: string | null) {
  if (!userId) throw new AppError(401, 'Iniciá sesión para completar la compra.');
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const result = buyerSchema.safeParse(user);
  if (!result.success) throw new AppError(400, 'Completá nombre, apellido, email y DNI en los datos del comprador antes de pagar.');
  return { buyerEmail: result.data.email, buyerFirstName: result.data.firstName, buyerLastName: result.data.lastName, buyerDni: result.data.dni };
}
