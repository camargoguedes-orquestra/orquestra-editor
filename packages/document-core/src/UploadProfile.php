<?php
declare(strict_types=1);
namespace Orquestra\DocumentCore;
use RuntimeException;

/**
 * Validacao definitiva de tamanho/extension/MIME no servidor.
 * O cliente nunca escolhe os tetos do proprio perfil.
 */
final class UploadProfile {
    private const DEFAULT_MIME = [
        'pdf' => ['application/pdf'],
        'png' => ['image/png'], 'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'],
        'webp' => ['image/webp'], 'gif' => ['image/gif'],
        'txt' => ['text/plain'], 'csv' => ['text/plain','text/csv','application/csv','application/vnd.ms-excel'],
        'json' => ['application/json','text/plain'], 'xml' => ['application/xml','text/xml','text/plain'],
        'docx' => ['application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xlsx' => ['application/zip','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'pptx' => ['application/zip','application/vnd.openxmlformats-officedocument.presentationml.presentation']
    ];
    public function __construct(private array $config) {
        if (!isset($config['extensions']) || !is_array($config['extensions']) || $config['extensions'] === [])
            throw new RuntimeException('Perfil sem extensoes');
        foreach ($config['extensions'] as $ext => $max) {
            if (!is_string($ext) || !preg_match('/^[a-z0-9]{1,12}$/D',$ext) || !is_int($max) || $max < 1)
                throw new RuntimeException('Configuracao de extensao invalida');
        }
    }
    public function maxBytes(): int { return max($this->config['extensions']); }
    public function validate(string $originalName, int $size, string $mime, string $firstBytes): string {
        $base = basename(str_replace('\\','/',$originalName));
        if ($base === '' || $base[0] === '.' || strlen($base) > 220 || preg_match('/[\x00-\x1f\x7f]/', $base))
            throw new RuntimeException('Nome de arquivo invalido');
        $ext = strtolower(pathinfo($base, PATHINFO_EXTENSION));
        $ceiling = $this->config['extensions'][$ext] ?? null;
        if ($ceiling === null || $size < 1 || $size > $ceiling) throw new RuntimeException('Extensao/tamanho nao autorizado');
        $allowed = $this->config['mimes'][$ext] ?? self::DEFAULT_MIME[$ext] ?? null;
        if (!is_array($allowed) || !in_array($mime,$allowed,true)) throw new RuntimeException('MIME do conteudo nao autorizado');
        if ($ext === 'pdf' && !str_starts_with($firstBytes, '%PDF-')) throw new RuntimeException('PDF sem assinatura magica');
        if (($ext === 'png') && !str_starts_with($firstBytes, "\x89PNG\r\n\x1a\n")) throw new RuntimeException('PNG invalido');
        if (in_array($ext,['docx','xlsx','pptx'],true) && !str_starts_with($firstBytes,'PK')) throw new RuntimeException('Office sem estrutura ZIP');
        if (($this->config['requireDescription'] ?? false) && trim((string)($this->config['description'] ?? '')) === '')
            throw new RuntimeException('Descricao obrigatoria');
        return $ext;
    }
}
