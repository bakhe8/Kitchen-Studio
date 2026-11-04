import {scribeDXF} from './kitchen-wall-scribe.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {verifiedPattern,surfaceInspectionChecks} from './kitchen-surface-pattern.js';
import {surfaceReleaseIssues} from './kitchen-surface-release.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {buildFactoryQuote,purchaseRequirements,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {surfaceDXF} from './kitchen-surface-pattern.js';
import {kitchenGeometry} from './kitchen-model.js';
// Units and inspection nominals come from the immutable release design, never
// from the salesperson's open drawing or a client-supplied dimension.
export function orderHandoffUnits(doc,ids,mode){
 const filter=mode==='whole-filter'?new Set(Array.isArray(ids)?ids:[]):null,catalog=readWorkshopCatalog(doc.room.workshop);
 const quote=ids&&!filter?buildFactoryQuote(doc,{unitIds:ids}):buildFactoryQuote(doc),pieces=new Map(),units=[];
 for(const p of quote.pieces){if(filter&&!filter.has(p.unitId))continue;if(!pieces.has(p.unitId))pieces.set(p.unitId,[]);pieces.get(p.unitId).push(p);}
 const geo=kitchenGeometry(doc.kitchen,doc.room);
 for(const [id,rows] of pieces){
  const g=geo.units.find(u=>u.id===id),checks=[];
  if(g){
   const support=g.baseSupport,clear=support?.bodyClearMm||0;
   for(const [key,label] of [['width','عرض الجسم'],['height','ارتفاع الجسم'],['depth','عمق الجسم']]){
    const nominal=10*g[key]-(key==='height'?clear:0);
    checks.push({key,label,nominal:Math.round(nominal*1000)/1000,unit:'مم'});
   }
   if(clear>0)checks.push({key:'base-clearance',label:'فراغ أسفل الجسم عن منسوب الصف',nominal:clear,unit:'مم'});
   if(support?.mode==='legs')checks.push({key:'base-legs',label:'أرجل الدولاب · '+support.legSku,nominal:support.legCount,unit:'قطعة'});
   for(const [index,p] of rows.entries())if(p.family==='baseApron'){
    const profile=catalog.baseSupport.aprons[p.recipeId];
    for(const [key,label,nominal] of [['length','طول الساتر المشترك',p.a],['height','ارتفاع الساتر',profile.heightMm],['inset','تراجع وجه الساتر',profile.insetMm],['thickness','سمك الساتر',profile.thicknessMm]]){
     checks.push({key:'apron-'+index+'-'+key,label:label+' · '+p.sku,nominal,unit:'مم'});
    }
   }
  }
  else{
   for(const [idx,p] of rows.entries()){
    for(const [key,label] of [['a','طول'],['b','عرض']])if(p[key]!=null)checks.push({key:idx+'-'+key,label:label+' '+p.label+' · '+p.sku,nominal:p[key],unit:'مم'});
    if(p.a==null&&p.b==null)checks.push({key:idx+'-count',label:p.label+' · '+p.sku,nominal:p.count,unit:'قطعة'});
   }
  }
  for(const [i,p] of rows.entries())if(p.cornerCut?.tag==='shelf')checks.push({key:'corner-shelf-'+i,label:'منسوب أسفل '+p.label+' عن أسفل جسم الركن',nominal:p.cornerCut.y0,unit:'مم'});
  for(const [i,p] of rows.entries())if(p.scribe){
   for(const [j,w] of p.scribe.widths.entries())checks.push({key:'scribe-'+i+'-'+j,label:p.label+' · عرض عند '+p.scribe.stations[j][0]+' مم',nominal:w,unit:'مم',maxTolerance:p.scribe.cutToleranceMm});
  }
  const scribes=rows.filter(p=>p.scribe).map(p=>({id:p.scribe.anchor,label:p.label}));
  if(checks.length)units.push({id,...(scribes.length?{scribes}:{}),name:g?.label||rows[0].label,checks,partCount:rows.reduce((sum,p)=>sum+p.count,0)});
 }
 if((!ids||filter)&&catalog?.terms?.worktop==='include'&&!surfaceReleaseIssues(doc).length){
  for(const top of geo.worktops){
   const id='surface:'+top.id;if(filter&&!filter.has(id))continue;
   const measured=verifiedPattern(doc,top);
   // An externally held paper template has no digital cut dimensions. Only
   // verify the delivered quantity against its reference, never a CAD guess.
   const checks=measured?surfaceInspectionChecks(measured):[{key:'external-template',label:'قطعة مطابقة لقالب المورد '+doc.room.workshop.surfaceTemplate.reference,nominal:1,unit:'قطعة'}];
   units.push({id,name:'سطح العمل · '+top.runId,partCount:1,checks});
  }
 }
 return units;
}

