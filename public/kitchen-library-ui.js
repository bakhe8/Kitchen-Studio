// The libraries page of the store: one page for every library of the device. Look, add, change, hide, import a table, export, and copy pieces
// into the factory catalog. Built for a tablet: large controls, one list, one form, nothing that needs hovering.
import {libraryDefs,libraryIds,statusNames,sourceNames,unitNames} from './kitchen-library-defs.js';
import {libraries} from './kitchen-library-store.js';
import {libraryColumns,templateRows,detectColumns,exportRows,toCSV,previewImport,applyImport} from './kitchen-library-table.js';
import {openWorkshopTables,parseWorkshopTable} from './kitchen-workshop-spreadsheet.js';
import {addToCatalog,canAddToCatalog,catalogLibraries} from './kitchen-library-catalog.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {getProjectAccess} from './kitchen-project-access.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const plain=label=>String(label).replace(/\s*·\s*(?:مم|سم|كغ)\s*$/,'');
const dims=(w,h,d)=>[w!=null&&fmt(w)+' عرض',h!=null&&fmt(h)+' ارتفاع',d!=null&&fmt(d)+' عمق'].filter(Boolean).join(' × ');
const optionLabel=(def,key,value)=>def.fields.find(f=>f.key===key)?.options?.[value];
const pageSize=60;

// The lines under a record's name: what a person needs to tell two records apart.
export function summaryLines(r){
 const a=r.attrs,def=libraryDefs[r.library],lines=[];
 if(r.library==='appliance'){
  const who=[a.brand,a.model].filter(Boolean).join(' · ');if(who)lines.push(who);
  lines.push('الجسم: '+dims(a.bodyWidthMm,a.bodyHeightMm,a.bodyDepthMm)+' مم');
  lines.push('الحيز: '+dims(a.spaceWidthMm,a.spaceHeightMm,a.spaceDepthMm)+' مم');
  const cut=dims(a.cutoutWidthMm,a.cutoutHeightMm,a.cutoutDepthMm);if(cut)lines.push('فتحة القص: '+cut+' مم');
  if(a.manual)lines.push('المرجع: '+a.manual);
 }else if(r.library==='sink'){
  const who=[a.brand,a.model].filter(Boolean).join(' · ');if(who)lines.push(who);
  lines.push([a.bowls&&({1:'حوض واحد',2:'حوضان'}[a.bowls]||fmt(a.bowls)+' أحواض'),optionLabel(def,'mount',a.mount),a.drainer!=='none'&&optionLabel(def,'drainer',a.drainer),a.widthMm&&fmt(a.widthMm)+' × '+fmt(a.depthMm)+' مم'].filter(Boolean).join(' · '));
  if(a.cutoutWidthMm||a.cutoutDepthMm)lines.push('فتحة القص: '+[a.cutoutWidthMm,a.cutoutDepthMm].filter(Boolean).map(fmt).join(' × ')+' مم'+(a.minUnitWidthMm?' · أقل عرض للوحدة '+fmt(a.minUnitWidthMm)+' مم':''));
 }else if(r.library==='hardware'||r.library==='handle'){
  const who=[a.brand,a.code].filter(Boolean).join(' · ');if(who)lines.push(who);
  lines.push([optionLabel(def,'unit',a.unit)&&'الشراء بال'+optionLabel(def,'unit',a.unit),a.spec,a.finishName,a.lengthMm&&'الطول '+fmt(a.lengthMm)+' مم',a.centersMm&&fmt(a.centersMm)+' مم بين المسمارين',a.loadKg&&'حمل '+fmt(a.loadKg)+' كغ'].filter(Boolean).join(' · '));
 }else if(r.library==='finish'){
  lines.push([optionLabel(def,'use',a.use),a.supplierCode?'رمز المورد '+a.supplierCode:'بلا رمز مورد'].join(' · '));
 }else if(r.library==='supplier'){
  lines.push(fmt(a.widthMm)+' × '+fmt(a.depthMm)+' × '+fmt(a.heightMm)+' مم · رقم المنتج '+a.article);
 }
 return lines.filter(Boolean);
}
// A price is per square metre for a finish and per unit of purchase for hardware and handles; the others are priced as a whole.
const priceUnit=r=>r.library==='finish'?' / م²':(r.library==='hardware'||r.library==='handle')&&r.attrs.unit?' / '+unitNames[r.attrs.unit]:'';
const priceText=r=>r.price==null?'بلا سعر':fmt(r.price)+' ر.س'+priceUnit(r);
const priceLabel=library=>'السعر · ر.س'+(library==='finish'?' للمتر المربع':library==='hardware'||library==='handle'?' لوحدة الشراء':'');

