# Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│ Aplicação hospedeira (PHP, Laravel, Vue, HTML, qualquer UI)  │
└────────────┬──────────────────────────────┬──────────────────┘
             │                              │
       OrquestraEditor                OrquestraImageUploader
          editor.js                       image-studio.js
             │                              │
             └──────────────┬───────────────┘
                            │
                       ImageStudio
                     Canvas 2D + File
                            │
                       POST multipart
                            ▼
                       backend/upload.php
                            │
                     Arquivo persistente

  getHTML() ── POST JSON ── save-document.php ── storage privado
  setHTML() ◀─ GET JSON ─── save-document.php ◀── storage privado
```

## Editor de texto

O núcleo de edição existente usa o DOM (`contenteditable`), seleções do navegador e `document.execCommand`. A API de edição com `execCommand` está obsoleta; seu comportamento varia entre navegadores e sua evolução deve ser considerada limitada. Esta solução é adequada como protótipo integrável e editor de conteúdo geral. **Não é equivalente à arquitetura de documentos do CKEditor 5**.

O módulo `sanitizeHTML` recria uma árvore DOM com allowlist de elementos, atributos, CSS e URLs. O armazenamento em HTML permite reabertura, mas somente os elementos compreendidos pelo sanitizador permanecem. O backend demonstrativo salva JSON em pasta privada em vez de MySQL para não exigir banco na demonstração.

## Editor de imagens

1. Dev passa dimensão/configuração no construtor.
2. Administrador abre imagem via arquivo ou drag-and-drop.
3. A imagem original é mostrada sobre o quadro; a região descartada é escurecida.
4. A geometria usa `cover`: o quadro fica integralmente preenchido e a imagem pode ser deslocada e ampliada.
5. Um Canvas de prévia usa **a mesma transformação** da exportação final, evitando divergências entre editor e resultado.
6. Ao aplicar, Canvas final é construído exatamente com a largura/altura configuradas; retorna Blob.
7. Se o uploader tem `uploadUrl`, envia Blob; o backend valida dimensões reais/MIME por perfil.

Somente imagens estáticas são rasterizadas no recorte. GIF animado é preservado sem transformação no modo livre.

## Separação de responsabilidades

| Camada | Responsabilidade |
|---|---|
| `src/editor.js` | Edição de texto, UI, sanitização HTML de conveniência e chamadas de documentos |
| `src/image-studio.js` | Estúdio e uploader standalone |
| `src/styles.css` | Design system de ambos os componentes |
| `backend/common.php` | Cabeçalhos JSON e proteção demonstrativa |
| `backend/upload.php` | Validação de bytes, MIME, perfil e persistência local |
| `backend/save-document.php` | JSON de documento em pasta privada (exemplo) |
| `tests/smoke.py` | Teste de navegador/Canvas e chamadas HTTP reais ao PHP |

## Evolução de motor recomendada

Para colaboração, seleção robusta, operações de tabela complexas e histórico multiusuário, recomenda-se migrar o núcleo para **ProseMirror/Tiptap**. O desenho de UI, ImageStudio, endpoint de mídia, APIs de HTML e contratos de eventos devem ser preservados tanto quanto possível. Migração de motor não deve ser confundida com mudança do modelo de armazenamento: HTML continua sendo interface de persistência se houver schema e conversão explicitamente definidos.
