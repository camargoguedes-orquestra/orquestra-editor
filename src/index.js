export { OrquestraEditor, sanitizeHTML, VERSION } from './editor.js';
export { ImageStudio, OrquestraImageUploader } from './image-studio.js';
export { cleanOfficeHTML, migrateLegacyHTML, secureMedia, secureURL } from './core/sanitize.js';

/** Conversões DOCX carregadas sob demanda (mantêm o pacote principal leve). */
export const docxToHTML = (...args) => import('./io/docx.js').then((m) => m.docxToHTML(...args));
export const exportDocx = (...args) => import('./io/docx.js').then((m) => m.exportDocx(...args));
