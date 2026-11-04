// Real designer controller + geometry/domain code. The host models event
// ordering and form fields only; it has no ownerDocument/defaultView, so the
// separately tested pointer/keyboard precision helper is not mounted here.
import assert from 'node:assert/strict';
import {mountWholePlan} from '../public/kitchen-whole-plan-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {flushUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {workshopPartTarget} from '../public/kitchen-sheet-target.js';

class Store{
 data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
 getItem(key){return this.data.get(key)??null;}setItem(key,value){this.data.set(key,String(value));}removeItem(key){this.data.delete(key);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
globalThis.DOMPoint=class{
 constructor(x=0,y=0){this.x=x;this.y=y;}
 matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}
};
globalThis.FormData=class{constructor(form){this.form=form;}get(name){return this.form.elements.namedItem(name)?.value??null;}};
const frames=new Map();let frameId=0;
globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function flushFrames(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}}
const identity={a:1,b:0,c:0,d:1,e:0,f:0};
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attributes=text=>Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
const dataset=attrs=>Object.fromEntries(Object.entries(attrs).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));
const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok,generated.reason);
const source=structuredClone(generated.candidates[0].doc);source.room.projectId='K-1234567890ABCDEF';
const units=proposalUnits(source),rice=units.find(u=>u.family==='rice'),storage=units.find(u=>u.runId===rice.runId&&u.family==='storage');
assert(rice&&storage);assert.equal(rice.widthMm,600);assert.equal(storage.widthMm,900);

