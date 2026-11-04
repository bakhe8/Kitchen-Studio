import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {createKitchen,addRun,addUnit,kitchenRunPoint,kitchenRunLocal,kitchenRunPolygon,kitchenWallPoint} from '../public/kitchen-model.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
import {onHorizontal,onWall,onRunAxis,pickVolume,volumeEditOverlay} from '../public/kitchen-volume-edit.js';
const plan=createShelfPlan(),take=r=>{assert(r.ok,r.reason);return r.kitchen;},near=(a,b,e=1e-5)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),xyz=(x,y,z)=>({x,y,z}),equal=(a,b)=>['x','y','z'].forEach(k=>near(a[k],b[k]));
let k=createKitchen(plan,'empty');
for(const [id,tier] of [['base','base'],['upper','upper']])k=take(addRun(k,plan,{id,tier,wall:'back',start:10,end:310}));
k=take(addUnit(k,plan,{id:'upper-box',kind:'storage',runId:'upper',u:43,width:85}));
k=take(addUnit(k,plan,{id:'base-box',kind:'storage',runId:'base',u:180,width:60}));
k=take(addRun(k,plan,{id:'free',placement:'free',x:110,z:128,angle:31,length:139,depth:53}));
k=take(addUnit(k,plan,{id:'free-bay',kind:'storage',runId:'free',u:0,width:68}));
const render=(yaw,pitch)=>renderKitchenRoom(plan,{kitchen:k,yaw,pitch}),scene=render(27,30),R=scene.geometry.room,H=R.height,P=scene.projection;
const close=renderKitchenRoom(plan,{kitchen:k,mode:'closed'}),run=scene.geometry.runs.find(r=>r.id==='free');
const world=(r,u,d,y)=>({...kitchenRunPoint(R,r,u,d),y}),uv=(s,p)=>s.projection.projectPoint(p);
for(const [yaw,pitch] of [[27,30],[-127,21],[64,-21],[179,78]]){
 const s=render(yaw,pitch);for(const p of [xyz(70,190,92),xyz(250,110,165)])equal(onHorizontal(s,uv(s,p),p.y),p);
 for(const wall of s.visibleSurfaces.filter(w=>!['floor','ceiling'].includes(w))){
  const comp=['left','right'].includes(wall)?s.projection.eye.x:s.projection.eye.z;if(Math.abs(comp)<.035){assert.equal(onWall(s,{x:0,y:0},{wall,locked:true}),null);continue;}
  const span=wall==='left'||wall==='right'?R.length:R.width,u=span*.59,p={...kitchenWallPoint(R,wall,u),y:7},q=uv(s,p),hit=onWall(s,q);assert.equal(hit?.wall,wall);near(hit.u,u);near(hit.bottom,H-7);equal(hit.world,p);
  const beyond={...kitchenWallPoint(R,wall,-23,6),y:-15},locked=onWall(s,uv(s,beyond),{wall,offset:6,locked:true});near(locked.u,-23);near(locked.bottom,H+15);assert.equal(onWall(s,uv(s,beyond),{wall,offset:6}),null);
 }
}
const nearLevel=render(90,0),anchor=xyz(50,210,40);assert.equal(onHorizontal(nearLevel,{x:0,y:0},210),null);
const axisRun=scene.geometry.runs.find(r=>r.id==='base'),edge=render(0,0);assert.equal(onRunAxis(nearLevel,uv(nearLevel,anchor),axisRun,anchor),null);
const shifted=onRunAxis(edge,uv(edge,xyz(anchor.x+9,anchor.y,anchor.z)),axisRun,anchor);near(shifted.x,anchor.x+9);near(shifted.y,anchor.y);
assert.equal(onWall(nearLevel,{x:0,y:0},{wall:'back',locked:true}),null);assert.equal(onHorizontal(close,{x:0,y:0},210),null);assert.equal(onHorizontal(scene,{x:NaN,y:4},210),null);
const above=render(0,79),upper=above.geometry.runs.find(r=>r.id==='upper'),base=above.geometry.runs.find(r=>r.id==='base');
const cap=(r,u,d)=>world(r,u,d,H-r.bottom-r.height),qUpper=uv(above,cap(upper,83,20));
assert.equal(above.hitTest(qUpper).id,'upper-box');assert.equal(pickVolume(above,qUpper,{layer:'base',intent:'unit'}),null,'a visible upper must never be bypassed for a base run');assert.equal(onWall(above,qUpper),null);
assert.equal(pickVolume(above,qUpper,{intent:'unit',layer:'upper'}).id,'upper');assert.equal(pickVolume(above,qUpper,{intent:'select'}).id,'upper-box');
const qGap=uv(above,cap(upper,150,22)),empty=pickVolume(above,qGap,{intent:'unit'});assert.equal(empty.id,'upper');assert(empty.empty);equal(empty.world,cap(upper,150,22));
const qBase=uv(scene,cap(base,285,48)),gap=pickVolume(scene,qBase,{intent:'unit',layer:'base'});assert.equal(gap?.id,'base');assert(gap.empty);
const freeTop=cap(run,117,32),pickIsland=pickVolume(above,uv(above,freeTop),{intent:'select'});assert.equal(pickIsland.id,'free');near(pickIsland.u,117);assert(pickIsland.empty);
const high=render(-31,75),body=uv(high,world(run,29,20,H-run.height-4)),picked=pickVolume(high,body,{intent:'unit'});assert.equal(picked.id,'free');assert.equal(picked.unitId,'free-bay');
function handle(s,k,h){const m=h.match(new RegExp('<g data-k-handle="'+k+'"[^>]+>'));assert(m,k+' absent');const prop=v=>Number(m[0].match(new RegExp('data-k-'+v+'="([^"]+)"'))[1]),p=xyz(prop('x'),prop('y'),prop('z')),q=uv(s,p),at=s.hitTest(q);
 if(at)assert(s.projection.projectPoint(at.world).depth<=q.depth+.1,k+' floats through a nearer object');
 const inv=onHorizontal(s,q,p.y);equal(inv,p);return p;}
