import { useEffect, useState, type FormEvent } from 'react';
import { Button } from 'react-bootstrap';
import { z } from 'zod';
import { useFetch } from '../hooks/useFetch';
import { api, ApiError } from '../api';
import type { User } from '../types';
import { ErrorBox, Loading } from './UI';
const identitySchema = z.object({ firstName: z.string().trim().min(1,'Ingresá tu nombre.').max(100), lastName: z.string().trim().min(1,'Ingresá tu apellido.').max(100), email: z.email('Ingresá un email válido.'), dni: z.string().regex(/^\d{7,8}$/,'Ingresá el DNI sin puntos, con 7 u 8 dígitos.') });
export function BuyerDetails({ orderId, onReady }: { orderId: string; onReady: (ready: boolean) => void }) {
  const profile = useFetch<User>('/profile');
  const [form,setForm] = useState({ firstName:'',lastName:'',email:'',dni:'' });
  const [editing,setEditing] = useState(true); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [fields,setFields] = useState<Record<string,string[]>>({});
  useEffect(()=>{if(profile.data){const value={firstName:profile.data.firstName||'',lastName:profile.data.lastName||'',email:profile.data.email,dni:profile.data.dni||''};setForm(value);const ready=identitySchema.safeParse(value).success;setEditing(!ready);onReady(ready);}},[profile.data,onReady]);
  async function save(e:FormEvent){e.preventDefault();const parsed=identitySchema.safeParse(form);setFields({});setError('');if(!parsed.success){setFields(parsed.error.flatten().fieldErrors);return;}setBusy(true);try{await api(`/orders/${orderId}/buyer`,{method:'PUT',body:JSON.stringify(parsed.data)});setEditing(false);onReady(true);}catch(err){setError((err as Error).message);if(err instanceof ApiError)setFields(err.fields);}finally{setBusy(false);}}
  return <section className="buyer-details"><h3>DATOS DEL COMPRADOR</h3><ErrorBox message={profile.error} retry={profile.refresh}/><ErrorBox message={error}/>{profile.loading ? <Loading/> : editing ? <form onSubmit={save}><p className="small muted">Confirmá estos datos para registrar tus números y enviarte el detalle de la compra.</p>{[['firstName','Nombre'],['lastName','Apellido'],['email','Email'],['dni','DNI, sin puntos']].map(([key,label])=><div className="field" key={key}><label htmlFor={`buyer-${key}`}>{label}</label><input id={`buyer-${key}`} required type={key==='email'?'email':'text'} inputMode={key==='dni'?'numeric':undefined} maxLength={key==='dni'?8:254} value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} aria-invalid={!!fields[key]}/>{fields[key]&&<small className="field-error">{fields[key].join(' ')}</small>}</div>)}<Button type="submit" className="w-100" disabled={busy}>{busy?'GUARDANDO…':'CONFIRMAR DATOS Y CONTINUAR'}</Button></form> : <><strong>{form.firstName} {form.lastName}</strong><span>{form.email}</span><span>DNI {form.dni}</span><Button variant="link" size="sm" onClick={()=>{setEditing(true);onReady(false);}}>Editar datos</Button></>}</section>;
}
