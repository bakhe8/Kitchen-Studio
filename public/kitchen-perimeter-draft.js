// One first-visit checkpoint. Local measurements are never an issued project.
import {cleanWallPairs} from './kitchen-wall-pair.js';
import {cleanChains} from './kitchen-chain-model.js';
import {outlineWallId} from './kitchen-measured-outline.js';
const key='kitchen-studio:perimeter-visit:v1',limit=750000;
const corrupt='تعذّر قراءة مسودة الرفع المحفوظة. لم تُستبدل بياناتها.';
const conflict='توجد نسخة أخرى لمسودة الرفع. أغلق نافذة الرفع الأخرى وحدّث الصفحة قبل الحفظ.';
const unavailable='تعذّر حفظ المسودة على الجهاز. أبقِ هذه الصفحة مفتوحة.';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const string=(v,max)=>typeof v==='string'&&v.length<=max;
function nextRevision(){
 const entropy=crypto.getRandomValues(new Uint32Array(4));
 return Array.from(entropy,n=>n.toString(16).padStart(8,'0')).join('');
}
function validData(d){
 if(!plain(d)||!['walk','coords'].includes(d.mode)||!string(d.reference,160)||!string(d.height,40)||!string(d.thickness,40)||!string(d.coords,50000)||!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>32||!plain(d.surveys))return false;
 if(d.rows.some(r=>!plain(r)||!outlineWallId(r.id)||!string(r.length,40)||!string(r.angle,40)||!['','right','front','left','back','bearing'].includes(r.direction)))return false;
 const ids=new Set(d.rows.map(r=>r.id));if(ids.size!==d.rows.length||Object.keys(d.surveys).length>ids.size||d.mode==='coords'&&Object.keys(d.surveys).length)return false;
 for(const [id,s] of Object.entries(d.surveys)){
  if(!ids.has(id)||!plain(s)||!Number.isFinite(s.lengthMm)||s.lengthMm<1||s.lengthMm>18000||!Number.isFinite(s.heightMm)||s.heightMm<600||s.heightMm>6000)return false;
  if(s.pairs!=null&&!cleanWallPairs({[id]:s.pairs}))return false;
  const chain=s.chain;
  if(chain?.source!=='drawing'||chain.attestation||!cleanChains({[id]:chain})||chain.rows.some(r=>r.featureId))return false;
 }
 return true;
}
function read(store){
 const raw=store.getItem(key);if(raw===null)return null;
 if(raw.length>limit)throw Error(corrupt);
 let record;try{record=JSON.parse(raw);}catch{throw Error(corrupt);}
 if(record?.version!==1||!string(record.revision,80)||!record.revision||!validData(record.data))throw Error(corrupt);
 return record;
}
// Read-only landing hint; the editor itself reports invalid data/storage.
const tabOnly=()=>typeof window!=='undefined'&&!globalThis.navigator?.locks;
function checkpointStore(store){return tabOnly()?globalThis.sessionStorage:store||globalThis.localStorage;}
export function readPerimeterDraft(store){try{return read(checkpointStore(store));}catch{return null;}}
function remove(store,revision){
 if(!store||!revision)return false;
 try{if(read(store)?.revision!==revision)return false;store.removeItem(key);return true;}catch{return false;}
}
export async function clearPerimeterDraft(store,revision){
 if(!revision)return false;
 try{store=checkpointStore(store);}catch{return false;}
 const locks=globalThis.navigator?.locks;
 if(locks)try{return await locks.request(key,{ifAvailable:true},lock=>!!lock&&remove(store,revision));}catch{return false;}
 return remove(store,revision);
}

export function openPerimeterDraftSession(injected){
 let store,initial,rev,writeAllowed=false,closed=false,release=null,pending=null,text='',blocked=false;
 let listener=()=>{};
 const set=s=>{text=s;listener(s);};
 try{store=checkpointStore(injected);if(!store)throw Error();initial=read(store);rev=initial?.revision??null;}
 catch(e){text=e.message===corrupt?corrupt:unavailable;store=null;}
 function write(data){
  if(!store||closed||blocked)return false;
  if(!writeAllowed){pending=data;set('جارٍ التحقق من حفظ المسودة.');return false;}
  try{
   if((read(store)?.revision??null)!==rev){blocked=true;set(conflict);return false;}
   if(!validData(data))throw Error();
   const revision=nextRevision(),raw=JSON.stringify({version:1,revision,data});
   if(raw.length>limit)throw Error();store.setItem(key,raw);rev=revision;
   set(tabOnly()?'مسودة الرفع محفوظة في علامة التبويب الحالية.':'مسودة الرفع محفوظة على هذا الجهاز.');return true;
  }catch(e){if(e.message===corrupt){blocked=true;set(corrupt);}else set(unavailable);return false;}
 }
 const locks=globalThis.navigator?.locks;
 if(store&&locks){
  // Ownership is held while this initial visit is open. A second tab cannot
  // read-check-write over the writer, even if both handlers run concurrently.
  void locks.request(key,{ifAvailable:true},async lock=>{
   if(closed)return;
   if(!lock){blocked=true;pending=null;set(conflict);return;}
   if((read(store)?.revision??null)!==rev){blocked=true;pending=null;set(conflict);return;}
   writeAllowed=true;const draft=pending;pending=null;
   if(draft)write(draft);else if(initial)set('استُعيدت مسودة رفع الجدران من هذا الجهاز.');
   await new Promise(resolve=>{release=resolve;});
  }).catch(()=>{writeAllowed=false;pending=null;set(unavailable);});
 }else if(store&&(tabOnly()||typeof window==='undefined'&&injected))writeAllowed=true;
 else if(store){store=null;text=unavailable;}
 if(initial&&!text)text='استُعيدت مسودة رفع الجدران من هذا الجهاز.';
 return {data:initial?.data||null,write,get blocked(){return blocked;},get status(){return text;},listen(fn){listener=fn;},
  clear(){return writeAllowed&&remove(store,rev);},
  close(){closed=true;writeAllowed=false;pending=null;listener=()=>{};release?.();}};
}
