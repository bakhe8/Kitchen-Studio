import {cleanPartOperations} from './kitchen-machining.js';
// A special sheet belongs to one actual project element. Its exact dimensions,
// reviewed material section and drawing reference cannot transfer as a template.
import {offlineDigest} from './kitchen-workshop-revision.js';
import {wallOptionTakeoff} from './kitchen-chain-options.js';
import {checkCornerPlacement} from './kitchen-production-row-corners.js';
const deviceKinds=new Set(['dishwasher','fridge','freezer','oven','oven-tower','hob','hood','microwave']);
const ref=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const positive=n=>Number.isFinite(n)&&n>0&&n<=100000;
const fingerprint=data=>offlineDigest(new TextEncoder().encode(JSON.stringify(data,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v)));
const materialKey=item=>fingerprint([item.kind,item.role,item.color,item.thicknessMm]);
export function cleanSpecialSheets(given,items){
 if(given==null)return {};
 if(typeof given!=='object'||Array.isArray(given)||Object.keys(given).length>256)return null;
 const by=new Map(items.map(i=>[i.sku,i])),result={};
 for(const [id,s] of Object.entries(given)){
  if(!/^(corner|wall|inside|unit):[\w:+.-]{1,180}$/.test(id)||!s||!ref(s.reviewer,85)||!ref(s.measurement,180)||!ref(s.drawing,180)||!ref(s.instructions,500)||!/^\w{64}$/.test(s.signature)||!Array.isArray(s.lines)||(!s.lines.length&&!s.bay)||s.lines.length>70||s.bay&&(!s.fit||s.lines.length))return null;
  const lines=[];
  for(const l of s.lines){
   const material=by.get(l?.sku);
   if(!material||!ref(l.label,85)||!ref(l.operation,180)||!Number.isInteger(l.count)||l.count<1||l.count>1000||!/^\w{64}$/.test(l.materialKey))return null;
   if(material.kind!=='piece'&&!positive(l.a)||material.kind==='panel'&&!positive(l.b))return null;
   const ops=cleanPartOperations(l.operations);if(ops===null||ops?.length&&material.kind==='piece')return null;
   lines.push({...(ops?.length?{operations:ops}:{}),sku:l.sku,label:l.label.trim(),count:l.count,a:material.kind==='piece'?null:l.a,b:material.kind==='panel'?l.b:null,operation:l.operation.trim(),materialKey:l.materialKey});
  }
  let fit=null;
  if(s.fit!=null){
   if(!ref(s.fit.model,180)||!ref(s.fit.manual,180)||['width','depth','height'].some(d=>!positive(s.fit.required?.[d])||!positive(s.fit.available?.[d])))return null;
   fit={model:s.fit.model.trim(),manual:s.fit.manual.trim(),required:{},available:{}};
   for(const axis of ['width','depth','height']){fit.required[axis]=s.fit.required[axis];fit.available[axis]=s.fit.available[axis];}
  }
  result[id]={...(fit?{fit}:{}),...(s.bay?{bay:true}:{}),reviewer:s.reviewer.trim(),measurement:s.measurement.trim(),drawing:s.drawing.trim(),instructions:s.instructions.trim(),signature:s.signature,lines};
 }
 return result;
}
export function factorySpecialTargets(doc){
 const ws=doc.room.workshop||{},ks=doc.kitchen,out=[],cache=new Map(),wallSource=wall=>{
  if(!cache.has(wall))cache.set(wall,fingerprint({dimensions:[doc.room.width,doc.room.length,doc.room.height],shape:doc.room.architecture,points:doc.room.sitePoints,wall,
   chain:ws.chains?.[wall],features:ks.features.filter(f=>f.wall===wall),runs:ks.runs.filter(r=>r.wall===wall).map(r=>[r.id,r.start,r.end,r.tier,r.height,r.depth,r.bottom]),
   units:ks.units.filter(u=>ks.runs.some(r=>r.wall===wall&&r.id===u.runId)).map(u=>[u.id,u.u,u.width,u.kind,u.doorHanding])}));
  return cache.get(wall);
 };
 function target(id,label,kind,walls,parameters,extra={}){
  const signature=fingerprint({id,walls:walls.length?walls.map(wallSource):{size:[doc.room.width,doc.room.length,doc.room.height],features:ks.features,floor:doc.room.sitePoints,runs:ks.runs.map(r=>[r.id,r.x,r.z,r.angle,r.depth,r.start,r.end]),survey:ws.chains},parameters,front:ws.finishes?.frontSku,...extra});
  out.push({id,label,kind,walls,signature,...extra});
 }
 for(const [key,c] of Object.entries(ws.corners||{})){
  for(const [tier,q] of (c.tall?[['tall',c.base]]:[['base',c.base],['upper',c.upper]])){
   if(q)target('corner:'+key+':'+tier,'هيكل الركن '+({tall:'الكامل',base:'السفلي',upper:'العلوي'})[tier]+' · '+key,'corner',[c.a,c.b],q,{...(q.build?{build:q.build}:{}),hardware:q.sku,technical:checkCornerPlacement(doc,c,key)||null});
  }
 }
 for(const [wall,options] of Object.entries(ws.options||{})){
  const takeoff=wallOptionTakeoff(doc,wall);
  for(const item of takeoff.items.filter(i=>i.readiness==='factory')){
   const key='wall:'+wall+':'+item.kind+(item.featureId?':'+item.featureId:'');
   target(key,item.label,item.kind,[wall],{options,quantity:item.quantity},{wall,item});
  }
 }
 const reported=new Set(Object.values(ws.rows||{}).flatMap(r=>r.units.map(u=>u.id)));
 for(const u of ks.units){
  const run=ks.runs.find(r=>r.id===u.runId);if(!run)continue;
  const standardUpper=run.tier==='upper'&&ws.chains?.[run.wall]&&run.id.startsWith('wup-'+run.wall+'-')&&u.kind==='storage';
  const managed=reported.has(u.id)||standardUpper;
  if(managed&&!u.detail)continue;
  const local={...u};delete local.open;
  const kind=managed?'inside':'unit';
  target(kind+':'+u.id,(managed?'تقسيم داخلي خاص':'وحدة خاصة كاملة')+' · '+u.id,kind,run.wall?[run.wall]:[],{unit:local,run,finish:ws.finishes?.units?.[u.id]},{unitId:u.id,runId:u.runId,appliance:deviceKinds.has(u.kind)});
 }
 return out;
}
export function reviewSpecial(target,draft,items){
 const by=new Map(items.map(i=>[i.sku,i]));
 const lines=(draft.lines||[]).map(l=>({...l,materialKey:by.has(l.sku)?materialKey(by.get(l.sku)):''}));
 return cleanSpecialSheets({[target.id]:{...draft,signature:target.signature,lines}},items)?.[target.id]||null;
}
export function specialParts(target,catalog,issues,releaseIssues,doc){
 const s=catalog.specials?.[target.id];
 if(target.technical)releaseIssues.push(target.technical);
 if(target.walls.length?target.walls.some(w=>doc.room.workshop?.chains?.[w]?.source!=='field'):!Object.values(doc.room.workshop?.chains||{}).some(c=>c.source==='field'))releaseIssues.push('يلزم رفع ميداني مرتبط بتفصيل '+target.label+'.');
 if(!s)return null;
 if(s.signature!==target.signature){issues.push('تغير موضع أو مقاس '+target.label+' منذ اعتماد الرسم الخاص.');return null;}
 if(s.bay&&!target.appliance){issues.push('يتطلب '+target.label+' قطع جسم فعلية.');return null;}
 if(target.appliance){
  const unit=doc.kitchen.units.find(u=>u.id===target.unitId),run=doc.kitchen.runs.find(r=>r.id===target.runId);
  if(!s.fit){releaseIssues.push('أكمل دليل الموديل وقياسات فتحة '+target.label+'.');}
  else{
   const drawn={width:10*unit.width,depth:10*(unit.depth??run.depth),height:10*(unit.height??run.height)};
   // Appliance maker dimensions and the measured opening must both fit. Model
   // towers often override the row envelope, so consult actual rendered geometry.
   const g=target.geometry; if(g){drawn.height=g.height*10;drawn.depth=g.depth*10;}
   for(const axis of ['width','depth','height'])if(Math.min(drawn[axis],s.fit.available[axis])<s.fit.required[axis])releaseIssues.push('فتحة '+target.label+' لا تطابق المطلوب من دليل '+s.fit.model+' ('+axis+').');
  }
 }
 const rows=[];
 for(const l of s.lines){
  const item=catalog.items.find(i=>i.sku===l.sku);
  if(!item||l.materialKey!==materialKey(item)){issues.push('تغيرت مواصفة الخام '+l.sku+' في '+target.label+'، أعد مراجعة ورقة القطع.');return null;}
  rows.push({...(l.operations?.length?{operations:l.operations}:{}),unitId:target.unitId||target.id,runId:target.runId||target.walls.join('+'),family:target.kind,kind:item.kind,sku:l.sku,label:l.label,a:l.a,b:l.b,count:l.count,operation:l.operation,drawing:s.drawing,instructions:s.instructions});
 }
 if(target.hardware&&!rows.some(r=>r.sku===target.hardware&&r.kind==='piece')){issues.push('عتاد الركن '+target.hardware+' غير مدرج في ورقة القطع المرتبطة.');return null;}
 return rows;
}
