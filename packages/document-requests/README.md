# Orquestra Document Requests

Portal de solicitações **independente** com token aleatório, identidade externa validada por callback, checklist de documentos obrigatórios, envio parcial, revisão e aprovação/rejeição.

## Uso
Instale os esquemas do `document-core` e depois `migrations/{SGBD}.sql`. Integre `PdoRequestPortal` aos usuários e operações do sistema hospedeiro.

```php
use Orquestra\DocumentRequests\PdoRequestPortal;
$portal = new PdoRequestPortal($pdo);
$solicitacao = $portal->issue($tenant,$actor,'ordem_servico','1258',
  'cliente@example.test',['contrato','comprovante'],
  new DateTimeImmutable('+7 days'),
  fn($tenant,$actor,$type,$id) => $acl->canRequest($tenant,$actor,$type,$id));
```

O token deve ser encaminhado por canal autorizado; o link **não comprova identidade sozinho**. Implementar OTP ou autenticação equivalente na integração. `submit` recebe IDs de documentos já ingeridos e precisa de callback que comprove a propriedade/autorização **para cada documento**, não somente o status da solicitação.

## Limitações
Lembretes, envio por SMTP/WhatsApp/SMS, formulários dinâmicos completos, histórico criptográfico de tramitação e uploads externos HTTP ainda dependem de adaptadores futuros. Não use diretamente em produção sem autenticação de destinatários, quotas, auditoria e rate limiting.
