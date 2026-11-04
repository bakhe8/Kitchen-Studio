import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {checkWallPairRow,wallPairStockRemainder} from './kitchen-wall-pair-fit.js';
import {pantryContext,validPantrySupply} from './kitchen-pantry-brief.js';
import {cleanDrawerChecks,drawerBasis} from './kitchen-drawer-fit.js';
// Dimensions crossing the workshop boundary are millimetres. Existing CAD uses centimetres.
import {addRun,addKitchenUnitRaw,cleanDeviceModel,kitchenUnitSpecs,validateKitchenChange} from './kitchen-model.js';
import {chooseRowOpenings,legalRowSpans} from './kitchen-row-fill.js';
import {creationDefaults} from './kitchen-defaults-calculations.js';
import {cleanRiceCheck,riceSiteKey} from './kitchen-production-row-rice.js';
import {cleanDishwasherEvidence,dishwasherSiteKey,currentDishwasherWarnings} from './kitchen-production-row-equipment.js';
import {optionEnvelopes,wallUpperBands,baseBandFor} from './kitchen-chain-options.js';
import {cornerReservations,checkCornerPlacement} from './kitchen-production-row-corners.js';
import {getFactoryCatalog,checkFactorySize,familyCADKind} from './kitchen-workshop-factory.js';
import {isCustomFamily} from './kitchen-factory-families.js';

