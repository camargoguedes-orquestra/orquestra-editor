import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { sanitizeStyle, secureMedia, secureURL } from '../core/sanitize.js';

/**
 * Estilo de bloco: preserva estilos inline seguros (entrelinha, recuo, cor, bordas, fundo)
 * em parágrafos, títulos, listas e tabelas. Garante que HTML salvo pela versão 2 reabra
 * com a mesma aparência e dá suporte aos comandos de entrelinha, recuo e direção do texto.
 */
const ALIGN_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th'];

export const BlockStyle = Extension.create({
  name: 'blockStyle',

  addOptions() {
    return {
      types: [
        'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem',
        'table', 'tableRow', 'tableCell', 'tableHeader', 'codeBlock', 'details',
      ],
      indentStep: 40,
      maxIndent: 400,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          blockStyle: {
            default: null,
            parseHTML: (el) => {
              // text-align de parágrafos, títulos e células é tratado pelas próprias extensões.
              const omit = ALIGN_TAGS.includes(el.tagName.toLowerCase()) ? ['text-align'] : [];
              return sanitizeStyle(el.getAttribute('style'), { omit }) || null;
            },
            renderHTML: (attrs) => (attrs.blockStyle ? { style: attrs.blockStyle } : {}),
          },
          dir: {
            default: null,
            parseHTML: (el) => (['ltr', 'rtl'].includes(el.getAttribute('dir')) ? el.getAttribute('dir') : null),
            renderHTML: (attrs) => (attrs.dir ? { dir: attrs.dir } : {}),
          },
        },
      },
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (el) => (/^[a-zA-Z][\w:.-]{0,79}$/.test(el.id || '') ? el.id : null),
            renderHTML: (attrs) => (attrs.id ? { id: attrs.id } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const textBlocks = ['paragraph', 'heading', 'blockquote', 'codeBlock'];
    const eachBlock = (state, tr, fn) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isBlock || !textBlocks.includes(node.type.name)) return true;
        const next = fn(node);
        if (next) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...next });
          changed = true;
        }
        return false;
      });
      return changed;
    };
    const setProp = (style, prop, value) => {
      const el = document.createElement('span');
      el.setAttribute('style', style || '');
      if (value === null || value === '') el.style.removeProperty(prop);
      else el.style.setProperty(prop, value);
      return sanitizeStyle(el.getAttribute('style')) || null;
    };
    const getProp = (style, prop) => {
      const el = document.createElement('span');
      el.setAttribute('style', style || '');
      return el.style.getPropertyValue(prop);
    };
    return {
      setBlockStyleProperty: (prop, value) => ({ state, tr, dispatch }) => {
        const ok = eachBlock(state, tr, (node) => ({ blockStyle: setProp(node.attrs.blockStyle, prop, value) }));
        if (ok && dispatch) dispatch(tr);
        return ok;
      },
      setLineHeight: (value) => ({ commands }) => commands.setBlockStyleProperty('line-height', value),
      setTextDirection: (dir) => ({ state, tr, dispatch }) => {
        const ok = eachBlock(state, tr, () => ({ dir: dir === 'auto' ? null : dir }));
        if (ok && dispatch) dispatch(tr);
        return ok;
      },
      indentBlock: () => ({ state, tr, dispatch, editor }) => {
        if (editor.isActive('listItem') && editor.can().sinkListItem('listItem')) return editor.commands.sinkListItem('listItem');
        if (editor.isActive('taskItem') && editor.can().sinkListItem('taskItem')) return editor.commands.sinkListItem('taskItem');
        const ok = eachBlock(state, tr, (node) => {
          const current = parseInt(getProp(node.attrs.blockStyle, 'margin-left'), 10) || 0;
          const next = Math.min(this.options.maxIndent, current + this.options.indentStep);
          return { blockStyle: setProp(node.attrs.blockStyle, 'margin-left', next + 'px') };
        });
        if (ok && dispatch) dispatch(tr);
        return ok;
      },
      outdentBlock: () => ({ state, tr, dispatch, editor }) => {
        if (editor.isActive('listItem') && editor.can().liftListItem('listItem')) return editor.commands.liftListItem('listItem');
        if (editor.isActive('taskItem') && editor.can().liftListItem('taskItem')) return editor.commands.liftListItem('taskItem');
        const ok = eachBlock(state, tr, (node) => {
          const current = parseInt(getProp(node.attrs.blockStyle, 'margin-left'), 10) || 0;
          const next = Math.max(0, current - this.options.indentStep);
          return { blockStyle: setProp(node.attrs.blockStyle, 'margin-left', next ? next + 'px' : null) };
        });
        if (ok && dispatch) dispatch(tr);
        return ok;
      },
      setListStyle: (value) => ({ state, tr, dispatch }) => {
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (['bulletList', 'orderedList'].includes(node.type.name)) {
            if (dispatch) {
              tr.setNodeMarkup($from.before(d), undefined, {
                ...node.attrs,
                blockStyle: setProp(node.attrs.blockStyle, 'list-style-type', value),
              });
              dispatch(tr);
            }
            return true;
          }
        }
        return false;
      },
      setTableStyle: (prop, value) => ({ state, tr, dispatch }) => {
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table') {
            if (dispatch) {
              tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, blockStyle: setProp(node.attrs.blockStyle, prop, value) });
              dispatch(tr);
            }
            return true;
          }
        }
        return false;
      },
      setCellStyle: (prop, value) => ({ state, tr, dispatch }) => {
        let ok = false;
        const apply = (node, pos) => {
          if (!['tableCell', 'tableHeader'].includes(node.type.name)) return;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockStyle: setProp(node.attrs.blockStyle, prop, value) });
          ok = true;
        };
        const sel = state.selection;
        if (sel.$anchorCell) {
          sel.forEachCell((node, pos) => apply(node, pos));
        } else {
          const { $from } = sel;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (['tableCell', 'tableHeader'].includes(node.type.name)) {
              apply(node, $from.before(d));
              break;
            }
          }
        }
        if (ok && dispatch) dispatch(tr);
        return ok;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('table') || this.editor.isActive('codeBlock')) return false;
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) return this.editor.commands.indentBlock();
        return false;
      },
    };
  },
});