function fixture(initial=source,{resume=false,store=new Store(),writable=true,returnFocus}={}){
 globalThis.localStorage=store;
 let live=structuredClone(initial),saves=0,markup='',input=null,dispose,back=null,forward=null,renders=0;
 const listeners=new Map(),notices=[],historyCalls=[],advances=[],nodes=new Map(),captures=new Set(),svgAttrs=new Map(),dom={activeElement:null};
 const plainNode=()=>({hidden:false,textContent:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  isConnected:true,focus(){dom.activeElement=this;},select(){},scrollIntoView(){},setAttribute(){},getAttribute(){return null;},removeAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:0,top:0,width:900,height:500,right:900,bottom:500};}});
 const svg={...plainNode(),dataset:{},isConnected:true,
  getAttribute:key=>svgAttrs.get(key),setAttribute:(key,value)=>svgAttrs.set(key,String(value)),getScreenCTM:()=>({inverse:()=>identity}),
  createSVGPoint:()=>new DOMPoint(),contains:target=>target===svg||target?.canvas===canvas};
 const canvas={...plainNode(),markup:'',querySelector:selector=>selector==='svg'?svg:null,
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  set innerHTML(value){this.markup=value;svgAttrs.set('viewBox',value.match(/viewBox="([^"]+)"/)?.[1]);},get innerHTML(){return this.markup;}};
 const form={matches:selector=>selector==='[data-width-change]',elements:{namedItem:name=>name==='widthMm'?input:null}};
 const host={
  ownerDocument:dom,
  contains:target=>target===input||target===svg||target===canvas||target?.canvas===canvas,
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  addEventListener(type,fn,options){
   const entry={fn,capture:options===true||options?.capture};const list=listeners.get(type)||[];list.push(entry);listeners.set(type,list);
   options?.signal?.addEventListener('abort',()=>this.removeEventListener(type,fn),{once:true});
  },
  removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(entry=>entry.fn!==fn));},
  querySelector(selector){
   if(selector==='[data-wp-canvas]')return canvas;
   if(selector==='[data-wp-canvas] svg')return svg;
   if(selector==='[name="widthMm"]'||selector==='input[name="widthMm"]')return input;
   if(selector==='[data-width-change]')return input?form:null;
   if(selector==='[data-plan-controls]'||selector==='.pd-compare[open]')return null;
   if(!nodes.has(selector)){
    const node=plainNode(),attrs=attributes(selector);node.dataset=dataset(attrs);
    node.matches=s=>s===selector;node.closest=s=>s==='button'&&attrs['data-wp']?node:null;
    node.hasAttribute=key=>Object.hasOwn(attrs,key);nodes.set(selector,node);
   }return nodes.get(selector);
  },
  querySelectorAll(){return [];},
  set innerHTML(value){
   renders++;markup=value;if(input)input.isConnected=false;for(const node of nodes.values())node.isConnected=false;nodes.clear();
   const attrs=[...value.matchAll(/<input\b([^>]*)>/g)].map(m=>attributes(m[1])).find(a=>a.name==='widthMm');
   input=attrs?{...plainNode(),value:attrs.value,name:'widthMm',tagName:'INPUT',isConnected:true,
    matches:selector=>['[name="widthMm"]','input[name="widthMm"]','input,select,textarea'].includes(selector),closest:()=>null}:null;
  },get innerHTML(){return markup;}
 };
 async function fire(type,target=input,more={}){
  const event={type,target,button:0,buttons:type==='pointerup'?0:1,isPrimary:true,pointerType:'mouse',pointerId:7,clientX:0,clientY:0,detail:1,
   preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=true;},...more};
  for(const {fn} of [...(listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(event.immediateStopped)break;await fn(event);}
  return event;
 }
 const button=attrs=>({dataset:attrs,hasAttribute:name=>Object.hasOwn(attrs,name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),closest(selector){return selector==='button'?this:null;}});
 const action=wp=>fire('click',button({wp}));
 const view=wpView=>fire('click',button({wpView}));
 const choose=id=>fire('change',{value:id,closest:()=>null,matches:selector=>selector==='[data-wp-unit]'});
 async function type(raw){assert(input,'selected editable unit supplies a real width field');input.value=raw;await fire('input',input);flushFrames();}
 function rect(id){
  const tag=[...canvas.markup.matchAll(/<rect\b([^>]*)>/g)].map(m=>attributes(m[1])).find(a=>a['data-sheet-unit']===id&&a['data-sheet-tier']);
  assert(tag,'the elevation contains the same selected unit identity');
  return Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(tag[k])]));
 }
 function grip(edge){
  const attrs=[...canvas.markup.matchAll(/<g\b([^>]*)>/g)].map(m=>attributes(m[1])).find(a=>a['data-wp-grip']===edge);
  assert(attrs,'the selected unit exposes its '+edge+' grip');
  const target={canvas,dataset:dataset(attrs),getAttribute:key=>attrs[key],closest(selector){return selector==='[data-wp-grip]'?this:selector==='[data-wp-canvas]'?canvas:null;}};
  return {target,dx:Number(attrs['data-axis-x']),dy:Number(attrs['data-axis-y'])};
 }
 async function drag(edge,factor,{end='pointerup',pointerType='mouse'}={}){
  const g=grip(edge);await fire('pointerdown',g.target,{pointerType});
  await fire('pointermove',g.target,{pointerType,clientX:g.dx*factor,clientY:g.dy*factor});flushFrames();
  const preview=rect(rice.id);
  await fire(end,end==='lostpointercapture'?canvas:g.target,{pointerType,clientX:g.dx*factor,clientY:g.dy*factor});flushFrames();return preview;
 }
 const options={getDoc:()=>live,canEdit:()=>writable,apply(next){back=live;forward=null;live=next;saves++;return {ok:true,saved:true};},tell:message=>notices.push(message),onAdvance:(step,focus)=>advances.push({step,focus}),
  canHistory:next=>!!(next?forward:back),onHistory(next){
   historyCalls.push(next);if(next&&forward){back=live;live=forward;forward=null;}else if(!next&&back){forward=live;live=back;back=null;}
   // The real workshop refreshes the designer after its project-history owner
   // changes the document. Keep that lifecycle boundary in this host too.
   dispose();dispose=mountWholePlan(host,{...options,focus:{unitId:rice.id,runId:rice.runId,projectId:live.room.projectId,proposalView:'back'}});
   return {ok:true,saved:true};
  },
  focus:returnFocus||(resume?{}:{unitId:rice.id,runId:rice.runId,projectId:live.room.projectId,proposalView:'back'})};
 dispose=mountWholePlan(host,options);
 return {host,canvas,svg,listeners,nodes,notices,historyCalls,advances,dom,store,fire,action,view,choose,type,rect,grip,drag,
  submit:()=>fire('submit',form),get input(){return input;},get live(){return live;},get saves(){return saves;},get controller(){return dispose;},
  get renders(){return renders;},set writable(value){writable=value;},destroy(){dispose();}};
}

