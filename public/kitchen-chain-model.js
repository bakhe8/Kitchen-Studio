import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {wallPairReleaseIssues,wallPairSpans,unresolvedWallPairs} from './kitchen-wall-pair-fit.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {cornerReservations} from './kitchen-production-row-corners.js';
import {optionEnvelopes,wallUpperBands,readWallOptions,heaterServiceIssues,profileIssues,baseBandFor} from './kitchen-chain-options.js';
import {architectureWall,architectureWallIdKnown} from './kitchen-architecture.js';
import {createKitchen,kitchenFeatureSpecs,kitchenGeometry,kitchenRunLocal,kitchenRunPolygon,validateSurveyFeatureChange} from './kitchen-model.js';
import {creationDefaults} from './kitchen-defaults-calculations.js';
import {fittingStarts} from './kitchen-placement.js';
import {polygonBounds} from './kitchen-oriented.js';

const markers=new Set(['start','stop','corner']);
export const pointKinds=new Set(['water','drain','vent','gas','electric']);
export const chainLabels={start:'بداية الدواليب',stop:'نهاية الدواليب',corner:'الزاوية التالية',...Object.fromEntries(Object.entries(kitchenFeatureSpecs).map(([key,spec])=>[key,spec.label]))};
const bounded=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,28}$/i.test(id)&&!inheritedName(id);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const err=reason=>({ok:false,reason});
const number=n=>new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(n);
const rounded=n=>Math.round(n*1e6)/1e6;
const featureId=(wall,row)=>row.featureId||'chain-'+wall+'-'+row.id;
const isCadId=id=>typeof id==='string'&&/^[a-zA-Z0-9][\w-]{0,79}$/.test(id)&&!inheritedName(id);

// Distances follow the surveyed sequence, not the left edge of a generic symbol.
// Feature widths include the outer casing on openings. Services reference their
// horizontal and vertical centre; the CAD stores their near edge and bottom.
function cleanChain(raw){
 if(!record(raw)||!Array.isArray(raw.rows)||raw.rows.length>64)return null;
 const ids=new Set(),links=new Set(),rows=[];let station=0;
 for(const input of raw.rows){
  if(!record(input)||!validId(input.id)||ids.has(input.id)||!ownKey(chainLabels,input.kind)||!bounded(input.gapMm,0,18000))return null;
  ids.add(input.id);
  const row={id:input.id,kind:input.kind,gapMm:input.gapMm};
  if(input.from!=null&&!['previous','origin'].includes(input.from))return null;
  if(input.from==='origin')row.from='origin';
  station=(row.from==='origin'?0:station)+row.gapMm;
  let width=input.widthMm;
  if(input.frameRead!==undefined){
   const v=input.frameRead;if(!['door','window'].includes(row.kind)||!v||!['station','opposite'].includes(v.method)||!bounded(v.distanceMm,0,18000)||
    v.method==='opposite'&&!bounded(v.wallLengthMm,10,18000))return null;
   row.frameRead={method:v.method,distanceMm:v.distanceMm,...(v.method==='opposite'?{wallLengthMm:v.wallLengthMm}:{})};
   const far=v.method==='station'?v.distanceMm:v.wallLengthMm-v.distanceMm;
   width=rounded(far-station);
  }
  if(!markers.has(row.kind)){
   if(input.featureId!==undefined){
    if(!isCadId(input.featureId)||links.has(input.featureId))return null;
    links.add(input.featureId);row.featureId=input.featureId;
   }
   if(!bounded(width,10,5000)||!bounded(input.bottomMm,0,6000)||!bounded(input.heightMm,10,6000)||!bounded(input.depthMm,10,5000))return null;
   row.widthMm=width;for(const k of ['bottomMm','heightMm','depthMm'])row[k]=input[k];
   if(!pointKinds.has(row.kind))station+=width;
   if(row.kind==='door'||row.kind==='window'){
    if(input.swing!=null&&!(row.kind==='window'?['fixed','in','out','sliding']:['in','out','sliding']).includes(input.swing))return null;
    if(input.hinge!=null&&!['left','right'].includes(input.hinge))return null;
    if(input.swing)row.swing=input.swing;
    if(input.hinge)row.hinge=input.hinge;
    if(input.parking!==undefined){if(!['within','before','after'].includes(input.parking))return null;row.parking=input.parking;}
    for(const key of ['leafWidthMm','hingeInsetMm','parkDepthMm']){
      if(input[key]==null)continue;
      if(!bounded(input[key],key==='hingeInsetMm'?0:1,key==='parkDepthMm'?3000:row.widthMm))return null;
      row[key]=input[key];
    }
    if(row.leafWidthMm!=null&&row.hingeInsetMm!=null&&row.leafWidthMm+row.hingeInsetMm>row.widthMm)return null;
   }
  }
  rows.push(row);
 }
 if(raw.source!=null&&!['field','example','drawing'].includes(raw.source))return null;
 const result={source:raw.source||'drawing',rows};
 if(raw.attestation!=null){
  const a=raw.attestation;
  if(!record(a)||!['name','reference'].every(k=>typeof a[k]==='string'&&a[k].trim()&&a[k].length<=160)||!Number.isFinite(Date.parse(a.date))||!/^s-[0-9a-f]{64}$/.test(a.key))return null;
  result.attestation={name:a.name.trim(),reference:a.reference.trim(),date:a.date,key:a.key};
 }
 return result;
}

