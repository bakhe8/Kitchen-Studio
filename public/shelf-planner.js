import {ownKey} from './kitchen-safe-keys.js';
import {unitContext} from './shelf-unit-state.js';
import {getRoom,roomWallSize,attachCabinet,updateRoom} from './shelf-room-model.js';
import {mountRoomView} from './shelf-room-view.js';
import {evaluateShelfDepth} from './shelf-model.js';
import {renderShelfVolume} from './shelf-volume.js';
import {mountWorkspaceView} from './shelf-view.js';
import {shelfDepth,shelfDepthLimits,setShelfDepth} from './shelf-model.js';
import {mountComparison} from './shelf-compare.js';
import {placeSizedScreen,resizeSizedScreen,removeSizedScreen,inspectSizedScreen,mountSizedScreenPanel} from './shelf-sized-object.js';
import {equalDistribution} from './shelf-layout-tools.js';
import {createShelfPlan,validatePlan,updateWall,evaluateWall,updateCab,evaluateCab,drawCab,evaluateDraw,moveCab,resizeCab,cabMinimum,setFinish,setWallColor,applyPreset,SHELF_LIMITS as limits} from './shelf-model.js';
import {scopedCells,scopedDividers,dividerReach,wallZones,targetInfo,moveScopedDivider,targetParent,contentFor,selectedTarget,selectTarget,planContentDrop,commitContentDrop} from './shelf-selection-model.js';
import {mountPaletteDrag} from './shelf-palette-drag.js';
import {collisionDescription} from './shelf-delete-target.js';
import {checkRemovalAt,removalAt} from './shelf-point-model.js';
import {inspectPlacement,applyPlacement} from './shelf-place.js';
import {currentLeafKeys,bulkSetContent} from './shelf-marquee.js';
import {sharedSelectionReach} from './shelf-shared-selection.js';
import {groupInfo,transformGroup,reframeGroup} from './shelf-group-transform.js';
import {groupFinish,effectiveFinish} from './shelf-group-finish.js';
import {groupPreset} from './shelf-group-preset.js';
import {groupPlacement} from './shelf-group-insert.js';
import {mountShelfCanvas} from './shelf-canvas.js';

