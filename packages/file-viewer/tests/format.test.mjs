import test from 'node:test';
import assert from 'node:assert/strict';
import {detectViewerType,safeSameOriginUrl} from '../src/index.mjs';
test('formatos permitidos',()=>{
  assert.equal(detectViewerType('contrato.PDF'),'pdf');
  assert.equal(detectViewerType('plano.xlsx'),'office');
  assert.equal(detectViewerType('foto.webp'),'image');
  assert.equal(detectViewerType('video.mp4'),'video');
  assert.equal(detectViewerType('documento.svg'),'blocked');
  assert.equal(detectViewerType('arquivo.exe'),'unsupported');
});
test('nao permite URL de origem externa nem usuario embutido',()=>{
  assert.equal(safeSameOriginUrl('/api/files/1','https://app.example'),'https://app.example/api/files/1');
  assert.throws(()=>safeSameOriginUrl('https://evil.example/file','https://app.example'));
  assert.throws(()=>safeSameOriginUrl('https://x:pass@app.example/a','https://app.example'));
});
