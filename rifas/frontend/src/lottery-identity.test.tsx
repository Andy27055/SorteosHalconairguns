import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {WinnerAnnouncement} from './components/WinnerAnnouncement';
import {VerifyEmailPage} from './pages/VerifyEmailPage';
import {post} from './api';
import type {Raffle} from './types';
vi.mock('./api',()=>({post:vi.fn()}));
const raffle={id:'r',title:'Rifa oficial',status:'FINISHED',winnerNumber:0,winnerDisplayName:'Ana P.',lotteryDigits:2,drawnAt:'2026-11-13T00:30:00Z',lotteryResult:{date:'2026-11-12',head:'5700',drawNumber:'12913',sourceUrl:'https://loteria.gba.gob.ar/resultados',sourceSha256:'a'.repeat(64),checkedAt:'2026-11-13T00:30:00Z'}} as Raffle;
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();window.history.replaceState(null,'','/');});
describe('anuncio transparente',()=>{
 it('publica ganador, 00 y fecha y permite consultar sólo la fuente oficial',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T02:00:00Z'));render(<WinnerAnnouncement raffle={raffle}/>);expect(screen.getByText('00')).toBeInTheDocument();expect(screen.getByText('Ana P.')).toBeInTheDocument();expect(screen.getByText('5700')).toBeInTheDocument();expect(screen.getByRole('link')).toHaveAttribute('href','https://loteria.gba.gob.ar/resultados');});
 it('retira el enlace al llegar la medianoche argentina aunque la página siga abierta',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T02:59:59Z'));render(<WinnerAnnouncement raffle={raffle}/>);expect(screen.getByRole('link')).toBeInTheDocument();act(()=>{vi.advanceTimersByTime(2000);});expect(screen.queryByRole('link')).toBeNull();expect(screen.getByText('00')).toBeInTheDocument();expect(screen.getByText('5700')).toBeInTheDocument();});
 it('no presenta enlaces arbitrarios guardados en datos antiguos',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T02:00:00Z'));render(<WinnerAnnouncement raffle={{...raffle,lotteryResult:{...raffle.lotteryResult!,sourceUrl:'https://ajeno.example.com'}}}/>);expect(screen.queryByRole('link')).toBeNull();});
});
describe('confirmación por correo',()=>{
 it('abrir el enlace no verifica automáticamente; confirmar consume el token por POST',async()=>{window.history.replaceState(null,'','/verificar-correo#token-ficticio');vi.mocked(post).mockResolvedValue({ok:true});render(<MemoryRouter><VerifyEmailPage/></MemoryRouter>);expect(post).not.toHaveBeenCalled();expect(window.location.hash).toBe('');fireEvent.click(screen.getByRole('button',{name:'CONFIRMAR MI CORREO'}));await waitFor(()=>expect(post).toHaveBeenCalledWith('/auth/verify-email',{token:'token-ficticio'}));expect(await screen.findByRole('heading',{name:'CORREO CONFIRMADO'})).toBeInTheDocument();});
 it('permite establecer una contraseña propia al confirmar',async()=>{window.history.replaceState(null,'','/verificar-correo#token-ficticio');vi.mocked(post).mockResolvedValue({ok:true});render(<MemoryRouter><VerifyEmailPage/></MemoryRouter>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.change(screen.getByLabelText('Nueva contraseña'),{target:{value:'UnaClavePropia2026'}});fireEvent.click(screen.getByRole('button',{name:'CONFIRMAR MI CORREO'}));await waitFor(()=>expect(post).toHaveBeenCalledWith('/auth/verify-email',{token:'token-ficticio',password:'UnaClavePropia2026'}));});
});