const $=id=>document.getElementById(id), all=q=>Array.from(document.querySelectorAll(q));
const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
const f=n=>nf.format(n), round=n=>Math.round(n*10)/10;
const planKey='atlas-shelves:plan:v1',photoKey='atlas-shelves:wall-image:v1';
function loadPlan(){try{const raw=localStorage.getItem(planKey);return raw?validatePlan(JSON.parse(raw)):null;}catch{return null;}}
const wallIds=['back','front','left','right'],faceLabel={back:'الجدار الخلفي',front:'الجدار الأمامي',left:'الجدار الأيسر',right:'الجدار الأيمن'};
const wallPhotoKey=id=>id==='back'?photoKey:photoKey+':'+id;
function cachedPhoto(id){try{const v=localStorage.getItem(wallPhotoKey(id));return v&&v.length<3500000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(v)?v:null;}catch{return null;}}
const saved=unitContext?.plan||loadPlan(),storedPhotos=Object.fromEntries(wallIds.map(id=>[id,unitContext?null:cachedPhoto(id)]));
let roomPhotos={...storedPhotos};
let plan=saved||createShelfPlan(),photoUrl=roomPhotos[getRoom(plan).attachedWall],selected=plan.selectedCell||'0:0',tool='point-insert',preview=false,showDims=true,ruler=null;
let target=(saved&&selectedTarget(plan))||{kind:'cabinet'};
const scopeFamily=t=>t.kind==='zone'?'wall':t.kind;
if(target.kind==='cell')selected=target.key;
let palette=null,dragSession=null,pendingContent=null;
let multiKeys=[],noSelection=false;
let snapEnabled=true;try{snapEnabled=localStorage.getItem('atlas-shelves:snap')!=='off';}catch{}
let placeAxis='row',selectedDividerId=null,selectedDividerTitle='';
let lastProperty=unitContext?'appearance':'dimensions',inspector=null,inspectorTrigger=null,dimensionScope='cabinet',dockFolded=matchMedia('(max-width:640px)').matches;
let history=[],pendingMerge=null,photoJob=0,persisted=true;
const labels={empty:'فارغة',books:'كتب',boxes:'صناديق تخزين',plant:'نبتة',vase:'مزهرية',oak:'بلوط',walnut:'جوز',ivory:'عاجي',sand:'رملي',sage:'مريمي',stone:'حجري'};
const pane=$('shelf-scene');
const workspace=mountWorkspaceView({onModeChange:isRoom=>{preview=false;inspector=null;pendingMerge=null;pendingContent=null;warn('');if(isRoom)dimensionScope='room';paint({forms:true});},beforeChange:()=>{palette?.cancel();canvas.cancelGesture?.();canvas.alignPlacement(null);canvas.setDropPreview(null);},onChange:()=>{comparison.refresh(preview);renderScene();},announce:say});
const canvas=mountShelfCanvas(pane,{getState:()=>({plan,tool,preview,selected,target,photoUrl,showDims,ruler,selectedDividerId,multiKeys,noSelection,placeAxis,snapEnabled,view3d:workspace.volume,camera:workspace.camera,placingContent:!!pendingContent,maxCabDepth:Math.min(shelfDepthLimits.max,roomWallSize(plan,getRoom(plan).attachedWall).depth)}),onAction:handleCanvas});
const comparison=mountComparison({getPlan:()=>plan,getPhoto:()=>photoUrl,getView:()=>({volume:workspace.volume,camera:workspace.camera}),onEdit:()=>setMode('design'),say});
const roomView=mountRoomView($('shelf-room-host'),{getPlan:()=>plan,getPhoto:()=>photoUrl,getPhotos:()=>roomPhotos,getPhotoOrigin:()=>getRoom(plan).attachedWall,
 onAttach:wallId=>{
   const r=attachCabinet(plan,wallId);if(!r.ok){warn(r.reason);say(r.reason);return r;}
   if(r.changed){const msg='نُقل الدولاب بتقسيمه ومحتوياته إلى '+faceLabel[wallId]+'.'+(r.clamped?' عُدّل موضعه ليتّسع على الجدار.':'');
    commit(r.plan,msg,{target:{kind:'cabinet'},keepMulti:false});}return r;
 },
 onEdit:()=>{workspace.showDetail();say('تحرير الدولاب على '+faceLabel[getRoom(plan).attachedWall]+'.');},
 onDimensions:()=>{openInspector('dimensions',$('shelf-properties-toggle'));dimensionScope='room';paint({forms:true});$('shelf-room-w').focus({preventScroll:true});}
});
let copyPanel=null,copyLoading=false;
function refreshCopies(){
  if(copyPanel){copyPanel.refresh();return;}if(copyLoading)return;copyLoading=true;
  import('./shelf-copy-layout.js').then(({mountCopyLayout})=>{copyPanel=mountCopyLayout($('shelf-copy-layout'),{getPlan:()=>plan,onCommit:r=>{
  if(preview||inspector!=='presets'||!r?.ok||!r.changed)return;
  commit(r.plan,'نُسخ التقسيم. النسخة مستقلة عن الأصل ويمكن التراجع بخطوة واحدة.',{target:r.target,keepMulti:false,tool:'select'});
}});copyPanel.refresh();}).catch(()=>{warn('تعذّر تحميل أداة النسخ. أعد فتح النماذج للمحاولة مجددًا.');}).finally(()=>{copyLoading=false;});
}
function applyScreen(t,size){
  if(preview)return;
  if(!t){armTool('select');releaseSelection(true);pendingContent={kind:'sized-screen',size};paint();say('انقر في الخانة التي تريد وضع الشاشة فيها.');return;}
  const r=placeSizedScreen(plan,t,size);if(!r.ok){warn(r.reason);return;}
  pendingContent=null;const summary=inspectSizedScreen(r.plan)?.summary||'';
  commit(r.plan,'وُضعت الشاشة بمقاسها الفعلي. '+summary,{target:t,tool:'select',keepMulti:false});
}
const screenPanel=mountSizedScreenPanel($('shelf-sized-screen-panel'),{onApply:applyScreen,onResize:size=>{
  if(preview)return;const r=resizeSizedScreen(plan,size);if(!r.ok){warn(r.reason);return;}commit(r.plan,'مقاس الشاشة الفعلي: '+f(size.w)+' × '+f(size.h)+' سم. '+(inspectSizedScreen(r.plan)?.summary||''));
},onRemove:()=>{if(!preview)commit(removeSizedScreen(plan).plan,'أُزيلت الشاشة وبقي تقسيم الدولاب.');}});
function say(s){$('shelf-status').textContent=s;}
function warn(s){const e=$('shelf-bounds');e.textContent=s||'';e.hidden=!s;}
const hintText={
 select:'انقر لتحديد خانة، أو اضغط بالأيسر في الفراغ واسحب عبر الخانات. السحب من لوح أو قطعة يحرّكها.',
 draw:'ارسم مستطيل الدولاب من زاويتين متقابلتين. يُعتمد الشكل عند الإفلات.',
 move:'اسحب جسم الدولاب لنقله، أو أمسك الفاصل أو قطعة المحتوى نفسها لتحريكها.',
 delete:'انقر على رف أو فاصل أو قطعة ظاهرة أو شاشة لحذفها. الفراغ والإطار لا يُحذفان.',
 resize:'اسحب مقبضًا عند إحدى زوايا الدولاب لتعديل أبعاده. تبقى الزاوية المقابلة ثابتة.',
 'point-insert':'انقر لإدراج فاصل. اقترب من رف مجاور لمحاذاته، أو اسحب مقبض «توزيع» داخل الخانة لفتحات متساوية. الزر الأيمن يبدّل الاتجاه.',
 measure:'اسحب المسطرة بين نقطتين على الجدار. القراءة بالسنتيمتر ولا تغيّر التصميم أو التحديد.'
};
const toolNames={'point-insert':'إدراج بالنقر',select:'التحديد',draw:'رسم الدولاب',move:'تحريك الدولاب',resize:'تغيير الحجم',delete:'الحذف',measure:'المسطرة'};
const showText=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
const toolKeys=new Set(Object.keys(hintText));
const groupHints={
  select:'اسحب مقبض الفاصل المشترك لتعديل موقعه. لاستبدال التحديد، اسحب من الفراغ.',
  move:'اسحب الفاصل بين خانتين محددتين أو مقبضه لتحريك اللوح وحده. اسحب من داخل خانة لتحريك المجموعة كلها.',
  resize:'اسحب إحدى زوايا إطار المجموعة لتغيير مقاسها مع تثبيت الزاوية المقابلة. إذا لامست المجموعة إطار الدولاب فقد تتحرّك حافته معها.',
  'point-insert':'النقر يضع فاصلًا عند النسبة نفسها في كل خانة محددة. اسحب مقبض «توزيع» لتقسيم كل فتحة بالتساوي. الزر الأيمن يبدّل الاتجاه.',
  measure:'تظهر أبعاد المجموعة كاملة. ويمكنك سحب المسطرة بين نقطتين لقراءة مسافة أخرى.',
  delete:'الحذف يستهدف العنصر الذي تنقر عليه وحده. لإفراغ الخانات المحددة دفعة واحدة، افتح «وضع محتوى».',
  draw:'ارسم المستطيل الذي تريد أن تشغله المجموعة؛ ستعاين موضعها ومقاسها معًا. لن يُعتمد مستطيل يتجاوز القيود.'
};
const hasGroup=()=>multiKeys.length>=2;
const groupToolNames={select:'تحديد المجموعة',move:'تحريك المجموعة أو فاصلها',resize:'تحجيم المجموعة',draw:'رسم المجموعة',delete:'حذف عنصر واحد',measure:'قياس المجموعة','point-insert':'إدراج في المجموعة'};
const hintFor=key=>(hasGroup()&&groupHints[key])||hintText[key];
let lastCell=selected,selectorSignatures=new Map();
function eqTarget(a,b){return !!a&&!!b&&a.kind===b.kind&&(a.key??'')===(b.key??'');}
function rememberSelection(t,persist=false){
  const wanted=t&&targetInfo(plan,t)?t:{kind:'cabinet'};
  target=wanted;
  if(wanted.kind==='cell'){selected=wanted.key;lastCell=wanted.key;}
  else {const r=scopedCells(plan);if(!r.some(c=>c.key===lastCell))lastCell=r[0]?.key||'0:0';selected=lastCell;}
  plan=selectTarget(plan,wanted)||plan;
  if(persist)saveLocal(false);
}
function releaseSelection(empty=false){multiKeys=[];noSelection=empty;}
function acceptMarquee(keys){
  canvas.setDropPreview(null);pendingContent=null;pendingMerge=null;selectedDividerId=null;selectedDividerTitle='';warn('');
  const picked=currentLeafKeys(plan,keys);
  if(picked.length===1){switchTo({kind:'cell',key:picked[0]});return;}
  multiKeys=picked;noSelection=!picked.length;paint();
  say(picked.length?'الخانات المحددة: '+f(picked.length)+'. اختر «تحريك» أو «تغيير الحجم» أو أداة أخرى للعمل عليها.':'لم يشمل التحديد أي خانة.');
}
function switchTo(t,{keepTool=false,announce=true}={}){
  if(!t||!targetInfo(plan,t))return;
  releaseSelection();canvas.setDropPreview(null);selectedDividerId=null;selectedDividerTitle='';
  if(!keepTool&&tool!=='point-insert')tool='select';pendingMerge=null;warn('');rememberSelection(t,true);paint();
  if(announce)say('التحديد: '+targetInfo(plan,target).label+'.');
}
function cellTarget(){
  if(target.kind==='cell'&&targetInfo(plan,target))return target;
  const key=targetInfo(plan,{kind:'cell',key:lastCell})?lastCell:scopedCells(plan)[0].key;
  return {kind:'cell',key};
}
function pickerChoices(el,values,current){
  const sig=values.map(p=>p[0]+'='+p[1]).join('|');
  if(selectorSignatures.get(el.id)!==sig){el.replaceChildren(...values.map(p=>new Option(p[1],p[0])));selectorSignatures.set(el.id,sig);}
  el.value=current;
}
function fitInfo(t){const i=targetInfo(plan,t);return i?(i.rect||i):null;}
function valuesForForms(){const b=plan.cab,w=plan.wall,r=getRoom(plan);for(const [id,v] of Object.entries({'shelf-room-w':r.width,'shelf-room-l':r.length,'shelf-room-h':r.height,'shelf-wall-w':w.w,'shelf-wall-h':w.h,'shelf-cabinet-w':b.w,'shelf-cabinet-h':b.h,'shelf-cabinet-depth':shelfDepth(plan),'shelf-cabinet-x':b.x,'shelf-cabinet-bottom':Math.max(0,w.h-b.y-b.h)}))$(id).value=String(round(v));}
function active(q,val,attr='aria-pressed'){for(const el of all('button[data-'+q+']'))el.setAttribute(attr,String(el.getAttribute('data-'+q)===val));}
function renderScene(){
  const exp=$('shelf-export');const label=workspace.room?'تصدير الغرفة SVG':workspace.volume?'تصدير المنظور SVG':'تصدير الواجهة SVG';
  exp.querySelector('.sp-file-label-text').textContent=label;exp.title=label;
  roomView.refresh(workspace.room);
  if(workspace.room){pane.hidden=true;return;}
  if($('shelf-compare-stage').hidden)pane.hidden=false;
  canvas.render();
}
const isProperty=k=>['dimensions','appearance','presets'].includes(k);
const inspectorNames={select:'التحديد والنطاق',measure:'القياس',content:'محتوى الخانات',appearance:'مظهر الجدار والدولاب',dimensions:'المقاسات',presets:'النماذج ونسخ التقسيم'};
$('shelf-snap-toggle').checked=snapEnabled;
$('shelf-snap-toggle').addEventListener('change',e=>{snapEnabled=e.target.checked;try{localStorage.setItem('atlas-shelves:snap',snapEnabled?'on':'off');}catch{}canvas.alignPlacement(null);canvas.setDropPreview(null);renderScene();say(snapEnabled?'فُعّلت محاذاة الفواصل عند الاقتراب.':'الحركة حرة؛ لن ينجذب الفاصل أثناء الإدراج أو التحريك.');});
function drawDock(){
  const dock=$('shelf-dock'),grid=$('shelf-dock-grid'),fold=$('shelf-dock-fold'),panel=$('shelf-inspector');
  dock.dataset.folded=String(dockFolded);document.body.dataset.dockFolded=String(dockFolded);
  grid.hidden=dockFolded;fold.setAttribute('aria-expanded',String(!dockFolded));
  const foldText=dockFolded?'فتح الأدوات':'طي الأدوات';fold.title=foldText;fold.setAttribute('aria-label',foldText);showText('shelf-dock-fold-label',foldText);
  for(const b of dock.querySelectorAll('button[data-tool],button[data-inspector],#shelf-axis-switch'))b.disabled=preview;
  const props=$('shelf-properties-toggle'),tabs=$('shelf-property-tabs'),activeProp=!preview&&isProperty(inspector);
  props.disabled=preview;props.setAttribute('aria-expanded',String(activeProp));
  tabs.hidden=!activeProp;
  for(const b of tabs.querySelectorAll('[data-inspector]')){
    const chosen=activeProp&&b.dataset.inspector===inspector;
    b.setAttribute('aria-pressed',String(chosen));
    if(b.getAttribute('role')==='tab'){b.setAttribute('aria-selected',String(chosen));b.tabIndex=chosen?0:-1;}
    b.setAttribute('aria-expanded',String(chosen));
  }
  const axis=$('shelf-axis-switch');axis.disabled=preview||tool!=='point-insert';axis.hidden=axis.disabled;
  const mode=$('shelf-preview-toggle');mode.setAttribute('aria-pressed',String(preview));showText('shelf-preview-label',preview?'عودة للتصميم':workspace.room?'معاينة الدولاب':'معاينة');
  mode.setAttribute('aria-label',preview?'العودة إلى التصميم':'معاينة التصميم');
  panel.hidden=!inspector||preview;document.body.dataset.inspector=panel.hidden?'':inspector;
  if(inspector)showText('shelf-inspector-title',workspace.room?'مقاسات الغرفة':inspectorNames[inspector]);
  for(const node of all('[data-inspector-panel]'))node.hidden=node.dataset.inspectorPanel!==inspector||preview;
  for(const b of dock.querySelectorAll('[data-inspector],[data-tool="select"],[data-tool="measure"]'))b.setAttribute('aria-expanded',String(!panel.hidden&&inspector===(b.dataset.inspector||b.dataset.tool)));
}
function dismissInspector(restore=false){
  inspector=null;drawDock();if(restore){const b=inspectorTrigger===$('shelf-properties-toggle')?inspectorTrigger:dockFolded?$('shelf-dock-fold'):inspectorTrigger;if(b&&!b.disabled)b.focus({preventScroll:true});}inspectorTrigger=null;
}
function openInspector(key,trigger){
  if(!inspectorNames[key]||preview)return;
  const property=isProperty(key),repeated=inspector===key;
  if(property){
    // Properties are an inspector, not a pointer mode. Opening a tab must
    // not change the current tool, target, selected divider or group.
    if(repeated)return;
    palette?.cancel();canvas.cancelGesture?.();canvas.setDropPreview(null);
  }else{
    stopDirect();canvas.cancelGesture?.();
    if(repeated){dismissInspector(true);paint();return;}
  }
  pendingMerge=null;warn('');inspector=key;inspectorTrigger=property?$('shelf-properties-toggle'):trigger;
  if(property)lastProperty=key;
  if(key==='dimensions')dimensionScope=workspace.room?'room':hasGroup()?'group':['wall','zone'].includes(target.kind)?'wall':'cabinet';
  if(!property)tool=key==='measure'?'measure':'select';
  paint({forms:key==='dimensions'});
  if(key==='select'||key==='measure')say(hintFor(tool));
}
function paint({forms=false}={}){
  workspace.refresh();const space=getRoom(plan);
  showText('sp-stage-title',unitContext?'التقسيم الداخلي للوحدة':workspace.room?'الغرفة كاملة':plan.room?faceLabel[space.attachedWall]+' والدولاب':'الجدار والدولاب');
  $('shelf-view-depth').textContent=workspace.room?[space.width,space.length,space.height].map(f).join(' × ')+' سم':'عمق الدولاب '+f(shelfDepth(plan))+' سم';
  $('shelf-view-depth').title=workspace.room?'عرض الغرفة × طولها × ارتفاعها':'المسافة من الجدار إلى واجهة الدولاب';
  document.body.dataset.plannerMode=preview?'preview':'design';
  drawDock();active('tool',preview?null:tool);
  const grouped=multiKeys.length>=2,hasSingle=!grouped&&!noSelection;
  $('shelf-group-summary').hidden=preview||!grouped;
  const envelope=grouped?groupInfo(plan,multiKeys).bounds:null;
  if(!grouped&&dimensionScope==='group')dimensionScope='cabinet';
  const groupOption=$('shelf-dimension-target').querySelector('option[value="group"]');if(groupOption){groupOption.hidden=!grouped;groupOption.disabled=!grouped;}
  const groupText=grouped?'الخانات المحددة: '+f(multiKeys.length):'';
  const drawTile=document.querySelector('#shelf-dock-grid [data-tool="draw"]');
  drawTile.querySelector('.sp-dock-label').textContent=grouped?'رسم المجموعة':'رسم الدولاب';
  drawTile.title=grouped?'ارسم حدودًا جديدة للمجموعة المحددة':'رسم مساحة الدولاب على الجدار';
  const finishLabel=document.querySelector('#shelf-panel-appearance [data-finish]')?.closest('.sp-inspector-section')?.querySelector('h3');
  if(finishLabel){const caption=grouped?'تشطيب داخل الخانات المحدّدة':'خامة الدولاب';finishLabel.textContent=caption;finishLabel.nextElementSibling?.setAttribute('aria-label',caption);}
  showText('shelf-preset-note',grouped?'يُطبَّق النموذج داخل كل خانة محدّدة على حدة. «فارغ» يُفرغ محتواها.':'تطبيق النموذج يستبدل تقسيم الدولاب ومحتوياته. يمكنك التراجع.');
  if($('shelf-group-readout').textContent!==groupText)showText('shelf-group-readout',groupText);
  active('scope-pick',hasSingle?scopeFamily(target):null);document.body.dataset.activeTool=tool;
  for(const el of all('[data-form-for]'))el.hidden=el.dataset.formFor!==dimensionScope;
  showText('shelf-active-tool',grouped?(groupToolNames[tool]||toolNames[tool]):'المؤشر: '+toolNames[tool]);
  document.body.dataset.placeAxis=placeAxis;
  $('shelf-dimension-target').value=dimensionScope;
  document.querySelector('#shelf-dock [data-tool="point-insert"]').dataset.dragDivider=placeAxis;
  $('shelf-axis-switch').dataset.axis=placeAxis;
  showText('shelf-axis-text',placeAxis==='row'?'أفقي':'عمودي');
  $('shelf-axis-switch').setAttribute('aria-label','تبديل اتجاه الفاصل؛ الاتجاه الحالي '+(placeAxis==='row'?'أفقي':'عمودي'));
  const part=$('shelf-picked-part');part.hidden=!selectedDividerId;part.textContent=selectedDividerId?'المحدد: '+selectedDividerTitle:'';

  const shownFinishes=grouped?new Set(multiKeys.map(k=>effectiveFinish(plan,k))):null;
  active('finish',grouped?(shownFinishes.size===1?[...shownFinishes][0]:''):plan.finish);active('wall-color',plan.wallColor);
  const cells=scopedCells(plan),zones=wallZones(plan),info=targetInfo(plan,target),bound=envelope||fitInfo(target);
  const wscope=target.kind==='wall'||target.kind==='zone',isCell=target.kind==='cell';
  const leaf=hasSingle&&isCell?cells.find(c=>c.key===target.key):null;
  const host=$('shelf-scope-label');host.textContent=grouped?groupText:noSelection?'لا توجد خانات محدّدة':info.label;
  host.dataset.scope=grouped?'group':noSelection?'none':target.kind;host.dataset.key=hasSingle?(target.key||''):'';
  const dimensionText=f(bound.w)+' × '+f(bound.h)+' سم';
  showText('shelf-measure-target',grouped?'حدود المجموعة · '+groupText:info.label);showText('shelf-measure-readout',dimensionText);$('shelf-measure-readout').setAttribute('aria-label','العرض '+f(bound.w)+' سم، الارتفاع '+f(bound.h)+' سم');
  showText('shelf-measure-left',f(Math.max(0,bound.x))+' سم');showText('shelf-measure-bottom',f(Math.max(0,plan.wall.h-bound.y-bound.h))+' سم');
  showText('shelf-ruler-distance',ruler?f(Math.hypot(ruler.b.x-ruler.a.x,ruler.b.y-ruler.a.y))+' سم':'لا توجد قراءة');
  if($('shelf-ruler-clear'))$('shelf-ruler-clear').disabled=!ruler;

  showText('shelf-scope-note',target.kind==='cell'?(leaf?'هذه الخانة هي موضع العمل الحالي.':'هذه الخانة تحتوي على خانات فرعية.'):(target.kind==='zone'?'منطقة تخطيط داخل الجدار.':target.kind==='wall'?'مساحة الجدار كاملة.':'الحدود الخارجية للدولاب.'));
  const edgeHint=isCell?'اسحب رفًّا أو فاصلًا من الحافة المشتركة أو من مقبضه. يتحرك اللوح كاملًا؛ لتغيير حدود الدولاب الخارجية استخدم «تغيير الحجم».':target.kind==='zone'?'اسحب الجزء الظاهر من حدّ المنطقة المشترك أو مقبضه. يبقى محيط الجدار ثابتًا.':'';
  if(!hasSingle)showText('shelf-scope-note',grouped?'اسحب مرة أخرى لاستبدال المجموعة، أو انقر على خانة لاختيارها وحدها.':'انقر على خانة أو اسحب في الفراغ لاختيار مجموعة.');
  else if(edgeHint)showText('shelf-scope-note',edgeHint);
  $('shelf-grid-summary').textContent=wscope?'مناطق الجدار: '+f(Math.max(1,zones.length)):'خانات الدولاب: '+f(cells.length);
  const parent=targetParent(plan,target);
  $('shelf-scope-parent').hidden=!hasSingle||!parent;
  if(parent){$('shelf-scope-parent').textContent='تحديد الحيّز الأعلى: '+(targetInfo(plan,parent)?.label||'');}
  $('shelf-cell-field').hidden=!hasSingle||!isCell;$('shelf-region-field').hidden=!hasSingle||!wscope||zones.length<2;
  if(hasSingle&&isCell){
    const v=cells.map(c=>[c.key,c.label||targetInfo(plan,{kind:'cell',key:c.key}).label]);
    if(!leaf)v.unshift([target.key,info.label+' · حيّز مقسّم']);
    pickerChoices($('shelf-cell-picker'),v,target.key);
  }
  if(hasSingle&&wscope){
    const v=[['wall','الجدار كله'],...zones.filter(z=>z.key!=='wall').map(z=>[z.key,z.label||targetInfo(plan,{kind:'zone',key:z.key}).label])];
    if(target.kind==='zone'&&!v.some(z=>z[0]===target.key))v.push([target.key,info.label+' · حيّز مقسّم']);
    pickerChoices($('shelf-region-picker'),v,target.key||'wall');
  }
  const emptySelected=$('shelf-empty-selected'),occupied=grouped?cells.filter(c=>multiKeys.includes(c.key)&&c.content!=='empty').length:0;
  emptySelected.hidden=preview||!grouped;emptySelected.disabled=!occupied;
  emptySelected.textContent=occupied?'إفراغ محتويات المجموعة · الخانات المشغولة: '+f(occupied):'محتويات المجموعة فارغة';
  emptySelected.title='يزيل القطع الزخرفية من الخانات المحددة ويبقي الخشب والشاشة. يمكن التراجع مرة واحدة.';
  const groupContents=grouped?new Set(cells.filter(c=>multiKeys.includes(c.key)).map(c=>c.content)):null;
  active('content',groupContents?.size===1?[...groupContents][0]:leaf?contentFor(plan,leaf.key):'');
  for(const b of all('button[data-content]')){
    b.disabled=false;
    b.setAttribute('aria-label', (grouped?'انقر للتطبيق على الخانات المحددة أو اسحب إلى خانة واحدة: ':'اسحب إلى خانة أو انقر: ')+(b.dataset.content==='empty'?'إفراغ':labels[b.dataset.content]));
  }
  $('shelf-placement').hidden=!pendingContent;
  if(pendingContent)$('shelf-placement-label').textContent=pendingContent?.kind==='sized-screen'?'انقر داخل خانة لوضع الشاشة بمقاس '+f(pendingContent.size.w)+' × '+f(pendingContent.size.h)+' سم.':pendingContent==='empty'?'اختر الخانة المراد إفراغها.':'اختر خانة لوضع '+labels[pendingContent]+' فيها.';

  $('shelf-cell-label').textContent=grouped?groupText+' · انقر على نوع المحتوى لتطبيقه على كل خانة محدّدة. السحب إلى الرسم يضعه في خانة واحدة.':leaf?(info.label+' · '+labels[contentFor(plan,leaf.key)||'empty']+'. انقر لتغييرها، أو اسحب إلى خانة أخرى.'):'اسحب عنصرًا من هنا وأفلته في خانة، دون الحاجة إلى تحديدها مسبقًا.';
  $('shelf-wall-summary').textContent=f(plan.wall.w)+' × '+f(plan.wall.h)+' سم';
  $('shelf-cabinet-summary').textContent=f(plan.cab.w)+' × '+f(plan.cab.h)+' سم';
  $('shelf-tool-hint').textContent=preview?'عد إلى التصميم لإظهار أدوات التحرير.':hintFor(tool)+(workspace.volume&&tool==='resize'&&!grouped?' اسحب مقبض «عمق» لزيادة بروز الدولاب عن الجدار أو تقليله.':'');
  $('shelf-dims').checked=showDims;$('shelf-undo').disabled=!history.length;

  $('shelf-merge-prompt').hidden=!pendingMerge;
  $('shelf-photo-clear').hidden=!photoUrl;
  $('shelf-photo-info').textContent=photoUrl?(persisted?'صورة محليّة محفوظة في هذا المتصفح.':'الصورة ظاهرة في الجلسة الحالية فقط.'):'صورة اختيارية من جهازك.';
  const m=cabMinimum(plan);
  for(const [id,lo,hi] of [['shelf-wall-w',limits.minWallW,limits.maxWallW],['shelf-wall-h',limits.minWallH,limits.maxWallH],['shelf-cabinet-w',m.w,plan.wall.w],['shelf-cabinet-h',m.h,plan.wall.h],['shelf-cabinet-x',0,plan.wall.w],['shelf-cabinet-bottom',0,plan.wall.h]]){
    $(id).min=String(lo);$(id).max=String(hi);
  }
  $('shelf-save-status').textContent=unitContext?(persisted?'مسودة تقسيم الوحدة':'مسودة في هذه الجلسة فقط'):persisted?'محفوظ في هذا المتصفح':'لم يُحفظ آخر تعديل في هذا المتصفح';
  if(forms){
    showText('shelf-room-form-status','');valuesForForms();
    if(envelope){$('shelf-group-w').value=String(round(envelope.w));$('shelf-group-h').value=String(round(envelope.h));}
  }
  if(inspector==='content')screenPanel.update(plan,leaf?{kind:'cell',key:leaf.key}:null);
  if(inspector==='presets')refreshCopies();
  comparison.refresh(preview);renderScene();
}
function saveLocal(){
  if(unitContext){persisted=unitContext.writeDraft(plan);return;}
  try{
    localStorage.setItem(planKey,JSON.stringify(plan));
    for(const id of wallIds){if(!roomPhotos[id]&&storedPhotos[id]){localStorage.removeItem(wallPhotoKey(id));storedPhotos[id]=null;}}
    for(const id of wallIds){if(roomPhotos[id]&&storedPhotos[id]!==roomPhotos[id]){localStorage.setItem(wallPhotoKey(id),roomPhotos[id]);storedPhotos[id]=roomPhotos[id];}}
    persisted=true;
  }catch{persisted=false;}
}
function commit(next,message,options={}){
  if(!next)return false;
  if(unitContext&&(['x','y','w','h'].some(k=>Math.abs(next.cab[k]-unitContext.plan.cab[k])>1e-7)||next.wall.w!==unitContext.plan.wall.w||next.wall.h!==unitContext.plan.wall.h||shelfDepth(next)!==shelfDepth(unitContext.plan)||JSON.stringify(next.wallGrid||null)!==JSON.stringify(unitContext.plan.wallGrid||null))){
    warn('تُضبط حدود الوحدة من مسقط المطبخ. لتفصيلها هنا اسحب الفاصل أو انقر داخل الخانة.');return false;
  }
  canvas.setDropPreview(null);if(!options.keepDivider){selectedDividerId=null;selectedDividerTitle='';}
  const oldWall=getRoom(plan).attachedWall,nextWall=getRoom(next).attachedWall;
  if(oldWall!==nextWall){photoJob++;ruler=null;}
  const photos=options.resetPhotos?{}:ownKey(options,'photoUrl')?{...roomPhotos,[nextWall]:options.photoUrl}:roomPhotos;
  const photoChanged=wallIds.some(id=>(roomPhotos[id]||null)!==(photos[id]||null));
  const changed=JSON.stringify(plan)!==JSON.stringify(next)||photoChanged;
  if(changed){history.push({plan,target,selected,lastCell,roomPhotos,multiKeys:[...multiKeys],noSelection,tool,dimensionScope});if(history.length>35)history.shift();}
  if(next.wall.w!==plan.wall.w||next.wall.h!==plan.wall.h)ruler=null;plan=next;roomPhotos=photos;photoUrl=photos[nextWall]||null;
  if(options.groupKeys||options.keepMulti!==false&&hasGroup()){multiKeys=currentLeafKeys(plan,options.groupKeys||multiKeys);if(multiKeys.length<2)multiKeys=[];noSelection=false;}else releaseSelection();
  rememberSelection(options.target||target,false);if(options.tool)tool=options.tool;
  pendingMerge=null;warn('');if(changed)saveLocal();paint({forms:true});if(message)say(message);return changed;
}
function handleCanvas(a){
  if(preview||!a||workspace.orbit||workspace.room)return;
  if(a.type==='handle-group-move'){
    if(!['select','move','point-insert'].includes(tool)||pendingContent||a.spec?.type!=='move'||![a.spec.dx,a.spec.dy].every(Number.isFinite)||!Array.isArray(a.keys)||a.keys.length<2)return;
    if(!a.owner){if(sameGroup(a.keys))finishGroupTransform(a.spec);return;}
    if(hasGroup()||noSelection||a.owner.kind!=='cell'||!eqTarget(target,a.owner)||targetInfo(plan,a.owner)?.leaf!==false)return;
    const children=scopedCells(plan).filter(c=>c.key.startsWith(a.owner.key+'/')).map(c=>c.key);
    if(children.length!==a.keys.length||children.some((key,i)=>key!==a.keys[i]))return;
    finishGroupTransform(a.spec,false,children,{target,keepMulti:false});return;
  }
  if(a.type==='cabinet-depth'){
    if(tool!=='resize'||hasGroup()||!workspace.volume||!Number.isFinite(a.depth))return;
    const next=setShelfDepth(plan,Math.round(a.depth*10)/10);
    if(next!==plan)commit(next,'عمق الدولاب الآن '+f(shelfDepth(next))+' سم.',{target:{kind:'cabinet'},tool:'resize'});return;
  }
  if(a.type==='equal-distribute'){
    if(tool!=='point-insert'||a.axis!==placeAxis||!Array.isArray(a.keys)||!a.keys.length||hasGroup()&&!sameGroup(a.keys))return;
    const r=equalDistribution(plan,a.keys,a.axis,a.count,true);
    if(!r.ok){warn(r.reason);return;}if(r.changed)commit(r.plan,'وُزّعت الفتحات بالتساوي بعد خصم سماكة الفواصل. عدد الفتحات في كل حيّز: '+f(a.count)+'.',hasGroup()?{groupKeys:r.keys,tool:'point-insert'}:{target:{kind:'cell',key:a.keys[0]},keepMulti:false,tool:'point-insert'});return;
  }
  if(a.type==='group-reframe'){
    if(tool!=='draw'||!sameGroup(a.keys))return;
    const r=reframeGroup(plan,multiKeys,a.rect);
    if(!r.ok){warn(r.reason||'هذا المستطيل لا يتّسع للمجموعة.');return;}
    if(r.changed)commit(r.plan,'أُعيد رسم حدود المجموعة: '+f(r.bounds.w)+' × '+f(r.bounds.h)+' سم.',{keepMulti:true});
    return;
  }
  if(a.type==='group-transform'){
    if(!sameGroup(a.keys)||a.spec?.type!==tool||!['move','resize'].includes(tool))return;
    finishGroupTransform(a.spec);return;
  }
  if(a.type==='marquee-select'){if(tool==='select')acceptMarquee(a.keys);return;}
  const requires={move:'move',resize:'resize',draw:'draw',measure:'measure'};
  if(requires[a.type]&&tool!==requires[a.type])return;
  if(a.type==='target'&&tool!=='select')return;
  if(a.type==='toggle-insert-axis'){
    if(['point-insert','select'].includes(tool)&&!dragSession)togglePlaceAxis(a.p,a.hit);
    return;
  }
  if(a.type==='hover-insert'||a.type==='insert-point'){
    if(tool!=='point-insert'||dragSession)return;
    if(a.type==='hover-insert'){previewPlacement(a.p,a.hit);return;}
    if(hasGroup()){finishGroupPlacement(placeAxis,a.p,a.hit);return;}
    const r=applyPlacement(plan,placeAxis,a.p,a.hit);
    canvas.setDropPreview(null);
    if(!r.ok){warn(r.reason);return;}
    if(r.changed)commit(r.plan,'أُضيف '+r.label+'.',{target:r.target,tool:'point-insert'});
    return;
  }
  if(a.type==='direct-board'||a.type==='point-pick'){
    if(!a.hit?.target||!['point-insert','select'].includes(tool)||hasGroup()&&tool==='point-insert')return;
    if(pendingContent){if(a.hit.dividerId){warn('اختر الفراغ داخل الخانة.');return;}handleCanvas({type:'target',target:a.hit.target});return;}
    if(a.hit.dividerId)selectPart(a.hit);else if(tool==='select')switchTo(a.hit.target);
    return;
  }
  if(a.type==='delete-hit'){
    if(tool!=='delete')return;
    pendingMerge=null;$('shelf-merge-prompt').hidden=true;
    if(a.screen){const r=removeSizedScreen(plan);if(r.changed)commit(r.plan,'حُذفت الشاشة وحدها وبقيت الرفوف والقطع في مكانها.',{keepMulti:true,tool:'delete'});return;}
    if(a.dividerId){removeExact(a.dividerId);return;}
    const leaf=scopedCells(plan).find(c=>c.key===a.cellKey);
    if(leaf&&leaf.content!=='empty'){
      const r=commitContentDrop(plan,{content:'empty'},{x:leaf.x+leaf.w/2,y:leaf.y+leaf.h/2});
      if(r.ok&&r.changed)commit(r.plan,'حُذفت '+labels[leaf.content]+' من '+targetInfo(plan,r.target).label+'.',{target:hasGroup()?target:r.target,tool:'delete'});
    }return;
  }
  if(a.type==='notice'){if(tool==='delete'){pendingMerge=null;$('shelf-merge-prompt').hidden=true;}warn(a.text);return;}
  if(a.type==='content-transfer'){
    if(!['select','move','point-insert'].includes(tool)||(hasGroup()&&tool!=='select'))return;
    pendingContent=null;const result=commitContentDrop(plan,{fromKey:a.fromKey},a.p);
    finishContentDrop(result);return;
  }
  if(a.type==='measure'){
    if(tool!=='measure'||![a.a?.x,a.a?.y,a.b?.x,a.b?.y].every(Number.isFinite))return;
    const clip=p=>({x:Math.min(plan.wall.w,Math.max(0,p.x)),y:Math.min(plan.wall.h,Math.max(0,p.y)),...(Number.isFinite(p.z)?{z:p.z}:{})});
    ruler={a:clip(a.a),b:clip(a.b)};warn('');paint();say('المسافة بين النقطتين: '+f(Math.hypot(ruler.b.x-ruler.a.x,ruler.b.y-ruler.a.y))+' سم.');return;
  }
  if(a.type==='target'){
    if(pendingContent){const cell=a.target?.kind==='cell'?scopedCells(plan).find(c=>c.key===a.target.key):null;
      if(!cell){warn('اختر فراغ خانة داخل الدولاب، أو ألغِ وضع القطعة.');return;}
      const src=pendingContent;pendingContent=null;
      if(src?.kind==='sized-screen'){applyScreen({kind:'cell',key:cell.key},src.size);return;}
      finishContentDrop(commitContentDrop(plan,{content:src},{x:cell.x+cell.w/2,y:cell.y+cell.h/2}));return;}
    switchTo(a.target);return;
  }
  if(a.type==='select'&&pendingContent){handleCanvas({type:'target',target:{kind:'cell',key:a.key}});return;}
  if(a.type==='select'){switchTo({kind:'cell',key:a.key});return;}
  if(a.type==='draw'){if(hasGroup())return;const result=evaluateDraw(plan,a.a,a.b);if(!result.ok){warn(result.reason||'المساحة أصغر من أن تتّسع للتقسيم الحالي.');return;}commit(drawCab(plan,a.a,a.b),'حُدّدت مساحة الدولاب. انقر في موضع الفاصل الأول.',{target:{kind:'cabinet'},tool:'point-insert'});return;}
  if(a.type==='move'){if(hasGroup())return;commit(moveCab(plan,a.dx,a.dy),'حُدّث موضع الدولاب على الجدار.',{target:{kind:'cabinet'}});return;}
  if(a.type==='resize'){if(hasGroup())return;commit(resizeCab(plan,a.corner,a.p),'حُدّثت أبعاد الدولاب ضمن حدود الجدار.',{target:{kind:'cabinet'}});return;}
  if(a.type==='scoped-divider'){
    if(!['select','move','point-insert'].includes(tool)||!Number.isFinite(a.cm))return;
    const divider=scopedDividers(plan).find(d=>d.id===a.id);
    if(!divider||!eqTarget(a.target,divider.owner))return;
    if(a.via==='shared-selection'){
      if(!['select','move'].includes(tool)||!sameGroup(a.keys))return;
      const shared=sharedSelectionReach(plan,multiKeys,divider);
      if(!Number.isFinite(a.sharedAt)||!shared?.segments.some(r=>a.sharedAt>=r.start-1e-7&&a.sharedAt<=r.end+1e-7))return;
      const next=moveScopedDivider(plan,divider.id,a.cm);
      if(next!==plan){
        const prior=new Map(scopedCells(plan).map(c=>[c.key,c])),selectedSet=new Set(multiKeys);
        const others=scopedCells(next).filter(c=>!selectedSet.has(c.key)&&['x','y','w','h'].some(k=>Math.abs(c[k]-prior.get(c.key)[k])>1e-6));
        commit(next,'تحرّك الفاصل وبقيت الخانات محددة.'+(others.length?' يمتد اللوح خارج المجموعة؛ تغيّر مقاس '+f(others.length)+' من الخانات المجاورة أيضًا.':''),{keepMulti:true});
      }
      if(a.constraint)warn(a.constraint);return;
    }
    if(hasGroup()&&tool!=='select')return;
    if(a.via==='group-board'&&hasGroup()&&sharedSelectionReach(plan,multiKeys,divider))return;
    const groupBoard=tool==='select'&&a.via==='group-board'&&(multiKeys.length>=2||noSelection);
    const direct=groupBoard||tool==='point-insert'&&a.via==='place-board'||tool==='move'&&a.via==='move-board';
    const currentReach=dividerReach(plan,target,divider),reach=currentReach||(direct?dividerReach(plan,divider.owner,divider):null);
    if(!reach||['point-insert','move'].includes(tool)&&!direct)return;
    if(a.via==='point'&&(tool!=='select'||selectedDividerId!==divider.id))return;
    const next=moveScopedDivider(plan,divider.id,a.cm);
    if(next!==plan){
      const msg=reach.relation==='boundary'?'تحرّك الفاصل المشترك. بقيت المساحة نفسها محدّدة وتغيّرت الأبعاد على جانبيه.':divider.kind==='wall'?'حُرّك حدّ التخطيط داخل الجدار.':'حُرّك الفاصل داخل المساحة المحددة.';
      commit(next,msg,{target:currentReach&&!groupBoard?target:divider.owner,keepDivider:selectedDividerId===divider.id});
    }
    if(a.constraint)warn(a.constraint);
    return;
  }
}
// Placement always resolves fresh geometry at the pointer, independently of the toolbar selection.
function sameGroup(keys){return hasGroup()&&Array.isArray(keys)&&keys.length===multiKeys.length&&keys.every((k,i)=>k===multiKeys[i]);}
function finishGroupTransform(spec,strict=false,keys=multiKeys,options={keepMulti:true}){
  const r=transformGroup(plan,keys,spec);
  if(!r.ok){warn(r.reason||'تعذّر تعديل المجموعة.');return;}
  if(strict&&r.clamped){warn(r.reason||'لا تسمح حدود الجدار والخانات بهذه الأبعاد.');return;}
  if(!r.changed){if(r.reason)warn(r.reason);else say('لم تتغيّر حدود المجموعة.');return;}
  const dims=' · '+f(r.bounds.w)+' × '+f(r.bounds.h)+' سم';
  const affected=r.affectedKeys?.length?' · خانات مجاورة تأثّرت: '+f(r.affectedKeys.length):'';
  const frame=r.frameChanged?' · تغيّر إطار الدولاب':'';
  commit(r.plan,(spec.type==='move'?'تحرّكت المجموعة':'تغيّر مقاس المجموعة')+dims+affected+frame+'.',options);
  if(r.clamped&&r.reason)warn(r.reason);
}
function finishGroupPlacement(axis,p,hit){
  const r=groupPlacement(plan,multiKeys,axis,p,hit,true);canvas.setDropPreview(null);
  if(!r.ok){warn(r.reason||'تعذّر إدراج الفواصل في الخانات المحددة.');return;}
  if(r.changed)commit(r.plan,'أُضيف فاصل في كل خانة من المجموعة. عدد الفواصل: '+f(r.count)+'.',{groupKeys:r.keys,tool:'point-insert'});
}
function showGroupPlacement(axis,p,hit){
  const r=groupPlacement(plan,multiKeys,axis,p,hit,false);
  canvas.setDropPreview({kind:'divider',ok:r.ok,p,target:r.target,line:r.preview,lines:r.lines,label:r.label,reason:r.reason});return r;
}
function previewPlacement(p,hit){
  if(p&&hasGroup()){const r=showGroupPlacement(placeAxis,p,hit);showText('shelf-active-tool',r.ok?'فواصل للمجموعة: '+f(r.count):'إدراج داخل التحديد');return;}
  if(!p||hit?.dividerId){showText('shelf-active-tool','المؤشر: '+toolNames[tool]);canvas.setDropPreview(null);return;}
  const r=inspectPlacement(plan,placeAxis,p,hit);
  if(r.source==='divider'||r.source==='outside'){showText('shelf-active-tool','المؤشر: '+toolNames[tool]);canvas.setDropPreview(null);return;}
  const name={wall:'الجدار',zone:'منطقة الجدار',cabinet:'الدولاب كله',cell:'الخانة'}[r.target?.kind];
  showText('shelf-active-tool',name?'موضع الفاصل: '+name:'المؤشر: '+toolNames[tool]);
  canvas.setDropPreview({kind:'divider',ok:r.ok,p,line:r.preview,target:r.target,label:r.label,reason:r.reason});
}
function togglePlaceAxis(p=null,hit=null,activate=true){
  if(preview)return;
  placeAxis=placeAxis==='row'?'col':'row';if(activate){noSelection=false;inspector=null;tool='point-insert';pendingContent=null;}pendingMerge=null;
  warn('');canvas.setDropPreview(null);paint();
  if(p)previewPlacement(canvas.alignPlacement(p,hit,placeAxis,multiKeys).p,hit);
  say('اتجاه الفاصل: '+(placeAxis==='row'?'أفقي':'عمودي')+(tool==='point-insert'?'؛ انقر بالأيسر لوضعه.':'.'));
}
function selectPart(hit){
  const part=checkRemovalAt(plan,hit.dividerId);if(!part.id||!targetInfo(plan,part.owner))return;
  switchTo(part.owner,{announce:false,keepTool:true});
  selectedDividerId=part.id;selectedDividerTitle=part.title;
  paint();say('التحديد: '+part.title+'. اسحب الفاصل لتحريكه.');
}
function removeExact(id,allow=false){
  const r=removalAt(plan,id,allow);
  if(!r.ok){
    if(!allow&&r.canForce){
      canvas.setDropPreview(null);pendingMerge={dividerId:id,base:plan};warn('');
      $('shelf-merge-message').textContent=r.title+' · '+collisionDescription(r);
      $('shelf-merge-prompt').hidden=false;$('shelf-merge-confirm').focus({preventScroll:true});return;
    }
    warn(r.reason||'تعذّرت إزالة هذا الفاصل.');return;
  }
  const clearGroup=hasGroup()&&r.owner?.kind!=='wall'&&r.owner?.kind!=='zone';
  commit(r.plan,'أُزيل '+(r.title||'الفاصل الذي اخترته')+'.'+(clearGroup?' أُلغي تحديد المجموعة بعد دمج الخانات.':''),{target:r.target||target,tool:'delete',keepMulti:!clearGroup});
}
// Palette hits use the same wall-space projection as point operations.
function palettePick(pt){
  if(!pt||!Number.isFinite(pt.x)||!Number.isFinite(pt.y)||preview)return null;
  const el=document.elementFromPoint(pt.x,pt.y);
  if(!el||!pane.contains(el))return null;
  if(workspace.volume)return canvas.pickClient(pt.x,pt.y);
  const p=canvas.wallPointFromClient(pt.x,pt.y);return p?{p,hit:null}:null;
}
function clearDrop(){canvas.alignPlacement(null);dragSession=null;canvas.setDropPreview?.(null);}
function stopDirect(){canvas.setDropPreview(null);selectedDividerId=null;selectedDividerTitle='';palette?.cancel();clearDrop();pendingContent=null;}
function dragPreview(payload,client){
  if(preview||workspace.room||!payload)return {ok:false,label:'خارج مساحة التحرير'};
  if(!dragSession){canvas.setDropPreview(null);dragSession={plan,target:{...target}};canvas.cancelGesture?.();pendingContent=null;$('shelf-placement').hidden=true;}
  if(dragSession.plan!==plan||!eqTarget(dragSession.target,target)){clearDrop();return {ok:false,label:'تغيّر التحديد'};}
  const picked=palettePick(client),hit=picked?.hit||null;let p=picked?.p;
  if(workspace.volume&&payload.kind!=='divider'&&(!hit||hit.dividerId||hit.target?.kind!=='cell'))p=null;
  if(!p){canvas.alignPlacement(null);canvas.setDropPreview(null);return {ok:false,label:payload.kind==='divider'?'أفلت على الجدار أو داخل الدولاب':'أفلت داخل خانة'};}
  if(payload.kind==='divider'){
    p=canvas.alignPlacement(p,hit,payload.axis,multiKeys).p;
    if(hasGroup()){const r=showGroupPlacement(payload.axis,p,hit);return {ok:r.ok,label:r.ok?'إدراج في كل خانة محددة':r.reason};}
    const r=inspectPlacement(plan,payload.axis,p,hit);
    canvas.setDropPreview({kind:'divider',ok:r.ok,reason:r.reason,label:r.ok?r.label:r.reason,p,target:r.target,line:r.preview});
    return {ok:r.ok,label:r.ok?'أفلت لتثبيت '+(payload.axis==='row'?'التقسيم الأفقي':'التقسيم الرأسي'):r.reason};
  }
  const r=planContentDrop(plan,{content:payload.content},p);
  canvas.setDropPreview({kind:'content',...r,p,label:r.ok?r.label:r.reason});
  return {ok:r.ok,label:r.ok?r.label:r.reason};
}
function finishContentDrop(r){
  if(!r.ok){warn(r.reason);return;}
  if(!r.changed){paint();warn('');say(r.label||'لم يتغير المحتوى.');return;}
  const name=labels[r.content],prev=labels[r.previousContent];
  const dest=targetInfo(r.plan,r.target)?.label||'الخانة';
  const msg=r.effect==='swap'?'تبادلت القطعتان مكانيهما: '+name+'، '+prev+'.':r.effect==='move'?'نُقل المحتوى إلى '+dest+'؛ الخانة الأصلية فارغة الآن.':r.effect==='clear'?'أُفرغت '+dest+'.':r.effect==='replace'?dest+' · المحتوى الجديد: '+name+'، والسابق: '+prev+'.':dest+' · أُضيف إليها: '+name+'.';
  commit(r.plan,msg,{target:r.target,tool:['move','point-insert'].includes(tool)?tool:'select'});
}
function dropFromPalette(payload,client){
  const s=dragSession,picked=palettePick(client),hit=picked?.hit||null,raw=picked?.p,p=raw&&payload.kind==='divider'?canvas.alignPlacement(raw,hit,payload.axis,multiKeys).p:workspace.volume&&(!hit||hit.dividerId||hit.target?.kind!=='cell')?null:raw;clearDrop();
  if(preview||!s||s.plan!==plan||!eqTarget(s.target,target))return;
  if(!p){say('أُفلت خارج الرسم. لم يتغيّر التصميم.');return;}
  if(payload.kind==='divider'){
    if(hasGroup()){finishGroupPlacement(payload.axis,p,hit);return;}
    const r=applyPlacement(plan,payload.axis,p,hit);
    if(!r.ok){warn(r.reason);return;}if(!r.changed)return;
    const origin=targetInfo(plan,r.target),normal=r.axis==='row'?'من أعلى التحديد':'من يسار التحديد';
    const offset=r.cm-(r.axis==='row'?origin.y:origin.x);
    commit(r.plan,'أُضيف '+r.label+' عند '+f(offset)+' سم '+normal+'.',{target:r.target,tool:'point-insert'});return;
  }
  finishContentDrop(commitContentDrop(plan,{content:payload.content},p));
}
function setMode(mode){if(unitContext)return;if(workspace.room)workspace.showDetail();workspace.stopOrbit();inspector=null;stopDirect();canvas.cancelGesture?.();preview=mode==='preview';pendingMerge=null;warn('');paint();say(preview?'معاينة الدولاب على الجدار.':'وضع التصميم.');}
function chooseScope(key){if(!['cell','cabinet','wall'].includes(key))return;stopDirect();canvas.cancelGesture?.();switchTo(key==='cell'?cellTarget():{kind:key});}
function armTool(key){
  if(!toolKeys.has(key)||preview)return;if(key!=='select')noSelection=false;inspector=null;inspectorTrigger=null;stopDirect();canvas.cancelGesture?.();tool=key;pendingMerge=null;warn('');paint();say(hintFor(key));
  const board=pane.querySelector('[data-shelf-board]');if(!board)return;
  const r=board.getBoundingClientRect(),visible=Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top));
  if(visible<Math.min(r.height,innerHeight)*0.55)board.scrollIntoView({block:'center',inline:'nearest'});
}
function undo(){stopDirect();if(!history.length)return;canvas.cancelGesture?.();const s=history.pop();roomPhotos=s.roomPhotos;photoJob++;if(plan.wall.w!==s.plan.wall.w||plan.wall.h!==s.plan.wall.h)ruler=null;plan=s.plan;photoUrl=roomPhotos[getRoom(plan).attachedWall]||null;lastCell=s.lastCell||s.selected;rememberSelection(s.target,false);multiKeys=currentLeafKeys(plan,s.multiKeys||[]);noSelection=!!s.noSelection;if(multiKeys.length>=2||noSelection){tool=s.tool||'select';dimensionScope=s.dimensionScope||dimensionScope;}pendingMerge=null;warn('');saveLocal();paint({forms:true});say('تم التراجع عن آخر تعديل واستعادة التحديد.');}
function dimension(id){return $(id).value.trim()===''?NaN:Number($(id).value);}
$('shelf-room-cube').addEventListener('click',()=>{
 const w=dimension('shelf-room-w');if(!Number.isFinite(w)||w<60||w>600){showText('shelf-room-form-status','للمكعّب اختر طول ضلع بين ٦٠ و٦٠٠ سم في خانة العرض.');return;}
 $('shelf-room-l').value=w;$('shelf-room-h').value=w;showText('shelf-room-form-status','الأضلاع الثلاثة '+f(w)+' سم. اضغط «تطبيق أبعاد الغرفة» لحفظها.');
});
$('shelf-room-form').addEventListener('submit',e=>{
  e.preventDefault();if(preview||inspector!=='dimensions'||dimensionScope!=='room')return;
  const r=updateRoom(plan,{width:dimension('shelf-room-w'),length:dimension('shelf-room-l'),height:dimension('shelf-room-h')});
  if(!r.ok){showText('shelf-room-form-status',r.reason);warn(r.reason);return;}
  const msg=r.changed?'حُفظت مقاسات الغرفة.'+(r.clamped?' عُدّل موضع الدولاب ليبقى داخل الغرفة.':''):'هذه مقاسات الغرفة الحالية.';
  if(r.changed)commit(r.plan,msg);showText('shelf-room-form-status',msg);say(msg);
});
$('shelf-group-form').addEventListener('submit',e=>{
  e.preventDefault();if(preview||inspector!=='dimensions'||dimensionScope!=='group'||!hasGroup())return;
  const w=dimension('shelf-group-w'),h=dimension('shelf-group-h'),g=groupInfo(plan,multiKeys);
  if(!g.ok||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0){warn('أدخل عرضًا وارتفاعًا موجبين للمجموعة.');return;}
  const dx=Math.abs(round(g.bounds.w)-w)<1e-8?0:w-g.bounds.w,dy=Math.abs(round(g.bounds.h)-h)<1e-8?0:h-g.bounds.h;
  finishGroupTransform({type:'resize',corner:'se',dx,dy},true);
});
$('shelf-wall-form').addEventListener('submit',e=>{e.preventDefault();if(preview||inspector!=='dimensions'||dimensionScope!=='wall')return;const w=dimension('shelf-wall-w'),h=dimension('shelf-wall-h');
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<limits.minWallW||w>limits.maxWallW||h<limits.minWallH||h>limits.maxWallH){warn('عرض الجدار من '+f(limits.minWallW)+' إلى '+f(limits.maxWallW)+' سم وارتفاعه من '+f(limits.minWallH)+' إلى '+f(limits.maxWallH)+' سم.');return;}
 const min=cabMinimum(plan);if(w<min.w||h<min.h){warn('لا تتّسع أبعاد الجدار لهذا التقسيم. أزل بعض الفواصل أولًا.');return;}
 const check=evaluateWall(plan,{w,h});if(!check.ok){warn(check.reason);return;}const next=updateWall(plan,{w,h});commit(next,'حُدّثت أبعاد الجدار وحُفظ الدولاب داخله.'+(check.clamped?' '+check.reason:''));});
