import assert from 'node:assert/strict';
// The factory catalog set up once on the device: a new visit starts from it, and the intake page says whether it is ready.
import {seedCatalog,cleanCatalog,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {newSurveyProject} from '../public/kitchen-project.js';
import {cleanStudioRoom} from '../public/kitchen-studio-room.js';
import {deviceCatalogKey,readDeviceCatalog,catalogReadiness,readinessText,deviceReadiness,withDeviceCatalog,installDeviceCatalog} from '../public/kitchen-device-catalog.js';
import {encodePortableCatalog} from '../public/kitchen-factory-template.js';
import {catalogRecordStates} from '../public/kitchen-catalog-records.js';

class Store{
 constructor(){this.mem=new Map;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
const priced=(over={})=>{
 const c=seedCatalog();c.approved=true;c.items.forEach(i=>{i.price=i.kind==='piece'?5:10;});
 Object.assign(c.terms,{labor:100,installation:50,delivery:30,marginPct:10,taxPct:15},over);return c;
};
const put=(store,catalog)=>store.setItem(deviceCatalogKey,JSON.stringify(catalog));
const survey=store=>newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'مشروع'},store);

// ---------- reading what was saved ----------
const empty=new Store;
assert.equal(readDeviceCatalog(empty),null);assert.equal(deviceReadiness(empty).state,'none');
empty.setItem(deviceCatalogKey,'{not json');assert.equal(readDeviceCatalog(empty),null,'a damaged template reads as none');
empty.setItem(deviceCatalogKey,JSON.stringify({version:1,name:'x'}));assert.equal(readDeviceCatalog(empty),null,'a template that is not a catalog reads as none');
assert.equal(readDeviceCatalog({getItem(){throw new Error('storage blocked');}}),null,'blocked storage reads as none');
assert.equal(readDeviceCatalog(undefined),null,'no storage at all reads as none');

// ---------- ready, incomplete, draft, none ----------
assert.equal(catalogReadiness(null).state,'none');
const seed=seedCatalog();
let r=catalogReadiness(cleanCatalog(seed));assert.equal(r.state,'draft','a catalog the factory has not approved');
assert.equal(r.unpriced.length,seed.items.length);assert.equal(r.missingTerms.length,5);
const half=priced();half.items[0].price=null;half.items[1].price=null;half.terms.taxPct=null;
r=catalogReadiness(cleanCatalog(half));assert.equal(r.state,'incomplete','approved but missing prices and a term');
assert.equal(r.unpriced.length,2);assert.deepEqual(r.missingTerms,['الضريبة ٪']);
assert.match(readinessText(r),/معتمد لكن ينقصه: ٢ أصناف بلا سعر، الضريبة ٪/);
const one=priced();one.items[0].price=null;assert.match(readinessText(catalogReadiness(cleanCatalog(one))),/ينقصه: ١ صنف بلا سعر\./);
r=catalogReadiness(cleanCatalog(priced()));assert.equal(r.state,'ready');assert.deepEqual([r.unpriced.length,r.missingTerms.length],[0,0]);
assert.match(readinessText(r),/جاهز على هذا الجهاز: «.+» · إصدار ١ · معتمد/);
assert.match(readinessText({state:'none'}),/لا يوجد كتالوج مصنع محفوظ على هذا الجهاز/);assert.match(readinessText({state:'draft',name:'كتالوجي'}),/«كتالوجي».*لم تُعتمد وصفاته/);
const zeroPrice=priced();zeroPrice.items[0].price=0;assert.equal(catalogReadiness(cleanCatalog(zeroPrice)).state,'ready','a price of zero is a decided price');

// ---------- a new project starts from it ----------
const device=new Store;put(device,priced());
const fresh=survey(device),started=withDeviceCatalog(fresh,device);
assert.equal(fresh.room.workshop,undefined,'a new project has no catalog of its own yet');
const own=getFactoryCatalog(started);
assert.equal(catalogReadiness(own).state,'ready','it prices from the first screen');assert.equal(own.approved,true);assert.equal(own.revision,1);assert.equal(own.layoutRevision,1);
assert.equal(own.teamSource,undefined);assert.deepEqual(own.specials,{});
assert.equal(own.items.find(i=>i.sku==='AL-20').price,10,'prices came with it');assert.equal(own.terms.labor,100);
assert.deepEqual(cleanStudioRoom(started.room).workshop.catalog,started.room.workshop.catalog,'and it survives loading the project');
assert.equal(started.kitchen,fresh.kitchen,'nothing else about the project changed');
// custom sheets of another project never travel
const withSheets=priced();withSheets.specials={};put(device,withSheets);assert.deepEqual(getFactoryCatalog(withDeviceCatalog(survey(device),device)).specials,{});
// not approved: the project keeps the plain seed, as before
const draftStore=new Store;put(draftStore,Object.assign(priced(),{approved:false}));
assert.equal(withDeviceCatalog(survey(draftStore),draftStore).room.workshop,undefined,'an unapproved template is not used');
assert.equal(withDeviceCatalog(survey(empty),empty).room.workshop,undefined,'no template, no change');
// a project with its own catalog is left alone
const theirs=priced({labor:999}),owned={...fresh,room:{...fresh.room,workshop:{catalog:cleanCatalog({...theirs,name:'كتالوج المشروع'})}}};
assert.equal(withDeviceCatalog(owned,device),owned,'an opened file or team template keeps its catalog');
// partly priced templates still start the project (the gaps stay visible in the quote)
const partial=new Store;put(partial,half);assert.equal(catalogReadiness(getFactoryCatalog(withDeviceCatalog(survey(partial),partial))).state,'incomplete');

// ---------- applying it to a project that is already open ----------
const open=survey(new Store),template=cleanCatalog(priced());
const applied=installDeviceCatalog(open,template),cat=getFactoryCatalog(applied);
assert.equal(cat.approved,true,'the approval comes with the catalog');assert.equal(cat.revision,1,'a project with no catalog of its own gets revision 1');
assert.equal(catalogReadiness(cat).state,'ready');assert.equal(cat.teamSource,undefined);
assert.equal(installDeviceCatalog(open,cleanCatalog(Object.assign(priced(),{approved:false}))),null,'only an approved catalog can be applied');
const again=installDeviceCatalog(applied,template);assert.equal(getFactoryCatalog(again).revision,2,'applying twice is another revision');assert.equal(getFactoryCatalog(again).layoutRevision,getFactoryCatalog(applied).layoutRevision,'with the same families the stored rows stay valid');
const changedFamilies=priced();changedFamilies.families.storage.maxMm+=50;
const moved=installDeviceCatalog(applied,cleanCatalog(changedFamilies));assert.equal(getFactoryCatalog(moved).layoutRevision,getFactoryCatalog(moved).revision,'other families mean the rows are rebuilt');

// Split templates do not quietly turn separate store/pricing drafts into approvals.
const separate=encodePortableCatalog(priced());separate.storeCatalog.approved=false;separate.pricingTerms.approved=false;
const separatedStore=new Store;put(separatedStore,separate);
const decoded=readDeviceCatalog(separatedStore);assert.equal(decoded.approved,true,'the legacy alias describes factory approval only');
assert.equal(catalogReadiness(decoded).state,'incomplete');assert.match(readinessText(catalogReadiness(decoded)),/اعتماد أصناف المتجر/);
assert.match(readinessText(catalogReadiness(decoded)),/اعتماد شروط التسعير/);
assert.equal(JSON.parse(JSON.stringify(decoded)).storeCatalog.approved,false,'serializing the reader result retains record approvals');
const separateVisit=withDeviceCatalog(survey(separatedStore),separatedStore);
assert.deepEqual(catalogRecordStates(separateVisit.room.workshop),{store:{revision:1,approved:false},factory:{revision:1,approved:true},pricing:{revision:1,approved:false}});
const savedSeparate=JSON.parse(JSON.stringify(separateVisit));
assert.equal(withDeviceCatalog(savedSeparate,device),savedSeparate,'a raw split project is never replaced by the device template');
const explicitlyApplied=installDeviceCatalog(survey(empty),decoded);
assert.equal(explicitlyApplied.room.workshop.storeCatalog.approved,false);assert.equal(explicitlyApplied.room.workshop.pricingTerms.approved,false);

// ---------- the intake page says it ----------
const {mountVisitStart}=await import('../public/kitchen-visit-start.js');
function element(){
 const children=new Map(),handlers=new Map();
 return {value:'',textContent:'',innerHTML:'',dataset:{},style:{},hidden:false,
  querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s);},
  addEventListener(k,f){handlers.set(k,f);},focus(){},select(){},remove(){},setCustomValidity(){},reportValidity(){}};
}
async function intake(catalogJson){
 const main=element(),form=main.querySelector('form');
 form.elements=Object.fromEntries(['widthMm','lengthMm','heightMm','name'].map(k=>[k,element()]));
 globalThis.document={createElement:()=>main,body:{append(){}},querySelector:()=>element()};
 globalThis.localStorage={getItem:k=>k===deviceCatalogKey?catalogJson:null,setItem(){throw Error('the intake page must not save anything');}};
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 mountVisitStart(()=>{});
 return main.querySelector('[data-catalog-status]');
}
let box=await intake(null);
assert.equal(box.dataset.state,'none');assert.match(box.innerHTML,/لا يوجد كتالوج مصنع محفوظ على هذا الجهاز/);assert.match(box.innerHTML,/href="\?panel=workshop&amp;step=template">إعداد الكتالوج</);
box=await intake(JSON.stringify(Object.assign(priced(),{approved:false})));assert.equal(box.dataset.state,'draft');assert.match(box.innerHTML,/لم تُعتمد وصفاته بعد/);
box=await intake(JSON.stringify(half));assert.equal(box.dataset.state,'incomplete');assert.match(box.innerHTML,/ينقصه: ٢ أصناف بلا سعر، الضريبة ٪/);
box=await intake(JSON.stringify(priced()));assert.equal(box.dataset.state,'ready');assert.match(box.innerHTML,/جاهز على هذا الجهاز/);assert.match(box.innerHTML,/>مراجعة الكتالوج</);
const named=priced();named.name='<img src=x onerror=alert(1)>';box=await intake(JSON.stringify(named));assert(!box.innerHTML.includes('<img src=x'),'the catalog name is text, never markup');

console.log('PASS: a ready device catalog starts every new project priced and approved; an unapproved or missing one changes nothing; applying it to an open project keeps its approval; the intake page says whether the catalog is ready.');
