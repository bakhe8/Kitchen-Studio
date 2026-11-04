import {studioIcon as ico} from './kitchen-tool-icons.js';
import {workshopPartTarget} from './kitchen-sheet-target.js';
import {cadAdditionIssue} from './kitchen-design-site.js';
import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {stageCommands} from './kitchen-stage-commands.js';
import {identifiedProject,outputStamp,stampColumns} from './kitchen-output-stamp.js';
import {pruneBaseSupportChoices} from './kitchen-base-support.js';
import {mountWorkshop,workshopRoute} from './kitchen-workshop-ui.js';
import {mountFieldRegister} from './kitchen-field-ui.js';
import {fieldAttachmentStore} from './kitchen-field-files.js';
import {mountRoomSurvey} from './kitchen-room-survey.js';
import {architectureWallLabel,architectureWall} from './kitchen-architecture.js';
import {mountStudioPanels,downloadFieldProject} from './kitchen-studio-panels.js';
import {mountKitchenPhoto} from './kitchen-photo.js';
import {textureMap} from './kitchen-studio-room.js';
import {mountKitchenIdeas} from './kitchen-ideas.js';
import {mountPlacementReview} from './kitchen-placement-review.js';
import {readKitchenViewport,rememberKitchenViewport} from './kitchen-viewport.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {kitchenRunPoint} from './kitchen-model.js';
import {mountKitchenView} from './kitchen-view.js';
import {kitchenGeometry,kitchenUnitSpecs} from './kitchen-model.js';
import {openKitchenProject,saveProject,scenePlan,commitProject,undoProject,redoProject,kitchenFuture,kitchenHistory,getKitchenPhotos,kitchenProjectURL,shapeForUnit,projectChangedElsewhere,staleProjectMessage,watchProjectChanges} from './kitchen-project.js';
import {warnBeforeLeaving} from './kitchen-unsaved-work.js';
import {historyShortcut,typingTarget} from './kitchen-history-shortcut.js';
import {pruneOrphanDrafts,newProjectNow} from './kitchen-project-switch.js';
import {getProjectAccess,refreshProjectAccess,subscribeProjectAccess} from './kitchen-project-access.js';
import {canOpenWorkshopPage,canEditWorkshopPage,roleHome} from './kitchen-role-pages.js';

