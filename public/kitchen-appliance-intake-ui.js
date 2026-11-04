import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {saveApplianceRequest,removeApplianceRequest,unlinkAppliance,linkApplianceToHost,applianceFamilyOptions,applianceIntakeStatus,planIntakeReservations,intakeNames} from './kitchen-appliance-intake.js';
import {appliancePlacements} from './kitchen-device-types.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {libraries} from './kitchen-library-store.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,t,x)=>'<option value="'+esc(v)+'" '+(v===x?'selected':'')+'>'+esc(t)+'</option>';
const button=(k,t)=>'<button type="button" data-ar="'+k+'">'+t+'</button>';
const axes={width:'العرض',depth:'العمق',height:'الارتفاع'},place={bay:'حيز مخصص',inside:'داخل وحدة',counter:'فوق سطح'};
const text=(k,l,v,limit=160)=>'<label>'+l+'<input name="'+k+'" maxlength="'+limit+'" value="'+esc(v)+'"></label>';
const blank=()=>({width:null,depth:null,height:null});
function draft(){return {id:'req-'+(crypto.randomUUID?.()||Date.now().toString(36)).slice(0,36),kind:'fridge',name:'',model:'',manual:'',wall:'',recipe:'',host:'',placement:'bay',body:blank(),space:blank()};}
export function mountApplianceIntake(host,{getDoc,apply,tell,onAdvance,focus={},families,scoped=false}){
 const scopedMode=scoped||families!==undefined,availableFamilies=scopedMode?(families??{}):undefined;
 const controller=new AbortController(),signal=controller.signal;let edit=draft(),pending=null,ticket=0,saving=false,libraryNote='';
 const stored=()=>getDoc().room.workshop?.applianceIntake||[];
 const target=stored().find(r=>r.id===focus.requestId);if(target)edit=structuredClone(target);
 let field=target&&['model','manual','body','space','host'].includes(focus.field)?focus.field:null;
 const wanted=Array.isArray(focus.axes)?Object.keys(axes).filter(k=>focus.axes.includes(k)):Object.keys(axes);
 if((field==='body'||field==='space')&&!wanted.length)field=null;
 function read(f=new FormData(host.querySelector('[data-item]'))){
  const input=k=>String(f.get(k)??'').trim();
  for(const k of ['name','kind','model','manual','wall','recipe','placement'])if(f.has(k))edit[k]=input(k);
  for(const k of ['body','space'])for(const a of Object.keys(axes))if(f.has(k+a))edit[k][a]=assistNumber(f.get(k+a));
 }
 // The library of appliance models fills the card's name and sizes; what lands in the card is a copy, and the model number and
 // installation reference stay for the person to confirm from the appliance's own manual.
 function libraryPick(){
  if(scopedMode)return '';
  const models=libraries.list('appliance',{family:edit.kind});if(!models.length)return '';
  const size=m=>[m.attrs.bodyWidthMm,m.attrs.bodyHeightMm,m.attrs.bodyDepthMm].map(n=>n.toLocaleString('ar-SA')).join(' × ');
  return '<div class="site-library-pick"><label>من مكتبة الأجهزة<select data-library-pick>'+option('','اختر موديلًا لتعبئة الاسم والمقاسات','')+models.map(m=>option(m.id,m.label+(m.attrs.brand?' · '+m.attrs.brand:'')+' · '+size(m)+' مم','')).join('')+'</select></label>'+(libraryNote?'<p class="ws-subtle" role="status">'+esc(libraryNote)+'</p>':'')+'</div>';
 }
 function draw(){
  const d=getDoc(),rows=stored(),existing=rows.find(r=>r.id===edit.id),walls=roomArchitecture(d.room).walls,options=applianceFamilyOptions(d,edit,{families:availableFamilies});
  const size=(k,l,list=Object.keys(axes))=>'<fieldset><legend>'+l+'</legend><div class="ws-inline">'+list.map(a=>'<label>'+axes[a]+' · مم<input inputmode="decimal" name="'+k+a+'" value="'+esc(edit[k][a])+'"></label>').join('')+'</div></fieldset>';
  if(field&&existing){
   const captions={model:'رقم الموديل',manual:'مرجع دليل التركيب أو ورقة المورد',body:'أبعاد جسم الجهاز الفعلي',space:'حيز التركيب المطلوب حسب الدليل',host:'وحدة الجهاز في الرسم'};
   let control=field==='host'?'<label>'+captions.host+'<select data-host>'+option('','اختر الوحدة من الرسم',existing.host)+d.kitchen.units.map(u=>option(u.id,u.id+' · '+(u.modelSpec?.model||u.kind),existing.host)).join('')+'</select></label>':
    field==='model'||field==='manual'?text(field,captions[field],edit[field]):size(field,captions[field]+' · مم',wanted);
   const bodyReference=field==='space'?wanted.filter(a=>edit.body[a]!=null).map(a=>axes[a]+' '+edit.body[a]+' مم').join('، '):'';
   if(bodyReference)control+='<p>جسم الجهاز المسجّل · '+esc(bodyReference)+'</p>';
   const action=field==='host'?button('bind','ربط الجهاز بالوحدة'):'<button>حفظ ومتابعة</button>';
   host.innerHTML='<h2>'+esc(existing.name)+'</h2>'+(existing.model?'<p>الموديل · '+esc(existing.model)+'</p>':'')+
    '<form class="ws-card" data-item>'+control+action+'</form>'+button('full','فتح بطاقة الجهاز كاملة');
   host.querySelector(field==='host'?'[data-host]':'[name="'+(field==='body'||field==='space'?field+wanted[0]:field)+'"]')?.focus();
   return;
  }
  const measuredWalls=surveyedDesignWalls(d);
  const catalogueNote=scopedMode?'<p class="ws-subtle">تظهر خيارات الحيز المسموح بها لدورك. يُحسب حجز الوحدات وتغيير مقاساتها من بدائل التصميم على الخادم.</p>':readWorkshopCatalog(d.room.workshop)?.approved?'':'<p class="ws-subtle">كتالوج المشروع ينتظر اعتماد المصنع. حجز الحيز هنا مبدئي.</p>';
  host.innerHTML='<h2>أجهزة العميل</h2><p>سجّل الجهاز ومقاساته من دليل التركيب لتحديد الحيز الذي يحتاجه في التصميم.</p>'+catalogueNote+
   '<label>بطاقة الجهاز<select data-choose>'+option('','جهاز جديد',existing?null:'')+rows.map(r=>option(r.id,r.name+(r.model?' · '+r.model:''),edit.id)).join('')+'</select></label>'+
   '<div class="site-device-work"'+(existing||rows.length&&measuredWalls.length?' data-context':'')+'><form data-item class="ws-card site-device-form"><fieldset class="site-form-group"><legend>تعريف الجهاز</legend><label>النوع<select name="kind">'+Object.entries(intakeNames).map(([k,l])=>option(k,l,edit.kind)).join('')+'</select></label>'+libraryPick()+text('name','اسم يعرف به العميل هذا الجهاز',edit.name,100)+text('model','رقم الموديل',edit.model)+text('manual','مرجع دليل التركيب أو ورقة المورد',edit.manual)+
   '</fieldset><div class="site-device-sizes">'+size('body','جسم الجهاز الفعلي')+size('space','حيز التركيب شامل الخلوص')+'</div><fieldset class="site-form-group"><legend>موضع الجهاز في التصميم</legend><label>الموضع<select name="placement">'+appliancePlacements[edit.kind].filter(k=>k!=='bay'||!['other','counter'].includes(edit.kind)).map(k=>option(k,place[k],edit.placement)).join('')+'</select></label>'+
   '<label>الجدار الذي يريده العميل<select name="wall">'+option('','يسمح للبرنامج بالاقتراح',edit.wall)+walls.map(w=>option(w.id,w.label,edit.wall)).join('')+'</select></label>'+
   '<label>وصفة حيز الجهاز من المصنع<select name="recipe">'+option('','تلقائي إذا وجدت وصفة واحدة',edit.recipe)+(edit.recipe&&!options.some(f=>f.id===edit.recipe)?option(edit.recipe,'الوصفة المحفوظة تحتاج مراجعة · '+edit.recipe,edit.recipe):'')+options.map(f=>option(f.id,f.label,edit.recipe)).join('')+'</select></label>'+
   '</fieldset><div class="site-form-actions"><button>حفظ الجهاز في قائمة العميل</button>'+(!existing?'':button('new','بطاقة جهاز آخر')+(existing.host?button('unlink','فصل ربط الجهاز والإبقاء على الوحدة'):button('remove','إزالة من قائمة الطلب')))+'</div></form><div class="site-device-links">'+
   (existing?'<div class="ws-card"><p>'+esc(applianceIntakeStatus(d,existing).reason)+'</p><label>ربط أو تحديث على وحدة اختارها العميل<select data-host>'+d.kitchen.units.map(u=>option(u.id,u.id+' · '+(u.modelSpec?.model||u.kind),existing.host)).join('')+'</select></label>'+button('bind','تطبيق على الوحدة المحددة')+'</div>':'')+
   (rows.length&&measuredWalls.length&&scopedMode?'<section class="ws-card"><h3>حجز حيز الأجهزة</h3><p>احفظ بطاقات الأجهزة ثم افتح بدائل التصميم لحساب الحجز بوصفات المصنع على الخادم.</p>'+button('design','فتح بدائل التصميم')+'</section>':rows.length&&measuredWalls.length?'<section class="ws-card"><h3>اقتراح حجز الأجهزة دفعة واحدة</h3>'+rows.map(r=>'<label><input type="checkbox" data-item-id="'+esc(r.id)+'" '+(!r.host&&r.placement==='bay'?'checked':'disabled')+'> '+esc(r.name)+' · '+esc(applianceIntakeStatus(d,r).reason)+'</label>').join('')+
    '<p>جدران يسمح العميل باستخدامها</p>'+walls.filter(w=>measuredWalls.includes(w.id)).map(w=>'<label><input type="checkbox" data-wall-id="'+esc(w.id)+'" checked> '+esc(w.label)+'</label>').join('')+
    button('preview','حساب التوزيع')+'<div data-result role="status"></div></section>':'')+button('fit','مطابقة الأجهزة بالرفع والخدمات')+'</div></div>';
 }
 function commit(res,msg){
  if(!res.ok){tell(res.reason);return false;}
  const saved=apply(res.doc,msg);return saved?.ok!==false&&saved?.saved!==false;
 }
 function savedCard(){
  edit=structuredClone(stored().find(r=>r.id===edit.id)||draft());libraryNote='';invalidate();
  if(field&&onAdvance){onAdvance('guide');return;}
  field=null;draw();
 }
 function invalidate(){ticket++;pending=null;const r=host.querySelector('[data-result]');if(r)r.textContent='';}
 host.addEventListener('input',()=>invalidate(),{signal});
 host.addEventListener('change',e=>{
  if(e.target.hasAttribute('data-library-pick')){
   if(scopedMode)return;
   const m=libraries.get('appliance',e.target.value);if(!m)return;
   read();const a=m.attrs;
   if(!edit.name.trim())edit.name=m.label;
   if(a.model)edit.model=a.model;
   if(a.manual&&!edit.manual)edit.manual=a.manual;
   edit.body={width:a.bodyWidthMm,depth:a.bodyDepthMm,height:a.bodyHeightMm};
   edit.space={width:a.spaceWidthMm,depth:a.spaceDepthMm,height:a.spaceHeightMm};
   libraryNote='عُبّئت المقاسات من «'+m.label+'»'+(m.source==='generic'?'، وهي مقاسات تقريبية لمثال عام. اكتب رقم الموديل الفعلي وراجع المقاسات من دليل التركيب قبل الحفظ.':'. راجعها مع دليل التركيب قبل الحفظ.');
   invalidate();draw();return;
  }
  if(e.target.hasAttribute('data-choose')){edit=structuredClone(stored().find(v=>v.id===e.target.value)||draft());libraryNote='';invalidate();draw();}
  if(e.target.name==='kind'||e.target.name==='placement'){read();if(!appliancePlacements[edit.kind].includes(edit.placement)||edit.kind==='other'&&edit.placement==='bay')edit.placement=appliancePlacements[edit.kind][0];edit.recipe='';draw();}
 },{signal});
 host.addEventListener('submit',e=>{if(!e.target.matches('[data-item]'))return;e.preventDefault();if(field==='host')return;
  const values=new FormData(e.target);
  if(field){
   // Patch just the requested properties on the live card; the concealed
   // dimensions and every other appliance stay as recorded.
   const live=stored().find(r=>r.id===edit.id);
   if(!live){tell('تغيّرت قائمة الأجهزة. افتح السؤال الحالي من دليل المشروع.');return;}
   const sizes=field==='body'||field==='space';
   if(sizes&&wanted.some(a=>String(values.get(field+a)??'').trim()&&assistNumber(values.get(field+a))===null)){
    tell('أدخل مقاس الجهاز بالملليمتر.');return;
   }
   const changed=sizes?wanted.some(a=>live[field][a]!==target[field][a]):live[field]!==target[field];
   if(changed){tell('تغيّر القياس المطلوب في بطاقة الجهاز. أعد فتح السؤال الحالي.');return;}
   edit=structuredClone(live);
  }
  read(values);if(!edit.name)edit.name=intakeNames[edit.kind];
  if(commit(saveApplianceRequest(getDoc(),edit),'حُفظ الجهاز في طلب العميل.'))savedCard();
 },{signal});
 host.addEventListener('click',async e=>{
  const k=e.target.closest('[data-ar]')?.dataset.ar;if(!k)return;
  if(k==='full'&&field){
   if(field!=='host')read();field=null;draw();return;
  }
  if(k==='bind'&&field==='host'&&!host.querySelector('[data-host]')?.value){tell('اختر الوحدة المراد ربطها بالجهاز.');return;}
  if(k==='fit'){onAdvance?.('appliances');return;}
  if(k==='design'||scopedMode&&k==='preview'){tell('احفظ مسودة الأجهزة ثم احسب بدائل التصميم على الخادم.');onAdvance?.('design');return;}
  if(k==='new'){edit=draft();libraryNote='';invalidate();draw();return;}
  const doc=getDoc();
  if(k==='preview'){
   if(saving)return;const ids=[...host.querySelectorAll('[data-item-id]:checked')].map(x=>x.dataset.itemId),walls=[...host.querySelectorAll('[data-wall-id]:checked')].map(x=>x.dataset.wallId),epoch=++ticket,box=host.querySelector('[data-result]');
   pending=null;saving=true;box.textContent='جارٍ حساب الحجز من المقاسات…';
   try{const res=await planIntakeReservations(doc,{ids,walls,pause:()=>new Promise(r=>setTimeout(r,0)),cancel:()=>signal.aborted||epoch!==ticket||doc!==getDoc(),families:availableFamilies,scoped:scopedMode});
    if(!signal.aborted&&epoch===ticket&&doc===getDoc()){if(!res.ok){box.textContent=res.reason;return;}pending={res,doc};
     box.innerHTML=res.placed.map(x=>{const r=stored().find(r=>r.id===x.id),w=roomArchitecture(doc.room).walls.find(w=>w.id===x.wall);return '<p>'+esc(r.name)+' · '+esc(w.label)+' · '+esc(x.host)+' · '+r.space.width+' مم محجوزة</p>';}).join('')+button('apply','اعتماد هذا التوزيع على الرسم');}
   }finally{saving=false;}return;
  }
  if(k==='apply'){if(!pending||pending.doc!==doc){tell('تغير الرسم، أعد الحساب.');return;}if(commit(pending.res,'حُجزت الأجهزة وأُنشئت بطاقات فحصها من الموديلات المسجلة.')){edit=draft();invalidate();draw();}return;}
  const result=k==='remove'?removeApplianceRequest(doc,edit.id):k==='unlink'?unlinkAppliance(doc,edit.id):k==='bind'?linkApplianceToHost(doc,edit.id,host.querySelector('[data-host]')?.value,{families:availableFamilies,scoped:scopedMode}):null;
  if(result?.nextStep==='design'){tell(result.reason);onAdvance?.('design');return;}
  if(result&&commit(result,'حُدّث ارتباط الجهاز.'))savedCard();
 },{signal});draw();return ()=>{ticket++;controller.abort();};
}
