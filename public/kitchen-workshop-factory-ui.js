import {mountCatalogImport} from './kitchen-catalog-import-ui.js';
import {previewCustomerReport} from './kitchen-report-preview.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {surveyDesignReview} from './kitchen-workshop-state.js';
import {outputStamp,stampColumns} from './kitchen-output-stamp.js';
import {mountUpstandProfiles} from './kitchen-worktop-upstand-ui.js';
import {mountBaseSupport} from './kitchen-base-support-ui.js';
import {mountLightKits} from './kitchen-linear-light-ui.js';
import {mountGeneralDrawerRecipe} from './kitchen-pantry-factory.js';
import {mountCornerRecipes} from './kitchen-corner-carcass-ui.js';
import {mountWallAccessoryEditor} from './kitchen-wall-accessory-ui.js';
import {mountFinishPolicy} from './kitchen-finish-parts-ui.js';
import {mountScribes} from './kitchen-wall-scribe-ui.js';
import {runnerItemForm,runnerFamilyForm,readRunnerSpec} from './kitchen-drawer-fit-ui.js';
import {familyCADKind} from './kitchen-factory-families.js';
import {mountFactoryTrims} from './kitchen-factory-trims-ui.js';
import {mountFamilyDesigner} from './kitchen-factory-families-ui.js';
import {mountMachineBook,shopOperationsPanel} from './kitchen-machining-ui.js';
import {factorySpecialTargets} from './kitchen-workshop-factory-special.js';
import {mountSpecialEditor} from './kitchen-workshop-factory-special-ui.js';
import {getFactoryCatalog,cleanCatalog,buildFactoryQuote,factoryLayoutKey,factoryKinds,factoryAxes,factoryCounts,wallRates} from './kitchen-workshop-factory.js';
import {deviceCatalogKey,readDeviceCatalog,catalogReadiness,readinessText,installDeviceCatalog} from './kitchen-device-catalog.js';
import {encodePortableCatalog,decodePortableCatalog,installPortableCatalog} from './kitchen-factory-template.js';
import {reconcileWorkshopCatalogs,approveWorkshopCatalogRecord,catalogRecordStates,hasWorkshopCatalog} from './kitchen-catalog-records.js';
import {factoryPages} from './kitchen-gateways.js';
import {getProjectAccess} from './kitchen-project-access.js';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const templateKey=deviceCatalogKey,money=n=>n===null?'بانتظار السعر':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' ر.س';
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const clone=o=>JSON.parse(JSON.stringify(o));
const choices=(obj,val)=>Object.entries(obj).map(([k,l])=>'<option value="'+safe(k)+'"'+(k===val?' selected':'')+'>'+safe(l)+'</option>').join('');
const field=(label,input)=>'<label class="kw-field"><span>'+safe(label)+'</span>'+input+'</label>';
const txt=(key,val,extra='')=>'<input name="'+key+'" value="'+safe(val)+'" maxlength="84" '+extra+'>';
const num=(key,val,extra='')=>'<input name="'+key+'" type="number" inputmode="decimal" step="any" value="'+safe(val??'')+'" '+extra+'>';
const sel=(key,obj,v)=>'<select name="'+key+'">'+choices(obj,v)+'</select>';
const action=(k,title,extra='')=>'<button type="button" data-factory-act="'+k+'" '+extra+'>'+safe(title)+'</button>';
const row=(cells,tag='td')=>'<tr>'+cells.map(x=>'<'+tag+'>'+x+'</'+tag+'>').join('')+'</tr>';
const table=(headers,rows)=>'<div class="kw-tbl"><table><thead>'+row(headers,'th')+'</thead><tbody>'+rows.map(x=>row(x)).join('')+'</tbody></table></div>';
const serviceFields={labor:'أجور التصنيع للمشروع (ريال)',installation:'التركيب (ريال)',delivery:'النقل (ريال)',marginPct:'إضافة البيع على التكلفة (%)',taxPct:'الضريبة على البيع (%)'};
const qState=approved=>approved?'وصفات اعتمدها المصنع':'وصفات توضيحية أو قيد المراجعة';
const recordLabels={store:'كتالوج المتجر',factory:'وصفات المصنع',pricing:'شروط التسعير'};
const recordRole=tab=>['items','importItems'].includes(tab)?'store':tab==='sale'?'pricing':'factory';
function recordStatus(w,role){const s=catalogRecordStates(w)?.[role]||{revision:1,approved:false};return recordLabels[role]+' · إصدار '+fmt(s.revision)+' · '+(role==='factory'?qState(s.approved):s.approved?'معتمد':'بانتظار الاعتماد');}
export function ensureFactoryStyles(){
 if(document.querySelector('link[data-workshop-factory-css]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./kitchen-workshop-factory.css',import.meta.url).href;link.dataset.workshopFactoryCss='';document.head.append(link);
}
function download(contents,name,type){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
export function factoryCSV(headers,rows){
 const cell=v=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=@+\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return '\ufeff'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
}
export function factorySaleRows(p,cat){
 const serviceRows=Object.entries(serviceFields).map(([key,label])=>[label,p.services[key]===null?'بانتظار قيمة':String(p.services[key])]);
 return [['الكتالوج',cat.name,'إصدار '+cat.revision],['الحالة',p.fitoutPending?.length?'نطاق القواعد ونعلة الرخام قيد القرار':p.complete?'عرض نطاق مكتمل':'حصر مبدئي',qState(cat.approved)],['الوحدات المشمولة',p.coveredUnits,'من '+p.totalUnits],['مشتريات معلومة',p.subtotal,'ر.س'],['سطح العمل',p.worktopIncluded?(p.worktop??'غير مسعّر'):'خارج العرض','ر.س'],...serviceRows.map((r,i)=>[...r,i<3?'ر.س':'%']),['البيع قبل الضريبة',p.saleBeforeTax??'غير مكتمل','ر.س'],['إجمالي البيع',p.total??'غير مكتمل','ر.س'],...p.extras.map(x=>[x.label,x.cost??(x.readiness==='factory'?'غير مسعّر':'خارج العرض أو قيد المراجعة'),x.quantity+' '+x.unit]),...p.missing.map(v=>['قيمة معلقة',v,'']),...p.issues.map(v=>['مراجعة',v,'']),...(p.fitoutPending||[]).map(v=>['قرار معلّق في نطاق العرض',v,'بانتظار اختيار العميل'])];
}
function fieldNumber(el,key){const v=el.elements.namedItem(key)?.value??'';return v===''?null:Number(v);}
export function mountFactoryStep(host,{getDoc,apply,tell,onAdvance,focus={},page=null,scoped=null}){
 ensureFactoryStyles();const box=document.createElement('section');box.className='kw-factory';host.replaceChildren(box);
 const read=()=>scoped?scoped.read():getFactoryCatalog(getDoc());
 const accessRole=()=>scoped?.role||getProjectAccess(getDoc()).role;
 // Each page edits and approves its own stored record; calculations use a combined view.
 const pageDef=page&&factoryPages[page]?factoryPages[page]:null;
 const sectionGroups=pageDef?pageDef.groups:[['الأصناف والوصفات',['items','importItems','recipes','cornerRecipes']],['تفاصيل التجهيز',['unitBases','trims','lighting','wallKits','special']],['إدارة المصنع',['machines','sale','transfer']]];
 const shown=sectionGroups.flatMap(([,keys])=>keys);
 const sections={items:'الخامات والعتاد',importItems:'استيراد الأصناف',recipes:'وصفات الوحدات',cornerRecipes:'وصفات الركن',unitBases:'قواعد الوحدات ونعلة الرخام',trims:'الكورنيش والقفلة وحشوات التعرّج',lighting:'إنارة تحت الدواليب',wallKits:'ستائر وأغطية السخانات',special:'القطع الخاصة بالمشروع',machines:'الماكينات والتشغيل',sale:'البيع والخدمات',transfer:'قالب المصنع'};
 let tab=shown.includes(focus.tab)?focus.tab:shown[0],itemSearch='';
 const families=read().families;
 const sourceFamily=Object.hasOwn(families,focus.family)?families[focus.family]:null;
 let chosen=focus.sku||'',fam=sourceFamily?focus.family:'storage',editLine=Number.isInteger(focus.line)&&sourceFamily?.recipe[focus.line]?focus.line:0,newItem=false,message='';
 // Hold the import workspace across tab redraws, including file reads in progress.
 let importPane=null,disposeImport=null,awaitingSwitch=null;
 let registerScroll=0;
 const itemForms='form[data-edit="item"],form[data-edit="runnerSpec"]';
 function changedFields(form){
  return [...form.elements].filter(field=>{
   if(!field.name)return false;
   const saved=field.tagName==='SELECT'
    ? ([...field.options].find(o=>o.defaultSelected)||field.options[0])?.value
    : field.defaultValue;
   return field.value!==saved;
  });
 }
 function changedForm(){
  return tab==='items'&&[...box.querySelectorAll(itemForms)].find(form=>changedFields(form).length);
 }
 function switchAfterEdit(action){
  const form=changedForm();
  if(!form){action();return;}
  awaitingSwitch=action;
  const warning=box.querySelector('[data-item-switch-warning]');
  warning.hidden=false;warning.querySelector('[data-factory-act="keepItem"]').focus();
 }
 function snapshotScroll(){registerScroll=box.querySelector('[data-sku-results]')?.scrollTop||0;}
 function focusSelectedItem(){
  const nameField=box.querySelector('.kw-item-form [name="'+(newItem?'sku':'name')+'"]');
  nameField?.focus({preventScroll:true});
 }
 function showFormError(text){
  const error=box.querySelector('[data-item-error]');
  if(error){error.textContent=text;error.focus();}
  tell?.(text);
 }
 function update(mutator){
  const role=accessRole();if(role!=='owner'&&role!==recordRole(tab)){message='تعديل هذا السجل خارج صلاحيتك الحالية.';tell?.(message);return false;}
  if(scoped){try{const next=clone(read());mutator(next);const result=scoped.write(next,recordRole(tab));message=result?.reason||'حُفظت مسودة السجل. أرسل التغييرات إلى الخادم بعد مراجعتها.';tell?.(message);return result?.ok!==false;}catch(error){message=error.message;tell?.(message);return false;}}
  const doc=getDoc(),base=getFactoryCatalog(doc),next=clone(base);
  mutator(next);
  const cmp={...next,revision:base.revision,layoutRevision:base.layoutRevision,approved:base.approved};
  if(JSON.stringify(cmp)===JSON.stringify(base)&&hasWorkshopCatalog(doc.room.workshop))return true;
  next.revision=base.revision+1;next.layoutRevision=factoryLayoutKey(base)===factoryLayoutKey(next)?base.layoutRevision:next.revision;next.approved=false;
  const clean=cleanCatalog(next);
  if(!clean){message='راجع المقاسات والكميات وأسماء الأصناف. لكل وصفة صنف موجود، ومقاس خام موجب للقطاعات والألواح.';tell?.(message);return false;}
  const workshop=reconcileWorkshopCatalogs({...doc.room.workshop,catalog:clean},doc.room.workshop||{catalog:base});
  if(!workshop){message='تعذّر حفظ السجل. راجع بيانات الكتالوج.';return false;}
  const result=apply({...doc,room:{...doc.room,workshop}},'حُفظ '+recordLabels[recordRole(tab)]);
  if(result?.ok===false||result?.saved===false){message=result.reason||'تعذّر حفظ الكتالوج.';return false;}
  message='حُفظ '+recordLabels[recordRole(tab)]+'. '+recordStatus(workshop,recordRole(tab));return true;
 }
 function approve(role){
  const currentRole=accessRole();if(currentRole!=='owner'&&currentRole!==role){message='اعتماد هذا السجل لصاحبه أو لمالك المشروع.';tell?.(message);return false;}
  if(scoped){const result=scoped.approve(role);message=result?.reason||'سُجّل الاعتماد في المسودة. أرسل التغييرات إلى الخادم.';tell?.(message);return result?.ok!==false;}
  const doc=getDoc(),w=doc.room.workshop||{},workshop=approveWorkshopCatalogRecord(hasWorkshopCatalog(w)?w:{...w,catalog:getFactoryCatalog(doc)},role);
  if(!workshop){message='تعذّر اعتماد السجل.';return false;}
  const result=apply({...doc,room:{...doc.room,workshop}},'اعتُمد '+recordLabels[role]);
  if(result?.ok===false||result?.saved===false){message=result.reason||'تعذّر حفظ الاعتماد.';return false;}
  message='اعتُمد '+recordLabels[role]+' لهذا المشروع. تبقى اعتمادات السجلين الآخرين مستقلة.';return true;
 }
 const portable=()=>encodePortableCatalog(hasWorkshopCatalog(getDoc().room.workshop)?getDoc().room.workshop:getFactoryCatalog(getDoc()));
 const sameDevice=template=>!!template&&JSON.stringify(portable())===JSON.stringify(encodePortableCatalog(template));
 // The catalog set up once on this device: every new visit starts from it, with its prices and its approval.
 function deviceBlock(c){
  const template=readDeviceCatalog(),r=catalogReadiness(template),same=sameDevice(template);
  return '<section class="kw-device" data-state="'+r.state+'"><h4>كتالوج هذا الجهاز</h4><p>'+safe(readinessText(r))+'</p>'+(same?'<p class="kw-subtle">هذا المشروع يستخدم كتالوج الجهاز نفسه.</p>':'')+
   '<p class="kw-subtle">تبدأ به كل زيارة جديدة على هذا الجهاز. اعتمد وصفات الإصدار الحالي أدناه، ثم اضغط «حفظ كتالوج الجهاز».</p></section>';
 }
 function deviceApply(c){
  const template=readDeviceCatalog();
  return template?.approved&&!sameDevice(template)?action('applyDevice','تطبيق كتالوج الجهاز على هذا المشروع'):'';
 }
 function render(reveal=false){
  const c=read();if(!c.items.some(i=>i.sku===chosen))chosen=c.items[0]?.sku||'';
  const item=newItem?{sku:'',name:'',kind:'piece',role:'body',color:'',thicknessMm:0,stockLengthMm:0,stockWidthMm:0,kerfMm:0,price:null,stockUnits:null,available:true}:c.items.find(i=>i.sku===chosen);
  if(!c.families[fam])fam='storage';const f=c.families[fam]||{recipe:[]},recipes=f.recipe;if(editLine>recipes.length)editLine=recipes.length;
  const sectionButtons=shown.length<2?'':sectionGroups.map(([group,keys])=>'<div class="kw-nav-group" role="group" aria-label="'+group+'"><strong>'+group+'</strong>'+keys.map(k=>action('tab',sections[k],'data-tab="'+k+'" aria-pressed="'+(k===tab)+'"')).join('')+'</div>').join('');
  const sectionPicker='<select name="factorySection">'+sectionGroups.map(([group,keys])=>'<optgroup label="'+group+'">'+choices(Object.fromEntries(keys.map(k=>[k,sections[k]])),tab)+'</optgroup>').join('')+'</select>';
  const sectionControl=shown.length<2?'':'<label class="kw-catalog-picker kw-field"><span>قسم الكتالوج</span>'+sectionPicker+'</label>';
  const owner=recordRole(tab),w=getDoc().room.workshop||{};
  let html='<header class="kw-catalog-head"><div><h3>'+safe(pageDef?pageDef.title:'كتالوج المصنع')+'</h3><p>'+safe(c.name)+' · '+(scoped?.status?scoped.status(owner):recordStatus(w,owner))+'</p></div>'+(tab==='items'?sectionControl:'')+'</header>'+
    '<div class="kw-catalog-workspace"><nav class="kw-catalog-nav" aria-label="أقسام الكتالوج">'+
    '<div class="kw-tabs">'+sectionButtons+'</div>'+(tab==='items'?'':sectionControl)+'</nav>'+
    '<div class="kw-catalog-edit">'+(tab==='items'?'':'<h4>'+safe(sections[tab])+'</h4>');
  if(tab==='items'){
   html+='<div class="kw-material-desk"><section class="kw-register" aria-label="أصناف الكتالوج">'+
    '<div class="kw-register-head"><h4>الخامات والعتاد</h4>'+action('newItem','صنف جديد')+'</div>'+
    '<label class="kw-register-search">'+studioIcon('search')+'<input type="search" data-find-sku value="'+safe(itemSearch)+'" aria-label="بحث في الأصناف" placeholder="الاسم أو الرمز أو اللون" autocomplete="off"></label>'+
    '<div class="kw-register-columns"><span data-sku-count role="status"></span><span>سعر الشراء</span></div>'+
    '<div data-sku-results></div>'+action('tab','استيراد أصناف','data-tab="importItems"')+'</section>'+
    '<section class="kw-material-detail" aria-label="بطاقة الصنف">'+
    '<div data-item-switch-warning class="kw-draft-warning" hidden><p role="status">لديك تعديلات غير محفوظة على هذا الصنف.</p>'+
      action('keepItem','متابعة التعديل')+action('discardItem','تجاهل التعديلات وانتقل')+'</div>'+
    '<form data-edit="item" class="kw-item-form"><header class="kw-material-head"><h4>'+safe(newItem?'صنف جديد':item.name)+'</h4>'+
      '<button type="submit">'+studioIcon('save')+'حفظ الصنف</button></header>'+
    '<p class="kw-item-error" data-item-error role="status" tabindex="-1"></p><div class="kw-grid">'+
    field('رمز الصنف',txt('sku',item.sku,'required dir="ltr" '+(!newItem?'readonly':'')))+
    field('اسم الصنف',txt('name',item.name,'required'))+
    field('نوع الخام',sel('kind',factoryKinds,item.kind))+
    field('سعر وحدة الشراء (ريال)',num('price',item.price,'min="0" placeholder="غير مسعّر"'))+'</div><p class="kw-field-note">السعر للقضيب أو اللوح الكامل أو القطعة. اتركه فارغًا حتى يرد عرض المورد.</p>'+
    '<details class="kw-item-group"><summary>'+studioIcon('swatches')+'الخامة والتشطيب</summary><div class="kw-grid">'+
    field('استخدام المظهر',sel('role',{body:'جسم أو ملحق',front:'لوح واجهة يمكن اختياره'},item.role))+
    field('اللون أو التشطيب',txt('color',item.color))+
    field('رمز لون المعاينة إن توفر (مثال #ffffff)',txt('colorHex',item.colorHex||'','dir="ltr"'))+
    field('السمك (مم)',num('thicknessMm',item.thicknessMm,'min="0" required'))+
    field('وظيفة قطعة العتاد',sel('hardwareRole',{other:'عام',runner:'سكة درج ذات حمولة معلومة'},item.hardwareRole||'other'))+'</div></details>'+
    '<details class="kw-item-group"><summary>'+studioIcon('ruler')+'مقاسات الخام والقص</summary><div class="kw-grid">'+
    field('طول شراء القضيب أو اللوح (مم)',num('stockLengthMm',item.stockLengthMm,'min="0" required'))+
    field('عرض شراء اللوح (مم)',num('stockWidthMm',item.stockWidthMm,'min="0" required'))+
    field('عرض قص المنشار (مم)',num('kerfMm',item.kerfMm,'min="0" required'))+
    field('عرض مقطع القضيب (مم، للتشغيل)',num('sectionWidthMm',item.sectionWidthMm,'min="0.001"'))+
    field('سماكة وجه التيوب محل الثقب (مم)',num('gaugeMm',item.gaugeMm,'min="0.001"'))+
    field('عرض أخدود القطاع (مم)',num('grooveWidthMm',item.grooveWidthMm,'min="0.001"'))+
    field('عمق أخدود القطاع (مم)',num('grooveDepthMm',item.grooveDepthMm,'min="0"'))+
    field('كتلة متر اللوح المربع (كجم/م²)',num('massKgM2',item.massKgM2,'min="0.00001"'))+'</div></details>'+
    '<details class="kw-item-group"><summary>'+studioIcon('box')+'المورد والمخزون والبواقي</summary><div class="kw-grid">'+
    field('مرجع مواصفة المورد',txt('specRef',item.specRef||''))+
    field('مدة توريد هذا الخام بالأيام',num('leadDays',item.leadDays,'min="0" max="365" step="1"'))+
    field('وحدات خام كاملة متوفرة في المخزون',num('stockUnits',item.stockUnits,'min="0" placeholder="غير محسوم"'))+
    field('إمكانية التوريد',sel('available',{yes:'يمكن توريده',no:'موقوف أو غير متاح'},item.available?'yes':'no'))+'</div>'+
    field('بواقي هذا الصنف حسب اتجاه الخام (رقم الباقي | طول مم | عرض اللوح مم أو 0 للقضيب | عدد)','<textarea name="offcutList" rows="3" placeholder="B-01 | 1000 | 0 | 1">'+safe((item.offcuts||[]).map(v=>[v.ref,v.lengthMm,v.widthMm,v.count].join(' | ')).join('\n'))+'</textarea>')+'</details></form>';
   if(!newItem)html+=runnerItemForm(item);
   html+='</section></div>';
  }else if(tab==='importItems'){
   html+='<div data-catalog-import></div>';
  }else if(tab==='recipes'){
   html+=field('عائلة الوحدة',sel('pickFam',Object.fromEntries(Object.entries(c.families).map(([key,x])=>[key,x.label+' · '+key])),fam))+'<form data-edit="family"><div class="kw-grid">'+field('أقل عرض (مم)',num('minMm',f.minMm,'min="1" required'))+field('أكبر عرض (مم)',num('maxMm',f.maxMm,'min="1" required'))+field('خطوة المقاس من الحد الأدنى (مم)',num('stepMm',f.stepMm,'min="1" required'))+'</div><button>حفظ حدود التعبئة</button></form>';
   if(fam==='dishwasher')html+='<p>وصفة فارغة تعني أن الغسالة يوردها العميل ويُحجز موضعها فقط.</p>';
   const l=recipes[editLine]||{sku:c.items[0].sku,label:'',count:1,axis:'width',offsetMm:0,axis2:'depth',offset2Mm:0,role:'body'};
   html+=field('عملية من الوصفة',sel('pickLine',Object.fromEntries([...recipes.map((v,i)=>[i,(i+1)+' · '+v.label+' · '+v.sku]),[recipes.length,'+ عملية جديدة']]),String(editLine)))+'<p>مقاس القطعة هو بُعد الوحدة المحدد مضافًا إليه الفرق. استخدم فرقًا سالبًا لخصم الوصلة، و«مقاس ثابت» لقيمة مستقلة.</p><form data-edit="recipe"><div class="kw-grid">'+field('اسم العملية أو القطعة',txt('label',l.label,'required'))+field('الصنف',sel('sku',Object.fromEntries(c.items.map(i=>[i.sku,i.name+' · '+i.sku])),l.sku))+field('العدد لكل وحدة',num('count',l.count,'min="1" max="100" required'))+field('يحسب العدد',sel('countMode',factoryCounts,l.countMode??'fixed'))+field('أساس الطول',sel('axis',factoryAxes,l.axis))+field('فرق الطول (مم)',num('offsetMm',l.offsetMm,'required'))+field('أساس عرض اللوح',sel('axis2',factoryAxes,l.axis2))+field('فرق عرض اللوح (مم)',num('offset2Mm',l.offset2Mm,'required'))+((f.base||fam)==='rice'?field('تنفيذ العملية عند',sel('when',{all:'كل الخيارات',bags:'التخزين بالأكياس',bin:'تركيب حاوية'},l.when??'all')):'')+field('اتباع اختيار لوح الواجهة',sel('role',{body:'استخدام الصنف المحدد',front:'استخدام واجهة العميل'},l.role))+'</div><div class="kw-actions"><button>حفظ العملية</button>'+(editLine<recipes.length?action('removeLine','حذف هذه العملية'):'')+'</div></form>';
   html+='<div data-family-designer></div><div data-general-drawer-recipe></div><div data-part-finish-policy></div>';if(familyCADKind(f,f.base||fam)==='drawers')html+=runnerFamilyForm(f,c.items);
  }else if(tab==='lighting'){html+='<div data-light-kit-editor></div>';
  }else if(tab==='wallKits'){html+='<div data-wall-kit-editor></div>';
  }else if(tab==='cornerRecipes'){html+='<div data-corner-recipe-editor></div>';
  }else if(tab==='trims'){html+='<div data-trim-editor></div><div data-scribe-editor></div>';
  }else if(tab==='unitBases'){html+='<div data-unit-base-editor></div><div data-strip-profile-editor></div>';
  }else if(tab==='machines'){html+='<div data-machine-editor></div>';
  }else if(tab==='special'){
   html+='<div data-special-editor></div>';
  }else if(tab==='sale'){
   html+='<p>تعامل القيم الفارغة كبنود غير محسومة. أدخل صفرًا فقط إذا كان البند بلا تكلفة أو لا ينطبق على هذا العرض.</p><form data-edit="sale"><div class="kw-grid">'+Object.entries(serviceFields).map(([k,v])=>field(v,num(k,c.terms[k],'min="0" placeholder="غير محسوم"'))).join('')+Object.entries(wallRates).map(([k,v])=>field(v+' (ريال)',num('extra-'+k,c.wallRates[k],'min="0" placeholder="غير مسعّر"'))).join('')+field('خامة سطح العمل',sel('worktop',{separate:'عرض منفصل خارج هذا السعر',include:'أدرج تقدير السطح من قيم المشروع'},c.terms.worktop))+'</div><button>حفظ شروط العرض</button></form>';
  }else{
   html+='<form data-edit="name">'+field('اسم كتالوج المشروع',txt('name',c.name,'required'))+'<button>حفظ الاسم</button></form>'+deviceBlock(c)+'<div class="kw-actions">'+action('saveTemplate','حفظ كتالوج الجهاز')+deviceApply(c)+action('loadTemplate','اختيار قالب الجهاز')+action('export','تنزيل الكتالوج')+'<label class="kw-file">قراءة ملف كتالوج<input type="file" accept=".json,application/json" name="catalogFile"></label></div>';
   if(importCandidate)html+='<div class="kw-hint"><p>جاهز للتطبيق على هذا المشروع: '+safe(importCandidate.catalog.name)+' · '+fmt(importCandidate.catalog.items.length)+' صنفًا. سيبقى إصدار المشروع السابق في التراجع.</p>'+action('applyImport','تطبيق هذا القالب')+'</div>';
   html+='<ul>'+Object.keys(recordLabels).map(role=>'<li>'+recordStatus(w,role)+'</li>').join('')+'</ul>'+action('team','كتالوجات الفريق ووصفاتها');
  }
  const attest={store:'راجعت مواصفات الأصناف وأسعار شرائها وتوفرها في هذا الإصدار.',factory:'تحققت من مقاسات الورشة والمواد والقص والوصفات الفعلية لهذا الإصدار.',pricing:'راجعت أجور الخدمات وهوامش البيع والضريبة ونطاق التسعير لهذا الإصدار.'};
  if(owner!=='factory'||tab==='transfer')html+='<form data-edit="'+(owner==='factory'?'approve':'approveRecord')+'" data-record="'+owner+'"><label><input type="checkbox" required> '+attest[owner]+'</label><button type="submit">اعتماد '+recordLabels[owner]+'</button></form>';
  html+='<p class="kw-status" role="status">'+safe(message)+'</p><div class="kw-actions">'+action('next',pageDef?.back?.label||'العودة إلى تعبئة الصف')+'</div></div></div>';box.innerHTML=html;
  const accessRole=getProjectAccess(getDoc()).role;
  if(tab==='transfer'&&accessRole!=='owner'){
   for(const node of box.querySelectorAll('form[data-edit="name"],[data-factory-act="applyDevice"],[data-factory-act="loadTemplate"],[data-factory-act="applyImport"],.kw-file'))node.hidden=true;
   if(accessRole!=='factory')box.querySelector('[data-factory-act="saveTemplate"]').hidden=true;
  }
  if(tab==='items'){
   showMatches();
   const list=box.querySelector('[data-sku-results]');list.scrollTop=registerScroll;
   if(reveal===true){
    const button=list.querySelector('[aria-pressed="true"]');
    if(button?.getBoundingClientRect){
     const selection=button.getBoundingClientRect(),bounds=list.getBoundingClientRect();
     list.scrollTop+=Math.min(0,selection.top-bounds.top)+Math.max(0,selection.bottom-bounds.bottom);
    }
   }
  }
  if(tab==='importItems'){
   if(!importPane){
    importPane=document.createElement('div');
    importPane.className='kw-catalog-import';
    disposeImport=mountCatalogImport(importPane,{getDoc,apply,tell,onApplied:render,scoped:scoped?{read,write:next=>scoped.write(next,'store')}:null});
   }
   box.querySelector('[data-catalog-import]').append(importPane);
  }
  if(tab==='recipes')mountFinishPolicy(box.querySelector('[data-part-finish-policy]'),{catalog:c,family:fam,save:update,refresh:render,notice:s=>tell?.(s)});
  if(tab==='cornerRecipes')mountCornerRecipes(box.querySelector('[data-corner-recipe-editor]'),{catalog:c,save:update,refresh:render,notice:tell});
  if(tab==='recipes')mountGeneralDrawerRecipe(box.querySelector('[data-general-drawer-recipe]'),{save:update,selectFamily:id=>{fam=id;editLine=0;render();},notice:s=>tell?.(s)});
  if(tab==='recipes')mountFamilyDesigner(box.querySelector('[data-family-designer]'),{catalog:c,family:fam,editLine,save:update,selectFamily:id=>{fam=id;editLine=0;render()},refresh:render,notice:s=>{message=s;box.querySelector('.kw-status').textContent=s;tell?.(s);}});
  if(tab==='lighting')mountLightKits(box.querySelector('[data-light-kit-editor]'),{read,update});
  if(tab==='wallKits')mountWallAccessoryEditor(box.querySelector('[data-wall-kit-editor]'),{read,update,notice:tell});
  if(tab==='trims')mountFactoryTrims(box.querySelector('[data-trim-editor]'),{getDoc,apply,read,update,message:s=>{message=s;tell?.(s);}});
  if(tab==='trims')mountScribes(box.querySelector('[data-scribe-editor]'),{getDoc,apply,read,update,download,focus});
  if(tab==='unitBases'){
   mountBaseSupport(box.querySelector('[data-unit-base-editor]'),{getDoc,apply,tell,mode:'factory',read,update});
   mountUpstandProfiles(box.querySelector('[data-strip-profile-editor]'),{read,update,notice:tell});
  }
  if(tab==='machines')mountMachineBook(box.querySelector('[data-machine-editor]'),{read,update,message:s=>{message=s;tell?.(s);}});
  if(tab==='special')mountSpecialEditor(box.querySelector('[data-special-editor]'),{doc:getDoc(),catalog:c,targetId:focus.targetId,save:(id,sheet)=>update(v=>{v.specials={...v.specials,[id]:sheet};})});
 }
 function matchesItem(item,term){
  return [item.sku,item.name,item.color].some(v=>String(v??'').toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()));
 }
 function showMatches(){
  const list=box.querySelector('[data-sku-results]'),term=itemSearch.trim().toLocaleLowerCase();
  const items=read().items;
  const matches=items.filter(i=>matchesItem(i,term));
  box.querySelector('[data-sku-count]').textContent=term?'نتائج البحث · '+fmt(matches.length):'الأصناف · '+fmt(matches.length);
  const currentRow=matches.find(i=>!newItem&&i.sku===chosen)||matches[0];
  list.innerHTML=matches.map(i=>{
   const color=/^#[a-f0-9]{6}$/i.test(i.colorHex)?i.colorHex:null;
   const symbol={bar:'ruler',panel:'layers',piece:'box'}[i.kind];
   const specification=[i.color,i.thicknessMm?fmt(i.thicknessMm)+' مم':''].filter(Boolean).join(' · ');
   const mark=color?'<i class="kw-stock-swatch" style="background:'+color+'"></i>':studioIcon(symbol);
   return '<button type="button" class="kw-stock-row" data-factory-act="pickResult" tabindex="'+(i===currentRow?0:-1)+'" data-sku="'+safe(i.sku)+'" aria-pressed="'+(!newItem&&i.sku===chosen)+'">'+
    '<span class="kw-stock-mark" aria-hidden="true">'+mark+'</span><span class="kw-stock-label"><b>'+safe(i.name)+'</b><small><bdi>'+safe(i.sku)+'</bdi>'+(specification?' · '+safe(specification):'')+'</small></span>'+
    '<span class="kw-stock-price">'+(i.price===null?'غير مسعّر':safe(money(i.price)))+'</span></button>';
  }).join('')||'<p role="status">لا توجد أصناف مطابقة. جرّب رمز الصنف أو جزءًا من اسمه.</p>';
 }
 box.oninput=e=>{
  if(e.target.matches?.('[data-find-sku]')){itemSearch=e.target.value;registerScroll=0;showMatches();box.querySelector('[data-sku-results]').scrollTop=0;}
 };
 box.onkeydown=e=>{
  const target=e.target.closest?.('.kw-stock-row');
  if(!target||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  const rows=[...box.querySelectorAll('.kw-stock-row')],index=rows.indexOf(target);
  const next=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1)));
  e.preventDefault();
  for(const row of rows)row.tabIndex=-1;
  rows[next].tabIndex=0;rows[next].focus();
 };
 function chooseSection(name,focusSelector){
  if(!shown.includes(name))return;
  if(tab==='items')snapshotScroll();
  tab=name;message='';awaitingSwitch=null;render();
  box.closest('.ws-content')?.scrollTo({top:0});
  box.querySelector(focusSelector)?.focus({preventScroll:true});
 }
 let importCandidate=null;
 box.onchange=async e=>{
  const t=e.target,k=t.name;
  if(k==='factorySection'){
   const target=t.value;t.value=tab;
   switchAfterEdit(()=>chooseSection(target,'[name="factorySection"]'));return;
  }
  if(k==='pickFam'){fam=t.value;editLine=0;}
  else if(k==='pickLine')editLine=Number(t.value);
  else if(k==='catalogFile'){
   const file=t.files?.[0];if(!file)return;
   try{if(file.size>300000)throw Error();const c=decodePortableCatalog(JSON.parse(await file.text()));if(!c)throw Error();importCandidate=c;message='تم فحص الملف. اضغط تطبيق لنقله إلى المشروع.';}catch{message='ملف كتالوج غير صالح.';}
  }else return;
  render();
 };
 box.onsubmit=e=>{
  e.preventDefault();const form=e.target,data=new FormData(form),v=Object.fromEntries(data),kind=form.dataset.edit;
  if(kind==='approve'||kind==='approveRecord'){
   const pending=changedForm()||(tab==='sale'&&changedFields(box.querySelector('form[data-edit="sale"]')).length)||disposeImport?.hasPending();
   if(pending){message='احفظ التعديلات أو طبّق الاستيراد أو تجاهله قبل اعتماد السجل.';box.querySelector('.kw-status').textContent=message;tell?.(message);return;}
  }
  const created=kind==='item'&&newItem;
  const sibling=tab==='items'&&[...box.querySelectorAll(itemForms)].find(other=>other!==form);
  const keep=sibling?changedFields(sibling).map(f=>[f.name,f.value]):[];
  if(kind==='item'){
   if(newItem&&read().items.some(i=>i.sku===v.sku)){showFormError('هذا الرمز موجود. اختر رمزًا فريدًا لكل لون أو سماكة.');form.elements.namedItem('sku').focus();return;}
   for(const n of ['thicknessMm','stockLengthMm','stockWidthMm','kerfMm','price','stockUnits','sectionWidthMm','gaugeMm','grooveDepthMm','grooveWidthMm','massKgM2','leadDays'])v[n]=fieldNumber(form,n);v.available=v.available==='yes';
   const offcutText=String(v.offcutList||'').trim();delete v.offcutList;
   v.offcuts=offcutText?offcutText.split(/\r?\n/).map(line=>{const [ref,len,w,count]=line.split('|').map(x=>x.trim());return {ref,lengthMm:Number(len),widthMm:Number(w),count:Number(count)};}):[];
   if(!update(c=>{const index=c.items.findIndex(i=>i.sku===v.sku);if(index<0)c.items.push(v);else c.items[index]={...(c.items[index].runnerSpec?{runnerSpec:c.items[index].runnerSpec}:{}),...v};})){showFormError(message);return;}
   snapshotScroll();newItem=false;chosen=v.sku;awaitingSwitch=null;
   if(!matchesItem(v,itemSearch))itemSearch='';
  }else if(kind==='runnerSpec'){
   if(!update(c=>{c.items.find(i=>i.sku===chosen).runnerSpec=readRunnerSpec(data);})){showFormError(message);return;}
   snapshotScroll();awaitingSwitch=null;
  }
  else if(kind==='drawerRunners')update(c=>{const a=v.ranked.trim().split(/\s+/).filter(Boolean);if(a.length)c.families[fam].drawerRunners=a;else delete c.families[fam].drawerRunners;});
  else if(kind==='family')update(c=>Object.assign(c.families[fam],Object.fromEntries(['minMm','maxMm','stepMm'].map(k=>[k,fieldNumber(form,k)]))));
  else if(kind==='recipe'){for(const k of ['offsetMm','offset2Mm','count'])v[k]=fieldNumber(form,k);update(c=>{c.families[fam].recipe[editLine]={...c.families[fam].recipe[editLine],...v};});}
  else if(kind==='sale')update(c=>{c.terms.worktop=v.worktop;for(const k of Object.keys(serviceFields))c.terms[k]=fieldNumber(form,k);for(const k of Object.keys(wallRates))c.wallRates[k]=fieldNumber(form,'extra-'+k);});
  else if(kind==='name')update(c=>{c.name=v.name;});
  else if(kind==='approve'||kind==='approveRecord')approve(form.dataset.record||'factory');
  render(created);
  if(keep.length){
   const other=box.querySelector('form[data-edit="'+sibling.dataset.edit+'"]');
   if(other){for(const [name,value] of keep)other.elements.namedItem(name).value=value;}
  }
  if(tab==='items')box.querySelector('.kw-material-head button')?.focus({preventScroll:true});
 };
 box.onclick=e=>{
  const b=e.target.closest('[data-factory-act]');if(!b)return;
  if(scoped&&['saveTemplate','applyDevice','loadTemplate','applyImport','export'].includes(b.dataset.factoryAct)){tell?.('تبادل البيانات هنا يقتصر على سجل دورك من بوابة المشاركة.');return;}
  const accessRole=getProjectAccess(getDoc()).role;
  if((['applyDevice','loadTemplate','applyImport'].includes(b.dataset.factoryAct)&&accessRole!=='owner')||(b.dataset.factoryAct==='saveTemplate'&&!['owner','factory'].includes(accessRole))){message='تطبيق القالب الكامل وإدارة سجلاته الأخرى متاحان للمالك.';tell?.(message);return;}
  switch(b.dataset.factoryAct){
   case 'tab':if(tab!==b.dataset.tab)switchAfterEdit(()=>chooseSection(b.dataset.tab,'[data-tab="'+b.dataset.tab+'"]'));return;
   case 'pickResult':
    if(!newItem&&chosen===b.dataset.sku)return;
    switchAfterEdit(()=>{
     snapshotScroll();chosen=b.dataset.sku;newItem=false;message='';render();
     box.querySelector('.kw-stock-row[aria-pressed="true"]')?.focus({preventScroll:true});
    });return;
   case 'newItem':
    if(newItem){focusSelectedItem();return;}
    switchAfterEdit(()=>{snapshotScroll();newItem=true;message='';render();focusSelectedItem();});return;
   case 'keepItem':
    awaitingSwitch=null;box.querySelector('[data-item-switch-warning]').hidden=true;
    {const form=changedForm();if(form)changedFields(form)[0]?.focus();}
    return;
   case 'discardItem':{
    const next=awaitingSwitch;awaitingSwitch=null;next?.();return;
   }
   case 'removeLine':update(c=>{c.families[fam].recipe.splice(editLine,1);});break;
   case 'saveTemplate':try{const cat=portable(),r=catalogReadiness(cat);if(!cat)throw Error();localStorage.setItem(templateKey,JSON.stringify(cat));
    message=r.state==='draft'?'حُفظ القالب لكنه غير معتمد؛ لن تبدأ به الزيارات الجديدة حتى تعتمد وصفاته ثم تحفظه من جديد.':'حُفظ كتالوج الجهاز. '+readinessText(r);}catch{message='لا تتوفر مساحة لحفظ القالب.';}break;
   case 'applyDevice':{
    const template=readDeviceCatalog(),next=template&&installDeviceCatalog(getDoc(),template);
    if(!next){message='تعذّر تطبيق كتالوج الجهاز على هذا المشروع.';break;}
    const result=apply(next,'طُبّق كتالوج الجهاز على المشروع، إصدار '+getFactoryCatalog(next).revision);
    message=result?.ok===false||result?.saved===false?(result.reason||'تعذّر حفظ الكتالوج.'):'طُبّق كتالوج الجهاز على هذا المشروع.'+(getFactoryCatalog(next).approved?'':' يحمل المشروع أوراق قص خاصة، فاعتمد وصفات هذا الإصدار من جديد.');break;
   }
   case 'loadTemplate':try{importCandidate=decodePortableCatalog(JSON.parse(localStorage.getItem(templateKey)));message=importCandidate?'راجع القالب أدناه ثم طبّقه.':'لا يوجد قالب صالح محفوظ على الجهاز.';}catch{message='تعذرت قراءة القالب.';}break;
   case 'applyImport':{
    const next=importCandidate&&installPortableCatalog(getDoc(),importCandidate);
    if(!next){message='تعذّر تطبيق القالب مع الحفاظ على قطع المشروع الخاصة.';break;}
    const result=apply(next,'طُبّق القالب مع اعتمادات سجلاته المستقلة.');
    if(result?.ok===false||result?.saved===false)message=result.reason||'تعذّر حفظ القالب.';
    else{importCandidate=null;message='طُبّق القالب مع الحفاظ على القطع الخاصة بالمشروع.';}break;
   }
   case 'export':download(JSON.stringify(portable(),null,2),'workshop-catalog.json','application/json');return;
   case 'next':onAdvance?.(pageDef?.back?.step||'row');return;
   case 'team':onAdvance?.('team');return;
  }render();
 };render(!!focus.sku);
 const fieldKey=tab==='sale'&&(Object.hasOwn(serviceFields,focus.field)||focus.field==='worktop')?focus.field:null;
 if(fieldKey)box.querySelector('[name="'+fieldKey+'"]')?.focus({preventScroll:true});
 const dispose=()=>{disposeImport?.();box.remove();};
 dispose.tracksDraft=target=>tab==='items'&&!!target.closest?.(itemForms);
 dispose.hasPending=()=>!!changedForm()||disposeImport?.hasPending()||false;
 return dispose;
}
export function mountQuoteStep(host,{getDoc,onAdvance,tell,isCurrent=()=>true,initialPane='customer'}){
 ensureFactoryStyles();const box=document.createElement('section');box.className='kw-factory';host.replaceChildren(box);
 const doc=getDoc(),result=buildFactoryQuote(doc),cat=getFactoryCatalog(doc);
 const p=result,review=surveyDesignReview(doc);
 const partHeaders=['الوحدة','الصف','الصنف','القطعة','الطول مم','العرض مم','العدد','العملية','الرسم المشغلي','عائلة المصنع','الطول على مرجع الوصفة مم','مرجع الحافة','ميل البداية درجة','ميل النهاية درجة','مرجع الوصلة','قاعدة العتاد','القيمة التي اختارت العتاد','بديل معتمد للصنف','مثبت من العميل','موضع القطعة على الجدار مم','محيط الحشوة النهائي X/Y مم'];
 const buyHeaders=['الصنف','الوصف','وحدات خام لازمة','من الرصيد','للشراء بعد الرصيد','صافي','إجمالي الخام','فاقد المنشار','وحدة الصافي','سعر الوحدة ر.س','قيمة خام المصنّع ر.س','الإنفاق الإضافي ر.س','صافي المستخدم من البواقي'];
 const parts=p.pieces.map(v=>[v.unitId,v.runId,v.sku,v.label,v.a??'',v.b??'',v.count,v.operation||'',v.drawing||'',v.recipeId||v.family||'',v.datumLengthMm??'',v.ends?.datum||'',v.ends?.startDeg??'',v.ends?.endDeg??'',v.ends?.reference||'',v.hardwareRule?.reference||'',v.selectionValue??'',v.replacedSku||'',v.pinnedHardware?'نعم':'',v.stationMm??'',v.scribe?JSON.stringify(v.scribe.points):'']);
 const bought=p.purchases.map(v=>[v.sku,v.name,v.qty,v.fromStock??'رصيد غير محسوم',v.orderQty??'رصيد غير محسوم',v.net,v.purchased,v.loss,v.unit,v.price??'غير مسعّر',v.cost??'غير مسعّر',v.orderCost??'غير محسوم',v.offcutUse??0]);
 const display=r=>r.map(v=>typeof v==='number'?fmt(v):safe(v));
 // The table contains calculated outputs. Each action opens the owning object
 // in the same project revision; exports continue to use only the raw values.
 const links=[],bySku=new Map(cat.items.map(item=>[item.sku,item])),units=new Map(doc.kitchen.units.map(u=>[u.id,u])),runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const special=new Map(factorySpecialTargets(doc).map(t=>[t.id,t]));
 function source(caption,step,focus,title){
  if(!onAdvance||!step)return safe(caption);
  const key=links.push({step,focus})-1;
  return '<button type="button" class="kq-source" data-quote-source="'+key+'" aria-label="'+safe(title)+'" title="'+safe(title)+'">'+safe(caption)+'</button>';
 }
 function material(sku,caption=sku){
  return source(caption,bySku.has(sku)?'factory':null,{tab:'items',sku},'فتح صنف المصنع '+sku);
 }
 function extraDestination(item){
  if(!item.wall)return null;
  if(['upstand','windowSill'].includes(item.kind))return {step:'assembly',focus:{section:'stone',wall:item.wall,...(item.featureId?{windowId:item.featureId}:{})}};
  const op={cornice:'cornice/enabled',filler:'fillerBy'};
  return {step:'wallOptions',focus:{wall:item.wall,...(item.featureId?{featureId:item.featureId}:{}),...(op[item.kind]?{op:op[item.kind]}:{})}};
 }
 function pieceSource(v){
  if(v.family==='baseApron'||v.family==='baseSupport')return {step:'assembly',focus:{section:'base',runId:v.runId,unitId:v.unitId}};
  if(v.family==='upstand')return extraDestination({kind:v.family,wall:v.runId});
  if(v.family==='windowSill')return extraDestination({kind:v.family,wall:v.runId,featureId:doc.kitchen.features.find(f=>f.wall===v.runId&&f.kind==='window'&&v.unitId.startsWith('sill:'+f.id+':'))?.id});
  const sheet=special.get(v.unitId)||special.get(v.family+':'+v.unitId);
  if(sheet?.kind==='corner'){
   const joint=Object.keys(doc.room.workshop?.corners||{}).find(j=>['base','upper','tall'].some(t=>'corner:'+j+':'+t===v.unitId));
   if(joint)return {step:'corner',focus:{joint}};
  }
  if(sheet?.item)return extraDestination(sheet.item);
  if(sheet&&cat.specials?.[sheet.id])return {step:'factory',focus:{tab:'special',targetId:sheet.id}};
  const family=v.recipeId||v.family,recipe=cat.families[family]?.recipe;
  if(recipe){
   const matching=recipe.flatMap((line,i)=>line.label===v.label?[i]:[]);
   const exact=matching.length===1?matching:matching.filter(i=>[v.sku,v.replacedSku].includes(recipe[i].sku));
   if(exact.length===1)return {step:'factory',focus:{tab:'recipes',family,line:exact[0]}};
  }
  if(units.has(v.unitId))return {step:'placement',focus:{unitId:v.unitId}};
  if(bySku.has(v.sku))return {step:'factory',focus:{tab:'items',sku:v.sku}};
  return null;
 }
 function cutCells(raw,i){
  const cells=display(raw),v=p.pieces[i],target=pieceSource(v);
  if(units.has(v.unitId))cells[0]=source(v.unitId,'placement',{unitId:v.unitId},'تحديد الوحدة '+v.unitId+' في الرسم');
  if(runs.has(v.runId))cells[1]=source(v.runId,'row',{runId:v.runId},'فتح الصف '+v.runId);
  cells[2]=material(v.sku);
  if(target)cells[3]=source(v.label,target.step,target.focus,'مراجعة مصدر القطعة '+v.label+' · '+v.unitId);
  return cells;
 }
 const serviceRows=Object.entries(serviceFields).map(([key,label])=>[label,p.services[key]===null?'بانتظار قيمة':String(p.services[key])]);
 const sumLabel=result.fitoutPending?.length?'قيمة البنود المحسوبة حتى الآن':result.complete?'إجمالي عرض النطاق المحدد':'الإجمالي بعد إكمال البيانات';
 const scope=p.worktopIncluded?'خامة السطح ضمن العرض حسب أسعار واحتياط قيم المشروع.':'خامة السطح خارج العرض وتُسعّر منفصلة.';
 const services=table(['البند','القيمة'],[...serviceRows,['خامة السطح',p.worktopIncluded?money(p.worktop):'خارج العرض'],['تكلفة المشتريات الجديدة بعد الرصيد',money(p.additionalPurchaseCost)],['إجمالي البيع قبل الضريبة',money(p.saleBeforeTax)],['شامل الضريبة المحددة',money(p.total)]].map((v,i)=>{const cells=display(v);if(i<=serviceRows.length)cells[0]=source(v[0],'factory',{tab:'sale',field:Object.keys(serviceFields)[i]||'worktop'},'مراجعة '+v[0]);return cells;}));
 const hasDesign=doc.kitchen.units.length>0||Object.keys(doc.room.workshop?.corners||{}).length>0;
 const projectTitle=doc.room.name||'المطبخ';
 box.innerHTML='<header class="kq-project-head"><div><span class="kq-kicker">'+studioIcon('drawing')+' عرض السعر</span><h3>'+safe(projectTitle)+'</h3><p>'+safe(cat.name)+' · إصدار '+fmt(cat.revision)+' · '+qState(cat.approved)+'</p><p>'+['store','pricing'].map(role=>recordStatus(doc.room.workshop,role)).join(' · ')+'</p></div>'+
  (hasDesign?'<button type="button" data-factory-act="customerPreview" class="kq-preview-action">'+studioIcon('image')+'معاينة عرض العميل</button>':'')+'</header>'+
  '<div class="kw-summary"><div class="kq-total">'+sumLabel+'<strong>'+(p.total===null?'غير مكتمل':money(p.total))+'</strong></div><div>قيمة مواد المشروع المعروفة<strong>'+(p.purchases.some(v=>v.cost!=null)?money(p.subtotal):'لا توجد أسعار مسجّلة')+'</strong></div><div>وحدات ممثلة في وصفات المصنع<strong>'+fmt(p.coveredUnits)+' / '+fmt(p.totalUnits)+'</strong></div></div>'+
  '<div class="kf-quote-switch" role="group" aria-label="عرض الحصر"><button type="button" data-quote-pane="customer" aria-pressed="true">'+studioIcon('quote')+'مراجعة عرض العميل</button><button type="button" data-quote-pane="shop" aria-pressed="false">'+studioIcon('cut')+'المشتريات والقص</button></div>'+
  '<div class="kq-review" data-quote-view="customer"><section class="kq-scope"><h4>نطاق عرض السعر</h4><p>'+scope+' الجهاز الذي يورّده العميل خارج توريد المصنع. '+(p.customerBays.length?'فتحات محجوزة للعميل: '+p.customerBays.map(safe).join('، ')+'.':'')+'</p>'+
  (p.fitoutSummary?.length?'<details><summary>قواعد الدواليب ونعلة الرخام</summary><ul>'+p.fitoutSummary.map(v=>'<li>'+safe(v)+'</li>').join('')+'</ul></details>':'')+
  '<details><summary>الخدمات وإجمالي البيع</summary>'+services+'</details>'+
  (p.extras.length?'<details><summary>تفاصيل الجدران والمورد الخارجي</summary>'+table(['البند','الكمية','النطاق','التكلفة'],p.extras.map(v=>{const t=extraDestination(v);return [source(v.label,t?.step,t?.focus,'فتح مصدر '+v.label),fmt(v.quantity)+' '+safe(v.unit),({factory:'المصنع',external:'مورد خارجي',existing:'قائم',review:'ينتظر التحقق'})[v.readiness],v.inMaterials?'ضمن قطع ومشتريات الصنف':v.readiness==='factory'?money(v.cost):'خارج الحصر أو معلّق'];}))+'</details>':'')+'</section>'+
  '<section class="kq-next"><h4>مراجعة العرض مع العميل</h4>'+
  (review?'<p class="kw-hint">'+safe(review.reason)+'</p>'+action('placement','تعديل الوحدة على الرسم'):'')+
  (p.fitoutPending?.length?'<div class="kw-hint"><b>نطاق القواعد ونعلة الرخام غير مكتمل</b><p>'+p.fitoutPending.map(safe).join('<br>')+'</p>'+action('fitout','تحديد تجهيز الصف')+'</div>':'')+
  (p.missing.length?'<details class="kw-hint"><summary>أسعار أو بنود تحتاج إكمالًا ('+fmt(p.missing.length)+')</summary><ul>'+p.missing.map(v=>'<li>'+(bySku.has(v)?material(v):safe(v))+'</li>').join('')+'</ul></details>':'')+
  (p.issues.length?'<details class="kw-hint"><summary>حصر مبدئي · بنود للمراجعة ('+fmt(p.issues.length)+')</summary><ul>'+p.issues.map(v=>'<li>'+safe(v)+'</li>').join('')+'</ul></details>':'')+
  '<div class="kw-actions">'+action('approve','مراجعة واعتماد النسخة')+
  '<button type="button" data-factory-act="sale" class="kq-download" aria-label="تنزيل عرض التكلفة CSV" title="تنزيل عرض التكلفة CSV">'+studioIcon('download')+'عرض التكلفة</button></div></section></div>'+
  '<section class="kq-shop" data-quote-view="shop" hidden><h4>المشتريات والقص والتشغيل'+(p.releaseIssues.length?' · بنود للمراجعة ('+fmt(p.releaseIssues.length)+')':'')+'</h4>'+
  '<p>اعتماد عميل وقياسات مكتملة ومراجعة فعلية للوصفة مطلوبة قبل إرسال القطع للورشة.</p>'+
  (p.releaseIssues.length?'<p class="kw-hint">'+p.releaseIssues.map(safe).join('<br>')+'</p>':'')+
  '<div class="kq-downloads" role="group" aria-label="تنزيل ملفات المصنع بصيغة CSV"><span>'+studioIcon('download')+'<bdi>CSV</bdi></span>'+
  action('purchases','المشتريات','aria-label="تنزيل المشتريات CSV"')+action('cuts','قطع الوحدات','aria-label="تنزيل قطع الوحدات CSV"')+
  action('layout','توزيع القص والبواقي','aria-label="تنزيل خطة توزيع القص والبواقي CSV"')+'</div><h4>خامات الشراء</h4><details class="kq-method"><summary>كيف حُسبت المشتريات؟</summary><p>تُجرَّب البواقي المسجّلة لهذا الصنف قبل فتح خام كامل. تُقيّم القطع المستخرجة من باقٍ بحصتها من سعر إحلال الخام مع فاقد قصها. يظهر الإنفاق الجديد بعد طرح رصيد الوحدات الكاملة بشكل مستقل. يحافظ تقدير الألواح على اتجاه القطعة، وقد تتحسن خطة القص النهائية في الورشة.</p></details>'+
  (p.purchases.length?table(['الصنف','الخام الكامل','للشراء بعد الرصيد','صافي / خام كامل','من البواقي','منشار','قيمة المواد'],p.purchases.map(v=>[material(v.sku,v.name+' · '+v.sku),fmt(v.qty),v.orderQty===null?'الرصيد غير مسجّل':fmt(v.orderQty),fmt(v.net)+' / '+fmt(v.purchased)+' '+safe(v.unit),fmt(v.offcutUse??0),fmt(v.loss),money(v.cost)])):'<p>تظهر المشتريات بعد تطبيق صف المصنع في الرسم.</p>')+
  '<details class="kf-cut-register"><summary>قائمة القطع الموسومة بالوحدة ('+fmt(parts.length)+' بندًا)</summary>'+(parts.length?'<label class="kf-cut-search">تصفية القطع حسب الوحدة أو الصنف<input type="search" data-cut-query placeholder="رمز الوحدة أو الصنف أو اسم القطعة" autocomplete="off"></label><small data-cut-count role="status">'+fmt(parts.length)+' بنود</small>':'')+table(partHeaders,parts.map(cutCells))+'</details><div data-quote-operations></div></section>';
 if(initialPane==='shop'){
  for(const button of box.querySelectorAll('[data-quote-pane]'))button.setAttribute('aria-pressed',String(button.dataset.quotePane==='shop'));
  for(const view of box.querySelectorAll('[data-quote-view]'))view.hidden=view.dataset.quoteView!=='shop';
 }
 box.oninput=e=>{
  if(!e.target.matches('[data-cut-query]'))return;
  const term=e.target.value.trim().toLocaleLowerCase(),list=box.querySelectorAll('.kf-cut-register tbody tr');
  let matches=0;
  for(const row of list){row.hidden=!!term&&!row.textContent.toLocaleLowerCase().includes(term);if(!row.hidden)matches++;}
  box.querySelector('[data-cut-count]').textContent=matches?fmt(matches)+' من '+fmt(list.length)+' بنود':'لا توجد قطع مطابقة. امسح البحث لعرض جميع البنود.';
 };
 function exportLedger(kind,headings,rows){
  if(!isCurrent()||getDoc()!==doc){tell?.('تغيّر المشروع أو توجد معاينة غير محفوظة. راجع الحصر الحالي قبل التصدير.');return;}
  const titles={cuts:'كشف قطع للمراجعة',operations:'جدول تشغيل للمراجعة',layout:'توزيع القص',purchases:'مشتريات المصنع',sale:'عرض السعر'};
  const stamp=outputStamp(doc,'المطبخ كاملًا',titles[kind]);
  const tagged=stampColumns(stamp,['نسخة الكتالوج',...headings],rows.map(r=>[cat.revision,...r]));
  const id=doc.room.projectId||'example';
  download(factoryCSV(tagged.headers,tagged.rows),'workshop-'+kind+'-'+id+'-'+stamp.revision+'-r'+cat.revision+'.csv','text/csv;charset=utf-8');
 }
 const opsHost=box.querySelector('[data-quote-operations]');shopOperationsPanel(opsHost,p,cat,(headers,lines)=>exportLedger('operations',headers,lines));
 box.onclick=async e=>{
  const pane=e.target.closest('[data-quote-pane]');
  if(pane){
   for(const button of box.querySelectorAll('[data-quote-pane]'))button.setAttribute('aria-pressed',String(button===pane));
   for(const view of box.querySelectorAll('[data-quote-view]'))view.hidden=view.dataset.quoteView!==pane.dataset.quotePane;
   return;
  }
  const target=e.target.closest('[data-quote-source]');
  if(target){
   const link=links[target.dataset.quoteSource];if(!link)return;
   if(!isCurrent()||doc!==getDoc()){tell?.('تغيّر المشروع. افتح الحصر الحالي لمراجعة هذا البند.');return;}
   onAdvance?.(link.step,link.focus);return;
  }
  const a=e.target.closest('[data-factory-act]')?.dataset.factoryAct;if(!a)return;
  if(a==='customerPreview'){
   const openButton=e.target.closest('[data-factory-act]');
   if(!hasDesign||openButton.disabled)return;
   openButton.disabled=true;
   try{
    const [{customerReport},{reviewWholeProposal}]=await Promise.all([import('./kitchen-proposal-presentation.js'),import('./kitchen-whole-plan.js')]);
    if(!box.isConnected||!isCurrent()||getDoc()!==doc){tell?.('تغيّرت نسخة المشروع. افتح الحصر الحالي لمعاينة العرض.');return;}
    const walls=[...new Set(doc.kitchen.runs.map(r=>r.wall).filter(Boolean))];
    previewCustomerReport(customerReport({doc,saved:true,questions:reviewWholeProposal(doc,walls,p)}),openButton);
   }catch{tell?.('تعذّر فتح عرض العميل. أعد فتح الحصر وحاول مرة أخرى.');}
   finally{openButton.disabled=false;if(document.activeElement===document.body&&openButton.isConnected)openButton.focus({preventScroll:true});}
   return;
  }
  if(a==='fitout'){onAdvance?.('assembly');return;}
  if(a==='placement'&&review){onAdvance?.('placement',{unitId:review.unitId});return;}
  if(a==='approve'){onAdvance?.('sign');return;}
  let headings=partHeaders,body=parts;
  if(a==='purchases'){headings=buyHeaders;body=bought;}
  if(a==='layout'){
   headings=['الصنف','النوع','مصدر الخام','رقم الخام','الوحدة','القطعة','البداية الأفقية مم','البداية الرأسية مم','الطول مم','العرض مم'];
   body=p.purchases.flatMap(v=>[...(v.layout||[]).map(x=>[v.sku,'قطع',x.source,x.ref,x.unitId,x.label,x.xMm,x.yMm,x.a,x.b]),...(v.leftovers||[]).map(x=>[v.sku,'باق متوقع',x.source,x.ref,'','',x.xMm,x.yMm,x.lengthMm,x.widthMm])]);
  }
  if(a==='sale'){headings=['البند','القيمة','العملة أو الشرط'];body=factorySaleRows(p,cat);}
  if(a!=='sale'){const state=p.ready?'وصفة مراجعة، تُطلب موافقة الإصدار':'مسودة للمراجعة';headings=['حالة الحصر',...headings];body=body.map(v=>[state,...v]);}
  exportLedger(a,headings,body);
 };return ()=>box.remove();
}
