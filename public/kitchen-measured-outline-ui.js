import {wallPairDatum,cleanWallPairs} from './kitchen-wall-pair.js';
import {parseMeasuredOutline,outlineId} from './kitchen-measured-outline.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {createKitchen} from './kitchen-model.js';
import {applyChain} from './kitchen-chain-model.js';
import {openPerimeterDraftSession} from './kitchen-perimeter-draft.js';
import {mountOutlineWallEntry,stagedPairDatum} from './kitchen-outline-wall-entry.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {headingOptions,traceWallWalk,wallsFromVertices} from './kitchen-outline-walk.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numerals=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}),fmt=n=>numerals.format(n);
const residual=n=>n>0&&n<.001?'أقل من ٠٫٠٠١':fmt(n);
const inputMode='inputmode="decimal" autocomplete="off" dir="ltr"';
const coordText=vs=>vs.map(v=>[v.id,v.x*10,v.z*10].join(', ')).join('\n');
const numberText=v=>v.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replaceAll('٫','.');
function sketch({points,closed,complete},rows,initial){
 if(points.length<2)return '<p>يبدأ الرسم من الركن الأول عند إدخال طول الجدار واتجاهه.</p>';
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),x0=Math.min(...xs),z0=Math.min(...zs),w=Math.max(...xs)-x0,h=Math.max(...zs)-z0;
 const k=Math.min(245/Math.max(w,1),96/Math.max(h,1));
 const ps=points.map(p=>[Number((150+(p.x-x0-w/2)*k).toFixed(2)),Number((69+(p.z-z0-h/2)*k).toFixed(2))]);
 const from=ps[0],end=ps.at(-1);
 return '<svg viewBox="0 0 300 140" role="group" aria-label="الخط المتصل للجدران المدخلة بحسب اتجاه القياس"><polyline points="'+ps.map(p=>p.join(',')).join(' ')+'" fill="'+(closed?'#e9eeea':'none')+'" stroke="#375c50" stroke-width="2.4"/>'+
  ps.slice(1).map((p,i)=>{const a=ps[i],x=(p[0]+a[0])/2,y=(p[1]+a[1])/2;
   const label=(initial?'رفع عناصر الجدار ':'تعديل طول الجدار ')+fmt(i+1);
   return '<g data-poly-leg-id="'+esc(rows[i].id)+'" role="button" tabindex="0" aria-label="'+label+'"><title>'+label+'</title><path class="poly-leg-hit" d="M'+a.join(' ')+'L'+p.join(' ')+'"/><text x="'+x+'" y="'+(y-4)+'" text-anchor="middle" font-size="12" fill="#294c40" style="paint-order:stroke;stroke:#fff;stroke-width:3">'+fmt(i+1)+'</text></g>';}).join('')+
  (complete&&!closed&&rows.length>=3?'<path class="site-closure-gap" d="M'+end.join(' ')+' L'+from.join(' ')+'" fill="none" stroke="#9b5a38" stroke-width="2" stroke-dasharray="3 4"><title>فرق الإغلاق بين النهاية وركن البداية</title></path>':'')+
  '<circle cx="'+from[0]+'" cy="'+from[1]+'" r="4" fill="#fff" stroke="#33594c" stroke-width="2"/>'+
  (closed?'':'<rect x="'+(end[0]-3)+'" y="'+(end[1]-3)+'" width="6" height="6" fill="#976c42"/>')+'</svg>';
}

