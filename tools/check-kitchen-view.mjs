import {setProjectDefault} from '../public/kitchen-defaults-model.js';
import assert from 'node:assert/strict';
import {mountKitchenView} from '../public/kitchen-view.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {addRun,addUnit,addFeature,createKitchen,kitchenGeometry,kitchenRunPoint,kitchenRunLocal,updateRun,updateUnit} from '../public/kitchen-model.js';
const nodes=new Map();
class N{
 constructor(sel,attrs={}){this.sel=sel;this.dataset=attrs;this.values={};this.listeners={};this.classList={add(){},remove(){}};this.innerHTML='';this.textContent='';}
 querySelector(s){if(!nodes.has(s))nodes.set(s,new N(s));return nodes.get(s);}
 querySelectorAll(){return [];}
 setAttribute(k,v){this.values[k]=String(v);}
 getAttribute(k){return this.values[k];}
 toggleAttribute(k,show){if(show)this.values[k]='';else delete this.values[k];}
 addEventListener(k,fn){this.listeners[k]=fn;}
 fire(k,x={}){this.listeners[k]?.({target:this,preventDefault(){},...x});}
 closest(s){return s==='button'&&this.btn||s===this.sel?this:null;}
 contains(){return true;}
 focus(){}
 replaceChildren(){this.innerHTML='';}
 setPointerCapture(n){this.capture=n;}
 hasPointerCapture(n){return n===this.capture;}
 releasePointerCapture(){this.capture=null;}
 createSVGPoint(){return {matrixTransform(){return {x:this.x,y:this.y};}};}
 getScreenCTM(){return {inverse:()=>({})};}
}
const host=new N('host'),win=new N('win');host.ownerDocument={defaultView:win};let frame;win.requestAnimationFrame=fn=>{frame=fn;return 1;};win.cancelAnimationFrame=()=>{frame=null;};
const p=createShelfPlan(),r={width:360,length:300,height:260};let k=createKitchen(p,'empty'),commits=0,edits=[],rejects=[];
let activeProfileRoom=null;const kit=mountKitchenView(host,{getRoom:()=>activeProfileRoom,initialViewport:{view:'top',yaw:32,pitch:25},getPlan:()=>p,getKitchen:()=>k,onReject:msg=>rejects.push(msg),onEditUnit:id=>edits.push(id),onCommit:next=>{k=next;commits++;}});
kit.refresh();
const root=nodes.get('.kit'),svg=nodes.get('.kit-stage'),quick=nodes.get('[data-k-quick]'),status=nodes.get('[data-k-note]'),panel=nodes.get('[data-k-panel]');
const btn=(attrs)=>{const node=new N('button',attrs);node.btn=true;root.fire('click',{target:node});};
const choose=(k,v)=>{const e=new N('select',{kChoice:k});e.value=v;e.valueAsNumber=Number(v);quick.fire('change',{target:e});};
const send=(type,p,target=svg)=>svg.fire(type,{target,clientX:p[0],clientY:p[1],pointerId:9,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1});
const go=(a,b=a,t=svg)=>{send('pointerdown',a,t);if(b!==a){send('pointermove',b);if(frame){const fn=frame;frame=null;fn();}}send('pointerup',b,t);};
assert.match(host.innerHTML,/<div class="kit-preview-note"[^>]*data-k-preview-note/);assert.equal(kit.getState().view,'top');assert.equal(commits,0);
const palette=host.querySelector('.kit-palette'),labelToggle=new N('button',{kAct:'tool-labels'});
labelToggle.btn=true;
root.fire('click',{target:labelToggle});
assert.equal(labelToggle.getAttribute('aria-pressed'),'true');
assert.equal(palette.getAttribute('data-show-labels'),'');
root.fire('click',{target:labelToggle});
assert.equal(labelToggle.getAttribute('aria-pressed'),'false');
assert.equal(palette.getAttribute('data-show-labels'),undefined);
assert.equal(kit.getState().tool,'select');assert.equal(commits,0);
btn({kTool:'run'});go([24,1],[281,1]);assert.equal(k.runs.length,1);assert.equal(k.runs[0].tier,'base');assert.equal(commits,1);
assert(k.units.length>0&&k.units.every(u=>u.fillRole==='auto'));assert.equal(kit.getState().tool,'select');btn({kTool:'run'});choose('tier','upper');go([70,1],[200,1]);assert.equal(k.runs.length,2);assert.equal(k.runs[1].start,70);assert.equal(commits,2);
btn({kTool:'unit'});choose('unit-tier','base');choose('unit','drawers');choose('width',48);go([70,45]);assert(k.units.length>1);const byId=id=>k.units.find(u=>u.id===id),unit=k.units.find(u=>u.kind==='drawers');assert.equal(unit.width,48);assert.notEqual(unit.fillRole,'auto');
kit.selectUnit(unit.id);assert.match(svg.innerHTML,/data-k-width-mm="480"/,'the selected cabinet shows its true width at the drag edge');
const pickedDrawer=()=>byId(unit.id),gUnit=new N('[data-k-id]',{kId:unit.id,kKind:'unit'});btn({kTool:'select'});go([70,45],[90,45],gUnit);assert.equal(pickedDrawer().u,unit.u+20);
kit.selectUnit(unit.id);const handle=new N('[data-k-handle]',{kHandle:'width'}),end=pickedDrawer().u+pickedDrawer().width;go([end,40],[end+12,40],handle);assert.equal(pickedDrawer().width,60);assert.equal(commits,5);
btn({kAct:'interior'});assert.deepEqual(edits,[unit.id]);
btn({kTool:'unit'});choose('unit','dishwasher');choose('width',50);go([175,45]);const dishwasher=k.units.find(u=>u.kind==='dishwasher');assert.equal(dishwasher.width,50);
kit.selectUnit(unit.id);const snapshotBlocked=k,blockedAt=pickedDrawer().u+pickedDrawer().width;
send('pointerdown',[blockedAt,40],handle);send('pointermove',[blockedAt+35,40]);if(frame){const fn=frame;frame=null;fn();}assert.match(svg.innerHTML,/data-k-blocker/);assert.match(nodes.get('[data-k-preview-note]').textContent,/غسالة|صحون/);send('pointerup',[blockedAt+35,40]);assert.equal(k,snapshotBlocked);
kit.selectUnit(dishwasher.id);assert.ok(!svg.innerHTML.includes('data-k-handle'),'fixed appliance does not offer a stretching handle');

