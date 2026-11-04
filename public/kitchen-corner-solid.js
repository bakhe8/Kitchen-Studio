import {wallPairJointIssue} from './kitchen-wall-pair-fit.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
// Wall leg lengths run along the two wall tangents; cabinet depths are
// perpendicular to the respective wall. These are not interchangeable on a chamfer.
import {cornerAssembly} from './kitchen-corner-carcass.js';
import {roomArchitecture,architectureContainsPolygon} from './kitchen-architecture.js';
import {convexIntersection,polygonArea} from './kitchen-oriented.js';
const eps=1e-6;
const valid=(x,min=0,max=6000)=>Number.isFinite(x)&&x>=min&&x<=max;
const reference=x=>typeof x==='string'&&x.trim()&&x.length<=180;
const area=poly=>Math.abs(polygonArea(poly));
const overlap=(a,b)=>Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+eps&&area(convexIntersection(a.polygon,b.polygon))>eps;
export function cleanCornerBody(raw){
 if(!raw||!reference(raw.reference)||!['depthAMm','depthBMm','heightMm'].every(k=>valid(raw[k],10))||!valid(raw.bottomMm))return null;
 const b=Object.fromEntries(['depthAMm','depthBMm','heightMm','bottomMm','reference'].map(k=>[k,raw[k]]));
 if(raw.motion!=null){
  const m=raw.motion;if(!m||!['a','b'].includes(m.side)||!reference(m.reference)||
   !['offsetMm','floorMm','sweepMm'].every(k=>valid(m[k]))||!['widthMm','depthMm','heightMm','clearWidthMm','clearHeightMm','openingWidthMm','openingHeightMm','sweepWidthMm'].every(k=>valid(m[k],1)))return null;
  b.motion=Object.fromEntries(['side','offsetMm','floorMm','widthMm','depthMm','heightMm','clearWidthMm','clearHeightMm','openingWidthMm','openingHeightMm','sweepMm','sweepWidthMm','reference'].map(k=>[k,m[k]]));
 }
 return b;
}
export function cornerSolids(room,corners,catalog=readWorkshopCatalog(room.workshop),fronts=room.workshop?.finishes?.cornerFronts){
 const out=[],walls=roomArchitecture(room).walls;
 for(const [id,c] of Object.entries(corners||{})){
  const wa=walls.find(w=>w.id===c.a),wb=walls.find(w=>w.id===c.b);
  const common=wa&&wb&&[wa.a,wa.b].find(p=>[wb.a,wb.b].some(q=>Math.hypot(q.x-p.x,q.z-p.z)<eps));
  for(const [tier,q] of c.tall?[['tall',c.base]]:[['base',c.base],['upper',c.upper]]){
   if(!q)continue;const g=q.body,issues=[];
   const s={id:'corner:'+id+':'+tier,joint:id,tier,wallIds:[c.a,c.b],parts:[],issues,inside:q.inside,access:q.access};out.push(s);
   const issue=t=>issues.push(s.id+' · '+t);
   if(!common){issue('لم تعد نهاية الجدارين متصلة.');continue;}
   if(!g){issue('الامتدادان محجوزان. يلزم توثيق العمقين وارتفاع الجسم ومنسوبه لإثبات حيز الركن.');continue;}
   const dir=w=>{const end=Math.hypot(w.a.x-common.x,w.a.z-common.z)<eps?w.b:w.a,n=Math.hypot(end.x-common.x,end.z-common.z);return {x:(end.x-common.x)/n,z:(end.z-common.z)/n};};
   const A=dir(wa),B=dir(wb),sin=Math.abs(A.x*B.z-A.z*B.x),cos=A.x*B.x+A.z*B.z;
   if(sin<.01){issue('تقاطع غير مستقر هندسيًا. راجع الضلعين.');continue;}
   const L=q.aMm/10,R=q.bMm/10,aa=g.depthBMm/10/sin,bb=g.depthAMm/10/sin;
   if(aa>L+eps||bb>R+eps){issue('عمق أحد الضلعين يستهلك امتداد الضلع الآخر.');continue;}
   const point=(x,z)=>({x:common.x+A.x*x+B.x*z,z:common.z+A.z*x+B.z*z});
   const poly=(pairs)=>pairs.map(p=>point(...p));
   s.polygon=poly([[0,0],[L,0],[L,bb],[aa,bb],[aa,R],[0,R]]);
   const bottom=g.bottomMm/10,height=g.heightMm/10;
   s.parts=[poly([[0,0],[L,0],[L,bb],[0,bb]]),poly([[0,bb],[aa,bb],[aa,R],[0,R]])].filter(p=>area(p)>eps).map(polygon=>({polygon,bottom,height}));
   if(bottom+height>room.height+eps||s.parts.some(p=>!architectureContainsPolygon(room,p.polygon))){issue('الجسم خارج حدود المطبخ أو يتجاوز السقف.');}
   if(q.build){
    const pairedEnd=w=>wallPairJointIssue(room,w,Math.hypot(common.x-w.a.x,common.z-w.a.z)<eps?'start':'end',tier,g.bottomMm,g.bottomMm+g.heightMm);
    const incompatible=pairedEnd(wa)||pairedEnd(wb);
    if(incompatible){issue(incompatible);continue;}
    const plan=cornerAssembly(q,tier,catalog,Math.abs(cos)<1e-6,fronts?.[s.id]),xy=(x,z)=>q.build.through==='a'?point(x/10,z/10):point(z/10,x/10);
    const box=(x0,x1,z0,z1,y0,y1)=>({polygon:[xy(x0,z0),xy(x1,z0),xy(x1,z1),xy(x0,z1)],bottom:bottom+y0/10,height:(y1-y0)/10});
    for(const err of plan.issues)issue(err);s.build=plan;
    s.panels=plan.panels.map(p=>({...box(p.x0,p.x1,p.z0,p.z1,p.y0,p.y1),tag:p.tag,side:p.side,color:p.color}));
    s.doorSweeps=plan.doors.map(v=>v.through?box(v.low,v.high,v.D,v.D+v.w,v.rim,v.rim+v.fh):box(v.E,v.E+v.w,v.low,v.high,v.rim,v.rim+v.fh));
    if(!plan.issues.length){
     s.groupCount=plan.bodyCount;
     s.install=plan.panels.filter(p=>['door','fixed','joint'].includes(p.tag)).map(p=>({...box(p.x0,p.x1,p.z0,p.z1,p.y0,p.y1),tag:p.tag,side:p.side}));
    }
   }
   if(!['pullout','carousel'].includes(q.inside)&&!g.motion)continue;
   const m=g.motion;if(!m){issue('أدخل مواصفات الحيز المغلق وغلاف الحركة الفعلي من دليل الآلية.');continue;}
   if(!q.sku.trim()||q.access!=='both'&&q.access!==m.side){issue('جهة سحب الإكسسوار أو مرجع صنفه لا يطابقان الواجهة.');}
   const a=m.side==='a',axis=a?A:B,other=a?B:A;
   const inward={x:(other.x-axis.x*cos)/sin,z:(other.z-axis.z*cos)/sin};
   const near=a?aa+bb*cos:bb+aa*cos,far=a?L+bb*cos:R+aa*cos;
   const offset=m.offsetMm/10,width=m.widthMm/10,depth=m.depthMm/10,face=(a?g.depthAMm:g.depthBMm)/10;
   const P=(u,v)=>({x:common.x+axis.x*u+inward.x*v,z:common.z+axis.z*u+inward.z*v});
   const quad=(l,r,back,front)=>[P(l,back),P(r,back),P(r,front),P(l,front)];
   const lo=near+offset; // Offset from the clear front's near end, not the room corner.
   const closed={polygon:quad(lo,lo+width,face-depth,face),bottom:bottom+m.floorMm/10,height:m.heightMm/10};
   s.hardware=closed;
   if(s.panels?.some(p=>!['door','fixed'].includes(p.tag)&&overlap(p,closed)))issue('تتداخل الآلية المغلقة مع رف أو فاصل أو لوح من تركيب الركن.');
   const stored=area(closed.polygon),inBody=s.parts.reduce((sum,p)=>sum+area(convexIntersection(p.polygon,closed.polygon)),0);
   if(stored-inBody>1e-4||m.floorMm+m.heightMm>g.heightMm)issue('حيز الإكسسوار في وضع الإغلاق يتجاوز جسم الركن.');
   if(m.clearWidthMm<m.openingWidthMm||m.clearHeightMm<m.openingHeightMm||m.clearHeightMm>g.heightMm||lo+m.clearWidthMm/10>far+eps)issue('فتحة الواجهة الصافية لا تستوعب الحد المطلوب من دليل الإكسسوار أو تتجاوز الواجهة المرسومة.');
   if(m.sweepMm>0){
    s.sweep={polygon:quad(lo,lo+m.sweepWidthMm/10,face,face+m.sweepMm/10),bottom:closed.bottom,height:closed.height};
    if(!architectureContainsPolygon(room,s.sweep.polygon))issue('غلاف حركة الآلية يخرج من الغرفة.');
   }
  }
 }
 return out;
}
export function cornerCollisionIssues(solids,geometry,scope){
 const issues=[],chosen=scope?.unitIds?new Set(scope.unitIds):null;
 for(const s of solids){
  // The CAD body is a separate manufacturing target. Missing evidence holds
  // that target or the whole project, not every nearby but unrelated cabinet.
  if(!chosen||chosen.has(s.id))issues.push(...s.issues);
  const zones=[...s.parts,...(s.doorSweeps||[]),...(s.sweep?[s.sweep]:[])];
  for(const u of geometry.units){
   if(chosen&&!chosen.has(s.id)&&!chosen.has(u.id))continue;
   if(zones.some(z=>overlap(z,u)||(u.openParts||[]).some(p=>overlap(z,p))))issues.push(s.id+' · يتداخل جسم الركن أو غلاف حركته مع الوحدة '+u.id+'.');
  }
  if(!chosen||chosen.has(s.id)){
   for(const f of geometry.features.filter(f=>['door','window','shaft','column','beam','heater'].includes(f.kind)))if(zones.some(z=>overlap(z,f)))issues.push(s.id+' · يتداخل الركن أو حركة آليته مع '+f.id+'.');
  }
 }
 for(let i=0;i<solids.length;i++)for(let j=0;j<i;j++){
   const a=solids[i],b=solids[j];if(chosen&&!chosen.has(a.id)&&!chosen.has(b.id))continue;
   if([...a.parts,...(a.doorSweeps||[]),...(a.sweep?[a.sweep]:[])].some(p=>[...b.parts,...(b.doorSweeps||[]),...(b.sweep?[b.sweep]:[])].some(q=>overlap(p,q))))issues.push(a.id+' · يتداخل الركنان في الارتفاع والعمق مع '+b.id+'.');
 }
 return [...new Set(issues)];
}
