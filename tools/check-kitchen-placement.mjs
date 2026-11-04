import assert from 'node:assert/strict';
import {createKitchen,kitchenGeometry,addFeature,updateFeature,addRun,updateRun,addFreeRun,transformFreeRun,
  addUnit,updateUnit,removeKitchenItem,validateKitchen,hardKitchenConflicts,validateKitchenChange,availableKitchenSlots,kitchenRunPoint} from '../public/kitchen-model.js';
import {createCreativeKitchen,copyKitchenUnit} from '../public/kitchen-creative-model.js';
const room={width:360,length:300,height:260},blank=()=>createKitchen(room,'empty'),copy=x=>JSON.parse(JSON.stringify(x));
const pass=r=>{assert(r.ok,r.reason);return r.kitchen;};
const addF=(k,f)=>pass(addFeature(k,room,f)),addR=(k,r)=>pass(addRun(k,room,r)),addU=(k,u)=>pass(addUnit(k,room,u));
const hard=k=>hardKitchenConflicts(k,room),hasIds=(entry,ids)=>ids.every(id=>entry?.ids.includes(id));
function blocked(k,r,ids=[]){assert.equal(r.ok,false,'Physically incompatible edit unexpectedly succeeded: '+ids.join('/'));assert.equal(r.kitchen,k);assert(!r.changed);assert(r.reason);assert(r.candidate&&r.candidate!==k,'keep the actual denied preview for feedback, not an unreviewable mutation');assert(r.conflict&&hasIds(r.conflict,ids),JSON.stringify(r.conflict));return r;}
const A={id:'arch-a',kind:'window',wall:'back',u:70,width:90,bottom:100,height:80,depth:3};
const B={id:'arch-b',kind:'window',wall:'back',u:145,width:70,bottom:165,height:45,depth:4};
const one=addF(blank(),A),oldOne=JSON.stringify(one);
let error=blocked(one,addFeature(one,room,B),[A.id,B.id]);assert.equal(JSON.stringify(one),oldOne);
const reversed=addF(blank(),B);blocked(reversed,addFeature(reversed,room,A),[A.id,B.id]);
for(const spec of [{...B,u:160},{...B,bottom:180},{...B,wall:'front'}])assert.equal(hard(addF(one,spec)).length,0,'touching a frame edge/floor band or using another wall is legal');
blocked(one,addFeature(one,room,{...B,kind:'door',u:150,width:40,bottom:0,height:102}),[A.id,B.id]);
blocked(one,addFeature(one,room,{...A,id:'exact-duplicate'}),[A.id,'exact-duplicate']);
const near=addF(one,{...B,u:161});blocked(near,updateFeature(near,room,B.id,{u:159.5}),[A.id,B.id]);
const short=addF(one,{...B,u:60,width:9});blocked(short,updateFeature(short,room,B.id,{width:16}),[A.id,B.id]);
// The same world corner can be shared by openings on adjoining wall planes:
// mere matching screen projection or touching edges is not a conflict.
const angles=addF(blank(),{...A,u:0,width:38});const adjacent=addF(angles,{...B,wall:'left',u:room.length-45,width:45,bottom:110});assert(!hard(adjacent).length);
const sink=(k,r='work')=>addU(k,{id:'sink',kind:'sink',runId:r,u:50,width:84}),row={id:'work',wall:'back',tier:'base',start:10,end:220};
const underWindow=sink(addR(one,row));assert.equal(kitchenGeometry(underWindow,room).units[0].windowId,A.id);assert(!hard(underWindow).length);
// A dashed empty row is not timber. Its physical cupboard and its 4 cm
// stone top, however, must be checked even when the unit's own body clears.
const unit={id:'cupboard',kind:'storage',runId:'upper',u:64,width:68},up={id:'upper',wall:'back',tier:'upper',start:20,end:190};
const ghost=addR(one,up);assert(!hard(ghost).length);blocked(ghost,addUnit(ghost,room,unit),[A.id,unit.id]);
const cleanBay=addU(addR(blank(),up),unit);blocked(cleanBay,addFeature(cleanBay,room,A),[A.id,unit.id]);
const raisedWindow={...A,id:'slab-window',u:62,width:35,bottom:88,height:10};
const base=sink(addR(blank(),row));const capBlock=blocked(base,addFeature(base,room,raisedWindow),[raisedWindow.id]);assert(!hard(base).length);
const capWitness=capBlock.conflict;assert.equal(capWitness.bottom,88);assert.equal(capWitness.height,2,'only the upper two centimetres of the worktop clash');
const slabBefore=addR(addF(blank(),raisedWindow),row);blocked(slabBefore,addUnit(slabBefore,room,{id:'sink',kind:'sink',runId:'work',u:50,width:84}),[raisedWindow.id]);
blocked(underWindow,updateRun(underWindow,room,'work',{bottom:12}),[A.id]);assert.equal(underWindow.runs[0].bottom,0);
const widthBay=addU(ghost,{...unit,u:26,width:44});blocked(widthBay,updateUnit(widthBay,room,'cupboard',{width:47}),[A.id,'cupboard']);
blocked(widthBay,updateUnit(widthBay,room,'cupboard',{u:28}),[A.id,'cupboard']);
blocked(widthBay,copyKitchenUnit(widthBay,room,'cupboard','upper',85),[A.id]);
const leftWindow=addF(cleanBay,{...A,id:'left-window',wall:'left',u:72,width:35});blocked(leftWindow,updateRun(leftWindow,room,'upper',{wall:'left'}),['cupboard','left-window']);
const transfer=addR(leftWindow,{id:'left-sparse',wall:'left',tier:'upper',start:5,end:180});blocked(transfer,updateUnit(transfer,room,'cupboard',{runId:'left-sparse',u:70}),['cupboard','left-window']);
// Convenience placement/copy may choose a physical gap when NO coordinate
// was supplied, but an explicit pointer position must not be relocated.
const slotRow=addR(blank(),{id:'slot-row',tier:'upper',wall:'back',start:10,end:250});
const slotWindow=addF(slotRow,{...A,id:'slot-window',u:10,width:78,bottom:100,height:100});
const sample={kind:'storage',runId:'slot-row',width:40};
assert.deepEqual(availableKitchenSlots(slotWindow,room,sample),[{start:88,end:210,u:88}]);
assert.equal(addU(slotWindow,sample).units[0].u,88);blocked(slotWindow,addUnit(slotWindow,room,{...sample,u:15}),['slot-window']);
// The slab guard respects the real cutout too. A small solid just above a
// closed sink cabinet can fit inside the stone's opening; moving its side a
// centimetre into the actual stone must reject that same populated run.
const hole=kitchenGeometry(base,room).cutouts[0],pocket=pass(addFreeRun(base,room,{id:'pocket',x:hole.rect.x+3,z:hole.rect.z+3,angle:0,length:22,depth:16,bottom:86,height:20}));
const insideHole=addU(pocket,{id:'pocket-box',runId:'pocket',kind:'storage',u:0,width:22});assert.deepEqual(hard(insideHole),[]);
const stone=blocked(insideHole,transformFreeRun(insideHole,room,'pocket',{dx:hole.rect.w-24}),['pocket-box']);assert.equal(stone.conflict.type,'top-body');
// Service mounts cannot occupy a structural aperture or pier in either
// authoring order. They can sit behind a real under-sink cabinet, and do not
// reserve an entire cabinet or prohibit two compatible utility locations.
const water={id:'water',kind:'water',wall:'back',u:78,width:6,bottom:117,height:6,depth:3};blocked(one,addFeature(one,room,water),[A.id,'water']);
const svc=addF(blank(),water);blocked(svc,addFeature(svc,room,A),[A.id,'water']);
const drained=addF(underWindow,{...water,bottom:48});assert(!hard(addF(drained,{...water,id:'drain',kind:'drain',bottom:48})).length);
const pier={id:'pier',kind:'column',wall:'back',u:76,width:20,bottom:108,height:22,depth:18};blocked(one,addFeature(one,room,pier),[A.id,'pier']);blocked(svc,addFeature(svc,room,pier),['water','pier']);
const pierFirst=addF(blank(),pier);blocked(pierFirst,addFeature(pierFirst,room,water),['water','pier']);
const low=addF(one,{...pier,bottom:0,height:100});assert(!hard(low).length);
// A rotated free run is NOT its axis-aligned bounding box. A positive-area
// corner inside the candidate's true projection is blocked; a column in the
// same AABB but outside that projection is harmless.
let island=pass(addFreeRun(blank(),room,{id:'island',x:100,z:82,length:120,angle:0,depth:32,height:70,bottom:0}));
island=addU(island,{id:'island-unit',kind:'storage',runId:'island',u:0,width:55});
const spun=pass(transformFreeRun(island,room,'island',{angle:37})),ig=kitchenGeometry(spun,room),ir=ig.runs[0],unitBox=ig.units[0].rect,spot=kitchenRunPoint(room,ir,8,2);
const pin={id:'pin',kind:'column',wall:'back',u:spot.x-1.6,width:3.2,depth:spot.z+4,bottom:22,height:15};const obstructed=addF(island,pin);
const rotateFail=blocked(obstructed,transformFreeRun(obstructed,room,ir.id,{angle:37}),['island-unit','pin']);
assert(rotateFail.conflict.polygons?.length||rotateFail.conflict.polygon?.length);assert.equal(obstructed.runs[0].angle,0);
const clearCorner=addF(island,{...pin,id:'outside-polygon',u:unitBox.x+.5,width:1.2,depth:unitBox.z+1,bottom:24});assert(!hard(pass(transformFreeRun(clearCorner,room,ir.id,{angle:37}))).length);
const shifted=addF(island,{...pin,id:'translate-obstacle',u:109,width:17,depth:73});blocked(shifted,transformFreeRun(shifted,room,ir.id,{dz:-22}),['island-unit','translate-obstacle']);
const unchanged=JSON.stringify(island);assert.equal(JSON.stringify(pass(transformFreeRun(island,room,ir.id,{angle:37}))),JSON.stringify(spun));assert.equal(JSON.stringify(island),unchanged);
// Load a real old schema value, without allowing today's authoring API to
// create the overlap. Diagnostics must retain both identities, and validation
// must admit unrelated work, unchanged damage and incremental repair.
const legacy=validateKitchen(copy({...one,features:[...one.features,reversed.features[0]]}),room);assert(legacy);assert.deepEqual(legacy.features.map(f=>f.id),[A.id,B.id]);
const initial=hard(legacy).find(c=>hasIds(c,[A.id,B.id]));assert(initial);assert(Math.abs(initial.measure-15*15)<1e-6,'same-wall pair uses the shared opening AREA, not a box or the full smaller opening');
const diagnostics=kitchenGeometry(legacy,room).conflicts.filter(c=>hasIds(c,[A.id,B.id]));assert(diagnostics.length);
const extra=addF(legacy,{id:'unrelated',kind:'electric',wall:'front',u:20});assert.equal(hard(extra).find(c=>hasIds(c,[A.id,B.id])).measure,initial.measure);
const sameArea=pass(updateFeature(extra,room,A.id,{depth:4}));assert.equal(hard(sameArea).find(c=>hasIds(c,[A.id,B.id])).measure,initial.measure);
const tiny=addF(legacy,{...B,id:'third-opening',u:265,width:25,bottom:208,height:8});blocked(tiny,updateFeature(tiny,room,B.id,{u:199}),[B.id,'third-opening']); // trading a large old pair for a small NEW one is not repair
const partial=pass(updateFeature(extra,room,B.id,{u:150}));assert(hard(partial).find(c=>hasIds(c,[A.id,B.id])).measure<initial.measure);
blocked(partial,updateFeature(partial,room,B.id,{u:148}),[A.id,B.id]);
const repaired=pass(updateFeature(partial,room,B.id,{u:160}));assert(!hard(repaired).length);assert(!hard(pass(removeKitchenItem(legacy,B.id))).length);
const shown=validateKitchen(copy(legacy),room);assert(shown);assert(validateKitchenChange(legacy,room,shown,room).ok);
const unsafeRaw=copy(legacy);unsafeRaw.features.find(f=>f.id===B.id).u=140;const worse=validateKitchen(unsafeRaw,room);assert(worse);assert(!validateKitchenChange(legacy,room,worse,room).ok);
// An opened appliance is a simulation, not a blocked structural insertion.
// The shipped demo deliberately demonstrates a drawer/dishwasher clash.
const demo=createKitchen(room);assert.deepEqual(hard(demo),[]);
for(const id of ['unit-sink','unit-dishwasher','unit-storage','unit-prep','unit-hob','unit-drawers','unit-corner-side','unit-left-storage','unit-upper'])assert(demo.units.some(u=>u.id===id),id+' silently disappeared from the demo');
for(const id of ['feature-window','feature-water','feature-drain','feature-electric'])assert(demo.features.some(f=>f.id===id),id+' missing from the demo');
const opened=pass(updateUnit(pass(updateUnit(demo,room,'unit-dishwasher',{open:true})),room,'unit-drawers',{open:true}));assert(kitchenGeometry(opened,room).conflicts.some(c=>c.type==='open-open'));assert.deepEqual(hard(opened),[]);
for(const size of [room,{width:220,length:206,height:168},{width:1200,length:1200,height:600}]){
 const idea=createCreativeKitchen(size);assert(idea);assert.deepEqual(hardKitchenConflicts(idea,size),[]);assert.deepEqual(idea.features.map(f=>f.id).sort(),['idea-drain','idea-water','idea-window']);
 assert.deepEqual(idea.units.map(u=>u.id).sort(),['idea-hob','idea-island-cabinet','idea-island-drawers','idea-pantry','idea-sink','idea-upper-storage']);assert.equal(idea.runs.length,3);
}
console.log('PASS: bidirectional hard guards, partial overlap/tangency, sink/window and services, countertop-only and populated wall/rotated island changes, true polygon vs AABB, recoverable legacy collisions and intact shipped layouts.');