btn({kTool:'feature'});choose('feature','drain');go([106,1]);assert.equal(k.features[0].kind,'drain');assert.equal(k.runs.length,2);
const before=k;btn({kSample:'demo'});btn({kAct:'replace'});assert.equal(k,before,'removed demo command cannot replace a live project');
assert.doesNotMatch(host.innerHTML,/data-k-sample=/);k=createKitchen(p,'demo');kit.refresh();
const shownKitchen=()=>kit.getState().testOpenIds?{...k,units:k.units.map(u=>({...u,open:kit.getState().testOpenIds.includes(u.id)}))}:k;
const originalForTest=k,testCount=commits;
btn({kTool:'test'});assert.ok(panel.hidden);assert.equal(kit.getState().layer,'all');choose('test-layer','base');
for(const id of ['unit-dishwasher','unit-drawers']){
 const u=kitchenGeometry(k,r).units.find(v=>v.id===id),at=[u.rect.x+u.rect.w/2,u.rect.z+u.rect.d/2];go(at,at,new N('[data-k-id]',{kId:id,kKind:'unit'}));
}
assert.equal(k,originalForTest,'testing leaves saved CAD unchanged');assert.equal(commits,testCount);
const clash=kitchenGeometry(shownKitchen(),r).conflicts.find(c=>c.type==='open-open');assert.ok(clash);assert.equal(panel.hidden,false);assert.match(nodes.get('[data-k-panel-body]').innerHTML,/data-k-fix/);
btn({kFix:clash.id});assert.equal(kit.getState().tool,'select');assert.equal(k,originalForTest,'handoff to correction is not an implicit move');
const snap=JSON.stringify(k);btn({kView:'volume'});btn({kAct:'orbit'});go([125,100],[220,130]);assert.equal(kit.getState().view,'volume');assert.notEqual(kit.getState().yaw,32);assert.equal(JSON.stringify(k),snap);assert.match(kit.exportSvg(),/data-kitchen-3d-part/);
btn({kView:'top'});assert.match(kit.exportSvg(),/data-k-worktop-edge/);assert.ok(!kit.exportSvg().includes('data-k-handle'));
// A populated, non-axis-aligned freestanding run is one editable object, and
// its units continue to measure offsets on their own local axis.
btn({kAct:'empty-kitchen'});btn({kAct:'replace'});const beforeDraw=commits;
btn({kTool:'run'});choose('run-placement','free');choose('island-depth',44);
send('pointerdown',[90,105]);send('pointermove',[210,165]);if(frame){const fn=frame;frame=null;fn();}
assert.match(svg.innerHTML,/data-k-draft=/);assert.equal(commits,beforeDraw);send('pointerup',[210,165]);
let island=k.runs[0];assert.equal(island.placement,'free');assert.equal(island.wall,null);assert.equal(island.depth,44);assert.ok(Math.abs(island.angle-26.565)<.1);assert.equal(commits,beforeDraw+1);assert.match(svg.innerHTML,/data-k-handle="island-rotate"/);
const world=(v,u,d)=>{const p=kitchenRunPoint(r,v,u,d);return [p.x,p.z];};
const handleAt=kind=>{const m=svg.innerHTML.match(new RegExp('data-k-handle="island-'+kind+'"[^>]+data-k-x="([^"]+)" data-k-z="([^"]+)"'));assert.ok(m);return [Number(m[1]),Number(m[2])];};
const fill=(kind,w,u)=>{btn({kTool:'unit'});choose('unit',kind);choose('width',w);const spot=world(island,u+w/2,20);go(spot);};
assert(k.units.some(u=>u.runId===island.id&&u.fillRole==='auto'));fill('drawers',42,12);fill('sink',55,72);assert.equal(k.units.filter(u=>u.fillRole!=='auto').length,2);
const islandDrawer=k.units.find(u=>u.kind==='drawers'),islandSink=k.units.find(u=>u.kind==='sink');assert.match(kit.exportSvg(),/<path data-k-worktop[^>]+L[^>]+Z/);
kit.selectUnit(islandDrawer.id);btn({kAct:'parent-run'});assert.equal(kit.getState().selected.id,island.id);btn({kAct:'close'});
const hMove=handleAt('move'),startCount=commits,old=JSON.stringify(k.units);go(hMove,[hMove[0]+21,hMove[1]-10],new N('[data-k-handle]',{kHandle:'island-move',kOwner:island.id}));
assert.equal(commits,startCount+1);assert.ok(Math.abs(k.runs[0].x-island.x-21)<1e-7);assert.ok(Math.abs(k.runs[0].z-island.z+10)<1e-7);assert.equal(JSON.stringify(k.units),old,'moving the parent does not rewrite individual module identities or offsets');
island=k.runs[0];const pivot=world(island,island.length/2,island.depth/2),rot=handleAt('rotate'),radius=Math.hypot(rot[0]-pivot[0],rot[1]-pivot[1]),a0=Math.atan2(rot[1]-pivot[1],rot[0]-pivot[0]),a1=a0+Math.PI/3;
go(rot,[pivot[0]+radius*Math.cos(a1),pivot[1]+radius*Math.sin(a1)],new N('[data-k-handle]',{kHandle:'island-rotate',kOwner:island.id}));assert.ok(Math.abs(k.runs[0].angle-island.angle-60)<.12);assert.equal(JSON.stringify(k.units),old);island=k.runs[0];
const pivot2=world(island,island.length/2,island.depth/2);assert.ok(Math.hypot(pivot[0]-pivot2[0],pivot[1]-pivot2[1])<.01);
const atDrawer=world(island,islandDrawer.u+20,22);go(atDrawer);assert.equal(kit.getState().selected.id,islandDrawer.id);assert.ok(!svg.innerHTML.includes('NaN'));
const aCorner=()=>{const b=kitchenGeometry(k,r).units.find(u=>u.id===islandDrawer.id).rect;return [[b.x+.4,b.z+.4],[b.x+b.w-.4,b.z+.4],[b.x+.4,b.z+b.d-.4]].find(q=>{const l=kitchenRunLocal(r,island,{x:q[0],z:q[1]});return l.u<islandDrawer.u||l.u>islandDrawer.u+islandDrawer.width||l.d<0||l.d>island.depth;});};
go(aCorner());assert.notEqual(kit.getState().selected?.id,islandDrawer.id,'empty corner of a rotated AABB is not a module');
kit.selectUnit(islandDrawer.id);const ue=islandDrawer.u+islandDrawer.width;go(world(island,ue,31),world(island,ue+5,31),new N('[data-k-handle]',{kHandle:'width',kOwner:islandDrawer.id}));assert.equal(byId(islandDrawer.id).width,47);
const beforeMoveU=byId(islandDrawer.id).u;go(world(island,beforeMoveU+15,18),world(island,beforeMoveU+23,18),new N('[data-k-id]',{kId:islandDrawer.id,kKind:'unit'}));assert.equal(byId(islandDrawer.id).u,beforeMoveU+8);
btn({kTool:'test'});go(world(island,byId(islandDrawer.id).u+10,18));assert(kit.getState().testOpenIds.includes(islandDrawer.id));assert.match(svg.innerHTML,/<polygon[^>]*data-k-open=/);
btn({kView:'volume'});assert.match(kit.exportSvg(),/data-kitchen-3d-part/);
btn({kView:'top'});kit.selectUnit(islandDrawer.id);btn({kAct:'parent-run'});
const active=k.runs[0],center=world(active,active.length/2,active.depth/2),numForm={dataset:{kForm:'run'},closest:()=>numForm,querySelectorAll:()=>Object.entries({centerX:center[0],centerZ:center[1],angle:55,length:active.length,depth:active.depth,height:active.height,bottom:active.bottom}).map(([kField,valueAsNumber])=>({dataset:{kField},valueAsNumber}))};
nodes.get('[data-k-panel-body]').fire('submit',{target:numForm});const numeric=k.runs[0],newCenter=world(numeric,numeric.length/2,numeric.depth/2);assert.ok(Math.abs(numeric.angle-55)<1e-5);assert.ok(Math.hypot(center[0]-newCenter[0],center[1]-newCenter[1])<.001,'numeric rotation uses same pivot as drag handle');
k=updateUnit(k,r,islandDrawer.id,{frontColor:'#26556a',frontFinish:'walnut'}).kitchen;k=updateRun(k,r,numeric.id,{worktopColor:'#84714c',worktopFinish:'oak'}).kitchen;kit.refresh();const appearance=kit.exportSvg();assert.match(appearance,/data-k-front-color="#26556a"/);assert.match(appearance,/data-k-worktop-color="#84714c"/);assert.match(appearance,/pattern id="kitstudio[0-9]+-mat-wood/);assert.ok(!appearance.includes('island-rotate'));
// Oriented kitchen journeys. The DOM harness has an identity screen CTM;
// world coordinates are NEVER treated as pixels here. Each event is aimed
// using the *real* room projection at the correct floor, wall, countertop or
// authored handle plane. Actual cabinet hits go through renderer occlusion.
const volumeScene=()=>{const {yaw,pitch}=kit.getState();return renderKitchenRoom(p,{kitchen:shownKitchen(),yaw,pitch,mode:'cutaway',prefix:'gesture-qa'});};
const projected=(x,y,z,scene=volumeScene())=>{const q=scene.projection.project(x,y,z);return [q.x,q.y];};
const atLevel=(xz,height,scene=volumeScene())=>projected(xz[0],r.height-height,xz[1],scene);
const closeTo=(a,b,tolerance=.24)=>assert(Math.abs(a-b)<tolerance,`expected ${a} to be within ${tolerance} of ${b}`);
const nearMove=(v,u,d)=>{const q=kitchenRunPoint(r,v,u,d);return [q.x,q.z];};
const stableCam=()=>{const s=kit.getState();return {yaw:s.yaw,pitch:s.pitch};};
const volumeTool=t=>{btn({kTool:t});assert.equal(kit.getState().view,'volume','selecting '+t+' must not change projection');assert.equal(kit.getState().tool,t);};
const findHandle=type=>{
  const tags=Array.from(svg.innerHTML.matchAll(/<[^<>]*\bdata-k-handle="[^"]+"[^<>]*>/g),m=>m[0]);
  const tag=tags.find(t=>t.includes('data-k-handle="'+type+'"'));assert(tag,'Missing visible 3D handle: '+type);
  const val=name=>tag.match(new RegExp('data-k-'+name+'="([^"]+)"'))?.[1];
  const xyz=['x','y','z'].map(n=>Number(val(n)));assert(xyz.every(Number.isFinite),'Missing world coordinates on '+tag);
  return {xyz,target:new N('[data-k-handle]',{kHandle:type,kOwner:val('owner'),kX:String(xyz[0]),kY:String(xyz[1]),kZ:String(xyz[2])})};
};
const withFrame=()=>{if(frame){const fn=frame;frame=null;fn();}};
const gesture3=(a,b,target=svg,previewMarker=null)=>{
  const count=commits,base=k;send('pointerdown',a,target);send('pointermove',b,target);withFrame();
  assert.equal(k,base,'movement must be a preview');assert.equal(commits,count);
  if(previewMarker)assert.match(svg.innerHTML,previewMarker);
  send('pointerup',b,target);assert.equal(commits,count+1,'one commit per completed object edit');
  assert.equal(kit.getState().view,'volume');
};
const visibleUnitPoint=id=>{
  const v=volumeScene(),u=v.geometry.units.find(q=>q.id===id),rr=v.geometry.runs.find(q=>q.id===u.runId);
  for(const [height,d] of [[u.bottom+u.height+(u.tier==='base'?4:0),u.depth*.55],[u.bottom+u.height*.65,u.depth+.2],[u.bottom+u.height*.30,u.depth+.2]]){
    for(const frac of [.5,.25,.75]){
      const q=atLevel(nearMove(rr,u.u+u.width*frac,d),height,v),hit=v.hitTest(...q);
      if(hit&&((hit.part==='module'&&hit.id===id)||(hit.part==='worktop'&&hit.unitId===id)))return {q,hit};
    }
  }
  assert.fail('No actually visible cabinet face found: '+id);
};
btn({kAct:'empty-kitchen'});btn({kAct:'replace'});btn({kTool:'run'});btn({kView:'volume'});
assert.equal(kit.getState().tool,'run','changing camera does not deactivate the run tool');
btn({kAct:'home'});const baseCam=stableCam();assert.equal(kit.getState().orbit,false);
volumeTool('run');choose('run-placement','wall');choose('tier','base');
// Back wall elevation, not floor x/z. This also ensures the software doesn't
// mistake a projection of the far wall for the nearer perpendicular wall.
let sc=volumeScene();const wallStart=projected(22,75,0,sc),wallEnd=projected(280,75,0,sc);
gesture3(wallStart,wallEnd,svg,/data-k-draft="valid"/);assert.equal(k.runs.length,1);assert.equal(k.runs[0].wall,'back');
closeTo(k.runs[0].start,22);closeTo(k.runs[0].end,280);assert.deepEqual(stableCam(),baseCam);
volumeTool('feature');choose('feature','window');sc=volumeScene();
const winClick=projected(165,75,0,sc);go(winClick);assert.equal(k.features.length,1);
assert.equal(k.features[0].kind,'window');assert.equal(k.features[0].wall,'back');
closeTo(k.features[0].u+k.features[0].width/2,165);assert.deepEqual(stableCam(),baseCam);
volumeTool('select');const oldWindow=k.features[0];sc=volumeScene();
let fixtureGrab=null;
for(const fx of [.5,.25,.02,.97]){
  const point=projected(oldWindow.u+oldWindow.width*fx,r.height-oldWindow.bottom-oldWindow.height*.48,.35,sc),h=sc.hitTest(...point);
  if(h?.part==='fixture'&&h.id===oldWindow.id){fixtureGrab={point,h};break;}
}
assert(fixtureGrab,'Window must have a physically visible hit surface');
const fw=fixtureGrab.h.world;
gesture3(fixtureGrab.point,projected(fw.x+14,fw.y-7,fw.z,sc));
assert.equal(k.features[0].wall,'back');closeTo(k.features[0].u,oldWindow.u+14);closeTo(k.features[0].bottom,oldWindow.bottom+7);assert.deepEqual(stableCam(),baseCam);
volumeTool('run');choose('run-placement','free');choose('island-depth',42);
sc=volumeScene();const f1=[96,179],f2=[232,150];
gesture3(atLevel(f1,0,sc),atLevel(f2,0,sc),svg,/data-k-draft="valid"/);let island3=k.runs.find(q=>q.placement==='free');assert(island3);
closeTo(island3.x,f1[0]);closeTo(island3.z,f1[1]);closeTo(island3.length,Math.hypot(136,29));assert.deepEqual(stableCam(),baseCam);
assert.equal(kit.getState().selected?.id,island3.id);

// New islands are populated on release. Place a custom drawer on the existing physical counter.
btn({kAct:'add-in-run'});assert.equal(kit.getState().tool,'unit');assert.equal(kit.getState().view,'volume');
choose('unit','drawers');choose('width',42);const desiredU=15;
const emptySpot=atLevel(nearMove(island3,desiredU+21,22),island3.bottom+island3.height+4);
go(emptySpot);assert.equal(k.units.filter(u=>u.fillRole!=='auto').length,1,'placing in a generated 3D run creates one fixed drawer');
let module=k.units.find(u=>u.kind==='drawers');assert.equal(module.runId,island3.id);closeTo(module.u,desiredU);assert.equal(module.width,42);
// A collision under the pointer does not silently shift the new unit into a
// different run or gap, even though there is free space elsewhere.
const savedOccupied=k,beforeOccupied=commits;const occupiedPoint=visibleUnitPoint(module.id).q;go(occupiedPoint);
assert.equal(k,savedOccupied);assert.equal(commits,beforeOccupied);assert.equal(kit.getState().view,'volume');
volumeTool('select');let hit=visibleUnitPoint(module.id),vScene=volumeScene();
const axis0=kitchenRunPoint(r,island3,0,0),axisDelta=kitchenRunPoint(r,island3,11,0);
const goal=projected(hit.hit.world.x+axisDelta.x-axis0.x,hit.hit.world.y,hit.hit.world.z+axisDelta.z-axis0.z,vScene);
gesture3(hit.q,goal);assert.deepEqual(stableCam(),baseCam,'object drag must not rotate the camera');
assert(byId(module.id));closeTo(byId(module.id).u,module.u+11);
kit.selectUnit(module.id);const widthHandle=findHandle('width'),pa=widthHandle.xyz,q10=kitchenRunPoint(r,island3,10,0);
vScene=volumeScene();gesture3(projected(...pa,vScene),projected(pa[0]+q10.x-axis0.x,pa[1],pa[2]+q10.z-axis0.z,vScene),widthHandle.target);
closeTo(byId(module.id).width,52);assert.deepEqual(stableCam(),baseCam);
btn({kAct:'parent-run'});assert.equal(kit.getState().selected?.id,island3.id);assert.equal(kit.getState().view,'volume');
let h3=findHandle('island-move'),oldUnits=JSON.stringify(k.units);vScene=volumeScene();
gesture3(projected(...h3.xyz,vScene),projected(h3.xyz[0]+12,h3.xyz[1],h3.xyz[2]-6,vScene),h3.target);
closeTo(k.runs.find(q=>q.id===island3.id).x,island3.x+12);closeTo(k.runs.find(q=>q.id===island3.id).z,island3.z-6);assert.equal(JSON.stringify(k.units),oldUnits);
island3=k.runs.find(q=>q.id===island3.id);h3=findHandle('island-rotate');vScene=volumeScene();
const mid3=nearMove(island3,island3.length/2,island3.depth/2),vector=[h3.xyz[0]-mid3[0],h3.xyz[2]-mid3[1]],theta=.43;
const turned=[mid3[0]+vector[0]*Math.cos(theta)-vector[1]*Math.sin(theta),h3.xyz[1],mid3[1]+vector[0]*Math.sin(theta)+vector[1]*Math.cos(theta)];
gesture3(projected(...h3.xyz,vScene),projected(...turned,vScene),h3.target);
const island4=k.runs.find(q=>q.id===island3.id);closeTo((island4.angle-island3.angle+360)%360,theta*180/Math.PI);
const mid4=nearMove(island4,island4.length/2,island4.depth/2);closeTo(mid4[0],mid3[0]);closeTo(mid4[1],mid3[1]);assert.equal(JSON.stringify(k.units),oldUnits);
assert.deepEqual(stableCam(),baseCam);assert.equal(kit.getState().view,'volume');

// Deliberate orbit over a cabinet changes camera only; selecting again
// edits what is visibly under the cursor. Test tools must not require top.
volumeTool('select');btn({kAct:'orbit'});assert(kit.getState().orbit);const beforeOrbit=k,countOrbit=commits;
const oq=visibleUnitPoint(module.id).q;go(oq,[oq[0]+55,oq[1]+11]);
assert.notDeepEqual(stableCam(),baseCam);assert.equal(k,beforeOrbit);assert.equal(commits,countOrbit);
volumeTool('test');assert.equal(kit.getState().orbit,false);let pt=visibleUnitPoint(module.id).q;go(pt);
assert(kit.getState().testOpenIds.includes(module.id));assert.equal(kit.getState().view,'volume');
btn({kAct:'home'});volumeTool('select');kit.selectUnit(module.id);btn({kAct:'interior'});
assert.equal(edits.at(-1),module.id);assert.equal(kit.getState().view,'volume');
const export3=kit.exportSvg();assert.match(export3,/data-kitchen-3d-part/);assert(!export3.includes('data-k-handle'));
// Open both real objects directly, including the second pick AFTER the first
// open door has changed visible geometry. Apply the computed fix in the
// current perspective and retain both open states and the same camera.
k=createKitchen(p,'demo');kit.refresh();assert.equal(kit.getState().view,'volume');volumeTool('test');
const testCam=stableCam();
for(const id of ['unit-dishwasher','unit-drawers']){
  const q=visibleUnitPoint(id).q,previous=commits;go(q);
  assert.equal(commits,previous);assert(kit.getState().testOpenIds.includes(id));assert.deepEqual(stableCam(),testCam);
}
const in3D=kitchenGeometry(shownKitchen(),r).conflicts.find(q=>q.type==='open-open');
assert(in3D);assert.match(nodes.get('[data-k-panel-body]').innerHTML,/data-k-fix/);btn({kFix:in3D.id});
assert.equal(kit.getState().tool,'select');assert(k.units.filter(u=>in3D.ids.includes(u.id)).every(u=>!u.open));
assert.equal(kit.getState().view,'volume');assert.deepEqual(stableCam(),testCam);
kit.selectUnit('unit-storage');const priorInspect=k,inspections=commits,doorFace=/data-kitchen-3d-id="unit-storage"[^>]*data-kitchen-face="door-front"/;
assert.match(kit.exportSvg(),doorFace);btn({kAct:'inspect-interior'});
assert(!doorFace.test(kit.exportSvg()));assert.match(kit.exportSvg(),/data-kitchen-3d-id="unit-storage"/);
assert.deepEqual(stableCam(),testCam);assert.equal(k,priorInspect);assert.equal(commits,inspections);
btn({kAct:'inspect-interior'});assert.match(kit.exportSvg(),doorFace);
// Same x/z, two independent heights: the upper storage cabinet and lower
// drawers deliberately overlap in elevation projection and have distinct IDs.
let stack=createKitchen(p,'empty');
const addOk=x=>{assert.ok(x.ok,x.reason);stack=x.kitchen;};
addOk(addRun(stack,r,{id:'base-row',wall:'back',tier:'base',start:45,end:210}));
addOk(addRun(stack,r,{id:'upper-row',wall:'back',tier:'upper',start:45,end:210}));
addOk(addUnit(stack,r,{id:'low-drawers',runId:'base-row',kind:'drawers',u:70,width:90}));
addOk(addUnit(stack,r,{id:'high-doors',runId:'upper-row',kind:'storage',u:70,width:90}));
addOk(addFeature(stack,r,{id:'fixed-drain',wall:'right',kind:'drain',u:140}));
const resumeDemo=k;k=stack;kit.refresh(true);btn({kView:'top'});btn({kTool:'test'});
const upper='high-doors',lower='low-drawers',open=id=>shownKitchen().units.find(u=>u.id===id).open;
const shared=[115,18];assert.equal(kit.getState().layer,'all');go(shared);assert.ok(open(upper));assert.equal(open(lower),false);
const up=()=>kitchenGeometry(shownKitchen(),r).units.find(v=>v.id===upper);
assert.equal(up().openParts.length,2);assert.equal((svg.innerHTML.match(/data-k-open="high-doors"/g)||[]).length,2);
choose('test-layer','upper');const unchangedMiddle=k;go([115,53]);assert.equal(k,unchangedMiddle,'the empty space BETWEEN open leaves cannot close the unit');
for(const index of [0,1]){const leaf=up().openParts[index],verts=leaf.polygon,spot=[verts.reduce((n,p)=>n+p.x,0)/verts.length,verts.reduce((n,p)=>n+p.z,0)/verts.length];
 const beforeLeaf=commits;go(spot);assert.equal(commits,beforeLeaf);assert.equal(open(upper),false);assert.ok(!open(lower));go(shared);assert.ok(open(upper));}
go(shared);assert.equal(open(upper),false,'cabinet body can also close the upper doors');
choose('test-layer','base');go(shared);assert.ok(open(lower));assert.equal(open(upper),false);go(shared);assert.equal(open(lower),false);
btn({kView:'volume'});volumeTool('test');assert.equal(kit.getState().layer,'all');assert(!svg.innerHTML.includes('data-k-empty-run'));assert(!svg.innerHTML.includes('data-k-v-run='));
const sourceRef=k;
function visibleCabPart(id,want){const v=volumeScene(),u=v.geometry.units.find(x=>x.id===id),parts=[u,...u.openParts],proj=[];
 for(const part of parts)for(const p of part.polygon)for(const h of [part.bottom,part.bottom+part.height])proj.push(v.projection.project(p.x,r.height-h,p.z));
 const xs=proj.map(p=>p.x),ys=proj.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 for(let j=0;j<53;j++)for(let i=0;i<61;i++){const x=x0+(i+.5)*(x1-x0)/61,y=y0+(j+.5)*(y1-y0)/53,h=v.hitTest(x,y);
 if(h?.part==='module'&&h.id===id&&want(h))return [x,y];}assert.fail('no visible material of requested role in '+id);}
const closedFront=()=>visibleCabPart(upper,h=>['door-front','recessed-panel'].includes(h.tag));
choose('test-layer','base');go(closedFront());assert.equal(k,sourceRef,'a visible upper cabinet must not pass the click through to a lower unit');
choose('test-layer','upper');go(closedFront());assert.ok(open(upper));assert.equal(open(lower),false);
const openLeaf=visibleCabPart(upper,h=>h.tag?.startsWith('open-hinged'));go(openLeaf);assert.equal(open(upper),false,'clicking the physical open leaf closes it');
go(closedFront());assert.ok(open(upper));
const backOrShelf=visibleCabPart(upper,h=>/inside|interior|shelf|back/.test(h.tag||'')&&!h.leafId);go(backOrShelf);assert.equal(open(upper),false,'the visible inside also belongs to this cabinet');
choose('test-layer','base');go(visibleUnitPoint(lower).q);assert.ok(open(lower));assert.equal(open(upper),false);go(visibleUnitPoint(lower).q);assert.equal(open(lower),false);
const noChange=k;go(projected(300,110,0));assert.equal(k,noChange,'bare wall/virtual empty rows are not doors');
btn({kView:'top'});const ft=kitchenGeometry(k,r).features[0].rect;go([ft.x+ft.w/2,ft.z+ft.d/2],undefined,new N('[data-k-id]',{kId:'fixed-drain',kKind:'feature'}));assert.equal(k,noChange,'fixed hookup has no door action');
k=resumeDemo;kit.refresh(true);btn({kView:'volume'});btn({kTool:'select'});
// Pure hover is a separate SVG layer. Its body uses the real proposed dimensions,
// never becomes hit-testable, and never inserts a feature or creates an undo step.
{const beforePreviewSuite=k;k=createKitchen(p,'empty');kit.refresh(true);btn({kView:'top'});btn({kTool:'feature'});choose('feature','window');
const previewLayer=nodes.get('[data-k-preview-layer]'),badge=nodes.get('[data-k-preview-note]');
const hover=(x,z)=>{svg.fire('pointermove',{target:svg,clientX:x,clientY:z,pointerType:'mouse',isPrimary:true,buttons:0});withFrame();};
const cleanGhost=()=>{assert.equal(previewLayer.innerHTML,'');assert.equal(badge.hidden,true);};
let startCommits=commits;hover(86,1);assert.match(previewLayer.innerHTML,/data-k-proposal="valid" data-k-proposal-kind="window"/);assert.ok(!badge.hidden);assert.equal(commits,startCommits);
go([86,1]);const firstWindow=k.features[0];assert.equal(commits,startCommits+1);cleanGhost();
const frozen=k,rejectionsAtHover=rejects.length;hover(86,1);assert.match(previewLayer.innerHTML,/data-k-proposal="blocked"/);assert.match(badge.textContent,/نافذة/);assert.equal(k,frozen);assert.equal(rejects.length,rejectionsAtHover);assert.ok(!kit.exportSvg().includes('data-k-proposal'));
svg.fire('pointerleave');cleanGhost();go([86,1]);assert.equal(k,frozen);assert.equal(commits,startCommits+1);assert.equal(rejects.length,rejectionsAtHover+1);assert.match(rejects.at(-1),/^لم يُعتمد التغيير:/);cleanGhost();
hover(264,1);assert.match(previewLayer.innerHTML,/data-k-proposal="valid"/);go([264,1]);assert.equal(k.features.length,2);const secondWindow=k.features[1];
const beforeDragWin=k;btn({kTool:'select'});const f1=new N('[data-k-id]',{kId:firstWindow.id,kKind:'feature'});
send('pointerdown',[86,0],f1);send('pointermove',[264,0],f1);withFrame();assert.match(previewLayer.innerHTML,/data-k-proposal="blocked"/);send('pointerup',[264,0],f1);assert.equal(k,beforeDragWin);cleanGhost();
assert.ok(kit.inspectItem('feature',firstWindow.id));assert.equal(kit.getState().selected.id,firstWindow.id);
assert.ok(kit.inspectItem('feature',secondWindow.id));assert.equal(kit.getState().selected.id,secondWindow.id);assert.equal(kit.inspectItem('feature','missing-feature'),false);assert.equal(k,beforeDragWin);
const featureForm={dataset:{kForm:'site-feature'},closest:()=>featureForm,querySelectorAll:()=>Object.entries({u:firstWindow.u*10,width:firstWindow.width*10,bottom:firstWindow.bottom*10,height:firstWindow.height*10}).map(([kField,valueAsNumber])=>({dataset:{kField},valueAsNumber}))};
nodes.get('[data-k-panel-body]').fire('submit',{target:featureForm});assert.equal(k,beforeDragWin,'numeric feature coordinates share the collision guard');assert.match(previewLayer.innerHTML,/data-k-proposal="blocked"/);
btn({kAct:'close'});cleanGhost();btn({kView:'volume'});btn({kAct:'home'});btn({kTool:'feature'});choose('feature','window');
const winP=projected(firstWindow.u+firstWindow.width/2,r.height-firstWindow.bottom-firstWindow.height/2,2);
hover(...winP);assert.match(previewLayer.innerHTML,/data-k-proposal="blocked" data-k-proposal-kind="window"/,'an actual existing window blocks another window at the same elevation in 3D');assert.match(previewLayer.innerHTML,/<polygon/);const poseBefore=kit.getState();go(winP);assert.equal(k,beforeDragWin);assert.equal(kit.getState().yaw,poseBefore.yaw);cleanGhost();
const validHigh=projected(175,242,0);hover(...validHigh);assert.match(previewLayer.innerHTML,/data-k-proposal="valid"/);svg.fire('pointercancel',{pointerId:9});cleanGhost();
const badBefore=commits;choose('feature','door');hover(...winP);assert.match(previewLayer.innerHTML,/data-k-proposal="blocked" data-k-proposal-kind="door"/);go(winP);assert.equal(commits,badBefore);cleanGhost();
// Two literally co-located saved openings can each be reached by ID, with no mutation.
const legacy={...beforeDragWin,features:[firstWindow,{...secondWindow,u:firstWindow.u,bottom:firstWindow.bottom}]};
k=legacy;kit.refresh(true);btn({kView:'top'});for(const item of legacy.features){assert.ok(kit.inspectItem('feature',item.id));assert.equal(kit.getState().selected.id,item.id);assert.ok(svg.innerHTML.includes('data-k-inspect-ref="'+item.id+'"'));assert.equal(k,legacy);}
// The same actual vertical window also blocks a cabinet UPDATE. A drawn upper
// row reserves space but has no material until its unit enters the opening.
let blockedKitchen=createKitchen(p,'empty');const put=o=>{assert.ok(o.ok,o.reason);blockedKitchen=o.kitchen;};
put(addRun(blockedKitchen,r,{id:'upper-with-gap',wall:'back',tier:'upper',start:20,end:300}));
put(addUnit(blockedKitchen,r,{id:'moving-cabinet',runId:'upper-with-gap',kind:'storage',u:45,width:60}));
put(addFeature(blockedKitchen,r,{id:'upper-window',kind:'window',wall:'back',u:145,width:60,bottom:148,height:45}));
k=blockedKitchen;kit.refresh(true);kit.selectUnit('moving-cabinet');const cabCount=commits,cabTarget=new N('[data-k-id]',{kId:'moving-cabinet',kKind:'unit'});
send('pointerdown',[75,20],cabTarget);send('pointermove',[180,20],cabTarget);withFrame();assert.match(previewLayer.innerHTML,/data-k-proposal="blocked" data-k-proposal-kind="storage"/);send('pointerup',[180,20],cabTarget);assert.equal(k,blockedKitchen);cleanGhost();
const knob=new N('[data-k-handle]',{kHandle:'width',kOwner:'moving-cabinet'});send('pointerdown',[105,23],knob);send('pointermove',[170,23],knob);withFrame();assert.match(previewLayer.innerHTML,/data-k-proposal="blocked"/);send('pointerup',[170,23],knob);assert.equal(k,blockedKitchen);assert.equal(commits,cabCount);
k=beforePreviewSuite;kit.refresh(true);btn({kTool:'select'});}
// The global visual catalog arms the CURRENT editor without writing a model.
// A hood is upper-only, a fridge is floor-standing; the catalog's true depths
// and heights are shared by the ghost, placed geometry and inspector.
{
 const prior=k,priorCamera=stableCam(),historyCount=commits;let fresh=createKitchen(p,'empty');
 for(const tier of ['upper','base']){const res=addRun(fresh,r,{id:'catalog-'+tier,wall:'back',tier,start:5,end:345});assert(res.ok,res.reason);fresh=res.kitchen;}
 k=fresh;kit.refresh();kit.selectView('volume');assert.ok(kit.setCamera({yaw:18,pitch:30}));assert.equal(kit.getState().view,'volume');assert.ok(kit.selectView('top'));
 assert.ok(kit.activateTool('unit',{unitKind:'hood'}));assert.equal(kit.getState().layer,'upper');assert.match(quick.innerHTML,/شفّاط/);assert.equal(commits,historyCount);
 go([192,14]);let g=kitchenGeometry(k,r),hood=g.units.find(u=>u.kind==='hood');assert(hood);assert.equal(hood.tier,'upper');assert.equal(hood.height,60);assert.equal(hood.depth,32);
 assert.ok(kit.activateTool('unit',{unitKind:'fridge'}));assert.equal(kit.getState().layer,'base');go([70,48]);g=kitchenGeometry(k,r);
 const fridge=g.units.find(u=>u.kind==='fridge');assert(fridge);assert.equal(fridge.height,190);assert.equal(fridge.depth,65);assert.equal(fridge.width,90);
 assert.ok(kit.activateTool('unit',{unitKind:'open-shelf',tier:'upper',width:44}));go([287,15]);const openShelf=k.units.find(v=>v.kind==='open-shelf');assert(openShelf);assert(kit.inspectItem('unit',openShelf.id));assert.match(nodes.get('[data-k-panel-body]').innerHTML,/data-k-act="interior"/);btn({kAct:'interior'});assert.equal(edits.at(-1),openShelf.id);
 const stable=k,cam=stableCam(),priorState=kit.getState();assert.equal(kit.activateTool('unit',{unitKind:'unknown-kind'}),false);assert.deepEqual(kit.getState(),priorState);
 assert(kit.activateTool('feature',{featureKind:'water'}));assert.equal(kit.getState().featureKind,'water');assert.equal(k,stable);assert.deepEqual(stableCam(),cam);
 k=prior;kit.refresh();kit.selectView('volume');kit.setCamera(priorCamera);
}
// A plan span uses floor centimetres; a perspective span uses both actual ray
// intersections. Keeping the 3D endpoints avoids lying about foreshortening.
{
 const source=k,committed=commits;kit.selectView('top');assert(kit.activateTool('measure'));
 go([27,223],[57,263]);let measure=kit.getState().measurement;
 closeTo(measure.distance,50,1e-6);closeTo(measure.horizontal,50,1e-6);assert.equal(measure.vertical,0);assert.equal(measure.a.y,r.height);assert.equal(k,source);assert.equal(commits,committed);
 const marks=nodes.get('[data-k-ruler-layer]');assert.match(marks.innerHTML,/data-k-ruler/);assert.ok(!kit.exportSvg().includes('data-k-ruler'));
 kit.selectView('volume');kit.setCamera({yaw:32,pitch:25});let sc=volumeScene(),visibleHit=visibleUnitPoint('unit-drawers'),surface=null;
 for(const pos of [[315,43,0],[18,24,0],[28,23,0],[320,40,0],[20,32,0],[150,16,0]]){const screen=projected(...pos,sc),h=sc.hitTest(...screen);
 if(h?.part==='surface'&&Math.abs(h.world.y-visibleHit.hit.world.y)>5){surface={q:screen,hit:h};break;}}assert.ok(surface,'fixture requires an exposed room wall and a visible cabinet at distinct heights');
 const a=surface.hit.world,b=visibleHit.hit.world,expected=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),flat=Math.hypot(b.x-a.x,b.z-a.z);
 go(surface.q,visibleHit.q);measure=kit.getState().measurement;closeTo(measure.distance,expected,1e-6);closeTo(measure.horizontal,flat,1e-6);closeTo(measure.vertical,Math.abs(b.y-a.y),1e-6);
 assert.ok(measure.distance>measure.horizontal);assert.equal(k,source);assert.equal(commits,committed);
 const marking=marks.innerHTML,persist=JSON.stringify(measure);
 kit.setCamera({yaw:63,pitch:12});assert.notEqual(marks.innerHTML,marking);assert.equal(JSON.stringify(kit.getState().measurement),persist);
 kit.selectView('top');assert.match(marks.innerHTML,/أفقي/,'top projection must not label projected length as the actual diagonal');
 go([38,116],[-400,-400]);assert.equal(JSON.stringify(kit.getState().measurement),persist,'an off-surface release must not record a fabricated endpoint');
 send('pointerdown',[20,20]);send('pointermove',[100,50]);svg.fire('pointercancel',{pointerId:9});assert.equal(JSON.stringify(kit.getState().measurement),persist);
 btn({kAct:'clear-measure'});assert.equal(kit.getState().measurement,null);assert.equal(marks.innerHTML,'');go([30,40],[60,80]);btn({kTool:'select'});assert.equal(kit.getState().measurement,null);
 const occupied=k.runs.find(run=>k.units.some(u=>u.runId===run.id)),item=k.units.find(u=>u.runId===occupied.id),del=nodes.get('[data-k-act="remove"]');
 assert(kit.inspectItem('run',occupied.id));assert.equal(del.disabled,true,'guarded populated run is not offered for deletion');
 const saved=k,count=commits;btn({kAct:'remove'});assert.equal(k,saved);assert.equal(commits,count);
 assert(kit.inspectItem('unit',item.id));assert.equal(del.disabled,false);assert.ok(!nodes.get('[data-k-panel-body]').innerHTML.includes('data-k-act="remove"'),'only the toolbar offers delete');
 btn({kAct:'remove'});assert.equal(commits,count+1);assert(!k.units.some(u=>u.id===item.id));assert.equal(k.units.length,saved.units.length-1);assert.deepEqual(k.runs,saved.runs);assert.equal(del.disabled,true);assert.ok(saved.units.some(u=>u.id===item.id),'previous project snapshot remains undoable');
 k=saved;kit.refresh();kit.selectView('volume');
}
// Run depth is a perpendicular, wall-anchored edit of a row, not a unit-width edit.
{
 const keep=k;let trial=createKitchen(p,'empty');
 const append=o=>{assert(o.ok,o.reason);trial=o.kitchen;};
 append(addRun(trial,r,{id:'grip-low',wall:'back',tier:'base',start:60,end:142,depth:61}));
 append(addRun(trial,r,{id:'grip-high',wall:'back',tier:'upper',start:60,end:142,depth:32}));
 append(addUnit(trial,r,{id:'depth-cabinet',runId:'grip-high',kind:'storage',u:60,width:82}));
 append(addUnit(trial,r,{id:'depth-sink',runId:'grip-low',kind:'sink',u:60,width:82}));
 append(addFeature(trial,r,{id:'low-obstacle',wall:'left',kind:'column',u:r.length-100,width:20,depth:100,bottom:0,height:110}));
 // Left wall starts at z=L and points back. Beam occupies z=50..70, encroaching only when the upper casing grows in depth.
 append(addFeature(trial,r,{id:'grip-obstacle',wall:'left',kind:'beam',u:r.length-70,width:20,depth:100,bottom:155,height:32}));
 k=trial;kit.refresh();kit.selectView('top');assert(kit.inspectItem('run','grip-high'));assert.match(svg.innerHTML,/data-k-handle="run-depth"/);
 const knob=new N('[data-k-handle]',{kOwner:'grip-high',kHandle:'run-depth'}),at=[101,32],count=commits;
 go(at,at,knob);go(at,[121,32],knob);assert.equal(commits,count,'tap or movement along the wall does not change depth');
 // Preview is never a commit. Cancel restores the project, including its undo count, even after a valid preview.
 send('pointerdown',at,knob);send('pointermove',[101,42],knob);withFrame();assert.equal(k,trial);assert.equal(commits,count);
 assert.match(nodes.get('[data-k-preview-layer]').innerHTML,/data-k-proposal="valid"/);svg.fire('pointercancel',{pointerId:9});assert.equal(k,trial);
 go(at,[109,40.8],knob);assert.equal(commits,count+1);
 const dimensions=()=>kitchenGeometry(k,r),check=(value)=>{const d=dimensions(),r1=d.runs.find(v=>v.id==='grip-high'),u=d.units.find(v=>v.id==='depth-cabinet');
   assert.equal(r1.depth,value);assert.equal(u.depth,value);assert.deepEqual([r1.start,r1.end,r1.bottom,r1.height],[60,142,145,70]);assert.equal(d.runs.find(v=>v.id==='grip-low').depth,61);assert.equal(u.rect.z,0);};
 check(40.8);const unchanged=k;const z=40.8;
 send('pointerdown',[101,z],knob);send('pointermove',[101,59],knob);withFrame();assert.match(nodes.get('[data-k-preview-layer]').innerHTML,/data-k-proposal="blocked"/);send('pointerup',[101,59],knob);
 assert.equal(k,unchanged);assert.equal(commits,count+1,'failed collision adds no undo entry');
 kit.selectView('volume');kit.setCamera({yaw:30,pitch:26});const sc=volumeScene(),h=findHandle('run-depth'),[x,y,Z]=h.xyz;
 gesture3(projected(x,y,Z,sc),projected(x,y,Z-10,sc),h.target);check(30.8);
 assert.ok(!kit.exportSvg().includes('data-k-handle'));assert.equal(commits,count+2);
 // A wall-mounted base row must place its grip above a real counter span. A
 // lower casing/sink and its hole follow the exact drag; the upper row does not.
 kit.selectView('top');kit.inspectItem('run','grip-low');
 choose('layer','upper');assert.doesNotMatch(svg.innerHTML,/data-k-handle="run-depth"/);
 choose('layer','base');assert.match(svg.innerHTML,/اسحب لتغيير عمق الصف السفلي/);
 const lowGrip=new N('[data-k-handle]',{kOwner:'grip-low',kHandle:'run-depth'}),lowAt=[101,61];
 const baseFront=()=>dimensions().runs.find(v=>v.id==='grip-low'),sink=()=>dimensions().units.find(v=>v.id==='depth-sink'),top=()=>dimensions().worktops.find(t=>t.runId==='grip-low'),bodyDepth=()=>dimensions().runs.find(v=>v.id==='grip-high').depth;
 const oldCut=sink().cutout.offset,lowBefore=k;
 go(lowAt,[101,68.2],lowGrip);assert.equal(baseFront().depth,68.2);assert.equal(sink().depth,68.2);assert.equal(top().depth,68.2);assert(sink().cutout.offset>oldCut);assert.equal(commits,count+3);assert.equal(bodyDepth(),30.8);assert.equal(lowBefore.runs.find(v=>v.id==='grip-low').depth,61);
 assert.match(status.textContent,/السفلي/);assert.deepEqual([baseFront().start,baseFront().end,baseFront().bottom],[60,142,0]);
 const lowSafe=k;send('pointerdown',[101,68.2],lowGrip);send('pointermove',[101,83],lowGrip);withFrame();assert.match(nodes.get('[data-k-preview-layer]').innerHTML,/data-k-proposal="blocked"/);send('pointerup',[101,83],lowGrip);assert.equal(k,lowSafe);assert.equal(commits,count+3);
 kit.selectView('volume');kit.setCamera({yaw:29,pitch:20});const lowerScene=volumeScene(),kn=findHandle('run-depth'),[lx,ly,lz]=kn.xyz;
 closeTo(ly,r.height-top().bottom-top().height-.25,.001);assert.equal(kn.target.dataset.kOwner,'grip-low');assert.match(svg.innerHTML,/اسحب لتغيير عمق الصف السفلي/);
 gesture3(projected(lx,ly,lz,lowerScene),projected(lx,ly,lz-12.6,lowerScene),kn.target);assert.equal(sink().depth,55.6);assert.equal(top().depth,55.6);assert.equal(bodyDepth(),30.8);assert.equal(commits,count+4);
 choose('layer','upper');assert.doesNotMatch(svg.innerHTML,/data-k-handle="run-depth"/);choose('layer','all');
 k=keep;kit.refresh();
}
const returningId='unit-drawers';kit.selectUnit(returningId);btn({kAct:'interior'});assert.equal(edits.at(-1),returningId);
// A change to project defaults reaches mouse drawing and the unit placement
// controller on refresh; it must not reinterpret the preceding run.
{
 const originalDoc=k; const configure=(code,property,type,value,unit='')=>{const out=setProjectDefault(activeProfileRoom||r,{code,property,type,value,unit});assert(out.ok,out.reason);activeProfileRoom=out.room;};
 k=createKitchen(p,'empty');configure('CAT-03','عمق الصف السفلي','number',720,'مم');
 configure('CAT-17','خامة سطح العمل الجديد','choice','quartz-snow');configure('CAT-06','خامة واجهة الوحدة الجديدة','choice','walnut');
 configure('CAT-03','ارتفاع جسم الصف السفلي','number',890,'مم');configure('CAT-08','شكل واجهة الوحدة الجديدة','choice','fluted');configure('CAT-12','مقبض الوحدة الجديدة','choice','knob');
 kit.refresh();kit.selectView('top');btn({kTool:'run'});choose('run-placement','wall');choose('tier','base');
 go([36,1],[193,1]);assert(k.units.length>0&&k.units.every(u=>u.fillRole==='auto'&&u.frontFinish==='walnut'&&u.frontStyle==='fluted'&&u.handleStyle==='knob'));assert.equal(k.runs[0].depth,72);assert.equal(k.runs[0].worktopFinish,'quartz-snow');
 btn({kTool:'unit'});choose('unit-tier','base');choose('unit','storage');choose('width',48);go([85,45]);assert.equal(k.units[0].frontFinish,'walnut');assert.equal(k.runs[0].height,89);assert.equal(k.units[0].frontStyle,'fluted');assert.equal(k.units[0].handleStyle,'knob');
 configure('CAT-03','عمق الصف السفلي','number',580,'مم');kit.refresh();btn({kTool:'run'});go([219,1],[318,1]);assert.equal(k.runs[0].depth,72);assert.equal(k.runs[1].depth,58);
 go([36,1]); // tap never resizes the already committed row
 k=originalDoc;activeProfileRoom=null;
}
// Existing authored rows opt in; no control rewrites the project until applied.
// Select a generated unit through the proportional strip, customize its type
// and width atomically, reserve/open a location and restore it deliberately.
{
 const keep=k,manual=addRun(createKitchen(p,'empty'),r,{wall:'back',tier:'base',start:15,end:255});
 assert(manual.ok);const row=manual.id,anchor=addUnit(manual.kitchen,r,{kind:'sink',runId:row,u:15,width:60});assert(anchor.ok);
 k=anchor.kitchen;kit.refresh();kit.selectView('top');assert(kit.inspectItem('run',row));
 const body=nodes.get('[data-k-panel-body]');assert.match(body.innerHTML,/تعبئة الصف/);assert(!k.runs[0].autoFill);
 btn({kAct:'fill-row'});assert(k.runs[0].autoFill);assert.equal(byId(anchor.id).u,15);assert(k.units.some(u=>u.fillRole==='auto'));
 const middle=k.units.filter(u=>u.fillRole==='auto').sort((a,b)=>a.u-b.u)[1];assert(middle);
 btn({kRowUnit:middle.id});assert.equal(kit.getState().selected.id,middle.id);assert.match(body.innerHTML,/حفظ التخصيص/);assert.match(body.innerHTML,/data-k-fill-state="auto"/);
 const form=(type,u,w)=>{const f={dataset:{kForm:'unit'},closest:()=>f,querySelectorAll:()=>[['u',u],['width',w]].map(([kField,valueAsNumber])=>({dataset:{kField},valueAsNumber})),elements:{namedItem:n=>n==='fillKind'?{value:type}:null}};body.fire('submit',{target:f});};
 const startOfRow=k.runs.find(x=>x.id===row).start,offset=middle.u-startOfRow;assert.equal(startOfRow,15);assert(body.innerHTML.includes('من بداية الصف (سم)'));assert.match(body.innerHTML,new RegExp('name="u"[^>]+value="'+offset+'"'));const before=commits;form('drawers',offset,72);assert.equal(commits,before+1);assert.equal(byId(middle.id).u,startOfRow+offset,'converts from row-relative once and retains the same site position');assert.equal(byId(middle.id).width,72);assert.equal(byId(middle.id).kind,'drawers');assert.equal(byId(middle.id).fillRole,'fixed');assert.equal(byId(anchor.id).width,60);assert.match(body.innerHTML,/data-k-fill-state="fixed"/);
 const baseline=k;form('drawers',30,72);assert.equal(k,baseline,'fixed sink overlap is rejected rather than moving it');assert.match(nodes.get('[data-k-fill-error]').textContent,/./);
 btn({kAct:'release-fill'});assert(k.units.some(u=>u.fillRole==='auto'));assert.equal(byId(anchor.id).u,15);
 const flex=k.units.find(u=>u.fillRole==='auto');btn({kRowUnit:flex.id});btn({kAct:'pin-fill'});assert.equal(byId(flex.id).fillRole,'fixed');btn({kAct:'remove'});assert(!byId(flex.id));assert(k.runs[0].fillGaps.some(g=>g.u===flex.u));
 kit.inspectItem('run',row);assert.match(body.innerHTML,/إعادة تعبئة الفراغات المحجوزة/);btn({kAct:'restore-fill'});assert(!k.runs[0].fillGaps?.length);assert.equal(byId(anchor.id).u,15);assert.equal(k.units.reduce((s,u)=>s+u.width,0),240);
 kit.inspectItem('run',row);const del=nodes.get('[data-k-act="remove"]');assert(del.disabled,'a fixed sink guards the whole row');
 const another=addRun(k,r,{wall:'front',tier:'base',start:5,end:130,autoFill:true});assert(another.ok);k=another.kitchen;kit.refresh();assert(kit.inspectItem('run',another.id));assert.equal(del.disabled,false,'an uncustomized row can be removed in one action');
 const beforeRemove=k;btn({kAct:'remove'});assert(k.runs.some(x=>x.id===row));assert(!k.runs.some(x=>x.id===another.id));assert(!k.units.some(x=>x.runId===another.id));assert(beforeRemove.units.some(x=>x.runId===another.id),'original undo frame retains generated cabinets');
 k=keep;kit.refresh();
}

kit.destroy();
// The navigation adapter re-mounts this workspace and then focuses the
// returning unit. Focusing it must not discard the restored projection.
const returnedPose={view:'volume',yaw:143.25,pitch:38.5},beforeReturn=k;
let currentRoomPlan=p;const restoredKit=mountKitchenView(host,{getPlan:()=>currentRoomPlan,getKitchen:()=>k,initialViewport:returnedPose,onCommit(){assert.fail('Returning from an editor must not modify the kitchen');}});
restoredKit.refresh(true);assert(restoredKit.selectUnit(returningId,{open:true}));
const restoredState=restoredKit.getState();for(const [key,value] of Object.entries(returnedPose))assert.equal(restoredState[key],value);
assert.equal(restoredState.selected.id,returningId);assert.equal(k,beforeReturn);
restoredKit.selectView('top');currentRoomPlan={...p,kitchenSurfaces:{floor:'marble'}};restoredKit.refresh();assert.match(svg.innerHTML,/data-k-floor="marble"/);
currentRoomPlan={...currentRoomPlan,kitchenSurfaces:{floor:'stone'}};restoredKit.refresh();assert.match(svg.innerHTML,/data-k-floor="stone"/,'room finishes update the drawing immediately even when the kitchen and all dimensions are identical');
restoredKit.destroy();
console.log('Kitchen workspace: top and projected 3D edits, wall/window and island drawing, occupied vs free insertion, moving/resizing on a local axis, island pivot, explicit orbit, upper/lower selection, separate hinged leaves and hits on visible cabinet interiors, interior entry, live legal/blocked placement, protected edits, legacy selection by ID, catalog tier and true dimensions, room finish redraw, physical 3D and plan measurement and singular undoable deletion, automatic row creation, anchored editing, conflict rejection, release and reserved-space restoration passed.');

// The same factory unit must produce the same whole-project transaction from
// CAD inspector and grip as from the proposal desk, including save and undo.
const {makeChainExample,readChainRange}=await import('../public/kitchen-chain-model.js');
const {planWorkshopRow}=await import('../public/kitchen-production-row.js');
const {seedCatalog,buildFactoryQuote}=await import('../public/kitchen-workshop-factory.js');
const {previewKitchenWidthChange}=await import('../public/kitchen-proposal-change.js');
const {scenePlan,commitProject,restoreProject,undoProject,kitchenHistory}=await import('../public/kitchen-project.js');
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
globalThis.localStorage=storage();globalThis.sessionStorage=storage();
const visit=makeChainExample(),catalog=seedCatalog();catalog.approved=true;
for(const item of catalog.items)item.price=item.kind==='panel'?100:10;
Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
visit.room.workshop.catalog=catalog;
const savedRow=planWorkshopRow(visit,{...readChainRange(visit,'back'),tier:'base',wanted:{sink:true,rice:true,dishwasher:true},riceMode:'bags'});
assert(savedRow.ok,savedRow.reason);
let project=savedRow.doc,rejectNextSave=false;
const owner=project.kitchen.runs[0],rice=project.room.workshop.rows[owner.id].units[0],baseQuote=buildFactoryQuote(project);
const getPlan=()=>scenePlan(project.room,project.kitchen);
const cad=mountKitchenView(host,{getPlan,getKitchen:()=>project.kitchen,getRoom:()=>project.room,getProject:()=>project,
 onCommitProject:(next)=>{if(rejectNextSave){rejectNextSave=false;return {ok:false,reason:'تعذّر الحفظ التجريبي. أعد المحاولة.'};}const res=commitProject(project,next);if(res.ok)project=next;return res;},
 onCommit:()=>assert.fail('factory width must never commit only a kitchen'),onReject:()=>{}});
cad.refresh();cad.inspectItem('unit',rice.id);
const factoryBody=nodes.get('[data-k-panel-body]');
assert.match(factoryBody.innerHTML,/name="widthMm"/);
const submitMm=valueAsNumber=>{const form={dataset:{kForm:'factory-width'},closest:()=>form,querySelectorAll:()=>[{dataset:{kField:'widthMm'},valueAsNumber}]};factoryBody.fire('submit',{target:form});};
const verifyCandidate=(delta)=>{
 const before=project,expected=previewKitchenWidthChange(project,rice.id,delta,{explicitUserChange:true});assert(expected.ok,expected.reason);
 assert.equal(before.room.workshop.rows[owner.id].units[0].locks.width,false,'the target begins flexible');
 assert.match(factoryBody.innerHTML,/data-k-act="confirm-factory-width"/);
 assert.equal(project.kitchen.units.find(u=>u.id===rice.id).width*10,600);
 btn({kAct:'confirm-factory-width'});assert.deepEqual(project.kitchen.units,expected.doc.kitchen.units);assert.deepEqual(project.room.workshop.rows,expected.doc.room.workshop.rows);
 assert.equal(project.room.workshop.rows[owner.id].units[0].locks.width,true,'an explicit CAD edit pins only its target width');
 assert.equal(buildFactoryQuote(restoreProject()).total,expected.price.afterSar);assert.equal(kitchenHistory().length,1);
 project=undoProject(project).next;assert.equal(buildFactoryQuote(project).total,baseQuote.total);assert.equal(project.room.workshop.rows[owner.id].units[0].widthMm,600);assert.equal(kitchenHistory().length,0);
 assert.deepEqual(project.kitchen.units,before.kitchen.units);assert.deepEqual(project.room.workshop.rows,before.room.workshop.rows,'one undo restores geometry and every lock');
 assert.equal(project.room.workshop.rows[owner.id].units[0].locks.width,false);
 cad.refresh();cad.inspectItem('unit',rice.id);
};
submitMm(600);assert(!factoryBody.innerHTML.includes('confirm-factory-width'));assert.equal(kitchenHistory().length,0);assert.equal(project.room.workshop.rows[owner.id].units[0].locks.width,false,'no-op does not pin');
submitMm(700);svg.fire('keydown',{key:'Escape'});assert(!factoryBody.innerHTML.includes('confirm-factory-width'));assert.equal(panel.hidden,false,'first Escape cancels preview and retains the inspector');assert.equal(kitchenHistory().length,0);
svg.fire('keydown',{key:'Escape'});assert.equal(panel.hidden,true,'next Escape closes the inspector');cad.inspectItem('unit',rice.id);
submitMm(700);root.fire('keydown',{key:'Escape',target:factoryBody});assert(!factoryBody.innerHTML.includes('confirm-factory-width'));assert.equal(panel.hidden,false,'Escape from the inspector cancels the same preview');assert.equal(kitchenHistory().length,0);
submitMm(500);verifyCandidate(-100);
const gr=new N('[data-k-handle]',{kHandle:'width',kOwner:rice.id});go([190,40],[200,40],gr);verifyCandidate(100);
// Personal pins allow the same live grip preview as the final explicit edit.
{
 const original=project;project=structuredClone(project);project.room.workshop.rows[owner.id].units[0].locks.width=true;
 cad.refresh();cad.inspectItem('unit',rice.id);const source=project;
 send('pointerdown',[190,40],gr);send('pointermove',[200,40],gr);withFrame();
 const livePreview=nodes.get('[data-k-preview-layer]').innerHTML;
 assert.match(livePreview,/data-k-proposal="valid"/,'the pinned target visibly previews a legal width before release');
 const previewXs=livePreview.match(/points="([^"]+)"/)[1].split(' ').map(point=>Number(point.split(',')[0]));
 assert.equal(Math.max(...previewXs)-Math.min(...previewXs),70,'the visible preview is 700 mm wide');assert.equal(project,source);
 svg.fire('keydown',{key:'Escape'});send('pointerup',[200,40],gr);
 assert.equal(panel.hidden,false,'cancelling a grip does not close its context');assert.equal(project,source);assert.equal(kitchenHistory().length,0);assert(!factoryBody.innerHTML.includes('confirm-factory-width'));
 // A non-geometric source change also invalidates the gesture.
 send('pointerdown',[190,40],gr);send('pointermove',[200,40],gr);withFrame();
 project={...source,room:{...source.room,name:'تحديث أثناء السحب'}};send('pointermove',[205,40],gr);send('pointerup',[205,40],gr);
 assert.equal(kitchenHistory().length,0);assert.equal(project.room.workshop.rows[owner.id].units[0].widthMm,600);assert(!factoryBody.innerHTML.includes('confirm-factory-width'));
 project=original;cad.refresh();cad.inspectItem('unit',rice.id);
}
submitMm(700);rejectNextSave=true;btn({kAct:'confirm-factory-width'});assert.equal(kitchenHistory().length,0);assert.match(factoryBody.innerHTML,/data-k-act="confirm-factory-width"/,'failed persistence restages a retryable preview');verifyCandidate(100);
submitMm(500);project={...project,room:{...project.room,name:'مراجعة جديدة'}};btn({kAct:'confirm-factory-width'});assert.equal(kitchenHistory().length,0);assert.equal(project.room.name,'مراجعة جديدة');
project={...project,room:{...project.room,workshop:{...project.room.workshop,layoutBrief:{mode:'fixed',capSar:1,extraSar:0,scope:'المطبخ كاملًا',reference:'مشروع العينة',weights:{contract:1}}}}};
cad.refresh();cad.inspectItem('unit',rice.id);submitMm(500);btn({kAct:'confirm-factory-width'});assert.equal(kitchenHistory().length,0,'fixed budget holds the CAD commit as it does in proposals');
btn({kAct:'remove'});assert.equal(kitchenHistory().length,0,'any generic CAD change to a managed unit must respect the row record');
cad.destroy();
console.log('Factory CAD form/grip stage the proposal transaction; one approval records both copies, coherent quote survives reload, one undo restores the row, stale drafts refuse to apply.');