export function cleanChains(raw){
 if(!record(raw)||Object.keys(raw).length>32)return null;
 const out={};
 for(const [wall,value] of Object.entries(raw)){
  const clean=cleanChain(value);
  if(!architectureWallIdKnown(wall)||!clean)return null;
  out[wall]=clean;
 }
 return out;
}

export function newChainRow(kind,id){
 const row={id,kind,gapMm:0},spec=kitchenFeatureSpecs[kind];
 if(!spec)return row;
 return {...row,widthMm:10*spec.width,heightMm:10*spec.height,depthMm:10*spec.depth,
  bottomMm:10*(spec.bottom+(pointKinds.has(kind)?spec.height/2:0))};
}

export function resolveChain(room,wall,chain){
 const edge=architectureWall(room,wall),clean=cleanChain(chain);
 if(!edge||!clean)return err('راجع المسافات والأبعاد ونوع كل قياس. كل الحقول العددية بالملليمتر.');
 const end=10*edge.end,origin=10*edge.start,features=[],readings=[];
 let cursor=origin,startMm=null,endMm=null,closed=false;
 for(const row of clean.rows){
  if(row.frameRead?.method==='opposite'&&Math.abs(row.frameRead.wallLengthMm-(end-origin))>.5)return err('طول الجدار المقاس بين الركنين لا يطابق وجه الجدار الحالي. راجع الطول قبل حساب البرواز من الركن المقابل.');
  if(closed)return err('يجب أن يكون قياس الزاوية التالية آخر قياس على هذا الجدار.');
  cursor=(row.from==='origin'?origin:cursor)+row.gapMm;
  const ref=cursor,center=pointKinds.has(row.kind);
  if(row.kind==='start'){
   if(startMm!==null||endMm!==null)return err('حدّد بداية واحدة للدواليب قبل نهايتها.');
   startMm=cursor;
  }else if(row.kind==='stop'){
   if(endMm!==null)return err('حدّد نهاية واحدة للدواليب.');
   endMm=cursor;
  }else if(row.kind==='corner'){
   closed=true;
   if(Math.abs(cursor-end)>.5)return err('فرق إغلاق الجدار '+number(rounded(cursor-end))+' مم. راجع قياس الركن أو طول الجدار في بناء الغرفة.');
  }else{
   const left=center?cursor-row.widthMm/2:cursor,lower=center?row.bottomMm-row.heightMm/2:row.bottomMm;
   if(left<origin-1e-6||left+row.widthMm>end+1e-6||lower<0||lower+row.heightMm>room.height*10+1e-6)return err('حدود «'+chainLabels[row.kind]+'» تتجاوز وجه الجدار أو السقف. راجع المقاس والمرجع.');
   const f={id:featureId(wall,row),kind:row.kind,wall,u:left/10,width:row.widthMm/10,depth:row.depthMm/10,bottom:lower/10,height:row.heightMm/10};
   if(row.swing)f.swing=row.swing;
   if(row.hinge)f.hinge=row.hinge;if(row.parking)f.parking=row.parking;
   for(const k of ['leafWidth','hingeInset','parkDepth'])if(row[k+'Mm']!=null)f[k]=row[k+'Mm']/10;
   features.push(f);
   if(!center)cursor+=row.widthMm;
  }
  if(cursor>end+.5)return err('تجاوزت السلسلة طول الجدار بمقدار '+number(cursor-end)+' مم.');
  readings.push({id:row.id,kind:row.kind,refMm:rounded(ref-origin),nextMm:rounded(cursor-origin)});
 }
 startMm=startMm??origin;endMm=endMm??end;
 if(endMm<=startMm)return err('يجب أن تقع نهاية الدواليب بعد بدايتها.');
 return {ok:true,features,readings,closed,remainingMm:rounded(end-cursor),startMm:rounded(startMm),endMm:rounded(endMm),lengthMm:rounded(endMm-startMm),wall};
}

