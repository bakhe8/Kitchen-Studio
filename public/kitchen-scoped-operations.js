// Trusted operations start with the verified full archive. Neither a projected
// document nor a client-supplied solver result is ever a mutation authority.
import {checkedPortableArchive} from './kitchen-archive-validation.js';
import {cleanIdea} from './kitchen-ideas.js';
import {shapeForUnit,scenePlan} from './kitchen-project.js';
import {kitchenGeometry,kitchenUnitSpecs,updateUnit} from './kitchen-model.js';
import {validatePlan} from './shelf-model.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {cleanDrawerChecks,drawerBasis} from './kitchen-drawer-fit.js';
import {cleanDrawerPack} from './kitchen-drawer-pack-data.js';
import {drawerPackHosts,proposeDrawerPacking,acceptDrawerPacking} from './kitchen-drawer-packing.js';
import * as scope from './kitchen-project-scope.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {factorySpecialTargets,reviewSpecial} from './kitchen-workshop-factory-special.js';
import {reconcileWorkshopCatalogs} from './kitchen-catalog-records.js';

const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const clone=v=>structuredClone(v);
const canonical=v=>Array.isArray(v)?v.map(canonical):obj(v)?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const fail=()=>{throw Error('INVALID_OPERATION');};
const physical=['clearWidthMm','clearDepthMm','leftGapMm','rightGapMm','minTravelMm','freeTravelMm','emptyKg'];
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,clone(v[k])]));
function keys(v,allowed,required=allowed){if(!obj(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))fail();}
function bounded(v,depth=0,budget={n:0}){if(depth>35||++budget.n>20000)fail();if(v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=2000||typeof v==='number'&&Number.isFinite(v))return;if(Array.isArray(v)){for(const x of v)bounded(x,depth+1,budget);return;}if(!obj(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail();bounded(x,depth+1,budget);}}
const requireRole=(role,allowed)=>{if(!allowed.includes(role))fail();};
const workshop=doc=>doc.room.workshop||{};
const packing=(doc,role)=>scope.scopedDrawerPacking(doc,role);
function target(doc,id,index){
 const unit=doc.kitchen.units.find(u=>u.id===id),run=unit&&doc.kitchen.runs.find(r=>r.id===unit.runId);
 if(!unit||!run)fail();
 if(index!==undefined&&(!Number.isInteger(index)||index<1||index>(unit.drawerCount||3)||unit.kind!=='drawers'))fail();
 const row=workshop(doc).rows?.[run.id],entry=row?.units.find(u=>u.id===id),catalog=readWorkshopCatalog(workshop(doc));
 return {unit,run,row,entry,catalog};
}
function runnerTarget(doc,id,index){const t=target(doc,id,index);if(!t.entry||!t.catalog?.families[t.entry.recipeId||t.entry.family]?.drawerRunners?.length)fail();return t;}
const drawerRows=(doc,role)=>scope.scopedDrawerInputs(doc,role);
function workbench(doc,role){
 const geometry=kitchenGeometry(doc.kitchen,scenePlan(doc.room,doc.kitchen));
 return {units:doc.kitchen.units.map(unit=>{const g=geometry.units.find(v=>v.id===unit.id);return {id:unit.id,label:kitchenUnitSpecs[unit.kind]?.label||'وحدة',kind:unit.kind,runId:unit.runId,widthMm:unit.width*10,heightMm:g.height*10,depthMm:g.depth*10,canInterior:!!kitchenUnitSpecs[unit.kind]?.editableInterior,drawerCount:unit.kind==='drawers'?(unit.drawerCount||3):0};}),drawers:drawerRows(doc,role),packing:packing(doc,role)};
}
function unitPlan(doc,id){const {unit}=target(doc,id),g=kitchenGeometry(doc.kitchen,scenePlan(doc.room,doc.kitchen)).units.find(u=>u.id===id);if(!kitchenUnitSpecs[unit.kind]?.editableInterior||unit.detail&&!validatePlan(unit.detail))fail();const plan=shapeForUnit(unit,g);if(!plan)fail();return {unitId:id,label:kitchenUnitSpecs[unit.kind]?.label||'وحدة',plan};}
function replaceCheck(doc,t,index,value){
 const w=workshop(doc),checks=clone(t.row.drawerChecks||{}),set=checks[t.unit.id]||{};
 if(value===null)delete set[index];else set[index]=value;
 if(Object.keys(set).length){const cleaned=cleanDrawerChecks(set);if(!cleaned)fail();checks[t.unit.id]=cleaned;}else delete checks[t.unit.id];
 const row={...t.row};if(Object.keys(checks).length)row.drawerChecks=checks;else delete row.drawerChecks;
 return {...doc,room:{...doc.room,workshop:{...w,rows:{...w.rows,[t.run.id]:row}}}};
}
function replacePack(doc,next){const w=workshop(doc),pack=cleanDrawerPack(next);if(!pack)fail();return {...doc,room:{...doc.room,workshop:{...w,clientUsage:{...w.clientUsage,tasks:w.clientUsage?.tasks||[],pack}}}};}
function proposalResult(doc,role,proposal){
 const safe=scope.scopedDrawerPackingResult(proposal,role);
 if(!safe.ok)return {status:'TECHNICAL_REVIEW_REQUIRED',code:safe.code,slots:[],weights:[],selection:[],packing:packing(doc,role)};
 return {status:'ready',slots:safe.slots,weights:safe.selection.map(s=>pick(s,['bayId','movingKg'])),selection:safe.selection,packing:packing(doc,role)};
}
const specialDraftKeys=['reviewer','measurement','drawing','instructions','lines','fit','bay'];
const specialLineKeys=['sku','label','count','a','b','operation','operations'];
const machiningKeys=['kind','machine','reference','tolerance','xFrom','yFrom','x','y','diameter','depth','length','width','angle','radius','minutes','provider','confirmation','leadDays'];
const specialTargets=doc=>factorySpecialTargets(doc).filter(target=>!target.build);
function specialDraft(sheet){return sheet?{...pick(sheet,specialDraftKeys.filter(k=>k!=='lines')),lines:sheet.lines.map(line=>pick(line,specialLineKeys))}:null;}
function checkedSpecialDraft(draft){
 keys(draft,specialDraftKeys,['reviewer','measurement','drawing','instructions','lines']);
 if(!Array.isArray(draft.lines)||draft.lines.length>70)fail();
 for(const line of draft.lines){keys(line,specialLineKeys,['sku','label','count','operation']);if(line.operations!==undefined){if(!Array.isArray(line.operations))fail();for(const op of line.operations)keys(op,machiningKeys,['kind','machine','reference','tolerance','xFrom','yFrom','x','y','diameter','depth','length','width','angle','radius']);}}
 if(draft.fit!==undefined){keys(draft.fit,['model','manual','required','available']);keys(draft.fit.required,['width','depth','height']);keys(draft.fit.available,['width','depth','height']);}
 if(draft.bay!==undefined&&typeof draft.bay!=='boolean')fail();
 return draft;
}
function specialView(doc,meta,targetId){
 const all=specialTargets(doc),catalog=readWorkshopCatalog(workshop(doc));
 if(targetId!==undefined&&(typeof targetId!=='string'||!all.some(t=>t.id===targetId)))fail();
 const selected=targetId===undefined?all[0]:all.find(t=>t.id===targetId);
 const targets=all.map(target=>{
  const sheet=catalog?.specials?.[target.id],fresh=sheet&&reviewSpecial(target,specialDraft(sheet),catalog.items);
  const current=!!fresh&&sheet.signature===fresh.signature&&sheet.lines.every((line,i)=>line.materialKey===fresh.lines[i]?.materialKey);
  return {...pick(target,['id','label','kind','walls','unitId','runId','appliance','hardware']),current};
 });
 // Reuse the established technical material allowlist. The wider context and
 // factory record are never returned by this operation.
 const items=scope.projectView('factory',{type:'kitchen-studio',version:2,design:doc,photos:{},fieldFiles:[]},{id:meta.id,revision:meta.expectedRevision,subject:meta.subject}).context.materials;
 return {targets,targetId:selected?.id??null,draft:selected?specialDraft(catalog?.specials?.[selected.id]):null,items};
}

export function executeProjectOperation(role,archive,envelope,meta){
 try{
  requireRole(role,['factory','rep']);bounded(envelope);keys(envelope,['type','version','baseRevision','operation','review'],['type','version','baseRevision','operation']);
  if(envelope.type!=='kitchen-project-operation'||envelope.version!==1||!Number.isSafeInteger(envelope.baseRevision)||envelope.baseRevision<1||envelope.baseRevision!==meta?.expectedRevision||typeof meta?.id!=='string'||!meta.id||typeof meta.subject!=='string'||!meta.subject||envelope.review!==undefined&&!(typeof envelope.review==='string'&&/^[a-f0-9]{64}$/.test(envelope.review)))fail();
  checkedPortableArchive(archive);const before=cleanIdea(archive.design),op=envelope.operation;let doc=before,result,mutates=false;
  if(!obj(op)||typeof op.kind!=='string')fail();
  if(op.kind==='workbench.read'){keys(op,['kind']);result=workbench(doc,role);}
  else if(op.kind==='special.open'){
   requireRole(role,['factory']);keys(op,['kind','targetId'],['kind']);result=specialView(doc,meta,op.targetId);
  }else if(op.kind==='special.review'){
   requireRole(role,['factory']);keys(op,['kind','targetId','draft']);const target=specialTargets(doc).find(t=>t.id===op.targetId),w=workshop(doc),catalog=readWorkshopCatalog(w);
   if(!target||!catalog)fail();const draft=checkedSpecialDraft(op.draft);if(draft.bay&&!target.appliance)fail();
   const sheet=reviewSpecial(target,draft,catalog.items);if(!sheet)fail();
   const reconciled=reconcileWorkshopCatalogs({...w,catalog:{...catalog,specials:{...catalog.specials,[target.id]:sheet}}},w);if(!reconciled)fail();
   doc={...doc,room:{...doc.room,workshop:reconciled}};result=specialView(doc,meta,target.id);mutates=true;
  }
  else if(op.kind==='interior.open'){keys(op,['kind','unitId']);result=unitPlan(doc,op.unitId);}
  else if(op.kind==='interior.set'){
   keys(op,['kind','unitId','plan']);const original=unitPlan(doc,op.unitId).plan;
   keys(op.plan,['version','wall','cab','cols','rows','cells','finish','wallColor','selectedCell','depth','cellGrids','wallGrid','selection','bayFinishes'],['version','wall','cab','cols','rows','cells','finish','wallColor','selectedCell']);
   const plan=validatePlan(op.plan);if(!plan||!equal(plan.cab,original.cab)||!equal(plan.wall,original.wall)||plan.depth!==original.depth||plan.wallGrid!=null)fail();
   const changed=updateUnit(doc.kitchen,scenePlan(doc.room,doc.kitchen),op.unitId,{detail:plan});if(!changed.ok)fail();
   const old=doc.kitchen.units.find(u=>u.id===op.unitId),unit=changed.kitchen.units.find(u=>u.id===op.unitId),expected={...old,detail:unit.detail,...(doc.kitchen.runs.find(r=>r.id===old.runId).autoFill?{fillRole:'fixed'}:{})};
   if(!equal(unit,expected)||!equal(changed.kitchen,{...doc.kitchen,units:doc.kitchen.units.map(u=>u.id===op.unitId?unit:u)}))fail();
   doc={...doc,kitchen:changed.kitchen};result=unitPlan(doc,op.unitId);mutates=true;
  }else if(op.kind==='drawer.measure'){
   requireRole(role,['factory']);keys(op,['kind','unitId','index','values']);const t=runnerTarget(doc,op.unitId,op.index),prior=t.row.drawerChecks?.[op.unitId]?.[op.index];
   if(op.values===null){if(prior&&(prior.contentsKg!==null||prior.pin))fail();doc=replaceCheck(doc,t,op.index,null);}
   else{keys(op.values,[...physical,'reference']);const value={...op.values,contentsKg:prior?.contentsKg??null,...(prior?.pin?{pin:prior.pin}:{}),basis:drawerBasis(t.unit,t.run,t.entry,t.catalog,workshop(doc).finishes,op.index)};doc=replaceCheck(doc,t,op.index,value);}
   result={drawer:drawerRows(doc,role).find(x=>x.unitId===op.unitId&&x.index===op.index)};mutates=true;
  }else if(op.kind==='drawer.preference'){
   requireRole(role,['rep']);keys(op,['kind','unitId','index','contentsKg','pin']);const t=runnerTarget(doc,op.unitId,op.index),prior=t.row.drawerChecks?.[op.unitId]?.[op.index];
   if(!prior||!Number.isFinite(op.contentsKg)||op.contentsKg<0||op.contentsKg>500||typeof op.pin!=='string'||op.pin&&!t.catalog.families[t.entry.recipeId||t.entry.family].drawerRunners.includes(op.pin))fail();
   const value={...prior,contentsKg:op.contentsKg};if(op.pin)value.pin=op.pin;else delete value.pin;
   const priorHosts=drawerPackHosts(doc,{technicalOnly:true});
   doc=replaceCheck(doc,t,op.index,value);
   const p=workshop(doc).clientUsage?.pack;
   if(p){const nextHosts=drawerPackHosts(doc,{technicalOnly:true}),bayId=op.unitId+'#'+op.index,oldHost=priorHosts.get(bayId),newHost=nextHosts.get(bayId);
    // Only the dependency on the answered load/pin changed. Keep measured
    // physical dimensions; never refresh a stale measurement or acceptance.
    if(oldHost?.confirmed&&newHost?.confirmed)doc=replacePack(doc,{...p,bays:p.bays.map(b=>b.id===bayId&&b.basis===oldHost.basis?{...b,basis:newHost.basis}:b)});
   }
   result={drawer:drawerRows(doc,role).find(x=>x.unitId===op.unitId&&x.index===op.index)};mutates=true;
  }else if(op.kind==='packing.measure'){
   requireRole(role,['factory']);keys(op,['kind','bayId','values']);if(typeof op.bayId!=='string')fail();
   const p=workshop(doc).clientUsage?.pack||{bays:[],groups:[]},prior=p.bays.find(b=>b.id===op.bayId),host=drawerPackHosts(doc,{technicalOnly:true}).get(op.bayId);
   if(!host||op.values===null&&(prior?.allowAuto||(p.accepted?.slots||[]).some(s=>s.bay===op.bayId)))fail();let bays=p.bays.filter(b=>b.id!==op.bayId);
   if(op.values!==null){keys(op.values,['size','entry','entryAt','reference']);if(!host.confirmed||op.values.size.some((v,i)=>v>host.limit[i]))fail();const replacement={id:op.bayId,...op.values,basis:host.basis,allowAuto:prior?.allowAuto===true};bays=prior?p.bays.map(b=>b.id===op.bayId?replacement:b):[...p.bays,replacement];}
   doc=replacePack(doc,{...p,bays});result={packing:packing(doc,role)};mutates=true;
  }else if(op.kind==='packing.propose'||op.kind==='packing.accept'){
   const accept=op.kind==='packing.accept';keys(op,accept?['kind','preserve','reference']:['kind','preserve']);if(typeof op.preserve!=='boolean')fail();if(accept)requireRole(role,['rep']);
   const proposal=proposeDrawerPacking(doc,{preserve:op.preserve,limit:12000,technicalOnly:true});result=proposalResult(doc,role,proposal);
   if(accept){if(typeof op.reference!=='string'||!op.reference.trim()||op.reference.length>180||!proposal.ok)fail();const next=acceptDrawerPacking(doc,proposal,op.reference,{technicalOnly:true});if(!next)fail();doc=next;result=proposalResult(doc,role,proposal);mutates=true;}
  }else if(op.kind==='packing.clear'){
   requireRole(role,['rep']);keys(op,['kind']);const p=workshop(doc).clientUsage?.pack;if(!p)fail();const next={...p};delete next.accepted;doc=replacePack(doc,next);result={packing:packing(doc,role)};mutates=true;
  }else fail();
  const next=mutates?{...clone(archive),design:cleanIdea(doc)}:undefined;if(mutates){if(!next.design)fail();checkedPortableArchive(next);}
  // The revision identifies the immutable source. Hash only the public command
  // and result, never private recipes or low-entropy hidden prices/weights.
  const review=mutates?offlineDigest(new TextEncoder().encode(JSON.stringify(canonical([2,meta.id,meta.subject,role,envelope.baseRevision,op,result])))):null;
  return {ok:true,mutates,...(next?{archive:next}:{}),result,review};
 }catch{return {ok:false,reason:'تعذّر تنفيذ العملية بهذه البيانات. راجع القياسات والصلاحية والنسخة الحالية.'};}
}
