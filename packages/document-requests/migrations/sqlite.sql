CREATE TABLE orq_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,context_type TEXT NOT NULL,context_id TEXT NOT NULL,
 created_by TEXT NOT NULL,recipient TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,
 required_json TEXT NOT NULL,status TEXT NOT NULL,expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX idx_orq_requests_tenant ON orq_requests(tenant_id,status,expires_at);
CREATE TABLE orq_request_submissions(
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES orq_requests(id),
 tenant_id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES orq_documents(id),
 document_type TEXT NOT NULL,submitted_by TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(request_id,document_id,document_type)
);
