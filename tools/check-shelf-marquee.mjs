import assert from 'node:assert/strict';
import {createShelfPlan, validatePlan} from '../public/shelf-model.js';
import {scopedCells, scopedDividers, splitTarget, wallZones} from '../public/shelf-selection-model.js';
import {marqueeCells, currentLeafKeys, bulkSetContent} from '../public/shelf-marquee.js';

function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(freeze);
  }
  return o;
}
const pt = (x,y) => ({x,y});
const toward = r => pt(r.x+r.w/2, r.y+r.h/2);
const inside = (r,f) => pt(r.x+r.w*f, r.y+r.h*f);
const byKey = (plan,key) => scopedCells(plan).find(r => r.key === key);
const keysIn = (p,a,b) => marqueeCells(p,a,b).keys;
const all = (p) => scopedCells(p).map(c=>c.key);
const base = freeze(createShelfPlan());
const a = byKey(base,'0:0'), b = byKey(base,'1:1');
const tl = toward(a), br = toward(b), four = ['0:0','1:0','0:1','1:1'];
assert.deepEqual(keysIn(base,tl,br), four);
assert.deepEqual(marqueeCells(base,br,tl), marqueeCells(base,tl,br));
assert.deepEqual(marqueeCells(base,pt(br.x,tl.y),pt(tl.x,br.y)), marqueeCells(base,tl,br));
assert.deepEqual(marqueeCells(base,tl,br).rect, {x:tl.x,y:tl.y,w:br.x-tl.x,h:br.y-tl.y});

// Horizontal and vertical sweeps can cross several interiors; a stationary
// point and a rectangle/line that only touches an exterior edge cannot.
assert.deepEqual(keysIn(base,pt(-10,tl.y),pt(1000,tl.y)), ['0:0','1:0','2:0']);
assert.deepEqual(keysIn(base,pt(tl.x,999),pt(tl.x,-20)), ['0:0','0:1','0:2']);
assert.deepEqual(marqueeCells(base,tl,tl), {rect:{...tl,w:0,h:0},keys:[]});
assert.deepEqual(keysIn(base,pt(a.x-3,a.y-3),pt(a.x,a.y)), []);
assert.deepEqual(keysIn(base,pt(a.x-7,a.y),pt(a.x,a.y+a.h)), []);
assert.deepEqual(keysIn(base,pt(a.x,a.y),pt(a.x+a.w,a.y)), []);
const wood = scopedDividers(base).find(d=>d.id==='cabinet:col:0');
assert.deepEqual(keysIn(base,pt(wood.cm,-7),pt(wood.cm,999)), []);
assert.deepEqual(keysIn(base,pt(wood.cm-.1,tl.y-1),pt(wood.cm+.1,tl.y+1)), []);
assert.deepEqual(keysIn(base,pt(-100,-100),pt(-50,900)), []);
assert.deepEqual(keysIn(base,pt(-100,-100),pt(999,999)), all(base));
assert.deepEqual(keysIn(base,pt(a.x-.01,tl.y),pt(a.x+.01,tl.y)), ['0:0']);
for (const bad of [null,{},pt('11',12),pt(NaN,1),pt(1,Infinity)]) {
  assert.deepEqual(marqueeCells(base,bad,br), {rect:null,keys:[]});
  assert.deepEqual(marqueeCells(base,tl,bad), {rect:null,keys:[]});
}

