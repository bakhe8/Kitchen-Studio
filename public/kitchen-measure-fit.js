import {inheritedName} from './kitchen-safe-keys.js';
// Conservative dimensional checks. Each independent reading carries its own
// instrument bound. An interval that straddles a limit is not a pass.
import {offlineDigest} from './kitchen-workshop-revision.js';
import {kitchenGeometry,kitchenRunPoint} from './kitchen-model.js';
import {architectureWall} from './kitchen-architecture.js';
import {convertAssistUnit} from './kitchen-measurement-identity.js';
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9][\w-]{0,80}$/.test(s)&&!inheritedName(s);
const ref=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
const num=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const round=n=>Math.round(n*10000)/10000;
const stages=['width','depth','height','closure'];
export function cleanMeasureFit(raw){
 if(!raw||!Array.isArray(raw.instruments)||!Array.isArray(raw.checks)||raw.instruments.length>48||raw.checks.length>150)return null;
 const out={instruments:[],checks:[]},ids=new Set();
 for(const i of raw.instruments){
  if(!i||!key(i.id)||ids.has(i.id)||!ref(i.label)||!ref(i.spec)||!num(i.fixedMm,0,100)||!num(i.perMetreMm,0,20))return null;
  ids.add(i.id);out.instruments.push({id:i.id,label:i.label.trim(),spec:i.spec.trim(),fixedMm:i.fixedMm,perMetreMm:i.perMetreMm});
 }
 for(const c of raw.checks){
  if(!c||!key(c.id)||ids.has(c.id)||!key(c.target)||!stages.includes(c.axis)||!ref(c.reference)||(c.anchor!==undefined&&!/^[a-f0-9]{64}$/.test(c.anchor))||!num(c.toleranceMm,0,100)||!num(c.allowanceMm,0,1000)||!Array.isArray(c.readings)||c.readings.length<1||c.readings.length>96||c.axis==='closure'&&!key(c.chainInstrument))return null;
  ids.add(c.id);const readings=[];
  for(const r of c.readings){
   if(!r||!ref(r.station)||!key(r.instrument)||!out.instruments.some(i=>i.id===r.instrument)||(!r.recordId&&!num(r.mm,0,30000))||(r.recordId&&!key(r.recordId)))return null;
   readings.push({station:r.station.trim(),instrument:r.instrument,...(r.recordId?{recordId:r.recordId}:{mm:r.mm})});
  }
  if(c.axis==='closure'&&!out.instruments.some(i=>i.id===c.chainInstrument))return null;
  out.checks.push({id:c.id,axis:c.axis,target:c.target,reference:c.reference.trim(),toleranceMm:c.toleranceMm,allowanceMm:c.allowanceMm,readings,...(c.anchor?{anchor:c.anchor}:{}),...(c.axis==='closure'?{chainInstrument:c.chainInstrument}:{})});
 }
 return out;
}
function band(n,i){const error=i.fixedMm+i.perMetreMm*n/1000;return [n-error,n+error];}
function measuredRange(doc,reading,instruments){
 const i=instruments.find(v=>v.id===reading.instrument);if(!i)return null;
 const r=reading.recordId&&doc.room.fieldRegister?.records?.find(v=>v.id===reading.recordId);
 if(reading.recordId&&(!r||r.valueType!=='number'||!['measured','documented'].includes(r.verification)||r.execution==='excluded'))return null;
 const value=r?convertAssistUnit(r.value,r.unit,'مم'):reading.mm;
 return num(value,0,30000)?band(value,i):null;
}
// A fit reading belongs to its opening. Resizing the same unit recalculates
// the available margin. Moving it to a different opening needs a new reading.
function measurementAnchor(doc,c){
 let points;
 if(c.axis==='closure'){
   const wall=architectureWall(doc.room,c.target);if(!wall)return null;
   const r={wall:c.target};points=[kitchenRunPoint(doc.room,r,wall.start,0),kitchenRunPoint(doc.room,r,wall.end,0)];
 }else{
   const unit=doc.kitchen.units.find(u=>u.id===c.target),run=unit&&doc.kitchen.runs.find(r=>r.id===unit.runId);
   if(!run)return null;
   points=[run.id,run.wall,run.bottom,kitchenRunPoint(doc.room,run,unit.u,0),kitchenRunPoint(doc.room,run,unit.u+1,0)];
 }
 return offlineDigest(new TextEncoder().encode(JSON.stringify([c.target,c.axis,points])));
}
export function bindMeasureCheck(doc,check){const anchor=measurementAnchor(doc,check);return anchor?{...check,anchor}:null;}
export function evaluateMeasureFit(doc,scope){
 const raw=doc.room.workshop?.measureFit;if(!raw)return {results:[],issues:[]};
 const results=[],issues=[],geometry=kitchenGeometry(doc.kitchen,doc.room);
 for(const c of raw.checks){
  const wall=c.axis==='closure',u=geometry.units.find(x=>x.id===c.target);
  if(scope&&!(wall?scope.walls:scope.unitIds).includes(c.target))continue;
  const fail=why=>{issues.push(c.reference+' · '+why);results.push({id:c.id,status:'hold',why});};
  if(!c.anchor||c.anchor!==measurementAnchor(doc,c)){fail('موضع الفحص الحالي لا يطابق مرجع الرفع. اربط قراءة الموقع بالموضع الحالي.');continue;}
  const stations=new Map();let unknown=false;
  for(const r of c.readings){
   const bounds=measuredRange(doc,r,raw.instruments);if(!bounds){unknown=true;break;}
   const old=stations.get(r.station);stations.set(r.station,old?[Math.max(old[0],bounds[0]),Math.min(old[1],bounds[1])]:bounds);
  }
  if(unknown){fail('قراءة المصدر أو مواصفة أداة القياس غير مؤكدة.');continue;}
  if([...stations.values()].some(([lo,hi])=>lo>hi+1e-7)){fail('القراءات المتكررة للموضع نفسه متعارضة حتى بعد احتساب دقة الأدوات.');continue;}
  if(wall){
   const chain=doc.room.workshop?.chains?.[c.target],tool=raw.instruments.find(i=>i.id===c.chainInstrument),edge=architectureWall(doc.room,c.target);
   if(!tool||!edge||chain?.rows?.at(-1)?.kind!=='corner'){fail('تحتاج مراجعة الإغلاق إلى سلسلة كاملة تنتهي عند الركن.');continue;}
   if(chain.rows.some(r=>r.frameRead?.method==='opposite')){fail('أحد عروض البراويز مشتق من طول الجدار نفسه. يلزم قياس مستقل لذلك العرض أو للطرف البعيد من ركن البداية قبل تدقيق إغلاق السلسلة.');continue;}
   let length=0,error=0;
   // Zero-offset semantic markers and anchors do not add a new physical length.
   for(const r of chain.rows){
    if(r.frameRead?.method==='station'){
     length=r.frameRead.distanceMm;error=band(length,tool)[1]-length;continue;
    }
    if(r.from==='origin'){length=0;error=0;}
    for(const n of [r.gapMm,...(['start','stop','corner','water','drain','vent','gas','electric'].includes(r.kind)?[]:[r.widthMm])]){
     if(n===0)continue;length+=n;error+=band(n,tool)[1]-n;
    }
   }
   const min=Math.max(...[...stations.values()].map(a=>a[0])),max=Math.min(...[...stations.values()].map(a=>a[1]));
   if(min>max){fail('راجع قراءات الطول المستقلة للجدار نفسه.');continue;}
   const worst=round(Math.max(Math.abs(length-error-max),Math.abs(length+error-min)));
   results.push({id:c.id,status:worst<=c.toleranceMm?'ok':'hold',lengthMm:length,worstMm:worst,toleranceMm:c.toleranceMm});
   if(worst>c.toleranceMm)issues.push(c.reference+' · أقصى فرق إغلاق محتمل '+worst+' مم مقابل السماح '+c.toleranceMm+' مم.');continue;
  }
  if(!u){fail('الوحدة المرتبطة بالقياس لم تعد موجودة.');continue;}
  const nominal=10*u[c.axis],needed=nominal+c.toleranceMm+c.allowanceMm;
  const lo=Math.min(...[...stations.values()].map(a=>a[0])),hi=Math.min(...[...stations.values()].map(a=>a[1]));
  const status=lo+1e-7>=needed?'ok':hi<needed?'short':'hold';
  results.push({id:c.id,status,nominalMm:round(nominal),neededMm:round(needed),availableMin:round(lo),availableMax:round(hi),marginMm:round(lo-needed)});
  if(status!=='ok')issues.push(c.reference+' · '+(status==='short'?'الفتحة أضيق من المطلوب.':'الدقة المسجّلة لا تحسم الملاءمة.')+' المتاح المضمون '+round(lo)+' مم، والمطلوب '+round(needed)+' مم.');
 }
 return {results,issues};
}
