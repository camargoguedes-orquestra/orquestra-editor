# Índice de exemplos por linguagem

| Linguagem / tecnologia | Caminho | Estado |
|---|---|---|
| HTML + JavaScript, upload | [examples/javascript/upload.html](../examples/javascript/upload.html) | Interface real; requer backend |
| HTML + JavaScript, visualizador | [examples/file-viewer-demo.html](../examples/file-viewer-demo.html) | Demo local de arquivo textual |
| HTML + JavaScript, imagens | [examples/image-uploader.html](../examples/image-uploader.html) | Edição local; backend opcional |
| TypeScript | [examples/typescript/upload.ts](../examples/typescript/upload.ts) | Cliente tipado de API proposta |
| PHP 8.2+ | [examples/php/pdo-intake.php](../examples/php/pdo-intake.php) | CLI real com PDO e storage privado |
| Python 3 | [examples/python/client.py](../examples/python/client.py) | Cliente HTTP de API proposta |
| Java 21 | [examples/java/OrquestraClient.java](../examples/java/OrquestraClient.java) | Cliente HTTP de API proposta |
| C# / .NET 8 | [examples/csharp/Program.cs](../examples/csharp/Program.cs) | Cliente HTTP de API proposta |
| SQL MySQL | [packages/document-core/migrations/mysql.sql](../packages/document-core/migrations/mysql.sql) | Schema inicial |
| SQL PostgreSQL | [packages/document-core/migrations/postgresql.sql](../packages/document-core/migrations/postgresql.sql) | Schema inicial |
| SQL Server | [packages/document-core/migrations/sqlserver.sql](../packages/document-core/migrations/sqlserver.sql) | Schema inicial |
| SQLite (testes) | [packages/document-core/migrations/sqlite.sql](../packages/document-core/migrations/sqlite.sql) | Testado automaticamente |

## Importante
Os exemplos HTML/TS/Python/Java/C# usam um **contrato HTTP documentado**, não um serviço REST completo já publicado. Ver [API_CONTRACT_V1.md](API_CONTRACT_V1.md). Eles podem ser reutilizados em qualquer backend que implemente o contrato. Não anuncie como integração end-to-end pronta sem backend.
