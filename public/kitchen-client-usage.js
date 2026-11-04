import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {cleanDrawerPack} from './kitchen-drawer-pack-data.js';
import {drawerPackIssues} from './kitchen-drawer-packing.js';
// Personal reach and route preferences are independent of hard measured fit.
import {kitchenGeometry,kitchenRunPoint,kitchenRunPolygon} from './kitchen-model.js';
import {roomArchitecture,architectureContainsDisc,architectureContainsPolygon} from './kitchen-architecture.js';
import {convexIntersection,polygonArea,polygonBounds} from './kitchen-oriented.js';
import {surveyServiceBlocks} from './kitchen-service-zones.js';
const eps=1e-6,ok=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&!inheritedName(v)&&!['__proto__','prototype','constructor'].includes(v);
const word=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const box=v=>v&&['w','d','h'].every(k=>ok(v[k],1,6000));
const shape=v=>({w:v.w,d:v.d,h:v.h});
export const purposes={storage:'حفظ غرض',prep:'تحضير',waste:'فرز أو نفايات',seat:'جلوس وضيافة',activity:'محطة عمل خاصة'};
export function cleanClientUsage(raw){
 if(!raw||!Array.isArray(raw.tasks)||raw.tasks.length>80)return null;
 const tasks=[],ids=new Set();
 for(const a of raw.tasks){
  if(!a||!id(a.id)||ids.has(a.id)||!id(a.unitId)||!word(a.name,100)||!ownKey(purposes,a.purpose)||a.frequency!=null&&!ok(a.frequency,0,10000)||a.accepted!=null&&!word(a.accepted,180))return null;
  ids.add(a.id);const o={id:a.id,unitId:a.unitId,name:a.name.trim(),purpose:a.purpose};
  if(a.frequency!=null)o.frequency=a.frequency;if(a.accepted)o.accepted=a.accepted.trim();
  if(a.reach){const r=a.reach;if(!ok(r.low,0,6000)||!ok(r.high,r.low,6000)||!ok(r.relative,0,6000))return null;o.reach={low:r.low,high:r.high,relative:r.relative};}
  if(a.fit){const f=a.fit;if(!box(f.item)||!box(f.clear)||!word(f.ref,160)||typeof f.rotate!=='boolean')return null;o.fit={item:shape(f.item),clear:shape(f.clear),ref:f.ref.trim(),rotate:f.rotate};}
  if(a.area){const z=a.area;if(!ok(z.w,1,10000)||!ok(z.d,1,10000)||!ok(z.h,1,6000)||!word(z.ref,160))return null;o.area={w:z.w,d:z.d,h:z.h,ref:z.ref.trim()};}
  if(a.route){const r=a.route;if(!id(r.to)||r.to===a.unitId||!ok(r.width,1,2500)||!ok(r.height,1,4000))return null;o.route={to:r.to,width:r.width,height:r.height};}
  tasks.push(o);
 }
 const pack=raw.pack==null?null:cleanDrawerPack(raw.pack);if(raw.pack!=null&&!pack)return null;return {tasks,...(pack?{pack}:{})};
}
const d2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const dist=(a,b)=>Math.sqrt(d2(a,b));
const det=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const edges=p=>p.map((a,i)=>[a,p[(i+1)%p.length]]);
function pointSeg(p,a,b){const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/(d2(a,b)||1)));return Math.hypot(p.x-a.x-t*(b.x-a.x),p.z-a.z-t*(b.z-a.z));}
function segmentDist(a,b,c,d){if(det(a,b,c)*det(a,b,d)<0&&det(c,d,a)*det(c,d,b)<0)return 0;return Math.min(pointSeg(a,c,d),pointSeg(b,c,d),pointSeg(c,a,b),pointSeg(d,a,b));}
function inPoly(p,q){let inside=false;for(const [a,b] of edges(q))if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;return inside;}
function solids(geom,room){return [...geom.units.flatMap(u=>u.bodyParts||[u]),...geom.features.filter(f=>['column','shaft','heater','beam'].includes(f.kind)),...geom.worktops,...surveyServiceBlocks(room).filter(z=>room.workshop.serviceZones.zones.some(v=>'service-zone-'+v.id===z.id&&v.kind==='solid'))];}
function walking(room,from,to,widthMm,heightMm,gAll,obstacles){
 const radius=widthMm/20,height=heightMm/10,step=20,A=roomArchitecture(room),walls=A.walls.map(w=>[w.a,w.b]);
 const items=obstacles.filter(o=>o.bottom<height-eps&&o.bottom+o.height>eps).map(o=>({poly:o.polygon,b:o.rect||polygonBounds(o.polygon)}));
 const entry=u=>{const r=gAll.runs.find(r=>r.id===u.runId);return kitchenRunPoint(room,r,u.u+u.width/2,u.depth+radius+.1);};
 const start=entry(from),end=entry(to);
 function pass(a,b){
  if(!architectureContainsDisc(room,a,radius)||!architectureContainsDisc(room,b,radius))return false;
  if(walls.some(([c,d])=>segmentDist(a,b,c,d)<radius-eps))return false;
  const x=Math.min(a.x,b.x)-radius,z=Math.min(a.z,b.z)-radius,x2=Math.max(a.x,b.x)+radius,z2=Math.max(a.z,b.z)+radius;
  for(const o of items){const r=o.b;if(r.x>x2||r.z>z2||r.x+r.w<x||r.z+r.d<z)continue;
   if(inPoly(a,o.poly)||inPoly(b,o.poly)||edges(o.poly).some(([c,d])=>segmentDist(a,b,c,d)<radius-eps))return false;
  }
  return true;
 }
 if(!pass(start,start)||!pass(end,end))return null;
 if(pass(start,end))return dist(start,end)*10;
 // Eight-neighbour A* with a fixed 200 mm sampling interval; every accepted
 // edge tests the actual corridor swept by the specified body width.
 const key=(i,j)=>i+','+j,grid=(i,j)=>({x:(i+.5)*step,z:(j+.5)*step}),queue=[],cost=new Map(),done=new Set();
 function put(i,j,v){if(i<0||j<0||(i+.5)*step>A.width||(j+.5)*step>A.length)return;const k=key(i,j);if(cost.has(k)&&cost.get(k)<=v)return;cost.set(k,v);queue.push({i,j,v,k,score:v+dist(grid(i,j),end)});}
 const x=Math.floor(start.x/step),z=Math.floor(start.z/step);
 for(let i=x-2;i<=x+2;i++)for(let j=z-2;j<=z+2;j++){const p=grid(i,j);if(pass(start,p))put(i,j,dist(start,p));}
 while(queue.length){
  queue.sort((a,b)=>b.score-a.score);const c=queue.pop();if(done.has(c.k))continue;done.add(c.k);const p=grid(c.i,c.j);
  if(dist(p,end)<=step*3&&pass(p,end))return (c.v+dist(p,end))*10;
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;const i=c.i+di,j=c.j+dj;if(done.has(key(i,j)))continue;const q=grid(i,j);if(pass(p,q))put(i,j,c.v+dist(p,q));}
 }
 return null;
}
export function evaluateClientUsage(doc,scope=null,includeTravel=true){
 const input=doc.room.workshop?.clientUsage;if(!input?.tasks?.length)return {items:[],issues:[],soft:[],dailyMm:0,hasRoutes:false,pending:[]};
 const g=kitchenGeometry(doc.kitchen,doc.room),by=new Map(g.units.map(u=>[u.id,u])),obs=solids(g,doc.room),items=[],issues=[],soft=[],pending=[];
 const routes=new Map();let dailyMm=0,hasRoutes=false;
 for(const t of input.tasks){
  const u=by.get(t.unitId),selected=!scope||scope.unitIds.includes(t.unitId);let blockedNeighbour=false;
  const item={id:t.id,name:t.name,unitId:t.unitId,hard:[],soft:[],accepted:t.accepted||''};items.push(item);
  if(!u){if(selected){const warn=t.name+' غير مرتبط بوحدة موجودة.';pending.push(warn);if(t.area||t.fit)item.hard.push(warn);}issues.push(...item.hard);continue;}
  if(t.fit){const a=t.fit.item,b=t.fit.clear,valid=b.w<=u.width*10&&b.d<=u.depth*10&&b.h<=u.height*10;
   if(!valid||a.h>b.h||!(a.w<=b.w&&a.d<=b.d||t.fit.rotate&&a.d<=b.w&&a.w<=b.d))item.hard.push(t.name+' لا يطابق الحيز الصافي الموثق في '+u.id+'.');
  }
  if(t.reach){item.reachMm=u.bottom*10+t.reach.relative;
   if(t.reach.relative>u.height*10)item.hard.push('منسوب '+t.name+' خارج أبعاد الوحدة.');
   else if(item.reachMm<t.reach.low||item.reachMm>t.reach.high)item.soft.push('موضع '+t.name+' خارج مجال الوصول الذي اختاره العميل'+(t.frequency!=null?'، بتكرار '+t.frequency+' في اليوم':'')+'.');
  }
  if(t.area){
   const r=g.runs.find(r=>r.id===u.runId),z=t.area,p=kitchenRunPolygon(doc.room,r,u.u+u.width/2-z.w/20,z.w/10,z.d/10,u.depth),height=z.h/10;
   const overlaps=obs.filter(o=>o.bottom<height-eps&&o.bottom+o.height>eps&&Math.abs(polygonArea(convexIntersection(p,o.polygon)))>eps),touched=overlaps.length>0;
   blockedNeighbour=!!scope&&overlaps.some(o=>scope.unitIds.includes(o.id)||o.runId&&scope.runIds?.includes(o.runId));
   if(!architectureContainsPolygon(doc.room,p)||touched)item.hard.push('حيز '+t.name+' أمام الوحدة '+u.id+' يتقاطع مع جسم أو يخرج من حدود الغرفة.');
  }
  if(t.route&&includeTravel){
   const to=by.get(t.route.to);hasRoutes=true;item.to=t.route.to;
   if(!to){item.soft.push('وحدة الوصول في رحلة '+t.name+' غير موجودة.');pending.push(t.name);}
   else{const key=[...[u.id,to.id].sort(),t.route.width,t.route.height].join('|');
    if(!routes.has(key))routes.set(key,walking(doc.room,u,to,t.route.width,t.route.height,g,obs));item.distanceMm=routes.get(key);
    if(item.distanceMm===null){item.soft.push('لم يُعثر على مسار بالعرض والارتفاع المطلوبين بين '+u.id+' و'+to.id+'.');pending.push(t.name);}
    else if(t.frequency!=null){item.dailyMm=item.distanceMm*t.frequency;dailyMm+=item.dailyMm;}else pending.push('تكرار '+t.name);
   }
  }
  if(selected)issues.push(...item.hard);else if(blockedNeighbour)issues.push(...item.hard.filter(s=>s.startsWith('حيز ')));if(!item.accepted)soft.push(...item.soft);
 }
 return {items,issues:[...new Set(issues)],soft,dailyMm,hasRoutes,pending};
}
export const clientUsageIssues=(doc,scope)=>[...evaluateClientUsage(doc,scope,false).issues,...drawerPackIssues(doc,scope)];
