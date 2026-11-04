import assert from 'node:assert/strict';
import {getProjectAccess,refreshProjectAccess,bindProjectAccess,validateProjectEdit,withTrustedProjectInstall,subscribeProjectAccess} from '../public/kitchen-project-access.js';
import {newSurveyProject,saveProject,openKitchenProject,commitProject,undoProject,redoProject,kitchenHistory,kitchenFuture,openUnitContext,projectChangedElsewhere} from '../public/kitchen-project.js';
import {seedCatalog,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {startNewProject,openSavedProject} from '../public/kitchen-project-switch.js';
import {readSavedProject} from '../public/kitchen-project-library.js';
import {mountSyncStep} from '../public/kitchen-workshop-sync-ui.js';

class Store{
 constructor(values=[]){this.values=new Map(values);}
 getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}
 get length(){return this.values.size;}key(i){return [...this.values.keys()][i]??null;}
}
const reset=()=>{globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();};
const remote='a1234567-1234-1234-1234-123456789abc',otherRemote='b1234567-1234-1234-1234-123456789abc';
const make=name=>{const d=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name});d.room.workshop=normalizeWorkshopCatalogs({catalog:seedCatalog()});return d;};
reset();let doc=make('Access fixture');assert.equal(getProjectAccess(doc).role,'owner');assert(saveProject(doc));doc=openKitchenProject();
let notices=0;const stop=subscribeProjectAccess(()=>notices++);
bindProjectAccess(doc,{id:remote,role:'store',revision:2});assert.equal(getProjectAccess(doc).role,'store');
// A failed server-snapshot install must not advance the optimistic base of the
// still-open local document, change its role, or replace its session link.
const priorAccess=getProjectAccess(doc),priorRegistry=localStorage.getItem('kitchen-workshop:access:v1'),priorLink=sessionStorage.getItem('kitchen-workshop:remote:v1');
const unchangedBinding=()=>{assert.deepEqual(getProjectAccess(doc),priorAccess);assert.equal(localStorage.getItem('kitchen-workshop:access:v1'),priorRegistry);assert.equal(sessionStorage.getItem('kitchen-workshop:remote:v1'),priorLink);};
for(const failure of [false,{ok:false,reason:'stale'},{ok:true,saved:false,reason:'quota'}]){
 assert.equal(withTrustedProjectInstall(doc,{id:remote,role:'factory',revision:8},()=>failure),failure);unchangedBinding();
}
assert.throws(()=>withTrustedProjectInstall(doc,{id:otherRemote,role:'viewer',revision:8},()=>{throw Error('install failed');}),/install failed/);unchangedBinding();
const beforeFailedInstall=localStorage.getItem('atlas-kitchen:project:v1'),incoming=structuredClone(doc);incoming.room.name='New server snapshot';
const originalSet=localStorage.setItem;localStorage.setItem=function(key,value){if(key==='atlas-kitchen:project:v1')throw Error('quota');return originalSet.call(this,key,value);};
assert.equal(withTrustedProjectInstall(incoming,{id:remote,role:'factory',revision:8},()=>commitProject(doc,incoming,{restoreArchive:true})).saved,false);
localStorage.setItem=originalSet;unchangedBinding();assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),beforeFailedInstall);
localStorage.setItem('atlas-kitchen:project:v1',JSON.stringify({...doc,room:{...doc.room,name:'Changed by another tab'}}));
assert.equal(withTrustedProjectInstall(incoming,{id:remote,role:'factory',revision:8},()=>commitProject(doc,incoming,{restoreArchive:true})).code,'stale-project');
localStorage.setItem('atlas-kitchen:project:v1',beforeFailedInstall);unchangedBinding();
let next=structuredClone(doc);next.room.workshop.storeCatalog.items[0].price=25;
let result=commitProject(doc,next);assert(result.ok,result.reason);doc=result.next;
assert.equal(getFactoryCatalog(doc).items[0].price,25);
const stored=localStorage.getItem('atlas-kitchen:project:v1'),history=JSON.stringify(kitchenHistory());
next=structuredClone(doc);next.room.workshop.pricingTerms.terms.delivery=75;
assert.equal(validateProjectEdit(doc,next).ok,false);assert.equal(commitProject(doc,next).ok,false);assert.equal(saveProject(next),false);
assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),stored);assert.equal(JSON.stringify(kitchenHistory()),history);
next=structuredClone(doc);next.room.role='owner';next.room.workshop.factoryRecipes.families.storage.minMm+=50;
assert.equal(validateProjectEdit(doc,next).ok,false,'Imported fields cannot grant authority.');

