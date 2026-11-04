import assert from 'node:assert/strict';
import {checkSitePoints} from '../public/kitchen-site-survey-model.js';
import {prepareSupplierPlacement,supplierFrames} from '../public/kitchen-supplier.js';
import {roomArchitecture as shape,architectureWall as wall,architectureContains as inside,architectureWallPoint as point,architectureWallLocal as local,architectureCorners,validateKitchenRoomArchitecture as check} from '../public/kitchen-architecture.js';
import {createKitchen,kitchenGeometry,addRun,addUnit,addFeature,updateFeature,validateKitchenChange,validateKitchen,hardKitchenConflicts,availableKitchenSlots,kitchenRoom} from '../public/kitchen-model.js';
const base={width:500,length:400,height:270},room=(kind='notch',corner='back-left',W=120,D=90)=>({...base,architecture:{wallThickness:18.2,cut:{kind,corner,width:W,depth:D}}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,JSON.stringify({actual:a,expected:b}));
const good=o=>(assert.ok(o.ok,o.reason),o.kitchen),empty=createKitchen(base,'empty');
const broken=(result,before,code)=>{assert.equal(result.ok,false);assert.equal(result.changed,false);assert.equal(result.kitchen,before);if(code)assert.equal(result.code,code);};
assert.equal(shape(base).walls.length,4);assert.equal(shape(base).wallThickness,20);near(shape(base).area,200000);
for(const corner of architectureCorners){
 const right=corner.endsWith('right'),front=corner.startsWith('front'),X=right?500:0,Z=front?400:0;
 for(const kind of ['notch','chamfer','taper']){
   const R=room(kind,corner),a=shape(R);assert.equal(a.walls.length,kind==='notch'?6:kind==='chamfer'?5:4);
   near(a.area,500*400-120*(kind==='taper'?400:90)*(kind==='notch'?1:.5));assert.equal(inside(R,{x:X,z:Z}),false);
   assert.equal(inside(R,{x:250,z:180}),true);assert.equal(inside(R,{x:-1,z:100}),false);assert.equal(a.wallThickness,18.2);
   for(const w of a.walls){
     const u=(w.start+w.end)/2,mid=point(R,w.id,u),test=point(R,w.id,u,1),q=local(R,w.id,test);near(q.u,u);near(q.d,1);
     assert.ok(inside(R,mid));assert.ok(inside(R,test));assert.equal(inside(R,point(R,w.id,u,-1)),false);
     const next=a.walls[(a.walls.indexOf(w)+1)%a.walls.length];near(w.b.x,next.a.x);near(w.b.z,next.a.z);
     near(w.end-w.start,w.length);
     // Every wall, including a sloped side or custom return, takes its own window.
     const rr=addFeature(empty,R,{kind:'window',wall:w.id,u:u-10,width:20,depth:1,glazing:'frosted',adjacent:'lightwell'});assert.ok(rr.ok,w.id+' '+rr.reason);
     assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(rr.kitchen)),R),rr.kitchen);
   }
   if(kind==='taper'){near(a.walls.find(w=>w.id===(right?'right':'left')).length,Math.hypot(120,400));assert.equal(a.cut.depth,400);}
 }
}
const R=room(),C=room('chamfer'),rightChange=room('notch','back-right');
assert.equal(wall(R,'back').start,120);assert.deepEqual(point(R,'back',145),point(base,'back',145));
for(const bad of [room('notch','wrong'),room('notch','back-left',500),room('notch','back-left',30,400),{...R,architecture:{wallThickness:-1}}])assert.equal(check(bad).ok,false);
near(shape(room('chamfer','front-right',35.6,25.1)).area,500*400-35.6*25.1/2);
assert.deepEqual(kitchenRoom({wall:{w:500,h:270},cab:{},room:{...R,sitePoints:[{id:'floor-point'}]}}),{...R,sitePoints:[{id:'floor-point'}]});
broken(addFeature(empty,R,{kind:'window',wall:'back',u:119.9,width:20}),empty,'wall-span');
let tangent=good(addFeature(empty,R,{kind:'door',wall:'back',u:120,width:33.3,hinge:'right',swing:'sliding',adjacent:'laundry'}));
assert.equal(validateKitchen(tangent,R).features[0].swing,'sliding');
for(const patch of [{swing:'invalid'},{hinge:'invalid'},{adjacent:'invalid'}])broken(updateFeature(tangent,R,tangent.features[0].id,patch),tangent);
let zone=good(addRun(empty,R,{id:'r',wall:'return-back-left-x',tier:'base',start:0,end:120,depth:40}));
zone=good(addUnit(zone,R,{kind:'sink',runId:'r',u:10,width:70}));
zone=good(addFeature(zone,R,{kind:'window',wall:'return-back-left-x',u:5,width:75,bottom:100}));
assert.equal(kitchenGeometry(zone,R).units[0].windowId,zone.features[0].id);
assert.equal(hardKitchenConflicts(zone,R).length,0);
broken(validateKitchenChange(zone,R,zone,C),zone,'missing-wall');
broken(validateKitchenChange(zone,R,zone,rightChange),zone,'missing-wall');
assert.equal(validateKitchen(zone,C),null);
assert.equal(validateKitchen( JSON.parse(JSON.stringify(zone)),R).runs[0].wall,'return-back-left-x');
let skew=good(addRun(empty,C,{wall:'return-back-left-diagonal',tier:'base',start:18,end:118,depth:35}));
skew=good(addUnit(skew,C,{runId:skew.runs[0].id,kind:'storage',width:54,u:30}));assert.equal(hardKitchenConflicts(skew,C).length,0);
const island=(k,design,x,z)=>addRun(k,design,{id:'island',placement:'free',x,z,length:150,angle:315,depth:20});
const bare=good(island(empty,base,50,122));
const vertices=kitchenGeometry(bare,base).runs[0].polygon;assert.ok(vertices.every(p=>inside(R,p)),'all vertices should be inside even though a diagonal edge cuts the notch');
broken(island(empty,R,50,122),empty,'outside-room');broken(validateKitchenChange(bare,base,bare,R),bare,'outside-room');
assert.equal(hardKitchenConflicts(bare,R).length,1);assert.equal(hardKitchenConflicts(bare,base).length,0);
assert.equal(island(empty,R,50,160).ok,true,'diagonal touching concave corner is valid');
assert.equal(island(empty,R,50,159.9).ok,false,'one millimetre intrusion is detected');
let legacy=good(addRun(empty,base,{wall:'back',tier:'base',start:40,end:220,depth:42}));
const slots=availableKitchenSlots(legacy,R,{runId:legacy.runs[0].id,kind:'storage',width:50});near(slots[0].start,120);near(slots.at(-1).end,170);
const firstFit=good(addUnit(legacy,R,{runId:legacy.runs[0].id,kind:'storage',width:50}));near(firstFit.units[0].u,120);assert.equal(legacy.units.length,0);
const beam=good(addFeature(empty,R,{kind:'beam',wall:'back',u:150,width:90,height:23,depth:35}));
assert.equal(beam.features[0].bottom,247);
let occupied=good(addRun(beam,R,{wall:'back',tier:'upper',start:155,end:235,bottom:208,height:40}));
broken(addUnit(occupied,R,{runId:occupied.runs[0].id,kind:'storage',width:50,u:160}),occupied,'body-feature');
const heater=good(addFeature(empty,R,{kind:'heater',wall:'left',u:30}));assert.equal(heater.features[0].depth,42);
broken(addFeature(heater,R,{kind:'shaft',wall:'left',u:35,width:25}),heater,'feature-feature');
const passing=good(addRun(heater,R,{wall:'left',tier:'base',start:25,end:125}));
assert.ok(addUnit(passing,R,{kind:'storage',runId:passing.runs[0].id,u:30,width:60}).ok);
const supplier=prepareSupplierPlacement(empty,R,supplierFrames[0].article,{mode:'new',wall:'return-back-left-x',u:15,bottom:0});
assert.ok(supplier.ok,supplier.reason);assert.equal(supplier.kitchen.runs[0].wall,'return-back-left-x');
assert.equal(prepareSupplierPlacement(empty,R,supplierFrames[0].article,{mode:'new',wall:'back',u:75,bottom:0}).ok,false);
const points=(r,kind,x,z,size)=>checkSitePoints({...r,sitePoints:[{id:'site',kind,x,z,size}]}).ok;
assert.equal(points(R,'floor-drain',115,95,10),true);assert.equal(points(R,'floor-drain',115,94.9,10),false);
assert.equal(points(R,'floor-water',120,100,20),true);assert.equal(points(R,'floor-cleanout',120,99.9,20),false);
const AR=room('chamfer','back-left',100,100/Math.tan(48.75*Math.PI/180)),wallD=wall(AR,'return-back-left-diagonal');
const centre=point(AR,wallD.id,wallD.length/2,29.98);
assert.ok(Array.from({length:48},(_,i)=>({x:centre.x+30*Math.cos(i*Math.PI/24),z:centre.z+30*Math.sin(i*Math.PI/24)})).every(p=>inside(AR,p)),'a sampled circle would falsely fit');
assert.equal(points(AR,'floor-cleanout',centre.x,centre.z,60),false,'the true circle crosses this measured oblique wall');
console.log('Measured room: all four notch, chamfer and taper orientations, stable wall datums, mounted windows/runs on true returns, 1 mm cut penetration vs tangency incl crossing with all vertices inside, shape-change/cache/save guards, available slots, door details and structural height conflicts passed.');