/** Alinhamento da imagem dentro do texto, em CSS inline para funcionar fora do editor. */
const FIGURE_ALIGN = {
  none: '',
  left: 'margin-left:0;margin-right:auto',
  center: 'margin-left:auto;margin-right:auto',
  right: 'margin-left:auto;margin-right:0',
  'float-left': 'float:left;margin:0 16px 8px 0',
  'float-right': 'float:right;margin:0 0 8px 16px',
};

/**
 * Imagem com largura, alinhamento, texto alternativo e legenda. O nó é editado pelo
 * Estúdio de imagens (duplo clique) e redimensionado arrastando a alça no canto.
 */
export const StudioImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { onEdit: null, HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      title: { default: null },
      width: { default: null },
      align: { default: 'none' },
      caption: { default: '' },
      profile: { default: null },
    };
  },

  parseHTML() {
    const fromImg = (img, figure = null) => {
      const src = secureURL(img.getAttribute('src'), true);
      if (!src) return false;
      const px = (v) => (/^\d+(\.\d+)?px$/.test(v || '') ? Math.round(parseFloat(v)) : null);
      const styleWidth = figure ? px(figure.style.width) : px(img.style.width);
      const attrWidth = parseInt(img.getAttribute('width'), 10);
      let align = figure?.dataset.align || 'none';
      if (!figure) {
        if (img.style.float === 'left') align = 'float-left';
        if (img.style.float === 'right') align = 'float-right';
        if (img.style.marginLeft === 'auto' && img.style.marginRight === 'auto') align = 'center';
      }
      return {
        src,
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title'),
        width: styleWidth || attrWidth || null,
        align: FIGURE_ALIGN[align] !== undefined ? align : 'none',
        caption: figure?.querySelector('figcaption')?.textContent?.trim() || '',
        profile: figure?.dataset.profile || null,
      };
    };
    return [
      {
        tag: 'figure[data-type="image"]',
        getAttrs: (el) => {
          const img = el.querySelector('img');
          return img ? fromImg(img, el) : false;
        },
      },
      {
        tag: 'figure',
        getAttrs: (el) => {
          const img = el.querySelector(':scope > img');
          return img && !el.querySelector('iframe') ? fromImg(img, el) : false;
        },
      },
      { tag: 'img[src]', getAttrs: (el) => fromImg(el) },
    ];
  },

  renderHTML({ node }) {
    const { src, alt, title, width, align, caption, profile } = node.attrs;
    const figureStyle = ['margin-top:0', FIGURE_ALIGN[align] || '', width ? `width:${width}px;max-width:100%` : '']
      .filter(Boolean).join(';');
    const img = ['img', {
      src,
      alt: alt || '',
      ...(title ? { title } : {}),
      ...(width ? { width: String(width) } : {}),
      style: `${width ? 'width:100%' : 'max-width:100%'};height:auto`,
    }];
    const figure = ['figure', mergeAttributes(this.options.HTMLAttributes, {
      'data-type': 'image',
      'data-align': align || 'none',
      ...(profile ? { 'data-profile': profile } : {}),
      style: figureStyle,
    }), img];
    if (caption) figure.push(['figcaption', {}, caption]);
    return figure;
  },

  addCommands() {
    return {
      setImage: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
      updateImage: (attrs) => ({ commands }) => commands.updateAttributes(this.name, attrs),
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('figure');
      dom.className = 'oe-image';
      dom.dataset.type = 'image';
      const img = document.createElement('img');
      img.draggable = false;
      const caption = document.createElement('figcaption');
      const handle = document.createElement('span');
      handle.className = 'oe-image-handle';
      handle.title = 'Arraste para redimensionar';
      handle.setAttribute('aria-hidden', 'true');
      const badge = document.createElement('span');
      badge.className = 'oe-image-badge';
      dom.append(img, caption, handle, badge);

      const paint = () => {
        const { src, alt, width, align, caption: text } = current.attrs;
        img.src = src;
        img.alt = alt || '';
        dom.dataset.align = align || 'none';
        dom.style.cssText = [FIGURE_ALIGN[align] || '', width ? `width:${width}px;max-width:100%` : ''].join(';');
        caption.textContent = text || '';
        caption.hidden = !text;
        badge.textContent = width ? `${width}px` : '';
      };
      paint();

      dom.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (typeof getPos === 'function') this.options.onEdit?.(current, getPos());
      });

      handle.addEventListener('pointerdown', (e) => {
        if (!editor.isEditable) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = img.getBoundingClientRect().width;
        const maxWidth = editor.view.dom.clientWidth;
        dom.classList.add('is-resizing');
        const move = (ev) => {
          const w = Math.round(Math.max(40, Math.min(maxWidth, startWidth + ev.clientX - startX)));
          dom.style.width = w + 'px';
          badge.textContent = `${w}px`;
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          dom.classList.remove('is-resizing');
          const w = Math.round(Math.max(40, Math.min(maxWidth, startWidth + ev.clientX - startX)));
          if (typeof getPos === 'function') {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), undefined, { ...current.attrs, width: w }));
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      return {
        dom,
        update(updated) {
          if (updated.type !== current.type) return false;
          current = updated;
          paint();
          return true;
        },
        selectNode() { dom.classList.add('is-selected'); },
        deselectNode() { dom.classList.remove('is-selected'); },
        stopEvent: (e) => e.target === handle,
        ignoreMutation: () => true,
      };
    };
  },
});

