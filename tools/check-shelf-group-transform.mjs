import assert from 'node:assert/strict';
import {createShelfPlan,applyPreset,validatePlan,moveCab,resizeCab,SHELF_LIMITS as L} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,splitTarget,wallZones} from '../public/shelf-selection-model.js';
import {groupInfo,transformGroup,reframeGroup} from '../public/shelf-group-transform.js';

const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`Expected ${b}; got ${a}`);
const rect=(a,b)=>['x','y','w','h'].forEach(k=>near(a[k],b[k]));
const by=(p,key)=>scopedCells(p).find(c=>c.key===key);
const all=p=>scopedCells(p).map(c=>c.key);
const move=(dx,dy)=>({type:'move',dx,dy});
const size=(corner,dx,dy)=>({type:'resize',corner,dx,dy});
function frozen(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(frozen);}return o;}
function cut(p,kind,key,axis){
  const r=splitTarget(p,key?{kind,key}:{kind},axis);assert.ok(r.ok,r.reason);return r.plan;
}
function check(p,keys,spec) {
  frozen(p);const saved=JSON.stringify(p),r=transformGroup(p,keys,spec);
  assert.ok(r.ok,r.reason);assert.equal(JSON.stringify(p),saved);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(r.plan))),r.plan,'must round trip without correction');
  assert.equal(r.changed,r.plan!==p);assert.deepEqual(r.keys,groupInfo(p,keys).keys);
  rect(r.beforeBounds,groupInfo(p,keys).bounds);rect(r.bounds,groupInfo(r.plan,keys).bounds);
  assert.deepEqual(scopedCells(p).map(c=>[c.key,c.content]),scopedCells(r.plan).map(c=>[c.key,c.content]));
  assert.deepEqual(scopedDividers(p).map(d=>[d.id,d.axis]),scopedDividers(r.plan).map(d=>[d.id,d.axis]));
  assert.deepEqual(wallZones(r.plan),wallZones(p)); assert.equal(r.plan.wall,p.wall);assert.equal(r.plan.selection,p.selection);
  for(const c of scopedCells(r.plan)) assert(c.w>=L.minInterior-1e-7&&c.h>=L.minInterior-1e-7);
  const old=scopedCells(p), selected=new Set(keys);
  const affected=scopedCells(r.plan).filter((c,i)=>!selected.has(c.key)&&['x','y','w','h'].some(k=>Math.abs(c[k]-old[i][k])>1e-7)).map(c=>c.key);
  assert.deepEqual(r.affectedKeys,affected);assert.deepEqual(transformGroup(p,keys,spec),r,'preview and replay differ');
  return r;
}
const base=frozen(createShelfPlan());
let two=applyPreset(base,'empty');
two=cut(cut(two,'cabinet',null,'col'),'cabinet',null,'row');
const nw=by(two,'0:0'),oldCab=two.cab;
const first=check(two,['0:0'],move(11,7));
rect(first.bounds,{...nw,x:nw.x+11,y:nw.y+7});
assert(!first.clamped);assert(first.frameChanged);
rect(first.plan.cab,{x:oldCab.x+11,y:oldCab.y+7,w:oldCab.w-11,h:oldCab.h-7});
assert.deepEqual(first.affectedKeys,['1:0','0:1','1:1']);
for(const corner of ['nw','ne','sw','se']) {
  const r=check(two,['0:0'],size(corner,4,3));
  const w=corner.includes('w'),n=corner.includes('n');
  rect(r.bounds,{x:nw.x+(w?4:0),y:nw.y+(n?3:0),w:nw.w+(w?-4:4),h:nw.h+(n?-3:3)});
  assert.equal(r.frameChanged,w||n);
}

// Middle leaves move by shifting both surrounding boards. A disconnected
// pair is not replaced by its rectangular hull or treated as the whole cabinet.
const middle=by(base,'1:1'),rMid=check(base,['1:1'],move(6,-4));
rect(rMid.bounds,{...middle,x:middle.x+6,y:middle.y-4});assert.equal(rMid.plan.cab,base.cab);
const pair=['1:0','0:1'],pairMove=check(base,pair,move(5,4));
assert.equal(pairMove.all,false);assert(pairMove.affectedKeys.includes('2:2'),'shared continuous boards reach the last bay');
near(pairMove.plan.cab.x+pairMove.plan.cab.w,base.cab.x+base.cab.w);
const separated=check(base,['0:0','0:2'],move(5,0));
assert(!separated.affectedKeys.includes('2:2'));rect(by(separated.plan,'2:2'),by(base,'2:2'));
for(const k of pair){const c=by(base,k);rect(by(pairMove.plan,k),{...c,x:c.x+5,y:c.y+4});}
const pairRes=check(base,pair,size('se',7,4));
rect(pairRes.bounds,{...pairRes.beforeBounds,w:pairRes.beforeBounds.w+7,h:pairRes.beforeBounds.h+4});

