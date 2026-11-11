import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransferAccountPicker, TransferDetails } from './components/TransferDetails';
import type { Order, PaymentConfig } from './types';
describe('cuentas de transferencia',()=>{
  it('permite seleccionar una segunda cuenta por su titular y alias',()=>{
    const change=vi.fn();render(<TransferAccountPicker accounts={[{id:'primary',holder:'Titular Uno',alias:'primera.prueba',cbu:''},{id:'secondary',holder:'Titular Dos',alias:'segunda.prueba',cbu:''}]} value="primary" onChange={change} disabled={false}/>);
    fireEvent.change(screen.getByLabelText('Cuenta para tu transferencia'),{target:{value:'secondary'}});expect(change).toHaveBeenCalledWith('secondary');expect(screen.getByRole('option',{name:'Titular Dos · segunda.prueba'})).toBeInTheDocument();
  });
  it('muestra el destino guardado en la compra aunque cambie la configuración',()=>{
    render(<TransferDetails order={{id:'compra',amountCents:500000,transferAccountId:'secondary',transferHolder:'Titular original',transferAlias:'alias.original',transferCbu:''} as Order} config={{transferHolder:'Otro titular',transferAlias:'alias.nuevo',transferCbu:'123456'} as PaymentConfig}/>);
    expect(screen.getByText('Titular original')).toBeInTheDocument();expect(screen.getByText('alias.original')).toBeInTheDocument();expect(screen.queryByText('alias.nuevo')).toBeNull();expect(screen.queryByText('123456')).toBeNull();
  });
});
