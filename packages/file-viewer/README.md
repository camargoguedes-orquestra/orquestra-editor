# OrquestraFileViewer (componente independente)

**Estado: implementação inicial com prévias nativas; não homologado para produção.**

Não exige `OrquestraEditor` nem `OrquestraFileUploader`. As URLs devem ser geradas pelo backend hospedeiro com autenticação, autorização por arquivo, tenant e versão, expiração e sem expor o caminho físico de origem.

## Formatos disponíveis
- Imagens: JPG/JPEG, PNG, GIF, WEBP, BMP.
- PDF: visualização nativa do navegador; recursos como pesquisa e página variam conforme navegador.
- Áudio/vídeo: MP3, WAV, OGG, M4A, MP4 e WEBM conforme codecs locais.
- Texto: TXT, Markdown, CSV, XML, JSON, LOG e HTML, sempre apresentados **como texto**, sem executar scripts.
- Office: DOC/DOCX, XLS/XLSX, ODT/ODS, PPT/PPTX e ODP requerem que o host forneça uma prévia PDF previamente convertida.
- ZIP: aviso de indisponibilidade, até a instalação de adaptador de manifesto.
- SVG e formatos executáveis: não exibidos diretamente para reduzir risco de XSS.

## Uso HTML + JavaScript
```html
<link rel="stylesheet" href="packages/file-viewer/src/styles.css">
<div id="viewer"></div>
<script type="module">
  import { OrquestraFileViewer } from './packages/file-viewer/src/index.mjs';
  const viewer = new OrquestraFileViewer({
    element: '#viewer',
    allowDownload: false,
    resolve: async (id, operation) => {
      const response = await fetch('/api/documents/' + encodeURIComponent(id) + '/access?operation=' + operation,
        {credentials:'same-origin'});
      if (!response.ok) throw new Error('Não autorizado');
      return response.json(); // {url:'/api/private-previews/TICKET',downloadAllowed:false}
    }
  });
  viewer.open({id:'UUID',name:'contrato.pdf',mime:'application/pdf'});
</script>
```

A rota `/api/documents/{id}/access` é um **contrato de exemplo**: ainda precisa ser desenvolvida na aplicação hospedeira. URL de prévia nunca deve ser URL do storage físico. Somente links same-origin são aceitos.

## API
- `new OrquestraFileViewer({element, resolve, fetchImpl?, allowDownload?, onEvent?, maxTextBytes?})`
- `await viewer.open({id,name,mime})`, `viewer.close()`, `viewer.destroy()`
- Eventos: `viewer.opened`, `viewer.failed`, `viewer.download-requested`
- A flag `downloadAllowed` do backend precisa ser verdadeira mesmo se `allowDownload` no frontend for verdadeiro.

## Limitações
Prévia e download dependem de rota autenticada existente. Assinaturas, OCR, destaque de busca, miniaturas e versões ainda precisam de plugins. Uma prévia visual não impede screenshots. Nunca servir HTML/SVG não confiável como conteúdo ativo na mesma origem.