// A role-limited CAD view has real row geometry but no factory/pricing record.
// It must not offer or execute the full-record width proposal transaction.
{
 let scopedDoc=structuredClone(savedRow.doc),writes=0,fullWrites=0,layoutRequests=0,rowRequests=0;
 for(const key of ['catalog','storeCatalog','factoryRecipes','pricingTerms','catalogMeta','layoutBrief'])delete scopedDoc.room.workshop[key];
 const before=structuredClone(scopedDoc),scopedRejects=[];
 const mounted=mountKitchenView(host,{scoped:true,getProject:()=>scopedDoc,getKitchen:()=>scopedDoc.kitchen,getRoom:()=>scopedDoc.room,getPlan:()=>scenePlan(scopedDoc.room,scopedDoc.kitchen),
  onCommit:next=>{writes++;scopedDoc={...scopedDoc,kitchen:next};},onCommitProject:()=>{fullWrites++;assert.fail('Scoped CAD cannot locally commit a manufacturing width proposal');},
  onLayouts:()=>layoutRequests++,onFactoryRow:()=>rowRequests++,onReject:msg=>scopedRejects.push(msg)});
 mounted.refresh();mounted.selectUnit(rice.id);
 for(const text of ['data-k-form="factory-width"','confirm-factory-width','فرق سعر المطبخ','ر.س.'])assert(!factoryBody.innerHTML.includes(text),text);
 assert.match(factoryBody.innerHTML,/بدائل التوزيع المحسوبة على الخادم/);assert(!svg.innerHTML.includes('data-k-handle="width"'));
 submitMm(500);btn({kAct:'confirm-factory-width'});
 assert.equal(scopedRejects.length,2);assert(scopedRejects.every(s=>s.includes('الخادم')));
 const unit=scopedDoc.kitchen.units.find(u=>u.id===rice.id),x=unit.u+unit.width;
 go([x,40],[x+10,40],new N('[data-k-handle]',{kHandle:'width',kOwner:rice.id}));
 assert.deepEqual(scopedDoc,before);assert.equal(writes,0);assert.equal(fullWrites,0);
 mounted.selectUnit(rice.id);btn({kAct:'factory-row'});assert.equal(layoutRequests,1);assert.equal(rowRequests,0);
 btn({kAct:'remove'});assert.equal(writes,0,'Managed row geometry remains protected from generic deletion');
 mounted.selectUnit(rice.id);btn({kAct:'toggle'});assert(mounted.getState().testOpenIds.includes(rice.id),'Ordinary CAD opening previews remain available');assert.equal(writes,0,'Opening preview remains non-persistent');
 assert.equal(scopedDoc.kitchen.units.find(u=>u.id===rice.id).width,unit.width);assert.deepEqual(scopedDoc.room.workshop.rows,before.room.workshop.rows);
 mounted.selectView('volume');mounted.selectUnit(rice.id);assert(!svg.innerHTML.includes('data-k-handle="width"'));assert(!factoryBody.innerHTML.includes('factory-width'));
 mounted.destroy();
}
console.log('Scoped CAD preserves factory row geometry, omits local width/price previews and handles, rejects forged form/grip/confirm actions, routes row alternatives to the server and retains ordinary opening previews.');

