import {createSurveyState,transition,currentWall,visibleChain,blockers,parseMeasurement} from './survey-studio-model.js';
import {surveyWallSheet} from './kitchen-survey-wall-sheet.js';
import {surveySymbol} from './kitchen-survey-symbols.js';
import {resolveChain,chainLabels,pointKinds} from './kitchen-chain-model.js';
import {architectureWall} from './kitchen-architecture.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {typingTarget,historyShortcut} from './kitchen-history-shortcut.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const mm=v=>fmt.format(v)+' مم';
const names={window:'نافذة',door:'باب',water:'مياه',electric:'كهرباء',drain:'صرف'};
const icon=kind=>surveySymbol(kind)||studioIcon('ruler');
const sourceNames={drawing:'مرجع من الرسم',field:'قراءة ميدانية',unknown:'يحتاج إلى قياس'};
let state=createSurveyState(),lastGood=null,lastGoodKey='',gesture=null,suppressClick=false;
const journal=[];

for(const button of document.querySelectorAll('[data-kind]')){
  const kind=button.dataset.kind;button.innerHTML=icon(kind)+'<span>'+names[kind]+'</span>';
  button.setAttribute('aria-label','إضافة '+names[kind]);button.title='إضافة '+names[kind];
}
for(const [action,name] of Object.entries({help:'help',export:'download',undo:'undo',redo:'redo'})){
  $('[data-action="'+action+'"]').innerHTML=studioIcon(name)+(action==='export'?'<span>سجل التجربة</span>':'');
}
$('[data-action="add-menu"]').innerHTML=studioIcon('plus')+'إضافة عنصر إلى الجدار';
$('#closure-form button').innerHTML=studioIcon('check');
for(const button of document.querySelectorAll('[data-close]'))if(!button.textContent)button.innerHTML=studioIcon('close');

function send(event,{keepEditor=false}={}){
  const before=state;
  const restoreFocus=['COMMIT','CANCEL','UNDO','REDO'].includes(event.type)&&document.activeElement?.matches('[data-field],#reading-source')?document.activeElement.id:null;
  state=transition(state,event);
  // Local event log measures prototype actions only. It is never uploaded.
  journal.push({at:Math.round(performance.now()),event:event.type,wallId:state.wallId,phase:state.phase,rejected:!!state.error});
  if(before.wallId!==state.wallId||before.selectionId!==state.selectionId)lastGood=null;
  render(keepEditor);
  if(restoreFocus)document.getElementById(restoreFocus)?.focus({preventScroll:true});
}
const rowNow=()=>state.draft?.row||currentWall(state).chain.rows.find(r=>r.id===state.selectionId);
const sourceNow=()=>state.draft?.source||currentWall(state).sources[state.selectionId]||'unknown';
const validDraft=()=>resolveChain(state.room,state.wallId,visibleChain(state)).ok;