export const rowKinds={storage:'storage',rice:'drawers',dishwasher:'dishwasher',sink:'sink'};
export const rowLabels={storage:'تخزين',rice:'درج أرز',dishwasher:'غسالة صحون',sink:'مجلى'};
const safeID=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)&&!inheritedName(v)&&!['__proto__','prototype','constructor'].includes(v);
const whole=v=>Number.isSafeInteger(v)&&v>=0&&v<=17000;
const dims=v=>whole(v)&&v>=200&&v<=2400;
const keys=['width','position','usage','finish'];
const riceModes=['bags','bin','unknown','owned','dispenser'];
const flags=(locked={})=>Object.fromEntries(keys.map(k=>[k,locked[k]===true]));
function hardwareSpec(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>12)return null;
 const entries=Object.entries(v);
 if(entries.some(([k,s])=>['__proto__','constructor','prototype'].includes(k)||!k.trim()||k.length>80||typeof s!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,47}$/.test(s)))return null;
 return Object.fromEntries(entries);
}
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const baseRecipe=(family,upper)=>upper&&family==='storage'?'upperStorage':family;
function recipe(catalog,family,selected,upper){
 const base=baseRecipe(family,upper),key=selected||base;
 if(!ownKey(catalog.families,key))return null;
 const def=catalog.families[key];
 return (def.base||key)===base?{key,def,kind:familyCADKind(def,base)}:null;
}
export function cleanProductionRows(rows){
 if(!plain(rows)||Object.keys(rows).length>48)return null;
 const cleaned={};
 for(const [id,r] of Object.entries(rows)){
  if(!safeID(id)||!plain(r)||!Array.isArray(r.units)||r.units.length>256||!Array.isArray(r.warnings)||r.warnings.length>20||!r.warnings.every(w=>typeof w==='string'&&w.length<=300)||typeof r.catalogVersion!=='string'||r.catalogVersion.length>60)return null;
  const units=[],seen=new Set();
  for(const u of r.units){
   if(!plain(u)||!safeID(u.id)||seen.has(u.id)||!ownKey(rowKinds,u.family)||!dims(u.widthMm)||!whole(u.startMm)||!plain(u.locks)||keys.some(k=>typeof u.locks[k]!=='boolean')||(u.use!=null&&(typeof u.use!=='string'||u.use.length>100)))return null;
   if(u.family==='rice'&&u.riceMode!=null&&!riceModes.includes(u.riceMode))return null;
   if(u.pantryId!==undefined&&(u.family!=='rice'||typeof u.pantryId!=='string'||!u.pantryId.trim()||u.pantryId.length>160)||u.pantrySupply!==undefined&&(u.riceMode!=='dispenser'||!validPantrySupply(u.pantrySupply)))return null;
   if(u.recipeId!==undefined&&!isCustomFamily(u.recipeId)||u.hardwareChoices!==undefined&&!hardwareSpec(u.hardwareChoices))return null;
   if(u.drawerUses!==undefined&&(!Array.isArray(u.drawerUses)||u.drawerUses.length<1||u.drawerUses.length>8||u.drawerUses.some(v=>typeof v!=='string'||v.length>100)))return null;
   seen.add(u.id);units.push({...(u.pantryId?{pantryId:u.pantryId}:{}),...(u.pantrySupply?{pantrySupply:{sku:u.pantrySupply.sku,model:u.pantrySupply.model,reference:u.pantrySupply.reference}}:{}),...(u.hardwareChoices?{hardwareChoices:{...u.hardwareChoices}}:{}),...(u.recipeId?{recipeId:u.recipeId}:{}),...(u.drawerUses?{drawerUses:[...u.drawerUses]}:{}),...(u.family==='rice'?{riceMode:u.riceMode||'unknown'}:{}),id:u.id,family:u.family,startMm:u.startMm,widthMm:u.widthMm,locks:flags(u.locks),...(u.use?{use:u.use}:{})});
  }
  const evidence={};
  if(r.equipmentChecks!==undefined){
   if(!plain(r.equipmentChecks)||Object.keys(r.equipmentChecks).length>256)return null;
   for(const [eid,v] of Object.entries(r.equipmentChecks)){const clean=cleanDishwasherEvidence(v);if(!safeID(eid)||!clean||!units.some(i=>i.id===eid&&i.family==='dishwasher'))return null;evidence[eid]=clean;}
  }
  const riceChecks={};
  if(r.riceChecks!==undefined){
   if(!plain(r.riceChecks)||Object.keys(r.riceChecks).length>256)return null;
   for(const [uid,v] of Object.entries(r.riceChecks)){const check=cleanRiceCheck(v);if(!safeID(uid)||!check||!units.some(i=>i.id===uid&&i.family==='rice'))return null;riceChecks[uid]=check;}
  }
  if(r.fillerRecipeId!==undefined&&!isCustomFamily(r.fillerRecipeId))return null;
  const drawerChecks={};if(r.drawerChecks!=null){if(!plain(r.drawerChecks)||Object.keys(r.drawerChecks).length>256)return null;for(const [key,set] of Object.entries(r.drawerChecks)){const safe=cleanDrawerChecks(set);if(!safe||!units.some(u=>u.id===key))return null;drawerChecks[key]=safe;}}
  if(r.storageTargetMm!==undefined&&(!Number.isInteger(r.storageTargetMm)||r.storageTargetMm<150||r.storageTargetMm>3000))return null;
  cleaned[id]={units,...(r.storageTargetMm===undefined?{}:{storageTargetMm:r.storageTargetMm}),...(Object.keys(drawerChecks).length?{drawerChecks}:{}),...(r.fillerRecipeId?{fillerRecipeId:r.fillerRecipeId}:{}),...(Object.keys(riceChecks).length?{riceChecks}:{}),warnings:[...r.warnings],catalogVersion:r.catalogVersion,...(Object.keys(evidence).length?{equipmentChecks:evidence}:{})};
 }
 return cleaned;
}
const allowed=(w,f)=>!!f&&dims(w)&&w>=f.minMm&&w<=f.maxMm&&(w-f.minMm)%f.stepMm===0;
function storageWidths(total,f,target=600){
 if(total===0)return [];
 if(target===600&&allowed(total,f))return [total];
 const top=f.minMm+Math.floor((f.maxMm-f.minMm)/f.stepMm)*f.stepMm;
 const counts=[];
 for(let n=Math.ceil(total/top);n<=Math.floor(total/f.minMm);n++)
  if((total-n*f.minMm)%f.stepMm===0)counts.push(n);
 if(!counts.length)return null;
 const n=counts.sort((a,b)=>Math.abs(total/a-target)-Math.abs(total/b-target)||a-b)[0];
 const slots=(total-n*f.minMm)/f.stepMm,each=Math.floor(slots/n),extra=slots%n;
 return Array.from({length:n},(_,i)=>f.minMm+f.stepMm*(each+(i<extra?1:0)));
}
function removeSpan(spaces,start,width){
 const i=spaces.findIndex(([a,b])=>a<=start&&start+width<=b);
 if(i<0)return null;
 const [a,b]=spaces[i];return [...spaces.slice(0,i),...(a<start?[[a,start]]:[]),...(start+width<b?[[start+width,b]]:[]),...spaces.slice(i+1)];
}
function servicePoints(doc,wall,kind,start,end){
 return doc.kitchen.features.filter(f=>f.kind===kind&&f.wall===wall).map(f=>(f.u+f.width/2)*10).filter(x=>x>=start&&x<=end);
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
function placeFunctions(spaces,items,stock,water,drains,preferred,sinkRequired,workLimit,target){
 const variableAtPosition=i=>i.family==='storage'&&!i.recipeId&&!i.modelSpec&&i.locks.position&&!i.locks.width;
 const result=[],fixed=items.filter(i=>i.locks.position&&!variableAtPosition(i)),loose=items.filter(i=>!i.locks.position||variableAtPosition(i));
 for(const i of fixed){
  const next=removeSpan(spaces,i.startMm,i.widthMm);
  if(!next)return {error:'يتداخل موضع مثبّت مع وحدة أو فتحة أو فراغ محجوز. حرّر الموضع المتعارض أو غيّر العرض.'};
  result.push(i);spaces=next;
 }
 // Put plumbing first so that local storage choices do not determine the sink location.
 const rank={sink:0,dishwasher:1,rice:2,storage:3};
 loose.sort((a,b)=>rank[a.family]-rank[b.family]);
 const tick=Math.max(1,[stock.minMm,stock.stepMm,...items.map(i=>i.widthMm)].reduce(gcd));
 let visits=0,work=0,limited=false;
 const spend=n=>{work+=n;if(work>workLimit)limited=true;return !limited;};
 function search(free,placed,index){
  if(++visits>10000||!spend(1)){limited=true;return null;}
  if(index===loose.length){
   const filler=[];
   for(const [a,b] of free){
    const widths=storageWidths(b-a,stock,target);if(!widths)return null;
    let at=a;for(const w of widths){filler.push({family:'storage',startMm:at,widthMm:w,locks:flags()});at+=w;}
   }
   return [...placed,...filler].sort((a,b)=>a.startMm-b.startMm);
  }
  const item=loose[index],w=item.widthMm;
  if(variableAtPosition(item)){
   const span=free.find(([a,b])=>a<=item.startMm&&item.startMm<b);if(!span)return null;
   const fits=[];
   for(let width=stock.minMm;width<=Math.min(stock.maxMm,span[1]-item.startMm);width+=stock.stepMm)fits.push(width);
   for(const width of fits.sort((a,b)=>Math.abs(w-a)-Math.abs(w-b))){
    const next=removeSpan(free,item.startMm,width);
    const out=search(next,[...placed,{...item,widthMm:width}],index+1);if(out)return out;
    if(limited)break;
   }
   return null;
  }
  const candidates=new Set();
  for(const [a,b] of free){
   if(b-a<w)continue;
   // Each edge is a possible catalogue datum, including inset openings.
   const count=Math.floor((b-a-w)/tick)+1;
   if(!spend(2*count))return null;
   for(let p=a;p+w<=b;p+=tick)candidates.add(p);
   for(let p=b-w;p>=a;p-=tick)candidates.add(p);
  }
  const sink=placed.find(i=>i.family==='sink');
  const sources=water.length?water:drains;
  const score=p=>{
   if(item.family==='sink'&&sources.length){
    const center=p+w/2;
    const distance=list=>list.length?Math.min(...list.map(x=>Math.abs(x-center))):0;
    return distance(sources)+(drains.length&&water.length?distance(drains)*.15:0);
   }
   if(item.family==='dishwasher'&&sink)return Math.min(Math.abs(p+w-sink.startMm),Math.abs(p-sink.startMm-sink.widthMm));
   if(item.id&&Number.isFinite(item.startMm))return Math.abs(p-item.startMm);
   if(item.family==='sink'||(item.family==='dishwasher'&&!sinkRequired))return -p;
   return Math.abs(p-preferred);
  };
  if(!spend(candidates.size))return null;
  const ordered=[...candidates].map(p=>({p,score:score(p)})).sort((a,b)=>a.score-b.score||a.p-b.p);
  for(const {p} of ordered){
   if(limited)break;
   const next=removeSpan(free,p,w);
   const out=search(next,[...placed,{...item,startMm:p}],index+1);if(out)return out;
  }
  return null;
 }
 const parts=search(spaces,result,0);
 return parts?{parts}:{error:limited?'توقّف البحث عند حدّ البدائل. جرّب تحديد موضع الوحدة المطلوبة.':'لم تنطبق مقاسات الكتالوج على الأجزاء الحرة. راجع العرض المثبّت أو الفراغات أو عائلة التخزين.'};
}
const fail=(doc,reason)=>({ok:false,doc,reason});
const eq=(a,b)=>Math.abs(a-b)<1e-5;
export function planWorkshopRow(doc,request,catalog=getFactoryCatalog(doc)){
 if(!doc||!request||!catalog?.families)return fail(doc,'اختر مشروعًا وكتالوجًا صالحين.');
 const room=doc.room,k=doc.kitchen,families={...catalog.families};
 if(!families.storage||!Object.keys(rowKinds).every(key=>{const f=families[key];return f&&dims(f.minMm)&&dims(f.maxMm)&&f.maxMm>=f.minMm&&Number.isSafeInteger(f.stepMm)&&f.stepMm>0;}))return fail(doc,'مقاسات عائلات الكتالوج غير مكتملة.');
 let scene=k,run=request.runId?k.runs.find(r=>r.id===request.runId):null;
 if((run?.tier||request.tier)==='upper'&&room.workshop?.options?.[run?.wall||request.wall]?.mode==='none')return fail(doc,'اختار العميل جدارًا بلا صف علوي. عدّل رغبته قبل تعبئة صف علوي هنا.');
 if(request.runId&&!run)return fail(doc,'الصف المحدد لم يعد موجودًا.');
 if(!run){
  if(!whole(request.startMm)||!whole(request.endMm)||request.endMm-request.startMm<200)return fail(doc,'أدخل بداية ونهاية صالحتيْن بالملليمتر.');
  run=k.runs.find(r=>r.wall===request.wall&&r.tier===request.tier&&eq(r.start*10,request.startMm)&&eq(r.end*10,request.endMm));
  if(!run){
   const base=request.tier==='base',d=creationDefaults(doc);
   const band=base?baseBandFor(doc,request.wall,request.startMm,request.endMm,d):wallUpperBands(doc,request.wall)[0];
   if(base&&band.height<15)return fail(doc,'التعلية المقاسة لا تترك ارتفاعًا كافيًا للجسم أسفل منسوب السطح.');
   if(!base&&!band)return fail(doc,'راجع المناسيب المحفوظة لنهاية الصف العلوي.');
   const added=addRun(k,room,{wall:request.wall,tier:request.tier,start:request.startMm/10,end:request.endMm/10,depth:band.depth,height:band.height,bottom:band.bottom,...(base&&d.worktopFinish?{worktopFinish:d.worktopFinish}:{})});if(!added.ok)return fail(doc,added.reason);
   scene=added.kitchen;run=scene.runs.find(v=>v.id===added.id);
  }
 }
 // A complete proposal may leave a measured interval empty when a newly
 // generated storage front cannot operate there. Never erase an existing gap.
 if(request.clearanceGaps?.length){
  const gaps=[...(run.fillGaps||[]),...request.clearanceGaps].sort((a,b)=>a.u-b.u);
  if(gaps.some((g,i)=>!Number.isFinite(g.u)||!Number.isFinite(g.width)||g.width<=0||g.u<run.start||g.u+g.width>run.end||i&&g.u<gaps[i-1].u+gaps[i-1].width))return fail(doc,'يقع فراغ حركة الواجهة خارج مجال الصف أو يتداخل مع فراغ قائم.');
  run={...run,autoFill:true,fillGaps:gaps};scene={...scene,runs:scene.runs.map(r=>r.id===run.id?run:r)};
 }
 const oldManifest=room.workshop?.rows?.[run.id],records=oldManifest?.units||[],byID=new Map(records.map(m=>[m.id,m])),here=k.units.filter(u=>u.runId===run.id);
 const changes=request.edits||{},wanted=request.wanted||{},widths=request.widths||{},upper=run.tier==='upper';
 if(!upper&&!records.some(e=>e.family==='rice')&&(wanted.rice||request.additions?.some(a=>catalog.families[a.recipeId]?.base==='rice')||Object.values(changes).some(e=>e.family==='rice'))){
  const intent=pantryContext(doc,run.id,request.pantryId||null);
  if(intent.requests.length){
   if(!intent.req?.confirmed||intent.req.choice==='none'||intent.placed)return fail(doc,intent.note+' راجع الطلب قبل إضافة وحدة أرز جديدة.');
   request={...request,pantryId:intent.req.id,riceMode:request.riceMode||intent.req.mode};
  }
 }
 const explicitFiller=ownKey(request,'fillerRecipeId'),fillerId=explicitFiller?request.fillerRecipeId:oldManifest?.fillerRecipeId;
 const filler=recipe(catalog,'storage',fillerId,upper);
 if(!filler||!['storage','open-shelf'].includes(filler.kind)||filler.def.customerBay)return fail(doc,'حشوة الصف التلقائية تحتاج وصفة خزانة تخزين متوافقة مع مستوى الصف.');
 const stock=filler.def;
 if(Object.keys(changes).some(id=>!byID.has(id)))return fail(doc,'تعذّر مطابقة تعديل بوحدته. أعد فتح الصف.');
 const items=[],flex=[],warnings=[];
 for(const record of records){
  const live=here.find(u=>u.id===record.id),change=changes[record.id]||{};
  if(!live)continue; // Deleting in the CAD keeps its explicit reserved gap.
  const origin=recipe(catalog,record.family,record.recipeId,upper);
  if(!origin&&!ownKey(change,'recipeId'))return fail(doc,'وصفة '+(record.recipeId||record.family)+' لم تعد في الكتالوج. اختر بديلًا صراحةً.');
  if(origin&&live.kind!==origin.kind&&!ownKey(change,'recipeId'))return fail(doc,'تغيّر نوع وحدة من محرر الرسم. راجع التكوين أو أعده بالتراجع قبل إعادة توزيع صف المصنع.');
  const locks={...record.locks,...change.locks};
  let w=Math.round(live.width*10),pos=Math.round(live.u*10);
  if(!eq(w,live.width*10)||!eq(pos,live.u*10))return fail(doc,'للوحدة مقاس بجزء من الملليمتر. راجع سماحة المصنع قبل اعتماد التوزيع.');
  if(change.widthMm!==undefined){w=change.widthMm;locks.width=true;}
  if(change.startMm!==undefined){pos=change.startMm;locks.position=true;}
  const family=change.family??record.family;
  if(!ownKey(rowKinds,family)||upper&&family!=='storage')return fail(doc,'الاستخدام غير متاح لهذا الصف.');
  const isFiller=record.family==='storage'&&(record.recipeId||null)===(oldManifest?.fillerRecipeId||null);
  const selected=ownKey(change,'recipeId')?change.recipeId:family!==record.family?null:isFiller&&explicitFiller&&!locks.usage?fillerId:record.recipeId;
  const chosen=recipe(catalog,family,selected,upper);
  if(!chosen)return fail(doc,'وصفة الوحدة لا تتبع عائلتها ومستوى صفها.');
  if((family!==record.family||chosen.key!==(origin?.key||record.recipeId))&&record.locks.usage&&locks.usage)return fail(doc,'الاستخدام مثبّت. حرّر تثبيت الاستخدام أولًا.');
  if(wanted[family]===false&&family!=='storage'){
   if(locks.usage||locks.position||locks.width||locks.finish)return fail(doc,'هناك وحدة مخصصة مثبّتة. حرّر تثبيتها قبل حذف استخدامها.');
   continue;
  }
  const explicitWidth=widths[family];if(family!=='storage'&&!record.recipeId&&!live.modelSpec&&explicitWidth!==undefined&&explicitWidth!==w&&change.widthMm===undefined){
   if(locks.width)return fail(doc,'عرض '+rowLabels[family]+' مثبّت. غيّر مقاس الوحدة من سطرها أو حرّر تثبيتها.');w=explicitWidth;
  }
  if(change.use!==undefined&&record.locks.usage&&locks.usage&&change.use!==record.use)return fail(doc,'حرّر تثبيت الاستخدام قبل تغيير الغرض من الوحدة.');
  if(change.drawerUses&&record.locks.usage&&locks.usage&&JSON.stringify(change.drawerUses)!==JSON.stringify(record.drawerUses||Array(live.drawerCount||3).fill('')))return fail(doc,'حرّر تثبيت الاستخدام قبل تعديل استخدام الأدراج.');
  const model=ownKey(change,'modelSpec')?change.modelSpec:live.kind===chosen.kind?live.modelSpec:null;
  if(model){if(!cleanDeviceModel(model,chosen.kind))return fail(doc,'مواصفات الجهاز أو مرجع الموديل غير صالح.');if(change.modelSpec){if(locks.width&&change.widthMm===undefined&&model.widthMm!==w)return fail(doc,'عرض الحيّز مثبّت. حرّره قبل تبديل الموديل.');w=change.widthMm??model.widthMm;}if(w!==model.widthMm)return fail(doc,'عرض الحيّز لا يطابق المقاس المحدد بدليل الموديل.');}
  const custom=isCustomFamily(chosen.key),individual=custom&&(!isFiller||chosen.key!==filler.key);
  if(!allowed(w,chosen.def)&&(family!=='storage'||individual||locks.width))return fail(doc,'العرض '+w+' مم غير متاح لوصفة '+chosen.def.label+'.');
  const count=change.drawerCount??(live.kind===chosen.kind?live.drawerCount:null);
  let drawerUses=change.drawerUses??(chosen.kind==='drawers'?record.drawerUses:null);
  if(change.drawerCount!=null&&drawerUses&&chosen.kind==='drawers'){
   if(drawerUses.slice(change.drawerCount).some(s=>s.trim()))return fail(doc,'احفظ أو أزل وظيفة الدرج الذي سيُحذف قبل تقليل عدد الواجهات.');
   drawerUses=Array.from({length:change.drawerCount},(_,j)=>drawerUses[j]||'');
  }
  if(count!=null&&(chosen.kind!=='drawers'||!Number.isInteger(count)||count<1||count>8))return fail(doc,'راجع عدد الأدراج من ١ إلى ٨.');
  if(drawerUses&&(!Array.isArray(drawerUses)||chosen.kind!=='drawers'||drawerUses.length!==(count||3)||drawerUses.some(v=>typeof v!=='string'||v.length>100)))return fail(doc,'طابق أسماء استخدامات الأدراج مع عدد الواجهات المختار.');
  const hardware=ownKey(change,'hardwareChoices')?change.hardwareChoices:chosen.key===origin?.key?record.hardwareChoices:null;
  if(hardware&&!hardwareSpec(hardware))return fail(doc,'راجع اختيارات عتاد الوحدة.');
  const item={...(hardware&&Object.keys(hardware).length?{hardwareChoices:{...hardware}}:{}),...(drawerUses?{drawerUses}:{}),...(count!=null?{drawerCount:count}:{}),...(custom?{recipeId:chosen.key}:{}),...(model?{modelSpec:model}:{}),id:live.id,family,startMm:pos,widthMm:w,locks:flags(locks),use:String(change.use??record.use??'').trim().slice(0,100)};
  if(family!=='storage'||individual||model||locks.width||locks.position||ownKey(change,'recipeId'))items.push(item);else flex.push(item);

 }
 const additions=request.additions??[];
 if(!Array.isArray(additions)||additions.length>24)return fail(doc,'عدد طلبات الوحدات في العملية غير صالح.');
 for(const family of ['rice','dishwasher','sink']){
  if(upper||!wanted[family]||items.some(i=>i.family===family)||additions.some(a=>a&&(catalog.families[a.recipeId]?.base||a.recipeId)===family))continue;
  const initial={rice:600,dishwasher:600,sink:900}[family],f=families[family];
  const w=widths[family]??(allowed(initial,f)?initial:f.minMm);
  if(!allowed(w,f))return fail(doc,'عرض '+rowLabels[family]+' غير متاح في كتالوج المصنع.');
  items.push({family,widthMm:w,locks:flags()});
 }
 for(const add of additions){
  if(!plain(add)||(!isCustomFamily(add.recipeId)&&add.recipeId!=='dishwasher')||!ownKey(catalog.families,add.recipeId))return fail(doc,'اختر وصفة منشورة من كتالوج المصنع.');
  const def=catalog.families[add.recipeId],family=(def.base||add.recipeId)==='upperStorage'?'storage':def.base||add.recipeId,chosen=recipe(catalog,family,add.recipeId,upper);
  if(!chosen)return fail(doc,'الوصفة لا تنطبق على مستوى الصف الحالي.');
  const model=add.modelSpec&&cleanDeviceModel(add.modelSpec,chosen.kind),w=add.widthMm??model?.widthMm??def.minMm;
  if(add.modelSpec&&!model||model&&model.widthMm!==w)return fail(doc,'راجع الموديل ومرجعه وعرضه الخارجي في الكتالوج.');
  if(!allowed(w,def)||add.startMm!=null&&!whole(add.startMm))return fail(doc,'عرض أو بداية الوحدة خارج مقاسات الوصفة.');
  if(add.drawerCount!=null&&(chosen.kind!=='drawers'||!Number.isInteger(add.drawerCount)||add.drawerCount<1||add.drawerCount>8))return fail(doc,'عدد الأدراج غير صالح.');
  items.push({family,...(isCustomFamily(add.recipeId)?{recipeId:add.recipeId}:{}),widthMm:w,startMm:add.startMm??run.start*10,locks:flags({position:add.startMm!=null,width:true,usage:true}),...(model?{modelSpec:model}:{}),...(add.drawerCount?{drawerCount:add.drawerCount}:{}),use:String(add.use||'').trim().slice(0,100)});
 }
 const external=here.filter(u=>!byID.has(u.id)&&u.fillRole!=='auto');
 const externalIDs=new Set(external.map(u=>u.id));
 // Preserve every manually positioned unit outside this manifest, including unsupported families.
 const retained=scene.units.filter(u=>u.runId!==run.id||externalIDs.has(u.id));
 if(external.length)warnings.push('توجد وحدات يدوية محفوظة خارج وصفة هذا الصف. تُراجع وتُسعّر منفصلة.');
 const core={...scene,units:retained};
 const cornerGaps=cornerReservations(doc,run);
 if(external.some(u=>cornerGaps.some(g=>Math.min(u.u+u.width,g.u+g.width)>Math.max(u.u,g.u)+1e-7)))return fail(doc,'تتداخل الزاوية مع وحدة يدوية مثبّتة. حرّكها أو قلّل امتداد الزاوية.');
 const envelopes=optionEnvelopes(doc);
 const raw=legalRowSpans({...core,features:[...core.features,...envelopes]},room,run,[...(run.fillGaps||[]),...cornerGaps]);
 if(raw.some(s=>!eq(s.start*10,Math.round(s.start*10))||!eq(s.end*10,Math.round(s.end*10))))return fail(doc,'حدود الفراغ بجزء من الملليمتر. راجع سماحة التركيب أو قسّم الامتداد.');
 const spans=raw.map(s=>[Math.round(s.start*10),Math.round(s.end*10)]),free=spans.reduce((n,[a,b])=>n+b-a,0);
 const required=items.reduce((n,i)=>n+(i.family==='storage'&&!i.recipeId&&!i.modelSpec&&i.locks.position&&!i.locks.width?stock.minMm:i.widthMm),0);
 if(required>free)return fail(doc,'تنقص '+(required-free)+' مم لاستيعاب الوحدات المطلوبة. حرّر عرضًا مثبّتًا أو غيّر حدود الصف.');
 if(!free)return fail(doc,'لا يوجد حيّز متاح بعد الفتحات والوحدات المثبّتة.');
 const waters=servicePoints(doc,run.wall,'water',run.start*10,run.end*10),drains=servicePoints(doc,run.wall,'drain',run.start*10,run.end*10);
 const sinkRequired=items.some(i=>i.family==='sink');
 const budget=Number.isSafeInteger(request.searchBudget)?Math.max(1000,Math.min(150000,request.searchBudget)):150000;
 const target=request.storageTargetMm??oldManifest?.storageTargetMm??600;
 if(!Number.isInteger(target)||target<150||target>3000)return fail(doc,'عرض التقسيم المستهدف خارج النطاق.');
 const attempt=spaces=>placeFunctions(spaces,items,stock,waters,drains,run.start*10,sinkRequired,budget,target);
 let planned=attempt(spans),pairRemainder=[];
 if(!planned.parts&&room.workshop?.wallPairs){
  const grid=gcd(stock.minMm,stock.stepMm),residual=items.every(i=>i.widthMm%grid===0)&&wallPairStockRemainder(doc,run,spans,grid);
  if(residual){
   const trial=attempt(residual.adjusted);
   if(trial.parts){
    planned=trial;pairRemainder=residual.gaps;
    if(request.leavePairRemainder!==true)for(const g of residual.gaps)warnings.push('يبقى فراغ '+(g.endMm-g.startMm)+' مم عند الطرف المقاس ('+g.startMm+'–'+g.endMm+' مم) بسبب شبكة عروض المصنع. لم تُحسب حشوة. حدّد معالجة الطرف قبل التصنيع.');
   }
  }
 }
 if(!planned.parts)return fail(doc,planned.error);
 const {parts}=planned;
 if(isCustomFamily(fillerId))for(const part of parts)if(part.family==='storage'&&!part.id&&!part.recipeId)part.recipeId=fillerId;
 if(parts.length+retained.length>256)return fail(doc,'يتجاوز التوزيع حد عدد الوحدات في المشروع.');
 if(sinkRequired){
  for(const sink of parts.filter(i=>i.family==='sink')){
   const under=x=>x>sink.startMm&&x<sink.startMm+sink.widthMm;
   if(!waters.some(under)||!drains.some(under))warnings.push('موضع مجلى عند '+sink.startMm+' مم مبدئي. يلزم التحقق من تغذية الماء ومسار الصرف داخل حدود الوحدة.');
  }
 }

 const oldAutos=here.filter(u=>!byID.has(u.id)&&u.fillRole==='auto'&&u.kind==='storage');
 const openIDs=new Set(),assigned=new Set(parts.map(i=>i.id).filter(Boolean)),manifest=[];
 const candidates=[...flex.map(i=>here.find(u=>u.id===i.id)),...oldAutos].filter(Boolean);
 // Prioritise customized fronts before equivalent automatic cabinets when population changes.
 candidates.sort((a,b)=>Number(!!flex.find(x=>x.id===b.id)?.locks.finish)-Number(!!flex.find(x=>x.id===a.id)?.locks.finish));
 for(const old of candidates){
  if(assigned.has(old.id))continue;
  const overlaps=parts.filter(i=>i.family==='storage'&&!i.id&&!i.modelSpec&&(!i.recipeId||i.recipeId===fillerId)).map(i=>({i,overlap:Math.max(0,Math.min(i.startMm+i.widthMm,(old.u+old.width)*10)-Math.max(i.startMm,old.u*10))})).sort((a,b)=>b.overlap-a.overlap);
  const prior=flex.find(i=>i.id===old.id),target=overlaps[0];
  if(!target||!target.overlap&&!prior?.locks.finish){
   if(prior&&(prior.locks.finish||prior.locks.usage||prior.use||prior.hardwareChoices||doc.room.workshop?.finishes?.hardwareUnits?.[old.id]||doc.room.workshop?.finishes?.partUnits?.[old.id]||doc.room.workshop?.finishes?.units?.[old.id]))return fail(doc,'سيحذف التعديل وحدة ذات تشطيب أو استخدام مخصص. حرّر التخصيص أو غيّر العرض.');
   continue;
  }
  Object.assign(target.i,{...(prior?.hardwareChoices?{hardwareChoices:prior.hardwareChoices}:{}),id:old.id,locks:prior?.locks||flags(),use:prior?.use||''});assigned.add(old.id);
 }
 const defaults=creationDefaults(doc),safeStyles=['frontFinish','frontColor','handleStyle','frontStyle'];
 let managed=run.autoFill?run:{...run,autoFill:true};
 if(pairRemainder.length&&request.leavePairRemainder===true){
  const gaps=pairRemainder.map(g=>({u:g.startMm/10,width:(g.endMm-g.startMm)/10}));
  managed={...managed,fillGaps:[...(managed.fillGaps||[]),...gaps].sort((a,b)=>a.u-b.u)};
 }
 let building={...core,runs:core.runs.map(r=>r.id===run.id?managed:r)};
 for(const p of parts){
  const old=here.find(u=>u.id===p.id),rule=recipe(catalog,p.family,p.recipeId,upper),kind=rule.kind,spec=kitchenUnitSpecs[kind];
  const H=p.modelSpec?.heightMm??(spec.height??run.height)*10,D=p.modelSpec?.depthMm??(spec.depth??run.depth)*10;
  if(!checkFactorySize(rule.def,p.widthMm,H,D))return fail(doc,'الأبعاد الفعلية '+p.widthMm+' × '+H+' × '+D+' مم لا تطابق شبكة وصفة '+rule.def.label+'.');
  const attrs=old?.kind===kind?{...old}:{};delete attrs.id;
  for(const key of safeStyles){
   if((key==='frontStyle'&&!spec.frontStyles)||(key==='handleStyle'&&!spec.handles))continue;
   if(spec.frontStyles&&attrs[key]==null&&defaults[key]!=null)attrs[key]=defaults[key];
  }
  delete attrs.modelSpec;delete attrs.drawerCount;
  const out=addKitchenUnitRaw(building,room,{...attrs,...(p.modelSpec?{modelSpec:p.modelSpec}:{}),...(p.drawerCount!=null?{drawerCount:p.drawerCount}:{}),...(p.id?{id:p.id}:{}),runId:run.id,kind,u:p.startMm/10,width:p.widthMm/10,fillRole:'fixed'});
  if(!out.ok)return fail(doc,out.reason);
  building=p.id?{...out.kitchen,nextId:building.nextId}:out.kitchen;openIDs.add(out.id);
  const priorRice=byID.get(out.id)?.riceMode||'unknown',riceMode=request.riceMode??priorRice;
  if(p.family==='rice'&&!riceModes.includes(riceMode))return fail(doc,'طريقة تخزين الأرز غير معروفة.');
  const fresh=!byID.has(out.id),anchored=fresh&&['sink','dishwasher'].includes(p.family);
  const prior=byID.get(out.id),pantryId=request.pantryLinks?.[out.id]??request.pantryId??prior?.pantryId;
  const supplied=request.pantrySupplies?.[out.id]??prior?.pantrySupply;
  if(p.family==='rice'&&prior?.locks.usage&&p.locks.usage&&(priorRice!==riceMode||prior.pantryId&&pantryId!==prior.pantryId))return fail(doc,'استخدام درج الأرز مثبّت. حرّر تثبيت الاستخدام في سطر الوحدة قبل تغيير طلبها.');
  if(p.family==='rice'&&pantryId){
   const ctx=pantryContext(doc,run.id,pantryId);
   if(pantryId!==prior?.pantryId&&(!ctx.req?.confirmed||ctx.req.choice==='none'||ctx.placed))return fail(doc,'طلب المقابلة غير مؤكد أو مرفوض أو مرتبط بدرج على صف آخر.');
   if(manifest.some(u=>u.pantryId===pantryId))return fail(doc,'لا يمكن احتساب طلب الأرز نفسه في درجين.');
  }
  if(p.family==='rice'&&riceMode==='dispenser'&&supplied&&!validPantrySupply(supplied))return fail(doc,'أكمل موديل العيّاشة وصنفها ومرجع المطابقة.');
  manifest.push({...(p.family==='rice'&&pantryId?{pantryId}:{}),...(p.family==='rice'&&riceMode==='dispenser'&&supplied?{pantrySupply:supplied}:{}),...(p.hardwareChoices?{hardwareChoices:p.hardwareChoices}:{}),...(p.recipeId?{recipeId:p.recipeId}:{}),...(kind==='drawers'&&p.drawerUses?{drawerUses:p.drawerUses.map(v=>String(v).trim().slice(0,100))}:{}),...(p.family==='rice'?{riceMode}:{}),id:out.id,family:p.family,startMm:p.startMm,widthMm:p.widthMm,locks:anchored?{...p.locks,position:true,width:true,usage:true}:p.locks,...(p.use?{use:p.use}:{})});
 }
 const accessible=chooseRowOpenings({...building,features:[...building.features,...envelopes]},room,openIDs);
 if(!accessible.ok){
  const no=fail(doc,'تعذّر فتح إحدى الواجهات في هذا التوزيع. '+accessible.issue.label);
  const storage=manifest.find(e=>e.id===accessible.issue.ids[0]&&e.family==='storage'&&!e.recipeId&&!byID.has(e.id)&&!here.some(x=>x.id===e.id)&&!e.use&&!Object.values(e.locks).some(Boolean));
  if(storage)no.unusableStorage={u:storage.startMm/10,width:storage.widthMm/10};
  return no;
 }
 building={...accessible.kitchen,features:building.features};
 if(room.workshop?.wallPairs){
  const fit=checkWallPairRow({room,kitchen:building},run,building.units.filter(u=>u.runId===run.id));
  if(fit.errors.length)return fail(doc,fit.errors[0]);
 }
 const checked=validateKitchenChange(k,room,building,room);if(!checked.ok)return fail(doc,checked.reason);
 const rowState={...(target!==600?{storageTargetMm:target}:{}),...(isCustomFamily(filler.key)?{fillerRecipeId:filler.key}:{}),catalogVersion:String(catalog.layoutRevision??catalog.revision),units:manifest,warnings};
 const evidence={};
 for(const entry of manifest.filter(i=>i.family==='dishwasher')){
  const unit=building.units.find(u=>u.id===entry.id),changed=request.equipmentChecks?.[entry.id];
  if(changed){
   const clean=cleanDishwasherEvidence({...changed,signature:dishwasherSiteKey({...doc,kitchen:building},run,unit)});
   if(!clean)return fail(doc,'أكمل موديل الغسالة ومرجع الدليل ومقاسات الفتحة الفعلية واسم الفني.');
   evidence[entry.id]=clean;
  }else if(oldManifest?.equipmentChecks?.[entry.id])evidence[entry.id]=oldManifest.equipmentChecks[entry.id];
 }
 if(Object.keys(evidence).length)rowState.equipmentChecks=evidence;
 const riceChecks={};
 for(const entry of manifest.filter(i=>i.family==='rice')){
  const u=building.units.find(u=>u.id===entry.id),change=request.riceChecks?.[entry.id],prior=oldManifest?.riceChecks?.[entry.id];
  if(change){
   const check=cleanRiceCheck({...change,mode:entry.riceMode,signature:riceSiteKey(doc,run,u,entry)});
   if(!check)return fail(doc,'حدّد نوع تعبئة الأرز وأكمل الكمية ومقاسات العبوة والدرج وموديل السكة ودليل حمولتها.');
   riceChecks[entry.id]=check;
  }else if(prior&&prior.mode===entry.riceMode)riceChecks[entry.id]=prior;
 }
 if(Object.keys(riceChecks).length)rowState.riceChecks=riceChecks;
 const drawerChecks={};
 for(const entry of manifest){
  const u=building.units.find(u=>u.id===entry.id),prev=oldManifest?.drawerChecks?.[entry.id]||{},changes=request.drawerChecks?.[entry.id]||{};
  if(u?.kind!=='drawers'){if(Object.keys(prev).length||Object.keys(changes).length)return fail(doc,'أزل فحوص سكك أدراج الوحدة قبل تغيير نوعها.');continue;}
  const set={...prev};
  for(const [i,v] of Object.entries(changes)){if(v==null)delete set[i];else set[i]={...v,basis:drawerBasis(u,run,entry,catalog,doc.room.workshop?.finishes,Number(i))};}
  if(Object.keys(set).length){if(Object.keys(set).some(i=>Number(i)>(u.drawerCount||3)))return fail(doc,'أزل فحص الدرج الذي سيحذف قبل إنقاص العدد.');const clean=cleanDrawerChecks(set);if(!clean)return fail(doc,'أكمل مقاسات تركيب طقم السكتين ووزن الدرج ومحتوياته ومرجع القياس.');drawerChecks[u.id]=clean;}
 }
 if(request.drawerChecks&&Object.keys(request.drawerChecks).some(id=>!manifest.some(e=>e.id===id)))return fail(doc,'الوحدة المرجعية لفحص السكك غير موجودة.');
 if(Object.keys(drawerChecks).length)rowState.drawerChecks=drawerChecks;
 rowState.warnings.push(...currentDishwasherWarnings({...doc,kitchen:building},run,rowState));
 const workshop={...room.workshop,rows:{...room.workshop?.rows,[run.id]:rowState}};
 return {ok:true,doc:{...doc,kitchen:building,room:{...room,workshop}},runId:run.id,row:rowState,spans,...(pairRemainder.length?{pairRemainder,openEndAccepted:request.leavePairRemainder===true}:{})};
}

export function rowModelIssues(doc,scope){
 const issues=[],selected=scope&&new Set(scope.unitIds),cat=getFactoryCatalog(doc);
 for(const r of Object.values(doc.room.workshop?.rows||{}))for(const e of r.units){
  if(!e.recipeId||selected&&!selected.has(e.id))continue;
  const u=doc.kitchen.units.find(v=>v.id===e.id),f=cat.families[e.recipeId];
  if(!u||!f)continue;
  if(!['microwave','oven','oven-tower','fridge','freezer','laundry-bay','hood','hob','dishwasher'].includes(u.kind)&&!f.customerBay)continue;
  if(!u.modelSpec){issues.push('حدّد مرجع الموديل ومقاسات حيزه لوحدة '+e.id+' من وصفة '+f.label+'.');continue;}
  if(e.family==='dishwasher')continue; // Independently checked by dedicated measured dishwasher gate.
  const evidence=doc.room.workshop?.applianceFit?.devices?.filter(x=>x.host===e.id)||[];
  const types={microwave:['microwave'],'laundry-bay':['washer','dryer'],oven:['oven'],fridge:['fridge'],freezer:['freezer'],'oven-tower':['oven'],hob:['hob'],hood:['hood'],dishwasher:['dishwasher']};
  if(!evidence.some(x=>(types[u.kind]||['other']).includes(x.kind)&&x.model===u.modelSpec.model&&x.manual===u.modelSpec.manual&&x.placement!=='counter'&&x.required?.width===u.modelSpec.widthMm&&x.required?.depth===u.modelSpec.depthMm&&x.required?.height===u.modelSpec.heightMm))
   issues.push('اربط وحدة '+e.id+' في «أجهزة العميل» بفتحة الموديل '+u.modelSpec.model+' ومرجعه ومقاساته المطابقة، ثم تحقق من قياسات الموقع والخدمات.');
 }
 return issues;
}

export function applyWorkshopCorner(doc,key,record){
 const corners={...doc.room.workshop?.corners};
 if(record){const issue=checkCornerPlacement(doc,record,key);if(issue)return fail(doc,issue);corners[key]=record;}
 else delete corners[key];
 const review=doc.room.workshop?.decisionReview;
 if(record&&review?.noCorners?.includes(key))doc={...doc,room:{...doc.room,workshop:{...doc.room.workshop,decisionReview:{...review,noCorners:review.noCorners.filter(id=>id!==key)}}}};
 const affected=record||doc.room.workshop?.corners?.[key];
 if(!affected)return {ok:true,doc};
 const ws={...doc.room.workshop,corners},fronts=ws.finishes?.cornerFronts;
 if(fronts){
  const retained={...fronts};
  for(const tier of ['base','upper','tall'])if(!(tier==='tall'?record?.tall&&record?.base?.build:!record?.tall&&record?.[tier]?.build))delete retained['corner:'+key+':'+tier];
  ws.finishes={...ws.finishes};
  if(Object.keys(retained).length)ws.finishes.cornerFronts=retained;else delete ws.finishes.cornerFronts;
 }
 let working={...doc,room:{...doc.room,workshop:ws}};
 for(const run of doc.kitchen.runs.filter(r=>r.wall===affected.a||r.wall===affected.b)){
  if(working.room.workshop.rows?.[run.id]){
   const result=planWorkshopRow(working,{runId:run.id});
   if(!result.ok)return fail(doc,result.reason);
   working=result.doc;
  }else{
   const gaps=cornerReservations(working,run);
   if(doc.kitchen.units.some(u=>u.runId===run.id&&gaps.some(g=>Math.min(u.u+u.width,g.u+g.width)>Math.max(u.u,g.u)+1e-7)))
    return fail(doc,'تتداخل الزاوية مع وحدة في صف مرسوم. اضبط مقاس الزاوية أو انقل الوحدة أولًا.');
  }
 }
 return {ok:true,doc:working};
}
