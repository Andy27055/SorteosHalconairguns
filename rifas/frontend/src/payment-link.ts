export function safePaymentLink(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('No se pudo obtener un enlace de pago válido. Intentá nuevamente.'); }
  if (url.protocol !== 'https:' || !/(^|\.)mercadopago\.(com|com\.ar)$/i.test(url.hostname) || url.username || url.password) throw new Error('El enlace recibido no corresponde a Mercado Pago. Volvé a consultar tu compra.');
  return url.href;
}
