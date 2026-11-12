import { Link } from 'react-router-dom';
import type { Raffle } from '../types';
import { date, money } from '../types';

export function RaffleCard({ raffle: r, featured = false }: { raffle: Raffle; featured?: boolean }) {
  const active = r.status === 'ACTIVE';
  const sold = Math.max(0, r.sold ?? 0);
  const available = r.available == null ? null : Math.max(0, r.available);
  const titleId = `raffle-title-${r.id}`;
  return (
    <article className={`raffle-card${featured ? ' raffle-card-featured' : ''}`} aria-labelledby={titleId}>
      <div className="raffle-card-art">
        <img src="/logo.png" alt="" />
        <span className={`raffle-state${active ? '' : ' finished'}`}>{active ? 'INSCRIPCIONES ABIERTAS' : r.status==='CLOSING'?'VENTAS CERRADAS':'FINALIZADA'}</span>
        <span className="card-serial">HALCÓN AIRGUNS / RIFAS</span>
      </div>
      <div className="raffle-card-body">
        <span className="eyebrow">{r.prize.name}</span>
        <h2 id={titleId}>{r.title}</h2>
        <p className="raffle-description">{r.description || r.prize.description || 'Elegí tus números y compartí la pasión de Halcón Airguns.'}</p>
        {r.winnerNumber != null ? (
          <div className="winner">NÚMERO GANADOR <strong>{String(r.winnerNumber).padStart(2, '0')}</strong></div>
        ) : (
          <div className="raffle-price-block">
            <div className="card-price">{money(r.ticketPriceCents)}<small>por número</small></div>
            <div className="progress-track" role="progressbar" aria-label="Números vendidos" aria-valuenow={sold} aria-valuemin={0} aria-valuemax={r.totalTickets}>
              <span style={{ width: `${Math.min(100, sold / r.totalTickets * 100)}%` }} />
            </div>
            <div className="availability-caption">
              <span>{!active?'Venta cerrada':available == null ? 'Consultá la disponibilidad' : `${available} ${available === 1 ? 'disponible' : 'disponibles'}`}</span>
              <span>{r.totalTickets} números</span>
            </div>
          </div>
        )}
        {r.closedEarly&&<p className="raffle-draw-date">Cierre anticipado. Resultado de la Nocturna del {r.resultDate?.split('-').reverse().join('/')}.</p>}{r.drawAt && <p className="raffle-draw-date">Fecha prevista: {date(r.drawAt)}</p>}
        <Link className={`btn ${active ? 'btn-primary' : 'btn-outline-primary'} w-100`} to={`/rifas/${r.id}`}>
          {active ? available === 0 ? 'VER DISPONIBILIDAD' : 'ELEGIR MIS NÚMEROS' : r.status==='CLOSING'?'VER ESTADO':'VER RESULTADO'} <span aria-hidden>↗</span>
        </Link>
        {active && <span className="raffle-participation-note">Reservá primero. Después elegí cómo pagar.</span>}
      </div>
    </article>
  );
}
