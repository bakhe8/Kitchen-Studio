import {maintenanceDrawing} from './kitchen-maintenance-drawing.js';
import {serviceTickets,serviceWarranty,warrantyStatus} from './kitchen-maintenance-domain.js';
import {maintenanceDraftKey,newMaintenanceDraft,readMaintenanceDraft,saveMaintenanceDraft,editMaintenanceDraft,maintenanceHistory,draftSignature,maintenanceBody} from './kitchen-maintenance-draft.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions={'warranty-record':'توثيق شروط الضمان','service-open':'تسجيل البلاغ','service-review':'اعتماد التشخيص والتغطية','service-repair':'توثيق الإصلاح والفحص','service-close':'توثيق موافقة العميل','service-reopen':'إعادة فتح البلاغ'};
const states={open:'بلاغ مفتوح',reviewed:'التشخيص معتمد',repaired:'أُصلح · ينتظر العميل',closed:'مغلق بموافقة العميل'};
const periods={unknown:'الضمان غير موثّق',within:'ضمن الفترة الموثقة',expired:'الفترة الموثقة منتهية',upcoming:'الفترة الموثقة لم تبدأ'};
const coverageLabels={covered:'مشمول وفق الشروط',outside:'خارج التغطية الموثقة',goodwill:'خدمة استثنائية معتمدة'};
const nextFor=t=>({open:'service-review',reviewed:'service-repair',repaired:'service-close'}[t?.status]||'');
const btn=(id,label,disabled=false)=>'<button type="button" data-ms-action="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
const select=(key,label,options,value)=>'<label>'+label+'<select data-ms-context="'+key+'">'+options.map(([id,text])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>';
async function api(path,q={},body,subject){
 const response=await fetch(path+'?'+new URLSearchParams(q),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json','X-Studio-Request':'1','X-Studio-Subject':subject},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('افتح مشروع فريق بحساب مسجّل لعرض محاضر التسليم والخدمة.');
 const data=await response.json();if(!response.ok){const e=Error(data.error||'تعذّر تحميل سجل الخدمة.');e.status=response.status;throw e;}return data;
}
export function mountMaintenanceStudio(host,{tell,onAdvance,focus={},canEdit=()=>true}={}){
 if(globalThis.document?.head)for(const [tag,href] of [['delivery','kitchen-delivery-studio.css'],['maintenance','kitchen-maintenance-studio.css']])if(!document.querySelector('link[data-'+tag+'-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./'+href;link.setAttribute('data-'+tag+'-css','');document.head.append(link);}
 let storage;try{storage=globalThis.localStorage;}catch{/* save reports unavailable storage */}
 let closed=false,busy=false,msg='جارٍ تحميل محاضر التسليم…',projects=[],pid=focus.projectId||'',receipts=[],receipt=focus.receipt||'',job=null,uid=focus.unitId||'',tid=focus.ticketId||'',initialTicket=focus.ticketId||'',mode='',selectedCheck='',leave=null,listLoaded=false,filter='all';
 const drafts=new Map(),selections=new Map();
 const ctx=()=>{const unit=job?.units.find(u=>u.id===uid),events=job?.events.filter(e=>e.unit===uid)||[],tickets=serviceTickets(events);return {unit,events,seq:events.at(-1)?.seq||0,handover:events.find(e=>e.action==='accept'),warranty:serviceWarranty(events),tickets,ticket:tickets.find(t=>t.id===tid)};};
 const baseKey=()=>maintenanceDraftKey({subject:job?.subject,project:pid,receipt,unit:uid});
 const key=()=>maintenanceDraftKey({subject:job?.subject,project:pid,receipt,unit:uid,ticket:['warranty-record','service-open'].includes(mode)?'':tid,action:mode});
 const editable=()=>!closed&&!busy&&!!job?.subject&&['owner','factory'].includes(job.role)&&canEdit();
 const changed=d=>!!d&&draftSignature(d)!==d.saved;
 const stale=d=>!!d&&(d.revision!==job?.revision||d.expected!==ctx().seq);
 const pending=()=>busy||[...drafts.values()].some(changed);
 function draft(){
  const c=ctx();if(!c.unit||!mode||!job?.subject)return null;const k=key();if(!drafts.has(k))drafts.set(k,readMaintenanceDraft(storage,k,job.revision,c.seq,mode));
  const d=drafts.get(k);if(stale(d)&&!Object.keys(d.raw).length&&!d.anchor&&!d.attempt&&!d.undo.length&&!d.redo.length)drafts.set(k,newMaintenanceDraft(job.revision,c.seq,mode));return drafts.get(k);
 }
 const selection=()=>({tid,mode});
 function remember(){if(job?.subject)selections.set(baseKey(),selection());}
 function recoveryAction(ticketId){
  if(!job?.subject||!ctx().unit)return '';
  for(const action of ['service-open','service-review','service-repair','service-close','service-reopen','warranty-record']){
   const k=maintenanceDraftKey({subject:job.subject,project:pid,receipt,unit:uid,ticket:['service-open','warranty-record'].includes(action)?'':ticketId,action});
   const d=drafts.get(k)||readMaintenanceDraft(storage,k,job.revision,ctx().seq,action),a=d.attempt;
   if(!a||a.body?.unit!==uid||a.body?.action!==action)continue;
   if(action==='warranty-record'||action==='service-open'&&(!ticketId||a.id===ticketId)||a.body.ticketId===ticketId){drafts.set(k,d);return action;}
  }return '';
 }
 function chooseMode(){
  const c=ctx();let saved;try{saved=JSON.parse(storage?.getItem(baseKey())||'null');}catch{/* invalid selection is ignored */}
  const current=selections.get(baseKey())||saved;
  if(initialTicket&&uid===focus.unitId&&c.tickets.some(t=>t.id===initialTicket)){tid=initialTicket;mode=current?.tid===initialTicket&&Object.hasOwn(actions,current.mode)?current.mode:nextFor(c.tickets.find(t=>t.id===tid));initialTicket='';remember();}
  else if(current&&typeof current==='object'&&(!current.tid||c.tickets.some(t=>t.id===current.tid))){tid=current.tid||'';mode=Object.hasOwn(actions,current.mode)?current.mode:'';}
  else{if(!c.tickets.some(t=>t.id===tid))tid='';mode=tid?nextFor(c.tickets.find(t=>t.id===tid)):'service-open';}
  mode=recoveryAction(tid)||mode;selectedCheck=c.unit?.checks[0]?.key||'';draft();
 }
 function save(){const d=draft();if(!d)return true;try{saveMaintenanceDraft(storage,key(),d);storage.setItem(baseKey(),JSON.stringify(selection()));msg='حُفظت مسودة الخدمة على هذا الجهاز. تسجيل الحدث في السجل إجراء مستقل.';return true;}catch(e){msg='تعذّر حفظ المسودة: '+e.message;return false;}}
 function discard(){const d=draft();if(d?.attempt)return;try{storage?.removeItem(key());storage?.removeItem(baseKey());}catch{/* memory remains usable */}drafts.delete(key());mode=tid?nextFor(ctx().ticket):'service-open';remember();draft();msg='أُلغيت المسودة. سجل البلاغ ومحضر التسليم محفوظان.';}
 function guard(fn){if(changed(draft())){leave=fn;draw();return false;}fn();return true;}
 function edit(patch){const d=draft();if(!editable()||!d||d.attempt||stale(d))return false;const changed=editMaintenanceDraft(d,patch);if(changed)msg='مسودة خدمة قيد التعديل';return changed;}
 function canAction(action,c=ctx()){
  if(!editable()||!c.handover)return false;
  if(['warranty-record','service-review','service-close'].includes(action)&&job.role!=='owner')return false;
  if(['warranty-record','service-open'].includes(action))return true;
  if(action==='service-reopen')return ['repaired','closed'].includes(c.ticket?.status);
  return nextFor(c.ticket)===action;
 }
 function changeAction(action){guard(()=>{if(action==='service-open')tid='';mode=action;remember();draft();draw();[...host.querySelectorAll('.ms-stage-form input,.ms-stage-form textarea,.ms-stage-form select')].find(el=>!el.disabled&&!el.closest('fieldset[disabled]'))?.focus?.();});}
 function chooseTicket(id){if(!ctx().tickets.some(t=>t.id===id))return;guard(()=>{tid=id;mode=recoveryAction(tid)||nextFor(ctx().ticket);remember();draft();draw();const card=[...host.querySelectorAll('[data-ms-ticket]')].find(el=>el.dataset.msTicket===id),pin=[...host.querySelectorAll('[data-delivery-pin]')].find(el=>el.dataset.deliveryPin===id);(card||pin)?.focus?.({preventScroll:true});});}
 const anchorLabel=(a,c)=>!a?'لم يحدد موضع البلاغ':a.kind==='front'?'موضع على الجسم · '+Math.round(a.x*100)+'٪ أفقيًا / '+Math.round(a.y*100)+'٪ رأسيًا':'الفحص: '+esc(c.unit.checks.find(f=>f.key===a.key)?.label||a.key);
 function field(d,name,label,max,{area=false,type='text',required=true}={}){const value=esc(d.raw[name]??'');return '<label>'+label+(area?'<textarea':'<input type="'+type+'"')+' data-ms-field="'+name+'" name="'+name+'" maxlength="'+max+'"'+(required?' required':'')+(area?'>'+value+'</textarea>':' value="'+value+'">')+'</label>';}
 function formFields(c,d){
  if(d.action==='service-open')return field(d,'title','عنوان البلاغ',120)+field(d,'description','وصف المشكلة المشترك مع فريق الصيانة',500,{area:true})+'<label>الأولوية<select data-ms-field="priority"><option value="normal"'+((d.raw.priority||'normal')==='normal'?' selected':'')+'>اعتيادي</option><option value="urgent"'+(d.raw.priority==='urgent'?' selected':'')+'>عاجل</option></select></label>';
  if(d.action==='warranty-record')return field(d,'reference','مرجع وثيقة الضمان',180)+field(d,'provider','الجهة الضامنة',140)+field(d,'startsOn','بداية الفترة الموثقة',10,{type:'date'})+field(d,'endsOn','نهاية الفترة الموثقة',10,{type:'date'})+field(d,'coverage','نطاق الضمان كما في الوثيقة',500,{area:true})+field(d,'exclusions','الاستثناءات الموثقة إن وجدت',500,{area:true,required:false});
  if(d.action==='service-review')return field(d,'diagnosis','التشخيص وسبب قرار التغطية',500,{area:true})+'<label>قرار التغطية<select data-ms-field="coverage" required><option value="">اختر القرار بعد مراجعة الشروط</option>'+Object.entries(coverageLabels).map(([id,label])=>'<option value="'+id+'"'+(d.raw.coverage===id?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+field(d,'reference','مرجع قرار الخدمة',180);
  if(d.action==='service-repair')return field(d,'work','ما العمل المنفذ؟',500,{area:true})+field(d,'verification','نتيجة إعادة الفحص وتجربة التشغيل',500,{area:true});
  if(d.action==='service-close')return '<p>يوثّق المالك موافقة العميل بعد الإصلاح وإعادة الفحص.</p>'+field(d,'customer','اسم العميل المعتمد',140)+field(d,'note','مرجع محضر موافقة العميل ونتيجته',500,{area:true});
  return field(d,'reason','سبب إعادة الفتح أو عدم قبول نتيجة الإصلاح',500,{area:true});
 }
 function preview(c,d){
  if(!d)return '';
  if(d.action==='service-open')return anchorLabel(d.anchor,c)+' · '+periods[warrantyStatus(c.warranty,job.serverNow)]+'. التغطية تُحسم بعد التشخيص.';
  if(d.action==='service-review'){const status=warrantyStatus(c.warranty,c.ticket?.cycleOpenedAt);return 'تاريخ تسجيل هذه الدورة: '+esc(c.ticket?.cycleOpenedAt?.slice(0,10)||'—')+' · '+periods[status]+(d.raw.coverage==='covered'&&status!=='within'?' · اختيار «مشمول» يحتاج شروطًا موثقة سارية عند التسجيل.':' · يُحفظ قرار المالك مع نسخة شروطه.');}
  if(d.action==='warranty-record')return 'الشروط الجديدة تسجّل كحدث مستقل. قرارات البلاغات السابقة تحتفظ بشروطها المسجّلة.';
  if(d.action==='service-repair')return 'بعد توثيق الإصلاح يبقى البلاغ بانتظار موافقة العميل.';
  if(d.action==='service-reopen')return 'تبدأ دورة تشخيص وإصلاح واعتماد جديدة، مع الاحتفاظ بالتاريخ السابق.';
  return 'سيُغلق هذا البلاغ بعد توثيق موافقة العميل. محضر تسليم الوحدة يبقى محفوظًا.';
 }
 function draftStatus(d){return !d?'السجل للقراءة':d.attempt?'محاولة تسجيل قيد التحقق':stale(d)?'مسودة مرتبطة بتسلسل أقدم':changed(d)?'مسودة غير محفوظة':Object.keys(d.raw).length||d.anchor?'المسودة محفوظة محليًا':'لا تعديلات على المسودة';}
 function drawForm(c,d){
  if(!c.handover)return '<div class="dl-warning">يلزم محضر استلام مثبت لهذه الوحدة قبل فتح خدمة ما بعد البيع.</div>';
  if(!d)return '<div class="ms-empty-state"><h3>أُغلق البلاغ بموافقة العميل</h3><p>يمكن مراجعة المحضر أو تسجيل سبب عودة المشكلة.</p></div>';
  const allowed=canAction(d.action,c),locked=!allowed||stale(d)||!!d.attempt;
  return '<section class="ms-stage-form"><h3>'+esc(actions[d.action])+'</h3>'+(stale(d)?'<p class="dl-warning">تغيّر سجل الوحدة أو الضمان. المسودة محفوظة للمراجعة ومقفلة؛ ألغها قبل إعداد إجراء جديد.</p>':'')+(!allowed&&!busy?'<p class="dl-warning">هذا الإجراء يحتاج إلى المالك أو إلى اكتمال المرحلة السابقة.</p>':'')+
   (d.action==='service-open'?'<p>انقر جسم الوحدة لتحديد الموضع، أو اختر فحصًا من الرسم.</p>'+btn('center','موضع في منتصف الجسم',locked)+btn('check-anchor','ربط البلاغ بالفحص المحدد',locked||!selectedCheck):'')+
   '<form'+(allowed?' data-ms-form="'+d.action+'"':'')+'><fieldset'+(locked?' disabled':'')+'>'+formFields(c,d)+'</fieldset><p class="ms-preview" data-ms-preview>'+preview(c,d)+'</p>'+(allowed?'<button type="submit"'+(locked?' disabled':'')+'>'+esc(actions[d.action])+' في سجل الخدمة</button>':'')+'</form>'+
   (d.attempt?'<p class="dl-warning">'+(d.attempt.ack?'أقرّ الخادم الحفظ؛ يحتاج العرض إلى تحديث.':'لم تتأكد نتيجة الإرسال. أعد المحاولة بالمعرف والبيانات نفسيهما.')+'</p>'+btn('retry',d.attempt.ack?'تحديث السجل بعد الحفظ':'إعادة المحاولة بالطلب نفسه'):'')+'</section>';
 }
 function drawing(c,d){return maintenanceDrawing(c.unit,{tickets:c.tickets,selectedTicketId:tid,selectedCheck,draftAnchor:d?.action==='service-open'?d.anchor:null});}
 function records(c){const w=c.warranty,h=c.handover;return '<section class="ms-records"><article class="ms-handover"><h3>محضر تسليم الوحدة</h3>'+(h?'<p>استلام مثبت · '+esc(h.date?.slice(0,10))+' · الحدث '+h.seq+'</p>'+(h.data.customer?'<p>المستلم: '+esc(h.data.customer)+'</p>':'')+(h.data.note?'<p>'+esc(h.data.note)+'</p>':''):'<p>لم يُثبت استلام هذه الوحدة بعد.</p>')+btn('handover','فتح محضر التسليم')+'</article><article class="ms-warranty"><h3>الضمان · '+periods[warrantyStatus(w,job.serverNow)]+'</h3>'+(w?'<p><b>'+esc(w.provider)+'</b> · '+esc(w.reference)+'</p><p><bdi>'+esc(w.startsOn)+'</bdi> ← <bdi>'+esc(w.endsOn)+'</bdi></p><p>'+esc(w.coverage)+'</p>'+(w.exclusions?'<p>الاستثناءات: '+esc(w.exclusions)+'</p>':'')+'<small>سجل الضمان '+w.seq+' · القرارات السابقة تحتفظ بنسختها</small>':'<p>لم توثق شروط ضمان لهذه الوحدة. يمكن تسجيل البلاغ ومراجعة تغطيته.</p>')+btn('warranty',w?'توثيق تحديث شروط الضمان':'توثيق شروط الضمان',!c.handover||!editable()||job.role!=='owner')+'</article></section>';}
 function warrantyEvidence(w){return '<details class="ms-warranty-evidence"><summary>شروط الضمان المثبتة وقت هذا القرار</summary>'+(w?'<p>'+esc(w.provider)+' · '+esc(w.reference)+' · سجل '+esc(w.seq)+'</p><p><bdi>'+esc(w.startsOn)+'</bdi> ← <bdi>'+esc(w.endsOn)+'</bdi></p><p>'+esc(w.coverage)+'</p>'+(w.exclusions?'<p>الاستثناءات: '+esc(w.exclusions)+'</p>':''):'<p>لم تكن هناك شروط ضمان موثقة عند تسجيل هذا القرار.</p>')+'</details>';}
 function ticketHistory(ticket){return '<details class="ms-timeline" open><summary>سجل البلاغ · '+ticket.history.length+' أحداث</summary>'+ticket.history.map(e=>{const p=e.data;return '<article><b>'+esc(actions[e.action]||e.action)+'</b><small>'+esc(e.date)+(e.who?' · '+esc(e.who):'')+'</small>'+[p.diagnosis,p.work,p.verification,p.reason,p.note,p.customer?'العميل المعتمد: '+p.customer:''].filter(Boolean).map(text=>'<p>'+esc(text)+'</p>').join('')+(p.coverage?'<p>'+esc(coverageLabels[p.coverage])+' · '+esc(p.reference)+'</p>':'')+(e.action==='service-review'?warrantyEvidence(p.warranty):'')+'</article>';}).join('')+'</details>';}
 function draw(){
  if(closed)return;const c=ctx(),d=draft(),allowedNew=!!c.handover&&editable(),shownTickets=filter==='open'?c.tickets.filter(t=>t.status!=='closed'):c.tickets;
  host.innerHTML='<section class="delivery-studio maintenance-studio" data-mode="'+esc(mode)+'"><header class="dl-header"><div><p>دفتر الخدمة · من البلاغ إلى رضا العميل</p><h2>الصيانة وما بعد البيع</h2></div><div>'+btn('refresh','تحديث سجل الخدمة')+(onAdvance?btn('sync','مشاريع الفريق والإيصالات'):'')+'</div></header><p class="dl-status" role="status">'+esc(msg)+'</p><div class="dl-context">'+(projects.length?select('project','مشروع الفريق',[['','اختر مشروع الفريق'],...projects.map(p=>[p.id,p.name])],pid):'')+(pid?(receipts.length?select('receipt','إيصال التصنيع',[['','اختر إيصالًا وإصدارًا'],...receipts.map(r=>[r.receipt,(r.receipt.startsWith('full:')?'إفراج كامل':'دفعة')+' · إصدار '+r.revision+' · '+r.issued.slice(0,10)])],receipt):listLoaded?'<p>لا يوجد إيصال تصنيع مسجّل.</p>':''):'')+(job?.units.length?select('unit','الوحدة',[['','اختر الوحدة'],...job.units.map(u=>[u.id,u.name+' · '+u.id])],uid):'')+'</div>'+
   (leave?'<div class="dl-warning" role="alert"><p>لديك مسودة خدمة غير محفوظة.</p>'+btn('leave-save','حفظ المسودة والمتابعة')+btn('leave-discard','ترك التعديلات والمتابعة')+btn('leave-stay','متابعة التعديل')+'</div>':'')+
   (job?'<p class="ms-identity">إصدار الإيصال '+job.revision+' · '+esc(job.role==='owner'?'مالك المشروع':'فريق الصيانة')+' · <bdi>'+esc(receipt.slice(0,21))+'…</bdi></p><div class="dl-workspace ms-workspace"><nav class="dl-objects" aria-label="وحدات خدمة ما بعد البيع"><h3>الوحدات والبلاغات</h3>'+job.units.map(u=>{const ev=job.events.filter(e=>e.unit===u.id),count=serviceTickets(ev).filter(t=>t.status!=='closed').length;return '<button type="button" class="dl-unit" data-ms-unit="'+esc(u.id)+'" aria-pressed="'+(u.id===uid)+'"><b>'+esc(u.name)+'</b><small>'+esc(u.id)+' · '+(ev.some(e=>e.action==='accept')?'استلام مثبت':'بانتظار الاستلام')+'</small><span>'+count+' بلاغات مفتوحة</span></button>';}).join('')+'</nav>'+
   (c.unit?'<main class="dl-main"><header class="ms-unit-head"><h3>'+esc(c.unit.name)+'</h3><span>'+c.tickets.filter(t=>t.status!=='closed').length+' مفتوحة · '+(c.handover?'استلام مثبت':'لم تُسلّم بعد')+'</span></header><div class="dl-canvas-wrap"><div class="dl-canvas" data-ms-canvas>'+drawing(c,d)+'</div><div class="dl-hud">'+btn('new','＋ بلاغ على الوحدة',!allowedNew)+btn('next',actions[nextFor(c.ticket)]||'اختر بلاغًا للمتابعة',!nextFor(c.ticket))+btn('reopen','إعادة فتح البلاغ',!canAction('service-reopen',c))+'</div></div><div class="ms-ticket-list"><header><h3>بلاغات هذه الوحدة</h3><label>العرض<select data-ms-filter><option value="all"'+(filter==='all'?' selected':'')+'>جميع البلاغات</option><option value="open"'+(filter==='open'?' selected':'')+'>المفتوحة فقط</option></select></label></header>'+shownTickets.map((t,i)=>'<button type="button" class="ms-ticket" data-ms-ticket="'+esc(t.id)+'" aria-pressed="'+(tid===t.id)+'" data-state="'+t.status+'"><b>'+esc(t.title)+'</b><span>'+esc(states[t.status])+(t.priority==='urgent'?' · عاجل':'')+'</span><small>'+esc(t.openedAt?.slice(0,10))+' · '+esc(t.id.slice(0,8))+'</small></button>').join('')+(!shownTickets.length?'<p>لا توجد بلاغات في هذا العرض.</p>':'')+'</div>'+(c.ticket?ticketHistory(c.ticket):'')+'</main><aside class="dl-inspector"><div class="ms-case-detail"><h3>'+esc(c.ticket?.title||c.unit.name)+'</h3>'+(c.ticket?'<p>'+esc(c.ticket.description)+'</p><p class="ms-state">'+esc(states[c.ticket.status])+'</p><small>مرتبط بمحضر التسليم '+c.ticket.handoverSeq+'</small>':'<p>سجّل المشكلة في موضعها على الوحدة.</p>')+'</div><p class="dl-status" data-ms-draft-status>'+draftStatus(d)+'</p><div class="dl-actions">'+btn('save','حفظ المسودة',!d||!!d.attempt)+btn('undo','تراجع',!d?.undo.length||!!d?.attempt||stale(d))+btn('redo','إعادة',!d?.redo.length||!!d?.attempt||stale(d))+btn('discard','إلغاء المسودة',!d||!!d.attempt)+'</div>'+drawForm(c,d)+'</aside>':'<div class="dl-empty"><h3>اختر وحدة لمراجعة سجل خدمتها</h3><p>البلاغ مرتبط بالوحدة وإيصالها ومحضر استلامها.</p></div>')+'</div>'+(c.unit?records(c):''):'<div class="dl-empty"><h3>ابدأ من الوحدة المسلّمة</h3><p>اختر مشروع الفريق وإيصال التصنيع للاطلاع على التسليم والضمان والبلاغات.</p></div>')+'</section>';
  if(busy)for(const el of host.querySelectorAll('input,textarea,select,button'))el.disabled=true;
 }
 function live(){const c=ctx(),d=draft();if(!d)return;const state=host.querySelector?.('[data-ms-draft-status]');if(state)state.textContent=draftStatus(d);const p=host.querySelector?.('[data-ms-preview]');if(p)p.innerHTML=preview(c,d);const canvas=host.querySelector?.('[data-ms-canvas]');if(canvas)canvas.innerHTML=drawing(c,d);for(const a of ['undo','redo']){const el=host.querySelector?.('[data-ms-action="'+a+'"]');if(el)el.disabled=!d[a].length||!!d.attempt||stale(d);}}
 async function loadJob(){const chosen={pid,receipt};job=null;if(!receipt){uid=tid=mode='';return;}const value=await api('/api/jobs',{id:pid,receipt});if(closed||pid!==chosen.pid||receipt!==chosen.receipt)return;if(value.receipt!==receipt||!value.subject||!['owner','factory'].includes(value.role))throw Error('تعذّر إثبات الحساب أو نطاق إيصال الخدمة.');job=value;if(!job.units.some(u=>u.id===uid))uid=job.units.length===1?job.units[0].id:'';if(uid)chooseMode();else tid=mode='';}
 async function loadProject(){job=null;receipts=[];listLoaded=false;if(!pid){receipt=uid=tid=mode='';return;}const chosen=pid,value=await api('/api/jobs',{id:pid});if(closed||chosen!==pid)return;if(!['owner','factory'].includes(value.role))throw Error('سجل الخدمة متاح للمالك والمصنع.');receipts=value.receipts;listLoaded=true;if(!receipts.some(r=>r.receipt===receipt))receipt=uid=tid=mode='';await loadJob();}
 async function run(fn){if(busy||closed)return;busy=true;draw();try{await fn();}catch(e){msg=e.message;if(!closed)tell?.(msg);}finally{busy=false;draw();}}
 const refresh=()=>run(async()=>{job=null;receipts=[];listLoaded=false;const value=await api('/api/projects');if(closed)return;projects=value.projects.filter(p=>['owner','factory'].includes(p.role));if(!projects.some(p=>p.id===pid))pid='';await loadProject();msg=projects.length?'سجل الخدمة محدث من أوامر الورشة.':'لا توجد مشاريع فريق متاحة لهذا الحساب.';});
 async function transmit(){
  const d=draft(),c=ctx();if(!d||!c.unit||!editable())return;
  if(!d.attempt){if(stale(d)||!canAction(d.action,c))return;let body;try{body=maintenanceBody(d,c.unit,tid);}catch(e){msg=e.message;draw();return;}d.attempt={id:crypto.randomUUID(),body,ack:null};try{saveMaintenanceDraft(storage,key(),d);storage.setItem(baseKey(),JSON.stringify(selection()));}catch(e){d.attempt=null;msg='تعذّر تثبيت مسودة المحاولة قبل الإرسال: '+e.message;draw();return;}}
  const target={pid,receipt,unit:uid,ticket:tid,key:key(),base:baseKey(),subject:job.subject},attempt=d.attempt;
  await run(async()=>{
   if(!attempt.ack)try{attempt.ack=await api('/api/jobs',{id:target.pid,receipt:target.receipt,request:attempt.id},attempt.body,target.subject);try{saveMaintenanceDraft(storage,target.key,d);}catch{/* stable request retained */}}
   catch(e){if(e.status&&e.status<500){d.attempt=null;try{saveMaintenanceDraft(storage,target.key,d);}catch{/* keep raw memory */}if([401,403,404].includes(e.status))job=null;else if(e.status===409)try{await loadJob();}catch{/* retain original conflict */}}throw e;}
   if(closed)return;const before=job;try{await loadJob();}catch(e){if(!e.status||e.status>=500)job=before;msg='حُفظ حدث الخدمة، وتعذّر تحديث العرض. أعد تحديث السجل.';return;}
   if(!job||job.subject!==target.subject||pid!==target.pid||receipt!==target.receipt){msg='تغيّر الحساب أو الإيصال. افتح السجل بالحساب الصحيح.';return;}
   drafts.delete(target.key);try{storage?.removeItem(target.key);storage?.removeItem(target.base);}catch{/* replay remains idempotent */}
   tid=attempt.body.action==='service-open'?attempt.id:target.ticket;mode=tid?nextFor(ctx().ticket):'service-open';remember();draft();msg='حُفظ في سجل الخدمة: '+actions[attempt.body.action]+'.';
  });
 }
 function chooseUnit(id){if(id&&!job?.units.some(u=>u.id===id))return;guard(()=>{uid=id;tid='';chooseMode();draw();});}
 function onClick(e){if(closed||busy)return;const target=e.target,action=target.closest?.('[data-ms-action]')?.dataset.msAction;
  if(action){if(action==='refresh')return guard(refresh);if(action==='sync')return onAdvance?.('sync');if(action==='handover')return onAdvance?.('tracking',{projectId:pid,receipt,unitId:uid});
   if(action==='save'){save();draw();return;}if(action==='discard'){discard();draw();return;}if(action==='undo'||action==='redo'){const d=draft();if(d&&editable()&&!stale(d))maintenanceHistory(d,action==='redo');draw();return;}
   if(action==='leave-stay'){leave=null;draw();return;}if(['leave-save','leave-discard'].includes(action)){const next=leave;if(action==='leave-save'&&!save()){draw();return;}if(action==='leave-discard')discard();leave=null;next?.();return;}
   if(action==='new'){if(canAction('service-open'))changeAction('service-open');return;}if(action==='warranty'){if(canAction('warranty-record'))changeAction('warranty-record');return;}
   if(action==='next'){const next=nextFor(ctx().ticket);if(next)changeAction(next);return;}if(action==='reopen'){if(canAction('service-reopen'))changeAction('service-reopen');return;}
   if(action==='center'){if(mode==='service-open'&&['width','height','depth'].every(k=>ctx().unit.checks.some(f=>f.key===k&&f.nominal>0)))edit({anchor:{kind:'front',x:.5,y:.5}});else msg='اختر فحصًا من القائمة لتحديد موضع هذا البلاغ.';draw();return;}
   if(action==='check-anchor'){if(mode==='service-open'&&selectedCheck)edit({anchor:{kind:'check',key:selectedCheck}});draw();return;}if(action==='retry'){transmit();return;}
  }
  const unit=target.closest?.('[data-ms-unit]')?.dataset.msUnit;if(unit){chooseUnit(unit);return;}
  const ticket=target.closest?.('[data-ms-ticket]')?.dataset.msTicket||target.closest?.('[data-delivery-pin]')?.dataset.deliveryPin;if(ticket){chooseTicket(ticket);return;}
  const check=target.closest?.('[data-delivery-check]')?.dataset.deliveryCheck;if(check){selectedCheck=check;if(mode==='service-open')edit({anchor:{kind:'check',key:check}});draw();[...host.querySelectorAll('[data-delivery-check]')].find(el=>el.dataset.deliveryCheck===check)?.focus?.({preventScroll:true});return;}
  const plane=target.closest?.('[data-delivery-plane]');if(plane&&mode==='service-open'){const r=plane.getBoundingClientRect();if(r.width&&r.height)edit({anchor:{kind:'front',x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}});draw();}
 }
 function onInput(e){const field=e.target.dataset.msField,d=draft();if(!field||!d)return;if(edit({raw:{...d.raw,[field]:e.target.value}}))live();}
 function onChange(e){if(closed||busy)return;const k=e.target.dataset.msContext,v=e.target.value;
  if(k==='project'&&(!v||projects.some(p=>p.id===v)))guard(()=>{pid=v;receipt=uid=tid=mode='';run(loadProject);});
  else if(k==='receipt'&&(!v||receipts.some(r=>r.receipt===v)))guard(()=>{receipt=v;uid=tid=mode='';run(loadJob);});
  else if(k==='unit')chooseUnit(v);else if(e.target.hasAttribute?.('data-ms-filter')){filter=v==='open'?'open':'all';draw();}else onInput(e);
 }
 function onSubmit(e){const form=e.target.closest?.('[data-ms-form]');if(!form)return;e.preventDefault();if(form.dataset.msForm===mode)transmit();}
 function onKey(e){if(e.key==='Escape'&&leave){leave=null;draw();}if(['Enter',' '].includes(e.key)&&e.target.matches?.('g[role="button"]')){e.preventDefault();onClick(e);}}
 for(const [event,fn] of [['click',onClick],['input',onInput],['change',onChange],['submit',onSubmit],['keydown',onKey]])host.addEventListener(event,fn);refresh();
 const destroy=()=>{closed=true;for(const [event,fn] of [['click',onClick],['input',onInput],['change',onChange],['submit',onSubmit],['keydown',onKey]])host.removeEventListener(event,fn);};
 destroy.destroy=destroy;destroy.hasPending=pending;destroy.tracksDraft=()=>true;destroy.discard=()=>{for(const [k,d] of drafts)if(changed(d)){try{storage?.removeItem(k);}catch{/* memory discard */}drafts.delete(k);}leave=null;};
 destroy.requestLeave=proceed=>{if(busy){msg='انتظر انتهاء التحقق من عملية الخدمة.';draw();return false;}if(pending()){leave=proceed;draw();return false;}return true;};
 destroy.commandContext=()=>({...focus,projectId:pid,receipt,unitId:uid,ticketId:tid});return destroy;
}
