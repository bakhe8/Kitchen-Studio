import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {createKitchen,addRun,addFreeRun,addUnit,addFeature,kitchenGeometry} from '../public/kitchen-model.js';
import {kitchenBacksplash,backsplashSettings,emitBacksplashQuads} from '../public/kitchen-backsplash.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
import {buildPhotoScene} from '../public/kitchen-photo-scene.js';
import {buildPhotoBVH,rayPhoto} from '../public/kitchen-photo-trace.js';
const p=createShelfPlan(),room={width:360,length:300,height:260};let k=createKitchen(room,'empty');
const add=(fn,row)=>{const r=fn(k,room,row);assert.ok(r.ok,r.reason);k=r.kitchen;};
add(addRun,{id:'base-back',tier:'base',wall:'back',start:20,end:335});
add(addUnit,{id:'body-a',runId:'base-back',kind:'storage',u:20,width:65});add(addUnit,{id:'body-b',runId:'base-back',kind:'sink',u:85,width:65});
add(addUnit,{id:'tower',runId:'base-back',kind:'tall',u:181,width:40});
add(addRun,{id:'upper',tier:'upper',wall:'back',start:12,end:255,bottom:125,height:70});
add(addUnit,{id:'above-left',runId:'upper',kind:'storage',u:20,width:40});
add(addFeature,{id:'glass',wall:'back',kind:'window',u:80,width:30,bottom:100,height:33});
add(addFreeRun,{id:'island',x:150,z:125,length:130,angle:11,depth:50});add(addUnit,{id:'island-unit',runId:'island',kind:'drawers',u:20,width:60});
const g=kitchenGeometry(k,room),L=kitchenBacksplash(p,g),ps=L.sides.back.patches,area=a=>a.reduce((s,p)=>s+(p.end-p.start)*(p.top-p.bottom),0),at=(ps,u,b)=>ps.some(p=>u>p.start&&u<p.end&&b>p.bottom&&b<p.top);
assert.equal(L.finish,'tile');assert.equal(L.height,56);
assert.equal(area(ps),130*56-40*(146-125)-30*33,'cap only below a real upper; remove the window precisely');
assert.ok(at(ps,39,121));assert.ok(!at(ps,39,135));assert.ok(at(ps,69,142),'empty segment of an upper run must not shorten the strip');
assert.ok(at(ps,95,96));assert.ok(!at(ps,95,120));assert.ok(at(ps,95,139));assert.ok(!at(ps,170,115)&&!at(ps,201,119));
assert.ok(ps.every(s=>s.runId==='base-back'&&s.start>=20&&s.end<=150&&s.bottom>=90));
for(const id of ['left','front','right'])assert.equal(L.sides[id].patches.length,0);
assert.equal(backsplashSettings({height:-5}).height,10);assert.equal(backsplashSettings({height:980}).height,130);
// A legacy layout may have a door crossing a worktop. The design should retain
// it for correction without painting a backsplash across its opening.
const legacy={...g,features:[...g.features,{kind:'door',wall:'back',u:64,width:7,bottom:0,height:210}]};
const lp=kitchenBacksplash(p,legacy).sides.back.patches;assert.equal(area(ps)-area(lp),7*56);assert(!at(lp,67,105));
const nopl={...p,kitchenSurfaces:{backsplash:{finish:'none',height:56}}};
assert.equal(kitchenBacksplash(nopl,g).sides.back.patches.length,0);assert(!renderKitchenRoom(nopl,{kitchen:k}).html.includes('data-k-backsplash='));
for(const f of ['tile','marble','wood','steel']){
 const plan={...p,kitchenSurfaces:{backsplash:{finish:f,height:56}}},s=kitchenBacksplash(plan,g);
 const visible=renderKitchenRoom(plan,{kitchen:k,yaw:12,pitch:12}).html;
 assert.match(visible,new RegExp('data-k-backsplash="'+f+'" data-k-splash-wall="back"'));
 assert(!renderKitchenRoom(plan,{kitchen:k,mode:'closed'}).html.includes('data-k-backsplash='));
 const image=buildPhotoScene(plan,k);assert(image.materials.some(m=>m.backsplash===f&&m.wall==='back'));
}
const photo=buildPhotoScene(p,k),tree=buildPhotoBVH(photo);
function rayToBack(u,v,d=9){const hit=rayPhoto(tree,[u,room.height-v,d],[0,0,-1]);return hit&&tree.materials[tree.ids[hit.i]];}
assert.equal(rayToBack(69,117)?.backsplash,'tile');assert.notEqual(rayToBack(94,118)?.backsplash,'tile','a ray through window aperture must not strike cladding');
assert.notEqual(rayToBack(171,117)?.backsplash,'tile','no cladding behind a gap in wall units');
assert.equal(rayToBack(70,120)?.type,'plaster','joint belongs to the matte grout rather than the glazed face');
let amount=0;emitBacksplashQuads(L,'back',room.height,()=>amount++);assert.ok(amount>ps.length);
console.log('Backsplash: actual continuous counters only, upper underside, exact door/window subtraction, no island/tall/empty, four finishes and none, physical tile/grout and PNG ray agreement OK.');
