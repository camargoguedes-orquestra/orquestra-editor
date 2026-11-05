# Orquestra Document Core — componente PHP independente

**Estado: núcleo em implementação, sem API HTTP pronta e sem homologação de produção.**

PHP 8.2+. As classes não necessitam de outros componentes de UI e podem ser incluídas por autoload PSR-4 ou `require` manual.

## Classes
- `PrivateFilesystemStorage`: gravação privada imutável, nomes opacos, diretório segmentado por hash do tenant, SHA-256, leitura e remoção.
- `UploadProfile`: limites de tamanho/extensão/MIME reais definidos pelo servidor. Atenção: arquivos Office ainda precisam de inspeção ZIP avançada/antivírus em integrações finais.
- `DocumentIntake`: recebe stream, verifica autorização, aplica perfil, preserva bytes e invoca persistência transacional fornecida pelo host.
- `PdoDocumentCatalog`: metadados, links polimórficos, versões e soft-delete com filtro obrigatório de tenant.
- `PdoShareGrants` (em `packages/secure-share`): links com token aleatório hash-armazenado, validade, revogação, extensão e autorização por callbacks.

## Instalação
1. Configure storage absoluto **fora** de `public_html`, `htdocs` ou qualquer webroot.
2. Execute o SQL apropriado em `migrations/mysql.sql`, `postgresql.sql` ou `sqlserver.sql` (SQLite apenas para testes).
3. Use o exemplo `examples/php/pdo-intake.php` como referência de integração com identidade e autorização do seu próprio sistema.
4. Implemente uma API HTTP com proteção CSRF, autenticação, limites de requisição, quotas e validação adicional de conteúdo.
5. Teste isolamento tenant, integridade, direitos de acesso, cancelamento, expiração e limpeza.

## Não suportado nesta entrega
Antivírus, S3, reprocessamento OCR, deduplicação transacional, retenção legal, rollback de versão, grants com OTP e API HTTP final. Documentos em produção precisam desses controles conforme política. Nunca disponibilize os caminhos de `objectKey` ao navegador.

## Testar
```sh
php -d assert.exception=1 packages/document-core/tests/integration.php
php packages/document-core/tests/catalog-sqlite.php
```
