# Referência da API JavaScript

## Instalação

- Sem Node: copie a pasta do projeto e use `dist/orquestra-editor.js` + `dist/orquestra-editor.css` (ES module, navegador moderno).
- Com npm/bundler: `import { OrquestraEditor } from '@orquestra/editor'` e `import '@orquestra/editor/styles.css'`.
- O código-fonte está em `src/`; `npm run build` regenera `dist/`.

## `OrquestraEditor`

```js
import { OrquestraEditor } from './dist/orquestra-editor.js';

const e = new OrquestraEditor('#editor', {
  id: 'documento-001',
  height: 700,
  pageMode: true,                 // folha A4; false = edição contínua
  autosave: true,                 // rascunho no localStorage
  initialHTML: '<p>Texto</p>',
  saveUrl: '/backend/save-document.php',
  uploadUrl: '/backend/upload.php',
  token: '',
  headers: () => ({ 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }),
  credentials: 'same-origin',     // envia o cookie de sessão do próprio domínio
  name: 'conteudo',               // campo oculto com o HTML, enviado com o <form> da página
  header: true,                   // false esconde o cabeçalho "Salvar documento"
  menubar: true,                  // false esconde os menus Arquivo/Editar/…
  statusbar: true,                // false esconde a barra de status
  image: { width: 1200, height: 800, locked: false, format: 'image/webp', profile: null },
  user: { name: 'Ana' },          // autor de comentários e alterações
  sidebar: false,                 // abre o painel lateral ao iniciar
  trackChanges: false,            // inicia com controle de alterações ligado
  readOnly: false,
  placeholder: 'Comece a escrever… digite / para comandos',
  mergeFields: [{ key: 'unidade', label: 'Unidade' }],
  mentions: [{ id: 'conselho', label: 'Conselho fiscal', description: 'Grupo' }],
  // ou: mentions: async (busca) => fetch('/pessoas?q=' + busca).then(r => r.json())
  toolbar: null,                  // grupos próprios: [['bold','italic'],['@heading','table']]
  labels: { bold: 'Bold' },       // troca rótulos (tradução)
  extensions: [],                 // extensões Tiptap adicionais
  onChange(html, instance) {},
  onSave(html, instance) {},
});
```

### Conteúdo

| Método | Retorno | Finalidade |
|---|---|---|
| `getHTML()` | `string` | Fragmento HTML filtrado pela lista de permissões |
| `setHTML(html, trigger = true)` | `void` | Carrega HTML (aceita HTML da versão 2) |
| `getDocumentHTML()` | `string` | Página HTML completa, com CSS de leitura e fórmulas desenhadas |
| `getJSON()` / `setJSON(json)` | `object` / `void` | Documento no formato JSON do ProseMirror |
| `getMarkdown()` / `setMarkdown(md)` | `string` / `void` | Markdown (GFM) |
| `getText()` | `string` | Texto puro |
| `insertHTML(html)` / `insertText(texto)` | `void` | Insere na posição do cursor |
| `fillFields(dados)` | `boolean` | Troca os campos `{{chave}}` pelos valores de `dados` |
| `hasTemporaryImages()` | `boolean` | Há imagens `blob:` que ainda não foram enviadas |
| `focus()` / `destroy()` | `void` | Foco e desmontagem |

### Arquivos

| Método | Retorno | Finalidade |
|---|---|---|
| `save()` | `Promise<boolean>` | POST `{ id, html, comments }` no `saveUrl` (ou localStorage) |
| `load(versao?)` | `Promise<boolean>` | Reabre o documento atual ou uma versão anterior |
| `versionsDialog()` | `Promise<void>` | Lista as versões do servidor e permite restaurar |
| `importFile(file)` | `Promise<void>` | Abre DOCX, Markdown, HTML ou TXT; imagens embutidas são enviadas ao `uploadUrl` |
| `exportDocx()` | `Promise<Blob>` | Gera e baixa o .docx (com comentários e alterações nativos do Word) |
| `uploadEmbeddedImages()` | `Promise<number>` | Envia ao servidor imagens `data:` presentes no documento |

### Revisão

| Método | Finalidade |
|---|---|
| `addComment(texto, range?)` | Comenta a seleção atual; devolve o id |
| `replyComment(id, texto)` / `resolveComment(id, resolvido)` / `deleteComment(id)` | Conversa do comentário |
| `getComments()` / `setComments(lista)` | Lê ou carrega as conversas (salvas junto com o HTML) |
| `setTrackChanges(ligado)` | Liga ou desliga o controle de alterações |
| `getChanges()` | Lista `{ id, type, author, date, text }` das sugestões pendentes |
| `acceptAllChanges()` / `rejectAllChanges()` | Resolve todas as sugestões |
| `tiptap.commands.acceptChange(id)` / `rejectChange(id)` | Resolve uma sugestão |

### Interface e extensão

| Método / propriedade | Finalidade |
|---|---|
| `run(id)` | Executa uma ação da barra ou dos menus (`'bold'`, `'table'`, `'export-docx'`…) |
| `command(cmd, valor)` | Compatibilidade com nomes `execCommand` da versão 2 (`formatBlock`, `foreColor`…) |
| `registerButton({ id, label, icon, run, active, group })` | Acrescenta botão à barra sem alterar o núcleo |
| `on(evento, fn)` | Eventos `change`, `save`, `comment`, `image`; devolve função para cancelar |
| `toggleSidebar(abrir?)` / `showPanel('toc' \| 'comments' \| 'changes', abrir)` | Painel lateral |
| `openFind()` | Barra de localizar e substituir |
| `tiptap` | Instância do Tiptap para comandos avançados |
| `sanitizeHTML(html)` | Função exportada: lista de permissões de HTML |

### Atalhos

