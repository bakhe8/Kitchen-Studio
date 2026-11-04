// Whether this page holds work that is not saved yet, so leaving it says so instead of losing the work quietly.
// A screen that keeps edits only in memory registers while it is open: `flush` writes what it has to the draft store right now, and
// `atRisk` says whether anything would still be lost. The page flushes, then asks, whenever it is about to be closed, reloaded or switched.
const probes=new Set(),flushes=new Set();
export const leaveWarning='لديك عملًا لم يُحفظ بعد. إذا غادرت الصفحة الآن فقد يضيع.';
export function registerUnsavedWork({atRisk,flush}={}){
 if(typeof atRisk==='function')probes.add(atRisk);
 if(typeof flush==='function')flushes.add(flush);
 return ()=>{probes.delete(atRisk);flushes.delete(flush);};
}
export function flushUnsavedWork(){
 for(const flush of flushes){try{flush();}catch{/* one screen failing to write must not stop the others */}}
}
export function hasUnsavedWork(){
 for(const probe of probes){try{if(probe())return true;}catch{/* a broken probe must never trap the user on the page */}}
 return false;
}
export function warnBeforeLeaving(target=globalThis.window){
 if(typeof target?.addEventListener!=='function')return ()=>{};
 const handler=event=>{
  flushUnsavedWork();
  if(!hasUnsavedWork())return undefined;
  event.preventDefault();event.returnValue=leaveWarning;
  return leaveWarning;
 };
 target.addEventListener('beforeunload',handler);
 return ()=>target.removeEventListener('beforeunload',handler);
}
