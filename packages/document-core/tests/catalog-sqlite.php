<?php
declare(strict_types=1);
if (!in_array('sqlite',PDO::getAvailableDrivers(),true)) {echo "SKIP: pdo_sqlite indisponivel\n";exit(0);}
require __DIR__.'/../src/PdoDocumentCatalog.php';
require __DIR__.'/../../secure-share/src/PdoShareGrants.php';
use Orquestra\DocumentCore\PdoDocumentCatalog;
use Orquestra\SecureShare\PdoShareGrants;
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec(file_get_contents(__DIR__.'/../migrations/sqlite.sql'));
$repo=new PdoDocumentCatalog($pdo);
$id='550e8400-e29b-41d4-a716-446655440000';
$repo->create(['id'=>$id,'tenantId'=>'tenant-A','actorId'=>'user-A','originalName'=>'contrato.pdf',
 'displayName'=>'Contrato','description'=>'Documento inicial','objectKey'=>str_repeat('a',32),
 'sha256'=>str_repeat('b',64),'size'=>9,'mime'=>'application/pdf','extension'=>'pdf']);
if($repo->find('tenant-A',$id)['display_name']!=='Contrato')throw new RuntimeException('Nao inseriu');
if($repo->find('tenant-B',$id)!==null)throw new RuntimeException('Cross-tenant');
if(count($repo->listDocuments('tenant-A'))!==1)throw new RuntimeException('Lista');
$repo->link('tenant-A',$id,'ordem_servico','1258','user-A');
if(count($repo->linked('tenant-A','ordem_servico','1258'))!==1)throw new RuntimeException('Vinculo');
$repo->addVersion('tenant-A',$id,['originalName'=>'contrato-v2.pdf','mime'=>'application/pdf',
 'extension'=>'pdf','size'=>10,'sha256'=>str_repeat('c',64),'objectKey'=>str_repeat('d',32)],'user-A');
if(count($repo->versions('tenant-A',$id))!==2)throw new RuntimeException('Versionamento');
$shares=new PdoShareGrants($pdo,7,30);
$s=$shares->issue('tenant-A',$id,'user-A',['view','download'],'externo@example.test');
if($shares->authorize($s['token'],'externo','view',fn()=>true,fn($tenant)=>$tenant==='tenant-A')['tenant_id']!=='tenant-A')
  throw new RuntimeException('Grant');
try{$shares->authorize($s['token'],'externo','download',fn()=>false,fn()=>true);throw new RuntimeException('Identity bypass');}
catch(RuntimeException $e){if($e->getMessage()!=='Acesso negado')throw $e;}
if(!$shares->recordDownload('tenant-A',$s['id']))throw new RuntimeException('Download counters');
if(!$shares->revoke('tenant-A',$s['id']))throw new RuntimeException('Revoke');
try{$shares->authorize($s['token'],'externo','view',fn()=>true,fn()=>true);throw new RuntimeException('Revoke bypass');}
catch(RuntimeException $e){if($e->getMessage()!=='Acesso negado')throw $e;}
if(!$repo->softDelete('tenant-A',$id) || $repo->find('tenant-A',$id)!==null)throw new RuntimeException('Soft delete');
echo "PDO catalog + share grants SQLite: OK\n";
