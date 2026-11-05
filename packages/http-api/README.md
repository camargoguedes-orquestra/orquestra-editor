# Orquestra HTTP API (controller sem framework)

**Não é um servidor HTTP autônomo nem API pública pronta para produção.** `DocumentApi::dispatch` fornece uma camada testável de rotas e regras, mas o sistema hospedeiro deve autenticar a requisição, validar CSRF, aplicar rate limits, receber uploads via `$_FILES`, criar streams, converter retornos em cabeçalhos HTTP e prover a política ACL.

## Contratos
`dispatch($method,$path,$trustedPrincipal,$request,$uploadStream)` retorna `['status'=>int,'body'=>array]`.

Principal confiável: `['tenantId'=>'id resolvido na sessão','actorId'=>'id autenticado']`, **nunca do corpo da requisição**.

Rotas relativas ao controller:
- `GET /documents`: documentos acessíveis ao principal.
- `POST /documents`: upload multipart validado por perfil no servidor.
- `GET /documents/{id}`, `GET /documents/{id}/versions`.
- `POST /documents/{id}/links`: exige ACL do documento e do contexto destino.
- `POST /documents/{id}/share`: retorna token ao criador; envio via e-mail/telefone depende de adaptador.
- `DELETE /documents/{id}`: exclusão lógica.

Veja `tests/api-sqlite.php` para inicializar com PDO e permissões simuladas. Todo endpoint retorna somente metadados autorizados, sem `objectKey`.

## Exemplo de dispatch dentro de um framework PHP
```php
$principal = [
  'tenantId' => $session->verifiedTenantId(),
  'actorId' => $session->verifiedActorId()
];
$result = $api->dispatch($_SERVER['REQUEST_METHOD'], $route, $principal, $parsedBody, $stream);
http_response_code($result['status']);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($result['body'], JSON_THROW_ON_ERROR);
```

**Atenção:** `$session`, `$api`, `$route`, `$parsedBody` e `$stream` são fornecidos pelo host. Este trecho é ilustrativo, não é arquivo de endpoint pronto. Uma aplicação que simplesmente retorne true no ACL estará insegura.

## Recursos ainda não conectados
Download seguro HTTP, convite/OTP, REST de solicitação, busca indexada e assinatura/OCR. Exigir testes de integração end-to-end antes de disponibilização pública.
