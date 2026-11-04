import {mountQuoteStep} from './kitchen-workshop-factory-ui.js';
import {getFactoryCatalog,buildFactoryQuote} from './kitchen-workshop-factory.js';
import {reviewQuotePreview} from './kitchen-quote-preview.js';
import {outputApprovalState} from './kitchen-workshop-state.js';
import {budgetHold} from './kitchen-layout-brief.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {catalogDisplayColor} from './kitchen-finish-parts.js';
import {catalogRecordStates} from './kitchen-catalog-records.js';
import {previewCustomerReport} from './kitchen-report-preview.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {getProjectAccess} from './kitchen-project-access.js';
import {canOpenWorkshopPage} from './kitchen-role-pages.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v);
const money=v=>typeof v==='number'&&Number.isFinite(v)?fmt(v)+' ر.س':'غير محسوم';
const delta=v=>v==null?'يظهر بعد اكتمال التسعير':v===0?'دون فرق':(v>0?'+':'−')+money(Math.abs(v));
const terms={labor:'أجور التصنيع',installation:'التركيب',delivery:'النقل',marginPct:'إضافة البيع على التكلفة',taxPct:'الضريبة على البيع',worktop:'نطاق خامة السطح'};
const action=(name,label,icon)=>'<button type="button" data-quote-action="'+name+'">'+(icon?studioIcon(icon):'')+label+'</button>';
const clone=v=>({...v});

