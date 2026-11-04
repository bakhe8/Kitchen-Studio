import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan,updateWall,updateCab,moveCab,resizeCab,applyPreset,setFinish,setWallColor,
  splitBand,removeDivider,cellRects,cabMinimum,wallMinimum,SHELF_LIMITS as L,partitionLimits} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,wallZones,contentFor,setScopedContent,targetInfo,targetParent,selectedTarget,selectTarget,
  splitTarget,removeTargetDivider,moveScopedDivider,removalTargetCheck} from '../public/shelf-selection-model.js';

const c=key=>({kind:'cell',key}),z=key=>({kind:'zone',key}),cab={kind:'cabinet'},wall={kind:'wall'};
const base=createShelfPlan(),original=JSON.stringify(base),near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const keyMap=rows=>new Map(rows.map(x=>[x.key,x]));
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const split=(p,t,a)=>{const r=splitTarget(p,t,a);assert(r.ok,r.reason);assert.deepEqual(r.target,t);assert.deepEqual(selectedTarget(r.plan),t);return r.plan;};
const inside=(a,b)=>a.x>=b.x-1e-7&&a.y>=b.y-1e-7&&a.x+a.w<=b.x+b.w+1e-7&&a.y+a.h<=b.y+b.h+1e-7;
function verify(p){
  const copy=validatePlan(JSON.parse(JSON.stringify(p)));assert(copy,'Refused model-generated saved plan');assert.deepEqual(copy,p,'Round-trip changed plan/selection.');
  const cells=scopedCells(p),zones=wallZones(p),ds=scopedDividers(p);
  assert.equal(cells.length,new Set(cells.map(r=>r.key)).size);assert.equal(zones.length,new Set(zones.map(r=>r.key)).size);
  assert.equal(ds.length,new Set(ds.map(r=>r.id)).size);assert(targetInfo(p,selectedTarget(p)));
  for(const a of [...cells,...zones]){assert(a.w>=14-1e-7&&a.h>=14-1e-7);assert(inside(a,a.kind==='cell'?p.cab:{x:0,y:0,...p.wall}));assert(targetInfo(p,a).leaf);}
  for(const d of ds){const parent=targetInfo(p,d.owner);assert(parent);assert(inside(d,parent));near(d.axis==='col'?d.x+d.w/2:d.y+d.h/2,d.cm);near(d.axis==='col'?d.w:d.h,d.kind==='wall'?0:L.divider);}
  return p;
}
freeze(base);assert.equal(base.version,1);assert.deepEqual(validatePlan(JSON.parse(original)),base);assert(!Object.hasOwn(validatePlan(base),'cellGrids'));
assert.equal(targetInfo(base,cab).label,'الدولاب كله');assert.deepEqual(targetParent(base,c('1:1')),cab);assert.deepEqual(targetParent(base,cab),wall);
assert.equal(targetParent(base,wall),null);assert.deepEqual(wallZones(base),[]);

// One local split only affects the chosen original compartment. Saved v1
// content follows the left/upper child, never copied or lost.
const parent=c('1:1'),bounds=targetInfo(base,parent),neighbours=scopedCells(base).filter(r=>r.key!=='1:1');
const once=verify(split(base,parent,'col'));assert.deepEqual(neighbours,scopedCells(once).filter(r=>!r.key.startsWith('1:1/')));
assert.equal(scopedCells(once).length,10);assert.equal(contentFor(once,'1:1/0'),'plant');assert.equal(contentFor(once,'1:1/1'),'empty');
assert.equal(setScopedContent(once,'1:1','vase'),once,'An internal group is not one leaf to furnish.');
assert.match(targetInfo(once,c('1:1/0')).label,/الجزء الأيسر/);assert.match(targetInfo(once,c('1:1/1')).label,/الجزء الأيمن/);
const localD=scopedDividers(once).find(d=>d.owner.key==='1:1');assert.deepEqual(localD.owner,parent);near(localD.y,bounds.y);near(localD.h,bounds.h);
const keepGlobal=scopedDividers(once).filter(d=>d.owner.kind==='cabinet');
const dragged=verify(moveScopedDivider(once,localD.id,-100));near(targetInfo(dragged,c('1:1/0')).w,14);
assert.deepEqual(keepGlobal,scopedDividers(dragged).filter(d=>d.owner.kind==='cabinet'));
assert.deepEqual(neighbours,scopedCells(dragged).filter(r=>!r.key.startsWith('1:1/')));
assert.equal(moveScopedDivider(once,'missing',150),once);assert.equal(moveScopedDivider(once,localD.id,NaN),once);

