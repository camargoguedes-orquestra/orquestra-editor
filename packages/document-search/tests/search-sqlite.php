<?php
declare(strict_types=1);
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){echo "SKIP pdo_sqlite\n";exit(0);}
require __DIR__.'/../../document-core/src/PdoDocumentCatalog.php';
require __DIR__.'/../src/PdoSearchIndex.php';
$pdo=new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec(file_get_contents(__DIR__.'/../../document-core/migrations/sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../migrations/sqlite.sql'));
$repo=new Orquestra\DocumentCore\PdoDocumentCatalog($pdo);
$id='f30c5a61-1234-4a00-8b66-443300001111';
$repo->create(['id'=>$id,'tenantId'=>'t1','actorId'=>'a','originalName'=>'doc.txt','displayName'=>'Documento',
'objectKey'=>str_repeat('0',32),'sha256'=>str_repeat('a',64),'mime'=>'text/plain','extension'=>'txt','size'=>120]);
$index=new Orquestra\DocumentSearch\PdoSearchIndex($pdo);
$index->index('t1',$id,'Contrato assinado com pessoa autorizada',['os'=>'1258']);
if(count($index->search('t1','Contrato',fn()=>true))!==1)throw new RuntimeException('Nao pesquisou');
if(count($index->search('t1','1258',fn()=>true))!==1)throw new RuntimeException('Metadado');
if(count($index->search('t2','Contrato',fn()=>true))!==0)throw new RuntimeException('Cross tenant');
if(count($index->search('t1','Contrato',fn()=>false))!==0)throw new RuntimeException('ACL bypass');
if(count($index->search('t1','%_',fn()=>true))!==0)throw new RuntimeException('Wildcards escapados');
try{$index->index('t2',$id,'Nao permitido');throw new RuntimeException('Index bypass');}
catch(RuntimeException $e){if($e->getMessage()!=='Documento nao pertence ao tenant')throw $e;}
$index->remove('t1',$id);
if(count($index->search('t1','Contrato',fn()=>true))!==0)throw new RuntimeException('Exclusao indice');
echo "Search index tenant + ACL + LIKE escapado: OK\n";