function render(keepEditor=false){
  const wall=currentWall(state),edge=architectureWall(state.room,state.wallId),row=rowNow();
  const w=state.walls.indexOf(wall)+1;
  $('#walls').innerHTML=state.walls.map((item,i)=>`<button class="wall-tab" data-wall="${item.id}" aria-pressed="${item.id===wall.id}"><strong>${fmt.format(i+1)} · ${esc(item.label.replace('الجدار ',''))}</strong><small dir="ltr">${architectureWall(state.room,item.id).length*10} mm</small>${item.confirmed?'<span class="wall-ok">'+studioIcon('check')+'</span>':''}</button>`).join('');
  $('#reading-count').textContent=fmt.format(wall.chain.rows.length)+' عناصر';
  $('#readings').innerHTML=wall.chain.rows.length?wall.chain.rows.map(item=>`<button class="reading" data-select="${item.id}" aria-pressed="${state.selectionId===item.id}" aria-label="تحديد ${esc(names[item.kind]||chainLabels[item.kind])}"><span class="item-icon">${icon(item.kind)}</span><span><strong>${esc(names[item.kind]||chainLabels[item.kind])}</strong><small>${mm(item.gapMm)} · ${sourceNames[wall.sources[item.id]]||sourceNames.unknown}</small></span><i class="source-dot ${esc(wall.sources[item.id])}" aria-hidden="true"></i></button>`).join(''):'<p class="no-readings">لم تُسجّل عناصر بعد.<br>ابدأ بإضافة فتحة أو نقطة خدمة.</p>';
  const complete=state.walls.filter(item=>item.confirmed).length;
  $('#progress').textContent=fmt.format(complete)+' من ٤ جدران تمت مراجعتها';
  $('#progress-bar').style.width=(complete/4*100)+'%';
  $('#wall-number').textContent='واجهة '+fmt.format(w)+' / ٤';
  $('#wall-title').textContent=wall.label;
  $('#dimension-summary').textContent=`${edge.length*10} × ${state.room.height*10} mm`;
  $('#drawing').dataset.phase=state.phase;
  const chain=visibleChain(state),resolved=resolveChain(state.room,state.wallId,chain),key=state.wallId+':'+(row?.id||'');
  if(key!==lastGoodKey){lastGood=null;lastGoodKey=key;}
  if(resolved.ok)lastGood=structuredClone(chain);
  const displayed=resolved.ok?chain:lastGood||wall.chain;
  const geometry=resolveChain(state.room,state.wallId,displayed);
  const selectedIndex=displayed.rows.findIndex(item=>item.id===row?.id);
  $('#sheet').innerHTML=geometry.ok?surveyWallSheet(displayed,geometry.readings,edge.length*10,state.room.height*10,selectedIndex,[],edge.start,'أضف فتحة أو نقطة خدمة من الشريط'):'';
  const overall=$('#sheet [data-survey-pair]');
  if(overall){overall.classList.remove('wsheet-field-hit');overall.setAttribute('aria-label','طول الجدار الافتراضي');}
  for(const el of $('#sheet').querySelectorAll('[data-chain-hit][data-wall-kind]')){
    const item=displayed.rows[Number(el.dataset.chainHit)];
    if(!item)continue;
    const source=item.id===state.draft?.row.id?state.draft.source:wall.sources[item.id]||'unknown';
    el.classList.add('source-'+source);
  }
  $('#canvas-state').textContent=!resolved.ok?'القيمة مرفوضة · يظهر آخر موضع صالح':state.draft?'معاينة مؤقتة · لم تُثبّت بعد':'';
  const hud=$('#context-hud');hud.hidden=!row;
  if(row){
    hud.innerHTML=`${icon(row.kind)}<strong>${esc(names[row.kind]||chainLabels[row.kind])}</strong><span class="hud-value">${pointKinds.has(row.kind)?'المركز':'البداية'} ${parseMeasurement(row.gapMm)!==null?mm(parseMeasurement(row.gapMm)):'—'}</span><button data-action="focus-measure">${studioIcon('ruler')} دقة القياس</button><button data-action="delete" aria-label="حذف العنصر" title="حذف العنصر؛ يمكن التراجع">${studioIcon('trash')}</button>`;
    // Anchor horizontally to the actual selected station, while avoiding sheet edges.
    const station=parseMeasurement(row.gapMm);
    const centre=(station??0)+(pointKinds.has(row.kind)?0:(parseMeasurement(row.widthMm)??0)/2);
    hud.style.left=Math.max(33,Math.min(67,centre/(edge.length*10)*100))+'%';
  }
  if(!keepEditor)renderInspector();
  updateEditorStatus();
  const issues=blockers(state);
  $('#blockers').innerHTML=issues.length?'<ul class="blocker-list">'+issues.map(issue=>'<li>'+esc(issue.message)+'</li>').join('')+'</ul>':'<p class="draft-feedback">'+studioIcon('check')+' اكتملت متطلبات مراجعة الجدار.</p>';
  $('#wall-status').textContent=wall.confirmed?'تمت المراجعة':fmt.format(issues.length)+' للمراجعة';
  const review=$('[data-action="review"]');review.dataset.ready=String(!issues.length);
  review.innerHTML=studioIcon(wall.confirmed?'check':'guide')+(wall.confirmed?'الجدار مؤكّد في التجربة':'مراجعة الجدار');
  $('#dimensions-measured').checked=wall.dimensionsMeasured;
  $('#dimensions-measured').disabled=!!state.draft;
  $('#empty-wall-review').hidden=wall.chain.rows.length>0;
  $('#empty-reviewed').checked=!!wall.emptyReviewed;
  $('#empty-reviewed').disabled=!!state.draft;
  const closurePending=Object.hasOwn(state.closureDrafts||{},state.wallId);
  const closureValue=String(closurePending?state.closureDrafts[state.wallId]:wall.closureMm??'');
  if($('#closure-input').value!==closureValue)$('#closure-input').value=closureValue;
  $('#closure-input').disabled=!!state.draft;
  $('#closure-form button').disabled=!!state.draft;
  const delta=wall.closureMm==null?null:wall.closureMm-edge.length*10;
  $('#closure-result').textContent=closurePending?'إدخال مؤقت · سجّله بعلامة التأكيد أو ألغِه.':delta==null?'لا نملأ هذا القياس من الرسم.':Math.abs(delta)<=.5?'مطابق · فرق الإغلاق '+mm(delta):'فرق '+mm(delta)+' · راجع القراءة';
  $('[data-action="cancel-closure"]').hidden=!closurePending;
  $('#closure-result').style.color=delta!=null&&Math.abs(delta)>.5?'var(--ks-danger)':'var(--ks-ink-muted)';
  $('[data-action="undo"]').disabled=!state.past.length&&!state.draft&&!closurePending;
  $('[data-action="redo"]').disabled=!state.future.length&&!state.draft&&!closurePending;
  $('#status').textContent=state.error||state.message||'القيم بالملليمتر · مرجع المناسيب: الأرضية النهائية';
  $('#status').dataset.error=String(!!state.error);
}

