<?php
declare(strict_types=1);
require __DIR__.'/../src/LocalTextExtractor.php';
use Orquestra\DocumentOCR\LocalTextExtractor;
$p=tempnam(sys_get_temp_dir(),'orqocr_');file_put_contents($p,'Contrato OS 1258');
try {
 $r=(new LocalTextExtractor())->extract($p,'txt');
 if($r['text']!=='Contrato OS 1258'||$r['source']!=='native-text')throw new RuntimeException('Falha OCR/texto');
 try{(new LocalTextExtractor())->extract($p,'pdf');throw new RuntimeException('Falha fechada ausente');}
 catch(RuntimeException $e){if(!str_contains($e->getMessage(),'indisponivel'))throw $e;}
 echo "Extracao local de texto: OK\n";
}finally{@unlink($p);}
