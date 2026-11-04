import {inheritedName} from './kitchen-safe-keys.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {legalRowSpans} from './kitchen-row-fill.js';
import {cleanLinearChoice} from './kitchen-linear-light.js';
import {wallAssembly,assemblyIssues,wallAccessoryApproval} from './kitchen-wall-accessory.js';
import {cleanScribeReadings} from './kitchen-wall-scribe.js';
import {surveyServiceBlocks} from './kitchen-service-zones.js';
import {getFactoryCatalog,priceableWidth} from './kitchen-workshop-factory.js';
import {planWorkshopRow} from './kitchen-production-row.js';
import {architectureWall,architectureWallIdKnown,architectureWallPoint,architectureContainsPolygon} from './kitchen-architecture.js';
import {addRun,removeKitchenItem,kitchenGeometry} from './kitchen-model.js';
import {creationDefaults} from './kitchen-defaults-calculations.js';
import {readChainRange,surveyedDesignRange} from './kitchen-chain-model.js';

const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const mm=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const ident=s=>typeof s==='string'&&/^[a-zA-Z0-9][\w-]{0,79}$/.test(s)&&!inheritedName(s);
const kitId=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_.-]{0,47}$/i.test(v)&&!inheritedName(v)&&!['constructor','prototype','__proto__'].includes(v);
const sum=spans=>spans.reduce((total,s)=>total+s.endMm-s.startMm,0);
const fail=reason=>({ok:false,reason});

