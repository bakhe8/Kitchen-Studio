import {buildFactoryQuote,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {productionPieceSource,reviewProductionPreview} from './kitchen-production-preview.js';
import {productionDrawing} from './kitchen-production-drawing.js';
import {outputApprovalState,releaseConcernGroups} from './kitchen-workshop-state.js';
import {approveWorkshopCatalogRecord,catalogRecordStates} from './kitchen-catalog-records.js';
import {getProjectAccess} from './kitchen-project-access.js';
import {canOpenWorkshopPage} from './kitchen-role-pages.js';
import {factoryPageOf} from './kitchen-gateways.js';
import {orderHandoffUnits} from './kitchen-order-domain.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {processNames,machiningSheet} from './kitchen-machining.js';
import {mountQuoteStep} from './kitchen-workshop-factory-ui.js';
import {studioIcon} from './kitchen-tool-icons.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v):'—';
const copy=v=>JSON.parse(JSON.stringify(v));
const numeric=['tolerance','x','y','diameter','depth','length','width','angle','radius','minutes','leadDays'];
const labels={x:'مسافة X · مم',y:'مسافة Y · مم',tolerance:'السماحة ± مم',diameter:'قطر الثقب · مم',depth:'عمق التشغيل · مم',length:'طول الجيب / القص · مم',width:'عرض الجيب / القص · مم',angle:'الزاوية · درجة',radius:'نصف قطر الثني · مم',minutes:'دقائق التشغيل لكل قطعة',leadDays:'مدة المورد · أيام'};
const act=(id,label,icon)=>'<button type="button" data-production-action="'+id+'">'+(icon?studioIcon(icon):'')+label+'</button>';
const selectOptions=(entries,value)=>entries.map(([id,label])=>'<option value="'+esc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+esc(label)+'</option>').join('');

// Only source operations are drafted. Cut dimensions, packing and assembly
// checks remain projections of the authoritative document and its catalogs.
export function mountProductionStudio(host,{getDoc,apply,tell,onAdvance,focus={},canEdit=()=>false,onHistory,canHistory=()=>false}){
 if(!document.querySelector('link[data-production-studio-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./kitchen-production-studio.css';link.dataset.productionStudioCss='';document.head.append(link);}
 const box=document.createElement('section');box.className='production-studio';host.replaceChildren(box);
 let doc=getDoc(),catalog=getFactoryCatalog(doc),baseline=buildFactoryQuote(doc),raw={},undo=[],redo=[],preview=null,error='',notice='',busy=false,dead=false,ledgerDispose=null,drag=null;
 let pieceIndex=Number.isInteger(focus.pieceIndex)&&baseline.pieces[focus.pieceIndex]?focus.pieceIndex:Math.max(0,baseline.pieces.findIndex(p=>p.unitId===focus.unitId&&(focus.sku?p.sku===focus.sku:true))),operationIndex=Number.isInteger(focus.operationIndex)?focus.operationIndex:0;
 let unitId=baseline.pieces[pieceIndex]?.unitId||'all',view=['unit','cut','operation'].includes(focus.view)?focus.view:'unit',filter='';
 const pending=()=>Object.keys(raw).length>0||busy||!!drag;
 const current=()=>!dead&&getDoc()===doc;
 const editable=()=>current()&&!busy&&canEdit();
 const shown=()=>preview?.doc||doc,quote=()=>preview?.quote||baseline;
 const snapshot=()=>({unitId,pieceIndex,operationIndex,view});
 const source=()=>productionPieceSource(doc,pieceIndex,baseline);
 const keyFor=(s,index)=>JSON.stringify([s.specialId||'',s.family||'',s.line,index]);
 const unitLabel=id=>{const i=doc.kitchen.units.findIndex(u=>u.id===id);return i<0?id:'U'+(i+1);};
 function defaults(){return {kind:'drill',machine:catalog.machining?.machines[0]?.id||'external',reference:'',tolerance:.3,xFrom:'start',yFrom:'start',x:30,y:30,diameter:5,depth:3,length:0,width:0,angle:0,radius:0,minutes:null,provider:'',confirmation:'',leadDays:null};}
 const strings=op=>Object.fromEntries(Object.entries({...defaults(),...op}).map(([k,v])=>[k,String(v??'')]));
 function values(){const s=source();return raw[keyFor(s,operationIndex)]?.values||strings(s.operations?.[operationIndex]||defaults());}
 function operation(values){
  const op={...values};
  for(const k of numeric){const text=String(values[k]??'').trim();if(!text){if(['minutes','leadDays'].includes(k)){op[k]=null;continue;}throw Error('أدخل قيمة رقمية في «'+labels[k]+'».');}const n=assistNumber(text);if(n===null)throw Error('راجع الرقم في «'+labels[k]+'».');op[k]=n;}
  return op;
 }
 function review(){
  preview=null;error='';if(!Object.keys(raw).length)return;
  try{let next=doc,result;const affected=new Set();for(const edit of Object.values(raw)){result=reviewProductionPreview(next,{pieceIndex:edit.pieceIndex,operationIndex:edit.operationIndex,operation:operation(edit.values)});next=result.doc;for(const id of result.affectedUnitIds)affected.add(id);}
   preview={doc:next,quote:buildFactoryQuote(next),changed:next!==doc,affectedUnitIds:[...affected]};
  }catch(err){error=err.message;}
 }
 function checkpoint(){undo.push(copy(raw));if(undo.length>100)undo.shift();redo=[];}
 function editField(field,value,{record=true}={}){
  const s=source();if(!editable()||!s.editable)return;
  const old=values();if(old[field]===value)return;
  if(record)checkpoint();const next={...old,[field]:value},key=keyFor(s,operationIndex);
  raw={...raw,[key]:{pieceIndex,operationIndex,values:next}};
  if(s.operations?.[operationIndex]&&JSON.stringify(next)===JSON.stringify(strings(s.operations[operationIndex])))delete raw[key];
  review();notice='';renderCanvas();renderPieces();update();
 }
 function reset(){raw={};undo=[];redo=[];preview=null;error='';notice='أُلغيت معاينة عمليات التصنيع.';renderSelection();}
 function message(text){notice=text;tell?.(text);update();}
 function history(forward){
  if(!editable()||drag)return;
  const from=forward?redo:undo,to=forward?undo:redo;
  if(from.length){to.push(copy(raw));raw=from.pop();review();notice=forward?'أُعيد تعديل العملية في المعاينة.':'تم التراجع داخل معاينة التصنيع.';renderSelection();return;}
  if(pending()){message('احفظ المعاينة أو ألغِها قبل استعمال تاريخ المشروع.');return;}
  if(canHistory(forward))onHistory?.(forward,snapshot());
 }
 async function persist(next,text){
  if(!editable())return false;busy=true;update();
  try{
   if(!current()||!canEdit())throw Error('تغيّر المشروع أو صلاحية التحرير. أعد فتح المراجعة.');
   const result=await apply(next,text);if(dead)return false;
   if(result?.ok===false)throw Error(result.reason||'تعذّر الحفظ. بقيت المعاينة متاحة لإعادة المحاولة.');
   if(getDoc()===doc)throw Error('لم يُطبّق التغيير. أعد المحاولة من المعاينة الحالية.');
   if((result?.next&&getDoc()!==result.next)||getDoc().room.projectId!==doc.room.projectId)throw Error('تغيّر المشروع أثناء الحفظ. أعد فتح نسخته الحالية.');
   doc=getDoc();catalog=getFactoryCatalog(doc);baseline=buildFactoryQuote(doc);raw={};undo=[];redo=[];preview=null;error='';
   notice=result?.saved===false?'طُبّق التغيير في الجلسة فقط؛ تعذّر الحفظ في المتصفح. صدّر نسخة من المشروع لحمايته.':text;
   render();return true;
  }catch(err){notice=err.message;return false;}finally{busy=false;if(!dead)update();}
 }
 async function save(){
  if(!editable()||!pending()||drag)return;review();if(error){update();return;}if(!preview?.changed){reset();return;}
  await persist(preview.doc,'حُفظت عمليات الوصفة. راجع اعتماد المصنع والنسخة قبل إطلاقها.');
 }
 function safeLeave(step,context){
  if(!current()){message('تغيّر المشروع. أعد فتح مراجعة النسخة الحالية.');return;}
  if(pending()){message('احفظ معاينة التصنيع أو ألغِها قبل فتح المصدر أو الاعتماد.');return;}
  if(!canOpenWorkshopPage(getProjectAccess(doc).role,step==='factory'?factoryPageOf(context?.tab):step)){message('هذا المصدر يتبع صلاحية أخرى في المشروع. اطلب من صاحبه مراجعة الملاحظة؛ بقيت القطعة محددة هنا.');return;}
  onAdvance?.(step,context);
 }
 function choose(index){
  if(!current()||busy||drag||!baseline.pieces[index])return;
  pieceIndex=index;unitId=baseline.pieces[index].unitId;operationIndex=0;renderSelection();
 }
 function chooseUnit(id){
  if(!current()||busy||drag)return;const index=baseline.pieces.findIndex(p=>p.unitId===id);if(index<0)return;choose(index);
 }
 function renderObjects(){
  const ids=[...new Set(baseline.pieces.map(p=>p.unitId))];
  box.querySelector('[data-production-units]').innerHTML=ids.map(id=>{const rows=quote().pieces.filter(p=>p.unitId===id);return '<button type="button" class="ps-unit" data-production-unit="'+esc(id)+'" aria-pressed="'+(unitId===id)+'"><b><bdi>'+esc(unitLabel(id))+'</bdi></b><span>'+number(rows.reduce((n,p)=>n+p.count,0))+' قطعة · '+number(new Set(rows.map(p=>p.sku)).size)+' خامات</span></button>';}).join('')||'<p class="ps-empty">أضف الوحدات ووصفاتها لعرض قطع التصنيع.</p>';
 }
 function renderPieces(){
  const rows=quote().pieces.map((p,index)=>({...p,index})).filter(p=>p.unitId===unitId&&(!filter||(p.label+' '+p.sku).toLocaleLowerCase().includes(filter.toLocaleLowerCase())));
  box.querySelector('[data-production-pieces]').innerHTML=rows.map(p=>'<button type="button" class="ps-piece" data-production-piece="'+p.index+'" aria-pressed="'+(pieceIndex===p.index)+'"><b>'+esc(p.label)+'</b><small><bdi>'+esc(p.sku)+'</bdi> · '+number(p.count)+' قطعة</small><span><bdi>'+number(p.a)+(p.b?' × '+number(p.b):'')+'</bdi>'+(p.a?' مم':'')+'</span></button>').join('')||'<p>لا توجد قطع مطابقة في هذه الوحدة.</p>';
 }
 function renderCanvas(){
  const drawing=productionDrawing(shown(),quote(),{view,pieceIndex,unitId,operationIndex}),p=quote().pieces[pieceIndex];
  box.querySelector('[data-production-canvas]').innerHTML=drawing.html;
  if(!canEdit()||!source().editable)for(const node of box.querySelectorAll('[data-production-drag]'))node.removeAttribute('data-production-drag');
  box.querySelector('[data-production-caption]').textContent=(error?'رسم النسخة المحفوظة · صحح الإدخال. ':Object.keys(raw).length?'معاينة غير محفوظة · ':'')+drawing.caption;
  box.querySelector('[data-production-hud]').innerHTML=p?'<b>'+esc(p.label)+'</b><span>'+number(p.count)+' قطعة · <bdi>'+esc(p.sku)+'</bdi></span>'+act('source','مصدر القطعة')+act('material-source','الخامة'):'';
  const handoff=orderHandoffUnits(shown()).find(u=>u.id===unitId);
  box.querySelector('[data-production-assembly]').innerHTML=view==='unit'&&handoff?'<h4>مراجع تجميع '+esc(unitLabel(unitId))+'</h4><p>مقاسات الجسم والقطع من التصميم الحالي. تُسجل نتائج الفحص الفعلية في أمر التنفيذ الصادر.</p><dl>'+handoff.checks.map(c=>'<div><dt>'+esc(c.label)+'</dt><dd>'+number(c.nominal)+' '+esc(c.unit)+'</dd></div>').join('')+'</dl>':'';
  for(const b of box.querySelectorAll('button[data-production-view]'))b.setAttribute('aria-pressed',String(b.dataset.productionView===view));
 }
 function renderInspector(){
  const p=quote().pieces[pieceIndex],s=source(),target=box.querySelector('[data-production-inspector]');
  if(!p){target.innerHTML='<h3>حدد قطعة للمراجعة</h3>';return;}
  const item=catalog.items.find(i=>i.sku===p.sku),v=values(),ops=s.operations||[],disabled=editable()&&s.editable?'':' disabled';
  const input=(k,label,extra='')=>'<label>'+esc(label)+'<input type="text" autocomplete="off" '+(numeric.includes(k)?'inputmode="decimal"':'maxlength="160"')+' data-production-field="'+k+'" value="'+esc(v[k])+'"'+disabled+extra+'></label>';
  const select=(k,label,entries)=>'<label>'+label+'<select data-production-field="'+k+'"'+disabled+'>'+selectOptions(entries,v[k])+'</select></label>';
  let editor='';
  if(s.editable){
   editor='<label>عملية الوصفة<select data-production-operation>'+selectOptions([...ops.map((op,i)=>[i,number(i+1)+' · '+processNames[op.kind]]),...(ops.length<24?[[ops.length,'+ إضافة عملية']]:[])],operationIndex)+'</select></label><div class="ps-operation-fields">'+
    select('kind','نوع العملية',Object.entries(processNames))+select('machine','الماكينة / التنفيذ',[...((catalog.machining?.machines||[]).map(m=>[m.id,m.name])),['external','مورد خارجي']])+input('reference','مرجع المخطط ووجه القطعة')+input('tolerance',labels.tolerance)+
    select('xFrom','مرجع X',[['start','من أول الطول'],['end','من آخر الطول']])+input('x',labels.x)+select('yFrom','مرجع Y',[['start','من أول العرض'],['end','من آخر العرض']])+input('y',labels.y)+
    (['drill','mill'].includes(v.kind)?input('depth',labels.depth):'')+(v.kind==='drill'?input('diameter',labels.diameter):'')+
    (['mill','size'].includes(v.kind)?input('length',labels.length)+input('width',labels.width):'')+(['miter','bend'].includes(v.kind)?input('angle',labels.angle):'')+(v.kind==='bend'?input('radius',labels.radius):'')+input('minutes',labels.minutes)+
    (v.machine==='external'?input('provider','اسم المورد')+input('confirmation','مرجع قبول المورد')+input('leadDays',labels.leadDays):'')+'</div><p>تعديل عملية الوصفة يسري على جميع القطع التي تستخدمها. الأسهم تعدّل 1 مم، ومع Shift تعدّل 10. اسحب علامة الثقب أو الجيب لمعاينة موضعه.</p>';
  }else editor='<p class="ps-empty">'+esc(s.reason||'هذه القطعة مشتقة من مصدر آخر. افتح مصدرها لتعديل تعليمات تصنيعها.')+'</p>';
  const checks=machiningSheet([p],getFactoryCatalog(shown())),machine=catalog.machining?.machines.find(m=>m.id===v.machine);
  target.innerHTML='<span class="ps-kicker">'+esc(unitLabel(p.unitId))+' / '+esc(p.label)+'</span><h3>تعليمات تشغيل القطعة</h3><p>'+esc(item?.name||p.sku)+' · <bdi>'+esc(p.sku)+'</bdi></p><p>'+number(p.a)+(p.b?' × '+number(p.b):'')+' مم · سماكة '+number(item?.thicknessMm)+' مم · العدد '+number(p.count)+'</p>'+editor+
   '<p data-production-error role="alert"></p><div class="ps-impact" data-production-impact></div>'+ (machine?'<details class="ps-capability"><summary>قدرة '+esc(machine.name)+'</summary><p>'+esc(machine.datum)+'</p><p>غلاف '+number(machine.maxLength)+' × '+number(machine.maxWidth)+' × '+number(machine.maxThickness)+' مم · هامش ماسك '+number(machine.clampMargin)+' مم · سماحة الآلة ±'+number(machine.minTolerance)+' مم</p></details>':'')+
   (checks.issues.length?'<p>'+checks.issues.map(esc).join('<br>')+'</p>':'')+'<div class="ps-source-actions">'+act('source','مصدر الوصفة','layers')+act('material-source','فتح الخامة','swatches')+act('machines','تعريفات الماكينات','factory')+act('unit-source','الوحدة في المصمم','drawing')+'</div>'+(!canEdit()?'<p>المراجعة متاحة للعرض. تحرير عمليات المصنع واعتماد سجله للمالك والمصنع.</p>':'');
 }
 function gateState(){const state=outputApprovalState(shown(),quote());return {state,groups:releaseConcernGroups(shown(),state)};}
 let gateLinks=[];
 function gateLink(g){
  if(g.origin==='catalog')return ['template',{}];
  if(g.origin==='prices')return ['quote',{}];
  if(g.origin==='customer')return ['sign',{}];
  if(g.origin==='production')return ['machines',{}];
  const map={budget:'whole',quote:'quote',fitout:'assembly',empty:'whole',collision:'whole',pair:'survey',proof:'survey',wallOptions:'wallOptions'};
  return [map[g.origin]||g.origin,g.focus||{}];
 }
 function update(){
  if(dead)return;const q=quote(),draft=Object.keys(raw).length>0,{state,groups}=gateState(),records=catalogRecordStates(shown().room.workshop),approved=records?.factory.approved;
  box.dataset.state=busy?'saving':!current()?'stale':error?'invalid':draft?'preview':'saved';
  box.querySelector('[data-production-status]').textContent=!current()?'تغيّر المشروع. افتح النسخة الحالية قبل متابعة التحرير.':busy?'جارٍ حفظ مراجعة التصنيع…':error||notice||(draft?'معاينة غير محفوظة؛ الحفظ يطبق عمليات الوصفة على جميع الوحدات المرتبطة.':'اختر وحدة ثم قطعة لمراجعة خامتها ومقاسها وتشغيلها.');
  box.querySelector('[data-production-summary]').innerHTML='<div><span>قطع التصنيع</span><strong>'+number(q.pieces.reduce((n,p)=>n+p.count,0))+'</strong></div><div><span>بنود التشغيل</span><strong>'+number(q.operations.length)+'</strong></div><div><span>خام دون مسار تشغيل</span><strong>'+number(q.unrouted.length)+'</strong><small>'+(catalog.machining?.strict?'يمنع الإفراج':'غير مشروط في إعدادات المصنع الحالية')+'</small></div><div><span>سجل المصنع</span><strong>'+(approved?'معتمد':'يحتاج المراجعة')+'</strong><small>'+(state.valid.release?'إطلاق النسخة معتمد':'إطلاق النسخة بانتظار المراجعة')+'</small></div>';
  const errorNode=box.querySelector('[data-production-error]');if(errorNode)errorNode.textContent=error;
  for(const field of box.querySelectorAll('[data-production-field]')){field.disabled=!editable()||!source().editable;field.setAttribute('aria-invalid',String(!!error));}
  const affected=preview?.affectedUnitIds||[],impact=box.querySelector('[data-production-impact]');
  if(impact){impact.dataset.state=error?'invalid':draft?'preview':'info';impact.innerHTML=draft?'<strong>'+(error?'التعديل غير صالح للحفظ':'أثر الوصفة المشتركة')+'</strong><p>'+(error?'لم تُطبق هذه القيم على المشروع.':number(affected.length)+' وحدات: '+affected.map(id=>esc(unitLabel(id))).join('، '))+'</p><p>الأبعاد والكميات مأخوذة من التصميم؛ هذه المعاينة تعدّل تعليمات التشغيل.</p>':'<p>حفظ العملية يحدّث سجل المصنع ويعيد تقييم اعتمادات النسخة.</p>';}
  gateLinks=groups.map(gateLink);
  const gates=box.querySelector('[data-production-gates]');gates.dataset.state=groups.length?'blocked':'ready';
  gates.innerHTML='<h3>مراجعة اعتماد الورشة</h3>'+(groups.length?'<p>'+number(groups.reduce((n,g)=>n+g.issues.length,0))+' ملاحظات قبل إطلاق النسخة</p>'+groups.map((g,i)=>'<button type="button" class="ps-gate" data-state="'+(g.origin==='collision'?'conflict':'blocked')+'" data-production-gate="'+i+'">'+g.issues.map(esc).join(' · ')+'</button>').join(''):'<p>اجتازت النسخة المحفوظة متطلبات الإطلاق الحالية. راجعها باسم مسؤول الورشة قبل اعتمادها.</p>')+'<p>المصنع يعتمد سجل وصفاته، والمالك يثبت مراجعة الورشة ويطلق النسخة. تسجيل الجودة والتغليف والتركيب يتبع إيصال أمر التنفيذ.</p>';
  for(const name of ['save','cancel','undo','redo','approve-factory','release']){
   const b=box.querySelector('[data-production-action="'+name+'"]');if(!b)continue;
   b.disabled=!current()||busy||!!drag||({save:!canEdit()||!preview?.changed||!!error,cancel:!draft,undo:!canEdit()||!(undo.length||!draft&&canHistory(false)),redo:!canEdit()||!(redo.length||!draft&&canHistory(true)),'approve-factory':!canEdit()||draft||!!error||approved,release:draft||!!error||groups.length>0||getProjectAccess(doc).role!=='owner'}[name]);
  }
 }
 function renderSelection(){renderObjects();renderPieces();renderCanvas();renderInspector();update();}
 function render(){
  ledgerDispose?.();box.innerHTML='<header class="ps-header"><div><span class="ps-kicker">الورشة والتصنيع · مراجعة مترابطة</span><h2>'+esc(doc.room.name||'قائمة تصنيع المشروع')+'</h2><p>الوحدة ← القطعة ← الخامة ← التشغيل</p></div><div class="ps-history">'+act('undo','تراجع','undo')+act('redo','إعادة','redo')+act('cancel','إلغاء المعاينة')+act('save','حفظ عمليات التصنيع','save')+'</div></header><div class="ps-summary" data-production-summary></div><p class="ps-status" data-production-status role="status" aria-live="polite"></p><div class="ps-workspace"><aside class="ps-objects"><h3>وحدات أمر التصنيع</h3><div data-production-units></div></aside><main class="ps-main"><div class="ps-viewbar" role="group" aria-label="عرض التصنيع"><button type="button" data-production-view="unit">التجميع والوحدة</button><button type="button" data-production-view="cut">توزيع الخام</button><button type="button" data-production-view="operation">تشغيل القطعة</button></div><div class="ps-canvas-wrap"><div class="ps-canvas" data-production-canvas></div><div class="ps-hud" data-production-hud></div></div><p class="ps-caption" data-production-caption></p><div class="ps-assembly" data-production-assembly></div><label class="ps-search">قطع الوحدة<input type="search" data-production-search placeholder="اسم القطعة أو رمز خامتها" value="'+esc(filter)+'"></label><div class="ps-pieces" data-production-pieces></div></main><aside class="ps-inspector" data-production-inspector></aside></div><section class="ps-gates"><div data-production-gates></div><div class="ps-source-actions">'+act('approve-factory','اعتماد سجل المصنع الحالي','check')+act('release','مراجعة وإطلاق النسخة','check')+act('tracking','أوامر التنفيذ الصادرة','guide')+act('quote','الحصر والتسعير','quote')+'</div></section><details class="ps-ledger"><summary>قوائم القص والتشغيل والتصدير كاملة</summary><p>تخص النسخة المحفوظة. احفظ المعاينة أو ألغِها قبل استعمال مصادرها أو تصديرها.</p><div data-production-ledger></div></details>';
  renderSelection();ledgerDispose=mountQuoteStep(box.querySelector('[data-production-ledger]'),{getDoc,isCurrent:()=>current()&&!pending(),onAdvance:safeLeave,tell,initialPane:'shop'});
 }
 function ledgerGuard(event){if(event.target.closest?.('[data-production-ledger]')&&event.target.closest?.('button,a')&&(!current()||pending())){event.preventDefault?.();event.stopImmediatePropagation?.();message('احفظ معاينة التصنيع أو ألغِها قبل استخدام سجل النسخة المحفوظة.');}}
 function click(event){
  if(dead||busy||drag||!box.contains(event.target))return;if(!current()){message('تغيّر المشروع. افتح مراجعة النسخة الحالية.');return;}
  if(event.target.closest?.('[data-production-ledger]'))return;
  const u=event.target.closest?.('[data-production-unit]');if(u){chooseUnit(u.dataset.productionUnit);return;}
  const p=event.target.closest?.('[data-production-piece]');if(p){choose(Number(p.dataset.productionPiece));return;}
  const sheet=event.target.closest?.('[data-sheet-unit]');if(sheet){chooseUnit(sheet.dataset.sheetUnit);return;}
  const v=event.target.closest?.('button[data-production-view]');if(v){view=v.dataset.productionView;renderCanvas();return;}
  const op=event.target.closest?.('[data-production-operation]');if(op&&op.tagName!=='SELECT'){operationIndex=Number(op.dataset.productionOperation);renderCanvas();renderInspector();update();return;}
  const gate=event.target.closest?.('[data-production-gate]');if(gate){const link=gateLinks[Number(gate.dataset.productionGate)];if(link)safeLeave(...link);return;}
  const b=event.target.closest?.('[data-production-action]');if(!b||b.disabled)return;const name=b.dataset.productionAction,piece=baseline.pieces[pieceIndex];
  if(name==='save'){void save();return;}if(name==='cancel'){reset();return;}if(name==='undo'||name==='redo'){history(name==='redo');return;}
  if(name==='approve-factory'){
   if(!editable()||pending())return;const workshop=approveWorkshopCatalogRecord(doc.room.workshop,'factory');if(workshop)void persist({...doc,room:{...doc.room,workshop}},'اعتُمد سجل المصنع الحالي. تبقى بوابات إطلاق النسخة مستقلة.');return;
  }
  if(name==='release'){if(!gateState().groups.length&&getProjectAccess(doc).role==='owner')safeLeave('sign',{section:'release'});return;}
  if(name==='source'){const s=source(),step=s.step||'factory';if(s.specialId&&!canOpenWorkshopPage(getProjectAccess(doc).role,step==='factory'?factoryPageOf(s.focus?.tab):step))safeLeave('factory',{tab:'special',targetId:s.specialId});else safeLeave(step,s.focus||{tab:'recipes',family:s.family,line:s.line});return;}
  if(name==='material-source'&&piece)safeLeave('factory',{tab:'items',sku:piece.sku});
  if(name==='unit-source'&&doc.kitchen.units.some(u=>u.id===unitId))safeLeave('placement',{unitId});
  if(['machines','tracking','quote'].includes(name))safeLeave(name);
 }
 function edit(event){
  if(event.target.matches?.('[data-production-field]')){const field=event.target.dataset.productionField;editField(field,event.target.value);if(['kind','machine'].includes(field)){renderInspector();update();}}
  if(event.target.matches?.('select[data-production-operation]')){operationIndex=Number(event.target.value);renderCanvas();renderInspector();update();}
  if(event.target.matches?.('[data-production-search]')){filter=event.target.value;renderPieces();}
 }
 function key(event){
  if(event.isComposing)return;
  if(event.key==='Escape'&&drag){event.preventDefault?.();event.stopPropagation?.();endDrag(true);return;}
  if(event.key==='Escape'&&pending()&&!busy){event.preventDefault?.();event.stopPropagation?.();reset();return;}
  if(event.target.matches?.('[data-production-field]')&&numeric.includes(event.target.dataset.productionField)&&['ArrowUp','ArrowDown'].includes(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&editable()){
   const n=assistNumber(event.target.value);if(n!==null){event.preventDefault?.();event.target.value=String(Math.round((n+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1))*1e6)/1e6);editField(event.target.dataset.productionField,event.target.value);}return;
  }
  if(event.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key?.toLowerCase()==='z'){event.preventDefault?.();event.stopPropagation?.();history(!!event.shiftKey);}
 }
 function pointerDown(event){
  const hit=event.target.closest?.('[data-production-drag]');if(!hit||!editable()||!source().editable||event.button>0||drag)return;
  const index=Number(hit.dataset.productionDrag),ops=source().operations||[];if(!Number.isInteger(index)||index<0||index>ops.length)return;
  operationIndex=index;const svg=hit.closest('svg');let inverse,grab,op;try{inverse=svg.getScreenCTM().inverse();const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;grab=point.matrixTransform(inverse);op=operation(values());}catch{return;}
  if(!['drill','mill'].includes(op.kind))return;
  const p=quote().pieces[pieceIndex],item=catalog.items.find(i=>i.sku===p.sku),height=p.b||item?.sectionWidthMm;
  drag={id:event.pointerId,before:copy(raw),redo:copy(redo),svg,inverse,startX:event.clientX,startY:event.clientY,moved:false,offsetX:grab.x-(op.xFrom==='end'?p.a-op.x:op.x),offsetY:grab.y-(op.yFrom==='end'?height-op.y:op.y),changed:false};checkpoint();event.preventDefault?.();event.stopPropagation?.();box.setPointerCapture?.(event.pointerId);renderInspector();update();
 }
 function pointerMove(event){
  if(!drag||drag.id!==event.pointerId||!editable())return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<3)return;
  drag.moved=true;
  const point=drag.svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const xy=point.matrixTransform(drag.inverse),p=baseline.pieces[pieceIndex],item=catalog.items.find(i=>i.sku===p.sku),v=values(),height=p.b||item?.sectionWidthMm;
  const actualX=xy.x-drag.offsetX,actualY=xy.y-drag.offsetY,x=v.xFrom==='end'?p.a-actualX:actualX,y=v.yFrom==='end'?height-actualY:actualY;
  if(!Number.isFinite(x+y))return;const nextX=String(Math.round(x*10)/10),nextY=String(Math.round(y*10)/10);
  if(nextX===v.x&&nextY===v.y)return;drag.changed=true;
  editField('x',nextX,{record:false});editField('y',nextY,{record:false});
  for(const k of ['x','y']){const field=box.querySelector('[data-production-field="'+k+'"]');if(field)field.value=values()[k];}
 }
 function endDrag(cancel=false){
  if(!drag)return;const last=drag;drag=null;try{box.releasePointerCapture?.(last.id);}catch{/* capture may have ended */}
  if(cancel||!last.changed){raw=last.before;undo.pop();redo=last.redo;review();}notice=cancel?'أُلغي سحب موضع العملية.':error?'الموضع غير صالح. صححه أو تراجع عنه.':'موضع التشغيل في المعاينة؛ احفظه بعد المراجعة.';renderSelection();
 }
 function pointerUp(e){if(drag&&drag.id===e.pointerId){pointerMove(e);endDrag(false);}}
 function pointerCancel(e){if(drag&&drag.id===e.pointerId)endDrag(true);}
 function lostPointer(e){if(drag&&(e?.type==='blur'||e?.target===box&&e.pointerId===drag.id))endDrag(true);}
 box.addEventListener('click',ledgerGuard,true);box.addEventListener('click',click);box.addEventListener('input',edit);box.addEventListener('change',edit);box.addEventListener('keydown',key);box.addEventListener('pointerdown',pointerDown);box.addEventListener('pointermove',pointerMove);box.addEventListener('pointerup',pointerUp);box.addEventListener('pointercancel',pointerCancel);box.addEventListener('lostpointercapture',lostPointer);globalThis.addEventListener?.('blur',lostPointer);render();
 return {hasPending:pending,tracksDraft:target=>!!target.closest?.('.production-studio'),commandContext:snapshot,discard(){if(drag)endDrag(true);raw={};preview=null;error='';undo=[];redo=[];},destroy(){if(drag)endDrag(true);dead=true;ledgerDispose?.();for(const [name,fn] of [['click',click],['input',edit],['change',edit],['keydown',key],['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',pointerCancel],['lostpointercapture',lostPointer]])box.removeEventListener(name,fn);box.removeEventListener('click',ledgerGuard,true);globalThis.removeEventListener?.('blur',lostPointer);}};
}
