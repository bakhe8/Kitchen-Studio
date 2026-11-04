const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function packingLabelHTML(job,unit,event){
 const stamp=job.stamp;
 return '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>بطاقة تغليف الوحدة</title><style>body{font:18px/1.6 sans-serif;margin:18mm}article{border:2px solid;padding:15mm;max-width:500px}code{display:block;direction:ltr;overflow-wrap:anywhere}p{margin:.3em}</style><article><h2>بطاقة تغليف الوحدة</h2><p>'+esc(stamp.projectName)+' · رقم المشروع '+esc(stamp.project)+'</p><p>نسخة التصميم '+esc(stamp.revision)+' · إصدار المشروع السحابي '+esc(job.revision)+'</p><p>صدر إيصال التصنيع بتاريخ '+esc(stamp.issued.slice(0,10))+'</p><h3>'+esc(unit.name)+' · '+esc(unit.id)+'</h3><p>'+esc(unit.partCount)+' قطع مسجّلة</p><p>تاريخ التغليف '+esc(event.date)+' · '+esc(event.who)+'</p><p>'+esc(event.data.note)+'</p><code>'+esc(event.data.label)+'</code></article></html>';
}
const nextAction={issued:'plan',planned:'qc',passed:'pack',packed:'install',installed:'accept'};
const nextQuestion={plan:'ما مرجع السماحات المعتمدة لفحص هذه الوحدة؟',qc:'ما نتائج القياس الفعلي لهذه الوحدة؟',pack:'ما محضر تغليف هذه الوحدة وترقيمها؟',install:'أين رُكّبت هذه الوحدة وما مرجع المحضر؟',accept:'من استلم هذه الوحدة وما مرجع الاستلام؟'};
export function jobPrompt(state,role){
 const next=nextAction[state];
 if(!next)return null;
 const ownerOnly=next==='plan'||next==='accept';
 return {next,question:nextQuestion[next],actor:ownerOnly?'مالك المشروع':next==='qc'?'فني الجودة':next==='pack'?'مسؤول التغليف':'فني التركيب',
  editable:role==='owner'||(!ownerOnly&&role==='factory')};
}
export {mountDeliveryStudio as mountOrderTracking} from './kitchen-delivery-studio.js';
