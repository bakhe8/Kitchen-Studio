import {inheritedName} from './kitchen-safe-keys.js';
import {wallPairJointIssue} from './kitchen-wall-pair-fit.js';
// Work in wall-local mm at the back edge of the installed crown. At a shared
// corner the two face lines must meet and both walls must request the join.
import {roomArchitecture,architectureWall} from './kitchen-architecture.js';
import {kitchenRunPoint,kitchenRunLocal} from './kitchen-model.js';
import {wallUpperBands} from './kitchen-chain-options.js';
import {readChainRange} from './kitchen-chain-model.js';
import {finishBarEnds} from './kitchen-factory-families.js';
const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const ref=(s,max)=>typeof s==='string'&&s.trim()&&s.length<=max;
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,47}$/.test(s)&&!inheritedName(s);
const rnd=x=>Math.round(x*1000)/1000;
export function cleanTrimRecipes(raw,items){
 if(raw==null)return {};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>48)return null;
 const result={};
 for(const [id,r] of Object.entries(raw)){
  if(!key(id)||['constructor','prototype','__proto__'].includes(id)||!r||!ref(r.label,84)||!ref(r.reference,180))return null;
  const item=items.get(r.sku);if(!item)return null;
  const base={kind:r.kind,sku:r.sku,label:r.label.trim(),reference:r.reference.trim()};
  if(r.route!=null){
   const t=r.route;
   if(!key(t.machine)||!number(t.tolerance,.0001,100)||(t.minutes!=null&&!number(t.minutes,0,1440))||r.reference.trim().length>160)return null;
   base.route={machine:t.machine,tolerance:t.tolerance,minutes:t.minutes??null};
  }
  if(r.kind==='cornice'&&item.kind==='bar'&&number(r.heightMm,.001,500)&&number(r.projectionMm,.001,500))result[id]={...base,heightMm:r.heightMm,projectionMm:r.projectionMm};
  else if(r.kind==='filler'&&item.kind==='panel'&&number(r.minWidthMm,1,10000)&&number(r.maxWidthMm,r.minWidthMm,10000)&&number(r.jointGapMm,0,100)&&['length','across'].includes(r.grain))result[id]={...base,minWidthMm:r.minWidthMm,maxWidthMm:r.maxWidthMm,jointGapMm:r.jointGapMm,grain:r.grain};
  else return null;
 }
 return result;
}
function trimOperation(r,kind,edge,angle,length=0,width=0){
 return {...r.route,kind,reference:r.reference,xFrom:edge,yFrom:'start',x:0,y:0,diameter:0,depth:0,length,width,angle:Math.abs(angle),radius:0};
}
const cross=(a,b)=>a.x*b.z-a.z*b.x;
const minus=(a,b)=>({x:a.x-b.x,z:a.z-b.z});
const distance=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
const near=(a,b)=>Math.abs(a-b)<.01;
function plan(doc,wall){
 const o=doc.room.workshop.options[wall],r=readChainRange(doc,wall);
 if(!o||!r)return null;
 const top=wallUpperBands(doc,wall).at(-1);
 return {o,range:r,spans:r.corniceSpans||r.upperBandSpans.at(-1)||[],edge:architectureWall(doc.room,wall),elevation:top?(top.bottom+top.height)*10:null};
}
function joint(doc,wall,side,segment,otherEnd){
 const own=plan(doc,wall),endpoint=side==='start'?own.edge.a:own.edge.b;
 const candidates=[];
 for(const edge of roomArchitecture(doc.room).walls){
  if(edge.id===wall)continue;
  const nearStart=distance(endpoint,edge.a)<1e-5,nearEnd=distance(endpoint,edge.b)<1e-5;
  if(nearStart||nearEnd)candidates.push({edge,side:nearStart?'start':'end'});
 }
 if(candidates.length!==1)return {error:'لا يتحدد جدار مقابل واحد عند طرف الكورنيش.'};
 const {edge,side:otherSide}=candidates[0],other=plan(doc,edge.id),q=other?.o.factoryTrim?.cornice;
 if(!own.edge||!other?.o.cornice.enabled||!other.spans.length||q?.recipe!==own.o.factoryTrim.cornice.recipe||q[otherSide]!=='join')return {error:'يلزم اختيار وصل الكورنيش نفسه من طرف الجدار المقابل '+edge.id+'.'};
 if(!near(own.elevation,other.elevation))return {error:'تختلف مناسيب الكورنيشين عند الركن.'};
 if(doc.room.workshop?.wallPairs){
  const check=(data,side,adjacent,adjacentSide)=>{
   const dir=adjacentSide==='start'?1:-1,t=adjacent.tangent,w=data.edge;
   const along=dir*(t.x*w.tangent.x+t.z*w.tangent.z),depth=dir*(t.x*w.inward.x+t.z*w.inward.z);
   if(Math.abs(depth)<1e-8)return '';
   return wallPairJointIssue(doc.room,w,side,'upper',data.o.bottomMm,data.elevation,along/depth);
  };
  const mismatch=check(own,side,edge,otherSide)||check(other,otherSide,own.edge,side);
  if(mismatch)return {error:mismatch};
 }
 const peerSegment=otherSide==='start'?other.spans[0]:other.spans.at(-1);
 const lineA=kitchenRunPoint(doc.room,{wall},own.edge.start,own.o.depthMm/10),lineB=kitchenRunPoint(doc.room,{wall:edge.id},edge.start,other.o.depthMm/10);
 const denom=cross(own.edge.tangent,edge.tangent);if(Math.abs(denom)<1e-6)return {error:'الوصل المتوازي أو المستقيم يحتاج نهاية مصممة في الورشة.'};
 const t=cross(minus(lineB,lineA),edge.tangent)/denom,p={x:lineA.x+t*own.edge.tangent.x,z:lineA.z+t*own.edge.tangent.z};
 const u=kitchenRunLocal(doc.room,{wall},p).u*10,v=kitchenRunLocal(doc.room,{wall:edge.id},p).u*10;
 // Never extend into a hidden corner, window or unavailable gap just to make a
 // mitre. Irregular custom corner stocks use their project-specific cut sheet.
 if(u<segment.startMm-.01||u>segment.endMm+.01||v<peerSegment.startMm-.01||v>peerSegment.endMm+.01||
    (side==='start'?u>=otherEnd-.01:u<=otherEnd+.01))return {error:'الجبهتان لا تلتقيان داخل المقاطع المرفوعة. اعتمد تفصيل الركن الخاص.'};
 if(side===otherSide)return {error:'راجع اتجاه مرجع الجدارين قبل إخراج قطع الركن.'};
 const first=side==='end'?own.edge.tangent:edge.tangent,second=side==='end'?edge.tangent:own.edge.tangent;
 const angle=Math.atan2(cross(first,second),first.x*second.x+first.z*second.z)*90/Math.PI;
 if(Math.abs(angle)>85)return {error:'زاوية الوصلة خارج نطاق القطع الموثق.'};
 return {u:rnd(u),degrees:rnd(side==='end'?-angle:angle),peer:edge.id};
}
export function makeTrimPieces(doc,wall,kind,catalog){
 const choice=doc.room.workshop?.options?.[wall]?.factoryTrim?.[kind];
 if(!choice)return null;
 const issues=[],releaseIssues=[],pieces=[],r=catalog.trims?.[choice.recipe],s=plan(doc,wall);
 const answer={issues,releaseIssues,pieces};
 if(!s||!r||r.kind!==kind){issues.push('ينقص رفع الجدار أو وصفة '+kind+' المختارة على '+wall+'.');return answer;}
 if(doc.room.workshop.chains?.[wall]?.source!=='field')releaseIssues.push('يلزم رفع ميداني مرتبط بتشطيب '+wall+'.');
 const item=catalog.items.find(i=>i.sku===r.sku),id='wall:'+wall+':'+kind;
 if(!item){issues.push('الصنف المختار للتشطيب غير موجود.');return answer;}
 const common={sku:r.sku,recipeId:choice.recipe,kind:item.kind,unitId:id,runId:wall,family:kind,drawing:r.reference};
 if(kind==='filler'){
  const h=rnd(doc.room.height*10-s.o.bottomMm-s.o.heightMm-s.o.headMm-(s.o.cornice.enabled?s.o.cornice.heightMm:0));
  const stockSpan=r.grain==='length'?item.stockLengthMm:item.stockWidthMm,stockH=r.grain==='length'?item.stockWidthMm:item.stockLengthMm;
  if(h<=0||h>stockH){issues.push('ارتفاع القفلة لا يدخل في اتجاه الخام المحدد.');return answer;}
  const cap=Math.min(r.maxWidthMm,stockSpan),spans=s.range.fillerSpans||s.spans;
  for(const [i,span] of spans.entries()){
   const width=span.endMm-span.startMm,n=Math.ceil((width+r.jointGapMm)/(cap+r.jointGapMm));
   if(n<1||n>120){issues.push('عدد ألواح القفلة خارج مجال التفصيل.');continue;}
   const free=width-(n-1)*r.jointGapMm,nominal=rnd(free/n);let cursor=span.startMm;
   for(let k=0;k<n;k++){
    const w=k===n-1?rnd(span.endMm-cursor):nominal;
    if(w<r.minWidthMm-.001||w>cap+.001){issues.push('القفلة تحتاج تعديل مقاس اللوح أو عدد فواصلها.');break;}
    const a=r.grain==='length'?w:h,b=r.grain==='length'?h:w;
    pieces.push({...common,...(r.route?{operations:[trimOperation(r,'size','start',0,a,b)]}:{}),label:'قفلة '+(i+1)+' · لوح '+(k+1),count:1,a,b,stationMm:rnd(cursor),operation:'قص لوح باتجاه '+(r.grain==='length'?'طول':'عرض')+' الخام'});
    cursor+=w+r.jointGapMm;
   }
  }
  return answer;
 }
 if(!s.spans.length){issues.push('لا توجد حافة بمساحة خالية عند منسوب الكورنيش وبروزه الحقيقي.');return answer;}
 if(!near(s.o.cornice.heightMm,r.heightMm)||!near(s.o.cornice.projectionMm,r.projectionMm)||!near(item.sectionWidthMm,r.projectionMm)){
  issues.push('قطاع الكورنيش '+item.sku+' لا يطابق ارتفاعه وبروزه المحددين في الرسم وعرض المقطع من المورد.');return answer;
 }
 function add(name,len,startDeg,endDeg,station){
  const out=finishBarEnds(len,item,{startDeg,endDeg,datum:'near',reference:r.reference});
  if(out.issue||out.a<=0){issues.push(name+' · '+(out.issue||'طول غير صالح'));return;}
  pieces.push({...common,...out,...(r.route?{operations:[trimOperation(r,'miter','start',startDeg),trimOperation(r,'miter','end',endDeg)]}:{}),label:name,b:null,count:1,stationMm:rnd(station),operation:'قص بمرجع الحافة الخلفية للقطاع'});
 }
 for(const [i,span] of s.spans.entries()){
  const middle=s.o.cornice.returns?'return':'square',a=i===0?choice.start:middle,b=i===s.spans.length-1?choice.end:middle;
  let from=span.startMm,to=span.endMm,fa=a==='return'?-45:0,fb=b==='return'?45:0;
  if(a==='join'){const q=joint(doc,wall,'start',span,to);if(q.error){issues.push(q.error);continue;}from=q.u;fa=q.degrees;}
  if(b==='join'){const q=joint(doc,wall,'end',span,from);if(q.error){issues.push(q.error);continue;}to=q.u;fb=q.degrees;}
  add('كورنيش واجهة '+(i+1),to-from,fa,fb,from);
  if(a==='return')add('رَدّة بداية '+(i+1),s.o.depthMm,0,45,from);
  if(b==='return')add('رَدّة نهاية '+(i+1),s.o.depthMm,-45,0,to);
 }
 return answer;
}
