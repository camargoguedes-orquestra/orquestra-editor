# Orquestra Document OCR — plugin opcional

`LocalTextExtractor` suporta diretamente TXT, MD, CSV, JSON, XML, HTML e LOG; não interpreta o HTML como conteúdo ativo.

Opcionalmente, quando o ambiente fornecer binários **instalados pelo administrador**, usa `pdftotext` para PDFs textuais e `tesseract` para imagens com OCR em português/inglês. Nenhum token ou API de IA é necessário.

```php
require 'packages/document-ocr/src/LocalTextExtractor.php';
use Orquestra\DocumentOCR\LocalTextExtractor;
$ocr = new LocalTextExtractor(
    pdfToText: '/usr/bin/pdftotext', // null desabilita
    tesseract: '/usr/bin/tesseract'  // null desabilita
);
$result = $ocr->extract($absolutePrivatePath, 'pdf');
echo $result['source'];
```

**Restrições**: arquivos precisam estar previamente validados e privados. Um sandbox de processo/contêiner para documentos não confiáveis, controle de memória e fila persistente são recomendados. A biblioteca não executa OCR de PDFs escaneados automaticamente; essa etapa exigirá rasterização controlada e deve ser adicionada como adaptador separado. Para a Locaweb compartilhada, binários podem não estar disponíveis.

### Privacidade
Texto extraído pode conter CPF, dados pessoais ou informações sigilosas. Não indexe, retenha ou exponha sem política de acesso/retencão idêntica ao arquivo original. A decisão entre não reter, reter índice ou texto completo é do sistema hospedeiro.
