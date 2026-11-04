// Width changes transfer millimetres inside one continuous stretch. A door,
// unoccupied stretch, client bay or frozen station is never borrowed space.
import {kitchenGeometry,kitchenUnitSpecs,validateKitchenChange} from './kitchen-model.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {chooseRowOpenings} from './kitchen-row-fill.js';
import {optionEnvelopes} from './kitchen-chain-options.js';
import {riceSiteKey} from './kitchen-production-row-rice.js';
import {buildFactoryQuote,getFactoryCatalog,checkFactorySize,priceableWidth,familyCADKind} from './kitchen-workshop-factory.js';
import {budgetHold} from './kitchen-layout-brief.js';
import {designSpanIssue} from './kitchen-design-site.js';

const mm=v=>Math.round(v*1000)/1000;
const fail=(doc,reason)=>({ok:false,doc,reason});
const label=(u,e)=>e?.use||(e?.family==='rice'?'درج الأرز':kitchenUnitSpecs[u.kind]?.label)||e?.family||u.id;
const editableKinds=new Set(['drawers','storage','open-shelf','tall','bottle-rack','pullout']);
const keyFamily=(e,run)=>e.recipeId||(run.tier==='upper'&&e.family==='storage'?'upperStorage':e.family);
const edge=(e,side)=>e.startMm+(side==='end'?e.widthMm:0);

