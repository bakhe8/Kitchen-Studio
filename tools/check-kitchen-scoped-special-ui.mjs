import assert from 'node:assert/strict';
import {mountScopedSpecial} from '../public/kitchen-scoped-special-ui.js';
import {cleanPartOperations} from '../public/kitchen-machining.js';

// Parse the actual widget HTML. A redraw detaches old form/control identities;
// this catches lost inputs and loading-state mistakes in the mounted widget.
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));this.children=[];this.parentElement=null;this.handlers=new Map();this.disabled='disabled' in attrs;this.checked='checked' in attrs;this.value=attrs.value??'';this._html='';}
 set innerHTML(html){this._html=html;for(const c of this.children)c.parentElement=null;this.children=[];const stack=[this];for(const m of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){const tag=m[1].toLowerCase();if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)'|=([^\s>]+))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const node=new Element(tag,attrs),parent=stack.at(-1);node.parentElement=parent;parent.children.push(node);if(!['input','br','hr','img','meta','link'].includes(tag))stack.push(node);}for(const select of this.querySelectorAll('select'))select.value=select.querySelectorAll('option').find(o=>o.hasAttribute('selected'))?.value??select.querySelector('option')?.value??'';}
 get innerHTML(){return this._html;}
 hasAttribute(key){return Object.hasOwn(this.attrs,key);}
 matches(selector){return selector.split(',').some(s=>{s=s.trim();const m=s.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);return m?this.hasAttribute(m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]):this.tagName===s.toUpperCase();});}
 closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null;}
 querySelectorAll(s){const all=[];const walk=n=>{for(const c of n.children){if(c.matches(s))all.push(c);walk(c);}};walk(this);return all;}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 replaceChildren(){this.innerHTML='';}
 addEventListener(kind,fn,{signal}={}){if(!this.handlers.has(kind))this.handlers.set(kind,[]);this.handlers.get(kind).push(fn);signal?.addEventListener('abort',()=>this.handlers.set(kind,this.handlers.get(kind).filter(f=>f!==fn)),{once:true});}
 async fire(kind,target){for(const fn of [...(this.handlers.get(kind)||[])])fn({target,preventDefault(){}});await tick();}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve)),clone=structuredClone;
