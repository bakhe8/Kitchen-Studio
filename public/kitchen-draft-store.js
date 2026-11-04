// Work that is typed but not saved yet (a wall's readings, a design that was not applied) is kept here as it changes, so a reload,
// a closed tab or a phone call does not take it away. One record per kind of work and per project; saving for real removes it.
const prefix='atlas-kitchen:draft:',limit=600000;
const projectOk=id=>typeof id==='string'&&/^K-[A-F0-9]{16}$/.test(id);
const kindOk=kind=>typeof kind==='string'&&/^[a-z][a-z-]{0,23}$/.test(kind);
const keyFor=(kind,id)=>prefix+kind+':'+id;
const storeOf=store=>store??globalThis.localStorage;
export function writeDraft(kind,projectId,payload,store){
 if(!kindOk(kind)||!projectOk(projectId))return false;
 try{
  const raw=JSON.stringify({v:1,kind,projectId,savedAt:Date.now(),payload});
  if(raw.length>limit)return false;
  storeOf(store).setItem(keyFor(kind,projectId),raw);return true;
 }catch{return false;}
}
export function readDraft(kind,projectId,store){
 if(!kindOk(kind)||!projectOk(projectId))return null;
 try{
  const raw=storeOf(store).getItem(keyFor(kind,projectId));if(!raw)return null;
  const record=JSON.parse(raw);
  return record?.v===1&&record.kind===kind&&record.projectId===projectId&&record.payload&&typeof record.payload==='object'?record:null;
 }catch{return null;}
}
export function clearDraft(kind,projectId,store){
 if(!kindOk(kind)||!projectOk(projectId))return;
 try{storeOf(store).removeItem(keyFor(kind,projectId));}catch{/* nothing stored, nothing to remove */}
}
function draftKeys(s){const out=[];for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith(prefix))out.push(k);}return out;}
export function clearProjectDrafts(projectId,store){
 if(!projectOk(projectId))return;
 try{const s=storeOf(store);for(const k of draftKeys(s))if(k.endsWith(':'+projectId))s.removeItem(k);}catch{/* a store that cannot be listed keeps its drafts */}
}
// Drafts of a project that is neither open nor saved belong to nobody; drop them so they never fill the browser's space.
export function pruneDrafts(knownIds,store){
 const known=new Set(knownIds);
 try{const s=storeOf(store);for(const k of draftKeys(s)){if(!known.has(k.slice(k.lastIndexOf(':')+1)))s.removeItem(k);}}catch{/* a store that cannot be listed keeps its drafts */}
}
