# HTML como fonte de verdade

## Princípio

O Orquestra Editor usa **HTML como representação persistente do documento**. O que fica salvo no banco não é um screenshot nem um formato proprietário. As operações principais são simétricas:

```js
const html = editor.getHTML();
// Armazene html em TEXT/LONGTEXT no banco, vinculado ao documento/usuário.
editor.setHTML(html); // reabre conteúdo com formatação suportada.
```

### Exemplo no banco MySQL

```sql
CREATE TABLE documentos_editor (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(90) NOT NULL UNIQUE,
  titulo VARCHAR(255) NOT NULL,
  conteudo_html LONGTEXT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sugestão para sistemas com auditoria: tabela de versões (`documento_id`, `versao`, `conteudo_html`, `autor_id`, `criado_em`, `checksum_sha256`). O backend JSON fornecido grava arquivos em disco somente para simplificar o exemplo.

## O que é preservado

O sanitizador permite tags e estilos comuns a editor web: parágrafos, cabeçalhos, negrito, ênfase, cor, fundo, entrelinha, tamanho/fonte, alinhamento, listas, tabelas, links, figuras, `<img>`, etc. Atributos inseguros e tags executáveis (`script`, `object`, `form`, eventos `on*`) são removidos. **HTML arbitrário não é suportado e não há garantia de compatibilidade bit a bit com HTML gerado pelo Word**. A saída é normalizada pelo navegador.

### Exemplo de ida e volta

```js
editor.setHTML('<h2 style="color:#123456;text-align:center">Título</h2>'+
               '<p style="line-height:1.5"><strong>Corpo</strong></p>');
const texto = editor.getHTML(); // mantém alinhamento, cor, entrelinha e negrito
await editor.save();
// Em outra sessão, com autenticação autorizada:
await editor.load();
```

O teste automático verifica a igualdade do HTML sanitizado ao serializar/reabrir, incluindo tabela e imagem, no Chromium usado. Outros navegadores podem normalizar alguns elementos de forma diferente. A preservação é **semântica e visual dentro do subconjunto permitido**, não necessariamente identidade de bytes em todos os navegadores.

## HTML de fragmento vs. página inteira

- `getHTML()` = fragmento para banco de dados, exibição dentro de uma `<div>` e posterior `setHTML()`.
- `getDocumentHTML()` = HTML com `<html><head><style>…</style></head><body>…</body></html>`, próprio para exportação e visualização independente.
- Para visualização de fragmentos armazenados, importe uma folha de estilos de leitura para tabelas, citações e códigos. As propriedades essenciais que o usuário definiu ficam como CSS inline.

## Imagens devem ter URL definitiva

`blob:` é endereço temporário válido só durante a sessão. Quando `save()` detecta esse tipo de URL em `<img>`, retorna `false` e apresenta erro. Configure `uploadUrl` e persista os uploads no seu storage (com URL de acesso autorizada) antes de salvar o documento.

### Segurança na leitura

Nunca imprima HTML sem sanitização no backend de um sistema real. A sanitização do navegador serve para conforto de edição, mas não é fronteira de segurança: o endpoint demonstrativo aceita qualquer string HTML e apenas a armazena como JSON. Para exibir a outros usuários, aplique **sanitização no servidor** usando biblioteca confiável, permita somente tags/atributos necessários, autorize recursos e configure CSP. Consulte [Segurança](SEGURANCA.md).

## Estratégia de migração

Como o motor atual é baseado em `contenteditable`, recomenda-se salvar snapshots versionados de HTML e escrever testes de ida e volta antes de migrar a implementação do editor para ProseMirror/Tiptap. Em uma futura migração, certas tags não previstas no schema poderão ser removidas. Estabeleça uma matriz de elementos permitidos antes de convertê-los.