import {pantryContext} from './kitchen-pantry-brief.js';
import {cleanLayoutBrief,compareBudget,dividerMismatch,rankByBrief} from './kitchen-layout-brief.js';
import {clientUsageIssues,evaluateClientUsage} from './kitchen-client-usage.js';
// Search only assignments of the requested functions to explicitly selected
// measured walls. Use the real row planner and geometry guard for each trial.
import {architectureWallLabel} from './kitchen-architecture.js';
import {surveyedDesignRange} from './kitchen-chain-model.js';
import {planWorkshopRow,rowKinds} from './kitchen-production-row.js';
import {buildFactoryQuote,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {kitchenGeometry,kitchenRunPoint} from './kitchen-model.js';
const families=['sink','dishwasher','rice'];
function preferenceComparator(preference){
 return (a,b)=>{
  if(a.provisional!==b.provisional)return Number(a.provisional)-Number(b.provisional);
  if(preference==='price'){
   if((a.price==null)!==(b.price==null))return Number(a.price==null)-Number(b.price==null);
   if(a.price!=null&&a.price!==b.price)return a.price-b.price;
  }
  if(preference==='storage'&&a.storageWidthMm!==b.storageWidthMm)return b.storageWidthMm-a.storageWidthMm;
  if(preference==='cuts'&&a.cuts!==b.cuts)return a.cuts-b.cuts;
  return a.serviceDistanceMm-b.serviceDistanceMm||a.changed-b.changed||a.cuts-b.cuts||a.key.localeCompare(b.key);
 };
}
export function* candidateAssignments(doc,options={}){
 const walls=[...new Set(options.walls||[])];
 if(!walls.length||walls.length>4||walls.some(w=>!surveyedDesignRange(doc,w)))return;
 const k=doc.kitchen,runs=new Map(k.runs.map(r=>[r.id,r])),found={};
 // Existing service placements are preserved even on walls outside this trial.
 for(const unit of k.units){
  const run=runs.get(unit.runId),entry=doc.room.workshop?.rows?.[unit.runId]?.units.find(e=>e.id===unit.id);
  const family=entry?.family||(unit.kind==='sink'?'sink':unit.kind==='dishwasher'?'dishwasher':'');
  if(families.includes(family))found[family]=run?.wall||'island';
 }
 const incoming=families.filter(f=>options.wanted?.[f]&&found[f]===undefined);
 function* combinations(i,placements){
  if(i===incoming.length){yield {...found,...placements};return;}
  const family=incoming[i],order=[...walls];
  if(family==='sink')order.sort((a,b)=>Number(k.features.some(f=>f.wall===b&&f.kind==='water'))-Number(k.features.some(f=>f.wall===a&&f.kind==='water')));
  if(family==='dishwasher'&&(found.sink||placements.sink))order.sort((a,b)=>Number(b===(found.sink||placements.sink))-Number(a===(found.sink||placements.sink)));
  for(const wall of order)yield* combinations(i+1,{...placements,[family]:wall});
 }
 yield* combinations(0,{});
}
export function proposeAssignment(base,options,placements){
 let doc=base;const touched=[],clearances=[],cat=getFactoryCatalog(base),reject=reason=>({ok:false,reason});
 for(const wall of options.walls){
  const range=surveyedDesignRange(doc,wall);if(!range)return reject('راجع رفع '+architectureWallLabel(wall)+'.');
  const at=doc.kitchen.runs.filter(r=>r.tier==='base'&&r.wall===wall&&r.start*10<range.endMm&&r.end*10>range.startMm);
  if(at.length>1)return reject('يوجد أكثر من صف قائم داخل نطاق '+architectureWallLabel(wall)+'؛ قارن هذا الجزء بمحرّر الصف المفرد.');
  const existing=at[0],wanted={};
  if(existing&&(Math.abs(existing.start*10-range.startMm)>.01||Math.abs(existing.end*10-range.endMm)>.01)){
   return reject('حدود الصف القائم تختلف عن نطاق رفع '+architectureWallLabel(wall)+'. اضبط حدود المقارنة أو حرّر الصف منفردًا.');
  }
  for(const f of families){
   const exists=base.kitchen.units.some(u=>u.kind===rowKinds[f]&&(f!=='rice'||base.room.workshop?.rows?.[u.runId]?.units.some(m=>m.id===u.id&&m.family==='rice')));
   if(!exists&&options.wanted?.[f]&&placements[f]===wall)wanted[f]=true;
  }
  const request={searchBudget:25000,...(options.storageTargetMm?{storageTargetMm:options.storageTargetMm}:{}),...(existing?{runId:existing.id}:{wall,tier:'base',startMm:range.startMm,endMm:range.endMm}),wanted,...(options.additionsByWall?.has(wall)?{additions:options.additionsByWall.get(wall)}:{}),...(options.widths?{widths:options.widths}:{}),...(wanted.rice?{riceMode:options.riceMode||'unknown',pantryId:options.pantryId}:{} )};
  let r=planWorkshopRow(doc,request,cat);
  // In whole-kitchen previews, an unopenable new, unrequested storage front
  // may become a disclosed clearance gap. Requested and saved units never do.
  const clearanceGaps=[];
  for(let n=0;options.allowClearanceGaps&&!r.ok&&r.unusableStorage&&n<3;n++){
   const gap=r.unusableStorage;
   if(clearanceGaps.some(g=>g.u===gap.u&&g.width===gap.width))break;
   clearanceGaps.push(gap);clearances.push({wall,startMm:gap.u*10,endMm:(gap.u+gap.width)*10,reason:r.reason});
   r=planWorkshopRow(doc,{...request,clearanceGaps},cat);
  }
  if(!r.ok)return reject(architectureWallLabel(wall)+' · '+r.reason);
  if(!options.allowProvisional&&r.row.warnings.some(w=>w.includes('موضع مجلى')))return reject('لا تتطابق خدمات الماء والصرف مع موقع المجلى على '+architectureWallLabel(wall)+'.');
  touched.push(r.runId);doc=r.doc;
 }
 const geo=kitchenGeometry(doc.kitchen,doc.room);
 const collision=geo.conflicts.find(c=>c.hard&&c.ids.some(id=>touched.includes(id)||doc.kitchen.units.some(u=>u.id===id&&touched.includes(u.runId))));
 if(collision)return reject(collision.label);
 const units=geo.units.filter(u=>touched.includes(u.runId));
 const summary=touched.map(id=>{
  const run=doc.kitchen.runs.find(x=>x.id===id),manifest=doc.room.workshop.rows[id];
  return {wall:run.wall,units:manifest.units.map(u=>({family:u.family,...(u.recipeId?{recipeId:u.recipeId}:{}),startMm:u.startMm,widthMm:u.widthMm})),warnings:manifest.warnings};
 });
 const key=JSON.stringify(summary.map(s=>[s.wall,s.units])),storageWidthMm=units.filter(u=>['storage','drawers','open-shelf','bottle-rack','pullout','tall'].includes(u.kind)&&doc.room.workshop.rows[u.runId].units.some(e=>e.id===u.id&&e.family==='storage'&&!cat.families[e.recipeId]?.customerBay)).reduce((n,u)=>n+u.width*10,0);
 const quote=buildFactoryQuote(doc,{unitIds:units.map(u=>u.id)}),cuts=quote.pieces.filter(p=>p.kind!=='piece').reduce((n,p)=>n+p.count,0);
 const changed=base.kitchen.units.filter(u=>!units.some(v=>v.id===u.id&&v.kind===u.kind&&v.width===u.width&&v.u===u.u)&&touched.includes(u.runId)).length;
 const center=u=>{const r=doc.kitchen.runs.find(r=>r.id===u.runId);return kitchenRunPoint(doc.room,r,u.u+u.width/2,r.depth);};
 const sinks=geo.units.filter(u=>u.kind==='sink').map(center),washers=geo.units.filter(u=>u.kind==='dishwasher').map(center);
 const serviceDistanceMm=sinks.length&&washers.length?Math.round(Math.min(...sinks.flatMap(a=>washers.map(b=>Math.hypot(a.x-b.x,a.z-b.z))))*10):0;
 return {ok:true,doc,key,summary,clearances,storageWidthMm,cuts,travelComparable:!!(sinks.length&&washers.length),serviceDistanceMm,changed,price:quote.complete?quote.materialValue:null,provisional:summary.some(s=>s.warnings.some(w=>w.includes('موضع مجلى'))),placements};
}
export async function compareKitchenLayouts(doc,options,pause=()=>Promise.resolve(),cancel=()=>false){
 const pantry=pantryContext(doc);
 if(pantry.requests.length)options={...options,wanted:{...options.wanted,rice:options.wanted?.rice??pantry.wanted},pantryId:options.pantryId??(pantry.req?.confirmed&&pantry.req.choice!=='none'?pantry.req.id:null),riceMode:options.riceMode??pantry.mode};
 const candidates=new Map(),reasons=new Set();let tried=0,truncated=false;
 const incomplete=options.walls?.find(w=>!surveyedDesignRange(doc,w));
 if(incomplete)return {candidates:[],tried,truncated,reasons:['أكمل رفع '+architectureWallLabel(incomplete)+' واحفظ نهاية امتداد الدواليب قبل مقارنة التوزيعات.']};
 const provided=options.brief??doc.room.workshop?.layoutBrief,brief=provided?cleanLayoutBrief(provided):null,budgetCounts={over:0,unknown:0};
 if(provided&&!brief)return {candidates:[],tried,truncated,reasons:['أكمل نطاق الميزانية ومصدرها وأوزان الأولويات.']};
 const limit=brief?72:24;
 search:for(const placements of candidateAssignments(doc,options))for(const target of brief?[600,450,900]:[null]){
  if(tried>=limit){truncated=true;break search;}
  await pause();if(cancel())return {cancelled:true,candidates:[],tried,reasons:[]};
  tried++;const candidate=proposeAssignment(doc,{...options,storageTargetMm:target},placements);
  if(!candidate.ok){reasons.add(candidate.reason);continue;}
  if(candidates.has(candidate.key))continue;
  const physical=clientUsageIssues(candidate.doc);
  if(physical.length){physical.forEach(issue=>reasons.add(issue));continue;}
  if(brief){
   const quote=buildFactoryQuote(candidate.doc);candidate.budget=compareBudget(quote,brief);
   candidate.alignmentMm=dividerMismatch(candidate.doc,options.walls);
   if(brief.mode==='fixed'&&candidate.budget.status!=='within'){
    const k=candidate.budget.status;budgetCounts[k]++;reasons.add(k==='over'?'استُبعد توزيع يتجاوز سقف العميل حسب عرض المشروع الكامل.':'لم يثبت تطابق السقف لهذا التوزيع بسبب نقص سعر أو بند.');continue;
   }
   candidate.doc={...candidate.doc,room:{...candidate.doc.room,workshop:{...candidate.doc.room.workshop,layoutBrief:brief}}};
  }candidates.set(candidate.key,candidate);
 }
 const list=[...candidates.values()],shortlist=(brief?rankByBrief(list,brief):list.sort(preferenceComparator(options.preference))).slice(0,3);
 if(doc.room.workshop?.clientUsage?.tasks?.length)for(const c of shortlist){
  await pause();if(cancel())return {cancelled:true,candidates:[],tried,reasons:[]};
  const u=evaluateClientUsage(c.doc);c.usage={dailyMm:u.pending.length||!u.hasRoutes?null:u.dailyMm,soft:u.soft.length,pending:u.pending.length};
 }
 if(!brief&&options.preference==='usage')shortlist.sort((a,b)=>(a.usage?.soft??0)-(b.usage?.soft??0)||(a.usage?.dailyMm??Infinity)-(b.usage?.dailyMm??Infinity));
 return {candidates:shortlist,tried,truncated,budgetCounts,reasons:[...reasons]};
}