// A chosen child may itself be divided. A leaf has no interior divider and
// cannot remove a parent's board, a cabinet-wide shelf or another child.
const twice=verify(split(once,c('1:1/0'),'row'));assert.equal(contentFor(twice,'1:1/0/0'),'plant');
assert.deepEqual(targetParent(twice,c('1:1/0/0')),c('1:1/0'));assert.match(targetInfo(twice,c('1:1/0/0')).label,/الجزء العلوي/);
assert.deepEqual(targetInfo(twice,c('1:1/1')).rect,targetInfo(once,c('1:1/1')).rect);
for(const a of ['col','row']){const leaf=c('1:1/0/1'),r=removeTargetDivider(twice,leaf,a);assert(!r.ok&&r.reason);assert.equal(r.plan,twice);assert.equal(r.target,leaf);}
const nestedD=scopedDividers(twice).find(d=>d.owner.key==='1:1/0');near(nestedD.w,targetInfo(twice,c('1:1/0')).w);
const movedNested=verify(moveScopedDivider(twice,nestedD.id,10000));near(targetInfo(movedNested,c('1:1/0/1')).h,14);
assert.deepEqual(targetInfo(twice,c('1:1/1')).rect,targetInfo(movedNested,c('1:1/1')).rect);

// Reselecting an internal group adds a cut spanning that group, not one at
// cabinet level. Existing child IDs stay valid after another row/column.
const cross=verify(split(once,parent,'row'));assert.equal(scopedCells(cross).filter(r=>r.key.startsWith('1:1/')).length,4);
assert.equal(contentFor(cross,'1:1/0'),'plant');assert.match(targetInfo(cross,c('1:1/2')).label,/الجزء في الصف/);
const newRow=scopedDividers(cross).find(d=>d.axis==='row'&&d.owner.key==='1:1');near(newRow.w,bounds.w);near(newRow.x,bounds.x);
assert.deepEqual(neighbours,scopedCells(cross).filter(r=>!r.key.startsWith('1:1/')));

// Nested work is preserved when a cabinet-wide operation reindexes the base
// cells. Preserving a populated subtree outranks an explicit content-merge flag.
let rightTree=split(base,c('2:0'),'row');rightTree=selectTarget(rightTree,c('2:0/0'));
const earlier=verify(splitBand(rightTree,'col',0));assert.equal(contentFor(earlier,'3:0/0'),'vase');assert.deepEqual(selectedTarget(earlier),c('3:0/0'));
const restored=verify(removeDivider(earlier,'col',0));assert.equal(contentFor(restored,'2:0/0'),'vase');assert.deepEqual(selectedTarget(restored),c('2:0/0'));
const unsafe=setScopedContent(rightTree,'1:0','books');const refusal=removeTargetDivider(unsafe,cab,'col',{index:1,allowContentMerge:true});assert(!refusal.ok&&!refusal.canForce);assert.equal(refusal.plan,unsafe);
const full=verify(split(twice,cab,'col'));assert.equal(full.cols.length,base.cols.length+1);assert(scopedCells(full).some(x=>x.depth===2&&x.content==='plant'));
for(const d of scopedDividers(full).filter(d=>d.owner.kind==='cabinet'&&d.axis==='col'))near(d.h,full.cab.h-2*L.frame);

// Content conflicts require consent; a successful removal preserves the
// parent as selection, including when an older selection pointed at a child.
const withItems=selectTarget(setScopedContent(once,'1:1/1','vase'),c('1:1/1'));
const ck=removalTargetCheck(withItems,parent,'col');assert(!ck.ok&&ck.canForce);assert.equal(ck.conflicts[0].keepKey,'1:1/0');
assert.equal(removeTargetDivider(withItems,parent,'col').plan,withItems);
const merged=removeTargetDivider(withItems,parent,'col',{allowContentMerge:true});assert(merged.ok);verify(merged.plan);
assert.equal(contentFor(merged.plan,'1:1'),'plant');assert.deepEqual(selectedTarget(merged.plan),parent);assert(targetInfo(merged.plan,parent).leaf);

// Wall divisions are planning lines without timber thickness. Recursion and
// dragging inside one zone leave the cabinet and other zones untouched.
const w1=verify(split(twice,wall,'col'));assert.deepEqual(scopedCells(w1),scopedCells(twice));assert.deepEqual(wallZones(w1).map(x=>x.key),['wall/0','wall/1']);
const wd=scopedDividers(w1).find(x=>x.kind==='wall');near(wd.h,w1.wall.h);near(wd.w,0);
assert.match(targetInfo(w1,z('wall/0')).label,/منطقة الجدار · الجزء الأيسر/);
const w2=verify(split(w1,z('wall/0'),'row'));assert.equal(wallZones(w2).length,3);const rightZone=targetInfo(w1,z('wall/1')).rect;
assert.deepEqual(targetInfo(w2,z('wall/1')).rect,rightZone);assert.deepEqual(scopedCells(w2),scopedCells(twice));
const zoneLine=scopedDividers(w2).find(x=>x.owner.key==='wall/0');near(zoneLine.w,w1.wall.w/2);near(zoneLine.h,0);
const wz=verify(moveScopedDivider(w2,zoneLine.id,90));near(targetInfo(wz,z('wall/0/0')).h,90);assert.deepEqual(targetInfo(wz,z('wall/1')).rect,rightZone);
assert.deepEqual(targetParent(wz,z('wall/0/1')),z('wall/0'));assert.deepEqual(targetParent(wz,z('wall/0')),wall);
assert.equal(setScopedContent(wz,'wall/0/1','vase'),wz);assert.equal(removeTargetDivider(wz,z('wall/1'),'row').plan,wz);
const wallCross=verify(split(wz,wall,'row'));const wholeRow=scopedDividers(wallCross).find(d=>d.owner.kind==='wall'&&d.axis==='row');near(wholeRow.w,wallCross.wall.w);

