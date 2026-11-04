import assert from 'node:assert/strict';
import {createKitchen,addRun,addUnit,addFeature,updateRun,kitchenGeometry,kitchenRunLocal,validateKitchen} from '../public/kitchen-model.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {sheetTables} from '../public/kitchen-sheet.js';
import {scenePlan,shapeForUnit,commitProject,restoreProject,undoProject} from '../public/kitchen-project.js';
const room={width:400,length:300,height:280,colors:{}},plan=scenePlan(room);
const applied=r=>(assert(r.ok,r.reason),r.kitchen),blank=()=>createKitchen(room,'empty');
let k=applied(addRun(blank(),room,{id:'wall-upper',wall:'back',tier:'upper',start:0,end:210,depth:32,bottom:145,height:70}));
k=applied(addRun(k,room,{id:'base',wall:'back',tier:'base',start:0,end:210,depth:60,bottom:0,height:86}));
k=applied(addUnit(k,room,{id:'box',runId:'wall-upper',kind:'storage',u:0,width:60,interior:{shelves:2,dividers:1},open:true}));
k=applied(addUnit(k,room,{id:'hood',runId:'wall-upper',kind:'hood',u:100,width:85}));
k=applied(addUnit(k,room,{id:'under',runId:'base',kind:'storage',u:0,width:60}));
const row=k.runs[0],get=(g,id)=>g.units.find(u=>u.id===id);
const oldG=kitchenGeometry(k,room),changed=applied(updateRun(k,room,row.id,{depth:45.7})),g=kitchenGeometry(changed,room),u=get(g,'box'),before=get(oldG,'box'),hood=get(g,'hood');
assert.deepEqual(changed.runs[0],{...row,depth:45.7});assert.deepEqual(changed.units,k.units);assert.deepEqual(u.polygon.slice(0,2),before.polygon.slice(0,2));
assert.equal(u.depth,45.7);assert.equal(kitchenRunLocal(room,row,u.doorLeaves[0].hinge).d,45.7);
assert.equal(shapeForUnit(changed.units[0],u).depth,45.7);assert.deepEqual(get(g,'under'),get(oldG,'under'));assert.deepEqual(hood,get(oldG,'hood'));assert.equal(hood.depth,32);
const prior=getKitchenPhotoMesh(plan,k),after=getKitchenPhotoMesh(plan,changed),faces=(m,id)=>m.faces.filter(f=>f.id===id),extent=(f)=>Math.max(...f.flatMap(x=>x.points.map(p=>p.z)));
assert.equal(extent(faces(after,'box').filter(f=>f.tag==='side')),45.7);assert(Math.abs(extent(faces(after,'box').filter(f=>f.tag==='interior-shelf'))-extent(faces(prior,'box').filter(f=>f.tag==='interior-shelf'))-13.7)<.000001);
assert.deepEqual(faces(after,'hood').map(f=>f.points),faces(prior,'hood').map(f=>f.points));assert.equal(extent(faces(after,'hood').filter(f=>f.tag==='hood-canopy')),32);
const table=sheetTables({room,kitchen:changed},'back',true),fmt=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(x);
assert(table.includes([600,700,457].map(fmt).join(' × ')));assert(table.includes([850,600,320].map(fmt).join(' × ')));
class Store{m=new Map;setItem(k,v){this.m.set(k,v)}getItem(k){return this.m.get(k)??null}}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;assert(commitProject({room,kitchen:k},{room,kitchen:changed}).saved);
assert.equal(restoreProject().kitchen.runs[0].depth,45.7);assert.deepEqual(undoProject().next.kitchen,k);assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(changed)),room),changed);
// The side row starts 35 cm from the back. Contact is legal; extending just
// 1 mm farther must be rejected, not quietly made to fit by moving start 35 cm.
let corner=applied(addRun(blank(),room,{id:'rear',wall:'back',tier:'upper',start:0,end:150,depth:30,bottom:145,height:70}));
corner=applied(addRun(corner,room,{id:'side',wall:'left',tier:'upper',start:200,end:265,depth:35,bottom:145,height:70}));
const touching=applied(updateRun(corner,room,'rear',{depth:35}));assert.equal(touching.runs[0].start,0);assert.equal(touching.runs[0].end,150);
const blocked=updateRun(touching,room,'rear',{depth:35.1});assert.equal(blocked.ok,false);assert.equal(blocked.code,'run-overlap');assert.strictEqual(blocked.kitchen,touching);
for(const v of [14.9,150.1,NaN]){const r=updateRun(k,room,row.id,{depth:v});assert.equal(r.code,'run-depth');assert.strictEqual(r.kitchen,k);}
console.log('Row depth: fixed wall datum/span, inherited cabinet/hinges/shelves/photo mesh/printed mm, fixed 32 cm hood and unaffected base row, save and undo, exact 1 mm corner rejection.');
// A countertop is one real solid over touching base units, with through-holes;
// it must stay keyed to the lower run as the bank is pushed toward the aisle.
{
 let lower=applied(addRun(blank(),room,{id:'lower',wall:'back',tier:'base',start:0,end:350,depth:60}));
 lower=applied(addRun(lower,room,{id:'top-row',wall:'back',tier:'upper',start:0,end:85,depth:32,bottom:146,height:72}));
 lower=applied(addUnit(lower,room,{id:'wall-box',runId:'top-row',kind:'storage',u:0,width:60}));
 for(const [kind,width,u] of [['sink',80,0],['hob',60,80],['drawers',50,140],['fridge',70,190]])
   lower=applied(addUnit(lower,room,{id:kind,kind,width,runId:'lower',u,open:kind==='drawers'||kind==='fridge'}));
 const base=lower.runs[0],original=kitchenGeometry(lower,room),baseMesh=getKitchenPhotoMesh(plan,lower);
 for(const d of [72.5,35,15]){
   const next=applied(updateRun(lower,room,base.id,{depth:d})),g=kitchenGeometry(next,room),mesh=getKitchenPhotoMesh(plan,next),byId=(id,tag)=>mesh.faces.filter(f=>f.id===id&&f.tag===tag),zs=(id,tag)=>byId(id,tag).flatMap(f=>f.points.map(p=>p.z));
   assert.deepEqual(next.runs[0],{...base,depth:d});assert.deepEqual(next.units,lower.units);assert.deepEqual(get(g,'wall-box'),get(original,'wall-box'));assert.deepEqual(get(g,'fridge'),get(original,'fridge'));assert.deepEqual(faces(mesh,'fridge').map(f=>f.points),faces(baseMesh,'fridge').map(f=>f.points));
   assert.equal(g.worktops.length,1);const slab=g.worktops[0];assert.deepEqual(slab.holes.map(h=>h.kind),['sink','hob']);assert.equal(slab.end,190);assert.equal(slab.depth,d);assert.equal(Math.max(...zs(slab.id,'stone-top')),d);
   const patch=(face,x,z)=>x>Math.min(...face.points.map(p=>p.x))&&x<Math.max(...face.points.map(p=>p.x))&&z>Math.min(...face.points.map(p=>p.z))&&z<Math.max(...face.points.map(p=>p.z));
   for(const h of slab.holes){const x=h.u+h.width*.5,z=h.offset+h.depth*.5;assert(h.offset>0&&h.offset+h.depth<d);assert(!byId(slab.id,'stone-top').some(f=>patch(f,x,z)));assert(byId(h.unitId,h.kind==='sink'?'sink-bottom':'hob-glass').some(f=>patch(f,x,z)));}
   const hole=slab.holes[0],foot=zs('sink','faucet-foot'),spout=zs('sink','faucet-nozzle'),rim=zs('sink','sink-rim');assert(Math.min(...foot)>=0);assert(Math.max(...foot)<hole.offset-hole.sinkFitting.rim);assert(Math.min(...spout)>hole.offset&&Math.max(...spout)<hole.offset+hole.depth);assert(Math.min(...rim)>0&&Math.max(...rim)<d);
   const drawer=get(g,'drawers');assert.equal(drawer.openPart.offset,d);assert.equal(Math.max(...zs('drawers','open-drawer-front')),drawer.openPart.offset+drawer.openPart.depth);assert.equal(byId('drawers','recessed-plinth').length,0,'Unspecified cabinet supports must not create a fascia');
   if(d===72.5){const sheet=sheetTables({room,kitchen:next},'back',true);assert(sheet.includes([800,860,725].map(fmt).join(' × ')));assert(commitProject({room,kitchen:lower},{room,kitchen:next}).saved);assert.deepEqual(restoreProject().kitchen,next);assert.deepEqual(undoProject().next.kitchen,lower);}
 }
 // Only the stone (86–90cm), not cabinet bodies or the high row, intersects.
 const withBeam=applied(addFeature(lower,room,{id:'ledge',kind:'beam',wall:'left',u:225,width:5,depth:11,bottom:87,height:2}));
 const touch=applied(updateRun(withBeam,room,'lower',{depth:70}));const conflict=updateRun(touch,room,'lower',{depth:70.1});
 assert.equal(conflict.ok,false);assert.equal(conflict.code,'top-feature');assert.strictEqual(conflict.kitchen,touch);
 console.log('Lower row: 60→72.5/35/15 cm, real slab apertures, sink/tap/plates, drawers, no assumed fascia, fixed fridge and separate upper, measured 1mm slab collision, save/undo/725mm sheet.');
}
