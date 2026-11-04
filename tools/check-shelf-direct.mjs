import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan,SHELF_LIMITS as L} from '../public/shelf-model.js';
import {targetInfo,selectedTarget,scopedCells,scopedDividers,wallZones,contentFor,splitTargetCheck,
  planDividerDrop,commitDividerDrop,planContentDrop,commitContentDrop} from '../public/shelf-selection-model.js';

const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const base=freeze(createShelfPlan()),saved=JSON.stringify(base),cab={kind:'cabinet'},wall={kind:'wall'},cell=key=>({kind:'cell',key}),zone=key=>({kind:'zone',key});
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`Expected ${b}, got ${a}`);
const eqT=(a,b)=>a.kind===b.kind&&a.key===b.key;
const at=(r,dx=r.w/2,dy=r.h/2)=>({x:r.x+dx,y:r.y+dy});
const info=(p,key)=>targetInfo(p,cell(key));
const before=(p)=>JSON.stringify(p);
const inventory=p=>scopedCells(p).map(x=>x.content).filter(x=>x!=='empty').sort();
function insert(p,t,axis,point){
  const snapshot=before(p),request=planDividerDrop(p,t,axis,point);assert(request.ok,request.reason);assert(!Object.hasOwn(request,'plan'),'Hover must not construct a candidate plan.');
  assert.equal(before(p),snapshot);near(request.preview.cm,axis==='col'?point.x:point.y);
  const old=scopedDividers(p).filter(d=>eqT(d.owner,t)&&d.axis===axis),res=commitDividerDrop(p,t,axis,point);assert(res.ok&&res.changed,res.reason);
  assert.equal(before(p),snapshot);assert.deepEqual(res.preview,request.preview);assert.deepEqual(selectedTarget(res.plan),t);
  const all=scopedDividers(res.plan).filter(d=>eqT(d.owner,t)&&d.axis===axis);assert.equal(all.length,old.length+1);
  const d=all[request.index];near(d.cm,request.cm);near(d.cm,axis==='col'?point.x:point.y);
  if(axis==='col'){near(d.y,request.preview.y1);near(d.y+d.h,request.preview.y2);near(request.preview.x1,point.x);near(request.preview.x2,point.x);}
  else{near(d.x,request.preview.x1);near(d.x+d.w,request.preview.x2);near(request.preview.y1,point.y);near(request.preview.y2,point.y);}
  near(axis==='col'?d.w:d.h,request.preview.thickness);assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(res.plan))),res.plan);
  return freeze(res.plan);
}
function reject(p,t,axis,point,code){const r=planDividerDrop(p,t,axis,point),committed=commitDividerDrop(p,t,axis,point);assert.equal(r.ok,false);if(code)assert.equal(r.code,code);assert(r.reason);assert.equal(committed.plan,p);assert.equal(committed.changed,false);return r;}

// The original button chooses the widest band, but a direct placement in the
// first (narrower) band must stay there AT the chosen, non-central coordinate.
const first=info(base,'0:0'),p0=at(first,19.125,21.25);
assert.notEqual(splitTargetCheck(base,cab,'col').index,0);
const firstCheck=planDividerDrop(base,cab,'col',p0);assert.equal(firstCheck.index,0);
const withCol=insert(base,cab,'col',p0);
assert.equal(contentFor(withCol,'0:0'),'books');assert.equal(contentFor(withCol,'1:0'),'empty');assert.equal(contentFor(withCol,'3:0'),'vase');
assert.deepEqual(info(withCol,'3:0').rect,info(base,'2:0').rect,'Existing unaffected band must not move.');assert.deepEqual(inventory(withCol),inventory(base));
assert.deepEqual(Object.keys(base).sort(),Object.keys(createShelfPlan()).sort());
const lastRow=info(base,'0:2');const withRow=insert(base,cab,'row',at(lastRow,19,18.375));assert.equal(withRow.rows.length,base.rows.length+1);