// Every legacy geometry edit still respects nested minima and wall zones;
// shrinking never invalidates a persisted local grid or silently removes it.
const min=cabMinimum(wz);assert(min.w>50&&min.h>50);
const shrunk=verify(updateCab(wz,min));const moved=verify(moveCab(shrunk,10,-10));assert.equal(contentFor(moved,'1:1/0/0'),'plant');
assert.deepEqual(wallZones(moved),wallZones(wz));assert.equal(updateCab(wz,{w:min.w-.1}),wz);
const smallWall=verify(updateWall(wz,wallMinimum(wz)));assert.equal(contentFor(smallWall,'1:1/0/0'),'plant');
const resize=verify(resizeCab(wz,'nw',{x:10000,y:10000}));near(resize.cab.w,min.w);near(resize.cab.h,min.h);
assert.equal(contentFor(setWallColor(setFinish(wz,'ivory'),'stone'),'1:1/0/0'),'plant');
const pre=verify(applyPreset(wz,'empty'));assert.equal(scopedCells(pre).length,1);assert.deepEqual(wallZones(pre),wallZones(wz));
assert.equal(JSON.stringify(base),original);assert.equal(contentFor(twice,'1:1/0/0'),'plant');

// Invalid saved hierarchies: bad ID/shape, unsafe coordinates, non-empty wall
// zone, orphan selection, duplicate content or physically impossible cells.
const bad=mutate=>{const copy=JSON.parse(JSON.stringify(wz));mutate(copy);assert.equal(validatePlan(copy),null);};
bad(p=>{p.selection=c('1:1/9999');});bad(p=>{p.cellGrids['1:1'].children[1].id=p.cellGrids['1:1'].children[0].id;});
bad(p=>{p.cellGrids['1:1'].cols=[1.2];});bad(p=>{p.cellGrids['1:1'].children.pop();});bad(p=>{p.cells['1:1']='vase';});
bad(p=>{p.wallGrid.children[1].content='plant';});bad(p=>{p.cab.w=49;});bad(p=>{p.cellGrids['1:1'].nextId=-1;});
const cycle=JSON.parse(JSON.stringify(wz));cycle.cellGrids['1:1'].children[0].grid=cycle.cellGrids['1:1'];assert.equal(validatePlan(cycle),null);
const legacy=JSON.parse(original);assert.deepEqual(validatePlan(legacy),base);assert.equal(JSON.stringify(legacy),original);

// Reproducible mixed edits also exercise the invariant that saving/reloading
// never loses a tree, selection or content after reindexing/resizing.
let p=applyPreset(createShelfPlan(),'empty'),seed=342911;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296),pick=a=>a[Math.floor(rand()*a.length)];
for(let i=0;i<130;i++){
  const leaves=scopedCells(p),zs=wallZones(p),ds=scopedDividers(p),choices=[wall,cab,...leaves.map(a=>c(a.key)),...zs.map(a=>z(a.key)),...ds.map(d=>d.owner)];
  const t=pick(choices),axis=rand()<.5?'row':'col',op=Math.floor(rand()*8),before=JSON.stringify(p);freeze(p);let q=p;
  if(op===0||op===1)q=splitTarget(p,t,axis).plan;if(op===2)q=removeTargetDivider(p,t,axis,{allowContentMerge:true}).plan;
  if(op===3&&ds.length){const d=pick(ds);q=moveScopedDivider(p,d.id,rand()*(d.axis==='col'?p.wall.w:p.wall.h));}
  if(op===4)q=setScopedContent(p,pick(leaves).key,pick(['books','empty','vase','plant','boxes']));if(op===5)q=updateWall(p,{w:60+rand()*500,h:60+rand()*350});
  if(op===6)q=resizeCab(p,'se',{x:rand()*p.wall.w,y:rand()*p.wall.h});if(op===7)q=selectTarget(p,t);
  assert.equal(JSON.stringify(p),before);p=verify(q);
}
assert.equal(partitionLimits.maxDepth,6);console.log('PASS: distinct wall, cabinet, local and recursively nested scopes; ownership/geometry, protective removal, resize and persistent v1/v2 plans; 130 mixed immutable edits.');
