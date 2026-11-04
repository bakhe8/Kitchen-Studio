import * as assistEngine from './kitchen-assist-engine.js';
import {readVisitContext,saveVisitContext,clearVisitContext} from './kitchen-assist-visit.js';
const {buildAssistant,applyAnswer}=assistEngine;

import {relatedInputs} from './kitchen-assist-related.js';

const tracks=[
 ['site','رفع الغرفة'],['services','الفتحات والخدمات'],['equipment','فتحة غسالة الصحون'],['customer','احتياجات العميل'],['production','التصنيع والتركيب']
];
const enc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeral=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}),fmt=v=>typeof v==='number'?numeral.format(v):v===true?'نعم':v===false?'لا':String(v??'');
const bdi=v=>'<bdi>'+enc(fmt(v))+'</bdi>';
const attrs=(name,val)=>' '+name+'="'+enc(val)+'"';
const state=q=>q?.evidence?.state||'missing',has=v=>v!==undefined&&v!==null&&v!=='';
const optionPairs=q=>(q.options||[]).map(o=>typeof o==='object'?{value:o.value,label:o.label??o.value}:{value:o,label:o});
function displayed(v,q){if(!has(v))return 'لم تُحسم';const o=optionPairs(q||{}).find(o=>String(o.value)===String(v));return fmt(o?o.label:v)+(q?.unit?' '+q.unit:'');}
const origin=f=>String(f?.source||'');
function describe(f){return '<div class="ka-fact"><dt>'+enc(f.label)+'</dt><dd>'+bdi(f.value)+(f.unit?' <small>'+enc(f.unit)+'</small>':'')+'</dd>'+(origin(f)?'<small class="ka-origin">'+enc(origin(f))+'</small>':'')+'</div>';}
const list=(a)=>Array.isArray(a)?a:[];
const recordStateLabel={assumed:'افتراضي', 'assumed-na':'مستبعد من التقدير',known:'مسجّل',unknown:'غير معروف',conflict:'تعارض',preliminary:'مبدئي',na:'لا ينطبق'};
const spans=(a,b)=>'<span>'+enc(a)+'</span><strong>'+bdi(b)+'</strong>';
const signs={site:'M4 20V4h15v7h-5v9zM4 15h3M8 4v3',services:'M4 6h7v4h8v6h-4v-3H8V9H4z M17 18c-2 2-2 3 0 3s2-1 0-3',equipment:'M4 4h16v17H4z M4 8h16 M8 6h1 M9 13h6',customer:'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20v-3c0-5 10-5 10 0v3 M15 8h6m-6 4h5m-4 4h4',production:'M3 11l6-3v4l6-4v4l6-4v12H3z M5 10V4h3v5'};
const icon=t=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+signs[t]+'"/></svg>';
const promiseLike=x=>x&&typeof x.then==='function';
const qIdentity=(t,s,q)=>JSON.stringify([t,s,q?.id,q?.itemId,q?.code]);

