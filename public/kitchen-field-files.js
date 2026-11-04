// Technician documents stay with the browser. The portable project explicitly
// contains their bytes, so a receiving device never depends on a sender's IDB.
export const fieldFileLimit=12*1024*1024;
export const fileSizeLimit=type=>['image/jpeg','image/png','image/webp'].includes(type)?24*1024*1024:fieldFileLimit;
export const fieldFilesTotalLimit=48*1024*1024;
export const projectArchiveSizeLimit=128*1024*1024;
const fail=t=>{throw Error(t);};
const pool=new WeakMap();
const niceMime=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9!#$&^_.+/-]{0,126}$/i.test(v)?v.toLowerCase():'application/octet-stream';
const newId=()=>{const c=globalThis.crypto;if(!c?.getRandomValues)fail('لم يتوفر معرّف آمن للمرفق في هذا المتصفح.');return 'doc-'+Array.from(c.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');};
function openDB(){
 if(!globalThis.indexedDB)return Promise.reject(Error('تخزين المرفقات غير متاح في هذا المتصفح. يمكنك تسجيل القراءة بدون مرفق.'));
 if(pool.has(indexedDB))return pool.get(indexedDB);
 const promise=new Promise((resolve,reject)=>{const op=indexedDB.open('kitchen-studio-field-files',1);op.onupgradeneeded=()=>{if(!op.result.objectStoreNames.contains('documents'))op.result.createObjectStore('documents');};op.onerror=()=>reject(Error('تعذّر فتح مخزن المرفقات على الجهاز.'));op.onblocked=()=>reject(Error('أغلق النوافذ القديمة للاستوديو ثم أعد المحاولة.'));op.onsuccess=()=>{const db=op.result;db.onversionchange=()=>{db.close();pool.delete(indexedDB);};resolve(db);};});
 pool.set(indexedDB,promise);promise.catch(()=>{pool.delete(indexedDB);});return promise;
}
async function get(id){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction('documents','readonly'),req=t.objectStore('documents').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(Error('تعذّر قراءة المرفق من الجهاز.'));});}
async function addBatch(pairs){if(!pairs.length)return;const db=await openDB();await new Promise((resolve,reject)=>{const t=db.transaction('documents','readwrite'),os=t.objectStore('documents');t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(Error('تعذّر حفظ المرفق. تحقق من المساحة المتاحة في المتصفح.'));for(const [id,blob] of pairs)os.add(blob,id);});}
async function put(file){
 if(!(file instanceof Blob)||!Number.isSafeInteger(file.size)||file.size<1)fail('الملف فارغ أو غير قابل للقراءة.');
 if(file.size>fileSizeLimit(file.type))fail('الحد الأقصى لصورة الجدار ٢٤ م.ب. وللمستند ١٢ م.ب.');
 const id=newId(),name=String(file.name||'مرفق').trim().slice(0,180),type=niceMime(file.type),blob=file.slice(0,file.size,type);
 await addBatch([[id,blob]]);return {id,name,type,size:file.size};
}
async function download(ref){
 const blob=await get(ref.id);if(!blob)fail('هذا المرفق غير موجود على الجهاز. افتح نسخة المشروع التي تضم المرفقات.');
 // Use an octet-stream download; never inject uploaded HTML/SVG as markup.
 const link=document.createElement('a'),url=URL.createObjectURL(blob.slice(0,blob.size,'application/octet-stream'));link.href=url;link.download=String(ref.name||'مرفق').replace(/[\x00-\x1f/\\]/g,'-');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export const fieldAttachmentStore=Object.freeze({put,get,download});
function references(room){const m=new Map();let total=0;for(const r of room?.fieldRegister?.records||[])for(const a of r.attachments||[]){const old=m.get(a.id);if(old){if(old.size!==a.size||old.type!==a.type)fail('ورد مرجع المرفق بمواصفات متعارضة.');continue;}if(!/^[\w-]{1,100}$/.test(a.id)||!Number.isSafeInteger(a.size)||a.size<1||a.size>fileSizeLimit(a.type))fail('مواصفات المرفق غير صالحة.');m.set(a.id,a);total+=a.size;if(total>fieldFilesTotalLimit)fail('إجمالي المرفقات يتجاوز 48 م.ب.');}return m;}
async function encode(blob){const bytes=new Uint8Array(await blob.arrayBuffer()),parts=[];for(let i=0;i<bytes.length;i+=0x6000)parts.push(btoa(String.fromCharCode(...bytes.subarray(i,i+0x6000))));return parts.join('');}
function decode(data,meta){if(typeof data!=='string'||data.length!==4*Math.ceil(meta.size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))fail('محتوى المرفق غير صالح: '+meta.name);let bin;try{bin=atob(data);}catch{fail('تعذّر فك المرفق: '+meta.name);}if(bin.length!==meta.size)fail('حجم المرفق لا يطابق السجل: '+meta.name);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:meta.type});}
export async function packFieldFiles(room,store=fieldAttachmentStore){const refs=references(room),out=[];for(const [id,a] of refs){const blob=await store.get(id);if(!blob||blob.size!==a.size)fail('تعذّر تضمين «'+a.name+'». استعد المرفق أو أزل مرجعه قبل التصدير.');out.push({id,data:await encode(blob)});}return out;}
export function unpackFieldFiles(room,raw){const refs=references(room);if(!Array.isArray(raw)||raw.length!==refs.size)fail('نسخة المشروع لا تحتوي جميع مرفقات سجل الفني.');const result=new Map();for(const x of raw){const a=refs.get(x?.id);if(!a||result.has(x.id))fail('المرفقات المضمَّنة لا تطابق السجل.');result.set(x.id,decode(x.data,a));}return result;}
export async function installFieldFiles(files){const missing=[];for(const [id,blob] of files){const old=await get(id);if(!old){missing.push([id,blob]);continue;}if(old.size!==blob.size||await encode(old)!==await encode(blob))fail('تعارض محتوى مرفق مع نسخة محفوظة. لم يُفتح المشروع.');}await addBatch(missing);}
