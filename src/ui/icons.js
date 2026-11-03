/**
 * Ícones Lucide (licença ISC) importados individualmente, para o pacote final levar
 * somente os ícones usados.
 */
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, AtSign, Baseline, Bold, Bookmark, Braces, CalendarClock,
  CaseSensitive, Check, ChevronDown, Code, Code2, Columns3, Crop, Eye, FileDown, FileText, FileUp, Film,
  GitCompare, GripVertical, Heading, Highlighter, History, Image, ImagePlus, IndentDecrease, IndentIncrease,
  Italic, Link, List, ListCollapse, ListOrdered, ListTodo, ListTree, Maximize2, MessageSquarePlus, Minus, Omega,
  Paintbrush, PaintBucket, PanelRight, Pencil, PilcrowLeft, PilcrowRight, Plus, Printer, Quote, Radical,
  RemoveFormatting, Rows3, Save, Search, SeparatorHorizontal, Sigma, Smile, SquareCode, Strikethrough,
  Subscript, Superscript, Table, TableCellsMerge, TableCellsSplit, Trash2, Type, Underline, Undo2, Redo2,
  Unlink, WrapText, X, ArrowUpDown, ArrowLeftRight, MoveHorizontal,
} from 'lucide';

const ICONS = {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, AtSign, Baseline, Bold, Bookmark, Braces, CalendarClock,
  CaseSensitive, Check, ChevronDown, Code, Code2, Columns3, Crop, Eye, FileDown, FileText, FileUp, Film,
  GitCompare, GripVertical, Heading, Highlighter, History, Image, ImagePlus, IndentDecrease, IndentIncrease,
  Italic, Link, List, ListCollapse, ListOrdered, ListTodo, ListTree, Maximize2, MessageSquarePlus, Minus, Omega,
  Paintbrush, PaintBucket, PanelRight, Pencil, PilcrowLeft, PilcrowRight, Plus, Printer, Quote, Radical,
  RemoveFormatting, Rows3, Save, Search, SeparatorHorizontal, Sigma, Smile, SquareCode, Strikethrough,
  Subscript, Superscript, Table, TableCellsMerge, TableCellsSplit, Trash2, Type, Underline, Undo2, Redo2,
  Unlink, WrapText, X, ArrowUpDown, ArrowLeftRight, MoveHorizontal,
};

const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');

/** Devolve o SVG do ícone como texto; nomes desconhecidos viram texto simples. */
export function icon(name, size = 18) {
  const node = ICONS[name];
  if (!node) return '';
  const children = node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${children}</svg>`;
}
