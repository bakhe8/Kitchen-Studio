// Shared snapshot policy for the browser and server. Authentication and archive
// validation remain boundary responsibilities; roles come from the server ACL.
import {cleanIdea} from './kitchen-ideas.js';
import {catalogRecordsFromWorkshop,hasWorkshopCatalog,normalizeWorkshopCatalogs,reconcileWorkshopCatalogs} from './kitchen-catalog-records.js';
import {seedCatalog,factoryLayoutKey} from './kitchen-workshop-factory.js';
import {decodePortableCatalog} from './kitchen-factory-template.js';
import {applyWorkshopCorner} from './kitchen-production-row.js';
import {pruneBaseSupportChoices} from './kitchen-base-support.js';
import {validateProjectPlacement} from './kitchen-project.js';
import {getProjectDefaultProfile} from './kitchen-defaults-model.js';

export const projectRoles=Object.freeze(['owner','store','factory','rep','viewer','editor']);
export const roleLabels=Object.freeze({owner:'المالك',store:'المتجر',factory:'المصنع',rep:'المندوب',viewer:'عرض فقط',reader:'عرض فقط',editor:'محرر سابق'});
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const omit=(v,keys)=>Object.fromEntries(Object.entries(v||{}).filter(([k])=>!keys.includes(k)));
const denied=reason=>({ok:false,reason});
const pass=()=>({ok:true});
const recordKeys=['catalog','storeCatalog','factoryRecipes','pricingTerms','catalogMeta'];
const factoryFields=['referenceOrder','baseSupport','upstand','corners','surfaceTemplate','surfacePatterns','installReadiness'];
const representativeFields=['wallPairs','tapChecks','decisionReview','applianceIntake','chains','layoutBrief','rows','options','surfaces3d','measureFit','pipeRoutes','serviceZones','clientUsage','applianceFit','wallProfiles','guideFinishReview','activeWall','finishes'];
const finishDerived=['rows','decisionReview','finishes'];
const workshop=d=>d?.room?.workshop||{};

// Preserve ordinary legacy editing and structure/customer approval behavior.
// Owner-only pricing also covers legacy MFG-09 evidence, defaults and files;
// existing commercial values are retained without granting a way to change them.
function legacyEditor(previous,next){
 const a=workshop(previous?.design),b=workshop(next?.design);
 const before=hasWorkshopCatalog(a)?catalogRecordsFromWorkshop(a):null,after=hasWorkshopCatalog(b)?catalogRecordsFromWorkshop(b):null;
 if(hasWorkshopCatalog(a)&&!before||hasWorkshopCatalog(b)&&!after||!equal(before,after))return denied('تغيير سجلات المتجر والمصنع والتسعير يتطلب صلاحية صاحبها.');
 if(b.referenceOrder?.approval&&!equal(a.referenceOrder?.approval,b.referenceOrder.approval))return denied('اعتماد أمر المصنع للمالك.');
 if(b.approvals?.release&&!equal(a.approvals?.release,b.approvals.release))return denied('اعتماد الإفراج للمالك.');
 const previousDoc=cleanIdea(previous?.design),nextDoc=cleanIdea(next?.design);
 if(!previousDoc||!nextDoc)return denied('تعذّر التحقق من أسعار المشروع السابق أو الجديد.');
 const commercial=pricingEvidenceAllowed(previousDoc,nextDoc);if(!commercial.ok)return commercial;
 return fieldFilesAllowed('editor',previous,next,previousDoc,nextDoc);
}

