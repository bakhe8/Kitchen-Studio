// Starting a new project, opening a saved one, deleting one. Whatever is open is put into the saved-projects library before anything
// replaces it, and a project that cannot be put aside is never replaced.
import {restoreSavedProjectSnapshot,storedKitchenProject,validatedProject,releaseActiveProject,forgetProjectHistory,projectChangedElsewhere,staleProjectMessage} from './kitchen-project.js';
import {archiveProject,readSavedProject,removeSavedProject,savedProjectIds} from './kitchen-project-library.js';
import {clearProjectDrafts,pruneDrafts} from './kitchen-draft-store.js';
import {flushUnsavedWork,hasUnsavedWork} from './kitchen-unsaved-work.js';
const visitKey='atlas-kitchen:new-visit:v1',noticeKey='atlas-kitchen:switch-notice:v1';
const storeOf=store=>store??globalThis.localStorage;
// A saved shelf plan can make the app believe a project exists even after the open one was put aside; this asks for the intake form anyway.
export const newVisitRequested=store=>{try{return storeOf(store).getItem(visitKey)==='1';}catch{return false;}};
export const clearNewVisitRequest=store=>{try{storeOf(store).removeItem(visitKey);}catch{/* nothing to clear */}};
const leaveNotice=(s,text)=>{try{s.setItem(noticeKey,text);}catch{/* the notice is a courtesy */}};
export function takeSwitchNotice(store){
 const s=storeOf(store);
 try{const text=s.getItem(noticeKey)||'';if(text)s.removeItem(noticeKey);return text;}catch{return '';}
}
// The page to show after a switch: the app's front page, with no stage or panel left over from the previous project.
export function projectHomeURL(){const u=new URL(globalThis.location.href);u.search='';u.hash='';return u.href;}

export function startNewProject(doc,{store}={}){
 const s=storeOf(store);
 if(projectChangedElsewhere())return {ok:false,reason:staleProjectMessage};
 if(storedKitchenProject(s)){const kept=archiveProject(doc,{store:s});if(!kept.ok)return kept;}
 if(!releaseActiveProject(s))return {ok:false,reason:'تعذّر إغلاق المشروع المفتوح في هذا المتصفح. لم يتغيّر أي شيء.'};
 try{s.setItem(visitKey,'1');}catch{/* the project itself is already safe; the flag only matters when a shelf plan is stored */}
 leaveNotice(s,'حُفظ مشروع «'+(doc.room.name||'مطبخي')+'» في مشاريعك المحفوظة. ابدأ مشروعًا جديدًا أو افتح أحد المشاريع المحفوظة.');
 return {ok:true};
}

export function openSavedProject(id,{current=null,store}={}){
 const s=storeOf(store),read=readSavedProject(id,{store:s});
 if(!read.ok)return read;
 if(!validatedProject(read.project))return {ok:false,reason:'تعذّر قراءة هذا المشروع المحفوظ. لم يتغيّر أي شيء.'};
 if(current&&projectChangedElsewhere())return {ok:false,reason:staleProjectMessage};
 if(current&&current.room?.projectId!==id&&storedKitchenProject(s)){const kept=archiveProject(current,{store:s});if(!kept.ok)return kept;}
 if(!restoreSavedProjectSnapshot(id,{store:s}))return {ok:false,reason:'تعذّر حفظ المشروع في هذا المتصفح. لم يتغيّر أي شيء.'};
 removeSavedProject(id,{store:s});forgetProjectHistory();clearNewVisitRequest(s);
 return {ok:true,name:read.entry.name};
}

// What a button does: keep unsaved work first, switch, then show the front page. Work that could not be kept stops the switch
// (the project itself is never touched).
const midWork=()=>{
 flushUnsavedWork();
 return hasUnsavedWork()?{ok:false,reason:'لديك عمل لم يُحفظ في هذا المشروع. احفظه أو أغلق الشاشة المفتوحة ثم أعد المحاولة.'}:null;
};
export function newProjectNow(doc,{store}={}){
 const stop=midWork();if(stop)return stop;
 const result=startNewProject(doc,{store});
 if(result.ok)globalThis.location.assign(projectHomeURL());
 return result;
}
export function openSavedNow(id,{current=null,store}={}){
 const stop=midWork();if(stop)return stop;
 const result=openSavedProject(id,{current,store});
 if(result.ok)globalThis.location.assign(projectHomeURL());
 return result;
}

export function deleteSavedProject(id,{store}={}){
 const s=storeOf(store);
 if(!removeSavedProject(id,{store:s}))return {ok:false,reason:'تعذّر حذف المشروع المحفوظ.'};
 clearProjectDrafts(id,s);return {ok:true};
}

// Unsaved-work records of a project that is neither open nor saved belong to nobody.
export function pruneOrphanDrafts({store,openId=null}={}){
 const s=storeOf(store);
 pruneDrafts([...savedProjectIds({store:s}),storedKitchenProject(s)?.room?.projectId,openId].filter(Boolean),s);
}
