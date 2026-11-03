# Componentes de terceiros

O Orquestra Editor é MIT e só usa bibliotecas com licenças permissivas, compatíveis com uso
gratuito, comercial e redistribuição. Nenhuma dependência é GPL ou exige licença paga.

| Biblioteca | Uso no editor | Licença |
|---|---|---|
| [Tiptap](https://tiptap.dev) 3.32 (`@tiptap/*`) | Motor de edição, tabelas, listas, menções, sumário, fórmulas, detalhes, arrastar blocos | MIT |
| [ProseMirror](https://prosemirror.net) | Modelo de documento por baixo do Tiptap | MIT |
| [lowlight](https://github.com/wooorm/lowlight) / highlight.js | Realce de sintaxe em blocos de código | MIT / BSD-3-Clause |
| [KaTeX](https://katex.org) 0.18 | Desenho de fórmulas LaTeX | MIT |
| [marked](https://marked.js.org) | Importação e exportação Markdown (via `@tiptap/markdown`) | MIT |
| [mammoth](https://github.com/mwilliamson/mammoth.js) 1.13 | Importação de arquivos .docx | BSD-2-Clause |
| [docx](https://docx.js.org) 9.15 | Exportação para .docx com comentários e controle de alterações | MIT |
| [JSZip](https://stuk.github.io/jszip/) | Dependência de mammoth/docx (escolhida a opção MIT) | MIT ou GPL-3.0 |
| [pako](https://github.com/nodeca/pako) | Compressão usada pelo JSZip | MIT e Zlib |
| [Lucide](https://lucide.dev) | Ícones da barra de ferramentas | ISC |
| [Floating UI](https://floating-ui.com) | Posição dos menus flutuantes | MIT |
| [Yjs](https://yjs.dev) | Dependência da alça de arrastar blocos (base para coedição futura) | MIT |

Os avisos de copyright exigidos pelas licenças são gerados automaticamente pelo build em
`dist/orquestra-editor.js.LEGAL.txt` e `dist/chunks/*.LEGAL.txt`.

Para conferir: `npm ls --all --omit=dev` lista a árvore completa; nenhuma licença fora de
MIT, ISC, BSD, Zlib ou dupla com opção MIT foi encontrada em 03/11/2026.
