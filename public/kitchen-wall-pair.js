// Two parallel, full-wall widths measured at the same elevation. Offsets are
// signed along the elevation's start → end axis, not the viewer's screen.
// Raw readings survive import and invalidation. Derived fits are never stored.
import {architectureWall,architectureWallIdKnown,architectureWallLocal,architectureWallPoint,architectureContainsPolygon,roomArchitecture} from './kitchen-architecture.js';
import {parseWallXYZ,profileDatum,fitWallBand} from './kitchen-wall-scan.js';
import {offlineDigest} from './kitchen-workshop-revision.js';

const within=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const round=n=>Math.round(n*1e6)/1e6;
const closureMm=.5; // Same field closure comparison as resolveChain. Not a fit allowance.
const status=(state,reason,values={})=>({status:state,reason,source:null,differenceMm:null,startOffsetMm:null,endOffsetMm:null,startMm:null,endMm:null,clearMm:null,...values});

function cleanRecord(v){
 if(!object(v)||!within(v.backMm,1,18000)||!within(v.frontMm,1,18000)||!within(v.depthMm,1,12000)||!within(v.heightMm,0,6000)||
    typeof v.datum!=='string'||!/^wp-[0-9a-f]{64}$/.test(v.datum)||
    (v.errorMm!==undefined&&!within(v.errorMm,0,100)))return null;
 const r={backMm:v.backMm,frontMm:v.frontMm,depthMm:v.depthMm,heightMm:v.heightMm,datum:v.datum};
 if(v.errorMm!==undefined)r.errorMm=v.errorMm;
 if(v.anchor!==undefined){
  if(!object(v.anchor)||!['start','end'].includes(v.anchor.side)||!within(v.anchor.offsetMm,-18000,18000))return null;
  r.anchor={side:v.anchor.side,offsetMm:v.anchor.offsetMm};
 }
 return r;
}
export function cleanWallPairs(raw){
 if(!object(raw)||Object.keys(raw).length>32)return null;
 const out={};
 for(const [wall,tiers] of Object.entries(raw)){
  if(!architectureWallIdKnown(wall)||!object(tiers)||!Object.keys(tiers).length)return null;
  const picks={};
  for(const [tier,r] of Object.entries(tiers)){
   if(!['base','upper'].includes(tier))return null;
   const v=cleanRecord(r);if(!v)return null;
   picks[tier]=v;
  }
  out[wall]=picks;
 }
 return out;
}
export function wallPairDatum(doc,wall){
 const room=doc?.room,edge=room&&architectureWall(room,wall);if(!edge)return '';
 const walls=roomArchitecture(room).walls,i=walls.findIndex(w=>w.id===wall);
 const prev=walls[(i+walls.length-1)%walls.length],next=walls[(i+1)%walls.length];
 const frame=[edge.id,edge.a,edge.b,edge.start,edge.end,prev.id,prev.a,next.id,next.b,room.height,room.architecture?.outline?.reference||null];
 return 'wp-'+offlineDigest(new TextEncoder().encode(JSON.stringify(frame)));
}
function outlineOffsets(room,edge,depthMm){
 const arch=roomArchitecture(room);
 // A stock rectangle and architectural presets are drawings, not field evidence.
 if(!arch.measured||!room.architecture?.outline?.reference)return {};
 const i=arch.walls.findIndex(w=>w.id===edge.id),n=arch.walls.length;
 function atDepth(point,backStation){
  const p=architectureWallLocal(room,edge.id,point);
  // Use the measured segment, never the extrapolated infinite line past a return.
  if(p.d<=0||depthMm>p.d*10+.000001)return undefined;
  return (p.u-backStation)*depthMm/p.d;
 }
 return {start:atDepth(arch.walls[(i+n-1)%n].a,edge.start),end:atDepth(arch.walls[(i+1)%n].b,edge.end)};
}
// A field-measured side can also come from an existing signed, straight
// return scan, even when the room started as a plain rectangle. A wall-length
// attestation or a nominal right angle alone says nothing about its plumb.
function scannedSquareEnds(doc,edge,r){
 const room=doc.room,store=room.workshop?.wallProfiles,ends={};
 if(!store?.bands?.length)return ends;
 const walls=roomArchitecture(room).walls,i=walls.findIndex(w=>w.id===edge.id),n=walls.length;
 for(const [side,adjacent] of [['start',walls[(i+n-1)%n]],['end',walls[(i+1)%n]]]){
  if(Math.abs(edge.tangent.x*adjacent.tangent.x+edge.tangent.z*adjacent.tangent.z)>1e-7)continue;
  const station=(side==='start'?edge.start:edge.end)*10;
  for(const band of store.bands){
   if(band.wall!==adjacent.id||band.review?.boundMm!==0||band.low>r.heightMm||band.high<r.heightMm||band.datum!==profileDatum(room,adjacent.id))continue;
   const raw=store.sources?.[band.sourceId],scan=parseWallXYZ(raw);if(!scan.ok)continue;
   const fit=fitWallBand(doc,raw,band);if(!fit.ok||!fit.bandOK||fit.peakMm>0)continue;
   const depths=(scan.groups.get(adjacent.id)||[]).flatMap(([x,h,z])=>{
    if(Math.abs(h-r.heightMm)>.00001)return [];
    const pos=architectureWallLocal(room,edge.id,{x:x/10,z:z/10});
    return Math.abs(pos.u*10-station)<=.00001?[pos.d*10]:[];
   });
   if(depths.some(d=>Math.abs(d)<.00001)&&depths.some(d=>Math.abs(d-r.depthMm)<.00001)){ends[side]=0;break;}
  }
 }
 return ends;
}
export function evaluateWallPair(doc,wall,raw){
 const r=cleanRecord(raw),room=doc?.room,edge=room&&architectureWall(room,wall);
 if(!r||!edge)return status('invalid','أدخل طولي الظهر والوجه وعمق القياس ومنسوبه لهذا الجدار.');
 const diff=round(r.frontMm-r.backMm),e=r.errorMm??0;
 const v={differenceMm:diff,frontTrend:Math.abs(diff)<=2*e?'level-or-within-error':diff>0?'widening':'narrowing'};
 if(r.datum!==wallPairDatum(doc,wall))return status('stale','تغيّر مرجع الجدار أو أحد طرفيه منذ هذا القياس. راجع موضعي شريط القياس.',v);
 if(r.heightMm>room.height*10)return status('invalid','منسوب القياس أعلى من سقف الغرفة.',v);
 if(Math.abs(r.backMm-edge.length*10)>closureMm+e)return status('conflict','عرض الظهر المقاس لا يطابق المسافة بين ركني الجدار في الرسم. راجع طول الجدار أو طرفي القياس.',v);
 const outline=outlineOffsets(room,edge,r.depthMm),scan=scannedSquareEnds(doc,edge,r);
 const geom={...outline,...scan};
 const refs={...geom};
 if(r.anchor){
  const {side,offsetMm}=r.anchor;
  if(geom[side]!==undefined&&Math.abs(geom[side]-offsetMm)>closureMm+e)return status('conflict','إزاحة الطرف المقاسة تتعارض مع موضع هذا الطرف في المحيط المرفوع. راجع المرجع.',v);
  refs[side]=offsetMm;
 }
 const hasStart=refs.start!==undefined,hasEnd=refs.end!==undefined;
 if(!hasStart&&!hasEnd)return status('unlocated','يُعرف فرق العرض. عند الحاجة إلى موضع الصف أو تفصيل طرفه، قِس إزاحة طرف واحد عن خط عمودي من ركن الظهر.',v);
 if(hasStart&&hasEnd&&Math.abs(refs.end-refs.start-diff)>closureMm+2*e)return status('conflict','فرق الظهر والوجه لا يطابق موضعي الطرفين في الرفع. راجع العمق والمنسوب والمرجع قبل التطبيق.',v);
 const fromStart=r.anchor?r.anchor.side==='start':hasStart;
 const a=fromStart?refs.start:refs.end-diff,b=fromStart?refs.start+diff:refs.end;
 // Within closure tolerance, keep the more restrictive of the independent
 // readings and the measured polygon, never round outward into a wall.
 const base=edge.start*10,frontStart=geom.start??-Infinity,frontEnd=edge.length*10+(geom.end??Infinity);
 const rearEnd=Math.min(r.backMm,edge.length*10),nominalStart=base+Math.max(0,a,frontStart);
 const nominalEnd=base+Math.min(rearEnd,r.backMm+b,frontEnd);
 // r.errorMm is an optional common upper bound on each independent width
 // and the signed offset. Intersect conservative bounds before applying
 // the factory's separate installation allowance downstream.
 const leftFrontMax=a+(fromStart?e:3*e);
 const rightFrontMin=r.backMm+b-2*e;
 const start=base+Math.max(0,leftFrontMax,frontStart),end=base+Math.min(r.backMm-e,edge.length*10,rightFrontMin,frontEnd);
 if(start>=end-.000001)return status('invalid','لا يبقى عرض مشترك صالح لصف مستقيم بين خطَّي القياس.',v);
 const interior=architectureContainsPolygon(room,[[start,0],[end,0],[end,r.depthMm],[start,r.depthMm]].map(([s,d])=>architectureWallPoint(room,wall,s/10,d/10)));
 if(!interior)return status('conflict','يمر عمق القياس خارج المحيط الحالي أو عبر ردّة في الجدار. راجع حدود المساحة المرفوعة.',v);
 return status('resolved','حُسب تقاطع عرض الظهر والوجه قبل خلوص التركيب.',{...v,source:r.anchor?'field':scan[fromStart?'start':'end']!==undefined?'scan':'outline',
  startOffsetMm:round(a),endOffsetMm:round(b),startMm:round(start),endMm:round(end),clearMm:round(end-start),
  nominalClearMm:round(nominalEnd-nominalStart)});
}

