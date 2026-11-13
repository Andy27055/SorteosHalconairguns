import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { visibilityLabel?: string };
export function PasswordInput({ visibilityLabel = 'contraseña', ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return <div className="password-control">
    <input {...props} type={visible ? 'text' : 'password'}/>
    <button type="button" className="password-toggle" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${visibilityLabel}`} aria-pressed={visible} aria-controls={props.id} onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}
      </svg>
    </button>
  </div>;
}
