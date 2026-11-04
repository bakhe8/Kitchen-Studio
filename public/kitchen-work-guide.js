import {hasLegacySampleLayout} from './kitchen-preset-recovery.js';
// The editors own the answers. Guide tasks are a projection of the same project
// that produces the drawing, quotation, and signed manufacturing revision.
import {guidedVisit,visitQuickAnswers,answerVisitQuestion} from './kitchen-guide-visit.js';
import {guidedProduction} from './kitchen-guide-production.js';
import {approvalState,releaseConcerns} from './kitchen-workshop-state.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {getFactoryCatalog,buildFactoryQuote} from './kitchen-workshop-factory.js';
import {finishMembers,finishParts,resolveFinishParts} from './kitchen-finish-parts.js';
import {configuredCorners} from './kitchen-project-decisions.js';
import {resolveUnitSupport} from './kitchen-base-support.js';
import {cleanUpstandSpec,worktopUpstandTakeoff,setUpstandWindowChoice} from './kitchen-worktop-upstand.js';
import {kitchenGeometry} from './kitchen-model.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {surveyedDesignRange} from './kitchen-chain-model.js';
import {clientUsageIssues} from './kitchen-client-usage.js';

const stages=['survey','design','finish','quote','release'];
const task=(id,stage,actor,step,focus,question,why,priority)=>({id,stage,actor,step,focus,question,why,priority,blocking:true});
const start=()=>task('guide.start','survey','rep','outline',{},'ما أبعاد غرفة المطبخ؟','ابدأ بالغرفة المقاسة حتى يمكن ربط كل فتحة وتجهيز بجدار معلوم.',0);
function wallSet(doc,options){
 const w=doc.room.workshop||{};
 const walls=options.wallIds|| (w.decisionReview?.active?w.decisionReview.walls:[]);
 return new Set(walls);
}
function finishReview(doc,cat,quote){
 const w=doc.room.workshop||{},items=new Map(cat.items.map(i=>[i.sku,i]));
 let optionalDefaults=false;
 const faces=[],descriptions=new Set(),components=new Set(),units=new Map(doc.kitchen.units.map(u=>[u.id,u]));
 for(const m of finishMembers(doc,cat)){
  const front=cat.families[m.family]?.recipe.find(p=>p.role==='front');
  if(!front)continue;
  const family=cat.families[m.family],choice=w.finishes?.units?.[m.id]?.frontSku||w.finishes?.frontSku;
  const available=cat.items.filter(i=>i.kind==='panel'&&i.role==='front'&&(i.available||i.stockUnits>0)&&(!family.frontSkus?.length||family.frontSkus.includes(i.sku)));
  if(!choice&&available.length>1)optionalDefaults=true;
  const parts=resolveFinishParts(family,w.finishes,m.id,items);
  for(const [role,slot] of Object.entries(family.finishSlots||{})){
   const picked=parts.actual.get(role);
   if(picked)components.add(finishParts[role]+' · '+picked.name);
   const inherits=w.finishes?.partDefaults?.[role]&&(!w.finishes.partCoverage?.[role]||w.finishes.partCoverage[role].includes(m.id));
   if(slot.skus.length>1&&!inherits&&!w.finishes?.partUnits?.[m.id]?.[role])optionalDefaults=true;
  }
  const sku=choice||front.sku;
  const mat=items.get(sku),u=units.get(m.id);
  faces.push([m.id,sku,u?.frontStyle,u?.handleStyle,u?.frontColor,u?.frontFinish]);
  if(mat)descriptions.add(mat.name+(mat.color?' · '+mat.color:''));
 }
 const used=[...new Set((quote.pieces||[]).map(p=>p.sku))].sort().map(sku=>{
  const i=items.get(sku);return [sku,i?.name,i?.color,i?.colorHex];
 });
 const choices=[w.approvals?.structure?.key,w.finishes,faces,used,
  doc.kitchen.runs.map(r=>[r.id,r.worktopFinish,r.worktopColor])];
 // Archive normalization can reorder named finish fields without changing a selection.
 const evidence=JSON.stringify(choices,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 return {key:offlineDigest(new TextEncoder().encode(evidence)),optionalDefaults,summary:[...descriptions].slice(0,3).join('، '),facts:[...descriptions,...components]};
}
// Only an actual stone/window contact can ask a customer for a treatment.
// A saved intention and the technical measurements for executing it have
// different owners, even when they concern the same window.
function windowQuestions(doc,stone){
 const out=[],contexts=new Set();
 for(const win of stone.windows||[]){
  contexts.add(win.key);
  const focus={section:'stone',wall:win.wall,windowKey:win.key,windowId:win.windowId};
  const location=architectureWallLabel(win.wall)+' عند '+Math.round(win.fromMm)+' مم';
  const id='design.stone-window.'+win.key;
  const unresolved=win.status==='pending'||win.status==='stale'||win.status==='invalid';
  if(unresolved||win.conflict&&win.status==='default'){
   const actor=win.requiredFrom||(win.choice?'rep':'customer');
   const prompt=actor==='customer'?'كيف يريد العميل خط النعلة عند شباك '+location+'؟':'ما التفصيل الناقص لتنفيذ النعلة عند شباك '+location+'؟';
   const detail=actor==='customer'?'ارتفاع النعلة '+win.nominalMm+' مم، والفرق من سطح الرخام إلى أسفل البرواز '+win.rawClearMm+' مم. عاين الانقطاع أو الاستمرار على الرسم.':win.reason;
   out.push({...task(id,'design',actor,'assembly',focus,prompt,detail||'راجع الخيار مع القياسات الحالية لهذا الشباك.',40),
    windowDatum:win.datum,canChooseGap:actor==='customer'&&!win.choice});
  }
  if(win.sillStatus&&['pending','stale','invalid'].includes(win.sillStatus)){
   out.push(task('design.window-sill.'+win.key,'design',win.sillRequiredFrom||'rep','assembly',focus,
    'ما المطلوب لتفصيل جلسة شباك '+location+'؟',win.sillReason||'طابق قياس الجلسة الأفقية مع القالب والتوريد الذي اختاره العميل.',42));
  }
 }
 for(const seam of stone.seamRequests||[]){
  if(seam.status==='resolved')continue;
  out.push(task('quote.window-seam.'+seam.key,'quote','factory','assembly',{section:'stone',wall:seam.wall,seamKey:seam.key},
   'أين تصل الورشة قطع النعلة على '+architectureWallLabel(seam.wall)+'؟',seam.reason||'خط النعلة أطول من اللوح المتاح. سجّل محطات الوصل الفعلية ليحسب البرنامج القطع.',27));
 }
 for(const key of stone.orphanSeams||[])out.push(task('quote.window-seam-old.'+key,'quote','factory','assembly',{section:'stone',seamKey:key},
  'هل تناسب وصلات النعلة السابقة الرسم المعدّل؟','راجع ارتباط الوصلات القديمة بمواضع القطع قبل إصدار الحصر.',28));
 for(const key of Object.keys(doc.room.workshop?.upstand?.windowChoices||{})){
  if(contexts.has(key))continue;
  out.push(task('design.window-orphan.'+key,'design','rep','assembly',{section:'stone',windowKey:key},
   'هل ما زال تفصيل الشباك السابق يطابق الرسم؟','تغيّر مرجع الشباك أو التقاء السطح بالجدار. افتح القرارات السابقة وراجع هذا الارتباط.',38));
 }
 return out;
}

function designQuestions(doc,{approval,quote,wallIds},cat){
 const w=doc.room.workshop||{},out=[],walls=wallSet(doc,{wallIds});
 const eligible=r=>r&&(!walls.size||!r.wall||walls.has(r.wall));
 const runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const members=finishMembers(doc,cat),built=members.length||configuredCorners(w);
 const targetWalls=[...(walls.size?walls:Object.keys(w.chains||{}))];
 const usable=targetWalls.filter(wall=>surveyedDesignRange(doc,wall));
 if(!usable.length&&hasLegacySampleLayout(doc))return out;
 const review=approval.designReview;
 if(review)out.push(task('design.collision.'+review.id,'design','engineer','placement',{unitId:review.unitId},
   'أي وحدة تحتاج نقلًا بعد رفع الجدار؟',review.reason,22));
 if(!built){
  if(w.upstand&&doc.kitchen.units.length)out.push(...windowQuestions(doc,worktopUpstandTakeoff(doc,cat)));
  if(usable.length){
   const single=doc.kitchen.units.length>0||usable.length>4;
   const loc={wall:usable[0]};
   out.push(task('design.layout','design','rep',single?'row':'whole',single?loc:{walls:usable},
    single?'أي صف ستربطه بوصفات المصنع؟':'ما التوزيع الذي سيُعتمد من المقترحات؟',
    single?'راجع وحدات الرسم وتعبئة الصف حتى يمكن حصرها.':'القياسات موجودة. أنشئ المقترحات ثم احفظ التوزيع الذي اختاره العميل على رسم المشروع.',65));
  }
  return out;
 }
 // A saved row is evidence only for its own wall; it cannot complete the
 // layout for another wall the customer explicitly included in the order.
 if(walls.size)for(const wall of usable){
  if(doc.kitchen.units.some(u=>runs.get(u.runId)?.wall===wall)||Object.values(w.corners||{}).some(c=>(c.a===wall||c.b===wall)&&(c.base||c.upper)))continue;
  const r=surveyedDesignRange(doc,wall);
  if(r.baseSpans?.length||r.upperSpans?.length)out.push(task('design.wall.'+wall,'design','rep','row',{wall},
   'ما الوحدات المطلوبة على '+architectureWallLabel(wall)+'؟','اختار العميل هذا الجدار وفيه مساحة مرفوعة، ولم يُطبّق عليه صف بعد.',58));
 }
 const g=kitchenGeometry(doc.kitchen,doc.room);
 const collision=g.hardConflicts?.[0];
 if(collision&&collision.id!==review?.id){
  const unit=g.units.find(u=>collision.ids.includes(u.id));
  out.push(task('design.collision.'+collision.id,'design','engineer','row',unit?{runId:unit.runId}:{},
   'أي موضع في الرسم يحتاج تعديلًا لحلّ التعارض؟',collision.label,22));
 }
 const usage=clientUsageIssues(doc);
 if(usage.length)out.push(task('design.usage','design','rep','uses',{},'كيف ستتسع الوحدة للغرض الذي حدده العميل؟',usage[0],24));

 const supports=new Set();
 for(const unit of doc.kitchen.units){
  const run=runs.get(unit.runId);if(!eligible(run))continue;
  const b=resolveUnitSupport(doc,cat,unit,run);
  if(!b.applicable||b.mode!=='unknown'&&b.apron!=='unknown')continue;
  const rules=Object.values(cat.baseSupport?.rules||{}),width=unit.width*10;
  const familyRules=rules.filter(r=>b.compatibleFamilies.includes(r.family)&&r.minWidthMm<=width&&width<=r.maxWidthMm);
  const canSelect=familyRules.some(r=>r.site==='any'||r.site===b.site);
  if(!canSelect&&familyRules.length&&b.site==='unknown'){
   const key='base-site.'+run.id;
   if(!supports.has(key))out.push(task(key,'design','rep',run.wall?'wallOptions':'surfaces3d',run.wall?{wall:run.wall}:{unitId:unit.id},
    'على أي منسوب يرتكز هذا الصف؟','توجد وصفة مناسبة لمقاس الدولاب. حدّد سطح الارتكاز المقاس حتى يمكن اختيارها.',42));
   supports.add(key);continue;
  }
  const supplied=b.mode==='unknown'&&!canSelect;
  const key=supplied?'base-rule.'+b.family+'-'+(b.site||'unknown'):'base-choice.'+unit.id;
  if(supports.has(key))continue;supports.add(key);
  const wall=run.wall?architectureWallLabel(run.wall):'الجزيرة',name=cat.families[b.family]?.label||unit.id;
  out.push(task(key,supplied?'quote':'design',supplied?'factory':'rep',supplied?'factory':'assembly',
   supplied?{tab:'unitBases'}:{section:'base',runId:run.id,unitId:unit.id},
   supplied?'ما وصفة الارتكاز المناسبة لـ«'+name+'»؟':'أي تفصيل للقاعدة والساتر يطبّق على '+unit.id+'؟',
   supplied?'يلزم تفصيل من المصنع يطابق عرض الوحدة وموضع ارتكازها على '+wall+' حتى يُحصر العتاد.':'توجد تفاصيل في كتالوج المصنع. اربط الوحدة بالتفصيل المناسب على '+wall+' لاستكمال حصر القاعدة.',45));
 }

 const stone=worktopUpstandTakeoff(doc,cat,g),spec=w.upstand;
 out.push(...windowQuestions(doc,stone));
 for(const wall of stone.contactWalls){
  const choice=spec?.walls?.[wall]||spec?.choice;
  if(choice&&choice.mode!=='undecided')continue;
  out.push(task('design.upstand.'+wall,'design','customer','assembly',{section:'stone',wall},
   'هل يريد العميل نعلة رخام عند '+architectureWallLabel(wall)+'؟',
   'يلامس السطح هذا الجدار. حدّد توريد النعلة من المصنع أو المورّد، أو سجّل اختيار العميل بدونها.',39));
 }
 if(review)return out;
 if(!approval.valid.structure){
  out.push(task('design.structure','design','rep','approve',{},w.approvals?.structure?'هل طابقتم التعديل مع العميل لاعتماد الهيكل مجددًا؟':'هل حُسم توزيع الوحدات ليبدأ اختيار الخامات؟',
   'راجِع مواضع الوحدات والأجهزة مع العميل ثم سجّل اسم المعتمِد على الرسم الحالي.',90));
 }else if(!approval.valid.customer&&cat.approved){
  const review=finishReview(doc,cat,quote);
  if(review.optionalDefaults&&w.guideFinishReview!==review.key){
   out.push({...task('finish.review','finish','customer','finish',{},'هل تناسب العميل تشطيبات الوحدات الحالية أم يريد تغييرها؟',
    'الواجهات المحددة في الرسم هي '+(review.summary||'من وصفات الوحدات')+'. يمكن الاحتفاظ بتفاصيل كل وحدة أو مراجعة الخامات والعتاد.',30),reviewKey:review.key,facts:review.facts});
  }
 }
 return out;
}

export async function kitchenWorkGuide(doc,options={}){
 if(!doc?.room||!doc?.kitchen){const current=start();return {stage:'survey',current,tasks:[current],later:[],complete:false};}
 const approval=options.approval||await approvalState(doc),quote=approval.quote;
 const ctx={...options,approval,quote};
 const cat=getFactoryCatalog(doc),inputs=guidedVisit(doc,ctx),design=designQuestions(doc,ctx,cat);
 const production=guidedProduction(doc,ctx);
 const byId=new Map();
 for(const t of [...inputs,...design,...production])if(t&&!byId.has(t.id))byId.set(t.id,t);
 // Signed local release is the end of the design guide. Actual job history is
 // checked by the authenticated tracking screen against the immutable receipt.
 if(approval.valid.release&&quote.ready&&!production.length&&!releaseConcerns(doc,approval).length)return {stage:'complete',current:null,tasks:[],later:[],complete:true};
 const order=t=>stages.indexOf(t.stage);
 const ordered=[...byId.values()].sort((a,b)=>order(a)-order(b)||a.priority-b.priority||a.id.localeCompare(b.id));
 if(!ordered.length)ordered.push(task('guide.verify','release','engineer','sign',{section:'release'},'ما الذي يحتاج مراجعة قبل الإفراج؟','افتح الاعتماد للتحقق من الرسم والحصر الحاليين.',99));
 const current=ordered[0];
 return {stage:current.stage,current,tasks:ordered.filter(t=>t.stage===current.stage),later:ordered.filter(t=>t.stage!==current.stage),complete:false};
}
const refusal=()=>({ok:false,reason:'تغيّر المشروع أو حُسم هذا السؤال. اعرض الخطوة الحالية من جديد.'});
export function guideQuickAnswers(doc,t){
 if(!doc?.room||!t)return [];
 if(t.id.startsWith('visit.'))return visitQuickAnswers(doc,t);
 if(t.id.startsWith('design.stone-window.')&&t.canChooseGap)return [{id:'gap',label:'اترك فراغًا بعرض البرواز'}];
 if(t.id.startsWith('design.upstand.'))return [{id:'none',label:'بدون نعلة على هذا الجدار'}];
 if(t.id==='finish.review')return [{id:'keep',label:'الإبقاء على التشطيبات الحالية'}];
 return [];
}
export function answerGuideQuestion(doc,t,answer){
 if(!doc?.room||!t)return refusal();
 if(t.id.startsWith('visit.'))return answerVisitQuestion(doc,t,answer);
 if(!guideQuickAnswers(doc,t).some(a=>a.id===answer))return refusal();
 const w=doc.room.workshop||{};let patch;
 if(t.id.startsWith('design.stone-window.')){
  const cat=getFactoryCatalog(doc),key=t.focus?.windowKey;
  const win=worktopUpstandTakeoff(doc,cat).windows?.find(x=>x.key===key);
  if(!win||t.id!=='design.stone-window.'+key||win.datum!==t.windowDatum||win.choice||!win.conflict)return refusal();
  return setUpstandWindowChoice(doc,cat,key,{kind:'gap'});
 }
 if(t.id==='finish.review'){
  if(!w.approvals?.structure||!t.reviewKey)return refusal();
  const review=finishReview(doc,getFactoryCatalog(doc),buildFactoryQuote(doc));
  if(review.key!==t.reviewKey||w.guideFinishReview===review.key)return refusal();
  patch={guideFinishReview:review.key};
 }else{
  const wall=t.focus?.wall,prior=w.upstand||{choice:{mode:'undecided'},walls:{}};
  const current=prior.walls?.[wall]||prior.choice;
  if(!wall||t.id!=='design.upstand.'+wall||current.mode!=='undecided'||!worktopUpstandTakeoff(doc,getFactoryCatalog(doc)).contactWalls.includes(wall))return refusal();
  const upstand=cleanUpstandSpec({...prior,walls:{...prior.walls,[wall]:{mode:'none'}}});if(!upstand)return refusal();
  patch={upstand};
 }
 return {ok:true,doc:{...doc,room:{...doc.room,workshop:{...w,...patch}}}};
}
