<?php
declare(strict_types=1);

/** Exemplo de backend. Autenticação de demonstração SOMENTE em loopback.
 * Em produção, configure ORQUESTRA_UPLOAD_TOKEN e controle também sessões,
 * autorização por documento, CSRF, quota por usuário e registro de auditoria.
 */
function orq_headers(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
}
function orq_response(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function orq_authorize(): void {
    $configured = getenv('ORQUESTRA_UPLOAD_TOKEN');
    $token = (string)($_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '');
    if (is_string($configured) && $configured !== '') {
        if ($token === '' || !hash_equals($configured, $token)) orq_response(401, ['error' => 'Credenciais ausentes ou inválidas.']);
        return;
    }
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    if (!in_array($ip, ['127.0.0.1', '::1'], true)) {
        orq_response(503, ['error' => 'Endpoint desativado em ambiente externo. Configure autenticação no servidor.']);
    }
}
function orq_method(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: '.$method);
        orq_response(405, ['error' => 'Método HTTP não permitido.']);
    }
}