function split(p,kind,key,axis) {
  const r = splitTarget(p,key ? {kind,key} : {kind},axis);
  assert.ok(r.ok,r.reason);
  return freeze(r.plan);
}
let nested = split(base,'cell','0:0','col');
nested = split(nested,'cell','0:0/0','row');
nested = split(nested,'wall',null,'row');
const deepKey = '0:0/0/0', otherDeepKey = '0:0/0/1', rightChild = '0:0/1';
const deep = byKey(nested,deepKey), otherDeep = byKey(nested,otherDeepKey);
assert.deepEqual(keysIn(nested,inside(deep,.25),inside(deep,.8)), [deepKey]);
assert.deepEqual(keysIn(nested,toward(deep),toward(otherDeep)), [deepKey,otherDeepKey]);
assert.deepEqual(keysIn(nested,pt(a.x,a.y),pt(a.x+a.w,a.y+a.h)), [deepKey,otherDeepKey,rightChild]);
const everywhere = keysIn(nested,pt(-100,-100),pt(999,999));
assert.deepEqual(everywhere, all(nested));
assert.equal(everywhere.length,11);
assert(!everywhere.includes('0:0') && !everywhere.includes('0:0/0'));
assert(wallZones(nested).length && !everywhere.some(k=>k.startsWith('wall')));

const snapshot = JSON.stringify(nested);
const chosen = ['2:2',otherDeepKey,deepKey,'2:2'];
const expectedKeys = [deepKey,otherDeepKey,'2:2'];
assert.deepEqual(currentLeafKeys(nested,[...chosen,'wall/0','0:0','old']),expectedKeys);
assert.deepEqual(currentLeafKeys(nested,new Set(chosen)),expectedKeys);
assert.deepEqual(currentLeafKeys(nested,null),[]);
assert.deepEqual(currentLeafKeys(nested,deepKey),[]);
for (const [keys,id] of [
  [[deepKey,'0:0'],'vase'], [[deepKey,'0:0/0'],'vase'], [['wall/0',otherDeepKey],'vase'],
  [[null,deepKey],'vase'], [[deepKey,'0:0/0/999'],'vase'], [[deepKey],'unknown'],
  [[], 'vase'], [deepKey,'vase']
]) {
  const r = bulkSetContent(nested,keys,id);
  assert.equal(r.plan,nested);
  assert.deepEqual({changed:r.changed,count:r.count,keys:r.keys},{changed:false,count:0,keys:[]});
}

// A single undo entry restores all edited leaves. Deep and top-level writes
// coexist; no geometry, wall zone, unrelated content or selection is edited.
const geometry = p => scopedCells(p).map(({content,...cell}) => cell);
const r = bulkSetContent(nested,chosen,'vase');
assert.equal(r.changed,true); assert.equal(r.count,3); assert.deepEqual(r.keys,expectedKeys);
assert.deepEqual(geometry(r.plan),geometry(nested));
assert.deepEqual(scopedDividers(r.plan),scopedDividers(nested));
assert.deepEqual(wallZones(r.plan),wallZones(nested));
assert.deepEqual(r.plan.selection,nested.selection);
for (const leaf of scopedCells(nested)) {
  assert.equal(byKey(r.plan,leaf.key).content, expectedKeys.includes(leaf.key) ? 'vase' : leaf.content);
}
const repeated = bulkSetContent(r.plan,expectedKeys,'vase');
assert.equal(repeated.plan,r.plan); assert.equal(repeated.count,0); assert(!repeated.changed);
assert.deepEqual(repeated.keys,expectedKeys);
const mixed = bulkSetContent(r.plan,[deepKey,'1:0'],'vase');
assert.equal(mixed.count,1); assert.deepEqual(mixed.keys,[deepKey,'1:0']);
assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(r.plan))),r.plan);
assert.equal(JSON.stringify(nested),snapshot);
assert.deepEqual(expectedKeys.map(k=>byKey(nested,k).content),['books','empty','books']);
assert.deepEqual(expectedKeys.map(k=>byKey(r.plan,k).content),['vase','vase','vase']);
const legacy = bulkSetContent(base, ['0:0','2:0'], 'empty');
assert.equal(legacy.plan.version,1); assert.equal(legacy.count,2);
assert.deepEqual(validatePlan(legacy.plan),legacy.plan);
console.log('Shelf marquee: rectangle, lines, board edges, nested leaves and atomic content edits passed.');
