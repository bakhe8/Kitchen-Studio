import {buildOversightReport} from './kitchen-oversight-domain.js';
import {guideQuickAnswers,answerGuideQuestion} from './kitchen-work-guide.js';
import {getProjectAccess,refreshProjectAccess} from './kitchen-project-access.js';
import {checkedPortableArchive} from './kitchen-archive-validation.js';
import {saveProject,projectChangedElsewhere,staleProjectMessage} from './kitchen-project.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states={ready:'مثبت لهذه النسخة',attention:'يحتاج إجراء',waiting:'بانتظار المتطلبات',unknown:'غير متحقق'};
const actors={rep:'المندوب',customer:'العميل',engineer:'المهندس',factory:'المصنع',supplier:'المورّد',owner:'المالك'};
const approvalNames={structure:'الهيكل',customer:'العميل',release:'إفراج المصنع',chain:'تأكيد الجدار'};
const btn=(id,label,disabled=false)=>'<button type="button" data-os-action="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
async function read(path,params={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(path+'?'+new URLSearchParams(params),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('خدمة مشاريع الفريق غير متاحة؛ راجع الاتصال وتسجيل الدخول.');
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'تعذّر تحميل بيانات المشروع.'),{status:response.status});
  return {data,response};
 }finally{clearTimeout(timer);}
}

