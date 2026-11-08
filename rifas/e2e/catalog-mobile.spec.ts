import { test, expect, type Page, type Route } from '@playwright/test';

const raffle = { id: 'rifa-vigente', title: 'Rifa Halcón Airguns', description: 'Compartí nuestra pasión y elegí tus números.', prize: { id: 'premio', name: 'Premio Halcón', description: '' }, prizeId: 'premio', ticketPriceCents: 500000, totalTickets: 100, status: 'ACTIVE', sold: 12, available: 88 };
const user = { id: 'cliente-prueba', username: 'participante', fullName: 'Participante de prueba', email: 'participante@example.com', role: 'USER' };
const config = { mercadoPago: true, sandbox: true, transfer: true, transferAlias: 'simulacion.no.transferir', transferCbu: '', transferHolder: 'Titular ficticio de prueba', receiptMaxMb: 5, receiptRetentionMonths: 3 };
const order = { id: 'compra-prueba', userId: user.id, raffleId: raffle.id, raffle, numbers: [11, 12], unitPriceCents: 500000, amountCents: 1000000, status: 'AWAITING_RECEIPT', method: 'TRANSFER', expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString(), receipts: [] };
async function json(route: Route, data: unknown, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }); }
async function fixture(page: Page, options: { loggedIn?: boolean; raffles?: unknown[] } = {}) {
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') return json(route, options.loggedIn ? { user } : { error: 'Sin sesión' }, options.loggedIn ? 200 : 401);
    if (pathname === '/api/guest-reservations') return json(route,{reservation:null});
    if (pathname === '/api/guest-reservations/claim') return json(route,{order:null});
    if (pathname === '/api/raffles') return json(route, options.raffles ?? [raffle]);
    if (pathname.endsWith('/availability')) return json(route, []);
    if (pathname === `/api/raffles/${raffle.id}`) return json(route, raffle);
    if (pathname === '/api/config') return json(route, config);
    return json(route, { error: 'Solicitud no prevista en la prueba' }, 404);
  });
}

test('una sola rifa es lo primero que ve el cliente en escritorio', async ({ page }) => {
  await fixture(page); await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'RIFAS HALCÓN.' })).toBeVisible();
  const button = page.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ });
  await expect(button).toBeInViewport();
  const firstSection = page.locator('main section').first();
  await expect(firstSection.getByRole('heading', { name: raffle.title, exact: true })).toBeVisible();
  await page.screenshot({ path: 'playwright-artifacts/catalog-desktop.png', fullPage: true });
});

for (const width of [320, 390, 430]) {
  test(`catálogo y números cómodos para tocar a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await fixture(page); await page.goto('/');
    await expect(page.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: 'playwright-artifacts/catalog-mobile.png', fullPage: true });
    await page.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ }).click();
    const number = page.getByRole('button', { name: 'Número 11', exact: true });
    await expect(number).toBeVisible();
    const rect = await number.boundingBox(); expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44);
    await number.click();
    const bar = page.getByLabel('Continuar con los números seleccionados');
    await expect(bar.getByRole('button', { name: /CONTINUAR/ })).toBeInViewport();
    await expect(bar).toContainText('1 número seleccionado');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
test('varias rifas siguen disponibles y los resultados quedan debajo', async ({ page }) => {
  await fixture(page, { raffles: [{ ...raffle, id: 'anterior', status: 'FINISHED', winnerNumber: 19, title: 'Sorteo anterior' }, raffle, { ...raffle, id: 'segunda', title: 'Segunda rifa' }] });
  await page.goto('/'); await expect(page.getByText('2 rifas activas')).toBeVisible();
  await expect(page.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /VER RESULTADO/ })).not.toBeVisible();
  await page.getByText('Resultados anteriores', { exact: false }).click();
  await expect(page.getByRole('link', { name: /VER RESULTADO/ })).toBeVisible();
});
test('carga de PDF en teléfono y confirmación de revisión', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await fixture(page, { loggedIn: true });
  let sent = false;
  await page.route('**/api/orders/compra-prueba', route => json(route, sent ? { ...order, status: 'UNDER_REVIEW', receipts: [{ id: 'comprobante', mimeType: 'application/pdf', size: 30, uploadedAt: new Date().toISOString(), deleteAfter: '2027-02-07T12:00:00Z' }] } : order));
  await page.route('**/api/orders/compra-prueba/receipt', async route => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    expect(route.request().postDataBuffer()!.toString()).toContain('comprobante.pdf');
    sent = true; await json(route, { id: 'comprobante' }, 201);
  });
  await page.goto('/compras/compra-prueba');
  await expect(page.getByRole('button', { name: 'Copiar alias', exact: true })).toBeVisible();
  await page.locator('#receipt-file').setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nPrueba sin valor bancario') });
  await expect(page.getByText('comprobante.pdf')).toBeVisible();
  await page.screenshot({ path: 'playwright-artifacts/receipt-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'ENVIAR PARA REVISIÓN' }).click();
  await expect(page.getByText('Estamos revisando tu transferencia.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ENVIAR PARA REVISIÓN' })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('Mercado Pago muestra un enlace copiable y recupera el botón si falla el proveedor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await fixture(page, { loggedIn: true });
  await page.route('**/api/orders/compra-prueba', route => json(route, { ...order, status: 'PAYMENT_PENDING', method: 'MERCADO_PAGO', checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=prueba' }));
  await page.route('**/api/orders/compra-prueba/checkout', route => json(route, { error: 'El proveedor no respondió. Intentá nuevamente.' }, 502));
  await page.goto('/compras/compra-prueba');
  await expect(page.getByRole('button', { name: 'Copiar enlace de mercado pago', exact: true })).toBeVisible();
  const pay = page.getByRole('button', { name: /ABRIR ENLACE DE PAGO/ }); await pay.click();
  await expect(page.getByRole('alert')).toContainText('El proveedor no respondió.');
  await expect(pay).toBeEnabled();
});
test('después de ingresar el cliente vuelve al catálogo de rifas', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/auth/login', route => json(route, { user, token: 'token-ficticio-solo-para-ui' }));
  await page.goto('/ingresar');
  await page.getByLabel('Usuario o email').fill('participante');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-ficticia-de-prueba');
  await page.getByRole('button', { name: 'INGRESAR', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'RIFAS HALCÓN.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /ELEGIR MIS NÚMEROS/ })).toBeVisible();
});
