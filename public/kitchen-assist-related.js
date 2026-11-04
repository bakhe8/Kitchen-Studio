import {fieldInputByCode} from './kitchen-field-catalog.js';
// These are optional entry points, not unresolved mandatory fields. Show a
// reason for each selection and keep only the three closest to the live task.
export function relatedInputs(doc,topic,opts={},s={}){
 const rows=[],seen=new Set(),entity=s.entityId||opts.entityId||'',ans=s.answers||[],features=doc.kitchen?.features||[],units=doc.kitchen?.units||[],held=(id)=>ans.find(a=>a.id===id)?.evidence?.value;
 const add=(code,why)=>{if(rows.length>=3||seen.has(code))return;const e=fieldInputByCode.get(code);if(!e)return;seen.add(code);rows.push({code,name:e.name,why});};
 if(topic==='equipment'){
  if(held('bearing')==='absent'||held('present')===false)return [];
  if(ans.some(a=>a.evidence?.value==='mixed'||String(a.evidence?.value||'').startsWith('ledge')))add('SITE-19','لمراجعة حدود التعلية ومواقع ارتكاز الأرجل');
  if(units.some(x=>x.kind==='dishwasher'&&x.id===entity)||held('present')===true){add('EQP-02','لتوثيق فتحة الموديل أو إرفاق دليل التركيب');add('EQP-03','إذا أردت فحص فتح الباب والصيانة أيضًا');}return rows;
 }
 if(topic==='site'){
  if(doc.room?.architecture?.cut?.kind==='notch')add('SITE-10','المسقط فيه ردّة؛ يمكن توثيق أضلاعها');
  if(doc.room?.architecture?.cut?.kind==='taper'||doc.room?.architecture?.cut?.kind==='chamfer')add('SITE-04','المسقط يتضمن ضلعًا مائلًا؛ يمكن إرفاق قياس تحقق مستقل');
  if(features.some(f=>['column','beam','shaft'].includes(f.kind)))add('SITE-09','يوجد عنصر إنشائي مرسوم في الغرفة');
  add('DOC-01','إذا أردت ربط صورة للموقع بهذه الزيارة');return rows;
 }
 if(topic==='services'){
  const f=features.find(v=>v.id===entity||entity.endsWith(':'+v.id))||doc.room?.sitePoints?.find(v=>v.id===entity||entity.endsWith(':'+v.id));
  const codes={water:'MEP-01',drain:'MEP-03',gas:'MEP-08',electric:'MEP-09',heater:'MEP-06',vent:'MEP-13','floor-drain':'MEP-04',door:'SITE-11',window:'SITE-12'};
  if(f&&codes[f.kind])add(codes[f.kind],'لإضافة خاصية أخرى للعنصر المحدد');if(f)add('DOC-02','لربط صورة مقرّبة بالعنصر المحدد');return rows;
 }
 if(topic==='customer'){
  if(entity.startsWith('pantry:')){const mode=held('packaging');if(mode==='none')return [];if(mode==='accessory')add('CAT-13','اختيرت عيّاشة، فتهم مواصفات موديلها');if(mode==='bag'||mode==='bin')add('USE-06','عند الحاجة إلى قياس الكيس أو الحافظة بعد تعبئتها');if(mode)add('USE-12','إذا أراد العميل تحديد درج أو وحدة بعينها');}
  else if(entity.startsWith('corner:')){if(held('corner-tiers')==='none')return [];if(ans.some(a=>a.evidence?.value==='pull'))add('CAT-14','للتحقق من فتحة الآلية ومسارها');if(held('corner-tiers'))add('USE-13','إذا كانت للتقسيم الداخلي تفاصيل إضافية');}
  else if(entity.startsWith('budget:')&&held('budget-rule')&&held('budget-rule')!=='open'){add('PRJ-03','لتثبيت البنود الداخلة في السعر');if(held('matching-quote')===true)add('MFG-09','لإرفاق مستند العرض الذي قورن بالميزانية');}return rows;
 }
 if(topic==='production'){
  if(entity==='top'&&held('units-level')===true){add('SITE-18','بعد تثبيت الوحدات يُوثّق القالب');add('INS-05','لمراجع القالب وفتحات الأجهزة');}
  if(entity==='install'){if(held('mep-needed')===true)add('MEP-20','طلب تجهيز أو نقل خدمة قبل التركيب');if(held('path-required')===true)add('INS-01','لإرفاق مسار الإدخال وأبعاده');}
  if(entity==='order'){if(held('design-signed')===true)add('INS-06','لمستند إصدار التصميم المعتمد');if(held('has-custom')===true)add('MFG-13','لإرفاق رسم القطعة خارج الكتالوج');}return rows;
 }
 return rows;
}
