import { OrquestraEditor } from './editor.js';
import { OrquestraImageUploader } from './image-studio.js';
const currentPath = location.pathname;
const backendBase = currentPath.includes('/index.html') ? currentPath.replace(/index\.html.*$/, 'backend/') : (currentPath.endsWith('/') ? currentPath + 'backend/' : '/backend/');
const uploadUrl = backendBase + 'upload.php';
const saveUrl = backendBase + 'save-document.php';
const editor = new OrquestraEditor('#orquestra-editor', {id:'documento-demo', uploadUrl, saveUrl, autosave:true, image:{width:1200,height:800,locked:false,format:'image/webp'}});
const uploader = new OrquestraImageUploader({ element:'#orquestra-image-uploader', uploadUrl, width:1200, height:630, locked:true, requireAdjustment:true, allowGIF:false, format:'image/webp', quality:85, profile:'banner-site',
  onUpload:result=>console.info('Imagem processada',result.width,result.height,result.url) });
window.OrquestraDemo = { editor, uploader }; // Somente conveniência para o demonstrativo
const tabs = {editor: 'panel-editor',images:'panel-images',integrate:'panel-integrate'};
for(const key of Object.keys(tabs)) {
  document.querySelector('#tab-'+key).addEventListener('click',()=>{
    for (const other of Object.keys(tabs)) {
      document.querySelector('#tab-'+other).classList.toggle('active',other===key);
      document.querySelector('#tab-'+other).setAttribute('aria-selected',String(other===key));
      document.querySelector('#'+tabs[other]).hidden=other!==key;
    }
  });
}
// Exemplo de perfil rígido: tamanho e formato são definidos exclusivamente pelo desenvolvedor.
