import assert from 'node:assert/strict';
import {applyChain,attestChain,newChainRow,resolveChain} from '../public/kitchen-chain-model.js';
import {mountChainStep,prepareSurveySave} from '../public/kitchen-chain-ui.js';
import {flushUnsavedWork,hasUnsavedWork} from '../public/kitchen-unsaved-work.js';

// This is the real local project pipeline, with isolated in-memory browser
// storage. No prototype state, production fixture or browser is involved.
class Store {
  data=new Map();
  get length(){return this.data.size;}
  key(i){return [...this.data.keys()][i]??null;}
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){this.data.set(key,String(value));}
  removeItem(key){this.data.delete(key);}
}
globalThis.localStorage=new Store();
globalThis.sessionStorage=new Store();
const project=await import('../public/kitchen-project.js?notebook=primary');
let helper;
try {helper=await import('../public/kitchen-survey-notebook-model.js');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
assert.equal(typeof helper?.surveyNotebookSummary,'function','Notebook summary helper must exist before the real workflow can report proof.');
const {surveyNotebookSummary:summary}=helper;
const projectKey='atlas-kitchen:project:v1';
const identity={name:'فني الموقع',reference:'زيارة ٤٢ — الجدار الخلفي',date:'2026-11-04T10:00:00.000Z'};
const wallChain=()=>({source:'drawing',rows:[
  {...newChainRow('window','window-1'),from:'origin',gapMm:1500,widthMm:1200,bottomMm:1100,heightMm:900,depthMm:100},
  {id:'close-1',kind:'corner',from:'origin',gapMm:4200}
]});
const emptyWallChain=()=>({source:'drawing',rows:[{id:'close-right',kind:'corner',from:'origin',gapMm:3600}]});
const chainOf=(doc,wall='back')=>doc.room.workshop?.chains?.[wall];
const summaryOf=(doc,options)=>summary(doc,'back',chainOf(doc),options);
const snapshot=()=>({saved:localStorage.getItem(projectKey),past:sessionStorage.getItem('atlas-kitchen:undo:v1'),future:sessionStorage.getItem('studio-kitchen:redo:v1')});
const prepared=(doc,chain,wall='back')=>{
  const out=prepareSurveySave(doc,[[wall,chain]]);
  assert.equal(out.ok,true,out.reason);
  return out.doc;
};
const saved=(doc,next)=>{
  const out=project.commitProject(doc,next);
  assert.equal(out.ok,true,out.reason);
  assert.equal(out.saved,true);
  return out.next||next;
};
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name);}
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
let doc;

await check('new real project exposes identity and wall dimensions without claiming a measurement',()=>{
  doc=project.newSurveyProject({widthMm:4200,lengthMm:3600,heightMm:2800,name:'زيارة المطبخ'},localStorage);
  assert.ok(doc);
  assert.equal(project.saveProject(doc),true);
  doc=project.openKitchenProject();
  const out=summary(doc,'back',{source:'drawing',rows:[]});
  assert.deepEqual(Object.keys(out).sort(),['projectId','projectName','wallLabel','lengthMm','heightMm','readingCount','closed','remainingMm','valid','error','proofValid','status','sourceLabel'].sort());
  assert.equal(out.projectId,doc.room.projectId);
  assert.equal(out.projectName,'زيارة المطبخ');
  assert.ok(out.wallLabel);
  assert.equal(out.lengthMm,4200);
  assert.equal(out.heightMm,2800);
  assert.equal(out.readingCount,0);
  assert.equal(out.closed,false);
  assert.equal(out.remainingMm,4200);
  assert.equal(out.valid,true);
  assert.equal(out.error,'');
  assert.equal(out.proofValid,false);
  assert.equal(out.status,'لم تُحفظ قياسات الجدار');
});