// Close to a permitted target edge or on an existing board: show a refusal,
// do not move the cut, and do not choose a different feasible band.
const nearEdge=reject(base,cab,'col',at(first,3,20),'requested-clearance');assert.equal(nearEdge.index,0);near(nearEdge.preview.cm,first.x+3);assert(nearEdge.minCm>nearEdge.cm);
const boundary=planDividerDrop(base,cab,'col',{x:firstCheck.minCm,y:p0.y});assert(boundary.ok);near(boundary.cm,firstCheck.minCm);
reject(base,cab,'col',{x:firstCheck.minCm-.002,y:p0.y},'requested-clearance');
reject(base,cab,'col',{x:p0.x,y:base.cab.y+base.cab.h+1},'outside-target');
reject(base,cab,'row',{x:base.cab.x+.5,y:p0.y},'on-divider');
const shelf=scopedDividers(base).find(d=>d.axis==='row');reject(base,cab,'col',{x:p0.x,y:shelf.cm},'on-divider');
reject(base,cell('unknown'),'col',p0,'invalid-target');reject(base,cab,'bad',p0,'invalid-axis');reject(base,cab,'col',{x:NaN,y:88},'invalid-point');

// A split inside one cell has endpoints restricted to its CLEAR rectangle.
// Children can be edited again, and reselecting an already divided parent
// chooses the child band under the pointer, not the widest band.
const t=cell('1:1'),b=targetInfo(base,t),outside=scopedCells(base).filter(r=>r.key!==t.key);
const local=insert(base,t,'col',at(b,34,25));assert.deepEqual(outside,scopedCells(local).filter(r=>!r.key.startsWith('1:1/')));
const child0=info(local,'1:1/0'),child1=info(local,'1:1/1');assert.equal(contentFor(local,'1:1/0'),'plant');
const chosen=planDividerDrop(local,t,'col',at(child1,18,21));assert(chosen.ok);assert.equal(chosen.index,1);
const localAgain=insert(local,t,'col',at(child1,18,21));assert.equal(scopedCells(localAgain).length,11);assert.deepEqual(info(localAgain,'1:1/0').rect,child0.rect);
const nested=insert(local,cell('1:1/0'),'row',at(child0,12,20.125));assert.equal(contentFor(nested,'1:1/0/0'),'plant');
assert.deepEqual(info(nested,'1:1/1').rect,child1.rect);
reject(nested,cell('1:1/0'),'row',at(child1,12,20),'outside-target');
const localCross=scopedDividers(nested).find(d=>d.owner.key==='1:1/0'&&d.axis==='row');reject(nested,cab,'col',{x:child0.x+16,y:localCross.cm},'on-divider');
const treeInNarrowBand=insert(local,cell('1:1/0'),'col',at(child0,16,20));
reject(treeInNarrowBand,t,'col',at(child0,8,20),'band-too-small');

// A wall/zone split is a planning line with zero material thickness. Its
// length and placement respect that zone only and never alter cabinet data.
const w=insert(nested,wall,'col',{x:67.25,y:16});assert.deepEqual(scopedCells(w),scopedCells(nested));
const left=zone('wall/0'),right=targetInfo(w,zone('wall/1')).rect,wz=insert(w,left,'row',{x:24,y:79.75});
assert.deepEqual(targetInfo(wz,zone('wall/1')).rect,right);assert.equal(wallZones(wz).length,3);
assert.equal(planDividerDrop(w,left,'row',{x:24,y:79.75}).preview.thickness,0);
reject(wz,left,'row',{x:90,y:90},'outside-target');reject(wz,wall,'row',{x:67.25,y:90},'on-divider');