const measuredDoc=makeChainExample(),windowFeature=measuredDoc.kitchen.features.find(f=>f.kind==='window'),surveyJumps=[];
const originalMeasure=structuredClone(measuredDoc);
const measuredCAD=mountKitchenView(host,{getPlan:()=>scenePlan(measuredDoc.room,measuredDoc.kitchen),getRoom:()=>measuredDoc.room,getKitchen:()=>measuredDoc.kitchen,
 onSurveyReading:(wall,featureId)=>surveyJumps.push({wall,featureId}),onCommit:()=>assert.fail('A CAD window alternative must leave the survey and current project intact')});
measuredCAD.refresh();measuredCAD.selectView('volume');measuredCAD.inspectItem('feature',windowFeature.id);
assert.match(factoryBody.innerHTML,/data-k-act="correct-survey-reading"/);assert.match(factoryBody.innerHTML,/data-k-form="preview-survey-feature"/);
const altSill=bottom=>{
 const values={u:windowFeature.u*10,width:windowFeature.width*10,bottom,height:windowFeature.height*10};
 const form={dataset:{kForm:'preview-survey-feature'},closest:()=>form,querySelectorAll:()=>Object.entries(values).map(([kField,valueAsNumber])=>({dataset:{kField},valueAsNumber}))};
 factoryBody.fire('submit',{target:form});return nodes.get('[data-k-preview-layer]').innerHTML;
};
const originalGhost=altSill(1150),raisedGhost=altSill(1160);
assert.match(raisedGhost,/data-k-proposal="valid"/);assert.notEqual(originalGhost,raisedGhost,'+10 mm moves the rendered alternate geometry in elevation');
assert.match(nodes.get('[data-k-preview-note]').textContent,/قياس الزيارة محفوظ/);
assert.equal(measuredDoc.room.workshop.chains.back.rows.find(r=>r.kind==='window').bottomMm,1150);
measuredCAD.selectView('top');
go([255,1],[270,1],new N('[data-k-id]',{kKind:'feature',kId:windowFeature.id}));
assert.deepEqual(measuredDoc,originalMeasure);assert(readChainRange(measuredDoc,windowFeature.wall),'valid measurement survives both editing routes');
assert.match(nodes.get('[data-k-preview-layer]').innerHTML,/data-k-proposal="valid"/);
btn({kAct:'correct-survey-reading'});assert.deepEqual(surveyJumps,[{wall:windowFeature.wall,featureId:windowFeature.id}]);
measuredCAD.destroy();
console.log('Mounted measured window: numeric +10 mm changes the projected preview; dragging previews without saving; correction opens the original survey wall and stable feature ID.');