export function rowHTML(r){
 const catalogable=catalogLibraries.includes(r.library);
 return '<article class="klib-row" data-lib-id="'+esc(r.id)+'"'+(r.hidden?' data-hidden="true"':'')+'><div class="klib-main"><strong>'+esc(r.label)+'</strong>'+
  summaryLines(r).map(l=>'<small>'+esc(l)+'</small>').join('')+
  '<span class="klib-chips"><i data-chip="status" data-value="'+r.status+'">'+statusNames[r.status]+'</i><i data-chip="source" data-value="'+r.source+'">'+sourceNames[r.source]+'</i>'+(r.hidden?'<i data-chip="hidden">مخفي</i>':'')+'</span>'+(r.note?'<small class="klib-note">'+esc(r.note)+'</small>':'')+'</div>'+
  '<div class="klib-side"><b class="klib-price" data-set="'+(r.price!=null)+'">'+priceText(r)+'</b><div class="klib-actions"><button type="button" data-lib-edit="'+esc(r.id)+'">تعديل</button>'+
  (catalogable?'<button type="button" data-lib-catalog="'+esc(r.id)+'"'+(canAddToCatalog(r)?'':' disabled title="يُسعَّر بالمتر"')+'>إلى الكتالوج</button>':'')+
  '<button type="button" data-lib-hide="'+esc(r.id)+'" data-to="'+(r.hidden?'show':'hide')+'">'+(r.hidden?'إظهار':'إخفاء')+'</button></div></div></article>';
}

