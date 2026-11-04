import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan} from '../public/shelf-model.js';
import {scopedDividers,scopedCells,commitDividerDrop,splitTarget,moveScopedDivider,
  selectedTarget,dividerDragStatus} from '../public/shelf-selection-model.js';
import {sharedSelectionReach as shared,groupSharedDividers as boards} from '../public/shelf-shared-selection.js';

const c=key=>({kind:'cell',key});
const leaf=(p,k)=>scopedCells(p).find(v=>v.key===k);
const board=(p,id)=>scopedDividers(p).find(v=>v.id===id);
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
const at=(p,key)=>{const r=leaf(p,key);return {x:r.x+r.w/2,y:r.y+r.h/2};};
const pl=(p,target,axis,pt)=>{const o=commitDividerDrop(p,target,axis,pt);assert(o.ok,o.reason);return o.plan;};
const split=(p,key,axis)=>{const o=splitTarget(p,c(key),axis);assert(o.ok,o.reason);return o.plan;};
const span=(s,lo,hi)=>{near(s.start,lo);near(s.end,hi);};
const group=['0:0','1:0'],base=createShelfPlan(),initial=JSON.stringify(base);
const cv='cabinet:col:0',rh='cabinet:row:0',leftTop=leaf(base,'0:0'),rightTop=leaf(base,'1:0');
const v=shared(base,group,cv);assert(v);assert.equal(v.axis,'col');assert.deepEqual(v.owner,{kind:'cabinet'});
assert.equal(v.segments.length,1);span(v.segments[0],leftTop.y,leftTop.y+leftTop.h);
assert.deepEqual(v.target,c('0:0'));assert.equal(v.contacts[0].beforeKey,'0:0');assert.equal(v.contacts[0].afterKey,'1:0');
assert.equal(shared(base,group,rh),null);
assert.equal(boards(base,group).length,1);assert.equal(boards(base,['1:0','0:0','0:0'])[0],v);
assert.equal(shared(base,new Set(group),board(base,cv)),v);
for(const keys of [[],['0:0'],['0:0','0:1'],['0:0','1:1'],['0:0','2:0'],['0:0','1:0','lost']])
  assert.equal(shared(base,keys,cv),null);
assert.equal(shared(base,group,'cabinet:frame:left'),null);
assert.equal(shared(base,group,{...board(base,cv),owner:c('0:0')}),null);
assert.equal(shared(base,group,{...board(base,cv),cm:v.cm+1}),null);
const mutable=[...group];assert.equal(shared(base,mutable,cv),v);mutable[1]='0:1';assert.equal(shared(base,mutable,cv),null);

// Four adjacent bays share portions of TWO crossing boards. Their +-1 cm
// board-face gaps must not become shared space or draggable cross intersections.
const four=['0:0','1:0','0:1','1:1'],below=leaf(base,'0:1');
const crosses=boards(base,four);assert.deepEqual(crosses.map(x=>x.id).sort(),[cv,rh].sort());
const vv=shared(base,four,cv),hh=shared(base,four,rh);
assert.equal(vv.segments.length,2);span(vv.segments[0],leftTop.y,leftTop.y+leftTop.h);span(vv.segments[1],below.y,below.y+below.h);
near(vv.segments[1].start-vv.segments[0].end,2);
assert.equal(hh.segments.length,2);span(hh.segments[0],leftTop.x,leftTop.x+leftTop.w);span(hh.segments[1],rightTop.x,rightTop.x+rightTop.w);
const separated=shared(base,['0:0','1:0','0:2','1:2'],cv);
assert.equal(separated.segments.length,2);span(separated.segments[1],leaf(base,'0:2').y,leaf(base,'0:2').y+leaf(base,'0:2').h);

