import assert from 'node:assert/strict';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {planSheet,sheetTables,elevationSheet} from '../public/kitchen-sheet.js';
import {sheetTarget,workshopPartTarget} from '../public/kitchen-sheet-target.js';

const design=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});
assert.ok(design.ok);
const doc=design.candidates[0].doc;
const snapshot=JSON.stringify(doc);
const unit=doc.kitchen.units.find(u=>u.kind==='drawers');
const candidates=doc.kitchen.units.filter(u=>u.kind==='storage');
assert.ok(candidates.length>=2);
function pick(dataset){return sheetTarget({closest(){return {dataset};}},doc,'back');}
for(const storage of candidates.slice(0,2)){
 const handle=pick({sheetUnit:storage.id,sheetPart:'handle',sheetIndex:'1'});
 assert.equal(handle.focus.unitId,storage.id);
 assert.equal(workshopPartTarget(doc,handle.route,handle.focus).focus.unitId,storage.id);
}
const drawer=pick({sheetUnit:unit.id,sheetPart:'drawer',sheetIndex:'2'});
assert.equal(workshopPartTarget(doc,drawer.route,drawer.focus).focus.drawerIndex,2);
const aperture=doc.kitchen.features.find(f=>f.kind==='door');
assert.deepEqual(pick({kDoorGuide:aperture.id}).focus,{wall:aperture.wall,featureId:aperture.id,edit:true});
assert.equal(pick({kWallHit:'back'}).focus.wall,'back');
assert.deepEqual(pick({sheetWall:'back',sheetPair:'upper'}).focus,{wall:'back',tier:'upper',pair:true});
assert.equal(pick({sheetUnit:'missing'}),null);
const plan=planSheet(doc,true,{interactive:true});
const sink=doc.kitchen.units.find(u=>u.kind==='sink');
const match=plan.match(/data-sheet-hole="([^"]+)" data-sheet-top-id="([^"]+)"/);
assert.equal(match[1],sink.id);
assert.deepEqual(pick({sheetUnit:sink.id,sheetHole:sink.id,sheetTopId:match[2]}).focus,{unitId:sink.id,runId:sink.runId,topId:match[2],holeId:sink.id});
const art=elevationSheet(doc,'back',true);
assert.match(art,/data-sheet-top-id="[^"]+"/);
const live=sheetTables(doc,null,true,true);
assert.ok(live.includes('<tr data-sheet-unit="'+unit.id+'">'));
assert.ok(live.includes('<tr data-sheet-feature="'+aperture.id+'">'));
assert.ok(live.includes('class="pr-sheet-row-pick"'));
assert.doesNotMatch(sheetTables(doc,null,true),/<button|<tr data-/);
assert.equal(JSON.stringify(doc),snapshot);
console.log('Interactive table and drawing refer to the same objects, stable unit and indexed drawer, outer door guide, masonry and paired measurements. Printed schedules are static; selection is read-only.');
