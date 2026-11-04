import assert from 'node:assert/strict';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {approvalState} from '../public/kitchen-workshop-state.js';

const doc=makeChainExample(),before=await approvalState(doc);
const record={orderNo:'ARCH-17',toleranceMm:1,materialCost:890,lines:[
 {unitId:'unit-2',sku:'AL-20',label:'عارضة جسم',a:510,b:null,count:4,sourceUnitId:'D1',sourceLabel:'عارضة',sourceSku:'BAR20'}
],approval:{stamp:'a'.repeat(64),reviewer:'فني الورشة',date:'2026-11-01'}};
doc.room.workshop.referenceOrder=record;
const restored=cleanIdea(JSON.parse(JSON.stringify(doc)));
assert.deepEqual(restored.room.workshop.referenceOrder,record);
assert.deepEqual((await approvalState(restored)).keys,before.keys);
const invalid=structuredClone(doc);invalid.room.workshop.referenceOrder.lines[0].count=-1;
assert.equal(cleanIdea(invalid),null);
console.log('Legacy reference records round-trip unchanged, preserve the drawing approvals and still reject corrupt imports.');