// Missing preview routing fails on geometry, rather than a CSS/snapshot check.
const f=fixture(),baseline=JSON.stringify(f.live),baseRect=f.rect(rice.id),otherRect=f.rect(storage.id);
await f.type('٧٠٠');
assert(f.rect(rice.id).width>baseRect.width,'raw numeric input previews the changed unit geometry before submission');
assert(f.rect(storage.id).width<otherRect.width,'the preview uses the real factory neighbour transfer');
const previewRect=f.rect(rice.id);
assert.equal(JSON.stringify(f.live),baseline);assert.equal(f.saves,0);assert(f.controller.hasPending());
await f.action('apply');assert.equal(f.saves,0,'raw width must be staged before applying the design');
await f.choose(storage.id);assert.equal(f.input.value,'٧٠٠','selection cannot discard a raw measurement');
await f.view('plan');assert.deepEqual(f.rect(rice.id),previewRect,'the current elevation stays available while raw width blocks view switching');
await f.action('design-undo');assert.equal(f.historyCalls.length,0);assert.equal(f.input.value,'٧٠٠');
await f.action('cancel-width');assert.deepEqual(f.rect(rice.id),baseRect);assert.equal(f.input.value,'600');assert(!f.controller.hasPending());
for(const raw of ['', 'خطأ', '٦٥٥', '9000']){
 await f.type(raw);assert.equal(JSON.stringify(f.live),baseline);assert.equal(f.saves,0);
 await f.submit();assert.equal(f.saves,0);assert(f.controller.hasPending(),'invalid raw input remains recoverable');assert.equal(f.input.value,raw);
 await f.choose(storage.id);await f.view('plan');assert.equal(f.input.value,raw);assert.deepEqual(f.rect(rice.id),baseRect);
 await f.action('apply');assert.equal(f.saves,0);await f.action('design-undo');assert.equal(f.historyCalls.length,0);
 await f.action('cancel-width');assert.equal(f.input.value,'600');assert.deepEqual(f.rect(rice.id),baseRect);
}
await f.type('700');await f.submit();assert.equal(f.input.value,'700');assert(f.controller.hasPending());assert.equal(f.saves,0);
await f.action('design-undo');assert.equal(f.input.value,'600');assert(!f.controller.hasPending());assert.equal(f.historyCalls.length,0);
await f.action('design-redo');assert.equal(f.input.value,'700');assert(f.controller.hasPending());assert.equal(f.saves,0);
await f.action('apply');assert.equal(f.saves,1);assert.equal(f.live.kitchen.units.find(u=>u.id===rice.id).width,70);assert(!f.controller.hasPending());
await f.action('design-undo');assert.deepEqual(f.historyCalls,[false],'saved history is delegated to its authoritative owner');assert.equal(f.live.kitchen.units.find(u=>u.id===rice.id).width,60);
await f.action('design-redo');assert.deepEqual(f.historyCalls,[false,true]);assert.equal(f.live.kitchen.units.find(u=>u.id===rice.id).width,70);
f.destroy();assert([...f.listeners.values()].every(list=>!list.length),'destruction removes both controller and drawing listeners');
console.log('Designer controller: raw preview, invalid input and transition guards, cancel, local undo/redo, explicit apply and persisted-history delegation.');

