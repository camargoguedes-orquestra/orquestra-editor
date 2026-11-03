import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Percorre o documento e devolve os intervalos marcados com a marca `type` e o id `id`. */
function markRanges(doc, type, id = null) {
  const ranges = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const mark = node.marks.find((m) => m.type.name === type && (id === null || m.attrs.id === id));
    if (mark) ranges.push({ from: pos, to: pos + node.nodeSize, mark, node });
    return false;
  });
  return ranges;
}

/* ------------------------------------------------------------------ */
/* Comentários                                                         */
/* ------------------------------------------------------------------ */

/**
 * Marca o trecho comentado. O conteúdo das conversas fica fora do HTML
 * (editor.getComments()) e é salvo junto com o documento.
 */
export const Comment = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => ({ 'data-comment-id': attrs.id }),
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-resolved') === 'true',
        renderHTML: (attrs) => (attrs.resolved ? { 'data-resolved': 'true' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'oe-comment' }), 0];
  },

  addCommands() {
    return {
      setComment: (id) => ({ commands }) => commands.setMark(this.name, { id }),
      unsetComment: (id) => ({ state, tr, dispatch }) => {
        const ranges = markRanges(state.doc, this.name, id);
        if (!ranges.length) return false;
        if (dispatch) {
          ranges.forEach(({ from, to, mark }) => tr.removeMark(from, to, mark));
          dispatch(tr);
        }
        return true;
      },
      setCommentResolved: (id, resolved) => ({ state, tr, dispatch }) => {
        const ranges = markRanges(state.doc, this.name, id);
        if (!ranges.length) return false;
        if (dispatch) {
          ranges.forEach(({ from, to, mark }) => {
            tr.removeMark(from, to, mark);
            tr.addMark(from, to, this.type.create({ ...mark.attrs, resolved }));
          });
          dispatch(tr);
        }
        return true;
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Controle de alterações (modo sugestão)                              */
/* ------------------------------------------------------------------ */

const changeAttributes = () => ({
  id: {
    default: null,
    parseHTML: (el) => el.getAttribute('data-change-id'),
    renderHTML: (attrs) => ({ 'data-change-id': attrs.id }),
  },
  author: {
    default: null,
    parseHTML: (el) => el.getAttribute('data-author'),
    renderHTML: (attrs) => (attrs.author ? { 'data-author': attrs.author } : {}),
  },
  date: {
    default: null,
    parseHTML: (el) => el.getAttribute('data-date'),
    renderHTML: (attrs) => (attrs.date ? { 'data-date': attrs.date } : {}),
  },
});

export const Insertion = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'deletion',
  addAttributes: changeAttributes,
  parseHTML: () => [{ tag: 'ins[data-change-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['ins', mergeAttributes(HTMLAttributes, { class: 'oe-ins' }), 0],
});

export const Deletion = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion',
  addAttributes: changeAttributes,
  parseHTML: () => [{ tag: 'del[data-change-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['del', mergeAttributes(HTMLAttributes, { class: 'oe-del' }), 0],
});

export const trackChangesKey = new PluginKey('orquestraTrackChanges');

/**
 * Quando ativado, o texto digitado ou colado entra como inserção sugerida e o texto
 * apagado fica riscado como exclusão sugerida, até alguém aceitar ou rejeitar.
 * Limitações conhecidas: quebras de parágrafo e mudanças de formatação não são rastreadas.
 */
export const TrackChanges = Extension.create({
  name: 'trackChanges',

  addOptions() {
    return { author: 'Usuário', enabled: false };
  },

  addStorage() {
    return { enabled: this.options.enabled, author: this.options.author };
  },

  addCommands() {
    const resolve = (type, id, accept) => ({ state, tr, dispatch }) => {
      const ranges = markRanges(state.doc, type, id);
      if (!ranges.length) return false;
      if (dispatch) {
        const removeText = (type === 'insertion') !== accept;
        for (const { from, to, mark } of ranges.reverse()) {
          if (removeText) tr.delete(from, to);
          else tr.removeMark(from, to, mark);
        }
        tr.setMeta(trackChangesKey, { skip: true });
        dispatch(tr);
      }
      return true;
    };
    const resolveAll = (accept) => ({ state, tr, dispatch }) => {
      const all = [...markRanges(state.doc, 'insertion'), ...markRanges(state.doc, 'deletion')];
      if (!all.length) return false;
      if (dispatch) {
        all.sort((a, b) => b.from - a.from);
        for (const { from, to, mark } of all) {
          const removeText = (mark.type.name === 'insertion') !== accept;
          if (removeText) tr.delete(from, to);
          else tr.removeMark(from, to, mark);
        }
        tr.setMeta(trackChangesKey, { skip: true });
        dispatch(tr);
      }
      return true;
    };
    const typeOf = (state, id) => (markRanges(state.doc, 'insertion', id).length ? 'insertion' : 'deletion');
    return {
      setTrackChanges: (enabled) => () => {
        this.storage.enabled = Boolean(enabled);
        return true;
      },
      setTrackChangesAuthor: (author) => () => {
        this.storage.author = String(author || 'Usuário');
        return true;
      },
      acceptChange: (id) => (props) => resolve(typeOf(props.state, id), id, true)(props),
      rejectChange: (id) => (props) => resolve(typeOf(props.state, id), id, false)(props),
      acceptAllChanges: () => resolveAll(true),
      rejectAllChanges: () => resolveAll(false),
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    const schema = this.editor.schema;

    const attrsFor = (state, pos, type) => {
      // Reaproveita o id da alteração vizinha do mesmo autor, para agrupar a digitação.
      const $pos = state.doc.resolve(pos);
      const neighbour = ($pos.nodeBefore?.marks || []).find((m) => m.type.name === type && m.attrs.author === ext.storage.author);
      return neighbour ? neighbour.attrs : { id: uid('alt'), author: ext.storage.author, date: new Date().toISOString() };
    };

    /** Marca o intervalo como excluído; texto que já era inserção do mesmo autor é apagado de verdade. */
    const markDeletion = (state, tr, from, to) => {
      const attrs = attrsFor(state, from, 'deletion');
      const realDelete = [];
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isInline) return true;
        const start = Math.max(pos, from);
        const end = Math.min(pos + node.nodeSize, to);
        if (start >= end) return false;
        const ins = node.marks.find((m) => m.type.name === 'insertion');
        if (ins && ins.attrs.author === ext.storage.author) realDelete.push([start, end]);
        else if (!node.marks.some((m) => m.type.name === 'deletion')) tr.addMark(start, end, schema.marks.deletion.create(attrs));
        return false;
      });
      for (const [a, b] of realDelete.reverse()) tr.delete(a, b);
    };

    const insertTracked = (state, tr, pos, content) => {
      const attrs = attrsFor(state, pos, 'insertion');
      const before = tr.doc.content.size;
      tr.insert(pos, content);
      const end = pos + (tr.doc.content.size - before);
      tr.removeMark(pos, end, schema.marks.deletion);
      tr.addMark(pos, end, schema.marks.insertion.create(attrs));
      return end;
    };

    const isDeleted = (doc, pos) => {
      const $p = doc.resolve(pos);
      return Boolean($p.nodeAfter?.marks.some((m) => m.type.name === 'deletion'));
    };

    return [new Plugin({
      key: trackChangesKey,
      props: {
        handleTextInput(view, from, to, text) {
          if (!ext.storage.enabled) return false;
          const { state } = view;
          const tr = state.tr;
          if (from < to) markDeletion(state, tr, from, to);
          const pos = tr.mapping.map(to);
          const marks = (state.storedMarks || state.doc.resolve(from).marks())
            .filter((m) => !['insertion', 'deletion'].includes(m.type.name));
          const end = insertTracked(state, tr, pos, schema.text(text, marks));
          tr.setSelection(TextSelection.create(tr.doc, end));
          view.dispatch(tr.scrollIntoView());
          return true;
        },
        handleKeyDown(view, event) {
          if (!ext.storage.enabled) return false;
          if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
          const { state } = view;
          const { from, to, empty, $from } = state.selection;
          const tr = state.tr;
          if (!empty) {
            markDeletion(state, tr, from, to);
            const cursor = event.key === 'Backspace' ? tr.mapping.map(from, -1) : tr.mapping.map(to);
            tr.setSelection(TextSelection.create(tr.doc, cursor));
            view.dispatch(tr);
            return true;
          }
          const start = $from.start();
          const end = $from.end();
          if (event.key === 'Backspace') {
            let pos = from;
            while (pos > start && isDeleted(state.doc, pos - 1)) pos--;
            if (pos <= start) return false; // junção de parágrafos: comportamento normal
            markDeletion(state, tr, pos - 1, pos);
            tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(pos - 1, -1)));
          } else {
            let pos = from;
            while (pos < end && isDeleted(state.doc, pos)) pos++;
            if (pos >= end) return false;
            markDeletion(state, tr, pos, pos + 1);
            tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(pos + 1)));
          }
          view.dispatch(tr);
          return true;
        },
        handlePaste(view, event, slice) {
          if (!ext.storage.enabled) return false;
          const { state } = view;
          const { from, to } = state.selection;
          const tr = state.tr;
          if (from < to) markDeletion(state, tr, from, to);
          const pos = tr.mapping.map(to);
          // Conteúdo de um só parágrafo entra em linha; o restante entra como blocos.
          const content = slice.content.childCount === 1 && slice.content.firstChild.isTextblock
            ? slice.content.firstChild.content
            : slice.content;
          const end = insertTracked(state, tr, pos, content);
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size))));
          view.dispatch(tr.scrollIntoView());
          return true;
        },
      },
    })];
  },
});

