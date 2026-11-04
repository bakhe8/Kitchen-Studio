import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {spanFits} from './kitchen-workshop-factory-stock.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {cleanWindowChoice,cleanWindowChoices,wallWindows,wallUniformHeight,windowIntervals,horizontalSill,sillProof} from './kitchen-upstand-window.js';
import {wallPairEndEvidence} from './kitchen-wall-pair.js';
// Stone strip at the finished countertop/wall junction. CAD is in cm; this
// module exposes millimetres on the architectural wall's absolute station axis.
import {architectureWallIdKnown,architectureWallLocal,architectureWallLabel,roomArchitecture} from './kitchen-architecture.js';
import {kitchenGeometry,kitchenRunPoint} from './kitchen-model.js';
import {verifiedPattern} from './kitchen-surface-pattern.js';
import {cleanSurfaceTemplate,surfaceKey} from './kitchen-surface-release.js';
import {siteReleaseIssues} from './kitchen-chain-model.js';

const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,47}$/.test(v)&&!inheritedName(v);
const label=v=>typeof v==='string'&&v.trim().length>0&&v.length<=160;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const mm=v=>Number.isFinite(v)&&v>0&&v<=100000;
const station=v=>Number.isFinite(v)&&v>=0&&v<=1000000;
const round=v=>Math.round(v*1000)/1000;
const epsilon=.0001; // numeric noise in mm, never a fitting allowance
const wallContactMm=10; // the most a measured template edge may sit off the wall plane and still count as meeting the wall
const blank=()=>({mode:'undecided'});

