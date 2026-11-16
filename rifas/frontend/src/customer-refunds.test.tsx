import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {CustomerRefundDialog,canRequestRefund} from './components/CustomerRefunds';
import {post} from './api';
import type {Order} from './types';
vi.mock('./api',()=>({post:vi.fn()}));
const order={id:'order',status:'PAID',method:'TRANSFER',paidAt:new Date().toISOString(),unitPriceCents:10025,amountCents:30075,numbers:[7,8,9],raffle:{id:'r',title:'Rifa activa',status:'ACTIVE',totalTickets:100,ticketPriceCents:99999,drawAt:null}} as Order;
beforeEach(()=>{vi.clearAllMocks();vi.mocked(post).mockResolvedValue({});});
it('permite solicitar sólo con pago confirmado, rifa abierta y sin otra solicitud pendiente',()=>{
 expect(canRequestRefund(order)).toBe(true);
 for(const status of ['RESERVED','UNDER_REVIEW','REFUND_PENDING','REFUNDED'] as const)expect(canRequestRefund({...order,status})).toBe(false);
 for(const status of ['DRAFT','CLOSING','CANCELLED','FINISHED'] as const)expect(canRequestRefund({...order,raffle:{...order.raffle,status}})).toBe(false);
 expect(canRequestRefund({...order,method:'FREE_TICKET',amountCents:0})).toBe(false);
 expect(canRequestRefund({...order,raffle:{...order.raffle,drawAt:new Date(Date.now()-3600000).toISOString()}})).toBe(false);
 expect(canRequestRefund({...order,refundRequests:[{id:'request',orderId:'order',numbers:[7],amountCents:10025,reason:'',status:'PENDING',createdAt:new Date().toISOString()}]})).toBe(false);
});
it('calcula con el precio pagado y solicita únicamente los números elegidos',async()=>{
 const submitted=vi.fn(async()=>{});render(<CustomerRefundDialog order={order} onClose={()=>{}} onSubmitted={submitted}/>);
 const send=screen.getByRole('button',{name:'ENVIAR SOLICITUD'});expect(send).toBeDisabled();fireEvent.click(screen.getByLabelText('Devolver número 07'));fireEvent.click(screen.getByLabelText('Devolver número 09'));
 expect(screen.getByText(/200,50/)).toBeInTheDocument();fireEvent.click(send);await waitFor(()=>expect(submitted).toHaveBeenCalledOnce());
 expect(post).toHaveBeenCalledWith('/orders/order/refund-requests',expect.objectContaining({numbers:[7,9],reason:'',requestId:expect.any(String)}));expect(vi.mocked(post).mock.calls[0][1]).not.toHaveProperty('amountCents');
});
it('conserva el identificador al reintentar una solicitud sin respuesta',async()=>{
 vi.mocked(post).mockRejectedValueOnce(new Error('Sin respuesta')).mockResolvedValueOnce({});render(<CustomerRefundDialog order={order} onClose={()=>{}} onSubmitted={vi.fn(async()=>{})}/>);
 fireEvent.click(screen.getByLabelText('Devolver número 07'));fireEvent.click(screen.getByRole('button',{name:'ENVIAR SOLICITUD'}));await screen.findByText('Sin respuesta');fireEvent.click(screen.getByRole('button',{name:'ENVIAR SOLICITUD'}));await waitFor(()=>expect(post).toHaveBeenCalledTimes(2));expect(vi.mocked(post).mock.calls[0]).toEqual(vi.mocked(post).mock.calls[1]);
});
