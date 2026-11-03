<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
orq_headers();
orq_authorize();

/*
 * Documento em JSON: { id, html, comments[], updatedAt }.
 * Cada salvamento guarda a versão anterior em versions/<id>/ (histórico de versões).
 *   POST                         grava { id, html, comments? }
 *   GET  ?id=X                   devolve a versão atual
 *   GET  ?id=X&versions=1        lista as versões anteriores
 *   GET  ?id=X&version=V         devolve uma versão anterior
 */
const ORQ_MAX_VERSIONS = 50;
const ORQ_ID_PATTERN = '/^[a-zA-Z0-9_.-]{1,90}$/D';
const ORQ_VERSION_PATTERN = '/^\d{8}T\d{6}Z-[a-f0-9]{6}$/D';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$configuredDir = getenv('ORQUESTRA_DATA_DIR');
$dir = (is_string($configuredDir) && $configuredDir !== '')
    ? $configuredDir
    : sys_get_temp_dir() . '/orquestra-editor-demo-documents'; // Nunca armazenar HTML dentro do diretório público.
if (getenv('ORQUESTRA_UPLOAD_TOKEN') && !$configuredDir) {
    orq_response(503, ['error' => 'Configure ORQUESTRA_DATA_DIR fora da pasta pública do servidor.']);
}

function orq_versions_dir(string $dir, string $id): string
{
    return $dir . '/versions/' . $id;
}

/** Comentários: somente estrutura conhecida, textos limitados. */
function orq_clean_comments(mixed $list): array
{
    if (!is_array($list)) {
        return [];
    }
    $text = static fn (mixed $v, int $max): string => mb_substr(is_string($v) ? $v : '', 0, $max);
    $out = [];
    foreach (array_slice($list, 0, 500) as $c) {
        if (!is_array($c) || !isset($c['id']) || !is_string($c['id']) || !preg_match('/^[\w.-]{1,80}$/D', $c['id'])) {
            continue;
        }
        $replies = [];
        foreach (array_slice(is_array($c['replies'] ?? null) ? $c['replies'] : [], 0, 200) as $r) {
            if (!is_array($r)) {
                continue;
            }
            $replies[] = [
                'id' => $text($r['id'] ?? '', 80),
                'author' => $text($r['author'] ?? '', 120),
                'text' => $text($r['text'] ?? '', 5000),
                'createdAt' => $text($r['createdAt'] ?? '', 40),
            ];
        }
        $out[] = [
            'id' => $c['id'],
            'author' => $text($c['author'] ?? '', 120),
            'text' => $text($c['text'] ?? '', 5000),
            'quote' => $text($c['quote'] ?? '', 300),
            'createdAt' => $text($c['createdAt'] ?? '', 40),
            'resolved' => (bool)($c['resolved'] ?? false),
            'replies' => $replies,
        ];
    }
    return $out;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input', false, null, 0, 4_000_001);
    if ($raw === false || strlen($raw) > 4_000_000) {
        orq_response(413, ['error' => 'Documento maior que 4 MB.']);
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload) || !isset($payload['id'], $payload['html']) || !is_string($payload['html'])) {
        orq_response(400, ['error' => 'JSON inválido: informe id e html.']);
    }
    $id = (string)$payload['id'];
    if (!preg_match(ORQ_ID_PATTERN, $id)) {
        orq_response(400, ['error' => 'ID do documento inválido.']);
    }
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        orq_response(500, ['error' => 'Falha na pasta de documentos.']);
    }
    $file = $dir . '/' . $id . '.json';

    // Guarda a versão atual antes de sobrescrever.
    if (is_file($file)) {
        $vdir = orq_versions_dir($dir, $id);
        if (!is_dir($vdir) && !@mkdir($vdir, 0700, true) && !is_dir($vdir)) {
            orq_response(500, ['error' => 'Falha na pasta de versões.']);
        }
        $version = gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(3));
        @copy($file, $vdir . '/' . $version . '.json');
        $old = glob($vdir . '/*.json') ?: [];
        sort($old);
        foreach (array_slice($old, 0, max(0, count($old) - ORQ_MAX_VERSIONS)) as $expired) {
            @unlink($expired);
        }
    }

    $data = [
        'id' => $id,
        'html' => $payload['html'],
        'comments' => orq_clean_comments($payload['comments'] ?? []),
        'updatedAt' => gmdate('c'),
    ];
    $output = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (file_put_contents($file, $output, LOCK_EX) === false) {
        orq_response(500, ['error' => 'Não foi possível salvar.']);
    }
    orq_response(200, ['ok' => true, 'id' => $id, 'updatedAt' => $data['updatedAt']]);
}

if ($method === 'GET') {
    $id = (string)($_GET['id'] ?? '');
    if (!preg_match(ORQ_ID_PATTERN, $id)) {
        orq_response(400, ['error' => 'ID inválido.']);
    }

    if (isset($_GET['versions'])) {
        $items = [];
        foreach (glob(orq_versions_dir($dir, $id) . '/*.json') ?: [] as $path) {
            $version = basename($path, '.json');
            if (!preg_match(ORQ_VERSION_PATTERN, $version)) {
                continue;
            }
            $json = json_decode((string)file_get_contents($path), true);
            $items[] = [
                'version' => $version,
                'updatedAt' => is_array($json) ? ($json['updatedAt'] ?? null) : null,
                'bytes' => filesize($path),
            ];
        }
        usort($items, static fn ($a, $b) => strcmp($b['version'], $a['version']));
        orq_response(200, ['id' => $id, 'versions' => $items]);
    }

    $filename = $dir . '/' . $id . '.json';
    if (isset($_GET['version'])) {
        $version = (string)$_GET['version'];
        if (!preg_match(ORQ_VERSION_PATTERN, $version)) {
            orq_response(400, ['error' => 'Versão inválida.']);
        }
        $filename = orq_versions_dir($dir, $id) . '/' . $version . '.json';
    }
    if (!is_file($filename)) {
        orq_response(404, ['error' => 'Documento não encontrado.']);
    }
    $raw = file_get_contents($filename);
    if ($raw === false) {
        orq_response(500, ['error' => 'Falha na leitura.']);
    }
    echo $raw;
    exit;
}

header('Allow: GET, POST');
orq_response(405, ['error' => 'Método não permitido.']);
