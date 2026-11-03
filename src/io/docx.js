/**
 * Importação e exportação de documentos do Word (.docx), sem serviços externos.
 * Importação: mammoth (BSD-2). Exportação: docx (MIT), com comentários e
 * controle de alterações gravados no formato nativo do Word.
 */
import mammoth from 'mammoth';
import {
  AlignmentType, Bookmark, BorderStyle, CommentRangeEnd, CommentRangeStart, CommentReference, DeletedTextRun,
  Document, ExternalHyperlink, HeadingLevel, ImageRun, InsertedTextRun, InternalHyperlink, LevelFormat,
  Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

/* ------------------------------------------------------------------ */
/* Importação                                                          */
/* ------------------------------------------------------------------ */

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtítulo'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Citação'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  'u => u',
  'strike => s',
  'comment-reference => sup',
];

/** Converte um arquivo .docx em HTML; as imagens vêm como data URI para depois serem enviadas ao servidor. */
export async function docxToHTML(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: STYLE_MAP,
    includeDefaultStyleMap: true,
    convertImage: mammoth.images.imgElement(async (image) => {
      const type = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(image.contentType) ? image.contentType : null;
      if (!type) return { src: '' };
      const base64 = await image.read('base64');
      return { src: `data:${type};base64,${base64}` };
    }),
  });
  return { html: result.value, warnings: result.messages.filter((m) => m.type === 'warning').map((m) => m.message) };
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const HEADINGS = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

let colorCtx;
/** Normaliza qualquer cor CSS para hexadecimal RRGGBB, como o Word espera. */
function hex(color) {
  if (!color) return undefined;
  colorCtx ||= document.createElement('canvas').getContext('2d');
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = color;
  const v = colorCtx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(v) ? v.slice(1).toUpperCase() : undefined;
}

