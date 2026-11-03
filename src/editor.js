/**
 * Orquestra Editor 3 — editor WYSIWYG livre (MIT) construído sobre Tiptap/ProseMirror.
 *
 * Mantém a API pública da versão 2 (getHTML, setHTML, save, load, onChange, onSave...)
 * e acrescenta: comentários, controle de alterações, histórico de versões, importação e
 * exportação DOCX/Markdown, tabelas completas, código com realce, fórmulas, menções,
 * campos de mesclagem, sumário, comandos com "/", busca com expressão regular e o
 * Estúdio de imagens com recorte obrigatório.
 *
 * Autor: Camargo Guedes <camargoguedes@gmail.com> — licença MIT.
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle, BackgroundColor } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import Typography from '@tiptap/extension-typography';
import Mention from '@tiptap/extension-mention';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TableOfContents, getHierarchicalIndexes } from '@tiptap/extension-table-of-contents';
import { Mathematics } from '@tiptap/extension-mathematics';
import DragHandle from '@tiptap/extension-drag-handle';
import FileHandler from '@tiptap/extension-file-handler';
import InvisibleCharacters from '@tiptap/extension-invisible-characters';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import { Markdown } from '@tiptap/markdown';
import { PluginKey } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { createLowlight, common } from 'lowlight';
import katex from 'katex';

import { ImageStudio } from './image-studio.js';
import { ESC, cleanOfficeHTML, sanitizeHTML, secureMedia, secureURL } from './core/sanitize.js';
import { Anchor, BlockStyle, MergeField, PageBreak, StudioImage, VideoEmbed } from './extensions/document-nodes.js';
import { Comment, Deletion, Insertion, SearchReplace, TrackChanges, listChanges } from './extensions/review.js';
import { loadEmojis, EmojiSuggest, MergeFieldSuggest, SlashCommands, mentionSuggestion } from './extensions/suggestions.js';
// DOCX fica em um pedaço separado do pacote, carregado só quando usado.
const loadDocx = () => import('./io/docx.js');
import { icon } from './ui/icons.js';
import {
  CODE_LANGUAGES, COLORS, FONT_FAMILIES, FONT_SIZES, FREQUENT_EMOJIS, LINE_HEIGHTS, SYMBOL_GROUPS, TEMPLATES,
} from './ui/catalog.js';

export { sanitizeHTML };

export const VERSION = '3.0.0';

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const slug = (text) => 'secao-' + (String(text || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'titulo');

/* ------------------------------------------------------------------ */
/* Catálogo de ferramentas                                             */
/* ------------------------------------------------------------------ */

/**
 * Cada ferramenta: rótulo, ícone, atalho, ação e estado ativo. A barra, os menus e a
 * busca de comandos usam o mesmo catálogo, então um botão novo aparece em todos.
 */
function buildTools(ui) {
  const ed = () => ui.tiptap;
  const chain = () => ui.tiptap.chain().focus();
  return {
    undo: { label: 'Desfazer', icon: 'Undo2', keys: 'Ctrl+Z', run: () => chain().undo().run(), enabled: () => ed().can().undo() },
    redo: { label: 'Refazer', icon: 'Redo2', keys: 'Ctrl+Y', run: () => chain().redo().run(), enabled: () => ed().can().redo() },
    bold: { label: 'Negrito', icon: 'Bold', keys: 'Ctrl+B', run: () => chain().toggleBold().run(), active: () => ed().isActive('bold') },
    italic: { label: 'Itálico', icon: 'Italic', keys: 'Ctrl+I', run: () => chain().toggleItalic().run(), active: () => ed().isActive('italic') },
    underline: { label: 'Sublinhado', icon: 'Underline', keys: 'Ctrl+U', run: () => chain().toggleUnderline().run(), active: () => ed().isActive('underline') },
    strikeThrough: { label: 'Tachado', icon: 'Strikethrough', keys: 'Ctrl+Shift+S', run: () => chain().toggleStrike().run(), active: () => ed().isActive('strike') },
    subscript: { label: 'Subscrito', icon: 'Subscript', keys: 'Ctrl+,', run: () => chain().toggleSubscript().run(), active: () => ed().isActive('subscript') },
    superscript: { label: 'Sobrescrito', icon: 'Superscript', keys: 'Ctrl+.', run: () => chain().toggleSuperscript().run(), active: () => ed().isActive('superscript') },
    inlineCode: { label: 'Código em linha', icon: 'Code', keys: 'Ctrl+E', run: () => chain().toggleCode().run(), active: () => ed().isActive('code') },
    highlight: { label: 'Marca-texto', icon: 'Highlighter', kind: 'color', palette: 'highlight', run: (c) => (c ? chain().setHighlight({ color: c }).run() : chain().unsetHighlight().run()), active: () => ed().isActive('highlight') },
    foreColor: { label: 'Cor do texto', icon: 'Baseline', kind: 'color', palette: 'text', run: (c) => (c ? chain().setColor(c).run() : chain().unsetColor().run()) },
    formatPainter: { label: 'Pincel de formatação', icon: 'Paintbrush', run: () => ui.formatPainter(), active: () => Boolean(ui.painter) },
    changeCase: { label: 'Maiúsculas e minúsculas', icon: 'CaseSensitive', kind: 'menu', items: [['upper', 'MAIÚSCULAS'], ['lower', 'minúsculas'], ['title', 'Iniciais Maiúsculas'], ['sentence', 'Primeira maiúscula']], run: (v) => ui.changeCase(v) },
    justifyLeft: { label: 'Alinhar à esquerda', icon: 'AlignLeft', keys: 'Ctrl+Shift+L', run: () => chain().setTextAlign('left').run(), active: () => ed().isActive({ textAlign: 'left' }) },
    justifyCenter: { label: 'Centralizar', icon: 'AlignCenter', keys: 'Ctrl+Shift+E', run: () => chain().setTextAlign('center').run(), active: () => ed().isActive({ textAlign: 'center' }) },
    justifyRight: { label: 'Alinhar à direita', icon: 'AlignRight', keys: 'Ctrl+Shift+R', run: () => chain().setTextAlign('right').run(), active: () => ed().isActive({ textAlign: 'right' }) },
    justifyFull: { label: 'Justificar', icon: 'AlignJustify', keys: 'Ctrl+Shift+J', run: () => chain().setTextAlign('justify').run(), active: () => ed().isActive({ textAlign: 'justify' }) },
    ltr: { label: 'Texto da esquerda para a direita', icon: 'PilcrowRight', run: () => chain().setTextDirection('ltr').run() },
    rtl: { label: 'Texto da direita para a esquerda', icon: 'PilcrowLeft', run: () => chain().setTextDirection('rtl').run() },
    insertUnorderedList: { label: 'Marcadores', icon: 'List', keys: 'Ctrl+Shift+8', run: () => chain().toggleBulletList().run(), active: () => ed().isActive('bulletList') },
    insertOrderedList: { label: 'Numeração', icon: 'ListOrdered', keys: 'Ctrl+Shift+7', run: () => chain().toggleOrderedList().run(), active: () => ed().isActive('orderedList') },
    checklist: { label: 'Lista de tarefas', icon: 'ListTodo', keys: 'Ctrl+Shift+9', run: () => chain().toggleTaskList().run(), active: () => ed().isActive('taskList') },
    indent: { label: 'Aumentar recuo', icon: 'IndentIncrease', keys: 'Tab', run: () => chain().indentBlock().run() },
    outdent: { label: 'Diminuir recuo', icon: 'IndentDecrease', keys: 'Shift+Tab', run: () => chain().outdentBlock().run() },
    blockquote: { label: 'Citação', icon: 'Quote', keys: 'Ctrl+Shift+B', run: () => chain().toggleBlockquote().run(), active: () => ed().isActive('blockquote') },
    link: { label: 'Inserir link', icon: 'Link', keys: 'Ctrl+K', run: () => ui.linkDialog(), active: () => ed().isActive('link') },
    unlink: { label: 'Remover link', icon: 'Unlink', run: () => chain().extendMarkRange('link').unsetLink().run() },
    table: { label: 'Inserir tabela', icon: 'Table', run: () => ui.tableDialog() },
    image: { label: 'Imagem (estúdio)', icon: 'ImagePlus', run: () => ui.fileInput.click() },
    'image-url': { label: 'Imagem por URL', icon: 'Image', run: () => ui.imageURLDialog() },
    gif: { label: 'GIF animado', icon: 'Image', run: () => ui.gifDialog() },
    media: { label: 'Vídeo (YouTube/Vimeo)', icon: 'Film', run: () => ui.mediaDialog() },
    emoji: { label: 'Emojis', icon: 'Smile', run: (_, el) => ui.emojiPicker(el) },
    specialchars: { label: 'Caracteres especiais', icon: 'Omega', run: (_, el) => ui.symbolPicker(el) },
    codeblock: { label: 'Bloco de código', icon: 'SquareCode', keys: 'Ctrl+Alt+C', run: () => chain().toggleCodeBlock().run(), active: () => ed().isActive('codeBlock') },
    math: { label: 'Fórmula (LaTeX)', icon: 'Sigma', run: () => ui.mathDialog() },
    details: { label: 'Seção recolhível', icon: 'ListCollapse', run: () => chain().setDetails().run() },
    template: { label: 'Modelos de documento', icon: 'FileText', run: () => ui.templateDialog() },
    mergeField: { label: 'Campo de mesclagem', icon: 'Braces', run: () => ui.mergeFieldDialog() },
    bookmark: { label: 'Âncora', icon: 'Bookmark', run: () => ui.bookmarkDialog() },
    toc: { label: 'Inserir sumário', icon: 'ListTree', run: () => ui.insertTableOfContents() },
    hr: { label: 'Linha horizontal', icon: 'Minus', run: () => chain().setHorizontalRule().run() },
    datetime: { label: 'Data e hora', icon: 'CalendarClock', run: () => chain().insertContent(new Date().toLocaleString('pt-BR')).run() },
    pagebreak: { label: 'Quebra de página', icon: 'SeparatorHorizontal', keys: 'Ctrl+Enter', run: () => chain().setPageBreak().run() },
    removeFormat: { label: 'Limpar formatação', icon: 'RemoveFormatting', keys: 'Ctrl+\\', run: () => chain().unsetAllMarks().clearNodes().run() },
    comment: { label: 'Comentar', icon: 'MessageSquarePlus', keys: 'Ctrl+Alt+M', run: () => ui.newComment() },
    trackChanges: { label: 'Controle de alterações', icon: 'GitCompare', run: () => ui.setTrackChanges(!ui.trackChangesOn), active: () => ui.trackChangesOn },
    search: { label: 'Localizar e substituir', icon: 'Search', keys: 'Ctrl+F', run: () => ui.openFind() },
    source: { label: 'Código HTML', icon: 'Code2', run: () => ui.toggleSource(), active: () => ui.sourceMode },
    preview: { label: 'Visualizar', icon: 'Eye', run: () => ui.preview() },
    print: { label: 'Imprimir / PDF', icon: 'Printer', keys: 'Ctrl+P', run: () => ui.print() },
    fullscreen: { label: 'Tela cheia', icon: 'Maximize2', run: () => ui.host.classList.toggle('oe-fullscreen'), active: () => ui.host.classList.contains('oe-fullscreen') },
    sidebar: { label: 'Painel lateral', icon: 'PanelRight', run: () => ui.toggleSidebar(), active: () => !ui.sidebar.hidden },
    showBlocks: { label: 'Mostrar blocos', icon: 'Rows3', run: () => ui.host.classList.toggle('oe-show-blocks'), active: () => ui.host.classList.contains('oe-show-blocks') },
    invisibles: { label: 'Caracteres invisíveis', icon: 'WrapText', run: () => chain().toggleInvisibleCharacters().run(), active: () => ui.tiptap.storage.invisibleCharacters?.visibility?.() },
    clearDoc: { label: 'Limpar conteúdo', icon: 'Trash2', run: () => ui.confirmDialog('Limpar documento', 'Apagar todo o conteúdo atualmente editado?', () => ui.setHTML('<p></p>')) },
    'table-row-before': { label: 'Linha acima', run: () => chain().addRowBefore().run() },
    'table-row': { label: 'Linha abaixo', run: () => chain().addRowAfter().run() },
    'table-col-before': { label: 'Coluna à esquerda', run: () => chain().addColumnBefore().run() },
    'table-col': { label: 'Coluna à direita', run: () => chain().addColumnAfter().run() },
    'table-delrow': { label: 'Excluir linha', run: () => chain().deleteRow().run() },
    'table-delcol': { label: 'Excluir coluna', run: () => chain().deleteColumn().run() },
    'table-merge': { label: 'Mesclar células', icon: 'TableCellsMerge', run: () => chain().mergeCells().run() },
    'table-split': { label: 'Dividir célula', icon: 'TableCellsSplit', run: () => chain().splitCell().run() },
    'table-header-row': { label: 'Linha de cabeçalho', run: () => chain().toggleHeaderRow().run() },
    'table-header-col': { label: 'Coluna de cabeçalho', run: () => chain().toggleHeaderColumn().run() },
    'table-del': { label: 'Excluir tabela', run: () => chain().deleteTable().run() },
    tableprops: { label: 'Propriedades da tabela', run: () => ui.tableProps() },
  };
}

