import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useFetch } from '../hooks/useFetch';
import { downloadPrivateFile } from '../api';
import type { Raffle } from '../types';
import { ErrorBox, Loading } from './UI';
interface Buyers { raffle: { id:string;title:string }; buyers: { email:string;firstName:string;lastName:string;dni:string;numbers:number[];incomplete:boolean;emailStatuses:string[] }[]; soldNumbers:number; mailEnabled:boolean }
export function BuyersPanel({ raffles }: { raffles:Raffle[] }) {
  const [id,setId]=useState('');
  return <div className="buyers-panel"><h2>COMPRADORES POR RIFA</h2><div className="field"><label htmlFor="buyer-raffle">Seleccioná una rifa</label><select id="buyer-raffle" value={id} onChange={e=>setId(e.target.value)}><option value="">Elegí una rifa</option>{raffles.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></div>{id && <BuyerList key={id} id={id}/>}</div>;
}
function BuyerList({ id }:{ id:string }) {
  const {data,error,loading,refresh}=useFetch<Buyers>(`/admin/raffles/${id}/buyers`,15000); const [busy,setBusy]=useState(false);const [downloadError,setDownloadError]=useState('');
  async function download(){setBusy(true);setDownloadError('');try{await downloadPrivateFile(`/admin/raffles/${id}/buyers.xlsx`,`compradores-${id}.xlsx`);}catch(err){setDownloadError((err as Error).message);}finally{setBusy(false);}}
  const status=(values:string[])=>values.every(v=>v==='SENT')?'Enviado':values.includes('FAILED')?'Revisar envío':values.includes('PENDING')||values.includes('SENDING')?'Pendiente':'Sin envío registrado';
  return <><ErrorBox message={error} retry={refresh}/><ErrorBox message={downloadError}/>{loading&&<Loading/>}{data&&<><div className="section-heading"><div><h3>{data.raffle.title}</h3><p className="small muted">{data.buyers.length} compradores · {data.soldNumbers} números confirmados</p></div><Button disabled={busy||!data.buyers.length} onClick={()=>void download()}>{busy?'GENERANDO…':'DESCARGAR EXCEL'}</Button></div>{!data.mailEnabled&&<p className="notice warning">El envío de correos se habilitará cuando se configure la cuenta remitente. Las confirmaciones nuevas quedan en cola.</p>}{data.buyers.some(b=>b.incomplete)&&<p className="notice warning">Hay compras anteriores con datos incompletos. El listado conserva los datos disponibles y deja vacíos los que no se registraron.</p>}<div className="buyers-table-wrap"><table className="buyers-table"><caption>Compras con pago confirmado</caption><thead><tr><th>Email</th><th>Apellido</th><th>Nombre</th><th>DNI</th><th>Números comprados</th><th>Correo</th></tr></thead><tbody>{data.buyers.map((b,i)=><tr key={i}><td data-label="Email">{b.email||'Sin registrar'}</td><td data-label="Apellido">{b.lastName||'Sin registrar'}</td><td data-label="Nombre">{b.firstName||'Sin registrar'}</td><td data-label="DNI">{b.dni||'Sin registrar'}</td><td data-label="Números">{b.numbers.map(n=>String(n).padStart(3,'0')).join(' · ')}</td><td data-label="Correo">{status(b.emailStatuses)}</td></tr>)}</tbody></table>{!data.buyers.length&&<p className="empty-state">Todavía no hay compras confirmadas en esta rifa.</p>}</div></>}</>;
}
