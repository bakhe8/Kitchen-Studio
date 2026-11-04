import assert from 'node:assert/strict';
import {mountScopedDrawers} from '../public/kitchen-scoped-drawers-ui.js';

// A small DOM fixture parses the widget's real HTML so redraws create new form
// identities and disabled controls follow their actual enclosing form.
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));this.children=[];this.parentElement=null;this.handlers=new Map();this.disabled='disabled' in attrs;this.checked='checked' in attrs;this.hidden='hidden' in attrs;this.value=attrs.value??'';this._html='';}
 set innerHTML(html){this._html=html;for(const c of this.children)c.parentElement=null;this.children=[];const stack=[this];for(const m of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){const tag=m[1].toLowerCase();if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const node=new Element(tag,attrs),parent=stack.at(-1);node.parentElement=parent;parent.children.push(node);if(!['input','br','hr','img','meta','link'].includes(tag))stack.push(node);}for(const select of this.querySelectorAll('select'))select.value=select.querySelectorAll('option').find(o=>o.hasAttribute('selected'))?.value??select.querySelector('option')?.value??'';}
 get innerHTML(){return this._html;}
 hasAttribute(key){return Object.hasOwn(this.attrs,key);}
 matches(selector){return selector.split(',').some(s=>{s=s.trim();const m=s.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);return m?this.hasAttribute(m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]):this.tagName===s.toUpperCase();});}
 closest(s){for(let node=this;node;node=node.parentElement)if(node.matches(s))return node;return null;}
 querySelectorAll(s){const all=[];const walk=n=>{for(const c of n.children){if(c.matches(s))all.push(c);walk(c);}};walk(this);return all;}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 replaceChildren(){this.innerHTML='';}
 addEventListener(kind,fn,{signal}={}){if(!this.handlers.has(kind))this.handlers.set(kind,[]);this.handlers.get(kind).push(fn);signal?.addEventListener('abort',()=>this.handlers.set(kind,this.handlers.get(kind).filter(f=>f!==fn)),{once:true});}
 async fire(kind,target){for(const fn of [...(this.handlers.get(kind)||[])])fn({target,preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));}
}
const NativeFormData=globalThis.FormData;
globalThis.FormData=class{
 constructor(form){this.rows=form.querySelectorAll('input,select').filter(n=>n.attrs.name&&!n.disabled&&(!['checkbox','radio'].includes(n.attrs.type)||n.checked)).map(n=>[n.attrs.name,n.value]);}
 get(k){return this.rows.find(([name])=>name===k)?.[1]??null;}getAll(k){return this.rows.filter(([name])=>name===k).map(([,v])=>v);}has(k){return this.rows.some(([name])=>name===k);}
};
let confirmAnswer=true,cacheTouches=0,catalogTouches=0;
globalThis.confirm=()=>confirmAnswer;
for(const key of ['localStorage','sessionStorage'])Object.defineProperty(globalThis,key,{configurable:true,get(){cacheTouches++;throw Error('Scoped drawer widget opened a device archive');}});
const clone=structuredClone,physical={clearWidthMm:560,clearDepthMm:520,leftGapMm:13,rightGapMm:13,minTravelMm:400,freeTravelMm:520,emptyKg:3};
const ownPack={groups:[{id:'group-1',name:'قدر العميل',size:[200,200,90],count:1,massKg:10,rotate:true,stack:false,together:false,fixed:'unit-1#1'}],permissions:[{bayId:'unit-1#1',allowAuto:true}]};
const technical={units:[{id:'unit-1',label:'وحدة أدراج',kind:'drawers',runId:'row-1',widthMm:600,heightMm:800,depthMm:600,canInterior:true,drawerCount:2}],drawers:[
 {unitId:'unit-1',runId:'row-1',index:1,bayId:'unit-1#1',measurement:{...physical,reference:'مرجع فني للمصنع'},contentsKg:2,pin:'SLIDE',status:'ready',selection:{sku:'SLIDE',movingKg:15,travelMm:450}},
 {unitId:'unit-1',runId:'row-1',index:2,bayId:'unit-1#2',measurement:null,contentsKg:null,pin:'',status:'MEASUREMENT_REQUIRED',selection:null}],packing:{
 bays:[{id:'unit-1#1',size:[450,400,150],entry:[450,400,150],entryAt:[0,0],reference:'مرجع حيز للمصنع',current:true,allowAuto:true}],
 groups:ownPack.groups.map(g=>({...g,name:'CUSTOMER_NAME_MUST_NOT_RENDER_IN_FACTORY'})),accepted:{reference:'CUSTOMER_CONSENT_MUST_NOT_RENDER_IN_FACTORY',slots:[{group:'group-1',index:1,bay:'unit-1#1',at:[0,0,0],turn:false}],current:true},statusCodes:[]}};
