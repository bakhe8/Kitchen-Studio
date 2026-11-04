import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {createKitchen,addRun,addFreeRun,updateRun,addUnit,updateUnit,transformFreeRun,addFeature,kitchenGeometry,
  validateKitchen,kitchenRunPoint,kitchenRunLocal,kitchenRunPolygon} from '../public/kitchen-model.js';
import {convexIntersection,polygonArea} from '../public/kitchen-oriented.js';

const room={width:520,length:450,height:270},blank=()=>createKitchen(room,'empty');
const ok=r=>{assert(r.ok,r.reason);return r.kitchen;};
const norm=p=>Math.hypot(p.x,p.z),sub=(a,b)=>({x:a.x-b.x,z:a.z-b.z});
const near=(v,n)=>assert(Math.abs(v-n)<1e-6,`${v} vs ${n}`);
const samePt=(a,b)=>{near(a.x,b.x);near(a.z,b.z);};
const area=p=>Math.abs(polygonArea(p));
const get=(k,id)=>k.runs.find(r=>r.id===id);
const unit=(g,id)=>g.units.find(u=>u.id===id);
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const round=k=>assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(k)),room),k);

let k=ok(addFreeRun(blank(),room,{id:'isle',x:180,z:110,angle:37,length:175,depth:40,worktopFinish:'charcoal'}));
const r=get(k,'isle');
assert.equal(r.placement,'free');assert.equal(r.wall,null);assert.equal(r.start,0);assert.equal(r.end,175);
for(const [u,d] of [[0,0],[117,40],[-3,71]]) {
  const p=kitchenRunPoint(room,r,u,d),local=kitchenRunLocal(room,r,p);
  near(local.u,u);near(local.d,d);
}
k=ok(addUnit(k,room,{id:'sink',runId:'isle',kind:'sink',u:0,width:80,frontFinish:'sage',detail:createShelfPlan()}));
k=ok(addUnit(k,room,{id:'draw',runId:'isle',kind:'drawers',u:80,width:60,frontFinish:'walnut',open:true}));
let g=kitchenGeometry(k,room),sink=unit(g,'sink'),drawer=unit(g,'draw');
assert.equal(sink.wall,null);assert.equal(g.worktops.length,1);assert.equal(g.worktops[0].worktopFinish,'charcoal');
assert.equal(sink.frontFinish,'sage');near(area(sink.polygon),80*40);
near(area(g.worktops[0].polygon),140*40);near(area(sink.cutout.polygon),sink.cutout.width*sink.cutout.depth);
assert.deepEqual(g.worktops[0].holes,[sink.cutout]);assert.deepEqual(drawer.openPart.runId,'isle');near(area(drawer.openPart.polygon),drawer.openPart.width*drawer.openPart.depth);
assert.deepEqual(g.conflicts,[]);round(k);
const occupied=freeze(k),stored=JSON.stringify(k),centre=kitchenRunPoint(room,r,r.length/2,r.depth/2);
const rotated=ok(transformFreeRun(k,room,'isle',{dx:14,dz:-17,angle:139.25})),rr=get(rotated,'isle');
samePt(kitchenRunPoint(room,rr,rr.length/2,rr.depth/2),{x:centre.x+14,z:centre.z-17});
assert.equal(rotated.units,k.units,'A rigid transform must not rewrite any interior, opening or unit.');
const rg=kitchenGeometry(rotated,room);
for(const [old,newer] of [[sink,unit(rg,'sink')],[sink.cutout,unit(rg,'sink').cutout],[drawer.openPart,unit(rg,'draw').openPart],[g.worktops[0],rg.worktops[0]]]){
  near(area(newer.polygon),area(old.polygon));
  for(let i=0;i<4;i++){
    const a=kitchenRunLocal(room,r,old.polygon[i]),b=kitchenRunLocal(room,rr,newer.polygon[i]);
    near(a.u,b.u);near(a.d,b.d);
  }
}
assert.equal(JSON.stringify(occupied),stored);round(rotated);
const atWall=transformFreeRun(k,room,'isle',{dx:-1200,dz:5000,angle:39});
assert(atWall.ok&&atWall.clamped&&atWall.reason);const wallRect=kitchenGeometry(atWall.kitchen,room).runs[0].rect;
near(wallRect.x,0);near(wallRect.z+wallRect.d,room.length);assert.equal(atWall.kitchen.units,k.units);round(atWall.kitchen);
const hallway={width:400,length:75,height:260};
const long=ok(addFreeRun(blank(),hallway,{x:10,z:10,length:310,depth:40,angle:0}));
const turned=transformFreeRun(long,hallway,long.runs[0].id,{angle:90});assert(!turned.ok&&turned.kitchen===long);
assert(!addFreeRun(blank(),room,{x:1,z:2,angle:40,length:180,depth:60}).ok);
assert(!updateRun(k,room,'isle',{length:90}).ok);assert(!addFreeRun(blank(),room,{x:5,z:5,length:90,tier:'upper'}).ok);

