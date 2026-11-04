import {surveySymbol} from './kitchen-survey-symbols.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {hasLegacySampleLayout} from './kitchen-preset-recovery.js';
import {kitchenUnitSpecs} from './kitchen-catalog.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {linkedReadingIndex,applyChain,attestChain,chainFromDrawing,chainLabels,newChainRow,pointKinds,readChainRange,surveyedDesignRange,resolveChain} from './kitchen-chain-model.js';
import {assistNumber,stableHash} from './kitchen-measurement-identity.js';
import {ownKey} from './kitchen-safe-keys.js';
import {writeDraft,readDraft,clearDraft} from './kitchen-draft-store.js';
import {registerUnsavedWork} from './kitchen-unsaved-work.js';
import {surveyWallSheet} from './kitchen-survey-wall-sheet.js';
import {surveyWallMap} from './kitchen-survey-wall-map.js';
import {wallPairEditor} from './kitchen-wall-pair-ui.js';
import {mountWallInk} from './kitchen-wall-ink-ui.js';
import {mountWallOptions} from './kitchen-chain-options-ui.js';
import {arrangeSurveyNotebook,syncSurveyNotebook} from './kitchen-survey-notebook.js';
import {surveyNotebookSummary} from './kitchen-survey-notebook-model.js';

const numerals=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const fmt=n=>Number.isFinite(n)?numerals.format(n):'—';
// A counted noun the way it is said: none, one, two, a few (3 to 10), many (11 and up).
const measureCount=n=>n===0?'لا قياسات':n===1?'قياس واحد':n===2?'قياسان':n<=10?fmt(n)+' قياسات':fmt(n)+' قياسًا';
const hasEnd=chain=>!!chain?.rows?.some(r=>r.kind==='stop'||r.kind==='corner');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mark=k=>['start','stop','corner'].includes(k);
const isOpening=k=>k==='door'||k==='window';
const btn=(act,name,attrs='')=>'<button type="button" data-chain-act="'+act+'" '+attrs+'>'+esc(name)+'</button>';
const actionIcon=(act,glyph,name,attrs='',visible='')=>'<button type="button" data-chain-act="'+act+'" aria-label="'+esc(name)+'" title="'+esc(name)+'" '+attrs+'>'+studioIcon(glyph)+(visible?'<span>'+esc(visible)+'</span>':'')+'</button>';
const choices=(items,sel)=>items.map(([k,t])=>'<option value="'+esc(k)+'"'+(k===sel?' selected':'')+'>'+esc(t)+'</option>').join('');
const choose=(key,label,items,value)=>'<label>'+esc(label)+'<select data-chain-prop="'+key+'">'+choices(items,value)+'</select></label>';
const field=(key,label,value)=>'<label>'+esc(label)+'<span class="sv-input"><input dir="ltr" inputmode="decimal" autocomplete="off" data-chain-prop="'+key+'" value="'+esc(value)+'"><small aria-hidden="true">مم</small></span></label>';
const short={window:'شباك',door:'باب',water:'ماء',electric:'كهرباء',drain:'صرف',gas:'غاز',vent:'فتحة تهوية الشفاط',start:'بداية الدواليب',stop:'نهاية الدواليب',corner:'ركن الجدار',shaft:'مجرى خدمات',beam:'كمرة',column:'عمود',heater:'سخان'};
const centres={water:'مركز مخرج الماء',drain:'مركز فتحة الصرف',electric:'مركز المقبس الكهربائي',gas:'مركز مخرج الغاز',vent:'مركز فتحة تهوية الشفاط'};
const limits={start:'علامة بداية الدواليب',stop:'علامة نهاية الدواليب',corner:'ركن نهاية الجدار'};
const endHint={stop:'ضع هذه العلامة حيث تنتهي الدواليب على هذا الجدار',corner:'ضع هذه العلامة عند الركن الذي ينتهي عنده الجدار'};
// The same words as the tooltips above, written on the screen with the two buttons they name: a tablet has no hover, and the buttons
// at the foot of the form can be below the fold. Shown while a wall has measurements and no end marker.
export const endNeeded='إن كانت الدواليب ستوضع على هذا الجدار، حدّد أين تنتهي بزر «نهاية الدواليب»، أو «ركن نهاية الجدار» إن بلغ الجدار الركن.';
// The design step needs one wall that says where the cabinets end (or that closes at its corner). Until then the review screen says so.
export const walkNeedsEnd='للمتابعة سجّل «نهاية الدواليب» أو «ركن نهاية الجدار» على جدار واحد على الأقل، ثم احفظه.';
export const walkNeedsAnything='لم يُسجَّل أي قياس بعد. افتح أحد الجدران وسجّل قياساته، ثم «نهاية الدواليب» أو «ركن نهاية الجدار».';
const edgeOf={door:'للباب',window:'للشباك',shaft:'لمجرى الخدمات',column:'للعمود',beam:'للكمرة',heater:'للسخان'};
const kinds=Object.keys(chainLabels);
const serviceKinds=['water','drain','electric','gas','vent','heater'];
const otherKinds=['start','column','beam','shaft'];
const measuredFields=new Set(['gapMm','widthMm','frameDistance','bottomMm','heightMm']);
const nextId=rows=>{let n=1;while(rows.some(r=>r.id==='p'+n))n++;return 'p'+n;};
const empty=()=>({source:'drawing',rows:[]});
const pageToken=Math.random().toString(36).slice(2)+Date.now().toString(36);
// A saved draft is a half-typed wall, so rows may still lack numbers; only the shape is checked here. Saving the wall validates it for real.
const draftScalar=v=>v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=200||Number.isFinite(v);
const plainObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function restoredDraft(raw){
 if(!plainObject(raw)||!Array.isArray(raw.rows)||raw.rows.length>64||raw.source!==undefined&&!['field','example','drawing'].includes(raw.source))return null;
 const rows=[];
 for(const input of raw.rows){
  if(!plainObject(input)||typeof input.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,28}$/i.test(input.id)||!ownKey(chainLabels,input.kind))return null;
  const row={};
  for(const [key,value] of Object.entries(input)){
   if(key==='frameRead'&&plainObject(value))row.frameRead=Object.fromEntries(Object.entries(value).filter(([,v])=>draftScalar(v)));
   else if(draftScalar(value))row[key]=value;
  }
  rows.push(row);
 }
 const chain={source:raw.source||'drawing',rows};
 if(plainObject(raw.attestation))chain.attestation=raw.attestation;
 return chain;
}