export function outlineSurveyDocument(room,surveys){
 let doc={room,kitchen:createKitchen(room,'empty')};
 const walls=roomArchitecture(room).walls;
 for(const [i,wall] of walls.entries()){
  const survey=surveys.get(wall.id);if(!survey)continue;
  if(Math.abs(wall.length*10-survey.lengthMm)>1e-5||Math.abs(room.height*10-survey.heightMm)>1e-5)
   return {ok:false,reason:'تغيّر طول الجدار '+fmt(i+1)+' أو ارتفاع الغرفة بعد تسجيل عناصره. افتح عناصره وراجعها ثم احفظها.'};
  const out=applyChain(doc,wall.id,survey.chain);if(!out.ok)return {ok:false,reason:'الجدار '+fmt(i+1)+' · '+out.reason};
  doc=out.doc;
  if(survey.pairs){
   const pairSet=cleanWallPairs({[wall.id]:survey.pairs})?.[wall.id],draftDatum=stagedPairDatum(survey.lengthMm,survey.heightMm);
   if(!pairSet||Object.values(pairSet).some(r=>r.datum!==draftDatum))return {ok:false,reason:'راجع قياس الظهر والوجه للجدار '+fmt(i+1)+' بعد تغيّر مرجعه.'};
   const wallPairs={...doc.room.workshop.wallPairs,[wall.id]:Object.fromEntries(Object.entries(pairSet).map(([tier,r])=>[tier,{...r,datum:wallPairDatum(doc,wall.id)}]))};
   doc={...doc,room:{...doc.room,workshop:{...doc.room.workshop,wallPairs}}};
  }
 }
 if([...surveys.keys()].some(id=>!walls.some(w=>w.id===id)))return {ok:false,reason:'يوجد رفع لجدار غير موجود في المحيط.'};
 const outstanding=walls.find(w=>!doc.room.workshop?.chains?.[w.id]?.rows.some(r=>r.kind==='corner'||r.kind==='stop'));
 if(doc.room.workshop)doc.room.workshop.activeWall=(outstanding||walls[0]).id;
 return {ok:true,doc,allEntered:!outstanding};
}

