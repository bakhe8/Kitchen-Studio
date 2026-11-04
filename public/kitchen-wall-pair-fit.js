// A measured pair bounds the cabinet body's footprint at one horizontal slice.
// It never changes the surveyed wall or repositions the openings on its rear edge.
import {evaluateWallPair} from './kitchen-wall-pair.js';
import {architectureWall,architectureWallLabel} from './kitchen-architecture.js';
import {kitchenUnitSpecs} from './kitchen-catalog.js';

const eps=1e-5;
const containsLevel=(heightMm,bottom,height)=>heightMm>=bottom*10-eps&&heightMm<=(bottom+height)*10+eps;
function pairFor(doc,run){
 return run?.wall&&run.placement!=='free'&&doc.room?.workshop?.wallPairs?.[run.wall]?.[run.tier];
}

export function unresolvedWallPairs(doc,wall){
 const records=doc.room.workshop?.wallPairs?.[wall];if(!records)return null;
 const pending={};
 for(const [tier,pair] of Object.entries(records)){
  const r=evaluateWallPair(doc,wall,pair);
  if(r.status!=='resolved')pending[tier]={reason:r.reason,limitMm:r.status==='unlocated'?Math.min(pair.frontMm,pair.backMm)+(pair.errorMm??0):null};
 }
 return Object.keys(pending).length?pending:null;
}
// Use a deeper surveyed strip only as a conservative interior for a shallower
// body. Never extend a strip beyond the depth at which it was measured.
export function wallPairSpans(doc,run,spans){
 const pair=pairFor(doc,run);
 if(!pair||!containsLevel(pair.heightMm,run.bottom,run.height))return spans;
 const result=evaluateWallPair(doc,run.wall,pair);
 if(result.status!=='resolved')return spans;
 const low=Math.ceil(result.startMm-eps),high=Math.floor(result.endMm+eps);
 return spans.map(s=>({...s,startMm:Math.max(s.startMm,low),endMm:Math.min(s.endMm,high)})).filter(s=>s.endMm>s.startMm);
}

// A catalog with discrete widths may leave an explicit open distance at a
// newly narrowed end. Prefer an exact fill; never move a remote opening or
// silently manufacture an extra filler. The caller must retain pinned units.
export function wallPairStockRemainder(doc,run,spans,gridMm){
 const pair=pairFor(doc,run);
 if(!pair||gridMm<2||!containsLevel(pair.heightMm,run.bottom,run.height))return null;
 const r=evaluateWallPair(doc,run.wall,pair),wall=architectureWall(doc.room,run.wall);
 if(r.status!=='resolved'||!wall)return null;
 const start=Math.ceil(r.startMm-eps),end=Math.floor(r.endMm+eps),gaps=[];
 const adjusted=spans.map(([lo,hi])=>{
  const gap=(hi-lo)%gridMm;
  if(!gap)return [lo,hi];
  const atStart=lo===start&&start>wall.start*10+eps,atEnd=hi===end&&end<wall.end*10-eps;
  if(!atStart&&!atEnd)return [lo,hi];
  const fromStart=atStart&&(!atEnd||start-wall.start*10>wall.end*10-end);
  const where=fromStart?lo:hi-gap;
  gaps.push({startMm:where,endMm:where+gap});
  return fromStart?[lo+gap,hi]:[lo,hi-gap];
 }).filter(([lo,hi])=>lo<hi);
 return gaps.length?{adjusted,gaps}:null;
}

