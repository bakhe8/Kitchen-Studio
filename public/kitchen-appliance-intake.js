import {ownKey,inheritedName} from './kitchen-safe-keys.js';
// Customer inventory is captured before there are any cabinet IDs. A project
// request is independent from a factory family and from the later site proof.
import {deviceNames,appliancePorts,appliancePlacements} from './kitchen-device-types.js';
import {architectureWall,architectureWallIdKnown} from './kitchen-architecture.js';
import {surveyedDesignRange} from './kitchen-chain-model.js';
import {planWorkshopRow} from './kitchen-production-row.js';
import {getFactoryCatalog,checkFactorySize,familyCADKind} from './kitchen-workshop-factory.js';
import {kitchenGeometry} from './kitchen-model.js';

const kinds={fridge:['fridge'],freezer:['freezer'],oven:['oven','oven-tower'],dishwasher:['dishwasher'],washer:['laundry-bay'],dryer:['laundry-bay'],microwave:['microwave'],hob:['hob'],hood:['hood'],counter:[],other:[]};
const axes=['width','depth','height'];
const id=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,44}$/.test(v)&&!inheritedName(v)&&!['constructor','prototype','__proto__'].includes(v);
const str=(v,n)=>typeof v==='string'&&v.length<=n;
const dims=v=>v&&axes.every(k=>v[k]===null||Number.isFinite(v[k])&&v[k]>0&&v[k]<=12000);
const ready=v=>axes.every(k=>Number.isFinite(v[k]));
const equalDims=(a,b)=>a&&b&&axes.every(k=>a[k]===b[k]);
const fail=(doc,reason)=>({ok:false,doc,reason});
export const intakeNames=Object.fromEntries(Object.keys(kinds).map(k=>[k,deviceNames[k]]));
export function cleanApplianceIntake(list){
 if(!Array.isArray(list)||list.length>64)return null;
 const seen=new Set(),out=[];
 for(const r of list){
  if(!r||!id(r.id)||seen.has(r.id)||!ownKey(kinds,r.kind)||!appliancePlacements[r.kind].includes(r.placement)||r.placement==='bay'&&!kinds[r.kind].length||
    !str(r.name,100)||!r.name.trim()||!str(r.model,160)||!str(r.manual,160)||!dims(r.body)||!dims(r.space)||!str(r.wall,72)||r.wall&&!architectureWallIdKnown(r.wall)||
    !str(r.recipe,55)||r.recipe&&!/^(dishwasher|custom-[a-z0-9][a-z0-9-]{0,38})$/.test(r.recipe)||!str(r.host,80)||r.host&&!/^[\w-]+$/.test(r.host))return null;
  seen.add(r.id);out.push({id:r.id,kind:r.kind,name:r.name.trim(),model:r.model.trim(),manual:r.manual.trim(),placement:r.placement,
   body:Object.fromEntries(axes.map(a=>[a,r.body[a]])),space:Object.fromEntries(axes.map(a=>[a,r.space[a]])),wall:r.wall,recipe:r.recipe,host:r.host});
 }return out;
}
const listOf=doc=>doc.room.workshop?.applianceIntake||[];
const write=(doc,list)=>({...doc,room:{...doc.room,workshop:{...doc.room.workshop,applianceIntake:list}}});
export function saveApplianceRequest(doc,r){
 const list=listOf(doc),old=list.find(v=>v.id===r.id);
 const item={...r,host:old?.host||''};
 const cleaned=cleanApplianceIntake(old?list.map(v=>v.id===r.id?item:v):[...list,item]);
 if(!cleaned)return fail(doc,'راجع بيانات الجهاز وأبعاده أو اترك المقاس غير المحسوم فارغًا.');
 const next=write(doc,cleaned);if(next.room.workshop.decisionReview?.noCustomerDevices)next.room.workshop.decisionReview={...next.room.workshop.decisionReview,noCustomerDevices:false};
 return {ok:true,doc:next};
}
export function removeApplianceRequest(doc,requestId){
 const r=listOf(doc).find(v=>v.id===requestId);if(!r)return fail(doc,'تغيرت قائمة الأجهزة.');
 if(r.host||doc.kitchen.units.some(u=>u.modelSpec?.requestId===requestId))return fail(doc,'افصل الجهاز عن موضعه أولًا.');
 return {ok:true,doc:write(doc,listOf(doc).filter(v=>v!==r))};
}
function dataIssue(r){
 const missing=[!r.model&&'رقم الموديل',!r.manual&&'مرجع دليل التركيب',!ready(r.body)&&'أبعاد جسم الجهاز',!ready(r.space)&&'أبعاد الحيز المطلوب'].filter(Boolean);
 if(missing.length)return 'أكمل '+missing.join('، ')+'.';
 if(axes.some(k=>r.space[k]<r.body[k]))return 'الحيز الكلي المحجوز أصغر من الجسم. سجّل الغلاف الكامل بما فيه البروز. تُرفع فتحة القص على حدة.';
 return '';
}
const tierOf=(f,k)=>(f.base||k)==='upperStorage'?'upper':'base';
// Explicit context (including an empty context) supplies public family metadata.
// It is not a partial factory catalog and must never trigger seeded recipes.
export function applianceFamilyOptions(doc,r,{families}={}){
 const source=families===undefined?getFactoryCatalog(doc).families:families;
 const available=source&&typeof source==='object'&&!Array.isArray(source)?source:{};
 return Object.entries(available).filter(([k,f])=>f&&typeof f==='object'&&!Array.isArray(f)&&kinds[r.kind]?.includes(familyCADKind(f,f.base||k))&&(k==='dishwasher'||k.startsWith('custom-'))&&
  (!ready(r.space)||checkFactorySize(f,r.space.width,r.space.height,r.space.depth))).map(([id,f])=>({id,label:f.label,tier:tierOf(f,id)}));
}
const scopedPlanningIssue='يُحسب حجز الحيز أو تغيير مقاسه على الخادم. افتح بدائل التصميم لاستخدام وصفات المصنع المعتمدة.';
const spec=r=>({model:r.model,manual:r.manual,widthMm:r.space.width,depthMm:r.space.depth,heightMm:r.space.height,requestId:r.id});
const match=(r,u)=>u?.modelSpec?.requestId===r.id&&u.modelSpec.model===r.model&&u.modelSpec.manual===r.manual&&axes.every(k=>u.modelSpec[k+'Mm']===r.space[k]);
export function applianceIntakeStatus(doc,r){
 const issue=dataIssue(r),host=doc.kitchen.units.find(u=>u.id===r.host),run=host&&doc.kitchen.runs.find(v=>v.id===host.runId);
 if(issue)return {ok:false,reason:issue};
 if(!host||!run)return {ok:false,reason:r.host?'الوحدة المرتبطة أزيلت من الرسم. حدّد مكانها من جديد.':'الجهاز مسجّل ولم يُحجز مكانه بعد.'};
 if(r.wall&&run.wall!==r.wall)return {ok:false,reason:'الموضع الحالي على جدار مختلف عن اختيار العميل.'};
 if(r.placement==='bay'){
  const row=doc.room.workshop?.rows?.[run.id]?.units.find(u=>u.id===r.host);
  if(!row||!match(r,host)||!kinds[r.kind].includes(host.kind)||r.recipe&&r.recipe!==(row.recipeId||row.family))return {ok:false,reason:'حيز الجهاز المرسوم أو وصفته يتطلبان تحديثًا لمطابقة اختيار العميل.'};
 }
 const entry=doc.room.workshop?.applianceFit?.devices.find(d=>d.id==='in-'+r.id);
 if(!entry||entry.host!==r.host||entry.model!==r.model||entry.manual!==r.manual||entry.kind!==r.kind||entry.placement!==r.placement||!equalDims(entry.required,r.space))return {ok:false,reason:'لم تتطابق بطاقة التجهيزات مع قائمة العميل الحالية.'};
 return {ok:true,reason:'مرتبط بالرسم وبطاقة فحص الموقع'};
}
export function intakeIssues(doc,scope){
 return listOf(doc).filter(r=>!scope||r.host&&scope.unitIds.includes(r.host)).flatMap(r=>{const s=applianceIntakeStatus(doc,r);return s.ok?[]:[r.name+' · '+s.reason];});
}
function attach(doc,r,host){
 const w=doc.room.workshop,fit=w.applianceFit||{devices:[],circuits:[]},did='in-'+r.id,previous=fit.devices.find(d=>d.id===did);
 if(!previous&&fit.devices.length>=128)return fail(doc,'بلغ سجل فحص الأجهزة سعته.');
 const retain=previous&&previous.host===host&&previous.kind===r.kind&&previous.model===r.model&&previous.manual===r.manual&&previous.placement===r.placement&&equalDims(previous.required,r.space);
 const d=retain?{...previous,name:r.name}:{id:did,host,kind:r.kind,placement:r.placement,name:r.name,model:r.model,manual:r.manual,siteRef:'',required:{...r.space},
  measured:{width:null,depth:null,height:null},offset:[null,null,null],frontMm:null,watts:null,bearing:'unknown',circuit:'',
  power:appliancePorts[r.kind].includes('electric')?'electric':'unknown',connections:{}};
 const next=write(doc,listOf(doc).map(q=>q.id===r.id?{...q,host}:q));
 next.room.workshop.applianceFit={devices:previous?fit.devices.map(v=>v.id===did?d:v):[...fit.devices,d],circuits:fit.circuits};return {ok:true,doc:next};
}
// An explicitly released binding leaves any existing cabinet and its field
// version intact. The current auto-created fit card is removed with the link.
export function unlinkAppliance(doc,requestId){
 const r=listOf(doc).find(v=>v.id===requestId);if(!r)return fail(doc,'الجهاز غير موجود.');
 const next=write(doc,listOf(doc).map(v=>v.id===r.id?{...v,host:''}:v));
 const fit=next.room.workshop.applianceFit;
 if(fit)next.room.workshop.applianceFit={...fit,devices:fit.devices.filter(d=>d.id!=='in-'+r.id)};
 next.kitchen={...doc.kitchen,units:doc.kitchen.units.map(u=>{if(u.modelSpec?.requestId!==r.id)return u;const {requestId,...modelSpec}=u.modelSpec;return {...u,modelSpec};})};
 return {ok:true,doc:next};
}
export function linkApplianceToHost(doc,requestId,host,{families,scoped=false}={}){
 const r=listOf(doc).find(v=>v.id===requestId),u=doc.kitchen.units.find(x=>x.id===host),run=u&&doc.kitchen.runs.find(x=>x.id===u.runId);
 if(!r||!run)return fail(doc,'اختر جهازًا ووحدة موجودين في المشروع.');
 if(dataIssue(r))return fail(doc,dataIssue(r));
 if(r.wall&&r.wall!==run.wall)return fail(doc,'الجدار لا يطابق اختيار العميل.');
 if(r.host&&r.host!==host)return fail(doc,'افصل الربط السابق قبل تغيير الوحدة.');
 if(r.placement==='bay'){
  if(!kinds[r.kind].includes(u.kind)||u.modelSpec?.requestId&&u.modelSpec.requestId!==r.id||listOf(doc).some(v=>v.id!==r.id&&v.placement==='bay'&&v.host===host)||
    doc.room.workshop.applianceFit?.devices.some(v=>v.id!=='in-'+r.id&&v.placement==='bay'&&v.host===host))return fail(doc,'هذا الحيّز مشغول أو لا يطابق نوع الجهاز.');
  const row=doc.room.workshop.rows?.[run.id]?.units.find(x=>x.id===host),eligible=applianceFamilyOptions(doc,r,{families});
  if(!row||!eligible.some(f=>f.id===(row.recipeId||row.family)&&(!r.recipe||r.recipe===f.id)))return fail(doc,'يلزم حيّز من عائلة متوافقة مع الموديل في كتالوج المصنع.');
  if(scoped||families!==undefined){
   // Linking an already modelled bay changes its request metadata only. Any
   // dimensional change still needs server planning with the real recipes.
   if(!u.modelSpec||Math.abs(u.width*10-r.space.width)>.01||axes.some(k=>u.modelSpec[k+'Mm']!==r.space[k]))return {...fail(doc,scopedPlanningIssue),nextStep:'design'};
   return attach({...doc,kitchen:{...doc.kitchen,units:doc.kitchen.units.map(x=>x.id===host?{...x,modelSpec:spec(r)}:x)}},r,host);
  }
  const placed=planWorkshopRow(doc,{runId:run.id,edits:{[host]:{modelSpec:spec(r),widthMm:r.space.width}}});
  return placed.ok?attach(placed.doc,r,host):fail(doc,placed.reason);
 }
 const g=kitchenGeometry(doc.kitchen,doc.room),body=g.units.find(v=>v.id===host),top=g.worktops.find(v=>v.runId===run.id&&v.start<=u.u&&v.end>=u.u+u.width);
 if(r.placement==='counter'&&!top||r.placement==='inside'&&['fridge','dishwasher','microwave','oven','oven-tower','hob','hood','freezer','laundry-bay','drawers'].includes(u.kind))return fail(doc,'الوحدة لا توفر نوع الموضع المطلوب.');
 if(body.width*10<r.space.width||body.depth*10<r.space.depth||(r.placement==='inside'?body.height*10:(doc.room.height-top.bottom-top.height)*10)<r.space.height)return fail(doc,'أبعاد الموضع المرسوم لا تتسع للحيز المطلوب.');
 return attach(doc,r,host);
}
export function intakeWallChoices(doc,selected,walls,{families}={}){
 const choices=[];
 for(const r of selected){
  if(r.host||doc.kitchen.units.some(x=>x.modelSpec?.requestId===r.id)||r.placement!=='bay')return fail(doc,r.name+' · اختر للجهاز المرتبط أو فوق السطح وحدة من الرسم.');
  if(dataIssue(r))return fail(doc,r.name+' · '+dataIssue(r));
  if(doc.kitchen.units.some(u=>!u.modelSpec?.requestId&&u.modelSpec?.model===r.model&&u.modelSpec?.manual===r.manual&&kinds[r.kind].includes(u.kind)))return fail(doc,r.name+' · يوجد حيز غير مربوط مطابق للموديل. اربطه أولًا لتجنب تكرار الجهاز.');
  const fs=applianceFamilyOptions(doc,r,{families}).filter(f=>!r.recipe||f.id===r.recipe);
  if(fs.length!==1)return fail(doc,r.name+' · '+(fs.length?'توجد عدة وصفات متوافقة، عيّن وصفة المصنع في الطلب.':'لا توجد وصفة مصنع متوافقة مع حيز الموديل. راجع المقاسات أو الكتالوج.'));
  const chosen=walls.filter(w=>(!r.wall||r.wall===w)&&architectureWall(doc.room,w)&&surveyedDesignRange(doc,w));
  if(!chosen.length)return fail(doc,r.name+' · احفظ رفع الجدار مع نهاية امتداد الدواليب قبل حجز وحدة الجهاز.');
  choices.push(chosen.map(w=>({request:r,wall:w,family:fs[0]})));
 }
 return {ok:true,choices};
}
export const intakeAddition=x=>({recipeId:x.family.id,modelSpec:spec(x.request),use:x.request.name});
export function linkPlannedIntake(doc,entries){
 let work=doc;const placed=[];
 for(const x of entries){
  const found=work.kitchen.units.filter(u=>u.modelSpec?.requestId===x.request.id);
  if(found.length!==1)return fail(doc,'لم يمكن إثبات ارتباط الجهاز بحيّز مستقل.');
  const link=attach(work,x.request,found[0].id);if(!link.ok)return fail(doc,link.reason);
  work=link.doc;placed.push({id:x.request.id,host:found[0].id,wall:x.wall});
 }
 return {ok:true,doc:work,placed};
}
// Each trial places all requests for one wall together. A partial first
// placement can leave an unfillable remainder even if the complete group fits.
export async function planIntakeReservations(doc,{ids,walls,limit=48,cancel=()=>false,pause=()=>Promise.resolve(),families,scoped=false}){
 if(scoped||families!==undefined)return {...fail(doc,scopedPlanningIssue),nextStep:'design'};
 const selected=listOf(doc).filter(v=>ids?.includes(v.id));
 if(!Array.isArray(ids)||!ids.length||ids.length>12||selected.length!==ids.length||!Array.isArray(walls)||!walls.length||walls.length>8||new Set(walls).size!==walls.length)return fail(doc,'اختر من جهاز إلى ١٢ جهازًا وجدرانًا مرفوعة.');
 if(!Number.isSafeInteger(limit)||limit<1||limit>128)return fail(doc,'حد البحث غير صالح.');
 const prepared=intakeWallChoices(doc,selected,walls);if(!prepared.ok)return prepared;
 const {choices}=prepared;
 let tries=0,last='',answer=null,limited=false;
 async function search(i,path){
  if(answer||limited||cancel())return;
  if(i<choices.length){for(const x of choices[i]){await search(i+1,[...path,x]);if(answer||limited||cancel())return;}return;}
  if(tries>=limit){limited=true;return;}tries++;await pause();if(cancel())return;
  let work=doc;const groups=new Map(),placed=[];
  for(const x of path){const k=x.wall+'|'+x.family.tier;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
  for(const rows of groups.values()){
   const {wall,family}=rows[0],range=surveyedDesignRange(work,wall),tier=family.tier;
   if(!range){last='تغيّرت حدود الرفع أثناء البحث.';return;}
   const runs=work.kitchen.runs.filter(r=>r.wall===wall&&r.tier===tier&&r.end*10>range.startMm&&r.start*10<range.endMm);
   if(runs.length>1||runs[0]&&(Math.abs(runs[0].start*10-range.startMm)>.01||Math.abs(runs[0].end*10-range.endMm)>.01)){last='الصف القائم مقسوم. اربط الجهاز بوحدة محددة أو حرّر نطاقه أولًا.';return;}
   const additions=rows.map(intakeAddition);
   const out=planWorkshopRow(work,{...(runs[0]?{runId:runs[0].id}:{}),wall,tier,startMm:range.startMm,endMm:range.endMm,additions,searchBudget:16000});
   if(!out.ok){last=out.reason;return;}work=out.doc;
   const linked=linkPlannedIntake(work,rows);if(!linked.ok){last=linked.reason;return;}
   work=linked.doc;placed.push(...linked.placed);
  }
  answer={ok:true,doc:work,placed,tries};
 }
 await search(0,[]);
 if(cancel())return fail(doc,'تغيّر المشروع. أعد حساب المقترح.');
 return answer||{...fail(doc,(limited?'انتهى حد البحث دون حسم. ':'تعذّر تكوين حيز مناسب. ')+last),tries,limited};
}
