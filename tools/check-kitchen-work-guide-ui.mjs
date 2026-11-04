import assert from 'node:assert/strict';
import {createGuideSession,guidePreview,mountWorkGuide} from '../public/kitchen-work-guide-ui.js';
const task=(id,who,step)=>({id,actor:who,step,stage:'survey',priority:1,focus:{wall:id},question:id+'<سؤال>',why:'سبب & أثر'});
const a=task('back','rep','survey'),b=task('front','customer','decisions'),later=task('order','factory','factory');
const docA={id:1},docB={id:2},done={id:3};
let doc=docA,calls=0,release;
const report=current=>({stage:'survey',tasks:[current,later],later:[later],current,complete:false});
const assess=d=>{calls++;if(d===docA)return new Promise(r=>release=r);if(d===done)return {stage:'complete',current:null,tasks:[],later:[],complete:true};return report(b);};
const queue=createGuideSession(()=>doc,async()=>({kitchenWorkGuide:assess,guideQuickAnswers:()=>[{id:'accept',label:'اختيار محفوظ'}],answerGuideQuestion:(d,t,c)=>({ok:d===docB&&t===b&&c==='accept',doc:done})}));
let p=queue.refresh();await new Promise(r=>setTimeout(r,0));doc=docB;await queue.refresh();release(report(a));await p;
assert.equal(queue.read().report.current,b,'a slow previous project cannot replace the live prompt');assert(!queue.contains(a));
assert.equal(guidePreview(queue.read()).label,'رفع الموقع · العميل');await queue.refresh();assert.equal(calls,2);
class Host{
 constructor(){this.listeners={};this.isConnected=true;}
 contains(){return true;}addEventListener(k,fn){this.listeners[k]=fn;}removeEventListener(k){delete this.listeners[k];}
 click(key,value=''){const button={dataset:{guideAnswer:value,guideOther:value},hasAttribute:k=>k===key};return this.listeners.click({target:{closest:()=>button}});}
}
const h=new Host(),nav=[],applied=[];
const dispose=mountWorkGuide(h,{guide:queue,getDoc:()=>doc,apply:d=>{applied.push(d);doc=d;return {ok:true,saved:true}},onAdvance:(...v)=>nav.push(v)});
assert(h.innerHTML.includes('front&lt;سؤال&gt;'));assert(h.innerHTML.includes('سبب &amp; أثر'));assert(h.innerHTML.includes('<details class="pg-rest">'));
assert.equal(h.innerHTML.split('order&lt;سؤال&gt;').length-1,1);
const deskHost=new Host();
deskHost.ownerDocument={defaultView:{matchMedia:()=>({matches:true})}};
const stopDesktopGuide=mountWorkGuide(deskHost,{guide:queue,getDoc:()=>doc});
assert.match(deskHost.innerHTML,/<details class="pg-rest" open>/,'wide workspaces expose the next steps beside the current question');
deskHost.listeners.toggle({target:{classList:{contains:()=>true},open:false}});
await queue.refresh(true);
assert.match(deskHost.innerHTML,/<details class="pg-rest">/,'refresh preserves an explicit fold');
stopDesktopGuide();
await h.click('data-guide-open');assert.deepEqual(nav[0],['decisions',{wall:'front'}]);
await h.click('data-guide-answer','accept');await queue.refresh();assert.deepEqual(applied,[done]);
assert(h.innerHTML.includes('اكتمل اعتماد التصميم للورشة'));await h.click('data-guide-tracking');assert.deepEqual(nav.at(-1),['tracking',{fromGuide:true}]);
dispose();assert.deepEqual(h.listeners,{});
let ok=false;const retry=createGuideSession(()=>doc,async()=>({kitchenWorkGuide(){if(!ok)throw Error();return report(b);}}));
await retry.refresh();assert.equal(retry.read().status,'error');ok=true;await retry.refresh(true);assert.equal(retry.read().status,'ready');
console.log('One RTL guide question, role, escaped data, collapsed later tasks, ordinary entity-specific source routes, validated direct answer/refresh, race cancellation and retry verified.');