$('shelf-cabinet-form').addEventListener('submit',e=>{e.preventDefault();if(preview||inspector!=='dimensions'||dimensionScope!=='cabinet')return;const w=dimension('shelf-cabinet-w'),h=dimension('shelf-cabinet-h'),x=dimension('shelf-cabinet-x'),bottom=dimension('shelf-cabinet-bottom'),min=cabMinimum(plan);
 const depth=dimension('shelf-cabinet-depth'),depthCheck=evaluateShelfDepth(plan,depth);if(!depthCheck.ok){warn(depthCheck.reason);return;}
 if(![w,h,x,bottom].every(Number.isFinite)){warn('أدخل أربعة مقاسات صحيحة بالسنتيمتر.');return;}
 if(w<min.w||h<min.h){warn('يحتاج التقسيم الحالي إلى عرض '+f(min.w)+' سم وارتفاع '+f(min.h)+' سم على الأقل.');return;}
 if(x<0||bottom<0||x+w>plan.wall.w+0.051||bottom+h>plan.wall.h+0.051){warn('الدولاب يتجاوز الجدار. قلّل المقاس أو المسافة من اليسار أو من الأرض.');return;}
 const patch={w,h,x,y:Math.max(0,plan.wall.h-h-bottom)};const check=evaluateCab(plan,patch);if(!check.ok){warn(check.reason);return;}commit(setShelfDepth(updateCab(plan,patch),depth),'طُبّقت أبعاد الدولاب وموضعه. عمقه '+f(depth)+' سم.');});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.closest('#shelf-dock,#shelf-inspector,#shelf-file-menu')||b.id==='shelf-properties-toggle')workspace.stopOrbit();
 if(b.closest('#shelf-file-menu')){const m=$('shelf-file-menu');m.open=false;m.querySelector('summary').focus({preventScroll:true});}
 if(b.id==='shelf-properties-toggle'){
   if(preview)return;
   if(isProperty(inspector)){dismissInspector(true);return;}
   openInspector(workspace.room?'dimensions':lastProperty,b);return;
 }
 if(b.id==='shelf-dock-fold'){
   dockFolded=!dockFolded;if(dockFolded&&!isProperty(inspector))inspector=null;drawDock();return;
 }
 if(b.id==='shelf-empty-selected'){
   if(preview||inspector!=='content'||!hasGroup())return;
   const r=bulkSetContent(plan,multiKeys,'empty');if(!r.changed)return;
   commit(r.plan,'أُفرغ محتوى '+f(r.count)+' من الخانات المحددة. بقيت الفواصل والشاشة في مكانها.',{keepMulti:true});return;
 }
 if(b.id==='shelf-group-clear'){
   if(preview||multiKeys.length<2)return;
   canvas.cancelGesture?.();selectedDividerId=null;releaseSelection(true);warn('');paint();say('أُلغي تحديد المجموعة.');return;
 }
 if(b.id==='shelf-inspector-close'){dismissInspector(true);return;}
 if(b.id==='shelf-preview-toggle'){setMode(preview?'design':'preview');return;}
 if(b.id==='shelf-axis-switch'){togglePlaceAxis(null,null,false);return;}
 if(b.id==='shelf-undo'){undo();return;}
 if(b.id==='shelf-reset'){inspector=null;stopDirect();canvas.cancelGesture?.();photoJob++;preview=false;ruler=null;placeAxis='row';commit(createShelfPlan(),'عاد نموذج البداية. يمكنك التراجع لاستعادة تصميمك.',{target:{kind:'cabinet'},resetPhotos:true,tool:'point-insert',keepMulti:false});return;}
 if(preview)return;
 if(b.dataset.inspector){openInspector(b.dataset.inspector,b);return;}
 if(b.dataset.tool){const key=b.dataset.tool;
   if(key==='select'||key==='measure'){openInspector(key,b);return;}
   armTool(key);return;
 }
 if(b.dataset.scopePick){chooseScope(b.dataset.scopePick);return;}
 if(b.id==='shelf-ruler-clear'){ruler=null;canvas.cancelGesture?.();paint();say('مُسحت قراءة المسطرة.');return;}
 if(b.id==='shelf-placement-cancel'){pendingContent=null;paint();say('أُلغي وضع القطعة.');return;}
 if(b.dataset.content){
   const content=b.dataset.content;
   if(multiKeys.length>=2){
     const r=bulkSetContent(plan,multiKeys,content);
     if(!r.keys.length){warn('تغيّرت الخانات. حدّد المجموعة من جديد.');return;}
     if(!r.changed){say('كل الخانات المحددة تحتوي بالفعل على '+labels[content]+'.');return;}
     pendingContent=null;inspector=null;
     commit(r.plan,'المحتوى: '+labels[content]+' · الخانات التي تغيّرت: '+f(r.count)+' من '+f(r.keys.length)+'.',{keepMulti:true,tool:'select'});
     return;
   }
   const cell=!noSelection&&target.kind==='cell'?scopedCells(plan).find(c=>c.key===target.key):null;
   if(cell){pendingContent=null;inspector=null;finishContentDrop(commitContentDrop(plan,{content},{x:cell.x+cell.w/2,y:cell.y+cell.h/2}));}
   else{armTool('select');pendingContent=content;paint();say($('shelf-placement-label').textContent);}
   return;
 }
 if(b.dataset.finish&&hasGroup()){
   const r=groupFinish(plan,multiKeys,b.dataset.finish);if(!r.changed){say('هذا التشطيب مطبّق على الخانات المحددة.');return;}
   commit(r.plan,'طُبّق تشطيب '+labels[b.dataset.finish]+' داخل الخانات المحددة. بقي خشب الهيكل العام كما هو.',{keepMulti:true});return;
 }
 if(b.dataset.finish){commit(setFinish(plan,b.dataset.finish),'تغيّر تشطيب الدولاب إلى '+labels[b.dataset.finish]+'.');return;}
 if(b.dataset.preset){if(hasGroup()){
   const r=groupPreset(plan,multiKeys,b.dataset.preset);if(!r.ok){warn(r.reason||'لا يمكن تطبيق النموذج على المجموعة.');return;}
   if(!r.changed){say('الخانات المحددة مطابقة للنموذج.');return;}
   inspector=null;commit(r.plan,'طُبّق النموذج داخل المجموعة. الخانات المحددة بعد التعديل: '+f(r.keys.length)+'.',{groupKeys:r.keys,tool:'select'});return;
 }inspector=null;const newShape=applyPreset(plan,b.dataset.preset);const nextTarget=target.kind==='wall'||target.kind==='zone'?target:{kind:'cabinet'};commit(newShape,'طُبّق قالب يضبط تقسيم الدولاب ومحتويات خاناته.',{target:nextTarget,tool:'point-insert'});return;}
 if(b.dataset.wallColor){commit(setWallColor(plan,b.dataset.wallColor),'تغيّر لون الجدار.'+(photoUrl?' تظهر الصورة فوق اللون.':''));return;}
 const id=b.id;
 if(id==='shelf-scope-parent'){pendingContent=null;switchTo(targetParent(plan,target));return;}
 if(id==='shelf-merge-confirm'&&pendingMerge){if(pendingMerge.base===plan)removeExact(pendingMerge.dividerId,true);return;}
 if(id==='shelf-merge-cancel'){pendingMerge=null;$('shelf-merge-prompt').hidden=true;return;}
 if(id==='shelf-photo-clear'){photoJob++;commit(plan,'أزيلت صورة الجدار المحليّة.',{photoUrl:null});$('shelf-photo-info').textContent='لم تختر صورة.';}
});
document.addEventListener('change',e=>{if(preview)return;if(e.target.id==='shelf-dimension-target'&&inspector==='dimensions'){dimensionScope=e.target.value==='group'&&hasGroup()?'group':e.target.value==='wall'?'wall':e.target.value==='room'?'room':'cabinet';paint({forms:true});return;}if(e.target.id==='shelf-cell-picker'){const t={kind:'cell',key:e.target.value};if(pendingContent)handleCanvas({type:'target',target:t});else switchTo(t);}if(e.target.id==='shelf-region-picker')switchTo(e.target.value==='wall'?{kind:'wall'}:{kind:'zone',key:e.target.value});});
$('shelf-dims').addEventListener('change',e=>{showDims=e.target.checked;renderScene();});
let lastExport=null;
$('shelf-export').addEventListener('click',e=>{
  $('shelf-file-menu').open=false;
  try{
    let image;
    if(workspace.room)image=roomView.exportSvg();
    else if(workspace.volume){const c=workspace.camera,art=renderShelfVolume(plan,{...c,depth:shelfDepth(plan),photoUrl,prefix:'shelf-volume-export'}),box=art.bounds||art.projection.bounds,w=box.w/c.zoom,h=box.h/c.zoom,x=box.x+(box.w-w)/2,y=box.y+(box.h-h)/2;
      image='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="'+Math.round(1400*h/w)+'" viewBox="'+[x,y,w,h].join(' ')+'"><title>منظور دولاب الرفوف</title><desc>'+plan.cab.w+' × '+plan.cab.h+' × '+shelfDepth(plan)+' سم</desc><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#eeeade"/>'+art.html+'</svg>';
    }else image=canvas.exportSvg();if(typeof image!=='string'||!image.includes('<svg'))throw Error();
    const url=URL.createObjectURL(new Blob([image],{type:'image/svg+xml;charset=utf-8'}));const a=e.currentTarget;
    a.href=url;a.download=workspace.room?'room-view.svg':(workspace.volume?'shelf-3d-view-':'shelf-front-')+Math.round(plan.cab.w)+'x'+Math.round(plan.cab.h)+'cm.svg';
    if(lastExport)URL.revokeObjectURL(lastExport);lastExport=url;
    say(workspace.room?'رسم الغرفة بصيغة SVG جاهز للتنزيل.':workspace.volume?'رسم المنظور ثلاثي الأبعاد بصيغة SVG جاهز للتنزيل.':'الرسم الأمامي بصيغة SVG جاهز للتنزيل.');
  }catch{e.preventDefault();warn('تعذّر تصدير الرسم. جرّب مجددًا.');}
});
$('shelf-photo-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;const job=++photoJob;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){warn('اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز ١٢ م.ب.');return;}
 let url='';try{
   url=URL.createObjectURL(file);const im=new Image();im.src=url;await im.decode();if(job!==photoJob)return;
   const scale=Math.min(1,1440/Math.max(im.naturalWidth,im.naturalHeight));const el=document.createElement('canvas');el.width=Math.max(1,Math.round(im.naturalWidth*scale));el.height=Math.max(1,Math.round(im.naturalHeight*scale));const ctx=el.getContext('2d');ctx.fillStyle='#eee9e0';ctx.fillRect(0,0,el.width,el.height);ctx.drawImage(im,0,0,el.width,el.height);const data=el.toDataURL('image/jpeg',.8);
   commit(plan,'ظهرت صورتك خلف الدولاب.',{photoUrl:data});$('shelf-photo-info').textContent=persisted?'صورة محليّة محفوظة في هذا المتصفح.':'الصورة ظاهرة في الجلسة الحالية فقط.';
 }catch{if(job===photoJob)warn('تعذّرت قراءة الصورة. اختر صورة أخرى.');}finally{if(url)URL.revokeObjectURL(url);}
});
palette=mountPaletteDrag(document,{onPreview:dragPreview,onDrop:dropFromPalette,onCancel:clearDrop});
document.addEventListener('pointerdown',e=>{const menu=$('shelf-file-menu');if(menu.open&&!menu.contains(e.target))menu.open=false;},{capture:true});
document.addEventListener('keydown',e=>{
  const tab=e.target.closest?.('#shelf-property-tabs [role="tab"]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();const tabs=[...$('shelf-property-tabs').querySelectorAll('[role="tab"]')];
    const n=tabs.length,i=tabs.indexOf(tab),j=e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowLeft'?1:n-1))%n;
    tabs[j].click();tabs[j].focus({preventScroll:true});return;
  }
  if(e.key==='Escape'&&$('shelf-file-menu').open){$('shelf-file-menu').open=false;$('shelf-file-menu').querySelector('summary').focus({preventScroll:true});e.preventDefault();return;}
  if(e.key!=='Escape'||e.defaultPrevented||pane.querySelector('[data-dragging]'))return;
  if(pendingContent){pendingContent=null;paint();say('أُلغي وضع القطعة.');}
  else if(inspector)dismissInspector(true);
  else if(!preview&&multiKeys.length>=2){releaseSelection(true);paint();say('أُلغي تحديد المجموعة.');}
});
for(const el of all('input[type=number]'))el.step='any';
if(unitContext){
 document.title='تفصيل الوحدة · مخطّط المطبخ';document.querySelector('.sp-workspace-head h1').textContent='تفصيل وحدة المطبخ';
 $('kitchen-unit-toolbar').hidden=false;$('kitchen-unit-caption').textContent='العرض '+f(plan.cab.w)+' × الارتفاع '+f(plan.cab.h)+' × العمق '+f(shelfDepth(plan))+' سم';
 $('kitchen-unit-apply').addEventListener('click',()=>{const msg=unitContext.save(plan);if(msg)warn(msg);});
 $('kitchen-unit-leave').addEventListener('click',()=>unitContext.cancel());
}
rememberSelection(target);if(!saved)saveLocal();paint({forms:true});$('shelf-photo-info').textContent=photoUrl?'صورة محليّة محفوظة في هذا المتصفح.':'صورة اختيارية من جهازك.';