function renderInspector(){
  const row=rowNow(),host=$('#inspector-content');
  if(!row){host.innerHTML='<span class="eyebrow">تفاصيل القياس</span><div class="empty-copy">حدّد عنصرًا على الجدار لتظهر أبعاده ومرجع قراءته هنا.<br><button class="secondary" data-kind="window">'+studioIcon('plus')+' إضافة نافذة</button></div>';return;}
  const point=pointKinds.has(row.kind);
  const fields=[['gapMm',point?'إلى المركز من الركن':'إلى بداية البرواز'],['bottomMm',point?'ارتفاع المركز':'أسفل البرواز عن الأرض'],['widthMm',point?'عرض نقطة الخدمة':'العرض الخارجي'],['heightMm',point?'ارتفاع نقطة الخدمة':'ارتفاع البرواز']];
  host.innerHTML=`<span class="eyebrow">العنصر المحدد / ${state.draft?.kind==='add'?'قراءة جديدة':'تفاصيل القياس'}</span><div class="inspector-title"><span class="inspector-icon">${icon(row.kind)}</span><div><h2>${esc(names[row.kind]||chainLabels[row.kind])}</h2><small>${esc(currentWall(state).label)} · مرجع محلي ثابت</small></div></div><span class="provenance" id="provenance"></span><div class="dimension-fields">${fields.map(([key,label])=>`<div class="measure-field"><label for="measure-${key}" data-scrub="${key}" title="اسحب أفقيًا للتعديل، أو اكتب الرقم في الحقل">${label}</label><div class="measure-input"><input id="measure-${key}" data-field="${key}" aria-label="${label} بالملليمتر" aria-describedby="coordinate-reference" inputmode="decimal" autocomplete="off" value="${esc(row[key])}"><span>مم</span></div></div>`).join('')}</div><p class="coordinate-reference" id="coordinate-reference">${point?'الموقع والمنسوب إلى مركز الخدمة، لا إلى حافتها.':'المسافة من ركن البداية إلى طرف البرواز الخارجي. العرض يشمل البرواز.'}</p><label class="source-label" for="reading-source">من أين جاءت هذه القراءة؟</label><select id="reading-source" class="source-select"><option value="unknown">لم تُقَس بعد</option><option value="drawing">من الرسم المرجعي</option><option value="field">قياس ميداني — محاكاة</option></select><p class="draft-feedback" id="draft-feedback" aria-live="polite"></p><div class="edit-actions"><button class="primary" data-action="commit">${studioIcon('check')} تثبيت القراءة</button><button class="cancel" data-action="cancel">إلغاء</button></div><p class="idle-hint">اسحب اسم الحقل للتعديل السريع، أو اكتب القيمة الدقيقة.</p>`;
}

function updateEditorStatus(){
  const row=rowNow();if(!row||!$('#reading-source'))return;
  const source=sourceNow();$('#reading-source').value=source;
  $('#provenance').textContent=source==='field'?'قراءة ميدانية مسجّلة في التجربة':source==='drawing'?'من الرسم · تحتاج مراجعة ميدانية':'مسودة · لم يُثبت مصدر القياس';
  $('#provenance').dataset.source=source;
  const invalid=state.draft&&!validDraft();
  $('#draft-feedback').textContent=invalid?state.error:state.draft?'تظهر المعاينة فورًا. ثبّت القراءة بعد مراجعة القيمة والمصدر.':'اختر قياسًا لتعديله. التغيير لا يثبت تلقائيًا.';
  $('#draft-feedback').classList.toggle('error',!!invalid);
  for(const input of document.querySelectorAll('[data-field]'))input.setAttribute('aria-invalid',String(!!state.draft&&parseMeasurement(state.draft.row[input.dataset.field])===null));
  $('[data-action="commit"]').disabled=!state.draft||!!invalid;
  $('[data-action="cancel"]').disabled=!state.draft;
}

