import {inheritedName} from './kitchen-safe-keys.js';
// Measured, piecewise-planar finished surfaces in global millimetres.
// Each floor/plinth triangle is the exposed support surface, so their interiors
// cannot overlap. Gaps are unknown. Clipping before interpolation gives true
// extrema over a rotated support pad even when it crosses a triangle edge.
import {kitchenGeometry,kitchenRunPolygon} from './kitchen-model.js';
import {architectureContainsPolygon} from './kitchen-architecture.js';
import {convexIntersection,polygonArea} from './kitchen-oriented.js';
const epsilon=.001;
const area=p=>Math.abs(polygonArea(p));
const bounded=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][\w:-]{0,80}$/.test(v)&&!inheritedName(v);
const ref=x=>typeof x==='string'&&x.trim()&&x.length<=180;
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const mmPoly=poly=>poly.map(p=>({x:p.x*10,z:p.z*10}));
const project=t=>t.map(([x,z,y])=>({x,z,y}));
const layer=p=>p.kind==='ceiling'?'ceiling':'floor';
export function cleanMeasuredSurfaces(raw){
 if(!raw||!Array.isArray(raw.patches)||raw.patches.length>256||!Array.isArray(raw.checks)||raw.checks.length>256)return null;
 const out={patches:[],checks:[]},ids=new Set(),targets=new Set();
 for(const p of raw.patches){
  if(!p||!id(p.id)||ids.has(p.id)||!['floor','plinth','ceiling'].includes(p.kind)||!ref(p.reference)||
   !bounded(p.errorMm,0,100)||!Array.isArray(p.triangle)||p.triangle.length!==3||!p.triangle.every(v=>Array.isArray(v)&&v.length===3&&bounded(v[0],0,12000)&&bounded(v[1],0,12000)&&bounded(v[2],p.kind==='ceiling'?1:-1500,6000)))return null;
  if(area(project(p.triangle))<1)return null;
  out.patches.push({id:p.id,kind:p.kind,errorMm:p.errorMm,reference:p.reference.trim(),triangle:p.triangle.map(v=>[...v])});ids.add(p.id);
 }
 for(const c of raw.checks){
  if(!c||!id(c.target)||targets.has(c.target)||!ref(c.reference)||(c.support==null&&c.clearanceMm==null)||c.clearanceMm!=null&&!bounded(c.clearanceMm,0,2000))return null;
  const check={target:c.target,reference:c.reference.trim(),...(c.clearanceMm!=null?{clearanceMm:c.clearanceMm}:{})};
  if(c.support!=null){
   const f=c.support;if(!bounded(f.mountMm,0,3000)||!bounded(f.minLegMm,0,1500)||!bounded(f.maxLegMm,f.minLegMm,1500)||!bounded(f.maxPadDeltaMm,0,200)||
    !Array.isArray(f.pads)||f.pads.length<3||f.pads.length>32||!f.pads.every(v=>Array.isArray(v)&&v.length===4&&bounded(v[0],0,3000)&&bounded(v[1],0,2000)&&bounded(v[2],1,1000)&&bounded(v[3],1,1000)))return null;
   const rect=([x,z,w,d])=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}];
   if(f.pads.some((p,i)=>f.pads.slice(0,i).some(q=>area(convexIntersection(rect(p),rect(q)))>epsilon)))return null;
   check.support={mountMm:f.mountMm,minLegMm:f.minLegMm,maxLegMm:f.maxLegMm,maxPadDeltaMm:f.maxPadDeltaMm,pads:f.pads.map(v=>[...v])};
  }
  targets.add(c.target);out.checks.push(check);
 }
 return out;
}
function sample(poly,patches){
 let covered=0,low=Infinity,high=-Infinity;
 for(const p of patches){
  const cut=convexIntersection(poly,p.poly);if(!cut.length)continue;
  const [a,b,c]=p.poly,det=cross(a,b,c);
  for(const v of cut){
   const elevation=a.y+(b.y-a.y)*cross(a,v,c)/det+(c.y-a.y)*cross(a,b,v)/det;
   low=Math.min(low,elevation-p.errorMm);high=Math.max(high,elevation+p.errorMm);
  }
  covered+=area(cut);
 }
 return {low,high,touched:covered>epsilon,complete:Math.abs(area(poly)-covered)<=epsilon};
}
export function evaluateSurveyedSurfaces(doc,scope){
 const raw=doc.room.workshop?.surfaces3d;if(!raw)return {issues:[],results:[]};
 const g=kitchenGeometry(doc.kitchen,doc.room),selected=scope?new Set(scope.unitIds):null,issues=new Set(),results=[];
 const patches=raw.patches.map(p=>({...p,poly:project(p.triangle)}));
 const scopedPolys=selected?[...g.units.filter(u=>selected.has(u.id)).map(u=>mmPoly(u.polygon)),...g.cornerBodies.filter(c=>selected.has(c.id)).flatMap(c=>c.parts.map(p=>mmPoly(p.polygon)))]:null;
 for(const [i,p] of patches.entries()){
  if(scopedPolys&&!scopedPolys.some(v=>area(convexIntersection(v,p.poly))>epsilon))continue;
  const wrong=!architectureContainsPolygon(doc.room,p.poly.map(v=>({x:v.x/10,z:v.z/10})));
  if(wrong)issues.add(p.reference+' · مثلث الرفع يتجاوز حدود الغرفة.');
  if(patches.slice(0,i).some(q=>layer(p)===layer(q)&&area(convexIntersection(p.poly,q.poly))>epsilon))issues.add(p.reference+' · تتراكب مساحات مثلثات طبقة الرفع. قسّم السطح الظاهر عند حافة التعلية أو سقوط السقف.');
 }
 const floor=patches.filter(p=>layer(p)==='floor'),ceiling=patches.filter(p=>layer(p)==='ceiling');
 const targets=g.units.map(u=>({id:u.id,u,poly:mmPoly(u.polygon),top:(u.bottom+u.height)*10,
   topExtras:g.worktops.filter(t=>t.runId===u.runId&&t.start<u.u+u.width&&t.end>u.u).map(t=>({poly:convexIntersection(mmPoly(t.polygon),mmPoly(u.polygon)),top:(t.bottom+t.height)*10}))}));
 for(const corner of g.cornerBodies)for(const part of corner.parts)targets.push({id:corner.id,poly:mmPoly(part.polygon),top:(part.height+part.bottom)*10,topExtras:[]});
 for(const t of targets){
  if(selected&&!selected.has(t.id))continue;
  const c=raw.checks.find(v=>v.target===t.id),warn=msg=>issues.add(t.id+' · '+msg);
  const ceilingFoot=sample(t.poly,ceiling);
  for(const envelope of [t,...t.topExtras]){
   const at=sample(envelope.poly,ceiling);if(at.touched&&at.low<envelope.top+(c?.clearanceMm||0)-epsilon)warn('يتجاوز الجسم أو سطحه منسوب السقف المقاس أو خلوص التركيب المطلوب.');
  }
  if(c?.clearanceMm!=null&&!ceilingFoot.complete)warn('لا تغطي قراءات السقف كامل مسقط الوحدة المطلوب للتحقق من الخلوص.');
  const floorFoot=sample(t.poly,floor),u=t.u;
  const supportMode=u?.baseSupport?.mode;
  if(supportMode&&['integral','platform','suspended','excluded'].includes(supportMode)){
   if(c?.support)warn('جدول الأرجل المرفق لا يطابق طريقة ارتكاز الوحدة.');
   if(supportMode!=='excluded'&&floorFoot.touched){
    const nominal=floor.map(p=>({...p,errorMm:0})),bearing=sample(t.poly,nominal);
    if(bearing.high>(u.bottom*10+u.baseSupport.bodyClearMm)+epsilon)warn('يتداخل الارتفاع المقاس لسطح الارتكاز مع جسم الوحدة.');
    if(supportMode==='platform'&&!bearing.complete)warn('تغطية رفع التعلية غير مكتملة تحت جسم الوحدة.');
   }
   continue;
  }
  if(u&&u.tier==='base'&&floorFoot.touched&&!c?.support)warn('أدخل مساحات الارتكاز وارتفاع التثبيت ومدى ضبط الأرجل من دليل هذه الوحدة.');
  if(!c?.support)continue;
  if(!u||u.tier!=='base'){warn('يلزم ربط جدول الأرجل بوحدة أرضية لها محور محلي معلوم.');continue;}
  const f=c.support,run=g.runs.find(v=>v.id===u.runId),mount=u.bottom*10+f.mountMm,padResults=[];
  if(!floorFoot.complete)warn('لم تُغطّ الأرضية تحت كامل مسقط الوحدة للتحقق من التعلية بين قواعد الارتكاز.');
  if(f.mountMm>u.height*10||floorFoot.touched&&floorFoot.high>mount+epsilon)warn('يرتفع منسوب الأرضية أو التعلية داخل جسم الوحدة فوق مستوى تثبيت الأرجل.');
  for(const [i,[x,z,w,d]] of f.pads.entries()){
   if(x+w>u.width*10+epsilon||z+d>u.depth*10+epsilon){warn('تقع قاعدة الرجل '+(i+1)+' خارج مسقط الوحدة.');continue;}
   const pad=mmPoly(kitchenRunPolygon(doc.room,run,u.u+x/10,w/10,d/10,z/10)),hit=sample(pad,floor);
   if(!hit.complete){warn('الرفع لا يغطي كامل قاعدة الرجل '+(i+1)+'.');continue;}
   const min=mount-hit.high,max=mount-hit.low;
   if(hit.high-hit.low>f.maxPadDeltaMm+epsilon)warn('يتجاوز تفاوت المنسوب تحت قاعدة الرجل '+(i+1)+' حد المورد.');
   if(min<f.minLegMm-epsilon||max>f.maxLegMm+epsilon)warn('تتجاوز تسوية الرجل '+(i+1)+' نطاق الضبط الموثق.');
   padResults.push({index:i+1,minLegMm:min,maxLegMm:max});
  }
  results.push({target:t.id,pads:padResults});
 }
 for(const c of raw.checks)if((!selected||selected.has(c.target))&&!targets.some(t=>t.id===c.target))issues.add(c.target+' · غابت الوحدة أو أبعاد جسم الركن عن الرسم الحالي.');
 return {issues:[...issues],results};
}
export const surveyedSurfaceIssues=(doc,scope)=>evaluateSurveyedSurfaces(doc,scope).issues;
