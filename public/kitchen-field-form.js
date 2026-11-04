import {manualDefault} from './kitchen-defaults-field.js';
import {getEffectiveDefaults} from './kitchen-defaults-model.js';
import {readVisitContext} from './kitchen-assist-visit.js';
// Only the technician's form draft lives here. Staged file bytes are not written
// to the local attachment store until the user explicitly saves the reading.
import {fieldChoices} from './kitchen-field-model.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {kitchenFeatureSpecs,kitchenUnitSpecs} from './kitchen-model.js';
import {pointTypes} from './kitchen-site-survey-model.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(obj,sel)=>Object.entries(obj).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===sel?' selected':'')+'>'+esc(v)+'</option>').join('');
const units=['مم','سم','م','م²','م³','درجة','٪','كجم','لتر','عدد','واط','كيلوواط','فولت','أمبير','ريال','يوم','ساعة'];
const arabicNumber=s=>String(s??'').trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/٫/g,'.').replace(/−/g,'-');
const finite=s=>{const v=arabicNumber(s);const normalized=v.replace(/[,٬]/g,'');return v!==''&&/^[+-]?(?:(?:\d{1,3}(?:[,٬]\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)&&Number.isFinite(Number(normalized))?Number(normalized):null;};
const geometry=['point','line','polygon'],missingStatus=s=>s==='unknown'||s==='na',arr=a=>Array.isArray(a)?a:[],labels={DOC:'مرفق',SITE:'عنصر',MEP:'خدمة',PRJ:'مشروع',USE:'طلب',EQP:'جهاز',CAT:'قطعة',MFG:'مكوّن',DES:'قاعدة',INS:'تركيب'};
const specificLabels={'SITE-03':'جدار','SITE-06':'جدار','SITE-07':'أرضية','SITE-08':'سقف','SITE-09':'عائق','SITE-10':'منور','SITE-11':'باب','SITE-12':'نافذة','SITE-13':'حافة','SITE-19':'تعلية','MEP-01':'تغذية','MEP-02':'محبس','MEP-03':'صرف','MEP-04':'بلاعة','MEP-06':'سخان','MEP-09':'مقبس','EQP-05':'ثلاجة','EQP-13':'حوض'};
const sharedProps={
 DOC:'معرّف الملف|تاريخ الالتقاط|الجدار الظاهر|اتجاه التصوير|مصدر الوثيقة|صورة أو ملف',SITE:'الموقع على الجدار|العرض|الارتفاع|العمق|صورة الموقع',
 MEP:'المسافة من بداية الجدار|ارتفاع المركز عن الأرضية النهائية|البروز|التجهيز المخدوم|صورة الموقع',PRJ:'الطلب المحدد|جهة الاعتماد|التاريخ المطلوب|المستند المرجعي',
 USE:'الغرض أو الاستخدام|الكمية|الوحدة المقترحة|طريقة الاستخدام|أولوية الطلب',EQP:'الموديل|عرض الجهاز|ارتفاع الجهاز|عمق الجهاز|دليل التركيب',
 CAT:'رمز القطعة|إصدار الكتالوج|مادة القطعة|مواصفة المورد|مستند المورد',MFG:'رمز المكوّن|المواصفة|إجراء التحقق|القيمة المعتمدة|مستند التصنيع',
 DES:'الشرط|العنصر المتأثر|القيمة المحددة|مرجع القاعدة|الاستثناء',INS:'العنصر المعني|مرجع التركيب|موعد التحقق|نتيجة الفحص|مستند الاعتماد'
};
const specificProps={
 'DOC-01':'صورة شاملة|نقطة التصوير|اتجاه العدسة|الجدار الظاهر','DOC-02':'صورة تفصيل|مرجع الحجم|البعد المرجعي','DOC-03':'ملف المخطط|رقم الإصدار|مقياس الرسم|وحدة الرسم','DOC-04':'ملف المسح|نقطة المطابقة|الجهاز المستخدم','DOC-05':'أداة القياس|تاريخ القياس|دقة الأداة|ملف القراءات الخام','DOC-06':'القيمة الأولى|القيمة المتعارضة|إجراء الحسم',
 'SITE-01':'الطابق|الفراغ المتصل|مرحلة التشطيب|تاريخ الزيارة','SITE-02':'نقطة الأصل|وصف المرجع|منسوب الصفر|اتجاه المحور','SITE-03':'نقطة بداية الجدار|نقطة نهاية الجدار|طول الوجه الداخلي|ارتفاع الجدار|نوع التشطيب','SITE-04':'زاوية الركن|طول القطر|ارتفاع مستوى القياس','SITE-05':'ارتفاع نقطة القراءة|إزاحة الجدار عند القراءة|موقع أكبر بروز','SITE-06':'سماكة الجدار|مادة الجدار|وصف البطانة','SITE-07':'نقطة المنسوب|منسوب النقطة|منسوب غطاء البلاعة|نوع التشطيب','SITE-08':'محيط السقف المستعار|منسوب أسفل السقف|منسوب أسفل السقوط','SITE-09':'محيط العائق|البروز|منسوب أسفل العائق|منسوب أعلى العائق','SITE-10':'محيط التجويف|العمق|الارتفاع|موضع فتحة الوصول','SITE-11':'المسافة إلى أول الفتحة|العرض الصافي|الارتفاع الصافي|بروز الحلق|منسوب العتبة|جهة المفصلة|اتجاه الفتح','SITE-12':'المسافة إلى أول الفتحة|عرض الشباك|ارتفاع الشباك|منسوب الجلسة|عمق الإطار|اتجاه الفتح','SITE-13':'بداية الجزء|نهاية الجزء|ارتفاع الحافة|بروز الحافة','SITE-16':'محيط منطقة التثبيت|مادة التدعيم|مستند التحقق','SITE-17':'القراءة الأولى|قراءة التحقق|سماحية القبول','SITE-18':'محيط القالب|بروز الحافة|موضع الوصلة|ملف القالب','SITE-19':'بداية الضلع من ركن الجدار|نهاية الضلع من المرجع نفسه|العمق عند بداية الضلع|العمق عند نهاية الضلع|منسوب أعلى التعلية|محيط التعلية|بداية فراغ الجهاز|نهاية فراغ الجهاز|منسوب أرضية فراغ الجهاز|صورة قطاع التعلية',
 'MEP-01':'نوع التغذية|ارتفاع مركز المخرج|بعد المركز عن بداية الجدار|قطر الوصلة','MEP-02':'موضع المحبس|اتجاه المقبض|حيز الوصول','MEP-03':'بُعد مركز المخرج عن بداية الجدار|ارتفاع مركز المخرج عن الأرضية النهائية|قطر المخرج|اتجاه المخرج|المسار داخل الجدار','MEP-04':'مركز البلاعة|شكل الغطاء|عرض الغطاء|منسوب الغطاء|حيز التنظيف','MEP-05':'مسار التمديد|قطر الماسورة|الجزء المحجوب','MEP-06':'موديل السخان|عرضه|ارتفاعه|عمقه|حيز الصيانة','MEP-08':'نوع المصدر|موضع المحبس|مسار التوصيل','MEP-09':'عدد المخارج|ارتفاع المركز|نوع المخرج|الجهاز المستفيد','MEP-10':'معرّف الدائرة|الجهد|التيار المقنن|القدرة','MEP-13':'نظام الشفط|قطر فتحة الطرد|منسوب الفتحة|مسار الدكت','MEP-16':'طول الشريط|جهد التشغيل|موقع المحول','MEP-20':'الموقع القائم|الموقع المقترح|قرار النقل',
 'PRJ-01':'اسم المشروع|رمز المطبخ|الطابق','PRJ-04':'موعد جاهزية الموقع|تاريخ وصول الجهاز|موعد التركيب','PRJ-05':'الحد الأعلى للميزانية|ما يشمله السعر|شمول الضريبة','PRJ-07':'الطلب|درجة الإلزام|صاحب القرار',
 'USE-03':'ارتفاع الوصول المريح|الاتجاه المفضل|شرط الاستخدام','USE-05':'طول سطح التحضير|العمق المطلوب|قربه من الحوض','USE-06':'الغرض|عرض الغرض|ارتفاع الغرض|وزن الغرض','USE-08':'كمية الأرز المراد تخزينها|طريقة التخزين|أبعاد العبوة|موقع التخزين المفضل','USE-12':'موقع التخزين المقترح|الغرض المخزّن|الوحدة المستهدفة','USE-14':'نوع الفتح|جهة المفصلة|نوع المقبض',
 'EQP-01':'الشركة المصنّعة|الموديل|العدد|صورة بطاقة الموديل','EQP-02':'عرض الجهاز|ارتفاع الجهاز|عمق الجهاز|الحد الأدنى لارتفاع فتحة الموديل|عرض فتحة التركيب|ارتفاع فتحة التركيب|عمق فتحة التركيب','EQP-03':'جهة الفتح|بروز الباب المفتوح|حيز الصيانة','EQP-04':'نوع التوصيل|القدرة المطلوبة|موضع التوصيل','EQP-07':'عرض قصّة سطح الطبخ|عمق القصّة|قالب القصّة','EQP-13':'عرض الحوض|عمق قصّة السطح|عرض القصّة|موديل الحوض|ملف القالب','EQP-14':'ارتفاع الخلاط|قطر ثقب التثبيت|مدى حركة الذراع',
 'CAT-03':'أصغر عرض|أكبر عرض|أصغر عمق|أكبر عمق','CAT-05':'مادة اللوح|السماكة|رمز التشطيب','CAT-10':'طول السكة|الحمولة المعلنة|الموديل','CAT-13':'موديل الإكسسوار|عرض التركيب الداخلي|الحمولة المعلنة','CAT-17':'سماكة السطح|منسوب أسفل الرخام عن صفر الأرضية النهائية|نوع الحافة|تشطيب الوجه',
 'MFG-02':'اسم القطعة|معادلة القص|سماحية القطع|إصدار القاعدة','MFG-07':'سماحية القبول|البعد المرجعي|مرجع السماحية','MFG-09':'سعر الوحدة|تكلفة الخدمة|تاريخ التسعير',
 'DES-02':'عرض الممر|بروز الضلفة المفتوحة|مرجع الخلوص','DES-05':'معرّف البديل|الفرق عن التصميم|سبب الاختيار',
 'INS-01':'أضيق عرض مرور|أقل ارتفاع مرور|صورة مسار الإدخال','INS-02':'مرجع الوحدة|بعد البداية|منسوب التركيب','INS-06':'إصدار التصميم|تاريخ الاعتماد|مستند الاعتماد','INS-07':'وصف التعديل|الإصدار السابق|مرجع الموافقة','INS-11':'العنصر المختبر|نتيجة الفحص|موعد الاستلام'
};
const unitHint=name=>/سعر|تكلفة|الميزانية/.test(name)?'ريال':/القدرة/.test(name)?'واط':/الجهد|جهد التشغيل/.test(name)?'فولت':/التيار/.test(name)?'أمبير':/الحمولة|وزن|كمية الأرز/.test(name)?'كجم':/زاوية الركن/.test(name)?'درجة':/^العدد$|عدد المخارج/.test(name)?'عدد':/^(?:ب[ُُ]?عد |المسافة |العرض|الطول|الارتفاع|العمق|ارتفاع|عرض|طول|عمق|قطر|سماكة|السماكة|منسوب|الحد الأدنى لارتفاع فتحة الموديل|أضيق عرض|أقل ارتفاع|بعد البداية|بداية الضلع|نهاية الضلع|بداية فراغ|نهاية فراغ|بداية الجزء|نهاية الجزء|أصغر |أكبر عرض|أكبر عمق|أكبر ارتفاع|بروز|البروز|سماحية|إزاحة)/.test(name)?'مم':'';
const typeHint=name=>unitHint(name)?'number':/^(نقطة|مركز البلاعة)/.test(name)?'point':/^محيط/.test(name)?'polygon':/^(مسار الدكت|مسار التمديد)$/.test(name)?'line':/^(ملف |صورة |مستند |قالب القصّة)/.test(name)?'file':/^(موعد|تاريخ)/.test(name)?'date':'text';
const valLabel=(s,control,extra='')=>'<label class="ff-field '+extra+'"><span>'+esc(s)+'</span>'+control+'</label>';
const input=(k,value,extra='')=>'<input name="'+k+'" value="'+esc(value)+'" '+extra+'>';
const sel=(k,choices,value)=>'<select name="'+k+'">'+options(choices,value)+'</select>';
const action=(id,label,extra='')=>'<button type="button" data-ff-action="'+id+'" '+extra+'>'+esc(label)+'</button>';
function spatialItems(doc){
 const room=doc?.room||{},k=doc?.kitchen||{},map=new Map();if(room.name)map.set('room',room.name);
 try{for(const w of roomArchitecture(room).walls)map.set(w.id,w.label);}catch{}
 for(const f of arr(k.features))map.set(f.id,(kitchenFeatureSpecs[f.kind]?.label||f.kind)+' · '+(map.get(f.wall)||''));
 let i=0;for(const row of arr(k.runs))map.set(row.id,(row.placement==='free'?'جزيرة':row.tier==='upper'?'صف علوي':'صف سفلي')+' '+(++i)+(map.has(row.wall)?' · '+map.get(row.wall):''));
 for(const u of arr(k.units))map.set(u.id,(kitchenUnitSpecs[u.kind]?.label||u.kind)+' · '+(map.get(u.runId)||''));
 for(const p of arr(room.sitePoints))map.set(p.id,pointTypes[p.kind]||p.kind);return map;
}
const encodedPoints=v=>{try{const a=JSON.parse(v);return Array.isArray(a)&&a.every(row=>Array.isArray(row)&&row.length>=2&&row.length<=3&&row.every(Number.isFinite))?a:null;}catch{return null;}};
let counter=0;
export function mountFieldForm(host,{entry,record=null,seed=null,getDoc,attachmentStore,onSave,onCancel,onDirty}={}){
 if(!host||!entry)throw Error('تعذّر فتح نموذج المدخل.');
 const doc=getDoc?.()||{},reg=arr(doc.room?.fieldRegister?.records),prefix=entry.code.split('-')[0],refs=spatialItems(doc),old=record||{...(seed||{}),...Object.fromEntries(Object.entries(readVisitContext(doc)).filter(([,v])=>!!v))},id='kff-'+(++counter)+'-',ac=new AbortController(),listen=(t,e,fn)=>t.addEventListener(e,fn,{signal:ac.signal});
 const same=reg.filter(r=>r.inputCode===entry.code),base=specificLabels[entry.code]||labels[prefix]||'عنصر',taken=new Set(reg.map(r=>r.itemId));let idx=1;while(taken.has(base+'-'+String(idx).padStart(2,'0')))idx++;
 const hinted=(specificProps[entry.code]||sharedProps[prefix]||'الوصف').split('|'),specTerms=String(entry.spec||'').split(/[،؛.]/).map(s=>s.trim()).filter(s=>s.length>2&&s.length<43),suggestions=[...new Set([...hinted,...getEffectiveDefaults(doc).filter(v=>v.code===entry.code).map(v=>v.property),...specTerms,...same.map(r=>r.property)])];
 const dl=(key,values)=>'<datalist id="'+id+key+'">'+[...new Set(values)].filter(Boolean).map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist>';
 const makeList=(key)=>' list="'+id+key+'" autocomplete="off"';
 const valOld=old.value??'',typed={},geoDraft={};let typ=old.valueType||'text',dirty=false,busy=false,dead=false,lastAutoUnit='',lastSuggestedType=null;
 typed[typ]=valOld;const files=arr(old.attachments).map(ref=>({ref:{...ref},name:ref.name,file:null})),refLabels=Array.from(refs,([key,label])=>label+' ['+key+']');
 const referenceName=old.location||'',itemId=old.itemId||base+'-'+String(idx).padStart(2,'0');
 host.innerHTML='<form class="ff" dir="rtl" novalidate><div class="ff-heading"><div><span class="ff-code" dir="ltr">'+esc(entry.code)+'</span><h3>'+esc(entry.name)+'</h3></div><small>'+esc(record?'تعديل قراءة':'قراءة جديدة')+'</small></div>'+
 '<details class="ff-guide"><summary>دليل البند: المواصفات وطريقة الجمع</summary><div><b>المواصفات</b><p>'+esc(entry.spec)+'</p><b>طريقة الإدخال</b><p>'+esc(entry.method)+'</p><b>من يؤكد المعلومة؟</b><p>'+esc(entry.owner)+'</p><small>'+esc(entry.need)+' · '+esc(entry.stage)+'</small>'+
 [['representation','كيف يمثّله البرنامج؟'],['impact','ما القرار أو النتيجة التي تتغيّر؟'],['waiting','ما الذي ينتظر عند النقص أو التعارض؟']].filter(([key])=>entry[key]).map(([key,label])=>'<b>'+label+'</b><p>'+esc(entry[key])+'</p>').join('')+'</div></details>'+
 '<div class="ff-pair">'+valLabel('معرّف العنصر',input('itemId',itemId,makeList('items')+' required maxlength="150"'))+valLabel('الموضع أو الوحدة الأم',input('location',referenceName,makeList('loc')+' maxlength="500" placeholder="جدار أو وحدة أو مرجع حر"'))+'</div>'+
 '<label class="ff-hold"><input type="checkbox" data-shop-critical '+(old.shopCritical?'checked':'')+'> يتوقف تصنيع العنصر المرتبط بهذه القراءة حتى حسمها</label>'+
 dl('items',[...same.map(r=>r.itemId),...refs.keys()])+dl('loc',[...refLabels,...reg.map(r=>r.location)])+
 (refLabels.length?'<select class="ff-pickref" data-ff-pickref aria-label="اختيار مرجع من الرسم"><option value="">اختيار مرجع من الرسم…</option>'+refLabels.map((label,i)=>'<option value="'+i+'">'+esc(label)+'</option>').join('')+'</select>':'')+
 valLabel('الخاصية',input('property',old.property||'',makeList('props')+' required maxlength="240" placeholder="اختر خاصية أو اكتب اسمها"'))+dl('props',suggestions)+
 '<div class="ff-chips" aria-label="خصائص مقترحة">'+hinted.slice(0,3).map((v,i)=>action('suggest',v,'data-i="'+i+'"')).join('')+(suggestions.length>3?'<select class="ff-allprops" data-ff-allprops aria-label="كل الخصائص المقترحة"><option value="">المزيد…</option>'+suggestions.map((label,i)=>'<option value="'+i+'">'+esc(label)+'</option>').join('')+'</select>':'')+'</div>'+
 '<div class="ff-pair">'+valLabel('نوع القيمة',sel('valueType',fieldChoices.valueType,typ))+valLabel('حالة التحقق',sel('verification',fieldChoices.verification,old.verification||'preliminary'))+'</div>'+
 '<div data-ff-auto class="ff-default-origin" hidden></div><div data-ff-value></div>'+
 '<details class="ff-more" data-ff-meta><summary>مرجع القراءة والمصدر وحالة التنفيذ</summary><div>'+
 valLabel('مرجع القراءة',input('readingRef',record?.readingRef||'', 'maxlength="160" placeholder="رمز اختياري للربط بالفحوص"'))+
 valLabel('المصدر أو مرجع المستند',input('source',old.source||'','maxlength="1200" placeholder="قياس ليزر، دليل موديل، رقم مخطط…"'))+
 '<div class="ff-pair">'+valLabel('المسؤول',input('responsible',old.responsible||'','maxlength="200" placeholder="اسم الفني أو الجهة"'))+valLabel('تاريخ القياس أو التوثيق',input('date',old.date||'','type="date" dir="ltr"'))+'</div>'+
 '<div class="ff-pair">'+valLabel('مرونة القرار',sel('flexibility',fieldChoices.flexibility,old.flexibility||'unspecified'))+valLabel('الحالة التنفيذية',sel('execution',fieldChoices.execution,old.execution||'unspecified'))+'</div>'+
 valLabel('إصدار المشروع أو الزيارة',input('revision',old.revision||'','maxlength="120" placeholder="مثل: الزيارة الثانية"'))+valLabel('الدقة أو الملاحظة','<textarea name="notes" rows="2" maxlength="3000">'+esc(old.notes||'')+'</textarea>')+'</div></details>'+
 '<details class="ff-more" data-ff-files><summary><span>صور وملفات الإثبات</span> <small data-ff-count></small></summary><div><div class="ff-filetools">'+action('files','إرفاق ملف')+action('camera','تصوير بالموقع')+'</div>'+
 '<input type="file" hidden multiple data-ff-pick><input type="file" hidden accept="image/*" capture="environment" data-ff-camera><div data-ff-files-list></div><small class="ff-limit">حتى 12 م.ب للملف.</small></div></details>'+
 '<p class="ff-result" role="status" aria-live="polite" hidden></p><footer><button class="ff-primary" type="submit">حفظ القراءة</button>'+action('cancel','رجوع')+'</footer></form>';
 const form=host.querySelector('form'),q=s=>form.querySelector(s),f=k=>form.elements.namedItem(k),read=k=>String(f(k)?.value??'').trim(),valueHost=q('[data-ff-value]'),msg=q('.ff-result');
 const say=(s='',error=false)=>{msg.hidden=!s;msg.textContent=s;msg.classList.toggle('error',!!error);};
 const setDirty=v=>{if(dirty!==v){dirty=v;onDirty?.(dirty);}};
 const removeValueFocus=()=>{const af=host.ownerDocument.activeElement;if(valueHost.contains(af))af.blur?.();};
 let unit=old.unit||'',coords=encodedPoints(typeof valOld==='string'?valOld:'')?.map(row=>row.map(String))||[],rawGeometry=false;
 function remember(){const el=f('readingValue');if(el)typed[typ]=el.value;if(f('unit'))unit=f('unit').value;if(geometry.includes(typ)&&!rawGeometry){coords=[...valueHost.querySelectorAll('[data-ff-coordrow]')].map(row=>[...row.querySelectorAll('input')].map(e=>e.value));geoDraft[typ]=coords.map(r=>r.slice());}}
 function drawValue(){
  const blankOK=missingStatus(read('verification')),v=typed[typ]??'',isGeo=geometry.includes(typ),suppressUnit=['boolean','date','file'].includes(typ);
  let html='';const optional=blankOK?' (اختياري)':'';
  if(typ==='number') html=valLabel('القيمة'+optional,input('readingValue',v,'inputmode="decimal" dir="ltr" placeholder="القيمة المقاسة"'));
  else if(typ==='boolean')html=valLabel('القيمة'+optional,sel('readingValue',{'':'اختر…',true:'نعم',false:'لا'},v===''?'':String(v)));
  else if(typ==='date')html=valLabel('القيمة'+optional,input('readingValue',v,'type="date" dir="ltr"'));
  else if(isGeo){
    const min=typ==='point'?1:typ==='line'?2:3;
    rawGeometry=Boolean(v&&String(v).trim()&&!encodedPoints(v)&&!coords.length);
    if(rawGeometry){html=valLabel('الإحداثيات'+optional,'<textarea name="readingValue" rows="2" dir="ltr">'+esc(v)+'</textarea>');}
    else{
     if(!coords.length)coords=Array.from({length:min},()=>['','','']);while(coords.length<min)coords.push(['','','']);if(typ==='point')coords=coords.slice(0,1);
     html='<div class="ff-coords"><b>إحداثيات من المرجع المحدد'+optional+'</b><div class="ff-triple ff-axis-labels"><span>س</span><span>ص</span><span>المنسوب (اختياري)</span></div>'+
     coords.map((r,i)=>'<div data-ff-coordrow class="ff-coordrow"><div class="ff-triple">'+['س','ص','المنسوب'].map((n,j)=>'<input inputmode="decimal" dir="ltr" aria-label="'+n+' للنقطة '+(i+1)+'" value="'+esc(r[j]??'')+'" placeholder="—">').join('')+'</div>'+(typ!=='point'&&coords.length>min?action('drop-point','×','data-i="'+i+'" aria-label="حذف النقطة '+(i+1)+'"'):'')+'</div>').join('')+(typ==='point'?'':action('add-point','+ نقطة'))+'</div>';
    }
  }else if(typ==='file'){html='<div class="ff-filevalue">القيمة: ملف إثبات '+action('files','اختر ملفًا')+'</div>';}
  else if(typ==='choice'){const prev=same.filter(r=>r.property===read('property')&&r.valueType==='choice').map(r=>r.value).filter(v=>typeof v==='string');html=valLabel('القيمة المختارة'+optional,input('readingValue',v,makeList('choices')+' maxlength="3000" placeholder="اختر أو اكتب خيارًا"'))+dl('choices',prev);}
  else html=valLabel('القيمة'+optional,'<textarea name="readingValue" rows="2" maxlength="12000" placeholder="أدخل المعلومة كما رُصدت">'+esc(v)+'</textarea>');
  valueHost.innerHTML=html+(suppressUnit?'':valLabel('وحدة القياس',input('unit',unit,makeList('units')+' maxlength="60" placeholder="مم، سم، كجم…"'))+dl('units',units))+
    (blankOK?'<small class="ff-hint">يمكن حفظ القراءة بلا قيمة. لا تُدخل صفرًا للدلالة على المجهول.</small>':'');
 }
 function filesUI(){q('[data-ff-count]').textContent=files.length?'('+files.length+')':'';q('[data-ff-files-list]').innerHTML=files.map((p,i)=>'<div class="ff-file">'+valLabel('اسم المرفق',input('ff-file-'+i,p.name,'data-ff-name="'+i+'" maxlength="255"'))+'<span>'+esc(Math.round((p.file?.size??p.ref?.size??0)/1024))+' ك.ب</span>'+(p.ref?action('download','تنزيل','data-i="'+i+'"'):'')+action('remove-file','إزالة','data-i="'+i+'"')+'</div>').join('');}
 function chooseType(next){remember();if(typ!==next){typ=next;const x=typed[next];coords=geoDraft[next]?.map(r=>r.slice())||encodedPoints(x)?.map(r=>r.map(String))||[];}f('valueType').value=next;drawValue();}
 function chooseProperty(name){const prop=f('property');prop.value=name;const t=typeHint(name),u=unitHint(name);
  if(!record&&!seed?.value&&!(String(typed[typ]??'').trim()||read('readingValue'))&&(!lastSuggestedType||typ===lastSuggestedType)){chooseType(t);lastSuggestedType=t;if((!unit||unit===lastAutoUnit)&&u){unit=u;lastAutoUnit=u;if(f('unit'))f('unit').value=u;}else if(unit&&unit===lastAutoUnit&&!u){unit='';lastAutoUnit='';if(f('unit'))f('unit').value='';}}
 }
 let imported=null,valueEdited=!!record||seed?.value!=null;
 function propose(force=false){const box=q('[data-ff-auto]');if(!box||record||!read('property'))return;
 const def=manualDefault(getDoc(),{code:entry.code,property:read('property'),itemId:read('itemId'),location:read('location')});
 const mutable=!valueEdited||force,oldImport=imported;imported=def;
 if(!def){box.hidden=true;return;}box.hidden=false;const prior=def.origin==='record',blocked=def.origin==='conflict'||def.mode!=='value',asData=fieldChoices.valueType[def.type]&&!geometry.includes(def.type)&&def.type!=='file';
 box.textContent=(def.origin==='conflict'?def.source:blocked?(def.mode==='na'?'مستبعد من التقدير':'بانتظار قيمة')+' · '+def.source:(prior?'قيمة موجودة: ':'قيمة مقترحة: ')+(def.type==='boolean'?(def.value?'نعم':'لا'):def.value)+(def.unit?' '+def.unit:'')+' · '+def.source);
 if(!mutable)return;
 if(blocked||prior||!asData){
  if(oldImport&&oldImport.mode==='value'&&!valueEdited){typed[typ]='';unit='';if(f('source')?.value===oldImport.source)f('source').value='';drawValue();}
  if(def.mode==='na'&&!prior){f('verification').value='na';typed[typ]='';drawValue();}else if(oldImport?.mode==='na'&&read('verification')==='na'){f('verification').value='preliminary';drawValue();}return;
 }
 typ=def.type;f('valueType').value=typ;typed[typ]=def.value;unit=def.unit||'';if(!f('source').value||f('source').value===oldImport?.source)f('source').value=def.source;
 f('verification').value='estimated';drawValue();if(force)setDirty(true);
 }
 function filesFrom(list){
  if(!list?.length)return;const a=Array.from(list);
  if(a.some(x=>x.size>12*1024*1024)){say('أحد الملفات يتجاوز 12 م.ب. اختر ملفًا أصغر.',true);return;}
  if(!attachmentStore?.put){say('حفظ المرفقات غير متاح هنا.',true);return;}
  for(const file of a)files.push({file,name:file.name,ref:null});q('[data-ff-files]').open=true;filesUI();setDirty(true);say('');
 }
 function required(msgText,el){say(msgText,true);if(el?.closest('details'))el.closest('details').open=true;el?.focus?.({preventScroll:true});throw new Error(msgText);}
 function readValue(){
  const allowBlank=missingStatus(read('verification'));if(geometry.includes(typ)&&!rawGeometry){
    const rs=[...valueHost.querySelectorAll('[data-ff-coordrow]')].map(row=>[...row.querySelectorAll('input')]);
    if(allowBlank&&rs.every(r=>r.every(e=>!e.value.trim())))return null;
    const nums=rs.map(r=>{const out=[finite(r[0].value),finite(r[1].value)];for(let j=0;j<2;j++)if(out[j]===null)required('أدخل س وص لكل نقطة، أو اختر «غير معروف».',r[j]);if(r[2].value.trim()){const h=finite(r[2].value);if(h===null)required('أدخل منسوبًا رقميًا صالحًا.',r[2]);out.push(h);}return out;});
    if(typ==='polygon'&&new Set(nums.map(r=>r[0]+':'+r[1])).size<3)required('يتطلب المضلع ثلاث نقاط أفقية مختلفة.',rs[0][0]);return JSON.stringify(nums);
  }
  if(typ==='file'){if(!files.length&&!read('source')&&!allowBlank)required('أرفق الملف أو سجّل مرجع المستند في قسم المصدر.',f('source'));return null;}
  const s=read('readingValue');if(!s){if(allowBlank)return null;required('أدخل القيمة، أو اختر «غير معروف» أو «لا ينطبق».',f('readingValue'));}
  if(typ==='number'){const n=finite(s);if(n===null)required('أدخل رقمًا صالحًا.',f('readingValue'));return n;}if(typ==='boolean')return s==='true';return s;
 }
 drawValue();filesUI();if(!record&&old.property)propose();if(files.length||typ==='file')q('[data-ff-files]').open=true;
 listen(form,'input',e=>{setDirty(true);if(['readingValue','unit','valueType','verification'].includes(e.target?.name))valueEdited=true;if(e.target.hasAttribute('data-ff-name')){const p=files[Number(e.target.dataset.ffName)];if(p)p.name=e.target.value.trim();}say('');});
 listen(form,'change',e=>{const t=e.target;
  if(t.matches('[data-ff-pick],[data-ff-camera]')){filesFrom(t.files);t.value='';return;}
  if(t.matches('[data-ff-allprops]')){if(t.value!==''){chooseProperty(suggestions[Number(t.value)]);propose();t.value='';setDirty(true);}return;}
  if(t.matches('[data-ff-pickref]')){if(t.value!==''){f('location').value=refLabels[Number(t.value)];t.value='';setDirty(true);propose();}return;}
  if(t.name==='valueType'){chooseType(t.value);lastSuggestedType='manual';if(typ==='file')q('[data-ff-files]').open=true;}
  if(t.name==='verification'){remember();drawValue();}
  if(t.name==='property'){if(suggestions.includes(t.value))chooseProperty(t.value);propose();}else if(t.name==='itemId'||t.name==='location')propose();
  setDirty(true);
 });
 listen(form,'click',async e=>{
  const b=e.target.closest('[data-ff-action]');if(!b||busy)return;const op=b.dataset.ffAction,i=Number(b.dataset.i);
  if(op==='cancel'){onCancel?.();return;}if(op==='files'||op==='camera'){q(op==='files'?'[data-ff-pick]':'[data-ff-camera]').click();return;}
  if(op==='download'){try{await attachmentStore?.download({...files[i].ref,name:files[i].name||files[i].ref.name});}catch(err){say(err.message||'تعذّر تنزيل المرفق.',true);}return;}
  if(op==='suggest'){chooseProperty(hinted[i]);propose();setDirty(true);return;}
  if(op==='add-point'||op==='drop-point'){remember();if(op==='add-point')coords.push(['','','']);else coords.splice(i,1);drawValue();setDirty(true);return;}
  if(op==='remove-file'){files.splice(i,1);filesUI();setDirty(true);}
 });
 listen(form,'submit',async e=>{
  e.preventDefault();if(busy||dead)return;let value;
  try{for(const [k,m] of [['itemId','أدخل معرّف العنصر.'],['property','اختر أو اكتب اسم الخاصية.']])if(!read(k))required(m,f(k));value=readValue();
   if(files.some(p=>!p.name.trim()))required('أدخل اسمًا لكل ملف مرفق.',q('[data-ff-name]'));
  }catch{return;}
  busy=true;form.setAttribute('aria-busy','true');const unlocked=[...form.elements].filter(el=>!el.disabled);unlocked.forEach(el=>el.disabled=true);
  const rec={...(host.querySelector('[data-shop-critical]')?.checked?{shopCritical:true}:{}),...(record?.id?{id:record.id}:{}),inputCode:entry.code,itemId:read('itemId'),property:read('property'),valueType:typ,value,
    unit:read('unit'),location:read('location'),readingRef:read('readingRef'),verification:read('verification'),source:read('source'),responsible:read('responsible'),revision:read('revision'),date:read('date'),flexibility:read('flexibility'),execution:read('execution'),notes:read('notes')};
  try{if(files.some(p=>!p.ref))say('جارٍ حفظ المرفقات…');for(const f of files){if(!f.ref)f.ref=await attachmentStore.put(f.file);if(dead)return;}
   rec.attachments=files.map(p=>({...p.ref,name:p.name.trim()}));if(dead)return;const r=await onSave(rec);
   if(dead)return;if(r?.ok===false)throw Error(r.reason||'تعذّر حفظ القراءة.');setDirty(false);say('حُفظت القراءة.');
  }catch(err){if(!dead)say(err.message||'تعذّر حفظ القراءة.',true);}
  finally{busy=false;if(!dead){unlocked.forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');}}
 });
 return {isDirty:()=>dirty||busy,destroy(){dead=true;ac.abort();removeValueFocus();}};
}
