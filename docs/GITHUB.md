# Publicar em repositório GitHub privado

O pacote já vem organizado como uma estrutura Git pronta para versionamento. **Ainda não constitui, por si só, um repositório remoto criado.**

## Criar repositório privado

1. Entre na conta GitHub `camargoguedes-orquestra`.
2. Abra https://github.com/new.
3. Nome sugerido: `orquestra-editor`; descrição: `Editor WYSIWYG e estúdio de imagens reutilizável com HTML e recorte configurável`.
4. Selecione **Private**; não inicialize com README ou licença, pois os arquivos já estão neste pacote.
5. Na pasta extraída execute:

```bash
git init
git branch -M main
git add .
git commit -m "feat: Orquestra Editor 2.0 — HTML e crop configurável"
git remote add origin https://github.com/camargoguedes-orquestra/orquestra-editor.git
git push -u origin main
```

Se sua conta usar instalação do GitHub App limitada a repositórios selecionados, habilite o novo repositório nas permissões do aplicativo antes de pedir alterações pela integração.

## Revisão antes de tornar público

- Decidir licença (atualmente **todos os direitos reservados**).
- Remover segredos, uploads, informações privadas e código que possa depender de serviços comerciais.
- Publicar releases versionadas, changelog e critérios claros de suporte.
- Revisar CI e executar testes em ambiente de produção isolado.
- Realizar auditoria de HTML/XSS, upload e autenticação.

## Proteções recomendadas

Ative branch protection em `main`, revisão obrigatória via pull request quando houver colaboradores, secret scanning, dependabot e execução do workflow CI. Para público, configure Issues, templates e Security Policy conforme política do projeto.
