import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {addUnit,availableKitchenSlots,kitchenGeometry,kitchenUnitAllowed,kitchenUnitSpecs,validateKitchen} from './kitchen-model.js';

// Only explicitly saved, user-authored units. No room, project IDs, address,
// photos, open simulation, temporary selection or device credentials in JSON.
const format='studio-kitchen-unit-library',key='atlas-kitchen:user-unit-library:v1',maxItems=32,maxBytes=2_000_000;
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const fields=['kind','width','frontFinish','frontColor','frontStyle','handleStyle','doorHanding','interior','detail'];
const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id)&&!inheritedName(id);
const cleanName=n=>typeof n==='string'?Array.from(n.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,60).join(''):'';
const idNew=()=>globalThis.crypto?.randomUUID?.()||'t'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
const props=o=>Object.fromEntries(fields.filter(k=>ownKey(o,k)&&o[k]!=null).map(k=>[k,o[k]]));
const fail=reason=>({ok:false,reason});
export function cleanUserTemplate(value){
  if(!plain(value)||!safeId(value.id)||!cleanName(value.name)||!plain(value.unit)||!plain(value.reference))return null;
  const {tier,height,depth}=value.reference,s=value.unit,spec=ownKey(kitchenUnitSpecs,s.kind)?kitchenUnitSpecs[s.kind]:null;
  if(!spec||!kitchenUnitAllowed(s.kind,tier)||!Number.isFinite(height)||height<15||height>400||!Number.isFinite(depth)||depth<15||depth>150)return null;
  if((spec.height!=null&&height!==spec.height)||(spec.depth!=null&&depth!==spec.depth))return null;
  const r={id:'host',tier,wall:'back',start:0,end:240,depth,bottom:0,height};
  const k=validateKitchen({version:1,nextId:1,runs:[r],units:[{...props(s),id:'sample',runId:'host',u:0,open:false}],features:[]});
  return k?{id:value.id,name:cleanName(value.name),reference:{tier,height,depth},unit:props(k.units[0])}:null;
}
export function createUserTemplate(doc,unitId,name,id=idNew()){
  if(!doc?.kitchen||!cleanName(name))return fail('اختر وحدة من التصميم وأدخل اسمًا لنموذجك.');
  const src=doc.kitchen.units.find(u=>u.id===unitId);if(!src)return fail('هذه الوحدة غير موجودة في التصميم الحالي.');
  const shape=kitchenGeometry(doc.kitchen,doc.room).units.find(u=>u.id===unitId);
  const template=cleanUserTemplate({id,name,unit:src,reference:{tier:shape.tier,height:shape.height,depth:shape.depth}});
  return template?{ok:true,template}:fail('تعذّر حفظ مواصفات الوحدة.');
}
export function exportUserTemplates(templates){
  if(!Array.isArray(templates)||templates.length>maxItems)return null;
  const clean=templates.map(cleanUserTemplate);
  if(clean.some(t=>!t)||new Set(clean.map(t=>t.id)).size!==clean.length)return null;
  const text=JSON.stringify({format,version:1,templates:clean},null,2);
  return new TextEncoder().encode(text).length<=maxBytes?text:null;
}
export function readUserTemplates(text){
  if(typeof text!=='string'||text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)return fail('الملف أكبر من ٢ ميغابايت.');
  let data;try{data=JSON.parse(text);}catch{return fail('الملف ليس JSON صالحًا.');}
  if(!plain(data)||data.format!==format||data.version!==1||!Array.isArray(data.templates)||data.templates.length>maxItems)return fail('اختر ملف نماذج مطبخ صالحًا (حتى ٣٢ نموذجًا).');
  const templates=data.templates.map(cleanUserTemplate);
  if(templates.some(t=>!t)||new Set(templates.map(t=>t.id)).size!==templates.length)return fail('يحتوي الملف على نموذج أو تقسيم غير صالح أو معرّفات مكررة. لم يُضف شيء.');
  return {ok:true,templates};
}
export function mergeUserTemplates(existing,incoming){
  const result=[...existing],fingerprint=t=>JSON.stringify([t.name,t.reference,t.unit]);
  const unique=new Set(result.map(fingerprint)),ids=new Set(result.map(t=>t.id));let count=0;
  for(const raw of incoming){
    const t=cleanUserTemplate(raw);if(!t)return fail('يحتوي الملف على نموذج غير صالح.');
    const fp=fingerprint(t);if(unique.has(fp))continue;
    while(ids.has(t.id))t.id=idNew();
    result.push(t);ids.add(t.id);unique.add(fp);count++;
  }
  if(result.length>maxItems||!exportUserTemplates(result))return fail('لا تتسع المكتبة لهذه النماذج. لم تتغير نماذجك الحالية.');
  return {ok:true,templates:result,count};
}
export function userTemplateSlots(doc,template,runId){
  const t=cleanUserTemplate(template);
  return t?availableKitchenSlots(doc.kitchen,doc.room,{...t.unit,runId,open:false}):[];
}
export function placeUserTemplate(doc,template,runId,u=null){
  const t=cleanUserTemplate(template),k=doc.kitchen;
  if(!t)return {...fail('النموذج المحفوظ غير صالح.'),changed:false,kitchen:k};
  if(u!=null&&!Number.isFinite(u))return {...fail('أدخل إزاحة صالحة بالسنتيمتر.'),changed:false,kitchen:k};
  // An explicit offset is exact (never silently moved). A blank offset goes
  // through the model's continuous slot search and physical placement guard.
  return addUnit(k,doc.room,{...t.unit,runId,open:false,...(u!=null?{u}:{})});
}
const n=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}),cm=x=>n.format(x);
const wallNames={back:'الخلفي',left:'الأيسر',front:'الأمامي',right:'الأيمن'};
const rowName=r=>(r.placement==='free'?'جزيرة':(r.tier==='upper'?'صف علوي':'صف أرضي')+' · الجدار '+wallNames[r.wall])+' · '+cm(r.start)+'–'+cm(r.end)+' سم';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dims=(w,h,d)=>cm(w)+' عرض × '+cm(h)+' ارتفاع × '+cm(d)+' عمق (سم)';

