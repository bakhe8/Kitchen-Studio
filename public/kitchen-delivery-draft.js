import {assistNumber} from './kitchen-measurement-identity.js';
const copy=v=>JSON.parse(JSON.stringify(v));
const prefix='kitchen-delivery-draft-v1:';
const snapshot=d=>({revision:d.revision,expected:d.expected,action:d.action,raw:d.raw,anchor:d.anchor,observationId:d.observationId});
export const deliveryDraftKey=({subject,project,receipt,unit,action=''})=>prefix+encodeURIComponent(JSON.stringify([subject,project,receipt,unit,action]));
export const draftSignature=d=>JSON.stringify(snapshot(d));
export function newDeliveryDraft(revision,expected,action){
 const d={revision,expected,action,raw:{},anchor:null,observationId:'',attempt:null,undo:[],redo:[],saved:''};d.saved=draftSignature(d);return d;
}
export function readDeliveryDraft(storage,key,revision,expected,action){
 const empty=newDeliveryDraft(revision,expected,action);
 try{const text=storage?.getItem(key);if(!text)return empty;const d=JSON.parse(text);
  if(d.version!==1||typeof d.action!=='string'||!Number.isInteger(d.expected)||!Number.isInteger(d.revision)||!d.raw||typeof d.raw!=='object'||Array.isArray(d.raw))return empty;
  const value={...empty,...snapshot(d),attempt:d.attempt||null};value.saved=draftSignature(value);return value;
 }catch{return empty;}
}
export function saveDeliveryDraft(storage,key,d){
 if(!storage)throw Error('الحفظ المحلي غير متاح في هذا المتصفح.');
 storage.setItem(key,JSON.stringify({version:1,...snapshot(d),attempt:d.attempt}));d.saved=draftSignature(d);
}
export function editDeliveryDraft(d,patch){
 if(d.attempt)return false;
 const before=copy(snapshot(d));Object.assign(d,patch);
 if(JSON.stringify(before)===draftSignature(d))return false;
 d.undo.push(before);if(d.undo.length>100)d.undo.shift();d.redo=[];return true;
}
export function deliveryHistory(d,forward=false){
 if(d.attempt)return false;const from=forward?d.redo:d.undo,to=forward?d.undo:d.redo;if(!from.length)return false;
 to.push(copy(snapshot(d)));Object.assign(d,from.pop());return true;
}
export function deliveryReading(check,value,tolerance){
 const n=assistNumber(value);if(n===null)return {valid:false,label:String(value??'').trim()?'رقم غير صالح':'لم تُدخل قراءة'};
 if(n<0||n>100000||check.unit==='قطعة'&&!Number.isInteger(n))return {valid:false,label:'قراءة خارج الحدود'};
 const delta=Math.round((n-check.nominal)*1e6)/1e6,ok=Number.isFinite(tolerance)&&Math.abs(delta)<=tolerance;
 return {valid:true,actual:n,delta,ok,label:(delta>0?'+':'')+delta+' '+check.unit+' · '+(ok?'ضمن السماحة':'خارج السماحة')};
}
export function deliveryBody(d,unit,plan){
 const body={action:d.action,unit:unit.id,expected:d.expected},raw=d.raw;
 const text=(key,max,label)=>{const v=String(raw[key]??'').trim();if(!v||v.length>max)throw Error('أدخل '+label+' (حتى '+max+' حرفًا).');return v;};
 if(d.action==='observe'){
  if(!d.anchor)throw Error('حدّد موضع الملاحظة على الرسم أو اختر أحد الفحوص.');
  body.observation={text:text('text',500,'وصف الملاحظة'),severity:raw.severity||'blocking',anchor:d.anchor};
 }else if(d.action==='resolve'){
  if(!d.observationId)throw Error('اختر الملاحظة المطلوب إغلاقها.');body.observationId=d.observationId;body.note=text('note',500,'نتيجة المعالجة وإعادة الفحص');
 }else if(d.action==='plan'||d.action==='qc'){
  const readings={};for(const f of unit.checks){const n=assistNumber(raw['check:'+f.key]);
   if(d.action==='plan'){
    if(n===null||n<0||n>f.nominal||f.maxTolerance!=null&&n>f.maxTolerance||f.unit==='قطعة'&&n!==0)throw Error('راجع سماحة «'+f.label+'». سماحة العدد صفر.');
   }else if(!deliveryReading(f,raw['check:'+f.key],plan?.tolerances?.[f.key]).valid)throw Error('أدخل قراءة فعلية صالحة لـ «'+f.label+'».');
   readings[f.key]=n;
  }
  body[d.action==='plan'?'tolerances':'actual']=readings;
  if(d.action==='plan')body.reference=text('reference',180,'مرجع السماحات');else body.note=text('note',500,'نتيجة الفحص');
 }else{
  body.note=text('note',500,'نتيجة العمل أو مرجع المحضر');
  if(d.action==='install')body.location=text('location',160,'الموقع والجدار');
  if(d.action==='accept')body.customer=text('customer',140,'اسم العميل المستلم');
 }
 return body;
}