// Reaching a wall or another opening's minimum on x must not erase dy.
const wallStop=check(base,['0:0'],move(-10000,4));near(wallStop.plan.cab.x,0);
assert.equal(wallStop.limits.x,'wall');near(wallStop.applied.dy,4);assert(!wallStop.limits.y);
const constrained=check(base,['1:1'],move(10000,3));
assert.equal(constrained.limits.x,'clearance');assert(constrained.reason);near(constrained.applied.dy,3);
near(by(constrained.plan,'2:1').w,L.minInterior);near(constrained.bounds.w,middle.w);
check(constrained.plan,['1:1'],move(20,0)).changed===false||assert.fail('Repeated push at stop changed the plan.');
// Unrelated vertical cuts remain in place for small motions, yielding only
// if the very next opening has reached minimum clear width.
const external=+scopedDividers(base).find(d=>d.id==='cabinet:col:1').cm;
near(scopedDividers(check(base,['0:0'],move(5,0)).plan).find(d=>d.id==='cabinet:col:1').cm,external);
const pushing=check(base,['0:0'],move(1000,0));
near(by(pushing.plan,'1:0').w,L.minInterior);near(by(pushing.plan,'2:0').w,L.minInterior);

// Nested geometry uses ancestor boundaries only when they bound a selected
// leaf. Changing a local grid never modifies a physically independent grid.
let nested=cut(base,'cell','1:1','col');
nested=cut(nested,'cell','1:1/0','row');
nested=cut(nested,'cell','2:2','col');
nested=cut(nested,'wall',null,'col');
const key='1:1/0/0',leaf=by(nested,key),n=check(nested,[key],move(3,2));
rect(by(n.plan,key),{...leaf,x:leaf.x+3,y:leaf.y+2});assert(!n.frameChanged);
assert.equal(n.plan.cellGrids['2:2'],nested.cellGrids['2:2']);
rect(by(n.plan,'2:2/0'),by(nested,'2:2/0'));
const nSize=check(nested,[key],size('se',4,2));
rect(nSize.bounds,{...leaf,w:leaf.w+4,h:leaf.h+2});
const deepLimit=check(nested,[key],size('nw',1000,-1));near(deepLimit.bounds.w,L.minInterior);near(deepLimit.applied.dy,-1);

// Entire selection is the actual cabinet operation, including nested grids,
// and old v1 plans stay v1. The group outline remains the clear opening envelope.
for(const p of [base,nested]) {
  const keys=all(p),i=groupInfo(p,keys);assert(i.all);
  rect(i.bounds,{x:p.cab.x+L.frame,y:p.cab.y+L.frame,w:p.cab.w-2*L.frame,h:p.cab.h-2*L.frame});
  const m=check(p,keys,move(8,9));assert.deepEqual(m.plan,moveCab(p,8,9));assert.deepEqual(m.affectedKeys,[]);
  const z=check(p,keys,size('nw',10,5));assert.deepEqual(z.plan,resizeCab(p,'nw',{x:p.cab.x+10,y:p.cab.y+5}));
}

const noop=check(base,['0:0'],move(0,0));assert.equal(noop.plan,base);
for(const [p,keys,spec] of [[base,[],move(1,1)],[nested,['0:0','1:1'],move(1,1)],
  [nested,['wall/0'],move(1,1)],[base,['0:0'],{type:'resize',corner:'middle',dx:1,dy:2}],
  [base,['0:0'],move(Infinity,1)]]) {
  const r=transformGroup(p,keys,spec);assert(!r.ok);assert(!r.changed);assert.equal(r.plan,p);assert(r.reason);
}
assert.deepEqual(groupInfo(base,['1:1','0:0','1:1']).keys,['0:0','1:1']);

// A drawn rectangle fixes both edges on both axes simultaneously. Unlike a
// handle, a failed drawing must not commit even a feasible component.
for(const [p,group] of [[two,['0:0']],[base,['1:0','0:1']],[nested,[key]],[nested,all(nested)]]) {
  const old=groupInfo(p,group).bounds,snapshot=JSON.stringify(p);
  const desired={x:old.x+3,y:old.y-2,w:old.w+4,h:old.h+3};
  const draw=reframeGroup(p,group,desired);assert(draw.ok,draw.reason);assert(draw.changed);assert(!draw.clamped);
  rect(draw.bounds,desired);rect(draw.beforeBounds,old);
  assert.deepEqual(scopedCells(draw.plan).map(c=>[c.key,c.content]),scopedCells(p).map(c=>[c.key,c.content]));
  assert.deepEqual(draw,reframeGroup(p,group,desired));assert.equal(JSON.stringify(p),snapshot);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(draw.plan))),draw.plan);
  assert.equal(reframeGroup(draw.plan,group,desired).plan,draw.plan);
}
const drawn=groupInfo(base,['0:0']).bounds;
// This opening would leave the next unselected bands too small, despite
// remaining inside the wall; reject without moving the cabinet or x OR y.
for(const invalid of [
  {...drawn,x:-1},{...drawn,y:2,h:base.wall.h},{...drawn,w:1},{...drawn,x:0},
  {...drawn,w:base.cab.w-5,y:drawn.y+4},{...drawn,w:NaN}
]) {const r=reframeGroup(base,['0:0'],invalid);assert(!r.ok);assert.equal(r.plan,base);assert(!r.changed);assert(r.reason);}
const obstructed=reframeGroup(base,all(base),{x:0,y:10,w:200,h:150});
assert(!obstructed.ok&&obstructed.plan===base);
const rounded=validatePlan({...base,cols:[(L.frame+L.minInterior+L.divider/2-5e-9)/base.cab.w,base.cols[1]]});
assert(rounded);check(rounded,['0:0'],move(0,3));
console.log('Shelf group geometry: corners, shared boards, nested/disconnected selections, exact drawing, axis limits and persistence passed.');