export function cleanUpstandProfiles(raw,items){
 if(!Array.isArray(raw)||raw.length>80||!Array.isArray(items))return null;
 const seen=new Set(),out=[];
 for(const p of raw){
  const stock=items.find(i=>i.sku===p?.sku);
  if(!p||!id(p.id)||seen.has(p.id)||!label(p.reference)||!mm(p.heightMm)||!stock||stock.kind!=='panel'||!mm(stock.thicknessMm)||stock.stockWidthMm<p.heightMm||p.minCutHeightMm!==undefined&&(!mm(p.minCutHeightMm)||p.minCutHeightMm>p.heightMm))return null;
  seen.add(p.id);out.push({id:p.id,sku:stock.sku,heightMm:p.heightMm,reference:p.reference.trim(),...(p.minCutHeightMm===undefined?{}:{minCutHeightMm:p.minCutHeightMm})});
 }
 return out;
}
function cleanChoice(v){
 if(!object(v))return null;
 if(['none','undecided'].includes(v.mode))return {mode:v.mode};
 if(v.mode==='factory'&&id(v.profileId))return {mode:v.mode,profileId:v.profileId};
 if(v.mode==='supplier'&&label(v.material)&&mm(v.thicknessMm)&&mm(v.heightMm)&&(v.minCutHeightMm===undefined||mm(v.minCutHeightMm)&&v.minCutHeightMm<=v.heightMm))
  return {mode:v.mode,material:v.material.trim(),heightMm:v.heightMm,thicknessMm:v.thicknessMm,...(v.minCutHeightMm===undefined?{}:{minCutHeightMm:v.minCutHeightMm})};
 return null;
}
function cleanSeamChoice(v){
 if(!object(v)||!/^seam-[a-f0-9]{64}$/.test(v.datum)||!label(v.reference)||!Array.isArray(v.stationsMm)||!v.stationsMm.length||v.stationsMm.length>64||
    v.stationsMm.some((x,i)=>!station(x)||round(x)!==x||i>0&&x<=v.stationsMm[i-1]))return null;
 return {datum:v.datum,reference:v.reference.trim(),stationsMm:[...v.stationsMm]};
}
function cleanSeams(v){
 if(!object(v)||Object.keys(v).length>512)return null;
 const result={};
 for(const [key,value] of Object.entries(v)){
  const parts=key.split('/');if(parts.length!==4||!architectureWallIdKnown(parts[0])||parts.slice(1).some(k=>!/^\d{1,6}(\.\d{1,3})?$/.test(k)))return null;
  const choice=cleanSeamChoice(value);if(!choice)return null;
  result[key]=choice;
 }return result;
}
export function cleanUpstandSpec(v){
 if(!object(v))return null;
 const choice=cleanChoice(v.choice),walls={},omitted=[];
 if(!choice||v.walls!==undefined&&(!object(v.walls)||Object.keys(v.walls).length>128))return null;
 for(const [wall,value] of Object.entries(v.walls||{})){
  const q=cleanChoice(value);if(!architectureWallIdKnown(wall)||!q)return null;walls[wall]=q;
 }
 if(v.omitted!==undefined&&(!Array.isArray(v.omitted)||v.omitted.length>512))return null;
 const seen=new Set();
 for(const p of v.omitted||[]){
  if(!p||!architectureWallIdKnown(p.wall)||![p.fromMm,p.toMm,p.bottomMm].every(station)||p.toMm<=p.fromMm)return null;
  const edge={wall:p.wall,fromMm:p.fromMm,toMm:p.toMm,bottomMm:p.bottomMm};
  const k=edgeKey(edge);if(seen.has(k))return null;seen.add(k);omitted.push(edge);
 }
 const windowChoices=v.windowChoices===undefined?{}:cleanWindowChoices(v.windowChoices);if(!windowChoices)return null;
 const seamChoices=v.seamChoices===undefined?{}:cleanSeams(v.seamChoices);if(!seamChoices)return null;
 return {choice,walls,...(Object.keys(seamChoices).length?{seamChoices}:{}),...(omitted.length?{omitted}:{}),...(Object.keys(windowChoices).length?{windowChoices}:{})};
}
const edgeKey=s=>[s.wall,s.fromMm,s.toMm,s.bottomMm].join('/');
const edgeRef=s=>({wall:s.wall,fromMm:s.fromMm,toMm:s.toMm,bottomMm:s.bottomMm});
const overlap=(a,b,c,d)=>Math.min(b,d)-Math.max(a,c)>epsilon;
function mergeSpans(spans){
 const merged=[];
 for(const s of spans.sort((a,b)=>a.start-b.start)){
  const prev=merged.at(-1);
  if(prev&&s.start<=prev.end+epsilon){prev.end=Math.max(prev.end,s.end);for(const t of s.tops)prev.tops.add(t);}
  else merged.push({...s,tops:new Set(s.tops)});
 }
 return merged;
}
function minus(a,b,gaps){
 const parts=[];let cursor=a;
 for(const cut of gaps){
  if(cut.end<=cursor||cut.start>=b)continue;
  if(cut.start>cursor+epsilon)parts.push([cursor,cut.start]);
  cursor=Math.max(cursor,cut.end);
 }
 if(b>cursor+epsilon)parts.push([cursor,b]);return parts;
}
function contacts(doc,g,walls){
 const groups=new Map(),validPatterns=new Set(),invalidPatterns=new Set(),datumParts=new Map(),solidTops=[],runs=new Map(g.runs.map(r=>[r.id,r]));
 for(const t of g.worktops){
  const raw=doc.room.workshop?.surfacePatterns?.[t.id],pattern=raw&&verifiedPattern(doc,t);
  if(pattern)validPatterns.add(t.id);else if(raw)invalidPatterns.add(t.id);
  const run=runs.get(t.runId),poly=pattern?pattern.outer.map(([x,y])=>kitchenRunPoint(g.room,run,t.start+x/10,y/10)):t.polygon;
  // A nominal edge lies exactly on the wall plane. A measured template edge only lies within the fit tolerance the
  // inspector recorded for it, so that tolerance (capped) decides whether the edge still meets the wall. Requiring
  // exact coincidence silently dropped the strip for any real measurement (an offset of 0.0005 mm was enough).
  const reach=pattern?Math.min(wallContactMm,Math.max(epsilon,pattern.fitToleranceMm)):epsilon;
  const bottomMm=round((t.bottom+t.height)*10);
  datumParts.set(t.id,[t.id,t.bottom,t.height,t.polygon,pattern?.outer||null,raw&&!pattern?'unverified':null]);
  solidTops.push({id:t.id,bottomMm:t.bottom*10,topMm:bottomMm,polygon:poly,patternStale:!!raw&&!pattern});
  for(const w of walls){
   const local=poly.map(p=>architectureWallLocal(g.room,w.id,p));
   for(let i=0;i<local.length;i++){
    const a=local[i],b=local[(i+1)%local.length];
    if(Math.abs(a.d*10)>reach||Math.abs(b.d*10)>reach)continue;
    const start=round(10*Math.max(w.start,Math.min(a.u,b.u))),end=round(10*Math.min(w.end,Math.max(a.u,b.u)));
    if(end-start<=epsilon)continue;
    const key=w.id+'/'+bottomMm;if(!groups.has(key))groups.set(key,{wall:w.id,bottomMm,spans:[]});
    groups.get(key).spans.push({start,end,tops:[t.id]});
   }
  }
 }
 return {groups,validPatterns,invalidPatterns,datumParts,solidTops};
}
const solid=new Set(['door','window','column','shaft','beam','heater']);
function blocked(g,w,base,height,thickness){
 const spans=[];
 for(const f of g.features){
  if(f.kind==='window'||f.wall!==w||!solid.has(f.kind)||(f.planningOffset||0)*10>=thickness||!overlap(base,base+height,f.bottom*10,(f.bottom+f.height)*10))continue;
  spans.push({start:f.u*10,end:(f.u+f.width)*10,tops:[]});
 }
 // An upper cabinet or a projecting measured object can start within the strip.
 for(const u of g.units){
  if(u.wall!==w||u.tier!=='upper'||!overlap(base,base+height,u.bottom*10,(u.bottom+u.height)*10))continue;
  spans.push({start:u.u*10,end:(u.u+u.width)*10,tops:[]});
 }
 return mergeSpans(spans);
}
function resolve(q,cat){
 if(q.mode==='supplier')return q;
 if(q.mode!=='factory')return null;
 const p=cat?.upstandProfiles?.find(p=>p.id===q.profileId),item=cat?.items?.find(i=>i.sku===p?.sku);
 if(!p||!item||item.kind!=='panel'||!mm(item.thicknessMm)||!mm(p.heightMm))return null;
 return {...q,sku:item.sku,reference:p.reference,heightMm:p.heightMm,thicknessMm:item.thicknessMm,material:item.name,...(p.minCutHeightMm===undefined?{}:{minCutHeightMm:p.minCutHeightMm}),...(item.colorHex?{color:item.colorHex}:{})};
}
function joinCorners(doc,segments,walls,issues){
 // At a square internal corner, the earlier architectural wall runs through.
 // The meeting strip stops at its exposed face, avoiding a charged overlap.
 for(let i=0;i<walls.length;i++){
  const a=walls[i],b=walls[(i+1)%walls.length];
  const left=segments.filter(s=>s.wall===a.id&&Math.abs(s.ref.toMm-a.end*10)<.001);
  const right=segments.filter(s=>s.wall===b.id&&Math.abs(s.ref.fromMm-b.start*10)<.001);
  const cross=a.tangent.x*b.tangent.z-a.tangent.z*b.tangent.x,dot=a.tangent.x*b.tangent.x+a.tangent.z*b.tangent.z;
  for(const x of left)for(const y of right){
   if(!overlap(x.bottomMm,x.bottomMm+x.heightMm,y.bottomMm,y.bottomMm+y.heightMm))continue;
   const low=Math.max(x.bottomMm,y.bottomMm),high=Math.min(x.bottomMm+x.heightMm,y.bottomMm+y.heightMm);
   const measuredOblique=[[a.id,'end'],[b.id,'start']].some(([wall,side])=>{
    const evidence=wallPairEndEvidence(doc,wall,side,'base',low,high);
    return evidence?.oblique;
   });
   if(measuredOblique||cross<=0||Math.abs(dot)>1e-7||x.bottomMm!==y.bottomMm||x.heightMm!==y.heightMm){
    const msg='وصلة نعلة '+architectureWallLabel(a.id)+' مع '+architectureWallLabel(b.id)+' تحتاج قالب زاوية أو تفصيل اختلاف المنسوب.';
    issues.add(msg);x.needsTemplate=y.needsTemplate=true;continue;
   }
   if(i<walls.length-1)y.fromMm=round(y.fromMm+x.thicknessMm);else x.toMm=round(x.toMm-y.thicknessMm);
  }
 }
}
function seamRequest(s,stock,windows,choices){
 if(!stock||spanFits(stock.stockLengthMm,s.lengthMm,stock.kerfMm||0))return null;
 const relevant=windows.filter(w=>w.status==='resolved'&&w.choice&&w.wall===s.wall&&w.bottomMm===s.bottomMm&&
  (w.choice.kind==='uniform'||w.fromMm<=s.toMm+epsilon&&w.toMm>=s.fromMm-epsilon));
 if(!relevant.length)return null;
 const key=edgeKey(s.ref),datum='seam-'+offlineDigest(new TextEncoder().encode(JSON.stringify(
  [s.wall,s.fromMm,s.toMm,s.heightMm,s.bottomMm,s.thicknessMm,s.sku,s.profileId,s.reference,stock.stockLengthMm,stock.stockWidthMm,stock.kerfMm,
   relevant.map(w=>[w.key,w.datum,w.choice.kind,w.effectiveHeightMm])]))),choice=choices?.[key];
 const req={key,windowKey:relevant[0].key,windowId:relevant[0].windowId,wall:s.wall,fromMm:s.fromMm,toMm:s.toMm,lengthMm:s.lengthMm,heightMm:s.heightMm,bottomMm:s.bottomMm,stockLengthMm:stock.stockLengthMm,datum,choice,
  status:'pending',reason:'حدّد محطات وصل نعلة الرخام على الجدار ومرجعها في رسم الورشة؛ امتدادها لا يمكن قصه من لوح واحد.'};
 if(!choice)return req;
 if(choice.datum!==datum)return {...req,status:'stale',reason:'تغيّر مقاس الشريط أو الخام أو حدود الشباك. راجع محطات الوصل على المقاس الصافي.'};
 const end=[s.fromMm,...choice.stationsMm,s.toMm];
 if(end.slice(1).some((x,i)=>x<=end[i]+epsilon||!spanFits(stock.stockLengthMm,round(x-end[i]),stock.kerfMm||0))){
  return {...req,status:'invalid',reason:'كل وصلة يجب أن تقع داخل الشريط، وكل قطعة يجب أن تتسع في طول الخام مع قص المنشار.'};
 }
 return {...req,status:'resolved',reason:''};
}
export function worktopUpstandTakeoff(doc,catalog,geometry){
 const g=geometry||kitchenGeometry(doc.kitchen,doc.room),walls=roomArchitecture(g.room).walls;
 const raw=doc.room?.workshop?.upstand,spec=cleanUpstandSpec(raw)||{choice:blank(),walls:{}};
 const issues=new Set(),release=new Set(),decisions=new Set(),pieces=[],segments=[],supplier=[],edges=[],windows=[],sills=[],seamRequests=[];
 if(raw&&!cleanUpstandSpec(raw))issues.add('قرار نعلة رخام السطح غير صالح.');
 const state=contacts(doc,g,walls),chosenWalls=new Set(),factoryWalls=new Set();
 const omitted=new Map((spec.omitted||[]).map(p=>[edgeKey(p),p]));
 const candidates=new Set(),wallIds=new Set(walls.map(w=>w.id));
 for(const wall of Object.keys(spec.walls))if(!wallIds.has(wall))issues.add('اختيار نعلة مرتبط بجدار تغير في الرسم. راجع تخصيص الجدران.');
 for(const {wall,bottomMm,spans} of state.groups.values()){
  const q=spec.walls[wall]||spec.choice,label=architectureWallLabel(wall);
  chosenWalls.add(wall);
  if(q.mode==='none')continue;
  if(q.mode==='undecided'){decisions.add('لم يُحسم وجود نعلة رخام السطح على '+label+'.');continue;}
  const profile=resolve(q,catalog);
  if(!profile){issues.add('يلزم اختيار وصفة موجودة لنعلة '+label+' من كتالوج المصنع.');continue;}
  const contactsHere=mergeSpans(spans);
  const openingRows=wallWindows(doc,g,{wall,bottomMm},profile,contactsHere,state.datumParts,spec.windowChoices);
  windows.push(...openingRows);
  const height=wallUniformHeight(openingRows,profile.heightMm);
  for(const ctx of openingRows){
   const addition=horizontalSill(ctx,doc,catalog,contactsHere,state.solidTops);
   if(addition)sills.push(addition);
   const note=msg=>architectureWallLabel(wall)+' · شباك '+ctx.windowId+' · '+msg;
   if(ctx.requiredFrom){decisions.add(note(ctx.reason));release.add(note(ctx.reason));}
   if(ctx.sillRequiredFrom){decisions.add(note(ctx.sillReason));release.add(note(ctx.sillReason));}
  }
  const obstacles=new Map();
  for(const span of contactsHere)for(const zone of windowIntervals(span,openingRows,height)){
   if(!obstacles.has(zone.height))obstacles.set(zone.height,blocked(g,wall,bottomMm,zone.height,profile.thicknessMm));
   for(const [start,end] of minus(zone.start,zone.end,obstacles.get(zone.height))){
    const s={...profile,wall,fromMm:round(start),toMm:round(end),bottomMm,heightMm:zone.height};
    s.ref=edgeRef(s);
    const key=edgeKey(s);candidates.add(key);edges.push({...s.ref,omitted:omitted.has(key)});
    if(omitted.has(key))continue;
    s.tops=[...span.tops];segments.push(s);
    if(s.bottomMm+s.heightMm>g.room.height*10+epsilon){s.needsTemplate=true;release.add('تتجاوز نعلة '+label+' ارتفاع الجدار في الرسم. راجع الارتفاع المختار.');}
    if(g.features.some(f=>f.wall===wall&&!solid.has(f.kind)&&overlap(s.fromMm,s.toMm,f.u*10,(f.u+f.width)*10)&&overlap(bottomMm,bottomMm+s.heightMm,f.bottom*10,(f.bottom+f.height)*10))){
     s.needsTemplate=true;release.add('تتقاطع نعلة '+label+' مع نقطة خدمات. يلزم تفصيل فتحتها أو تعديل المسار.');
    }
   }
  }
 }
 const activeKeys=new Set(windows.map(w=>w.key));
 const orphanWindows=Object.keys(spec.windowChoices||{}).filter(key=>!activeKeys.has(key));
 for(const key of orphanWindows){const msg='تغيّرت حافة أو فتحة مرتبطة بقرار نعلة محفوظ ('+key+'). راجع الربط أو احذفه.';issues.add(msg);release.add(msg);}
 for(const key of omitted.keys())if(!candidates.has(key))issues.add('تغيّرت حافة سبق استثناؤها من نعلة الرخام. راجع الاستثناء ثم احذف ارتباطه القديم.');
 joinCorners(doc,segments,walls,release);
 const external=cleanSurfaceTemplate(doc.room.workshop?.surfaceTemplate);
 let confirmed=null;
 for(const s of segments){
  const wallLabel=architectureWallLabel(s.wall);s.lengthMm=round(s.toMm-s.fromMm);
  if(s.lengthMm<=0){issues.add('لا يتسع طرف نعلة '+wallLabel+' لسماكة وصلة الركن.');s.needsTemplate=true;continue;}
  if(s.mode==='supplier'){supplier.push({...s});continue;}
  factoryWalls.add(s.wall);
  if(!catalog?.approved){issues.add('وصفة نعلة رخام المصنع تنتظر اعتماد إصدار الكتالوج.');continue;}
  if(s.tops.some(t=>state.invalidPatterns.has(t))){release.add('تغيّر قالب السطح خلف نعلة '+wallLabel+'. أعد اعتماده.');s.needsTemplate=true;}
  if(!s.tops.every(t=>state.validPatterns.has(t))){
   if(confirmed===null)confirmed=!!external&&external.key===surfaceKey(doc);
   if(!confirmed)release.add('قص نعلة '+wallLabel+' ينتظر قالب السطح المرفوع بعد تركيب الوحدات وتسويتها.');
  }
  if(s.needsTemplate){issues.add('ينتظر حصر قطعة نعلة '+wallLabel+' بين '+s.fromMm+' و'+s.toMm+' مم حل التعارض أو اعتماد تفصيل قصها.');continue;}
  const request=seamRequest(s,catalog.items.find(i=>i.sku===s.sku),windows,spec.seamChoices);
  if(request){
   seamRequests.push(request);
   if(request.status!=='resolved'){const msg='نعلة '+wallLabel+' ('+s.fromMm+'–'+s.toMm+' مم) · '+request.reason;issues.add(msg);release.add(msg);continue;}
   s.seamStationsMm=[...request.choice.stationsMm];
  }
  const bounds=[s.fromMm,...(s.seamStationsMm||[]),s.toMm];
  for(let i=1;i<bounds.length;i++){
   const a=bounds[i-1],b=bounds[i];
   pieces.push({unitId:'upstand:'+s.wall,runId:s.wall,family:'upstand',recipeId:s.profileId,sku:s.sku,label:'نعلة رخام '+wallLabel+' ('+a+'–'+b+' مم)',kind:'panel',count:1,a:round(b-a),b:s.heightMm,
    ...(request?{fromMm:a,toMm:b,jointReference:request.choice.reference}:{})});
  }
 }
 for(const sill of sills)if(sill.mode==='factory'){
  const ws=windows.find(w=>w.key===sill.key);
  factoryWalls.add(sill.wall);
  pieces.push({unitId:'sill:'+ws.windowId+':'+ws.bottomMm,runId:sill.wall,family:'windowSill',sku:sill.sku,label:'جلسة شباك أفقية '+ws.windowId+' ('+sill.fromMm+'–'+sill.toMm+' مم)',kind:'panel',count:1,a:sill.lengthMm,b:sill.depthMm});
 }
 const requested=new Set(seamRequests.map(s=>s.key)),orphanSeams=Object.keys(spec.seamChoices||{}).filter(k=>!requested.has(k));
 for(const k of orphanSeams){const m='تغيّر شريط نعلة له وصلات محفوظة ('+k+'). راجع رسم الوصلات ثم احذف الارتباط القديم.';issues.add(m);release.add(m);}
 if(factoryWalls.size)for(const msg of siteReleaseIssues(doc,{walls:[...factoryWalls]}))release.add(msg);
 return {windows,sills,orphanWindows,seamRequests,orphanSeams,segments:segments.filter(s=>s.lengthMm>0),edges,contactWalls:[...chosenWalls],pieces,supplier,issues:[...issues],releaseIssues:[...release],decisionIssues:[...decisions]};
}

