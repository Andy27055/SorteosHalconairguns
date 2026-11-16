import type {Raffle} from '../types';
export function rafflePrizeTitle(raffle:Raffle){return raffle.awards&&raffle.awards.length>1?`${raffle.awards.length} puestos premiados`:raffle.awards?.[0]?.prizes.map(p=>p.name).join(' + ')||raffle.prize.name;}
export function RafflePrizes({raffle,compact=false}:{raffle:Raffle;compact?:boolean}){
 const awards=raffle.awards;
 if(!awards?.length)return null;
 if(compact&&awards.length===1&&awards[0].prizes.length===1&&awards[0].prizes[0].quantity===1)return null;
 const visible=compact?awards.slice(0,3):awards;
 return <section className={`raffle-prizes${compact?' compact':''}`} aria-label="Premios de la rifa">{!compact&&<h2>PREMIOS POR PUESTO</h2>}{visible.map(award=><div className="raffle-prize-row" key={award.rank}><b>{award.rank}.º puesto{!compact&&` · ${award.rank}.º resultado de la Nocturna`}</b><ul>{award.prizes.map(prize=><li key={prize.prizeId}>{prize.quantity>1?`${prize.quantity} × `:''}{prize.name}{prize.kind==='FREE_TICKET'&&<p className="small">{prize.quantity} número(s) gratis para la siguiente rifa; el ganador elige en la siguiente rifa.</p>}{!compact&&prize.description&&<p>{prize.description}</p>}</li>)}</ul></div>)}{compact&&awards.length>3&&<p className="small muted">Y {awards.length-3} puestos más. Consultá todos los premios al abrir la rifa.</p>}</section>;
}
