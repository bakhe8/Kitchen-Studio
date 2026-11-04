import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fieldInputs} from '../public/kitchen-field-catalog.js';

const root=new URL('../',import.meta.url);
const historical=readFileSync(new URL('docs/kitchen-studio/logic-coverage.html',root),'utf8');
const historicTypes=new Map([...historical.matchAll(/<tr data-code="([^"]+)" data-type="([APR])">/g)].map(m=>[m[1],m[2]]));
assert.equal([...historicTypes.values()].filter(t=>t==='P').length,127);
const source=readFileSync(new URL('docs/kitchen-studio/logic-closure.html',root),'utf8');
const cards=[...source.matchAll(/<article id="([A-Z]+-\d+)" data-code="\1" data-kind="(input|gap)">(.*?)<\/article>/gs)];
assert.deepEqual(cards.map(card=>card[1]),fieldInputs.map(f=>f.code));
assert.equal(new Set(cards.map(card=>card[1])).size,146);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
for(const [[,id,kind,body],entry] of cards.map((c,i)=>[c,fieldInputs[i]])){
  for(const k of ['effect','gap','fact','external'])assert(new RegExp('<dd data-'+k+'>[^<]+</dd>').test(body),id+' '+k);
  assert(body.includes(escape(entry.spec)),id+' specification');
  assert(body.includes(escape(entry.owner)),id+' owner');
  assert(body.includes(escape(entry.method)),id+' input');
  assert.equal(body.includes('يكفي استكمال البيانات في هذا النطاق.'),kind==='input',id);
  const next=body.match(/data-category="(input|rule|external|extended)"/);
  assert(next,id+' decision class');
  assert.equal(next[1]==='input',kind==='input',id+' input boundary');
  assert(body.includes('المراجعة السابقة · '+(historicTypes.get(id)==='P'?'جزئي':'منفذ ضمن نطاق')),id+' historical status');
  const tests=[...body.matchAll(/<code>([^<]+)<\/code>/g)].map(m=>m[1]);
  assert(tests.length,id+' missing evidence');
  for(const name of tests)assert(existsSync(new URL(name,root)),name);
}
console.log('146 current workbook identities, independent effects/rule boundaries/source facts, accountable data owners, and runnable regression references.');
