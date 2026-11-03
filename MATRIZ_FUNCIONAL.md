# Matriz de recursos — Orquestra Editor 3

Comparação com a versão gratuita e a paga dos editores de referência, conferida na documentação oficial e nos pacotes npm em 03/11/2026 (CKEditor 5 v49, TinyMCE 8.10, Jodit 4.18). Nenhum código desses produtos foi copiado: o Orquestra reimplementa as ideias sobre Tiptap/ProseMirror (MIT).

Legenda: ✅ grátis · 💲 só na versão paga · ◐ parcial · — não tem

| Recurso | CKEditor 5 | TinyMCE 8 | Jodit 4 | **Orquestra 3** |
|---|---|---|---|---|
| Licença da versão gratuita | GPL | GPL | MIT | **MIT** |
| Formatação, fontes, cores, marca-texto | ✅ | ✅ | ✅ | ✅ |
| Entrelinha, recuo, alinhamento | ✅ | ✅ | ✅ | ✅ |
| Direção do texto (LTR/RTL) | ✅ | ✅ | ✅ | ✅ |
| Pincel de formatação | 💲 | 💲 | ✅ | ✅ |
| Maiúsculas/minúsculas | 💲 | — | 💲 | ✅ |
| Listas com estilos e níveis | ✅ | ✅ | ✅ | ✅ |
| Lista de tarefas | ✅ | — | 💲 | ✅ |
| Autoformatação Markdown ao digitar | ✅ | ◐ | — | ✅ |
| Comandos com "/" | 💲 | — | — | ✅ |
| Tabelas: mesclar/dividir, cabeçalhos, redimensionar | ✅ | ✅ (avançadas 💲) | ✅ | ✅ |
| Blocos de código com realce | ✅ | ✅ | 💲 | ✅ |
| Fórmulas (LaTeX) | 💲 | 💲 | 💲 | ✅ |
| Seção recolhível (acordeão) | — | ✅ | — | ✅ |
| Sumário automático | 💲 | 💲 | — | ✅ |
| Âncoras e links internos | ✅ | ✅ | ◐ | ✅ |
| Quebra de página | ✅ | ✅ | 💲 | ✅ |
| Emojis e caracteres especiais | ✅ | ✅ | ◐ (emojis 💲) | ✅ |
| Menções (@) | ✅ | 💲 | 💲 | ✅ |
| Campos de mesclagem ({{campo}}) | 💲 | 💲 | — | ✅ |
| Modelos de documento | 💲 | 💲 | 💲 | ✅ |
| Imagem: upload, legenda, alinhamento | ✅ | ✅ | ✅ | ✅ |
| Imagem: redimensionar arrastando | ✅ | ✅ | ✅ | ✅ |
| Imagem: recortar e ajustar | — | 💲 | ✅ | ✅ |
| **Recorte com dimensão travada e validada no servidor** | — | — | — | ✅ |
| Vídeo incorporado | ✅ | ✅ | ✅ | ◐ (YouTube e Vimeo) |
| Colar do Word/Google Docs | ✅ (avançado 💲) | 💲 | ✅ | ✅ |
| Importar .docx | 💲 | 💲 | — | ✅ |
| Exportar .docx | 💲 | 💲 | 💲 | ✅ |
| Exportar PDF | 💲 | 💲 | 💲 | ◐ (imprimir/salvar PDF do navegador) |
| Markdown (importar/exportar) | ✅ | 💲 | — | ✅ |
| Comentários | 💲 | 💲 | — | ✅ |
| Controle de alterações (sugestões) | 💲 | 💲 | — | ◐ (texto; não rastreia formatação nem quebra de parágrafo) |
| Histórico de versões | 💲 | 💲 | 💲 | ✅ (no backend PHP) |
| Localizar e substituir | ✅ | ✅ | ✅ | ✅ (com expressão regular) |
| Modo HTML, prévia, tela cheia, imprimir | ✅ | ✅ | ✅ | ✅ |
| Mostrar blocos e caracteres invisíveis | ✅ | ✅ | 💲 | ✅ |
| Arrastar blocos | — | — | ◐ | ✅ |
| Contagem de palavras, autosave | ✅ | ✅ | ✅ | ✅ |
| Edição restrita (só campos editáveis) | ✅ | — | — | — |
| Paginação real com cabeçalho/rodapé | 💲 | — | — | — |
| Coedição em tempo real | 💲 | 💲 | — | — |
| Gerenciador de arquivos | 💲 | 💲 | ✅ / 💲 | — |
| Verificador ortográfico próprio | 💲 | 💲 | — | ◐ (o do navegador) |
| Assistente de IA | 💲 | 💲 | ◐ | — |

## O que ainda falta

Os itens marcados com — ou ◐ na última coluna estão no [roadmap](docs/ROADMAP.md). Os mais pedidos para sistemas de condomínio e clínicas: edição restrita em modelos, paginação real com cabeçalho e rodapé, gerenciador de imagens enviadas e coedição em tempo real (a base com Yjs já vem no pacote).

## Segurança

O HTML é filtrado por lista de permissões na entrada e na saída. O backend de exemplo valida tamanho, tipo e perfil das imagens e limpa os comentários, mas **não** sanitiza o HTML do documento: em produção, sanitize também no servidor. Veja [docs/SEGURANCA.md](docs/SEGURANCA.md).
