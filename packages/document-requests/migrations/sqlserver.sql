CREATE TABLE orq_requests(
 id VARCHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,
 context_type VARCHAR(64) NOT NULL,context_id VARCHAR(128) NOT NULL,
 created_by VARCHAR(128) NOT NULL,recipient NVARCHAR(254) NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,
 required_json NVARCHAR(MAX) NOT NULL,status VARCHAR(32) NOT NULL,
 expires_at DATETIME2 NOT NULL,created_at DATETIME2 NOT NULL,updated_at DATETIME2 NOT NULL
);
CREATE INDEX idx_orq_requests_tenant ON orq_requests(tenant_id,status,expires_at);
CREATE TABLE orq_request_submissions(
 id VARCHAR(36) PRIMARY KEY,request_id VARCHAR(36) NOT NULL REFERENCES orq_requests(id),
 tenant_id VARCHAR(128) NOT NULL,document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 document_type VARCHAR(64) NOT NULL,submitted_by VARCHAR(128) NOT NULL,created_at DATETIME2 NOT NULL,
 CONSTRAINT uq_orq_submissions UNIQUE(request_id,document_id,document_type)
);
