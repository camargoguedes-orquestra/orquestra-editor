<?php
declare(strict_types=1);
/**
 * Exemplo de ingestao CLI. NAO e um endpoint HTTP. Requer esquema SQL instalado,
 * DSN e credenciais de banco em variaveis de ambiente, storage fora do webroot.
 *
 * ORQ_DSN='mysql:host=127.0.0.1;dbname=orquestra;charset=utf8mb4' ORQ_DB_USER=...
 * ORQ_DB_PASS=... ORQ_STORAGE=/caminho/privado ORQ_TENANT=demo ORQ_ACTOR=admin
 * php examples/php/pdo-intake.php /caminho/arquivo.pdf
 */
require __DIR__.'/../../packages/document-core/src/PrivateFilesystemStorage.php';
require __DIR__.'/../../packages/document-core/src/UploadProfile.php';
require __DIR__.'/../../packages/document-core/src/DocumentIntake.php';
require __DIR__.'/../../packages/document-core/src/PdoDocumentCatalog.php';

use Orquestra\DocumentCore\PrivateFilesystemStorage;
use Orquestra\DocumentCore\UploadProfile;
use Orquestra\DocumentCore\DocumentIntake;
use Orquestra\DocumentCore\PdoDocumentCatalog;

if (PHP_SAPI !== 'cli') {http_response_code(403);exit('Apenas CLI');}
$path=$argv[1]??null;$dsn=getenv('ORQ_DSN')?:'';
$storageRoot=getenv('ORQ_STORAGE')?:'';
if (!$path || !is_file($path) || !$dsn || !$storageRoot) {
    fwrite(STDERR,"Uso: ORQ_DSN=... ORQ_DB_USER=... ORQ_DB_PASS=... ORQ_STORAGE=/privado ORQ_TENANT=... ORQ_ACTOR=... php examples/php/pdo-intake.php arquivo.pdf\n");
    exit(2);
}
$tenant=getenv('ORQ_TENANT')?:'demo';$actor=getenv('ORQ_ACTOR')?:'cli-admin';
$pdo=new PDO($dsn,getenv('ORQ_DB_USER')?:'',getenv('ORQ_DB_PASS')?:'',
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$catalog=new PdoDocumentCatalog($pdo);
$intake=new DocumentIntake(new PrivateFilesystemStorage($storageRoot));
$profile=new UploadProfile(['extensions'=>['pdf'=>20971520,'jpg'=>5242880,'jpeg'=>5242880,'png'=>5242880,'txt'=>2097152]]);
$stream=fopen($path,'rb');
if($stream===false)throw new RuntimeException('Nao le arquivo');
try {
  $record=$intake->ingest($tenant,$actor,'demo',basename($path),$stream,$profile,
    // A autorizacao abaixo e restrita ao CLI sob controle do operador.
    static fn(string $t,string $a,string $p)=>$t===$tenant && $a===$actor && PHP_SAPI==='cli',
    static fn(array $row)=>$catalog->create($row));
  $public=$record;unset($public['objectKey']);
  echo json_encode($public,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
} finally {fclose($stream);}
