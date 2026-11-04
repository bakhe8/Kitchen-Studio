import {studioIcon} from './kitchen-tool-icons.js';
// Guidance reads the saved project. Moving between editors never completes a task.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actorNames={rep:'المندوب',customer:'العميل',engineer:'المهندس',factory:'المصنع',supplier:'المورّد'};
const stageNames={survey:'رفع الموقع',design:'التصميم',finish:'التشطيب',quote:'عرض السعر',release:'الإفراج للورشة',complete:'اكتمل اعتماد المشروع'};
const meta=task=>[stageNames[task.stage],actorNames[task.actor]].filter(Boolean).join(' · ');
function actionLabel(doc,t,quick){
 if(t.step==='placement')return 'تعديل الوحدة على الرسم';
 if(!quick.length)return 'فتح الخطوة';
 if(t.id==='visit.devices')return 'فتح قائمة الأجهزة';
 if(t.id.startsWith('visit.upper.'))return 'اختيار الصف العلوي';
 if(t.id.startsWith('visit.corner.'))return 'تحديد شكل الركن';
 if(t.id.startsWith('visit.cornice.'))return 'اختيار الكورنيش';
 if(t.id.startsWith('visit.feature.')){
  const f=doc?.kitchen?.features.find(x=>x.id===t.focus?.featureId);
  if(f?.kind==='window')return 'اختيار الستارة';
  if(f?.kind==='heater')return 'تحديد غطاء السخان';
 }
 if(t.id.startsWith('design.stone-window.'))return 'معاينة خيارات الشباك';
 if(t.id.startsWith('design.upstand.'))return 'اختيار نعلة وتحديد المورّد';
 if(t.id==='finish.review')return 'تغيير التشطيبات';
 return 'فتح التفاصيل';
}
export function createGuideSession(getDoc,load=()=>import('./kitchen-work-guide.js')){
 let state={status:'idle'},generation=0,running,api;
 const listeners=new Set();
 const publish=s=>{state=s;for(const fn of listeners)fn(s);};
 function refresh(retry=false){
  const doc=getDoc();
  if(!retry&&state.doc===doc)return running;
  const id=++generation;
  publish({status:'loading',doc});
  running=Promise.resolve().then(load).then(async domain=>{
   const report=await domain.kitchenWorkGuide(doc);
   if(id===generation&&doc===getDoc()){api=domain;publish({status:'ready',doc,report});}
  }).catch(()=>{if(id===generation&&doc===getDoc())publish({status:'error',doc});});
  return running;
 }
 function contains(task){
  return !!task&&state.status==='ready'&&state.doc===getDoc()&&
    [state.report.current,...state.report.tasks,...state.report.later].includes(task);
 }
 return {refresh,contains,read:()=>state,
  subscribe(fn){listeners.add(fn);fn(state);return ()=>listeners.delete(fn);},
  quick(task){return contains(task)?api.guideQuickAnswers?.(state.doc,task)||[]:[];},
  answer(task,choice){if(!contains(task))return {ok:false,reason:'تغيّر المشروع. راجع السؤال الحالي.'};
   return api.answerGuideQuestion(state.doc,task,choice);}
 };
}
export function guidePreview(state){
 if(state.status==='ready'){
  const task=state.report.current;
  if(task)return {label:meta(task),text:task.question};
  if(state.report.complete)return {label:'دليل المشروع',text:'اكتمل اعتماد التصميم للورشة'};
 }
 return {label:'دليل المشروع',text:state.status==='error'?'إعادة فحص المطلوب':'متابعة المشروع'};
}

