import { z } from 'zod';
const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
export const idSchema = text(1, 100).regex(/^[a-zA-Z0-9_-]+$/);
export const registerSchema = z.object({
  username: text(3, 30).regex(/^[a-zA-Z0-9_.-]+$/, 'Usá letras, números, punto, guion o guion bajo.').transform(v => v.toLowerCase()),
  email: z.email('Ingresá un email válido.').max(254).transform(v => v.toLowerCase()),
  fullName: text(3, 201).optional(), firstName: text(1, 100).optional(), lastName: text(1, 100).optional(), password: z.string().min(10, 'Usá al menos 10 caracteres.').max(128),
  dni: z.string().trim().regex(/^\d{7,8}$/, 'Ingresá 7 u 8 dígitos.').optional().or(z.literal('')),
  address: text(0, 200).optional(),
}).superRefine((value, ctx) => {
  if (!value.fullName && (!value.firstName || !value.lastName)) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Completá nombre y apellido.' });
  if (!!value.firstName !== !!value.lastName) ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Completá nombre y apellido por separado.' });
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
export const rejectionReasonSchema = z.enum(['INCORRECT_AMOUNT','INCORRECT_DETAILS','PAYMENT_NOT_MADE','OTHER']);
export const reviewSchema = z.object({ decision: z.enum(['approve', 'reject']), note: text(0, 500).default(''), reasonCode: rejectionReasonSchema.optional() }).superRefine((value,ctx)=>{
  if(value.decision==='reject'&&value.note.length<5)ctx.addIssue({code:'custom',path:['note'],message:'Para rechazar, explicá el motivo con al menos 5 caracteres.'});
});
export const buyerRemovalSchema = z.object({anchorOrderId:idSchema,version:z.string().regex(/^[a-f0-9]{64}$/),confirmation:z.literal('CONFIRMAR')});
export const refundCompletionSchema = z.object({confirmation:z.literal('CONFIRMAR'),reference:text(5,200),amountCents:z.number().int().min(1).max(2000000000)});
export const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN']), active: z.boolean() });
export const profileSchema = z.object({ fullName: text(3, 201).optional(), firstName: text(1, 100).optional(), lastName: text(1, 100).optional(), email: registerSchema.shape.email, dni: registerSchema.shape.dni, address: registerSchema.shape.address }).superRefine((value, ctx) => {
  if (!value.fullName && (!value.firstName || !value.lastName)) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Completá nombre y apellido.' });
  if (!!value.firstName !== !!value.lastName) ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Completá nombre y apellido por separado.' });
});
export const buyerSchema = z.object({ firstName: text(1,100), lastName: text(1,100), email: registerSchema.shape.email, dni: z.string().trim().regex(/^\d{7,8}$/, 'Ingresá el DNI con 7 u 8 dígitos, sin puntos.') });
export function identityFields(input: { fullName?: string; firstName?: string; lastName?: string }) {
  return { fullName: input.firstName && input.lastName ? `${input.firstName} ${input.lastName}` : input.fullName!, ...(input.firstName ? { firstName: input.firstName, lastName: input.lastName! } : {}) };
}
