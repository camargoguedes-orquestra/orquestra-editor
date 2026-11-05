CREATE TABLE orq_search_index(
 tenant_id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES orq_documents(id),
 content_text TEXT NOT NULL,metadata_json TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,document_id)
);
CREATE INDEX idx_orq_search_tenant ON orq_search_index(tenant_id,updated_at);
