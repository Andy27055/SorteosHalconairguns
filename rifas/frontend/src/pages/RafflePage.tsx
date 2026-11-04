import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../auth';
import { post } from '../api';
import type { Raffle, Order } from '../types';
import { date, money } from '../types';
import { ErrorBox, Loading, PageTitle } from '../components/UI';
export function RafflePage() {
  const { id } = useParams(); const raffle = useFetch<Raffle>(`/raffles/${id}`, 15000);
  const availability = useFetch<{ number: number; status: 'PAID'|'HELD' }[]>(`/raffles/${id}/availability`, 5000);
  const [selected, setSelected] = useState<number[]>([]); const [page, setPage] = useState(0); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const { user } = useAuth(); const navigate = useNavigate();
  useEffect(() => { if (availability.data) { const taken = new Set(availability.data.map(a => a.number)); setSelected(current => current.filter(n => !taken.has(n))); } }, [availability.data]);
  async function reserve() {
    if (!user) { navigate('/ingresar', { state: { from: `/rifas/${id}` } }); return; }
    if (busy) return; setBusy(true); setError('');
    try { const order = await post<Order>('/orders', { raffleId: id, numbers: selected }); navigate(`/compras/${order.id}`); }
    catch (err) { setError((err as Error).message); await availability.refresh(); }
    finally { setBusy(false); }
  }
  if (raffle.loading) return <Loading/>; if (!raffle.data) return <ErrorBox message={raffle.error} retry={raffle.refresh}/>;
  const r = raffle.data; const held = new Map(availability.data?.map(a=>[a.number,a.status])); const pages = Math.ceil(r.totalTickets / 100);
  return <div className="page-wrap"><Link to="/" className="back-link">← Todas las rifas</Link><PageTitle eyebrow={r.prize.name} title={r.title} description={r.description || r.prize.description}/>{r.status === 'FINISHED' ? <div className="winner-panel"><img src="/logo.png" alt="Halcón Airguns"/><span className="eyebrow">SORTEO FINALIZADO</span><h2>NÚMERO GANADOR</h2><strong>{r.winnerNumber == null ? 'Resultado pendiente' : String(r.winnerNumber).padStart(3,'0')}</strong>{r.drawnAt && <p>{date(r.drawnAt)}</p>}</div> : <div className="purchase-layout"><section className="panel number-panel"><div className="section-heading"><h2>ELEGÍ TUS NÚMEROS</h2><span className="small muted">{r.totalTickets-held.size} disponibles</span></div><p className="muted small">Podés reservar hasta 20 números. Tendrás 5 minutos para elegir cómo pagar.</p><div className="number-legend"><span><i className="available"/> Disponible</span><span><i className="selected"/> Tu selección</span><span><i className="held"/> Reservado o vendido</span></div><ErrorBox message={availability.error} retry={availability.refresh}/>{availability.loading ? <Loading/> : <div className="number-grid">{Array.from({length:Math.min(100,r.totalTickets-page*100)},(_,i)=>page*100+i+1).map(n=><button type="button" key={n} className={`number ${selected.includes(n)?'is-selected':''}`} disabled={held.has(n) || busy || !!availability.error} aria-pressed={selected.includes(n)} aria-label={`Número ${n}${held.has(n)?', no disponible':''}`} onClick={()=>setSelected(current=>current.includes(n)?current.filter(v=>v!==n):current.length<20?[...current,n]:current)}>{String(n).padStart(3,'0')}</button>)}</div>}{pages>1 && <div className="pagination-row"><Button size="sm" variant="outline-primary" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</Button><span>{page+1} / {pages}</span><Button size="sm" variant="outline-primary" disabled={page===pages-1} onClick={()=>setPage(page+1)}>Siguiente</Button></div>}</section><aside className="panel purchase-summary"><span className="eyebrow">TU PRÓXIMA OPORTUNIDAD</span><h2>TU SELECCIÓN</h2><div className="selected-numbers">{selected.length ? [...selected].sort((a,b)=>a-b).map(n=><span key={n}>{String(n).padStart(3,'0')}</span>) : <p className="muted small">Elegí un número en la grilla para comenzar.</p>}</div><div className="summary-line"><span>Valor por número</span><b>{money(r.ticketPriceCents)}</b></div><div className="summary-line"><span>Cantidad</span><b>{selected.length}</b></div><div className="summary-total"><span>TOTAL</span><strong>{money(selected.length*r.ticketPriceCents)}</strong></div><ErrorBox message={error}/><Button className="w-100" disabled={!selected.length||busy||!!availability.error} onClick={()=>void reserve()}>{busy?'RESERVANDO…':user?'RESERVAR Y CONTINUAR':'INGRESAR PARA RESERVAR'} <span aria-hidden>↗</span></Button><p className="small muted mt-3">Tu participación se confirma cuando se acredita el pago o se aprueba la transferencia.</p>{r.drawAt && <p className="small">Fecha prevista: {date(r.drawAt)}</p>}</aside></div>}</div>;
}
