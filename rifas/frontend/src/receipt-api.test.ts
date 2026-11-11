import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReceipt, setBearer } from './api';
afterEach(()=>{setBearer('');vi.unstubAllGlobals();});
describe('carga autenticada para la vista previa',()=>{
  it('usa la ruta privada con cookies y token, sin crear un enlace público',async()=>{
    const blob=new Blob(['%PDF-1.4'],{type:'application/pdf'});const fetch=vi.fn().mockResolvedValue({ok:true,blob:async()=>blob});vi.stubGlobal('fetch',fetch);setBearer('private-token');expect(await fetchReceipt('receipt-1')).toBe(blob);expect(fetch).toHaveBeenCalledWith('/api/receipts/receipt-1',expect.objectContaining({credentials:'include',headers:{Authorization:'Bearer private-token'}}));
  });
  it('propaga el vencimiento y nunca interpreta el error como archivo',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:410,json:async()=>({error:'Comprobante vencido'})}));await expect(fetchReceipt('expired')).rejects.toMatchObject({status:410,message:'Comprobante vencido'});
  });
});
