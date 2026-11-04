import {calculateWallLighting,lightFeedAnchor,lightNumbers,lightParts,lightSections} from './kitchen-linear-light.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {assistNumber} from './kitchen-measurement-identity.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const htmlOptions=(pairs,pick)=>pairs.map(([k,label])=>'<option value="'+esc(k)+'" '+(k===pick?'selected':'')+'>'+esc(label)+'</option>').join('');
const select=(key,label,pairs,pick)=>'<label>'+label+'<select name="'+key+'">'+htmlOptions(pairs,pick)+'</select></label>';
const field=(key,label,value,numeric=false)=>'<label>'+label+'<input name="'+key+'" '+(numeric?'inputmode="decimal"':'maxlength="160"')+' value="'+esc(value)+'" required></label>';
export function mountLightKits(host,{read,update}){
 let chosen='';
 function draw(message=''){
  const c=read(),kits=c.linearKits||{},r=kits[chosen]||{};
  host.innerHTML='<h3>نظام الإنارة الخطية تحت الدواليب</h3><p>عرّف كل شريط مع قناته وغطائه وكابله ومحوّله حسب تعليمات المورد. يُسعّر كل صنف بوحدة خامه، وتدخل الوصلات بين المناطق المقطوعة ككابلات مقاسة.</p>'+
   select('which','نظام من الكتالوج',[['','تعريف نظام'],...Object.entries(kits).map(([k,v])=>[k,v.label])],chosen)+'<form><div class="kw-grid">'+
   (chosen?'<input name="key" type="hidden" value="'+esc(chosen)+'">':field('key','رمز النظام باللاتينية',''))+field('label','اسم النظام واللون أو حرارة الضوء',r.label)+field('reference','مرجع مواصفة الشريط والقطاعات',r.reference)+field('wiringRef','مرجع التوصيل والحمل والهبوط المسموح',r.wiringRef)+
   Object.entries(lightParts).map(([k,l])=>select(k,l,[['','اختر صنفًا'],...c.items.filter(i=>i.kind===(['connector','driver'].includes(k)?'piece':'bar')).map(i=>[i.sku,i.name+' · '+i.sku])],r[k])).join('')+
   Object.entries(lightNumbers).map(([k,l])=>field(k,l,r[k],true)).join('')+'</div><button>حفظ نظام الإنارة</button></form><p role="status">'+esc(message)+'</p>';
 }
 host.onchange=e=>{if(e.target.name==='which'){chosen=e.target.value;draw();}};
 host.onsubmit=e=>{e.preventDefault();e.stopPropagation();const v=Object.fromEntries(new FormData(e.target)),id=v.key;delete v.key;
  if(!chosen&&Object.hasOwn(read().linearKits||{},id)){host.querySelector('[role=status]').textContent='الرمز مستخدم.';return;}
  for(const k of Object.keys(lightNumbers))v[k]=assistNumber(v[k]);if(update(c=>{c.linearKits={...c.linearKits,[id]:v};})){chosen=id;draw('حُفظ النظام.');}else host.querySelector('[role=status]').textContent='راجع وحدات الأطوال والقدرة وأكواد الخامات.';
 };draw();
}
export function mountWallLights(host,{getDoc,wall,options,notify}){
 const cat=readWorkshopCatalog(getDoc().room.workshop)||{items:[]},book=cat.linearKits||{};
 function snap(){const d=getDoc();return {...d,room:{...d.room,workshop:{...d.room.workshop,options:{...d.room.workshop?.options,[wall]:options}}}};}
 function render(message=''){
  const v=options.linearLight,r=book[v?.recipe],d=snap(),choices=[['','لم يُحسم'],['none','دون إنارة خطية'],...Object.entries(book).map(([id,k])=>['kit:'+id,k.label+' · '+k.reference])],selected=v?.state==='factory'?'kit:'+v.recipe:v?.state||'';
  if(v?.state==='factory'&&!r)choices.push([selected,'النظام غير متاح · '+v.recipe]);
  const q=r&&calculateWallLighting(d,wall,cat),drivers=(d.room.workshop?.serviceZones?.zones||[]).filter(z=>z.wall===wall&&z.kind==='access'&&z.service==='driver');
  host.innerHTML='<h4>إنارة أسفل الصف العلوي في هذا الجدار</h4>'+select('light-system','رغبة العميل ونظام المصنع',choices,selected)+(!r?'':('<p>يحسب البرنامج طول القنوات فوق كل سطح عمل من الوحدات العلوية المرسومة عند المنسوب الأدنى. يسجّل لكل مقطع تغذية من محوّل متاح أو فرعًا من نقطة دخول مقطع سابق. كل مقطع موصول على التوازي. أطوال الأسلاك من مسارها الفعلي بالموقع.</p>'+
   (drivers.length?'':'<p>أضف حيز الوصول للمحوّل وقدرته من «الخدمات والتثبيت»، ثم اربط التغذية هنا.</p>')+
   drivers.map(z=>'<label><input type="checkbox" data-driver-existing="'+esc(z.id)+'" '+(v.existingDrivers?.includes(z.id)?'checked':'')+'> المحوّل '+esc(z.name)+' قائم أو يورّده العميل، مطابق لمواصفة الجهد والقدرة الموثقة ويُستبعد من شراء المصنع.</label>').join('')+
   q.sections.map((s,i)=>{const f=v.feeds.find(f=>f.section===s.id),prior=q.sections.slice(0,i).filter(p=>v.feeds.some(g=>g.section===p.id));
    return '<div class="ws-card" data-light-segment="'+s.id+'"><b>مقطع '+(i+1)+' · '+s.from+' إلى '+s.end+' مم · '+s.watts+' واط</b>'+
     select('driver','المحوّل المقاس',[['','اختر'],...drivers.map(z=>[z.id,z.name])],f?.driver)+select('parent','من أين يبدأ هذا الكابل؟',[['driver','من المحوّل مباشرة'],...prior.map(x=>[x.id,'من نقطة تغذية المقطع عند '+x.from+' مم'])],f?.parent||'driver')+
     field('length','طول الكابل الفعلي باتجاه واحد (مم)',f?.length,true)+field('ref','مرجع المسار المقاس',f?.ref)+'<button type="button" data-feed>تثبيت قياس هذا المسار</button></div>';}).join('')+
   q.loads.map(z=>'<p>المحوّل '+esc(z.id)+' · الشريط '+z.stripW+' واط، وفقد الكابلات '+z.lossW+' واط، وحمل آخر '+z.otherW+' واط. المتاح بعد الاحتياطي '+z.availableW+' واط.</p>').join('')+
   [...q.issues,...q.warnings].map(x=>'<p>'+esc(x)+'</p>').join('')+(v.feeds.some(f=>!q.sections.some(s=>s.id===f.section))?'<button data-remove-stale type="button">إزالة مسارات المقاطع التي تغيّر مقاسها</button>':'')))+'<p role="status">'+esc(message)+'</p>';
 }
 host.onchange=e=>{if(e.target.hasAttribute('data-driver-existing')){const v=options.linearLight,found=new Set(v.existingDrivers||[]),id=e.target.dataset.driverExisting;if(e.target.checked)found.add(id);else found.delete(id);v.existingDrivers=[...found];render('احفظ خيارات الجدار لتحديث توريد المحوّل.');return;}
  if(e.target.name!=='light-system')return;const value=e.target.value;if(!value)delete options.linearLight;else options.linearLight=value==='none'?{state:'none'}:{state:'factory',recipe:value.slice(4),feeds:[]};render('اضغط حفظ خيارات الجدار لتطبيق التغيير.');};
 host.onclick=e=>{
  if(e.target.closest('[data-remove-stale]')){const v=options.linearLight,sections=lightSections(snap(),wall,book[v.recipe],cat).sections;v.feeds=v.feeds.filter(f=>sections.some(s=>s.id===f.section));render('أعيد ضبط مسارات المقاطع المتغيرة.');return;}
  const el=e.target.closest('[data-feed]')?.closest('[data-light-segment]');if(!el)return;
  const val=k=>el.querySelector('[name="'+k+'"]').value,d=snap(),v=options.linearLight,sections=lightSections(d,wall,book[v.recipe],cat).sections;
  const seg=sections.find(s=>s.id===el.dataset.lightSegment),z=d.room.workshop?.serviceZones?.zones?.find(z=>z.id===val('driver')),parent=sections.find(s=>s.id===val('parent')),length=assistNumber(val('length')),ref=val('ref').trim();
  if(!seg||!z||length===null||length<0||length>30000||!ref||parent&&!v.feeds.some(f=>f.section===parent.id&&f.driver===z.id)){const t='أكمل المحوّل وطول المسار ومرجعه. تتشارك الوصلة والمقطع السابق المحوّل نفسه.';host.querySelector('[role=status]').textContent=t;notify?.(t);return;}
  const feed={section:seg.id,driver:z.id,parent:parent?.id||'driver',length,ref,anchor:lightFeedAnchor(d,wall,seg,z,parent)};
  v.feeds=[...v.feeds.filter(f=>f.section!==seg.id),feed];render('ثُبّت قياس المسار. احفظ خيارات الجدار.');
 };render();
}
