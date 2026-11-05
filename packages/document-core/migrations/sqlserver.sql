-- SQL Server 2019+; UTC sem timezone, normalizar na camada da aplicacao.
CREATE TABLE orq_documents (
 id VARCHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,owner_id VARCHAR(128) NOT NULL,
 current_version_id VARCHAR(36) NOT NULL,display_name NVARCHAR(255) NOT NULL,
 description NVARCHAR(MAX) NOT NULL,status VARCHAR(20) NOT NULL,
 created_at DATETIME2 NOT NULL,updated_at DATETIME2 NOT NULL
);
CREATE INDEX idx_orq_documents_tenant ON orq_documents(tenant_id,status,created_at);
CREATE TABLE orq_versions (
 id VARCHAR(36) PRIMARY KEY,document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 version_no INT NOT NULL,original_name NVARCHAR(255) NOT NULL,mime VARCHAR(150) NOT NULL,
 extension VARCHAR(20) NOT NULL,size_bytes BIGINT NOT NULL,sha256 CHAR(64) NOT NULL,
 object_key CHAR(32) NOT NULL,created_by VARCHAR(128) NOT NULL,created_at DATETIME2 NOT NULL,
 CONSTRAINT uq_orq_versions UNIQUE(document_id,version_no)
);
CREATE TABLE orq_links (
 id VARCHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 context_type VARCHAR(64) NOT NULL,context_id VARCHAR(128) NOT NULL,
 created_by VARCHAR(128) NOT NULL,created_at DATETIME2 NOT NULL
);
CREATE INDEX idx_orq_links_context ON orq_links(tenant_id,context_type,context_id);
CREATE TABLE orq_shares (
 id VARCHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,
 document_id VARCHAR(36) NOT NULL REFERENCES orq_documents(id),
 created_by VARCHAR(128) NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,
 recipient_email NVARCHAR(254),recipient_phone VARCHAR(30),permissions_json NVARCHAR(MAX) NOT NULL,
 created_at DATETIME2 NOT NULL,expires_at DATETIME2 NOT NULL,revoked_at DATETIME2 NULL,
 download_count INT NOT NULL DEFAULT 0,max_downloads INT NULL
);
CREATE INDEX idx_orq_shares_tenant ON orq_shares(tenant_id,document_id);
