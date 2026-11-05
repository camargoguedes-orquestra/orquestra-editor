/** Perfil modular JSON independente: importacao nao amplia permissoes do servidor. */
const allowed=new Set(['editor','image-uploader','file-uploader','file-viewer','file-manager','document-core','document-ocr','document-search','secure-share','document-requests']);
export function validateProfile(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Perfil deve ser objeto');
 if(p.schemaVersion!=='1.0')throw Error('schemaVersion incompatível');
 if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(p.name||''))throw Error('Nome inválido');
 if(!/^\d+\.\d+\.\d+/.test(p.version||''))throw Error('Versão inválida');
 if(!Array.isArray(p.components)||!p.components.length||p.components.some(x=>!allowed.has(x)))throw Error('Componente desconhecido');
 const check=(value,depth=0)=>{
  if(depth>15)throw Error('Profundidade excedida');
  if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){
   if(/^(password|secret|accessToken|apiKey|privateKey|credentials)$/i.test(k))throw Error('Campo reservado não pode ser compartilhado');
   check(v,depth+1);
  }
 };
 check(p);
 if(p.upload?.extensions)for(const [ext,bytes] of Object.entries(p.upload.extensions)){
  if(!/^[a-z0-9]{1,12}$/.test(ext)||!Number.isSafeInteger(bytes)||bytes<1)throw Error('Extensão inválida');
 }
 return structuredClone(p);
}
export function importProfile(source){if(typeof source!=='string'||source.length>262144)throw Error('JSON excede limite');return validateProfile(JSON.parse(source));}
export function exportProfile(profile){return JSON.stringify(validateProfile(profile),null,2)+'\n';}