const TOOLBAR = [
  ['undo', 'redo'],
  ['@heading', '@font', '@size', '@lineHeight'],
  ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'inlineCode', 'foreColor', 'highlight', 'formatPainter', 'removeFormat'],
  ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'],
  ['insertUnorderedList', 'insertOrderedList', 'checklist', '@liststyle', 'outdent', 'indent'],
  ['link', 'image', 'table', 'media', 'emoji', 'specialchars', 'math'],
  ['blockquote', 'codeblock', 'details', 'template', 'mergeField', 'hr', 'pagebreak'],
  ['comment', 'trackChanges', 'search', 'source', 'preview', 'sidebar', 'fullscreen'],
];

const MENUS = {
  Arquivo: [['Novo documento', 'new'], ['Abrir arquivo (DOCX, Markdown, HTML)…', 'open-file'], ['Reabrir do servidor', 'load'], ['Histórico de versões', 'versions'], ['Salvar', 'save'], '-',
    ['Exportar Word (.docx)', 'export-docx'], ['Exportar HTML', 'export-html'], ['Exportar Markdown', 'export-md'], ['Exportar texto', 'export-txt'], ['Copiar HTML', 'copy-html'], ['Imprimir / salvar PDF', 'print']],
  Editar: [['Desfazer', 'undo'], ['Refazer', 'redo'], '-', ['Localizar e substituir', 'search'], ['Selecionar tudo', 'selectAll'], ['Pincel de formatação', 'formatPainter'], ['Limpar formatação', 'removeFormat'], ['Limpar conteúdo', 'clearDoc']],
  Inserir: [['Imagem / estúdio', 'image'], ['Imagem via URL', 'image-url'], ['GIF animado', 'gif'], ['Vídeo', 'media'], ['Tabela', 'table'], ['Link', 'link'], '-',
    ['Bloco de código', 'codeblock'], ['Fórmula (LaTeX)', 'math'], ['Seção recolhível', 'details'], ['Lista de tarefas', 'checklist'], ['Citação', 'blockquote'], '-',
    ['Modelos', 'template'], ['Campo de mesclagem', 'mergeField'], ['Sumário', 'toc'], ['Âncora', 'bookmark'], ['Emoji', 'emoji'], ['Caracteres especiais', 'specialchars'], ['Data e hora', 'datetime'], ['Linha horizontal', 'hr'], ['Quebra de página', 'pagebreak']],
  Formatar: [['Negrito', 'bold'], ['Itálico', 'italic'], ['Sublinhado', 'underline'], ['Tachado', 'strikeThrough'], ['Subscrito', 'subscript'], ['Sobrescrito', 'superscript'], ['Código em linha', 'inlineCode'], '-',
    ['MAIÚSCULAS', 'case-upper'], ['minúsculas', 'case-lower'], ['Iniciais Maiúsculas', 'case-title'], '-',
    ['Texto da esquerda para a direita', 'ltr'], ['Texto da direita para a esquerda', 'rtl'], ['Aumentar recuo', 'indent'], ['Diminuir recuo', 'outdent']],
  Tabela: [['Inserir tabela', 'table'], ['Propriedades da tabela', 'tableprops'], '-', ['Linha acima', 'table-row-before'], ['Linha abaixo', 'table-row'], ['Coluna à esquerda', 'table-col-before'], ['Coluna à direita', 'table-col'], '-',
    ['Mesclar células', 'table-merge'], ['Dividir célula', 'table-split'], ['Linha de cabeçalho', 'table-header-row'], ['Coluna de cabeçalho', 'table-header-col'], '-', ['Excluir linha', 'table-delrow'], ['Excluir coluna', 'table-delcol'], ['Excluir tabela', 'table-del']],
  Revisão: [['Comentar seleção', 'comment'], ['Controle de alterações (liga/desliga)', 'trackChanges'], ['Aceitar todas as alterações', 'accept-all'], ['Rejeitar todas as alterações', 'reject-all'], '-', ['Painel de comentários', 'panel-comments'], ['Painel de alterações', 'panel-changes'], ['Sumário do documento', 'panel-toc']],
  Exibir: [['Somente leitura', 'readonly'], ['Modo página A4', 'page'], ['Modo contínuo', 'continuous'], ['Mostrar blocos', 'showBlocks'], ['Caracteres invisíveis', 'invisibles'], ['Painel lateral', 'sidebar'], ['Prévia', 'preview'], ['Tela cheia', 'fullscreen'], ['Código-fonte HTML', 'source']],
  Ajuda: [['Atalhos de teclado', 'help'], ['Sobre o editor', 'about']],
};

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export class OrquestraEditor {
  constructor(element, options = {}) {
    this.host = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.host) throw Error('Contêiner do editor não encontrado');
    this.options = {
      id: 'documento-orquestra',
      pageMode: true,
      autosave: true,
      uploadUrl: null,
      saveUrl: null,
      token: '',
      height: 680,
      image: { width: 1200, height: 800, locked: false, requireAdjustment: false, format: 'image/webp' },
      user: { name: 'Usuário' },
      mergeFields: [],
      mentions: null,
      placeholder: 'Comece a escrever… digite / para comandos',
      sidebar: false,
      trackChanges: false,
      readOnly: false,
      extensions: [],
      labels: {},
      toolbar: null,
      onChange: null,
      onSave: null,
      initialHTML: null,
      ...options,
    };
    this.studio = new ImageStudio();
    this.sourceMode = false;
    this.readOnly = false;
    this.destroyed = false;
    this.localURLs = [];
    this.comments = [];
    this.listeners = {};
    this.customTools = {};
    this.trackChangesOn = Boolean(this.options.trackChanges);
    this.tools = buildTools(this);
    for (const [id, label] of Object.entries(this.options.labels || {})) if (this.tools[id]) this.tools[id].label = label;

    this.render();
    this.createEditor();
    this.bind();

    const cached = this.options.autosave ? this.retrieveDraft() : null;
    const seed = this.options.initialHTML ?? cached?.html ?? `<h1>Bem-vindo ao Orquestra Editor</h1><p>Um editor livre para documentos, comunicados, atas e contratos, com recursos profissionais.</p><p>Digite <strong>/</strong> para ver os comandos, <strong>@</strong> para mencionar, <strong>:</strong> para emojis ou abra o <strong>Estúdio de imagens</strong> para recortar uma fotografia.</p><blockquote><p>Componente reutilizável e gratuito, com upload, imagens, tabelas, comentários, controle de alterações e exportação para Word.</p></blockquote>`;
    if (cached?.comments && this.options.initialHTML == null) this.comments = cached.comments;
    this.setHTML(seed, false);
    if (this.options.readOnly) this.run('readonly');
    if (this.trackChangesOn) this.setTrackChanges(true);
  }

  /* ---------------- montagem ---------------- */

  render() {
    this.host.classList.add('oe-root');
    const toolbar = this.options.toolbar || TOOLBAR;
    this.host.innerHTML = `
      <header class="oe-header">
        <div class="oe-brand"><span class="oe-brand-mark">O</span><div><b>Orquestra Editor</b><small>Editor livre de documentos</small></div></div>
        <div class="oe-header-actions">
          <span class="oe-save-indicator">● Rascunho local</span>
          <button class="oe-top-btn oe-action" data-action="load" title="Abrir o HTML salvo no servidor">Reabrir</button>
          <button class="oe-top-btn oe-action" data-action="preview">Visualizar</button>
          <button class="oe-top-btn oe-top-primary oe-action" data-action="save">Salvar documento</button>
        </div>
      </header>
      <nav class="oe-menubar" aria-label="Menu do editor">${Object.keys(MENUS).map((name) => `<button type="button" class="oe-menu-button" data-menu="${ESC(name)}" aria-haspopup="true">${ESC(name)}</button>`).join('')}</nav>
      <div class="oe-toolbar" role="toolbar" aria-label="Ferramentas de formatação">${toolbar.map((group) => `<div class="oe-toolbar-group" role="group">${group.map((id) => this.toolHTML(id)).join('')}</div>`).join('')}</div>
      <div class="oe-secondary">
        <div><span class="oe-online-dot"></span> Editor pronto <span class="oe-divider-dot">·</span> <span class="oe-page-label">Documento A4</span><span class="oe-track-label" hidden> <span class="oe-divider-dot">·</span> <b>Controle de alterações ligado</b></span></div>
        <div>
          <button type="button" class="oe-text-link oe-action" data-action="page">Modo página</button>
          <button type="button" class="oe-text-link oe-action" data-action="continuous">Modo contínuo</button>
          <button type="button" class="oe-text-link oe-action" data-action="image">▧ Estúdio de imagens</button>
        </div>
      </div>
      <div class="oe-findbar" hidden role="search" aria-label="Localizar e substituir">
        <input class="oe-find-input" type="search" placeholder="Localizar" aria-label="Localizar">
        <span class="oe-find-count" aria-live="polite">0/0</span>
        <button type="button" class="oe-icon-btn oe-find-prev" title="Anterior (Shift+Enter)">↑</button>
        <button type="button" class="oe-icon-btn oe-find-next" title="Próximo (Enter)">↓</button>
        <label class="oe-find-opt" title="Diferenciar maiúsculas"><input type="checkbox" class="oe-find-case">Aa</label>
        <label class="oe-find-opt" title="Palavra inteira"><input type="checkbox" class="oe-find-word">Palavra</label>
        <label class="oe-find-opt" title="Expressão regular"><input type="checkbox" class="oe-find-regex">.*</label>
        <input class="oe-replace-input" type="text" placeholder="Substituir por" aria-label="Substituir por">
        <button type="button" class="oe-btn oe-btn-soft oe-replace-one">Substituir</button>
        <button type="button" class="oe-btn oe-btn-soft oe-replace-all">Todas</button>
        <button type="button" class="oe-icon-btn oe-find-close" aria-label="Fechar busca">${icon('X', 16)}</button>
      </div>
      <div class="oe-body">
        <main class="oe-workspace ${this.options.pageMode ? 'is-page-mode' : ''}" style="min-height:${Math.max(380, +this.options.height || 680)}px">
          <div class="oe-page">
            <div class="oe-content"></div>
            <textarea class="oe-code" spellcheck="false" aria-label="Código-fonte HTML" hidden></textarea>
          </div>
        </main>
        <aside class="oe-sidebar" ${this.options.sidebar ? '' : 'hidden'} aria-label="Painel lateral">
          <div class="oe-side-tabs" role="tablist">
            <button type="button" role="tab" data-panel="toc" class="is-active">Sumário</button>
            <button type="button" role="tab" data-panel="comments">Comentários <span class="oe-badge-count" data-count="comments"></span></button>
            <button type="button" role="tab" data-panel="changes">Alterações <span class="oe-badge-count" data-count="changes"></span></button>
          </div>
          <div class="oe-side-panel" data-panel="toc"></div>
          <div class="oe-side-panel" data-panel="comments" hidden></div>
          <div class="oe-side-panel" data-panel="changes" hidden></div>
        </aside>
      </div>
      <footer class="oe-statusbar"><span class="oe-doc-stats">0 palavras · 0 caracteres</span><span class="oe-status-message" role="status">Pronto</span><span>Orquestra Editor v${VERSION}</span></footer>
      <div class="oe-layer" hidden></div>
      <input type="file" class="oe-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      <input type="file" class="oe-open-file" accept=".docx,.md,.markdown,.html,.htm,.txt" hidden>
      ${this.bubbleHTML()}`;
    const $ = (s) => this.host.querySelector(s);
    this.content = $('.oe-content');
    this.code = $('.oe-code');
    this.workspace = $('.oe-workspace');
    this.layer = $('.oe-layer');
    this.fileInput = $('.oe-file');
    this.openInput = $('.oe-open-file');
    this.sidebar = $('.oe-sidebar');
    this.findbar = $('.oe-findbar');
  }

  toolHTML(id) {
    if (id.startsWith('@')) return this.selectHTML(id.slice(1));
    const t = this.tools[id] || this.customTools[id];
    if (!t) return '';
    const shortcut = t.keys ? ` (${t.keys})` : '';
    const caret = t.kind ? `<span class="oe-caret">${icon('ChevronDown', 12)}</span>` : '';
    const swatch = t.kind === 'color' ? '<span class="oe-swatch"></span>' : '';
    return `<button type="button" class="oe-tool oe-action" data-action="${ESC(id)}" title="${ESC(t.label + shortcut)}" aria-label="${ESC(t.label)}" ${t.active ? 'aria-pressed="false"' : ''} tabindex="-1">${t.icon ? icon(t.icon) : `<span class="oe-tool-text">${ESC(t.text || t.label)}</span>`}${swatch}${caret}</button>`;
  }

  selectHTML(id) {
    const opts = {
      heading: [['p', 'Parágrafo'], ['1', 'Título 1'], ['2', 'Título 2'], ['3', 'Título 3'], ['4', 'Título 4'], ['5', 'Título 5'], ['6', 'Título 6'], ['pre', 'Código']],
      font: FONT_FAMILIES,
      size: FONT_SIZES.map((s) => [s, s ? s.replace('px', ' px') : 'Tamanho']),
      lineHeight: LINE_HEIGHTS.map((s) => [s, s ? `Entrelinha ${s.replace('.', ',')}` : 'Entrelinha']),
      liststyle: [['', 'Estilo da lista'], ['disc', 'Marcador ●'], ['circle', 'Marcador ○'], ['square', 'Marcador ■'], ['decimal', 'Numeração 1.'], ['lower-alpha', 'Numeração a.'], ['upper-alpha', 'Numeração A.'], ['lower-roman', 'Numeração i.'], ['upper-roman', 'Numeração I.']],
    }[id];
    const label = { heading: 'Estilo do bloco', font: 'Fonte', size: 'Tamanho da fonte', lineHeight: 'Entrelinha', liststyle: 'Estilo da lista' }[id];
    return `<label class="oe-select-wrap" title="${label}"><select data-select="${id}" aria-label="${label}" tabindex="-1">${opts.map(([v, l]) => `<option value="${ESC(v)}">${ESC(l)}</option>`).join('')}</select></label>`;
  }

  bubbleHTML() {
    const b = (action, ic, label) => `<button type="button" class="oe-bubble-btn oe-action" data-action="${action}" title="${ESC(label)}" aria-label="${ESC(label)}">${ic ? icon(ic, 16) : ESC(label)}</button>`;
    return `
      <div class="oe-bubble oe-bubble-text">
        ${b('bold', 'Bold', 'Negrito')}${b('italic', 'Italic', 'Itálico')}${b('underline', 'Underline', 'Sublinhado')}${b('strikeThrough', 'Strikethrough', 'Tachado')}${b('inlineCode', 'Code', 'Código')}
        <span class="oe-bubble-sep"></span>${b('link', 'Link', 'Link')}${b('foreColor', 'Baseline', 'Cor')}${b('highlight', 'Highlighter', 'Marca-texto')}<span class="oe-bubble-sep"></span>${b('comment', 'MessageSquarePlus', 'Comentar')}
      </div>
      <div class="oe-bubble oe-bubble-link">
        <a class="oe-bubble-url" target="_blank" rel="noopener noreferrer"></a>${b('link', 'Pencil', 'Editar link')}${b('unlink', 'Unlink', 'Remover link')}
      </div>
      <div class="oe-bubble oe-bubble-image">
        ${b('img-align-left', 'AlignLeft', 'Alinhar à esquerda')}${b('img-align-center', 'AlignCenter', 'Centralizar')}${b('img-align-right', 'AlignRight', 'Alinhar à direita')}${b('img-float-left', 'ArrowLeftRight', 'Texto ao redor')}
        <span class="oe-bubble-sep"></span>${b('img-props', 'Pencil', 'Texto alternativo e legenda')}${b('img-studio', 'Crop', 'Editar no estúdio')}${b('img-delete', 'Trash2', 'Excluir imagem')}
      </div>
      <div class="oe-bubble oe-bubble-table">
        ${b('table-row-before', '', '+ Linha ↑')}${b('table-row', '', '+ Linha ↓')}${b('table-col-before', '', '+ Col ←')}${b('table-col', '', '+ Col →')}
        <span class="oe-bubble-sep"></span>${b('table-merge', 'TableCellsMerge', 'Mesclar células')}${b('table-split', 'TableCellsSplit', 'Dividir célula')}${b('table-cell-color', 'PaintBucket', 'Cor da célula')}${b('table-header-row', 'Heading', 'Cabeçalho')}
        <span class="oe-bubble-sep"></span>${b('table-delrow', '', '− Linha')}${b('table-delcol', '', '− Col')}${b('table-del', 'Trash2', 'Excluir tabela')}
      </div>
      <div class="oe-bubble oe-bubble-code">
        <select class="oe-code-lang" aria-label="Linguagem do código">${CODE_LANGUAGES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      </div>
      <div class="oe-drag-handle" title="Arraste para mover o bloco">${icon('GripVertical', 16)}</div>`;
  }

  extensions() {
    const lowlight = createLowlight(common);
    const ui = this;
    const imageAllowed = (file) => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type);
    const bubble = (cls, key, shouldShow) => BubbleMenu.configure({
      pluginKey: new PluginKey(key),
      element: this.host.querySelector(cls),
      shouldShow: (props) => {
        const focused = props.view.hasFocus() || props.element.contains(document.activeElement);
        return focused && !ui.readOnly && shouldShow(props);
      },
    });
    const mentionItems = typeof this.options.mentions === 'function'
      ? this.options.mentions
      : () => this.options.mentions || [];

    return [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => Boolean(secureURL(url)),
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        },
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      BackgroundColor,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
      CharacterCount,
      Placeholder.configure({ placeholder: this.options.placeholder, includeChildren: false }),
      Typography.configure({ openDoubleQuote: '“', closeDoubleQuote: '”', openSingleQuote: '‘', closeSingleQuote: '’' }),
      Details.configure({ persist: true, HTMLAttributes: { class: 'oe-details' } }),
      DetailsSummary,
      DetailsContent,
      Mathematics.configure({
        katexOptions: { throwOnError: false },
        inlineOptions: { onClick: (node, pos) => ui.mathDialog({ latex: node.attrs.latex, pos, inline: true }) },
        blockOptions: { onClick: (node, pos) => ui.mathDialog({ latex: node.attrs.latex, pos, inline: false }) },
      }),
      TableOfContents.configure({
        // Ids legíveis (secao-titulo-x1y2) servem de âncora para links internos e sumário.
        getId: (text) => `${slug(text)}-${Math.random().toString(36).slice(2, 6)}`,
        getIndex: getHierarchicalIndexes,
        onUpdate: (items) => {
          ui.tocItems = items;
          ui.renderToc();
        },
      }),
      InvisibleCharacters.configure({ visible: false }),
      Markdown,
      BlockStyle,
      StudioImage.configure({ onEdit: (node, pos) => ui.reeditImage(pos) }),
      VideoEmbed,
      PageBreak,
      Anchor,
      MergeField,
      Comment,
      Insertion,
      Deletion,
      TrackChanges.configure({ author: this.options.user?.name || 'Usuário' }),
      SearchReplace,
      SlashCommands.configure({ items: () => ui.slashItems() }),
      EmojiSuggest,
      MergeFieldSuggest.configure({ fields: () => ui.options.mergeFields || [] }),
      Mention.configure({
        HTMLAttributes: { class: 'oe-mention' },
        suggestion: mentionSuggestion(async (q) => mentionItems(q)),
      }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        onDrop: (_editor, files, pos) => {
          const file = files.find(imageAllowed);
          if (file) ui.addImage(file, pos);
        },
        onPaste: (_editor, files) => {
          const file = files.find(imageAllowed);
          if (file) ui.addImage(file);
        },
      }),
      DragHandle.configure({ render: () => ui.host.querySelector('.oe-drag-handle') }),
      bubble('.oe-bubble-text', 'oeBubbleText', ({ editor, from, to, state }) => {
        if (from === to || state.selection instanceof CellSelection) return false;
        if (editor.isActive('image') || editor.isActive('codeBlock') || editor.isActive('videoEmbed')) return false;
        return !state.selection.node;
      }),
      bubble('.oe-bubble-link', 'oeBubbleLink', ({ editor, from, to }) => {
        if (from !== to || !editor.isActive('link')) return false;
        const a = ui.host.querySelector('.oe-bubble-url');
        const href = editor.getAttributes('link').href || '';
        a.href = href;
        a.textContent = href.length > 42 ? href.slice(0, 40) + '…' : href;
        return true;
      }),
      bubble('.oe-bubble-image', 'oeBubbleImage', ({ editor }) => editor.isActive('image')),
      bubble('.oe-bubble-table', 'oeBubbleTable', ({ editor, state }) => editor.isActive('table') && (state.selection instanceof CellSelection || state.selection.empty)),
      bubble('.oe-bubble-code', 'oeBubbleCode', ({ editor }) => {
        if (!editor.isActive('codeBlock')) return false;
        ui.host.querySelector('.oe-code-lang').value = editor.getAttributes('codeBlock').language || '';
        return true;
      }),
      ...(this.options.extensions || []),
    ];
  }

  createEditor() {
    this.tiptap = new Editor({
      element: this.content,
      extensions: this.extensions(),
      content: '',
      editorProps: {
        attributes: {
          class: 'oe-prose',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Conteúdo do documento',
          spellcheck: 'true',
        },
        transformPastedHTML: (html) => sanitizeHTML(cleanOfficeHTML(html)),
      },
      onUpdate: () => this.changed(),
      onSelectionUpdate: () => this.scheduleToolbarSync(),
      onTransaction: () => this.scheduleToolbarSync(),
    });
    // Compatibilidade: os testes e integrações antigas procuram parágrafos dentro de .oe-content.
    this.prose = this.tiptap.view.dom;
  }

  bind() {
    const el = this.host;
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.oe-tool,.oe-menu-button,.oe-top-btn,.oe-text-link,.oe-bubble-btn,.oe-menu-items button')) e.preventDefault();
    });
    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action && el.contains(action)) {
        this.run(action.dataset.action, action);
        return;
      }
      const menu = e.target.closest('[data-menu]');
      if (menu) this.menu(menu.dataset.menu, menu);
    });
    el.querySelectorAll('[data-select]').forEach((select) => select.addEventListener('change', (e) => this.applySelect(e.target.dataset.select, e.target.value)));
    el.querySelector('.oe-code-lang').addEventListener('change', (e) => this.tiptap.chain().focus().updateAttributes('codeBlock', { language: e.target.value || null }).run());

    // Navegação por setas na barra de ferramentas (padrão WAI-ARIA toolbar).
    const toolbar = el.querySelector('.oe-toolbar');
    const focusables = () => [...toolbar.querySelectorAll('button,select')];
    focusables()[0]?.setAttribute('tabindex', '0');
    toolbar.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.target.tagName === 'SELECT' && ['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const items = focusables();
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      items.forEach((b) => b.setAttribute('tabindex', '-1'));
      items[next].setAttribute('tabindex', '0');
      items[next].focus();
    });

    this.prose.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); this.linkDialog(); }
      if (mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h')) { e.preventDefault(); this.openFind(e.key.toLowerCase() === 'h'); }
      if (mod && e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); this.newComment(); }
      if (mod && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.tools.codeblock.run(); }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); this.print(); }
      if (e.key === 'Escape' && this.painter) { this.painter = null; this.status('Pincel de formatação cancelado'); this.syncToolbar(); }
    });
    this.prose.addEventListener('mouseup', () => {
      if (this.painter && !this.tiptap.state.selection.empty) this.applyPainter();
    });
    this.prose.addEventListener('click', (e) => {
      const comment = e.target.closest('.oe-comment');
      if (comment) this.focusComment(comment.dataset.commentId);
    });

    this.code.addEventListener('input', () => this.changed());
    this.fileInput.addEventListener('change', async () => {
      const f = this.fileInput.files[0];
      this.fileInput.value = '';
      if (f) await this.addImage(f);
    });
    this.openInput.addEventListener('change', async () => {
      const f = this.openInput.files[0];
      this.openInput.value = '';
      if (f) await this.importFile(f);
    });

    // Painel lateral
    el.querySelectorAll('.oe-side-tabs [data-panel]').forEach((tab) => tab.addEventListener('click', () => this.showPanel(tab.dataset.panel)));

    // Barra de busca
    const fb = this.findbar;
    const $f = (s) => fb.querySelector(s);
    const search = () => {
      this.tiptap.commands.setSearchTerm($f('.oe-find-input').value, {
        caseSensitive: $f('.oe-find-case').checked,
        regex: $f('.oe-find-regex').checked,
        wholeWord: $f('.oe-find-word').checked,
      });
      this.updateFindCount();
    };
    $f('.oe-find-input').addEventListener('input', search);
    fb.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', search));
    $f('.oe-find-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) this.tiptap.commands.previousSearchResult();
        else this.tiptap.commands.nextSearchResult();
        this.updateFindCount();
      }
      if (e.key === 'Escape') this.closeFind();
    });
    $f('.oe-find-next').addEventListener('click', () => { this.tiptap.commands.nextSearchResult(); this.updateFindCount(); });
    $f('.oe-find-prev').addEventListener('click', () => { this.tiptap.commands.previousSearchResult(); this.updateFindCount(); });
    $f('.oe-replace-one').addEventListener('click', () => { this.tiptap.commands.replaceCurrent($f('.oe-replace-input').value); this.updateFindCount(); });
    $f('.oe-replace-all').addEventListener('click', () => {
      const n = this.tiptap.storage.searchReplace.results.length;
      this.tiptap.commands.replaceAll($f('.oe-replace-input').value);
      this.status(`${n} ocorrência(s) substituída(s).`);
      this.updateFindCount();
    });
    $f('.oe-find-close').addEventListener('click', () => this.closeFind());

    document.addEventListener('pointerdown', this.onOutside = (e) => {
      if (!this.layer.hidden && !this.layer.contains(e.target) && !e.target.closest('[data-menu],[data-action]')) this.closeLayer();
    });
    document.addEventListener('keydown', this.onEscape = (e) => {
      if (e.key === 'Escape' && !this.layer.hidden) this.closeLayer();
    });
  }

  /* ---------------- estado da barra ---------------- */

  scheduleToolbarSync() {
    if (this.syncPending) return;
    this.syncPending = true;
    requestAnimationFrame(() => {
      this.syncPending = false;
      if (!this.destroyed) this.syncToolbar();
    });
  }

  syncToolbar() {
    const ed = this.tiptap;
    this.host.querySelectorAll('.oe-tool[data-action]').forEach((btn) => {
      const t = this.tools[btn.dataset.action] || this.customTools[btn.dataset.action];
      if (!t) return;
      if (t.active) btn.setAttribute('aria-pressed', String(Boolean(t.active())));
      if (t.enabled) btn.disabled = !t.enabled();
    });
    const sel = (id) => this.host.querySelector(`[data-select="${id}"]`);
    let heading = 'p';
    for (let l = 1; l <= 6; l++) if (ed.isActive('heading', { level: l })) heading = String(l);
    if (ed.isActive('codeBlock')) heading = 'pre';
    if (sel('heading')) sel('heading').value = heading;
    const ts = ed.getAttributes('textStyle');
    if (sel('font')) sel('font').value = FONT_FAMILIES.some(([v]) => v === ts.fontFamily) ? ts.fontFamily : '';
    if (sel('size')) sel('size').value = FONT_SIZES.includes(ts.fontSize) ? ts.fontSize : '';
    const color = ts.color || '';
    const hl = ed.getAttributes('highlight').color || '';
    this.host.querySelectorAll('[data-action="foreColor"] .oe-swatch').forEach((s) => { s.style.background = color || 'currentColor'; });
    this.host.querySelectorAll('[data-action="highlight"] .oe-swatch').forEach((s) => { s.style.background = hl || '#fff3a3'; });
  }

  applySelect(id, value) {
    const chain = this.tiptap.chain().focus();
    if (id === 'heading') {
      if (value === 'p') chain.setParagraph().run();
      else if (value === 'pre') chain.setCodeBlock().run();
      else chain.setHeading({ level: +value }).run();
    } else if (id === 'font') {
      if (value) chain.setFontFamily(value).run();
      else chain.unsetFontFamily().run();
    } else if (id === 'size') {
      if (value) chain.setFontSize(value).run();
      else chain.unsetFontSize().run();
    } else if (id === 'lineHeight') {
      if (!chain.setLineHeight(value || null).run()) this.status('Posicione o cursor dentro de um parágrafo.');
    } else if (id === 'liststyle') {
      if (!chain.setListStyle(value || null).run()) this.status('Posicione o cursor dentro de uma lista.');
    }
  }

  /* ---------------- API de conteúdo (compatível com a v2) ---------------- */

  getHTML() {
    return sanitizeHTML(this.sourceMode ? this.code.value : this.tiptap.getHTML());
  }

  getDocumentHTML() {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ESC(this.options.id)}</title><style>${DOCUMENT_CSS}</style></head><body>${this.renderedHTML()}</body></html>`;
  }

  /** HTML com fórmulas já desenhadas pelo KaTeX, para prévia, impressão e exportação. */
  renderedHTML() {
    const dom = new DOMParser().parseFromString(this.getHTML(), 'text/html');
    dom.querySelectorAll('[data-type="inline-math"],[data-type="block-math"]').forEach((el) => {
      try {
        el.innerHTML = katex.renderToString(el.getAttribute('data-latex') || '', { throwOnError: false, output: 'mathml', displayMode: el.dataset.type === 'block-math' });
      } catch { /* mantém o LaTeX */ }
    });
    return dom.body.innerHTML;
  }

  getJSON() { return this.tiptap.getJSON(); }

  setJSON(json) {
    this.tiptap.commands.setContent(json, { emitUpdate: false });
    this.changed();
  }

  getMarkdown() { return this.tiptap.getMarkdown(); }

  setMarkdown(md) {
    this.tiptap.commands.setContent(String(md || ''), { contentType: 'markdown', emitUpdate: false });
    this.changed();
  }

  hasTemporaryImages() { return /\bsrc\s*=\s*["']blob:/i.test(this.getHTML()); }

  getText() {
    return this.sourceMode
      ? new DOMParser().parseFromString(this.code.value, 'text/html').body.textContent
      : this.tiptap.getText({ blockSeparator: '\n\n' });
  }

  setHTML(html, trigger = true) {
    const clean = sanitizeHTML(html);
    this.tiptap.commands.setContent(clean, { emitUpdate: false });
    if (this.sourceMode) this.code.value = this.getHTML();
    if (trigger) this.changed();
    else {
      this.stats();
      this.renderSidebar();
    }
  }

  insertHTML(html) { this.tiptap.chain().focus().insertContent(sanitizeHTML(html)).run(); }

  insertText(text) { this.tiptap.chain().focus().insertContent(String(text)).run(); }

  focus() { this.tiptap.commands.focus(); }

  /** Compatibilidade com comandos execCommand usados por integrações da versão 2. */
  command(cmd, value = null) {
    if (this.sourceMode) {
      this.status('Saia do modo HTML antes de formatar.');
      return;
    }
    const chain = this.tiptap.chain().focus();
    const legacySizes = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };
    const map = {
      formatBlock: () => (/^H[1-6]$/i.test(value) ? chain.setHeading({ level: +value[1] }) : value?.toUpperCase() === 'BLOCKQUOTE' ? chain.setBlockquote() : value?.toUpperCase() === 'PRE' ? chain.setCodeBlock() : chain.setParagraph()),
      fontName: () => chain.setFontFamily(value),
      fontSize: () => chain.setFontSize(legacySizes[value] || value),
      foreColor: () => chain.setColor(value),
      hiliteColor: () => chain.setHighlight({ color: value }),
      insertHTML: () => chain.insertContent(sanitizeHTML(value)),
      insertText: () => chain.insertContent(String(value)),
      selectAll: () => chain.selectAll(),
    };
    if (map[cmd]) map[cmd]().run();
    else if (this.tools[cmd]) this.tools[cmd].run(value);
    else this.status('Comando indisponível: ' + cmd);
  }

  status(message) {
    this.host.querySelector('.oe-status-message').textContent = message;
  }

  stats() {
    const cc = this.tiptap.storage.characterCount;
    const words = this.sourceMode ? (this.getText().trim().split(/\s+/).filter(Boolean).length) : cc.words();
    const chars = this.sourceMode ? this.getText().length : cc.characters();
    this.host.querySelector('.oe-doc-stats').textContent = `${words} palavra${words === 1 ? '' : 's'} · ${chars} caracteres`;
  }

  changed() {
    this.stats();
    this.status('Alterações pendentes');
    this.renderSidebarSoon();
    clearTimeout(this.autoTimer);
    clearTimeout(this.changeTimer);
    if (this.options.autosave) {
      this.autoTimer = setTimeout(() => {
        try {
          if (this.hasTemporaryImages()) {
            this.host.querySelector('.oe-save-indicator').textContent = '⚠ Imagem temporária';
            return;
          }
          localStorage.setItem('orquestra:draft:' + this.options.id, JSON.stringify({ html: this.getHTML(), comments: this.comments }));
          this.host.querySelector('.oe-save-indicator').textContent = '✓ Rascunho salvo';
        } catch {
          this.status('Rascunho grande para armazenamento local; salve no servidor.');
        }
      }, 800);
    }
    this.changeTimer = setTimeout(() => {
      this.options.onChange?.(this.getHTML(), this);
      this.emit('change', this.getHTML());
    }, 150);
  }

  retrieveDraft() {
    try {
      const raw = localStorage.getItem('orquestra:draft:' + this.options.id);
      if (!raw) return null;
      if (raw.trim().startsWith('{')) return JSON.parse(raw);
      return { html: raw };
    } catch {
      return null;
    }
  }

  authHeaders(extra = {}) {
    return { ...extra, ...(this.options.token ? { 'X-Upload-Token': this.options.token } : {}) };
  }

  async save() {
    const html = this.getHTML();
    if (this.hasTemporaryImages()) {
      this.status('Há imagens temporárias. Configure uploadUrl e envie as imagens antes de salvar.');
      return false;
    }
    if (this.options.saveUrl) {
      try {
        const response = await fetch(this.options.saveUrl, {
          method: 'POST',
          headers: this.authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: this.options.id, html, comments: this.comments }),
        });
        const json = await response.json();
        if (!response.ok) throw Error(json.error || 'Falha ao salvar');
        this.status('Documento gravado no servidor ✓');
      } catch (e) {
        this.status('Erro no salvamento: ' + e.message);
        return false;
      }
    } else {
      try {
        localStorage.setItem('orquestra:draft:' + this.options.id, JSON.stringify({ html, comments: this.comments }));
      } catch {
        this.status('Não foi possível salvar o rascunho local.');
        return false;
      }
      this.status('Rascunho salvo neste navegador ✓');
    }
    this.options.onSave?.(html, this);
    this.emit('save', html);
    return true;
  }

  async load(version = null) {
    if (!this.options.saveUrl) {
      this.status('Configure saveUrl para recuperar documentos no servidor.');
      return false;
    }
    try {
      const url = new URL(this.options.saveUrl, location.href);
      url.searchParams.set('id', this.options.id);
      if (version) url.searchParams.set('version', version);
      const resp = await fetch(url.toString(), { headers: this.authHeaders() });
      const data = await resp.json();
      if (!resp.ok || typeof data.html !== 'string') throw Error(data.error || 'Documento não encontrado');
      this.comments = Array.isArray(data.comments) ? data.comments : [];
      this.setHTML(data.html);
      this.status(version ? 'Versão restaurada ✓' : 'Documento recuperado do servidor ✓');
      return true;
    } catch (e) {
      this.status('Falha ao reabrir: ' + e.message);
      return false;
    }
  }

  /* ---------------- eventos e extensões ---------------- */

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return () => { this.listeners[event] = this.listeners[event].filter((f) => f !== fn); };
  }

  emit(event, ...args) {
    (this.listeners[event] || []).forEach((fn) => {
      try { fn(...args, this); } catch (e) { console.error(e); }
    });
  }

  /** Acrescenta um botão próprio à barra sem alterar o núcleo. */
  registerButton({ id, label, icon: ic, text, run, active, group = -1 }) {
    if (!id || typeof run !== 'function') throw Error('registerButton exige id e run');
    this.customTools[id] = { label: label || id, icon: ic, text, run: () => run(this), active: active ? () => active(this) : null };
    const groups = this.host.querySelectorAll('.oe-toolbar-group');
    const target = groups[group < 0 ? groups.length + group : group] || groups[groups.length - 1];
    target.insertAdjacentHTML('beforeend', this.toolHTML(id));
  }

  /* ---------------- ações ---------------- */

  run(id, origin) {
    if (!id) return;
    const keepLayer = ['emoji', 'specialchars'].includes(id) || id.startsWith('color:');
    if (!keepLayer) this.closeLayer();
    const tool = this.tools[id] || this.customTools[id];
    if (tool?.kind === 'color' && origin?.classList.contains('oe-tool')) return this.colorPicker(id, origin);
    if (tool?.kind === 'color' && origin?.classList.contains('oe-bubble-btn')) return this.colorPicker(id, origin);
    if (tool?.kind === 'menu') return this.toolMenu(id, origin);
    if (tool) {
      if (this.sourceMode && !['source', 'preview', 'fullscreen', 'sidebar', 'print'].includes(id)) {
        this.status('Saia do modo HTML antes de formatar.');
        return;
      }
      tool.run(undefined, origin);
      this.syncToolbar();
      return;
    }
    const chain = () => this.tiptap.chain().focus();
    switch (id) {
      case 'new': this.confirmDialog('Novo documento', 'Substituir o conteúdo atual? O rascunho existente poderá ser perdido.', () => { this.comments = []; this.setHTML('<p></p>'); }); break;
      case 'save': this.save(); break;
      case 'load': this.confirmDialog('Reabrir do servidor', 'Carregar a última versão salva e substituir a edição atual?', () => this.load()); break;
      case 'versions': this.versionsDialog(); break;
      case 'open-file': this.openInput.click(); break;
      case 'selectAll': chain().selectAll().run(); break;
      case 'readonly':
        this.readOnly = !this.readOnly;
        this.tiptap.setEditable(!this.readOnly);
        this.host.classList.toggle('oe-readonly', this.readOnly);
        this.status(this.readOnly ? 'Modo somente leitura' : 'Edição habilitada');
        break;
      case 'copy-html': navigator.clipboard?.writeText(this.getHTML()).then(() => this.status('HTML copiado')).catch(() => this.status('Não foi possível copiar. Utilize o modo HTML.')); break;
      case 'page': this.workspace.classList.add('is-page-mode'); this.host.querySelector('.oe-page-label').textContent = 'Documento A4'; break;
      case 'continuous': this.workspace.classList.remove('is-page-mode'); this.host.querySelector('.oe-page-label').textContent = 'Edição contínua'; break;
      case 'export-html': this.download(this.getDocumentHTML(), this.options.id + '.html', 'text/html;charset=utf-8'); break;
      case 'export-txt': this.download(this.getText(), this.options.id + '.txt', 'text/plain;charset=utf-8'); break;
      case 'export-md': this.download(this.getMarkdown(), this.options.id + '.md', 'text/markdown;charset=utf-8'); break;
      case 'export-docx': this.exportDocx(); break;
      case 'case-upper': this.changeCase('upper'); break;
      case 'case-lower': this.changeCase('lower'); break;
      case 'case-title': this.changeCase('title'); break;
      case 'accept-all': chain().acceptAllChanges().run(); this.status('Todas as alterações aceitas'); break;
      case 'reject-all': chain().rejectAllChanges().run(); this.status('Todas as alterações rejeitadas'); break;
      case 'panel-comments': this.showPanel('comments', true); break;
      case 'panel-changes': this.showPanel('changes', true); break;
      case 'panel-toc': this.showPanel('toc', true); break;
      case 'img-align-left': chain().updateImage({ align: 'left' }).run(); break;
      case 'img-align-center': chain().updateImage({ align: 'center' }).run(); break;
      case 'img-align-right': chain().updateImage({ align: 'right' }).run(); break;
      case 'img-float-left': {
        const a = this.tiptap.getAttributes('image').align;
        chain().updateImage({ align: a === 'float-left' ? 'float-right' : a === 'float-right' ? 'none' : 'float-left' }).run();
        break;
      }
      case 'img-props': this.imageProps(); break;
      case 'img-studio': this.reeditImage(this.tiptap.state.selection.from); break;
      case 'img-delete': chain().deleteSelection().run(); break;
      case 'table-cell-color': this.colorPicker('cellColor', origin); break;
      case 'help': this.helpDialog(); break;
      case 'about': this.messageDialog('Orquestra Editor', `<p>Editor WYSIWYG livre e gratuito (licença MIT), versão ${VERSION}, construído sobre Tiptap/ProseMirror.</p><p>Inclui Estúdio de imagens com recorte obrigatório, tabelas completas, comentários, controle de alterações, histórico de versões e exportação para Word.</p><p>Criado por <strong>Camargo Guedes</strong> — <a href="mailto:camargoguedes@gmail.com">camargoguedes@gmail.com</a>.</p>`); break;
      default: break;
    }
    this.syncToolbar();
  }

  /* ---------------- camadas: menus, seletores ---------------- */

  closeLayer() {
    this.layer.hidden = true;
    this.layer.innerHTML = '';
    delete this.layer.dataset.menu;
    this.host.querySelectorAll('.oe-menu-button[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  placeLayer(anchor, width = 260) {
    const box = anchor?.getBoundingClientRect() || this.host.getBoundingClientRect();
    const parent = this.host.getBoundingClientRect();
    this.layer.style.left = Math.max(8, Math.min(parent.width - width - 8, box.left - parent.left)) + 'px';
    this.layer.style.top = (box.bottom - parent.top + 4) + 'px';
  }

  menu(name, anchor) {
    const wasOpen = !this.layer.hidden && this.layer.dataset.menu === name;
    this.closeLayer();
    if (wasOpen) return;
    const items = MENUS[name] || [];
    this.layer.innerHTML = `<div class="oe-menu-items" role="menu">${items.map((it) => (it === '-' ? '<hr>' : `<button type="button" role="menuitem" data-action="${ESC(it[1])}">${ESC(it[0])}${this.tools[it[1]]?.keys ? `<kbd>${ESC(this.tools[it[1]].keys)}</kbd>` : ''}</button>`)).join('')}</div>`;
    this.layer.hidden = false;
    this.layer.dataset.menu = name;
    anchor.setAttribute('aria-expanded', 'true');
    this.placeLayer(anchor, 280);
    this.layer.querySelector('button')?.focus({ preventScroll: true });
    this.layer.querySelector('.oe-menu-items').addEventListener('keydown', (e) => {
      const buttons = [...this.layer.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
    });
  }

  toolMenu(id, anchor) {
    const t = this.tools[id];
    this.layer.innerHTML = `<div class="oe-menu-items" role="menu">${t.items.map(([v, l]) => `<button type="button" role="menuitem" data-value="${ESC(v)}">${ESC(l)}</button>`).join('')}</div>`;
    this.layer.hidden = false;
    this.placeLayer(anchor, 220);
    this.layer.querySelectorAll('[data-value]').forEach((b) => b.addEventListener('click', () => {
      this.closeLayer();
      t.run(b.dataset.value);
    }));
  }

  colorPicker(id, anchor) {
    const palette = id === 'highlight'
      ? ['#fff3a3', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#e5e7eb']
      : id === 'cellColor' ? ['#ffffff', '#f8fafc', '#eef4fb', '#fef3c7', '#dcfce7', '#fee2e2', '#ede9fe', '#e5e7eb', ...COLORS.slice(18)] : COLORS;
    const title = id === 'highlight' ? 'Marca-texto' : id === 'cellColor' ? 'Cor de fundo da célula' : 'Cor do texto';
    this.layer.innerHTML = `<div class="oe-colors"><b>${title}</b><div class="oe-color-grid">${palette.map((c) => `<button type="button" data-color="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div><div class="oe-color-row"><label>Outra cor <input type="color" value="#2563eb"></label><button type="button" class="oe-btn oe-btn-soft" data-color="">Remover</button></div></div>`;
    this.layer.hidden = false;
    this.placeLayer(anchor, 240);
    const apply = (c) => {
      if (id === 'cellColor') this.tiptap.chain().focus().setCellStyle('background-color', c || null).run();
      else this.tools[id].run(c);
      this.closeLayer();
      this.syncToolbar();
    };
    this.layer.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => apply(b.dataset.color)));
    this.layer.querySelector('input[type=color]').addEventListener('change', (e) => apply(e.target.value));
  }

  picker(title, anchor, groups, onPick, placeholder) {
    this.pickerGroups = groups;
    this.layer.hidden = false;
    this.layer.dataset.menu = title;
    this.layer.innerHTML = `<div class="oe-picker"><div class="oe-picker-heading"><b>${ESC(title)}</b><button type="button" class="oe-icon-btn oe-picker-close" aria-label="Fechar">✕</button></div><input class="oe-picker-search" type="search" placeholder="${ESC(placeholder)}"><div class="oe-picker-grid"></div></div>`;
    const root = this.host.getBoundingClientRect();
    const rect = anchor?.getBoundingClientRect() || root;
    this.layer.style.left = Math.max(8, Math.min(root.width - 348, rect.left - root.left)) + 'px';
    this.layer.style.top = (rect.bottom - root.top + 6) + 'px';
    this.layer.querySelector('.oe-picker-close').addEventListener('click', () => this.closeLayer());
    const input = this.layer.querySelector('.oe-picker-search');
    const fill = () => {
      const q = input.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const grid = this.layer.querySelector('.oe-picker-grid');
      if (!grid) return;
      grid.replaceChildren();
      for (const [group, values] of this.pickerGroups) {
        const list = values.filter(([s, d]) => !q || s.includes(q) || String(d).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)).slice(0, q ? 120 : 400);
        if (!list.length) continue;
        const h = document.createElement('div');
        h.className = 'oe-picker-group';
        h.textContent = group;
        grid.append(h);
        for (const [symbol, description] of list) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'oe-emoji-btn';
          button.textContent = symbol;
          button.title = description;
          button.addEventListener('click', () => {
            this.closeLayer();
            onPick(symbol);
          });
          grid.append(button);
        }
      }
    };
    input.addEventListener('input', fill);
    fill();
    input.focus();
  }

  async emojiPicker(anchor) {
    // Abre já com os frequentes e completa o catálogo quando ele termina de carregar.
    const names = { 'smileys & emotion': 'Rostos', 'people & body': 'Pessoas', 'animals & nature': 'Natureza', 'food & drink': 'Comida', 'travel & places': 'Lugares', activities: 'Atividades', objects: 'Objetos', symbols: 'Símbolos', flags: 'Bandeiras' };
    const pick = (s) => this.insertText(s);
    this.picker('Emojis', anchor, [['Frequentes', FREQUENT_EMOJIS]], pick, 'Buscar emoji (português ou inglês)…');
    let all;
    try {
      all = await loadEmojis();
    } catch {
      return;
    }
    if (this.layer.dataset.menu !== 'Emojis') return;
    const byGroup = new Map();
    for (const e of all) {
      if (!e.emoji || !e.group) continue;
      if (!byGroup.has(e.group)) byGroup.set(e.group, []);
      byGroup.get(e.group).push([e.emoji, `${e.name} ${e.shortcodes.join(' ')} ${(e.tags || []).join(' ')}`]);
    }
    const groups = [['Frequentes', FREQUENT_EMOJIS], ...[...byGroup].map(([g, list]) => [names[g] || g, list])];
    this.pickerGroups = groups;
    this.layer.querySelector('.oe-picker-search')?.dispatchEvent(new Event('input'));
  }

  symbolPicker(anchor) {
    const groups = Object.entries(SYMBOL_GROUPS).map(([g, s]) => [g, s.split(' ').map((c) => [c, `${g} ${c}`])]);
    this.picker('Caracteres especiais', anchor, groups, (s) => this.insertText(s), 'Buscar símbolo…');
  }

  /* ---------------- diálogos ---------------- */

  dialog(title, fields, onAccept, submit = 'Inserir', { wide = false } = {}) {
    const mask = document.createElement('div');
    mask.className = 'oe-dialog-mask';
    mask.innerHTML = `<div class="oe-dialog${wide ? ' oe-dialog-wide' : ''}" role="dialog" aria-modal="true" aria-label="${ESC(title)}"><div class="oe-dialog-head"><h3>${ESC(title)}</h3><button type="button" class="oe-dialog-x" aria-label="Fechar">✕</button></div><form><div class="oe-dialog-fields">${fields}</div><footer><button class="oe-btn oe-btn-soft" type="button" data-cancel>Cancelar</button><button class="oe-btn oe-btn-primary" type="submit">${ESC(submit)}</button></footer></form></div>`;
    this.host.append(mask);
    const previous = document.activeElement;
    const close = () => {
      mask.remove();
      previous?.focus?.({ preventScroll: true });
    };
    mask.querySelector('.oe-dialog-x').addEventListener('click', close);
    mask.querySelector('[data-cancel]').addEventListener('click', close);
    mask.addEventListener('pointerdown', (e) => { if (e.target === mask) close(); });
    mask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    mask.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const values = Object.fromEntries(form.entries());
      try {
        const ret = await onAccept(values, mask);
        if (ret !== false) close();
      } catch (err) {
        this.status(err.message);
      }
    });
    mask.querySelector('input:not([type=hidden]),textarea,select')?.focus();
    return mask;
  }

  messageDialog(title, html) { this.dialog(title, html, () => {}, 'Fechar'); }

  confirmDialog(title, text, callback) { this.dialog(title, `<p>${ESC(text)}</p>`, callback, 'Confirmar'); }

  linkDialog() {
    const ed = this.tiptap;
    const current = ed.getAttributes('link');
    const { from, to } = ed.state.selection;
    const selected = ed.state.doc.textBetween(from, to, ' ');
    this.dialog('Inserir link', `
      <label>Texto exibido<input name="label" value="${ESC(selected)}" placeholder="Título do link"></label>
      <label>Endereço (URL, #âncora, mailto: ou tel:)<input name="url" value="${ESC(current.href || '')}" placeholder="https://" required></label>
      <label><input type="checkbox" name="blank" ${current.target === '_self' ? '' : 'checked'}> Abrir em nova aba</label>`, (f) => {
      const url = secureURL(f.url);
      if (!url) {
        this.status('URL inválida');
        return false;
      }
      const attrs = { href: url, target: f.blank ? '_blank' : '_self' };
      const chain = ed.chain().focus();
      if (ed.isActive('link')) chain.extendMarkRange('link').setLink(attrs).run();
      else if (f.label && f.label !== selected) chain.insertContent({ type: 'text', text: f.label, marks: [{ type: 'link', attrs }] }).run();
      else if (from === to) chain.insertContent({ type: 'text', text: f.label || url, marks: [{ type: 'link', attrs }] }).run();
      else chain.setLink(attrs).run();
    }, current.href ? 'Aplicar' : 'Inserir');
  }

  mediaDialog() {
    this.dialog('Inserir vídeo', '<p>Links HTTPS do YouTube ou Vimeo. A prévia usa domínio validado e sem cookies.</p><label>URL do vídeo<input name="url" type="url" placeholder="https://www.youtube.com/watch?v=..." required></label>', (f) => {
      if (!secureMedia(f.url)) {
        this.status('Vídeo não suportado. Utilize um URL válido do YouTube ou Vimeo.');
        return false;
      }
      this.tiptap.chain().focus().setVideo(f.url).run();
    });
  }

  imageURLDialog() {
    this.dialog('Imagem por URL', '<p>Use uma URL pública HTTPS para uma imagem PNG, JPEG, WEBP ou GIF.</p><label>URL da imagem<input name="url" type="url" placeholder="https://site.com/foto.png" required></label><label>Texto alternativo<input name="alt" placeholder="Descreva a imagem"></label><label>Largura de exibição (px)<input name="width" type="number" min="40" max="2000" value="640"></label>', (f) => {
      const url = secureURL(f.url, true);
      if (!url || !/^https:\/\//.test(url)) {
        this.status('Use uma URL HTTPS válida.');
        return false;
      }
      this.tiptap.chain().focus().setImage({ src: url, alt: f.alt || '', width: Math.min(2000, Math.max(40, +f.width || 640)) }).run();
    });
  }

  gifDialog() {
    this.dialog('Inserir GIF animado', '<p>Você pode carregar um GIF local com o botão de imagem ou informar uma URL HTTPS pública.</p><label>URL da imagem GIF<input name="url" type="url" placeholder="https://site.com/animacao.gif" required></label><label>Descrição<input name="alt" placeholder="Descrição para acessibilidade"></label>', (f) => {
      const url = secureURL(f.url, true);
      if (!url) {
        this.status('URL inválida');
        return false;
      }
      this.tiptap.chain().focus().setImage({ src: url, alt: f.alt || 'GIF animado' }).run();
      this.status('GIF inserido. Certifique-se de ter permissão para usar a imagem.');
    });
  }

  tableDialog() {
    this.dialog('Inserir tabela', '<div class="oe-two-cols"><label>Linhas<input name="rows" type="number" min="1" max="50" value="3" required></label><label>Colunas<input name="cols" type="number" min="1" max="20" value="3" required></label></div><label><input type="checkbox" name="header" checked> Primeira linha como cabeçalho</label>', (f) => {
      const rows = Math.min(50, Math.max(1, +f.rows || 1));
      const cols = Math.min(20, Math.max(1, +f.cols || 1));
      this.tiptap.chain().focus().insertTable({ rows, cols, withHeaderRow: Boolean(f.header) }).run();
    });
  }

  tableProps() {
    if (!this.tiptap.isActive('table')) {
      this.status('Selecione uma célula para editar a tabela.');
      return;
    }
    this.dialog('Propriedades da tabela', `
      <label>Largura (%)<input type="number" name="width" min="20" max="100" value="100"></label>
      <label>Cor das bordas<input type="color" name="border" value="#c5d1df"></label>
      <label>Espaçamento interno das células (px)<input type="number" name="padding" min="0" max="40" value="8"></label>
      <label>Alinhamento vertical<select name="valign"><option value="">Padrão</option><option value="top">Topo</option><option value="middle">Meio</option><option value="bottom">Base</option></select></label>`, (f) => {
      const chain = this.tiptap.chain().focus();
      chain.setTableStyle('width', Math.min(100, Math.max(20, +f.width || 100)) + '%').setTableStyle('border-collapse', 'collapse').run();
      // Aplica bordas e espaçamento a todas as células da tabela.
      const { state } = this.tiptap;
      const $from = state.selection.$from;
      let tablePos = null;
      for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') tablePos = $from.before(d);
      if (tablePos !== null) {
        const tr = this.tiptap.state.tr;
        const table = tr.doc.nodeAt(tablePos);
        table.descendants((node, pos) => {
          if (!['tableCell', 'tableHeader'].includes(node.type.name)) return true;
          const el = document.createElement('span');
          el.setAttribute('style', node.attrs.blockStyle || '');
          el.style.border = `1px solid ${f.border}`;
          el.style.padding = `${Math.min(40, Math.max(0, +f.padding || 0))}px`;
          if (f.valign) el.style.verticalAlign = f.valign;
          tr.setNodeMarkup(tablePos + 1 + pos, undefined, { ...node.attrs, blockStyle: el.getAttribute('style') });
          return false;
        });
        this.tiptap.view.dispatch(tr);
      }
    }, 'Aplicar');
  }

  codeblockDialog() { this.tools.codeblock.run(); }

  templateDialog() {
    this.dialog('Inserir modelo', `<label>Modelo<select name="model">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${ESC(t.label)}</option>`).join('')}</select></label><p>Será inserido na posição atual do cursor.</p>`, (f) => this.insertHTML((TEMPLATES[f.model] || TEMPLATES.comunicado).html));
  }

  mergeFieldDialog() {
    const fields = this.options.mergeFields || [];
    const options = fields.map((f) => `<option value="${ESC(f.key)}">${ESC(f.label)} — {{${ESC(f.key)}}}</option>`).join('');
    this.dialog('Campo de mesclagem', `<p>O campo é substituído por dados reais com <code>editor.fillFields({...})</code>. Dica: digite <b>{{</b> no texto para escolher um campo.</p>${fields.length ? `<label>Campo configurado<select name="key"><option value="">— digitar outro —</option>${options}</select></label>` : ''}<label>Ou chave nova<input name="custom" pattern="[A-Za-z][A-Za-z0-9_.-]*" placeholder="nome_condomino"></label>`, (f) => {
      const key = f.key || f.custom;
      const label = fields.find((x) => x.key === key)?.label || key;
      if (!key || !this.tiptap.chain().focus().insertMergeField(key, label).run()) {
        this.status('Informe uma chave válida (letras, números, _ . -).');
        return false;
      }
    });
  }

  bookmarkDialog() {
    this.dialog('Inserir âncora', '<label>Identificador<input name="id" placeholder="secao-introducao" pattern="[A-Za-z][A-Za-z0-9_:.-]*" required></label><p>Crie um link para <code>#identificador</code> para pular até aqui.</p>', (f) => {
      if (!this.tiptap.chain().focus().setAnchor(String(f.id || '')).run()) return false;
    });
  }

  mathDialog({ latex = '', pos = null, inline = true } = {}) {
    const mask = this.dialog(pos === null ? 'Inserir fórmula' : 'Editar fórmula', `
      <label>Fórmula em LaTeX<textarea name="latex" rows="3" placeholder="E = mc^2">${ESC(latex)}</textarea></label>
      ${pos === null ? '<label><input type="checkbox" name="block"> Fórmula em destaque (bloco centralizado)</label>' : ''}
      <div class="oe-math-preview" aria-live="polite"></div>`, (f) => {
      const value = String(f.latex || '').trim();
      if (!value) return false;
      const chain = this.tiptap.chain().focus();
      if (pos !== null) {
        if (inline) chain.updateInlineMath({ latex: value, pos }).run();
        else chain.updateBlockMath({ latex: value, pos }).run();
      } else if (f.block) chain.insertBlockMath({ latex: value }).run();
      else chain.insertInlineMath({ latex: value }).run();
    }, pos === null ? 'Inserir' : 'Aplicar');
    const area = mask.querySelector('textarea');
    const preview = mask.querySelector('.oe-math-preview');
    const paint = () => {
      try {
        preview.innerHTML = area.value.trim() ? katex.renderToString(area.value, { throwOnError: false, displayMode: true }) : '<small>Prévia da fórmula</small>';
      } catch {
        preview.textContent = 'Fórmula inválida';
      }
    };
    area.addEventListener('input', paint);
    paint();
  }

  imageProps() {
    const attrs = this.tiptap.getAttributes('image');
    this.dialog('Imagem selecionada', `
      <label>Texto alternativo (acessibilidade)<input name="alt" value="${ESC(attrs.alt || '')}"></label>
      <label>Legenda<input name="caption" value="${ESC(attrs.caption || '')}" placeholder="Aparece abaixo da imagem"></label>
      <div class="oe-two-cols"><label>Largura (px)<input type="number" name="width" min="20" max="2000" value="${attrs.width || ''}" placeholder="automática"></label>
      <label>Alinhamento<select name="align">${[['none', 'Padrão'], ['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita'], ['float-left', 'Texto à direita'], ['float-right', 'Texto à esquerda']].map(([v, l]) => `<option value="${v}" ${attrs.align === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`, (f) => {
      this.tiptap.chain().focus().updateImage({
        alt: f.alt || '',
        caption: f.caption || '',
        width: f.width ? Math.min(2000, Math.max(20, +f.width)) : null,
        align: f.align || 'none',
      }).run();
    }, 'Aplicar');
  }

  helpDialog() {
    const rows = Object.values(this.tools).filter((t) => t.keys).map((t) => `<tr><td>${ESC(t.label)}</td><td><kbd>${ESC(t.keys)}</kbd></td></tr>`).join('');
    this.messageDialog('Atalhos de teclado', `<p>Digite <kbd>/</kbd> para comandos, <kbd>@</kbd> para menções, <kbd>:</kbd> para emojis e <kbd>{{</kbd> para campos. Markdown também funciona: <code># </code>título, <code>- </code>lista, <code>1. </code>numeração, <code>[ ] </code>tarefa, <code>&gt; </code>citação, <code>\`\`\`</code> código.</p><table class="oe-help-table"><tbody>${rows}<tr><td>Salvar</td><td><kbd>Ctrl+S</kbd></td></tr><tr><td>Substituir</td><td><kbd>Ctrl+H</kbd></td></tr></tbody></table>`);
  }

  async versionsDialog() {
    if (!this.options.saveUrl) {
      this.status('Configure saveUrl para usar o histórico de versões.');
      return;
    }
    let list = [];
    try {
      const url = new URL(this.options.saveUrl, location.href);
      url.searchParams.set('id', this.options.id);
      url.searchParams.set('versions', '1');
      const r = await fetch(url.toString(), { headers: this.authHeaders() });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || 'Falha ao listar versões');
      list = data.versions || [];
    } catch (e) {
      this.status('Histórico indisponível: ' + e.message);
      return;
    }
    const items = list.length
      ? list.map((v, i) => `<label class="oe-version"><input type="radio" name="version" value="${ESC(v.version)}" ${i === 0 ? 'checked' : ''}> ${ESC(new Date(v.updatedAt).toLocaleString('pt-BR'))} <small>${Math.round((v.bytes || 0) / 1024)} KB</small></label>`).join('')
      : '<p>Nenhuma versão anterior salva ainda.</p>';
    this.dialog('Histórico de versões', `<p>Cada salvamento guarda a versão anterior no servidor. Restaurar substitui o conteúdo atual (salve depois para confirmar).</p><div class="oe-version-list">${items}</div>`, (f) => (f.version ? this.load(f.version) : false), 'Restaurar');
  }

  /* ---------------- imagens ---------------- */

  async uploadBlob(blob, name) {
    if (!this.options.uploadUrl) return null;
    const form = new FormData();
    form.append('file', blob, name);
    if (this.options.image?.profile) form.append('profile', this.options.image.profile);
    const response = await fetch(this.options.uploadUrl, { method: 'POST', headers: this.authHeaders(), body: form });
    const json = await response.json();
    if (!response.ok || !json.url) throw Error(json.error || 'Falha no upload');
    return json.url;
  }

  async addImage(file, pos = null) {
    const result = await this.studio.open(file, this.options.image || {});
    if (!result) return;
    let url = null;
    try {
      url = await this.uploadBlob(result.blob, result.name);
    } catch (e) {
      this.status('Upload falhou: ' + e.message + '. Imagem temporária.');
    }
    if (!url) {
      url = URL.createObjectURL(result.blob);
      this.localURLs.push(url);
      this.status('Imagem local temporária: configure backend para persistência.');
    }
    const attrs = {
      src: url,
      alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      width: Math.min(result.width, 680),
      profile: this.options.image?.profile || null,
    };
    const chain = this.tiptap.chain().focus();
    if (pos !== null) chain.insertContentAt(pos, { type: 'image', attrs }).run();
    else chain.setImage(attrs).run();
    this.emit('image', { ...result, url });
  }

  async reeditImage(pos) {
    const node = this.tiptap.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return;
    try {
      const response = await fetch(node.attrs.src);
      if (!response.ok) throw Error('A imagem remota não permitiu edição.');
      const blob = await response.blob();
      const file = new File([blob], 'imagem.' + (blob.type.split('/')[1] || 'png'), { type: blob.type });
      const edited = await this.studio.open(file, this.options.image || {});
      if (!edited) return;
      let url = null;
      try {
        url = await this.uploadBlob(edited.blob, edited.name);
      } catch (e) {
        this.status('Upload falhou: ' + e.message + '. Imagem temporária.');
      }
      if (!url) {
        url = URL.createObjectURL(edited.blob);
        this.localURLs.push(url);
      }
      const current = this.tiptap.state.doc.nodeAt(pos);
      if (current?.type.name === 'image') {
        this.tiptap.view.dispatch(this.tiptap.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, src: url }));
      }
    } catch (e) {
      this.status('Não foi possível reabrir a imagem: ' + e.message);
    }
  }

  /** Envia ao servidor as imagens embutidas (data:) vindas de DOCX ou de colagem. */
  async uploadEmbeddedImages() {
    if (!this.options.uploadUrl) return 0;
    const pending = [];
    this.tiptap.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && /^data:/.test(node.attrs.src || '')) pending.push(pos);
    });
    let done = 0;
    for (const pos of pending) {
      const node = this.tiptap.state.doc.nodeAt(pos);
      try {
        const blob = await (await fetch(node.attrs.src)).blob();
        const url = await this.uploadBlob(blob, `importada-${done + 1}.${blob.type.split('/')[1] || 'png'}`);
        if (url) {
          this.tiptap.view.dispatch(this.tiptap.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url }));
          done++;
        }
      } catch { /* mantém a imagem embutida */ }
    }
    return done;
  }

  /* ---------------- importação e exportação ---------------- */

  async importFile(file) {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.docx')) {
        this.status('Convertendo documento do Word…');
        const { docxToHTML } = await loadDocx();
        const { html, warnings } = await docxToHTML(file);
        this.comments = [];
        this.setHTML(html);
        const sent = await this.uploadEmbeddedImages();
        this.status(`Documento importado${sent ? `, ${sent} imagem(ns) enviada(s)` : ''}${warnings.length ? ` (${warnings.length} aviso(s) de conversão)` : ''}.`);
      } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
        this.setMarkdown(await file.text());
        this.status('Markdown importado.');
      } else if (name.endsWith('.html') || name.endsWith('.htm')) {
        this.setHTML(cleanOfficeHTML(await file.text()));
        this.status('HTML importado.');
      } else if (name.endsWith('.txt')) {
        const text = await file.text();
        this.setHTML(text.split(/\n{2,}/).map((p) => `<p>${ESC(p).replace(/\n/g, '<br>')}</p>`).join(''));
        this.status('Texto importado.');
      } else {
        this.status('Formato não suportado. Use DOCX, Markdown, HTML ou TXT.');
      }
    } catch (e) {
      this.status('Falha ao importar: ' + e.message);
    }
  }

  async exportDocx() {
    this.status('Gerando documento do Word…');
    try {
      const { exportDocx } = await loadDocx();
      const blob = await exportDocx(this.tiptap, { comments: this.comments, title: this.options.id });
      this.download(blob, this.options.id + '.docx');
      return blob;
    } catch (e) {
      this.status('Falha ao gerar DOCX: ' + e.message);
      return null;
    }
  }

  download(data, name, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status('Arquivo ' + name + ' preparado.');
  }

  /* ---------------- formatação extra ---------------- */

  formatPainter() {
    if (this.painter) {
      this.painter = null;
      this.status('Pincel de formatação cancelado');
      return;
    }
    const { state } = this.tiptap;
    const marks = (state.storedMarks || state.selection.$from.marks()).filter((m) => !['link', 'comment', 'insertion', 'deletion'].includes(m.type.name));
    this.painter = marks.map((m) => ({ type: m.type.name, attrs: m.attrs }));
    this.status('Pincel ativo: selecione o texto que receberá a formatação (Esc cancela).');
  }

  applyPainter() {
    const marks = this.painter;
    this.painter = null;
    let chain = this.tiptap.chain().focus();
    for (const name of ['bold', 'italic', 'underline', 'strike', 'code', 'subscript', 'superscript', 'highlight', 'textStyle']) chain = chain.unsetMark(name);
    for (const m of marks) chain = chain.setMark(m.type, m.attrs);
    chain.run();
    this.status('Formatação aplicada.');
    this.syncToolbar();
  }

  changeCase(mode) {
    const { state, view } = this.tiptap;
    const { from, to, empty } = state.selection;
    if (empty) {
      this.status('Selecione o texto para mudar maiúsculas e minúsculas.');
      return;
    }
    const tr = state.tr;
    let first = true;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return true;
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      const text = node.text.slice(start - pos, end - pos);
      let out = text;
      if (mode === 'upper') out = text.toLocaleUpperCase('pt-BR');
      if (mode === 'lower') out = text.toLocaleLowerCase('pt-BR');
      if (mode === 'title') out = text.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toLocaleUpperCase('pt-BR'));
      if (mode === 'sentence') {
        out = text.toLocaleLowerCase('pt-BR');
        if (first) out = out.replace(/\p{L}/u, (c) => c.toLocaleUpperCase('pt-BR'));
      }
      first = false;
      if (out !== text) tr.replaceWith(start, end, state.schema.text(out, node.marks));
      return false;
    });
    view.dispatch(tr);
  }

  insertTableOfContents() {
    const { state, view } = this.tiptap;
    const tr = state.tr;
    const items = [];
    const used = new Set();
    state.doc.descendants((node, pos) => {
      if (node.type.name !== 'heading') return true;
      let id = node.attrs.id;
      if (!id) {
        id = slug(node.textContent);
        while (used.has(id)) id += '-1';
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
      }
      used.add(id);
      items.push({ level: node.attrs.level, text: node.textContent || 'Sem título', id });
      return false;
    });
    if (!items.length) {
      this.status('Crie títulos (Título 1, 2, 3…) para gerar o sumário.');
      return;
    }
    view.dispatch(tr);
    const min = Math.min(...items.map((i) => i.level));
    const html = '<p><strong>Sumário</strong></p><ul>' + items.map((i) => `<li><p style="margin-left:${(i.level - min) * 20}px"><a href="#${ESC(i.id)}" target="_self">${ESC(i.text)}</a></p></li>`).join('') + '</ul>';
    this.insertHTML(html);
  }

  slashItems() {
    const t = (id, title, description, keywords = '') => ({
      title,
      description,
      keywords,
      icon: this.tools[id]?.icon ? icon(this.tools[id].icon, 16) : '',
      run: () => this.run(id),
    });
    return [
      { title: 'Título 1', description: 'Seção principal', keywords: 'h1 heading', icon: '<b>H1</b>', run: (ed) => ed.chain().focus().setHeading({ level: 1 }).run() },
      { title: 'Título 2', description: 'Subseção', keywords: 'h2 heading', icon: '<b>H2</b>', run: (ed) => ed.chain().focus().setHeading({ level: 2 }).run() },
      { title: 'Título 3', description: 'Tópico', keywords: 'h3 heading', icon: '<b>H3</b>', run: (ed) => ed.chain().focus().setHeading({ level: 3 }).run() },
      t('insertUnorderedList', 'Lista com marcadores', 'Itens sem ordem', 'bullet'),
      t('insertOrderedList', 'Lista numerada', 'Itens em sequência', 'numero ordered'),
      t('checklist', 'Lista de tarefas', 'Itens para marcar', 'todo checklist'),
      t('table', 'Tabela', 'Linhas e colunas'),
      t('image', 'Imagem', 'Enviar e recortar no estúdio', 'foto upload'),
      t('media', 'Vídeo', 'YouTube ou Vimeo', 'youtube'),
      t('blockquote', 'Citação', 'Destacar um trecho', 'quote'),
      t('codeblock', 'Bloco de código', 'Com realce de sintaxe', 'code'),
      t('math', 'Fórmula', 'LaTeX com KaTeX', 'equacao latex'),
      t('details', 'Seção recolhível', 'Abre e fecha', 'accordion details'),
      t('hr', 'Linha horizontal', 'Separador', 'divider'),
      t('pagebreak', 'Quebra de página', 'Nova página na impressão', 'page'),
      t('template', 'Modelo de documento', 'Ofício, ata, contrato…', 'template'),
      t('mergeField', 'Campo de mesclagem', 'Dados preenchidos depois', 'variavel campo'),
      t('toc', 'Sumário', 'Índice com links', 'indice toc'),
      t('emoji', 'Emoji', 'Escolher um emoji'),
      t('datetime', 'Data e hora', 'Momento atual', 'hoje'),
    ];
  }

  /* ---------------- busca ---------------- */

  openFind(withReplace = false) {
    this.findbar.hidden = false;
    this.findbar.classList.toggle('with-replace', true);
    const { from, to } = this.tiptap.state.selection;
    const selected = this.tiptap.state.doc.textBetween(from, to, ' ');
    const input = this.findbar.querySelector('.oe-find-input');
    if (selected && selected.length < 80) input.value = selected;
    input.focus();
    input.select();
    input.dispatchEvent(new Event('input'));
    if (withReplace) this.findbar.querySelector('.oe-replace-input').focus();
  }

  closeFind() {
    this.findbar.hidden = true;
    this.tiptap.commands.clearSearch();
    this.tiptap.commands.focus();
  }

  updateFindCount() {
    const s = this.tiptap.storage.searchReplace;
    this.findbar.querySelector('.oe-find-count').textContent = s.error ? s.error : `${s.results.length ? s.index + 1 : 0}/${s.results.length}`;
  }

  /** Mantido por compatibilidade com a v2: abre a barra de busca. */
  searchDialog() { this.openFind(true); }

  /* ---------------- comentários ---------------- */

  getComments() { return structuredClone(this.comments); }

  setComments(list) {
    this.comments = Array.isArray(list) ? structuredClone(list) : [];
    this.renderSidebar();
  }

  newComment() {
    const { empty } = this.tiptap.state.selection;
    if (empty) {
      this.status('Selecione o trecho que deseja comentar.');
      return;
    }
    this.showPanel('comments', true);
    const panel = this.sidebar.querySelector('.oe-side-panel[data-panel="comments"]');
    panel.querySelector('.oe-new-comment')?.remove();
    const form = document.createElement('form');
    form.className = 'oe-new-comment oe-thread';
    form.innerHTML = '<textarea name="text" rows="3" placeholder="Escreva um comentário…" required></textarea><div class="oe-thread-actions"><button type="button" class="oe-btn oe-btn-soft" data-cancel>Cancelar</button><button class="oe-btn oe-btn-primary">Comentar</button></div>';
    panel.prepend(form);
    const range = { from: this.tiptap.state.selection.from, to: this.tiptap.state.selection.to };
    form.querySelector('textarea').focus();
    form.querySelector('[data-cancel]').addEventListener('click', () => form.remove());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = form.text.value.trim();
      if (!text) return;
      this.addComment(text, range);
      form.remove();
    });
  }

  addComment(text, range = null) {
    const id = uid('c');
    const { from, to } = range || this.tiptap.state.selection;
    if (from === to) return null;
    const quote = this.tiptap.state.doc.textBetween(from, to, ' ').slice(0, 160);
    this.tiptap.chain().setTextSelection({ from, to }).setComment(id).run();
    const thread = { id, author: this.options.user?.name || 'Usuário', text, quote, createdAt: new Date().toISOString(), resolved: false, replies: [] };
    this.comments.push(thread);
    this.changed();
    this.emit('comment', thread);
    return id;
  }

  replyComment(id, text) {
    const thread = this.comments.find((c) => c.id === id);
    if (!thread || !text.trim()) return;
    thread.replies.push({ id: uid('r'), author: this.options.user?.name || 'Usuário', text: text.trim(), createdAt: new Date().toISOString() });
    this.changed();
  }

  resolveComment(id, resolved = true) {
    const thread = this.comments.find((c) => c.id === id);
    if (!thread) return;
    thread.resolved = resolved;
    this.tiptap.commands.setCommentResolved(id, resolved);
    this.changed();
  }

  deleteComment(id) {
    this.comments = this.comments.filter((c) => c.id !== id);
    this.tiptap.commands.unsetComment(id);
    this.changed();
  }

  focusComment(id) {
    this.showPanel('comments', true);
    const card = this.sidebar.querySelector(`.oe-thread[data-id="${CSS.escape(id)}"]`);
    this.sidebar.querySelectorAll('.oe-thread.is-active').forEach((c) => c.classList.remove('is-active'));
    card?.classList.add('is-active');
    card?.scrollIntoView({ block: 'nearest' });
  }

  selectComment(id) {
    let range = null;
    this.tiptap.state.doc.descendants((node, pos) => {
      if (!node.isInline) return true;
      if (node.marks.some((m) => m.type.name === 'comment' && m.attrs.id === id)) {
        range = range ? { from: range.from, to: pos + node.nodeSize } : { from: pos, to: pos + node.nodeSize };
      }
      return false;
    });
    if (range) this.tiptap.chain().focus().setTextSelection(range).scrollIntoView().run();
  }

  /* ---------------- controle de alterações ---------------- */

  setTrackChanges(on) {
    this.trackChangesOn = Boolean(on);
    this.tiptap.commands.setTrackChangesAuthor(this.options.user?.name || 'Usuário');
    this.tiptap.commands.setTrackChanges(this.trackChangesOn);
    this.host.classList.toggle('oe-tracking', this.trackChangesOn);
    this.host.querySelector('.oe-track-label').hidden = !this.trackChangesOn;
    this.status(this.trackChangesOn ? 'Controle de alterações ligado: edições ficam como sugestões.' : 'Controle de alterações desligado.');
    this.syncToolbar();
  }

  getChanges() { return listChanges(this.tiptap.state.doc); }

  acceptAllChanges() { this.tiptap.commands.acceptAllChanges(); }

  rejectAllChanges() { this.tiptap.commands.rejectAllChanges(); }

  /** Preenche os campos de mesclagem com dados reais: editor.fillFields({ nome_condomino: 'Ana' }). */
  fillFields(data) { return this.tiptap.commands.fillMergeFields(data || {}); }

  /* ---------------- painel lateral ---------------- */

  toggleSidebar(force) {
    this.sidebar.hidden = force === undefined ? !this.sidebar.hidden : !force;
    this.host.classList.toggle('oe-has-sidebar', !this.sidebar.hidden);
    if (!this.sidebar.hidden) this.renderSidebar();
  }

  showPanel(name, open = false) {
    if (open) this.toggleSidebar(true);
    this.sidebar.querySelectorAll('.oe-side-tabs [data-panel]').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.panel === name);
      t.setAttribute('aria-selected', String(t.dataset.panel === name));
    });
    this.sidebar.querySelectorAll('.oe-side-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    this.renderSidebar();
  }

  renderSidebarSoon() {
    clearTimeout(this.sideTimer);
    this.sideTimer = setTimeout(() => this.renderSidebar(), 250);
  }

  renderSidebar() {
    if (this.destroyed) return;
    const changes = this.getChanges();
    const openComments = this.comments.filter((c) => !c.resolved).length;
    this.sidebar.querySelector('[data-count="comments"]').textContent = openComments || '';
    this.sidebar.querySelector('[data-count="changes"]').textContent = changes.length || '';
    if (this.sidebar.hidden) return;
    this.renderToc();
    this.renderComments();
    this.renderChanges(changes);
  }

  renderToc() {
    const panel = this.sidebar?.querySelector('.oe-side-panel[data-panel="toc"]');
    if (!panel || this.sidebar.hidden) return;
    const items = this.tocItems || [];
    panel.innerHTML = items.length
      ? `<ol class="oe-toc">${items.map((i) => `<li style="padding-left:${(i.level - 1) * 14}px"><button type="button" data-toc="${ESC(i.id)}" class="${i.isActive ? 'is-active' : ''}">${ESC(i.textContent || 'Sem título')}</button></li>`).join('')}</ol><button type="button" class="oe-btn oe-btn-soft oe-side-action" data-action="toc">Inserir sumário no documento</button>`
      : '<p class="oe-side-empty">Use títulos (Título 1, 2, 3…) para montar o sumário.</p>';
    panel.querySelectorAll('[data-toc]').forEach((b) => b.addEventListener('click', () => {
      const item = items.find((i) => i.id === b.dataset.toc);
      if (!item) return;
      this.tiptap.chain().focus().setTextSelection(item.pos + 1).run();
      item.dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  renderComments() {
    const panel = this.sidebar.querySelector('.oe-side-panel[data-panel="comments"]');
    const draft = panel.querySelector('.oe-new-comment');
    const date = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
    const html = this.comments.length
      ? this.comments.map((c) => `
        <article class="oe-thread ${c.resolved ? 'is-resolved' : ''}" data-id="${ESC(c.id)}">
          <blockquote>${ESC(c.quote || '')}</blockquote>
          <header><b>${ESC(c.author)}</b><small>${ESC(date(c.createdAt))}</small></header>
          <p>${ESC(c.text)}</p>
          ${(c.replies || []).map((r) => `<div class="oe-reply"><header><b>${ESC(r.author)}</b><small>${ESC(date(r.createdAt))}</small></header><p>${ESC(r.text)}</p></div>`).join('')}
          <form class="oe-reply-form"><input name="reply" placeholder="Responder…" aria-label="Responder"><button class="oe-btn oe-btn-soft">Enviar</button></form>
          <div class="oe-thread-actions">
            <button type="button" class="oe-text-link" data-c="goto">Ir ao trecho</button>
            <button type="button" class="oe-text-link" data-c="resolve">${c.resolved ? 'Reabrir' : 'Resolver'}</button>
            <button type="button" class="oe-text-link oe-danger" data-c="delete">Excluir</button>
          </div>
        </article>`).join('')
      : '<p class="oe-side-empty">Sem comentários. Selecione um trecho e use <b>Comentar</b> (Ctrl+Alt+M).</p>';
    panel.innerHTML = html;
    if (draft) panel.prepend(draft);
    panel.querySelectorAll('.oe-thread[data-id]').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-c="goto"]').addEventListener('click', () => this.selectComment(id));
      card.querySelector('[data-c="resolve"]').addEventListener('click', () => this.resolveComment(id, !card.classList.contains('is-resolved')));
      card.querySelector('[data-c="delete"]').addEventListener('click', () => this.deleteComment(id));
      card.querySelector('.oe-reply-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this.replyComment(id, e.target.reply.value);
      });
    });
  }

  renderChanges(changes = this.getChanges()) {
    const panel = this.sidebar.querySelector('.oe-side-panel[data-panel="changes"]');
    const head = `<div class="oe-change-head"><button type="button" class="oe-btn oe-btn-soft" data-action="trackChanges">${this.trackChangesOn ? 'Desligar' : 'Ligar'} controle</button><button type="button" class="oe-btn oe-btn-soft" data-action="accept-all" ${changes.length ? '' : 'disabled'}>Aceitar todas</button><button type="button" class="oe-btn oe-btn-soft" data-action="reject-all" ${changes.length ? '' : 'disabled'}>Rejeitar todas</button></div>`;
    panel.innerHTML = head + (changes.length
      ? changes.map((c) => `<article class="oe-change oe-change-${c.type}" data-id="${ESC(c.id)}"><header><b>${c.type === 'insertion' ? 'Inserido' : 'Excluído'}</b> por ${ESC(c.author || '—')}<small>${c.date ? ESC(new Date(c.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })) : ''}</small></header><p>${ESC(c.text.slice(0, 200))}</p><div class="oe-thread-actions"><button type="button" class="oe-text-link" data-ch="accept">Aceitar</button><button type="button" class="oe-text-link oe-danger" data-ch="reject">Rejeitar</button></div></article>`).join('')
      : '<p class="oe-side-empty">Nenhuma alteração pendente. Ligue o controle para que as edições fiquem como sugestões.</p>');
    panel.querySelectorAll('.oe-change').forEach((card) => {
      card.querySelector('[data-ch="accept"]').addEventListener('click', () => this.tiptap.commands.acceptChange(card.dataset.id));
      card.querySelector('[data-ch="reject"]').addEventListener('click', () => this.tiptap.commands.rejectChange(card.dataset.id));
    });
  }

  /* ---------------- modos de exibição ---------------- */

  toggleSource() {
    this.sourceMode = !this.sourceMode;
    if (this.sourceMode) {
      this.code.value = this.getHTML();
      this.code.hidden = false;
      this.content.hidden = true;
      this.status('Editando código HTML (filtrado na saída).');
    } else {
      this.tiptap.commands.setContent(sanitizeHTML(this.code.value), { emitUpdate: false });
      this.code.hidden = true;
      this.content.hidden = false;
      this.changed();
    }
    this.host.classList.toggle('oe-source-open', this.sourceMode);
  }

  preview() {
    const safe = `<!doctype html><html lang="pt-br"><meta charset="utf-8"><style>${DOCUMENT_CSS}body{padding:40px}</style><body>${this.renderedHTML()}</body></html>`;
    const mask = document.createElement('div');
    mask.className = 'oe-dialog-mask';
    mask.innerHTML = '<div class="oe-preview-panel"><header><strong>Prévia do documento</strong><button type="button" class="oe-btn oe-btn-soft">Fechar</button></header><iframe title="Prévia do documento" sandbox=""></iframe></div>';
    mask.querySelector('button').addEventListener('click', () => mask.remove());
    mask.querySelector('iframe').srcdoc = safe;
    this.host.append(mask);
  }

  print() {
    const page = window.open('', '_blank');
    if (!page) {
      this.status('Habilite pop-ups para imprimir.');
      return;
    }
    page.document.open();
    page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${ESC(this.options.id)}</title><style>@page{size:A4;margin:20mm}${DOCUMENT_CSS}body{font-size:12pt}</style></head><body>${this.renderedHTML()}</body></html>`);
    page.document.close();
    page.addEventListener('load', () => {
      page.focus();
      page.print();
    });
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.autoTimer);
    clearTimeout(this.changeTimer);
    clearTimeout(this.sideTimer);
    document.removeEventListener('pointerdown', this.onOutside);
    document.removeEventListener('keydown', this.onEscape);
    this.localURLs.forEach((u) => URL.revokeObjectURL(u));
    this.tiptap.destroy();
    this.host.replaceChildren();
    this.host.classList.remove('oe-root');
  }
}

/** CSS mínimo para o HTML exportado, a prévia e a impressão parecerem com o editor. */
const DOCUMENT_CSS = [
  'body{font:16px/1.6 Arial,sans-serif;color:#243247;max-width:900px;margin:0 auto}',
  'img{max-width:100%;height:auto}figure{margin:12px 0}figcaption{font-size:13px;color:#64748b;text-align:center;margin-top:6px}',
  'table{border-collapse:collapse;width:100%}td,th{border:1px solid #c5d1df;padding:8px;vertical-align:top}th{background:#eef4fb}',
  'blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid #2563eb;background:#eff6ff}',
  'pre{white-space:pre-wrap;background:#f0f4f9;padding:14px;border-radius:6px}code{font-family:Consolas,monospace}',
  'ul[data-type=taskList]{list-style:none;padding-left:4px}ul[data-type=taskList] li{display:flex;gap:8px}ul[data-type=taskList] p{margin:0}',
  'mark{padding:0 2px}[data-merge-field]{background:#eef2ff;color:#3730a3;border-radius:4px;padding:0 3px}',
  'ins{background:#dcfce7;text-decoration:underline}del{background:#fee2e2}',
  'div[data-page-break]{page-break-after:always;break-after:page;border-top:1px dashed #94a3b8;margin:24px 0}',
  'details{border:1px solid #d7e1ee;border-radius:8px;padding:8px 12px;margin:10px 0}summary{font-weight:700;cursor:pointer}',
  'figure[data-type=video] iframe{max-width:100%;aspect-ratio:16/9;height:auto}',
  '[data-type=block-math]{text-align:center;margin:12px 0}',
].join('');