bindProjectAccess(doc,{id:remote,role:'viewer',revision:2});
assert.equal(undoProject(doc),null);assert.equal(JSON.stringify(kitchenHistory()),history,'Denied undo does not consume history.');
sessionStorage.setItem('studio-kitchen:redo:v1',JSON.stringify([next]));const future=JSON.stringify(kitchenFuture());
assert.equal(redoProject(doc),null);assert.equal(JSON.stringify(kitchenFuture()),future,'Denied redo does not consume history.');
assert.equal(openUnitContext('missing'),null);
globalThis.fetch=async()=>Response.json({id:remote,role:'rep',revision:9});
assert.equal((await refreshProjectAccess(doc)).role,'rep');assert.equal(getProjectAccess(doc).revision,2,'Access refresh cannot advance the base revision of the local snapshot.');
globalThis.fetch=async()=>new Response('{}',{status:403});
assert.equal((await refreshProjectAccess(doc)).status,'denied');assert.equal(getProjectAccess(doc).role,null);
next=structuredClone(doc);next.room.name='Not permitted';assert.equal(commitProject(doc,next).ok,false);
globalThis.fetch=async()=>{throw Error('offline');};
assert.equal((await refreshProjectAccess(doc)).status,'unavailable');assert.equal(saveProject(next),false);

// A new module/storage lifetime never restores the last server role as trusted.
globalThis.localStorage=new Store(localStorage.values);globalThis.sessionStorage=new Store(sessionStorage.values);
assert.equal(getProjectAccess(doc).status,'checking');assert.equal(getProjectAccess(doc).role,null);
assert(getProjectAccess(doc).remoteProjectId);
globalThis.fetch=async()=>Response.json({id:remote,role:'invented',revision:3});
assert.equal((await refreshProjectAccess(doc)).status,'unavailable');
const separate=make('Unbound independent project');assert.equal(getProjectAccess(separate).role,'owner');
const installed=withTrustedProjectInstall(separate,{id:otherRemote,role:'viewer',revision:1},()=>commitProject(doc,separate,{restoreArchive:true}));
assert(installed.ok,installed.reason);doc=installed.next;
assert.equal(getProjectAccess(doc).role,'viewer');assert.equal(getProjectAccess(separate).remoteProjectId,otherRemote);
assert.equal(getProjectAccess(JSON.parse(stored)).remoteProjectId,remote);
assert.equal(saveProject({...doc,room:{...doc.room,name:'Viewer write'}}),false);
assert(startNewProject(doc).ok);assert.equal(sessionStorage.getItem('kitchen-workshop:remote:v1'),null);
const fresh=make('Fresh local');assert.equal(getProjectAccess(fresh).status,'local');assert(saveProject(fresh));
assert(openSavedProject(doc.room.projectId,{current:fresh}).ok);assert.equal(getProjectAccess(openKitchenProject()).role,'viewer','Opening a saved shared project does not make its viewer an owner.');
assert(notices>0);stop();

