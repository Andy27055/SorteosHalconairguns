import type {Raffle} from '../types';
export function RaffleStateNotice({raffle:r}:{raffle:Raffle}){
 if(r.status==='CANCELLED')return <section className="raffle-state-notice panel notice warning" role="status"><h2>RIFA CANCELADA</h2><p>Un administrador canceló esta rifa. Sus números ya no participan.</p>{r.cancellationReason&&<p><b>Motivo:</b> {r.cancellationReason}</p>}<p>Los compradores con pago confirmado recibirán el aviso y podrán consultar el reembolso desde Mis números.</p></section>;
 if(r.status==='CLOSING')return <section className="raffle-state-notice panel notice" role="status"><h2>VENTAS CERRADAS</h2>{r.closedEarly&&<p>Esta rifa se cerró de forma anticipada.</p>}<p>El resultado se confirmará con el primer premio de la Quiniela de la Provincia de Buenos Aires, Nocturna{r.resultDate?` del ${r.resultDate.split('-').reverse().join('/')}`:''}.</p><p>{r.closingNote||'Esperando la publicación oficial y la revisión de pagos pendientes.'}</p><p>El sistema reintenta automáticamente. El ganador aparecerá en esta página cuando se confirme.</p></section>;
 return null;
}
