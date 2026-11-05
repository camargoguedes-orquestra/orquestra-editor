# OrquestraImageUploader — pacote independente

**Versão de desenvolvimento:** extraído das classes `ImageStudio` e `OrquestraImageUploader` já existentes no Orquestra Editor 3.1.0, sem dependência do editor. A funcionalidade de edição de imagem continua sendo executada integralmente no navegador.

## Uso simples

```html
<link rel="stylesheet" href="packages/image-uploader/src/styles.css">
<div id="imagem"></div>
<script type="module">
import { OrquestraImageUploader } from './packages/image-uploader/src/index.mjs';
const uploader = new OrquestraImageUploader({
  element: '#imagem',
  uploadUrl: '/api/imagens', // backend do sistema hospedeiro
  width: 1200, height: 630,
  locked: true, requireAdjustment: true,
  format: 'image/webp', allowGIF: false,
  onUpload: image => console.log(image.url)
});
</script>
```

Esta é a API de desenvolvimento. Consulte `src/image-studio.js` para a lista atual de opções do construtor. O backend precisa verificar MIME, dimensões, tamanho, permissão e storage. Um URL blob é temporário e não deve ser persistido no banco.

## Recursos
Seleção, corte/enquadramento, giro, espelhamento, filtros, dimensão obrigatória, exportação PNG/JPEG/WEBP, GIF animado preservado no modo livre e callback `onUpload`.

## Limitações
O CSS atual é uma cópia isolada do CSS 3.1.0 e ainda inclui regras prefixed `oe-` do editor; um passo de otimização deverá remover as regras não utilizadas antes do release estável. O sistema é independente, mas exige DOM/Canvas/ResizeObserver do navegador. Testes específicos de regressão visual e upload real ainda pendentes.
