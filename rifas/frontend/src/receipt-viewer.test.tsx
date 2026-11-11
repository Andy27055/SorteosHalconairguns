import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReceiptViewer } from './components/ReceiptViewer';
import { fetchReceipt, post, saveReceipt } from './api';
import type { Order } from './types';
vi.mock('./api',()=>({fetchReceipt:vi.fn(),post:vi.fn(),saveReceipt:vi.fn()}));
const receipt={id:'receipt',mimeType:'image/png',size:40,uploadedAt:new Date().toISOString(),deleteAfter:new Date(Date.now()+86400000).toISOString()};
const order={id:'order',raffle:{title:'Rifa'},numbers:[1],amountCents:500000,status:'UNDER_REVIEW'} as Order;
beforeEach(()=>{vi.clearAllMocks();URL.createObjectURL=vi.fn(()=> 'blob:private-preview');URL.revokeObjectURL=vi.fn();vi.mocked(fetchReceipt).mockResolvedValue(new Blob(['image'],{type:'image/png'}));});
describe('visor privado de comprobantes',()=>{
  it('permite aprobar con la observación vacía y conserva la restricción al cambiar a rechazo',async()=>{
    vi.mocked(post).mockResolvedValue({ok:true});render(<ReceiptViewer receipt={receipt} order={order} initialDecision="approve" onClose={vi.fn()} onReviewed={vi.fn().mockResolvedValue(undefined)}/>);
    await screen.findByRole('img',{name:'Comprobante de transferencia'});expect(screen.getByLabelText(/Observación para el participante/)).not.toBeRequired();expect(screen.getByRole('button',{name:'CONFIRMAR APROBACIÓN'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'RECHAZAR COMPROBANTE'}));expect(screen.getByLabelText(/Observación para el participante/)).toBeRequired();expect(screen.getByRole('button',{name:'CONFIRMAR RECHAZO'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'APROBAR TRANSFERENCIA'}));fireEvent.click(screen.getByRole('button',{name:'CONFIRMAR APROBACIÓN'}));await waitFor(()=>expect(post).toHaveBeenCalledWith('/admin/orders/order/review',{decision:'approve',note:''}));
  });
  it('visualiza sin descargar, descarga sólo al pedirlo y libera la imagen al cerrar',async()=>{
    const {unmount}=render(<ReceiptViewer receipt={receipt} onClose={vi.fn()}/>);
    const image=await screen.findByRole('img',{name:'Comprobante de transferencia'});expect(image).toHaveAttribute('src','blob:private-preview');expect(saveReceipt).not.toHaveBeenCalled();expect(fetchReceipt).toHaveBeenCalledWith('receipt',expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button',{name:'DESCARGAR COMPROBANTE'}));expect(saveReceipt).toHaveBeenCalledOnce();unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
  });
  it('envía la decisión y observación desde la misma ventana',async()=>{
    const reviewed=vi.fn().mockResolvedValue(undefined);const close=vi.fn();vi.mocked(post).mockResolvedValue({ok:true});render(<ReceiptViewer receipt={receipt} order={order} initialDecision="reject" onClose={close} onReviewed={reviewed}/>);
    await screen.findByRole('img',{name:'Comprobante de transferencia'});expect(screen.getByRole('button',{name:'CONFIRMAR RECHAZO'})).toBeDisabled();fireEvent.change(screen.getByLabelText(/Observación para el participante/),{target:{value:'  Archivo incorrecto.  '}});fireEvent.click(screen.getByRole('button',{name:'CONFIRMAR RECHAZO'}));
    await waitFor(()=>expect(post).toHaveBeenCalledWith('/admin/orders/order/review',{decision:'reject',note:'Archivo incorrecto.',reasonCode:'OTHER'}));await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(reviewed).toHaveBeenCalledOnce();
  });
  it('un archivo inaccesible no habilita descargar ni aprobar',async()=>{
    vi.mocked(fetchReceipt).mockRejectedValue(new Error('Archivo vencido'));render(<ReceiptViewer receipt={receipt} order={order} onReviewed={vi.fn()} initialDecision="approve" onClose={vi.fn()}/>);
    await screen.findByText('Archivo vencido');expect(screen.getByRole('button',{name:'DESCARGAR COMPROBANTE'})).toBeDisabled();fireEvent.change(screen.getByLabelText(/Observación para el participante/),{target:{value:'Verificado'}});expect(screen.getByRole('button',{name:'CONFIRMAR APROBACIÓN'})).toBeDisabled();expect(post).not.toHaveBeenCalled();
  });
  it.each([['Monto incorrecto','INCORRECT_AMOUNT','24 a 48 horas'],['Datos incorrectos','INCORRECT_DETAILS','Halcón Airguns no se hace responsable'],['Pago no realizado','PAYMENT_NOT_MADE','se descontó el saldo']])('el motivo rápido %s completa el mensaje y se conserva al enviarlo',async(label,code,text)=>{
    vi.mocked(post).mockResolvedValue({ok:true});render(<ReceiptViewer receipt={receipt} order={{...order,buyerDni:'01234567',buyerEmail:'ana@example.com'}} initialDecision="reject" onClose={vi.fn()} onReviewed={vi.fn().mockResolvedValue(undefined)}/>);await screen.findByRole('img',{name:'Comprobante de transferencia'});fireEvent.click(screen.getByRole('button',{name:label}));const input=screen.getByLabelText(/Observación para el participante/);expect((input as HTMLTextAreaElement).value).toContain(text);fireEvent.click(screen.getByRole('button',{name:'CONFIRMAR RECHAZO'}));await waitFor(()=>expect(post).toHaveBeenCalledWith('/admin/orders/order/review',expect.objectContaining({decision:'reject',reasonCode:code,note:expect.stringContaining(text)})));
  });
});
