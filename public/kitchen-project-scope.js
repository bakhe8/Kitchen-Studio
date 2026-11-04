// Network views are deliberately NOT portable archives. Missing private values
// never enter cleanIdea as an apparent complete project. Merge starts with the
// server's full snapshot, preserves hidden fields, and rechecks domain authority.
import {cleanIdea} from './kitchen-ideas.js';
import {fieldInputRole,authorizeProjectChange,authorizeCatalogChange} from './kitchen-access-policy.js';
import {catalogRecordsFromWorkshop,normalizeWorkshopCatalogs,reconcileWorkshopCatalogs} from './kitchen-catalog-records.js';
import {catalogFactoryFields,readWorkshopCatalog} from './kitchen-catalog-view.js';
import {decodePortableCatalog} from './kitchen-factory-template.js';
import {getProjectDefaultProfile,defaultPropertyKey} from './kitchen-defaults-model.js';
import {applyWorkshopCorner} from './kitchen-production-row.js';
import {pruneBaseSupportChoices} from './kitchen-base-support.js';
import {drawerPackHosts,drawerPackIssues} from './kitchen-drawer-packing.js';
import {drawerRunnerPlans} from './kitchen-drawer-fit.js';

export const projectScopeVersion=2;
export const factoryWorkshopFields=Object.freeze(['referenceOrder','baseSupport','upstand','corners','surfaceTemplate','surfacePatterns','installReadiness']);
export const repWorkshopFields=Object.freeze(['wallPairs','tapChecks','decisionReview','applianceIntake','chains','layoutBrief','rows','options','surfaces3d','measureFit','pipeRoutes','serviceZones','clientUsage','applianceFit','wallProfiles','guideFinishReview','activeWall','finishes']);
export const repRoomFields=Object.freeze(['width','length','height','colors','architecture','sitePoints','cladding','name','floor','backsplash','photoRefs']);
export const scopedDefaultKeys=Object.freeze(['baseRows','overrides']);
export const ownedWorkshopFields=role=>role==='factory'?factoryWorkshopFields:role==='rep'?repWorkshopFields:[];
export const scopedEditableKeys=role=>role==='store'?['storeCatalog']:role==='factory'?['factoryRecipes','workshop','fieldRegister','defaults','fieldFiles']:role==='rep'?['room','kitchen','workshop','fieldRegister','defaults','photos','fieldFiles']:[];
const supported=role=>['store','factory','rep'].includes(role);
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>v===undefined?undefined:structuredClone(v);
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,copy(v[k])]));
const canonical=v=>Array.isArray(v)?v.map(canonical):obj(v)?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const fail=reason=>{throw Error(reason);};
const ordinal=n=>Number.isSafeInteger(n)&&n>0;
function keys(v,allowed,required=allowed){if(!obj(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))fail('صيغة التعديل المحدود تحتوي حقولًا غير مسموحة أو ناقصة.');}
function jsonValue(v,depth=0,budget={n:0}){
 if(depth>60||++budget.n>500000)fail('التعديل أكبر من الحد المسموح.');
 if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
 if(Array.isArray(v)){for(const x of v)jsonValue(x,depth+1,budget);return;}
 if(!obj(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('صيغة التعديل غير صالحة.');
 for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('اسم حقل غير صالح.');jsonValue(x,depth+1,budget);}
}
const rowsOf=doc=>doc.room.fieldRegister?.records||[];
const ownsRow=(role,row)=>fieldInputRole(row?.inputCode??row?.code)===role;
function fullDoc(archive){const doc=cleanIdea(archive?.design);if(!doc)fail('تعذّر التحقق من المشروع الكامل.');return doc;}
function readableFiles(role,doc){
 const allowed=new Set(),blocked=new Set();
 for(const row of rowsOf(doc))for(const ref of row.attachments||[])(ownsRow(role,row)?allowed:blocked).add(ref.id);
 return new Set([...allowed].filter(id=>!blocked.has(id)));
}
function fieldSlice(role,doc,archive){
 const ids=readableFiles(role,doc);
 return {fieldRegister:{version:1,records:rowsOf(doc).filter(r=>ownsRow(role,r)).map(r=>({...copy(r),attachments:(r.attachments||[]).filter(a=>ids.has(a.id)).map(copy)}))},
  fieldFiles:(archive.fieldFiles||[]).filter(f=>ids.has(f.id)).map(copy)};
}
function defaultSlice(role,doc){return {baseRows:getProjectDefaultProfile(doc).rows.filter(r=>ownsRow(role,r)).map(copy),overrides:(doc.room.defaults?.overrides||[]).filter(r=>ownsRow(role,r)).map(copy)};}
function repRows(rows){return mapValues(rows,row=>Object.fromEntries(Object.entries(row).filter(([k])=>k!=='drawerChecks').map(([k,v])=>[k,copy(v)])));}
function repUsage(usage){return {...pick(usage,['tasks']),...(usage.pack?{pack:{groups:copy(usage.pack.groups),permissions:usage.pack.bays.map(b=>({bayId:b.id,allowAuto:b.allowAuto}))}}:{})};}
function workshopSlice(role,w){return Object.fromEntries(ownedWorkshopFields(role).map(k=>[k,w[k]===undefined?null:k==='referenceOrder'?pick(w[k],['orderNo','toleranceMm','lines']):role==='rep'&&k==='rows'?repRows(w[k]):role==='rep'&&k==='clientUsage'?repUsage(w[k]):copy(w[k])]));}

// These lists contain public physical specifications, not purchasing, inventory,
// recipe formulas, internal references, or financial assumptions.
const materialKeys=['sku','name','kind','role','color','colorHex','thicknessMm','sectionWidthMm','gaugeMm','grooveWidthMm','grooveDepthMm','massKgM2','hardwareRole'];
const runnerKeys=['minWidthMm','maxWidthMm','minDepthMm','maxDepthMm','minGapMm','maxGapMm','travelMm','movingKg'];
const familyKeys=['label','base','cadKind','minMm','maxMm','stepMm','minHeightMm','maxHeightMm','heightStepMm','minDepthMm','maxDepthMm','depthStepMm','customerBay','frontSkus','drawerRunners'];
function materialSpecs(records,role){return (records?.storeCatalog.items||[]).map(item=>({...pick(item,[...materialKeys,...(role==='factory'?['stockLengthMm','stockWidthMm','kerfMm']:[])]),...(item.runnerSpec?{runnerSpec:pick(item.runnerSpec,runnerKeys)}:{})}));}
const mapValues=(value,project)=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,project(item)]));
const finishKeys=['body','back','shelf','divider','profile','edge','handle','hinge','accessory'];
const skuChoices=value=>Object.fromEntries(Object.entries(value||{}).filter(([,sku])=>typeof sku==='string').map(([key,sku])=>[key,sku]));
const physicalCheckKeys=['clearWidthMm','clearDepthMm','leftGapMm','rightGapMm','minTravelMm','freeTravelMm','emptyKg'];
const packingCodes=new Set(['REQUEST_REQUIRED','MEASUREMENT_REQUIRED','MEASUREMENT_STALE','MEASUREMENT_OUTSIDE','CUSTOMER_LOAD_REQUIRED','RICE_LOAD_REQUIRED','REQUEST_DOES_NOT_FIT','NO_TECHNICAL_RUNNER','SEARCH_LIMIT','ACCEPTANCE_STALE']);
// These views are operational read models. Proof hashes and private prose never
// become editable DTO fields; trusted server commands stamp their canonical form.
export function scopedDrawerInputs(doc,role){
 if(!['rep','factory'].includes(role))return [];
 const w=doc.room.workshop||{},catalog=readWorkshopCatalog(w),hosts=drawerPackHosts(doc,{technicalOnly:true}),plans=catalog?drawerRunnerPlans(catalog,w.rows||{},doc.kitchen.units,doc.kitchen.runs,w.finishes,doc,undefined,{technicalOnly:true}):new Map(),out=[];
 for(const [runId,row] of Object.entries(w.rows||{}))for(const entry of row.units){
  const u=doc.kitchen.units.find(u=>u.id===entry.id&&u.runId===runId);if(u?.kind!=='drawers')continue;
  for(let index=1;index<=(u.drawerCount||3);index++){
   const v=row.drawerChecks?.[u.id]?.[index],bayId=u.id+'#'+index,host=hosts.get(bayId),plan=plans.get(u.id),selected=plan?.rows.find(p=>p.drawerIndex===index);
   const status=!v?'MEASUREMENT_REQUIRED':!host?.confirmed?'MEASUREMENT_STALE':v.contentsKg===null?'CUSTOMER_LOAD_REQUIRED':plan?.statusCodes.includes('RICE_LOAD_REQUIRED')?'RICE_LOAD_REQUIRED':selected?'ready':'NO_TECHNICAL_RUNNER';
   out.push({unitId:u.id,runId,index,bayId,measurement:v?pick(v,[...physicalCheckKeys,...(role==='factory'?['reference']:[])]):null,contentsKg:v?.contentsKg??null,pin:v?.pin||'',status,
    selection:selected&&status==='ready'?pick(selected,['sku','movingKg','travelMm']):null});
  }
 }
 return out;
}
export function scopedDrawerPacking(doc,role){
 if(!['rep','factory'].includes(role))return {bays:[],accepted:null,statusCodes:[]};
 const pack=doc.room.workshop?.clientUsage?.pack,hosts=drawerPackHosts(doc,{technicalOnly:true});
 const statusCodes=pack?.groups.length?[...new Set(drawerPackIssues(doc,undefined,{technicalOnly:true}))].filter(c=>packingCodes.has(c)):['REQUEST_REQUIRED'];
 const bays=(pack?.bays||[]).map(b=>{const h=hosts.get(b.id),current=!!(b.entryAt&&h?.confirmed&&b.basis===h.basis&&b.size.every((n,i)=>n<=h.limit[i]));return {...pick(b,['id','size','entry','entryAt',...(role==='factory'?['reference','allowAuto']:[])]),current};});
 return {bays,...(role==='factory'?{groups:(pack?.groups||[]).map(g=>pick(g,['id','size','count','massKg','rotate','stack','together','fixed']))}:{}),
  accepted:pack?.accepted?{slots:copy(pack.accepted.slots),...(role==='rep'?{reference:pack.accepted.reference}:{}),current:!!pack.groups.length&&!statusCodes.length}:null,statusCodes};
}
export function scopedDrawerPackingResult(proposal,role){
 if(!['rep','factory'].includes(role))return {ok:false,status:'review',code:'REQUEST_DOES_NOT_FIT'};
 if(!proposal?.ok)return {ok:false,status:proposal?.status==='unresolved'?'unresolved':'review',code:packingCodes.has(proposal?.code)?proposal.code:'REQUEST_DOES_NOT_FIT'};
 return {ok:true,status:'proposed',slots:(proposal.slots||[]).map(s=>pick(s,['group','index','bay','at','turn'])),selection:(proposal.selection||[]).map(s=>({bayId:s.id,...pick(s,['sku','movingKg','travelMm'])}))};
}
function operationalWorkshop(w){
 const result={};
 if(w.rows)result.rows=mapValues(w.rows,row=>({
  units:row.units.map(unit=>({...pick(unit,['id','family','recipeId','startMm','widthMm','riceMode']),locks:pick(unit.locks,['width','position','usage','finish']),...(unit.hardwareChoices?{hardwareChoices:skuChoices(unit.hardwareChoices)}:{}),...(unit.pantrySupply?{pantrySupply:pick(unit.pantrySupply,['sku'])}:{})})),
  ...pick(row,['storageTargetMm','fillerRecipeId']),...(/^\d+$/.test(row.catalogVersion)?{catalogVersion:row.catalogVersion}:{})
 }));
 if(w.finishes){const f=w.finishes;result.finishes={...pick(f,['frontSku']),
  ...(f.units?{units:mapValues(f.units,v=>pick(v,['frontSku']))}:{}),
  ...(f.cornerFronts?{cornerFronts:skuChoices(f.cornerFronts)}:{}),
  ...(f.partDefaults?{partDefaults:pick(f.partDefaults,finishKeys)}:{}),
  ...(f.partUnits?{partUnits:mapValues(f.partUnits,v=>pick(v,finishKeys))}:{}),
  ...(f.hardwareUnits?{hardwareUnits:mapValues(f.hardwareUnits,skuChoices)}:{}),
  ...(f.partCoverage?{partCoverage:Object.fromEntries(Object.entries(f.partCoverage).filter(([key])=>finishKeys.includes(key)).map(([key,ids])=>[key,[...ids]]))}:{})
 };}
 if(w.chains)result.chains=mapValues(w.chains,chain=>({source:chain.source,rows:chain.rows.map(row=>({...pick(row,['id','kind','gapMm','from','featureId','widthMm','bottomMm','heightMm','depthMm','swing','hinge','parking','leafWidthMm','hingeInsetMm','parkDepthMm']),...(row.frameRead?{frameRead:pick(row.frameRead,['method','distanceMm','wallLengthMm'])}:{})}))}));
 if(w.options)result.options=mapValues(w.options,o=>({
  ...pick(o,['mode','bottomMm','heightMm','upperTierMm','headMm','depthMm','fillerBy']),
  cornice:pick(o.cornice,['enabled','heightMm','projectionMm','returns']),
  curtains:mapValues(o.curtains,c=>pick(c,['state','type','leftMm','rightMm','aboveMm','dropMm','projectionMm','recipe','pose'])),
  heaters:mapValues(o.heaters,h=>pick(h,['state','recipe','leftMm','rightMm','aboveMm','belowMm','frontMm'])),
  ...(o.factoryTrim?{factoryTrim:mapValues(o.factoryTrim,t=>pick(t,['recipe','start','end']))}:{}),
  ...(o.profiles?{profiles:o.profiles.map(p=>pick(p,['id','type','fromMm','toMm','bottomMm','topMm','depthMm']))}:{}),
  ...(o.linearLight?{linearLight:{...pick(o.linearLight,['state','recipe','existingDrivers']),...(o.linearLight.feeds?{feeds:o.linearLight.feeds.map(f=>pick(f,['section','driver','parent','length']))}:{})}}:{}),
  ...(o.scribes?{scribes:o.scribes.map(s=>pick(s,['unitId','recipe','against','side','kind','plinthHeightMm','insetMm','accuracyMm','stations','band']))}:{})
 }));
 return result;
}
function geometry(doc){
 const room=pick(doc.room,['width','length','height','colors','sitePoints','cladding','floor','backsplash']);
 if(doc.room.architecture){room.architecture=pick(doc.room.architecture,['wallThickness','cut']);if(doc.room.architecture.outline)room.architecture.outline={vertices:copy(doc.room.architecture.outline.vertices)};}
 const kitchen={version:doc.kitchen.version,nextId:doc.kitchen.nextId,
  runs:doc.kitchen.runs.map(r=>pick(r,['id','wall','tier','start','end','depth','bottom','height','placement','x','z','angle','length','worktopFinish','worktopThicknessMm','worktopColor','autoFill','fillDefaults','gaps'])),
  units:doc.kitchen.units.map(u=>({...pick(u,['id','runId','kind','u','width','open','interior','drawerCount','fillRole','frontStyle','handleStyle','doorHanding','frontFinish','frontColor']),...(u.modelSpec?{modelSpec:pick(u.modelSpec,['widthMm','heightMm','depthMm'])}:{}),...(u.detail?{detail:pick(u.detail,['version','wall','cab','cols','rows','cells','finish','depth','cellGrids','bayFinishes'])}:{})})),
  features:doc.kitchen.features.map(f=>pick(f,['id','kind','wall','u','width','depth','bottom','height','swing','hinge','parking','leafWidthMm','hingeInsetMm','parkDepthMm','sill','leafCount','frameThickness','accessMargin']))};
 return {room,kitchen,workshop:operationalWorkshop(doc.room.workshop||{})};
}
function contextFor(role,doc,records){
 if(role==='factory')return {geometry:geometry(doc),materials:materialSpecs(records,role),drawerWork:{drawers:scopedDrawerInputs(doc,role),packing:scopedDrawerPacking(doc,role)}};
 if(role==='rep')return {materials:materialSpecs(records,role),families:Object.fromEntries(Object.entries(records?.factoryRecipes.families||{}).map(([id,f])=>[id,pick(f,familyKeys)])),drawerPacking:scopedDrawerPacking(doc,role)};
 return {};
}
export function scopedEditable(role,archive){
 if(!supported(role))return {};
 const doc=fullDoc(archive),w=doc.room.workshop||{},records=catalogRecordsFromWorkshop(w);
 if(role==='store')return {storeCatalog:copy(records?.storeCatalog??null)};
 const fields=fieldSlice(role,doc,archive),common={workshop:workshopSlice(role,w),fieldRegister:fields.fieldRegister,defaults:defaultSlice(role,doc),fieldFiles:fields.fieldFiles};
 // Project sheets carry proofs derived from private geometry and survey data.
 // Their safe drafts are read through special.open, and special.review is their
 // scoped writer. An empty slot keeps ordinary recipe widgets valid without
 // exposing proof bytes or treating redacted sheets as canonical input.
 if(role==='factory')return {factoryRecipes:records?{...copy(records.factoryRecipes),specials:{}}:null,...common};
 const room=pick(doc.room,repRoomFields),visibleIds=readableFiles(role,doc),blockedWalls=new Set(Object.entries(doc.room.photoRefs||{}).filter(([,ref])=>typeof ref==='string'&&ref.startsWith('asset-')&&!visibleIds.has(ref.slice(6))).map(([wall])=>wall));
 const photos=Object.fromEntries(Object.entries(archive.photos||{}).filter(([wall])=>!blockedWalls.has(wall)).map(([wall,value])=>[wall,copy(value)]));
 if(room.photoRefs)room.photoRefs=Object.fromEntries(Object.entries(room.photoRefs).filter(([,ref])=>typeof ref!=='string'||!ref.startsWith('asset-')||visibleIds.has(ref.slice(6))));
 return {room,kitchen:copy(doc.kitchen),...common,photos};
}
function identity(meta,role){if(!meta||typeof meta.id!=='string'||!meta.id||!ordinal(meta.revision)||typeof meta.subject!=='string'||!meta.subject)fail('هوية النطاق غير مكتملة.');return {project:{id:meta.id,revision:meta.revision},access:{role,subject:meta.subject,scopeVersion:projectScopeVersion,...(!supported(role)?{status:'assign-role-required'}:{})}};}
function saleFor(sale,revision){
 if(sale?.status==='approved'&&sale.currency==='SAR'&&sale.revision===revision&&Number.isSafeInteger(sale.totalMinor)&&sale.totalMinor>=0&&sale.totalMinor<1e14)return {status:'approved',totalMinor:sale.totalMinor,currency:'SAR',revision:sale.revision};
 return {status:'pending'};
}
export function projectView(role,archive,meta){
 if(role==='owner')fail('يستخدم المالك مسار الأرشيف الكامل.');
 const base={type:'kitchen-project-view',version:1,...identity(meta,role)};
 if(!supported(role))return {...base,editable:{},context:{}};
 const doc=fullDoc(archive),records=catalogRecordsFromWorkshop(doc.room.workshop||{});
 return {...base,editable:scopedEditable(role,archive),context:contextFor(role,doc,records),...(role==='rep'?{approvedSale:saleFor(meta.approvedSale,meta.revision)}:{})};
}