await check('chain application and atomic survey save persist the same measured geometry in one undo entry',()=>{
  const chain=wallChain(),direct=applyChain(doc,'back',chain),before=project.kitchenHistory().length;
  assert.equal(direct.ok,true,direct.reason);
  const next=prepared(doc,chain);
  assert.deepEqual(next,direct.doc);
  const pending=summary(doc,'back',chain,{dirty:true});
  assert.equal(pending.status,'قياسات غير محفوظة');
  assert.equal(pending.proofValid,false);
  doc=saved(doc,next);
  assert.equal(project.kitchenHistory().length,before+1);
  const reopened=project.storedKitchenProject();
  assert.deepEqual(reopened.room.workshop.chains.back,chainOf(doc));
  assert.deepEqual(reopened.kitchen.features,doc.kitchen.features);
  assert.equal(reopened.kitchen.features[0].u,150);
  const out=summaryOf(reopened);
  assert.equal(out.readingCount,2);
  assert.equal(out.closed,true);
  assert.equal(out.remainingMm,0);
  assert.equal(out.proofValid,false);
  assert.equal(out.status,'محفوظ دون توثيق ميداني');
  assert.equal(out.sourceLabel,'مرجع من الرسم');
  doc=project.openKitchenProject();
});

await check('real technician attestation is saved and recomputed after reopening',()=>{
  const signed=attestChain(doc,'back',chainOf(doc),identity);
  assert.equal(signed.ok,true,signed.reason);
  const next=prepared(doc,signed.chain);
  assert.equal(summary(doc,'back',signed.chain).proofValid,false,'a signature not saved on the current document is not proof');
  doc=saved(doc,next);
  doc=project.openKitchenProject();
  const out=summaryOf(doc);
  assert.equal(out.proofValid,true);
  assert.equal(out.status,'رفع ميداني موثّق');
  assert.equal(out.sourceLabel,'رفع ميداني');
  assert.deepEqual(chainOf(doc).attestation,identityWithKey(chainOf(doc).attestation.key));
});
function identityWithKey(key){return {...identity,key};}

await check('undo and redo traverse the actual signed project snapshot',()=>{
  const signed=JSON.stringify(doc),before=project.kitchenHistory().length;
  const undo=project.undoProject(doc);
  assert.equal(undo?.saved,true);
  doc=undo.next;
  assert.equal(summaryOf(doc).proofValid,false);
  assert.equal(summaryOf(doc).status,'محفوظ دون توثيق ميداني');
  assert.equal(project.kitchenHistory().length,before-1);
  const redo=project.redoProject(doc);
  assert.equal(redo?.saved,true);
  doc=redo.next;
  assert.equal(JSON.stringify(doc),signed);
  assert.equal(summaryOf(doc).proofValid,true);
  assert.equal(summaryOf(project.storedKitchenProject()).proofValid,true);
});

await check('pending and dirty edits suppress proof without changing a saved signature',()=>{
  const before=JSON.stringify(doc);
  assert.equal(summaryOf(doc,{pending:true}).proofValid,false);
  assert.equal(summaryOf(doc,{pending:true}).status,'تعديل قياس بانتظار التطبيق');
  assert.equal(summaryOf(doc,{dirty:true}).proofValid,false);
  assert.equal(summaryOf(doc,{dirty:true}).status,'قياسات غير محفوظة');
  assert.equal(summaryOf(doc,{pending:true,dirty:true}).status,'تعديل قياس بانتظار التطبيق');
  assert.equal(JSON.stringify(doc),before);
});

await check('CAD mismatch, changed wall geometry and mismatched signer cannot borrow a saved proof',()=>{
  const cad=structuredClone(doc);cad.kitchen.features[0].u+=1;
  assert.equal(summaryOf(cad).valid,true);
  assert.equal(summaryOf(cad).proofValid,false);
  assert.equal(summaryOf(cad).status,'يحتاج إعادة توثيق');
  const room=structuredClone(doc);room.room.height+=1;
  assert.equal(summaryOf(room).proofValid,false);
  const signer=structuredClone(chainOf(doc));signer.attestation.name='فني آخر';
  assert.equal(summary(doc,'back',signer).proofValid,false);
  const missing=structuredClone(doc);missing.kitchen.features=[];
  assert.equal(summaryOf(missing).proofValid,false);
});

