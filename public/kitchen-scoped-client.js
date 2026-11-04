// Role views have their own transport and storage. They are never kitchen
// archives and must not enter the legacy document normalizer or full-save path.
const roles=new Set(['store','factory','rep']),remoteId=v=>typeof v==='string'&&/^[a-z0-9-]{16,64}$/i.test(v);
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),ordinal=v=>Number.isSafeInteger(v)&&v>0;
const subjectOK=v=>typeof v==='string'&&!!v.trim()&&v.length<=256;
const exact=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const editableKeys={store:['storeCatalog'],factory:['factoryRecipes','workshop','fieldRegister','defaults','fieldFiles'],rep:['room','kitchen','workshop','fieldRegister','defaults','photos','fieldFiles']};
const contextKeys={store:[],factory:['geometry','materials','drawerWork'],rep:['materials','families','drawerPacking']};
export function checkedScopedProjectView(raw,{id,subject}={}){
 if(raw?.type==='kitchen-project-view'&&raw.version===1&&['editor','viewer'].includes(raw.access?.role)&&raw.access.status==='assign-role-required')throw Object.assign(Error('يلزم أن يعيّن المالك دور العمل لهذا المشروع.'),{status:403});
 if(!exact(raw,['type','version','project','access','editable','context','approvedSale'])||raw.type!=='kitchen-project-view'||raw.version!==1||
 !exact(raw.project,['id','revision'])||!remoteId(raw.project.id)||!ordinal(raw.project.revision)||id&&raw.project.id!==id||
 !exact(raw.access,['role','subject','scopeVersion'])||!roles.has(raw.access.role)||!subjectOK(raw.access.subject)||raw.access.scopeVersion!==2||subject&&raw.access.subject!==subject)throw Error('نسخة المشروع لا تطابق الحساب أو نطاق الوصول الحالي.');
 const role=raw.access.role,keys=editableKeys[role];
 if(!exact(raw.editable,keys)||keys.some(key=>!Object.hasOwn(raw.editable,key))||!exact(raw.context,contextKeys[role]))throw Error('بنية بيانات الدور غير مدعومة. لم يُفتح الملف كمشروع كامل.');
 if(raw.approvedSale!==undefined){const sale=raw.approvedSale;
  if(role!=='rep'||!exact(sale,['status','totalMinor','currency','revision'])||!['pending','approved'].includes(sale.status)||
   sale.status==='pending'&&Object.keys(sale).some(k=>k!=='status')||sale.status==='approved'&&(!Number.isSafeInteger(sale.totalMinor)||sale.totalMinor<0||sale.currency!=='SAR'||!ordinal(sale.revision)))throw Error('ملخص السعر المعتمد غير صالح.');
 }
 return clone(raw);
}
export const scopedStorageKey=view=>'kitchen-studio:scoped:v1:'+encodeURIComponent(view.access.subject)+':'+view.project.id+':'+view.access.role+':'+view.access.scopeVersion;
export function checkedScopedCatalogView(raw,{id,subject}={}){
 if(!exact(raw,['type','version','catalog','access','editable','context'])||raw.type!=='kitchen-catalog-view'||raw.version!==1||!exact(raw.catalog,['id','version'])||!remoteId(raw.catalog.id)||!ordinal(raw.catalog.version)||id&&raw.catalog.id!==id||!exact(raw.access,['role','subject','scopeVersion'])||!['store','factory'].includes(raw.access.role)||!subjectOK(raw.access.subject)||raw.access.scopeVersion!==1||subject&&raw.access.subject!==subject)throw Error('نسخة الكتالوج لا تطابق نطاق الحساب.');
 const key=raw.access.role==='store'?'storeCatalog':'factoryRecipes';
 if(!exact(raw.editable,[key])||!Object.hasOwn(raw.editable,key)||!exact(raw.context,raw.access.role==='factory'?['materials']:[]))throw Error('بيانات سجل الكتالوج غير صالحة.');
 return clone(raw);
}
const identity=view=>view&&JSON.stringify([view.project.id,view.access.subject,view.access.role,view.access.scopeVersion]);
const problem=(message,status)=>Object.assign(Error(message),{status});
export function createScopedProjectClient({fetcher=(...args)=>fetch(...args),storage=globalThis.sessionStorage,timeoutMs=8000,onTransition=()=>{}}={}){
 let current=null,activeCatalog=null,epoch=0,dead=false,activeOperations=0;const pending=new Set(),operationMemory=new Map();
 const signalState=(status,view=current,error=null,details={})=>{if(!current&&['changed','locked'].includes(status))activeCatalog=null;onTransition({status,view,error,...details});};
 const catalogIdentity=value=>value.type==='kitchen-catalog-view'?{id:value.catalog.id,...value.access}:{id:value.id,role:value.role,subject:value.subject,scopeVersion:value.scopeVersion};
 function invalidate(){epoch++;for(const c of pending)c.abort();pending.clear();return epoch;}
 const alive=ticket=>{if(dead||ticket!==epoch)throw problem('تغيّر الحساب أو المشروع أثناء الطلب. لم تُطبّق الاستجابة.',409);};
 async function request(params,{body,ticket=epoch,resource='projects'}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);pending.add(controller);
  try{
   const response=await fetcher('/api/'+resource+'?'+new URLSearchParams(params),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body===undefined?{}:{'Content-Type':'application/json','X-Studio-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   alive(ticket);if(!response.headers.get('content-type')?.includes('application/json'))throw problem('خدمة المشاريع غير متاحة أو يلزم تسجيل الدخول.',response.status===401?401:503);
   const data=await response.json();alive(ticket);if(!response.ok)throw problem(data.error||'تعذّر الوصول إلى المشروع.',response.status);
   return {data,response};
  }finally{clearTimeout(timer);pending.delete(controller);}
 }
 async function session(ticket){try{const {data}=await request({action:'session'},{ticket});if(!exact(data,['subject'])||!subjectOK(data.subject))throw Error('تعذّر التحقق من الحساب الحالي.');return data.subject;}catch(error){if(ticket===epoch&&!dead){current=null;signalState('locked');}throw error;}}
 function checkedAccess(data,id,subject){
  if(!data||data.id!==id||data.subject!==subject||data.scopeVersion!==2||!ordinal(data.revision)||!['owner',...roles].includes(data.role))throw problem('يلزم أن يعيّن المالك دور العمل لهذا المشروع.',403);
  return data;
 }
 async function verifyAccess(id){const ticket=epoch,subject=await session(ticket),{data}=await request({id,action:'access'},{ticket});return checkedAccess(data,id,subject);}
 async function fetchView(id,subject,ticket){
  const {data,response}=await request({id},{ticket});
  if(data?.type==='kitchen-studio'){
   const metadata={id,role:response.headers.get('X-Studio-Role'),subject:response.headers.get('X-Studio-Subject'),revision:Number(response.headers.get('X-Studio-Revision')),scopeVersion:2};
   if(metadata.role!=='owner'||metadata.subject!==subject||!ordinal(metadata.revision))throw problem('لم يُسمح بفتح الأرشيف الكامل لهذا الحساب.',403);
   return {type:'kitchen-owner-response',archive:data,metadata};
  }
  return checkedScopedProjectView(data,{id,subject});
 }
 function remember(editable){
  if(!current)throw Error('لا يوجد نطاق مشروع مفتوح.');
  const view=checkedScopedProjectView({...current,editable});
  if(view.access.role==='rep')view.approvedSale={status:'pending'};
  const draft={type:'kitchen-project-draft',version:1,view};
  try{storage?.setItem(scopedStorageKey(view),JSON.stringify(draft));}catch{throw Error('تعذّر حفظ مسودة الدور في الجلسة. أبقِ الصفحة مفتوحة.');}
  return view;
 }
 function draftFor(view){
  try{const raw=JSON.parse(storage?.getItem(scopedStorageKey(view))||'null');if(raw?.type!=='kitchen-project-draft'||raw.version!==1)return null;
   const draft=checkedScopedProjectView(raw.view,{id:view.project.id,subject:view.access.subject});
   if(draft.access.role==='rep')draft.approvedSale={status:'pending'};
   return identity(draft)===identity(view)?{view:draft,conflict:draft.project.revision!==view.project.revision}:null;
  }catch{return null;}
 }
 function noteRemoteRevision(before,revision){
  if(before.access.role==='rep'&&revision!==before.project.revision){
   current={...before,approvedSale:{status:'pending'}};
   signalState('sale-invalidated',current,null,{remoteRevision:revision});
  }
 }
 async function load(id){
  if(!remoteId(id))throw Error('مرجع المشروع غير صالح.');const ticket=invalidate();activeCatalog=null;signalState('checking');
  try{const subject=await session(ticket),loaded=await fetchView(id,subject,ticket);alive(ticket);
   current=loaded.type==='kitchen-project-view'?loaded:null;signalState(current?'ready':'owner',loaded);return loaded;
  }catch(error){if(ticket===epoch&&!dead){current=null;signalState('locked');}throw error;}
 }
 async function revalidate(){
  if(!current)throw Error('أعد فتح المشروع للتحقق من الوصول.');const previous=current,ticket=invalidate();signalState('checking');
  try{
   const subject=await session(ticket),{data}=await request({id:previous.project.id,action:'access'},{ticket});
   const access=checkedAccess(data,previous.project.id,subject);
   if(subject===previous.access.subject&&access.role===previous.access.role&&access.scopeVersion===previous.access.scopeVersion){
    noteRemoteRevision(previous,access.revision);
    if(activeCatalog){
     const watched=activeCatalog,{data:raw}=await request({id:watched.id},{ticket,resource:'catalogs'}),catalog=catalogResponse(raw,watched.id,subject);
     if(!same(catalogIdentity(catalog),watched)){
      activeCatalog=null;signalState('changed');signalState('ready',current);
      return {changed:true,view:current,remoteRevision:access.revision};
     }
    }
    // Unsaved form input stays mounted when the account and scope are the same.
    // A newer remote revision is resolved explicitly by save/reload, never by
    // silently replacing an editor's unfinished work on focus.
    signalState('ready',current);return {changed:false,view:current,remoteRevision:access.revision};
   }
   current=null;signalState('changed');const loaded=await fetchView(previous.project.id,subject,ticket);alive(ticket);
   current=loaded.type==='kitchen-project-view'?loaded:null;signalState(current?'ready':'owner',loaded);return {changed:true,view:loaded};
  }catch(error){if(ticket===epoch&&!dead){current=null;signalState('locked');}throw error;}
 }
 async function save(editable){
  if(!current)throw Error('أعد التحقق من الوصول قبل الحفظ.');
  if(readOperationDraft(current)?.requestId)throw problem('توجد عملية مرسلة لم يُحسم حفظها. استعد نتيجتها أو اتركها صراحة قبل حفظ مسودة المشروع.',409);
  const before=current,draft=remember(editable),ticket=invalidate();signalState('saving');
  try{
   const subject=await session(ticket),{data}=await request({id:before.project.id,action:'access'},{ticket});
   const access=checkedAccess(data,before.project.id,subject);
   if(subject!==before.access.subject||access.role!==before.access.role||access.scopeVersion!==before.access.scopeVersion){current=null;signalState('changed');throw problem('تغيّر حسابك أو دورك. أعد فتح المشروع.',403);}
   if(access.revision!==before.project.revision){noteRemoteRevision(before,access.revision);throw problem('توجد نسخة أحدث. بقيت مسودتك محفوظة في نطاق حسابك؛ راجع النسخة قبل الحفظ.',409);}
   const body={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:before.project.revision,editable:draft.editable};
   const requestId=globalThis.crypto.randomUUID();
   await request({id:before.project.id,action:'patch',expected:String(before.project.revision),request:requestId},{body,ticket});
   const loaded=await fetchView(before.project.id,subject,ticket);alive(ticket);
   if(loaded.type!=='kitchen-project-view'||identity(loaded)!==identity(before)){current=null;signalState('changed');throw problem('تغيّر نطاق الوصول بعد الحفظ. أعد فتح المشروع.',403);}
   current=loaded;try{storage?.removeItem(scopedStorageKey(before));}catch{}signalState('ready');return loaded;
  }catch(error){
   if(ticket===epoch&&!dead){
    let keep=identity(current)===identity(before)&&current?.project.revision===before.project.revision&&error.status===409;
    // A validation error is not a revocation. Recheck the authenticated scope
    // after that response before leaving the user's editable draft on screen.
    if(current===before&&[400,422].includes(error.status))try{
     const subject=await session(ticket),{data}=await request({id:before.project.id,action:'access'},{ticket}),access=checkedAccess(data,before.project.id,subject);
     keep=subject===before.access.subject&&access.role===before.access.role&&access.scopeVersion===before.access.scopeVersion;
    }catch{keep=false;}
    if(ticket===epoch&&!dead){if(!keep)current=null;signalState(current?'ready':'locked',current,error);}
   }
   throw error;
  }
 }
 async function previewDesign(options){
  if(current?.access.role!=='rep')throw problem('اقتراح التصميم متاح للمندوب في نطاقه الحالي.',403);
  const before=current,ticket=epoch,subject=await session(ticket),{data:permission}=await request({id:before.project.id,action:'access'},{ticket});
  const access=checkedAccess(permission,before.project.id,subject);
  if(subject!==before.access.subject||access.role!=='rep'||access.revision!==before.project.revision){current=null;signalState('changed');throw problem('تغيّر الحساب أو الإصدار. أعد فتح المشروع قبل اقتراح التصميم.',409);}
  const {data}=await request({id:before.project.id,action:'design-preview',expected:String(before.project.revision)},{ticket,body:options});
  if(!exact(data,['type','version','project','access','choices'])||data.type!=='kitchen-design-choices'||data.version!==1||!same(data.project,before.project)||!same(data.access,before.access)||!Array.isArray(data.choices))throw Error('استجابة اقتراح التصميم غير صالحة لهذا النطاق.');
  for(const choice of data.choices){if(!exact(choice,['editable']))throw Error('محتوى اقتراح التصميم غير مدعوم.');checkedScopedProjectView({...before,editable:choice.editable});}
  return clone(data);
 }
 const operationKinds=new Set(['interior.set','drawer.measure','drawer.preference','packing.measure','packing.accept','packing.clear','special.review']);
 const operationKey=view=>scopedStorageKey(view)+':operation';
 const responseMismatch=message=>Object.assign(problem(message||'استجابة الأداة لا تطابق نطاق المشروع.',502),{scopeMismatch:true});
 function checkedOperationPreview(data,source,operation){
  if(!exact(data,['type','version','project','access','operation','result','review'])||data.type!=='kitchen-operation-preview'||data.version!==1||!same(data.project,source.project)||!same(data.access,source.access)||!exact(data.operation,['kind'])||data.operation.kind!==operation.kind||!object(data.result)||!(data.review===null||typeof data.review==='string'&&/^[a-f0-9]{64}$/.test(data.review)))throw responseMismatch();
  return clone(data);
 }
 function readOperationDraft(view){
  if(!view||!['factory','rep'].includes(view.access?.role))return null;const key=operationKey(view);let raw;
  try{raw=JSON.parse(storage?.getItem(key)||'null');}catch{raw=operationMemory.get(key);}
  if(!raw)raw=operationMemory.get(key);if(!raw)return null;
  try{
   if(!exact(raw,['type','version','project','access','operation','preview','requestId','body'])||raw.type!=='kitchen-operation-draft'||raw.version!==1||identity(raw)!==identity(view)||!ordinal(raw.project.revision)||!operationKinds.has(raw.operation?.kind))return null;
   if(raw.preview!==null)checkedOperationPreview(raw.preview,raw,raw.operation);
   if(raw.requestId!==null&&(!remoteId(raw.requestId)||!object(raw.body)||!same(raw.body,{type:'kitchen-project-operation',version:1,baseRevision:raw.project.revision,operation:raw.operation,review:raw.body.review})||typeof raw.body.review!=='string'||!/^[a-f0-9]{64}$/.test(raw.body.review)||raw.preview&&raw.preview.review!==raw.body.review))return null;
   if(raw.requestId===null&&raw.body!==null)return null;
   return clone(raw);
  }catch{return null;}
 }
 function operationDraftFor(view=current){const draft=readOperationDraft(view);return draft?{...draft,conflict:draft.project.revision!==view.project.revision}:null;}
 function writeOperationDraft(view,draft){
  const key=operationKey(view),copy=clone(draft);operationMemory.set(key,copy);
  try{if(!storage?.setItem)throw Error();storage.setItem(key,JSON.stringify(copy));}catch{throw problem('تعذّر حفظ مسودة العملية للاسترداد. بقيت الحقول مفتوحة ولم تُرسل عملية جديدة.',507);}
 }
 function clearOperationDraft(view){const key=operationKey(view);storage?.removeItem(key);operationMemory.delete(key);}
 function discardOperationDraft(){
  if(!current)throw problem('أعد التحقق من نطاق المشروع قبل ترك مسودة العملية.',403);
  if(activeOperations||pending.size)throw problem('انتظر اكتمال الطلب قبل ترك مسودة العملية.',409);
  try{clearOperationDraft(current);}catch{throw problem('تعذّر إزالة مسودة العملية من الجلسة.',507);}return true;
 }
 async function operationAuthority(source,ticket){
  // Unlike the general session helper, an operation rechecks a transient
  // failure before deciding whether its mounted, unsent fields must be hidden.
  const {data:account}=await request({action:'session'},{ticket});
  if(!exact(account,['subject'])||!subjectOK(account.subject))throw problem('تعذّر التحقق من الحساب الحالي.',403);
  const {data}=await request({id:source.project.id,action:'access'},{ticket}),access=checkedAccess(data,source.project.id,account.subject);
  if(account.subject!==source.access.subject||access.role!==source.access.role||access.scopeVersion!==source.access.scopeVersion)throw problem('تغيّر حسابك أو دورك. أعد فتح المشروع.',403);
  return access;
 }
 async function projectOperation(operation,review){
  if(!current||!['factory','rep'].includes(current.access.role))throw problem('هذه الأدوات متاحة للمصنع والمندوب في نطاق المشروع.',403);
  const apply=review!==undefined,before=current,ticket=apply?invalidate():epoch,mutates=operationKinds.has(operation?.kind);let draft=null;
  activeOperations++;
  try{
   if(!object(operation)||typeof operation.kind!=='string'||apply&&(!mutates||typeof review!=='string'||!/^[a-f0-9]{64}$/.test(review)))throw problem('راجع أمر العملية ومعاينته.',400);
   if(mutates){
    const prior=readOperationDraft(before),matching=prior&&same(prior.operation,operation);
    if(prior?.requestId&&(!matching||apply&&prior.body.review!==review))throw problem('توجد عملية مرسلة لم يُحسم حفظها. استعد نتيجتها أو اتركها صراحة قبل إرسال تعديل آخر.',409);
    if(apply&&matching&&prior.preview&&prior.preview.review!==review)throw problem('لا يطابق مرجع التطبيق معاينة هذا الأمر. أعد مراجعته قبل الحفظ.',409);
    draft=matching&&prior.requestId?prior:matching&&apply?prior:{type:'kitchen-operation-draft',version:1,project:clone(before.project),access:clone(before.access),operation:clone(operation),preview:null,requestId:null,body:null};
    writeOperationDraft(before,draft);
   }
   const access=await operationAuthority(before,ticket),retry=!!draft?.requestId;
   if(!retry&&access.revision!==before.project.revision)throw problem('توجد نسخة أحدث. بقي أمر التعديل محفوظًا للاسترداد؛ راجع النسخة الحالية قبل التطبيق.',409);
   if(!apply&&retry){if(!draft.preview)throw problem('استعد العملية المرسلة بمرجعها الأصلي أو راجع النسخة الحالية.',409);return clone(draft.preview);}
   const source=draft||before;
   if(!retry&&source.project.revision!==before.project.revision)throw problem('تخص المعاينة نسخة سابقة. أعد مراجعة الأمر على النسخة الحالية قبل إرساله.',409);
   const body=apply&&retry?draft.body:{type:'kitchen-project-operation',version:1,baseRevision:source.project.revision,operation:clone(operation),...(apply?{review}:{})};
   if(apply&&!retry){draft={...draft,requestId:globalThis.crypto.randomUUID(),body:clone(body)};writeOperationDraft(before,draft);}
   const {data}=await request({id:before.project.id,action:apply?'operation-apply':'operation-preview',expected:String(body.baseRevision),...(apply?{request:draft.requestId}:{})},{ticket,body});
   if(!apply){const preview=checkedOperationPreview(data,source,operation);if(mutates){draft={...draft,preview};writeOperationDraft(before,draft);}return preview;}
   let loaded;
   if(data?.type==='kitchen-project-view'){try{loaded=checkedScopedProjectView(data,{id:before.project.id,subject:before.access.subject});}catch{throw responseMismatch();}}
   else loaded=await fetchView(before.project.id,before.access.subject,ticket);
   alive(ticket);
   if(loaded.type!=='kitchen-project-view'||identity(loaded)!==identity(before))throw responseMismatch('تغيّر نطاق الوصول. أعد فتح المشروع.');
   if(loaded.project.revision!==body.baseRevision+1)throw problem('وصلت نسخة أحدث من نتيجة هذه العملية. قد يكون التعديل محفوظًا؛ بقي أمره للاسترداد. افتح النسخة الحالية وراجعها قبل إرسال تعديل آخر.',409);
   current=loaded;try{clearOperationDraft(before);storage?.removeItem(scopedStorageKey(before));}catch{}signalState('ready');return loaded;
  }catch(error){
   if(ticket===epoch&&!dead&&current===before){
    let keep=false;
    if(!error.scopeMismatch&&![401,403].includes(error.status))try{await operationAuthority(before,ticket);keep=true;}catch{}
    // A rejected command did not commit. Preserve its input, but allow the
    // user to correct it without replaying the rejected request bytes.
    if(draft?.requestId&&[400,422].includes(error.status))try{writeOperationDraft(before,{...draft,requestId:null,body:null});}catch{}
    if(ticket===epoch&&!dead){if(!keep)current=null;signalState(current?'ready':'locked',current,error);}
   }
   throw error;
  }finally{activeOperations--;}
 }
 async function list(){const ticket=epoch,subject=await session(ticket),{data}=await request({},{ticket});
  if(current&&subject!==current.access.subject){invalidate();current=null;signalState('changed');throw problem('تغيّر الحساب. أعد فتح قائمة المشاريع.',403);}
  if(!Array.isArray(data.projects))throw Error('قائمة المشاريع غير صالحة.');return data.projects.filter(p=>remoteId(p.id)&&ordinal(p.revision)&&['owner',...roles].includes(p.role)).map(p=>({id:p.id,name:String(p.name||'مشروع مطبخ'),revision:p.revision,role:p.role}));
 }
 async function catalogSession(ticket){const before=current,subject=await session(ticket);if(!before||subject!==before.access.subject){invalidate();current=null;signalState('changed');throw problem('تغيّر الحساب. أعد فتح المشروع قبل استخدام الكتالوج.',403);}
  const {data}=await request({id:before.project.id,action:'access'},{ticket});
  const access=checkedAccess(data,before.project.id,subject);
  if(access.role!==before.access.role||access.scopeVersion!==before.access.scopeVersion){invalidate();current=null;signalState('changed');throw problem('تغيّر دور المشروع. أعد فتح نطاق العمل.',403);}return subject;}
 function catalogResponse(raw,id,subject){
  if(raw?.type==='kitchen-catalog-view')return checkedScopedCatalogView(raw,{id,subject});
  if(raw?.role==='owner'&&raw.subject===subject&&raw.id===id&&ordinal(raw.version)&&raw.scopeVersion===1&&object(raw.catalogRecords)&&object(raw.catalog))return clone(raw);
  throw problem('لا تطابق بيانات الكتالوج صلاحية الحساب الحالي.',403);
 }
 async function listCatalogs(){const ticket=epoch;await catalogSession(ticket);const {data}=await request({},{ticket,resource:'catalogs'});
  if(!Array.isArray(data.catalogs))throw Error('قائمة الكتالوجات غير صالحة.');return data.catalogs.filter(c=>remoteId(c.id)&&ordinal(c.version)&&['owner','store','factory'].includes(c.role)).map(c=>({id:c.id,name:String(c.name||'كتالوج الفريق'),version:c.version,role:c.role}));
 }
 async function loadCatalog(id,version){if(!remoteId(id)||version!==undefined&&!ordinal(Number(version)))throw Error('مرجع الكتالوج غير صالح.');const ticket=epoch,subject=await catalogSession(ticket),{data}=await request({id,...(version!==undefined?{version:String(version)}:{})},{ticket,resource:'catalogs'});const catalog=catalogResponse(data,id,subject);activeCatalog=catalogIdentity(catalog);return catalog;}
 async function saveCatalog(view,editable){
  const checked=checkedScopedCatalogView(view),ticket=epoch,subject=await catalogSession(ticket);
  if(checked.access.subject!==subject)throw problem('لا تخص هذه المسودة الحساب الحالي.',403);
  checkedScopedCatalogView({...checked,editable});
  const {data:latestRaw}=await request({id:checked.catalog.id},{ticket,resource:'catalogs'}),latest=checkedScopedCatalogView(latestRaw,{id:checked.catalog.id,subject});
  if(!same(latest.access,checked.access)||latest.catalog.version!==checked.catalog.version)throw problem('تغيّر دور الكتالوج أو إصداره. أعد تحميله قبل النشر.',409);
  const body={type:'kitchen-catalog-edit',version:1,baseVersion:checked.catalog.version,editable};
  const {data}=await request({id:checked.catalog.id,action:'publish',expected:String(checked.catalog.version),request:globalThis.crypto.randomUUID()},{body,ticket,resource:'catalogs'});
  const saved=checkedScopedCatalogView(data,{id:checked.catalog.id,subject});activeCatalog=catalogIdentity(saved);return saved;
 }
 async function saveOwnerCatalog(view,records){
  const ticket=epoch,subject=await catalogSession(ticket),original=catalogResponse(view,view?.id,subject);
  if(original.role!=='owner'||records?.type!=='kitchen-catalog-records'||records.version!==1)throw problem('نشر الكتالوج الكامل يتطلب ملكية هذا الكتالوج وسجلاته الأصلية.',403);
  const {data:latestRaw}=await request({id:original.id},{ticket,resource:'catalogs'}),latest=catalogResponse(latestRaw,original.id,subject);
  if(latest.role!=='owner'||latest.version!==original.version)throw problem('تغيّرت ملكية الكتالوج أو إصداره. أعد تحميله قبل النشر.',409);
  await request({id:original.id,action:'publish',expected:String(original.version),request:globalThis.crypto.randomUUID()},{body:records,ticket,resource:'catalogs'});
  const {data}=await request({id:original.id},{ticket,resource:'catalogs'}),saved=catalogResponse(data,original.id,subject);
  if(saved.role!=='owner')throw problem('تغيّر دور الكتالوج بعد الحفظ. أعد فتحه.',403);activeCatalog=catalogIdentity(saved);return saved;
 }
 return {load,revalidate,save,remember,list,previewDesign,previewOperation:operation=>projectOperation(operation),applyOperation:(operation,review)=>projectOperation(operation,review),operationDraftFor,discardOperationDraft,listCatalogs,loadCatalog,saveCatalog,saveOwnerCatalog,verifyAccess,draftFor,getView:()=>current,dispose(){dead=true;invalidate();current=null;activeCatalog=null;operationMemory.clear();},async account(){return session(epoch);}};
}

const read=(store,key)=>{try{return JSON.parse(store?.getItem(key)||'null');}catch{return null;}};
const projectKey='atlas-kitchen:project:v1',registryKey='kitchen-workshop:access:v1',linkKey='kitchen-workshop:remote:v1';
export function sharedProjectTarget({url=globalThis.location?.href,store=globalThis.localStorage,session=globalThis.sessionStorage}={}){
 const q=new URL(url).searchParams,explicit=q.get('shared')||q.get('remote')||q.get('project');
 if(explicit)return {id:explicit,explicit:true};
 if(q.get('projects')==='shared')return {selector:true};
 const localId=read(store,projectKey)?.room?.projectId,binding=localId&&read(store,registryKey)?.[localId],legacy=read(session,linkKey);
 const linked=binding||localId&&(!legacy?.localProjectId||legacy.localProjectId===localId)&&legacy;
 return linked?.id?{id:linked.id,localId,revision:linked.revision,subject:linked.subject||null,explicit:false}:null;
}
export function scopedProjectURL(id,{url=globalThis.location.href}={}){const next=new URL(url);next.pathname='/';next.search='';next.hash='';if(id)next.searchParams.set('shared',id);else next.searchParams.set('projects','shared');return next.href;}

// Called before importing any full editor or reading its archived content.
export async function bootstrapSharedWorkspace({unit=false,mount,fetcher,storage,window:win=globalThis.window,document:dom=globalThis.document}={}){
 const target=sharedProjectTarget();if(!target)return false;
 const originalNodes=[...dom.body.childNodes];
 const host=dom.createElement('main');host.id='kitchen-scoped-workspace';host.dir='rtl';host.className='kitchen-scoped-workspace';
 dom.body.replaceChildren(host);let disposeView=null,mounted=null,checking=false,saleNotice=null,client;
 const dispose=()=>{try{if(typeof disposeView==='function')disposeView();else disposeView?.dispose?.();}catch{/* a failed widget cleanup cannot hide access recovery */}finally{disposeView=null;mounted=null;saleNotice=null;}};
 const textNotice=message=>{host.hidden=false;host.replaceChildren();const p=dom.createElement('p');p.textContent=message;host.append(p);};
 const open=id=>win.location.assign(scopedProjectURL(id));
 const showError=error=>{checking=false;dispose();textNotice(error.message||'تعذّر التحقق من الوصول. بقيت نسخ الجهاز محفوظة للاسترداد دون فتحها.');
  if(error.status===401){const signIn=dom.createElement('a');signIn.href='/signin-with-chatgpt?'+new URLSearchParams({return_to:remoteId(target.id)?'/?shared='+target.id:'/?projects=shared'});signIn.target='_top';signIn.textContent='تسجيل الدخول';host.append(signIn);}
  const retry=dom.createElement('button');retry.textContent='إعادة التحقق';retry.onclick=()=>win.location.reload();host.append(retry);const projects=dom.createElement('button');projects.textContent='مشاريع الحساب';projects.onclick=()=>open(null);host.append(projects);};
 client=createScopedProjectClient({fetcher,storage,onTransition:({status,error,view,remoteRevision})=>{
  if(status==='checking'){host.hidden=true;checking=true;}
  else if(status==='sale-invalidated'){saleNotice={view,remoteRevision};disposeView?.invalidateApprovedSale?.(view,remoteRevision);}
  else if(status==='changed'||status==='locked'){const pendingCheck=checking;showError(error||Error(status==='changed'?'تغيّر الحساب أو نطاق الوصول. أعد فتح المشروع للتحقق.':'تعذّر التحقق من صلاحية المشروع. بقيت مسودتك محفوظة لنطاق حسابك؛ أعد التحقق للمتابعة.'));if(status==='changed'&&pendingCheck)checking=true;}
  else if(status==='ready'){host.hidden=false;checking=false;}
 }});
 const render=async view=>{
  if(view.type!=='kitchen-project-view')return;
  dispose();host.hidden=false;host.replaceChildren();mounted=view;
  const start=mount||(await import('./kitchen-scoped-workspace.js')).mountScopedWorkspace;
  const draft=client.draftFor(view),shown={...view,...(draft&&!draft.conflict?{editable:draft.view.editable}:{}),...(draft&&view.access.role==='rep'?{approvedSale:{status:'pending'}}:{})};
  disposeView=await start(host,{view:shown,draftStatus:draft?(draft.conflict?'conflict':'restored'):null,remember:editable=>client.remember(editable),
   save:editable=>client.save(editable),previewDesign:options=>client.previewDesign(options),previewOperation:operation=>client.previewOperation(operation),applyOperation:(operation,review)=>client.applyOperation(operation,review),operationDraft:()=>client.operationDraftFor(client.getView()),discardOperationDraft:()=>client.discardOperationDraft(),listCatalogs:()=>client.listCatalogs(),loadCatalog:(id,version)=>client.loadCatalog(id,version),saveCatalog:(catalog,editable)=>client.saveCatalog(catalog,editable),saveOwnerCatalog:(catalog,records)=>client.saveOwnerCatalog(catalog,records),reload:async()=>{const next=await client.load(view.project.id);if(next.type!=='kitchen-project-view'){win.location.reload();return next;}await render(next);return next;},list:()=>client.list(),open,leave:()=>open(null)});
  if(saleNotice&&identity(saleNotice.view)===identity(view))disposeView?.invalidateApprovedSale?.(saleNotice.view,saleNotice.remoteRevision);
 };
 if(target.selector){
  try{const projects=await client.list();textNotice('مشاريع الحساب الحالي');for(const project of projects){const button=dom.createElement('button');button.textContent=project.name;button.onclick=()=>open(project.id);host.append(button);}if(!projects.length)textNotice('لا توجد مشاريع مشتركة متاحة لهذا الحساب. بقيت نسخ الجهاز محفوظة للاسترداد.');}catch(error){showError(error);}win.addEventListener('focus',()=>{host.hidden=true;win.location.reload();});return true;
 }
 try{
  const loaded=await client.load(target.id);
  if(loaded.type==='kitchen-owner-response'){
   const localId=read(globalThis.localStorage,projectKey)?.room?.projectId,cached=localId&&read(globalThis.localStorage,registryKey)?.[localId];
   if(cached?.subject&&cached.subject!==loaded.metadata.subject)throw Error('توجد نسخة محلية محفوظة لحساب آخر. بقيت محفوظة للاسترداد؛ لن تُفتح أو تُستبدل من هذا الحساب.');
   if(cached?.id&&cached.id!==target.id&&!cached.subject){const prior=await client.verifyAccess(cached.id);if(prior.role!=='owner'||prior.subject!==loaded.metadata.subject)throw Error('بقيت النسخة المحلية القديمة محفوظة لحساب مالكها دون فتحها أو استبدالها.');}
   const {bindProjectAccess,withTrustedProjectInstall}=await import('./kitchen-project-access.js');
   const project=await import('./kitchen-project.js');
   const current=project.storedKitchenProject();
   if(!target.explicit&&current?.room?.projectId===target.localId){bindProjectAccess(current,{...loaded.metadata,revision:target.revision});}
   else{
    const {decodeCloudProject}=await import('./kitchen-workshop-sync-ui.js'),next=await decodeCloudProject(loaded.archive,target.id),before=project.openKitchenProject();
    const saved=withTrustedProjectInstall(next,loaded.metadata,()=>project.commitProject(before,next,{restoreArchive:true}));
    if(!saved?.ok||!saved.saved)throw Error(saved?.reason||'تعذّر حفظ نسخة المالك. بقيت النسخة السابقة دون فتح.');
   }
   // A future focus must verify the principal before the legacy owner DOM is
   // shown again. A changed account/role leaves this entire document behind.
   const ownerSubject=loaded.metadata.subject;let serial=0;
   const guard=async()=>{const ticket=++serial;dom.documentElement.style.visibility='hidden';try{
    const access=await client.verifyAccess(target.id);
    if(ticket!==serial)return;if(access.subject!==ownerSubject||access.role!=='owner'||access.scopeVersion!==2){win.location.replace(scopedProjectURL(target.id));return;}
    dom.documentElement.style.visibility='';
   }catch{if(ticket===serial)win.location.replace(scopedProjectURL(target.id));}};
   win.addEventListener('focus',guard);dom.addEventListener('visibilitychange',()=>{if(dom.visibilityState==='visible')void guard();});
   dom.body.replaceChildren(...originalNodes);return false;
  }
  if(unit){win.location.replace(scopedProjectURL(target.id));return true;}
  await render(loaded);
 }catch(error){showError(error);}
 const refresh=async()=>{if(checking)return;try{const result=client.getView()?await client.revalidate():{changed:true,view:await client.load(target.id)};if(result.changed){if(result.view.type==='kitchen-owner-response'){win.location.reload();return;}await render(result.view);}}catch(error){showError(error);}};
 win.addEventListener('focus',refresh);dom.addEventListener('visibilitychange',()=>{if(dom.visibilityState==='visible')void refresh();});
 return true;
}