document.title='استوديو المطابخ';
document.querySelector('.sp-skip').href='#kitchen-workspace';
const el=document.createElement('main');el.id='kitchen-workspace';el.className='k-app';el.tabIndex=-1;
const command=(attr,icon,label)=>`<button type="button" ${attr}>${ico(icon)}<span>${label}</span></button>`;
el.innerHTML=`<header class="k-titlebar"><div class="k-studio-brand"><button type="button" class="k-studio-home" data-gateways aria-label="بوابات العمل" title="بوابات العمل"><img src="./studio-mark.svg" alt="" width="38" height="38" class="k-studio-mark"></button><div><p>استوديو المطابخ</p><h1 data-project-caption>مشروع المطبخ</h1></div></div>
<nav class="k-docbar" aria-label="أدوات الاستوديو">
<button type="button" class="studio-guide" data-guide-entry aria-expanded="false">${ico('guide')}<small>دليل المشروع</small><span>متابعة المشروع</span></button>
<button type="button" class="studio-visit" data-visit-entry aria-expanded="false">${ico('room')}<span>رفع الموقع</span></button>
<button type="button" class="ws-entry" data-workshop aria-expanded="false">${ico('layouts')}<span>تصميم المطبخ</span></button>
<button type="button" class="studio-more" data-studio-more aria-expanded="false" aria-controls="studio-commands" aria-label="أدوات المشروع" title="أدوات المشروع">${ico('more')}</button>
<div id="studio-commands" class="studio-commands" hidden>
<section><h2>المشروع</h2>${command('data-gateways','plan','بوابات العمل')}${command('data-studio-key="file" data-studio-panel="project"','project','ملف المشروع')}${command('data-new-project','plus','مشروع جديد')}<div data-studio-key="history" class="studio-history">${command('data-k-undo','undo','تراجع')}${command('data-k-redo','redo','إعادة')}</div></section>
<section data-context-tools><h2 data-context-heading>أدوات الرسم</h2>
${command('data-studio-key="room" data-room-survey aria-expanded="false"','room','أبعاد الغرفة')}
${command('data-studio-key="wallPhoto" data-stage-destination="photo"','photo','قياس الجدار من صورة')}
${command('data-studio-key="wallSheet" data-stage-destination="survey"','room','ورقة رفع الجدار')}
${command('data-studio-key="records" data-open-field aria-expanded="false"','field','سجل الزيارة والصور')}
${command('data-studio-key="usage" data-stage-destination="uses"','library','استخدام الوحدة المحددة')}
${command('data-studio-key="layouts" data-studio-panel="layouts"','layouts','بدائل التوزيع')}
${command('data-studio-key="library" data-studio-panel="library"','library','مكتبة الوحدات')}
${command('data-studio-key="libraries" data-studio-libraries','list','إدارة المكتبات')}
${command('data-studio-key="sheets" data-studio-sheets','field','لوحات التسليم')}
${command('data-studio-key="render" data-studio-photo','photo','تصوير التصميم')}</section></div></nav></header>
<section id="k-photo-panel" hidden></section><aside id="k-user-library" hidden></aside>
<section id="shelf-kitchen-host" aria-label="مساحة تصميم المطبخ"></section>
<aside class="k-room-form k-placement-review" role="dialog" aria-labelledby="k-review-title" id="k-placement-review" hidden><header><h2 id="k-review-title">تداخلات في التصميم الحالي</h2><button type="button" data-review-close aria-label="إغلاق مراجعة التداخلات">×</button></header><p>اختر أحد العنصرين لتعديل موضعه أو مقاسه. يمكنك تحديد كل نافذة على حدة حتى إذا تطابقت النافذتان.</p><div data-review-items></div></aside>
<p class="k-app-status" role="status" aria-live="polite" data-project-status></p>
<aside id="k-idea-panel" class="k-room-form kidea-panel" role="dialog" aria-labelledby="k-idea-title" hidden><div class="kidea-head"><h2 id="k-idea-title">بدائل التصميم</h2><button type="button" data-ideas-close aria-label="إغلاق البدائل">×</button></div><p>احفظ فكرة المطبخ كما تراها الآن، بما فيها المقاسات والخامات والتقسيم الداخلي.</p><form class="kidea-save"><label>اسم البديل<input type="text" data-idea-name maxlength="60" placeholder="مثلًا: جزيرة خشبية"></label><button>حفظ التصميم الحالي</button></form><div data-ideas-list></div><p data-idea-msg role="status"></p><button type="button" data-idea-recover hidden>تراجع عن إزالة البديل</button></aside>
`;
document.body.append(el);
const $=s=>el.querySelector(s);
const reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.className='k-review-trigger';reviewButton.hidden=true;
reviewButton.setAttribute('aria-expanded','false');reviewButton.setAttribute('aria-controls','k-placement-review');const conflicts=document.createElement('div');conflicts.append(reviewButton);$('#studio-commands section h2').after(conflicts);
const commands=$('#studio-commands'),more=$('[data-studio-more]');function refreshStageCommands(){
 const screen=workshop?.screen(),route=screen?.route||'cad',allowed=stageCommands(doc,route,screen?.context);
 const role=getProjectAccess(doc).role,editDesign=canEditWorkshopPage(role,'whole'),limits={room:'survey',wallPhoto:'photo',wallSheet:'survey',records:'field',usage:'uses',layouts:'whole',library:'whole',libraries:'libraries'};
 for(const item of commands.querySelectorAll('[data-studio-key]'))item.hidden=!allowed.includes(item.dataset.studioKey)||(limits[item.dataset.studioKey]&&!canOpenWorkshopPage(role,limits[item.dataset.studioKey]))||(item.dataset.studioKey==='history'&&!editDesign&&role!=='store'&&role!=='factory');
 const group=$('[data-context-tools]');group.hidden=!group.querySelector('button:not([hidden])');
 $('[data-context-heading]').textContent=screen?.title||'أدوات الرسم';
 reviewButton.parentElement.hidden=!['cad','whole'].includes(route)||route==='whole'&&!screen?.context?.savedDesign;
 const scope=screen?'أدوات '+screen.title:'أدوات المشروع',label=(!reviewButton.hidden&&!reviewButton.parentElement.hidden)?scope+' · '+reviewButton.textContent:scope;
 more.setAttribute('aria-label',label);more.title=label;
 more.toggleAttribute('data-has-conflicts',!reviewButton.hidden&&!reviewButton.parentElement.hidden);
}
new MutationObserver(refreshStageCommands).observe(reviewButton,{attributes:true,attributeFilter:['hidden'],childList:true});
function showCommands(open,focus=false){if(open)refreshStageCommands();commands.hidden=!open;more.setAttribute('aria-expanded',String(open));if(focus)more.focus({preventScroll:true});}
more.addEventListener('click',()=>showCommands(commands.hidden));
document.addEventListener('pointerdown',e=>{if(!commands.hidden&&!e.target.closest('.k-docbar'))showCommands(false);});
document.addEventListener('focusin',e=>{if(!commands.hidden&&!e.target.closest('.k-docbar'))showCommands(false);});
commands.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();showCommands(false,true);}});
more.addEventListener('keydown',e=>{if(e.key==='Escape')showCommands(false,true);});
commands.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('[data-k-undo],[data-k-redo]'))showCommands(false,true);},true);
let fieldFromGuide=false,externalOrigin=null;
let workshop=null,personal=null,suppliers=null,survey=null,fieldReg=null,fieldContext=0;
let doc=openKitchenProject();
await refreshProjectAccess(doc);
warnBeforeLeaving();pruneOrphanDrafts({openId:doc.room.projectId});
let rp=scenePlan(doc.room,doc.kitchen),photos=getKitchenPhotos(doc.room),kit=null;
const tell=s=>{$('[data-project-status]').textContent=s;};
function permitted(page,edit=false){const role=getProjectAccess(doc).role,allowed=edit?canEditWorkshopPage(role,page):canOpenWorkshopPage(role,page);if(!allowed)tell('هذا الإجراء خارج صلاحيتك الحالية على المشروع.');return allowed;}
watchProjectChanges(tell); // another window saved this project: say so now instead of at the next save
const updateUndo=()=>{
 const noBack=!kitchenHistory().length,noForward=!kitchenFuture().length;
 for(const button of el.querySelectorAll('[data-k-undo],[data-quick-undo]'))button.disabled=noBack;
 for(const button of el.querySelectorAll('[data-k-redo],[data-quick-redo]'))button.disabled=noForward;
 $('[data-project-caption]').textContent=doc.room.name||'مطبخي';
};
function apply(next,msg,options){
 next=identifiedProject(pruneBaseSupportChoices(next,doc),{current:doc});
 const r=commitProject(doc,next,options);if(!r.changed){tell(r.ok===false?r.reason:msg||'لم يتغيّر التخطيط.');return r;}
 next=r.next||next;
 const registerOnly=next.kitchen===doc.kitchen&&next.room.fieldRegister!==doc.room.fieldRegister&&[...new Set([...Object.keys(doc.room),...Object.keys(next.room)])].every(key=>key==='fieldRegister'||doc.room[key]===next.room[key]);
 if(doc.room!==next.room&&next.room.fieldRegister!==doc.room.fieldRegister&&next.kitchen!==doc.kitchen)fieldContext++;if(!registerOnly&&(doc.room!==next.room||next.kitchen!==doc.kitchen))rp=scenePlan(next.room,next.kitchen);if(doc.room!==next.room&&!registerOnly)photos=getKitchenPhotos(next.room);doc=next;updateUndo();if(!registerOnly){kit?.refresh(true);review.refresh();workshop?.refresh();}else workshop?.refreshGuide();tell((msg||'تم تعديل المطبخ.')+(r.saved?'':' لم يتسنّ حفظ آخر تغيير في المتصفح.'));return r;
}
function travel(forward=false){if(projectChangedElsewhere()){tell(staleProjectMessage);return {ok:false,reason:staleProjectMessage};}const r=forward?redoProject(doc):undoProject(doc);if(!r)return {ok:false,reason:'تعذّر التراجع أو الإعادة. راجع صلاحية المشروع والحفظ.'};doc=r.next;rp=scenePlan(doc.room,doc.kitchen);photos=getKitchenPhotos(doc.room);updateUndo();kit?.refresh(true);review.refresh();survey?.refresh();fieldReg?.refresh();workshop?.refresh();tell(forward?'أُعيد التعديل.':'تم التراجع.');return r;}
const undo=()=>travel(false);
function dims(){if(permitted('survey',true))survey?.open('shape');}
function startWall(wall){workshop?.open('survey',wall?{wall}:{});}
function editWallItem(wall,featureId,position){workshop?.open('survey',{wall,featureId,edit:true,...position});}
function requireSurvey(){
 if(surveyedDesignWalls(doc).length)return false;
 startWall();tell('حدّد نهاية الدواليب أو ركن الجدار واحفظ الرفع لبدء التصميم.');return true;
}
function applyCad(next,msg){
 const reason=cadAdditionIssue(doc,next.kitchen);
 if(reason){tell(reason);return {ok:false,changed:false,saved:false,reason};}
 return apply(next,msg);
}
function editUnit(id){
 if(!permitted('unit-interior',true))return;
 const u=doc.kitchen.units.find(v=>v.id===id),g=kitchenGeometry(doc.kitchen,rp).units.find(v=>v.id===id);
 if(!u||!g||!shapeForUnit(u,g)){tell('لا تتّسع هذه الوحدة لتقسيم داخلي قابل للتحرير.');return;}
 if(projectChangedElsewhere()){tell(staleProjectMessage);return;}
 if(!saveProject(doc)){tell('تعذّر حفظ المطبخ قبل فتح الوحدة.');return;}
 const pose=rememberKitchenViewport(kit.getState());
 location.assign(kitchenProjectURL('kitchen-unit',id,pose));
}
function inspectPart(route,focus={}){
 const dest=workshopPartTarget(doc,route,focus);
 if(!dest){tell('لم يعد العنصر موجودًا في هذا المشروع.');return;}
 if(!permitted(dest.route==='factory'?workshopRoute(dest.route,dest.focus):dest.route))return;
 externalOrigin=null;
 const f=dest.focus;
 switch(dest.route){
 case 'placement':return kit.inspectItem('unit',f.unitId);
 case 'cad-run':return kit.inspectItem('run',f.runId);
 case 'cad-material':return kit.inspectMaterial('unit',f.unitId,f.part);
 case 'top-detail':return kit.inspectMaterial('run',f.runId,'worktop',f);
 case 'unit-interior':return editUnit(f.unitId);
 case 'floor-point':return survey.open('points',f.pointId);
 case 'room-finish':return panels.open('project','room',f);
 case 'field-part':{
  const isDoor=f.surface==='threshold';
  const itemId=isDoor?f.featureId:'skirting-'+f.wall;
  if(!itemId||!architectureWall(doc.room,f.wall)){tell('تعذّر تحديد مرجع هذا القياس من الرسم.');return;}
  const location=architectureWallLabel(f.wall)+(isDoor?' · عتبة المدخل':' · نعلة الجدار');
  fieldReg.open({mode:'item',code:'SITE-13',itemId,location,property:isDoor?'ارتفاع عتبة المدخل':'ارتفاع نعلة الجدار'});
  return;
 }
 default:return workshop?.open(dest.route,f);
 }
}
const entry=new URLSearchParams(location.search);
kit=mountKitchenView($('#shelf-kitchen-host'),{getProject:()=>doc,onCommitProject:apply,onInspectPart:inspectPart,onFactoryRow:runId=>workshop?.open('row',{runId}),initialViewport:readKitchenViewport(entry),getPlan:()=>rp,getRoom:()=>doc.room,getKitchen:()=>doc.kitchen,getPhotos:()=>photos,onCommit:(k,message)=>applyCad({...doc,kitchen:k},message),requireSurvey,onReject:tell,onEditUnit:editUnit,onRoomDimensions:dims,onSurveyPoint:id=>survey?.open('points',id),onSurveyReading:editWallItem,onReadingPhoto:(wall,photoId)=>workshop?.open('photo',{wall,photoId}),onWindowUpstand:(wall,windowId)=>workshop?.open('assembly',{section:'stone',wall,windowId}),onLayouts:()=>panels.open('layouts'),onLibrary:()=>panels.open('library'),onUndo:undo,canUndo:()=>!!kitchenHistory().length});
// Undo and redo sit at the end of the drawing's command row, one tap away on a tablet; the project menu keeps them too.
const historyGroup=document.createElement('div');historyGroup.className='kit-history';historyGroup.setAttribute('role','group');historyGroup.setAttribute('aria-label','التراجع والإعادة');
historyGroup.innerHTML=`<button type="button" data-quick-undo aria-label="تراجع" title="تراجع عن آخر تعديل (Ctrl+Z)">${ico('undo')}</button><button type="button" data-quick-redo aria-label="إعادة" title="إعادة ما تراجعت عنه (Ctrl+Shift+Z)">${ico('redo')}</button>`;
$('.kit-command').append(historyGroup);
// A rejected drop needs feedback beside the drawing even when the live status
// below it is outside the current viewport. The existing status announces it.
const stageHint=document.createElement('div');stageHint.className='kit-stage-hint';stageHint.hidden=true;stageHint.setAttribute('aria-hidden','true');$('.kit-mat').append(stageHint);
const sourceNote=$('[data-k-note]');let hintTimer;
new MutationObserver(()=>{clearTimeout(hintTimer);const warn=sourceNote.dataset.tone==='warn';
 stageHint.hidden=!warn;if(warn){stageHint.textContent=sourceNote.textContent;hintTimer=setTimeout(()=>stageHint.hidden=true,4800);}
}).observe(sourceNote,{childList:true,characterData:true,attributes:true,subtree:true,attributeFilter:['data-tone']});
// Consume the return address once: a later refresh should preserve the user's newer view.
if(['space','yaw','pitch'].some(key=>entry.has(key))){const u=new URL(location.href);for(const key of ['space','yaw','pitch'])u.searchParams.delete(key);history.replaceState(history.state,'',u.href);}
window.addEventListener('pagehide',()=>rememberKitchenViewport(kit.getState()));
document.addEventListener('visibilitychange',()=>{if(document.hidden)rememberKitchenViewport(kit.getState());});
const photoNode=$('#k-photo-panel'),photo=mountKitchenPhoto(photoNode,{getPlan:()=>rp,getKitchen:()=>doc.kitchen,getPhotos:()=>photos,getDoc:()=>doc,getTextures:()=>({byFinish:textureMap}),getCamera:()=>kit.getState(),onClose:()=>more.focus({preventScroll:true})});
const ideas=mountKitchenIdeas($('#k-idea-panel'),{getDoc:()=>doc,apply,focusReturn:()=>more});
function shutPanels(){fieldFromGuide=false;workshop?.close(false);fieldReg?.close(false);$('[data-open-field]').setAttribute('aria-expanded','false');survey?.close();personal?.close?.();suppliers?.close?.();$('#k-idea-panel').hidden=true;review?.close();if(!photoNode.hidden)photo.close();}
async function collection(supplier=false){try{shutPanels();const opts={getDoc:()=>doc,getKit:()=>kit,apply:applyCad,tell,focusReturn:()=>more};if(supplier){if(!suppliers){const m=await import('./kitchen-supplier.js');suppliers=m.mountSupplierReferences(el,opts);}suppliers.open();}else{if(!personal){const m=await import('./kitchen-user-library.js');personal=m.mountUserLibrary($('#k-user-library'),opts);}personal.open();}}catch(e){tell('تعذّر فتح المكتبة: '+e.message);}}
const panels=mountStudioPanels({el,onInspectPart:inspectPart,onStartWall:startWall,onPhotoForWall:focus=>workshop?.open('photo',focus),getDoc:()=>doc,getKit:()=>kit,apply,tell,onSurvey:dims,onFieldRegister:openFieldRegister,closeOthers:shutPanels,onMyModules:()=>collection(false),onSupplier:()=>collection(true),ideas:()=>{review.close();ideas.open();},exportCSV:()=>buildCSV(),exportSVG:()=>kit.exportSvg()});
survey=mountRoomSurvey(el,{getDoc:()=>doc,onStartWall:startWall,onSurveyReading:editWallItem,apply,onFinishes:()=>panels.open('project','room'),opener:$('[data-room-survey]'),returnFocus:()=>more,closeOthers:()=>{panels.close(false);shutPanels();}});
$('[data-room-survey]').addEventListener('click',()=>survey.active()?survey.close(true):dims());
function openFieldRegister(){const fromStage=externalOrigin||workshop?.active();
 const sel=fromStage?null:kit?.getState()?.selected;let focus=fromStage?{mode:'records'}:null;
 if(sel?.kind==='unit'&&doc.kitchen.units.some(u=>u.id===sel.id&&u.kind==='dishwasher'))focus={topic:'equipment',entityId:sel.id};
 else if(sel?.kind==='feature'&&doc.kitchen.features.some(f=>f.id===sel.id))focus={topic:'services',entityId:sel.id};
 panels.close(false);shutPanels();fieldReg.open(focus);$('[data-open-field]').setAttribute('aria-expanded','true');}
