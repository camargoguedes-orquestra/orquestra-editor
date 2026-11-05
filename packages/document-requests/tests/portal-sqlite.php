<?php
declare(strict_types=1);
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){echo "SKIP PDO SQLite\n";exit(0);}
require __DIR__.'/../../document-core/src/PdoDocumentCatalog.php';
require __DIR__.'/../src/RequestWorkflow.php';
require __DIR__.'/../src/PdoRequestPortal.php';
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec(file_get_contents(__DIR__.'/../../document-core/migrations/sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../migrations/sqlite.sql'));
$catalog=new Orquestra\DocumentCore\PdoDocumentCatalog($pdo);
$doc='7a1f1038-e92b-4d12-9bdf-000000000110';
$catalog->create(['id'=>$doc,'tenantId'=>'t1','actorId'=>'admin','originalName'=>'a.pdf',
'displayName'=>'A','objectKey'=>str_repeat('a',32),'sha256'=>str_repeat('b',64),
'mime'=>'application/pdf','extension'=>'pdf','size'=>9]);
$p=new Orquestra\DocumentRequests\PdoRequestPortal($pdo);
$expires=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('+7 days');
$r=$p->issue('t1','admin','ordem_servico','1258','cliente@example.test',['contrato','comprovante'],$expires,fn()=>true);
$v=$p->recipientView($r['token'],'cliente',fn($grant,$actor)=>$actor==='cliente');
if($v['status']!=='sent')throw new RuntimeException('Status inicial');
try{$p->recipientView($r['token'],'intruso',fn($grant,$actor)=>$actor==='cliente');throw new RuntimeException('Access bypass');}
catch(RuntimeException $e){if($e->getMessage()!=='Acesso negado')throw $e;}
$out=$p->submit('t1',$r['id'],'cliente',[['type'=>'contrato','documentId'=>$doc]],fn()=>true);
if($out['status']!=='sent'||$out['missing']!==['comprovante'])throw new RuntimeException('Submissao parcial');
$out=$p->submit('t1',$r['id'],'cliente',[['type'=>'comprovante','documentId'=>$doc]],fn()=>true);
if($out['status']!=='received')throw new RuntimeException('Concluiu indevidamente');
$p->review('t1',$r['id'],'revisor','under_review',fn()=>true);
$p->review('t1',$r['id'],'revisor','approved',fn()=>true);
if($p->get('t1',$r['id'],fn()=>true)['status']!=='approved')throw new RuntimeException('Nao aprovou');
if($p->get('t2',$r['id'],fn()=>true)!==null)throw new RuntimeException('Cross-tenant');
echo "Request portal partial + approval + tenant + identity: OK\n";