/** Vídeo do YouTube ou Vimeo, sempre com URL validada e domínio sem cookies. */
export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: 640 },
      height: { default: 360 },
    };
  },

  parseHTML() {
    return [{
      tag: 'iframe[src]',
      getAttrs: (el) => {
        const src = secureMedia(el.getAttribute('src'));
        if (!src) return false;
        return {
          src,
          width: parseInt(el.getAttribute('width'), 10) || 640,
          height: parseInt(el.getAttribute('height'), 10) || 360,
        };
      },
    }];
  },

  renderHTML({ node }) {
    return ['figure', { 'data-type': 'video' }, ['iframe', {
      src: node.attrs.src,
      width: String(node.attrs.width),
      height: String(node.attrs.height),
      title: 'Vídeo incorporado',
      allowfullscreen: '',
      loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
    }]];
  },

  addCommands() {
    return {
      setVideo: (url) => ({ commands }) => {
        const src = secureMedia(url);
        if (!src) return false;
        return commands.insertContent({ type: this.name, attrs: { src } });
      },
    };
  },
});

/** Quebra de página para impressão e exportação DOCX. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      { tag: 'div', getAttrs: (el) => (/page-break-after\s*:\s*always/i.test(el.getAttribute('style') || '') ? {} : false) },
    ];
  },

  renderHTML() {
    return ['div', { 'data-page-break': 'true', style: 'page-break-after:always;break-after:page' }];
  },

  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => commands.insertContent([{ type: this.name }, { type: 'paragraph' }]),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});

/** Âncora (marcador) para links internos do tipo #secao. */
export const Anchor = Node.create({
  name: 'anchor',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { id: { default: null } };
  },

  parseHTML() {
    return [{
      tag: 'a[id]:not([href])',
      getAttrs: (el) => (/^[a-zA-Z][\w:.-]{0,79}$/.test(el.id) ? { id: el.id } : false),
    }, {
      tag: 'a[name]:not([href])',
      getAttrs: (el) => (/^[a-zA-Z][\w:.-]{0,79}$/.test(el.getAttribute('name')) ? { id: el.getAttribute('name') } : false),
    }];
  },

  renderHTML({ node }) {
    return ['a', { id: node.attrs.id, 'data-anchor': 'true' }];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'oe-anchor';
      dom.title = `Âncora #${node.attrs.id}`;
      dom.textContent = '⚑';
      return { dom };
    };
  },

  addCommands() {
    return {
      setAnchor: (id) => ({ commands }) => {
        if (!/^[a-zA-Z][\w:.-]{0,79}$/.test(id)) return false;
        return commands.insertContent({ type: this.name, attrs: { id } });
      },
    };
  },
});

