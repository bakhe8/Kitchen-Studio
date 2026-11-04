import assert from 'node:assert/strict';
import {createShelfPlan,updateWall,updateCab,applyPreset,validatePlan} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,targetInfo,commitDividerDrop,splitTarget,moveScopedDivider,setScopedContent} from '../public/shelf-selection-model.js';
import {groupFinish,effectiveFinish} from '../public/shelf-group-finish.js';
import {layoutCopyRegions,copyLayout} from '../public/shelf-copy-layout.js';

const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const t=key=>({kind:'cell',key}),leaf=(p,key)=>scopedCells(p).find(c=>c.key===key),inside=(r,fx,fy)=>({x:r.x+fx*r.w,y:r.y+fy*r.h});
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
const ids=g=>g.children.flatMap(c=>[c.id,...(c.grid?ids(c.grid):[])]);
const occupied=(p,fn)=>scopedCells(p).filter(fn).map(c=>c.content).filter(c=>c!=='empty').sort();
const edit=(p,key,axis,fx,fy)=>{const r=commitDividerDrop(p,t(key),axis,inside(leaf(p,key),fx,fy));assert(r.ok,r.reason);return r.plan;};
let p=updateCab(updateWall(createShelfPlan(),{w:850,h:550}),{w:640,h:440});
p=edit(p,'0:0','row',.33,.41);p=edit(p,'0:0/0','col',.37,.5);
p=splitTarget(p,{kind:'wall'},'col').plan;
p=groupFinish(p,['0:0/0/0','0:0/0/1'],'walnut').plan;
p=groupFinish(p,['2:2'],'ivory').plan;p=freeze(p);
const initial=JSON.stringify(p),list=layoutCopyRegions(p);
assert(list.some(r=>r.id==='column:0'&&r.split));assert(list.some(r=>r.id==='cell:0:0/0'&&r.split));assert(list.some(r=>r.id==='cell:2:2'&&!r.split));
const preview=copyLayout(p,'cell:0:0','cell:2:2');assert(preview.ok&&preview.wouldChange&&!preview.changed,preview.reason);assert.equal(preview.plan,p);assert.equal(preview.before.leaves.length,1);assert.equal(preview.after.leaves.length,3);
const applied=copyLayout(p,'cell:0:0','cell:2:2',{apply:true});assert(applied.ok&&applied.changed);assert.deepEqual(applied.after,preview.after);assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(applied.plan))),applied.plan);assert.deepEqual(applied.plan.wallGrid,p.wallGrid);assert.equal(applied.plan.cellGrids['0:0'],p.cellGrids['0:0']);assert.notEqual(applied.plan.cellGrids['0:0'],applied.plan.cellGrids['2:2']);assert(!ids(applied.plan.cellGrids['2:2']).some(id=>ids(applied.plan.cellGrids['0:0']).includes(id)));
for(const key of applied.keys)assert.equal(effectiveFinish(applied.plan,key),'ivory');assert.deepEqual(occupied(applied.plan,c=>applied.keys.includes(c.key)),['books']);assert.deepEqual(applied.plan.rows,p.rows);assert.deepEqual(applied.plan.cols,p.cols);
const originalR=targetInfo(p,t('0:0')),targetR=targetInfo(applied.plan,t('2:2'));
const sourceBoard=scopedDividers(p).find(d=>d.owner.key==='0:0'),copyBoard=scopedDividers(applied.plan).find(d=>d.owner.key==='2:2');almost((sourceBoard.cm-originalR.y)/originalR.h,(copyBoard.cm-targetR.y)/targetR.h);
const moved=moveScopedDivider(applied.plan,copyBoard.id,copyBoard.cm+3);assert.notEqual(moved,applied.plan);assert.equal(scopedDividers(moved).find(d=>d.id===sourceBoard.id).cm,sourceBoard.cm);
const originalSourceChildren=scopedCells(p).filter(c=>c.key.startsWith('0:0/'));assert.deepEqual(scopedCells(moved).filter(c=>c.key.startsWith('0:0/')),originalSourceChildren);
for(const c of scopedCells(p).filter(c=>c.key!=='2:2'))assert.deepEqual(leaf(applied.plan,c.key),c);