// Mount the normal workshop router, including its draft guard and bridge to
// the independent field-register overlay. No fake route is added for the test.
const {mountWorkshop}=await import('../public/kitchen-workshop-ui.js');
const {makeChainExample}=await import('../public/kitchen-chain-model.js');
class Part {
 constructor(){this.nodes=new Map();this.listeners={};this.dataset={};this.hidden=false;this.isConnected=true;this.innerHTML='';this.attributes=new Map();}
 querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new Part());return this.nodes.get(k);}
 setAttribute(k,v){this.attributes.set(k,String(v));}removeAttribute(k){this.attributes.delete(k);}
 addEventListener(k,v){(this.listeners[k]||=[]).push(v);}
 removeEventListener(k,v){this.listeners[k]=this.listeners[k]?.filter(f=>f!==v);}
 fire(k,e){for(const fn of this.listeners[k]||[])fn(e);}focus(){}contains(){return true;}replaceChildren(){this.child=null;}
 append(v){this.child=v;}remove(){this.isConnected=false;}getClientRects(){return [1];}
}
globalThis.document={createElement:()=>new Part(),activeElement:null};
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){}})};
const root=new Part(),external=[];let drawing=makeChainExample();
const controller=mountWorkshop(root,{getDoc:()=>drawing,apply:()=>({ok:false}),tell(){},closeOthers(){},opener:new Part(),onExternalStep:(...v)=>external.push(v)});
controller.open('guide');const shell=root.child,body=shell.querySelector('.ws-content');
assert.equal(shell.dataset.wsRoute,'guide');
controller.open('finish');assert.equal(shell.dataset.wsRoute,'finish');
const dirty={matches:()=>true,closest:s=>s==='form'};
body.fire('input',{target:dirty});
const clickShell=selector=>shell.fire('click',{target:{closest:s=>s===selector}});
clickShell('[data-ws-back]');assert.equal(shell.dataset.wsRoute,'finish','Back must wait for a pending field');
assert.match(shell.querySelector('.ws-notice').innerHTML,/data-guide-stay/);
clickShell('[data-guide-stay]');assert.equal(shell.dataset.wsRoute,'finish');
controller.open('guide');assert.equal(shell.dataset.wsRoute,'finish');
clickShell('[data-guide-discard]');assert.equal(shell.dataset.wsRoute,'guide');
controller.open('defaults',{material:'carrara'});assert.deepEqual(external,[['defaults',{material:'carrara'}]]);
assert.equal(controller.active(),false);controller.open('guide');assert.equal(controller.active(),true);
await controller.refreshGuide();assert.match(body.child.innerHTML,/المطلوب الآن/);
const guideShortcut=shell.querySelector('[data-ws-guide]');
const shortcutLabel=guideShortcut.querySelector('[data-guide-label]'),shortcutQuestion=guideShortcut.querySelector('[data-guide-question]');
assert.equal(shortcutLabel.textContent,'دليل المشروع');
assert.equal(shortcutQuestion.textContent,'');
console.log('Mounted workshop: normal guide entry, unsaved form guard via header and back, external defaults and return to a live project guide verified.');
controller.open('finish');body.fire('input',{target:dirty});
controller.open('approve');assert.equal(shell.dataset.wsRoute,'finish','ordinary route must protect a dirty form too');
clickShell('[data-guide-stay]');controller.close(true);assert.equal(controller.active(),true,'close must protect a dirty form');
clickShell('[data-guide-discard]');assert.equal(controller.active(),false);
controller.open('finish');body.fire('input',{target:dirty});
const pendingForm=body.child;drawing={...drawing,room:{...drawing.room,name:'نسخة أحدث'}};
controller.refresh();assert.equal(body.child,pendingForm,'refresh must keep the current form until reviewed');
clickShell('[data-guide-discard]');assert.notEqual(body.child,pendingForm);

// A measurement or a scoped editing task opens in its editor. Questions with
// quick answers must keep those choices, and drafts retain their normal guard.
controller.close(false);
drawing=makeChainExample();
await controller.refreshGuide();
controller.open('finish');
body.fire('input',{target:dirty});
clickShell('[data-ws-guide]');
assert.equal(shell.dataset.wsRoute,'finish','the shortcut must not discard an edited field');
assert.match(shell.querySelector('.ws-notice').innerHTML,/data-guide-discard/);
clickShell('[data-guide-discard]');
assert.equal(shell.dataset.wsRoute,'decisions','go straight to the outstanding wall selection');
await import('../public/kitchen-project-decisions-ui.js');
await new Promise(resolve=>setImmediate(resolve));
assert.match(body.child.innerHTML,/sv-scope-form/,'pass the guide task’s chooseWalls focus to the editor');
assert(shell.querySelector('.ws-notice').textContent.includes('على أي جدران'),'show why this editor was opened');
clickShell('[data-ws-back]');
assert.equal(shell.dataset.wsRoute,'finish','return directly to the originating step');
clickShell('[data-ws-guide]');
assert.equal(shell.dataset.wsRoute,'decisions');
clickShell('[data-ws-guide]');
assert.equal(shell.dataset.wsRoute,'guide','when already at the requested field, explain the current task');

