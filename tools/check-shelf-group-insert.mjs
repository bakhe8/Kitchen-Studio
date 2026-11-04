import assert from 'node:assert/strict';
import {createShelfPlan,asScopedPlan,validatePlan,totalPartitionNodes,partitionLimits} from '../public/shelf-model.js';
import {groupPlacement} from '../public/shelf-group-insert.js';
import {scopedCells,scopedDividers,wallZones,splitTarget,planDividerDrop} from '../public/shelf-selection-model.js';

const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const by=(p,k)=>scopedCells(p).find(c=>c.key===k);
const pt=(c,x=.5,y=.5)=>({x:c.x+x*c.w,y:c.y+y*c.h});
const t=key=>({kind:'cell',key});
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
const base=freeze(createShelfPlan()),keys=['2:2','0:0','1:1','2:2'];

// Different-sized physical openings need independent full-length lines at
// the SAME relative fraction. The clicked leaf is not first in model order.
for(const axis of ['row','col']){
  const click=pt(by(base,'2:2'),.44,.42),r=groupPlacement(base,keys,axis,click);
  assert(r.ok,r.reason);assert.equal(r.plan,base);assert(!r.changed);assert.deepEqual(r.keys,keys);
  assert.equal(r.count,3);assert.equal(r.lines.length,3);assert.deepEqual(r.target,t('2:2'));
  assert.equal(r.preview,r.lines.find(l=>l.owner.key==='2:2'));
  for(const l of r.lines){const c=by(base,l.owner.key);assert.deepEqual(l.owner,t(c.key));assert.equal(l.thickness,2);
    if(axis==='row'){almost(l.cm,c.y+.42*c.h);almost(l.x1,c.x);almost(l.x2,c.x+c.w);almost(l.y1,l.y2);}
    else{almost(l.cm,c.x+.44*c.w);almost(l.y1,c.y);almost(l.y2,c.y+c.h);almost(l.x1,l.x2);}}
  const committed=groupPlacement(base,keys,axis,click,null,true);assert(committed.ok,committed.reason);assert(committed.changed);
  assert.equal(committed.keys.length,6);assert.equal(new Set(committed.keys).size,6);assert.deepEqual(committed.lines,r.lines);
  assert.notEqual(committed.plan,base);assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(committed.plan))),committed.plan);
  assert.deepEqual(committed.plan.rows,base.rows);assert.deepEqual(committed.plan.cols,base.cols);assert.deepEqual(committed.plan.cab,base.cab);
  assert.deepEqual(wallZones(committed.plan),wallZones(base));assert.equal(scopedDividers(committed.plan).length,scopedDividers(base).length+3);
  for(const original of scopedCells(base)){
    if(!keys.includes(original.key)){assert.deepEqual(by(committed.plan,original.key),original);continue;}
    const children=scopedCells(committed.plan).filter(c=>c.parentKey===original.key);
    assert.equal(children.length,2);assert(children.every(c=>committed.keys.includes(c.key)));
    assert.deepEqual(children.map(c=>c.content),[original.content,'empty']);
  }
  const again=groupPlacement(committed.plan,committed.keys,axis==='row'?'col':'row',pt(by(committed.plan,committed.keys[0])),null,true);
  assert(again.ok,again.reason);assert.equal(again.keys.length,12);
}

function denied(plan,group,axis,p,hit=null,code){for(const apply of [false,true]){
  const out=groupPlacement(plan,group,axis,p,hit,apply);
  assert.equal(out.ok,false);assert(!out.changed);assert.equal(out.plan,plan);assert.deepEqual(out.keys,[...group]);
  assert.deepEqual(out.lines,[]);assert.equal(out.preview,null);assert.equal(out.target,null);assert.equal(out.count,0);
  assert.match(out.reason,/[\u0600-\u06ff]/);if(code)assert.equal(out.code,code);
}}
const center=pt(by(base,'0:0'));
denied(base,keys,'row',pt(by(base,'1:0')),null,'outside-group');
denied(base,keys,'col',{x:1,y:1},null,'outside-group');
denied(base,keys,'row',pt(by(base,'0:0'),0,.5),null,'outside-group');
denied(base,keys,'row',center,{dividerId:'cabinet:row:0'},'not-clear');
denied(base,['0:0','missing'],'row',center,null,'stale-group');
denied(base,['0:0'],'col',center,null,'not-a-group');

// One member would accept this position; another is narrower than two
// minimum openings. Both previews and actual writes must remain all-or-none.
const nested=freeze(splitTarget(base,t('0:0'),'col').plan);
const nestedGroup=['1:1','0:0/0'];
assert(planDividerDrop(nested,t('1:1'),'col',pt(by(nested,'1:1'))).ok);
denied(nested,nestedGroup,'col',pt(by(nested,'1:1')),null,'band-too-small');
denied(nested,['0:0','1:1'],'row',pt(by(nested,'1:1')),null,'stale-group');
const yes=groupPlacement(nested,new Set(nestedGroup),'row',pt(by(nested,'0:0/0')),null,true);
assert(yes.ok,yes.reason);assert.deepEqual(by(yes.plan,'0:0/1'),by(nested,'0:0/1'));

// With three slots left, each leaf alone can acquire two nodes but the pair
// would exceed the serialized plan limit. Reject before showing any line.
function grid(nc,nr){return {cols:Array.from({length:nc-1},(_,i)=>(i+1)/nc),rows:Array.from({length:nr-1},(_,i)=>(i+1)/nr),children:Array.from({length:nc*nr},(_,id)=>({id,content:'empty'})),nextId:nc*nr};}
const almostFull={...asScopedPlan(base),wall:{w:1200,h:600},wallGrid:grid(5,1)};
for(const c of almostFull.wallGrid.children)c.grid=grid(12,12);
for(let i=0;i<20;i++){const c=almostFull.wallGrid.children[0].grid.children[i];delete c.content;c.grid=grid(1,2);}
// A group node uses a grid instead of a content field in persisted form.
for(const c of almostFull.wallGrid.children)delete c.content;
const dense=validatePlan(almostFull);assert(dense);assert.equal(totalPartitionNodes(dense),partitionLimits.maxNodes-3);
for(const key of ['0:0','1:1'])assert(planDividerDrop(dense,t(key),'row',pt(by(dense,key))).ok);
denied(dense,['0:0','1:1'],'row',pt(by(dense,'0:0')),null,'node-limit');
console.log('Group insertion: relative lines, atomic clearance and aggregate node budgets, contents and untouched exteriors, nested leaf migration and repeat passed.');
