import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {FreeTicketWallet,FreeTicketOffer} from './components/FreeTicketBenefits';
import type {FreeTicketBenefit} from './types';
const state=vi.hoisted(()=>({data:[] as unknown[],error:''}));
vi.mock('./hooks/useFetch',()=>({useFetch:()=>({data:state.data,error:state.error,refresh:vi.fn()})}));
const benefit=(overrides:Partial<FreeTicketBenefit>={}):FreeTicketBenefit=>({id:'b',quantity:2,remaining:2,revoked:false,available:true,rank:2,sourceRaffle:{id:'old',title:'Rifa anterior',status:'FINISHED'},targetRaffle:{id:'next',title:'Rifa posterior',status:'ACTIVE'},availableRaffles:[{id:'next',title:'Rifa posterior',status:'ACTIVE'}],...overrides});
beforeEach(()=>{state.data=[benefit()];state.error='';});
describe('premios de números gratis',()=>{
 it('explica una entrega manual sin necesitar una rifa de origen',()=>{
  state.data=[benefit({sourceRaffle:null,rank:null,reason:'Entrega especial'})];render(<MemoryRouter><FreeTicketWallet/></MemoryRouter>);
  expect(screen.getByText(/Entregado por administración/)).toBeVisible();expect(screen.getByText('Entrega especial')).toBeVisible();expect(screen.getByRole('link')).toHaveAttribute('href','/rifas/next');
 });
 it('permite ir desde los premios ganados a elegir los números de una rifa posterior',()=>{
  render(<MemoryRouter><FreeTicketWallet/></MemoryRouter>);expect(screen.getByText('2 número(s) gratis')).toBeVisible();
  expect(screen.getByRole('link',{name:'ELEGIR EN Rifa posterior ↗'})).toHaveAttribute('href','/rifas/next');
 });
 it('explica la espera cuando la siguiente rifa no está asignada',()=>{
  state.data=[benefit({availableRaffles:[],available:false,targetRaffle:null})];render(<MemoryRouter><FreeTicketWallet/></MemoryRouter>);
  expect(screen.getByText(/Se asignará a la siguiente rifa que se active/)).toBeVisible();expect(screen.queryByRole('link')).toBeNull();
 });
 it('no ofrece premios agotados ni revocados',()=>{
  state.data=[benefit({remaining:0}),benefit({id:'revoked',revoked:true})];render(<MemoryRouter><FreeTicketWallet/></MemoryRouter>);expect(screen.queryByText('TUS NÚMEROS GRATIS')).toBeNull();
 });
 it('exige datos de comprador confirmados y canjea sin iniciar un pago',()=>{
  const onRedeem=vi.fn(),view=render(<FreeTicketOffer raffleId="next" count={2} ready={false} busy={false} onRedeem={onRedeem}/>);
  expect(screen.getByRole('button',{name:'USAR NÚMEROS GRATIS'})).toBeDisabled();
  view.rerender(<FreeTicketOffer raffleId="next" count={2} ready busy={false} onRedeem={onRedeem}/>);fireEvent.click(screen.getByRole('button',{name:'USAR NÚMEROS GRATIS'}));expect(onRedeem).toHaveBeenCalledOnce();expect(screen.getByText('$0')).toBeVisible();
 });
 it('no mezcla números adicionales con el canje ni ofrece beneficios de otra rifa',()=>{
  const view=render(<FreeTicketOffer raffleId="next" count={3} ready busy={false} onRedeem={vi.fn()}/>);
  expect(screen.getByText(/Los adicionales se reservan y pagan por separado/)).toBeVisible();expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<FreeTicketOffer raffleId="other" count={1} ready busy={false} onRedeem={vi.fn()}/>);expect(screen.queryByText('TU PREMIO: NÚMEROS GRATIS')).toBeNull();
 });
});
