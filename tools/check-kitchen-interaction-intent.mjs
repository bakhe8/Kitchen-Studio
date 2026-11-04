import assert from 'node:assert/strict';
import {createInteractionSession,previewInteractionIntent,commitInteractionPreview} from '../public/kitchen-interaction-intent.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';

const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});
assert(generated.ok,generated.reason);
const doc=structuredClone(generated.candidates[0].doc);
const row=Object.values(doc.room.workshop.rows).find(r=>r.units.some(u=>u.family==='rice'));
const rice=row.units.find(u=>u.family==='rice'),storage=row.units.find(u=>u.family==='storage');
const washer=row.units.find(u=>u.family==='dishwasher');
const original=JSON.stringify(doc);
const intent=(session,inputKind='number',extra={})=>({sessionId:session.sessionId,baseRevision:session.baseRevision,
 objectId:rice.id,property:'widthMm',requestedValue:700,referenceEdge:'end',inputKind,explicitUserChange:true,...extra});

// Catch an input route weakening constraints or changing geometry/locks.
const previews=['number','grip','button'].map(inputKind=>{
 const session=createInteractionSession(doc);
 const preview=previewInteractionIntent(doc,intent(session,inputKind),session);
 assert.equal(preview.status,'ready');assert(preview.ok,preview.reason);
 assert.equal(preview.candidate,preview.doc);
 assert.deepEqual(preview.affectedObjects.map(o=>o.objectId).sort(),[rice.id,storage.id].sort());
 assert(preview.protectedObjects.some(o=>o.objectId===washer.id));
 assert.deepEqual(preview.constraintReasons,[]);
 assert.equal(preview.effectsStatus,'complete');
 assert.equal(preview.catalogRevision,row.catalogVersion);
 assert.equal(typeof preview.measurementRevision,'string');
 assert.equal(commitInteractionPreview(preview,session).candidate,preview.candidate);
 return preview;
});
for(const preview of previews)assert.deepEqual(preview.candidate,previews[0].candidate);
assert.equal(JSON.stringify(doc),original,'preview and commit authorization never persist or mutate the source');
assert.deepEqual(previews[0].candidate.room.workshop.rows[doc.kitchen.units.find(u=>u.id===rice.id).runId].units
 .filter(u=>[rice.id,storage.id].includes(u.id)).map(u=>[u.id,u.widthMm]),[[rice.id,700],[storage.id,800]]);

// Catch old successful work applying after a newer (even invalid) intent.
const superseded=createInteractionSession(doc);
const old=previewInteractionIntent(doc,intent(superseded),superseded);
const newer=previewInteractionIntent(doc,intent(superseded,'number',{requestedValue:2500}),superseded);
assert.equal(newer.status,'blocked');assert(newer.constraintReasons.length);
assert.equal(commitInteractionPreview(old,superseded).status,'superseded');
assert.equal(commitInteractionPreview(newer,superseded).ok,false);

// Catch a late callback restoring an abandoned candidate.
const cancelled=createInteractionSession(doc),abandoned=previewInteractionIntent(doc,intent(cancelled),cancelled);
cancelled.cancel();
assert.equal(commitInteractionPreview(abandoned,cancelled).status,'cancelled');
assert.equal(previewInteractionIntent(doc,intent(cancelled),cancelled).status,'cancelled');

// Catch accepting stale revision metadata on either side of the preview boundary.
const stale=createInteractionSession('revision-1');
assert.equal(previewInteractionIntent(doc,intent(stale,'number',{baseRevision:'revision-0'}),stale).status,'stale');
const fresh=previewInteractionIntent(doc,intent(stale),stale);
stale.baseRevision='revision-2';
assert.equal(commitInteractionPreview(fresh,stale).status,'stale');
const sourceSession=createInteractionSession(doc);
assert.equal(previewInteractionIntent(structuredClone(doc),intent(sourceSession),sourceSession).status,'stale','document identity revisions cannot describe another source');
const other=createInteractionSession(doc);
assert.equal(commitInteractionPreview(previews[0],other).ok,false);

// A fast geometry preview cannot be committed before effects are calculated.
const deferred=createInteractionSession(doc),fast=previewInteractionIntent(doc,intent(deferred,'grip',{withEffects:false}),deferred);
assert.equal(fast.effectsStatus,'deferred');assert.equal(commitInteractionPreview(fast,deferred).ok,false);

// Catch width edits silently dropping target/user constraints or protected hosts.
const direct=previewKitchenWidthChange(doc,rice.id,100,{explicitUserChange:true});assert(direct.ok,direct.reason);
assert.equal(direct.doc.room.workshop.rows[doc.kitchen.units.find(u=>u.id===rice.id).runId].units.find(u=>u.id===rice.id).locks.width,true);
for(const inputKind of ['number','grip','button']){
 const session=createInteractionSession(doc),denied=previewInteractionIntent(doc,intent(session,inputKind,{objectId:washer.id}),session);
 assert.equal(denied.status,'blocked');assert(denied.constraintReasons.length);
}
const locked=structuredClone(doc),lockedRow=locked.room.workshop.rows[doc.kitchen.units.find(u=>u.id===rice.id).runId];
Object.assign(lockedRow.units.find(u=>u.id===rice.id).locks,{position:true,usage:true,finish:true});
const lockSession=createInteractionSession(locked),retained=previewInteractionIntent(locked,intent(lockSession),lockSession);
assert(retained.ok,retained.reason);
assert.deepEqual(retained.candidate.room.workshop.rows[doc.kitchen.units.find(u=>u.id===rice.id).runId].units.find(u=>u.id===rice.id).locks,
 {width:true,position:true,usage:true,finish:true});
lockedRow.units.find(u=>u.id===storage.id).locks.width=true;
for(const inputKind of ['number','grip','button']){
 const session=createInteractionSession(locked),denied=previewInteractionIntent(locked,intent(session,inputKind),session);
 assert.equal(denied.status,'blocked','a locked neighbor cannot donate width through any input');
}
console.log('Kitchen interaction intent: equivalent inputs, pure effects, locks, supersession, cancellation and revision guards PASS');
