import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {AccountCreateDialog,AccountDeleteDialog} from './components/AccountManagementDialogs';
import {api,post} from './api';
import type {User} from './types';
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),api:vi.fn(),post:vi.fn()}));
const state=vi.hoisted(()=>({canDelete:true,refresh:vi.fn()}));
const user={id:'target',username:'ana',fullName:'Ana Pérez',email:'ana@example.com',role:'USER',active:true} as User;
vi.mock('./hooks/useFetch',()=>({useFetch:()=>({data:{user,orders:3,activeOrders:state.canDelete?0:1,activeBenefits:0,canDelete:state.canDelete},loading:false,error:'',refresh:state.refresh})}));
beforeEach(()=>{vi.clearAllMocks();state.canDelete=true;vi.mocked(api).mockResolvedValue({});vi.mocked(post).mockResolvedValue({});});
it('crea un administrador funcional con verificación opcional y permite ver su contraseña',async()=>{
 const changed=vi.fn(async()=>{});render(<AccountCreateDialog onClose={()=>{}} onChanged={changed}/>);
 for(const [label,value] of [['Nombre','Ana'],['Apellido','Pérez'],['Usuario','ana'],['Correo electrónico','ana@example.com'],['Contraseña inicial','ClaveDePrueba2026']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 expect(screen.getByLabelText('Contraseña inicial')).toHaveAttribute('type','password');fireEvent.click(screen.getByRole('button',{name:'Mostrar contraseña'}));expect(screen.getByLabelText('Contraseña inicial')).toHaveAttribute('type','text');
 fireEvent.change(screen.getByLabelText('Tipo de cuenta'),{target:{value:'ADMIN'}});fireEvent.click(screen.getByRole('checkbox',{name:'Enviar correo para verificar la cuenta'}));
 fireEvent.click(screen.getByRole('button',{name:'CREAR CUENTA'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(post).toHaveBeenCalledWith('/admin/users',expect.objectContaining({firstName:'Ana',lastName:'Pérez',role:'ADMIN',sendVerification:false,password:'ClaveDePrueba2026'}));
});
it('exige la palabra exacta antes de borrar y conserva el aviso sobre el historial',async()=>{
 const changed=vi.fn(async()=>{});render(<AccountDeleteDialog user={user} onClose={()=>{}} onChanged={changed}/>);
 const button=screen.getByRole('button',{name:'ELIMINAR DEFINITIVAMENTE'});expect(button).toBeDisabled();fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para eliminar esta cuenta'),{target:{value:'confirmar'}});expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para eliminar esta cuenta'),{target:{value:'CONFIRMAR'}});fireEvent.click(button);await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api).toHaveBeenCalledWith('/admin/users/target/permanent',{method:'DELETE',body:JSON.stringify({confirmation:'CONFIRMAR'})});
});
it('ofrece sólo desactivar cuando tiene compras activas',async()=>{
 state.canDelete=false;const changed=vi.fn(async()=>{});render(<AccountDeleteDialog user={user} onClose={()=>{}} onChanged={changed}/>);
 expect(screen.queryByRole('button',{name:'ELIMINAR DEFINITIVAMENTE'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'DESACTIVAR CUENTA'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api).toHaveBeenCalledWith('/admin/users/target',{method:'DELETE'});
});
it('actualiza el estado si una nueva compra impide borrar después de abrir el diálogo',async()=>{
 vi.mocked(api).mockRejectedValue(new Error('Hay una compra pendiente'));const close=vi.fn();render(<AccountDeleteDialog user={user} onClose={close} onChanged={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Escribí CONFIRMAR para eliminar esta cuenta'),{target:{value:'CONFIRMAR'}});fireEvent.click(screen.getByRole('button',{name:'ELIMINAR DEFINITIVAMENTE'}));await screen.findByText('Hay una compra pendiente');expect(state.refresh).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();
});
