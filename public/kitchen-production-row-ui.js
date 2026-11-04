import {proposalUnitSymbol} from './kitchen-proposal-symbols.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {pantryContext,pantryForUnit,pantryModes} from './kitchen-pantry-brief.js';
import {drawerRunnerPlans} from './kitchen-drawer-fit.js';
import {drawerFitForms,readDrawerMeasurements} from './kitchen-drawer-fit-ui.js';
import {fillerControl,variantAddition,readRowModel,recipeChoices,recipeModelFields,refreshRecipeForm} from './kitchen-row-recipes-ui.js';
import {mountPlanAlternatives} from './kitchen-production-alternatives-ui.js';
import {planWorkshopRow,rowLabels} from './kitchen-production-row.js';
import {getFactoryCatalog,hardwareChoiceOptions} from './kitchen-workshop-factory.js';
import {surveyedDesignRange,surveyedDesignWalls} from './kitchen-chain-model.js';
import {riceForm,readRiceForm} from './kitchen-production-row-rice-ui.js';
import {currentRiceWarnings} from './kitchen-production-row-rice.js';
import {mountCornerUI} from './kitchen-production-row-corner-ui.js';
import {roomArchitecture} from './kitchen-architecture.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v);
const opt=(v,label,current)=>'<option value="'+esc(v)+'"'+(current===v?' selected':'')+'>'+esc(label)+'</option>';
const tick=(field,title,checked)=>'<label class="dp-row-choice">'+proposalUnitSymbol({family:field,kind:field})+'<input type="checkbox" name="'+field+'" '+(checked?'checked':'')+'>'+esc(title)+'</label>';
const number=(field,label,n,min=0)=>'<label>'+esc(label)+' <small>مم</small><input type="number" name="'+field+'" required step="1" min="'+min+'" max="17000" value="'+esc(n)+'"></label>';
const checkTitles={width:'العرض',position:'الموضع',usage:'الاستخدام',finish:'التشطيب'};
function equipmentForm(u,e={}){
 const field=(group,key,label,value,ref=false)=>'<label>'+label+'<input name="'+group+key+'" type="'+(ref?'text':'number')+'" '+(ref?'maxlength="160"':'step="any" min="'+(key==='floor'?-3000:.1)+'" max="6000"')+' required value="'+esc(value??'')+'"></label>';
 return '<details><summary>مطابقة فتحة موديل الغسالة في الموقع</summary><form data-pwr-equipment="'+esc(u.id)+'"><div class="ws-inline">'+
  [['model','رقم موديل الجهاز'],['manual','مرجع أو صفحة دليل التركيب'],['source','مرجع القياس الميداني'],['surveyor','اسم الفني']].map(([k,l])=>field('',k,l,e[k],true)).join('')+'</div>'+
  '<strong>الحد الأدنى لفتحة التركيب في دليل الموديل، بالملليمتر</strong><div class="ws-inline">'+
  [['width','العرض'],['depth','العمق شامل التوصيلات'],['height','الارتفاع']].map(([k,l])=>field('req',k,l,e.required?.[k])).join('')+'</div>'+
  '<strong>قياسات الموقع من مرجع رأسي واحد، بالملليمتر</strong><div class="ws-inline">'+
  [['width','عرض الفتحة الصافي'],['depth','العمق المتاح'],['underside','منسوب أسفل السطح'],['floor','منسوب ارتكاز الأرجل']].map(([k,l])=>field('site',k,l,e.measured?.[k])).join('')+'</div>'+
  '<label>ارتكاز الأرجل<select name="bearing" required><option value="">اختر نتيجة المعاينة</option>'+opt('same','جميع الأرجل على منسوب واحد',e.bearing)+opt('mixed','الأرجل على مستويين',e.bearing)+'</select></label><button type="submit">فحص الموديل بالقياس</button></form></details>';
}
function suggestedWidth(f,target){return target>=f.minMm&&target<=f.maxMm&&(target-f.minMm)%f.stepMm===0?target:f.minMm;}
function hardwareFields(catalog,u,upper){
 const sets=hardwareChoiceOptions(catalog,u.recipeId||(upper?'upperStorage':u.family));
 if(!sets.length)return '';
 return '<fieldset><legend>عتاد الوصفة</legend>'+sets.map(({group,choices})=>'<label>'+esc(group)+'<select data-pwr-hardware="'+esc(group)+'"><option value="">تلقائي وفق القاعدة</option>'+choices.map(v=>opt(v.sku,v.label,u.hardwareChoices?.[group])).join('')+'</select></label>').join('')+'</fieldset>';
}
function rowTrack(units,run,catalog,preview=false){
 if(!units?.length||!run)return '';
 const length=(run.end-run.start)*10;
 return '<div class="pwr-track" dir="ltr" aria-label="الوحدات مرتبة من بداية امتداد الجدار">'+units.map(u=>{
  const label=u.use||catalog?.families?.[u.recipeId]?.label||rowLabels[u.family];
  const caption=label+' · '+fmt(u.widthMm)+' مم';
  return '<button type="button" data-pwr-track="'+esc(u.id)+'"'+(preview?' data-pwr-preview-unit':'')+' style="inset-inline-start:'+((u.startMm-run.start*10)*100/length)+'%;width:'+(u.widthMm*100/length)+'%" title="'+esc(caption)+'"><b>'+esc(label)+'</b>'+fmt(u.widthMm)+'</button>';
 }).join('')+'</div>'+(preview?'<p data-pwr-track-readout aria-live="polite" hidden></p>':'');
}
export function mountRowStep(host,{getDoc,apply,tell,onAdvance,focus={}}){
 let doc=getDoc(),loc=focus.runId?'run:'+focus.runId:focus.wall?'wall:'+focus.wall:'',tier='base',wall=focus.wall||doc.room.workshop?.activeWall||'back',pending=null,draft=null,clearCorner=null,clearComparison=null;
 const controller=new AbortController(),signal=controller.signal;
 function wallData(){return roomArchitecture(getDoc().room).walls;}
 function selectDefaults(){
  doc=getDoc();
  const rows=doc.room.workshop?.rows||{},known=doc.kitchen.runs.filter(r=>rows[r.id]);
  if(!loc&&known.length)loc='run:'+known.at(-1).id;
  const measured=surveyedDesignWalls(doc);
  if(!loc&&!measured.includes(wall))wall=measured[0]||wallData().find(w=>w.id===wall)?.id||wallData()[0]?.id;
  const r=loc.startsWith('run:')?doc.kitchen.runs.find(r=>r.id===loc.slice(4)):null;
  if(r){wall=r.wall;tier=r.tier;}
  const info=wall?surveyedDesignRange(doc,wall):null;
  const saved=r&&rows[r.id],u=saved?.units||[],rice=u.find(x=>x.family==='rice'),selected=!!r&&!!saved;
  const pantry=pantryContext(doc,r?.id,draft?.pantryId);
  const widths=Object.fromEntries(['rice','dishwasher','sink'].map(k=>[k,u.find(i=>i.family===k)?.widthMm??suggestedWidth(getFactoryCatalog(doc).families[k],{rice:600,dishwasher:600,sink:900}[k])]));
  return {r,saved,info,measured,widths,pantry,pantryId:rice?.pantryId||(!pantry.placed&&pantry.req?.confirmed&&pantry.req.choice!=='none'?pantry.req.id:''),fillerRecipeId:saved?.fillerRecipeId||'',riceMode:rice?.riceMode||pantry.mode,startMm:r?r.start*10:info?.startMm,endMm:r?r.end*10:info?.endMm,
   wanted:Object.fromEntries(['rice','dishwasher','sink'].map(k=>[k,tier==='base'&&(selected?u.some(i=>i.family===k):k==='rice'?pantry.wanted:true)]))};
 }
 function render(result=null){
  const defaults=selectDefaults(),r=defaults.r,saved=defaults.saved,d=draft||defaults,catalog=getFactoryCatalog(doc);
  const measured=defaults.measured;
  const locations=wallData().map(w=>opt('wall:'+w.id,w.label+(measured.includes(w.id)?' · رفع مكتمل':' · يحتاج رفعًا'),loc||'wall:'+wall))
    .concat(doc.kitchen.runs.map(x=>opt('run:'+x.id,(x.wall?wallData().find(w=>w.id===x.wall)?.label:'جزيرة')+' · '+(x.tier==='upper'?'علوي':'سفلي')+' · '+fmt((x.end-x.start)*10)+' مم'+(doc.room.workshop?.rows?.[x.id]?' · صف مصنع':''),loc))).join('');
  const locationChoice='<label>الجدار أو الصف المرسوم<select data-pwr-location>'+locations+'</select></label>';
  clearCorner?.();clearCorner=null;clearComparison?.();clearComparison=null;
  const existing=r&&(saved||doc.kitchen.units.some(u=>u.runId===r.id));
  const range=defaults.info;
  const usable=r?.placement==='free'?measured.length:range&&(!r||r.start*10>=range.startMm-.001&&r.end*10<=range.endMm+.001);
  if(!existing&&!usable){
   const wallName=wallData().find(w=>w.id===wall)?.label||'الجدار';
   const why=range&&r?'يمتد الصف المرسوم خارج نطاق الدواليب المقاس. اختر الجدار من القائمة لتكوين صف داخل النطاق.':'أكمل رفع '+wallName+' واحفظ نهاية الدواليب أو قياس ركن النهاية ليظهر امتداد الصف.';
   host.innerHTML='<section class="pwr-desk"><h2>تعبئة الصف</h2><div class="ws-card">'+locationChoice+'<p>'+esc(why)+'</p><button type="button" data-pwr-survey>متابعة رفع الجدار</button></div></section>';
   return;
  }
  const ulist=saved?.units||[],runnerPlans=drawerRunnerPlans(catalog,doc.room.workshop?.rows||{},doc.kitchen.units,doc.kitchen.runs,doc.room.workshop?.finishes,doc);
  const options=recipeChoices(catalog,tier==='upper');
  const unitFor=u=>doc.kitchen.units.find(a=>a.id===u.id);
  const header='<header class="pwr-heading"><h2>'+studioIcon('layers')+'تكوين الصف</h2>'+locationChoice+'</header>';
  const entry='<div class="pwr-entry">'+(saved?'<details class="ws-card pwr-config" '+(draft?'open':'')+'><summary>'+studioIcon('settings')+'إعدادات التعبئة</summary>':'<div class="ws-card">')+
  '<form data-pwr-plan><div class="ws-inline"><label>مستوى الصف<select name="tier" '+(r?'disabled':'')+'>'+opt('base','سفلي',tier)+opt('upper','علوي',tier)+'</select></label>'+
  (r?'<span>من <bdi>'+fmt(defaults.startMm)+'</bdi> إلى <bdi>'+fmt(defaults.endMm)+'</bdi> مم</span>':number('startMm','بداية الدواليب على الجدار',d.startMm)+number('endMm','نهايتها',d.endMm))+'</div>'+
  (tier==='base'?'<h3>ماذا يحتاج العميل في هذا الصف؟</h3><div class="dp-row-needs">'+['rice','dishwasher','sink'].map(k=>tick(k,rowLabels[k],d.wanted[k])).join('')+'</div>'+
  '<div class="ws-inline">'+['rice','dishwasher','sink'].filter(k=>d.wanted[k]).map(k=>number(k+'Width','عرض '+rowLabels[k],d.widths[k],200)).join('')+'</div>'+
  '<p>'+esc(defaults.pantry.note)+'</p>'+(defaults.pantry.requests.length?'<label>ربط طلب الأرز من المقابلة<select name="pantryId"><option value="">دون ربط تلقائي</option>'+defaults.pantry.requests.map(q=>opt(q.id,q.id+' · '+(q.choice==='none'?'لا يطلب أرزًا':q.confirmed?pantryModes[q.mode]:'ينتظر حسم العميل'),d.pantryId)).join('')+'</select></label>':'')+
  (d.wanted.rice?'<label>طريقة تخزين الأرز<select name="riceMode">'+Object.entries(pantryModes).map(([v,l])=>opt(v,l,d.riceMode)).join('')+'</select></label>':''):'<p>يملأ البرنامج الأجزاء المتاحة حول الفتحات بوحدات علوية متوافقة.</p>')+
  fillerControl(catalog,tier==='upper',d.fillerRecipeId)+'<p class="ws-subtle">الكتالوج المستخدم · '+esc(catalog.name)+' · إصدار '+esc(catalog.revision)+'</p><button type="submit" class="primary">معاينة التعبئة</button></form>'+
  (saved?'</details>':'</div>')+variantAddition(catalog,tier==='upper')+'</div>';
  const output='<div class="pwr-output"><div data-pwr-result aria-live="polite"></div>'+
  (saved?'<div class="ws-card pwr-saved"><h3>وحدات الصف <small>'+fmt(ulist.length)+'</small></h3>'+rowTrack(ulist,r,catalog)+
  '<p class="ws-subtle">اختر الوحدة من الشريط لتعديلها. تغيير عرضها أو موضعها يثبّت القياس المعدّل.</p>'+
  ulist.map(u=>'<details class="ws-card" data-pwr-id="'+esc(u.id)+'"><summary>'+esc(u.use||catalog.families[u.recipeId]?.label||rowLabels[u.family])+' · '+fmt(u.widthMm)+' مم · بداية '+fmt(u.startMm)+'</summary>'+
   '<form data-pwr-edit="'+esc(u.id)+'"><label>عائلة الوحدة<select name="family">'+options.map(([v,l])=>opt(v,l,u.recipeId||(tier==='upper'?'upperStorage':u.family))).join('')+'</select></label>'+
   '<label>تسمية الاستخدام الخاص<input name="use" maxlength="100" placeholder="مثال: قدور العزائم" value="'+esc(u.use||'')+'"></label>'+
   '<div class="ws-inline">'+number('widthMm','عرض الوحدة',u.widthMm,200)+number('startMm','بداية الوحدة على الجدار',u.startMm)+'</div>'+
   '<div data-pr-count>'+number('drawerCount','عدد واجهات الأدراج',unitFor(u)?.drawerCount||3,1)+'</div>'+recipeModelFields(unitFor(u)?.modelSpec)+' '+
   (unitFor(u)?.kind==='drawers'?'<fieldset><legend>تخصيص استخدام كل درج</legend>'+Array.from({length:unitFor(u)?.drawerCount||3},(_,i)=>'<label>الدرج '+fmt(i+1)+'<input name="drawer'+i+'" maxlength="100" placeholder="اختياري" value="'+esc(u.drawerUses?.[i]||'')+'"></label>').join('')+'</fieldset>':'')+
   hardwareFields(catalog,u,tier==='upper')+'<strong>الخصائص المثبّتة</strong><div class="ws-inline">'+Object.entries(checkTitles).map(([k,l])=>tick(k,l,u.locks[k])).join('')+'</div>'+
   '<button type="submit">معاينة تعديل هذه الوحدة</button></form>'+(u.family==='dishwasher'?equipmentForm(u,saved.equipmentChecks?.[u.id]):u.family==='rice'?riceForm(u,saved.riceChecks?.[u.id],catalog.families[u.recipeId||u.family]?.drawerRunners?.length?(unitFor(u)?.drawerCount||3):0,pantryForUnit(doc,u)):'')+(u.family==='rice'&&u.riceMode==='dispenser'?'<form data-pwr-pantry-supply="'+esc(u.id)+'"><fieldset><legend>مطابقة العيّاشة الفعلية لصنف الوصفة</legend><label>موديل العميل<input name="model" required maxlength="160" value="'+esc(u.pantrySupply?.model||pantryForUnit(doc,u)?.model||'')+'"></label><label>قطعة التوريد<select name="sku" required><option value="">اختر الصنف المطابق للموديل</option>'+[...new Set(catalog.families[u.recipeId||u.family].recipe.filter(l=>l.when==='bin'&&catalog.items.some(i=>i.sku===l.sku&&i.kind==='piece')).map(l=>l.sku))].map(s=>opt(s,s+' · '+catalog.items.find(i=>i.sku===s).name,u.pantrySupply?.sku)).join('')+'</select></label><label>مرجع المصنع لمطابقة الموديل<input name="reference" maxlength="160" required value="'+esc(u.pantrySupply?.reference||'')+'"></label><button>معاينة مطابقة صنف العيّاشة</button></fieldset></form>':'')+(unitFor(u)?.kind==='drawers'?drawerFitForms(u,unitFor(u).drawerCount||3,saved.drawerChecks?.[u.id],runnerPlans.get(u.id),catalog.families[u.recipeId||u.family]?.drawerRunners):'')+'</details>').join('')+
  '<button type="button" class="primary" data-pwr-advance>متابعة اعتماد الهيكل</button></div>':'')+'</div>';
  host.innerHTML='<section class="pwr-desk">'+header+'<div class="pwr-layout">'+(saved?output+entry:entry+output)+'</div></section>';
  host.querySelectorAll('form[data-pwr-add],form[data-pwr-edit]').forEach(f=>refreshRecipeForm(f,catalog));
  const details=document.createElement('details');details.className='ws-card';details.innerHTML='<summary>تخصيص زاوية بين جدارين</summary><div></div>';host.append(details);
  clearCorner=mountCornerUI(details.querySelector('div'),{getDoc,apply,tell,onAdvance,refresh:()=>{draft=null;pending=null;render();}});
  const alt=document.createElement('details');alt.className='ws-card';alt.innerHTML='<summary>بدائل الصفوف على جدران المطبخ</summary><div></div>';host.append(alt);
  clearComparison=mountPlanAlternatives(alt.querySelector('div'),{getDoc,apply,tell,refresh:()=>{draft=null;pending=null;render();}});
  if(result)show(result);
 }
 function openUnitCard(unitId,drawerIndex){
  const card=[...host.querySelectorAll('[data-pwr-id]')].find(el=>el.getAttribute('data-pwr-id')===unitId);
  if(!card)return false;
  card.open=true;
  const field=Number.isInteger(drawerIndex)&&drawerIndex>=1&&drawerIndex<=8?card.querySelector('[name="drawer'+(drawerIndex-1)+'"]'):null;
  const target=field||card.querySelector('summary');
  target?.focus?.({preventScroll:true});target?.scrollIntoView?.({block:'nearest'});return true;
 }
 function readDraft(form){
  const f=new FormData(form),d=selectDefaults(),wanted={},widths={};
  for(const k of ['rice','dishwasher','sink']){
   wanted[k]=f.has(k);widths[k]=f.has(k+'Width')?Number(f.get(k+'Width')):d.widths[k];
  }
  const recipeId=String(f.get('fillerRecipeId')||'');
  return {wanted,widths,pantryId:f.get('pantryId')||'',fillerRecipeId:recipeId.startsWith('custom-')?recipeId:'',riceMode:f.get('riceMode')||d.riceMode,startMm:f.has('startMm')?Number(f.get('startMm')):d.startMm,endMm:f.has('endMm')?Number(f.get('endMm')):d.endMm};
 }
 function show(res){
  const box=host.querySelector('[data-pwr-result]');box.innerHTML='';
  if(!res.ok){box.innerHTML='<div class="ws-card" role="alert">'+esc(res.reason)+'</div>';tell(res.reason);return;}
  const current=res.doc.kitchen.runs.find(r=>r.id===res.runId),u=res.row.units;
  box.innerHTML='<section class="ws-card"><strong>معاينة قبل التطبيق</strong>'+rowTrack(u,current,getFactoryCatalog(res.doc),true)+
   '<div class="ws-inline">'+u.map(i=>'<span class="ws-state">'+esc(i.use||getFactoryCatalog(res.doc).families[i.recipeId]?.label||rowLabels[i.family])+' '+fmt(i.widthMm)+'</span>').join('')+'</div>'+
   [...res.row.warnings,...currentRiceWarnings(res.doc,current,res.row)].map(w=>'<p class="ws-subtle">'+esc(w)+'</p>').join('')+
   (res.pairRemainder?.length?(res.openEndAccepted?'<p>سيبقى الفراغ المحجوز مفتوحًا عند الطرف، دون قفلة من المصنع.</p>':'<button type="button" data-pwr-open-end>ترك الباقي فراغًا دون توريد قفلة</button>'):'')+
   '<button type="button" data-pwr-apply class="primary">تطبيق على الرسم</button></section>';
  box.scrollIntoView?.({block:'nearest'});
 }
 function preview(req){
  const source=getDoc();
  if(!req.runId){
   const range=surveyedDesignRange(source,req.wall);
   if(!range||req.startMm<range.startMm||req.endMm>range.endMm){
    pending=null;
    show({ok:false,reason:'اختر امتدادًا داخل بداية الدواليب ونهايتها المحفوظتين في رفع هذا الجدار.'});return;
   }
  }
  const result=planWorkshopRow(source,req);
  pending=result.ok?{source,result,req}:null;show(result);
 }
 host.addEventListener('change',e=>{
  const obj=e.target;
  if(obj.matches('[data-pwr-location]')){
   loc=obj.value;if(loc.startsWith('wall:')){wall=loc.slice(5);tier='base';}
   draft=null;pending=null;render();return;
  }
  if(obj.name==='recipeId'||obj.name==='family'){
   const f=obj.closest('form');refreshRecipeForm(f,getFactoryCatalog(getDoc()));const def=getFactoryCatalog(getDoc()).families[obj.value];
   if(f.matches('[data-pwr-add]')&&def)f.elements.widthMm.value=def.minMm;
  }
  const form=obj.closest('form[data-pwr-plan]');
  if(form&&obj.name==='tier'){tier=obj.value;draft=null;pending=null;render();return;}
  if(form&&obj.name==='pantryId'){
   draft=readDraft(form);const choice=pantryContext(doc,loc.startsWith('run:')?loc.slice(4):null,obj.value),hasRice=choice.existing;
   if(!hasRice){draft.wanted.rice=!!obj.value&&choice.wanted;draft.riceMode=choice.req?.mode||'unknown';}
   pending=null;render();return;
  }
  if(form&&['rice','dishwasher','sink'].includes(obj.name)){draft=readDraft(form);pending=null;render();return;}
 },{signal});
 host.addEventListener('input',()=>{pending=null;const box=host.querySelector('[data-pwr-result]');if(box)box.innerHTML='';},{signal});
 host.addEventListener('submit',e=>{
  const f=e.target;e.preventDefault();
  if(f.matches('[data-pwr-add]')){
   const raw=new FormData(f),widthMm=Number(raw.get('widthMm')),spec=readRowModel(raw,widthMm),start=raw.get('startMm'),count=raw.get('drawerCount');
   const add={recipeId:String(raw.get('recipeId')),widthMm,use:String(raw.get('use')||''),...(start!==''&&start!=null?{startMm:Number(start)}:{}),...(spec?{modelSpec:spec}:{}),...(count!=null?{drawerCount:Number(count)}:{})};
   const defaults=readDraft(host.querySelector('[data-pwr-plan]'));
   preview({...defaults,tier,wall,runId:loc.startsWith('run:')?loc.slice(4):null,additions:[add]});return;
  }
  if(f.matches('[data-pwr-plan]')){
   draft=readDraft(f);preview({...draft,tier,wall,runId:loc.startsWith('run:')?loc.slice(4):null});return;
  }
  if(f.matches('[data-pwr-drawer]')){preview({runId:loc.slice(4),drawerChecks:{[f.dataset.pwrDrawer]:{[f.dataset.index]:readDrawerMeasurements(new FormData(f))}}});return;}
  if(f.matches('[data-pwr-rice]')){
   preview({runId:loc.slice(4),riceChecks:{[f.dataset.pwrRice]:readRiceForm(f)}});return;
  }
  if(f.matches('[data-pwr-pantry-supply]')){
   const raw=new FormData(f),id=f.dataset.pwrPantrySupply;
   preview({runId:loc.slice(4),pantrySupplies:{[id]:{sku:raw.get('sku'),model:raw.get('model'),reference:raw.get('reference')}}});return;
  }
  if(f.matches('[data-pwr-equipment]')){
   const id=f.dataset.pwrEquipment,data=new FormData(f);
   const dimensions=(keys,prefix)=>Object.fromEntries(keys.map(k=>[k,Number(data.get(prefix+k))]));
   const e=Object.fromEntries(['model','manual','source','surveyor','bearing'].map(k=>[k,String(data.get(k)||'').trim()]));
   e.required=dimensions(['width','depth','height'],'req');e.measured=dimensions(['width','depth','underside','floor'],'site');
   preview({runId:loc.slice(4),equipmentChecks:{[id]:e}});return;
  }
  if(!f.matches('[data-pwr-edit]'))return;
  const id=f.dataset.pwrEdit,runId=loc.slice(4),record=getDoc().room.workshop?.rows?.[runId]?.units.find(u=>u.id===id);
  if(!record){render();return;}
  const data=new FormData(f),locks=Object.fromEntries(Object.keys(checkTitles).map(k=>[k,data.has(k)]));
  const recipeId=data.get('family'),def=getFactoryCatalog(getDoc()).families[recipeId],semantic=def?.base||recipeId;
  const edit={use:String(data.get('use')||''),family:semantic==='upperStorage'?'storage':semantic,recipeId:String(recipeId).startsWith('custom-')?String(recipeId):'',locks};
  if((edit.recipeId||'')===(record.recipeId||'')&&edit.family===record.family){
   const choices=Array.from(f.querySelectorAll('[data-pwr-hardware]')).filter(q=>q.value).map(q=>[q.dataset.pwrHardware,q.value]);
   if(choices.length||record.hardwareChoices)edit.hardwareChoices=Object.fromEntries(choices);
  }
  const live=getDoc().kitchen.units.find(v=>v.id===id),spec=readRowModel(data,Number(data.get('widthMm')));
  if(spec&&JSON.stringify(spec)!==JSON.stringify(live?.modelSpec))edit.modelSpec=spec;
  if(data.has('drawerCount')&&Number(data.get('drawerCount'))!==(live?.drawerCount||3))edit.drawerCount=Number(data.get('drawerCount'));
  if(data.has('drawerCount')&&data.has('drawer0'))edit.drawerUses=Array.from({length:live?.drawerCount||3},(_,i)=>String(data.get('drawer'+i)||'').trim());
  for(const k of ['startMm','widthMm'])if(Number(data.get(k))!==record[k])edit[k]=Number(data.get(k));
  preview({runId,edits:{[id]:edit}});
 },{signal});
 host.addEventListener('click',e=>{
  if(e.target.closest('[data-pwr-survey]')){onAdvance?.('survey',wall?{wall}:{});return;}
  const track=e.target.closest('[data-pwr-track]');
  if(track){
   const id=track.getAttribute('data-pwr-track');
   if(track.hasAttribute('data-pwr-preview-unit')){
    const u=pending?.result?.row.units.find(u=>u.id===id),readout=host.querySelector('[data-pwr-track-readout]');
    if(u&&readout){readout.hidden=false;readout.textContent=(track.title||fmt(u.widthMm)+' مم')+' · من '+fmt(u.startMm)+' إلى '+fmt(u.startMm+u.widthMm)+' مم';}
   }else openUnitCard(id);
   return;
  }
  const rem=e.target.closest('[data-remove-drawer]');if(rem){preview({runId:loc.slice(4),drawerChecks:{[rem.dataset.removeDrawer]:{[rem.dataset.index]:null}}});return;}
  if(e.target.closest('[data-pwr-advance]')){onAdvance?.('structure');return;}
  const openEnd=e.target.closest('[data-pwr-open-end]');
  if(!openEnd&&!e.target.closest('[data-pwr-apply]')||!pending)return;
  if(getDoc()!==pending.source){pending=null;draft=null;render();tell('تغيّر المشروع منذ المعاينة. أعد حساب الصف.');return;}
  if(openEnd){preview({...pending.req,leavePairRemainder:true});return;}
  const out=pending.result,applied=apply(out.doc,'طُبّق صف المصنع في المسقط والمجسّم.');
  if(applied?.ok===false){tell(applied.reason);return;}
  loc='run:'+out.runId;pending=null;draft=null;render();
 },{signal});
 render();if(focus.unitId)openUnitCard(focus.unitId,focus.drawerIndex);return ()=>{controller.abort();clearCorner?.();clearComparison?.();};
}
