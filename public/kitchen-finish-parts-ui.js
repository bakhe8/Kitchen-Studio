import {finishMembers,finishParts,patchFinishPart,handlePreviewNote,catalogDisplayColor} from './kitchen-finish-parts.js';
import {buildFactoryQuote} from './kitchen-workshop-factory.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,l,selected)=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(l)+'</option>';
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const kinds={body:'panel',back:'panel',shelf:'panel',divider:'panel',profile:'bar',edge:'bar',handle:'piece',hinge:'piece',accessory:'piece'};
function drillEditor(rule,catalog,family){
 const target=family.recipe.filter(l=>l.role==='front'&&l.countMode==='front'&&l.count===1),machines=catalog.machining?.machines?.filter(m=>m.ops.includes('drill'))||[];
 if(!target.length||!machines.length)return '<p>لتعريف مسافات مسامير مختلفة لليد، أضف لوح واجهة واحدًا لكل درفة وماكينة تثقيب مؤهلة من بوابة المصنع.</p>';
 const d=rule.drilling,optional=(k,title,v)=>'<label>'+title+'<input name="'+k+'" type="number" min="0" step="any" value="'+esc(v)+'"></label>',fields=(sku,m={})=>{
  const field=(k,title,value='')=>'<label>'+title+'<input name="'+k+'" type="number" required min="0" step="any" value="'+esc(value)+'"></label>';
  const edge=(k)=>'<select name="'+k+'">'+option('start','من البداية',m[k]||'start')+option('end','من النهاية',m[k])+'</select>';
  return '<fieldset data-pattern-sku="'+esc(sku)+'"><legend>'+esc(sku)+'</legend><label>الماكينة<select name="machine">'+machines.map(x=>option(x.id,x.name,m.machine)).join('')+'</select></label>'+
   '<label>مرجع قالب هذه اليد<input required name="reference" maxlength="160" value="'+esc(m.reference)+'"></label>'+field('x','بداية مركز الثقب على محور طول اللوح',m.x)+edge('xFrom')+
   field('y','بداية مركز الثقب على محور عرض اللوح',m.y)+edge('yFrom')+field('diameter','القطر مم',m.diameter)+field('depth','العمق مم',m.depth)+field('pitch','تباعد المركزين مم (صفر لثقب واحد)',m.pitch)+
   '<label>الثقب التالي باتجاه الداخل على محور<select name="axis">'+option('x','الطول',m.axis||'x')+option('y','العرض',m.axis)+'</select></label>'+field('tolerance','سماحة التموضع مم',m.tolerance)+
   '<details><summary>شكل اليد في المعاينة</summary><p>لليد ذات المقطع الدائري أدخل الأبعاد الثلاثة معًا. يظهر شكل تقريبي إن تُركت فارغة. لليد ذات المسمار الواحد أدخل صفرًا للبروز بعد المسمار.</p>'+
   optional('visualDiameter','قطر جسم اليد مم',m.visual?.diameter)+optional('visualProjection','إجمالي البروز عن وجه الدرفة مم',m.visual?.projection)+optional('visualOverhang','امتداد الجسم بعد كل مسمار مم',m.visual?.overhang)+'</details></fieldset>';
 };
 return '<details><summary>قالب ثقوب لكل موديل يد</summary><p>أدخل المسافات إلى مركز الثقب الأول من مرجع لوح الواجهة المقصوص. يتحول تباعد مسماري اليد إلى عمليتي تثقيب على قطعة كل درفة أو درج.</p><form data-fp-drill><label>قطعة الواجهة التي تُثقب<select name="target">'+target.map(l=>option(l.label,l.label,d?.target)).join('')+'</select></label><label>مرجع عملية تثقيب اليد القديمة المطلوب استبدالها إن وجدت<input name="replaceRef" value="'+esc(d?.replaceRef)+'"></label>'+
 '<fieldset><legend>تركيب اللوح كما يراه العميل من الأمام</legend><label>محور طول اللوح بعد التركيب<select name="lengthAxis">'+option('','من محوري وصفة الواجهة',d?.mount?.lengthAxis||'')+option('vertical','رأسي يبدأ من الأسفل',d?.mount?.lengthAxis)+option('horizontal','أفقي يبدأ من اليسار',d?.mount?.lengthAxis)+'</select></label><label>قالب الدرفة ذات المفصلة اليمنى<select name="handed">'+option('fixed','نفس القالب والاتجاه',d?.mount?.handed||'fixed')+option('mirror','عكس مواضع ثقوب اليد أفقيًا عن درفة المفصلة اليسرى',d?.mount?.handed)+'</select></label><p>المحور الأفقي يبدأ من اليسار والرأسي من الأسفل. يتمركز لوح الواجهة داخل الدرفة ما لم تحدد إزاحته. حدّد اتجاه الطول يدويًا عند عكس القالب أو إدخال الإزاحة.</p>'+
 optional('leftMm','بعد حافة اللوح من يسار الدرفة مم',d?.mount?.leftMm)+optional('bottomMm','بعد حافة اللوح من أسفل الدرفة مم',d?.mount?.bottomMm)+'</fieldset>'+
 rule.skus.map(sku=>fields(sku,d?.models[sku])).join('')+'<button type="submit">حفظ قوالب التثقيب</button></form>'+(d?'<button type="button" data-fp-remove-drill>إزالة قوالب التثقيب</button>':'')+'</details>';
}
export function mountFinishPolicy(host,{catalog,family,save,refresh,notice}){
 const f=catalog.families[family];let part='body',source='';
 function draw(reload){
  const rule=f.finishSlots?.[part],type=kinds[part];
  const eligible=line=>line.role==='body'&&!line.hardwareRule&&catalog.items.some(i=>i.sku===line.sku&&i.kind===type&&i.role==='body'&&i.hardwareRole!=='runner');
  const sources=[...new Set(f.recipe.filter(eligible).map(l=>l.sku))];if(reload)source=rule?.source||sources[0]||'';
  const choices=catalog.items.filter(i=>i.kind===type&&i.role==='body'&&i.hardwareRole!=='runner');
  const labels=[...new Set(f.recipe.filter(l=>l.sku===source&&eligible(l)).map(l=>l.label))];
  host.innerHTML='<details '+(reload===undefined?'':'open')+'><summary>الخامات والعتاد التي يختارها العميل بعد تثبيت الهيكل</summary><p>اربط كل جزء ببنود وصفته وبقائمة البدائل التي اعتمدها المصنع. أضف كل لون أو سماكة أو موديل بصنف مستقل في الخامات والعتاد.</p><label>الجزء<select data-fp-part>'+Object.entries(finishParts).map(([k,v])=>option(k,v,part)).join('')+'</select></label>'+
   (sources.length?'<form><label>صنف الوصفة الأصلي<select data-fp-source>'+sources.map(k=>option(k,catalog.items.find(i=>i.sku===k).name+' · '+k,source)).join('')+'</select></label><fieldset><legend>تطبيق الاختيار على هذه القطع</legend>'+labels.map(l=>'<label><input type="checkbox" name="line" value="'+esc(l)+'" '+(rule?.source===source&&rule.labels.includes(l)?'checked':'')+'> '+esc(l)+'</label>').join('')+'</fieldset><fieldset><legend>بدائل المصنع المسموحة</legend>'+choices.map(i=>'<label><input type="checkbox" name="sku" value="'+esc(i.sku)+'" '+(i.sku===source?'checked disabled':rule?.skus.includes(i.sku)?'checked':'')+'> '+esc(i.name+' · '+i.sku)+'</label>').join('')+'</fieldset><label>أساس التوافق<select name="mode">'+option('matching',type==='piece'?'توافق تركيب وحمولة موثّق، مع قالب اليد عند اختلاف التخريم':'نفس مواصفات التركيب والقص',rule?.mode||'matching')+(type!=='piece'?option('formula','إعادة حساب خصومات الخام والتعشيق من الوصفة',rule?.mode):'')+'</select></label><label>مرجع المصنع لتوافق البدائل<input name="reference" maxlength="180" required value="'+esc(rule?.reference)+'"></label><p>تستطيع تعريف قالب تثقيب مختلف لكل يد بعد حفظ البدائل. يحتاج اختلاف الحمولة إلى قاعدة عتاد خاصة. السكك المحسوبة لكل درج تُدار في شاشة الأدراج.</p><button type="submit">حفظ بدائل '+esc(finishParts[part])+'</button></form>':'<p>لا توجد في الوصفة قطع من هذا النوع متاحة للاستبدال.</p>')+
   (rule?'<button type="button" data-fp-remove>إلغاء نشر بدائل هذا الجزء</button>':'')+(part==='handle'&&rule?drillEditor(rule,catalog,f):'')+'</details>';

 }
 host.onchange=e=>{if(e.target.hasAttribute('data-fp-part')){part=e.target.value;draw(true);}else if(e.target.hasAttribute('data-fp-source')){source=e.target.value;draw(false);}};
 host.onsubmit=e=>{e.preventDefault();e.stopPropagation();const form=new FormData(e.target);
  if(e.target.hasAttribute('data-fp-drill')){
   const models={};for(const set of e.target.querySelectorAll('[data-pattern-sku]')){
    const m={};for(const input of set.querySelectorAll('[name]')){
     if(input.name.startsWith('visual')){if(input.value==='')continue;const key=input.name.slice(6).toLowerCase();(m.visual??={})[key]=input.valueAsNumber;}
     else m[input.name]=input.type==='number'?input.valueAsNumber:input.value.trim();
    }models[set.dataset.patternSku]=m;
   }
   const ref=form.get('replaceRef')?.trim(),lengthAxis=form.get('lengthAxis'),handed=form.get('handed');
   const offsets={};for(const k of ['leftMm','bottomMm'])if(form.get(k)!=='')offsets[k]=Number(form.get(k));
   if(!lengthAxis&&(handed==='mirror'||Object.keys(offsets).length)){notice('حدّد اتجاه طول اللوح لتركيب القالب على الوجه.');return;}
   const mount=lengthAxis?{lengthAxis,handed,...offsets}:null;
   if(save(c=>{c.families[family].finishSlots.handle.drilling={...(mount?{mount}:{}),target:form.get('target'),...(ref?{replaceRef:ref}:{}),models};}))refresh();else notice('لم تُحفظ قوالب اليد. يلزم لوح واحد ويد واحدة لكل واجهة، ومراجع ومقاسات صالحة لكل موديل.');return;
  }
  const labels=form.getAll('line'),skus=[source,...form.getAll('sku').filter(s=>s!==source)];
  if(!labels.length){notice('حدّد بند قص أو عتاد واحدًا على الأقل من الوصفة.');return;}
  if(save(c=>{const x=c.families[family];x.finishSlots={...x.finishSlots,[part]:{...x.finishSlots?.[part],source,labels,skus,mode:form.get('mode'),reference:form.get('reference')}};}))refresh();
  else notice('راجع توافق الأصناف وبنود الوصفة. كل بند يتبع جزءًا واحدًا فقط.');
 };
 host.onclick=e=>{if(e.target.closest('[data-fp-remove-drill]')&&save(c=>{delete c.families[family].finishSlots.handle.drilling;})){refresh();return;}if(e.target.closest('[data-fp-remove]')&&save(c=>{delete c.families[family].finishSlots[part];}))refresh();};
 const first=f.finishSlots?.body;source=first?.source||f.recipe.find(l=>catalog.items.some(i=>i.kind==='panel'&&i.role==='body'&&i.sku===l.sku))?.sku||'';draw();
}
export function reviewPartChoice(doc,catalog,target,part,sku){
 const after=patchFinishPart(doc,catalog,target,part,sku),fin=doc.room.workshop?.finishes||{};
 const ids=finishMembers(doc,catalog).filter(m=>target==='all'?catalog.families[m.family].finishSlots?.[part]&&!m.locks?.finish&&!fin.partUnits?.[m.id]?.[part]:m.id===target).map(m=>m.id);
 if(!ids.length)return {doc:after,delta:null};
 const q=buildFactoryQuote(after,{unitIds:ids}),old=buildFactoryQuote(doc,{unitIds:ids});
 if(sku){
  const newProblem=q.issues.find(x=>!old.issues.includes(x))||q.machineIssues.find(x=>!old.machineIssues.includes(x));
  if(newProblem)throw Error(newProblem);
  const item=catalog.items.find(i=>i.sku===sku);
  if(item&&!item.available){
   const need=buildFactoryQuote(after).purchases.find(p=>p.sku===sku);
   if(need&&(need.fromStock===null||need.fromStock<need.qty))throw Error('المخزون لا يغطي كل وحدات المشروع من الصنف '+sku+' المتوقف توريده.');
  }
 }
 return {doc:after,delta:q.materialValue!=null&&old.materialValue!=null?q.materialValue-old.materialValue:null};
}
export function mountClientParts(host,{doc,catalog,onApply,onPreview,onPartChange,canEdit=()=>true,target,parts}){
 const members=finishMembers(doc,catalog),fin=doc.room.workshop?.finishes||{},by=new Map(catalog.items.map(i=>[i.sku,i]));
 let part='',sku='';
 function relevant(){return members.filter(m=>target==='all'||m.id===target);}
 function draw(){
  const available=relevant(),keys=parts.filter(k=>available.some(m=>catalog.families[m.family]?.finishSlots?.[k])||
   (target==='all'?fin.partDefaults?.[k]:fin.partUnits?.[target]?.[k]));
  if(!keys.includes(part))part=keys[0]||'';
  const targets=available.filter(m=>catalog.families[m.family]?.finishSlots?.[part]&&(target!=='all'||!m.locks?.finish&&!fin.partUnits?.[m.id]?.[part]));
  const slots=targets.map(m=>catalog.families[m.family].finishSlots[part]);
  const opts=slots.length?slots[0].skus.filter(s=>slots.every(x=>x.skus.includes(s))&&(by.get(s)?.available||by.get(s)?.stockUnits>0)):[];
  const own=target==='all'?fin.partDefaults?.[part]:fin.partUnits?.[target]?.[part];
  const covered=!fin.partCoverage?.[part]||fin.partCoverage[part].includes(target);
  const current=own||(target==='all'?null:(covered?fin.partDefaults?.[part]:null)||slots[0]?.source);
  if(!opts.includes(sku))sku=opts.includes(current)?current:opts[0]||'';
  host.innerHTML=
   (keys.length?'<label>الجزء<select data-cp-part>'+keys.map(k=>option(k,finishParts[k],part)).join('')+'</select></label><label>صنف المصنع<select data-cp-sku>'+opts.map(s=>{const i=by.get(s);return option(s,i.name+' · '+s+(i.color?' · '+i.color:'')+(i.thicknessMm?' · '+i.thicknessMm+' مم':''),sku);}).join('')+'</select></label>'+
   (onPreview?'<div class="fs-part-samples" role="group" aria-label="عينات الجزء من المصنع">'+opts.map(s=>{const i=by.get(s),hex=catalogDisplayColor(i);return '<button type="button" data-cp-sample="'+esc(s)+'" aria-pressed="'+(s===sku)+'"><i class="dp-sample-chip" aria-hidden="true"'+(hex?' style="background-color:'+hex+'"':' data-unspecified')+'></i><span><strong>'+esc(i.name)+'</strong><small>'+esc(i.color||'لون غير محدد')+' · <bdi>'+esc(s)+'</bdi></small></span></button>';}).join('')+'</div>':'')+
   '<p>'+esc(own?'الاختيار المثبت '+own:target==='all'?'تتبع الوحدات وصفة كل عائلة إلا ما خُصص لها.':'الاختيار الموروث '+(current||'غير متاح'))+' · الوحدات المشمولة '+fmt(targets.length)+'</p>'+
   (part==='handle'&&sku?'<p>'+[...new Set(targets.map(e=>handlePreviewNote(catalog.families[e.family].finishSlots.handle,sku,catalog.families[e.family].recipe)))].map(esc).join(' • ')+'</p>':'')+'<p data-cp-preview></p>'+
   '<button type="button" data-cp-apply '+(sku?'':'disabled')+'>تطبيق الصنف على القطع والحصر</button> '+(own?'<button type="button" data-cp-reset>إعادة هذا الجزء للاختيار الموروث</button>':'')+
   (!opts.length?'<p>لا يوجد صنف مشترك متاح. حدّد وحدة منفردة أو حدّث البدائل المعتمدة من المصنع.</p>':''):'<p>لم تنشر عائلة الوحدة بدائل للأجزاء في هذا النطاق. يضبطها المصنع من وصفة العائلة ← الخامات والعتاد التي يختارها العميل.</p>');
  if(sku&&keys.length){
   const hint=host.querySelector('[data-cp-preview]'),btn=host.querySelector('[data-cp-apply]');
   try{const {delta}=reviewPartChoice(doc,catalog,target,part,sku);
    hint.textContent=delta!=null?'فرق قيمة مواد النطاق '+fmt(delta)+' ر.س.':'ستظهر قيمة الفرق بعد اكتمال أسعار الأصناف.';
   }catch(err){hint.textContent=err.message;btn.disabled=true;}
  }
 }
 host.onchange=e=>{if(!canEdit())return;if(e.target.hasAttribute('data-cp-part')){part=e.target.value;sku='';onPartChange?.();draw();}else if(e.target.hasAttribute('data-cp-sku')){sku=e.target.value;draw();onPreview?.(target,part,sku);}};
 host.onclick=e=>{if(!canEdit())return;const card=e.target.closest('[data-cp-sample]');if(card){sku=card.getAttribute('data-cp-sample');draw();onPreview?.(target,part,sku);host.querySelector('[data-cp-sample="'+sku+'"]')?.focus?.({preventScroll:true});return;}const b=e.target.closest('[data-cp-apply],[data-cp-reset]');if(!b||b.disabled)return;onApply(target,part,b.hasAttribute('data-cp-reset')?null:sku);};draw();
}