const m=fixture(),moveBase=m.rect(rice.id),moveOriginal=JSON.stringify(m.live);
const preview=await m.drag('move',1.25,{end:'pointercancel'});assert(preview.x>moveBase.x,'moving the unit previews a real reorder');
assert.deepEqual(m.rect(rice.id),moveBase);assert(!m.controller.hasPending());assert.equal(JSON.stringify(m.live),moveOriginal);
for(const end of ['Escape','lostpointercapture','pinch']){
 const g=m.grip('move'),pointerType=end==='pinch'?'touch':'mouse';
 await m.fire('pointerdown',g.target,{pointerType});
 await m.fire('pointermove',g.target,{pointerType,clientX:g.dx*1.25,clientY:g.dy*1.25});flushFrames();
 assert(m.rect(rice.id).x>moveBase.x);
 if(end==='Escape')await m.fire('keydown',m.svg,{key:'Escape'});
 else if(end==='pinch')await m.fire('pointerdown',g.target,{pointerId:8,pointerType:'touch',isPrimary:false,clientX:100,clientY:100});
 else await m.fire(end,m.canvas);
 assert.deepEqual(m.rect(rice.id),moveBase,end+' cancels geometry before another interaction');assert(!m.controller.hasPending());
 await m.fire('pointerup',g.target,{pointerType,clientX:g.dx*1.25,clientY:g.dy*1.25});
 if(end==='pinch')await m.fire('pointerup',g.target,{pointerId:8,pointerType:'touch',isPrimary:false,clientX:100,clientY:100});
 assert.equal(JSON.stringify(m.live),moveOriginal);assert.equal(m.saves,0);
}
await m.drag('move',1.25);assert(m.rect(rice.id).x>moveBase.x);assert(m.controller.hasPending());assert.equal(m.saves,0);
await m.action('design-undo');assert.deepEqual(m.rect(rice.id),moveBase);assert(!m.controller.hasPending(),'one completed drag contributes one local history transaction');
await m.action('design-redo');assert(m.rect(rice.id).x>moveBase.x);assert(m.controller.hasPending());
await m.action('apply');assert.equal(m.saves,1);
const movedRow=m.live.room.workshop.rows[rice.runId];
assert.equal(movedRow.units.find(u=>u.id===rice.id).startMm,2200);assert.equal(movedRow.units.find(u=>u.id===storage.id).startMm,1300);
assert.equal(m.live.kitchen.units.find(u=>u.id===rice.id).width,60);assert.equal(m.live.kitchen.units.find(u=>u.id===storage.id).width,90);
m.destroy();console.log('Designer controller: move-grip preview/cancel, stable identity/width, one staged transaction and atomic explicit application.');

const draftStore=new Store(),draft=fixture(source,{store:draftStore});await draft.drag('move',1.25);draft.destroy();
assert([...draftStore.data.keys()].some(key=>key.includes(':draft:design:')),'the staged designer recipe is kept for reload');
const restored=fixture(source,{store:draftStore,resume:true});
for(let i=0;i<100&&!restored.controller.hasPending();i++)await new Promise(resolve=>setTimeout(resolve,5));
assert(restored.controller.hasPending(),'restoring the design recipe replays the real move');assert.equal(restored.saves,0);
await restored.choose(rice.id);await restored.view('back');assert(restored.rect(rice.id).x>moveBase.x);
await restored.action('apply');assert.equal(restored.saves,1);assert.equal(restored.live.kitchen.units.find(u=>u.id===rice.id).u,220);
restored.destroy();console.log('Designer controller: stored draft recipe replays the accepted unit move without a project write until Apply.');

