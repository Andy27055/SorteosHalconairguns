export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error { constructor(message: string, public status: number, public fields: Record<string, string[]> = {}) { super(message); } }
let bearer = '';
export const setBearer = (value: string) => { bearer = value; };
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  let response: Response;
  try { response = await fetch(`${API_URL}${url}`, { ...options, credentials: 'include', headers, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }); }
  catch (error) { if (options.signal?.aborted) throw error; throw new ApiError('No pudimos conectar. Revisá tu conexión y volvé a intentar.', 0); }
  const data = await response.json().catch(() => ({ error: 'El servidor no devolvió una respuesta válida.' }));
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/auth/login')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(data.error || 'No se pudo completar la operación.', response.status, data.fields);
  }
  return data as T;
}
export const post = <T>(url: string, body?: unknown) => api<T>(url, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export async function downloadReceipt(id: string) {
  const res = await fetch(`${API_URL}/receipts/${encodeURIComponent(id)}`, { credentials: 'include', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new ApiError(data.error || 'No se pudo descargar el comprobante.', res.status); }
  const blob = await res.blob(); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `comprobante-${id}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadPrivateFile(path: string, filename: string) {
  const response=await fetch(`${API_URL}${path}`,{credentials:'include',headers:bearer?{Authorization:`Bearer ${bearer}`}:{},signal:AbortSignal.timeout(30000)});
  if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));const data=await response.json().catch(()=>({}));throw new ApiError(data.error||'No se pudo descargar el archivo.',response.status);}
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
