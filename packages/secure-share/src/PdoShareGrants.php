<?php
declare(strict_types=1);
namespace Orquestra\SecureShare;
use PDO;
use RuntimeException;

/** Grants persistidos: nunca retornar token ao GET, somente na criacao. */
final class PdoShareGrants {
    public function __construct(private PDO $pdo,private int $defaultDays=7,private int $maxDays=30) {
        if($defaultDays<1||$maxDays<$defaultDays)throw new RuntimeException('Politica de prazos invalida');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    }
    /**
     * O host deve ter autorizado actor, tenant, document e destinatario.
     * @return array{id:string,token:string,expiresAt:string}
     */
    public function issue(string $tenant,string $document,string $actor,array $permissions,
      ?string $recipientEmail=null,?string $recipientPhone=null,?int $days=null):array {
        if($tenant===''||$document===''||$actor==='')throw new RuntimeException('Identidade/contexto obrigatorio');
        if(!$recipientEmail&&!$recipientPhone)throw new RuntimeException('Destinatario obrigatorio');
        $valid=['view','download'];$permissions=array_values(array_unique($permissions));
        if($permissions===[]||array_diff($permissions,$valid)!==[])throw new RuntimeException('Permissoes invalidas');
        $days=$days??$this->defaultDays;
        if($days<1||$days>$this->maxDays)throw new RuntimeException('Prazo excede limite');
        $id=bin2hex(random_bytes(16));$token=bin2hex(random_bytes(32));$now=time();
        $s=$this->pdo->prepare('INSERT INTO orq_shares (id,tenant_id,document_id,created_by,token_hash,recipient_email,recipient_phone,permissions_json,created_at,expires_at,revoked_at,download_count,max_downloads) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $s->execute([$id,$tenant,$document,$actor,hash('sha256',$token),$recipientEmail,$recipientPhone,json_encode($permissions,JSON_THROW_ON_ERROR),gmdate('Y-m-d H:i:s',$now),gmdate('Y-m-d H:i:s',$now+$days*86400),null,0,null]);
        return ['id'=>$id,'token'=>$token,'expiresAt'=>gmdate('Y-m-d H:i:s',$now+$days*86400)];
    }
    /**
     * A verificacao de posse do e-mail/telefone/OTP e EXIGIDA pelo callback.
     * $identityCheck recebe grant e identidade atual; $aclCheck recebe tenant/document/actor.
     */
    public function authorize(string $token,string $actor,string $operation,callable $identityCheck,callable $aclCheck):array {
        if(!preg_match('/^[a-f0-9]{64}$/D',$token) || $actor==='')throw new RuntimeException('Acesso negado');
        if(!in_array($operation,['view','download'],true))throw new RuntimeException('Operacao invalida');
        $s=$this->pdo->prepare('SELECT * FROM orq_shares WHERE token_hash=?');
        $s->execute([hash('sha256',$token)]);$g=$s->fetch(PDO::FETCH_ASSOC);
        if(!$g || $g['revoked_at']!==null || strtotime($g['expires_at'].' UTC')<=time())throw new RuntimeException('Acesso negado');
        $permissions=json_decode($g['permissions_json'],true);
        if(!is_array($permissions)||!in_array($operation,$permissions,true) ||
          !$identityCheck($g,$actor) || !$aclCheck($g['tenant_id'],$g['document_id'],$actor,$operation))
          throw new RuntimeException('Acesso negado');
        if($operation==='download' && $g['max_downloads']!==null && (int)$g['download_count']>=(int)$g['max_downloads'])
          throw new RuntimeException('Limite de downloads atingido');
        return $g;
    }
    public function revoke(string $tenant,string $id):bool {
        $s=$this->pdo->prepare('UPDATE orq_shares SET revoked_at=? WHERE tenant_id=? AND id=? AND revoked_at IS NULL');
        $s->execute([gmdate('Y-m-d H:i:s'),$tenant,$id]);return $s->rowCount()===1;
    }
    /** $authorizedByHost deve verificar se caller pode prorrogacao. */
    public function extend(string $tenant,string $id,\DateTimeImmutable $until,bool $authorizedByHost):bool {
        if(!$authorizedByHost)throw new RuntimeException('Sem permissao para prorrogar');
        $s=$this->pdo->prepare('SELECT created_at,expires_at,revoked_at FROM orq_shares WHERE tenant_id=? AND id=?');
        $s->execute([$tenant,$id]);$g=$s->fetch(PDO::FETCH_ASSOC);
        if(!$g||$g['revoked_at']!==null)throw new RuntimeException('Grant indisponivel');
        $when=$until->getTimestamp();$origin=strtotime($g['created_at'].' UTC');
        if($when<=time()||$when<strtotime($g['expires_at'].' UTC')||$when>$origin+$this->maxDays*86400)
            throw new RuntimeException('Prorrogacao fora do teto');
        $q=$this->pdo->prepare('UPDATE orq_shares SET expires_at=? WHERE tenant_id=? AND id=? AND revoked_at IS NULL');
        $q->execute([gmdate('Y-m-d H:i:s',$when),$tenant,$id]);return $q->rowCount()===1;
    }
    public function recordDownload(string $tenant,string $id):bool {
        $s=$this->pdo->prepare('UPDATE orq_shares SET download_count=download_count+1 WHERE tenant_id=? AND id=? AND revoked_at IS NULL AND expires_at > ? AND (max_downloads IS NULL OR download_count < max_downloads)');
        $s->execute([$tenant,$id,gmdate('Y-m-d H:i:s')]);
        return $s->rowCount()===1;
    }
}
