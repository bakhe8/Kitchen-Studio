// Tablet-facing choices for the upright strip at one surveyed opening. The
// domain returns both the project change and the geometry used by the shop.
import {architectureWallLabel} from './kitchen-architecture.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {previewUpstandWindowChoice,setUpstandWindowChoice} from './kitchen-worktop-upstand.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v);
const mm=v=>Number.isFinite(v)?n(v)+' مم':'غير مقاس';
const kinds={gap:'فراغ بعرض البرواز',step:'متصلة وتنخفض تحت الشباك',uniform:'ارتفاع واحد على الجدار'};
const num=(key,label,value)=>'<label class="kw-field"><span>'+label+'</span><input inputmode="decimal" data-window-input="'+key+'" value="'+esc(value)+'" placeholder="مم"></label>';
const str=(key,label,value)=>'<label class="kw-field"><span>'+label+'</span><input data-window-input="'+key+'" maxlength="160" value="'+esc(value)+'"></label>';
const tick=(key,label,checked)=>'<label class="uw-check"><input type="checkbox" data-window-input="'+key+'"'+(checked?' checked':'')+'> '+label+'</label>';
const option=(v,s,a)=>'<option value="'+esc(v)+'"'+(a?' selected':'')+'>'+esc(s)+'</option>';
const coord=v=>Number(v.toFixed(2));
function badge(w){
 if(w.status==='resolved')return kinds[w.choice?.kind]||'اختيار محفوظ';
 return ({pending:'بانتظار قرار أو قياس',stale:'تغيّر القياس أو المقطع',invalid:'يحتاج مراجعة',default:'يمر تحت البرواز'})[w.status]||'';
}
function scheme(kind){
 const shape={gap:'M3 39V27H29V39ZM65 39V27H91V39Z',step:'M3 39V27H29V34H65V27H91V39Z',uniform:'M3 39V34H91V39Z'}[kind];
 return '<svg aria-hidden="true" viewBox="0 0 94 45"><path d="M31 5H63V31H31Z M47 5V31" stroke="#607976" fill="#e9f1f3"/><path d="'+shape+'" fill="#477164"/><path d="M3 39H91" stroke="#344f49" stroke-width="1.5"/></svg>';
}
export function windowElevation(selected,windows,segments,previewHeight,interactiveStone=false){
 const group=windows.filter(w=>w.wall===selected.wall&&w.bottomMm===selected.bottomMm);
 const parts=segments.filter(s=>s.wall===selected.wall&&s.bottomMm===selected.bottomMm);
 const coords=[...group.flatMap(w=>[w.fromMm,w.toMm]),...parts.flatMap(s=>[s.fromMm,s.toMm])],lo=Math.min(...coords),hi=Math.max(...coords);
 const width=490,margin=8,baseline=93,x=v=>coord(margin+(v-lo)/Math.max(1,hi-lo)*(width-2*margin));
 const height=Math.max(40,selected.nominalMm,Number.isFinite(selected.rawClearMm)?selected.rawClearMm:0,...parts.map(s=>s.heightMm));
 const y=v=>coord(baseline-60*Math.max(0,Math.min(height, v))/height);
 const frames=group.map(w=>{
  const l=x(w.fromMm),r=x(w.toMm),bottom=y(w.sillMm-w.bottomMm),active=w.key===selected.key;
  return '<g role="button" tabindex="0" data-window-pick="'+esc(w.key)+'" aria-label="اختيار الشباك عند '+mm(w.fromMm)+'" data-window-highlight="'+active+'"><title>'+esc(architectureWallLabel(w.wall)+' · '+mm(w.fromMm)+' – '+mm(w.toMm))+'</title><rect x="'+l+'" y="12" width="'+coord(r-l)+'" height="'+coord(Math.max(1,bottom-12))+'" fill="'+(active?'#d9eced':'#eef3f3')+'" stroke="'+(active?'#176c75':'#8b9d9b')+'" stroke-width="'+(active?2:1)+'"/><path d="M'+coord((l+r)/2)+' 12V'+bottom+'" stroke="'+(active?'#4b939a':'#b4c2c2')+'"/></g>';
 }).join('');
 const stone=parts.map(s=>{
  const body='<rect x="'+x(s.fromMm)+'" y="'+y(s.heightMm)+'" width="'+coord(Math.max(.4,x(s.toMm)-x(s.fromMm)))+'" height="'+coord(baseline-y(s.heightMm))+'" fill="'+esc(/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:'#748f7d')+'" stroke="#466354" stroke-width=".7"/>';
  if(!interactiveStone)return body;
  return '<g role="button" tabindex="0" data-window-strip="'+segments.indexOf(s)+'" aria-label="تخصيص قطعة نعلة الرخام من '+mm(s.fromMm)+' إلى '+mm(s.toMm)+'">'+body+'</g>';
 }).join('');
 const indicative=Number.isFinite(previewHeight)&&previewHeight>0?'<rect data-window-envelope x="'+x(selected.fromMm)+'" y="'+y(previewHeight)+'" width="'+coord(Math.max(.4,x(selected.toMm)-x(selected.fromMm)))+'" height="'+coord(baseline-y(previewHeight))+'" fill="#c0e0db" fill-opacity=".55" stroke="#247466" stroke-width="1.3" stroke-dasharray="4 3" pointer-events="none"/>':'';
 return '<svg class="uw-wall" viewBox="0 0 '+width+' 103" role="group" aria-label="واجهة '+esc(architectureWallLabel(selected.wall))+'، البرواز المحدد باللون الأزرق والنعلة فوق السطح">'+frames+stone+indicative+'<path d="M'+margin+' '+baseline+'H'+(width-margin)+'" stroke="#384840" stroke-width="2.5"/></svg>';
}

