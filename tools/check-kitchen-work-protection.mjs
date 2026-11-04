import assert from 'node:assert/strict';
// Work protection: unsaved-work probes and the leave warning, drafts kept across reloads, and the saved-projects library
// (a project is put aside before anything replaces it, and a project that cannot be put aside is never replaced).
class Store{
 constructor(){this.mem=new Map;this.quota=Infinity;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){
  v=String(v);const used=[...this.mem].reduce((n,[key,val])=>n+(key===k?0:key.length+val.length),0);
  if(used+k.length+v.length>this.quota)throw new Error('quota');
  this.mem.set(k,v);
 }
 removeItem(k){this.mem.delete(k);}
}
const store=globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
globalThis.location={href:'http://studio.test/index.html?panel=workshop&step=survey#x'};
const work=await import('../public/kitchen-unsaved-work.js');
const drafts=await import('../public/kitchen-draft-store.js');
const library=await import('../public/kitchen-project-library.js');
const project=await import('../public/kitchen-project.js');
const flows=await import('../public/kitchen-project-switch.js');

// ---------- unsaved-work probes and the leave warning ----------
assert.equal(work.hasUnsavedWork(),false,'nothing registered, nothing unsaved');
let dirty=false,flushed=0;const off=work.registerUnsavedWork({atRisk:()=>dirty,flush:()=>{flushed++;}});
assert.equal(work.hasUnsavedWork(),false);dirty=true;assert.equal(work.hasUnsavedWork(),true);
const offBroken=work.registerUnsavedWork({atRisk:()=>{throw new Error('broken');},flush:()=>{throw new Error('broken');}});dirty=false;
assert.equal(work.hasUnsavedWork(),false,'a probe that throws never traps the user');work.flushUnsavedWork();assert.equal(flushed,1,'a flush that throws does not stop the others');offBroken();
assert.equal(work.registerUnsavedWork({atRisk:'not a function'})(),undefined,'a non-function probe is ignored');
// a plain stand-in for the window: the browser's own beforeunload event has a string returnValue that Node's Event does not model
const target={listeners:new Map,addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}};
const offWarn=work.warnBeforeLeaving(target);
const leave=()=>{const e={prevented:false,returnValue:undefined,preventDefault(){this.prevented=true;}};target.listeners.get('beforeunload')?.(e);return e;};
let e=leave();assert.equal(e.prevented,false,'clean page: no warning');assert.equal(flushed,2,'leaving flushes drafts to storage first');
dirty=true;e=leave();assert.equal(e.prevented,true,'unsaved work: the browser is asked to confirm');assert.equal(e.returnValue,work.leaveWarning);
off();e=leave();assert.equal(e.prevented,false,'a probe removed when its screen closes stops counting');
dirty=true;offWarn();assert.equal(target.listeners.has('beforeunload'),false,'the warning can be switched off');
assert.equal(work.warnBeforeLeaving({}) instanceof Function,true,'a target without events is tolerated');

