import {cleanDrawerPack,packMasses} from './kitchen-drawer-pack-data.js';
import {drawerBasis,drawerRunnerPlans} from './kitchen-drawer-fit.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const eps=1e-6,axes=[0,1,2];
const digest=v=>offlineDigest(new TextEncoder().encode(JSON.stringify(v)));
const packKey=p=>'pack-'+digest([p.bays.map(b=>[b.id,b.size,b.entry,b.entryAt,b.reference,b.basis,b.allowAuto]),p.groups.map(g=>[g.id,g.name,g.size,g.count,g.massKg,g.rotate,g.stack,g.together,g.fixed||''])]);
const dims=(g,turn)=>turn?[g.size[1],g.size[0],g.size[2]]:g.size;
const fits=(a,b)=>axes.every(k=>a[k]<=b[k]+eps);
const volume=g=>g.size.reduce((n,v)=>n*v,1);
const same=(a,b)=>Math.abs(a-b)<eps;
export function drawerPackHosts(doc,{technicalOnly=false}={}){
 const w=doc.room.workshop||{},catalog=technicalOnly?readWorkshopCatalog(w):getFactoryCatalog(doc),out=new Map();
 if(!catalog)return out;
 for(const row of Object.values(w.rows||{}))for(const e of row.units){
  const u=doc.kitchen.units.find(v=>v.id===e.id),run=doc.kitchen.runs.find(v=>v.id===u?.runId),f=catalog.families[e.recipeId||e.family];if(!run||u.kind!=='drawers'||!f?.drawerRunners?.length)continue;
  for(let i=1;i<=(u.drawerCount||3);i++){
   const check=row.drawerChecks?.[u.id]?.[i],key=drawerBasis(u,run,e,catalog,w.finishes,i),id=u.id+'#'+i;
   const confirmed=check?.basis===key,prior=row.riceChecks?.[e.id];
   const reserved=!!e.drawerUses?.[i-1]||!!(e.locks.usage&&e.use)||!!(e.family==='rice'&&prior&&(!prior.drawerIndex||prior.drawerIndex===i));
   const basis=digest([key,check||null,e.drawerUses?.[i-1],e.use,prior&&prior.drawerIndex===i?prior:null]);
   out.set(id,{id,basis,confirmed,reserved,unit:u.id,check,limit:[Math.min(u.width*10,check?.clearWidthMm??0),Math.min(run.depth*10,check?.clearDepthMm??0),run.height*10/(u.drawerCount||3)]});
  }
 }
 return out;
}
function runnerChoices(doc,loads,options){
 const w=doc.room.workshop||{};
 const catalog=options?.technicalOnly?readWorkshopCatalog(w):getFactoryCatalog(doc);
 return catalog?drawerRunnerPlans(catalog,w.rows||{},doc.kitchen.units,doc.kitchen.runs,w.finishes,doc,loads,options):new Map();
}
function availablePack(pack,hosts){
 const valid=new Map(),warnings=[];
 for(const b of pack.bays){
  const h=hosts.get(b.id);if(!b.entryAt||!h?.confirmed||b.basis!==h.basis||!fits(b.size,h.limit)){warnings.push(b.id+' · أعد قياس الجزء الفارغ بعد تثبيت السكة ومطابقة مقاساته مع الواجهة.');continue;}
  valid.set(b.id,{...b,host:h});
 }
 return {valid,warnings};
}
function eligible(g,b){return !!b&&(g.fixed?g.fixed===b.id:b.allowAuto&&!b.host.reserved);}
function validGeometry(slot,g,b,packed){
 if(!eligible(g,b)||slot.turn&&!g.rotate)return false;
 const size=dims(g,slot.turn),at=slot.at;
 if(!fits(size,b.entry)||[0,1].some(k=>at[k]<b.entryAt[k]-eps||at[k]+size[k]>b.entryAt[k]+b.entry[k]+eps)||axes.some(k=>at[k]<0||at[k]+size[k]>b.size[k]+eps))return false;
 if(packed.some(p=>axes.every(k=>at[k]<p.at[k]+p.size[k]-eps&&at[k]+size[k]>p.at[k]+eps)))return false;
 if(at[2]>eps&&!packed.some(p=>g.stack&&p.group===g.id&&same(at[2],p.at[2]+p.size[2])&&[0,1].every(k=>at[k]>=p.at[k]-eps&&at[k]+size[k]<=p.at[k]+p.size[k]+eps)))return false;
 return true;
}
function measuredRunnerIssues(doc,pack,slots,scope,options){
 const loads=packMasses(pack,slots),plans=runnerChoices(doc,loads,options),issues=[];
 for(const [id,mass] of loads){
  const [uid,n]=id.split('#');if(scope&&!scope.unitIds.includes(uid))continue;
  if(!plans.get(uid)?.rows.some(r=>r.drawerIndex===Number(n)))issues.push(options?.technicalOnly?(plans.get(uid)?.statusCodes[0]||'NO_TECHNICAL_RUNNER'):id+' · وزن الأغراض الإضافي '+Number(mass.toFixed(3))+' كجم. لا يوجد طقم سكة متاح يحقق الحمولة والفتحة والمشوار.');
 }
 return issues;
}
function verifySlots(pack,slots,bays){
 const groups=new Map(pack.groups.map(g=>[g.id,g])),locations=new Map(),seen=new Set(),parts=new Map();
 for(const p of [...slots].sort((a,b)=>a.at[2]-b.at[2])){
  const g=groups.get(p.group),key=p.group+'#'+p.index,b=bays.get(p.bay);
  if(!g||p.index>g.count||seen.has(key)||!b||g.together&&locations.has(g.id)&&locations.get(g.id)!==p.bay)return 'تغيّر عدد الأغراض أو الدرج المخصص للمجموعة.';
  const local=parts.get(p.bay)||[];if(!validGeometry(p,g,b,local))return 'لا يطابق الموضع المقبول مقاس الدرج أو فتحة الإدخال أو شرط الرص أو تثبيت العميل.';
  local.push({...p,size:dims(g,p.turn)});parts.set(b.id,local);locations.set(g.id,b.id);seen.add(key);
 }
 return slots.length===pack.groups.reduce((n,g)=>n+g.count,0)?'':'لم يوزّع كامل عدد الأغراض المطلوبة.';
}
export function drawerPackIssues(doc,scope,options){
 const p=doc.room.workshop?.clientUsage?.pack;if(!p?.groups.length)return [];
 const selected=scope&&new Set(scope.unitIds),relevant=!selected||[...p.bays.map(b=>b.id),...p.groups.map(g=>g.fixed).filter(Boolean),...(p.accepted?.slots||[]).map(s=>s.bay)].some(id=>selected.has(id.split('#')[0]));
 if(!relevant)return [];
 if(!p.accepted||p.accepted.basis!==packKey(p))return [options?.technicalOnly?'ACCEPTANCE_STALE':'راجع توزيع الأغراض الحالي مع العميل ثم احفظ اعتماده.'];
 const {valid}=availablePack(p,drawerPackHosts(doc,options)),err=verifySlots(p,p.accepted.slots,valid);
 return [...(err?[options?.technicalOnly?'REQUEST_DOES_NOT_FIT':err]:[]),...measuredRunnerIssues(doc,p,p.accepted.slots,scope,options)];
}
export function proposeDrawerPacking(doc,{preserve=true,limit=12000,technicalOnly=false}={}){
 const raw=doc.room.workshop?.clientUsage?.pack,pack=raw&&cleanDrawerPack(raw);
 const options={technicalOnly},fail=(reason,status='review',code='REQUEST_DOES_NOT_FIT')=>({ok:false,status,reason:technicalOnly?code:reason,...(technicalOnly?{code}:{})});
 if(!pack?.groups.length)return fail('أدخل أغراض العميل وعددها أولًا.','review','REQUEST_REQUIRED');
 const {valid:bays,warnings}=availablePack(pack,drawerPackHosts(doc,options));if(!bays.size)return fail(warnings[0]||'عرّف الأبعاد الصافية للدرج وفتحة الإدخال أولًا.','review','MEASUREMENT_REQUIRED');
 const validBays=[...bays.values()].sort((a,b)=>a.id.localeCompare(b.id)),groups=new Map(pack.groups.map(g=>[g.id,g]));
 const work=pack.groups.flatMap(g=>Array.from({length:g.count},(_,i)=>({g,index:i+1}))).sort((a,b)=>Number(!!b.g.fixed)-Number(!!a.g.fixed)||volume(b.g)-volume(a.g)||a.g.id.localeCompare(b.g.id)||a.index-b.index);
 for(const g of pack.groups)if(!validBays.some(b=>eligible(g,b)&&[false,...(g.rotate?[true]:[])].some(turn=>fits(dims(g,turn),b.size)&&fits(dims(g,turn),b.entry))))return fail(g.name+' · لا يوجد درج مسموح مقاس تسع فتحته وحيزه هذا الغرض.');
 const fixed=preserve?(pack.accepted?.slots||[]).filter(s=>groups.has(s.group)&&s.index<=groups.get(s.group).count):[],used=new Map(),slots=[],locked=new Set(),budget=Math.min(Math.max(Math.floor(limit)||1,1),60000);
 let steps=0,trials=0,stopped=false,reason='لم نجد ترتيبًا صالحًا ضمن مواضع البحث المتاحة.',failureCode='REQUEST_DOES_NOT_FIT';
 function push(p,g){const arr=used.get(p.bay)||[];arr.push({...p,size:dims(g,p.turn)});used.set(p.bay,arr);slots.push(p);}
 const togetherOK=(g,id)=>!g.together||!slots.some(s=>s.group===g.id&&s.bay!==id);
 for(const p of [...fixed].sort((a,b)=>a.at[2]-b.at[2])){
  const g=groups.get(p.group);if(!togetherOK(g,p.bay)||!validGeometry(p,g,bays.get(p.bay),used.get(p.bay)||[]))return fail(g.name+' · تعارض موضع سبق أن اعتمده العميل. راجع تثبيته أو القياس.');
  push(p,g);locked.add(g.id+'#'+p.index);
 }
 const pending=work.filter(w=>!locked.has(w.g.id+'#'+w.index));
 const loadsCache=new Map();
 function search(i){
  if(i===pending.length){
   if(++trials>160){stopped=true;return false;}
   const loads=packMasses(pack,slots),key=JSON.stringify([...loads].sort()),issues=loadsCache.get(key)??measuredRunnerIssues(doc,pack,slots,undefined,options);
   loadsCache.set(key,issues);if(issues.length){reason=issues[0];if(technicalOnly)failureCode=issues[0];return false;}return true;
  }
  const {g,index}=pending[i];
  for(const b of validBays){
   if(!eligible(g,b)||!togetherOK(g,b.id))continue;
   const local=used.get(b.id)||[],coords=axes.map(k=>[...new Set([0,...(k<2?[Math.max(0,b.entryAt[k])]:[]),...local.map(p=>p.at[k]+p.size[k])])].sort((a,b)=>a-b));
   for(const z of coords[2])for(const y of coords[1])for(const x of coords[0])for(const turn of g.rotate&&!same(g.size[0],g.size[1])?[false,true]:[false]){
    if(stopped||++steps>budget){stopped=true;return false;}
    const p={group:g.id,index,bay:b.id,at:[x,y,z],turn};if(!validGeometry(p,g,b,local))continue;
    push(p,g);if(search(i+1))return true;slots.pop();used.get(b.id).pop();
   }
  }
  return false;
 }
 if(!search(0))return fail(stopped?'بلغ البحث المحدود سقفه قبل إثبات توزيع مكتمل. '+reason:reason,'unresolved',stopped?'SEARCH_LIMIT':failureCode);
 const loads=packMasses(pack,slots),before=runnerChoices(doc,packMasses(pack),options),after=runnerChoices(doc,loads,options),catalog=technicalOnly?null:getFactoryCatalog(doc);
 const selection=[];
 for(const id of new Set([...loads.keys(),...packMasses(pack).keys()])){
  const [uid,n]=id.split('#'),line=plans=>plans.get(uid)?.rows.find(r=>r.drawerIndex===Number(n)),now=line(after),old=line(before);
  const price=p=>catalog.items.find(i=>i.sku===p?.sku)?.price??null;
  selection.push({id,sku:now?.sku||'',oldSku:old?.sku||'',...(technicalOnly?{movingKg:now?.movingKg??null,travelMm:now?.travelMm??null}:{price:price(now),oldPrice:price(old)})});
 }
 return {ok:true,status:'proposed',slots,basis:packKey(pack),weights:[...loads],selection,steps};
}
export function acceptDrawerPacking(doc,proposal,reference,options){
 const p=doc.room.workshop?.clientUsage?.pack;if(!p||!proposal?.ok||proposal.basis!==packKey(p)||!String(reference||'').trim())return null;
 const clean=cleanDrawerPack({...p,accepted:{slots:proposal.slots,basis:proposal.basis,reference}});if(!clean)return null;
 const current=doc.room.workshop.clientUsage,next={...doc,room:{...doc.room,workshop:{...doc.room.workshop,clientUsage:{...current,pack:clean}}}};
 return drawerPackIssues(next,undefined,options).length?null:next;
}
