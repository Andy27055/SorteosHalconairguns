import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBox, Status } from './components/UI';
import { registrationSchema } from './pages/AuthPage';
import { money, statusLabels } from './types';
describe('formularios y estados de compra',()=>{
  it('muestra validación de contraseña corta',()=>{const result=registrationSchema.safeParse({username:'usuario',fullName:'Nombre Apellido',email:'user@example.com',password:'123',dni:'',address:''});expect(result.success).toBe(false);if(!result.success)expect(result.error.flatten().fieldErrors.password?.[0]).toContain('10');});
  it('rechaza HTML en el usuario',()=>expect(registrationSchema.safeParse({username:'<img>',fullName:'Nombre Apellido',email:'user@example.com',password:'clave-larga-123',dni:'',address:''}).success).toBe(false));
  it('acepta datos adicionales vacíos',()=>expect(registrationSchema.safeParse({username:'usuario',fullName:'Nombre Apellido',email:'user@example.com',password:'clave-larga-123',dni:'',address:''}).success).toBe(true));
  it('diferencia comprobante bajo revisión de pago confirmado',()=>{render(<Status value="UNDER_REVIEW"/>);expect(screen.getByText('En revisión')).toBeInTheDocument();expect(screen.queryByText('Pago confirmado')).not.toBeInTheDocument();});
  it('presenta mensajes como texto y no ejecuta HTML',()=>{const {container}=render(<ErrorBox message={'<img src=x onerror=alert(1)>'}/>);expect(screen.getByRole('alert')).toHaveTextContent('<img src=x');expect(container.querySelector('img')).toBeNull();});
  it('ofrece reintento accesible',()=>{render(<ErrorBox message="Sin conexión" retry={()=>{}}/>);expect(screen.getByRole('button',{name:'Reintentar'})).toBeInTheDocument();});
  it('presenta centavos sin perder precisión',()=>expect(money(125050)).toContain('1.250,50'));
  it('expresa revisión y conciliación como estados distintos',()=>expect(statusLabels.NEEDS_ATTENTION).not.toEqual(statusLabels.PAID));
});