export function mountUserLibrary(panel,{getDoc,getKit,apply,tell,focusReturn}={}){
  if(!panel)return {open(){},close(){},destroy(){}};
  const ac=new AbortController();panel.classList.add('kul-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','نماذجي');panel.dir='rtl';
  panel.innerHTML=`<header class="kul-head"><div><small>مكتبة الاستوديو</small><h2>نماذجي</h2></div><button type="button" data-ul-close aria-label="إغلاق نماذجي">×</button></header>
  <div class="kul-body"><p>احتفظ بوحدات صمّمتها لتضع نسخة مستقلة منها في مطبخ آخر.</p>
  <form data-ul-save><h3>حفظ وحدة من هذا المطبخ</h3><label>الوحدة من التصميم<select data-ul-unit></select></label><label>اسم نموذجي<input data-ul-name maxlength="60" placeholder="مثلًا: خزانتي العلوية اليمنى" autocomplete="off"></label><button type="submit" class="kul-primary" data-ul-confirm>حفظ الوحدة في نماذجي</button></form>
  <section><h3>الوحدات المحفوظة</h3><label>النموذج<select data-ul-template></select></label><p class="kul-detail" data-ul-info></p>
  <div data-ul-place-box><label>صف الوجهة<select data-ul-run></select></label><label>بداية النسخة من بداية محور الجدار أو الجزيرة (سم)<input type="number" min="0" step="any" dir="ltr" data-ul-offset placeholder="تلقائي: أول موضع يتّسع لها"></label><p data-ul-fit></p><button type="button" data-ul-place class="kul-primary">ضع نسخة في هذا المطبخ</button></div>
  <div class="kul-actions"><button type="button" data-ul-export-one>تصدير النموذج</button><button type="button" data-ul-remove>إزالة من نماذجي</button></div></section>
  <section><h3>نقل مكتبتي</h3><p>الاستيراد يضيف النماذج إلى مكتبتك ويحافظ على الموجودة.</p><div class="kul-actions"><button type="button" data-ul-export>تصدير مكتبتي</button><label class="kul-file">استيراد ملف نماذج<input type="file" accept=".json,application/json" data-ul-import></label></div></section>
  <p role="status" data-ul-status class="kul-status" aria-live="polite"></p></div>`;
  const q=s=>panel.querySelector(s),unit=q('[data-ul-unit]'),name=q('[data-ul-name]'),templates=q('[data-ul-template]'),runs=q('[data-ul-run]'),offset=q('[data-ul-offset]'),fit=q('[data-ul-fit]'),status=q('[data-ul-status]');
  const on=(el,type,fn)=>el.addEventListener(type,fn,{signal:ac.signal});
  let data=[],blocked=false,removeId=null,currentId=null,dead=false;
  const say=(text,bad=false,state='info')=>{status.textContent=text;status.dataset.bad=String(bad);status.dataset.state=bad?'error':state;};
  function load(){
    try{const raw=localStorage.getItem(key);if(raw===null)return {ok:true,templates:[]};return readUserTemplates(raw);}
    catch{return fail('تعذّرت قراءة المكتبة من هذا المتصفح.');}
  }
  function write(next){
    const text=exportUserTemplates(next);if(!text){say('لم تتسع المكتبة لهذه النماذج، أو أن أحدها غير صالح.',true);return false;}
    try{localStorage.setItem(key,text);data=next;return true;}catch{say('لم تتوفر مساحة للحفظ في هذا المتصفح. بقيت مكتبتك كما كانت.',true);return false;}
  }
  const current=()=>data.find(t=>t.id===templates.value);
  const opt=(v,l)=>'<option value="'+esc(v)+'">'+esc(l)+'</option>';
  function updatePlacement(){
    const t=current(),doc=getDoc(),r=doc.kitchen.runs.find(r=>r.id===runs.value),b=q('[data-ul-place]');
    if(!t||!r){fit.dataset.state='attention';fit.textContent=t?'ارسم صفًا يقبل هذا النوع داخل المطبخ أولًا.':'';b.disabled=true;return;}
    const isAuto=offset.value.trim()==='';
    if(offset.validity?.badInput){fit.dataset.state='error';fit.textContent='أدخل رقمًا صالحًا.';b.disabled=true;return;}
    const spec=kitchenUnitSpecs[t.unit.kind],H=spec.height??r.height,D=spec.depth??r.depth;
    const changed=H!==t.reference.height||D!==t.reference.depth;
    const result=placeUserTemplate(doc,t,r.id,isAuto?null:offset.valueAsNumber),added=result.ok&&result.kitchen.units.find(v=>v.id===result.id);
    fit.dataset.ok=String(!!added);fit.dataset.state=added?'success':'error';b.disabled=!added;
    fit.textContent=added?(isAuto?'أول بداية متاحة: ':'البداية: ')+cm(added.u)+' سم. '+(changed?'تأخذ النسخة ارتفاع صف الوجهة وعمقه: '+dims(t.unit.width,H,D)+'.':'تطابق مقاسات المصدر.'):(result.reason||'لا يتّسع هذا الصف للنسخة.');
  }
  function drawRuns(){
    const d=getDoc(),t=current(),was=runs.value,target=getKit()?.getState?.().selected;
    const fitting=t?d.kitchen.runs.filter(r=>kitchenUnitAllowed(t.unit.kind,r)):[],choices=fitting.map(r=>({r,available:userTemplateSlots(d,t,r.id).length>0}));
    runs.innerHTML=choices.length?choices.map(({r,available})=>opt(r.id,rowName(r)+(available?'':' · لا يتّسع الآن'))).join(''):opt('','لا يوجد صف مناسب');
    const targetId=target?.kind==='run'?target.id:target?.kind==='unit'?d.kitchen.units.find(u=>u.id===target.id)?.runId:null;
    runs.value=choices.find(c=>c.available&&c.r.id===was)?.r.id||choices.find(c=>c.available&&c.r.id===targetId)?.r.id||choices.find(c=>c.available)?.r.id||fitting[0]?.id||'';
    updatePlacement();
  }
  function drawSaved(id){
    templates.innerHTML=data.length?data.map(t=>opt(t.id,t.name+' · '+kitchenUnitSpecs[t.unit.kind].label)).join(''):opt('','لم تحفظ وحدات بعد');
    templates.value=data.some(t=>t.id===id)?id:data[0]?.id||'';
    const t=current();q('[data-ul-info]').textContent=t?dims(t.unit.width,t.reference.height,t.reference.depth)+(t.unit.detail?' · تقسيم داخلي مخصص':'')+(t.unit.doorHanding?' · فتح الضلف محفوظ':''):'احفظ وحدة أعلاه، أو استورد ملف نماذج.';
    for(const a of ['[data-ul-export-one]','[data-ul-remove]'])q(a).disabled=!t;
    q('[data-ul-export]').disabled=!data.length;q('[data-ul-place-box]').hidden=!t;templates.disabled=!t;
    q('[data-ul-remove]').textContent='إزالة من نماذجي';removeId=null;currentId=t?.id||null;offset.value='';drawRuns();
  }
  function drawSource(){
    const d=getDoc(),s=getKit()?.getState?.().selected,items=d.kitchen.units;
    unit.innerHTML=items.length?items.map(u=>{const r=d.kitchen.runs.find(v=>v.id===u.runId);
      return opt(u.id,kitchenUnitSpecs[u.kind].label+' · '+(r.placement==='free'?'جزيرة':wallNames[r.wall])+' · '+cm(u.u)+' سم');}).join(''):opt('','لا وحدات في هذا المطبخ');
    unit.value=s?.kind==='unit'&&items.some(u=>u.id===s.id)?s.id:items[0]?.id||'';
    unit.disabled=!items.length;name.disabled=unit.disabled||blocked;q('[data-ul-confirm]').disabled=name.disabled;
  }
  function close(restore=true){panel.hidden=true;if(restore)focusReturn?.()?.focus?.({preventScroll:true});}
  function open(){
    if(dead)return;const l=load();data=l.ok?l.templates:[];blocked=!l.ok;
    panel.hidden=false;name.value='';drawSource();drawSaved(currentId);say(l.ok?'':l.reason,true);
    (unit.disabled?templates:unit).focus?.({preventScroll:true});
  }
  on(unit,'change',()=>{if(unit.value)getKit()?.selectUnit?.(unit.value,{open:false});});
  on(templates,'change',()=>drawSaved(templates.value));on(runs,'change',()=>{offset.value='';updatePlacement();});on(offset,'input',updatePlacement);
  on(q('[data-ul-save]'),'submit',e=>{
    e.preventDefault();if(blocked)return;const t=createUserTemplate(getDoc(),unit.value,name.value);
    if(!t.ok){say(t.reason,true);return;}
    const fresh=load();if(!fresh.ok){say(fresh.reason,true);return;}
    if(fresh.templates.length>=maxItems){say('بلغت ٣٢ نموذجًا. صدّر أو أزل نموذجًا قبل إضافة آخر.',true);return;}
    if(write([t.template,...fresh.templates])){drawSaved(t.template.id);name.value='';say('حُفظ نموذج «'+t.template.name+'» مستقلًا عن الوحدة الأصلية.',false,'success');}
  });
  function download(what,file){
    const text=exportUserTemplates(what);if(!text)return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=panel.ownerDocument.createElement('a');
    a.href=url;a.download=file;panel.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),900);
  }
  on(q('[data-ul-close]'),'click',()=>close());on(panel,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  on(q('[data-ul-export]'),'click',()=>download(data,'kitchen-unit-library.json'));on(q('[data-ul-export-one]'),'click',()=>{const t=current();if(t)download([t],'kitchen-unit-template.json');});
  on(q('[data-ul-remove]'),'click',()=>{
    const t=current();if(!t||blocked)return;
    if(removeId!==t.id){removeId=t.id;q('[data-ul-remove]').textContent='تأكيد إزالة النموذج';say('الإزالة من المكتبة فقط. النسخ الموضوعة في المطابخ لا تتغير.',false,'attention');return;}
    const fresh=load();if(!fresh.ok){say(fresh.reason,true);return;}
    if(write(fresh.templates.filter(x=>x.id!==t.id))){drawSaved();say('أُزيل النموذج المحفوظ.',false,'success');}
  });
  on(q('[data-ul-place]'),'click',()=>{
    const t=current(),doc=getDoc();if(!t||offset.validity?.badInput)return;
    const result=placeUserTemplate(doc,t,runs.value,offset.value.trim()===''?null:offset.valueAsNumber);
    if(!result.ok){say(result.reason,true);updatePlacement();return;}
    const msg='وُضعت نسخة مستقلة من «'+t.name+'».',applied=apply({...doc,kitchen:result.kitchen},msg);
    if(applied?.ok===false){say(applied.reason||'تعذّر وضع النسخة.',true);return;}
    close(false);getKit()?.selectUnit?.(result.id,{open:false});tell?.(msg+(applied?.saved===false?' النسخة في الجلسة الحالية، وتعذّر حفظ التعديل في المتصفح.':''));
  });
  on(q('[data-ul-import]'),'change',async e=>{
    const input=e.target,file=input.files?.[0];input.value='';if(!file||blocked)return;
    if(file.size>maxBytes){say('الملف أكبر من ٢ ميغابايت.',true);return;}
    try{const got=readUserTemplates(await file.text());if(dead)return;if(!got.ok){say(got.reason,true);return;}
      const fresh=load();if(!fresh.ok){say(fresh.reason,true);return;}const merged=mergeUserTemplates(fresh.templates,got.templates);
      if(!merged.ok){say(merged.reason,true);return;}if(!merged.count){say('هذه النماذج موجودة بالفعل.');return;}
      if(write(merged.templates)){drawSaved(got.templates[0]?.id);say('أُضيف إلى نماذجك: '+cm(merged.count)+'.',false,'success');}
    }catch{say('تعذّرت قراءة الملف. بقيت المكتبة كما كانت.',true);}
  });
  return {open,close,destroy(){dead=true;ac.abort();panel.replaceChildren();}};
}