function metadata(doc){
 const out=new Map(),w=doc.room.workshop||{},geom=kitchenGeometry(doc.kitchen,doc.room);
 for(const u of geom.units){
  const row=w.rows?.[u.runId],e=row?.units.find(v=>v.id===u.id),run=geom.runs.find(v=>v.id===u.runId),rice=row?.riceChecks?.[u.id];
  const verified=rice&&e&&rice.signature===riceSiteKey(doc,run,u,e)&&rice.inside?.w<u.width*10;
  const fronts=u.doorLeaves?.length||(u.kind==='drawers'?(u.drawerCount||3):0);
  const face=u.kind==='drawers'?u.width*10:fronts?u.width*10/fronts:null;
  out.set(u.id,{u,run,e,name:label(u,e),front:face===null?null:mm(face),frontCount:fronts,inside:verified?rice.inside.w:null});
 }
 return out;
}
function partGroups(quote){
 const groups=new Map();
 for(const p of quote.pieces){
  const key=JSON.stringify([p.unitId,p.label,p.sku]);
  if(!groups.has(key))groups.set(key,{unitId:p.unitId,label:p.label,sku:p.sku,parts:[]});
  const part={a:p.a??null,b:p.b??null,count:p.count};
  if(p.operations?.length)part.operations=p.operations;
  if(p.ends)part.ends=p.ends;
  groups.get(key).parts.push(part);
 }
 return groups;
}
// Quote the complete project twice. A change to a cut dimension need not
// change the bars or sheets actually purchased, and therefore may cost zero.
export function describeProposalChange(before,after){
 const a=metadata(before),b=metadata(after),changes=[];
 for(const [id,p] of a){
  const q=b.get(id);if(!q)continue;
  const oldW=mm(p.u.width*10),newW=mm(q.u.width*10),oldU=mm(p.u.u*10),newU=mm(q.u.u*10);
  if(oldW===newW&&oldU===newU&&p.run.id===q.run.id)continue;
  const inside={beforeMm:p.inside,afterMm:q.inside,status:q.inside===null?'pending':'measured',
   note:q.inside!==null?'صافي درج الأرز من القياس المربوط بهذه الوصفة.':p.inside!==null?'القياس السابق يخص العرض القديم. أعد مطابقة الصافي والسكة.':'يحتاج الصافي الداخلي إلى قياس أو وصفة صافية موثّقة.'};
  changes.push({unitId:id,label:q.name,wall:q.run.wall||q.run.id,family:q.e?.family||q.u.kind,beforeStartMm:oldU,afterStartMm:newU,beforeWidthMm:oldW,afterWidthMm:newW,
   deltaWidthMm:mm(newW-oldW),deltaStartMm:mm(newU-oldU),frontBeforeMm:p.front,frontAfterMm:q.front,frontCountBefore:p.frontCount,frontCountAfter:q.frontCount,inside});
 }
 const qa=buildFactoryQuote(before),qb=buildFactoryQuote(after),pa=partGroups(qa),pb=partGroups(qb),cutChanges=[];
 for(const key of new Set([...pa.keys(),...pb.keys()])){
  const old=pa.get(key)?.parts||[],next=pb.get(key)?.parts||[];
  if(JSON.stringify(old)===JSON.stringify(next))continue;
  const {unitId,sku,label}=pa.get(key)||pb.get(key);cutChanges.push({unitId,label,sku,before:old,after:next});
 }
 const price={beforeSar:qa.total,afterSar:qb.total,deltaSar:qa.total===null||qb.total===null?null:(Math.round(qb.total*100)-Math.round(qa.total*100))/100};
 const notes=[];
 if(price.deltaSar===null)notes.push('فرق السعر معلّق حتى اكتمال الحصر والتسعير في النسختين.');
 const hold=budgetHold(qb,after.room.workshop?.layoutBrief);if(hold)notes.push(hold);
 if(changes.some(c=>c.family==='rice'&&c.inside.status==='pending'))notes.push('راجع صافي درج الأرز وحمولة سكته والمحتويات المحجوزة عند العرض الجديد.');
 const prior=new Set([...qa.issues,...qa.releaseIssues]);for(const issue of [...qb.issues,...qb.releaseIssues])if(!prior.has(issue))notes.push(issue);
 return {changes,cutChanges,price,hold,notes:[...new Set(notes)]};
}
function anchored(doc,e,u){
 const w=doc.room.workshop||{};
 return !editableKinds.has(u.kind)||e.family==='sink'||e.family==='dishwasher'||!!u.modelSpec||
  w.applianceIntake?.some(x=>x.host===e.id)||w.applianceFit?.devices?.some(x=>x.host===e.id);
}
export function snapFactoryWidthMm(doc,unitId,widthMm){
 const unit=doc.kitchen.units.find(u=>u.id===unitId),row=doc.room.workshop?.rows?.[unit?.runId];
 const member=row?.units.find(e=>e.id===unitId),run=doc.kitchen.runs.find(r=>r.id===unit?.runId);
 if(!member||!run)return Math.round(widthMm);
 const family=keyFamily(member,run),catalog=readWorkshopCatalog(doc.room.workshop)||getFactoryCatalog(doc);
 const step=catalog.families?.[family]?.stepMm||1;
 return member.widthMm+Math.round((widthMm-member.widthMm)/step)*step;
}
export function factoryWidthEditable(doc,u,e){
 // A user's width lock protects the value from automatic redistribution; it
 // does not make the user's own explicit edit read-only. Appliance/model/site
 // ownership is still enforced by anchored().
 return !!u&&!!e&&!anchored(doc,e,u);
}
// Moving a whole unit preserves its width and usage. A width-only lock does
// not pin its station; appliance hosts and explicit position locks do.
export function factoryPositionEditable(doc,u,e){
 return !!doc?.room&&!!u&&!!e&&!e.locks?.position&&!anchored(doc,e,u);
}
// A single-kitchen commit cannot change the geometry owned by a workshop recipe.
// Ignore pre-existing discrepancies when the user is only inspecting/finishing a unit.
export function factoryGeometryReason(doc,next){
 const rows=doc?.room.workshop?.rows;
 if(!rows||next.units===doc.kitchen.units)return '';
 const old=new Map(doc.kitchen.units.map(u=>[u.id,u])),after=new Map(next.units.map(u=>[u.id,u]));
 for(const row of Object.values(rows)){
   for(const e of row.units){
     const a=old.get(e.id),b=after.get(e.id);
     if(a&&(!b||['runId','kind','width','u'].some(key=>a[key]!==b[key])))return 'هندسة هذه الوحدة مرتبطة بوصفة المصنع. استخدم تعديل عرض الوحدة أو تخصيص صف المصنع.';
   }
 }
 if(next.units.some(u=>rows[u.runId]&&old.get(u.id)?.runId!==u.runId))return 'أضف الوحدة من تخصيص صف المصنع لاحتساب رسمها وقطعها معًا.';
 return '';
}
// A drawer/cupboard with a custom interior must not be nominated as a donor
// for another unit, even when the salesperson hasn't separately pinned width.
function dedicated(w,e,u){
 return e.family!=='storage'||u.kind!=='storage'&&u.kind!=='open-shelf'||u.detail||e.use||e.drawerUses?.some(Boolean)||
  e.locks.usage||e.hardwareChoices||w.clientUsage?.tasks?.some(x=>x.unitId===u.id||x.route?.to===u.id)||
  (u.interior?.dividers||0)>0||(u.interior?.shelves??1)!==(u.kind==='open-shelf'?2:1);
}
function sideChoices(chain,side,sign,limits){
 // Start at the changed edge. 'need' must be absorbed by this cabinet and
 // those beyond it. Amounts must be whole increments of each specific family.
 const memo=new Map(),done={touch:0,resizes:0,travel:0,move:null,next:null};
 const capacity=x=>x.donate?Math.max(0,sign>0?x.e.widthMm-Math.max(200,x.f.minMm):Math.min(2400,x.f.maxMm)-x.e.widthMm):0;
 const max=new Array(chain.length+1).fill(0);
 for(let i=chain.length-1;i>=0;i--){
  const x=chain[i];
  const self=Math.floor(capacity(x)/x.f.stepMm)*x.f.stepMm;
  max[i]=(x.e.locks.position&&side==='right'?0:self)+(x.e.locks.position?0:max[i+1]);
 }
 function find(i,need){
  if(!need)return done;
  if(i>=chain.length||need>max[i]||limits.exhausted)return null;
  const tag=i+':'+need;if(memo.has(tag))return memo.get(tag);
  const {e,f}=chain[i],width=e.widthMm,available=Math.min(need,capacity(chain[i]));
  let best=null;
  for(let take=Math.floor(available/f.stepMm)*f.stepMm;take>=0;take-=f.stepMm){
   if(++limits.steps>160000){limits.exhausted=true;break;}
   const rest=need-take,shift=side==='left'?-sign*rest:sign*need;
   if(e.locks.position&&shift)continue;
   const next=find(i+1,rest);if(!next)continue;
   const plan={touch:1+next.touch,resizes:Number(take>0)+next.resizes,travel:Math.abs(shift)+next.travel,
    move:{id:e.id,widthMm:width-sign*take,startMm:e.startMm+shift},next};
   if(!best||cost(plan,best)<0)best=plan;
   if(!rest)break; // one touched donor is unbeatable at this boundary
  }
  memo.set(tag,best);return best;
 }
 return {max:max[0],get:n=>find(0,n)};
}
const cost=(a,b)=>a.touch-b.touch||a.resizes-b.resizes||a.travel-b.travel;
function rearrange(doc,run,row,moves){
 const changes=new Map(moves.map(m=>[m.id,m]));
 const units=doc.kitchen.units.map(u=>{const m=changes.get(u.id);return m?{...u,u:m.startMm/10,width:m.widthMm/10}:u;});
 const kitchen={...doc.kitchen,units};
 const w=doc.room.workshop,rows={...w.rows,[run.id]:{...row,units:row.units.map(e=>{const m=changes.get(e.id);return m?{...e,widthMm:m.widthMm,startMm:m.startMm}:e;})}};
 const room={...doc.room,workshop:{...w,rows}},proposed={...doc,kitchen,room};
 const checked=validateKitchenChange(doc.kitchen,doc.room,kitchen,room);if(!checked.ok)return fail(doc,checked.reason);
 const envelopes=optionEnvelopes(proposed),expanded={...kitchen,features:[...kitchen.features,...envelopes]};
 const ids=new Set(changes.keys());
 const obstacle=kitchenGeometry(expanded,room).hardConflicts.find(c=>c.ids.some(id=>ids.has(id)));
 if(obstacle)return fail(doc,obstacle.label);
 // Retain the exact handing/door count choice. No other face is silently
 // re-handed just because one drawer became wider.
 const swing=chooseRowOpenings(expanded,room,new Set(),ids);
 if(!swing.ok)return fail(doc,swing.issue?.label||'لا يمكن فتح إحدى الواجهات بعد التعديل.');
 return {ok:true,doc:proposed};
}
export function previewKitchenWidthChange(doc,unitId,deltaMm,{withEffects=true,edge:dragEdge=null,explicitUserChange=false,inputKind='system'}={}){
 if(!Number.isSafeInteger(deltaMm)||!deltaMm||Math.abs(deltaMm)>2400)return fail(doc,'أدخل فرق عرض صحيحًا بالملليمتر.');
 const target=doc.kitchen.units.find(u=>u.id===unitId),run=target&&doc.kitchen.runs.find(r=>r.id===target.runId),w=doc.room.workshop||{},row=w.rows?.[run?.id];
 if(!row)return fail(doc,'اختر وحدة من صف المصنع المحفوظ في المقترح.');
 const units=new Map(doc.kitchen.units.map(u=>[u.id,u])),catalog=getFactoryCatalog(doc);
 if(String(catalog.layoutRevision)!==row.catalogVersion)return fail(doc,'تغيّرت عائلات المصنع. حدّث الصف قبل تعديل المقاسات.');
 const members=row.units.slice().sort((a,b)=>a.startMm-b.startMm),i=members.findIndex(e=>e.id===unitId),e=members[i];
 if(!e)return fail(doc,'الوحدة لا تتبع وصف الصف.');
 if(anchored(doc,e,target))return fail(doc,'هذا حيز جهاز أو مجلى محجوز بمكانه ومقاسه.');
 if(e.locks.width&&!explicitUserChange)return fail(doc,'عرض هذه الوحدة مثبّت. عدّله من أداة العرض الصريحة أو اسمح بإعادة توزيعه أولًا.');
 const g=kitchenGeometry(doc.kitchen,doc.room),geo=new Map(g.units.map(u=>[u.id,u]));
 const protectedUnits=[];
 for(const m of members){
  const u=units.get(m.id),f=catalog.families[keyFamily(m,run)],geom=geo.get(m.id);
  if(!u||u.runId!==run.id||!f||!geom||Math.abs(u.u*10-m.startMm)>.001||Math.abs(u.width*10-m.widthMm)>.001||!checkFactorySize(f,m.widthMm,mm(geom.height*10),mm(geom.depth*10)))return fail(doc,'تحتاج إحدى وحدات الصف إلى مطابقة الرسم مع وصفة المصنع. راجع الصف قبل التعديل.');
  if(anchored(doc,m,u)||m.locks.width&&m.locks.position)protectedUnits.push({unitId:m.id,label:label(u,m),startMm:m.startMm,widthMm:m.widthMm});
 }
 const f=catalog.families[keyFamily(e,run)],width=e.widthMm+deltaMm;
 if(width<200||width>2400||!priceableWidth(f,width))return fail(doc,'عرض '+width+' مم خارج مقاسات '+f.label+'؛ النطاق '+f.minMm+'–'+f.maxMm+' مم بخطوة '+f.stepMm+' مم.');
 const sign=Math.sign(deltaMm),n=Math.abs(deltaMm),limits={steps:0,exhausted:false};
 function neighbors(step){
  const list=[];let prev=e;
  for(let pos=i+step;pos>=0&&pos<members.length;pos+=step){
   const peer=members[pos],u=units.get(peer.id);
   const adjacent=step<0?edge(peer,'end')===edge(prev,'start'):edge(prev,'end')===edge(peer,'start');
   if(!adjacent||anchored(doc,peer,u)||dedicated(w,peer,u))break;
   const family=catalog.families[keyFamily(peer,run)];
   list.push({e:peer,f:family,donate:!peer.locks.width});prev=peer;
   if(peer.locks.position)break;
  }
  return list;
 }
 const left=sideChoices(e.locks.position?[]:neighbors(-1),'left',sign,limits),right=sideChoices(neighbors(1),'right',sign,limits);
 const available=dragEdge==='start'?left.max:dragEdge==='end'?right.max:left.max+right.max;
 if(dragEdge&&n>available)return fail(doc,'تمنع حدود الصف أو تثبيت الوحدة المجاورة نقل هذه الحافة. جرّب الحافة الأخرى أو أدخل العرض في الخصائص. ينقص التعديل '+(n-available)+' مم عند هذه الحافة.');
 if(n>available)return fail(doc,'ينقص التعديل '+(n-available)+' مم في الجزء المتصل حول الوحدة بعد تثبيت الأجهزة واحترام حدود التخزين.');
 const alternatives=[];
 const transfers=dragEdge==='start'?[n]:dragEdge==='end'?[0]:[0,n,...Array.from({length:n-1},(_,k)=>k+1)];
 for(const l of transfers){
  if(l>left.max||n-l>right.max)continue;
  const a=left.get(l),b=right.get(n-l);if(!a||!b)continue;
  alternatives.push({touch:a.touch+b.touch,resizes:a.resizes+b.resizes,travel:a.travel+b.travel+l,
   targetStart:e.startMm-sign*l,left:a,right:b});
 }
 alternatives.sort(cost);
 let reason='';
 for(const a of alternatives.slice(0,32)){
  const moves=[{id:unitId,startMm:a.targetStart,widthMm:width}];
  for(const side of [a.left,a.right])for(let link=side;link.move;link=link.next)moves.push(link.move);
  const out=rearrange(doc,run,row,moves);if(!out.ok){reason=out.reason;continue;}
  if(explicitUserChange){
   const changed=out.doc.room.workshop.rows[run.id];
   out.doc={...out.doc,room:{...out.doc.room,workshop:{...out.doc.room.workshop,rows:{...out.doc.room.workshop.rows,
    [run.id]:{...changed,units:changed.units.map(m=>m.id===unitId?{...m,locks:{...m.locks,width:true}}:m)}}}}};
  }
  if(!withEffects)return out; // During a grip gesture only validate and draw geometry.
  const summary=describeProposalChange(doc,out.doc);
  return {...out,unitId,...summary,donors:summary.changes.filter(c=>c.unitId!==unitId&&c.deltaWidthMm<0).map(c=>({unitId:c.unitId,label:c.label,amountMm:-c.deltaWidthMm})),protectedUnits};
 }
 if(limits.exhausted||alternatives.length>32)return fail(doc,'انتهى حد البحث المحلي دون إثبات تعديل صالح. راجع توزيع الوحدات المجاورة.');
 return fail(doc,reason||'لا يمكن توزيع هذا الفرق بخطوات مقاسات المصنع مع الحفاظ على المواضع المثبّتة والفراغات.');
}

