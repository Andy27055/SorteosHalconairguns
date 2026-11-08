import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { api } from '../api';
import { ErrorBox } from './UI';

const MAX_SIZE = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export function validateReceiptFile(file: Pick<File, 'size' | 'type'>): string {
  if (!file.size) return 'El archivo está vacío. Elegí otro comprobante.';
  if (file.size > MAX_SIZE) return 'El comprobante debe pesar hasta 5 MB.';
  if (!MIME_TYPES.has(file.type)) return 'Elegí una foto JPG o PNG, o un archivo PDF.';
  return '';
}
export function ReceiptUpload({ orderId, disabled, onRefresh, onUploaded, onBusyChange }: { orderId: string; disabled: boolean; onRefresh: () => Promise<void>; onUploaded: () => Promise<void>; onBusyChange?: (busy: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function select(candidate?: File) {
    if (!candidate || busy || disabled) return;
    const message = validateReceiptFile(candidate);
    setError(message);
    setFile(message ? null : candidate);
    if (input.current) input.current.value = '';
    if (camera.current) camera.current.value = '';
  }
  function remove() { setFile(null); setError(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || disabled) return;
    if (!file) { setError('Elegí el comprobante antes de enviarlo.'); return; }
    inFlight.current = true; setBusy(true); onBusyChange?.(true); setError('');
    const data = new FormData(); data.append('receipt', file);
    try { await api(`/orders/${orderId}/receipt`, { method: 'POST', body: data }); await onUploaded(); }
    catch (err) { setError((err as Error).message); await onRefresh(); }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return (
    <form onSubmit={submit} className="receipt-upload" aria-label="Enviar comprobante de transferencia" aria-busy={busy}>
      <h3>SUBÍ TU COMPROBANTE</h3>
      <p className="muted small">Elegí una foto o PDF donde se vean el importe y la transferencia.</p>
      <ErrorBox message={error} />
      <div className={`receipt-dropzone${dragging ? ' is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy && !disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files[0]); }}>
        <input ref={input} className="visually-hidden" id="receipt-file" type="file" accept="image/jpeg,image/png,application/pdf" disabled={disabled || busy} aria-describedby="receipt-format" onChange={e => select(e.target.files?.[0])} />
        <input ref={camera} className="visually-hidden" id="receipt-camera" type="file" accept="image/jpeg,image/png" capture="environment" disabled={disabled || busy} aria-label="Tomar una foto del comprobante" onChange={e => select(e.target.files?.[0])} />
        {file ? <div className="receipt-selection">
          {preview ? <img src={preview} className="receipt-preview" alt="Vista previa del comprobante" /> : <span className="receipt-pdf" aria-hidden>PDF</span>}
          <div><strong>{file.name}</strong><span>{file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 2 })} MB`} · Listo para enviar</span></div>
          <Button variant="link" disabled={busy || disabled} onClick={remove}>Quitar archivo</Button>
        </div> : <><span className="upload-mark" aria-hidden>↥</span><span className="upload-instruction">Tu comprobante, en un solo paso.</span><span className="upload-desktop-hint">También podés arrastrarlo hasta acá.</span></>}
        <div className="upload-source-buttons"><Button variant="outline-primary" disabled={busy || disabled} onClick={() => input.current?.click()}>{file ? 'CAMBIAR ARCHIVO' : 'ELEGIR FOTO O PDF'}</Button><Button variant="outline-primary" className="camera-button" disabled={busy || disabled} onClick={() => camera.current?.click()}>USAR CÁMARA</Button></div>
        <small id="receipt-format">JPG, PNG o PDF · Hasta 5 MB</small>
      </div>
      <p className="privacy-note">Sólo vos y la administración pueden ver el comprobante. El archivo se elimina a los <b>3 meses calendario de su carga</b>; tu compra conserva su historial.</p>
      <Button type="submit" className="w-100" disabled={busy || disabled || !file}>{busy ? <><Spinner size="sm" /> ENVIANDO COMPROBANTE…</> : 'ENVIAR PARA REVISIÓN'}</Button>
      <p className="receipt-review-note">La participación se confirma después de verificar la acreditación.</p>
    </form>
  );
}
