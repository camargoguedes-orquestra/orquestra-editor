# Roadmap de evolução

## 2.0 — disponível na base atual

- Enquadramento com dimensões obrigatórias por configuração e validação no backend.
- Prévia final do corte sincronizada com a exportação.
- HTML como retorno do editor e carregamento via `setHTML`/`load`.
- Toolbar ampliada com componentes e menus adicionais.
- Componentes independentes e documentação de integração.

## 2.1 — estabilidade e ergonomia

- Testes unitários de geometria de Canvas e mais navegadores.
- Atalhos/acessibilidade e suporte avançado a toque em dispositivos móveis.
- Extensão para criar botões/plugins customizados sem editar o core.
- Biblioteca de imagens e histórico de uploads.
- Editor contextual de imagens (legenda, link e alinhamento direto no documento).
- Adaptadores de upload intercambiáveis e seleção de perfis de imagem por campo no editor.
- Melhorias de acessibilidade e internacionalização.

## 3.0 — novo motor de edição

- Migrar de `execCommand` para ProseMirror/Tiptap (schema, nodes, marks, transações).
- Edição estruturada, operações de tabelas robustas, atalhos avançados e undo/redo transacional.
- Testes de ida e volta HTML com schema documentado e migração de documentos legados.
- Sistema extensível de plugins e schema customizável.

## 3.1 — documentos empresariais

- Cabeçalho/rodapé, paginação e múltiplas folhas reais.
- Modelos com variáveis, tabelas dinâmicas, campos bloqueados e histórico de revisão.
- Importação/exportação de DOCX com fidelidade mensurável.
- PDF no servidor com templates de impressão versionados.

## 4.0 — colaboração

- Comentários, sugestões e controle de alterações.
- Edição simultânea com CRDT ou OT, presença de usuários e resolução de conflitos.
- Auditoria e versionamento por usuário/tenant.

> Roadmap não implica que os itens já estejam disponíveis. A ordem está sujeita a testes, licença e requisitos dos sistemas consumidores.