function checkedRecords(w){return hasWorkshopCatalog(w)?catalogRecordsFromWorkshop(w):null;}
// Multi-edit uploads and undo can legitimately carry nonconsecutive revisions.
// The caller owns its record's revision; other record revisions and provenance
// remain protected. Layout metadata is shared only when its inputs changed.
function recordChange(role,beforeWorkshop,afterWorkshop){
 const had=hasWorkshopCatalog(beforeWorkshop),has=hasWorkshopCatalog(afterWorkshop);
 if(!had&&!has)return pass();
 if(!has)return denied('لا يمكن حذف سجلات المشروع بهذه الصلاحية.');
 const before=had?checkedRecords(beforeWorkshop):catalogRecordsFromWorkshop({catalog:seedCatalog()}),after=checkedRecords(afterWorkshop);
 if(!before||!after)return denied('سجلات المشروع غير صالحة.');
 if(role==='rep')return had&&equal(before,after)?pass():denied('المندوب يستخدم سجلات المتجر والمصنع والتسعير دون تعديلها.');
 const key=role==='store'?'storeCatalog':'factoryRecipes';
 const a=normalizeWorkshopCatalogs(before),b=normalizeWorkshopCatalogs(after);
 const ownedView=role==='store'?{...a.catalog,name:b.catalog.name,items:b.catalog.items,revision:b.catalog.revision}:b.catalog;
 const reconciled=reconcileWorkshopCatalogs({...beforeWorkshop,catalog:{...ownedView,approved:a.catalog.approved}},had?beforeWorkshop:a);
 if(!reconciled)return denied('تعذّر التحقق من اعتماد السجلات المتأثرة.');
 for(const k of ['storeCatalog','factoryRecipes','pricingTerms']){
  if(k===key)continue;
  const expected=role==='store'&&k==='factoryRecipes'?reconciled.factoryRecipes:before[k];
  const matches=had?equal(after[k],expected):equal(omit(after[k],['revision']),omit(expected,['revision']));
  if(!matches)return denied(k==='pricingTerms'?'شروط التسعير واعتمادها للمالك.':k==='factoryRecipes'?'المتجر لا يغيّر وصفات المصنع أو يمنح اعتمادها.':'المصنع لا يغيّر أصناف المتجر أو اعتمادها.');
 }
 if(!equal(before.catalogMeta.teamSource,after.catalogMeta.teamSource))return denied('تغيير مصدر قالب الفريق للمالك.');
 if(factoryLayoutKey(a.catalog)===factoryLayoutKey(b.catalog)&&before.catalogMeta.layoutRevision!==after.catalogMeta.layoutRevision)return denied('إصدار حدود الوصفات لا يتغير دون تغيير حدودها.');
 // A format-only migration is permitted. Unowned metadata cannot be changed by
 // editing a global counter while leaving all owned data and approvals intact.
 if(equal(before[key],after[key])&&!equal(before.catalogMeta,after.catalogMeta))return denied('بيانات إصدار الكتالوج تتبع تعديل السجل.');
 return pass();
}

// Field evidence and project defaults can also supply countertop prices. All
// MFG-09 rows are owner-only (including aliases and excluded/unknown rows).
// MFG/INS manufacturing evidence belongs to the factory; the remaining visit
// evidence belongs to the rep. Compare every row field, not just its value.
export const fieldInputRole=code=>String(code??'')==='MFG-09'?'owner':/^(MFG|INS)-/.test(code||'')?'factory':'rep';
const rowOwner=r=>fieldInputRole(r?.inputCode??r?.code);
const ownsEvidence=(role,row)=>role==='editor'?rowOwner(row)!=='owner':rowOwner(row)===role;
function pricingEvidenceAllowed(before,next){
 const commercial=rows=>(rows||[]).filter(row=>rowOwner(row)==='owner');
 if(!equal(commercial(before.room.fieldRegister?.records),commercial(next.room.fieldRegister?.records)))return denied('قراءات الأسعار وتعريفاتها للمالك، بما فيها مدخل MFG-09.');
 const prices=doc=>({base:commercial(getProjectDefaultProfile(doc).rows),overrides:commercial(doc.room.defaults?.overrides)});
 return equal(prices(before),prices(next))?pass():denied('الأسعار الافتراضية والموروثة من قالب المكتب للمالك.');
}
function protectedRows(rows,role){return (rows||[]).filter(r=>rowOwner(r)!==role);}
function evidenceAllowed(before,next,role){
 const a=before.room,b=next.room;
 const filter=(v,key)=>({...omit(v,[key]),[key]:protectedRows(v?.[key],role)});
 if(!equal(filter(a.fieldRegister||{version:1,records:[]},'records'),filter(b.fieldRegister||{version:1,records:[]},'records')))return denied('هذه القراءة أو التعرفة تخص دورًا آخر؛ أسعار السطح للمالك.');
 const defaults=v=>v?{...v,base:filter(v.base,'rows'),overrides:protectedRows(v.overrides,role)}:v;
 const implicit=d=>d.room.defaults||{version:1,base:getProjectDefaultProfile(d),overrides:[]};
 if(!equal(defaults(implicit(before)),defaults(implicit(next))))return denied('هذه الافتراضيات أو أسعار سطح العمل تخص دورًا آخر.');
 return pass();
}

