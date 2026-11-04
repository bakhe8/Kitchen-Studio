import {projectDecisions,updateDecisionReview,existingDeviceListKey,confirmExistingDeviceList} from './kitchen-project-decisions.js';
import {surveyedDesignRange} from './kitchen-chain-model.js';
import {roomArchitecture} from './kitchen-architecture.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountProjectDecisions(host,{getDoc,apply,tell,onAdvance,focus={}}){
 const c=new AbortController();let list=[];
 function draw(){
  const doc=getDoc(),w=doc.room.workshop||{},d=projectDecisions(doc);list=d.items;
  const walls=roomArchitecture(doc.room).walls;
  const selected=d.review.active?d.review.walls:focus.chooseWalls?[]:Object.keys(w.chains||{});
  if(focus.chooseWalls){
   host.innerHTML='<section class="sv-scope"><div class="sv-scope-intro"><small>بعد رفع الموقع</small><h2>على أي جدران يريد العميل دواليب؟</h2>'+
    '<p>اختر الجدران المرفوعة التي سيُقترح عليها التوزيع.</p></div><form class="sv-scope-form"><fieldset><legend>جدران التفصيل</legend>'+
    walls.map((a,i)=>{const ready=!!surveyedDesignRange(doc,a.id);return '<label><input type="checkbox" name="wall" value="'+esc(a.id)+'"'+(ready&&selected.includes(a.id)?' checked':'')+(ready?'':' disabled')+'><b>'+new Intl.NumberFormat('ar-SA').format(i+1)+' · '+esc(a.label)+'</b><small>'+(ready?'رفع محفوظ':w.chains?.[a.id]?.rows?.length?'راجع حدود التفصيل أو إغلاق الجدار':'لم يُرفع')+'</small></label>';}).join('')+
    '</fieldset><p data-scope-result role="status"></p><button class="sv-scope-submit">حفظ الاختيار ومتابعة التصميم</button></form></section>';
   return;
  }
  const card=(v,i)=>'<article class="ws-card"><h3>'+esc(v.name)+'</h3><p>'+esc(v.value)+'</p><button type="button" data-go="'+i+'">فتح '+esc({row:'تخصيص الصف',intake:'قائمة الأجهزة',survey:'الرفع',wallOptions:'خيارات الجدار',corner:'تفصيل الركن'}[v.step])+'</button> '+
    (v.focus.canDecline?'<button data-decline="'+i+'">اختار العميل عدم تنفيذ ركن هنا</button>':'')+(v.focus.canReopen?'<button data-reopen="'+i+'">إعادة فتح القرار</button>':'')+
    (v.id==='devices'&&v.open&&!w.applianceIntake?.length&&existingDeviceListKey(doc)?'<p>'+w.applianceFit.devices.map(d=>esc(d.name+' · '+d.model)).join('، ')+'</p><button data-list-confirm="'+existingDeviceListKey(doc)+'">تأكيد أن القائمة الظاهرة تشمل كل أجهزة العميل</button>':'')+
    (v.id==='devices'&&!w.applianceIntake?.length&&!w.applianceFit?.devices?.length?'<button data-no-devices>'+ (d.review.noCustomerDevices?'إعادة فتح قرار الأجهزة':'أكد العميل أنه لن يورّد أجهزة')+'</button>':'')+'</article>';
  host.innerHTML='<h2>قرارات الزيارة مع العميل</h2><p>اختر الجدران التي يشملها المحضر، ثم احسم البنود المفتوحة مع العميل.</p><form class="ws-card"><fieldset><legend>جدران هذا المحضر</legend>'+walls.map(a=>'<label><input type="checkbox" name="wall" value="'+esc(a.id)+'" '+(selected.includes(a.id)?'checked':'')+'>'+esc(a.label)+'</label>').join('')+'</fieldset><button>'+(d.review.active?'تحديث الجدران المعتمدة للمحضر':'بدء محضر اختيارات العميل')+'</button></form>'+
   '<p role="status">'+(d.review.active?'محضر مرتبط باعتماد الهيكل. ':'معاينة بحسب الرفع الموجود. ')+'تحتاج إلى مراجعة '+d.missing.length+' من '+list.length+' قرارات.</p>'+
   '<section class="site-open-decisions"><h3>بانتظار قرار العميل <small>'+new Intl.NumberFormat('ar-SA').format(d.missing.length)+'</small></h3>'+list.map((v,i)=>v.open?card(v,i):'').join('')+(d.missing.length?'':'<p>حُسمت جميع القرارات المسجلة.</p>')+'</section>'+
   (list.some(v=>!v.open)?'<details class="site-resolved"><summary>القرارات المحسومة · '+new Intl.NumberFormat('ar-SA').format(list.length-d.missing.length)+'</summary>'+list.map((v,i)=>v.open?'':card(v,i)).join('')+'</details>':'')+
   '<button type="button" data-advance>مراجعة الهيكل</button>';
 }
 function save(changes){const r=updateDecisionReview(getDoc(),changes);if(!r.ok){tell(r.reason);return;}if(apply(r.doc,'حُفظ قرار العميل في المشروع.')?.ok!==false)draw();}
 host.addEventListener('submit',e=>{
  e.preventDefault();const picked=new FormData(e.target).getAll('wall');
  if(!focus.chooseWalls){save({active:true,walls:picked});return;}
  const doc=getDoc(),result=host.querySelector('[data-scope-result]');
  if(!picked.length||picked.length>4){result.textContent='اختر من جدار واحد إلى أربعة جدران لهذا المقترح.';return;}
  if(picked.some(id=>!surveyedDesignRange(doc,id))){draw();tell('تغيّر رفع أحد الجدران. راجع الاختيار.');return;}
  const next=updateDecisionReview(doc,{active:true,walls:picked});
  if(!next.ok){result.textContent=next.reason;return;}
  const stored=apply(next.doc,'حُفظ اختيار العميل لجدران الدواليب.');
  if(stored?.ok===false||stored?.saved===false){result.textContent=stored.reason||'تعذّر حفظ اختيار العميل.';return;}
  onAdvance?.('whole');
 },{signal:c.signal});
 host.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const d=projectDecisions(getDoc()).review;
  if('go'in b.dataset){const r=list[Number(b.dataset.go)];if(r)onAdvance(r.step,r.focus);}
  if('decline'in b.dataset)save({noCorners:[...new Set([...d.noCorners,list[Number(b.dataset.decline)].focus.joint])]});
  if('reopen'in b.dataset)save({noCorners:d.noCorners.filter(k=>k!==list[Number(b.dataset.reopen)].focus.joint)});
  if('listConfirm'in b.dataset){const cur=getDoc(),key=existingDeviceListKey(cur);if(key!==b.dataset.listConfirm){draw();tell('تغيّرت الأجهزة المعروضة. راجع القائمة الحالية.');return;}const res=confirmExistingDeviceList(cur);if(res.ok&&apply(res.doc,'حُفظ تأكيد قائمة الأجهزة الحالية.')?.ok!==false)draw();}
  if('noDevices'in b.dataset)save({noCustomerDevices:!d.noCustomerDevices});
  if('advance'in b.dataset)onAdvance('approve');
 },{signal:c.signal});draw();return ()=>c.abort();
}
