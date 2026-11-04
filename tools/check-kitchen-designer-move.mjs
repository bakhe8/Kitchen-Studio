import assert from 'node:assert/strict';
import * as change from '../public/kitchen-proposal-change.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {applyChain} from '../public/kitchen-chain-model.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {newSurveyProject,saveProject,openKitchenProject,storedKitchenProject,commitProject,undoProject,redoProject,kitchenHistory} from '../public/kitchen-project.js';

assert.equal(typeof change.previewKitchenUnitMove,'function','Designer moves need the full-document factory transaction.');
assert.equal(typeof change.factoryPositionEditable,'function','The UI needs a position eligibility predicate.');
const {previewKitchenUnitMove:move,factoryPositionEditable:editable}=change;
class Store {
  values=new Map();
  get length(){return this.values.size;}
  key(index){return [...this.values.keys()][index]??null;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const good=out=>{assert.equal(out.ok,true,out.reason);return out;};
const visit=makeVisitExample(),generated=good(await proposeWholeKitchen(visit,{walls:['back']})),doc=generated.candidates[0].doc;
const run=doc.kitchen.runs.find(item=>item.tier==='base'&&item.wall==='back');
const rowOf=(value,id=run.id)=>value.room.workshop.rows[id];
const unit=(value,id)=>value.kitchen.units.find(item=>item.id===id);
const entry=(value,id)=>Object.values(value.room.workshop.rows).flatMap(row=>row.units).find(item=>item.id===id);
const ordered=(value,id=run.id)=>rowOf(value,id).units.slice().sort((a,b)=>a.startMm-b.startMm);
const [rice,storage,washer,sink]=ordered(doc);
let blank=newSurveyProject({widthMm:4200,lengthMm:3600,heightMm:2800,name:'ترتيب الوحدات'},localStorage);
blank=good(applyChain(blank,'back',{source:'drawing',rows:[{id:'end',kind:'corner',from:'origin',gapMm:4200}]})).doc;
const filled=good(await proposeWholeKitchen(blank,{walls:['back'],wanted:{sink:false},limit:6})).candidates[0].doc;
const fillRun=filled.kitchen.runs.find(item=>item.wall==='back'&&item.tier==='base');
const fillEntries=ordered(filled,fillRun.id);
assert.ok(fillEntries.length>=4,'a generated storage row supplies a real multi-peer insertion');
const original=JSON.stringify(doc);
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name);}
function rejected(value,source,target,pattern){
  const before=JSON.stringify(value),out=move(value,source,target);
  assert.equal(out.ok,false);
  assert.strictEqual(out.doc,value,'rejection returns the original project');
  assert.ok(out.reason);
  if(pattern)assert.match(out.reason,pattern);
  assert.equal(JSON.stringify(value),before,'rejection never mutates a project');
}
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

await check('position eligibility protects stations and appliance hosts while permitting width locks',()=>{
  assert.equal(editable(doc,unit(doc,rice.id),rice),true);
  assert.equal(editable(doc,unit(doc,washer.id),washer),false);
  assert.equal(editable(doc,unit(doc,sink.id),sink),false);
  assert.equal(editable(doc,unit(doc,rice.id),{...rice,locks:{...rice.locks,width:true}}),true);
  assert.equal(editable(doc,unit(doc,rice.id),{...rice,locks:{...rice.locks,position:true}}),false);
  assert.equal(editable(doc,null,rice),false);
  assert.equal(editable(doc,unit(doc,rice.id),null),false);
});

await check('moving a real generated unit reorders both CAD and factory recipe with fixed identities and widths',()=>{
  const out=good(move(doc,rice.id,storage.id));
  assert.deepEqual(ordered(out.doc).map(item=>item.id),[storage.id,rice.id,washer.id,sink.id]);
  assert.equal(entry(out.doc,storage.id).startMm,1300);
  assert.equal(entry(out.doc,rice.id).startMm,2200);
  for(const prior of rowOf(doc).units){
    const next=entry(out.doc,prior.id),cad=unit(out.doc,prior.id);
    assert.equal(next.widthMm,prior.widthMm);
    assert.equal(cad.width*10,next.widthMm);assert.equal(cad.u*10,next.startMm);
    assert.equal(cad.runId,run.id);
  }
  assert.deepEqual(unit(out.doc,washer.id),unit(doc,washer.id));
  assert.deepEqual(unit(out.doc,sink.id),unit(doc,sink.id));
  assert.deepEqual(out.doc.kitchen.units.map(item=>item.id),doc.kitchen.units.map(item=>item.id),'document order and output numbering are stable');
  assert.deepEqual(out.doc.kitchen.features,doc.kitchen.features);
  assert.deepEqual(out.doc.room.workshop.chains,doc.room.workshop.chains);
  assert.deepEqual(out.doc.room.workshop.applianceFit,doc.room.workshop.applianceFit);
  assert.deepEqual(out.donors,[]);
  assert.equal(out.unitId,rice.id);
  assert.ok(out.changes.every(item=>item.deltaWidthMm===0));
  assert.deepEqual(out.changes.map(item=>[item.unitId,item.deltaStartMm]),[[rice.id,900],[storage.id,-600]]);
  assert.equal(out.price.deltaSar,0);
  assert.deepEqual(new Set(out.protectedUnits.map(item=>item.unitId)),new Set([washer.id,sink.id]));
  assert.equal(JSON.stringify(doc),original);
});

