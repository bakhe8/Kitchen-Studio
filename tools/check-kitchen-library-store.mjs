import assert from 'node:assert/strict';
// The library database of the device: what ships, what the factory adds, how it is saved, and that a failed write changes nothing.
import {libraryDefs,libraryIds} from '../public/kitchen-library-defs.js';
import {shippedRecords} from '../public/kitchen-library-seeds.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from '../public/kitchen-materials.js';
import {supplierFrames} from '../public/kitchen-supplier.js';
import {cleanRecord,createLibraryStore,memoryAdapter,localAdapter,idbAdapter,openAdapter,idPattern} from '../public/kitchen-library-store.js';

class Store{
 constructor(){this.mem=new Map;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
const stamp=()=>'2026-11-03T12:00:00.000Z';
const fresh=(adapter=memoryAdapter())=>createLibraryStore({adapter,now:stamp});

// ---------- what ships with the program ----------
const shipped=shippedRecords();
for(const lib of libraryIds){
 const rows=shipped.filter(r=>r.library===lib),ids=new Set(rows.map(r=>r.id));
 assert.equal(ids.size,rows.length,lib+': every shipped id is unique');
 assert(rows.length>0,lib+' is not empty');
 for(const r of rows){
  assert(idPattern.test(r.id),lib+'/'+r.id+' has a usable id');
  assert(Object.hasOwn(libraryDefs[lib].families,r.family),lib+'/'+r.id+' sits in a known family');
  const c=cleanRecord(lib,r,{source:r.source,id:r.id});
  assert(c.ok,lib+'/'+r.id+' passes its own rules: '+c.reason);
  assert.equal(r.price,null,'nothing ships with an invented price');
 }
}
assert.equal(shipped.filter(r=>r.library==='finish').length,new Set([...Object.keys(kitchenFrontFinishes),...Object.keys(kitchenWorktopFinishes)]).size,'every finish of the drawing is in the library');
assert.equal(shipped.filter(r=>r.library==='supplier').length,supplierFrames.length,'every supplier frame is in the library');
for(const r of shipped.filter(r=>r.source==='generic')){
 assert(!r.attrs.brand&&!r.attrs.model,r.id+': a generic example names no brand or model');assert.equal(r.status,'draft');
}
assert(shipped.filter(r=>r.library==='appliance').every(r=>r.attrs.spaceWidthMm>=r.attrs.bodyWidthMm),'an appliance bay is never smaller than its body');

// ---------- listing ----------
const lib=fresh();
assert.equal(lib.list('appliance').length,shipped.filter(r=>r.library==='appliance').length);
assert.deepEqual(lib.list('nonsense'),[]);
assert(lib.list('appliance',{family:'dishwasher'}).every(r=>r.family==='dishwasher')&&lib.list('appliance',{family:'dishwasher'}).length===3);
assert.equal(lib.list('appliance',{query:'٤٥'}).length,1,'the search finds the 45 cm dishwasher');
assert.deepEqual(lib.list('appliance',{query:'45'}).map(r=>r.id),lib.list('appliance',{query:'٤٥'}).map(r=>r.id),'whether it is typed in Latin or Arabic digits');
assert(lib.list('appliance',{query:'غسالة صحون'}).length>=3,'search finds by words in any order');
assert(lib.list('sink',{query:'مزدوج'}).every(r=>r.label.includes('مزدوج')));
assert.equal(lib.list('hardware',{source:'own'}).length,0);
const families=lib.list('appliance').map(r=>r.family);
assert.deepEqual(families,[...families].sort((a,b)=>Object.keys(libraryDefs.appliance.families).indexOf(a)-Object.keys(libraryDefs.appliance.families).indexOf(b)),'rows are grouped by family in the library\'s own order');

// the factory's own records are listed before the examples of their family
await lib.save('appliance',{label:'ي ثلاجة أخيرة بالاسم',family:'fridge',attrs:{bodyWidthMm:600,bodyHeightMm:1800,bodyDepthMm:650,spaceWidthMm:640,spaceHeightMm:1820,spaceDepthMm:700}});
assert.equal(lib.list('appliance',{family:'fridge'})[0].label,'ي ثلاجة أخيرة بالاسم','an own record comes first even when its name sorts last');
await lib.remove('appliance',lib.list('appliance',{family:'fridge'})[0].id);

// ---------- adding and editing the factory's own records ----------
const fridge={label:'ثلاجة المصنع الأولى',family:'fridge',attrs:{brand:'ماركة',model:'XR-100',bodyWidthMm:'٦٠٠',bodyHeightMm:1850,bodyDepthMm:650,spaceWidthMm:640,spaceHeightMm:1870,spaceDepthMm:700},price:'٤٥٠٠',status:'approved'};
let out=await lib.save('appliance',fridge);
assert(out.ok,out.reason);assert.match(out.record.id,/^own-/);
assert.deepEqual([out.record.source,out.record.status,out.record.price,out.record.attrs.bodyWidthMm],['own','approved',4500,600],'Arabic numerals are read as numbers');
const ownId=out.record.id;
assert.equal(lib.list('appliance',{source:'own'}).length,1);assert.equal(lib.counts('appliance').own,1);
out=await lib.save('appliance',{...out.record,price:4800,attrs:{...out.record.attrs,spaceDepthMm:710}});
assert(out.ok);assert.equal(out.record.id,ownId,'saving the same id updates it');assert.equal(lib.list('appliance',{source:'own'}).length,1);
assert.equal(lib.get('appliance',ownId).attrs.spaceDepthMm,710);
const bad=async(input,pattern,why)=>{const r=await lib.save('appliance',input);assert.equal(r.ok,false,why);assert.match(r.reason,pattern,why);};
await bad({...fridge,label:''},/اكتب اسمًا/,'a record needs a name');
await bad({...fridge,label:'=HYPERLINK("x")'},/اكتب اسمًا/,'a name a spreadsheet would run as a formula is refused');
await bad({...fridge,label:"-cmd|' /C calc'!A0"},/اكتب اسمًا/,'a leading minus can start a formula too');
await bad({...fridge,note:'+1'},/الملاحظة/,'and so can a note');
await bad({...fridge,family:'toaster'},/اختر الفئة/,'the family must exist');
await bad({...fridge,attrs:{...fridge.attrs,bodyWidthMm:''}},/مطلوب/,'a required size cannot be empty');
await bad({...fridge,attrs:{...fridge.attrs,bodyWidthMm:'abc'}},/رقم بين/,'a size must be a number');
await bad({...fridge,attrs:{...fridge.attrs,bodyWidthMm:99999}},/رقم بين/,'a size has an upper limit');
await bad({...fridge,attrs:{...fridge.attrs,spaceWidthMm:500}},/حيز التركيب أصغر/,'the bay cannot be smaller than the body');
await bad({...fridge,price:-1},/السعر/,'a price cannot be negative');
await bad({...fridge,price:'كثير'},/السعر/);
await bad({...fridge,status:'final'},/الحالة/);
await bad({...fridge,note:'x'.repeat(301)},/الملاحظة/);
out=await lib.save('appliance',{...fridge,id:ownId,price:0});assert(out.ok);assert.equal(out.record.price,0,'zero is a decided price');
out=await lib.save('appliance',{...fridge,id:ownId,price:''});assert(out.ok);assert.equal(out.record.price,null,'empty is not decided');assert.equal(lib.counts('appliance').own,1,'both were edits of the same record');
assert.equal((await lib.save('sink',{label:'حوض',family:'stainless',attrs:{widthMm:800,depthMm:500,cutoutWidthMm:900}})).reason,'فتحة القص أكبر من الحوض نفسه. راجع المقاسات.');
assert.equal((await lib.save('hardware',{label:'مفصلة',family:'hinge',attrs:{}})).reason,'«وحدة الشراء» مطلوب.');
assert.equal((await lib.save('hardware',{label:'مفصلة',family:'hinge',attrs:{unit:'box'}})).ok,false,'a choice must come from the list');

// ---------- notes on the records that ship ----------
const dish=lib.list('appliance',{family:'dishwasher'})[0];
out=await lib.save('appliance',{id:dish.id,price:'٣٢٠٠',status:'approved',note:'سعر عرض المعرض',label:'محاولة تغيير الاسم',attrs:{bodyWidthMm:1}});
assert(out.ok,out.reason);
assert.deepEqual([out.record.price,out.record.status,out.record.note],[3200,'approved','سعر عرض المعرض']);
assert.equal(out.record.label,dish.label,'a shipped record keeps its own name');assert.equal(out.record.attrs.bodyWidthMm,dish.attrs.bodyWidthMm,'and its own sizes');
assert.equal(out.record.shipped,true);assert.equal(lib.counts('appliance').own,1,'a note is not a new record');
out=await lib.save('finish',{id:'oak',price:85,attrs:{supplierCode:'EGG-H1180'}});
assert(out.ok);assert.equal(out.record.attrs.supplierCode,'EGG-H1180');assert.equal(lib.get('finish','oak').attrs.supplierCode,'EGG-H1180');
assert.equal((await lib.save('finish',{label:'خامة جديدة',family:'wood'})).reason,'هذه المكتبة ثابتة في البرنامج؛ لا تقبل سجلات جديدة.');
assert.equal((await lib.duplicate('finish','oak')).ok,false,'a fixed library cannot be copied into');

// ---------- copy, hide, remove ----------
out=await lib.duplicate('sink','gen-steel-single-60');assert(out.ok,out.reason);
assert.deepEqual([out.record.source,out.record.status,out.record.shipped],['own','draft',false]);assert.match(out.record.label,/· نسخة$/);
assert.equal(out.record.attrs.widthMm,600,'the copy starts from the example\'s sizes');
const copy=out.record.id;
assert.equal((await lib.remove('sink','gen-steel-single-60')).ok,false,'a record from the program is hidden, never removed');
out=await lib.setHidden('sink','gen-steel-single-60',true);assert.deepEqual([out.ok,out.count],[true,1]);
assert(!lib.list('sink').some(r=>r.id==='gen-steel-single-60'));assert(lib.list('sink',{includeHidden:true}).some(r=>r.id==='gen-steel-single-60'&&r.hidden));
assert.equal(lib.counts('sink').hidden,1);
out=await lib.setHidden('sink','gen-steel-single-60',false);assert(lib.list('sink').some(r=>r.id==='gen-steel-single-60'));
const generic=lib.counts('hardware').generic;assert(generic>0);
out=await lib.setHidden('hardware',lib.list('hardware',{source:'generic'}).map(r=>r.id),true);assert.equal(out.count,generic);
assert.equal(lib.list('hardware').length,0,'all the examples can be hidden at once');assert.equal(lib.counts('hardware').generic,0);
assert.equal((await lib.setHidden('hardware',[],true)).count,0);
out=await lib.setHidden('appliance',ownId,true);assert(out.ok);assert.equal(lib.get('appliance',ownId).hidden,true,'a record of the factory can be hidden too');
out=await lib.save('appliance',{...lib.get('appliance',ownId),price:5000});assert.equal(lib.get('appliance',ownId).hidden,true,'editing a hidden record does not show it again');
assert.equal((await lib.remove('appliance',ownId)).ok,true);assert.equal(lib.get('appliance',ownId),null);
assert.equal((await lib.remove('appliance',ownId)).ok,false);
assert(lib.get('sink',copy),'removing another record leaves the copy');

// ---------- kept on the device ----------
const shared=memoryAdapter(),first=fresh(shared);
await first.save('appliance',fridge);await first.save('finish',{id:'walnut',price:120});await first.setHidden('sink','gen-steel-single-60',true);
const second=fresh();await second.attach(shared);
assert.equal(second.list('appliance',{source:'own'}).length,1,'a second page load finds the saved record');
assert.equal(second.get('finish','walnut').price,120);assert.equal(second.get('sink','gen-steel-single-60').hidden,true);
let heard=0;const stop=second.subscribe(()=>heard++);await second.save('appliance',{...fridge,label:'ثلاجة ثانية'});assert.equal(heard,1);stop();await second.save('appliance',{...fridge,label:'ثلاجة ثالثة'});assert.equal(heard,1,'a stopped listener hears nothing');

// a write that fails changes nothing
const flaky=memoryAdapter();let broken=false;const realPut=flaky.putMany;flaky.putMany=async list=>{if(broken)throw new Error('quota');return realPut.call(flaky,list);};
const guarded=fresh(flaky);await guarded.save('appliance',fridge);const before=guarded.list('appliance',{source:'own'}).length;
broken=true;
for(const attempt of [()=>guarded.save('appliance',{...fridge,label:'جديد'}),()=>guarded.setHidden('sink','gen-steel-double-86',true),()=>guarded.save('finish',{id:'oak',price:1})]){
 const r=await attempt();assert.equal(r.ok,false);assert.match(r.reason,/تعذّر حفظ المكتبة/);
}
assert.equal(guarded.list('appliance',{source:'own'}).length,before,'a failed save adds nothing');assert.equal(guarded.get('sink','gen-steel-double-86').hidden,false);assert.equal(guarded.get('finish','oak').price,null);
// rows that cannot be read are skipped, never trusted
const rows=[{key:'own:appliance/x',type:'own',library:'appliance',id:'x',data:{label:'',family:'fridge'}},{key:'own:finish/y',type:'own',library:'finish',id:'y',data:{label:'خامة',family:'wood'}},
 {key:'note:sink/none',type:'note',library:'sink',id:'none',data:{price:1}},{key:'own:nowhere/z',type:'own',library:'nowhere',id:'z',data:{}},null],dirty={kind:'memory',async load(){return rows;},async putMany(){},async removeMany(){}};
const tolerant=fresh();await tolerant.attach(dirty);assert.equal(tolerant.counts('appliance').own,0);assert.equal(tolerant.counts('finish').own,0);assert.equal(tolerant.counts('sink').total,shipped.filter(r=>r.library==='sink').length);

// ---------- the file that moves libraries between devices ----------
const a=fresh();await a.save('appliance',fridge);await a.save('hardware',{label:'مفصلة خاصة',family:'hinge',attrs:{unit:'piece',spec:'١١٠°'},price:3});await a.save('finish',{id:'oak',price:90,status:'approved',attrs:{supplierCode:'EGG-H1180'}});
const pack=JSON.parse(JSON.stringify(a.exportPack()));
assert.deepEqual([pack.type,pack.version,pack.own.length,pack.notes.length],['kitchen-libraries',1,2,1]);
const b=fresh();out=await b.importPack(pack);assert.deepEqual([out.ok,out.count,out.errors.length],[true,3,0]);assert.deepEqual([out.added,out.updated,out.unchanged],[2,1,0],'two records of the factory are new, one note on a shipped record is an update');
assert.equal(b.get('finish','oak').attrs.supplierCode,'EGG-H1180','the supplier code noted on a finish travels in the file');
assert.deepEqual(b.list('appliance',{source:'own'}).map(r=>r.label),['ثلاجة المصنع الأولى']);assert.equal(b.get('finish','oak').price,90);
out=await b.importPack(pack);assert.equal(b.list('appliance',{source:'own'}).length,1,'importing the same file twice adds nothing new');assert.deepEqual([out.count,out.added,out.updated,out.unchanged],[0,0,0,3],'and says so');
const edited=JSON.parse(JSON.stringify(pack));edited.own[0].price=4999;out=await b.importPack(edited);assert.deepEqual([out.added,out.updated,out.unchanged],[0,1,2],'a changed price is the only update');assert.equal(b.get('appliance',edited.own[0].id).price,4999);
assert.equal((await b.importPack({type:'other',version:1})).ok,false);assert.equal((await b.importPack(null)).ok,false);assert.equal((await b.importPack({...pack,version:2})).ok,false);
out=await fresh().importPack({...pack,own:[...pack.own,{...pack.own[0],id:'own-bad',label:'',attrs:{}},{library:'finish',id:'own-new',label:'x',family:'wood'}]});
assert.equal(out.ok,true);assert.equal(out.errors.length,1,'a bad record is reported, the others still come in');assert.match(out.errors[0],/اكتب اسمًا/);

// ---------- where it is kept ----------
const disk=new Store,viaLocal=fresh(localAdapter(disk));
await viaLocal.save('appliance',fridge);const reload=fresh();await reload.attach(localAdapter(disk));assert.equal(reload.list('appliance',{source:'own'}).length,1,'localStorage keeps it as well');
disk.setItem('kitchen-libraries:v1','{not json');await assert.rejects(()=>localAdapter(disk).load(),'a damaged copy is noticed');
assert.equal((await openAdapter({indexedDB:undefined,storage:disk})).kind,'memory','a damaged copy and no database leave only memory');
assert.equal((await openAdapter({indexedDB:undefined,storage:new Store})).kind,'localstorage');
assert.equal((await openAdapter({indexedDB:undefined,storage:undefined})).kind,'memory');
assert.equal((await openAdapter({indexedDB:{open(){throw new Error('denied');}},storage:new Store})).kind,'localstorage','a browser that refuses IndexedDB falls back');

// a minimal IndexedDB: enough to prove the adapter creates the store, writes per record, reads them back and deletes
function fakeIndexedDB(){
 const dbs=new Map;
 return {open(name){
  const request={};
  queueMicrotask(()=>{
   let db=dbs.get(name);const created=!db;
   if(created){
    const stores=new Map;
    db={objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n){const s={rows:new Map,indexes:[],createIndex(i){s.indexes.push(i);}};stores.set(n,s);return s;},
     transaction(n){const s=stores.get(n),tx={};
      tx.objectStore=()=>({getAll(){return {result:[...s.rows.values()]};},put(e){s.rows.set(e.key,e);},delete(k){s.rows.delete(k);}});
      queueMicrotask(()=>queueMicrotask(()=>tx.oncomplete?.()));return tx;},stores};
    dbs.set(name,db);
   }
   request.result=db;if(created)request.onupgradeneeded?.();request.onsuccess?.();
  });
  return request;
 }};
}
const factory=fakeIndexedDB(),viaIdb=fresh(idbAdapter(factory));
assert.equal(viaIdb.adapterKind,'indexeddb');
await viaIdb.save('appliance',fridge);await viaIdb.save('appliance',{...fridge,label:'ثانية'});await viaIdb.setHidden('finish','oak',true);
const idbReload=fresh();await idbReload.attach(idbAdapter(factory));
assert.equal(idbReload.list('appliance',{source:'own'}).length,2);assert.equal(idbReload.get('finish','oak').hidden,true);
assert.deepEqual(factory.dbs?.size??1,1);
const target=idbReload.list('appliance',{source:'own'})[0].id;await idbReload.remove('appliance',target);
const idbAgain=fresh();await idbAgain.attach(idbAdapter(factory));assert.equal(idbAgain.list('appliance',{source:'own'}).length,1,'a removed record stays removed');
assert.equal((await openAdapter({indexedDB:fakeIndexedDB(),storage:new Store})).kind,'indexeddb','a browser with IndexedDB gets it');
await assert.rejects(()=>idbAdapter(undefined).load(),/not available/);
// a database that never answers does not hold the page
await assert.rejects(()=>idbAdapter({open(){return {};}},{timeout:30}).load(),/did not open/);

console.log('PASS: the library database ships valid generic examples without prices or brands, keeps the factory\'s own records and notes on shipped ones, hides instead of deleting what the program ships, survives a failed write and damaged rows, moves between devices as a file, and falls back from IndexedDB to localStorage to memory.');
