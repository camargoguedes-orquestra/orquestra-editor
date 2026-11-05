# OrquestraFileUploader — protótipo de desenvolvimento
Componente de interface independente, sem dependências npm. Permite arrastar vários arquivos de extensões diferentes, fila, concorrência e progresso real por arquivo (XHR).

**Não é um módulo completo nem autorizado para produção.** O servidor continua responsável por identidade, autorização, validação de extensão/MIME/tamanho, quota, antivírus, staging, persistência e vínculos.

Exemplo:
```html
<link rel="stylesheet" href="./packages/file-uploader/src/styles.css">
<div id="anexos"></div>
<script type="module">
import { OrquestraFileUploader } from './packages/file-uploader/src/index.mjs';
const files = new OrquestraFileUploader({
  element: '#anexos',
  uploadUrl: '/api/documentos/upload',
  profile: {
    id: 'contratos',
    extensions: {pdf: 20*1024*1024, docx: 10*1024*1024},
    maxFiles: 10,
    maxTotalBytes: 100*1024*1024
  },
  concurrentUploads: 3,
  autoUpload: false,
  headers: () => ({'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content}),
  fields: { contextType: 'ordem_servico', contextId: '1258' },
  onEvent: event => console.log(event)
});
</script>
```

Interface pública inicial: `addFiles(files)`, `start()`, `setMetadata(id,{displayName,description})`, `destroy()`. Eventos: `file.queued`, `file.rejected`, `upload.started`, `upload.progress`, `upload.completed`, `upload.failed`, `upload.canceled`.

Contrato provisório: POST multipart com file, profile, displayName, description e campos extras; resposta de sucesso JSON `{"ok":true,"id":"id"}`. O backend não está implementado nesta etapa.

Teste: `node --test packages/file-uploader/tests/policy.test.mjs`.

Ainda pendente: edição visual de metadados, frontend final, API segura, conectores bancos/storage, painel, OCR, viewers, compartilhar por convites, assinaturas e testes E2E.
