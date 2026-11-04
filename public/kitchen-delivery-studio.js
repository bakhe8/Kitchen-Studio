import {jobPrompt,packingLabelHTML} from './kitchen-order-tracking-ui.js';
import {outputFilename} from './kitchen-drawing-output.js';
import {deliveryDrawing} from './kitchen-delivery-drawing.js';
import {deliveryObservations} from './kitchen-delivery-domain.js';
import {deliveryDraftKey,newDeliveryDraft,readDeliveryDraft,saveDeliveryDraft,editDeliveryDraft,deliveryHistory,draftSignature,deliveryReading,deliveryBody} from './kitchen-delivery-draft.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={issued:'أُفرج عن التصنيع',planned:'ينتظر فحص الجودة',passed:'اجتاز فحص الجودة',packed:'جاهز للتركيب',installed:'مركّب · ينتظر الاستلام',accepted:'استلمه العميل'};
const actions={plan:'تثبيت مرجع السماحات',qc:'تسجيل نتيجة الفحص',pack:'إثبات التغليف',install:'إثبات التركيب',accept:'توثيق استلام العميل',observe:'تسجيل الملاحظة',resolve:'توثيق المعالجة','warranty-record':'توثيق شروط الضمان','service-open':'بلاغ صيانة','service-review':'تشخيص الخدمة والتغطية','service-repair':'إصلاح وفحص الخدمة','service-close':'اعتماد العميل للخدمة','service-reopen':'إعادة فتح بلاغ الخدمة'};
const uuid=()=>globalThis.crypto.randomUUID();
const button=(id,label,disabled=false)=>'<button type="button" data-ja="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
const select=(key,label,options,value)=>'<label>'+label+'<select data-jobs="'+key+'">'+options.map(([id,text])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>';
async function api(path,q={},data,subject){
 const res=await fetch(path+'?'+new URLSearchParams(q),{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json','X-Studio-Request':'1',...(subject?{'X-Studio-Subject':subject}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 if(!res.headers.get('content-type')?.includes('application/json'))throw Error('سجّل الدخول وافتح مشروعًا سحابيًا لعرض أوامر الورشة.');
 const value=await res.json();if(!res.ok){const e=Error(value.error||'تعذّر تحميل أمر الورشة.');e.status=res.status;throw e;}return value;
}
export function mountDeliveryStudio(host,{tell,onAdvance,focus={},canEdit=()=>true}={}){
 if(globalThis.document?.head&&!document.querySelector('link[data-delivery-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./kitchen-delivery-studio.css';link.dataset.deliveryCss='';document.head.append(link);}
 let storage;try{storage=globalThis.localStorage;}catch{/* Explicit save reports unavailable storage. */}
 let closed=false,busy=false,presentationError=false,msg='جارٍ تحميل أوامر الورشة…',projects=[],pid=focus.projectId||'',receipts=[],receipt=focus.receipt||'',job=null,uid=focus.unitId||'',mode='',resolutionTarget='',selectedCheck='',selectedPin='',receiptListLoaded=false,leave=null;
 const drafts=new Map(),modes=new Map();
 const context=()=>{const unit=job?.units.find(u=>u.id===uid),history=job?.events.filter(e=>e.unit===uid)||[],last=history.at(-1);return {unit,history,state:last?.state||'issued',seq:last?.seq||0,plan:history.find(e=>e.action==='plan')?.data,observations:deliveryObservations(history)};};
 const modeToken=()=>mode==='resolve'?'resolve:'+resolutionTarget:mode;
 const binding=(action=modeToken())=>({subject:job?.subject,project:pid,receipt,unit:uid,action});
 const baseKey=()=>deliveryDraftKey(binding(''));
 const key=()=>deliveryDraftKey(binding());
 const editable=()=>!closed&&!busy&&!!job?.subject&&['owner','factory'].includes(job?.role)&&canEdit();
 function currentDraft(){
  const c=context();if(!c.unit||!mode||!job?.subject)return null;
  const k=key();if(!drafts.has(k))drafts.set(k,readDeliveryDraft(storage,k,job.revision,c.seq,mode));
  const d=drafts.get(k);
  // Merely opening a stage does not create a stale inspection. Rebase only an
  // untouched, empty form; real saved/edited drafts retain their original seq.
  if((d.expected!==c.seq||d.revision!==job.revision)&&!Object.keys(d.raw).length&&!d.anchor&&!d.observationId&&!d.attempt&&!d.undo.length&&!d.redo.length)drafts.set(k,newDeliveryDraft(job.revision,c.seq,mode));
  return drafts.get(k);
 }
 const stale=d=>!!d&&(d.revision!==job?.revision||d.expected!==context().seq);
 const changed=d=>!!d&&draftSignature(d)!==d.saved;
 const hasPending=()=>busy||[...drafts.values()].some(changed);
 function rememberMode(){if(!job?.subject)return;const b=baseKey();modes.set(b,modeToken());}
 function pickMode(){
  const c=context(),b=baseKey();let stored;try{stored=storage?.getItem(b);}catch{/* keep fresh selection */}
  const token=modes.get(b)||stored||'',wanted=token.startsWith('resolve:')?'resolve':token,allowed=['plan','qc','pack','install','accept','observe','resolve'];
  resolutionTarget=wanted==='resolve'?token.slice(8):'';
  mode=allowed.includes(wanted)?wanted:jobPrompt(c.state,job?.role)?.next||'';
  selectedCheck=c.unit?.checks[0]?.key||'';selectedPin='';currentDraft();
 }
 function save(){const d=currentDraft();if(!d)return true;try{presentationError=false;saveDeliveryDraft(storage,key(),d);storage.setItem(baseKey(),modeToken());msg='حُفظت المسودة على هذا الجهاز. لم يُسجّل محضر في أمر الورشة.';return true;}catch(e){presentationError=true;msg='تعذّر حفظ المسودة: '+e.message;return false;}}
 function discardCurrent(){presentationError=false;const d=currentDraft();if(!d)return;try{storage?.removeItem(key());storage?.removeItem(baseKey());}catch{/* memory can still be cleared */}drafts.delete(key());mode=jobPrompt(context().state,job?.role)?.next||'';rememberMode();currentDraft();msg='أُلغيت المسودة. سجل الورشة كما هو.';}
 function guard(fn){if(changed(currentDraft())){leave=fn;draw();return false;}fn();return true;}
 function changeMode(next,patch={}){guard(()=>{mode=next;resolutionTarget=next==='resolve'?patch.observationId||resolutionTarget:'';rememberMode();const d=currentDraft();if(d&&!d.attempt&&Object.keys(patch).length)editDeliveryDraft(d,patch);draw();});}
 function setDraft(patch){const d=currentDraft();if(!editable()||!d||stale(d)||d.attempt)return false;const ok=editDeliveryDraft(d,patch);if(ok){presentationError=false;msg='مسودة قيد التعديل';}return ok;}
 function readingMarkup(c,d){
  if(!d||!['plan','qc'].includes(d.action))return '';
  return '<div class="dl-checks">'+c.unit.checks.map(f=>{const value=d.raw['check:'+f.key]??'',r=d.action==='qc'?deliveryReading(f,value,c.plan?.tolerances?.[f.key]):null;
   return '<div class="dl-check" data-selected="'+(selectedCheck===f.key)+'"><button type="button" data-delivery-check="'+esc(f.key)+'">'+esc(f.label)+'</button><label><span>الاسمي '+esc(f.nominal)+' '+esc(f.unit)+(d.action==='qc'?' · ±'+esc(c.plan?.tolerances?.[f.key]):f.maxTolerance!=null?' · أقصى سماحة '+esc(f.maxTolerance):'')+'</span><input type="text" inputmode="decimal" required data-jcheck="'+esc(f.key)+'" value="'+esc(value)+'" aria-label="'+esc((d.action==='plan'?'سماحة ':'القياس الفعلي ')+f.label)+'" placeholder="'+(d.action==='plan'?'السماحة':'القراءة الفعلية')+'"></label><small data-reading="'+esc(f.key)+'">'+esc(r?.label||'السماحة من مستند الورشة')+'</small></div>';
  }).join('')+'</div>';
 }
 function field(d,name,label,max,area=false){const value=esc(d.raw[name]??'');return '<label>'+label+(area?'<textarea':'<input type="text"')+' name="'+name+'" data-delivery-field="'+name+'" required maxlength="'+max+'"'+(area?'>'+value+'</textarea>':' value="'+value+'">')+'</label>';}
 function canAction(action,c){
  if(!editable())return false;if(['observe','resolve'].includes(action))return ['packed','installed'].includes(c.state);
  const p=jobPrompt(c.state,job?.role);return !!p?.editable&&p.next===action;
 }
 function stageForm(c,d){
  if(!d)return '';
  const blocked=c.observations.filter(o=>o.severity==='blocking'&&!o.resolved),isStale=stale(d),allowed=canAction(d.action,c);
  let fields='',heading=actions[d.action]||'',extra='';
  if(d.action==='observe'){
   fields=field(d,'text','وصف الملاحظة المشتركة مع فريق الورشة',500,true)+'<label>أثر الملاحظة<select data-delivery-field="severity"><option value="blocking"'+((d.raw.severity||'blocking')==='blocking'?' selected':'')+'>تمنع التركيب والاستلام حتى المعالجة</option><option value="info"'+(d.raw.severity==='info'?' selected':'')+'>للتوثيق فقط</option></select></label>';
   extra='<p>انقر موضعًا على جسم الوحدة، أو اختر فحصًا من القائمة.</p>'+button('center','وضع الملاحظة في منتصف الوحدة')+'<p data-anchor-label>'+anchorLabel(d.anchor,c.unit)+'</p>';
  }else if(d.action==='resolve'){
   const note=c.observations.find(o=>o.id===d.observationId);extra='<blockquote>'+esc(note?.text||'اختر ملاحظة من الرسم أو القائمة')+'</blockquote>';fields=field(d,'note','ما المعالجة المنفذة ونتيجة إعادة الفحص؟',500,true);
  }else if(d.action==='plan')fields=field(d,'reference','مرجع السماحات',180);
  else{fields=field(d,'note','نتيجة العمل أو مرجع المحضر',500,true);if(d.action==='install')fields+=field(d,'location','الموقع والجدار',160);if(d.action==='accept')fields+=field(d,'customer','اسم العميل الذي استلم الوحدة',140);}
  const locked=isStale||!!d.attempt||!allowed;
  return '<section class="dl-stage-form"><h3>'+heading+'</h3>'+extra+
   (d.action==='accept'?'<p>يوثّق المالك استلام العميل باسمه ومرجع المحضر.</p>':'')+
   (isStale?'<p class="dl-warning">تغيّر سجل الوحدة. هذه مسودة قديمة محفوظة للمراجعة؛ ألغها قبل إنشاء محضر جديد.</p>':'')+
   (!allowed&&!busy?'<p class="dl-warning">هذه العملية غير متاحة في المرحلة أو الصلاحية الحالية.</p>':'')+
   (blocked.length&&['install','accept'].includes(d.action)?'<p class="dl-warning">توجد '+blocked.length+' ملاحظة مانعة مفتوحة. عالجها قبل تأكيد المرحلة.</p>':'')+
   '<form'+(allowed?' data-job-form="'+d.action+'"':'')+'><fieldset'+(locked?' disabled':'')+'>'+readingMarkup(c,d)+fields+'</fieldset><div class="dl-draft-review" data-live-preview>'+previewText(c,d)+'</div>'+
   (allowed?'<button type="submit"'+(locked||blocked.length&&['install','accept'].includes(d.action)?' disabled':'')+'>'+heading+' في أمر الورشة</button>':'')+'</form>'+
   (d.attempt?'<p class="dl-warning">'+(d.attempt.ack?'أقرّ الخادم تسجيل العملية. حدّث السجل لإكمال العرض.':'نتيجة الإرسال لم تتأكد. الحقول مقفلة حتى إعادة المحاولة بالطلب نفسه أو التحقق من السجل.')+'</p>'+button('retry',d.attempt.ack?'تحديث السجل بعد الحفظ':'إعادة المحاولة بالطلب نفسه'):'')+'</section>';
 }
 function anchorLabel(anchor,unit){if(!anchor)return 'لم يُحدد موضع بعد';return anchor.kind==='front'?'موضع على الجسم · '+Math.round(anchor.x*100)+'٪ أفقيًا، '+Math.round(anchor.y*100)+'٪ رأسيًا':'الفحص: '+esc(unit.checks.find(f=>f.key===anchor.key)?.label||anchor.key);}
 function previewText(c,d){
  if(d.action==='qc'){const values=c.unit.checks.map(f=>deliveryReading(f,d.raw['check:'+f.key],c.plan?.tolerances?.[f.key])),complete=values.filter(v=>v.valid).length,out=values.filter(v=>v.valid&&!v.ok).length;return 'قراءات فعلية '+complete+' / '+values.length+(out?' · '+out+' خارج السماحة':'')+' · الأبعاد الاسمية ثابتة';}
  if(d.action==='observe')return d.anchor?'ستُربط الملاحظة بهذه الوحدة وموضعها في الإيصال.':'اختر موضع الملاحظة أولًا.';
  return 'التراجع يخص المسودة. المحاضر المسجّلة تبقى في سجل الورشة.';
 }
 function drawCanvas(c,d){return deliveryDrawing(c.unit,{observations:c.observations,selectedId:selectedPin,selectedCheck,draftAnchor:d?.action==='observe'?d.anchor:null,actual:d?.action==='qc'?Object.fromEntries(c.unit.checks.map(f=>[f.key,d.raw['check:'+f.key]])):{},tolerances:c.plan?.tolerances||{}});}
 function draftStatus(d){return !d?(context().state==='accepted'?'اكتمل الاستلام · السجل للقراءة':'اختر وحدة للفحص'):d.attempt?'عملية قيد التحقق':stale(d)?'مسودة من سجل أقدم':changed(d)?'مسودة غير محفوظة':!Object.keys(d.raw).length&&!d.anchor?'لا تعديلات على المسودة':'المسودة محفوظة محليًا · التسجيل في الورشة إجراء مستقل';}
 // Presentation hooks mirror current draft/API status; they never change a receipt or guard.
 function presentationState(d){return stale(d)?'stale':presentationError?'error':busy?'saving':d?.attempt?'submitting':changed(d)?'dirty':'clean';}
 function draw(){
  if(closed)return;const c=context(),d=currentDraft(),prompt=c.unit&&jobPrompt(c.state,job?.role),canNote=['packed','installed'].includes(c.state)&&editable();
  host.innerHTML='<section class="delivery-studio" data-state="'+presentationState(d)+'" data-mode="'+esc(mode)+'"><header class="dl-header"><div><p>دفتر التسليم · من الورشة إلى الموقع</p><h2>التركيب والتسليم</h2></div><div>'+button('refresh','تحديث أوامر الورشة')+(onAdvance?button('sync','مشاريع الفريق والإيصالات'):'')+'</div></header><div class="dl-status" role="status">'+esc(msg)+'</div>'+
   '<div class="dl-context">'+(projects.length?select('project','مشروع الفريق',[['','اختر مشروع الفريق'],...projects.map(p=>[p.id,p.name])],pid):'')+(pid?(receipts.length?select('receipt','إيصال التصنيع',[['','اختر إيصالًا وإصدارًا'],...receipts.map(r=>[r.receipt,(r.receipt.startsWith('full:')?'إفراج كامل':'دفعة')+' · إصدار '+r.revision+' · '+r.issued.slice(0,10)])],receipt):receiptListLoaded&&!busy?'<p>لا يوجد إيصال تصنيع مسجّل لهذا المشروع.</p>':''):'')+(job?.units.length?select('unit','الوحدة',[['','اختر الوحدة'],...job.units.map(u=>[u.id,u.name+' · '+u.id])],uid):'')+'</div>'+
   (leave?'<div class="dl-warning" role="alert"><p>لديك مسودة غير محفوظة. احفظها للعودة إليها أو اترك التعديلات.</p>'+button('leave-save','حفظ المسودة والمتابعة')+button('leave-discard','ترك التعديلات والمتابعة')+button('leave-stay','متابعة التعديل')+'</div>':'')+
   (job?'<p class="dl-receipt">إصدار الإيصال '+esc(job.revision)+' · '+esc(job.role==='owner'?'مالك المشروع':'فريق الورشة')+' · <bdi>'+esc(receipt.slice(0,21))+'…</bdi></p><div class="dl-workspace"><nav class="dl-objects" aria-label="وحدات إيصال الورشة"><h3>وحدات الأمر</h3>'+job.units.map(u=>{const events=job.events.filter(e=>e.unit===u.id),state=events.at(-1)?.state||'issued',open=deliveryObservations(events).filter(o=>!o.resolved);return '<button type="button" class="dl-unit" data-delivery-unit="'+esc(u.id)+'" aria-pressed="'+(uid===u.id)+'"><b>'+esc(u.name)+'</b><small>'+esc(u.id)+' · '+esc(names[state])+'</small><span>'+u.partCount+' قطع'+(open.length?' · '+open.length+' ملاحظة':'')+'</span></button>';}).join('')+'</nav>'+
    (c.unit?'<main class="dl-main"><ol class="dl-progress" aria-label="مراحل تنفيذ الوحدة">'+Object.entries(names).map(([state,label])=>'<li data-reached="'+(Object.keys(names).indexOf(state)<=Object.keys(names).indexOf(c.state))+'"'+(c.state===state?' aria-current="step"':'')+'>'+esc(label)+'</li>').join('')+'</ol><div class="dl-canvas-wrap"><div class="dl-canvas" data-delivery-canvas>'+drawCanvas(c,d)+'</div><div class="dl-hud">'+button('observe','＋ ملاحظة على الوحدة',!canNote)+button('stage',prompt?actions[prompt.next]:'اكتمل الاستلام',!prompt)+button('check-anchor','ربط الملاحظة بالفحص المحدد',!canNote||mode!=='observe'||!selectedCheck)+'</div></div><div class="dl-check-list">'+c.unit.checks.map(f=>'<button type="button" data-delivery-check="'+esc(f.key)+'" aria-pressed="'+(f.key===selectedCheck)+'">'+esc(f.label)+' · '+esc(f.nominal)+' '+esc(f.unit)+'</button>').join('')+'</div><section class="dl-pin-list"><h3>ملاحظات الوحدة <small>'+c.observations.filter(o=>!o.resolved).length+' مفتوحة</small></h3>'+c.observations.map(o=>'<article class="dl-observation" data-severity="'+esc(o.severity)+'" data-resolved="'+!!o.resolved+'"><button type="button" data-delivery-pin="'+esc(o.id)+'">'+esc(o.text)+'</button><p>'+esc(o.resolved?'عولجت':o.severity==='blocking'?'مانعة للتركيب والاستلام':'للتوثيق')+' · '+anchorLabel(o.anchor,c.unit)+'</p>'+(o.resolved?'<p>'+esc(o.resolution||'')+'</p>':'<button type="button" data-delivery-resolve="'+esc(o.id)+'"'+(!canNote?' disabled':'')+'>تسجيل المعالجة</button>')+'</article>').join('')+(!c.observations.length?'<p>لا توجد ملاحظات مسجّلة لهذه الوحدة.</p>':'')+'</section>'+downloads(c)+'<details class="dl-events"><summary>سجل الورشة والفحص · '+c.history.length+' أحداث</summary>'+c.history.map(e=>'<article><b>'+esc(actions[e.action]||e.action)+'</b><small>'+esc(e.date||'')+(e.who?' · '+esc(e.who):'')+'</small><p>'+esc(e.action==='qc'?(e.data.passed?'اجتاز الفحص':'خارج السماحة'):names[e.state])+' '+esc(e.data.note||e.data.reference||'')+'</p>'+(e.data.location?'<p>موقع التركيب: '+esc(e.data.location)+'</p>':'')+(e.data.customer?'<p>العميل المستلم: '+esc(e.data.customer)+'</p>':'')+(e.data.checks?'<p>'+Object.entries(e.data.checks).map(([k,v])=>esc(c.unit.checks.find(f=>f.key===k)?.label||k)+': '+esc(v.actual)+' (فرق '+esc(v.delta)+')').join(' · ')+'</p>':'')+'</article>').join('')+'</details></main><aside class="dl-inspector"><h3>'+esc(c.unit.name)+'</h3><p>'+esc(mode==='observe'?'ما الملاحظة وما موضعها على هذه الوحدة؟':mode==='resolve'?'ما المعالجة المنفذة وما نتيجة إعادة الفحص؟':prompt?.question||'اكتمل استلام هذه الوحدة')+'</p><div class="dl-status" data-draft-status>'+draftStatus(d)+'</div><div class="dl-actions">'+button('save','حفظ المسودة',!d||!!d.attempt)+button('undo','تراجع',!d?.undo.length||!!d?.attempt)+button('redo','إعادة',!d?.redo.length||!!d?.attempt)+button('discard','إلغاء المسودة',!d||!!d.attempt)+'</div>'+stageForm(c,d)+'</aside>':'<div class="dl-empty"><h3>اختر الوحدة من أمر الورشة</h3><p>الفحص والملاحظات يتبعان نسخة الإيصال المختار.</p></div>')+'</div>':'<div class="dl-empty"><h3>ابدأ من أمر الورشة الفعلي</h3><p>اختر مشروع الفريق وإيصال التصنيع. ستظهر وحداته وأبعاد الفحص المثبتة فيه.</p></div>')+'</section>';
  if(busy)for(const el of host.querySelectorAll('input,textarea,select,button'))el.disabled=true;
 }
 function downloads(c){return '<div class="dl-downloads">'+(c.unit.downloadableCut?'<a href="/api/jobs?'+esc(new URLSearchParams({id:pid,receipt,unit:uid,action:'surface-dxf'}))+'" download>قالب القص المقاس من الإيصال (DXF)</a>':'')+(c.unit.scribes||[]).map(s=>'<a href="/api/jobs?'+esc(new URLSearchParams({id:pid,receipt,unit:uid,shape:s.id,action:'scribe-dxf'}))+'" download>'+esc(s.label)+' (DXF)</a>').join('')+(c.history.some(e=>e.action==='pack')?button('label','بطاقة التغليف للطباعة'):'')+(c.state==='accepted'?button('maintenance','الصيانة وما بعد البيع لهذه الوحدة'):'')+'</div>';}
 function live(){const c=context(),d=currentDraft();if(!d)return;host.querySelector('.delivery-studio')?.setAttribute('data-state',presentationState(d));const status=host.querySelector?.('[data-draft-status]');if(status)status.textContent=draftStatus(d);const preview=host.querySelector?.('[data-live-preview]');if(preview)preview.textContent=previewText(c,d);
  for(const el of host.querySelectorAll('[data-reading]')){const f=c.unit.checks.find(f=>f.key===el.dataset.reading);if(f&&d.action==='qc')el.textContent=deliveryReading(f,d.raw['check:'+f.key],c.plan?.tolerances?.[f.key]).label;}
  const canvas=host.querySelector?.('[data-delivery-canvas]');if(canvas)canvas.innerHTML=drawCanvas(c,d);
  for(const action of ['undo','redo']){const el=host.querySelector?.('[data-ja="'+action+'"]');if(el)el.disabled=!d[action].length||!!d.attempt;}
 }
 async function loadJob(){
  const chosen={pid,receipt,uid};job=null;if(!receipt){uid='';mode='';return;}
  const loaded=await api('/api/jobs',{id:pid,receipt});if(closed||chosen.pid!==pid||chosen.receipt!==receipt)return;
  if(loaded.receipt!==receipt||!['owner','factory'].includes(loaded.role)||!loaded.subject)throw Error('تعذّر التحقق من هوية الحساب أو نطاق الإيصال.');job=loaded;
  if(!job.units.some(u=>u.id===uid))uid=job.units.length===1?job.units[0].id:'';
  if(uid)pickMode();else mode='';
 }
 async function loadProject(){job=null;receipts=[];receiptListLoaded=false;if(!pid){receipt=uid=mode='';return;}const chosen=pid,data=await api('/api/jobs',{id:pid});if(closed||chosen!==pid)return;if(!['owner','factory'].includes(data.role))throw Error('أوامر الورشة متاحة للمصنع أو المالك فقط.');receipts=data.receipts;receiptListLoaded=true;if(!receipts.some(r=>r.receipt===receipt))receipt=uid=mode='';await loadJob();}
 async function run(fn){if(busy||closed)return;busy=true;presentationError=false;draw();try{await fn();}catch(e){presentationError=true;msg=e.message;tell?.(msg);}finally{busy=false;draw();}}
 const refresh=()=>run(async()=>{job=null;receipts=[];receiptListLoaded=false;const data=await api('/api/projects');if(closed)return;projects=data.projects.filter(p=>['owner','factory'].includes(p.role));if(!projects.some(p=>p.id===pid))pid='';await loadProject();msg=projects.length?'السجل محدث من أوامر الورشة.':'لا توجد مشاريع محفوظة لهذا الحساب.';});
 async function transmit(){
  const d=currentDraft(),c=context();if(!d||!c.unit||!editable())return;
  if(!d.attempt){if(stale(d)||!canAction(d.action,c))return;let body;try{body=deliveryBody(d,c.unit,c.plan);}catch(e){presentationError=true;msg=e.message;draw();return;}d.attempt={id:uuid(),body,ack:null};try{saveDeliveryDraft(storage,key(),d);storage.setItem(baseKey(),modeToken());}catch(e){presentationError=true;d.attempt=null;msg='تعذّر تثبيت مسودة المحاولة قبل الإرسال: '+e.message;draw();return;}}
  const target={pid,receipt,subject:job.subject,unit:uid,key:key(),base:baseKey()},attempt=d.attempt;
  await run(async()=>{
   if(!attempt.ack){try{attempt.ack=await api('/api/jobs',{id:target.pid,receipt:target.receipt,request:attempt.id},attempt.body,target.subject);try{saveDeliveryDraft(storage,target.key,d);}catch{/* request identity remains recoverable */}}
    catch(e){if(e.status&&e.status<500){d.attempt=null;try{saveDeliveryDraft(storage,target.key,d);}catch{/* retain memory */}if([401,403,404].includes(e.status))job=null;else if(e.status===409){try{await loadJob();}catch{/* error below retains the rejection reason */}}}throw e;}}
   if(closed)return;const beforeRefresh=job;try{await loadJob();}catch(e){if(!e.status||e.status>=500)job=beforeRefresh;presentationError=true;msg='سُجّل الحدث في الورشة، وتعذّر تحديث العرض. أعد تحديث السجل.';return;}
   if(!job||job.subject!==target.subject||pid!==target.pid||receipt!==target.receipt){presentationError=true;msg='تغيّر الحساب أو الإيصال. أعد فتح سجل الوحدة.';return;}
   drafts.delete(target.key);try{storage?.removeItem(target.key);storage?.removeItem(target.base);}catch{/* old request replay remains idempotent */}
   mode=jobPrompt(context().state,job.role)?.next||'';rememberMode();currentDraft();msg=attempt.body.action==='qc'&&attempt.ack.state==='planned'?'سُجّل الفحص غير المطابق. صحّح السبب وأعد القياس.':'حُفظ الحدث في أمر الورشة: '+actions[attempt.body.action]+'.';
  });
 }
 function selectUnit(value){if(!job?.units.some(u=>u.id===value)&&value!=='')return;guard(()=>{uid=value;pickMode();draw();});}
 function onClick(e){if(busy||closed)return;const target=e.target,action=target.closest?.('[data-ja]')?.dataset.ja;
  if(action){
   if(action==='refresh')return guard(refresh);if(action==='sync')return onAdvance?.('sync');if(action==='maintenance')return onAdvance?.('maintenance',{projectId:pid,receipt,unitId:uid});
   if(action==='save'){save();draw();return;}if(action==='undo'||action==='redo'){const d=currentDraft();if(d&&editable()&&!stale(d))deliveryHistory(d,action==='redo');draw();return;}
   if(action==='discard'){if(!currentDraft()?.attempt)discardCurrent();draw();return;}
   if(action==='leave-stay'){leave=null;draw();return;}
   if(action==='leave-save'||action==='leave-discard'){const next=leave;if(action==='leave-save'&&!save()){draw();return;}if(action==='leave-discard')discardCurrent();leave=null;next?.();return;}
   if(action==='observe'){if(['packed','installed'].includes(context().state)&&editable())changeMode('observe');return;}
   if(action==='stage'){const next=jobPrompt(context().state,job?.role)?.next;if(next)changeMode(next);return;}
   if(action==='center'){const c=context();if(mode==='observe'&&c.unit.checks.some(f=>f.key==='width')&&c.unit.checks.some(f=>f.key==='height'))setDraft({anchor:{kind:'front',x:.5,y:.5}});else msg='اختر فحصًا من القائمة لهذه الوحدة.';draw();return;}
   if(action==='check-anchor'){if(mode==='observe'&&selectedCheck)setDraft({anchor:{kind:'check',key:selectedCheck}});draw();return;}
   if(action==='retry'){transmit();return;}
   if(action==='label'){const c=context(),event=c.history.find(e=>e.action==='pack');if(!event)return;const url=URL.createObjectURL(new Blob([packingLabelHTML(job,c.unit,event)],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=outputFilename(job.stamp,'packing-'+uid,'html');a.click();setTimeout(()=>URL.revokeObjectURL(url),12000);return;}
  }
  const unit=target.closest?.('[data-delivery-unit]')?.dataset.deliveryUnit;if(unit){selectUnit(unit);return;}
  const check=target.closest?.('[data-delivery-check]')?.dataset.deliveryCheck;if(check){selectedCheck=check;if(mode==='observe')setDraft({anchor:{kind:'check',key:check}});draw();const input=[...host.querySelectorAll('[data-jcheck]')].find(el=>el.dataset.jcheck===check);if(input)input.focus?.();else [...host.querySelectorAll('[data-delivery-check]')].find(el=>el.dataset.deliveryCheck===check)?.focus?.({preventScroll:true});return;}
  const resolution=target.closest?.('[data-delivery-resolve]')?.dataset.deliveryResolve;if(resolution){if(editable()&&context().observations.some(o=>o.id===resolution&&!o.resolved))changeMode('resolve',{observationId:resolution});return;}
  const pin=target.closest?.('[data-delivery-pin]')?.dataset.deliveryPin;if(pin){selectedPin=pin;draw();[...host.querySelectorAll('[data-delivery-pin]')].find(el=>el.dataset.deliveryPin===pin)?.focus?.({preventScroll:true});return;}
  const plane=target.closest?.('[data-delivery-plane]');if(plane&&mode==='observe'){const r=plane.getBoundingClientRect();if(r.width&&r.height)setDraft({anchor:{kind:'front',x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}});draw();}
 }
 function onChange(e){if(busy||closed)return;const k=e.target.dataset.jobs,v=e.target.value;
  if(k==='project'&&(!v||projects.some(p=>p.id===v)))guard(()=>{pid=v;receipt=uid=mode='';run(loadProject);});
  else if(k==='receipt'&&(!v||receipts.some(r=>r.receipt===v)))guard(()=>{receipt=v;uid=mode='';run(loadJob);});
  else if(k==='unit')selectUnit(v);
  else if(e.target.dataset.deliveryField)onInput(e);
 }
 function onInput(e){const d=currentDraft(),field=e.target.dataset.deliveryField,check=e.target.dataset.jcheck;if(!d||!field&&!check)return;if(check)selectedCheck=check;if(setDraft({raw:{...d.raw,[check?'check:'+check:field]:e.target.value}}))live();}
 function onSubmit(e){const form=e.target.closest?.('[data-job-form]');if(!form)return;e.preventDefault();if(form.dataset.jobForm===mode)transmit();}
 function onKey(e){if(e.key==='Escape'&&leave){leave=null;draw();}if(['Enter',' '].includes(e.key)&&e.target.matches?.('g[role="button"]')){e.preventDefault();onClick(e);}}
 host.addEventListener('click',onClick);host.addEventListener('change',onChange);host.addEventListener('input',onInput);host.addEventListener('submit',onSubmit);host.addEventListener('keydown',onKey);refresh();
 const destroy=()=>{closed=true;host.removeEventListener('click',onClick);host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.removeEventListener('submit',onSubmit);host.removeEventListener('keydown',onKey);};
 destroy.destroy=destroy;destroy.hasPending=hasPending;destroy.tracksDraft=()=>true;destroy.discard=()=>{for(const [k,d] of drafts)if(changed(d)){try{storage?.removeItem(k);}catch{/* memory discard */}drafts.delete(k);}leave=null;};
 destroy.requestLeave=proceed=>{if(busy){msg='انتظر انتهاء التحقق من العملية.';draw();return false;}if(hasPending()){leave=proceed;draw();return false;}return true;};
 destroy.commandContext=()=>({...focus,projectId:pid,receipt,unitId:uid});return destroy;
}
