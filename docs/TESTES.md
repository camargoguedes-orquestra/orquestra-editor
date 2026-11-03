# Como executar e avaliar os testes

## Pré-requisitos

PHP 8.2+, Node 18+ (para o build), Python 3.10+, Chromium ou Playwright Chromium, Pillow e Playwright Python.

```bash
npm ci
npm run build
```

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
```

Terminal 1:

```bash
php -S 127.0.0.1:8765 -t .
```

Terminal 2:

```bash
python tests/smoke.py
```

O script cria imagens de teste, executa upload PHP multipart real, testa o servidor de documentos e o histórico de versões, abre a demonstração em Chromium pela origem HTTP do PHP (carregando `dist/`) e valida JavaScript/Canvas com verificações de pixel e dimensão. Os testes de interface simulam as respostas HTTP do editor para isolar o comportamento; os endpoints PHP são testados à parte com requisições reais. Não substitui testes com autenticação de produção.

## Cenários automatizados

| Área | Verificação |
|---|---|
| Backend | POST multipart PNG e GIF válidos |
| Backend | Perfil fixo rejeita dimensões incompatíveis |
| Backend | Perfil fixo aceita WEBP 1200×630 correto |
| Documentos | POST de HTML e GET devolvem conteúdo original |
| Documentos | Segundo salvamento gera versão anterior recuperável; comentários persistidos |
| Editor | Formatação, emojis, tabela, código e sanitização básica |
| Editor | Serialização + reabertura preservam subconjunto de estilos HTML |
| Editor | Imagem `blob:` sem upload impede salvamento |
| Imagem | Recorte 400×400 e arquivo WEBP efetivo |
| Imagem | Uploader bloqueia dimensões; exige interação e produz 1200×630 |
| Imagem | GIF é recusado em campo de recorte fixo |
| Imagem | Estúdio fecha sem travar com `allowUpscale:false` |
| Editor v3 | Cor, fonte e tamanho persistidos; `<font>` e checklist da v2 convertidos |
| Revisão | Comentários (criar, responder, resolver) e controle de alterações (digitar, apagar, aceitar, rejeitar) |
| Ferramentas | Localizar/substituir com maiúsculas e regex; campos de mesclagem; comando `/tabela`; mesclar células |
| Arquivos | Markdown de ida e volta; DOCX exportado e reimportado; fórmula KaTeX e sumário com links |
| UI | Capturas desktop, estúdio, uploader e viewport móvel |

## Testes que faltam antes de abrir como produto público

- E2E real com login, CSRF e banco MySQL multiusuário.
- Testes cross-browser Safari/Firefox/Chrome e dispositivos touch.
- HTML de Word/Google Docs e documentos longos; teste de estilo e de cursor.
- Auditoria de XSS/HTML/CSS por especialistas.
- Performance com documentos de centenas de páginas e imagens grandes.
- Acessibilidade com leitor de tela, teclado e contraste.
- Processamento de imagem com orientação EXIF, ICC e metadados.

## Integração contínua

O `.github/workflows/ci.yml` instala as dependências (`npm ci`), gera o pacote, confere a sintaxe JS e PHP e roda os testes Playwright contra o PHP local.
