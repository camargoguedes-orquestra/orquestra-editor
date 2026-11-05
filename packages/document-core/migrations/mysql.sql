-- MySQL 8+/Percona/MariaDB (utf8mb4). Executar em banco vazio ou migracao versionada.
CREATE TABLE orq_documents (
 id CHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,owner_id VARCHAR(128) NOT NULL,
 current_version_id CHAR(36) NOT NULL,display_name VARCHAR(255) NOT NULL,
 description TEXT NOT NULL,status VARCHAR(20) NOT NULL,
 created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,
 KEY idx_orq_documents_tenant(tenant_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE orq_versions (
 id CHAR(36) PRIMARY KEY,document_id CHAR(36) NOT NULL,version_no INT NOT NULL,
 original_name VARCHAR(255) NOT NULL,mime VARCHAR(150) NOT NULL,extension VARCHAR(20) NOT NULL,
 size_bytes BIGINT NOT NULL,sha256 CHAR(64) NOT NULL,object_key CHAR(32) NOT NULL,
 created_by VARCHAR(128) NOT NULL,created_at DATETIME NOT NULL,
 UNIQUE KEY uq_orq_versions(document_id,version_no),
 CONSTRAINT fk_orq_versions_document FOREIGN KEY(document_id) REFERENCES orq_documents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE orq_links (
 id CHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,document_id CHAR(36) NOT NULL,
 context_type VARCHAR(64) NOT NULL,context_id VARCHAR(128) NOT NULL,
 created_by VARCHAR(128) NOT NULL,created_at DATETIME NOT NULL,
 KEY idx_orq_links_context(tenant_id,context_type,context_id),
 CONSTRAINT fk_orq_links_doc FOREIGN KEY(document_id) REFERENCES orq_documents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE orq_shares (
 id CHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,document_id CHAR(36) NOT NULL,
 created_by VARCHAR(128) NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,
 recipient_email VARCHAR(254),recipient_phone VARCHAR(30),
 permissions_json TEXT NOT NULL,created_at DATETIME NOT NULL,expires_at DATETIME NOT NULL,
 revoked_at DATETIME NULL,download_count INT NOT NULL DEFAULT 0,max_downloads INT NULL,
 KEY idx_orq_shares_tenant(tenant_id,document_id),
 CONSTRAINT fk_orq_shares_doc FOREIGN KEY(document_id) REFERENCES orq_documents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