function begin(){if(!state.draft)send({type:'BEGIN'},{keepEditor:true});}
function patch(values){begin();if(state.draft)send({type:'PATCH',values},{keepEditor:true});}
function select(id){if(rowNow()?.id!==id)send({type:'SELECT',id});}
function focusDimension(hit){
  const item=visibleChain(state).rows[Number(hit.dataset.chainHit)];
  if(!item)return;
  select(item.id);
  // A pending edit may refuse this selection. Never redirect the dimension to
  // another object's numeric input after that refusal.
  if(rowNow()?.id===item.id)focusMeasure(hit.dataset.chainFocus||'gapMm');
}
function focusMeasure(key='gapMm'){
  const input=$('#measure-'+key);if(!input)return;
  input.focus({preventScroll:true});input.select();
  if(matchMedia('(max-width:950px)').matches)input.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}

document.addEventListener('click',event=>{
  if(suppressClick){suppressClick=false;event.preventDefault();return;}
  const close=event.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
  const wall=event.target.closest('[data-wall]');if(wall){send({type:'WALL',id:wall.dataset.wall});return;}
  const item=event.target.closest('[data-select]');if(item){select(item.dataset.select);return;}
  const add=event.target.closest('[data-kind]');if(add){send({type:'ADD',kind:add.dataset.kind});if(state.draft?.kind==='add')focusMeasure();return;}
  const field=event.target.closest('[data-chain-focus]');if(field){focusDimension(field);return;}
  const hit=event.target.closest('[data-chain-hit]');if(hit){const row=visibleChain(state).rows[Number(hit.dataset.chainHit)];if(row&&row.id!==rowNow()?.id)select(row.id);return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='focus-measure')focusMeasure();
  else if(action==='add-menu'){$('[data-kind="window"]').focus();$('#drawing').scrollIntoView({block:'center',behavior:'smooth'});}
  else if(action==='commit')send({type:'COMMIT'});
  else if(action==='cancel')send({type:'CANCEL'});
  else if(action==='cancel-closure')send({type:'CLOSURE_CANCEL'});
  else if(action==='delete')send({type:'DELETE'});
  else if(action==='undo'||action==='redo')send({type:action.toUpperCase()});
  else if(action==='help')$('#help-dialog').showModal();
  else if(action==='review'){
    if(blockers(state).length){$('#status').textContent='أكمل البنود الموضّحة في مراجعة الجدار أولًا.';$('#blockers').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    const wall=currentWall(state);
    $('#review-summary').innerHTML=`<div class="review-summary"><strong>${esc(wall.label)}</strong><br>${fmt.format(wall.chain.rows.length)} قراءات بمصدر ميداني<br>قراءة الإغلاق: ${mm(wall.closureMm)}</div>`;
    $('#review-dialog').showModal();
  }else if(action==='confirm'){send({type:'CONFIRM'});if(currentWall(state).confirmed)$('#review-dialog').close();}
  else if(action==='export'){
    const data={format:'kitchen-survey-interaction-prototype',version:1,notice:'Demonstration only. Not a production project or field attestation.',exportedAt:new Date().toISOString(),state:{...state,past:undefined,future:undefined},events:journal};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='survey-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#status').textContent='تم تجهيز سجل التجربة للتنزيل؛ ليس ملف مشروع أو اعتمادًا ميدانيًا.';
  }
});
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-field]');if(input)patch({[input.dataset.field]:input.value});
  if(event.target.id==='closure-input')send({type:'CLOSURE_INPUT',value:event.target.value},{keepEditor:true});
});
document.addEventListener('change',event=>{
  if(event.target.id==='reading-source')patch({source:event.target.value});
  if(event.target.id==='dimensions-measured')send({type:'WALL_META',dimensionsMeasured:event.target.checked});
  if(event.target.id==='empty-reviewed')send({type:'WALL_META',emptyReviewed:event.target.checked});
});
$('#closure-form').addEventListener('submit',event=>{event.preventDefault();send({type:'CLOSURE_COMMIT'});});
document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){if(gesture)endGesture(true);else if(event.target.id==='closure-input')send({type:'CLOSURE_CANCEL'});else send({type:'CANCEL'});event.preventDefault();return;}
  const hit=event.target.closest('[data-chain-hit]');
  if(hit&&(event.key==='Enter'||event.key===' ')){event.preventDefault();focusDimension(hit);return;}
  const input=event.target.closest('[data-field]');
  if(input&&(event.key==='ArrowUp'||event.key==='ArrowDown')){
    const value=parseMeasurement(input.value);if(value===null)return;
    event.preventDefault();const next=Math.round((value+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1))*100)/100;
    input.value=next;patch({[input.dataset.field]:next});return;
  }
  if(input&&event.key==='Enter'){event.preventDefault();send({type:'COMMIT'});return;}
  if(typingTarget(event.target))return;
  const command=historyShortcut(event);if(command){event.preventDefault();send({type:command.toUpperCase()});}
});