// ---------- drafts ----------
const A='K-0123456789ABCDEF',B='K-FEDCBA9876543210';
assert.equal(drafts.writeDraft('survey',A,{walls:{back:{rows:[1]}}},store),true);
assert.deepEqual(drafts.readDraft('survey',A,store).payload,{walls:{back:{rows:[1]}}});
assert.equal(drafts.readDraft('survey',B,store),null,'another project has no draft');
assert.equal(drafts.readDraft('design',A,store),null,'another kind of work has no draft');
assert.equal(drafts.writeDraft('survey','not-an-id',{},store),false);assert.equal(drafts.writeDraft('Bad Kind',A,{},store),false);
assert.equal(drafts.writeDraft('survey',A,{big:'x'.repeat(700000)},store),false,'an oversized draft is refused instead of filling the browser');
assert.deepEqual(drafts.readDraft('survey',A,store).payload.walls,{back:{rows:[1]}},'a refused write leaves the earlier draft alone');
store.setItem('atlas-kitchen:draft:survey:'+B,'{not json');assert.equal(drafts.readDraft('survey',B,store),null,'a damaged record reads as no draft');
store.setItem('atlas-kitchen:draft:survey:'+B,JSON.stringify({v:1,kind:'survey',projectId:A,savedAt:1,payload:{}}));assert.equal(drafts.readDraft('survey',B,store),null,'a record filed under the wrong project is not used');
drafts.writeDraft('survey',B,{a:1},store);drafts.writeDraft('design',B,{a:2},store);
drafts.clearDraft('survey',B,store);assert.equal(drafts.readDraft('survey',B,store),null);assert.notEqual(drafts.readDraft('design',B,store),null);
drafts.clearProjectDrafts(B,store);assert.equal(drafts.readDraft('design',B,store),null,'clearing a project removes all its drafts');assert.notEqual(drafts.readDraft('survey',A,store),null,'and no one else\'s');
drafts.writeDraft('survey',B,{a:1},store);drafts.pruneDrafts([A],store);
assert.equal(drafts.readDraft('survey',B,store),null,'drafts of an unknown project are pruned');assert.notEqual(drafts.readDraft('survey',A,store),null,'drafts of a known project stay');
store.quota=10;assert.equal(drafts.writeDraft('survey',A,{a:1},store),false,'a full store reports the failure so the screen can warn');store.quota=Infinity;
drafts.clearProjectDrafts(A,store);

// ---------- the library ----------
const mk=(name,w=4000)=>project.newSurveyProject({widthMm:w,lengthMm:3600,heightMm:2800,name},store);
const p1=mk('الأول'),p2=mk('الثاني'),p3=mk('الثالث');
assert(p1.room.projectId!==p2.room.projectId);
assert.deepEqual(library.listSavedProjects({store}),[]);
let t=1000;const clock=()=>t++;
assert.deepEqual(library.archiveProject(p1,{store,now:clock}),{ok:true,id:p1.room.projectId});
library.archiveProject(p2,{store,now:clock});
assert.deepEqual(library.listSavedProjects({store}).map(p=>p.name),['الثاني','الأول'],'newest first');
assert.deepEqual(library.listSavedProjects({store,exceptId:p2.room.projectId}).map(p=>p.name),['الأول'],'the open project is not listed');
const entry=library.listSavedProjects({store})[1];assert.equal(entry.units,0);assert.equal(entry.surveyedWalls,0);
assert.deepEqual(library.readSavedProject(p1.room.projectId,{store}).project,JSON.parse(JSON.stringify(p1)),'the project is kept exactly');
assert.equal(library.readSavedProject('K-00000000000000000',{store}).ok,false);
assert.equal(library.archiveProject({room:{name:'x'},kitchen:{}},{store}).ok,false,'a project without a number cannot be put aside');
store.setItem(library.savedPrefix+'K-AAAAAAAAAAAAAAAA','{broken');store.setItem(library.savedPrefix+'K-BBBBBBBBBBBBBBBB',JSON.stringify({v:1,id:'K-CCCCCCCCCCCCCCCC',project:p1}));
assert.equal(library.listSavedProjects({store}).length,2,'damaged or mislabelled entries are skipped, not shown');
store.removeItem(library.savedPrefix+'K-AAAAAAAAAAAAAAAA');store.removeItem(library.savedPrefix+'K-BBBBBBBBBBBBBBBB');
store.quota=store.length?[...store.mem].reduce((n,[k,v])=>n+k.length+v.length,0)+5:0;
const full=library.archiveProject(p3,{store,now:clock});assert.equal(full.ok,false);assert.equal(full.reason,library.noSpaceReason,'a full store says so');
store.quota=Infinity;
assert.equal(library.removeSavedProject(p2.room.projectId,{store}),true);assert.equal(library.listSavedProjects({store}).length,1);
library.removeSavedProject(p1.room.projectId,{store});