let cacheReads=0,catalogReads=0,confirmAnswer=false,confirmCalls=0;
for(const key of ['localStorage','sessionStorage'])Object.defineProperty(globalThis,key,{configurable:true,get(){cacheReads++;throw Error('Scoped worksheet read a device archive');}});
globalThis.confirm=()=>{confirmCalls++;return confirmAnswer;};
const operations=cleanPartOperations([{kind:'drill',machine:'external',reference:'OP-01',tolerance:1,xFrom:'start',yFrom:'start',x:20,y:20,diameter:4,depth:4,length:0,width:0,angle:0,radius:0,minutes:1,provider:'ورشة تشغيل',confirmation:'CONFIRM-01',leadDays:1}]);assert(operations);
const original={targetId:'inside:storage-1',targets:[{id:'inside:storage-1',label:'تقسيم داخلي',kind:'inside',current:true},{id:'unit:oven-1',label:'فتحة فرن',kind:'unit',appliance:true,current:false}],items:[{sku:'PANEL20',name:'لوح 20 مم',kind:'panel',thicknessMm:20},{sku:'BAR20',name:'قطاع 20 مم',kind:'bar',thicknessMm:20},{sku:'HINGE',name:'مفصلة',kind:'piece'}],draft:{reviewer:'مراجع الورشة',measurement:'SITE-01',drawing:'DWG-01',instructions:'تعليمات الوصلات',lines:[{sku:'PANEL20',label:'رف أفقي',count:1,a:460,b:560,operation:'قطع مستقيم',operations}]}};
Object.defineProperty(original,'catalog',{get(){catalogReads++;throw Error('Scoped worksheet read full catalog');}});
let failSave=true,loadFailure=false,deferSave=null;const saves=[],loads=[],notices=[];const host=new Element();
const dataFor=(id,draft)=>({...clone(original),targetId:id,draft:draft??(id==='unit:oven-1'?{reviewer:'فني الأجهزة',measurement:'SITE-02',drawing:'OVEN-01',instructions:'مراجعة دليل الجهاز',bay:true,lines:[],fit:{model:'Oven-600',manual:'Install-01',required:{width:580,depth:550,height:590},available:{width:600,depth:600,height:600}}}:clone(original.draft))});
const ui=mountScopedSpecial(host,{data:original,load:async id=>{loads.push(id);if(loadFailure)throw Error('تعذر تحميل الورقة');return dataFor(id);},save:async(id,draft)=>{saves.push({id,draft:clone(draft)});if(failSave)throw Error('تعذر حفظ الورقة؛ المسودة باقية');if(deferSave)await deferSave;return dataFor(id,draft);},tell:m=>notices.push(m)});
const field=(node,k)=>{const el=node.querySelector('[data-special-field="'+k+'"]');assert(el,'Missing field '+k);return el;};
const set=(node,k,value)=>{const el=field(node,k);el.value=String(value);return el;};
assert(!ui.hasPending());assert(host.innerHTML.includes('ورقة قطع ومراجعة المصنع'));assert(!host.innerHTML.includes('signature'));assert(!host.innerHTML.includes('materialKey'));assert(!host.innerHTML.includes('ر.س'));
let form=host.querySelector('[data-special-form]'),line=form.querySelector('[data-special-line="0"]');
await host.fire('input',set(form,'reviewer','  مراجع جديد  '));set(line,'count',2);set(line,'a',450);set(line,'b',550);set(line,'operation','تشغيل موثق');assert(ui.hasPending());
await host.fire('submit',form);assert.equal(saves.length,1);assert.deepEqual(saves[0],{id:'inside:storage-1',draft:{...clone(original.draft),reviewer:'مراجع جديد',lines:[{...clone(original.draft.lines[0]),count:2,a:450,b:550,operation:'تشغيل موثق'}]}});
assert.equal(host.querySelector('[data-special-form]'),form);assert.equal(field(form,'reviewer').value,'  مراجع جديد  ');assert(ui.hasPending());assert(!field(form,'reviewer').disabled);assert.equal(host.querySelector('[data-special-status]').textContent,'تعذر حفظ الورقة؛ المسودة باقية');
assert.deepEqual(saves[0].draft.lines[0].operations,operations,'Existing machining operations survive editable text/length updates');
for(const key of ['signature','materialKey','price','stockUnits','basis'])assert(!JSON.stringify(saves[0]).includes('"'+key+'"'),'Widget must not invent '+key);

// A cancelled target change keeps the exact dirty form and target identity.
const selector=host.querySelector('[data-special-target]');selector.value='unit:oven-1';await host.fire('change',selector);assert.equal(confirmCalls,1);assert.equal(selector.value,'inside:storage-1');assert.equal(loads.length,0);assert.equal(host.querySelector('[data-special-form]'),form);assert.equal(field(form,'reviewer').value,'  مراجع جديد  ');assert(ui.hasPending());

// Save stays busy while the server is pending, then installs the returned sheet.
failSave=false;let resolveSave;deferSave=new Promise(resolve=>resolveSave=resolve);await host.fire('submit',form);assert(ui.hasPending());assert(host.querySelectorAll('input,select,button').every(e=>e.disabled));const savedCount=saves.length;await host.fire('click',host.querySelector('[data-special-add]'));await host.fire('submit',form);assert.equal(saves.length,savedCount);
resolveSave();await tick();deferSave=null;assert(!ui.hasPending());assert.notEqual(host.querySelector('[data-special-form]'),form);assert(host.querySelectorAll('input,select,button').every(e=>!e.disabled));assert.equal(field(host.querySelector('[data-special-form]'),'reviewer').value,'مراجع جديد');

