import {beforeEach,describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {RaffleWizard} from './components/RaffleWizard';
import {WinnerAnnouncement} from './components/WinnerAnnouncement';
import {api,post} from './api';
import type {Raffle} from './types';
vi.mock('./api',()=>({api:vi.fn(),post:vi.fn(),ApiError:class extends Error{fields={};}}));
const prizes=[{id:'p1',name:'Rifle',description:'Rifle de prueba'},{id:'p2',name:'Mira',description:'Accesorio'}];
const onSaved=vi.fn(async()=>{}),onPrizeCreated=vi.fn(async()=>{});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api).mockResolvedValue({});});
function mount(raffle?:Raffle){render(<RaffleWizard raffle={raffle} prizes={prizes} onClose={()=>{}} onSaved={onSaved} onPrizeCreated={onPrizeCreated}/>);}
function mainData(count='2'){
 fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Rifa con varios premios'}});
 fireEvent.change(screen.getByLabelText('Precio por número (ARS)'),{target:{value:'1500'}});
 fireEvent.change(screen.getByLabelText('Cantidad de puestos premiados'),{target:{value:count}});
 fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));
}
describe('asistente de puestos premiados',()=>{
 it('rechaza menos de diez números y configura diez del 0 al 9 con una cifra',async()=>{
  mount();const total=screen.getByLabelText('Cantidad de números');expect(total).toHaveAttribute('min','10');
  fireEvent.change(total,{target:{value:'1'}});mainData('1');expect(total).toBeInvalid();fireEvent.submit(document.getElementById('raffle-wizard-form')!);expect(screen.getByText('La cantidad de números debe estar entre 10 y 10.000.')).toBeVisible();
  fireEvent.change(total,{target:{value:'10'}});expect(screen.getByText(/Se usa la última cifra/)).toHaveTextContent('Numeración: 0 a 9');
  fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));fireEvent.change(screen.getByLabelText('Premio 1'),{target:{value:'p1'}});fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));fireEvent.click(screen.getByRole('button',{name:'GUARDAR BORRADOR'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string)).toMatchObject({totalTickets:10,lotteryDigits:1});
 });
 it('conserva los datos, permite repetir un premio entre puestos y guarda sólo al confirmar',async()=>{
  mount();expect(screen.queryByLabelText('Cifras de cada resultado')).toBeNull();expect(screen.getByText(/Se usan las últimas 2 cifras/)).toBeVisible();mainData();const fields=screen.getAllByRole('group');
  expect(fields).toHaveLength(2);
  for(const field of fields)fireEvent.change(within(field).getByLabelText('Premio 1'),{target:{value:'p1'}});
  fireEvent.click(within(fields[0]).getByRole('button',{name:'+ AGREGAR OTRO PREMIO'}));
  fireEvent.change(within(fields[0]).getByLabelText('Premio 2'),{target:{value:'p2'}});
  fireEvent.change(within(fields[0]).getAllByLabelText('Cantidad')[1],{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Anterior'}));expect(screen.getByLabelText('Título')).toHaveValue('Rifa con varios premios');
  fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));
  expect(api).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'GUARDAR BORRADOR'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  const input=JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string);
  expect(input.totalTickets).toBe(100);expect(input.lotteryDigits).toBe(2);expect(input.awards).toEqual([{rank:1,prizes:[{prizeId:'p1',quantity:1},{prizeId:'p2',quantity:2}]},{rank:2,prizes:[{prizeId:'p1',quantity:1}]}]);
 });
 it.each([[1000,3,'000 a 999','237'],[10000,4,'0000 a 9999','1237']])('publica %i números con cifras automáticas y muestra su rango',async(total,digits,range,example)=>{
  mount();fireEvent.change(screen.getByLabelText('Cantidad de números'),{target:{value:String(total)}});
  expect(screen.getByText(new RegExp(`Numeración: ${range}`))).toHaveTextContent(`1237 → ${example}`);
  mainData('1');fireEvent.change(screen.getByLabelText('Premio 1'),{target:{value:'p1'}});
  fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));
  expect(screen.getByText(new RegExp(`Se toman las últimas ${digits} cifras`))).toHaveTextContent(range);
  fireEvent.change(screen.getByLabelText('Estado'),{target:{value:'ACTIVE'}});fireEvent.click(screen.getByRole('button',{name:'PUBLICAR RIFA'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string)).toMatchObject({totalTickets:total,lotteryDigits:digits,status:'ACTIVE'});
 });
 it('crea un premio desde el puesto sin perder la rifa y lo asigna',async()=>{
  vi.mocked(post).mockResolvedValue({id:'p3',name:'Funda nueva',description:'Nueva funda'});
  mount();mainData('1');fireEvent.click(screen.getByRole('button',{name:'+ CREAR PREMIO'}));
  fireEvent.change(screen.getByLabelText('Nombre del nuevo premio'),{target:{value:'Funda nueva'}});
  fireEvent.click(screen.getByRole('button',{name:'GUARDAR Y ASIGNAR PREMIO'}));
  await waitFor(()=>expect(screen.getByLabelText('Premio 1')).toHaveValue('p3'));
  expect(onPrizeCreated).toHaveBeenCalledOnce();expect(api).not.toHaveBeenCalled();
 });
 it('muestra varios puestos ganados por la misma persona con sus propios premios',()=>{
  const raffle={id:'r',title:'Rifa',prize:prizes[0],lotteryDigits:2,winnerNumber:37,status:'FINISHED',awards:[{rank:1,winningNumber:37,officialNumber:'5737',winnerDisplayName:'Ana P.',prizes:[{prizeId:'p1',name:'Rifle',description:'',quantity:1}]},{rank:2,winningNumber:37,officialNumber:'1237',winnerDisplayName:'Ana P.',prizes:[{prizeId:'p2',name:'Mira',description:'',quantity:2}]}]} as Raffle;
  render(<WinnerAnnouncement raffle={raffle}/>);
  expect(screen.getAllByText('Ana P.')).toHaveLength(2);expect(screen.getByText('2 × Mira')).toBeVisible();
 });
 it('crea y asigna dos unidades del premio de número gratis desde el asistente',async()=>{
  vi.mocked(post).mockResolvedValue({id:'free',name:'Número gratis',description:'',kind:'FREE_TICKET'});
  mount();mainData('1');fireEvent.click(screen.getByRole('button',{name:'+ CREAR PREMIO'}));
  fireEvent.change(screen.getByLabelText('Tipo de premio'),{target:{value:'FREE_TICKET'}});fireEvent.change(screen.getByLabelText('Nombre del nuevo premio'),{target:{value:'Número gratis'}});
  fireEvent.click(screen.getByRole('button',{name:'GUARDAR Y ASIGNAR PREMIO'}));await waitFor(()=>expect(screen.getByLabelText('Premio 1')).toHaveValue('free'));
  expect(post).toHaveBeenCalledWith('/admin/prizes',{name:'Número gratis',description:'',kind:'FREE_TICKET'});
  fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'SIGUIENTE'}));
  expect(screen.getByText('2 × Número gratis')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'GUARDAR BORRADOR'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string).awards).toEqual([{rank:1,prizes:[{prizeId:'free',quantity:2}]}]);
 });
});