const ready={status:'ready',slots:[{group:'group-1',index:1,bay:'unit-1#1',at:[0,0,0],turn:false}],selection:[{bayId:'unit-1#1',sku:'HEAVY',movingKg:15,travelMm:450}]};
function mount(role){
 const host=new Element(),calls={commit:[],preview:[],pack:[],interior:[],tell:[]};let data=clone(technical),requests=clone(ownPack),failCommit=false,failPack=false;
 if(role==='rep'){for(const d of data.drawers)if(d.measurement)delete d.measurement.reference;for(const b of data.packing.bays){delete b.reference;delete b.allowAuto;}delete data.packing.groups;data.packing.accepted.reference='موافقة العميل المسجلة';}
 else for(const g of data.packing.groups)delete g.name; // Factory DTOs contain technical group fields only.
 Object.defineProperty(data,'catalog',{get(){catalogTouches++;throw Error('Scoped widget requested full catalog');}});
 const ui=mountScopedDrawers(host,{role,data,getPack(){if(role!=='rep')throw Error('Factory requested private customer groups');return requests;},savePack:async next=>{calls.pack.push(clone(next));if(failPack)throw Error('تعذر حفظ طلبات العميل');requests=clone(next);return data;},preview:async op=>{calls.preview.push(clone(op));return clone(ready);},commit:async op=>{calls.commit.push(clone(op));if(failCommit)throw Error('تعذر الحفظ، احتفظ بالنموذج');if(op.kind==='drawer.measure')data.drawers[0].measurement=clone(op.values);if(op.kind==='drawer.preference'){data.drawers[0].contentsKg=op.contentsKg;data.drawers[0].pin=op.pin;}return data;},tell:m=>calls.tell.push(m),onInterior:id=>calls.interior.push(id)});
 return {host,ui,calls,failCommit:v=>failCommit=v,failPack:v=>failPack=v,requests:()=>requests};
}
const input=(form,name,value)=>{const el=form.querySelector('[name="'+name+'"]');assert(el,'Missing '+name);if(el.attrs.type==='checkbox')el.checked=value;else el.value=String(value);return el;};
const fill=(form,values)=>{for(const [k,v] of Object.entries(values))input(form,k,v);};
const forged=(marker,values={})=>{const f=new Element('form',{[marker]:marker.includes('measure')||marker.includes('preference')?'unit-1#1':''});for(const [name,value] of Object.entries(values)){const n=new Element('input',{name,value:String(value)});n.parentElement=f;f.children.push(n);}return f;};

