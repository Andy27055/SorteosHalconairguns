import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RafflesHome } from './components/RafflesHome';
import { ReceiptUpload, validateReceiptFile } from './components/ReceiptUpload';
import { safePaymentLink } from './payment-link';
import { api } from './api';
import type { Raffle } from './types';

const state = vi.hoisted(() => ({ data: [] as Raffle[], loading: false, error: '' }));
vi.mock('./hooks/useFetch', () => ({ useFetch: () => ({ ...state, refresh: vi.fn() }) }));
vi.mock('./api', () => ({ api: vi.fn() }));
const raffle: Raffle = { id: 'test-rifa', title: 'Rifa activa de prueba', description: 'Descripción del premio', prize: { id: 'p1', name: 'Premio de prueba', description: '' }, prizeId: 'p1', ticketPriceCents: 500000, totalTickets: 100, status: 'ACTIVE', sold: 10, available: 90 };

describe('el cliente encuentra las rifas al abrir el sitio', () => {
  it('la primera sección permite elegir números antes de las instrucciones', () => {
    state.data = [raffle]; render(<MemoryRouter><RafflesHome /></MemoryRouter>);
    const heading = screen.getByRole('heading', { level: 1, name: 'RIFAS HALCÓN.' });
    expect(heading.closest('section')).toContainElement(screen.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ }));
    expect(screen.getByText('1 rifa activa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toHaveAttribute('href', '/rifas/test-rifa');
  });
  it('mantiene disponibles varias rifas y oculta resultados anteriores hasta desplegarlos', () => {
    state.data = [{ ...raffle, id: 'finished', title: 'Rifa anterior', status: 'FINISHED', winnerNumber: 9 }, raffle, { ...raffle, id: 'segunda', title: 'Segunda rifa' }];
    const { container } = render(<MemoryRouter><RafflesHome /></MemoryRouter>);
    expect(screen.getByText('2 rifas activas')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toHaveLength(2);
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });
  it('sin rifas activas comunica el estado y no presenta inscripciones falsas', () => {
    state.data = []; render(<MemoryRouter><RafflesHome /></MemoryRouter>);
    expect(screen.getByText('SE VIENEN NUEVAS OPORTUNIDADES.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toBeNull();
  });
});
describe('comprobantes desde el teléfono', () => {
  it.each([{ size: 0, type: 'application/pdf' }, { size: 6 * 1024 * 1024, type: 'image/jpeg' }, { size: 100, type: 'text/html' }])('rechaza archivo inválido antes de enviarlo', file => expect(validateReceiptFile(file)).not.toBe(''));
  it.each(['image/jpeg', 'image/png', 'application/pdf'])('acepta %s hasta el límite declarado', type => expect(validateReceiptFile({ type, size: 5 * 1024 * 1024 })).toBe(''));
  it('envía el archivo como multipart y actualiza el estado de la compra', async () => {
    vi.mocked(api).mockResolvedValueOnce({ id: 'receipt-test' });
    const onUploaded = vi.fn().mockResolvedValue(undefined); const refresh = vi.fn().mockResolvedValue(undefined);
    render(<ReceiptUpload orderId="order-test" disabled={false} onRefresh={refresh} onUploaded={onUploaded} />);
    const file = new File(['%PDF-1.7 prueba'], 'comprobante.pdf', { type: 'application/pdf' });
    fireEvent.change(document.getElementById('receipt-file')!, { target: { files: [file] } });
    expect(screen.getByText('comprobante.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR PARA REVISIÓN' }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith('/orders/order-test/receipt', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
  });
  it('permite quitar y volver a seleccionar un comprobante', () => {
    render(<ReceiptUpload orderId="order-test" disabled={false} onRefresh={async () => {}} onUploaded={async () => {}} />);
    fireEvent.change(document.getElementById('receipt-file')!, { target: { files: [new File(['pdf'], 'archivo.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }));
    expect(screen.queryByText('archivo.pdf')).toBeNull();
    expect(screen.getByRole('button', { name: 'ENVIAR PARA REVISIÓN' })).toBeDisabled();
  });
});
describe('enlaces de Mercado Pago', () => {
  it('acepta enlaces HTTPS del proveedor', () => expect(safePaymentLink('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test')).toContain('mercadopago.com.ar'));
  it.each(['javascript:alert(1)', 'https://mercadopago.com.ar.ejemplo.com/pago', 'http://www.mercadopago.com.ar/pago', 'https://user:pass@mercadopago.com/pago'])('rechaza un enlace no válido: %s', url => expect(() => safePaymentLink(url)).toThrow());
});
