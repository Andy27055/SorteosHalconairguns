import { RejectionReasons, type RejectionCode } from './RejectionReasons';
import { useEffect, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { fetchReceipt, post, saveReceipt } from '../api';
import type { Order, Receipt } from '../types';
import { date, money } from '../types';
import { ErrorBox, Loading } from './UI';
import { PdfReceiptPreview } from './PdfReceiptPreview';
type Decision = 'approve' | 'reject';
interface Props { receipt: Receipt; order?: Order; initialDecision?: Decision; onClose: () => void; onReviewed?: () => Promise<void> }
export function ReceiptViewer({ receipt, order, initialDecision, onClose, onReviewed }: Props) {
  const [file,setFile]=useState<{blob:Blob;url:string}|null>(null);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
  const [decision,setDecision]=useState<Decision|''>(initialDecision||'');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);const [reviewError,setReviewError]=useState('');
  const [reasonCode,setReasonCode]=useState<RejectionCode>('OTHER');
  const canReview=!!onReviewed&&order?.status==='UNDER_REVIEW';
  const noteValid=note.trim().length<=500&&(decision!=='reject'||note.trim().length>=5);
  useEffect(()=>{
    const abort=new AbortController();let url='';setLoading(true);setError('');setFile(null);
    void fetchReceipt(receipt.id,abort.signal).then(blob=>{if(abort.signal.aborted)return;if(blob.type!=='application/pdf')url=URL.createObjectURL(blob);setFile({blob,url});}).catch(err=>{if(!abort.signal.aborted)setError((err as Error).message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
  },[receipt.id,attempt]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!canReview||!decision||!noteValid||busy||!file)return;
    setBusy(true);setReviewError('');
    try{await post(`/admin/orders/${order!.id}/review`,{decision,note:note.trim(),...(decision==='reject'?{reasonCode}:{})});await onReviewed!();onClose();}
    catch(err){setReviewError((err as Error).message);}finally{setBusy(false);}
  }
  return <Modal show onHide={()=>!busy&&onClose()} size="xl" fullscreen="sm-down" centered scrollable className="receipt-viewer-modal" aria-labelledby="receipt-viewer-title"><Modal.Header closeButton={!busy}><Modal.Title id="receipt-viewer-title">VER COMPROBANTE</Modal.Title></Modal.Header><Modal.Body>{order&&<div className="receipt-review-summary"><div><strong>{order.user?.fullName||'Comprobante de tu compra'}</strong><span>{order.raffle.title} · Números {order.numbers.join(' · ')}</span></div><b>{money(order.amountCents)}</b>{order.transferHolder&&<span>Destino: {order.transferHolder} · {order.transferAlias||order.transferCbu}</span>}</div>}<p className="receipt-viewer-meta">Enviado el {date(receipt.uploadedAt)} · Disponible hasta {date(receipt.deleteAfter)}</p><ErrorBox message={error} retry={()=>setAttempt(attempt+1)}/>{loading&&<Loading/>}{file&&(file.blob.type==='application/pdf'?<PdfReceiptPreview blob={file.blob}/>:<div className="receipt-image-stage"><img src={file.url} alt="Comprobante de transferencia" onError={()=>setError('No pudimos mostrar la imagen. Podés descargarla para revisarla.')}/></div>)}{canReview&&<form id="receipt-review-form" className="receipt-review-form" onSubmit={submit}><h3>REVISAR TRANSFERENCIA</h3><p className="small muted">Verificá la acreditación en la cuenta bancaria antes de aprobar. Si lo rechazás, los números se liberarán.</p><div className="receipt-review-decisions" role="group" aria-label="Decisión del comprobante"><Button type="button" variant={decision==='approve'?'primary':'outline-primary'} disabled={busy} aria-pressed={decision==='approve'} onClick={()=>{setDecision('approve');setReasonCode('OTHER');setNote('');}}>APROBAR TRANSFERENCIA</Button><Button type="button" variant="outline-danger" disabled={busy} aria-pressed={decision==='reject'} onClick={()=>setDecision('reject')}>RECHAZAR COMPROBANTE</Button></div>{decision==='reject'&&<div className="purchase-rejection-box"><h4>COMPRA A RECHAZAR</h4><p>{[order?.buyerFirstName||order?.user?.firstName,order?.buyerLastName||order?.user?.lastName].filter(Boolean).join(' ')||order?.user?.fullName}<br/>{order?.buyerEmail||order?.user?.email}<br/>DNI: {order?.buyerDni||order?.user?.dni||'Sin registrar'}<br/>{order?.raffle.title} &middot; {order?.numbers.join(' \u00b7 ')}<br/>Referencia: {order?.id}<br/>Importe de la compra: {order?money(order.amountCents):''}</p><RejectionReasons value={reasonCode} disabled={busy} onSelect={(code,message)=>{setReasonCode(code);setNote(message);}}/><p className="small muted">El motivo y el comentario se enviar&aacute;n al cliente por email. Pod&eacute;s editar el mensaje antes de confirmar.</p></div>}<div className="field"><label htmlFor="receipt-review-note">Observación para el participante {decision==='reject'?'(obligatoria, mín. 5 caracteres)':'(opcional)'}</label><textarea id="receipt-review-note" value={note} disabled={busy} required={decision==='reject'} minLength={decision==='reject'?5:undefined} maxLength={500} onChange={e=>setNote(e.target.value)}/></div><ErrorBox message={reviewError}/></form>}</Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={!file||busy} onClick={()=>file&&saveReceipt(file.blob,receipt.id)}>DESCARGAR COMPROBANTE</Button><Button variant="outline-primary" disabled={busy} onClick={onClose}>CERRAR</Button>{canReview&&<Button form="receipt-review-form" type="submit" variant={decision==='reject'?'outline-danger':'primary'} disabled={busy||!file||!decision||!noteValid}>{busy?'GUARDANDO…':decision==='reject'?'CONFIRMAR RECHAZO':'CONFIRMAR APROBACIÓN'}</Button>}</Modal.Footer></Modal>;
}
