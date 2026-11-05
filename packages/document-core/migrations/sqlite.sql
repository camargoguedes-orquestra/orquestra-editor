-- Apenas testes locais; producao usa schema correspondente ao SGBD.
PRAGMA foreign_keys = ON;
CREATE TABLE orq_documents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 current_version_id TEXT NOT NULL, display_name TEXT NOT NULL, description TEXT NOT NULL,
 status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_orq_documents_tenant ON orq_documents(tenant_id,status,created_at);
CREATE TABLE orq_versions (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES orq_documents(id),
 version_no INTEGER NOT NULL, original_name TEXT NOT NULL, mime TEXT NOT NULL,
 extension TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, object_key TEXT NOT NULL,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL, UNIQUE(document_id,version_no)
);
CREATE TABLE orq_links (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES orq_documents(id),
 context_type TEXT NOT NULL,context_id TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE INDEX idx_orq_links_context ON orq_links(tenant_id,context_type,context_id);
CREATE TABLE orq_shares (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES orq_documents(id),
 created_by TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,recipient_email TEXT,
 recipient_phone TEXT,permissions_json TEXT NOT NULL,created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,revoked_at TEXT,download_count INTEGER NOT NULL DEFAULT 0,
 max_downloads INTEGER
);
CREATE INDEX idx_orq_shares_tenant ON orq_shares(tenant_id,document_id);
