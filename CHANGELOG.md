# Histórico de alterações

## 3.0.0 — 2026-11-03

Versão livre (licença MIT), com motor novo e recursos que outros editores reservam para a versão paga.

- Motor de edição trocado de `contenteditable` + `execCommand` para Tiptap/ProseMirror, com desfazer transacional; API pública da v2 mantida.
- Revisão: comentários com respostas e resolução, controle de alterações (aceitar/rejeitar), histórico de versões no backend.
- Arquivos: importar DOCX, Markdown, HTML e TXT; exportar DOCX (com comentários e alterações nativos do Word), Markdown, HTML e TXT; colagem limpa do Word e Google Docs.
- Escrita: comandos com "/", menções "@", emojis ":" (catálogo Unicode completo), campos de mesclagem "{{ }}", autoformatação Markdown, pincel de formatação, maiúsculas/minúsculas, direção do texto.
- Estrutura: tabelas completas (mesclar/dividir em qualquer direção, cabeçalho de linha e coluna, redimensionar colunas, cor de célula), código com realce de sintaxe, fórmulas KaTeX, seção recolhível, sumário com links, arrastar blocos.
- Imagens: alça de redimensionamento, legenda, alinhamento e texto ao redor, reedição no Estúdio com duplo clique; Estúdio com espelho vertical e enquadramento pelo teclado.
- Interface: ícones Lucide, menus flutuantes por contexto, painel lateral (sumário, comentários, alterações), barra de busca com regex, navegação por teclado na barra.
- Correção: cor, fonte e tamanho do texto eram perdidos ao salvar (a tag `<font>` gerada pelo `execCommand` era removida pelo filtro). HTML antigo com `<font>` agora é convertido.
- Correção: o Estúdio travava ao fechar com `locked: true` e `allowUpscale: false` (`ReferenceError` em `close()`).
- Build com esbuild (`dist/`), partes pesadas carregadas sob demanda; testes de ponta a ponta contra o PHP real.

## 2.0.0 — 2026-11-02

- Uploader configurável com `locked`, `width`, `height`, `format`, `lockFormat`, `requireAdjustment`, `allowUpscale`, `allowGIF` e `profile`.
- Preview de recorte dentro do modal sincronizado com zoom, deslocamento, rotação e filtros.
- Validação do tamanho e MIME efetivos no backend PHP por perfil.
- Toolbar ampliada: entrelinha, estilos de listas, marca-texto, inline code, blocos de código, checklists, modelos, âncoras, propriedades e mescla/divisão simples de tabelas.
- API de HTML com `getDocumentHTML`, `load()` e impedimento de salvar imagem `blob:` sem persistência.
- Preservação ampliada de formatação HTML/CSS permitida.
- Testes automatizados de roundtrip HTML e perfil fixo.
- Documentação de APIs, segurança, implantação, testes e roadmap.

## 1.0.0 — 2026-11-02

- Editor HTML inicial com menus, formatação, tabelas, emojis, GIFs, imagens e backend PHP.
- Estúdio de imagem independente com zoom, deslocamento, corte, formatos e filtros.
