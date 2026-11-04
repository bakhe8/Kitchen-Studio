import {updateRoom} from '../public/shelf-room-model.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {cadAdditionIssue,designSpanIssue} from '../public/kitchen-design-site.js';
import {applyChain,chainFromDrawing} from '../public/kitchen-chain-model.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import assert from 'node:assert/strict';
import {createKitchen,kitchenGeometry,validateKitchen,updateUnit,addFeature,addRun,addUnit,hardKitchenConflicts} from '../public/kitchen-model.js';
import {scenePlan,shapeForUnit,restoreProject,saveProject,commitProject,undoProject,redoProject,kitchenProjectURL,kitchenHistory} from '../public/kitchen-project.js';
import {readKitchenViewport,rememberKitchenViewport} from '../public/kitchen-viewport.js';
import {splitTarget} from '../public/shelf-selection-model.js';
class Store{d=new Map();getItem(k){return this.d.get(k)??null}setItem(k,v){this.d.set(k,String(v))}removeItem(k){this.d.delete(k)}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const room={width:360,length:300,height:260,colors:{}},p=scenePlan(room),k=createKitchen(p,'demo'),u=k.units.find(v=>v.kind==='storage'),g=kitchenGeometry(k,p).units.find(v=>v.id===u.id);
const asShelf=shapeForUnit(u,g);assert.equal(asShelf.cab.w,u.width);assert.equal(asShelf.cab.h,g.height);assert.equal(asShelf.depth,g.depth);
const res=splitTarget(asShelf,{kind:'cabinet'},'col');assert.ok(res.ok);const info=updateUnit(k,p,u.id,{detail:res.plan});assert.ok(info.ok);
saveProject({room,kitchen:k});commitProject({room,kitchen:k},{room,kitchen:info.kitchen});
const saved=restoreProject(),again=saved.kitchen.units.find(v=>v.id===u.id);assert.deepEqual(again.detail.cols,res.plan.cols);
assert(saved.kitchen.units.filter(v=>v.detail).length===1);assert(!localStorage.getItem('atlas-shelves:plan:v1'));
assert(!undoProject().next.kitchen.units.find(v=>v.id===u.id).detail);
// Both saving and leaving the interior call the same return address helper.
globalThis.location={href:'https://example.test/shelf-planner?view=kitchen'};
assert.deepEqual(readKitchenViewport(new URLSearchParams()),{view:'volume',yaw:32,pitch:25});
for(const view of ['volume','top']){
 const pose={view,yaw:247.5,pitch:13.25};rememberKitchenViewport(pose);
 const opened=new URL(kitchenProjectURL('kitchen-unit',u.id,pose));assert.equal(opened.searchParams.get('view'),'kitchen-unit');assert.deepEqual(readKitchenViewport(opened.searchParams),pose);
 location.href=opened.href;const back=new URL(kitchenProjectURL('kitchen',u.id));assert.equal(back.searchParams.get('unit'),u.id);assert.deepEqual(readKitchenViewport(back.searchParams),pose);
 assert.deepEqual(readKitchenViewport(new URLSearchParams()),pose);
}
console.log('Kitchen project: one unit round-trips its authored partitions at real dimensions; other units and the original room stay independent and undo works.');

// Whole-project changes (room sizing, named alternatives) cannot bypass the
// guard. Both features individually fit, but the nearer front wall would
// push its window into a cabinet that still fits inside the room.
const ok=r=>{assert.equal(r.ok,true,r.reason);return r.kitchen;};
let fixed=ok(addRun(createKitchen(room,'empty'),room,{id:'island',placement:'free',tier:'base',x:115,z:202,angle:0,length:100,depth:44}));
fixed=ok(addUnit(fixed,room,{id:'cab',runId:'island',kind:'storage',u:0,width:100}));
fixed=ok(addFeature(fixed,room,{id:'w',kind:'window',wall:'front',u:130,width:120,bottom:40,height:25}));
const before={room,kitchen:fixed};saveProject(before);const stored=JSON.stringify(restoreProject()),undoCount=kitchenHistory().length;
const resize=commitProject(before,{room:{...room,length:247},kitchen:fixed});
assert(!resize.ok&&!resize.changed&&resize.reason);assert.equal(JSON.stringify(restoreProject()),stored);assert.equal(kitchenHistory().length,undoCount);
const dup={...fixed,features:[...fixed.features,{...fixed.features[0],id:'w2'}]},dirty={room,kitchen:dup};
assert(!commitProject(before,dirty).ok);assert.equal(kitchenHistory().length,undoCount);
// A previously saved collision survives reload with both independent ids.
saveProject(dirty);const repairedFrom=restoreProject();assert.deepEqual(repairedFrom.kitchen.features.map(v=>v.id),['w','w2']);
assert(hardKitchenConflicts(repairedFrom.kitchen,room).length);const repaired=commitProject(repairedFrom,before);
assert(repaired.ok&&repaired.saved);assert.deepEqual(restoreProject().kitchen.features.map(v=>v.id),['w']);
assert.equal(hardKitchenConflicts(restoreProject().kitchen,room).length,0);
console.log('Placement guard: room resize/invalid alternative never enter storage or undo, and a legacy duplicate can be loaded and repaired.');

const villa=makeFurnishedSaudiRoom('villa'), wall='back';
const adopted=applyChain(villa,wall,chainFromDrawing(villa,wall)).doc;
const corrected=structuredClone(adopted.room.workshop.chains[wall]);
const reading=corrected.rows.find(row=>row.kind==='window');
reading.gapMm=2740;
const measured=applyChain(adopted,wall,corrected);
assert(measured.ok&&measured.designConflicts.length);
assert(!commitProject(adopted,{...adopted,kitchen:measured.doc.kitchen}).ok,'direct CAD geometry cannot borrow the survey exception');
const stale=structuredClone(measured.doc);
stale.kitchen.features.find(f=>f.id===reading.featureId).u+=1;
assert(!commitProject(adopted,stale).ok,'a mismatched survey and CAD record cannot authorize the change');
assert(commitProject(adopted,measured.doc).saved);
const reopened=restoreProject(),station=d=>d.kitchen.features.find(f=>f.id===reading.featureId).u;
assert.equal(station(reopened),274);assert.deepEqual(reopened.kitchen.units,validateKitchen(adopted.kitchen,adopted.room).units);
assert.equal(station(undoProject(reopened).next),165);assert.equal(station(redoProject().next),274);
assert(commitProject(before,reopened,{restoreArchive:true}).saved,'a saved survey can be reopened from a portable project');
assert(!commitProject(before,stale,{restoreArchive:true}).ok);
console.log('Villa wall: exact 2740mm reading survives save, reload, undo, redo and archive restore. Cabinet geometry is retained; CAD-only or mismatched measurements remain guarded.');

const shelfOnly=new Store(),priorRoom=updateRoom(createShelfPlan(),{width:475,length:405,height:296});
assert(priorRoom.ok,priorRoom.reason);const shelf=priorRoom.plan;
shelfOnly.setItem('atlas-shelves:plan:v1',JSON.stringify(shelf));
const intake=restoreProject(shelfOnly);
assert.deepEqual([intake.room.width,intake.room.length,intake.room.height],[475,405,296]);
assert.deepEqual(intake.kitchen.units,[]);assert.deepEqual(intake.kitchen.runs,[]);
const pendingSpan={wall:'back',start:10,end:70};
assert(designSpanIssue(intake,[pendingSpan]));
const earlyRow=addRun(intake.kitchen,intake.room,{...pendingSpan,id:'next-base',tier:'base',depth:55});
assert(earlyRow.ok);assert(cadAdditionIssue(intake,earlyRow.kitchen));
const savedWall=applyChain(intake,'back',{rows:[{id:'stop',kind:'stop',gapMm:3200}]}).doc;
assert.equal(cadAdditionIssue(savedWall,earlyRow.kitchen),'');
assert(designSpanIssue(savedWall,[{wall:'back',start:12,end:326}]));
assert(designSpanIssue(savedWall,[{wall:'left',start:10,end:70}]));
assert.equal(cadAdditionIssue(adopted,adopted.kitchen),'','unmodified older designs can be inspected');
console.log('Shelf-only intake keeps room geometry with no furnishings. CAD creation respects the actual measured target wall and endpoint.');
