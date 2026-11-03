import { ImageStudio } from './image-studio.js';

/**
 * Orquestra Editor 2.0 — editor web WYSIWYG independente, sem bibliotecas de terceiros.
 * CUIDADO: o núcleo desta versão usa contenteditable + execCommand em comandos de formatação.
 * execCommand é uma API legada; para edição colaborativa ou documentos complexos, migrar
 * o núcleo para ProseMirror, mantendo os componentes de UI e ImageStudio.
 */
const ESC = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ALLOWED = new Set('p div br span strong b em i u s strike del sub sup h1 h2 h3 h4 h5 h6 blockquote ul ol li table caption colgroup col thead tbody tfoot tr td th a img hr pre code figure figcaption iframe input mark small kbd cite dl dt dd section article header footer aside details summary'.split(' '));
const SAFE_CSS = new Set('color background-color text-align font-size font-family font-weight font-style text-decoration text-decoration-line margin-left margin-right margin-top margin-bottom padding padding-left padding-right padding-top padding-bottom width height max-width max-height min-height border border-color border-width border-style border-collapse border-spacing list-style-type vertical-align line-height letter-spacing page-break-before page-break-after break-before break-after white-space float clear'.split(' '));
const SAFE_ATTRIBUTES = {a: ['href','title','target','rel','id','name'],img:['src','alt','title','width','height','loading'],iframe:['src','width','height','title','allowfullscreen','loading','referrerpolicy'],td:['colspan','rowspan','scope'],th:['colspan','rowspan','scope'],input:['type','checked','disabled'],figure:[],figcaption:[],ol:['start','reversed','type'],li:['value'],details:['open']};
function secureURL(value, image = false) {
  const v = String(value || '').trim();
  try {
    if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    if (image && v.startsWith('blob:')) return v;
    if (v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && !/[<>"'\s]/.test(v)) return v;
    const u = new URL(v, location.href);
    if (!['https:','http:'].includes(u.protocol)) return null;
    return v;
  } catch { return null; }
}
function secureMedia(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    let id = null;
    if (['www.youtube.com', 'youtube.com','m.youtube.com'].includes(u.hostname) && u.pathname === '/watch') id = u.searchParams.get('v');
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    if (['youtube.com','www.youtube.com','www.youtube-nocookie.com'].includes(u.hostname) && u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
    if (id && /^[\w-]{11}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
    if (['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(u.hostname)) {
      const m = u.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/);
      if(m) return 'https://player.vimeo.com/video/' + m[1];
    }
  } catch { /* URL inválida */ }
  return null;
}
export function sanitizeHTML(html) {
  const dom = new DOMParser().parseFromString(String(html), 'text/html');
  // Rebuild nodes in an inert, separate document, preserving only allowlisted information.
  const cleanDoc = document.implementation.createHTMLDocument('orquestra-sanitized');
  const cleanse = n => {
    if(n.nodeType === 3) return cleanDoc.createTextNode(n.textContent || '');
    if(n.nodeType !== 1) return null;
    const tag = n.tagName.toLowerCase();
    if(['script','style','noscript','object','embed','svg','math','form','meta','link','base'].includes(tag)) return null;
    if(!ALLOWED.has(tag)) {
      const frag = cleanDoc.createDocumentFragment();
      for(const c of n.childNodes) { const v=cleanse(c); if(v) frag.appendChild(v); }
      return frag;
    }
    const el = cleanDoc.createElement(tag);
    for(const attr of [...n.attributes]) {
      const key = attr.name.toLowerCase(); let value = attr.value;
      if(key === 'style') {
        const dummy = document.createElement('span'); dummy.setAttribute('style', value);
        const styles = [];
        for (const prop of dummy.style) {
          if (!SAFE_CSS.has(prop)) continue;
          const v = dummy.style.getPropertyValue(prop).trim();
          if(!v || /[<>\\]|url\s*\(|expression\s*\(|@import|var\s*\(/i.test(v)) continue;
          if(v.length > 120 || /[;{}]/.test(v)) continue;
          styles.push(`${prop}:${v}`);
        }
        if(styles.length) el.setAttribute('style', styles.join(';'));
        continue;
      }
      if(!(SAFE_ATTRIBUTES[tag] || []).includes(key)) continue;
      if(key === 'src' || key === 'href') {
        if(tag === 'iframe') { value = secureMedia(value); if(!value) return null; }
        else { value = secureURL(value, tag==='img'); if(!value) continue; }
      }
      if(key === 'type' && tag === 'input' && value !== 'checkbox') continue;
      if (['id','name'].includes(key) && !/^[a-zA-Z][a-zA-Z0-9_:.-]{0,79}$/.test(value)) continue;
      if (key === 'loading' && !['lazy','eager'].includes(value)) continue;
      if (key === 'scope' && !['col','row','colgroup','rowgroup'].includes(value)) continue;
      if (key === 'type' && tag === 'ol' && !['1','a','A','i','I'].includes(value)) continue;
      if(['colspan','rowspan','width','height','start','value'].includes(key)) { if(!/^\d{1,4}$/.test(value)) continue; }
      if(key === 'target' && !['_blank','_self'].includes(value)) continue;
      if(key === 'checked' || key === 'disabled' || key === 'reversed' || key === 'open') value = '';
      el.setAttribute(key,value);
    }
    if(tag === 'img' && !el.getAttribute('src')) return null;
    if(tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel','noopener noreferrer');
    if(tag === 'iframe') { el.setAttribute('loading','lazy'); el.setAttribute('referrerpolicy','strict-origin-when-cross-origin'); el.setAttribute('allowfullscreen',''); }
    for(const c of n.childNodes) {const v=cleanse(c); if(v) el.appendChild(v);}
    return el;
  };
  for(const child of dom.body.childNodes) {const v = cleanse(child); if(v) cleanDoc.body.appendChild(v);}
  return cleanDoc.body.innerHTML;
}

const TOOL_GROUPS = [
  [{id:'undo',symbol:'↶',label:'Desfazer'},{id:'redo',symbol:'↷',label:'Refazer'}],
  [{id:'heading',kind:'select',options:[['P','Parágrafo'],['H1','Título 1'],['H2','Título 2'],['H3','Título 3'],['H4','Título 4'],['H5','Título 5'],['H6','Título 6'],['BLOCKQUOTE','Citação'],['PRE','Pré-formatado']]},
   {id:'font',kind:'select',options:[['Arial','Arial'],['Georgia','Georgia'],['Verdana','Verdana'],['Tahoma','Tahoma'],['Times New Roman','Times New Roman'],['Courier New','Courier New']]},
   {id:'size',kind:'select',options:[['2','10 pt'],['3','12 pt'],['4','14 pt'],['5','18 pt'],['6','24 pt'],['7','36 pt']]},
   {id:'lineHeight',kind:'select',options:[['1','Entrelinha 1,0'],['1.15','Entrelinha 1,15'],['1.5','Entrelinha 1,5'],['2','Entrelinha 2,0'],['2.5','Entrelinha 2,5']]}],
  [{id:'bold',symbol:'B',label:'Negrito',cls:'oe-strong'},{id:'italic',symbol:'I',label:'Itálico',cls:'oe-italic'},{id:'underline',symbol:'U',label:'Sublinhado',cls:'oe-under'},{id:'strikeThrough',symbol:'S̶',label:'Tachado'},
   {id:'subscript',symbol:'x₂',label:'Subscrito'},{id:'superscript',symbol:'x²',label:'Sobrescrito'},{id:'inlineCode',symbol:'{ }',label:'Código inline'}, {id:'highlight',symbol:'▣',label:'Destacar texto'},
   {id:'foreColor',kind:'color',label:'Cor do texto',default:'#223247'}, {id:'hiliteColor',kind:'color',label:'Marca-texto',default:'#fff3a3'}],
  [{id:'justifyLeft',symbol:'≡',label:'Alinhar à esquerda'},{id:'justifyCenter',symbol:'≣',label:'Centralizar'},{id:'justifyRight',symbol:'☷',label:'Alinhar à direita'},{id:'justifyFull',symbol:'▤',label:'Justificar'}],
  [{id:'insertUnorderedList',symbol:'☷',label:'Marcadores'},{id:'insertOrderedList',symbol:'☰',label:'Numeração'}, {id:'checklist',symbol:'☑',label:'Lista de tarefas'}, {id:'liststyle',kind:'select',options:[['disc','Marcador ●'],['circle','Marcador ○'],['square','Marcador ■'],['decimal','Numeração 1.'],['lower-alpha','Numeração a.'],['upper-roman','Numeração I.']]}, {id:'outdent',symbol:'⇤',label:'Diminuir recuo'},{id:'indent',symbol:'⇥',label:'Aumentar recuo'}],
  [{id:'link',symbol:'🔗',label:'Inserir link'},{id:'table',symbol:'▦',label:'Inserir tabela'},{id:'image',symbol:'▧',label:'Inserir e editar imagem'},{id:'gif',symbol:'GIF',label:'GIF animado'},
   {id:'emoji',symbol:'☺',label:'Emojis'},{id:'media',symbol:'▶',label:'Vídeo'},{id:'specialchars',symbol:'Ω',label:'Caracteres especiais'}],
  [{id:'codeblock',symbol:'⌘',label:'Bloco de código'},{id:'template',symbol:'▤',label:'Modelos de documento'},{id:'bookmark',symbol:'⚑',label:'Âncora'}, {id:'hr',symbol:'—',label:'Linha horizontal'},{id:'datetime',symbol:'◷',label:'Data e hora'},{id:'pagebreak',symbol:'⤓',label:'Quebra de página'},{id:'removeFormat',symbol:'Tx',label:'Limpar formatação'}],
  [{id:'tableprops',symbol:'▦⚙',label:'Propriedades da tabela'},{id:'clearDoc',symbol:'⌫',label:'Limpar conteúdo'}, {id:'search',symbol:'⌕',label:'Localizar e substituir'},{id:'source',symbol:'</>',label:'Código HTML'},{id:'preview',symbol:'◉',label:'Visualizar'},{id:'fullscreen',symbol:'⛶',label:'Tela cheia'}],
];
const MENUS = {
  Arquivo: [['Novo documento','new'],['Abrir documento salvo','load'],['Salvar','save'],['Exportar HTML','export-html'],['Exportar texto','export-txt'],['Copiar HTML','copy-html'],['Imprimir / salvar PDF','print']],
  Editar: [['Desfazer','undo'],['Refazer','redo'],['Buscar e substituir','search'],['Selecionar tudo','selectAll'],['Remover formatação','removeFormat'],['Limpar conteúdo','clearDoc']],
  Inserir: [['Imagem / estúdio','image'],['Imagem via URL','image-url'],['GIF animado','gif'],['Emoji','emoji'],['Tabela','table'],['Link','link'],['Vídeo','media'],['Código','codeblock'],['Lista de tarefas','checklist'],['Modelos','template'],['Âncora','bookmark'],['Caracteres especiais','specialchars'],['Data e hora','datetime'],['Linha horizontal','hr'],['Quebra de página','pagebreak']],
  Tabela: [['Propriedades da tabela','tableprops'],['Mesclar com próxima célula','table-merge'],['Dividir célula','table-split'],['Adicionar linha abaixo','table-row'],['Adicionar coluna à direita','table-col'],['Excluir linha','table-delrow'],['Excluir coluna','table-delcol'],['Excluir tabela','table-del']],
  Exibir: [['Somente leitura','readonly'],['Modo página A4','page'],['Modo contínuo','continuous'],['Prévia de impressão','preview'],['Tela cheia','fullscreen'],['Código-fonte HTML','source']],
  Ajuda: [['Atalhos de teclado','help'],['Sobre o editor','about']]
};
const EMOJIS = [
  ['😀','sorriso'],['😃','feliz'],['😄','alegre'],['😁','sorrindo'],['😆','risada'],['😅','suor'],['😂','rindo'],['🤣','gargalhada'],['😊','sorrindo'],['😇','anjo'],['🙂','leve'],['🙃','invertido'],['😉','piscada'],['😍','apaixonado'],['🥰','amor'],['😘','beijo'],['😋','delicioso'],['😎','óculos'],['🤔','pensando'],['🤩','maravilhado'],['🥳','festa'],['😢','triste'],['😭','chorando'],['😡','bravo'],['🤯','surpreso'],['🤗','abraço'],['😴','sono'],['🤓','inteligente'],['🧐','análise'],['😷','máscara'],['🤒','doente'],['🤝','acordo'],['👍','positivo'],['👎','negativo'],['👏','aplausos'],['🙌','celebração'],['🙏','obrigado'],['💪','força'],['🫶','coração mão'],['👋','olá'],['👀','olhos'],['❤️','amor'],['💚','verde'],['💙','azul'],['💛','amarelo'],['💜','roxo'],['🖤','preto'],['💔','coração partido'],['✨','brilho'],['⭐','estrela'],['🌟','destaque'],['🔥','fogo'],['🎉','comemoração'],['🎂','bolo'],['🎁','presente'],['🎯','alvo'],['🚀','foguete'],['💡','ideia'],['📌','pin'],['📅','agenda'],['📊','gráfico'],['📝','anotações'],['📄','documento'],['📚','livros'],['✅','certo'],['❌','erro'],['⚠️','alerta'],['💰','dinheiro'],['💳','cartão'],['🏦','banco'],['💻','computador'],['📱','celular'],['🔒','seguro'],['🔍','buscar'],['⚙️','configuração'],['🖼️','imagem'],['📷','câmera'],['🎥','vídeo'],['🎵','música'],['🎶','notas'],['🌎','mundo'],['☀️','sol'],['🌈','arco-íris'],['🌹','rosa'],['🐶','cachorro'],['🐱','gato'],['☕','café'],['🍕','pizza'],['🍀','sorte'],['⚡','raio'],['🏆','troféu']
];
const SYMBOLS = '© ® ™ § ¶ € £ ¥ $ ¢ ° ± × ÷ ≠ ≤ ≥ ∞ √ ∑ ∫ π μ Δ Ω α β θ → ← ↑ ↓ ↔ ⇒ ⇔ ✓ ✔ ✕ ★ ☆ ● ○ ♠ ♥ ♦ ♣ ♪ ♫ “ ” ‘ ’ – — … • ‰ ¼ ½ ¾'.split(' ');

export class OrquestraEditor {
  constructor(element, options = {}) {
    this.host = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.host) throw Error('Contêiner do editor não encontrado');
    this.options = { id: 'documento-orquestra', pageMode: true, autosave: true, uploadUrl: null,
      image: { width:1200, height:800, locked:false, requireAdjustment:false, format:'image/webp' },
      token:'', saveUrl:null, height: 680, onChange:null, onSave:null, initialHTML:null, ...options };
    this.studio = new ImageStudio(); this.sourceMode = false;this.readOnly = false; this.savedRange = null; this.destroyed = false; this.localURLs = [];
    this.render(); this.bind();
    const cached = this.options.autosave ? this.retrieveDraft() : null;
    const seed = this.options.initialHTML ?? cached ?? `<h1>Bem-vindo ao Orquestra Editor</h1><p>Um ambiente para elaborar documentos, textos, comunicados e materiais com recursos profissionais.</p><p>Experimente a barra de ferramentas, insira uma tabela ou abra o <strong>Estúdio de imagens</strong> para recortar e tratar uma fotografia.</p><blockquote>Um componente reutilizável para seus sistemas, com upload, imagens, GIFs, emojis e exportação.</blockquote>`;
    this.setHTML(seed, false);
  }
  render() {
    this.host.classList.add('oe-root');
    this.host.innerHTML = `<header class="oe-header"><div class="oe-brand"><span class="oe-brand-mark">O</span><div><b>Orquestra Editor</b><small>Editor avançado de conteúdo</small></div></div><div class="oe-header-actions"><span class="oe-save-indicator">● Rascunho local</span><button class="oe-top-btn oe-action" data-action="load" title="Abrir o HTML salvo no servidor">Reabrir</button><button class="oe-top-btn oe-action" data-action="preview">Visualizar</button><button class="oe-top-btn oe-top-primary oe-action" data-action="save">Salvar documento</button></div></header>
      <nav class="oe-menubar" aria-label="Menu do editor">${Object.keys(MENUS).map(name=>`<button class="oe-menu-button" data-menu="${ESC(name)}">${ESC(name)}</button>`).join('')}</nav>
      <div class="oe-toolbar" aria-label="Ferramentas de formatação">${TOOL_GROUPS.map((group) => `<div class="oe-toolbar-group">${group.map(t => {
        if(t.kind==='select') return `<label class="oe-select-wrap" title="${ESC(t.id)}"><select data-select="${t.id}" aria-label="${t.id}">${t.options.map(([v,l])=>`<option value="${ESC(v)}">${ESC(l)}</option>`).join('')}</select></label>`;
        if(t.kind==='color') return `<label class="oe-color-button" title="${ESC(t.label)}"><span>${t.id==='foreColor'?'A':'▨'}</span><input type="color" data-color="${t.id}" value="${t.default}" aria-label="${ESC(t.label)}"></label>`;
        return `<button type="button" class="oe-tool oe-action ${t.cls||''}" data-action="${t.id}" title="${ESC(t.label)}" aria-label="${ESC(t.label)}">${t.symbol}</button>`;
      }).join('')}</div>`).join('')}</div>
      <div class="oe-secondary"><div><span class="oe-online-dot"></span> Editor pronto <span class="oe-divider-dot">·</span> <span class="oe-page-label">Documento A4</span></div><div><button class="oe-text-link oe-action" data-action="page">Modo página</button><button class="oe-text-link oe-action" data-action="continuous">Modo contínuo</button><button class="oe-text-link oe-action" data-action="image">▧ Estúdio de imagens</button></div></div>
      <main class="oe-workspace ${this.options.pageMode?'is-page-mode':''}" style="min-height:${Math.max(380,+this.options.height||680)}px"><div class="oe-page"><div class="oe-content" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Conteúdo do documento"></div><textarea class="oe-code" spellcheck="false" aria-label="Código-fonte HTML" hidden></textarea></div></main>
      <footer class="oe-statusbar"><span class="oe-doc-stats">0 palavras · 0 caracteres</span><span class="oe-status-message" role="status">Pronto</span><span>Orquestra Editor v2.0</span></footer>
      <div class="oe-layer" hidden></div><input type="file" class="oe-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`;
    this.content = this.host.querySelector('.oe-content');
    this.code = this.host.querySelector('.oe-code');
    this.workspace = this.host.querySelector('.oe-workspace');
    this.layer = this.host.querySelector('.oe-layer');
    this.fileInput = this.host.querySelector('.oe-file');
  }
  bind() {
    const el = this.host;
    el.addEventListener('mousedown', e => { if(e.target.closest('.oe-tool,.oe-menu-button,.oe-top-btn,.oe-text-link')) e.preventDefault(); });
    el.addEventListener('click', e => {
      const action = e.target.closest('[data-action]');
      if(action) { this.run(action.dataset.action, action); return; }
      const menu = e.target.closest('[data-menu]');
      if(menu) {this.menu(menu.dataset.menu,menu);return;}
    });
    el.querySelectorAll('[data-select]').forEach(select => select.addEventListener('change', e=> {
      const id = e.target.dataset.select; const value = e.target.value;
      if(id==='heading') this.command('formatBlock', value);
      else if(id==='font') this.command('fontName',value);
      else if(id==='size') this.command('fontSize',value);
      else if(id==='lineHeight') this.applyBlockStyle('lineHeight',value);
      else if(id==='liststyle') this.applyListStyle(value);
    }));
    el.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',e=>this.command(e.target.dataset.color,e.target.value)));
    this.content.addEventListener('input',()=>this.changed());
    this.content.addEventListener('change', e=>{ if(e.target.matches('input[type=checkbox]')){
      if(e.target.checked)e.target.setAttribute('checked','');else e.target.removeAttribute('checked');this.changed();
    } });
    this.content.addEventListener('keyup',()=>this.saveRange());
    this.content.addEventListener('mouseup',()=>this.saveRange());
    this.content.addEventListener('focus',()=>this.saveRange());
    this.content.addEventListener('click',e=> { if(e.target.tagName === 'IMG') this.imageContext(e.target); });
    this.content.addEventListener('paste',async e=>{
      const files = [...(e.clipboardData?.files || [])].filter(f=>f.type.startsWith('image/'));
      if(files.length) {e.preventDefault(); await this.addImage(files[0]);return;}
      const html = e.clipboardData?.getData('text/html');
      if(html) {e.preventDefault(); this.command('insertHTML', sanitizeHTML(html));}
    });
    this.content.addEventListener('dragover',e=> { if([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    this.content.addEventListener('drop',async e=>{
      const f=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));
      if(f) {e.preventDefault();await this.addImage(f);}
    });
    this.content.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') {e.preventDefault();this.save();}
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k') {e.preventDefault();this.linkDialog();}
    });
    this.code.addEventListener('input',()=>this.changed());
    this.fileInput.addEventListener('change',async()=>{const f=this.fileInput.files[0];if(f) await this.addImage(f);this.fileInput.value='';});
    document.addEventListener('selectionchange', this.onSelectionChange = () => this.saveRange());
    document.addEventListener('pointerdown', this.onOutside = e=> {if(!el.contains(e.target))this.closeLayer();});
  }
  saveRange() {
    if(this.sourceMode || this.destroyed) return;
    const sel=window.getSelection();
    if(sel?.rangeCount && this.content.contains(sel.anchorNode)) this.savedRange=sel.getRangeAt(0).cloneRange();
  }
  restoreRange() {
    this.content.focus();
    if(!this.savedRange) return;
    try {const sel=window.getSelection();sel.removeAllRanges();sel.addRange(this.savedRange);} catch { /* range expirado */ }
  }
  command(cmd,value=null) {
    if(this.sourceMode) {this.status('Saia do modo HTML antes de formatar.');return;}
    this.restoreRange();
    try { document.execCommand(cmd,false,value); } catch(e) {this.status('Comando indisponível neste navegador: '+cmd);}
    this.saveRange(); this.changed();
  }
  insertHTML(html) {this.command('insertHTML',sanitizeHTML(html));}
  insertText(text) {this.command('insertText',String(text));}
  getHTML() {return sanitizeHTML(this.sourceMode ? this.code.value : this.content.innerHTML);}
  getDocumentHTML() {
    const css = 'body{font:16px/1.6 Arial,sans-serif;color:#243247;padding:28px}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c5d1df;padding:8px}blockquote{padding:8px 14px;border-left:4px solid #2563eb;background:#eff6ff}pre{white-space:pre-wrap;background:#f0f4f9;padding:14px}';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ESC(this.options.id)}</title><style>${css}</style></head><body>${this.getHTML()}</body></html>`;
  }
  hasTemporaryImages() {return /\b(?:src)\s*=\s*["']blob:/i.test(this.getHTML());}
  getText() {return this.sourceMode ? new DOMParser().parseFromString(this.code.value,'text/html').body.textContent : this.content.innerText;}
  setHTML(html,trigger=true) {this.content.innerHTML=sanitizeHTML(html);if(this.sourceMode)this.code.value=this.content.innerHTML;if(trigger)this.changed();else this.stats();}
  focus() {this.content.focus();}
  status(message) {this.host.querySelector('.oe-status-message').textContent=message;}
  stats(){const t=this.getText()||'';const count=t.trim()?t.trim().split(/\s+/).length:0;this.host.querySelector('.oe-doc-stats').textContent=`${count} palavra${count===1?'':'s'} · ${t.length} caracteres`;}
  changed() {
    this.stats(); this.status('Alterações pendentes');
    clearTimeout(this.autoTimer);clearTimeout(this.changeTimer);
    if(this.options.autosave) this.autoTimer=setTimeout(()=>{
      try {if(this.hasTemporaryImages()){this.host.querySelector('.oe-save-indicator').textContent='⚠ Imagem temporária';return;} localStorage.setItem('orquestra:draft:'+this.options.id,this.getHTML());this.host.querySelector('.oe-save-indicator').textContent='✓ Rascunho salvo';}
      catch{this.status('Rascunho grande para armazenamento local; salve no servidor.');}
    },800);
    this.changeTimer=setTimeout(()=>this.options.onChange?.(this.getHTML(),this),150);
  }
  retrieveDraft() {try{return localStorage.getItem('orquestra:draft:'+this.options.id);}catch{return null;}}
  async save() {
    const html=this.getHTML();
    if(this.hasTemporaryImages()) {this.status('Há imagens temporárias. Configure uploadUrl e envie as imagens antes de salvar.');return false;}
    if(this.options.saveUrl) {
      try{
        const response=await fetch(this.options.saveUrl,{method:'POST',headers:{'Content-Type':'application/json',...(this.options.token?{'X-Upload-Token':this.options.token}:{})},body:JSON.stringify({id:this.options.id,html})});
        const json=await response.json();if(!response.ok)throw Error(json.error||'Falha ao salvar');
        this.status('Documento gravado no servidor ✓');
      }catch(e){this.status('Erro no salvamento: '+e.message);return false;}
    } else {
      try {localStorage.setItem('orquestra:draft:'+this.options.id,html);}catch(e){this.status('Não foi possível salvar o rascunho local.');return false;}
      this.status('Rascunho salvo neste navegador ✓');
    }
    this.options.onSave?.(html,this);return true;
  }
  async load() {
    if (!this.options.saveUrl) {this.status('Configure saveUrl para recuperar documentos no servidor.');return false;}
    try {
      const url = new URL(this.options.saveUrl,location.href);url.searchParams.set('id',this.options.id);
      const resp = await fetch(url.toString(),{headers:this.options.token?{'X-Upload-Token':this.options.token}:{}});
      const data = await resp.json();if(!resp.ok||typeof data.html!=='string')throw Error(data.error||'Documento não encontrado');
      this.setHTML(data.html);this.status('Documento recuperado do servidor ✓');return true;
    }catch(e){this.status('Falha ao reabrir: '+e.message);return false;}
  }
  run(id,origin){
    this.closeLayer();
    const commands=new Set('undo redo bold italic underline strikeThrough subscript superscript justifyLeft justifyCenter justifyRight justifyFull insertUnorderedList insertOrderedList indent outdent removeFormat selectAll'.split(' '));
    if(commands.has(id)){this.command(id);return;}
    switch(id){
      case 'new':this.confirmDialog('Novo documento','Substituir o conteúdo atual? O rascunho existente poderá ser perdido.',()=>this.setHTML('<p></p>'));break;
      case 'save':this.save();break;
      case 'load':this.confirmDialog('Reabrir do servidor','Carregar a última versão salva e substituir a edição atual?',()=>this.load());break;
      case 'image':this.fileInput.click();break;
      case 'gif':this.gifDialog();break;
      case 'image-url':this.imageURLDialog();break;
      case 'emoji':this.picker('emoji',origin);break;
      case 'specialchars':this.picker('symbols',origin);break;
      case 'link':this.linkDialog();break;
      case 'media':this.mediaDialog();break;
      case 'table':this.tableDialog();break;
      case 'table-row':case 'table-col':case 'table-delrow':case 'table-delcol':case 'table-del':this.tableAction(id);break;
      case 'hr':this.insertHTML('<hr>');break;
      case 'inlineCode':this.wrapSelection('code');break;
      case 'highlight':this.wrapSelection('mark');break;
      case 'codeblock':this.codeblockDialog();break;
      case 'checklist':this.insertHTML('<ul><li><input type="checkbox"> Tarefa 1</li><li><input type="checkbox"> Tarefa 2</li></ul><p></p>');break;
      case 'template':this.templateDialog();break;
      case 'bookmark':this.bookmarkDialog();break;
      case 'tableprops':this.tableProps();break;
      case 'table-merge':this.tableMerge();break;
      case 'table-split':this.tableSplit();break;
      case 'readonly':this.readOnly=!this.readOnly;this.content.contentEditable=String(!this.readOnly);this.status(this.readOnly?'Modo somente leitura':'Edição habilitada');break;
      case 'copy-html':{const html=this.getHTML();navigator.clipboard?.writeText(html).then(()=>this.status('HTML copiado')).catch(()=>this.status('Não foi possível copiar. Utilize o modo HTML.'));break;}
      case 'clearDoc':this.confirmDialog('Limpar documento','Apagar todo o conteúdo atualmente editado?',()=>this.setHTML('<p></p>'));break;
      case 'datetime':this.insertText(new Date().toLocaleString('pt-BR'));break;
      case 'pagebreak':this.insertHTML('<div style="page-break-after:always"><hr></div>');break;
      case 'search':this.searchDialog();break;
      case 'source':this.toggleSource();break;
      case 'page':this.workspace.classList.add('is-page-mode');this.host.querySelector('.oe-page-label').textContent='Documento A4';break;
      case 'continuous':this.workspace.classList.remove('is-page-mode');this.host.querySelector('.oe-page-label').textContent='Edição contínua';break;
      case 'preview':this.preview();break;
      case 'fullscreen':this.host.classList.toggle('oe-fullscreen');break;
      case 'export-html':this.exportFile('html');break;
      case 'export-txt':this.exportFile('txt');break;
      case 'print':this.print();break;
      case 'help':this.messageDialog('Atalhos','<p><strong>Ctrl+B:</strong> negrito · <strong>Ctrl+I:</strong> itálico · <strong>Ctrl+U:</strong> sublinhado · <strong>Ctrl+S:</strong> salvar · <strong>Ctrl+K:</strong> inserir link · <strong>Ctrl+Z:</strong> desfazer.</p>');break;
      case 'about':this.messageDialog('Orquestra Editor','<p>Editor WYSIWYG independente com tratamento de imagens, GIFs, emojis, tabelas e exportação. Versão 2.0 ampliada, com HTML persistente e upload com dimensões bloqueáveis.</p>');break;
    }
  }
  closeLayer(){this.layer.hidden=true;this.layer.innerHTML='';}
  menu(name,anchor){
    const wasOpen=!this.layer.hidden&&this.layer.dataset.menu===name;
    this.closeLayer();if(wasOpen)return;
    const items=MENUS[name]||[];
    this.layer.innerHTML=`<div class="oe-menu-items">${items.map(([label,id])=>`<button data-menu-action="${ESC(id)}">${ESC(label)}</button>`).join('')}</div>`;
    this.layer.hidden=false;this.layer.dataset.menu=name;
    const box=anchor.getBoundingClientRect(), parent=this.host.getBoundingClientRect();
    this.layer.style.left=Math.min(parent.width-230,Math.max(8,box.left-parent.left))+'px';
    this.layer.style.top=box.bottom-parent.top+4+'px';
    this.layer.querySelectorAll('[data-menu-action]').forEach(b=>b.addEventListener('click',()=>this.run(b.dataset.menuAction,b)));
  }
  picker(type,anchor){
    const title=type==='emoji'?'Emojis':'Caracteres especiais';
    this.layer.hidden=false;this.layer.dataset.menu=type;
    this.layer.innerHTML=`<div class="oe-picker"><div class="oe-picker-heading"><b>${title}</b><button class="oe-icon-btn oe-picker-close" aria-label="Fechar">✕</button></div><input class="oe-picker-search" type="search" placeholder="Buscar ${type==='emoji'?'emoji':'símbolo'}…"><div class="oe-picker-grid"></div></div>`;
    const root=this.host.getBoundingClientRect();const rect=anchor?.getBoundingClientRect()||root;
    this.layer.style.left=Math.max(8,Math.min(root.width-338,rect.left-root.left))+'px';
    this.layer.style.top=Math.min(rect.bottom-root.top+6, this.host.clientHeight-360)+'px';
    this.layer.querySelector('.oe-picker-close').addEventListener('click',()=>this.closeLayer());
    const values=type==='emoji'?EMOJIS:SYMBOLS.map(s=>[s,s]);
    const fill=()=>{
      const query=this.layer.querySelector('.oe-picker-search').value.toLowerCase();
      const grid=this.layer.querySelector('.oe-picker-grid');if(!grid)return;
      grid.replaceChildren();
      for (const [symbol,description] of values.filter(x=>x[1].toLowerCase().includes(query)||x[0].includes(query))) {
        const button=document.createElement('button');button.className='oe-emoji-btn';button.textContent=symbol;button.title=description;
        button.addEventListener('click',()=>{this.closeLayer();this.insertText(symbol);});grid.append(button);
      }
    };
    this.layer.querySelector('.oe-picker-search').addEventListener('input',fill);fill();
    this.layer.querySelector('.oe-picker-search').focus();
  }
  dialog(title, fields, onAccept, submit='Inserir') {
    const mask=document.createElement('div'); mask.className='oe-dialog-mask';
    mask.innerHTML=`<div class="oe-dialog" role="dialog" aria-modal="true" aria-label="${ESC(title)}"><div class="oe-dialog-head"><h3>${ESC(title)}</h3><button class="oe-dialog-x" aria-label="Fechar">✕</button></div><form><div class="oe-dialog-fields">${fields}</div><footer><button class="oe-btn oe-btn-soft" type="button" data-cancel>Cancelar</button><button class="oe-btn oe-btn-primary" type="submit">${ESC(submit)}</button></footer></form></div>`;
    this.host.append(mask);
    const close=()=>mask.remove();
    mask.querySelector('.oe-dialog-x').addEventListener('click',close);
    mask.querySelector('[data-cancel]').addEventListener('click',close);
    mask.addEventListener('pointerdown',e=>{if(e.target===mask)close();});
    mask.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.target).entries());try{const ret=onAccept(fields,mask);if(ret!==false)close();}catch(err){this.status(err.message);}});
    mask.querySelector('input,textarea,select')?.focus();
    return mask;
  }
  messageDialog(title,html){this.dialog(title,html,()=>{},'Fechar');}
  confirmDialog(title,text,callback){this.dialog(title,`<p>${ESC(text)}</p>`,callback,'Confirmar');}
  linkDialog(){
    const selected=window.getSelection()?.toString()||'';
    this.dialog('Inserir link',`<label>Texto exibido<input name="label" value="${ESC(selected)}" placeholder="Título do link"></label><label>Endereço URL<input name="url" type="url" placeholder="https://" required></label>`,f=>{
      const url=secureURL(f.url);if(!url){this.status('URL inválida');return false;}
      const label=f.label||url;this.insertHTML(`<a href="${ESC(url)}" target="_blank" rel="noopener noreferrer">${ESC(label)}</a>`);
    });
  }
  mediaDialog(){
    this.dialog('Inserir vídeo',`<p>Links HTTPS do YouTube ou Vimeo. Prévia incorporada com domínio validado.</p><label>URL do vídeo<input name="url" type="url" placeholder="https://www.youtube.com/watch?v=..." required></label>`,f=>{
      const url=secureMedia(f.url);if(!url){this.status('Vídeo não suportado. Utilize um URL válido do YouTube ou Vimeo.');return false;}
      this.insertHTML(`<figure><iframe src="${ESC(url)}" width="640" height="360" title="Vídeo incorporado" allowfullscreen></iframe></figure><p></p>`);
    });
  }
  imageURLDialog(){
    this.dialog('Imagem por URL',`<p>Utilize uma URL pública HTTPS para uma imagem PNG, JPEG, WEBP ou GIF.</p><label>URL da imagem<input name="url" type="url" placeholder="https://site.com/foto.png" required></label><label>Texto alternativo<input name="alt" placeholder="Descreva a imagem"></label><label>Largura de exibição (px)<input name="width" type="number" min="40" max="2000" value="640"></label>`,f=>{
      const url=secureURL(f.url,true);if(!url || !/^https:\/\//.test(url)){this.status('Use uma URL HTTPS válida.');return false;}
      const width=Math.min(2000,Math.max(40,+f.width||640));
      this.insertHTML(`<p><img src="${ESC(url)}" alt="${ESC(f.alt||'Imagem')}" style="width:${width}px;max-width:100%"></p><p></p>`);
    });
  }
  gifDialog(){
    this.dialog('Inserir GIF animado',`<p>Você pode carregar um GIF local com o botão de imagem ou informar uma URL HTTPS pública.</p><label>URL da imagem GIF<input name="url" type="url" placeholder="https://site.com/animacao.gif" required></label><label>Descrição<input name="alt" placeholder="Descrição para acessibilidade"></label>`,f=>{
      const url=secureURL(f.url,true);if(!url){this.status('URL inválida');return false;}
      this.insertHTML(`<p><img src="${ESC(url)}" alt="${ESC(f.alt||'GIF animado')}" style="max-width:100%"></p>`);
      this.status('GIF inserido. Certifique-se de ter permissão para usar a imagem.');
    });
  }
  tableDialog(){
    this.dialog('Inserir tabela',`<div class="oe-two-cols"><label>Linhas<input name="rows" type="number" min="1" max="30" value="3" required></label><label>Colunas<input name="cols" type="number" min="1" max="12" value="3" required></label></div><label><input type="checkbox" name="header" checked> Primeira linha como cabeçalho</label>`,f=>{
      const rows=Math.min(30,Math.max(1,+f.rows||1)),cols=Math.min(12,Math.max(1,+f.cols||1));
      let html='<table style="border-collapse:collapse;width:100%"><tbody>';
      for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++)html+=((r===0&&f.header)?'<th style="border:1px solid #c5d1df;padding:8px;background-color:#eef4fb">Coluna '+(c+1)+'</th>':'<td style="border:1px solid #c5d1df;padding:8px">&nbsp;</td>');html+='</tr>';}
      html+='</tbody></table><p></p>';this.insertHTML(html);
    });
  }
  selectedBlock() {
    this.restoreRange();
    const node=window.getSelection()?.anchorNode || this.savedRange?.startContainer;
    return (node?.nodeType===1?node:node?.parentElement)?.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre,div') || null;
  }
  applyBlockStyle(key,value) {
    const block=this.selectedBlock();
    if(!block || !this.content.contains(block)) {this.status('Posicione o cursor dentro de um parágrafo.');return;}
    if(key==='lineHeight' && ['1','1.15','1.5','2','2.5'].includes(value)) {block.style.lineHeight=value;this.changed();}
  }
  applyListStyle(value) {
    const block=this.selectedBlock(), list=block?.closest('ul,ol');
    if(!list || !this.content.contains(list)){this.status('Posicione o cursor dentro de uma lista.');return;}
    const choices=['disc','circle','square','decimal','lower-alpha','upper-roman'];
    if(choices.includes(value)) {list.style.listStyleType=value;this.changed();}
  }
  wrapSelection(tag) {
    this.restoreRange(); const sel=window.getSelection();
    if(!sel?.rangeCount || sel.isCollapsed){this.status('Selecione um trecho de texto para formatar.');return;}
    const range=sel.getRangeAt(0);if(!this.content.contains(range.commonAncestorContainer))return;
    const fragment=range.extractContents(), node=document.createElement(tag);node.append(fragment);range.insertNode(node);
    range.selectNodeContents(node);sel.removeAllRanges();sel.addRange(range);this.changed();
  }
  codeblockDialog() {
    this.dialog('Inserir bloco de código','<label>Código-fonte<textarea name="code" rows="8" placeholder="Cole seu código aqui"></textarea></label>',f=>{
      this.insertHTML(`<pre style="white-space:pre-wrap;background-color:#f0f4f9;padding:14px"><code>${ESC(f.code||'')}</code></pre><p></p>`);
    });
  }
  templateDialog() {
    const choices={
      comunicado:'<h2>Comunicado</h2><p><strong>Assunto:</strong> Informe o assunto</p><p>Prezados(as),</p><p>Insira o texto do comunicado.</p><p>Atenciosamente,</p><p>[Responsável]</p>',
      oficio:'<h2 style="text-align:center">OFÍCIO Nº [NÚMERO]/[ANO]</h2><p style="text-align:right">[Cidade], [Data]</p><p><strong>Ao(À):</strong> [Destinatário]</p><p><strong>Assunto:</strong> [Assunto]</p><p>Senhor(a),</p><p>Insira o conteúdo.</p><p>Atenciosamente,</p><p>[Nome e função]</p>',
      ata:'<h2>ATA DE REUNIÃO</h2><p><strong>Data:</strong> [Data] &nbsp; <strong>Local:</strong> [Local]</p><p><strong>Participantes:</strong> [Nomes]</p><h3>Pauta</h3><ol><li>Assunto 1</li></ol><h3>Deliberações</h3><p>[Registrar]</p>',
      contrato:'<h2 style="text-align:center">CONTRATO</h2><p><strong>CONTRATANTE:</strong> [Nome]</p><p><strong>CONTRATADO:</strong> [Nome]</p><h3>CLÁUSULA PRIMEIRA — DO OBJETO</h3><p>[Descrever]</p><h3>CLÁUSULA SEGUNDA — DAS CONDIÇÕES</h3><p>[Descrever]</p>'
    };
    this.dialog('Inserir modelo','<label>Modelo<select name="model"><option value="comunicado">Comunicado</option><option value="oficio">Ofício</option><option value="ata">Ata de reunião</option><option value="contrato">Contrato</option></select></label><p>Será inserido na posição atual do cursor.</p>',f=>this.insertHTML(choices[f.model]||choices.comunicado));
  }
  bookmarkDialog() {
    this.dialog('Inserir âncora','<label>Identificador<input name="id" placeholder="secao-introducao" pattern="[A-Za-z][A-Za-z0-9_:.-]*" required></label>',f=>{
      const id=String(f.id||'');if(!/^[a-zA-Z][a-zA-Z0-9_:.-]{0,79}$/.test(id))return false;
      this.insertHTML(`<a id="${ESC(id)}"></a>`);
    });
  }
  selectedCell() {
    this.restoreRange();const node=window.getSelection()?.anchorNode || this.savedRange?.startContainer;
    const cell=(node?.nodeType===1?node:node?.parentElement)?.closest('td,th');
    return cell && this.content.contains(cell) ? cell : null;
  }
  tableProps() {
    const cell=this.selectedCell(),table=cell?.closest('table');
    if(!table){this.status('Selecione uma célula para editar a tabela.');return;}
    this.dialog('Propriedades da tabela',`<label>Largura (%)<input type="number" name="width" min="20" max="100" value="${parseInt(table.style.width)||100}"></label><label>Cor das bordas<input type="color" name="border" value="#c5d1df"></label><label>Cor de fundo da célula<input type="color" name="background" value="#ffffff"></label>`,f=>{
      table.style.width=Math.min(100,Math.max(20,+f.width||100))+'%';table.style.borderCollapse='collapse';
      table.querySelectorAll('td,th').forEach(td=>{td.style.border=`1px solid ${f.border}`;td.style.padding='8px';});
      cell.style.backgroundColor=f.background;this.changed();
    },'Aplicar');
  }
  tableMerge() {
    const cell=this.selectedCell(),next=cell?.nextElementSibling;
    if(!cell || !next || !['TD','TH'].includes(next.tagName)) {this.status('Não existe próxima célula na mesma linha.');return;}
    if (cell.hasAttribute('rowspan') || next.hasAttribute('rowspan')) {this.status('Mesclagem com rowspan não suportada.');return;}
    const colspan=+(cell.getAttribute('colspan')||1)+(+(next.getAttribute('colspan')||1));
    cell.setAttribute('colspan',String(colspan));cell.innerHTML+=' '+next.innerHTML;next.remove();this.changed();
  }
  tableSplit() {
    const cell=this.selectedCell();if(!cell){this.status('Selecione uma célula.');return;}
    const colspan=+(cell.getAttribute('colspan')||1);
    if(colspan<2){this.status('Divisão disponível apenas para células mescladas horizontalmente.');return;}
    cell.setAttribute('colspan',String(colspan-1));const sibling=document.createElement(cell.tagName.toLowerCase());
    sibling.setAttribute('style',cell.getAttribute('style')||'');sibling.innerHTML='&nbsp;';cell.after(sibling);this.changed();
  }
  tableAction(id){
    const sel=window.getSelection(),node=sel?.anchorNode || this.savedRange?.startContainer;
    const cell=(node?.nodeType===1?node:node?.parentElement)?.closest('td,th');
    const row=cell?.closest('tr'),table=cell?.closest('table');
    if(!cell||!row||!table){this.status('Posicione o cursor dentro de uma célula da tabela.');return;}
    const idx=[...row.children].indexOf(cell);
    if(id==='table-row') {const r=row.cloneNode(true);r.querySelectorAll('td,th').forEach(c=>{c.textContent='\u00a0';});row.after(r);}
    if(id==='table-col') table.querySelectorAll('tr').forEach(r=>{const at=r.children[idx];const c=document.createElement(at?.tagName.toLowerCase()==='th'?'th':'td');c.innerHTML='&nbsp;';if(at)at.after(c);else r.append(c);});
    if(id==='table-delrow'){if(table.querySelectorAll('tr').length<=1)table.remove();else row.remove();}
    if(id==='table-delcol')table.querySelectorAll('tr').forEach(r=>{if(r.children.length<=1)table.remove();else r.children[idx]?.remove();});
    if(id==='table-del')table.remove();
    this.changed();
  }
  searchDialog(){
    this.dialog('Localizar e substituir',`<label>Localizar<input name="find" required placeholder="Texto a localizar"></label><label>Substituir por<input name="replace" placeholder="Texto substituto"></label><label><input type="checkbox" name="all" checked> Substituir todas as ocorrências</label>`,f=>{
      const phrase=f.find;if(!phrase)return false;
      const walker=document.createTreeWalker(this.content,NodeFilter.SHOW_TEXT);
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      let count=0;
      for(const node of nodes){if(!node.textContent.includes(phrase))continue;
        if(f.all){const pieces=node.textContent.split(phrase);count+=pieces.length-1;node.textContent=pieces.join(f.replace);}
        else{node.textContent=node.textContent.replace(phrase,()=>{count++;return f.replace;});break;}
      }
      this.changed();this.status(count+' ocorrência(s) substituída(s).');
    },'Substituir');
  }
  async addImage(file){
    const result=await this.studio.open(file,this.options.image || {});
    if(!result)return;
    let url;
    if(this.options.uploadUrl) {
      try {
        const form=new FormData();form.append('file',result.blob,result.name); if(this.options.image?.profile)form.append('profile',this.options.image.profile);
        const response=await fetch(this.options.uploadUrl,{method:'POST',headers:this.options.token?{'X-Upload-Token':this.options.token}:{},body:form});
        const json=await response.json();if(!response.ok||!json.url)throw Error(json.error||'Falha no upload');
        url=json.url;
      }catch(e){this.status('Upload falhou: '+e.message+'. Imagem temporária.');}
    }
    if(!url){url=URL.createObjectURL(result.blob);this.localURLs.push(url);this.status('Imagem local temporária: configure backend para persistência.');}
    this.insertHTML(`<p><img src="${ESC(url)}" alt="${ESC(file.name)}" style="max-width:100%;width:${Math.min(result.width,680)}px;height:auto"></p><p></p>`);
  }
  imageContext(img){
    this.dialog('Imagem selecionada',`<p>Edite as dimensões da imagem no documento ou abra novamente o estúdio de corte.</p><label>Texto alternativo<input name="alt" value="${ESC(img.alt||'')}"></label><div class="oe-two-cols"><label>Largura (px)<input type="number" name="width" min="20" max="2000" value="${img.width||400}"></label><label>Alinhamento<select name="align"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div><label><input name="reedit" type="checkbox"> Abrir no estúdio para novo corte</label>`,async f=>{
      img.alt=f.alt||'';
      const width=Math.min(2000,Math.max(20,+f.width||400));img.style.width=width+'px';img.style.height='auto';img.style.maxWidth='100%';
      img.style.display='block';img.style.marginLeft=f.align==='right'?'auto':f.align==='center'?'auto':'0';img.style.marginRight=f.align==='center'?'auto':'0';
      this.changed();
      if(f.reedit) {
        try {
          const response=await fetch(img.src);if(!response.ok)throw Error('A imagem remota não permitiu edição.');
          const blob=await response.blob();const file=new File([blob],'imagem.'+(blob.type.split('/')[1]||'png'),{type:blob.type});
          const edited=await this.studio.open(file,this.options.image || {});if(!edited)return;
          const newFile=new File([edited.blob],edited.name,{type:edited.blob.type});
          // Reaproveita o mesmo mecanismo de upload, sem abrir estúdio duas vezes.
          let url='';if(this.options.uploadUrl){const data=new FormData();data.append('file',edited.blob,edited.name); if(this.options.image?.profile)data.append('profile',this.options.image.profile);const r=await fetch(this.options.uploadUrl,{method:'POST',headers:this.options.token?{'X-Upload-Token':this.options.token}:{},body:data});const j=await r.json();if(r.ok)url=j.url;}
          if(!url){url=URL.createObjectURL(newFile);this.localURLs.push(url);}img.src=url;this.changed();
        }catch(e){this.status('Não foi possível reabrir a imagem: '+e.message);}
      }
    },'Aplicar');
  }
  toggleSource(){
    this.sourceMode=!this.sourceMode;
    if(this.sourceMode){this.code.value=this.getHTML();this.code.hidden=false;this.content.hidden=true;this.status('Editando código HTML (filtrado na saída).');}
    else{this.content.innerHTML=sanitizeHTML(this.code.value);this.code.hidden=true;this.content.hidden=false;this.changed();}
    this.host.classList.toggle('oe-source-open',this.sourceMode);
  }
  preview(){
    const html=this.getHTML();
    const safe=`<!doctype html><html lang="pt-br"><meta charset="utf-8"><style>body{font:16px/1.6 Arial,sans-serif;padding:40px;color:#243244}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd4e4;padding:8px}blockquote{border-left:3px solid #79a9db;padding-left:12px;color:#64748b}</style><body>${html}</body></html>`;
    const mask=document.createElement('div');mask.className='oe-dialog-mask';
    mask.innerHTML='<div class="oe-preview-panel"><header><strong>Prévia do documento</strong><button class="oe-btn oe-btn-soft">Fechar</button></header><iframe title="Prévia do documento" sandbox=""></iframe></div>';
    mask.querySelector('button').addEventListener('click',()=>mask.remove());
    mask.querySelector('iframe').srcdoc=safe;this.host.append(mask);
  }
  exportFile(type){
    let data,name,mime;
    if(type==='html') {data=this.getDocumentHTML();name=this.options.id+'.html';mime='text/html;charset=utf-8';}
    else{data=this.getText();name=this.options.id+'.txt';mime='text/plain;charset=utf-8';}
    const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.status('Arquivo '+name+' preparado.');
  }
  print(){
    const page=window.open('','_blank');if(!page){this.status('Habilite pop-ups para imprimir.');return;}
    const html=this.getHTML();
    page.document.open();page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${ESC(this.options.id)}</title><style>@page{size:A4;margin:20mm}body{font:12pt/1.55 Arial,sans-serif;color:#172b45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:7px}img{max-width:100%}figure{max-width:100%}</style></head><body>${html}</body></html>`);page.document.close();
    page.addEventListener('load',()=>{page.focus();page.print();});
  }
  destroy(){this.destroyed=true;clearTimeout(this.autoTimer);clearTimeout(this.changeTimer);document.removeEventListener('selectionchange',this.onSelectionChange);document.removeEventListener('pointerdown',this.onOutside);this.localURLs.forEach(u=>URL.revokeObjectURL(u));this.host.replaceChildren();this.host.classList.remove('oe-root');}
}