function chainProofKey(doc,wall,chain){
 const clean=cleanChain(chain),edge=architectureWall(doc.room,wall);
 if(!clean||!edge)return '';
 const datum=[edge.id,edge.a.x,edge.a.z,edge.b.x,edge.b.z,edge.start,edge.end,doc.room.height];
 return 's-'+offlineDigest(new TextEncoder().encode(JSON.stringify([datum,clean.rows])));
}
export function attestChain(doc,wall,raw,{name,reference,date=new Date().toISOString()}={}){
 if(![name,reference].every(v=>typeof v==='string'&&v.trim()&&v.trim().length<=160)||!Number.isFinite(Date.parse(date)))return err('أدخل اسم الفني ومرجع القياس الميداني لربطهما بهذه المراجعة.');
 const chain=cleanChain(raw),resolved=resolveChain(doc.room,wall,raw);
 if(!resolved.ok||!chain.rows.length)return err(resolved.reason||'أضف قياسًا فعليًا قبل اعتماد الجدار.');
 return {ok:true,chain:{...chain,source:'field',attestation:{name:name.trim(),reference:reference.trim(),date,key:chainProofKey(doc,wall,chain)}}};
}
// Check the selected project's actual CAD object against the technician's
// signed wall survey. A signature alone cannot validate a later CAD-only edit.
export function confirmedChainFeature(doc,feature){
 const chain=doc.room.workshop?.chains?.[feature?.wall];
 if(!feature||chain?.source!=='field'||!chain.attestation||chain.attestation.key!==chainProofKey(doc,feature.wall,chain))return false;
 const range=resolveChain(doc.room,feature.wall,chain);return range.ok&&range.features.some(f=>f.id===feature.id&&sameSurveyReading(f,feature));
}
export function siteReleaseIssues(doc,scope,locate){
 const walls=new Set(scope?.walls||[]),unitIds=new Set(scope?.unitIds||[]),runIds=new Set(scope?.runIds||[]);
 for(const u of doc.kitchen.units)if(unitIds.has(u.id)||!scope)runIds.add(u.runId);
 const runs=doc.kitchen.runs.filter(r=>runIds.has(r.id)||(!scope&&doc.room.workshop?.rows?.[r.id]));
 for(const r of runs)if(r.wall)walls.add(r.wall);
 const issues=wallPairReleaseIssues(doc,scope,locate);
 if(!scope)for(const c of Object.values(doc.room.workshop?.corners||{}))if(c.base?.build||c.upper?.build){walls.add(c.a);walls.add(c.b);}
 for(const wall of walls){
  const first=issues.length;
  const chain=doc.room.workshop?.chains?.[wall],name=architectureWall(doc.room,wall)?.label||wall;
  if(!chain||chain.source!=='field'||!chain.attestation||chain.attestation.key!==chainProofKey(doc,wall,chain)){issues.push('تحتاج قياسات '+name+' إلى تأكيد الفني ومرجع الرفع لهذه النسخة.');locate?.(issues.at(-1),'proof',{wall,proof:true});continue;}
  const range=readChainRange(doc,wall);
  if(!range){issues.push('تغيّرت هندسة '+name+' بعد اعتماد القياس. راجع السلسلة.');locate?.(issues.at(-1),'survey',{wall});continue;}
  const surveyed=new Set(range.features.map(f=>f.id));
  if(doc.kitchen.features.some(f=>f.wall===wall&&!surveyed.has(f.id)))issues.push('على '+name+' عنصر مرسوم لم يرتبط بالرفع المعتمد.');
  for(const f of range.features){
   if(f.kind!=='door'&&f.kind!=='window')continue;
   const label=(f.kind==='door'?'الباب ':'الشباك ')+f.id;
   if(!f.swing)issues.push('حدّد حركة '+label+' على '+name+'.');
   if(f.swing==='in'&&(!f.hinge||!f.leafWidth||f.hingeInset==null))issues.push('أكمل عرض ضلفة '+label+' ومكان المفصلة بالنسبة للبرواز الخارجي.');
   if(f.swing==='sliding'){
    if(!f.parking||f.parking!=='within'&&(!f.leafWidth||!f.parkDepth))issues.push('حدّد موضع توقف ضلفة '+label+' وبروز السكة عند الانزلاق بمحاذاة الجدار.');
    else if(f.parking!=='within'){
     const w=architectureWall(doc.room,wall),lo=f.parking==='before'?f.u-f.leafWidth:f.u+f.width;
     if(lo<w.start||lo+f.leafWidth>w.end)issues.push('موضع توقف ضلفة '+label+' يمتد خارج هذا الجدار.');
    }
   }
  }
  if(locate)for(const issue of issues.slice(first))locate(issue,'survey',{wall});
  const heaters=heaterServiceIssues(doc,wall),profiles=profileIssues(doc,wall);
  issues.push(...heaters,...profiles);
  if(locate){
   for(const issue of heaters)locate(issue,'wallOptions',{wall});
   for(const issue of profiles)locate(issue,'profile',{wall});
  }
 }
 const extended=optionEnvelopes(doc),specialIds=new Set(extended.map(x=>x.id));
 const selectedUnits=scope?unitIds:new Set(doc.kitchen.units.map(u=>u.id));
 const active=new Set([...selectedUnits,...runIds]);
 const k={...doc.kitchen,units:doc.kitchen.units.map(u=>selectedUnits.has(u.id)?{...u,open:true}:u),features:[...doc.kitchen.features,...extended]};
 const geo=kitchenGeometry(k,doc.room);
 for(const c of geo.conflicts){
  if(!c.ids.some(id=>active.has(id)))continue;
  if(c.stableKey?.includes('floor-service-access:')||c.ids.some(i=>specialIds.has(i))&&['open-feature','body-feature','top-feature','door-swing'].includes(c.type))issues.push(c.label);
 }
 return [...new Set(issues)];
}
function ownedFeatureIDs(chain,wall){
 return new Set((chain?.rows||[]).filter(r=>!markers.has(r.kind)).map(r=>featureId(wall,r)));
}

