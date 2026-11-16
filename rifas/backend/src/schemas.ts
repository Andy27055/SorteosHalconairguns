import { z } from 'zod';
import {lotteryDigitsFor} from './numbering.js';
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
export const prizeSchema = z.object({ name: text(3, 100), description: text(0, 2000).default(''), kind:z.enum(['ITEM','FREE_TICKET']).default('ITEM') });
export const awardSchema = z.object({ rank: z.number().int().min(1).max(20), prizes: z.array(z.object({prizeId:idSchema,quantity:z.number().int().min(1).max(100).default(1)})).min(1).max(100) }).superRefine((value,ctx)=>{
  if(new Set(value.prizes.map(p=>p.prizeId)).size!==value.prizes.length)ctx.addIssue({code:'custom',path:['prizes'],message:'Un premio se agrega una vez por puesto; usá la cantidad para repetir unidades.'});
});
export const raffleSchema = z.object({
  title: text(3, 100), description: text(0, 3000).default(''), prizeId: idSchema,
  ticketPriceCents: z.number().int().min(100).max(100000000), totalTickets: z.number().int().min(10).max(10000).default(100),
  lotteryDigits:z.number().int().min(1).max(4).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FINISHED']).default('DRAFT'),
  drawAt: z.iso.datetime().nullable().optional(),
  awards:z.array(awardSchema).min(1).max(20).optional(),
}).superRefine((value,ctx)=>{
  if(value.lotteryDigits!==undefined&&value.lotteryDigits!==lotteryDigitsFor(value.totalTickets))ctx.addIssue({code:'custom',path:['lotteryDigits'],message:'Las cifras se calculan automáticamente según la cantidad de números.'});
  if(value.awards){
    const ranks=value.awards.map(a=>a.rank).sort((a,b)=>a-b);
    if(ranks.some((rank,i)=>rank!==i+1))ctx.addIssue({code:'custom',path:['awards'],message:'Los puestos deben ser consecutivos, desde el primero.'});
    if(!value.awards.find(a=>a.rank===1)?.prizes.some(p=>p.prizeId===value.prizeId))ctx.addIssue({code:'custom',path:['awards'],message:'El premio principal debe estar entre los premios del primer puesto.'});
  }
}).transform(value=>({...value,lotteryDigits:lotteryDigitsFor(value.totalTickets)}));
export const reservationSchema = z.object({ raffleId: idSchema, numbers: z.array(z.number().int().min(0).max(10000)).min(1).max(20).refine(a => new Set(a).size === a.length, 'No repitas números.') });
export const rejectionReasonSchema = z.enum(['INCORRECT_AMOUNT','INCORRECT_DETAILS','PAYMENT_NOT_MADE','OTHER']);
export const reviewSchema = z.object({ decision: z.enum(['approve', 'reject']), note: text(0, 500).default(''), reasonCode: rejectionReasonSchema.optional() }).superRefine((value,ctx)=>{
  if(value.decision==='reject'&&value.note.length<5)ctx.addIssue({code:'custom',path:['note'],message:'Para rechazar, explicá el motivo con al menos 5 caracteres.'});
});
export const buyerRemovalSchema = z.object({anchorOrderId:idSchema,version:z.string().regex(/^[a-f0-9]{64}$/),confirmation:z.literal('CONFIRMAR')});
export const customerRefundSchema=z.object({numbers:z.array(z.number().int().min(0).max(10000)).min(1).max(10000).refine(numbers=>new Set(numbers).size===numbers.length,'No repitas números.'),reason:text(0,500).default(''),requestId:z.uuid()});
export const refundRequestReviewSchema=z.object({decision:z.enum(['approve','reject']),note:text(0,500).default('')}).superRefine((value,ctx)=>{if(value.decision==='reject'&&value.note.length<5)ctx.addIssue({code:'custom',path:['note'],message:'Para rechazar, explicá el motivo con al menos cinco caracteres.'});});
export const manualFreeTicketsSchema=z.object({quantity:z.number().int().min(1).max(100),targetRaffleId:idSchema,reason:text(0,500).default(''),requestId:z.uuid()});
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
