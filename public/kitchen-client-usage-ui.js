import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {mountDrawerPack} from './kitchen-drawer-pack-ui.js';
import {cleanClientUsage,evaluateClientUsage,purposes} from './kitchen-client-usage.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {kitchenUnitSpecs} from './kitchen-model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sel=(key,label,options,current)=>'<label>'+esc(label)+'<select name="'+key+'">'+options.map(([v,t])=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
const inp=(key,label,value,numeric=false)=>'<label>'+esc(label)+'<input name="'+key+'" value="'+esc(value)+'" '+(numeric?'type="number" step="any" min="0"':'maxlength="160"')+'></label>';
const toggle=(key,label,child,open)=>'<details '+(open?'open':'')+'><summary>'+esc(label)+'</summary><label><input type="checkbox" name="'+key+'" '+(open?'checked':'')+'> إدخال هذه المتطلبات</label>'+child+'</details>';
const useIcons={storage:'box',prep:'drawing',waste:'trash',seat:'room',activity:'settings'};
const purposeChoices=current=>'<fieldset class="dp-purposes"><legend>الاستخدام</legend>'+Object.entries(purposes).map(([key,label])=>'<label><input type="radio" name="purpose" value="'+key+'" '+(key===(current||'storage')?'checked':'')+'>'+studioIcon(useIcons[key])+'<span>'+esc(label)+'</span></label>').join('')+'</fieldset>';
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
export function mountClientUsage(host,{getDoc,apply,tell,onAdvance,focus={},scoped=false,families={}}){
 const ac=new AbortController();let editing=null,closePack=null;
 const data=()=>getDoc().room.workshop?.clientUsage||{tasks:[]};
 if(focus.taskId)editing=data().tasks.find(t=>t.id===focus.taskId&&t.unitId===focus.unitId)?.id||null;
 function draw(){
  const doc=getDoc(),tasks=data().tasks,t=tasks.find(q=>q.id===editing)||{},res=evaluateClientUsage(doc),labels=scoped?families:getFactoryCatalog(doc).families;
  const links=doc.kitchen.units.map((u,i)=>{
   const r=doc.kitchen.runs.find(r=>r.id===u.runId),recipe=doc.room.workshop?.rows?.[u.runId]?.units?.find(item=>item.id===u.id);
   const name=recipe?.use||labels?.[recipe?.recipeId||recipe?.family]?.label||kitchenUnitSpecs[u.kind]?.label||u.kind;
   return [u.id,'U'+(i+1)+' · '+name+' · '+(r?.wall?architectureWallLabel(r.wall):'جزيرة')+' · '+(r?.tier==='upper'?'علوي':'سفلي')];
  });
  let html='<h2>كيف يستخدم العميل مطبخه؟</h2><p>يربط المندوب غرضًا أو نشاطًا بالوحدة التي اختارها العميل. يختار أدناه ما يحتاج إلى قياس فقط. المقاسات بالملليمتر والتكرار في اليوم.</p>';
  html+='<div class="dp-usage-work">';
  if(links.length)html+='<form class="ws-card" data-usage><h3>'+((t.id)?'تعديل نشاط العميل':'إضافة نشاط')+'</h3>'+inp('name','ماذا يريد العميل؟',t.name)+sel('unitId','الوحدة المقصودة',links,t.unitId||focus.unitId)+purposeChoices(t.purpose)+inp('frequency','تكرار الاستخدام في اليوم، اختياري',t.frequency,true)+
   toggle('reachable','مجال وصول يختاره العميل',inp('low','أدنى ارتفاع مريح من الأرض',t.reach?.low,true)+inp('high','أقصى ارتفاع مريح',t.reach?.high,true)+inp('relative','ارتفاع نقطة تناول الغرض من أسفل جسم الوحدة',t.reach?.relative,true),t.reach)+
   toggle('itemFit','قياس الغرض والحيز الداخلي',[['item','قياس الغرض'],['clear','الحيز الصافي الفعلي']].map(([p,l])=>'<h4>'+l+'</h4>'+[['w','العرض'],['d','العمق'],['h','الارتفاع']].map(([k,n])=>inp(p+k,n,t.fit?.[p]?.[k],true)).join('')).join('')+'<label><input type="checkbox" name="rotate" '+(t.fit?.rotate?'checked':'')+'> يسمح العميل بتدوير الغرض أفقيًا</label>'+inp('fitRef','مرجع قياس الحيز',t.fit?.ref),t.fit)+
   toggle('space','حيز التحضير أو الجلوس أو الفرز أمام الواجهة',inp('aw','العرض المستخدم أمام مركز الوحدة',t.area?.w,true)+inp('ad','العمق المطلوب أمام الواجهة',t.area?.d,true)+inp('ah','الارتفاع الحر المطلوب من الأرض',t.area?.h,true)+inp('areaRef','مرجع قياس مساحة الاستخدام',t.area?.ref),t.area)+
   toggle('walking','مسار مشي إلى وحدة أخرى',sel('to','الوحدة التالية في النشاط',[['','اختر وحدة'],...links],t.route?.to)+inp('walkWidth','عرض المرور الذي يطلبه العميل',t.route?.width,true)+inp('walkHeight','ارتفاع المرور المطلوب',t.route?.height,true),t.route)+
   '<details><summary>قرار العميل في تفضيل الوصول أو الرحلة</summary>'+inp('accepted','سبب قبوله اختلاف تفضيله، اختياري',t.accepted)+'</details><button class="ws-action" type="submit">حفظ ومقارنة النتيجة</button>'+((editing)?' <button type="button" data-use-new>نشاط جديد</button>':'')+'</form>';
  else html+='<section class="ws-card dp-empty"><b>اختر وحدات المطبخ أولًا</b><p>بعد توزيع الوحدات يمكنك ربط غرض العميل بالدرج أو الدولاب الذي يختاره.</p>'+(onAdvance?'<button type="button" data-use-plan>فتح تصميم المطبخ</button>':'')+'</section>';
  html+='<div class="dp-usage-results">';
  if(tasks.length)html+='<section class="ws-card"><h3>الاستخدامات الحالية</h3>'+tasks.map(a=>'<p><b>'+esc(a.name)+'</b> · '+esc(purposes[a.purpose])+' · '+esc(links.find(([id])=>id===a.unitId)?.[1]||a.unitId)+' <button type="button" data-use-edit="'+a.id+'">تعديل</button> <button type="button" data-use-delete="'+a.id+'">إزالة</button></p>').join('')+'</section>';
  if(res.items.length)html+='<section class="ws-card"><h3>نتيجة التوزيع الحالي</h3>'+res.items.map(i=>'<article><b>'+esc(i.name)+'</b><p>'+[i.reachMm!=null?'ارتفاع التناول '+fmt(i.reachMm)+' مم':'',i.distanceMm!=null?'مسار ذهاب '+fmt(i.distanceMm/1000)+' م':'',i.dailyMm!=null?'مسافة يومية '+fmt(i.dailyMm/1000)+' م':''].filter(Boolean).join(' · ')+'</p>'+[...i.hard,...i.soft].map(a=>'<p>'+esc(a)+'</p>').join('')+(i.accepted?'<p>قرار العميل المسجّل '+esc(i.accepted)+'</p>':'')+'</article>').join('')+
   (res.hasRoutes?'<p><b>مجموع المسافة اليومية المحسوبة '+fmt(res.dailyMm/1000)+' م</b>'+(res.pending.length?' · بعض الرحلات لم تدخل المجموع':'')+'</p><small>يُحسب المرور بين منتصف واجهتَي الوحدتين بأبواب مغلقة. المسار المباشر يُفحص أولًا، ثم شبكة نقاط ٢٠٠ مم عند وجود عائق. عدم إيجاد مسار يستدعي مراجعة الرسم، ولا يثبت استحالة الحركة.</small>':'')+'</section>';
  closePack?.();host.innerHTML=html+(scoped?'<section class="ws-card"><h3>أغراض الأدراج والسكك</h3><p>سجّل الأغراض وإذن التوزيع وراجع الملاءمة في أدوات التقسيم والأدراج.</p><button type="button" data-use-drawers>فتح أدوات التقسيم والأدراج</button></section>':'<div data-drawer-pack></div>')+'</div></div>';
  if(!scoped)closePack=mountDrawerPack(host.querySelector('[data-drawer-pack]'),{getDoc,apply,tell});
 }
 function commit(tasks,msg){const doc=getDoc(),v=cleanClientUsage(scoped?{tasks}:{...data(),tasks});if(!v){tell('أكمل القياسات داخل الخيارات التي فعّلتها، وراجع حدود الأبعاد ووحدة الوصول.');return false;}if(scoped&&data().pack)v.pack=structuredClone(data().pack);
  const r=apply({...doc,room:{...doc.room,workshop:{...doc.room.workshop,clientUsage:v}}},msg);return r?.ok!==false;
 }
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-use-plan')){onAdvance?.('whole');return;}
  if(b.hasAttribute('data-use-drawers')){onAdvance?.('workbench');return;}
  if(b.dataset.useEdit){editing=b.dataset.useEdit;draw();}
  if(b.hasAttribute('data-use-new')){editing=null;draw();}
  if(b.dataset.useDelete&&commit(data().tasks.filter(a=>a.id!==b.dataset.useDelete),'أُزيل النشاط.')){editing=null;draw();}
 },{signal:ac.signal});
 host.addEventListener('submit',e=>{if(!e.target.matches('[data-usage]'))return;e.preventDefault();const f=e.target.elements,s=k=>f[k].value.trim(),n=k=>s(k)===''?null:Number(s(k)),b=k=>f[k].checked;
  const t={id:editing||'use-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),unitId:s('unitId'),purpose:s('purpose'),name:s('name')};
  if(n('frequency')!==null)t.frequency=n('frequency');if(s('accepted'))t.accepted=s('accepted');
  if(b('reachable'))t.reach={low:n('low'),high:n('high'),relative:n('relative')};
  if(b('itemFit')){const read=p=>Object.fromEntries(['w','d','h'].map(k=>[k,n(p+k)]));t.fit={item:read('item'),clear:read('clear'),rotate:b('rotate'),ref:s('fitRef')};}
  if(b('space'))t.area={w:n('aw'),d:n('ad'),h:n('ah'),ref:s('areaRef')};
  if(b('walking'))t.route={to:s('to'),width:n('walkWidth'),height:n('walkHeight')};
  if(commit([...data().tasks.filter(x=>x.id!==t.id),t],'حُفظ استخدام العميل وحُسب أثره على التوزيع.')){editing=t.id;draw();}
 },{signal:ac.signal});
 draw();return ()=>{closePack?.();ac.abort();};
}
