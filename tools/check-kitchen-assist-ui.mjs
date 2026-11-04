import assert from 'node:assert/strict';
import {mountFieldAssistant} from '../public/kitchen-assist-ui.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {readFieldRegister} from '../public/kitchen-field-model.js';

class Host{
 constructor(){this.innerHTML='';this.listeners={};this.nodes=new Map();}
 contains(){return true;}closest(){return null;}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,{dataset:{},value:'',hidden:false,focus(){},querySelector(){return null;}});return this.nodes.get(s);}
 addEventListener(e,fn){this.listeners[e]=fn;}removeEventListener(e,fn){if(this.listeners[e]===fn)delete this.listeners[e];}
 click(op,d={}){const button={dataset:{kaDo:op,...d}};this.listeners.click({target:{closest:()=>button}});}
 value(s,v){const target={matches:t=>t===s,value:v};this.listeners[s==='[data-ka-input]'?'input':'change']({target});if(s==='[data-ka-input]')this.querySelector(s).value=v;}
 submit(){this.listeners.submit({target:{matches:s=>s==='.ka-input-form'},preventDefault(){}});}
}
const host=new Host,history=[],visits=[];let doc=makeFurnishedSaudiRoom('villa'),key=1;
const assistant=mountFieldAssistant(host,{getDoc:()=>doc,getProjectKey:()=>key,apply:next=>{history.push(doc);doc=next;return {ok:true,changed:true,saved:true};},onUndo(){doc=history.pop();},onContext:s=>visits.push(s),onCatalog(){}});
assert.equal(assistant.getState().topic,'site');assert.equal((host.innerHTML.match(/data-ka-prompt/g)||[]).length,1);assert((host.innerHTML.match(/data-ka-code=/g)||[]).length<=3);assert(host.innerHTML.includes('ka-observed')&&host.innerHTML.includes('٤٬٤٠٠'),'visible site-confirmation card must show the actual CAD values');
host.value('[data-ka-topic]','equipment');const dishwasher=doc.kitchen.units.find(u=>u.kind==='dishwasher');assert.equal(assistant.getState().entityId,dishwasher.id);
assert.equal(assistant.getState().questionId,'bearing');host.click('choose',{kaOpt:'0'});assert.equal(assistant.getState().questionId,'min','the support datum from the preceding answer and the designed counter do not become required re-entry');
assert(host.innerHTML.includes('إدخال قياس فعلي'),'designed underside can be replaced with site measurement');
host.value('[data-ka-input]','820');assert(assistant.isDirty());host.value('[data-ka-topic]','customer');assert.equal(assistant.getState().topic,'equipment','never discard a typed field to switch tracks');
host.click('keep');host.submit();assert(!assistant.isDirty());assert.equal(assistant.getState().questionId,undefined);assert.match(host.innerHTML,/فائض ٤٠ مم/);
host.click('edit',{kaQid:'top'});assert.equal(assistant.getState().questionId,'top');host.value('[data-ka-input]','٨٨٠');host.submit();assert.match(host.innerHTML,/فائض ٦٠ مم/);assert.equal(readFieldRegister(doc.room).records.length,3);
host.click('undo');assert.equal(readFieldRegister(doc.room).records.length,2);assert.match(host.innerHTML,/فائض ٤٠ مم/);
host.value('[data-ka-scope]','@field');assert.equal(assistant.getState().questionId,'present');host.click('unknown');assert.equal(assistant.getState().questionId,undefined);assert.match(host.innerHTML,/مؤجّل/);host.click('edit',{kaQid:'present'});host.click('choose',{kaOpt:1});assert.equal(assistant.getState().questionId,undefined);assert.match(host.innerHTML,/الفحص غير منطبق/);
host.value('[data-ka-scope]',dishwasher.id);assert.equal(assistant.getState().entityId,dishwasher.id);host.click('edit',{kaQid:'min'});host.value('[data-ka-input]','999');const previousCount=readFieldRegister(doc.room).records.length;doc=makeFurnishedSaudiRoom('hasa');key=2;assistant.refresh();host.submit();assert.equal(readFieldRegister(doc.room).records.length,0,'an in-progress value cannot land in a different project');host.click('discard-stale');assert(!assistant.isDirty());assert(visits.length>=3);assistant.destroy();assert.equal(Object.keys(host.listeners).length,0);
console.log('Guided UI: one actionable question, visible design measurements before confirmation, scope-specific branching, optional override, Arabic numerals, automatic results, safe undo, deferred answers, dirty and stale-project handling.');
