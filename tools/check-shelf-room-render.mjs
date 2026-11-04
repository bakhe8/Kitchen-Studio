import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {roomFaces,roomWallIds,attachCabinet,updateRoom,wallLocalToRoom,getRoom} from '../public/shelf-room-model.js';
import {renderShelfRoom,makeRoomProjection} from '../public/shelf-room-render.js';
const base=updateRoom(createShelfPlan(),{width:420,length:333,height:285}).plan;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const equal=(p,q)=>{for(const k of ['x','y','z'])near(p[k],q[k]);};
const yaws={back:0,front:180,left:90,right:-90};
const center=pts=>Object.fromEntries(['x','y','z'].map(k=>[k,pts.reduce((a,p)=>a+p[k],0)/pts.length]));
const isInside=(x,y,ps)=>{let sign=0;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],d=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(d)<1e-7)continue;if(sign&&Math.sign(d)!==sign)return false;sign=Math.sign(d);}return !!sign;};
for(const id of roomWallIds){
  const p=attachCabinet(base,id).plan,c=p.cab,front=renderShelfRoom(p,{yaw:yaws[id],pitch:0}),back=renderShelfRoom(p,{yaw:yaws[id]+180,pitch:0});
  assert.deepEqual(front.visibleSurfaces,[id]);assert.equal((front.html.match(/data-room-cabinet=/g)||[]).length,1);
  const f=wallLocalToRoom(p,id,{x:c.x+.38*c.w,y:c.y+1,z:p.depth??36}),h=front.hitTest(front.projection.projectPoint(f));
  assert.equal(h.part,'cabinet');assert.equal(h.surface,id);assert.equal(h.material.face,'front');equal(h.world,f);
  const r=wallLocalToRoom(p,id,{x:c.x+c.w*.53,y:c.y+c.h*.57,z:0}),bh=back.hitTest(back.projection.projectPoint(r));
  assert.equal(bh.part,'cabinet');assert.equal(bh.material.part,'frame');assert.equal(bh.material.face,'back');equal(bh.world,r);
  const mid=wallLocalToRoom(p,id,{x:c.x+13,y:c.y+10,z:0}),more=wallLocalToRoom(p,id,{x:c.x+25,y:c.y+10,z:0});
  assert(front.projection.projectPoint(more).x>front.projection.projectPoint(mid).x,'Front of a mounted cabinet must not be mirrored');
  const closed=renderShelfRoom(p,{yaw:yaws[id],pitch:0,mode:'closed'}),covered=closed.hitTest(closed.projection.projectPoint(f));
  assert.equal(covered.part,'surface');assert.notEqual(covered.surface,id);assert(!closed.html.includes('data-room-cabinet='));
}
const plan=attachCabinet(base,'right').plan,all=roomFaces(plan),seen=new Set();
for(const [yaw,pitch] of [[32,24],[108,-22],[-145,68],[-45,-54],[90,0],[-90,0],[0,0],[180,0],[0,85],[30,-85]]){
  for(const mode of ['closed','cutaway']){
    const scene=renderShelfRoom(plan,{yaw,pitch,mode}),P=scene.projection;
    const verts=all.filter(f=>scene.visibleSurfaces.includes(f.id)).map(f=>({f,ps:f.points.map(P.projectPoint)}));verts.forEach(({f})=>seen.add(f.id));
    assert.deepEqual(verts.map(({f})=>f.id),scene.visibleSurfaces);
    assert(!scene.html.includes('NaN'));assert(!scene.html.includes('Infinity'));assert(!scene.html.includes('javascript:'));
    const raw=scene.visibleSurfaces.map(id=>[id,scene.html.match(new RegExp('data-room-surface="'+id+'"','g'))?.length]);assert(raw.every(([,n])=>n===1));
    for(const {f,ps} of verts){
      const cent=center(f.points),at=P.projectPoint(cent),hit=scene.hitTest(at);
      assert.ok(hit);if(hit.part==='surface'){assert.equal(hit.surface,f.id);equal(hit.world,cent);}
      if(mode==='closed')assert.equal(hit.part,'surface');
      assert(isInside(at.x,at.y,ps));
    }
    // No transparent holes or surfaces materialising outside the convex shell.
    for(let y=P.bounds.y+4.84;y<P.bounds.y+P.bounds.h;y+=19.7)for(let x=P.bounds.x+1.26;x<P.bounds.x+P.bounds.w;x+=21.3){
      const visible=verts.find(it=>isInside(x,y,it.ps)),hit=scene.hitTest(x,y);
      if(!visible){assert.equal(hit,null);continue;}
      assert.ok(hit);if(mode==='closed'||hit.part==='surface')assert.equal(hit.surface,visible.f.id);
      const again=P.projectPoint(hit.world);near(again.x,x);near(again.y,y);
    }
  }
}
assert.deepEqual([...seen].sort(),['back','ceiling','floor','front','left','right']);
const p=makeRoomProjection(plan,{yaw:-42,pitch:20}),p2=makeRoomProjection(plan,{yaw:318,pitch:20});
assert.deepEqual(p.project(12,44,70),p2.project(12,44,70));
const img='data:image/png;base64,QUJD',img2='data:image/png;base64,REVG';
const pic=renderShelfRoom(plan,{yaw:-31,pitch:22,photos:{back:img,right:img2},selectedSurface:'front'});
assert(pic.html.includes('data-room-photo="back"'));assert(pic.html.includes('data-room-photo="right"'));assert(pic.html.includes('data-room-cut-surface="front"'));assert(!pic.html.includes('data-room-surface="front"'));
assert(!renderShelfRoom(plan,{yaw:-90,pitch:0,photoUrl:img}).html.includes('data-room-photo='),'Legacy back-wall photo must not migrate to new attachment');
assert(!renderShelfRoom(plan,{yaw:0,pitch:0,photos:{back:'https://untrusted.invalid/a.jpg'}}).html.includes('untrusted.invalid'));
const rm=getRoom(plan);assert.deepEqual([rm.width,rm.length,rm.height],[420,333,285]);
console.log('PASS: all six clipped/solid faces and picks through a full 360° orbit, all four local attachments and non-mirrored fronts, opaque rear panels, fixed per-wall photos, transparent cut-wall selection rim, reversed & edge-on cabinet rays.');
