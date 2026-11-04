import assert from 'node:assert/strict';
import {reviewQuotePreview,quoteProvenance} from '../public/kitchen-quote-preview.js';
import {makeChainExample,attestChain,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {seedCatalog,getFactoryCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs,catalogRecordStates} from '../public/kitchen-catalog-records.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {recordCustomerVersion} from '../public/kitchen-design-versions.js';
import {confirmFixtureFitout} from './fixture-kitchen-fitout.mjs';
import {saveProject,openKitchenProject,commitProject,undoProject,redoProject,storedKitchenProject} from '../public/kitchen-project.js';

class Store {
 constructor(){this.data=new Map();this.fail=false;}
 get length(){return this.data.size;}
 key(i){return [...this.data.keys()][i]??null;}
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){if(this.fail)throw Error('Storage unavailable');this.data.set(k,String(v));}
 removeItem(k){this.data.delete(k);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
function fixture(){
 const d=makeChainExample(),cat=seedCatalog();cat.approved=true;
 for(const item of cat.items){item.price=item.kind==='piece'?5:100;item.stockUnits=100;}
 Object.assign(cat.terms,{worktop:'separate',labor:120,delivery:30,installation:80,marginPct:10,taxPct:15});
 d.room.workshop.catalog=cat;
 d.room.workshop.chains.back=attestChain(d,'back',d.room.workshop.chains.back,{name:'Test survey',reference:'Quote test fixture only'}).chain;
 const row=planWorkshopRow(d,{...readChainRange(d,'back'),tier:'base',wanted:{rice:false,sink:false,dishwasher:false}});
 assert(row.ok,row.reason);confirmFixtureFitout(row.doc);
 row.doc.room.projectId='K-1234567890ABCDEF';
 row.doc.room.workshop=normalizeWorkshopCatalogs(row.doc.room.workshop);
 assert(buildFactoryQuote(row.doc).complete);return row.doc;
}
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
const round=v=>Math.round(v*100)/100;
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS '+name);}

await test('purchase price preview uses actual packed project quantities and is immutable',()=>{
 const doc=fixture(),before=JSON.stringify(doc),q=buildFactoryQuote(doc),purchase=q.purchases.find(p=>p.kind==='panel');
 const oldPrice=getFactoryCatalog(doc).items.find(i=>i.sku===purchase.sku).price;
 freeze(doc);
 const result=reviewQuotePreview(doc,{prices:{[purchase.sku]:oldPrice+25}}),next=buildFactoryQuote(result.doc);
 assert(result.changed);assert.notEqual(result.doc,doc);assert.equal(JSON.stringify(doc),before);
 assert.equal(result.materialDelta,round((purchase.valueUnits??purchase.qty)*25));
 assert.deepEqual(result.quote,next);assert.deepEqual(result.previousQuote,q);
 assert.equal(result.total,next.total);assert.equal(result.previousTotal,q.total);assert.equal(result.delta,round(next.total-q.total));
 assert.equal(result.materialValue,next.materialValue);
 assert.deepEqual(result.changes,[{kind:'price',sku:purchase.sku,before:oldPrice,after:oldPrice+25}]);
 assert.deepEqual(result.doc.kitchen,doc.kitchen);assert.deepEqual(result.doc.room.workshop.chains,doc.room.workshop.chains);
});

await test('service and percentage edits quote the exact existing sale calculation',()=>{
 const doc=fixture(),out=reviewQuotePreview(doc,{terms:{labor:200,delivery:0,marginPct:20,taxPct:5}});
 const q=out.quote,cost=q.subtotal+q.extras.reduce((n,x)=>n+(x.cost??0),0)+q.worktop+200+80;
 assert.equal(q.saleBeforeTax,round(cost*1.2));assert.equal(q.total,round(q.saleBeforeTax*1.05));
 assert.equal(out.changes.length,4);assert(out.changes.every(x=>x.kind==='term'));
 assert.deepEqual(out.doc.room.workshop.storeCatalog,doc.room.workshop.storeCatalog);
 assert.deepEqual(out.doc.room.workshop.factoryRecipes,doc.room.workshop.factoryRecipes);
 assert.equal(out.doc.room.workshop.pricingTerms.revision,doc.room.workshop.pricingTerms.revision+1);
 assert.equal(out.doc.room.workshop.pricingTerms.approved,false);
 assert.equal(out.doc.room.workshop.catalogMeta.layoutRevision,doc.room.workshop.catalogMeta.layoutRevision);
 assert.equal(reviewQuotePreview(doc,{terms:{worktop:'include'}}).quote.worktopIncluded,true);
});

await test('no-op keeps exact document identity and never installs seed records',()=>{
 const doc=fixture(),cat=getFactoryCatalog(doc);
 for(const edits of [{},{prices:{}},{terms:{}},{prices:{'BODY-6':cat.items.find(i=>i.sku==='BODY-6').price},terms:{labor:cat.terms.labor}}]){
  const out=reviewQuotePreview(doc,edits);assert.equal(out.doc,doc);assert.equal(out.changed,false);assert.deepEqual(out.changes,[]);assert.equal(out.delta,0);
 }
 const bare=structuredClone(doc);for(const k of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete bare.room.workshop[k];
 assert.equal(reviewQuotePreview(bare).doc,bare);assert.equal(reviewQuotePreview(bare,{prices:{'BODY-6':null}}).doc,bare);
});

await test('unpriced null is distinct from explicit zero and never manufactures a price delta',()=>{
 const doc=fixture(),sku=buildFactoryQuote(doc).purchases[0].sku;
 const missing=reviewQuotePreview(doc,{prices:{[sku]:null}});
 assert.equal(missing.quote.complete,false);assert.equal(missing.total,null);assert.equal(missing.delta,null);
 assert.equal(missing.materialValue,null);assert.equal(missing.materialDelta,null);assert(missing.quote.missing.includes(sku));
 const zero=reviewQuotePreview(missing.doc,{prices:{[sku]:0}});assert.equal(zero.quote.complete,true);assert.equal(zero.delta,null);
 assert.equal(zero.quote.purchases.find(p=>p.sku===sku).cost,0);
 const service=reviewQuotePreview(doc,{terms:{labor:null}});assert.equal(service.total,null);assert(service.materialValue>0);assert.equal(service.materialDelta,0);
 assert.equal(reviewQuotePreview(service.doc,{terms:{labor:0}}).quote.complete,true);
});

await test('strict edit schema rejects unknown fields, coercion and invalid numerical ranges',()=>{
 const doc=fixture(),before=JSON.stringify(doc);
 const invalid=[null,[],{catalog:{}},{prices:null},{prices:[]},{terms:null},{terms:[]},{prices:{missing:10}},
  {terms:{discount:10}},{terms:{approved:true}},{terms:{worktop:null}},{terms:{worktop:'yes'}},
  ...['', '10',undefined,true,NaN,Infinity,-1,1e8+1].map(value=>({prices:{'BODY-6':value}})),
  ...['',undefined,true,NaN,Infinity,-1,1e8+1].map(value=>({terms:{labor:value}})),
  {terms:{taxPct:100.01}},{terms:{marginPct:101}},Object.create({prices:{'BODY-6':10}}),
  JSON.parse('{"prices":{"__proto__":1}}')];
 for(const edits of invalid)assert.throws(()=>reviewQuotePreview(doc,edits),Error,JSON.stringify(edits));
 assert.equal(JSON.stringify(doc),before);
 assert.equal(reviewQuotePreview(doc,{prices:{'BODY-6':1e8},terms:{marginPct:100,taxPct:100,labor:1e8}}).changed,true);
});

await test('changed records lose only their own approval and update exactly one revision',()=>{
 const doc=fixture(),before=catalogRecordStates(doc.room.workshop);
 const out=reviewQuotePreview(doc,{prices:{'BODY-6':101,'PULL':6},terms:{delivery:31,labor:121}}),after=catalogRecordStates(out.doc.room.workshop);
 assert.deepEqual(after,{store:{revision:before.store.revision+1,approved:false},factory:before.factory,pricing:{revision:before.pricing.revision+1,approved:false}});
 assert.equal(out.doc.room.workshop.catalogMeta.revision,doc.room.workshop.catalogMeta.revision+1);
 assert.deepEqual(out.doc.room.workshop.factoryRecipes,doc.room.workshop.factoryRecipes);
 assert.equal(out.quote.ready,false);assert.equal(out.quote.complete,true);
 assert.equal(Object.keys(out.doc.room.workshop).includes('catalog'),false);
});

await test('actual price changes preserve structural approval and stale the signed customer order',async()=>{
 let doc=fixture();let state=await approvalState(doc);
 doc={...doc,room:{...doc.room,workshop:{...doc.room.workshop,approvals:{structure:{key:state.keys.structure,name:'Test engineer',date:'2026-11-04T10:00:00.000Z'}}}}};
 state=await approvalState(doc);
 const signed=recordCustomerVersion({doc,state,name:'Test customer',date:'2026-11-04T10:01:00.000Z'});assert(signed.ok,signed.reason);doc=signed.doc;
 const before=await approvalState(doc);assert(before.valid.customer);
 for(const edits of [{prices:{'BODY-6':110}},{terms:{labor:130}}]){
  const out=reviewQuotePreview(doc,edits),after=await approvalState(out.doc);
  assert(after.valid.structure);assert.equal(after.keys.structure,before.keys.structure);assert.equal(after.valid.customer,false);
  assert.notEqual(after.keys.customer,before.keys.customer);assert.notEqual(after.keys.release,before.keys.release);
  assert.deepEqual(out.doc.room.workshop.approvals,doc.room.workshop.approvals);assert.deepEqual(out.doc.room.workshop.versions,doc.room.workshop.versions);
 }
});

await test('missing catalog records seed safely while malformed stored records fail closed',()=>{
 const doc=fixture();for(const k of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete doc.room.workshop[k];delete doc.room.workshop.catalog;
 const before=JSON.stringify(doc),out=reviewQuotePreview(doc,{prices:{'BODY-6':30},terms:{labor:0}});
 assert(out.changed);assert.equal(getFactoryCatalog(out.doc).items.find(i=>i.sku==='BODY-6').price,30);
 assert(out.doc.room.workshop.storeCatalog&&out.doc.room.workshop.factoryRecipes&&out.doc.room.workshop.pricingTerms);
 assert.equal(JSON.stringify(doc),before);assert(Object.values(catalogRecordStates(out.doc.room.workshop)).every(s=>!s.approved));
 const malformed=fixture();malformed.room.workshop.storeCatalog.items[0].price=-1;
 assert.throws(()=>reviewQuotePreview(malformed,{terms:{labor:1}}),/كتالوج|سجل/);
 const partial=fixture();delete partial.room.workshop.pricingTerms;assert.throws(()=>reviewQuotePreview(partial),/كتالوج|سجل/);
});

await test('provenance comes from actual produced pieces and grouped purchases without allocating shared stock',()=>{
 const doc=fixture(),q=buildFactoryQuote(doc),before=JSON.stringify(q),out=quoteProvenance(doc,q);
 assert(out.units.length>0);assert.equal(out.materials.length,q.purchases.length);
 const id=doc.kitchen.units[0].id,unit=out.units.find(u=>u.unitId===id);assert(unit);
 assert.deepEqual(unit.skus,[...new Set(q.pieces.filter(p=>p.unitId===id).map(p=>p.sku))]);
 assert.deepEqual(unit.pieces,q.pieces.filter(p=>p.unitId===id));
 for(const material of out.materials){assert.deepEqual(material.purchase,q.purchases.find(p=>p.sku===material.sku));assert(material.unitIds.every(id=>material.pieces.some(p=>p.unitId===id)));}
 assert.equal(JSON.stringify(q),before);
 const synthetic={...q,pieces:[...q.pieces,{unitId:'corner:back+left:base',runId:'back+left',sku:q.purchases[0].sku,count:1}]};
 assert(quoteProvenance(doc,synthetic).units.some(u=>u.unitId==='corner:back+left:base'));
});

await test('preview commits once through actual save/reopen/undo/redo without losing catalog ownership',()=>{
 globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();assert(saveProject(fixture()));
 const doc=openKitchenProject(),out=reviewQuotePreview(doc,{prices:{'BODY-6':120},terms:{delivery:45}}),result=commitProject(doc,out.doc);
 assert(result.ok&&result.saved,result.reason);assert.deepEqual(buildFactoryQuote(storedKitchenProject()),out.quote);
 const undone=undoProject(result.next);assert(undone?.saved);assert.equal(getFactoryCatalog(undone.next).terms.delivery,30);
 assert.equal(getFactoryCatalog(undone.next).items.find(i=>i.sku==='BODY-6').price,100);
 const redone=redoProject(undone.next);assert(redone?.saved);assert.equal(buildFactoryQuote(redone.next).total,out.total);
 assert.deepEqual(catalogRecordStates(redone.next.room.workshop),catalogRecordStates(result.next.room.workshop));
});

await test('storage failure and stale source reject preview application without replacing the saved order',()=>{
 globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();assert(saveProject(fixture()));let doc=openKitchenProject();
 const out=reviewQuotePreview(doc,{prices:{'BODY-6':130}}),old=localStorage.getItem('atlas-kitchen:project:v1');localStorage.fail=true;
 const failed=commitProject(doc,out.doc);assert.equal(failed.ok,false);assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),old);localStorage.fail=false;
 doc=openKitchenProject();const next=reviewQuotePreview(doc,{terms:{delivery:60}});
 localStorage.setItem('atlas-kitchen:project:v1',localStorage.getItem('atlas-kitchen:project:v1')+' ');
 const stale=commitProject(doc,next.doc);assert.equal(stale.code,'stale-project');assert.equal(getFactoryCatalog(storedKitchenProject()).terms.delivery,30);
});

console.log(`Quote preview: ${groups} groups passed.`);
