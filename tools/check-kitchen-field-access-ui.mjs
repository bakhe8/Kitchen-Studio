import assert from 'node:assert/strict';
import {mountDefaultsPanel} from '../public/kitchen-defaults-ui.js';
import {mountFieldRegister} from '../public/kitchen-field-ui.js';
import {mountFieldAssistant} from '../public/kitchen-assist-ui.js';
import {bindProjectAccess} from '../public/kitchen-project-access.js';
import {fieldInputRole} from '../public/kitchen-access-policy.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {upsertFieldRecord,readFieldRegister} from '../public/kitchen-field-model.js';
import {resolveDefault} from '../public/kitchen-defaults-model.js';

class Store{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
class Host{
 constructor(ownerDocument=null){this.ownerDocument=ownerDocument;this.handlers={};this.innerHTML='';this.memo=new Map();this.dataset={};this.hidden=false;this.value='';this.classList={toggle(){}};}
 addEventListener(e,cb){this.handlers[e]=cb;}removeEventListener(e){delete this.handlers[e];}closest(){return null;}setAttribute(){}removeAttribute(){}focus(){}remove(){}
 querySelector(k){if(!this.memo.has(k))this.memo.set(k,new Host(this.ownerDocument));return this.memo.get(k);}
 contains(){return true;}replaceChildren(){this.innerHTML='';}append(node){this.child=node;}
 click(data){const b={dataset:data,closest(){return this;}};this.handlers.click({target:b});}
 submit(v){const inputs=Object.fromEntries(Object.entries(v).map(([k,val])=>[k,{value:String(val)}]));const form={matches:()=>true,elements:{namedItem:k=>inputs[k]}};this.handlers.submit({target:form,preventDefault(){}});}
}
let doc=makeFurnishedSaudiRoom('apartment'),commits=0;
doc.room.projectId='e1234567-1234-1234-1234-123456789abc';
const access=role=>bindProjectAccess(doc,{id:'f1234567-1234-1234-1234-123456789abc',role,revision:1});
const apply=next=>{commits++;doc=next;return {ok:true,saved:true};};
access('rep');
const h=new Host(),ui=mountDefaultsPanel(h,{getDoc:()=>doc,apply,getProjectKey:()=>1});
assert(!h.innerHTML.includes('data-key="price"'));assert(!h.innerHTML.includes('data-key="waste"'));assert(!h.innerHTML.includes('profile-save'));
h.click({dfDo:'fix',key:'price',item:'marble'});h.submit({property:'سعر متر سطح العمل المربع',value:'900'});assert.equal(commits,0);
ui.openWorktopValue('MFG-09','سعر متر سطح العمل المربع','marble');assert(!h.innerHTML.includes('data-df-edit'));
h.click({dfDo:'any'});const options=()=>h.querySelector('[data-df-results]').innerHTML;
assert(options().includes('data-code="SITE-01"'));assert(!options().includes('data-code="MFG-09"'));
h.click({dfDo:'code',code:'SITE-19'});h.submit({scope:'project',mode:'value',type:'number',property:'خلوص الاختبار',unit:'مم',value:25});assert.equal(commits,1);
const noProfileWrite=[...localStorage.values];h.click({dfDo:'profile-save'});h.click({dfDo:'profile-confirm'});assert.deepEqual([...localStorage.values],noProfileWrite);assert.equal(commits,1);
access('factory');
assert(h.innerHTML.includes('data-key="waste"'));assert(!h.innerHTML.includes('data-key="price"'));assert(!h.innerHTML.includes('profile-save'));
h.click({dfDo:'any'});assert(options().includes('data-code="MFG-06"'));assert(options().includes('data-code="INS-01"'));assert(!options().includes('data-code="SITE-01"'));assert(!options().includes('data-code="MFG-09"'));
ui.openWorktopValue('MFG-06','نسبة احتياط سطح العمل','marble');h.submit({scope:'entity',itemId:'marble',mode:'value',type:'number',property:'نسبة احتياط سطح العمل',value:12,unit:'%'});assert.equal(commits,2);assert.equal(resolveDefault(doc,{code:'MFG-06',property:'نسبة احتياط سطح العمل',itemId:'marble'}).value,12);
ui.openWorktopValue('MFG-06','نسبة احتياط سطح العمل','marble');access('viewer');assert(h.innerHTML.includes('<fieldset disabled'));
h.submit({scope:'entity',itemId:'marble',mode:'value',type:'number',property:'نسبة احتياط سطح العمل',value:99,unit:'%'});h.click({dfDo:'reset'});assert.equal(commits,2,'Revocation blocks saving or resetting an already open draft');
access('editor');h.click({dfDo:'back'});assert(!h.innerHTML.includes('profile-save'));assert(!h.innerHTML.includes('data-key="price"'));
ui.openWorktopValue('MFG-09','سعر متر سطح العمل المربع','marble');assert(!h.innerHTML.includes('data-df-edit'),'Legacy editor cannot open the protected commercial field');
h.click({dfDo:'any'});h.handlers.input({target:{dataset:{dfSearch:'any'},value:'MFG-09'}});assert(!options().includes('data-code="MFG-09"'),'Legacy editor commercial code is absent from editable chooser');
ui.openWorktopValue('MFG-06','نسبة احتياط سطح العمل','marble');assert(h.innerHTML.includes('data-df-edit'),'Legacy editor retains ordinary manufacturing defaults');
access('owner');h.click({dfDo:'back'});h.click({dfDo:'profile-save'});access('editor');const storageBefore=[...localStorage.values];h.click({dfDo:'profile-confirm'});assert.deepEqual([...localStorage.values],storageBefore,'Legacy editor cannot confirm an owner-only whole-profile operation');
const registry=JSON.parse(localStorage.getItem('kitchen-workshop:access:v1'));registry[doc.room.projectId].revision=2;localStorage.setItem('kitchen-workshop:access:v1',JSON.stringify(registry));ui.refresh();h.click({dfDo:'code',code:'SITE-19'});h.submit({property:'blocked',value:3});assert.equal(commits,2,'Unchecked remote role is locked');ui.destroy();

for(const inputCode of ['MFG-09','MFG-06','INS-01','SITE-03']){const result=upsertFieldRecord(doc.room,{inputCode,itemId:'project',property:'Role fixture '+inputCode,valueType:'number',value:3,verification:'documented'});assert(result.ok,result.reason);doc={...doc,room:result.room};}
const dom={activeElement:null,createElement(){return new Host(dom);}},root=new Host(dom);
access('factory');const field=mountFieldRegister(root,{getDoc:()=>doc,apply,getProjectKey:()=>1});const box=root.child;
field.open({mode:'records'});
// Register result nodes are queried through the overlay, as in the real DOM.
const fieldResults=()=>box.querySelector('[data-fr-results]').innerHTML;
assert(fieldResults().includes('MFG-06'));assert(fieldResults().includes('INS-01'));assert(!fieldResults().includes('MFG-09'));assert(!fieldResults().includes('SITE-03'));
const find=code=>readFieldRegister(doc.room).records.find(r=>r.inputCode===code);
const priceId=find('MFG-09').id,factoryId=find('MFG-06').id;
box.click({frDo:'remove',frId:priceId});box.click({frDo:'proceed'});assert(find('MFG-09'));
box.click({frDo:'remove',frId:factoryId});access('rep');box.click({frDo:'proceed'});assert(find('MFG-06'),'Delete confirmation rechecks a changed role');
assert(fieldResults().includes('SITE-03'));assert(!fieldResults().includes('MFG-06'));
access('factory');box.click({frDo:'remove',frId:factoryId});box.click({frDo:'proceed'});assert(!find('MFG-06'),'Factory can remove its own field evidence');
field.close();field.open({mode:'item',code:'MFG-09',itemId:'project',property:'Role fixture MFG-09'});assert(!box.memo.has('[data-fr-editor]'),'Direct protected item route cannot mount an editor');
access('editor');box.click({frDo:'records'});const oldPrice=structuredClone(find('MFG-09'));box.click({frDo:'remove',frId:priceId});box.click({frDo:'proceed'});assert.deepEqual(find('MFG-09'),oldPrice,'Legacy editor cannot remove old commercial evidence');
box.click({frDo:'remove',frId:find('INS-01').id});box.click({frDo:'proceed'});assert(!find('INS-01'),'Legacy editor still edits ordinary evidence');
field.close();field.open({mode:'item',code:'MFG-09',itemId:'project',property:'Role fixture MFG-09'});assert(!box.memo.has('[data-fr-editor]'),'Legacy editor direct pricing route is also blocked');
access('viewer');box.click({frDo:'records'});assert(!fieldResults().includes('data-fr-do="remove"'));field.destroy();

let permitted='rep';const guidedHost=new Host();const guide=mountFieldAssistant(guidedHost,{getDoc:()=>doc,apply,initialTopic:'production',canEditInput:code=>fieldInputRole(code)===permitted});
assert.equal(guide.getState().topic,'site');assert(!guidedHost.innerHTML.includes('value="production"'),'Rep guided questions exclude manufacturing track');
const writes=commits;permitted='viewer';guidedHost.click({kaDo:'unknown'});assert.equal(commits,writes,'Role changes cannot submit a previously selected guided question');guide.destroy();
console.log('PASS: scoped defaults/field rows, direct pricing guards, legacy compatibility, role-revoked drafts and confirmations, unknown access lock, owned evidence deletion and guided question filtering.');