function cleanOptions(v){
 if(!obj(v))return null;
 const {mode,bottomMm,heightMm,upperTierMm,headMm,depthMm,fillerBy,cornice}=v;
 if(!['none','gap','tall','two','filler'].includes(mode)||!mm(bottomMm,0,6000)||!mm(heightMm,150,4000)||!mm(upperTierMm,150,4000)||!mm(headMm,0,1500)||!mm(depthMm,150,1500)||!['factory','external'].includes(fillerBy))return null;
 if(!obj(cornice)||typeof cornice.enabled!=='boolean'||!mm(cornice.heightMm,0,500)||!mm(cornice.projectionMm,0,500)||typeof cornice.returns!=='boolean'||(cornice.reviewed!=null&&typeof cornice.reviewed!=='boolean'))return null;
 if(cornice.enabled&&(cornice.heightMm<=0||mode==='none'))return null;
 const out={mode,bottomMm,heightMm,upperTierMm,headMm,depthMm,fillerBy,cornice:{enabled:cornice.enabled,heightMm:cornice.heightMm,projectionMm:cornice.projectionMm,returns:cornice.returns,reviewed:!!cornice.reviewed},curtains:{},heaters:{}};
 if(v.linearLight!==undefined){const choice=cleanLinearChoice(v.linearLight);if(!choice)return null;out.linearLight=choice;}
 if(v.decisions!==undefined){if(!obj(v.decisions)||Object.keys(v.decisions).some(k=>!['upper','cornice'].includes(k)||typeof v.decisions[k]!=='boolean'))return null;out.decisions={...v.decisions};}
 if(v.scribes!=null){const list=cleanScribeReadings(v.scribes);if(!list)return null;if(list.length)out.scribes=list;}
 if(v.factoryTrim!=null){
  if(!obj(v.factoryTrim))return null;out.factoryTrim={};
  for(const k of Object.keys(v.factoryTrim)){
   const t=v.factoryTrim[k];if(!['cornice','filler'].includes(k)||!obj(t)||typeof t.recipe!=='string'||!/^[a-z0-9][a-z0-9_.-]{0,47}$/i.test(t.recipe))return null;
   if(k==='cornice'&&(!['square','return','join'].includes(t.start)||!['square','return','join'].includes(t.end)))return null;
   out.factoryTrim[k]={recipe:t.recipe,...(k==='cornice'?{start:t.start,end:t.end}:{})};
  }
 }
 if(v.profiles!==undefined){
  if(!Array.isArray(v.profiles)||v.profiles.length>32)return null;
  const ids=new Set();out.profiles=[];
  for(const p of v.profiles){
   if(!obj(p)||!ident(p.id)||ids.has(p.id)||!['ledge','skirting','ceiling','lean'].includes(p.type)||
      !mm(p.fromMm,0,17000)||!mm(p.toMm,p.fromMm+1,17000)||!mm(p.bottomMm,0,6000)||!mm(p.topMm,p.bottomMm+1,6000)||!mm(p.depthMm,1,6000)||
      (['ledge','skirting'].includes(p.type)&&p.bottomMm!==0)||typeof p.reference!=='string'||p.reference.length>160)return null;
   ids.add(p.id);out.profiles.push(Object.fromEntries(['id','type','fromMm','toMm','bottomMm','topMm','depthMm','reference'].map(k=>[k,p[k]])));
  }
 }
 if(!obj(v.curtains)||!obj(v.heaters)||Object.keys(v.curtains).length>64||Object.keys(v.heaters).length>64)return null;
 for(const [id,c] of Object.entries(v.curtains)){
  if(!ident(id)||!obj(c)||!['none','existing','factory','external'].includes(c.state)||!['roller','track','other'].includes(c.type))return null;
  if(!['leftMm','rightMm','aboveMm','dropMm','projectionMm'].every(k=>mm(c[k],0,6000)))return null;
  if(c.state!=='none'&&(c.dropMm<=0||c.projectionMm<=0))return null;
  if(c.recipe!=null&&(!kitId(c.recipe)||c.state!=='factory')||c.pose!=null&&!['closed','parked'].includes(c.pose))return null;
  out.curtains[id]={...Object.fromEntries(['state','type','leftMm','rightMm','aboveMm','dropMm','projectionMm'].map(k=>[k,c[k]])),...(c.recipe?{recipe:c.recipe,pose:c.pose||'closed'}:{})};
 }
 for(const [id,h] of Object.entries(v.heaters)){
  if(!ident(id)||!obj(h)||!['exposed','cover'].includes(h.state)||typeof h.model!=='string'||h.model.length>100||typeof h.reviewed!=='boolean')return null;
  if(!['leftMm','rightMm','aboveMm','belowMm','frontMm'].every(k=>h[k]===null||mm(h[k],0,6000)))return null;
  if(h.manual!=null&&(typeof h.manual!=='string'||h.manual.length>160))return null;
  if(h.recipe!=null&&(!kitId(h.recipe)||h.state!=='cover')||h.kitProof!=null&&!/^[a-f0-9]{64}$/.test(h.kitProof))return null;
  out.heaters[id]={...(h.recipe?{recipe:h.recipe,...(h.kitProof?{kitProof:h.kitProof}:{})}:{}),...Object.fromEntries(['state','model','reviewed','leftMm','rightMm','aboveMm','belowMm','frontMm'].map(k=>[k,h[k]])),...(h.manual?{manual:h.manual}:{})};
 }
 return out;
}
export function cleanChainOptions(raw){
 if(!obj(raw)||Object.keys(raw).length>32)return null;
 const out={};
 for(const [wall,v] of Object.entries(raw)){const o=cleanOptions(v);if(!architectureWallIdKnown(wall)||!o)return null;out[wall]=o;}
 return out;
}
export function readWallOptions(doc,wall){
 if(doc.room.workshop?.options?.[wall])return doc.room.workshop.options[wall];
 const d=creationDefaults(doc);
 return {mode:'gap',bottomMm:10*d.upperBottom,heightMm:10*d.upperHeight,upperTierMm:400,headMm:0,depthMm:10*d.upperDepth,
  fillerBy:'factory',cornice:{enabled:false,heightMm:0,projectionMm:0,returns:false,reviewed:false},curtains:{},heaters:{}};
}
export function wallUpperBands(doc,wall){
 const o=readWallOptions(doc,wall),top=doc.room.height*10-o.headMm-(o.cornice.enabled?o.cornice.heightMm:0);
 if(o.mode==='none')return [];
 const height=['tall','two'].includes(o.mode)?top-o.bottomMm:o.heightMm;
 if(height<150||o.bottomMm+height>top+.0001||((o.mode==='tall'||o.mode==='gap'||o.mode==='filler')&&height>4000))return [];
 const bands=o.mode==='two'?[{bottom:o.bottomMm,height:height-o.upperTierMm},{bottom:top-o.upperTierMm,height:o.upperTierMm}]:[{bottom:o.bottomMm,height}];
 if(bands.some(b=>b.height<150||b.height>4000))return [];
 return bands.map(b=>({bottom:b.bottom/10,height:b.height/10,depth:o.depthMm/10}));
}

