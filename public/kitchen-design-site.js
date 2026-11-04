import {architectureWallLabel} from './kitchen-architecture.js';
import {surveyedDesignRange,surveyedDesignWalls} from './kitchen-chain-model.js';

// Used at the authored CAD and reference-library entry points. Independent
// saved designs remain inspectable while newly added pieces use surveyed spans.
export function designSpanIssue(doc,spans){
 const ranges=new Map();
 for(const span of spans){
  if(!span.wall){
   if(!surveyedDesignWalls(doc).length)return 'أكمل رفع جدار وحدّد نهاية الدواليب قبل رسم الجزيرة.';
   continue;
  }
  if(!ranges.has(span.wall))ranges.set(span.wall,surveyedDesignRange(doc,span.wall));
  const range=ranges.get(span.wall),name=architectureWallLabel(span.wall);
  if(!range)return 'أكمل رفع '+name+' حتى نهاية الدواليب أو الركن ثم احفظه قبل تصميم الصف.';
  if(Number.isFinite(span.start)&&Number.isFinite(span.end)&&(span.start*10<range.startMm-.001||span.end*10>range.endMm+.001))
   return 'يتجاوز الصف بداية الدواليب أو نهايتها المسجّلة على '+name+'. استخدم الامتداد الذي قاسه المندوب.';
 }
 return '';
}

export function cadAdditionIssue(doc,next){
 const runs=new Map(next.runs.map(r=>[r.id,r]));
 const oldRuns=new Set(doc.kitchen.runs.map(r=>r.id)),oldUnits=new Set(doc.kitchen.units.map(u=>u.id));
 const spans=next.runs.filter(r=>!oldRuns.has(r.id));
 for(const u of next.units){
  if(oldUnits.has(u.id)||!oldRuns.has(u.runId))continue;
  const r=runs.get(u.runId);
  if(r)spans.push({wall:r.wall,start:u.u,end:u.u+u.width});
 }
 return designSpanIssue(doc,spans);
}
