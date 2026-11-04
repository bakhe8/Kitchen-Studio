// A transient boundary around the existing domain preview. Revision values are
// opaque caller-owned tokens (the designer surfaces use document identity).
// Authorizing a candidate here never saves a project or grants an approval.
import {previewKitchenWidthChange} from './kitchen-proposal-change.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {stableHash} from './kitchen-measurement-identity.js';

let nextSession=0;
const sessions=new WeakMap(),previews=new WeakMap();
export function createInteractionSession(baseRevision){
 const session={sessionId:'interaction-'+(++nextSession),baseRevision,cancel(){sessions.get(session).cancelled=true;}};
 sessions.set(session,{cancelled:false,nextIntent:0,latest:null});return session;
}
const rejected=(status,reason)=>({ok:false,status,candidate:null,doc:null,reason,affectedObjects:[],protectedObjects:[],changedProperties:[],protectedProperties:[],constraintReasons:[reason],unresolvedEvidence:[],catalogRevision:null,measurementRevision:null,effectsStatus:'unavailable'});
function sessionIssue(session,baseRevision,sessionId){
 const state=sessions.get(session);
 if(!state||sessionId!==session.sessionId)return rejected('rejected','تغيّرت جلسة التعديل. أعد المعاينة.');
 if(state.cancelled)return rejected('cancelled','أُلغيت جلسة التعديل.');
 if(baseRevision!==session.baseRevision)return rejected('stale','تغيّر مصدر المعاينة. أعد التعديل من النسخة الحالية.');
 return null;
}
export function previewInteractionIntent(doc,intent,session){
 const issue=sessionIssue(session,intent?.baseRevision,intent?.sessionId);if(issue)return issue;
 const state=sessions.get(session),intentId=++state.nextIntent;
 // Even a rejected newer request supersedes an older successful preview.
 state.latest=null;
 if(session.baseRevision?.kitchen&&session.baseRevision!==doc)return rejected('stale','تغيّر مصدر المعاينة. أعد التعديل من النسخة الحالية.');
 if(intent.property!=='widthMm'||!['number','grip','button'].includes(intent.inputKind)||
   !Number.isSafeInteger(intent.requestedValue)||!['start','end',null,undefined].includes(intent.referenceEdge))return rejected('blocked','أدخل عرضًا صحيحًا بالملليمتر.');
 const unit=doc.kitchen.units.find(u=>u.id===intent.objectId);
 const out=previewKitchenWidthChange(doc,intent.objectId,intent.requestedValue-Math.round((unit?.width||0)*10),
  {edge:intent.referenceEdge,withEffects:intent.withEffects!==false,explicitUserChange:intent.explicitUserChange===true,inputKind:intent.inputKind});
 const changes=out.changes||[],affected=changes.length?changes.map(c=>({objectId:c.unitId,...c})):
  out.ok?out.doc.kitchen.units.filter(u=>{const before=doc.kitchen.units.find(v=>v.id===u.id);return before&&(before.width!==u.width||before.u!==u.u);}).map(u=>({objectId:u.id})):[];
 const result={...out,status:out.ok?'ready':'blocked',candidate:out.ok?out.doc:null,
  sessionId:session.sessionId,intentId,baseRevision:intent.baseRevision,
  affectedObjects:affected,protectedObjects:(out.protectedUnits||[]).map(u=>({objectId:u.unitId,...u})),
  changedProperties:changes.flatMap(c=>[['widthMm',c.beforeWidthMm,c.afterWidthMm],['startMm',c.beforeStartMm,c.afterStartMm]]
   .filter(([,before,after])=>before!==after).map(([property,before,after])=>({objectId:c.unitId,property,before,after}))),
  protectedProperties:(out.protectedUnits||[]).map(u=>({objectId:u.unitId,properties:['widthMm','startMm']})),
  constraintReasons:out.ok?[]:[out.reason],unresolvedEvidence:out.notes||[],
  catalogRevision:String(getFactoryCatalog(doc).layoutRevision),
  measurementRevision:stableHash(JSON.stringify([doc.room.fieldRegister||[],doc.room.workshop?.chains||{}])),
  effectsStatus:out.ok?(intent.withEffects===false?'deferred':'complete'):'unavailable'};
 state.latest=result;previews.set(result,{session,baseRevision:intent.baseRevision});return result;
}
export function commitInteractionPreview(preview,session){
 const record=previews.get(preview);
 if(!record||record.session!==session)return rejected('rejected','تغيّرت جلسة التعديل. أعد المعاينة.');
 const issue=sessionIssue(session,record.baseRevision,preview.sessionId);if(issue)return issue;
 if(sessions.get(session).latest!==preview)return rejected('superseded','توجد معاينة أحدث. راجع التعديل الحالي.');
 if(!preview.ok||preview.effectsStatus!=='complete')return rejected('blocked',preview.reason||'أكمل معاينة أثر التعديل قبل تطبيقه.');
 return {...preview,status:'committed'};
}
