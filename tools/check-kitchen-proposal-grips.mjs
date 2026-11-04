import assert from 'node:assert/strict';
import {sheetSelector,workshopPartTarget} from '../public/kitchen-sheet-target.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalScene,proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';
const result=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});
assert(result.ok);
const doc=result.candidates[0].doc,units=proposalUnits(doc),rice=units.find(u=>u.family==='rice');
const before=JSON.stringify(doc),start=rice.startMm;
const blocked=previewKitchenWidthChange(doc,rice.id,100,{edge:'start'});
assert(!blocked.ok,'dragging the pinned-side boundary cannot silently move the other edge');
const valid=previewKitchenWidthChange(doc,rice.id,100,{edge:'end'});
assert(valid.ok,valid.reason);
const newer=proposalUnits(valid.doc);
assert.equal(newer.find(u=>u.id===rice.id).startMm,start);
for(const p of units.filter(u=>['dishwasher','sink'].includes(u.family)))assert.deepEqual(newer.find(u=>u.id===p.id),p);
const editable={selectedId:rice.id,editableUnit:rice,interactive:true,tier:rice.tier};
for(const face of ['back','plan','volume']){
 const view=proposalScene(doc,face,'test',editable);
 assert(view.html.includes('data-wp-grip="end"'),face);
 assert(!proposalScene(doc,face).html.includes('data-wp-grip'),'no handles in customer exports');
}
assert.equal(JSON.stringify(doc),before);
console.log('Width edges keep the opposite boundary fixed; protected appliances and clean exports; usable handles in plan, elevation and volume.');

// Mount the real proposal desk and use its pointer handlers, not the width form.
const {mountWholePlan}=await import('../public/kitchen-whole-plan-ui.js');
const events={},feedback={},attrs=new Map();let captured,paint,live=doc,saves=0,route=null;
globalThis.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
globalThis.requestAnimationFrame=fn=>{paint=fn;return 1;};
globalThis.cancelAnimationFrame=()=>{paint=null;};
const svg={dataset:{},contains(){return true;},getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),
 getScreenCTM:()=>({inverse:()=>({})}),focus(){}};
