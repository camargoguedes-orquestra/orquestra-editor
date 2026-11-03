/**
 * Sanitização de HTML por lista de permissões.
 *
 * O motor (Tiptap/ProseMirror) já descarta o que não está no schema, mas este filtro
 * continua sendo aplicado na entrada (setHTML, colar, importação) e na saída (getHTML),
 * para que o HTML persistido seja sempre previsível. O servidor deve aplicar uma
 * sanitização equivalente antes de gravar (veja docs/SEGURANCA.md).
 */

export const ESC = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

const ALLOWED = new Set((
  'p div br span strong b em i u s strike del ins sub sup h1 h2 h3 h4 h5 h6 blockquote ul ol li ' +
  'table caption colgroup col thead tbody tfoot tr td th a img hr pre code figure figcaption iframe ' +
  'input label mark small kbd cite dl dt dd section article header footer aside details summary'
).split(' '));

const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'noscript', 'object', 'embed', 'svg', 'math', 'form', 'meta', 'link', 'base',
  'template', 'title', 'head', 'xml',
]);

const SAFE_CSS = new Set((
  'color background-color text-align font-size font-family font-weight font-style text-decoration ' +
  'text-decoration-line text-transform margin margin-left margin-right margin-top margin-bottom padding padding-left ' +
  'padding-right padding-top padding-bottom width height max-width max-height min-width min-height border ' +
  'border-color border-width border-style border-top border-right border-bottom border-left border-collapse ' +
  'border-spacing list-style-type vertical-align line-height letter-spacing page-break-before page-break-after ' +
  'break-before break-after white-space float clear display direction'
).split(' '));

const SAFE_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel', 'id', 'name'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  iframe: ['src', 'width', 'height', 'title', 'allowfullscreen', 'loading', 'referrerpolicy'],
  td: ['colspan', 'rowspan', 'scope', 'colwidth'],
  th: ['colspan', 'rowspan', 'scope', 'colwidth'],
  col: ['span'],
  input: ['type', 'checked', 'disabled'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  details: ['open'],
  code: ['class'],
  pre: ['class'],
};

const GLOBAL_ATTRIBUTES = ['dir', 'id'];

/** Converte valores do antigo <font size="1..7"> em tamanhos CSS. */
const FONT_SIZES = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };

export function secureURL(value, image = false) {
  const v = String(value || '').trim();
  try {
    if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    if (image && v.startsWith('blob:')) return v;
    if (!image && v.startsWith('#') && /^#[a-zA-Z][\w:.-]{0,79}$/.test(v)) return v;
    if (!image && /^mailto:[^\s<>"']+$/i.test(v)) return v;
    if (!image && /^tel:[+\d\s().-]+$/i.test(v)) return v;
    if (v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && !/[<>"'\s]/.test(v)) return v;
    const u = new URL(v, location.href);
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    return v;
  } catch {
    return null;
  }
}

/** Aceita somente YouTube e Vimeo e devolve a URL de incorporação canônica. */
export function secureMedia(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    let id = null;
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(u.hostname) && u.pathname === '/watch') {
      id = u.searchParams.get('v');
    }
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(u.hostname)) {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2];
    }
    if (id && /^[\w-]{11}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(u.hostname)) {
      const m = u.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/);
      if (m) return 'https://player.vimeo.com/video/' + m[1];
    }
  } catch {
    /* URL inválida */
  }
  return null;
}