// Revoking a role must reach the controller, not depend on disabled buttons.
// Keep a readonly marker on the current field: rebuilding the editor would
// remove the workshop's readonly decoration even if the final save is denied.
const permission=fixture(),permissionSource=JSON.stringify(permission.live);
await permission.type('٧٠٠');const protectedInput=permission.input;protectedInput.readOnly=true;protectedInput.disabled=true;
permission.writable=false;const readonlyRenders=permission.renders;
await permission.submit();await permission.action('plus');await permission.action('apply');await permission.action('design-undo');await permission.action('design-redo');
assert.equal(permission.input,protectedInput,'denied numeric actions preserve the existing readonly field');
assert.equal(permission.input.value,'٧٠٠');assert.equal(permission.input.readOnly,true);assert.equal(permission.input.disabled,true);
assert.equal(permission.renders,readonlyRenders,'denied edits cannot rebuild away the workshop readonly state');
assert.equal(permission.saves,0);assert.equal(permission.historyCalls.length,0);assert.equal(JSON.stringify(permission.live),permissionSource);
permission.writable=true;permission.input.readOnly=false;permission.input.disabled=false;
await permission.action('cancel-width');assert.equal(permission.input.value,'600');assert(!permission.controller.hasPending(),'denied submission never staged a hidden local edit');
await permission.type('700');await permission.submit();
permission.writable=false;const stagedRect=permission.rect(rice.id),stagedRenders=permission.renders;
await permission.action('design-undo');await permission.action('design-redo');await permission.action('apply');
assert.deepEqual(permission.rect(rice.id),stagedRect);assert.equal(permission.renders,stagedRenders);assert.equal(permission.saves,0);assert.equal(permission.historyCalls.length,0);
permission.writable=true;await permission.action('apply');assert.equal(permission.saves,1);
permission.writable=false;await permission.action('design-undo');assert.equal(permission.historyCalls.length,0,'live permission also guards authoritative saved history');
assert.equal(permission.live.kitchen.units.find(u=>u.id===rice.id).width,70);permission.destroy();

for(const revokeAt of ['queued-frame','painted-preview']){
 const denied=fixture(),base=denied.rect(rice.id),before=JSON.stringify(denied.live),g=denied.grip('move');
 await denied.fire('pointerdown',g.target);await denied.fire('pointermove',g.target,{clientX:g.dx*1.25,clientY:g.dy*1.25});
 if(revokeAt==='painted-preview'){flushFrames();assert(denied.rect(rice.id).x>base.x);}
 denied.writable=false;const renders=denied.renders;
 if(revokeAt==='queued-frame')flushFrames();
 else await denied.fire('pointermove',g.target,{clientX:g.dx*1.3,clientY:g.dy*1.3});
 assert.deepEqual(denied.rect(rice.id),base,revokeAt+' cancels before another pointer event can authorize a preview');
 assert(!denied.controller.hasPending(),'revoked drag is no longer an active transaction');
 await denied.fire('pointerup',g.target,{clientX:g.dx*1.25,clientY:g.dy*1.25});flushFrames();
 assert.deepEqual(denied.rect(rice.id),base,revokeAt+' permission loss restores the actual source geometry');
 assert(!denied.controller.hasPending());assert.equal(denied.renders,renders);assert.equal(JSON.stringify(denied.live),before);assert.equal(denied.saves,0);
 denied.destroy();
}
console.log('Designer permissions: live revocation blocks raw/staged/saved edits and cancels an active or queued move without rebuilding readonly controls.');

const readonlyStore=new Store(),editableDraft=fixture(source,{store:readonlyStore});await editableDraft.type('٧٠٠');editableDraft.destroy();
const readonlyRecord=[...readonlyStore.data.entries()];assert(readonlyRecord.some(([key])=>key.includes(':draft:design:')));
const readonly=fixture(source,{store:readonlyStore,resume:true,writable:false});
await Promise.resolve();assert(!readonly.controller.hasPending(),'readonly reopening must not install a persisted raw recipe');
assert.equal(readonly.saves,0);assert.equal(readonly.live.kitchen.units.find(u=>u.id===rice.id).width,60);
readonly.destroy();assert.deepEqual([...readonlyStore.data.entries()],readonlyRecord,'a readonly visit preserves the recoverable draft for an authorized visit');

const cancelStore=new Store(),cancelled=fixture(source,{store:cancelStore});
await cancelled.type('700');await cancelled.submit();await cancelled.action('apply');
await cancelled.type('800');flushUnsavedWork();
assert([...cancelStore.data.keys()].some(key=>key.includes(':draft:design:')),'a raw preview from a saved design is recoverable before cancellation');
await cancelled.action('cancel-width');assert.equal(cancelled.input.value,'700');assert(!cancelled.controller.hasPending());
assert(![...cancelStore.data.keys()].some(key=>key.includes(':draft:design:')),'cancelling the raw preview removes its recovery record');
const savedSource=structuredClone(cancelled.live);cancelled.destroy();
const cleanReopen=fixture(savedSource,{store:cancelStore,resume:true});await Promise.resolve();
assert(!cleanReopen.controller.hasPending(),'a cancelled raw preview cannot revive when the saved project reopens');
assert.equal(cleanReopen.live.kitchen.units.find(u=>u.id===rice.id).width,70);assert.equal(cleanReopen.saves,0);cleanReopen.destroy();
console.log('Designer recovery: readonly opening preserves but does not replay drafts; cancelling a raw preview removes recovery state before reopening.');