const canvas={querySelector:()=>svg,querySelectorAll:()=>[],setPointerCapture:id=>{captured=id;},hasPointerCapture:id=>captured===id,releasePointerCapture:()=>{captured=null;},
 set innerHTML(v){this.markup=v;attrs.set('viewBox',v.match(/viewBox="([^"]+)"/)?.[1]);}};
const node={focus(){},scrollIntoView(){}};
let menu;
class MenuPart{
 constructor(){this.children=[];this.events={};this.style={};}
 setAttribute(){} append(el){this.children.push(el);} focus(){}
 addEventListener(k,fn){this.events[k]=fn;} remove(){} getBoundingClientRect(){return {width:120,height:160};}
}
const ownerDocument={body:{append(el){menu=el;}},createElement:()=>new MenuPart()};

const host={ownerDocument,querySelector:s=>s==='[data-wp-canvas]'?canvas:s==='[data-wp-gesture]'?feedback:node,
 addEventListener:(e,fn)=>{events[e]=fn;},removeEventListener(){}};
const stop=mountWholePlan(host,{getDoc:()=>live,apply(d){saves++;live=d;return {ok:true,saved:true};},tell(){},onAdvance:(...r)=>{route=r;}});
const event=(target,x=0,y=0)=>({target,clientX:x,clientY:y,pointerId:7,pointerType:'mouse',button:0,isPrimary:true,preventDefault(){},stopPropagation(){}});
const unitTarget={closest:s=>s==='[data-wp-canvas]'?canvas:s==='[data-kitchen-3d-part="module"]'?{getAttribute:()=>rice.id}:null};
events.click(event(unitTarget));assert(host.innerHTML.includes('data-width-change'),'clicking an initial saved cabinet opens its inspector');
function command(wp){return events.click(event({closest:s=>s==='button'?{dataset:{wp},hasAttribute:()=>false}:null}));}
function grip(edge){
 const m=canvas.markup.match(new RegExp('data-wp-grip="'+edge+'" data-axis-x="([^"]+)" data-axis-y="([^"]+)"'));
 assert(m,edge);const [dx,dy]=m.slice(1).map(Number);
 const g={dataset:{wpGrip:edge,axisX:dx,axisY:dy}};
 return {dx,dy,target:{closest:s=>s==='[data-wp-grip]'?g:s==='[data-wp-canvas]'?canvas:null}};
}
let g=grip('end');
function gesture(d,factor){events.pointerdown(event(d.target));events.pointermove(event(d.target,d.dx*factor,d.dy*factor));if(paint){const fn=paint;paint=null;fn();}}
gesture(g,1/6);assert.match(feedback.textContent,/٧٠٠ مم/);assert.equal(saves,0);events.pointercancel(event(g.target));
assert(host.innerHTML.includes('value="600" aria-label="عرض الوحدة'));assert.equal(stop.hasPending(),false);
g=grip('start');gesture(g,-1/6);events.pointerup(event(g.target,-g.dx/6,-g.dy/6));assert.equal(stop.hasPending(),false);
g=grip('end');events.pointerdown({...event(g.target),pointerType:'touch'});
events.lostpointercapture({...event(g.target),pointerType:'touch'}); // SVG child yields capture to its canvas.
events.pointermove({...event(g.target,g.dx/6,g.dy/6),pointerType:'touch'});
events.pointerup({...event(g.target,g.dx/6,g.dy/6),pointerType:'touch'});
assert(host.innerHTML.includes('value="700" aria-label="عرض الوحدة'));assert(stop.hasPending());assert.equal(saves,0);
const drawnPart=(part,index)=>({closest:s=>s==='[data-wp-canvas]'?canvas:s===sheetSelector?{dataset:{sheetUnit:rice.id,sheetPart:part,sheetIndex:String(index)}}:null});
await tap(drawnPart('drawer',2));
assert(host.innerHTML.includes('الدرج ٢')&&!host.innerHTML.includes('data-wp="edit-part"'));
await command('edit-part');assert.equal(route,null);assert.equal(saves,0);
const window=doc.kitchen.features.find(f=>f.kind==='window');
const windowTarget={closest:s=>s==='[data-wp-canvas]'?canvas:s==='[data-sheet-feature]'?{getAttribute:()=>window.id}:null};
async function tap(target){events.pointerdown(event(target));events.pointerup(event(target));await events.click(event(target));}
await tap(windowTarget);
assert(host.innerHTML.includes('١٬٢٠٠ مم')&&host.innerHTML.includes('data-wp="correct-feature"'));
assert(!host.innerHTML.includes('data-width-change'),'choosing the opening clears the cabinet width controls');
await command('correct-feature');assert.deepEqual(route,['survey',{wall:window.wall,featureId:window.id,edit:true}]);
assert(stop.hasPending()&&saves===0,'opening the saved wall never installs a proposal');
route=null;await tap(unitTarget);assert(host.innerHTML.includes('value="700" aria-label="عرض الوحدة'));
function menuAt(target=unitTarget){
 events.contextmenu({...event(target,25,30),button:2});
 assert(menu);const actions=menu.children.slice(1);assert(actions.length<=4);return actions;
}
const byLabel=(actions,label)=>actions.find(b=>b.textContent===label);
let actions=menuAt();
const effects=byLabel(actions,'أثر تعديل هذه الوحدة');assert(effects);
effects.events.click();assert(host.innerHTML.includes('data-pd-open')&&host.innerHTML.includes('العرض من ٦٠٠ إلى ٧٠٠ مم'));assert.equal(saves,0);
actions=menuAt();
assert(!canvas.markup.includes('data-wp-grip='),'reviewing the latest change cannot offer a drag grip');
assert(!actions.some(a=>a.textContent.includes('كتابة العرض')||a.textContent.includes('تطبيق المقترح')));
assert.equal(stop.commandContext().savedDesign,false);
await command('close-sheet');actions=menuAt();
const assign=byLabel(actions,'تطبيق المقترح وتحديد الاستخدام');assert(assign);
assert.equal(saves,0);assign.events.click();assert.equal(saves,1);assert.deepEqual(live.kitchen.units,valid.doc.kitchen.units);
assert.deepEqual(route,['uses',{unitId:rice.id}]);route=null;
assert(byLabel(menuAt(),'استخدام هذه الوحدة'));assert.equal(stop.commandContext().unitId,rice.id);assert.equal(stop.commandContext().canSetUsage,true);
const reserved=proposalUnits(doc).find(p=>p.family==='dishwasher');
const appliance={closest:s=>s==='[data-kitchen-3d-part="module"]'?{getAttribute:()=>reserved.id}:null};
assert(!byLabel(menuAt(appliance),'استخدام هذه الوحدة'));
const {mountClientUsage}=await import('../public/kitchen-client-usage-ui.js');
const child={addEventListener(){},querySelector(){return null;}};
const form={addEventListener(){},querySelector(){return child;}};
mountClientUsage(form,{getDoc:()=>live,focus:{unitId:rice.id},apply(){throw Error('opening usage changed the project');},tell(){}})();
assert(form.innerHTML.includes('value="'+rice.id+'" selected'));
const assigned={...live,room:{...live.room,workshop:{...live.room.workshop,clientUsage:{tasks:[
 {id:'coffee',unitId:rice.id,name:'تخزين أدوات القهوة',purpose:'activity'},
 {id:'other',unitId:reserved.id,name:'غرض وحدة أخرى',purpose:'storage'}
]}}}};
const usageArgs={getDoc:()=>assigned,apply(){throw Error('opening a saved activity changed the project');},tell(){}};
mountClientUsage(form,{...usageArgs,focus:{unitId:rice.id,taskId:'coffee'}})();
assert.match(form.innerHTML,/<input name="name" value="تخزين أدوات القهوة"/);
mountClientUsage(form,{...usageArgs,focus:{unitId:rice.id,taskId:'other'}})();
assert.match(form.innerHTML,/<input name="name" value=""/);

await command('undo');assert.equal(saves,2);assert.deepEqual(live.kitchen.units,doc.kitchen.units);
assert.equal(route,null);
await tap(drawnPart('drawer',2));assert(host.innerHTML.includes('الدرج ٢')&&host.innerHTML.includes('تخصيص الدرج'));
assert(host.innerHTML.includes('عرض الوحدة كاملة')&&canvas.markup.includes('data-wp-grip="end"'),'a part selection retains precise editing of the owning cabinet');
await command('edit-part');assert.equal(route[0],'unit-part');
const resolved=workshopPartTarget(live,...route);assert.equal(resolved.route,'row');assert.equal(resolved.focus.drawerIndex,2);assert.equal(resolved.focus.unitId,rice.id);
await tap(drawnPart('handle',2));await command('edit-part');assert.equal(workshopPartTarget(live,...route).route,'finish');
await tap({closest:s=>s==='[data-wp-canvas]'?canvas:s===sheetSelector?{dataset:{sheetWorktop:rice.runId,sheetWall:'back'}}:null});
assert(host.innerHTML.includes('سطح العمل')&&!host.innerHTML.includes('data-width-change'));await command('edit-part');
assert.equal(route[0],'worktop');assert.equal(route[1].runId,rice.runId);assert.equal(saves,2);
stop();
console.log('Mounted saved-project selection, real grip drag -> 700 mm, cancel and pinned-edge refusal without a write, explicit Apply then one inverse undo.');
console.log('Target-specific menu capped at four; use form preselects the chosen cabinet and unsaved proposal requires explicit application.');