// Parallel rectangles with a ten-centimetre physical gap still have
// overlapping x/z AABBs. Reject the true overlap but accept the separated runs.
const p0={x:162,z:105},t=37;
let pair=ok(addFreeRun(blank(),room,{id:'a',...p0,angle:t,length:150,depth:40}));
const a=get(pair,'a'),p1=kitchenRunPoint(room,a,0,50);
pair=ok(addFreeRun(pair,room,{id:'b',...p1,angle:t,length:150,depth:30}));
const collide=addFreeRun(pair,room,{x:p0.x+1,z:p0.z,angle:t,length:100,depth:35});
assert(!collide.ok&&collide.code==='run-overlap'&&collide.kitchen===pair);
pair=ok(addUnit(pair,room,{id:'drawer',runId:'a',kind:'drawers',u:10,width:60}));
pair=ok(addUnit(pair,room,{id:'storage',runId:'b',kind:'storage',u:20,width:60}));
let pg=kitchenGeometry(pair,room);const [ra,rb]=pg.runs;
assert(Math.min(ra.rect.x+ra.rect.w,rb.rect.x+rb.rect.w)>Math.max(ra.rect.x,rb.rect.x));
assert(Math.min(ra.rect.z+ra.rect.d,rb.rect.z+rb.rect.d)>Math.max(ra.rect.z,rb.rect.z));
assert.equal(convexIntersection(ra.polygon,rb.polygon).length,0);assert(!pg.conflicts.length);
const opened=ok(updateUnit(pair,room,'drawer',{open:true}));pg=kitchenGeometry(opened,room);
const c=pg.conflicts.find(c=>c.type==='open-body');assert(c&&c.ids.includes('storage'));near(c.bottom,8);near(c.height,23);
near(area(c.polygon),48.9*22);assert(c.rect.w*c.rect.d>area(c.polygon));assert.deepEqual(c.polygons,[c.polygon]);
// Same floor outlines, distinct elevations: there is no volumetric hit.
const raised=ok(updateRun(opened,room,'b',{bottom:100}));assert(!kitchenGeometry(raised,room).conflicts.length);

