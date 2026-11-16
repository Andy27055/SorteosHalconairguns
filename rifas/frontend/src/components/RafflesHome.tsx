import {useState} from 'react';
import {Dropdown} from 'react-bootstrap';
import { WinnerAnnouncement } from './WinnerAnnouncement';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import {raffleAcceptingNumbers,type Raffle} from '../types';
import { ErrorBox, Loading } from './UI';
import { RaffleCard } from './RaffleCard';

export function RafflesHome() {
  const { data, loading, error, refresh } = useFetch<Raffle[]>('/raffles', 15000);
  const [filter,setFilter]=useState('OPEN_FIRST');
  const list=data?.filter(r=>['ACTIVE','CLOSING','FINISHED'].includes(r.status))||[];
  const accepting=list.filter(r=>raffleAcceptingNumbers(r)).length,closed=list.length-accepting;
  const visible=list.filter(r=>filter==='ONLY_OPEN'?raffleAcceptingNumbers(r):filter==='ONLY_CLOSED'?!raffleAcceptingNumbers(r):true).sort((a,b)=>filter==='CLOSED_FIRST'?Number(raffleAcceptingNumbers(a))-Number(raffleAcceptingNumbers(b)):Number(raffleAcceptingNumbers(b))-Number(raffleAcceptingNumbers(a)));
  const filters=[['OPEN_FIRST','Activas primero'],['CLOSED_FIRST','Compras cerradas primero'],['ONLY_OPEN','Sólo activas'],['ONLY_CLOSED','Sólo compras cerradas']];
  const finished = data?.filter(r => r.status === 'FINISHED') ?? [];
  const latest=[...finished].filter(r=>r.winnerNumber!=null&&r.lotteryResult).sort((a,b)=>new Date(b.drawnAt||0).getTime()-new Date(a.drawnAt||0).getTime())[0];
  return (
    <div className="raffles-home">
      <section id="rifas" className="catalog-section catalog-first" aria-labelledby="raffles-heading">
        <div className="section-heading catalog-heading">
          <div><span className="eyebrow">TU PRÓXIMA OPORTUNIDAD</span><h1 id="raffles-heading">RIFAS HALCÓN<span>.</span></h1><p>Elegí tu rifa y reservá tus números.</p></div>
          <Dropdown align="end" className="catalog-filter"><Dropdown.Toggle variant="" className="catalog-count" id="catalog-filter-toggle" aria-label="Filtrar y ordenar rifas"><i aria-hidden />{filter==='ONLY_CLOSED'||filter==='CLOSED_FIRST'?`${closed} con compra cerrada`:accepting===1?'1 rifa activa':`${accepting} rifas activas`}</Dropdown.Toggle><Dropdown.Menu>{filters.map(([value,label])=><Dropdown.Item key={value} active={filter===value} onClick={()=>setFilter(value)}>{label}</Dropdown.Item>)}</Dropdown.Menu></Dropdown>
        </div>
        {loading && <Loading />}
        <ErrorBox message={error} retry={refresh} />
        {!loading && !error && visible.length === 0 && (
          <div className="empty-state"><img src="/logo.png" alt="" /><span className="eyebrow">PRÓXIMAMENTE</span><h2>{list.length?'NO HAY RIFAS CON ESTE FILTRO.':'SE VIENEN NUEVAS OPORTUNIDADES.'}</h2><p>{list.length?'Probá con otra opción del filtro.':'Las nuevas rifas aparecerán acá cuando se abran las inscripciones.'}</p></div>
        )}
        <div className={`raffle-cards${visible.length === 1 ? ' raffle-cards-single' : ''}`}>
          {visible.map(r => <RaffleCard key={r.id} raffle={r} featured={accepting===1&&raffleAcceptingNumbers(r)} />)}
        </div>
      </section>
      {latest&&<WinnerAnnouncement raffle={latest}/>}
      <section className="trust-strip" aria-label="Cómo participar">
        <div><b>01</b><span>Elegí tus números<small>Consultá cuáles están disponibles.</small></span></div>
        <div><b>02</b><span>Elegí cómo pagar<small>Mercado Pago o transferencia, según disponibilidad.</small></span></div>
        <div><b>03</b><span>Seguí tu participación<small>El estado de tu compra, en tu cuenta.</small></span></div>
      </section>
      <section className="brand-signature"><div><span className="eyebrow">HALCÓN AIRGUNS</span><h2>LA MISMA PASIÓN. <em>UNA NUEVA OPORTUNIDAD.</em></h2></div><Link to="/condiciones" className="text-link">Cómo participar <span aria-hidden>↗</span></Link></section>
    </div>
  );
}
