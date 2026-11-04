import {wallPairTopEvidence} from './kitchen-wall-pair.js';
// Actual field coordinates in mm, local to a worktop. Y is depth from the back wall.
// A straight-edged outer contour, polygon holes, exact circles and rounded rectangles.
import {offlineDigest} from './kitchen-workshop-revision.js';

const epsilon=1e-7, finite=n=>Number.isFinite(n)&&Math.abs(n)<=30000;
const label=s=>typeof s==='string'&&s.trim()&&s.length<=180;
// gap() is quadratic in the vertices of every pair of holes: 48 polygons of 96 vertices cost about 2.8 s per check, repeated for each surface on the release path.
export const PATTERN_VERTEX_LIMIT=400;
const holeVertices=holes=>holes.reduce((n,h)=>n+(h.shape==='polygon'?h.points.length:h.shape==='rect'?4:0),0);
const distinct=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])>epsilon;
const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
const loopEdges=p=>p.map((a,i)=>[a,p[(i+1)%p.length]]);
const area=p=>Math.abs(loopEdges(p).reduce((s,[a,b])=>s+a[0]*b[1]-a[1]*b[0],0))/2;
function distance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],k=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p[0]-a[0]-k*dx,p[1]-a[1]-k*dy);
}
function meets(a,b,c,d){
 return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))<epsilon;
}
function polygon(raw){
 if(!Array.isArray(raw)||raw.length<3||raw.length>96||!raw.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)))return null;
 const p=raw.map(v=>[...v]),edges=loopEdges(p);
 if(area(p)<1||edges.some(([a,b])=>!distinct(a,b)))return null;
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)if(j!==i+1&&!(i===0&&j===p.length-1)&&meets(...edges[i],...edges[j]))return null;
 return p;
}
const within=(p,poly)=>loopEdges(poly).reduce((inside,[a,b])=>(a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]?!inside:inside,false);
const bounds=p=>({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),y0:Math.min(...p.map(v=>v[1])),y1:Math.max(...p.map(v=>v[1]))});
function cutShape(h){
 if(h.shape==='polygon'){const points=polygon(h.points);return points?{shape:'polygon',points}:null;}
 if(![h.x,h.y].every(finite))return null;
 if(h.shape==='circle'&&finite(h.radius)&&h.radius>0)return {shape:'circle',x:h.x,y:h.y,radius:h.radius};
 if(h.shape==='rect'&&[h.width,h.depth,h.radius].every(finite)&&h.width>0&&h.depth>0&&h.radius>=0&&2*h.radius<=Math.min(h.width,h.depth))return {shape:'rect',x:h.x,y:h.y,width:h.width,depth:h.depth,radius:h.radius};
 return null;
}
function corners(h){
 if(h.shape==='polygon')return h.points;
 const {x,y,width:w,depth:d}=h;return [[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
}
function gap(a,b){
 if(a.shape==='circle'&&b.shape==='circle')return Math.max(0,Math.hypot(a.x-b.x,a.y-b.y)-a.radius-b.radius);
 if(a.shape==='circle')return gap(b,a);
 const ap=corners(a),ae=loopEdges(ap);
 if(b.shape==='circle')return within([b.x,b.y],ap)?0:Math.max(0,Math.min(...ae.map(([p,q])=>distance([b.x,b.y],p,q)))-b.radius);
 const bp=corners(b),be=loopEdges(bp);
 if(within(ap[0],bp)||within(bp[0],ap)||ae.some(([p,q])=>be.some(([r,s])=>meets(p,q,r,s))))return 0;
 return Math.min(...ap.map(p=>Math.min(...be.map(([r,s])=>distance(p,r,s)))),...bp.map(p=>Math.min(...ae.map(([r,s])=>distance(p,r,s)))));
}
function outerGap(outer,h){
 const e=loopEdges(outer);
 if(h.shape==='circle')return within([h.x,h.y],outer)?Math.min(...e.map(([a,b])=>distance([h.x,h.y],a,b)))-h.radius:-1;
 // Rounded holes are tested with their circumscribed rectangle: conservative near a notch.
 const pts=corners(h),he=loopEdges(pts);
 if(pts.some(p=>!within(p,outer))||e.some(([a,b])=>he.some(([r,s])=>meets(a,b,r,s))))return -1;
 return Math.min(...pts.map(p=>Math.min(...e.map(([a,b])=>distance(p,a,b)))),...outer.map(p=>Math.min(...he.map(([a,b])=>distance(p,a,b)))));
}
export function cleanCutPatterns(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>160)return null;
 const out={};
 for(const [id,p] of Object.entries(raw)){
  if(!/^top:[\w-]+:\d+$/.test(id)||!p||!label(p.source)||!label(p.inspector)||!label(p.datum)||!label(p.materialRef)||!label(p.limitRef)||!label(p.levelRef)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||new Date(p.date+'T00:00:00Z').toJSON()?.slice(0,10)!==p.date||!/^([0-9a-f]{64})$/.test(p.designKey)||![p.edgeGapMm,p.webMm,p.fitToleranceMm].every(x=>finite(x)&&x>=0)||!finite(p.thicknessMm)||p.thicknessMm<=0||!Array.isArray(p.holes)||p.holes.length>48)return null;
  const outer=polygon(p.outer);if(!outer)return null;const holes=[],keys=new Set();
  for(const h of p.holes){
   if(!h||typeof h.id!=='string'||!/^([\w-]+:)?[\w-]{1,100}$/.test(h.id)||keys.has(h.id)||!label(h.modelRef))return null;
   const shape=cutShape(h);if(!shape)return null;keys.add(h.id);holes.push({id:h.id,modelRef:h.modelRef.trim(),...shape});
  }
  out[id]={source:p.source.trim(),inspector:p.inspector.trim(),datum:p.datum.trim(),materialRef:p.materialRef.trim(),limitRef:p.limitRef.trim(),levelRef:p.levelRef.trim(),date:p.date,designKey:p.designKey,edgeGapMm:p.edgeGapMm,webMm:p.webMm,fitToleranceMm:p.fitToleranceMm,thicknessMm:p.thicknessMm,outer,holes};
 }
 return out;
}
const fp=o=>offlineDigest(new TextEncoder().encode(JSON.stringify(o)));
export const topDesignKey=(doc,top)=>fp([top.id,top.polygon,top.bottom,top.height,top.worktopFinish,top.worktopColor,top.holes.map(h=>[h.id,h.unitId,h.kind,h.polygon]),doc.room.workshop?.chains?.[top.wall]?.rows,doc.room.workshop?.options?.[top.wall]?.profiles,doc.room.architecture?.outline?.reference,...wallPairTopEvidence(doc,top)]);
export function patternProblems(doc,top,p){
 const issues=[];
 if(holeVertices(p.holes)>PATTERN_VERTEX_LIMIT)return ['تعقيد فتحات القالب أعلى من الحد المسموح ('+PATTERN_VERTEX_LIMIT+' رأس). بسّط الفتحات المضلّعة أو قسّم السطح.'];
 if(p.designKey!==topDesignKey(doc,top))issues.push('تغيّر موضع السطح أو وحداته أو فتحاته بعد قياس القالب.');
 if(Math.abs(p.thicknessMm-top.height*10)>.00001)issues.push('سماكة القالب تختلف عن سماكة السطح في الرسم. راجع تغير الخلوص واعتمد السماكة الفعلية للصف.');
 const box=bounds(p.outer),length=(top.end-top.start)*10,depth=top.depth*10;
 if(Math.max(Math.abs(box.x0),Math.abs(box.y0),Math.abs(box.x1-length),Math.abs(box.y1-depth))>p.fitToleranceMm+epsilon)issues.push('أقصى حدود القالب لا تطابق حيز السطح ضمن سماحية المطابقة المسجّلة.');
 const wanted=new Set(top.holes.map(h=>h.unitId));
 for(const h of p.holes){
  const ok=wanted.delete(h.id);if(!ok&&!h.id.startsWith('extra:'))issues.push('فتحة لا ترتبط بموديل في السطح: '+h.id);
  if(ok){
   const u=doc.kitchen.units.find(u=>u.id===h.id),cutBox=h.shape==='circle'?{x0:h.x-h.radius,x1:h.x+h.radius}:bounds(corners(h));
   if(!u||cutBox.x0<(u.u-top.start)*10-p.fitToleranceMm||cutBox.x1>(u.u+u.width-top.start)*10+p.fitToleranceMm)issues.push('فتحة '+h.id+' تخرج من جسم الوحدة المحددة.');
  }
  if(outerGap(p.outer,h)<Math.max(epsilon,p.edgeGapMm)-epsilon/2)issues.push('فتحة '+h.id+' تتجاوز حدود السطح أو عرض الحافة المسموح.');
 }
 if(wanted.size)issues.push('لا توجد حدود مقاسة لفتحات '+[...wanted].join('، ')+'.');
 for(let i=0;i<p.holes.length;i++)for(let j=0;j<i;j++)if(gap(p.holes[i],p.holes[j])<Math.max(epsilon,p.webMm)-epsilon/2)issues.push('الفتحتان '+p.holes[j].id+' و'+p.holes[i].id+' تتداخلان أو لا تتركان الفاصل المطلوب.');
 return issues;
}
export function patternFlangeFits(pattern,hole,radius){
 const base={shape:'circle',x:hole.x,y:hole.y,radius};
 return outerGap(pattern.outer,base)>=0&&pattern.holes.every(h=>h.id===hole.id||gap(base,h)>0);
}
export function verifiedPattern(doc,top){const p=doc.room.workshop?.surfacePatterns?.[top.id];return p&&!patternProblems(doc,top,p).length?p:null;}
export function acceptPattern(doc,top,raw){
 const p=cleanCutPatterns({[top.id]:{...raw,designKey:topDesignKey(doc,top)}})?.[top.id];if(!p)return {ok:false,reason:'راجع الحلقة المغلقة والأبعاد والمراجع. الإحداثيات بالملليمتر، ولا تقبل الحدود المتقاطعة مع نفسها.'};
 const issues=patternProblems(doc,top,p);if(issues.length)return {ok:false,reason:issues.join(' ')};
 const w=doc.room.workshop||{};return {ok:true,doc:{...doc,room:{...doc.room,workshop:{...w,surfacePatterns:{...w.surfacePatterns,[top.id]:p}}}}};
}
export function patternQuantities(p){
 const b=bounds(p.outer),gross=area(p.outer),holes=p.holes.reduce((s,h)=>s+(h.shape==='polygon'?area(h.points):h.shape==='circle'?Math.PI*h.radius**2:h.width*h.depth-(4-Math.PI)*h.radius**2),0);
 return {blankM2:(b.x1-b.x0)*(b.y1-b.y0)/1e6,outerM2:gross/1e6,holesM2:holes/1e6,netM2:(gross-holes)/1e6};
}
export function surfaceInspectionChecks(p){
 const checks=[];function check(key,label,v){checks.push({key,label,nominal:Math.round(1000*v)/1000,unit:'مم'});}
 check('thick','سماكة السطح',p.thicknessMm);
 function contour(id,label,pts){for(const [i,[a,b]] of loopEdges(pts).entries())check(id+'-'+i,label+' '+(i+1),Math.hypot(b[0]-a[0],b[1]-a[1]));}
 contour('out','ضلع القالب المقاس',p.outer);
 for(const [i,h] of p.holes.entries()){
  const k='cut'+i,l=h.id;
  if(h.shape==='polygon')contour(k,l,h.points);
  else if(h.shape==='circle')check(k+'-dia','قطر '+l,2*h.radius);
  else {check(k+'-width','عرض '+l,h.width);check(k+'-depth','عمق '+l,h.depth);if(h.radius)check(k+'-r','نصف قطر ركن '+l,h.radius);}
  const x=h.shape==='polygon'?h.points[0][0]:h.x,y=h.shape==='polygon'?h.points[0][1]:h.y;
  check(k+'-x','موضع '+l+' من مرجع الطول',x);check(k+'-y','موضع '+l+' من مرجع العمق',y);
 }
 return checks;
}
export function surfaceDXF(doc,top){
 const p=verifiedPattern(doc,top);if(!p)throw Error('لا يوجد قالب رقمي صالح لهذه النسخة.');
 const q=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];
 const pair=(code,value)=>q.push(String(code),String(value));let handle=32;
 function entity(type,layer,sub){pair(0,type);pair(5,(handle++).toString(16));pair(100,'AcDbEntity');pair(8,layer);pair(100,sub);}
 function poly(pts,layer){entity('LWPOLYLINE',layer,'AcDbPolyline');pair(90,pts.length);pair(70,1);for(const [x,y,bulge] of pts){pair(10,x);pair(20,y);if(bulge)pair(42,bulge);}}
 poly(p.outer,'OUTER');
 for(const h of p.holes){
  if(h.shape==='circle'){entity('CIRCLE','CUTOUT','AcDbCircle');pair(10,h.x);pair(20,h.y);pair(30,0);pair(40,h.radius);}
  else if(h.shape==='rect'&&h.radius){const {x,y,width:w,depth:d,radius:r}=h,b=Math.tan(Math.PI/8);
   const path=[[x+r,y],[x+w-r,y,b],[x+w,y+r],[x+w,y+d-r,b],[x+w-r,y+d],[x+r,y+d,b],[x,y+d-r],[x,y+r,b]];
   // A capsule can have zero-length straight segments. Keep the bulge belonging
   // to the arc that follows any pair of coincident tangent points.
   const unique=[];for(const v of path){if(unique.length&&!distinct(v,unique.at(-1)))unique[unique.length-1]=v;else unique.push(v);}poly(unique,'CUTOUT');
  }else poly(corners(h),'CUTOUT');
 }
 q.push('0','ENDSEC','0','EOF');return q.join('\r\n')+'\r\n';
}
