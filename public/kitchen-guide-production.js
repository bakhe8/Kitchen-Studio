// Only guide an existing design. All signatures, costs and release blocks come
// from the same checked project revision that the workshop would actually issue.
import {calculateKitchenDefaults} from './kitchen-defaults-calculations.js';
import {factorySpecialTargets} from './kitchen-workshop-factory-special.js';
import {budgetHold} from './kitchen-layout-brief.js';
import {configuredCorners} from './kitchen-project-decisions.js';
import {getFactoryCatalog,wallRates} from './kitchen-workshop-factory.js';
import {releaseConcernGroups} from './kitchen-workshop-state.js';
import {catalogRecordStates} from './kitchen-catalog-records.js';

const terms={labor:'أجور التصنيع',installation:'التركيب',delivery:'النقل',marginPct:'نسبة إضافة البيع',taxPct:'نسبة الضريبة'};
// Exact validator origin, responsible party, destination, and a single action.
const checks={
 row:['engineer','row','أي وحدة في الصف تحتاج مطابقة أو إعادة تعبئة؟'],
 collision:['engineer','whole','ما التعديل الذي يحل التعارض الظاهر في الرسم؟'],
 surface:['engineer','surface','هل يطابق قالب السطح آخر رسم بعد تثبيت الدواليب؟'],
 tap:['engineer','tap','هل يفتح الشباك مع الخلاط المختار؟'],
 decisions:['customer','decisions','أي قرار من خيارات المشروع ما زال ينتظر العميل؟'],
 intake:['rep','intake','ما المعلومة الناقصة لربط جهاز العميل بموقعه؟'],
 surfaces3d:['engineer','surfaces3d','ما القياس المطلوب للتحقق من منسوب الارتكاز أو السقف؟'],
 corner:['engineer','corner','ما التفصيل المطلوب لتأكيد حركة الركن؟'],
 logistics:['engineer','logistics','ما شرط تجهيز الموقع أو التوريد الذي يحتاج إلى توثيق؟'],
 measure:['engineer','measure','أي قراءة تحتاج مراجعة لتأكيد خلوص التركيب؟'],
 routes:['engineer','routes','كيف سيعبر مسار التمديد الوحدات المحددة؟'],
 profile:['engineer','profile','ما مرجع اعتماد بروز الجدار عند هذا الارتفاع؟'],
 uses:['rep','uses','ما متطلب استخدام الوحدة الذي ينتظر المطابقة؟'],
 appliances:['engineer','appliances','هل يطابق الحيز موديل الجهاز ومقاسات تركيبه؟'],
 zones:['engineer','zones','ما التحقق الباقي لمناطق الخدمات أو التثبيت؟'],
 pair:['rep','survey','أين يقع طرف الصف بحسب قياسي الظهر والوجه؟'],
 wallOptions:['engineer','wallOptions','ما الخلوص المطلوب لتجهيزات هذا الجدار؟'],
 survey:['rep','survey','أي قياس في رفع الجدار يحتاج التصحيح أو تأكيد الفني؟'],
 field:['rep','field','أي قراءة ميدانية تحتاج حسمًا قبل التصنيع؟']
};

