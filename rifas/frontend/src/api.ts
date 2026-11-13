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
  const data = await responseJson(response);
  if (!response.ok) {
    if (response.status === 401 && data.code !== 'DEMO_ACCESS_REQUIRED' && !url.startsWith('/auth/login')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(data.error || 'No se pudo completar la operación.', response.status, data.fields);
  }
  return data as T;
}
export const post = <T>(url: string, body?: unknown) => api<T>(url, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function responseJson(response: Response) {
  try { return await response.json(); }
  catch {
    if ([401, 403].includes(response.status) || /(?:cloudflareaccess\.com|login\.trycloudflare\.com)/i.test(response.url || '')) {
      throw new ApiError('El acceso temporal a la demostración venció. Volvé a abrir su enlace y completá el acceso antes de iniciar sesión.', response.status);
    }
    throw new ApiError('El servidor devolvió un formato inesperado. Actualizá la página y volvé a intentar.', response.status);
  }
}
export async function fetchReceipt(id: string, signal?: AbortSignal): Promise<Blob> {
  let res: Response;
  try { res = await fetch(`${API_URL}/receipts/${encodeURIComponent(id)}`, { credentials: 'include', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }); }
  catch (error) { if(signal?.aborted) throw error; throw new ApiError('No pudimos cargar el comprobante. Revisá tu conexión y volvé a intentar.', 0); }
  if (!res.ok) { if(res.status===401)window.dispatchEvent(new Event('session-expired'));const data = await res.json().catch(() => ({})); throw new ApiError(data.error || 'No se pudo cargar el comprobante.', res.status); }
  const blob = await res.blob();
  if(!['application/pdf','image/png','image/jpeg'].includes(blob.type)||!blob.size||blob.size>5*1024*1024)throw new ApiError('El archivo no tiene un formato de comprobante compatible.', 415);
  return blob;
}
export function saveReceipt(blob: Blob, id: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `comprobante-${id}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadReceipt(id: string) { saveReceipt(await fetchReceipt(id),id); }
export async function downloadPrivateFile(path: string, filename: string) {
  const response=await fetch(`${API_URL}${path}`,{credentials:'include',headers:bearer?{Authorization:`Bearer ${bearer}`}:{},signal:AbortSignal.timeout(30000)});
  if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));const data=await response.json().catch(()=>({}));throw new ApiError(data.error||'No se pudo descargar el archivo.',response.status);}
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
