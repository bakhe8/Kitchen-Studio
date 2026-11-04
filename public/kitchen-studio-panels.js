import {studioIcon} from './kitchen-tool-icons.js';
import {sheetSelector,sheetTarget} from './kitchen-sheet-target.js';
import {designSpanIssue} from './kitchen-design-site.js';
import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {validateProjectPlacement,savedProjectText} from './kitchen-project.js';
import {recordBackup,backupStatus,backupText} from './kitchen-backup-status.js';
import {mountSavedProjects} from './kitchen-saved-projects-ui.js';
import {newProjectNow,openSavedNow,deleteSavedProject} from './kitchen-project-switch.js';
import {drawingSVG,outputFilename} from './kitchen-drawing-output.js';
import {outputStamp} from './kitchen-output-stamp.js';
import {projectArchiveSizeLimit,packFieldFiles,installFieldFiles,fieldAttachmentStore} from './kitchen-field-files.js';
import {architectureWallLabel,roomArchitecture} from './kitchen-architecture.js';
import {studioCatalogEntries,kitchenUnitSpecs} from './kitchen-catalog.js';
import {applyKitchenCatalogEntry,kitchenGeometry} from './kitchen-model.js';
import {layouts,palettes,buildStudioLayout} from './kitchen-layouts.js';
import {ideaPreview,cleanIdea} from './kitchen-ideas.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {roomFaceLabels} from './shelf-room-model.js';
import {cleanStudioRoom,readWallPhotos,textureMap,floors,claddingFinishes} from './kitchen-studio-room.js';
import {checkedPortableArchive} from './kitchen-archive-validation.js';
import {getProjectAccess,validateProjectEdit} from './kitchen-project-access.js';
import {wallPhotoSources,packWallPhotos,restoreWallPhotos,saveWallPhoto} from './kitchen-wall-photo-assets.js';
import {elevationSheet,planSheet,sheetTables,printKitchen,kitchenDrawingBook,sheetFaces} from './kitchen-sheet.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const wallIDs=['back','right','front','left'];
export function downloadStudio(name,data,mime){const url=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const opts=(pairs,sel)=>pairs.map(([k,n])=>'<option value="'+esc(k)+'"'+(k===sel?' selected':'')+'>'+esc(n)+'</option>').join('');
const wallOptions=k=>opts(wallIDs.map(id=>[id,roomFaceLabels[id]]),k);
const cap=(name,field)=>'<label class="pr-field"><span>'+name+'</span>'+field+'</label>';
const b=(action,label,cl='')=>'<button type="button" class="'+cl+'" data-pr="'+action+'">'+label+'</button>';
const baseTypes={unit:'الوحدات',front:'الواجهات',worktop:'الأسطح','front-style':'الشكل',handle:'المقابض'};
function cardArt(e){
 if(['front','worktop'].includes(e.section)){const data=textureMap[e.id]||textureMap[e.texture],pic=data?'url('+data.src+')':'none';return '<i class="pr-swatch" style="--base:'+e.color+';--pic:'+pic+'"></i>';}
 if(e.section==='handle')return '<i class="hardware-swatch '+e.id+'"><em></em></i>';
 if(e.section==='front-style')return '<i class="front-swatch '+e.id+'"><em></em></i>';
 const k=e.id,tall=['tall','fridge','freezer','oven-tower'].includes(k),x=27,y=tall?8:18,w=tall?36:48,h=tall?55:37,side=11;
 const rect=(a,b,c,d,fill,stroke='#667365')=>'<rect x="'+a+'" y="'+b+'" width="'+c+'" height="'+d+'" rx="1" fill="'+fill+'" stroke="'+stroke+'" stroke-width=".85"/>';
 let symbols='';const x1=x+w,dy=y+h,color=['fridge','freezer','dishwasher'].includes(k)?'#acb3ac':k==='open-shelf'?'#b78b63':'#b9c3ad';
 const ln=(a,b,c,d)=>'<path d="M'+a+' '+b+'L'+c+' '+d+'" fill="none" stroke="#626e61" stroke-width="1.4"/>';
 if(k==='hood')return '<svg viewBox="0 0 108 70" aria-hidden="true"><path d="M47 9h15v23H47z" fill="#a4aaa3" stroke="#606c65"/><path d="m46 30-24 16v5h65v-5L63 30z" fill="#8a968b" stroke="#435a52"/><path d="M25 48h57" stroke="#e7ddc3" stroke-width="3"/></svg>';
 if(k==='drawers'||k==='freezer'){for(let a=1;a<3;a++)symbols+=ln(x,y+h*a/3,x1,y+h*a/3);for(let a=0;a<3;a++)symbols+=ln(x+w*.38,y+h*a/3+4,x+w*.62,y+h*a/3+4);}
 else if(['oven','oven-tower','dishwasher'].includes(k)){symbols+=rect(x+4,y+5,w-8,4,'#5b635e')+rect(x+6,y+(tall?19:12),w-12,tall?19:17,'#3e4e4b')+ln(x+9,y+13,x1-9,y+13);}
 else if(k==='open-shelf'||k==='bottle-rack'){symbols+=rect(x+3,y+3,w-6,h-6,'#cbb196');for(const a of [.33,.66])symbols+=ln(x+3,y+h*a,x1-3,y+h*a);if(k==='bottle-rack'){symbols+=ln(x+w*.35,y+3,x+w*.35,dy-3)+ln(x+w*.7,y+3,x+w*.7,dy-3);}}
 else if(k==='fridge'||k==='storage'||k==='sink'||k==='tall'){symbols+=ln(x+w*.5,y,x+w*.5,dy)+ln(x+w*.44,y+6,x+w*.44,y+12)+ln(x+w*.56,y+6,x+w*.56,y+12);}
 else symbols+=ln(x+5,y+5,x+14,y+5);
 if(k==='hob')symbols+='<g fill="#495553"><ellipse cx="45" cy="15" rx="6" ry="2"/><ellipse cx="64" cy="15" rx="5" ry="2"/></g>';
 if(k==='sink')symbols+='<ellipse cx="55" cy="15.6" rx="12" ry="2.8" fill="#82999c"/><path d="M61 14v-6q-1-3-4 0" fill="none" stroke="#455d59" stroke-width="1.8"/>';
 return '<svg viewBox="0 0 108 70" aria-hidden="true"><ellipse cx="56" cy="'+(dy+4)+'" rx="30" ry="3" fill="#a4afa0" opacity=".3"/><path d="M'+x+' '+y+'l'+side+' -5h'+w+'l-'+side+' 5z" fill="#dee2d6" stroke="#768073"/><path d="M'+x1+' '+y+'l'+side+' -5v'+h+'l-'+side+' 5z" fill="#889380" stroke="#64715f"/>'+rect(x,y,w,h,color)+symbols+'</svg>';
}
function filestem(s){return String(s||'kitchen').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').slice(0,60)||'kitchen';}
// The project as stored now is what a downloaded file holds; remember it so the panel can say when it changed afterwards.
export async function downloadFieldProject(d){d=cleanIdea(d);if(!d)throw Error('تعذّر التحقق من المشروع قبل تنزيله.');const stored=savedProjectText(),files=await packFieldFiles(d.room),survey=!!d.room.fieldRegister?.records?.length,payload=JSON.stringify({type:'kitchen-studio',version:survey?2:1,design:d,photos:packWallPhotos(d.room),...(survey?{fieldFiles:files}:{})});if(new Blob([payload]).size>projectArchiveSizeLimit)throw Error('حجم نسخة المشروع يتجاوز 128 م.ب.');downloadStudio(filestem(d.room.name)+'-مطبخ.json',payload,'application/json');recordBackup({projectId:d.room.projectId,text:stored,kind:'file'});return survey;}
const backupLine=r=>{const s=backupStatus({projectId:r.projectId,text:savedProjectText()}),t=backupText(s);return t?'<p class="pr-backup" data-backup-line data-state="'+s.state+'" role="status">'+esc(t)+'</p>':'';};
function showBackup(root,d){const line=root?.querySelector('[data-backup-line]');if(!line)return;const s=backupStatus({projectId:d.room.projectId,text:savedProjectText()});line.textContent=backupText(s);line.dataset.state=s.state;}
export function mountStudioPanels({el,getDoc,getKit,apply,tell,closeOthers,ideas,onSurvey,onInspectPart,onStartWall,onPhotoForWall,onFieldRegister,onMyModules,onSupplier,exportCSV,exportSVG}){
 let which=null,opener=null,libSec='unit',query='',family='',target='',projectTab='project',wall='back',sheetWall='plan',mm=false,layout='island',layoutWall='back',look='project',draft=null,imported=null,libFocus=null;
 const boxes={},heads={library:'مكتبة الاستوديو',layouts:'التوزيعات',project:'ملف المشروع'};
 for(const [id,label] of Object.entries(heads)){const box=document.createElement('aside');box.id='pro-'+id;box.className='pro-drawer';box.setAttribute('role','dialog');box.setAttribute('aria-label',label);box.hidden=true;
  box.innerHTML='<header class="pr-head"><span><i></i>'+label+'</span><button type="button" data-pr="close" aria-label="إغلاق '+label+'" title="إغلاق '+label+'">'+studioIcon('close')+'</button></header><div class="pr-inner"></div><p class="pr-msg" role="status"></p>';el.append(box);boxes[id]=box;
  box.addEventListener('click',onClick);box.addEventListener('change',onChange);box.addEventListener('input',e=>{if(e.target.matches('[data-search]')){query=e.target.value;drawCards();}});
  box.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.closest?.('.pr-elevation')&&openSheetItem(e.target)){e.preventDefault();return;}if(e.key==='Escape'){e.stopPropagation();const menu=box.querySelector('.pr-export[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();}else close();}});
 }
 const q=(s)=>which?boxes[which].querySelector(s):null,inner=()=>q('.pr-inner');
 function message(s){if(which)q('.pr-msg').textContent=s||'';}
 function close(focus=true){if(!which)return;boxes[which].hidden=true;which=null;if(focus)opener?.focus?.({preventScroll:true});}
 function open(id,sub=null,focus={}){if(!boxes[id])return;const launch=document.activeElement;close(false);closeOthers?.();which=id;opener=launch;boxes[id].hidden=false;message('');
  if(id==='project'&&sub)projectTab=sub;if(id==='project'&&focus.wall&&roomArchitecture(getDoc().room).walls.some(w=>w.id===focus.wall))wall=focus.wall;if(id==='library'){const s=getKit().getState().selected;target=s?.id||'';libFocus=s;}
  if(id==='layouts'){
   if(sub)layout=sub;
   const measured=surveyedDesignWalls(getDoc());
   if(!measured.includes(layoutWall))layoutWall=measured.find(wall=>wallIDs.includes(wall))||layoutWall;
  }
  draw();
  const surfaceInput={floor:'[data-floor]',cladding:'[data-cladding-finish]',backsplash:'[data-backsplash]',paint:'[data-wall-color]'}[focus.surface];
  const preferred=surfaceInput&&boxes[id].querySelector(surfaceInput);
  if(preferred){preferred.focus({preventScroll:true});preferred.scrollIntoView?.({block:'center'});}
  else boxes[id].querySelector('[data-pr=close]')?.focus({preventScroll:true});
 }
 function tabset(map,selected,attr){return '<div class="pr-tabs" role="group">'+Object.entries(map).map(([id,v])=>'<button type="button" '+attr+'="'+id+'" aria-pressed="'+(selected===id)+'">'+v+'</button>').join('')+'</div>';}
 function draw(){if(which==='library')library();else if(which==='layouts')layoutPanel();else if(which==='project')project();}
 function targets(){const doc=getDoc(),g=kitchenGeometry(doc.kitchen,doc.room),selected=g.units.find(u=>u.id===target);
  if(libSec==='worktop'&&selected)target=selected.runId;
  return libSec==='worktop'?g.runs.filter(r=>r.tier==='base').map((r,i)=>[r.id,(r.wall?architectureWallLabel(r.wall):'الجزيرة')+' · صف '+num(i+1)+' · '+num(r.end-r.start)+' سم']):g.units.filter(u=>libSec!=='front-style'&&libSec!=='handle'||(libSec==='front-style'?kitchenUnitSpecs[u.kind]?.frontStyles:kitchenUnitSpecs[u.kind]?.handles)).map(u=>[u.id,kitchenUnitSpecs[u.kind].label+' · '+(u.wall?architectureWallLabel(u.wall):'جزيرة')+' · '+num(u.width)+' سم · U'+(g.units.indexOf(u)+1)]);}
 function library(){
  const entries=studioCatalogEntries({section:libSec}),families=[...new Map(entries.map(e=>[e.family,e.familyLabel])).entries()],list=libSec==='unit'?[]:targets();if(target&&!list.some(v=>v[0]===target)&&libSec!=='unit')target='';
  inner().innerHTML=tabset(baseTypes,libSec,'data-section')+'<div class="pr-filters"><input type="search" data-search aria-label="بحث في المكتبة" placeholder="ابحث في المكتبة…" value="'+esc(query)+'">'+(families.length>1?'<select data-family aria-label="فئة">'+opts([['','جميع الفئات'],...families],family)+'</select>':'')+'</div>'+(libSec==='unit'?'':cap(libSec==='worktop'?'سطح الصف':'الوحدة المستهدفة','<select data-cat-target>'+opts([['','اختر من التصميم'],...list],target)+'</select>'))+'<div class="pr-library-links">'+b('my-modules','نماذجي')+b('supplier','مراجع المصنّع')+'</div><div class="pr-meta" data-count></div><div class="pr-grid" data-cards></div>';
  drawCards();
 }
 function drawCards(){const arr=studioCatalogEntries({section:libSec,query,family:family||undefined});q('[data-count]').textContent=num(arr.length)+' '+(libSec==='unit'?'وحدة':'عيّنة');
  q('[data-cards]').innerHTML=arr.map(e=>'<button class="pr-card" type="button" data-entry="'+e.id+'" title="'+esc(e.label)+'">'+cardArt(e)+'<b>'+esc(e.label)+'</b><small>'+esc(e.section==='unit'?num(e.width)+' سم · '+(e.tiers.length===2?'علوي / سفلي':e.tiers[0]==='base'?'سفلي':'علوي'):e.familyLabel)+'</small></button>').join('')||'<p class="pr-empty">لا توجد نتائج.</p>';
 }
 function previewLayout(doc,id){
  if(id!=='blank'){
   const reason=designSpanIssue(doc,[{wall:layoutWall}]);
   if(reason)return {ok:false,reason};
  }
  const out=buildStudioLayout(doc.room,id,layoutWall,look,{features:doc.kitchen.features});
  const reason=out.ok&&designSpanIssue(doc,out.kitchen.runs);
  return reason?{ok:false,reason}:out;
 }
 function layoutPanel(){
  const doc=getDoc(),available=surveyedDesignWalls(doc);
  if(!available.length){
   draft=null;
   inner().innerHTML='<h3>رفع الجدار أولًا</h3><p>احفظ امتداد الدواليب من بداية الجدار إلى نهايتها المطلوبة أو ركن الجدار لفتح توزيعات المطبخ.</p>'+b('start-wall','متابعة رفع الجدار','pr-primary');
   return;
  }
  const previews=layouts.map(v=>({...v,out:previewLayout(doc,v.id)}));draft=previews.find(p=>p.id===layout)?.out;
  inner().innerHTML='<div class="pr-line"><b>صف واحد</b>'+b('draw-row','رسم صف وتعبئته','pr-primary')+b('ideas','بدائل التصميم المحفوظة')+'</div><div class="pr-line"><b>توزيع الغرفة</b><small>'+num(doc.room.width)+' × '+num(doc.room.length)+' سم</small></div><div class="pr-fields">'+cap('الجدار الرئيسي','<select data-l-wall>'+wallOptions(layoutWall)+'</select>')+cap('التشطيبات','<select data-l-look>'+opts([['project','افتراضيات المشروع'],...Object.entries(palettes).map(([id,p])=>[id,p.label])],look)+'</select>')+'</div><div class="pr-layout-grid">'+previews.map(v=>'<button type="button" class="pr-layout" data-layout-id="'+v.id+'" aria-pressed="'+(layout===v.id)+'" title="'+esc(v.out.ok?v.hint:v.out.reason)+'">'+(v.out.ok?ideaPreview({room:doc.room,kitchen:v.out.kitchen}):'<span class="pr-unfit">'+studioIcon('info')+' غير متاح</span>')+'<b>'+v.label+'</b>'+(v.out.ok?'':'<small>'+esc(v.out.reason||'')+'</small>')+'</button>').join('')+'</div><div class="pr-preview-row"><small>'+(draft?.ok?'يستبدل التوزيع الحالي · يمكن التراجع':esc(draft?.reason))+'</small><button type="button" data-pr="layout-apply" class="pr-primary" '+(draft?.ok?'':'disabled')+'>تطبيق التوزيع</button></div>';
 }
 function project(){
  const {room:r,kitchen:k}=getDoc(),name=esc(r.name||'مطبخي'),p=readWallPhotos(r),faces=sheetFaces(getDoc());
  let h=tabset({project:'بيانات الملف',room:'الغرفة وصورها',sheet:'الرسومات والتصدير'},projectTab,'data-p-tab');
  if(projectTab==='project')h+='<dl class="pr-project-facts"><div><dt>جدران الغرفة</dt><dd>'+num(roomArchitecture(r).walls.length)+'</dd></div><div><dt>وحدات التصميم</dt><dd>'+num(k.units.length)+'</dd></div><div><dt>قيم الزيارة</dt><dd>'+num(r.fieldRegister?.records?.length||0)+'</dd></div></dl><form class="pr-name-form" data-name-form>'+cap('اسم المشروع','<input data-project-name maxlength="64" value="'+name+'">')+'<button type="submit">حفظ الاسم</button></form><div class="pr-line"><small>الحفظ</small><b>في هذا المتصفح</b></div>'+backupLine(r)+'<div class="pr-actions">'+b('backup',studioIcon('download')+' تنزيل ملف المشروع','pr-primary')+b('import',studioIcon('file')+' فتح ملف مشروع')+'</div><input hidden type="file" data-json accept=".json,application/json">'+(imported?'<div class="pr-import"><b>'+esc(imported.doc.room.name||'مطبخ مستورد')+'</b><small>'+num(imported.doc.kitchen.units.length)+' وحدات · '+num(imported.doc.room.fieldRegister?.records?.length||0)+' قيم ميدانية · '+num(imported.doc.room.width)+' × '+num(imported.doc.room.length)+' سم</small>'+b('use-import','فتح هذا التصميم','pr-primary')+'</div>':'')+'<div class="pr-actions pr-actions-single">'+b('new-project',studioIcon('plus')+' مشروع جديد')+'</div><div data-saved-projects hidden></div>';
  if(projectTab==='project'&&r.projectId)h+='<div class="pr-line"><small>رقم المشروع</small><b dir="ltr">'+esc(r.projectId)+'</b></div>';
  if(projectTab==='room'){
   h+=b('field-reg','فتح سجل الزيارة والصور');
   h+=b('survey','بناء الغرفة ورفع المقاسات');const edges=roomArchitecture(r).walls;if(!edges.some(v=>v.id===wall))wall=edges[0].id;
   const cl=r.cladding||{finish:'plain',height:0,tileWidth:60,tileHeight:30};
   h+='<form data-cladding-form>'+cap('تشطيب جدران الغرفة','<select name="finish" data-cladding-finish>'+opts(Object.entries(claddingFinishes),cl.finish)+'</select>')+'<div data-cladding-dims '+(cl.finish==='plain'?'hidden':'')+'>'+cap('امتداد البلاط','<select name="extent" data-cladding-extent>'+opts([['full','حتى السقف'],['height','ارتفاع محدد من البلاط']],cl.height?'height':'full')+'</select>')+'<label class="pr-field" data-cladding-height '+(cl.height?'':'hidden')+'><span>منسوب أعلى بلاطة (مم)</span><input type="number" step="1" min="1" max="'+Math.round(r.height*10)+'" name="level" value="'+Math.min(Math.round(r.height*10),Math.round((cl.height||150)*10))+'"></label><div class="pr-fields">'+[['tileWidth','عرض البلاطة (مم)'],['tileHeight','ارتفاع البلاطة (مم)']].map(([k,v])=>cap(v,'<input name="'+k+'" type="number" step="1" min="100" max="1800" value="'+Math.round(cl[k]*10)+'">')).join('')+'</div></div><button type="submit">تطبيق تشطيب الجدران</button></form><div class="pr-sep"></div>';
   h+=cap('تشطيب الأرضية','<select data-floor>'+opts(Object.entries(floors),r.floor||'wood')+'</select>')+'<div class="pr-sep"></div>'+'<div class="pr-fields">'+cap('الكسوة فوق السطح','<select data-backsplash>'+opts([['none','بلا كسوة'],['tile','بلاط عاجي'],['marble','رخام فاتح'],['steel','فولاذ'],['wood','خشب']],r.backsplash?.finish||'tile')+'</select>')+cap('ارتفاع الكسوة (سم)','<input data-splash-h type="number" min="10" max="130" step="any" value="'+(r.backsplash?.height||56)+'">')+'</div>'+cap('الجدار','<select data-wall>'+opts(edges.map(v=>[v.id,v.label]),wall)+'</select>')+cap('دهان الجدار','<select data-wall-color>'+opts([['sand','بيج دافئ'],['stone','أبيض حجري'],['sage','أخضر فاتح']],r.colors?.[wall]||'sand')+'</select>')+'<b class="pr-subhead">صورة الجدار الحقيقي</b>';
   const sources=wallPhotoSources(r,wall);
   if(sources.length)h+=cap('استخدام صورة الزيارة خلفيةً للجدار','<select data-shared-backdrop>'+opts([['','اختر صورة لهذا الجدار'],...sources.map(f=>[f.id,f.name])],r.photoRefs?.[wall]?.slice(6))+'</select>');
   if(p[wall]){const img='<img class="pr-room-photo" src="'+p[wall]+'" alt="صورة الجدار المحدد">';h+=onPhotoForWall?'<button type="button" data-pr="measure-wall-photo">'+img+'<span>فتح الصورة وقياسات الفتحات</span></button>':img;}
   h+='<div class="pr-actions">'+b('choose-photo','رفع صورة')+b('take-photo','كاميرا الجهاز')+(p[wall]?b('clear-photo','إخفاء الخلفية'):'')+'</div><input hidden type="file" data-pic accept="image/jpeg,image/png,image/webp"><input hidden type="file" data-capture accept="image/*" capture="environment"><small class="pr-note">تُحفظ صورة الزيارة مع الجدار وتتاح لأداة القياس. إخفاء الخلفية يُبقي أصل الصورة في سجل الجدار.</small>';
  }
  if(projectTab==='sheet'){
   if(!faces.some(v=>v[0]===sheetWall))sheetWall='plan';
   const downloadMenu='<details class="pr-export"><summary aria-label="تنزيل رسم أو جدول" title="تنزيل رسم أو جدول">'+studioIcon('download')+'</summary><div>'+b('sheet-book','ملف لوحات المقاسات · HTML')+b('sheet-svg','اللوحة الحالية · SVG')+(k.units.length?b('csv','جدول الوحدات · CSV'):'')+b('svg','منظور الرسم · SVG')+'</div></details>';
   h+='<div class="pr-sheet-bar">'+cap('الواجهة','<select data-wall-sheet>'+opts(faces,sheetWall)+'</select>')+cap('وحدة القياس','<select data-units>'+opts([['cm','سم'],['mm','مم']],mm?'mm':'cm')+'</select>')+'<div class="pr-sheet-ops"><button type="button" data-pr="print" aria-label="طباعة حزمة اللوحات أو حفظ PDF" title="طباعة حزمة اللوحات أو حفظ PDF">'+studioIcon('print')+'</button>'+downloadMenu+'</div></div>';
   h+='<div class="pr-elevation">'+(sheetWall==='plan'?planSheet(getDoc(),mm,{interactive:true}):elevationSheet(getDoc(),sheetWall,mm))+'</div>';
   h+='<details class="pr-sheet-schedules"><summary>'+studioIcon('list')+'جداول المقاسات</summary>'+sheetTables(getDoc(),sheetWall==='plan'?null:sheetWall,mm,true)+'</details>';
  }
  inner().innerHTML=h;
  const savedHost=q('[data-saved-projects]');
  if(savedHost)mountSavedProjects(savedHost,{exceptId:r.projectId,
   onOpen:id=>openSavedNow(id,{current:getDoc()}),
   onDelete:id=>deleteSavedProject(id)});
  const paper=q('.pr-elevation svg');
  if(paper&&onInspectPart){
   paper.setAttribute('role','group');
   for(const el of paper.querySelectorAll(sheetSelector)){
    const item=sheetTarget(el,getDoc(),sheetWall);if(!item)continue;
    el.classList.add('pr-pick');el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',item.label);
   }
  }
  const cf=q('[data-cladding-form]');if(cf){cf.onchange=()=>{q('[data-cladding-dims]').hidden=cf.elements.finish.value==='plain';q('[data-cladding-height]').hidden=cf.elements.extent.value!=='height';};cf.onsubmit=e=>{e.preventDefault();const v=k=>cf.elements.namedItem(k).value;changeRoom({...r,cladding:{finish:v('finish'),height:v('extent')==='full'?0:Number(v('level'))/10,tileWidth:Number(v('tileWidth'))/10,tileHeight:Number(v('tileHeight'))/10}},'حُفظ تشطيب جدران الغرفة.');};}const rename=q('[data-name-form]');if(rename)rename.onsubmit=e=>{e.preventDefault();saveName();};const form=q('[data-dim-form]');if(form)form.onsubmit=e=>{e.preventDefault();const room={...r};for(const key of ['width','length','height'])room[key]=Number(form.elements.namedItem(key).value);changeRoom(room,'حُدّثت الأبعاد.');};
 }
 function saveName(){const field=q('[data-project-name]');if(!field)return;const name=field.value.trim()||'مطبخي',old=getDoc();if(name!==(old.room.name||'مطبخي')){const r=apply({...old,room:{...old.room,name}},'حُفظ اسم المشروع.');message(r?.ok===false?r.reason:'حُفظ اسم المشروع.');}}
 function changeRoom(room,msg){const clean=cleanStudioRoom(room);if(!clean)return message('المقاسات خارج النطاق.');const res=apply({...getDoc(),room:clean},msg);message(res?.ok===false?res.reason:msg);if(res?.ok!==false&&which==='project')project();}
 async function onChange(e){const t=e.target,doc=getDoc(),r=doc.room;if(t.matches('[data-family]')){family=t.value;drawCards();}else if(t.matches('[data-cat-target]'))target=t.value;
 else if(t.matches('[data-l-wall]')){layoutWall=t.value;layoutPanel();}else if(t.matches('[data-l-look]')){look=t.value;layoutPanel();}else if(t.matches('[data-wall]')){wall=t.value;project();}else if(t.matches('[data-floor]'))changeRoom({...r,floor:t.value},'تغيّرت الأرضية.');else if(t.matches('[data-backsplash],[data-splash-h]')){const height=Number(q('[data-splash-h]').value);if(!Number.isFinite(height)||height<10||height>130)return message('ارتفاع الكسوة من 10 إلى 130 سم.');changeRoom({...r,backsplash:{finish:q('[data-backsplash]').value,height}},'حُدّثت الكسوة.');}else if(t.matches('[data-wall-color]'))changeRoom({...r,colors:{...r.colors,[wall]:t.value}},'تغيّر دهان الجدار.');else if(t.matches('[data-project-name]'))saveName();else if(t.matches('[data-wall-sheet]')){sheetWall=t.value;project();}else if(t.matches('[data-units]')){mm=t.value==='mm';project();}
 else if(t.matches('[data-pic],[data-capture],[data-shared-backdrop]')){
   if(!['owner','editor','rep'].includes(getProjectAccess(doc).role)){message('تعديل صور المشروع متاح للمندوب والمالك فقط.');return;}
  const side=wall,source=t.matches('[data-shared-backdrop]')?wallPhotoSources(r,side).find(a=>a.id===t.value):null;
  try{const file=source?await fieldAttachmentStore.get(source.id):t.files?.[0];
   if(!file){if(source)throw Error('أصل الصورة غير موجود على الجهاز.');return;}
   const saved=await saveWallPhoto(r,side,file,{source,background:true});
   if(getDoc()!==doc||which!=='project'||wall!==side)return message('تغيّر الجدار أو المشروع. أعد اختيار الصورة.');
   changeRoom(saved.room,'حُفظت صورة الجدار للخلفية والقياس.');
  }catch(error){message(error.message);}
 }
 else if(t.matches('[data-json]')){const file=t.files?.[0];if(!file)return;try{if(file.size>projectArchiveSizeLimit)throw Error('الملف أكبر من 128 م.ب.');const {doc,photos,files:fieldFiles}=checkedPortableArchive(JSON.parse(await file.text()));imported={doc,photos,fieldFiles};project();message('ملف جاهز للفتح.');}catch(e){imported=null;project();message(e.message);}}
 }
 function openSheetItem(node){
  if(!onInspectPart||which!=='project'||projectTab!=='sheet'||!inner().contains(node))return false;
  const item=sheetTarget(node,getDoc(),sheetWall);
  if(!item)return false;
  close(false);onInspectPart(item.route,item.focus);return true;
 }
 async function onClick(e){if(openSheetItem(e.target))return;const exportMenu=q('.pr-export[open]');if(exportMenu&&(!exportMenu.contains(e.target)||e.target.closest('[data-pr]')))exportMenu.open=false;const t=e.target.closest('button');if(!t||!which)return;const a=t.dataset.pr;
 if(a==='close')return close();if(a==='survey'){close(false);onSurvey?.();return;}if(t.dataset.section){libSec=t.dataset.section;family='';query='';if(libFocus?.id)target=libFocus.id;message('');library();return;}
 if(t.dataset.pTab||a==='sheet-tab'){projectTab=t.dataset.pTab||'sheet';message('');project();return;}
 if(t.dataset.layoutId){layout=t.dataset.layoutId;layoutPanel();return;}
 if(t.dataset.entry){const entry={section:libSec,id:t.dataset.entry},kit=getKit();if(libSec==='unit'){if(kit.activateTool('unit',{unitKind:entry.id})){close(false);tell('انقر في الصف لوضع '+kitchenUnitSpecs[entry.id].label+'.');}return;}
 if(!target){message('اختر '+(libSec==='worktop'?'صفًا':'وحدة')+' من القائمة أولًا.');q('[data-cat-target]')?.focus();return;}
 const d=getDoc(),sel={kind:libSec==='worktop'?'run':'unit',id:target},r=applyKitchenCatalogEntry(d.kitchen,d.room,entry,sel);if(!r.ok){message(r.reason);return;}const out=apply({...d,kitchen:r.kitchen},'طُبّقت العيّنة.');message(out?.ok===false?out.reason:'طُبّقت العيّنة على التحديد.');return;}
 if(a==='start-wall'){close(false);onStartWall?.();return;}
 if(a==='draw-row'){close(false);getKit().activateTool('run',{runPlacement:'wall'});return;}
 if(a==='layout-apply'&&draft?.ok){const doc=getDoc(),fresh=previewLayout(doc,layout);if(!fresh.ok){layoutPanel();message(fresh.reason);return;}const r=apply({...doc,kitchen:fresh.kitchen},'طُبّق التوزيع.');if(r?.ok!==false)close();else message(r.reason);return;}
 if(a==='my-modules'||a==='supplier'){close(false);(a==='my-modules'?onMyModules:onSupplier)?.();return;}if(a==='ideas'){close(false);ideas();return;}if(a==='import'){q('[data-json]').click();return;}
 if(a==='new-project'){const res=newProjectNow(getDoc());if(!res.ok)message(res.reason);return;}
 if(a==='field-reg'){close(false);onFieldRegister?.();return;}
 if(a==='backup'){saveName();const d=getDoc();t.disabled=true;try{message('جارٍ تجهيز ملف المشروع…');const survey=await downloadFieldProject(d);showBackup(boxes.project,d);message(survey?'جُهز ملف المشروع مع سجل الفني ومرفقاته.':'ملف المشروع جاهز.');}catch(err){message(err.message||'تعذّر تجهيز نسخة المشروع.');}finally{t.disabled=false;}return;}
 if(a==='use-import'&&imported){const {doc,photos,fieldFiles}=imported,current=getDoc(),permission=validateProjectEdit(current,doc);if(!permission.ok)return message(permission.reason);if(!['owner','editor','rep'].includes(getProjectAccess(current).role))return message('استيراد ملف مشروع كامل متاح للمالك والمندوب؛ عدّل سجلك من بوابته.');const guard=validateProjectPlacement(current,doc,{restoreArchive:true});if(!guard.ok)return message(guard.reason);try{const room=await restoreWallPhotos(doc.room,photos,fieldFiles);await installFieldFiles(fieldFiles);const res=apply({...doc,room},current.room.projectId&&doc.room.projectId&&current.room.projectId!==doc.room.projectId?'فُتح ملف المشروع. حُفظ مشروعك السابق في مشاريعك المحفوظة.':'فُتح ملف المشروع.',{restoreArchive:true});if(res?.ok!==false){imported=null;close();}else message(res.reason);}catch(err){message(err.message);}return;}
 if(a==='measure-wall-photo'&&onPhotoForWall){const key=getDoc().room.photoRefs?.[wall];close(false);onPhotoForWall({wall,photoId:key?.startsWith('asset-')?key.slice(6):'legacy'});return;}
 if(a==='choose-photo'||a==='take-photo'){q(a==='choose-photo'?'[data-pic]':'[data-capture]').click();return;}
 if(a==='clear-photo'){const r=getDoc().room;changeRoom({...r,photoRefs:{...r.photoRefs,[wall]:'off'}},'أزيلت صورة الجدار.');return;}
 if(a==='csv'){const stamp=outputStamp(getDoc(),'المطبخ كاملًا','جدول الوحدات');downloadStudio(outputFilename(stamp,'kitchen-units','csv'),exportCSV(),'text/csv;charset=utf-8');}
 if(a==='sheet-book'){
  const doc=getDoc(),stamp=outputStamp(doc,'المطبخ كاملًا','لوحات المقاسات');
  downloadStudio(outputFilename(stamp,'kitchen-drawings','html'),kitchenDrawingBook(doc,mm,stamp),'text/html;charset=utf-8');
 }
 if(a==='svg'||a==='sheet-svg'){
  const doc=getDoc(),viewport=a==='svg',plan=sheetWall==='plan',scope=viewport||plan?'المطبخ كاملًا':(sheetFaces(doc).find(f=>f[0]===sheetWall)?.[1]||sheetWall);
  const stamp=outputStamp(doc,scope,viewport?'الرسم الحالي':plan?'مسقط المطبخ':'واجهة الجدار');
  const svg=viewport?exportSVG():plan?planSheet(doc,mm):elevationSheet(doc,sheetWall,mm);
  downloadStudio(outputFilename(stamp,viewport?'kitchen-view':plan?'kitchen-plan':'elevation-'+sheetWall,'svg'),drawingSVG(svg,stamp),'image/svg+xml');
 }
 if(a==='print'&&!printKitchen(getDoc(),mm))message('اسمح بفتح لوحة الطباعة في نافذة جديدة.');
 }
 return {open,close,active:()=>which};
}
