# Estado de desenvolvimento — Orquestra Components

## Pronto nesta branch (base inicial)

- Registro consolidado das decisões 1–40.
- `packages/file-uploader`: interface independente com seleção múltipla, drag & drop, fila, progresso individual por XHR, retry e validação preventiva do perfil.
- `packages/secure-share`: geração de cópia em staging privado com UUID v4, hash SHA-256, validade curta, checagem de concessão e autorização a cada download, cleanup de tickets.
- Pipeline de testes JS/PHP para essa base.

## Não implementado / não homologado

- API real segura de upload em PHP, storage local/S3, banco MySQL/PostgreSQL/SQL Server, grants persistidos, autenticação/OTP, quota, antivírus, criptografia e auditoria.
- Editor/PhotoUploader separados em pacotes independentes e FileViewer universal.
- OCR, indexação e pesquisa, IA opcional, signatários, biometria, cadeia de custódia, comprovantes e QR Code.
- Painel administrativo, compartilhamento por contatos, portal de solicitações, workflows documentais e catálogo de perfis.
- Testes em todos os ambientes, conformidade e homologação integral.

## Restrição de release

**Não publicar uma release estável nem alterar a branch principal até completar o escopo e homologar**. As versões intermediárias são apenas trabalho de desenvolvimento.

## Segurança

Os arquivos originais devem permanecer privados, resolvidos somente pelo backend. Um UUID não é token de autorização. O arquivo temporário precisa ser revalidado antes do download, e os prazos devem ser aplicados no servidor. Segurança absoluta não pode ser garantida.