/**
 * Campo de mesclagem ({{nome_do_condomino}}): marca um ponto do modelo que o sistema
 * preenche depois com dados reais (equivalente às "merge tags").
 */
export const MergeField = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-merge-field]',
      getAttrs: (el) => {
        const key = el.getAttribute('data-merge-field');
        if (!/^[a-zA-Z][\w.-]{0,79}$/.test(key || '')) return false;
        return { key, label: el.getAttribute('data-label') || key };
      },
    }];
  },

  renderHTML({ node }) {
    return ['span', {
      'data-merge-field': node.attrs.key,
      'data-label': node.attrs.label || node.attrs.key,
      class: 'oe-merge-field',
    }, `{{${node.attrs.label || node.attrs.key}}}`];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },

  addCommands() {
    return {
      insertMergeField: (key, label) => ({ commands }) => {
        if (!/^[a-zA-Z][\w.-]{0,79}$/.test(key)) return false;
        return commands.insertContent({ type: this.name, attrs: { key, label: label || key } });
      },
      fillMergeFields: (data) => ({ state, tr, dispatch }) => {
        const found = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name === this.name && Object.hasOwn(data, node.attrs.key)) found.push({ node, pos });
        });
        if (!found.length) return false;
        if (dispatch) {
          for (const { node, pos } of found.reverse()) {
            const text = String(data[node.attrs.key] ?? '');
            const marks = state.doc.resolve(pos).marks();
            if (text) tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(text, marks));
            else tr.delete(pos, pos + node.nodeSize);
          }
          dispatch(tr);
        }
        return true;
      },
    };
  },
});
