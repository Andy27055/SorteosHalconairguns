import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from './components/PasswordInput';

describe('mostrar la contraseña', () => {
  it('alterna sin borrar el valor ni enviar el formulario', () => {
    let submitted = false;
    render(<form onSubmit={e => {e.preventDefault();submitted=true;}}><label htmlFor="secret">Contraseña</label><PasswordInput id="secret" defaultValue="clave-de-prueba" autoComplete="current-password"/></form>);
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type','password');
    fireEvent.click(screen.getByRole('button',{name:'Mostrar contraseña'}));
    expect(input).toHaveAttribute('type','text'); expect(input).toHaveValue('clave-de-prueba');
    expect(screen.getByRole('button',{name:'Ocultar contraseña'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'Ocultar contraseña'}));
    expect(input).toHaveAttribute('type','password'); expect(submitted).toBe(false);
    expect(input).toHaveAttribute('autocomplete','current-password');
  });
});