// Attachment bytes inherit every referring row's authority, in both snapshots.
// Adding an owned reference cannot authorize overwriting an existing factory or
// pricing document with the same ID; removing a reference cannot erase custody.
function fieldFilesAllowed(role,previousArchive,nextArchive,before,next){
 const protectedIds=new Set(),ownedIds=new Set();
 for(const doc of [before,next])for(const row of doc.room.fieldRegister?.records||[]){
  const ids=ownsEvidence(role,row)?ownedIds:protectedIds;
  for(const attachment of row.attachments||[])ids.add(attachment.id);
 }
 const files=raw=>{const result=new Map();if(!Array.isArray(raw))return null;for(const file of raw){if(!file||typeof file.id!=='string'||result.has(file.id))return null;result.set(file.id,file);}return result;};
 const a=files(previousArchive?.fieldFiles||[]),b=files(nextArchive?.fieldFiles||[]);
 if(!a||!b)return denied('قائمة مرفقات المشروع غير صالحة.');
 for(const id of new Set([...a.keys(),...b.keys()]))if(!equal(a.get(id),b.get(id))&&(protectedIds.has(id)||!ownedIds.has(id)))return denied('محتوى المرفق يتبع صلاحية كل قراءة تشير إليه؛ لا يمكن تغيير مرفق لدور آخر.');
 return pass();
}

// Generic representative snapshots own customer requests, not measurements or
// their derived signatures. Explicit server operations have a separate trusted
// path and preserve each physical/customer subfield under its own authority.
function repDrawerCustody(before,next){
 const a=workshop(before),b=workshop(next),checks=w=>Object.fromEntries(Object.entries(w.rows||{}).filter(([,r])=>Object.keys(r.drawerChecks||{}).length).map(([id,r])=>[id,r.drawerChecks]));
 if(!equal(checks(a),checks(b)))return denied('فحوص تركيب الأدراج لا تتغير من حفظ مسودة المندوب.');
 const prior=a.clientUsage?.pack,after=b.clientUsage?.pack,measured=p=>(p?.bays||[]).map(bay=>omit(bay,['allowAuto']));
 if(!equal(measured(prior),measured(after))||!equal(prior?.accepted,after?.accepted))return denied('قياسات الأدراج وقبول التوزيع يُحفظان بالعمليات المخصصة فقط.');
 const hosts=new Map();
 for(const [runId,row] of Object.entries(a.rows||{}))for(const [id,set] of Object.entries(row.drawerChecks||{}))hosts.set(id,{runId,index:Math.max(...Object.keys(set).map(Number),0)});
 for(const bay of prior?.bays||[]){const [id,index]=bay.id.split('#'),u=before.kitchen.units.find(u=>u.id===id);if(u){const current=hosts.get(id);hosts.set(id,{runId:u.runId,index:Math.max(current?.index||0,Number(index))});}}
 for(const [id,h] of hosts){const old=before.kitchen.units.find(u=>u.id===id),u=next.kitchen.units.find(u=>u.id===id),row=b.rows?.[h.runId];if(old&&(!u||u.runId!==old.runId||u.kind!==old.kind||(u.drawerCount||3)<h.index&&(u.drawerCount||3)!==(old.drawerCount||3))||a.rows?.[h.runId]?.units.some(e=>e.id===id)&&!row?.units.some(e=>e.id===id))return denied('تحتفظ الوحدة بقياسات أدراجها؛ لا تحذفها أو تنقلها خارج صفها دون معالجة القياسات صراحة.');}
 return pass();
}

function factoryProject(before,next){
 const a=workshop(before),b=workshop(next);
 // A corner edit legitimately replans its adjacent manufactured rows. Replay
 // the existing domain operation, then compare its complete output: arbitrary
 // cabinet moves, customer choices, wall changes and approvals remain blocked.
 let derived={...before,room:{...before.room,workshop:{...a,...Object.fromEntries([...recordKeys,...factoryFields].filter(k=>k!=='corners'&&Object.hasOwn(b,k)).map(k=>[k,b[k]]))}}};
 const keys=[...new Set([...Object.keys(a.corners||{}),...Object.keys(b.corners||{})])].sort();
 for(const key of keys)if(!equal(a.corners?.[key],b.corners?.[key])){
  const result=applyWorkshopCorner(derived,key,b.corners?.[key]||null);
  if(!result.ok)return denied('تعذّر مطابقة تعديل الركن مع صفوف التصميم الحالية.');
  derived=result.doc;
 }
 derived=pruneBaseSupportChoices(derived,before);
 if(!equal(derived.kitchen,next.kitchen))return denied('تعديل الرسم للمندوب؛ يُسمح للمصنع فقط بإعادة الصف الناتجة عن تفصيل الركن.');
 for(const key of finishDerived)if(!equal(workshop(derived)[key],b[key]))return denied('لا يسمح دور المصنع بتغيير اختيارات المندوب خارج أثر تفصيل الركن.');
 if(!equal(omit(a,[...recordKeys,...factoryFields,...finishDerived]),omit(b,[...recordKeys,...factoryFields,...finishDerived])))return denied('بيانات الزيارة وقرارات العميل للمندوب، والاعتمادات النهائية للمالك.');
 return pass();
}

