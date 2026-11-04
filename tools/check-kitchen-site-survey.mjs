import assert from 'node:assert/strict';
import {applyChain,chainFromDrawing} from '../public/kitchen-chain-model.js';
import {localRoomPresets,makeSaudiRoom} from '../public/kitchen-room-presets.js';
import {roomArchitecture,architectureWall} from '../public/kitchen-architecture.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {buildStudioLayout} from '../public/kitchen-layouts.js';
import {hardKitchenConflicts} from '../public/kitchen-model.js';
import {restoreProject,commitProject,undoProject,redoProject,saveProject,kitchenHistory,scenePlan} from '../public/kitchen-project.js';
import {sheetFaces,planSheet,elevationSheet} from '../public/kitchen-sheet.js';
import {surveySketch} from '../public/kitchen-room-survey.js';
class Store{map=new Map;setItem(k,v){this.map.set(k,String(v));}getItem(k){return this.map.get(k)??null;}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const initial=restoreProject();assert.equal(initial.kitchen.units.length,0);assert.equal(initial.kitchen.features.length,0);
for(const [i,p] of localRoomPresets.entries()){
 const d=makeSaudiRoom(p.id),{room,kitchen}=d,a=roomArchitecture(room),restored=cleanIdea(JSON.parse(JSON.stringify(d)));
 assert.deepEqual(kitchen.runs,[]);assert.deepEqual(kitchen.units,[]);
 assert(kitchen.features.some(f=>f.kind==='door'));assert(kitchen.features.some(f=>f.kind==='water'));assert(kitchen.features.some(f=>f.kind==='vent'));
 assert(restored);assert.deepEqual(restored.room,room);assert.deepEqual(restored.kitchen.features,kitchen.features);
 assert.equal(a.area,[167200,162500,156400][i]);assert.equal(scenePlan(room).room.sitePoints[0].size,15);assert.deepEqual(hardKitchenConflicts(kitchen,room),[]);
 const blank=buildStudioLayout(room,'blank','back','linen',{features:kitchen.features});assert.deepEqual(blank.kitchen.features,kitchen.features);assert.equal(blank.kitchen.units.length,0);
 const alt=buildStudioLayout(room,'line',i===1?'left':'back','ink',{features:kitchen.features});assert(alt.ok,alt.reason);assert.deepEqual(alt.kitchen.features,kitchen.features);
 assert(sheetFaces(d).length>=5);assert(planSheet(d,true).includes('<svg'));assert(surveySketch(room,d).includes('مم'));
}
// The villa window can be measured before any design. A hood may only be
// present later if the rep deliberately places one.
const villa=makeSaudiRoom('villa'),visitChain=chainFromDrawing(villa,'back');
visitChain.rows.find(r=>r.kind==='window').gapMm=2740;
const raised=applyChain(villa,'back',visitChain);
assert(raised.ok,raised.reason);assert.deepEqual(raised.designConflicts,[]);
assert.equal(raised.doc.kitchen.features.find(f=>f.kind==='window').u,274);
assert.equal(raised.doc.kitchen.units.length,0);
const apt=makeSaudiRoom('apartment'),glass=apt.kitchen.features.find(f=>f.kind==='window'),side=architectureWall(apt.room,glass.wall);assert.equal(side.length,95);assert.equal(glass.adjacent,'lightwell');assert.equal(glass.glazing,'frosted');
assert(sheetFaces(apt).some(([id])=>id===glass.wall));assert(elevationSheet(apt,glass.wall,true).includes('<svg'));
assert(commitProject(initial,apt).saved);const appliedApt={...apt,room:{...apt.room,projectId:initial.room.projectId}};assert.deepEqual(restoreProject().room,appliedApt.room);const h=kitchenHistory().length;
const cutLost={...apt.room,architecture:{wallThickness:20}};assert.equal(commitProject(apt,{...apt,room:cutLost}).ok,false);assert.equal(kitchenHistory().length,h);
const badPoint={...apt.room,sitePoints:[{...apt.room.sitePoints[0],x:400,z:50}]};assert.equal(commitProject(apt,{...apt,room:badPoint}).ok,false);assert.equal(kitchenHistory().length,h);
assert.deepEqual(undoProject(appliedApt).next,initial);assert.deepEqual(redoProject(initial).next,appliedApt);
const legacy={room:{width:333,length:255,height:270,colors:{},name:'مشروع قائم'},kitchen:buildStudioLayout({width:333,length:255,height:270},'line').kitchen};saveProject(legacy);assert.equal(restoreProject().room.name,'مشروع قائم');assert.equal(roomArchitecture(restoreProject().room).walls.length,4);
console.log('Saudi room workflow: 3 source-attributed samples, retained local plans, fixed fixtures across relayout, exact areas and return elevation, portable survey, atomic rejection, undo and redo.');

// Only live plans expose object targets. Thumbnails must not open another object's form.
const sketch=surveySketch(villa.room,villa,'back',true,{kind:'point',id:'floor-gully'});
for(const f of villa.kitchen.features)assert(sketch.includes('data-plan-kind="feature" data-plan-id="'+f.id+'"'));
for(const p of villa.room.sitePoints)assert(sketch.includes('data-plan-kind="point" data-plan-id="'+p.id+'"'));
assert(sketch.includes('data-plan-kind="wall" data-plan-id="left"'));
assert(!surveySketch(villa.room,villa).includes('data-plan-kind='));
console.log('Live plan exposes every represented wall, opening, service and floor item with its stable ID; room template previews remain static.');