await check('insertion uses the peer original sorted index and shifts the whole crossed interval',()=>{
  const ids=fillEntries.map(item=>item.id),[a,b,c,d]=ids;
  const forward=good(move(filled,a,c));
  assert.deepEqual(ordered(forward.doc,fillRun.id).map(item=>item.id),[b,c,a,d,...ids.slice(4)]);
  const back=good(move(forward.doc,a,b));
  assert.deepEqual(back.doc.kitchen.units,filled.kitchen.units);
  assert.deepEqual(back.doc.room.workshop.rows,filled.room.workshop.rows);
  const reverse=good(move(filled,d,b));
  assert.deepEqual(ordered(reverse.doc,fillRun.id).map(item=>item.id),[a,d,b,c,...ids.slice(4)]);
  const before=ordered(filled,fillRun.id),after=ordered(reverse.doc,fillRun.id);
  assert.equal(after[0].startMm,before[0].startMm);
  assert.equal(after.at(-1).startMm+after.at(-1).widthMm,before.at(-1).startMm+before.at(-1).widthMm);
});

await check('no move can cross a locked station, anchored device or explicit gap',()=>{
  const [a,b,c]=fillEntries;
  for(const target of [a.id,b.id,c.id]){
    const locked=structuredClone(filled);entry(locked,target).locks.position=true;
    rejected(locked,a.id,c.id,/مثبّت|محجوز/);
  }
  const widthLocked=structuredClone(filled);entry(widthLocked,b.id).locks.width=true;
  good(move(widthLocked,a.id,c.id));
  rejected(doc,rice.id,washer.id,/محجوز|جهاز|مجلى/);
  rejected(doc,sink.id,storage.id,/محجوز|جهاز|مجلى/);
  const gap=structuredClone(doc);
  entry(gap,storage.id).startMm+=100;entry(gap,storage.id).widthMm-=100;
  unit(gap,storage.id).u+=10;unit(gap,storage.id).width-=10;
  rejected(gap,rice.id,storage.id,/فراغ|متصل/);
});

await check('missing identities, foreign rows and unmatched CAD recipe are refused without guessing',()=>{
  rejected(doc,rice.id,rice.id);
  rejected(doc,'missing',storage.id);
  rejected(doc,rice.id,'missing');
  const upper=doc.kitchen.units.find(item=>item.runId!==run.id);
  assert.ok(upper);rejected(doc,rice.id,upper.id,/صف/);
  const noRow=structuredClone(doc);delete noRow.room.workshop.rows[run.id];
  rejected(noRow,rice.id,storage.id,/صف/);
  const wrongCAD=structuredClone(doc);unit(wrongCAD,storage.id).u+=1;
  rejected(wrongCAD,rice.id,storage.id,/مطابقة|وصفة/);
  const wrongKind=structuredClone(doc);unit(wrongKind,storage.id).kind='drawers';
  rejected(wrongKind,rice.id,storage.id,/مطابقة|وصفة/);
  const missingCAD=structuredClone(doc);missingCAD.kitchen.units=missingCAD.kitchen.units.filter(item=>item.id!==storage.id);
  rejected(missingCAD,rice.id,washer.id,/مطابقة|وصفة/);
});

await check('stale factory revisions and measured design boundaries gate relocation',()=>{
  const stale=structuredClone(doc);rowOf(stale).catalogVersion='outdated';
  rejected(stale,rice.id,storage.id,/المصنع|الصف/);
  const unmeasured=structuredClone(doc);delete unmeasured.room.workshop.chains.back;
  rejected(unmeasured,rice.id,storage.id,/رفع/);
  const shortened=structuredClone(doc),stop=shortened.room.workshop.chains.back.rows.find(item=>item.kind==='stop');
  assert.ok(stop);stop.gapMm=4000;
  Object.assign(shortened.room.workshop.chains.back.rows.find(item=>item.kind==='corner'),{from:'origin',gapMm:5000});
  rejected(shortened,rice.id,storage.id,/نهايتها|امتداد/);
  const staleOpening=structuredClone(doc);staleOpening.kitchen.features.find(item=>item.kind==='window').u+=1;
  rejected(staleOpening,rice.id,storage.id,/رفع/);
});

