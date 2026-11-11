import type { Order } from '../types';
import { money } from '../types';
export function OrderOutcomeNotice({order}:{order:Order}){
  if(order.status==='REFUND_PENDING')return <div className="notice warning" role="status"><b>Compra dada de baja.</b> Tu reembolso está en gestión, con un plazo estimado de 24 a 72 horas hábiles. No vuelvas a pagar esta compra.</div>;
  if(order.status==='REJECTED'&&order.refundRequestedAt&&!order.refundCompletedAt)return <div className="notice warning" role="status"><b>Compra rechazada por monto incorrecto.</b> El reembolso del importe efectivamente acreditado se gestionará en un plazo de 24 a 48 horas.</div>;
  if(order.status==='REFUNDED')return <div className="notice" role="status"><b>Reembolso registrado.</b>{order.refundAmountCents&&<> Importe: {money(order.refundAmountCents)}.</>} Revisá la acreditación en tu medio de pago original.</div>;
  return null;
}
