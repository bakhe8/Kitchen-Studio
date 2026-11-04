import assert from 'node:assert/strict';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {buildFactoryQuote,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {mountQuoteStep,mountFactoryStep} from '../public/kitchen-workshop-factory-ui.js';
import {mountSurfacePattern} from '../public/kitchen-surface-pattern-ui.js';
import {mountTeamCatalogStep} from '../public/kitchen-team-catalog-ui.js';
import {mountSyncStep} from '../public/kitchen-workshop-sync-ui.js';
import {mountInventoryStep} from '../public/kitchen-workshop-inventory-ui.js';

class View {
 innerHTML=''; targets=new Map(); handlers=new Map(); children=[];
 append(n){this.children.push(n);}
 replaceChildren(...n){this.children=n;}
 addEventListener(k,fn){this.handlers.set(k,fn);}
 removeEventListener(k){this.handlers.delete(k);}
 querySelector(q){if(!this.targets.has(q))this.targets.set(q,new View());return this.targets.get(q);}
 querySelectorAll(){return [];}
 focus(){this.focused=true;}
 remove(){}
}
globalThis.document={querySelector:()=>({}),createElement:()=>new View()};
let doc=makeChainExample();
doc=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{rice:false,dishwasher:false,sink:true}}).doc;
const original=JSON.stringify(doc),catalog=getFactoryCatalog(doc),q=buildFactoryQuote(doc);
let selected,notice;
const getDoc=()=>doc,onAdvance=(step,focus)=>selected={step,focus},tell=m=>notice=m;
const factoryHost=new View();
const catalogGuard=mountFactoryStep(factoryHost,{getDoc,tell,onAdvance,focus:{tab:'items'},apply:()=>assert.fail('Catalog navigation wrote a change')});
const itemForm=factoryHost.children[0].innerHTML.split('<form data-edit="item"')[1].split('</form>')[0];
assert.deepEqual([...itemForm.split('<details')[0].matchAll(/name="([^"]+)"/g)].map(x=>x[1]),['sku','name','kind','price']);
assert.deepEqual([...itemForm.matchAll(/name="([^"]+)"/g)].map(x=>x[1]).sort(),
 ['sku','name','kind','price','role','color','colorHex','thicknessMm','hardwareRole','stockLengthMm','stockWidthMm','kerfMm',
  'sectionWidthMm','gaugeMm','grooveWidthMm','grooveDepthMm','massKgM2','specRef','leadDays','stockUnits','available','offcutList'].sort());
assert.equal((itemForm.match(/class="kw-item-group"/g)||[]).length,3);
const catalogEditor=factoryHost.children[0],hits=catalogEditor.querySelector('[data-sku-results]');
const findMaterial=value=>catalogEditor.oninput({target:{value,matches:s=>s==='[data-find-sku]'}});
findMaterial('FACE');assert.match(hits.innerHTML,/data-sku="FACE/);assert(!hits.hidden);
findMaterial('this-sku-does-not-exist');assert.match(hits.innerHTML,/لا توجد أصناف مطابقة/);
findMaterial('');
assert.equal((hits.innerHTML.match(/data-factory-act="pickResult"/g)||[]).length,catalog.items.length);
assert.match(hits.innerHTML,/kw-stock-price/);
assert.equal((hits.innerHTML.match(/aria-pressed="true"/g)||[]).length,1);
assert(!catalogEditor.innerHTML.includes('name="pickItem"'),'a second chooser must not duplicate the visible register');
// A comparison or search must not discard an edited purchase price.
const field={tagName:'INPUT',name:'price',defaultValue:'10',value:'13',focus(){this.focused=true;}};
const fakeForm={elements:[field]};
catalogEditor.querySelectorAll=selector=>selector.includes('form[data-edit="item"]')?[fakeForm]:[];
const press=(act,sku)=>catalogEditor.onclick({target:{closest:()=>({dataset:{factoryAct:act,sku}})}});
const originalEditor=catalogEditor.innerHTML;
press('pickResult','FACE-6-W');
assert(catalogGuard.hasPending());
assert.equal(catalogEditor.querySelector('[data-item-switch-warning]').hidden,false);
assert.equal(catalogEditor.innerHTML,originalEditor);
press('keepItem');
assert.equal(field.value,'13');assert(field.focused);
press('pickResult','FACE-6-W');press('discardItem');
assert.match(catalogEditor.innerHTML,/name="sku" value="FACE-6-W"/);
field.value='10';assert(!catalogGuard.hasPending(),'reverting a saved value leaves no edit pending');
const host=new View();mountQuoteStep(host,{getDoc,onAdvance,tell});
const quote=host.children[0];
assert.match(quote.innerHTML,/data-quote-view="shop" hidden/);
const bucketIds=['shop','customer'];
const choices=bucketIds.map(quotePane=>({dataset:{quotePane},setAttribute(k,v){this[k]=v;}})),views=bucketIds.map(quoteView=>({dataset:{quoteView}}));
const previousQuery=quote.querySelectorAll;
quote.querySelectorAll=s=>s==='[data-quote-pane]'?choices:s==='[data-quote-view]'?views:[];
quote.onclick({target:{closest:s=>s==='[data-quote-pane]'?choices[0]:null}});
assert.deepEqual(views.map(v=>v.hidden),[false,true]);assert.equal(choices[0]['aria-pressed'],'true');
quote.querySelectorAll=previousQuery;
function clickSource(label) {
 const matches=[...quote.innerHTML.matchAll(/data-quote-source="(\d+)" aria-label="([^"]*)"/g)];
 const hit=matches.find(m=>m[2]===label);assert.ok(hit,label);
 selected=null;
 quote.onclick({target:{closest:s=>s==='[data-quote-source]'?{dataset:{quoteSource:hit[1]}}:null}});
 return selected;
}
const part=q.pieces.find(p=>catalog.families[p.family]?.recipe.filter(r=>r.label===p.label).length===1);
assert.deepEqual(clickSource('تحديد الوحدة '+part.unitId+' في الرسم'),{step:'placement',focus:{unitId:part.unitId}});
assert.deepEqual(clickSource('فتح الصف '+part.runId),{step:'row',focus:{runId:part.runId}});
assert.deepEqual(clickSource('فتح صنف المصنع '+part.sku),{step:'factory',focus:{tab:'items',sku:part.sku}});
assert.deepEqual(clickSource('مراجعة مصدر القطعة '+part.label+' · '+part.unitId),{step:'factory',focus:{tab:'recipes',family:part.family,line:catalog.families[part.family].recipe.findIndex(l=>l.label===part.label)}});
for(const [label,field] of [['النقل (ريال)','delivery'],['خامة السطح','worktop']]){
 assert.deepEqual(clickSource('مراجعة '+label),{step:'factory',focus:{tab:'sale',field}});
 const factory=new View();mountFactoryStep(factory,{getDoc,tell,onAdvance,focus:selected.focus,apply:()=>assert.fail('Selecting a rate wrote a change')});
 assert.ok(factory.children[0].querySelector('[name="'+field+'"]').focused);
}
assert.equal(JSON.stringify(doc),original);
doc=structuredClone(doc);assert.equal(clickSource('فتح صنف المصنع '+part.sku),null);assert.match(notice,/تغيّر المشروع/);

// Two disjoint slabs on one run: a unit selects its own. A run alone requests a choice.
doc.kitchen.units.splice(1,1);
const tops=kitchenGeometry(doc.kitchen,doc.room).worktops;
assert.ok(tops.length>=2);const last=tops.at(-1),unit=doc.kitchen.units.find(u=>u.runId===last.runId&&u.u===last.start);
for(const [focus,editable] of [[{unitId:unit.id},true],[{topId:last.id},true],[{runId:last.runId},false],[{topId:'retired'},false]]){
 const surface=new View();mountSurfacePattern(surface,{getDoc,tell,focus,apply:()=>assert.fail('Selecting a slab wrote a change')});
 assert.equal(surface.innerHTML.includes('name="source"'),editable);
 if(editable){
  assert.ok(surface.innerHTML.includes('value="'+last.id+'" selected'));assert.match(surface.innerHTML,/data-measured="false"/);
  const outer={name:'outerText',value:'0,0\n600,0\n600,500\n0,500'};
  surface.querySelectorAll=s=>s==='[name]'?[outer]:[];
  surface.handlers.get('input')({target:outer});
  assert.match(surface.querySelector('[data-pattern-plan]').innerHTML,/data-measured="true" points="0,0 600,0 600,500 0,500"/);
 }
 else assert.ok(surface.innerHTML.includes('اختر قطعة'));
}

// Selecting a material in a reservation preview retains the preview and any unrelated count draft.
const stocks=['A','B'].map(key=>({key,sku:'RAW-'+key,name:key,physical:10,held:0,free:10}));
const requests=[];
globalThis.fetch=async(path,init)=>{
 const url=new URL(path,'https://test.invalid'),body=init.body&&JSON.parse(init.body);requests.push({url,body});
 let data;
 if(url.pathname==='/api/projects')data={projects:[{id:'project',name:'project',role:'owner'}]};
 else if(url.pathname==='/api/catalogs')data=url.searchParams.has('action')?{versions:[{version:1}]}:{catalogs:[{id:'cat',name:'cat',role:'owner'}]};
 else if(body){assert.equal(body.action,'preview');data={lines:stocks.map(s=>({...s,qty:1}))};}
 else if(url.searchParams.has('project'))data={receipts:[{kind:'whole',revision:4}]};
 else data={role:'owner',stocks,reservations:[],history:[]};
 return {ok:true,headers:{get:()=>'application/json'},json:async()=>data};
};
const inventory=new View(),close=mountInventoryStep(inventory,{getDoc,tell});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
await flush();
const dispatch=(type,target)=>inventory.handlers.get(type)({target});
dispatch('input',{dataset:{inv:'count'},value:'47'});
dispatch('click',{closest:s=>s==='[data-inv-act]'?{dataset:{invAct:'preview'}}:null});
await flush();assert.ok(inventory.innerHTML.includes('data-stock-key="B"'),notice);
const calls=requests.length;
for(const key of ['B','A']){
 dispatch('click',{closest:s=>s==='[data-stock-key]'?{dataset:{stockKey:key}}:null});
 assert.ok(inventory.innerHTML.includes('value="'+key+'" selected'));
 assert.ok(inventory.innerHTML.includes('data-stock-key="B"'));
 assert.ok(inventory.innerHTML.includes('data-inv="count" value="'+(key==='A'?'47':'')+'"'));
}
assert.equal(requests.length,calls);close();
// Connection failures must still distinguish locally held work from team state.
globalThis.sessionStorage={getItem:()=>null};
let readCount=0;
globalThis.fetch=async(_url,options)=>{
 assert.ok(!options.method||options.method==='GET');readCount++;
 return new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}});
};
for(const [mount,visible,absent] of [
 [mountTeamCatalogStep,/الإصدار المطبق على المشروع/,'data-tc="apply"'],
 [mountSyncStep,/الرسم على الجهاز/,'data-sync="save"'],
 [mountInventoryStep,/سجّل الدخول/,'data-inv-act="reserve"']
]){
 const pane=new View();const dispose=mount(pane,{getDoc,tell});await flush();
 assert.match(pane.innerHTML,visible);assert.ok(!pane.innerHTML.includes(absent));dispose();
}
assert.equal(readCount,4);
console.log('Mounted output interactions: source-bound cuts/units/rows/material/terms, protected stale output, exact slab selection and read-only stock inspection.');