function fieldHTML(f,value,locked){
 const name='a.'+f.key,label='<span>'+esc(f.short||plain(f.label))+(f.required?' <b aria-hidden="true">*</b>':'')+'</span>',v=value??'';
 if(f.type==='pick')return '<label>'+label+'<select name="'+name+'"'+(locked?' disabled':'')+'><option value="">—</option>'+Object.entries(f.options).map(([k,l])=>'<option value="'+esc(k)+'"'+(k===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
 const numeric=f.type!=='text';
 return '<label>'+label+'<input name="'+name+'"'+(numeric?' inputmode="decimal" dir="ltr"':' maxlength="'+f.max+'"')+' value="'+esc(v)+'"'+(f.required?' required':'')+(locked?' disabled':'')+'></label>';
}
// The form of one record. A record the program ships can only take a price, a status, a note (and the supplier's code for a finish).
export function formHTML(library,record){
 const def=libraryDefs[library],shipped=!!record?.shipped,r=record||{family:Object.keys(def.families)[0],attrs:{},status:'draft',price:null,note:''};
 // Fields of one group (the three sizes of a body, a bay or a cut-out) sit together in a box with its name.
 const own=fields=>{
  const out=[];let group=null,buffer=[];
  const flush=()=>{if(buffer.length)out.push(group?'<fieldset class="klib-group"><legend>'+esc(group)+'</legend><div class="klib-fields klib-fields-3">'+buffer.join('')+'</div></fieldset>':'<div class="klib-fields">'+buffer.join('')+'</div>');buffer=[];};
  for(const f of fields.filter(f=>!f.fixed)){if((f.group||null)!==group){flush();group=f.group||null;}buffer.push(fieldHTML(f,r.attrs[f.key],false));}
  flush();return out.join('');
 };
 const frozen=shipped?'<dl class="klib-facts">'+[['الفئة',def.families[r.family]],...def.fields.filter(f=>f.key!=='supplierCode'&&r.attrs[f.key]!==undefined).map(f=>[plain(f.label),f.type==='pick'?f.options[r.attrs[f.key]]:f.type==='text'?r.attrs[f.key]:fmt(r.attrs[f.key])])].map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>':'';
 const head=shipped?'<p class="klib-hint">'+(r.source==='generic'?'مثال عام يأتي مع البرنامج. يمكنك تسجيل سعره وحالته وملاحظة عليه، أو نسخه لتعديل مقاساته.':'سجل من البرنامج. يمكنك تسجيل رمز المورد والسعر والحالة وملاحظة.')+'</p>'+frozen:
  '<div class="klib-fields"><label><span>الاسم <b aria-hidden="true">*</b></span><input name="label" maxlength="100" required value="'+esc(r.label)+'"></label><label><span>الفئة <b aria-hidden="true">*</b></span><select name="family">'+Object.entries(def.families).map(([k,l])=>'<option value="'+k+'"'+(k===r.family?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label></div>'+own(def.fields);
 const extra=shipped&&def.fields.some(f=>f.key==='supplierCode')?fieldHTML(def.fields.find(f=>f.key==='supplierCode'),r.attrs.supplierCode,false):'';
 return '<form class="klib-form" data-lib-form novalidate><h3>'+(record?(shipped?'ملاحظات على «'+esc(r.label)+'»':'تعديل «'+esc(r.label)+'»'):'إضافة '+esc(def.one))+'</h3>'+head+extra+
  '<div class="klib-fields"><label>'+priceLabel(library)+'<input name="price" inputmode="decimal" dir="ltr" value="'+esc(r.price??'')+'" placeholder="فارغ = لم يُحسم"></label><label>الحالة<select name="status">'+Object.entries(statusNames).map(([k,l])=>'<option value="'+k+'"'+(k===r.status?' selected':'')+'>'+l+'</option>').join('')+'</select></label></div>'+
  '<label>ملاحظة<input name="note" maxlength="300" value="'+esc(r.note)+'"></label><p class="klib-error" role="alert" data-lib-error></p>'+
  '<div class="klib-actions klib-form-actions"><button type="submit" class="klib-primary">حفظ</button><button type="button" data-lib-cancel>إلغاء</button>'+
  (record&&!def.closed?'<button type="button" data-lib-copy>'+(shipped?'نسخ للتعديل':'نسخ')+'</button>':'')+(record&&!shipped?'<button type="button" data-lib-delete class="klib-danger">حذف</button>':'')+'</div></form>';
}
// What the form holds, in the shape the store checks.
export function readForm(library,get,record){
 const def=libraryDefs[library],input={price:get('price'),status:get('status'),note:get('note'),attrs:{}};
 if(record?.shipped){input.id=record.id;const code=get('a.supplierCode');if(code!=null)input.attrs.supplierCode=code;return input;}
 input.label=get('label');input.family=get('family');if(record)input.id=record.id;
 for(const f of def.fields)if(!f.fixed&&get('a.'+f.key)!=null)input.attrs[f.key]=get('a.'+f.key);
 return input;
}

export function mountLibraryPage(host,{getDoc,apply,tell,focus={}}={}){
 const canWrite=()=>['owner','store'].includes(getProjectAccess(getDoc?.()).role);
 if(!host)throw new TypeError('The libraries page needs a host');
 const d=host.ownerDocument,ac=new AbortController(),on=(node,type,fn)=>node.addEventListener(type,fn,{signal:ac.signal});
 const box=d.createElement('section');box.className='klib klib-page';box.dataset.editing='false';
 box.innerHTML='<div class="klib-inner"><p class="klib-intro">ما لدى المتجر من أجهزة وأحواض وخردوات ومقابض وخامات. تُنسخ سجلاتها إلى المشاريع ولا يشير إليها المشروع بمعرّف.</p><nav class="klib-tabs" data-lib-tabs aria-label="المكتبات"></nav><p class="klib-link" data-lib-link></p>'+
  '<div class="klib-tools" data-lib-tools></div><div class="klib-list" data-lib-list></div><div data-lib-editor></div>'+
  '<details class="klib-more" data-lib-more><summary>استيراد وتصدير</summary><div data-lib-transfer></div></details>'+
  '<p class="klib-status" role="status" aria-live="polite" data-lib-status></p><p class="klib-where" data-lib-where></p></div>';
 host.replaceChildren(box);
 const q=s=>box.querySelector(s);
 let library=libraryDefs[focus.library]?focus.library:'appliance',query='',family='',showHidden=false,limit=pageSize,editing=null,confirm=null,savedScroll=0;
 let table=null,mapping=[],preview=null,sheets=[],ticket=0;
 const say=(text,bad=false,state='info')=>{const p=q('[data-lib-status]');p.textContent=text||'';p.dataset.bad=String(bad);p.dataset.state=bad?'error':state;};
 const def=()=>libraryDefs[library];
 const current=()=>libraries.list(library,{query,family,includeHidden:showHidden});

 function drawTabs(){
  q('[data-lib-tabs]').innerHTML=libraryIds.map(id=>'<button type="button" data-lib-tab="'+id+'" aria-pressed="'+(id===library)+'">'+esc(libraryDefs[id].label)+'<b>'+fmt(libraries.counts(id).visible)+'</b></button>').join('');
  q('[data-lib-link]').textContent=def().link;
 }
 function drawTools(){
  const c=libraries.counts(library),generic=c.generic;
  q('[data-lib-tools]').innerHTML='<label class="klib-search"><span>بحث</span><input type="search" data-lib-search value="'+esc(query)+'" placeholder="الاسم أو الماركة أو الرمز" autocomplete="off"></label>'+
   '<label><span>الفئة</span><select data-lib-family><option value="">كل الفئات</option>'+Object.entries(def().families).map(([k,l])=>'<option value="'+k+'"'+(k===family?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
   (def().closed?'':'<button type="button" class="klib-primary" data-lib-add>'+studioIcon('plus')+' إضافة '+esc(def().one)+'</button>')+
   '<div class="klib-bulk">'+(generic?'<button type="button" data-lib-hide-generic>'+(confirm==='hide-generic'?'تأكيد إخفاء '+fmt(generic)+' مثالًا عامًا':'إخفاء الأمثلة العامة ('+fmt(generic)+')')+'</button>':'')+
   (c.hidden?'<label class="klib-check"><input type="checkbox" data-lib-show-hidden'+(showHidden?' checked':'')+'> عرض المخفي ('+fmt(c.hidden)+')</label>':'')+
   (catalogLibraries.includes(library)?'<button type="button" data-lib-catalog-all>'+(confirm==='catalog-all'?'تأكيد: إضافة '+fmt(current().filter(canAddToCatalog).length)+' إلى الكتالوج':'إضافة المعروض إلى كتالوج المصنع')+'</button>':'')+'</div>';
 }
 function drawList(){
  const rows=current(),shown=rows.slice(0,limit);
  q('[data-lib-list]').innerHTML=(rows.length?shown.map(rowHTML).join('')+(rows.length>shown.length?'<button type="button" class="klib-more-rows" data-lib-more-rows>عرض المزيد ('+fmt(rows.length-shown.length)+')</button>':''):
   '<p class="klib-empty">'+(query||family?'لا نتيجة لهذا البحث.':def().closed?'لا سجلات.':'المكتبة فارغة. اضغط «إضافة» أو استورد جدولًا.')+'</p>');
 }
 function drawEditor(){
  const host=q('[data-lib-editor]');
  if(!editing){host.innerHTML='';return;}
  const record=editing.id?libraries.get(library,editing.id):null;
  if(editing.id&&!record){editing=null;host.innerHTML='';return;}
  host.innerHTML=formHTML(library,record);
  host.querySelector('input:not([disabled]),select:not([disabled])')?.focus?.({preventScroll:false});
 }
 function drawWhere(){
  const kind=libraries.adapterKind;
  q('[data-lib-where]').textContent=kind==='indexeddb'?'تُحفظ المكتبات في قاعدة بيانات هذا الجهاز. انقلها إلى جهاز آخر بملف المكتبات.':kind==='localstorage'?'تُحفظ المكتبات في ذاكرة المتصفح لأن قاعدة الجهاز غير متاحة. انقلها بملف المكتبات.':'تنبيه: المتصفح لا يسمح بحفظ المكتبات، وستضيع بإغلاق الصفحة. صدّر ملف المكتبات.';
  q('[data-lib-where]').dataset.kind=kind;
 }
 function drawTransfer(){
  const csv='data:text/csv;charset=utf-8,'+encodeURIComponent(toCSV(templateRows(library)));
  q('[data-lib-transfer]').innerHTML='<div class="klib-actions"><button type="button" data-lib-export-csv>'+studioIcon('download')+' تصدير جدول هذه المكتبة</button><a class="klib-link-button" href="'+csv+'" download="library-'+library+'-template.csv">'+studioIcon('download')+' قالب فارغ</a></div>'+
   '<div class="klib-actions"><button type="button" data-lib-export-pack>'+studioIcon('download')+' ملف المكتبات كلها</button><label class="klib-file">'+studioIcon('upload')+' فتح ملف مكتبات<input type="file" accept=".json,application/json" data-lib-pack aria-label="فتح ملف مكتبات"></label></div>'+
   '<hr><p>استورد جدول '+esc(def().label)+' من Excel أو CSV. الأسطر المطابقة بالمعرف أو بالاسم والفئة تُحدَّث ولا تتكرر. الأرقام الهندسية بالملليمتر.</p>'+
   '<div class="klib-actions"><label class="klib-file">'+studioIcon('upload')+' فتح جدول<input type="file" accept=".xlsx,.csv,.tsv,.txt" data-lib-file aria-label="فتح جدول '+esc(def().label)+'"></label></div>'+
   '<label>أو الصق الخلايا من Excel<textarea rows="3" data-lib-paste placeholder="انسخ صف العناوين وصفوف السجلات"></textarea></label><div class="klib-actions"><button type="button" data-lib-read>'+studioIcon('list')+' قراءة الجدول</button></div>'+
   '<div data-lib-sheets></div><div data-lib-mapping></div><div data-lib-preview></div>';
  resetImport(false);
 }
 const drawAll=()=>{drawTabs();drawTools();drawList();drawEditor();drawWhere();};
 // A form takes the whole panel, so a tablet shows one thing at a time; closing it returns to the list where it was.
 const scroller=()=>box.closest?.('.ws-content')||q('.klib-inner');
 function startEdit(id){savedScroll=scroller().scrollTop;editing={id:id||null};box.dataset.editing='true';drawEditor();scroller().scrollTop=0;}
 function endEdit(){editing=null;box.dataset.editing='false';drawEditor();scroller().scrollTop=savedScroll;}

 // ---------- the table import ----------
 function resetImport(clear=true){ticket++;table=null;mapping=[];preview=null;sheets=[];if(clear){const f=q('[data-lib-file]'),p=q('[data-lib-paste]');if(f)f.value='';if(p)p.value='';for(const s of ['[data-lib-sheets]','[data-lib-mapping]','[data-lib-preview]'])q(s).innerHTML='';}}
 function loadTable(rows){
  if(!rows||rows.length<2)throw Error('اختر جدولًا فيه صف عناوين وسجل واحد على الأقل.');
  table=rows;preview=null;mapping=detectColumns(library,rows[0]);drawMapping();q('[data-lib-preview]').innerHTML='';say('');
 }
 function drawMapping(){
  const cols=libraryColumns(library),ok=mapping.filter(Boolean);
  q('[data-lib-mapping]').innerHTML='<details class="klib-map"'+(ok.length<2?' open':'')+'><summary>ربط الأعمدة · '+fmt(ok.length)+' من '+fmt(table[0].length)+'</summary><div class="klib-fields">'+
   table[0].map((title,i)=>'<label>'+esc(title||'عمود '+fmt(i+1))+'<select data-lib-map="'+i+'"><option value="">تجاهل</option>'+cols.map(c=>'<option value="'+c.key+'"'+(mapping[i]===c.key?' selected':'')+'>'+esc(plain(c.label))+'</option>').join('')+'</select></label>').join('')+'</div></details>'+
   '<div class="klib-actions"><button type="button" data-lib-preview-run>'+studioIcon('search')+' معاينة</button></div>';
 }
 function drawPreview(){
  preview=previewImport(libraries,library,table,mapping);
  const {errors,entries,added,updated,unchanged,validated}=preview,names={added:'جديد',updated:'تحديث',unchanged:'مطابق'};
  q('[data-lib-preview]').innerHTML='<p><b>'+fmt(added)+' جديد · '+fmt(updated)+' تحديث · '+fmt(unchanged)+' مطابق</b></p>'+
   (errors.length?'<div class="klib-errors" role="alert"><b>صحّح '+fmt(errors.length)+' من الملاحظات ثم أعد المعاينة. لم يُحفظ شيء.</b><ul>'+errors.slice(0,40).map(e=>'<li>'+esc(e)+'</li>').join('')+(errors.length>40?'<li>…و'+fmt(errors.length-40)+' أخرى</li>':'')+'</ul></div>':'')+
   (entries.length?'<div class="klib-table"><table><thead><tr><th>السطر</th><th>السجل</th><th>الحالة</th></tr></thead><tbody>'+entries.slice(0,80).map(e=>'<tr><td>'+esc(e.line)+'</td><td>'+esc(e.label)+(e.shipped?' <small>(من البرنامج)</small>':'')+'</td><td>'+names[e.state]+'</td></tr>').join('')+'</tbody></table></div>':'')+
   (!errors.length&&validated.length?'<div class="klib-actions"><button type="button" class="klib-primary" data-lib-apply>'+studioIcon('check')+' تطبيق '+fmt(validated.length)+'</button></div>':'');
  if(!errors.length&&!validated.length)say('كل السجلات مطابقة لما في المكتبة. لا شيء للتطبيق.');
 }

 const stop=libraries.subscribe(()=>{drawTabs();drawTools();drawList();});
 drawAll();drawTransfer();

 // ---------- clicks ----------
 function download(name,text,mime){
  const url=URL.createObjectURL(new Blob([text],{type:mime})),a=d.createElement('a');a.href=url;a.download=name;box.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),900);
 }
 async function addAll(rows){
  if(!canWrite()){say('تعديل مكتبات المتجر وأصنافه متاح للمتجر والمالك فقط.',true);return;}
  const doc=getDoc(),out=addToCatalog(doc,rows);
  if(!out.ok){say(out.reason,true);return;}
  if(out.unchanged){say('الأصناف موجودة في كتالوج المشروع بالأسعار نفسها.');return;}
  const msg='أُضيف إلى كتالوج المشروع '+fmt(out.count)+(out.count===1?' صنف':' أصناف')+' في إصداره '+fmt(out.revision)+'، بانتظار مراجعة المصنع.';
  const r=apply(out.doc,msg);
  if(r?.ok===false||r?.saved===false&&r?.changed){say(r.reason||'تعذّر حفظ الكتالوج.',true);return;}
  say(msg+(out.skipped.length?' لم يُضف '+fmt(out.skipped.length)+': '+out.skipped[0].reason:''),false,out.skipped.length?'attention':'success');tell?.(msg);
 }
 on(box,'click',async e=>{
  const b=e.target.closest?.('button');if(!b||!box.contains(b))return;
  if(b.matches('[data-lib-add],[data-lib-copy],[data-lib-delete],[data-lib-hide],[data-lib-hide-generic],[data-lib-catalog],[data-lib-catalog-all],[data-lib-apply]')&&!canWrite()){say('هذه المكتبات للعرض فقط ضمن صلاحيتك الحالية.',true);return;}
  const keep=b.matches('[data-lib-delete]')?'delete':b.matches('[data-lib-hide-generic]')?'hide-generic':b.matches('[data-lib-catalog-all]')?'catalog-all':null;
  if(confirm&&confirm!==keep){const was=confirm;confirm=null;if(was!=='delete')drawTools();}
  if(b.dataset.libTab){if(b.dataset.libTab!==library){library=b.dataset.libTab;query='';family='';showHidden=false;limit=pageSize;editing=null;box.dataset.editing='false';confirm=null;say('');drawAll();drawTransfer();}return;}
  if(b.matches('[data-lib-add]')){startEdit(null);return;}
  if(b.dataset.libEdit){startEdit(b.dataset.libEdit);return;}
  if(b.matches('[data-lib-cancel]')){endEdit();return;}
  if(b.matches('[data-lib-more-rows]')){limit+=pageSize;drawList();return;}
  if(b.dataset.libHide){const id=b.dataset.libHide,r=await libraries.setHidden(library,id,b.dataset.to==='hide');say(r.ok?(b.dataset.to==='hide'?'أُخفي السجل. يبقى في الملف ويمكن إظهاره.':'أُظهر السجل.'):r.reason,!r.ok,'success');return;}
  if(b.matches('[data-lib-hide-generic]')){
   if(confirm!=='hide-generic'){confirm='hide-generic';drawTools();say('تُخفى الأمثلة العامة فقط ولا تُحذف. تجد ما أخفيته بعرض المخفي.',false,'attention');return;}
   confirm=null;const ids=libraries.list(library,{source:'generic'}).map(r=>r.id),r=await libraries.setHidden(library,ids,true);say(r.ok?'أُخفي '+fmt(r.count)+' مثالًا عامًا.':r.reason,!r.ok,'success');drawTools();return;
  }
  if(b.dataset.libCatalog){const r=libraries.get(library,b.dataset.libCatalog);if(r)await addAll([r]);return;}
  if(b.matches('[data-lib-catalog-all]')){
   const rows=current().filter(canAddToCatalog);
   if(!rows.length){say('لا أصناف معروضة تصلح للإضافة.',true);return;}
   if(confirm!=='catalog-all'){confirm='catalog-all';drawTools();say('ستُضاف '+fmt(rows.length)+' من الأصناف المعروضة. أسعارها كما في المكتبة، والفارغ منها يبقى بلا سعر.',false,'attention');return;}
   confirm=null;drawTools();await addAll(rows);return;
  }
  if(b.matches('[data-lib-copy]')){const r=await libraries.duplicate(library,editing.id);if(!r.ok){say(r.reason,true);return;}editing={id:r.record.id};drawEditor();scroller().scrollTop=0;say('نُسخ السجل. عدّل النسخة ثم احفظ.');return;}
  if(b.matches('[data-lib-delete]')){
   if(confirm!=='delete'){confirm='delete';b.textContent='تأكيد الحذف';say('الحذف من المكتبة فقط؛ لا يغيّر ما نُسخ إلى مشاريع.',false,'attention');return;}
   confirm=null;const r=await libraries.remove(library,editing.id);if(!r.ok){say(r.reason,true);return;}endEdit();say('حُذف السجل.',false,'success');return;
  }
  if(b.matches('[data-lib-export-csv]')){download('library-'+library+'.csv',toCSV(exportRows(libraries,library)),'text/csv;charset=utf-8');say('جُهز جدول '+def().label+'. يفتح في Excel.',false,'success');return;}
  if(b.matches('[data-lib-export-pack]')){download('kitchen-libraries.json',JSON.stringify(libraries.exportPack(),null,1),'application/json');say('جُهز ملف المكتبات. يحمل ما أضفته وما سجّلته على السجلات الثابتة.',false,'success');return;}
  if(b.matches('[data-lib-read]')){
   resetImport(false);const text=q('[data-lib-paste]').value;q('[data-lib-file]').value='';q('[data-lib-sheets]').innerHTML='';q('[data-lib-mapping]').innerHTML='';q('[data-lib-preview]').innerHTML='';
   try{loadTable(parseWorkshopTable(text));}catch(err){say(err.message,true);}return;
  }
  if(b.matches('[data-lib-preview-run]')&&table){drawPreview();return;}
  if(b.matches('[data-lib-apply]')&&preview){
   const out=await applyImport(libraries,library,preview);if(!out.ok){say(out.reason,true);return;}
   const n=out.count;resetImport();say('تم تطبيق '+fmt(n)+' من السجلات على '+def().label+'.',false,'success');return;
  }
 });
 on(box,'input',e=>{
  if(e.target.matches?.('[data-lib-search]')){query=e.target.value;limit=pageSize;drawList();}
  if(e.target.matches?.('[data-lib-paste]')){ticket++;table=null;q('[data-lib-mapping]').innerHTML='';q('[data-lib-preview]').innerHTML='';}
 });
 on(box,'change',async e=>{
  const t=e.target;
  if(t.matches?.('[data-lib-family]')){family=t.value;limit=pageSize;drawList();return;}
  if(t.matches?.('[data-lib-show-hidden]')){showHidden=t.checked;drawTools();drawList();return;}
  if(t.matches?.('[data-lib-map]')){mapping[Number(t.dataset.libMap)]=t.value;preview=null;q('[data-lib-preview]').innerHTML='';say('تغيّر ربط الأعمدة. أعد المعاينة.',false,'attention');return;}
  if(t.matches?.('[data-lib-sheet]')){try{if(t.value!=='')loadTable(sheets[Number(t.value)]?.rows);}catch(err){say(err.message,true);}return;}
  if(t.matches?.('[data-lib-file]')&&t.files?.[0]){
   const file=t.files[0],serial=++ticket;table=null;preview=null;q('[data-lib-paste]').value='';q('[data-lib-mapping]').innerHTML='';q('[data-lib-preview]').innerHTML='';say('تجري قراءة الملف…',false,'loading');
   try{
    const result=await openWorkshopTables(file);if(serial!==ticket)return;sheets=result.sheets;
    if(!sheets.length)throw Error('الملف فارغ.');
    if(sheets.length===1){loadTable(sheets[0].rows);return;}
    q('[data-lib-sheets]').innerHTML='<label>الورقة<select data-lib-sheet><option value="">اختر ورقة</option>'+sheets.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('')+'</select></label>';say('');
   }catch(err){if(serial===ticket)say(err.message,true);}
   return;
  }
  if(t.matches?.('[data-lib-pack]')&&t.files?.[0]){
   if(!canWrite()){say('استيراد مكتبات الجهاز متاح للمتجر والمالك فقط.',true);return;}
   const file=t.files[0];t.value='';
   if(file.size>2*1024*1024){say('الملف أكبر من ٢ ميغابايت.',true);return;}
   try{
    const pack=JSON.parse(await file.text());if(!canWrite())throw Error('تغيّرت صلاحيتك قبل الاستيراد.');const r=await libraries.importPack(pack);
    say(r.ok?'من الملف: '+fmt(r.added)+' جديد · '+fmt(r.updated)+' تحديث · '+fmt(r.unchanged)+' مطابق.'+(r.errors.length?' تعذّر '+fmt(r.errors.length)+': '+r.errors[0]:''):r.reason,!r.ok,r.errors?.length?'attention':'success');
   }catch{say('تعذّرت قراءة الملف. بقيت المكتبات كما كانت.',true);}
  }
 });
 on(box,'submit',async e=>{
  if(!e.target.matches?.('[data-lib-form]'))return;e.preventDefault();
  if(!canWrite()){say('حفظ مكتبات المتجر متاح للمتجر والمالك فقط.',true);return;}
  const form=new FormData(e.target),record=editing?.id?libraries.get(library,editing.id):null;
  const input=readForm(library,k=>form.has(k)?String(form.get(k)):null,record),r=await libraries.save(library,input);
  const err=q('[data-lib-error]');
  if(!r.ok){if(err)err.textContent=r.reason;say(r.reason,true);return;}
  endEdit();say('حُفظ «'+r.record.label+'».',false,'success');
 });
 // Escape leaves a form that is open and nothing else; with no form it belongs to the workshop around the page.
 on(box,'keydown',e=>{if(e.key==='Escape'&&editing){e.preventDefault();e.stopPropagation();endEdit();}});
 // The workshop asks before leaving a page with something half done: an open form, or a table read but not applied.
 const destroy=()=>{ac.abort();stop();};
 destroy.hasPending=()=>!!editing||!!table;
 destroy.tracksDraft=()=>true;
 return destroy;
}
