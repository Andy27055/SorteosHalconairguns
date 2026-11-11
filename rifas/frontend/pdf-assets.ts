import { readdirSync, readFileSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
// Serve only PDF.js decoder/font assets, and include the same files in production.
export function pdfAssets(): Plugin {
  const root=path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const assets=new Map<string,string>();
  for(const folder of ['wasm','cmaps','standard_fonts'])for(const file of readdirSync(path.join(root,folder))){
    if(/\.(wasm|bcmap|pfb|ttf|mjs|js)$/.test(file)||file.startsWith('LICENSE'))assets.set(`/pdfjs-assets/${folder}/${file}`,path.join(root,folder,file));
  }
  return {name:'pdf-receipt-assets',configureServer(server){server.middlewares.use((req,res,next)=>{
    const name=(req.url||'').split('?')[0];const file=assets.get(name);if(!file)return next();
    res.setHeader('Content-Type',name.endsWith('.wasm')?'application/wasm':/\.m?js$/.test(name)?'text/javascript':'application/octet-stream');createReadStream(file).on('error',next).pipe(res);
  });},generateBundle(){for(const [name,file] of assets)this.emitFile({type:'asset',fileName:name.slice(1),source:readFileSync(file)});}};
}