fieldReg=mountFieldRegister(el,{getDoc:()=>doc,getProjectKey:()=>fieldContext,apply,onUndo:()=>travel(false),attachmentStore:fieldAttachmentStore,onClose:()=>{const b=$('[data-open-field]');b.setAttribute('aria-expanded','false');if(fieldFromGuide){fieldFromGuide=false;workshop?.open(permitted('guide')?'guide':roleHome(getProjectAccess(doc).role));}else if(!permitted('whole'))workshop?.open(roleHome(getProjectAccess(doc).role));else more.focus({preventScroll:true});},onProject:()=>downloadFieldProject(doc)});
$('[data-open-field]').addEventListener('click',()=>fieldReg.active()?fieldReg.close(true):openFieldRegister());
const review=mountPlacementReview(reviewButton,$('#k-placement-review'),{getDoc:()=>doc,returnFocus:()=>more,inspect:(kind,id)=>kit.inspectItem(kind,id),closeOthers:()=>{fieldReg?.close(false);$('[data-open-field]').setAttribute('aria-expanded','false');survey?.close();panels.close(false);$('#k-idea-panel').hidden=true;}});
for(const button of el.querySelectorAll('[data-studio-panel]'))button.addEventListener('click',()=>panels.active()===button.dataset.studioPanel?panels.close():panels.open(button.dataset.studioPanel,button.dataset.studioPanel==='project'?'project':null));
$('[data-studio-sheets]').addEventListener('click',()=>panels.open('project','sheet'));
$('[data-new-project]').addEventListener('click',()=>{const res=newProjectNow(doc);if(!res.ok)tell(res.reason);});
// The libraries of the device are a page of the store gateway; the gateways home is one tap from the logo and from this menu.
$('[data-studio-libraries]').addEventListener('click',()=>workshop.open('libraries'));
for(const home of el.querySelectorAll('[data-gateways]'))home.addEventListener('click',()=>{showCommands(false);workshop.open('home');});
$('[data-studio-photo]').addEventListener('click',()=>{panels.close(false);shutPanels();photo.open();});
$('[data-k-redo]').addEventListener('click',()=>travel(true));
kit.refresh(true);updateUndo();const requestedUnit=new URLSearchParams(location.search).get('unit');if(requestedUnit&&doc.kitchen.units.some(v=>v.id===requestedUnit))kit.selectUnit?.(requestedUnit,{open:true});
$('[data-k-undo]').addEventListener('click',undo);
$('[data-quick-undo]').addEventListener('click',undo);$('[data-quick-redo]').addEventListener('click',()=>travel(true));
function buildCSV(){
 const geo=kitchenGeometry(doc.kitchen,rp),cols=['الوحدة','المعرف','نوع الامتداد','الصف','البداية على الصف (سم)','عرض الوحدة (سم)','ارتفاع الوحدة (سم)','عمق الوحدة (سم)','عن الأرض (سم)','تقسيم مخصص','تشطيب الواجهة','خامة السطح','س من يسار الغرفة (سم)','ص من خلف الغرفة (سم)','زاوية الامتداد (درجة)','هيئة الواجهة','المقبض','جهة المفصلة'];
 const rows=geo.units.map(u=>{const r=doc.kitchen.runs.find(v=>v.id===u.runId),free=r.placement==='free',p=kitchenRunPoint(rp,r,u.u,0);
  return [kitchenUnitSpecs[u.kind]?.label||u.kind,u.id,free?'جزيرة حرة':architectureWallLabel(u.wall),u.tier==='upper'?'علوي':'سفلي',u.u,u.width,u.height,u.depth,u.bottom,u.detail?'نعم':'لا',(kitchenFrontFinishes[u.frontFinish]?.label||'افتراضي')+(u.frontColor?' '+u.frontColor:''),r.tier==='upper'?'':(kitchenWorktopFinishes[r.worktopFinish]?.label||'افتراضي')+(r.worktopColor?' '+r.worktopColor:''),p.x.toFixed(1),p.z.toFixed(1),free?r.angle:(()=>{const t=architectureWall(rp,u.wall)?.tangent;return t?(Math.atan2(t.z,t.x)*180/Math.PI+360)%360:'';})(),u.frontStyle||'',u.handleStyle||'',u.doorHanding||''];});
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const tagged=stampColumns(outputStamp(doc,'المطبخ كاملًا','جدول الوحدات'),cols,rows);return '\uFEFF'+[tagged.headers,...tagged.rows].map(v=>v.map(quote).join(',')).join('\r\n');
}

