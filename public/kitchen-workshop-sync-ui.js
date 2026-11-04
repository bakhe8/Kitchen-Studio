import {orderHandoffUnits} from './kitchen-order-domain.js';
import {checkedPortableArchive} from './kitchen-archive-validation.js';
import {batchControls} from './kitchen-batch-ui.js';
import {approvalState,releaseConcerns,batchReleaseState} from './kitchen-workshop-state.js';
import {cleanIdea} from './kitchen-ideas.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {packFieldFiles,unpackFieldFiles,installFieldFiles} from './kitchen-field-files.js';
import {packWallPhotos,restoreWallPhotos} from './kitchen-wall-photo-assets.js';
import {savedProjectText} from './kitchen-project.js';
import {recordBackup} from './kitchen-backup-status.js';
import {getProjectAccess,refreshProjectAccess,bindProjectAccess,withTrustedProjectInstall,subscribeProjectAccess} from './kitchen-project-access.js';
import {newKitchenReference} from './kitchen-project-identity.js';
import {scopedProjectURL} from './kitchen-scoped-client.js';

const MAX=16*1024*1024,retryKey='kitchen-workshop:upload:v1';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>new Intl.NumberFormat('ar-SA').format(n),roleName={owner:'مالك',editor:'محرر',viewer:'عرض',store:'المتجر',factory:'المصنع',rep:'المندوب'};
const approvalKind={structure:'اعتماد التصميم',customer:'اعتماد العميل',release:'ختم الإفراج',chain:'تأكيد قياس الجدار'};
const read=(storage,k)=>{try{return JSON.parse(storage.getItem(k));}catch{return null;}};
const write=(storage,k,v)=>{try{if(v)storage.setItem(k,JSON.stringify(v));else storage.removeItem(k);}catch{}};
const id=()=>crypto.randomUUID();
async function api(params,body=null){
 const res=await fetch('/api/projects?'+new URLSearchParams(params),{method:body===null?'GET':'POST',headers:body===null?{}:{'Content-Type':'application/json','X-Studio-Request':'1'},...(body===null?{}:{body}),credentials:'same-origin',cache:'no-store'});
 if(!res.headers.get('content-type')?.includes('application/json'))throw Error('خدمة المشاريع غير متاحة في هذه النسخة أو تتطلب تسجيل الدخول.');
 if(!res.ok){const data=await res.json().catch(()=>({}));throw Object.assign(Error(data.error||'تعذّر تنفيذ طلب المشاريع.'),{status:res.status});}
 return res;
}
export async function encodeCloudProject(doc){
 doc=cleanIdea(doc);if(!doc)throw Error('تعذّر التحقق من الرسم قبل الرفع.');
 const photos=packWallPhotos(doc.room);
 const raw=JSON.stringify({type:'kitchen-studio',version:2,design:doc,photos,fieldFiles:await packFieldFiles(doc.room)});
 const bytes=new TextEncoder().encode(raw);if(bytes.length>MAX)throw Error('حد المزامنة ١٦ م.ب. يمكن نقل المشاريع الأكبر عبر ملف المشروع الكامل.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 return {raw,hash};
}
export async function decodeCloudProject(raw,remoteId=null){
 if(raw?.type==='kitchen-project-view')throw Error('نسخة الدور تُفتح في مساحة المشروع المشتركة، ولا تُستورد كأرشيف كامل.');
 const {doc,photos,files}=checkedPortableArchive(raw,{remoteId});
 const room=await restoreWallPhotos(doc.room,photos,files);
 await installFieldFiles(files);
 return {...doc,room};
}
export function mountSyncStep(host,{getDoc,apply,tell,focus={}}){
 const linked=()=>{const a=getProjectAccess(getDoc());return a.remoteProjectId?{id:a.remoteProjectId,revision:a.revision,localProjectId:a.localProjectId}:null;};
 let dead=false,busy=false,ready=false,projects=[],current=linked(),chosen='',status='سجّل الرسم محليًا أثناء الزيارة، ثم ارفع نسخة عند توفر الاتصال.',action=null,versions=[],members=[],receipt=null,suggested=getDoc().room.name||'مطبخي';
 let selection=new Set(),batches=[],whole=null,proposal=null,approvals=[],approvalsKnown=false;
 let requestedProject=typeof focus?.projectId==='string'?focus.projectId:'';
 const bind=x=>{current=x;receipt=null;selection=new Set();batches=[];whole=null;proposal=null;approvals=[];approvalsKnown=false;};
 // Stamps are typed into the project by whoever can edit it. This list comes from the server and says who put each one in.
 const stampsHere=()=>{const w=getDoc().room.workshop||{};return [...['structure','customer'].filter(k=>w.approvals?.[k]).map(k=>({kind:k,subject:'',key:w.approvals[k].key,name:w.approvals[k].name})),
  ...Object.entries(w.chains||{}).filter(([,c])=>c?.attestation).map(([wall,c])=>({kind:'chain',subject:wall,key:c.attestation.key,name:c.attestation.name}))];};
 const recordedLine=a=>'<div>'+safe(approvalKind[a.kind]||a.kind)+(a.subject?' · '+safe(a.subject):'')+' «'+safe(a.stamp_name)+'»'+(a.detail?' · مرجع '+safe(a.detail):'')+' · سجّله '+safe(a.actor_name)+' · '+safe(String(a.recorded).slice(0,16).replace('T',' '))+' · الإصدار '+f(a.revision)+'</div>';
 const approvalLog=()=>{
  const missing=approvalsKnown?stampsHere().filter(s=>!approvals.some(a=>a.kind===s.kind&&(a.subject||'')===s.subject&&a.stamp_key===s.key&&a.stamp_name===s.name)):[];
  return (approvals.length?'<details open><summary>من أدخل أختام الاعتماد (سجل الخادم)</summary>'+approvals.map(recordedLine).join('')+'</details>':'')+
   (missing.length?'<p role="status">لم يُسجَّل على الخادم بعد: '+missing.map(s=>safe(approvalKind[s.kind]||s.kind)+' «'+safe(s.name)+'»').join('، ')+'. يُسجَّل اسم من أدخله عند رفع نسخة جديدة.</p>':'');
 };
 const draw=()=>{
  if(dead)return;
  const link=linked();if(link?.id!==current?.id||link?.localProjectId!==current?.localProjectId)bind(link);
  const access=getProjectAccess(getDoc()),active=projects.find(p=>p.id===current?.id),editable=access.status==='ready'&&access.role==='owner',fixedTitle=!!active&&['store','factory'].includes(access.role);
  host.innerHTML='<div class="kc-step kws-sync"><h3>مشاريع الفريق</h3><div class="kf-sync-pair"><section><small>الرسم على الجهاز</small><strong>'+safe(getDoc().room.name||'مشروع مطبخ')+'</strong></section><section><small>المشروع المرتبط على الخادم</small><strong>'+(active? safe(active.name)+' · الإصدار '+f(current.revision):current?'لم يتم التحقق من الارتباط':'لا توجد نسخة مرتبطة')+'</strong></section></div><p class="kf-connection" role="status">'+safe(status)+'</p>'+
   '<div class="kc-actions"><button data-sync="refresh">تحديث القائمة</button>'+(ready?'':'<a target="_top" href="/signin-with-chatgpt?return_to=%2F%3Fpanel%3Dworkshop%26step%3Dsync">تسجيل الدخول</a>')+'</div>'+
   (ready?'<label>اسم النسخة<input data-cloud-name maxlength="90" value="'+safe(fixedTitle?active.name:suggested)+'"'+(fixedTitle?' disabled':'')+'></label><div class="kc-actions">'+(['local','ready'].includes(access.status)&&access.role==='owner'?'<button data-sync="create">'+(access.remoteProjectId?'حفظ نسخة مستقلة كمالك جديد':'حفظ الرسم كمشروع جديد')+'</button>':'')+
   (active&&editable?'<button data-sync="save">رفع نسخة إلى «'+safe(active.name)+'» من الإصدار '+f(current.revision)+'</button>':'')+'</div>'+
   (active?'<div class="kc-summary"><strong>إطلاق التصنيع للنسخة السحابية</strong><p>يفحص الخادم النسخة المحفوظة ويعيد حساب السعر وقطع الورشة. أمر التصنيع مستقل عن الحفظ المحلي.</p><div class="kc-actions"><button data-sync="receipt">فحص إيصال النسخة '+f(current.revision)+'</button>'+(active.role==='owner'?'<button data-sync="release">إيداع أمر التصنيع</button>':'')+'</div>'+(active.role==='owner'?'<button data-sync="remainder">مراجعة وإصدار البنود المتبقية</button>':'')+(receipt?'<p>'+ (receipt.scope_json?'إيصال المتبقي فقط · '+safe(JSON.parse(receipt.scope_json).join('، '))+' · إجمالي العقد الأصلي ':'إيصال النسخة ')+f(receipt.revision)+' · '+f(receipt.total_minor/100)+' ر.س · '+safe(receipt.issued)+'<br><code>'+safe(receipt.design_key.slice(0,16))+'</code></p>':'')+approvalLog()+'</div>':'')+
   (active?batchControls(getDoc(),selection,batches,whole,proposal,active.role==='owner'):'')+
   '<h4>فتح مشروع محفوظ</h4>'+(projects.length?'<select data-cloud-choose aria-label="المشاريع المتاحة لحسابك"><option value="">اختر مشروعًا</option>'+projects.map(p=>'<option value="'+safe(p.id)+'" '+(chosen===p.id?'selected':'')+'>'+safe(p.name)+' · '+roleName[p.role]+' · '+f(p.revision)+'</option>').join('')+'</select><div class="kc-actions"><button data-sync="open">فتح على هذا الجهاز</button><button data-sync="history">الإصدارات السابقة</button></div>':'<p>لا توجد مشاريع سحابية بعد.</p>')+
   (versions.length?'<label>نسخة محفوظة<select data-cloud-revision>'+versions.map(v=>'<option value="'+v.revision+'">'+f(v.revision)+' · '+safe(v.name)+' · '+safe(v.updated.slice(0,10))+'</option>').join('')+'</select></label><button data-sync="past">فتح النسخة المحددة</button>':'')+
   (projects.find(p=>p.id===chosen)?.role==='owner'?'<details><summary>صلاحيات المشروع المحدد</summary><p>يلزم أن يفتح المشارك لوحة المشاريع بحسابه أولًا. لن يُرسَل بريد.</p><label>البريد المسجّل<input type="email" data-cloud-email maxlength="254"></label><label>الصلاحية<select data-cloud-role><option value="viewer">عرض فقط</option><option value="store">المتجر · الأصناف والأسعار</option><option value="factory">المصنع · الوصفات والإنتاج</option><option value="rep">المندوب · الرفع والتصميم</option><option value="editor">محرر عام سابق</option></select></label><div class="kc-actions"><button data-sync="share">منح الصلاحية</button><button data-sync="members">عرض المشاركين</button></div>'+members.map(m=>'<div>'+safe(m.email)+' · '+safe(roleName[m.role]||'صلاحية غير معروفة')+' <button data-sync="revoke" data-target="'+safe(m.email)+'">إلغاء الصلاحية</button></div>').join('')+'</details>':''):'')+
   (action?'<div class="kc-confirm">'+safe(action.label)+' <button data-sync="confirm">تأكيد</button><button data-sync="cancel">إلغاء</button></div>':'')+'</div>';
  if(busy)for(const b of host.querySelectorAll('button, input,select'))b.disabled=true;
 };
 const loadApprovals=async()=>{approvals=[];approvalsKnown=false;if(!current)return;try{approvals=(await(await api({id:current.id,action:'approvals'})).json()).approvals||[];approvalsKnown=true;}catch{}};
 const refresh=async()=>{await refreshProjectAccess(getDoc());current=linked();const r=await(await api({})).json();projects=r.projects;ready=true;const active=projects.find(p=>p.id===current?.id);if(active&&['store','factory'].includes(getProjectAccess(getDoc()).role))suggested=active.name;if(chosen&&!projects.some(p=>p.id===chosen))chosen='';
  // Oversight may focus an owned list entry. Opening the archive and changing
  // the current project's binding still require the existing explicit action.
  if(requestedProject){if(projects.some(p=>p.id===requestedProject&&p.role==='owner'))chosen=requestedProject;requestedProject='';}
  if(r.truncated)status='يُعرض أحدث ١٥٠ مشروعًا.';await loadApprovals();};
 const busyRun=async fn=>{if(busy)return;busy=true;draw();try{await fn();}catch(err){status=err.status===401?'سجّل الدخول بحساب الاستوديو.':err.message||'الاتصال غير متاح. بقي الرسم محفوظًا على الجهاز.';tell?.(status);}finally{busy=false;draw();}};
 const ask=(label,run)=>{action={label,run};draw();};
 async function save(create){
  const source=getDoc(),access=await refreshProjectAccess(source);current=linked();
  if(getDoc()!==source||!['local','ready'].includes(access.status)||access.role!=='owner'||!create&&!current)throw Error('يُحفظ الأرشيف الكامل من حساب المالك. افتح مساحة دورك للمشروع المشترك.');
  const stored=savedProjectText(),retry=read(localStorage,retryKey),independent=create&&!!access.remoteProjectId;
  const cloneProjectId=independent?(retry?.create&&retry.sourceProjectId===source.room.projectId&&retry.cloneProjectId||newKitchenReference()):null;
  const doc=independent?{...source,room:{...source.room,projectId:cloneProjectId}}:source;
  const active=projects.find(p=>p.id===current?.id),fixedTitle=!create&&['store','factory'].includes(access.role);
  if(fixedTitle&&!active)throw Error('حدّث قائمة المشاريع للتحقق من اسم النسخة المحفوظة.');
  const {raw,hash}=await encodeCloudProject(doc),name=(fixedTitle?active.name:suggested).trim();
  if(!name)throw Error('اكتب اسمًا للمشروع.');
  const expected=create?0:current.revision;
  const reuse=retry&&retry.hash===hash&&retry.name===name&&retry.expected===expected&&retry.create===create&&(create||retry.id===current.id);
  const request=reuse?retry:{id:create?id():current.id,request:id(),hash,name,expected,create,sourceProjectId:source.room.projectId,cloneProjectId};
  write(localStorage,retryKey,request);
  const out=await(await api({id:request.id,expected:String(expected),request:request.request,name},raw)).json();
  if(independent&&getDoc()===source){
   const result=withTrustedProjectInstall(doc,out,()=>apply(doc,'حُفظت نسخة مستقلة؛ بقي المشروع المشترك السابق في المشاريع المحفوظة.',{restoreArchive:true}));
   if(result===false||result?.ok===false||result?.saved===false)throw Error(result?.reason||'حُفظت النسخة على الخادم وتعذّر فتحها محليًا.');
  }else bindProjectAccess(doc,out);
  bind(linked());chosen=out.id;write(localStorage,retryKey,null);
  recordBackup({projectId:doc.room.projectId,text:stored,kind:'cloud'}); // the server holds this version now
  status='حُفظ الإصدار '+f(out.revision)+' مع الصور والمرفقات.'+(independent&&getDoc()!==doc&&getDoc().room.projectId!==doc.room.projectId?' تغيّر الرسم أثناء الرفع؛ افتح النسخة المستقلة من القائمة عند الحاجة.':'');await refresh();
 }
 async function open(target,revision){
  const before=getDoc(),res=await api({id:target,...(revision?{revision:String(revision)}:{})});
  const raw=await res.json();
  if(raw?.type==='kitchen-project-view'){location.assign(scopedProjectURL(target));return;}
  const metadata={id:target,role:res.headers.get('X-Studio-Role'),revision:Number(res.headers.get('X-Studio-Revision')),subject:res.headers.get('X-Studio-Subject'),scopeVersion:1};
  if(metadata.role!=='owner'||!metadata.subject)throw Error('لم يُسمح بفتح الأرشيف الكامل لهذا الحساب.');
  if(!Object.hasOwn(roleName,metadata.role)||!Number.isSafeInteger(metadata.revision)||metadata.revision<1)throw Error('تعذّر التحقق من صلاحية النسخة المحفوظة.');
  const loaded=await decodeCloudProject(raw,target);
  if(dead||getDoc()!==before)throw Error('تغير الرسم المحلي أثناء التحميل. أعد فتح النسخة بعد مراجعة التعديل.');
  const result=withTrustedProjectInstall(loaded,metadata,()=>apply(loaded,'فُتحت نسخة المشروع من السحابة.',{restoreArchive:true}));
  if(result===false||result?.ok===false||result?.saved===false)throw Error(result?.reason||'تعذر حفظ جميع البيانات محليًا.');
  bind(linked());status='فُتح الإصدار '+f(current.revision)+' مع محتوياته.';suggested=projects.find(p=>p.id===target)?.name||loaded.room.name||'مطبخي';await loadApprovals();
 }
 function click(e){
  const b=e.target.closest('[data-sync]');if(!b||busy)return;
  const type=b.dataset.sync;
  if(['batch-issue','remainder','release'].includes(type)){const a=getProjectAccess(getDoc());if(a.status!=='ready'||a.role!=='owner'){status='هذه العملية لمالك المشروع بعد التحقق من الوصول.';draw();return;}}
  if(type==='cancel'){action=null;draw();return;}
  if(type==='confirm'){const fn=action?.run;action=null;if(fn)busyRun(fn);return;}
  if(type==='create'){busyRun(()=>save(true));return;}
  if(type==='save'){ask('حفظ الرسم المحلي كإصدار جديد للمشروع المحدد؟',()=>save(false));return;}
  if(type==='refresh'){busyRun(async()=>{await refresh();status='حُدّثت قائمة المشاريع.';});return;}
  if(type==='batches'&&current){busyRun(async()=>{const data=await(await api({id:current.id,action:'batches'})).json();batches=data.batches;whole=data.whole;proposal=null;status='حُدثت إيصالات المصنع.';});return;}
  if(type==='batch-preview'&&current){busyRun(async()=>{proposal=await batchReleaseState(getDoc(),[...selection]);status='اكتمل فحص الدفعة.';});return;}
  if(type==='batch-issue'&&current&&proposal&&!proposal.issues.length){
   const original=proposal,selected=[...selection],project=current;
   ask('هل تريد إصدار القطع للوحدات '+selected.join('، ')+' فقط من النسخة '+project.revision+'؟',async()=>{
    const now=await batchReleaseState(getDoc(),selected);
    if(now.key!==original.key||now.issues.length)throw Error('تغيّرت الوحدات أو أدلتها. أعد فحص الدفعة.');
    await api({id:project.id,action:'batch',revision:project.revision,review:now.key},JSON.stringify({unitIds:selected}));
    const data=await(await api({id:project.id,action:'batches'})).json();batches=data.batches;whole=data.whole;selection.clear();proposal=null;status='أُودعت الدفعة. لن تُعاد الوحدات نفسها إلى أمر قطع آخر.';
   });return;
  }
  if(type==='receipt'&&current){busyRun(async()=>{receipt=(await(await api({id:current.id,action:'receipt',revision:current.revision})).json()).receipt;status=receipt?'إيصال مصدّق من الخادم لهذه النسخة.':'لم يُودع أمر تصنيع لهذه النسخة.';});return;}
  if(type==='remainder'&&current){
   const project=current;
   busyRun(async()=>{
    const doc=getDoc(),state=await approvalState(doc);
    const data=await(await api({id:project.id,action:'batches'})).json();batches=data.batches;whole=data.whole;
    if(whole||!batches.length)throw Error(whole?'سبق إصدار أمر إكمال المشروع.':'لا توجد دفعات سابقة. استخدم إصدار المشروع.');
    const issues=releaseConcerns(doc,state);if(issues.length)throw Error(issues.join(' '));
    const cut=new Set(batches.flatMap(b=>JSON.parse(b.unit_ids)));
    const remaining=orderHandoffUnits(doc).map(u=>u.id).filter(id=>!cut.has(id)).sort();
    if(!remaining.length)throw Error('كل البنود سبق إصدارها.');
    action={label:'إطلاق البنود المتبقية فقط '+remaining.join('، ')+'؟ إجمالي العرض المسجل مرجع للعقد، ولن تُصدر القطع السابقة مرة ثانية.',run:async()=>{
      if(doc!==getDoc()||current!==project)throw Error('تغيّر المشروع قبل التأكيد.');
      receipt=(await(await api({id:project.id,revision:project.revision,action:'remainder',review:state.keys.release},JSON.stringify({remaining}))).json()).receipt;
      whole=receipt;status='صدر أمر استكمال يقتصر على البنود المعروضة.';
    }};status='راجع نطاق الأمر قبل تأكيده.';
   });return;
  }
  if(type==='release'&&current){
   const active=projects.find(p=>p.id===current.id);
   if(active?.role!=='owner'){status='هذه العملية لمالك المشروع.';draw();return;}
   ask('إيداع أمر تصنيع للنسخة السحابية '+f(current.revision)+' من «'+active.name+'»؟ سيُراجع الخادم النسخة المحفوظة.',async()=>{
    const state=await approvalState(getDoc()),issues=releaseConcerns(getDoc(),state);
    if(issues.length)throw Error(issues.join(' '));
    const response=await api({id:current.id,revision:current.revision,review:state.keys.release,action:'release'},'{}');
    receipt=(await response.json()).receipt;status='أُودع أمر التصنيع بعد إعادة حساب النسخة المحفوظة على الخادم.';
   });return;
  }
  const project=projects.find(p=>p.id===chosen);if(!project){status='اختر مشروعًا من القائمة.';draw();return;}
  if(type==='open'||type==='past'){const rev=type==='past'?host.querySelector('[data-cloud-revision]')?.value:null;ask('استبدال الرسم المفتوح محليًا بمشروع «'+project.name+'»؟ يمكنك التراجع عن فتح المشروع.',()=>open(project.id,rev));return;}
  if(type==='history'){busyRun(async()=>{versions=(await(await api({id:project.id,action:'versions'})).json()).versions;status='اختر الإصدار المطلوب.';});return;}
  if(type==='members'){busyRun(async()=>{members=(await(await api({id:project.id,action:'members'})).json()).members;status=members.length?'المشاركون مدرجون في الصلاحيات.':'لا يوجد مشاركون.';});return;}
  const email=type==='share'?host.querySelector('[data-cloud-email]')?.value:b.dataset.target,role=host.querySelector('[data-cloud-role]')?.value;
  if(type==='share'||type==='revoke'){
   if(project.role!=='owner'){status='إدارة المشاركين لمالك المشروع.';draw();return;}
   if(!email){status='أدخل بريد المشارك.';draw();return;}
   ask((type==='share'?'منح '+roleName[role]:'إلغاء الوصول')+' لـ '+email+' في '+project.name+'؟',async()=>{await api({id:project.id,action:type},JSON.stringify({email,role}));members=(await(await api({id:project.id,action:'members'})).json()).members;status='حُدّثت صلاحيات المشروع.';});
  }
 }
 const change=e=>{if(e.target.matches('[data-batch-unit]')){const uid=e.target.dataset.batchUnit;if(e.target.checked)selection.add(uid);else selection.delete(uid);proposal=null;action=null;draw();return;}if(e.target.matches('[data-cloud-choose]')){chosen=e.target.value;versions=[];members=[];action=null;draw();}};
 const input=e=>{if(e.target.matches('[data-cloud-name]'))suggested=e.target.value;};
 host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('input',input);
 const unsubscribe=subscribeProjectAccess(()=>draw());
 busyRun(async()=>{await refresh();status='متصل بحسابك. اختر مشروعًا أو احفظ الرسم الحالي.';});
 return ()=>{dead=true;unsubscribe();host.removeEventListener('click',click);host.removeEventListener('change',change);host.removeEventListener('input',input);};
}
