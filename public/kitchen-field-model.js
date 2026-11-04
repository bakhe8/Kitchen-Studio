import {ownKey,inheritedName} from './kitchen-safe-keys.js';
// Values recorded in the field describe evidence. They are not implicit edits
// to the scene: e.g. platform depth and cupboard depth have separate datums.
import {fileSizeLimit} from './kitchen-field-files.js';
import {validWallPhotoLinks} from './kitchen-wall-photo-sources.js';
import {fieldInputByCode} from './kitchen-field-catalog.js';

const freeze=Object.freeze, plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
export const fieldChoices=freeze({
 valueType:freeze({text:'نص',number:'رقم',boolean:'نعم / لا',date:'تاريخ',choice:'خيار',point:'نقطة',line:'خط / مسار',polygon:'مضلع',file:'ملف / صورة'}),
 verification:freeze({preliminary:'مبدئي',measured:'مقاس ميدانيًا',confirmed:'مؤكد من صاحبه',documented:'موثّق بدليل',estimated:'تقديري',unknown:'غير معروف',conflict:'متعارض',na:'لا ينطبق'}),
 flexibility:freeze({unspecified:'لم يُحدد',fixed:'ثابت',preferred:'تفضيل',delegated:'مفوّض'}),
 execution:freeze({unspecified:'لم يُحدد',existing:'قائم',proposed:'مقترح',required:'مطلوب',executed:'منفّذ',approved:'معتمد',excluded:'مستبعد'})
});
const defaults={valueType:'text',verification:'preliminary',flexibility:'unspecified',execution:'unspecified'};
const idOK=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x)&&!inheritedName(x);
const limits={itemId:160,location:500,property:300,revision:180,unit:80,source:1800,responsible:180,date:10,notes:6000};
const TOTAL_MAX=48*1024*1024,MAX_READINGS=5000;
const statusErr=()=>{throw new Error('اختيار غير معروف في حالة القراءة أو نوع القيمة.');};
const fail=t=>{throw new Error(t);};
const dmy=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const canonicalNumber=v=>{if(typeof v==='number')return v;if(typeof v!=='string')return NaN;
 const s=v.trim().replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace(/\u066b/g,'.').replace(/\u2212/g,'-');
 // A separator may only delimit runs of exactly three digits. Do not turn
 // e.g. "1,2" into 12 when a field worker intended a decimal comma.
 const digits='(?:(?:[0-9]{1,3}(?:[,٬][0-9]{3})+)|[0-9]+)';
 if(!new RegExp('^[+-]?(?:'+digits+'(?:[.][0-9]*)?|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$').test(s))return NaN;
 return Number(s.replace(/[,٬]/g,''));
};
const newId=()=>{const uuid=globalThis.crypto?.randomUUID?.();return uuid?'fr-'+uuid:'fr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);};
function fieldText(v,max){if(v==null)return '';if(typeof v!=='string')fail('النص في إحدى خصائص السجل غير صالح.');const s=v.trim();if(s.length>max||s.includes('\u0000'))fail('أحد النصوص أطول من الحد المتاح أو يحتوي محرفًا غير صالح.');return s;}
function attachments(list){
 if(list==null)return [];if(!Array.isArray(list)||list.length>32)fail('يمكن ربط ٣٢ مرفقًا كحد أقصى بالقراءة الواحدة.');const seen=new Set();
 return list.map(a=>{if(!plain(a)||!idOK(a.id)||seen.has(a.id))fail('مرجع مرفق غير صالح أو مكرر.');seen.add(a.id);
  const name=fieldText(a.name,255),type=fieldText(a.type,180).toLowerCase().split(';')[0].trim()||'application/octet-stream';
  if(!name||!Number.isSafeInteger(a.size)||a.size<0||a.size>fileSizeLimit(type)||!/^[-+.\w]+\/[-+.\w]+$/.test(type))fail('راجع اسم الملف ونوعه وحجمه. حد صورة الجدار ٢٤ م.ب. والمستند ١٢ م.ب.');
  return {id:a.id,name,type,size:a.size};
 });
}
function scrub(raw){
 if(!plain(raw)||!idOK(raw.id))fail('معرّف القراءة غير صالح.');
 const inputCode=raw.inputCode;if(!fieldInputByCode.has(inputCode))fail('اختر بندًا من قاموس المدخلات.');
 const r={id:raw.id,inputCode};if(raw.shopCritical!==undefined){if(typeof raw.shopCritical!=='boolean')fail('حالة الاعتماد الفني غير صالحة.');if(raw.shopCritical)r.shopCritical=true;}for(const [k,max] of Object.entries(limits))r[k]=fieldText(raw[k],max);
 // Blank references are deliberately omitted so legacy records round-trip unchanged.
 const ref=fieldText(raw.readingRef,160);if(ref)r.readingRef=ref;
 // Optional provenance for guided answers. A resolution acknowledges only the
 // exact set of superseded readings present at the moment of review.
 if(raw.assist!=null){
  if(!plain(raw.assist)||typeof raw.assist.key!=='string'||!/^g-[0-9a-f]{16}$/.test(raw.assist.key))fail('مرجع الإجابة الموجّهة غير صالح.');
  r.assist={key:raw.assist.key};if(raw.assist.baseline!=null){if(!/^[0-9a-f]{16}$/.test(raw.assist.baseline))fail('مرجع مراجعة التعارض غير صالح.');r.assist.baseline=raw.assist.baseline;}
  if(raw.assist.support!=null){if(!Array.isArray(raw.assist.support)||raw.assist.support.length!==2||!raw.assist.support.every(v=>plain(v)&&idOK(v.id)&&/^[0-9a-f]{16}$/.test(v.sig)))fail('مراجع اعتماد المسقط غير صالحة.');r.assist.support=raw.assist.support.map(v=>({id:v.id,sig:v.sig}));}

 }
 if(!r.itemId||!r.property)fail('أدخل معرّف العنصر واسم الخاصية.');
 if(r.date&&!dmy(r.date))fail('تاريخ تسجيل القراءة غير صالح.');
 for(const [k,init] of Object.entries(defaults)){r[k]=raw[k]??init;if(!ownKey(fieldChoices[k],r[k]))statusErr();}
 r.attachments=attachments(raw.attachments);const v=raw.value,isEmpty=v==null||(typeof v==='string'&&!v.trim());
 if(isEmpty){
   if(!['unknown','na'].includes(r.verification)&&!(r.valueType==='file'&&(r.attachments.length||r.source)))fail('أدخل قيمة، أو اختر «غير معروف» أو «لا ينطبق».');
   r.value=null;
 }else if(r.valueType==='number'){const n=canonicalNumber(v);if(!Number.isFinite(n))fail('أدخل رقمًا صالحًا.');r.value=n;
 }else if(r.valueType==='boolean'){if(![true,false,'true','false'].includes(v))fail('اختر نعم أو لا.');r.value=v===true||v==='true';
 }else{r.value=fieldText(v,12000);if(r.valueType==='date'&&!dmy(r.value))fail('قيمة التاريخ غير صالحة.');}
 return r;
}
function checked(register){
 if(register==null)return {version:1,records:[]};
 if(!plain(register)||register.version!==1||!Array.isArray(register.records))fail('نسخة سجل الفني غير مدعومة أو غير صالحة.');
 if(register.records.length>MAX_READINGS)fail('تجاوز السجل سعة ٥٠٠٠ قراءة للمشروع.');
 const ids=new Set(),readingRefs=new Set(),assets=new Map();let bytes=0;
 const records=register.records.map(raw=>{const r=scrub(raw);if(ids.has(r.id))fail('يوجد معرّف قراءة مكرر في سجل الفني.');ids.add(r.id);
  if(r.readingRef){const key=JSON.stringify([r.revision.normalize('NFC'),r.readingRef.normalize('NFC')]);if(readingRefs.has(key))fail('مرجع القراءة مكرر في هذه المراجعة. غيّر المرجع أو عُد إلى القراءة المسجّلة لتعديلها.');readingRefs.add(key);}
  for(const a of r.attachments){const prev=assets.get(a.id);if(prev){if(prev.size!==a.size||prev.type!==a.type)fail('مرجع المرفق نفسه يحمل حجمًا أو نوعًا مختلفًا.');continue;}
    assets.set(a.id,a);bytes+=a.size;if(bytes>TOTAL_MAX)fail('إجمالي مرفقات المشروع يتجاوز ٤٨ م.ب.');
  }return r;});
 return {version:1,records};
}
export function cleanFieldRegister(raw){try{return checked(raw);}catch{return null;}}
export function readFieldRegister(room){return checked(room?.fieldRegister);}
export function upsertFieldRecord(room,draft){
 try{
  if(!plain(room)||!plain(draft))fail('بيانات القراءة غير صالحة.');const old=readFieldRegister(room),list=old.records;
  const r=scrub({...draft,id:draft.id||newId()}),i=list.findIndex(v=>v.id===r.id);
  const next=checked({version:1,records:i<0?[...list,r]:list.map((v,j)=>i===j?r:v)});
  const updated={...room,fieldRegister:next};if(!validWallPhotoLinks(updated))fail('تستخدم خلفية الجدار هذه الصورة. أخفِ الخلفية أو اختر صورة أخرى قبل إزالة الأصل.');
  return {ok:true,room:updated,record:r};
 }catch(e){return {ok:false,reason:e.message};}
}
export function removeFieldRecord(room,id){
 try{if(!plain(room))fail('سجل المشروع غير صالح.');const old=readFieldRegister(room),record=old.records.find(r=>r.id===id);if(!record)fail('لم تعد هذه القراءة موجودة.');
  const updated={...room,fieldRegister:{version:1,records:old.records.filter(r=>r.id!==id)}};if(!validWallPhotoLinks(updated))fail('تستخدم خلفية الجدار هذه الصورة. أخفِ الخلفية أو اختر صورة أخرى قبل إزالة الأصل.');
  return {ok:true,room:updated,record};
 }catch(e){return {ok:false,reason:e.message};}
}
export function fieldRegisterCSV(room,projectName='',tagRows=null){
 const rows=[['المشروع','النسخة / المراجعة','مرجع القراءة','رمز المدخل','المجموعة','المدخل','معرّف العنصر','المرجع المكاني أو الوحدة الأم','الخاصية','نوع القيمة','القيمة','وحدة القياس','حالة التحقق','مرونة القرار','الحالة التنفيذية','المصدر','المسؤول','التاريخ','الدقة أو الملاحظة','المرفقات','معرّف القراءة']];
 for(const r of readFieldRegister(room).records){const e=fieldInputByCode.get(r.inputCode);rows.push([projectName||room?.name||'',r.revision,r.readingRef,e.code,e.group,e.name,r.itemId,r.location,r.property,fieldChoices.valueType[r.valueType],typeof r.value==='boolean'?(r.value?'نعم':'لا'):r.value,r.unit,fieldChoices.verification[r.verification],fieldChoices.flexibility[r.flexibility],fieldChoices.execution[r.execution],r.source,r.responsible,r.date,r.notes,r.attachments.map(a=>a.name).join('؛ '),r.id]);}
 const quote=x=>{let s=String(x??'');if(typeof x==='string'&&(/^[\s\uFEFF]*[=+@\-]/.test(s)||/^[\t\r\n]/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const output=tagRows?tagRows(rows):rows;return '\uFEFF'+output.map(row=>row.map(quote).join(',')).join('\r\n');
}
