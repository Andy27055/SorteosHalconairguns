import {Link} from 'react-router-dom';
import {Button} from 'react-bootstrap';
import {useFetch} from '../hooks/useFetch';
import type {FreeTicketBenefit} from '../types';
import {ErrorBox} from './UI';

export function FreeTicketWallet(){
 const {data,error,refresh}=useFetch<FreeTicketBenefit[]>('/free-tickets',15000);
 const benefits=Array.isArray(data)?data.filter(b=>b.remaining>0&&!b.revoked):[];
 if(!benefits.length&&!error)return null;
 return <section className="panel free-ticket-wallet" aria-label="Tus premios de números gratis"><h2>TUS NÚMEROS GRATIS</h2><p className="small muted">Cada beneficio vale únicamente para su rifa asignada. Los premios ganados se usan en la siguiente rifa.</p><ErrorBox message={error} retry={refresh}/>{benefits.map(b=><div className="award-review" key={b.id}><strong>{b.remaining} número(s) gratis</strong>{b.sourceRaffle?<p>Premio del {b.rank}.º puesto de {b.sourceRaffle.title}.</p>:<p>Entregado por administración. </p>}{b.targetRaffle&&<p>Válido sólo para <b>{b.targetRaffle.title}</b>.</p>}{b.reason&&<p className="small muted">{b.reason}</p>}{b.available&&b.availableRaffles.length?<div className="admin-actions">{b.availableRaffles.map(r=><Link key={r.id} className="btn btn-primary" to={`/rifas/${r.id}`}>ELEGIR EN {r.title} ↗</Link>)}</div>:<p className="small muted">{b.targetRaffle?b.targetRaffle.status==='DRAFT'?'Podrás elegir tus números cuando se active esta rifa.':b.targetRaffle.status==='CANCELLED'?'Esta rifa fue cancelada. Contactá a administración para asignar una rifa de reemplazo.':'La compra de números de esta rifa ya cerró. El beneficio no pasa a otra rifa.':b.sourceRaffle?'Se asignará a la siguiente rifa que se active.':'Administración debe asignar una rifa a este beneficio.'}</p>}</div>)}</section>;
}
function balance(data:FreeTicketBenefit[]|null,raffleId:string){return Array.isArray(data)?data.filter(b=>!b.revoked&&b.available&&b.availableRaffles.some(r=>r.id===raffleId)).reduce((sum,b)=>sum+b.remaining,0):0;}
export function FreeTicketAvailability({raffleId}:{raffleId:string}){
 const {data}=useFetch<FreeTicketBenefit[]>('/free-tickets',15000);const total=balance(data,raffleId);
 return total>0?<p className="notice">Tenés <b>{total} número(s) gratis</b> para esta rifa. Elegí hasta esa cantidad y usá tu premio al continuar. Reservá por separado los números adicionales que quieras pagar.</p>:null;
}
export function FreeTicketOffer({raffleId,count,ready,busy,onRedeem}:{raffleId:string;count:number;ready:boolean;busy:boolean;onRedeem:()=>void}){
 const {data,error,refresh}=useFetch<FreeTicketBenefit[]>('/free-tickets',15000);const total=balance(data,raffleId);
 if(!total&&!error)return null;
 return <section className="payment-option free-ticket-offer" aria-label="Canjear premio de números gratis"><h3>TU PREMIO: NÚMEROS GRATIS</h3><ErrorBox message={error} retry={refresh}/>{total>0&&<><p>Tenés {total} número(s) gratis para esta rifa. Esta reserva tiene {count}.</p>{count<=total?<><p>Al canjear se confirma tu participación por <b>$0</b>. No requiere transferencia ni comprobante.</p><Button disabled={busy||!ready||!!error} onClick={onRedeem}>USAR NÚMEROS GRATIS</Button></>:<p className="notice">Para usar tu premio, cancelá esta reserva y elegí hasta {total} números. Los adicionales se reservan y pagan por separado.</p>}</>}</section>;
}
