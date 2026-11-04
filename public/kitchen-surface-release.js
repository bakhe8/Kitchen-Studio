import {wallPairTopEvidence} from './kitchen-wall-pair.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {patternProblems} from './kitchen-surface-pattern.js';
import {kitchenGeometry} from './kitchen-model.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const bounded=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
export function cleanSurfaceTemplate(v){
 if(!v||!['reference','levelRecord','inspector','date','key'].every(k=>bounded(v[k]))||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(Date.parse(v.date))||!/^[0-9a-f]{64}$/.test(v.key)||typeof v.cutouts!=='string'||v.cutouts.length>600)return null;
 return {reference:v.reference.trim(),levelRecord:v.levelRecord.trim(),inspector:v.inspector.trim(),date:v.date,key:v.key,cutouts:v.cutouts.trim()};
}
function surfaces(doc){
 const {worktops}=kitchenGeometry(doc.kitchen,doc.room);
 return worktops.map(t=>[t.id,t.runId,t.bottom,t.height,t.depth,t.polygon.map(p=>[p.x,p.z]),t.holes.map(h=>[h.unitId,h.polygon.map(p=>[p.x,p.z])]),t.worktopFinish,t.worktopColor,...wallPairTopEvidence(doc,t)]);
}
export function surfaceKey(doc){
 return offlineDigest(new TextEncoder().encode(JSON.stringify(surfaces(doc))));
}
export function approveSurface(doc,form){
 const parts=surfaces(doc);if(!parts.length)return {ok:false,reason:'لا يوجد سطح مرسوم للاعتماد.'};
 if(parts.some(p=>p[6].length)&&!form.cutouts?.trim())return {ok:false,reason:'أدخل مرجع موديلات وقوالب فتحات المجلى والموقد.'};
 const v=cleanSurfaceTemplate({...form,key:surfaceKey(doc)});
 if(!v)return {ok:false,reason:'يلزم مرجع قالب الموقع ومحضر تثبيت الوحدات وتسويتها وتاريخ الرفع واسم المسؤول.'};
 return {ok:true,doc:{...doc,room:{...doc.room,workshop:{...doc.room.workshop,surfaceTemplate:v}}}};
}
export function surfaceReleaseIssues(doc){
 if(readWorkshopCatalog(doc.room.workshop)?.terms?.worktop!=='include')return [];
 const tops=kitchenGeometry(doc.kitchen,doc.room).worktops;if(!tops.length)return ['يشمل العرض سطحًا ولم يُرسم سطحه على المشروع.'];
 const w=doc.room.workshop,patterns=w.surfacePatterns||{},external=cleanSurfaceTemplate(w.surfaceTemplate),issues=[];
 for(const t of tops){
  if(patterns[t.id])issues.push(...patternProblems(doc,t,patterns[t.id]).map(s=>t.id+' · '+s));
  else if(!external||external.key!==surfaceKey(doc)||t.holes.length&&!external.cutouts)issues.push(t.id+' · أمر تصنيع السطح ينتظر قالب الموقع النهائي بعد التركيب والتسوية، ومراجع فتحات الأجهزة المطابقة. يمكن إصدار أجسام الدواليب كدفعة مستقلة.');
 }
 if(Object.keys(patterns).some(k=>!tops.some(t=>t.id===k)))issues.push('يوجد قالب رقمي مرتبط بسطح لم يعد موجودًا. راجع القوالب قبل إصدار السطح.');
 return issues;
}