function draftFor(w){
 const v=w.choice||{},s=v.sill||{};
 // A changed opening can restore the intent, but its new measurements must
 // be reconfirmed before a manufacturing template is bound to it.
 const stale=w.status==='stale',sillStale=stale||w.sillStatus==='stale';
 return {kind:v.kind||(Number.isFinite(w.inheritedUniformHeightMm)?'uniform':''),height:v.heightMm??w.inheritedUniformHeightMm??'',clearance:stale?'':(v.clearanceMm??''),motion:stale?'':(v.operationLimitMm??''),ref:stale?'':(v.reference||''),checked:!stale&&v.operationChecked===true,
  sill:!!v.sill,supply:s.mode||w.mode||'supplier',depth:sillStale?'':(s.depthMm??''),inset:sillStale?'':(s.insetStartMm??''),length:sillStale?'':(s.lengthMm??''),
  sillRef:sillStale?'':(s.reference||''),verified:!sillStale&&s.verified===true,sku:s.sku||'',material:s.material||'',thickness:s.thicknessMm??'',similar:false};
}
function choice(d){
 if(!d.kind)return null;
 const v={kind:d.kind};
 const add=(o,key,value)=>{if(value!==''&&value!=null)o[key]=assistNumber(value)??NaN;};
 if(d.kind!=='gap'){
  add(v,'heightMm',d.height);add(v,'clearanceMm',d.clearance);add(v,'operationLimitMm',d.motion);
  if(d.ref.trim())v.reference=d.ref.trim();if(d.checked)v.operationChecked=true;
 }
 if(d.sill){
  const s={mode:d.supply};add(s,'depthMm',d.depth);add(s,'lengthMm',d.length);add(s,'insetStartMm',d.inset);
  if(d.sillRef.trim())s.reference=d.sillRef.trim();if(d.verified)s.verified=true;
  if(s.mode==='factory'){if(d.sku)s.sku=d.sku;}
  else{if(d.material.trim())s.material=d.material.trim();add(s,'thicknessMm',d.thickness);}
  v.sill=s;
 }
 return v;
}

