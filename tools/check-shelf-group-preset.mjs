import assert from 'node:assert/strict';
import {createShelfPlan,updateWall,updateCab,applyPreset,validatePlan,asScopedPlan,totalPartitionNodes} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,splitTarget,selectedTarget,targetInfo} from '../public/shelf-selection-model.js';
import {groupPreset} from '../public/shelf-group-preset.js';

function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
const t=key=>({kind:'cell',key}), almost=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
const cell=(p,key)=>scopedCells(p).find(c=>c.key===key);
let big=updateCab(updateWall(createShelfPlan(),{w:900,h:600}),{w:650,h:390});
big=splitTarget(big,{kind:'wall'},'col').plan;
big=freeze(splitTarget(big,t('0:0'),'col').plan);
const chosen=['2:2','0:0/0','2:2'];
const original=JSON.stringify(big);
for(const id of ['library','display']){
  const r=groupPreset(big,chosen,id);
  assert(r.ok,r.reason);assert(r.changed);assert.equal(r.count,2);assert.equal(r.keys.length,id==='library'?18:12);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(r.plan))),r.plan);
  assert.deepEqual(selectedTarget(r.plan),selectedTarget(big));
  for(const key of ['wall','cab','finish','wallColor','wallGrid','cols','rows'])assert.deepEqual(r.plan[key],big[key],key);
  const newParts=scopedDividers(r.plan).filter(d=>chosen.includes(d.owner?.key));
  assert.equal(newParts.length,id==='library'?8:6);
  assert.deepEqual(scopedDividers(r.plan).filter(d=>!chosen.includes(d.owner?.key)),scopedDividers(big));
  for(const pre of scopedCells(big)){
    if(!chosen.includes(pre.key)){assert.deepEqual(cell(r.plan,pre.key),pre);continue;}
    // Enough clearance for the untrimmed reference layout. Match its actual
    // characteristic ratios AND local content arrangement, not only counts.
    const kids=scopedCells(r.plan).filter(c=>c.parentKey===pre.key);
    assert(kids.every(c=>r.keys.includes(c.key)));
    const cols=newParts.filter(d=>d.owner.key===pre.key&&d.axis==='col'),rows=newParts.filter(d=>d.owner.key===pre.key&&d.axis==='row');
    (id==='library'?[.29,.67]:[.42,.73]).forEach((f,i)=>almost((cols[i].cm-pre.x+2)/(pre.w+4),f));
    (id==='library'?[.30,.64]:[.55]).forEach((f,i)=>almost((rows[i].cm-pre.y+2)/(pre.h+4),f));
    const find=(col,row)=>kids.find(c=>c.localCol===col&&c.localRow===row)?.content;
    if(id==='library'){assert.equal(find(0,0),'books');assert.equal(find(2,0),'vase');assert.equal(find(1,1),'plant');assert.equal(find(0,2),'boxes');assert.equal(find(2,2),'books');}
    else{assert.equal(find(0,0),'vase');assert.equal(find(2,0),'plant');assert.equal(find(1,1),'books');assert.equal(find(2,1),'boxes');}
  }
  const clear=groupPreset(r.plan,r.keys,'empty');assert(clear.ok&&clear.changed);
  assert.deepEqual(scopedDividers(clear.plan),scopedDividers(r.plan));assert.deepEqual(clear.keys,r.keys);
  assert(r.keys.every(k=>cell(clear.plan,k).content==='empty'));
  for(const c of scopedCells(r.plan))if(!r.keys.includes(c.key))assert.deepEqual(cell(clear.plan,c.key),c);
  const noOp=groupPreset(clear.plan,clear.keys,'empty');assert(noOp.ok&&!noOp.changed);assert.equal(noOp.count,0);assert.equal(noOp.plan,clear.plan);
}
assert.equal(JSON.stringify(big),original);

// Two 30 × 14 cm clear openings can accept two columns but only one row.
// Their real shared frame is unchanged, and the local recipe contributes
// only the two central boards (no extra cabinet frames on the leaf edges).
let small=applyPreset(createShelfPlan(),'empty');small={...small,cab:{...small.cab,w:66,h:18},cols:[.5],cells:{'0:0':'plant','1:0':'empty'},selectedCell:'0:0'};
assert(validatePlan(small));const compact=groupPreset(small,['0:0','1:0'],'library');assert(compact.ok,compact.reason);assert.equal(compact.keys.length,4);
assert.deepEqual(scopedCells(compact.plan).map(c=>c.content),['books','vase','books','vase']);
assert(scopedCells(compact.plan).every(c=>Math.abs(c.w-14)<1e-7&&Math.abs(c.h-14)<1e-7));

function denied(p,ks,id,code){const r=groupPreset(p,ks,id);assert(!r.ok&&!r.changed);assert.equal(r.plan,p);assert.deepEqual(r.keys,ks);assert.equal(r.count,0);assert.equal(r.code,code);assert.match(r.reason,/[\u0600-\u06ff]/);}
denied(big,['2:2','old'],'library','stale-group');denied(big,['2:2','0:0'],'display','stale-group');denied(big,chosen,'invented','invalid-preset');
let deep={...applyPreset(createShelfPlan(),'empty'),wall:{w:1200,h:600},cab:{x:10,y:10,w:1100,h:560},cols:[.5],rows:[],cells:{'0:0':'books','1:0':'empty'},selectedCell:'0:0'};
let tail='0:0';for(let i=0;i<6;i++){const q=splitTarget(deep,t(tail),i%2?'row':'col');assert(q.ok,q.reason);deep=q.plan;tail+='/0';}
assert.equal(targetInfo(deep,t(tail)).depth,6);denied(deep,['1:0',tail],'library','depth-limit');
// Each six-slot display recipe fits in isolation, the pair exceeds 768.
const grid=(nc,nr)=>({cols:Array.from({length:nc-1},(_,i)=>(i+1)/nc),rows:Array.from({length:nr-1},(_,i)=>(i+1)/nr),children:Array.from({length:nc*nr},(_,id)=>({id,content:'empty'})),nextId:nc*nr});
const d={...asScopedPlan(createShelfPlan()),wall:{w:1200,h:600},wallGrid:grid(5,1)};
for(const c of d.wallGrid.children){delete c.content;c.grid=grid(12,12);}
for(let i=0;i<18;i++){const c=d.wallGrid.children[0].grid.children[i];delete c.content;c.grid=grid(1,2);}
const dense=validatePlan(d);assert(dense);assert.equal(totalPartitionNodes(dense),761);denied(dense,['0:0','2:2'],'display','node-limit');
console.log('Group presets: original miniature recipes, adaptive density, local contents, migrated leaves, untouched exteriors, and atomic depth/node refusals passed.');
