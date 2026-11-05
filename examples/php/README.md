# Exemplo PHP: ingestão com PDO

A demonstração é executada **somente via CLI**, com os caminhos e credenciais definidos no ambiente. Não contém bypass HTTP de autorização e não publica as chaves de armazenamento.

1. Criar um banco vazio e executar `packages/document-core/migrations/mysql.sql` (ou PostgreSQL/SQL Server).
2. Criar diretório privado absoluto fora de `public_html`.
3. Definir `ORQ_DSN`, `ORQ_DB_USER`, `ORQ_DB_PASS`, `ORQ_STORAGE`, `ORQ_TENANT`, `ORQ_ACTOR`.
4. Executar `php examples/php/pdo-intake.php /caminho/contrato.pdf`.
5. Consultar o registro via `PdoDocumentCatalog::find($tenant,$id)`.

É necessário implementar autenticação, autorização e rotas HTTP no sistema hospedado, com validação server-side. Este exemplo não deve ser exposto diretamente por Apache ou Nginx.
