import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {createKitchen,updateUnit,updateRun,addFeature,addRun,addUnit,kitchenGeometry,kitchenRunPoint,kitchenRunLocal} from '../public/kitchen-model.js';
import {wallLocalToRoom} from '../public/shelf-room-model.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
const plan=createShelfPlan(),initial=createKitchen(plan),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);
const mutate=r=>{assert(r.ok,r.reason);return r.kitchen;},center=r=>({x:r.x+r.w/2,z:r.z+r.d/2}),H=plan.wall.h;
const options={yaw:28,pitch:32},c=renderKitchenRoom(plan,{...options,kitchen:initial});
assert(!c.html.includes('data-room-cabinet='));assert(c.html.includes('data-room-opening="feature-window"'));assert(c.html.includes('data-kitchen-face="sink-bottom"'));assert(c.html.includes('data-kitchen-face="hob-ring"'));
assert(c.html.includes('data-kitchen-face="window-glass"'));assert(c.html.includes('data-kitchen-face="dishwasher-front"'));assert(!c.html.includes('open-dishwasher-door'));assert(!c.html.includes('data-kitchen-conflict='));
const k=mutate(updateUnit(mutate(updateUnit(initial,plan,'unit-dishwasher',{open:true})),plan,'unit-drawers',{open:true}));
const op=renderKitchenRoom(plan,{kitchen:k,...options});assert(op.html.includes('data-kitchen-face="open-dishwasher-door"'));assert(op.html.includes('data-kitchen-face="open-drawer-front"'));assert(op.html.includes('data-kitchen-face="rack-rail"'));assert(!op.html.includes('data-kitchen-face="dishwasher-front"'));assert(op.html.includes('data-kitchen-conflict="open-open"'));
const collision=op.geometry.conflicts.find(c=>c.type==='open-open');assert.equal(collision.bottom,8);assert.equal(collision.height,4);assert(op.html.includes('data-world-bottom="8" data-world-height="4"'));
const overhead=renderKitchenRoom(plan,{kitchen:k,pitch:85,yaw:0}),g=overhead.geometry;
const at=(render,x,y,z)=>render.hitTest(render.projection.project(x,y,z));
for(const u of g.units.filter(u=>u.kind==='sink'||u.kind==='hob')){
  const p=center(u.cutout.rect),ty=H-u.cutout.bottom-u.cutout.height;
  const hit=at(overhead,p.x,ty,p.z);assert.equal(hit.id,u.id);assert.equal(hit.part,'module');
  if(u.kind==='sink'){assert(['sink-bottom','sink-wall','sink-drain'].includes(hit.tag),hit.tag);assert(hit.world.y>ty+3,'the pick must penetrate the stone top into the basin');}
  else assert(['hob-glass','hob-ring'].includes(hit.tag));
}
const first=g.units.find(u=>u.id==='unit-sink'),stonePoint=wallLocalToRoom(plan,'back',{x:first.u+2,y:H-first.bottom-first.height-4,z:20}),stone=at(overhead,stonePoint.x,stonePoint.y,stonePoint.z);
assert.equal(stone.part,'worktop');assert.equal(stone.unitId,first.id);near(stone.world.y,stonePoint.y);
const left=g.runs.find(r=>r.wall==='left'&&r.tier==='base'),gap=left.gaps.find?.(r=>(r.end??0)-(r.start??0)>10);
assert(gap,'demo must contain a real unsupported gap');if(gap){const p=wallLocalToRoom(plan,'left',{x:(gap.start+gap.end)/2,y:H-90,z:25});assert.notEqual(at(overhead,p.x,p.y,p.z)?.part,'worktop','no unsupported bridge over a gap');}
const bare=createKitchen(plan,'empty'),empty=renderKitchenRoom(plan,{kitchen:bare});assert(!empty.html.includes('data-kitchen-3d-id='));assert(!empty.html.includes('data-room-cabinet='));assert.equal(empty.geometry.worktops.length,0);
let extra=bare;for(const wall of ['front','right'])extra=mutate(addRun(extra,plan,{id:'r-'+wall,wall,tier:'base',start:75,end:245}));
extra=mutate(addUnit(extra,plan,{id:'test-oven',kind:'oven',runId:'r-front',u:82,width:60,open:true}));extra=mutate(addUnit(extra,plan,{id:'test-tall',kind:'tall',runId:'r-right',u:90,width:62}));
extra=mutate(addFeature(extra,plan,{id:'test-entry',kind:'door',wall:'right',u:180,width:72,height:195,depth:4,bottom:0}));extra=mutate(addFeature(extra,plan,{id:'test-post',kind:'column',wall:'front',u:12,width:27,height:200,depth:23}));
const side=renderKitchenRoom(plan,{kitchen:extra,yaw:-132,pitch:23});assert(side.html.includes('data-kitchen-face="open-oven-door"'));assert(side.html.includes('data-kitchen-face="door-leaf"'));assert(side.html.includes('data-kitchen-face="fixed-column"'));assert(side.html.includes('data-kitchen-3d-kind="tall"'));assert(!side.geometry.worktops.some(w=>w.runId==='r-right'));
const closed=renderKitchenRoom(plan,{kitchen:k,yaw:28,pitch:32,mode:'closed'});assert(!closed.html.includes('data-kitchen-3d-part="module"'));assert(!closed.html.includes('data-kitchen-conflict='));
const rear=renderKitchenRoom(plan,{kitchen:k,yaw:180,pitch:10});assert(!rear.html.includes('data-kitchen-face="window-glass"'),'No floating window on the removed near wall.');
const interior=renderKitchenRoom(plan,{kitchen:k,inspectInteriorId:'unit-upper',...options});assert(interior.html.includes('data-kitchen-face="interior-shelf"'));
function checkOrder(scene){
  // Painter order of the emitted SVG is compared to the closest physical ray.
  // Diagnostic witnesses are separate and cannot steal the underlying hit.
  const fs=[];for(const [tag] of scene.html.matchAll(/<(?:polygon|path) (?:data-kitchen-3d-part|data-room-surface)="[^"]+"[^>]*>/g)){
    const a=k=>tag.match(new RegExp(' '+k+'="([^"]+)"'))?.[1],rings=tag.startsWith('<polygon')?[a('points').split(' ').map(t=>t.split(',').map(Number))]:
      [...a('d').matchAll(/M([^Z]+)Z/g)].map(m=>m[1].split('L').map(t=>t.trim().split(/\s+/).map(Number)));
    const points=rings.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    fs.push({rings,id:a('data-kitchen-3d-id')||a('data-room-surface'),tag:a('data-kitchen-face')||a('data-building-face'),x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)});
  }
  function inside(ps,x,y){let s=0;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],v=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(v)<1e-6)continue;const sign=Math.sign(v);if(s&&s!==sign)return false;s=sign;}return !!s;}
  function contains(f,x,y){return x>=f.x0&&x<=f.x1&&y>=f.y0&&y<=f.y1&&f.rings.filter(p=>inside(p,x,y)).length%2===1;}
  const b=scene.bounds;let probes=0;for(let x=b.x+1.317;x<b.x+b.w;x+=7.31)for(let y=b.y+1.179;y<b.y+b.h;y+=6.23){const f=fs.findLast(a=>contains(a,x,y));if(!f)continue;const h=scene.hitTest(x,y);assert.ok(h);assert.equal(h.id,f.id);assert.equal(h.tag,f.tag);probes++;}
  assert(probes>30);
}
checkOrder(op);checkOrder(side);checkOrder(rear);
console.log('PASS: L-shaped kitchen, wall features/units on all orientations, real cutouts/basin and hob, worktops vs actual gaps, moving solid door/drawer and measured collision, true tall/oven/window/door, clean closed shell, paint order vs physical ray picks.');
// Off-axis islands: do not mistake the polygon's AABB for any finished part.
// All poses and checks are measured in the canonical run's local u/d frame.
let island=mutate(addRun(bare,plan,{id:'test-island',placement:'free',tier:'base',x:90,z:50,angle:31,length:260,depth:55,worktopFinish:'porcelain',worktopColor:'#d5dabb'}));
const islandUnits=[
 {id:'i-sink',u:0,width:67,kind:'sink',frontColor:'#b24f30'},
 {id:'i-dish',u:67,width:60,kind:'dishwasher',open:true,frontFinish:'graphite'},
 {id:'i-drawer',u:127,width:45,kind:'drawers',open:true,frontFinish:'walnut',frontColor:'#735747'},
 {id:'i-hob',u:172,width:60,kind:'hob',frontFinish:'sage'},
 {id:'i-store',u:232,width:28,kind:'storage',frontFinish:'oak',frontColor:'#9fbc7f'}
];
for(const patch of islandUnits)island=mutate(addUnit(island,plan,{...patch,runId:'test-island'}));
const ig=kitchenGeometry(island,plan),ir=ig.runs[0],it=ig.worktops[0],iy=H-it.bottom-it.height;
const projectAt=(render,u,y,d)=>{const q=kitchenRunPoint(ig.room,ir,u,d);return at(render,q.x,y,q.z);};
const overheadI=renderKitchenRoom(plan,{kitchen:island,yaw:-31,pitch:85}),frontI=renderKitchenRoom(plan,{kitchen:island,yaw:-31,pitch:0,selectedId:ir.id}),backI=renderKitchenRoom(plan,{kitchen:island,yaw:149,pitch:0});
assert.equal(it.holes.length,2);
assert.equal(projectAt(overheadI,3,iy,13).id,it.id);assert.equal(projectAt(overheadI,3,iy,13).unitId,'i-sink');
for(const h of it.holes){const hit=projectAt(overheadI,h.u+h.width/2,iy,h.offset+h.depth/2);assert.equal(hit.id,h.unitId);assert.equal(hit.part,'module');if(h.kind==='sink')assert(hit.world.y>iy+3);else assert.equal(hit.tag,'hob-glass');}
assert.notEqual(at(overheadI,it.rect.x+1,iy,it.rect.z+1)?.part,'worktop','AABB corner outside the rotated slab must not pick stone.');
const fPick=projectAt(frontI,244,H-51,55),rPick=projectAt(backI,244,H-51,0);assert.equal(fPick.id,'i-store');assert.equal(rPick.id,'i-store');assert.equal(rPick.tag,'island-rear-finish');assert.equal(fPick.wall,null);
near(kitchenRunLocal(ig.room,ir,rPick.world).d,0);assert(kitchenRunLocal(ig.room,ir,fPick.world).d>54.99);
const frontOutline=frontI.html.match(/data-kitchen-selected="test-island" points="([^"]+)"/)[1].split(' ').map(q=>Number(q.split(',')[0]));near(Math.max(...frontOutline)-Math.min(...frontOutline),ir.length);
const opened=ig.units.find(v=>v.id==='i-dish').openPart,opHit=projectAt(overheadI,opened.u+opened.width*.5,H-opened.bottom-opened.height,opened.offset+opened.depth*.75);
assert.equal(opHit.id,'i-dish');assert(['open-dishwasher-door','stainless-door-inset'].includes(opHit.tag));
const opDrawer=ig.units.find(v=>v.id==='i-drawer').openPart,drawerHit=projectAt(frontI,opDrawer.u+opDrawer.width*.65,H-opDrawer.bottom-opDrawer.height*.41,opDrawer.offset+opDrawer.depth);
assert.equal(drawerHit.tag,'open-drawer-front');near(kitchenRunLocal(ig.room,ir,drawerHit.world).d,opDrawer.offset+opDrawer.depth);
for(const [txt,needle] of [[backI.html,'data-kitchen-face="island-rear-finish"'],[frontI.html,'data-kitchen-front-color="#9fbc7f"'],[frontI.html,'data-kitchen-front-finish="custom"'],[frontI.html,'data-mesh-texture="wood"'],[overheadI.html,'data-kitchen-worktop-color="#d5dabb"'],[overheadI.html,'data-mesh-texture="porcelain"']])assert(txt.includes(needle),needle);
const pathId=html=>html.match(/<path [^>]*data-kitchen-face="stone-top"[^>]* d="([^"]+)"/)[1];
const changed=mutate(updateRun(island,plan,ir.id,{worktopFinish:'oak',worktopColor:'#986e4c'})),diff=renderKitchenRoom(plan,{kitchen:changed,yaw:-31,pitch:85});
assert(diff.html.includes('data-kitchen-worktop-finish="oak"'));assert.equal(pathId(overheadI.html),pathId(diff.html),'finish cannot move the top or the holes');
const paintBlock=(html,id,color)=>{const f=[...html.matchAll(/<polygon [^>]*>/g)].map(a=>a[0]).find(t=>t.includes('data-kitchen-3d-id="'+id+'"')&&t.includes('data-kitchen-face="recessed-panel"')&&t.includes('data-kitchen-front-color="'+color+'"'));assert(f);const fill=f.match(/ fill="([^"]+)"/)[1];if(fill.startsWith('#'))return fill;const p=fill.slice(5,-1),tag=html.match(new RegExp('<pattern id="'+p+'"[^>]*><rect [^>]*fill="(#[a-f0-9]{6})"'));assert(tag);return tag[1];};
const changedFront=mutate(updateUnit(island,plan,'i-store',{frontColor:'#505c78'}));assert.notEqual(paintBlock(frontI.html,'i-store','#9fbc7f'),paintBlock(renderKitchenRoom(plan,{kitchen:changedFront,yaw:-31,pitch:0}).html,'i-store','#505c78'));
const origin=kitchenRunPoint(ig.room,ir,123,128);let coll=mutate(addRun(island,plan,{id:'opposite',placement:'free',tier:'base',x:origin.x,z:origin.z,angle:211,length:50,depth:22}));coll=mutate(addUnit(coll,plan,{id:'opposite-unit',runId:'opposite',kind:'storage',u:0,width:50}));
const witness=renderKitchenRoom(plan,{kitchen:coll,yaw:19,pitch:32}),cf=witness.geometry.conflicts.find(c=>c.type==='open-body'&&c.ids.includes('i-dish'));
assert(cf?.polygon?.length>=3);const witnessFoot=cf.polygon.map(q=>Number(q.x.toFixed(4))+','+Number(q.z.toFixed(4))).join(' ');assert(witness.html.includes('data-conflict-footprint="'+witnessFoot+'"'));
checkOrder(witness);checkOrder(backI);
console.log('PASS: arbitrary 31° island front and finished back, exact pick vs AABB, two rotated through-holes, oriented dishwasher/drawer and collision prism, actual material/hex tint with unchanged geometry, selected run hull and occlusion.');
// A peninsula may physically meet a wall with its SHORT end without becoming a
// wall-owned cabinet. Its free coordinate frame and custom-only finishes persist.
let pen=mutate(addRun(bare,plan,{id:'peninsula',placement:'free',tier:'base',x:0,z:135,angle:0,length:124,depth:55,worktopColor:'#485461'}));
pen=mutate(addUnit(pen,plan,{id:'pen-bay',kind:'storage',runId:'peninsula',u:0,width:60,frontColor:'#828e76'}));
const peninsula=renderKitchenRoom(plan,{kitchen:pen,yaw:22,pitch:30}),penRun=peninsula.geometry.runs[0];
assert.equal(penRun.wall,null);assert.equal(penRun.polygon[0].x,0);assert.equal(penRun.polygon.at(-1).x,0);
assert(peninsula.html.includes('data-kitchen-worktop-finish="custom" data-kitchen-worktop-color="#485461"'));assert(peninsula.html.includes('data-mesh-texture="stone"'));
assert(peninsula.html.includes('data-kitchen-front-finish="custom" data-kitchen-front-color="#828e76"'));

// These are genuine hinge leaves in their collision solids, not one box
// enclosing two doors across the empty centre. Hit the physical free edge,
// external panel or inset pull to get the unit required by the Test tool.
const hu='unit-upper',uk=mutate(updateUnit(initial,plan,hu,{frontFinish:'walnut',frontColor:'#795840',open:true}));
const gu=kitchenGeometry(uk,plan),U=gu.units.find(u=>u.id===hu),ur=gu.runs.find(r=>r.id===U.runId);assert.equal(U.openParts.length,2);assert.equal(U.openPart,null);
const isoOpen=renderKitchenRoom(plan,{kitchen:uk,yaw:24,pitch:17}),flatOpen=renderKitchenRoom(plan,{kitchen:uk,yaw:0,pitch:0}),flatClosed=renderKitchenRoom(plan,{kitchen:initial,yaw:0,pitch:0});
for(const leaf of U.doorLeaves)assert(isoOpen.html.includes('data-door-leaf="'+leaf.id+'" data-hinge-side="'+leaf.hingeSide+'" data-door-angle="'+leaf.angle+'"'));
assert(isoOpen.html.includes('data-kitchen-face="open-hinged-door"')&&isoOpen.html.includes('data-kitchen-face="open-door-pull"'));
const doorTags=(scene,id)=>[...scene.html.matchAll(/<polygon data-kitchen-3d-part="module"[^>]*>/g)].map(x=>x[0]).filter(t=>t.includes('data-kitchen-3d-id="'+id+'"'));
const ink=doorTags(isoOpen,hu);assert(!ink.some(t=>t.includes('data-kitchen-face="door-front"')));assert(ink.some(t=>t.includes('data-kitchen-face="open-hinged-panel"')&&t.includes('data-kitchen-front-finish="walnut"')&&t.includes('data-kitchen-front-color="#795840"')));
const openingPoint=kitchenRunPoint(gu.room,ur,U.u+U.width*.32,ur.depth),apY=H-U.bottom-U.height*.67;
const covered=at(flatClosed,openingPoint.x,apY,openingPoint.z),revealed=at(flatOpen,openingPoint.x,apY,openingPoint.z);
assert.equal(covered.id,hu);assert(['recessed-panel','door-front'].includes(covered.tag));assert.equal(revealed.id,hu);assert(['back','interior-backing','interior-shelf','interior-divider'].includes(revealed.tag));assert(revealed.world.z<ur.depth-2);
const closedSection=renderKitchenRoom(plan,{kitchen:initial,inspectInteriorId:hu,yaw:24,pitch:17}),openSection=renderKitchenRoom(plan,{kitchen:uk,inspectInteriorId:hu,yaw:24,pitch:17});
assert.equal(closedSection.geometry.units.find(u=>u.id===hu).openParts.length,0);assert(!doorTags(closedSection,hu).some(t=>t.includes('data-door-leaf=')));
assert(doorTags(openSection,hu).some(t=>t.includes('data-kitchen-face="open-hinged-door"')),'exposing internals must not suppress physically opened doors');
function pullWitness(k,u,r,leaf,bearing){
 const opened=leaf.opened,len=Math.min(14,leaf.leafWidth*.47),margin=Math.max(.8,Math.min(3,leaf.leafWidth*.1));
 const left=leaf.hingeSide==='left',freeInLeaf=left?leaf.leafWidth-margin-len/2:margin+len/2;
 const coords=opened.polygon.map(p=>kitchenRunLocal(gu.room,r,p)),lo=Math.min(...coords.map(q=>q.u)),hi=Math.max(...coords.map(q=>q.u)),d0=Math.min(...coords.map(q=>q.d)),d1=Math.max(...coords.map(q=>q.d));
 const p=kitchenRunPoint(gu.room,r,left?lo:hi,left?d0+freeInLeaf:d1-freeInLeaf);
 const y=H-opened.bottom-opened.height+(u.tier==='upper'?opened.height-4:3.2)+1.2,sc=renderKitchenRoom(plan,{kitchen:k,yaw:bearing,pitch:0}),hit=at(sc,p.x,y,p.z);
 assert.equal(hit.id,u.id);assert.equal(hit.leafId,leaf.id);assert.equal(hit.hingeSide,leaf.hingeSide);assert.equal(hit.doorAngle,leaf.angle);assert.equal(hit.tag,'open-door-pull');
 near(hit.world.x,p.x);near(hit.world.z,p.z);near(hit.world.y,y);
}
for(const l of U.doorLeaves)pullWitness(uk,U,ur,l,l.hingeSide==='left'?-54:54);
let hingedIsland=mutate(updateUnit(island,plan,'i-store',{open:true})),hg=kitchenGeometry(hingedIsland,plan),store=hg.units.find(u=>u.id==='i-store'),hr=hg.runs.find(r=>r.id===store.runId);
assert.equal(store.doorLeaves.length,1);assert.equal(store.openParts.length,1);pullWitness(hingedIsland,store,hr,store.doorLeaves[0],-hr.angle-48);
const tallOpen=mutate(updateUnit(extra,plan,'test-tall',{open:true})),tg=kitchenGeometry(tallOpen,plan),tall=tg.units.find(u=>u.id==='test-tall'),tr=tg.runs.find(r=>r.id===tall.runId);
assert.equal(tall.openParts.length,1);pullWitness(tallOpen,tall,tr,tall.doorLeaves[0],-90-48);
// The pier stands beyond the cabinet's 34 cm closed body. Only the swung
// leaves enter it, so it remains a legal fixture and an actual Test conflict.
const obs=mutate(addFeature(uk,plan,{id:'upper-obstacle',kind:'column',wall:'left',u:gu.room.length-58,width:12,depth:102,bottom:148,height:46})),obScene=renderKitchenRoom(plan,{kitchen:obs,yaw:27,pitch:16});
const clash=obScene.geometry.conflicts.find(c=>c.type==='open-feature'&&c.ids.includes(hu)&&c.ids.includes('upper-obstacle'));assert(clash);assert.equal(clash.patches.length,2);
for(const patch of clash.patches){assert(obScene.html.includes('data-patch-parts="'+patch.partIds.join(' ')+'"'));assert(obScene.html.includes('data-patch-bottom="'+Number(patch.bottom.toFixed(4))+'" data-patch-height="'+Number(patch.height.toFixed(4))+'"'));}
checkOrder(isoOpen);checkOrder(renderKitchenRoom(plan,{kitchen:hingedIsland,yaw:-111,pitch:34}));
console.log('PASS: hinged upper pair and narrow/tall leaves, exposed interior, inward/outward sides, finished pulls follow the rotation on wall and angled island, inspection stays distinct, actual per-leaf collision patches and picks.');
