import assert from 'node:assert/strict';
import {parseMeasuredOutline} from '../public/kitchen-measured-outline.js';
import {roomArchitecture,architectureContainsPolygon,architectureWallPoint,architectureWallLocal,validateKitchenRoomArchitecture} from '../public/kitchen-architecture.js';
import {createKitchen,addFreeRun,addUnit,validateKitchen,kitchenGeometry} from '../public/kitchen-model.js';
import {applyChain,newChainRow,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {scenePlan} from '../public/kitchen-project.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {buildKitchenBuilding,triangulateKitchenOutline} from '../public/kitchen-building-render.js';
import {polygonArea} from '../public/kitchen-oriented.js';
const raw={unit:'mm',reference:'رفع مضلع تجريبي',heightMm:2800,vertices:[[0,0],[5000,0],[5000,4000],[3200,4000],[3200,3000],[2100,3000],[2100,4200],[0,4200]]};
const v=parseMeasuredOutline(raw);assert.ok(v.ok,v.reason);
const {room}=v,arch=roomArchitecture(room);
assert.equal(arch.walls.length,8);assert.equal(arch.area,420*500-180*20-110*120);
assert.equal(arch.excluded.reduce((s,p)=>s+Math.abs(polygonArea(p)),0)+arch.area,420*500);
assert.equal(triangulateKitchenOutline(arch.polygon).reduce((s,p)=>s+Math.abs(polygonArea(p)),0),arch.area);
const bridge=[[190,320],[350,320],[350,340],[190,340]].map(([x,z])=>({x,z}));
assert.equal(architectureContainsPolygon(room,bridge),false,'object bridges concavity even with all corners inside');
assert.equal(architectureContainsPolygon(room,[{x:10,z:10},{x:40,z:10},{x:40,z:30},{x:10,z:30}]),true);
const shape=createKitchen(room,'empty'),illegal=addFreeRun(shape,room,{id:'bridge',x:190,z:320,length:160,angle:0,depth:20});
assert.equal(illegal.ok,false,'island crosses cut-away');
let doc={room,kitchen:shape};
const chain={source:'field',rows:[{...newChainRow('start','start'),gapMm:0},{...newChainRow('stop','end'),gapMm:3000}]};
const out=applyChain(doc,'poly-01',chain);assert.ok(out.ok,out.reason);doc=out.doc;assert.deepEqual(readChainRange(doc,'poly-01').baseSpans,[{startMm:0,endMm:3000}]);
const planned=planWorkshopRow(doc,{wall:'poly-01',startMm:0,endMm:3000,tier:'base',wants:{rice:false,sink:false,dishwasher:false}});assert.ok(planned.ok,planned.reason);
assert.deepEqual(cleanIdea(JSON.parse(JSON.stringify(planned.doc))).room.architecture.outline.vertices,room.architecture.outline.vertices);
const building=buildKitchenBuilding(scenePlan(room),kitchenGeometry(planned.doc.kitchen,room));assert.equal(building.segments.length,8);assert.equal(building.outline.length,8);
for(const bad of [
 {...raw,vertices:[[0,0],[5000,4000],[5000,0],[0,4000]]},{...raw,unit:'cm'},{...raw,heightMm:null},
 {...raw,vertices:[[0,0],[5000,0],[null,4000]]},{...raw,vertices:[[0,0],[200,0],[300,0],[5000,4000],[0,4000]]},
 {...raw,vertices:[[0,0],[5000,0],[5000,4000],[-10,4000]]},{...raw,holes:[]}
])assert.equal(parseMeasuredOutline(bad).ok,false);
const slope=parseMeasuredOutline({...raw,vertices:[[0,0],[4800,0],[5000,3700],[0,4200]]}).room;
const p=architectureWallPoint(slope,'poly-02',145,30),b=architectureWallLocal(slope,'poly-02',p);
assert(Math.abs(b.u-145)<1e-6&&Math.abs(b.d-30)<1e-6);
const rect={width:500,length:420,height:280};assert.equal(validateKitchen(planned.doc.kitchen,rect),null,'a change of wall identities is not a valid migration');
assert.equal(validateKitchenRoomArchitecture({...room,width:490}).ok,false);
console.log('Measured polygon import (mm): 8-sided concave CAD, wall IDs and oblique transforms, no island bridge, real wall chain/row, render triangulation, room+project portability, rejects malformed/ambiguous input.');
