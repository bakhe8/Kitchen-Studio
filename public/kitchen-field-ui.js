import {outputStamp,stampColumns} from './kitchen-output-stamp.js';
import {mountDefaultsPanel} from './kitchen-defaults-ui.js';
import {buildAssistant} from './kitchen-assist-engine.js';
import {relatedInputs} from './kitchen-assist-related.js';
import {mountFieldAssistant} from './kitchen-assist-ui.js';
import {fieldInputs,fieldInputByCode,fieldGroups} from './kitchen-field-catalog.js';
import {readFieldRegister,upsertFieldRecord,removeFieldRecord,fieldRegisterCSV,fieldChoices} from './kitchen-field-model.js';
import {mountClearanceCheck} from './kitchen-field-clearance.js';
import {mountFieldForm} from './kitchen-field-form.js';
import {getProjectAccess,subscribeProjectAccess} from './kitchen-project-access.js';
import {authorizeProjectChange,fieldInputRole} from './kitchen-access-policy.js';

const formatter=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:7});
const n=x=>formatter.format(x);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bidi=s=>'<bdi>'+esc(s)+'</bdi>';
const fold=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670\u0640\u0300-\u036f]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
const needles=(a)=>fold(a).split(' ').filter(Boolean);
const catalogText=new Map(fieldInputs.map(e=>[e.code,fold([e.code,e.group,e.name,e.spec,e.method,e.owner,e.need,e.stage,e.representation,e.impact,e.waiting].join(' '))]));
const options=(values,all,sel)=>'<option value="">'+esc(all)+'</option>'+values.map(x=>'<option value="'+esc(x)+'" '+(x===sel?'selected':'')+'>'+esc(x)+'</option>').join('');
const unique=key=>[...new Set(fieldInputs.map(e=>e[key]))];
const verbs={edit:'تعديل',property:'خاصية أخرى للعنصر',reading:'قراءة أخرى',duplicate:'نسخ لعنصر آخر',remove:'حذف'};
const button=(op,name,cls='',attrs='')=>'<button type="button" data-fr-do="'+op+'" class="'+cls+'" '+attrs+'>'+name+'</button>';
const valueText=r=>r.valueType==='boolean'&&typeof r.value==='boolean'?(r.value?'نعم':'لا'):r.value===null||r.value===undefined||r.value===''?(r.attachments?.length?n(r.attachments.length)+' مرفق':r.verification==='na'?'لا ينطبق':'بلا قيمة'):String(r.value)+(r.unit?' '+r.unit:'');
const stateText=(key,v)=>fieldChoices[key]?.[v]||v||'';
const sev=r=>({unknown:'muted',na:'muted',conflict:'warn',preliminary:'pending',estimated:'pending'})[r.verification]||'ok';
const summary=(key,val)=>'<div><dt>'+key+'</dt><dd>'+esc(val||'—')+'</dd></div>';
const basicFilter=()=>({q:'',group:'',stage:'',need:'',expanded:false});
function exportValues(doc){
 const stamp=outputStamp(doc,'المطبخ كاملًا','سجل الزيارة'),csv=fieldRegisterCSV(doc.room,doc.room.name,([headers,...rows])=>{
  const tagged=stampColumns(stamp,headers,rows);return [tagged.headers,...tagged.rows];
 });const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kitchen-field-values-'+stamp.revision+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
const clearanceInputs=new Set(['SITE-19','CAT-17','EQP-02']);
const checkButton=()=>button('assist-equipment','فحص فتحة الغسالة','fr-check-link')+button('clearance','مثال ومقارنة يدوية','fr-link');
function metadata(e){return '<details class="fr-definition"><summary>مواصفات المدخل وطريقة جمعه</summary><dl>'+summary('المطلوب',e.spec)+summary('كيفية الإدخال',e.method)+summary('من يؤكد المعلومة؟',e.owner)+summary('الحاجة',e.need)+summary('موعد الإكمال',e.stage)+summary('كيف يمثله البرنامج؟',e.representation)+summary('أثره على التصميم',e.impact)+summary('ما الذي ينتظر هذه المعلومة؟',e.waiting)+summary('تظهر عند',e.trigger)+summary('مرحلة الاستخدام',e.workflowStage)+summary('آخر موعد للاعتماد',e.gate)+'</dl></details>';}

// The register is an overlay. A temporarily hidden editor keeps its DOM and
// draft. Replacing a project or an old reading never silently retargets it.
export function mountFieldRegister(el,{getDoc,getProjectKey,apply,onClose,onProject,onUndo,attachmentStore,scoped=false}){
 const doc=el.ownerDocument||document;
 const box=doc.createElement('aside');box.className='pro-drawer fr-drawer';box.hidden=true;box.dir='rtl';box.setAttribute('role','dialog');box.setAttribute('aria-label','سجل الفني');el.append(box);
 box.innerHTML='<header class="pr-head fr-head"><div><small>رفع الموقع</small><strong>سجل الفني</strong></div>'+button('close','×','fr-close','aria-label="إغلاق سجل الفني"')+'</header><nav class="fr-tabs" aria-label="أقسام سجل الفني"></nav><div class="fr-confirm" hidden></div><div class="fr-main"></div><div class="fr-status" aria-live="polite" role="status" hidden></div>';
 const q=s=>box.querySelector(s),nav=q('.fr-tabs'),main=q('.fr-main'),confirm=q('.fr-confirm'),status=q('.fr-status');
 let defaultsPanel=null,assistant=null,assistFocus=null;let tab='defaults',screen='list',code='',form=null,opener=null,pending=null,boundDoc=null,editorOriginal=null,boundKey=null,readingInstead=false,localCommit=false,disposed=false;
 let directSeed=null;
 let scrollItem=0,returnFrom='list',checker=null,checkOrigin='list',lastItemId='',lastRecordId='',dirty=false;
 const scrollByTab={defaults:0,assist:0,browse:0,records:0},filters={browse:basicFilter(),records:basicFilter()};
 const data=()=>readFieldRegister(getDoc().room).records;
 const catalog=code=>fieldInputByCode.get(code);
 const rowBy=id=>data().find(v=>v.id===id);
 const say=(text='',kind='')=>{status.textContent=text;status.dataset.kind=kind;status.hidden=!text;};
 const role=()=>getProjectAccess(getDoc()).role;
 const canEdit=input=>role()==='owner'||role()==='editor'&&fieldInputRole(input)!=='owner'||(['rep','factory'].includes(role())&&fieldInputRole(input)===role());
 const canSee=input=>!['rep','factory'].includes(role())||fieldInputRole(input)===role();
 const canGuide=()=>['owner','editor','rep'].includes(role());
 const denied=()=>{say('هذا المدخل خارج صلاحية التعديل الحالية.','error');return {ok:false,reason:'هذا المدخل خارج صلاحية التعديل الحالية.'};};
 const commit=(next,msg)=>{
  // A scoped widget document contains redacted technical context, not a full
  // archive. Each input path checks ownership; its host extracts the owned DTO
  // slice and the server validates that slice against the complete project.
  if(scoped)return ['rep','factory'].includes(role())?apply(next,msg):denied();
  const check=authorizeProjectChange(role(),{design:getDoc()},{design:next});return check.ok?apply(next,msg):check;
 };
 const scopedAttachments=attachmentStore?{download:(...args)=>attachmentStore.download?.(...args),put:async file=>{
  if(!canEdit(code)||projectChanged())throw Error('لا تسمح صلاحية المشروع الحالية بحفظ هذا المرفق.');
  if(!attachmentStore.put)throw Error('حفظ المرفقات غير متاح هنا.');
  return attachmentStore.put(file);
 }}:null;
 const snapFilter=()=>{if(screen==='list')scrollByTab[tab]=main.scrollTop;else if(screen==='item')scrollItem=main.scrollTop;};
 const message=(ask,action,label='تجاهل ومتابعة',cancel='البقاء هنا')=>{pending=action;confirm.innerHTML='<p>'+esc(ask)+'</p><div>'+button('stay',cancel,'fr-secondary')+button('proceed',label,'fr-danger')+'</div>';confirm.hidden=false;q('[data-fr-do=stay]')?.focus({preventScroll:true});};
 const dismiss=()=>{pending=null;confirm.hidden=true;confirm.replaceChildren();};
 const isDirty=()=>!!(form?.isDirty?.()||dirty);
 const guard=fn=>{if((screen==='form'&&isDirty())||(tab==='assist'&&assistant?.isDirty?.())||(tab==='defaults'&&defaultsPanel?.isDirty?.())){message('في هذه الصفحة قيم لم تُسجّل بعد. هل تريد تركها؟',fn);return;}fn();};
 function close(focus=false){snapFilter();box.hidden=true;dismiss();if(focus){onClose?.();if(!onClose)opener?.focus?.({preventScroll:true});}}
 function detach(){defaultsPanel?.destroy?.();defaultsPanel=null;assistant?.destroy?.();assistant=null;checker?.destroy?.();checker=null;form?.destroy?.();form=null;editorOriginal=null;boundKey=null;boundDoc=null;readingInstead=false;dirty=false;dismiss();}
 function focusHeading(){main.querySelector('[tabindex="-1"]')?.focus({preventScroll:true});}
 function changeTab(to){if(to==='assist'&&!canGuide())return denied();if(to===tab&&screen==='list')return;guard(()=>{snapFilter();detach();directSeed=null;tab=to;screen='list';say('');render();focusHeading();});}
 function paintTabs(){nav.innerHTML=button('defaults','قيم المشروع','', 'aria-pressed="'+(tab==='defaults')+'"')+(canGuide()?button('assist','الزيارة الموجّهة','', 'aria-pressed="'+(tab==='assist')+'"'):'')+button('records','القيم المسجلة <span>'+n(data().filter(r=>canSee(r.inputCode)).length)+'</span>','', 'aria-pressed="'+(tab==='records')+'"')+button('browse','الدليل الكامل','', 'aria-pressed="'+(tab==='browse')+'"');}
 function filtersHTML(){const f=filters[tab],on=f.group||f.stage||f.need;
 return '<div class="fr-search"><label><span class="fr-sr">بحث في '+(tab==='browse'?'المدخلات':'القيم المسجلة')+'</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" data-fr-search placeholder="'+(tab==='browse'?'ابحث بالاسم أو الرمز…':'ابحث بالعنصر أو الخاصية أو القيمة…')+'" value="'+esc(f.q)+'"></label>'+button('filters','تصفية'+(on?' •':''),'fr-filter-button','aria-expanded="'+f.expanded+'"')+'</div><div class="fr-filters" '+(f.expanded?'':'hidden')+'>'+
 [['group','المجموعة','كل المجموعات',fieldGroups],['stage','المرحلة','كل المراحل',unique('stage')],['need','الحاجة','كل الحالات',unique('need')]].map(([key,label,all,values])=>'<label>'+label+'<select data-fr-filter="'+key+'">'+options(values,all,f[key])+'</select></label>').join('')+'</div>';}
 function listChrome(){const f=filters[tab];main.innerHTML='<div class="fr-list-top"><div class="fr-title"><h2 tabindex="-1">'+(tab==='browse'?'دليل المدخلات':'سجل قيم المشروع')+'</h2><small>'+esc(getDoc().room?.name||'مطبخي')+'</small></div>'+(tab==='records'&&canGuide()?'<div class="fr-check-row">'+checkButton()+'</div>':'')+filtersHTML()+'<div class="fr-results-bar"><output data-fr-count aria-live="polite"></output>'+button('clear','مسح التصفية','fr-link',!(f.q||f.group||f.stage||f.need)?'hidden':'')+'</div></div><div data-fr-results></div>'+(tab==='records'?'<footer class="fr-transfer"><span>ملفات المشروع</span><div>'+button('csv','تنزيل جدول القيم · CSV','fr-secondary',data().length?'':'disabled')+button('project','تنزيل المشروع مع المرفقات','fr-secondary')+'</div></footer>':'');listRows();}
 function listRows(){const f=filters[tab],words=needles(f.q),recordBag=data().filter(r=>canSee(r.inputCode)),counts=new Map;for(const r of recordBag)counts.set(r.inputCode,(counts.get(r.inputCode)||0)+1);
 const accept=e=>e&&canSee(e.code)&&(!f.group||e.group===f.group)&&(!f.stage||e.stage===f.stage)&&(!f.need||e.need===f.need);
 const matching=(terms,str)=>terms.every(x=>str.includes(x));
 const codes=fieldInputs.filter(e=>accept(e)&&matching(words,catalogText.get(e.code)));
 const rows=tab==='records'?recordBag.filter(r=>{const e=catalog(r.inputCode);return accept(e)&&matching(words,fold([r.inputCode,e.group,e.name,r.itemId,r.location,r.property,valueText(r),r.source,r.responsible,r.notes,r.readingRef,stateText('verification',r.verification),r.revision].join(' ')));}).reverse():[];
 const ct=tab==='browse'?codes.length:rows.length,total=tab==='browse'?fieldInputs.filter(e=>canSee(e.code)).length:recordBag.length;
 q('[data-fr-count]').textContent=n(ct)+' من '+n(total)+(tab==='browse'?' مدخلًا':' قيمة');
 q('[data-fr-do=clear]').hidden=!(f.q||f.group||f.stage||f.need);
 const result=q('[data-fr-results]');
 if(!ct){result.innerHTML='<div class="fr-empty"><strong>'+(tab==='records'&&!total?'لم تُسجّل قيم بعد':'لا توجد نتائج بهذه التصفية')+'</strong><p>'+(tab==='records'&&!total?'اختر المدخل ثم سجّل أول خاصية للعنصر.':'غيّر عبارة البحث أو المجموعة.')+'</p>'+button(tab==='records'&&!total?'browse':'clear',tab==='records'&&!total?'اختيار مدخل':'مسح التصفية','fr-primary')+'</div>';return;}
 if(tab==='browse'){let group='';result.innerHTML=codes.map(e=>{const heading=group!==e.group?'<h3 class="fr-group">'+esc(e.group)+'</h3>':'';group=e.group;return heading+'<button type="button" class="fr-entry" data-fr-code="'+esc(e.code)+'"><span class="fr-code" dir="ltr">'+esc(e.code)+'</span><span><strong>'+esc(e.name)+'</strong><small>'+esc(e.stage)+' · '+esc(e.need)+'</small></span><span class="fr-entry-end">'+(counts.has(e.code)?'<i title="عدد القيم المسجلة">'+n(counts.get(e.code))+'</i>':'')+'<span aria-hidden="true">‹</span></span></button>';}).join('');}
 else result.innerHTML=rows.map(r=>recordCard(r,true)).join('');}
 function recordCard(r,global=false){
 const e=catalog(r.inputCode),value=valueText(r),line=[r.readingRef?'مرجع القراءة: '+r.readingRef:'',r.location,r.date].filter(Boolean).join(' · ');
 return '<article class="fr-record" data-fr-record="'+esc(r.id)+'"><div class="fr-rmain"><button type="button" class="fr-read-record" '+(canEdit(r.inputCode)?'':'disabled')+' data-fr-row="'+esc(r.id)+'" aria-label="تعديل '+esc(r.itemId)+'، '+esc(r.property)+'"><span class="fr-rec-top">'+(global?'<span class="fr-code" dir="ltr">'+esc(r.inputCode)+'</span> ':'')+bidi(r.itemId)+(global&&e?' · '+esc(e.name):'')+'</span><strong>'+esc(r.property)+'</strong><b class="fr-value">'+bidi(value)+'</b></button><span class="fr-badge" data-tone="'+sev(r)+'">'+esc(stateText('verification',r.verification))+'</span></div>'+
 '<div class="fr-record-foot"><small>'+esc(line)+(r.attachments?.length?' · '+n(r.attachments.length)+' مرفق':'')+'</small>'+(canEdit(r.inputCode)?'<details class="fr-more"><summary aria-label="إجراءات '+esc(r.property)+'">إجراءات ▾</summary><div>'+Object.entries(verbs).map(([k,l])=>button(k,l,k==='remove'?'fr-rm':'','data-fr-id="'+esc(r.id)+'"')).join('')+'</div></details>':'')+'</div></article>';
 }
 function renderItem(){const e=catalog(code);if(!e||!canSee(code)){screen='list';render();return;}const list=data().filter(r=>r.inputCode===code&&(!directSeed||r.itemId===directSeed.itemId));
 main.innerHTML='<div class="fr-crumb">'+button('back','→ '+(tab==='browse'?'دليل المدخلات':'القيم المسجلة'),'fr-link')+'<span>'+esc(e.group)+'</span></div><div class="fr-item-head"><span class="fr-code">'+esc(e.code)+'</span><h2 tabindex="-1">'+esc(e.name)+'</h2><small>'+esc(e.stage)+' · '+esc(e.need)+'</small></div>'+metadata(e)+'<div class="fr-item-actions">'+(canGuide()&&clearanceInputs.has(e.code)?checkButton():'')+(canEdit(e.code)?button('new','إضافة قيمة','fr-primary'):'')+(canEdit(e.code)&&lastItemId?button('same','خاصية أخرى لـ '+bidi(lastItemId),'fr-secondary'):'')+'</div><div class="fr-section-title">'+n(list.length)+' قيمة مسجلة</div>'+(list.length?[...list].reverse().map(r=>recordCard(r)).join(''):'<p class="fr-empty">لا توجد قيم لهذا المدخل بعد.</p>');main.scrollTop=scrollItem;
 }
 function openItem(id,opts={}){if(!canSee(id))return denied();if(screen==='list')snapFilter();detach();code=id;screen='item';if(!opts.keep){directSeed=opts.seed||null;lastItemId='';lastRecordId='';scrollItem=0;}render();if(!opts.keep)focusHeading();}
 function begin(entry,record=null,seed=null,where=screen){if(!entry||!canEdit(entry.code))return denied();if(where!=='item')directSeed=null;snapFilter();detach();screen='form';returnFrom=where==='item'?'item':'list';code=entry.code;editorOriginal=record?{...record}:null;boundKey=getProjectKey?.();boundDoc=getDoc();
 paintTabs();main.innerHTML='<div class="fr-crumb">'+button('back','→ السابق','fr-link')+'<span>'+esc(entry.group)+'</span></div>'+(clearanceInputs.has(entry.code)?'<div class="fr-check-row">'+checkButton()+'</div>':'')+'<div data-fr-stale hidden></div><fieldset data-fr-access style="border:0;padding:0;margin:0;min-width:0"><div data-fr-editor></div></fieldset>';main.scrollTop=0;say('');
 form=mountFieldForm(q('[data-fr-editor]'),{entry,record,seed,getDoc,attachmentStore:scopedAttachments,onCancel:()=>goBack(),onDirty:v=>{dirty=!!v;},onSave:saveDraft});
 }
 function showCheck(){const origin=screen==='item'||screen==='form'?'item':'list';snapFilter();detach();checkOrigin=origin;screen='check';paintTabs();main.innerHTML='<div data-fr-check-host></div>';main.scrollTop=0;say('');checker=mountClearanceCheck(q('[data-fr-check-host]'),{getDoc,onBack:goBack});}
 function goBack(){if(screen==='list')return;guard(()=>{if((screen==='form'&&returnFrom==='item')||(screen==='check'&&checkOrigin==='item')){openItem(code,{keep:true});say('');return;}detach();screen='list';say('');render();focusHeading();});}
 function projectChanged(){const d=getDoc();return (getProjectKey&&boundKey!==getProjectKey())||(d!==boundDoc&&(d.room!==boundDoc?.room||d.kitchen!==boundDoc?.kitchen));}
 function staleBanner(){const lock=q('[data-fr-access]');if(lock)lock.disabled=!canEdit(code);if(!canEdit(code))denied();const banner=q('[data-fr-stale]');if(!banner)return;
 if(!boundDoc||!projectChanged()){banner.hidden=true;return;}
 const rec=editorOriginal?rowBy(editorOriginal.id):null,conflict=editorOriginal&&((getProjectKey&&boundKey!==getProjectKey())||JSON.stringify(rec)!==JSON.stringify(editorOriginal));
 banner.innerHTML='<p>'+(conflict?'تغيّرت القراءة الأصلية أو حُذفت. تبقى مسودتك متاحة كقراءة جديدة.':'تغيّر التصميم منذ فتح المسودة. راجع المشروع قبل تسجيل قيمها.')+'</p>'+button('rebind',conflict?'استخدام كقراءة جديدة':'متابعة في المشروع الحالي','fr-secondary');banner.hidden=false;
 }
 function saveDraft(raw){
 if(!canEdit(raw.inputCode)||editorOriginal&&!canEdit(editorOriginal.inputCode))return denied();
 if(projectChanged()){staleBanner();return {ok:false,reason:'تغيّر المشروع؛ راجع التنبيه أعلى النموذج قبل التسجيل.'};}
 const target=getDoc(),r=readingInstead?{...raw,id:undefined,readingRef:''}:raw,out=upsertFieldRecord(target.room,r);
 if(!out.ok)return out;
 const created=out.record;let committed;
 localCommit=true;try{committed=commit({...target,room:out.room},'سُجّلت قيمة '+r.property+'.');}finally{localCommit=false;}
 if(!committed?.ok||committed.saved===false)return {ok:false,reason:committed?.reason||'لم تُحفظ القيمة في هذا المتصفح.'};
 code=created.inputCode;lastItemId=created.itemId;lastRecordId=created.id;scrollItem=0;dirty=false;openItem(code,{keep:true});say('سُجّلت «'+created.property+'» للعنصر '+created.itemId+' في هذا المتصفح.','ok');return {ok:true,record:created};
 }
 function newSeed(r,mode){if(!r)return undefined;
 const base={itemId:r.itemId,location:r.location,revision:r.revision,responsible:r.responsible};
 if(mode==='property')return base;
 if(mode==='reading')return {...base,property:r.property,valueType:r.valueType,unit:r.unit};
 if(mode==='duplicate'){const {id,attachments,readingRef,assist,...s}=r;return {...s,itemId:'',attachments:[]};}return null;
 }
 function rowAction(op,id){const r=rowBy(id),e=r&&catalog(r.inputCode);if(!r||!e){render();say('لم يعد هذا السجل موجودًا.');return;}if(!canEdit(r.inputCode))return denied();if(op==='remove'){
 message('حذف قيمة «'+r.property+'» من '+r.itemId+'؟',()=>{const current=rowBy(id);if(!current||!canEdit(current.inputCode))return denied();const cur=getDoc(),out=removeFieldRecord(cur.room,id);if(!out.ok){say(out.reason,'error');return;}localCommit=true;let saved;try{saved=commit({...cur,room:out.room},'حُذفت القيمة من سجل الفني.');}finally{localCommit=false;}if(!saved?.ok||saved.saved===false){say(saved?.reason||'تعذر حفظ الحذف.','error');return;}if(lastRecordId===id){lastRecordId='';lastItemId='';}render();say('حُذفت القيمة. يمكن التراجع من شريط المشروع.','ok');},'حذف القيمة','إبقاء');return;}
 const origin=screen==='item'?'item':'list';begin(e,op==='edit'?r:null,op==='edit'?null:newSeed(r,op),origin);}
 // Remember navigation only. The measured evidence itself is always re-read
 // from the current room, and each target is validated against its live objects.
 const navKey=()=>{const d=getDoc();return JSON.stringify([d.room.name||'',d.kitchen.units.map(u=>u.id).join('|'),d.kitchen.features.map(f=>f.id).join('|')]);};
 const persistFocus=f=>{assistFocus={...f,project:navKey()};try{sessionStorage.setItem('kitchen:visit-context',JSON.stringify(assistFocus));}catch{}};
 function startFocus(){const d=getDoc(),signature=navKey();if(assistFocus&&assistFocus.project===signature)return assistFocus;try{const saved=JSON.parse(sessionStorage.getItem('kitchen:visit-context'));if(saved?.project===signature&&['site','services','equipment','customer','production'].includes(saved.topic))return saved;}catch{}
 // A register carried from another device can already identify which actual
 // component was under survey. Use its ID, never a similar name or width.
 const last=data().at(-1);if(last){const ids=new Set([last.itemId,(last.location||'').match(/\[([^\]]+)\]$/)?.[1]].filter(Boolean));
 const dw=d.kitchen.units.find(u=>ids.has(u.id)&&u.kind==='dishwasher');if(dw&&['SITE-19','EQP-01','EQP-02','EQP-10','CAT-17'].includes(last.inputCode))return {topic:'equipment',entityId:dw.id};
 const fx=[...d.kitchen.features,...(d.room.sitePoints||[])].find(f=>ids.has(f.id));if(fx)return {topic:'services',entityId:fx.id};
 if(['USE-08','CAT-14','PRJ-05'].includes(last.inputCode))return {topic:'customer',entityId:({'USE-08':'pantry:','CAT-14':'corner:','PRJ-05':'budget:'})[last.inputCode]+last.itemId};}
 return {topic:'site'};}
 function assistSeed(entry,focus){
  if(!focus?.topic)return null;const d=getDoc(),s=buildAssistant(d,focus.topic,{entityId:focus.entityId});const qs=s.answers.filter(a=>a.code===entry.code),q=qs.find(x=>x.id===focus.questionId)||qs.find(x=>x.evidence.state==='missing')||qs[0];if(q)return {itemId:q.itemId,location:q.location||'',...(q.id===focus.questionId?{property:q.property,valueType:q.type==='choice'?'text':q.type,unit:q.unit||''}:{})};
  if(!relatedInputs(d,focus.topic,{entityId:focus.entityId},s).some(x=>x.code===entry.code))return null;
  const known=s.answers.find(x=>x.itemId&&x.location);return known?{itemId:known.itemId,location:known.location}:null;
 }
 function guided(){
  if(!canGuide()){tab='records';render();return;}
  if(!assistant){const initial=startFocus();main.innerHTML='<div data-fr-assistant></div>';assistant=mountFieldAssistant(q('[data-fr-assistant]'),{getDoc,canEditInput:canEdit,apply:(d,msg)=>{if(!canGuide())return denied();const out=commit(d,msg);paintTabs();return out;},getProjectKey,onUndo,initialTopic:initial.topic,initialEntityId:initial.entityId,initialQuestionId:initial.questionId,onContext:persistFocus,onCatalog:code=>{if(!code){changeTab('browse');return;}const entry=catalog(code);if(!entry)return;const seed=assistSeed(entry,assistant?.getState?.()||startFocus());guard(()=>{detach();tab='browse';if(data().some(r=>r.inputCode===code&&(!seed?.itemId||r.itemId===seed.itemId)))openItem(code);else begin(entry,null,seed,'list');});},onRecords:()=>changeTab('records')});}else assistant.refresh?.();
 }
 function projectValues(){if(!defaultsPanel){main.innerHTML='<div data-fr-defaults></div>';defaultsPanel=mountDefaultsPanel(q('[data-fr-defaults]'),{getDoc,apply:commit,getProjectKey,onGuided:()=>changeTab('assist'),onRecords:()=>changeTab('records'),onCatalog:()=>changeTab('browse')});}else defaultsPanel.refresh?.();}
 function render(){if(disposed)return;paintTabs();if(screen==='list'&&tab==='defaults'){projectValues();return;}if(screen==='list'&&tab==='assist'){guided();return;}if(screen==='list'){listChrome();main.scrollTop=scrollByTab[tab];}else if(screen==='item'){renderItem();}else if(screen==='form')staleBanner();else if(screen==='check')checker?.refresh?.();}
 function open(focus=null){
  if(!box.hidden)return;
  const safe=!isDirty()&&!assistant?.isDirty?.()&&!defaultsPanel?.isDirty?.();
  const mode=focus?.mode;
  if(safe&&['defaults','records'].includes(mode)){
   if(tab!==mode||screen!=='list'){detach();tab=mode;screen='list';}
  }else if(safe&&focus?.topic&&canGuide()){
   const f=startFocus();
   if(tab!=='assist'||!assistant||f.topic!==focus.topic||f.entityId!==focus.entityId||(focus.questionId&&f.questionId!==focus.questionId)){
    detach();tab='assist';screen='list';persistFocus(focus);
   }
  }
  opener=doc.activeElement;box.hidden=false;dismiss();
  if(screen==='form')staleBanner();else render();

  const closer=q('[data-fr-do=close]');
  closer?.setAttribute('aria-label',focus?.fromGuide?'الرجوع لدليل المشروع':'إغلاق سجل الفني');
  if(focus?.fromGuide)closer?.setAttribute('title','الرجوع لدليل المشروع');else closer?.removeAttribute('title');
  closer.textContent=focus?.fromGuide?'العودة للدليل':'×';closer.classList.toggle('fr-return-guide',!!focus?.fromGuide);
  closer?.focus({preventScroll:true});
  if(!safe&&(focus?.fromGuide||mode==='item')){
   guard(()=>{detach();tab='browse';screen='list';box.hidden=true;open(focus);});return;
  }
  if(safe&&mode==='item'&&focus.itemId){
   const entry=catalog(focus.code);
   if(entry){
    const seed={itemId:focus.itemId,location:focus.location,property:focus.property,valueType:'number',unit:'مم'};
    const match=data().filter(r=>r.inputCode===entry.code&&r.itemId===seed.itemId&&r.property===seed.property);
    tab='browse';directSeed=seed;
    if(match.length<=1)begin(entry,match[0]||null,seed,'item');
    else{openItem(entry.code,{seed});const found=main.querySelector('[data-fr-row="'+match.at(-1).id+'"]');found?.focus();}
   }
  }
  if(safe&&mode==='defaults'&&focus.material)defaultsPanel?.openWorktopValue(focus.code,focus.property,focus.material);
 }
 function refresh(){if(!localCommit&&!box.hidden)render();}
 box.addEventListener('click',e=>{const t=e.target.closest?.('button');if(!t||!box.contains(t))return;
 if(t.dataset.frCode){const id=t.dataset.frCode,entry=catalog(id);if(!entry||!canSee(id))return;if(!canEdit(id)||data().some(r=>r.inputCode===id)){say('');openItem(id);}else begin(entry,null,null,'list');return;}
 if(t.dataset.frRow){rowAction('edit',t.dataset.frRow);return;}const op=t.dataset.frDo;if(!op)return;
 if(op==='defaults'||op==='assist'||op==='browse'||op==='records'){changeTab(op);return;}
 if(op==='stay'){dismiss();return;}if(op==='proceed'){const f=pending;dismiss();f?.();return;}
 if(op==='close'){close(true);return;}if(op==='back'){goBack();return;}
 if(op==='filters'){const f=filters[tab];f.expanded=!f.expanded;const set=q('.fr-filters');set.hidden=!f.expanded;t.setAttribute('aria-expanded',String(f.expanded));if(f.expanded)set.querySelector('select')?.focus({preventScroll:true});return;}
 if(op==='clear'){filters[tab]=basicFilter();scrollByTab[tab]=0;render();q('[data-fr-search]')?.focus();return;}
 if(op==='assist-equipment'){if(!canGuide())return denied();guard(()=>{detach();persistFocus({topic:'equipment'});tab='assist';screen='list';say('');render();});return;}if(op==='clearance'){guard(showCheck);return;}if(op==='new'){begin(catalog(code),null,directSeed,'item');return;}if(op==='same'){const r=rowBy(lastRecordId);begin(catalog(code),null,newSeed(r,'property')||{itemId:lastItemId},'item');return;}
 if(op==='rebind'){const current=getDoc(),old=editorOriginal,live=old&&rowBy(old.id);if(old&&((getProjectKey&&boundKey!==getProjectKey())||JSON.stringify(old)!==JSON.stringify(live)))readingInstead=true;boundDoc=current;boundKey=getProjectKey?.();staleBanner();say('ستُسجّل المسودة في '+(current.room.name||'المشروع الحالي')+'.');return;}
 if(op==='project'){const sender=e.target.closest('button');sender.disabled=true;say('جارٍ تجهيز نسخة المشروع…');Promise.resolve().then(()=>onProject?.()).then(()=>say('جُهّز ملف المشروع مع القراءات والمرفقات.','ok'),err=>say(err.message||'تعذّر تنزيل المشروع.','warn')).finally(()=>{sender.disabled=false;});return;}
 if(op==='csv'){try{exportValues(getDoc());say('جُهّز جدول القيم للتنزيل. المرفقات في نسخة المشروع.','ok');}catch{say('تعذّر تنزيل جدول القيم.','error');}return;}
 if(Object.hasOwn(verbs,op)&&t.dataset.frId)rowAction(op,t.dataset.frId);
 });
 box.addEventListener('input',e=>{if(e.target.matches('[data-fr-search]')){filters[tab].q=e.target.value;listRows();}});
 box.addEventListener('change',e=>{const key=e.target.dataset.frFilter;if(key){filters[tab][key]=e.target.value;listRows();const b=q('[data-fr-do=filters]');b.textContent='تصفية'+(filters[tab].group||filters[tab].stage||filters[tab].need?' •':'');}});
 box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();if(pending)dismiss();else close(true);}});
 let accessRole=role();const unsubscribe=subscribeProjectAccess(()=>{const next=role();if(next===accessRole||disposed)return;accessRole=next;refresh();});
 return {open,close,active:()=>!box.hidden,hasPending:()=>!!(isDirty()||assistant?.isDirty?.()||defaultsPanel?.isDirty?.()),refresh,destroy(){disposed=true;unsubscribe();detach();box.remove();}};
}