function validateEdit(role,edit,expectedRevision){
 if(!supported(role))fail('يلزم تحديد دور مشاركة محدد قبل التعديل.');
 jsonValue(edit);keys(edit,['type','version','scopeVersion','baseRevision','editable']);
 if(edit.type!=='kitchen-project-edit'||edit.version!==1||edit.scopeVersion!==projectScopeVersion||!ordinal(edit.baseRevision)||expectedRevision!==undefined&&edit.baseRevision!==expectedRevision)fail('تغيّرت النسخة؛ أعد تحميل نطاق عملك.');
 keys(edit.editable,scopedEditableKeys(role));
}
function mergeRecord(role,w,incoming){
 const records=catalogRecordsFromWorkshop(w),key=role==='store'?'storeCatalog':'factoryRecipes';
 if(!records){if(incoming===null)return copy(w);fail('يهيئ المالك سجلات المشروع قبل مشاركتها للتحرير.');}
 if(!obj(incoming))fail('لا يمكن حذف السجل المملوك من المشروع.');
 keys(incoming,role==='store'?['version','revision','approved','name','items']:['version','revision','approved',...catalogFactoryFields],['version','revision','approved',...(role==='store'?['name','items']:['families'])]);
 if(incoming.version!==1||!ordinal(incoming.revision)||typeof incoming.approved!=='boolean')fail('بيانات إصدار السجل غير صالحة.');
 if(equal(incoming,records[key]))return copy(w);
 const candidate=normalizeWorkshopCatalogs({...w,...records,[key]:{...copy(incoming),revision:records[key].revision}});
 if(!candidate)fail('بيانات السجل لا تطابق مواصفات المشروع.');
 if(!equal({...incoming,revision:records[key].revision},candidate[key]))fail('يتضمن السجل حقولًا غير معروفة أو قيمًا غير مقننة.');
 const old=normalizeWorkshopCatalogs(w),flat={...candidate.catalog,approved:old.factoryRecipes.approved};
 const reconciled=reconcileWorkshopCatalogs({...w,catalog:flat},w);if(!reconciled)fail('تعذّر تحديث السجل واعتماداته التابعة.');
 return normalizeWorkshopCatalogs({...reconciled,[key]:{...reconciled[key],approved:incoming.approved}});
}
function mergeProjectRecord(role,w,incoming){
 if(role==='factory'&&incoming!==null){
  // Empty is an opaque, unchanged slot, never a request to delete stored sheets.
  // Reject old full/proof-bearing payloads as well as partial or forged drafts;
  // only the trusted operation path may create, edit or restamp a project sheet.
  if(!obj(incoming)||!equal(incoming.specials,{}))fail('أوراق القص الخاصة تُراجع من أداة المصنع المخصصة؛ أعد تحميل نطاق عملك.');
  const records=catalogRecordsFromWorkshop(w);
  if(records)incoming={...copy(incoming),specials:copy(records.factoryRecipes.specials||{})};
 }
 return mergeRecord(role,w,incoming);
}
function replaceOwned(before,submitted,role,key){
 if(!Array.isArray(submitted)||submitted.length>2000)fail('قائمة المدخلات غير صالحة.');
 const incoming=new Map();
 for(const row of submitted){if(!obj(row)||!ownsRow(role,row)||incoming.has(key(row)))fail('تتضمن القائمة مدخلًا لدور آخر أو معرّفًا مكررًا.');incoming.set(key(row),copy(row));}
 for(const row of before)if(!ownsRow(role,row)&&incoming.has(key(row)))fail('لا يمكن استبدال مدخل محجوب.');
 const pending=[...incoming.values()],result=[];let index=0;
 for(const row of before)if(!ownsRow(role,row))result.push(copy(row));else if(index<pending.length)result.push(pending[index++]);
 result.push(...pending.slice(index));return result;
}
function mergeEvidence(role,before,next,slice,baseline){
 keys(slice.fieldRegister,['version','records']);if(slice.fieldRegister.version!==1)fail('إصدار سجل المدخلات غير صالح.');keys(slice.defaults,scopedDefaultKeys);
 if(!Array.isArray(slice.fieldFiles))fail('قائمة المرفقات غير صالحة.');
 const visible=readableFiles(role,before),oldRows=rowsOf(before),oldById=new Map(oldRows.map(r=>[r.id,r]));
 const allOldIds=new Set(oldRows.flatMap(r=>(r.attachments||[]).map(a=>a.id)));
 const incomingRows=slice.fieldRegister.records.map(row=>{
  if(!obj(row)||!Array.isArray(row.attachments))fail('مراجع مرفقات القراءة غير صالحة.');
  const old=oldById.get(row.id);if(old&&!ownsRow(role,old))fail('لا يمكن تعديل قراءة محجوبة.');
  if(row.attachments.some(a=>!obj(a)||allOldIds.has(a.id)&&!visible.has(a.id)))fail('لا يمكن إرفاق مرجع محجوب من نطاق آخر.');
  const hidden=(old?.attachments||[]).filter(a=>!visible.has(a.id));
  return {...copy(row),attachments:[...copy(row.attachments),...copy(hidden)]};
 });
 const rows=replaceOwned(oldRows,incomingRows,role,r=>r.id);
 if(!equal(slice.fieldRegister,baseline.fieldRegister))next.room.fieldRegister={...(before.room.fieldRegister||{version:1}),records:rows};
 if(!equal(slice.defaults,baseline.defaults)){
  const original=before.room.defaults||{version:1,base:getProjectDefaultProfile(before),overrides:[]};
  next.room.defaults={...copy(original),base:{...copy(original.base),rows:replaceOwned(original.base.rows,slice.defaults.baseRows,role,defaultPropertyKey)},overrides:replaceOwned(original.overrides,slice.defaults.overrides,role,defaultPropertyKey)};
 }
 const incoming=new Map();for(const file of slice.fieldFiles){keys(file,['id','data']);if(typeof file.id!=='string'||typeof file.data!=='string'||incoming.has(file.id)||allOldIds.has(file.id)&&!visible.has(file.id))fail('محتوى المرفق خارج نطاق التعديل.');incoming.set(file.id,copy(file));}
 const nextRefs=new Set(rows.flatMap(r=>(r.attachments||[]).map(a=>a.id))),nextVisible=readableFiles(role,{room:{fieldRegister:{records:rows}}});
 for(const id of incoming.keys())if(!nextVisible.has(id))fail('المرفق لا يخص قراءة مرئية ضمن نطاقك.');
 const files=[];for(const old of next.fieldFiles||[]){if(!nextRefs.has(old.id))continue;if(!visible.has(old.id))files.push(copy(old));else if(incoming.has(old.id)){files.push(incoming.get(old.id));incoming.delete(old.id);}else fail('ينقص محتوى مرفق ما زال مرتبطًا بقراءة.');}
 files.push(...incoming.values());next.fieldFiles=files;
}
function mergeRepRows(previous,incoming){
 if(incoming!==null&&!obj(incoming))fail('صفوف المشروع غير صالحة.');
 const result=incoming===null?null:copy(incoming);
 for(const row of Object.values(result||{}))if(!obj(row)||Object.hasOwn(row,'drawerChecks'))fail('فحوص تركيب الأدراج تُحفظ من عمليات المصنع المحددة.');
 for(const [runId,row] of Object.entries(previous||{}))if(Object.keys(row.drawerChecks||{}).length){
  const target=result?.[runId];if(!target||!Array.isArray(target.units)||Object.keys(row.drawerChecks).some(id=>!target.units.some(u=>u.id===id)))fail('لا يمكن إسقاط وحدة لها قياسات أدراج محفوظة ضمن تعديل الصف.');
  target.drawerChecks=copy(row.drawerChecks);
 }
 return result;
}
function mergeRepUsage(previous,incoming){
 const old=previous?.pack;
 if(incoming===null){if(old?.bays.length||old?.accepted)fail('لا يمكن حذف قياسات الأدراج أو قبول العميل ضمن حذف الاستخدامات.');return null;}
 keys(incoming,['tasks','pack'],['tasks']);const result={tasks:copy(incoming.tasks)};
 if(incoming.pack===undefined){if(old)fail('أرسل طلبات الأغراض وأذونات الأدراج كاملة؛ لا تحذف سجل القياس ضمنيًا.');return result;}
 keys(incoming.pack,['groups','permissions']);const {groups,permissions}=incoming.pack;
 if(!Array.isArray(groups)||!Array.isArray(permissions))fail('طلبات الأغراض أو أذونات الأدراج غير صالحة.');
 const all=new Set((old?.bays||[]).map(b=>b.id)),allowed=new Map();
 for(const p of permissions){keys(p,['bayId','allowAuto']);if(typeof p.bayId!=='string'||!all.has(p.bayId)||allowed.has(p.bayId)||typeof p.allowAuto!=='boolean')fail('إذن الدرج يجب أن يشير إلى قياس محفوظ واحد.');allowed.set(p.bayId,p.allowAuto);}
 if(allowed.size!==all.size)fail('قائمة أذونات الأدراج ناقصة.');
 result.pack={...copy(old||{}),groups:copy(groups),bays:(old?.bays||[]).map(b=>({...copy(b),allowAuto:allowed.get(b.id)}))};return result;
}
function updateWorkshop(role,before,next,slice){
 keys(slice,ownedWorkshopFields(role));const old=before.room.workshop||{},w=next.room.workshop||{};
 for(const key of ownedWorkshopFields(role)){
  if(key==='corners')continue;
  const value=slice[key];
  if(key==='referenceOrder'){
   if(value===null){if(old.referenceOrder?.materialCost!=null||old.referenceOrder?.approval)fail('لا يمكن حذف أمر مرتبط ببيانات اعتماد محجوبة.');delete w[key];}
   else{keys(value,['orderNo','toleranceMm','lines']);w[key]={...copy(value),materialCost:old.referenceOrder?.materialCost??null,...(old.referenceOrder?.approval?{approval:copy(old.referenceOrder.approval)}:{})};}
  }else if(role==='rep'&&key==='rows'){const merged=mergeRepRows(old.rows,value);if(merged===null)delete w[key];else w[key]=merged;}
  else if(role==='rep'&&key==='clientUsage'){const merged=mergeRepUsage(old.clientUsage,value);if(merged===null)delete w[key];else w[key]=merged;}
  else if(value===null)delete w[key];else w[key]=copy(value);
 }
 next.room.workshop=w;
 if(role==='factory'){
  if(slice.corners!==null&&!obj(slice.corners))fail('قائمة الأركان غير صالحة.');
  const desired=slice.corners||{},oldCorners=old.corners||{};
  for(const key of [...new Set([...Object.keys(oldCorners),...Object.keys(desired)])].sort())if(!equal(oldCorners[key],desired[key])){const out=applyWorkshopCorner(next,key,desired[key]||null);if(!out.ok)fail('تعذّر تطبيق تفصيل الركن على التصميم الحالي.');next=out.doc;}
  if(slice.corners===null)delete next.room.workshop.corners;
 }
 return next;
}
export function mergeProjectEdit(role,fullArchive,edit,{expectedRevision}={}){
 try{
  validateEdit(role,edit,expectedRevision);const before=fullDoc(fullArchive),baseline=scopedEditable(role,fullArchive),slice=edit.editable;
  if(equal(slice,baseline))return {ok:true,archive:copy(fullArchive)};
  let next=copy(before);const result=copy(fullArchive);
  if(role==='store'||role==='factory')next.room.workshop=mergeProjectRecord(role,before.room.workshop||{},slice[role==='store'?'storeCatalog':'factoryRecipes']);
  if(role!=='store'){
   if(role==='rep'){
    keys(slice.room,repRoomFields,['width','length','height','colors']);
    const hiddenPhotoRefs=Object.fromEntries(Object.entries(before.room.photoRefs||{}).filter(([wall])=>!Object.hasOwn(baseline.room.photoRefs||{},wall)));
    if(Object.keys(hiddenPhotoRefs).some(wall=>Object.hasOwn(slice.room.photoRefs||{},wall)||Object.hasOwn(slice.photos||{},wall)))fail('صورة الجدار مرتبطة بمرفق خارج نطاقك.');
    for(const key of repRoomFields)delete next.room[key];Object.assign(next.room,copy(slice.room));
    if(Object.keys(hiddenPhotoRefs).length)next.room.photoRefs={...(next.room.photoRefs||{}),...hiddenPhotoRefs};
    next.kitchen=copy(slice.kitchen);if(!obj(slice.photos))fail('سجل الصور غير صالح.');result.photos={...Object.fromEntries(Object.entries(fullArchive.photos||{}).filter(([wall])=>Object.hasOwn(hiddenPhotoRefs,wall))),...copy(slice.photos)};
   }
   next=updateWorkshop(role,before,next,slice.workshop);
   // Keep file bytes outside the design while evidence merging restores hidden refs.
   const target={room:next.room,fieldFiles:result.fieldFiles||[]};mergeEvidence(role,before,target,slice,baseline);next.room=target.room;result.fieldFiles=target.fieldFiles;
   next=pruneBaseSupportChoices(next,before);
  }
  const checked=cleanIdea(next);if(!checked)fail('بيانات التعديل المحدود لا تجتاز التحقق.');
  if(!equal(next,checked))fail('يتضمن التعديل حقولًا غير معروفة أو قيمًا غير مقننة.');
  result.design=checked;
  const permission=authorizeProjectChange(role,fullArchive,result);if(!permission.ok)fail(permission.reason);
  return {ok:true,archive:result};
 }catch(error){return {ok:false,reason:error?.message||'تعذّر التحقق من التعديل المحدود.'};}
}

