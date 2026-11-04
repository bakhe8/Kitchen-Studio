// Decisions that belong to the customer or supplier are kept separate from
// site measurements. Project geometry is a design source, never survey proof.
import {kitchenGeometry} from './kitchen-model.js';
const label=(value,label,aliases=[])=>({value,label,aliases});
const value=e=>['known','assumed'].includes(e?.state)?e.value:null;
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const count=(n,one,two,many)=>n===1?one+' واحد':n===2?two:ar(n)+' '+(n%100>=3&&n%100<=10?many:one);
const pick=(ctx,code,id)=>{const ids=[...new Set(ctx.rows.filter(r=>r.inputCode===code&&r.itemId).map(r=>r.itemId))];return ids.length?ids:[id];};
function questions(ctx,itemId,location){return (id,code,property,prompt,type,rest={})=>ctx.ask({id,code,itemId,property,label:prompt,type,location,verification:'confirmed',...rest});}
const via=(...items)=>items.filter(x=>x!=null).join(' + ');
function pantry(ctx,item){
 const ask=questions(ctx,item,'احتياج تخزين المؤن'),mode=value(ask('packaging','USE-08','طريقة التخزين','كيف يريد العميل تخزين الأرز؟','choice',{options:[label('bag','في الكيس الأصلي',['كيسه الأصلي','في كيسه الأصلي']),label('bin','في حافظة'),label('accessory','في عيّاشة'),label('none','لا يطلب تخزين أرز')]}));
 if(!mode)return;if(mode==='none'){ctx.derive('التجهيز المطلوب','لا يُطلب درج أو إكسسوار للأرز','اختيار العميل');return;}
 const amount=value(ask('rice-qty','USE-08','كمية الأرز التي يريد العميل تخزينها','كم كيلوغرامًا يريد العميل تخزينه؟','number',{unit:'كجم',min:0.001,aliases:['كمية الأرز','وزن الأرز المطلوب']}));
 if(mode==='bag'){const single=value(ask('bag-fill','USE-08','وزن الكيس الواحد','ما وزن كيس الأرز الذي يشتريه عادة؟','number',{unit:'كجم',min:0.001}));
 if(Number.isFinite(amount)&&Number.isFinite(single)&&single>0)ctx.derive('عدد الأكياس اللازمة',count(Math.ceil(amount/single),'كيس','كيسان','أكياس'),'تقريب ('+ar(amount)+' ÷ '+ar(single)+') إلى العدد الصحيح الأعلى');
 ctx.derive('إكسسوار العيّاشة','غير مطلوب لهذا الطلب','طريقة التخزين الحالية هي الكيس الأصلي');return;}
 if(mode==='bin'){ask('bin-supply','USE-08','جهة توريد الحافظة','من يوفّر حافظة الأرز؟','choice',{options:[label('owner','حافظة يوفّرها العميل'),label('factory','حافظة يورّدها المصنع')]});const cap=value(ask('bin-kg','USE-08','سعة الحافظة من الأرز بالكيلوغرام','ما كمية الأرز التي تسعها الحافظة الواحدة؟','number',{unit:'كجم',min:.001,hint:'إذا لم تُعرف السعة لهذا الأرز، اتركها للتحقق. السعة باللتر وحدها لا تعطي الوزن.'}));
 if(Number.isFinite(amount)&&Number.isFinite(cap)&&cap>0)ctx.derive('عدد الحافظات اللازمة',(Math.ceil(amount/cap)===1?'حافظة واحدة':count(Math.ceil(amount/cap),'حافظة','حافظتان','حافظات')),'كمية الأرز ÷ سعة الحافظة من الأرز، بالتقريب للأعلى');return;}
 const model=value(ask('rice-model','CAT-13','موديل العيّاشة','ما موديل العيّاشة المختارة؟','text',{verification:'documented'}));
 if(model){const cap=value(ask('rice-rated','CAT-13','سعة العيّاشة المعتمدة للأرز','ما سعة الأرز المذكورة لهذا الموديل؟','number',{unit:'كجم',min:.001,verification:'documented'}));
 if(Number.isFinite(cap)&&Number.isFinite(amount))ctx.derive('سعة العيّاشة',cap>=amount?'تستوعب الكمية المطلوبة':'ينقصها '+ar(amount-cap)+' كجم',via('طلب العميل','سعة الموديل'));}}