// A draft contains only literal source inputs. Quantities, packing, sale totals
// and approval keys always come from the existing project domain.
export function mountQuoteStudio(host,{getDoc,apply,tell,onAdvance,focus={},canEdit=()=>false,onHistory,canHistory=()=>false}){
 if(!document.querySelector('link[data-quote-studio-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./kitchen-quote-studio.css';link.dataset.quoteStudioCss='';document.head.append(link);}
 const box=document.createElement('section');box.className='quote-studio';host.replaceChildren(box);
 let doc=getDoc(),catalog=getFactoryCatalog(doc),baseline=buildFactoryQuote(doc),raw={},undo=[],redo=[],preview=null,error='',notice='',busy=false,dead=false,epoch=0,ledgerDispose=null;
 let unit=doc.kitchen.units.some(u=>u.id===focus.unitId)?focus.unitId:'all',selected=focus.sku?'sku:'+focus.sku:focus.field&&Object.hasOwn(terms,focus.field)?'term:'+focus.field:'sku:'+(baseline.purchases[0]?.sku||''),search='';
 const pending=()=>Object.keys(raw).length>0||busy;
 const current=()=>!dead&&getDoc()===doc;
 const editable=()=>current()&&!busy&&canEdit();
 const shown=()=>preview?.doc||doc,quote=()=>preview?.quote||baseline;
 const snapshot=()=>({unitId:unit,...(selected.startsWith('sku:')?{sku:selected.slice(4)}:{field:selected.slice(5)})});
 const baseValue=key=>key.startsWith('sku:')?catalog.items.find(i=>i.sku===key.slice(4))?.price:catalog.terms[key.slice(5)];
 const rawValue=key=>Object.hasOwn(raw,key)?raw[key]:String(baseValue(key)??'');
 const message=text=>{notice=text;tell?.(text);update();};
 function edits(){
  const result={prices:{},terms:{}};
  for(const [key,text] of Object.entries(raw)){
   const field=key.slice(key.startsWith('sku:')?4:5);
   let value;
   if(key==='term:worktop')value=text;
   else {value=text.trim()===''?null:assistNumber(text);if(text.trim()!==''&&value===null)throw Error('أدخل رقمًا صالحًا. اترك الحقل فارغًا فقط إذا كان السعر غير محسوم.');}
   result[key.startsWith('sku:')?'prices':'terms'][field]=value;
  }
  return result;
 }
 function review(){
  epoch++;error='';preview=null;
  try{if(Object.keys(raw).length)preview=reviewQuotePreview(doc,edits());}catch(err){error=err.message;}
 }
 function input(target){
  if(!editable()||!box.contains(target))return;
  const value=target.value;if(rawValue(selected)===value)return;
  undo.push(clone(raw));if(undo.length>100)undo.shift();redo=[];
  raw={...raw,[selected]:value};if(value===String(baseValue(selected)??''))delete raw[selected];
  review();notice='';update();renderCosts();renderObjects();
 }
 function reset(){raw={};undo=[];redo=[];preview=null;error='';epoch++;notice='أُلغيت تعديلات الأسعار غير المحفوظة.';render();}
 function history(forward){
  if(!editable())return;
  const from=forward?redo:undo,to=forward?undo:redo;
  if(from.length){to.push(clone(raw));raw=from.pop();review();notice=forward?'أُعيدت معاينة التعديل.':'تم التراجع داخل معاينة الأسعار.';render();return;}
  if(pending()){message('ألغِ المعاينة أو احفظها قبل استعمال تاريخ المشروع.');return;}
  if(canHistory(forward))onHistory?.(forward,snapshot());
 }
 async function save(){
  if(!editable()||!pending()||error)return;
  let next;try{const checked=reviewQuotePreview(doc,edits());if(!checked.changed){reset();return;}next=checked.doc;}catch(err){error=err.message;update();return;}
  busy=true;update();
  try{
   // The workspace apply owns project validation, policy, persistence and undo.
   if(!current()||!canEdit())throw Error('تغيّر المشروع أو صلاحية التحرير. أعد فتح الحصر.');
   const result=await apply(next,'حُفظت أسعار الأصناف وشروط العرض.');
   if(dead)return;
   if(result?.ok===false)throw Error(result.reason||'تعذّر حفظ التعديل. بقيت المعاينة متاحة.');
   if(getDoc()===doc)throw Error('لم يُطبّق التغيير. بقيت المعاينة متاحة لإعادة المحاولة.');
   if((result?.next&&getDoc()!==result.next)||getDoc().room.projectId!==doc.room.projectId)throw Error('تغيّر المشروع أثناء الحفظ. أعد فتح النسخة الحالية.');
   // Project apply may normalize the candidate into a new object.
   doc=getDoc();catalog=getFactoryCatalog(doc);baseline=buildFactoryQuote(doc);raw={};undo=[];redo=[];preview=null;error='';epoch++;
   notice=result?.saved===false?'طُبّق التغيير في الجلسة فقط؛ تعذّر حفظه في المتصفح. صدّر نسخة من المشروع لحمايته.':'حُفظت الأسعار وشروط العرض. راجع اعتماد السجلات والعرض بعد التعديل.';
   render();
  }catch(err){notice=err.message;}finally{busy=false;if(!dead)update();}
 }
 function safeLeave(step,context){
  if(!current()){message('تغيّر المشروع. أعد فتح الحصر الحالي.');return;}
  if(pending()){message('احفظ تعديلات العرض أو ألغِها قبل فتح المصدر أو الاعتماد.');return;}
  onAdvance?.(step,context);
 }
 async function report(){
  if(!current()||busy||error)return;
  const opened=epoch,source=shown(),saved=!pending(),button=box.querySelector('[data-quote-action="preview"]');button.disabled=true;
  try{
   const [{customerReport},{reviewWholeProposal}]=await Promise.all([import('./kitchen-proposal-presentation.js'),import('./kitchen-whole-plan.js')]);
   if(!current()||opened!==epoch||!box.isConnected)return;
   const walls=[...new Set(source.kitchen.runs.map(r=>r.wall).filter(Boolean))];
   previewCustomerReport(customerReport({doc:source,saved,questions:reviewWholeProposal(source,walls,quote())}),button);
  }catch{message('تعذّر فتح عرض العميل. أعد المحاولة من النسخة الحالية.');}finally{if(!dead)update();}
 }
 function units(){return doc.kitchen.units.map((u,i)=>({...u,code:'U'+(i+1)}));}
 const unitLabel=id=>units().find(u=>u.id===id)?.code||id;
 function selection(key){
  if(!current()||busy)return;
  if(key.startsWith('sku:')&&!catalog.items.some(i=>i.sku===key.slice(4)))return;
  if(key.startsWith('term:')&&!Object.hasOwn(terms,key.slice(5)))return;
  selected=key;renderObjects();renderCosts();renderInspector();update();
 }
 function chooseUnit(id){
  if(!current()||busy||(id!=='all'&&!doc.kitchen.units.some(u=>u.id===id)))return;
  unit=id;
  const used=quote().pieces.filter(p=>unit==='all'||p.unitId===unit).map(p=>p.sku);
  if(selected.startsWith('sku:')&&!used.includes(selected.slice(4)))selected='sku:'+(used[0]||'');
  renderObjects();renderCosts();renderInspector();update();
 }
 function renderObjects(){
  const p=quote(),used=new Set(p.pieces.filter(v=>unit==='all'||v.unitId===unit).map(v=>v.sku));
  const match=s=>!search||s.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const items=p.purchases.filter(v=>used.has(v.sku)&&match(v.name+' '+v.sku));
  const list=box.querySelector('[data-quote-objects]');
  list.innerHTML='<h4>خامات النطاق · '+fmt(items.length)+'</h4>'+items.map(v=>'<button type="button" class="qs-object" data-quote-object="sku:'+esc(v.sku)+'" data-active="'+(selected==='sku:'+v.sku)+'" aria-pressed="'+(selected==='sku:'+v.sku)+'"><b>'+esc(v.name)+'</b><small><bdi>'+esc(v.sku)+'</bdi> · '+money(v.price)+'</small></button>').join('')+
   '<h4>شروط المشروع كاملًا</h4>'+Object.entries(terms).filter(([key,label])=>match(label)).map(([key,label])=>'<button type="button" class="qs-object" data-quote-object="term:'+key+'" data-active="'+(selected==='term:'+key)+'" aria-pressed="'+(selected==='term:'+key)+'">'+label+'</button>').join('');
 }
 function renderCosts(){
  const p=quote(),sku=selected.startsWith('sku:')?selected.slice(4):null,related=new Set(p.pieces.filter(v=>v.sku===sku).map(v=>v.unitId));
  box.querySelector('[data-quote-units]').innerHTML='<button type="button" class="qs-unit" data-quote-unit="all" aria-pressed="'+(unit==='all')+'" data-active="'+(unit==='all')+'"><b>المشروع كاملًا</b><small>'+fmt(p.totalUnits)+' وحدات</small></button>'+units().map(u=>'<button type="button" class="qs-unit" data-quote-unit="'+esc(u.id)+'" data-active="'+(unit===u.id)+'" data-related="'+related.has(u.id)+'" aria-pressed="'+(unit===u.id)+'"><span class="qs-cabinet" aria-hidden="true"></span><b><bdi>'+u.code+'</bdi></b><small>'+fmt(u.width*10)+' مم</small></button>').join('');
  const pieces=p.pieces.filter(v=>unit==='all'||v.unitId===unit),skus=new Set(pieces.map(v=>v.sku)),materials=p.purchases.filter(v=>skus.has(v.sku));
  box.querySelector('[data-quote-costs]').innerHTML='<header><h3>'+(unit==='all'?'من الوحدة إلى تكلفة الخام':'خامات '+unitLabel(unit))+'</h3><p>اختر وحدة ثم خامًا لمراجعة سعر شرائه. القيمة أدناه تخص كامل المشروع الذي يشترك في هذا الخام.</p></header><div class="qs-cost-list">'+materials.map(v=>{
   const color=catalogDisplayColor(catalog.items.find(i=>i.sku===v.sku)),count=new Set(p.pieces.filter(x=>x.sku===v.sku).map(x=>x.unitId)).size;
   return '<button type="button" class="qs-cost-row" data-quote-object="sku:'+esc(v.sku)+'" data-active="'+(sku===v.sku)+'" aria-pressed="'+(sku===v.sku)+'"><span class="qs-material"'+(color?' style="--material-color:'+color+'"':'')+' aria-hidden="true"></span><span><b>'+esc(v.name)+'</b><small><bdi>'+esc(v.sku)+'</bdi> · '+fmt(count)+' مصادر استهلاك</small></span><span><b>'+money(v.cost)+'</b><small>'+fmt(v.valueUnits??v.qty)+' وحدات خام مكافئة × '+money(v.price)+'</small></span></button>';
  }).join('')+'</div>'+(materials.length?'':'<p>لا توجد مشتريات مصنع لهذا النطاق. افتح الوحدات أو الوصفات لاستكمال الحصر.</p>')+
   (sku?'<details class="qs-pieces"><summary>القطع المرتبطة بالصنف المحدد · '+fmt(pieces.filter(v=>v.sku===sku).length)+' بنود</summary><div class="kw-tbl"><table><thead><tr><th>الوحدة</th><th>القطعة</th><th>المقاس مم</th><th>العدد</th></tr></thead><tbody>'+pieces.filter(v=>v.sku===sku).map(v=>'<tr><td>'+esc(unitLabel(v.unitId))+'</td><td>'+esc(v.label)+'</td><td><bdi>'+esc(v.a??'—')+' × '+esc(v.b??'—')+'</bdi></td><td>'+fmt(v.count)+'</td></tr>').join('')+'</tbody></table></div></details>':'');
 }
 function renderInspector(){
  const key=selected,sku=key.startsWith('sku:')?key.slice(4):null,item=catalog.items.find(i=>i.sku===sku),field=key.slice(5),isTerm=!sku&&Object.hasOwn(terms,field),target=box.querySelector('[data-quote-inspector]');
  if(!item&&!isTerm){target.innerHTML='<h3>حدد بندًا للمراجعة</h3><p>اختر خامًا مستخدمًا أو أحد شروط المشروع.</p>';return;}
  const label=item?item.name:terms[field],percent=['marginPct','taxPct'].includes(field),disabled=editable()?'':' disabled';
  const editor=key==='term:worktop'?'<select data-quote-value aria-label="نطاق خامة السطح"'+disabled+'><option value="separate"'+(rawValue(key)==='separate'?' selected':'')+'>خارج عرض المصنع</option><option value="include"'+(rawValue(key)==='include'?' selected':'')+'>ضمن عرض المصنع</option></select>':'<input type="text" inputmode="decimal" autocomplete="off" data-quote-value value="'+esc(rawValue(key))+'" aria-label="'+esc(item?'سعر شراء '+item.name:label)+'" aria-describedby="quote-input-help quote-edit-error"'+disabled+'>';
  const related=item?[...new Set(quote().pieces.filter(v=>v.sku===sku).map(v=>v.unitId))]:[];
  target.innerHTML='<span class="qs-kicker">'+(item?'سعر الصنف في كتالوج المشروع':'شروط عرض المشروع')+'</span><h3>'+esc(label)+'</h3>'+(item?'<p><bdi>'+esc(sku)+'</bdi></p>':'')+'<label class="qs-editor">'+(item?'سعر وحدة شراء الخام · ر.س':label+(percent?' · %':field==='worktop'?'':' · ر.س'))+editor+'</label><p id="quote-input-help">'+(field==='worktop'?'تقدير خامة السطح يتبع أسعار واحتياط المشروع.':percent?'النسبة من 0 إلى 100. الفراغ يعني غير محسوم.':'الفراغ يعني سعرًا غير محسوم؛ الصفر قيمة صريحة. الأسهم تعدّل القيمة بمقدار 1، ومع Shift بمقدار 10.')+'</p><p id="quote-edit-error" data-quote-error role="alert"></p><div class="qs-impact" data-quote-impact></div>'+
   (item?'<div class="qs-tags"><h4>يرتبط بهذا الخام</h4>'+related.map(id=>'<button type="button" data-quote-unit="'+esc(id)+'"'+(!doc.kitchen.units.some(u=>u.id===id)?' disabled':'')+'>'+esc(unitLabel(id))+'</button>').join('')+'<p>التغيير يسري على الصنف في كل المشروع، حتى عند مراجعة وحدة واحدة.</p></div>':'<p>هذه القيمة تخص المشروع كاملًا.</p>')+
   '<div class="qs-source-actions">'+action('source',item?'فتح الصنف في الكتالوج':'فتح شروط التسعير','layers')+(unit!=='all'?action('unit-source','فتح الوحدة في المصمم','drawing')+action('finish-source','مراجعة تشطيب الوحدة','layers'):'')+'</div>'+
   (!canEdit()?'<p>الأسعار للعرض فقط ضمن صلاحيتك. يحرر المالك أسعار الأصناف وشروط العرض من هذه المساحة.</p>':'');
 }
 function gates(){
  const source=shown(),p=quote(),state=outputApprovalState(source,p),list=[];
  if(state.designReview)list.push([state.designReview.reason,'placement',{unitId:state.designReview.unitId}]);
  if(!state.valid.structure)list.push(['راجع واعتمد الهيكل قبل موافقة العميل.','approve']);
  if(!p.complete)list.push(['التسعير غير مكتمل: '+(p.missing.join('، ')||p.issues.join('، ')),'factory',{tab:'sale'}]);
  if(p.fitoutPending?.length)list.push(['أكمل قرارات قواعد الدواليب ونعلة الرخام.','assembly']);
  const hold=budgetHold(p,source.room.workshop?.layoutBrief);if(hold)list.push([hold,'whole']);
  return {state,list};
 }
 let gateLinks=[];
 function update(){
  if(dead)return;
  const p=quote(),draft=Object.keys(raw).length>0,{state,list}=gates();gateLinks=list;
  const d=preview?.delta;
  box.dataset.state=busy?'saving':!current()?'stale':error?'invalid':draft?'preview':'saved';
  box.querySelector('[data-quote-summary]').innerHTML='<div class="qs-total"><span>'+(error?'إجمالي النسخة المحفوظة':draft?'معاينة إجمالي العرض':'إجمالي عرض المشروع')+'</span><strong data-quote-total>'+money(p.total)+'</strong><small>'+(p.fitoutPending?.length?'نطاق التجهيز غير مكتمل':p.total===null?'أكمل أسعار ومتطلبات الحصر':'شامل الضريبة المحددة')+'</small></div><div><span>قيمة مواد المشروع</span><strong>'+money(p.materialValue)+'</strong><small>شاملة استخدام الخام والبواقي</small></div><div><span>مشتريات جديدة بعد الرصيد</span><strong>'+money(p.additionalPurchaseCost)+'</strong><small>إنفاق مستقل عن قيمة المواد</small></div><div><span>'+(draft?'الأثر على إجمالي العرض':'اعتماد العميل')+'</span><strong data-quote-delta>'+(draft?delta(d):state.valid.customer?'معتمد للنسخة الحالية':'بانتظار المراجعة')+'</strong><small>'+(draft?'مقارنة بالمحفوظ · '+money(baseline.total):fmt(p.coveredUnits)+' / '+fmt(p.totalUnits)+' وحدات لها وصفات')+'</small></div>';
  box.querySelector('[data-quote-status]').textContent=!current()?'تغيّر المشروع. افتح الحصر الحالي قبل أي إجراء.':busy?'جارٍ تطبيق الأسعار…':error?error:notice|| (draft?'معاينة غير محفوظة. تحفظ جميع تعديلات الأسعار معًا.':'اختر وحدة أو خامًا لمراجعة المصدر وأثر السعر.');
  const errorNode=box.querySelector('[data-quote-error]');if(errorNode)errorNode.textContent=error;
  const inputNode=box.querySelector('[data-quote-value]');if(inputNode){inputNode.disabled=!editable();inputNode.setAttribute('aria-invalid',String(!!error));}
  const impact=box.querySelector('[data-quote-impact]');if(impact)impact.innerHTML='<dl><div><dt>العرض المحفوظ</dt><dd>'+money(baseline.total)+'</dd></div><div><dt>العرض بعد التعديل</dt><dd>'+ (error?'صحح الإدخال أولًا':money(p.total))+'</dd></div><div><dt>فرق العرض كاملًا</dt><dd>'+delta(draft?d:0)+'</dd></div><div><dt>فرق قيمة المواد</dt><dd>'+delta(draft?preview?.materialDelta:0)+'</dd></div></dl>';
  for(const name of ['save','cancel','undo','redo','preview','approve']){
   const button=box.querySelector('[data-quote-action="'+name+'"]');if(!button)continue;
   button.disabled=!current()||busy||({save:!canEdit()||!preview?.changed||!!error,cancel:!draft,undo:!canEdit()||!(undo.length||!draft&&canHistory(false)),redo:!canEdit()||!(redo.length||!draft&&canHistory(true)),preview:!!error||(!doc.kitchen.units.length&&!Object.keys(doc.room.workshop?.corners||{}).length),approve:draft||!!error||list.length>0}[name]);
  }
  const records=catalogRecordStates(shown().room.workshop),unapproved=records?Object.entries(records).filter(([,s])=>!s.approved).map(([role])=>({store:'أسعار المتجر',factory:'وصفات المصنع',pricing:'شروط التسعير'})[role]):[];
  box.querySelector('[data-quote-gates]').innerHTML='<h3>جاهزية عرض العميل</h3>'+(list.length?'<ul>'+list.map(([label],i)=>'<li><button type="button" data-quote-gate="'+i+'">'+esc(label)+'</button></li>').join('')+'</ul>':'<p>متطلبات اعتماد العميل مكتملة. راجع العرض ثم سجّل الموافقة باسمه.</p>')+(unapproved.length?'<p>قبل إصدار الورشة: تحتاج سجلات '+unapproved.map(esc).join('، ')+' إلى مراجعة واعتماد من صفحاتها.</p>':'')+(p.issues.length?'<details><summary>ملاحظات الحصر · '+fmt(p.issues.length)+'</summary><ul>'+p.issues.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>':'');
 }
 function render(){
  ledgerDispose?.();
  box.innerHTML='<header class="qs-header"><div><span class="qs-kicker">الحصر والتسعير · مراجعة مترابطة</span><h2>'+esc(doc.room.name||'عرض المشروع')+'</h2><p>الوحدة ← الخامة ← أثرها على عرض العميل</p></div><div class="qs-actions" role="group" aria-label="تاريخ تعديلات العرض">'+action('undo','تراجع','undo')+action('redo','إعادة','redo')+action('cancel','إلغاء المعاينة')+action('save','حفظ تعديلات العرض','save')+'</div></header><div class="qs-summary" data-quote-summary></div><p class="qs-status" data-quote-status role="status" aria-live="polite"></p><div class="qs-workspace"><aside class="qs-objects"><h3>بنود العرض</h3><label>البحث عن خام أو خدمة<input type="search" data-quote-search value="'+esc(search)+'" placeholder="اسم الخامة أو رمز الصنف"></label><div data-quote-objects></div></aside><main class="qs-main"><div class="qs-units" data-quote-units role="group" aria-label="تحديد الوحدة المرتبطة بالتكلفة"></div><div data-quote-costs></div></main><aside class="qs-inspector" data-quote-inspector></aside></div><section class="qs-gates"><div data-quote-gates></div><div class="qs-actions">'+action('preview','معاينة عرض العميل','image')+action('approve','مراجعة واعتماد النسخة','quote')+'</div></section><details class="qs-ledger"><summary>سجل الحصر الكامل · المشتريات والقص والتصدير</summary><p>يعرض هذا السجل النسخة المحفوظة. احفظ المعاينة أو ألغِها قبل فتح مصادره أو تنزيلها.</p><div data-quote-ledger></div></details>';
  const actions=box.querySelector('.qs-gates .qs-actions');if(canOpenWorkshopPage(getProjectAccess(doc).role,'production'))actions.innerHTML+=action('production','مراجعة القص والتجميع','factory');
  renderObjects();renderCosts();renderInspector();
  ledgerDispose=mountQuoteStep(box.querySelector('[data-quote-ledger]'),{getDoc,isCurrent:()=>current()&&!pending(),onAdvance:safeLeave,tell});
  update();
 }
 function ledgerGuard(event){
  if(!event.target.closest?.('[data-quote-ledger]')||!event.target.closest?.('button,a'))return;
  if(!current()||pending()){event.preventDefault?.();event.stopImmediatePropagation?.();message(!current()?'تغيّر المشروع. أعد فتح الحصر الحالي.':'احفظ المعاينة أو ألغِها قبل استخدام سجل النسخة المحفوظة.');}
 }
 function click(event){
  if(dead||busy||!box.contains(event.target))return;
  if(!current()){message('تغيّر المشروع. أعد فتح الحصر الحالي.');return;}
  if(event.target.closest?.('[data-quote-ledger]'))return;
  const object=event.target.closest?.('[data-quote-object]');if(object){selection(object.dataset.quoteObject);return;}
  const target=event.target.closest?.('[data-quote-unit]');if(target&&!target.disabled){chooseUnit(target.dataset.quoteUnit);return;}
  const gate=event.target.closest?.('[data-quote-gate]');if(gate){const link=gateLinks[Number(gate.dataset.quoteGate)];if(link)safeLeave(link[1],link[2]);return;}
  const button=event.target.closest?.('[data-quote-action]');if(!button||button.disabled)return;
  const act=button.dataset.quoteAction;
  if(act==='save')return save();if(act==='cancel'){reset();return;}if(act==='undo'||act==='redo'){history(act==='redo');return;}if(act==='preview')return report();
  if(act==='approve'){if(!gates().list.length)safeLeave('sign');return;}
  if(act==='production')safeLeave('production',unit==='all'?{}:{unitId:unit});
  if(act==='source')safeLeave('factory',selected.startsWith('sku:')?{tab:'items',sku:selected.slice(4)}:{tab:'sale',field:selected.slice(5)});
  if(act==='unit-source'&&unit!=='all')safeLeave('placement',{unitId:unit});
  if(act==='finish-source'&&unit!=='all')safeLeave('finish',{unitId:unit});
 }
 function edit(event){
  if(event.target.matches?.('[data-quote-value]'))input(event.target);
  if(event.target.matches?.('[data-quote-search]')){search=event.target.value;renderObjects();}
 }
 function key(event){
  if(event.isComposing)return;
  if(event.key==='Escape'&&pending()&&!busy){event.preventDefault?.();event.stopPropagation?.();reset();return;}
  if(event.target.matches?.('input[data-quote-value]')&&['ArrowUp','ArrowDown'].includes(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&editable()){
   const value=assistNumber(event.target.value);if(value!==null){event.preventDefault?.();event.target.value=String(Math.round((value+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1))*1e6)/1e6);input(event.target);}return;
  }
  if(event.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key?.toLowerCase()==='z'){event.preventDefault?.();event.stopPropagation?.();history(!!event.shiftKey);}
 }
 box.addEventListener('click',ledgerGuard,true);box.addEventListener('click',click);box.addEventListener('input',edit);box.addEventListener('change',edit);box.addEventListener('keydown',key);render();
 return {hasPending:pending,tracksDraft:target=>!!target.closest?.('.quote-studio'),commandContext:snapshot,discard(){raw={};preview=null;error='';undo=[];redo=[];epoch++;},destroy(){dead=true;epoch++;ledgerDispose?.();box.removeEventListener('click',ledgerGuard,true);box.removeEventListener('click',click);box.removeEventListener('input',edit);box.removeEventListener('change',edit);box.removeEventListener('keydown',key);}};
}