// Association and snapshot persistence share one installation boundary. A
// quota failure cannot leave new shared bytes behind as an unbound local owner.
{
 reset();let base=make('Transactional install');assert(saveProject(base));base=openKitchenProject();bindProjectAccess(base,{id:remote,role:'viewer',revision:1});
 const raw=localStorage.getItem('atlas-kitchen:project:v1'),registry=localStorage.getItem('kitchen-workshop:access:v1'),link=sessionStorage.getItem('kitchen-workshop:remote:v1'),access=getProjectAccess(base),undo=sessionStorage.getItem('atlas-kitchen:undo:v1');
 const incoming=structuredClone(base);incoming.room.name='Fresh server bytes';const metadata={id:remote,role:'factory',revision:8},set=localStorage.setItem;
 localStorage.setItem=function(key,value){if(key==='kitchen-workshop:access:v1')throw Error('metadata quota');return set.call(this,key,value);};
 assert.equal(withTrustedProjectInstall(incoming,metadata,()=>commitProject(base,incoming,{restoreArchive:true})).saved,false);
 localStorage.setItem=set;
 const unchanged=()=>{assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),raw);assert.equal(localStorage.getItem('kitchen-workshop:access:v1'),registry);assert.equal(sessionStorage.getItem('kitchen-workshop:remote:v1'),link);assert.equal(sessionStorage.getItem('atlas-kitchen:undo:v1'),undo);assert.deepEqual(getProjectAccess(base),access);assert.equal(projectChangedElsewhere(),false);};
 unchanged();
 assert.throws(()=>withTrustedProjectInstall(incoming,metadata,()=>{const r=commitProject(base,incoming,{restoreArchive:true});assert(r.ok,r.reason);throw Error('callback after save');}),/callback after save/);
 unchanged();
 let wroteDocument=false,lateAssociationWrites=0;
 localStorage.setItem=function(key,value){if(key==='atlas-kitchen:project:v1')wroteDocument=true;if(wroteDocument&&key==='kitchen-workshop:access:v1'){lateAssociationWrites++;throw Error('metadata quota after document');}return set.call(this,key,value);};
 const installed=withTrustedProjectInstall(incoming,metadata,()=>commitProject(base,incoming,{restoreArchive:true}));
 localStorage.setItem=set;assert(installed.ok,installed.reason);assert.equal(lateAssociationWrites,0,'Final binding reuses the already stored association.');assert.equal(getProjectAccess(incoming).revision,8);assert.equal(getProjectAccess(incoming).role,'factory');assert.equal(openKitchenProject().room.name,incoming.room.name);
}
{
 reset();let base=make('Recovery failure');assert(saveProject(base));base=openKitchenProject();bindProjectAccess(base,{id:remote,role:'viewer',revision:1});
 const raw=localStorage.getItem('atlas-kitchen:project:v1'),incoming=structuredClone(base);incoming.room.name='Installed before failure';const set=localStorage.setItem;
 assert.throws(()=>withTrustedProjectInstall(incoming,{id:remote,role:'factory',revision:8},()=>{
  assert(commitProject(base,incoming,{restoreArchive:true}).ok);
  localStorage.setItem=function(key,value){if(key==='atlas-kitchen:project:v1'&&value===raw)throw Error('storage lost');return set.call(this,key,value);};
  throw Error('install callback failed');
 }),/install callback failed/);
 localStorage.setItem=set;assert.equal(getProjectAccess(incoming).status,'unavailable');assert.equal(getProjectAccess(incoming).role,null);assert.equal(saveProject(incoming),false);
 globalThis.localStorage=new Store(localStorage.values);assert.equal(getProjectAccess(incoming).status,'unavailable','Recovery lock survives a module/storage lifetime through session metadata.');
}

// Adopt the old session link only for the open slot, then persist the association.
reset();let legacy=make('Legacy linked');assert(saveProject(legacy));
sessionStorage.setItem('kitchen-workshop:remote:v1',JSON.stringify({id:remote,revision:4}));
assert.equal(getProjectAccess(legacy).status,'checking');assert.equal(getProjectAccess(make('Other local')).status,'local');
globalThis.sessionStorage=new Store();globalThis.localStorage=new Store(localStorage.values);
assert.equal(getProjectAccess(legacy).remoteProjectId,remote,'The association survives losing the old session link.');

