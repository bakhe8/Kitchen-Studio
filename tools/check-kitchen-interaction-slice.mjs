import assert from 'node:assert/strict';
import test from 'node:test';
import {createInteractionSession,previewInteractionIntent,commitInteractionPreview,cancelInteractionSession} from '../public/kitchen-interaction-intent.js';
import {saveProject,openKitchenProject,restoreProject,commitProject,undoProject,redoProject,kitchenHistory,kitchenFuture} from '../public/kitchen-project.js';
import {makeInteractionFixture,widthIntent} from './fixture-kitchen-interaction.mjs';

class MemoryStorage{
 #data=new Map();writes=[];
 get length(){return this.#data.size;}
 key(index){return [...this.#data.keys()][index]??null;}
 getItem(key){return this.#data.get(key)??null;}
 setItem(key,value){this.#data.set(key,String(value));this.writes.push(key);}
 removeItem(key){this.#data.delete(key);}
 clear(){this.#data.clear();}
}
const projectKey='atlas-kitchen:project:v1';
const row=doc=>doc.room.workshop.rows.R.units;
const geometry=doc=>row(doc).map(e=>[e.id,e.startMm,e.widthMm]);
function assertCadMatchesRecipe(doc){
 for(const entry of row(doc)){
  const unit=doc.kitchen.units.find(u=>u.id===entry.id);assert(unit);
  assert.equal(unit.runId,'R');assert.equal(unit.u*10,entry.startMm);assert.equal(unit.width*10,entry.widthMm);
 }
}

test('2400 mm journey saves once and undo/redo restore geometry and property locks atomically',()=>{
 globalThis.localStorage=new MemoryStorage();globalThis.sessionStorage=new MemoryStorage();
 assert(saveProject(makeInteractionFixture()));
 const source=openKitchenProject(),before=structuredClone(source);
 const savedText=localStorage.getItem(projectKey),initialWrites=localStorage.writes.filter(key=>key===projectKey).length;
 assert.deepEqual(geometry(source),[['A',0,600],['target',600,600],['C',1200,600],['D',1800,600]]);
 assert.equal(row(source)[1].locks.width,false);assert.equal(kitchenHistory().length,0);

 const session=createInteractionSession(source),preview=previewInteractionIntent(source,widthIntent(800),session);
 assert(preview.ok,preview.reason);
 assert.deepEqual(geometry(preview.doc),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);
 assertCadMatchesRecipe(preview.doc);
 assert.deepEqual(preview.affectedObjects.slice().sort(),['C','target']);
 assert.deepEqual(preview.donors.map(d=>[d.unitId,d.amountMm]),[['C',200]]);
 assert.deepEqual(row(preview.doc)[1].locks,{width:true,position:false,usage:false,finish:true});
 assert.equal(row(preview.doc)[2].locks.width,false);
 assert.deepEqual(source,before);assert.equal(localStorage.getItem(projectKey),savedText);
 assert.equal(kitchenHistory().length,0);

 const accepted=commitInteractionPreview(preview,session,source);assert(accepted.ok,accepted.reason);
 assert.equal(localStorage.getItem(projectKey),savedText,'Accepting an interaction does not save the project');
 const saved=commitProject(source,accepted.doc);assert(saved.ok,saved.reason);assert.equal(saved.changed,true);assert.equal(saved.saved,true);
 const current=saved.next;
 assert.equal(kitchenHistory().length,1);assert.equal(kitchenFuture().length,0);
 assert.equal(localStorage.writes.filter(key=>key===projectKey).length,initialWrites+1);
 const reopened=restoreProject();assertCadMatchesRecipe(reopened);
 assert.deepEqual(reopened.kitchen.units,current.kitchen.units);
 assert.deepEqual(reopened.room.workshop.rows,current.room.workshop.rows);

 const undone=undoProject(current);assert(undone?.saved);
 assert.deepEqual(undone.next.kitchen,source.kitchen);
 assert.deepEqual(undone.next.room.workshop.rows,source.room.workshop.rows);
 assert.equal(row(undone.next)[1].locks.width,false);assert.equal(row(undone.next)[2].widthMm,600);
 assertCadMatchesRecipe(undone.next);assert.equal(kitchenHistory().length,0);assert.equal(kitchenFuture().length,1);

 // Returning an input to its starting value must neither add a step nor erase
 // the transaction that the user can still redo.
 const noOpSession=createInteractionSession(undone.next);
 const noOp=previewInteractionIntent(undone.next,widthIntent(600),noOpSession);
 assert.equal(noOp.status,'unchanged');
 const acceptedNoOp=commitInteractionPreview(noOp,noOpSession,undone.next);assert(acceptedNoOp.ok,acceptedNoOp.reason);
 const textBeforeNoOp=localStorage.getItem(projectKey),writesBeforeNoOp=localStorage.writes.length;
 const unchanged=commitProject(undone.next,acceptedNoOp.doc);assert(unchanged.ok,unchanged.reason);assert.equal(unchanged.changed,false);
 assert.equal(localStorage.getItem(projectKey),textBeforeNoOp);assert.equal(localStorage.writes.length,writesBeforeNoOp);
 assert.equal(kitchenHistory().length,0);assert.equal(kitchenFuture().length,1);

 const redone=redoProject(undone.next);assert(redone?.saved);
 assert.deepEqual(redone.next.kitchen,current.kitchen);
 assert.deepEqual(redone.next.room.workshop.rows,current.room.workshop.rows);
 assert.equal(row(redone.next)[1].locks.width,true);assertCadMatchesRecipe(redone.next);
 assert.equal(kitchenHistory().length,1);assert.equal(kitchenFuture().length,0);
 assert.deepEqual(restoreProject().room.workshop.rows,current.room.workshop.rows);
});

test('a 900 mm conflict after pinning the other widths leaves the 800 mm candidate intact',()=>{
 const source=makeInteractionFixture(),session=createInteractionSession(source);
 const preview=previewInteractionIntent(source,widthIntent(800),session);assert(preview.ok,preview.reason);
 const candidate=preview.doc,candidateBefore=structuredClone(candidate);
 // The default storage minimum is 200 mm. The 400 mm donor is deliberately
 // pinned here: without that constraint, 900/300 would still be feasible.
 const constrained=structuredClone(candidate);row(constrained).find(e=>e.id==='C').locks.width=true;
 const constrainedBefore=structuredClone(constrained),blockedSession=createInteractionSession(constrained);
 const blocked=previewInteractionIntent(constrained,widthIntent(900),blockedSession);
 assert.equal(blocked.ok,false);assert.equal(blocked.status,'invalid');assert.equal(blocked.changed,false);
 assert.equal(blocked.doc,constrained);assert.match(blocked.reason,/100/);
 assert(blocked.constraintReasons.some(reason=>/100/.test(reason.message)));
 assert.equal(commitInteractionPreview(blocked,blockedSession,constrained).ok,false);
 assert.deepEqual(constrained,constrainedBefore);assert.deepEqual(candidate,candidateBefore);
 assert.deepEqual(geometry(candidate),[['A',0,600],['target',600,800],['C',1400,400],['D',1800,600]]);

 const cancelSession=createInteractionSession(candidate),next=previewInteractionIntent(candidate,widthIntent(850),cancelSession);
 assert(next.ok,next.reason);cancelInteractionSession(cancelSession);
 const cancelled=commitInteractionPreview(next,cancelSession,candidate);
 assert.equal(cancelled.ok,false);assert.equal(cancelled.status,'cancelled');
 assert.deepEqual(candidate,candidateBefore,'Cancelling a later edit retains the previous candidate, including its width lock');
});
