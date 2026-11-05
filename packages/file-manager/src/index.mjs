/** Gerenciador de arquivos autônomo: o host implementa list/open/delete/download. */
export function normalizeSearch(value) {
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function filterAndSort(files,{query='',sortBy='name',direction='asc'}={}) {
 const term=normalizeSearch(query),mult=direction==='desc'?-1:1;
 const filtered=files.filter(f=>!term || normalizeSearch([f.name,f.description,...(f.tags||[])].join(' ')).includes(term));
 return [...filtered].sort((a,b)=>{
  let comp=0;if(sortBy==='size')comp=Number(a.size||0)-Number(b.size||0);
  else if(sortBy==='createdAt')comp=String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  else comp=String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'});
  return mult*comp;
 });
}
const node=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e;};
export class OrquestraFileManager {
 constructor({element:target,load,onOpen=()=>{},onDownload=()=>{},onDelete=()=>{},onSelect=()=>{},pageSize=100}) {
  this.root=typeof target==='string'?document.querySelector(target):target;
  if(!this.root||typeof load!=='function')throw new Error('element e load obrigatorios');
  this.load=load;this.onOpen=onOpen;this.onDownload=onDownload;this.onDelete=onDelete;this.onSelect=onSelect;
  this.pageSize=pageSize;this.files=[];this.selected=new Set();this.query='';this.sortBy='name';this.direction='asc';this.render();
 }
 render() {
  this.root.classList.add('orq-file-manager');this.root.replaceChildren();
  const tools=node('div','orq-fm-tools');
  this.search=node('input','orq-fm-search');this.search.type='search';this.search.placeholder='Pesquisar arquivos';this.search.setAttribute('aria-label','Pesquisar arquivos');
  this.search.addEventListener('input',()=>{this.query=this.search.value;this.draw();});
  this.sort=node('select','orq-fm-sort');
  for(const [v,t] of [['name','Nome'],['createdAt','Data'],['size','Tamanho']]){
   const opt=node('option','',t);opt.value=v;this.sort.append(opt);
  }
  this.sort.addEventListener('change',()=>{this.sortBy=this.sort.value;this.draw();});
  const direction=node('button','orq-fm-direction','↑');direction.type='button';
  direction.addEventListener('click',()=>{this.direction=this.direction==='asc'?'desc':'asc';direction.textContent=this.direction==='asc'?'↑':'↓';this.draw();});
  const reload=node('button','orq-fm-reload','Atualizar');reload.type='button';reload.addEventListener('click',()=>this.refresh());
  this.status=node('span','orq-fm-status','');
  tools.append(this.search,this.sort,direction,reload,this.status);
  this.body=node('div','orq-fm-list');this.root.append(tools,this.body);
 }
 async refresh() {
  this.status.textContent='Carregando...';
  try {
   const loaded=await this.load({limit:this.pageSize,query:this.query});
   if(!Array.isArray(loaded))throw new Error('load deve retornar array');
   this.files=loaded.filter(f=>f && typeof f.id==='string' && f.id!=='');
   this.status.textContent=this.files.length+' arquivo(s)';this.draw();
  } catch(e){this.status.textContent='Erro: '+String(e.message||e);}
 }
 draw() {
  this.body.replaceChildren();const files=filterAndSort(this.files,{query:this.query,sortBy:this.sortBy,direction:this.direction});
  if(!files.length){this.body.append(node('p','orq-fm-empty','Nenhum arquivo encontrado.'));return;}
  const table=node('table','orq-fm-table');const head=node('thead');
  const tr=node('tr');for(const text of ['Selecionar','Arquivo','Descrição','Tamanho','Ações']){const th=node('th','',text);tr.append(th);}head.append(tr);table.append(head);
  const tbody=node('tbody');
  for(const file of files) {
   const r=node('tr');
   const tdSel=node('td');const check=node('input');check.type='checkbox';check.checked=this.selected.has(file.id);
   check.setAttribute('aria-label','Selecionar '+String(file.name||file.id));
   check.addEventListener('change',()=>{check.checked?this.selected.add(file.id):this.selected.delete(file.id);this.onSelect([...this.selected]);});
   tdSel.append(check);
   r.append(tdSel,node('td','orq-fm-name',file.name||file.id),node('td','',file.description||''),node('td','',Number.isFinite(Number(file.size))?Number(file.size).toLocaleString('pt-BR')+' B':'—'));
   const actions=node('td');
   for(const [label,callback,permitted] of [['Visualizar',this.onOpen,file.canView!==false],['Baixar',this.onDownload,file.canDownload===true],['Excluir',this.onDelete,file.canDelete===true]]){
    if(!permitted)continue;const b=node('button','orq-fm-action',label);b.type='button';b.addEventListener('click',async()=>{await callback(file);});actions.append(b);
   }
   r.append(actions);tbody.append(r);
  }
  table.append(tbody);this.body.append(table);
 }
 getSelectedIds(){return [...this.selected];}
 destroy(){this.root.replaceChildren();this.root.classList.remove('orq-file-manager');}
}