`/` comandos · `@` menções · `:` emojis · `{{` campos · `Ctrl+S` salvar · `Ctrl+K` link · `Ctrl+F` localizar · `Ctrl+H` substituir · `Ctrl+Alt+M` comentar · `Ctrl+Enter` quebra de página · `Ctrl+P` imprimir · `Tab`/`Shift+Tab` recuo em listas. A lista completa está em **Ajuda → Atalhos de teclado**.

### Requisições ao backend

Todas as chamadas do editor (`save`, `load`, histórico de versões e upload de imagens) passam pelo mesmo ponto e recebem:

- `headers`: objeto fixo ou função (pode ser `async`) chamada **a cada requisição**. Use função quando o token muda durante a sessão.
- `token`: compatibilidade com a v2; vira o cabeçalho `X-Upload-Token`.
- `credentials`: repassado ao `fetch` (`same-origin` por padrão; `include` para backend em outro domínio com CORS).

Os cabeçalhos de `headers` têm prioridade sobre os do editor, então também servem para trocar `Content-Type` ou `X-Upload-Token`.

### Dentro de um formulário

```html
<form method="post" action="/comunicados">
  <input name="titulo">
  <div id="texto"></div>
  <button>Publicar</button>
</form>
<script type="module">
  new OrquestraEditor('#texto', { name: 'conteudo', header: false, autosave: false });
</script>
```

- `name` cria `<input type="hidden" name="conteudo">` logo depois do editor (ou reaproveita um campo com esse nome que já esteja no formulário) e o mantém com o HTML atual, inclusive no instante do envio.
- Botões do editor nunca enviam o formulário; Enter nos campos de busca e nos seletores também não. Os diálogos do editor (link, tabela…) usam formulários próprios que não propagam o envio.
- Comentários não vão no campo oculto: se usar revisão dentro de um formulário, envie `editor.getComments()` em outro campo.

### `onChange` e `onSave`

`onChange` é chamado após 150 ms sem alterações. `onSave` só dispara depois de salvar com sucesso. `initialHTML` tem prioridade sobre o rascunho local. IDs de documento seguem a validação do backend (`A-Z`, `a-z`, `0-9`, ponto, `_`, hífen; até 90 caracteres).

## `ImageStudio`

```js
import { ImageStudio } from './dist/orquestra-editor.js';
const studio = new ImageStudio({maxBytes: 15728640, maxDimension: 4096});
const result = await studio.open(file, {
  width: 1200, height: 630, locked: true, requireAdjustment: true,
  format: 'image/webp', lockFormat: true, quality: 85
});
```

Métodos:

| Método | Retorno | Descrição |
|---|---|---|
| `open(file?, config={})` | `Promise<Result|null>` | Abre editor modal, processa e devolve Blob e metadados |
| `load(file)` | `Promise<void>` | Substitui imagem na sessão aberta |
| `apply()` | `Promise<void>` | Constrói Canvas nas dimensões finais e resolve sessão |
| `close(result)` | `void` | Fecha sessão e libera Object URL |

`ImageStudio` aceita um único modal aberto por instância. Criar instâncias independentes para módulos simultâneos.

## `OrquestraImageUploader`

```js
const uploader = new OrquestraImageUploader({
  element:'#foto', width:400,height:400,locked:true,
  format:'image/webp', profile:'avatar', uploadUrl:'/backend/upload.php',
  headers: { 'X-CSRF-Token': csrf },   // objeto ou função, como no editor
  credentials: 'same-origin',
  name: 'foto_url',                    // campo oculto com a URL enviada (para <form>)
  onUpload({url,localUrl,blob,name,width,height,animated}) { /* sucesso no upload ou modo local */ },
  onError(error) { console.error(error); }
});
await uploader.process(file);  // abre modal e faz upload após confirmação
uploader.getValue();           // URL da última imagem enviada
uploader.destroy();
```

Sem `uploadUrl`, somente a prévia `blob:` é gerada. Ela é local à sessão do navegador e não deve ser armazenada como URL permanente.

## Contrato HTTP do backend de exemplo

### `POST /backend/upload.php`

`multipart/form-data`: `file=Blob` e `profile=nome` opcional; retorna status HTTP 201:

```json
{"ok":true,"url":"/backend/uploads/hash.webp","name":"hash.webp","mime":"image/webp","bytes":34567,"width":1200,"height":630,"profile":"banner-site"}
```

### `POST /backend/save-document.php`

`Content-Type: application/json`:

```json
{"id":"documento-001","html":"<h1>Título</h1><p>Texto formatado</p>","comments":[]}
```

Retorna `{ "ok": true, "id": "documento-001", "updatedAt": "..." }`. Antes de gravar, a versão anterior é copiada para o histórico (até 50 versões).

### `GET /backend/save-document.php?id=documento-001`

Retorna `{ "id": "documento-001", "html": "<...>", "comments": [...], "updatedAt": "..." }`. Não há renderização HTML no endpoint.

### `GET /backend/save-document.php?id=documento-001&versions=1`

Retorna `{ "id": "...", "versions": [{ "version": "20261103T091500Z-a1b2c3", "updatedAt": "...", "bytes": 1234 }] }`, da mais nova para a mais antiga.

### `GET /backend/save-document.php?id=documento-001&version=20261103T091500Z-a1b2c3`

Retorna o documento daquela versão, no mesmo formato da versão atual.

### Autenticação de demonstração

O cabeçalho `X-Upload-Token` é exigido se `ORQUESTRA_UPLOAD_TOKEN` estiver configurado; sem a variável os endpoints são restritos a `127.0.0.1`/`::1`. Em produção, não utilize token secreto embutido no JavaScript distribuído a todos os usuários: implemente autenticação por sessão, autorização por documento, CSRF, quotas e auditoria.
