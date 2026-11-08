import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { z } from 'zod';
import { ApiError, post } from '../api';
import { useAuth } from '../auth';
import type { User, GuestReservation } from '../types';
import { ErrorBox } from './UI';
import { GuestReservationNotice } from './GuestReservationNotice';
export const registrationSchema = z.object({ username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Usá letras, números, punto o guion.'), firstName: z.string().trim().min(1).max(100).optional(), lastName: z.string().trim().min(1).max(100).optional(), fullName: z.string().trim().min(3).max(201).optional(), email: z.email('Ingresá un email válido.'), password: z.string().min(10, 'Usá al menos 10 caracteres.').max(128), dni: z.string().regex(/^\d{7,8}$/, 'Usá 7 u 8 dígitos.').or(z.literal('')), address: z.string().trim().max(200) }).superRefine((value, ctx) => {
  if (!value.fullName && (!value.firstName || !value.lastName)) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Completá nombre y apellido.' });
});
export function AuthPage({ register = false }: { register?: boolean }) {
  const [form, setForm] = useState({ username: '', firstName: '', lastName: '', email: '', password: '', login: '', dni: '', address: '' });
  const [fields, setFields] = useState<Record<string,string[]>>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [signedIn, setSignedIn] = useState(false);
  const { accept } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const pending = location.state?.guestReservation as GuestReservation | undefined;
  async function continuePurchase() {
    const { order } = await post<{ order: { id: string } | null }>('/guest-reservations/claim');
    if (order) { navigate(`/compras/${order.id}`, { replace: true }); return; }
    if (pending) throw new ApiError('La reserva temporal venció. Tu sesión está iniciada; volvé a la rifa para consultar la disponibilidad.', 409);
    const from = location.state?.from;
    navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/', { replace: true });
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setError(''); setFields({});
    if (register) { const parsed = registrationSchema.safeParse(form); if (!parsed.success) { setFields(parsed.error.flatten().fieldErrors); return; } }
    setBusy(true);
    try { const result = await post<{ user: User; token: string }>(register ? '/auth/register' : '/auth/login', register ? form : { login: form.login, password: form.password }); accept(result); setSignedIn(true); await continuePurchase(); }
    catch (err) { setError((err as Error).message); if (err instanceof ApiError) setFields(err.fields); }
    finally { setBusy(false); }
  }
  async function retry() { setBusy(true); setError(''); try { await continuePurchase(); } catch(err) { setError((err as Error).message); } finally { setBusy(false); } }
  function input(name: keyof typeof form, label: string, type = 'text', required = true, autoComplete?: string) {
    return <div className="field" key={name}><label htmlFor={name}>{label}</label><input id={name} type={type} value={form[name]} required={required} autoComplete={autoComplete} inputMode={name === 'dni' ? 'numeric' : undefined} maxLength={name==='password'?128:200} aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `${name}-error` : undefined} onChange={e => setForm({...form,[name]:e.target.value})}/>{fields[name] && <small id={`${name}-error`} className="field-error">{fields[name].join(' ')}</small>}</div>;
  }
  return <div className="auth-layout"><div className="auth-brand"><img src="/logo.png" alt="Halcón Airguns"/><span className="eyebrow">TU PASIÓN TIENE UN LUGAR</span><h1>SUMATE A<br/>LA EXPERIENCIA<br/><em>HALCÓN.</em></h1><p>Tus números, tus compras y cada confirmación en un mismo lugar.</p></div><section className="panel auth-panel"><span className="eyebrow">BIENVENIDO A HALCÓN AIRGUNS</span><h2>{signedIn ? 'TU SESIÓN ESTÁ INICIADA' : register ? 'CREÁ TU CUENTA' : 'VOLVÉ A TU PASIÓN'}</h2><GuestReservationNotice/><ErrorBox message={error}/>{signedIn ? <div className="auth-recovery"><Button disabled={busy} onClick={()=>void retry()}>CONTINUAR CON MI RESERVA</Button><Link to={pending ? `/rifas/${pending.raffleId}` : '/compras'}>Ver mis números y reservas</Link></div> : <><p className="muted">{register ? 'Completá tus datos para continuar con tu reserva.' : 'Ingresá para continuar sin volver a elegir tus números.'}</p><form onSubmit={submit}>{register ? <>{input('firstName','Nombre','text',true,'given-name')}{input('lastName','Apellido','text',true,'family-name')}{input('username','Usuario','text',true,'username')}{input('email','Email','email',true,'email')}</> : input('login','Usuario o email','text',true,'username')}{input('password','Contraseña','password',true,register?'new-password':'current-password')}{register && <details className="optional-data"><summary>Datos adicionales (opcionales)</summary>{input('dni','DNI, sin puntos','text',false)}{input('address','Domicilio','text',false,'street-address')}<p className="small muted">Antes de pagar te pediremos confirmar nombre, apellido y DNI.</p></details>}{register && <p className="small muted">Consultá las <Link to="/condiciones">condiciones y el uso de tus datos</Link> antes de participar.</p>}<Button type="submit" disabled={busy} className="w-100">{busy ? 'Procesando…' : register ? 'CREAR MI CUENTA' : 'INGRESAR'} <span aria-hidden>↗</span></Button></form><p className="auth-switch">{register ? '¿Ya tenés cuenta? ' : '¿Primera vez por acá? '}<Link to={register?'/ingresar':'/registro'} state={location.state}>{register?'Ingresá':'Creá tu cuenta'}</Link></p></>}</section></div>;
}
