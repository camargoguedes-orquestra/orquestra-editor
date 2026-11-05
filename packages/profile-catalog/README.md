# Catálogo de perfis independentes

Permite importar e exportar configurações JSON portáveis. Não exige serviços externos.

```js
import {importProfile,exportProfile} from './src/index.mjs';
const profile=importProfile(await (await fetch('/perfis/oficina.json')).text());
console.log(exportProfile(profile));
```

**Segurança:** o backend continua responsável por validar os limites, as permissões e o tenant. Nunca importe perfis não confiáveis diretamente em produção sem aprovação administrativa e prévia de alterações. Publicação estável ainda pendente.
