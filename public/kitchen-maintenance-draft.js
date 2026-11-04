export {newDeliveryDraft as newMaintenanceDraft,readDeliveryDraft as readMaintenanceDraft,saveDeliveryDraft as saveMaintenanceDraft,editDeliveryDraft as editMaintenanceDraft,deliveryHistory as maintenanceHistory,draftSignature} from './kitchen-delivery-draft.js';
export const maintenanceDraftKey=({subject,project,receipt,unit,ticket='',action=''})=>'kitchen-maintenance-draft-v1:'+encodeURIComponent(JSON.stringify([subject,project,receipt,unit,ticket,action]));
export function maintenanceBody(d,unit,ticketId){
 const raw=d.raw,body={action:d.action,unit:unit.id,expected:d.expected};
 const text=(key,max,label,optional=false)=>{const value=String(raw[key]??'').trim();if((!optional&&!value)||value.length>max)throw Error('أدخل '+label+' (حتى '+max+' حرفًا).');return value;};
 if(d.action==='warranty-record'){
  body.terms={reference:text('reference',180,'مرجع الضمان'),provider:text('provider',140,'الجهة الضامنة'),startsOn:text('startsOn',10,'تاريخ بداية الضمان'),endsOn:text('endsOn',10,'تاريخ نهاية الضمان'),coverage:text('coverage',500,'نطاق الضمان'),exclusions:text('exclusions',500,'الاستثناءات',true)};
  for(const date of [body.terms.startsOn,body.terms.endsOn]){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('أدخل تاريخًا صحيحًا بصيغة سنة-شهر-يوم.');}
  if(body.terms.endsOn<body.terms.startsOn)throw Error('نهاية الضمان تسبق بدايته.');
 }else if(d.action==='service-open'){
  if(!d.anchor)throw Error('حدّد موضع البلاغ على جسم الوحدة أو أحد فحوصها.');
  if(!['normal','urgent'].includes(raw.priority||'normal'))throw Error('اختر أولوية البلاغ.');
  body.ticket={title:text('title',120,'عنوان البلاغ'),description:text('description',500,'وصف المشكلة'),priority:raw.priority||'normal',anchor:d.anchor};
 }else{
  if(!ticketId)throw Error('اختر البلاغ المقصود أولًا.');body.ticketId=ticketId;
  if(d.action==='service-review'){
   if(!['covered','outside','goodwill'].includes(raw.coverage))throw Error('اختر قرار التغطية بعد مراجعة الشروط.');
   Object.assign(body,{diagnosis:text('diagnosis',500,'التشخيص وسبب قرار التغطية'),coverage:raw.coverage,reference:text('reference',180,'مرجع قرار الخدمة')});
  }else if(d.action==='service-repair')Object.assign(body,{work:text('work',500,'العمل المنفذ'),verification:text('verification',500,'نتيجة إعادة الفحص')});
  else if(d.action==='service-close')Object.assign(body,{customer:text('customer',140,'اسم العميل المعتمد'),note:text('note',500,'مرجع محضر موافقة العميل')});
  else if(d.action==='service-reopen')body.reason=text('reason',500,'سبب إعادة فتح البلاغ');
  else throw Error('اختر إجراء خدمة متاحًا.');
 }
 return body;
}
