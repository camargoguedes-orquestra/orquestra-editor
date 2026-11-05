import { validateSelection, validateBatch } from './policy.mjs';
/** OrquestraFileUploader: interface independente; o backend valida tudo novamente. */
export class OrquestraFileUploader {
  constructor({ element, uploadUrl, profile, headers = {}, fields = {}, concurrentUploads = 3, autoUpload = false, onEvent = () => {} }) {
    this.root = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.root || !uploadUrl || !profile?.extensions) throw new Error('element, uploadUrl e profile.extensions são obrigatórios');
    this.uploadUrl = uploadUrl;
    this.profile = profile;
    this.headers = headers;
    this.fields = fields;
    this.concurrentUploads = Math.max(1, Math.min(10, concurrentUploads));
    this.autoUpload = autoUpload;
    this.onEvent = onEvent;
    this.items = new Map();
    this.active = 0;
    this.destroyed = false;
    this.render();
  }
  emit(type, detail = {}) { this.onEvent({ type, ...detail }); }
  render() {
    this.root.classList.add('orq-file-uploader');
    this.root.innerHTML = '<div class="orq-drop" role="button" tabindex="0">Arraste arquivos aqui ou pressione Enter para selecionar</div><input class="orq-input" type="file" multiple hidden><div class="orq-list" aria-live="polite"></div><button type="button" class="orq-submit">Enviar arquivos</button>';
    this.drop = this.root.querySelector('.orq-drop');
    this.input = this.root.querySelector('.orq-input');
    this.list = this.root.querySelector('.orq-list');
    this.submit = this.root.querySelector('.orq-submit');
    this.input.accept = Object.keys(this.profile.extensions).map(x => '.' + x).join(',');
    this.drop.addEventListener('click', () => this.input.click());
    this.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.input.click(); } });
    this.drop.addEventListener('dragover', e => e.preventDefault());
    this.drop.addEventListener('drop', e => { e.preventDefault(); this.addFiles(e.dataTransfer.files); });
    this.input.addEventListener('change', () => { this.addFiles(this.input.files); this.input.value = ''; });
    this.submit.addEventListener('click', () => this.start());
  }
  addFiles(files) {
    if (this.destroyed) return;
    for (const file of Array.from(files || [])) {
      const result = validateSelection(file, this.profile);
      if (!result.ok) { this.emit('file.rejected', { file: file.name, ...result }); continue; }
      const pending = [...this.items.values()].filter(v => v.state !== 'canceled').map(v => v.file);
      const batch = validateBatch([...pending, file], this.profile);
      if (!batch.ok) { this.emit('file.rejected', { file: file.name, code: batch.code }); continue; }
      const id = crypto.randomUUID();
      const item = { id, file, state: 'queued', progress: 0, xhr: null, name: file.name, description: '' };
      this.items.set(id, item);
      this.addRow(item);
      this.emit('file.queued', { id, name: file.name, bytes: file.size });
    }
    if (this.autoUpload) this.start();
  }
  setMetadata(id, { displayName, description } = {}) {
    const item = this.items.get(id);
    if (!item || !['queued', 'failed'].includes(item.state)) return false;
    if (typeof displayName === 'string') item.name = displayName;
    if (typeof description === 'string') item.description = description;
    return true;
  }
  addRow(item) {
    const row = document.createElement('div'); row.className = 'orq-file';
    const label = document.createElement('span'); label.textContent = item.file.name;
    const progress = document.createElement('progress'); progress.max = 100; progress.value = 0;
    const status = document.createElement('span'); status.textContent = 'Aguardando';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reenviar'; retry.hidden = true;
    retry.addEventListener('click', () => { if (item.state === 'failed') { item.state = 'queued'; retry.hidden = true; this.start(); } });
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => { if (item.xhr) item.xhr.abort(); item.state = 'canceled'; status.textContent = 'Cancelado'; this.emit('upload.canceled', { id: item.id }); });
    row.append(label, progress, status, retry, cancel); this.list.append(row);
    item.ui = { row, progress, status, retry };
  }
  start() {
    if (this.destroyed) return;
    while (this.active < this.concurrentUploads) {
      const next = [...this.items.values()].find(i => i.state === 'queued');
      if (!next) break;
      this.send(next);
    }
  }
  send(item) {
    this.active++;
    item.state = 'uploading';
    const xhr = new XMLHttpRequest(); item.xhr = xhr;
    const form = new FormData();
    form.append('file', item.file, item.file.name);
    form.append('profile', this.profile.id || '');
    form.append('displayName', item.name);
    form.append('description', item.description);
    for (const [key, value] of Object.entries(this.fields)) form.append(key, String(value));
    let settled = false;
    const finish = (state, detail = {}) => {
      if (settled) return;
      settled = true;
      this.active--; item.xhr = null;
      item.state = state; item.ui.status.textContent = state;
      item.ui.retry.hidden = state !== 'failed';
      this.emit(state === 'completed' ? 'upload.completed' : 'upload.failed', { id: item.id, ...detail });
      this.start();
    };
    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      item.progress = Math.round(100 * e.loaded / e.total);
      item.ui.progress.value = item.progress;
      this.emit('upload.progress', { id: item.id, loaded: e.loaded, total: e.total, percent: item.progress });
    });
    xhr.addEventListener('load', () => {
      const data = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok) finish('completed', { response: data });
      else finish('failed', { status: xhr.status, response: data });
    });
    xhr.addEventListener('error', () => finish('failed', { error: 'network' }));
    xhr.addEventListener('abort', () => {
      if (settled) return;
      settled = true; this.active--; item.xhr = null;
      item.ui.status.textContent = 'Cancelado'; this.start();
    });
    xhr.open('POST', this.uploadUrl, true);
    const headers = typeof this.headers === 'function' ? this.headers() : this.headers;
    for (const [key, value] of Object.entries(headers || {})) xhr.setRequestHeader(key, value);
    this.emit('upload.started', { id: item.id, name: item.file.name });
    xhr.send(form);
  }
  destroy() {
    this.destroyed = true;
    for (const item of this.items.values()) item.xhr?.abort();
    this.root.replaceChildren();
    this.root.classList.remove('orq-file-uploader');
    this.items.clear();
  }
}
export { validateSelection, validateBatch } from './policy.mjs';
