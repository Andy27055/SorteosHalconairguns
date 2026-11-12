import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthPage } from './components/AuthForm';
import { BuyersPanel } from './components/BuyersPanel';
import { post, downloadPrivateFile } from './api';
const fixture=vi.hoisted(()=>({reservation:{id:'guest-order',raffleId:'rifa',numbers:[11,12],expiresAt:new Date(Date.now()+600000).toISOString()}}));
vi.mock('./api',()=>({post:vi.fn(),downloadPrivateFile:vi.fn(),ApiError:class extends Error{fields={};}}));
vi.mock('./auth',()=>({useAuth:()=>({accept:vi.fn()})}));
vi.mock('./hooks/useFetch',()=>({useFetch:(url:string)=>({loading:false,error:'',refresh:vi.fn(),data:url.endsWith('/refunds')?[]:url==='/guest-reservations'?{reservation:fixture.reservation}:{raffle:{id:'rifa',title:'Rifa test'},buyers:[{email:'ana@example.com',firstName:'Ana',lastName:'Pérez',dni:'01234567',numbers:[11,12],emailStatuses:['PENDING']}],soldNumbers:2,mailEnabled:false}})}));
describe('continuidad durante autenticación',()=>{
  it('tras ingresar reclama la reserva y abre la misma compra',async()=>{
    vi.mocked(post).mockImplementation(async(url)=>url==='/auth/login'?{user:{id:'user'},token:'test-token'}:{order:{id:'guest-order'}} as never);
    render(<MemoryRouter initialEntries={[{pathname:'/ingresar',state:{guestReservation:fixture.reservation}}]}><Routes><Route path="/ingresar" element={<AuthPage/>}/><Route path="/compras/:id" element={<p>Compra conservada</p>}/></Routes></MemoryRouter>);
    expect(screen.getByText('11 · 12')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Usuario o email'),{target:{value:'ana'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'password-larga'}});fireEvent.click(screen.getByRole('button',{name:/^INGRESAR/}));
    await waitFor(()=>expect(screen.getByText('Compra conservada')).toBeInTheDocument());expect(post).toHaveBeenCalledWith('/guest-reservations/claim');
  });
});
describe('listado por rifa',()=>{
  it('presenta los campos solicitados y descarga Excel desde la rifa elegida',async()=>{
    vi.mocked(downloadPrivateFile).mockResolvedValue(undefined);
    render(<BuyersPanel raffles={[{id:'rifa',title:'Rifa test'} as never]}/>);
    fireEvent.change(screen.getByLabelText('Seleccioná una rifa'),{target:{value:'rifa'}});
    expect(screen.getByRole('columnheader',{name:'Email'})).toBeInTheDocument();expect(screen.getByText('01234567')).toBeInTheDocument();expect(screen.getByText('11 · 12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'DESCARGAR EXCEL'}));await waitFor(()=>expect(downloadPrivateFile).toHaveBeenCalledWith('/admin/raffles/rifa/buyers.xlsx','compradores-rifa.xlsx'));
  });
});