export function mountFieldAssistant(host,{getDoc,apply,onCatalog,onRecords,getProjectKey,onUndo,initialTopic='site',initialEntityId='',initialQuestionId='',onContext,onDirty,canEditInput=()=>true}={}){
 let topic=tracks.some(([k])=>k===initialTopic)?initialTopic:'site',snap=null,boundDoc=null,boundProject=getProjectKey?.(),editing=initialQuestionId||null,draft=null,lastCommit=null,pending=null,stale=false;
 let status='',tone='ok',busy=false,dead=false,visitDraft=null,lastKind='answer';
 let notified='';const scopeByTopic=new Map(initialEntityId?[[topic,String(initialEntityId)]]:[]),skipped=new Map(),openSections=new Set();
 const elem=s=>host.querySelector(s),groupKey=()=>JSON.stringify([topic,snap?.entityId||'']);
 const mkbutton=(op,title,css='',data='')=>'<button type="button" class="'+css+'" data-ka-do="'+op+'"'+data+'>'+title+'</button>';
 const visibleTracks=()=>tracks.filter(([id])=>canEditInput(id==='production'?'MFG-01':'SITE-03'));
 const opts=()=>({entityId:scopeByTopic.get(topic)||''});
 const choose=()=>{if(!snap)return null;if(editing){const found=list(snap.answers).find(q=>q.id===editing);if(found)return found;editing=null;}const seen=skipped.get(groupKey());return list(snap.questions).find(q=>!seen?.has(q.id))||null;};
 const anyDirty=()=>!!(draft||visitDraft);
 function changedDirty(next){const was=anyDirty();draft=next;if(was!==anyDirty())onDirty?.(anyDirty());}
 function setVisitDraft(next){const was=anyDirty();visitDraft=next;if(was!==anyDirty())onDirty?.(anyDirty());}
 function scrollQuestion(){const node=elem('[data-ka-prompt]')||elem('[data-ka-complete]');node?.focus?.({preventScroll:true});const pane=host.closest?.('.fr-main');if(pane)pane.scrollTop=0;}
 function setStatus(t,kind='ok'){status=t;tone=kind;const n=elem('[data-ka-message]');if(n){n.textContent=t;n.hidden=!t;n.dataset.kind=kind;}}
 function resetIfOtherProject(){const key=getProjectKey?.();if(key===boundProject)return false;boundProject=key;scopeByTopic.clear();skipped.clear();lastCommit=null;editing=null;notified='';return true;}
 function snapshot(){if(!visibleTracks().some(([id])=>id===topic))topic=visibleTracks()[0]?.[0]||'site';snap=buildAssistant(getDoc(),topic,opts());for(const key of ['answers','questions','deferred'])snap[key]=list(snap[key]).filter(q=>canEditInput(q.code));boundDoc=getDoc();if(snap.entityId!==undefined&&snap.entityId!==null)scopeByTopic.set(topic,String(snap.entityId));const sig=JSON.stringify([topic,snap.entityId??'']);if(sig!==notified){notified=sig;onContext?.({topic,entityId:snap.entityId??''});}}
 function sources(title,a,key,inline=0){if(!a.length)return '';const rem=a.slice(inline);let html=inline?'<section class="ka-recap" aria-label="'+enc(title)+'"><h4>'+enc(title)+'</h4><dl class="ka-facts">'+a.slice(0,inline).map(describe).join('')+'</dl>':'';if(rem.length){const label=inline?'بقية النتائج':title;html+='<details class="ka-disclosure" data-ka-details="'+key+'"'+(openSections.has(key)?' open':'')+'><summary>'+enc(label)+' <small>'+bdi(rem.length)+'</small></summary><dl class="ka-facts">'+rem.map(describe).join('')+'</dl></details>';}return html+(inline?'</section>':'');}
 function card(q,preview){
  const st=state(q),cv=q.evidence?.value,correct=editing===q.id,options=optionPairs(q),bool=q.type==='boolean';
  let stamp=st==='conflict'?'قراءات متعارضة':correct&&q.optional&&st==='missing'?'توثيق قياس الموقع':correct?'مراجعة إجابة':st==='preliminary'?'قراءة تحتاج مراجعة':'السؤال التالي';
  let h='<section class="ka-card" data-state="'+enc(st)+'"><div class="ka-card-head"><span class="ka-kicker"><i></i>'+stamp+'</span>'+(q.unit?'<b class="ka-u">'+enc(q.unit)+'</b>':'')+'</div><h3 tabindex="-1" data-ka-prompt>'+enc(q.label)+'</h3>';
  if(preview)h+='<div class="ka-observed"><strong>'+enc(preview.label)+'</strong><b>'+bdi(preview.value)+'</b><small>'+enc(preview.source)+'</small></div>';
  if(q.hint)h+='<p class="ka-tip">'+enc(q.hint)+'</p>';
  if(st==='conflict'){
    const rs=list(q.evidence?.records);h+='<div class="ka-alert"><b>حدّد القراءة التي تؤكّدها الآن.</b>'+rs.slice(0,4).map(r=>'<div>'+enc(String(r.itemId||'')+' · '+(r.source||r.readingRef||'قراءة مسجلة'))+': '+bdi(displayed(r.value,r))+'</div>').join('')+'</div>';
  }else if(correct&&has(cv))h+='<p class="ka-prior">'+(st==='assumed'||st==='assumed-na'?'القيمة الافتراضية':'القيمة المسجّلة')+': <b>'+bdi(displayed(cv,q))+'</b></p>';
  const hasDefault=has(q.defaultValue)&&st!=='conflict'&&(!correct||!has(cv));
  if(hasDefault)h+='<div class="ka-design">'+spans(q.defaultSource||'اقتراح من الرسم',displayed(q.defaultValue,q))+'</div>';
  const field=(!draft||draft.key!==qIdentity(topic,snap.entityId,q))?(correct&&has(cv)?String(cv):''):draft.value;
  const saveLabel=st==='conflict'?'حسم التعارض بهذه القراءة':correct?'حفظ التعديل':q.verification==='measured'?'تسجيل القياس':'تسجيل الإجابة';
  if(bool||q.type==='choice'&&options.length&&options.length<=6){
   const choices=bool?[{value:true,label:'نعم'},{value:false,label:'لا'}]:options;
   h+='<div class="ka-decisions" role="group" aria-label="'+enc(q.label)+'">'+choices.map((o,i)=>mkbutton('choose',enc(o.label),'ka-answer'+(correct&&String(cv)===String(o.value)?' ka-current':''),attrs('data-ka-opt',i))).join('')+'</div>';
  }else{
   const longChoice=q.type==='choice'&&options.length>6,t=q.type==='number'?'decimal':'text';
   const control=longChoice?'<select id="ka-input-value" data-ka-input required><option value="">اختر…</option>'+options.map(o=>'<option value="'+enc(o.value)+'"'+(String(o.value)===field?' selected':'')+'>'+enc(o.label)+'</option>').join('')+'</select>':'<input id="ka-input-value" data-ka-input type="text" inputmode="'+t+'" dir="'+(q.type==='number'?'ltr':'auto')+'" autocomplete="off" required value="'+enc(field)+'" placeholder="'+enc(q.placeholder||(q.type==='number'?'أدخل القيمة':'اكتب الإجابة'))+'">';
   h+='<form class="ka-input-form"><label for="ka-input-value">'+(q.type==='number'?'القيمة'+(q.unit?' ('+enc(q.unit)+')':''):'الإجابة')+'</label><div>'+control+'<button type="submit" data-ka-submit>'+saveLabel+'</button></div></form>';
  }
  if(hasDefault&&!bool&&q.type!=='choice')h+=mkbutton('match',q.verification==='measured'?'قستُه ووجدته مطابقًا للرسم':'اعتماد القيمة المعروضة','ka-text ka-match');
  h+='<div class="ka-row-actions">'+(st==='conflict'?mkbutton('defer-conflict','مراجعة لاحقًا','ka-text'):mkbutton('unknown','لا أعرف الآن','ka-text'))+(correct?mkbutton('next','العودة للسؤال التالي','ka-text'):'')+'</div></section>';return h;
 }
 function safeRefresh(nextFocus=false){
  if(dead||busy)return;const other=resetIfOtherProject();
  if(anyDirty()&&(other||getDoc()!==boundDoc)){stale=true;setStatus('تغيّر المشروع أثناء الكتابة. راجع السؤال قبل التسجيل.','warn');const b=elem('[data-ka-stale]');if(b)b.hidden=false;return;}
  snapshot();const q=choose(),entities=list(snap.scopeChoices).length?snap.scopeChoices:list(snap.entities).map(v=>({value:v.id,label:v.label}));
  let h='<section class="ka-shell" dir="rtl"><div class="ka-context">'+icon(topic)+'<label>مهمة الفني<select data-ka-topic>'+visibleTracks().map(([v,l])=>'<option value="'+v+'"'+(v===topic?' selected':'')+'>'+l+'</option>').join('')+'</select></label></div>';
  if(entities.length>1)h+='<label class="ka-scope">'+enc(({equipment:'الغسالة محل الفحص',services:'الفتحة أو الخدمة',customer:'محور الحديث مع العميل',production:'موضوع المراجعة'})[topic]||'العنصر محل المراجعة')+'<select data-ka-scope>'+entities.map(v=>'<option value="'+enc(v.value)+'"'+(String(v.value)===String(snap.entityId)?' selected':'')+'>'+enc(v.label)+'</option>').join('')+'</select></label>';
  if(entities.length===1)h+='<p class="ka-single">'+enc(entities[0].label)+'</p>';
  h+='<p role="status" aria-live="polite" data-ka-message data-kind="'+tone+'"'+(status?'':' hidden')+'>'+enc(status)+'</p><div class="ka-pending" data-ka-pending hidden></div><div class="ka-pending" data-ka-stale hidden>'+mkbutton('discard-stale','مراجعة النسخة الحالية','')+'</div>';
  const pendingCount=list(snap.deferred).filter(x=>state(x)==='unknown').length+(skipped.get(groupKey())?.size||0);
  const designPreview=q&&((topic==='site'||topic==='services')||q.options?.some?.(o=>o.value==='match'))?list(snap.known).find(f=>f.kind==='design'):null;
  const preliminary=topic==='equipment'&&list(snap.derived).some(f=>String(f.label).includes('مبدئ'))&&list(snap.answers).some(f=>f.id==='top'&&f.optional&&state(f)==='missing');
  if(q)h+=card(q,designPreview);else h+='<section class="ka-card ka-complete"><div class="ka-card-head"><span class="ka-kicker"><i></i>هذه المهمة</span></div><h3 tabindex="-1" data-ka-complete>'+(pendingCount?'انتهت الأسئلة المتاحة الآن':preliminary?'الحساب المبدئي جاهز':snap.estimating?'التقدير جاهز بالافتراضيات':'لا يلزم إدخال آخر الآن')+'</h3><p class="ka-tip">'+(pendingCount?'يمكنك العودة إلى القيم المؤجلة أدناه عند توفرها.':preliminary?'منسوب أسفل السطح من الرسم. تستطيع توثيقه بقياس الموقع أدناه.':snap.estimating?'عدّل ما يختلف فقط.':'راجع النتيجة أو اختر مهمة أخرى.')+'</p></section>';
  const results=list(snap.derived);h+=sources('ما حسبه البرنامج',topic==='equipment'?[...results].reverse():results,'derived',2);
  if(topic==='site'&&snap.roomProposal){const p=snap.roomProposal;h+='<section class="ka-proposal"><strong>'+enc(p.label||'يوجد فرق بين الرفع والرسم')+'</strong>'+(Number.isFinite(p.fromMM)&&Number.isFinite(p.toMM)?'<p>من '+bdi(p.fromMM)+' إلى '+bdi(p.toMM)+' مم</p>':p.summary||p.preview?'<p>'+enc(p.summary||p.preview)+'</p>':'')+(p.source?'<small>'+enc(p.source)+'</small>':'')+mkbutton('apply-room','تطبيق القياس على رسم الغرفة','ka-proposal-button')+'</section>';}
  const notes=list(snap.notes);if(notes.length)h+='<aside class="ka-notes">'+notes.slice(0,3).map(v=>'<p>'+(v.label?'<b>'+enc(v.label)+' </b>':'')+enc(v.value??v.text??(typeof v==='string'?v:''))+(v.source?' <small>'+enc(v.source)+'</small>':'')+'</p>').join('')+'</aside>';
  h+=sources('من الرسم والقراءات المسجّلة',list(snap.known).filter(f=>f!==designPreview&&f.kind!=='default'),'known',0);
  const used=list(snap.answers).filter(x=>['assumed','assumed-na'].includes(state(x))&&x.id!==editing);
  if(used.length)h+='<details class="ka-disclosure" data-ka-details="assumptions"'+(openSections.has('assumptions')?' open':'')+'><summary>الافتراضيات المستخدمة · تعديل الاستثناء <small>'+bdi(used.length)+'</small></summary><div class="ka-review">'+used.map(x=>mkbutton('edit','<span>'+enc(x.property)+'</span><b>'+bdi(state(x)==='assumed-na'?'مستبعد':displayed(x.evidence.value,x))+'</b>','',attrs('data-ka-qid',x.id))).join('')+'</div></details>';
  const optional=list(snap.answers).filter(x=>x.optional&&state(x)==='missing'&&editing!==x.id);
  if(optional.length)h+='<div class="ka-optional">'+optional.map(x=>mkbutton('edit','<span>إدخال قياس فعلي</span> · '+enc(x.property||x.label),'ka-text',attrs('data-ka-qid',x.id))).join('')+'</div>';
  const done=list(snap.answers).filter(x=>!['missing','assumed','assumed-na'].includes(state(x))||skipped.get(groupKey())?.has(x.id));
  if(done.length)h+='<details class="ka-disclosure" data-ka-details="answers"'+(openSections.has('answers')?' open':'')+'><summary>مراجعة الإجابات <small>'+bdi(done.length)+'</small></summary><div class="ka-review">'+done.map(x=>mkbutton('edit','<span>'+enc(x.label)+'</span><b>'+bdi(x.evidence?.state==='unknown'?'مؤجّل':x.evidence?.state==='conflict'?'يحتاج مراجعة':has(x.evidence?.value)?displayed(x.evidence.value,x):recordStateLabel[state(x)]||'مؤجّل')+'</b>','',attrs('data-ka-qid',x.id))).join('')+'</div></details>';
  const related=typeof onCatalog==='function'?relatedInputs(getDoc(),topic,opts(),snap).filter(q=>canEditInput(q.code)).slice(0,3):[];
  if(related.length)h+='<details class="ka-disclosure" data-ka-details="related"'+(openSections.has('related')?' open':'')+'><summary>بنود مرتبطة بهذه المهمة</summary><div class="ka-related">'+related.map(x=>mkbutton('related','<strong>'+enc(x.name)+'</strong><small>'+enc(x.why||'')+'</small>','',attrs('data-ka-code',x.code))).join('')+'</div></details>';
  if(onUndo&&lastCommit&&getDoc().room===lastCommit.room&&getDoc().kitchen===lastCommit.kitchen)h+=mkbutton('undo',lastKind==='room'?'تراجع عن تطبيق القياس':'تراجع عن آخر إجابة','ka-text ka-undo');
  const visit=visitDraft||readVisitContext(getDoc()),mInput=(key,title,type,len)=>'<label>'+title+'<input type="'+type+'" name="'+key+'" data-ka-meta="'+key+'" maxlength="'+len+'" value="'+enc(visit[key])+'"></label>';
  h+='<details class="ka-disclosure" data-ka-details="visit"'+(openSections.has('visit')?' open':'')+'><summary>بيانات هذه الزيارة'+(visit.responsible||visit.date||visit.revision?' <small>•</small>':'')+'</summary><form class="ka-visit"><p>اختيارية للقراءات الجديدة في تبويب المشروع الحالي.</p><div>'+mInput('responsible','اسم الفني','text',180)+mInput('date','تاريخ الزيارة','date',10)+mInput('revision','اسم الزيارة أو المراجعة','text',180)+'</div><menu><button type="submit">حفظ بيانات الزيارة</button>'+mkbutton('clear-visit','مسح بيانات الزيارة','ka-text')+'</menu></form></details>';
  h+='</section>';host.innerHTML=h;if(nextFocus)scrollQuestion();
 }
 function runChange(fn){
  if(!anyDirty()){pending=null;fn();return;}
  pending=fn;const node=elem('[data-ka-pending]');if(node){node.hidden=false;node.innerHTML='<span>هناك إجابة لم تُسجّل.</span>'+mkbutton('keep','متابعة الكتابة','')+mkbutton('leave','تجاهلها ومتابعة','ka-leave');node.querySelector('button')?.focus();}
 }
 function move(t,id){if(!visibleTracks().some(([key])=>key===t))return;editing=null;setStatus('');if(t!==topic)topic=t;if(id!==undefined)scopeByTopic.set(topic,id);openSections.clear();safeRefresh(true);}
 function commit(raw,flags={}){
  if(dead||busy||stale)return;if(getDoc()!==boundDoc||getProjectKey?.()!==boundProject){stale=true;const n=elem('[data-ka-stale]');if(n)n.hidden=false;setStatus('تغيّرت بيانات المشروع. راجع النسخة الحالية قبل حفظ الإجابة.','warn');return;}
  if(visitDraft){setStatus('احفظ بيانات الزيارة المكتوبة أولًا، أو امسحها لتسجيل الإجابة بدونها.','warn');return;}
  const q=choose();if(!q||!canEditInput(q.code)){setStatus('هذا المدخل خارج صلاحية التعديل الحالية.','error');return;}const d=getDoc(),answerOpts={...opts(),...flags,visit:readVisitContext(d),...(state(q)==='conflict'?{resolve:true}:{})};let out;
  try{out=applyAnswer(d,topic,q.id,raw,answerOpts);}catch(err){setStatus(err.message||'تعذّر تسجيل الإجابة.','error');return;}
  if(!out?.ok||!out.room){setStatus(out?.reason||'تعذّر قبول الإجابة.','error');return;}
  busy=true;const fail=e=>{busy=false;setStatus(e?.reason||e?.message||'تعذّر حفظ القراءة. بقيت الإجابة مفتوحة.','error');};
  const finish=r=>{if(dead)return;busy=false;if(r?.ok===false||r?.saved===false){fail(r);return;}lastKind='answer';lastCommit=r?.changed===false?null:getDoc();skipped.get(groupKey())?.delete(q.id);editing=null;changedDirty(null);stale=false;setStatus(flags.unknown?'أُجّل السؤال؛ يمكن استكماله من «مراجعة الإجابات».':'سُجّلت الإجابة وحُدّثت الأسئلة والنتائج.');safeRefresh(true);};
  try{const r=apply({...d,room:out.room},'حُدّث سجل الفني.');if(promiseLike(r))r.then(finish,fail);else finish(r);}catch(err){fail(err);}
 }
 function applyRoom(){
  if(dead||busy||stale||topic!=='site'||!snap.roomProposal||!canEditInput('SITE-03'))return;
  if(getDoc()!==boundDoc||getProjectKey?.()!==boundProject){setStatus('تغيّر المشروع. راجع القياس مجددًا قبل التطبيق.','warn');return;}
  const d=getDoc(),token=snap.roomProposal.token;let out;
  try{out=assistEngine.applyAssistRoomProposal?.(d,token);}catch(err){setStatus(err.message||'تعذّر تطبيق القياس.','error');return;}
  if(!out?.ok){setStatus(out?.reason||'تعذّر تطبيق القياس على الرسم.','error');return;}
  busy=true;const failed=r=>{busy=false;setStatus(r?.reason||r?.message||'لم يُطبَّق القياس.','error');};
  const finish=r=>{busy=false;if(dead)return;if(r?.ok===false||r?.saved===false)return failed(r);lastKind='room';lastCommit=r?.changed===false?null:getDoc();setStatus('طُبّق القياس على رسم الغرفة.');safeRefresh(true);};
  try{const r=apply({...d,room:out.room},'طُبّق قياس الموقع على الغرفة.');if(promiseLike(r))r.then(finish,failed);else finish(r);}catch(err){failed(err);}
 }
 function visitAction(clear=false){
  if(busy||stale||getDoc()!==boundDoc||getProjectKey?.()!==boundProject){setStatus('تغيّر المشروع. راجع الزيارة قبل تعديل بياناتها.','warn');return;}
  const fields=Object.fromEntries(['responsible','date','revision'].map(k=>[k,elem('[data-ka-meta="'+k+'"]')?.value??visitDraft?.[k]??'']));const r=clear?clearVisitContext(getDoc()):saveVisitContext(getDoc(),fields);
  if(!r.ok){setStatus(r.reason,'error');return;}setVisitDraft(null);setStatus(clear?'مُسحت بيانات الزيارة لهذا التبويب.':'حُفظت بيانات الزيارة للقراءات الجديدة.');safeRefresh();
 }
 function click(e){
  const btn=e.target.closest?.('[data-ka-do]');if(!btn||!host.contains(btn)||busy)return;const op=btn.dataset.kaDo,q=choose();
  if(op==='apply-room')runChange(applyRoom);
  else if(op==='clear-visit')visitAction(true);
  else if(op==='choose'&&q){const o=q.type==='boolean'?[{value:true},{value:false}]:optionPairs(q),v=o[Number(btn.dataset.kaOpt)];if(v)commit(v.value);}
  else if(op==='match'&&q&&has(q.defaultValue))commit(q.defaultValue);
  else if(op==='unknown'&&q)commit(null,{unknown:true});
  else if(op==='edit')runChange(()=>{editing=btn.dataset.kaQid;setStatus('');safeRefresh(true);});
  else if(op==='next')runChange(()=>{editing=null;safeRefresh(true);});
  else if(op==='defer-conflict'&&q){const key=groupKey();if(!skipped.has(key))skipped.set(key,new Set());skipped.get(key).add(q.id);changedDirty(null);editing=null;setStatus('بقي التعارض للمراجعة.');safeRefresh(true);}
  else if(op==='keep'){pending=null;elem('[data-ka-pending]').hidden=true;elem('[data-ka-input]')?.focus();}
  else if(op==='leave'&&pending){const fn=pending;pending=null;changedDirty(null);setVisitDraft(null);fn();}
  else if(op==='discard-stale'){changedDirty(null);setVisitDraft(null);stale=false;editing=null;setStatus('');safeRefresh(true);}
  else if(op==='undo'&&lastCommit&&getDoc().room===lastCommit.room&&getDoc().kitchen===lastCommit.kitchen){runChange(()=>{const wasRoom=lastKind==='room';lastCommit=null;onUndo?.();editing=null;setStatus(wasRoom?'تم التراجع عن تطبيق القياس.':'تراجع السجل عن آخر إجابة.');safeRefresh(true);});}
  else if(op==='related')runChange(()=>onCatalog?.(btn.dataset.kaCode));
  else if(op==='catalog')runChange(()=>onCatalog?.(q?.code));
  else if(op==='records')runChange(()=>onRecords?.());
 }
 function updateValue(e){if(e.target.dataset?.kaMeta){const key=e.target.dataset.kaMeta;if(['responsible','date','revision'].includes(key))setVisitDraft({...readVisitContext(getDoc()),...visitDraft,[key]:e.target.value});return;}if(!e.target.matches?.('[data-ka-input]')||!choose())return;changedDirty({key:qIdentity(topic,snap.entityId,choose()),value:e.target.value});}
 function change(e){const t=e.target;if(t.matches?.('[data-ka-topic]')){const target=t.value;t.value=topic;runChange(()=>move(target));}
 else if(t.matches?.('[data-ka-scope]')){const target=t.value;t.value=snap.entityId;runChange(()=>move(topic,target));}else updateValue(e);}
 function submit(e){if(e.target.matches?.('.ka-visit')){e.preventDefault();visitAction();return;}if(!e.target.matches?.('.ka-input-form'))return;e.preventDefault();const control=elem('[data-ka-input]');if(control&&control.value.trim())commit(control.value);}
 function toggle(e){const k=e.target?.dataset?.kaDetails;if(k){if(e.target.open)openSections.add(k);else openSections.delete(k);}}
 host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('input',updateValue);host.addEventListener('submit',submit);host.addEventListener('toggle',toggle,true);safeRefresh();
 return {refresh:()=>safeRefresh(),isDirty:anyDirty,destroy(){dead=true;host.removeEventListener('click',click);host.removeEventListener('change',change);host.removeEventListener('input',updateValue);host.removeEventListener('submit',submit);host.removeEventListener('toggle',toggle,true);},getState:()=>({topic,entityId:snap?.entityId,questionId:choose()?.id,dirty:anyDirty()})};
}
