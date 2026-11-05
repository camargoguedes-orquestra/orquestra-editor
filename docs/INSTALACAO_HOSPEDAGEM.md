# Guia de instalação e operação — PHP, Locaweb e VPS

## Requisitos gerais
- PHP 8.2+ para `document-core`, `secure-share` e plugins PHP.
- Extensões `fileinfo`, `openssl`, `json`, `pdo` e driver conforme banco.
- Banco suportado por schema: MySQL/Percona/MariaDB, PostgreSQL ou SQL Server. SQLite apenas como ambiente de teste.
- Diretório privado fora de `public_html`, com permissões restritas e sem aliases HTTP.
- HTTPS válido, cron para limpeza de tickets e política de backup.
- Bibliotecas JS podem ser servidas como arquivos estáticos, sem Node no servidor de produção.

## Hospedagem compartilhada
Frontend estático funciona em Locaweb Linux. Em produção o usuário da hospedagem pode não ter acesso a `tesseract`, `pdftotext`, `proc_open`, antivírus ou serviços de filas; os plugins dependentes devem falhar explicitamente ou operar em servidor auxiliar com interface autenticada. Não desabilite falha fechada de segurança para contornar limitações.

## MySQL
```bash
# Importe o SQL do catálogo em um banco criado por seu administrador.
mysql -u USUARIO -p BANCO < packages/document-core/migrations/mysql.sql
```
Em PHP, use DSN `mysql:host=SERVIDOR;dbname=BANCO;charset=utf8mb4`; credenciais exclusivamente em variáveis de ambiente ou configuração privada.

## PostgreSQL
```bash
psql -v ON_ERROR_STOP=1 -d BANCO -f packages/document-core/migrations/postgresql.sql
```

## SQL Server
Executar `packages/document-core/migrations/sqlserver.sql` em uma sessão SQL Server adequada. O driver PHP PDO_SQLSRV precisa ser instalado e configurado; comportamento de transações e limites deverá passar por testes em ambiente real.

## Primeira integração
1. Instale apenas os diretórios de componentes necessários.
2. Teste `node --test packages/file-viewer/tests/format.test.mjs` (desenvolvimento).
3. Configure o diretório privado e crie tabelas com uma migração versionada.
4. Execute `examples/php/pdo-intake.php` para uma ingestão CLI de exemplo.
5. Implemente autenticação, controle de tenant e autorização no servidor hospedeiro.
6. Implemente as rotas de `docs/API_CONTRACT_V1.md`.
7. Valide acesso negado, IDOR, travessia, expiração, revogação, hash adulterado e recuperação.
8. Instale cron para limpeza, monitoramento e backup.

## Deploy e rollback
A primeira versão estável NÃO está homologada. Antes de rollout, faça snapshot verificável, migre em ambiente de homologação, compare checksums, execute suíte de regressão e mantenha rollback dos dados e arquivos. As migrações desta fase são exemplos iniciais e não incluem scripts automáticos de rollback.