export function previewUpstandWindowChoice(doc,cat,key,input,similar=false){
 const before=worktopUpstandTakeoff(doc,cat),spec=cleanUpstandSpec(doc.room.workshop?.upstand);
 const win=before.windows.find(w=>w.key===key),choices={...spec?.windowChoices};
 if(!spec||!win&&!(input===null&&ownKey(choices,key)))return {ok:false,reason:'لا تتصل هذه النافذة بحافة نعلة صالحة في الرسم الحالي.'};
 let applied=0,skipped=0;
 if(input===null){delete choices[key];applied++;}
 else{
  const choice=cleanWindowChoice({...input,datum:win.datum});
  if(!choice)return {ok:false,reason:'راجع ارتفاع النعلة وخلوصها وبيانات الجلسة والقياسات المدخلة.'};
  if(choice.sill?.verified)choice.sill.proof=sillProof(win,choice.sill,cat);
  choices[key]=choice;applied++;
  if(similar)for(const other of before.windows){
   if(other.key===key)continue;
   // Copy only the visual intent. An operating-hardware check or a field
   // dimension at one window cannot establish a second window's clearance.
   if(choices[other.key]||other.mode!==win.mode||other.material!==win.material||other.profileId!==win.profileId||
     other.thicknessMm!==win.thicknessMm||other.nominalMm!==win.nominalMm||other.conflict!==win.conflict||
     (choice.kind!=='gap'&&(other.rawClearMm<=0||other.rawClearMm<other.minCutHeightMm||choice.heightMm>other.rawClearMm||choice.heightMm<other.minCutHeightMm))){skipped++;continue;}
   choices[other.key]={kind:choice.kind,datum:other.datum,...(choice.heightMm!==undefined?{heightMm:choice.heightMm}:{})};
   applied++;
  }
 }
 const nextSpec=cleanUpstandSpec({...spec,windowChoices:choices});
 if(!nextSpec)return {ok:false,reason:'تعذر حفظ قرارات الشبابيك. راجع المقاسات وعدد العناصر.'};
 const next={...doc,room:{...doc.room,workshop:{...doc.room.workshop,upstand:nextSpec}}};
 const take=worktopUpstandTakeoff(next,cat);
 return {ok:true,doc:next,take,window:take.windows.find(w=>w.key===key),applied,skipped};
}
export const setUpstandWindowChoice=previewUpstandWindowChoice;


