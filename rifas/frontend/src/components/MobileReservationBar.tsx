import { Button } from 'react-bootstrap';
import { money } from '../types';
export function MobileReservationBar({ count, total, busy, disabled, onContinue }: { count: number; total: number; busy: boolean; disabled: boolean; onContinue: () => void }) {
  return <div className="mobile-reservation-bar" aria-label="Continuar con los números seleccionados"><div aria-live="polite"><small>{count} {count === 1 ? 'número seleccionado' : 'números seleccionados'}</small><strong>{money(total)}</strong></div><Button disabled={busy || disabled} onClick={onContinue}>{busy ? 'RESERVANDO…' : 'CONTINUAR'} <span aria-hidden>↗</span></Button></div>;
}