function frameFields(row){
 const v=row.frameRead;
 return choose('frameMethod','طريقة قياس البرواز',[['width','بين طرفي البرواز'],['station','الطرف البعيد من بداية الجدار'],['opposite','الطرف البعيد من الركن المقابل']],v?.method||'width')+
  (v?field('frameDistance',v.method==='station'?'من ركن البداية إلى الطرف البعيد':'من الطرف البعيد إلى الركن المقابل',v.distanceMm)+
     (v.method==='opposite'?field('frameWallLength','طول الجدار بين الركنين',v.wallLengthMm):''):field('widthMm','عرض البرواز كاملًا',row.widthMm));
}
function motionFields(row){
 const list=[['','اختر الحركة'],['out','يفتح للخارج'],['in','يفتح للداخل'],['sliding','سحّاب']];if(row.kind==='window')list.push(['fixed','زجاج ثابت']);
 let html=choose('swing','حركة الضلفة',list,row.swing||'');
 if(['in','out'].includes(row.swing))html+=choose('hinge','موضع المفصلة',[['','غير محدد'],['left','عند بداية البرواز'],['right','عند نهاية البرواز']],row.hinge||'');
 if(row.swing==='sliding')html+=choose('parking','موضع الضلفة بعد الفتح',[['','غير محدد'],['within','داخل الفتحة أو جيب الجدار'],['before','قبل البرواز'],['after','بعد البرواز']],row.parking||'');
 if(row.swing==='in'||row.swing==='sliding'&&['before','after'].includes(row.parking))html+=field('leafWidthMm','عرض الضلفة المتحركة',row.leafWidthMm);
 if(row.swing==='in')html+=field('hingeInsetMm','محور المفصلة من طرف البرواز',row.hingeInsetMm);
 if(row.swing==='sliding'&&['before','after'].includes(row.parking))html+=field('parkDepthMm','بروز الضلفة والسكة',row.parkDepthMm);
 return html;
}
// These are conflicts with a unit in the design. The survey and the unit keep
// their own positions; the design stage is where the rep reviews the layout.
function surveyDesignNote(checked,canOpenDesign){
 const notes=new Set(),k=checked.doc.kitchen;let firstUnit=null;
 for(const c of checked.designConflicts){
  const feature=checked.features.find(f=>c.ids.includes(f.id));
  const unit=k.units.find(u=>c.ids.includes(u.id));
  if(!feature||!unit)continue;
  firstUnit??=unit;
  const subject=c.type==='top-feature'?'سطح العمل في التصميم':unit.kind==='hood'?'جهاز شفاط الطبخ في التصميم':'وحدة «'+(kitchenUnitSpecs[unit.kind]?.label||unit.kind)+'» في التصميم';
  const measured=isOpening(feature.kind)?'فتحة '+(feature.kind==='window'?'الشباك':'الباب'):'موضع «'+(short[feature.kind]||chainLabels[feature.kind])+'»';
  notes.add(c.type==='door-swing'?subject+' يتداخل مع مسار فتح '+(feature.kind==='window'?'الشباك':'الباب')+'.':subject+' يتداخل مع '+measured+' بحسب قياس الجدار.');
 }
 if(!notes.size)return '';
 return '<div class="sv-design-note"><div><b>مراجعة عند التصميم</b>'+[...notes].map(t=>'<p>'+esc(t)+'</p>').join('')+'</div>'+
  (canOpenDesign?btn('design-review',firstUnit.kind==='hood'?'إظهار جهاز الشفاط في التصميم':'إظهار الوحدة في التصميم','data-design-unit="'+esc(firstUnit.id)+'"'):'')+'</div>';
}

// Validate all pending wall changes against the same working drawing before
// committing once. A failed second wall cannot leave the first wall applied.
export function prepareSurveySave(doc,changes,{remove=new Set(),restore=new Set()}={}){
 let work=doc;
 for(const [wall,chain] of changes){
  const prior=doc.room.workshop?.chains?.[wall]?.rows||[];
  if(!remove.has(wall)&&prior.some(r=>!mark(r.kind)&&!chain.rows.some(x=>x.id===r.id&&x.kind===r.kind)))
   return {ok:false,doc,wall,requires:'remove',reason:'سيُحذف من الرسم عنصر سبق رفعه على هذا الجدار.'};
  const out=applyChain(work,wall,chain,{restoreModified:restore.has(wall)});
  if(!out.ok)return {ok:false,doc,wall,reason:out.reason,requires:out.stale?'restore':undefined};
  work=out.doc;
 }
 return {ok:true,doc:work};
}