export function catalogView(role,raw,{id,version,subject}){
 if(role==='owner')fail('يستخدم المالك مسار الكتالوج الكامل.');
 const meta=identity({id,revision:version,subject},role),base={type:'kitchen-catalog-view',version:1,catalog:{id,version},access:{...meta.access,scopeVersion:1,...(!['store','factory'].includes(role)?{status:'assign-role-required'}:{})}};
 if(!['store','factory'].includes(role))return {...base,editable:{},context:{}};
 const decoded=decodePortableCatalog(raw),records=decoded&&catalogRecordsFromWorkshop(decoded);if(!records)fail('الكتالوج الكامل غير صالح.');
 return {...base,editable:{[role==='store'?'storeCatalog':'factoryRecipes']:copy(records[role==='store'?'storeCatalog':'factoryRecipes'])},context:role==='factory'?{materials:materialSpecs(records,'factory')}: {}};
}
export function mergeCatalogEdit(role,full,edit,{expectedVersion}={}){
 try{
  if(!['store','factory'].includes(role))fail('دور الكتالوج لا يسمح بهذا التعديل.');jsonValue(edit);keys(edit,['type','version','baseVersion','editable']);const key=role==='store'?'storeCatalog':'factoryRecipes';keys(edit.editable,[key]);
  if(edit.type!=='kitchen-catalog-edit'||edit.version!==1||!ordinal(edit.baseVersion)||expectedVersion!==undefined&&edit.baseVersion!==expectedVersion)fail('تغيّر إصدار الكتالوج.');
  const decoded=decodePortableCatalog(full);if(!decoded)fail('الكتالوج الكامل غير صالح.');
  const next=mergeRecord(role,decoded,edit.editable[key]),records=catalogRecordsFromWorkshop(next);if(!records)fail('تعذّر تحديث الكتالوج.');
  const catalog={type:'kitchen-catalog-records',version:1,...records},permission=authorizeCatalogChange(role,full,catalog);if(!permission.ok)fail(permission.reason);
  return {ok:true,catalog};
 }catch(error){return {ok:false,reason:error?.message||'تعذّر التحقق من تعديل الكتالوج.'};}
}