// Exercise object commands through the mounted contextmenu event and actual
// callbacks rather than checking labels in a detached menu definition.
let shownMenu=null,menuDoc=structuredClone(originalMeasure);const linked=[],insideEdits=[];
class ContextNode extends N{
 constructor(tag){super(tag);this.style={};this.children=[];}
 append(...items){this.children.push(...items);}
 remove(){if(shownMenu===this)shownMenu=null;}
 getBoundingClientRect(){return {left:0,top:0,width:230,height:170};}
}
const menuDocument={defaultView:win,body:{append(menu){shownMenu=menu;}},createElement:tag=>new ContextNode(tag)};
root.ownerDocument=menuDocument;
const menuCad=mountKitchenView(host,{getProject:()=>menuDoc,getKitchen:()=>menuDoc.kitchen,getRoom:()=>menuDoc.room,getPlan:()=>scenePlan(menuDoc.room,menuDoc.kitchen),initialViewport:{view:'top'},
 onCommit:(next)=>{menuDoc={...menuDoc,kitchen:next};},onEditUnit:id=>insideEdits.push(id),
 onWindowUpstand:(...args)=>linked.push(['stone',...args]),onSurveyReading:(...args)=>linked.push(['reading',...args])});
menuCad.refresh();
const contextFor=(kind,id,x,y)=>{
 const target=id?new N('[data-k-id]',{kId:id,kKind:kind}):svg;
 root.fire('contextmenu',{button:2,clientX:x,clientY:y,target,pointerType:'mouse'});
 assert(shownMenu,'context menu opened');return shownMenu.children.filter(b=>b.values.role==='menuitem');
};
const runMenu=(buttons,label)=>{const b=buttons.find(b=>b.textContent.includes(label));assert(b,label);b.fire('click');};
let commands=contextFor('feature',windowFeature.id,255,1);
assert.equal(menuCad.getState().selected,null,'right-click alone must not select or modify the window');
assert(commands.some(b=>b.textContent.includes('تصحيح قياس الزيارة')));runMenu(commands,'نعلة الرخام');
assert.deepEqual(linked,[['stone',windowFeature.wall,windowFeature.id]]);
assert.deepEqual(menuDoc,originalMeasure);
commands=contextFor('feature',windowFeature.id,255,1);runMenu(commands,'تصحيح قياس الزيارة');
assert.deepEqual(linked.at(-1),['reading',windowFeature.wall,windowFeature.id]);
menuDoc=structuredClone(project);menuCad.refresh();commands=contextFor('unit',rice.id,160,38);
assert(commands.some(b=>b.textContent.includes('تعديل عرض')));runMenu(commands,'تعديل التقسيم الداخلي');assert.deepEqual(insideEdits,[rice.id]);
commands=contextFor('unit',rice.id,160,38);runMenu(commands,'تعديل عرض');
assert.equal(menuCad.getState().selected.id,rice.id);assert.equal(panel.hidden,false);
const field={tagName:'INPUT',value:'505',defaultValue:'600',focus(){this.focused=true;}};
const controls=factoryBody.querySelectorAll;factoryBody.querySelectorAll=()=>[field];
commands=contextFor('unit',rice.id,160,38);assert.equal(commands.length,1);runMenu(commands,'متابعة التعديل الحالي');assert(field.focused);assert.equal(field.value,'505');
assert.equal(menuCad.activateTool('measure'),false,'a new tool cannot replace a dirty unit inspector');assert.equal(menuCad.getState().tool,'select');
assert.equal(menuCad.selectView('volume'),false);assert.equal(menuCad.getState().view,'top');
factoryBody.querySelectorAll=controls;
commands=contextFor('run',owner.id,120,2);runMenu(commands,'عمق');assert.equal(menuCad.getState().selected.id,owner.id);
const originalView=svg.getAttribute('viewBox'),gripNode=new N('g'),svgAll=svg.querySelectorAll;
gripNode.setAttribute('transform','translate(100 50) scale(0.8)');svg.querySelectorAll=sel=>sel==='[data-k-handle][transform]'?[gripNode]:[];
svg.fire('keydown',{key:'+'});assert.notEqual(svg.getAttribute('viewBox'),originalView);
assert.equal(gripNode.getAttribute('transform'),'translate(100 50) scale(0.8) scale(0.8)','keep grip size in screen pixels during zoom');
commands=contextFor(null,null,450,380);runMenu(commands,'إظهار الرسم كاملًا');assert.equal(svg.getAttribute('viewBox'),originalView);
assert.equal(gripNode.getAttribute('transform'),'translate(100 50) scale(0.8) scale(1)');svg.querySelectorAll=svgAll;
menuCad.activateTool('measure');commands=contextFor('unit',rice.id,160,38);
assert(!commands.some(b=>/عرض الوحدة|اختيار الصف|اختبار فتح|التقسيم/.test(b.textContent)));
runMenu(commands,'بداية القياس');commands=contextFor('unit',rice.id,180,38);runMenu(commands,'نهاية القياس');
assert.equal(menuCad.getState().measurement.distance,20);
menuCad.activateTool('unit');commands=contextFor('unit',rice.id,160,38);
assert(!commands.some(b=>/اختبار فتح|التقسيم|تعديل عرض/.test(b.textContent)));
menuCad.activateTool('test');commands=contextFor('unit',rice.id,160,38);runMenu(commands,'فتح');
assert.equal(menuCad.getState().tool,'test');assert(menuCad.getState().testOpenIds.includes(rice.id));
assert.equal(menuDoc.kitchen.units.find(u=>u.id===rice.id).open,false);
btn({kAct:'remove'});assert(menuDoc.kitchen.units.some(u=>u.id===rice.id));
menuCad.suspendDrawingInput();assert(!menuCad.getState().testOpenIds.includes(rice.id));assert.equal(menuDoc.kitchen.units.find(u=>u.id===rice.id).open,false);
menuCad.destroy();
console.log('Mounted CAD context: measured window proof and stone routes, unit width/inside, row depth, unsaved local field guard, keyboard zoom and background fit share normal editor entry points.');

