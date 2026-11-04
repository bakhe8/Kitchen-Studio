import {mountBasic} from './basic.js';
import {mountGeometry} from './geometry.js';
import {mountOperations} from './operations.js';
import {mountInsights} from './insights.js';
import {mountComparisons} from './comparisons.js';
import {mountPhysics} from './physics.js';
import {mountMaterials} from './materials.js';
import {mountExtensions} from './extensions.js';
import {mountContrasts} from './contrasts.js';
import {mountCompletionControls} from './completion-controls.js';
import {mountCompletionHistory} from './completion-history.js';
import {mountPrincipleLab} from './principle-lab.js';
import {createKnowledgeUI,renderExampleKnowledge} from './knowledge-ui.js';
import {getExampleRecord} from './knowledge-model.js';
import {inputExamples} from './input-catalog.js';
import {mountSecondaryDrag} from './channel-scenes.js';
import {mountButtonLab} from './button-lab.js';
import {lessons,learningRoutes} from './learning-guide.js';
import {signalLayers,discriminatingPairs} from './button-map.js';
import {axes,profiles,examples,exampleById,buttonExampleIds,kinds,valueById,referencesFor,filteredExamples,relatedExamples} from './explorer-model.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const n=value=>new Intl.NumberFormat('ar-SA').format(value);
const knowledgeViews=new Set(['rules','map','coverage']);
const paramKeys=['concept','scope','example','family','axis','status','page','rowPage','q','type','construction'];
const state={channel:'primary',view:'lab',id:'button-trace',query:'',kind:'all',filters:new Set(),axis:null,profileAxis:null,knowledge:{},route:null};
let cleanup=()=>{},infoCleanup=()=>{},currentModule=null,generation=0,mountedId=null,results=[];
let completed=new Set();
try{const stored=JSON.parse(localStorage.getItem('drag-lab-completed')||'[]');if(Array.isArray(stored))completed=new Set(stored.filter(id=>exampleById.has(id)));}catch{}
const channelIds={primary:'button-trace',secondary:'secondary-drag',wheel:'wheel-trace'};
const validChannel=c=>Object.hasOwn(channelIds,c)?c:'primary';
const allScenes=[...examples,...inputExamples];
const knowledgeUI=createKnowledgeUI({root:$('#knowledge-view'),examples:allScenes,onExample:openKnowledgeExample,onNavigate:navigateKnowledge});
function openKnowledgeExample(id,channel=state.channel){
  if(!['primary','secondary','wheel'].includes(channel))return;
  if(channel==='primary'&&!exampleById.has(id)||channel!=='primary'&&channelIds[channel]!==id)return;
  if(channel!==state.channel||channel!=='primary'){
    state.channel=channel;state.id=id;state.view='lab';resetSelections();syncUrl();renderPage();
  }else chooseExample(id,false);
  const el=channel==='primary'?$('#experiment'):$('#channel-lab');el.focus({preventScroll:true});el.scrollIntoView({block:'start'});
}
function resetSelections(){state.query='';state.kind='all';state.filters.clear();state.axis=null;state.profileAxis=null;state.route=null;state.knowledge={};}
function scopeHash(c,v,id=channelIds[c]){return '#'+(c==='primary'?'':c+'/')+(knowledgeViews.has(v)?v:'lab/'+id);}

function navigateKnowledge(view,params={},channel=state.channel){
  if(!knowledgeViews.has(view))return;
  const changed=state.view!==view||state.channel!==channel;state.channel=validChannel(channel);
  state.view=view;state.route=null;
  state.knowledge=Object.fromEntries(Object.entries(params).filter(([k,v])=>paramKeys.includes(k)&&v!==undefined&&v!==null&&v!==''));
  syncUrl();renderPage();if(changed){$('#knowledge-view').focus({preventScroll:true});$('#knowledge-view').scrollIntoView({block:'start'});}
}
const routeById=new Map(learningRoutes.map(route=>[route.id,route]));
if(window.matchMedia('(max-width:800px)').matches)$('#library-drawer').open=false;
$('.experiment-column').insertAdjacentHTML('beforeend','<div id="empty-workspace" class="empty-workspace" hidden><span aria-hidden="true">⌕</span><h2>لا يوجد مثال يجمع هذه الشروط.</h2><p>أزل شرطًا أو امسح البحث. عدم وجود تطابق لا يعني أن هذا التركيب مستحيل؛ قد يحتاج مثالًا جديدًا.</p><button type="button" class="primary-button" data-clear>اعرض جميع الأمثلة</button><a href="#coverage">افتح خريطة التغطية</a></div>');

