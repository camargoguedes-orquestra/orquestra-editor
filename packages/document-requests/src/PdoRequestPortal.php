<?php
declare(strict_types=1);
namespace Orquestra\DocumentRequests;
use PDO;
use RuntimeException;

/**
 * Portal de solicitacoes persistente; integracao com identidade, canais e storage via host.
 * Nunca permite que um token sozinho identifique um usuario.
 */
final class PdoRequestPortal {
    public function __construct(private PDO $pdo) {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    }
    /** Concessao de acesso e acao do criador devem ser verificadas por callback. */
    public function issue(
        string $tenant,string $actor,string $contextType,string $contextId,
        string $recipient,array $requiredTypes,\DateTimeImmutable $deadline,callable $canCreate
    ):array {
        if($tenant===''||$actor===''||$contextType===''||$contextId===''||$recipient===''||
           !$canCreate($tenant,$actor,$contextType,$contextId))throw new RuntimeException('Solicitacao nao autorizada');
        if(!filter_var($recipient,FILTER_VALIDATE_EMAIL) && !preg_match('/^\+[1-9]\d{7,14}$/D',$recipient))
            throw new RuntimeException('Destinatario invalido');
        $types=array_values(array_unique($requiredTypes));
        if($types===[]||count($types)>30)throw new RuntimeException('Lista de documentos invalida');
        foreach($types as $type)if(!is_string($type)||!preg_match('/^[a-z][a-z0-9_-]{0,63}$/D',$type))
            throw new RuntimeException('Tipo documental invalido');
        $ttl=$deadline->getTimestamp()-time();
        if($ttl<60||$ttl>60*60*24*90)throw new RuntimeException('Prazo de solicitacao invalido');
        $id=bin2hex(random_bytes(16));$token=bin2hex(random_bytes(32));
        $s=$this->pdo->prepare('INSERT INTO orq_requests (id,tenant_id,context_type,context_id,created_by,recipient,token_hash,required_json,status,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $now=gmdate('Y-m-d H:i:s');
        $s->execute([$id,$tenant,$contextType,$contextId,$actor,$recipient,hash('sha256',$token),
            json_encode($types,JSON_THROW_ON_ERROR),'sent',gmdate('Y-m-d H:i:s',$deadline->getTimestamp()),$now,$now]);
        return ['id'=>$id,'token'=>$token,'expiresAt'=>gmdate('Y-m-d H:i:s',$deadline->getTimestamp()),'required'=>$types];
    }
    /** Identidade do destinatario e verificada fora do token (OTP/conta/passkey). */
    public function recipientView(string $rawToken,string $actor,callable $recipientCheck):array {
        if($actor===''||!preg_match('/^[a-f0-9]{64}$/D',$rawToken))throw new RuntimeException('Acesso negado');
        $s=$this->pdo->prepare('SELECT * FROM orq_requests WHERE token_hash=?');
        $s->execute([hash('sha256',$rawToken)]);$r=$s->fetch(PDO::FETCH_ASSOC);
        if(!$r||!$recipientCheck($r,$actor)||strtotime($r['expires_at'].' UTC')<=time()||
            in_array($r['status'],['expired','canceled'],true))throw new RuntimeException('Acesso negado');
        return ['id'=>$r['id'],'required'=>json_decode($r['required_json'],true),
            'status'=>$r['status'],'expiresAt'=>$r['expires_at']];
    }
    /**
     * O callback verifica dono/tenant/versao de cada documento, nao apenas o token.
     * Aceita entregas parciais; concluir exige TODOS os tipos obrigatorios.
     * $docs: [['type'=>'contrato','documentId'=>'...'], ...]
     */
    public function submit(string $tenant,string $id,string $actor,array $docs,callable $canSubmit):array {
        if($tenant===''||$actor===''||$docs===[])throw new RuntimeException('Envio invalido');
        $this->pdo->beginTransaction();
        try {
            $s=$this->pdo->prepare('SELECT * FROM orq_requests WHERE tenant_id=? AND id=?');
            $s->execute([$tenant,$id]);$r=$s->fetch(PDO::FETCH_ASSOC);
            if(!$r||!in_array($r['status'],['sent','correction_requested'],true)||
               strtotime($r['expires_at'].' UTC')<=time()||!$canSubmit($r,$actor,$docs))
               throw new RuntimeException('Solicitacao fechada ou nao autorizada');
            $required=json_decode($r['required_json'],true)?:[];
            foreach($docs as $doc) {
                $type=(string)($doc['type']??'');$docId=(string)($doc['documentId']??'');
                if($docId===''||!in_array($type,$required,true))throw new RuntimeException('Documento de tipo nao solicitado');
                $e=$this->pdo->prepare('SELECT COUNT(*) FROM orq_request_submissions WHERE request_id=? AND document_id=? AND document_type=?');
                $e->execute([$id,$docId,$type]);if((int)$e->fetchColumn()!==0)continue;
                $q=$this->pdo->prepare('INSERT INTO orq_request_submissions (id,request_id,tenant_id,document_id,document_type,submitted_by,created_at) VALUES (?,?,?,?,?,?,?)');
                $q->execute([bin2hex(random_bytes(16)),$id,$tenant,$docId,$type,$actor,gmdate('Y-m-d H:i:s')]);
            }
            $s=$this->pdo->prepare('SELECT DISTINCT document_type FROM orq_request_submissions WHERE tenant_id=? AND request_id=?');
            $s->execute([$tenant,$id]);$done=$s->fetchAll(PDO::FETCH_COLUMN);
            $missing=array_values(array_diff($required,$done));
            $status=$missing===[]?'received':$r['status'];
            $u=$this->pdo->prepare('UPDATE orq_requests SET status=?,updated_at=? WHERE tenant_id=? AND id=?');
            $u->execute([$status,gmdate('Y-m-d H:i:s'),$tenant,$id]);
            $this->pdo->commit();
            return ['status'=>$status,'missing'=>$missing,'received'=>$done];
        }catch(\Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    public function review(string $tenant,string $id,string $reviewer,string $decision,callable $canReview):void {
        $this->pdo->beginTransaction();
        try {
            $s=$this->pdo->prepare('SELECT * FROM orq_requests WHERE tenant_id=? AND id=?');
            $s->execute([$tenant,$id]);$r=$s->fetch(PDO::FETCH_ASSOC);
            if(!$r||!$canReview($r,$reviewer))throw new RuntimeException('Revisao nao autorizada');
            $next=RequestWorkflow::transition($r['status'],$decision);
            $q=$this->pdo->prepare('UPDATE orq_requests SET status=?,updated_at=? WHERE tenant_id=? AND id=?');
            $q->execute([$next,gmdate('Y-m-d H:i:s'),$tenant,$id]);
            $this->pdo->commit();
        } catch(\Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    public function get(string $tenant,string $id,callable $canView):?array {
        $s=$this->pdo->prepare('SELECT * FROM orq_requests WHERE tenant_id=? AND id=?');
        $s->execute([$tenant,$id]);$r=$s->fetch(PDO::FETCH_ASSOC);
        if(!$r||!$canView($r))return null;
        unset($r['token_hash']);return $r;
    }
    /** Operacao de cron, sem revelar dados. */
    public function expire():int {
        $s=$this->pdo->prepare("UPDATE orq_requests SET status='expired',updated_at=? WHERE expires_at<=? AND status IN ('sent','correction_requested')");
        $now=gmdate('Y-m-d H:i:s');$s->execute([$now,$now]);return $s->rowCount();
    }
}
