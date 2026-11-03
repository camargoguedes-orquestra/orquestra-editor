"""Testes de ponta a ponta no Chromium contra o servidor PHP local (127.0.0.1:8765).
Requer `npm run build` antes (a demonstração carrega dist/orquestra-editor.js).
Upload/save PHP testados com requisições HTTP reais no loopback.
"""
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
from pathlib import Path
from io import BytesIO
import urllib.request, json, re, uuid
root=Path(__file__).resolve().parents[1]
photo=root/'tests'/'sample.png';gif=root/'tests'/'sample.gif'
im=Image.new('RGB',(1280,720),(34,107,183));d=ImageDraw.Draw(im)
d.rectangle((0,0,640,720),fill=(215,91,60));d.ellipse((600,130,1100,600),fill=(243,202,74));d.text((30,30),'IMAGEM DE TESTE - ENQUADRAMENTO',fill='white');im.save(photo)
a=Image.new('RGB',(120,90),'red');b=Image.new('RGB',(120,90),'blue');a.save(gif,save_all=True,append_images=[b],duration=[120,140],loop=0)

# Backend PHP real: multipart + salvamento + leitura
def send_multipart(path, name):
    boundary='----test'+uuid.uuid4().hex
    mime='image/gif' if path.suffix=='.gif' else 'image/png'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode()+path.read_bytes()+(f'\r\n--{boundary}--\r\n').encode()
    req=urllib.request.Request('http://127.0.0.1:8765/backend/upload.php',data=body,method='POST',headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(req,timeout=10) as resp:
        assert resp.status==201
        return json.load(resp)

up=send_multipart(photo,'sample.png')
assert up['width']==1280 and up['height']==720
with urllib.request.urlopen('http://127.0.0.1:8765'+up['url']) as resp: assert Image.open(BytesIO(resp.read())).size == (1280,720)
upgif=send_multipart(gif,'sample.gif')
with urllib.request.urlopen('http://127.0.0.1:8765'+upgif['url']) as resp:assert Image.open(BytesIO(resp.read())).n_frames == 2
print('OK PHP: upload PNG, GIF animado, leitura de mídia')
# O servidor impõe o perfil independentemente do navegador.
fixed=root/'tests'/'generated-banner.webp'
Image.new('RGB',(1200,630),(68,114,185)).save(fixed,format='WEBP',quality=85)
def send_profile(path,profile):
    boundary='----profile'+uuid.uuid4().hex
    ext=path.suffix.lstrip('.')
    mime={'webp':'image/webp','png':'image/png','gif':'image/gif'}[ext]
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="profile"\r\n\r\n{profile}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.{ext}"\r\nContent-Type: {mime}\r\n\r\n').encode()+path.read_bytes()+(f'\r\n--{boundary}--\r\n').encode()
    req=urllib.request.Request('http://127.0.0.1:8765/backend/upload.php',data=body,method='POST',headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    try:
        with urllib.request.urlopen(req,timeout=10) as resp: return resp.status,json.load(resp)
    except urllib.error.HTTPError as error: return error.code,json.load(error)
status,data=send_profile(photo,'banner-site')
assert status==422 and '1200' in data['error'],(status,data)
status,data=send_profile(fixed,'banner-site')
assert status==201 and data['width']==1200 and data['height']==630 and data['mime']=='image/webp',(status,data)
print('OK PHP: rejeita dimensões incorretas e aceita 1200x630 WEBP no perfil fixo')


payload=json.dumps({'id':'test-123','html':'<h1>Teste de persistência</h1>'}).encode()
req=urllib.request.Request('http://127.0.0.1:8765/backend/save-document.php',data=payload,method='POST',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r: assert json.load(r)['ok']
with urllib.request.urlopen('http://127.0.0.1:8765/backend/save-document.php?id=test-123') as r:assert json.load(r)['html']=='<h1>Teste de persistência</h1>'
print('OK PHP: salvar e recuperar documento')

# Histórico de versões: um segundo salvamento guarda o anterior (id novo a cada execução).
doc_id='test-'+uuid.uuid4().hex[:8]
first=json.dumps({'id':doc_id,'html':'<h1>Teste de persistência</h1>'}).encode()
req=urllib.request.Request('http://127.0.0.1:8765/backend/save-document.php',data=first,method='POST',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r: assert json.load(r)['ok']
payload=json.dumps({'id':doc_id,'html':'<h1>Versão 2</h1>','comments':[{'id':'c-1','author':'Ana','text':'Ok','replies':[]}]}).encode()
req=urllib.request.Request('http://127.0.0.1:8765/backend/save-document.php',data=payload,method='POST',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r: assert json.load(r)['ok']
with urllib.request.urlopen('http://127.0.0.1:8765/backend/save-document.php?id='+doc_id+'&versions=1') as r: versions=json.load(r)['versions']
assert len(versions)>=1,versions
with urllib.request.urlopen('http://127.0.0.1:8765/backend/save-document.php?id='+doc_id+'&version='+versions[0]['version']) as r: assert json.load(r)['html']=='<h1>Teste de persistência</h1>'
with urllib.request.urlopen('http://127.0.0.1:8765/backend/save-document.php?id='+doc_id) as r: cur=json.load(r)
assert cur['html']=='<h1>Versão 2</h1>' and cur['comments'][0]['author']=='Ana'
print('OK PHP: histórico de versões e comentários persistidos')

with sync_playwright() as p:
    browser=p.chromium.launch(**({'executable_path':'/usr/bin/google-chrome'} if Path('/usr/bin/google-chrome').exists() and not Path('/usr/bin/chromium').exists() else {'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':980},accept_downloads=True)
    errs=[];page.on('pageerror',lambda error: errs.append(str(error)))
    page.goto('http://127.0.0.1:8765/index.html')
    page.wait_for_function('window.OrquestraDemo && window.OrquestraDemo.editor')
    assert page.locator('.oe-content h1').count()==1, errs
    print('OK interface',page.title())
    page.screenshot(path=str(root/'tests'/'editor-desktop.png'),full_page=True)
    page.evaluate('''() => {
      window.testUploads = []; window.testStoredHTML = null;
      window.fetch = async (url,options={}) => {
        if(options.body instanceof FormData) {
          const blob=options.body.get('file'); const bitmap=await createImageBitmap(blob);
          window.testUploads.push({name:blob.name,size:blob.size,type:blob.type,width:bitmap.width,height:bitmap.height,blob});
          bitmap.close();
          return new Response(JSON.stringify({ok:true,url:'/backend/uploads/simulated-upload.png'}),{status:201,headers:{'content-type':'application/json'}});
        }
        if(options.method === 'POST') {
          window.testStoredHTML=JSON.parse(options.body).html;
          return new Response(JSON.stringify({ok:true,id:'documento-demo'}),{status:200,headers:{'content-type':'application/json'}});
        }
        return new Response(JSON.stringify({id:'documento-demo',html:window.testStoredHTML}),{status:200,headers:{'content-type':'application/json'}});
      };
    }''')

    # Formatação e texto
    page.evaluate('''() => { const p=document.querySelector('.oe-content p');const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r); }''')
    page.locator('.oe-tool[data-action="bold"]').click()
    assert page.locator('.oe-content strong,.oe-content b').count()>0
    print('OK formatação negrito')

    page.locator('.oe-tool[data-action="emoji"]').click()
    assert page.locator('.oe-picker-grid button').count()>50
    page.locator('.oe-picker-grid button').first.click()
    assert '😀' in page.locator('.oe-content').inner_text()
    print('OK emoji')

    page.locator('.oe-tool[data-action="table"]').click()
    page.locator('.oe-dialog input[name="rows"]').fill('3')
    page.locator('.oe-dialog input[name="cols"]').fill('4')
    page.locator('.oe-dialog button[type="submit"]').click()
    assert page.locator('.oe-content table').count()==1
    assert page.locator('.oe-content table tr').count()==3
    assert page.locator('.oe-content table tr').first.locator('th').count()==4
    print('OK tabela')

    # Segurança
    result=page.evaluate('''() => {window.OrquestraDemo.editor.setHTML('<p onclick="alert(1)">OK</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)">');return window.OrquestraDemo.editor.getHTML()}''')
    assert '<script' not in result and 'onclick' not in result and 'onerror' not in result and 'javascript:' not in result and 'OK' in result, result
    print('OK sanitização HTML')

    page.locator('.oe-top-primary[data-action="save"]').click()
    page.get_by_text('Documento gravado no servidor').wait_for()
    print('OK comando de salvar')

    # Image Studio no editor
    page.locator('.oe-file').set_input_files(str(photo))
    page.locator('.oi-studio').wait_for()
    page.locator('.oi-stage-photo').wait_for(state='visible')
    page.locator('[data-ratio="1:1"]').click()
    page.locator('.oi-output-w').fill('400');page.locator('.oi-output-w').dispatch_event('change')
    assert page.locator('.oi-output-h').input_value()=='400'
    page.locator('.oi-zoom').fill('150');page.locator('.oi-zoom').dispatch_event('input')
    stage=page.locator('.oi-stage').bounding_box()
    page.mouse.move(stage['x']+stage['width']/2,stage['y']+stage['height']/2)
    page.mouse.down();page.mouse.move(stage['x']+stage['width']/2+30,stage['y']+stage['height']/2+10);page.mouse.up()
    page.screenshot(path=str(root/'tests'/'studio-crop.png'))
    page.locator('.oi-apply').click()
    page.locator('.oi-studio').wait_for(state='detached')
    page.wait_for_function("window.testUploads.length===1")
    result=page.evaluate('''() => {const {blob,...r}=testUploads[0];return r;}''')
    assert result['width']==400 and result['height']==400 and result['type']=='image/webp',result
    assert page.locator('.oe-content img').count()==1
    print('OK recorte com dimensões reais 400 x 400 + fluxo upload',result['size'])

    # Uploader com dimensão administrada pelo desenvolvedor
    page.locator('#tab-images').click()
    assert page.locator('.oi-upload-config').is_hidden()
    page.locator('.oi-up-file').set_input_files(str(photo))
    page.locator('.oi-studio').wait_for()
    assert page.locator('.oi-output-w').input_value()=='1200'
    assert page.locator('.oi-output-h').input_value()=='630'
    assert page.locator('.oi-output-w').is_disabled()
    assert page.locator('.oi-output-h').is_disabled()
    assert page.locator('.oi-ratio-list').is_hidden()
    assert page.locator('.oi-apply').is_disabled()
    assert page.locator('.oi-preview-canvas').evaluate('(e)=>e.width===360 && e.height===189')
    page.locator('.oi-zoom').fill('125')
    page.locator('.oi-zoom').dispatch_event('input')
    assert page.locator('.oi-apply').is_enabled()
    page.screenshot(path=str(root/'tests'/'uploader-standalone.png'),full_page=True)
    page.locator('.oi-apply').click()
    page.locator('.oi-upload-result').wait_for(state='visible')
    result=page.evaluate('''() => {const {blob,...r}=testUploads[1];return r;}''')
    assert result['width']==1200 and result['height']==630 and result['type']=='image/webp',result
    assert page.locator('.oi-upload-result img').count()==1
    print('OK perfil fixo: dimensões 1200x630, WEBP, campo travado, confirmação obrigatória')

    # GIF não pode ser usado em slot que exige recorte e formato fixos
    page.locator('.oi-up-file').set_input_files(str(gif))
    page.locator('.oi-studio').wait_for()
    assert 'não é permitido' in page.locator('.oi-status').inner_text()
    assert page.locator('.oi-apply').is_disabled()
    page.locator('.oi-cancel').click()
    print('OK GIF recusado quando o slot exige recorte fixo')

    # HTML mantém estilo, tabelas e imagem em serializar e reabrir.
    page.locator('#tab-editor').click()
    html_input='<h2 style="text-align:center;color:#123456">Título</h2><p style="line-height:1.5;color:#dc2626"><strong>Conteúdo</strong> em vermelho.</p><table style="border-collapse:collapse;width:95%"><tbody><tr><td style="border:1px solid #c5d1df;padding:8px">Célula</td></tr></tbody></table><p><img src="/backend/uploads/validada.webp" width="120" alt="Exemplo"></p>'
    stored=page.evaluate('''(html)=>{const e=OrquestraDemo.editor;e.setHTML(html);return e.getHTML()}''',html_input)
    assert 'text-align:center' in stored and 'line-height:1.5' in stored and 'border-collapse:collapse' in stored
    assert '/backend/uploads/validada.webp' in stored
    page.evaluate('''()=>OrquestraDemo.editor.setHTML('<p>Conteúdo temporário</p>')''')
    reloaded=page.evaluate('''html=>{OrquestraDemo.editor.setHTML(html);return OrquestraDemo.editor.getHTML()}''',stored)
    assert reloaded == stored,(reloaded,stored)
    print('OK HTML roundtrip: cores, entrelinha, células de tabela, imagem e títulos preservados')

    # Roundtrip de API de documentos: salva, altera no browser, busca e reabre.
    assert page.evaluate('''async()=>await OrquestraDemo.editor.save()''')
    page.evaluate('''()=>OrquestraDemo.editor.setHTML('<p>Texto temporário</p>')''')
    page.evaluate("()=>OrquestraDemo.editor.options.saveUrl='https://example.test/backend/save-document.php'")
    assert page.evaluate('''async()=>await OrquestraDemo.editor.load()''')
    assert page.evaluate('''()=>OrquestraDemo.editor.getHTML()''')==stored
    print('OK roundtrip pela API save/load com formatação')

    # Ferramentas acrescentadas: lista de tarefas com estado gravável em HTML.
    page.locator('.oe-tool[data-action="checklist"]').click()
    box=page.locator('.oe-content input[type="checkbox"]').first
    box.check(force=True)
    assert 'checked=""' in page.evaluate('''()=>OrquestraDemo.editor.getHTML()''')
    print('OK checklist com estado checked persistente')

    # GIF válido permanece animado quando não existe corte rígido.
    page.locator('.oe-file').set_input_files(str(gif))
    page.locator('.oi-studio').wait_for()
    page.locator('.oi-gif-note').wait_for(state='visible')
    page.locator('.oi-apply').click()
    page.wait_for_function('window.testUploads.length===3')
    result=page.evaluate('''() => {const {blob,...r}=testUploads[2];return r;}''')
    assert result['type']=='image/gif' and result['size']==gif.stat().st_size
    print('OK GIF animado preservado em modo de imagem livre')

    # URLs temporárias não podem ser salvas como imagens definitivas.
    page.evaluate('''()=>OrquestraDemo.editor.setHTML('<p><img src="blob:https://example.test/fake" alt="temporario"></p>')''')
    assert page.evaluate('''()=>OrquestraDemo.editor.hasTemporaryImages()''')
    assert page.evaluate('''()=>OrquestraDemo.editor.save()''') is False
    print('OK rejeição de salvamento de imagens blob temporárias')

    # ---------------- Versão 3 ----------------
    E='OrquestraDemo.editor'
    def select_text(text):
        page.evaluate("""(t)=>{const e=OrquestraDemo.editor.tiptap;let from=null;e.state.doc.descendants((n,pos)=>{if(from!==null)return false;if(n.isText){const i=n.text.indexOf(t);if(i>=0)from=pos+i;}});e.chain().focus().setTextSelection({from,to:from+t.length}).run();}""",text)

    # Bug corrigido da v2: cor, fonte e tamanho sobrevivem ao salvar.
    page.evaluate(f"()=>{E}.setHTML('<p>texto colorido aqui</p>')")
    select_text('colorido')
    page.evaluate(f"()=>{{const t={E}.tiptap;t.chain().setColor('#ff0000').setFontFamily('Georgia, serif').setFontSize('24px').run()}}")
    out=page.evaluate(f"()=>{E}.getHTML()")
    assert 'color:#ff0000' in out.replace(' ','') or 'rgb(255,0,0)' in out.replace(' ',''), out
    assert 'Georgia' in out and 'font-size:24px' in out.replace(' ',''), out
    # HTML antigo com <font> também é convertido.
    out=page.evaluate(f"""()=>{{{E}.setHTML('<p><font color="#00ff00" face="Verdana" size="5">legado</font></p>');return {E}.getHTML()}}""")
    assert 'Verdana' in out and '24px' in out and 'legado' in out, out
    print('OK cor, fonte e tamanho persistidos (inclusive <font> legado)')

    # Checklist da versão 2 vira lista de tarefas.
    out=page.evaluate(f"""()=>{{{E}.setHTML('<ul><li><input type="checkbox" checked> Feito</li><li><input type="checkbox"> Pendente</li></ul>');return {E}.getHTML()}}""")
    assert 'data-type="taskList"' in out and out.count('data-checked="true"')==1, out
    print('OK migração de checklist da v2')

    # Comentários: cria, responde, resolve e persiste no save.
    page.evaluate(f"()=>{E}.setHTML('<p>O orçamento da obra precisa de revisão.</p>')")
    select_text('orçamento da obra')
    cid=page.evaluate(f"()=>{E}.addComment('Conferir com o conselho')")
    page.evaluate(f"(id)=>{E}.replyComment(id,'Ok, levo na reunião')",cid)
    out=page.evaluate(f"()=>{E}.getHTML()")
    assert f'data-comment-id="{cid}"' in out, out
    page.evaluate(f"()=>{E}.toggleSidebar(true)")
    page.evaluate(f"()=>{E}.showPanel('comments')")
    assert page.locator('.oe-thread').count()==1 and 'Ok, levo' in page.locator('.oe-thread').inner_text()
    page.locator('.oe-thread [data-c="resolve"]').click()
    assert page.evaluate(f"()=>{E}.getComments()[0].resolved")
    assert page.evaluate(f"async()=>await {E}.save()")
    assert page.evaluate("()=>JSON.stringify(window.testStoredHTML)") and True
    print('OK comentários: criar, responder, resolver')

    # Controle de alterações: digitação vira inserção, exclusão vira riscado.
    page.evaluate(f"()=>{E}.setHTML('<p>Valor da taxa: cem reais.</p>')")
    page.evaluate(f"()=>{E}.setTrackChanges(true)")
    select_text('cem')
    page.keyboard.type('duzentos')
    out=page.evaluate(f"()=>{E}.getHTML()")
    assert '<del' in out and 'cem' in out and '<ins' in out and 'duzentos' in out, out
    changes=page.evaluate(f"()=>{E}.getChanges()")
    assert {c['type'] for c in changes}=={'insertion','deletion'}, changes
    page.evaluate(f"()=>{E}.acceptAllChanges()")
    out=page.evaluate(f"()=>{E}.getHTML()")
    assert 'duzentos' in out and 'cem' not in out and '<del' not in out and '<ins' not in out, out
    page.keyboard.press('Backspace')
    out=page.evaluate(f"()=>{E}.getHTML()")
    assert '<del' in out, out
    page.evaluate(f"()=>{E}.rejectAllChanges()")
    assert 'duzentos' in page.evaluate(f"()=>{E}.getText()")
    page.evaluate(f"()=>{E}.setTrackChanges(false)")
    print('OK controle de alterações: inserir, excluir, aceitar e rejeitar')

    # Localizar e substituir com contagem e expressão regular.
    page.evaluate(f"()=>{E}.setHTML('<p>Bloco A, bloco B e BLOCO C.</p>')")
    page.keyboard.press('Control+f')
    page.locator('.oe-find-input').fill('bloco')
    assert page.locator('.oe-find-count').inner_text().endswith('/3')
    page.locator('.oe-find-case').check()
    assert page.locator('.oe-find-count').inner_text().endswith('/1')
    page.locator('.oe-find-case').uncheck()
    page.locator('.oe-find-regex').check()
    page.locator('.oe-find-input').fill('bloco [ab]')
    assert page.locator('.oe-find-count').inner_text().endswith('/2')
    page.locator('.oe-replace-input').fill('Torre')
    page.locator('.oe-replace-all').click()
    assert page.evaluate(f"()=>{E}.getText()").strip()=='Torre, Torre e BLOCO C.'
    page.locator('.oe-find-close').click()
    print('OK localizar e substituir (maiúsculas, regex, substituir todas)')

    # Campos de mesclagem.
    page.evaluate(f"()=>{E}.setHTML('<p>Prezado(a) </p>')")
    page.evaluate(f"()=>{{const t={E}.tiptap;t.chain().focus('end').insertMergeField('nome_condomino','Nome do condômino').insertContent(', unidade ').insertMergeField('unidade','Unidade').run()}}")
    assert 'data-merge-field="unidade"' in page.evaluate(f"()=>{E}.getHTML()")
    page.evaluate(f"()=>{E}.fillFields({{nome_condomino:'Ana Souza',unidade:'302'}})")
    text=page.evaluate(f"()=>{E}.getText()")
    assert 'Ana Souza, unidade 302' in text and '{{' not in text, text
    print('OK campos de mesclagem')

    # Comandos com "/" e tabela com mesclagem de células.
    page.evaluate(f"()=>{E}.setHTML('<p></p>')")
    page.locator('.oe-prose').click()
    page.keyboard.type('/tabe')
    page.locator('.oe-suggest-item').first.wait_for()
    page.keyboard.press('Enter')
    page.locator('.oe-dialog button[type="submit"]').click()
    assert page.locator('.oe-prose table').count()==1
    page.evaluate(f"()=>{{const t={E}.tiptap;let a=null,b=null;t.state.doc.descendants((n,p)=>{{if(n.type.name==='tableCell'){{if(a===null)a=p;else if(b===null)b=p;}}}});t.chain().setCellSelection({{anchorCell:a,headCell:b}}).mergeCells().run()}}")
    assert 'colspan="2"' in page.evaluate(f"()=>{E}.getHTML()")
    print('OK comando /tabela e mesclagem de células')

    # Markdown de ida e volta.
    page.evaluate(f"()=>{E}.setMarkdown('# Título\\n\\n- um\\n- **dois**\\n')")
    html=page.evaluate(f"()=>{E}.getHTML()")
    assert '<h1' in html and '<strong>dois</strong>' in html, html
    assert '**dois**' in page.evaluate(f"()=>{E}.getMarkdown()")
    print('OK Markdown importar e exportar')

    # DOCX: exporta e reimporta (mammoth lê o arquivo produzido pela biblioteca docx).
    page.evaluate(f"()=>{E}.setHTML('<h2>Relatório</h2><p><strong>Negrito</strong> e <em>itálico</em>.</p><ul><li><p>Item</p></li></ul><table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>')")
    size=page.evaluate(f"""async()=>{{const blob=await {E}.exportDocx();window.lastDocx=blob;return blob?blob.size:0}}""")
    assert size>3000, size
    html=page.evaluate(f"""async()=>{{const f=new File([window.lastDocx],'r.docx');await {E}.importFile(f);return {E}.getHTML()}}""")
    assert 'Relatório' in html and '<strong>Negrito</strong>' in html and '<table' in html and 'Item' in html, html
    print('OK DOCX exportar e importar',size,'bytes')

    # Fórmula (KaTeX) e sumário.
    page.evaluate(f"()=>{E}.setHTML('<h1>Capítulo</h1><h2>Seção</h2><p>Texto</p>')")
    page.evaluate(f"()=>{{const t={E}.tiptap;t.chain().focus('end').insertInlineMath({{latex:'a^2+b^2=c^2'}}).run()}}")
    assert page.locator('.oe-prose .katex').count()>=1
    page.evaluate(f"()=>{{{E}.tiptap.commands.focus('end');{E}.insertTableOfContents()}}")
    html=page.evaluate(f"()=>{E}.getHTML()")
    assert 'href="#secao-capitulo' in html and 'data-latex="a^2+b^2=c^2"' in html, html
    print('OK fórmula KaTeX e sumário com links')

    # Bug corrigido da v2: estúdio com allowUpscale:false fecha sem travar.
    res=page.evaluate("""async()=>{const {ImageStudio}=await import('/dist/orquestra-editor.js');const st=new ImageStudio();
      const c=document.createElement('canvas');c.width=50;c.height=50;const blob=await new Promise(r=>c.toBlob(r,'image/png'));
      const pr=st.open(new File([blob],'a.png',{type:'image/png'}),{width:40,height:40,locked:true,allowUpscale:false});
      await new Promise(r=>setTimeout(r,300));document.querySelector('.oi-cancel').click();
      return Promise.race([pr.then(x=>'resolveu:'+x),new Promise(r=>setTimeout(()=>r('travou'),1500))]);}""")
    assert res=='resolveu:null', res
    print('OK estúdio fecha corretamente com allowUpscale:false')

    # ---------------- Integração com outros sistemas ----------------
    form_page=browser.new_page(viewport={'width':1280,'height':900})
    form_errs=[];form_page.on('pageerror',lambda error: form_errs.append(str(error)))
    form_page.goto('http://127.0.0.1:8765/examples/formulario.html')
    form_page.wait_for_function('window.exemplo && window.exemplo.editor')
    # CSS não altera a página hospedeira (página sem estilos próprios).
    style=form_page.evaluate("""()=>{const b=getComputedStyle(document.body);const btn=getComputedStyle(document.querySelector('#cancelar'));
      return {margin:b.margin,bg:b.backgroundColor,font:b.fontFamily,boxSizing:getComputedStyle(document.querySelector('h1')).boxSizing,cursor:btn.cursor}}""")
    assert style['margin']=='8px' and style['bg']=='rgba(0, 0, 0, 0)' and 'Inter' not in style['font'] and style['boxSizing']=='content-box' and style['cursor']=='default', style
    print('OK CSS restrito aos componentes (body, *, botões da página intactos)')
    # Cabeçalho escondido.
    assert form_page.locator('#texto .oe-header').is_hidden()
    assert form_page.locator('#texto .oe-toolbar').is_visible()
    print('OK opção header:false')
    # Cabeçalhos próprios (CSRF lido a cada requisição) no editor e no uploader.
    form_page.evaluate("""()=>{window.sent=[];const orig=window.fetch;window.fetch=async(url,init={})=>{window.sent.push({url:String(url),headers:init.headers,credentials:init.credentials});
      return new Response(JSON.stringify({ok:true,url:'/backend/uploads/x.webp',html:'<p>x</p>',versions:[]}),{status:201,headers:{'content-type':'application/json'}})};}""")
    form_page.evaluate("()=>{exemplo.editor.options.saveUrl='/backend/save-document.php';document.querySelector('meta[name=csrf-token]').content='renovado-123'}")
    assert form_page.evaluate("async()=>await exemplo.editor.save()")
    sent=form_page.evaluate("()=>window.sent[0]")
    assert sent['headers'].get('X-CSRF-Token')=='renovado-123' and sent['headers'].get('Content-Type')=='application/json' and sent['credentials']=='same-origin', sent
    form_page.locator('#capa .oi-up-file').set_input_files(str(fixed))
    form_page.locator('.oi-studio').wait_for()
    form_page.locator('.oi-zoom').fill('120');form_page.locator('.oi-zoom').dispatch_event('input')
    form_page.locator('.oi-apply').click()
    form_page.wait_for_function("window.sent.length===2")
    assert form_page.evaluate("()=>window.sent[1].headers['X-CSRF-Token']")=='renovado-123'
    print('OK cabeçalhos próprios (CSRF) em salvar e upload')
    # Dentro do <form>: botões e diálogos não enviam o formulário; o envio leva HTML e URL da imagem.
    form_page.locator('#texto .oe-tool[data-action="bold"]').click()
    form_page.locator('#texto .oe-tool[data-action="table"]').click()
    form_page.locator('#texto .oe-dialog button[type="submit"]').click()
    form_page.keyboard.press('Control+f')
    form_page.locator('#texto .oe-replace-input').fill('x')
    form_page.locator('#texto .oe-replace-input').press('Enter')
    assert form_page.locator('#enviado').inner_text()=='', 'formulário enviado por engano'
    assert form_page.locator('#texto .oe-prose table').count()==1
    form_page.locator('button[type=submit]', has_text='Publicar').click()
    data=json.loads(form_page.locator('#enviado').inner_text())
    assert data['titulo']=='Manutenção dos elevadores' and '<table' in data['conteudo'] and 'elevadores' in data['conteudo'], data
    assert data['imagem_capa']=='/backend/uploads/x.webp', data
    print('OK editor e uploader dentro de <form>: campos name, sem envios acidentais')
    assert not form_errs, form_errs
    form_page.close()

    page.evaluate('''()=>OrquestraDemo.editor.setHTML('<h2 style=\"color:#155e9e\">Orquestra Editor</h2><p>Documento de exemplo com <strong>formatação</strong> e <em>ênfase</em>.</p><p>Visualização responsiva no celular.</p>')''')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#tab-editor').click()
    page.screenshot(path=str(root/'tests'/'editor-mobile.png'),full_page=True)
    print('OK viewport móvel')
    assert not errs,'Erros JS: '+repr(errs)
    print('ALL TESTS PASSED')
    browser.close()