// Touch may transfer capture from the initially touched SVG child to the
// stable drawing root. Losing that child's capture is not losing the stroke.
{
 const {restoreProject,saveProject}=await import('../public/kitchen-project.js');
 const values=new Map(),store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 globalThis.localStorage=store;
 let model=createKitchen(p,'empty'),writes=0;
 const drawing=mountKitchenView(host,{getPlan:()=>p,getKitchen:()=>model,onCommit(next){
   model=next;writes++;assert(saveProject({kitchen:model,room:r}));drawing.refresh();return {ok:true,saved:true};
 }});
 const plate=nodes.get('.kit-stage');
 for(const view of ['top','volume'])for(const pointerType of ['mouse','touch']){
  model=createKitchen(p,'empty');drawing.refresh();drawing.selectView(view);
  const cast=(event,pt,target)=>plate.fire(event,{type:event,pointerId:29,pointerType,isPrimary:true,button:0,
   buttons:event==='pointerup'?0:1,clientX:pt[0],clientY:pt[1],target});
  const point=x=>{
   if(view==='top')return [x,2];
   const {yaw,pitch}=drawing.getState(),scene=renderKitchenRoom(p,{kitchen:model,yaw,pitch,mode:'cutaway'});
   return projected(x,100,0,scene);
  };
  for(const [kind,x] of [['door',65],['window',185],['water',310]]){
   drawing.activateTool('feature',{featureKind:kind});
   const from=point(x-12),to=point(x),child=new N('polygon'),count=writes;
   cast('pointerdown',from,child);cast('pointermove',to,plate);
   assert(plate.hasPointerCapture(29));if(pointerType==='touch')cast('lostpointercapture',to,child);
   cast('pointerup',to,plate);
   assert.equal(writes,count+1,'completed '+pointerType+' placement must keep the '+view+' '+kind);
   const feature=model.features.at(-1);assert.equal(feature.kind,kind);
   assert(plate.innerHTML.includes((view==='top'?'data-k-id':'data-kitchen-3d-id')+'="'+feature.id+'"'));
   assert.deepEqual(restoreProject(store).kitchen.features,model.features);
  }
  const count=writes,pt=point(117);
  cast('pointerdown',pt,new N('polygon'));plate.releasePointerCapture(29);cast('lostpointercapture',pt,plate);cast('pointerup',pt,plate);
  assert.equal(writes,count,'actual capture loss still cancels');
 }
 console.log('CAD touch placement retains door, window and water point through capture transfer, repaint and saved reopen in plan and perspective.');
}

