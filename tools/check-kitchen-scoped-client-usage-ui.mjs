import assert from 'node:assert/strict';
import {mountClientUsage} from '../public/kitchen-client-usage-ui.js';
import {mountDrawerPack} from '../public/kitchen-drawer-pack-ui.js';

class Host{
 constructor(){this.handlers={};this.innerHTML='';this.children=new Map();}
 addEventListener(kind,fn){this.handlers[kind]=fn;}
 querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Host());return this.children.get(selector);}
 click(dataset){const button={dataset,closest(){return this;}};this.handlers.click({target:button});}
 submit(markers,values={}){const form={hasAttribute:key=>markers.includes(key),values};this.handlers.submit({target:form,preventDefault(){},stopPropagation(){}});}
}
const nativeFormData=globalThis.FormData;
globalThis.FormData=class{
 constructor(form){this.values=form.values;}
 get(key){return this.values[key]??null;}
 has(key){return Object.hasOwn(this.values,key);}
};

const group={id:'g1',name:'طلب عميل محفوظ',count:1,massKg:2,size:[100,120,140],rotate:false,stack:false,together:true,fixed:'u1#1'};
const bay={id:'u1#1',size:[400,400,200],entry:[400,400,200],entryAt:[0,0],reference:'قياس مسجّل فعلي',basis:'existing-measured-basis',allowAuto:true};
const accepted={basis:'pack-'+'a'.repeat(64),reference:'مرجع موافقة محفوظ',slots:[{group:'g1',index:1,bay:'u1#1',at:[0,0,0],turn:false}]};
let doc={room:{width:500,length:500,height:280,workshop:{clientUsage:{tasks:[],pack:{groups:[group],bays:[bay],accepted}},rows:{r:{units:[{id:'u1',family:'custom-safe'}]}}}},kitchen:{units:[{id:'u1',kind:'drawers',runId:'r',u:0,width:60}],runs:[{id:'r',wall:'back',tier:'base',start:0,end:60,depth:60,height:80,bottom:0}],features:[]}};
let commits=0,catalogReads=0;const notices=[];
// Any full-catalog read fails: the scoped branch must work from customer data.
function guardCatalog(){Object.defineProperty(doc.room.workshop,'catalog',{configurable:true,get(){catalogReads++;throw Error('Scoped UI read a full catalog');}});}
guardCatalog();
const apply=next=>{doc=next;commits++;guardCatalog();return {ok:true};};
const getDoc=()=>doc,tell=s=>notices.push(s),host=new Host();
const close=mountClientUsage(host,{getDoc,apply,tell,scoped:true,families:{'custom-safe':{label:'وصف فني مسموح'}}});
assert(host.innerHTML.includes('وصف فني مسموح'),'Usage renders provided public family label');
assert(host.innerHTML.includes('data-use-drawers'),'Scoped usage links to the server-owned drawer workbench');
assert(!host.children.has('[data-drawer-pack]'),'Scope v2 never mounts the legacy canonical pack editor');
const nested=new Host(),closeLegacy=mountDrawerPack(nested,{getDoc,apply,tell,scoped:true});
assert(nested.innerHTML.includes('قياس مسجّل فعلي'));assert(nested.innerHTML.includes('مرجع موافقة محفوظ'));assert(nested.innerHTML.includes('400 × 400 × 200'));
assert(nested.innerHTML.includes('يراجع المصنع'));assert(nested.innerHTML.includes('data-pack-group'));
for(const hidden of ['data-pack-bay','data-pack-preview','data-pack-accept','data-edit-bay','data-drop-bay','ر.س','فحص السكة معلّق'])assert(!nested.innerHTML.includes(hidden),hidden);

const existing=structuredClone(doc.room.workshop.clientUsage.pack);
nested.click({editGroup:'g1'});
nested.submit(['data-pack-group'],{name:'طلب عميل محدث',size0:'110',size1:'120',size2:'140',count:'2',massKg:'3',fixed:'u1#1',rotate:'on',together:'on'});
assert.equal(commits,1);assert.equal(doc.room.workshop.clientUsage.pack.groups[0].name,'طلب عميل محدث');assert.equal(doc.room.workshop.clientUsage.pack.groups[0].count,2);
assert.deepEqual(doc.room.workshop.clientUsage.pack.bays,existing.bays);assert.deepEqual(doc.room.workshop.clientUsage.pack.accepted,existing.accepted);

for(const marker of ['data-pack-bay','data-pack-preview','data-pack-accept']){
 nested.submit([marker]);nested.submit(['data-pack-group',marker]);
}
nested.click({editBay:'u1#1'});nested.click({dropBay:'u1#1'});
assert.equal(commits,1,'Forged bay, solve, accept and mixed-marker events cannot write');assert.equal(notices.length,8);
nested.click({dropGroup:'g1'});assert.equal(commits,2);assert.deepEqual(doc.room.workshop.clientUsage.pack.groups,[]);assert.deepEqual(doc.room.workshop.clientUsage.pack.bays,existing.bays);assert.deepEqual(doc.room.workshop.clientUsage.pack.accepted,existing.accepted);
assert.equal(catalogReads,0,'Scoped render and group writes never read a catalog or invoke catalog-based host/runner computation');close();closeLegacy();

const standalone=new Host();const stop=mountDrawerPack(standalone,{getDoc,apply,tell,scoped:true});assert(standalone.innerHTML.includes('يراجع المصنع'));assert.equal(catalogReads,0);stop();
globalThis.FormData=nativeFormData;
console.log('PASS: scoped customer usage uses public family labels; customer group edits preserve measured bays/recorded slots; rendering and forged events never load a catalog, run packing or expose prices.');
