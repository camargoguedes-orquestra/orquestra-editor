# Configuração de imagens e perfis

## Objetivo

O desenvolvedor escolhe uma dimensão final **antes** do administrador selecionar o arquivo. O modal mostra a moldura nas mesmas proporções e uma prévia de exportação. O usuário precisa enquadrar e confirmar; o resultado é exportado no tamanho exato em pixels. O backend pode exigir perfis nomeados e rejeitar resultados fora da regra.

## API — uploader autônomo

```js
const uploader = new OrquestraImageUploader({
  element: '#imagem',            // HTMLElement ou seletor CSS — obrigatório
  width: 1200,                  // pixels inteiros de 1 a 4096
  height: 630,
  locked: true,                 // desabilita dimensões e proporções no modal
  requireAdjustment: true,      // botão de aplicar bloqueado até usuário ajustar
  format: 'image/webp',         // image/png | image/jpeg | image/webp
  lockFormat: true,             // desabilita seletor de formato
  quality: 85,                  // usado em WEBP/JPEG
  lockQuality: false,
  allowGIF: false,              // GIF só suportado sem perfil fixo
  allowUpscale: true,           // false rejeita originais menores que o resultado
  profile: 'banner-site',       // nome validado no servidor
  title: 'Imagem de capa',
  uploadUrl: '/backend/upload.php',
  token: '',                    // demonstração; não coloque segredos em frontend público
  onUpload: (result) => { console.log(result.url, result.blob); }
});
```

**Sobre `requireAdjustment`:** uma ação de arraste, zoom, rotação, espelho ou ajuste habilita a confirmação. Isso comprova interação, **não garante que o enquadramento é esteticamente adequado**. Se o original já está perfeito, pode-se usar `requireAdjustment:false`, mantendo a confirmação manual.

**Sobre `allowUpscale:false`:** bloqueia arquivos cujo original seja menor do que a largura ou altura exigida; não substitui avaliação de nitidez ou resolução efetiva sob zoom.

## Editor integrado

O editor de texto pode aplicar seu próprio perfil às imagens carregadas com `image`:

```js
new OrquestraEditor('#editor', {
  image: {
    width: 800,
    height: 450,
    locked: true,
    requireAdjustment: true,
    allowGIF: false,
    format: 'image/webp',
    lockFormat: true
  },
  uploadUrl: '/backend/upload.php'
});
```

> O editor integrado encaminha `image.profile` no upload quando configurado. O backend deve definir o mesmo perfil nas configurações confiáveis do servidor. A migração para adaptadores de upload intercambiáveis é item do roadmap.

## Retorno do processamento

```js
{
  blob: Blob,           // PNG/JPEG/WEBP produzido; File original se GIF livre
  name: 'capa-editada.webp',
  width: 1200,
  height: 630,
  animated: false,
  url: '/backend/uploads/abc123.webp',   // somente após upload bem-sucedido
  localUrl: 'blob:...'                    // prévia temporária; nunca persistir
}
```

Ao cancelar o estúdio, `ImageStudio.open()` retorna `null` e o `onUpload` não dispara.

## Configuração do servidor

O endpoint permite `profile` no `multipart/form-data` junto com o campo `file`. Existem dois perfis demonstrativos embutidos: `banner-site` = 1200×630 WEBP e `avatar` = 400×400 WEBP.

Personalize com a variável de ambiente (JSON em **uma única linha**):

```bash
export ORQUESTRA_IMAGE_PROFILES_JSON='{"banner-site":{"width":1200,"height":630,"mime":"image/webp"},"foto-produto":{"width":800,"height":800,"mime":"image/jpeg"}}'
export ORQUESTRA_REQUIRE_IMAGE_PROFILE=1
```

Com a segunda variável, o servidor rejeita arquivos **sem** perfil. O processamento de upload valida `finfo` e `getimagesize`, dimensões e MIME; perfis desconhecidos são recusados. Não aceite configuração de perfil diretamente do frontend como fonte de autorização — a fonte é o ambiente do servidor.

## Regras para GIF

Um GIF pode possuir múltiplos quadros. Renderizar no Canvas captura somente um quadro, então o estúdio preserva o GIF original **apenas no modo livre**. Se `locked:true`, o GIF é recusado e o administrador deverá enviar uma imagem estática. O suporte a recorte de GIF animado preservando quadros e temporização está previsto para uma futura versão, com codificação apropriada.

## Usos típicos

| Local do sistema | Parâmetros sugeridos |
|---|---|
| Banner de site | `1200 × 630`, WEBP, locked |
| Avatar | `400 × 400`, WEBP, locked |
| Miniatura de produto | `800 × 800`, WEBP, locked |
| Capa horizontal | `1600 × 900`, WEBP, locked |
| Imagem no corpo de documento | livre com largura responsiva |

As medidas são exemplos de requisitos de produto, não um padrão universal.