const {updateDecisionReview}=await import('../public/kitchen-project-decisions.js');
controller.close(false);controller.open('finish');body.fire('input',{target:dirty});
clickShell('[data-ws-guide]');assert.equal(shell.dataset.wsRoute,'finish');
drawing=updateDecisionReview(drawing,{active:true,walls:['back']}).doc;
await controller.refreshGuide();clickShell('[data-guide-discard]');
assert.equal(shell.dataset.wsRoute,'guide','recheck the task after the draft guard and keep newly available quick answers');
assert.match(body.child.innerHTML,/data-guide-answer=/);
controller.close(false);
const waiting=mountWorkshop(root,{getDoc:()=>drawing,apply(){throw Error('shortcut may not write project data');},tell(){},closeOthers(){},opener:new Part()});
waiting.open('finish');
const waitingPanel=root.child;
waitingPanel.fire('click',{target:{closest:selector=>selector==='[data-ws-guide]'}});
assert.equal(waitingPanel.dataset.wsRoute,'guide','before guide data is ready enter the guide without guessing');
waiting.close(false);
console.log('Task shortcut routes to the exact field, guards edits, preserves history, quick answers and loading fallback.');


// The villa preset has a physical hood behind 2740 mm, separate from its vent.
const {makeFurnishedSaudiRoom}=await import('../public/kitchen-room-presets.js');
const {applyChain,chainFromDrawing}=await import('../public/kitchen-chain-model.js');
const {approvalState,releaseConcernGroups}=await import('../public/kitchen-workshop-state.js');
const {kitchenWorkGuide}=await import('../public/kitchen-work-guide.js');
const villa=makeFurnishedSaudiRoom('villa'),hood=villa.kitchen.units.find(u=>u.kind==='hood');
const relocated={...villa,kitchen:{...villa.kitchen,features:villa.kitchen.features.map(f=>
 f.kind==='window'&&f.wall==='back'?{...f,u:274}:f)}};
const measuredVilla={...chainFromDrawing(relocated,'back'),source:'field'};
const unfinished=applyChain(villa,'back',measuredVilla);
assert(unfinished.ok);
const incompleteGuide=await kitchenWorkGuide(unfinished.doc);
assert(![...incompleteGuide.tasks,...incompleteGuide.later].some(t=>t.step==='placement'),
 'the original pre-furnished sample should prompt for its survey before resolving its sample hood placement');
const surveyed=applyChain(villa,'back',{...measuredVilla,rows:[...measuredVilla.rows,{kind:'stop',id:'end',gapMm:4400,from:'origin'}]});
assert(surveyed.ok,surveyed.reason);drawing=surveyed.doc;
const approval=await approvalState(drawing),report56=await kitchenWorkGuide(drawing,{approval});
assert.equal(approval.designReview.unitId,hood.id);
assert(releaseConcernGroups(drawing,approval).some(g=>g.origin==='collision'));
assert(!releaseConcernGroups(drawing,approval,{unitIds:[],runIds:[],walls:[]}).some(g=>g.origin==='collision'));
const designTasks=[...report56.tasks,...report56.later];
assert(designTasks.some(t=>t.step==='placement'&&t.focus.unitId===hood.id));
assert(!designTasks.some(t=>t.id==='design.structure'||t.id==='production:customer'));

let writes=0;const targeted=[];
const reviewer=mountWorkshop(root,{getDoc:()=>drawing,apply(){writes++;},tell(){},closeOthers(){},onExternalStep:(...v)=>targeted.push(v)});
reviewer.open('approve');
const checkBody=root.child.querySelector('.ws-content');
const buttonPattern=kind=>new RegExp('data-ws-action="'+kind+'" disabled');
async function readyAction(key){for(let i=0;i<200&&!checkBody.child.innerHTML.includes('data-ws-action="'+key+'"');i++)await new Promise(r=>setTimeout(r,2));}
const fireAction=async key=>{for(const listener of checkBody.listeners.click||[])await listener({target:{closest:k=>k==='[data-ws-action]'?{dataset:{wsAction:key}}:null}});};
await readyAction('structure');assert.match(checkBody.child.innerHTML,buttonPattern('structure'));assert(checkBody.child.innerHTML.includes(approval.designReview.reason));
await fireAction('structure');assert.equal(writes,0);
reviewer.open('sign');await readyAction('customer');assert.match(checkBody.child.innerHTML,buttonPattern('customer'));
await fireAction('customer');assert.equal(writes,0);
await fireAction('review-placement');assert.deepEqual(targeted,[['placement',{unitId:hood.id}]]);assert(!reviewer.active());
const restored=applyChain(drawing,'back',{...chainFromDrawing(villa,'back'),source:'field'});
assert(restored.ok,restored.reason);assert.equal((await approvalState(restored.doc)).designReview,null);
console.log('Villa survey with measured window at 2740 mm remains authoritative; hood flags both signoffs, factory release and its targeted CAD correction.');
