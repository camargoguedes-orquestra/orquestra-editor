<?php
declare(strict_types=1);
namespace Orquestra\DocumentOCR;
use RuntimeException;

/**
 * Extracao local SEM IA/tokens. Execucao de binarios externos desativada por padrao.
 * O host somente deve chamar com arquivos privados ja validados, nunca path enviado por HTTP.
 */
final class LocalTextExtractor {
    public function __construct(private ?string $pdfToText=null,private ?string $tesseract=null,
      private int $maxSourceBytes=20971520,private int $maxOutputBytes=2097152,private int $timeout=12) {}
    public function extract(string $path,string $extension):array {
        if(!is_file($path)||is_link($path)||!is_readable($path))throw new RuntimeException('Fonte invalida');
        $size=filesize($path);
        if($size===false||$size<1||$size>$this->maxSourceBytes)throw new RuntimeException('Fonte excede limite');
        $ext=strtolower($extension);
        $text='';
        $method='none';
        if(in_array($ext,['txt','md','csv','json','xml','log','html'],true)){
          $text=file_get_contents($path,false,null,0,$this->maxOutputBytes+1);
          if($text===false)throw new RuntimeException('Leitura falhou');
          $method='native-text';
        } elseif($ext==='pdf'&&$this->pdfToText!==null) {
          $text=$this->command([$this->pdfToText,'-layout',$path,'-']);$method='pdftotext';
        } elseif(in_array($ext,['jpg','jpeg','png','tif','tiff','webp'],true)&&$this->tesseract!==null) {
          $text=$this->command([$this->tesseract,$path,'stdout','-l','por+eng']);$method='tesseract';
        } else throw new RuntimeException('Extrator indisponivel para formato/ambiente');
        if(strlen($text)>$this->maxOutputBytes)throw new RuntimeException('Saida textual excede limite');
        return ['text'=>$text,'source'=>$method,'confidence'=>null,'retention'=>'host-policy'];
    }
    private function command(array $argv):string {
        $bin=$argv[0];
        if(!is_string($bin)||!str_starts_with($bin,'/')||!is_executable($bin))throw new RuntimeException('Binario local nao configurado');
        $pipes=[];
        $process=proc_open($argv,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true]);
        if(!is_resource($process))throw new RuntimeException('Nao iniciou extrator');
        fclose($pipes[0]);
        stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);
        $stdout='';$stderr='';$started=microtime(true);$exit=null;
        try {
          while(true){
            $stdout.=stream_get_contents($pipes[1]);$stderr.=stream_get_contents($pipes[2]);
            if(strlen($stdout)>$this->maxOutputBytes||strlen($stderr)>8192)throw new RuntimeException('Limite de processo');
            $status=proc_get_status($process);
            if(!$status['running']){$exit=$status['exitcode'];break;}
            if(microtime(true)-$started>$this->timeout)throw new RuntimeException('Timeout de extracao');
            usleep(50000);
          }
          $stdout.=stream_get_contents($pipes[1]);
          if($exit!==0)throw new RuntimeException('Extrator falhou; log restrito ao administrador');
          return $stdout;
        }finally{
          $status=proc_get_status($process);
          if($status['running'])proc_terminate($process);
          foreach([1,2] as $i)fclose($pipes[$i]);
          proc_close($process);
        }
    }
}
