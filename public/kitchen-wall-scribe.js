import {inheritedName} from './kitchen-safe-keys.js';
import {wallPairEndEvidence} from './kitchen-wall-pair.js';
// A vertical scribe strip lies in the cabinet front plane. A positive wall
// offset is towards the cabinet. Only observed endpoint-to-endpoint segments
// that were explicitly checked straight may be connected.
import {architectureWall,architectureWallIdKnown,roomArchitecture} from './kitchen-architecture.js';
import {kitchenGeometry,kitchenRunPoint,kitchenRunPolygon} from './kitchen-model.js';
import {profileDatum,parseWallXYZ} from './kitchen-wall-profile.js';
import {convexIntersection} from './kitchen-oriented.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {readWallOptions} from './kitchen-chain-options.js';
const real=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9][\w.-]{0,79}$/.test(s)&&!inheritedName(s)&&!['constructor','prototype','__proto__'].includes(s);
const ref=s=>typeof s==='string'&&s.trim()&&s.length<=160;
const rounded=x=>Math.round(x*1000)/1000;
const issue=reason=>({ok:false,reason});
const hash=value=>offlineDigest(new TextEncoder().encode(JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)));
const cross=(a,b)=>a.x*b.z-a.z*b.x;
export function cleanScribePolicies(raw,items){
 if(raw==null)return {};
 if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>48)return null;
 const out={};for(const [k,r] of Object.entries(raw)){
  if(!id(k)||!r||!ref(r.name)||!ref(r.reference)||items.get(r.sku)?.kind!=='panel'||!['vertical','horizontal'].includes(r.grain)||
   !real(r.minimumBlankMm,1,1200)||!real(r.maxStripMm,1,1200)||!real(r.roughAllowanceMm,0,100)||!real(r.minimumLipMm,.1,r.maxStripMm)||!real(r.spacingMm,1,1500)||
   !real(r.cutToleranceMm,.001,25)||!real(r.minGapMm,0,100)||!real(r.targetGapMm,r.minGapMm,100)||!real(r.maxGapMm,r.targetGapMm,100)||r.machine!=null&&!id(r.machine))return null;
  out[k]=Object.fromEntries(['name','reference','sku','grain','minimumBlankMm','maxStripMm','roughAllowanceMm','minimumLipMm','spacingMm','cutToleranceMm','minGapMm','targetGapMm','maxGapMm',...(r.machine?['machine']:[])].map(p=>[p,r[p]]));
 }return out;
}
export function cleanScribeReadings(raw){
 if(!Array.isArray(raw)||raw.length>40)return null;
 const keys=new Set(),list=[];
 for(const q of raw){
  if(!q||!id(q.unitId)||!id(q.recipe)||!architectureWallIdKnown(q.against)||!['start','end'].includes(q.side)||!['end','plinth'].includes(q.kind)||
   !Number.isFinite(q.plinthHeightMm)||!real(q.plinthHeightMm,0,400)||!real(q.insetMm,0,500)||!real(q.accuracyMm,.001,25)||!ref(q.reference)||!ref(q.reviewer)||
   q.linearVerified!==true||!Array.isArray(q.stations)||q.stations.length<2||q.stations.length>96||!q.stations.every(v=>Array.isArray(v)&&v.length===2&&real(v[0],0,6000)&&real(v[1],-600,600))||
   !/^[0-9a-f]{64}$/.test(q.anchor)||q.band!=null&&!id(q.band))return null;
  const key=[q.unitId,q.kind,q.side].join('/');if(keys.has(key))return null;keys.add(key);
  list.push({...Object.fromEntries(['unitId','recipe','against','side','kind','plinthHeightMm','insetMm','accuracyMm','reference','reviewer','linearVerified','anchor',...(q.band?['band']:[])].map(k=>[k,q[k]])),stations:q.stations.map(s=>[...s])});
 }return list;
}
export function scribeDatum(doc,wall,q,catalog,scene=null){
 const r=catalog.scribePolicies?.[q.recipe],i=catalog.items.find(i=>i.sku===r?.sku),g=scene||kitchenGeometry(doc.kitchen,doc.room),u=g.units.find(v=>v.id===q.unitId);
 const run=doc.kitchen.runs.find(v=>v.id===u?.runId),edge=architectureWall(doc.room,wall),against=architectureWall(doc.room,q.against);
 if(!r||!i||!u||!run||run.wall!==wall||run.placement==='free'||!edge||!against||wall===q.against)return issue('اختر وحدة على صف جداري مستقيم، وقطاعًا منشورًا، والجدار الذي تلامسه الحشوة.');
 const scale=q.side==='start'?-1:1,dir={x:scale*edge.tangent.x,z:scale*edge.tangent.z};
 if(-(dir.x*against.inward.x+dir.z*against.inward.z)<.999999)return issue('هذه الوصفة لحشوة طرفية عمودية على الجدار المقاس. استخدم ورقة خاصة للزاوية المائلة.');
 const depth=u.depth-q.insetMm/10,station=q.side==='start'?u.u:u.u+u.width;
 if(depth<=i.thicknessMm/10||q.kind==='end'&&(q.insetMm!==0||q.plinthHeightMm!==0))return issue('ثبت حشوة نهاية الجسم على وجهه، أو أدخل ارتداد وزرة صالحًا داخل العمق.');
 const at=kitchenRunPoint(doc.room,run,station,depth),delta={x:against.a.x-at.x,z:against.a.z-at.z};
 const gap=cross(delta,against.tangent)/cross(dir,against.tangent)*10;
 const hit={x:at.x+dir.x*gap/10,z:at.z+dir.z*gap/10},along=((hit.x-against.a.x)*against.tangent.x+(hit.z-against.a.z)*against.tangent.z)*10;
 if(gap<-.01||gap>r.maxStripMm+600||along<-.01||along>against.length*10+.01)return issue('لا يصل محور الحشوة إلى وجه الجدار المحدد ضمن القطاع القابل للتفصيل.');
 // A distant segment across a recess is never a usable reference, even if
 // its infinite line has the correct orientation.
 for(const other of roomArchitecture(doc.room).walls){
  if(other.id===against.id||other.id===edge.id)continue;
  const det=cross(dir,other.tangent);if(Math.abs(det)<1e-7)continue;
  const v={x:other.a.x-at.x,z:other.a.z-at.z},t=cross(v,other.tangent)/det,s=cross(v,dir)/det;
  if(t>.001&&10*t<gap-.01&&s>=-.001&&s<=other.length+.001)return issue('يعترض حد آخر للغرفة خط الوصول إلى الجدار المختار.');
 }
 const low=q.kind==='end'?u.bottom*10:0,span=q.kind==='end'?u.height*10:q.plinthHeightMm;
 if(!real(span,1,6000)||q.kind==='plinth'&&(run.tier!=='base'||span>(u.bottom>0?u.bottom:u.height)*10+.001))return issue('أدخل ارتفاع وزرة سفليًا مقاسًا على الطبيعة من الأرض النهائية.');
 const profile=(doc.room.workshop.wallProfiles?.bands||[]).filter(b=>b.wall===q.against);
 const band=q.band&&profile.find(b=>b.id===q.band);
 if(q.band&&(!band?.review||band.datum!==profileDatum(doc.room,q.against)||low<band.low-.001||low+span>band.high+.001))return issue('شريحة الرفع المحددة غير معتمدة أو لا تغطي ارتفاع الحشوة.');
 const floorPoly=kitchenRunPolygon(doc.room,run,scale<0?station-Math.max(0,gap)/10:station,Math.max(0,gap)/10,i.thicknessMm/10,depth-i.thicknessMm/10);
 const obstructs=v=>v.id!==u.id&&v.bottom*10<low+span-.01&&(v.bottom+v.height)*10>low+.01&&convexIntersection(floorPoly,v.polygon).length>0;
 const crossesOpening=g.features.some(v=>v.wall===q.against&&['window','door'].includes(v.kind)&&v.bottom*10<low+span&&10*(v.bottom+v.height)>low&&along+against.start*10>=v.u*10&&along+against.start*10<=(v.u+v.width)*10);
 if(crossesOpening||[...g.units,...g.features].some(obstructs))return issue('نطاق الحشوة يقطع وحدة أو فتحة أو عائقًا مرسومًا.');
 for(const peer of doc.room.workshop.options?.[wall]?.scribes||[]){
  if(peer.unitId!==q.unitId||peer.side!==q.side||peer.kind===q.kind)continue;
  const pol=catalog.scribePolicies?.[peer.recipe],material=catalog.items.find(i=>i.sku===pol?.sku);if(!material)continue;
  const otherDepth=u.depth-peer.insetMm/10,otherLow=peer.kind==='end'?u.bottom*10:0,otherTop=otherLow+(peer.kind==='end'?u.height*10:peer.plinthHeightMm);
  if(otherLow<low+span-.01&&otherTop>low+.01&&otherDepth>depth-i.thicknessMm/10+.001&&depth>otherDepth-material.thicknessMm/10+.001)return issue('تتداخل حشوتا الجسم والوزرة على الطرف نفسه. صحح منسوب الوزرة أو ارتدادها.');
 }
 const wallGeometry=[profileDatum(doc.room,wall),profileDatum(doc.room,q.against)];
 const walls=roomArchitecture(doc.room).walls,idx=walls.findIndex(w=>w.id===wall);
 const neighbour=walls[(idx+(q.side==='start'?-1:1)+walls.length)%walls.length];
 const evidence=neighbour.id===q.against&&wallPairEndEvidence(doc,wall,q.side,run.tier,low,low+span);
 if(evidence?.oblique)return issue('إزاحة الطرف في قياس الظهر والوجه تدل على زاوية مائلة. تحتاج الحشوة تفصيلًا خاصًا.');
 const anchor=hash([wallGeometry,run.id,u.id,u.u,u.width,u.bottom,u.height,u.depth,at,station,low,span,q.side,q.kind,q.insetMm,along,profile.filter(b=>b.low<low+span&&b.high>low),band||null,r,i.sku,i.thicknessMm,i.stockLengthMm,i.stockWidthMm,i.kerfMm,...(evidence?[evidence.key]:[])]);
 return {ok:true,anchor,span:rounded(span),low:rounded(low),nominal:rounded(gap),along:rounded(along),station:rounded(station*10),wall,runId:run.id,band};
}
export function exactScribeScan(doc,wall,q,catalog){
 const a=scribeDatum(doc,wall,q,catalog);if(!a.ok)return a;
 if(!a.band)return issue('اختر شريحة مسح معتمدة أولًا.');
 const w=architectureWall(doc.room,q.against),parsed=parseWallXYZ(doc.room.workshop.wallProfiles.sources[a.band.sourceId]);if(!parsed.ok)return parsed;
 const points=(parsed.groups.get(q.against)||[]).filter(([x,y,z])=>Math.abs((x-w.a.x*10)*w.tangent.x+(z-w.a.z*10)*w.tangent.z-a.along)<.001&&y>=a.low-.001&&y<=a.low+a.span+.001)
 .map(([x,y,z])=>[rounded(y-a.low),rounded((x-w.a.x*10)*w.inward.x+(z-w.a.z*10)*w.inward.z)]).sort((v,w)=>v[0]-w[0]);
 if(points.length<2)return issue('لم تُرصد نقاط على خط التماس نفسه. ارفع خطًا يدويًا، فلا يُسقط المسح المجاور عليه.');
 return {ok:true,stations:points};
}
export function scribePiece(doc,wall,q,catalog,scene){
 const a=scribeDatum(doc,wall,q,catalog,scene);if(!a.ok)return a;
 if(q.anchor!==a.anchor)return issue('تغيّر موضع الوحدة أو الجدار أو مواصفة الحشوة. أعد أخذ القراءات واعتمادها.');
 const r=catalog.scribePolicies[q.recipe],item=catalog.items.find(i=>i.sku===r.sku),pts=q.stations;
 if(!q.linearVerified||pts[0][0]!==0||Math.abs(pts.at(-1)[0]-a.span)>.001)return issue('يجب رصد أول وآخر ارتفاع وإثبات استقامة كل مقطع بين النقاط.');
 const error=r.cutToleranceMm+q.accuracyMm;
 if(r.targetGapMm-error<r.minGapMm-.000001||r.targetGapMm+error>r.maxGapMm+.000001)return issue('قد يخرج خلوص التركيب عن مجاله بعد جمع خطأ القياس وسماحة القص.');
 const widths=[];for(const [k,[s,off]] of pts.entries()){
  if(k&&(s<=pts[k-1][0]||s-pts[k-1][0]>r.spacingMm+.001))return issue('محطات الرفع مكررة أو معكوسة أو بينها مسافة غير مرصودة تزيد عن حد المصنع.');
  const w=rounded(a.nominal-off-r.targetGapMm);
  if(w-error<r.minimumLipMm-.000001||w+error>r.maxStripMm+.000001)return issue('لا تحقق الحشوة عند إحدى المحطات عرض الطرف الأدنى أو الحد المصنّع.');
  widths.push(w);
 }
 const max=Math.max(...widths),blank=Math.max(r.minimumBlankMm,rounded(max+r.cutToleranceMm+r.roughAllowanceMm+item.kerfMm)),h=a.span;
 const A=r.grain==='vertical'?h:blank,B=r.grain==='vertical'?blank:h;
 if(A>item.stockLengthMm||B>item.stockWidthMm)return issue('لا يدخل مستطيل الخام اللازم في اتجاه ألياف الصنف.');
 const projectX=x=>q.side==='start'?rounded(max-x):x,points=[[projectX(0),0],...pts.map(([s],k)=>[projectX(widths[k]),s]),[projectX(0),h]];
 const shape={points,stations:pts,widths,finishedWidthMm:max,blankWidthMm:blank,blankHeightMm:h,referenceGapMm:a.nominal,side:q.side,installedClearanceMm:r.targetGapMm,cutToleranceMm:r.cutToleranceMm,measureToleranceMm:q.accuracyMm,kerfMm:item.kerfMm,linearAllowanceMm:r.roughAllowanceMm,unitId:q.unitId,anchor:q.anchor,against:q.against,elevationMm:a.low,wallStationMm:a.station,fieldReference:q.reference,reviewer:q.reviewer};
 const label=(q.kind==='end'?'حشوة طرف جسم':'حشوة طرف وزرة')+' · '+(q.side==='start'?'بداية الصف':'نهاية الصف'),part={unitId:q.unitId,runId:a.runId,sku:r.sku,recipeId:q.recipe,family:'scribe',kind:'panel',label,count:1,a:A,b:B,scribe:shape,drawing:r.reference,operation:'قص مستطيل الخام ثم مطابقة خط الحشوة المرفوع.'};
 if(r.machine){
  const op={machine:r.machine,reference:r.reference,tolerance:r.cutToleranceMm,xFrom:'start',yFrom:'start',x:0,y:0,diameter:0,depth:0,length:0,width:0,angle:0,radius:0,minutes:null};
  part.operations=[{...op,kind:'size',length:A,width:B},{...op,kind:'scribe'}];
 }
 return {ok:true,part};
}
export function approveScribe(doc,wall,draft,cat){
 const a=scribeDatum(doc,wall,draft,cat);if(!a.ok)return a;
 const candidate={...draft,anchor:a.anchor},readings=cleanScribeReadings([candidate]);if(!readings)return issue('راجع مرجع الرفع والفني والقراءات وإقرار التحقق من الخط بين المحطات.');
 const checked=scribePiece(doc,wall,readings[0],cat);if(!checked.ok)return checked;
 const w=doc.room.workshop||{},o=readWallOptions(doc,wall),list=(o.scribes||[]).filter(q=>q.unitId!==draft.unitId||q.side!==draft.side||q.kind!==draft.kind);
 if(list.length>=40)return issue('بلغ الجدار حد الحشوات.');
 const options={...w.options,[wall]:{...o,scribes:[...list,readings[0]]}};
 return {ok:true,part:checked.part,doc:{...doc,room:{...doc.room,workshop:{...w,options}}}};
}
export function scribeDXF(p){
 if(!p?.scribe?.points?.length)throw Error('رسم الحشوة غير موجود.');
 const q=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LWPOLYLINE','5','20','100','AcDbEntity','8','FINISHED_SCRIBE','100','AcDbPolyline','90',p.scribe.points.length,'70','1'];
 for(const [x,y] of p.scribe.points)q.push('10',x,'20',y);
 return [...q,'0','ENDSEC','0','EOF',''].join('\r\n');
}
