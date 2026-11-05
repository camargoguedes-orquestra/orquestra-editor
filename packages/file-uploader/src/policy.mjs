/** Validação preventiva no navegador: o backend deve validar novamente. */
export function extensionOf(name) {
  const safe = String(name || '').split(/[\\/]/).pop() || '';
  const dot = safe.lastIndexOf('.');
  return dot > 0 ? safe.slice(dot + 1).toLowerCase() : '';
}
export function validateSelection(file, profile = {}) {
  const ext = extensionOf(file?.name);
  const max = (profile.extensions || {})[ext];
  if (!ext || !Number.isSafeInteger(max) || max <= 0)
    return { ok: false, code: 'extension_not_allowed' };
  if (!Number.isSafeInteger(file?.size) || file.size <= 0 || file.size > max)
    return { ok: false, code: 'file_too_large_or_empty' };
  return { ok: true, code: 'ok' };
}
export function validateBatch(files, profile = {}) {
  const list = Array.from(files || []);
  if (list.length > (profile.maxFiles ?? 10))
    return { ok: false, code: 'too_many_files' };
  const sum = list.reduce((n, file) => n + (file.size || 0), 0);
  if (!Number.isSafeInteger(sum) || sum > (profile.maxTotalBytes ?? 104857600))
    return { ok: false, code: 'batch_too_large' };
  const invalid = list.find(file => !validateSelection(file, profile).ok);
  return invalid ? { ok: false, code: 'invalid_file', file: invalid.name } : { ok: true, code: 'ok' };
}
