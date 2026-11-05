# Modelo de ameaças e controles — Orquestra Components

## Fronteiras de confiança
1. Browser e documentos recebidos são sempre não confiáveis.
2. O host deve autenticar usuário e oferecer `authorize(tenant, actor, action, file)` para cada operação.
3. O storage deve ficar fora do document root, privado, com credenciais somente no servidor.
4. Um identificador UUID ou GUID não é segredo nem substitui autorização.
5. A autorização é revalidada antes da criação do ticket e antes da transmissão de bytes.
6. Um compartilhamento revogado ou expirado deve falhar fechado. Tickets temporários não substituem grants persistidos.
7. Um link de prévia é derivado de serviço controlado; nunca chave S3 ou caminho de filesystem.
8. Extrações OCR, nomes de signatários, CPF/CNPJ e índices compartilham a política de acesso e retenção do original.
9. Documentos HTML e SVG não confiáveis nunca são executados na origem da aplicação.
10. Assinatura detectada não é assinatura validada. Biometria não equivale a assinatura qualificada.

## Ameaças consideradas
- IDOR, enumeração, troca de tenant, escalada de privilégios, replay, expiração e revogação.
- Exposição de storage, traversal, symlinks, MIME incorreto, arquivos poliglotas, descompressão ZIP-bomb.
- XSS em filename/metadados/conteúdo e SSRF por adaptadores externos.
- Concorrência no download, links vazados, quotas, brute force e inconsistência eventual.
- Alteração de arquivos antigos, reescrita de log e hash não ancorado.
- Exposição biométrica, vazamento OCR, injeção via documento em plugins de IA.
- Dependência de binários externos, indisponibilidade de antivírus e OCR.

## Controles mínimos de produção
HTTPS, cookie Secure/HttpOnly/SameSite conforme aplicação, proteção CSRF, CSP restritiva, limites no proxy e PHP, varredura AV se política exigir, monitoramento e segregação de papéis; backup cifrado e restauração exercitada.
Compartilhamento requer autenticação ou desafio de identidade apropriado e limitador de taxa. Documentos sigilosos nunca devem ser compartilhados apenas com URL.
Chaves de assinatura de checkpoints devem ser protegidas por serviço apropriado; não armazenar em configuração JS.
A integração concreta deve usar transações, auditoria sem PII desnecessária e testes de autorização em todas as rotas.

## Estado real
Este arquivo é um modelo de segurança, não uma certificação nem laudo de pentest. Nenhuma implantação deve pressupor segurança total. Os exemplos demonstram contratos, não substituem a integração e a revisão de segurança da aplicação hospedeira.