// A base run may stand on a measured ledge when its entire depth and full
// length share that level. Keep the original worktop datum by reducing the
// body height. A partial/mixed bearing remains an obstruction.
export function baseBandFor(doc,wall,startMm,endMm,defaults=creationDefaults(doc)){
 const edge=architectureWall(doc.room,wall),o=readWallOptions(doc,wall);
 let bottom=0;
 for(const p of o.profiles||[]){
  if(p.type==='ledge'&&edge&&startMm>=edge.start*10+p.fromMm-1e-6&&endMm<=edge.start*10+p.toMm+1e-6&&defaults.baseDepth*10<=p.depthMm){
   bottom=Math.max(bottom,p.topMm/10);
  }
 }
 return {bottom,height:defaults.baseHeight-bottom,depth:defaults.baseDepth};
}
export function profileIssues(doc,wall){
 const o=doc.room.workshop?.options?.[wall],edge=architectureWall(doc.room,wall),issues=[];
 for(const p of o?.profiles||[]){
  if(!p.reference.trim())issues.push('يلزم مرجع القياس لإنهاء مراجعة البروز أو التعلية '+p.id+'.');
  if(!edge||p.toMm>edge.length*10+1e-6||p.topMm>doc.room.height*10)issues.push('تغيّرت حدود الجدار أو السقف بالنسبة إلى '+p.id+'. راجع مقاساته.');
 }
 return issues;
}
export function optionEnvelopes(doc){
 const features=surveyServiceBlocks(doc.room);
 for(const [wall,o] of Object.entries(doc.room.workshop?.options||{})){
  const edge=architectureWall(doc.room,wall);if(!edge)continue;
  for(const p of o.profiles||[]){
   features.push({id:'profile-'+wall+'-'+p.id,kind:'column',wall,u:edge.start+p.fromMm/10,width:(p.toMm-p.fromMm)/10,
    bottom:p.bottomMm/10,height:(p.topMm-p.bottomMm)/10,depth:p.depthMm/10});
  }
  for(const f of doc.kitchen.features.filter(f=>f.wall===wall)){
   let lo,hi,bottom,top,depth;
   if(f.kind==='window'&&o.curtains[f.id]?.state!=='none'&&o.curtains[f.id]){
    const c=o.curtains[f.id];
    lo=f.u-c.leftMm/10;hi=f.u+f.width+c.rightMm/10;top=f.bottom+f.height+c.aboveMm/10;bottom=top-c.dropMm/10;depth=c.projectionMm/10;
   }else if(f.kind==='heater'&&o.heaters[f.id]){
    const h=o.heaters[f.id];
    lo=f.u-(h.leftMm??0)/10;hi=f.u+f.width+(h.rightMm??0)/10;
    top=f.bottom+f.height+(h.aboveMm??0)/10;bottom=f.bottom-(h.belowMm??0)/10;depth=f.depth+(h.frontMm??0)/10;
   }else continue;
   if(f.kind==='heater'&&o.heaters[f.id]?.recipe){
    const a=wallAssembly(doc.room,f,o.heaters[f.id],readWorkshopCatalog(doc.room.workshop));
    for(const [i,v] of (a?.paths||[]).entries()){
     if(v.role==='heater-service')continue;
     features.push({id:'cover-movement-'+f.id+'-'+i,kind:'column',wall,u:v.x/10,bottom:v.y/10,width:v.w/10,height:v.h/10,depth:v.d/10,planningOffset:v.z/10});
    }
    for(const v of a?.bodies||[]){lo=Math.min(lo,v.x/10);hi=Math.max(hi,(v.x+v.w)/10);bottom=Math.min(bottom,v.y/10);top=Math.max(top,(v.y+v.h)/10);depth=Math.max(depth,(v.z+v.d)/10);}
   }
   lo=Math.max(edge.start,lo);hi=Math.min(edge.end,hi);bottom=Math.max(0,bottom);top=Math.min(doc.room.height,top);
   if(top>bottom&&hi>lo&&depth>0)features.push({id:'fabric-envelope-'+f.id,kind:'column',wall,u:lo,width:hi-lo,bottom,height:top-bottom,depth});
  }
 }
 return features;
}
// Unspecified space is only a planning approximation. For release, preserve
// the manufacturer's full validated service volume, even at a wall end.
export function heaterServiceIssues(doc,wall){
 const edge=architectureWall(doc.room,wall),issues=[];
 if(!edge)return issues;
 for(const f of doc.kitchen.features.filter(f=>f.kind==='heater'&&f.wall===wall)){
  const h=doc.room.workshop?.options?.[wall]?.heaters?.[f.id];
  if(!h||!h.reviewed||!h.model?.trim()||!h.manual?.trim()||!['leftMm','rightMm','aboveMm','belowMm','frontMm'].every(k=>Number.isFinite(h[k]))){
   issues.push('السخان '+f.id+' يحتاج موديله ومرجع دليل الخدمة وخلوصاته المؤكدة، سواء بقي ظاهرًا أو غُطّي.');continue;
  }
  const lo=f.u-h.leftMm/10,hi=f.u+f.width+h.rightMm/10,d=f.depth+h.frontMm/10;
  const poly=[[lo,0],[hi,0],[hi,d],[lo,d]].map(([u,depth])=>architectureWallPoint(doc.room,wall,u,depth));
  if(lo<edge.start-1e-6||hi>edge.end+1e-6||f.bottom-h.belowMm/10<-.000001||f.bottom+f.height+h.aboveMm/10>doc.room.height+.000001||!architectureContainsPolygon(doc.room,poly)){
   issues.push('حيّز صيانة السخان '+f.id+' المطلوب في دليل الموديل يتجاوز حدود الجدار أو السقف أو الغرفة.');
  }
 }
 return issues;
}
export function applyWallOptions(doc,wall,raw){
 const o=cleanOptions(raw);if(!o)return fail('راجع الأبعاد. ستحتاج الستارة إلى طول نزول وبروز، والكورنيش إلى ارتفاع.');
 const options={...doc.room.workshop?.options,[wall]:o},room={...doc.room,workshop:{...doc.room.workshop,options}};
 const next={...doc,room},edge=architectureWall(room,wall);
 if(!edge||(o.profiles||[]).some(p=>p.toMm>edge.length*10+1e-6||p.topMm>room.height*10))return fail('تتجاوز حدود أحد المقاطع المرصودة طول الجدار أو ارتفاع السقف.');
 if(o.mode!=='none'&&!wallUpperBands(next,wall).length)return fail('لا تتسع المسافة بين قاعدة العلوي والسقف للارتفاعات المختارة.');
 return {ok:true,doc:next};
}

