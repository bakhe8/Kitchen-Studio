import {inheritedName} from './kitchen-safe-keys.js';
// Gravity pipe elevations are measured at the invert. Duct equivalent lengths
// are model-specific; no universal plumbing or ventilation design limits here.
import {kitchenGeometry,kitchenRunLocal,kitchenRunPoint} from './kitchen-model.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9][\w-]{0,85}$/.test(s)&&!inheritedName(s),ref=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
const val=(n,lo=0,hi=100000)=>Number.isFinite(n)&&n>=lo&&n<=hi;
const fp=v=>offlineDigest(new TextEncoder().encode(JSON.stringify(v)));
const rnd=n=>Math.round(n*1000)/1000;
export function cleanPipeRoutes(raw){
 if(!Array.isArray(raw)||raw.length>96)return null;
 const out=[],ids=new Set();
 for(const r of raw){
  if(!r||!key(r.id)||ids.has(r.id)||!key(r.unitId)||!key(r.featureId)||!['gravity','duct','pumped'].includes(r.kind)||!ref(r.source)||!ref(r.manual)||!ref(r.reviewer)||
     !val(r.pipeMm,1,5000)||!val(r.minPipeMm,1,5000)||!val(r.maxRunMm,1)||!val(r.datumToleranceMm,0,300)||!Array.isArray(r.points)||r.points.length<2||r.points.length>64||
     r.points.some(p=>!Array.isArray(p)||p.length!==3||p.some(n=>!val(n,-30000,30000)))||
     !Array.isArray(r.fittings)||r.fittings.length!==r.points.length-2||r.fittings.some(n=>n!==null&&!val(n))||
     r.kind==='gravity'&&!val(r.minSlopePct,0,100)||r.kind==='pumped'&&!val(r.maxHeadMm)||
     r.proof!==undefined&&!/^[a-f0-9]{64}$/.test(r.proof))return null;
  ids.add(r.id);out.push({id:r.id,unitId:r.unitId,featureId:r.featureId,kind:r.kind,source:r.source.trim(),manual:r.manual.trim(),reviewer:r.reviewer.trim(),pipeMm:r.pipeMm,minPipeMm:r.minPipeMm,maxRunMm:r.maxRunMm,datumToleranceMm:r.datumToleranceMm,
   points:r.points.map(p=>[...p]),fittings:[...r.fittings],...(r.kind==='pumped'?{maxHeadMm:r.maxHeadMm}:{}),...(r.kind==='gravity'?{minSlopePct:r.minSlopePct}:{}),...(r.proof?{proof:r.proof}:{})});
 }return out;
}
function binding(doc,r){
 const u=doc.kitchen.units.find(x=>x.id===r.unitId),run=u&&doc.kitchen.runs.find(x=>x.id===u.runId),f=doc.kitchen.features.find(x=>x.id===r.featureId);if(!run||!f)return '';
 const a=kitchenRunPoint(doc.room,run,u.u,0),b=kitchenRunPoint(doc.room,run,u.u+u.width,run.depth);
 const {proof,...raw}=r;
 return fp([raw,doc.room.width,doc.room.length,a,b,u.id,u.kind,u.u,u.width,u.modelSpec??null,run.bottom,run.height,run.depth,f.id,f.kind,f.wall,f.u,f.width,f.bottom,f.height,f.depth]);
}
export function attestPipeRoute(doc,input){
 const r=cleanPipeRoutes([input])?.[0];if(!r||!binding(doc,r))return null;
 return {...r,proof:binding(doc,r)};
}
export function evaluatePipeRoutes(doc,scope){
 const routes=doc.room.workshop?.pipeRoutes||[],issues=[],results=[];
 if(!routes.length)return {issues,results};
 const g=kitchenGeometry(doc.kitchen,doc.room);
 for(const r of routes){
  if(scope&&!scope.unitIds.includes(r.unitId))continue;const local=[],label=r.source+' · ',segments=[];
  const u=g.units.find(x=>x.id===r.unitId),run=u&&g.runs.find(x=>x.id===u.runId),f=g.features.find(x=>x.id===r.featureId);
  if(!u||!run||!f||f.kind!==(r.kind==='duct'?'vent':'drain'))local.push('مخرج أو وحدة غير مطابقين لنوع المسار.');
  if(!r.proof||r.proof!==binding(doc,r))local.push('تغيّر المضيف أو مخرج التوصيل أو القياسات منذ مراجعة المسار.');
  if(r.pipeMm<r.minPipeMm)local.push('القطر الداخلي أصغر من المطلوب بمقدار '+rnd(r.minPipeMm-r.pipeMm)+' مم.');
  const first=r.points[0],last=r.points.at(-1),tol=r.datumToleranceMm;
  if(run&&u){
   const q=kitchenRunLocal(doc.room,run,{x:first[0]/10,z:first[2]/10});if(q.u*10<u.u*10-tol||q.u*10>(u.u+u.width)*10+tol||q.d*10< -tol||q.d*10>u.depth*10+tol||first[1]<u.bottom*10-tol||first[1]>(u.bottom+u.height)*10+tol)local.push('بداية المسار خارج حيز الجهاز المرتبط.');
  }
  if(f){
   const q=kitchenRunLocal(doc.room,{wall:f.wall},{x:last[0]/10,z:last[2]/10});
   if(q.u*10<f.u*10-tol||q.u*10>(f.u+f.width)*10+tol||q.d*10< -tol||q.d*10>f.depth*10+tol||last[1]<f.bottom*10-tol||last[1]>(f.bottom+f.height)*10+tol)local.push('نهاية المسار لا تقع ضمن حدود مخرج الموقع المقاس.');
  }
  let developed=0,added=0,peak=0;
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],horizontal=Math.hypot(x,z),length=Math.hypot(horizontal,y);
   if(length<.001){local.push('نقطتان متكررتان في المسار.');continue;}
   const slope=horizontal>.001?-100*y/horizontal:null;developed+=length;peak=Math.max(peak,b[1]-first[1]);
   segments.push({index:i,lengthMm:rnd(length),horizontalMm:rnd(horizontal),fallMm:-y,slopePct:slope==null?null:rnd(slope)});
   if(r.kind==='gravity'&&(y>1e-6||slope!==null&&slope+1e-9<r.minSlopePct))local.push('المقطع '+i+' لا يحقق ميل الجريان الهابط المطلوب '+r.minSlopePct+'٪.');
   if(i<r.points.length-1&&r.kind!=='gravity'){
    const c=r.points[i+1],next=[c[0]-b[0],c[1]-b[1],c[2]-b[2]],nd=Math.hypot(...next),cos=nd?(x*next[0]+y*next[1]+z*next[2])/(length*nd):1;
    if(cos<.999999&&r.fittings[i-1]===null)local.push('أدخل الطول المكافئ للوصلة عند النقطة '+(i+1)+' من الدليل.');
    added+=r.fittings[i-1]??0;
   }
  }
  if(developed+added>r.maxRunMm+1e-6)local.push('الطول المحسوب يتجاوز الحد الموثّق بمقدار '+rnd(developed+added-r.maxRunMm)+' مم.');
  if(r.kind==='pumped'&&peak>r.maxHeadMm)local.push('الرفع الرأسي لأعلى نقطة يتجاوز حد المضخة.');
  issues.push(...local.map(s=>label+s));results.push({id:r.id,developedMm:rnd(developed),equivalentMm:rnd(developed+added),peakMm:rnd(peak),segments,issues:local});
 }
 return {issues,results};
}
