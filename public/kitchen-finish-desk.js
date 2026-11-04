import {studioIcon} from './kitchen-tool-icons.js';
import {sheetTarget} from './kitchen-sheet-target.js';
import {kitchenFeatureSpecs,kitchenUnitSpecs} from './kitchen-model.js';
// The approved elevation is a finish selector. Selecting a cabinet or a
// category only changes the view; only an explicit catalogue choice can write.
import {elevationSheet,sheetFaces,sheetFeatureReadout} from './kitchen-sheet.js';
import {finishMembers,finishParts,catalogDisplayColor} from './kitchen-finish-parts.js';
import {mountClientParts,mountFinishHardware} from './kitchen-finish-parts-ui.js';
import {cornerFrontTargets} from './kitchen-corner-finishes.js';
import {mountCornerFinish} from './kitchen-corner-finish-ui.js';
import {mountDrawingContext} from './kitchen-drawing-context.js';
import {proposalScene} from './kitchen-proposal-presentation.js';
import {mountDrawingViewport} from './kitchen-drawing-viewport.js';
import {buildFactoryQuote} from './kitchen-workshop-factory.js';
import {reviewFinishPreview,reviewFinishCandidate} from './kitchen-finish-preview.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(id,label,current)=>'<option value="'+esc(id)+'"'+(current===id?' selected':'')+'>'+esc(label)+'</option>';
const number=n=>new Intl.NumberFormat('ar-SA').format(n);
const parts={materials:['body','back','shelf','divider','profile','edge'],handles:['handle','hinge'],accessories:['accessory']};
const finishSlot={front:'front',drawer:'front',pullout:'accessory',body:'body',back:'back',edge:'edge',profile:'profile',divider:'divider',handle:'handle',hinge:'hinge',shelf:'shelf',accessory:'accessory'};
const partNames={front:'الدرفة',drawer:'الدرج',pullout:'السحّابة',handle:'اليد',hinge:'المفصلة',shelf:'الرف',leg:'رجل الدولاب',accessory:'الإكسسوار',body:'الجسم',back:'الظهر',edge:'الحافة',profile:'القطاع',divider:'الفاصل'};
const categoryFor=part=>part==='front'?'front':Object.keys(parts).find(k=>parts[k].includes(part));
const categories={front:'خامة الواجهة',materials:'مواد الجسم والحواف',handles:'الأيدي والمفصلات',accessories:'إكسسوارات داخلية',mechanisms:'عتاد مشروط بالحمولة',corner:'واجهة الركن'};
const categoryGlyphs={front:'elevation',materials:'layers',handles:'handle',accessories:'box',mechanisms:'settings',corner:'grid'};
const categoryNames={front:'الواجهة',materials:'الجسم',handles:'العتاد',accessories:'الداخل',mechanisms:'الحمولة',corner:'الركن'};
export function mountFinishDesk(host,{doc,catalog,getDoc,focus={},onApply,onSurvey,onInspectPart,canEdit=()=>true,onHistory,canHistory=()=>false}){
 const members=finishMembers(doc,catalog),fin=doc.room.workshop?.finishes||{},corners=cornerFrontTargets(doc,catalog);
 const units=new Map(doc.kitchen.units.map((u,i)=>[u.id,{...u,code:'U'+(i+1)}])),runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const byId=new Map(members.map(m=>[m.id,m])),byCorner=new Map(corners.map(c=>[c.id,c]));
 const faceOf=id=>{const run=runs.get(units.get(id)?.runId);return run?.placement==='free'?run.id:run?.wall;};
 const family=m=>catalog.families[m.family],isFront=m=>family(m).recipe.some(l=>l.role==='front');
 const label=m=>units.get(m.id).code+' · '+(m.use||family(m).label);
 function choices(id){
  if(byCorner.has(id))return ['corner'];
  const list=id==='all'?members:byId.has(id)?[byId.get(id)]:[];
  const kinds=list.some(isFront)?['front']:[];
  for(const [kind,keys] of Object.entries(parts)){
   const saved=id==='all'?fin.partDefaults:fin.partUnits?.[id];
   if(keys.some(k=>saved?.[k]||list.some(m=>family(m).finishSlots?.[k])))kinds.push(kind);
  }
  if(id!=='all'&&list.some(m=>family(m).recipe.some(l=>l.hardwareRule)||fin.hardwareUnits?.[id]))kinds.push('mechanisms');
  return kinds;
 }
 const targets=members.filter(m=>choices(m.id).length),targetIds=new Set(targets.map(m=>m.id));
 const faces=sheetFaces(doc).filter(([id])=>targets.some(m=>faceOf(m.id)===id));
 let scope=targetIds.has(focus.unitId)||byCorner.has(focus.unitId)?focus.unitId:!targets.length&&corners.length?corners[0].id:'all';
 let face=faceOf(scope)||faces.find(([id])=>id===focus.face)?.[0]||faces[0]?.[0];
 let kind=focus.kind,inspection=units.has(focus.unitId)&&!targetIds.has(focus.unitId)?{unit:units.get(focus.unitId)}:null,pending=false,dead=false,revision=0;
 let component=partNames[focus.part]&&byId.has(scope)?{part:focus.part,index:focus.index}:null;
 let preview=null,redoPreview=null,notice='',error='',viewMode=focus.view==='elevation'?'elevation':'volume',pick=null,partTarget=null;
 const baseline=buildFactoryQuote(doc),editable=()=>!dead&&!pending&&getDoc()===doc&&canEdit();
 function slotChoice(){
  const slot=finishSlot[component?.part],m=byId.get(scope);
  if(!slot||!m)return null;
  if(slot==='front')return isFront(m)?'front':null;
  return family(m).finishSlots?.[slot]||fin.partUnits?.[scope]?.[slot]?slot:null;
 }
 const partTitle=()=>component?partNames[component.part]+(component.index?' '+number(component.index):''):'';
 if(component){kind=categoryFor(slotChoice());}
 const getSvg=()=>host.querySelector('[data-finish-drawing] svg');
 const snapshot=()=>({unitId:inspection?inspection.unit?.id||null:scope,face,kind:inspection?null:kind,...(component?{part:component.part,index:component.index}:{})});
 const viewport=mountDrawingViewport(host,{getSvg,canNavigate:()=>!dead&&!pending,onViewChange:positionHud});
 const menus=mountDrawingContext(host,{getSvg,actionsAt(event){
  let id=event.keyboard?(scope==='all'?null:scope):event.target.closest?.('[data-sheet-unit]')?.getAttribute('data-sheet-unit');
  if(!event.keyboard&&viewMode==='volume'&&pick){const svg=getSvg(),matrix=svg?.getScreenCTM?.();if(matrix){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(matrix.inverse()),hit=pick(q.x,q.y);if(hit?.part==='module')id=hit.id;}}
  if(!editable()||!byId.has(id))return null;
  return {title:label(byId.get(id)),actions:choices(id).map(k=>({label:categories[k],run:()=>select(id,k)}))};
 }});
 function select(id,requested,hit=null){
  if(!editable()||(id!=='all'&&!byCorner.has(id)&&!targetIds.has(id)))return;
  clearPreview('أُلغيت المعاينة غير المحفوظة عند تغيير التحديد.');
  inspection=null;scope=id;component=hit;face=faceOf(id)||face;kind=component?categoryFor(slotChoice()):requested||kind;draw();
 }
 async function write(makeNext,msg,opened){
  if(!editable()||inspection||opened!==revision)return;
  try{
   const next=makeNext();reviewFinishCandidate(doc,next,catalog,{scope});
   pending=true;updateTools();
   const result=await onApply(()=>{if(dead||opened!==revision||getDoc()!==doc||!canEdit())throw Error('تغيّر المشروع أو صلاحية التحرير. أعد فتح التشطيب.');return next;},msg,{...snapshot(),view:viewMode});
   if(result?.ok===false){error=result.reason||'تعذّر تطبيق التشطيب. بقيت المعاينة متاحة.';}
   else if(!dead&&getDoc()===next){preview=null;redoPreview=null;}
  }catch(err){error=err.message;}finally{pending=false;if(!dead)updateTools();}
 }
 function clearPreview(message=''){
  if(preview&&message)notice=message;
  preview=null;redoPreview=null;error='';
 }
 function previewChoice(command,opened){
  if(!editable()||inspection||opened!==revision)return;
  error='';redoPreview=null;
  try{
   const result=reviewFinishPreview(doc,catalog,command);
   preview=JSON.stringify(result.doc.room.workshop?.finishes)===JSON.stringify(doc.room.workshop?.finishes)?null:{...result,command};
   notice=preview?'معاينة على الرسم · لم تُحفظ بعد.':'هذا هو الاختيار المحفوظ.';
  }catch(err){preview=null;error=err.message;}
  paint();updateTools();
 }
 function paint(){
  const canvas=host.querySelector('[data-finish-drawing]');if(!canvas)return;
  const shown=preview?.doc||doc;
  const scene=viewMode==='volume'?proposalScene(shown,'volume','finish-live',{selectedId:scope==='all'?null:scope,interactive:true,frameUnits:true}):{html:elevationSheet(shown,face,true)};
  pick=scene.hitTest;partTarget=scene.partTarget;canvas.innerHTML=scene.html;
  const svg=getSvg();svg?.setAttribute?.('tabindex','0');svg?.setAttribute?.('aria-label',viewMode==='volume'?'معاينة تشطيب الوحدات':'واجهة اختيار تشطيب الدولاب');
  if(svg?.getAttribute)viewport.sync(svg,svg.getAttribute('viewBox'),viewMode+'/'+face);
  for(const el of canvas.querySelectorAll('[data-sheet-unit]')){
   const id=el.getAttribute('data-sheet-unit');
   if(id===scope)el.classList.add('finish-picked');else if(targetIds.has(id))el.classList.add('finish-pickable');
  }
  positionHud();
 }
 function positionHud(){
  const hud=host.querySelector('.fs-hud'),canvas=host.querySelector('.fs-canvas-wrap');if(!hud?.style||!canvas?.getBoundingClientRect)return;
  const marker=[...host.querySelectorAll(viewMode==='volume'?'[data-kitchen-3d-id]':'[data-sheet-unit]')].find(e=>e.getAttribute(viewMode==='volume'?'data-kitchen-3d-id':'data-sheet-unit')===scope);
  const a=marker?.getBoundingClientRect(),b=canvas.getBoundingClientRect(),w=hud.offsetWidth||280,h=hud.offsetHeight||110;
  hud.style.left=Math.max(8,Math.min(b.width-w-8,a?a.x+a.width/2-b.x-w/2:12))+'px';
  hud.style.top=Math.max(8,Math.min(b.height-h-8,a?a.y-b.y-h-12:12))+'px';
 }
 function updateTools(){
  const text=host.querySelector('[data-finish-status]');if(text)text.textContent=error||notice||(scope==='all'?'حدّد وحدة أو جرّب عينة من كتالوج المصنع.':'جرّب العينة على الوحدة ثم احفظ الاختيار.');
  const hud=host.querySelector('.fs-hud');if(hud?.dataset)hud.dataset.state=error?'invalid':pending?'saving':preview?'preview':'idle';
  const price=host.querySelector('[data-finish-price]'),q=preview||{},money=n=>Number.isFinite(n)?number(Math.round(n*100)/100)+' ر.س.':'بانتظار اكتمال الأسعار';
  const impact=host.querySelector('[data-finish-impact]');if(impact)impact.textContent=preview?'فرق إجمالي العرض المحسوب: '+money(q.delta):'';
  if(price)price.innerHTML='<span>قيمة مواد المشروع</span><strong>'+money(preview?q.materialValue:baseline.materialValue)+'</strong><small>فرق المواد: '+(preview?money(q.materialDelta):'—')+'</small><small>إجمالي العرض المحسوب: '+money(preview?q.total:baseline.total)+'</small>'+(preview?'<small>فرق إجمالي العرض: '+money(q.delta)+'</small>':'')+((preview?q.quote:baseline)?.fitoutPending?.length?'<small>توجد بنود تجهيز لم تُحسم؛ راجعها في الحصر والسعر.</small>':'')+'<small>يشمل الحصر كل المشروع؛ يُراجع الاعتماد من الحصر والسعر.</small>';
  const states={'[data-finish-save]':!preview||!!error||!editable(),'[data-finish-cancel]':(!preview&&!error)||!editable(),'[data-finish-undo]':!editable()||(!preview&&!canHistory(false)),'[data-finish-redo]':!editable()||(!redoPreview&&!canHistory(true))};
  for(const [s,disabled] of Object.entries(states)){const b=host.querySelector(s);if(b)b.disabled=disabled;}
  positionHud();
 }
 function cancel(){if(!editable())return;clearPreview();notice='أُلغيت المعاينة؛ بقي التشطيب المحفوظ كما هو.';draw();}
 function history(forward){
  if(!editable())return;
  if(!forward&&preview){redoPreview=preview;preview=null;error='';notice='تم التراجع عن المعاينة غير المحفوظة.';draw();return;}
  if(forward&&redoPreview){const saved=redoPreview;redoPreview=null;previewChoice(saved.command,revision);draw();return;}
  if(!preview){clearPreview();onHistory?.(forward,{...snapshot(),view:viewMode});}
 }
 function frontEditor(panel,opened){
  const targetList=(scope==='all'?members.filter(m=>!m.locks?.finish&&!fin.units?.[m.id]):[byId.get(scope)]).filter(isFront);
  const skus=catalog.items.filter(i=>i.role==='front'&&i.kind==='panel'&&(i.available||i.stockUnits>0)&&targetList.length&&targetList.every(m=>!family(m).frontSkus?.length||family(m).frontSkus.includes(i.sku)));
  if(!skus.length){panel.innerHTML='<p>لا توجد واجهة مشتركة متاحة لهذا النطاق من الكتالوج. اختر وحدة أخرى أو راجع وصفة المصنع.</p>';return;}
  const shownFin=preview?.doc.room.workshop?.finishes||fin;
  const current=shownFin.units?.[scope]?.frontSku||shownFin.frontSku||(scope==='all'?null:family(byId.get(scope)).recipe.find(l=>l.role==='front')?.sku);
  const target=scope==='all'?'الوحدات المؤهلة ('+number(targetList.length)+')':label(byId.get(scope));
  const samples='<div class="dp-finish-samples" role="group" aria-label="عينات الواجهات المتاحة">'+skus.map(i=>{
   const hex=catalogDisplayColor(i);
   return '<button type="button" data-sample-choice="'+esc(i.sku)+'" aria-pressed="false"><i class="dp-sample-chip" aria-hidden="true"'+(hex?' style="background-color:'+hex+'"':' data-unspecified')+'></i><span><strong>'+esc(i.name)+'</strong><small>'+esc([i.color,number(i.thicknessMm)+' مم'].filter(Boolean).join(' · '))+'</small></span></button>';
  }).join('')+'</div>';
  panel.innerHTML='<div class="finish-material-field"><strong>عينات المصنع</strong>'+samples+'<label class="dp-sku-pick">اختيار برمز الصنف<select data-finish-sku aria-label="عينة المصنع">'+skus.map(i=>option(i.sku,i.sku+' · '+i.name,current)).join('')+'</select></label><span data-finish-sample></span></div><button type="button" data-finish-confirm>'+studioIcon('check')+'تطبيق على '+esc(target)+'</button>';
  const sku=panel.querySelector('[data-finish-sku]'),sample=panel.querySelector('[data-finish-sample]');
  const cards=[...panel.querySelectorAll('[data-sample-choice]')];
  for(const card of cards)card.onclick=()=>{if(!editable())return;sku.value=card.dataset.sampleChoice;samplePreview(true);};
  function samplePreview(changed=false){
   if(changed&&(!editable()||opened!==revision))return;
   const i=skus.find(v=>v.sku===sku.value);if(!i)return;
   for(const card of cards)card.setAttribute('aria-pressed',String(card.dataset.sampleChoice===sku.value));
   const hex=catalogDisplayColor(i),spec=[i.color,number(i.thicknessMm)+' مم'].filter(Boolean).map(esc).join(' · ');
   sample.innerHTML=(hex?'<i class="finish-chip" style="background-color:'+hex+'" aria-hidden="true"></i>':'')+
    '<span><strong>'+esc(i.name)+'</strong><small><bdi>'+esc(i.sku)+'</bdi> · '+spec+'</small></span>';
   if(changed){previewChoice({scope,part:'front',sku:sku.value},opened);panel.querySelector('[data-finish-confirm]').disabled=!!error;}
  }
  const id=scope;sku.onchange=()=>samplePreview(true);samplePreview();panel.querySelector('[data-finish-confirm]').onclick=()=>{const value=sku.value;return write(()=>reviewFinishPreview(doc,catalog,{scope:id,part:'front',sku:value}).doc,'حُفظت خامة الواجهة في الرسم والحصر.',opened);};
 }
 function draw(){
  const opened=++revision;menus.close();const kinds=choices(scope);if(!component&&!kinds.includes(kind))kind=kinds[0];
  const isCorner=byCorner.has(scope),selected=byId.get(scope);
  if(isCorner)viewMode='volume';
  const hasDrawing=faces.length>0||isCorner;
  const shown=inspection?.feature||inspection?.unit;
  const shownLabel=inspection?.feature?(shown.kind==='vent'?'فتحة تهوية الشفاط':kitchenFeatureSpecs[shown.kind]?.label):
   shown?kitchenUnitSpecs[shown.kind]?.label:'';
  const faceLabel=faces.find(([id])=>id===face)?.[1]||'واجهة المشروع';
  const header='<header class="fs-header"><div><span>من القياس إلى الملمس</span><h2>استوديو التشطيب</h2></div><small>'+esc(catalog.name||'كتالوج المشروع')+' · '+(catalog.approved?'منشور من المصنع':'كتالوج أولي')+'</small></header><header class="finish-heading"><h3>'+studioIcon('swatches')+'تشطيب الوحدات</h3><div><button type="button" data-finish-undo aria-label="تراجع عن التشطيب">'+studioIcon('undo')+' تراجع</button><button type="button" data-finish-redo aria-label="إعادة التشطيب">'+studioIcon('redo')+' إعادة</button></div><button type="button" class="finish-next" data-ws-action="to-quote">الحصر والسعر '+studioIcon('arrow')+'</button></header>';
  const wallControl=faces.length>1?'<select aria-label="الواجهة المعروضة" data-finish-wall>'+faces.map(([id,title])=>option(id,title,face)).join('')+'</select>':'<strong>'+esc(faceLabel)+'</strong>';
  const board=hasDrawing?'<div class="finish-overview"><div class="finish-viewbar"><button type="button" data-finish-view="volume" aria-pressed="'+(viewMode==='volume')+'">'+studioIcon('cube')+' منظور</button><button type="button" data-finish-view="elevation" aria-pressed="'+(viewMode==='elevation')+'" '+(isCorner?'disabled':'')+'>'+studioIcon('elevation')+' واجهة</button>'+wallControl+'<button type="button" data-finish-fit aria-label="احتواء الرسم">'+studioIcon('fit')+'</button></div><div class="fs-canvas-wrap"><div data-finish-drawing></div><div class="fs-hud"><strong>'+esc(scope==='all'?'الوحدات المؤهلة':units.get(scope)?.code||'ركن')+' · '+esc(component?(finishSlot[component.part]==='front'?'جميع واجهات الوحدة':finishParts[finishSlot[component.part]]||partTitle()):categories[kind]||'التشطيب')+'</strong><span data-finish-status role="status" aria-live="polite"></span><small data-finish-impact></small><div><button type="button" data-finish-save>حفظ الاختيار</button><button type="button" data-finish-cancel>إلغاء المعاينة</button></div></div></div><p class="finish-instruction">المس الوحدة أو الجزء لاختيار خامته. عجلة الفأرة أو إصبعان للتقريب والتحريك.</p></div>':'';
  const objects='<nav class="fs-objects" aria-label="وحدات التشطيب"><strong>الوحدات</strong><button type="button" data-finish-object="all" aria-pressed="'+(scope==='all')+'"><strong>الكل</strong><small>الوحدات المؤهلة</small></button>'+targets.map(m=>'<button type="button" data-finish-object="'+esc(m.id)+'" aria-pressed="'+(scope===m.id)+'"><strong>'+esc(units.get(m.id).code)+'</strong><small>'+esc(m.use||family(m).label)+'</small></button>').join('')+corners.map(c=>'<button type="button" data-finish-object="'+esc(c.id)+'" aria-pressed="'+(scope===c.id)+'"><strong>ركن</strong><small>'+esc(c.recipe.label)+'</small></button>').join('')+'</nav>';
  host.innerHTML='<section class="ws-card finish-desk finish-studio">'+header+'<div class="finish-workspace">'+objects+board+
   '<div class="finish-options"><label>نطاق التطبيق<select data-finish-scope>'+(shown?'<option selected disabled>'+esc(shownLabel)+'</option>':'')+option('all','المطبخ · الوحدات المؤهلة',shown?null:scope)+targets.map(m=>option(m.id,label(m),shown?null:scope)).join('')+corners.map(c=>option(c.id,'ركن · '+c.recipe.label+' · '+c.id,shown?null:scope)).join('')+'</select></label>'+
   (!shown&&!component&&kind?'<div class="finish-kinds" role="group" aria-label="نوع التشطيب">'+kinds.map(k=>'<button type="button" data-finish-kind="'+k+'" aria-label="'+categories[k]+'" title="'+categories[k]+'" aria-pressed="'+(k===kind)+'">'+studioIcon(categoryGlyphs[k])+'<span>'+categoryNames[k]+'</span></button>').join('')+'</div>':'')+
   (component?'<div class="finish-part-title"><b>'+esc(partTitle())+' · '+esc(units.get(scope)?.code||'')+'</b>'+(component.part==='drawer'&&onInspectPart?'<button type="button" data-finish-drawer-use>استخدام هذا الدرج</button>':'')+'<button type="button" class="finish-all" data-finish-unit aria-label="كل خيارات الوحدة" title="كل خيارات الوحدة">'+studioIcon('grid')+'</button></div>':'')+
   '<p class="fs-catalog-note">كل لون أو موديل صنف من كتالوج المشروع. يطبّق الاختيار على نوع الجزء في الوحدة كاملة.</p><div data-finish-editor></div><aside class="fs-price" data-finish-price aria-live="polite"></aside></div></div></section>';
  paint();updateTools();
  const svg=getSvg();svg?.setAttribute?.('tabindex','0');
  for(const el of host.querySelectorAll('[data-sheet-unit]')){
   const id=el.getAttribute('data-sheet-unit');
   if(id===(shown?inspection.unit?.id:scope)&&(!component||el.getAttribute('data-sheet-part')===component.part&&(!component.index||Number(el.getAttribute('data-sheet-index'))===component.index)))el.classList.add('finish-picked');
   else if(targetIds.has(id))el.classList.add('finish-pickable');
  }
  const editor=host.querySelector('[data-finish-editor]');
  if(shown){
   const heading='<h4>'+esc(shownLabel)+'</h4>';
   if(inspection.feature){
    for(const el of host.querySelectorAll('[data-sheet-feature]'))if(el.getAttribute('data-sheet-feature')===shown.id)el.classList.add('finish-picked');
    editor.innerHTML=heading+sheetFeatureReadout(doc.room,shown)+(onSurvey?'<button type="button" data-finish-survey>تحرير قياسات العنصر</button>':'');
   }else editor.innerHTML=heading+'<p>عرض الوحدة '+number(shown.width*10)+' مم. لا تتوفر لهذه الوحدة خيارات تشطيب في كتالوج المشروع.</p>';
   return;
  }
  if(component&&!slotChoice()){
   editor.innerHTML='<p>لم ينشر المصنع بديلًا لهذا الجزء من الوحدة.</p>';
   return;
  }
  if(!kind){editor.textContent='اختر وحدة لها بدائل تشطيب منشورة في كتالوج المصنع.';return;}
  if(kind==='front'){frontEditor(editor,opened);return;}
  const editorDoc=preview?.doc||doc;
  if(kind==='corner'){mountCornerFinish(editor,{doc:editorDoc,catalog,targetId:scope,canEdit:()=>editable()&&opened===revision,onPreview:(id,sku)=>previewChoice({scope:id,part:'corner',sku},opened),onApply:next=>write(()=>next,'حُفظت واجهة الركن المحدد.',opened)});return;}
  const resetPart=()=>{clearPreview();paint();updateTools();};
  if(kind==='mechanisms'&&selected){mountFinishHardware(editor,{doc:editorDoc,catalog,unitId:scope,canEdit:()=>editable()&&opened===revision,onPartChange:resetPart,onPreview:(id,group,sku)=>previewChoice({scope:id,part:'mechanisms',group,sku},opened),onPick:(id,group,sku)=>write(()=>reviewFinishPreview(doc,catalog,{scope:id,part:'mechanisms',group,sku}).doc,'حُدّث عتاد الوحدة.',opened)});return;}
  mountClientParts(editor,{doc:editorDoc,catalog,target:scope,parts:component?[slotChoice()]:parts[kind]||Object.keys(finishParts),canEdit:()=>editable()&&opened===revision,onPartChange:resetPart,onPreview:(id,part,sku)=>previewChoice({scope:id,part,sku},opened),onApply:(id,part,sku)=>write(()=>reviewFinishPreview(doc,catalog,{scope:id,part,sku}).doc,'حُفظ اختيار '+finishParts[part]+'.',opened)});
 }
 function click(e){
  if(dead||pending||getDoc()!==doc)return;
  if(e.target.closest?.('[data-finish-save]')){if(preview&&!error)return write(()=>reviewFinishPreview(doc,catalog,preview.command).doc,'حُفظ التشطيب في المشروع والحصر.',revision);return;}
  if(e.target.closest?.('[data-finish-cancel]')){cancel();return;}
  if(e.target.closest?.('[data-finish-undo]')){history(false);return;}
  if(e.target.closest?.('[data-finish-redo]')){history(true);return;}
  if(e.target.closest?.('[data-finish-fit]')){viewport.reset();return;}
  const object=e.target.closest?.('[data-finish-object]');if(object){select(object.getAttribute('data-finish-object'));return;}
  const mode=e.target.closest?.('[data-finish-view]');if(mode&&!mode.disabled){viewMode=mode.getAttribute('data-finish-view');paint();for(const b of host.querySelectorAll('[data-finish-view]'))b.setAttribute('aria-pressed',String(b.getAttribute('data-finish-view')===viewMode));return;}
  if(e.target.closest?.('[data-finish-drawer-use]')&&component?.part==='drawer'){onInspectPart?.('unit-part',{unitId:scope,part:'drawer',index:component.index});return;}
  if(e.target.closest?.('[data-finish-unit]')){select(scope);return;}
  if(e.target.closest?.('[data-finish-drawing]')){
   let selected=sheetTarget(e.target,doc,face);
   if(viewMode==='volume'&&pick&&Number.isFinite(e.clientX+e.clientY)){
    const svg=getSvg(),matrix=svg?.getScreenCTM?.();
    if(matrix){
     const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(matrix.inverse()),hit=pick(p.x,p.y);
     selected=partTarget?.(hit)||selected;
     if(hit?.part==='module'&&targetIds.has(hit.id)){
      const slot={side:'body',floor:'body',top:'body',back:'back','interior-divider':'divider','front-rail':'edge'}[hit.tag];
      if(slot)selected={route:'unit-part',focus:{unitId:hit.id,part:slot,...(hit.index?{index:hit.index}:{})}};
      else if(!selected)selected={route:'unit',focus:{unitId:hit.id}};
     }
     if(selected?.route==='corner'){const id='corner:'+selected.focus.joint+':'+selected.focus.tier;if(byCorner.has(id)){select(id);return;}}
    }
   }
   if(selected?.route==='unit-part'){
    const {unitId,part,index}=selected.focus;
    if(part!=='leg'&&targetIds.has(unitId)&&partNames[part]){select(unitId,null,{part,index});return;}
    if(onInspectPart){onInspectPart(selected.route,selected.focus);return;}
   }else if(selected?.route==='unit'&&targetIds.has(selected.focus?.unitId)){select(selected.focus.unitId);return;}
   else if(selected&&!['unit','survey'].includes(selected.route)&&onInspectPart){onInspectPart(selected.route,selected.focus);return;}
   else if(selected?.route==='survey'&&!selected.focus.featureId&&onInspectPart){onInspectPart(selected.route,selected.focus);return;}
  }
  if(e.target.closest?.('[data-finish-survey]')){if(inspection?.feature)onSurvey?.(inspection.feature);return;}
  const category=e.target.closest?.('[data-finish-kind]'),hit=e.target.closest?.('[data-sheet-unit]')||e.target.closest?.('[data-dim-unit]'),wallItem=e.target.closest?.('[data-sheet-feature]');
  if(category){select(scope,category.getAttribute('data-finish-kind'));host.querySelector('[data-finish-kind][aria-pressed="true"]')?.focus?.({preventScroll:true});}
  else if(hit||wallItem){
   const id=hit?.getAttribute('data-sheet-unit')||hit?.getAttribute('data-dim-unit'),featureId=wallItem?.getAttribute('data-sheet-feature');
   if(targetIds.has(id))select(id);
   else{
    const unit=units.get(id),feature=featureId&&doc.kitchen.features.find(f=>f.id===featureId);
    if(!unit&&!feature)return;
    clearPreview('أُلغيت المعاينة غير المحفوظة عند تغيير العنصر.');
    component=null;inspection={unit,feature};draw();
   }
   getSvg()?.focus?.({preventScroll:true});
  }
 }
 function change(e){
  if(!editable())return;
  if(e.target.matches?.('[data-finish-scope]')){select(e.target.value);host.querySelector('[data-finish-scope]')?.focus?.({preventScroll:true});}
  if(e.target.matches?.('[data-finish-wall]')&&faces.some(([id])=>id===e.target.value)){
   clearPreview('أُلغيت المعاينة غير المحفوظة عند تغيير الجدار.');
   inspection=null;component=null;face=e.target.value;
   if(scope!=='all'&&faceOf(scope)!==face)scope=targets.find(m=>faceOf(m.id)===face).id;
   draw();host.querySelector('[data-finish-wall]')?.focus?.({preventScroll:true});
  }
 }
 function key(e){
  if(e.key==='Escape'&&(preview||error)){e.preventDefault?.();e.stopPropagation?.();cancel();return;}
  if(e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key?.toLowerCase()==='z'){e.preventDefault?.();history(!!e.shiftKey);}
 }
 host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('keydown',key);draw();
 return {commandContext:snapshot,hasPending:()=>!!preview||pending,tracksDraft:target=>!!target.closest?.('.finish-studio'),discard:()=>{clearPreview();},destroy(){dead=true;menus.destroy();viewport.destroy();host.removeEventListener('click',click);host.removeEventListener('change',change);host.removeEventListener('keydown',key);}};
}