// Existing cabinet-wide rows are shared structural boards, not cuts owned
// by either column. Carry *each* source band into its matching target band.
const col=copyLayout(p,'column:0','column:2',{apply:true});assert(col.ok&&col.changed,col.reason);assert.equal(col.keys.length,5);assert.deepEqual(occupied(col.plan,c=>c.col===2),occupied(p,c=>c.col===2));assert.deepEqual(scopedCells(col.plan).filter(c=>c.col!==2),scopedCells(p).filter(c=>c.col!==2));assert.deepEqual(scopedDividers(col.plan).filter(d=>d.owner.kind==='cabinet'),scopedDividers(p).filter(d=>d.owner.kind==='cabinet'));assert.deepEqual(scopedDividers(col.plan).filter(d=>d.kind==='wall'),scopedDividers(p).filter(d=>d.kind==='wall'));assert.equal(validatePlan(col.plan)?.version,2);
const wholeTemplate=copyLayout(p,'column:0','cell:2:2',{apply:true});assert(wholeTemplate.ok&&wholeTemplate.changed,wholeTemplate.reason);assert.equal(wholeTemplate.after.leaves.length,wholeTemplate.sourceView.leaves.length);
for(const [src,dst,code] of [['cell:0:0','column:2','shared-shelf'],['column:0','cell:0:0','overlap'],['cell:0:0','cell:0:0/0','overlap'],['cell:missing','column:2','missing-scope'],['cell:1:0','column:2','plain-source']]){
  const q=copyLayout(p,src,dst,{apply:true,allowDiscard:true});assert(!q.ok&&!q.changed);assert.equal(q.plan,p);assert.equal(q.code,code);
}
const already=copyLayout(col.plan,'column:0','column:2',{apply:true,allowDiscard:true});assert(already.ok&&!already.changed&&!already.wouldChange);assert.equal(already.plan,col.plan);
let small=applyPreset(createShelfPlan(),'empty');small={...small,cab:{...small.cab,w:116,h:80},cols:[.8],rows:[],selectedCell:'0:0',cells:{'0:0':'empty','1:0':'empty'}};small=edit(small,'0:0','col',.5,.5);const noFit=copyLayout(small,'cell:0:0','cell:1:0',{apply:true});assert(!noFit.ok);assert.equal(noFit.code,'clearance');assert.equal(noFit.plan,small);

// Source and target use the same grid size but different partition directions.
// All three distinct target item kinds are preserved if possible, and none
// is removed without an explicit separate approval if only two slots remain.
let busy=applyPreset(createShelfPlan(),'empty');busy={...busy,cab:{...busy.cab,w:230,h:190},cols:[.5],rows:[],cells:{'0:0':'empty','1:0':'empty'},selectedCell:'0:0'};
busy=edit(busy,'0:0','col',.5,.5);busy=edit(busy,'1:0','row',.5,.34);let targetBox=targetInfo(busy,t('1:0'));let insert=commitDividerDrop(busy,t('1:0'),'row',inside(targetBox,.5,.67));assert(insert.ok);busy=insert.plan;
let targetLeaves=scopedCells(busy).filter(c=>c.col===1);for(const [i,c] of targetLeaves.entries())busy=setScopedContent(busy,c.key,['books','plant','vase'][i]);busy=freeze(busy);
const refused=copyLayout(busy,'column:0','column:1',{apply:true});assert.equal(refused.code,'occupied');assert(!refused.ok&&!refused.changed);assert.equal(refused.plan,busy);assert.equal(refused.removed.length,1);assert.equal(refused.after.leaves.filter(c=>c.content!=='empty').length,2);
const approved=copyLayout(busy,'column:0','column:1',{apply:true,allowDiscard:true});assert(approved.ok&&approved.changed);assert.equal(approved.removed.length,1);assert.deepEqual(occupied(approved.plan,c=>c.col===1).concat(approved.removed.map(c=>c.content)).sort(),['books','plant','vase']);assert.deepEqual(occupied(approved.plan,c=>c.col===0),[]);
assert.equal(JSON.stringify(p),initial);
console.log('Layout copy: independent branch/column geometry and IDs, immutable preview/undo baseline, shared shelf protection, exact scale limits, destination finishes, object preservation and explicit discard checked.');
