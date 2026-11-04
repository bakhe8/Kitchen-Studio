// The library database of this device. Records of the shipped libraries come from the program (kitchen-library-seeds.js); what the factory
// adds or notes is kept here, in IndexedDB (a record per row, so a write never rewrites the whole library), with localStorage as a fallback.
// Reads are synchronous from memory, so the screens that list a library never wait for the database.
import {libraryDefs,libraryIds} from './kitchen-library-defs.js';
import {shippedRecords} from './kitchen-library-seeds.js';
import {assistNumber,assistFold} from './kitchen-measurement-identity.js';

export const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/;
export const maxOwnRecords=2000;
const numbers=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const fail=reason=>({ok:false,reason});
const control=/[\u0000-\u001f\u007f]/;
// Nothing a spreadsheet would run as a formula (a text that starts with = + - or @), no control characters.
const safeText=(s,max)=>typeof s==='string'&&s.length<=max&&!control.test(s)&&!/^[=+@-]/.test(s);
const keyOf=(type,library,id)=>type+':'+library+'/'+id;
// Search reads Arabic-Indic and Latin digits alike: a tablet keyboard types 45 and the labels say ٤٥.
const fold=s=>assistFold(s).replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0)));
const plain=label=>String(label).replace(/\s*·\s*(?:مم|سم|كغ)\s*$/,'');
const newId=()=>'own-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// A record of the library as the screens and the import see it. `source` is builtin, generic, own or import.
export function cleanRecord(library,input,{source='own',id,updated=new Date().toISOString()}={}){
 const def=libraryDefs[library];if(!def)return fail('مكتبة غير معروفة.');
 const r=input&&typeof input==='object'?input:{};
 const label=String(r.label??'').trim();
 if(!label||!safeText(label,100))return fail('اكتب اسمًا واضحًا للسجل، حتى ١٠٠ حرف.');
 const family=String(r.family??'');
 if(!Object.hasOwn(def.families,family))return fail('اختر الفئة.');
 const attrs={},given=r.attrs&&typeof r.attrs==='object'?r.attrs:{};
 for(const f of def.fields){
  const raw=given[f.key];
  if(raw===undefined||raw===null||String(raw).trim()===''){if(f.required)return fail('«'+plain(f.label)+'» مطلوب.');continue;}
  if(f.type==='text'){const v=String(raw).trim();if(!safeText(v,f.max))return fail('راجع «'+plain(f.label)+'»؛ النص طويل أو يبدأ برمز غير مسموح.');attrs[f.key]=v;}
  else if(f.type==='pick'){const v=String(raw);if(!Object.hasOwn(f.options,v))return fail('اختر «'+plain(f.label)+'» من القائمة.');attrs[f.key]=v;}
  else{
   const v=assistNumber(raw),min=f.min??0,max=f.max??1e7;
   if(v===null||v<min||v>max||f.integer&&!Number.isInteger(v))return fail('«'+plain(f.label)+'» رقم بين '+numbers.format(min)+' و '+numbers.format(max)+'.');
   attrs[f.key]=v;
  }
 }
 const why=def.check?.(attrs);if(why)return fail(why);
 const price=cleanPrice(r.price);if(price===undefined)return fail('السعر رقم صفر أو أكبر. اتركه فارغًا إن لم يُحسم.');
 const status=r.status==null||r.status===''?'draft':r.status;if(status!=='draft'&&status!=='approved')return fail('الحالة مسودة أو معتمد.');
 const note=String(r.note??'').trim();if(!safeText(note,300)&&note)return fail('الملاحظة أطول من ٣٠٠ حرف أو تبدأ برمز غير مسموح.');
 const rid=id??r.id;if(!idPattern.test(String(rid??'')))return fail('معرّف السجل غير صالح.');
 return {ok:true,record:{library,id:String(rid),label,family,attrs,price,status,source,hidden:!!r.hidden,note,updated}};
}
// Empty means «not decided»; zero is a decided price.
function cleanPrice(v){
 if(v===undefined||v===null||String(v).trim()==='')return null;
 const n=assistNumber(v);return n===null||n<0||n>1e8?undefined:n;
}
// A record that ships with the program keeps its own data; only these four things can be set on top of it.
export function cleanNote(input,updated=new Date().toISOString()){
 const r=input&&typeof input==='object'?input:{};
 const price=cleanPrice(r.price);if(price===undefined)return fail('السعر رقم صفر أو أكبر. اتركه فارغًا إن لم يُحسم.');
 const status=r.status==null||r.status===''?'draft':r.status;if(status!=='draft'&&status!=='approved')return fail('الحالة مسودة أو معتمد.');
 const note=String(r.note??'').trim();if(note&&!safeText(note,300))return fail('الملاحظة أطول من ٣٠٠ حرف أو تبدأ برمز غير مسموح.');
 const extra=r.attrs&&typeof r.attrs==='object'?r.attrs:{};
 const supplierCode=String(extra.supplierCode??'').trim();if(supplierCode&&!safeText(supplierCode,48))return fail('راجع رمز المورد.');
 return {ok:true,note:{price,status,note,hidden:!!r.hidden,...(supplierCode?{supplierCode}:{}),updated}};
}

