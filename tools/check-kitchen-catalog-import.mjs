import {mountFactoryStep} from '../public/kitchen-workshop-factory-ui.js';
import assert from 'node:assert/strict';
import {cleanCatalog,seedCatalog,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {parseWorkshopTable,openWorkshopTables} from '../public/kitchen-workshop-spreadsheet.js';
import {detectCatalogColumns,previewCatalogImport,applyCatalogImport} from '../public/kitchen-catalog-import.js';
import {mountCatalogImport} from '../public/kitchen-catalog-import-ui.js';

assert.deepEqual(parseWorkshopTable('\uFEFFSKU,Name\r\nX,"مفصلة, \"\":٥٠\"\",\r\nدرج"'),[['SKU','Name'],['X','مفصلة, ":٥٠",\r\nدرج']]);
assert.deepEqual(parseWorkshopTable('sep=;\r\nsku;price\r\nabc;0'),[['sku','price'],['abc','0']]);
assert.throws(()=>parseWorkshopTable('sku,name\na,"test'),/التنصيص/);
assert.throws(()=>parseWorkshopTable('a\tb\n1\t"b"x'),/إغلاق/);
const file=new File([new Uint8Array([255,254,...Buffer.from('sku\tprice\nx\t2','utf16le')])],'factory.tsv');
assert.deepEqual((await openWorkshopTables(file)).sheets,[{name:'factory.tsv',rows:[['sku','price'],['x','2']]}]);
await assert.rejects(openWorkshopTables(new File(['x'],'legacy.xls')),/XLSX/);
await assert.rejects(openWorkshopTables(new File([new Uint8Array([255,133,150])],'a.csv')),/ترميز/);

const catalog=cleanCatalog({...seedCatalog(),approved:true});
const doc={room:{projectId:'factory-01',workshop:{catalog}},kitchen:{}};
const src='رمز الصنف\tسعر الشراء\tوحدة السعر\tاسم الصنف\tنوع الخام\tطول الخام مم\tعرض الخام مم\tالسماكة مم\tفاقد المنشار مم\tالعملة';
const data=src+'\nAL-20\t١٢٫٥\tمتر\t\t\t\t\t\t\tSAR\nG-18\t5\tm²\tلوح رملي\tلوح\t2000\t1000\t18\t3\tريال سعودي\nHINGE\t0\tقطعة\t\t\t\t\t\t\tSAR';
function preview(text,source=doc){const rows=parseWorkshopTable(text);return previewCatalogImport(source,rows,detectCatalogColumns(rows[0]));}
const checked=preview(data);
assert.deepEqual(checked.errors,[]);assert.equal(checked.updated,2);assert.equal(checked.added,1);assert.ok(checked.entries[0].priceNote.includes('×'));
const saved=applyCatalogImport(doc,checked);
assert.ok(saved.ok);
const changed=getFactoryCatalog(saved.doc);
assert.equal(changed.items.find(i=>i.sku==='AL-20').price,75);
assert.equal(changed.items.find(i=>i.sku==='G-18').price,10);
assert.equal(changed.items.find(i=>i.sku==='HINGE').price,0);
assert.equal(changed.revision,catalog.revision+1);
assert.equal(changed.layoutRevision,catalog.layoutRevision);
assert.equal(changed.approved,true,'price/name edits and an unreferenced new SKU preserve the factory approval');
assert.equal(saved.doc.room.workshop.storeCatalog.approved,false,'the imported item changes require store approval');
assert.equal(saved.doc.room.workshop.pricingTerms.approved,true);
assert.deepEqual(changed.terms,catalog.terms);assert.deepEqual(changed.families,catalog.families);assert.deepEqual(changed.specials,catalog.specials);
assert.equal(getFactoryCatalog(doc).approved,true);
assert.equal(preview(data,saved.doc).unchanged,3);assert.equal(preview(data,saved.doc).next,null);
assert.equal(applyCatalogImport({...doc},checked).ok,false);
for(const [text,reason] of [
 ['sku,price,unit\nAL-20,9,pair',/وحدة السعر/],['sku,price\nAL-20,12',/وحدة السعر/],['sku,price,unit,currency\nAL-20,12,bar,USD',/عملة/],
 ['sku,name\nhinge,X',/كتابة الرمز/],['sku,name\nHINGE,A\nHINGE,B',/مكرر/],
 ['sku,type\nAL-20,panel',/نوع الخام يختلف/],['sku,name\nG12,A',/نوع الخام/],['sku,name,name\nHINGE,a,a',/عمودين/],
 ['sku,name,type,stockLengthMm\nXX,A,bar,1300',/فاقد المنشار/],
 ]){const p=preview(text);assert.ok(p.errors.some(e=>reason.test(e)),text);assert.equal(p.next,null);}
const bogus=preview('sku,price,unit\nHINGE,1,each,extra');assert.ok(bogus.errors.length);
const noNameHeaders=parseWorkshopTable('بيع\tالكود\n100\tHINGE');
const mapped=previewCatalogImport(doc,[...noNameHeaders.slice(0,1).map(r=>[...r,'تسعير']),['100','HINGE','piece']],['price','sku','basis']);
assert.ok(mapped.next);
const wrongDim=previewCatalogImport(doc,[['SKU','طول العود م'],['AL-20','6']],['sku','length']);
assert.equal(wrongDim.next,null);assert.match(wrongDim.errors.join(' '),/ملليمترات/);

class Node {
 constructor(){this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.children=new Map();this.listeners={};}
 querySelector(key){if(!this.children.has(key))this.children.set(key,new Node());return this.children.get(key);}
 querySelectorAll(key){return this.children.has(key)?[this.children.get(key)]:[];}
 append(child){this.child=child;}
 replaceChildren(child){this.child=child;}
 closest(){return null;}
 focus(){}
 remove(){}
 addEventListener(key,handler){this.listeners[key]=handler;}
 event(type,query){
  const target=this.querySelector(query);target.matches=s=>s===query;
  target.closest=s=>s==='button'?target:null;
  return this.listeners[type]({target});
 }
}
const h=new Node();let state=doc,writes=0;
const mounted=mountCatalogImport(h,{getDoc:()=>state,apply:d=>{state=d;writes++;return {ok:true};}});
h.querySelector('[data-ci-text]').value=data;await h.event('input','[data-ci-text]');assert.ok(mounted.hasPending());
await h.event('click','[data-ci-read]');assert.match(h.querySelector('[data-ci-mapping]').innerHTML,/data-ci-map/);
await h.event('click','[data-ci-preview-action]');assert.match(h.querySelector('[data-ci-preview]').innerHTML,/AL-20/);assert.equal(writes,0);
state={...doc};await h.event('click','[data-ci-apply]');assert.equal(writes,0);assert.match(h.querySelector('[data-ci-status]').textContent,/تغير/);
await h.event('click','[data-ci-preview-action]');await h.event('click','[data-ci-apply]');assert.equal(writes,1);assert.equal(mounted.hasPending(),false);
mounted();
console.log('UTF-8/UTF-16 CSV and Excel paste, explicit units and header mapping, scaled pricing, stable recipes, stale preview and mounted confirmation verified.');

// Compare/confirm the import through the catalog that owns it, even after a
// clerk consults another catalog tab while the spreadsheet is staged.
const catalogHost=new Node();state=doc;writes=0;
globalThis.document={querySelector:()=>({}),createElement:()=>new Node()};
const catalogView=mountFactoryStep(catalogHost,{getDoc:()=>state,apply:d=>{state=d;writes++;return {ok:true,saved:true};}});
const surface=catalogHost.child;
assert.ok(!surface.innerHTML.includes('مطابقة طلبية'));
const switchTab=tab=>surface.onclick({target:{closest:()=>({dataset:{factoryAct:'tab',tab}})}});
switchTab('importItems');
const staged=surface.querySelector('[data-catalog-import]').child;
staged.querySelector('[data-ci-text]').value=data;
await staged.event('input','[data-ci-text]');
await staged.event('click','[data-ci-read]');
await staged.event('click','[data-ci-preview-action]');
assert.ok(catalogView.hasPending());assert.equal(writes,0);
switchTab('items');assert.ok(catalogView.hasPending());
switchTab('importItems');
assert.equal(surface.querySelector('[data-catalog-import]').child,staged);
assert.equal(staged.querySelector('[data-ci-text]').value,data);
await staged.event('click','[data-ci-apply]');
assert.equal(writes,1);assert.equal(catalogView.hasPending(),false);
assert.equal(getFactoryCatalog(state).items.find(i=>i.sku==='AL-20').price,75);
catalogView();
console.log('Native factory catalog keeps staged import and exit guard across internal tabs; confirmation updates the catalog once.');