export function wallOptionTakeoff(doc,wall){
 const o=doc.room.workshop?.options?.[wall],items=[],pending=[];
 if(!o)return {items,pending};
 const features=doc.kitchen.features.filter(f=>f.wall===wall);
 for(const [id,c] of Object.entries(o.curtains)){
  if(c.state==='none')continue;
  if(!features.some(f=>f.id===id&&f.kind==='window')){pending.push('راجع مرجع شباك الستارة بعد تعديل الرسم.');continue;}
  items.push({kind:'curtain',wall,featureId:id,label:'ستارة الشباك '+id,quantity:1,unit:'قطعة',readiness:c.state});
 }
 for(const [id,h] of Object.entries(o.heaters)){
  if(!features.some(f=>f.id===id&&f.kind==='heater')){pending.push('راجع مرجع السخان بعد تعديل الرسم.');continue;}
  const ready=h.reviewed&&h.model.trim()&&['leftMm','rightMm','aboveMm','belowMm','frontMm'].every(k=>Number.isFinite(h[k]));
  if(h.state==='cover'){
   if(!ready)pending.push('غطاء السخان '+id+' ينتظر موديل الجهاز وخلوصاته واعتماد الوصول للصيانة.');
   items.push({kind:'heater-cover',wall,featureId:id,label:'غطاء خدمة السخان '+id,quantity:1,unit:'قطعة',readiness:ready?'factory':'review'});
  }
 }
 const catalog=readWorkshopCatalog(doc.room.workshop);
 for(const f of features){
  const heater=f.kind==='heater',v=heater?o.heaters[f.id]:f.kind==='window'?o.curtains[f.id]:null;
  if(!v||v.state==='none'||heater&&v.state!=='cover')continue;
  const assembly=wallAssembly(doc.room,f,v,catalog);
  if(assembly&&(v.recipe||!heater))pending.push(...assemblyIssues(doc,f,assembly,kitchenGeometry(doc.kitchen,doc.room)));
  if(heater&&v.recipe&&(!v.kitProof||v.kitProof!==wallAccessoryApproval(doc.room,doc.kitchen,wall,f.id,catalog,o)))pending.push('راجع إمكان تغطية موديل السخان وحيز فك واجهته بعد أي تغيير في القياس أو مواصفة الوصفة.');
 }
 const envelopes=optionEnvelopes(doc).filter(f=>f.wall===wall),envIds=new Set(envelopes.map(f=>f.id));
 if(envelopes.length&&doc.kitchen.units.length){
  const scene={...doc.kitchen,features:[...doc.kitchen.features,...envelopes]};
  const conflicts=kitchenGeometry(scene,doc.room).conflicts;
  if(conflicts.some(c=>['open-feature','body-feature','top-feature','door-swing'].includes(c.type)&&c.ids.some(id=>envIds.has(id))))
   pending.push('راجع الوحدات القائمة التي تدخل في حيز الستارة أو خدمة السخان.');
 }
 const range=readChainRange(doc,wall);
 if(o.mode==='none'&&doc.kitchen.runs.some(r=>r.wall===wall&&r.tier==='upper'&&!r.id.startsWith('wup-'+wall+'-')))pending.push('اخترت جدارًا بلا صف علوي. راجع أي صف علوي يدوي باقٍ على هذا الجدار.');
 if(o.cornice.enabled&&!o.cornice.reviewed)pending.push('تحقق من خلوص درف العلوي مع بروز قطاع الكورنيش واعتمده.');
 if(range){
  const prefix='wup-'+wall+'-',managed=doc.kitchen.runs.filter(r=>r.id.startsWith(prefix));
  const expected=upperRows(doc,wall,range);
  if((managed.length||o.cornice.enabled||o.mode!=='gap')&&
   (managed.length!==expected.length||managed.some(r=>!expected.some(v=>sameBand(r,v)))))
   pending.push('اعتمد توليد مقاطع العلوي وفق الخيارات والرفع الحاليين.');
 }
 if(!range&&(o.cornice.enabled||o.mode==='filler')){pending.push('أكمل رفع الجدار لحساب طول التشطيب العلوي.');return {items,pending};}
 const spans=range?.upperBandSpans.at(-1)||[],lengthMm=sum(spans);
 if(o.cornice.enabled){
  if(!lengthMm)pending.push('لا توجد حافة علوية متاحة للكورنيش.');
  else items.push({kind:'cornice',wall,label:'كورنيش علوي حسب المقاطع المتاحة',quantity:(lengthMm+(o.cornice.returns?2*spans.length*o.depthMm:0))/1000,unit:'م',readiness:'factory'});
 }
 if(o.mode==='filler'){
  const h=doc.room.height*10-o.bottomMm-o.heightMm-o.headMm-(o.cornice.enabled?o.cornice.heightMm:0);
  const surface=range?.fillerSpans||spans;
  if(!h||!surface.length)pending.push('تحقق من المساحة المتاحة للقفلة.');
  else items.push({kind:'filler',wall,label:'قفلة علوية بارتفاع '+h+' مم',quantity:sum(surface)*h/1e6,unit:'م²',readiness:o.fillerBy});
 }
 return {items,pending};
}

