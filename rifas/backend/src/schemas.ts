import { z } from 'zod';
const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
export const idSchema = text(1, 100).regex(/^[a-zA-Z0-9_-]+$/);
export const registerSchema = z.object({
  username: text(3, 30).regex(/^[a-zA-Z0-9_.-]+$/, 'Usá letras, números, punto, guion o guion bajo.').transform(v => v.toLowerCase()),
  email: z.email('Ingresá un email válido.').max(254).transform(v => v.toLowerCase()),
  fullName: text(3, 100), password: z.string().min(10, 'Usá al menos 10 caracteres.').max(128),
  dni: z.string().trim().regex(/^\d{7,8}$/, 'Ingresá 7 u 8 dígitos.').optional().or(z.literal('')),
  address: text(0, 200).optional(),
});
export const loginSchema = z.object({ login: text(1, 254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });
export const prizeSchema = z.object({ name: text(3, 100), description: text(0, 2000).default('') });
export const raffleSchema = z.object({
  title: text(3, 100), description: text(0, 3000).default(''), prizeId: idSchema,
  ticketPriceCents: z.number().int().min(100).max(100000000), totalTickets: z.number().int().min(1).max(10000),
  status: z.enum(['DRAFT', 'ACTIVE', 'FINISHED']).default('DRAFT'),
  drawAt: z.iso.datetime().nullable().optional(),
});
export const reservationSchema = z.object({ raffleId: idSchema, numbers: z.array(z.number().int().min(1).max(10000)).min(1).max(20).refine(a => new Set(a).size === a.length, 'No repitas números.') });
export const reviewSchema = z.object({ decision: z.enum(['approve', 'reject']), note: text(5, 500) });
export const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN']), active: z.boolean() });
export const profileSchema = registerSchema.pick({ fullName: true, email: true, dni: true, address: true });