export function mountWorkGuide(host,{guide,getDoc,apply,onAdvance,tell}){
 let current=null,others=[],working=false,feedback='';
 let detailsOpen=host.ownerDocument?.defaultView?.matchMedia('(min-width:980px)').matches??false;
 host.className='ws-screen project-guide';
 const otherButton=(t,i)=>'<li><button type="button" data-guide-other="'+i+'"><small>'+escape(actorNames[t.actor]||'')+'</small><span>'+escape(t.question)+'</span>'+studioIcon('next')+'</button></li>';
 function stagesList(items,offset){
  const stages=[...new Set(items.map(t=>t.stage))];
  return stages.map(stage=>{
   const rows=items.map((t,i)=>t.stage===stage?otherButton(t,offset+i):'').filter(Boolean);
   return '<details class="pg-phase"><summary><span>'+escape(stageNames[stage]||stage)+'</span><b>'+rows.length.toLocaleString('ar-SA')+'</b>'+studioIcon('chevron')+'</summary><ul>'+rows.join('')+'</ul></details>';
  }).join('');
 }
 function paint(state){
  current=null;others=[];
  if(state.status!=='ready'){
   host.innerHTML=state.status==='error'?'<h2>دليل المشروع</h2><p role="status">تعذّر التحقق من حالة المشروع.</p><button type="button" data-guide-retry>إعادة الفحص</button>':'<p role="status">جارٍ تحديد المطلوب من الرسم والقياسات…</p>';
   return;
  }
  const {report}=state;current=report.current;const seen=new Set(current?[current.id]:[]);
  const unique=items=>items.filter(t=>{if(!t||seen.has(t.id))return false;seen.add(t.id);return true;});
  // Later tasks may also appear in the complete list returned by the domain.
  const laterIds=new Set(report.later.map(t=>t.id));
  const now=unique(report.tasks.filter(t=>!laterIds.has(t.id))),later=unique(report.later);others=[...now,...later];
  const quick=current?guide.quick(current):[];
  let primary;
  if(current){
   primary='<div class="pg-current"><header class="pg-question-head"><p class="pg-kicker">'+studioIcon('target')+' المطلوب الآن</p><p class="pg-meta">'+escape(meta(current))+'</p></header><h2>'+escape(current.question)+'</h2>'+
    (current.why?'<p class="pg-why">'+escape(current.why)+'</p>':'')+
    (current.facts?.length?'<details class="pg-samples"><summary>التشطيبات المعروضة</summary><ul>'+current.facts.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul></details>':'')+
    '<div class="pg-actions">'+quick.map(answer=>'<button type="button" class="pg-answer" data-guide-answer="'+escape(answer.id)+'">'+escape(answer.label)+'</button>').join('')+
    '<button type="button" class="'+(quick.length?'pg-detail':'pg-answer')+'" data-guide-open>'+ actionLabel(state.doc,current,quick)+'</button></div></div>';
  }else if(report.complete){
   primary='<div class="pg-current"><p class="pg-kicker">دليل المشروع</p><h2>اكتمل اعتماد التصميم للورشة</h2><p>للمتابعة اختر مشروع الفريق وإيصال التصنيع في سجل الورشة.</p><button type="button" class="pg-answer" data-guide-tracking>متابعة أوامر الورشة</button></div>';
  }else primary='<div class="pg-current"><p class="pg-kicker">دليل المشروع</p><h2>لا توجد خطوة متاحة الآن</h2></div>';
  host.innerHTML=primary+(feedback?'<p role="status">'+escape(feedback)+'</p>':'')+(others.length?'<details class="pg-rest"'+(detailsOpen?' open':'')+'><summary>بقية الخطوات ('+others.length.toLocaleString('ar-SA')+')</summary>'+
   (now.length?'<h3>يمكن العمل عليها الآن</h3><ul class="pg-available">'+now.map(otherButton).join('')+'</ul>':'')+
   (later.length?'<h3>في مرحلة لاحقة</h3>'+stagesList(later,now.length):'')+'</details>':'');
 }
 async function click(e){
  const b=e.target.closest('button');if(!b||!host.contains(b)||working)return;
  if(b.hasAttribute('data-guide-retry')){void guide.refresh(true);return;}
  if(b.hasAttribute('data-guide-tracking')&&guide.read().doc===getDoc()){onAdvance('tracking',{fromGuide:true});return;}
  const task=b.hasAttribute('data-guide-other')?others[Number(b.dataset.guideOther)]:current;
  if(!guide.contains(task)){void guide.refresh();return;}
  if(b.hasAttribute('data-guide-answer')){
   const source=getDoc();working=true;
   try{
    const out=await guide.answer(task,b.dataset.guideAnswer);
    if(!host.isConnected||source!==getDoc()||!guide.contains(task))return;
    if(!out?.ok){feedback=out?.reason||'تعذّر حفظ الإجابة.';paint(guide.read());return;}
    const saved=apply(out.doc,'حُفظت الإجابة.');
    feedback=saved?.ok===false||saved?.saved===false?(saved.reason||'تعذّر حفظ الإجابة في المتصفح.'):'';
    if(feedback)tell?.(feedback);
    void guide.refresh();if(guide.read().status==='ready')paint(guide.read());
   }catch{if(host.isConnected){feedback='تعذّر حفظ الإجابة. راجع بيانات الخطوة.';paint(guide.read());}}finally{working=false;}
  }else if(task)onAdvance(task.step,task.focus||{});
 }
 function toggle(e){if(e.target.classList?.contains('pg-rest'))detailsOpen=e.target.open;}
 host.addEventListener('click',click);host.addEventListener('toggle',toggle,true);
 const unsubscribe=guide.subscribe(paint);void guide.refresh();
 return ()=>{unsubscribe();host.removeEventListener('click',click);host.removeEventListener('toggle',toggle,true);};
}
