import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import type { Raffle } from '../types';
import { ErrorBox, Loading } from './UI';
import { RaffleCard } from './RaffleCard';

export function RafflesHome() {
  const { data, loading, error, refresh } = useFetch<Raffle[]>('/raffles', 15000);
  const active = data?.filter(r => r.status === 'ACTIVE') ?? [];
  const finished = data?.filter(r => r.status === 'FINISHED') ?? [];
  return (
    <div className="raffles-home">
      <section id="rifas" className="catalog-section catalog-first" aria-labelledby="raffles-heading">
        <div className="section-heading catalog-heading">
          <div><span className="eyebrow">TU PRÓXIMA OPORTUNIDAD</span><h1 id="raffles-heading">RIFAS HALCÓN<span>.</span></h1><p>Elegí tu rifa y reservá tus números.</p></div>
          {active.length > 0 && <span className="catalog-count"><i aria-hidden />{active.length === 1 ? '1 rifa activa' : `${active.length} rifas activas`}</span>}
        </div>
        {loading && <Loading />}
        <ErrorBox message={error} retry={refresh} />
        {!loading && !error && active.length === 0 && (
          <div className="empty-state"><img src="/logo.png" alt="" /><span className="eyebrow">PRÓXIMAMENTE</span><h2>SE VIENEN NUEVAS OPORTUNIDADES.</h2><p>Las nuevas rifas aparecerán acá cuando se abran las inscripciones.</p></div>
        )}
        <div className={`raffle-cards${active.length === 1 ? ' raffle-cards-single' : ''}`}>
          {active.map(r => <RaffleCard key={r.id} raffle={r} featured={active.length === 1} />)}
        </div>
      </section>
      <section className="trust-strip" aria-label="Cómo participar">
        <div><b>01</b><span>Elegí tus números<small>Consultá cuáles están disponibles.</small></span></div>
        <div><b>02</b><span>Elegí cómo pagar<small>Mercado Pago o transferencia, según disponibilidad.</small></span></div>
        <div><b>03</b><span>Seguí tu participación<small>El estado de tu compra, en tu cuenta.</small></span></div>
      </section>
      {finished.length > 0 && (
        <details className="past-raffles"><summary>Resultados anteriores <span>{finished.length}</span></summary><div className="raffle-cards">{finished.map(r => <RaffleCard key={r.id} raffle={r} />)}</div></details>
      )}
      <section className="brand-signature"><div><span className="eyebrow">HALCÓN AIRGUNS</span><h2>LA MISMA PASIÓN. <em>UNA NUEVA OPORTUNIDAD.</em></h2></div><Link to="/condiciones" className="text-link">Cómo participar <span aria-hidden>↗</span></Link></section>
    </div>
  );
}
