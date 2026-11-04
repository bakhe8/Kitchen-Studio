// A one-use, tab-local presentation address for a full-page interior visit.
// The saved kitchen and the unit editor continue to own all project data.
const key='atlas-kitchen:designer-return:v1';
export function withDesignerReturn(href,origin){
 const url=new URL(href);url.searchParams.delete('designerReturn');
 if(!origin?.projectId||!origin.unitId||origin.unitId!==url.searchParams.get('unit'))return url.href;
 const {projectId,unitId,runId,proposalView,yaw,frameUnits,camera,views,opener}=origin;
 try{
  const token=crypto.randomUUID();
  sessionStorage.setItem(key,JSON.stringify({token,focus:{projectId,unitId,runId,proposalView,yaw,frameUnits,camera,views,opener}}));
  url.searchParams.set('designerReturn',token);url.searchParams.set('panel','workshop');url.searchParams.set('step','whole');
 }catch{/* Normal interior navigation still works when tab storage is unavailable. */}
 return url.href;
}
export function consumeDesignerReturn(doc,params){
 const token=params?.get('designerReturn');if(!token)return null;
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved?.token!==token)return null;
  sessionStorage.removeItem(key);const focus=saved.focus;
  return focus?.projectId===doc.room.projectId&&focus.unitId===params.get('unit')&&doc.kitchen.units.some(u=>u.id===focus.unitId&&u.runId===focus.runId)?focus:null;
 }catch{return null;}
}
