<?php
declare(strict_types=1);
namespace Orquestra\DocumentCore;
use RuntimeException;

/**
 * Storage privado para anexos imutaveis. Nunca exponha root(), objectKey ou paths no HTTP.
 * O diretorio deve ficar FORA do DocumentRoot e nao pode ser exposto por alias.
 */
final class PrivateFilesystemStorage {
    private string $root;
    public function __construct(string $root) {
        if ($root === '' || !str_starts_with($root, DIRECTORY_SEPARATOR)) throw new RuntimeException('Diretorio absoluto necessario');
        if (is_link($root)) throw new RuntimeException('Raiz symlink proibida');
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) throw new RuntimeException('Falha ao criar storage');
        $real = realpath($root);
        if ($real === false || !is_dir($real) || is_link($root)) throw new RuntimeException('Storage invalido');
        $this->root = $real;
    }
    private function directory(string $tenant): string {
        if ($tenant === '' || strlen($tenant) > 256) throw new RuntimeException('Tenant invalido');
        $hash = hash('sha256', $tenant);
        $path = $this->root . DIRECTORY_SEPARATOR . substr($hash, 0, 2) . DIRECTORY_SEPARATOR . $hash;
        $p1 = dirname($path);
        foreach ([$p1, $path] as $dir) {
            if (is_link($dir)) throw new RuntimeException('Symlink nao permitido');
            if (!is_dir($dir) && !mkdir($dir, 0700) && !is_dir($dir)) throw new RuntimeException('Falha no diretorio privado');
            if (is_link($dir)) throw new RuntimeException('Symlink nao permitido');
        }
        return $path;
    }
    private static function key(string $key): string {
        if (!preg_match('/^[a-f0-9]{32}$/D', $key)) throw new RuntimeException('Chave de objeto invalida');
        return $key;
    }
    /** @param resource $input Stream previamente validado/autorizado pelo host. */
    public function put(string $tenant, string $key, mixed $input, int $maxBytes): array {
        if (!is_resource($input) || $maxBytes < 1) throw new RuntimeException('Stream ou limite invalido');
        $dir = $this->directory($tenant);
        $destination = $dir . DIRECTORY_SEPARATOR . self::key($key) . '.bin';
        if (file_exists($destination) || is_link($destination)) throw new RuntimeException('Objeto ja existe');
        $tmp = $dir . DIRECTORY_SEPARATOR . bin2hex(random_bytes(16)) . '.part';
        $out = fopen($tmp, 'x+b');
        if ($out === false) throw new RuntimeException('Nao foi possivel criar temporario');
        @chmod($tmp, 0600);
        $bytes = 0;
        $hash = hash_init('sha256');
        try {
            while (!feof($input)) {
                $chunk = fread($input, 65536);
                if ($chunk === false || ($chunk === '' && !feof($input))) throw new RuntimeException('Erro de leitura');
                $bytes += strlen($chunk);
                if ($bytes > $maxBytes) throw new RuntimeException('Limite de tamanho excedido');
                hash_update($hash, $chunk);
                $len = strlen($chunk); $offset = 0;
                while ($offset < $len) {
                    $written = fwrite($out, substr($chunk, $offset));
                    if ($written === false || $written === 0) throw new RuntimeException('Erro de gravacao');
                    $offset += $written;
                }
            }
            if ($bytes === 0) throw new RuntimeException('Arquivo vazio');
            if (!fflush($out)) throw new RuntimeException('Nao foi possivel sincronizar temporario');
            fclose($out); $out = null;
            // Hard-link atomico impede sobrescrita acidental entre processos concorrentes.
            if (!link($tmp, $destination)) throw new RuntimeException('Conflito de chave no storage');
            @chmod($destination, 0600);
            return ['objectKey' => $key, 'bytes' => $bytes, 'sha256' => hash_final($hash)];
        } finally {
            if (is_resource($out)) fclose($out);
            @unlink($tmp);
        }
    }
    /** @return resource */
    public function read(string $tenant, string $key): mixed {
        $path = $this->directory($tenant) . DIRECTORY_SEPARATOR . self::key($key) . '.bin';
        if (!is_file($path) || is_link($path)) throw new RuntimeException('Objeto indisponivel');
        $stream = fopen($path, 'rb');
        if ($stream === false) throw new RuntimeException('Objeto nao legivel');
        return $stream;
    }
    public function delete(string $tenant, string $key): void {
        $path = $this->directory($tenant) . DIRECTORY_SEPARATOR . self::key($key) . '.bin';
        if (is_link($path)) throw new RuntimeException('Objeto symlink');
        if (is_file($path) && !unlink($path)) throw new RuntimeException('Falha ao remover objeto');
    }
}
