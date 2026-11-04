import {inheritedName} from './kitchen-safe-keys.js';
import {resolveFinishParts} from './kitchen-finish-parts.js';
import {packMasses} from './kitchen-drawer-pack-data.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {kitchenGeometry,kitchenRunPolygon} from './kitchen-model.js';
import {architectureContainsPolygon} from './kitchen-architecture.js';
import {convexIntersection,polygonArea} from './kitchen-oriented.js';
import {optionEnvelopes} from './kitchen-chain-options.js';
// Supplier data are per purchased pair. Each physical drawer consumes one pair
// and gets its own dimensions, real moving mass, pin, and ranked availability.
const n=(x,lo,hi)=>Number.isFinite(x)&&x>=lo&&x<=hi;
const ref=x=>typeof x==='string'&&x.trim()&&x.length<=180;
const sku=x=>typeof x==='string'&&/^[a-zA-Z0-9][\w.-]{0,47}$/.test(x)&&!inheritedName(x);
const fields=['minWidthMm','maxWidthMm','minDepthMm','maxDepthMm','minGapMm','maxGapMm','travelMm','movingKg'];
export function cleanRunnerSpec(v){
 if(!v||!ref(v.reference)||!n(v.minWidthMm,1,3000)||!n(v.maxWidthMm,v.minWidthMm,3000)||!n(v.minDepthMm,1,3000)||!n(v.maxDepthMm,v.minDepthMm,3000)||!n(v.minGapMm,0,100)||!n(v.maxGapMm,v.minGapMm,100)||!n(v.travelMm,1,3000)||!n(v.movingKg,.001,500))return null;
 return {...Object.fromEntries(fields.map(k=>[k,v[k]])),reference:v.reference.trim()};
}
export function cleanDrawerChecks(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>8)return null;
 const out={};
 for(const [index,v] of Object.entries(raw)){
  if(!/^[1-8]$/.test(index)||!v||!ref(v.reference)||!ref(v.basis)||v.basis.length>180||v.pin&&!sku(v.pin)||!['clearWidthMm','clearDepthMm'].every(k=>n(v[k],1,3000))||
   !['leftGapMm','rightGapMm'].every(k=>n(v[k],0,100))||!['minTravelMm','freeTravelMm'].every(k=>n(v[k],0,3000))||
   !n(v.emptyKg,.001,500)||v.contentsKg!==null&&!n(v.contentsKg,0,500))return null;
  out[index]={...Object.fromEntries(['clearWidthMm','clearDepthMm','leftGapMm','rightGapMm','minTravelMm','freeTravelMm','emptyKg','contentsKg'].map(k=>[k,v[k]])),reference:v.reference.trim(),basis:v.basis,...(v.pin?{pin:v.pin}:{})};
 }
 return out;
}
export function drawerBasis(u,run,e,catalog,finishes,index){
 const f=catalog.families[e.recipeId||e.family],pick=finishes?.units?.[u.id]?.frontSku||finishes?.frontSku;
 const lines=(f?.recipe||[]).filter(l=>catalog.items.find(i=>i.sku===l.sku)?.hardwareRole!=='runner');
 const by=new Map(catalog.items.map(i=>[i.sku,i])),parts=resolveFinishParts(f,finishes,u.id,by);
 const materials=lines.map(l=>{const item=l.role==='front'&&pick?by.get(pick):parts.itemFor(l);return [l,item?.sku,item?.thicknessMm,item?.massKgM2,item?.sectionWidthMm,item?.gaugeMm];});
 return hash([e.recipeId||e.family,u.runId,u.u,run.x,run.z,run.angle,run.wall,run.bottom,u.width,run.depth,run.height,u.drawerCount||3,u.interior,u.detail,u.frontStyle,u.handleStyle,u.frontFinish,materials,e.drawerUses?.[index-1]||e.use]);
}
const hash=v=>offlineDigest(new TextEncoder().encode(JSON.stringify(v)));
function clearTravel(geometry,room,unit,run,index,travelMm){
 const geo=geometry.units.find(x=>x.id===unit.id);if(!geo)return false;
 const toe=geo.baseSupport?.applicable?geo.baseSupport.bodyClearMm/10:geo.bottom<1?Math.min(9,geo.height*.12):0,slot=(geo.height-toe)/(unit.drawerCount||3);
 const top=geo.bottom+geo.height-slot*(index-1),bottom=top-slot;
 const poly=kitchenRunPolygon(room,run,unit.u,unit.width,travelMm/10,geo.depth);
 if(!architectureContainsPolygon(room,poly))return false;
 const overlap=o=>Math.min(top,o.bottom+o.height)>Math.max(bottom,o.bottom)+1e-6&&Math.abs(polygonArea(convexIntersection(poly,o.polygon)))>1e-6;
 return !geometry.units.some(p=>p.id!==unit.id&&(p.bodyParts||[p]).some(overlap))&&
   !geometry.features.some(p=>['column','beam','shaft','window','door','heater'].includes(p.kind)&&overlap(p))&&
   !geometry.cornerBodies.some(c=>[...c.parts,...(c.sweep?[c.sweep]:[])].some(overlap));
}
export function drawerRunnerPlans(catalog,rows,units,runs,finishes,doc,packed=packMasses(doc?.room.workshop?.clientUsage?.pack),{technicalOnly=false}={}){
 const items=new Map(catalog.items.map(i=>[i.sku,i])),jobs=[],result=new Map();
 let geometry=null;
 const hosts=Object.entries(rows).flatMap(([runId,row])=>(row.units||[]).map(e=>({row,runId,e}))).sort((a,b)=>a.e.id.localeCompare(b.e.id));
 for(const {row,runId,e} of hosts){
  const f=catalog.families[e.recipeId||e.family];if(!f?.drawerRunners?.length)continue;
  if(doc&&!geometry)geometry=kitchenGeometry({...doc.kitchen,features:[...doc.kitchen.features,...optionEnvelopes(doc)]},doc.room);
  const u=units.find(i=>i.id===e.id),run=runs.find(r=>r.id===runId);if(!u||!run||u.kind!=='drawers')continue;
  const rice=e.family==='rice'?row.riceChecks?.[u.id]:null,rowsOut=[],issues=[],statusCodes=[];
  const issue=(code,message)=>{issues.push(technicalOnly?code:message);statusCodes.push(code);};
  result.set(u.id,{rows:rowsOut,issues,...(technicalOnly?{statusCodes}:{})});
  const riceDrawer=rice?.drawerIndex;
  if(e.family==='rice'&&(!riceDrawer||riceDrawer>(u.drawerCount||3)||rice.mode!==e.riceMode))issue('RICE_LOAD_REQUIRED',u.id+' · حدّد رقم الدرج الذي يحمل الأرز وتعبئته قبل اختيار سككه.');
  const allowed=f.drawerRunners.map(s=>items.get(s)).filter(Boolean);
  for(let index=1;index<=(u.drawerCount||3);index++){
   const v=row.drawerChecks?.[e.id]?.[index],label=e.id+' · الدرج '+index;
   if(!v||v.basis!==drawerBasis(u,run,e,catalog,finishes,index)){issue(v?'MEASUREMENT_STALE':'MEASUREMENT_REQUIRED',label+' · أكمل قياسات تركيب السكة وحمولة الدرج الحالي أو حدّث مرجعها بعد تغيير القسم.');continue;}
   if(v.clearWidthMm>=u.width*10||v.clearDepthMm>run.depth*10||v.leftGapMm+v.rightGapMm>=v.clearWidthMm){issue('MEASUREMENT_OUTSIDE',label+' · قياسات التثبيت تتجاوز الحيز المرسوم.');continue;}
   if(v.contentsKg===null){issue('CUSTOMER_LOAD_REQUIRED',label+' · سجّل وزن محتويات العميل؛ الصفر يحتاج تأكيدًا صريحًا.');continue;}
   const riceKg=index===riceDrawer?(rice.mode==='bags'?Math.ceil(rice.amountKg/rice.packageKg)*rice.packageKg:rice.amountKg)+rice.packagingKg:0;
   const movingKg=v.emptyKg+v.contentsKg+riceKg+(packed.get(u.id+'#'+index)||0);
   const fit=allowed.filter(i=>{const s=i.runnerSpec;return s&&(!v.pin||i.sku===v.pin)&&n(v.clearWidthMm,s.minWidthMm,s.maxWidthMm)&&n(v.clearDepthMm,s.minDepthMm,s.maxDepthMm)&&[v.leftGapMm,v.rightGapMm].every(g=>n(g,s.minGapMm,s.maxGapMm))&&n(s.travelMm,v.minTravelMm,v.freeTravelMm)&&movingKg<=s.movingKg+.000001&&(!geometry||clearTravel(geometry,doc.room,u,run,index,s.travelMm));});
   const options=technicalOnly?fit:fit.filter(i=>i.price!==null&&(i.available||i.stockUnits>0));
   jobs.push({index,label,e,u,run,v,movingKg,options,rowsOut,issues,issue});
  }
 }
 // Prefer a free slot. If a scarce pair is the only match, move a flexible
 // drawer to one of its own approved alternatives through an augmenting path.
 const occupants=new Map();
 function allocate(job,visited){
  const candidates=job.options.filter(item=>!visited.has(item.sku));
  const assign=item=>{job.picked=item;if(!item.available){const list=occupants.get(item.sku)||[];list.push(job);occupants.set(item.sku,list);}return true;};
  const free=item=>item.available||(occupants.get(item.sku)?.length||0)<item.stockUnits;
  for(const item of candidates)if(free(item))return assign(item);
  for(const item of candidates){
   if(visited.has(item.sku))continue;visited.add(item.sku);
   const list=occupants.get(item.sku)||[];
   for(const prior of [...list].reverse())if(!prior.v.pin&&allocate(prior,visited)){list.splice(list.indexOf(prior),1);return assign(item);}
  }
  return false;
 }
 if(technicalOnly)for(const j of jobs)j.picked=j.options[0];
 else for(const j of [...jobs].sort((a,b)=>Number(!!b.v.pin)-Number(!!a.v.pin)||a.options.length-b.options.length))allocate(j,new Set());
 for(const {picked,index,label,e,u,run,v,movingKg,rowsOut,issue} of jobs){
  if(!picked){issue('NO_TECHNICAL_RUNNER',label+' · '+(v.pin?'الصنف المثبت '+v.pin+' لا يطابق القياسات أو الحمولة أو التوريد.':'لا يوجد طقم سكك مسعّر ومتاح يطابق العرض والعمق والخلوص ومشوار السحب وحمولة '+Number(movingKg.toFixed(3))+' كجم.'));continue;}
  rowsOut.push({a:null,b:null,count:1,unitId:u.id,runId:run.id,family:e.family,...(e.recipeId?{recipeId:e.recipeId}:{}),kind:'piece',sku:picked.sku,label:'طقم سكتين · الدرج '+index,drawerIndex:index,movingKg:Number(movingKg.toFixed(3)),travelMm:picked.runnerSpec.travelMm,...(!technicalOnly?{runnerReference:picked.runnerSpec.reference}:{}),...(v.pin?{pinnedHardware:true}:{})});
 }
 return result;
}