/** Lista as alterações sugeridas para o painel lateral. */
export function listChanges(doc) {
  const map = new Map();
  for (const type of ['insertion', 'deletion']) {
    for (const { mark, node } of markRanges(doc, type)) {
      const key = mark.attrs.id;
      const entry = map.get(key) || { id: key, type, author: mark.attrs.author, date: mark.attrs.date, text: '' };
      entry.text += node.textContent || (node.type.name === 'image' ? '[imagem]' : '');
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

/* ------------------------------------------------------------------ */
/* Localizar e substituir                                              */
/* ------------------------------------------------------------------ */

export const searchKey = new PluginKey('orquestraSearch');

/** Busca com realce de todas as ocorrências, navegação, maiúsculas/minúsculas e expressão regular. */
export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addStorage() {
    return { term: '', caseSensitive: false, regex: false, wholeWord: false, results: [], index: 0, error: null };
  },

  addCommands() {
    const refresh = (tr, dispatch) => {
      if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
      return true;
    };
    const go = (step) => ({ editor, tr, dispatch }) => {
      const s = this.storage;
      if (!s.results.length) return false;
      s.index = (s.index + step + s.results.length) % s.results.length;
      const { from, to } = s.results[s.index];
      tr.setSelection(TextSelection.create(tr.doc, from, to)).scrollIntoView();
      if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
      requestAnimationFrame(() => editor.view.dom.querySelector('.oe-search-current')?.scrollIntoView({ block: 'center' }));
      return true;
    };
    return {
      setSearchTerm: (term, opts = {}) => ({ tr, dispatch }) => {
        Object.assign(this.storage, { term: String(term || ''), index: 0 }, opts);
        return refresh(tr, dispatch);
      },
      clearSearch: () => ({ tr, dispatch }) => {
        Object.assign(this.storage, { term: '', results: [], index: 0 });
        return refresh(tr, dispatch);
      },
      nextSearchResult: () => go(1),
      previousSearchResult: () => go(-1),
      replaceCurrent: (replacement) => ({ state, tr, dispatch }) => {
        const s = this.storage;
        const hit = s.results[s.index];
        if (!hit) return false;
        if (dispatch) {
          const marks = state.doc.resolve(hit.from + 1).marks();
          if (replacement) tr.replaceWith(hit.from, hit.to, state.schema.text(replacement, marks));
          else tr.delete(hit.from, hit.to);
          dispatch(tr.setMeta(searchKey, { refresh: true }));
        }
        return true;
      },
      replaceAll: (replacement) => ({ state, tr, dispatch }) => {
        const hits = [...this.storage.results];
        if (!hits.length) return false;
        if (dispatch) {
          for (const hit of hits.reverse()) {
            const marks = state.doc.resolve(hit.from + 1).marks();
            if (replacement) tr.replaceWith(hit.from, hit.to, state.schema.text(replacement, marks));
            else tr.delete(hit.from, hit.to);
          }
          dispatch(tr.setMeta(searchKey, { refresh: true }));
        }
        this.storage.lastReplaced = hits.length;
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const find = (doc) => {
      storage.results = [];
      storage.error = null;
      if (!storage.term) return DecorationSet.empty;
      let re;
      try {
        let source = storage.regex ? storage.term : storage.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (storage.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
        re = new RegExp(source, storage.caseSensitive ? 'gu' : 'giu');
      } catch (e) {
        storage.error = 'Expressão regular inválida';
        return DecorationSet.empty;
      }
      // Busca dentro de cada bloco de texto, mapeando o índice do texto para posições do documento.
      doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        let text = '';
        const offsets = [];
        node.forEach((child, offset) => {
          if (child.isText) {
            for (let i = 0; i < child.text.length; i++) offsets.push(pos + 1 + offset + i);
            text += child.text;
          } else {
            offsets.push(pos + 1 + offset);
            text += '￼';
          }
        });
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
          if (!m[0].length) {
            re.lastIndex++;
            continue;
          }
          storage.results.push({ from: offsets[m.index], to: offsets[m.index + m[0].length - 1] + 1 });
          if (storage.results.length > 5000) break;
        }
        return false;
      });
      if (storage.index >= storage.results.length) storage.index = 0;
      return DecorationSet.create(doc, storage.results.map((r, i) => Decoration.inline(r.from, r.to, {
        class: i === storage.index ? 'oe-search-hit oe-search-current' : 'oe-search-hit',
      })));
    };
    return [new Plugin({
      key: searchKey,
      state: {
        init: (_, state) => find(state.doc),
        apply: (tr, old, _o, state) => (tr.docChanged || tr.getMeta(searchKey) ? find(state.doc) : old),
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    })];
  },
});
