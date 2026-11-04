// Optional defaults for NEW readings in this browser tab; never a source of
// evidence and never used as a filter on the project's existing readings.
const root='kitchen:field-visit:v1:',rooms=new WeakMap(),kitchens=new WeakMap(),cache=new Map();let last=null;
const blank=()=>({responsible:'',date:'',revision:''});
const clean=v=>({responsible:String(v?.responsible??'').trim().slice(0,180),date:String(v?.date??'').trim(),revision:String(v?.revision??'').trim().slice(0,180)});
const storage=()=>{try{return globalThis.sessionStorage||null;}catch{return null;}};
const read=k=>{try{return storage()?.getItem(root+k)??null;}catch{return null;}};
const write=(k,v)=>{try{const s=storage();if(!s)return false;if(v===null)s.removeItem(root+k);else s.setItem(root+k,v);return true;}catch{return false;}};
function stamp(d){const r=d.room;return JSON.stringify([d.projectId||r.projectId||'',r.name||'',r.width,r.length,r.height,r.architecture?.cut?.kind||'',r.architecture?.cut?.corner||'',r.architecture?.outline?.vertices??null]);}
const newToken=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
function getScope(d){
 if(!d?.room||typeof d.room!=='object')return null;
 const key=stamp(d),route='scope:'+key;let t=rooms.get(d.room)||(d.kitchen&&kitchens.get(d.kitchen));
 if(!t){const matchedFileId=last?.projectId&&last.projectId===(d.projectId||d.room.projectId);
   t=matchedFileId?last.t:!last?read(route):null;
   // Two distinct imports in one tab may have the SAME name, drawing and size.
   // Do not assign another kitchen the previous technician's details.
   if(!t)t=newToken();
 }
 if(d.kitchen&&typeof d.kitchen==='object')kitchens.set(d.kitchen,t);rooms.set(d.room,t);
 if(last?.t!==t||last?.key!==key){const old=read(route);if(old&&old!==t||cache.has(t)||read('meta:'+t))write(route,t);last={key,t,projectId:d.projectId||d.room.projectId||''};}
 return {t,route};
}
export function readVisitContext(doc){const s=getScope(doc);if(!s)return blank();const local=cache.get(s.t);if(local)return {...local};try{const raw=read('meta:'+s.t);return raw?clean(JSON.parse(raw)):blank();}catch{return blank();}}
export function saveVisitContext(doc,meta={}){const s=getScope(doc);if(!s)return {ok:false,reason:'تعذّر تحديد المشروع لهذه الزيارة.'};const v=clean(meta);if(v.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||Number.isNaN(Date.parse(v.date))||new Date(v.date).toISOString().slice(0,10)!==v.date))return {ok:false,reason:'أدخل تاريخ زيارة صالحًا أو اتركه فارغًا.'};
 if(!v.responsible&&!v.date&&!v.revision)return clearVisitContext(doc);
 if(!write('meta:'+s.t,JSON.stringify(v))||!write(s.route,s.t))return {ok:false,reason:'لم تُحفظ بيانات الزيارة؛ تخزين الجلسة غير متاح في هذا التبويب.'};
 cache.set(s.t,v);return {ok:true,context:{...v}};
}
export function clearVisitContext(doc){const s=getScope(doc);if(!s)return {ok:false,reason:'تعذّر تحديد المشروع.'};if(read('meta:'+s.t)&&!write('meta:'+s.t,null))return {ok:false,reason:'لم يتسنّ مسح بيانات الزيارة من التبويب.'};cache.delete(s.t);return {ok:true,context:blank()};}
