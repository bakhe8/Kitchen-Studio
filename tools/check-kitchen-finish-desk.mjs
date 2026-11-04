import assert from 'node:assert/strict';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {finishMembers} from '../public/kitchen-finish-parts.js';
import {sheetSelector} from '../public/kitchen-sheet-target.js';
import {mountFinishDesk} from '../public/kitchen-finish-desk.js';
const doc=(await proposeWholeKitchen(makeVisitExample())).candidates[0].doc,cat=structuredClone(getFactoryCatalog(doc));
const list=finishMembers(doc,cat),rice=list.find(m=>m.family==='rice'),storage=list.find(m=>m.family==='storage');assert(rice&&storage);
cat.families.rice.finishSlots={handle:{source:'PULL',skus:['PULL'],labels:['يد'],mode:'matching',reference:'TEST-HANDLE'}};cat.families.storage.finishSlots={body:{source:'BODY-6',skus:['BODY-6'],labels:['جانب جسم'],mode:'matching',reference:'TEST-BODY'}};
class Node {
 constructor(){this.parts=new Map();this.listeners={};this.innerHTML='';this.dataset={};this.style={};}
 querySelector(s){if(!this.parts.has(s))this.parts.set(s,new Node());return this.parts.get(s);}
 querySelectorAll(){return [];}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
 removeEventListener(t,f){this.listeners[t]=this.listeners[t]?.filter(x=>x!==f);}
 getAttribute(k){return this.attrs?.[k];}
 closest(s){return this.attrs&&s in this.attrs?this:null;}
 focus(){} contains(){return true;}
}
const host=new Node();let saved=null,docNow=doc,wallChoice=null;
const desk=mountFinishDesk(host,{doc,catalog:cat,getDoc:()=>docNow,focus:{unitId:rice.id},onSurvey:f=>{wallChoice=f;},onApply:(buildNext,label,focus)=>{saved={next:buildNext(),focus};}});
function click(attrs){const n=new Node();n.attrs=attrs;const target={closest:s=>s in attrs?n:null};for(const fn of host.listeners.click||[])fn({target});}
assert.match(host.innerHTML,/data-finish-scope/);assert(!host.innerHTML.includes('data-wp-grip'));
assert.match(host.innerHTML,/data-finish-kind="handles"/);assert(!host.innerHTML.includes('data-finish-kind="materials"'));
assert.equal(saved,null);
click({'[data-sheet-unit]':'', 'data-sheet-unit':storage.id});assert.match(host.innerHTML,/data-finish-kind="materials"/);assert(!host.innerHTML.includes('data-finish-kind="handles"'));assert.equal(saved,null);
click({'[data-sheet-unit]':'', 'data-sheet-unit':'foreign'});assert(!host.innerHTML.includes('foreign'));
const panel=host.querySelector('[data-finish-editor]'),field=panel.querySelector('[data-finish-sku]'),confirm=panel.querySelector('[data-finish-confirm]');
field.value='FACE-6-G';field.onchange();assert.equal(saved,null,'preview may not commit');
await confirm.onclick();assert.deepEqual(saved.next.room.workshop.finishes.units[storage.id],{frontSku:'FACE-6-G'});assert.equal(saved.next.room.workshop.finishes.units[rice.id],undefined);assert.equal(saved.focus.unitId,storage.id);
const previous=saved,window=doc.kitchen.features.find(f=>f.kind==='window'),appliance=doc.kitchen.units.find(u=>u.kind==='dishwasher');
click({'[data-sheet-feature]':'','data-sheet-feature':window.id});
assert.match(panel.innerHTML,/٢٬٠٠٠ مم/);assert.match(panel.innerHTML,/١٬٢٠٠ مم/);
assert(!panel.innerHTML.includes('data-finish-confirm')&&!host.innerHTML.includes('data-finish-kind='));
await confirm.onclick();assert.equal(saved,previous,'a click on the window disarms the prior cabinet write');
click({'[data-finish-survey]':''});assert.equal(wallChoice,window);
click({'[data-sheet-unit]':'','data-sheet-unit':appliance.id});
assert.match(panel.innerHTML,/لا تتوفر لهذه الوحدة خيارات تشطيب/);assert(!panel.innerHTML.includes('data-finish-confirm'));
click({'[data-sheet-unit]':'','data-sheet-unit':rice.id});assert.match(panel.innerHTML,/data-finish-confirm/);
const retained=saved;docNow=structuredClone(doc);field.value='FACE-6-W';await confirm.onclick();assert.equal(saved,retained,'a stale editor cannot change the next design');
desk.destroy();console.log('Finish workspace filters materials/handles by the tapped unit, selection cannot commit or resize, unrelated objects ignored.');

const exactHost=new Node();let written=0,advanced=null;
const exact=mountFinishDesk(exactHost,{doc,catalog:cat,getDoc:()=>doc,onApply:()=>{written++;},onInspectPart:(...args)=>{advanced=args;}});
const drawn=(unit,part,index)=>({dataset:{sheetUnit:unit,sheetPart:part,sheetIndex:String(index)},getAttribute(k){return k==='data-sheet-unit'?unit:null;}});
function partTap(item){
 const target={closest:s=>s===sheetSelector||s==='[data-sheet-unit]'||s==='[data-finish-drawing]'?item:null};
 for(const fn of exactHost.listeners.click)fn({target});
}
const exactPanel=exactHost.querySelector('[data-finish-editor]');
partTap(drawn(rice.id,'drawer',2));
assert.deepEqual(exact.commandContext(),{unitId:rice.id,face:'back',kind:'front',part:'drawer',index:2});
assert.match(exactHost.innerHTML,/استخدام هذا الدرج/);
const obsolete=exactPanel.querySelector('[data-finish-confirm]').onclick;
for(const fn of exactHost.listeners.click)fn({target:{closest:s=>s==='[data-finish-drawer-use]'?{}:null}});
assert.deepEqual(advanced,['unit-part',{unitId:rice.id,part:'drawer',index:2}]);
partTap(drawn(rice.id,'handle',2));
assert.equal(exact.commandContext().kind,'handles');
assert.match(exactPanel.innerHTML,/value="handle"/);assert(!exactPanel.innerHTML.includes('value="hinge"'));
await obsolete();assert.equal(written,0);
partTap(drawn(storage.id,'handle',1));assert.match(exactPanel.innerHTML,/لم ينشر المصنع/);
assert.equal(exact.commandContext().unitId,storage.id);assert.equal(written,0);
exact.destroy();console.log('A drawn drawer retains its ordinal and separate use editor. Tapping its handle shows only published handle parts; stale submits and unpublished choices do not write.');
