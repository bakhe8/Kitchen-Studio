// Exercise the mounted controller's real draft store, regeneration guards and
// geometry. The minimal host models event dispatch, not layout or browser paint.
import assert from 'node:assert/strict';
import {mountWholePlan} from '../public/kitchen-whole-plan-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {readDraft} from '../public/kitchen-draft-store.js';
import {flushUnsavedWork,hasUnsavedWork} from '../public/kitchen-unsaved-work.js';

class Store{
 data=new Map();failed=false;
 get length(){return this.data.size;}
 key(i){return [...this.data.keys()][i]??null;}
 getItem(key){return this.data.get(key)??null;}
 setItem(key,value){if(this.failed)throw new Error('Storage quota exceeded');this.data.set(key,String(value));}
 removeItem(key){this.data.delete(key);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});
assert(generated.ok,generated.reason);
const source=structuredClone(generated.candidates[0].doc);
source.room.projectId='K-1234567890ABCDEF';
const rice=proposalUnits(source).find(u=>u.family==='rice');assert(rice);
const changedSettings={walls:['back'],sink:false,rice:false,dishwasher:false};

function mount({store=new Store(),resume=false,initial=source}={}){
 globalThis.localStorage=store;
 let live=structuredClone(initial),saves=0,controls=null;
 const events={},notices=[],node={focus(){},scrollIntoView(){},removeAttribute(){}};
 const canvas={innerHTML:'',querySelectorAll:()=>[]};
 const host={innerHTML:'',addEventListener(type,handler){events[type]=handler;},querySelector(selector){
  if(selector==='[data-wp-canvas]')return canvas;
  if(selector==='[data-plan-controls]')return controls;
  return node;
 }};
 const options={getDoc:()=>live,apply(next){live=next;saves++;return {ok:true,saved:true};},tell:message=>notices.push(message),
  onAdvance(){},onHistory(){throw new Error('A local recovery must not use saved-project history');},canHistory:()=>false,
  focus:resume?{}:{unitId:rice.id,runId:rice.runId,projectId:source.room.projectId,proposalView:'back'}};
 const dispose=mountWholePlan(host,options);
 const action=wp=>events.click({target:{closest:selector=>selector==='button'?{
  dataset:{wp},hasAttribute:()=>false
 }:null}});
 const choose=id=>events.change({target:{value:id,closest:()=>null,matches:selector=>selector==='[data-wp-unit]'}});
 function settings(value=changedSettings){
  controls={querySelectorAll:()=>value.walls.map(wall=>({value:wall})),elements:{namedItem:key=>({checked:value[key]===true})}};
  events.change({target:{name:'rice',value:'',closest:selector=>selector==='[data-plan-controls]'?controls:null,matches:()=>false}});
 }
 function width(){
  const attrs=[...canvas.innerHTML.matchAll(/<rect\b([^>]*)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));
  const rect=attrs.find(a=>a['data-sheet-unit']===rice.id&&a['data-sheet-tier']);
  assert(rect,'the real elevation retains the edited unit identity');return Number(rect.width);
 }
 return {host,store,notices,action,choose,settings,width,dispose,get live(){return live;},get saves(){return saves;}};
}

// Before the fix this exact transition returned pending=true, warns=false and
// no draft record: the old usable() check dropped work when settings changed.
const f=mount(),before=JSON.stringify(f.live),initialWidth=f.width();
assert.equal(f.live.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id).locks.width,false);
await f.action('plus');assert.equal(f.width(),initialWidth+10);
await f.action('plus');assert.equal(f.width(),initialWidth+20);
await f.action('settings');f.settings();
assert(f.dispose.hasPending(),'changed settings keep the accepted width edit pending');
assert.match(f.host.innerHTML,/تغيّرت بيانات التوزيع/);
flushUnsavedWork();
const record=readDraft('design',source.room.projectId);
assert(record,'outdated drawing still saves its valid recipe before reload');
assert.deepEqual(record.payload.pendingSettings,changedSettings);
assert.equal(record.payload.edits[0][0].part,rice.id);
assert.equal(record.payload.edits[0][0].delta,100);
assert.equal(record.payload.edits[0].length,2,'both explicit edits must survive recovery');
assert.equal(hasUnsavedWork(),false,'successful recipe persistence makes reload recoverable');
assert.equal(JSON.stringify(f.live),before,'a recovery record is not a project write');
f.dispose();

