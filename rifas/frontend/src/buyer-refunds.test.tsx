import { beforeEach,describe,expect,it,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { BuyerRemovalDialog,RefundCompletionDialog,centsFromRefundInput } from './components/BuyerRefundDialogs';
import { post } from './api';
import type { BuyerRecord,PendingRefund } from './types';
vi.mock('./api',()=>({post:vi.fn()}));
const buyer:BuyerRecord={id:'order',version:'a'.repeat(64),firstName:'Ana',lastName:'Pérez',email:'ana@example.com',dni:'01234567',numbers:[1,2],amountCents:1000000,incomplete:false,emailStatuses:['SENT'],orders:[{id:'order',numbers:[1,2],amountCents:1000000,method:'TRANSFER',paidAt:new Date().toISOString()}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(post).mockResolvedValue({ok:true});});
describe('baja y gestión de reembolsos',()=>{
  it('muestra los datos completos y exige CONFIRMAR en mayúscula antes de enviar la baja',async()=>{
    const removed=vi.fn().mockResolvedValue(undefined);render(<BuyerRemovalDialog buyer={buyer} raffleId="rifa" raffleTitle="Rifa de prueba" onClose={vi.fn()} onRemoved={removed}/>);
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();expect(screen.getByText('01234567')).toBeInTheDocument();expect(screen.getByText('Pérez')).toBeInTheDocument();const confirm=screen.getByRole('button',{name:'CONFIRMAR BAJA'});expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para autorizar la baja'),{target:{value:'confirmar'}});expect(confirm).toBeDisabled();expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para autorizar la baja'),{target:{value:'CONFIRMAR'}});fireEvent.click(confirm);await waitFor(()=>expect(post).toHaveBeenCalledWith('/admin/raffles/rifa/buyers/remove',{anchorOrderId:'order',version:buyer.version,confirmation:'CONFIRMAR'}));expect(removed).toHaveBeenCalledOnce();
  });
  it('no registra un reembolso realizado sin referencia y confirmación',async()=>{
    const refund:PendingRefund={...buyer,id:'order',refundAmountCents:1000000,requestedAt:new Date().toISOString(),reason:'Baja solicitada'};render(<RefundCompletionDialog refund={refund} onClose={vi.fn()} onCompleted={vi.fn().mockResolvedValue(undefined)}/>);const confirm=screen.getByRole('button',{name:'REGISTRAR DEVOLUCIÓN'});expect(confirm).toBeDisabled();fireEvent.change(screen.getByLabelText('Referencia del reembolso (mín. 5 caracteres)'),{target:{value:'Referencia bancaria 123'}});fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para registrar la devolución'),{target:{value:'CONFIRMAR'}});fireEvent.click(confirm);await waitFor(()=>expect(post).toHaveBeenCalledWith('/admin/orders/order/refund-complete',{confirmation:'CONFIRMAR',reference:'Referencia bancaria 123',amountCents:1000000}));
  });
  it('convierte importes con coma sin perder centavos ni admitir formatos ambiguos',()=>{expect(centsFromRefundInput('10000,25')).toBe(1000025);expect(centsFromRefundInput('25.50')).toBe(2550);expect(centsFromRefundInput('1e5')).toBe(0);expect(centsFromRefundInput('20.005')).toBe(0);});
});
