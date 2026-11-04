import {surfacePlan} from './kitchen-site-diagrams.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {cleanMeasuredSurfaces,evaluateSurveyedSurfaces} from './kitchen-surveyed-surfaces.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={floor:'الأرضية النهائية',plinth:'أعلى العتبة / التعلية',ceiling:'أسفل السقف أو الهبوط'};
const field=(key,label,number=false)=>'<label>'+label+'<input name="'+key+'" '+(number?'type="number" step="any" min="0"':'maxlength="180"')+'></label>';
const table=(key,title,hint)=>'<label>'+title+'<textarea dir="ltr" rows="3" name="'+key+'" placeholder="'+hint+'"></textarea></label>';
const parseRows=s=>s.trim().split(/\n+/).map(line=>line.trim().split(/[\s,،]+/).map(v=>assistNumber(v)??NaN));
const num=(f,k)=>assistNumber(f.get(k))??NaN;
const id=()=>'patch-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const getFormValue=(form,name,value)=>{const el=form.elements.namedItem(name);if(el)el.value=value??'';};
export function mountMeasuredSurfaces(host,{getDoc,apply,tell,focus={}}){
 const ctrl=new AbortController(),signal=ctrl.signal;
 const state=()=>getDoc().room.workshop?.surfaces3d||{patches:[],checks:[]};
 let patchId=focus.patchId||null,targetId=focus.unitId||null;
 function draw(){
  const d=getDoc(),s=state(),p=s.patches.find(x=>x.id===patchId),r=evaluateSurveyedSurfaces(d);
  const ids=[...d.kitchen.units.map(u=>u.id),...Object.entries(d.room.workshop?.corners||{}).flatMap(([k,c])=>(c.tall?['tall']:['base','upper'].filter(t=>c[t])).map(t=>'corner:'+k+':'+t))];
  targetId=ids.includes(targetId)?targetId:ids[0];const check=s.checks.find(c=>c.target===targetId);
  // Register numbers and map labels use the same stable ordering.
  const register=s.patches.map((v,i)=>'<button type="button" data-edit-patch="'+esc(v.id)+'" aria-pressed="'+(p?.id===v.id)+'"><b>'+new Intl.NumberFormat('ar-SA').format(i+1)+'</b> '+esc(kinds[v.kind])+' · '+esc(v.reference)+'</button>').join('');
  host.innerHTML='<h3>خريطة مناسيب الأرضية والتعلية والسقف</h3><p>ارفع ثلاث نقاط لكل سطح مستوٍ بالنسبة إلى أصل المسقط وصفر التشطيب. قسّم المنطقة عند حافة الدرجة أو تغيّر الميل. المناطق غير المقاسة تبقى مجهولة.</p>'+
   '<div class="site-surface-bench"><section class="site-plan-sheet"><h3>مواقع نقاط الرفع</h3>'+surfacePlan(d.room,s.patches,patchId)+(register?'<div class="site-patch-register">'+register+'</div>':'<p>لا توجد مثلثات رفع مسجلة.</p>')+'</section>'+
   '<form data-patch class="ws-card"><h3>'+(p?'تعديل مثلث الرفع':'مثلث رفع جديد')+'</h3><label>سطح القراءة<select name="kind">'+Object.entries(kinds).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+
   table('xyz','إحداثيات المثلث بالملليمتر. كل سطر س، ص في المسقط، ثم المنسوب الرأسي','0 0 0&#10;1000 0 5&#10;0 1000 10')+field('reference','مرجع قراءة المنسوب وتاريخه')+field('error','حد خطأ المنسوب ± مم',true)+'<button>'+(p?'حفظ تعديل المثلث':'إضافة مثلث الرفع')+'</button>'+(p?' <button type="button" data-delete-patch="'+esc(p.id)+'">إزالة المثلث</button> <button type="button" data-new-patch>مثلث جديد</button>':'')+'</form></div>'+
   (ids.length?'<form data-check class="ws-card"><label>الوحدة أو الركن<select name="target">'+ids.map(v=>'<option value="'+esc(v)+'" '+(v===targetId?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'+field('reference','مرجع فحص الوحدة / رسم المورد')+
   field('clearance','خلوص السقف المطلوب · مم (اختياري)',true)+'<details '+(check?.support?'open':'')+'><summary>مساحات ارتكاز الوحدة الأرضية</summary><p>اكتب موضع بداية كل قاعدة على محور الوحدة، ثم بعدها عن الظهر وعرضها وعمقها. البرنامج يحوّل النقاط مع دوران الجزيرة.</p>'+
   table('pads','قاعدة لكل سطر. الإحداثيات والأبعاد بالملليمتر','20 30 40 40')+field('mount','ارتفاع تثبيت الرجل فوق أسفل جسم CAD · مم',true)+field('min','أدنى طول للرجل · مم',true)+field('max','أقصى طول للرجل · مم',true)+field('delta','أقصى تفاوت منسوب تحت القاعدة حسب المورد · مم',true)+'</details><button>حفظ الفحص وإعادة الحساب</button>'+(check?' <button type="button" data-delete-check>إزالة فحص الوحدة</button>':'')+'</form>':'')+
   (r.issues.length?'<ul>'+r.issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
   r.results.map(v=>'<p>'+esc(v.target)+' · '+v.pads.map(p=>'الرجل '+p.index+' من '+(Math.floor(p.minLegMm*10)/10)+' إلى '+(Math.ceil(p.maxLegMm*10)/10)+' مم').join('، ')+'</p>').join('');
  const form=host.querySelector('[data-patch]');if(!p&&Object.hasOwn(kinds,focus.kind))getFormValue(form,'kind',focus.kind);
  if(p){for(const [k,v] of Object.entries({kind:p.kind,reference:p.reference,error:p.errorMm,xyz:p.triangle.map(t=>t.join(' ')).join('\n')}))getFormValue(form,k,v);}
  const cf=host.querySelector('[data-check]');if(check&&cf){const f=check.support;for(const [k,v] of Object.entries({reference:check.reference,clearance:check.clearanceMm,pads:f?.pads.map(t=>t.join(' ')).join('\n'),mount:f?.mountMm,min:f?.minLegMm,max:f?.maxLegMm,delta:f?.maxPadDeltaMm}))getFormValue(cf,k,v);}
 }
 function save(next){const s=cleanMeasuredSurfaces(next);if(!s){tell('راجع عدد النقاط والأبعاد والمرجع. أدخل صفرًا صراحةً عند انطباقه.');return;}const d=getDoc(),r=apply({...d,room:{...d.room,workshop:{...d.room.workshop,surfaces3d:s}}},'حُفظ الرفع وحُسبت المناسيب على مسقط الوحدة الحالي.');if(r?.ok!==false){patchId=null;draw();}}
 function editPatch(id){if(!state().patches.some(v=>v.id===id))return;patchId=id;draw();host.querySelector('[data-patch] select')?.focus();}
 host.addEventListener('keydown',e=>{const t=e.target.closest?.('[data-map-patch]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();editPatch(t.dataset.mapPatch);}},{signal});
 host.addEventListener('click',e=>{const map=e.target.closest('[data-map-patch]');if(map){editPatch(map.dataset.mapPatch);return;}const el=e.target.closest('button'),s=state();if(!el)return;if(el.hasAttribute('data-new-patch')){patchId=null;draw();host.querySelector('[data-patch] select')?.focus();return;}if(el.dataset.editPatch){editPatch(el.dataset.editPatch);}if(el.dataset.deletePatch)save({...s,patches:s.patches.filter(p=>p.id!==el.dataset.deletePatch)});if(el.hasAttribute('data-delete-check'))save({...s,checks:s.checks.filter(c=>c.target!==targetId)});},{signal});
 host.addEventListener('change',e=>{if(e.target.name==='target'){targetId=e.target.value;draw();}},{signal});
 host.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const f=new FormData(e.target),s=state(),reference=String(f.get('reference')||'').trim();
  if(e.target.hasAttribute('data-patch')){const p={id:patchId||id(),kind:f.get('kind'),reference,errorMm:num(f,'error'),triangle:parseRows(f.get('xyz')||'')};save({...s,patches:[...s.patches.filter(v=>v.id!==p.id),p]});}
  else{const pads=f.get('pads')?.trim(),c={target:targetId,reference,...(f.get('clearance')?.trim()?{clearanceMm:num(f,'clearance')}:{}),...(pads?{support:{pads:parseRows(pads),mountMm:num(f,'mount'),minLegMm:num(f,'min'),maxLegMm:num(f,'max'),maxPadDeltaMm:num(f,'delta')}}:{})};save({...s,checks:[...s.checks.filter(v=>v.target!==targetId),c]});}
 },{signal});draw();return ()=>ctrl.abort();
}
