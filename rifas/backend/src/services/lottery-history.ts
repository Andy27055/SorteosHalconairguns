import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {AppError} from '../errors.js';
import type {LotteryResult} from './lottery.js';
export const historyUrl=(day:string)=>`https://loteria.gba.gob.ar/api-loteria/extractos/${day}`;
export async function boundedText(url:string,limit=12*1024*1024){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'application/json,text/html','Cache-Control':'no-cache'}});
 if(!response.ok||!response.body)throw new Error('OFFICIAL_HTTP');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('OFFICIAL_SIZE');}chunks.push(value);}
 return Buffer.concat(chunks).toString('utf8');
}
export function parseHistoricalText(text:string,day:string){
 const expected=day.split('-').reverse().join('/');const dates=text.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[];
 const match=text.match(/\b(\d{4,6})\s+Realizado a las\s+PROVINCIA\s+NOCTURNA\s+\d{1,2}:\d{2}\s+(\d{4})\s+1[º°]\s+Premi(?:o)?\s+([\s\S]+)/);
 if(!text.includes('EXTRACTO OFICIAL')||dates[0]!==expected||!match)throw new AppError(503,'El extracto histórico no permite verificar fecha, Provincia y Nocturna. El resultado queda pendiente.');
 const tokens=match[3].trim().split(/\s+/);const numbers:string[]=[];
 for(let index=0;index<20;index++){if(tokens[index*2]!==String(index+1)||!/^\d{4}$/.test(tokens[index*2+1]||''))throw new AppError(503,'El extracto histórico está incompleto o cambió de formato.');numbers.push(tokens[index*2+1]);}
 if(numbers[0]!==match[2])throw new AppError(503,'El primer premio del extracto presenta datos inconsistentes.');
 return {head:numbers[0],drawNumber:match[1],numbers};
}
export async function fetchHistoricalNocturna(day:string):Promise<LotteryResult>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new AppError(400,'Fecha de resultado inválida.');
 const data=JSON.parse(await boundedText(historyUrl(day))) as {html?:string};
 const noct=data.html?.split(/<h3\b[^>]*>/i).find(s=>/^Nocturna\b/i.test(s));
 if(!noct)throw new AppError(409,'Todavía no está disponible el extracto oficial nocturno de la fecha requerida.');
 const files=[...noct.matchAll(/<li[\s\S]*?<p[^>]*>([^<]+\.pdf)<\/p>[\s\S]*?href="data:application\/pdf;base64,([A-Za-z0-9+/=]+)"/g)];
 const file=files.find(m=>m[1]==='QuinielaNocturna.pdf');
 if(!file)throw new AppError(409,'El extracto nocturno bonaerense aún no está publicado.');
 const pdf=Buffer.from(file[2],'base64');if(pdf.length>5*1024*1024||!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new AppError(503,'El extracto oficial no tiene un formato válido.');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const require=createRequire(import.meta.url);const assets=path.dirname(require.resolve('pdfjs-dist/package.json'));
 const task=getDocument({data:new Uint8Array(pdf),enableXfa:false,useWasm:false,disableFontFace:true,useSystemFonts:false,standardFontDataUrl:path.join(assets,'standard_fonts').replaceAll('\\','/')+'/'});
 try{const doc=await task.promise;if(doc.numPages>5)throw new Error('PDF_PAGES');const page=await doc.getPage(1);const content=await page.getTextContent();const text=content.items.filter((item):item is import('pdfjs-dist/types/src/display/api.js').TextItem=>'str'in item).map(item=>item.str).filter(s=>s.trim()).join(' ').replace(/\s+/g,' ');const result=parseHistoricalText(text,day);
  return {date:day,head:result.head,drawNumber:result.drawNumber,sourceUrl:'https://loteria.gba.gob.ar/resultados',sourceSha256:createHash('sha256').update(pdf).digest('hex'),checkedAt:new Date().toISOString(),extract:JSON.stringify({archiveUrl:historyUrl(day),file:'QuinielaNocturna.pdf',date:day,drawNumber:result.drawNumber,numbers:result.numbers,text})};
 }finally{await task.destroy();}
}
