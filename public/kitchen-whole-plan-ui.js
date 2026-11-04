import {previewCustomerReport,downloadCustomerReport} from './kitchen-report-preview.js';
import {sheetTarget} from './kitchen-sheet-target.js';
import {sheetFeatureReadout} from './kitchen-sheet.js';
import {mountDrawingContext} from './kitchen-drawing-context.js';
import {mountDrawingViewport} from './kitchen-drawing-viewport.js';
import {kitchenFeatureSpecs,kitchenUnitSpecs} from './kitchen-model.js';
import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {pantryContext} from './kitchen-pantry-brief.js';
import {assistNumber,stableHash} from './kitchen-measurement-identity.js';
import {savedProjectText} from './kitchen-project.js';
import {writeDraft,readDraft,clearDraft} from './kitchen-draft-store.js';
import {registerUnsavedWork} from './kitchen-unsaved-work.js';
import {proposeWholeKitchen,reviewWholeProposal} from './kitchen-whole-plan.js';
import {previewKitchenWidthChange,previewKitchenUnitMove,snapFactoryWidthMm} from './kitchen-proposal-change.js';
import {mountDesignerPrecision} from './kitchen-designer-precision.js';
import {decorateDesignerStudio,positionDesignerHud} from './kitchen-designer-studio.js';
import {budgetHold} from './kitchen-layout-brief.js';
import {buildFactoryQuote} from './kitchen-workshop-factory.js';
import {proposalUnits,proposalScene,proposalComparisons,alternativeStrip,proposalNumber as n,proposalPrice,escapeProposalText as esc,wallFacts,customerReport,changeTable,priceDifference,purchaseNote,distributionTable} from './kitchen-proposal-presentation.js';

import {proposalUnitSymbol} from './kitchen-proposal-symbols.js';
import {studioIcon} from './kitchen-tool-icons.js';

const btn=(act,label,cls='',attrs='')=>'<button type="button" data-wp="'+act+'" class="pd-button '+cls+'" '+attrs+'>'+esc(label)+'</button>';
const tool=(act,label,glyph,attrs='')=>'<button type="button" data-wp="'+act+'" class="pd-icon-tool" aria-label="'+esc(label)+'" title="'+esc(label)+'" '+attrs+'>'+studioIcon(glyph)+'</button>';
const check=(key,label,value,fixed)=>'<label class="pd-check"><input type="checkbox" name="'+key+'" '+(value?'checked ':'')+(fixed?'disabled':'')+'>'+esc(label)+'</label>';
const titleOf={tap:'مراجعة الخلاط',routes:'مسار التصريف',measure:'دقة القياس',surfaces3d:'مناسيب الارتكاز',survey:'رفع الجدار',decisions:'قرارات العميل',wallOptions:'خيارات الجدار',intake:'قائمة الأجهزة',appliances:'مطابقة الجهاز',row:'تخصيص الوحدات',uses:'استخدام الوحدة',quote:'الحصر والسعر',corner:'تفصيل الزاوية',factory:'كتالوج المصنع',surface:'قالب السطح',approve:'اعتماد الهيكل',finish:'الخامات',sign:'الاعتمادات'};
const componentName={front:'الدرفة',drawer:'الدرج',handle:'اليد',shelf:'الرف',leg:'رجل الدولاب',inside:'التقسيم الداخلي',pullout:'السحّابة',appliance:'الجهاز',accessory:'الإكسسوار',divider:'الفاصل'};
const technicalName={surface:'فتحة سطح العمل',worktop:'سطح العمل',assembly:'تفصيل التركيب',wallOptions:'تجهيز الجدار',corner:'وحدة الركن','room-surface':'تشطيب الغرفة','floor-point':'نقطة الأرضية',run:'صف الوحدات',survey:'الجدار',tap:'خلاط المجلى'};
const partTitle=t=>t?.route==='unit-part'?(componentName[t.focus.part]||'جزء الوحدة')+(t.focus.index?' '+n(t.focus.index):''):t?.label||technicalName[t?.route]||'الجزء المحدد';
const partDims=parts=>parts.length?parts.map(p=>[p.a,p.b].filter(Number.isFinite).map(n).join(' × ')+' ('+n(p.count)+')').join('، '):'—';
const unique=values=>[...new Set(values)];
const sameSettings=(a,b)=>!!a&&!!b&&['sink','rice','dishwasher'].every(k=>a[k]===b[k])&&a.walls.length===b.walls.length&&a.walls.every(w=>b.walls.includes(w));