/** Filtra uma declaração CSS inline, devolvendo apenas propriedades seguras normalizadas. */
export function sanitizeStyle(value, { omit = [] } = {}) {
  const dummy = document.createElement('span');
  dummy.setAttribute('style', String(value || ''));
  const styles = [];
  for (const prop of dummy.style) {
    if (!SAFE_CSS.has(prop) || omit.includes(prop)) continue;
    const v = dummy.style.getPropertyValue(prop).trim();
    if (!v || /[<>\\]|url\s*\(|expression\s*\(|@import|var\s*\(|javascript:/i.test(v)) continue;
    if (v.length > 160 || /[;{}]/.test(v)) continue;
    styles.push(`${prop}:${v}`);
  }
  return styles.join(';');
}

/**
 * Ajusta HTML legado antes da análise: <font> vira <span style>, checklists da versão 2
 * viram itens de tarefa do novo motor e comentários condicionais do Word são removidos.
 */
export function migrateLegacyHTML(html) {
  const dom = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  dom.querySelectorAll('font').forEach((font) => {
    const span = dom.createElement('span');
    const parts = [];
    if (font.getAttribute('color')) parts.push(`color:${font.getAttribute('color')}`);
    if (font.getAttribute('face')) parts.push(`font-family:${font.getAttribute('face')}`);
    const size = FONT_SIZES[font.getAttribute('size')];
    if (size) parts.push(`font-size:${size}`);
    if (font.getAttribute('style')) parts.push(font.getAttribute('style'));
    if (parts.length) span.setAttribute('style', parts.join(';'));
    span.append(...font.childNodes);
    font.replaceWith(span);
  });
  dom.querySelectorAll('ul').forEach((ul) => {
    const items = [...ul.children].filter((li) => li.tagName === 'LI');
    const isChecklist = items.length && items.every((li) => li.querySelector(':scope > input[type=checkbox]'));
    if (!isChecklist || ul.getAttribute('data-type')) return;
    ul.setAttribute('data-type', 'taskList');
    items.forEach((li) => {
      const box = li.querySelector(':scope > input[type=checkbox]');
      li.setAttribute('data-type', 'taskItem');
      li.setAttribute('data-checked', String(box.hasAttribute('checked') || box.checked));
      box.remove();
      const p = dom.createElement('p');
      p.append(...li.childNodes);
      p.innerHTML = p.innerHTML.trim();
      li.replaceChildren(p);
    });
  });
  return dom.body.innerHTML;
}

export function sanitizeHTML(html) {
  const dom = new DOMParser().parseFromString(migrateLegacyHTML(html), 'text/html');
  // Reconstrói os nós em um documento inerte, preservando apenas o que está na lista de permissões.
  const cleanDoc = document.implementation.createHTMLDocument('orquestra-sanitized');

  const cleanse = (n) => {
    if (n.nodeType === 3) return cleanDoc.createTextNode(n.textContent || '');
    if (n.nodeType !== 1) return null;
    const tag = n.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag) || tag.includes(':')) return null;
    if (!ALLOWED.has(tag)) {
      const frag = cleanDoc.createDocumentFragment();
      for (const c of n.childNodes) {
        const v = cleanse(c);
        if (v) frag.appendChild(v);
      }
      return frag;
    }
    const el = cleanDoc.createElement(tag);
    for (const attr of [...n.attributes]) {
      const key = attr.name.toLowerCase();
      let value = attr.value;
      if (key === 'style') {
        const style = sanitizeStyle(value);
        if (style) el.setAttribute('style', style);
        continue;
      }
      if (key.startsWith('data-')) {
        // Atributos data-* descrevem nós do editor (tarefas, matemática, menções, comentários).
        if (!/^data-[a-z0-9-]{1,40}$/.test(key) || value.length > 4000 || /javascript:|<script/i.test(value)) continue;
        el.setAttribute(key, value);
        continue;
      }
      const allowed = (SAFE_ATTRIBUTES[tag] || []).includes(key) || GLOBAL_ATTRIBUTES.includes(key);
      if (!allowed) continue;
      if (key === 'src' || key === 'href') {
        if (tag === 'iframe') {
          value = secureMedia(value);
          if (!value) return null;
        } else {
          value = secureURL(value, tag === 'img');
          if (!value) continue;
        }
      }
      if (key === 'type' && tag === 'input' && value !== 'checkbox') continue;
      if (key === 'id' && !/^[a-zA-Z][a-zA-Z0-9_:.-]{0,79}$/.test(value)) continue;
      if (key === 'name' && !/^[a-zA-Z][a-zA-Z0-9_:.-]{0,79}$/.test(value)) continue;
      if (key === 'dir' && !['ltr', 'rtl', 'auto'].includes(value)) continue;
      if (key === 'loading' && !['lazy', 'eager'].includes(value)) continue;
      if (key === 'scope' && !['col', 'row', 'colgroup', 'rowgroup'].includes(value)) continue;
      if (key === 'type' && tag === 'ol' && !['1', 'a', 'A', 'i', 'I'].includes(value)) continue;
      if (key === 'class' && !/^language-[\w+#-]{1,40}$/.test(value)) continue;
      if (key === 'colwidth' && !/^\d{1,4}(,\d{1,4})*$/.test(value)) continue;
      if (['colspan', 'rowspan', 'width', 'height', 'start', 'value', 'span'].includes(key) && !/^\d{1,4}$/.test(value)) continue;
      if (key === 'target' && !['_blank', '_self'].includes(value)) continue;
      if (['checked', 'disabled', 'reversed', 'open', 'allowfullscreen'].includes(key)) value = '';
      el.setAttribute(key, value);
    }
    if (tag === 'img' && !el.getAttribute('src')) return null;
    if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
    if (tag === 'iframe') {
      el.setAttribute('loading', 'lazy');
      el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      el.setAttribute('allowfullscreen', '');
    }
    for (const c of n.childNodes) {
      const v = cleanse(c);
      if (v) el.appendChild(v);
    }
    return el;
  };

  for (const child of dom.body.childNodes) {
    const v = cleanse(child);
    if (v) cleanDoc.body.appendChild(v);
  }
  return cleanDoc.body.innerHTML;
}

/**
 * Limpa HTML colado do Word, Google Docs e LibreOffice: remove classes mso, parágrafos
 * vazios de marcação, spans sem estilo útil e converte listas do Word em listas HTML.
 */
export function cleanOfficeHTML(html) {
  let source = String(html || '');
  const fromWord = /class="?Mso|urn:schemas-microsoft-com|<o:p>/i.test(source);
  const fromGoogle = /id="docs-internal-guid/i.test(source);
  if (!fromWord && !fromGoogle) return source;
  source = source
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/<\/?(?:w|m|v):[^>]*>/gi, '');
  const dom = new DOMParser().parseFromString(source, 'text/html');

  if (fromGoogle) {
    // O Google Docs embrulha tudo em <b style="font-weight:normal">.
    dom.querySelectorAll('b[id^="docs-internal-guid"]').forEach((b) => b.replaceWith(...b.childNodes));
    dom.querySelectorAll('span').forEach((span) => {
      const st = span.style;
      if (st.fontWeight === '700' || st.fontWeight === 'bold') wrap(span, 'strong');
      if (st.fontStyle === 'italic') wrap(span, 'em');
      if (/underline/.test(st.textDecoration)) wrap(span, 'u');
      if (/line-through/.test(st.textDecoration)) wrap(span, 's');
    });
  }

  if (fromWord) {
    // Listas do Word chegam como <p class="MsoListParagraph"> com "mso-list:l0 level1".
    const paragraphs = [...dom.querySelectorAll('p')];
    let currentList = null;
    for (const p of paragraphs) {
      const style = p.getAttribute('style') || '';
      const listMatch = style.match(/mso-list:\s*l\d+\s+level(\d+)/i);
      if (!listMatch) {
        currentList = null;
        continue;
      }
      const marker = p.textContent.trim().split(/\s/)[0] || '';
      const ordered = /^[\da-zA-Z]{1,3}[.)]$/.test(marker);
      p.querySelectorAll('span[style*="mso-list:Ignore"], span[style*="mso-list: Ignore"]').forEach((s) => s.remove());
      if (!currentList || currentList.tagName !== (ordered ? 'OL' : 'UL')) {
        currentList = dom.createElement(ordered ? 'ol' : 'ul');
        p.before(currentList);
      }
      const li = dom.createElement('li');
      li.innerHTML = p.innerHTML;
      currentList.append(li);
      p.remove();
    }
    dom.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  }

  dom.querySelectorAll('[style]').forEach((el) => {
    const keep = sanitizeStyle(el.getAttribute('style'), {
      omit: ['font-family', 'line-height', 'margin', 'margin-top', 'margin-bottom', 'width', 'height'],
    }).replace(/(^|;)color:(?:rgb\(0, 0, 0\)|#000000|windowtext)/g, '$1');
    if (keep) el.setAttribute('style', keep);
    else el.removeAttribute('style');
  });
  dom.querySelectorAll('span:not([style])').forEach((s) => s.replaceWith(...s.childNodes));
  return dom.body.innerHTML;

  function wrap(span, tag) {
    const w = dom.createElement(tag);
    w.append(...span.childNodes);
    span.append(w);
  }
}
