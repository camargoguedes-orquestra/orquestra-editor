/** Adaptador TypeScript para API HTTP do sistema hospedeiro. */
export interface OrquestraDocument {
 id:string; displayName:string; sha256:string; mime:string; size:number;
}
export interface ApiOptions {
 endpoint:string; csrfToken:string; credentials?:RequestCredentials;
}
export async function uploadDocument(file:File,options:ApiOptions):Promise<OrquestraDocument> {
 if(!file || !options.endpoint)throw new Error('Arquivo e endpoint obrigatorios');
 const form=new FormData();
 form.set('file',file,file.name);
 form.set('profile','contratos');
 const response=await fetch(options.endpoint,{
  method:'POST',body:form,credentials:options.credentials??'same-origin',
  headers:{'X-CSRF-Token':options.csrfToken}
 });
 const data:unknown=await response.json();
 if(!response.ok)throw new Error('Falha HTTP '+response.status);
 if(!data || typeof data!=='object' || !('id' in data) || typeof data.id!=='string')
  throw new Error('Resposta da API fora do contrato');
 return data as OrquestraDocument;
}
/** A API /api/documents/upload é um contrato; o host deve implementá-la. */
