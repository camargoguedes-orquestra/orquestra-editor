# OrquestraFileManager

Interface independente para listagem, pesquisa incremental, seleção, ações e ordenação de documentos. **Estado de desenvolvimento**: a API de dados é injetada pelo hospedeiro, sem backend nativo pronto.

```js
import {OrquestraFileManager} from './packages/file-manager/src/index.mjs';
const manager=new OrquestraFileManager({
 element:'#manager',
 load:async()=>{const r=await fetch('/api/documents',{credentials:'same-origin'});if(!r.ok)throw Error('Não autorizado');return r.json();},
 onOpen:file=>viewer.open({id:file.id,name:file.name,mime:file.mime}),
 onDownload:file=>requestDownload(file.id),
 onDelete:file=>requestDelete(file.id)
});
await manager.refresh();
```

O callback `load` deve retornar elementos `{id,name,description,size,canView,canDownload,canDelete}`. Os campos `can*` só controlam botões: **o backend deve validar novamente as permissões em todas as operações**.

O gerenciador não depende de `FileViewer`, `FileUploader` nem `Editor`.