// T-junction: a single full-height cell faces two nested leaves. Only the
// selected matching child contributes; its parent never counts as a leaf.
const t=split(base,'1:0','row'),upper=leaf(t,'1:0/0'),lower=leaf(t,'1:0/1');
assert.equal(shared(t,['0:0','1:0'],cv),null);
const tt=shared(t,['0:0','1:0/1'],cv);assert(tt);span(tt.segments[0],lower.y,lower.y+lower.h);
const both=shared(t,['1:0/0','0:0','1:0/1'],cv);assert.equal(both.contacts.length,2);
span(both.segments[0],upper.y,upper.y+upper.h);span(both.segments[1],lower.y,lower.y+lower.h);
assert.deepEqual(both.contacts.map(q=>[q.beforeKey,q.afterKey]),[['0:0','1:0/0'],['0:0','1:0/1']]);
let nested=split(t,'1:0/1','col');assert.equal(shared(nested,['0:0','1:0/1/1'],cv),null);
assert.equal(shared(nested,['0:0','1:0/1/0'],cv).segments.length,1);

// Different grids may share an x or y coordinate without sharing identity.
// Resolve each local board through the actual owner and both faces.
const sibling=split(t,'0:0','row'),westBoard='cell:0:0:row:0',eastBoard='cell:1:0:row:0';
near(board(sibling,westBoard).cm,board(sibling,eastBoard).cm);
assert.equal(shared(sibling,['0:0/0','1:0/1'],westBoard),null);
assert.equal(shared(sibling,['0:0/0','1:0/1'],eastBoard),null);
assert.deepEqual(boards(sibling,['1:0/0','1:0/1']).map(r=>r.id),[eastBoard]);

// Two opposite clear faces which reach the same endpoint have zero overlap.
// Shift the far T-junction just 0.01 cm and the true overlap is included.
const cutY=leftTop.y+25,L=pl(base,c('0:0'),'row',{...at(base,'0:0'),y:cutY});
const edgeOnly=pl(L,c('1:0'),'row',{...at(L,'1:0'),y:cutY-2});
assert.equal(shared(edgeOnly,['0:0/0','1:0/1'],cv),null);
const sliver=pl(L,c('1:0'),'row',{...at(L,'1:0'),y:cutY-2.01});
const overlap=shared(sliver,['0:0/0','1:0/1'],cv);assert(overlap);near(overlap.segments[0].end-overlap.segments[0].start,.01);
const wall=pl(base,{kind:'wall'},'col',{x:21,y:21});
assert.equal(shared(wall,group,'zone:wall:col:0'),null);assert.deepEqual(boards(wall,['wall/0','wall/1']),[]);

// Drag uses the stable physical divider, not a transform of the selected
// envelope. A continuous root board also moves bordering unselected bays;
// a local board cannot move another bay. Contents, frame and selection stay.
const keys=['1:0/0','1:0/1'],old=JSON.stringify(t),d=board(t,eastBoard),rel=shared(t,keys,d);
const changed=moveScopedDivider(t,rel.id,d.cm+3),status=dividerDragStatus(t,rel.target,d,d.cm+3,changed);
assert(status.ok&&!status.clamped);near(board(changed,eastBoard).cm,d.cm+3);assert.deepEqual(changed.cab,t.cab);
assert.deepEqual(selectedTarget(changed),selectedTarget(t));assert.equal(JSON.stringify(t),old);
assert.deepEqual(scopedCells(changed).map(c=>[c.key,c.content]),scopedCells(t).map(c=>[c.key,c.content]));
for(const cell of scopedCells(t))if(!keys.includes(cell.key))assert.deepEqual(leaf(changed,cell.key),cell);
assert(shared(changed,keys,eastBoard));assert.equal(shared(changed,keys,d),null);
const moved=moveScopedDivider(base,cv,v.cm+3);assert.deepEqual(moved.cab,base.cab);near(leaf(moved,'0:2').w,leaf(base,'0:2').w+3);
assert.deepEqual(leaf(moved,'2:2'),leaf(base,'2:2'));assert(validatePlan(moved));
const stop=dividerDragStatus(t,rel.target,d,-10000);assert(stop.ok&&stop.clamped);assert.deepEqual(stop.owner,c('1:0'));
assert.equal(JSON.stringify(base),initial);
console.log('Shared selections: exact physical board faces, paired spans, T-junctions, disjoint/endpoint exclusions and scoped motion passed.');
