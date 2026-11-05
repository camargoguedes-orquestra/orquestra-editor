<?php
declare(strict_types=1);
namespace Orquestra\DocumentSearch;
use PDO;
use RuntimeException;

/**
 * Busca incremental SQL com ACL por documento. Nao substitui Full Text Search
 * especializado para grandes volumes; exige indices de banco e politica de PII.
 */
final class PdoSearchIndex {
    public function __construct(private PDO $pdo,private int $maxTextBytes=262144) {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    }
    /** Somente o servidor autorizado pode indexar conteudo ja validado. */
    public function index(string $tenant,string $documentId,string $text,array $metadata=[]):void {
        if($tenant===''||$documentId===''||strlen($text)>$this->maxTextBytes)
            throw new RuntimeException('Indice invalido ou muito grande');
        $this->pdo->beginTransaction();
        try {
            $q=$this->pdo->prepare('SELECT id FROM orq_documents WHERE tenant_id=? AND id=? AND status=?');
            $q->execute([$tenant,$documentId,'active']);
            if(!$q->fetchColumn())throw new RuntimeException('Documento nao pertence ao tenant');
            $del=$this->pdo->prepare('DELETE FROM orq_search_index WHERE tenant_id=? AND document_id=?');
            $del->execute([$tenant,$documentId]);
            $ins=$this->pdo->prepare('INSERT INTO orq_search_index (tenant_id,document_id,content_text,metadata_json,updated_at) VALUES (?,?,?,?,?)');
            $ins->execute([$tenant,$documentId,$text,json_encode($metadata,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),gmdate('Y-m-d H:i:s')]);
            $this->pdo->commit();
        }catch(\Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    /**
     * ACL executada por CADA resultado; retorna IDs e resumo, nunca content_text integral.
     * Busca normalizada LOWER: sensibilidade a acentos depende da collation do banco.
     */
    public function search(string $tenant,string $term,callable $acl,int $limit=30):array {
        if($tenant===''||trim($term)==='')return [];
        $limit=max(1,min(100,$limit));
        $term=trim($term);
        if(strlen($term)>120)throw new RuntimeException('Consulta muito longa');
        $escaped=str_replace(['!','%','_'],['!!','!%','!_'],$term);
        $sql="SELECT si.document_id, si.content_text, si.metadata_json FROM orq_search_index si JOIN orq_documents d ON d.id=si.document_id AND d.tenant_id=si.tenant_id WHERE si.tenant_id=? AND d.status=? AND (LOWER(si.content_text) LIKE LOWER(?) ESCAPE '!' OR LOWER(si.metadata_json) LIKE LOWER(?) ESCAPE '!') ORDER BY si.updated_at DESC ";
        $sql.=$this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlsrv'
          ? 'OFFSET 0 ROWS FETCH NEXT '.($limit*5).' ROWS ONLY'
          : 'LIMIT '.($limit*5);
        $q=$this->pdo->prepare($sql);
        $pattern='%'.$escaped.'%';
        $q->execute([$tenant,'active',$pattern,$pattern]);
        $found=[];
        foreach($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if(!$acl($tenant,$r['document_id']))continue;
            $text=$r['content_text'];
            $pos=stripos($text,$term);
            $start=$pos===false?0:max(0,$pos-50);
            $found[]=['documentId'=>$r['document_id'],
                'snippet'=>substr($text,$start,160),
                'metadata'=>json_decode($r['metadata_json'],true)??[]];
            if(count($found)>=$limit)break;
        }
        return $found;
    }
    public function remove(string $tenant,string $documentId):void {
        $s=$this->pdo->prepare('DELETE FROM orq_search_index WHERE tenant_id=? AND document_id=?');
        $s->execute([$tenant,$documentId]);
    }
}