await check('editing a signed measured dimension invalidates proof and undo restores it',()=>{
  const edited=structuredClone(chainOf(doc));edited.rows[0].gapMm=1600;
  assert.equal(summary(doc,'back',edited).proofValid,false);
  doc=saved(doc,prepared(doc,edited));
  assert.equal(doc.kitchen.features[0].u,160);
  assert.equal(summaryOf(doc).valid,true);
  assert.equal(summaryOf(doc).proofValid,false);
  assert.equal(summaryOf(doc).status,'يحتاج إعادة توثيق');
  doc=project.undoProject(doc).next;
  assert.equal(summaryOf(doc).proofValid,true);
});

await check('invalid dimensions and a failed independent closure never enter saved state or history',()=>{
  for(const change of [c=>{c.rows[0].gapMm=null;},c=>{c.rows[0].gapMm=4000;},c=>{c.rows[1].gapMm=4199;}]){
    const invalid=structuredClone(chainOf(doc));change(invalid);
    const before=snapshot(),out=summary(doc,'back',invalid);
    assert.equal(out.valid,false);
    assert.equal(out.proofValid,false);
    assert.ok(out.error);
    const result=prepareSurveySave(doc,[['back',invalid]]);
    assert.equal(result.ok,false);
    assert.strictEqual(result.doc,doc);
    assert.deepEqual(snapshot(),before);
  }
  const changed=structuredClone(chainOf(doc));changed.rows[0].gapMm=1700;
  const badRight=emptyWallChain();badRight.rows[0].gapMm=3599;
  const before=JSON.stringify(doc),atomic=prepareSurveySave(doc,[['back',changed],['right',badRight]]);
  assert.equal(atomic.ok,false);
  assert.strictEqual(atomic.doc,doc);
  assert.equal(JSON.stringify(doc),before,'failed second wall does not alter the first');
});

await check('a real corner-only measurement can be signed and saved without inventing a feature',()=>{
  const chain=emptyWallChain(),signed=attestChain(doc,'right',chain,{...identity,reference:'جدار خالٍ — بين الركنين'});
  assert.equal(signed.ok,true,signed.reason);
  const beforeFeatures=JSON.stringify(doc.kitchen.features);
  doc=saved(doc,prepared(doc,signed.chain,'right'));
  doc=project.openKitchenProject();
  const out=summary(doc,'right',chainOf(doc,'right'));
  assert.equal(out.readingCount,1);
  assert.equal(out.lengthMm,3600);
  assert.equal(out.closed,true);
  assert.equal(out.proofValid,true);
  assert.equal(JSON.stringify(doc.kitchen.features),beforeFeatures);
  assert.equal(attestChain(doc,'front',{source:'drawing',rows:[]},identity).ok,false);
});

await check('a cached corner-only candidate cannot conceal a stale signature in the saved chain',()=>{
  const candidate=structuredClone(chainOf(doc,'right')),changed=structuredClone(doc);
  changed.room.workshop.chains.right.rows[0].id='replacement-corner';
  assert.equal(resolveChain(changed.room,'right',chainOf(changed,'right')).ok,true);
  assert.equal(summary(changed,'right',chainOf(changed,'right')).proofValid,false);
  assert.equal(summary(changed,'right',candidate).proofValid,false,'both candidate and saved chain signatures must be current, even with zero CAD features');
  assert.equal(summary(doc,'right',candidate).proofValid,true,'the unchanged signed corner measurement remains valid');
});

await check('quota failure preserves stored measurements and both history directions',()=>{
  const edited=structuredClone(chainOf(doc));edited.rows[0].gapMm=1800;
  const next=prepared(doc,edited),before=snapshot(),set=localStorage.setItem;
  localStorage.setItem=function(key,value){if(key===projectKey)throw new Error('quota');return set.call(this,key,value);};
  try{
    const result=project.commitProject(doc,next);
    assert.equal(result.ok,false);
    assert.equal(result.saved,false);
    assert.deepEqual(snapshot(),before);
    assert.equal(summaryOf(project.storedKitchenProject()).proofValid,true);
  }finally{localStorage.setItem=set;}
});

