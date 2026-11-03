/** Orquestra Image Studio — independente, sem dependências externas.
 * Fluxo: new ImageStudio().open(file?, {width,height,aspectRatio}) -> Promise<{blob,width,height,name,animated}>.
 * GIF animado é preservado sem rasterização, porque Canvas eliminaria os quadros.
 */
export class ImageStudio {
  constructor(options = {}) {
    this.options = { maxBytes: 15 * 1024 * 1024, maxDimension: 4096, ...options };
    this.active = null;
  }

  async open(file = null, config = {}) {
    if (this.active) throw new Error('Já existe uma sessão de edição de imagem em andamento.');
    return new Promise((resolve) => {
      this.active = { resolve, config, file: null, img: null, objectURL: null,
        width: this.validSize(config.width || 1200), height: this.validSize(config.height || 800),
        locked: Boolean(config.locked), requireAdjustment: Boolean(config.requireAdjustment), touched: false,
        allowGIF: config.locked ? false : (config.allowGIF ?? true), allowUpscale: config.allowUpscale !== false,
        lockFormat: config.lockFormat ?? Boolean(config.locked), lockQuality: Boolean(config.lockQuality),
        ratio: config.locked ? 'fixed' : (config.aspectRatio || '3:2'), zoom: 1, dx: 0, dy: 0, angle: 0, flipX: 1, flipY: 1,
        brightness: 100, contrast: 100, saturation: 100, filter: 'none', exportFormat: config.format || 'image/png', quality: Math.min(100,Math.max(1,Number(config.quality)||85)) };
      const overlay = document.createElement('div');
      overlay.className = 'oi-modal-backdrop';
      overlay.innerHTML = `
      <div class="oi-studio" role="dialog" aria-modal="true" aria-label="Estúdio de imagens">
        <header class="oi-studio-header"><div><span class="oi-badge">ORQUESTRA</span><h2>Estúdio de imagens</h2><p>Recorte visual com controle de enquadramento e resolução</p></div><button class="oi-icon-btn oi-close" aria-label="Fechar">✕</button></header>
        <div class="oi-studio-main">
          <section class="oi-studio-work">
            <div class="oi-stage" aria-label="Prévia do recorte: arraste a imagem para enquadrar">
              <div class="oi-stage-empty"><span class="oi-empty-visual">▧</span><strong>Selecione uma imagem</strong><small>PNG, JPEG, WEBP ou GIF — até 15 MB</small><button class="oi-btn oi-btn-primary oi-pick">Escolher arquivo</button></div>
              <img class="oi-stage-photo" alt="Imagem em edição" draggable="false" hidden><div class="oi-crop-outline" hidden><span class="oi-grid-lines"></span><span class="oi-crop-label"></span></div>
            </div>
            <div class="oi-stage-footer"><span class="oi-image-data">Nenhuma imagem selecionada</span><span class="oi-hint">Arraste para posicionar · Role para ampliar</span></div>
            <div class="oi-studio-filmstrip"><button class="oi-btn oi-btn-soft oi-pick">⇧ Trocar imagem</button><span class="oi-preserve-note">A região escurecida mostra o que será descartado.</span></div>
          </section>
          <aside class="oi-studio-controls">
            <h3>Formato de saída</h3><p class="oi-fixed-description" hidden>Dimensões obrigatórias definidas pelo sistema. Ajuste a foto dentro da moldura.</p><label class="oi-field-label oi-ratio-heading">Proporção de corte</label><div class="oi-ratio-list">
              <button data-ratio="free">Livre</button><button data-ratio="1:1">1:1</button><button data-ratio="4:3">4:3</button><button data-ratio="3:2">3:2</button><button data-ratio="16:9">16:9</button><button data-ratio="3:4">3:4</button>
            </div>
            <div class="oi-field-pair"><label>Largura (px)<input class="oi-output-w" type="number" min="1" max="4096" value="1200"></label><label>Altura (px)<input class="oi-output-h" type="number" min="1" max="4096" value="800"></label></div>
            <div class="oi-ratio-note">Tamanho final: <b class="oi-output-size">1200 × 800 px</b></div><div class="oi-field-pair"><label>Formato<select class="oi-export-format"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WEBP</option></select></label><label>Qualidade<select class="oi-quality"><option value="65">65% · compacto</option><option value="85" selected>85% · equilibrado</option><option value="95">95% · máxima</option></select></label></div>
            <div class="oi-final-preview"><div class="oi-preview-top"><strong>Prévia do resultado final</strong><span class="oi-preview-resolution">—</span></div><div class="oi-preview-surface"><canvas class="oi-preview-canvas" aria-label="Prévia da imagem já recortada"></canvas></div></div><hr><h3>Posicionamento</h3><div class="oi-slider-label"><label for="oi-zoom">Zoom</label><span class="oi-zoom-value">100%</span></div>
            <input class="oi-zoom" id="oi-zoom" type="range" min="100" max="400" step="1" value="100"><div class="oi-actions-row"><button class="oi-btn oi-btn-soft oi-rotate-left" title="Girar 90° à esquerda">↶ Girar</button><button class="oi-btn oi-btn-soft oi-rotate-right" title="Girar 90° à direita">↷ Girar</button><button class="oi-btn oi-btn-soft oi-flip" title="Espelhar na horizontal">⇄ Espelhar</button><button class="oi-btn oi-btn-soft oi-flip-v" title="Espelhar na vertical">⇅ Inverter</button></div><p class="oi-keys-note">Teclado: setas movem a imagem (Shift = 10×), + e − ampliam.</p>
            <hr><h3>Ajustes</h3>
            <div class="oi-slider-label"><label>Brilho</label><span class="oi-brightness-value">100%</span></div><input class="oi-brightness" type="range" min="0" max="200" value="100">
            <div class="oi-slider-label"><label>Contraste</label><span class="oi-contrast-value">100%</span></div><input class="oi-contrast" type="range" min="0" max="200" value="100">
            <div class="oi-slider-label"><label>Saturação</label><span class="oi-saturation-value">100%</span></div><input class="oi-saturation" type="range" min="0" max="200" value="100">
            <label class="oi-field-label">Filtro</label><select class="oi-filter"><option value="none">Original</option><option value="grayscale(1)">Preto e branco</option><option value="sepia(1)">Sépia</option></select>
            <button class="oi-btn oi-btn-soft oi-reset">↺ Restaurar edição</button>
            <p class="oi-gif-note" hidden>GIF animado: o arquivo original será preservado, sem corte ou aplicação de filtros, para manter a animação.</p>
          </aside>
        </div>
        <footer class="oi-studio-bottom"><span class="oi-status">Pronto para editar</span><div><button class="oi-btn oi-btn-soft oi-cancel">Cancelar</button><button class="oi-btn oi-btn-primary oi-apply" disabled>Aplicar e usar imagem ✓</button></div></footer>
        <input class="oi-studio-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      </div>`;
      document.body.append(overlay);
      this.active.overlay = overlay;
      this.active.stage = overlay.querySelector('.oi-stage');
      const $ = (selector) => overlay.querySelector(selector);
      this.active.$ = $;
      const cancel = () => this.close(null);
      $('.oi-close').addEventListener('click', cancel);
      $('.oi-cancel').addEventListener('click', cancel);
      overlay.addEventListener('pointerdown', e => { if (e.target === overlay) cancel(); });
      this.active.onEsc = e => { if (e.key === 'Escape') cancel(); };
      document.addEventListener('keydown', this.active.onEsc);
      const choose = () => $('.oi-studio-file').click();
      overlay.querySelectorAll('.oi-pick').forEach(b => b.addEventListener('click', choose));
      $('.oi-studio-file').addEventListener('change', async e => { if (e.target.files[0]) await this.load(e.target.files[0]); e.target.value = ''; });
      this.bindControls();
      this.configureLockedUI();
      const stage = this.active.stage;
      stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('is-dragover'); });
      stage.addEventListener('dragleave', () => stage.classList.remove('is-dragover'));
      stage.addEventListener('drop', async e => { e.preventDefault(); stage.classList.remove('is-dragover'); if (e.dataTransfer.files[0]) await this.load(e.dataTransfer.files[0]); });
      stage.addEventListener('wheel', e => { if (!this.active?.img || this.active.file?.type === 'image/gif') return; e.preventDefault(); this.active.zoom = Math.min(4, Math.max(1, this.active.zoom + (e.deltaY < 0 ? .1 : -.1))); this.markAdjusted(); this.render(); }, { passive: false });
      let drag = null;
      stage.addEventListener('pointerdown', e => { if (!this.active?.img || this.active.file?.type === 'image/gif') return; drag = { x: e.clientX, y: e.clientY, dx: this.active.dx, dy: this.active.dy }; stage.setPointerCapture(e.pointerId); });
      stage.addEventListener('pointermove', e => { if (!drag || !this.active) return; this.active.dx = drag.dx + e.clientX - drag.x; this.active.dy = drag.dy + e.clientY - drag.y; this.markAdjusted(); this.render(); });
      stage.addEventListener('pointerup', () => drag = null);
      stage.addEventListener('pointercancel', () => drag = null);
      this.active.resize = new ResizeObserver(() => { if (this.active?.img) this.render(); });
      this.active.resize.observe(stage);
      if (file) this.load(file);
      else this.syncUI();
    });
  }

  async load(file) {
    const s = this.active;
    if (!s) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { this.alert('Formato não permitido. Use PNG, JPEG, WEBP ou GIF.'); return; }
    if (file.type === 'image/gif' && !s.allowGIF) { this.alert('Este campo exige recorte em dimensões fixas: GIF animado não é permitido. Use PNG, JPEG ou WEBP.'); return; }
    if (file.size > this.options.maxBytes) { this.alert('Arquivo maior que 15 MB.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    try { await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; }); }
    catch { URL.revokeObjectURL(url); this.alert('Não foi possível abrir a imagem.'); return; }
    if (s.locked && !s.allowUpscale && (img.naturalWidth < s.width || img.naturalHeight < s.height)) {URL.revokeObjectURL(url);this.alert(`A imagem deve ter no mínimo ${s.width} × ${s.height} px.`);return;}
    if (s.objectURL) URL.revokeObjectURL(s.objectURL);
    s.objectURL = url; s.file = file; s.img = img; s.dx = 0; s.dy = 0; s.zoom = 1; s.touched = false;
    s.angle = 0; s.flipX = 1; s.flipY = 1; s.brightness = 100; s.contrast = 100; s.saturation = 100; s.filter = 'none';
    if (!s.locked && !s.config.width && !s.config.height) {
      s.width = Math.min(1600, img.naturalWidth);
      s.height = Math.min(1600, img.naturalHeight);
      s.ratio = 'free';
    }
    s.$('.oi-stage-empty').hidden = true;
    s.$('.oi-stage-photo').hidden = false;
    s.$('.oi-crop-outline').hidden = false;
    s.$('.oi-apply').disabled = s.requireAdjustment && !s.touched;
    s.$('.oi-image-data').textContent = `${file.name} · ${img.naturalWidth} × ${img.naturalHeight} · ${this.bytes(file.size)}`;
    const gif = file.type === 'image/gif';
    s.$('.oi-final-preview').hidden = gif;
    s.$('.oi-gif-note').hidden = !gif;
    s.$('.oi-studio-controls').classList.toggle('oi-controls-disabled', gif);
    s.$('.oi-status').textContent = gif ? 'GIF animado: preservar original' : (s.requireAdjustment ? 'Ajuste o enquadramento para habilitar a confirmação.' : 'Imagem carregada • confirme o enquadramento');
    this.render();
  }

  configureLockedUI() {
    const s = this.active; if (!s) return;
    if (!s.locked) return;
    s.overlay.classList.add('oi-locked');
    s.$('.oi-fixed-description').hidden = false;
    s.$('.oi-ratio-heading').hidden = true;
    s.$('.oi-ratio-list').hidden = true;
    s.$('.oi-export-format').disabled = s.lockFormat;
    s.$('.oi-quality').disabled = s.lockQuality;
    s.$('.oi-output-w').disabled = true;
    s.$('.oi-output-h').disabled = true;
    s.$('.oi-output-w').closest('label').title = 'Dimensão bloqueada pelo desenvolvedor';
    s.$('.oi-output-h').closest('label').title = 'Dimensão bloqueada pelo desenvolvedor';
    s.$('.oi-stage-empty small').textContent = 'PNG, JPEG ou WEBP — recorte obrigatório';
    s.$('.oi-studio-file').accept = 'image/png,image/jpeg,image/webp';
    s.$('.oi-preserve-note').textContent = 'Apenas a área dentro da moldura será enviada.';
  }
  markAdjusted() {
    const s = this.active; if (!s) return;
    s.touched = true;
    if (s.img && s.file.type !== 'image/gif') {
      s.$('.oi-apply').disabled = false; s.$('.oi-status').textContent = 'Enquadramento ajustado — pronto para aplicar.';
    }
  }
  bytes(n) { return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`; }
  alert(message) { if (this.active) { this.active.$('.oi-status').textContent = message; this.active.$('.oi-status').classList.add('oi-error'); } }
  bindControls() {
    const s = this.active, $ = s.$;
    s.overlay.querySelectorAll('[data-ratio]').forEach(b => b.addEventListener('click', () => {
      if (s.locked) return; s.ratio = b.dataset.ratio;
      if (s.ratio === 'free' && s.img) { s.width = s.img.naturalWidth; s.height = s.img.naturalHeight; }
      else if (s.ratio !== 'free') { const [a, b] = s.ratio.split(':').map(Number); s.height = Math.round(s.width * b / a); }
      s.dx = 0; s.dy = 0; s.zoom = 1; this.render();
    }));
    $('.oi-output-w').addEventListener('change', e => {
      if (s.locked) return;
      s.width = this.validSize(e.target.value);
      if (s.ratio !== 'free') { const [a, b] = s.ratio.split(':').map(Number); s.height = this.validSize(Math.round(s.width * b / a)); }
      s.dx = 0; s.dy = 0; this.render();
    });
    $('.oi-output-h').addEventListener('change', e => {
      if (s.locked) return;
      s.height = this.validSize(e.target.value);
      if (s.ratio !== 'free') { const [a, b] = s.ratio.split(':').map(Number); s.width = this.validSize(Math.round(s.height * a / b)); }
      s.dx = 0; s.dy = 0; this.render();
    });
    const sliders = [['zoom', 'zoom', v => v / 100], ['brightness', 'brightness', Number], ['contrast', 'contrast', Number], ['saturation', 'saturation', Number]];
    sliders.forEach(([cls, property, convert]) => $('.oi-' + cls).addEventListener('input', e => { s[property] = convert(e.target.value); this.markAdjusted(); this.render(); }));
    $('.oi-filter').addEventListener('change', e => { s.filter = e.target.value; this.markAdjusted(); this.render(); });
    $('.oi-export-format').addEventListener('change', e => { s.exportFormat = e.target.value; this.render(); });
    $('.oi-quality').addEventListener('change', e => { s.quality = +e.target.value; this.render(); });
    $('.oi-rotate-left').addEventListener('click', () => { s.angle = (s.angle + 270) % 360; s.dx = 0; s.dy = 0; this.markAdjusted(); this.render(); });
    $('.oi-rotate-right').addEventListener('click', () => { s.angle = (s.angle + 90) % 360; s.dx = 0; s.dy = 0; this.markAdjusted(); this.render(); });
    $('.oi-flip').addEventListener('click', () => { s.flipX *= -1; this.markAdjusted(); this.render(); });
    $('.oi-flip-v').addEventListener('click', () => { s.flipY *= -1; this.markAdjusted(); this.render(); });
    // Acessibilidade: enquadramento pelo teclado, sem depender do mouse.
    s.stage.tabIndex = 0;
    s.stage.addEventListener('keydown', (e) => {
      if (!s.img || s.file?.type === 'image/gif') return;
      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        s.dx += moves[e.key][0];
        s.dy += moves[e.key][1];
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        s.zoom = Math.min(4, s.zoom + 0.1);
      } else if (e.key === '-') {
        e.preventDefault();
        s.zoom = Math.max(1, s.zoom - 0.1);
      } else return;
      this.markAdjusted();
      this.render();
    });
    $('.oi-reset').addEventListener('click', () => { s.zoom = 1; s.angle = 0; s.flipX = 1; s.flipY = 1; s.dx = 0; s.dy = 0; s.brightness = 100; s.contrast = 100; s.saturation = 100; s.filter = 'none'; this.markAdjusted(); this.render(); });
    $('.oi-apply').addEventListener('click', () => this.apply());
  }
  validSize(n) { return Math.min(this.options.maxDimension, Math.max(1, Math.round(+n || 1))); }
  geometry() {
    const s = this.active, stage = s.stage;
    const ratio = s.width / s.height;
    const frameW = Math.max(1, Math.min(stage.clientWidth * .82, stage.clientHeight * .78 * ratio));
    const frameH = frameW / ratio;
    const rotate90 = s.angle % 180 !== 0;
    const iw = rotate90 ? s.img.naturalHeight : s.img.naturalWidth;
    const ih = rotate90 ? s.img.naturalWidth : s.img.naturalHeight;
    const fit = Math.max(frameW / iw, frameH / ih);
    return { frameW, frameH, fit, imageW: s.img.naturalWidth * fit * s.zoom, imageH: s.img.naturalHeight * fit * s.zoom,
      rotatedW: iw * fit * s.zoom, rotatedH: ih * fit * s.zoom };
  }
  syncUI() {
    const s = this.active;
    if (!s) return;
    const $ = s.$;
    $('.oi-output-w').value = s.width;
    $('.oi-output-h').value = s.height;
    $('.oi-output-size').textContent = `${s.width} × ${s.height} px`;
    s.overlay.querySelectorAll('[data-ratio]').forEach(b => b.classList.toggle('is-active', s.ratio === b.dataset.ratio));
    for (const k of ['brightness', 'contrast', 'saturation']) { $('.oi-' + k).value = s[k]; $('.oi-' + k + '-value').textContent = s[k] + '%'; }
    $('.oi-zoom').value = Math.round(s.zoom * 100);
    $('.oi-zoom-value').textContent = Math.round(s.zoom * 100) + '%';
    $('.oi-filter').value = s.filter;
    $('.oi-export-format').value = s.exportFormat;
    $('.oi-quality').value = String(s.quality);
    $('.oi-quality').disabled = s.lockQuality || s.exportFormat === 'image/png';
  }
  render() {
    const s = this.active;
    if (!s) return;
    this.syncUI();
    if (!s.img) return;
    if (s.file.type === 'image/gif') {
      const preview = s.$('.oi-stage-photo');
      preview.src = s.objectURL; preview.style.cssText = 'left:50%;top:50%;width:auto;height:auto;max-width:85%;max-height:85%;transform:translate(-50%,-50%);filter:none;';
      s.$('.oi-crop-outline').hidden = true;
      return;
    }
    const g = this.geometry();
    s.dx = Math.max(-(g.rotatedW - g.frameW) / 2, Math.min((g.rotatedW - g.frameW) / 2, s.dx));
    s.dy = Math.max(-(g.rotatedH - g.frameH) / 2, Math.min((g.rotatedH - g.frameH) / 2, s.dy));
    const photo = s.$('.oi-stage-photo');
    photo.src = s.objectURL;
    photo.style.width = g.imageW + 'px'; photo.style.height = g.imageH + 'px';
    photo.style.left = '50%'; photo.style.top = '50%'; photo.style.maxWidth = 'none'; photo.style.maxHeight = 'none';
    photo.style.transform = `translate(-50%,-50%) translate(${s.dx}px,${s.dy}px) rotate(${s.angle}deg) scale(${s.flipX},${s.flipY})`;
    photo.style.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%) ${s.filter}`;
    const frame = s.$('.oi-crop-outline');
    frame.style.width = g.frameW + 'px'; frame.style.height = g.frameH + 'px'; frame.hidden = false;
    s.$('.oi-crop-label').textContent = `${s.width} × ${s.height} px`;
    this.renderFinalPreview();
  }
  paintToCanvas(canvas) {
    const s = this.active, g = this.geometry();
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw Error('Canvas 2D indisponível.');
    const scale = canvas.width / g.frameW;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(s.exportFormat === 'image/jpeg') {ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.translate(canvas.width / 2 + s.dx * scale, canvas.height / 2 + s.dy * scale);
    ctx.rotate(s.angle * Math.PI / 180);
    ctx.scale(s.flipX, s.flipY);
    ctx.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%) ${s.filter}`;
    ctx.drawImage(s.img, -g.imageW * scale / 2, -g.imageH * scale / 2, g.imageW * scale, g.imageH * scale);
    ctx.restore();
  }
  renderFinalPreview() {
    const s = this.active; if(!s?.img || s.file?.type === 'image/gif') return;
    const canvas = s.$('.oi-preview-canvas');
    const width = 360, height = Math.max(1, Math.round(width * s.height / s.width));
    canvas.width = width; canvas.height = height;
    this.paintToCanvas(canvas);
    s.$('.oi-preview-resolution').textContent = `${s.width} × ${s.height} px`;
  }
  async apply() {
    const s = this.active;
    if (!s?.img) return;
    s.$('.oi-apply').disabled = true;
    s.$('.oi-status').textContent = 'Processando imagem…';
    if (s.file.type === 'image/gif') {
      this.close({ blob: s.file, name: s.file.name, width: s.img.naturalWidth, height: s.img.naturalHeight, animated: true }); return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = s.width; canvas.height = s.height;
      this.paintToCanvas(canvas);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, s.exportFormat, s.quality / 100));
      if (!blob) throw Error('Falha ao exportar imagem.');
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      this.close({ blob, name: (s.file.name.replace(/\.[^.]+$/, '') || 'imagem') + '-editada.' + ext, width: s.width, height: s.height, animated: false });
    } catch (e) { this.alert(e.message); s.$('.oi-apply').disabled = s.requireAdjustment && !s.touched; }
  }
  close(result) {
    const s = this.active;
    if (!s) return;
    this.active = null;
    document.removeEventListener('keydown', s.onEsc);
    s.resize?.disconnect();
    s.overlay.remove();
    if (s.objectURL) URL.revokeObjectURL(s.objectURL);
    s.resolve(result);
  }
}

/** Componente independente: upload e recorte, com prévia do resultado. */
export class OrquestraImageUploader {
  constructor({ element, uploadUrl = null, token = '', onUpload = null, onError = null, width = 1200, height = 800,
    locked = true, requireAdjustment = false, allowGIF = false, allowUpscale = true, lockFormat = true, lockQuality = false,
    format = 'image/webp', quality = 85, profile = '', title = 'Upload e tratamento de imagens' } = {}) {
    this.el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.el) throw Error('Elemento do uploader não encontrado.');
    this.uploadUrl = uploadUrl; this.token = token; this.onUpload = onUpload; this.onError = onError;
    this.width = width; this.height = height; this.locked = locked; this.requireAdjustment = requireAdjustment;
    this.allowGIF = locked ? false : allowGIF; this.allowUpscale = allowUpscale; this.lockFormat = lockFormat; this.lockQuality = lockQuality; this.format = format; this.quality = quality; this.profile = profile;
    this.studio = new ImageStudio();
    this.el.classList.add('oi-uploader');
    this.el.innerHTML = `<div class="oi-upload-heading"><div><h3>${this.escape(title)}</h3><p>${locked ? 'O sistema definiu as dimensões. Enquadre a imagem antes de confirmar.' : 'Defina o tamanho desejado, recorte e envie com prévia em tempo real.'}</p></div><span>PNG · JPG · WEBP · GIF</span></div>
      <div class="oi-upload-config" ${locked?'hidden':''}><label>Largura final <input type="number" class="oi-up-w" min="1" max="4096" value="${width}"></label><label>Altura final <input type="number" class="oi-up-h" min="1" max="4096" value="${height}"></label><label>Predefinição <select class="oi-up-preset"><option value="custom">Personalizado</option><option value="1200x630">Banner · 1200×630</option><option value="1080x1080">Quadrado · 1080×1080</option><option value="1200x800">Paisagem · 1200×800</option><option value="1080x1350">Retrato · 1080×1350</option><option value="400x400">Avatar · 400×400</option></select></label></div>
      <div class="oi-dropzone" tabindex="0" role="button" aria-label="Enviar imagem"><span class="oi-upload-illustration">▧</span><strong>Arraste uma imagem para cá</strong><p>ou clique para selecionar e ajustar o recorte obrigatório</p><b class="oi-target-badge">Dimensões finais: ${width} × ${height} px ${locked?'· FIXAS':''}</b><small>O excedente fica visível na prévia de corte.</small></div>
      <div class="oi-upload-result" hidden><img alt="Imagem produzida"><div><strong class="oi-up-name"></strong><p class="oi-up-meta"></p><a class="oi-up-url" href="#" target="_blank" rel="noopener noreferrer" hidden>Abrir imagem enviada</a></div><button class="oi-btn oi-btn-soft oi-up-again">Nova imagem</button></div>
      <p class="oi-up-status" aria-live="polite">Nenhuma imagem enviada.</p><input class="oi-up-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`;
    this.fileInput = this.el.querySelector('.oi-up-file');
    if(!this.allowGIF) this.fileInput.accept = 'image/png,image/jpeg,image/webp';
    const zone = this.el.querySelector('.oi-dropzone');
    const choose = () => this.fileInput.click();
    zone.addEventListener('click', choose);
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    this.el.querySelector('.oi-up-again').addEventListener('click', choose);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('is-dragover'); if (e.dataTransfer.files[0]) this.process(e.dataTransfer.files[0]); });
    this.fileInput.addEventListener('change', () => { if (this.fileInput.files[0]) this.process(this.fileInput.files[0]); this.fileInput.value = ''; });
    this.el.querySelector('.oi-up-preset').addEventListener('change', e => { if (e.target.value === 'custom') return; const [w,h] = e.target.value.split('x'); this.el.querySelector('.oi-up-w').value = w; this.el.querySelector('.oi-up-h').value = h; });
  }
  escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async process(file) {
    const width = this.locked ? this.width : Math.min(4096,Math.max(1,+(this.el.querySelector('.oi-up-w').value) || 1200));
    const height = this.locked ? this.height : Math.min(4096,Math.max(1,+(this.el.querySelector('.oi-up-h').value) || 800));
    const result = await this.studio.open(file, {width, height, locked:this.locked, requireAdjustment:this.requireAdjustment,
      allowGIF:this.allowGIF, allowUpscale:this.allowUpscale, lockFormat:this.lockFormat, lockQuality:this.lockQuality, format:this.format, quality:this.quality, aspectRatio:'free'});
    if (!result) return;
    const status = this.el.querySelector('.oi-up-status');
    status.textContent = 'Preparando upload…';
    let url = '';
    if (this.uploadUrl) {
      try {
        const form = new FormData(); form.append('file', result.blob, result.name); if(this.profile)form.append('profile',this.profile);
        const headers = this.token ? {'X-Upload-Token':this.token} : {};
        const response = await fetch(this.uploadUrl, {method:'POST', headers, body:form});
        const data = await response.json();
        if (!response.ok || !data.url) throw Error(data.error || 'Erro ao enviar imagem');
        url = data.url;
        status.textContent = 'Imagem enviada e armazenada no servidor.';
      } catch(e) { status.textContent = `Envio ao servidor falhou: ${e.message}. Prévia local disponível.`; this.onError?.(e); }
    } else status.textContent = 'Prévia local criada. Configure uploadUrl para persistir a imagem.';
    const localUrl = URL.createObjectURL(result.blob);
    if (this.localURL) URL.revokeObjectURL(this.localURL);
    this.localURL = localUrl;
    this.el.querySelector('.oi-upload-result').hidden = false;
    this.el.querySelector('.oi-upload-result img').src = localUrl;
    this.el.querySelector('.oi-up-name').textContent = result.name;
    this.el.querySelector('.oi-up-meta').textContent = `${result.width} × ${result.height} pixels · ${this.studio.bytes(result.blob.size)}${result.animated ? ' · GIF animado preservado' : ''}`;
    const link = this.el.querySelector('.oi-up-url'); link.hidden = !url;
    if(url) link.href = url;
    if(!this.uploadUrl || url) this.onUpload?.({ ...result, url, localUrl });
    return { ...result, url, localUrl };
  }
  destroy() { if(this.localURL) URL.revokeObjectURL(this.localURL); this.el.replaceChildren(); }
}
