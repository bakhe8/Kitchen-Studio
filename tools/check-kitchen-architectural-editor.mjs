import assert from 'node:assert/strict';
import {roomArchitecture,architectureWall,architectureContains,architectureWallPoint} from '../public/kitchen-architecture.js';
import {addFeature,createKitchen,kitchenWallPoint,kitchenWallLocal} from '../public/kitchen-model.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {mountKitchenView} from '../public/kitchen-view.js';
import {elevationSheet,planSheet,sheetFaces,sheetTables,surveyDoorMark,surveyPlanBounds} from '../public/kitchen-sheet.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
import {onWall,pickVolume} from '../public/kitchen-volume-edit.js';
import {makeRoomProjection} from '../public/shelf-room-render.js';
const scene=room=>({...createShelfPlan(),wall:{w:room.width,h:room.height},room:{...room,attachedWall:'back',layers:{}}});
const raw=(kind='notch')=>({width:360,length:300,height:260,architecture:{wallThickness:18,cut:{kind,corner:'back-left',width:100,...(kind==='taper'?{}:{depth:80})}},sitePoints:[{id:'site-1',kind:'floor-drain',x:195,z:175,size:14}]});
const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
const near=(a,b,e=.001)=>assert(Math.abs(a-b)<e,JSON.stringify({actual:a,expected:b}));
for(const kind of ['notch','chamfer','taper']){
 const r=raw(kind),A=roomArchitecture(r),edges=A.walls,dd={room:r,kitchen:createKitchen(r,'empty')};
 assert.equal(edges.length,kind==='notch'?6:kind==='chamfer'?5:4);
 assert.equal(sheetFaces(dd).length,1+edges.length);
 const out=planSheet(dd),p=edges.reduce((a,e)=>a+e.length,0);near(Number(out.match(/data-sheet-perimeter="([^"]+)"/)[1]),p);
 for(const edge of edges){const elevation=elevationSheet(dd,edge.id,true);near(Number(elevation.match(/data-sheet-span="([^"]+)"/)[1]),edge.length);near(Number(elevation.match(/data-sheet-origin="([^"]+)"/)[1]),edge.start);assert(out.includes('data-sheet-wall="'+edge.id+'"'));}
 assert.match(out,/data-k-masonry-thickness="18"/);assert.match(out,/data-k-site-point="site-1"/);assert.match(sheetTables(dd,'plan'),/صرف أرضي/);
 // Only the room surface's physical renderer decides visibility; a locked
 // drag must still invert the actual return OR sloping plane, not x/z constants.
 const candidate=kind==='notch'?edges.find(e=>e.id.endsWith('-z')):kind==='chamfer'?edges.find(e=>e.id.endsWith('-diagonal')):edges.find(e=>Math.abs(e.tangent.x*e.tangent.z)>.02);
 const u=candidate.start+candidate.length*.43,point=architectureWallPoint(r,candidate.id,u,2.2),P=makeRoomProjection(scene(r),{yaw:33,pitch:18}),wp={...point,y:93},q=P.projectPoint(wp);
 const fixture={mode:'cutaway',geometry:{room:r,runs:[]},room:r,visibleSurfaces:[candidate.id],projection:P,hitTest(){return {part:'surface',surface:candidate.id,world:wp};}};
 const result=onWall(fixture,q,{wall:candidate.id,offset:2.2,locked:true});assert(result);near(result.u,u);near(result.bottom,r.height-93);near(result.world.z,wp.z);near(result.world.x,wp.x);
 const original=architectureWallPoint(r,candidate.id,u,0),ref={...original,y:83},p0=P.projectPoint(ref);
 fixture.hitTest=()=>({part:'surface',surface:candidate.id,world:ref});const exposed=onWall(fixture,p0);assert(exposed);assert.equal(exposed.wall,candidate.id);near(exposed.u,u);assert.equal(pickVolume(fixture,p0)?.wall,candidate.id);
 const finish={...architectureWallPoint(r,candidate.id,u,1.15),y:83};fixture.hitTest=()=>({part:'surface',surface:candidate.id,world:finish,tag:'tile-skirting',buildingSide:'interior'});assert(onWall(fixture,P.projectPoint(finish)),'attached interior finishes remain usable as wall targets');
 for(const side of ['edge','exterior']){fixture.hitTest=()=>({part:'surface',surface:candidate.id,world:ref,buildingSide:side});assert.equal(onWall(fixture,p0),null,'do not mount on a cut cap or outside masonry');}
 fixture.hitTest=()=>({part:'module',id:'occluder',world:ref});assert.equal(onWall(fixture,p0),null,'never reach through an occluder to a hidden diagonal/return');
 let exposedInRenderedScene=false;
 for(const yaw of [18,61,112,152,205,251,292,336]){
   const s=renderKitchenRoom(scene(r),{kitchen:dd.kitchen,yaw,pitch:28,mode:'cutaway'}),aim=s.projection.projectPoint(ref),actual=s.hitTest(aim.x,aim.y);
   if(actual?.part==='surface'&&actual.surface===candidate.id&&actual.buildingSide==='interior'){
     const pick=onWall(s,aim);assert(pick);assert.equal(pick.wall,candidate.id);near(pick.u,u);exposedInRenderedScene=true;break;
   }
 }
 assert(exposedInRenderedScene,'real scene must offer an angle exposing '+kind+' '+candidate.id);
}
const R=raw(),bounds=roomArchitecture(R),returnX=bounds.walls.find(w=>w.id.endsWith('-x')),wall=returnX.id,door={id:'test-door',kind:'door',wall,u:returnX.start+15,width:35,bottom:0,height:205,depth:4,hinge:'right',swing:'out'};
assert(!architectureContains(R,{x:20,z:20}));assert(architectureContains(R,{x:175,z:165}));
const inward=surveyDoorMark(R,{...door,swing:'in'}),outward=surveyDoorMark(R,door),sliding=surveyDoorMark(R,{...door,swing:'sliding'});
const unknown=surveyDoorMark(R,{...door,swing:undefined});assert.match(unknown,/swing="unspecified"/);assert(!unknown.includes('stroke-dasharray')&&!unknown.includes('circle'),'a legacy doorway is not a measured hinged swing');assert.notEqual(inward,outward);assert.match(outward,/data-k-door-hinge="right"/);assert.match(sliding,/swing="sliding"/);assert(!sliding.includes('stroke-dasharray'));
const extend=surveyPlanBounds(raw(),[{...door,wall:'front',u:85,width:85}],10);assert(extend.y+extend.h>=R.length+85,'out-swing leaf stays inside the technical drawing frame');

class N{constructor(sel,ds={}){this.sel=sel;this.dataset=ds;this.at=new Map();this.events={};this.classList={add(){},remove(){}};this.innerHTML='';this.textContent='';}
 querySelector(s){if(!nodes.has(s))nodes.set(s,new N(s));return nodes.get(s);}querySelectorAll(){return [];}
 setAttribute(k,v){this.at.set(k,String(v));}getAttribute(k){return this.at.get(k);}
 addEventListener(k,fn){this.events[k]=fn;}fire(k,x={}){this.events[k]?.({target:this,preventDefault(){},...x});}
 closest(s){return s==='button'&&this.btn||s===this.sel?this:null;}contains(){return true;}focus(){}replaceChildren(){this.innerHTML='';}
 setPointerCapture(id){this.cap=id;}hasPointerCapture(id){return this.cap===id;}releasePointerCapture(){this.cap=null;}createSVGPoint(){return {matrixTransform(){return {x:this.x,y:this.y};}};}getScreenCTM(){return {inverse:()=>({})};}}
const nodes=new Map(),host=new N('host'),win=new N('win');host.ownerDocument={defaultView:win};let frame;win.requestAnimationFrame=fn=>(frame=fn,1);win.cancelAnimationFrame=()=>{frame=null;};
let k=createKitchen(R,'empty'),plan=scene(R),count=0,focused=[];const kit=mountKitchenView(host,{getPlan:()=>plan,getKitchen:()=>k,onCommit:next=>{k=next;count++;},onSurveyPoint:id=>focused.push(id)});
kit.refresh();const root=nodes.get('.kit'),svg=nodes.get('.kit-stage'),quick=nodes.get('[data-k-quick]');
const btn=attrs=>{const n=new N('button',attrs);n.btn=true;root.fire('click',{target:n});};
const choice=(key,v)=>{const n=new N('select',{kChoice:key});n.value=v;quick.fire('change',{target:n});};
const ev=(type,p,target=svg)=>svg.fire(type,{target,clientX:p.x,clientY:p.z,pointerId:9,pointerType:'mouse',button:0,isPrimary:true,buttons:type==='pointerup'?0:1});
const go=(a,b=a,t=svg)=>{ev('pointerdown',a,t);if(a!==b){ev('pointermove',b,t);if(frame){const fn=frame;frame=null;fn();}}ev('pointerup',b,t);};
assert.match(svg.innerHTML,/data-k-wall-edge="return-back-left-/);assert.match(svg.innerHTML,/data-k-site-point="site-1"/);assert.ok(!svg.innerHTML.includes('NaN'));
kit.activateTool('measure');go({x:22,z:24},{x:45,z:40});assert.equal(kit.getState().measurement,null,'a removed floor pocket must not yield ruler points');
go({x:160,z:160},{x:190,z:200});near(kit.getState().measurement.distance,50);
kit.activateTool('run',{runPlacement:'free'});go({x:24,z:36},{x:150,z:160});assert.equal(count,0);
kit.activateTool('run',{runPlacement:'wall',tier:'base'});const p0=kitchenWallPoint(R,wall,returnX.start+12,1),p1=kitchenWallPoint(R,wall,returnX.end-12,1);go(p0,p1);assert.equal(count,1);assert.equal(k.runs[0].wall,wall);near(k.runs[0].start,returnX.start+12);
kit.activateTool('feature',{featureKind:'water'});go({x:25,z:23});assert.equal(count,1);const pf=kitchenWallPoint(R,wall,(returnX.start+returnX.end)/2,1);go(pf);assert.equal(count,2);assert.equal(k.features[0].wall,wall);
kit.activateTool('select');go({x:195,z:175},undefined,new N('[data-k-site-point]',{kSitePoint:'site-1'}));assert.deepEqual(focused,['site-1']);
const feature=addFeature(k,R,{id:'return-beam',kind:'beam',wall,u:returnX.start+12,width:45,depth:13,bottom:225,height:18});assert.ok(feature.ok,feature.reason);k=feature.kitchen;kit.refresh();assert.match(svg.innerHTML,/data-k-structure="beam"/);const sheet=elevationSheet({room:R,kitchen:k},wall);assert.match(sheet,/data-sheet-feature="return-beam"/);
const old=addFeature(k,R,{id:'legacy-door',kind:'door',wall:'front',u:110,width:65,bottom:0,height:205,depth:4});assert.ok(old.ok,old.reason);k=old.kitchen;kit.refresh();kit.inspectItem('feature','legacy-door');
const body=nodes.get('[data-k-panel-body]'),form=new N('[data-k-form]',{kForm:'feature'});form.elements={namedItem:key=>['hinge','swing'].includes(key)?{value:''}:null};form.querySelectorAll=()=>[{valueAsNumber:66,dataset:{kField:'width'}}];body.fire('submit',{target:form});const retained=k.features.find(x=>x.id==='legacy-door');assert.equal(retained.width,66);assert.equal(retained.swing,undefined);assert.equal(retained.hinge,undefined);assert.match(planSheet({kitchen:k,room:R}),/data-k-door-guide="legacy-door" data-k-door-swing="unspecified"/);
const revised=raw('chamfer');plan=scene(revised);k=createKitchen(revised,'empty');kit.refresh();assert.match(svg.innerHTML,/return-back-left-diagonal/);assert(!svg.innerHTML.includes('data-k-wall-edge="return-back-left-x"'),'same bounding dimensions but different survey refreshes the footprint immediately');
kit.destroy();console.log('Architecture edit/drawings: notch/chamfer/taper measured spans, shifted datums, plane inversion and occlusion, absent-floor rejection, return-wall placement, service selection, beams, true door swings and print framing OK.');
