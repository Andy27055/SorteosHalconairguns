export interface User { adminType?:'PRIMARY'|'FUNCTIONAL'|null; emailVerifiedAt?:string|null; id: string; username: string; email: string; fullName: string; firstName?: string | null; lastName?: string | null; role: 'USER' | 'ADMIN'; active?: boolean; createdAt?: string; dni?: string; address?: string }
export interface GuestReservation { raffle?:Pick<Raffle,'totalTickets'>; id: string; raffleId: string; numbers: number[]; expiresAt: string }
export type PrizeKind = 'ITEM'|'FREE_TICKET';
export interface FreeTicketBenefit {id:string;quantity:number;remaining:number;revoked:boolean;available:boolean;rank:number|null;reason?:string|null;targetRaffle?:{id:string;title:string;status:string}|null;sourceRaffle:{id:string;title:string;status:string}|null;availableRaffles:{id:string;title:string;status:string}[]}
export interface Prize {kind?:PrizeKind; id: string; name: string; description: string }
export interface AdminRaffle extends Raffle { revenueCents: number }
export interface AwardInput {rank:number;prizes:{prizeId:string;quantity:number}[]}
export interface RaffleAward {id?:string;rank:number;winningNumber?:number|null;officialNumber?:string|null;winnerDisplayName?:string|null;prizes:{kind?:PrizeKind;prizeId:string;name:string;description:string;quantity:number}[]}
export interface Raffle { awards?:RaffleAward[];hasOrders?:boolean; closingAt?:string|null;resultDate?:string|null;closedEarly?:boolean;closingNote?:string|null;cancelledAt?:string|null;cancellationReason?:string|null; numberStart?:number;lotteryDigits?:number|null;winnerDisplayName?:string|null;lotteryResult?:{date:string;head:string;drawNumber:string;sourceUrl?:string;sourceSha256:string;checkedAt:string}|null; id: string; title: string; description: string; prize: Prize; prizeId: string; ticketPriceCents: number; totalTickets: number; status: 'DRAFT' | 'ACTIVE' | 'CLOSING' | 'FINISHED' | 'CANCELLED'; drawAt?: string | null; winnerNumber?: number | null; drawnAt?: string; sold?: number; available?: number }
export interface Receipt { id: string; mimeType: string; size: number; uploadedAt: string; deleteAfter: string; deletedAt?: string | null }
export type OrderStatus = 'RESERVED' | 'PAYMENT_PENDING' | 'AWAITING_RECEIPT' | 'UNDER_REVIEW' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'NEEDS_ATTENTION' | 'REFUND_PENDING' | 'REFUNDED';
export interface Order { parentOrderId?:string|null;originalNumbers?:number[];originalAmountCents?:number|null;refundRequests?:CustomerRefundRequest[];refundParts?:{id:string;numbers:number[];amountCents:number;status:OrderStatus;refundCompletedAt:string|null}[]; id: string; userId: string | null; user?: User | null; raffle: Raffle; raffleId: string; numbers: number[]; unitPriceCents: number; amountCents: number; status: OrderStatus; method?: 'MERCADO_PAGO' | 'TRANSFER' | 'FREE_TICKET'; transferAccountId?: string | null; transferHolder?: string | null; transferAlias?: string | null; transferCbu?: string | null; expiresAt: string; createdAt: string; paidAt?: string; receipts?: Receipt[]; decisionNote?: string; checkoutUrl?: string; buyerEmail?:string|null;buyerFirstName?:string|null;buyerLastName?:string|null;buyerDni?:string|null;refundRequestedAt?:string|null;refundCompletedAt?:string|null;refundAmountCents?:number|null;refundReference?:string|null }
export interface Page<T> { items: T[]; total: number; page: number }
export interface BuyerPurchase {id:string;numbers:number[];amountCents:number;method:string|null;paidAt:string|null}
export interface BuyerRecord {id:string;version:string;email:string;firstName:string;lastName:string;dni:string;numbers:number[];amountCents:number;orders:BuyerPurchase[];incomplete:boolean;emailStatuses:string[]}
export interface PendingRefund {id:string;email:string;firstName:string;lastName:string;dni:string;numbers:number[];amountCents:number;refundAmountCents:number|null;requestedAt:string;reason:string;reasonCode?:string|null}
export interface TransferAccount { id: string; holder: string; alias: string; cbu: string }
export interface PaymentConfig { mercadoPago: boolean; sandbox: boolean; transfer: boolean; transferAccounts?: TransferAccount[]; transferAlias: string; transferCbu: string; transferHolder: string; receiptMaxMb: number; receiptRetentionMonths: number }
export const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const ticketDigits=(totalTickets:number)=>Math.max(1,String(Math.max(0,totalTickets-1)).length);
export const ticketNumber=(number:number,raffle:Pick<Raffle,'totalTickets'>)=>String(number).padStart(ticketDigits(raffle.totalTickets),'0');
export function nocturnaDay(now=new Date()){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return new Date(`${day}T12:00:00Z`).getUTCDay()!==0;}
export const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value));
export const statusLabels: Record<OrderStatus, string> = { RESERVED: 'Reservada', PAYMENT_PENDING: 'Pago pendiente', AWAITING_RECEIPT: 'Falta comprobante', UNDER_REVIEW: 'En revisión', PAID: 'Pago confirmado', REJECTED: 'Rechazada', CANCELLED: 'Cancelada', EXPIRED: 'Reserva vencida', NEEDS_ATTENTION: 'Requiere atención', REFUND_PENDING: 'Reembolso en gesti\u00f3n', REFUNDED: 'Reembolsada / contracargo' };

export const adminLabel=(user:Pick<User,"role"|"adminType">)=>user.role==="ADMIN"?(user.adminType==="PRIMARY"?"Administrador principal":"Administrador funcional"):"Cliente";

export function raffleAcceptingNumbers(r:Pick<Raffle,'status'|'drawAt'>,now=Date.now()){
 if(r.status!=='ACTIVE')return false;if(!r.drawAt)return true;
 const planned=new Date(r.drawAt);const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(planned);
 return now<Math.min(planned.getTime(),new Date(`${day}T21:00:00-03:00`).getTime());
}

export interface CustomerRefundRequest {id:string;orderId:string;numbers:number[];amountCents:number;reason:string;status:'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED';decisionNote?:string|null;createdAt:string;reviewedAt?:string|null;refundOrderId?:string|null}