export function linkedReadingIndex(room,feature){
 if(!feature)return -1;
 return room.workshop?.chains?.[feature.wall]?.rows.findIndex(row=>row.kind===feature.kind&&featureId(feature.wall,row)===feature.id)??-1;
}

export function chainFromDrawing(doc,wall){
 const edge=architectureWall(doc.room,wall),origin=edge.start*10;
 const features=doc.kitchen.features.filter(f=>f.wall===wall).sort((a,b)=>a.u-b.u);
 let last=origin;
 const rows=features.map((f,index)=>{
  const center=pointKinds.has(f.kind),u=10*f.u+(center?5*f.width:0);
  const fromOrigin=u<last-.000001;
  const row={id:'cad'+(index+1),kind:f.kind,featureId:f.id,gapMm:rounded(Math.max(0,u-(fromOrigin?origin:last))),
   widthMm:rounded(10*f.width),bottomMm:rounded(10*f.bottom+(center?5*f.height:0)),heightMm:rounded(10*f.height),depthMm:rounded(10*f.depth)};
  if(fromOrigin)row.from='origin';
  if(f.hinge)row.hinge=f.hinge;if(f.parking)row.parking=f.parking;
  for(const k of ['leafWidth','hingeInset','parkDepth'])if(f[k]!=null)row[k+'Mm']=rounded(f[k]*10);
  if(f.swing)row.swing=f.swing;
  last=u+(center?0:row.widthMm);
  return row;
 });
 return {source:'drawing',rows};
}

