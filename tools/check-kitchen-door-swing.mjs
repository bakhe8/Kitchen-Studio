import assert from 'node:assert/strict';
import {addRun,addUnit,addFeature,updateFeature,updateRun,kitchenGeometry,validateKitchen,validateKitchenChange,availableKitchenSlots,createKitchen} from '../public/kitchen-model.js';
import {makeFurnishedSaudiRoom,localRoomPresets} from '../public/kitchen-room-presets.js';
import {roomArchitecture,architectureWallPoint} from '../public/kitchen-architecture.js';
const room={width:500,length:400,height:280},empty=createKitchen(room,'empty');
const good=r=>(assert.ok(r.ok,r.reason),r.kitchen),deny=(r,k)=>{assert.equal(r.ok,false);assert.equal(r.code,'door-swing',r.reason);assert.ok(r.conflict?.hard);assert.equal(r.kitchen,k);assert.equal(r.changed,false);};
const door={id:'door-1',kind:'door',wall:'back',u:100,width:100,height:210,bottom:0,hinge:'left',swing:'in'};
const addDoor=(k=empty,attrs={},r=room)=>good(addFeature(k,r,{...door,...attrs}));
const addGuide=(k,x,z,options={},R=room)=>good(addRun(k,R,{id:'island',placement:'free',tier:'base',x,z,length:70,depth:20,angle:0,height:82,...options}));
const unit=(k,R=room,s={})=>addUnit(k,R,{runId:'island',kind:'storage',width:20,u:0,...s});
const plan=addDoor();
// Both points inside the swing AABB; only the latter actually intersects the disk.
assert.ok(unit(addGuide(plan,180,80)).ok);assert.ok(unit(addGuide(plan,160,80)).ok,'3-4-5 triangle touches the true circle');
const intrudes=addGuide(plan,159.9,79.9);deny(unit(intrudes),intrudes);
const openGap=good(unit(intrudes,room,{u:30}));deny(updateRun(openGap,room,'island',{x:126}),openGap);
const coords=availableKitchenSlots(intrudes,room,{runId:'island',kind:'storage',width:20});
assert.ok(coords[0].start>0&&coords[0].start<1);assert.ok(addUnit(intrudes,room,{runId:'island',kind:'storage',width:20}).ok);
for(const swing of [undefined,'out','sliding']){const k=addDoor(empty,{swing});assert.ok(unit(addGuide(k,108,25)).ok);assert.equal(Boolean(k.features[0].swing),!!swing);}
const handed=good(unit(addGuide(plan,185,60)));deny(updateFeature(handed,room,door.id,{hinge:'right'}),handed);
assert.ok(updateFeature(handed,room,door.id,{hinge:'right',swing:'sliding'}).ok);
const standalone=good(unit(addGuide(empty,116,50)));deny(addFeature(standalone,room,door),standalone);
// Existing conflicted file: load with original IDs; a smaller obstruction or
// an unrelated edit is valid, deeper obstruction is not.
const legacy={...standalone,features:[...plan.features]};
assert.deepEqual(validateKitchen(legacy,room),legacy);
const reduced=good(updateRun(legacy,room,'island',{x:174}));assert.ok(reduced.units.length===1);
deny(updateRun(reduced,room,'island',{x:155}),reduced);assert.ok(updateRun(legacy,room,'island',{worktopColor:'#123456'}).ok);
const wall=addDoor(empty,{u:0});for(const kind of ['column','shaft','heater','beam']){
  const f={id:'fixed',kind,wall:'left',u:310,width:20,depth:30,height:25,bottom:200};
  deny(addFeature(wall,room,f),wall);const above=good(addFeature(wall,room,{...f,bottom:210}));deny(updateFeature(above,room,'fixed',{bottom:209.9}),above);
}
// Physical faces also work on a measured sloping wall, and on a rotated island.
const chamfer={...room,architecture:{cut:{kind:'chamfer',corner:'back-left',width:150,depth:132}}},face=roomArchitecture(chamfer).walls.find(w=>w.id.endsWith('diagonal'));
const sloped=addDoor(empty,{wall:face.id,u:35,width:90},chamfer),p=architectureWallPoint(chamfer,face.id,55,38);
const row=addGuide(sloped,p.x,p.z,{angle:Math.atan2(face.tangent.z,face.tangent.x)*180/Math.PI},chamfer);deny(unit(row,chamfer),row);
for(const {id} of localRoomPresets){
 const d=makeFurnishedSaudiRoom(id);assert.ok(d.kitchen.units.length>=8);assert.equal(kitchenGeometry(d.kitchen,d.room).hardConflicts.length,0,id);
 assert.ok(validateKitchenChange(null,d.room,d.kitchen,d.room).ok,id);
}
console.log('Door sweep: actual quarter-turn vs its AABB, 1 mm penetration and tangency, two jambs and skew walls, solid island vs empty guide, bidirectional edits, heights, non-inward and unsurveyed legacy doors, incremental remediation, slots and all 3 Saudi presets passed.');
