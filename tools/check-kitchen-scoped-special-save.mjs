import assert from 'node:assert/strict';
import {mountScopedWorkspace} from '../public/kitchen-scoped-workspace.js';
import {executeProjectOperation as execute} from '../public/kitchen-scoped-operations.js';
import {projectView} from '../public/kitchen-project-scope.js';
import {operationFixture} from './check-kitchen-project-operations.mjs';

class Store{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
// Preserve actual event handlers and form identity; only selector lookup is
// stubbed because this regression concerns the workspace's async save contract.
class Host{
 constructor(selector=''){this.selector=selector;this.memo=new Map();this.handlers={};this._html='';this.classList={add(){},remove(){}};this.dataset={};this.value='';}
 set innerHTML(value){this._html=value;this.memo.clear();}get innerHTML(){return this._html;}
 querySelector(selector){if(!this.memo.has(selector))this.memo.set(selector,new Host(selector));return this.memo.get(selector);}querySelectorAll(){return [];}
 addEventListener(kind,handler){(this.handlers[kind]??=[]).push(handler);}append(){}before(){}replaceChildren(){this.innerHTML='';}
 matches(selector){return selector===this.selector;}closest(selector){return this.matches(selector)?this:null;}
 async fire(kind,target=this){for(const handler of this.handlers[kind]||[])await handler({target,preventDefault(){},stopPropagation(){}});}
}
globalThis.document={head:new Host(),querySelector(){return null;},createElement(){return new Host();}};
const fixture=operationFixture(),id='special-save-project-0001',subject='factory-user',unitId=fixture.unitId;let archive=fixture.archive,revision=4;
const run=operation=>execute('factory',archive,{type:'kitchen-project-operation',version:1,baseRevision:revision,operation},{id,subject,expectedRevision:revision});
const open=run({kind:'interior.open',unitId}),plan=structuredClone(open.result.plan);plan.cells['0:0']='boxes';archive=run({kind:'interior.set',unitId,plan}).archive;
const targetId='inside:'+unitId,draft={reviewer:'Original reviewer',measurement:'Measured drawing 7',drawing:'Sheet INS-7',instructions:'Machine and fit as sheet INS-7',lines:[{sku:'AL-20',label:'Internal shelf crossrail',count:2,a:460,b:null,operation:'Square cut'}]};
archive=run({kind:'special.review',targetId,draft}).archive;assert(archive);
const view=()=>projectView('factory',archive,{id,revision,subject});let reads=0,commits=0;
const host=new Host(),mounting=mountScopedWorkspace(host,{view:view(),previewOperation:async operation=>{
 if(operation.kind==='special.open'){reads++;if(commits)throw Error('Post-commit read is unavailable');}
 const computed=run(operation);assert(computed.ok,computed.reason);return {result:computed.result,review:computed.review};
},applyOperation:async(operation,review)=>{const computed=run(operation);assert(computed.ok&&computed.mutates);assert.equal(review,computed.review);archive=computed.archive;revision++;commits++;return view();}});
const route=host.querySelector('[data-scope-route]');route.value='specials';await route.fire('change');const dispose=await mounting,content=host.querySelector('[data-scope-content]');
for(let i=0;i<100&&!content.handlers.submit;i++)await new Promise(resolve=>setImmediate(resolve));assert(content.handlers.submit,'The actual special worksheet mounted.');
const form=content.querySelector('[data-special-form]');for(const key of ['reviewer','measurement','drawing','instructions'])form.querySelector('[data-special-field="'+key+'"]').value=key==='reviewer'?'Updated reviewer':draft[key];
await content.fire('input',form.querySelector('[data-special-field="reviewer"]'));await content.fire('submit',form);
for(let i=0;i<100&&host.querySelector('[data-scope-notice]').textContent!=='حُفظت ورقة المصنع وربطت بهندسة المشروع. راجع اعتماد الوصفات.';i++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(commits,1);assert.equal(reads,1,'Confirmed special.review already returns the safe worksheet; successful commit must not depend on another read.');
assert.equal(archive.design.room.workshop.factoryRecipes.specials[targetId].reviewer,'Updated reviewer');assert.equal(revision,5);
assert.notEqual(content.querySelector('[data-special-form]'),form,'Confirmed save advances the worksheet baseline.');assert.equal(host.querySelector('[data-scope-notice]').textContent,'حُفظت ورقة المصنع وربطت بهندسة المشروع. راجع اعتماد الوصفات.');
dispose();console.log('PASS scoped special save: real worksheet review commits once, consumes its confirmed safe result, and never misreports success because a redundant read failed.');