/** Tamanho CSS em meios-pontos (unidade do Word). */
function halfPoints(size) {
  const m = String(size || '').match(/^([\d.]+)(px|pt|em|rem)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const pt = m[2] === 'pt' ? n : m[2] === 'em' || m[2] === 'rem' ? n * 12 : n * 0.75;
  return Math.round(pt * 2);
}

function cssProp(style, prop) {
  if (!style) return '';
  const el = document.createElement('span');
  el.setAttribute('style', style);
  return el.style.getPropertyValue(prop);
}

const twips = (px) => Math.round(px * 15);

export async function exportDocx(editor, { comments = [], title = 'Documento' } = {}) {
  const json = editor.getJSON();
  const commentIds = new Map();
  const changeIds = new Map();
  let nextChange = 1;
  const numbering = [];
  let listCounter = 0;

  // Comentários: cada thread vira um comentário do Word, e as respostas ficam encadeadas.
  const docxComments = [];
  let nextComment = 0;
  for (const thread of comments) {
    const id = nextComment++;
    commentIds.set(thread.id, id);
    docxComments.push({
      id,
      author: thread.author || 'Usuário',
      date: thread.createdAt ? new Date(thread.createdAt) : new Date(),
      resolved: Boolean(thread.resolved),
      children: [new Paragraph({ children: [new TextRun(thread.text || '')] })],
    });
    for (const reply of thread.replies || []) {
      docxComments.push({
        id: nextComment++,
        parentId: id,
        author: reply.author || 'Usuário',
        date: reply.createdAt ? new Date(reply.createdAt) : new Date(),
        children: [new Paragraph({ children: [new TextRun(reply.text || '')] })],
      });
    }
  }

  const changeId = (key) => {
    if (!changeIds.has(key)) changeIds.set(key, nextChange++);
    return changeIds.get(key);
  };

  /** Converte o conteúdo inline (texto com marcas, imagens em linha, campos). */
  async function inline(nodes = [], base = {}) {
    const out = [];
    const openComments = new Set();
    for (const node of nodes) {
      const marks = node.marks || [];
      const comment = marks.find((m) => m.type === 'comment');
      const commentId = comment && commentIds.has(comment.attrs.id) ? commentIds.get(comment.attrs.id) : null;
      if (commentId !== null && !openComments.has(commentId)) {
        openComments.add(commentId);
        out.push(new CommentRangeStart(commentId));
      }
      for (const open of [...openComments]) {
        if (open !== commentId) {
          out.push(new CommentRangeEnd(open), new TextRun({ children: [new CommentReference(open)] }));
          openComments.delete(open);
        }
      }

      let text = '';
      if (node.type === 'text') text = node.text;
      else if (node.type === 'hardBreak') {
        out.push(new TextRun({ break: 1 }));
        continue;
      } else if (node.type === 'mention') text = '@' + (node.attrs.label || node.attrs.id);
      else if (node.type === 'mergeField') text = `{{${node.attrs.key}}}`;
      else if (node.type === 'inlineMath') text = node.attrs.latex;
      else if (node.type === 'anchor') {
        out.push(new Bookmark({ id: node.attrs.id, children: [new TextRun('')] }));
        continue;
      } else continue;

      const opts = { ...base, text };
      for (const m of marks) {
        if (m.type === 'bold') opts.bold = true;
        if (m.type === 'italic') opts.italics = true;
        if (m.type === 'underline') opts.underline = {};
        if (m.type === 'strike') opts.strike = true;
        if (m.type === 'subscript') opts.subScript = true;
        if (m.type === 'superscript') opts.superScript = true;
        if (m.type === 'code') opts.font = 'Courier New';
        if (m.type === 'highlight') opts.shading = { type: ShadingType.CLEAR, fill: hex(m.attrs.color || '#fff3a3'), color: 'auto' };
        if (m.type === 'textStyle') {
          if (m.attrs.color) opts.color = hex(m.attrs.color);
          if (m.attrs.fontFamily) opts.font = m.attrs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
          if (m.attrs.fontSize) opts.size = halfPoints(m.attrs.fontSize);
          if (m.attrs.backgroundColor) opts.shading = { type: ShadingType.CLEAR, fill: hex(m.attrs.backgroundColor), color: 'auto' };
        }
      }
      const ins = marks.find((m) => m.type === 'insertion');
      const del = marks.find((m) => m.type === 'deletion');
      const link = marks.find((m) => m.type === 'link');
      let run;
      if (ins) run = new InsertedTextRun({ ...opts, id: changeId(ins.attrs.id), author: ins.attrs.author || 'Usuário', date: ins.attrs.date || new Date().toISOString() });
      else if (del) run = new DeletedTextRun({ ...opts, id: changeId(del.attrs.id), author: del.attrs.author || 'Usuário', date: del.attrs.date || new Date().toISOString() });
      else run = new TextRun(opts);
      if (link) {
        const href = link.attrs.href || '';
        const styled = new TextRun({ ...opts, color: '1D4ED8', underline: {} });
        out.push(href.startsWith('#')
          ? new InternalHyperlink({ anchor: href.slice(1), children: [styled] })
          : new ExternalHyperlink({ link: href, children: [styled] }));
      } else out.push(run);
    }
    for (const open of openComments) out.push(new CommentRangeEnd(open), new TextRun({ children: [new CommentReference(open)] }));
    return out;
  }

  function paragraphOptions(node) {
    const attrs = node.attrs || {};
    const opts = {};
    if (attrs.textAlign && ALIGN[attrs.textAlign]) opts.alignment = ALIGN[attrs.textAlign];
    const indent = parseInt(cssProp(attrs.blockStyle, 'margin-left'), 10);
    if (indent) opts.indent = { left: twips(indent) };
    const lh = parseFloat(cssProp(attrs.blockStyle, 'line-height'));
    if (lh && lh < 5) opts.spacing = { line: Math.round(lh * 240) };
    if (attrs.dir === 'rtl') opts.bidirectional = true;
    return opts;
  }

  async function image(node) {
    try {
      const response = await fetch(node.attrs.src);
      if (!response.ok) throw new Error('falha');
      const blob = await response.blob();
      let data = await blob.arrayBuffer();
      let type = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[blob.type];
      const bitmap = await createImageBitmap(blob);
      if (!type) {
        // O Word não lê WEBP: converte para PNG.
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        data = await (await new Promise((r) => canvas.toBlob(r, 'image/png'))).arrayBuffer();
        type = 'png';
      }
      const maxWidth = 600;
      const width = Math.min(maxWidth, node.attrs.width || bitmap.width);
      const height = Math.round(width * bitmap.height / bitmap.width);
      bitmap.close?.();
      const children = [new Paragraph({
        alignment: node.attrs.align === 'center' ? AlignmentType.CENTER : node.attrs.align?.includes('right') ? AlignmentType.RIGHT : undefined,
        children: [new ImageRun({ type, data, transformation: { width, height }, altText: { name: node.attrs.alt || 'imagem', description: node.attrs.alt || '', title: node.attrs.alt || 'imagem' } })],
      })];
      if (node.attrs.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: node.attrs.caption, italics: true, size: 18 })] }));
      return children;
    } catch {
      return [new Paragraph({ children: [new TextRun({ text: `[imagem: ${node.attrs.alt || node.attrs.src}]`, italics: true })] })];
    }
  }

  function newList(ordered, listStyle) {
    const reference = `lista-${listCounter++}`;
    const formats = ordered
      ? { 'lower-alpha': LevelFormat.LOWER_LETTER, 'upper-alpha': LevelFormat.UPPER_LETTER, 'lower-roman': LevelFormat.LOWER_ROMAN, 'upper-roman': LevelFormat.UPPER_ROMAN }
      : {};
    const levels = Array.from({ length: 9 }, (_, level) => ({
      level,
      format: ordered ? (formats[listStyle] || LevelFormat.DECIMAL) : LevelFormat.BULLET,
      text: ordered ? `%${level + 1}.` : ['•', '◦', '▪'][level % 3],
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    }));
    numbering.push({ reference, levels });
    return reference;
  }

  async function blocks(nodes = [], ctx = {}) {
    const out = [];
    for (const node of nodes) {
      switch (node.type) {
        case 'paragraph':
          out.push(new Paragraph({
            ...paragraphOptions(node),
            ...(ctx.list ? { numbering: { reference: ctx.list, level: ctx.level } } : {}),
            ...(ctx.quote ? { indent: { left: 567 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '93C5FD', space: 8 } } } : {}),
            children: await inline(node.content, ctx.quote ? { italics: true } : {}),
          }));
          // Somente o primeiro parágrafo de um item recebe o marcador.
          if (ctx.list) ctx = { ...ctx, list: null, quote: ctx.quote };
          break;
        case 'heading':
          out.push(new Paragraph({ ...paragraphOptions(node), heading: HEADINGS[node.attrs.level] || HeadingLevel.HEADING_1, children: await inline(node.content) }));
          break;
        case 'blockquote':
          out.push(...await blocks(node.content, { ...ctx, quote: true }));
          break;
        case 'codeBlock':
          for (const line of (node.content?.map((c) => c.text).join('') || '').split('\n')) {
            out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'F0F4F9', color: 'auto' }, children: [new TextRun({ text: line, font: 'Courier New', size: 20 })] }));
          }
          break;
        case 'bulletList':
        case 'orderedList': {
          const ordered = node.type === 'orderedList';
          const reference = ctx.listRef?.ordered === ordered ? ctx.listRef.reference : newList(ordered, cssProp(node.attrs?.blockStyle, 'list-style-type'));
          const level = ctx.listRef ? ctx.level + 1 : 0;
          for (const item of node.content || []) {
            out.push(...await blocks(item.content, { ...ctx, list: reference, level, listRef: { reference, ordered } }));
          }
          break;
        }
        case 'taskList':
          for (const item of node.content || []) {
            const [first, ...rest] = item.content || [];
            out.push(new Paragraph({
              indent: { left: 360 * ((ctx.level || 0) + 1) },
              children: [new TextRun(item.attrs.checked ? '☑ ' : '☐ '), ...await inline(first?.content)],
            }));
            out.push(...await blocks(rest, { ...ctx, level: (ctx.level || 0) + 1 }));
          }
          break;
        case 'horizontalRule':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C5D1DF', space: 1 } }, children: [] }));
          break;
        case 'pageBreak':
          out.push(new Paragraph({ children: [new PageBreak()] }));
          break;
        case 'image':
          out.push(...await image(node));
          break;
        case 'videoEmbed':
          out.push(new Paragraph({ children: [new ExternalHyperlink({ link: node.attrs.src, children: [new TextRun({ text: `Vídeo: ${node.attrs.src}`, color: '1D4ED8', underline: {} })] })] }));
          break;
        case 'blockMath':
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: node.attrs.latex, font: 'Cambria Math' })] }));
          break;
        case 'details': {
          const [summary, content] = node.content || [];
          out.push(new Paragraph({ children: (await inline(summary?.content)).map((r) => r), heading: HeadingLevel.HEADING_4 }));
          out.push(...await blocks(content?.content, ctx));
          break;
        }
        case 'table':
          out.push(await table(node));
          out.push(new Paragraph({ children: [] }));
          break;
        default:
          if (node.content) out.push(...await blocks(node.content, ctx));
      }
    }
    return out;
  }

  async function table(node) {
    const rows = [];
    for (const row of node.content || []) {
      const cells = [];
      let isHeaderRow = true;
      for (const cell of row.content || []) {
        if (cell.type !== 'tableHeader') isHeaderRow = false;
        const bg = hex(cssProp(cell.attrs.blockStyle, 'background-color')) || (cell.type === 'tableHeader' ? 'EEF4FB' : undefined);
        const children = await blocks(cell.content);
        cells.push(new TableCell({
          columnSpan: cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined,
          rowSpan: cell.attrs.rowspan > 1 ? cell.attrs.rowspan : undefined,
          shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
          children: children.length ? children : [new Paragraph('')],
        }));
      }
      rows.push(new TableRow({ tableHeader: isHeaderRow, children: cells }));
    }
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  const children = await blocks(json.content);
  const doc = new Document({
    title,
    creator: 'Orquestra Editor',
    numbering: { config: numbering },
    comments: { children: docxComments },
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}
