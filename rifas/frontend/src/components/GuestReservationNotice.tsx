import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import type { GuestReservation } from '../types';
export function GuestReservationNotice({ showLink = false }: { showLink?: boolean }) {
  const { data } = useFetch<{ reservation: GuestReservation | null }>('/guest-reservations', 15000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!data?.reservation) return null;
  const r = data.reservation; const remaining = Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - now) / 1000));
  return <div className={`guest-reservation-notice${remaining ? '' : ' expired'}`} role="status"><span className="eyebrow">{remaining ? 'TUS NÚMEROS ESTÁN APARTADOS' : 'EL PLAZO DE RESERVA TERMINÓ'}</span><strong>{r.numbers.map(n => String(n).padStart(2,'0')).join(' · ')}</strong><p>{remaining ? <>Ingresá o creá tu cuenta para continuar. Te quedan <b>{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</b>.</> : 'Volvé a la rifa para consultar la disponibilidad.'}</p>{showLink && remaining > 0 && <Link className="btn btn-outline-primary btn-sm" to="/ingresar" state={{ from: `/compras/${r.id}`, guestReservation: r }}>CONTINUAR MI RESERVA ↗</Link>}</div>;
}
