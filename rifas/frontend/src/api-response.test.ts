import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
afterEach(()=>vi.unstubAllGlobals());
describe('respuestas del túnel temporal',()=>{
  it('explica el rechazo en texto en lugar de interpretarlo como JSON',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,url:'https://demo.trycloudflare.com/api/auth/login',json:async()=>{throw SyntaxError('Unauthorized');}}));
    await expect(api('/auth/login')).rejects.toMatchObject({status:401,message:expect.stringContaining('acceso temporal')});
  });
  it('nunca considera exitosa una página HTML de autenticación',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,url:'https://cf-cloudflare-quicktunnels.cloudflareaccess.com/login',json:async()=>{throw SyntaxError('HTML');}}));
    await expect(api('/auth/login')).rejects.toThrow('acceso temporal');
  });
  it('conserva el error específico de una contraseña incorrecta del sitio',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:'Usuario o contraseña incorrectos.'})}));
    await expect(api('/auth/login')).rejects.toThrow('Usuario o contraseña incorrectos.');
  });
});
