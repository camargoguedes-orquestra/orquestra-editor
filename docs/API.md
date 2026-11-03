# Referência da API JavaScript

## Dependências

- Navegador com módulos ES e Canvas 2D; sem NPM obrigatório.
- CSS `src/styles.css` deve ser carregado no HTML.
- Para persistência remota, implemente endpoints HTTP (os de `backend/` são demonstrativos).

## `OrquestraEditor`

```js
import { OrquestraEditor } from './src/editor.js';
const e = new OrquestraEditor('#editor', {
  id: 'documento-001',
  height: 700,
  pageMode: true,
  autosave: true,
  initialHTML: '<p>Texto</p>',
  saveUrl: '/backend/save-document.php',
  uploadUrl: '/backend/upload.php',
  token: '',
  image: {width:1200,height:800,locked:false,format:'image/webp'},
  onChange(html, instance) { /* notificação de alterações */ },
  onSave(html, instance) { /* acionado quando save() é concluído */ }
});
```

| Método / propriedade | Retorno | Finalidade |
|---|---|---|
| `getHTML()` | `string` | Fragmento HTML com tags e propriedades CSS permitidas pelo sanitizador |
| `getDocumentHTML()` | `string` | Documento HTML completo para download/exportação |
| `setHTML(html, trigger=true)` | `void` | Reaplica o HTML (passa pelo sanitizador do navegador) |
| `getText()` | `string` | Extrai o texto sem tags |
| `focus()` | `void` | Foca a área de edição |
| `save()` | `Promise<boolean>` | POST JSON no `saveUrl`, ou localStorage se não houver endpoint |
| `load()` | `Promise<boolean>` | GET `saveUrl?id=<id>` e reabre o HTML recuperado |
| `hasTemporaryImages()` | `boolean` | Detecta imagens `src="blob:..."` que não podem ser persistidas |
| `destroy()` | `void` | Libera recursos e desmonta o componente |
| `sanitizeHTML(html)` | `string` | Função exportada para filtrar HTML permitido no navegador |

### `onChange` e `onSave`

`onChange` é chamado após a janela de debounce (150 ms). `onSave` só dispara após o salvamento ter sucesso. Para bancos próprios, chame `getHTML()` e envie a string ao backend. O HTML retornado não contém CSS externo do próprio editor; aplique um stylesheet de leitura conforme necessário.

### Salvar e reabrir

```js
const html = e.getHTML();
await e.save();       // salva no backend demonstrativo
await e.load();       // recupera HTML armazenado no backend
// ou carregamento por API própria:
e.setHTML(htmlDoBanco);
```

`initialHTML` tem prioridade sobre o rascunho local (`localStorage`). Se ambos estiverem ausentes, é aplicado um documento de demonstração. IDs devem corresponder à validação do backend demonstrativo (`A-Z`, `a-z`, `0-9`, ponto, `_`, hífen; máximo 90 caracteres).

## `ImageStudio`

```js
import { ImageStudio } from './src/image-studio.js';
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
  onUpload({url,localUrl,blob,name,width,height,animated}) { /* sucesso no upload ou modo local */ },
  onError(error) { console.error(error); }
});
await uploader.process(file);  // abre modal e faz upload após confirmação
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
{"id":"documento-001","html":"<h1>Título</h1><p>Texto formatado</p>"}
```

Retorna `{ "ok": true, "id": "documento-001", "updatedAt": "..." }`.

### `GET /backend/save-document.php?id=documento-001`

Retorna `{ "id": "documento-001", "html": "<...>", "updatedAt": "..." }`. Não há renderização HTML no endpoint.

### Autenticação de demonstração

O cabeçalho `X-Upload-Token` é exigido se `ORQUESTRA_UPLOAD_TOKEN` estiver configurado; sem a variável os endpoints são restritos a `127.0.0.1`/`::1`. Em produção, não utilize token secreto embutido no JavaScript distribuído a todos os usuários: implemente autenticação por sessão, autorização por documento, CSRF, quotas e auditoria.
