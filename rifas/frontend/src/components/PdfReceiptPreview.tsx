import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ErrorBox, Loading } from './UI';

export function PdfReceiptPreview({ blob }: { blob: Blob }) {
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(1);const [zoom,setZoom]=useState(1);
  const [width,setWidth]=useState(700);const [error,setError]=useState('');const [rendering,setRendering]=useState(true);
  const stage=useRef<HTMLDivElement>(null);const mount=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let active=true;let task:PDFDocumentLoadingTask|undefined;
    async function load(){
      try{
        const pdfjs=await import('pdfjs-dist');const data=await blob.arrayBuffer();if(!active)return;
        pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
        const assets=`${import.meta.env.BASE_URL}pdfjs-assets/`;
        task=pdfjs.getDocument({data,enableXfa:false,useSystemFonts:true,disableWorkerRendering:true,wasmUrl:`${assets}wasm/`,cMapUrl:`${assets}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assets}standard_fonts/`});
        const loaded=await task.promise;if(active)setDocument(loaded);
      }catch{if(active){setError('No pudimos mostrar este PDF. Podés descargarlo para revisarlo.');setRendering(false);}}
    }
    void load();return()=>{active=false;void task?.destroy().catch(()=>{});};
  },[blob]);
  useEffect(()=>{
    if(!stage.current)return;const element=stage.current;
    const measure=()=>setWidth(Math.max(180,element.clientWidth-24));measure();
    const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!document||!mount.current)return;let active=true;let task:RenderTask|undefined;
    setRendering(true);setError('');
    const holder=mount.current;
    async function render(){
      try{
        const pdfPage=await document!.getPage(page);if(!active)return;
        const base=pdfPage.getViewport({scale:1});const viewport=pdfPage.getViewport({scale:width/base.width*zoom});
        const pixelRatio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(12000000/(viewport.width*viewport.height)));
        const canvas=window.document.createElement('canvas');canvas.width=Math.ceil(viewport.width*pixelRatio);canvas.height=Math.ceil(viewport.height*pixelRatio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Página ${page} de ${document!.numPages} del comprobante`);holder.replaceChildren(canvas);
        task=pdfPage.render({canvas,viewport,transform:[pixelRatio,0,0,pixelRatio,0,0]});await task.promise;
        if(active)setRendering(false);
      }catch{if(active){setError('No pudimos mostrar esta página del comprobante. Podés descargar el PDF.');setRendering(false);}}
    }
    void render();return()=>{active=false;task?.cancel();holder.replaceChildren();};
  },[document,page,width,zoom]);
  return <div className="pdf-receipt-preview"><div className="receipt-viewer-toolbar" role="group" aria-label="Controles del PDF"><Button size="sm" variant="outline-primary" disabled={!document||page===1} onClick={()=>setPage(page-1)} aria-label="Página anterior">←</Button><span>Página {page} de {document?.numPages||'…'}</span><Button size="sm" variant="outline-primary" disabled={!document||page===document.numPages} onClick={()=>setPage(page+1)} aria-label="Página siguiente">→</Button><Button size="sm" variant="outline-primary" disabled={!document||zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-.25))} aria-label="Alejar comprobante">−</Button><span>{Math.round(zoom*100)}%</span><Button size="sm" variant="outline-primary" disabled={!document||zoom>=2.5} onClick={()=>setZoom(Math.min(2.5,zoom+.25))} aria-label="Acercar comprobante">+</Button></div><ErrorBox message={error}/>{rendering&&<Loading/>}<div ref={stage} className="receipt-preview-stage" aria-busy={rendering}><div ref={mount}/></div></div>;
}
