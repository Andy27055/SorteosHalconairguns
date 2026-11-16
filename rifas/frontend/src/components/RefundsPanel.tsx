import {RefundRequestsPanel} from './RefundRequestsPanel';
import {useEffect,useState} from 'react';
import {Button} from 'react-bootstrap';
import {useFetch} from '../hooks/useFetch';
import {date,money,ticketNumber,type Order,type Page,type PendingRefund} from '../types';
import {pendingRefundFromOrder,RefundCompletionDialog} from './BuyerRefundDialogs';
import {ErrorBox,Loading,Status} from './UI';

export function RefundsPanel({onChanged,revision=0}:{onChanged:()=>Promise<void>;revision?:number}){
 const [status,setStatus]=useState('REQUESTS'),[page,setPage]=useState(1),[completion,setCompletion]=useState<PendingRefund|null>(null),[notice,setNotice]=useState('');
 const refunds=useFetch<Page<Order>>(`/admin/orders?status=${status==='REFUNDED'?'REFUNDED':'REFUND_PENDING'}&page=${page}`,15000);
 useEffect(()=>{if(revision)void refunds.refresh();},[revision,refunds.refresh]);
 return <section className="refunds-panel"><div className="section-heading"><div><span className="eyebrow">GESTIÓN DE DEVOLUCIONES</span><h2>DEVOLUCIONES</h2></div><label className="filter-label">Mostrar devoluciones<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);setNotice('');}}><option value="REQUESTS">Solicitudes por aprobar</option><option value="REFUND_PENDING">Aprobadas, pendientes de devolver</option><option value="REFUNDED">Realizadas</option><option value="REQUEST_REJECTED">Solicitudes rechazadas</option></select></label></div>
  <p className="notice">Las transferencias se devuelven por el banco. Después de realizar y verificar la devolución, registrá aquí el importe y la referencia. El registro conserva el historial y prepara el aviso al cliente.</p>
  {['REQUESTS','REQUEST_REJECTED'].includes(status)?<RefundRequestsPanel rejected={status==='REQUEST_REJECTED'} revision={revision} onChanged={onChanged} onApproved={()=>{setStatus('REFUND_PENDING');void refunds.refresh();}}/>:<>
  {notice&&<p className="notice" role="status">{notice}</p>}<ErrorBox message={refunds.error} retry={refunds.refresh}/>{refunds.loading&&<Loading/>}
  {refunds.data?.items.length===0&&<p className="empty-state">{status==='REFUND_PENDING'?'No hay devoluciones pendientes.':'Todavía no hay devoluciones realizadas.'}</p>}
  <div className="refund-cards">{refunds.data?.items.map(order=>{
   const pending=pendingRefundFromOrder(order),name=[order.buyerFirstName??order.user?.firstName,order.buyerLastName??order.user?.lastName].filter(Boolean).join(' ')||order.user?.fullName||'Participante';
   return <article className="panel refund-card" key={order.id}><div className="section-heading"><div><span className="eyebrow">{order.raffle.status==='CANCELLED'?'RIFA CANCELADA':'RIFA'}</span><h3>{order.raffle.title}</h3></div><Status value={order.status}/></div><h4>{name}</h4><p className="small muted">{order.buyerEmail??order.user?.email}<br/>DNI: {order.buyerDni??order.user?.dni??'Sin registrar'}</p><p className="ticket-inline">Números {order.numbers.map(number=>ticketNumber(number,order.raffle)).join(' · ')}</p><dl className="refund-card-details"><div><dt>Importe de la compra</dt><dd>{money(order.amountCents)}</dd></div><div><dt>{pending?'A devolver':'Importe devuelto'}</dt><dd>{order.refundAmountCents?money(order.refundAmountCents):pending?'Importe recibido a verificar':'Sin registrar'}</dd></div><div><dt>Medio de pago</dt><dd>{order.method==='TRANSFER'?'Transferencia':order.method==='MERCADO_PAGO'?'Mercado Pago':order.method==='FREE_TICKET'?'Número gratis':'Sin registrar'}</dd></div><div><dt>{pending?'Solicitado':'Realizado'}</dt><dd>{(pending?order.refundRequestedAt:order.refundCompletedAt)?date((pending?order.refundRequestedAt:order.refundCompletedAt)!):'Sin registrar'}</dd></div></dl>{order.decisionNote&&<p className="small">{order.decisionNote}</p>}{order.refundReference&&<p className="small">Referencia de la devolución: <b>{order.refundReference}</b></p>}<p className="small muted">Compra {order.id}</p>{pending&&<Button variant="outline-primary" onClick={()=>setCompletion(pending)}>REGISTRAR REEMBOLSO REALIZADO</Button>}</article>;
  })}</div>
  {refunds.data&&refunds.data.total>25&&<div className="pagination-row"><Button variant="outline-primary" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Anterior</Button><span>{page} / {Math.ceil(refunds.data.total/25)}</span><Button variant="outline-primary" disabled={page*25>=refunds.data.total} onClick={()=>setPage(value=>value+1)}>Siguiente</Button></div>}
  </>}
  {completion&&<RefundCompletionDialog key={completion.id} refund={completion} onClose={()=>setCompletion(null)} onCompleted={async()=>{setNotice('Devolución registrada. Se preparó la confirmación para el cliente.');await refunds.refresh();await onChanged();}}/>}
 </section>;
}
