/**
 * OrquestraFileViewer: independente, nenhuma dependencia do FileUploader.
 * O backend hospedeiro fornece URLs de visualizacao AUTORIZADAS, nunca storage paths.
 */
const EXTENSIONS={
  pdf:'pdf',png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',bmp:'image',svg:'blocked',
  txt:'text',md:'text',csv:'text',json:'text',xml:'text',log:'text',html:'text',
  mp3:'audio',wav:'audio',ogg:'audio',m4a:'audio',mp4:'video',webm:'video',
  doc:'office',docx:'office',odt:'office',xls:'office',xlsx:'office',ods:'office',
  ppt:'office',pptx:'office',odp:'office',zip:'archive'
};
export function detectViewerType(name='',mime='') {
  const ext=String(name).split('.').pop().toLowerCase();
  if (EXTENSIONS[ext]) return EXTENSIONS[ext];
  if (mime==='application/pdf') return 'pdf';
  if (/^image\/(png|jpeg|gif|webp|bmp)$/.test(mime)) return 'image';
  if (/^audio\/(mpeg|wav|ogg|mp4)$/.test(mime)) return 'audio';
  if (/^video\/(mp4|webm)$/.test(mime)) return 'video';
  if (mime==='text/plain' || mime==='application/json') return 'text';
  return 'unsupported';
}
export function safeSameOriginUrl(value,base) {
  const url=new URL(String(value),base || globalThis.location?.origin || 'https://localhost');
  const origin=new URL(base || globalThis.location?.origin || 'https://localhost').origin;
  if (url.origin!==origin || !['https:','http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('URL de visualizacao deve ser same-origin e autorizada pelo backend');
  return url.href;
}
function element(tag,cls,text) {
  const el=document.createElement(tag);
  if (cls) el.className=cls;
  if (text!==undefined) el.textContent=String(text);
  return el;
}
export class OrquestraFileViewer {
  constructor({element:target,resolve,fetchImpl=globalThis.fetch,allowDownload=false,onEvent=()=>{},maxTextBytes=2097152}) {
    this.root=typeof target==='string'?document.querySelector(target):target;
    if (!this.root || typeof resolve!=='function') throw new Error('element e resolve(fileId,operation) obrigatorios');
    this.resolve=resolve; this.fetchImpl=fetchImpl; this.allowDownload=!!allowDownload;
    this.onEvent=onEvent;this.maxTextBytes=maxTextBytes;this.render();
  }
  render() {
    this.root.classList.add('orq-file-viewer');
    this.root.replaceChildren();
    this.header=element('div','orq-viewer-toolbar');
    this.title=element('strong','orq-viewer-title','Nenhum documento selecionado');
    this.status=element('span','orq-viewer-status','');
    this.download=element('button','orq-viewer-download','Baixar');
    this.download.type='button';this.download.hidden=true;
    this.download.addEventListener('click',()=>this.downloadFile());
    this.header.append(this.title,this.status,this.download);
    this.content=element('div','orq-viewer-content','Selecione um arquivo.');
    this.root.append(this.header,this.content);
  }
  async open(file) {
    if (!file || typeof file.id!=='string' || file.id==='') throw new Error('file.id obrigatorio');
    this.file={id:file.id,name:String(file.name||'Documento'),mime:String(file.mime||'')};
    this.title.textContent=this.file.name;
    this.content.replaceChildren(element('p','','Carregando prévia autorizada...'));
    this.download.hidden=true;
    const operation=detectViewerType(this.file.name,this.file.mime);
    try {
      if (operation==='blocked' || operation==='unsupported') {
        this.content.replaceChildren(element('p','','Formato sem prévia segura. Consulte as opções de download.'));
        return;
      }
      const auth=await this.resolve(this.file.id,'view');
      if (!auth || typeof auth.url!=='string') throw new Error('Backend nao retornou URL autorizada');
      const url=safeSameOriginUrl(auth.url);
      this.viewUrl=url;
      if (this.allowDownload && auth.downloadAllowed === true) this.download.hidden=false;
      this.content.replaceChildren();
      if (operation==='image') {
        const img=element('img','orq-viewer-image'); img.src=url;img.alt=this.file.name;img.loading='lazy';this.content.append(img);
      } else if (operation==='pdf' || operation==='office') {
        if (operation==='office' && !auth.convertedPdf) {
          this.content.append(element('p','','Prévia Office depende de adaptador de conversão configurado.'));return;
        }
        const frame=element('iframe','orq-viewer-frame');frame.title='Prévia de '+this.file.name;
        frame.referrerPolicy='no-referrer';frame.src=url;this.content.append(frame);
      } else if (operation==='audio' || operation==='video') {
        const media=element(operation,'orq-viewer-media');media.controls=true;media.preload='metadata';media.src=url;this.content.append(media);
      } else if (operation==='archive') {
        this.content.append(element('p','','Arquivo ZIP: a listagem de entradas exige um adaptador de manifesto seguro no backend.'));
      } else if (operation==='text') {
        const res=await this.fetchImpl(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'text/plain'}});
        if (!res.ok) throw new Error('Falha HTTP '+res.status);
        const len=Number(res.headers.get('content-length')||0);
        if (len>this.maxTextBytes) throw new Error('Texto maior que o limite configurado');
        const reader=res.body?.getReader();
        let bytes=new Uint8Array(0);
        if (reader) {
          const parts=[];let total=0;
          try {while(true){const chunk=await reader.read();if(chunk.done)break;
            total+=chunk.value.byteLength;
            if(total>this.maxTextBytes)throw new Error('Limite da prévia textual excedido');
            parts.push(chunk.value);
          }} finally{reader.releaseLock();}
          bytes=new Uint8Array(total);let off=0;for(const part of parts){bytes.set(part,off);off+=part.length;}
          this.content.append(element('pre','orq-viewer-text',new TextDecoder().decode(bytes)));
        } else {
          const value=await res.text();
          if(value.length>this.maxTextBytes)throw new Error('Limite de texto excedido');
          this.content.append(element('pre','orq-viewer-text',value));
        }
      }
      this.onEvent({type:'viewer.opened',id:this.file.id,format:operation});
    } catch (err) {
      this.content.replaceChildren(element('p','orq-viewer-error',err.message||'Prévia indisponível'));
      this.onEvent({type:'viewer.failed',id:this.file.id,error:String(err)});
    }
  }
  async downloadFile() {
    if (!this.file || !this.allowDownload) return;
    const access=await this.resolve(this.file.id,'download');
    if (!access?.downloadAllowed) throw new Error('Download nao autorizado');
    const url=safeSameOriginUrl(access.url);
    const link=element('a'); link.href=url;link.rel='noopener noreferrer';link.download=this.file.name;
    this.root.append(link);link.click();link.remove();
    this.onEvent({type:'viewer.download-requested',id:this.file.id});
  }
  close(){this.file=null;this.download.hidden=true;this.title.textContent='Nenhum documento selecionado';this.content.replaceChildren();}
  destroy(){this.close();this.root.replaceChildren();this.root.classList.remove('orq-file-viewer');}
}
