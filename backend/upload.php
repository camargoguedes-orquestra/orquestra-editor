<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
orq_headers();orq_method('POST');orq_authorize();

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) orq_response(400,['error'=>'Envie o arquivo no campo file.']);
$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) orq_response(400,['error'=>'Falha no upload do arquivo.']);
$size = (int)($file['size'] ?? 0);
if ($size < 1 || $size > 15 * 1024 * 1024) orq_response(413,['error'=>'O arquivo deve ter no máximo 15 MB.']);
$tmp = (string)($file['tmp_name'] ?? '');
if (!is_uploaded_file($tmp)) orq_response(400,['error'=>'Arquivo temporário inválido.']);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
$allowed = ['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','image/gif'=>'gif'];
if (!is_string($mime) || !isset($allowed[$mime])) orq_response(415,['error'=>'Formato não suportado. Use PNG, JPEG, WEBP ou GIF.']);
$info = @getimagesize($tmp);
if (!$info || !isset($info[0],$info[1]) || $info[0] < 1 || $info[1] < 1) orq_response(422,['error'=>'Imagem inválida ou danificada.']);
if ($info[0] > 8192 || $info[1] > 8192 || $info[0] * $info[1] > 25_000_000) orq_response(413,['error'=>'Resolução superior ao limite permitido.']);
if (($info['mime'] ?? '') !== $mime) orq_response(415,['error'=>'Assinatura de imagem incompatível.']);
// O navegador não é fonte confiável para dimensões. Para perfis fixos, conferir
// pixels e MIME efetivamente recebidos, antes de publicar o arquivo.
$profiles = [
    'banner-site' => ['width' => 1200, 'height' => 630, 'mime' => 'image/webp'],
    'avatar' => ['width' => 400, 'height' => 400, 'mime' => 'image/webp'],
];
$custom = getenv('ORQUESTRA_IMAGE_PROFILES_JSON');
if (is_string($custom) && $custom !== '') {
    $decoded = json_decode($custom, true);
    if (!is_array($decoded)) orq_response(500, ['error' => 'Configuração de perfis inválida.']);
    $profiles = $decoded;
}
$profile = trim((string)($_POST['profile'] ?? ''));
if ($profile !== '') {
    if (!preg_match('/^[a-z0-9_-]{1,50}$/D', $profile) || !isset($profiles[$profile]) || !is_array($profiles[$profile]))
        orq_response(422, ['error' => 'Perfil de imagem desconhecido.']);
    $p = $profiles[$profile];
    $expectedW = (int)($p['width'] ?? 0);
    $expectedH = (int)($p['height'] ?? 0);
    $expectedMime = (string)($p['mime'] ?? '');
    if ($expectedW < 1 || $expectedH < 1 || !in_array($expectedMime, ['image/png','image/jpeg','image/webp'], true))
        orq_response(500, ['error' => 'Perfil de imagem mal configurado.']);
    if ((int)$info[0] !== $expectedW || (int)$info[1] !== $expectedH || $mime !== $expectedMime)
        orq_response(422, ['error' => "Imagem incompatível com o perfil {$profile}. Envie {$expectedW} × {$expectedH} px em {$expectedMime}."]);
} elseif (getenv('ORQUESTRA_REQUIRE_IMAGE_PROFILE') === '1') {
    orq_response(422,['error' => 'É obrigatório informar o perfil de imagem.']);
}
$dir = __DIR__ . '/uploads';
if (!is_dir($dir) && !@mkdir($dir,0700,true) && !is_dir($dir)) orq_response(500,['error'=>'Não foi possível criar o diretório de upload.']);
$filename = bin2hex(random_bytes(20)).'.'.$allowed[$mime];
$path = $dir.DIRECTORY_SEPARATOR.$filename;
if (!move_uploaded_file($tmp,$path)) orq_response(500,['error'=>'Não foi possível gravar a imagem.']);
@chmod($path,0644);
$base = str_replace('\\','/',dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/backend/upload.php')));
if ($base === '/') $base = '';
$url = $base.'/uploads/'.$filename;
orq_response(201, ['ok'=>true,'url'=>$url,'name'=>$filename,'mime'=>$mime,'bytes'=>$size,'width'=>$info[0],'height'=>$info[1],'profile'=>$profile]);
