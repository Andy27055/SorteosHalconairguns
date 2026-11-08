import { useState } from 'react';
import { Button } from 'react-bootstrap';
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [feedback, setFeedback] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setFeedback('Copiado'); }
    catch { setFeedback('Mantené presionado el dato para copiarlo.'); }
  }
  return <div className="copy-value"><div><span>{label}</span><strong>{value}</strong></div><Button size="sm" variant="outline-primary" aria-label={`Copiar ${label.toLowerCase()}`} onClick={() => void copy()}>COPIAR</Button><small role="status">{feedback}</small></div>;
}