const factory=mount('factory'),fh=factory.host;
assert(fh.querySelector('[data-measure]'));assert(!fh.querySelector('[data-preference]'));assert(!fh.querySelector('[data-group]'));assert(!fh.querySelector('[data-permissions]'));
assert(fh.innerHTML.includes('مرجع فني للمصنع'));assert(!fh.innerHTML.includes('CUSTOMER_NAME_MUST_NOT'));assert(!fh.innerHTML.includes('CUSTOMER_CONSENT_MUST_NOT'));assert(!fh.innerHTML.includes('ر.س'));
await fh.fire('click',fh.querySelector('[data-interior]'));assert.deepEqual(factory.calls.interior,['unit-1']);
let measure=fh.querySelector('[data-measure="unit-1#1"]');const other=fh.querySelector('[data-measure="unit-1#2"]'),selector=fh.querySelector('[data-bay-select]');
await fh.fire('input',input(measure,'emptyKg',4));assert(factory.ui.hasPending());assert(!measure.querySelector('input').disabled);assert(other.querySelector('input').disabled);assert(fh.querySelector('[data-propose]').querySelector('button').disabled);assert(selector.disabled);
await fh.fire('submit',other);assert.equal(factory.calls.commit.length,0,'Another dirty form cannot submit through an injected event');assert(factory.calls.tell.at(-1).includes('نموذج آخر'));
factory.failCommit(true);await fh.fire('submit',measure);assert.deepEqual(factory.calls.commit.at(-1),{kind:'drawer.measure',unitId:'unit-1',index:1,values:{...physical,emptyKg:4,reference:'مرجع فني للمصنع'}});
assert.equal(fh.querySelector('[data-measure="unit-1#1"]'),measure);assert.equal(measure.querySelector('[name="emptyKg"]').value,'4');assert(factory.ui.hasPending(),'Failure retains the dirty form');assert(!measure.querySelector('input').disabled);assert(other.querySelector('input').disabled);
factory.failCommit(false);await fh.fire('submit',measure);assert(!factory.ui.hasPending());assert.notEqual(fh.querySelector('[data-measure="unit-1#1"]'),measure);assert(!fh.querySelector('[data-measure="unit-1#2"]').querySelector('input').disabled);
const baySelect=fh.querySelector('[data-bay-select]');baySelect.value='unit-1#1';await fh.fire('change',baySelect);const bayForm=fh.querySelector('[data-bay]');assert(bayForm);
fill(bayForm,{size0:440,size1:390,size2:145,entry0:430,entry1:380,entry2:140,entryX:-2,entryY:3,reference:'قياس جديد'});await fh.fire('input',bayForm.querySelector('input'));await fh.fire('submit',bayForm);
assert.deepEqual(factory.calls.commit.at(-1),{kind:'packing.measure',bayId:'unit-1#1',values:{size:[440,390,145],entry:[430,380,140],entryAt:[-2,3],reference:'قياس جديد'}});
const fc=factory.calls.commit.length;await fh.fire('submit',forged('data-preference',{contentsKg:99,pin:'OTHER'}));await fh.fire('submit',forged('data-accept',{reference:'forged'}));assert.equal(factory.calls.commit.length,fc);assert.equal(factory.calls.pack.length,0);
await fh.fire('submit',fh.querySelector('[data-propose]'));assert.deepEqual(factory.calls.preview.at(-1),{kind:'packing.propose',preserve:true});assert(!fh.querySelector('[data-accept]'));assert(fh.querySelector('[data-proposal]').innerHTML.includes('يراجع المندوب'));
factory.ui.destroy();const oldCalls=factory.calls.commit.length;await fh.fire('submit',measure);assert.equal(factory.calls.commit.length,oldCalls);assert.equal(fh.innerHTML,'');