// An object's visible face is its editor. Use actual villa projection and
// chain identities, and save through the same document/history guard.
{
 const {makeSaudiRoom,makeFurnishedSaudiRoom}=await import('../public/kitchen-room-presets.js');
 const {applyChain,chainFromDrawing}=await import('../public/kitchen-chain-model.js');
 const {featureDimensionsMm,featureFromDimensionsMm,correctCadSurveyFeature}=await import('../public/kitchen-cad-measurement.js');
 const raw=makeSaudiRoom('villa');
 const source=chainFromDrawing(raw,'back');source.rows.push({id:'end',kind:'corner',from:'origin',gapMm:4400});
 let doc=applyChain(raw,'back',source).doc,writes=0;
 const points=doc.room.sitePoints;const svg=nodes.get('.kit-stage'),body=nodes.get('[data-k-panel-body]');
 const mounted=mountKitchenView(host,{getProject:()=>doc,getPlan:()=>scenePlan(doc.room,doc.kitchen),getRoom:()=>doc.room,getKitchen:()=>doc.kitchen,
  onCommit:()=>assert.fail('Measured edit cannot take CAD-only path'),onCommitProject:next=>{const out=commitProject(doc,next);if(out.changed){writes++;doc=next;}return out;}});
 mounted.refresh();mounted.selectView('volume');
 const window=doc.kitchen.features.find(f=>f.kind==='window'),before=structuredClone(doc),pv=()=>{const {yaw,pitch}=mounted.getState();return renderKitchenRoom(scenePlan(doc.room,doc.kitchen),{kitchen:doc.kitchen,yaw,pitch,mode:'cutaway'});};
 const pr=(x,height,z,scene=pv())=>{const q=scene.projection.project(x,doc.room.height-height,z);return [q.x,q.y];};
 const tap=pr(window.u+window.width*.45,window.bottom+window.height*.48,0);
 assert.equal(pv().hitTest(...tap).id,window.id);
 btn({kAct:'orbit'});go(tap);
 assert.equal(mounted.getState().orbit,false);assert.equal(mounted.getState().selected.id,window.id);
 assert.equal(panel.hidden,false);assert.match(body.innerHTML,/data-k-form="survey-feature"/);
 const fields=featureDimensionsMm(doc.room,window);fields.u=2740;
 const form={dataset:{kForm:'survey-feature'},closest:()=>form,querySelectorAll:()=>Object.entries(fields).map(([kField,valueAsNumber])=>({dataset:{kField},valueAsNumber}))};
 body.fire('submit',{target:form});
 assert.equal(writes,1);assert.equal(restoreProject().kitchen.features.find(f=>f.id===window.id).u,274);
 assert.deepEqual(doc.kitchen.features.filter(f=>f.id!==window.id),before.kitchen.features.filter(f=>f.id!==window.id));
 const x=doc.kitchen.features.find(f=>f.id===window.id);
 const end=pr(x.u+20,x.bottom+50,0),after=pr(x.u+35,x.bottom+55,0);
 const inputs=Object.keys(fields).map(key=>({dataset:{kField:key},value:'',defaultValue:''}));
 body.querySelectorAll=s=>s.includes('survey-feature')?inputs:[];
 go(end,after);assert.equal(writes,1);assert.equal(mounted.getState().selected.id,x.id);
 assert(Number(inputs.find(i=>i.dataset.kField==='u').value)>2740);
 for(const input of inputs)fields[input.dataset.kField]=Number(input.value);
 body.fire('submit',{target:form});assert.equal(writes,2);
 assert.equal(doc.kitchen.features.find(f=>f.id===window.id).u,fields.u/10);
 assert.deepEqual(doc.kitchen.features.filter(f=>f.id!==window.id),before.kitchen.features.filter(f=>f.id!==window.id));
 delete body.querySelectorAll;
 const svc=doc.kitchen.features.find(f=>f.wall==='back'&&f.kind==='water');
 const dims=featureDimensionsMm(doc.room,svc);assert.equal(dims.u,(svc.u+svc.width/2)*10);
 const altered=correctCadSurveyFeature(doc,svc,featureFromDimensionsMm(doc.room,svc,{...dims,bottom:dims.bottom+1}));
 assert(altered.ok,altered.reason);assert.equal(altered.features.find(f=>f.id===svc.id).bottom,svc.bottom+.1);
 mounted.selectView('top');const point=points[0];
 go([point.x,point.z],[point.x+15,point.z+10],new N('[data-k-site-point]',{kSitePoint:point.id}));
 assert.equal(writes,3);assert.equal(doc.room.sitePoints[0].x,point.x+15);
 assert.equal(undoProject(doc).next.room.sitePoints[0].x,point.x);
 // Reusing the same kitchen reference cannot reuse the old drain clearance.
 const furnished=makeFurnishedSaudiRoom('villa'),fp=furnished.room.sitePoints[0];
 assert.equal(kitchenGeometry(furnished.kitchen,furnished.room).hardConflicts.length,0);
 const movedDrain=commitProject(furnished,{...furnished,room:{...furnished.room,sitePoints:[{...fp,x:35,z:30}]}});
 assert.equal(movedDrain.ok,false);assert(movedDrain.conflict.ids.includes(fp.id));

 mounted.destroy();
}
console.log('Visible villa glass opens its editor, linked CAD drag and measured millimetre form persist through one project write each, neighbour stations and point datums are preserved, floor drain drag is undoable.');
// A rendered subpart must retain its own physical identity through projection.
// Pick the visible polygon centers just like a pointer, including on a tablet.
{
 let model=createKitchen(p),intents=[],writes=0;
 const creative=nodes.get('[data-k-creative]');creative.nodeType=1;
 const mounted=mountKitchenView(host,{getPlan:()=>p,getKitchen:()=>model,
   initialViewport:{view:'volume',yaw:28,pitch:32},onInspectPart:(route,focus)=>intents.push({route,focus}),
   onCommit:next=>{writes++;model=next;}});
 mounted.refresh();
 const scene=renderKitchenRoom(p,{kitchen:model,yaw:28,pitch:32,mode:'cutaway'}),polys=[...scene.html.matchAll(/<polygon ([^>]+)>/g)].map(m=>m[1]);
 function visiblePolygon(needle,accept){
   for(const poly of polys.filter(p=>p.includes(needle))){
    const coords=poly.match(/ points="([^"]+)"/)?.[1].split(' ').filter(Boolean).map(v=>v.split(',').map(Number));if(!coords?.length)continue;
    const xy=[0,1].map(i=>coords.reduce((v,q)=>v+q[i],0)/coords.length),hit=scene.hitTest(...xy);
    if(hit&&accept(hit))return {xy,hit};
   }
   assert.fail('No visible polygon of '+needle);
 }
 for(const [component,index] of [['drawer',2],['handle',1]]){
  const {xy}=visiblePolygon('data-kitchen-component="'+component+'"',h=>h.component===component&&h.id==='unit-drawers'&&h.index===index);
  go(xy);assert.equal(intents.at(-1).route,'unit-part');assert.deepEqual([intents.at(-1).focus.unitId,intents.at(-1).focus.part,intents.at(-1).focus.index],['unit-drawers',component,index]);
 }
 const bowl=visiblePolygon('data-kitchen-face="sink-bottom"',h=>h.kind==='sink'&&h.tag==='sink-bottom');
 const sinkId=bowl.hit.id,sinkUnit=scene.geometry.units.find(u=>u.id===sinkId),slab=scene.geometry.worktops.find(t=>t.holes.some(h=>h.unitId===sinkId));
 const bowlTarget={route:'surface',focus:{runId:slab.runId,topId:slab.id,unitId:sinkId,holeId:sinkId}};
 go(bowl.xy);assert.deepEqual(intents.at(-1),bowlTarget);
 const tap=visiblePolygon('data-kitchen-face="faucet-body"',h=>h.id===sinkId&&h.tag==='faucet-body');
 go(tap.xy);assert.deepEqual(intents.at(-1),{route:'tap',focus:{sinkId,wall:sinkUnit.wall}});
 const stone=visiblePolygon('data-kitchen-face="stone-edge"',h=>h.part==='worktop');
 go(stone.xy);assert.equal(intents.at(-1).route,'worktop');assert.equal(intents.at(-1).focus.runId,stone.hit.runId);assert.equal(intents.at(-1).focus.topId,stone.hit.id);
 const floor=visiblePolygon('data-room-surface="floor"',h=>h.surface==='floor'&&!h.sitePointId);
 go(floor.xy);assert.deepEqual(intents.at(-1),{route:'room-surface',focus:{surface:'floor'}});
 const before=intents.length;go(floor.xy,[floor.xy[0]+24,floor.xy[1]+15]);assert.equal(intents.length,before,'orbiting the floor must not edit it');
 mounted.selectView('top');go([90,-5],[90,-5],new N('[data-k-wall-hit]',{kWallHit:'back'}));
 assert.deepEqual(intents.at(-1),{route:'survey',focus:{wall:'back'}});
 const cutout=new N('[data-k-basin]',{kBasin:sinkId}),owner=new N('[data-k-id]',{kId:sinkId,kKind:'unit'});
 cutout.closest=s=>s==='[data-k-basin]'?cutout:s==='[data-k-id]'?owner:null;
 const box=sinkUnit.cutout.rect,center=[box.x+box.w/2,box.z+box.d/2];
 assert.match(svg.innerHTML,/data-k-basin=/);go(center,center,cutout);assert.deepEqual(intents.at(-1),bowlTarget);
 assert.equal(writes,0);
 const focus={runId:stone.hit.runId,topId:stone.hit.id};
 assert.equal(mounted.inspectMaterial('run',focus.runId,'worktop',focus),true);
 assert.match(creative.innerHTML,/data-swatch="top"/);assert.match(creative.innerHTML,/data-c-action="template"/);
 const template=new N('button',{cAction:'template'});template.btn=true;
 creative.fire('click',{target:template});assert.deepEqual(intents.at(-1),{route:'surface',focus});
 const swatch=new N('button',{swatch:'top',value:'charcoal'});swatch.btn=true;
 const choices=Object.keys((await import('../public/kitchen-materials.js')).kitchenWorktopFinishes);
 swatch.dataset.value=choices.find(key=>key!==model.runs.find(r=>r.id===focus.runId).worktopFinish);
 creative.fire('click',{target:swatch});assert.equal(writes,1);
 assert.equal(model.runs.find(r=>r.id===focus.runId).worktopFinish,swatch.dataset.value);
 assert.equal(mounted.inspectMaterial('unit','unit-drawers','handle'),true);assert.match(creative.innerHTML,/data-c-style="handle"/);assert(!creative.innerHTML.includes('data-c-action="template"'));
 mounted.destroy();delete creative.nodeType;
}
console.log('Visible 3D drawer two, its neighboring pull, the real worktop piece, floor, orbit drag and the actual plan wall band preserve separate owner identities without an edit write.');
{
 const {cadPartTarget}=await import('../public/kitchen-cad-parts.js');
 const g={runs:[{id:'row',tier:'base'}],units:[{id:'cab',runId:'row',wall:'back'}],cornerBodies:[{id:'corner:joint:upper',joint:'joint',tier:'upper'}]};
 for(const [hit,route,focus] of [
  [{part:'module',id:'cab',runId:'row',tag:'base-apron'},'assembly',{section:'base',runId:'row',part:'apron'}],
  [{part:'module',id:'cab',tag:'cabinet-leg'},'assembly',{section:'base',runId:'row',unitId:'cab',part:'leg'}],
  [{part:'module',id:'cab',tag:'mixer-lever'},'tap',{wall:'back',sinkId:'cab'}],
  [{part:'fixture',kind:'window-sill-stone',wall:'back',id:'w'},'assembly',{section:'stone',wall:'back',windowId:'w'}],
  [{part:'fixture',kind:'under-light',wall:'back',sectionId:'led-a'},'wallOptions',{wall:'back',lighting:true,sectionId:'led-a'}],
  [{part:'fixture',kind:'cover-face',wall:'back',id:'h'},'wallOptions',{wall:'back',featureId:'h'}],
  [{part:'fixture',kind:'curtain-cloth',wall:'back',id:'w'},'wallOptions',{wall:'back',featureId:'w'}],
  [{part:'fixture',tag:'door-threshold',wall:'back',id:'d'},'room-surface',{surface:'threshold',wall:'back',featureId:'d'}],
  [{part:'surface',tag:'skirting-edge',surface:'back'},'room-surface',{surface:'skirting',wall:'back'}],
  [{part:'surface',surface:'ceiling'},'room-surface',{surface:'ceiling'}],
  [{part:'corner',id:'corner:joint:upper'},'corner',{joint:'joint',tier:'upper'}]
 ])assert.deepEqual(cadPartTarget(hit,g),{route,focus});
 assert.equal(cadPartTarget({part:'corner',id:g.cornerBodies[0].id},g,'base'),null);
 assert.equal(cadPartTarget({part:'surface',surface:'floor',sitePointId:'drain'},g),null);
}