// What the workshop physically cut for each unit. Commercial price edits and
// annotations cannot alter that geometry; later dispatches must respect it.
export function manufacturingKeys(doc){
 const quote=buildFactoryQuote(doc),items=readWorkshopCatalog(doc.room.workshop)?.items||[],geo=kitchenGeometry(doc.kitchen,doc.room),map={};
 const grouped=new Map(),shared=new Map();
 for(const p of quote.pieces){const material=items.find(i=>i.sku===p.sku);
  const line=[p.sku,p.label,p.kind,p.a,p.b,p.count,p.operation||'',material?.thicknessMm??null,material?.colorHex??material?.color??''];
  if(p.operations?.length)line.push(['machining',p.operations.map(op=>[op.kind,op.machine,op.xFrom,op.yFrom,op.x,op.y,op.diameter,op.depth,op.length,op.width,op.angle,op.radius,op.tolerance,op.reference,op.confirmation??null])]);
  if(p.handleInstall)line.push(['handle-install',p.handleInstall]);
  if(p.handleForm)line.push(['handle-form',p.handleForm]);
  if(p.cornerCut){const {use,...physical}=p.cornerCut;line.push(['corner-panel',physical,p.drawing]);}
  if(p.scribe)line.push(['scribe',p.scribe.side,p.scribe.anchor,p.scribe.points,p.scribe.installedClearanceMm,p.scribe.cutToleranceMm]);
  if(p.stationMm!=null)line.push(['wall-trim',p.stationMm,p.drawing]);
  if(p.ends)line.push(['end-cuts',p.datumLengthMm,p.ends.datum,p.ends.startDeg,p.ends.endDeg,p.ends.reference]);
  if(material?.sectionWidthMm!=null||material?.gaugeMm!=null||material?.grooveWidthMm!=null||material?.grooveDepthMm!=null)line.push(['section',material.sectionWidthMm??null,material.gaugeMm??null,material.grooveWidthMm??null,material.grooveDepthMm??null]);
  if(p.family==='baseApron')for(const member of p.unitIds||[]){
   if(!shared.has(member))shared.set(member,[]);
   shared.get(member).push([p.unitId,p.unitIds,p.sku,p.a,p.stationMm]);
  }
  if(!grouped.has(p.unitId))grouped.set(p.unitId,[]);grouped.get(p.unitId).push(line);
 }
 for(const [id,lines] of grouped){const g=geo.units.find(x=>x.id===id),r=geo.runs.find(x=>x.id===g?.runId);
  const body=g?[g.kind,g.width,g.height,g.depth,g.bottom,g.polygon.map(v=>[v.x,v.z]),r?.wall??'']:null;
  const support=g?.baseSupport;
  if(support?.applicable&&support.mode!=='unknown'){
   body.push(['base-support',support.mode,support.bodyClearMm,support.legSku,support.legCount,support.pads,support.apron,support.apronHeightMm,support.apronInsetMm,support.apronThicknessMm,shared.get(id)??[]]);
  }
  map[id]=offlineDigest(new TextEncoder().encode(JSON.stringify([body,lines])));
 }
 return map;
}

// Countertop template/m² is external to the SKU stock ledger. Its own release
// stays in the work order but is never silently converted to a raw panel SKU.
export function remainderStockRequirements(doc,ids){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return {issues:['نطاق غير صالح.'],purchases:[]};
 const allowed=new Set(orderHandoffUnits(doc).map(u=>u.id));
 if(ids.some(id=>!allowed.has(id)))return {issues:['عنصر متبقٍ غير معرّف في الإيصال.'],purchases:[]};
 const picked=new Set(ids),q=buildFactoryQuote(doc);
 const shared=q.pieces.find(p=>p.family==='baseApron'&&p.unitIds.some(id=>picked.has(id))&&p.unitIds.some(id=>!picked.has(id)));
 if(shared)return {issues:['الساتر المشترك يحتاج إدراج الوحدات '+shared.unitIds.join('، ')+' معًا.'],purchases:[]};
 const result=purchaseRequirements(getFactoryCatalog(doc),q.pieces.filter(p=>picked.has(p.unitId)));
 return {issues:[...result.issues,...result.releaseIssues],purchases:result.purchases,surfaces:ids.filter(id=>id.startsWith('surface:'))};
}

export function releasedSurfaceDXF(doc,unitId){
 if(typeof unitId!=='string'||!unitId.startsWith('surface:'))return null;
 const t=kitchenGeometry(doc.kitchen,doc.room).worktops.find(top=>'surface:'+top.id===unitId);
 return t&&verifiedPattern(doc,t)?surfaceDXF(doc,t):null;
}

export function releasedScribeDXF(doc,unitId,anchor){
 if(typeof anchor!=='string'||!/^[0-9a-f]{64}$/.test(anchor))return null;
 const part=buildFactoryQuote(doc,{unitIds:[unitId]}).pieces.find(p=>p.unitId===unitId&&p.scribe?.anchor===anchor);
 return part?scribeDXF(part):null;
}