const restored=mount({store:f.store,resume:true});
assert(restored.dispose.hasPending());assert.equal(restored.width(),initialWidth+20);
assert.match(restored.host.innerHTML,/تغيّرت بيانات التوزيع/,'recovery preserves the pending choices as well as the prior geometry');
await restored.action('apply');assert.equal(restored.saves,0,'outdated choices never become an implicit project commit');
await restored.action('restore');restored.choose(rice.id);
assert.match(restored.host.innerHTML,/value="800" aria-label="عرض الوحدة/);
await restored.action('apply');assert.equal(restored.saves,1);
assert.equal(restored.live.kitchen.units.find(u=>u.id===rice.id).width,80);
assert.equal(restored.live.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id).widthMm,800);
assert.equal(restored.live.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id).locks.width,true,'the recovered explicit value retains its width pin');
assert.equal(readDraft('design',source.room.projectId),null,'explicit successful apply clears the recovery recipe');
restored.dispose();assert.equal(hasUnsavedWork(),false);
console.log('PASS two staged width edits plus changed settings survive flush/reopen, block premature save and apply CAD/recipe/pin together.');

const pinned=structuredClone(source);pinned.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id).locks.width=true;
const pinnedDraft=mount({initial:pinned});await pinnedDraft.action('plus');assert.equal(pinnedDraft.width(),initialWidth+10);
flushUnsavedWork();pinnedDraft.dispose();
const pinnedRestored=mount({store:pinnedDraft.store,resume:true,initial:pinned});
assert.equal(pinnedRestored.width(),initialWidth+10,'replay treats an already-pinned target as an explicit user edit');
assert.equal(pinnedRestored.saves,0);await pinnedRestored.action('apply');
assert.equal(pinnedRestored.live.kitchen.units.find(u=>u.id===rice.id).width,70);
assert.equal(pinnedRestored.live.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id).locks.width,true);
pinnedRestored.dispose();
console.log('PASS a width edit on an already-pinned unit restores without dropping its first operation.');

const failing=mount();await failing.action('plus');await failing.action('settings');failing.settings();failing.store.failed=true;
flushUnsavedWork();
assert(failing.dispose.hasPending());assert.equal(readDraft('design',source.room.projectId),null);
assert.equal(hasUnsavedWork(),true,'failed recovery storage warns even while the drawing is outdated');
assert.equal(failing.saves,0);assert.equal(JSON.stringify(failing.live),before);
failing.dispose();assert.equal(hasUnsavedWork(),false);
console.log('PASS storage failure preserves the live project and warns about the unapplied outdated draft.');

const choices=mount();await choices.action('settings');choices.settings();assert(choices.dispose.hasPending());flushUnsavedWork();
assert.deepEqual(readDraft('design',source.room.projectId).payload.pendingSettings,changedSettings);choices.dispose();
const choicesRestored=mount({store:choices.store,resume:true});
assert(choicesRestored.dispose.hasPending(),'settings-only changes also recover as pending work');
assert.match(choicesRestored.host.innerHTML,/تغيّرت بيانات التوزيع/);assert.equal(choicesRestored.width(),initialWidth);
await choicesRestored.action('restore');assert.equal(choicesRestored.dispose.hasPending(),false);flushUnsavedWork();
assert.equal(readDraft('design',source.room.projectId),null,'reverting the choices clears their draft without changing the project');
assert.equal(choicesRestored.saves,0);choicesRestored.dispose();
console.log('PASS settings-only recovery and explicit reversion preserve geometry and clear obsolete drafts.');
