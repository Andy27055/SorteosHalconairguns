import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {ManualFreeTicketsDialog} from './components/ManualFreeTicketsDialog';
import {post} from './api';
import type {User} from './types';
vi.mock('./api',()=>({post:vi.fn()}));
const state=vi.hoisted(()=>({benefits:[] as unknown[]}));
vi.mock('./hooks/useFetch',()=>({useFetch:(url:string)=>({data:url==='/admin/raffles'?[{id:'draft',title:'Rifa próxima',status:'DRAFT',totalTickets:100},{id:'active',title:'Rifa actual',status:'ACTIVE',totalTickets:100},{id:'closed',title:'Rifa finalizada',status:'FINISHED',totalTickets:100}]:state.benefits,error:'',loading:false,refresh:vi.fn()})}));
const user={id:'u',username:'ana',fullName:'Ana Pérez',email:'ana@example.com'} as User;
beforeEach(()=>{state.benefits=[];vi.clearAllMocks();});
it('exige elegir una rifa cargada y reintenta con la misma solicitud',async()=>{
 const onGranted=vi.fn(async()=>{});vi.mocked(post).mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValueOnce({});
 render(<ManualFreeTicketsDialog user={{id:'u',username:'ana',fullName:'Ana Pérez',email:'ana@example.com'} as User} onClose={()=>{}} onGranted={onGranted}/>);
 expect(screen.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'})).toBeDisabled();expect(screen.queryByRole('option',{name:/Rifa finalizada/})).toBeNull();expect(screen.getByRole('option',{name:/Rifa actual/})).toBeVisible();
 fireEvent.change(screen.getByLabelText('Cantidad de números gratis'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('Rifa donde puede usarlos'),{target:{value:'draft'}});fireEvent.change(screen.getByLabelText('Motivo (opcional)'),{target:{value:'Entrega de premio'}});
 fireEvent.click(screen.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'}));await screen.findByText('Conexión interrumpida');
 fireEvent.click(screen.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'}));await waitFor(()=>expect(onGranted).toHaveBeenCalledOnce());
 expect(post).toHaveBeenCalledTimes(2);expect(vi.mocked(post).mock.calls[0]).toEqual(vi.mocked(post).mock.calls[1]);expect(post).toHaveBeenLastCalledWith('/admin/users/u/free-tickets',expect.objectContaining({quantity:2,targetRaffleId:'draft',reason:'Entrega de premio',requestId:expect.any(String)}));
});
it('asigna un beneficio anterior pendiente sin volver a acreditar números',async()=>{
 state.benefits=[{id:'pending',remaining:2,sourceRaffle:null,targetRaffle:null,reason:'Entrega anterior'}];vi.mocked(post).mockResolvedValue({});const onGranted=vi.fn(async()=>{});
 render(<ManualFreeTicketsDialog user={user} onClose={()=>{}} onGranted={onGranted}/>);
 fireEvent.change(screen.getByLabelText('Entrega'),{target:{value:'pending'}});expect(screen.queryByLabelText('Cantidad de números gratis')).toBeNull();fireEvent.change(screen.getByLabelText('Rifa donde puede usarlos'),{target:{value:'active'}});
 fireEvent.click(screen.getByRole('button',{name:'OTORGAR NÚMEROS GRATIS'}));await waitFor(()=>expect(onGranted).toHaveBeenCalledOnce());expect(post).toHaveBeenCalledWith('/admin/users/u/free-tickets/pending/target',{targetRaffleId:'active'});
});
