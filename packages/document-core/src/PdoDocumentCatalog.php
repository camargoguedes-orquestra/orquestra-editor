<?php
declare(strict_types=1);
namespace Orquestra\DocumentCore;
use PDO;
use RuntimeException;

/** Catalogo PDO que separa versoes imutaveis e documentos logicos. ACL e obrigatoria no host. */
final class PdoDocumentCatalog {
    public function __construct(private PDO $pdo) {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    }
    public function create(array $record):void {
        foreach(['id','tenantId','actorId','originalName','displayName','objectKey','sha256','size','mime'] as $required)
            if(!isset($record[$required])) throw new RuntimeException('Metadado obrigatorio: '.$required);
        $this->pdo->beginTransaction();
        try {
            $now=gmdate('Y-m-d H:i:s');
            $v=bin2hex(random_bytes(16));
            $a=$this->pdo->prepare('INSERT INTO orq_documents (id,tenant_id,owner_id,current_version_id,display_name,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
            $a->execute([$record['id'],$record['tenantId'],$record['actorId'],$v,$record['displayName'],$record['description']??'','active',$now,$now]);
            $b=$this->pdo->prepare('INSERT INTO orq_versions (id,document_id,version_no,original_name,mime,extension,size_bytes,sha256,object_key,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $b->execute([$v,$record['id'],1,$record['originalName'],$record['mime'],$record['extension']??'',$record['size'],$record['sha256'],$record['objectKey'],$record['actorId'],$now]);
            $this->pdo->commit();
        } catch (\Throwable $e) {if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    /** Scoped by tenant, never use document ID without tenant. */
    public function find(string $tenant,string $id):?array {
        $s=$this->pdo->prepare('SELECT d.*,v.sha256,v.object_key,v.original_name,v.size_bytes,v.mime,v.version_no FROM orq_documents d JOIN orq_versions v ON v.id=d.current_version_id WHERE d.tenant_id=? AND d.id=? AND d.status=?');
        $s->execute([$tenant,$id,'active']);
        $row=$s->fetch(PDO::FETCH_ASSOC);
        return $row===false?null:$row;
    }
    public function listDocuments(string $tenant,int $limit=50,int $offset=0):array {
        $limit=max(1,min(200,$limit));$offset=max(0,$offset);
        // SQL Server nao suporta LIMIT; construir a SQL correta ANTES de preparar.
        $order='SELECT id,display_name,description,status,created_at,updated_at FROM orq_documents WHERE tenant_id=? AND status=? ORDER BY created_at DESC,id DESC ';
        $page=$this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlsrv'
            ? 'OFFSET '.$offset.' ROWS FETCH NEXT '.$limit.' ROWS ONLY'
            : 'LIMIT '.$limit.' OFFSET '.$offset;
        $s=$this->pdo->prepare($order.$page);
        $s->execute([$tenant,'active']);
        return $s->fetchAll(PDO::FETCH_ASSOC);
    }
    /** A autorizacao de alteracao/ligacao deve acontecer antes desta chamada. */
    public function link(string $tenant,string $documentId,string $type,string $contextId,string $actor):string {
        if(!preg_match('/^[a-z][a-z0-9_-]{0,63}$/D',$type)||$contextId==='')throw new RuntimeException('Contexto invalido');
        if($this->find($tenant,$documentId)===null)throw new RuntimeException('Documento nao localizado no tenant');
        $id=bin2hex(random_bytes(16));
        $s=$this->pdo->prepare('INSERT INTO orq_links (id,tenant_id,document_id,context_type,context_id,created_by,created_at) VALUES (?,?,?,?,?,?,?)');
        $s->execute([$id,$tenant,$documentId,$type,$contextId,$actor,gmdate('Y-m-d H:i:s')]);
        return $id;
    }
    public function linked(string $tenant,string $type,string $contextId):array {
        $s=$this->pdo->prepare('SELECT d.id,d.display_name,l.context_type,l.context_id FROM orq_links l JOIN orq_documents d ON d.id=l.document_id AND d.tenant_id=l.tenant_id WHERE l.tenant_id=? AND l.context_type=? AND l.context_id=? AND d.status=?');
        $s->execute([$tenant,$type,$contextId,'active']);
        return $s->fetchAll(PDO::FETCH_ASSOC);
    }
    public function versions(string $tenant,string $documentId):array {
        if($this->find($tenant,$documentId)===null) return [];
        $s=$this->pdo->prepare('SELECT v.id,v.version_no,v.original_name,v.size_bytes,v.sha256,v.created_by,v.created_at FROM orq_versions v JOIN orq_documents d ON d.id=v.document_id WHERE d.tenant_id=? AND d.id=? ORDER BY v.version_no DESC');
        $s->execute([$tenant,$documentId]);
        return $s->fetchAll(PDO::FETCH_ASSOC);
    }
    /** Espera versao fisica nova e imutavel previamente armazenada. */
    public function addVersion(string $tenant,string $documentId,array $version,string $actor):void {
        $this->pdo->beginTransaction();
        try {
            $s=$this->pdo->prepare('SELECT id FROM orq_documents WHERE tenant_id=? AND id=? AND status=?');
            $s->execute([$tenant,$documentId,'active']);
            if(!$s->fetchColumn())throw new RuntimeException('Documento nao localizado');
            $s=$this->pdo->prepare('SELECT MAX(version_no) FROM orq_versions WHERE document_id=?');
            $s->execute([$documentId]);$next=(int)$s->fetchColumn()+1;
            $id=bin2hex(random_bytes(16));$now=gmdate('Y-m-d H:i:s');
            $s=$this->pdo->prepare('INSERT INTO orq_versions (id,document_id,version_no,original_name,mime,extension,size_bytes,sha256,object_key,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $s->execute([$id,$documentId,$next,$version['originalName'],$version['mime'],$version['extension'],$version['size'],$version['sha256'],$version['objectKey'],$actor,$now]);
            $s=$this->pdo->prepare('UPDATE orq_documents SET current_version_id=?,updated_at=? WHERE tenant_id=? AND id=? AND status=?');
            $s->execute([$id,$now,$tenant,$documentId,'active']);
            $this->pdo->commit();
        }catch(\Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    public function softDelete(string $tenant,string $id):bool {
        $s=$this->pdo->prepare('UPDATE orq_documents SET status=?,updated_at=? WHERE tenant_id=? AND id=? AND status=?');
        $s->execute(['deleted',gmdate('Y-m-d H:i:s'),$tenant,$id,'active']);
        return $s->rowCount()===1;
    }
}
