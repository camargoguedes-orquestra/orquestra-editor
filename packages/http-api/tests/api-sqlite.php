<?php
declare(strict_types=1);
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){echo "SKIP pdo_sqlite\n";exit(0);}
require __DIR__.'/../../document-core/src/PrivateFilesystemStorage.php';
require __DIR__.'/../../document-core/src/UploadProfile.php';
require __DIR__.'/../../document-core/src/DocumentIntake.php';
require __DIR__.'/../../document-core/src/PdoDocumentCatalog.php';
require __DIR__.'/../../secure-share/src/PdoShareGrants.php';
require __DIR__.'/../src/DocumentApi.php';
use Orquestra\DocumentCore\PrivateFilesystemStorage;
use Orquestra\DocumentCore\DocumentIntake;
use Orquestra\DocumentCore\PdoDocumentCatalog;
use Orquestra\SecureShare\PdoShareGrants;
use Orquestra\HttpApi\DocumentApi;
$dir=sys_get_temp_dir().'/orq-api-'.bin2hex(random_bytes(6));mkdir($dir,0700);
try {
 $pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
 $pdo->exec(file_get_contents(__DIR__.'/../../document-core/migrations/sqlite.sql'));
 $acl=static fn(array $actor,string $action,string $target)=>$actor['actorId']==='admin';
 $api=new DocumentApi(new DocumentIntake(new PrivateFilesystemStorage($dir)),
  new PdoDocumentCatalog($pdo),new PdoShareGrants($pdo),$acl,
  static fn()=>['extensions'=>['pdf'=>30000]]);
 $p=['tenantId'=>'t1','actorId'=>'admin'];
 $pdf=fopen('php://temp','w+b');fwrite($pdf,"%PDF-1.4\nhello\n%%EOF");rewind($pdf);
 $result=$api->dispatch('POST','/documents',$p,['name'=>'contrato.pdf','profile'=>'padrão'],$pdf);
 if($result['status']!==201)throw new RuntimeException('Upload API falhou: '.json_encode($result));
 $id=$result['body']['id'];if(isset($result['body']['objectKey']))throw new RuntimeException('Storage vazou');
 fclose($pdf);
 $g=$api->dispatch('GET','/documents/'.$id,$p);
 if($g['status']!==200||isset($g['body']['object_key']))throw new RuntimeException('Consulta expôs chave');
 $deny=$api->dispatch('GET','/documents/'.$id,['tenantId'=>'t1','actorId'=>'visitor']);
 if($deny['status']!==403)throw new RuntimeException('Permissao bypass');
 $other=$api->dispatch('GET','/documents/'.$id,['tenantId'=>'t2','actorId'=>'admin']);
 if($other['status']!==404)throw new RuntimeException('Tenant bypass');
 $share=$api->dispatch('POST','/documents/'.$id.'/share',$p,['recipientEmail'=>'teste@example.test','permissions'=>['view']]);
 if($share['status']!==201||strlen($share['body']['token'])!==64)throw new RuntimeException('Share creation');
 $del=$api->dispatch('DELETE','/documents/'.$id,$p);
 if($del['status']!==204)throw new RuntimeException('Soft delete API');
 echo "HTTP controller auth + tenant + upload + share + delete: OK\n";
} finally {
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($it as $x){$x->isDir()?rmdir($x->getPathname()):unlink($x->getPathname());}
 rmdir($dir);
}
