import test from 'node:test';import assert from 'node:assert/strict';
import{normalizeSearch,filterAndSort}from'../src/index.mjs';
test('busca incremental ignora acentos',()=>{assert.equal(normalizeSearch('CONTRÁTO'),'contrato');assert.equal(filterAndSort([{name:'Contrato nº 1',tags:[]}],{query:'contrato'}).length,1);});
test('filtra tags e ordena dados',()=>{const files=[{name:'Z',size:3,tags:['teste']},{name:'A',size:1,tags:['contrato']}];
assert.equal(filterAndSort(files,{query:'contrato'})[0].name,'A');assert.equal(filterAndSort(files,{sortBy:'size',direction:'desc'})[0].name,'Z');});
