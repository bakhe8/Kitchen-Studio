import assert from 'node:assert/strict';
import {createCreativeKitchen,copyDestinations,copyKitchenUnit} from '../public/kitchen-creative-model.js';
import {cleanIdea,ideaPreview} from '../public/kitchen-ideas.js';
import {kitchenGeometry,updateUnit,validateKitchen} from '../public/kitchen-model.js';
import {shapeForUnit} from '../public/kitchen-project.js';
import {splitTarget,setScopedContent} from '../public/shelf-selection-model.js';

const room=(width,length,height)=>({width,length,height});
const normal=room(360,300,260),sourceId='idea-island-drawers';
const find=(k,id)=>k.units.find(u=>u.id===id);
const ok=r=>{assert(r.ok,r.reason);return r.kitchen;};
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const serialized=v=>JSON.stringify(v);
for(const r of [room(220,206,168),normal,room(1200,1200,600)]){
  const k=createCreativeKitchen(r);assert(k,'Supported room must yield a complete starter.');
  assert.deepEqual(validateKitchen(JSON.parse(serialized(k)),r),k);
  const g=kitchenGeometry(k,r);
  assert.deepEqual(g.conflicts,[],'Starter must fit without collisions.');
  const island=g.runs.find(row=>row.placement==='free');
  assert(island?.angle%90 && g.units.some(u=>u.runId===island.id));
  assert(g.units.some(u=>u.kind==='sink'&&u.windowId&&u.nearestDrain));
  const copyTarget=copyDestinations(k,r,sourceId).find(t=>t.run.id!==island.id&&t.gaps.length);
  assert(copyTarget,'Each starter must leave at least one usable destination for its island drawers.');
  const g0=copyTarget.gaps[0],source=find(k,sourceId);
  assert(g0.end-g0.start>=source.width-1e-7);
  const after=ok(copyKitchenUnit(k,r,sourceId,copyTarget.run.id,g0.start));
  assert.equal(after.units.length,k.units.length+1);
  assert.deepEqual(kitchenGeometry(after,r).conflicts,[]);
}
for(const r of [room(219.99,300,260),room(360,205.99,260),room(360,300,167.99)])
  assert.equal(createCreativeKitchen(r),null);

// Author real nested geometry at this particular unit's physical dimensions.
let k=createCreativeKitchen(normal);
const original=find(k,sourceId),view=kitchenGeometry(k,normal).units.find(u=>u.id===sourceId);
const shape=shapeForUnit(original,view);
const division=splitTarget(shape,{kind:'cell',key:'0:0'},'col');assert(division.ok,division.reason);
const authored=setScopedContent(division.plan,'0:0/0','plant');
k=freeze(ok(updateUnit(k,normal,sourceId,{detail:authored,frontColor:'#273C57',open:true})));
const source=find(k,sourceId),unchanged=serialized(k),start=copyDestinations(k,normal,sourceId).find(t=>t.run.id==='idea-wall').gaps[0].start;
const copied=copyKitchenUnit(k,normal,sourceId,'idea-wall',start);
assert(copied.ok&&copied.changed,copied.reason);assert.notEqual(sourceId,copied.id);
const q=copied.kitchen,clone=find(q,copied.id);
assert.equal(clone.kind,source.kind);assert.equal(clone.width,source.width);assert.equal(clone.frontColor,source.frontColor);
assert(source.open&&!clone.open);assert.deepEqual(clone.detail,source.detail);assert.deepEqual(clone.interior,source.interior);
assert.notEqual(clone.detail.cellGrids['0:0'].children,source.detail.cellGrids['0:0'].children);
assert.notEqual(clone.detail.cellGrids['0:0'].children[0],source.detail.cellGrids['0:0'].children[0]);
const edit=setScopedContent(clone.detail,'0:0/0','vase');
const edited=ok(updateUnit(q,normal,clone.id,{detail:edit,frontColor:'#54ae73'}));
assert.equal(find(edited,clone.id).detail.cellGrids['0:0'].children[0].content,'vase');
assert.equal(find(edited,sourceId).detail.cellGrids['0:0'].children[0].content,'plant');
assert.equal(find(edited,sourceId).frontColor,'#273c57');assert.equal(serialized(k),unchanged);
for(const [id,target,x] of [[sourceId,'idea-wall',start],['missing','idea-wall',start],[sourceId,'absent',start],[sourceId,'idea-wall',NaN]]){
  const fail=copyKitchenUnit(q,normal,id,target,x);assert(!fail.ok&&!fail.changed);assert.equal(fail.kitchen,q);
}

// Snapshot ownership is checked both ways. Restoring a saved alternative
// must not receive the current live object graph or mutate future restores.
const live=structuredClone({room:{...normal,colors:{back:'sage',left:'stone',front:'invalid',ceiling:'sand'},camera:'not design data'},kitchen:edited});
const snap=cleanIdea({...live,ignored:true});
assert(snap);assert.deepEqual(snap.room,{...normal,colors:{back:'sage',left:'stone'}});
assert(!Object.hasOwn(snap,'ignored'));assert.notEqual(snap.room.colors,live.room.colors);
const snapNode=find(snap.kitchen,copied.id).detail.cellGrids['0:0'].children[0];
assert.notEqual(snapNode,find(live.kitchen,copied.id).detail.cellGrids['0:0'].children[0]);
const disk=serialized(snap),before=serialized(live);
const restored=cleanIdea(JSON.parse(disk));assert.deepEqual(restored,snap);
find(restored.kitchen,copied.id).detail.cellGrids['0:0'].children[0].content='empty';
restored.room.colors.left='sand';
assert.equal(serialized(live),before);assert.equal(serialized(snap),disk);
live.room.colors.back='stone';find(live.kitchen,copied.id).detail.cellGrids['0:0'].children[0].content='books';
assert.equal(serialized(snap),disk);assert.deepEqual(cleanIdea(JSON.parse(disk)),snap);
assert(ideaPreview(snap).includes('<polygon')&&ideaPreview(snap).includes('#54ae73'));
for(const bad of [null,{kitchen:k,room:room(59,300,260)},{kitchen:k,room:room(360,Infinity,260)},
  {room:normal,kitchen:{...k,version:99}},{room:normal,kitchen:{...edited,units:edited.units.map(u=>u.id===copied.id?{...u,frontColor:'url(bad)'}:u)}}])
  assert.equal(cleanIdea(bad),null);
console.log('Creative kitchen: starter limits/fits, usable copy destinations, independent authored interiors, sanitized detached idea snapshots and restoration passed.');
