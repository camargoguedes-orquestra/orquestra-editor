<?php
declare(strict_types=1);
namespace Orquestra\SecureShare;
use RuntimeException;

/** Nucleo de staging privado; usuario final nunca recebe caminho do original. */
final class TemporaryDownloadBroker {
  private \Closure $lookup;
  private \Closure $allowed;
  private \Closure $source;
  private string $directory;
  public function __construct(
    string $privateDir,
    callable $lookup,
    callable $allowed,
    callable $source,
    private int $maxBytes=104857600,
    private int $maxTtl=900
  ) {
    if ($maxBytes < 1 || $maxTtl < 1 || $maxTtl > 3600) throw new RuntimeException('Limites invalidos');
    if (!is_dir($privateDir) && !mkdir($privateDir,0700,true)) throw new RuntimeException('Storage indisponivel');
    $real=realpath($privateDir);
    if ($real === false || is_link($privateDir)) throw new RuntimeException('Storage invalido');
    $this->directory=$real;
    $this->lookup=\Closure::fromCallable($lookup);
    $this->allowed=\Closure::fromCallable($allowed);
    $this->source=\Closure::fromCallable($source);
  }
  private function grant(string $id,string $actor): array {
    $g=($this->lookup)($id);
    if (!is_array($g) || !($this->allowed)($g,$actor) ||
      (int)($g['expires_at']??0) <= time() ||
      !preg_match('/^[a-f0-9]{64}$/i',(string)($g['sha256']??''))) {
      throw new RuntimeException('Acesso negado ou expirado');
    }
    return $g;
  }
  private static function uuid(): string {
    $b=random_bytes(16);
    $b[6]=chr((ord($b[6])&15)|64);
    $b[8]=chr((ord($b[8])&63)|128);
    $h=bin2hex($b);
    return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20);
  }
  private function path(string $id,string $suffix):string {
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$id))
      throw new RuntimeException('Ticket invalido');
    return $this->directory.DIRECTORY_SEPARATOR.$id.$suffix;
  }
  /** Faz uma copia sob demanda; retira o original do stream privado injetado pelo host. */
  public function prepare(string $id,string $actor,?int $requestedTtl=null):array {
    $g=$this->grant($id,$actor);
    $ttl=min($this->maxTtl,$requestedTtl??$this->maxTtl,(int)$g['expires_at']-time());
    if ($ttl<=0) throw new RuntimeException('Prazo esgotado');
    $ticket=self::uuid();
    $file=$this->path($ticket,'.bin');
    $meta=$this->path($ticket,'.json');
    $src=($this->source)($g);
    if (!is_resource($src)) throw new RuntimeException('Origem indisponivel');
    $dst=@fopen($file,'x+b');
    if (!$dst) {fclose($src);throw new RuntimeException('Copia indisponivel');}
    @chmod($file,0600);
    try {
      $hash=hash_init('sha256');$bytes=0;
      while (!feof($src)) {
        $chunk=fread($src,65536);
        if ($chunk===false || ($chunk==='' && !feof($src))) throw new RuntimeException('Leitura interrompida');
        $bytes+=strlen($chunk);
        if ($bytes>$this->maxBytes) throw new RuntimeException('Quota de staging excedida');
        hash_update($hash,$chunk);
        if (fwrite($dst,$chunk)!==strlen($chunk)) throw new RuntimeException('Escrita interrompida');
      }
      fflush($dst);
      if ($bytes===0 || !hash_equals(strtolower($g['sha256']),hash_final($hash)))
        throw new RuntimeException('Hash da origem divergente');
      $data=['grant'=>$id,'actor'=>$actor,'expires'=>time()+$ttl,'sha'=>strtolower($g['sha256']),'bytes'=>$bytes];
      if (file_put_contents($meta,json_encode($data,JSON_THROW_ON_ERROR),LOCK_EX)===false)
        throw new RuntimeException('Ticket indisponivel');
      @chmod($meta,0600);
      return ['ticket'=>$ticket,'expiresAt'=>$data['expires']];
    } catch (\Throwable $e) {
      @unlink($meta);@unlink($file);throw $e;
    } finally {fclose($src);fclose($dst);}
  }
  /** Copia somente apos revalidar a concessao, titular e SHA-256. */
  public function downloadTo(string $ticket,string $actor,mixed $output):array {
    if (!is_resource($output)) throw new RuntimeException('Stream de saida invalido');
    $meta=$this->path($ticket,'.json');$file=$this->path($ticket,'.bin');
    if (!is_file($meta)||!is_file($file)||is_link($meta)||is_link($file)) throw new RuntimeException('Ticket nao localizado');
    $d=json_decode((string)file_get_contents($meta),true);
    if (!is_array($d)||!hash_equals((string)($d['actor']??''),$actor)||(int)($d['expires']??0)<=time())
      throw new RuntimeException('Ticket expirado ou nao autorizado');
    $g=$this->grant((string)($d['grant']??''),$actor);
    if (!hash_equals(strtolower($g['sha256']),(string)($d['sha']??'')) ||
      !hash_equals(strtolower($g['sha256']),(string)hash_file('sha256',$file))) {
      throw new RuntimeException('Integridade comprometida');
    }
    $src=fopen($file,'rb');
    if (!$src) throw new RuntimeException('Arquivo indisponivel');
    try {
      if (stream_copy_to_stream($src,$output)===false) throw new RuntimeException('Falha na entrega');
    } finally {fclose($src);}
    return ['originalName'=>self::safeName((string)($g['original_name']??'documento')),'bytes'=>(int)$d['bytes'],'sha256'=>(string)$d['sha']];
  }
  public function prune():int {
    $count=0;
    foreach (glob($this->directory.'/*.json')?:[] as $meta) {
      if (is_link($meta)) continue;
      $d=json_decode((string)file_get_contents($meta),true);
      if (!is_array($d)||(int)($d['expires']??0)<=time()) {
        $id=basename($meta,'.json');
        try {@unlink($this->path($id,'.bin'));} catch (\Throwable $e) {}
        @unlink($meta);$count++;
      }
    }
    return $count;
  }
  public static function safeName(string $name):string {
    $base=basename(str_replace('\\','/',$name));
    $base=preg_replace('/[\x00-\x1f\x7f";\r\n]+/u','_',$base)?:'documento';
    return function_exists('mb_substr')?mb_substr($base,0,180):substr($base,0,180);
  }
}