/**
 * Move a unit to a peer's ORIGINAL sorted index within one continuous factory
 * row: A,B,C,D with A -> C becomes B,C,A,D; D -> B becomes A,D,B,C.
 * Only the crossed interval is repacked. IDs, widths, interval extents and
 * unrelated units remain unchanged in both CAD and the factory manifest.
 * A successful result is a pure preview; the caller owns project persistence.
 */
export function previewKitchenUnitMove(doc,unitId,targetId,{withEffects=true}={}){
 if(!doc?.room||!Array.isArray(doc.kitchen?.units)||!Array.isArray(doc.kitchen?.runs))return fail(doc,'اختر مشروعًا صالحًا قبل نقل الوحدة.');
 const units=new Map(doc.kitchen.units.map(u=>[u.id,u])),source=units.get(unitId),target=units.get(targetId);
 if(!source||!target||unitId===targetId)return fail(doc,'اختر الوحدة وموضع وحدة أخرى موجودة لنقلها.');
 if(source.runId!==target.runId)return fail(doc,'انقل الوحدة داخل صف المصنع نفسه.');
 const run=doc.kitchen.runs.find(r=>r.id===source.runId),row=doc.room.workshop?.rows?.[run?.id];
 if(!row||!Array.isArray(row.units)||!row.units.length)return fail(doc,'اختر وحدة من صف المصنع المحفوظ في التصميم.');
 const catalog=getFactoryCatalog(doc);
 if(String(catalog.layoutRevision)!==row.catalogVersion)return fail(doc,'تغيّرت عائلات المصنع. حدّث الصف قبل نقل الوحدات.');
 const ids=new Set(row.units.map(e=>e.id)),live=doc.kitchen.units.filter(u=>u.runId===run.id);
 if(ids.size!==row.units.length||live.length!==row.units.length||live.some(u=>!ids.has(u.id)))return fail(doc,'تحتاج وحدات الصف إلى مطابقة الرسم مع وصفة المصنع قبل النقل.');
 const geo=new Map(kitchenGeometry(doc.kitchen,doc.room).units.map(u=>[u.id,u])),protectedUnits=[];
 for(const e of row.units){
  const u=units.get(e.id),family=keyFamily(e,run),f=catalog.families[family],geometry=geo.get(e.id);
  if(!u||!geometry||u.runId!==run.id||!f||!e.locks||!Number.isSafeInteger(e.startMm)||!Number.isSafeInteger(e.widthMm)||
    Math.abs(u.u*10-e.startMm)>.001||Math.abs(u.width*10-e.widthMm)>.001||u.kind!==familyCADKind(f,f.base||family)||
    !checkFactorySize(f,e.widthMm,mm(geometry.height*10),mm(geometry.depth*10)))return fail(doc,'تحتاج إحدى وحدات الصف إلى مطابقة الرسم مع وصفة المصنع. راجع الصف قبل النقل.');
  if(!factoryPositionEditable(doc,u,e))protectedUnits.push({unitId:e.id,label:label(u,e),startMm:e.startMm,widthMm:e.widthMm});
 }
 const siteIssue=designSpanIssue(doc,[run]);if(siteIssue)return fail(doc,siteIssue);
 const members=row.units.slice().sort((a,b)=>a.startMm-b.startMm),from=members.findIndex(e=>e.id===unitId),to=members.findIndex(e=>e.id===targetId);
 if(from<0||to<0)return fail(doc,'الوحدة أو موضعها لا يتبع وصف الصف.');
 const lo=Math.min(from,to),hi=Math.max(from,to),crossed=members.slice(lo,hi+1);
 if(crossed.some(e=>!factoryPositionEditable(doc,units.get(e.id),e)))return fail(doc,'لا يمكن نقل وحدة عبر موضع مثبّت أو حيز جهاز أو مجلى محجوز.');
 if(crossed.some((e,i)=>i>0&&Math.abs(edge(crossed[i-1],'end')-e.startMm)>.001))return fail(doc,'يجب أن تبقى الوحدات في جزء متصل من الصف دون عبور فراغ مقصود.');
 const [moved]=crossed.splice(from-lo,1);crossed.splice(to-lo,0,moved);
 let start=members[lo].startMm;
 const moves=crossed.map(e=>{const next={id:e.id,startMm:start,widthMm:e.widthMm};start+=e.widthMm;return next;});
 const out=rearrange(doc,run,row,moves);if(!out.ok)return out;
 if(!withEffects)return {...out,unitId};
 return {...out,unitId,...describeProposalChange(doc,out.doc),donors:[],protectedUnits};
}
