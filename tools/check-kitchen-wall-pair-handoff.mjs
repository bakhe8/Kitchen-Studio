import assert from 'node:assert/strict';
import {createKitchen} from '../public/kitchen-model.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {approvalState,cleanWorkshop} from '../public/kitchen-workshop-state.js';
import {sheetTables} from '../public/kitchen-sheet.js';
import {wallPairDatum} from '../public/kitchen-wall-pair.js';
import {commitProject,restoreProject,undoProject,redoProject} from '../public/kitchen-project.js';

function store(){
 const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
}
globalThis.localStorage=store();globalThis.sessionStorage=store();
const room={width:300,length:400,height:280,colors:{},name:'اختبار الظهر والوجه'};
const legacy={room,kitchen:createKitchen(room,'empty')};
const record={datum:wallPairDatum(legacy,'back'),backMm:3000,frontMm:2980,depthMm:600,heightMm:430};
const measured={room:{...room,workshop:{wallPairs:{back:{base:record}}}},kitchen:legacy.kitchen};
assert.deepEqual(cleanIdea(structuredClone(measured)).room.workshop.wallPairs.back.base,record);
assert.equal(cleanWorkshop({wallPairs:{back:{base:{...record,frontMm:-1}}}}),null);
const prior=await approvalState(legacy),unknown=await approvalState(measured);
assert.equal(prior.keys.structure,unknown.keys.structure);
assert.equal(prior.keys.customer,unknown.keys.customer);
assert.notEqual(prior.keys.release,unknown.keys.release);
assert(commitProject(legacy,measured).saved);
let restored=restoreProject();assert.equal(restored.room.workshop.wallPairs.back.base.frontMm,2980);
assert(sheetTables(restored,'back',true).includes('قياس الظهر والوجه'));
assert(!sheetTables(restored,'left',true).includes('قياس الظهر والوجه'));
assert(sheetTables(restored,'back',true).includes('إزاحة طرف واحد'));
const confirmed=structuredClone(restored);confirmed.room.workshop.wallPairs.back.base.anchor={side:'start',offsetMm:0};
assert(commitProject(restored,confirmed).saved);
assert.equal(undoProject().next.room.workshop.wallPairs.back.base.anchor,undefined);
assert.deepEqual(redoProject().next.room.workshop.wallPairs.back.base.anchor,{side:'start',offsetMm:0});
const confirmedKeys=await approvalState(confirmed);
assert.notEqual(confirmedKeys.keys.release,unknown.keys.release);
assert(sheetTables(confirmed,'plan',false).includes('تضييق'));
assert(!sheetTables(legacy,'plan',true).includes('قياس الظهر والوجه'));
console.log('Wall pair survey round-trip, undo/redo, scoped workshop sheets and production revision invalidation verified.');
