<?php
declare(strict_types=1);
require __DIR__.'/../src/PrivateFilesystemStorage.php';
require __DIR__.'/../src/UploadProfile.php';
require __DIR__.'/../src/DocumentIntake.php';
require __DIR__.'/../../document-audit/src/HashChain.php';
require __DIR__.'/../../document-rules/src/RulesEngine.php';
require __DIR__.'/../../document-requests/src/RequestWorkflow.php';
require __DIR__.'/../../document-signatures/src/SignatureEvidence.php';
use Orquestra\DocumentCore\PrivateFilesystemStorage;
use Orquestra\DocumentCore\UploadProfile;
use Orquestra\DocumentCore\DocumentIntake;
use Orquestra\DocumentAudit\HashChain;
use Orquestra\DocumentRules\RulesEngine;
use Orquestra\DocumentRequests\RequestWorkflow;
use Orquestra\DocumentSignatures\SignatureEvidence;

function check(bool $ok,string $message):void { if (!$ok) throw new RuntimeException($message); }
$dir=sys_get_temp_dir().'/orq-test-'.bin2hex(random_bytes(7));
mkdir($dir,0700);
try {
    $storage=new PrivateFilesystemStorage($dir);
    $intake=new DocumentIntake($storage);
    $profile=new UploadProfile(['extensions'=>['pdf'=>10000,'txt'=>2000]]);
    $data="%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
    $stream=fopen('php://temp','w+b'); fwrite($stream,$data);rewind($stream);
    $saved=null;
    $record=$intake->ingest('tenant-1','user-1','contratos','Contrato.pdf',$stream,$profile,
        fn($tenant,$actor,$prof)=>$tenant==='tenant-1' && $actor==='user-1',
        function($rec)use(&$saved){$saved=$rec;},
        ['displayName'=>'Contrato vigente']);
    fclose($stream);
    check($record['sha256']===hash('sha256',$data),'Hash de upload divergente');
    check($record['originalName']==='Contrato.pdf','Nome nao preservado');
    check($saved['id']===$record['id'],'Persistencia nao chamada');
    $read=$storage->read('tenant-1',$record['objectKey']);
    check(stream_get_contents($read)===$data,'Byte original alterado');
    fclose($read);
    try {$storage->read('tenant-2',$record['objectKey']);throw new RuntimeException('Tenant bypass');}
    catch (RuntimeException $e) {check(str_contains($e->getMessage(),'indisponivel'),'Isolamento tenant falhou');}
    $denied=fopen('php://temp','w+b'); fwrite($denied,$data);rewind($denied);
    try{$intake->ingest('tenant-1','visitor','contratos','Contrato.pdf',$denied,$profile,fn()=>false,fn()=>null);throw new RuntimeException('Auth bypass');}
    catch(RuntimeException $e){check(str_contains($e->getMessage(),'nao autorizado'),'Autorizacao nao bloqueou');}
    fclose($denied);
    $first=HashChain::append(str_repeat('0',64),['action'=>'upload','id'=>$record['id']]);
    $second=HashChain::append($first['hash'],['action'=>'view','actor'=>'user-1']);
    check(HashChain::verify([$first,$second]),'Cadeia valida rejeitada');
    $second['event']['actor']='intruso';
    check(!HashChain::verify([$first,$second]),'Alteracao da cadeia nao detectada');
    $rules=[['id'=>'os','enabled'=>true,'priority'=>1,
       'conditions'=>['extensions'=>['pdf'],'textContainsAny'=>['Ordem de Serviço'],
          'extract'=>['os'=>['pattern'=>'OS\\s*[:#-]?\\s*(\\d+)']]],
       'actions'=>['category'=>'ordem-servico','addTags'=>['oficina']]]];
    $classified=(new RulesEngine())->classify(['extension'=>'pdf','text'=>'Ordem de Serviço. OS: 1258'],$rules);
    check($classified['category']==='ordem-servico' && $classified['extract']['os']==='1258','Classificacao falhou');
    check(RequestWorkflow::transition('under_review','approved')==='approved','Fluxo rejeitado');
    try{RequestWorkflow::transition('draft','approved');throw new RuntimeException('Workflow bypass');}
    catch(RuntimeException $e){check(str_contains($e->getMessage(),'nao permitida'),'Workflow sem bloqueio');}
    check(SignatureEvidence::detectPdfMarkers('%PDF-1.7 /ByteRange [0 5 10 20]')['validationStatus']==='not_verified','Validade inventada');
    $storage->delete('tenant-1',$record['objectKey']);
    echo "DocumentCore + auditoria + regras + requests + assinaturas: OK\n";
} finally {
    $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
    foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}
    rmdir($dir);
}