// Supplier-rated hinge/lift groups already know their dimensional/load limits.
// Keep their original selector responsible for qualification, including after
// a later front substitution changes the calculated moving mass.
export function patchHardwareFinish(doc,catalog,unitId,group,sku){
 const e=finishMembers(doc,catalog).find(v=>v.id===unitId);if(!e)throw Error('الوحدة غير موجودة في وصفة مصنع.');
 const stock=catalog.items.find(i=>i.sku===sku),rules=catalog.families[e.family].recipe.filter(l=>l.hardwareRule?.group===group);
 if(sku&&!catalog.approved)throw Error('يلزم اعتماد كتالوج المصنع أولًا.');
 if(sku&&(!rules.some(l=>l.sku===sku)||!stock||!stock.available&&!(stock.stockUnits>0)))throw Error('خيار العتاد غير مسموح أو غير متاح.');
 if(sku&&e.hardwareChoices?.[group]&&e.hardwareChoices[group]!==sku)throw Error('حرّر اختيار العتاد المثبّت في محرّر الصف أولًا.');
 const w=doc.room.workshop,finishes={...w.finishes},units={...finishes.hardwareUnits},values={...units[unitId]};
 if(sku)values[group]=sku;else delete values[group];
 if(Object.keys(values).length)units[unitId]=values;else delete units[unitId];
 if(Object.keys(units).length)finishes.hardwareUnits=units;else delete finishes.hardwareUnits;
 const next={...doc,room:{...doc.room,workshop:{...w,finishes}}};
 if(sku){
  const quote=buildFactoryQuote(next,{unitIds:[unitId]});
  if(!quote.pieces.some(p=>p.unitId===unitId&&p.sku===sku&&p.hardwareRule?.group===group&&p.pinnedHardware)){
   const error=quote.issues.find(s=>s.includes(group))||'تحتاج الوحدة ووزن واجهتها إلى استكمال التحقق قبل تثبيت العتاد.';throw Error(error);
  }
 }
 return next;
}
export function mountFinishHardware(host,{doc,catalog,onPick,onPreview,onPartChange,canEdit=()=>true,unitId}){
 const fin=doc.room.workshop.finishes,all=finishMembers(doc,catalog),defs=e=>catalog.families[e.family].recipe.filter(l=>l.hardwareRule);
 const e=all.find(e=>e.id===unitId);if(!e)return;
 const uid=e.id;let key='';
 function draw(){
  const rules=defs(e),groups=[...new Set([...rules.map(l=>l.hardwareRule.group),...Object.keys(fin?.hardwareUnits?.[uid]||{})])];
  if(!groups.includes(key))key=groups[0];const cur=fin?.hardwareUnits?.[uid]?.[key]??'',rows=rules.filter(l=>l.hardwareRule.group===key),candidates=[...new Set(rows.map(l=>l.sku))];
  const skus=candidates.filter(s=>{try{patchHardwareFinish(doc,catalog,uid,key,s);return true;}catch{return false;}});

  host.innerHTML=(cur&&!skus.includes(cur)?'<p role="status">الاختيار المحفوظ '+esc(cur)+' يحتاج مراجعة ملاءمته للنسخة الحالية.</p>':'')+'<label>مجموعة العتاد<select data-hw-key>'+groups.map(k=>option(k,k,key)).join('')+'</select></label><label>اختيار العميل<select data-hw-sku>'+option('','اتّباع اختيار الصف وقاعدة المصنع',cur)+skus.map(s=>option(s,catalog.items.find(i=>i.sku===s)?.name+' · '+s,cur)).join('')+'</select></label><p>يعيد المصنع فحص سعة الصنف مع أبعاد الوحدة ووزن الواجهة. إذا لم يعد الصنف ملائمًا بعد تغيير الخامة يظهر السبب في الحصر.</p><button type="button">تثبيت طريقة اختيار العتاد</button>';
 }
 host.onchange=e=>{if(!canEdit())return;if(e.target.hasAttribute('data-hw-key')){key=e.target.value;onPartChange?.();draw();}else if(e.target.hasAttribute('data-hw-sku'))onPreview?.(uid,key,e.target.value||null);};
 host.onclick=e=>{if(canEdit()&&e.target.closest('button'))onPick(uid,key,host.querySelector('[data-hw-sku]').value||null);};draw();
}
