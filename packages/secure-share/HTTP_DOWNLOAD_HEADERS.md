# Envio HTTP de download autorizado

`PdoShareDownloadService` fornece a preparacao da copia privada e os bytes; a aplicacao hospedeira deve usar autenticação confiável, OTP quando exigido, verificação de tenant, CSRF para preparacao, limitador de taxa e auditoria.

```php
// Primeiro autorize quem recebe (sessao+OTP etc.). Nao construa actor com dados do request.
$details = $shareService->describe($ticket, $authenticatedActorId);
// Sanitize Content-Disposition conforme RFC 6266/RFC 5987.
// Evitar CRLF, aspas e percent encodings indevidos.
$filename = rawurlencode($details['originalName']);
header('Content-Type: application/octet-stream');
header("Content-Disposition: attachment; filename*=UTF-8''".$filename);
header('Content-Length: '.$details['bytes']);
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; sandbox");
$out=fopen('php://output','wb');
$shareService->downloadTo($ticket,$authenticatedActorId,$out);
fclose($out);
```

Em produção, reserve o contador de downloads antes de enviar cabeçalhos (o exemplo anterior não inclui esse mecanismo de reserva). Falha de rede ou concorrência deve ser tratada como operação auditável. O arquivo original e sua storage_key nunca são enviados ao navegador; somente bytes de uma copia efêmera são transmitidos. A pasta staging fica fora do webroot e é eliminada por cron. Um UUID não substitui a verificação de identidade e ACL.

Se um usuário baixar legitimamente um arquivo, ele poderá preservar cópias locais: a revogação impede acessos futuros no servidor, não apaga arquivos já entregues.