// These cases exercise real controller transitions. Losing a selection, restoring
// the wrong viewBox, or focusing a detached opener must fail independently.
const contextFailures=[];
async function contextCheck(name,run){try{await run();console.log('PASS context: '+name);}catch(error){contextFailures.push(error);console.error('FAIL context: '+name+' — '+error.message);}}
await contextCheck('detail close restores the selected object, original view and rebuilt opener',async()=>{
 const f=fixture(),before=JSON.stringify(f.live),opener=f.host.querySelector('[data-wp="details"]');opener.focus();
 await f.fire('click',opener);assert.equal(f.dom.activeElement,f.host.querySelector('[data-pd-open]'));
 await f.view('plan');await f.action('close-sheet');
 assert.equal(f.controller.selectionForReturn()?.unitId,rice.id);
 assert.equal(f.controller.selectionForReturn()?.proposalView,'back','closing details restores its originating view');
 assert.equal(f.dom.activeElement,f.host.querySelector('[data-wp="details"]'),'focus returns to the rebuilt opener');
 assert.equal(JSON.stringify(f.live),before);assert.equal(f.saves,0);f.destroy();
});
await contextCheck('interior entry and return restore object identity, view, camera and focus',async()=>{
 const f=fixture();await f.choose(storage.id);await f.fire('keydown',f.svg,{key:'+'});f.svg.focus();
 const before=f.svg.getAttribute('viewBox'),pick={canvas:f.canvas,dataset:{sheetUnit:storage.id,sheetPart:'inside'},
  closest(selector){return selector==='[data-wp-canvas]'?f.canvas:selector.includes('[data-sheet-unit]')?this:null;}};
 await f.fire('click',pick);await f.action('edit-part');
 assert.equal(f.advances.length,1);assert.equal(workshopPartTarget(f.live,f.advances[0].step,f.advances[0].focus).route,'unit-interior');
 const returnFocus=f.controller.selectionForReturn();assert.equal(returnFocus.unitId,storage.id);f.destroy();
 const returned=fixture(source,{returnFocus});assert.equal(returned.controller.selectionForReturn()?.unitId,storage.id);
 assert.equal(returned.controller.selectionForReturn()?.proposalView,'back');assert.equal(returned.svg.getAttribute('viewBox'),before);
 assert.equal(returned.dom.activeElement,returned.svg,'interior return focuses the originating drawing');returned.destroy();
});
await contextCheck('drawing feature details restore the originating unit, view and drawing focus',async()=>{
 const f=fixture(),feature=source.kitchen.features.find(item=>item.wall==='back'),before=f.svg.getAttribute('viewBox');f.svg.focus();
 const pick={canvas:f.canvas,dataset:{sheetFeature:feature.id},getAttribute:key=>key==='data-sheet-feature'?feature.id:null,
  closest(selector){return selector==='[data-wp-canvas]'?f.canvas:selector==='[data-sheet-feature]'||selector.includes(',')&&selector.includes('[data-sheet-feature]')?this:null;}};
 await f.fire('click',pick);await f.view('plan');await f.action('close-sheet');
 assert.equal(f.controller.selectionForReturn()?.proposalView,'back','drawing detail uses the same return context as a panel button');
 assert.equal(f.controller.selectionForReturn()?.unitId,rice.id);assert.equal(f.svg.getAttribute('viewBox'),before);assert.equal(f.dom.activeElement,f.svg);f.destroy();
});
await contextCheck('return context carries the current keyboard opener instead of a stale prior opener',async()=>{
 const f=fixture();f.input.focus();const returnFocus=f.controller.selectionForReturn();f.destroy();
 const returned=fixture(source,{returnFocus});assert.equal(returned.dom.activeElement,returned.input,'a rebuilt input can receive the return focus');returned.destroy();
});
await contextCheck('switching walls and drawing views preserves stable unit selection',async()=>{
 const twoWalls=structuredClone(source);twoWalls.kitchen.runs.push({...twoWalls.kitchen.runs[0],id:'context-right',wall:'right'});
 const f=fixture(twoWalls);await f.view('right');
 assert.equal(f.controller.selectionForReturn()?.unitId,rice.id,'an offscreen unit remains selected by stable identity');
 assert.equal(f.controller.selectionForReturn()?.proposalView,'right');
 await f.view('volume');await f.view('plan');await f.view('back');assert.equal(f.controller.selectionForReturn()?.unitId,rice.id);f.destroy();
});
await contextCheck('each view restores its own camera, volume rotation and framing across a return',async()=>{
 const f=fixture();await f.fire('keydown',f.svg,{key:'+'});const back=f.svg.getAttribute('viewBox');
 await f.view('volume');await f.action('rotate');await f.action('framing');await f.fire('keydown',f.svg,{key:'+'});const volume=f.svg.getAttribute('viewBox');
 await f.view('plan');await f.fire('keydown',f.svg,{key:'-'});const plan=f.svg.getAttribute('viewBox');
 await f.view('back');assert.equal(f.svg.getAttribute('viewBox'),back,'returning to the elevation restores its camera');
 const returnFocus=f.controller.selectionForReturn();f.destroy();const returned=fixture(source,{returnFocus});
 await returned.view('volume');assert.equal(returned.svg.getAttribute('viewBox'),volume,'volume frame and camera survive interior return');
 assert.equal(returned.controller.selectionForReturn().yaw,108);assert.equal(returned.controller.selectionForReturn().frameUnits,false);
 await returned.view('plan');assert.equal(returned.svg.getAttribute('viewBox'),plan);returned.destroy();
});
await contextCheck('detail close restores the original volume rotation and frame after visiting another view',async()=>{
 const f=fixture();await f.view('volume');await f.fire('keydown',f.svg,{key:'+'});const before=f.svg.getAttribute('viewBox');
 await f.action('details');await f.action('rotate');await f.action('framing');await f.view('plan');await f.action('close-sheet');
 const context=f.controller.selectionForReturn();assert.equal(context.proposalView,'volume');
 assert.equal(context.yaw,18,'a remembered volume view cannot override the detail origin');assert.equal(context.frameUnits,true);
 assert.equal(f.svg.getAttribute('viewBox'),before);f.destroy();
});
await contextCheck('Escape closes transient details before clearing selection or surrounding navigation',async()=>{
 const f=fixture();await f.action('details');
 const first=await f.fire('keydown',f.host.querySelector('[data-pd-open]'),{key:'Escape'});
 assert(first.defaultPrevented&&first.stopped,'the first Escape is consumed by the transient panel');
 assert.equal(f.controller.selectionForReturn()?.unitId,rice.id,'first Escape keeps the object selected');
 const second=await f.fire('keydown',f.svg,{key:'Escape'});assert(second.defaultPrevented&&second.stopped);
 assert.equal(f.controller.selectionForReturn(),null,'second Escape clears selection');
 const third=await f.fire('keydown',f.svg,{key:'Escape'});assert(!third.defaultPrevented,'surrounding navigation can handle the next Escape');f.destroy();
});
await contextCheck('restoring settings abandons its snapshot before another unit opens details',async()=>{
 const f=fixture();await f.action('settings');await f.action('restore');await f.choose(storage.id);await f.view('plan');
 await f.fire('keydown',f.svg,{key:'+'});const before=f.svg.getAttribute('viewBox');
 await f.action('details');await f.action('close-sheet');
 assert.equal(f.controller.selectionForReturn()?.unitId,storage.id,'the current unit B replaces the abandoned settings origin A');
 assert.equal(f.controller.selectionForReturn()?.proposalView,'plan');assert.equal(f.svg.getAttribute('viewBox'),before);f.destroy();
});
assert.equal(contextFailures.length,0,contextFailures.map(error=>error.message).join('\n'));
