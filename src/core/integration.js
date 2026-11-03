/**
 * Integração com o sistema hospedeiro: requisições HTTP com cabeçalhos próprios
 * e convivência com formulários (<form>) da página.
 */

/**
 * Monta o RequestInit de uma chamada ao backend.
 *
 * - `headers`: objeto ou função (síncrona ou assíncrona) que devolve um objeto. A função é
 *   chamada a cada requisição, então serve para ler um token CSRF que muda durante a sessão.
 * - `token`: mantido por compatibilidade; vira o cabeçalho X-Upload-Token.
 * - `credentials`: padrão 'same-origin' (envia o cookie de sessão do próprio domínio).
 */
export async function buildRequest({ headers = null, token = '', credentials = 'same-origin' } = {}, init = {}) {
  const custom = typeof headers === 'function' ? await headers() : headers;
  return {
    credentials,
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { 'X-Upload-Token': token } : {}),
      ...(custom && typeof custom === 'object' ? custom : {}),
    },
  };
}

/**
 * Impede que o componente interfira no <form> onde foi colocado:
 * - botões sem tipo viram type="button" (senão enviariam o formulário);
 * - Enter em campos internos não dispara o envio do formulário externo;
 * - envios dos formulários internos (diálogos, comentários) não chegam ao formulário externo.
 */
export function shieldFromOuterForm(root) {
  const fixButtons = (scope) => scope.querySelectorAll('button:not([type])').forEach((b) => { b.type = 'button'; });
  fixButtons(root);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches('button:not([type])')) n.type = 'button';
        fixButtons(n);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  const onKeydown = (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.form && !root.contains(t.form)) e.preventDefault();
  };
  const onSubmit = (e) => {
    if (e.target !== root && root.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  root.addEventListener('keydown', onKeydown);
  root.addEventListener('submit', onSubmit);
  return () => {
    observer.disconnect();
    root.removeEventListener('keydown', onKeydown);
    root.removeEventListener('submit', onSubmit);
  };
}

/**
 * Campo oculto que leva o valor do componente junto com o formulário da página.
 * Se o elemento já existir (input/textarea com o mesmo name dentro do form), ele é reaproveitado.
 */
export function createFormField(host, name, getValue) {
  if (!name) return null;
  const form = host.closest('form');
  let field = form ? [...form.elements].find((el) => el.name === name && !host.contains(el)) : null;
  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    host.after(field);
  }
  const sync = () => { field.value = getValue(); };
  // Atualiza no último instante, para valer o conteúdo do modo HTML ou de alterações recentes.
  const onFormData = (e) => {
    sync();
    // No evento formdata a lista já foi montada: grava direto no FormData.
    e.formData?.set(name, field.value);
  };
  form?.addEventListener('formdata', onFormData);
  form?.addEventListener('submit', onFormData, true);
  return {
    field,
    sync,
    destroy() {
      form?.removeEventListener('formdata', onFormData);
      form?.removeEventListener('submit', onFormData, true);
    },
  };
}
