// Ephemeral coordination for width edits. Geometry and manufacturing constraints
// remain owned by previewKitchenWidthChange; nothing here writes a project.
import {previewKitchenWidthChange} from './kitchen-proposal-change.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';

const sessions=new WeakMap(),revisions=new WeakMap();
let nextSession=0,nextRevision=0;
const validDocument=doc=>!!doc?.room&&Array.isArray(doc.kitchen?.units)&&Array.isArray(doc.kitchen?.runs);
function revisionFor(doc){
 if(!revisions.has(doc))revisions.set(doc,'local-'+(++nextRevision));
 return revisions.get(doc);
}
// Callers use immutable document snapshots. A lock, catalog, measurement or
// geometry edit must replace the document, even when its kitchen is unchanged.
// This local token is not a server revision or a persisted schema field.
export function createInteractionSession(baseDoc){
 if(!validDocument(baseDoc))throw new TypeError('An interaction requires a kitchen document.');
 const handle=Object.freeze({sessionId:'width-'+(++nextSession),baseRevision:revisionFor(baseDoc)});
 sessions.set(handle,{base:baseDoc,phase:'active',sequence:0,latest:null});
 return handle;
}
export function cancelInteractionSession(session){
 const state=sessions.get(session);
 if(!state||state.phase!=='active')return false;
 state.phase='cancelled';state.latest=null;return true;
}
const messages={
 invalid:'أدخل عرضًا صحيحًا بالملليمتر لوحدة موجودة.',
 stale:'تغيّر المشروع. أعد معاينة عرض الوحدة.',
 cancelled:'أُلغيت معاينة المقاس. بقي التصميم كما كان.',
 superseded:'توجد معاينة أحدث. راجع المقاس الحالي قبل تطبيقه.',
 committed:'طُبّقت هذه المعاينة بالفعل.',
 deferred:'أكمل معاينة أثر المقاس قبل تطبيقه.'
};
function rejected(doc,session,status,reason=messages[status],intentId=null){
 return {ok:false,changed:false,doc,candidate:null,status,reason,
  sessionId:session?.sessionId??null,baseRevision:session?.baseRevision??null,intentId,
  affectedObjects:[],changedProperties:[],protectedProperties:[],constraintReasons:[{code:status,message:reason}],
  unresolvedEvidence:null,effectsStatus:'unavailable'};
}
function propertyChanges(before,after){
 const changed=[];
 const previous=new Map(before.kitchen.units.map(u=>[u.id,u]));
 for(const unit of after.kitchen.units){
  const old=previous.get(unit.id);if(!old)continue;
  for(const [property,key] of [['width','width'],['start','u']]){
   const a=Math.round(old[key]*1000)/100,b=Math.round(unit[key]*1000)/100;
   if(a!==b)changed.push({objectId:unit.id,property,before:a,after:b});
  }
 }
 for(const [runId,row] of Object.entries(after.room.workshop?.rows||{})){
  const old=new Map((before.room.workshop?.rows?.[runId]?.units||[]).map(u=>[u.id,u]));
  for(const unit of row.units)for(const property of ['width','position','usage','finish']){
   const a=old.get(unit.id)?.locks?.[property]===true,b=unit.locks?.[property]===true;
   if(a!==b)changed.push({objectId:unit.id,property:'locks.'+property,before:a,after:b});
  }
 }
 return changed;
}
function protections(doc,out,objectId){
 const unit=doc.kitchen.units.find(u=>u.id===objectId),row=doc.room.workshop?.rows?.[unit?.runId],items=[];
 for(const member of row?.units||[])for(const [property,locked] of Object.entries(member.locks||{})){
  if(locked)items.push({objectId:member.id,property,source:'user'});
 }
 for(const member of out.protectedUnits||[])for(const property of ['width','position']){
  if(!items.some(item=>item.objectId===member.unitId&&item.property===property))items.push({objectId:member.unitId,property,source:'domain'});
 }
 return items;
}
export function previewInteractionIntent(doc,intent,session,{withEffects=true}={}){
 const state=sessions.get(session);
 if(!state)return rejected(doc,session,'invalid');
 if(state.phase!=='active')return rejected(doc,session,state.phase);
 // Every request, including an invalid or unchanged value, supersedes the old
 // candidate. A delayed UI callback cannot apply a previously valid preview.
 const intentId=session.sessionId+':'+(++state.sequence);state.latest=null;
 if(doc!==state.base)return rejected(doc,session,'stale',undefined,intentId);
 const referenceEdge=intent?.referenceEdge??null,inputKind=intent?.inputKind??'system';
 if(!intent||intent.property!=='width'||typeof intent.objectId!=='string'||!Number.isSafeInteger(intent.requestedValue)||
  ![null,'start','end'].includes(referenceEdge)||!['system','number','grip','button','scrub'].includes(inputKind)||
  intent.explicitUserChange!==undefined&&typeof intent.explicitUserChange!=='boolean'||
  intent.sessionId!==undefined&&intent.sessionId!==session.sessionId||
  intent.baseRevision!==undefined&&intent.baseRevision!==session.baseRevision||intent.intentId!==undefined){
  return rejected(doc,session,'invalid',undefined,intentId);
 }
 const unit=doc.kitchen.units.find(u=>u.id===intent.objectId);
 if(!unit)return rejected(doc,session,'invalid',undefined,intentId);
 const normalized=Object.freeze({objectId:intent.objectId,property:'width',requestedValue:intent.requestedValue,
  referenceEdge,inputKind,explicitUserChange:intent.explicitUserChange===true});
 const delta=intent.requestedValue-Math.round(unit.width*10),unchanged=delta===0;
 const out=unchanged?{ok:true,doc}:previewKitchenWidthChange(doc,intent.objectId,delta,
  {withEffects,edge:referenceEdge,inputKind,explicitUserChange:normalized.explicitUserChange});
 if(!out.ok)return rejected(doc,session,'invalid',out.reason,intentId);
 const catalog=getFactoryCatalog(doc),changedProperties=unchanged?[]:propertyChanges(doc,out.doc);
 const preview={...out,unitId:intent.objectId,ok:true,changed:!unchanged,candidate:out.doc,
  status:unchanged?'unchanged':'valid',sessionId:session.sessionId,baseRevision:session.baseRevision,intentId,intent:normalized,
  affectedObjects:[...new Set(changedProperties.map(change=>change.objectId))],changedProperties,
  protectedProperties:protections(doc,out,intent.objectId),constraintReasons:[],
  // Calculated means effects were evaluated, not that the quote is complete or
  // that fabrication is approved. Unknown prices remain null in the domain result.
  effectsStatus:unchanged?'unchanged':withEffects?'calculated':'deferred',
  unresolvedEvidence:unchanged?[]:!withEffects?null:[
   ...(out.changes||[]).filter(change=>change.inside?.status==='pending').map(change=>({objectId:change.unitId,property:'inside',reason:change.inside.note})),
   ...(out.price?.deltaSar===null?[{property:'price',reason:'فرق السعر معلّق حتى اكتمال الحصر والتسعير في النسختين.'}]:[])
  ],catalogRevision:catalog.revision,catalogLayoutRevision:catalog.layoutRevision,measurementRevision:null};
 state.latest=Object.freeze(preview);return state.latest;
}
export function commitInteractionPreview(preview,session,currentDoc){
 const state=sessions.get(session);
 if(!state)return rejected(currentDoc,session,'invalid');
 if(state.phase!=='active')return rejected(currentDoc,session,state.phase);
 if(currentDoc!==state.base)return rejected(currentDoc,session,'stale');
 if(preview!==state.latest||!preview?.ok)return rejected(currentDoc,session,'superseded');
 if(preview.effectsStatus==='deferred')return rejected(currentDoc,session,'deferred');
 state.phase='committed';state.latest=null;
 return {...preview,status:preview.changed?'committed':'unchanged'};
}
