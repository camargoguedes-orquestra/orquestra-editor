<?php
declare(strict_types=1);
require __DIR__.'/../src/TemporaryDownloadBroker.php';
use Orquestra\SecureShare\TemporaryDownloadBroker;
$root=sys_get_temp_dir().'/orq-'.bin2hex(random_bytes(8));
mkdir($root,0700,true);
$source=$root.'/source.pdf';
file_put_contents($source,"teste sha256\n");
$grant=['expires_at'=>time()+300,'sha256'=>hash_file('sha256',$source),'original_name'=>'Contrato.pdf'];
$allowed=true;
$b=new TemporaryDownloadBroker($root.'/stage',
  fn($id)=>$id==='1'?$grant:null,
  fn($g,$actor)=>$actor==='pessoa-1'&&$GLOBALS['allowed'],
  fn($g)=>fopen($GLOBALS['source'],'rb'),
  2000,900);
$t=$b->prepare('1','pessoa-1');
assert(preg_match('/^[a-f0-9-]{36}$/',$t['ticket'])===1);
$out=fopen('php://temp','w+b');
$info=$b->downloadTo($t['ticket'],'pessoa-1',$out);
rewind($out);
assert(stream_get_contents($out)===file_get_contents($source));
assert($info['originalName']==='Contrato.pdf');
try {$b->downloadTo('../etc/passwd','pessoa-1',fopen('php://temp','w+b'));throw new Exception('Traversal');} catch(RuntimeException $e) {}
$allowed=false;
try {$b->downloadTo($t['ticket'],'pessoa-1',fopen('php://temp','w+b'));throw new Exception('Revocation');} catch(RuntimeException $e) {}
$allowed=true;
file_put_contents($root.'/stage/'.$t['ticket'].'.bin','adulterado');
try {$b->downloadTo($t['ticket'],'pessoa-1',fopen('php://temp','w+b'));throw new Exception('Hash');} catch(RuntimeException $e) {}
foreach (glob($root.'/stage/*') as $f) unlink($f);
rmdir($root.'/stage');unlink($source);rmdir($root);
echo "OK: staging, hash, revocation and traversal\n";
