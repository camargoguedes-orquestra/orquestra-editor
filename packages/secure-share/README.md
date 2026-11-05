# SecureShare — componente independente (desenvolvimento)

O `TemporaryDownloadBroker` é uma base PHP para download por **cópia privada e temporária**. **Não é um endpoint HTTP pronto para produção.** Ele opera sem OrquestraEditor, ImageUploader ou FileUploader.

## Contratos

- `lookup($grantId)`: deve buscar uma concessão ATUAL no banco, com `expires_at`, `sha256` e `original_name`.
- `allowed($grant, $actorId)`: deve verificar autenticação, destinatário, tenant, vínculo, versão, revogação e direito de baixar. Executada ao preparar e ao baixar.
- `source($grant)`: deve entregar recurso PHP de leitura (stream) de local privado ou S3. O cliente jamais recebe a chave/caminho.

## Exemplo de configuração PHP

```php
<?php
require 'packages/secure-share/src/TemporaryDownloadBroker.php';
use Orquestra\SecureShare\TemporaryDownloadBroker;

$broker = new TemporaryDownloadBroker(
    '/var/private/orquestra/stage',  // FORA do diretório público
    fn(string $id) => $grantRepository->findCurrent($id),
    fn(array $grant, string $actor) => $acl->canDownload($actor, $grant),
    fn(array $grant) => $storage->openReadStream($grant['storage_key'])
);
$ticket = $broker->prepare($grantId, $authenticatedActorId);
// Retorna somente ticket aleatório e expiresAt; nunca storage_key/caminho.
```

`$grantRepository`, `$acl` e `$storage` são interfaces do sistema hospedeiro; precisam ser implementadas e documentadas em cada integração.

## Requisitos do endpoint HTTP do hospedeiro

1. Autenticar e autorizar o ator, vincular o ticket à sua sessão/identidade; exigir OTP conforme o perfil.
2. Verificar a concessão, expiração e integridade **antes** de enviar cabeçalhos e bytes da resposta.
3. Enviar `Content-Disposition: attachment` com nome original saneado; `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
4. Usar HTTPS, limite de tentativas, quotas por usuário/tenant, proteção contra exposição de tickets em logs e auditoria de cada acesso.
5. Agendar `$broker->prune()` e limpeza de órfãos por cron. Não expor diretório staging por URL, alias ou cache público.
6. Não aceitar identificadores de storage enviados pelo navegador; o servidor resolve a fonte apenas com base na concessão persistida.

**Duas validades independentes:** a concessão de compartilhamento terá padrão de 7 dias, extensível pelo usuário dentro do teto administrativo; a cópia temporária dura no máximo 15 minutos por padrão e não ultrapassa a validade da concessão.

## Teste local

```bash
php -d zend.assertions=1 -d assert.exception=1 packages/secure-share/tests/smoke.php
```

## Limitações antes da homologação

Este commit ainda não oferece API HTTP completa, banco de concessões, OTP, armazenamento S3, integração com permissões reais, quotas globais, proteção integral a concorrência, headers de download, política LGPD e teste E2E. Não usar em produção sem completar e validar esses requisitos.

Regras aprovadas: `docs/DECISOES_E_REQUISITOS.md`.