await check('a newly measured low opening and option envelope cannot be crossed by relocation',()=>{
  const chain=structuredClone(doc.room.workshop.chains.back);
  chain.rows.find(item=>item.kind==='window').bottomMm=600;
  const measured=good(applyChain(doc,'back',chain));
  assert.ok(measured.designConflicts.length,'real site correction can expose a conflict in the existing design');
  rejected(measured.doc,rice.id,storage.id,/فتحة|شباك|نافذة|يصطدم/);
  const curtain=structuredClone(doc),window=curtain.kitchen.features.find(item=>item.kind==='window'&&item.wall==='back');
  Object.assign(curtain.room.workshop.options.back.curtains[window.id],{state:'existing',dropMm:2400,projectionMm:300});
  rejected(curtain,rice.id,storage.id,/يصطدم|يتداخل|يعوق/);
});

await check('fast preview and full effects produce identical pure geometry',()=>{
  const frozen=freeze(structuredClone(doc)),before=JSON.stringify(frozen);
  const fast=good(move(frozen,rice.id,storage.id,{withEffects:false}));
  const full=good(move(frozen,rice.id,storage.id));
  assert.deepEqual(fast.doc,full.doc);
  assert.equal(Object.hasOwn(fast,'price'),false,'pointer preview avoids repeated whole-project pricing');
  assert.equal(fast.unitId,rice.id);
  assert.equal(JSON.stringify(frozen),before);
  assert.equal(kitchenGeometry(full.doc.kitchen,full.doc.room).hardConflicts.length,0);
  assert.equal(getFactoryCatalog(full.doc).layoutRevision,getFactoryCatalog(frozen).layoutRevision);
});

await check('real save, reopen, undo and redo keep CAD and recipe together in one history entry',()=>{
  assert.equal(saveProject(filled),true);
  const live=openKitchenProject(),prior=JSON.stringify(live),members=ordered(live,fillRun.id),before=kitchenHistory().length;
  const out=good(move(live,members[0].id,members[2].id));
  assert.equal(JSON.stringify(live),prior);
  const committed=commitProject(live,out.doc);assert.equal(committed.ok,true,committed.reason);assert.equal(committed.saved,true);
  assert.equal(kitchenHistory().length,before+1);
  const reopened=storedKitchenProject();
  for(const record of rowOf(reopened,fillRun.id).units){assert.equal(unit(reopened,record.id).u*10,record.startMm);assert.equal(unit(reopened,record.id).width*10,record.widthMm);}
  assert.deepEqual(reopened.kitchen.units,out.doc.kitchen.units);
  const undo=undoProject(reopened);assert.equal(undo?.saved,true);assert.equal(JSON.stringify(undo.next),prior);
  const redo=redoProject(undo.next);assert.equal(redo?.saved,true);assert.deepEqual(redo.next,reopened);
});

await check('storage failure and a stale second tab cannot replace the saved unit ordering',async()=>{
  let live=openKitchenProject(),members=ordered(live,fillRun.id);
  const out=good(move(live,members[0].id,members[2].id));
  const before=localStorage.getItem('atlas-kitchen:project:v1'),past=JSON.stringify(kitchenHistory()),set=localStorage.setItem;
  localStorage.setItem=function(key,value){if(key==='atlas-kitchen:project:v1')throw Error('quota');return set.call(this,key,value);};
  try{
    const refused=commitProject(live,out.doc);
    assert.equal(refused.ok,false);assert.equal(refused.saved,false);
    assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),before);
    assert.equal(JSON.stringify(kitchenHistory()),past);
  }finally{localStorage.setItem=set;}
  const second=await import('../public/kitchen-project.js?designer-move=second-tab'),old=second.openKitchenProject();
  const committed=commitProject(live,out.doc);assert.equal(committed.saved,true,committed.reason);live=committed.next;
  members=ordered(old,fillRun.id);
  const stale=good(move(old,members[1].id,members[3].id));
  const current=localStorage.getItem('atlas-kitchen:project:v1'),history=JSON.stringify(kitchenHistory());
  const refused=second.commitProject(old,stale.doc);
  assert.equal(refused.code,'stale-project');assert.equal(refused.saved,false);
  assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),current);
  assert.equal(JSON.stringify(kitchenHistory()),history);
  assert.deepEqual(storedKitchenProject().kitchen.units,live.kitchen.units);
});

console.log(`Kitchen designer moves: ${count} transaction groups passed.`);
