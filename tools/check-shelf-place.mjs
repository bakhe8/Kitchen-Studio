import assert from 'node:assert/strict';
import {createShelfPlan,applyPreset,updateCab,validatePlan,SHELF_LIMITS} from '../public/shelf-model.js';
import {targetInfo,scopedDividers,scopedCells,wallZones,selectTarget,selectedTarget,splitTarget} from '../public/shelf-selection-model.js';
import {inspectPlacement,applyPlacement} from '../public/shelf-place.js';

const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const base=freeze(createShelfPlan()),saved=JSON.stringify(base),c=key=>({kind:'cell',key}),z=key=>({kind:'zone',key}),cab={kind:'cabinet'},wall={kind:'wall'};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`Expected ${b}, got ${a}`),at=(r,x=r.w/2,y=r.h/2)=>({x:r.x+x,y:r.y+y});
const snap=p=>JSON.stringify(p),split=(p,t,axis)=>{const v=splitTarget(p,t,axis);assert(v.ok,v.reason);return freeze(v.plan);};
const same=(a,b)=>a.kind===b.kind&&a.key===b.key;
function place(p,axis,point,expected,source,hit){
  const before=snap(p),scope=selectedTarget(p),view=inspectPlacement(p,axis,point,hit);assert(view.ok,view.reason);
  assert.deepEqual(view.target,expected);assert.equal(view.source,source);assert.deepEqual(view.point,point);
  assert(view.preview&&view.anchor&&view.label&&view.scopeLabel);assert(!Object.hasOwn(view,'plan'));
  const coordinate=axis==='row'?point.y:point.x;
  near(view.cm,coordinate);near(view.preview.cm,coordinate);assert.equal(snap(p),before);assert.deepEqual(selectedTarget(p),scope);
  const a=applyPlacement(p,axis,point,hit);assert(a.ok&&a.changed,a.reason);assert.deepEqual(a.preview,view.preview);assert.deepEqual(a.anchor,view.anchor);assert.deepEqual(a.target,view.target);
  const d=scopedDividers(a.plan).find(d=>same(d.owner,a.target)&&d.axis===axis&&Math.abs(d.cm-coordinate)<1e-7);
  assert(d,'No committed board at the previewed wall coordinate');
  if(axis==='row'){near(d.x,view.preview.x1);near(d.x+d.w,view.preview.x2);near(d.h,view.preview.thickness);}
  else{near(d.y,view.preview.y1);near(d.y+d.h,view.preview.y2);near(d.w,view.preview.thickness);}
  assert.deepEqual(validatePlan(JSON.parse(snap(a.plan))),a.plan);assert.equal(snap(p),before,'An edit damaged its undo snapshot.');
  return {p:freeze(a.plan),view};
}
function reject(plan,axis,point,code,hit){const before=snap(plan),r=inspectPlacement(plan,axis,point,hit),a=applyPlacement(plan,axis,point,hit);assert(!r.ok&&r.reason);if(code)assert.equal(r.code,code);assert.equal(a.plan,plan);assert(!a.changed);assert.equal(snap(plan),before);return r;}

// Selected scope, even an unrelated explicit wall/leaf, cannot capture the
// geometry-based single click. The first original cell is narrower than the
// widest cabinet band: only that cell gets the divider.
const t=c('0:0'),first=targetInfo(base,t),pt=at(first,21.625,18.875);
const local=place(base,'row',pt,t,'cell',{target:wall});assert.deepEqual(local.view.anchor,pt);near(local.view.preview.x2-local.view.preview.x1,first.w);
assert.deepEqual(local.p.rows,base.rows);assert.deepEqual(local.p.cols,base.cols);assert.equal(scopedCells(local.p).length,scopedCells(base).length+1);
assert.deepEqual(scopedCells(local.p).filter(r=>!r.key.startsWith('0:0/')),scopedCells(base).filter(r=>r.key!=='0:0'));
for(const wrong of [wall,cab,c('2:2')]){const selected=freeze(selectTarget(base,wrong));const m=inspectPlacement(selected,'col',pt,{target:wrong});assert(m.ok);assert.deepEqual(m.target,t);assert.deepEqual(selectedTarget(selected),wrong);}

// An entirely empty/undivided cabinet is a whole cabinet target. A ROOT
// without root-level cuts but with a local tree must instead use the leaf.
const bare=freeze(applyPreset(base,'empty')),barePt={x:180.375,y:120.5};
const firstWhole=place(bare,'col',barePt,cab,'undivided-cabinet',{target:c('0:0')});assert.equal(firstWhole.p.cols.length,1);near(firstWhole.view.preview.y2-firstWhole.view.preview.y1,bare.cab.h-2*SHELF_LIMITS.frame);
const subOnly=split(bare,c('0:0'),'row');assert(!subOnly.rows.length&&!subOnly.cols.length);const subKey=c('0:0/0');
place(subOnly,'col',at(targetInfo(subOnly,subKey),45.25,25),subKey,'cell',{target:cab});
const roomy=freeze(updateCab(base,{w:300,h:220,x:30,y:20})),parent=c('1:1'),nested=split(split(roomy,parent,'col'),c('1:1/0'),'row');
const deepest=c('1:1/0/1'),nr=targetInfo(nested,deepest),deep=place(nested,'row',at(nr,18,16.432),deepest,'cell',{target:parent});
near(deep.view.preview.x2-deep.view.preview.x1,nr.w);assert.equal(nested.cellGrids['1:1'].children.length,deep.p.cellGrids['1:1'].children.length);