// ---------- where the records live ----------
const entryOf=(type,library,id,data)=>({key:keyOf(type,library,id),type,library,id,data});
export function memoryAdapter(){
 const rows=new Map;
 return {kind:'memory',async load(){return [...rows.values()];},async putMany(list){for(const e of list)rows.set(e.key,e);},async removeMany(keys){for(const k of keys)rows.delete(k);}};
}
export function localAdapter(storage=globalThis.localStorage,name='kitchen-libraries:v1'){
 if(!storage)throw new Error('no storage');
 const read=()=>{const raw=storage.getItem(name);if(!raw)return new Map;const data=JSON.parse(raw);return new Map((Array.isArray(data?.entries)?data.entries:[]).map(e=>[e.key,e]));};
 const write=map=>storage.setItem(name,JSON.stringify({v:1,entries:[...map.values()]}));
 return {kind:'localstorage',async load(){return [...read().values()];},
  async putMany(list){const map=read();for(const e of list)map.set(e.key,e);write(map);},
  async removeMany(keys){const map=read();for(const k of keys)map.delete(k);write(map);}};
}
export function idbAdapter(factory=globalThis.indexedDB,{name='kitchen-libraries',timeout=2500}={}){
 let opening=null;
 const open=()=>opening||(opening=new Promise((resolve,reject)=>{
  if(!factory){reject(new Error('IndexedDB is not available'));return;}
  const timer=setTimeout(()=>reject(new Error('IndexedDB did not open')),timeout);
  let request;try{request=factory.open(name,1);}catch(e){clearTimeout(timer);reject(e);return;}
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'key'}).createIndex('library','library');};
  // A later version of the database must never wait on a page that is still open with this one.
  request.onsuccess=()=>{clearTimeout(timer);request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  request.onerror=()=>{clearTimeout(timer);reject(request.error||new Error('IndexedDB error'));};
 }));
 const run=async(mode,work)=>{
  const db=await open();
  return new Promise((resolve,reject)=>{
   let tx,out;try{tx=db.transaction('records',mode);out=work(tx.objectStore('records'));}catch(e){reject(e);return;}
   tx.oncomplete=()=>resolve(out?.result);tx.onerror=()=>reject(tx.error||new Error('IndexedDB error'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB aborted'));
  });
 };
 return {kind:'indexeddb',load:()=>run('readonly',s=>s.getAll()).then(v=>v||[]),
  putMany:list=>run('readwrite',s=>{for(const e of list)s.put(e);}),removeMany:keys=>run('readwrite',s=>{for(const k of keys)s.delete(k);})};
}
// The best store this browser gives: IndexedDB, else localStorage, else memory (the libraries then last only until the page closes).
export async function openAdapter({indexedDB:factory=globalThis.indexedDB,storage=globalThis.localStorage}={}){
 try{const a=idbAdapter(factory);await a.load();return a;}catch{/* fall through */}
 try{const a=localAdapter(storage);await a.load();return a;}catch{/* fall through */}
 return memoryAdapter();
}

// Same content, ignoring when it was written: an import that finds nothing new says so.
const sameOwn=(a,b)=>['label','family','price','status','note','hidden'].every(k=>String(a[k]??'')===String(b[k]??''))&&JSON.stringify(a.attrs)===JSON.stringify(b.attrs);
const sameNote=(a,n)=>!!a&&['price','status','note','hidden'].every(k=>String(a[k]??'')===String(n[k]??''))&&String(a.attrs?.supplierCode??'')===String(n.supplierCode??'');

// ---------- the store ----------
export function createLibraryStore({adapter=memoryAdapter(),shipped=shippedRecords(),now=()=>new Date().toISOString()}={}){
 const shippedBy=new Map(libraryIds.map(l=>[l,new Map]));
 for(const r of shipped)shippedBy.get(r.library)?.set(r.id,r);
 let own=new Map(libraryIds.map(l=>[l,new Map])),notes=new Map(libraryIds.map(l=>[l,new Map])),store=adapter,listeners=new Set;
 const emit=()=>{for(const f of listeners)try{f();}catch{/* a listener must not break the store */}};
 const merged=(library,r)=>{
  const n=notes.get(library).get(r.id);
  return n?{...r,price:n.price,status:n.status,note:n.note,hidden:n.hidden,updated:n.updated,attrs:n.supplierCode?{...r.attrs,supplierCode:n.supplierCode}:r.attrs,shipped:true}:{...r,shipped:true};
 };
 const all=library=>[...shippedBy.get(library).values()].map(r=>merged(library,r)).concat([...own.get(library).values()].map(r=>({...r,shipped:false})));
 // Only the words of a record are searched (name, family, brand, model, codes), never its sizes: «٤٥» must not find a 545 mm depth.
 const haystack=r=>fold([r.label,r.id,libraryDefs[r.library].families[r.family],...libraryDefs[r.library].fields.filter(f=>f.type==='text').map(f=>r.attrs[f.key])].join(' '));
 // By family, in the library's own order; inside a family the factory's own records first, then the program's, then the generic examples.
 const rank=r=>r.source==='generic'?2:r.source==='builtin'?1:0;
 const compare=(a,b)=>a.family===b.family?rank(a)-rank(b)||a.label.localeCompare(b.label,'ar'):Object.keys(libraryDefs[a.library].families).indexOf(a.family)-Object.keys(libraryDefs[b.library].families).indexOf(b.family);
 const find=(library,id)=>shippedBy.get(library)?.has(id)?merged(library,shippedBy.get(library).get(id)):own.get(library)?.get(id)?{...own.get(library).get(id),shipped:false}:null;
 async function write(puts,removes=[]){
  try{if(puts.length)await store.putMany(puts);if(removes.length)await store.removeMany(removes);return {ok:true};}
  catch{return fail('تعذّر حفظ المكتبة في هذا المتصفح. لم يتغيّر شيء.');}
 }
 return {
  get adapterKind(){return store.kind;},
  async attach(next){
   const entries=await next.load();store=next;
   own=new Map(libraryIds.map(l=>[l,new Map]));notes=new Map(libraryIds.map(l=>[l,new Map]));
   for(const e of entries){
    if(!e||!libraryDefs[e.library])continue;
    if(e.type==='own'&&!libraryDefs[e.library].closed){const c=cleanRecord(e.library,e.data,{source:e.data?.source==='import'?'import':'own',id:e.id,updated:e.data?.updated});if(c.ok)own.get(e.library).set(e.id,{...c.record,hidden:!!e.data?.hidden});}
    else if(e.type==='note'&&shippedBy.get(e.library).has(e.id)){const c=cleanNote(e.data,e.data?.updated);if(c.ok)notes.get(e.library).set(e.id,c.note);}
   }
   emit();
  },
  subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  list(library,{query='',family='',source='',includeHidden=false}={}){
   if(!libraryDefs[library])return [];
   const words=fold(query).split(' ').filter(Boolean);
   return all(library).filter(r=>(includeHidden||!r.hidden)&&(!family||r.family===family)&&(!source||r.source===source)&&words.every(w=>haystack(r).includes(w))).sort(compare);
  },
  get:find,
  counts(library){
   const rows=all(library);
   return {total:rows.length,visible:rows.filter(r=>!r.hidden).length,hidden:rows.filter(r=>r.hidden).length,generic:rows.filter(r=>r.source==='generic'&&!r.hidden).length,own:own.get(library)?.size||0};
  },
  // Check one record without keeping it; the import uses this to report every bad row at once.
  validate(library,input){
   const def=libraryDefs[library];if(!def)return fail('مكتبة غير معروفة.');
   const id=input?.id,exists=id&&find(library,String(id));
   if(def.closed&&!exists)return fail('هذه المكتبة ثابتة في البرنامج؛ لا تقبل سجلات جديدة.');
   if(exists?.shipped){const c=cleanNote({...input,hidden:input.hidden??exists.hidden,attrs:{supplierCode:input.attrs?.supplierCode??input.supplierCode??exists.attrs.supplierCode}},now());return c.ok?{ok:true,kind:'note',id:String(id),note:c.note,before:exists}:c;}
   const c=cleanRecord(library,{...input,hidden:input?.hidden??exists?.hidden},{source:exists?.source??input?.source??'own',id:exists?String(id):id&&idPattern.test(String(id))?String(id):newId(),updated:now()});
   if(!c.ok)return c;
   if(!exists&&own.get(library).size>=maxOwnRecords)return fail('بلغت مكتبة '+def.label+' الحد الأقصى ('+numbers.format(maxOwnRecords)+' سجل).');
   return {ok:true,kind:'own',id:c.record.id,record:c.record,before:exists||null};
  },
  async save(library,input){
   const v=this.validate(library,input);if(!v.ok)return v;
   const out=await this.commit(library,[v]);return out.ok?{ok:true,record:find(library,v.id)}:out;
  },
  // Keep validated records together: one write, all or nothing.
  async commit(library,validated){
   const puts=validated.map(v=>v.kind==='note'?entryOf('note',library,v.id,v.note):entryOf('own',library,v.id,v.record));
   const r=await write(puts);if(!r.ok)return r;
   for(const v of validated){if(v.kind==='note')notes.get(library).set(v.id,v.note);else own.get(library).set(v.id,v.record);}
   emit();return {ok:true,count:validated.length};
  },
  async duplicate(library,id){
   const r=find(library,id),def=libraryDefs[library];if(!r)return fail('السجل غير موجود.');
   if(def.closed)return fail('هذه المكتبة ثابتة في البرنامج؛ لا تقبل نسخًا.');
   return this.save(library,{...r,id:undefined,label:(r.label+' · نسخة').slice(0,100),source:'own',status:'draft',hidden:false});
  },
  async remove(library,id){
   const r=own.get(library)?.get(id);if(!r)return fail('يُزال السجل الخاص بالمصنع فقط. السجلات التي من البرنامج تُخفى.');
   const w=await write([],[keyOf('own',library,id)]);if(!w.ok)return w;
   own.get(library).delete(id);emit();return {ok:true};
  },
  async setHidden(library,ids,hidden){
   const list=[],puts=[];
   for(const id of [].concat(ids)){
    const r=find(library,id);if(!r||r.hidden===!!hidden)continue;
    if(r.shipped){const n={price:r.price,status:r.status,note:r.note,hidden:!!hidden,updated:now(),...(r.attrs.supplierCode?{supplierCode:r.attrs.supplierCode}:{})};list.push(['note',id,n]);puts.push(entryOf('note',library,id,n));}
    else{const n={...r,hidden:!!hidden,updated:now()};delete n.shipped;list.push(['own',id,n]);puts.push(entryOf('own',library,id,n));}
   }
   if(!puts.length)return {ok:true,count:0};
   const w=await write(puts);if(!w.ok)return w;
   for(const [kind,id,n] of list)(kind==='note'?notes:own).get(library).set(id,n);
   emit();return {ok:true,count:puts.length};
  },
  // Everything the factory added or noted, in a file that carries between devices.
  exportPack(){
   return {type:'kitchen-libraries',version:1,created:now(),
    own:libraryIds.flatMap(l=>[...own.get(l).values()].map(r=>({...r}))),
    notes:libraryIds.flatMap(l=>[...notes.get(l)].map(([id,n])=>({library:l,id,...n})))};
  },
  async importPack(pack){
   if(!pack||pack.type!=='kitchen-libraries'||pack.version!==1||!Array.isArray(pack.own)||!Array.isArray(pack.notes))return fail('هذا ليس ملف مكتبات صالحًا.');
   const byLibrary=new Map(),errors=[],tally={added:0,updated:0,unchanged:0};
   const keep=(library,v)=>{
    const was=v.before,same=v.kind==='note'?sameNote(was,v.note):was&&sameOwn(was,v.record);
    if(same){tally.unchanged++;return;}
    tally[was?'updated':'added']++;(byLibrary.get(library)||byLibrary.set(library,[]).get(library)).push(v);
   };
   for(const r of pack.own){
    if(!r||!libraryDefs[r.library]||libraryDefs[r.library].closed)continue;
    const v=this.validate(r.library,{...r,source:r.source==='import'?'import':'own'});
    if(v.ok&&v.kind==='own')keep(r.library,v);else errors.push((r.label||r.id||'سجل')+' · '+(v.reason||'غير صالح'));
   }
   for(const n of pack.notes){
    if(!n||!libraryDefs[n.library]||!shippedBy.get(n.library)?.has(n.id))continue;
    const v=this.validate(n.library,n);if(v.ok)keep(n.library,v);else errors.push(n.id+' · '+v.reason);
   }
   for(const [library,list] of byLibrary){const r=await this.commit(library,list);if(!r.ok)return r;}
   return {ok:true,count:tally.added+tally.updated,...tally,errors};
  }
 };
}

export const libraries=createLibraryStore();
let loading=null;
// Open the database and read the saved records. A browser that cannot open it is not an error: the libraries then hold only the shipped records.
export function loadLibraries(options){
 return loading||(loading=openAdapter(options).then(a=>libraries.attach(a)).then(()=>libraries,()=>libraries));
}
