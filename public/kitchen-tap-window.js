import {inheritedName} from './kitchen-safe-keys.js';
import {confirmedChainFeature} from './kitchen-chain-model.js';
// Side-hinged inward sash vs referenced mixer body and operating envelopes.
// Local plan XY is millimetres along the sink row and towards the room.
// Tangent polygons enclose continuous arcs between measured angular limits.
import {kitchenGeometry,kitchenRunLocal,kitchenRunPoint} from './kitchen-model.js';
import {architectureWallPoint} from './kitchen-architecture.js';
import {verifiedPattern,patternFlangeFits} from './kitchen-surface-pattern.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9][\w:-]{0,80}$/.test(s)&&!inheritedName(s);
const words=s=>typeof s==='string'&&s.length<=180;
const mm=(n,lo=0,hi=9000)=>n===null||Number.isFinite(n)&&n>=lo&&n<=hi;
const fields=(o,keys,lo,hi)=>o&&keys.every(k=>mm(o[k],lo,hi));
const vals=(obj,keys)=>Object.fromEntries(keys.map(k=>[k,obj[k]]));
const mountKeys=['uMm','dMm','diameterMm','minDiameterMm','maxDiameterMm','deckRiseMm'];
const sashKeys=['planeMm','lowerInsetMm','leafHeightMm','thickMm','handleMm','openDeg'];
const armKeys=['duMm','ddMm','reachMm','radiusMm','bottomMm','topMm','fromDeg','travelDeg'];
function cleanArm(a,lever){
 if(!a||!(lever?['unknown','none','fixed','swivel']:['unknown','fixed','swivel']).includes(a.mode))return null;
 if(a.mode==='none'||a.mode==='unknown')return {mode:a.mode};
 if(!fields(a,['duMm','ddMm'],-1500,1500)||!fields(a,['reachMm','radiusMm','topMm','bottomMm'],0,2000)||!fields(a,['fromDeg'],-360,360)||!fields(a,['travelDeg'],0,360))return null;
 return {mode:a.mode,...vals(a,armKeys)};
}
export function cleanTapChecks(raw){
 if(!Array.isArray(raw)||raw.length>64)return null;
 const seen=new Set(),out=[];
 for(const v of raw){
  if(!v||!id(v.sinkId)||seen.has(v.sinkId+'/'+v.windowId)||!id(v.windowId)||!['model','manual','source','reviewer'].every(k=>words(v[k]))||!v.mount||!['deck','digital'].includes(v.mount.kind)||!words(v.mount.hole)||!fields(v.mount,mountKeys,0,9000)||!fields(v,['bodyRadiusMm','bodyHeightMm','clearanceMm'],0,2000)||!fields(v.sash,sashKeys.slice(0,-1),0,6000)||!mm(v.sash.openDeg,0,180)||v.proof!=null&&!/^[0-9a-f]{64}$/.test(v.proof))return null;
  const neck=cleanArm(v.neck,false),lever=cleanArm(v.lever,true);if(!neck||!lever)return null;seen.add(v.sinkId+'/'+v.windowId);
  out.push({sinkId:v.sinkId,windowId:v.windowId,...Object.fromEntries(['model','manual','source','reviewer'].map(k=>[k,v[k].trim()])),bodyRadiusMm:v.bodyRadiusMm,bodyHeightMm:v.bodyHeightMm,clearanceMm:v.clearanceMm,mount:{kind:v.mount.kind,hole:v.mount.hole.trim(),...vals(v.mount,mountKeys)},sash:vals(v.sash,sashKeys),neck,lever,...(v.proof?{proof:v.proof}:{})});
 }return out;
}
function host(doc,r,g){
 const u=g.units.find(u=>u.id===r.sinkId&&u.kind==='sink'),run=u&&g.runs.find(x=>x.id===u.runId),f=g.features.find(f=>f.id===r.windowId&&f.kind==='window');
 const t=u&&g.worktops.find(t=>t.runId===u.runId&&t.start<=u.u&&t.end>=u.u+u.width);
 if(!u||!run||!f||!t)return null;
 return {u,run,f,t};
}
function stamp(doc,r,data){
 if(!data)return null;
 const {proof,...values}=r,{u,run,f,t}=data;
 const bound=doc.room.workshop?.chains?.[f.wall]?.rows;
 const pattern=r.mount.kind==='digital'?doc.room.workshop?.surfacePatterns?.[t.id]:null;
 return offlineDigest(new TextEncoder().encode(JSON.stringify([values,u.id,u.runId,u.polygon,u.bottom,u.height,run.wall,t.id,t.polygon,t.bottom,t.height,t.holes.map(x=>[x.unitId,x.polygon]),f.id,f.wall,f.polygon,f.bottom,f.height,f.swing,f.hinge,f.hingeInset,f.leafWidth,bound||null,pattern||null])));
}
export function saveTapCheck(doc,c){
 const row=cleanTapChecks([c])?.[0];if(!row)return {ok:false,reason:'راجع الوحدات والقيم الرقمية والحدود الزاوية.'};
 const h=host(doc,row,kitchenGeometry(doc.kitchen,doc.room));if(!h)return {ok:false,reason:'اختر مجلى على سطح موجود وشباكًا من رسم الموقع.'};
 const arr=(doc.room.workshop?.tapChecks||[]).filter(x=>x.sinkId!==row.sinkId||x.windowId!==row.windowId);arr.push({...row,proof:stamp(doc,row,h)});
 return {ok:true,doc:{...doc,room:{...doc.room,workshop:{...doc.room.workshop,tapChecks:arr}}}};
}
const rad=a=>a*Math.PI/180;
const pos=(c,r,a)=>[c[0]+r*Math.cos(rad(a)),c[1]+r*Math.sin(rad(a))];
function sectors(c,r,start,travel){
 if(!r)return [[c]];
 if(!travel)return [[c,pos(c,r,start)]];
 // Each wedge is convex. Intersections of consecutive endpoint tangents
 // rather than inscribed chords ensure an intermediate clash is never skipped.
 const out=[],count=Math.ceil(Math.abs(travel)/90);
 for(let i=0;i<count;i++){
  const a=start+travel*i/count,delta=travel/count,n=Math.ceil(Math.abs(delta)/5),step=delta/n;
  const poly=[c,pos(c,r,a)];for(let j=0;j<n;j++)poly.push(pos(c,r/Math.cos(rad(step/2)),a+(j+.5)*step));
  poly.push(pos(c,r,a+delta));out.push(poly);
 }return out;
}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function dotDistance(p,a,b){
 const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));
 return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);
}
function contains(poly,p){
 if(poly.length<3)return false;
 const side=poly.map((a,i)=>cross(a,poly[(i+1)%poly.length],p));return side.every(x=>x>=-1e-7)||side.every(x=>x<=1e-7);
}
function separation(a,b){
 if(contains(a,b[0])||contains(b,a[0]))return 0;
 let best=Infinity;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i],q=a[(i+1)%a.length],x=b[j],y=b[(j+1)%b.length];
  if(cross(p,q,x)*cross(p,q,y)<0&&cross(x,y,p)*cross(x,y,q)<0)return 0;
  best=Math.min(best,dotDistance(x,p,q),dotDistance(y,p,q),dotDistance(p,x,y),dotDistance(q,x,y));
 }return best;
}
function one(doc,r,g){
 const issues=[],parts=[];
 const h=host(doc,r,g),warn=x=>issues.push(x);
 if(!h){warn('تغيّر المجلى أو السطح أو الشباك المرتبط.');return {issues,parts};}
 if(!r.proof||r.proof!==stamp(doc,r,h))warn('تغيّرت بيانات الفحص أو الرسم منذ الرفع. أعد المطابقة.');
 const {run,u,f,t}=h;
 if(!confirmedChainFeature(doc,f))warn('يلزم رفع الشباك وربطه بقياس فني معتمد يطابق الضلفة المرسومة.');
 if(![r.model,r.manual,r.source,r.reviewer].every(s=>s.trim()))warn('أكمل موديل الخلاط ودليله ومرجع الرفع واسم المراجع.');
 if(f.swing!=='in'||!['left','right'].includes(f.hinge)||!Number.isFinite(f.leafWidth)||!Number.isFinite(f.hingeInset)){
  warn('يتطلب هذا الفحص ضلفة جانبية تفتح للداخل مع عرض ومحور مفصلة مقاسَين. راجع حركة الشباك في الرفع.');return {issues,parts};}
 const k=r.sash;
 if(sashKeys.some(a=>k[a]===null)||k.leafHeightMm<=0||k.thickMm<=0||k.openDeg<=0||k.lowerInsetMm+k.leafHeightMm>f.height*10+.001){
  warn('أكمل منسوب ومحور وارتفاع وسماكة الضلفة وبروز عتادها وأقصى زاوية فتح مقاسة.');return {issues,parts};}
 const m=r.mount;let x=m.uMm,z=m.dMm,diam=m.diameterMm;
 if(m.kind==='digital'){
  const pat=verifiedPattern(doc,t),hole=pat?.holes.find(o=>o.id===m.hole&&o.id.startsWith('extra:')&&o.shape==='circle');
  if(!hole){warn('لم تُطابق فتحة خلاط دائرية إضافية في قالب السطح الحالي.');return {issues,parts};}
  x=(t.start-u.u)*10+hole.x;z=hole.y;diam=2*hole.radius;
  if(r.bodyRadiusMm&& !patternFlangeFits(pat,hole,r.bodyRadiusMm))warn('تمتد قاعدة الخلاط خارج مادة السطح أو فوق فتحة أخرى في القالب.');
 }
 if([x,z,diam,m.minDiameterMm,m.maxDiameterMm,m.deckRiseMm,r.bodyRadiusMm,r.bodyHeightMm,r.clearanceMm].some(v=>v==null)||Math.min(diam,m.minDiameterMm,r.bodyRadiusMm,r.bodyHeightMm)<=0||m.minDiameterMm>m.maxDiameterMm){
  warn('أكمل موضع التثبيت وقطره وحدود دليل الموديل ومنسوب سطح التثبيت وخلوص التشغيل.');return {issues,parts};}
 if(diam<m.minDiameterMm||diam>m.maxDiameterMm)warn('قطر الفتحة خارج مجال تركيب الموديل.');
 if(diam/2>r.bodyRadiusMm)warn('يتجاوز قطر الفتحة قاعدة الخلاط الممثلة.');
 if(x-r.bodyRadiusMm<0||x+r.bodyRadiusMm>u.width*10||z-r.bodyRadiusMm<0||z+r.bodyRadiusMm>t.depth*10)warn('قاعدة التثبيت تخرج عن حيز المجلى أو عمق سطحه.');
 const pivot=kitchenRunPoint(doc.room,run,u.u+x/10,z/10),tapLocal=kitchenRunLocal(doc.room,run,pivot);
 const c=[tapLocal.u*10,tapLocal.d*10],base=(t.bottom+t.height)*10+m.deckRiseMm;
 const hand=f.hinge==='right'?-1:1,hinge=f.u+(hand<0?f.width:0)+hand*f.hingeInset;
 const wallPoint=(station,d)=>{const p=architectureWallPoint(doc.room,f.wall,station,d),v=kitchenRunLocal(doc.room,run,p);return [v.u*10,v.d*10];};
 const origin=wallPoint(hinge,k.planeMm/10),at=wallPoint(hinge+hand,k.planeMm/10),inside=wallPoint(hinge,k.planeMm/10+1);
 const initial=Math.atan2(at[1]-origin[1],at[0]-origin[0])*180/Math.PI,dir=Math.sign(cross(origin,at,inside));
 const leaf=sectors(origin,f.leafWidth*10,initial,dir*k.openDeg),leafLow=f.bottom*10+k.lowerInsetMm,leafHigh=leafLow+k.leafHeightMm;
 // planeMm locates the hinge axis, not the panel mid-plane. A whole measured
 // thickness plus projecting hardware is a conservative two-sided slab pad.
 const sashPad=k.thickMm+k.handleMm;
 function check(label,shapes,pad,bottom,top){
  let d=Infinity;for(const a of shapes)for(const b of leaf)d=Math.min(d,separation(a,b));
  const lateral=Math.max(0,d-pad-sashPad),vertical=Math.max(0,leafLow-(base+top),(base+bottom)-leafHigh);
  const clearance=Math.hypot(lateral,vertical),ok=clearance>1e-6&&clearance>=r.clearanceMm-1e-6;
  parts.push({label,clearanceMm:Math.floor(clearance*100)/100,ok});
  if(!ok)warn('يتداخل الغلاف المحافظ لـ'+label+' مع فتح الشباك أو يقل خلوصه عن المطلوب.');
 }
 check('جسم الخلاط',[[c]],r.bodyRadiusMm,0,r.bodyHeightMm);
 for(const [label,a] of [['عنق الخلاط',r.neck],['ذراع التشغيل',r.lever]]){
  if(a.mode==='none')continue;
  if(a.mode==='unknown'||armKeys.some(k=>k!=='travelDeg'&&a[k]==null)||a.topMm<=a.bottomMm||!a.radiusMm||!a.reachMm||a.mode==='swivel'&&!(a.travelDeg>0)||a.mode==='fixed'&&a.travelDeg!==0){
   warn('غلاف '+label+' أو حد زاوية حركته غير موثّق.');continue;
  }
  check(label,sectors([c[0]+a.duMm,c[1]+a.ddMm],a.reachMm,a.fromDeg,a.travelDeg),a.radiusMm,a.bottomMm,a.topMm);
 }
 return {issues,parts};
}
export function evaluateTapChecks(doc,scope){
 const rows=(doc.room.workshop?.tapChecks||[]).filter(r=>!scope||scope.unitIds?.includes(r.sinkId));
 if(!rows.length)return {issues:[],results:[]};
 const g=kitchenGeometry(doc.kitchen,doc.room),results=rows.map(r=>({sinkId:r.sinkId,windowId:r.windowId,...one(doc,r,g)}));
 return {results,issues:results.flatMap(v=>v.issues.map(s=>v.sinkId+' · '+s))};
}
export const tapWindowIssues=(doc,scope)=>evaluateTapChecks(doc,scope).issues;
