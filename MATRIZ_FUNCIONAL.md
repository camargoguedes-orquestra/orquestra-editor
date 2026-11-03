# Matriz de cobertura — Orquestra Editor 2.0

A matriz representa funcionalidades **realmente implementadas**, **parciais/limitadas** e **não implementadas**. As referências são os recursos documentados de [TinyMCE 8](https://www.tiny.cloud/docs/tinymce/latest/plugins/), [CKEditor 5](https://ckeditor.com/docs/ckeditor5/latest/features/index.html) e [Jodit](https://xdsoft.net/jodit/docs/). Não há equivalência formal nem código copiado desses produtos.

| Área | Estado | Observações |
|---|---|---|
| Formatação básica e tipografia | Implementado | Fonte, tamanho, cores, destaque, headings, estilos básicos, subscrito/sobrescrito |
| Alinhamento e parágrafos | Implementado | Alinhamento, recuo, entrelinha de parágrafo selecionado |
| Listas e checklists | Parcial | Listas normais e estilo de marcadores; checklist com checked persistido; sem listas multinível robustas |
| Links e âncoras | Implementado básico | Criação de link HTTPS, âncoras com ID; edição avançada de links ainda limitada |
| Tabelas | Parcial | Inserir linhas/colunas, excluir, propriedades, mescla/split horizontal simples; não suporta todas as fusões com rowspan |
| Imagens | Implementado básico | Upload, URL, diálogo de dimensões/alinhamento, reabertura para tratamento |
| Estúdio de imagens | Implementado | Recorte com máscara, zoom, arraste, giro, espelho, brilho/contraste/saturação, preview, formatos estáticos |
| Upload com perfil fixo | Implementado | Largura/altura fixas, interação obrigatória configurável, validação no backend por perfil |
| GIF animado | Parcial | Original preservado no modo livre; GIF recusado quando exige recorte fixo |
| Emojis e símbolos | Implementado básico | Catálogo embutido pesquisável, não Unicode integral |
| Vídeos incorporados | Implementado básico | YouTube/Vimeo com embed HTTPS validado |
| Blocos de código e destaque | Implementado básico | Pre/code e mark; sem realce por linguagem |
| Modelos | Implementado básico | Ofício, ata, contrato e comunicado, editáveis após inserção |
| Buscar e substituir | Implementado básico | Substitui ocorrências em nós de texto; sem regex/realce incremental |
| HTML | Implementado no subconjunto | `getHTML`, `setHTML`, modo HTML, `getDocumentHTML`, roundtrip testado |
| Save/load/autosave | Implementado básico | API JS e backend JSON; sem controle de concorrência/versionamento |
| PDF | Parcial | Browser print/save PDF; sem renderizador PDF no backend |
| Word DOCX | Não implementado | Import/export robusto exige conversão especializada |
| Edição colaborativa | Não implementado | Sem CRDT/OT, comentários colaborativos, revisão/track changes |
| A4 e paginação | Parcial | Layout visual A4 e CSS de impressão, sem quebra automática de páginas reais |
| Extensões via plugins | Parcial | Classes reutilizáveis; sem registry formal de plugins |
| Motor ProseMirror | Não implementado | Atualmente contenteditable + execCommand, migração recomendada |
| Segurança de produção | Não completa | Sanitização no browser + validação básica PHP; requer autenticação e sanitização no servidor |

Consulte [docs/ROADMAP.md](docs/ROADMAP.md) para prioridades técnicas e [docs/SEGURANCA.md](docs/SEGURANCA.md) antes de implantação pública.
