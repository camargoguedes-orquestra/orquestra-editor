# Orquestra Document Search

Índice SQL isolado por tenant, consulta incremental por texto ou metadados, e autorização obrigatória via callback por resultado.

**Este é um motor de busca inicial, não um indexador Full Text otimizado nem uma pesquisa OCR automática.** A ingestão de OCR precisa chamar `index(...)` depois da revisão e conforme política de retenção.

1. Instalar primeiro o schema do `document-core`.
2. Executar `migrations/{banco}.sql`.
3. Após processar documento, indexar texto com `PdoSearchIndex::index($tenant,$id,$texto,$metadados)`.
4. Consultar `search($tenant,$termo,fn($tenant,$id)=>$acl->mayView(...))`.
5. Ao apagar definitivamente documento, chamar `remove($tenant,$id)`.

Busca `LIKE` é adequada a acervos pequenos; volumes maiores precisam de Full Text nativo ou indexador opcional. A normalização de acentos depende da collation de cada banco. Limites de resultados e indexação são configurados. Não indexar CPF/dados sensíveis sem autorização, base legal e retenção compatível.

**Limitação conhecida:** a implementação SQL para PostgreSQL usa `metadata_json JSONB`, mas o índice simples serializa JSON textual; em produção use migração e testes específicos para tipo JSONB e casting apropriado. A publicação estável depende desses testes.
