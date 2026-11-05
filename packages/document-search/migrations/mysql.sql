CREATE TABLE orq_search_index(
 tenant_id VARCHAR(128) NOT NULL,document_id CHAR(36) NOT NULL,
 content_text MEDIUMTEXT NOT NULL,metadata_json LONGTEXT NOT NULL,
 updated_at DATETIME NOT NULL,PRIMARY KEY(tenant_id,document_id),
 KEY idx_orq_search_tenant(tenant_id,updated_at),
 CONSTRAINT fk_orq_search_document FOREIGN KEY(document_id) REFERENCES orq_documents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Opcional, conforme indice e volume:
-- ALTER TABLE orq_search_index ADD FULLTEXT INDEX ft_orq_content(content_text);