export function sameSurveyReading(a,b){
 return a&&b&&a.id===b.id&&a.kind===b.kind&&a.wall===b.wall&&['u','width','bottom','depth','height'].every(k=>Math.abs(a[k]-b[k])<.000001)&&
   ['hinge','swing','parking','leafWidth','hingeInset','parkDepth'].every(k=>a[k]===b[k]);
}

// The field record is authoritative for the building. A conflicting cabinet
// remains in the design for review; taking a measurement never moves it.
export function applyChain(doc,wall,chain,{restoreModified=false}={}){
 const old=doc.room.workshop?.chains?.[wall],result=resolveChain(doc.room,wall,chain);
 if(!result.ok)return result;
 const oldIds=ownedFeatureIDs(old,wall),newIds=ownedFeatureIDs(chain,wall);
 const existingById=new Map(doc.kitchen.features.map(f=>[f.id,f]));
 const prior=old?resolveChain(doc.room,wall,old):null;
 // A separate CAD edit can change a measured object since the last survey.
 // Offer explicit reconciliation, and never take ownership of another wall.
 if(prior?.ok&&!restoreModified&&prior.features.some(f=>!sameSurveyReading(existingById.get(f.id),f))){
  return {ok:false,stale:true,reason:'تغيّر عنصر في الرسم منذ حفظ السلسلة. استرجع مقاسات السلسلة صراحة أو حرّر الرسم أولًا.'};
 }
 for(const id of oldIds){const f=existingById.get(id);if(f&&f.wall!==wall)return err('نُقل عنصر من هذه السلسلة إلى جدار آخر. راجع موضعه في الرسم.');}
 const adopting=new Set();
 for(const row of chain.rows.filter(r=>r.featureId)){
  const f=existingById.get(row.featureId);
  if(oldIds.has(row.featureId))continue;
  if(!f||f.wall!==wall||f.kind!==row.kind)return err('لم يُعثر على العنصر المرجعي على الجدار المحدد.');
  adopting.add(row.featureId);
 }
 const seen=new Set([...doc.kitchen.features.filter(f=>!oldIds.has(f.id)&&!adopting.has(f.id)),...doc.kitchen.runs,...doc.kitchen.units].map(f=>f.id));
 for(const id of newIds)if(seen.has(id))return err('معرّف أحد القياسات مستخدم في الرسم. أعد إنشاء القياس.');
 const keptFeatures=doc.kitchen.features.filter(f=>!oldIds.has(f.id)&&!adopting.has(f.id));
 const features=result.features.map(f=>{
  const prior=existingById.get(f.id);
  return prior?{...f,...(prior.glazing&&f.kind==='window'?{glazing:prior.glazing}:{}),
   ...(prior.adjacent&&['door','window'].includes(f.kind)?{adjacent:prior.adjacent}:{})}:f;
 });
 const kitchen={...doc.kitchen,features:[...keptFeatures,...features]};
 const guard=validateSurveyFeatureChange(doc.kitchen,doc.room,kitchen,doc.room,newIds);
 if(!guard.ok)return err(guard.reason);
 const chains={...doc.room.workshop?.chains,[wall]:cleanChain(chain)};
 const room={...doc.room,workshop:{...doc.room.workshop,chains,activeWall:wall}};
 return {...result,designConflicts:guard.designConflicts,doc:{...doc,room,kitchen}};
}

function surveySpans(doc,range,tier,geometry,defaults,band){
 const base=tier==='base',run={wall:range.wall,tier,start:range.startMm/10,end:range.endMm/10,
  depth:base?defaults.baseDepth:defaults.upperDepth,height:base?defaults.baseHeight:defaults.upperHeight,bottom:base?0:defaults.upperBottom,...(base?baseBandFor(doc,range.wall,range.startMm,range.endMm,defaults):{}),...band};
 if(run.height<=0)return [];
 const width=.001,u=run.start,polygon=kitchenRunPolygon(doc.room,run,u,width,run.depth);
 const probe={...run,id:'survey-probe',kind:'storage',u,polygon,width,rect:polygonBounds(polygon),supportsWorktop:base};
 let spans=fittingStarts(geometry,run,probe,p=>kitchenRunLocal(doc.room,run,p)).map(s=>({
  startMm:rounded(s.start*10),endMm:rounded((s.end+width)*10)})).filter(s=>s.endMm>s.startMm);
 for(const gap of cornerReservations(doc,run)){
  const lo=gap.u*10,hi=(gap.u+gap.width)*10;
  spans=spans.flatMap(s=>hi<=s.startMm||lo>=s.endMm?[s]:[
    ...(s.startMm<lo?[{startMm:s.startMm,endMm:lo}]:[]),...(hi<s.endMm?[{startMm:hi,endMm:s.endMm}]:[])]);
 }
 return wallPairSpans(doc,run,spans);
}

