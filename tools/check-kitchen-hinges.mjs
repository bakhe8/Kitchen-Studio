import assert from 'node:assert/strict';
import {createKitchen,addRun,addFreeRun,addUnit,updateUnit,updateRun,addFeature,validateKitchen,kitchenGeometry,
  kitchenUnitSpecs,kitchenRunPoint,kitchenRunLocal,suggestKitchenFix} from '../public/kitchen-model.js';
import {convexIntersection,polygonArea} from '../public/kitchen-oriented.js';
import {copyKitchenUnit} from '../public/kitchen-creative-model.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {scenePlan} from '../public/kitchen-project.js';
const room={width:360,length:300,height:320},blank=()=>createKitchen(room,'empty');
const put=r=>{assert(r.ok,r.reason);return r.kitchen;};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const area=p=>Math.abs(polygonArea(p));
const squared=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const match=(a,b)=>assert(a.every(p=>b.some(q=>squared(p,q)<1e-12)));
const find=(k,room,id)=>kitchenGeometry(k,room).units.find(u=>u.id===id);
const exposed=(k,id,room0=room)=>put(updateUnit(k,room0,id,{open:true}));

// Verify the cross-sections by physically rotating every closed corner about
// its actual hinge, not by comparing two independent world bounding boxes.
for(const wall of ['back','front','left','right',null]) for(const width of [45,67.99,68,82]){
  let k=wall?put(addRun(blank(),room,{id:'row',tier:'upper',wall,start:20,end:200,depth:34,bottom:145,height:70})):
    put(addFreeRun(blank(),room,{id:'row',x:133,z:63,angle:37.5,length:150,depth:48,bottom:0,height:86}));
  const run=k.runs[0];k=put(addUnit(k,room,{id:'cupboard',kind:'storage',runId:run.id,width,u:run.start+4}));
  const before=find(k,room,'cupboard'),old=JSON.stringify(k);assert.deepEqual(before.openParts,[]);assert.equal(before.openPart,null);
  k=exposed(k,'cupboard');const open=find(k,room,'cupboard');
  const count=width>=68?2:1,fg=Math.min(.48,width*.015);
  assert.equal(open.doorLeaves.length,count);assert.equal(open.openParts.length,count);
  if(count===2){assert.equal(open.openPart,null);assert.equal(open.openRect,null);}else assert.deepEqual(open.openRect,open.openParts[0].rect);
  for(const [i,leaf] of open.doorLeaves.entries()){
    assert.equal(leaf.hingeSide,i?'right':'left');near(leaf.leafWidth,width/count-2*fg);near(leaf.thickness,1.65);
    near(leaf.bottom,run.bottom+(wall?0:9)+fg);near(leaf.height,run.height-(wall?0:9)-2*fg);
    assert.equal(leaf.opened.id,open.openParts[i].id);assert.equal(leaf.kind,'hinged-door');
    const h=leaf.hinge,sign=i?-1:1;
    match(leaf.closed.polygon.map(p=>({x:h.x-sign*(p.z-h.z),z:h.z+sign*(p.x-h.x)})),leaf.opened.polygon);
    near(area(leaf.opened.polygon),leaf.leafWidth*leaf.thickness);near(area(leaf.closed.polygon),area(leaf.opened.polygon));
    near(leaf.opened.offset,run.depth);near(kitchenRunLocal(room,run,leaf.opened.freeEdge).d,run.depth+leaf.leafWidth);
  }
  assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(k)),room),k);
  const closed=put(updateUnit(k,room,'cupboard',{open:false}));
  assert.equal(JSON.stringify(closed),old);assert.deepEqual(find(closed,room,'cupboard').openParts,[]);
}
// All and only facade types which render these hinged fronts share the hinge
// mechanism; in particular a tall front runs to its real 210 cm case height.
for(const kind of ['storage','tall','sink','hob','drawers','dishwasher','oven']){
  let k=put(addRun(blank(),room,{id:'r',tier:'base',wall:'back',start:0,end:200}));
  k=put(addUnit(k,room,{id:'item',kind,runId:'r',u:15,width:80,open:true}));
  const o=find(k,room,'item');assert(kitchenUnitSpecs[kind].openable);
  if(['storage','tall','sink','hob'].includes(kind)){assert.equal(o.openParts.length,2);assert.equal(o.openPart,null);
    near(o.openParts[0].bottom+o.openParts[0].height,(kind==='tall'?210:86)-.48);
    if(kind==='sink'||kind==='hob')assert(o.cutout);
  }else{assert.equal(o.openParts.length,1);assert.equal(o.openPart,o.openParts[0]);assert.equal(o.openPart.kind,kind==='drawers'?'drawer':'door');}
}
function upper(width=80,room0=room){
  let k=put(addRun(blank(),room0,{id:'up',wall:'back',tier:'upper',start:20,end:245,depth:34,bottom:145,height:70}));
  return put(addUnit(k,room0,{id:'a',kind:'storage',runId:'up',width,u:40,open:true}));
}
function floating(k,x,z,width,depth,bottom=149,kind='storage',angle=0){
  k=put(addFreeRun(k,room,{id:'b-run',x,z,angle,length:width,depth,bottom,height:50}));
  return put(addUnit(k,room,{id:'b',kind,runId:'b-run',width,u:0}));
}
const zero=upper(),gap=floating(zero,59,48,38,16);
assert(!kitchenGeometry(gap,room).conflicts.length,'A cabinet in the space BETWEEN open doors must stay clear.');
const both=floating(zero,35,48,92,17),original=JSON.stringify(both),g=kitchenGeometry(both,room),hit=g.conflicts.find(c=>c.type==='open-body');
assert.equal(g.conflicts.length,1);assert.deepEqual(hit.ids,['a','b']);assert.equal(hit.patches.length,2);
near(hit.polygons.reduce((a,p)=>a+area(p),0),2*1.65*17);
for(const [i,p] of hit.patches.entries()){assert.equal(p.partIds[0],find(both,room,'a').openParts[i].id);near(p.bottom,149);near(p.height,50);}
assert(!convexIntersection(hit.polygons[0],hit.polygons[1]).length);
const hint=suggestKitchenFix(both,room,hit.id);assert(hint?.unitId);const repaired=put(updateUnit(both,room,hint.unitId,{u:hint.u}));
assert(find(repaired,room,'a').open);assert(!kitchenGeometry(repaired,room).conflicts.some(c=>c.id===hit.id));assert.equal(JSON.stringify(both),original);
// Two opposed SINGLE-LEAF sections can clash only in the open state, with
// the two CLOSED boxes completely clear. Raising that exact body clears it.
const opposed=floating(zero,41.10,111,24,25,145,'storage',180);
assert(!kitchenGeometry(opposed,room).conflicts.length);
const opened=exposed(opposed,'b'),only=kitchenGeometry(opened,room).conflicts;
assert.equal(only.length,1);assert.equal(only[0].type,'open-open');assert.equal(only[0].polygons.length,1);
assert(only[0].patches[0].partIds.every(id=>id.startsWith('leaf:')));
const above=put(updateRun(opened,room,'b-run',{bottom:215}));assert.equal(kitchenGeometry(above,room).conflicts.length,0);
const exactTouch=put(updateRun(opened,room,'b-run',{bottom:214.52-.36}));assert.equal(kitchenGeometry(exactTouch,room).conflicts.length,0);
// Fixture and bounds use individual panels and non-zero vertical overlap.
const col=put(addFeature(zero,room,{id:'pier',kind:'column',wall:'left',u:room.length-64,width:15,depth:122,bottom:152,height:20}));
const feature=kitchenGeometry(col,room).conflicts.find(c=>c.type==='open-feature');
assert.equal(feature.patches.length,2);near(feature.patches[0].height,20);near(feature.patches[1].bottom,152);
const lo=put(addFeature(zero,room,{id:'low',kind:'column',wall:'left',u:room.length-64,width:15,depth:122,bottom:0,height:100}));
assert(!kitchenGeometry(lo,room).conflicts.some(c=>c.type==='open-feature'));
const small={...room,length:60},out=kitchenGeometry(upper(80,small),small).conflicts.find(c=>c.type==='open-outside');
assert(out);assert.equal(out.patches.length,2);assert(out.polygons.every(p=>p.every(q=>q.z>=60-1e-7)));
// Test interference with a cabinet in the SAME inclined basis too; physical
// patch area is invariant and remains much smaller than its world AABB.
let rotated=put(addFreeRun(blank(),room,{id:'is',x:99,z:101,angle:29.5,length:120,depth:45,bottom:50,height:65}));
rotated=put(addUnit(rotated,room,{id:'first',kind:'storage',runId:'is',u:13,width:72,open:true}));
const pos=kitchenRunPoint(room,rotated.runs[0],10,51);
rotated=put(addFreeRun(rotated,room,{id:'obs',x:pos.x,z:pos.z,angle:29.5,length:85,depth:16,bottom:55,height:42}));
rotated=put(addUnit(rotated,room,{id:'target',kind:'storage',runId:'obs',u:0,width:85}));
const rh=kitchenGeometry(rotated,room).conflicts.find(c=>c.type==='open-body');
assert.equal(rh.patches.length,2);near(rh.polygons.reduce((a,p)=>a+area(p),0),2*16*1.65);
assert(rh.rect.w*rh.rect.d>rh.polygons.reduce((a,p)=>a+area(p),0));
// Explicit handing overrides width-driven defaults for *millwork only*.
// The same physical hinge governs the opened rectangle, handle artwork and
// conflict detection. Reversing it can avoid an obstacle without moving
// the cabinet or pretending that its entire swept aisle is occupied.
for(const kind of ['storage','sink','hob','tall']){
  let doc=put(addRun(blank(),room,{id:'wall',tier:kind==='storage'?'upper':'base',wall:'back',start:0,end:260}));
  doc=put(addUnit(doc,room,{id:'wood',runId:'wall',kind,u:30,width:80,open:true}));
  const a=JSON.stringify(doc);
  for(const [mode,sides] of [['left',['left']],['right',['right']],['pair',['left','right']],['auto',['left','right']]]){
    const v=put(updateUnit(doc,room,'wood',{doorHanding:mode})),unit=find(v,room,'wood');
    assert.deepEqual(unit.doorLeaves.map(l=>l.hingeSide),sides);assert.equal(unit.openParts.length,sides.length);
    assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(v)),room),v);
    if(mode==='auto')assert.equal(JSON.stringify(v),a);
  }
  const right=put(updateUnit(doc,room,'wood',{doorHanding:'right'}));
  const narrow=put(updateUnit(right,room,'wood',{width:42}));assert.deepEqual(find(narrow,room,'wood').doorLeaves.map(l=>l.hingeSide),['right']);
  const smallPair=put(updateUnit(narrow,room,'wood',{doorHanding:'pair'}));assert.equal(find(smallPair,room,'wood').openParts.length,2);
  const dup=copyKitchenUnit(right,room,'wood','wall',150);assert(dup.ok,dup.reason);
  assert.equal(dup.kitchen.units.at(-1).doorHanding,'right');assert.equal(dup.kitchen.units.at(-1).open,false);
  assert.equal(JSON.stringify(doc),a);assert.equal(updateUnit(doc,room,'wood',{doorHanding:'other'}).kitchen,doc);
}
const leftSingle=put(updateUnit(upper(60),room,'a',{doorHanding:'left'}));
const blockedSingle=floating(leftSingle,39.5,51,25,17),rightSingle=put(updateUnit(blockedSingle,room,'a',{doorHanding:'right'}));
assert(kitchenGeometry(blockedSingle,room).conflicts.some(c=>c.type==='open-body'));
assert(!kitchenGeometry(rightSingle,room).conflicts.some(c=>c.type==='open-body'));
const narrowRight=find(rightSingle,room,'a').doorLeaves[0];
near(narrowRight.hingeU,40+60-.48);near(narrowRight.angle,-90);
for(const open of [false,true]){
  const v=put(updateUnit(rightSingle,room,'a',{open})),leaf=find(v,room,'a').doorLeaves[0];
  const mesh=getKitchenPhotoMesh(scenePlan(room),v).faces;
  const grips=mesh.filter(f=>f.id==='a'&&f.tag===(open?'open-door-pull':'pull'));assert(grips.length);
  const points=grips.flatMap(f=>f.points),anchor=leaf.hinge,free=(open?leaf.opened:leaf.closed).freeEdge;
  const mid={x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length};
  assert(squared(mid,free)<squared(mid,anchor),'single right-hinged handle must stay by the free edge, not the hinge');
}
for(const kind of ['fridge','freezer','drawers','oven','open-shelf']){
  const v=put(addRun(blank(),room,{id:'wall',tier:'base',wall:'back',start:0,end:260}));
  const doc=put(addUnit(v,room,{id:'fixed',runId:'wall',kind,u:0}));
  assert.equal(updateUnit(doc,room,'fixed',{doorHanding:'right'}).code,'door-handing');
  const bad=structuredClone(doc);bad.units[0].doorHanding='pair';assert.equal(validateKitchen(bad,room),null);
}
console.log('Kitchen hinges: actual one/two panels, pivoted faces on every orientation, upper/base/tall heights, empty centre, separate overlap witnesses, suggestions, persisted states and legacy appliance openings passed.');
