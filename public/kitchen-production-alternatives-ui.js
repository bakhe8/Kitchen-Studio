import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {pantryContext} from './kitchen-pantry-brief.js';
import {cleanLayoutBrief,priorityLabels} from './kitchen-layout-brief.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {compareKitchenLayouts} from './kitchen-production-alternatives.js';
import {rowLabels} from './kitchen-production-row.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v);
export function mountPlanAlternatives(host,{getDoc,apply,tell,refresh}){
 const listen=new AbortController(),signal=listen.signal,doc=getDoc(),walls=surveyedDesignWalls(doc);let epoch=0,result=null;
 const pantry=pantryContext(doc),prior=doc.room.workshop?.layoutBrief,records=(doc.room.fieldRegister?.records||[]).filter(r=>r.inputCode==='PRJ-05'&&r.property==='الحد الأعلى للميزانية'&&r.valueType==='number'&&r.unit==='ريال'&&!['unknown','conflict','na'].includes(r.verification)&&r.execution!=='excluded');
 const historical=records.length===1?records[0].value:null;
 const weights=Object.entries(priorityLabels).map(([k,l])=>'<label>'+l+' (٠ إلى ٥)<input name="p-'+k+'" type="number" min="0" max="5" value="'+(prior?.weights[k]??(k==='contract'?3:k==='storage'?2:0))+'"></label>').join('');
 const briefForm='<details class="ws-card" '+(prior?'open':'')+'><summary>ميزانية العميل وأولوياته</summary><label><input type="checkbox" name="brief" '+(prior?'checked':'')+'> استخدام تفضيلات العميل في بحث التوزيع</label><label>مرجع الاتفاق مع العميل<input name="ref" maxlength="160" value="'+esc(prior?.reference)+'"></label><label>الميزانية<select name="budgetMode">'+[['none','دون سقف'],['fixed','سقف ملزم'],['preferred','هدف مفضل']].map(([v,l])=>'<option value="'+v+'" '+(v===prior?.mode?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>السقف الكامل بالريال<input inputmode="decimal" name="cap" value="'+esc(prior?.capSar??historical)+'"></label><label>إجمالي ما يُحتسب خارج عرض المصنع شاملًا الضريبة، صفر عند عدم وجوده<input inputmode="decimal" name="extra" value="'+esc(prior?.extraSar)+'"></label><label>البنود التي يشملها المبلغ ومرجع أي تكاليف خارجية<input name="scope" maxlength="240" value="'+esc(prior?.scope)+'"></label>'+weights+'<p>يختبر البرنامج تقسيمات تخزين مختلفة ضمن مقاسات المصنع ومواقع الوظائف المطلوبة. تظل الوحدات المثبتة في موضعها. عند الترتيب تُقارن القيم ضمن البدائل المختبرة، ويتطلب حساب المحاذاة صفًا علويًا قائمًا.</p><button type="button" data-brief-save>حفظ أو تحديث اتفاق الميزانية للمشروع</button>'+(prior?'<button type="button" data-brief-remove>فصل اتفاق الميزانية عن المشروع</button>':'')+'</details>';
 function formBrief(f){
  if(!f.has('brief'))return null;
  const read=k=>assistNumber(f.get(k));
  const out=cleanLayoutBrief({mode:f.get('budgetMode'),reference:f.get('ref'),capSar:read('cap'),extraSar:read('extra'),scope:f.get('scope'),weights:Object.fromEntries(Object.keys(priorityLabels).map(k=>[k,read('p-'+k)]))});
  if(!out)throw Error('أكمل مرجع الاتفاق والأوزان، وعند تحديد سقف أدخل المبلغ والبنود المطابقة وتكلفة ما يخرج عن عرض المصنع.');return out;
 }
 host.innerHTML='<h3>مقارنة توزيع الاستخدامات بين الجدران</h3><p>اختر حتى أربعة جدران لها رفع. يجرّب البرنامج إسناد الوظائف المطلوبة إلى صفوفها السفلية، مع إبقاء الأجهزة الموجودة والتخصيصات السابقة. تُعرض ثلاثة بدائل كحد أقصى من البحث.</p>'+
 (walls.length?'<form><fieldset><legend>الجدران المشاركة</legend>'+walls.map((w,i)=>'<label><input type="checkbox" name="wall" value="'+esc(w)+'" '+(i<2?'checked':'')+'> '+esc(architectureWallLabel(w))+'</label>').join('')+'</fieldset><fieldset><legend>وظائف مطلوبة في المطبخ</legend>'+['sink','dishwasher','rice'].map(k=>'<label><input type="checkbox" name="'+k+'" '+(k!=='rice'||pantry.wanted?'checked':'')+'> '+esc(rowLabels[k])+'</label>').join('')+'</fieldset><p>'+esc(pantry.note)+'</p><label>ترتيب المقارنة<select name="priority"><option value="distance">قرب غسالة الصحون من المجلى</option><option value="cuts">تقليل عدد قطع الخام</option><option value="storage">زيادة عرض التخزين العام</option><option value="usage">استخدام العميل بين البدائل الثلاثة المعروضة</option><option value="price">الأقل قيمة خامات عند اكتمال التسعير</option></select></label><label><input type="checkbox" name="provisional"> عرض اقتراح مبدئي عندما لم تُحسم خدمات المجلى</label>'+briefForm+'<button type="submit">حساب بدائل الجدران</button></form>':'<p>أضف جدران المطبخ من «رفع الجدار» أولًا.</p>')+'<div data-alternatives aria-live="polite"></div>';
 const out=host.querySelector('[data-alternatives]');
 host.addEventListener('input',()=>{epoch++;result=null;out.textContent='';},{signal});
 host.addEventListener('submit',async e=>{
  e.preventDefault();e.stopPropagation();const f=new FormData(e.target),selected=f.getAll('wall'),ticket=++epoch;result=null;
  if(!selected.length||selected.length>4){out.textContent='اختر من جدار إلى أربعة.';return;}
  let brief;try{brief=formBrief(f);}catch(err){out.textContent=err.message;return;}
  if(prior&&!brief){out.textContent='يوجد اتفاق محفوظ. فصله يحتاج اختيار «فصل اتفاق الميزانية عن المشروع».';return;}
  const options={brief,walls:selected,pantryId:pantry.req?.confirmed&&pantry.req.choice!=='none'?pantry.req.id:null,riceMode:pantry.req?.mode||'unknown',wanted:Object.fromEntries(['sink','dishwasher','rice'].map(k=>[k,f.has(k)])),preference:f.get('priority'),allowProvisional:f.has('provisional')};
  out.textContent='جارٍ اختبار المقاسات وتغطية الخدمات على الجدران المختارة…';
  try{
   const res=await compareKitchenLayouts(doc,options,()=>new Promise(resolve=>setTimeout(resolve,0)),()=>epoch!==ticket||getDoc()!==doc);
   if(res.cancelled||epoch!==ticket)return;result=res;
   out.innerHTML='<p>جُرّبت '+fmt(res.tried)+' توزيعات'+(res.truncated?' ضمن حد البحث':'')+'.'+(res.candidates.length?'':' لا توجد تعبئة كاملة صالحة للاختيارات.')+'</p>'+
    res.candidates.map((c,i)=>'<article class="ws-card"><b>البديل '+fmt(i+1)+'</b>'+c.summary.map(s=>'<p>'+esc(architectureWallLabel(s.wall))+' · '+s.units.map(u=>esc(rowLabels[u.family])+' '+fmt(u.widthMm)).join('، ')+' مم</p>').join('')+
    '<p>تخزين عام '+fmt(c.storageWidthMm)+' مم · '+fmt(c.cuts)+' قطعة خام · قيمة خامات الصفوف '+(c.price==null?'غير مكتملة':fmt(c.price)+' ر.س')+'</p>'+
    (c.budget?'<p>إجمالي المقارنة '+(c.budget.total==null?'غير مكتمل':fmt(c.budget.total)+' ر.س')+(c.budget.margin!=null?' · '+(c.budget.margin>=0?'المتبقي من الميزانية ':'فوق الميزانية ')+fmt(Math.abs(c.budget.margin))+' ر.س':'')+'</p><p>درجة الأولويات '+(c.rankScore==null?'غير قابلة للحساب':fmt(c.rankScore)+' من ١٠٠')+' · '+Object.entries(c.rankScores||{}).map(([k,n])=>esc(priorityLabels[k])+' '+(n==null?'غير معروف':fmt(n))).join('، ')+(c.alignmentMm!=null?' · متوسط فرق الفواصل '+fmt(c.alignmentMm)+' مم':'')+'</p>':'')+
    (c.usage?'<p>استخدام العميل · المسافة اليومية '+(c.usage.dailyMm==null?'غير محسومة':fmt(c.usage.dailyMm/1000)+' م')+' · تفضيلات تستحق مراجعة '+fmt(c.usage.soft)+'</p>':'')+
    (c.provisional?'<p>المجلى ينتظر تحقق الماء والصرف.</p>':'')+'<button type="button" data-use-candidate="'+i+'">تطبيق هذا البديل على الرسم</button></article>').join('')+
    (!res.candidates.length?res.reasons.slice(0,4).map(s=>'<p>'+esc(s)+'</p>').join(''):'');
  }catch(error){out.textContent='تعذرت المقارنة. '+error.message;}
 },{signal});
 host.addEventListener('click',e=>{
  if(e.target.closest('[data-brief-save],[data-brief-remove]')){
   if(getDoc()!==doc){tell('تغيّر المشروع. أعد فتح المقارنة.');return;}
   try{const w={...doc.room.workshop};if(e.target.closest('[data-brief-remove]'))delete w.layoutBrief;
    else{const b=formBrief(new FormData(host.querySelector('form')));if(!b)throw Error('فعّل تفضيلات العميل أولًا.');w.layoutBrief=b;}
    const saved=apply({...doc,room:{...doc.room,workshop:w}},'تم تحديث اتفاق الميزانية.');if(saved?.ok!==false)refresh();else tell(saved.reason);
   }catch(err){tell(err.message);}return;
  }
  const b=e.target.closest('[data-use-candidate]');if(!b||!result)return;
  if(getDoc()!==doc){tell('تغيّر الرسم منذ المقارنة. احسب البدائل من النسخة الجديدة.');return;}
  const candidate=result.candidates[Number(b.dataset.useCandidate)];if(!candidate)return;
  const saved=apply(candidate.doc,'طُبّق التوزيع على الجدران في عملية واحدة.');if(saved?.ok!==false)refresh();else tell(saved.reason);
 },{signal});
 return ()=>{epoch++;listen.abort();};
}
