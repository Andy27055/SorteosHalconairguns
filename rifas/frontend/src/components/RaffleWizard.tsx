import {PrizeKindField} from './PrizeKindField';
import {useEffect,useState,type FormEvent} from 'react';
import {Button,Modal} from 'react-bootstrap';
import {api,post,ApiError} from '../api';
import {money,ticketDigits,ticketNumber,type Prize,type PrizeKind,type Raffle,type AwardInput} from '../types';
import {ErrorBox} from './UI';

const blankAward=(rank:number):AwardInput=>({rank,prizes:[{prizeId:'',quantity:1}]});
export function RaffleWizard({raffle,prizes,onClose,onSaved,onPrizeCreated}:{raffle?:Raffle;prizes:Prize[];onClose:()=>void;onSaved:()=>Promise<void>;onPrizeCreated:()=>Promise<void>}){
 const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [catalog,setCatalog]=useState(prizes);
 useEffect(()=>{setCatalog(current=>[...prizes,...current.filter(p=>!prizes.some(next=>next.id===p.id))]);},[prizes]);
 const [form,setForm]=useState(()=>({title:raffle?.title||'',description:raffle?.description||'',price:raffle?String(raffle.ticketPriceCents/100):'',total:String(raffle?.totalTickets||100),drawAt:raffle?.drawAt?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(raffle.drawAt)).replace(' ','T'):'',count:String(raffle?.awards?.length||1),status:raffle?.status||'DRAFT'}));
 const [awards,setAwards]=useState<AwardInput[]>(()=>raffle?.awards?.length?raffle.awards.map(a=>({rank:a.rank,prizes:a.prizes.map(p=>({prizeId:p.prizeId,quantity:p.quantity}))})):[{rank:1,prizes:[{prizeId:raffle?.prizeId||'',quantity:1}]}]);
 const [creating,setCreating]=useState<{award:number;name:string;description:string;kind:PrizeKind}|null>(null);
 const locked=!!raffle?.hasOrders;
 const total=Number(form.total),digits=ticketDigits(total||100);
 const count=Number(form.count),visibleAwards=Array.from({length:Number.isInteger(count)&&count>=1&&count<=20?count:1},(_,i)=>awards[i]||blankAward(i+1));
 function change(key:keyof typeof form,value:string){setError('');setForm(current=>({...current,[key]:value}));}
 function changeAward(index:number,items:AwardInput['prizes']){setAwards(current=>{const next=[...current];for(let i=0;i<=index;i++)next[i]||=blankAward(i+1);next[index]={rank:index+1,prizes:items};return next;});}
 function validate(){
  if(form.title.trim().length<3)return 'El título debe tener al menos tres caracteres.';
  if(!Number.isFinite(Number(form.price))||Number(form.price)<1)return 'Ingresá un precio por número válido.';
  if(!Number.isInteger(Number(form.total))||Number(form.total)<10||Number(form.total)>10000)return 'La cantidad de números debe estar entre 10 y 10.000.';
  if(!Number.isInteger(count)||count<1||count>20)return 'Elegí entre 1 y 20 puestos de la Nocturna.';
  if(step>=2){
   if(creating)return 'Guardá o cancelá la creación del premio antes de continuar.';
   for(const award of visibleAwards){
    if(!award.prizes.length||award.prizes.some(p=>!catalog.some(c=>c.id===p.prizeId)||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100))return `Completá los premios y cantidades del puesto ${award.rank}.`;
    if(new Set(award.prizes.map(p=>p.prizeId)).size!==award.prizes.length)return `El puesto ${award.rank} tiene un premio duplicado; usá su cantidad.`;
   }
  }
  return '';
 }
 async function createPrize(){
  if(!creating||busy)return;
  if(creating.name.trim().length<3){setError('El nombre del premio debe tener al menos tres caracteres.');return;}
  setBusy(true);setError('');
  try{
   const prize=await post<Prize>('/admin/prizes',{name:creating.name.trim(),description:creating.description.trim(),kind:creating.kind});
   setCatalog(current=>[prize,...current]);
   const index=creating.award,items=[...(awards[index]||blankAward(index+1)).prizes],empty=items.findIndex(p=>!p.prizeId);
   if(empty>=0)items[empty]={prizeId:prize.id,quantity:1};else items.push({prizeId:prize.id,quantity:1});
   changeAward(index,items);setCreating(null);await onPrizeCreated();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  const problem=validate();if(problem){setError(problem);return;}
  setError('');if(step<3){setStep(step+1);return;}
  setBusy(true);
  try{
   const first=visibleAwards[0].prizes;
   const prizeId=raffle&&first.some(p=>p.prizeId===raffle.prizeId)?raffle.prizeId:first[0].prizeId;
   await api(`/admin/raffles${raffle?`/${raffle.id}`:''}`,{method:raffle?'PUT':'POST',body:JSON.stringify({title:form.title.trim(),description:form.description.trim(),prizeId,ticketPriceCents:Math.round(Number(form.price)*100),totalTickets:Number(form.total),lotteryDigits:digits,drawAt:form.drawAt?new Date(`${form.drawAt}:00-03:00`).toISOString():null,status:form.status,awards:visibleAwards})});
   await onSaved();
  }catch(e){setError(e instanceof ApiError?`${e.message} ${Object.values(e.fields).flat().join(' ')}`:(e as Error).message);}finally{setBusy(false);}
 }
 const prizeName=(id:string)=>raffle?.awards?.flatMap(a=>a.prizes).find(p=>p.prizeId===id)?.name||catalog.find(p=>p.id===id)?.name||'Premio';
 return <Modal show centered scrollable size="lg" className="raffle-wizard" onHide={()=>!busy&&onClose()} aria-labelledby="wizard-title" backdrop={busy?'static':true} keyboard={!busy}>
  <Modal.Header closeButton={!busy}><Modal.Title id="wizard-title">{raffle?'EDITAR RIFA':'NUEVA RIFA'}</Modal.Title></Modal.Header>
  <Modal.Body><ol className="wizard-steps" aria-label="Pasos de configuración">{['Datos','Premios por puesto','Revisión'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><b>{i+1}</b> {label}</li>)}</ol><ErrorBox message={error}/>{locked&&<p className="notice">Esta rifa ya recibió reservas o compras. Conserva sus puestos, premios, fecha, cantidad de números y cifras.</p>}
  <form id="raffle-wizard-form" onSubmit={submit}>
   {step===1&&<><h3>DATOS DE LA RIFA</h3><div className="field"><label htmlFor="rf-title">Título</label><input id="rf-title" minLength={3} maxLength={100} required value={form.title} onChange={e=>change('title',e.target.value)} disabled={busy}/></div><div className="field"><label htmlFor="rf-description">Descripción (opcional)</label><textarea id="rf-description" maxLength={3000} value={form.description} onChange={e=>change('description',e.target.value)} disabled={busy}/></div><div className="wizard-fields"><div className="field"><label htmlFor="rf-price">Precio por número (ARS)</label><input id="rf-price" type="number" min={1} step="0.01" required value={form.price} onChange={e=>change('price',e.target.value)}/></div><div className="field"><label htmlFor="rf-total">Cantidad de números</label><input id="rf-total" type="number" min={10} max={10000} required value={form.total} disabled={locked} onChange={e=>change('total',e.target.value)}/></div><div className="field"><label htmlFor="rf-winners">Cantidad de puestos premiados</label><input id="rf-winners" type="number" min={1} max={20} required value={form.count} disabled={locked} onChange={e=>change('count',e.target.value)}/><small>Se usan los primeros puestos de la Nocturna, en orden. Una persona puede ganar más de un puesto.</small></div><div className="field"><span className="small muted">Regla del resultado</span><p className="notice">{digits===1?'Se usa la última cifra':`Se usan las últimas ${digits} cifras`} de cada puesto de la Nocturna bonaerense. Numeración: {ticketNumber(0,{totalTickets:total||100})} a {ticketNumber(Math.max(0,(total||100)-1),{totalTickets:total||100})}. Por ejemplo: 1237 → {'1237'.slice(-digits)}.</p></div></div><div className="field"><label htmlFor="rf-drawAt">Fecha prevista (opcional, hora argentina)</label><input id="rf-drawAt" type="datetime-local" value={form.drawAt} disabled={locked} onChange={e=>change('drawAt',e.target.value)}/></div></>}
   {step===2&&<><h3>PREMIOS POR PUESTO</h3><p className="small muted">Podés usar un premio en varios puestos y asignar varios premios al mismo puesto. Cada posición toma {digits===1?'la última cifra':`las últimas ${digits} cifras`} del resultado oficial de esa misma posición.</p>{visibleAwards.map((award,index)=><fieldset className="award-editor" key={award.rank}><legend>{award.rank}.º puesto · {award.rank}.º resultado de la Nocturna</legend>{award.prizes.map((item,itemIndex)=><div className="award-item" key={itemIndex}><div className="field"><label htmlFor={`award-${index}-${itemIndex}`}>Premio {itemIndex+1}</label><select id={`award-${index}-${itemIndex}`} required disabled={locked||busy} value={item.prizeId} onChange={e=>changeAward(index,award.prizes.map((p,i)=>i===itemIndex?{...p,prizeId:e.target.value}:p))}><option value="">Elegí un premio</option>{catalog.filter(p=>p.id===item.prizeId||!award.prizes.some(other=>other.prizeId===p.id)).map(p=><option key={p.id} value={p.id}>{prizeName(p.id)}{p.kind==='FREE_TICKET'?' (número gratis)':''}</option>)}</select></div><div className="field award-quantity"><label htmlFor={`quantity-${index}-${itemIndex}`}>Cantidad</label><input id={`quantity-${index}-${itemIndex}`} type="number" min={1} max={100} required disabled={locked||busy} value={item.quantity||''} onChange={e=>changeAward(index,award.prizes.map((p,i)=>i===itemIndex?{...p,quantity:Number(e.target.value)}:p))}/></div>{award.prizes.length>1&&<Button type="button" variant="outline-danger" disabled={locked||busy} onClick={()=>changeAward(index,award.prizes.filter((_,i)=>i!==itemIndex))} aria-label={`Quitar premio ${itemIndex+1} del puesto ${award.rank}`}>Quitar</Button>}</div>)}<div className="admin-actions"><Button type="button" size="sm" variant="outline-primary" disabled={locked||busy||!!creating} onClick={()=>changeAward(index,[...award.prizes,{prizeId:'',quantity:1}])}>+ AGREGAR OTRO PREMIO</Button><Button type="button" size="sm" variant="outline-primary" disabled={locked||busy||!!creating} onClick={()=>{setError('');setCreating({award:index,name:'',description:'',kind:'ITEM'});}}>+ CREAR PREMIO</Button></div>{creating?.award===index&&<div className="inline-prize-editor"><h4>NUEVO PREMIO</h4><PrizeKindField id="inline-prize-kind" value={creating.kind} disabled={busy} onChange={kind=>setCreating({...creating,kind})}/><div className="field"><label htmlFor="inline-prize-name">Nombre del nuevo premio</label><input id="inline-prize-name" maxLength={100} value={creating.name} disabled={busy} onChange={e=>setCreating({...creating,name:e.target.value})}/></div><div className="field"><label htmlFor="inline-prize-description">Descripción del nuevo premio</label><textarea id="inline-prize-description" maxLength={2000} value={creating.description} disabled={busy} onChange={e=>setCreating({...creating,description:e.target.value})}/></div><div className="admin-actions"><Button type="button" variant="outline-primary" disabled={busy} onClick={()=>setCreating(null)}>Cancelar premio</Button><Button type="button" disabled={busy} onClick={()=>void createPrize()}>{busy?'GUARDANDO…':'GUARDAR Y ASIGNAR PREMIO'}</Button></div></div>}</fieldset>)}</>}
   {step===3&&<><h3>REVISÁ ANTES DE GUARDAR</h3><h4>{form.title}</h4><p>{form.total} números · {money(Math.round(Number(form.price)*100))} por número · {form.count} puestos premiados.</p><p className="small muted">Quiniela de la Provincia de Buenos Aires · Nocturna. Se toma{digits===1?' la última cifra':`n las últimas ${digits} cifras`} de cada puesto, en orden. Numeración: {ticketNumber(0,{totalTickets:total})} a {ticketNumber(total-1,{totalTickets:total})}.{form.drawAt?` Fecha prevista: ${form.drawAt.replace('T',' ')} (Argentina).`:' Sin fecha automática prevista.'}</p>{visibleAwards.map(a=><div className="award-review" key={a.rank}><b>{a.rank}.º puesto</b><ul>{a.prizes.map(p=><li key={p.prizeId}>{p.quantity} × {prizeName(p.prizeId)}</li>)}</ul></div>)}<p className="notice">Las reglas y los premios se conservarán desde la primera reserva. Si un número premiado no fue vendido, el cierre quedará pendiente; no se elegirá un reemplazo automático.</p><div className="field"><label htmlFor="rf-status">Estado</label><select id="rf-status" value={form.status} onChange={e=>change('status',e.target.value)}><option value="DRAFT">Borrador</option><option value="ACTIVE">Activa · abierta a participantes</option></select></div></>}
  </form></Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={busy} onClick={onClose}>Cancelar</Button>{step>1&&<Button variant="outline-primary" disabled={busy} onClick={()=>{setError('');setStep(step-1);}}>Anterior</Button>}<Button form="raffle-wizard-form" type="submit" disabled={busy}>{busy?'GUARDANDO…':step<3?'SIGUIENTE':raffle?'GUARDAR CAMBIOS':form.status==='ACTIVE'?'PUBLICAR RIFA':'GUARDAR BORRADOR'}</Button></Modal.Footer>
 </Modal>;
}
