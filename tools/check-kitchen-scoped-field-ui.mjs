import assert from 'node:assert/strict';
import {mountFieldRegister} from '../public/kitchen-field-ui.js';
import {projectView,mergeProjectEdit} from '../public/kitchen-project-scope.js';
import {scopeWidgetDocument,scopeEditableFromWidget} from '../public/kitchen-scope-widgets.js';
import {bindProjectAccess} from '../public/kitchen-project-access.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {getEffectiveDefaults,resolveDefault,setProjectDefault} from '../public/kitchen-defaults-model.js';
import {upsertFieldRecord} from '../public/kitchen-field-model.js';
import {readWallOptions} from '../public/kitchen-chain-options.js';

class Store{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
class Host{
 constructor(ownerDocument){this.ownerDocument=ownerDocument;this.handlers={};this.memo=new Map();this.inputs=new Map();this.innerHTML='';this.dataset={};this.hidden=false;this.value='';this.classList={toggle(){}};const entries=this.inputs;this.elements={namedItem:k=>{if(!entries.has(k))entries.set(k,{value:'',disabled:false,focus(){}});return entries.get(k);},[Symbol.iterator]:function*(){yield* entries.values();}};}
 addEventListener(k,fn){this.handlers[k]=fn;}removeEventListener(k){delete this.handlers[k];}closest(){return null;}setAttribute(){}removeAttribute(){}focus(){}remove(){}blur(){}
 querySelector(k){if(!this.memo.has(k))this.memo.set(k,new Host(this.ownerDocument));return this.memo.get(k);}querySelectorAll(){return [];}
 contains(){return false;}replaceChildren(){this.innerHTML='';}append(node){this.child=node;}
 click(data){const button={dataset:data,closest(){return this;}};this.handlers.click({target:button});}
 async submit(values){for(const [k,v] of Object.entries(values))this.elements.namedItem(k).value=String(v);return this.handlers.submit({target:this,preventDefault(){}});}
 matches(){return true;}
}
const dom={activeElement:null,createElement(){return new Host(dom);}};
let full=makeFurnishedSaudiRoom('apartment');full.room.projectId='K-0123456789ABCDEF';
full.room.workshop={...full.room.workshop,...normalizeWorkshopCatalogs({catalog:seedCatalog()}),chains:{back:{source:'field',rows:[{id:'start',kind:'start',gapMm:0},{id:'end',kind:'corner',gapMm:full.room.width*10}],attestation:{key:'s-'+'d'.repeat(64),name:'PRIVATE_SURVEYOR',reference:'PRIVATE_SURVEY_REFERENCE',date:'2026-11-03T20:00:00Z'}}}};
full.room.workshop.options={back:{...readWallOptions(full,'back'),profiles:[{id:'ledge-context',type:'ledge',fromMm:0,toMm:100,bottomMm:0,topMm:20,depthMm:300,reference:'PRIVATE_SURVEY_PROFILE'}]}};
for(const code of ['MFG-06','MFG-09','SITE-03']){const out=upsertFieldRecord(full.room,{inputCode:code,itemId:'project',property:'Existing '+code,valueType:'number',value:3,verification:'documented'});assert(out.ok,out.reason);full={...full,room:out.room};}
const price=setProjectDefault(full,{code:'MFG-09',property:'سعر متر سطح العمل المربع',type:'number',mode:'value',value:65432,unit:'ريال/م²'});assert(price.ok);full={...full,room:price.room};full=cleanIdea(full);assert(full);
let archive={type:'kitchen-studio',version:2,design:full,photos:{},fieldFiles:[]};
const initial=structuredClone(archive),meta={id:'11111111-2222-3333-4444-555555555555',revision:1,subject:'factory-user'},view=projectView('factory',archive,meta);
let doc=scopeWidgetDocument(view),commits=0;
assert(!JSON.stringify(doc).includes('PRIVATE_SURVEY'));assert.equal(doc.room.workshop.chains.back.attestation,undefined);
assert(!cleanIdea(doc),'The safe technical projection is deliberately not a portable archive');
assert(!JSON.stringify(doc).includes('MFG-09'));
const reusableKey='kitchen-studio:reusable-defaults:v1',privateProfile=JSON.stringify({kind:'profile',name:'PRIVATE_DEVICE_PROFILE',version:1,rows:[{code:'MFG-06',property:'Private device value',itemId:'',type:'number',unit:'',mode:'value',value:777}]});
localStorage.setItem(reusableKey,privateProfile);assert(!getEffectiveDefaults(doc).some(r=>r.value===777),'Explicit scoped base never inherits this device profile');
const access=role=>bindProjectAccess(doc,{...meta,role});access('factory');
const apply=next=>{const editable=scopeEditableFromWidget(view,next),result=mergeProjectEdit('factory',archive,{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable},{expectedRevision:1});if(!result.ok)return result;archive=result.archive;doc=next;commits++;return {ok:true,saved:true};};
const root=new Host(dom),field=mountFieldRegister(root,{getDoc:()=>doc,getProjectKey:()=>doc.room.projectId,apply,scoped:true}),box=root.child;
field.open({mode:'item',code:'MFG-06',itemId:'project',property:'Existing MFG-06'});
const form=box.querySelector('[data-fr-editor]').querySelector('form');
const values={itemId:'project',property:'Existing MFG-06',readingValue:12,valueType:'number',verification:'documented',flexibility:'unspecified',execution:'unspecified'};
assert.equal(field.hasPending(),false);form.handlers.input({target:{name:'readingValue',hasAttribute:()=>false}});assert.equal(field.hasPending(),true,'The workspace can detect an unsubmitted field form');
await form.submit(values);assert.equal(commits,1,'Scoped factory form delegates its owned edit instead of archive-validating the transient document');
assert.equal(field.hasPending(),false);
assert.equal(archive.design.room.fieldRegister.records.find(r=>r.inputCode==='MFG-06').value,12);
assert.deepEqual(archive.design.room.workshop.chains,initial.design.room.workshop.chains,'Server merge preserves the private survey references');
field.close();field.open({mode:'defaults',code:'MFG-06',property:'نسبة احتياط سطح العمل',material:'marble'});
let defaults=box.querySelector('[data-fr-defaults]');
assert(!defaults.innerHTML.includes('PRIVATE_DEVICE_PROFILE'));assert(!defaults.innerHTML.includes('MFG-09'));
defaults.handlers.input({target:{form:{matches:()=>true}}});assert.equal(field.hasPending(),true,'The workspace also detects a nested defaults draft');
await defaults.submit({scope:'entity',itemId:'marble',mode:'value',type:'number',property:'نسبة احتياط سطح العمل',value:11,unit:'%'});
assert.equal(commits,2,'Nested scoped defaults also delegate only the owned slice');assert.equal(resolveDefault(archive.design,{code:'MFG-06',property:'نسبة احتياط سطح العمل',itemId:'marble'}).value,11);
assert.equal(field.hasPending(),false);field.close();field.open({mode:'records'});field.close();field.open({mode:'defaults'});defaults=box.querySelector('[data-fr-defaults]');
defaults.click({dfDo:'back'});defaults.click({dfDo:'fix',key:'price',item:'marble'});defaults.click({dfDo:'code',code:'MFG-09'});assert(!defaults.innerHTML.includes('data-df-edit'));await defaults.submit({scope:'entity',itemId:'marble',mode:'value',type:'number',property:'سعر متر سطح العمل المربع',value:1,unit:'ريال/م²'});assert.equal(commits,2);
field.close();field.open({mode:'records'});assert(!box.querySelector('[data-fr-results]').innerHTML.includes('MFG-09'));
box.click({frDo:'remove',frId:initial.design.room.fieldRegister.records.find(r=>r.inputCode==='MFG-09').id});box.click({frDo:'proceed'});assert.equal(commits,2);
field.close();field.open({mode:'item',code:'MFG-06',itemId:'project',property:'Existing MFG-06'});access('viewer');
await box.querySelector('[data-fr-editor]').querySelector('form').submit({...values,readingValue:99});assert.equal(commits,2,'Revoked access cannot save an already mounted scoped form');
assert.deepEqual(archive.design.room.fieldRegister.records.filter(r=>r.inputCode!=='MFG-06'),initial.design.room.fieldRegister.records.filter(r=>r.inputCode!=='MFG-06'));
assert.equal(resolveDefault(archive.design,{code:'MFG-09',property:'سعر متر سطح العمل المربع'}).value,65432);
assert.equal(localStorage.getItem(reusableKey),privateProfile);field.destroy();
console.log('PASS: actual factory DTO field/default UI edits delegate scoped extraction and server merge; redacted references and owner pricing stay intact, device defaults never become project values, and revoked/hidden fields remain blocked.');
