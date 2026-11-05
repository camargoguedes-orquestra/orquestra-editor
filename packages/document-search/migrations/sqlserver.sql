CREATE TABLE orq_search_index(
 tenant_id VARCHAR(128) NOT NULL,document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 content_text NVARCHAR(MAX) NOT NULL,metadata_json NVARCHAR(MAX) NOT NULL,
 updated_at DATETIME2 NOT NULL,CONSTRAINT pk_orq_search PRIMARY KEY(tenant_id,document_id)
);
CREATE INDEX idx_orq_search_tenant ON orq_search_index(tenant_id,updated_at);
-- Opcional: configurar Full-Text Search com catalogo e chave unica.
