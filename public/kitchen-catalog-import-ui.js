import {studioIcon} from './kitchen-tool-icons.js';
import {importColumns,detectCatalogColumns,previewCatalogImport,applyCatalogImport} from './kitchen-catalog-import.js';
import {openWorkshopTables,parseWorkshopTable} from './kitchen-workshop-spreadsheet.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:6}).format(n);
const display=v=>v===null||v===''?'—':typeof v==='number'?fmt(v):v;
const names={added:'جديد',updated:'تحديث',unchanged:'مطابق'};
const template=Object.values(importColumns).map(fields=>fields[0]).join(',');
const templateURL='data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFF'+template+'\r\n');

export function mountCatalogImport(host,{getDoc,apply,tell,onApplied,scoped=null}){
 const ac=new AbortController(),{signal}=ac;
 let table=null,mapping=[],preview=null,sheets=[],pending=false,ticket=0;
 const q=s=>host.querySelector(s);
 host.innerHTML='<div class="fs-import-source"><p>انسخ عناوين الجدول وأصنافه من Excel والصقها هنا، أو افتح الملف. يُطابق الكتالوج الأصناف برمزها. المقاسات بالملليمتر والتسعير بالريال.</p>'+
  '<div class="fs-actions"><label class="fs-import-file">'+studioIcon('upload')+'فتح ملف الأصناف<input type="file" data-ci-file accept=".xlsx,.csv,.tsv,.txt" aria-label="فتح ملف أصناف المصنع"></label>'+
  '<a class="fs-import-template" href="'+templateURL+'" download="factory-catalog.csv">'+studioIcon('download')+'عناوين نموذج CSV</a></div>'+
  '<label>خلايا أصناف المصنع<textarea data-ci-text rows="3" placeholder="انسخ صف العناوين وصفوف الأصناف من Excel"></textarea></label>'+
  '<div class="fs-actions"><button type="button" data-ci-read>'+studioIcon('list')+'قراءة الأصناف</button><button type="button" data-ci-reset hidden>إلغاء الاستيراد</button></div></div>'+
  '<div data-ci-sheets></div><div data-ci-mapping></div><div data-ci-preview></div><p data-ci-status role="status" aria-live="polite"></p>';
 function status(msg){q('[data-ci-status]').textContent=msg;}
 function clearPreview(){preview=null;q('[data-ci-preview]').innerHTML='';}
 function setPending(value){pending=value;q('[data-ci-reset]').hidden=!value;}
 function reset(){
  ticket++;setPending(false);table=null;mapping=[];sheets=[];q('[data-ci-file]').value='';q('[data-ci-text]').value='';
  q('[data-ci-sheets]').innerHTML='';q('[data-ci-mapping]').innerHTML='';clearPreview();status('');
 }
 function load(matrix){
  if(!matrix||matrix.length<2)throw Error('اختر جدولًا فيه عناوين وصف أصناف واحد على الأقل.');
  table=matrix;mapping=detectCatalogColumns(matrix[0]);renderMap();setPending(true);status('');
 }
 function renderMap(){
  clearPreview();
  const select=(title,index)=>'<label>'+esc(title||'عمود '+fmt(index+1))+'<select data-ci-map="'+index+'"><option value="">تجاهل</option>'+
   Object.entries(importColumns).map(([key,fields])=>'<option value="'+key+'"'+(mapping[index]===key?' selected':'')+'>'+esc(fields[0])+'</option>').join('')+'</select></label>';
  const mapped=mapping.filter(Boolean),needsMap=!mapped.includes('sku')||new Set(mapped).size!==mapped.length||mapped.length<2;
  q('[data-ci-mapping]').innerHTML='<details class="fs-import-map"'+(needsMap?' open':'')+'><summary>ربط أعمدة الملف · '+fmt(mapped.length)+' من '+fmt(table[0].length)+'</summary>'+
  '<div class="fs-import-grid">'+table[0].map(select).join('')+'</div></details><p>الخانة الفارغة تُبقي قيمة الصنف الموجود. للخامات الخطية والألواح الجديدة أدخل مقاس الخام وفاقد المنشار. للأسعار أدخل وحدة السعر، مثل عود أو متر أو لوح أو متر مربع أو قطعة.</p>'+
  '<button type="button" data-ci-preview-action>'+studioIcon('search')+'معاينة الأصناف</button>';
 }
 function showPreview(){
  preview=previewCatalogImport(getDoc(),table,mapping,scoped?{catalog:scoped.read(),validate:next=>next}:{});
  const {entries,errors,added,updated,unchanged,next}=preview;
  const diff=entry=>entry.changes.map(c=>esc(c.label)+' '+esc(display(c.before))+' ← '+esc(display(c.after))).join('، ');
  q('[data-ci-preview]').innerHTML='<p><b>'+fmt(added)+' جديد · '+fmt(updated)+' تحديث · '+fmt(unchanged)+' مطابق</b></p>'+
   (errors.length?'<div role="alert"><b>صحّح '+fmt(errors.length)+' من الملاحظات ثم أعد المعاينة.</b><ul>'+errors.map(msg=>'<li>'+esc(msg)+'</li>').join('')+'</ul></div>':'')+
   (entries.length?'<div class="fs-import-table"><table><thead><tr><th>الصنف</th><th>التغيير</th><th>الشراء لكل وحدة خام</th></tr></thead><tbody>'+entries.map(e=>'<tr><td><bdi>'+esc(e.sku)+'</bdi> · '+esc(e.name)+'</td><td>'+names[e.status]+(e.changes.length?'<small>'+diff(e)+'</small>':'')+'</td><td>'+esc(e.priceNote||(e.price===null?'سعر غير محدّد':fmt(e.price)+' ر.س'))+'<small>'+esc(e.kind)+'</small></td></tr>').join('')+'</tbody></table></div>':'')+
   (next?'<p>سيُحفَظ إصدار كتالوج جديد للمشروع بانتظار مراجعة المصنع.</p><button type="button" data-ci-apply>'+studioIcon('check')+'تطبيق '+fmt(added+updated)+' من الأصناف</button>':'');
  status(!errors.length&&!next?'جميع الأصناف مطابقة، لا توجد تغييرات للتطبيق.':'');
 }
 function readPaste(){
  const text=q('[data-ci-text]').value;ticket++;table=null;sheets=[];q('[data-ci-file]').value='';
  q('[data-ci-sheets]').innerHTML='';q('[data-ci-mapping]').innerHTML='';clearPreview();
  try{load(parseWorkshopTable(text));}catch(e){status(e.message);}
 }
 host.addEventListener('input',e=>{
  if(!e.target.matches?.('[data-ci-text]'))return;
  ticket++;table=null;sheets=[];q('[data-ci-sheets]').innerHTML='';q('[data-ci-file]').value='';
  q('[data-ci-mapping]').innerHTML='';clearPreview();setPending(!!e.target.value.trim());status('');
 },{signal});
 host.addEventListener('change',async e=>{
  const el=e.target;
  if(el.matches?.('[data-ci-map]')){
   mapping[Number(el.dataset.ciMap)]=el.value;clearPreview();
   q('.fs-import-map summary').textContent='ربط أعمدة الملف · '+fmt(mapping.filter(Boolean).length)+' من '+fmt(table[0].length);
   status('تغيّر ربط الأعمدة. اعرض المعاينة من جديد.');return;
  }
  if(el.matches?.('[data-ci-sheet]')){
   clearPreview();table=null;q('[data-ci-mapping]').innerHTML='';status('');
   try{if(el.value!=='')load(sheets[Number(el.value)]?.rows);}catch(err){status(err.message);}return;
  }
  if(!el.matches?.('[data-ci-file]')||!el.files?.[0])return;
  const file=el.files[0],serial=++ticket;
  setPending(true);table=null;sheets=[];q('[data-ci-text]').value='';clearPreview();
  q('[data-ci-mapping]').innerHTML='';q('[data-ci-sheets]').innerHTML='';status('تجري قراءة الملف…');
  try{
   const result=await openWorkshopTables(file);if(signal.aborted||serial!==ticket)return;
   sheets=result.sheets;
   if(!sheets.length)throw Error('الملف فارغ.');
   if(sheets.length===1){load(sheets[0].rows);return;}
   q('[data-ci-sheets]').innerHTML='<label>ورقة أصناف المصنع<select data-ci-sheet><option value="">اختر ورقة</option>'+sheets.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('')+'</select></label>';status('');
  }catch(err){if(!signal.aborted&&serial===ticket)status(err.message);}
 },{signal});
 host.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.matches('[data-ci-read]')){readPaste();return;}
  if(b.matches('[data-ci-reset]')){reset();return;}
  if(b.matches('[data-ci-preview-action]')&&table){showPreview();return;}
  if(b.matches('[data-ci-apply]')&&preview){
   if(scoped){
    if(!preview.next||preview.doc!==getDoc()||JSON.stringify(preview.base)!==JSON.stringify(scoped.read())){clearPreview();status('تغيّر السجل منذ المعاينة. أعد معاينة الأصناف.');return;}
    let result;try{result=scoped.write(preview.next);}catch(error){status(error.message||'راجع قيم الأصناف المستوردة.');return;}if(result?.ok===false){status(result.reason||'تعذّر تحديث مسودة الأصناف.');return;}
    reset();status('أضيفت الأصناف إلى المسودة. أرسل التغييرات إلى الخادم للتحقق والحفظ.');onApplied?.();return;
   }
   const out=applyCatalogImport(getDoc(),preview);if(!out.ok){clearPreview();status(out.reason);return;}
   const message='تم استيراد الأصناف إلى إصدار الكتالوج '+fmt(preview.next.revision)+'.';
   const saved=apply(out.doc,message);
   if(saved?.ok===false||saved?.saved===false){clearPreview();status(saved.reason||'تعذّر حفظ إصدار الكتالوج.');return;}
   reset();status(message);tell?.(message);onApplied?.();
  }
 },{signal});
 const destroy=()=>{ticket++;ac.abort();};destroy.hasPending=()=>pending;return destroy;
}
