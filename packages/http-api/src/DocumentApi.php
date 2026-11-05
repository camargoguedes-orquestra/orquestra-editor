<?php
declare(strict_types=1);
namespace Orquestra\HttpApi;
use Orquestra\DocumentCore\DocumentIntake;
use Orquestra\DocumentCore\PdoDocumentCatalog;
use Orquestra\DocumentCore\UploadProfile;
use Orquestra\SecureShare\PdoShareGrants;
use RuntimeException;

/**
 * Controller headless para adaptacao HTTP. Permissoes e principal sao providos pelo host.
 * NUNCA montar principal/tenant a partir do body enviado pelo cliente.
 */
final class DocumentApi {
    private \Closure $can;
    private \Closure $profile;
    public function __construct(
        private DocumentIntake $intake,
        private PdoDocumentCatalog $catalog,
        private PdoShareGrants $shares,
        callable $authorize,
        callable $getProfile
    ) {
        $this->can=\Closure::fromCallable($authorize);
        $this->profile=\Closure::fromCallable($getProfile);
    }
    /** @param resource|null $uploadStream */
    public function dispatch(string $method,string $path,array $principal,array $input=[],mixed $uploadStream=null):array {
        try {
            $actor=(string)($principal['actorId']??'');
            $tenant=(string)($principal['tenantId']??'');
            if($actor===''||$tenant==='')throw new RuntimeException('Acesso negado');
            $p=rtrim(parse_url($path,PHP_URL_PATH)?:'', '/');
            if($p==='')$p='/';
            if($method==='GET' && $p==='/documents'){
                $this->demand($principal,'list','');
                // Restricao por documento mesmo apos filtro por tenant.
                $rows=array_values(array_filter($this->catalog->listDocuments($tenant,100,0),
                    fn($row)=>($this->can)($principal,'view',$row['id'])));
                return self::json(200,$rows);
            }
            if($method==='POST' && $p==='/documents'){
                if(!is_resource($uploadStream))throw new RuntimeException('Upload ausente');
                $profileId=(string)($input['profile']??'');
                $this->demand($principal,'upload',$profileId);
                $profileConfig=($this->profile)($tenant,$profileId);
                if(!is_array($profileConfig))throw new RuntimeException('Perfil indisponivel');
                $record=$this->intake->ingest($tenant,$actor,$profileId,(string)($input['name']??''),
                    $uploadStream,new UploadProfile($profileConfig),
                    fn($t,$a,$profile)=>($this->can)($principal,'upload',$profile),
                    fn($r)=>$this->catalog->create($r),
                    ['displayName'=>(string)($input['displayName']??$input['name']??''),
                     'description'=>(string)($input['description']??'')]);
                return self::json(201,self::publicRecord($record));
            }
            if(preg_match('~^/documents/([a-z0-9-]{32,36})(?:/(versions|links|share))?$~D',$p,$m)){
                $id=$m[1];$sub=$m[2]??'';
                if($method==='GET'&&$sub===''){
                    $this->demand($principal,'view',$id);
                    $doc=$this->catalog->find($tenant,$id);
                    if(!$doc)return self::json(404,['error'=>['code'=>'not_found','message'=>'Documento nao localizado']]);
                    return self::json(200,self::publicRecord($doc));
                }
                if($method==='GET'&&$sub==='versions'){
                    $this->demand($principal,'view',$id);
                    return self::json(200,$this->catalog->versions($tenant,$id));
                }
                if($method==='POST'&&$sub==='links'){
                    $this->demand($principal,'link',$id);
                    $type=(string)($input['contextType']??'');
                    $context=(string)($input['contextId']??'');
                    // Host valida permissao no CONTEXTO de destino, alem do documento.
                    $this->demand($principal,'link-context',$type.':'.$context);
                    $linkId=$this->catalog->link($tenant,$id,$type,$context,$actor);
                    return self::json(201,['linkId'=>$linkId]);
                }
                if($method==='POST'&&$sub==='share'){
                    $this->demand($principal,'share',$id);
                    if(!$this->catalog->find($tenant,$id))throw new RuntimeException('Documento indisponivel');
                    $grant=$this->shares->issue($tenant,$id,$actor,$input['permissions']??['view'],
                      $input['recipientEmail']??null,$input['recipientPhone']??null,
                      isset($input['days'])?(int)$input['days']:null);
                    // Entregar token somente ao criador autorizado; nao colocar em logs.
                    return self::json(201,$grant);
                }
                if($method==='DELETE'&&$sub===''){
                    $this->demand($principal,'delete',$id);
                    return self::json($this->catalog->softDelete($tenant,$id)?204:404,[]);
                }
            }
            return self::json(404,['error'=>['code'=>'not_found','message'=>'Rota nao encontrada']]);
        } catch(RuntimeException $e) {
            $message=$e->getMessage();
            $unauthorized=str_contains($message,'Acesso negado');
            // Nao revelar identificadores/contextos internos em respostas de erro.
            return self::json($unauthorized?403:400,['error'=>['code'=>$unauthorized?'forbidden':'invalid_request',
                'message'=>$unauthorized?'Acesso negado':'Requisicao invalida']]);
        }catch(\Throwable $e) {
            // O host registra excecao com ID de correlacao, sem vazar stacktrace a cliente.
            return self::json(500,['error'=>['code'=>'internal','message'=>'Falha interna']]);
        }
    }
    private function demand(array $principal,string $action,string $target):void {
        if(!($this->can)($principal,$action,$target))throw new RuntimeException('Acesso negado');
    }
    private static function publicRecord(array $record):array {
        foreach(['objectKey','object_key','token_hash','storage_key','tenant_id','actorId','owner_id'] as $secret)unset($record[$secret]);
        return $record;
    }
    private static function json(int $status,mixed $body):array {
        return ['status'=>$status,'body'=>$body];
    }
}