// A partial walk can be saved for later. Design handoff needs an explicit
// end of cabinetry or an independently closed wall, as well as valid CAD.
export function surveyedDesignRange(doc,wall){
 const rows=doc.room.workshop?.chains?.[wall]?.rows||[];
 return rows.some(r=>r.kind==='stop'||r.kind==='corner')?readChainRange(doc,wall):null;
}

export function surveyedDesignWalls(doc){
 return Object.keys(doc.room.workshop?.chains||{}).filter(wall=>surveyedDesignRange(doc,wall));
}

export function readChainRange(doc,wall){
 const chain=doc.room.workshop?.chains?.[wall];
 if(!chain?.rows?.length)return null;
 const range=resolveChain(doc.room,wall,chain);
 if(!range.ok||range.features.some(f=>!sameSurveyReading(f,doc.kitchen.features.find(x=>x.id===f.id))))return null;
 const shell={...doc.kitchen,features:[...doc.kitchen.features,...optionEnvelopes(doc)],runs:[],units:[]};
 const geometry=kitchenGeometry(shell,doc.room),defaults=creationDefaults(doc);
 const bands=wallUpperBands(doc,wall),upperBandSpans=bands.map(band=>surveySpans(doc,range,'upper',geometry,defaults,band));
 const opts=readWallOptions(doc,wall),out={...range,baseSpans:surveySpans(doc,range,'base',geometry,defaults),upperSpans:upperBandSpans[0]||[],upperBandSpans};
 const pairPending=unresolvedWallPairs(doc,wall);if(pairPending)out.pairPending=pairPending;
 if(opts.factoryTrim?.cornice&&opts.cornice.enabled&&bands.length){
  const last=bands.at(-1),bottom=last.bottom+last.height;
  const clearance=surveySpans(doc,range,'upper',geometry,defaults,{bottom,height:opts.cornice.heightMm/10,depth:last.depth+opts.cornice.projectionMm/10});
  out.corniceSpans=upperBandSpans.at(-1).flatMap(edge=>clearance.map(clear=>({startMm:Math.max(edge.startMm,clear.startMm),endMm:Math.min(edge.endMm,clear.endMm)})).filter(s=>s.endMm>s.startMm));
 }
 if(opts.mode==='filler'&&bands.length){
  const bottom=bands[0].bottom+bands[0].height,height=doc.room.height-bottom-opts.headMm/10-(opts.cornice.enabled?opts.cornice.heightMm/10:0);
  out.fillerSpans=height>0?surveySpans(doc,range,'upper',geometry,defaults,{bottom,height,depth:opts.depthMm/10}):[];
 }
 return out;
}

export function makeChainExample(){
 const room={width:500,length:500,height:280,colors:{},name:'مثال رفع ٥ × ٥'};
 const r=(kind,id,gapMm,extra={})=>({...newChainRow(kind,id),gapMm,...extra});
 const main={source:'example',rows:[
  r('door','entrance',400,{widthMm:900,heightMm:2100,swing:'out',hinge:'left'}),
  r('start','begin',0),r('window','window',700,{widthMm:1200,bottomMm:1150,heightMm:1000,swing:'sliding',parking:'within'}),
  r('water','water',600,{bottomMm:500}),r('drain','drain',0,{bottomMm:350}),
  r('stop','finish',500),r('corner','end',700)]};
 const pantry={source:'example',rows:[r('door','pantry',600,{widthMm:800,heightMm:2100,swing:'out',hinge:'right'}),r('corner','end',3600)]};
 let doc={room,kitchen:createKitchen(room,'empty')};
 for(const [wall,chain] of [['right',pantry],['back',main]]){
  const result=applyChain(doc,wall,chain);
  if(!result.ok)throw Error(result.reason);
  doc=result.doc;
 }
 return doc;
}
