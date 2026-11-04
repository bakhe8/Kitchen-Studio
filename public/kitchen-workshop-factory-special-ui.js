import {factorySpecialTargets,reviewSpecial} from './kitchen-workshop-factory-special.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input=(v,key,t,max=180)=>'<label>'+t+'<input data-sp="'+key+'" maxlength="'+max+'" required value="'+esc(v)+'"></label>';
const select=(key,arr,chosen)=>'<select data-sp="'+key+'">'+arr.map(([k,l])=>'<option value="'+esc(k)+'" '+(k===chosen?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select>';
export function mountSpecialEditor(host,{doc,catalog,save,targetId}){
 let targets=factorySpecialTargets(doc).filter(t=>!t.build);if(!targets.length){host.textContent='تظهر هنا الزوايا والملحقات والتقسيمات الخاصة والوحدات المرسومة التي تحتاج وصفة مستقلة.';return;}
 let selected=targets.find(t=>t.id===targetId)||targets[0],draft=null;
 function empty(){return {label:'',sku:catalog.items[0].sku,count:1,a:null,b:null,operation:''};}
 function load(id){
  selected=targets.find(t=>t.id===id);const s=catalog.specials?.[id];draft=s?structuredClone(s):{reviewer:'',measurement:'',drawing:'',instructions:'',lines:[empty()]};render();
 }
 function render(){
  const current=catalog.specials?.[selected.id];
  const status=current?(current.signature===selected.signature?'ورقة مرتبطة بالهندسة الحالية':'تغيّرت الهندسة منذ المراجعة'):'بانتظار وصفة مهندس المصنع';
  host.innerHTML='<p>ورقة خاصة بهذا المشروع. أدخل ما تنتجه الورشة حسب الرسم المشغلي المعتمد. عند وجود وصفة ملحق تعتمد تكلفته على قطعها ويُستبعد التقدير الإجمالي لهذا الملحق.</p><label>العنصر '+select('target',targets.map(t=>[t.id,t.label]),selected.id)+'</label><p>'+esc(selected.label)+' · '+esc(status)+'</p>'+
  '<div class="kw-grid">'+input(draft.reviewer,'reviewer','اسم مراجع الورشة',85)+input(draft.measurement,'measurement','مرجع الرفع المقاس')+input(draft.drawing,'drawing','رقم رسم التفصيل وإصداره')+input(draft.instructions,'instructions','مراجع الثقوب والوصلات والحركة والتركيب',500)+'</div>'+
  (selected.hardware?'<p>أدرج عتاد الركن '+esc(selected.hardware)+' مرة في صفوف الوصفة وسجّل العدد الفعلي.</p>':'')+
  (selected.appliance?'<fieldset data-special-fit><legend>فتحة الجهاز وتعليمات تركيبه</legend>'+input(draft.fit?.model,'model','موديل الجهاز')+input(draft.fit?.manual,'manual','مرجع تعليمات المصنع والتهوية والصيانة')+
   ['width','depth','height'].map((k,i)=>input(draft.fit?.required?.[k],'required-'+k,'المطلوب من الدليل '+['عرض','عمق','ارتفاع'][i]+' (مم)')+input(draft.fit?.available?.[k],'available-'+k,'الصافي المقاس '+['عرض','عمق','ارتفاع'][i]+' (مم)')).join('')+'</fieldset>':'')+
  (selected.appliance?'<label><input type="checkbox" data-sp="bay" '+(draft.bay?'checked':'')+'> الجهاز يورده العميل، وحجز الفتحة وحده هو نطاق المصنع (لا قطع)</label>':'')+
  '<div data-sp-lines>'+(draft.bay?'':draft.lines.map((l,i)=>{const item=catalog.items.find(x=>x.sku===l.sku)||catalog.items[0];
    return '<fieldset data-line="'+i+'"><legend>قطعة '+(i+1)+'</legend><div class="kw-grid">'+input(l.label,'label','اسم القطعة',85)+'<label>الصنف'+select('sku',catalog.items.map(v=>[v.sku,v.name+' · '+v.sku]),item.sku)+'</label>'+input(l.count,'count','العدد')+(item.kind!=='piece'?input(l.a,'a','طول القطع النهائي (مم)'):'')+(item.kind==='panel'?input(l.b,'b','عرض القطع النهائي (مم)'):'')+input(l.operation,'operation','اتجاه / زاوية / تثقيب أو مرجع العملية')+'</div><button type="button" data-special-remove="'+i+'">حذف القطعة</button></fieldset>';}).join(''))+'</div><div class="kw-actions">'+(draft.bay?'':'<button type="button" data-special-add>إضافة قطعة</button>')+'<button type="button" data-special-save>حفظ ورقة المراجعة لهذا العنصر</button></div><p role="status" data-special-status></p>';
 }
 function collect(){
  const val=k=>host.querySelector('[data-sp="'+k+'"]')?.value.trim()||'';
  for(const k of ['reviewer','measurement','drawing','instructions'])draft[k]=val(k);
  if(selected.appliance){
   draft.fit={model:val('model'),manual:val('manual'),required:{},available:{}};
   for(const m of ['required','available'])for(const d of ['width','depth','height'])draft.fit[m][d]=Number(val(m+'-'+d))||null;
  }
  for(const f of host.querySelectorAll('[data-line]')){
   const l=draft.lines[Number(f.dataset.line)];
   for(const el of f.querySelectorAll('[data-sp]')){const k=el.dataset.sp;l[k]=['a','b','count'].includes(k)?(el.value.trim()?Number(el.value):null):el.value.trim();}
  }
 }
 host.onchange=e=>{
  const k=e.target.dataset.sp;if(k==='target'){load(e.target.value);return;}
  if(k==='sku'||k==='bay'){collect();if(k==='bay'){draft.bay=e.target.checked;if(draft.bay)draft.lines=[];else if(!draft.lines.length)draft.lines=[empty()];}render();}
 };
 host.onclick=e=>{
  if(e.target.hasAttribute('data-special-add')){collect();draft.lines.push(empty());render();}
  else if(e.target.hasAttribute('data-special-remove')){collect();draft.lines.splice(Number(e.target.dataset.specialRemove),1);render();}
  else if(e.target.hasAttribute('data-special-save')){
   collect();const reviewed=reviewSpecial(selected,draft,catalog.items);
   const result=reviewed&&save(selected.id,reviewed);
   host.querySelector('[data-special-status]').textContent=result?'حُفظت الورقة. اعتمد إصدار الكتالوج بعد مراجعة القطع.':'أكمل مرجع الرفع والرسم والمراجع وأبعاد كل قطعة موجبة ووحدة صحيحة، وراجع فتحات الجهاز إن وجدت.';
   if(result)catalog.specials={...catalog.specials,[selected.id]:reviewed};
  }
 };
 load(selected.id);
}