if(entry.get('panel')==='rooms'&&permitted('survey',true)){survey.open('presets');}

if(entry.get('panel')==='field'&&permitted('field')){openFieldRegister();}


if(entry.get('panel')==='defaults'&&permitted('defaults')){panels.close(false);shutPanels();fieldReg.open({mode:'defaults'});$('[data-open-field]').setAttribute('aria-expanded','true');}


const workshopButton=$('[data-workshop]');
// Resolve an unsaved wall before any other title-bar command can replace its editor.
let replayingCommand=false;
$('.k-docbar').addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target||replayingCommand)return;
 const key=target.closest('[data-studio-key]')?.dataset.studioKey,screen=workshop?.screen();
 const permissions={room:'survey',wallPhoto:'photo',wallSheet:'survey',records:'field',usage:'uses',layouts:'whole',library:'whole',libraries:'libraries'};
 if(permissions[key]&&!permitted(permissions[key])){e.stopImmediatePropagation();e.preventDefault();return;}
 if(key&&!stageCommands(doc,screen?.route||'cad',screen?.context).includes(key)){
  e.stopImmediatePropagation();e.preventDefault();showCommands(false,true);return;
 }
 if(target.dataset.stageDestination&&screen){
  e.stopImmediatePropagation();e.preventDefault();showCommands(false);
  const focus=screen.context||{},step=target.dataset.stageDestination;
  workshop.open(step,step==='uses'?{unitId:focus.unitId}:focus.wall?{wall:focus.wall}:{});
  return;
 }
 if(!workshop?.active()||target.matches('[data-workshop],[data-visit-entry],[data-guide-entry],[data-studio-more],[data-gateways]'))return;
 e.stopImmediatePropagation();e.preventDefault();
 workshop.requestClose(()=>{
  if(['file','records','render','sheets'].includes(key)){
   const detail=screen.context||{},focus={...screen.focus};
   if(screen.route==='survey'&&detail.wall){focus.wall=detail.wall;delete focus.featureId;delete focus.review;}
   if(screen.route==='photo'&&detail.wall){if(focus.wall!==detail.wall)delete focus.photoId;focus.wall=detail.wall;}
   if(screen.route==='finish')Object.assign(focus,detail);
   externalOrigin={route:screen.route,focus,projectId:doc.room.projectId};
  }
  replayingCommand=true;try{target.click();}finally{replayingCommand=false;}
 });
},true);
$('[data-visit-entry]').addEventListener('click',()=>{showCommands(false);workshop?.open('survey');});
const guideEntry=$('[data-guide-entry]');
guideEntry.addEventListener('click',()=>{showCommands(false);workshop?.open('guide');});
workshop=mountWorkshop(el,{getDoc:()=>doc,apply,tell,opener:workshopButton,onHistory:travel,canHistory:forward=>!!(forward?kitchenFuture():kitchenHistory()).length,
 onGuideChange(preview){
   guideEntry.querySelector('small').textContent=preview.label;
   guideEntry.querySelector('span').textContent=preview.text;
   guideEntry.setAttribute('aria-label','دليل المشروع · '+preview.label+' · '+preview.text);
   guideEntry.title=preview.text;
 },
 onExternalStep(step,focus){
   if(!['defaults','assist','field'].includes(step)){inspectPart(step,focus);return;}
   panels.close(false);shutPanels();fieldFromGuide=true;
   fieldReg.open({...focus,fromGuide:true,mode:step==='field'?'records':step==='defaults'?'defaults':'assist'});
   $('[data-open-field]').setAttribute('aria-expanded','true');
 },closeOthers:()=>{shutPanels();panels.close(false);}});