// ---------- replacing the open project puts it aside first ----------
assert(project.saveProject(p1));
const open=project.openKitchenProject();assert.equal(open.room.projectId,p1.room.projectId);
const renamed={...open,room:{...open.room,name:'تعديل عادي'}};
assert(project.commitProject(open,renamed).ok);assert.deepEqual(library.listSavedProjects({store}),[],'an ordinary edit of the same project puts nothing aside');
const swap=project.commitProject(renamed,p2,{restoreArchive:true});
assert(swap.ok&&swap.saved,swap.reason);
assert.equal(project.storedKitchenProject(store).room.projectId,p2.room.projectId,'the other project is now open');
assert.deepEqual(library.listSavedProjects({store}).map(p=>p.name),['تعديل عادي'],'the replaced project, with its latest edit, is in the library');
// a full store: the replacement is refused and the open project stays exactly as it was
const before=store.getItem('atlas-kitchen:project:v1');
store.quota=[...store.mem].reduce((n,[k,v])=>n+k.length+v.length,0)+20;
const refused=project.commitProject(p2,p3,{restoreArchive:true});
assert.equal(refused.ok,false);assert.equal(refused.code,'archive-failed');assert.equal(refused.reason,library.noSpaceReason);
assert.equal(store.getItem('atlas-kitchen:project:v1'),before,'nothing was overwritten');store.quota=Infinity;
// a missing saved project cannot be opened, and nothing changes
const stable=store.getItem('atlas-kitchen:project:v1');
assert.equal(flows.openSavedProject('K-1111111111111111',{current:project.openKitchenProject(),store}).ok,false);assert.equal(store.getItem('atlas-kitchen:project:v1'),stable);
library.removeSavedProject(renamed.room.projectId,{store});

// ---------- starting a new project ----------
const cur=project.openKitchenProject();assert.equal(cur.room.projectId,p2.room.projectId);
drafts.writeDraft('survey',cur.room.projectId,{walls:{}},store);
const started=flows.startNewProject(cur,{store});assert.equal(started.ok,true);
assert.equal(project.storedKitchenProject(store),null,'no project is open any more');
assert.equal(flows.newVisitRequested(store),true,'the intake form is asked for');
assert.deepEqual(library.listSavedProjects({store}).map(p=>p.id),[p2.room.projectId],'the project that was open is saved');
assert.match(flows.takeSwitchNotice(store),/الثاني/);assert.equal(flows.takeSwitchNotice(store),'','the notice is shown once');
assert.notEqual(drafts.readDraft('survey',cur.room.projectId,store),null,'its unsaved work is kept with it');
assert.equal(project.kitchenHistory().length,0,'undo history does not follow into the next project');
// a stored project that this page does not know about (changed in another window) is never put aside blindly
assert(project.saveProject(p3));const openedHere=project.openKitchenProject();
store.setItem('atlas-kitchen:project:v1',JSON.stringify({...JSON.parse(store.getItem('atlas-kitchen:project:v1')),room:{...JSON.parse(store.getItem('atlas-kitchen:project:v1')).room,name:'من نافذة أخرى'}}));
const stale=flows.startNewProject(openedHere,{store});assert.equal(stale.ok,false);assert.equal(stale.reason,project.staleProjectMessage);
assert.equal(project.storedKitchenProject(store).room.name,'من نافذة أخرى','the other window\'s work is still there');

// ---------- opening a saved project swaps it with the open one ----------
const now=project.openKitchenProject();const idNow=now.room.projectId;assert.equal(idNow,p3.room.projectId);
assert.equal(flows.clearNewVisitRequest(store),undefined);
const opened=flows.openSavedProject(p2.room.projectId,{current:now,store});assert.equal(opened.ok,true,opened.reason);
assert.equal(project.storedKitchenProject(store).room.projectId,p2.room.projectId,'the chosen project is open');
assert.deepEqual(library.listSavedProjects({store}).map(p=>p.id),[idNow],'the one that was open is saved, and the chosen one left the list');
assert.equal(flows.newVisitRequested(store),false);
// full store while swapping: nothing changes
const stableAgain=store.getItem('atlas-kitchen:project:v1');const cur2=project.openKitchenProject();
store.quota=[...store.mem].reduce((n,[k,v])=>n+k.length+v.length,0)+20;
const blocked=flows.openSavedProject(idNow,{current:cur2,store});assert.equal(blocked.ok,false);
assert.equal(store.getItem('atlas-kitchen:project:v1'),stableAgain);assert.equal(library.listSavedProjects({store}).length,1,'both projects are still where they were');store.quota=Infinity;
// an unreadable saved entry is refused before anything is touched
store.setItem(library.savedPrefix+idNow,JSON.stringify({v:1,id:idNow,name:'x',savedAt:1,project:{room:{projectId:idNow,name:'x'},kitchen:{units:'bad'}}}));
assert.equal(flows.openSavedProject(idNow,{current:cur2,store}).ok,false);assert.equal(store.getItem('atlas-kitchen:project:v1'),stableAgain);

