<?php
declare(strict_types=1);
namespace Orquestra\DocumentCore;
use RuntimeException;

/**
 * Recepcao transacional por callbacks: o host autentica, autoriza e persiste.
 * Em caso de falha de persistencia, remove objeto recem-criado.
 */
final class DocumentIntake {
    public function __construct(private PrivateFilesystemStorage $storage) {}
    /**
     * @param resource $input
     * @param callable(string,string,string):bool $authorize tenant/actor/profile
     * @param callable(array):void $persist insere metadados e vinculos em transacao
     */
    public function ingest(
        string $tenant, string $actor, string $profileId, string $originalName,
        mixed $input, UploadProfile $profile, callable $authorize, callable $persist,
        array $metadata = []
    ): array {
        if ($tenant === '' || $actor === '' || $profileId === '' || !is_resource($input)
            || !$authorize($tenant,$actor,$profileId)) throw new RuntimeException('Upload nao autorizado');
        $temp = fopen('php://temp/maxmemory:2097152','w+b');
        if ($temp === false) throw new RuntimeException('Buffer indisponivel');
        $size=0; $first='';
        try {
            while (!feof($input)) {
                $buf=fread($input,65536);
                if ($buf===false || ($buf==='' && !feof($input))) throw new RuntimeException('Falha de leitura');
                $size+=strlen($buf);
                if ($size > $profile->maxBytes()) throw new RuntimeException('Tamanho excedido');
                if (strlen($first)<8192) $first.=substr($buf,0,8192-strlen($first));
                if (fwrite($temp,$buf)!==strlen($buf)) throw new RuntimeException('Falha no buffer');
            }
            $mime=(new \finfo(FILEINFO_MIME_TYPE))->buffer($first) ?: 'application/octet-stream';
            $ext=$profile->validate($originalName,$size,$mime,$first);
            rewind($temp);
            $key=bin2hex(random_bytes(16));
            $saved=$this->storage->put($tenant,$key,$temp,$profile->maxBytes());
            $record=[
                'id'=>self::uuid(), 'tenantId'=>$tenant, 'actorId'=>$actor,
                'profileId'=>$profileId, 'originalName'=>basename(str_replace('\\','/',$originalName)),
                'displayName'=>(string)($metadata['displayName']??$originalName),
                'description'=>(string)($metadata['description']??''),
                'extension'=>$ext,'mime'=>$mime,'size'=>$saved['bytes'],
                'sha256'=>$saved['sha256'],'objectKey'=>$saved['objectKey'],
                'createdAt'=>gmdate('Y-m-d\TH:i:s\Z')
            ];
            try { $persist($record); }
            catch (\Throwable $e) { $this->storage->delete($tenant,$key); throw $e; }
            return $record;
        } finally { fclose($temp); }
    }
    private static function uuid():string {
        $b=random_bytes(16); $b[6]=chr((ord($b[6])&15)|64); $b[8]=chr((ord($b[8])&63)|128);
        $h=bin2hex($b);
        return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20);
    }
}