// Compare only the end used by a physical joint. A measured width delta at
// the opposite end need not invalidate a square corner on this side.
export function wallPairJointIssue(room,edge,side,tier,lowMm,highMm,slope=0){
 const records=room.workshop?.wallPairs?.[edge.id];
 if(!records)return '';
 for(const level of tier==='tall'?['base','upper']:[tier]){
  const pair=records[level];if(!pair||pair.heightMm<lowMm-eps||pair.heightMm>highMm+eps)continue;
  const r=evaluateWallPair({room},edge.id,pair);
  if(r.status!=='resolved')return 'يتطلب تفصيل الركن تحديد طرف الجدار في قياس الظهر والوجه. '+r.reason;
  const offset=side==='start'?r.startOffsetMm:r.endOffsetMm;
  if(Math.abs(offset-slope*pair.depthMm)>.5)return 'قياس الظهر والوجه عند طرف '+architectureWallLabel(edge.id)+' لا يطابق زاوية الوصلة في الرسم. راجع محيط الركن أو اعتمد قالبًا وتفصيلًا خاصًا.';
 }
 return '';
}

// Provisional drawings can retain their present stations when a total change
// lacks a datum. A proposed footprint wider than the measured face is already
// impossible, even before the unknown side offsets have been established.
export function checkWallPairRow(doc,run,units){
 const pair=pairFor(doc,run);
 if(!pair)return {errors:[],pending:[]};
 const result=evaluateWallPair(doc,run.wall,pair),errors=new Set(),pending=new Set(),active=[];
 const label=architectureWallLabel(run.wall)+' · '+(run.tier==='upper'?'العلوي':'السفلي')+' · ';
 for(const u of units){
  const spec=kitchenUnitSpecs[u.kind];
  const height=(u.modelSpec?.heightMm/10)||(spec?.height??run.height);
  if(!containsLevel(pair.heightMm,run.bottom,height))continue;
  active.push(u);
  if(result.status!=='resolved')continue;
  const depth=u.modelSpec?.depthMm??(spec?.depth??run.depth)*10;
  if(depth>pair.depthMm+eps)pending.add(label+'واجهة الوحدة '+u.id+' أعمق من خط القياس المقابل. تحقّق عند العمق الفعلي.');
  if(u.u*10<result.startMm-eps||(u.u+u.width)*10>result.endMm+eps)
   errors.add(label+'الوحدة '+u.id+' تتجاوز المجال المشترك بين الظهر والوجه ('+result.startMm+'–'+result.endMm+' مم). راجع موضعها أو أعد تعبئة الصف.');
 }
 if(active.length&&result.status!=='resolved'){
  pending.add(label+result.reason);
  const reaches=active.filter(u=>(u.modelSpec?.depthMm??(kitchenUnitSpecs[u.kind]?.depth??run.depth)*10)>=pair.depthMm-eps);
  if(result.status==='unlocated'&&reaches.length){
   const width=Math.max(...reaches.map(u=>(u.u+u.width)*10))-Math.min(...reaches.map(u=>u.u*10));
   if(width>Math.min(pair.frontMm,pair.backMm)+(pair.errorMm??0)+eps)errors.add(label+'إجمالي امتداد الوحدات يتجاوز إحدى القراءتين. حدّد موضع طرف واحد ثم أعد التوزيع.');
  }
 }
 return {errors:[...errors],pending:[...pending]};
}

export function wallPairReleaseIssues(doc,scope,locate){
 if(!doc.room?.workshop?.wallPairs)return [];
 const selected=scope?.unitIds?new Set(scope.unitIds):null,runIds=scope?.runIds?new Set(scope.runIds):null,walls=scope?.walls?new Set(scope.walls):null;
 const issues=new Set();
 for(const run of doc.kitchen.runs){
  const pair=pairFor(doc,run);
  if(!pair||(runIds&&!runIds.has(run.id))||(walls&&!walls.has(run.wall)))continue;
  const units=doc.kitchen.units.filter(u=>u.runId===run.id&&(!selected||selected.has(u.id)));
  if(!units.length)continue;
  const check=checkWallPairRow(doc,run,units);
  for(const problem of [...check.errors,...check.pending]){
   issues.add(problem);
   if(locate)locate(problem,check.pending.length?'pair':'row',check.pending.length?{wall:run.wall,pair:true,tier:run.tier}:{runId:run.id});
  }
 }
 return [...issues];
}
