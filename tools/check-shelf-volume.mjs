import assert from 'node:assert/strict';
import {createShelfPlan,setShelfDepth} from '../public/shelf-model.js';
import {splitTarget,scopedDividers,scopedCells} from '../public/shelf-selection-model.js';
import {groupFinish} from '../public/shelf-group-finish.js';
import {placeSizedScreen} from '../public/shelf-sized-object.js';
import {makeShelfProjection,renderShelfVolume} from '../public/shelf-volume.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
let p=splitTarget(createShelfPlan(),{kind:'cell',key:'1:1'},'col').plan;
const selected=scopedCells(p).filter(c=>c.parentKey==='1:1');
p=groupFinish(p,[selected[0].key],'walnut').plan;
const c=p.cab,t=2;
for(const [yaw,pitch] of [[0,0],[55,32],[-55,-15],[24,12]]){
  const cam=makeShelfProjection(p,{yaw,pitch});
  for(const [x,y,z] of [[0,0,0],[95.37,123.1,1],[p.wall.w,p.wall.h,36],[52,-33,87]]){
    const uv=cam.project(x,y,z),back=cam.unproject(uv.x,uv.y,z);near(back.x,x);near(back.y,y);near(back.z,z);
  }
}
const flat=renderShelfVolume(p,{yaw:0,pitch:0,depth:36}),y=110;
assert.equal(flat.hitTest(c.x+1,y).part,'frame');near(flat.hitTest(c.x+1,y).z,36);
const div=scopedDividers(p).find(v=>v.owner.key==='1:1'&&v.kind==='cabinet');
assert.equal(flat.hitTest(div.cm,div.y+3).dividerId,div.id);assert.equal(flat.hitTest(div.cm,div.y-3)?.dividerId===div.id,false,'local divider cannot pick its extension in another row');
assert.ok(flat.cabinetHtml.includes('data-vol-cell="'+selected[0].key+'" data-vol-finish="walnut"'));
assert.ok(flat.hitTest(30,30).part==='wall');assert.equal(flat.hitTest(-1000,-1000),null);
const deep=setShelfDepth(p,82),a=renderShelfVolume(p,{yaw:24,pitch:12}),b=renderShelfVolume(deep,{yaw:24,pitch:12});
const wallPoint={x:20,y:10,z:0};assert.deepEqual(a.projection.projectPoint(wallPoint),b.projection.projectPoint(wallPoint));
const frozen=renderShelfVolume(deep,{projection:a.projection});assert.equal(frozen.depth,82);assert.equal(frozen.viewBox,a.viewBox);
const q=a.projection.project(c.x+c.w,c.y+c.h*.5,18),side=a.hitTest(q);assert.equal(side.part,'frame');assert.equal(side.face,'right');near(side.z,18);
const l=renderShelfVolume(p,{yaw:-30,pitch:-12}),ql=l.projection.project(c.x,c.y+c.h*.5,18),left=l.hitTest(ql);assert.equal(left.face,'left');near(left.p.x,c.x);near(left.z,18);
const below=l.hitTest(l.projection.project(c.x+c.w*.5,c.y+c.h,20));assert.equal(below.face,'bottom');
assert.equal(makeShelfProjection(p,{yaw:195,pitch:-38,depth:499}).yaw,55);assert.equal(makeShelfProjection(p,{yaw:195,pitch:-38,depth:499}).pitch,-15);assert.equal(makeShelfProjection(p,{depth:499}).depth,150);assert.equal(makeShelfProjection(p,{depth:-99}).depth,5);
const photo=renderShelfVolume(p,{photoUrl:'data:image/png;base64,QUJD'});assert(photo.wallHtml.includes('data-vol-wall-photo'));assert(!renderShelfVolume(p,{photoUrl:'javascript:alert(1)'}).html.includes('javascript:'));
assert(!a.cabinetHtml.includes('data-vol-face="left" data-vol-z="36"'));
const tv=placeSizedScreen(p,{kind:'cell',key:selected[0].key},{w:160,h:53}).plan;
const sf=renderShelfVolume(tv,{yaw:34,pitch:18});assert(sf.html.includes('data-vol-part="screen"'));assert(sf.html.includes('data-vol-tag="screen-glass"'));assert(sf.html.includes('data-vol-diagnostic'));
function samples(render){
  // Independently compare painter order in the actual SVG with the closest
  // world-space ray hit. Includes deep slots, crossed boards, art and panels.
  const points=[];for(const [poly] of render.html.matchAll(/<polygon\b[^>]*>/g)){
    const get=k=>poly.match(new RegExp(k+'="([^"]*)"'))?.[1],kind=get('data-vol-part');if(!kind||poly.includes('data-vol-diagnostic'))continue;
    const ps=get('points').split(' ').map(t=>t.split(',').map(Number)),xs=ps.map(v=>v[0]),ys=ps.map(v=>v[1]);points.push({v:[kind,get('data-vol-face'),get('data-vol-divider'),get('data-vol-cell'),get('data-vol-tag')],ps,x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)});
  }
  function on(p,x,y){if(x<p.x0||x>p.x1||y<p.y0||y>p.y1)return false;let sign=0;for(let i=0;i<p.ps.length;i++){const A=p.ps[i],B=p.ps[(i+1)%p.ps.length],d=(B[0]-A[0])*(y-A[1])-(B[1]-A[1])*(x-A[0]);if(Math.abs(d)<1e-8)continue;const s=Math.sign(d);if(sign&&s!==sign)return false;sign=s;}return true;}
  let count=0;const B=render.bounds;
  for(let y=B.y+1.37;y<B.y+B.h;y+=4.29)for(let x=B.x+1.13;x<B.x+B.w;x+=4.21){
    const visible=points.findLast(q=>on(q,x,y)),hit=render.hitTest(x,y);if(!visible){assert.equal(hit,null);continue;}
    assert.ok(hit);assert.deepEqual([hit.part,hit.face,hit.dividerId,hit.part==='screen'?undefined:hit.key,hit.tag],visible.v,`paint/ray mismatch at ${x}, ${y}`);count++;
  }assert(count>200);
}
samples(a);samples(l);samples(sf);samples(renderShelfVolume(setShelfDepth(p,145),{yaw:55,pitch:32}));
console.log('PASS: signed camera poses and inverses, coplanar registration for A/B, depth limits, side picks, confined local cuts and surface finishes, true-size screen/diagnostics, nearest-face vs SVG paint order across thousands of rays.');
