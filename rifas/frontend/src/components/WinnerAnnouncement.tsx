import { useEffect,useState } from 'react';
import type { Raffle } from '../types';
import { date } from '../types';
export function argentinaDay(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
export function WinnerAnnouncement({raffle:r}:{raffle:Raffle}){
 const [today,setToday]=useState(()=>argentinaDay());
 useEffect(()=>{const timer=setInterval(()=>setToday(argentinaDay()),1000);return()=>clearInterval(timer);},[]);
 const result=r.lotteryResult;const showLink=result?.date===today&&result.sourceUrl==='https://loteria.gba.gob.ar/resultados';
 return <section className="winner-announcement panel" aria-label="Ganador de la última rifa cerrada"><span className="eyebrow">ÚLTIMA RIFA FINALIZADA</span><h2>{r.title}</h2>{r.winnerDisplayName&&<p>¡Felicitaciones, <b>{r.winnerDisplayName}</b>!</p>}<p>Número ganador <strong className="winner-number">{String(r.winnerNumber).padStart(r.lotteryDigits||2,'0')}</strong></p>{r.drawnAt&&<p>Ganador confirmado: {date(r.drawnAt)}</p>}{result&&<><p>Quiniela de la Provincia de Buenos Aires · Nocturna · Primer premio<br/>Fecha del resultado: {result.date.split('-').reverse().join('/')} · Sorteo {result.drawNumber}<br/>Resultado oficial: <b>{result.head}</b> · Se toman las últimas {r.lotteryDigits||2} cifras.</p>{showLink?<a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">VER RESULTADO EN LOTERÍA ↗</a>:<p className="small muted">El enlace al resultado diario se muestra únicamente el día del resultado. La fecha y el número verificados se conservan en esta página.</p>}</>}</section>;
}
