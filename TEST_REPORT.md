# Relatório de testes — Orquestra Editor 2.0

Data: 2026-11-02 (execução no ambiente de desenvolvimento).

Resultado: **todos os cenários automatizados executados passaram** no Chromium disponível e no PHP local.

Cobertura: formatação, emojis, tabela, sanitização HTML no navegador, upload PNG/GIF, geração WEBP 400×400, perfil fixo WEBP 1200×630, bloqueio de tamanho/formato, interação obrigatória, recusa de GIF em perfil fixo, preservação de GIF sem recorte, HTML roundtrip e reabertura via API simulada, persistência PHP real e validação de perfil no servidor, prevenção de `blob:` persistido, interface móvel.

### Restrições

- O navegador foi testado com injeção dos módulos em `about:blank`; endpoints PHP foram testados com HTTP no loopback.
- O fluxo de reabertura na UI usa mock do HTTP, além do teste separado de persistência HTTP real do PHP.
- Não houve auditoria completa de segurança, teste de compatibilidade multi-browser, validação real em Locaweb ou CI remoto no GitHub.
- `contenteditable` e `execCommand` continuam no motor; para edição empresarial estruturada, recomenda-se migrar para ProseMirror/Tiptap após testes de schema.