await check('a stale second tab cannot overwrite the saved wall or undo another tab',async()=>{
  const second=await import('../public/kitchen-project.js?notebook=second');
  const staleDoc=second.openKitchenProject();
  const signed=attestChain(doc,'back',chainOf(doc),{...identity,reference:'مراجعة ثانية'});
  doc=saved(doc,prepared(doc,signed.chain));
  const staleChain=structuredClone(chainOf(staleDoc));staleChain.rows[0].gapMm=1900;
  const before=snapshot();
  const refused=second.commitProject(staleDoc,prepared(staleDoc,staleChain));
  assert.equal(refused.ok,false);
  assert.equal(refused.code,'stale-project');
  assert.equal(second.undoProject(staleDoc),null);
  assert.equal(second.redoProject(staleDoc),null);
  assert.deepEqual(snapshot(),before);
  assert.equal(summaryOf(project.storedKitchenProject()).proofValid,true);
});

await check('summary is pure, rejects unknown walls, and does not promote example sources',()=>{
  const frozen=freeze(structuredClone(doc)),before=JSON.stringify(frozen);
  assert.equal(summaryOf(frozen).proofValid,true);
  assert.equal(JSON.stringify(frozen),before);
  const unknown=summary(frozen,'unknown-wall',wallChain());
  assert.equal(unknown.valid,false);
  assert.equal(unknown.proofValid,false);
  assert.ok(unknown.error);
  const example=structuredClone(chainOf(doc));example.source='example';
  assert.equal(summary(doc,'back',example).proofValid,false);
  assert.equal(summary(doc,'back',example).sourceLabel,'قياسات مثال');
  assert.equal(resolveChain(doc.room,'back',chainOf(doc)).ok,true);
});

// The controller is mounted with only its existing sheet/text node contracts.
// The browser journey covers the notebook DOM layout; these tests exercise the
// actual delegated handlers, pending values and history boundary without it.
class ControllerHost {
  listeners=new Map();nodes=new Map();innerHTML='';
  querySelector(selector){
    if(!/\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=)/.test(selector))return null;
    if(!this.nodes.has(selector))this.nodes.set(selector,{querySelector(){return null;},classList:{toggle(){}},textContent:'',innerHTML:''});
    return this.nodes.get(selector);
  }
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
  emit(type,dataset,value=''){
    const target={dataset,value,tagName:type==='input'?'INPUT':'BUTTON',
      closest(selector){return selector.startsWith('button,')?this:null;},
      hasAttribute(name){return Object.hasOwn(dataset,name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()));}};
    const event={target,detail:1,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}};
    for(const fn of this.listeners.get(type)||[]){if(event.stopped)break;fn(event);}
  }
  click(dataset){this.emit('click',dataset);}
  input(dataset,value){this.emit('input',dataset,value);}
}
function mountedHistory(localFace=null){
  const fixture=structuredClone(doc),host=new ControllerHost(),calls=[],messages=[];
  const ui=mountChainStep(host,{getDoc:()=>fixture,focus:{wall:'back'},localFace,
    apply(){throw Error('A history preflight must not apply a draft.');},
    canHistory:()=>true,onHistory:(forward,focus)=>{calls.push({forward,focus});return {ok:true};},tell:value=>messages.push(value)});
  return {fixture,host,calls,messages,ui};
}

await check('clean saved reading inspection permits history with the correct wall',()=>{
  const {host,calls,ui}=mountedHistory();
  try{
    host.click({chainRow:'0'});
    host.click({chainAct:'notebook-undo'});
    assert.deepEqual(calls,[{forward:false,focus:{wall:'back'}}]);
    host.click({chainRow:'0'});
    host.click({chainAct:'notebook-redo'});
    assert.equal(calls.length,2);
    assert.equal(calls[1].forward,true);
    assert.equal(ui.requestLeave(()=>{}),true,'history leaves no fabricated edit behind');
  }finally{ui.destroy();}
});