// All four correct frame faces: the orthogonal anchor enters the adjacent
// clear interior. The change-defining coordinate stays exactly at the click.
const b=base.cab,frame=SHELF_LIMITS.frame,X=first.x+21.25,Y=first.y+21.375;
for(const [axis,side,point] of [
  ['row','left',{x:b.x+.5,y:Y}],['row','right',{x:b.x+b.w-.5,y:Y}],
  ['col','top',{x:X,y:b.y+.5}],['col','bottom',{x:X,y:b.y+b.h-.5}]
]){
  const a=place(base,axis,point,cab,'cabinet-frame',{target:c('1:1')});assert.equal(a.view.frameSide,side);assert.notDeepEqual(a.view.anchor,point);
  if(axis==='row'){assert.equal(a.view.anchor.y,point.y);near(a.view.preview.x1,b.x+frame);near(a.view.preview.x2,b.x+b.w-frame);assert.equal(a.p.rows.length,base.rows.length+1);}
  else{assert.equal(a.view.anchor.x,point.x);near(a.view.preview.y1,b.y+frame);near(a.view.preview.y2,b.y+b.h-frame);assert.equal(a.p.cols.length,base.cols.length+1);}
  assert(scopedCells(base).some(r=>a.view.anchor.x>r.x&&a.view.anchor.x<r.x+r.w&&a.view.anchor.y>r.y&&a.view.anchor.y<r.y+r.h));
  assert.deepEqual(reject(base,axis==='row'?'col':'row',point,'wrong-frame-side').target,cab);
}
for(const [x,y] of [[b.x+.5,b.y+.5],[b.x+b.w-.5,b.y+.5],[b.x+.5,b.y+b.h-.5],[b.x+b.w-.5,b.y+b.h-.5]])for(const a of ['row','col'])reject(base,a,{x,y},'frame-corner');
// The side face itself has no horizontal shelf material; the tiny inward
// probe must detect the board adjoining that location instead of skipping it.
const head=scopedDividers(base).find(d=>d.id==='cabinet:row:0');reject(base,'row',{x:b.x+.4,y:head.cm},'on-divider');
reject(local.p,'row',{x:b.x+.4,y:pt.y},'on-divider'); // only first cell has this shelf
const tooClose=reject(base,'row',{x:b.x+.4,y:first.y+4},'requested-clearance');assert.deepEqual(tooClose.target,cab);near(tooClose.anchor.y,first.y+4);near(tooClose.preview.cm,first.y+4);
const tightCell=reject(base,'col',at(first,4,21),'requested-clearance');assert.deepEqual(tightCell.target,t);near(tightCell.preview.cm,first.x+4);
// A child can be too short to subdivide even though its parent could be.
const smallSub=c('0:0/0');const sm=targetInfo(local.p,smallSub);assert(sm.h<30);assert.deepEqual(reject(local.p,'row',at(sm),'band-too-small').target,smallSub);

// Exposed wall uses only wall planning geometry (no wood thickness). An
// existing planning layout is edited at its deepest visible zone.
const globalWall=place(base,'col',{x:180,y:24},wall,'wall',{target:cab});assert.equal(globalWall.view.preview.thickness,0);assert.deepEqual(scopedCells(globalWall.p),scopedCells(base));
const zone=place(globalWall.p,'row',{x:32,y:88.625},z('wall/0'),'zone',{target:wall});near(zone.view.preview.x2-zone.view.preview.x1,180);assert.equal(wallZones(zone.p).length,3);
place(zone.p,'col',{x:49.375,y:38},z('wall/0/0'),'zone',{target:wall});
const wd=scopedDividers(globalWall.p).find(d=>d.kind==='wall');assert(wd);
reject(globalWall.p,'row',{x:wd.cm,y:24},'on-divider');
const front=inspectPlacement(globalWall.p,'row',{x:wd.cm,y:130},{target:wall});assert(front.ok);assert.equal(front.source,'cell');assert.deepEqual(front.target,c('1:1')); // hidden line must not capture click
const hiddenGrip=reject(globalWall.p,'row',{x:wd.cm,y:130},'on-divider',{target:wall,dividerId:wd.id});assert.notEqual(hiddenGrip.target.kind,'wall');
reject(base,'col',pt,'on-divider',{target:cab,dividerId:head.id});reject(base,'col',pt,'stale-divider',{dividerId:'removed-id'});
reject(base,'row',{x:pt.x,y:head.cm},'on-divider');reject(base,'row',{x:-20,y:12},'outside-wall');reject(base,'row',{x:0,y:12},'wall-edge');
reject(base,'unknown',pt,'invalid-axis');reject(base,'row',{x:NaN,y:Infinity},'invalid-point');
assert.equal(JSON.stringify(base),saved);assert.deepEqual(validatePlan(JSON.parse(saved)),base);assert.deepEqual(selectedTarget(base),c('1:1'));
console.log('PASS: geometric one-click placement for full cabinet, all four frame faces, deepest cell, exposed wall/zone; no insert on a board, corner, wrong edge or tight cell, no routing to the hidden wall; exact preview/commit and immutable undo snapshots.');