const workshopPanel=el.querySelector('.k-workshop');
const cadHost=$('#shelf-kitchen-host'),topNav=$('.k-docbar');
let frontPanel=null;
function updateWorkshopEntry(){
 const front=el.querySelector(':scope > [role="dialog"]:not([hidden])'),active=!workshopPanel.hidden,route=workshopPanel.dataset.wsRoute;
 if(front!==frontPanel){
  const leavingPanel=frontPanel&&frontPanel!==workshopPanel;
  frontPanel=front;cadHost.inert=!!front;topNav.inert=!!front&&front!==workshopPanel;
  el.toggleAttribute('data-standalone-panel',topNav.inert);
  if(front)kit.suspendDrawingInput?.();
  showCommands(false);
  if(leavingPanel&&!front){
   const resume=externalOrigin;externalOrigin=null;
   if(resume&&resume.projectId===doc.room.projectId){workshop.open(resume.route,resume.focus,true);return;}
   if(document.activeElement===document.body||document.activeElement?.closest('[hidden]'))more.focus({preventScroll:true});
  }else if(front===workshopPanel)externalOrigin=null;
 }
 refreshStageCommands();
 $('[data-visit-entry]').setAttribute('aria-expanded',String(active&&route==='survey'));
 workshopButton.setAttribute('aria-expanded',String(active&&route==='whole'));guideEntry.setAttribute('aria-expanded',String(active&&route==='guide'));
}
const stageObserver=new MutationObserver(updateWorkshopEntry);
function watchPanel(panel){
 if(panel.matches?.('[role="dialog"]'))stageObserver.observe(panel,{attributes:true,attributeFilter:['hidden','data-ws-route']});
}
for(const panel of el.children)watchPanel(panel);
new MutationObserver(records=>{
 for(const record of records)for(const node of record.addedNodes)watchPanel(node);
 updateWorkshopEntry();
}).observe(el,{childList:true});
updateWorkshopEntry();
function refreshRoleUI(){
 const access=getProjectAccess(doc);if(access.status==='checking')return;
 const role=access.role;
 for(const [selector,page] of [['[data-visit-entry]','survey'],['[data-workshop]','whole'],['[data-guide-entry]','guide']])$(selector).hidden=!canOpenWorkshopPage(role,page);
 workshop.refreshAccess();refreshStageCommands();
 if(!canOpenWorkshopPage(role,'whole')&&!workshop.active()&&!fieldReg?.active())workshop.open(roleHome(role));
}
subscribeProjectAccess(refreshRoleUI);
window.addEventListener('focus',()=>{void refreshProjectAccess(doc);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshProjectAccess(doc);});
refreshRoleUI();
// Ctrl/⌘+Z undoes and Ctrl/⌘+Shift+Z (or Ctrl+Y) redoes on the drawing screen. A text box keeps its own undo, and nothing changes behind an open panel.
document.addEventListener('keydown',e=>{
 const command=historyShortcut(e);
 if(!command||frontPanel||typingTarget(e.target))return;
 e.preventDefault();travel(command==='redo');
});
workshopButton.addEventListener('click',()=>{showCommands(false);workshop.open('whole');});
if(entry.get('panel')==='libraries'){
 workshop.open('libraries');
}else if(entry.get('panel')==='workshop'){
 const step=entry.get('step')||'guide',review=step==='survey'&&entry.get('survey')==='review';
 const section=step==='assembly'&&entry.get('section')==='stone'?{section:'stone'}:step==='factory'&&entry.get('tab')?{tab:entry.get('tab')}:undefined;
 workshop.open(step,review?{review:true}:step==='survey'&&entry.get('measure')==='pair'?{pair:true}:section);
 if(review){const url=new URL(location.href);url.searchParams.delete('survey');history.replaceState(history.state,'',url.href);}
}else if(entry.get('tool')==='row'&&!entry.has('panel')&&!requestedUnit){
 kit.activateTool('run',{runPlacement:'wall'});
}else if([...entry.keys()].every(key=>key==='workspace')){
 if(!surveyedDesignWalls(doc).length&&canOpenWorkshopPage(getProjectAccess(doc).role,'survey'))startWall();else workshop.open('home');
}