// The front and top palettes are scoped to different records, optional in
// existing files, whitelisted in imports, and a duplicate owns its own detail.
const copy=ok(addUnit(k,room,{...k.units[0],id:'sink-copy',u:140,width:30,detail:null}));assert.equal(copy.units.at(-1).frontFinish,'sage');
const longRun=ok(updateRun(k,room,'isle',{length:250}));
const detailedCopy=ok(addUnit(longRun,room,{...longRun.units[0],id:'s2',u:140}));
assert.deepEqual(detailedCopy.units.at(-1).detail,k.units[0].detail);assert.notEqual(detailedCopy.units.at(-1).detail,k.units[0].detail);
assert.notEqual(detailedCopy.units.at(-1).detail.cells,k.units[0].detail.cells);round(detailedCopy);
assert(!updateUnit(k,room,'sink',{frontFinish:'evil'}).ok);assert(!updateRun(k,room,'isle',{worktopFinish:'not-stone'}).ok);
const plainRun=ok(updateRun(k,room,'isle',{worktopFinish:null}));assert(!('worktopFinish' in plainRun.runs[0]));
const plainUnit=ok(updateUnit(k,room,'sink',{frontFinish:null}));assert(!('frontFinish' in plainUnit.units[0]));
// Free tint is an override, not a material identity. It survives save/copy,
// resolves into the corresponding projected geometry, and clears independently.
const tinted=ok(updateRun(ok(updateUnit(longRun,room,'sink',{frontColor:'#A37Bc1'})),room,'isle',{worktopColor:'#0E9A2F'}));
const tintedGeometry=kitchenGeometry(tinted,room);
assert.equal(unit(tintedGeometry,'sink').frontColor,'#a37bc1');assert.equal(unit(tintedGeometry,'sink').frontFinish,'sage');
assert.equal(tintedGeometry.worktops[0].worktopColor,'#0e9a2f');assert.equal(tintedGeometry.worktops[0].worktopFinish,'charcoal');
round(tinted);
const twin=ok(addUnit(tinted,room,{...tinted.units[0],id:'twin',u:140}));
const repainted=ok(updateUnit(twin,room,'twin',{frontColor:'#101820'}));
assert.equal(repainted.units.find(u=>u.id==='sink').frontColor,'#a37bc1');assert.equal(repainted.units.at(-1).frontColor,'#101820');round(repainted);
const resetTint=ok(updateRun(ok(updateUnit(tinted,room,'sink',{frontFinish:'oak',frontColor:null})),room,'isle',{worktopColor:null}));
assert(!Object.hasOwn(resetTint.units[0],'frontColor')&&!Object.hasOwn(resetTint.runs[0],'worktopColor'));
assert.equal(resetTint.units[0].frontFinish,'oak');assert.equal(resetTint.runs[0].worktopFinish,'charcoal');
for(const bad of ['red','#abc','#123456ff',' #123456','#12zz78','url(#bad)',123]){
  assert.equal(updateUnit(tinted,room,'sink',{frontColor:bad}).kitchen,tinted);
  assert.equal(updateRun(tinted,room,'isle',{worktopColor:bad}).kitchen,tinted);
  const u=structuredClone(tinted),r=structuredClone(tinted);
  u.units[0].frontColor=bad;r.runs[0].worktopColor=bad;
  assert.equal(validateKitchen(u,room),null);assert.equal(validateKitchen(r,room),null);
}
const upperHex=structuredClone(tinted);
upperHex.units[0].frontColor='#A37BC1';upperHex.runs[0].worktopColor='#0E9A2F';
assert.deepEqual(validateKitchen(upperHex,room),tinted);
for(const mutate of [v=>v.runs[0].wall='back',v=>v.runs[0].angle=370,v=>v.runs[0].end=79,v=>v.runs[0].worktopFinish='X',v=>v.units[0].frontFinish='X']){
  const bad=structuredClone(k);mutate(bad);assert.equal(validateKitchen(bad),null);
}
// Legacy directions and saved keys remain intact; changing room size yields
// actual clipped exterior patches for islands instead of their full AABB.
const legacy=createKitchen(room);round(legacy);assert(legacy.runs.every(r=>!('placement' in r)));
const smaller={width:195,length:137,height:270},outside=kitchenGeometry(k,smaller).conflicts.find(c=>c.type==='outside-room'&&c.ids.includes('isle'));
assert(outside?.polygon.length);assert(outside.polygons.every(p=>area(p)>0));
const boundary=[{x:0,z:0},{x:195,z:0},{x:195,z:137},{x:0,z:137}];
assert(outside.polygons.every(p=>!convexIntersection(p,boundary).length));
assert.deepEqual(validateKitchen(k,smaller),k);
let wall=ok(addRun(blank(),room,{wall:'back',tier:'base',start:0,end:120}));
let pen=ok(addFreeRun(wall,room,{x:60,z:60,angle:0,length:120,depth:55}));assert(!kitchenGeometry(pen,room).conflicts.length);
const real=ok(addFeature(pen,room,{wall:'back',kind:'column',u:145,width:20,depth:75}));
const collidingBay={id:'saved-bay',runId:pen.runs[1].id,kind:'storage',u:65,width:45};
const refusedBay=addUnit(real,room,collidingBay);assert(!refusedBay.ok&&refusedBay.kitchen===real);
// New placements stop; legacy collisions must remain visible in the inspector.
const oldBay=ok(addUnit(pen,room,collidingBay)).units.find(v=>v.id===collidingBay.id);
const filled=validateKitchen({...real,units:[...real.units,oldBay]},room);assert(filled);
assert(kitchenGeometry(filled,room).conflicts.some(c=>c.type==='body-feature'));
console.log('Arbitrary-angle kitchen runs: local axes, rigid populated rotation, bounds, two palettes, deep copy, contact area + height, cutouts and migrations passed.');
