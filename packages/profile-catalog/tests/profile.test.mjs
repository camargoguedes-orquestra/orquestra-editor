import test from 'node:test';import assert from 'node:assert/strict';
import {importProfile,exportProfile,validateProfile} from '../src/index.mjs';
const good={schemaVersion:'1.0',name:'documentos-oficina',version:'1.0.0',
 components:['file-uploader'],upload:{extensions:{pdf:20971520}},processing:{ocr:true,ai:false}};
test('round trip JSON',()=>assert.deepEqual(importProfile(exportProfile(good)),good));
test('rejeita credencial em objeto',()=>assert.throws(()=>validateProfile({...good,security:{apiKey:'nao'}})));
test('rejeita extensão maliciosa',()=>assert.throws(()=>validateProfile({...good,upload:{extensions:{'../php':42}}})));
test('rejeita schema desconhecido',()=>assert.throws(()=>validateProfile({...good,schemaVersion:'2.0'})));