// ---------- deleting a saved project, and orphan drafts ----------
library.archiveProject(p1,{store});drafts.writeDraft('survey',p1.room.projectId,{a:1},store);
assert.equal(flows.deleteSavedProject(p1.room.projectId,{store}).ok,true);
assert.equal(drafts.readDraft('survey',p1.room.projectId,store),null,'its drafts go with it');
drafts.writeDraft('survey',B,{a:1},store);flows.pruneOrphanDrafts({store});
assert.equal(drafts.readDraft('survey',B,store),null,'a draft of a project nobody has is dropped');
drafts.writeDraft('survey',project.storedKitchenProject(store).room.projectId,{a:1},store);flows.pruneOrphanDrafts({store});
assert.notEqual(drafts.readDraft('survey',project.storedKitchenProject(store).room.projectId,store),null,'the open project\'s draft stays');
assert.equal(flows.projectHomeURL(),'http://studio.test/index.html','the page shown after a switch carries no stage, panel or hash');

// ---------- the buttons: keep unsaved work, switch, show the front page ----------
let navigated=null;globalThis.location.assign=url=>{navigated=url;};
const holdOn=work.registerUnsavedWork({atRisk:()=>true});
const here=project.openKitchenProject();
assert.equal(flows.newProjectNow(here,{store}).ok,false);assert.equal(navigated,null,'work that cannot be kept stops the switch');assert(project.storedKitchenProject(store),'the open project is untouched');
library.archiveProject(p1,{store});
assert.equal(flows.openSavedNow(p1.room.projectId,{current:here,store}).ok,false);assert.equal(navigated,null);assert.equal(project.storedKitchenProject(store).room.projectId,here.room.projectId);
holdOn();
assert.equal(flows.newProjectNow(here,{store}).ok,true);assert.equal(navigated,'http://studio.test/index.html','the front page is shown after the switch');
navigated=null;assert.equal(flows.openSavedNow(p1.room.projectId,{store}).ok,true);assert.equal(navigated,'http://studio.test/index.html');
assert.equal(project.storedKitchenProject(store).room.projectId,p1.room.projectId);
assert(library.listSavedProjects({store}).some(p=>p.id===here.room.projectId),'the project that was open is in the list');

// ---------- the wall survey keeps what was typed ----------
const {mountChainStep}=await import('../public/kitchen-chain-ui.js');
class View{
 html='';handlers={};nodes=new Map();
 set innerHTML(v){this.html=v;}
 get innerHTML(){return this.html;}
 querySelector(q){
  if(!/^\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=|chain-prop=|chain-map)/.test(q))return null;
  if(!this.nodes.has(q))this.nodes.set(q,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelector(){return null;},focus(){},select(){},scrollIntoView(){}});
  return this.nodes.get(q);
 }
 addEventListener(name,handler){this.handlers[name]=handler;}
 removeEventListener(name){delete this.handlers[name];}
 event(type,dataset={},attrs=[],value=''){
  const target={tagName:type==='click'?'BUTTON':type==='input'?'INPUT':'SELECT',dataset,value,closest:()=>target,hasAttribute:a=>attrs.includes(a)};
  this.handlers[type]({target});
 }
 act(action){this.event('click',{chainAct:action});}
 add(k){this.event('click',{addReading:k},['data-add-reading']);}
 input(k,v){this.event('input',{chainProp:k},[],v);}
}
globalThis.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};globalThis.cancelAnimationFrame=()=>{};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
store.mem.clear();
let surveyDoc=project.newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'مسودة رفع'},store);
const surveyApi={getDoc:()=>surveyDoc,apply:next=>{surveyDoc=next;return {ok:true,saved:true};},onAdvance(){}};
const draftKey='atlas-kitchen:draft:survey:'+surveyDoc.room.projectId;
const doorRows=()=>JSON.parse(store.getItem(draftKey)).payload.walls.back.chain.rows.map(r=>[r.kind,r.gapMm,r.widthMm]);

