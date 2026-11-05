import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionOf, validateSelection, validateBatch } from '../src/policy.mjs';
const profile = { extensions: { pdf: 20, docx: 30 }, maxFiles: 3, maxTotalBytes: 50 };
test('extensões normalizadas', () => { assert.equal(extensionOf('C:\\docs\\TEST.PDF'),'pdf'); assert.equal(extensionOf('.env'),''); });
test('várias extensões', () => { assert.equal(validateSelection({name:'a.pdf',size:20},profile).ok,true); assert.equal(validateSelection({name:'b.docx',size:30},profile).ok,true); });
test('rejeições', () => { assert.equal(validateSelection({name:'a.exe',size:1},profile).code,'extension_not_allowed'); assert.equal(validateSelection({name:'a.pdf',size:21},profile).ok,false); });
test('lote', () => { assert.equal(validateBatch([{name:'a.pdf',size:20},{name:'b.docx',size:30}],profile).ok,true); assert.equal(validateBatch([{name:'a.pdf',size:20},{name:'b.docx',size:31}],profile).ok,false); });
