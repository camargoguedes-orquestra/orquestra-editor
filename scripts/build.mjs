// Gera dist/orquestra-editor.js (ES module com todas as dependências) e dist/orquestra-editor.css.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(new URL(import.meta.url).pathname), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'fonts'), { recursive: true });

const result = await build({
  entryPoints: { 'orquestra-editor': join(root, 'src/index.js') },
  outdir: dist,
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
  minify: true,
  sourcemap: Boolean(process.env.SOURCEMAP),
  legalComments: 'linked',
  logLevel: 'info',
  metafile: true,
});

// CSS: estilos do editor + KaTeX (fórmulas), com as fontes do KaTeX copiadas para dist/fonts.
const katexDir = dirname(require.resolve('katex/package.json'));
cpSync(join(katexDir, 'dist/fonts'), join(dist, 'fonts'), { recursive: true });
const katexCSS = readFileSync(join(katexDir, 'dist/katex.min.css'), 'utf8');
const ownCSS = readFileSync(join(root, 'src/styles.css'), 'utf8');
writeFileSync(join(dist, 'orquestra-editor.css'), `${ownCSS}\n/* KaTeX (MIT) */\n${katexCSS}\n`);
console.log('dist/orquestra-editor.css gerado');
if (process.env.ANALYZE) {
  const { analyzeMetafile } = await import('esbuild');
  console.log(await analyzeMetafile(result.metafile, { verbose: false }));
}