// Native select changes fire input before change. Navigation must not create a
// fictitious dirty worksheet, and a failed load cannot mislabel the old form.
form=host.querySelector('[data-special-form]');let navigate=host.querySelector('[data-special-target]');const confirmationsBeforeClean=confirmCalls;loadFailure=true;navigate.value='unit:oven-1';await host.fire('input',navigate);assert(!ui.hasPending(),'Changing only the target does not edit the worksheet');await host.fire('change',navigate);assert.equal(confirmCalls,confirmationsBeforeClean,'A clean target switch needs no discard confirmation');assert.equal(navigate.value,'inside:storage-1');assert.equal(host.querySelector('[data-special-form]'),form);assert(!ui.hasPending());assert.equal(host.querySelector('[data-special-status]').textContent,'تعذر تحميل الورقة');
await host.fire('input',set(form,'drawing','UNSAVED-DWG'));confirmAnswer=true;navigate.value='unit:oven-1';await host.fire('input',navigate);await host.fire('change',navigate);assert.equal(navigate.value,'inside:storage-1');assert.equal(host.querySelector('[data-special-form]'),form);assert.equal(field(form,'drawing').value,'UNSAVED-DWG');assert(ui.hasPending(),'A failed target load preserves the earlier dirty worksheet');loadFailure=false;

// Adding, changing material kind, and removing a row submits the authored lines,
// preserving existing machining data rather than replacing it with a local recipe.
await host.fire('click',host.querySelector('[data-special-add]'));form=host.querySelector('[data-special-form]');assert.equal(form.querySelectorAll('[data-special-line]').length,2);line=form.querySelector('[data-special-line="1"]');set(line,'label','مفصلة إضافية');const sku=set(line,'sku','HINGE');await host.fire('change',sku);form=host.querySelector('[data-special-form]');line=form.querySelector('[data-special-line="1"]');assert(!line.querySelector('[data-special-field="a"]'));assert(!line.querySelector('[data-special-field="b"]'));set(line,'operation','تركيب وفق الرسم');set(line,'count',2);await host.fire('submit',form);assert.deepEqual(saves.at(-1).draft.lines[1],{sku:'HINGE',label:'مفصلة إضافية',count:2,a:null,b:null,operation:'تركيب وفق الرسم'});assert.deepEqual(saves.at(-1).draft.lines[0].operations,operations);
await host.fire('click',host.querySelector('[data-special-remove="1"]'));assert.equal(host.querySelectorAll('[data-special-line]').length,1);assert(ui.hasPending());

confirmAnswer=true;let next=host.querySelector('[data-special-target]');next.value='unit:oven-1';await host.fire('change',next);assert.deepEqual(loads,['unit:oven-1','unit:oven-1','unit:oven-1']);assert(!ui.hasPending());form=host.querySelector('[data-special-form]');assert(host.querySelector('[data-special-bay]').checked);assert.equal(host.querySelectorAll('[data-special-line]').length,0);set(form,'available-height',605);await host.fire('input',field(form,'available-height'));await host.fire('submit',form);assert.equal(saves.at(-1).id,'unit:oven-1');assert.equal(saves.at(-1).draft.fit.available.height,605);assert.equal(saves.at(-1).draft.bay,true);assert.deepEqual(saves.at(-1).draft.lines,[]);

// Disposing a widget during a pending response must not remount stale controls.
let finish;deferSave=new Promise(resolve=>finish=resolve);form=host.querySelector('[data-special-form]');await host.fire('input',set(form,'drawing','OVEN-02'));await host.fire('submit',form);ui.destroy();const count=saves.length;assert.equal(host.innerHTML,'');finish();await tick();await host.fire('submit',form);assert.equal(host.innerHTML,'');assert.equal(saves.length,count);assert.equal(cacheReads,0);assert.equal(catalogReads,0);
const empty=new Element(),emptyUi=mountScopedSpecial(empty,{data:{targets:[],items:[],targetId:null,draft:null},load:()=>{throw Error('Unexpected load');},save:()=>{throw Error('Unexpected save');},tell:()=>{}});assert(empty.innerHTML.includes('لا توجد تقسيمات'));assert(!empty.querySelector('[data-special-form]'));assert(!emptyUi.hasPending());emptyUi.destroy();
console.log('PASS: actual scoped special worksheet mount, exact own draft/material callbacks, preserved machining operations, no generated signatures/prices/catalog/cache reads, cancelled target navigation, retained failure form, async locking/reset, appliance fit/bay and destroyed pending response.');
