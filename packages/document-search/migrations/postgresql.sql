CREATE TABLE orq_search_index(
 tenant_id VARCHAR(128) NOT NULL,document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 content_text TEXT NOT NULL,metadata_json JSONB NOT NULL,
 updated_at TIMESTAMP NOT NULL,PRIMARY KEY(tenant_id,document_id)
);
CREATE INDEX idx_orq_search_tenant ON orq_search_index(tenant_id,updated_at);
-- Opcional para volume: indice GIN sobre to_tsvector('portuguese', content_text).