// Include a dependency only for the end and elevation the operation uses.
// A proven fixed end remains independent of movement at the far end.
export function wallPairEndEvidence(doc,wall,side,tier,lowMm,highMm){
 const pair=doc.room.workshop?.wallPairs?.[wall]?.[tier];
 if(!pair||pair.heightMm<lowMm-.00001||pair.heightMm>highMm+.00001)return null;
 const r=evaluateWallPair(doc,wall,pair);
 const offset=side==='start'?r.startOffsetMm:r.endOffsetMm;
 if(r.status==='resolved'&&Math.abs(offset)<.00001&&!pair.errorMm)return null;
 const key=[wall,side,tier,pair.depthMm,pair.heightMm,pair.datum,r.status,
  ...(r.status==='resolved'?[offset,pair.errorMm??0]:[pair.backMm,pair.frontMm,pair.anchor?.side??null,pair.anchor?.offsetMm??null,pair.errorMm??0])];
 return {key,status:r.status,offset,oblique:r.status==='resolved'&&Math.abs(offset)>3*(pair.errorMm??0)+.00001,
  boundary:side==='start'?r.startMm:r.endMm};
}

export function wallPairTopEvidence(doc,top){
 const records=doc.room.workshop?.wallPairs;
 if(!records)return [];
 const run=doc.kitchen.runs.find(r=>r.id===top.runId),keys=[];
 if(!run)return keys;
 for(const wall of Object.keys(records).sort()){
  const edge=architectureWall(doc.room,wall);if(!edge)continue;
  const stations=top.polygon.map(p=>architectureWallLocal(doc.room,wall,p)).filter(p=>Math.abs(p.d)<.00001).map(p=>p.u*10);
  if(stations.length<2||Math.max(...stations)-Math.min(...stations)<.00001)continue;
  for(const side of ['start','end']){
   const first=side==='start',e=wallPairEndEvidence(doc,wall,side,'base',(run.bottom??0)*10,(top.bottom+top.height)*10);
   if(!e)continue;
   const limit=e.boundary??(first?edge.start:edge.end)*10;
   if(first?Math.min(...stations)<=limit+.00001:Math.max(...stations)>=limit-.00001)keys.push(e.key);
  }
 }
 return keys;
}
