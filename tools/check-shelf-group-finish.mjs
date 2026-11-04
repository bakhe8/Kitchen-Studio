import assert from 'node:assert/strict';
import {createShelfPlan,asScopedPlan,setFinish,setWallColor,splitBand,removeDivider,applyPreset,validatePlan} from '../public/shelf-model.js';
import {scopedCells,splitTarget,removeTargetDivider,setScopedContent,moveScopedDivider} from '../public/shelf-selection-model.js';
import {effectiveFinish,groupFinish} from '../public/shelf-group-finish.js';
import {transformGroup} from '../public/shelf-group-transform.js';

const cell=key=>({kind:'cell',key});
const round=p=>assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
const palette=p=>Object.fromEntries(scopedCells(p).map(c=>[c.key,effectiveFinish(p,c.key)]));
const paint=(p,ks,f)=>{const old=JSON.stringify(p),r=groupFinish(p,ks,f);assert(r.changed);assert.equal(JSON.stringify(p),old);round(r.plan);assert.deepEqual(scopedCells(r.plan),scopedCells(p));assert.equal(r.plan.finish,p.finish);assert.equal(r.plan.wallColor,p.wallColor);return r.plan;};
const split=(p,key,a)=>{const r=splitTarget(p,cell(key),a);assert(r.ok,r.reason);round(r.plan);return r.plan;};
const remove=(p,key,a,index)=>{const r=removeTargetDivider(p,cell(key),a,{index});assert(r.ok,r.reason);round(r.plan);return r.plan;};
const base=createShelfPlan(),baseJSON=JSON.stringify(base);
assert.equal(base.version,1);assert(!base.bayFinishes);assert.equal(effectiveFinish(base,'1:1'),'oak');
assert.equal(groupFinish(base,['1:1'],'oak').plan,base);
let p=paint(base,['0:0','1:1'],'walnut');
assert.equal(p.version,2);assert.equal(effectiveFinish(p,'2:2'),'oak');
assert.equal(groupFinish(p,['1:1','0:0','0:0'],'walnut').plan,p);
let changedGlobal=setWallColor(setFinish(p,'ivory'),'sage');
assert.equal(effectiveFinish(changedGlobal,'0:0'),'walnut');assert.equal(effectiveFinish(changedGlobal,'0:1'),'ivory');
p=split(p,'1:1','col'); // A local split inherits the backing of its parent.
assert.equal(effectiveFinish(p,'1:1/0'),'walnut');assert.equal(effectiveFinish(p,'1:1/1'),'walnut');
p=paint(p,['1:1/0'],'ivory');p=split(p,'1:1/0','row');
assert.equal(effectiveFinish(p,'1:1/0/0'),'ivory');assert.equal(effectiveFinish(p,'1:1/0/1'),'ivory');
assert.equal(effectiveFinish(p,'1:1/1'),'walnut');
p=paint(p,['1:1/0/1'],'oak');
assert.equal(effectiveFinish(p,'1:1/0/1'),'oak');
const colors=palette(p);
assert.deepEqual(palette(setScopedContent(p,'1:1/0/1','books')),colors,'editing content must preserve all ancestor finishes');
assert.deepEqual(palette(moveScopedDivider(p,'cell:1:1/0:row:0',130)),colors);
const geom=transformGroup(p,['1:1/0/1'],{type:'move',dx:1,dy:1});assert(geom.changed);assert.deepEqual(palette(geom.plan),colors);round(geom.plan);
assert.deepEqual(groupFinish(p,['1:1/0/1','1:1/0'],'walnut'),{plan:p,changed:false,keys:[],count:0});
assert.equal(groupFinish(p,['wall/0','0:0'],'ivory').plan,p);
assert.equal(groupFinish(p,['0:0'],'red').plan,p);

// Reassigning the parent's colour removes the leaf override, so subsequent
// structural inheritance still works. Explicit 'oak' under ivory is distinct.
const reset=paint(p,['1:1/0/1'],'ivory');
assert(!Object.hasOwn(reset.cellGrids['1:1'].children[0].grid.children[1],'finish'));
assert.equal(effectiveFinish(p,'1:1/0/1'),'oak');

// Root insertion duplicates only the divided bay's own backing and shifts
// distant existing keys/trees together with their contents.
const widened=splitBand(p,'col',0);round(widened);
assert.equal(effectiveFinish(widened,'0:0'),'walnut');assert.equal(effectiveFinish(widened,'1:0'),'walnut');
assert.equal(effectiveFinish(widened,'2:1/0/1'),'oak');assert.equal(effectiveFinish(widened,'2:1/1'),'walnut');
assert.equal(effectiveFinish(widened,'1:1'),'oak');
const rebuilt=removeDivider(widened,'col',0);round(rebuilt);assert.deepEqual(palette(rebuilt),colors);
const taller=splitBand(p,'row',0);round(taller);
assert.equal(effectiveFinish(taller,'0:1'),'walnut');assert.equal(effectiveFinish(taller,'1:2/0/0'),'ivory');
assert.deepEqual(palette(removeDivider(taller,'row',0)),colors);

// Merge follows the same actual survivor as contents; left/top wins for two
// conflicting finishes on two empty bays. A finished sole survivor may be
// promoted through the former grid without losing its inherited default.
let m=applyPreset(asScopedPlan(base),'empty');
m=split(m,'0:0','col');m=paint(m,['0:0/1'],'ivory');
const promoted=remove(m,'0:0','col',0);assert.equal(effectiveFinish(promoted,'0:0'),'ivory');
m=paint(m,['0:0/0'],'walnut');assert.equal(effectiveFinish(remove(m,'0:0','col',0),'0:0'),'walnut');
m=setScopedContent(m,'0:0/1','books');const donor=remove(m,'0:0','col',0);
assert.equal(donor.cells['0:0'],'books');assert.equal(effectiveFinish(donor,'0:0'),'ivory');
let extra=applyPreset(asScopedPlan(base),'empty'); extra=split(extra,'0:0','col');
extra=paint(extra,['0:0/1'],'walnut');extra=split(extra,'0:0/1','row');
const promotedTree=remove(extra,'0:0','col',0);
assert.deepEqual(Object.values(palette(promotedTree)),['walnut','walnut']);

const blank=applyPreset(p,'library');round(blank);assert(!blank.bayFinishes);
assert(scopedCells(blank).every(c=>effectiveFinish(blank,c.key)===blank.finish));
// Even reapplying an identical preset must clear a custom backing.
const samePreset=applyPreset(paint(base,['1:1'],'ivory'),'library');assert(!samePreset.bayFinishes);round(samePreset);
for(const bad of [
  {...base,bayFinishes:{'0:0':'oak'}},{...p,bayFinishes:{'0:0':'purple'}},
  {...p,bayFinishes:{'99:0':'ivory'}},{...p,bayFinishes:{'1:1/0':'walnut'}}
]) assert.equal(validatePlan(bad),null);
const wall=splitTarget(p,{kind:'wall'},'row').plan;round(wall);
const bad=structuredClone(wall);bad.wallGrid.children[0].finish='ivory';assert.equal(validatePlan(bad),null);
const badDeep=structuredClone(p);badDeep.cellGrids['1:1'].children[0].finish='purple';assert.equal(validatePlan(badDeep),null);
round(p);assert.equal(JSON.stringify(base),baseJSON);
console.log('Shelf finishes: local inheritance, edits, geometry, root rekeying, nested merges, reset and persistence passed.');
