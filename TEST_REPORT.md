# Relatório de testes — Orquestra Editor 3.0

Data: 2026-11-03. Chrome (Playwright) contra `php -S 127.0.0.1:8765` servindo a demonstração com o pacote `dist/`.

Resultado: **todos os cenários passaram** (`ALL TESTS PASSED`), incluindo os de integração da 3.1 (CSS restrito, `header:false`, cabeçalho CSRF em salvar e upload, editor e uploader dentro de `<form>`).

Cobertura:

- Backend PHP real: upload PNG/GIF, perfis fixos (rejeita e aceita), salvar/recuperar, histórico de versões, comentários persistidos.
- Editor: negrito pela barra, emoji, tabela, sanitização contra script/eventos/`javascript:`, salvar, roundtrip de HTML com estilos, checklist com estado, bloqueio de imagens `blob:`.
- Estúdio: recorte 400×400 WEBP com upload, perfil fixo 1200×630 travado, GIF recusado no perfil fixo e preservado no modo livre, fechamento sem travar com `allowUpscale:false`.
- Versão 3: cor/fonte/tamanho persistidos e `<font>` legado convertido, migração de checklist da v2, comentários (criar, responder, resolver, salvar), controle de alterações (digitar, apagar, aceitar, rejeitar), localizar/substituir com maiúsculas e regex, campos de mesclagem, comando `/tabela`, mesclagem de células, Markdown de ida e volta, DOCX exportado e reimportado, fórmula KaTeX e sumário com links.
- Interface móvel (390 px).

Restrições: testado só no Chromium; sem auditoria de segurança completa; o controle de alterações não rastreia formatação nem quebras de parágrafo.
