import {scopeWidgetDocument,scopeEditableFromWidget,scopeCatalogForWidget,scopeRecordFromCatalog,scopeDesignOptions,approvedSaleHTML} from './kitchen-scope-widgets.js';
import {bindProjectAccess} from './kitchen-project-access.js';
import {scenePlan} from './kitchen-project.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {registerUnsavedWork} from './kitchen-unsaved-work.js';
const clone=v=>structuredClone(v),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={store:'المتجر',factory:'المصنع',rep:'المندوب'};
const titles={maintenance:'الصيانة وما بعد البيع',specials:'أوراق القطع الخاصة',workbench:'التقسيم الداخلي والأدراج',store:'الأصناف والأسعار',recipes:'وصفات التفصيل والبناء',machines:'القص والماكينات',template:'اعتماد الوصفات',survey:'رفع الجدار',outline:'محيط الغرفة',design:'تصميم المطبخ',intake:'أجهزة العميل',decisions:'قرارات الزيارة',uses:'استخدام العميل',zones:'الخدمات والتثبيت',measure:'دقة القياس',routes:'مسارات الخدمات',surfaces3d:'مناسيب الموقع',profile:'استقامة الجدران',tap:'الخلاط والشباك',wallOptions:'خيارات الجدار',appliances:'ملاءمة الأجهزة',corner:'تفصيل الزوايا',assembly:'قواعد الدواليب',surface:'قالب السطح',logistics:'التجهيز والتوريد',field:'القراءات والمرفقات',defaults:'قيم المشروع',quote:'سعر البيع المعتمد',tracking:'متابعة التصنيع',inventory:'رصيد المخزون',team:'كتالوجات الفريق'};
const destinations={store:['store','team','inventory'],factory:['recipes','specials','workbench','machines','template','corner','assembly','surface','logistics','field','defaults','team','tracking','maintenance'],rep:['survey','outline','design','workbench','intake','decisions','uses','zones','measure','routes','surfaces3d','profile','tap','wallOptions','appliances','field','defaults','quote']};
const mounts={maintenance:['kitchen-maintenance-studio','mountMaintenanceStudio'],survey:['kitchen-chain-ui','mountChainStep'],outline:['kitchen-measured-outline-ui','mountMeasuredOutline'],intake:['kitchen-appliance-intake-ui','mountApplianceIntake'],decisions:['kitchen-project-decisions-ui','mountProjectDecisions'],uses:['kitchen-client-usage-ui','mountClientUsage'],zones:['kitchen-service-zones-ui','mountServiceZones'],measure:['kitchen-measure-fit-ui','mountMeasureFit'],routes:['kitchen-pipe-routes-ui','mountPipeRoutes'],surfaces3d:['kitchen-surveyed-surfaces-ui','mountMeasuredSurfaces'],profile:['kitchen-wall-profile-ui','mountWallProfiles'],tap:['kitchen-tap-window-ui','mountTapWindow'],wallOptions:['kitchen-project-wall-ui','mountProjectWallOptions'],appliances:['kitchen-appliance-fit-ui','mountApplianceFit'],corner:['kitchen-production-row-corner-ui','mountCornerUI'],assembly:['kitchen-fitout-ui','mountFitout'],surface:['kitchen-surface-pattern-ui','mountSurfacePattern'],logistics:['kitchen-install-readiness-ui','mountInstallReadiness'],tracking:['kitchen-order-tracking-ui','mountOrderTracking'],inventory:['kitchen-workshop-inventory-ui','mountInventoryStep']};
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function mountScopedWorkspace(host,{view,save,reload,list,open,leave,remember,previewDesign,previewOperation,applyOperation,operationDraft,discardOperationDraft,listCatalogs,loadCatalog,saveCatalog,saveOwnerCatalog,draftStatus}){
 if(!document.querySelector('[data-scoped-style]')){const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('./kitchen-scoped-workspace.css',import.meta.url).href;l.dataset.scopedStyle='';document.head.append(l);}
 let current=clone(view),doc=scopeWidgetDocument(current),disposed=false,serial=0,controller=null,dirty=!!draftStatus,busy=false,route=destinations[view.access.role]?.[0]||'',kit=null;const pendingFiles=new Map();
 const role=view.access.role,allowed=destinations[role]||[],ac=new AbortController(),signal=ac.signal;
 const bind=()=>bindProjectAccess(doc,{id:current.project.id,role,revision:current.project.revision,subject:current.access.subject});bind();
 host.classList.add('ks-scope');host.innerHTML='<header class="ks-scope-header"><div><small>استوديو المطابخ</small><h1>بوابة '+esc(labels[role])+'</h1><span data-scope-revision></span></div><div class="ks-scope-actions"><button data-scope-save>حفظ التغييرات على الخادم</button><button data-scope-reload>تحديث النسخة</button><button data-scope-export>تنزيل بياناتي</button><button data-scope-projects>المشاريع</button></div></header><div class="ks-scope-bar"><label>صفحات العمل <select data-scope-route>'+allowed.map(k=>'<option value="'+k+'">'+titles[k]+'</option>').join('')+'</select></label><span data-scope-dirty></span></div><p class="ks-scope-notice" data-scope-notice role="status"></p><div class="ks-scope-projects" data-scope-project-list hidden></div><main class="ks-scope-content ws-content" data-scope-content></main>';
 const q=s=>host.querySelector(s),content=q('[data-scope-content]');
 const tell=text=>{if(!disposed)q('[data-scope-notice]').textContent=text||'';};
 function status(){if(disposed)return;q('[data-scope-revision]').textContent='نسخة '+current.project.revision.toLocaleString('ar-SA')+' · '+current.project.id.slice(0,8);q('[data-scope-dirty]').textContent=dirty?'تعديلات في مسودتك لم تُرسل بعد':'النسخة المسموح بها لدورك';q('[data-scope-save]').disabled=busy||!dirty;
  let box=q('[data-scope-recovery]');if(!box){box=document.createElement('aside');box.dataset.scopeRecovery='';box.className='ks-scope-notice';content.before(box);}const d=operationDraft?.();box.hidden=!d;
  if(d)box.innerHTML='<p>توجد عملية محفوظة لاستردادها ضمن حسابك ودورك'+(d.conflict?' من نسخة أقدم':'')+'. راجعها قبل المتابعة.</p><button data-recovery-download>تنزيل مسودة العملية</button> '+(d.operation?.kind==='interior.set'?'<button data-recovery-interior>مراجعة التقسيم المسترد</button> ':'')+(d.requestId?'<button data-recovery-retry>التحقق من نتيجة الحفظ وإعادة المحاولة</button> ':'')+'<button data-recovery-discard>ترك عملية الاسترداد</button>';
 }
 function changed(editable,message){if(disposed||busy)return {ok:false,saved:false,reason:'انتظر اكتمال الطلب الحالي.'};const next=clone(editable);try{remember?.(next);}catch(error){const reason=error.message||'تعذّر حفظ المسودة. احتفظ بالحقول وأعد المحاولة.';tell(reason);return {ok:false,saved:false,reason};}current={...current,editable:next};dirty=true;status();tell(message||'حُفظت المسودة. أرسل التغييرات إلى الخادم بعد مراجعتها.');return {ok:true,saved:true,changed:true};}
 function apply(next,message){const files=[...(current.editable.fieldFiles||[]),...pendingFiles.values()],editable=scopeEditableFromWidget(current,next,{files});const result=changed(editable,message);if(result.ok){doc=next;for(const file of editable.fieldFiles||[])pendingFiles.delete(file.id);kit?.refresh(true);}return result;}
 const getDoc=()=>doc;
 function closeWidget(){if(typeof controller==='function')controller();else controller?.destroy?.();controller=null;kit=null;}
 async function navigate(next,focus={}){
  if(busy){tell('انتظر اكتمال الحفظ أو الحساب الحالي.');q('[data-scope-route]').value=route;return;}
  next=({whole:'design',row:'design',factory:'recipes',finish:'design',guide:'survey',photo:'field',sync:route})[next]||next;
  if(role==='factory'&&next==='recipes'&&focus.tab==='special')next='specials';
  if(!allowed.includes(next)){tell('هذه البيانات تخص جهة أخرى.');return;}
  if(controller?.hasPending?.()&&!confirm('لديك تغييرات لم تُحفظ أو تُنشر بعد. هل تريد تركها والانتقال؟')){q('[data-scope-route]').value=route;return;}
  closeWidget();route=next;q('[data-scope-route]').value=route;const ticket=++serial;content.innerHTML='<p>جارٍ فتح '+esc(titles[route])+'…</p>';
  const args={getDoc,apply,tell,focus,onAdvance:navigate,refresh:()=>navigate(route,focus),...(['intake','uses'].includes(route)?{scoped:true,families:current.context.families}:{})};
  try{
   if(['store','recipes','machines'].includes(route)){
    if(!scopeCatalogForWidget(current)){content.innerHTML='<h2>'+titles[route]+'</h2><p>يهيئ المالك سجل المشروع قبل بدء التعديل.</p>';return;}
    const {mountFactoryStep}=await import('./kitchen-workshop-factory-ui.js');if(disposed||ticket!==serial)return;
    controller=mountFactoryStep(content,{...args,page:route,scoped:{read:()=>scopeCatalogForWidget(current),
     write:catalog=>{const key=role==='store'?'storeCatalog':'factoryRecipes',editable=clone(current.editable);editable[key]=scopeRecordFromCatalog(current,catalog);const result=changed(editable);if(result.ok){doc=scopeWidgetDocument(current);bind();}return result;},
     approve:()=>approveRecord(),status:()=>recordStatus()}});
   }else if(route==='template'){
    content.innerHTML='<section class="ws-card"><h2>اعتماد وصفات المصنع</h2><p>'+esc(recordStatus())+'</p><p>يعتمد المصنع وصفاته ومدخلاته. التسعير والإفراج النهائي يراجعهما المالك.</p><button data-scope-approve '+(!current.editable.factoryRecipes?'disabled':'')+'>اعتماد الوصفات الحالية</button></section>';
   }else if(route==='quote')content.innerHTML='<section class="ws-card"><h2>عرض العميل</h2><div data-scope-approved-sale>'+approvedSaleHTML(dirty?null:current.approvedSale)+'</div></section>';
   else if(route==='design')await mountDesign(ticket);
   else if(route==='workbench')await mountWorkbench(ticket,focus.unitId,focus.restore);
   else if(route==='specials'){
    const data=await operation({kind:'special.open'}),{mountScopedSpecial}=await import('./kitchen-scoped-special-ui.js');if(disposed||ticket!==serial)return;
    content.replaceChildren();controller=mountScopedSpecial(content,{data,tell,load:targetId=>operation({kind:'special.open',targetId}),save:(targetId,draft)=>operation({kind:'special.review',targetId,draft},true)});
   }
   else if(route==='field'||route==='defaults'){
    const {mountFieldRegister}=await import('./kitchen-field-ui.js');if(disposed||ticket!==serial)return;content.replaceChildren();
    const field=mountFieldRegister(content,{getDoc,apply,tell,scoped:true,getProjectKey:()=>doc.room.projectId,attachmentStore:attachments(),onClose:()=>navigate(role==='rep'?'survey':'recipes')});
    field.open({mode:route==='defaults'?'defaults':'records'});controller=()=>field.destroy();controller.hasPending=()=>field.hasPending?.()||false;
   }else if(route==='team')await mountCatalogs(ticket);
   else if(mounts[route]){const [file,name]=mounts[route],m=await import('./'+file+'.js');if(disposed||ticket!==serial)return;content.replaceChildren();controller=await m[name](content,args);}
   status();
  }catch(error){if(!disposed&&ticket===serial){content.innerHTML='<section class="ws-card"><h2>'+esc(titles[route])+'</h2><p>تعذّر فتح الصفحة. بقيت بياناتك المحفوظة دون تغيير.</p></section>';tell(error.message);}}
 }
 function recordStatus(){const r=current.editable[role==='store'?'storeCatalog':'factoryRecipes'];return r?'الإصدار '+r.revision.toLocaleString('ar-SA')+' · '+(r.approved?'معتمد':'بانتظار الاعتماد'):'بانتظار تهيئة المالك';}
 function approveRecord(){const key=role==='store'?'storeCatalog':'factoryRecipes',e=clone(current.editable);if(!e[key])return {ok:false,reason:'يهيئ المالك السجل أولًا.'};e[key].approved=true;const result=changed(e,'سُجّل الاعتماد في المسودة. أرسل التغييرات إلى الخادم.');doc=scopeWidgetDocument(current);bind();return result;}
 function attachments(){return {put:async file=>{
  if(disposed||busy||!(file instanceof Blob)||file.size<1||file.size>12*1024*1024)throw Error('اختر مرفقًا لا يتجاوز ١٢ م.ب.');
  const id='doc-'+crypto.randomUUID().replaceAll('-',''),bytes=new Uint8Array(await file.arrayBuffer());if(disposed)throw Error('تغيّر نطاق المشروع.');let binary='';for(let i=0;i<bytes.length;i+=0x6000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x6000));
  pendingFiles.set(id,{id,data:btoa(binary)});return {id,name:(file.name||'مرفق').slice(0,180),type:file.type||'application/octet-stream',size:file.size};
 },download:async ref=>{const file=current.editable.fieldFiles.find(f=>f.id===ref.id)||pendingFiles.get(ref.id);if(!file)throw Error('هذا المرفق غير متاح لدورك.');const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=ref.name||'مرفق';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}};}
 async function mountDesign(ticket){
  const {mountKitchenView}=await import('./kitchen-view.js');if(disposed||ticket!==serial)return;
  const wanted=scopeDesignOptions(doc);
  content.innerHTML='<section class="ks-design"><div class="ks-design-actions"><h2>تصميم المطبخ</h2><fieldset><legend>متطلبات التوزيع</legend>'+[['sink','مجلى'],['dishwasher','غسالة صحون'],['rice','تخزين الأرز']].map(([k,label])=>'<label><input type="checkbox" data-scope-wanted="'+k+'" '+(wanted[k]?'checked':'')+'>'+label+'</label>').join('')+'</fieldset><button data-scope-propose>حساب بدائل من القياسات المحفوظة</button><p>يحسب المصنع ملاءمة الوحدات. يظهر سعر البيع المعتمد في صفحته المستقلة.</p><div data-scope-choices></div><div data-scope-unit></div></div><div data-scope-cad class="ks-scope-cad"></div></section>';
  const cad=content.querySelector('[data-scope-cad]');
  kit=mountKitchenView(cad,{scoped:true,getProject:getDoc,getPlan:()=>scenePlan(doc.room,doc.kitchen),getKitchen:()=>doc.kitchen,getRoom:()=>doc.room,onCommit:k=>apply({...doc,kitchen:k},'حُفظ تعديل الرسم في المسودة.'),onCommitProject:apply,onReject:tell,onRoomDimensions:()=>navigate('outline'),onEditUnit:editUnit,onLayouts:propose,onSurveyReading:(wall,featureId)=>navigate('survey',{wall,featureId}),onSurveyPoint:()=>navigate('outline'),onReadingPhoto:()=>navigate('field'),getPhotos:()=>current.editable.photos||{}});kit.refresh(true);controller=()=>kit?.destroy();
  content.querySelector('[data-scope-propose]').addEventListener('click',propose,{signal});
 }
 function editUnit(id){void navigate('workbench',{unitId:id});}
 function install(next){current=clone(next);doc=scopeWidgetDocument(current);bind();dirty=false;status();}
 async function operation(op,write=false){
  if(disposed||busy)throw Error('انتظر اكتمال الطلب الحالي.');
  if(dirty)throw Error('احفظ مسودة المشروع على الخادم قبل استخدام أدوات التقسيم والأدراج.');
  if(!previewOperation||write&&!applyOperation)throw Error('تعذّر الاتصال بأدوات المشروع.');
  const ticket=serial;busy=true;status();
  try{const out=await previewOperation(op);if(disposed||ticket!==serial)throw Error('تغيّرت صفحة العمل.');
   if(!write)return out.result;
   if(!out.review)throw Error('لم تكتمل مراجعة العملية.');
   const next=await applyOperation(op,out.review);if(disposed)throw Error('تغيّر نطاق المشروع.');install(next);tell('حُفظ التعديل على الخادم. راجع القياسات والاعتمادات التي تأثرت به.');return out.result;
  }finally{busy=false;status();}
 }
 async function mountWorkbench(ticket,unitId,restore=false){
  if(dirty){content.innerHTML='<section class="ws-card"><h2>التقسيم الداخلي والأدراج</h2><p>احفظ مسودة المشروع من الزر أعلى الصفحة، ثم افتح أدوات التقسيم والأدراج.</p></section>';return;}
  if(unitId){
   const data=await operation({kind:'interior.open',unitId}),{mountScopedInterior}=await import('./kitchen-scoped-interior-ui.js');if(disposed||ticket!==serial)return;
   const draft=restore?operationDraft?.():null;content.replaceChildren();controller=mountScopedInterior(content,{...data,...(draft?.operation?.kind==='interior.set'&&draft.operation.unitId===unitId?{draftPlan:draft.operation.plan}:{}),role,tell,onClose:()=>navigate('workbench'),onSave:async plan=>{await operation({kind:'interior.set',unitId,plan},true);return {ok:true};}});return;
  }
  const data=await operation({kind:'workbench.read'}),{mountScopedDrawers}=await import('./kitchen-scoped-drawers-ui.js');if(disposed||ticket!==serial)return;
  content.replaceChildren();controller=mountScopedDrawers(content,{role,data,tell,onInterior:editUnit,getPack:()=>current.editable.workshop?.clientUsage?.pack,
   preview:op=>operation(op),commit:async op=>{await operation(op,true);return operation({kind:'workbench.read'});},
   savePack:async pack=>{
    if(disposed||busy||dirty)throw Error('احفظ مسودة المشروع الحالية أولًا.');
    const editable=clone(current.editable),usage=editable.workshop.clientUsage||{tasks:[]};editable.workshop.clientUsage={...usage,pack};remember?.(editable);
    busy=true;status();try{const next=await save(editable);if(disposed)throw Error('تغيّر نطاق المشروع.');install(next);}finally{busy=false;status();}
    tell('حُفظت متطلبات العميل وإذن التوزيع.');return operation({kind:'workbench.read'});
   }});
 }
 async function propose(){
  if(dirty){tell('احفظ مسودة المشروع على الخادم قبل حساب البدائل.');return;}if(!previewDesign)return;
  const area=content.querySelector('[data-scope-choices]');if(!area)return;area.textContent='جارٍ حساب البدائل…';const ticket=serial;
  try{const walls=roomArchitecture(doc.room).walls.filter(w=>doc.room.workshop?.chains?.[w.id]?.rows?.length).map(w=>w.id),wanted=Object.fromEntries([...content.querySelectorAll('[data-scope-wanted]')].map(e=>[e.dataset.scopeWanted,e.checked]));const result=await previewDesign({walls,...wanted});if(disposed||ticket!==serial)return;
   area.innerHTML=result.choices.map((c,i)=>'<button data-scope-choice="'+i+'">اختيار التوزيع '+(i+1).toLocaleString('ar-SA')+' · '+c.editable.kitchen.units.length.toLocaleString('ar-SA')+' وحدة</button>').join('')||'<p>لم يتوفر بديل مناسب. راجع القياسات والمتطلبات مع المصنع.</p>';
   area.onclick=e=>{const key=e.target.closest('[data-scope-choice]')?.dataset.scopeChoice;if(key===undefined)return;if(changed(result.choices[Number(key)].editable,'اختير التوزيع في مسودتك. راجعه ثم احفظه على الخادم.').ok){doc=scopeWidgetDocument(current);bind();kit?.refresh(true);}};
  }catch(error){if(!disposed&&ticket===serial){area.textContent='تعذّر حساب بدائل لهذه النسخة.';tell(error.message);}}
 }
 async function mountCatalogs(ticket){
  content.innerHTML='<section class="ws-card"><h2>كتالوجات الفريق</h2><p>تعتمد مشاركة الكتالوج على صلاحية مستقلة يمنحها مالكه.</p><div data-scope-catalogs>جارٍ التحميل…</div><div data-scope-catalog-editor></div></section>';
  if(!listCatalogs||!loadCatalog||!saveCatalog){content.querySelector('[data-scope-catalogs]').textContent='افتح كتالوجات الفريق من لوحة المشاريع لإدارة مشاركتها.';return;}
  const data=await listCatalogs();if(disposed||ticket!==serial)return;const catalogs=data.catalogs||data;
  content.querySelector('[data-scope-catalogs]').innerHTML=catalogs.map(c=>'<button data-scope-catalog="'+esc(c.id)+'">'+esc(c.name||'كتالوج '+c.id.slice(0,8))+'</button>').join('')||'<p>لا توجد كتالوجات مشتركة متاحة لدورك.</p>';
  content.querySelector('[data-scope-catalogs]').onclick=async e=>{const id=e.target.closest('[data-scope-catalog]')?.dataset.scopeCatalog;if(!id)return;if(controller?.hasPending?.()&&!confirm('لديك تعديل كتالوج لم يُنشر. هل تريد تركه وفتح الكتالوج الآخر؟'))return;try{const loaded=await loadCatalog(id);if(disposed||ticket!==serial)return;await catalogEditor(loaded);}catch(error){tell(error.message);}};
 }
 async function catalogEditor(loaded){
  const catalog=loaded.view||loaded;if(catalog.role==='owner'&&catalog.catalogRecords){closeWidget();await ownerCatalogEditor(catalog);return;}if(catalog.type!=='kitchen-catalog-view'){tell('إدارة الكتالوج الكامل تتم من مدخل مالكه.');return;}
  const pane=content.querySelector('[data-scope-catalog-editor]'),catalogRole=catalog.access.role,key=catalogRole==='store'?'storeCatalog':'factoryRecipes';
  if(!['store','factory'].includes(catalogRole)||!catalog.editable?.[key]){tell('يلزم أن يعيّن مالك الكتالوج دور العمل المناسب.');return;}
  closeWidget();let working=clone(catalog),catalogDirty=false;const cv=()=>({access:{...current.access,role:catalogRole},editable:working.editable,context:working.context});
  pane.innerHTML='<button data-scope-catalog-save>نشر تعديل سجل الكتالوج</button><button data-scope-catalog-approve>اعتماد السجل</button><div data-scope-catalog-widget></div>';
  const {mountFactoryStep}=await import('./kitchen-workshop-factory-ui.js');
  const edit=mountFactoryStep(pane.querySelector('[data-scope-catalog-widget]'),{getDoc,apply:()=>({ok:false}),tell,page:catalogRole==='store'?'store':'recipes',scoped:{role:catalogRole,read:()=>scopeCatalogForWidget(cv()),write:c=>{working.editable[key]=scopeRecordFromCatalog(cv(),c);catalogDirty=true;tell('حُفظ تعديل الكتالوج في المسودة. انشره بعد المراجعة.');return {ok:true};},approve:()=>{working.editable[key].approved=true;catalogDirty=true;return {ok:true};}}});
  controller=()=>edit();controller.hasPending=()=>catalogDirty||edit.hasPending?.()||false;
  pane.querySelector('[data-scope-catalog-approve]').onclick=()=>{working.editable[key].approved=true;catalogDirty=true;tell('سُجّل اعتماد السجل في المسودة.');};
  pane.querySelector('[data-scope-catalog-save]').onclick=async()=>{try{const out=await saveCatalog(working,working.editable);if(disposed)return;catalogDirty=false;tell('نُشر سجل الكتالوج.');await catalogEditor(out);}catch(error){tell(error.message);}};
 }
 async function ownerCatalogEditor(raw){
  if(!saveOwnerCatalog){tell('تعذّر فتح تحرير كتالوج المالك.');return;}
  const [{decodePortableCatalog,encodePortableCatalog},{normalizeWorkshopCatalogs,reconcileWorkshopCatalogs,approveWorkshopCatalogRecord},{mountFactoryStep}]=await Promise.all([import('./kitchen-factory-template.js'),import('./kitchen-catalog-records.js'),import('./kitchen-workshop-factory-ui.js')]);
  if(disposed||route!=='team')return;let w=decodePortableCatalog(raw.catalogRecords);if(!w)throw Error('كتالوج المالك غير صالح.');w=normalizeWorkshopCatalogs(w);
  const pane=content.querySelector('[data-scope-catalog-editor]');pane.innerHTML='<h3>كتالوج تملكه</h3><label>السجل <select data-catalog-owner-page><option value="store">المتجر</option><option value="recipes">الوصفات</option><option value="machines">الماكينات</option><option value="sale">التسعير</option></select></label><button data-catalog-owner-save>نشر الكتالوج</button><div data-catalog-owner-widget></div>';
  let edit=null,ownerDirty=false;const show=page=>{if(edit?.hasPending?.()&&!confirm('لديك حقول لم تُطبّق على مسودة الكتالوج. هل تريد تركها؟'))return;edit?.();const source=()=>({...doc,room:{...doc.room,workshop:w}});edit=mountFactoryStep(pane.querySelector('[data-catalog-owner-widget]'),{getDoc:source,apply:()=>({ok:false,reason:'عدّل سجلات الكتالوج من نموذجها.'}),tell,page,scoped:{role:'owner',read:()=>w.catalog,write:c=>{const next=reconcileWorkshopCatalogs({...w,catalog:{...c,revision:w.catalog.revision+1,approved:false}},w);if(!next)return {ok:false,reason:'راجع بيانات الكتالوج.'};w=next;ownerDirty=true;tell('حُفظت مسودة الكتالوج المملوك لك. انشرها بعد المراجعة.');return {ok:true};},approve:r=>{const next=approveWorkshopCatalogRecord(w,r);if(!next)return {ok:false};w=next;ownerDirty=true;return {ok:true};}}});};show('store');controller=()=>edit?.();controller.hasPending=()=>ownerDirty||edit?.hasPending?.()||false;
  pane.querySelector('select').onchange=e=>show(e.target.value);
  pane.querySelector('[data-catalog-owner-save]').onclick=async()=>{try{const out=await saveOwnerCatalog(raw,encodePortableCatalog(w));if(disposed)return;ownerDirty=false;edit?.();await ownerCatalogEditor(out);tell('نُشر الكتالوج المملوك لك.');}catch(error){tell(error.message);}};
 }
 q('[data-scope-route]').addEventListener('change',e=>{void navigate(e.target.value);},{signal});
 // Project-specific review needs full server geometry. Keep the familiar
 // factory tab as an entry to that authenticated workbench.
 host.addEventListener('click',e=>{if(role==='factory'&&route==='recipes'&&e.target.closest('[data-tab="special"]')){e.preventDefault();e.stopPropagation();void navigate('specials');}},{signal,capture:true});
 host.addEventListener('change',e=>{if(role==='factory'&&route==='recipes'&&e.target.matches('select[name="factorySection"]')&&e.target.value==='special'){e.stopPropagation();void navigate('specials');}},{signal,capture:true});
 host.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||busy)return;
  if(b.hasAttribute('data-recovery-download')){const d=operationDraft?.();if(d)download(d,'kitchen-operation-draft.json');}
  if(b.hasAttribute('data-recovery-interior')){const d=operationDraft?.();if(d?.operation?.kind==='interior.set')void navigate('workbench',{unitId:d.operation.unitId,restore:true});}
  if(b.hasAttribute('data-recovery-discard')&&confirm('هل تريد ترك عملية الاسترداد؟ يمكنك تنزيلها أولًا للاحتفاظ بها.')){try{discardOperationDraft?.();status();}catch(error){tell(error.message);}}
  if(b.hasAttribute('data-recovery-retry')){const d=operationDraft?.();if(d?.requestId)try{await operation(d.operation,true);await navigate('workbench');}catch(error){tell(error.message);}}
  if(b.hasAttribute('data-scope-approve')){approveRecord();void navigate('template');}
  if(b.hasAttribute('data-scope-export'))download({...current,editable:clone(current.editable)},'kitchen-'+role+'-'+current.project.id.slice(0,8)+'.json');
  if(b.hasAttribute('data-scope-save')){busy=true;status();try{const next=await save(current.editable);if(disposed)return;current=clone(next);doc=scopeWidgetDocument(current);bind();dirty=false;tell('حُفظ سجل دورك على الخادم، وبقيت سجلات الأطراف الأخرى محفوظة.');busy=false;await navigate(route);}catch(error){tell(error.message);}finally{busy=false;status();}}
  if(b.hasAttribute('data-scope-reload')){if((dirty||controller?.hasPending?.())&&!confirm('تحديث النسخة سيترك مسودتك الحالية. هل تريد المتابعة؟'))return;try{await reload();}catch(error){tell(error.message);}}
  if(b.hasAttribute('data-scope-projects')){const box=q('[data-scope-project-list]');box.hidden=!box.hidden;if(!box.hidden){box.textContent='جارٍ تحميل المشاريع…';try{const data=await list();if(disposed)return;box.innerHTML=(data.projects||data).map(p=>'<button data-scope-open="'+esc(p.id)+'">'+esc(p.name||'مشروع '+p.id.slice(0,8))+' · '+esc(labels[p.role]||p.role)+'</button>').join('');}catch(error){box.textContent=error.message;}}}
  if(b.dataset.scopeOpen){if(!(dirty||controller?.hasPending?.())||confirm('قد توجد حقول أو تعديلات كتالوج لم تُنشر. هل تريد فتح المشروع الآخر؟'))open(b.dataset.scopeOpen);}
 },{signal});
 const unguard=registerUnsavedWork({atRisk:()=>dirty||!!controller?.hasPending?.(),flush:()=>remember?.(current.editable)});
 status();if(draftStatus==='conflict')tell('توجد مسودة من نسخة أقدم. احتفظ بتنزيل بياناتك ثم حدّث النسخة قبل الدمج.');else if(draftStatus)tell('استُعيدت مسودتك الخاصة بهذا الحساب والدور.');
 await navigate(route);
 const dispose=()=>{disposed=true;serial++;ac.abort();unguard?.();closeWidget();pendingFiles.clear();host.replaceChildren();host.classList.remove('ks-scope');};
 dispose.invalidateApprovedSale=(view,remoteRevision)=>{
  if(disposed||role!=='rep'||view?.access?.role!==role||view.access.subject!==current.access.subject||view.access.scopeVersion!==current.access.scopeVersion||view.project?.id!==current.project.id||view.project.revision!==current.project.revision||view.approvedSale?.status!=='pending'||!Number.isSafeInteger(remoteRevision)||remoteRevision<1||remoteRevision===current.project.revision)return false;
  current={...current,approvedSale:{status:'pending'}};
  const price=q('[data-scope-approved-sale]');if(price)price.innerHTML=approvedSaleHTML(null);
  tell('توجد نسخة أحدث على الخادم؛ لم يعد السعر المعروض سابقًا معتمدًا للنسخة الحالية. بقيت حقولك ومسودتك كما هي. حدّث النسخة بعد الاحتفاظ بتعديلاتك.');
  return true;
 };
 return dispose;
}
