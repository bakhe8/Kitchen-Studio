import assert from 'node:assert/strict';
import test from 'node:test';
import {createInteractionSession,previewInteractionIntent,commitInteractionPreview,cancelInteractionSession} from '../public/kitchen-interaction-intent.js';
import {getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {makeInteractionFixture,widthIntent} from './fixture-kitchen-interaction.mjs';

const row=doc=>doc.room.workshop.rows.R.units;
const geometry=doc=>row(doc).map(e=>[e.id,e.startMm,e.widthMm]);

test('number, grip, button and scrub give the same explicit edit at the same boundary',()=>{
 const source=makeInteractionFixture(),before=structuredClone(source),candidates=[];
 for(const inputKind of ['number','grip','button','scrub']){
  const session=createInteractionSession(source);
  assert(Object.isFrozen(session),'A caller cannot replace the session identity');
  const out=previewInteractionIntent(source,widthIntent(800,{inputKind,referenceEdge:'end'}),session);
  assert(out.ok,out.reason);assert.equal(out.status,'valid');assert.equal(out.changed,true);
  assert.equal(out.candidate,out.doc);assert.notEqual(out.doc,source);
  assert.equal(out.unitId,'target');assert.equal(out.sessionId,session.sessionId);
  assert.equal(out.baseRevision,session.baseRevision);assert.equal(typeof out.intentId,'string');assert(out.intentId.length>0);
  assert.deepEqual(geometry(out.doc),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);
  assert.deepEqual(row(out.doc).map(e=>e.locks),[
   {width:true,position:true,usage:false,finish:false},
   {width:true,position:false,usage:false,finish:true},
   {width:false,position:false,usage:false,finish:false},
   {width:true,position:true,usage:false,finish:false},
  ]);
  assert.deepEqual(out.affectedObjects.slice().sort(),['C','target']);
  assert.deepEqual(out.changedProperties.map(p=>[p.objectId,p.property,p.before,p.after]).sort(),[
   ['target','width',600,800],['target','locks.width',false,true],
   ['C','width',600,400],['C','start',1200,1400],
  ].sort());
  for(const objectId of ['A','D'])for(const property of ['width','position']){
   assert(out.protectedProperties.some(p=>p.objectId===objectId&&p.property===property),`${objectId}.${property} must be explained as protected`);
  }
  assert.deepEqual(out.constraintReasons,[]);assert.equal(out.effectsStatus,'calculated');
  assert.equal(out.catalogRevision,getFactoryCatalog(source).revision);
  assert.equal(out.catalogLayoutRevision,getFactoryCatalog(source).layoutRevision);
  assert.equal(out.measurementRevision,null);
  candidates.push(out.doc);
 }
 for(const candidate of candidates)assert.deepEqual(candidate,candidates[0]);
 assert.deepEqual(source,before,'Preview must not mutate the base or its locks');
});

test('an explicit edit can change an already pinned target without releasing its other locks',()=>{
 const source=makeInteractionFixture({targetPinned:true}),before=structuredClone(source);
 const out=previewInteractionIntent(source,widthIntent(800),createInteractionSession(source));
 assert(out.ok,out.reason);
 assert.deepEqual(geometry(out.doc),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);
 assert.deepEqual(row(out.doc)[1].locks,{width:true,position:false,usage:false,finish:true});
 assert.deepEqual(source,before);
});

test('an automatic edit remains automatic and cannot override a personal width lock',()=>{
 const source=makeInteractionFixture(),before=structuredClone(source);
 const automatic=widthIntent(800,{inputKind:'system',explicitUserChange:false});
 const out=previewInteractionIntent(source,automatic,createInteractionSession(source));
 assert(out.ok,out.reason);
 assert.deepEqual(geometry(out.doc),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);
 assert.equal(row(out.doc)[1].locks.width,false);assert.equal(row(out.doc)[1].locks.finish,true);
 const pinned=makeInteractionFixture({targetPinned:true}),pinnedBefore=structuredClone(pinned);
 const rejected=previewInteractionIntent(pinned,automatic,createInteractionSession(pinned));
 assert.equal(rejected.ok,false);assert.equal(rejected.status,'invalid');assert.equal(rejected.doc,pinned);
 assert.deepEqual(source,before);assert.deepEqual(pinned,pinnedBefore);
});

test('requesting the current width is a no-op and does not create a personal width lock',()=>{
 const source=makeInteractionFixture(),before=structuredClone(source),session=createInteractionSession(source);
 const out=previewInteractionIntent(source,widthIntent(600),session);
 assert(out.ok,out.reason);assert.equal(out.status,'unchanged');assert.equal(out.changed,false);
 assert.equal(out.doc,source);assert.equal(out.candidate,source);
 assert.equal(out.effectsStatus,'unchanged');assert.deepEqual(out.affectedObjects,[]);assert.deepEqual(out.changedProperties,[]);
 const committed=commitInteractionPreview(out,session,source);
 assert(committed.ok,committed.reason);assert.equal(committed.status,'unchanged');assert.equal(committed.changed,false);
 assert.equal(committed.doc,source);assert.deepEqual(source,before);assert.equal(row(source)[1].locks.width,false);
});

for(const [label,requestedValue,status] of [['valid',750,'valid'],['invalid',625,'invalid'],['unchanged',600,'unchanged']]){
 test(`a newer ${label} input supersedes an older valid preview`,()=>{
  const source=makeInteractionFixture(),before=structuredClone(source),session=createInteractionSession(source);
  const old=previewInteractionIntent(source,widthIntent(800),session);assert(old.ok,old.reason);
  const latest=previewInteractionIntent(source,widthIntent(requestedValue),session);
  assert.equal(latest.status,status);assert.notEqual(latest.intentId,old.intentId);
  const rejected=commitInteractionPreview(old,session,source);
  assert.equal(rejected.ok,false);assert.equal(rejected.status,'superseded');
  if(latest.ok){
   const accepted=commitInteractionPreview(latest,session,source);assert(accepted.ok,accepted.reason);
   assert.equal(row(accepted.doc)[1].widthMm,requestedValue);
  }else assert.equal(commitInteractionPreview(latest,session,source).ok,false);
  assert.deepEqual(source,before);
 });
}

test('cancellation invalidates an existing result and any later input in that session',()=>{
 const source=makeInteractionFixture(),before=structuredClone(source),session=createInteractionSession(source);
 const out=previewInteractionIntent(source,widthIntent(800),session);assert(out.ok,out.reason);
 cancelInteractionSession(session);
 const late=commitInteractionPreview(out,session,source);
 assert.equal(late.ok,false);assert.equal(late.status,'cancelled');
 const next=previewInteractionIntent(source,widthIntent(750),session);
 assert.equal(next.ok,false);assert.equal(next.status,'cancelled');
 assert.deepEqual(source,before);
});

test('a lock-only project change is stale even when its kitchen is the same object',()=>{
 const source=makeInteractionFixture(),workshop=source.room.workshop;
 const replacement={...source,room:{...source.room,workshop:{...workshop,rows:{...workshop.rows,
  R:{...workshop.rows.R,units:row(source).map(unit=>unit.id==='C'?{...unit,locks:{...unit.locks,width:true}}:unit)}
 }}}};
 const previewSession=createInteractionSession(source);
 const late=previewInteractionIntent(replacement,widthIntent(800),previewSession);
 assert.equal(late.ok,false);assert.equal(late.status,'stale');
 const commitSession=createInteractionSession(source);
 const out=previewInteractionIntent(source,widthIntent(800),commitSession);assert(out.ok,out.reason);
 const refused=commitInteractionPreview(out,commitSession,replacement);
 assert.equal(refused.ok,false);assert.equal(refused.status,'stale');
 assert.equal(replacement.kitchen,source.kitchen);assert.equal(row(replacement)[2].locks.width,true);assert.equal(row(source)[2].locks.width,false);
});

test('commit requires the current document and a completed effects preview',()=>{
 const source=makeInteractionFixture(),missingSession=createInteractionSession(source);
 const full=previewInteractionIntent(source,widthIntent(800),missingSession);assert(full.ok,full.reason);
 assert.equal(commitInteractionPreview(full,missingSession).ok,false,'An omitted current document cannot bypass revision checking');
 const session=createInteractionSession(source);
 const fast=previewInteractionIntent(source,widthIntent(800,{inputKind:'grip'}),session,{withEffects:false});
 assert(fast.ok,fast.reason);assert.equal(fast.effectsStatus,'deferred');
 assert.deepEqual(geometry(fast.doc),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);
 const deferred=commitInteractionPreview(fast,session,source);
 assert.equal(deferred.ok,false);assert.equal(deferred.status,'deferred');
 const ready=previewInteractionIntent(source,widthIntent(800,{inputKind:'grip'}),session);
 assert(ready.ok,ready.reason);assert.equal(ready.effectsStatus,'calculated');
 const committed=commitInteractionPreview(ready,session,source);assert(committed.ok,committed.reason);
 assert.equal(committed.status,'committed');assert.equal(committed.doc,ready.doc);
 assert.equal(commitInteractionPreview(ready,session,source).ok,false,'A sealed session cannot apply its transaction twice');
});

test('invalid width intents and forged metadata cannot become transactions',()=>{
 const source=makeInteractionFixture(),before=structuredClone(source);
 const cases=[
  {objectId:'missing-unit'},{property:'height'},{requestedValue:800.5},{requestedValue:Infinity},
  {referenceEdge:'middle'},{inputKind:'unknown'},{explicitUserChange:'true'},
  {sessionId:'foreign-session'},{baseRevision:'foreign-revision'},{intentId:'caller-invented-intent'},
 ];
 for(const invalid of cases){
  const session=createInteractionSession(source),out=previewInteractionIntent(source,widthIntent(800,invalid),session);
  assert.equal(out.ok,false,JSON.stringify(invalid));assert.equal(out.status,'invalid',JSON.stringify(invalid));
  assert.equal(out.doc,source);assert.equal(out.changed,false);
  assert(out.constraintReasons.length>0);assert(out.constraintReasons.every(reason=>typeof reason.code==='string'&&typeof reason.message==='string'&&reason.message.length>0));
  assert.equal(commitInteractionPreview(out,session,source).ok,false);
 }
 assert.deepEqual(source,before);
});
