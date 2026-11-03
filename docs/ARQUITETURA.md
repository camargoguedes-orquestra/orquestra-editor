# Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│ Aplicação hospedeira (PHP, Laravel, Vue, HTML, qualquer UI)  │
└────────────┬──────────────────────────────┬──────────────────┘
             │                              │
       OrquestraEditor                OrquestraImageUploader
        src/editor.js                  src/image-studio.js
             │                              │
   Tiptap / ProseMirror                     │
   + extensões Orquestra                    │
             └──────────────┬───────────────┘
                            │
                       ImageStudio
                     Canvas 2D + File
                            │
                       POST multipart
                            ▼
                     backend/upload.php ── valida perfil, MIME e pixels

  getHTML() + comments ── POST JSON ──▶ save-document.php ──▶ storage privado
  setHTML()            ◀── GET JSON ─── save-document.php      └─ versions/<id>/
```

## Pastas

| Caminho | Responsabilidade |
|---|---|
| `src/editor.js` | Classe `OrquestraEditor`: interface (menus, barra, painéis, diálogos) e ligação com o Tiptap |
| `src/extensions/document-nodes.js` | Nós e atributos próprios: estilo de bloco, imagem do estúdio, vídeo, quebra de página, âncora, campo de mesclagem |
| `src/extensions/review.js` | Comentários, controle de alterações e localizar/substituir |
| `src/extensions/suggestions.js` | Janelas de sugestão para `/`, `@`, `:` e `{{` |
| `src/io/docx.js` | Importação (mammoth) e exportação (docx) de Word, carregada sob demanda |
| `src/core/sanitize.js` | Lista de permissões de HTML, migração de HTML da v2, limpeza de colagem do Office |
| `src/image-studio.js` | Estúdio de imagens e uploader independente |
| `src/ui/` | Ícones Lucide e catálogos (emojis, símbolos, modelos, fontes) |
| `scripts/build.mjs` | Build com esbuild: `dist/orquestra-editor.js` + pedaços sob demanda + CSS com KaTeX |
| `backend/` | PHP de demonstração: upload com perfis, documentos com comentários e versões |

## Motor de edição

O documento é um modelo estruturado (schema ProseMirror), não o DOM. Cada edição é uma transação: desfazer e refazer funcionam para tudo, inclusive tabelas e atributos. O HTML é a forma de persistência: `getHTML()` serializa o modelo e passa pela lista de permissões; `setHTML()` faz o caminho inverso e descarta o que o schema não conhece.

Atributos que o Tiptap não guarda por padrão (entrelinha, recuo, bordas e fundo de tabelas, cor de bloco) ficam no atributo global `blockStyle`, filtrado pelo mesmo `sanitizeStyle`. Assim, HTML gerado pela versão 2 reabre com a mesma aparência.

## Revisão

- **Comentários:** a marca `comment` guarda só o id no HTML (`span[data-comment-id]`). Texto, autor, respostas e estado ficam em `editor.getComments()` e são salvos junto com o documento.
- **Controle de alterações:** quando ligado, um plugin intercepta digitação, colagem e exclusão. Texto novo recebe a marca `insertion` (`<ins>`), texto apagado recebe `deletion` (`<del>`), com autor e data. Aceitar remove a marca ou o texto; rejeitar faz o inverso. Na exportação DOCX viram alterações nativas do Word.
- **Versões:** cada `save()` faz o backend copiar a versão anterior para `versions/<id>/` (até 50).

## Pacote

O build gera um ES module. Partes pesadas e pouco usadas (DOCX e o catálogo completo de emojis) ficam em arquivos separados em `dist/chunks/` e só são baixadas no primeiro uso.

## Editor de imagens

1. O desenvolvedor passa dimensões e regras no construtor.
2. O usuário abre a imagem por arquivo, arraste ou colagem.
3. A imagem aparece sobre a moldura; a parte que será descartada fica escurecida.
4. A geometria usa `cover`: a moldura fica sempre preenchida; a imagem pode ser deslocada, ampliada, girada e espelhada (mouse ou teclado).
5. Um Canvas de prévia usa a mesma transformação da exportação final.
6. Ao aplicar, o Canvas final é gerado exatamente na largura e altura configuradas.
7. Com `uploadUrl`, o Blob é enviado e o backend confere dimensões reais e MIME pelo perfil.

GIF animado é preservado sem recorte no modo livre e recusado quando há perfil fixo.