export function authorizeProjectChange(role,previousArchive,nextArchive){
 try{
  if(role==='owner')return pass();
  if(role==='editor')return legacyEditor(previousArchive,nextArchive);
  if(!['store','factory','rep'].includes(role))return denied('هذه الصلاحية لا تسمح بتعديل المشروع.');
  const before=cleanIdea(previousArchive?.design),next=cleanIdea(nextArchive?.design);
  if(!before||!next)return denied('تعذّر التحقق من بنية المشروع السابق أو الجديد.');
  if(before.room.projectId!==next.room.projectId)return denied('لا تسمح هذه الصلاحية بتبديل هوية المشروع.');
  const a=workshop(before),b=workshop(next);
  const records=recordChange(role,a,b);if(!records.ok)return records;
  if(!equal(a.approvals,b.approvals)||!equal(a.versions,b.versions)||!equal(a.referenceOrder?.approval,b.referenceOrder?.approval))return denied('اعتماد الهيكل والعميل والإفراج وسجل الموافقات للمالك.');
  if(role!=='rep'&&!equal(previousArchive?.photos||{},nextArchive?.photos||{}))return denied('صور الموقع ضمن عمل المندوب.');
  const files=fieldFilesAllowed(role,previousArchive,nextArchive,before,next);if(!files.ok)return files;
  if(!equal(omit(previousArchive,['design','photos','fieldFiles','type','version']),omit(nextArchive,['design','photos','fieldFiles','type','version'])))return denied('لا يمكن تغيير بيانات ملف المشروع بهذه الصلاحية.');
  if(role==='store'){
   const strip=d=>({...d,room:{...d.room,workshop:omit(workshop(d),recordKeys)}});
   return equal(strip(before),strip(next))?pass():denied('دور المتجر يحدّث الأصناف وأسعار الشراء والمخزون فقط.');
  }
  const evidence=evidenceAllowed(before,next,role);if(!evidence.ok)return evidence;
  if(role==='factory'){
   if(!equal(omit(before.room,['workshop','fieldRegister','defaults']),omit(next.room,['workshop','fieldRegister','defaults'])))return denied('بيانات الموقع والتصميم للمندوب.');
   return factoryProject(before,next);
  }
  // The rep's CAD deletion may remove only obsolete support bindings, using
  // exactly the same cleanup as the editor. It cannot invent a factory rule.
  const expected=pruneBaseSupportChoices({...next,room:{...next.room,workshop:{...b,baseSupport:a.baseSupport}}},before);
  if(!equal(workshop(expected).baseSupport,b.baseSupport))return denied('اختيارات قواعد التصنيع للمصنع.');
  if(!equal(omit(a,[...recordKeys,...representativeFields,'baseSupport']),omit(b,[...recordKeys,...representativeFields,'baseSupport'])))return denied('تفاصيل التصنيع والقوالب والتوريد للمصنع.');
  const drawers=repDrawerCustody(before,next);if(!drawers.ok)return drawers;
  const placement=validateProjectPlacement(before,next);
  return placement.ok?pass():denied(placement.reason||'راجع هندسة التصميم قبل حفظ تعديل المندوب.');
 }catch{return denied('تعذّر التحقق من حدود التعديل لهذه الصلاحية.');}
}

export function authorizeCatalogChange(role,previousPortable,nextPortable){
 try{
  if(role==='owner')return pass();
  if(!['store','factory'].includes(role))return denied('هذه الصلاحية لا تسمح بنشر كتالوج.');
  const before=decodePortableCatalog(previousPortable),next=decodePortableCatalog(nextPortable);
  if(!before||!next)return denied('تعذّر التحقق من سجلات الكتالوج.');
  return recordChange(role,before,next);
 }catch{return denied('تعذّر التحقق من حدود تعديل الكتالوج.');}
}
