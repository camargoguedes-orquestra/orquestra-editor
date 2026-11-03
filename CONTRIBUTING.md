# Como contribuir

O Orquestra Editor é software livre (licença MIT) e aceita contribuições da comunidade.

1. Abra uma issue descrevendo o problema ou a ideia, com passos para reproduzir quando for um defeito.
2. Crie um branch a partir de `main` (`feat/...` ou `fix/...`).
3. Rode `npm ci` e `npm run build`. O código-fonte fica em `src/`; `dist/` é gerado pelo build e também vai no commit, para quem usa o editor sem Node.
4. Inclua ou ajuste testes em `tests/smoke.py` (HTML de ida e volta, Canvas, validações PHP).
5. Antes do pull request: `npm run lint:syntax`, `php -l backend/*.php` e `python tests/smoke.py` com `php -S 127.0.0.1:8765 -t .` rodando.
6. No pull request, descreva o que mudou, anexe capturas de tela quando houver interface e aponte impactos de segurança.

Regras:

- Somente dependências com licença permissiva (MIT, ISC, BSD, Apache-2.0, Zlib). Nada GPL nem pago.
- Não copie código de editores com licença GPL ou comercial (CKEditor 5, TinyMCE, Froala). Reimplemente a ideia.
- Textos da interface em português do Brasil; rótulos podem ser trocados pela opção `labels`.
- Não envie dados reais ou segredos em exemplos e testes.
