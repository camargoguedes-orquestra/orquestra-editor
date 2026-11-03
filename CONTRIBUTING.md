# Contribuição

O repositório está inicialmente privado e sem licença aberta. Contribuições externas dependem de autorização do titular.

Ao propor alterações internamente:

1. Abra issue descrevendo contexto, reprodução e comportamento esperado.
2. Crie branch a partir de `main` com nome `feat/...` ou `fix/...`.
3. Inclua testes de HTML roundtrip, Canvas e validações PHP quando alterá-los.
4. Execute `npm run lint:syntax`, `php -l` nos arquivos PHP e `python tests/smoke.py` com o servidor local.
5. Abra pull request com prints e observações de segurança.

Não envie dados reais ou segredos em exemplos/tests.