await check('page-leave protection ignores clean inspection but retains a real pending edit until cancel',()=>{
  assert.equal(hasUnsavedWork(),false,'previous controllers have removed their leave probes');
  const {host,ui}=mountedHistory();
  try{
    host.click({chainRow:'0'});
    flushUnsavedWork();
    assert.equal(hasUnsavedWork(),false,'inspecting a saved reading must not trap reload or page close');
    host.input({inkValue:'widthMm'},'١٢٠١');
    flushUnsavedWork();
    assert.equal(hasUnsavedWork(),true,'an unapplied edit is still at risk after stored wall drafts are flushed');
    host.click({inkAction:'cancel'});
    flushUnsavedWork();
    assert.equal(hasUnsavedWork(),false,'cancelling the actual edit removes the page-leave warning');
  }finally{ui.destroy();}
  assert.equal(hasUnsavedWork(),false,'destroy removes the controller probe');
});

await check('a changed pending numeric measurement blocks history and cancellation restores it',()=>{
  const {fixture,host,calls,messages,ui}=mountedHistory(),before=JSON.stringify(fixture);
  try{
    host.click({chainRow:'0'});
    host.input({inkValue:'widthMm'},'١٢٠١');
    host.click({chainAct:'notebook-undo'});
    assert.equal(calls.length,0);
    assert.match(messages.at(-1),/أكمل القياس/);
    assert.equal(ui.requestLeave(()=>{}),false);
    assert.match(host.innerHTML,/data-ink-value="widthMm"[^>]*value="١٢٠١"/,'blocked history and leave retain the exact pending input');
    host.click({inkAction:'cancel'});
    host.click({chainAct:'notebook-undo'});
    assert.equal(calls.length,1);
    assert.equal(JSON.stringify(fixture),before,'pending interaction never changes the actual project');
  }finally{ui.destroy();}
});

await check('raw signer changes and applied unsaved wall changes both block project history',()=>{
  const {fixture,host,calls,ui}=mountedHistory(),before=JSON.stringify(fixture);
  try{
    host.click({chainAct:'proof'});
    host.input({chainTechnician:''},'اسم لم يُعتمد');
    host.click({chainAct:'notebook-undo'});
    assert.equal(calls.length,0,'raw technician data must not disappear through history');
    host.click({chainAct:'discard-proof'});
    host.click({chainAct:'notebook-redo'});
    assert.equal(calls.length,1,'discarded signer draft no longer blocks history');
    host.click({chainRow:'0'});
    host.input({inkValue:'widthMm'},'١٢٠١');
    host.click({inkAction:'confirm'});
    host.click({chainAct:'notebook-undo'});
    assert.equal(calls.length,1,'applied wall draft stays guarded until real project save or discard');
    assert.equal(ui.requestLeave(()=>{}),false);
    host.click({chainAct:'leave-discard'});
    assert.equal(JSON.stringify(fixture),before);
  }finally{ui.destroy();}
});

await check('local outline wall editing never dispatches global notebook history',()=>{
  const {host,calls,ui}=mountedHistory({label:'جدار المحيط',save(){throw Error('History cannot save the local face.');},close(){}});
  try{
    host.click({chainAct:'notebook-undo'});
    host.click({chainAct:'notebook-redo'});
    assert.equal(calls.length,0);
    assert.doesNotMatch(host.innerHTML,/sv-notebook|data-chain-act="notebook-undo"/);
    assert.match(host.innerHTML,/data-chain-act="save-face"/);
  }finally{ui.destroy();}
});

await check('the controller and notebook agree that a signed chain with changed CAD needs review',()=>{
  const fixture=structuredClone(doc);
  fixture.kitchen.features.find(feature=>feature.wall==='back'&&feature.kind==='window').u+=1;
  const host=new ControllerHost(),ui=mountChainStep(host,{getDoc:()=>fixture,focus:{wall:'back'},
    apply(){throw Error('Reviewing stale proof cannot change the project.');}});
  try{
    const state=summaryOf(fixture);
    assert.equal(state.valid,true,'the chain dimensions themselves still fit');
    assert.equal(state.proofValid,false,'actual CAD geometry no longer matches its signature');
    assert.equal(state.status,'يحتاج إعادة توثيق');
    assert.equal(host.querySelector('[data-chain-state]').textContent,state.status);
  }finally{ui.destroy();}
});

console.log(`Kitchen survey notebook: ${count} integration groups passed.`);
