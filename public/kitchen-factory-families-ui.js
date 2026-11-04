import {baseFactoryKinds,validCadChoices,isCustomFamily,materialTerms,ruleMetrics} from './kitchen-factory-families.js';
import {kitchenUnitSpecs} from './kitchen-catalog.js';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(title,html)=>'<label class="kw-field"><span>'+e(title)+'</span>'+html+'</label>';
const input=(name,title,value,more='')=>label(title,'<input name="'+name+'" value="'+e(value)+'" '+more+'>');
const n=(name,title,value,more='')=>input(name,title,value,'type="number" step="any" '+more);
const opts=(values,selected)=>values.map(([id,t])=>'<option value="'+e(id)+'" '+(id===selected?'selected':'')+'>'+e(t)+'</option>').join('');
const sel=(name,title,options,value)=>label(title,'<select name="'+name+'">'+opts(options,value)+'</select>');
const val=(f,k)=>f.elements[k]?.value?.trim()||'';
const num=(f,k)=>val(f,k)===''?null:Number(val(f,k));
export function mountFamilyDesigner(host,{catalog:c,family,editLine,save,selectFamily,refresh,notice}){
 const f=c.families[family],base=f.base||family,stock=c.items.filter(i=>i.kind!=='piece'),panels=c.items.filter(i=>i.role==='front');
 const line=f.recipe[editLine],material=line&&c.items.find(i=>i.sku===line.sku);
 const lineId=Math.min(editLine,f.recipe.length-1);
 const bases=Object.keys(baseFactoryKinds).map(k=>[k,c.families[k].label]);
 const defaultKind=baseFactoryKinds[base];
 const bounds=(names,lo,hi,step)=>n(names[0],lo+' (مم)',f[names[0]],'min="1" max="12000"')+n(names[1],hi+' (مم)',f[names[1]],'min="1" max="12000"')+n(names[2],step+' (مم)',f[names[2]],'min="1" max="12000"');
 host.innerHTML='<details><summary>تعريف عائلة مصنع قابلة لإعادة الاستخدام</summary><p>تبدأ العائلة بنسخة من وصفة الأساس. عدّل خطوط القطع والعتاد ثم اختر العائلة للوحدة في محرر الصف.</p><form data-ff="create"><div class="kw-grid">'+
  input('id','رمز إنجليزي فريد للعائلة','', 'required pattern="[a-z0-9][a-z0-9-]{0,38}" placeholder="pantry-wide" dir="ltr"')+
  input('name','اسم العائلة للمندوب','', 'required maxlength="84"')+sel('base','وظيفة الأساس',bases,base)+input('ref','مرجع الرسم التجميعي أو كتالوج الورشة','', 'required maxlength="180"')+'</div><button>إنشاء العائلة</button></form></details>'+
  '<details><summary>مواصفات العائلة وتوافق الواجهة</summary><form data-ff="properties"><div class="kw-grid">'+
  (isCustomFamily(family)?input('familyLabel','اسم العائلة',f.label,'required maxlength="84"')+input('reference','مرجع التجميع',f.reference,'required maxlength="180"')+
  sel('cadKind','نموذج الوحدة في الرسم',validCadChoices(base).map(k=>[k,kitchenUnitSpecs[k].label]),f.cadKind||defaultKind)+
  label('فتحة جهاز يورده العميل','<input name="customerBay" type="checkbox" '+(f.customerBay?'checked':'')+'>'):'')+
  bounds(['minHeightMm','maxHeightMm','heightStepMm'],'أدنى ارتفاع','أقصى ارتفاع','خطوة الارتفاع')+bounds(['minDepthMm','maxDepthMm','depthStepMm'],'أدنى عمق','أقصى عمق','خطوة العمق')+
  '</div><small>لاستعمال ارتفاع أو عمق ثابت، أدخل القيمة نفسها حدًا أدنى وأقصى وخطوة ١ مم. ترك الثلاثة فارغة يبقي قيود نموذج الرسم.</small>'+
  '<fieldset><legend>ألواح الواجهة المتوافقة مع هذا القطاع</legend><small>عند تحديد أي صنف، تُقبل الأصناف المحددة فقط.</small>'+panels.map(i=>'<label><input type="checkbox" name="face" value="'+e(i.sku)+'" '+(f.frontSkus?.includes(i.sku)?'checked':'')+'> '+e(i.name+' · '+i.sku)+'</label>').join('')+'</fieldset>'+
  '<fieldset><legend>احتساب وزن كل درفة عند اختيار مفصلات بحسب الحمولة</legend><p>يجمع وزن حشوات الوجه المقطوعة مع وزن إطار الدرفة ومكوّناتها. يلزم وزن المتر المربع في أصناف الألواح المستخدمة.</p><div class="kw-grid">'+
  n('frameKgM','وزن إطار متر الحافة (كجم/م)',f.frontMassModel?.frameKgM,'min="0"')+n('extraKg','وزن الملحقات الإضافية لكل درفة (كجم)',f.frontMassModel?.extraKg,'min="0"')+input('weightSource','مرجع احتساب الوزن',f.frontMassModel?.reference,'maxlength="180"')+'</div></fieldset><button>حفظ مواصفات العائلة</button></form></details>'+
  (line?'<details><summary>معادلة القطعة وزواياها أو شرط اختيار عتادها · '+e(line.label)+'</summary><form data-ff="engineering"></form></details>':'');
 const form=host.querySelector('[data-ff=engineering]'),draft={termsA:line?.termsA?.map(t=>({...t}))||[],termsB:line?.termsB?.map(t=>({...t}))||[]};
 const boundsSelect=Object.entries(materialTerms),stocks=stock.map(i=>[i.sku,i.name+' · '+i.sku]);
 function terms(type,title){
  return '<fieldset><legend>'+title+'</legend><p>تضاف هذه الحدود إلى البعد والفرق الثابت في الوصفة. ضع المعامل −٢ لطرح قطاعين، أو +٢ لإضافة عمق أخدودين.</p><div data-terms="'+type+'"></div><button type="button" data-add-term="'+type+'">إضافة حد من مقاس خام</button></fieldset>';
 }
 function termList(type){
  const container=form.querySelector('[data-terms="'+type+'"]');if(!container)return;
  container.innerHTML=draft[type].map((t,i)=>'<div class="kw-grid" data-term-index="'+i+'">'+sel('tSku','الصنف المرجعي',stocks,t.sku)+sel('tKey','المقاس المأخوذ منه',boundsSelect,t.dimension)+n('tFactor','معامل الضرب',t.factor,'min="-32" max="32" required')+'<button type="button" data-dt="'+i+'">إزالة الحد</button></div>').join('');
 }
 function syncTerms(){
  for(const box of form.querySelectorAll('[data-terms]'))draft[box.dataset.terms]=[...box.querySelectorAll('[data-term-index]')].map(x=>({sku:x.querySelector('[name=tSku]').value,dimension:x.querySelector('[name=tKey]').value,factor:x.querySelector('[name=tFactor]').value===''?null:Number(x.querySelector('[name=tFactor]').value)}));
 }
 if(form){
  if(material.kind!=='piece'){
   form.innerHTML=terms('termsA','مصادر طول القطعة')+(material.kind==='panel'?terms('termsB','مصادر عرض اللوح')+
   '<fieldset><legend>مطابقة اللوح مع أخدود قطاع</legend><div class="kw-grid">'+sel('grooveSku','قطاع الأخدود',[['','لا يوجد شرط'],...stock.filter(i=>i.kind==='bar').map(i=>[i.sku,i.name+' · '+i.sku])],line.grooveFit?.sku||'')+
   n('minClear','أدنى خلوص عرض الأخدود − سمك اللوح (مم)',line.grooveFit?.minClearMm,'min="0"')+n('maxClear','أقصى خلوص (مم)',line.grooveFit?.maxClearMm,'min="0"')+n('engage','أدنى عمق تعشيق مطلوب (مم)',line.grooveFit?.minEngageMm,'min="0"')+input('grooveRef','مرجع توافق اللوح والقطاع',line.grooveFit?.reference,'maxlength="180"')+'</div></fieldset>':'')+(material.kind==='bar'?'<fieldset><legend>طرفا القطاع</legend><p>الزاوية صفر للقطع القائم. الزاوية الموجبة تحرّك الطرف باتجاه تزايد طول القطعة عند الانتقال من حافة القطاع الأولى إلى المقابلة. يسجّل الحصر طول الخام الذي يغطي القطع على الحافتين.</p><div class="kw-grid">'+
   n('startDeg','ميل الطرف الأول بالدرجة',line.ends?.startDeg,'min="-85" max="85"')+n('endDeg','ميل الطرف الأخير بالدرجة',line.ends?.endDeg,'min="-85" max="85"')+sel('datum','حافة قياس طول الوصفة',[['near','الحافة الأولى'],['middle','محور القطاع'],['far','الحافة المقابلة']],line.ends?.datum||'near')+input('endRef','مرجع الوصلة واتجاه القطع',line.ends?.reference,'maxlength="180"')+'</div></fieldset>':'');
   termList('termsA');termList('termsB');
  }else{
   const r=line.hardwareRule||{};
   form.innerHTML='<p>اربط خطوط العتاد البديل باسم مجموعة واحد ومقياس واحد. يختار البرنامج صفًا واحدًا إذا وقع المقاس الفعلي ضمن حدّيه. يتوقف الحصر إذا تداخلت النطاقات أو لم يتطابق أي خيار.</p><div class="kw-grid">'+
    input('group','اسم مجموعة العتاد البديل',r.group,'maxlength="50" placeholder="مفصلات الدرفة"')+sel('metric','المقياس',Object.entries(ruleMetrics),r.metric||'frontWidth')+n('lo','الحد الأدنى شاملًا',r.min,'min="0"')+n('hi','الحد الأعلى شاملًا',r.max,'min="0"')+n('priority','ترتيب البديل المعتمد عند نفاد الصنف (١ أولًا، اختياري)',r.priority,'min="1" max="100"')+input('ruleRef','مرجع التوافق من المورد',r.reference,'maxlength="180"')+'</div>';
  }
  form.insertAdjacentHTML('beforeend','<button>حفظ قاعدة القطعة المحددة</button>');
  form.onclick=event=>{
   const del=event.target.closest('[data-dt]'),add=event.target.closest('[data-add-term]');if(!del&&!add)return;
   event.stopPropagation();syncTerms();const type=add?.dataset.addTerm||del.closest('[data-terms]').dataset.terms;
   if(add&&draft[type].length<12&&stocks.length)draft[type].push({sku:stocks[0][0],dimension:'sectionWidthMm',factor:-1});if(del)draft[type].splice(Number(del.dataset.dt),1);termList(type);
  };
 }
 host.onsubmit=event=>{
  event.preventDefault();event.stopPropagation();const form=event.target,kind=form.dataset.ff;
  if(kind==='create'){
   const key='custom-'+val(form,'id'),baseKey=val(form,'base');
   if(!isCustomFamily(key)||Object.hasOwn(c.families,key)){notice('أدخل رمزًا فريدًا للعائلة.');return;}
   const ok=save(v=>{v.families[key]={...JSON.parse(JSON.stringify(v.families[baseKey])),base:baseKey,cadKind:baseFactoryKinds[baseKey],label:val(form,'name'),reference:val(form,'ref')};if(!v.families[key].recipe.length)v.families[key].customerBay=true;});
   if(ok)selectFamily(key);else notice('لم تُحفظ العائلة. راجع مصدرها ومقاساتها.');
  }else if(kind==='properties'){
   const ok=save(v=>{const x=v.families[family];
    for(const k of ['minHeightMm','maxHeightMm','heightStepMm','minDepthMm','maxDepthMm','depthStepMm']){
     const value=num(form,k);if(value===null)delete x[k];else x[k]=value;
    }
    if(isCustomFamily(family)){x.cadKind=val(form,'cadKind');x.label=val(form,'familyLabel');x.reference=val(form,'reference');x.customerBay=form.elements.customerBay.checked;}
    x.frontSkus=[...form.querySelectorAll('[name=face]:checked')].map(el=>el.value);
    const m={frameKgM:num(form,'frameKgM'),extraKg:num(form,'extraKg'),reference:val(form,'weightSource')};
    if(m.frameKgM===null&&m.extraKg===null&&!m.reference)delete x.frontMassModel;else x.frontMassModel=m;
   });if(ok)refresh();else notice('أكمل الحدود الثلاثة للمقاس أو احذفها كلها. راجع تعريف وزن الدرفة ونوع نموذج فتحة الجهاز.');
  }else if(kind==='engineering'){
   syncTerms();const ok=save(v=>{const x=v.families[family].recipe[lineId];delete x.ends;delete x.hardwareRule;delete x.grooveFit;
    for(const k of ['termsA','termsB']){if(draft[k].length)x[k]=draft[k];else delete x[k];}
    if(material.kind==='panel'&&val(form,'grooveSku'))x.grooveFit={sku:val(form,'grooveSku'),minClearMm:num(form,'minClear'),maxClearMm:num(form,'maxClear'),minEngageMm:num(form,'engage'),reference:val(form,'grooveRef')};
    if(material.kind==='bar'&&(val(form,'startDeg')||val(form,'endDeg')||val(form,'endRef')))x.ends={startDeg:num(form,'startDeg'),endDeg:num(form,'endDeg'),reference:val(form,'endRef'),datum:val(form,'datum')};
    if(material.kind==='piece'&&(val(form,'group')||val(form,'lo')||val(form,'hi')||val(form,'ruleRef')))x.hardwareRule={group:val(form,'group'),metric:val(form,'metric'),min:num(form,'lo'),max:num(form,'hi'),priority:num(form,'priority'),reference:val(form,'ruleRef')};
   });if(ok)refresh();else notice('تعذّر حفظ القاعدة. راجع حدود العتاد أو زوايا الطرفين ومراجعها.');
  }
 };
}
