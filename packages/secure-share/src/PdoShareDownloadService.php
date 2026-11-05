<?php
declare(strict_types=1);
namespace Orquestra\SecureShare;
use PDO;
use Orquestra\DocumentCore\PrivateFilesystemStorage;
use RuntimeException;

/**
 * Une grants persistidos, versao privada e ticket temporario.
 * Nao expor este servico diretamente sem autenticacao, OTP quando exigido e rate limiting.
 */
final class PdoShareDownloadService {
    private TemporaryDownloadBroker $broker;
    private \Closure $verifyRecipient;
    private \Closure $acl;
    public function __construct(private PDO $pdo,private PdoShareGrants $grants,
      PrivateFilesystemStorage $storage,string $privateStage,
      callable $verifyRecipient,callable $acl,int $ticketMaxSeconds=900) {
        $this->verifyRecipient=\Closure::fromCallable($verifyRecipient);
        $this->acl=\Closure::fromCallable($acl);
        $this->broker=new TemporaryDownloadBroker(
            $privateStage,
            function(string $shareId):?array {
                $q=$this->pdo->prepare(
                    'SELECT s.*,d.status AS document_status,v.sha256,v.object_key,v.original_name '.
                    'FROM orq_shares s JOIN orq_documents d ON d.id=s.document_id AND d.tenant_id=s.tenant_id '.
                    'JOIN orq_versions v ON v.id=d.current_version_id '.
                    'WHERE s.id=?');
                $q->execute([$shareId]);$g=$q->fetch(PDO::FETCH_ASSOC);
                if(!$g)return null;
                // Broker exige timestamp Unix; colunas PDO retornam DATETIME em string.
                $g['expires_at'] = strtotime($g['expires_at'].' UTC');
                return $g;
            },
            function(array $g,string $actor):bool {
                if($actor===''||$g['revoked_at']!==null||$g['document_status']!=='active'||
                   (int)$g['expires_at']<=time())return false;
                $perms=json_decode($g['permissions_json'],true);
                if(!is_array($perms)||!in_array('download',$perms,true))return false;
                return (bool)($this->verifyRecipient)($g,$actor)
                    && (bool)($this->acl)($g['tenant_id'],$g['document_id'],$actor,'download');
            },
            fn(array $g)=>$storage->read($g['tenant_id'],$g['object_key']),
            maxTtl:$ticketMaxSeconds
        );
    }
    /** Requer token do convite e verificacao independente da identidade. */
    public function prepare(string $rawShareToken,string $actor):array {
        $g=$this->grants->authorize($rawShareToken,$actor,'download',
            $this->verifyRecipient,$this->acl);
        return $this->broker->prepare($g['id'],$actor);
    }
    /** Retorna nome original saneado e bytes, prontos para headers. Sem caminhos. */
    public function describe(string $ticket,string $actor):array {
        $desc=$this->broker->describeTicket($ticket,$actor);
        unset($desc['grantId']);return $desc;
    }
    /** Conta download atomicamente ANTES de transmitir; falha de rede pode consumir cota. */
    public function downloadTo(string $ticket,string $actor,mixed $output):array {
        $desc=$this->broker->describeTicket($ticket,$actor);
        $q=$this->pdo->prepare('SELECT tenant_id FROM orq_shares WHERE id=?');
        $q->execute([$desc['grantId']]);$tenant=$q->fetchColumn();
        if(!is_string($tenant)||!$this->grants->recordDownload($tenant,$desc['grantId']))
          throw new RuntimeException('Concessao revogada ou limite atingido');
        return $this->broker->downloadTo($ticket,$actor,$output);
    }
    public function cleanup():int {return $this->broker->prune();}
}