export function guidedProduction(doc,ctx={}){
 const state=ctx.approval,q=ctx.quote||state?.quote,w=doc.room.workshop||{};
 if(!state?.valid.structure||state.designReview||!q||q.partial||(!doc.kitchen.units.length&&!configuredCorners(w)&&!q.pieces.length))return [];
 const items=[],cat=getFactoryCatalog(doc),known=new Set(q.fitoutPending||[]),seen=new Set();
 function add(id,stage,actor,step,question,why,priority,focus){
  const uid='production:'+id;if(seen.has(uid))return;
  seen.add(uid);items.push({id:uid,stage,actor,step,question,why,priority,blocking:true,...(focus?{focus}:{})});
 }
 const missingSku=q.purchases.find(p=>p.price===null&&q.missing.includes(p.sku));
 if(missingSku)add('price:'+missingSku.sku,'quote','factory','factory','ما سعر شراء '+missingSku.name+'؟','صنف '+missingSku.sku+' يدخل في مشتريات هذا التصميم وسعره غير مسجّل.',30,{tab:'items',sku:missingSku.sku});
 const term=Object.keys(terms).find(key=>q.services[key]===null);
 if(term)add('term:'+term,'quote','factory','factory','ما قيمة '+terms[term]+' المعتمدة لهذا العرض؟','هذا البند مطلوب لحساب إجمالي البيع. يقبل الصفر عندما يكون هو القيمة المتفق عليها.',34,{tab:'sale'});
 const extra=q.extras.find(e=>e.readiness==='factory'&&!e.inMaterials&&e.cost==null&&q.missing.includes(wallRates[e.kind]));
 if(extra)add('wall-price:'+extra.kind,'quote','factory','factory','ما تعرفة '+extra.label+' التي سيورّدها المصنع؟','اختير توريد المصنع لهذا البند ولم تُسجَّل تعرفته.',32,{tab:'sale'});
 if(q.worktopIncluded&&q.worktop===null){
  const m=calculateKitchenDefaults(doc).materials.find(x=>!x.includePricing||x.cost===null);
  if(m){
   const price=!m.includePricing||m.priceM2===null;
   add('top-material:'+m.finishId,'quote','factory','defaults',!m.includePricing?'هل تُدرج تكلفة '+m.label+' ضمن السطح المشمول في العرض؟':price?'ما سعر المتر المربع لخامة '+m.label+'؟':'ما نسبة احتياط القص لخامة '+m.label+'؟',
    'يشمل عرض المصنع سطح العمل. مساحة الخام أو سعره لهذا التشطيب ما زال غير محسوم.',33,{material:m.finishId,code:price?'MFG-09':'MFG-06',property:price?'سعر متر سطح العمل المربع':'نسبة احتياط سطح العمل'});
  }
 }
 if(!q.approved)add('catalog',state.valid.customer?'release':'finish','factory','factory','هل اعتمد المصنع وصفات الكتالوج المستخدم في المشروع؟','يحدّد اعتماد المصنع الوصفات والأصناف التي يمكن تقديمها للعميل، وهو مطلوب قبل إصدار أمر التصنيع.',36,{tab:'transfer'});
 const records=catalogRecordStates(w);
 if(!records?.store.approved)add('store-approval','quote','factory','factory','هل اعتُمد كتالوج المتجر لهذا المشروع؟','راجع مواصفات الأصناف وأسعار شرائها وتوفرها ثم اعتمد سجل المتجر المستقل.',35,{tab:'items'});
 if(!records?.pricing.approved)add('pricing-approval','quote','factory','factory','هل اعتُمدت شروط التسعير لهذا المشروع؟','اعتماد وصفات التصنيع لا يعتمد أجور الخدمات وهوامش البيع والضريبة تلقائيًا.',37,{tab:'sale'});

 const special=q.issues.length&&factorySpecialTargets(doc).find(t=>!t.build&&['corner','inside','unit'].includes(t.kind)&&cat.specials?.[t.id]?.signature!==t.signature);
 if(special)add('special:'+special.id,'quote','factory','factory','ما ورقة القطع الفعلية لـ '+special.label+'؟','هذا التفصيل خارج الوصفة القياسية أو تغيّر رسمه بعد توثيق الورقة السابقة.',25,{tab:'special',targetId:special.id});
 if(q.outside.length&&!special){
  const u=doc.kitchen.units.find(u=>q.outside.includes(u.id));
  if(u)add('coverage:'+u.id,'quote','engineer','row','كيف ستُصنّع الوحدة '+u.id+' في هذا الصف؟','توجد وحدة مرسومة خارج حصر الوصفات. طابق تعبئة الصف أو جهّز ورقة قطع خاصة لها.',26,{runId:u.runId});
 }
 const quoteIssues=q.issues.filter(issue=>!known.has(issue));
 if(quoteIssues.length&&!q.outside.length&&!special)
  add('takeoff','quote','factory','quote','أي بند يمنع اكتمال حصر المصنع؟',quoteIssues[0],38);
 const hold=budgetHold(q,w.layoutBrief);
 if(hold&&q.complete)add('budget','quote','rep','row','أي تعديل في التوزيع يطابق سقف الميزانية المعتمد؟',hold,45);

 if(!state.valid.customer){
  if(q.approved&&records?.store.approved&&records?.pricing.approved&&q.complete&&!q.fitoutPending?.length&&!hold)
   add('customer','quote','customer','sign',
    (w.versions||[]).length?'هل يوافق العميل على التعديل الجديد؟':'هل يعتمد العميل التصميم وعرضه الحالي؟',
    (w.versions||[]).length?'تغيّر التصميم بعد الإصدار '+w.versions.at(-1).n.toLocaleString('ar-SA')+' المعتمد. راجع ما تغيّر وفرق السعر، واكتب سبب التعديل، ثم سجّل موافقة العميل لإصدار جديد.':'اكتمل حصر النطاق المحدد، ويحتاج العرض الحالي إلى تسجيل موافقة العميل.',58);
  return items;
 }

 const groups=releaseConcernGroups(doc,state);
 const handled=new Set();
 for(const g of groups){
  // Survey attestations already have a wall-specific visit task.
  if(g.origin==='proof'){for(const s of g.issues)handled.add(s);continue;}
  const route=checks[g.origin];if(!route)continue;
  const issue=g.issues.find(i=>!handled.has(i));
  if(issue)add('check:'+g.origin+(g.focus?.runId||g.focus?.wall?':'+(g.focus.runId||g.focus.wall):'')+(g.focus?.tier?':'+g.focus.tier:''),'release',route[0],route[1],route[2],issue,35,g.focus);
  for(const s of g.issues)handled.add(s);
 }
 const machine=q.machineIssues.find(i=>!handled.has(i));
 if(machine){add('machining','release','factory','factory','ما إعداد التشغيل الذي ينقص هذه القطعة؟',machine,39,{tab:'machines'});for(const i of q.machineIssues)handled.add(i);}
 const stock=q.purchases.find(p=>cat.items.some(i=>i.sku===p.sku&&!i.available)&&p.orderQty!==0);
 if(stock){
  add('stock:'+stock.sku,'release','factory','factory','هل يتوفر رصيد أو توريد للصنف '+stock.name+'؟','الصنف '+stock.sku+' غير متاح للتوريد، والرصيد المسجّل لا يغطي الكمية المطلوبة.',39,{tab:'items',sku:stock.sku});
  for(const p of q.purchases)if(cat.items.some(i=>i.sku===p.sku&&!i.available)&&p.orderQty!==0)handled.add('الصنف '+p.sku+' غير متاح للتوريد، والرصيد لا يثبت تغطية الاحتياج.');
 }
 const residual=q.releaseIssues.find(i=>!handled.has(i));
 if(residual)add('other-release','release','engineer','sign','ما التفصيل المتبقي في مراجعة الإفراج؟',residual,51,{section:'release'});
 if(!groups.length&&!state.valid.release)add('release','release','factory','sign','هل يعتمد مسؤول المصنع هذه النسخة للتصنيع؟','اكتملت فحوص هذه النسخة. يحفظ الاعتماد اسم المسؤول ويربطه بالقطع والمشتريات الحالية.',58,{section:'release'});
 return items;
}
