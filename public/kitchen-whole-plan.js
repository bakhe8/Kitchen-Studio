import {currentRiceWarnings} from './kitchen-production-row-rice.js';
import {currentDishwasherWarnings} from './kitchen-production-row-equipment.js';
import {evaluateMeasureFit} from './kitchen-measure-fit.js';
import {surveyedSurfaceIssues} from './kitchen-surveyed-surfaces.js';
import {evaluatePipeRoutes} from './kitchen-pipe-routes.js';
// One bounded, reversible design search. A trial is never committed in stages:
// each appliance assignment is evaluated together with the wet functions,
// both cabinet tiers, existing commitments and the complete project price.
import {architectureWall,architectureWallLabel} from './kitchen-architecture.js';
import {surveyedDesignRange,surveyedDesignWalls,siteReleaseIssues} from './kitchen-chain-model.js';
import {readWallOptions,buildUpperRows} from './kitchen-chain-options.js';
import {candidateAssignments,proposeAssignment} from './kitchen-production-alternatives.js';
import {planWorkshopRow} from './kitchen-production-row.js';
import {applianceFamilyOptions,applianceIntakeStatus,intakeWallChoices,intakeAddition,linkPlannedIntake,linkApplianceToHost} from './kitchen-appliance-intake.js';
import {pantryContext,pantryDecisionItems} from './kitchen-pantry-brief.js';
import {projectDecisions} from './kitchen-project-decisions.js';
import {cleanLayoutBrief,budgetHold,compareBudget,dividerMismatch,rankByBrief} from './kitchen-layout-brief.js';
import {buildFactoryQuote,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {clientUsageIssues} from './kitchen-client-usage.js';
import {cornerMotionIssues} from './kitchen-production-row-corners.js';
import {evaluateApplianceFit} from './kitchen-appliance-fit.js';
import {evaluateTapChecks,tapWindowIssues} from './kitchen-tap-window.js';
import {kitchenGeometry} from './kitchen-model.js';

const question=(step,text,focus={})=>({step,text,focus});
const uniqueQuestions=list=>[...new Map(list.map(q=>[JSON.stringify([q.step,q.text,q.focus]),q])).values()];
const fail=(reason,step='row',focus={})=>({ok:false,reason,questions:[question(step,reason,focus)]});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const familyOf=(r,id)=>r?.units.find(e=>e.id===id);
function* assignments(slots,i=0,path=[]){
 if(i===slots.length){yield path;return;}
 for(const choice of slots[i])yield* assignments(slots,i+1,[...path,choice]);
}

function prepare(doc,walls,options){
 const w=doc.room.workshop||{},active=w.decisionReview?.active;
 if(!Array.isArray(walls)||!walls.length||walls.length>4||new Set(walls).size!==walls.length)return fail('حدّد من جدار مرفوع إلى أربعة جدران مختلفة ضمن نطاق التوزيع.','decisions');
 if(active&&!same([...walls].sort(),[...w.decisionReview.walls].sort()))return fail('الجدران المختارة تختلف عن الجدران التي حددها العميل في محضر الزيارة. راجع النطاق قبل التصميم.','decisions');
 for(const wall of walls)if(!architectureWall(doc.room,wall)||!surveyedDesignRange(doc,wall))return fail('راجع قياسات '+architectureWallLabel(wall)+' واحفظ نهاية الدواليب أو قياس ركن نهاية الجدار قبل تصميم الصف.','survey',{wall});
 const qs=projectDecisions(doc).items.filter(q=>q.open&&q.id.startsWith('corner:')&&q.focus.joint.split('+').every(k=>walls.includes(k)));
 if(qs.length)return {ok:false,reason:'يلزم حسم الركن الذي تصل إليه الدواليب من الجهتين قبل توزيع الصفوف.',questions:qs.map(q=>question('corner',q.name+' · '+q.value,q.focus))};
 const pantry=pantryContext(doc,null,options.pantryId);
 if(pantry.requests.length>1&&pantry.requests.some(r=>r.choice!=='none'&&!Object.values(w.rows||{}).some(row=>row.units.some(u=>u.pantryId===r.id))))return fail('توجد عدة طلبات تخزين للأرز. اربط كل طلب بوحدته في تخصيص الصف لتبقى كمياته منفصلة.','row');
 const request=pantry.req;
 if(request&&(!request.confirmed||request.choice!=='none'&&request.mode==='unknown'))return fail('احسم طريقة تخزين الأرز ومن يورّد الحافظة في المقابلة.','decisions');
 if(request?.confirmed&&options.wanted?.rice!==undefined&&options.wanted.rice!==(request.choice!=='none'))return fail('خيار درج الأرز يختلف عن قرار العميل المسجل. راجع الطلب قبل تصميمه.','decisions');
 const wanted={sink:options.wanted?.sink??true,rice:request?request.choice!=='none':!!options.wanted?.rice,dishwasher:!!options.wanted?.dishwasher};
 if(pantryDecisionItems(doc).some(x=>x.open&&x.focus.runId))return fail('راجع استخدام وحدة الأرز القائمة مع طلب المقابلة قبل إعادة التوزيع.','row');
 let base=doc;
 const devices=w.applianceIntake||[],newBays=[],nonBay=[];
 if(devices.length>64)return fail('تجاوزت قائمة الأجهزة سعة المشروع.','intake');
 for(const r of devices){
  if(r.host){const result=applianceIntakeStatus(doc,r);if(!result.ok)return fail(r.name+' · '+result.reason,'intake');continue;}
  if(r.wall&&!walls.includes(r.wall))return fail(r.name+' محدد على جدار خارج نطاق المقترح. راجع الجدار مع العميل.','intake');
  if(r.placement!=='bay'){nonBay.push(r);continue;}
  // Reuse an existing unclaimed appliance bay only if its identity and the
  // customer's requested wall/recipe are unambiguous. Never add a duplicate.
  const matches=base.kitchen.units.filter(u=>{
   if(u.modelSpec?.requestId||base.room.workshop?.applianceIntake?.some(v=>v.host===u.id)||base.room.workshop?.applianceFit?.devices.some(v=>v.host===u.id&&v.placement==='bay'))return false;
   const run=base.kitchen.runs.find(t=>t.id===u.runId),entry=familyOf(w.rows?.[u.runId],u.id);
   if(!entry||!walls.includes(run?.wall)||r.wall&&run.wall!==r.wall||u.modelSpec&&(u.modelSpec.model!==r.model||u.modelSpec.manual!==r.manual))return false;
   const key=entry.recipeId||entry.family;
   return (!r.recipe||key===r.recipe)&&applianceFamilyOptions(base,r).some(f=>f.id===key);
  });
  if(matches.length>1)return fail(r.name+' · يوجد أكثر من حيز قائم مناسب. اختر الحيز المقصود لتجنّب تكراره.','intake');
  if(matches.length){
   if(r.space.width!==matches[0].width*10)return fail(r.name+' · عرض الحيز القائم يختلف عن المطلوب. راجع تعديل الحجز المختار.','intake');
   const result=linkApplianceToHost(base,r.id,matches[0].id);if(!result.ok)return fail(result.reason,'intake');base=result.doc;
  }else newBays.push(r);
 }
 if(newBays.length>12)return fail('يستوعب البحث في المرة الواحدة اثني عشر حيز جهاز جديدًا. اربط بقية الأجهزة قبل المقارنة.','intake');
 const prepared=intakeWallChoices(base,newBays,walls);if(!prepared.ok)return fail(prepared.reason,'intake');
 // A customer-supplied dishwasher already owns a bay in this search.
 if(devices.some(r=>r.kind==='dishwasher'))wanted.dishwasher=false;
 const brief=w.layoutBrief?cleanLayoutBrief(w.layoutBrief):null;
 if(w.layoutBrief&&!brief)return fail('راجع نطاق الميزانية وأولويات العميل.','row');
 return {ok:true,base,wanted,brief,paths:prepared.choices,nonBay,riceMode:request?.mode||options.riceMode||'unknown',pantryId:request?.id};
}

function preserveExisting(original,candidate){
 const saved=original.room.workshop||{},before=original.kitchen,after=candidate.kitchen;
 for(const u of before.units){
  const old=familyOf(saved.rows?.[u.runId],u.id),v=after.units.find(x=>x.id===u.id),locks=old?.locks||{};
  const linked=u.modelSpec||saved.applianceFit?.devices?.some(d=>d.host===u.id)||saved.applianceIntake?.some(d=>d.host===u.id);
  const fixed=!old&&u.fillRole!=='auto',personal=u.detail||saved.finishes?.units?.[u.id]||saved.finishes?.partUnits?.[u.id]||saved.finishes?.hardwareUnits?.[u.id]||saved.clientUsage?.tasks?.some(t=>t.unitId===u.id);
  if(!linked&&!fixed&&!personal&&!old?.use&&!Object.values(locks).some(Boolean))continue;
  const rec=v&&familyOf(candidate.room.workshop?.rows?.[v.runId],v.id);
  if(!v||v.runId!==u.runId||v.kind!==u.kind||(fixed||linked||locks.width)&&v.width!==u.width||
    (fixed||linked||locks.position)&&v.u!==u.u||locks.usage&&(old?.use!==rec?.use||!same(old?.drawerUses,rec?.drawerUses))||
    !same(v.interior,u.interior)||!same(v.detail,u.detail))return 'يتطلب هذا البديل تغيير التخصيص أو الموضع المحفوظ للوحدة '+u.id+'.';
 }
 return '';
}

function placeOnHosts(doc,requests,walls){
 let work=doc;const placed=[];
 for(const r of requests){
  const g=kitchenGeometry(work.kitchen,work.room),occupied=new Set((work.room.workshop?.applianceFit?.devices||[]).map(d=>d.host));
  const hosts=g.units.filter(u=>walls.includes(u.wall)&&(!r.wall||u.wall===r.wall)&&!occupied.has(u.id)&&
   !['dishwasher','fridge','microwave','oven','oven-tower','hob','hood','freezer','laundry-bay','sink'].includes(u.kind)&&
   (r.placement==='counter'?g.worktops.some(t=>t.runId===u.runId&&t.start<=u.u&&t.end>=u.u+u.width&&!t.holes.some(h=>h.unitId===u.id)):
    ['storage','open-shelf','tall'].includes(u.kind)&&!u.interior?.shelves&&!u.interior?.dividers&&!u.detail)&&!work.room.workshop.clientUsage?.tasks?.some(t=>t.unitId===u.id));
  const reasons=[];
  for(const u of hosts.sort((a,b)=>a.width-b.width||a.u-b.u)){
   const link=linkApplianceToHost(work,r.id,u.id);
   if(link.ok){work=link.doc;placed.push({id:r.id,host:u.id,wall:u.wall});break;}
   reasons.push(link.reason);
  }
  if(!placed.some(p=>p.id===r.id))return fail(r.name+' · '+(reasons[0]||'لم يوجد موضع فارغ مؤهل على السطح أو داخل الوحدة. اختر حيزًا محددًا أو عدّل التقسيم.'),'intake');
 }
 return {ok:true,doc:work,placed};
}

function compose(base,config,walls,path,functions,target,options){
 const additions=new Map();
 for(const x of path.filter(v=>v.family.tier==='base')){
  if(!additions.has(x.wall))additions.set(x.wall,[]);
  additions.get(x.wall).push(intakeAddition(x));
 }
 const lower=proposeAssignment(base,{walls,wanted:config.wanted,pantryId:config.pantryId,riceMode:config.riceMode,widths:options.widths,allowProvisional:options.allowProvisional===true,allowClearanceGaps:true,storageTargetMm:target,additionsByWall:additions},functions);
 if(!lower.ok)return fail(lower.reason,lower.reason.includes('الماء')?'survey':'row');
 let work=lower.doc;
 for(const wall of walls){
  const prefix='wup-'+wall+'-',mode=readWallOptions(work,wall).mode;
  if(mode==='none'&&work.kitchen.runs.some(r=>r.tier==='upper'&&r.wall===wall&&!r.id.startsWith(prefix)))return fail('اختار العميل '+architectureWallLabel(wall)+' بلا علوي وتوجد عليه وحدة يدوية. احسم التعارض أولًا.','wallOptions',{wall});
  const upper=buildUpperRows(work,wall,{withCabinets:true});
  if(!upper.ok)return fail(architectureWallLabel(wall)+' · '+upper.reason,'wallOptions',{wall});
  work=upper.doc;
 }
 const upper=path.filter(v=>v.family.tier==='upper'),slots=upper.map(x=>work.kitchen.runs.filter(r=>r.wall===x.wall&&r.tier==='upper'&&r.end-r.start>=x.request.space.width/10).map(r=>({x,runId:r.id})));
 if(slots.some(x=>!x.length))return fail('لا يوجد صف علوي مؤهل يتسع للجهاز ضمن الجدار المختار.','intake');
 return {ok:true,doc:work,lower,upperSlots:slots};
}

function finishTrial(start,prepared,result,entries,path,walls){
 let work=result.doc;const groups=new Map();
 for(const {x,runId} of entries){if(!groups.has(runId))groups.set(runId,[]);groups.get(runId).push(intakeAddition(x));}
 for(const [runId,additions] of groups){const r=planWorkshopRow(work,{runId,additions,searchBudget:18000});if(!r.ok)return fail(r.reason,'intake');work=r.doc;}
 const links=linkPlannedIntake(work,path);if(!links.ok)return fail(links.reason,'intake');
 const rest=placeOnHosts(links.doc,prepared.nonBay,walls);if(!rest.ok)return rest;work=rest.doc;
 const lost=preserveExisting(start,work);if(lost)return fail(lost);
 const geom=kitchenGeometry(work.kitchen,work.room),hard=geom.conflicts.find(c=>c.hard);
 if(hard)return fail(hard.label||'توجد أحجام متداخلة في الرسم.');
 const unsafeTap=evaluateTapChecks(work).results.find(r=>r.parts.some(p=>!p.ok));
 if(unsafeTap)return fail(unsafeTap.sinkId+' · تتعارض حركة الخلاط مع فتح الشباك ضمن النموذج المقاس.','tap');
 const deficient=evaluateApplianceFit(work).deviceResults.find(r=>Object.values(r.margins).some(m=>m!==null&&m<0));
 if(deficient)return fail(deficient.id+' · حيز الجهاز المقاس أصغر من الحيز المطلوب.','appliances');
 const gauge=evaluateMeasureFit(work).results.find(v=>v.status==='short');
 if(gauge)return fail('لا يفي موضع '+gauge.id+' بالخلوص المقاس للوحدة المقترحة.','measure');
 const concerns=[...clientUsageIssues(work),...cornerMotionIssues(work)];
 if(concerns.length)return fail(concerns[0],'uses');
 for(const r of work.room.workshop.applianceIntake||[]){const s=applianceIntakeStatus(work,r);if(!s.ok)return fail(r.name+' · '+s.reason,'intake');}
 const quote=buildFactoryQuote(work),budget=compareBudget(quote,prepared.brief);
 if(prepared.brief?.mode==='fixed'&&budget.status!=='within')return fail(budget.status==='unknown'?'تسعير المشروع الكامل غير مكتمل لإثبات سقف العميل.':'الإجمالي أعلى من سقف العميل بمقدار '+Math.abs(budget.margin).toFixed(2)+' ر.س.','quote');
 const summary=[];
 for(const wall of walls)for(const run of work.kitchen.runs.filter(r=>r.wall===wall).sort((a,b)=>a.bottom-b.bottom||a.start-b.start)){
  const rows=work.room.workshop.rows?.[run.id],units=geom.units.filter(u=>u.runId===run.id).sort((a,b)=>a.u-b.u).map(u=>{
   const e=familyOf(rows,u.id);return {id:u.id,kind:u.kind,family:e?.family||(run.tier==='upper'?'upperStorage':u.kind),recipeId:e?.recipeId||'',use:e?.use||'',model:u.modelSpec?.model||'',startMm:Math.round(u.u*10),widthMm:Math.round(u.width*10)};
  });
  summary.push({wall,tier:run.tier,runId:run.id,startMm:run.start*10,endMm:run.end*10,units});
 }
 const key=JSON.stringify(summary.map(r=>[r.wall,r.tier,r.startMm,r.endMm,r.units.map(u=>[u.kind,u.startMm,u.widthMm,u.recipeId,u.use,u.model,work.kitchen.units.find(v=>v.id===u.id)?.modelSpec?.requestId])]));
 const placed=(work.room.workshop.applianceIntake||[]).map(r=>({id:r.id,host:r.host,wall:geom.units.find(u=>u.id===r.host)?.wall||''}));
 const reasons=result.lower.clearances.map(v=>architectureWallLabel(v.wall)+' · ترك البديل فراغًا من '+v.startMm+' إلى '+v.endMm+' مم، لأن التخزين المقترح هنا لم يجتز تجربة الفتح. '+v.reason);
 for(const wall of walls){const runs=summary.filter(r=>r.wall===wall&&r.tier==='upper');
  reasons.push(architectureWallLabel(wall)+' · '+(runs.length?'امتدادات العلوي بعد حدود الفتحات والأجهزة '+runs.map(r=>r.endMm-r.startMm).join(' + ')+' مم':'دون صف علوي حسب الاختيار المحفوظ')+'.');
 }
 for(const u of geom.units.filter(x=>x.kind==='sink'&&walls.includes(x.wall))){
  const within=f=>f.wall===u.wall&&(f.u+f.width/2)>u.u&&(f.u+f.width/2)<u.u+u.width;
  const water=geom.features.find(f=>f.kind==='water'&&within(f)),drain=geom.features.find(f=>f.kind==='drain'&&within(f));
  reasons.push('المجلى على '+architectureWallLabel(u.wall)+' عند '+Math.round(u.u*10)+' مم · '+(water&&drain?'تقع نقطتا الماء والصرف داخل حدود وحدته.':'موقع مبدئي يحتاج تحقق التمديدات.'));
 }
 if(work.kitchen.runs.some(r=>r.placement==='free'))reasons.push('احتُفظ بمكان الجزيرة واتجاهها من الرسم، وفُحصت الوحدات المقترحة حولها.');
 if(placed.length)reasons.push('ارتبطت '+placed.length+' أجهزة بأرقام وحداتها وفق الموديلات المسجلة. مقياس الحجز يشمل خلوص الجهاز.');
 const cuts=quote.pieces.filter(p=>p.kind!=='piece').reduce((n,p)=>n+p.count,0);
 return {ok:true,doc:work,key,summary,reasons,clearances:result.lower.clearances,questions:[],quote,total:quote.total,budget,placements:placed,cuts,
   storageWidthMm:result.lower.storageWidthMm,serviceDistanceMm:result.lower.serviceDistanceMm,travelComparable:result.lower.travelComparable,changed:result.lower.changed,
   alignmentMm:dividerMismatch(work,walls),provisional:result.lower.provisional};
}
export function reviewWholeProposal(doc,walls,quote=buildFactoryQuote(doc)){
 const qs=projectDecisions(doc).missing.filter(q=>!q.focus.wall||walls.includes(q.focus.wall)).map(q=>question(q.step,q.name+' · '+q.value,q.focus));
 const runs=doc.kitchen.runs.filter(r=>walls.includes(r.wall)),runIds=runs.map(r=>r.id),unitIds=doc.kitchen.units.filter(u=>runIds.includes(u.runId)).map(u=>u.id),scope={walls,runIds,unitIds};
 const add=(step,issues)=>issues.forEach(m=>qs.push(question(step,m)));
 if(!getFactoryCatalog(doc).approved)qs.push(question('factory','كتالوج المشروع مبدئي وينتظر اعتماد المصنع.'));
 if(quote.total==null)qs.push(question('quote','السعر الإجمالي غير مكتمل. راجع الأسعار والبنود الناقصة في حصر هذا البديل.'));
 const hold=budgetHold(quote,doc.room.workshop?.layoutBrief);if(hold)qs.push(question('quote',hold));
 add('quote',quote.issues||[]);add('survey',siteReleaseIssues(doc,scope));add('appliances',evaluateApplianceFit(doc,scope).issues);
 add('measure',evaluateMeasureFit(doc,scope).issues);add('surfaces3d',surveyedSurfaceIssues(doc,scope));add('uses',clientUsageIssues(doc,scope));
 add('tap',tapWindowIssues(doc,scope));add('corner',cornerMotionIssues(doc));add('routes',evaluatePipeRoutes(doc,scope).issues);
 for(const run of runs){
  const row=doc.room.workshop?.rows?.[run.id];if(!row)continue;
  add('row',currentRiceWarnings(doc,run,row));add('appliances',currentDishwasherWarnings(doc,run,row));
 }
 return uniqueQuestions(qs);
}
export async function proposeWholeKitchen(doc,options={}){
 const w=doc?.room?.workshop||{};
 const stop=(reason,questions=[],extra={})=>({ok:false,doc,reason,questions,candidates:[],tried:0,truncated:false,...extra});
 if(!doc?.kitchen||!doc?.room)return stop('يحتاج المقترح إلى مشروع مطبخ مرفوع.');
 const walls=options.walls??(w.decisionReview?.active?w.decisionReview.walls:surveyedDesignWalls(doc));
 if(Array.isArray(walls)&&!walls.length)return stop('أكمل قياسات جدار واحفظ نهاية امتداد الدواليب قبل توليد التصميم.',[question('survey','رفع الجدار')]);
 const prepared=prepare(doc,walls,options);if(!prepared.ok)return stop(prepared.reason,prepared.questions);
 const {base,paths,wanted,brief}=prepared,limit=options.limit??72,pause=options.pause||(()=>Promise.resolve()),cancel=options.cancel||(()=>false);
 if(!Number.isInteger(limit)||limit<1||limit>144)return stop('حد محاولات البحث غير صالح.');
 const results=new Map(),rejections=new Map();let tried=0,truncated=false;
 const cancelled=()=>stop('ألغي الحساب بعد تغيّر المشروع.',[],{cancelled:true,tried});
 const record=r=>{for(const q of r.questions||[])rejections.set(q.text,q);};
 // Search the default 600 mm rhythm across ALL combinations before testing
 // alternative filler widths, so different appliance walls are considered early.
 search:for(const target of [600,450,900])for(const fn of candidateAssignments(base,{walls,wanted}))for(const path of assignments(paths)){
  if(cancel())return cancelled();
  if(tried>=limit){truncated=true;break search;}
  await pause();if(cancel())return cancelled();
  const composed=compose(base,prepared,walls,path,fn,target,options);
  if(!composed.ok){tried++;record(composed);continue;}
  for(const locations of assignments(composed.upperSlots)){
   if(tried>=limit){truncated=true;break search;}
   if(cancel())return cancelled();
   tried++;
   const c=finishTrial(doc,prepared,composed,locations,path,walls);
   if(c.ok){if(!results.has(c.key))results.set(c.key,c);}else record(c);
  }
 }
 if(cancel())return cancelled();
 const all=[...results.values()];
 if(!all.length){const qs=[...rejections.values()];return stop(qs[0]?.text||'لم يوجد مقترح متوافق ضمن الاختيارات والنطاق المرفوع.',qs,{tried,truncated});}
 if(brief)rankByBrief(all,brief);else all.sort((a,b)=>Number(a.provisional)-Number(b.provisional)||a.serviceDistanceMm-b.serviceDistanceMm||a.changed-b.changed);
 const candidates=all.slice(0,3);
 for(const c of candidates){c.questions=reviewWholeProposal(c.doc,walls,c.quote);c.provisional||=!!c.questions.length;}
 return {ok:true,candidates,tried,truncated,questions:candidates[0].questions};
}