// An owner may save an independent full copy, preserving the source identity.
// Scoped users use their DTO workspace and cannot clone a cached full archive.
reset();let live=make('Shared copy source');assert(saveProject(live));live=openKitchenProject();const original=live;
bindProjectAccess(live,{id:remote,role:'owner',revision:1});let published;
globalThis.fetch=async(url,options={})=>{
 const q=new URL(url,'https://studio.test').searchParams;
 if(options.method==='POST'){published=JSON.parse(options.body);return Response.json({id:q.get('id'),role:'owner',revision:1});}
 if(q.get('action')==='access')return Response.json({id:q.get('id'),role:'owner',revision:1});
 if(q.get('action')==='approvals')return Response.json({approvals:[]});
 return Response.json({projects:[{id:remote,role:'owner',revision:1,name:'Shared copy source'}]});
};
class Host{constructor(){this.innerHTML='';this.events={};}querySelectorAll(){return [];}querySelector(){return null;}addEventListener(type,fn){this.events[type]=fn;}removeEventListener(type){delete this.events[type];}}
const host=new Host(),dispose=mountSyncStep(host,{getDoc:()=>live,apply(next,message,options){const r=commitProject(live,next,options);if(r.ok&&r.changed)live=r.next||next;return r;},tell(){}});
const until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,10));assert(predicate(),'The asynchronous sync action must finish.');};
await until(()=>host.innerHTML.includes('متصل بحسابك.'));
assert(host.innerHTML.includes('حفظ نسخة مستقلة كمالك جديد'));
host.events.click({target:{closest:()=>({dataset:{sync:'create'}})}});
await until(()=>published&&live.room.projectId!==original.room.projectId);
assert.notEqual(published.design.room.projectId,original.room.projectId);
assert.equal(getProjectAccess(original).role,'owner');assert.equal(getProjectAccess(original).remoteProjectId,remote);
assert.equal(getProjectAccess(live).role,'owner');assert.notEqual(getProjectAccess(live).remoteProjectId,remote);
assert(readSavedProject(original.room.projectId).ok,'The shared source remains in saved projects.');
dispose();
// Cached full archives cannot be uploaded or copied from any nonowner role.
for(const role of ['store','factory','rep','viewer','editor']){
 reset();live=make('Local room name');assert(saveProject(live));live=openKitchenProject();bindProjectAccess(live,{id:remote,role,revision:1});let sentTitle=null;
 globalThis.fetch=async(url,options={})=>{
  const q=new URL(url,'https://studio.test').searchParams;
  if(options.method==='POST'){sentTitle=q.get('name');return Response.json({id:remote,role,revision:2});}
  if(q.get('action')==='access')return Response.json({id:remote,role,revision:sentTitle?2:1});
  if(q.get('action')==='approvals')return Response.json({approvals:[]});
  return Response.json({projects:[{id:remote,role,revision:sentTitle?2:1,name:'Authoritative cloud title'}]});
 };
 const scopedHost=new Host(),stopSync=mountSyncStep(scopedHost,{getDoc:()=>live,apply(){throw Error('Saving this project must not replace it.');},tell(){}});
 await until(()=>scopedHost.innerHTML.includes('متصل بحسابك.'));
 assert(!scopedHost.innerHTML.includes('data-sync="save"'));assert(!scopedHost.innerHTML.includes('data-sync="create"'));
 scopedHost.events.input({target:{matches:()=>true,value:'Forged cloud title'}});
 scopedHost.events.click({target:{closest:()=>({dataset:{sync:'save'}})}});
 scopedHost.events.click({target:{closest:()=>({dataset:{sync:'confirm'}})}});
 await until(()=>scopedHost.innerHTML.includes('يُحفظ الأرشيف الكامل من حساب المالك'));
 scopedHost.events.click({target:{closest:()=>({dataset:{sync:'create'}})}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sentTitle,null);assert.equal(getProjectAccess(live).revision,1);stopSync();
}
console.log('PASS: trusted project role binding, reload/offline/revocation locks, scoped commit/save/history guards, legacy-link migration, identity-safe saved switches and independent cloud copies.');