const freeHTML=volumeEditOverlay(scene,{selected:{kind:'run',id:'free'},layer:'all',tool:'select',px:.65});
assert(freeHTML.includes('data-k-empty-run="base"'));assert(freeHTML.includes('data-k-empty-run="free"'));assert(freeHTML.includes('data-k-v-run="free"'));assert(freeHTML.includes('جزيرة '+new Intl.NumberFormat('ar').format(1)));
const move=handle(scene,'island-move',freeHTML),rotate=handle(scene,'island-rotate',freeHTML);assert(Math.hypot(move.x-rotate.x,move.z-rotate.z)>8);
const resize=handle(scene,'width',volumeEditOverlay(scene,{selected:{kind:'unit',id:'free-bay'},px:.65}));near(kitchenRunLocal(R,run,resize).u,68,.0004);
const filtered=volumeEditOverlay(scene,{layer:'upper',selected:{kind:'run',id:'free'}});assert(!filtered.includes('data-k-empty-run="base"'));assert(!filtered.includes('data-k-v-run="free"'));assert(!filtered.includes('island-move'));
assert(!volumeEditOverlay(nearLevel,{selected:{kind:'run',id:'free'}}).includes('data-k-handle="island-rotate"'));assert.equal(volumeEditOverlay(close), '');assert.equal(volumeEditOverlay(scene,{clean:true}), '');
// Follow every actually emitted dash segment of the lower empty prism back
// to its original world edge; none may punch through the real upper cabinet.
const path=[...volumeEditOverlay(above,{layer:'base'}).matchAll(/<path data-k-empty-run="base"[^>]*? d="([^"]+)"[^>]*>/g)].map(m=>m[1]);assert(path.length);
const edges=[];for(const gap of base.gaps){const f=kitchenRunPolygon(R,base,gap.start,gap.end-gap.start,base.depth),A=f.map(p=>({...p,y:H-base.height})),B=f.map(p=>({...p,y:H}));A.forEach((p,i)=>{let j=(i+1)%4;edges.push([p,A[j]],[B[i],B[j]],[p,B[i]]);});}
let probes=0,hidden=0;function isHidden(q,p){const h=above.hitTest(q);return h&&above.projection.projectPoint(h.world).depth>above.projection.projectPoint(p).depth+.115;}
for(const [a,b] of edges)for(let t=.05;t<1;t+=.05){const p=xyz(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);if(isHidden(uv(above,p),p))hidden++;}
assert(hidden>0,'scene must actually contain hidden construction edges');
for(const d of path)for(const seg of d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)){
 const [,x,y,X,Y]=seg.map(Number),q={x:(x+X)/2,y:(y+Y)/2};let visibleMatch=false;
 for(const [a,b] of edges){const u=uv(above,a),v=uv(above,b),dx=v.x-u.x,dy=v.y-u.y,l=dx*dx+dy*dy;if(l<.0001)continue;const t=((q.x-u.x)*dx+(q.y-u.y)*dy)/l;if(t<-.001||t>1.001||Math.hypot(q.x-u.x-dx*t,q.y-u.y-dy*t)>.002)continue;
 const p=xyz(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);if(!isHidden(q,p)){visibleMatch=true;break;}}
 assert(visibleMatch,'a rendered empty-run edge is behind solid furniture');probes++;
}
assert(probes>7);const red=volumeEditOverlay(scene,{draft:{polygon:run.polygon,bottom:0,height:90,ok:false},block:{run,limit:44,depth:53}});assert(red.includes('data-k-draft="blocked"')&&red.includes('data-k-blocked'));
console.log('PASS: continuous inverse for horizontal and four wall planes, locked/unlocked wall hits, edge-on axis fallback, raised/rotated empty runs, occluder-respecting layer choice, projected grips, numbered island tags, clipped guides and blocked drafts.');
