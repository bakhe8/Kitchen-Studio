import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {deviceNames,appliancePorts,appliancePlacements} from './kitchen-device-types.js';
export {deviceNames,appliancePorts,appliancePlacements} from './kitchen-device-types.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {architectureContainsPolygon,architectureWall} from './kitchen-architecture.js';
import {optionEnvelopes} from './kitchen-chain-options.js';
// Customer-owned devices and under-sink contents consume usable space; their
// purchase is separate from the shop bill for the cabinet that contains them.
import {kitchenGeometry,kitchenRunPolygon} from './kitchen-model.js';
import {convexIntersection,polygonArea} from './kitchen-oriented.js';
const ports=['water','drain','electric','gas','vent'];
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,89}$/.test(x)&&!inheritedName(x);
const text=(x,max=200)=>typeof x==='string'&&x.length<=max;
const number=(v,min=0,max=20000)=>v===null||Number.isFinite(v)&&v>=min&&v<=max;
const axes=['width','depth','height'];
const dims=v=>record(v)&&axes.every(a=>number(v[a],1,12000));
export function cleanApplianceSchedule(raw){
 if(!record(raw)||!Array.isArray(raw.devices)||raw.devices.length>128||!Array.isArray(raw.circuits)||raw.circuits.length>64)return null;
 const devices=[],circuits=[],ids=new Set();
 for(const c of raw.circuits){if(!record(c)||!id(c.id)||ids.has(c.id)||!text(c.label,100)||!text(c.reference)||!number(c.allowedW,1,1e6))return null;if(c.outlets!==undefined&&(!Array.isArray(c.outlets)||c.outlets.length>128||c.outlets.some(o=>!id(o))||new Set(c.outlets).size!==c.outlets.length))return null;
  if((c.outlets||[]).some(o=>circuits.some(x=>x.outlets?.includes(o))))return null;
  ids.add(c.id);circuits.push({id:c.id,label:c.label,reference:c.reference,allowedW:c.allowedW,...(c.outlets?{outlets:[...c.outlets]}:{})});}
 for(const d of raw.devices){
  if(!record(d)||!id(d.id)||ids.has(d.id)||!id(d.host)||!ownKey(deviceNames,d.kind)||!appliancePlacements[d.kind].includes(d.placement)||
   !['name','model','manual','siteRef'].every(k=>text(d[k]))||!dims(d.required)||!dims(d.measured)||!Array.isArray(d.offset)||d.offset.length!==3||!d.offset.every(x=>number(x))||
   !number(d.frontMm)||!number(d.watts,0,1e6)||!['same','mixed','unknown'].includes(d.bearing)||!(d.circuit===''||id(d.circuit))||
   !record(d.connections)||Object.entries(d.connections).some(([p,v])=>!ports.includes(p)||!record(v)||!(v.id===''||id(v.id))||!number(v.pathMm,1,100000)||!number(v.maxMm,1,100000)))return null;
  const power=d.power??(appliancePorts[d.kind].includes('electric')||d.connections.electric?'electric':'unknown');
  if(!['electric','passive','unknown'].includes(power)||appliancePorts[d.kind].includes('electric')&&power!=='electric'||power==='passive'&&(d.connections.electric||d.circuit||d.watts>0))return null;
  if(d.proof!=null&&!/^a-[0-9a-f]{64}$/.test(d.proof))return null;
  ids.add(d.id);devices.push({...(d.proof?{proof:d.proof}:{}),power,id:d.id,host:d.host,kind:d.kind,placement:d.placement,name:d.name,model:d.model,manual:d.manual,siteRef:d.siteRef,
   required:{...d.required},measured:{...d.measured},offset:[...d.offset],frontMm:d.frontMm,watts:d.watts,circuit:d.circuit,bearing:d.bearing,connections:Object.fromEntries(Object.entries(d.connections).map(([p,v])=>[p,{id:v.id,pathMm:v.pathMm,maxMm:v.maxMm}]))});
 }
 return {devices,circuits};
}
const hit=(a,b)=>Math.min(a.bottom+a.height,b.bottom+b.height)-Math.max(a.bottom,b.bottom)>1e-5&&Math.abs(polygonArea(convexIntersection(a.polygon,b.polygon)))>.00001;
export function applianceFitKey(doc,d){
 const unit=doc.kitchen.units.find(u=>u.id===d.host),run=unit&&doc.kitchen.runs.find(r=>r.id===unit.runId);
 if(!unit||!run)return '';
 const wall=run.wall&&architectureWall(doc.room,run.wall),refs=Object.values(d.connections).map(p=>p.id);
 const f=doc.kitchen.features.filter(x=>refs.includes(x.id)||x.wall===run.wall&&x.u<unit.u+unit.width&&x.u+x.width>unit.u).map(x=>[x.id,x.kind,x.u,x.width,x.bottom,x.height,x.depth]).sort((a,b)=>a[0].localeCompare(b[0]));
 const site=[wall?[wall.a,wall.b]:[run.x,run.z,run.angle],run.bottom,run.depth,run.height,unit.id,unit.kind,unit.u,unit.width,unit.interior,unit.detail,f,doc.room.workshop?.options?.[run.wall]?.profiles];
 const dims=o=>axes.map(k=>o[k]),ports=Object.keys(d.connections).sort().map(k=>[k,d.connections[k].id,d.connections[k].pathMm,d.connections[k].maxMm]);
 const evidence=[d.kind,d.placement,d.model,d.manual,d.siteRef,dims(d.measured),dims(d.required),d.offset,d.frontMm,d.bearing,ports];
 return 'a-'+offlineDigest(new TextEncoder().encode(JSON.stringify([site,evidence])));
}
export function evaluateApplianceFit(doc,scope){
 const schedule=doc.room.workshop?.applianceFit||{devices:[],circuits:[]},issues=new Set(),placements=[],loads=new Map(),deviceResults=[];
 const envelopes=optionEnvelopes(doc);
 const g=kitchenGeometry({...doc.kitchen,features:[...doc.kitchen.features,...envelopes]},doc.room),selected=scope?new Set(scope.unitIds):null;
 for(const d of schedule.devices){
  const u=g.units.find(u=>u.id===d.host),on=!selected||selected.has(d.host);
  const warn=s=>{if(on)issues.add((d.name||deviceNames[d.kind])+' · '+s);};
  const own=new Set([...appliancePorts[d.kind],...Object.keys(d.connections)]);
  const power=d.power??(own.has('electric')?'electric':'unknown');
  if(power==='electric')own.add('electric');else if(power==='unknown')warn('حدّد هل يستخدم هذا العنصر الكهرباء أو يعمل دونها.');
  if(own.has('electric')){
   const c=schedule.circuits.find(c=>c.id===d.circuit);
   if(!c||!c.reference.trim()||c.allowedW===null||d.watts===null||d.watts<=0)warn('يلزم حمل الجهاز الموجب والقدرة المتاحة الموثقة لدائرته.');
   if(c){
    if(!c.outlets?.includes(d.connections.electric?.id))warn('لم تُربط نقطة كهرباء الجهاز بهذه الدائرة في جدول الدوائر.');
    const load=loads.get(c.id)||{id:c.id,label:c.label,allowedW:c.allowedW,watts:0,known:true,selected:false};
    load.selected||=on;load.known&&=d.watts!==null&&d.watts>0;load.watts+=d.watts||0;loads.set(c.id,load);
   }
  }
  if(!d.proof||d.proof!==applianceFitKey(doc,d))warn('تحتاج القياسات الصافية لهذا الجهاز وموضعه الحالي إلى تأكيد فني.');
  if(!u){warn('الوحدة المرجعية لم تعد في الرسم.');continue;}
  const run=g.runs.find(r=>r.id===u.runId);
  if(d.placement==='counter'&&!g.worktops.some(t=>t.runId===u.runId&&t.start<=u.u&&t.end>=u.u+u.width))warn('لا يوجد سطح مستمر فوق الوحدة.');
  if(d.kind==='underSink'&&u.kind!=='sink')warn('اختر جسم المجلى لمطابقة المحتوى مع الحوض والصرف.');
  if(d.placement==='bay'&&u.kind!=='open-shelf'&&!(u.modelSpec&&({microwave:['microwave'],washer:['laundry-bay'],dryer:['laundry-bay'],oven:['oven','oven-tower'],dishwasher:['dishwasher'],fridge:['fridge'],freezer:['freezer'],hob:['hob'],hood:['hood']}[d.kind]||[]).includes(u.kind)))warn('طابق فتحة جهاز مفتوحة ومخصصة لهذا الاستخدام. الوحدة الحالية مغلقة أو مشغولة بجهاز آخر.');
  if(d.placement==='inside'&&u.kind==='drawers')warn('التجهيز داخل درج متحرك يحتاج تحقق حمولة ومقاس الدرج من وصفة المصنع.');
  if(d.placement==='inside'&&['dishwasher','fridge','freezer','oven','hob','hood','oven-tower','microwave','laundry-bay'].includes(u.kind))warn('الموضع الداخلي مشغول أصلًا بجهاز المطبخ.');
  if(d.placement==='counter'&&['sink','hob'].includes(u.kind)&&!u.cutout)warn('يلزم تحديد الفتحة الفعلية قبل اعتماد سطح الجهاز.');
  if(!d.model.trim()||!d.manual.trim()||!d.siteRef.trim())warn('رقم الموديل أو مرجع المقاسات أو مرجع القياس الصافي غير مكتمل.');
  if(d.placement==='bay'&&run.tier!=='upper'&&!['hood','hob'].includes(d.kind)&&d.bearing!=='same')warn('ارتكاز الجهاز غير مؤكد على مستوى واحد.');
  if(d.offset.some(x=>x===null)||d.frontMm===null)warn('موضع الجهاز أو بروز فتحه غير مقاس (أدخل صفرًا عند انطباقه).');
  const top=g.worktops.find(t=>t.runId===run.id&&t.start<=u.u&&t.end>=u.u+u.width);
  const base=d.placement==='counter'&&top?top.bottom+top.height:u.bottom;
  const limit={width:u.width*10,depth:u.depth*10,height:d.placement==='counter'?(doc.room.height-base)*10:u.height*10};
  const margins={};
  for(const [i,a] of axes.entries()){
   if(d.required[a]===null||d.measured[a]===null||d.offset[i]===null){warn('تنقص أبعاد فتحة التركيب الموثقة أو القياسات الصافية.');margins[a]=null;continue;}
   margins[a]=Math.round((Math.min(limit[a],d.measured[a])-d.offset[i]-d.required[a])*100)/100;
   if(margins[a]<0)warn('عجز في '+({width:'العرض',depth:'العمق',height:'الارتفاع'})[a]+' '+(-margins[a])+' مم.');
  }
  if(d.offset.every(x=>x!==null)&&axes.every(a=>d.required[a]!==null)){
   const [x,z,y]=d.offset,body={polygon:kitchenRunPolygon(doc.room,run,u.u+x/10,d.required.width/10,d.required.depth/10,z/10),bottom:base+y/10,height:d.required.height/10};
   const swing=d.frontMm>0?{...body,polygon:kitchenRunPolygon(doc.room,run,u.u+x/10,d.required.width/10,d.frontMm/10,(z+d.required.depth)/10)}:null;
   if(!architectureContainsPolygon(doc.room,body.polygon)||swing&&!architectureContainsPolygon(doc.room,swing.polygon))warn('يتجاوز حيز الجهاز أو حركته حدود الغرفة.');
   if(d.placement!=='counter'){
    const planes=(detail,n,total)=>Array.isArray(detail)?detail.filter(Number.isFinite).map(x=>total*x):Array.from({length:n||0},(_,i)=>(i+1)*total/((n||0)+1));
    const crosses=(lo,length,p)=>lo<p-1e-6&&lo+length>p+1e-6;
    if(planes(u.detail?.rows,u.interior?.shelves,u.height*10).some(p=>crosses(y,d.required.height,p))||
      planes(u.detail?.cols,u.interior?.dividers,u.width*10).some(p=>crosses(x,d.required.width,p)))warn('يمر حيز الجهاز عبر رف أو قاطع مرسوم داخل الوحدة. عدّل التقسيم أو مكان التركيب.');
   }
   for(const feature of g.features.filter(f=>['window','door','shaft','heater','beam','column'].includes(f.kind)))if(hit(body,feature)||swing&&hit(swing,feature))warn('يتداخل حيز الجهاز أو فتحه مع '+(feature.label||feature.id)+'.');
   for(const peer of placements)if((on||peer.on)&&(hit(body,peer.body)||peer.swing&&hit(body,peer.swing)||swing&&hit(swing,peer.body)))issues.add('يتعارض حيز الجهازين '+(d.name||deviceNames[d.kind])+' و'+peer.name+' عند التركيب أو الفتح.');
   for(const other of g.units)if(other.id!==u.id&&(hit(body,other)||swing&&hit(swing,other)))warn('يتداخل الجهاز أو حيز فتحه مع الوحدة '+other.id+'.');
   if(d.placement==='counter'&&top?.holes.some(h=>Math.abs(polygonArea(convexIntersection(body.polygon,h.polygon)))>.00001))warn('يتداخل الجهاز مع فتحة حوض أو موقد في السطح.');
   placements.push({body,swing,name:d.name||deviceNames[d.kind],on});
  }
  for(const kind of own){const c=d.connections[kind],f=c&&g.features.find(f=>f.id===c.id&&f.kind===kind);
   if(!f||c.pathMm===null||c.maxMm===null){warn('يلزم مخرج خدمة ومسار مقاس وحد الموديل لخدمة '+portLabel[kind]+'.');continue;}
   if(c.pathMm>c.maxMm)warn('طول توصيل '+portLabel[kind]+' يتجاوز الحد الموثق بـ '+(c.pathMm-c.maxMm)+' مم.');
   if(d.offset[0]!=null&&d.offset[1]!=null){
    const pt=bodyCenter(doc,run,u,d,base),v=f.polygon;
    const fx=v.reduce((a,p)=>a+p.x,0)/v.length,fz=v.reduce((a,p)=>a+p.z,0)/v.length;
    // A routed connection must at least reach the nearest edge of its device envelope.
    const dx=Math.max(0,Math.hypot(fx-pt.x,fz-pt.z)*10-Math.hypot(d.required.width||0,d.required.depth||0)/2-Math.hypot(f.width,f.depth)*5);
    const lo=(base*10)+(d.offset[2]||0),hi=lo+(d.required.height||0),fy=f.bottom*10,dy=Math.max(0,lo-fy-f.height*10,fy-hi);
    if(c.pathMm+1<Math.hypot(dx,dy))warn('المسار المسجل أقصر من الفاصل الهندسي الأدنى إلى المخرج.');
   }
  }
  deviceResults.push({id:d.id,host:d.host,margins});
 }
 for(const c of loads.values())if(c.selected){if(!c.known||c.allowedW===null)issues.add('لا يمكن تأكيد الحمل المجمع لدائرة '+c.label+'.');
  else if(c.watts>c.allowedW)issues.add('الأحمال المسجلة على دائرة '+c.label+' تزيد عن القدرة المتاحة الموثّقة بمقدار '+(c.watts-c.allowedW)+' واط.');}
 return {issues:[...issues],deviceResults,loads:[...loads.values()]};
}
function bodyCenter(doc,run,u,d,base){const p=kitchenRunPolygon(doc.room,run,u.u+(d.offset[0]||0)/10,(d.required.width||1)/10,(d.required.depth||1)/10,(d.offset[1]||0)/10);return {x:p.reduce((s,v)=>s+v.x,0)/4,z:p.reduce((s,v)=>s+v.z,0)/4};}
export const portLabel={electric:'كهرباء',water:'ماء',drain:'صرف',gas:'غاز',vent:'تهوية'};
