import {ownKey,inheritedName} from './kitchen-safe-keys.js';
// Labeled field scan already registered to the project's finished-floor datum.
// Never infer a full room, hidden services, or window openings from these points.
import {architectureWall,architectureWallIdKnown} from './kitchen-architecture.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const safeID=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,40}$/.test(s)&&!inheritedName(s)&&s!=='constructor';
const text=(v,n)=>typeof v==='string'&&v.trim().length&&v.length<=n;
const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const fail=reason=>({ok:false,reason});
export const scanSourceKey=s=>offlineDigest(new TextEncoder().encode(s));
const round=v=>Math.round(v*10000)/10000;
export function parseWallXYZ(raw){
 if(typeof raw!=='string'||raw.length>160000||!raw.trim())return fail('الملف النصي يحتاج صفوف نقاط بحد ١٦٠ ألف محرف.');
 const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/).map(v=>v.trim()).filter(v=>v&&!v.startsWith('#')),headers={},groups=new Map();let points=0;
 for(const line of lines){
  if(line.includes('=')){
   const i=line.indexOf('='),k=line.slice(0,i).trim(),v=line.slice(i+1).trim();
   if(!['unit','axes','origin','reference'].includes(k)||ownKey(headers,k)||points)return fail('ترويسة XYZ مكررة أو غير معتمدة أو وردت بعد النقاط.');
   headers[k]=v;continue;
  }
  const parts=line.split(/[\s,]+/),wall=parts[0];
  if(parts.length!==4||!architectureWallIdKnown(wall)||parts.slice(1).some(s=>!s||!Number.isFinite(Number(s))))return fail('صيغة كل سطر هي معرّف الجدار ثم X Y Z. لا تُقبل النقاط غير المنسوبة إلى جدار.');
  if(++points>2500)return fail('حد الرفع ٢٥٠٠ نقطة في الملف الواحد. قسّم الملف بحسب الغرفة أو نطاق القياس.');
  if(!groups.has(wall))groups.set(wall,[]);groups.get(wall).push(parts.slice(1).map(Number));
 }
 if(!['mm','m'].includes(headers.unit)||headers.axes!=='X:right,Y:up,Z:front'||headers.origin!=='rear-left-finished-floor'||!text(headers.reference,160)||!points)return fail('حدّد mm أو m ومحاور X:right,Y:up,Z:front ومرجع rear-left-finished-floor واسم الرفع.');
 const scale=headers.unit==='m'?1000:1;
 for(const group of groups.values())for(const p of group){p.forEach((v,i)=>{p[i]=v*scale;});if(p.some(n=>!num(n,-18000,25000)))return fail('توجد نقطة خارج مجال إحداثيات الغرفة. راجع الوحدة والمرجع.');}
 return {ok:true,groups,points,reference:headers.reference,unit:headers.unit};
}
export function profileDatum(room,wall){const w=architectureWall(room,wall);return w?JSON.stringify([w.a.x,w.a.z,w.b.x,w.b.z,w.start,w.end,room.height]):'';}
export function cleanWallProfiles(w){
 if(!w||!w.sources||Array.isArray(w.sources)||typeof w.sources!=='object'||Object.keys(w.sources).length>6||!Array.isArray(w.bands)||w.bands.length>48)return null;
 const sources={},bands=[],seen=new Set();
 for(const [key,src] of Object.entries(w.sources)){if(!/^[0-9a-f]{64}$/.test(key)||!text(src,160000)||scanSourceKey(src)!==key)return null;sources[key]=src;}
 for(const b of w.bands){
  if(!b||!safeID(b.id)||seen.has(b.id)||!architectureWallIdKnown(b.wall)||!ownKey(sources,b.sourceId)||!text(b.datum,400)||!num(b.low,0,6000)||!num(b.high,b.low+.01,6000)||!num(b.pitchX,1,12000)||!num(b.pitchY,1,6000)||!num(b.tol,0,6000))return null;
  const q={id:b.id,wall:b.wall,sourceId:b.sourceId,datum:b.datum,low:b.low,high:b.high,pitchX:b.pitchX,pitchY:b.pitchY,tol:b.tol};
  if(b.review!=null){const v=b.review;if(!num(v.boundMm,0,6000)||!text(v.name,80)||!text(v.ref,120))return null;q.review={boundMm:v.boundMm,name:v.name.trim(),ref:v.ref.trim()};}
  seen.add(q.id);bands.push(q);
 }
 return {sources,bands};
}
export function fitWallBand(doc,raw,b){
 const parsed=parseWallXYZ(raw);if(!parsed.ok)return parsed;
 const wall=architectureWall(doc.room,b.wall),group=parsed.groups.get(b.wall);
 if(!wall||!group)return fail('تحتاج نقاطًا مسماة لهذا الجدار الموجود في الرسم.');
 if(!num(b.low,0,6000)||!num(b.high,b.low+.01,doc.room.height*10)||!num(b.pitchX,1,12000)||!num(b.pitchY,1,6000)||!num(b.tol,0,6000))return fail('حدد نطاق الارتفاع وفواصل التغطية والحد الذي تريد إظهار تجاوز بقاياه.');
 const set=group.filter(p=>p[1]>=b.low-1e-6&&p[1]<=b.high+1e-6).map(([x,y,z])=>{
  const dx=x-wall.a.x*10,dz=z-wall.a.z*10;
  return {u:round(dx*wall.tangent.x+dz*wall.tangent.z),y,d:round(dx*wall.inward.x+dz*wall.inward.z)};
 });
 if(set.length<3)return fail('الشريحة المحددة تحتاج ثلاث نقاط على الأقل، وعلى أكثر من محطة طولية.');
 if(set.some(p=>p.u<-.01||p.u>wall.length*10+.01))return fail('تتجاوز نقطة طرف الجدار المسجل. راجع التطابق بين الرفع ومرجع الرسم.');
 const n=set.length,avg=k=>set.reduce((s,p)=>s+p[k],0)/n,mu=avg('u'),my=avg('y'),md=avg('d');
 let xx=0,xy=0,yy=0,xd=0,yd=0;
 for(const p of set){const x=p.u-mu,y=p.y-my,d=p.d-md;xx+=x*x;xy+=x*y;yy+=y*y;xd+=x*d;yd+=y*d;}
 if(xx<=1e-8)return fail('كل النقاط في محطة طولية واحدة. يلزم مقطع من الجدار.');
 const det=xx*yy-xy*xy,plane=det>1e-8*Math.max(1,xx*yy);
 const slopeX=plane?(xd*yy-yd*xy)/det:xd/xx,slopeY=plane?(yd*xx-xd*xy)/det:null;
 const residuals=set.map(p=>Math.abs(p.d-(md+slopeX*(p.u-mu)+(slopeY||0)*(p.y-my))));
 const from=Math.max(0,Math.min(...set.map(v=>v.u))),to=Math.min(wall.length*10,Math.max(...set.map(v=>v.u)));
 const nx=Math.max(1,Math.ceil((to-from)/b.pitchX)),ny=Math.max(1,Math.ceil((b.high-b.low)/b.pitchY));
 if(nx*ny>40000)return fail('فواصل التغطية صغيرة جدًا على هذا النطاق. اختر شريحة أضيق.');
 const cells=new Set(set.map(p=>Math.min(nx-1,Math.max(0,Math.floor((p.u-from)/Math.max(1e-6,to-from)*nx)))+':'+Math.min(ny-1,Math.max(0,Math.floor((p.y-b.low)/(b.high-b.low)*ny)))));
 const maxObserved=Math.max(...set.map(p=>p.d)),observedMinY=Math.min(...set.map(p=>p.y)),observedMaxY=Math.max(...set.map(p=>p.y));
 return {ok:true,reference:parsed.reference,n,from,to,slopeX,slopeY,peakMm:Math.max(0,maxObserved),outliers:residuals.filter(v=>v>b.tol).length,
  maxResidual:Math.max(...residuals),rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/n),
  missing:nx*ny-cells.size,cellCount:nx*ny,observedMinY,observedMaxY,bandOK:plane&&observedMinY<=b.low+.01&&observedMaxY>=b.high-.01&&cells.size===nx*ny};
}
