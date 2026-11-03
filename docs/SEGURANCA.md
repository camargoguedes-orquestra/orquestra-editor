# Segurança — checklist para produção

O backend incluso é **demonstração**. Não publique como serviço de produção sem as medidas abaixo.

## Autenticação, autorização e acesso

1. Autentique quem faz upload e quem acessa documentos, idealmente com sessão segura, e valide permissão de leitura/escrita **por documento** e por tenant.
2. Proteja operações mutáveis contra CSRF. O cabeçalho demonstrativo `X-Upload-Token` não é uma solução completa para usuários finais, especialmente se embutido no JavaScript público.
3. Configure `ORQUESTRA_DATA_DIR` fora do webroot; segregue diretórios por tenant em storage privado. O exemplo de arquivos JSON não contém RBAC nem auditoria.
4. Configure quotas por usuário, limites por tenant, rate limiting, registro de auditoria e retenção/exclusão de mídia conforme política LGPD.

## HTML e XSS

- O `sanitizeHTML` do editor aplica uma allowlist **no navegador**, mas não é sanitizador confiável do lado do servidor.
- Antes de exibir conteúdo vindo do banco em uma página de produção, use uma biblioteca comprovada de sanitização HTML no **backend** (por exemplo, HTML Purifier no PHP) e defina tags/estilos permitidos explicitamente.
- Use uma `Content-Security-Policy` restritiva; evite `unsafe-inline` para scripts. A prévia da demonstração utiliza `iframe sandbox`.
- Não permita HTML inserido de usuários em `innerHTML` arbitrário fora de um pipeline seguro.
- Armazene como dados: o endpoint de JSON de exemplo não executa HTML, mas isso **não protege** um cliente que renderize esse conteúdo sem filtro.

## Upload

O endpoint confere:

- MIME real com `finfo`, dimensões com `getimagesize`, tamanho máximo e teto de pixels.
- Extensão determinada pelo MIME, nunca pelo nome do usuário.
- Nome randômico com `random_bytes`.
- Perfil de dimensão e formato com `ORQUESTRA_IMAGE_PROFILES_JSON`.

Produção deve acrescentar: reprocessamento seguro da imagem no servidor (especialmente para remover metadados), política antimalware onde exigida, storage fora de código executável, assinatura/URL temporária para conteúdo privado e validação de permissões para cada mídia. Para GIFs, considere limite de quadros e tempo de processamento. Não aceite SVG sem pipeline de sanitização dedicado.

## Servidor e storage

- Mantenha PHP/Apache atualizados; bloqueie execução de scripts no diretório de upload (`backend/uploads/.htaccess` é apenas defesa adicional para Apache).
- Se a hospedagem não respeitar `.htaccess`, imponha as restrições na configuração do servidor e/ou em storage externo.
- Exija HTTPS e cabeçalhos `nosniff`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy` apropriados.
- Salve logs estruturados de erros sem gravar tokens, senhas ou HTML sensível.
- Teste backups, restauração e versões de documento.

## Privacidade e repositório

Não envie `.env`, credenciais, tokens de upload, dados reais de usuários, PDFs sensíveis nem uploads privados ao GitHub. O `.gitignore` impede commits acidentais de uploads e segredos comuns; use secret scanning antes da primeira publicação pública.

## Limitações conhecidas

A allowlist no navegador é deliberadamente conservadora, mas pode não cobrir todas as vetores de CSS malicioso em browsers diferentes. O sistema não declara certificação de segurança nem adequação LGPD automática. Integre ao modelo de identidade e políticas da aplicação hospedeira.