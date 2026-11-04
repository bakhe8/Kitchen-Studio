import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan,setShelfDepth,shelfDepth,applyPreset,moveCab,asScopedPlan} from '../public/shelf-model.js';
import {normalizeView} from '../public/shelf-view.js';
const original=createShelfPlan(),base=JSON.stringify(original),old=JSON.parse(base);delete old.depth;
assert.equal(shelfDepth(validatePlan(old)),36,'old designs remain usable');
const changed=setShelfDepth(original,58.5);
assert.equal(JSON.stringify(original),base);assert.equal(shelfDepth(changed),58.5);
for(const p of [changed,applyPreset(changed,'display'),moveCab(changed,4,3),asScopedPlan(changed)])assert.equal(shelfDepth(validatePlan(JSON.parse(JSON.stringify(p)))),58.5);
for(const depth of [0,151,NaN,Infinity]){assert.equal(setShelfDepth(original,depth),original);assert.equal(validatePlan({...original,depth}),null);}
const camera=normalizeView({volume:true,camera:{yaw:200,pitch:-92,zoom:7}});assert.deepEqual(camera,{volume:true,camera:{yaw:55,pitch:-15,zoom:2}});
assert.deepEqual(normalizeView(null),{volume:true,camera:{yaw:24,pitch:12,zoom:1}});
assert.equal(normalizeView({volume:false}).volume,false);
console.log('PASS: legacy plans, unchanged front geometry, depth persistence through presets/structural changes, undo snapshot, camera preference limits.');