export function mountChainStep(host,{getDoc,apply,tell,onAdvance,onHistory,canHistory,focus={},localFace=null}){
 const wallList=()=>roomArchitecture(getDoc().room).walls;
 const drafts=new Map(),dirty=new Set(),signers=new Map(),removeOK=new Set(),restoreOK=new Set(),bases=new Map();
 let draftTimer=0,draftSaved=true,draftFailed=false;
 const selections=new Map(),scope=wallList();let wall=focus.wall||getDoc().room.workshop?.activeWall||scope[0].id;
 if(!scope.some(w=>w.id===wall))wall=scope[0].id;
 let selected=-1,extras='',expanded=false,more=!!focus.proof,proof=!!focus.proof,confirmAction='',onLeave=null,afterSave=null,notice='',hasError=false;
 let optionsPane=null,frame=0,reviewing=!localFace&&focus.review===true;
 let checkedSample=null,legacyLayout=false,recoverySource=null;
 function legacy(){
  const doc=getDoc();
  if(doc!==checkedSample){checkedSample=doc;legacyLayout=!localFace&&hasLegacySampleLayout(doc);}
  return legacyLayout;
 }
 const recoveryButton=()=>legacy()?btn('recover-layout','بدء الرفع بدون دواليب المثال'):'';
 const wallInfo=()=>wallList().find(w=>w.id===wall);
 let manual=false,lastReference=null,readingObserver=null;
 const ink=mountWallInk(host,{
  wall:()=>wall,room:()=>getDoc().room,chain:draft,dirty:()=>dirty.has(wall),selected:()=>selected,
  unadopted:drawingAvailable,draw,notify:say,onInspect:hit=>{lastReference=hit.referenceId;if(!hit.referenceId)selected=hit.index;manual=false;expanded=false;extras='';say('');},
  objectGapLabel:gapLabel,datumLabel:datum,readHit:sheetReading,missingReading:()=>missingMeasurement(draft().rows),editReading:(index,key,value)=>openReading(index,key,value),
  adoptDrawing,onPaint:syncNotebook,
  check:chain=>localFace?null:applyChain(getDoc(),wall,chain),
  replace(chain,index,isDirty){
   drafts.set(wall,chain);selected=index;manual=false;expanded=false;extras='';
   if(isDirty)markDirty();else{dirty.delete(wall);notice='';}
   draw();
  }
 });
 const pair=wallPairEditor(host,{getDoc,wall:()=>wall,shownLength:()=>wallInfo().length*10,staged:!!localFace,apply,draw,notify:say});
 const labelFor=w=>wallList().find(x=>x.id===w)?.label||w;
 function draft(){
  if(!drafts.has(wall))drafts.set(wall,structuredClone(getDoc().room.workshop?.chains?.[wall]||empty()));
  return drafts.get(wall);
 }
 function drawingAvailable(){return !draft().rows.length&&!dirty.has(wall)&&getDoc().kitchen.features.some(f=>f.wall===wall);}
 function signer(){if(!signers.has(wall)){const a=draft().attestation;signers.set(wall,{name:a?.name||'',ref:a?.reference||''});}return signers.get(wall);}
 function pendingSigner(only=null){
  for(const [id,s] of signers){
   if(only&&id!==only)continue;
   const a=(drafts.get(id)||getDoc().room.workshop?.chains?.[id])?.attestation;
   if(s.name.trim()!==(a?.name||'')||s.ref.trim()!==(a?.reference||''))return id;
  }
  return null;
 }
 function markDirty(){
  const firstEdit=!dirty.has(wall);dirty.add(wall);
  if(firstEdit)bases.set(wall,baseStamp(wall));
  scheduleDrafts();
  if(firstEdit){
   const map=host.querySelector('[data-chain-map]'),next=host.querySelector('[data-chain-act="next-wall"]');
   if(map)map.innerHTML=surveyWallMap(wallList(),wall,wallStatuses());
   if(next)next.textContent=wallList().at(-1).id===wall?'حفظ الجدار ومراجعة الرفع':'حفظ الجدار والانتقال للتالي';
  }
  removeOK.delete(wall);restoreOK.delete(wall);confirmAction='';afterSave=null;notice='';hasError=false;
 }
 function say(s,error=false){notice=s;hasError=error;const p=host.querySelector('[data-chain-notice]');if(p){p.textContent=s;p.classList.toggle('sv-error',error);}tell?.(s);}
 function selectWall(target){
  if(!wallList().some(w=>w.id===target))return;
  ink.clear();ink.forgetUndo();lastReference=null;manual=false;reviewing=false;
  selections.set(wall,selected);wall=target;selected=selections.get(wall)??-1;
  extras='';expanded=false;proof=false;more=false;confirmAction='';notice='';hasError=false;afterSave=null;
 }
 function datum(row,near=false){
  if(!row)return 'ركن البداية';
  if(centres[row.kind])return centres[row.kind];
  if(limits[row.kind])return limits[row.kind];
  const edge=isOpening(row.kind)?(near?'الطرف الخارجي الأول':'الطرف الخارجي البعيد'):(near?'الطرف الأول':'الطرف البعيد');
  return edge+' '+(edgeOf[row.kind]||'للعنصر');
 }
 function gapLabel(rows,i){
  return 'من '+datum(rows[i].from==='origin'?null:rows[i-1])+' إلى '+datum(rows[i],true);
 }
 function missingMeasurement(rows){
  for(let i=0;i<rows.length;i++){
   const r=rows[i];
   if(r.gapMm==null)return {i,key:'gapMm',text:'أدخل المسافة '+gapLabel(rows,i)+'.'};
   if(isOpening(r.kind)&&!r.frameRead&&r.widthMm==null)return {i,key:'widthMm',text:'أدخل عرض برواز '+(r.kind==='door'?'الباب':'الشباك')+' بين طرفيه الخارجيين.'};
   if(r.frameRead?.distanceMm===null)return {i,key:'frameDistance',text:'أدخل قياس الطرف الخارجي البعيد للبرواز.'};
   if(r.frameRead?.method==='opposite'&&r.frameRead.wallLengthMm==null)return {i,key:'frameWallLength',text:'أدخل طول الجدار المقاس بين الركنين.'};
  }
  return null;
 }
 function edit(r){
  const opening=isOpening(r.kind),service=pointKinds.has(r.kind);
  let main=field('gapMm',gapLabel(draft().rows,selected),r.gapMm);
  if(opening)main+=frameFields(r);
  else if(!service&&!mark(r.kind))main+=field('widthMm','عرض العنصر',r.widthMm);
  if(!mark(r.kind)){
   main+=field('bottomMm',service?'ارتفاع المركز عن الأرض':'ارتفاع الأسفل عن الأرض',r.bottomMm);
   if(!service)main+=field('heightMm','الارتفاع',r.heightMm);
  }
  let extra=choose('from','تُقاس المسافة من',[['previous','القياس السابق'],['origin','ركن بداية الجدار']],r.from||'previous');
  if(service)extra+=field('widthMm','عرض المخرج',r.widthMm)+field('heightMm','ارتفاع المخرج',r.heightMm);
  if(!mark(r.kind))extra+=field('depthMm','البروز من وجه الجدار',r.depthMm);
  const title=opening?'حركة الضلفة والبروز ومن أين تُقاس المسافة':mark(r.kind)?'من أين تُقاس المسافة وترتيب القياس':'البروز ومن أين تُقاس المسافة وترتيب القياس';
  return '<section class="sv-editor"><header><h3>قياس '+fmt(selected+1)+' · '+esc(short[r.kind])+'</h3>'+btn('done','إنهاء القياس','aria-label="إنهاء تحرير القياس"')+'</header><div class="sv-fields">'+main+'</div>'+
   '<details data-extra-fields '+(expanded?'open':'')+'><summary>'+title+'</summary><div class="sv-fields">'+(opening?motionFields(r):'')+extra+'</div><div class="sv-tools">'+
   btn('up','تقديم القياس',selected===0?'disabled':'')+btn('down','تأخير القياس',selected===draft().rows.length-1?'disabled':'')+btn('remove','حذف القياس','class="sv-remove"')+'</div></details></section>';
 }
 function status(){
  if(localFace)return dirty.has(wall)?'تعديل غير محفوظ':'مسودة المحيط';
  if(!dirty.has(wall)&&draft().source==='example')return 'قياسات المثال';
  return surveyNotebookSummary(getDoc(),wall,draft(),{dirty:dirty.has(wall)}).status;
 }
 function syncNotebook(){
  if(localFace||reviewing)return;
  syncSurveyNotebook(host,{doc:getDoc(),wall,walls:wallList(),chain:draft(),chains:drafts,dirty,
   pending:ink.provisional(),pendingWork:!!(dirty.size||ink.provisional()||pair.dirty()||pendingSigner()),canHistory,proof,
   selection:short[draft().rows[selected]?.kind]});
 }
 function notebookHistory(forward){
  if(localFace||!onHistory)return;
  if(dirty.size||ink.provisional()||pair.dirty()||pendingSigner()){
   say('أكمل القياس واحفظ الرفع أو ألغِ التعديل قبل تراجع المشروع.',true);return;
  }
  if(!canHistory?.(forward))return;
  ink.dismissInspection();
  const result=onHistory(forward,{wall});
  if(result?.ok===false){draw();say(result.reason||'تعذّر تغيير سجل المشروع.',true);}
 }
 function summary(){
  const d=draft(),doc=getDoc(),w=wallInfo(),resolved=resolveChain(doc.room,wall,d);
  const picture=host.querySelector('[data-survey-elevation]'),s=host.querySelector('[data-chain-summary]');
  if(!picture||!s)return;
  const endNote=host.querySelector('[data-end-hint]'),needsEnd=!localFace&&d.rows.length>0&&!hasEnd(d);
  if(endNote)endNote.hidden=!needsEnd;
  let readings=resolved.ok?resolved.readings:[];
  // Keep the unaffected prefix visible while typing an incomplete reading.
  if(!resolved.ok)for(let i=1;i<=d.rows.length;i++){const partial=resolveChain(doc.room,wall,{...d,rows:d.rows.slice(0,i)});if(!partial.ok)break;readings=partial.readings;}
  const proposed=drawingAvailable()?chainFromDrawing(doc,wall):null;
  const drawn=proposed?resolveChain(doc.room,wall,proposed):null;
  // CAD items can be placed before or after the first survey of this wall.
  // Keep independent drawings visible while the register remains field readings only.
  const claimed=new Set(d.rows.map(row=>row.featureId).filter(Boolean));
  const references=drawn?.ok?[]:doc.kitchen.features.filter(f=>f.wall===wall&&!claimed.has(f.id)&&linkedReadingIndex(doc.room,f)<0);
  picture.innerHTML=surveyWallSheet(drawn?.ok?proposed:d,drawn?.ok?drawn.readings:readings,w.length*10,doc.room.height*10,
   ink.objectTarget()??(ink.hasPending()&&!ink.existing()?-1:selected),references,w.start,d.rows.length||pair.active()?'':ink.paperPrompt(),!!drawn?.ok);
  for(const [i,row] of d.rows.entries()){
   const el=host.querySelector('[data-chain-position="'+i+'"]'),r=readings[i];
   if(el)el.textContent=r?fmt(r.refMm)+(r.nextMm!==r.refMm?' – '+fmt(r.nextMm):'')+' مم':Number.isFinite(row.gapMm)?fmt(row.gapMm)+' مم من المرجع':'قياس مطلوب';
  }
  let error='',range=null,designNote='';
  if(d.rows.length){
   if(!resolved.ok)error=missingMeasurement(d.rows)?.text||resolved.reason;
   else if(!localFace){
    const checked=applyChain(doc,wall,d);
    if(checked.ok){range=readChainRange(checked.doc,wall);if(!legacy())designNote=surveyDesignNote(checked,!!onAdvance);}
    else error=checked.reason;
   }
  }
  const showSpans=s.querySelector('details')?.open;
  if(error)s.innerHTML='<p class="sv-error">'+esc(error)+'</p>';
  else if(localFace&&d.rows.length)s.textContent=resolved.closed?'تطابق قياس ركن النهاية مع طول الجدار.':'المتبقي المحسوب حتى الركن '+fmt(resolved.remainingMm)+' مم.';
  else if(range){const total=a=>a.reduce((v,p)=>v+p.endMm-p.startMm,0);
   s.innerHTML=designNote+'<span>متاح للسفلي <b>'+fmt(total(range.baseSpans))+' مم</b></span><span>متاح للعلوي <b>'+fmt(total(range.upperSpans))+' مم</b></span>'+
    '<details'+(showSpans?' open':'')+'><summary>تفصيل الامتدادات</summary>'+[['السفلي',range.baseSpans],['العلوي',range.upperSpans]].map(([title,sp])=>'<p>'+title+' · '+(sp.length?sp.map(p=>'<bdi>'+fmt(p.startMm)+' – '+fmt(p.endMm)+'</bdi>').join('، ')+' مم':'دون مساحة')+'</p>').join('')+
    '<p>'+(resolved.closed?'تطابق مجموع السلسلة مع طول الجدار.':'تبقى '+fmt(resolved.remainingMm)+' مم إلى الركن.')+'</p></details>';
  }else s.textContent=proposed?'راجع مقاسات الرسم في الموقع قبل توثيقها.':'';
  ink.syncSheet();ink.paint();if(pair.active())pair.paint();
  const p=host.querySelector('[data-chain-state]');if(p){p.textContent=ink.draftStatus()||(d.rows.length||dirty.has(wall)?status():proposed?'عناصر من الرسم':'لا توجد قياسات');p.classList.toggle('sv-dirty',dirty.has(wall)||ink.provisional());}
 }
 function confirmation(){
  if(ink.hasGuard())return ink.guard();
  if(localFace&&onLeave)return '<div class="sv-guard" role="alert"><b>تجاهل تعديلات هذا الجدار؟</b><div>'+btn('stay','البقاء هنا','class="sv-primary"')+btn('leave-discard','تجاهل التعديلات')+'</div></div>';
  const pending=pendingSigner();
  if(onLeave&&!confirmAction&&pending)return '<div class="sv-guard" role="alert"><b>بيانات توثيق لم تُعتمد · '+esc(labelFor(pending))+'</b><div>'+btn('review-proof','مراجعة التوثيق','class="sv-primary"')+btn('omit-proof','تجاهل بيانات التوثيق')+btn('stay','البقاء هنا')+'</div></div>';
  if(onLeave&&!confirmAction)return '<div class="sv-guard" role="alert"><b>لديك قياسات غير محفوظة</b><div>'+btn('leave-save','حفظ ومتابعة','class="sv-primary"')+btn('leave-discard','متابعة دون حفظ')+btn('stay','البقاء هنا')+'</div></div>';
  if(confirmAction==='recover-layout')return '<div class="sv-guard" role="alert"><b>إزالة توزيع المثال من هذا المشروع؟</b><p>ستُزال وحدات المثال وعددها '+fmt(getDoc().kitchen.units.length)+' مع صفوفها. تبقى قياسات الجدران والفتحات والخدمات، ويمكن استعادة التوزيع من تراجع المشروع.</p><div>'+btn('recover-confirm','إزالة دواليب المثال')+btn('cancel','الاحتفاظ بالتوزيع')+'</div></div>';
  if(confirmAction==='remove'||confirmAction==='restore')return '<div class="sv-guard" role="alert"><b>'+esc(labelFor(wall))+'</b><p>'+esc(notice)+'</p><div>'+btn('accept',confirmAction==='remove'?'تأكيد حذف العنصر من الرسم':'استخدام قياس الرفع بدل الرسم')+btn('cancel','إلغاء')+'</div></div>';
  return '';
 }
 function wallStatuses(){
  const saved=getDoc().room.workshop?.chains||{};
  return Object.fromEntries(wallList().map(w=>[w.id,dirty.has(w.id)?'draft':saved[w.id]?.rows?.length?'saved':'']));
 }
 function wallReview(){
  const doc=getDoc(),walls=wallList(),saved=doc.room.workshop?.chains||{},states=wallStatuses();
  const details=walls.map((w,i)=>{
   const chain=drafts.get(w.id)||saved[w.id],rows=chain?.rows||[],checked=rows.length?resolveChain(doc.room,w.id,chain):null;
   const status=states[w.id]==='draft'?'مسودة غير محفوظة':states[w.id]==='saved'?'محفوظ':'لم يُرفع';
   const endpoint=checked?.ok?(checked.closed?'إغلاق الركن مطابق':rows.some(r=>r.kind==='stop')?'نهاية الدواليب مسجلة':'القياس حتى آخر عنصر'):'';
   return '<button type="button" class="sv-review-wall" data-state="'+(states[w.id]||'empty')+'" data-survey-wall-id="'+esc(w.id)+'"><strong>'+fmt(i+1)+' · '+esc(w.label)+'</strong><span>'+fmt(w.length*10)+' مم · '+measureCount(rows.length)+'</span><span class="site-wall-status">'+status+(endpoint?' · '+endpoint:'')+'</span></button>';
  }).join('');
  const scope=doc.room.workshop?.decisionReview,chains=walls.map(w=>drafts.get(w.id)||saved[w.id]);
  const ready=chains.some(hasEnd),hint=ready?'':chains.some(c=>c?.rows?.length)?walkNeedsEnd:walkNeedsAnything;
  const next=scope?.active&&scope.walls?.length?'متابعة نطاق الدواليب المحدد':'تحديد جدران الدواليب مع العميل';
  return '<section class="kc-step sv sv-walk-review"><h2>مراجعة رفع الجدران</h2><p>اختر جدارًا للرجوع إلى قياساته.</p><div class="site-wall-review"><div class="site-review-map">'+surveyWallMap(walls,wall,states,true)+'</div><div class="sv-review-list">'+details+'</div></div>'+recoveryButton()+'<footer class="sv-footer">'+confirmation()+
   (hint?'<p class="sv-review-hint" id="sv-review-hint">'+esc(hint)+'</p>':'')+
   '<p data-chain-notice role="status">'+esc(notice)+'</p><div class="sv-footer-actions">'+btn('back-to-wall','رجوع للجدار')+
   btn('finish-walk',next,'class="sv-primary"'+(ready?'':' disabled aria-describedby="sv-review-hint"'))+'</div></footer></section>';
 }
 function draw(focusSelector){
  scheduleDrafts();
  const stripOffset=host.querySelector('.sv-readings')?.scrollLeft||0;
  readingObserver?.disconnect();
  if(frame){cancelAnimationFrame(frame);frame=0;}
  if(reviewing){
   host.innerHTML=wallReview();
   if(focusSelector)host.querySelector(focusSelector)?.focus({preventScroll:true});
   return;
  }
  const d=draft(),w=wallInfo(),row=d.rows[selected],who=signer(),state=confirmation();
  const walls=wallList(),i=walls.findIndex(v=>v.id===wall),last=i===walls.length-1;
  const previous=walls[(i+walls.length-1)%walls.length],next=walls[(i+1)%walls.length];
  const tail=d.rows.filter(r=>r.kind!=='corner').at(-1);
  const add=(k,txt=short[k])=>'<button type="button" data-add-reading="'+k+'"'+(endHint[k]?' title="'+endHint[k]+'"':'')+'>'+esc(txt)+'</button>';
  const nextCaption=last?(dirty.has(wall)?'حفظ الجدار ومراجعة الرفع':'مراجعة رفع الجدران'):
   dirty.has(wall)?'حفظ الجدار والانتقال للتالي':d.rows.length?'الجدار التالي':'الجدار التالي · دون قياس هذا الجدار';
  const pairRecorded=!!getDoc().room.workshop?.wallPairs?.[wall];
  const pairLabel=pairRecorded?'مراجعة قياس الظهر والوجه':'قياس الظهر والوجه';
  // Back-and-face is only needed when a wall is not square; it is never required to go on, and the button says so.
  const pairAction=actionIcon('pair','ruler',pairLabel,'aria-expanded="'+pair.active()+'"',pairRecorded?'الظهر والوجه':'الظهر والوجه · اختياري');
  const browseReadings=(direction,icon,title)=>'<button type="button" data-browse-readings="'+direction+'" aria-label="'+title+'" title="'+title+'">'+studioIcon(icon)+'</button>';
  const pairInspector=pair.active()?pair.html():'<div class="sv-ink-layer">'+ink.editor()+'</div>'+ink.note();
  const heading=localFace?'<header class="sv-heading"><strong>'+esc(localFace.label||'عناصر الجدار')+'</strong><span>'+fmt(w.length*10)+' مم</span></header>':'<header class="sv-heading sv-walk-head"><div class="sv-wall-meta"><small class="sv-wall-index">الجدار '+fmt(i+1)+' من '+fmt(walls.length)+' <span class="site-reading-count">· '+measureCount(d.rows.length)+'</span></small><label><span>الجدار</span><select data-chain-wall>'+choices(walls.map(w=>[w.id,w.label]),wall)+'</select></label>'+
   '<p class="sv-datums">من الركن مع '+esc(previous.label)+' إلى الركن مع '+esc(next.label)+'</p><div class="sv-wall-length">طول الجدار <b>'+fmt(w.length*10)+' مم</b></div></div>'+
   '<div class="sv-map-box" data-chain-map>'+surveyWallMap(walls,wall,wallStatuses())+'</div></header>';
  host.innerHTML='<section class="kc-step sv">'+
   '<div class="sv-work"><div class="sv-plate"><div class="sv-survey-card"><div data-ink-canvas class="sv-ink-canvas">'+heading+'<div class="sv-paper-desk"><div class="sv-workbar">'+(pair.active()?'<b class="sv-bar-caption">قياس الظهر والوجه</b>':ink.toolbar())+ink.viewTools()+'</div><div data-wall-ink-tool="'+ink.drawingTool()+'" data-wall-ink-active="'+ink.active()+'" data-survey-elevation class="sv-elevation"></div></div><div class="sv-ink-aside"><div class="sv-statusline"><span data-chain-state role="status"></span></div>'+(localFace?'':'<div class="sv-ends-hint" data-end-hint hidden><p>'+esc(endNeeded)+'</p><div class="sv-ends-actions">'+add('stop','نهاية الدواليب')+add('corner','ركن نهاية الجدار')+'</div></div>')+pairInspector+
   '<div class="sv-reading-tray">'+browseReadings('previous','previous','عرض القياسات السابقة')+'<div class="sv-readings" role="group" aria-label="اختر قياسًا من الجدار">'+(d.rows.length?d.rows.map((r,i)=>'<button type="button" data-chain-row="'+i+'" aria-pressed="'+(i===selected)+'" aria-label="قياس '+fmt(i+1)+'، '+esc(short[r.kind])+'">'+surveySymbol(r.kind)+'<span>'+esc(short[r.kind])+'<small data-chain-position="'+i+'"></small></span><i aria-hidden="true">'+fmt(i+1)+'</i></button>').join(''):drawingAvailable()?btn('adopt','استخدام عناصر الرسم للرفع'):'')+'</div>'+browseReadings('next','next','عرض القياسات التالية')+'</div></div></div></div><div class="sv-totals" data-chain-summary></div></div>'+
   '<div class="sv-form">'+(pair.active()?'':'<div class="sv-pair-entry">'+pairAction+'</div>')+'<details class="sv-ink-manual" data-ink-manual '+(manual?'open':'')+'><summary title="إدخال تفصيلي بالأرقام">'+studioIcon('keyboard')+'<span>إدخال بالأرقام</span></summary><div class="sv-add"><p class="sv-next-label">'+(d.rows.at(-1)?.kind==='corner'&&resolveChain(getDoc().room,wall,d).closed?'اكتمل إغلاق الجدار. اختر عنصرًا من الرسم لمراجعته.':tail?'القياس التالي من '+esc(datum(tail)):'القياس الأول من ركن البداية')+'</p>'+
   '<div class="sv-context" role="group" aria-label="إضافة عنصر إلى الجدار">'+add('door','+ باب')+add('window','+ شباك')+btn('services','+ خدمة','aria-expanded="'+(extras==='services')+'"')+btn('others','أخرى','aria-expanded="'+(extras==='others')+'"')+'</div>'+
   (extras?'<div class="sv-kinds">'+(extras==='services'?serviceKinds:otherKinds).map(k=>add(k)).join('')+'</div>':'')+
   '</div>'+(row&&!ink.existing()?edit(row):'')+'</details>'+
   '<div class="sv-ends">'+add('stop','نهاية الدواليب')+add('corner','ركن نهاية الجدار')+'</div>'+(localFace?'':'<div class="sv-secondary">'+actionIcon('options','settings','خيارات الجدار')+actionIcon('tools','more','المزيد من أدوات الرفع','aria-expanded="'+more+'"')+'</div>')+
   (more?'<div class="sv-more">'+btn('proof','توثيق ميداني','aria-expanded="'+proof+'"')+recoveryButton()+'</div>':'')+
   (proof?'<div class="sv-proof"><h3>توثيق ميداني لهذا الجدار</h3><div class="sv-fields"><label>اسم الفني<input data-chain-technician maxlength="160" value="'+esc(who.name)+'"></label><label>مرجع الرفع أو الزيارة<input data-chain-reference maxlength="160" value="'+esc(who.ref)+'"></label></div>'+btn('attest','تأكيد القياسات الميدانية')+btn('discard-proof','تجاهل بيانات التوثيق غير المعتمدة')+'</div>':'')+
   '<div data-local-options></div></div></div><footer class="sv-footer">'+state+'<p data-chain-notice role="status" class="'+(hasError?'sv-error':'')+'">'+esc(state?'':notice)+'</p>'+
   (!localFace&&!state&&ink.objectTarget()!=null?'<div class="sv-footer-actions sv-object-save-footer" data-object-save-footer hidden><small>العنصر المحدد · '+esc(short[row?.kind]||'قياس')+'</small>'+btn('save-object','تطبيق التعديل وحفظ الجدار','class="sv-primary"')+'<button type="button" data-ink-action="cancel">إلغاء التعديل</button></div>':'')+'<div class="sv-footer-actions" data-wall-save-footer>'+
   (localFace?btn('save-face','حفظ عناصر هذا الجدار','class="sv-primary"')+btn('close-face','رجوع إلى المحيط'):
    actionIcon('previous-wall','previous','الجدار السابق',i===0?'disabled':'')+actionIcon('save','save',dirty.size>1?'حفظ الجدران ('+fmt(dirty.size)+')':'حفظ الرفع')+
   actionIcon('next-wall','next',nextCaption,'class="sv-primary"',nextCaption)+(!last?actionIcon('review','list','مراجعة رفع الجدران'):''))+'</div></footer></section>';
  if(!localFace)arrangeSurveyNotebook(host);
  summary();
  if(optionsPane===wall&&!onAdvance)mountWallOptions(host.querySelector('[data-local-options]'),{getDoc,apply,wall,onSaved:summary});
  const strip=host.querySelector('.sv-readings'),chip=host.querySelector('[data-chain-row="'+selected+'"]');
  if(strip){
   const tray=strip.parentElement;
   const pageButtons=tray?.querySelectorAll('[data-browse-readings]');
   if(pageButtons?.length){
    const syncPaging=()=>{
     const horizontal=getComputedStyle(strip).flexDirection==='row';
     tray.toggleAttribute('data-overflow',horizontal&&strip.scrollWidth>tray.clientWidth+1);
     const position=Math.abs(strip.scrollLeft);
     pageButtons[0].disabled=position<1;
     pageButtons[1].disabled=position>=strip.scrollWidth-strip.clientWidth-1;
     syncNotebook();
    };
    syncPaging();strip.addEventListener('scroll',syncPaging,{passive:true});
    if(typeof ResizeObserver!=='undefined'){readingObserver=new ResizeObserver(syncPaging);readingObserver.observe(tray);const desk=host.querySelector('.sv-paper-desk');if(desk)readingObserver.observe(desk);}
   }
   strip.scrollLeft=stripOffset;
   if(row&&chip){
    const viewport=strip.getBoundingClientRect(),box=chip.getBoundingClientRect();
    if(box.left<viewport.left)strip.scrollLeft+=box.left-viewport.left;
    else if(box.right>viewport.right)strip.scrollLeft+=box.right-viewport.right;
   }
  }
  if(focusSelector){
   const item=host.querySelector(focusSelector);item?.focus({preventScroll:true});
   if(focusSelector==='[data-chain-prop="gapMm"]'||focusSelector==='[data-chain-technician]')item?.scrollIntoView?.({block:'nearest'});
  }
 }
 function commit(proceed=null,{only=null,nextWall=null}={}){
  const doc=getDoc(),ids=only?[only]:[...dirty];
  if(!ids.length){
   if(proceed){proceed();return true;}
   if(!draft().rows.length){say('أضف قياسًا للجدار أولًا.',true);return false;}
   say('لا توجد تعديلات جديدة للحفظ.');return true;
  }
  const out=prepareSurveySave(doc,ids.map(k=>[k,drafts.get(k)||doc.room.workshop?.chains?.[k]]),{remove:removeOK,restore:restoreOK});
  if(!out.ok){
   if(wall!==out.wall||reviewing)selectWall(out.wall);
   if(out.requires){confirmAction=out.requires;afterSave=()=>commit(proceed,{only,nextWall});}
   else{onLeave=null;afterSave=null;}
   notice=out.requires?out.reason:missingMeasurement(draft().rows)?.text||out.reason;hasError=true;draw(out.requires?'[data-chain-act="accept"]':undefined);say(notice,true);return false;
  }
  const next=nextWall?{...out.doc,room:{...out.doc.room,workshop:{...out.doc.room.workshop,activeWall:nextWall}}}:out.doc;
  const saved=apply(next,'حُفظت قياسات الرفع في الرسم.');
  if(saved?.ok===false||saved?.saved===false){say(saved.reason||'تعذّر حفظ الرفع. بقيت القياسات في المسودة.',true);return false;}
  ink.forgetUndo();ids.forEach(id=>{drafts.delete(id);dirty.delete(id);removeOK.delete(id);restoreOK.delete(id);});
  confirmAction='';onLeave=null;afterSave=null;notice='حُفظت قياسات الرفع.';hasError=false;
  if(proceed)proceed();else draw();return true;
 }
 function reviewWalk(){
  reviewing=true;notice='';confirmAction='';onLeave=null;afterSave=null;draw('[data-chain-act="back-to-wall"]');
 }
 function forward(){
  const walls=wallList(),next=walls[walls.findIndex(w=>w.id===wall)+1];
  if(pendingSigner(wall)){
   more=proof=true;draw('[data-chain-technician]');say('أكمل توثيق الجدار أو تجاهل بيانات التوثيق للمتابعة.',true);return;
  }
  const go=()=>{if(!next){reviewWalk();return;}selectWall(next.id);draw('[data-chain-wall]');};
  if(dirty.has(wall))commit(go,{only:wall,nextWall:next?.id});else go();
 }
 function addReading(kind){
  manual=true;ink.forgetUndo();
  if(!kinds.includes(kind))return;
  if(kind==='corner'&&drawingAvailable()){say('توجد عناصر مرسومة على هذا الجدار. اختر «استخدام عناصر الرسم للرفع» وراجعها قبل قياس ركن النهاية.',true);return;}
  const d=draft();if(d.rows.length>=64){say('يقبل الجدار ٦٤ قياسًا كحد أقصى.',true);return;}
  const fixed=d.rows.findIndex(r=>r.kind===kind);
  if(mark(kind)&&fixed>=0){selected=fixed;extras='';expanded=false;draw('[data-chain-prop="gapMm"]');return;}
  const end=d.rows.findIndex(r=>r.kind==='corner');
  const at=end>=0?end:d.rows.length,prior=d.rows.slice(0,at);
  // Adding at the tail always uses the far datum of the last complete row.
  // A physical corner may itself need revising after a feature is inserted.
  let problem=missingMeasurement(prior);
  const room=getDoc().room;
  if(!problem&&prior.length&&!resolveChain(room,wall,{...d,rows:prior}).ok){
   for(let i=0;i<prior.length;i++){
    const check=resolveChain(room,wall,{...d,rows:prior.slice(0,i+1)});
    if(!check.ok){problem={i,key:'gapMm',text:check.reason};break;}
   }
  }
  if(problem){
   selected=problem.i;expanded=false;extras='';
   draw('[data-chain-prop="'+problem.key+'"]');say(problem.text,true);return;
  }
  const reading=newChainRow(kind,nextId(d.rows));
  reading.gapMm=null;
  if(isOpening(kind))reading.widthMm=null;
  d.rows.splice(at,0,reading);selected=at;expanded=false;extras='';markDirty();draw('[data-chain-prop="gapMm"]');
  host.querySelector('[data-chain-prop="gapMm"]')?.select?.();
 }
 function sheetReading(key){
  if(key==null||key==='')return null;
  const reference=String(key).startsWith('cad:'),fromDrawing=reference||drawingAvailable();
  const doc=getDoc(),d=fromDrawing?chainFromDrawing(doc,wall):draft();
  const index=reference?d.rows.findIndex(r=>r.featureId===key.slice(4)):Number(key),row=d.rows[index];
  if(!row)return null;
  const solved=resolveChain(doc.room,wall,{...d,rows:d.rows.slice(0,index+1)}),ref=solved.readings?.[index];
  return ref?{row,index,key:reference?key:index,referenceId:fromDrawing?row.featureId:null,stationMm:ref.refMm,widthMm:ref.nextMm-ref.refMm}:null;
 }
 function adoptDrawing(){
   if(!drawingAvailable())return;
   const chain=chainFromDrawing(getDoc(),wall);drafts.set(wall,chain);markDirty();
   selected=Math.max(0,chain.rows.findIndex(r=>r.featureId===lastReference));draw();
 }
 function openReading(index,key,value){
   const hit=sheetReading(index);
   if(hit?.referenceId){ink.selectObject(hit,key,value==null?{}:{[key]:value});return;}
   if(!Number.isInteger(index)||!draft().rows[index])return;
   selected=index;expanded=false;extras='';notice='';
   const row=draft().rows[index];
   const caption={gapMm:gapLabel(draft().rows,index),widthMm:isOpening(row.kind)?'عرض البرواز كاملًا':'عرض العنصر',
    bottomMm:pointKinds.has(row.kind)?'ارتفاع المركز عن الأرض':'ارتفاع الأسفل عن الأرض',heightMm:'الارتفاع',
    frameDistance:row.frameRead?.method==='opposite'?'من الطرف البعيد إلى الركن المقابل':'من ركن البداية إلى الطرف البعيد'};
   if(measuredFields.has(key)&&ink.selectDim(index,key,caption[key],value)){manual=false;return;}
   manual=true;
   const numeric=measuredFields.has(key)||key==='frameWallLength';
   const target=numeric?'[data-chain-prop="'+key+'"]':'[data-chain-row="'+selected+'"]';
   draw(target);if(numeric)host.querySelector(target)?.select?.();
 }
 function click(e){
  const b=e.target.closest('button,[data-chain-hit],[data-survey-wall-id],[data-ink-edit],[data-survey-pair]');if(!b)return;
  if(b.dataset.chainAct==='notebook-undo'||b.dataset.chainAct==='notebook-redo'){notebookHistory(b.dataset.chainAct==='notebook-redo');return;}
  if(b.dataset.chainAct==='notebook-focus'){host.querySelector('[data-ink-value]')?.focus();return;}
  if(b.dataset.browseReadings){
   const strip=host.querySelector('.sv-readings'),next=b.dataset.browseReadings==='next';
   const direction=getComputedStyle(strip).direction==='rtl'?-1:1;
   strip.scrollBy({left:(next?1:-1)*direction*Math.max(44,strip.clientWidth-44)});
   return;
  }
  if(b.hasAttribute('data-ink-camera')){ink.handleClick(b);return;}
  if(b.dataset.pairAct){pair.act(b.dataset.pairAct);return;}
  if(b.dataset.chainAct==='pair'||b.hasAttribute('data-survey-pair')){
   ink.dismissInspection();if(ink.hasPending()){say('ثبّت قياس الرسم الجاري أو ألغِه ثم افتح قياس الظهر والوجه.',true);return;}
   if(!pair.active()){manual=false;pair.open();}else host.querySelector('[data-pair-value="back"]')?.focus();
   return;
  }
  if(pair.active()){
   if(pair.dirty()){say('احفظ قياسي الظهر والوجه أو تجاهل التعديل قبل المتابعة.',true);return;}
   pair.reset();
  }
  if(b.dataset.chainAct==='save-object'){
   if(!localFace&&!ink.hasGuard()&&ink.editedReading()&&ink.confirm())commit(null,{only:wall});
   return;
  }
  if(ink.handleClick(b))return;
  ink.dismissInspection();
  if(ink.hasPending()){
   if(b.dataset.chainAct==='close-face'&&localFace){requestLeave(localFace.close);return;}
   say('ثبّت القياسات أو ألغِ الرسم قبل المتابعة.',true);return;
  }
  if(b.dataset.surveyWallId&&!localFace){selectWall(b.dataset.surveyWallId);draw('[data-chain-wall]');return;}
  const position=b.dataset.chainRow??b.dataset.chainHit;
  if(position!=null){
   const hit=sheetReading(position);
   if(hit&&!b.dataset.chainFocus){
    ink.selectObject(hit,e.detail===0||e.key?'gapMm':undefined);return;
   }
   openReading(b.dataset.chainRow!=null?Number(position):hit?.key,b.dataset.chainFocus);return;
  }
  if(b.dataset.chainAct==='reading-details'&&selected>=0){
   manual=true;expanded=true;draw('[data-chain-prop="gapMm"]');return;
  }
  if(b.hasAttribute('data-add-reading')){addReading(b.dataset.addReading);return;}
  const a=b.dataset.chainAct;if(!a)return;
  if(localFace){
   if(a==='save-face'){
    const d=draft(),missing=missingMeasurement(d.rows),resolved=resolveChain(getDoc().room,wall,d);
    if(missing){selected=missing.i;draw('[data-chain-prop="'+missing.key+'"]');say(missing.text,true);return;}
    if(!resolved.ok){say(resolved.reason,true);return;}
    const result=localFace.save(d);if(result===false||result?.ok===false){say(result?.reason||'تعذّر حفظ قياسات الجدار في مسودة المحيط.',true);return;}
    dirty.delete(wall);onLeave=null;return;
   }
   if(a==='close-face'){if(requestLeave(localFace.close))localFace.close();return;}
   if(!['services','others','up','down','remove','done','stay','leave-discard'].includes(a))return;
  }
  if(a==='design-review'){onAdvance?.('placement',{unitId:b.dataset.designUnit});return;}
  if(a==='save'){commit();return;}
  if(a==='next-wall'){forward();return;}
  if(a==='previous-wall'){const walls=wallList(),previous=walls[walls.findIndex(w=>w.id===wall)-1];if(previous){selectWall(previous.id);draw('[data-chain-wall]');}return;}
  if(a==='review'||a==='advance'){reviewWalk();return;}
  if(a==='back-to-wall'){reviewing=false;draw('[data-chain-wall]');return;}
  if(a==='finish-walk'){
   const pending=pendingSigner();if(pending){selectWall(pending);more=proof=true;draw('[data-chain-technician]');say('أكمل التوثيق أو تجاهل بياناته قبل مغادرة الرفع.',true);return;}
   commit(()=>{
    const doc=getDoc(),selected=doc.room.workshop?.decisionReview;
    if(!wallList().some(w=>surveyedDesignRange(doc,w.id))){say('أكمل جدارًا واحدًا على الأقل بقياس الركن أو بتسجيل نهاية الدواليب، ثم احفظه.',true);return;}
    if(selected?.active&&selected.walls?.length&&selected.walls.every(w=>surveyedDesignRange(doc,w)))onAdvance?.('whole');
    else onAdvance?.('decisions',{chooseWalls:true});
   });
   return;
  }
  if(a==='services'||a==='others'){extras=extras===a?'':a;draw('[data-chain-act="'+a+'"]');return;}
  if(a==='tools'){more=!more;proof=false;draw('[data-chain-act="tools"]');return;}
  if(a==='proof'){proof=!proof;draw(proof?'[data-chain-technician]':'[data-chain-act="proof"]');return;}
  if(a==='discard-proof'){signers.delete(wall);proof=false;draw('[data-chain-act="tools"]');return;}
  if(a==='attest'){const s=signer(),r=attestChain(getDoc(),wall,draft(),{name:s.name,reference:s.ref});if(!r.ok){say(r.reason,true);return;}drafts.set(wall,r.chain);markDirty();commit(null,{only:wall});return;}
  if(a==='options'){if(onAdvance)onAdvance('wallOptions',{wall});else{optionsPane=optionsPane===wall?null:wall;draw();}return;}
  if(a==='recover-layout'||a==='recover-confirm'){
   const doc=getDoc();
   if(!legacy()||a==='recover-confirm'&&(confirmAction!=='recover-layout'||recoverySource!==doc))return;
   if(dirty.size||pendingSigner()||pair.dirty()){say('احفظ قياسات الرفع والتعديلات المعلّقة أولًا.',true);return;}
   if(a==='recover-layout'){recoverySource=doc;confirmAction=a;draw('[data-chain-act="cancel"]');return;}
   const next={...doc,kitchen:{...doc.kitchen,runs:[],units:[]}};
   const result=apply(next,'أُزيلت دواليب المثال. يمكنك متابعة رفع الجدران.');
   if(result?.ok===false||result?.saved===false){confirmAction='';recoverySource=null;draw();say(result.reason||'تعذّر حفظ التغيير.',true);return;}
   confirmAction='';recoverySource=null;more=false;draw();return;
  }
  if(a==='review-proof'){const pending=pendingSigner();onLeave=null;if(pending)selectWall(pending);more=proof=true;draw('[data-chain-technician]');return;}
  if(a==='omit-proof'){const pending=pendingSigner();if(pending)signers.delete(pending);if(!pendingSigner()&&!dirty.size){const proceed=onLeave;onLeave=null;proceed?.();}else draw();return;}
  if(a==='leave-save'){commit(onLeave);return;}
  if(a==='leave-discard'){const callback=onLeave;onLeave=null;dirty.clear();drafts.clear();signers.clear();callback?.();return;}
  if(a==='stay'||a==='cancel'){onLeave=null;afterSave=null;confirmAction='';notice='';draw('[data-chain-act="save"]');return;}
  if(a==='accept'){(confirmAction==='remove'?removeOK:restoreOK).add(wall);confirmAction='';const retry=afterSave;afterSave=null;retry?.();return;}
  if(a==='adopt'){adoptDrawing();return;}
  if(a==='done'){
   const missing=missingMeasurement(draft().rows.slice(0,selected+1));if(missing){say(missing.text,true);return;}
   const i=selected;selected=-1;expanded=false;draw('[data-chain-row="'+i+'"]');return;
  }
  const d=draft();if(selected<0)return;
  if(a==='remove'){ink.forgetUndo();d.rows.splice(selected,1);selected=-1;}
  else if(a==='up'||a==='down'){ink.forgetUndo();const to=selected+(a==='up'?-1:1);if(to<0||to>=d.rows.length)return;[d.rows[selected],d.rows[to]]=[d.rows[to],d.rows[selected]];selected=to;}
  else return;
  markDirty();draw();
 }
 function record(e){
  const t=e.target,key=t.dataset.chainProp;
  if(t.hasAttribute('data-chain-technician')){signer().name=t.value;syncNotebook();return;}
  if(t.hasAttribute('data-chain-reference')){signer().ref=t.value;syncNotebook();return;}
  if(!key||selected<0)return;ink.forgetUndo();
  const r=draft().rows[selected];if(!r)return;
  if(key==='frameMethod'){
   const current=resolveChain(getDoc().room,wall,draft()),old=current.ok&&current.readings[selected];
   if(t.value==='width'){if(old)r.widthMm=old.nextMm-old.refMm;delete r.frameRead;}
   else r.frameRead={method:t.value,distanceMm:null,...(t.value==='opposite'?{wallLengthMm:null}:{})};
  }else if(['swing','hinge','parking','from'].includes(key)){
   if(t.value)r[key]=t.value;else delete r[key];
   if(key==='swing'){
    if(!['in','out'].includes(r.swing)){delete r.hinge;delete r.hingeInsetMm;}
    if(r.swing!=='sliding'){delete r.parking;delete r.parkDepthMm;}delete r.leafWidthMm;
   }
  }else{
   const value=assistNumber(t.value);
   if(key==='frameDistance'||key==='frameWallLength')r.frameRead[key==='frameDistance'?'distanceMm':'wallLengthMm']=value;
   else r[key]=value;
  }
  markDirty();
  if(t.tagName==='SELECT'){expanded=Boolean(host.querySelector('[data-extra-fields]')?.open);draw('[data-chain-prop="'+key+'"]');}
  else{const p=host.querySelector('[data-chain-notice]');if(p)p.textContent='';if(!frame)frame=requestAnimationFrame(()=>{frame=0;summary();});}
 }
 function input(e){if(pair.input(e.target))return;if(ink.fieldInput(e.target))return;if(e.target.tagName!=='SELECT')record(e);}
 function change(e){
  if(e.target.tagName==='SELECT'&&pair.input(e.target))return;
  if(e.target.hasAttribute('data-chain-wall')){
   if(pair.dirty()){e.target.value=wall;say('احفظ قياسي الظهر والوجه أو تجاهل التعديل قبل تغيير الجدار.',true);return;}
   pair.reset();
   ink.dismissInspection();if(ink.hasPending()){e.target.value=wall;say('ثبّت القياسات أو ألغِ الرسم قبل تغيير الجدار.',true);return;}
   selectWall(e.target.value);draw('[data-chain-wall]');return;}
  if(e.target.tagName==='SELECT')record(e);
 }
 function toggle(e){pair.toggle(e.target);if(e.target.hasAttribute?.('data-ink-manual'))manual=e.target.open;if(e.target.hasAttribute?.('data-extra-fields'))expanded=e.target.open;}
 function sheetKey(e){
  if(!localFace&&!e.defaultPrevented&&(e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(e.key.toLowerCase())&&!e.target.closest?.('input,textarea,select,[contenteditable="true"]')){
   e.preventDefault();e.stopPropagation();notebookHistory(e.key.toLowerCase()==='y'||e.shiftKey);return;
  }
  if(!e.defaultPrevented&&['Enter',' '].includes(e.key)&&e.target.matches?.('.wsheet-item,[data-survey-wall-id][role=button]')){
   e.preventDefault();e.stopPropagation();click(e);
  }
 }
 host.addEventListener('keydown',sheetKey);host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('change',change);host.addEventListener('toggle',toggle,true);
 // Readings typed but not saved are kept in the browser as they change, so a reload, a closed tab or a phone call does not take them away.
 const projectId=()=>getDoc().room.projectId;
 const baseStamp=w=>stableHash(JSON.stringify(getDoc().room.workshop?.chains?.[w]||null,(_,v)=>plainObject(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v));
 function writeDrafts(){
  if(localFace)return true;
  clearTimeout(draftTimer);draftTimer=0;
  const id=projectId(),walls={};
  for(const w of dirty){const chain=drafts.get(w);if(chain)walls[w]={chain,base:bases.get(w)??baseStamp(w)};}
  let ok=true;
  if(Object.keys(walls).length)ok=writeDraft('survey',id,{walls,page:pageToken});else clearDraft('survey',id);
  draftSaved=ok;
  if(!ok&&!draftFailed){draftFailed=true;say('تعذّر الحفظ التلقائي لقياساتك في هذا المتصفح. احفظ الجدار قبل مغادرة الصفحة.',true);}
  return ok;
 }
 function scheduleDrafts(){if(localFace)return;draftSaved=false;if(!draftTimer)draftTimer=setTimeout(writeDrafts,400);}
 function restoreDrafts(){
  if(localFace)return;
  const saved=readDraft('survey',projectId()),entries=saved?.payload?.walls;
  if(!plainObject(entries))return;
  const known=new Set(wallList().map(w=>w.id)),restored=[];let moved=false;
  for(const [id,entry] of Object.entries(entries)){
   const chain=known.has(id)&&plainObject(entry)?restoredDraft(entry.chain):null;if(!chain)continue;
   drafts.set(id,chain);dirty.add(id);bases.set(id,String(entry.base??''));restored.push(id);
   if(entry.base!==baseStamp(id))moved=true;
  }
  if(!restored.length)return;
  draftSaved=true;
  if(!focus.wall&&!focus.featureId&&!restored.includes(wall)){wall=restored[0];selected=-1;}
  // A draft written by this same page is only the screen being rebuilt (a refresh); one from an earlier page load is news to the person.
  if(saved.payload.page!==pageToken)notice='استُعيدت قياسات لم تُحفظ بعد ('+restored.map(labelFor).join('، ')+'). راجعها ثم احفظ الجدار.'+(moved?' تغيّر الجدار المحفوظ بعد كتابتها، فراجعها بعناية.':'');
 }
 const stopGuarding=localFace?()=>{}:registerUnsavedWork({atRisk:()=>dirty.size>0&&!draftSaved||ink.provisional()||pair.dirty()||!!pendingSigner(),flush:writeDrafts});
 const hideDrafts=()=>{if(globalThis.document?.visibilityState==='hidden')writeDrafts();};
 if(!localFace){globalThis.document?.addEventListener?.('visibilitychange',hideDrafts);globalThis.addEventListener?.('pagehide',writeDrafts);}
 restoreDrafts();
 let directHit=null;
 if(focus.featureId){
  const target=getDoc().kitchen.features.find(f=>f.id===focus.featureId&&f.wall===wall);
  selected=linkedReadingIndex(getDoc().room,target);
  if(target&&focus.edit){reviewing=false;directHit=sheetReading(selected>=0?selected:'cad:'+target.id);}
  else if(selected>=0){manual=true;reviewing=false;expanded=true;}
 }
 if(directHit&&Number.isFinite(focus.stationMm))ink.moveObject(directHit,focus.stationMm-directHit.stationMm);
 else if(directHit)ink.selectObject(directHit);
 else if(focus.pair&&!reviewing)pair.open(focus.tier);
 else draw(focus.featureId&&selected>=0?'[data-chain-prop="bottomMm"]':undefined);
 function requestLeave(proceed){
  if(!pair.leave(()=>{if(requestLeave(proceed))proceed();}))return false;
  ink.dismissInspection();
  if(!ink.requestLeave(()=>{if(requestLeave(proceed))proceed();}))return false;
  if(!dirty.size&&!pendingSigner())return true;
  onLeave=proceed;confirmAction='';
  const action=localFace?'stay':pendingSigner()?'review-proof':'leave-save';draw('[data-chain-act="'+action+'"]');
  return false;
 }
 return {requestLeave,commandContext:()=>reviewing||localFace?{}:{wall},
  destroy(){
   if(!localFace){writeDrafts();globalThis.document?.removeEventListener?.('visibilitychange',hideDrafts);globalThis.removeEventListener?.('pagehide',writeDrafts);}
   stopGuarding();readingObserver?.disconnect();ink.destroy();host.removeEventListener('keydown',sheetKey);if(frame)cancelAnimationFrame(frame);host.removeEventListener('click',click);host.removeEventListener('input',input);host.removeEventListener('change',change);host.removeEventListener('toggle',toggle,true);}};
}