function hashFor(){
  if(knowledgeViews.has(state.view)){const q=new URLSearchParams(state.knowledge);return scopeHash(state.channel,state.view)+(q.size?'?'+q.toString():'');}
  if(state.channel!=='primary')return scopeHash(state.channel,'lab');
  const params=new URLSearchParams();
  if(state.filters.size)params.set('f',[...state.filters].join(','));
  if(state.query)params.set('q',state.query);
  if(state.kind!=='all')params.set('kind',state.kind);
  if(state.route)params.set('route',state.route);
  return '#'+state.view+'/'+state.id+(params.size?'?'+params.toString():'');
}
function syncUrl(replace=false){const hash=hashFor();if(location.hash===hash)return;history[replace?'replaceState':'pushState'](null,'',hash);}
function readRoute(){
  const raw=location.hash.slice(1),[path,query='']=raw.split('?'),params=new URLSearchParams(query);
  const parts=path.split('/'); const channel=['secondary','wheel','primary'].includes(parts[0])?parts.shift():'primary';state.channel=channel;
  const section=parts[0],requestedId=parts[1]||section;
  if(channel!=='primary'){
    resetSelections();state.view=knowledgeViews.has(section)?section:'lab';state.id=channelIds[channel];
    if(knowledgeViews.has(state.view))state.knowledge=Object.fromEntries([...params].filter(([k])=>paramKeys.includes(k)));
    renderPage();return;
  }
  state.view=knowledgeViews.has(section)?section:section==='compare'?'compare':section==='button'?'button':'lab';
  state.knowledge=Object.fromEntries([...params].filter(([k])=>paramKeys.includes(k)));
  const id=requestedId;
  if(exampleById.has(id))state.id=id;else if(!knowledgeViews.has(state.view))state.id=state.view==='compare'?'speed-acceleration':'button-trace';
  if(id==='modifier'){state.view='button';state.id='button-trace';}
  state.filters=new Set((params.get('f')||'').split(',').filter(id=>valueById.has(id)));
  state.query=params.get('q')||'';state.kind=Object.hasOwn(kinds,params.get('kind'))?params.get('kind'):'all';

  state.route=routeById.has(params.get('route'))?params.get('route'):null;
  if(state.route&&!routeById.get(state.route).steps.some(step=>step.id===state.id))state.route=null;
  state.axis=state.filters.size?valueById.get([...state.filters][0]).axis:null;
  if(state.view==='button'){state.filters.clear();state.query='';state.kind='all';state.axis=null;state.route=null;}
  if(id==='modifier')syncUrl(true);
  renderPage();
}
function stopCurrent(){generation++;try{infoCleanup();infoCleanup=()=>{};cleanup();}catch(error){console.error(error);}cleanup=()=>{};currentModule=null;mountedId=null;document.body.classList.remove('dragging');}
function feedback(tone,message,detail=''){
  $('#result-panel').dataset.tone=tone;$('#result-message').textContent=message;$('#result-detail').textContent=detail;
  $('#result-icon').textContent=({ready:'↗',live:'↔',done:'✓',fail:'!'})[tone]||'↗';
  $('#result-phase').textContent=({ready:'جاهز للتجربة',live:'أثناء التفاعل',done:'ظهرت النتيجة',fail:'لم يُعتمد'})[tone]||'';
  if(tone!=='live')$('#status-announcer').textContent=message+' '+detail;
}
function factoryFor(id){
  if(['speed-acceleration','time-responses','capture-release'].includes(id))return mountPrincipleLab;
  if(buttonExampleIds.includes(id))return mountButtonLab;
  if(id==='magnet')return mountCompletionControls;
  if(['history','delete'].includes(id))return mountCompletionHistory;
  if(id.startsWith('compare-'))return mountContrasts;
  if(['turns','dwell','relations','lasso','group'].includes(id))return mountExtensions;
  if(['signals','chain'].includes(id))return mountInsights;
  if(['reveal','timeline','repeat'].includes(id))return mountComparisons;
  if(['momentum','elastic','flow'].includes(id))return mountPhysics;
  if(['brush','mix','gesture','threshold'].includes(id))return mountMaterials;
  if(['move','pan','transform'].includes(id))return mountBasic;
  if(['select','area','path'].includes(id))return mountGeometry;
  return mountOperations;
}
function mountExample(id,force=false){
  if(mountedId===id&&!force){renderProfile();return;}
  stopCurrent();state.id=id;mountedId=id;
  const m=exampleById.get(id),profile=profiles[id],token=generation;
  $('#experiment-title').textContent=m.title;$('#experiment-instruction').textContent=m.instruction;
  $('#experiment-kind').textContent=kinds[profile.kind];$('#experiment-family').textContent=profile.family;
  $('#effect-badge').textContent=m.effect||profile.summary;$('#stage-context').textContent=m.context||'';
  $('#example-focus').textContent=profile.focus;
  const container=$('#demo-stage');container.replaceChildren();container.dataset.mode=id;
  feedback('ready',m.ready,m.detail);
  const api={};for(const kind of ['ready','live','done','fail'])api[kind]=(message,detail='')=>{
    if(token!==generation)return;feedback(kind,message,detail);
    if(kind==='done'){completed.add(id);try{localStorage.setItem('drag-lab-completed',JSON.stringify([...completed]));}catch{}const mark=$(`#example-list [data-example="${id}"] .example-check`);if(mark){mark.textContent='✓';mark.title='جرّبت هذا المثال';}}
  };
  try{const result=factoryFor(id)(id,container,api);currentModule=typeof result==='object'?result:null;cleanup=typeof result==='function'?result:()=>result?.destroy?.();}
  catch(error){console.error(error);feedback('fail','تعذّر تشغيل المثال.','أعد التجربة للمحاولة مجددًا.');}
  $('#watch-example').hidden=!currentModule?.play;
  renderProfile();renderRelated();renderLesson();
  infoCleanup=renderExampleKnowledge($('#example-knowledge'),id,{channel:'primary',onExample:openKnowledgeExample,onNavigate:navigateKnowledge})||(()=>{});
}
function renderLesson(){
  const lesson=lessons[state.id],panel=$('#lesson-panel');
  panel.hidden=!lesson;if(!lesson){panel.replaceChildren();return;}
  const comparison=exampleById.get(lesson.compare.id);
  panel.innerHTML=`<div class="lesson-heading"><h3>اختبر فهمك من المشهد</h3><span>الفكرة · التجربة · الحد</span></div><div class="lesson-grid"><div><span class="lesson-number">١</span><h4>ما الذي يثبته؟</h4><p>${esc(lesson.goal)}</p></div><div><span class="lesson-number">٢</span><h4>جرّب ولاحظ</h4><p>${esc(lesson.tryThis)}</p></div><div><span class="lesson-number">٣</span><h4>حدّ القاعدة</h4><p>${esc(lesson.boundary)}</p></div></div><div class="lesson-compare"><div><strong>قارن مع «${esc(comparison.name)}»</strong><p>${esc(lesson.compare.reason)}</p></div><button type="button" class="quiet-button" data-lesson-compare="${comparison.id}">افتح المقارنة <span aria-hidden="true">←</span></button></div>`;
}
function renderSignalMap(){
  const links=ids=>ids.map(id=>`<button type="button" data-inspect-example="${esc(id)}">${esc(exampleById.get(id)?.name||id)} <span aria-hidden="true">↗</span></button>`).join('');
  $('#signal-layers').innerHTML=signalLayers.map(layer=>`<section class="signal-layer" data-signal-layer="${esc(layer.id)}"><h3>${esc(layer.title)}</h3><p>${esc(layer.description)}</p>${layer.items.map(item=>`<details><summary>${esc(item.label)}</summary><p>${esc(item.detail)}</p><div class="signal-links">${links(item.examples)}</div></details>`).join('')}</section>`).join('');
  $('#signal-pairs').innerHTML=discriminatingPairs.map(pair=>`<details class="signal-pair"><summary>${esc(pair.title)}</summary><dl><dt>نثبّت</dt><dd>${esc(pair.keep)}</dd><dt>نغيّر</dt><dd>${esc(pair.variable)}</dd></dl><p>${esc(pair.tryThis)}</p><div class="signal-links">${links(pair.examples)}</div></details>`).join('');
}
function routeCards(){
  return learningRoutes.map(route=>`<button type="button" class="route-card" data-route="${esc(route.id)}"><span><strong>${esc(route.title)}</strong><small>${n(route.steps.length)} تجارب</small></span><p>${esc(route.question)}</p><b aria-hidden="true">←</b></button>`).join('');
}
function renderRouteCatalog(){
  $('#route-cards').innerHTML=routeCards();
  $('#route-count').textContent=n(learningRoutes.length)+' مسارًا';
}
function renderActiveRoute(){
  const route=routeById.get(state.route),panel=$('#active-route');panel.hidden=!route;
  $('#next-mode').innerHTML=(route?'التجربة التالية في المسار':'المثال التالي')+' <span aria-hidden="true">←</span>';
  if(!route){panel.replaceChildren();return;}
  const current=route.steps.find(step=>step.id===state.id);
  panel.innerHTML=`<div class="active-route-head"><div><span>مسار الفهم</span><h3>${esc(route.title)}</h3><p>${esc(route.question)}</p></div><button class="quiet-button" type="button" data-leave-route>استكشاف حر ×</button></div><nav class="route-steps" aria-label="خطوات المسار">${route.steps.map((step,i)=>`<button type="button" data-route-step="${step.id}" aria-current="${step.id===state.id?'step':'false'}"><span>${n(i+1)}</span>${esc(exampleById.get(step.id).name)}</button>`).join('')}</nav><p class="route-current-note"><strong>في هذا المثال:</strong> ${esc(current?.why||'')}</p><details class="route-takeaway"><summary>الفكرة التي يجمعها المسار</summary><p>${esc(route.takeaway)}</p></details>`;
}
function startRoute(id,stepId){
  const route=routeById.get(id);if(!route)return;
  state.route=id;state.view='lab';state.filters.clear();state.query='';state.kind='all';state.axis=null;
  state.id=route.steps.some(step=>step.id===stepId)?stepId:route.steps[0].id;
  $('#route-picker').open=false;syncUrl();renderPage();$('#active-route [aria-current="step"]')?.focus({preventScroll:true});$('#active-route').scrollIntoView({block:'start',behavior:'instant'});
}
function leaveRoute(){state.route=null;renderActiveRoute();}
function renderProfile(){
  const profile=profiles[state.id];if(!profile)return;
  $('#profile-layers').innerHTML=axes.map((axis,index)=>{
    const tags=[...(profile.axes[axis.id]||[]),...(profile.partial?.[axis.id]||[])];
    const labels=tags.slice(0,2).map(id=>valueById.get(id)?.label).filter(Boolean).join(' · ');
    return `<button type="button" class="profile-layer ${state.profileAxis===axis.id?'active':''}" data-profile-axis="${axis.id}" aria-expanded="${state.profileAxis===axis.id}"><span><i>${n(index+1)}</i>${esc(axis.label)}</span><strong>${esc(labels)}${tags.length>2?` <small>+${n(tags.length-2)}</small>`:''}</strong></button>`;
  }).join('');
  const detail=$('#profile-detail');detail.hidden=!state.profileAxis;
  if(!state.profileAxis){detail.replaceChildren();return;}
  const axis=axes.find(a=>a.id===state.profileAxis)||axes[0];
  const full=profile.axes[axis.id]||[],partial=profile.partial?.[axis.id]||[];
  $('#profile-detail').innerHTML=`<div class="profile-explanation"><strong>${esc(axis.question)}</strong><p>${esc(profile.explanations[axis.id])}</p></div><div class="profile-tags">${[...full,...partial].map(id=>{const v=valueById.get(id);return `<button type="button" data-filter="${esc(id)}" class="taxonomy-tag ${partial.includes(id)?'partial':''}" title="اعرض الأمثلة التي تتضمن: ${esc(v.label)}">${esc(v.label)}${partial.includes(id)?'<small>جزئي</small>':''}<span aria-hidden="true">↗</span></button>`;}).join('')}</div>`;
}
function renderRelated(){
  const related=relatedExamples(state.id);
  $('#related-examples').innerHTML=related.length?related.map(m=>`<button type="button" data-related="${m.id}"><span>${esc(m.name)}</span><small>${esc(profiles[m.id].family)}</small><b aria-hidden="true">←</b></button>`).join(''):'<p>هذه القاعدة تحتاج أمثلة إضافية للمقارنة. يمكنك استكشافها من خريطة التغطية.</p>';
}
function renderFilters(){
  $('#axis-tabs').innerHTML=axes.map((a,i)=>`<button role="tab" type="button" id="axis-${a.id}" aria-selected="${state.axis===a.id}" aria-controls="facet-options" data-axis="${a.id}"><span>${n(i+1)}</span>${esc(a.label)}<i aria-hidden="true">${state.axis===a.id?'−':'+'}</i></button>`).join('');
  const axis=axes.find(a=>a.id===state.axis),options=$('#facet-options');options.hidden=!axis;
  if(axis){options.setAttribute('aria-labelledby','axis-'+axis.id);options.innerHTML=`<p>${esc(axis.description)}</p><div>${axis.values.filter(v=>v.scope!=='extension').map(v=>{const refs=referencesFor(v.id),count=refs.full.length+refs.partial.length;return `<button type="button" data-filter="${esc(v.id)}" aria-pressed="${state.filters.has(v.id)}" class="facet-chip ${state.filters.has(v.id)?'selected':''} ${!count?'unrepresented':''}">${esc(v.label)}<small>${count?n(count):'—'}</small></button>`;}).join('')}</div>`;}
  const selected=$('#selected-filters');selected.hidden=!state.filters.size;
  selected.innerHTML=`<span>تجارب تجمع:</span>${[...state.filters].map(id=>`<button type="button" data-filter="${esc(id)}">${esc(valueById.get(id).label)} <b aria-hidden="true">×</b></button>`).join('<i>+</i>')}`;
  $('#show-all').hidden=!state.filters.size&&!state.query&&state.kind==='all';
}
function renderLibrary(){
  results=filteredExamples({view:state.view,query:state.query,kind:state.kind,filters:state.filters});
  $('#results-count').textContent=state.view==='button'?'تجربتان لفهم الإشارة':n(results.length)+' من '+n(examples.length)+' تجربة';$('#library-summary-count').textContent=n(results.length);
  $('#example-list').innerHTML=results.length?results.map((m,index)=>`<button type="button" class="example-item" data-example="${m.id}" aria-current="${state.id===m.id}"><span class="example-index">${String(index+1).padStart(2,'0')}</span><span class="example-name">${esc(m.name)}<small>${esc(getExampleRecord(m.id)?.scope==='tool'?'أداة بعد الضغطة':kinds[profiles[m.id].kind])}</small></span><span class="example-check" title="${completed.has(m.id)?'جرّبت هذا المثال':''}">${completed.has(m.id)?'✓':'↗'}</span></button>`).join(''):'<div class="empty-list"><p>لا توجد نتائج بهذه الشروط.</p><button type="button" data-clear>إزالة التصفية</button></div>';
  const empty=!results.length;$('#experiment').hidden=empty;$('.related-section').hidden=empty;$('#empty-workspace').hidden=!empty;
  if(empty){stopCurrent();return;}
  if(!results.some(m=>m.id===state.id)){state.id=results[0].id;syncUrl(true);renderLibrary();return;}
  mountExample(state.id);
}
const channelCopy={
  secondary:{eyebrow:'الزر الثانوي وحده · ضغط وسحب وإفلات',title:'هل يتغيّر مبدأ السحب إذا تغيّر الزر؟',instructions:'اضغط بالزر الثانوي على الصندوق، وانقله مع استمرار الضغط، ثم أفلت.',stage:'تتبّع الإزاحة',task:'ابدأ من حافة الصندوق. أثناء السحب راقب المسافة من موضع الضغط وموضع الصندوق الناتج، ثم أعده باتجاه البداية.',boundary:'الزر الأساسي لا يبدأ تسجيلًا هنا. يمكن أن يظل المؤشر ساكنًا والزر الثانوي مضغوطًا. لا تدخل البكرة أو ضغطة ثانية في هذه التجربة.',comparison:'في تجربة «نقل عنصر» تبدأ الحركة بالزر الأساسي. تستخدم التجربتان الإزاحة لنقل عنصر داخل حدوده، مع اختلاف الزر الذي يبدأ التسجيل.',against:'move',link:'غادر إلى الزر الأساسي: نقل عنصر ←'},
  wheel:{eyebrow:'تدوير البكرة وحدها · بلا ضغط',title:'كيف تتغيّر الكمية والمؤشر ثابت؟',instructions:'ضع المؤشر فوق مساحة التدوير وأدر البكرة دون الضغط عليها. قارن مقدار كل حدث ووحدته بالكمية الناتجة.',stage:'سجل التدوير والكمية',task:'دوّر في اتجاه ثم اعكسه. لاحظ الإشارة الموجبة أو السالبة. انتظر قليلًا ثم دوّر مجددًا: تبدأ مجموعة جديدة وتبقى الكمية السابقة.',boundary:'تدوير البكرة يختلف عن ضغطها كزر أوسط. مهلة الصمت قرار للمختبر وليست إشارة إفلات. تمرير الصفحة خارج سطح التجربة لا يغيّر الكمية.',comparison:'في «ضبط قيمة» يحدّد موقع المقبض القيمة. هنا نضيف التغيّر إلى القيمة السابقة؛ يمكن تغيير الكمية مع بقاء المؤشر في موضعه.',against:'value',link:'غادر إلى الزر الأساسي: ضبط قيمة ←'}
};
function renderChannelScene(){
  const c=state.channel,id=channelIds[c],m=channelCopy[c];if(mountedId===id)return;
  stopCurrent();mountedId=id;state.id=id;
  for(const [el,key] of [['channel-eyebrow','eyebrow'],['channel-title','title'],['channel-instructions','instructions'],['channel-stage-label','stage'],['channel-task','task'],['channel-boundary','boundary'],['channel-comparison','comparison']])$('#'+el).textContent=m[key];
  $('#channel-counterpart').textContent=m.link;$('#channel-counterpart').href=scopeHash('primary','lab',m.against);
  $('#channel-coverage').href=scopeHash(c,'coverage')+'?scope=example&example='+id;
  const panel=$('#channel-result');panel.textContent='';const token=generation;
  const report=text=>{if(token===generation)panel.textContent=text;};
  const container=$('#channel-stage');container.replaceChildren();container.dataset.mode=id;
  if(c==='secondary')currentModule=mountSecondaryDrag(container,report);
  else import('./wheel-scene.js').then(({mountWheelTrace})=>{if(token===generation)currentModule=mountWheelTrace(container,report);}).catch(error=>{if(token===generation){console.error(error);report('تعذّر فتح مساحة التدوير.');}});
  cleanup=()=>currentModule?.destroy();infoCleanup=renderExampleKnowledge($('#channel-example-knowledge'),id,{channel:c,onExample:openKnowledgeExample,onNavigate:navigateKnowledge})||(()=>{});
}
$('#channel-play').addEventListener('click',()=>currentModule?.play?.());$('#channel-reset').addEventListener('click',()=>currentModule?.reset?.());
function renderPage(){
  if(state.view==='compare')state.kind='all';
  document.body.dataset.view=state.view;document.body.dataset.channel=state.channel;
  const isPrimary=state.channel==='primary';
  document.title=isPrimary?'أطلس السحب — الزر الأساسي':state.channel==='secondary'?'أطلس السحب — الزر الثانوي':'أطلس السحب — تدوير البكرة';
  document.querySelectorAll('.input-switch a').forEach(a=>{a.href=scopeHash(a.dataset.channel,state.view);if(a.dataset.channel===state.channel)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  $('.atlas-tabs').querySelectorAll('a').forEach(a=>{a.href=scopeHash(state.channel,a.dataset.view);});
  const isKnowledge=knowledgeViews.has(state.view);
  $('#knowledge-view dialog[open]')?.close();
  $('.skip').textContent=isKnowledge?'انتقل إلى محتوى الدليل':'انتقل إلى التجربة';
  $('.atlas-tabs').querySelectorAll('a').forEach(a=>{if(a.dataset.view===(isKnowledge?state.view:'lab'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('.experiment-views').querySelectorAll('a').forEach(a=>{if(a.dataset.mode===state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#lab-view').hidden=isKnowledge||!isPrimary;$('#channel-lab').hidden=isKnowledge||isPrimary;$('#knowledge-view').hidden=!isKnowledge;
  $('.atlas-intro').hidden=isKnowledge||!isPrimary;
  $('#signal-foundation').hidden=state.view!=='button';$('#single-button-pairs').hidden=state.view!=='button';
  $('#comparison-questions').hidden=state.view!=='compare';
  if(isKnowledge){stopCurrent();knowledgeUI.render(state.view,{...state.knowledge},state.channel);return;}
  if(!isPrimary){renderChannelScene();return;}
  $('#example-search').value=state.query;$('#kind-filter').value=state.kind;$('#kind-filter').disabled=state.view==='compare';
  $('#workspace-heading').textContent=state.view==='button'?'راقب ضغطة واحدة':state.view==='compare'?'قارن بين تفسيرين':'اختر تجربة';
  $('#workspace-caption').textContent=state.view==='button'?'الزمن والحركة يُقرآن معًا.':state.view==='compare'?'اقرأ ما نثبّته وما نغيّره في كل مقارنة.':'جرّب الحركة، ثم افحص ما تثبته.';
  renderFilters();renderLibrary();renderActiveRoute();
}
function chooseExample(id,keepFilters=true){
  if(!exampleById.has(id))return;
  if(state.route&&!routeById.get(state.route).steps.some(step=>step.id===id))leaveRoute();
  if(!keepFilters){state.filters.clear();state.query='';state.kind='all';state.axis=null;}
  if(knowledgeViews.has(state.view)||(state.view==='compare'&&profiles[id].kind!=='comparison')||(state.view==='button'&&!buttonExampleIds.includes(id)))state.view='lab';
  state.id=id;syncUrl();renderPage();
}
function toggleFilter(id){
  if(!valueById.has(id))return;
  leaveRoute();
  if(state.view==='button')state.view='lab';
  state.filters.has(id)?state.filters.delete(id):state.filters.add(id);
  state.axis=valueById.get(id).axis;
  syncUrl(true);renderPage();
}
function clearFilters(){state.filters.clear();state.query='';state.kind='all';state.axis=null;$('#example-search').value='';$('#kind-filter').value='all';syncUrl(true);renderFilters();renderLibrary();}
$('#axis-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-axis]');if(!button)return;state.axis=state.axis===button.dataset.axis?null:button.dataset.axis;renderFilters();});
$('#axis-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...$('#axis-tabs').querySelectorAll('button')],at=buttons.indexOf(document.activeElement);if(at<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowLeft'?1:-1)+buttons.length)%buttons.length;state.axis=buttons[next].dataset.axis;renderFilters();$('#axis-'+state.axis).focus();});
$('#profile-layers').addEventListener('click',event=>{const button=event.target.closest('[data-profile-axis]');if(!button)return;state.profileAxis=state.profileAxis===button.dataset.profileAxis?null:button.dataset.profileAxis;renderProfile();});
for(const el of [$('#facet-options'),$('#selected-filters'),$('#profile-detail')])el.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button)toggleFilter(button.dataset.filter);});
$('#example-list').addEventListener('click',event=>{const button=event.target.closest('[data-example]');if(button)chooseExample(button.dataset.example);});
$('#related-examples').addEventListener('click',event=>{const button=event.target.closest('[data-related]');if(button)openKnowledgeExample(button.dataset.related);});
$('#example-search').addEventListener('input',event=>{leaveRoute();state.query=event.target.value;syncUrl(true);renderFilters();renderLibrary();});
$('#kind-filter').addEventListener('change',event=>{leaveRoute();state.kind=event.target.value;syncUrl(true);renderFilters();renderLibrary();});
$('#show-all').addEventListener('click',clearFilters);
$('#lab-view').addEventListener('click',event=>{if(event.target.closest('[data-clear]'))clearFilters();});
$('#reset').addEventListener('click',()=>mountExample(state.id,true));
$('#watch-example').addEventListener('click',()=>{const token=generation;try{const run=currentModule?.play?.();run?.catch?.(error=>{if(token===generation){console.error(error);feedback('fail','توقف العرض التلقائي.','أعد المثال أو جرّبه بيدك.');}});}catch(error){console.error(error);feedback('fail','تعذّر العرض التلقائي.','أعد المثال أو جرّبه بيدك.');}});
$('#next-mode').addEventListener('click',()=>{const route=routeById.get(state.route);if(route){const at=route.steps.findIndex(step=>step.id===state.id);startRoute(route.id,route.steps[(at+1)%route.steps.length].id);return;}if(results.length){const at=results.findIndex(m=>m.id===state.id);chooseExample(results[(at+1)%results.length].id);}});
$('#route-cards').addEventListener('click',event=>{const button=event.target.closest('[data-route]');if(button)startRoute(button.dataset.route);});
$('#active-route').addEventListener('click',event=>{const step=event.target.closest('[data-route-step]');if(step)startRoute(state.route,step.dataset.routeStep);if(event.target.closest('[data-leave-route]')){leaveRoute();syncUrl(true);$('#route-picker > summary').focus();}});
$('#lesson-panel').addEventListener('click',event=>{const button=event.target.closest('[data-lesson-compare]');if(button){chooseExample(button.dataset.lessonCompare,false);$('#experiment').focus({preventScroll:true});$('#experiment').scrollIntoView({block:'start',behavior:'instant'});}});
for(const selector of ['#signal-layers','#signal-pairs'])$(selector).addEventListener('click',event=>{const button=event.target.closest('[data-inspect-example]');if(button){chooseExample(button.dataset.inspectExample,false);$('#experiment').focus({preventScroll:true});$('#experiment').scrollIntoView({block:'start',behavior:'instant'});}});
$('.skip').addEventListener('click',event=>{event.preventDefault();if(knowledgeViews.has(state.view)){$('#knowledge-view').focus();$('#knowledge-view').scrollIntoView();}else{const el=$(state.channel==='primary'?'#experiment':'#channel-lab');el.focus();el.scrollIntoView({block:'start'});}});
window.addEventListener('hashchange',readRoute);window.addEventListener('popstate',readRoute);window.addEventListener('pagehide',stopCurrent);
window.addEventListener('pageshow',event=>{if(event.persisted)renderPage();});
renderSignalMap();renderRouteCatalog();readRoute();
