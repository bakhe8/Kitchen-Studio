// Projects put aside so that starting or opening another one never overwrites the first. One browser entry per project, keyed by its
// project number. The open project stays under its own key and is not listed here.
import {normalizeWorkshopCatalogs} from './kitchen-catalog-records.js';
export const savedPrefix='atlas-kitchen:saved:';
export const noSpaceReason='مساحة التخزين في هذا المتصفح ممتلئة. نزّل ملف المشروع أو احذف مشروعًا محفوظًا ثم أعد المحاولة.';
const idOk=id=>typeof id==='string'&&/^K-[A-F0-9]{16}$/.test(id);
const storeOf=store=>store??globalThis.localStorage;
export function archiveProject(project,{store,now=Date.now}={}){
 if(project?.room?.workshop){
  const workshop=normalizeWorkshopCatalogs(project.room.workshop);
  if(!workshop)return {ok:false,reason:'تعذّر حفظ سجلات المشروع؛ البيانات غير صالحة.'};
  project={...project,room:{...project.room,workshop}};
 }
 const id=project?.room?.projectId;
 if(!idOk(id)||!project.kitchen)return {ok:false,reason:'تعذّر حفظ المشروع المفتوح لأنه بلا رقم مشروع صالح.'};
 try{
  storeOf(store).setItem(savedPrefix+id,JSON.stringify({v:1,id,name:String(project.room.name||'مشروع مطبخ').slice(0,64),savedAt:now(),project}));
 }catch{return {ok:false,reason:noSpaceReason};}
 return {ok:true,id};
}
function entryOf(s,k){
 try{
  const entry=JSON.parse(s.getItem(k));
  return entry?.v===1&&idOk(entry.id)&&k===savedPrefix+entry.id&&entry.project?.room&&entry.project.kitchen?entry:null;
 }catch{return null;}
}
export function listSavedProjects({store,exceptId=null}={}){
 const s=storeOf(store),out=[];
 try{
  for(let i=0;i<s.length;i++){
   const k=s.key(i);if(!k?.startsWith(savedPrefix))continue;
   const entry=entryOf(s,k);if(!entry||entry.id===exceptId)continue;
   const chains=entry.project.room.workshop?.chains;
   out.push({id:entry.id,name:String(entry.name||entry.project.room.name||'مشروع مطبخ'),savedAt:Number(entry.savedAt)||0,
    units:Array.isArray(entry.project.kitchen.units)?entry.project.kitchen.units.length:0,
    surveyedWalls:chains&&typeof chains==='object'?Object.values(chains).filter(c=>c?.rows?.length).length:0});
  }
 }catch{/* a store that cannot be listed has no saved projects to show */}
 return out.sort((a,b)=>b.savedAt-a.savedAt);
}
export function readSavedProject(id,{store}={}){
 const entry=idOk(id)?entryOf(storeOf(store),savedPrefix+id):null;
 return entry?{ok:true,project:entry.project,entry}:{ok:false,reason:'تعذّر قراءة هذا المشروع المحفوظ. لم يتغيّر أي شيء.'};
}
export function removeSavedProject(id,{store}={}){
 if(!idOk(id))return false;
 try{storeOf(store).removeItem(savedPrefix+id);return true;}catch{return false;}
}
export const savedProjectIds=({store}={})=>listSavedProjects({store}).map(p=>p.id);