function corner(ctx,item){
 const ask=questions(ctx,item,'حل ركن المطبخ'),lev=value(ask('corner-tiers','CAT-14','المستويات المطلوبة للركن','في أي مستوى يريد العميل استغلال الركن؟','choice',{options:[label('base','السفلي فقط'),label('upper','العلوي فقط'),label('both','السفلي والعلوي منفصلين'),label('tall','وحدة بطول كامل'),label('none','دون وحدة زاوية')]}));
 if(!lev)return;if(lev==='none'){ctx.derive('التجهيز الداخلي','لا يُطلب تجهيز للركن','خيار الركن الحالي');return;}
 if(lev==='base')ctx.derive('الركن العلوي','غير مطلوب','المستويات السارية: السفلي فقط');
 const config=(tier,key)=>{const hand=value(ask(key+'-access','CAT-14','جهة الوصول إلى '+tier,'من أي جهة يُفتح '+tier+'؟','choice',{options:[label('one','من جهة واحدة'),label('two','من جهتين')]}));
 const inside=value(ask(key+'-inside','CAT-14','وظيفة '+tier,'كيف يريد استخدام '+tier+' من الداخل؟','choice',{options:[label('shelves','رفوف ثابتة'),label('pull','آلية سحب أو دوران'),label('empty','فراغ مفتوح')]}));
 if(inside==='pull')ask(key+'-corner-model','CAT-14','موديل آلية '+tier,'ما موديل آلية الركن؟','text',{verification:'documented'});
 else if(inside)ctx.derive('آلية '+tier,'لا يلزم موديل آلية متحركة','اختيار التقسيم الداخلي');
 return hand&&inside;};
 if(lev==='both'){const done=config('الركن السفلي','base');if(!done)return;const same=value(ask('tier-same','USE-13','تكرار تنظيم الركن في المستوى العلوي','هل يريد العلوي بنفس جهة الفتح والاستخدام؟','boolean'));
 if(same===true)ctx.derive('اختيارات الركن العلوي','يتبع جهة الفتح والاستخدام اللذين اختارهما العميل للسفلي','موافقة العميل على تكرار الاختيار؛ تُراجع ملاءمة مقاسات المستوى العلوي');if(same===false)config('الركن العلوي','upper');}
 else{const t={base:'الركن السفلي',upper:'الركن العلوي',tall:'ركن الوحدة الطويلة'};config(t[lev],'single-'+lev);}}
function budget(ctx,item){
 const ask=questions(ctx,item,'ميزانية المطبخ'),mode=value(ask('budget-rule','PRJ-05','صفة الميزانية','كيف يريد العميل التعامل مع الميزانية؟','choice',{options:[label('fixed','سقف ملزم'),label('preferred','ميزانية مفضلة'),label('open','لا يحدد مبلغًا الآن')]}));
 if(!mode)return;if(mode==='open'){ctx.derive('مبلغ الميزانية','لا يوجد سقف مالي في التقدير الحالي','خيار الميزانية الساري');return;}
 const max=value(ask('budget-cap','PRJ-05','الحد الأعلى للميزانية','ما الميزانية المتفق عليها؟','number',{unit:'ريال',min:0,aliases:['الميزانية','سقف الميزانية']}));
 const quote=value(ask('matching-quote','MFG-09','وجود عرض يطابق نطاق الميزانية','هل يوجد عرض سعر لنفس البنود وعلى نفس أساس الضريبة؟','boolean'));if(quote!==true)return;
 const price=value(ask('quoted-price','MFG-09','سعر العرض المطابق','كم يبلغ هذا العرض؟','number',{unit:'ريال',min:0,verification:'documented'}));if(Number.isFinite(max)&&Number.isFinite(price))ctx.derive(mode==='fixed'?'مقارنة بالسقف الملزم':'مقارنة بالميزانية المفضلة',price>max?'يتجاوزها بـ '+ar(price-max)+' ريال':price===max?'يطابق المبلغ':'يتبقى '+ar(max-price)+' ريال','الميزانية وعرض السعر لنطاق واحد');}
