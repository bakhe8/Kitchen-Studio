import {newKitchenReference,identifiedProject,identifiedHistoryFrame} from './kitchen-project-identity.js';
import {installedFitout} from './kitchen-fitout-visual.js';
import {cleanWorkshop} from './kitchen-workshop-state.js';
import {normalizeWorkshopCatalogs,reconcileWorkshopCatalogs} from './kitchen-catalog-records.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {getProjectAccess,validateProjectEdit,isTrustedProjectInstall,persistTrustedProjectSnapshot,activateProjectAccess} from './kitchen-project-access.js';
import {cleanProjectDefaults,newProjectDefaultRoom} from './kitchen-defaults-model.js';
import {cleanFieldRegister} from './kitchen-field-model.js';
import {archiveProject,readSavedProject} from './kitchen-project-library.js';
// The kitchen is a separate design made in the saved room. Editing cabinet
// interiors must not change the original shelf project on the same site.
import {validatePlan,createShelfPlan,applyPreset,cabMinimum} from './shelf-model.js';
import {checkSitePoints} from './kitchen-site-survey-model.js';
import {resolveChain,sameSurveyReading} from './kitchen-chain-model.js';
import {validateKitchenRoomArchitecture} from './kitchen-architecture.js';
import {frontAppearanceSource} from './kitchen-render-factory-fronts.js';
import {cleanStudioRoom,readWallPhotos,validRoomCladding,purgeOrphanPhotos} from './kitchen-studio-room.js';
import {getRoom,roomWallData,roomWallIds} from './shelf-room-model.js';
import {createKitchen,validateKitchen,updateUnit,kitchenGeometry,validateKitchenChange,validateSurveyFeatureChange,kitchenUnitSpecs} from './kitchen-model.js';
import {withDesignerReturn} from './kitchen-designer-navigation.js';
const shelfKey='atlas-shelves:plan:v1',key='atlas-kitchen:project:v1',historyKey='atlas-kitchen:undo:v1',artKey='atlas-shelves:wall-image:v1';
const read=(s,k)=>{try{const v=s.getItem(k);return v?JSON.parse(v):null;}catch{return null;}};
const write=(s,k,v)=>{try{s.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
export const kitchenProjectURL=(view='kitchen',unit=null,pose=null,designerOrigin=null)=>{const u=new URL(location.href);u.pathname=view==='kitchen-unit'?'/unit.html':'/';u.searchParams.set('view',view);if(unit)u.searchParams.set('unit',unit);else u.searchParams.delete('unit');
 if(pose){u.searchParams.set('space',pose.view==='top'?'top':'volume');for(const k of ['yaw','pitch'])if(Number.isFinite(pose[k]))u.searchParams.set(k,String(pose[k]));}
 u.hash='';return view==='kitchen-unit'?withDesignerReturn(u.href,designerOrigin):u.href;};
export function savedRoom(store=localStorage){const s=validatePlan(read(store,shelfKey))||createShelfPlan(),r=getRoom(s);return {width:r.width,length:r.length,height:r.height,colors:Object.fromEntries(roomWallIds.map(id=>[id,roomWallData(s,id)?.color||'sand']))};}
const roomOK=r=>r&&[r.width,r.length].every(v=>Number.isFinite(v)&&v>=60&&v<=1200)&&Number.isFinite(r.height)&&r.height>=60&&r.height<=600;
export function scenePlan(r,kitchen){const fitout=installedFitout(r,kitchen);const p=createShelfPlan(),colors=r.colors||{},layers={};
  for(const id of Object.keys(colors))if(id!=='back'&&['sand','sage','stone'].includes(colors[id]))layers[id]={color:colors[id],grid:null};
  const source=r.workshop,frontAppearance=frontAppearanceSource(source),cs=readWorkshopCatalog(source),parts=cs&&Object.values(cs.families||{}).some(f=>f.finishSlots);
 // Only transfer fields used to build and colour the visible scene. The
 // project's customer records and commercial terms stay in the document.
 const visualWorkshop=source&&(source.corners||source.options||parts)?{
   ...(source.corners?{corners:source.corners}:{}),...(source.options?{options:source.options}:{}),
   ...(parts?{rows:source.rows,chains:source.chains,finishes:source.finishes}:source.finishes?.cornerFronts?{finishes:{cornerFronts:source.finishes.cornerFronts}}:{}),
   ...(cs&&(cs.cornerRecipes||cs.wallAccessories||cs.linearKits||parts)?{catalog:{cornerRecipes:cs.cornerRecipes,wallAccessories:cs.wallAccessories,linearKits:cs.linearKits,...(parts?{families:cs.families}:{}),
     items:(cs.items||[]).map(i=>({sku:i.sku,kind:i.kind,thicknessMm:i.thicknessMm,colorHex:i.colorHex,color:i.color,stockLengthMm:i.stockLengthMm,kerfMm:i.kerfMm,
      ...(parts?{sectionWidthMm:i.sectionWidthMm,gaugeMm:i.gaugeMm,grooveWidthMm:i.grooveWidthMm,grooveDepthMm:i.grooveDepthMm,massKgM2:i.massKgM2}:{})}))}}:{})}:null;
  return {...p,wall:{w:r.width,h:r.height},wallColor:['sand','sage','stone'].includes(colors.back)?colors.back:'sand',kitchenSurfaces:{floor:r.floor||'wood',backsplash:r.backsplash||{finish:'tile',height:56}},room:{...(fitout?{fitout}:{}),...(frontAppearance?{frontAppearance}:{}),...(visualWorkshop?{workshop:visualWorkshop}:{}),width:r.width,length:r.length,height:r.height,attachedWall:'back',layers,colors:r.colors||{},...(r.cladding?{cladding:r.cladding}:{}),...(r.photoRefs?{photoRefs:r.photoRefs}:{}),...(r.architecture?{architecture:r.architecture}:{}),...(r.sitePoints?{sitePoints:r.sitePoints}:{})}};
}
export const getKitchenPhotos=readWallPhotos;
function checkedProject(raw){
 const room=raw&&roomOK(raw.room)?cleanStudioRoom(raw.room):null;
 if(!room)return null;
 const kitchen=validateKitchen(raw.kitchen,scenePlan(room));
 return kitchen?{room,kitchen}:null;
}
// The same checks for a project that is not in the open slot (an entry of the saved-projects library).
export const validatedProject=checkedProject;
export function storedKitchenProject(store=localStorage){return checkedProject(read(store,key));}
export function hasKitchenSource(store=localStorage){
 return !!(storedKitchenProject(store)||validatePlan(read(store,shelfKey)));
}
export function newSurveyProject({widthMm,lengthMm,heightMm,name},store=localStorage){
 if(![widthMm,lengthMm,heightMm].every(Number.isInteger))return null;
 const room={projectId:newKitchenReference(),width:widthMm/10,length:lengthMm/10,height:heightMm/10,name:(name||'').trim().slice(0,64)||'مشروع مطبخ',colors:{}};
 if(!roomOK(room))return null;
 return {room:newProjectDefaultRoom(room,store),kitchen:createKitchen(room,'empty')};
}
export function restoreProject(store=localStorage){
 const saved=storedKitchenProject(store);if(saved)return saved;
 if(!validatePlan(read(store,shelfKey))){
  // A neutral working document is needed for standalone catalog tools. The
  // public entry collects actual dimensions before mounting the drawing.
  return newSurveyProject({widthMm:4000,lengthMm:4000,heightMm:2800,name:'إعداد الكتالوج'},store);
 }
 const room=newProjectDefaultRoom(savedRoom(store),store);
 return {room,kitchen:createKitchen(room,'empty')};
}
// Used by both full editors. Persist identity without normalising the stored
// document or creating a history item merely for opening an older project.
// The editor's document comes from here; remember which stored text it was read from so a later save can tell whether another window changed it first.
export function openKitchenProject(store=localStorage){
 const doc=openStoredProject(store);
 try{if(store===globalThis.localStorage)loadedText=store.getItem(key)??'';}catch{/* without storage there is nothing to compare */}
 if(store===globalThis.localStorage)activateProjectAccess(doc);
 return doc;
}
function openStoredProject(store){
 const data=read(store,key),doc=restoreProject(store);
 if(data?.room){
   const identified=identifiedProject(doc);
   if(identified!==doc)write(store,key,{...data,room:{...data.room,projectId:identified.room.projectId}});
   return identified;
 }
 if(validatePlan(read(store,shelfKey)))return identifiedProject(doc);
 // Opening the catalog alone must not create a kitchen and bypass visit intake.
 const pendingId=read(store,'studio-kitchen:empty-reference:v1');
 const projectId=/^K-[A-F0-9]{16}$/.test(pendingId)?pendingId:doc.room.projectId;
 if(projectId!==pendingId)write(store,'studio-kitchen:empty-reference:v1',projectId);
 return {...doc,room:{...doc.room,projectId}};
}
export function kitchenHistory(){const h=read(sessionStorage,historyKey);return Array.isArray(h)?h:[];}
const redoKey='studio-kitchen:redo:v1';
export const kitchenFuture=()=>{const a=read(sessionStorage,redoKey);return Array.isArray(a)?a:[];};
const saveFuture=h=>{for(let n=Math.min(h.length,25);n>=0;n--){if(write(sessionStorage,redoKey,n?h.slice(-n):[]))return;}};
const saveHistory=h=>{for(let n=Math.min(25,h.length);n>=0;n--){if(write(sessionStorage,historyKey,n?h.slice(-n):[]))return;}};
// The stored project is replaced whole on every save. A value this version cannot read (a validator tightened since it was written, or one bad
// record) used to be overwritten without a trace; it is now kept under a dated key first. Only the newest three copies are kept.
const unreadablePrefix=key+':unreadable:',unreadableKept=3;
let confirmedText=null,unreadableSeq=0; // confirmedText: the exact stored text this page has already checked or written itself
// Two windows on one project used to overwrite each other silently (the last writer won, taking prices and approvals with it).
// loadedText is the stored text the open document came from, or the last text this page wrote; null until the page has opened a project.
let loadedText=null;
// The saved text the open document stands on. It does not change across a reload, unlike the document object, so work that is built on
// the project (a design that was calculated but not applied) can tell whether the project moved underneath it.
export const savedProjectText=()=>loadedText;
// Undo and redo belong to the project that was open; another project must never inherit them.
export function forgetProjectHistory(){
 saveHistory([]);saveFuture([]);
 try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith('atlas-kitchen:unit-draft:'))sessionStorage.removeItem(k);}}catch{/* no session storage, no leftovers */}
}
// Leave the open project. It must already be safe elsewhere (the saved-projects library) before this is called.
export function releaseActiveProject(store=localStorage){
 try{store.removeItem(key);}catch{return false;}
 loadedText=null;confirmedText=null;forgetProjectHistory();activateProjectAccess(null);return true;
}
// Replacing the open project by a different one (an opened file, a cloud project) must not be its end: it is put aside first.
export function setAsideBeforeReplace(old,next){
 const a=old?.room?.projectId,b=next?.room?.projectId;
 if(!a||!b||a===b||!storedKitchenProject())return {ok:true};
 return archiveProject(old);
}
export const staleProjectMessage='تغيّر المشروع في نافذة أخرى منذ فتحه هنا. حدّث الصفحة لاستعادة آخر نسخة؛ لم يُحفظ هذا التعديل حتى لا تُمحى تعديلات النافذة الأخرى.';
export function projectChangedElsewhere(store=localStorage){
 if(loadedText===null)return false;
 try{return (store.getItem(key)??'')!==loadedText;}catch{return false;}
}
export function watchProjectChanges(callback){
 // The browser fires "storage" only in the OTHER windows of the origin, so an event on the project key is a change made elsewhere.
 const handler=e=>{if((e.key===key||e.key===null)&&projectChangedElsewhere())callback(staleProjectMessage);};
 globalThis.addEventListener?.('storage',handler);
 return ()=>globalThis.removeEventListener?.('storage',handler);
}
export function unreadableProjectBackups(store=localStorage){
 const out=[];
 try{for(let i=0;i<store.length;i++){const k=store.key(i);if(k?.startsWith(unreadablePrefix)){const v=store.getItem(k);out.push({key:k,stamp:k.slice(unreadablePrefix.length),chars:v?v.length:0});}}}catch{/* a store without enumeration has no copies to list */}
 return out.sort((a,b)=>a.stamp<b.stamp?-1:1);
}
function keepUnreadable(store){
 let raw;try{raw=store.getItem(key);}catch{return;}
 if(!raw||raw===confirmedText)return;
 if(!storedKitchenProject(store)){
  try{
   const old=unreadableProjectBackups(store);
   for(const b of old.slice(0,Math.max(0,old.length-(unreadableKept-1))))store.removeItem(b.key);
   store.setItem(unreadablePrefix+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+String(unreadableSeq++%1000).padStart(3,'0'),raw);
  }catch{/* A full store must not stop the save the user asked for; the old text is then lost exactly as before. */}
 }
 confirmedText=raw;
}
function persistProject(next){
 if(next.room?.workshop){
  const workshop=normalizeWorkshopCatalogs(next.room.workshop);if(!workshop)return false;
  next={...next,room:{...next.room,workshop}};
 }
 keepUnreadable(localStorage);
 let ok=write(localStorage,key,next);
 if(!ok&&purgeOrphanPhotos()>0)ok=write(localStorage,key,next); // a full store: drop previews nothing refers to, then try once more
 try{confirmedText=ok?localStorage.getItem(key):null;}catch{confirmedText=null;}
 if(ok)loadedText=confirmedText;
 return ok;
}
export function saveProject(next){
 if(!isTrustedProjectInstall(next)&&!validateProjectEdit(storedKitchenProject(),next).ok)return false;
 const previousLoaded=loadedText,previousConfirmed=confirmedText;
 return persistTrustedProjectSnapshot(next,()=>persistProject(next),()=>{loadedText=previousLoaded;confirmedText=previousConfirmed;});
}
// Open the exact snapshot already held by the saved-project library. This is a
// project switch, not an edit; its existing access binding remains in force.
export function restoreSavedProjectSnapshot(id,{store}={}){
 const read=readSavedProject(id,{store});if(!read.ok)return false;
 const clean=checkedProject(read.project);if(!clean)return false;
 const saved=persistProject(clean);if(saved)activateProjectAccess(clean);return saved;
}
// A measured opening is authoritative only for the dimensions actually
// recorded in its current wall chain. A CAD change to a unit or the room must
// still pass the ordinary placement guard, even if that wall has a survey.
export function validateProjectPlacement(old,next,{restoreArchive=false}={}){
 const check=validateKitchenChange(old.kitchen,old.room,next.kitchen,next.room);
 if(check.ok||check.constraint!=='hard-placement')return check;
 const previous=old.room.workshop?.chains,chains=next.room.workshop?.chains;
 if(!chains||!restoreArchive&&chains===previous)return check;
 if(!restoreArchive&&old.room.sitePoints!==next.room.sitePoints&&
    JSON.stringify(old.room.sitePoints)!==JSON.stringify(next.room.sitePoints))return check;
 const current=new Map(next.kitchen.features.map(f=>[f.id,f]));
 const prior=new Map(old.kitchen.features.map(f=>[f.id,f]));
 const measured=[];
 for(const [wall,chain] of Object.entries(chains)){
  if(!restoreArchive&&chain===previous?.[wall])continue;
  const result=resolveChain(next.room,wall,chain);
  if(!result.ok||!result.features.every(f=>sameSurveyReading(f,current.get(f.id))))continue;
  for(const f of result.features)if(restoreArchive||!sameSurveyReading(f,prior.get(f.id)))measured.push(f.id);
 }
 if(!measured.length)return check;
 return validateSurveyFeatureChange(old.kitchen,old.room,next.kitchen,next.room,measured,{restoreArchive});
}
export function commitProject(old,next,options){
 if(old.room?.projectId&&!next.room?.projectId)next=identifiedProject(next,{current:old});
 if(JSON.stringify(old)===JSON.stringify(next))return {ok:true,changed:false,saved:true};
 if(projectChangedElsewhere())return {ok:false,changed:false,saved:false,reason:staleProjectMessage,code:'stale-project'};
 if(next.room?.workshop){
  const reconciled=reconcileWorkshopCatalogs(next.room.workshop,old.room?.workshop);
  const workshop=reconciled&&cleanWorkshop(reconciled);
  if(!workshop)return {ok:false,changed:false,saved:false,reason:'راجع سجلات المتجر والمصنع والتسعير؛ لم يُحفظ التعديل.'};
  next={...next,room:{...next.room,workshop}};
 }
 const access=validateProjectEdit(old,next);if(!access.ok)return {...access,changed:false,saved:false};
 if(!validRoomCladding(next.room?.cladding,next.room?.height))return {ok:false,changed:false,saved:false,reason:'راجع ارتفاع تبليط الجدران ومقاس البلاطة؛ لا يمكن أن يتجاوز التبليط ارتفاع الغرفة.'};
 const validRoom=validateKitchenRoomArchitecture(next.room),points=validRoom.ok?checkSitePoints(next.room):validRoom;if(!points.ok)return {ok:false,changed:false,saved:false,reason:points.reason};
 const check=validateProjectPlacement(old,next,options);
 if(!check.ok)return {ok:false,changed:false,saved:false,reason:check.reason,code:check.code,conflict:check.conflict};
 const changedDefaults=old.room?.defaults!==next.room?.defaults&&JSON.stringify(old.room?.defaults)!==JSON.stringify(next.room?.defaults);
 if(changedDefaults&&next.room?.defaults!=null&&!cleanProjectDefaults(next.room.defaults))return {ok:false,changed:false,saved:false,reason:'قالب المشروع غير صالح ولم يُطبّق.'};
 const changedRegister=old.room?.fieldRegister!==next.room?.fieldRegister&&JSON.stringify(old.room?.fieldRegister)!==JSON.stringify(next.room?.fieldRegister);
 if(changedRegister&&next.room?.fieldRegister!=null&&!cleanFieldRegister(next.room.fieldRegister))return {ok:false,changed:false,saved:false,reason:'سجل الفني غير صالح؛ لم يُستبدل السجل المحفوظ.'};
 const workshopEdited=old.room?.workshop!==next.room?.workshop&&JSON.stringify(old.room?.workshop)!==JSON.stringify(next.room?.workshop);
 if(workshopEdited&&next.room?.workshop!=null&&!cleanWorkshop(next.room.workshop))return {ok:false,changed:false,saved:false,reason:'راجع بيانات رفع الجدار أو كتالوج المصنع. لم يحفظ التعديل.'};
 const aside=setAsideBeforeReplace(old,next);if(!aside.ok)return {ok:false,changed:false,saved:false,reason:aside.reason,code:'archive-failed'};
 const saved=saveProject(next);if(!saved&&(workshopEdited||next.room?.workshop))return {ok:false,changed:false,saved:false,reason:'تعذّر حفظ مشروع التفصيل في المتصفح. احتفظ بنسخة من المشروع.'};if(!saved&&changedDefaults)return {ok:false,changed:false,saved:false,reason:'تعذّر حفظ افتراضيات المشروع؛ بقيت القيم السابقة كما هي.'};if(!saved&&changedRegister)return {ok:false,changed:false,saved:false,reason:'تعذّر حفظ سجل الفني في هذا المتصفح. بقيت البيانات السابقة كما هي.'};saveHistory([...kitchenHistory(),old]);saveFuture([]);return {ok:true,changed:true,saved,next};
}
export function undoProject(current=restoreProject()){if(projectChangedElsewhere())return null;const h=kitchenHistory();while(h.length){let last=checkedProject(h.pop());if(last){last=identifiedHistoryFrame(last,current);if(!validateProjectEdit(current,last).ok)return null;const aside=setAsideBeforeReplace(current,last);if(!aside.ok)return null;const saved=saveProject(last);if(!saved&&(current.room?.workshop||JSON.stringify(current.room?.fieldRegister)!==JSON.stringify(last.room?.fieldRegister)||JSON.stringify(current.room?.defaults)!==JSON.stringify(last.room?.defaults)))return null;saveHistory(h);saveFuture([...kitchenFuture(),current]);activateProjectAccess(last);return {next:last,saved};}}saveHistory([]);return null;}
const recipeCuts=(length,count)=>{const c=Math.min(11,Math.max(0,Math.floor(Number(count)||0)),Math.max(0,Math.floor((length-2)/16)-1));const gap=(length-4-c*2)/(c+1);return Array.from({length:c},(_,i)=>(2+(i+1)*gap+i*2+1)/length);};
export function shapeForUnit(unit,geom){
 const w=unit.width,h=geom.height,d=geom.depth;
 const xb=8,yb=8,wall={w:Math.max(60,w+2*xb),h:Math.max(60,h+2*yb)};
 const prior=unit.detail&&validatePlan(unit.detail);
 if(![w,h,d].every(Number.isFinite)||w<18||h<18||d<5||d>150)return null;
 let result=prior?{...prior}:applyPreset(createShelfPlan(),'empty');
 if(!prior){
   result.cols=recipeCuts(w,unit.interior?.dividers);result.rows=recipeCuts(h,unit.interior?.shelves);
   result.cells=Object.fromEntries(Array.from({length:result.cols.length+1},(_,x)=>Array.from({length:result.rows.length+1},(_,y)=>[x+':'+y,'empty'])).flat());result.selectedCell='0:0';
 }
 const m=cabMinimum(result);if(m.w>w+.0001||m.h>h+.0001)return null;
 result={...result,wall,cab:{w,h,x:xb,y:yb},depth:d};delete result.room;delete result.sizedObject;
 if(result.version===2)result={...result,wallGrid:null,selection:{kind:'cabinet'}};
 return validatePlan(result);
}
export function openUnitContext(id){
 const project=openKitchenProject(),where=scenePlan(project.room),u=project.kitchen.units.find(v=>v.id===id),g=kitchenGeometry(project.kitchen,where).units.find(v=>v.id===id);
 const access=getProjectAccess(project);if(!['local','ready'].includes(access.status)||!['owner','editor','rep'].includes(access.role))return null;
 if(!u||!g||!kitchenUnitSpecs[u.kind]?.editableInterior)return null;
 const plan=shapeForUnit(u,g);if(!plan)return null;
 const dfKey='atlas-kitchen:unit-draft:'+id,stamp=JSON.stringify([u,g.height,g.depth]),draft=read(sessionStorage,dfKey),valid=draft?.stamp===stamp?validatePlan(draft.plan):null;
 const cleanup=()=>{try{sessionStorage.removeItem(dfKey);}catch{}};
 return {unit:u,plan:valid||plan,writeDraft:p=>{const a=getProjectAccess(project);return ['local','ready'].includes(a.status)&&['owner','editor','rep'].includes(a.role)&&write(sessionStorage,dfKey,{stamp,plan:p});},cancel:()=>{cleanup();location.assign(kitchenProjectURL('kitchen',id));},save(p){
   const now=openKitchenProject(),rp=scenePlan(now.room),live=now.kitchen.units.find(v=>v.id===id),gg=kitchenGeometry(now.kitchen,rp).units.find(v=>v.id===id);
   if(!live||!gg||JSON.stringify([live,gg.height,gg.depth])!==stamp)return 'تغيّرت الوحدة منذ فتح محررها. ارجع إلى المطبخ وافتح النسخة الحالية.';
   const r=updateUnit(now.kitchen,rp,id,{detail:p});if(!r.ok)return r.reason||'تعذّر حفظ تقسيم الوحدة.';
   const commit=commitProject(now,{...now,kitchen:r.kitchen});if(!commit.ok)return commit.reason;
   if(!commit.saved)return 'لم تتوفر مساحة للحفظ في المتصفح. بقيت المسودة مفتوحة.';
   cleanup();location.assign(kitchenProjectURL('kitchen',id));return '';
 }};
}

export function redoProject(current=restoreProject()){if(projectChangedElsewhere())return null;const h=kitchenFuture();while(h.length){let next=checkedProject(h.pop());if(next){next=identifiedHistoryFrame(next,current);if(!validateProjectEdit(current,next).ok)return null;const aside=setAsideBeforeReplace(current,next);if(!aside.ok)return null;const saved=saveProject(next);if(!saved&&(current.room?.workshop||JSON.stringify(current.room?.fieldRegister)!==JSON.stringify(next.room?.fieldRegister)||JSON.stringify(current.room?.defaults)!==JSON.stringify(next.room?.defaults)))return null;saveFuture(h);saveHistory([...kitchenHistory(),current]);activateProjectAccess(next);return {next,saved};}}saveFuture([]);return null;}
