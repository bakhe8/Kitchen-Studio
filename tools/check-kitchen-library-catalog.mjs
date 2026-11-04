import assert from 'node:assert/strict';
// Library records copied into a project's factory catalog as bought pieces.
class Store{
 constructor(){this.mem=new Map;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
const {newSurveyProject}=await import('../public/kitchen-project.js');
const {getFactoryCatalog}=await import('../public/kitchen-workshop-factory.js');
const {createLibraryStore,memoryAdapter}=await import('../public/kitchen-library-store.js');
const {catalogRows,addToCatalog,canAddToCatalog,catalogCode,catalogLibraries}=await import('../public/kitchen-library-catalog.js');

const lib=createLibraryStore({adapter:memoryAdapter()});
let doc=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'مشروع'},globalThis.localStorage);
const before=getFactoryCatalog(doc);

// ---------- which records go ----------
assert.deepEqual([...catalogLibraries],['sink','hardware','handle']);
const hinge=lib.get('hardware','gen-hinge-110'),sink=lib.get('sink','gen-steel-single-60'),fridge=lib.list('appliance')[0],finish=lib.get('finish','oak');
assert(canAddToCatalog(hinge)&&canAddToCatalog(sink));assert(!canAddToCatalog(fridge),'an appliance is the customer\'s, not a factory purchase');assert(!canAddToCatalog(finish));assert(!canAddToCatalog(null));
const meter=await lib.save('hardware',{label:'شريط حواف',family:'other',attrs:{unit:'meter'}});assert(!canAddToCatalog(meter.record),'a price per metre needs a stock length, so it comes from a catalog file');

// ---------- the rows ----------
let rows=catalogRows([hinge,sink,fridge,meter.record]);
assert.equal(rows.rows.length,3,'header and two pieces');assert.equal(rows.skipped.length,2);
assert.match(rows.skipped[0].reason,/لا تُضاف إلى كتالوج المصنع/);assert.match(rows.skipped[1].reason,/بالمتر/);
assert.deepEqual(rows.rows[1],['LIB-gen-hinge-110','مفصلة ١١٠° بإغلاق هادئ','قطعة','','قطعة'],'a record without a price carries none');
const coded=await lib.save('hardware',{label:'سكة بشراء',family:'slide',attrs:{unit:'set',code:'SL-450'},price:'١٢٫٥'});
assert.equal(catalogCode(coded.record),'SL-450','the supplier code is the item code');
assert.equal(catalogCode({...coded.record,attrs:{code:'bad code!'}}).startsWith('LIB-'),true,'a code the catalog would refuse is replaced');
assert.deepEqual(catalogRows([coded.record]).rows[1],['SL-450','سكة بشراء','قطعة',12.5,'قطعة']);
assert.equal(catalogRows([hinge]).rows[1][1].length<=84,true);
const long=await lib.save('hardware',{label:'ص'.repeat(100),family:'hinge',attrs:{unit:'piece'}});assert.equal(catalogRows([long.record]).rows[1][1].length,84,'a long name is cut to what the catalog accepts');

// ---------- adding them ----------
assert.equal(addToCatalog(doc,[]).ok,false);assert.equal(addToCatalog(doc,[fridge]).reason,'هذه المكتبة لا تُضاف إلى كتالوج المصنع.');
let out=addToCatalog(doc,[hinge,sink,coded.record]);assert(out.ok,out.reason);
assert.deepEqual([out.added,out.updated,out.count],[3,0,3]);assert.equal(out.revision,before.revision+1);
const catalog=getFactoryCatalog(out.doc);
assert.equal(catalog.items.length,before.items.length+3,'three pieces joined the catalog');
const item=catalog.items.find(i=>i.sku==='SL-450');assert.deepEqual([item.kind,item.price,item.name],['piece',12.5,'سكة بشراء']);
assert.equal(catalog.items.find(i=>i.sku==='LIB-gen-hinge-110').price,null,'no price stays undecided');
assert.equal(catalog.approved,false,'a new catalog version waits for the factory\'s approval');
assert.equal(out.skipped.length,0);
assert.equal(doc.room.workshop?.catalog,undefined,'the project itself was not touched');
// adding again changes nothing; a new price updates the same item
assert.deepEqual([addToCatalog(out.doc,[hinge]).ok,addToCatalog(out.doc,[hinge]).unchanged],[true,true]);
const priced=await lib.save('hardware',{id:'gen-hinge-110',price:4,status:'approved'});
const again=addToCatalog(out.doc,[priced.record]);assert.deepEqual([again.ok,again.added,again.updated],[true,0,1]);
assert.equal(getFactoryCatalog(again.doc).items.find(i=>i.sku==='LIB-gen-hinge-110').price,4);assert.equal(getFactoryCatalog(again.doc).items.length,catalog.items.length,'the same item, not a copy');
assert.equal(again.revision,catalog.revision+1);
// the catalog's own limits are reported, not hidden
const many=[];for(let i=0;i<201;i++)many.push({library:'hardware',id:'x'+i,label:'صنف '+i,family:'hinge',attrs:{unit:'piece'},price:1});
assert.equal(addToCatalog(doc,many).ok,false);

console.log('PASS: sinks, hardware and handles can be copied into the factory catalog as pieces under the supplier code or a stable code, a price is carried only when decided, adding twice updates the same item, and the catalog\'s own approval rule stays.');
