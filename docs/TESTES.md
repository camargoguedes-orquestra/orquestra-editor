# Como executar e avaliar os testes

## Pré-requisitos

PHP 8.2+, Python 3.10+, Chromium ou Playwright Chromium, Pillow e Playwright Python.

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

O script cria imagens de teste, executa upload PHP multipart real, testa o servidor de documentos, abre a interface em Chromium e valida funcionalidades de JavaScript/Canvas com verificações de pixel e dimensão. Devido a limitações do ambiente de testes original, a página é carregada em `about:blank` e os módulos JavaScript são injetados no navegador, enquanto os endpoints PHP são exercitados no loopback. Isso não substitui um teste de integração end-to-end com origem HTTP real e autenticação de produção.

## Cenários automatizados

| Área | Verificação |
|---|---|
| Backend | POST multipart PNG e GIF válidos |
| Backend | Perfil fixo rejeita dimensões incompatíveis |
| Backend | Perfil fixo aceita WEBP 1200×630 correto |
| Documentos | POST de HTML e GET devolvem conteúdo original |
| Editor | Formatação, emojis, tabela, código e sanitização básica |
| Editor | Serialização + reabertura preservam subconjunto de estilos HTML |
| Editor | Imagem `blob:` sem upload impede salvamento |
| Imagem | Recorte 400×400 e arquivo WEBP efetivo |
| Imagem | Uploader bloqueia dimensões; exige interação e produz 1200×630 |
| Imagem | GIF é recusado em campo de recorte fixo |
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

A pasta `.github/workflows/ci.yml` inclui uma rotina de sintaxe JS, lint PHP e testes Playwright. Antes de habilitar em repositório privado, confira tempo de instalação do Chromium e política de execução de Actions da conta.