const rep=mount('rep'),rh=rep.host;
assert(!rh.querySelector('[data-measure]'));assert(!rh.querySelector('[data-bay-select]'));assert(rh.querySelector('[data-preference]'));assert(rh.querySelector('[data-group]'));assert(rh.querySelector('[data-permissions]'));assert(!rh.innerHTML.includes('مرجع فني للمصنع'));assert(!rh.innerHTML.includes('مرجع حيز للمصنع'));
let preference=rh.querySelector('[data-preference="unit-1#1"]');assert(rh.querySelector('[data-preference="unit-1#2"]').querySelector('button').disabled);
fill(preference,{contentsKg:0,pin:' HEAVY '});await rh.fire('input',preference.querySelector('input'));await rh.fire('submit',preference);assert.deepEqual(rep.calls.commit.at(-1),{kind:'drawer.preference',unitId:'unit-1',index:1,contentsKg:0,pin:'HEAVY'});assert(!rep.ui.hasPending());
await rh.fire('click',rh.querySelector('[data-group-edit]'));let group=rh.querySelector('[data-group]');fill(group,{name:'  قدر جديد  ',size0:210,size1:220,size2:95,count:2,massKg:4,fixed:'unit-1#1',rotate:false,stack:true,together:true});await rh.fire('input',group.querySelector('input'));rep.failPack(true);await rh.fire('submit',group);assert(rep.ui.hasPending());assert.equal(rh.querySelector('[data-group]'),group);assert.equal(group.querySelector('[name="name"]').value,'  قدر جديد  ');
rep.failPack(false);await rh.fire('submit',group);assert.deepEqual(rep.calls.pack.at(-1),{groups:[{id:'group-1',name:'قدر جديد',size:[210,220,95],count:2,massKg:4,rotate:false,stack:true,together:true,fixed:'unit-1#1'}],permissions:[{bayId:'unit-1#1',allowAuto:true}]});assert(!rep.ui.hasPending());
let permissions=rh.querySelector('[data-permissions]');await rh.fire('input',input(permissions,'bay',false));await rh.fire('submit',permissions);assert.deepEqual(rep.calls.pack.at(-1).permissions,[{bayId:'unit-1#1',allowAuto:false}]);assert.equal(rep.calls.pack.at(-1).groups[0].name,'قدر جديد');

// Discard must clear identities of the detached old forms, not merely a flag.
group=rh.querySelector('[data-group]');await rh.fire('input',input(group,'name','unsaved'));assert(rep.ui.hasPending());confirmAnswer=false;await rh.fire('click',rh.querySelector('[data-discard-drafts]'));assert.equal(rh.querySelector('[data-group]'),group);assert(rep.ui.hasPending());confirmAnswer=true;await rh.fire('click',rh.querySelector('[data-discard-drafts]'));assert(!rep.ui.hasPending());assert.notEqual(rh.querySelector('[data-group]'),group);
permissions=rh.querySelector('[data-permissions]');assert(!permissions.querySelector('button').disabled);await rh.fire('input',input(permissions,'bay',true));const packed=rep.calls.pack.length;await rh.fire('submit',permissions);assert.equal(rep.calls.pack.length,packed+1,'Detached discarded form cannot block a new form');assert(!rep.ui.hasPending());
const propose=rh.querySelector('[data-propose]');input(propose,'redistribute',true);await rh.fire('submit',propose);assert.deepEqual(rep.calls.preview.at(-1),{kind:'packing.propose',preserve:false});
const accept=rh.querySelector('[data-accept]'),area=rh.querySelector('[data-proposal]'),proposalHTML=area.innerHTML;assert(accept);await rh.fire('input',input(accept,'reference','موافقة العميل ٤'));assert(rep.ui.hasPending());assert.equal(area.innerHTML,proposalHTML,'Typing acceptance reference must preserve the proposal');assert.equal(rh.querySelector('[data-accept]'),accept);
assert(rh.querySelector('[data-group]').querySelector('input').disabled);assert(!accept.querySelector('input').disabled);
rep.failCommit(true);await rh.fire('submit',accept);assert.equal(rh.querySelector('[data-accept]'),accept);assert(rep.ui.hasPending());rep.failCommit(false);await rh.fire('submit',accept);assert.deepEqual(rep.calls.commit.at(-1),{kind:'packing.accept',preserve:false,reference:'موافقة العميل ٤'});assert(!rep.ui.hasPending());
const rc=rep.calls.commit.length;await rh.fire('submit',forged('data-measure',{...physical,reference:'forged'}));assert.equal(rep.calls.commit.length,rc,'Rep cannot invoke a factory measurement callback');
assert.equal(cacheTouches,0);assert.equal(catalogTouches,0);rep.ui.destroy();globalThis.FormData=NativeFormData;
console.log('PASS: mounted scoped drawer roles, exact measurement/preference/packing callbacks, owned group/permission saves, zero full-catalog/device-cache reads, retained acceptance proposals, one dirty form, discard identity cleanup and failed-save retention.');