export function mountUpstandWindowEditor(host,{getDoc,apply,tell,snapshot,catalog,take,focus={},onSave,onStrip}){
 const windows=take.windows||[];
 if(!host)return null;
 const focused=focus.windowKey?windows.find(w=>w.key===focus.windowKey):windows.find(w=>w.windowId===focus.windowId&&(!focus.wall||w.wall===focus.wall));
 if((focus.windowKey||focus.windowId)&&!focused){
  const note=document.createElement('section');note.className='uw-editor';
  note.innerHTML='<h4>الشباك المحدد</h4><p>لا يوجد مقطع نعلة ملامس لهذا الشباك عند المنسوب والاختيار الحاليين. راجع الجدار وخامة النعلة وحدود السطح.</p>'+
   (windows.length?'<button type="button" data-window-others>عرض الشبابيك الملامسة الأخرى</button>':'');
  host.replaceChildren(note);let other;
  note.onclick=e=>{if(e.target.closest('[data-window-others]'))other=mountUpstandWindowEditor(host,{getDoc,apply,tell,snapshot,catalog,take,focus:{wall:focus.wall},onSave,onStrip});};
  return {hasDraft:()=>other?.hasDraft()||false,destroy(){other?.destroy();note.remove();}};
 }
 if(!windows.length)return null;
 const preferred=focused||windows.find(w=>w.conflict&&(!focus.wall||w.wall===focus.wall))||windows.find(w=>w.wall===focus.wall)||windows.find(w=>w.conflict)||windows[0];
 let active=preferred,d=draftFor(active),dirty=false,alive=true,message='',shownSegments=[];
 const details=document.createElement('details');details.className='uw-wrap';
 details.open=!!focus.windowKey||!!focus.windowId||windows.some(w=>w.conflict||w.choice||w.status==='stale');
 details.innerHTML='<summary>تفاصيل خط النعلة عند الشبابيك</summary>';
 const root=document.createElement('section');root.className='uw-editor';details.append(root);host.replaceChildren(details);
 function notice(s){message=s;const el=root.querySelector('[data-window-notice]');if(el)el.textContent=s;tell?.(s);}
 function label(w){
  const siblings=windows.filter(x=>x.wall===w.wall&&x.bottomMm===w.bottomMm).sort((a,b)=>a.fromMm-b.fromMm);
  return architectureWallLabel(w.wall)+' · شباك '+n(siblings.findIndex(x=>x.key===w.key)+1)+' · من '+mm(w.fromMm)+' · سطح عند '+mm(w.bottomMm);
 }
 function evidence(){
  if(!d.kind||d.kind==='gap')return '';
  return '<fieldset class="uw-evidence"><legend>المقطع تحت البرواز</legend><div class="kw-grid">'+
   num('height','ارتفاع مطلوب (اختياري، مم)',d.height)+num('clearance','خلوص التركيب الموثّق (مم)',d.clearance)+num('motion','أدنى جزء متحرك أو مقبض في مسار النعلة فوق السطح (مم، إن وجد)',d.motion)+str('ref','مرجع التحقق الميداني',d.ref)+'</div>'+
   tick('checked','تم التحقق عند العمق الفعلي من حركة الضلفة والمقبض ومسارات التصريف ذات الصلة.',d.checked)+
   '<small>اترك الارتفاع فارغًا ليحسبه البرنامج من الصافي والخلوص وحدود قص الخامة.</small></fieldset>';
 }
 function sillFields(){
  if(active.rawClearMm!==0&&!active.choice?.sill)return '';
  let html='<div class="uw-sill">'+tick('sill','يريد العميل امتداد الرخام أفقيًا إلى جلسة الشباك',d.sill);
  if(d.sill){
   const factory=d.supply==='factory';
   html+='<p>تقاس القطعة الأفقية بين جانبي الجلسة. حدّد نهايتها حتى لا تُحسب مساحة السطح نفسه مرتين.</p><div class="kw-grid">'+
    num('depth','عمق الامتداد من حافة السطح إلى الجلسة (مم)',d.depth)+num('length','العرض الصافي للقطعة (مم)',d.length)+
    num('inset','بداية القطعة من طرف البرواز الأول (مم)',d.inset)+str('sillRef','مرجع قالب الجلسة',d.sillRef)+
    '<label class="kw-field"><span>توريد الجلسة</span><select data-window-input="supply">'+option('supplier','مورّد الرخام',!factory)+option('factory','المصنع',factory)+'</select></label>'+
    (factory?'<label class="kw-field"><span>لوح الرخام</span><select data-window-input="sku">'+option('','اختَر الصنف',!d.sku)+catalog.items.filter(i=>i.kind==='panel'&&i.thicknessMm>0).map(i=>option(i.sku,i.name+' · '+mm(i.thicknessMm),i.sku===d.sku)).join('')+'</select></label>':
    str('material','خامة الجلسة أو مرجع عيّنتها',d.material)+num('thickness','سماكة الجلسة (مم)',d.thickness))+'</div>'+
    tick('verified','تحقّق الفني من حدود القطعة وعمق الجلسة على قالب الموقع.',d.verified);
  }
  return html+'</div>';
 }
 function render(){
  const options=Object.entries(kinds).map(([k,v])=>{
   const blocked=k!=='gap'&&active.rawClearMm<=0;
   return '<button type="button" data-window-kind="'+k+'" aria-pressed="'+(d.kind===k)+'"'+(blocked?' disabled':'')+'>'+scheme(k)+'<span>'+v+'</span></button>';
  }).join('');
  const hasMultiple=windows.length>1;
  const select=hasMultiple?'<label class="kw-field"><span>الشباك على الرسم</span><select data-window-select>'+windows.map(w=>option(w.key,label(w),active.key===w.key)).join('')+'</select></label>':'<p>'+esc(label(active))+'</p>';
  root.innerHTML='<header><h4>خط النعلة عند الشباك</h4>'+select+'</header><div data-window-elevation></div>'+
   '<p class="uw-dims">أعلى السطح <b>'+mm(active.bottomMm)+'</b> · أسفل البرواز <b>'+mm(active.sillMm)+'</b> · ارتفاع النعلة <b>'+mm(active.nominalMm)+'</b></p>'+
   '<p class="uw-clear">'+(active.rawClearMm>0?'المتاح تحت البرواز قبل خلوص التركيب '+mm(active.rawClearMm):active.rawClearMm===0?'أسفل البرواز بمستوى السطح. لا يوجد ارتفاع لشريط قائم تحته.':'يبدأ البرواز أسفل مستوى السطح. راجع التقاء الرخام بالجلسة.')+'</p>'+
   '<form data-window-form><fieldset class="uw-treatments"><legend>كيف تريد النعلة عند هذا الشباك؟</legend><div>'+options+'</div></fieldset>'+
   (Number.isFinite(active.inheritedUniformHeightMm)&&!active.choice?'<p>اختير ارتفاع موحّد على الجدار قدره '+mm(active.inheritedUniformHeightMm)+'. تُراجع قياسات هذا الشباك مستقلةً.</p>':'')+
   (d.kind==='uniform'?'<p>يسري الارتفاع الموحد على شرائط هذا الجدار عند منسوب السطح نفسه. تظهر معالجات الشبابيك المخصصة في المعاينة.</p>':'')+
   evidence()+sillFields()+'<div data-window-result role="status" aria-live="polite"></div>'+
   (hasMultiple&&d.kind?tick('similar','تطبيق الطلب أيضًا على الشبابيك المماثلة التي لم تُخصّص',d.similar):'')+
   '<div class="kw-actions"><button type="submit" data-window-save>حفظ اختيار الشباك</button>'+
   '<button type="button" data-window-discard'+(dirty?'':' hidden')+'>تجاهل التعديل</button>'+
   (active.choice?'<button type="button" data-window-reset>استعادة الاختيار التلقائي لهذا الشباك</button>':'')+'</div></form>'+
   '<p data-window-notice role="status" aria-live="polite">'+esc(message)+'</p>';
  update();
 }
 function candidate(){
  if(!d.kind)return null;
  return previewUpstandWindowChoice(snapshot,catalog,active.key,choice(d),d.similar);
 }
 function update(){
  const result=dirty?candidate():null,w=result?.window||active,preview=result?.ok?result.take:take;
  const envelope=d.kind&&d.kind!=='gap'&&w.status==='pending'&&active.rawClearMm>0
   ?Math.min(active.nominalMm,active.rawClearMm,assistNumber(d.motion)??Infinity,assistNumber(d.height)??Infinity):undefined;
  shownSegments=preview?.segments||take.segments;
  root.querySelector('[data-window-elevation]').innerHTML=windowElevation(active,preview?.windows||windows,shownSegments,envelope,!!onStrip)+
   (envelope?' <small>الإطار المتقطع يوضح الحد الأعلى المتاح تحت الشباك قبل اعتماد خلوص التركيب والقص.</small>':'');
  const info=root.querySelector('[data-window-result]');
  let msg='';
  if(result?.ok===false)msg=result.reason||'راجع مقاسات المعالجة.';
  else if(!d.kind)msg=w.reason||badge(w);
  else{
   msg=[w.reason||badge(w),w.status==='resolved'&&d.kind!=='gap'&&Number.isFinite(w.effectiveHeightMm)?'الارتفاع الفعلي '+mm(w.effectiveHeightMm):'',
    d.sill?(w.sillReason||(w.sillStatus==='resolved'?'قالب الجلسة موثّق.':'')):''].filter(Boolean).join(' · ');
   if(d.similar&&result?.ok)msg+=' · تشمل العملية '+n(result.applied??1)+' من الشبابيك. تبقى قياسات كل شباك مستقلة، وعدد الشبابيك المستثناة '+n(result.skipped??0)+'.';
  }
  info.textContent=msg;
  const save=root.querySelector('[data-window-save]');
  save.disabled=(!dirty&&active.status!=='stale')||!d.kind||result?.ok===false||w.status==='invalid';
  if(active.status==='stale'&&!dirty)save.disabled=false;
  root.querySelector('[data-window-discard]').hidden=!dirty;
  const pending=result?.ok&&(w.status==='pending'||w.sillStatus==='pending');
  save.textContent=pending?'حفظ الطلب بانتظار التحقق':active.status==='stale'?'تثبيت الاختيار بعد مراجعة الرفع':'حفظ اختيار الشباك';
 }
 function commit(input,similar){
  if(snapshot!==getDoc()){notice('تغيّر الرسم. افتح المعالجة على قياسات الشباك الحالية.');return;}
  const result=setUpstandWindowChoice(snapshot,catalog,active.key,input,similar);
  if(!result.ok||input&&result.window?.status==='invalid'){notice(result.window?.reason||result.reason||'تعذّر حفظ معالجة الشباك.');return;}
  const saved=apply(result.doc,input?'حُفظ طلب معالجة الشباك.':'استُعيد الاختيار التلقائي لهذا الشباك.');
  if(saved?.ok===false||saved?.saved===false){notice(saved.reason||'تعذّر حفظ طلب الشباك.');return;}
  dirty=false;onSave(active.key);
 }
 function selectWindow(key){
  if(key===active.key)return;
  if(dirty){const pick=root.querySelector('[data-window-select]');if(pick)pick.value=active.key;notice('احفظ اختيار الشباك أو تجاهل التعديل قبل الانتقال.');return;}
  const next=windows.find(w=>w.key===key);if(!next)return;active=next;d=draftFor(active);message='';render();
 }
 function pickDrawing(e){
  const frame=e.target.closest('[data-window-pick]');
  if(frame){selectWindow(frame.dataset.windowPick);return true;}
  const strip=e.target.closest('[data-window-strip]');
  if(!strip)return false;
  const segment=shownSegments[Number(strip.dataset.windowStrip)];
  if(segment)onStrip?.(segment);
  return true;
 }
 root.onkeydown=e=>{if(['Enter',' '].includes(e.key)&&pickDrawing(e))e.preventDefault();};
 root.onclick=e=>{
  if(pickDrawing(e))return;
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-window-kind')){
   const kind=b.dataset.windowKind;if(kind===d.kind)return;
   d.kind=kind;dirty=true;message='';render();root.querySelector('[data-window-kind="'+kind+'"]')?.focus();
  }else if(b.hasAttribute('data-window-reset'))commit(null,false);
  else if(b.hasAttribute('data-window-discard')){d=draftFor(active);dirty=false;message='';render();}
 };
 root.oninput=e=>{
  const k=e.target.dataset.windowInput;
  if(!k||e.target.type==='checkbox'||e.target.tagName==='SELECT')return;
  d[k]=e.target.value;dirty=true;message='';update();
 };
 root.onchange=e=>{
  if(e.target.hasAttribute('data-window-select')){
   selectWindow(e.target.value);return;
  }
  const k=e.target.dataset.windowInput;if(!k)return;
  d[k]=e.target.type==='checkbox'?e.target.checked:e.target.value;dirty=true;message='';
  if(k==='sill'&&d.sill&&!d.kind&&active.rawClearMm===0)d.kind='gap';
  if(k==='sill'||k==='supply')render();else update();
 };
 root.onsubmit=e=>{if(!e.target.matches('[data-window-form]'))return;e.preventDefault();e.stopPropagation();if((dirty||active.status==='stale')&&d.kind)commit(choice(d),d.similar);};
 render();return {hasDraft:()=>dirty&&alive,destroy(){alive=false;details.remove();}};
}
