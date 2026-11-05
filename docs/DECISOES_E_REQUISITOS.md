# Orquestra Components — Registro mestre de decisões

> Status: projeto em desenvolvimento. Este documento não atesta funcionalidades prontas. A decisão 30 determina release estável somente depois da entrega integral, documentação, testes e homologação.

## Decisões 01–32 aprovadas; 33–40 assumidas para execução

- **01** — Perfis reutilizáveis de extensões e tamanho individual; validação no servidor.
- **02** — Upload manual/automático com temporários.
- **03** — Múltiplas extensões simultâneas, fila, progresso individual e retry.
- **04** — Banco por adaptadores (MySQL, PostgreSQL, SQL Server) e storage local ou S3.
- **05** — Gerenciador lista/grade, prévias, filtros e ZIP.
- **06** — Versionamento, restauração, auditoria e exclusão lógica.
- **07** — ACL por usuário, papel, arquivo e escopo/tenant.
- **08** — Metadados configuráveis, categorias, tags e vínculos múltiplos.
- **09** — Deduplicação por SHA-256, isolada por contexto.
- **10** — Lixeira, retenção, bloqueio legal, limpeza e restauração.
- **11** — Eventos JS/PHP, webhooks assinados, filas e reentregas.
- **12** — Configuração híbrida com painel administrativo opcional.
- **13** — Pesquisa completa por conteúdo/OCR, metadados e indexação.
- **14** — Proteção avançada, criptografia, quarentena e verificação de integridade.
- **15** — UI compacta/completa/assistida, inline/modal/drawer.
- **16** — Distribuição ZIP/npm/Composer, SemVer, migrações, rollback.
- **17** — Hospedagem compartilhada, VPS e dedicada; capacidades opcionais.
- **18** — Testes, homologação e bloqueio de releases instáveis.
- **19** — APIs versionadas, contratos de plugins e testes de conformidade.
- **20** — Observabilidade, dashboards, auditoria, alertas e relatórios.
- **21** — Importação completa, OCR, assinaturas, pessoas e reindexação.
- **22** — Cadeia de custódia criptográfica, checkpoints e evidências.
- **23** — Comprovantes QR, verificação externa e compartilhamento controlado.
- **24** — OrquestraFileViewer autônomo com visualização por plugins.
- **25** — Assinatura eletrônica/digital, múltiplos signatários e reconhecimento facial opcional.
- **26** — Extração inteligente com IA opcional, revisão humana.
- **27** — Organização inteligente por regras e IA opcional (decisão revisada).
- **28** — Automação segura, exceções passam por revisão.
- **29** — Catálogo compartilhável de perfis e configurações versionadas.
- **30** — Implementação integral antes do primeiro release estável.
- **31** — Compartilhamento por e-mail/telefone/WhatsApp/link com validade e revogação.
- **32** — Portal de solicitação de documentos com formulários e aprovação.
- **33** — Aprovação documental configurável; reenvio e trilha de decisões (decisão técnica assumida).
- **34** — Download por cópia privada temporária nomeada com UUID v4 (decisão técnica assumida).
- **35** — Grant padrão de 7 dias; extensão até teto administrativo; ticket padrão de 15 min (decisão técnica assumida).
- **36** — OTP e autenticação obrigatória conforme perfil; evitar enumeração (decisão técnica assumida).
- **37** — Contextos separados por tenant; administrador somente no seu escopo (decisão técnica assumida).
- **38** — Índices OCR, assinaturas e PII com ACL e retenção equivalentes ao original (decisão técnica assumida).
- **39** — Backups testados, reconciliação, retomada, migração e rollback documentado (decisão técnica assumida).
- **40** — Licença MIT e contribuições revisadas, exemplos e testes por recurso (decisão técnica assumida).

## Critérios transversais

- Componentes instaláveis isoladamente: Editor, ImageUploader, FileUploader, FileViewer; serviços de OCR, assinatura, pesquisa e compartilhamento desacoplados.
- O backend hospedeiro detém identidade, políticas, persistência e autorização. Nenhum controle apenas no navegador concede direito real.
- Arquivo original armazenado em local privado; jamais expor URL/chave física ao destinatário.
- Compartilhamento: grant persistido, revogável e vinculado a destinatário/escopo; padrão de 7 dias e prorrogação somente dentro do teto autorizado.
- Download: validar concessão, identidade, tenant, operação e SHA-256; copiar sob demanda para staging privado com UUID v4; ticket expira em até 15 minutos; retransmitir arquivo com nome original saneado; cron remove cópias expiradas; negar acessos após revogação.
- Armazenamentos: local e S3; bancos: MySQL/Percona, PostgreSQL e SQL Server por adaptadores independentes.
- OCR e IA: processamento local onde suportado; IA externa inteiramente opcional, sem tokens obrigatórios. Texto OCR pode ser retido, somente indexado ou não retido, respeitando políticas legais.
- Assinaturas e biometria: distinguir captura de assinatura, aceite e certificação digital; proteger dados pessoais sensíveis e exigir evidência verificável.
- Documentação: instalação, API, exemplos executáveis, SQL, plugins, segurança, erros, testes e migração para CADA módulo.
- Sem promessa de risco zero ou certificação automática de autenticidade jurídica.

## Critérios para uma primeira release estável

1. Implementar todos os requisitos aprovados; recursos opcionais precisam estar claramente identificados e funcionais quando habilitados.
2. Autorização por recurso, perfis, segregação tenant, tratamento de erros e limites de quota efetivos no backend.
3. Testes unitários, end-to-end, segurança, carga e ambiente real de todos os bancos e storage suportados.
4. Verificação de hash, revogação de compartilhamento, acesso temporário e prova de não exposição de arquivos originais.
5. Changelog, semver, pacotes e documentação para comunidade, sem segredos ou dados reais em exemplos.
