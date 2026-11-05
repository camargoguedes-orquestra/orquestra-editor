<?php
declare(strict_types=1);
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){echo "SKIP pdo_sqlite\n";exit(0);}
require __DIR__.'/../../document-core/src/PrivateFilesystemStorage.php';
require __DIR__.'/../../document-core/src/PdoDocumentCatalog.php';
require __DIR__.'/../src/PdoShareGrants.php';
require __DIR__.'/../src/TemporaryDownloadBroker.php';
require __DIR__.'/../src/PdoShareDownloadService.php';
use Orquestra\DocumentCore\PrivateFilesystemStorage;
use Orquestra\DocumentCore\PdoDocumentCatalog;
use Orquestra\SecureShare\PdoShareGrants;
use Orquestra\SecureShare\PdoShareDownloadService;
$dir=sys_get_temp_dir().'/orq-share-'.bin2hex(random_bytes(6));mkdir($dir,0700);
try{
 $pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
 $pdo->exec(file_get_contents(__DIR__.'/../../document-core/migrations/sqlite.sql'));
 $storage=new PrivateFilesystemStorage($dir.'/private');
 $body='%PDF-1.5 simulated file';
 $stream=fopen('php://temp','w+b');fwrite($stream,$body);rewind($stream);
 $key=bin2hex(random_bytes(16));$put=$storage->put('tenant-1',$key,$stream,1000);fclose($stream);
 $catalog=new PdoDocumentCatalog($pdo);
 $id='12e5b7fa-4444-4cd1-8000-bab000000001';
 $catalog->create(['id'=>$id,'tenantId'=>'tenant-1','actorId'=>'admin',
  'originalName'=>'Contrato final.pdf','displayName'=>'Contrato final.pdf',
  'objectKey'=>$key,'sha256'=>$put['sha256'],'mime'=>'application/pdf','extension'=>'pdf','size'=>$put['bytes']]);
 $grants=new PdoShareGrants($pdo,7,30);
 $g=$grants->issue('tenant-1',$id,'admin',['view','download'],'dest@example.test');
 $service=new PdoShareDownloadService($pdo,$grants,$storage,$dir.'/staging',
  fn($grant,$actor)=>$actor==='dest',fn($tenant,$doc,$actor,$op)=>$tenant==='tenant-1'&&$actor==='dest');
 try{$service->prepare($g['token'],'intruso');throw new RuntimeException('OTP/identidade ignorados');}
 catch(RuntimeException $e){if($e->getMessage()!=='Acesso negado')throw $e;}
 $ticket=$service->prepare($g['token'],'dest')['ticket'];
 $desc=$service->describe($ticket,'dest');
 if($desc['originalName']!=='Contrato final.pdf'||isset($desc['objectKey']))throw new RuntimeException('Metadado exposto');
 $out=fopen('php://temp','w+b');$done=$service->downloadTo($ticket,'dest',$out);rewind($out);
 if(stream_get_contents($out)!==$body)throw new RuntimeException('Download divergente');
 fclose($out);
 $grants->revoke('tenant-1',$g['id']);
 try{$out=fopen('php://temp','w+b');$service->downloadTo($ticket,'dest',$out);throw new RuntimeException('Revogacao ignorada');}
 catch(RuntimeException $e){if($e->getMessage()==='Revogacao ignorada')throw $e;}
 finally{fclose($out);}
 echo "Private copy + GUID + authorization + hash + revoke: OK\n";
}finally{
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($it as $file){$file->isDir()?rmdir($file->getPathname()):unlink($file->getPathname());}
 rmdir($dir);
}
