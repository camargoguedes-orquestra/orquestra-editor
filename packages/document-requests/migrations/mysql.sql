CREATE TABLE orq_requests(
 id CHAR(36) PRIMARY KEY,tenant_id VARCHAR(128) NOT NULL,
 context_type VARCHAR(64) NOT NULL,context_id VARCHAR(128) NOT NULL,
 created_by VARCHAR(128) NOT NULL,recipient VARCHAR(254) NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,
 required_json TEXT NOT NULL,status VARCHAR(32) NOT NULL,
 expires_at DATETIME NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,
 KEY idx_orq_requests_tenant(tenant_id,status,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE orq_request_submissions(
 id CHAR(36) PRIMARY KEY,request_id CHAR(36) NOT NULL,tenant_id VARCHAR(128) NOT NULL,
 document_id CHAR(36) NOT NULL,document_type VARCHAR(64) NOT NULL,
 submitted_by VARCHAR(128) NOT NULL,created_at DATETIME NOT NULL,
 UNIQUE KEY uq_orq_submissions(request_id,document_id,document_type),
 CONSTRAINT fk_orq_submission_request FOREIGN KEY(request_id) REFERENCES orq_requests(id),
 CONSTRAINT fk_orq_submission_document FOREIGN KEY(document_id) REFERENCES orq_documents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