export function setUpstandSeamChoice(doc,cat,key,input){
 const current=worktopUpstandTakeoff(doc,cat),spec=cleanUpstandSpec(doc.room.workshop?.upstand);
 const req=current.seamRequests.find(r=>r.key===key),seams={...spec?.seamChoices};
 if(!spec||!req&&!(input===null&&ownKey(seams,key)))return {ok:false,reason:'تعذر تحديد الشريط المقصود في الرسم الحالي.'};
 if(input===null)delete seams[key];
 else{
  const value=cleanSeamChoice({...input,datum:req.datum});
  if(!value)return {ok:false,reason:'أدخل محطات وصل متزايدة ومرجع رسم الورشة.'};
  seams[key]=value;
 }
 const upstand=cleanUpstandSpec({...spec,seamChoices:seams});
 if(!upstand)return {ok:false,reason:'راجع عدد مخططات وصل الرخام.'};
 const next={...doc,room:{...doc.room,workshop:{...doc.room.workshop,upstand}}},take=worktopUpstandTakeoff(next,cat);
 const checked=take.seamRequests.find(r=>r.key===key);
 if(input!==null&&checked?.status!=='resolved')return {ok:false,reason:checked?.reason||'تعذر التحقق من موقع الوصل.'};
 return {ok:true,doc:next,take};
}