export function mountMeasuredOutline(host,{getDoc,apply,tell,onAdvance,initial=false,initialHeightMm,draftStore}){
 const checkpoint=initial?openPerimeterDraftSession(draftStore):null,resumed=checkpoint?.data;
 const surveys=new Map(Object.entries(resumed?.surveys||{}));let inner=null,activeLeg=null,removeId=null;
 const c=new AbortController(),base=getDoc?.(),existing=base?.room,outline=existing?.architecture?.outline;
 const preload=initial?(Number.isFinite(initialHeightMm)&&initialHeightMm>=600&&initialHeightMm<=6000?initialHeightMm:''):existing?.height?existing.height*10:'';
 let rows=!initial&&outline?wallsFromVertices(outline.vertices):[],mode='walk',proposal=null,original=null,pending=false,epoch=0;
 function add(){const ids=new Set(rows.map(r=>r.id));let i=1;while(ids.has(outlineId(i)))i++;rows.push({id:outlineId(i),length:'',direction:'',angle:''});}
 if(resumed)rows=structuredClone(resumed.rows);
 if(!rows.length)add();
 host.innerHTML='<section class="poly-survey"><div data-poly-parent><h2>محيط الغرفة</h2>'+(initial?'<p class="poly-autosave" data-poly-autosave role="status"></p>':'')+'<p>ابدأ من ركن معلوم واتبع الجدران الداخلية مع عقارب الساعة. الاتجاهات نسبة إلى المسقط.</p>'+
  '<section class="ws-card"><div class="poly-meta"><label>مرجع الرفع أو اسم المخطط<input data-poly-ref maxlength="160" value="'+esc(initial?'':outline?.reference)+'"></label><label>ارتفاع الغرفة بالملليمتر<input data-poly-h '+inputMode+' value="'+esc(preload)+'"></label></div>'+
  '<details><summary>سماكة الجدار الاختيارية</summary><label>سماكة الغلاف بالملليمتر<input data-poly-t '+inputMode+' placeholder="٢٠٠ للعرض إذا تُرك فارغًا" value="'+esc(!initial&&outline?existing.architecture.wallThickness*10:'')+'"></label></details></section>'+
  '<div class="poly-mode" role="group" aria-label="طريقة إدخال المحيط"><button type="button" data-poly-mode="walk">أطوال الجدران واتجاهاتها</button><button type="button" data-poly-mode="coords">إحداثيات أو ملف</button></div>'+
  '<section data-poly-walk class="ws-card"><h3>الجدران بالترتيب</h3><p>لكل جدار، أدخل طوله بالملليمتر واختر اتجاهه حتى تعود إلى ركن البداية.</p><ol class="poly-walk-list" data-poly-legs></ol>'+
  '<div data-poly-delete-guard></div><button type="button" data-poly-add>إضافة الجدار التالي</button><div class="poly-sketch" data-poly-sketch></div><p data-poly-closure aria-live="polite"></p></section>'+
  '<section data-poly-coords class="ws-card" hidden><label>إحداثيات العرض والعمق بالملليمتر، سطر لكل ركن من دون تكرار الأول. الصفر عند أقصى اليسار والخلف.<textarea data-poly-text rows="7" dir="ltr" placeholder="0, 0&#10;5000, 0">'+esc(!initial&&outline?coordText(outline.vertices):'')+'</textarea></label>'+
  '<label>استيراد ملف JSON مقاس بوحدة mm<input type="file" data-poly-file accept="application/json,.json"></label><details><summary>تنسيق الملف</summary><pre dir="ltr">'+esc(JSON.stringify({unit:'mm',reference:'مرجع الرفع',heightMm:2800,vertices:[[0,0],[5000,0],[5000,4000],[0,4000]]},null,2))+'</pre></details></section>'+
  '<div class="poly-actions"><button type="button" data-poly-preview>معاينة المحيط</button></div><p data-poly-tip role="status"></p><div data-poly-view></div></div><section data-poly-subview hidden><h3 data-poly-leg-title></h3><div data-poly-wall-editor></div></section></section>';
 const q=sel=>host.querySelector(sel),view=q('[data-poly-view]');
 if(resumed){
  q('[data-poly-ref]').value=resumed.reference;q('[data-poly-h]').value=resumed.height;
  q('[data-poly-t]').value=resumed.thickness;q('[data-poly-text]').value=resumed.coords;
 }
 if(checkpoint){
  const label=q('[data-poly-autosave]');
  checkpoint.listen(status=>{if(label.textContent!==status)label.textContent=status;});label.textContent=checkpoint.status;
 }
 function persist(){
  if(!checkpoint)return;
  checkpoint.write({mode,reference:q('[data-poly-ref]').value,height:q('[data-poly-h]').value,thickness:q('[data-poly-t]').value,
   coords:q('[data-poly-text]').value,rows:rows.map(r=>({...r})),surveys:Object.fromEntries(surveys)});
 }
 function message(s){q('[data-poly-tip]').textContent=s;tell?.(s);}
 function invalidate(){epoch++;proposal=null;original=null;view.replaceChildren();q('[data-poly-tip]').textContent='';}
 function updateTrace(){
  const trace=traceWallWalk(rows);q('[data-poly-sketch]').innerHTML=sketch(trace,rows,initial);
  const out=q('[data-poly-closure]');out.setAttribute('data-state',trace.closed?'closed':trace.complete&&rows.length>=3?'gap':'partial');
  if(trace.closed)out.textContent='عادت نهاية المسار إلى ركن البداية. راجع المحيط قبل الحفظ.';
  else if(trace.complete&&rows.length>=3){const end=trace.points.at(-1);out.textContent='الخط المتقطع يبيّن فرق الإغلاق · '+residual(trace.residualMm)+' مم · فرق العرض '+fmt(end.x)+' مم، وفرق العمق '+fmt(end.z)+' مم.';}
  else out.textContent=trace.points.length>1?'أُدخلت '+fmt(trace.points.length-1)+' جدران. الدائرة هي ركن البداية.':'';
 }
 function heightMm(){return assistNumber(q('[data-poly-h]').value);}
 function dims(row){
  const length=assistNumber(row.length),height=heightMm(),angle=assistNumber(row.angle);
  const valid=length>=1&&length<=18000&&height>=600&&height<=6000&&Object.hasOwn(headingOptions,row.direction)&&
   (row.direction!=='bearing'||angle!==null&&angle>=0&&angle<=360);
  return {length,height,valid};
 }
 function updateLegButtons(){
  if(!initial)return;
  for(const [i,row] of rows.entries()){
   const el=q('[data-poly-index="'+i+'"] [data-poly-contents]');if(!el)continue;
   const {length,height,valid}=dims(row),s=surveys.get(row.id);
   el.disabled=!valid;
   const text=s?'عناصر الجدار '+fmt(i+1)+' · '+fmt(s.chain.rows.length)+' قراءات':'عناصر الجدار '+fmt(i+1);
   el.textContent=text+(s&&(length!==s.lengthMm||height!==s.heightMm)?' · راجع المقاس':'');
  }
 }
 function closeLeg(){
  if(!activeLeg)return;
  const id=activeLeg;activeLeg=null;inner?.();inner=null;
  q('[data-poly-wall-editor]').replaceChildren();q('[data-poly-subview]').hidden=true;q('[data-poly-parent]').hidden=false;
  paintRows();
  const i=rows.findIndex(r=>r.id===id);if(i>=0)q('[data-poly-index="'+i+'"] [data-poly-contents]')?.focus();
 }
 function openLeg(i){
  const row=rows[i];if(!initial||!row||activeLeg)return;
  const {length,height,valid}=dims(row);if(!valid){message('أكمل طول الجدار واتجاهه وارتفاع الغرفة.');return;}
  invalidate();activeLeg=row.id;q('[data-poly-parent]').hidden=true;q('[data-poly-subview]').hidden=false;
  q('[data-poly-leg-title]').textContent='عناصر الجدار '+fmt(i+1)+' · '+fmt(length)+' مم';
  function saveReadings(chain,pairs){
    if(activeLeg!==row.id)return {ok:false,reason:'لم يعد الجدار الحالي مفتوحًا.'};
    if(checkpoint?.blocked)return {ok:false,reason:checkpoint.status};
    const previous=surveys.get(row.id);
    if(chain.rows.length||pairs)surveys.set(row.id,{lengthMm:length,heightMm:height,chain:structuredClone(chain),...(pairs?{pairs:structuredClone(pairs)}:{})});else surveys.delete(row.id);
    persist();
    if(checkpoint?.blocked){if(previous)surveys.set(row.id,previous);else surveys.delete(row.id);return {ok:false,reason:checkpoint.status};}
    return {ok:true};
  }
  const prior=surveys.get(row.id);
  inner=mountOutlineWallEntry(q('[data-poly-wall-editor]'),{wallLabel:'الجدار '+fmt(i+1),lengthMm:length,heightMm:height,chain:structuredClone(prior?.chain),pairs:prior?.pairs,
   onPairSave:pairs=>saveReadings(prior?.chain||{source:'drawing',rows:[]},pairs),
   onClose:closeLeg,onSave(chain,pairs){
    const out=saveReadings(chain,pairs);if(!out.ok)return out;
    closeLeg();return {ok:true};
   }});
 }
 function paintRows(){
  q('[data-poly-legs]').innerHTML=rows.map((r,i)=>{
   const nr=fmt(i+1),options=Object.entries(headingOptions).map(([id,label])=>'<option value="'+id+'"'+(r.direction===id?' selected':'')+'>'+label+'</option>').join('');
   return '<li class="poly-leg" data-poly-index="'+i+'"><b>'+nr+'</b><input data-poly-length '+inputMode+' aria-label="طول الجدار '+nr+' بالملليمتر" placeholder="الطول (مم)" value="'+esc(r.length)+'"><select data-poly-heading aria-label="اتجاه الجدار '+nr+'"><option value="">اختر الاتجاه</option>'+options+'</select>'+
    '<button type="button" data-poly-remove aria-label="حذف الجدار '+nr+'">×</button>'+(r.direction==='bearing'?'<label class="poly-bearing">زاوية من يمين المسقط مع عقارب الساعة (°)<input data-poly-bearing '+inputMode+' aria-label="زاوية الجدار '+nr+'" value="'+esc(r.angle)+'"></label>':'')+(initial?'<button type="button" class="poly-contents" data-poly-contents>عناصر الجدار '+nr+'</button>':'')+'</li>';
  }).join('');q('[data-poly-add]').disabled=rows.length>=32;updateTrace();updateLegButtons();
  q('[data-poly-delete-guard]').innerHTML=removeId?'<div role="alert"><p>حذف الجدار وقراءات عناصره من هذه المسودة؟</p><button type="button" data-poly-confirm-remove>حذف الجدار وقراءاته</button><button type="button" data-poly-keep>إبقاء الجدار</button></div>':'';
 }
 function switchMode(next,save=true){if(initial&&next==='coords'&&surveys.size){message('توجد قراءات مرتبطة بالجدران المدخلة. واصل بهذه الطريقة، أو احذف الجدران ذات القراءات قبل استخدام إحداثيات مختلفة.');return;}mode=next;invalidate();q('[data-poly-walk]').hidden=next!=='walk';q('[data-poly-coords]').hidden=next!=='coords';for(const b of host.querySelectorAll('[data-poly-mode]'))b.setAttribute('aria-pressed',String(b.dataset.polyMode===next));if(save)persist();}
 function raw(){
  const thickness=q('[data-poly-t]').value.trim(),height=assistNumber(q('[data-poly-h]').value);
  const meta={unit:'mm',reference:q('[data-poly-ref]').value,thicknessMm:thickness?(assistNumber(thickness)??NaN):null,heightMm:height};
  if(!meta.reference.trim())throw Error('أدخل مرجع الرفع أو اسم المخطط.');
  if(height===null||height<600||height>6000)throw Error('أدخل ارتفاع الغرفة المقاس من ٦٠٠ إلى ٦٠٠٠ مم.');
  if(mode==='walk'){
   const t=traceWallWalk(rows);if(!t.closed)throw Error(t.reason+(t.complete&&rows.length>=3?' فرق الإغلاق '+residual(t.residualMm)+' مم.':''));
   return {...meta,vertices:t.vertices};
  }
  const vs=q('[data-poly-text]').value.trim().split(/\n+/).filter(v=>v.trim()).map(l=>{
   const bits=numberText(l.trim()).split(/[،,;\s]+/);if(bits.length===3)return {wallId:bits[0],xMm:Number(bits[1]),zMm:Number(bits[2])};
   return bits.length===2?bits.map(Number):[];
  });
  return {...meta,vertices:vs};
 }
 function preview(input){
  invalidate();
  const out=parseMeasuredOutline(input);if(!out.ok){message(out.reason);return;}
  const merged=outlineSurveyDocument(out.room,surveys);if(!merged.ok){message(merged.reason);return;}
  proposal=merged.doc;original=getDoc?.();const a=roomArchitecture(proposal.room);
  const poly=a.polygon.map(p=>p.x+','+p.z).join(' ');
  view.innerHTML='<section class="ws-card"><h3>معاينة المحيط المقاس</h3>'+(mode==='coords'?'<svg width="100%" height="130" viewBox="-10 -10 '+(a.width+20)+' '+(a.length+20)+'" role="img" aria-label="المحيط المقاس"><polygon points="'+poly+'" fill="#e3ede7" stroke="#365647" vector-effect="non-scaling-stroke" stroke-width="2"/></svg>':'')+
   '<p>'+fmt(a.walls.length)+' جدران · '+fmt(a.area/10000)+' م² · محيط '+fmt(a.walls.reduce((n,w)=>n+w.length,0)/100)+' م</p>'+
   (surveys.size?'<p>تشمل المسودة قراءات محفوظة على '+fmt(surveys.size)+' من جدران المحيط.</p>':'')+(initial?'':'<p>عند التأكيد يُفتح المحيط كرسم جديد فارغ. يمكن التراجع عن استبدال الرسم الحالي.</p>')+
   '<button type="button" data-poly-use>'+(initial?(merged.allEntered?'حفظ المحيط ومراجعة الرفع':surveys.size?'حفظ المحيط ومتابعة الرفع':'حفظ المحيط ورفع الجدار الأول'):'فتح المحيط المقاس كرسم جديد')+'</button></section>';
 }
 function activateLeg(id){
  if(mode!=='walk'||pending||activeLeg)return;
  const index=rows.findIndex(r=>r.id===id);if(index<0)return;
  if(initial){
   const h=heightMm();if(!(h>=600&&h<=6000)){
    message('أدخل ارتفاع السقف لفتح واجهة الجدار.');q('[data-poly-h]').focus();return;
   }
   openLeg(index);return;
  }
  const input=q('[data-poly-index="'+index+'"] [data-poly-length]');input?.focus();input?.select?.();
 }
 host.addEventListener('keydown',e=>{
  if(!['Enter',' '].includes(e.key))return;
  const id=e.target.closest('[data-poly-leg-id]')?.dataset?.polyLegId;
  if(id){e.preventDefault();activateLeg(id);}
 },{signal:c.signal});
 host.addEventListener('input',e=>{
  if(pending||activeLeg)return;const t=e.target,row=t.closest('[data-poly-index]');
  if(row&&(t.hasAttribute('data-poly-length')||t.hasAttribute('data-poly-bearing'))){rows[Number(row.dataset.polyIndex)][t.hasAttribute('data-poly-length')?'length':'angle']=t.value;invalidate();updateTrace();updateLegButtons();persist();}
  else if(t.matches('[data-poly-text],[data-poly-ref],[data-poly-h],[data-poly-t]')){invalidate();updateLegButtons();persist();}
 },{signal:c.signal});
 host.addEventListener('click',async e=>{
  if(pending||activeLeg)return;
  const leg=e.target.closest('[data-poly-leg-id]');
  if(leg?.dataset?.polyLegId){activateLeg(leg.dataset.polyLegId);return;}
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-poly-contents')){openLeg(Number(b.closest('[data-poly-index]').dataset.polyIndex));return;}
  if(b.hasAttribute('data-poly-keep')){removeId=null;paintRows();return;}
  if(b.hasAttribute('data-poly-mode')){switchMode(b.dataset.polyMode);return;}
  if(b.hasAttribute('data-poly-add')){if(rows.length>=32)return;invalidate();add();paintRows();persist();q('[data-poly-index="'+(rows.length-1)+'"] [data-poly-length]')?.focus();return;}
  if(b.hasAttribute('data-poly-remove')||b.hasAttribute('data-poly-confirm-remove')){
   const confirm=b.hasAttribute('data-poly-confirm-remove'),i=confirm?rows.findIndex(r=>r.id===removeId):Number(b.closest('[data-poly-index]').dataset.polyIndex);
   if(!rows[i])return;invalidate();
   if(!confirm&&surveys.has(rows[i].id)){removeId=rows[i].id;paintRows();return;}
   surveys.delete(rows[i].id);removeId=null;rows.splice(i,1);if(!rows.length)add();paintRows();persist();return;
  }
  if(b.hasAttribute('data-poly-preview')){invalidate();try{preview(raw());}catch(err){message(err.message);}return;}
  if(!b.hasAttribute('data-poly-use')||!proposal)return;
  if(checkpoint?.blocked){message(checkpoint.status);return;}
  if(getDoc?.()!==original){invalidate();message('تغيّر المشروع منذ المعاينة. أعد عرض المحيط قبل التطبيق.');return;}
  const doc=proposal;pending=true;b.disabled=true;
  try{
   const r=await apply(doc,'حُفظ المحيط المقاس.');
   if(r?.ok!==false&&r?.saved===true)checkpoint?.clear();
   if(c.signal.aborted)return;
   if(r?.ok===false||r?.saved===false||(initial&&r?.saved!==true)){message(r?.reason||'تعذّر حفظ المحيط.');return;}
   onAdvance?.('survey');
  }catch(err){if(!c.signal.aborted)message(err.message||'تعذّر حفظ المحيط.');}
  finally{pending=false;b.disabled=false;if(c.signal.aborted)checkpoint?.close();}
 },{signal:c.signal});
 host.addEventListener('change',async e=>{
  const t=e.target;if(pending||activeLeg)return;
  if(t.hasAttribute('data-poly-heading')){const idx=Number(t.closest('[data-poly-index]').dataset.polyIndex);rows[idx].direction=t.value;invalidate();paintRows();persist();q('[data-poly-index="'+idx+'"] '+(t.value==='bearing'?'[data-poly-bearing]':'[data-poly-heading]'))?.focus();return;}
  if(!t.matches('[data-poly-file]'))return;const file=t.files?.[0];t.value='';if(!file)return;invalidate();const ticket=epoch;
  try{if(file.size>50000)throw Error('ملف حدود الغرفة أكبر من المسموح. استخدم ملف رؤوس مختصرًا.');
   const v=JSON.parse(await file.text());if(c.signal.aborted||ticket!==epoch)return;
   const out=parseMeasuredOutline(v);if(!out.ok)throw Error(out.reason);
   q('[data-poly-ref]').value=v.reference;q('[data-poly-h]').value=v.heightMm;q('[data-poly-t]').value=v.thicknessMm??'';
   q('[data-poly-text]').value=coordText(out.room.architecture.outline.vertices);persist();preview(v);
  }catch(err){if(!c.signal.aborted&&ticket===epoch)message(err.message);}
 },{signal:c.signal});
 paintRows();switchMode(resumed?.mode||'walk',false);
 const dispose=()=>{c.abort();inner?.();inner=null;if(!pending)checkpoint?.close();};
 dispose.requestLeave=proceed=>{
  if(!activeLeg)return true;
  if(inner?.requestLeave?.(()=>{closeLeg();proceed();})===false)return false;
  closeLeg();return true;
 };
 return dispose;
}
