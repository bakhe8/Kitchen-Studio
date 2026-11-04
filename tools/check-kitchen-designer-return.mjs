// Real workshop routing and unit-page save/cancel functions. This host covers
// lifecycle and navigation state; it does not simulate browser layout or paint.
import assert from 'node:assert/strict';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {saveProject,openKitchenProject,openUnitContext,kitchenProjectURL,kitchenHistory} from '../public/kitchen-project.js';
import {rememberDesignerReturn,takeDesignerReturn} from '../public/kitchen-viewport.js';
import {splitTarget} from '../public/shelf-selection-model.js';

class Store{
 data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
 getItem(key){return this.data.get(key)??null;}setItem(key,value){this.data.set(key,String(value));}removeItem(key){this.data.delete(key);}
}
class Part{
 constructor(){this.nodes=new Map();this.listeners=new Map();this.dataset={};this.attributes=new Map();this.hidden=false;this.isConnected=true;this._html='';}
 querySelector(selector){
  if(selector==='[name="widthMm"]'&&!this._html.includes('name="widthMm"'))return null;
  if(!this.nodes.has(selector))this.nodes.set(selector,new Part());
  const node=this.nodes.get(selector);
  if(selector==='[name="widthMm"]')node.value=this._html.match(/name="widthMm"[^>]*value="([^"]+)"/)?.[1];
  return node;
 }
 querySelectorAll(){return [];}
 set innerHTML(value){this._html=String(value);const box=this._html.match(/<svg[^>]+viewBox="([^"]+)"/)?.[1];if(box)this.querySelector('svg').setAttribute('viewBox',box);}
 get innerHTML(){return this._html;}
 setAttribute(key,value){this.attributes.set(key,String(value));}getAttribute(key){return this.attributes.get(key)??null;}hasAttribute(key){return this.attributes.has(key);}removeAttribute(key){this.attributes.delete(key);}
 addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));}
 focus(){document.activeElement=this;}contains(){return true;}matches(){return false;}scrollIntoView(){}
 append(node){this.child=node;node.isConnected=true;}replaceChildren(){this.child=null;}remove(){this.isConnected=false;}
 getClientRects(){return this.isConnected&&!this.hidden?[1]:[];}
 getBoundingClientRect(){return {left:0,top:0,width:900,height:600,right:900,bottom:600};}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
globalThis.document={createElement:()=>new Part(),activeElement:null};
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.location={href:'https://example.test/?panel=workshop&step=whole',assign(value){this.href=value;}};
const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok,generated.reason);
const source=structuredClone(generated.candidates[0].doc);source.room.projectId='K-1234567890ABCDEF';
assert(saveProject(source));let live=openKitchenProject();
const unit=proposalUnits(live).find(u=>u.family==='storage');assert(unit);
const camera={zoom:2,x:.4,y:.6},focus={projectId:live.room.projectId,unitId:unit.id,runId:unit.runId,proposalView:'back',yaw:108,frameUnits:false,camera,
 views:[{key:JSON.stringify(['back',null,null]),camera,unitId:unit.id},{key:JSON.stringify(['plan','base',null]),camera:{zoom:1.4,x:.3,y:.7},unitId:unit.id}]};
const root=new Part(),external=[];
const shell=mountWorkshop(root,{getDoc:()=>live,apply(){assert.fail('navigation must not write the design');},tell(){},closeOthers(){},opener:new Part(),onExternalStep:(...args)=>external.push(args)});
shell.open('whole',focus);
const viewport=root.child.querySelector('.ws-content');
for(let i=0;i<100&&viewport.child?.hasAttribute('aria-busy');i++)await new Promise(resolve=>setTimeout(resolve,5));
assert(viewport.child?.innerHTML.includes('proposal-studio'),'the actual lazy designer route mounted');
shell.open('unit-part',{unitId:unit.id,part:'inside'});
assert.equal(shell.active(),false);
assert.equal(external.length,1);assert.equal(external[0][0],'unit-interior');assert.equal(external[0][1].unitId,unit.id);
const origin=external[0][2];assert(origin,'the router captures designer context before hiding its controller');
assert.deepEqual(origin.camera,camera);assert.deepEqual(origin.views,focus.views);assert.equal(origin.unitId,unit.id);assert.equal(origin.proposalView,'back');

function enterInterior(context=origin){
 const token=rememberDesignerReturn(live,context);assert(token);
 const url=new URL(kitchenProjectURL('kitchen-unit',unit.id,{view:'top',yaw:32,pitch:25}));url.searchParams.set('designerReturn',token);
 location.assign(url.href);assert.equal(new URL(location.href).pathname,'/unit.html');
 assert.equal(takeDesignerReturn(live,new URL(location.href).searchParams),null,'the outbound unit page does not consume its return state');
 const editor=openUnitContext(unit.id);assert(editor,'the real interior editor accepts this unit');return {editor,token};
}
const storedBefore=JSON.stringify(openKitchenProject()),historyBefore=kitchenHistory().length;
let {editor,token}=enterInterior();editor.cancel();
let returned=new URL(location.href);assert.equal(returned.pathname,'/');assert.equal(returned.searchParams.get('designerReturn'),token);
assert.equal(JSON.stringify(openKitchenProject()),storedBefore);assert.equal(kitchenHistory().length,historyBefore,'cancelling the interior creates no project history');
assert.deepEqual(takeDesignerReturn(live,returned.searchParams),origin,'the cancel return preserves the designer object and every camera');
assert.equal(takeDesignerReturn(live,returned.searchParams),null,'a return state is consumed once');

({editor,token}=enterInterior());const split=splitTarget(editor.plan,{kind:'cabinet'},'col');assert(split.ok,split.reason);
assert.equal(editor.save(split.plan),'','the real interior save succeeds');
live=openKitchenProject();returned=new URL(location.href);assert.equal(returned.pathname,'/');assert.equal(returned.searchParams.get('designerReturn'),token);
assert(live.kitchen.units.find(u=>u.id===unit.id).detail);assert.equal(kitchenHistory().length,historyBefore+1);
assert.deepEqual(takeDesignerReturn(live,returned.searchParams),origin,'a saved interior returns to the same stable object in the new document');
assert(!JSON.stringify(live).includes('designerReturn'),'navigation state never enters the saved design');

const paramsFor=token=>new URLSearchParams({view:'kitchen',unit:unit.id,designerReturn:token});
token=rememberDesignerReturn(live,origin);
const other={...live,room:{...live.room,projectId:'K-FEDCBA0987654321'}};
assert.equal(takeDesignerReturn(other,paramsFor(token)),null);assert.equal(takeDesignerReturn(live,paramsFor(token)),null,'another project discards the old context');
token=rememberDesignerReturn(live,origin);
const removed={...live,kitchen:{...live.kitchen,units:live.kitchen.units.filter(u=>u.id!==unit.id)}};
assert.equal(takeDesignerReturn(removed,paramsFor(token)),null,'a removed object is never recreated by a return snapshot');
token=rememberDesignerReturn(live,origin);const wrong=paramsFor(token);wrong.set('unit','another-unit');assert.equal(takeDesignerReturn(live,wrong),null);
token=rememberDesignerReturn(live,origin);rememberDesignerReturn(live,null);assert.equal(takeDesignerReturn(live,paramsFor(token)),null,'entering the unit from CAD clears a stale designer origin');
shell.open('whole',origin);shell.close(false);
console.log('Designer return: real workshop captures origin, real /unit.html cancel/save preserves one-use context, and project/unit mismatches discard it without modifying design history.');