function newSession(doc){
 const w=doc.room.workshop||{},measured=surveyedDesignWalls(doc),chosen=w.decisionReview?.active?w.decisionReview.walls:measured,pantry=pantryContext(doc);
 return {base:doc,measured,model:null,generatedSettings:null,requestFailed:false,alternative:0,histories:[],applied:true,persisted:true,face:'volume',planTier:'base',frameUnits:true,yaw:18,part:'',siteFeature:'',pickedPart:null,sheet:'',issue:null,
  settings:{walls:[...chosen],sink:doc.kitchen.units.some(u=>u.kind==='sink')||['water','drain'].every(k=>doc.kitchen.features.some(f=>f.kind===k&&chosen.includes(f.wall))),
   dishwasher:doc.kitchen.units.some(u=>u.kind==='dishwasher')||w.applianceIntake?.some(a=>a.kind==='dishwasher')||false,
   rice:pantry.wanted||Object.values(w.rows||{}).some(row=>row.units.some(u=>u.family==='rice'))}};
}
export function mountWholePlan(host,{getDoc,apply,tell,onAdvance,onHistory,canHistory,canEdit=()=>true,focus={}}){
 const controller=new AbortController(),signal=controller.signal;
 const initiallyEditable=canEdit();
 const s=newSession(getDoc());
 let pending=false,epoch=0,error='',pick=null,volumeTarget=null,drag=null,dragged=false,questionList=[],computed=null,rotationFrame=0;
 let draftTimer=0,draftSaved=true,resuming=false,discarded=false,widthPreview=null,redos=[],precision=null,resizeObserver=null;
 const stale=()=>s.base!==getDoc();
 const candidate=()=>s.model?.candidates[s.alternative],history=()=>s.histories[s.alternative]||[],last=()=>history().at(-1);
 const drawing=()=>last()?.doc||candidate()?.doc||s.base;
 const walls=()=>roomArchitecture(s.base.room).walls;
 const inspectedFeature=()=>s.sheet==='feature'&&drawing().kitchen.features.find(f=>f.id===s.siteFeature);
 const featureName=f=>f.kind==='vent'?'فتحة تهوية الشفاط':kitchenFeatureSpecs[f.kind]?.label||'عنصر الجدار';
 const ready=()=>!!candidate();
 const outdated=()=>ready()&&(s.requestFailed||stale()||!sameSettings(s.settings,s.generatedSettings));
 const usable=()=>ready()&&!pending&&!outdated();
 const unapplied=()=>!s.applied||!!widthPreview||ready()&&!sameSettings(s.settings,s.generatedSettings);
 const optionDocs=()=>s.model.candidates.map((c,i)=>s.histories[i]?.at(-1)?.doc||c.doc);
 const storedWalls=()=>s.model?.stored?unique(drawing().kitchen.runs.map(r=>r.wall).filter(Boolean)):s.generatedSettings?.walls||s.settings.walls;
 function facts(){
  const doc=drawing();
  if(computed?.doc===doc&&computed?.session===s)return computed;
  const units=proposalUnits(doc),quote=candidate()&&!last()?candidate().quote:buildFactoryQuote(doc);
  computed={session:s,doc,units,quote,questions:ready()?(last()||s.model.stored?reviewWholeProposal(doc,storedWalls(),quote):candidate().questions||[]):[]};
  return computed;
 }
 function viewChoices(doc){
  const runs=new Set(doc.kitchen.runs.map(r=>r.wall));
  return walls().filter(w=>ready()?runs.has(w.id):s.settings.walls.includes(w.id));
 }
 const touchFirst=globalThis.matchMedia?.('(pointer: coarse)').matches??false;
 const cameraHint=touchFirst?'بإصبعين قرّب الرسم وحرّكه.':'لفّ البكرة للتقريب واضغطها واسحب لتحريك الرسم.';
 const objectHint=touchFirst?'المس الوحدة واسحب مقبضها لتغيير العرض. اضغط مطوّلًا لأوامرها.':'انقر الوحدة واسحب مقبضها لتغيير العرض. انقر باليمين لأوامرها.';
 const getCanvas=()=>host.querySelector('[data-wp-canvas]');
 const getSvg=()=>getCanvas()?.querySelector?.('svg');
 const view=mountDrawingViewport(host,{getSvg,canNavigate:()=>!drag,cancelGesture:cancelDrag,onViewChange:()=>positionDesignerHud(host)});
 const menu=mountDrawingContext(host,{getSvg,actionsAt:contextActions,cancelGesture:cancelDrag});
 function paintScene(d=drawing()){
  const canvas=host.querySelector('[data-wp-canvas]');if(!canvas)return;
  const site=inspectedFeature(),p=!site&&s.sheet!=='part'&&usable()?s.part:null,editableUnit=canEdit()&&!s.sheet&&p&&(d===drawing()?facts().units:proposalUnits(d)).find(u=>u.id===p);
  if(!['volume','plan'].includes(s.face)&&!viewChoices(d).some(w=>w.id===s.face))s.face='volume';
  const scene=proposalScene(d,s.face,'view-proposal',{units:ready()&&d===drawing()&&s.face!=='volume'?facts().units:undefined,yaw:s.yaw,selectedId:site?.id||p,editableUnit,tier:ready()?s.planTier:undefined,interactive:true,frameUnits:ready()&&s.frameUnits});pick=scene.hitTest;volumeTarget=scene.partTarget;
  canvas.innerHTML=scene.html;
  const svg=getSvg();
  if(svg){svg.setAttribute('tabindex','0');view.sync(svg,svg.getAttribute('viewBox'),[epoch,s.alternative,s.face,s.face==='plan'?s.planTier:'',s.frameUnits&&ready()].join('/'));}
  if(site&&s.face!=='volume')for(const el of canvas.querySelectorAll('[data-sheet-feature]'))if(el.dataset.sheetFeature===site.id)el.classList.add('pd-site-selected');
  if(p&&s.face!=='volume')for(const el of canvas.querySelectorAll('[data-sheet-unit]'))if(el.dataset.sheetUnit===p&&(!s.pickedPart?!el.dataset.sheetPart:el.dataset.sheetPart===s.pickedPart.focus.part&&(!s.pickedPart.focus.index||Number(el.dataset.sheetIndex)===s.pickedPart.focus.index)))el.classList.add(el.dataset.sheetPart?'pd-selected-component':'pd-selected-shape');
  const hudWidth=host.querySelector('.ds-hud-heading span');if(hudWidth&&editableUnit)hudWidth.textContent=n(editableUnit.widthMm)+' مم'+(d!==drawing()?' · معاينة':'');
  positionDesignerHud(host);
 }
 function views(){
  const faces=viewChoices(drawing());
  const segment=(id,title,g)=>'<button type="button" data-wp-view="'+id+'" class="pd-segment" title="'+esc(title)+'" aria-pressed="'+(s.face===id)+'">'+studioIcon(g)+'<span>'+title+'</span></button>';
  const elevation=faces.length===1?segment(faces[0].id,'واجهة الجدار','elevation'):faces.length?'<label class="pd-elevation '+(!['volume','plan'].includes(s.face)?'active':'')+'">'+studioIcon('elevation')+'<span>'+esc(faces.find(w=>w.id===s.face)?.label||'واجهة')+'</span><select aria-label="اختيار واجهة جدار" data-wp-elevation><option value="">واجهة الجدار</option>'+faces.map(w=>'<option value="'+esc(w.id)+'" '+(s.face===w.id?'selected':'')+'>'+esc(w.label)+'</option>').join('')+'</select></label>':'';
  return '<div class="pd-views" role="group" aria-label="طريقة عرض الرسم">'+elevation+segment('plan','مسقط','plan')+segment('volume','منظور','cube')+'</div>';
 }
 function tierBar(){
  if(s.face!=='plan'||!ready())return '';
  const tiers=new Set(facts().units.map(u=>u.tier==='upper'?'upper':'base'));
  if(tiers.size<2)return '';
  return '<div class="pd-tiers" role="group" aria-label="مستوى الوحدات في المسقط">'+['base','upper'].map(t=>'<button type="button" data-wp-tier="'+t+'" aria-pressed="'+(s.planTier===t)+'">'+(t==='base'?'سفلي':'علوي')+'</button>').join('')+'</div>';
 }
 function canPick(){return !stale()&&!pending&&(usable()||!ready()&&!s.requestFailed);}
 function stage(tools){
  const site=inspectedFeature(),p=!site&&usable()?facts().units.find(u=>u.id===s.part):null;
  const status=pending?'جارٍ حساب التوزيع…':site?featureName(site):p?p.code+' · '+p.label:outdated()?'الرسم السابق · للمراجعة فقط':drawing().kitchen.units.length?'الوحدات المرسومة':'محيط الغرفة';
  const tip=s.sheet==='changes'?'اختر وحدة لقراءة أثر التعديل عليها.':s.sheet==='details'?'اختر وحدة لقراءة مقاسها.':!s.sheet&&canPick()&&drawing().kitchen.units.length?objectHint:'';
  const camera=s.face==='volume'?(usable()&&facts().units.length?tool('framing',s.frameUnits?'إظهار الغرفة كاملة':'تقريب الدواليب',s.frameUnits?'zoom-out':'zoom-in','aria-pressed="'+s.frameUnits+'"'):'')+tool('rotate','تدوير المنظور','rotate'):'';
  return '<section class="pd-stage" aria-label="رسم المطبخ"><div class="pd-stagebar">'+views()+'<div class="pd-camera" role="group" aria-label="أدوات العرض">'+tierBar()+camera+tool('fit','ملاءمة الرسم للمساحة','fit')+
   '<details class="pd-help"><summary aria-label="طريقة التعامل مع الرسم" title="طريقة التعامل مع الرسم">'+studioIcon('info')+'</summary><p>'+esc([tip,cameraHint].filter(Boolean).join(' '))+'</p></details></div></div>'+
   '<div class="pd-canvas '+(canPick()?'pd-can-pick':'')+'" data-wp-canvas></div><p class="pd-gesture-note" data-wp-gesture role="status"></p><div class="pd-stagefoot">'+
   (usable()&&!s.sheet&&facts().units.length?unitPicker(p):'<span class="pd-selection-key"><i></i>'+esc(status)+'</span>')+tools+'</div></section>';
 }
 function unitPicker(selected){
  const units=facts().units,groups=new Map();
  const wallNames=new Map(walls().map(w=>[w.id,w.label]));
  for(const u of units){
   const group=(wallNames.get(u.wall)||'جزيرة')+' · '+(u.tier==='upper'?'الصف العلوي':'الصف السفلي');
   if(!groups.has(group))groups.set(group,[]);
   groups.get(group).push('<option value="'+esc(u.id)+'" '+(u.id===selected?.id?'selected':'')+'>'+esc(u.code+' · '+u.label+' · '+n(u.widthMm)+' مم')+'</option>');
  }
  const options=[...groups].map(([label,items])=>'<optgroup label="'+esc(label)+'">'+items.join('')+'</optgroup>').join('');
  return '<label class="pd-unitpicker">'+(selected?proposalUnitSymbol(selected,20):studioIcon('target'))+'<span>'+esc(selected?selected.code+' · '+selected.label:'اختيار وحدة')+'</span>'+(!selected?'<b class="pd-picker-count">'+n(units.length)+'</b>':'')+'<select data-wp-unit aria-label="اختيار الوحدة"><option value="">عرض التوزيع كاملًا</option>'+options+'</select></label>';
 }
 function altPicker(){
  const alts=s.model?.candidates||[];if(alts.length<2)return '';
  const docs=optionDocs(),comparisons=proposalComparisons(docs),active=comparisons[s.alternative];
  return '<details class="pd-compare"><summary aria-label="مقارنة بدائل التوزيع" title="مقارنة بدائل التوزيع">'+studioIcon('list')+'<span>البدائل</span></summary><div class="pd-choices"><div class="pd-alts" role="group" aria-label="اختيار البديل">'+alts.map((c,i)=>{
   const h=s.histories[i]?.at(-1),price=h?h.price.afterSar:c.total,choice=comparisons[i];
   return '<button data-wp-alt="'+i+'" type="button" aria-label="'+esc(choice.title+' · '+proposalPrice(price))+'" aria-pressed="'+(s.alternative===i)+'">'+alternativeStrip(proposalUnits(docs[i]),choice.ids)+'<span>'+esc(choice.title)+'</span><small>'+esc(proposalPrice(price))+'</small></button>';
  }).join('')+'</div>'+(active.detail?'<p class="pd-comparison-station">'+esc(active.detail)+'</p>':'')+'</div></details>';
 }
 function usageTools(p){
  if(!canSetUsage(p))return '';
  if(!s.applied)return '<div class="pd-unit-use">'+btn('usage','تطبيق التصميم وتحديد الاستخدام','pd-usage-add')+'</div>';
  if(!s.persisted)return '';
  const tasks=getDoc().room.workshop?.clientUsage?.tasks?.filter(t=>t.unitId===p.id)||[];
  const activity=t=>'<button type="button" class="pd-use-item" data-wp="usage" data-use-id="'+esc(t.id)+'" aria-label="تعديل نشاط '+esc(t.name)+'">'+studioIcon('pen')+'<span>'+esc(t.name)+'</span></button>';
  return '<section class="pd-unit-use" aria-label="استخدام العميل لهذه الوحدة"><div class="pd-use-head">'+
   (tasks.length?'<h4>استخدام العميل</h4>':'')+btn('usage',tasks.length?'إضافة نشاط':'تحديد استخدام الوحدة','pd-usage-add')+'</div>'+
   tasks.slice(0,2).map(activity).join('')+(tasks.length>2?'<details><summary>بقية الأنشطة · '+n(tasks.length-2)+'</summary>'+tasks.slice(2).map(activity).join('')+'</details>':'')+'</section>';
 }
 function openUsage(p,taskId){
  if(!usable()||!canSetUsage(p)||s.sheet&&!['part','feature'].includes(s.sheet))return;
  const input=host.querySelector('[name="widthMm"]');
  if(input&&typeof input.value==='string'&&assistNumber(input.value)!==facts().units.find(u=>u.id===s.part)?.widthMm){
   input.focus();tell('طبّق المقاس المكتوب أو أعد المقاس السابق أولًا.');return;
  }
  if(!s.applied&&!applyDraft())return;
  if(!s.persisted){tell('تعذّر حفظ التصميم. أعد حفظه قبل تسجيل استخدام الوحدة.');return;}
  const doc=getDoc();
  if(!doc.kitchen.units.some(u=>u.id===p.id))return;
  if(taskId&&!doc.room.workshop?.clientUsage?.tasks?.some(t=>t.id===taskId&&t.unitId===p.id))return;
  if(s.sheet||s.part!==p.id){s.sheet='';selectUnit(p.id);}
  onAdvance('uses',taskId?{unitId:p.id,taskId}:{unitId:p.id});
 }
 function inspector(){
  const p=facts().units.find(u=>u.id===s.part);
  if(!p)return '';
  const wall=walls().find(w=>w.id===p.wall)?.label||'جزيرة';
  const h=last(),changed=h?.changes.find(v=>v.unitId===p.id),transfer=h?.donors?.map(v=>v.label+' '+n(v.amountMm)+' مم').join('، ');
  return '<section class="pd-inspector" aria-label="خصائص الوحدة المحددة"><div class="pd-unitrow"><div class="pd-unitmark" aria-hidden="true">'+proposalUnitSymbol(p,28)+'</div><div class="pd-unit-title"><small><bdi>'+esc(p.code)+'</bdi> · '+esc(wall)+' · '+(p.tier==='upper'?'علوي':'سفلي')+'</small><h3>'+esc(p.label)+'</h3></div>'+
   tool('clear-unit','إغلاق خصائص الوحدة','close')+'</div>'+
   (s.pickedPart?.route==='unit-part'?partInfo():'')+
   (p.resizable&&canEdit()?'<form class="pd-dimform" data-width-change><div class="pd-editlabel"><label for="pd-next-width">'+(s.pickedPart?'عرض الوحدة كاملة':'عرض الوحدة')+'</label><span>مم</span></div><div class="pd-width" dir="ltr">'+
     btn('minus','−','pd-stepper','aria-label="تقليل العرض ١٠٠ مم" title="−100 مم"')+
     '<input id="pd-next-width" name="widthMm" inputmode="numeric" dir="ltr" autocomplete="off" required value="'+p.widthMm+'" aria-label="عرض الوحدة بالملليمتر">'+
     btn('plus','+','pd-stepper','aria-label="زيادة العرض ١٠٠ مم" title="+100 مم"')+'</div>'+
     '<div class="pd-editcaption"><span>خطوة الأزرار ١٠٠ مم</span><button class="pd-exact" data-wp-exact type="submit" hidden>تطبيق المقاس</button></div><small class="pd-precision-hint">↑↓ بخطوة المصنع، وShift لعشر خطوات. اسحب عنوان العرض للتعديل؛ Esc لإلغاء المعاينة.</small></form>':
     '<div class="pd-lock"><strong>'+n(p.widthMm)+' مم</strong><span>'+(p.model?'حيّز الموديل '+esc(p.model):'مقاس الوحدة على الرسم')+'</span></div>')+
   '<p class="pd-error" data-edit-error role="status" '+(error?'':'hidden')+'>'+esc(error)+'</p>'+
   (changed?'<p class="pd-transfer" role="status">'+esc(h.args?.kind==='move'?'تحدّث ترتيب الوحدات مع بقاء عروضها.':transfer?'أُخذت المساحة من '+transfer:'تحدّث عرض الوحدة ومقاسات القطع.')+'</p>':'')+
   (h?'<div class="pd-history">'+tool('undo','تراجع عن آخر تعديل','undo')+btn('changes','أثر التعديل','pd-text')+'</div>':'')+usageTools(p)+'</section>';
 }
 function introActions(){
  const can=s.settings.walls.length>0&&s.settings.walls.every(id=>s.measured.includes(id));
  const count=s.base.room.workshop?.applianceIntake?.length||0;
  return '<section class="pd-start" aria-label="بدء التصميم"><p class="pd-visit-summary">'+n(s.settings.walls.filter(id=>s.measured.includes(id)).length)+' جدران مكتملة الرفع · '+n(count)+' أجهزة مسجلة</p>'+
   (pending?btn('cancel','إلغاء الحساب','pd-main'):can?btn('generate','توليد التصميم','pd-main'):btn('survey','متابعة رفع الجدار','pd-main'))+
   (s.base.kitchen.units.length&&!pending?btn('current','مراجعة الوحدات المرسومة','pd-text'):'')+'</section>';
 }
 function resultActions(){
  if(pending)return '<section class="pd-start"><h3 role="status">جارٍ حساب البدائل…</h3>'+btn('cancel','إلغاء الحساب','pd-secondary')+'</section>';
  if(outdated())return '<section class="pd-start pd-superseded" role="status"><div class="pd-kicker">الرسم السابق</div><h3>تغيّرت بيانات التوزيع</h3><p>يتطلب عرض السعر وتطبيق هذا التصميم حسابًا مطابقًا للاختيارات الحالية.</p>'+btn('settings','مراجعة اختيارات التوزيع','pd-secondary')+
   (!stale()?btn('restore','استعادة اختيارات الرسم السابق','pd-text'):'')+'</section>';
  const f=facts(),hold=budgetHold(f.quote,drawing().room.workshop?.layoutBrief);
  return '<div class="pd-summary"><div><small>إجمالي عرض المصنع</small><strong>'+esc(proposalPrice(f.quote.complete?f.quote.total:null))+'</strong></div>'+
   '<span class="pd-state" data-state="'+(s.applied&&s.persisted?'saved':'draft')+'">'+studioIcon(s.applied&&s.persisted?'check':'pen')+esc(!s.applied?'مسوّدة':s.persisted?'محفوظ':'في هذه الجلسة')+'</span></div>'+altPicker()+
   (hold?'<p class="pd-error">'+esc(hold)+'</p>':'')+
   '<div class="pd-commit">'+(s.applied&&s.persisted?btn('approve','متابعة الاعتماد','pd-main'):btn('apply',s.applied?'إعادة محاولة الحفظ':'حفظ التوزيع','pd-main',hold?'disabled':''))+
   btn('preview-report','معاينة عرض العميل','pd-secondary')+tool('report','تنزيل عرض العميل بصيغة HTML','download')+'</div>';
 }
 function settings(){
  const w=s.base.room.workshop||{},registered=w.applianceIntake?.some(d=>d.kind==='dishwasher'),pantry=pantryContext(s.base),fixed=w.decisionReview?.active;
  return '<form data-plan-controls class="pd-settings"><fieldset><legend>جدران التفصيل</legend>'+walls().map(v=>'<label class="pd-check"><input type="checkbox" name="wall" value="'+esc(v.id)+'" '+(s.settings.walls.includes(v.id)?'checked ':'')+(fixed||!s.measured.includes(v.id)?'disabled':'')+'>'+esc(v.label)+(!s.measured.includes(v.id)?' · يحتاج استكمال الرفع':'')+'</label>').join('')+'</fieldset>'+
   '<fieldset><legend>الوظائف المطلوبة</legend>'+check('sink','مجلى',s.settings.sink,false)+check('dishwasher','غسالة صحون',s.settings.dishwasher,registered)+check('rice','درج أرز',s.settings.rice,pantry.req?.confirmed)+'</fieldset>'+
   '<div class="pd-actions">'+(pending?btn('cancel','إلغاء الحساب'):'<button type="submit" class="pd-button pd-main" '+(s.settings.walls.length&&s.settings.walls.every(id=>s.measured.includes(id))?'':'disabled')+'>حساب البدائل</button>')+
   btn('survey','الرفع')+btn('intake','أجهزة العميل')+btn('decisions','قرارات الزيارة')+(s.base.kitchen.units.length&&!ready()?btn('current','مراجعة الوحدات المرسومة'):'')+'</div></form>';
 }
 function more(){
  const c=candidate(),d=drawing();if(!c)return '';
  return '<div class="pd-details"><h4>أساس التوزيع</h4>'+wallFacts(d,storedWalls()).map(v=>'<p><b>'+esc(v.label)+'</b> · '+esc(v.detail)+'</p>').join('')+
   (c.reasons||[]).map(t=>'<p>'+esc(t)+'</p>').join('')+'<details><summary>جدول الوحدات والأبعاد</summary>'+distributionTable(d,s.model?.stored?null:storedWalls())+'</details>'+
   '<p class="pd-note">'+(s.model.stored?'يعرض التوزيع المحفوظ.':'اختُبرت '+n(s.model.tried)+' توزيعات'+(s.model.truncated?' ضمن حد البحث.':'.'))+'</p></div>';
 }
 function questions(){
  return '<ul class="pd-list">'+questionList.map((q,i)=>'<li>'+esc(q.text||q)+(titleOf[q.step]?' <button type="button" data-wp-question="'+i+'">'+esc((usable()&&!s.applied?'تطبيق وفتح ':'فتح ')+titleOf[q.step])+'</button>':'')+'</li>').join('')+'</ul>';
 }
 function changes(){
  const h=last();if(!h)return '';
  const a=h.changes.find(v=>v.unitId===h.unitId),selected=h.changes.find(v=>v.unitId===s.part);
  const selectedEffect=selected?'<p><b>'+esc(selected.label)+'</b> · العرض من '+n(selected.beforeWidthMm)+' إلى '+n(selected.afterWidthMm)+' مم · البداية من '+n(selected.beforeStartMm)+' إلى '+n(selected.afterStartMm)+' مم</p>':'';
  return '<div class="pd-details">'+selectedEffect+changeTable(h)+priceDifference(h)+'<p>'+esc(purchaseNote(buildFactoryQuote(h.before),buildFactoryQuote(h.doc),h))+'</p>'+
   (h.protectedUnits.length?'<p>احتفظت هذه الوحدات بموضعها · '+h.protectedUnits.map(u=>esc(u.label)+' '+n(u.startMm)+' مم').join('، ')+'</p>':'')+
   (a?.inside?.note?'<p>'+esc(a.inside.note)+'</p>':'')+(h.notes||[]).map(t=>'<p>'+esc(t)+'</p>').join('')+
   (h.cutChanges.length?'<details><summary>قائمة القطع المتأثرة ('+n(h.cutChanges.length)+')</summary><div class="wp-scroll"><table><thead><tr><th>قطعة</th><th>قبل (مم)</th><th>بعد (مم)</th></tr></thead><tbody>'+h.cutChanges.map(r=>'<tr><td>'+esc(r.label)+' · '+esc(r.sku)+'</td><td>'+esc(partDims(r.before))+'</td><td>'+esc(partDims(r.after))+'</td></tr>').join('')+'</tbody></table></div></details>':'')+'</div>';
 }
 function featureInfo(){
  const f=inspectedFeature();if(!f)return '';
  const canCorrect=!!sourceFeature(f);
  return sheetFeatureReadout(drawing().room,f)+(canCorrect?btn('correct-feature','تحرير قياسات العنصر','pd-main'):
   '<p class="pd-note">تعذّر مطابقة العنصر مع الرفع الحالي.</p>');
 }
 function partInfo(){
  const t=s.pickedPart;if(!t)return '';
  const action=t.focus.part==='drawer'?'تخصيص الدرج':t.focus.part==='handle'?'خيارات اليد':t.focus.part==='front'?'خيارات الدرفة':'تحرير '+partTitle(t);
  const available=s.applied||!ready();
  return '<div class="pd-part-info"><b>'+esc(partTitle(t))+'</b>'+ (available?btn('edit-part',action,'pd-secondary'):'<p class="pd-note">طبّق التصميم لفتح إعدادات هذا الجزء في المشروع.</p>')+'</div>';
 }
 const panelNames={part:'الجزء المحدد',feature:'عنصر الجدار',settings:'خيارات التوزيع',details:'تفاصيل التصميم',questions:'بنود للمراجعة',changes:'أثر آخر تعديل'};
 function support(){
  if(pending)return {tools:'',editor:''};
  questionList=s.issue?.questions|| (usable()?facts().questions:[]);
  const panel=(key,label,glyph,short)=>'<button type="button" data-wp="'+key+'" class="pd-link" aria-label="'+esc(label)+'" title="'+esc(label)+'" aria-expanded="'+(s.sheet===key)+'">'+studioIcon(glyph)+'<span>'+esc(short)+'</span></button>';
  const tabs=[panel('settings','خيارات التوزيع','settings','التوزيع'),...(usable()?[panel('details','تفاصيل التصميم','list','التفاصيل')]:[]),...(questionList.length?[panel('questions','بنود للمراجعة · '+n(questionList.length),'info','مراجعة '+n(questionList.length))]:[])];
  const content={part:partInfo,feature:featureInfo,settings,details:more,questions,changes}[s.sheet];
  const tools='<div class="pd-support" role="group" aria-label="أدوات التصميم">'+tabs.join('')+'</div>';
  const selected=usable()&&['details','changes'].includes(s.sheet)?facts().units.find(u=>u.id===s.part):null;
  const unitInfo=selected?'<p class="pd-unit-detail"><bdi>'+esc(selected.code)+'</bdi> · '+esc(selected.label)+' · '+n(selected.widthMm)+' مم</p>':'';
  const editor=content?'<section class="pd-open" data-pd-open tabindex="-1"><div class="pd-opentitle"><h3>'+esc(inspectedFeature()?featureName(inspectedFeature()):panelNames[s.sheet])+'</h3>'+tool('close-sheet','إغلاق التفاصيل','close')+'</div>'+unitInfo+content()+'</section>':'';
  return {tools,editor};
 }
 function render(focusSelector){
  if(initiallyEditable&&!canEdit()){cancelDrag();return;}
  cancelDrag(false);menu.close();
  if(ready()&&s.face==='plan'){
   const units=facts().units,tiers=units.map(u=>u.tier==='upper'?'upper':'base');
   if(!tiers.includes(s.planTier))s.planTier=tiers[0]||'base';
  }
  const {tools,editor}=support();
  const side=editor||(usable()?inspector():'');
  const actions=!editor||outdated()?(ready()?resultActions():introActions()):'';
  const roomSize=n(s.base.room.width*10)+' × '+n(s.base.room.length*10);
  host.innerHTML='<section class="proposal-studio" aria-label="تصميم المطبخ"><header class="pd-title"><div class="pd-project">'+studioIcon('ruler')+'<small>أبعاد الغرفة</small><span class="pd-size"><bdi>'+roomSize+'</bdi> مم</span></div>'+actions+'</header>'+
   (s.issue?'<div class="pd-error pd-alert" role="status">'+esc(s.issue.reason)+'</div>':'')+
   '<div class="pd-layout'+(side?'':' pd-overview')+'"><div class="pd-mainarea">'+stage(tools)+'</div>'+(side?'<aside class="pd-side">'+side+'</aside>':'')+'</div></section>';
  decorateDesignerStudio(host,{doc:drawing(),units:facts().units,selected:s.part,face:s.face,measured:s.measured,applied:s.applied,persisted:s.persisted,editable:usable()&&canEdit(),sheet:s.sheet,canUndo:historyAvailable(false),canRedo:historyAvailable(true),redoDraft:!!redos[s.alternative]?.length});
  observeDesignerSize();
  paintScene();if(focusSelector)host.querySelector(focusSelector)?.focus({preventScroll:true});
  if(unapplied())scheduleDesignDraft();
 }
 function clearInteraction(){pending=false;epoch++;error='';widthPreview=null;cancelDrag(false);dragged=false;computed=null;}
 function observeDesignerSize(){if(!resizeObserver)return;resizeObserver.disconnect();resizeObserver.observe(host);const wrap=host.querySelector('.ds-canvas-wrap');if(wrap)resizeObserver.observe(wrap);}
 function rawBlocked(){
  if(!widthPreview)return false;
  tell('طبّق المقاس المكتوب أو ألغِ المعاينة أولًا.');host.querySelector('[name="widthMm"]')?.focus();return true;
 }
 function showEditError(message){
  error=message;const node=host.querySelector('[data-edit-error]');if(node){node.hidden=!message;node.textContent=message;}
 }
 function inputWidth(input){
  if(input!==host.querySelector('[name="widthMm"]')||!canEdit()||!usable()||s.sheet)return;
  const p=facts().units.find(u=>u.id===s.part);if(!p?.resizable)return;
  const next=assistNumber(input.value),same=Number.isSafeInteger(next)&&next===p.widthMm;
  const out=same?{ok:true,doc:drawing()}:Number.isSafeInteger(next)?previewKitchenWidthChange(drawing(),p.id,next-p.widthMm,{withEffects:false,explicitUserChange:true,inputKind:'number'}):{ok:false,reason:'أدخل عرضًا صحيحًا بالملليمتر.'};
  widthPreview=same?null:{part:p.id,source:drawing(),raw:input.value,next,valid:out.ok};
  showEditError(out.ok?'':out.reason);paintScene(out.ok?out.doc:drawing());
  const exact=host.querySelector('[data-wp-exact]');if(exact)exact.hidden=same;
  const cancel=host.querySelector('[data-ds-cancel]');if(cancel)cancel.hidden=same;
  sayGesture(same?'':out.ok?n(next)+' مم · معاينة؛ طبّق المقاس لتثبيته في المسودة.':out.reason);
  scheduleDesignDraft();
 }
 function cancelWidth(){
  if(!widthPreview||!canEdit())return;precision?.cancel();widthPreview=null;showEditError('');render('[name="widthMm"]');writeDesignDraft();sayGesture('أُلغيت معاينة المقاس وبقيت المسودة السابقة.');
 }
 function historyAvailable(forward){
  if(!canEdit()||pending||stale()||widthPreview||drag)return false;
  if(forward&&usable()&&redos[s.alternative]?.length)return true;
  if(!s.applied)return usable()&&!!(forward?redos[s.alternative]?.length:history().length);
  return onHistory?!!canHistory?.(forward):!forward&&!!last();
 }
 function travelDesign(forward){
  if(rawBlocked()||!historyAvailable(forward))return;
  if(s.applied&&onHistory&&!(forward&&redos[s.alternative]?.length)){
   const u=facts().units.find(u=>u.id===s.part),focus={projectId:s.base.room.projectId,unitId:u?.id,runId:u?.runId,proposalView:s.face,yaw:s.yaw,frameUnits:s.frameUnits};
   const result=onHistory(forward,focus);if(result?.ok===false)tell(result.reason);return;
  }
  if(s.applied&&!forward){legacyUndo();return;}
  if(forward){const change=redos[s.alternative].pop();(s.histories[s.alternative]??=[]).push(change);}
  else (redos[s.alternative]??=[]).push(history().pop());
  computed=null;error='';s.sheet='';s.applied=drawing()===getDoc();render('[data-wp="design-'+(forward?'redo':'undo')+'"]');
 }
 function legacyUndo(){
  if(!canEdit()||!usable()||s.sheet||!last())return;
  const savedChange=s.applied;
  if(savedChange){const result=apply(last().before,'أُعيدت مقاسات الرسم وصف المصنع والحصر إلى ما قبل التعديل.');if(result?.ok===false){tell(result.reason);return;}s.base=getDoc();s.persisted=result?.saved!==false;}
  (redos[s.alternative]??=[]).push(history().pop());computed=null;s.applied=savedChange||drawing()===getDoc();error='';s.sheet='';render();
 }
 function stageChange(out,before,args,focus){
  if(!canEdit())return false;
  if(!out.ok){showEditError(out.reason);return false;}
  widthPreview=null;error='';redos[s.alternative]=[];(s.histories[s.alternative]??=[]).push({...out,before,args});s.applied=false;s.sheet='';computed=null;render(focus);tell(args.kind==='move'?'ثُبّت ترتيب الوحدة في المسودة. احفظ التوزيع لكتابته في المشروع.':'ثُبّت المقاس في المسودة. احفظ التوزيع لكتابته في المشروع.');return true;
 }
 function moveUnit(targetId){
  if(!canEdit()||rawBlocked()||!s.part||!usable()||s.sheet)return;
  const before=drawing(),out=previewKitchenUnitMove(before,s.part,targetId);
  stageChange(out,before,{kind:'move',part:s.part,targetId});if(!out.ok)sayGesture(out.reason);
 }
 function readSettings(){
  const f=host.querySelector('[data-plan-controls]');if(!f)return s.settings;
  return {walls:[...f.querySelectorAll('[name="wall"]:checked')].map(x=>x.value),...Object.fromEntries(['sink','rice','dishwasher'].map(k=>[k,f.elements.namedItem(k)?.checked===true]))};
 }
 async function generate(params=readSettings()){
  if(!canEdit()||rawBlocked()||pending)return;if(stale()){tell('تغيّر المشروع. أعد فتح المقترح.');return;}
  const t=++epoch,source=s.base;s.settings=params;error='';pending=true;s.issue=null;s.sheet='';render();
  try{
   const res=await proposeWholeKitchen(source,{walls:params.walls,wanted:{sink:params.sink,rice:params.rice,dishwasher:params.dishwasher},pause:()=>new Promise(resolve=>setTimeout(resolve,0)),cancel:()=>signal.aborted||t!==epoch||stale()||!canEdit()});
   if(signal.aborted||t!==epoch||!canEdit())return;
   if(res.ok){const first=!s.model;s.settings=params;s.generatedSettings=params;s.requestFailed=false;s.model=res;if(first)s.face=params.walls.length===1?params.walls[0]:'plan';s.alternative=0;s.histories=[];redos=[];s.applied=false;s.sheet='';s.part='';s.pickedPart=null;computed=null;}
   else{s.requestFailed=true;s.issue=res;s.sheet='questions';}
  }catch(err){if(!signal.aborted&&t===epoch){s.requestFailed=true;s.issue={reason:err.message||'تعذّر حساب التصميم.'};}}
  finally{if(!signal.aborted&&t===epoch){pending=false;render();}}
 }
 function openStored(selectedId=''){
  const quote=buildFactoryQuote(s.base),qs=reviewWholeProposal(s.base,unique(s.base.kitchen.runs.map(r=>r.wall).filter(Boolean)),quote);
  s.generatedSettings=s.settings;s.requestFailed=false;
  s.model={stored:true,candidates:[{doc:s.base,quote,total:quote.total,reasons:[],questions:qs}]};s.alternative=0;s.histories=[];redos=[];s.applied=true;s.sheet='';s.issue=null;s.part=selectedId;computed=null;
  if(selectedId&&s.face==='plan')s.planTier=facts().units.find(u=>u.id===selectedId)?.tier==='upper'?'upper':'base';
  render();
 }
 function applyDraft(){
  if(!canEdit()||rawBlocked())return false;
  if(!usable()){tell('أعد حساب المقترح من المشروع الحالي.');return false;}
  const d=drawing(),hold=budgetHold(facts().quote,d.room.workshop?.layoutBrief);if(hold){tell(hold);return false;}
  const r=apply(d,'طُبّق تصميم المطبخ.');if(r?.ok===false){tell(r.reason);return false;}
  s.base=getDoc();s.applied=true;s.persisted=r?.saved!==false;redos=[];
  // The live project commit normalizes the document. Future edits and draft
  // replay start from that exact saved version, not the generated predecessor.
  if(onHistory){const quote=buildFactoryQuote(s.base);s.model={stored:true,candidates:[{doc:s.base,quote,total:quote.total,reasons:[],questions:reviewWholeProposal(s.base,storedWalls(),quote)}]};s.alternative=0;s.histories=[];computed=null;}
  clearTimeout(draftTimer);draftTimer=0;clearDraft('design',s.base.room.projectId);render();return true;
 }
 function adjust(delta,focus,edge=null){
  if(!canEdit()||!s.part||!usable()||s.sheet)return;
  if(stale()){tell('تغيّر الرسم. احسب المقترح مجددًا.');return;}
  const before=drawing(),out=previewKitchenWidthChange(before,s.part,delta,{edge,explicitUserChange:true,inputKind:edge?'grip':'button'});
  stageChange(out,before,{part:s.part,delta,edge},focus);
 }
 function selectUnit(id,focus,part=null){
  if(rawBlocked()||!usable())return;
  const unit=facts().units.find(u=>u.id===id);if(!unit)return;
  s.part=id;s.pickedPart=part;
  if(s.face==='plan')s.planTier=unit.tier==='upper'?'upper':'base';
  else if(s.face!=='volume'&&s.face!==unit.wall)s.face=unit.wall||'plan';
  error='';render(focus);
 }
 function clearUnit(focus){
  if(rawBlocked())return;
  s.part='';s.pickedPart=null;error='';render(focus);
 }
 function selectView(face){
  if(rawBlocked())return;
  dragged=false;s.face=face;
  const unit=s.part&&ready()?facts().units.find(u=>u.id===s.part):null;
  if(unit&&face==='plan')s.planTier=unit.tier==='upper'?'upper':'base';
  else if(unit&&face!=='volume'&&unit.wall!==face){s.part='';s.pickedPart=null;error='';}
  render(face==='volume'||face==='plan'||viewChoices(drawing()).length===1?'[data-wp-view="'+face+'"]':'[data-wp-elevation]');}
 function openPanel(key){
  if(rawBlocked())return;
  s.sheet=s.sheet===key?'':key;render(s.sheet?'[data-pd-open]':key==='feature'?'[data-wp-canvas] svg':'[data-wp="'+key+'"]');
  if(s.sheet)host.querySelector('[data-pd-open]')?.scrollIntoView({block:'nearest'});
 }
 host.addEventListener('submit',e=>{
  e.preventDefault();
  if(e.target.matches('[data-plan-controls]')){void generate();return;}
  if(e.target.matches('[data-width-change]')){
   const p=facts().units.find(u=>u.id===s.part),next=assistNumber(new FormData(e.target).get('widthMm'));
   if(!p||!Number.isSafeInteger(next)){showEditError('أدخل عرضًا صحيحًا بالملليمتر.');return;}
   if(widthPreview&&(widthPreview.part!==p.id||widthPreview.source!==drawing()||!usable())){tell('تغيّر مصدر المعاينة. ألغها وافتح التصميم الحالي.');return;}
   if(next===p.widthMm)return;adjust(next-p.widthMm,'[name="widthMm"]');
  }
 },{signal});
 host.addEventListener('input',e=>{
  if(e.target.matches('[name="widthMm"]'))inputWidth(e.target);
 },{signal});
 host.addEventListener('change',e=>{
  if(widthPreview){rawBlocked();if(e.target.matches('[data-wp-unit]'))e.target.value=s.part;if(e.target.matches('[data-wp-elevation]'))e.target.value=s.face;return;}
  if(e.target.closest('[data-plan-controls]')){
   s.settings=readSettings();s.issue=null;
   const selector=e.target.name==='wall'?'[name="wall"][value="'+e.target.value+'"]':'[name="'+e.target.name+'"]';
   render(selector);return;
  }
  if(e.target.matches('[data-wp-unit]')){if(e.target.value)selectUnit(e.target.value,'[data-wp-unit]');else clearUnit('[data-wp-unit]');}
  if(e.target.matches('[data-wp-elevation]')&&e.target.value)selectView(e.target.value);
 },{signal});
 host.addEventListener('click',async e=>{
  if(!e.target.closest('.pd-compare'))host.querySelector('.pd-compare[open]')?.removeAttribute?.('open');
  const canvas=e.target.closest('[data-wp-canvas]');
  if(canvas){
   if(rawBlocked())return;
   if(canPick()&&!dragged&&!e.defaultPrevented){
    const hit=hitAt(e);
    if(s.sheet&&!['feature','part'].includes(s.sheet)){if(hit.unit&&['changes','details'].includes(s.sheet))selectUnit(hit.unit.id);return;}
    if(hit.target&&hit.target.route!=='unit-part'){s.pickedPart=hit.target;s.sheet='part';render('[data-pd-open]');}
    else if(hit.unit){s.sheet='';inspectUnit(hit.unit.id,hit.target);}
    else if(hit.feature){s.pickedPart=null;s.siteFeature=hit.feature.id;s.sheet='feature';render('[data-pd-open]');}
   }
   return;
  }
  const b=e.target.closest('button');if(!b)return;
  if(widthPreview&&!b.hasAttribute('data-wp-exact')&&!['cancel-width','focus-width'].includes(b.dataset.wp)){if(rawBlocked())return;}
  if(pending&&!['cancel','rotate'].includes(b.dataset.wp)&&!b.hasAttribute('data-wp-view'))return;
  if(b.hasAttribute('data-wp-view')){selectView(b.dataset.wpView);return;}
  if(b.hasAttribute('data-wp-tier')){
   const tier=b.dataset.wpTier;if(tier===s.planTier)return;
   s.planTier=tier;s.part='';s.pickedPart=null;error='';render('[data-wp-tier="'+tier+'"]');return;
  }
  if(b.hasAttribute('data-wp-alt')){if(!usable()||s.sheet)return;s.alternative=Number(b.dataset.wpAlt);s.pickedPart=null;s.applied=drawing()===getDoc();s.part='';s.sheet='';error='';computed=null;render('.pd-compare summary');return;}
  if(b.hasAttribute('data-wp-question')){const q=questionList[Number(b.dataset.wpQuestion)];if(q&&(!usable()||s.applied||applyDraft()))onAdvance(q.step,q.focus);return;}
  switch(b.dataset.wp){
   case 'cancel-width':cancelWidth();break;
   case 'focus-width':host.querySelector('[name="widthMm"]')?.focus();host.querySelector('[name="widthMm"]')?.select?.();break;
   case 'design-undo':travelDesign(false);break;
   case 'design-redo':travelDesign(true);break;
   case 'ds-unit':if(canPick()){s.sheet='';inspectUnit(b.dataset.unit);}break;
   case 'ds-wall':if(s.measured.includes(b.dataset.wall)&&viewChoices(drawing()).some(w=>w.id===b.dataset.wall))selectView(b.dataset.wall);else onAdvance('survey',{wall:b.dataset.wall});break;
   case 'ds-source':onAdvance('survey',{wall:b.dataset.wall});break;
   case 'move-before':case 'move-after':{
    const unit=facts().units.find(u=>u.id===s.part),row=facts().units.filter(u=>u.runId===unit?.runId).sort((a,b)=>a.startMm-b.startMm),index=row.findIndex(u=>u.id===unit?.id),target=row[index+(b.dataset.wp==='move-before'?-1:1)];
    if(target)moveUnit(target.id);else sayGesture('الوحدة عند طرف الصف.');break;
   }
   case 'restore':if(s.generatedSettings&&!stale()){s.settings=s.generatedSettings;s.requestFailed=false;s.issue=null;s.sheet='';computed=null;render();}break;
   case 'generate':void generate();break;
   case 'cancel':clearInteraction();render();break;
   case 'settings':case 'details':case 'questions':case 'changes':openPanel(b.dataset.wp);break;
   case 'clear-unit':clearUnit('[data-wp-unit]');break;
   case 'close-sheet':if(s.sheet){const key=s.sheet;if(key==='part')s.pickedPart=null;openPanel(key);}break;
   case 'plus':adjust(100,'[data-wp="plus"]');break;
   case 'minus':adjust(-100,'[data-wp="minus"]');break;
   case 'undo':if(onHistory)travelDesign(false);else legacyUndo();break;
   case 'edit-part':if(s.pickedPart&&canPick()&&(s.applied||!ready()))onAdvance(s.pickedPart.route,s.pickedPart.focus);break;
   case 'correct-feature':{
    const live=sourceFeature(inspectedFeature());
    if(live)onAdvance('survey',{wall:live.wall,featureId:live.id,edit:true});
    break;
   }
   case 'fit':view.reset();break;
   case 'framing':s.frameUnits=!s.frameUnits;render('[data-wp="framing"]');break;
   case 'rotate':s.yaw=(s.yaw+90)%360;paintScene();break;
   case 'usage':openUsage(facts().units.find(u=>u.id===s.part),b.dataset.useId);break;
   case 'apply':if(!s.sheet)applyDraft();break;
   case 'preview-report':case 'report':{if(!usable())break;const d=drawing(),h=last();const html=customerReport({doc:d,before:h?.before,change:h,wallIds:s.model?.stored?null:storedWalls(),reasons:candidate().reasons,questions:facts().questions,comparison:proposalComparisons(optionDocs())[s.alternative],saved:s.applied&&s.persisted});if(b.dataset.wp==='report')downloadCustomerReport(html);else previewCustomerReport(html,b);break;}
   case 'current':if(!ready()){clearInteraction();openStored();}break;
   case 'survey':{const wall=s.settings.walls.find(id=>!s.measured.includes(id))||s.base.room.workshop?.activeWall;onAdvance('survey',wall?{wall}:{});}break;
   case 'intake':case 'decisions':onAdvance(b.dataset.wp);break;
   case 'approve':if(usable()&&s.applied&&s.persisted)onAdvance('approve');break;
  }
 },{signal});
 function inspectUnit(id,part=null){
  if(rawBlocked()||!canPick()||!facts().units.some(u=>u.id===id))return false;
  if(ready())selectUnit(id,undefined,part);else{s.pickedPart=part;openStored(id);}
  return true;
 }
 function hitAt(e){
  const get=(selector,key)=>e.target?.closest?.(selector)?.getAttribute(key);
  const d=drawing(),sheet=sheetTarget(e.target,d,s.face);
  let id=sheet?.focus.unitId||get('[data-sheet-unit]','data-sheet-unit')||get('[data-kitchen-3d-part="module"]','data-kitchen-3d-id');
  let feature=sheet?.focus.featureId||get('[data-sheet-feature]','data-sheet-feature')||get('[data-room-opening]','data-room-opening')||get('[data-kitchen-3d-part="fixture"]','data-kitchen-3d-id');
  let target=sheet;
  if(!sheet&&s.face==='volume'&&pick&&!e.keyboard&&!e.target?.closest?.('[data-wp-grip]')&&(!id&&!feature||e.target.closest?.('[data-kitchen-3d-part],[data-room-surface]'))){
   const ct=getSvg()?.getScreenCTM();
   if(ct){
    const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(ct.inverse()),f=pick(pt.x,pt.y);
    if(f){
     id=f.part==='module'?f.id:f.unitId;feature=f.part==='fixture'?f.id:null;
     target=f.sitePointId?{route:'floor-point',focus:{pointId:f.sitePointId}}:volumeTarget?.(f);
    }
   }
  }
  const unit=facts().units.find(u=>u.id===(id||(e.keyboard||e.target?.closest?.('[data-wp-grip]')?s.part:null)));
  const site=d.kitchen.features.find(f=>f.id===feature);
  if(target?.route==='unit'||target?.route==='survey'&&site&&target.focus.featureId===site.id)target=null;
  return {unit,feature:site,target};
 }
 function sourceFeature(f){
  if(!f||pending||stale())return null;
  return getDoc().kitchen.features.find(v=>v.id===f.id&&v.wall===f.wall&&v.kind===f.kind);
 }
 function featureActions(f){
  if(!sourceFeature(f))return [];
  const actions=[{label:'تحرير قياسات العنصر',run:()=>onAdvance('survey',{wall:f.wall,featureId:f.id,edit:true})}];
  if(s.applied&&f.kind==='window')actions.push({label:'نعلة الرخام عند الشباك',run:()=>onAdvance('assembly',{section:'stone',wall:f.wall,windowId:f.id})});
  return actions;
 }
 function canSetUsage(p){
  return !!p&&!p.model&&!['sink','dishwasher'].includes(p.family)&&['cabinet','special'].includes(kitchenUnitSpecs[p.kind]?.family);
 }
 function contextActions(e){
  // A menu captures the same draft, unit and wall on which it was opened.
  const source=drawing(),session=s,valid=()=>source===drawing()&&session===s&&canPick()&&!widthPreview;
  const hit=valid()?hitAt(e):{},p=hit.unit;
  const fit={label:'ضبط المنظر',run:()=>view.reset()};
  if(s.sheet&&!['feature','part'].includes(s.sheet)){
   const sheet=s.sheet,actions=[];
   if(p&&['changes','details'].includes(sheet))actions.push({label:sheet==='changes'?'عرض أثر التعديل على هذه الوحدة':'قراءة مقاس هذه الوحدة',run:()=>{if(valid()&&s.sheet===sheet)selectUnit(p.id);}});
   actions.push(fit);return {title:panelNames[sheet],actions};
  }
  if(hit.target){
   const t=hit.target,actions=[];
   if(s.applied||!ready())actions.push({label:'تحرير '+partTitle(t),run:()=>{if(valid())onAdvance(t.route,t.focus);}});
   actions.push(fit);return {title:partTitle(t),actions};
  }
  if(hit.feature){
   const actions=featureActions(hit.feature).map(a=>({...a,run:()=>{if(valid())a.run();}}));
   return {title:kitchenFeatureSpecs[hit.feature.kind]?.label||'عنصر الجدار',actions:[...actions,fit]};
  }
  if(!p)return {title:'الرسم',actions:[fit,{label:s.face==='volume'?'عرض المسقط':'عرض المنظور',run:()=>selectView(s.face==='volume'?'plan':'volume')}]};
  const select=fn=>()=>{if(!valid())return;if(['feature','part'].includes(s.sheet))s.sheet='';if(inspectUnit(p.id))fn();};
  const actions=[];
  if(p.resizable)actions.push({label:'كتابة العرض بالملليمتر',run:select(()=>{const input=host.querySelector('[name="widthMm"]');input?.focus();input?.select?.();})});
  if(canSetUsage(p)){
   actions.push({label:s.applied?'استخدام هذه الوحدة':'تطبيق المقترح وتحديد الاستخدام',run:()=>{
    if(valid()){if(!ready())openStored(p.id);openUsage(p);}
   }});
  }
  if(last()?.changes.some(change=>change.unitId===p.id))actions.push({label:'أثر تعديل هذه الوحدة',run:select(()=>{
   if(s.sheet!=='changes')openPanel('changes');else host.querySelector('[data-pd-open]')?.focus();
  })});
  if(p.wall&&s.face!==p.wall)actions.push({label:'عرض واجهة هذا الجدار',run:select(()=>selectView(p.wall))});
  else actions.push({label:s.face==='plan'?'عرض المنظور':'عرض المسقط',run:select(()=>selectView(s.face==='plan'?'volume':'plan'))});
  if(actions.length<4&&s.applied&&s.base.room.workshop?.rows?.[p.runId])actions.push({label:'تخصيص صف الوحدة',run:()=>{if(valid()&&s.applied)onAdvance('row',{runId:p.runId});}});
  return {title:p.label+' · '+n(p.widthMm)+' مم',actions};
 }
 function sayGesture(message){
  const output=host.querySelector('[data-wp-gesture]');if(output)output.textContent=message;
 }
 function cancelDrag(repaint=true){
  const was=drag;drag=null;
  if(rotationFrame){cancelAnimationFrame(rotationFrame);rotationFrame=0;}
  if(was?.canvas?.hasPointerCapture?.(was.id))was.canvas.releasePointerCapture(was.id);
  if(was?.edge&&repaint){
   paintScene();sayGesture('أُلغي السحب وبقيت المقاسات السابقة.');
  }
 }
 function widthDelta(e,d){
  const local=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.inverse);
  const along=((local.x-d.origin.x)*d.dx+(local.y-d.origin.y)*d.dy)/(d.dx*d.dx+d.dy*d.dy);
  const width=d.unit.widthMm+(d.edge==='end'?1:-1)*along*d.unit.widthMm;
  return snapFactoryWidthMm(d.source,d.unit.id,width)-d.unit.widthMm;
 }
 function previewWidth(d,delta){
  if(d.delta===delta)return;
  d.delta=delta;
  const out=delta?previewKitchenWidthChange(d.source,d.unit.id,delta,{withEffects:false,edge:d.edge}):{ok:true,doc:d.source};
  paintScene(out.ok?out.doc:d.source);
  sayGesture(n(d.unit.widthMm+delta)+' مم · '+(out.ok?'أفلت لتثبيت العرض في المسوّدة.':out.reason));
 }
 function moveTarget(e,d){
  const local=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.inverse);
  const along=((local.x-d.origin.x)*d.dx+(local.y-d.origin.y)*d.dy)/(d.dx*d.dx+d.dy*d.dy);
  const center=d.unit.startMm+d.unit.widthMm/2+along*d.unit.widthMm;
  return facts().units.filter(u=>u.runId===d.unit.runId).reduce((best,u)=>Math.abs(u.startMm+u.widthMm/2-center)<Math.abs(best.startMm+best.widthMm/2-center)?u:best,d.unit);
 }
 function previewMove(d,target){
  if(d.targetId===target.id)return;d.targetId=target.id;
  const out=target.id===d.unit.id?{ok:true,doc:d.source}:previewKitchenUnitMove(d.source,d.unit.id,target.id,{withEffects:false});
  paintScene(out.ok?out.doc:d.source);
  sayGesture(out.ok?target.id===d.unit.id?'الموضع الحالي.':'موضع '+target.code+' · أفلت لتثبيت الترتيب في المسودة.':out.reason);
 }
 host.addEventListener('pointerdown',e=>{
  const canvas=e.target.closest('[data-wp-canvas]');if(!canvas)return;
  if(e.defaultPrevented||rawBlocked())return;
  if(e.isPrimary===false||e.button!==0){if(drag)cancelDrag();return;}
  dragged=false;
  const grip=e.target.closest('[data-wp-grip]');
  if(grip&&canEdit()&&usable()&&!s.sheet){
   const unit=facts().units.find(u=>u.id===s.part),matrix=getSvg()?.getScreenCTM();
   const dx=Number(grip.dataset.axisX),dy=Number(grip.dataset.axisY);
   if(!(grip.dataset.wpGrip==='move'?unit?.movable:unit?.resizable)||!matrix||!(Math.hypot(dx,dy)>0))return;
   e.preventDefault();const inverse=matrix.inverse(),origin=new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse);
   drag={canvas,id:e.pointerId,x:e.clientX,y:e.clientY,source:drawing(),unit,edge:grip.dataset.wpGrip,dx,dy,inverse,origin};
   getSvg()?.focus?.({preventScroll:true});canvas.setPointerCapture?.(e.pointerId);sayGesture(grip.dataset.wpGrip==='move'?'اسحب باتجاه الصف لإعادة ترتيب الوحدة.':n(unit.widthMm)+' مم · اسحب الحافة لتغيير العرض.');return;
  }
  if(s.face==='volume')drag={canvas,id:e.pointerId,x:e.clientX,y:e.clientY,yaw:s.yaw};
 },{signal});
 host.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(e.buttons!=null&&e.buttons!==1){cancelDrag();return;}
  const d=drag,dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(d.edge){
   if(!canEdit()||!usable()||drawing()!==d.source){cancelDrag();return;}
   if(!dragged&&Math.hypot(dx,dy)<(e.pointerType==='touch'?7:3))return;
   dragged=true;
   if(d.edge==='move')d.nextTarget=moveTarget(e,d);else d.nextDelta=widthDelta(e,d);
   if(!rotationFrame)rotationFrame=requestAnimationFrame(()=>{rotationFrame=0;if(drag===d){if(!canEdit()||!usable()||drawing()!==d.source){cancelDrag();return;}if(d.edge==='move')previewMove(d,d.nextTarget);else previewWidth(d,d.nextDelta);}});
   return;
  }
  if(!dragged&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){dragged=true;d.canvas.setPointerCapture?.(e.pointerId);}
  if(dragged){
   s.yaw=(d.yaw+dx*.55+360)%360;
   if(!rotationFrame)rotationFrame=requestAnimationFrame(()=>{rotationFrame=0;paintScene();});
  }
 },{signal});
 host.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const d=drag;cancelDrag(false);
  if(!d.edge){if(dragged)paintScene();return;}
  if(d.edge==='move'){
   const target=moveTarget(e,d);paintScene();
   if(canEdit()&&dragged&&target.id!==d.unit.id&&usable()&&drawing()===d.source)moveUnit(target.id);else sayGesture('لم يتغيّر ترتيب الوحدة.');
   return;
  }
  const delta=widthDelta(e,d);
  if(!dragged||!delta||!usable()||drawing()!==d.source){paintScene();sayGesture('لم يتغيّر العرض.');return;}
  paintScene();adjust(delta,undefined,d.edge);
  if(error)sayGesture(error);
 },{signal});
 host.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)cancelDrag();},{signal});
 host.addEventListener('lostpointercapture',e=>{
  if(drag?.id!==e.pointerId||e.target!==drag.canvas&&drag.canvas.hasPointerCapture?.(e.pointerId))return;
  cancelDrag();
 },{signal});
 host.addEventListener('keydown',e=>{
  if(!e.defaultPrevented&&(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.target.matches?.('input,select,textarea,[contenteditable="true"]')&&['z','y'].includes(e.key.toLowerCase())){
   e.preventDefault();e.stopPropagation();travelDesign(e.key.toLowerCase()==='y'||e.shiftKey);return;
  }
  if(e.key!=='Escape'||e.defaultPrevented)return;
  if(drag){e.preventDefault();e.stopPropagation();cancelDrag();return;}
  if(widthPreview){e.preventDefault();e.stopPropagation();cancelWidth();return;}
  const comparison=e.target.closest?.('.pd-compare[open]');
  if(comparison){e.preventDefault();comparison.open=false;comparison.querySelector('summary').focus();return;}
  if(!s.sheet&&s.part&&!e.target.matches?.('input,select,textarea')){e.preventDefault();clearUnit('[data-wp-unit]');}
 },{signal});
 host.addEventListener('pointerleave',()=>{if(!dragged&&!drag?.edge)cancelDrag(false);},{signal});
 globalThis.window?.addEventListener?.('blur',cancelDrag,{signal});
 // A design that was calculated but not applied is kept as its recipe: the settings and the width changes made on it. The calculation gives
 // the same answer from the same project, so after a reload it is calculated again and the changes are replayed on top of it.
 const projectKey=()=>s.base.room.projectId;
 const baseStamp=()=>stableHash(savedProjectText()??'');
 function draftRecipe(){
  if(!unapplied()||!ready()||pending||stale()||discarded)return null;
  return {base:baseStamp(),kind:s.model.stored?'stored':'generated',settings:s.generatedSettings,alternative:s.alternative,face:s.face,
   edits:s.histories.map(list=>(list||[]).map(h=>h.args).filter(Boolean)),rawWidth:widthPreview?{part:widthPreview.part,raw:widthPreview.raw}:null,pendingSettings:sameSettings(s.settings,s.generatedSettings)?null:s.settings};
 }
 function writeDesignDraft(){
  clearTimeout(draftTimer);draftTimer=0;
  if(!canEdit())return false;
  const recipe=draftRecipe();
  if(recipe)draftSaved=writeDraft('design',projectKey(),recipe);
  else if(!unapplied()){clearDraft('design',projectKey());draftSaved=true;}
  else draftSaved=false;
  return draftSaved;
 }
 function scheduleDesignDraft(){if(resuming||discarded)return;draftSaved=false;if(!draftTimer)draftTimer=setTimeout(writeDesignDraft,400);}
 const cleanEdit=a=>a&&typeof a==='object'&&typeof a.part==='string'&&a.part.length<=40?
  a.kind==='move'&&typeof a.targetId==='string'&&a.targetId.length<=40?{kind:'move',part:a.part,targetId:a.targetId}:
  a.kind==null&&Number.isSafeInteger(a.delta)&&(a.edge==null||['start','end'].includes(a.edge))?{part:a.part,delta:a.delta,edge:a.edge??null}:null:null;
 async function resumeDesignDraft(){
  if(!canEdit())return;
  const saved=readDraft('design',projectKey()),r=saved?.payload;
  if(!r||r.base!==baseStamp()||!Array.isArray(r.edits)||r.edits.length>8)return;
  const settings=r.settings;
  if(r.kind==='stored'?!s.base.kitchen.units.length:!settings||!Array.isArray(settings.walls)||settings.walls.length>8||!settings.walls.every(w=>typeof w==='string'))return;
  resuming=true;tell('جارٍ استعادة مسودة التصميم التي لم تُطبَّق…');
  const fail=()=>{s.model=null;s.generatedSettings=null;s.requestFailed=false;s.issue=null;s.sheet='';s.histories=[];s.applied=true;computed=null;clearDraft('design',projectKey());};
  try{
   if(r.kind==='stored')openStored();
   else{
    await generate({walls:settings.walls,sink:settings.sink===true,rice:settings.rice===true,dishwasher:settings.dishwasher===true});
    if(signal.aborted||!canEdit())return;
    if(!s.model||s.requestFailed){fail();render();return;}
   }
   const count=s.model.candidates.length;
   if(!canEdit())return;
   r.edits.forEach((list,i)=>{
    if(i>=count||!Array.isArray(list))return;
    for(const raw of list.slice(0,40)){
     const a=cleanEdit(raw);if(!a)break;
     const before=s.histories[i]?.at(-1)?.doc||s.model.candidates[i].doc;
     const out=a.kind==='move'?previewKitchenUnitMove(before,a.part,a.targetId):previewKitchenWidthChange(before,a.part,a.delta,{edge:a.edge});
     if(!out.ok)break;
     (s.histories[i]??=[]).push({...out,before,args:a});
    }
   });
   s.alternative=Math.min(Math.max(0,Number(r.alternative)||0),count-1);
   if(['volume','plan'].includes(r.face)||walls().some(w=>w.id===r.face))s.face=r.face;
   s.applied=r.kind==='stored'&&!s.histories[s.alternative]?.length;s.part='';s.pickedPart=null;s.sheet='';computed=null;
   tell('استُعيدت مسودة التصميم. راجعها ثم اضغط «حفظ التوزيع».');
   render();
   if(typeof r.rawWidth?.raw==='string'&&r.rawWidth.raw.length<=120&&facts().units.some(u=>u.id===r.rawWidth.part&&u.resizable)){
    selectUnit(r.rawWidth.part);const input=host.querySelector('[name="widthMm"]');if(input){input.value=r.rawWidth.raw;inputWidth(input);}
   }
   const next=r.pendingSettings;
   if(!widthPreview&&next&&Array.isArray(next.walls)&&next.walls.length<=8&&next.walls.every(id=>walls().some(w=>w.id===id))){s.settings={walls:next.walls,sink:next.sink===true,rice:next.rice===true,dishwasher:next.dishwasher===true};render();}
  }catch{if(!signal.aborted){fail();render();}}
  finally{resuming=false;if(!signal.aborted&&!s.applied)scheduleDesignDraft();}
 }
 const stopGuarding=registerUnsavedWork({atRisk:()=>!!widthPreview||unapplied()&&!draftSaved,flush:writeDesignDraft});
 const hideDesignDraft=()=>{if(globalThis.document?.visibilityState==='hidden')writeDesignDraft();};
 globalThis.document?.addEventListener?.('visibilitychange',hideDesignDraft);globalThis.addEventListener?.('pagehide',writeDesignDraft);
 const restore=focus.unitId&&focus.projectId===s.base.room.projectId&&s.base.kitchen.units.find(u=>u.id===focus.unitId&&u.runId===focus.runId);
 if(restore){
  const wall=s.base.kitchen.runs.find(r=>r.id===restore.runId)?.wall;
  s.face=focus.proposalView==='volume'||focus.proposalView==='plan'?focus.proposalView:wall||'plan';
  if(Number.isFinite(focus.yaw))s.yaw=focus.yaw;
  s.frameUnits=focus.frameUnits!==false;
  openStored(restore.id);
  if(s.face===focus.proposalView)view.restoreCamera(focus.camera);
 }else if(focus.unitId&&focus.projectId===s.base.room.projectId&&s.base.kitchen.units.length){
  openStored();
 }else{render();void resumeDesignDraft();}
 const dispose=()=>{
  precision?.destroy();resizeObserver?.disconnect();writeDesignDraft();stopGuarding();globalThis.document?.removeEventListener?.('visibilitychange',hideDesignDraft);globalThis.removeEventListener?.('pagehide',writeDesignDraft);
  epoch++;cancelDrag(false);menu.destroy();view.destroy();controller.abort();
 };
 // The person chose to leave without applying: the copy kept for a reload goes too.
 dispose.discardDraft=()=>{discarded=true;clearTimeout(draftTimer);draftTimer=0;clearDraft('design',projectKey());};
 dispose.hasPending=()=>unapplied()||!!drag?.edge||pending;
 dispose.tracksDraft=target=>!!target.closest?.('[data-width-change],[data-plan-controls]');
 dispose.selectionForReturn=()=>{
  if(!usable()||!s.applied||!s.persisted||s.sheet||widthPreview||drag)return null;
  const unit=getDoc().kitchen.units.find(u=>u.id===s.part);
  return unit?{unitId:unit.id,runId:unit.runId,projectId:s.base.room.projectId,proposalView:s.face,yaw:s.yaw,frameUnits:s.frameUnits,camera:view.readCamera()}:null;
 };
 dispose.commandContext=()=>{
  const savedDesign=s.applied&&s.persisted&&!stale()&&!pending&&!outdated()&&!s.sheet&&!widthPreview&&!drag;
  const unit=savedDesign&&facts().units.find(u=>u.id===s.part);
  return {savedDesign,unitId:unit?.id||null,runId:unit?.runId||null,canSetUsage:canSetUsage(unit)};
 };
 if(host.ownerDocument?.defaultView)precision=mountDesignerPrecision(host,{onInput:inputWidth,canEdit:()=>canEdit()&&usable()&&!s.sheet&&!drag,stepMm:()=>{
  const p=facts().units.find(u=>u.id===s.part);if(!p)return 1;
  // Find one whole factory increment using the same snap rule as the grips.
  for(let delta=1;delta<=2400;delta++){const next=snapFactoryWidthMm(drawing(),p.id,p.widthMm+delta)-p.widthMm;if(next>0)return next;}return 1;
 },isEditing:()=>!!widthPreview,onCancel:cancelWidth});
 if(host.ownerDocument?.defaultView&&typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>positionDesignerHud(host));observeDesignerSize();}
 return dispose;
}