let screen=new View,control=mountChainStep(screen,surveyApi);
assert.equal(store.getItem(draftKey),null,'opening a wall writes nothing');assert.equal(work.hasUnsavedWork(),false);
screen.add('door');screen.input('gapMm','٦٥٠');screen.input('widthMm','٩٠٠');
assert.equal(work.hasUnsavedWork(),true,'readings typed a moment ago are not stored yet');
work.flushUnsavedWork();assert.equal(work.hasUnsavedWork(),false,'once stored, closing the page loses nothing');
assert.deepEqual(doorRows(),[['door',650,900]]);
control.destroy();assert.equal(work.hasUnsavedWork(),false,'a closed screen no longer counts');
assert.deepEqual(doorRows(),[['door',650,900]],'closing the screen does not discard what was typed');

// the same page opens the screen again: the readings are back, with no "restored" fuss
screen=new View;control=mountChainStep(screen,surveyApi);
assert.match(screen.html,/data-chain-row="0"/);assert.doesNotMatch(screen.html,/استُعيدت قياسات/);
control.destroy();
// a new page load: the readings are back and the person is told
const {mountChainStep:mountAfterReload}=await import('../public/kitchen-chain-ui.js?reload=1');
screen=new View;control=mountAfterReload(screen,surveyApi);
assert.match(screen.html,/data-chain-row="0"/);assert.match(screen.html,/استُعيدت قياسات لم تُحفظ بعد/);assert.match(screen.html,/قياس ١، باب/);
// saving the wall for real removes the stored copy
screen.act('save');assert(surveyDoc.room.workshop.chains.back.rows.some(r=>r.kind==='door'),'the wall was saved');
await wait(600);assert.equal(store.getItem(draftKey),null,'nothing is kept once the wall is saved');
control.destroy();
// a full store: the screen says so and the page stays guarded
screen=new View;control=mountChainStep(screen,surveyApi);
store.quota=[...store.mem].reduce((n,[k,v])=>n+k.length+v.length,0)+5;
screen.act('previous-wall');screen.add('window');screen.input('gapMm','٢٠٠');
work.flushUnsavedWork();assert.equal(work.hasUnsavedWork(),true,'a draft that cannot be stored keeps the leave warning on');
assert.match(screen.html+screen.querySelector('[data-chain-notice]').textContent,/تعذّر الحفظ التلقائي/);
store.quota=Infinity;work.flushUnsavedWork();assert.equal(work.hasUnsavedWork(),false,'and it clears as soon as the draft can be stored');
control.destroy();store.mem.delete(draftKey);
// damaged or foreign drafts are ignored, never trusted (a project with no saved readings, so any reading on screen would come from the draft)
let freshDoc=project.newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'نظيف'},store);
const freshApi={getDoc:()=>freshDoc,apply:next=>{freshDoc=next;return {ok:true,saved:true};},onAdvance(){}};
const freshKey='atlas-kitchen:draft:survey:'+freshDoc.room.projectId;
const goodDraft={walls:{back:{chain:{source:'drawing',rows:[{id:'p1',kind:'door',gapMm:650,widthMm:900}]},base:'x'}}};
store.setItem(freshKey,JSON.stringify({v:1,kind:'survey',projectId:freshDoc.room.projectId,savedAt:Date.now(),payload:goodDraft}));
screen=new View;control=mountAfterReload(screen,freshApi);assert.match(screen.html,/data-chain-row="0"/,'a well-formed draft is shown (control for the cases below)');control.destroy();
for(const bad of [{walls:{back:{chain:{rows:[{id:'p1',kind:'__proto__',gapMm:1}]},base:'x'}}},{walls:{back:{chain:{rows:'x'}}}},{walls:{nowhere:{chain:{rows:[]}}}},{walls:'x'}]){
 store.setItem(freshKey,JSON.stringify({v:1,kind:'survey',projectId:freshDoc.room.projectId,savedAt:Date.now(),payload:bad}));
 screen=new View;control=mountAfterReload(screen,freshApi);assert.doesNotMatch(screen.html,/data-chain-row="0"/,'a damaged draft is not shown');control.destroy();
}
// another project's draft is never shown here
store.mem.delete(freshKey);
const other=project.newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'غيره'},store);
drafts.writeDraft('survey',other.room.projectId,goodDraft,store);
screen=new View;control=mountAfterReload(screen,freshApi);assert.doesNotMatch(screen.html,/data-chain-row="0"/);control.destroy();