// Pointer gestures capture the stable stage/inspector, not the SVG that previews replace.
function startGesture(event,kind,field){
  if(event.button!==0||event.isPrimary===false||gesture)return;
  const target=event.target.closest('[data-chain-hit][data-wall-kind]');
  if(kind==='move'&&target){
    const item=visibleChain(state).rows[Number(target.dataset.chainHit)];
    if(!item)return;
    if(item.id!==rowNow()?.id){send({type:'SELECT',id:item.id});if(state.selectionId!==item.id)return;}
  }
  const row=rowNow();if(!row)return;
  const svg=$('#sheet svg'),matrix=svg?.getScreenCTM();
  const scale=svg?Number(svg.dataset.inkWallMm)/Number(svg.dataset.inkWidth):1;
  const owner=kind==='scrub'?$('.inspector'):$('#drawing');
  gesture={id:event.pointerId,kind,field,owner,startX:event.clientX,startY:event.clientY,row:structuredClone(row),before:state,moved:false,matrix:matrix?.inverse(),scale};
  owner.setPointerCapture(event.pointerId);
  if(kind==='scrub')event.preventDefault();
}
$('#drawing').addEventListener('pointerdown',event=>{
  const grip=event.target.closest('[data-size-grip]');
  const row=event.target.closest('[data-chain-hit][data-wall-kind]');
  if(row&&(grip||!event.target.closest('[data-chain-focus]')))startGesture(event,grip?'resize':'move',grip?.dataset.chainFocus);
});
$('.inspector').addEventListener('pointerdown',event=>{
  const label=event.target.closest('[data-scrub]');if(label)startGesture(event,'scrub',label.dataset.scrub);
});
function moveGesture(event){
  const g=gesture;if(!g||event.pointerId!==g.id)return;
  const dx=event.clientX-g.startX,dy=event.clientY-g.startY;
  if(!g.moved&&Math.hypot(dx,dy)<5)return;
  if(!g.moved){g.moved=true;begin();}
  if(!state.draft)return;
  let values;
  if(g.kind==='scrub'){
    const base=parseMeasurement(g.row[g.field]);if(base===null)return;
    values={[g.field]:Math.round((base+dx*(event.shiftKey?.1:1))*100)/100};
  }else{
    const a=new DOMPoint(g.startX,g.startY).matrixTransform(g.matrix),b=new DOMPoint(event.clientX,event.clientY).matrixTransform(g.matrix);
    const x=Math.round((b.x-a.x)*g.scale),y=Math.round((a.y-b.y)*g.scale);
    values=g.kind==='resize'?{[g.field]:g.row[g.field]+(g.field==='heightMm'?y:x)}:{gapMm:g.row.gapMm+x,bottomMm:g.row.bottomMm+y};
  }
  send({type:'PATCH',values},{keepEditor:true});
  for(const [key,value] of Object.entries(values)){const input=$('#measure-'+key);if(input)input.value=value;}
}
document.addEventListener('pointermove',moveGesture);
function endGesture(cancel=false){
  const g=gesture;if(!g)return;gesture=null;
  if(cancel){state=g.before;render();$('#status').textContent='أُلغي السحب وعادت المسودة إلى حالتها السابقة.';}
  if(g.owner.hasPointerCapture(g.id))g.owner.releasePointerCapture(g.id);
  suppressClick=g.moved;
  if(g.moved)setTimeout(()=>{suppressClick=false;},0);
}
document.addEventListener('pointerup',event=>{if(event.pointerId===gesture?.id){moveGesture(event);endGesture();}});
document.addEventListener('pointercancel',event=>{if(event.pointerId===gesture?.id)endGesture(true);});
document.addEventListener('lostpointercapture',event=>{
  if(event.pointerId!==gesture?.id)return;
  if(event.target!==gesture.owner&&gesture.owner.hasPointerCapture(gesture.id))return;
  endGesture(true);
});
document.addEventListener('pointerdown',event=>{
  if(gesture&&(event.pointerId!==gesture.id||event.button!==0))endGesture(true);
},{capture:true});
window.addEventListener('blur',()=>{if(gesture)endGesture(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gesture)endGesture(true);});
render();
