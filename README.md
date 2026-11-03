# Orquestra Editor 3

**Editor web WYSIWYG livre e gratuito (MIT) + estúdio de imagens com recorte obrigatório e perfis de tamanho administrados pelo desenvolvedor.**

Construído sobre [Tiptap](https://tiptap.dev)/ProseMirror, traz sem custo recursos que em outros editores ficam na versão paga: comentários, controle de alterações, histórico de versões, importação e exportação para Word, campos de mesclagem, tabelas completas e fórmulas.

![Orquestra Editor](docs/assets/editor.png)

![Estúdio de imagens com prévia do corte](docs/assets/image-studio.png)

## Por que existe

CKEditor 5 e TinyMCE são GPL ou pagos, e seus recursos de revisão, Word e edição de imagem só vêm com licença comercial. O Jodit é MIT, mas também reserva vários recursos para a versão PRO. O Orquestra Editor reúne o que esses editores oferecem, com tudo liberado sob MIT, e acrescenta o que nenhum deles tem: recorte de imagem com dimensões travadas pelo desenvolvedor e conferidas no servidor.

A comparação recurso a recurso está em [MATRIZ_FUNCIONAL.md](MATRIZ_FUNCIONAL.md).

## Experimente em um minuto

```bash
php -S 127.0.0.1:8080 -t .
```

Abra `http://127.0.0.1:8080/`. O pacote pronto já está em `dist/`, então a demonstração roda sem Node. O PHP de exemplo só aceita requisições do próprio computador quando não há token configurado.

Para alterar o código-fonte:

```bash
npm ci
npm run build      # gera dist/orquestra-editor.js e dist/orquestra-editor.css
```

## Componentes

| Componente | Responsabilidade |
|---|---|
| `OrquestraEditor` | Editor de documentos: formatação, tabelas, imagens, revisão, importação/exportação, salvamento e versões |
| `OrquestraImageUploader` | Campo de upload independente, com recorte obrigatório e dimensões fixas |
| `ImageStudio` | Estúdio de imagem usado pelos dois acima ou direto em formulários |

## 1. Editor

```html
<link rel="stylesheet" href="/orquestra/dist/orquestra-editor.css">
<div id="editor"></div>
<script type="module">
  import { OrquestraEditor } from '/orquestra/dist/orquestra-editor.js';

  const editor = new OrquestraEditor('#editor', {
    id: 'ata-2026-11',
    uploadUrl: '/orquestra/backend/upload.php',
    saveUrl: '/orquestra/backend/save-document.php',
    user: { name: 'Ana (síndica)' },          // autor de comentários e alterações
    sidebar: true,                            // sumário, comentários e alterações
    mergeFields: [{ key: 'unidade', label: 'Unidade' }],
    mentions: [{ id: 'conselho', label: 'Conselho fiscal' }],
    onChange: (html) => console.log(html),
  });

  // Exemplos de uso
  await editor.save();                         // HTML + comentários; guarda a versão anterior
  editor.fillFields({ unidade: '302' });       // preenche os campos de mesclagem
  const docx = await editor.exportDocx();      // Blob .docx com comentários e alterações
</script>
```

O que vem pronto:

- **Texto:** títulos, fontes, tamanhos, cores, marca-texto, sublinhado, tachado, sub/sobrescrito, código, entrelinha, recuo, alinhamento, direção do texto (LTR/RTL), maiúsculas/minúsculas, pincel de formatação, limpar formatação.
- **Estrutura:** listas com estilos e níveis, lista de tarefas, citação, seção recolhível, linha, quebra de página, âncoras, sumário com links.
- **Tabelas:** inserir, linhas e colunas antes/depois, mesclar e dividir células em qualquer direção, cabeçalho de linha ou coluna, redimensionar colunas arrastando, cor de célula, bordas, espaçamento e alinhamento.
- **Mídia:** imagem pelo Estúdio (arrastar, colar ou escolher), redimensionar arrastando a alça, alinhamento e texto ao redor, legenda, texto alternativo, reeditar no estúdio com duplo clique, imagem por URL, GIF animado, vídeo do YouTube/Vimeo.
- **Atalhos de escrita:** `/` abre os comandos, `@` menciona pessoas, `:` busca emojis, `{{` insere campos; Markdown ao digitar (`# `, `- `, `1. `, `[ ] `, `> `, ```` ``` ````).
- **Código e fórmulas:** blocos de código com realce de sintaxe para 30+ linguagens; fórmulas LaTeX desenhadas com KaTeX.
- **Revisão:** comentários com respostas e resolução; controle de alterações (sugestões aceitas ou rejeitadas uma a uma ou todas); histórico de versões no servidor.
- **Arquivos:** abrir DOCX, Markdown, HTML e TXT; exportar DOCX (com comentários e alterações nativos do Word), HTML, Markdown e TXT; imprimir/PDF; colar do Word e Google Docs mantendo listas e formatação.
- **Ferramentas:** localizar e substituir com contador, maiúsculas/minúsculas, palavra inteira e expressão regular; modo HTML; prévia; tela cheia; somente leitura; modo página A4 ou contínuo; mostrar blocos e caracteres invisíveis; contagem de palavras.
- **Integração:** API de HTML compatível com a versão 2, JSON e Markdown, eventos, botões próprios (`registerButton`) e extensões Tiptap extras (`extensions`).

### Dentro de outro sistema

O CSS só afeta os próprios componentes (nada em `body`, `*` ou nos botões da página). Para usar dentro de um formulário, com o token CSRF do seu sistema:

```js
new OrquestraEditor('#texto', {
  name: 'conteudo',     // campo oculto com o HTML, enviado junto com o <form>
  header: false,        // esconde "Salvar documento"; quem salva é o formulário
  headers: () => ({ 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }),
  uploadUrl: '/upload',
});
```

Exemplo completo em [examples/formulario.html](examples/formulario.html). Também há `menubar: false` e `statusbar: false`.

## 2. Upload de imagem com perfil fixo

```html
<div id="banner-upload"></div>
<script type="module">
  import { OrquestraImageUploader } from '/orquestra/dist/orquestra-editor.js';

  new OrquestraImageUploader({
    element: '#banner-upload',
    width: 1200, height: 630,
    locked: true,              // o usuário não muda dimensões nem proporção
    requireAdjustment: true,   // só confirma depois de enquadrar
    format: 'image/webp', lockFormat: true, quality: 85,
    profile: 'banner-site',    // o servidor confere 1200 × 630 em WEBP
    uploadUrl: '/orquestra/backend/upload.php',
    onUpload: ({ url, width, height }) => console.log(url, width, height),
  });
</script>
```

O estúdio mostra a foto inteira com o excedente escurecido, a prévia real do resultado, zoom, arraste, giro, espelho horizontal e vertical, brilho, contraste, saturação e filtros. O enquadramento também funciona pelo teclado (setas, Shift, + e −).

> Bloquear dimensões no navegador não basta. O parâmetro `profile` faz o servidor conferir largura, altura e formato. Configure os perfis no PHP ou em `ORQUESTRA_IMAGE_PROFILES_JSON`.

## 3. Estúdio direto

```js
import { ImageStudio } from '/orquestra/dist/orquestra-editor.js';

const studio = new ImageStudio({ maxBytes: 15 * 1024 * 1024 });
const result = await studio.open(arquivo, { width: 400, height: 400, locked: true, format: 'image/webp' });
if (result) {
  // result.blob, result.width, result.height, result.name, result.animated
}
```

## Migração da versão 2

A API pública é a mesma (`getHTML`, `setHTML`, `getDocumentHTML`, `save`, `load`, `onChange`, `onSave`, `destroy`). Mudanças:

- Importe de `dist/orquestra-editor.js` e carregue `dist/orquestra-editor.css` (antes `src/`).
- HTML salvo pela v2 reabre normalmente: `<font>` vira `<span style>`, checklists antigos viram listas de tarefas e imagens soltas viram figuras.
- `save()` agora envia também `comments` e o backend guarda versões anteriores.

## Documentação

- [API JavaScript, opções e eventos](docs/API.md)
- [Configuração do uploader e perfis fixos](docs/CONFIGURACAO.md)
- [Persistência e reabertura em HTML](docs/HTML-PERSISTENCIA.md)
- [Segurança e hospedagem em produção](docs/SEGURANCA.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Testes e integração contínua](docs/TESTES.md)
- [Matriz de recursos comparada](MATRIZ_FUNCIONAL.md)
- [Roadmap](docs/ROADMAP.md)
- [Componentes de terceiros e licenças](docs/TERCEIROS.md)

## Testes

```bash
npm ci && npm run build
pip install -r tests/requirements.txt
python -m playwright install chromium
php -S 127.0.0.1:8765 -t .   # terminal 1
python tests/smoke.py        # terminal 2
```

Cobrem o backend PHP real (upload, perfis, versões), o roundtrip de HTML, o Estúdio com Canvas real, comentários, controle de alterações, busca com regex, campos de mesclagem, comandos `/`, mesclagem de células, Markdown, DOCX de ida e volta, KaTeX, sumário e a interface móvel.

## Licença

[MIT](LICENSE.md) — livre para usar, modificar e redistribuir, inclusive em produtos comerciais. Contribuições são bem-vindas: veja [CONTRIBUTING.md](CONTRIBUTING.md).

---

**Autor e coordenação do projeto**
Camargo Guedes — [camargoguedes@gmail.com](mailto:camargoguedes@gmail.com)
CRC/ES 22.562/O
