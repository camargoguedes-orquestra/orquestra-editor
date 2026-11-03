<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
orq_headers();orq_authorize();

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$configuredDir = getenv('ORQUESTRA_DATA_DIR');
$dir = (is_string($configuredDir) && $configuredDir !== '')
    ? $configuredDir
    : sys_get_temp_dir() . '/orquestra-editor-demo-documents'; // Nunca armazenar HTML dentro do diretório público.
if (getenv('ORQUESTRA_UPLOAD_TOKEN') && !$configuredDir) {
    orq_response(503,['error'=>'Configure ORQUESTRA_DATA_DIR fora da pasta pública do servidor.']);
}
if ($method === 'POST') {
    $raw = file_get_contents('php://input',false,null,0,2_000_001);
    if ($raw === false || strlen($raw) > 2_000_000) orq_response(413,['error'=>'Documento maior que 2 MB.']);
    $payload = json_decode($raw,true);
    if (!is_array($payload) || !isset($payload['id'],$payload['html']) || !is_string($payload['html'])) orq_response(400,['error'=>'JSON inválido: informe id e html.']);
    $id = (string)$payload['id'];
    if (!preg_match('/^[a-zA-Z0-9_.-]{1,90}$/D',$id)) orq_response(400,['error'=>'ID do documento inválido.']);
    if (!is_dir($dir) && !@mkdir($dir,0700,true) && !is_dir($dir)) orq_response(500,['error'=>'Falha na pasta de documentos.']);
    $data = ['id'=>$id,'html'=>$payload['html'],'updatedAt'=>gmdate('c')];
    $output = json_encode($data,JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (file_put_contents($dir.'/'.$id.'.json',$output,LOCK_EX) === false) orq_response(500,['error'=>'Não foi possível salvar.']);
    orq_response(200,['ok'=>true,'id'=>$id,'updatedAt'=>$data['updatedAt']]);
}
if ($method === 'GET') {
    $id = (string)($_GET['id'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9_.-]{1,90}$/D',$id)) orq_response(400,['error'=>'ID inválido.']);
    $filename = $dir.'/'.$id.'.json';
    if (!is_file($filename)) orq_response(404,['error'=>'Documento não encontrado.']);
    $raw = file_get_contents($filename);
    if ($raw === false) orq_response(500,['error'=>'Falha na leitura.']);
    echo $raw;exit;
}
header('Allow: GET, POST');orq_response(405,['error'=>'Método não permitido.']);
