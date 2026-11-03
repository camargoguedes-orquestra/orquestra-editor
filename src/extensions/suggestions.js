import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
/** O catálogo completo de emojis (~500 KB) é carregado só na primeira busca. */
let emojiCache = null;
export const loadEmojis = () => (emojiCache ||= import('@tiptap/extension-emoji').then((m) => m.emojis));
import { ESC } from '../core/sanitize.js';

/**
 * Janela flutuante comum às sugestões (/comandos, @menções, :emojis: e {{campos}}).
 * Navegação por setas, Enter/Tab para escolher e Esc para fechar.
 */
export function suggestionRenderer(renderItem) {
  return () => {
    let popup;
    let items = [];
    let selected = 0;
    let command;

    const paint = () => {
      if (!popup) return;
      if (!items.length) {
        popup.innerHTML = '<div class="oe-suggest-empty">Nada encontrado</div>';
        return;
      }
      popup.innerHTML = items.map((item, i) => `<button type="button" role="option" aria-selected="${i === selected}" class="oe-suggest-item${i === selected ? ' is-active' : ''}" data-index="${i}">${renderItem(item)}</button>`).join('');
      popup.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    };
    const place = (rect) => {
      if (!popup || !rect) return;
      const r = rect();
      if (!r) return;
      const top = Math.min(window.innerHeight - popup.offsetHeight - 8, r.bottom + 6);
      popup.style.left = Math.max(8, Math.min(window.innerWidth - popup.offsetWidth - 8, r.left)) + 'px';
      popup.style.top = Math.max(8, top) + 'px';
    };

    return {
      onStart(props) {
        items = props.items;
        command = props.command;
        selected = 0;
        popup = document.createElement('div');
        popup.className = 'oe-suggest';
        popup.setAttribute('role', 'listbox');
        popup.addEventListener('mousedown', (e) => e.preventDefault());
        popup.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-index]');
          if (btn) command(items[+btn.dataset.index]);
        });
        document.body.append(popup);
        paint();
        place(props.clientRect);
      },
      onUpdate(props) {
        items = props.items;
        command = props.command;
        selected = Math.min(selected, Math.max(0, items.length - 1));
        paint();
        place(props.clientRect);
      },
      onKeyDown({ event }) {
        if (!items.length) return event.key === 'Escape';
        if (event.key === 'ArrowDown') {
          selected = (selected + 1) % items.length;
          paint();
          return true;
        }
        if (event.key === 'ArrowUp') {
          selected = (selected - 1 + items.length) % items.length;
          paint();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          command(items[selected]);
          return true;
        }
        if (event.key === 'Escape') {
          popup?.remove();
          popup = null;
          return true;
        }
        return false;
      },
      onExit() {
        popup?.remove();
        popup = null;
      },
    };
  };
}

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Comandos de bloco ao digitar "/" no início ou no meio de uma linha (estilo Notion). */
export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return { items: () => [] };
  },

  addProseMirrorPlugins() {
    return [Suggestion({
      editor: this.editor,
      pluginKey: new PluginKey('orquestraSlash'),
      char: '/',
      startOfLine: false,
      allowSpaces: false,
      items: ({ query }) => {
        const q = normalize(query);
        return this.options.items().filter((c) => normalize(`${c.title} ${c.keywords || ''}`).includes(q)).slice(0, 14);
      },
      command: ({ editor, range, props }) => {
        editor.chain().focus().deleteRange(range).run();
        props.run(editor);
      },
      render: suggestionRenderer((c) => `<span class="oe-suggest-icon">${c.icon || ''}</span><span><b>${ESC(c.title)}</b><small>${ESC(c.description || '')}</small></span>`),
    })];
  },
});

/** Emojis ao digitar ":" seguido do nome (em inglês ou pelas palavras-chave do catálogo). */
export const EmojiSuggest = Extension.create({
  name: 'emojiSuggest',

  addProseMirrorPlugins() {
    return [Suggestion({
      editor: this.editor,
      pluginKey: new PluginKey('orquestraEmoji'),
      char: ':',
      items: async ({ query }) => {
        const q = normalize(query);
        if (q.length < 2) return [];
        const all = await loadEmojis();
        return all.filter((e) => e.emoji && (e.shortcodes.some((s) => s.includes(q)) || (e.tags || []).some((t) => t.includes(q)))).slice(0, 10);
      },
      command: ({ editor, range, props }) => {
        editor.chain().focus().deleteRange(range).insertContent(props.emoji).run();
      },
      render: suggestionRenderer((e) => `<span class="oe-suggest-icon">${e.emoji}</span><span><b>:${ESC(e.shortcodes[0])}:</b></span>`),
    })];
  },
});

/** Campos de mesclagem ao digitar "{{". */
export const MergeFieldSuggest = Extension.create({
  name: 'mergeFieldSuggest',

  addOptions() {
    return { fields: () => [] };
  },

  addProseMirrorPlugins() {
    return [Suggestion({
      editor: this.editor,
      pluginKey: new PluginKey('orquestraMergeField'),
      char: '{{',
      allowSpaces: true,
      items: ({ query }) => {
        const q = normalize(query);
        return this.options.fields().filter((f) => normalize(`${f.key} ${f.label}`).includes(q)).slice(0, 12);
      },
      command: ({ editor, range, props }) => {
        editor.chain().focus().deleteRange(range).insertMergeField(props.key, props.label).run();
      },
      render: suggestionRenderer((f) => `<span class="oe-suggest-icon">{ }</span><span><b>${ESC(f.label)}</b><small>{{${ESC(f.key)}}}</small></span>`),
    })];
  },
});

/** Configuração de sugestão para a extensão oficial de menções. */
export function mentionSuggestion(getItems) {
  return {
    char: '@',
    items: async ({ query }) => {
      const list = await getItems(query);
      const q = normalize(query);
      return (list || []).filter((p) => normalize(p.label).includes(q)).slice(0, 10);
    },
    render: suggestionRenderer((p) => `<span class="oe-suggest-avatar">${ESC((p.label || '?').slice(0, 1).toUpperCase())}</span><span><b>${ESC(p.label)}</b>${p.description ? `<small>${ESC(p.description)}</small>` : ''}</span>`),
  };
}