function upperRows(doc,wall,range,withCabinets){
 const bands=wallUpperBands(doc,wall);
 if(!range||!bands.length)return [];
 const prefix='wup-'+wall+'-',items=[];
 // Survey spans describe the building. During a full design, also reserve
 // existing tall units, their actual opening envelopes, and unowned upper runs.
 const others=withCabinets?doc.kitchen.runs.filter(r=>!r.id.startsWith(prefix)):null;
 const scene=withCabinets?{...doc.kitchen,runs:others,units:doc.kitchen.units.filter(u=>!u.runId.startsWith(prefix)),
   features:[...doc.kitchen.features,...optionEnvelopes(doc)]}:null;
 for(const [level,band] of bands.entries()){
  let spans=range.upperBandSpans[level];
  if(scene){
   const probe={id:prefix+'probe',tier:'upper',wall,start:range.startMm/10,end:range.endMm/10,...band};
   const occupied=others.filter(r=>r.wall===wall&&r.tier==='upper'&&r.bottom<band.bottom+band.height&&band.bottom<r.bottom+r.height).map(r=>({u:r.start,width:r.end-r.start}));
   const fitting=legalRowSpans(scene,doc.room,probe,occupied);
   spans=spans.flatMap(s=>fitting.map(f=>({startMm:Math.max(s.startMm,Math.ceil(f.start*10-1e-6)),endMm:Math.min(s.endMm,Math.floor(f.end*10+1e-6))})).filter(v=>v.endMm>v.startMm));
  }
  for(const [i,span] of spans.entries()){
   if(span.endMm-span.startMm<200)continue;
   items.push({id:prefix+level+'-'+i,tier:'upper',wall,start:span.startMm/10,end:span.endMm/10,...band,autoFill:true});
  }
 }
 return items;
}
const sameBand=(v,r)=>['id','wall','start','end','height','depth','bottom'].every(k=>Math.abs(Number(v[k])-Number(r[k]))<.0000001||v[k]===r[k]);
export function buildUpperRows(doc,wall,{withCabinets=false}={}){
 const range=surveyedDesignRange(doc,wall),prefix='wup-'+wall+'-';
 if(!range)return fail('أكمل رفع الجدار واحفظ نهاية الدواليب أو قياس ركن النهاية قبل توليد الصف العلوي.');
 const items=upperRows(doc,wall,range,withCabinets),cat=getFactoryCatalog(doc),family=cat.families.upperStorage;
 if(!items.length&&readWallOptions(doc,wall).mode!=='none'&&!(withCabinets&&doc.kitchen.runs.some(r=>r.wall===wall&&r.tier==='upper'&&!r.id.startsWith(prefix))))return fail('لا توجد مساحة لتركيب صف علوي ضمن الحدود المختارة.');
 let kitchen=doc.kitchen;
 const owned=kitchen.runs.filter(r=>r.id.startsWith(prefix));
 const unchanged=r=>items.some(v=>sameBand(v,r));
 for(const r of owned.filter(r=>!unchanged(r))){
  if(r.fillGaps?.length||doc.room.workshop?.rows?.[r.id]||kitchen.units.some(u=>u.runId===r.id&&(u.fillRole!=='auto'||u.interior&&((u.interior.shelves??1)!==1||(u.interior.dividers??0)!==0)||u.detail||doc.room.workshop?.finishes?.units?.[u.id]||doc.room.workshop?.clientUsage?.tasks?.some(t=>t.unitId===u.id))))return fail('توجد وحدة أو فجوة مثبّتة في الصف العلوي المتأثر. راجع تخصيصه قبل إعادة إنشائه.');
  const res=removeKitchenItem(kitchen,r.id,doc.room);if(!res.ok)return fail(res.reason);kitchen=res.kitchen;
 }
 for(const row of items){
  let run=kitchen.runs.find(r=>r.id===row.id);
  if(!run){
   const res=addRun(kitchen,doc.room,row);if(!res.ok)return fail(res.reason);kitchen=res.kitchen;
   run=kitchen.runs.find(r=>r.id===row.id);
   if(!sameBand(run,row))return fail('لم يطابق طول الصف الفعلي المقطع المرفوع. راجع التقاء الصفين عند الركن.');
  }
  const live=kitchen.units.filter(u=>u.runId===row.id);
  if(family&&live.every(u=>priceableWidth(family,u.width*10)))continue;
  if(withCabinets&&doc.room.workshop?.rows?.[run.id]&&live.every(u=>doc.room.workshop.rows[run.id].units.some(e=>e.id===u.id)))continue;
  if(!family||run.fillGaps?.length||live.some(u=>u.fillRole!=='auto'))return fail('يلزم تعديل الوحدات العلوية المثبتة لتطابق عروض كتالوج المصنع.');
  const adjusted=planWorkshopRow({...doc,kitchen},{runId:row.id},cat);
  if(!adjusted.ok)return fail(adjusted.reason);
  kitchen={...adjusted.doc.kitchen,units:adjusted.doc.kitchen.units.map(u=>u.runId===row.id?{...u,fillRole:'auto'}:u)};
 }
 return {ok:true,doc:{...doc,kitchen},count:items.length};
}
