import {authorizeProjectChange} from './kitchen-access-policy.js';

// Bindings are device metadata, never part of an imported design. Stored roles
// are deliberately not trusted across reloads: shared projects start checking.
const registryKey='kitchen-workshop:access:v1',linkKey='kitchen-workshop:remote:v1',projectKey='atlas-kitchen:project:v1',recoveryKey='kitchen-workshop:access-recovery:v1';
const roles=new Set(['owner','editor','viewer','store','factory','rep']);
const listeners=new Set(),states=new Map(),requests=new Map(),recoveryLocks=new Set();
let storageRef,installing=null;
const read=(store,key)=>{try{return JSON.parse(store?.getItem(key)||'null');}catch{return null;}};
const currentId=()=>read(globalThis.localStorage,projectKey)?.room?.projectId||null;
const localId=value=>typeof value==='string'?value:value?.room?.projectId||null;
const ordinal=v=>Number.isSafeInteger(v)&&v>0;
const validBinding=b=>b&&typeof b.id==='string'&&/^[a-z0-9-]{16,64}$/i.test(b.id)&&ordinal(b.revision);
const registry=()=>{const r=read(globalThis.localStorage,registryKey);return r&&typeof r==='object'&&!Array.isArray(r)?r:{};};
function ensureStorage(){if(storageRef!==globalThis.localStorage){storageRef=globalThis.localStorage;states.clear();requests.clear();recoveryLocks.clear();}}
const recoveryIds=()=>{const ids=read(globalThis.sessionStorage,recoveryKey);return Array.isArray(ids)?ids:[];};
const recoveryLocked=id=>recoveryLocks.has(id)||recoveryIds().includes(id);
function setRecoveryLock(id,locked){
 if(locked)recoveryLocks.add(id);else recoveryLocks.delete(id);
 const ids=new Set(recoveryIds());if(locked)ids.add(id);else ids.delete(id);
 try{if(ids.size)globalThis.sessionStorage?.setItem(recoveryKey,JSON.stringify([...ids]));else globalThis.sessionStorage?.removeItem(recoveryKey);}catch{}
}
function emit(){for(const fn of listeners)try{fn(getProjectAccess());}catch{/* one view cannot disable the access guard */}}
function persist(id,binding){
 const entries=registry(),subject=binding.subject||(entries[id]?.id===binding.id?entries[id]?.subject:null);
 entries[id]={id:binding.id,revision:binding.revision,...(subject?{subject}:{})};
 const serialized=JSON.stringify(entries);
 if(globalThis.localStorage.getItem(registryKey)!==serialized)globalThis.localStorage.setItem(registryKey,serialized);
}
function bindingFor(id){
 if(!id)return null;
 let binding=registry()[id];
 const legacy=read(globalThis.sessionStorage,linkKey);
 // The old global link can only be adopted by the document currently in the
 // open slot. Once adopted it carries an identity and cannot bleed on switches.
 if(!binding&&id===currentId()&&validBinding(legacy)&&(!legacy.localProjectId||legacy.localProjectId===id)){
  binding={id:legacy.id,revision:legacy.revision};
  try{persist(id,binding);globalThis.sessionStorage?.setItem(linkKey,JSON.stringify({...binding,localProjectId:id}));}catch{/* still locked in this session */}
 }
 return binding&&typeof binding==='object'?binding:null;
}
export function getProjectAccess(docOrId){
 ensureStorage();const id=localId(docOrId)||currentId(),binding=bindingFor(id);
 if(recoveryLocked(id))return {status:'unavailable',role:null,localProjectId:id,remoteProjectId:binding?.id||null,revision:binding?.revision||null};
 if(!binding)return {status:'local',role:'owner',localProjectId:id,remoteProjectId:null,revision:null};
 const live=states.get(id);
 if(live&&live.remoteProjectId===binding.id&&live.revision===binding.revision)return {...live};
 return {status:'checking',role:null,localProjectId:id,remoteProjectId:binding.id||null,revision:binding.revision||null,...(binding.subject?{subject:binding.subject}: {})};
}
export function subscribeProjectAccess(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
export function activateProjectAccess(doc){
 const access=doc?getProjectAccess(doc):null;
 try{if(access?.remoteProjectId)globalThis.sessionStorage?.setItem(linkKey,JSON.stringify({id:access.remoteProjectId,revision:access.revision,localProjectId:access.localProjectId}));
 else globalThis.sessionStorage?.removeItem(linkKey);}catch{}
 emit();return access;
}
export function bindProjectAccess(doc,{id,role,revision,subject,scopeVersion}){
 ensureStorage();const lid=localId(doc);
 if(!lid||!validBinding({id,revision})||!roles.has(role))throw Error('تعذّر التحقق من صلاحية المشروع على الخادم.');
 persist(lid,{id,revision,subject});requests.delete(lid);setRecoveryLock(lid,false);
 const access={status:'ready',role,localProjectId:lid,remoteProjectId:id,revision,...(subject?{subject,scopeVersion:scopeVersion||1}:{})};states.set(lid,access);
 if(lid===currentId())activateProjectAccess(doc);else emit();
 return {...access};
}
export async function refreshProjectAccess(doc){
 const access=getProjectAccess(doc),lid=access.localProjectId;
 if(recoveryLocked(lid))return access;
 if(!access.remoteProjectId){emit();return access;}
 const ticket={};requests.set(lid,ticket);
 if(access.status!=='ready'){states.set(lid,{...access,status:'checking',role:null});if(access.status!=='checking')emit();}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 let next;
 try{
  const response=await fetch('/api/projects?'+new URLSearchParams({id:access.remoteProjectId,action:'access'}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(!response.ok){next={...access,status:[401,403,404].includes(response.status)?'denied':'unavailable',role:null};}
  else{
   const data=await response.json();
   if(data.id!==access.remoteProjectId||!roles.has(data.role)||!ordinal(data.revision))throw Error('Invalid access response');
   // The server may have newer data. Access refresh must not advance the local
   // base revision: optimistic saves still refer to the snapshot actually open.
   if(access.subject&&data.subject!==access.subject)next={...access,status:'denied',role:null};
   else next={...access,status:'ready',role:data.role,...(data.subject?{subject:data.subject,scopeVersion:data.scopeVersion}:{})};
  }
 }catch{next={...access,status:'unavailable',role:null};}finally{clearTimeout(timer);}
 if(requests.get(lid)!==ticket)return getProjectAccess(doc);
 states.set(lid,next);requests.delete(lid);if(JSON.stringify(access)!==JSON.stringify(next))emit();return {...next};
}
const denied=(access,reason='لم تُتحقق صلاحية تعديل هذا المشروع. اتصل بالخادم وحدّث الوصول.')=>({ok:false,reason,code:'project-access',role:access.role});
export function validateProjectEdit(before,next){
 const access=getProjectAccess(before||next),target=getProjectAccess(next);
 if(isTrustedProjectInstall(next))return {ok:true,role:target.role};
 if(!['local','ready'].includes(access.status))return denied(access);
 if(!['local','ready'].includes(target.status))return denied(target);
 if(localId(before)&&localId(next)&&localId(before)!==localId(next)){
  if(!['owner','editor'].includes(access.role)||target.remoteProjectId)return denied(access,'افتح المشروع من المشاريع المحفوظة أو من الخادم قبل تعديله.');
 }
 if(JSON.stringify(before)===JSON.stringify(next))return {ok:true,role:access.role};
 if(access.role==='owner')return {ok:true,role:access.role};
 const verdict=authorizeProjectChange(access.role,{design:before},{design:next});
 return {...verdict,role:access.role};
}
// This synchronous closure is only entered by the authenticated cloud-open
// path. No bypass flag, role or permission is accepted from a project file.
export function persistTrustedProjectSnapshot(doc,save,rollback){
 if(!isTrustedProjectInstall(doc))return save();
 // Reserve the association before replacing the document. If metadata cannot
 // be stored, the old document remains intact; final binding reuses these bytes.
 try{persist(installing.id,installing.metadata);}catch{return false;}
 if(rollback)installing.rollbacks.push(rollback);
 return save();
}
export function withTrustedProjectInstall(doc,metadata,install){
 if(!localId(doc)||!validBinding(metadata)||!roles.has(metadata.role))throw Error('تعذّر التحقق من صلاحية النسخة المحفوظة.');
 ensureStorage();
 const store=globalThis.localStorage,session=globalThis.sessionStorage;
 const snapshots=[[store,projectKey],[session,'atlas-kitchen:undo:v1'],[session,'studio-kitchen:redo:v1'],[store,registryKey],[session,linkKey]].map(([storage,key])=>[storage,key,storage?.getItem(key)??null]);
 const priorStates=new Map(states),priorRequests=new Map(requests);
 const context={id:localId(doc),metadata,rollbacks:[]};let restored=false;
 const restore=()=>{
  if(restored)return;restored=true;let recovered=true;
  for(const [storage,key,value] of snapshots){
   try{if(storage?.getItem(key)!==value){if(value===null)storage?.removeItem(key);else storage?.setItem(key,value);}if(storage?.getItem(key)!==value)recovered=false;}catch{recovered=false;}
  }
  for(const rollback of context.rollbacks.reverse())try{rollback();}catch{recovered=false;}
  states.clear();for(const [key,value] of priorStates)states.set(key,value);
  requests.clear();for(const [key,value] of priorRequests)requests.set(key,value);
  if(!recovered){for(const id of [context.id,currentId()])if(id)setRecoveryLock(id,true);emit();}
 };
 const previous=installing;installing=context;
 try{
  const result=install();
  if(result?.then)throw Error('Snapshot installation must be synchronous.');
  if(result!==false&&result?.ok!==false&&result?.saved!==false)bindProjectAccess(doc,metadata);
  else restore();
  return result;
 }catch(error){restore();throw error;}finally{installing=previous;}
}
export const isTrustedProjectInstall=doc=>!!installing&&localId(doc)===installing.id;
globalThis.addEventListener?.('storage',event=>{
 if(event.key===registryKey||event.key===null){states.clear();requests.clear();emit();}
});