function drop(p,src,pt,op,effect){
  const snapshot=before(p),request=planContentDrop(p,src,pt);assert(request.ok,request.reason);assert.equal(request.operation,op);assert.equal(request.effect,effect);assert(!Object.hasOwn(request,'plan'));
  assert.equal(before(p),snapshot);const r=commitContentDrop(p,src,pt);assert(r.ok,r.reason);assert.equal(r.toKey,request.toKey);assert.equal(r.operation,op);assert.equal(before(p),snapshot);
  if(op==='noop'){assert.equal(r.plan,p);assert.equal(r.changed,false);assert.deepEqual(selectedTarget(p),r.target);}
  else{assert(r.changed);assert.deepEqual(selectedTarget(r.plan),cell(request.toKey));assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(r.plan))),r.plan);}
  return {plan:freeze(r.plan),request};
}
// Deep leaf hit, explicit palette replacement, moving and swapping with no
// item loss, no accidental assignment to an internal group or nearest cell.
const occupied=at(info(wz,'1:1/0/0')),blank=at(info(wz,'1:1/0/1'));
const assigned=drop(wz,{content:'boxes'},blank,'set','assign');assert.equal(assigned.request.toKey,'1:1/0/1');assert.equal(contentFor(assigned.plan,'1:1/0/1'),'boxes');
const replaced=drop(wz,{content:'books'},occupied,'set','replace');assert(replaced.request.replaces);assert.equal(replaced.request.previousContent,'plant');assert.equal(contentFor(replaced.plan,'1:1/0/0'),'books');
assert.deepEqual(wallZones(replaced.plan),wallZones(wz));assert.deepEqual(scopedDividers(replaced.plan),scopedDividers(wz));
drop(replaced.plan,{content:'books'},occupied,'noop','noop');drop(replaced.plan,{content:'empty'},blank,'noop','noop');
const erased=drop(wz,{content:'empty'},occupied,'set','clear');assert.equal(contentFor(erased.plan,'1:1/0/0'),'empty');
const moved=drop(wz,{fromKey:'1:1/0/0'},blank,'move','move');assert.equal(contentFor(moved.plan,'1:1/0/0'),'empty');assert.equal(contentFor(moved.plan,'1:1/0/1'),'plant');assert.deepEqual(inventory(moved.plan),inventory(wz));
const swapped=drop(wz,{fromKey:'2:0'},occupied,'swap','swap');assert.equal(contentFor(swapped.plan,'2:0'),'plant');assert.equal(contentFor(swapped.plan,'1:1/0/0'),'vase');assert.deepEqual(inventory(swapped.plan),inventory(wz));
drop(wz,{fromKey:'2:0'},at(info(wz,'2:0')),'noop','noop');drop(base,{fromKey:'0:0'},at(info(base,'2:2')),'noop','noop');
for(const [src,pt,code] of [[{fromKey:'1:1'},blank,'invalid-source-cell'],[{fromKey:'1:0'},blank,'empty-source'],[{fromKey:'bogus'},blank,'invalid-source-cell'],[{content:'bad'},blank,'invalid-content'],[{content:'books',fromKey:'0:0'},blank,'invalid-source'],[{content:'books'},{x:0,y:0},'outside-cabinet'],[{content:'books'},{x:base.cab.x+1,y:p0.y},'on-board'],[{fromKey:'0:0'},{x:child0.x+3,y:localCross.cm},'on-board'],[{content:'books'},{x:Infinity,y:p0.y},'invalid-point']]){
  const r=planContentDrop(wz,src,pt);assert(!r.ok&&r.reason);assert.equal(r.code,code);assert.equal(commitContentDrop(wz,src,pt).plan,wz);
}
// Loading an old v1 design or hovering a drop does not upgrade its schema,
// mutate selection, or reconstruct tree state. Only a successful edit can.
assert.equal(JSON.stringify(base),saved);assert.deepEqual(validatePlan(JSON.parse(saved)),base);
console.log('PASS: exact shelf/partition drops in chosen band; matching preview/commit; no edge snapping or out-of-scope hits; deep leaf assign/replace/move/swap; immutable legacy and scoped plans.');