// ---------- the saved-projects list ----------
const {mountSavedProjects}=await import('../public/kitchen-saved-projects-ui.js');
store.mem.clear();
const s1=mk('أول'),s2=mk('ثانٍ');library.archiveProject(s1,{store,now:()=>1000});library.archiveProject(s2,{store,now:()=>2000});
const host={hidden:true,innerHTML:'',onclick:null,classList:{add(){}},setAttribute(){},contains:()=>true,querySelector:()=>null};
const press=(dataset,attr)=>host.onclick({target:{closest:()=>({dataset,hasAttribute:a=>a===attr})}});
const openedIds=[],deleted=[];let openResult={ok:false,reason:'مساحة ممتلئة'};
mountSavedProjects(host,{store,notice:'حُفظ المشروع السابق',onOpen:id=>{openedIds.push(id);return openResult;},onDelete:id=>{deleted.push(id);return flows.deleteSavedProject(id,{store});}});
assert.equal(host.hidden,false);assert.match(host.innerHTML,/ثانٍ[\s\S]*أول/,'newest first');assert.match(host.innerHTML,/حُفظ المشروع السابق/,'the notice from the switch is shown');
press({savedOpen:s2.room.projectId});assert.deepEqual(openedIds,[s2.room.projectId]);assert.match(host.innerHTML,/مساحة ممتلئة/,'a refused open says why and keeps the list');assert.match(host.innerHTML,/data-saved-open/);
press({savedDelete:s1.room.projectId});assert.match(host.innerHTML,/تأكيد الحذف/,'deleting asks first');assert.deepEqual(deleted,[]);assert.equal(library.listSavedProjects({store}).length,2);
press({savedCancel:''},'data-saved-cancel');assert.doesNotMatch(host.innerHTML,/تأكيد الحذف/);assert.deepEqual(deleted,[]);
press({savedDelete:s1.room.projectId});press({savedDeleteConfirm:s1.room.projectId});
assert.deepEqual(deleted,[s1.room.projectId]);assert.doesNotMatch(host.innerHTML,/>أول</,'the deleted project leaves the list');assert.match(host.innerHTML,/حُذف المشروع المحفوظ/);
openResult={ok:true};press({savedOpen:s2.room.projectId});assert.match(host.innerHTML,/جارٍ فتح المشروع/);assert.match(host.innerHTML,/data-saved-open="[^"]*" aria-label="[^"]*" disabled/,'while opening, the buttons are off');
const hiddenHost={hidden:false,innerHTML:'x',onclick:null};mountSavedProjects(hiddenHost,{store,exceptId:s2.room.projectId,onOpen(){},onDelete(){}});
assert.equal(hiddenHost.hidden,true,'with nothing saved and nothing to say the list is not shown');assert.equal(hiddenHost.innerHTML,'');
const escaped=mk('<img src=x onerror=alert(1)>');library.archiveProject(escaped,{store,now:()=>3000});
mountSavedProjects(host,{store,onOpen(){},onDelete(){}});assert.doesNotMatch(host.innerHTML,/<img/,'a project name is text, never markup');

console.log('PASS: unsaved-work probes warn only while work is at risk; drafts round-trip and are pruned; wall readings survive a reload and clear on save; a project is put aside before anything replaces it, and never replaced when it cannot be; the saved list asks before deleting and escapes names.');
