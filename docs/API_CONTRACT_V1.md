# Contrato REST proposto v1 — API hospedeira

**Status:** contrato para implementação. As rotas abaixo **não estão implementadas automaticamente** ao instalar os pacotes PHP/JS. Cada sistema deverá implementar seus endpoints ou utilizar um adaptador HTTP futuro.

## Regras comuns
- Base `/api`, JSON UTF-8; exceção upload `multipart/form-data`.
- Sessão segura ou Bearer no servidor, permissões por ação/documento/tenant, CSRF em sessão.
- Sem IDs de storage ou diretórios privados nas respostas.
- Resposta de erro `{ "error": { "code": "forbidden", "message": "Acesso negado" } }` com HTTP correto.
- Todas as operações de mutação exigem auditoria e controle de idempotência quando aplicável.

## Rotas principais

| Método | Rota | Resultado |
|---|---|---|
| GET | `/api/documents` | Lista dos documentos autorizados |
| POST | `/api/documents/upload` | Recebe arquivo validado por perfil |
| GET | `/api/documents/{id}` | Metadados e versão atual |
| GET | `/api/documents/{id}/versions` | Histórico de versões |
| POST | `/api/documents/{id}/versions` | Nova versão autorizada |
| DELETE | `/api/documents/{id}` | Exclusão lógica |
| GET | `/api/documents/{id}/access?operation=view` | Ticket de prévia autorizada |
| POST | `/api/documents/{id}/share` | Cria grant externo |
| POST | `/api/shares/{id}/revoke` | Revoga grant |
| POST | `/api/shares/{id}/extend` | Prorroga até teto administrativo |
| POST | `/api/downloads/prepare` | Cria cópia efêmera e ticket |
| GET | `/api/downloads/{ticket}` | Stream privado, com nome original |
| POST | `/api/document-requests` | Solicita documentos |
| POST | `/api/document-requests/{id}/submit` | Entrega arquivos exigidos |
| POST | `/api/document-requests/{id}/review` | Aprova/rejeita/corrige |
| GET | `/api/documents/search?q=...` | Busca autorizada por tenant |
| GET | `/api/documents/{id}/evidence` | Evidências e hash |

## Upload
```http
POST /api/documents/upload HTTP/1.1
Content-Type: multipart/form-data; boundary=...
Cookie: session=...
X-CSRF-Token: ...
```
Campos do form: `file`, `profile`, `displayName`, `description` e campos associados definidos pelo host.

Resposta proposta:
```json
{"id":"uuid","displayName":"Contrato","mime":"application/pdf","size":14012,
 "sha256":"hex-64","version":1}
```

## Acesso temporário
O host retorna somente `{ "url": "/api/downloads/{ticket}", "expiresAt": "...", "downloadAllowed": true }`. O ticket não é uma URL de storage. É necessário revalidar actor/tenant/grant em todas as operações, inclusive depois de criar cópia.
Usar `Content-Disposition: attachment; filename*=UTF-8''...`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, HTTPS e restrição contra inline de conteúdo ativo.
O endpoint deverá consultar novamente o estado do grant antes de transmitir bytes.

## Limitações e segurança
Nenhum desses exemplos prova conformidade LGPD ou segurança integral. Antes de produção implementar OTP/verificação de destinatário, antimalware, quotas, rate limit, retenção e concorrência de grants. A presença de código para hash não implica certificação criptográfica.
