import assert from 'node:assert/strict';
import {createInteractionSession,previewInteractionIntent,commitInteractionPreview} from '../public/kitchen-interaction-intent.js';
import {newSurveyProject,saveProject,openKitchenProject,storedKitchenProject,savedProjectText,commitProject,undoProject,redoProject,kitchenHistory,kitchenFuture,forgetProjectHistory} from '../public/kitchen-project.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {applyChain} from '../public/kitchen-chain-model.js';

// Only the browser storage boundary is replaced; geometry, effects, validation,
// serialization and the project history below are the production implementations.
class Store {
 values=new Map();writes=0;
 get length(){return this.values.size;}
 key(index){return [...this.values.keys()][index]??null;}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,String(value));this.writes++;}
 removeItem(key){this.values.delete(key);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const good=out=>{assert.equal(out.ok,true,out.reason);return out;};
let fixture=newSurveyProject({widthMm:3600,lengthMm:3600,heightMm:2800,name:'شريحة التفاعل ٢٤٠٠'},localStorage);
fixture=good(applyChain(fixture,'back',{source:'drawing',rows:[{id:'end',kind:'corner',from:'origin',gapMm:3600}]})).doc;
const catalog=seedCatalog();
// Fixture-only factory constraint: the donor may shrink to 400 mm, never below.
// With the two outer 600 mm widths pinned, 900+400+600+600 needs 2500 mm.
catalog.families.storage.minMm=400;
fixture.room.workshop.catalog=catalog;
const filled=good(planWorkshopRow(fixture,{wall:'back',startMm:600,endMm:3000,tier:'base'}));
const runId=filled.runId;
const row=doc=>doc.room.workshop.rows[runId];
const widths=doc=>row(doc).units.map(u=>u.widthMm);
const starts=doc=>row(doc).units.map(u=>u.startMm);
const [first,target,donor,last]=row(filled.doc).units;
fixture=filled.doc;
Object.assign(first.locks,{width:true,position:true});
Object.assign(target.locks,{finish:true});
Object.assign(last.locks,{width:true,position:true});
assert.equal(saveProject(fixture),true);
let live=openKitchenProject();forgetProjectHistory();
assert.deepEqual(widths(live),[600,600,600,600]);
assert.deepEqual(starts(live),[600,1200,1800,2400]);
const run=live.kitchen.runs.find(r=>r.id===runId);
assert.equal((run.end-run.start)*10,2400);
const prior=structuredClone(live),priorText=savedProjectText();
const writesBefore=localStorage.writes;
const intent=(session,value)=>({sessionId:session.sessionId,baseRevision:session.baseRevision,
 objectId:target.id,property:'widthMm',requestedValue:value,referenceEdge:'end',inputKind:'number',explicitUserChange:true});
const session=createInteractionSession(live);

// Catch resizing only CAD, dropping the target lock, or hiding the donor effect.
const preview=good(previewInteractionIntent(live,intent(session,800),session));
assert.equal(preview.status,'ready');
assert.deepEqual(widths(preview.candidate),[600,800,400,600]);
assert.deepEqual(starts(preview.candidate),[600,1200,2000,2400]);
assert.deepEqual(preview.candidate.kitchen.units.filter(u=>u.runId===runId).map(u=>[u.u*10,u.width*10]),
 [[600,600],[1200,800],[2000,400],[2400,600]]);
assert.deepEqual(preview.affectedObjects.map(o=>[o.objectId,o.beforeWidthMm,o.afterWidthMm,o.deltaWidthMm]),
 [[target.id,600,800,200],[donor.id,600,400,-200]]);
assert(preview.affectedObjects.every(o=>o.label&&o.inside.note),'affected units carry a readable explanation');
assert.deepEqual(preview.donors.map(o=>[o.unitId,o.amountMm]),[[donor.id,200]]);
assert.deepEqual(row(preview.candidate).units[1].locks,{width:true,position:false,usage:false,finish:true});
for(const index of [0,2,3])assert.deepEqual(row(preview.candidate).units[index].locks,row(prior).units[index].locks);
assert.deepEqual(live,prior);assert.equal(savedProjectText(),priorText);
assert.equal(localStorage.writes,writesBefore);assert.equal(kitchenHistory().length,0);
const authorized=good(commitInteractionPreview(preview,session));
assert.equal(authorized.status,'committed');
assert.equal(localStorage.writes,writesBefore,'adapter authorization is not a project save');
const committed=good(commitProject(live,authorized.candidate));
assert.equal(committed.saved,true);assert.equal(committed.changed,true);live=committed.next;
assert.deepEqual(widths(storedKitchenProject()),[600,800,400,600]);
assert.equal(kitchenHistory().length,1,'target, donor and lock form one history operation');
assert.equal(kitchenFuture().length,0);
const saved=structuredClone(live),snapshot=savedProjectText(),writesAfterCommit=localStorage.writes;
assert.deepEqual(JSON.parse(snapshot),JSON.parse(JSON.stringify(saved)));

// Catch an edge-specific rejection hiding the exact 100 mm deficit, or replacing
// the last accepted 2400 mm candidate with the impossible 2500 mm request.
const conflictSession=createInteractionSession(live);
const conflict=previewInteractionIntent(live,intent(conflictSession,900),conflictSession);
assert.equal(conflict.status,'blocked');assert.equal(conflict.ok,false);assert.equal(conflict.candidate,null);
assert.equal(conflict.doc,live);
assert.match(conflict.reason,/100 مم/,'the 2500 mm request explains the 100 mm deficit');
assert(conflict.constraintReasons.some(reason=>/100 مم/.test(reason)));
assert.equal(commitInteractionPreview(conflict,conflictSession).ok,false);
assert.deepEqual(live,saved);assert.deepEqual(storedKitchenProject(),saved);
assert.equal(savedProjectText(),snapshot);assert.equal(localStorage.writes,writesAfterCommit);
assert.equal(kitchenHistory().length,1);

// Catch a cancelled or stale result reaching persistence after a valid preview.
const cancelled=createInteractionSession(live);
const abandoned=good(previewInteractionIntent(live,intent(cancelled,750),cancelled));
assert.deepEqual(widths(abandoned.candidate),[600,750,450,600]);
cancelled.cancel();
assert.equal(commitInteractionPreview(abandoned,cancelled).status,'cancelled');
assert.equal(previewInteractionIntent(live,intent(cancelled,700),cancelled).status,'cancelled');
const stale=createInteractionSession(live);
const late=good(previewInteractionIntent(live,intent(stale,750),stale));
stale.baseRevision=structuredClone(live);
assert.equal(commitInteractionPreview(late,stale).status,'stale');
assert.deepEqual(live,saved);assert.equal(savedProjectText(),snapshot);
assert.equal(localStorage.writes,writesAfterCommit);assert.equal(kitchenHistory().length,1);
assert.deepEqual(storedKitchenProject(),saved,'later previews leave the exact saved snapshot intact');

// Catch splitting the operation across history frames or losing locks/identity
// and factory relationships during round-trip serialization.
const undone=undoProject(live);assert.equal(undone?.saved,true);
assert.deepEqual(undone.next,prior,'one undo restores the whole original document');
assert.deepEqual(storedKitchenProject(),prior);
assert.equal(kitchenHistory().length,0);assert.equal(kitchenFuture().length,1);
assert.equal(undoProject(undone.next),null,'the resize was exactly one operation');
const redone=redoProject(undone.next);assert.equal(redone?.saved,true);
assert.deepEqual(redone.next,saved,'redo restores the accepted geometry, locks and relationships');
assert.deepEqual(storedKitchenProject(),saved);
assert.equal(savedProjectText(),snapshot);
assert.equal(kitchenHistory().length,1);assert.equal(kitchenFuture().length,0);
assert.equal(redoProject(redone.next),null);
console.log('Kitchen interaction slice: 2400 row, 600/800/400/600, explained 2500 conflict, cancellation, stale rejection, exact save snapshot and atomic undo/redo PASS');