// Inspection has no archive-install, asset-write or access-binding side effects.
// Approval and server mutations remain with their existing owning editors.
export function mountOwnerOverview(host,{getDoc,apply,onHistory,canHistory=()=>false,canEdit=()=>true,onAdvance,tell,focus={}}){
 if(globalThis.document?.head&&!document.querySelector('link[data-oversight-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./kitchen-oversight-studio.css';link.setAttribute('data-oversight-css','');document.head.append(link);}
 let dead=false,busy=false,generation=0,projects=[],selectedProject=focus.projectId||'',receipt=focus.receipt||'',stageId=focus.stageId||'survey',taskId=focus.taskId||'';
 let sourceDoc=null,model=null,job=null,receipts=[],receiptListLoaded=false,metadata=null,approvalLog=[],approvalError='',serverError='',message='جارٍ مراجعة المشروع…',pending=null,leave=null;
 let historyFocus=['undo','redo'].includes(focus.historyAction)?focus.historyAction:'';
 const local=()=>!selectedProject,owner=()=>getProjectAccess(getDoc()).role==='owner';
 const editable=()=>local()&&sourceDoc===getDoc()&&owner()&&canEdit();
 const selectedStage=()=>model?.stages.find(s=>s.id===stageId)||model?.stages[0];
 const selectedTask=()=>selectedStage()?.issues.find(t=>t.id===taskId)||null;
 const context=()=>({projectId:selectedProject,receipt,stageId,taskId});
 const current=(ticket,doc)=>!dead&&ticket===generation&&getDoc()===doc;
 const choicesFor=t=>editable()&&t?guideQuickAnswers(sourceDoc,t):[];
 function normalize(){if(!model?.stages.some(s=>s.id===stageId))stageId=model?.stages[0]?.id||'survey';const s=selectedStage();if(!s?.issues.some(t=>t.id===taskId))taskId=s?.issues[0]?.id||'';}
 function scope(){if(!sourceDoc)return 'اختر مشروعًا متاحًا لحساب المالك.';return local()?'نسخة العمل المفتوحة على الجهاز'+(metadata?' · مرتبطة بإصدار '+metadata.revision+' من مشروع الفريق':' · لم تُربط بمشروع فريق بعد.'):'معاينة نسخة الفريق '+metadata?.revision+' · لا تغيّر الرسم المفتوح على الجهاز.';}
 const receiptKnown=()=>receipt?!!job:receiptListLoaded;
 // The manufacturing editor consumes getDoc(), while tracking/service consume
 // authenticated receipts. A unit ID alone never turns a local editor into a
 // remote one, even when both projects happen to use the same unit IDs.
 function serverTarget(t){return !!metadata&&['tracking','maintenance'].includes(t.step);}
 function inspector(task,stage){
  const target=task?.focus||{},choices=choicesFor(task),details=[['المصدر',serverTarget(task||stage.action||{})?(job?'إيصال التنفيذ '+job.revision:'سجل مشروع الفريق'):local()?'نسخة العمل المحلية':'نسخة الفريق '+metadata?.revision],...Object.entries(target).filter(([k,v])=>['wall','unitId','ticketId','runId','sku'].includes(k)&&typeof v==='string').map(([k,v])=>[({wall:'الجدار',unitId:'الوحدة',ticketId:'البلاغ',runId:'الصف',sku:'الصنف'})[k],v])];
  return '<aside class="os-inspector"><div class="os-action-context"><small>الإجراء في سياقه</small><h3>'+esc(task?.question||stage.title)+'</h3><p>'+esc(task?.why||stage.summary)+'</p></div><div class="os-evidence"><dl>'+details.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl></div>'+
   (pending?'<div class="os-preview" role="status"><strong>معاينة قبل الحفظ · '+esc(pending.label)+'</strong><p>الأعمال الظاهرة: '+model.tasks.length+' ← '+pending.report.tasks.length+' بعد الحفظ.</p>'+pending.report.approvals.filter(a=>a.state!==model.approvals.find(old=>old.id===a.id)?.state).map(a=>'<p>'+esc(a.title)+' · '+esc(states[a.state])+'</p>').join('')+'<p>لم يتغير المشروع بعد. يعاد التحقق من القرار عند الحفظ.</p>'+btn('save','حفظ القرار في المشروع')+btn('cancel-preview','إلغاء المعاينة')+'</div>':choices.length?'<div class="os-preview"><p>اختر قرارًا لمعاينة أثره قبل الحفظ.</p>'+choices.map(c=>'<button type="button" data-os-choice="'+esc(c.id)+'">'+esc(c.label)+'</button>').join('')+'</div>':'')+
   '<div class="os-actions">'+btn('follow',!local()&&task&&!serverTarget(task)?'فتح نسخة المشروع لمعالجة هذا البند':task?'فتح البند في سياقه':stage.action?.label||'فتح المرحلة')+'</div></aside>';
 }
 function approvalsHTML(){return '<section class="os-records"><h3>بوابات الموافقة</h3><div class="os-approvals">'+model.approvals.map(a=>'<article class="os-approval" data-state="'+a.state+'"><small>'+esc(states[a.state])+'</small><h3>'+esc(a.title)+'</h3><p>'+esc(a.summary)+'</p><button type="button" data-os-approval="'+esc(a.id)+'">مراجعة الموافقة</button></article>').join('')+'</div>'+(metadata?'<details class="os-approval-log"><summary>من سجّل الموافقات في نسخ الفريق</summary>'+(approvalError?'<p>'+esc(approvalError)+'</p>':approvalLog.length?approvalLog.map(a=>'<p>'+esc(approvalNames[a.kind]||a.kind)+' · الإصدار '+a.revision+' · '+esc(a.stamp_name)+' · سجّله '+esc(a.actor_name)+(a.subject?' · '+esc(a.subject):'')+'</p>').join(''):'<p>لا توجد موافقات مسجلة في النسخ المحفوظة. معاينة النسخة المحلية لا تسجلها على الخادم.</p>')+'</details>':'')+'</section>';}
 function draw(){
  if(dead)return;if(!owner()){host.innerHTML='<section class="oversight-studio"><p role="status">إدارة المشاريع والإشراف متاحة لمالك المشروع. حدّث الوصول قبل المتابعة.</p>'+btn('refresh','إعادة التحقق')+'</section>';return;}
  const stage=selectedStage(),task=selectedTask();
  const options='<option value=""'+(local()?' selected':'')+'>المشروع المفتوح على الجهاز · '+esc(getDoc()?.room?.name||'مشروع مطبخ')+'</option>'+(selectedProject&&!projects.some(p=>p.id===selectedProject)?'<option value="'+esc(selectedProject)+'" selected>مشروع الفريق المحدد · تعذّر تحديثه</option>':'')+projects.map(p=>'<option value="'+esc(p.id)+'"'+(selectedProject===p.id?' selected':'')+'>'+esc(p.name)+' · إصدار '+p.revision+'</option>').join('');
  const receiptOptions='<option value="">اختر إيصال التنفيذ</option>'+receipts.map(r=>'<option value="'+esc(r.receipt)+'"'+(receipt===r.receipt?' selected':'')+'>'+(r.receipt.startsWith('full:')?'إفراج كامل':'دفعة وحدات')+' · إصدار '+r.revision+' · '+esc(r.issued?.slice(0,10))+'</option>').join('');
  host.innerHTML='<section class="oversight-studio"><header class="os-header"><div><p>دفتر الإشراف · المشروع في سياقه</p><h2>إدارة المشاريع والإشراف</h2><strong>'+esc(sourceDoc?.room?.name||'المشروع')+'</strong></div><div class="os-toolbar">'+btn('refresh','تحديث الحالة')+btn('sync','المشاريع والمشاركون')+'</div></header><p class="os-status" role="status">'+esc(message)+'</p>'+
   '<div class="os-context"><label>المشروع محل المتابعة<select data-os-context="project">'+options+'</select></label><label>إيصال الورشة<select data-os-context="receipt"'+(!metadata||!receipts.length?' disabled':'')+'>'+receiptOptions+'</select></label></div><div class="os-source"><strong>'+esc(scope())+'</strong>'+(metadata?'<span>مرجع المشروع '+esc(metadata.id)+' · النسخة '+metadata.revision+'</span>':'')+'</div>'+(serverError?'<p class="os-server-status" role="status">'+esc(serverError)+'</p>':'')+
   '<div class="os-local-history" aria-label="حفظ وتاريخ نسخة العمل">'+btn('save',pending?'حفظ القرار في المشروع':'حفظ نسخة العمل',!editable())+btn('undo','تراجع المشروع',!editable()||!!pending||!canHistory(false))+btn('redo','إعادة',!editable()||!!pending||!canHistory(true))+(pending?btn('cancel-preview','إلغاء المعاينة'):'')+(!local()?btn('open','فتح هذه النسخة للعمل'):'')+'<small>التراجع يخص نسخة العمل المحلية. محاضر الورشة والعميل والخدمة تبقى محفوظة.</small></div>'+
   (leave?'<div class="os-preview" role="alert"><p>لديك قرار قيد المعاينة لم يُحفظ في المشروع.</p>'+btn('leave-save','حفظ ثم متابعة')+btn('leave-discard','ترك المعاينة والمتابعة')+btn('leave-stay','متابعة المراجعة')+'</div>':'')+
   (model?'<nav class="os-stages" aria-label="مراحل المشروع">'+model.stages.map((s,i)=>'<button type="button" class="os-stage" data-os-stage="'+s.id+'" data-state="'+s.state+'" aria-pressed="'+(s.id===stage.id)+'"><small>'+new Intl.NumberFormat('ar-SA').format(i+1)+' · '+esc(states[s.state])+'</small><strong>'+esc(s.title)+'</strong><span>'+esc(s.summary)+'</span></button>').join('')+'</nav><div class="os-workspace"><main class="os-main"><header class="os-stage-head"><div><small>'+esc(states[stage.state])+'</small><h3>'+esc(stage.title)+'</h3></div><p>'+esc(stage.summary)+'</p>'+btn('stage-open',stage.action?.label||'فتح المرحلة')+'</header>'+
   (['production','delivery','maintenance'].includes(stage.id)?'<p class="os-receipt-note">'+(job?'سجل التنفيذ لهذا الإيصال فقط · إصدار '+job.revision+' · '+job.units.length+' وحدات.':'لم يُحمّل إيصال تنفيذ؛ اعتماد التصميم لا يثبت إتمام التصنيع أو التسليم.')+(job&&metadata?.revision!==job.revision?' إصدار الإيصال يختلف عن نسخة المشروع المعروضة.':'')+'</p>':'')+
   '<div class="os-blockers" aria-label="الأعمال والعوائق">'+(stage.issues.length?stage.issues.map(t=>'<button type="button" class="os-task" data-os-task="'+esc(t.id)+'" aria-pressed="'+(t.id===task?.id)+'"><small>'+esc(actors[t.actor]||'مراجعة المشروع')+'</small><strong>'+esc(t.question)+'</strong><p>'+esc(t.why)+'</p></button>').join(''):'<p class="os-empty">'+(stage.state==='unknown'?'حمّل المصدر للتحقق من العمل المطلوب.':'لا توجد أعمال معلقة ظاهرة في هذا النطاق؛ تبقى الحالة مرتبطة بالمصدر الموضح.')+'</p>')+'</div></main>'+inspector(task,stage)+'</div>'+approvalsHTML():'<div class="os-empty"><h3>لم تُتحقق حالة المشروع بعد</h3><p>أعد التحديث لمراجعة النسخة وصلاحية الوصول. غياب البيانات لا يعني اكتمال العمل.</p></div>')+'</section>';
  if(busy)for(const el of host.querySelectorAll('button,input,select'))el.disabled=true;
 }
 async function verifyRemote(meta=metadata){
  if(!meta)throw Error('اختر مشروع فريق موثّقًا أولًا.');const {data}=await read('/api/projects',{id:meta.id,action:'access'});
  if(data.id!==meta.id||data.role!=='owner'||data.subject!==meta.subject)throw Error('تغيّر الحساب أو صلاحية المشروع. حدّث القائمة قبل المتابعة.');
  if(!local()&&data.revision!==meta.revision)throw Error('حُفظ إصدار أحدث لهذا المشروع. حدّث الحالة قبل متابعة الإجراءات.');return data;
 }
 async function refresh(){
  const base=getDoc(),ticket=++generation;busy=true;model=null;sourceDoc=null;job=null;metadata=null;receipts=[];receiptListLoaded=false;approvalLog=[];approvalError='';serverError='';draw();
  try{
   await refreshProjectAccess(base);if(!current(ticket,base))return;if(!owner())throw Error('لم تُتحقق صلاحية المالك على المشروع المفتوح.');
   try{const {data}=await read('/api/projects');if(!current(ticket,base))return;projects=(data.projects||[]).filter(p=>p.role==='owner');}catch(e){projects=[];if(selectedProject)throw e;serverError=e.message;}
   let doc=base,meta=null;
   if(selectedProject){const project=projects.find(p=>p.id===selectedProject);if(!project)throw Error('المشروع المحدد غير متاح لهذا الحساب. اختر مشروعًا آخر.');const {data,response}=await read('/api/projects',{id:project.id,revision:project.revision});
    if(response.headers.get('X-Studio-Role')!=='owner'||response.headers.get('X-Studio-Subject')!==project.subject||Number(response.headers.get('X-Studio-Revision'))!==project.revision)throw Error('تعذّر التحقق من هوية النسخة المحفوظة.');
    doc=checkedPortableArchive(data,{remoteId:project.id}).doc;meta={id:project.id,revision:project.revision,subject:project.subject};
   }else{const a=getProjectAccess(base);if(a.status==='ready'&&a.role==='owner'&&a.remoteProjectId&&a.subject)meta={id:a.remoteProjectId,revision:a.revision,subject:a.subject};}
   if(!current(ticket,base))return;
   if(meta){const results=await Promise.allSettled([read('/api/jobs',{id:meta.id}),read('/api/projects',{id:meta.id,action:'approvals'})]);if(!current(ticket,base))return;
    if(results[0].status==='fulfilled'){const value=results[0].value.data;if(value.role!=='owner'||value.subject!==meta.subject)throw Error('تعذّر التحقق من هوية سجل الورشة.');receipts=value.receipts||[];receiptListLoaded=true;if(!receipts.some(r=>r.receipt===receipt))receipt='';
     if(receipt){try{const {data}=await read('/api/jobs',{id:meta.id,receipt});if(data.role!=='owner'||data.subject!==meta.subject||data.receipt!==receipt)throw Error('نطاق إيصال التنفيذ لا يطابق المشروع المحدد.');job=data;}catch(e){job=null;serverError=e.message;}}
    }else{serverError=results[0].reason.message;receipt='';}
    if(results[1].status==='fulfilled')approvalLog=results[1].value.data.approvals||[];else approvalError=results[1].reason.message;
    const access=await verifyRemote(meta);if(local()&&access.revision!==meta.revision)serverError+=' توجد نسخة فريق أحدث؛ نسخة العمل الحالية لم تتغير.';
   }else receipt='';
   if(!current(ticket,base))return;const next=await buildOversightReport(doc,{job,receipts,receiptLoaded:receiptKnown()});if(!current(ticket,base))return;
   metadata=meta;sourceDoc=doc;model=next;normalize();message='حُدثت الحالة من بيانات المشروع ومصادر التنفيذ المتاحة.';
  }catch(e){if(current(ticket,base)){model=null;sourceDoc=null;job=null;metadata=null;receipts=[];approvalLog=[];message=e.message;tell?.(message);}}
  finally{if(!dead&&ticket===generation){busy=false;draw();if(historyFocus){host.querySelector('[data-os-action="'+historyFocus+'"]:not(:disabled)')?.focus?.({preventScroll:true});historyFocus='';}}}
 }
 function guard(next){if(pending){leave=next;draw();host.querySelector('[data-os-action="leave-stay"]')?.focus?.({preventScroll:true});return false;}next();return true;}
 async function previewChoice(id){
  const task=selectedTask(),candidate=choicesFor(task).find(c=>c.id===id),before=sourceDoc;if(!candidate||busy)return;
  const out=answerGuideQuestion(before,task,id);if(!out.ok){message=out.reason;draw();return;}
  busy=true;draw();try{const report=await buildOversightReport(out.doc,{job,receipts,receiptLoaded:receiptKnown()});if(!dead&&before===getDoc()&&editable())pending={doc:before,task,id,label:candidate.label,report};}
  catch(e){message=e.message;}finally{busy=false;draw();}
 }
 async function save(){
  if(busy)return false;if(!editable()){message='تغيّرت نسخة العمل أو صلاحيتها. حدّث الحالة قبل الحفظ.';draw();return false;}const before=getDoc();let next=before;
  if(projectChangedElsewhere()){message=staleProjectMessage;draw();return false;}
  if(pending){if(pending.doc!==before){message='تغيّرت نسخة العمل. ألغ المعاينة وأعد مراجعة القرار.';draw();return false;}const out=answerGuideQuestion(before,pending.task,pending.id);if(!out.ok){message=out.reason;draw();return false;}next=out.doc;}
  const result=pending?apply?.(next,'حُفظ قرار المتابعة.'):saveProject(before);if(result===false||result?.ok===false||result?.saved===false){message=result?.reason||'تعذّر حفظ نسخة العمل. بقي القرار للمراجعة.';draw();return false;}
  pending=null;await refresh();message='حُفظت نسخة العمل وأعيد التحقق من مراحلها.';draw();return true;
 }
 async function follow(target){
  if(!target||busy||!model)return;if(local()&&sourceDoc!==getDoc()){message='تغيّر المشروع. حدّث الحالة قبل المتابعة.';draw();return;}if(!owner())return;
  const before=getDoc();try{if(!local()||serverTarget(target)){busy=true;draw();await verifyRemote();if(dead)return;if(before!==getDoc())throw Error('تغيّر المشروع أثناء التحقق. أعد مراجعة السياق.');}if(!local()&&!serverTarget(target)){onAdvance?.('sync',{projectId:selectedProject});return;}
   onAdvance?.(target.step||'guide',serverTarget(target)?{...target.focus,projectId:metadata.id,receipt}:{...(target.focus||{})});
  }catch(e){job=null;model=null;message=e.message;}finally{busy=false;if(!dead)draw();}
 }
 function click(event){
  const b=event.target.closest('button');if(!b||!host.contains(b)||busy)return;const stage=b.dataset.osStage,task=b.dataset.osTask,choice=b.dataset.osChoice,approval=b.dataset.osApproval,a=b.dataset.osAction;
  if(stage){guard(()=>{stageId=stage;taskId='';normalize();draw();host.querySelector('[data-os-stage][aria-pressed="true"]')?.focus?.({preventScroll:true});});return;}if(task){guard(()=>{taskId=task;draw();host.querySelector('[data-os-task][aria-pressed="true"]')?.focus?.({preventScroll:true});});return;}
  if(choice){void previewChoice(choice);return;}
  if(approval){guard(()=>void follow(model?.approvals.find(x=>x.id===approval)));return;}
  if(a==='leave-stay'){leave=null;draw();return;}if(a==='leave-discard'){const go=leave;leave=null;pending=null;draw();go?.();return;}
  if(a==='leave-save'){const go=leave;void save().then(ok=>{if(ok){leave=null;go?.();}});return;}
  if(a==='cancel-preview'){pending=null;leave=null;message='أُلغيت المعاينة؛ لم يتغير المشروع.';draw();return;}if(a==='save'){void save();return;}
  if(a==='undo'||a==='redo'){if(editable()&&!pending&&canHistory(a==='redo')){const result=onHistory?.(a==='redo',{...context(),historyAction:a});if(result?.ok===false){message=result.reason;draw();}else if(!dead){historyFocus=a;void refresh();}}return;}
  if(a==='refresh'){guard(()=>void refresh());return;}if(a==='sync'||a==='open'){guard(()=>onAdvance?.('sync',{projectId:selectedProject||metadata?.id||''}));return;}
  if(a==='follow'||a==='stage-open')guard(()=>void follow(a==='follow'&&selectedTask()?selectedTask():selectedStage()?.action));
 }
 function change(event){const key=event.target.dataset.osContext;if(!key||busy)return;const value=event.target.value;guard(()=>{if(key==='project'){selectedProject=value;receipt='';taskId='';}else receipt=value;void refresh();});if(pending)draw();}
 host.addEventListener('click',click);host.addEventListener('change',change);void refresh();
 const destroy=()=>{dead=true;generation++;host.removeEventListener('click',click);host.removeEventListener('change',change);};
 destroy.hasPending=()=>!!pending;destroy.tracksDraft=()=>true;destroy.discard=()=>{pending=null;leave=null;};destroy.requestLeave=guard;destroy.commandContext=context;return destroy;
}
