import {studioIcon as icon} from './kitchen-tool-icons.js';
import {workshopPartTarget,unitPartLabel} from './kitchen-sheet-target.js';
import {createGuideSession,guidePreview,mountWorkGuide} from './kitchen-work-guide-ui.js';
import {mountFinishDesk} from './kitchen-finish-desk.js';
import {decisionIssues,configuredCorners} from './kitchen-project-decisions.js';
import {intakeIssues} from './kitchen-appliance-intake.js';
import {finishMembers} from './kitchen-finish-parts.js';
import {budgetHold} from './kitchen-layout-brief.js';
import {mountServiceZones} from './kitchen-service-zones-ui.js';
import {mountTeamCatalogStep} from './kitchen-team-catalog-ui.js';
import {approveSurface,surfaceReleaseIssues} from './kitchen-surface-release.js';
import {mountSyncStep} from './kitchen-workshop-sync-ui.js';
import {mountPhotoAssist} from './kitchen-workshop-photo-ui.js';
import {mountChainStep} from './kitchen-chain-ui.js';
import {mountRowStep} from './kitchen-production-row-ui.js';
import {mountFactoryStep} from './kitchen-workshop-factory-ui.js';
import {mountQuoteStudio} from './kitchen-quote-studio.js';
import {mountProductionStudio} from './kitchen-production-studio.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {approvalState,releaseConcerns} from './kitchen-workshop-state.js';
import {registerUnsavedWork} from './kitchen-unsaved-work.js';
import {versionsCardHTML,reasonFieldHTML,recordCustomerVersion,sheetFor} from './kitchen-design-versions.js';
import {previewCustomerReport} from './kitchen-report-preview.js';
import {savedProjectText} from './kitchen-project.js';
import {backupStatus,backupReminder} from './kitchen-backup-status.js';
import {gateways,pageOwner,factoryPageOf,stageCount} from './kitchen-gateways.js';
import {getProjectAccess} from './kitchen-project-access.js';
import {canOpenWorkshopPage,canEditWorkshopPage,visibleGatewayIds,roleHome} from './kitchen-role-pages.js';
import {mountOwnerOverview} from './kitchen-owner-ui.js';
// A fault in the versions card must never take the approvals screen down with it.
const guarded=build=>{try{return build();}catch{return '';}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the window treatment with its destination so every navigation path uses the same work surface.
const steps={
 oversight:{title:'إدارة المشاريع والإشراف',layout:'workbench'},
 guide:{title:'دليل المشروع',layout:'focus'},
 assembly:{title:'قواعد الدواليب ونعلة الرخام',layout:'workbench'},
 whole:{title:'تصميم المطبخ',layout:'drawing'},
 tap:{title:'الخلاط وفتح الشباك',layout:'editor'},
 decisions:{title:'قرارات الزيارة',layout:'focus'},
 wallOptions:{title:'خيارات الجدار',layout:'editor'},
 corner:{title:'تفصيل الزوايا',layout:'workbench'},
 intake:{title:'أجهزة العميل قبل التصميم',layout:'editor'},
 survey:{title:'رفع الجدار',layout:'drawing'},
 outline:{title:'محيط الغرفة',layout:'drawing'},
 surfaces3d:{title:'مناسيب الأرضية والسقف',layout:'editor'},
 profile:{title:'مسح واستقامة الجدار',layout:'editor'},
 measure:{title:'دقة القياس والخلوص',layout:'editor'},
 routes:{title:'مسارات الصرف والشفاط',layout:'editor'},
 logistics:{title:'تجهيز الموقع والتوريد',layout:'editor'},
 zones:{title:'الخدمات والتثبيت',layout:'editor'},
 photo:{title:'رفع الفتحات من صورة',layout:'media'},
 row:{title:'تعبئة الصف',layout:'drawing'},
 uses:{title:'استخدام العميل',layout:'editor'},
 appliances:{title:'ملاءمة الأجهزة للوحدات',layout:'editor'},
 approve:{title:'تثبيت الهيكل',layout:'focus'},
 finish:{title:'الخامات والعتاد',layout:'media'},
 quote:{title:'الحصر والسعر',layout:'workbench'},
 production:{title:'الورشة والتصنيع',layout:'workbench'},
 sign:{title:'الاعتماد',layout:'focus'},
 surface:{title:'قالب السطح',layout:'workbench'},
 factory:{title:'وصفات المشروع',layout:'workbench'},
 team:{title:'كتالوج الفريق',layout:'workbench'},
 inventory:{title:'رصيد المخزون',layout:'workbench'},
 sync:{title:'مشاريع الفريق',layout:'focus'},
 tracking:{title:'التركيب والتسليم',layout:'workbench'},
 maintenance:{title:'الصيانة وما بعد البيع',layout:'workbench'},
 home:{title:'بوابات العمل',layout:'focus'},
 store:{title:'الأصناف والأسعار',layout:'workbench'},
 libraries:{title:'مكتبات المتجر',layout:'workbench'},
 recipes:{title:'وصفات التفصيل والبناء',layout:'workbench'},
 machines:{title:'القص والماكينات',layout:'workbench'},
 sale:{title:'شروط البيع والتسعير',layout:'workbench'},
 template:{title:'الاعتماد وكتالوج الجهاز',layout:'workbench'}
};
// The pages are grouped by the gateway that owns them (kitchen-gateways.js): the store, the factory, the rep and the result. A group that is a
// stage of the customer's visit carries its number, so the journey still reads «المرحلة n من ٤» across the gateways.
const aliases={chain:'survey',rows:'row',finishes:'finish',approval:'approve',catalog:'factory',cost:'quote',structure:'approve',customer:'sign'};
const number=n=>new Intl.NumberFormat('ar-SA').format(n);
const homeOwner={gateway:{title:'بوابات العمل'},group:{title:'الشاشة الرئيسية'}};
const ownerOf=route=>route==='home'?homeOwner:pageOwner(route);
// «factory» is the old single catalog page of twelve sections; it lands on the page of the section it was asked for.
const resolveStep=(step,focus)=>{const known=Object.hasOwn(steps,step)?step:(Object.hasOwn(aliases,step)?aliases[step]:'survey');return known==='factory'?factoryPageOf(focus?.tab):known;};
export const workshopRoute=resolveStep;
const factoryPage=page=>(host,args)=>mountFactoryStep(host,{...args,page});
const listedPages=Object.keys(steps).filter(key=>key!=='factory'&&key!=='home');

// Working drawings have their own draft instructions. Entity questions in the
// project guide may point to a different wall, device or unit on the same page.
export function workshopGuideQuestion(route,task){
 if(!task||task.step!==route||steps[route]?.layout==='drawing'||Object.keys(task.focus||{}).length)return '';
 return task.question;
}
// Search terms reflect the names that reps use on site. All destinations still
// go through the normal router and its draft and approval checks.
const pageTerms={
 oversight:['check','إدارة المشاريع المالك إشراف مراحل عوائق موافقات تسعير صلاحيات المشاركين'],
 guide:['guide','السؤال المطلوب الخطوة التالية'],assembly:['layers','أرجل ساتر بلنث وزرة رخام'],
 whole:['drawing','توزيع مطبخ بدائل اقتراح'],tap:['frame','صنبور نافذة شباك'],
 decisions:['guide','اختيارات العميل زيارة'],wallOptions:['elevation','سخان ستارة كورنيش'],
 corner:['room','زاوية ركن سلة'],intake:['box','فرن ثلاجة غسالة مايكرويف'],
 survey:['ruler','أبواب شبابيك نوافذ خدمات جدران'],outline:['room','شكل الغرفة محيط مضلع'],
 surfaces3d:['layers','عتبة درجة بلاعة ميل الأرضية'],profile:['ruler','ميلان الجدار ظهر وجه'],
 measure:['target','سماحية قياسات خلف أمام'],routes:['drawing','صرف صحي شفاط مواسير'],
 logistics:['box','زيارة تركيب توصيل دخول'],zones:['target','كهرباء سباكة غاز ممنوع حفر'],
 photo:['camera','صورة كاميرا معايرة'],row:['elevation','صف علوي سفلي تعبئة'],
 uses:['box','أرز رز درج تخزين أواني'],appliances:['cube','تهوية موديل ثلاجة غسالة فرن'],
 approve:['check','اعتماد الهيكل تثبيت'],finish:['swatches','ألوان الخامات مقابض يد حواف مفصلات'],
 quote:['quote','تسعير تكلفة فاتورة كميات'],sign:['check','توقيع عميل إفراج ورشة'],
 production:['factory','ورشة تصنيع قطع قص تجميع خام تشغيل اعتماد إنتاج'],
 surface:['layers','رخام سطح قالب قص'],factory:['factory','كتالوج خامة تيوبات حواف وصفة'],
 team:['library','مكتبة كتالوج نسخ الفريق'],inventory:['box','مخزون حجز صرف توريد'],
 sync:['file','مزامنة نسخة احتياطية مشاريع الفريق'],tracking:['guide','تتبع تصنيع استلام أمر'],
 maintenance:['guide','صيانة بلاغ ضمان خدمة إصلاح ما بعد البيع اعتماد العميل'],
 home:['plan','بوابات المتجر المصنع المندوب النتيجة الرئيسية'],store:['swatches','خامات مواد ألواح حواف إكسسوارات أصناف أسعار شراء كتالوج المتجر'],
 libraries:['library','مكتبات أجهزة أحواض خردوات مفصلات سكك مقابض موديلات إكسسوارات'],recipes:['factory','وصفات قص بناء تفصيل وحدات ركن قطع خاصة كورنيش إنارة'],
 machines:['ruler','ماكينات قص منشار تشغيل فاقد'],sale:['quote','بيع تسعير أجور نقل تركيب هامش ضريبة'],template:['check','اعتماد وصفات كتالوج الجهاز قالب']
};
function normalizeSearch(value){
 return String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().trim();
}
function routeButton(key,active,from){
 return '<button type="button" data-step="'+key+'"'+(from?' data-link="true"':'')+(key===active?' aria-current="page"':'')+(key==='guide'?' class="ws-guide-jump"':'')+'>'+icon(pageTerms[key][0])+'<span>'+steps[key].title+'</span>'+(from?'<small class="ws-from">'+from+'</small>':'')+'</button>';
}
export function workshopPageMatches(query,role='owner'){
 const words=normalizeSearch(query).split(/\s+/).map(word=>word.length>3&&word.startsWith('ال')?word.slice(2):word);
 return listedPages.filter(key=>{
  if(!canOpenWorkshopPage(role,key))return false;
  const own=ownerOf(key),haystack=normalizeSearch([steps[key].title,own.gateway.title,own.group.title,pageTerms[key][1]].join(' '));
  return words.every(word=>haystack.includes(word));
 });
}
function searchedPages(query,active,role){
 const matches=workshopPageMatches(query,role);
 if(!matches.length)return '<p class="ws-find-empty" role="status">لم نعثر على صفحة. جرّب اسم المادة أو الأداة.</p>';
 return '<p class="ws-find-count" role="status">الصفحات المطابقة · '+number(matches.length)+'</p>'+gateways.map(g=>{
  const keys=matches.filter(key=>ownerOf(key).gateway===g);
  return keys.length?'<section class="ws-found-group"><h3>'+g.title+'</h3><div class="ws-tool-links">'+keys.map(key=>routeButton(key,active)).join('')+'</div></section>':'';
 }).join('');
}
export function renderWorkshopPicker(active,role='owner'){
 return '<label class="ws-page-search">'+icon('search')+'<input type="search" data-ws-search autocomplete="off" aria-label="بحث في صفحات الاستوديو" placeholder="ابحث عن صفحة أو أداة"></label><div data-ws-destinations>'+gatewayTree(active,role)+'</div>';
}
// One row of a gateway: the main page of the group, its tools, the pages of other gateways it reaches for, and the technical checks.
function groupRow(group,active,own,role){
 const selected=own?.group===group;
 group={...group,tools:group.tools.filter(p=>canOpenWorkshopPage(role,p)),technical:group.technical.filter(p=>canOpenWorkshopPage(role,p)),links:(group.links||[]).filter(p=>canOpenWorkshopPage(role,p))};
 const more=group.tools.length+group.technical.length+group.links.length;
 const expand=more?'<details class="ws-route-tools"'+(selected&&active!==group.main?' open':'')+'><summary aria-label="أدوات '+group.title+'" title="أدوات '+group.title+'"><span>الأدوات</span>'+icon('chevron')+'</summary>'+
  '<div class="ws-tool-links">'+group.tools.map(k=>routeButton(k,active)).join('')+(group.links||[]).map(k=>routeButton(k,active,pageOwner(k).gateway.title)).join('')+(group.technical.length?'<details class="ws-route-technical"'+(group.technical.includes(active)?' open':'')+'><summary>القياسات والفحوص</summary><div>'+group.technical.map(k=>routeButton(k,active)).join('')+'</div></details>':'')+'</div></details>':'';
 return '<div class="ws-stage-row"'+(selected?' data-current-group':'')+'><button class="ws-stage-destination" type="button" data-step="'+group.main+'"'+(active===group.main?' aria-current="page"':'')+'>'+(group.stage?'<span class="ws-stage-number">'+number(group.stage)+'</span>':'')+icon(pageTerms[group.main][0])+'<span>'+group.title+'</span>'+(selected?'<small class="ws-current-stage">الحالية</small>':'')+'</button>'+expand+'</div>';
}
function gatewayTree(active,role='owner'){
 const own=ownerOf(active);
 const visible=visibleGatewayIds(role);
 return '<p class="ws-picker-title">بوابات العمل</p><div class="ws-home-link">'+routeButton('home',active)+(canOpenWorkshopPage(role,'quote')&&!visible.includes('result')?routeButton('quote',active):'')+'</div>'+gateways.filter(g=>g.minor||visible.includes(g.id)).map(g=>
  '<details class="ws-gateway" data-gateway="'+g.id+'"'+(own?.gateway===g?' open':'')+(g.minor?' data-minor':'')+'><summary>'+icon(g.icon)+'<span class="ws-gateway-name">'+g.title+'</span><small>'+g.lead+'</small>'+icon('chevron')+'</summary><div class="ws-gateway-body">'+
  g.groups.filter(group=>canOpenWorkshopPage(role,group.main)).map(group=>groupRow(group,active,own,role)).join('')+(g.extras||[]).filter(key=>canOpenWorkshopPage(role,key)).map(key=>'<div class="ws-guide-destination">'+routeButton(key,active)+'</div>').join('')+'</div></details>').join('');
}

const lazySteps={maintenance:()=>import('./kitchen-maintenance-studio.js').then(m=>m.mountMaintenanceStudio),home:()=>import('./kitchen-gateways-ui.js').then(m=>m.mountGateways),libraries:()=>import('./kitchen-library-ui.js').then(m=>m.mountLibraryPage),assembly:()=>import('./kitchen-fitout-ui.js').then(m=>m.mountFitout),whole:()=>import('./kitchen-whole-plan-ui.js').then(m=>m.mountWholePlan),tap:()=>import('./kitchen-tap-window-ui.js').then(m=>m.mountTapWindow),decisions:()=>import('./kitchen-project-decisions-ui.js').then(m=>m.mountProjectDecisions),corner:()=>import('./kitchen-production-row-corner-ui.js').then(m=>m.mountCornerUI),wallOptions:()=>import('./kitchen-project-wall-ui.js').then(m=>m.mountProjectWallOptions),intake:()=>import('./kitchen-appliance-intake-ui.js').then(m=>m.mountApplianceIntake),surfaces3d:()=>import('./kitchen-surveyed-surfaces-ui.js').then(m=>m.mountMeasuredSurfaces),measure:()=>import('./kitchen-measure-fit-ui.js').then(m=>m.mountMeasureFit),routes:()=>import('./kitchen-pipe-routes-ui.js').then(m=>m.mountPipeRoutes),logistics:()=>import('./kitchen-install-readiness-ui.js').then(m=>m.mountInstallReadiness),surface:()=>import('./kitchen-surface-pattern-ui.js').then(m=>m.mountSurfacePattern),profile:()=>import('./kitchen-wall-profile-ui.js').then(m=>m.mountWallProfiles),uses:()=>import('./kitchen-client-usage-ui.js').then(m=>m.mountClientUsage),appliances:()=>import('./kitchen-appliance-fit-ui.js').then(m=>m.mountApplianceFit),tracking:()=>import('./kitchen-order-tracking-ui.js').then(m=>m.mountOrderTracking),outline:()=>import('./kitchen-measured-outline-ui.js').then(m=>m.mountMeasuredOutline),inventory:()=>import('./kitchen-workshop-inventory-ui.js').then(m=>m.mountInventoryStep)};

function frontUnits(doc){
 const cat=getFactoryCatalog(doc);return finishMembers(doc,cat).filter(u=>cat.families[u.family]?.recipe.some(l=>l.role==='front'));
}
export function mountWorkshop(el,{getDoc,apply,tell,closeOthers,opener,onExternalStep,onGuideChange,onHistory,canHistory}){
 const currentRole=()=>getProjectAccess(getDoc()).role;
 let renderedRole=currentRole(),permissionObserver=null,accessFrozen=false;
 const panel=document.createElement('aside');
 panel.className='k-workshop';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','k-ws-title');
 panel.innerHTML='<header class="ws-route-head"><button type="button" class="ws-route-icon" data-ws-back hidden aria-label="رجوع" title="رجوع">'+icon('back')+'</button>'+
   '<button type="button" class="ws-route-chooser" data-ws-chooser aria-expanded="false" aria-controls="k-workshop-picker" aria-label="اختيار المرحلة" aria-describedby="k-ws-stage k-ws-title"><span class="ws-route-symbol"></span><span class="ws-route-titles"><small data-ws-stage id="k-ws-stage"></small><strong data-ws-title id="k-ws-title"></strong></span>'+icon('chevron')+'</button>'+
   '<button type="button" class="ws-guide-chip" data-ws-guide title="دليل المشروع">'+icon('guide')+'<span class="ws-guide-copy"><small data-guide-label>دليل المشروع</small><b data-guide-question></b></span></button>'+
   '<button type="button" class="ws-route-icon ws-dismiss" data-ws-close aria-label="الرجوع للرسم" title="الرجوع للرسم">'+icon('drawing')+'</button></header>'+
   '<button type="button" data-ws-scrim class="ws-route-scrim" aria-label="إغلاق اختيار المرحلة" tabindex="-1" hidden></button><nav class="ws-route-picker" id="k-workshop-picker" aria-label="مراحل المشروع وأدواته" hidden></nav><div class="ws-content" tabindex="-1"></div><p class="ws-notice" role="status" aria-live="polite"></p>';
 el.append(panel);
 const viewport=panel.querySelector('.ws-content'),status=panel.querySelector('.ws-notice'),picker=panel.querySelector('.ws-route-picker');
 const chooser=panel.querySelector('[data-ws-chooser]'),back=panel.querySelector('[data-ws-back]'),scrim=panel.querySelector('[data-ws-scrim]'),trail=[];
 const mobile=window.matchMedia('(max-width: 700px)');
 let active='whole',context={},content=null,dispose=null,requestLeave=null,serial=0,applyLocal=false,wholeCache=null,leaveToken=0,viewDoc=null,returnFocus=null,commandContext=null;

 const guide=createGuideSession(getDoc);
 const guideButton=panel.querySelector('[data-ws-guide]');
 function updateGuideShortcut(state){
   const task=state.status==='ready'?state.report.current:null;
   const text=workshopGuideQuestion(active,task);
   const label=text?'المطلوب الآن':'دليل المشروع';
   guideButton.querySelector('[data-guide-label]').textContent=label;
   const question=guideButton.querySelector('[data-guide-question]');
   question.textContent=text;
   question.hidden=!text;
   guideButton.title=text||'متابعة المطلوب في المشروع';
   guideButton.setAttribute('aria-label',text?label+' · '+text:label);
 }
 guide.subscribe(state=>{
   updateGuideShortcut(state);
   onGuideChange?.(guidePreview(state));
 });
 void guide.refresh();
 let formDirty=false,guideDeparture=null,dropWhole=false;
 function noteEdit(e){
   if(dispose?.tracksDraft?.(e.target))return;
   if(e.target.isConnected!==false&&e.target.closest?.('form')&&e.target.matches?.('input:not([type="search"]):not([type="file"]),textarea,select'))formDirty=true;
 }
 viewport.addEventListener('input',noteEdit);viewport.addEventListener('change',noteEdit);
 for(const event of ['click','submit','change','beforeinput'])viewport.addEventListener(event,e=>{if(accessFrozen){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 viewport.addEventListener('keydown',e=>{if(accessFrozen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 // Closing or reloading the page with a half-filled step loses it. The wall survey and the design draft keep their own copy in the
 // draft store and say so themselves; every other step is asked here.
 registerUnsavedWork({atRisk:()=>!panel.hidden&&!['survey','whole'].includes(active)&&(formDirty||!!dispose?.hasPending?.())});

 function notify(s){status.textContent=s||'';tell(s||'');}
 function commit(next,msg,options){
   if(active!=='sync'&&!canEditWorkshopPage(currentRole(),active)){
    const reason='هذه الصفحة للعرض فقط ضمن صلاحيتك الحالية.';notify(reason);return {ok:false,saved:false,changed:false,reason};
   }
   if(viewDoc!==getDoc()){
     const reason='تغيّر المشروع أثناء التحرير. احتفظ بالقياسات التي كتبتها ثم افتح النسخة الحالية قبل التطبيق.';
     notify(reason);return {ok:false,saved:false,changed:false,reason};
   }
   applyLocal=true;let result;try{result=apply(next,msg,options);}finally{applyLocal=false;}
   if(result?.ok!==false){viewDoc=getDoc();if(result?.saved!==false)formDirty=false;void guide.refresh();}
   notify(result?.ok===false?result.reason:result?.saved===false?'طُبّق التغيير في الجلسة وتعذّر حفظه في المتصفح.':msg||'تم الحفظ.');return result;
 }
 function setPicker(open,focus=true,keyboard=false){
   chooser.setAttribute('aria-expanded',String(open));picker.hidden=!open;scrim.hidden=!open;viewport.inert=open;
   if(open){
     picker.innerHTML=renderWorkshopPicker(active,currentRole());
     if(focus)((keyboard&&picker.querySelector('[data-ws-search]'))||picker.querySelector('[aria-current="page"]')||picker.querySelector('button'))?.focus();
   }else if(focus)chooser.focus({preventScroll:true});
 }
 function surveyHistory(forward,focus){
   if(accessFrozen||!['survey','whole','finish','quote','production','oversight'].includes(active)||!canEditWorkshopPage(currentRole(),active))return {ok:false,reason:'هذه الصفحة للعرض فقط ضمن صلاحيتك الحالية.'};
   if(viewDoc!==getDoc())return {ok:false,reason:'تغيّر المشروع أثناء التحرير. افتح النسخة الحالية قبل التراجع.'};
   const before=getDoc(),scroll=viewport.scrollTop,route=active;let result;
   applyLocal=true;try{result=onHistory?.(forward);}finally{applyLocal=false;}
   if(getDoc()!==before){
    viewDoc=getDoc();formDirty=false;
    navigate(route,focus,'refresh',scroll);
     const preferred=viewport.querySelector(route==='oversight'?'[data-os-action="'+(forward?'redo':'undo')+'"]':route==='production'?'[data-production-action="'+(forward?'redo':'undo')+'"]':route==='quote'?'[data-quote-action="'+(forward?'redo':'undo')+'"]':route==='finish'?'[data-finish-'+(forward?'redo':'undo')+']':route==='whole'?'[data-wp="design-'+(forward?'redo':'undo')+'"]':'[data-chain-act="'+(forward?'notebook-redo':'notebook-undo')+'"]');
    (preferred&&!preferred.disabled?preferred:viewport.querySelector('.sv-notebook-history button:not(:disabled)')||viewport.querySelector('[data-chain-wall]'))?.focus({preventScroll:true});
    notify(forward?'أُعيد التعديل المحفوظ في المشروع.':'تم التراجع عن آخر تغيير محفوظ في المشروع.');
   }
   return result;
 }
 picker.addEventListener('input',event=>{
   if(!event.target.matches?.('[data-ws-search]'))return;
   const query=event.target.value.trim();
   picker.querySelector('[data-ws-destinations]').innerHTML=query?searchedPages(query,active,currentRole()):gatewayTree(active,currentRole());
 });
 picker.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&event.target.matches?.('[data-ws-search]')&&event.target.value.trim()){
     const links=picker.querySelectorAll('[data-step]');
     if(links.length===1){event.preventDefault();links[0].click();}
   }
 });
 function updateHeader(){
   updateGuideShortcut(guide.read());
   const own=ownerOf(active);
   panel.dataset.wsRoute=active;panel.dataset.wsLayout=steps[active].layout;guideButton.hidden=active==='guide'||active==='home'||!canOpenWorkshopPage(currentRole(),'guide');
   panel.querySelector('.ws-route-symbol').innerHTML=icon(pageTerms[active][0]);
   panel.querySelector('[data-ws-stage]').textContent=active==='home'?own.group.title:own.group.stage?'المرحلة '+number(own.group.stage)+' من '+number(stageCount)+' · '+own.group.title:own.gateway.title+' · '+own.group.title;
   panel.querySelector('[data-ws-title]').textContent=steps[active].title;
   back.hidden=!trail.length;
   back.setAttribute('aria-label',trail.length?'رجوع إلى '+steps[trail.at(-1).step].title:'رجوع');
 }
 function forgetWhole(){wholeCache?.dispose?.();wholeCache=null;}
 function unmount(keepProposal){
   permissionObserver?.disconnect();permissionObserver=null;
   if(keepProposal&&!dropWhole&&active==='whole'&&content&&dispose){
     forgetWhole();wholeCache={node:content,dispose,requestLeave,commandContext,doc:viewDoc,scroll:viewport.scrollTop};content.remove();
   }else dispose?.();
   dropWhole=false;dispose=null;requestLeave=null;commandContext=null;content=null;
 }
 function hide(focus){
   if(panel.hidden)return;
   serial++;leaveToken++;guideDeparture=null;setPicker(false,false);unmount(true);panel.hidden=true;
   opener?.setAttribute('aria-expanded','false');
   if(focus)(returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:opener)?.focus({preventScroll:true});
   returnFocus=null;
 }
 function guard(proceed){
   setPicker(false,false);
   if((formDirty||dispose?.hasPending?.())&&!dropWhole&&!requestLeave){
     guideDeparture=proceed;
     status.innerHTML='<span>لديك تعديلات لم تُحفظ في هذه الخطوة.</span> <button type="button" data-guide-stay>متابعة التعديل</button> <button type="button" data-guide-discard>ترك التعديلات والمتابعة</button>';
     status.querySelector('[data-guide-stay]').focus();return false;
   }
   const token=++leaveToken;
   const once=()=>{if(token!==leaveToken||panel.hidden)return;leaveToken++;proceed();};
   if(requestLeave&&requestLeave(once)===false)return false;
   once();return true;
 }
 function close(focus=false){
   if(panel.hidden)return true;
   if(['store','factory'].includes(currentRole())){guard(()=>navigate('home'));return false;}
   return focus?guard(()=>hide(true)):(hide(false),true);
 }
 function requestClose(proceed){
   if(panel.hidden){proceed?.();return true;}
   return guard(()=>{hide(false);proceed?.();});
 }
 function navigate(next,focus={},mode='push',scroll=0){
   next=resolveStep(next,focus);
   if(!canOpenWorkshopPage(currentRole(),next)){tell('هذه الصفحة خارج صلاحيتك الحالية.');next=roleHome(currentRole());focus={};}
   const same=next===active&&JSON.stringify(focus)===JSON.stringify(context);
   if(mode==='push'&&same&&!panel.hidden&&content){setPicker(false);return;}
   if(mode==='push'&&content){
     const origin=active==='whole'?(dropWhole?{}:dispose?.selectionForReturn?.()||{}):['production','tracking','maintenance','oversight'].includes(active)?(commandContext?.()||context):context;
     trail.push({step:active,focus:origin,scroll:viewport.scrollTop});if(trail.length>32)trail.shift();
   }
   serial++;leaveToken++;unmount(mode!=='refresh'&&next!==active);
   guideDeparture=null;formDirty=false;accessFrozen=false;active=next;context=focus;viewDoc=getDoc();setPicker(false,false);viewport.replaceChildren();status.textContent='';viewport.scrollTop=0;
   updateHeader();
   if(wholeCache&&wholeCache.doc!==getDoc())forgetWhole();
   if(active==='whole'&&wholeCache&&mode!=='refresh'){
     const cache=wholeCache;wholeCache=null;content=cache.node;dispose=cache.dispose;requestLeave=cache.requestLeave;commandContext=cache.commandContext;viewport.append(content);
     viewport.scrollTop=mode==='back'?scroll:cache.scroll;chooser.focus({preventScroll:true});return;
   }
   if(active==='whole')forgetWhole();
   content=document.createElement('div');content.className='ws-screen';viewport.append(content);
   const host=content,ticket=serial;
   function bind(controller){
     if(panel.hidden||ticket!==serial){if(typeof controller==='function')controller();else controller?.destroy?.();return;}
     dispose=typeof controller==='function'?controller:controller?.destroy?.bind(controller);
     if(dispose&&typeof controller!=='function')for(const key of ['hasPending','tracksDraft','discard'])if(controller?.[key])dispose[key]=controller[key].bind(controller);
     if(dispose&&controller?.discard)dispose.discardDraft=controller.discard.bind(controller);
     requestLeave=controller?.requestLeave?.bind(controller);
     commandContext=controller?.commandContext?.bind(controller);
     lockReadOnly();
     if(scroll)viewport.scrollTop=scroll;
   }
   function beginFromHere(dest,target){
     if(content===host&&!panel.hidden)begin(dest||({row:'approve',factory:'row'}[active]||'sign'),target);
   }
   const mounts={oversight:mountOwnerOverview,guide:mountWorkGuide,survey:mountChainStep,zones:mountServiceZones,team:mountTeamCatalogStep,photo:mountPhotoAssist,sync:mountSyncStep,row:mountRowStep,factory:mountFactoryStep,quote:mountQuoteStudio,production:mountProductionStudio,
    store:factoryPage('store'),recipes:factoryPage('recipes'),machines:factoryPage('machines'),sale:factoryPage('sale'),template:factoryPage('template')};
   const args={getDoc,guide,focus,apply:commit,tell:notify,refresh:()=>{if(content===host&&!panel.hidden)navigate(active,context,'refresh',viewport.scrollTop);},onAdvance:beginFromHere,
    onHistory:surveyHistory,canHistory:forward=>!accessFrozen&&canEditWorkshopPage(currentRole(),active)&&!!canHistory?.(forward),canEdit:()=>!accessFrozen&&canEditWorkshopPage(currentRole(),active)};
   // An editor may focus an exact drawer, record or material as it mounts.
   if(mode!=='refresh')chooser.focus({preventScroll:true});
   function showLoadError(){
     if(ticket!==serial||panel.hidden)return;
     host.removeAttribute('aria-busy');
     host.innerHTML='<section class="ws-load-error"><p role="status">تعذّر فتح هذه الصفحة.</p><button type="button" data-ws-retry>إعادة المحاولة</button></section>';
   }
   if(lazySteps[active]){
     host.setAttribute('aria-busy','true');
     content.textContent='جارٍ التحميل…';
     lazySteps[active]().then(mount=>{
       if(ticket!==serial||panel.hidden)return;
       bind(mount(host,args));host.removeAttribute('aria-busy');
     }).catch(showLoadError);
   }else if(mounts[active])bind(mounts[active](host,args));else{
     host.setAttribute('aria-busy','true');
     approvals(ticket).then(()=>{
       if(ticket!==serial)return;
       host.removeAttribute('aria-busy');lockReadOnly();if(scroll)viewport.scrollTop=scroll;
     }).catch(showLoadError);
   }
 }
 function enterStep(step,focus={}){
   const external=['defaults','assist','field','placement','cad-run','cad-material','top-detail','unit-interior','room-finish','field-part','floor-point'].includes(step);
   if(!canOpenWorkshopPage(currentRole(),external?step:resolveStep(step,focus))){notify('هذه الصفحة خارج صلاحيتك الحالية.');navigate(roleHome(currentRole()));return;}
   if(['defaults','assist','field','placement','cad-run','cad-material','top-detail','unit-interior','room-finish','field-part','floor-point'].includes(step)&&onExternalStep){
     const origin=step==='unit-interior'&&active==='whole'?dispose?.selectionForReturn?.():null;
     hide(false);if(origin)onExternalStep(step,focus,origin);else onExternalStep(step,focus);return;
   }
   navigate(step,focus);
 }
 function begin(step,focus={}){
   const part=workshopPartTarget(getDoc(),step,focus);
   if(!part){notify('تغيّر العنصر المحدد. أعد اختياره من الرسم.');return;}
   step=part.route;focus=part.focus;
   if(step===active&&content&&JSON.stringify(context)===JSON.stringify(focus)){
     setPicker(false);return;
   }
   guard(()=>enterStep(step,focus));
 }
 function followCurrentTask(){
   if(!canOpenWorkshopPage(currentRole(),'guide')){navigate('home');return;}
   guard(()=>{
     // Saving a pending visit can change the next question while its guard is open.
     const task=guide.read().report?.current;
     if(!guide.contains(task)||guide.quick(task).length){navigate('guide');return;}
     const focus=task.focus||{};
     if(task.step===active&&Object.keys(focus).every(key=>context[key]===focus[key])){
       navigate('guide');return;
     }
     enterStep(task.step,focus);
     if(!panel.hidden&&active===task.step)status.textContent=task.question;
   });
 }
 function goBack(){
   if(!picker.hidden){setPicker(false);return;}
   if(!trail.length){close(true);return;}
   guard(()=>{const to=trail.pop();navigate(to.step,to.focus,'back',to.scroll);});
 }
 async function approvals(ticket){
   const doc=getDoc(),w=doc.room.workshop||{};
   content.textContent='جارٍ مراجعة نسخة التصميم…';
   let state;
   state=await approvalState(doc);
   if(ticket!==serial||panel.hidden)return;
   const stamp=(k)=>state.valid[k]?'معتمد · '+esc(w.approvals[k].name):w.approvals?.[k]?'تغيّرت البيانات بعد الاعتماد':'بانتظار الاعتماد';
   const card=(label,body)=>'<article class="ws-card"><h3>'+label+'</h3>'+body+'</article>';
   const action=(key,text,disabled=false)=>'<button type="button" class="ws-action" data-ws-action="'+key+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
   const who='<label>اسم المعتمِد<input data-ws-person maxlength="90" autocomplete="name" placeholder="الاسم المسجل على هذه النسخة"></label>';
   const review=state.designReview;
   const designNote=review?'<p class="ws-subtle">'+esc(review.reason)+'</p>'+action('review-placement','تعديل الوحدة على الرسم'):'';
   const fUnits=frontUnits(doc),cat=getFactoryCatalog(doc),fronts=cat.items.filter(i=>i.kind==='panel'&&i.role==='front');
   const count=new Set(frontUnits(doc).map(u=>doc.kitchen.units.find(x=>x.id===u.id)?.runId).concat(Object.keys(w.rows||{}))).size;
   if(active==='approve'){
     const intakeProblems=[...new Set(intakeIssues(doc))],decisionProblems=[...new Set(decisionIssues(doc))];
     const hasLayout=!!(count||configuredCorners(w));
     const blockers=(name,issues,key,label)=>issues.length?'<section class="dp-approval-issue"><h4>'+name+' <b>'+number(issues.length)+'</b></h4><ul>'+issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>'+action(key,label)+'</section>':'';
     content.innerHTML='<section class="ws-card dp-structure"><header><h3>تثبيت التوزيع والهيكل</h3><span class="ws-state">'+stamp('structure')+'</span></header><dl class="dp-structure-count"><div><dt>صفوف من كتالوج المشروع</dt><dd>'+number(count)+'</dd></div><div><dt>وحدات على الرسم</dt><dd>'+number(doc.kitchen.units.length)+'</dd></div></dl>'+
       (configuredCorners(w)?'<p>يتضمن التصميم ركنًا بوصفة تصنيع.</p>':'')+(!hasLayout?'<p>يتطلب الاعتماد صفًا من كتالوج المشروع أو ركنًا بوصفة تصنيع.</p>'+action('to-layout','فتح توزيع الدواليب'):'')+
       blockers('أجهزة العميل',intakeProblems,'to-intake','مراجعة الأجهزة')+blockers('قرارات الزيارة',decisionProblems,'decisions','فتح قرارات الزيارة')+designNote+
       '<div class="dp-structure-sign"><p>يرتبط الاعتماد بأبعاد الوحدات ووظائفها ووصفات تصنيع هذه النسخة.</p>'+who+action('structure','اعتماد الهيكل والانتقال للخامات',!!review||!hasLayout||intakeProblems.length||decisionProblems.length)+'</div></section>';
   }else if(active==='finish'){
     if(!state.valid.structure){
       const unit=doc.kitchen.units.find(u=>u.id===context.unitId);
       const label=unit&&context.part?unitPartLabel(doc,unit,context.part,context.index):'اختيارات الواجهات';
       content.innerHTML='<section class="ws-card dp-finish-gate"><div class="dp-gate-mark" aria-hidden="true">'+icon('swatches')+'</div><div><h3>'+esc(label)+'</h3><p>يُفتح كتالوج الخامات المتوافقة بعد اعتماد هيكل هذا المشروع.</p>'+action('to-structure','مراجعة الهيكل')+'</div></section>';return;
     }
     const desk=mountFinishDesk(content,{doc,catalog:cat,getDoc,focus:context,
       canEdit:()=>!accessFrozen&&canEditWorkshopPage(currentRole(),'finish'),onHistory:surveyHistory,canHistory:forward=>!accessFrozen&&canEditWorkshopPage(currentRole(),'finish')&&!!canHistory?.(forward),
       onSurvey:item=>begin('survey',{wall:item.wall,featureId:item.id,edit:true}),
       onInspectPart:(route,focus)=>begin(route,focus),
       onApply:async(makeNext,message,selection)=>{
         try{
           const review=await approvalState(doc);
           if(ticket!==serial||panel.hidden)return {ok:false,reason:'أُغلقت مساحة التشطيب.'};
           if(doc!==getDoc()||!review.valid.structure||accessFrozen||!canEditWorkshopPage(currentRole(),'finish')){const reason='تغيّر التصميم أو صلاحية التحرير. راجع اعتماد الهيكل قبل تطبيق التشطيب.';notify(reason);return {ok:false,reason};}
           const ok=commit(makeNext(),message);
           if(ok?.ok!==false){navigate('finish',{...context,...selection},'refresh',viewport.scrollTop);notify(ok?.saved===false?'طُبّق التشطيب في الجلسة، وتعذّر حفظه في المتصفح. نزّل ملف المشروع للاحتفاظ به.':message);}
           return ok;
         }catch(err){if(ticket===serial&&!panel.hidden)notify(err.message);return {ok:false,reason:err.message};}
       }});
     dispose=()=>desk.destroy();dispose.hasPending=desk.hasPending;dispose.tracksDraft=desk.tracksDraft;dispose.discardDraft=desk.discard;commandContext=desk.commandContext;
   }else{
     const issues=releaseConcerns(doc,state),canCustomer=!review&&state.valid.structure&&state.quote.complete&&!state.quote.fitoutPending?.length&&!budgetHold(state.quote,w.layoutBrief);
     const template=cat.terms.worktop==='include'?card('قالب سطح العمل', '<p>'+esc(surfaceReleaseIssues(doc)[0]||'قالب السطح موثّق لهذه الهندسة.')+'</p><details><summary>توثيق قالب مأخوذ بعد التركيب</summary>'+[['reference','مرجع مخطط القالب النهائي'],['levelRecord','محضر تثبيت وتسوية الوحدات'],['cutouts','مرجع قوالب فتحات الحوض والموقد عند وجودها'],['inspector','اسم مسؤول الرفع'],['date','تاريخ رفع القالب']].map(([k,l])=>'<label>'+l+'<input data-template="'+k+'" '+(k==='date'?'type="date"':'maxlength="180"')+' value="'+esc(w.surfaceTemplate?.[k]||'')+'"></label>').join('')+action('template','ربط القالب بالهندسة الحالية')+'</details>'):'';
     const checks=[
       {name:'الهيكل',done:state.valid.structure,link:action('to-structure','فتح مراجعة الهيكل')},
       {name:'الحصر والأسعار',done:state.quote.complete&&!state.quote.fitoutPending?.length&&!budgetHold(state.quote,w.layoutBrief),link:action('to-quote','مراجعة بنود العرض')},
       {name:'موافقة العميل',done:state.valid.customer}
     ];
     const checklist='<ol class="kf-sign-gates" aria-label="حالة الاعتماد">'+checks.map((c,i)=>'<li data-done="'+Boolean(c.done)+'"><span>'+number(i+1)+'</span><div><strong>'+c.name+'</strong><small>'+(c.done?'مكتمل':'بانتظار المراجعة')+'</small></div>'+(!c.done&&c.link?c.link:'')+'</li>').join('')+'</ol>';
     content.innerHTML=checklist+guarded(()=>versionsCardHTML({doc,state,quote:state.quote}))+card('اعتماد العميل على العرض','<span class="ws-state">'+stamp('customer')+'</span>'+designNote+(canCustomer?guarded(()=>reasonFieldHTML({doc,state}))+who:'')+action('customer','تسجيل موافقة العميل',!canCustomer)+(canCustomer||review?'':'<p class="ws-subtle">أكمل المتطلبات أعلاه لتسجيل الموافقة على هذه النسخة.</p>'))+
       '<details class="ws-release-review"'+(context.section==='release'?' open':'')+'><summary>مراجعة المصنع وإفراج التصنيع</summary>'+template+card('إفراج المصنع','<p class="ws-state">'+stamp('release')+'</p>'+(issues.length?'<ul>'+issues.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<p>راجِع قياسات الموقع وقائمة القطع والوصفات قبل الإفراج.</p>')+'<label>مسؤول الورشة<input data-ws-manager maxlength="90" placeholder="اسم المهندس أو مسؤول الورشة"></label>'+action('release','إثبات مراجعة الورشة وإطلاق النسخة',issues.length>0))+'</details>'+
       '<p class="ws-subtle">الاسم والتاريخ توثيق لتسلسل العمل. يظهر الاعتماد كقديم إذا تغيرت البيانات التي بُني عليها.</p>';
   }
 }
 viewport.addEventListener('click',async e=>{
   const trigger=e.target.closest('[data-ws-action]'),kind=trigger?.dataset.wsAction;if(!kind)return;
   if(kind==='to-layout'){begin('whole');return;}if(kind==='to-intake'){begin('intake');return;}if(kind==='decisions'){begin('decisions');return;}if(kind==='to-structure'){begin('approve');return;}if(kind==='to-quote'){begin('quote');return;}
   const doc=getDoc(),w=doc.room.workshop||{},ticket=serial;
   try{
     const state=await approvalState(doc);
     if(ticket!==serial||doc!==getDoc()){notify('تغيّر التصميم. راجع النسخة الحالية.');return;}
     if(kind==='review-placement'){if(state.designReview)begin('placement',{unitId:state.designReview.unitId});return;}
     if(state.designReview&&['structure','customer'].includes(kind))throw Error(state.designReview.reason);
     if(kind==='preview-change'){
       const html=sheetFor({doc,state,quote:state.quote,which:trigger.dataset.version,reason:content.querySelector('[data-ws-reason]')?.value||''});
       if(html)previewCustomerReport(html,trigger);else notify('تعذّر فتح ورقة التعديل لهذا الإصدار.');
       return;
     }
     if(kind==='template'){
       const data=Object.fromEntries([...content.querySelectorAll('[data-template]')].map(e=>[e.dataset.template,e.value]));
       const out=approveSurface(doc,data);if(!out.ok)throw Error(out.reason);
       if(commit(out.doc,'حُفظ مرجع قالب السطح.').ok!==false)navigate('sign',{...context,section:'release'},'refresh',viewport.scrollTop);return;
     }
     const name=content.querySelector(kind==='release'?'[data-ws-manager]':'[data-ws-person]')?.value.trim();
     if(!name)throw Error('أدخل اسم المعتمِد لحفظ الموافقة على هذه النسخة.');
     if(kind==='structure'&&decisionIssues(doc).length)throw Error(decisionIssues(doc)[0]);
     if(kind==='structure'&&intakeIssues(doc).length)throw Error(intakeIssues(doc)[0]);
     if(kind==='structure'&&!frontUnits(doc).length&&!Object.keys(w.rows||{}).length&&!configuredCorners(w))throw Error('أنشئ صفًا من كتالوج المصنع أولًا.');
     if(kind==='customer'&&(!state.valid.structure||!state.quote.complete||state.quote.fitoutPending?.length||budgetHold(state.quote,w.layoutBrief)))throw Error('راجع الهيكل واكتمال التسعير.');
     if(kind==='release'&&releaseConcerns(doc,state).length)throw Error('توجد بنود معلّقة تمنع الإفراج.');
     // The customer's approval is also written as a numbered version, with the reason when it changes an earlier one.
     let next,made=null;
     if(kind==='customer'){
       made=recordCustomerVersion({doc,state,name,reason:content.querySelector('[data-ws-reason]')?.value||''});
       if(!made.ok)throw Error(made.reason);next=made.doc;
     }else next={...doc,room:{...doc.room,workshop:{...w,approvals:{...w.approvals,[kind]:{name,key:state.keys[kind],date:new Date().toISOString()}}}}};
     const r=commit(next,'تم حفظ الاعتماد.');
     if(r?.ok!==false){if(kind==='structure')begin('finish');else navigate('sign',context,'refresh',viewport.scrollTop);notify((made?'سُجّلت موافقة العميل على الإصدار '+made.version.n.toLocaleString('ar-SA')+'.':'سُجّل الاعتماد لهذه النسخة.')+(['customer','release'].includes(kind)?backupReminder(backupStatus({projectId:getDoc().room.projectId,text:savedProjectText()})):''));}
   }catch(err){notify(err.message);}
 });
 panel.addEventListener('click',e=>{
   if(e.target.closest('[data-access-continue]')){dropWhole=true;dispose?.discardDraft?.();formDirty=false;navigate(roleHome(currentRole()),{},'open');return;}
   if(e.target.closest('[data-guide-stay]')){guideDeparture=null;status.textContent='';guideButton.focus();return;}
   if(e.target.closest('[data-guide-discard]')&&guideDeparture){const proceed=guideDeparture;guideDeparture=null;formDirty=false;dropWhole=true;dispose?.discardDraft?.();guard(proceed);return;}
   if(e.target.closest('[data-ws-retry]')){navigate(active,context,'refresh');return;}
   if(e.target.closest('[data-ws-guide]')){followCurrentTask();return;}
   if(e.target.closest('[data-ws-scrim]')){setPicker(false);return;}
   if(e.target.closest('[data-ws-chooser]')){setPicker(picker.hidden,true,e.detail===0);return;}
   if(e.target.closest('[data-ws-close]')){close(true);return;}
   if(e.target.closest('[data-ws-back]')){goBack();return;}
   const link=e.target.closest('.ws-route-picker [data-step]');if(link)begin(link.dataset.step);
 });
 panel.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.stopPropagation();e.preventDefault();if(!picker.hidden)setPicker(false);else close(true);return;}
   if(e.key!=='Tab'||!mobile.matches)return;
   const items=[...panel.querySelectorAll('button:not([disabled]),summary,a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')]
     .filter(node=>node.tabIndex>=0&&!node.closest('[inert]')&&node.getClientRects().length);
   if(!items.length)return;
   if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
   else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
 });
 function setModality(){if(mobile.matches)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');}
 mobile.addEventListener('change',setModality);setModality();
 function open(step,focus,keepTrail=false){
   if(!panel.hidden){if(step)begin(step,focus);else chooser.focus();return;}
   const trigger=document.activeElement;
   returnFocus=trigger?.matches('button,a[href]')&&el.contains(trigger)?trigger:opener;
   closeOthers();panel.hidden=false;opener?.setAttribute('aria-expanded','true');
   if(step){if(!keepTrail)trail.length=0;navigate(step,focus||{},'open');}else navigate(active,context,'open');
 }
 function lockReadOnly(){
  if(!content||active==='sync'||canEditWorkshopPage(currentRole(),active)||['home','quote','oversight'].includes(active))return;
  const lock=()=>{for(const node of content.querySelectorAll('form input,form textarea,form select,form button,input[data-ws-person],input[data-ws-manager],input[data-template],[data-ws-action="structure"],[data-ws-action="customer"],[data-ws-action="release"],[data-ws-action="template"]'))node.disabled=true;};
  lock();if(typeof MutationObserver!=='undefined'){permissionObserver?.disconnect();permissionObserver=new MutationObserver(lock);permissionObserver.observe(content,{childList:true,subtree:true});}
 }
 function refreshAccess(){
  const role=currentRole();if(role===renderedRole)return;renderedRole=role;trail.length=0;forgetWhole();
  if(active==='sync'){updateHeader();if(!picker.hidden)setPicker(true,false);return;}
  if(!panel.hidden&&(formDirty||dispose?.hasPending?.())){
   accessFrozen=true;permissionObserver?.disconnect();permissionObserver=null;
   for(const field of content?.querySelectorAll('input,textarea,select,button')||[]){if(field.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea'))field.readOnly=true;else field.disabled=true;}
   status.innerHTML='<span>تغيّرت صلاحيتك. احتُفظ بالمسودة الظاهرة للقراءة والنسخ، وتوقف حفظها. الانتقال التالي سيترك هذه المسودة.</span> <button type="button" data-access-continue>ترك المسودة وفتح بوابتي</button>';
   updateHeader();return;
  }
  if(!panel.hidden)navigate(canOpenWorkshopPage(role,active)?active:roleHome(role),{},'refresh');
 }
 return {open,close,requestClose,refreshAccess,screen:()=>panel.hidden?null:{route:active,title:steps[active].title,focus:context,context:commandContext?.()||context},refreshGuide:()=>guide.refresh(),active:()=>!panel.hidden,refresh:()=>{
   void guide.refresh();
   if(wholeCache&&wholeCache.doc!==getDoc())forgetWhole();
   if(!panel.hidden&&!applyLocal&&viewDoc!==getDoc())guard(()=>navigate(active,context,'refresh',viewport.scrollTop));
 }};
}