function handoff(ctx,opts){
 const geo=kitchenGeometry(ctx.kitchen,ctx.room),unitCount=geo.units.length,topCount=geo.worktops.length,targets=[{id:'install',label:'تجهيز الموقع للتركيب'},{id:'top',label:'قالب سطح العمل'},{id:'order',label:'مراجعة طلب التصنيع'}];const target=ctx.targets(targets,opts.entityId||'install');const ask=questions(ctx,'تسليم-المطبخ',ctx.room.name||'المطبخ');
 ctx.design('الوحدات في التصميم',ar(unitCount)+' وحدة','الوحدات الموضوعة فعليًا في المخطط');if(!unitCount){ctx.info('قبل التسليم','لا توجد وحدات مصمّمة يمكن تجهيزها للتسليم.','المخطط الحالي');return;}
 if(target==='install'){
 const changes=value(ask('mep-needed','INS-04','وجود أعمال خدمات مطلوبة قبل التركيب','هل يتوقف التركيب على نقل أو تجهيز خدمة بالموقع؟','boolean'));
 if(changes===true){const job=value(ask('mep-job','INS-04','عمل الخدمة المطلوب','ما العمل الذي ينتظره التركيب؟','text'));const done=value(ask('mep-finished','INS-04','اكتمال عمل الخدمة المطلوب','هل نُفذ العمل وأعيد التحقق منه؟','boolean'));if(done===false&&job)ctx.derive('ما ينتظر التنفيذ',job,'عمل موقع مسجل ولم يتم التحقق من إنجازه');}
 if(changes===false)ctx.derive('نقل الخدمات','لا تُطلب تفاصيل نقل خدمات لهذه الزيارة','جواب الفني عن أعمال الموقع');
 const access=value(ask('path-required','INS-01','وجود عائق في مسار إدخال القطع','هل توجد فتحة ضيقة أو عائق في طريق إدخال الوحدات؟','boolean'));if(access===true){ask('access-width','INS-01','عرض أضيق فتحة','ما صافي عرض أضيق فتحة في المسار؟','number',{unit:'مم',min:1,verification:'measured'});}return;}
 if(target==='top'){ctx.design('امتدادات سطح العمل',ar(topCount)+' امتدادات','سطوح الصفوف الفعلية، بعد خصم الفواصل بين الوحدات');
 if(!topCount){ctx.info('قالب السطح','لا يوجد سطح موضوع يحتاج إلى قالب حاليًا.','المخطط');return;}
 const installed=value(ask('units-level','SITE-18','تم تثبيت الوحدات وتسويتها','هل ثُبِّتت الوحدات وسُوّيت في الموقع؟','boolean'));
 if(installed===false){ctx.derive('القالب النهائي','يؤجّل حتى تثبيت الوحدات وتسويتها','حالة التركيب المبلّغ عنها');return;}
 if(installed===true){ctx.design('الفتحات المرسومة',ar(geo.cutouts.length)+' فتحات حوض أو موقد','حصر فتحات الوحدات في التصميم؛ لا يعوّض قالب الموقع');ask('template-id','INS-05','مرجع القالب النهائي','ما رقم أو مرجع قالب السطح المرفوع بعد التثبيت؟','text',{verification:'documented'});}return;}
 const approved=value(ask('design-signed','INS-06','اعتمد العميل إصدار التصميم','هل اعتمد العميل إصدار التصميم المطلوب تصنيعه؟','boolean'));if(approved===false){ctx.derive('طلب الإنتاج','ينتظر اعتماد إصدار التصميم','حالة قرار العميل');return;}if(approved===true){ask('approved-rev','INS-06','إصدار التصميم المعتمد','ما رقم الإصدار المعتمد؟','text',{verification:'documented'});const custom=value(ask('has-custom','MFG-13','وجود قطعة خاصة خارج الكتالوج','هل يتضمن هذا الإصدار قطعة خاصة خارج كتالوج المصنع؟','boolean'));if(custom===true)ask('custom-ref','MFG-13','مرجع رسم القطعة الخاصة','ما مرجع الرسم التنفيذي للقطعة الخاصة؟','text',{verification:'documented'});ctx.info('مراجعة الطلب','يظل إطلاق التصنيع مرتبطًا بمراجعة المصنع والقياسات النهائية.','إجابات هذه المقابلة');}
}
export function buildCustomer(ctx,topicId,opts={}){
 if(topicId==='production'){handoff(ctx,opts);return;}
 const branches=[['pantry','USE-08','طلب-تخزين','تخزين الأرز والمؤن'],['corner','CAT-14','ركن-المطبخ','تخصيص الزوايا'],['budget','PRJ-05','ميزانية-المطبخ','الميزانية والعرض']];
 const choices=branches.flatMap(([branch,code,fallback,title])=>pick(ctx,code,fallback).map(item=>({id:branch+':'+item,label:item===fallback?title:title+' · '+item})));
 const selected=ctx.targets(choices,opts.entityId||choices[0].id),at=selected.indexOf(':'),group=selected.slice(0,at),item=selected.slice(at+1);
 if(group==='pantry')pantry(ctx,item);else if(group==='corner')corner(ctx,item);else budget(ctx,item);
}
