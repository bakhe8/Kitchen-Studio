// The estimate reads current drawing geometry; the editable assumptions below
// are project defaults, never synthetic survey observations.
import {fieldInputs,fieldInputByCode} from './kitchen-field-catalog.js';
import {getEffectiveDefaults,resolveDefault,inheritedDefault,setProjectDefault,resetProjectDefault,getProjectDefaultProfile,getReusableDefaults,saveReusableDefaults,adoptReusableDefaults} from './kitchen-defaults-model.js';
import {calculateKitchenDefaults,designDefault} from './kitchen-defaults-calculations.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {officeFileLimit,packOfficeTemplate,unpackOfficeTemplate} from './kitchen-defaults-transfer.js';
import {kitchenUnitSpecs,kitchenFrontStyles,kitchenHandleStyles} from './kitchen-catalog.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {getProjectAccess,subscribeProjectAccess} from './kitchen-project-access.js';
import {fieldInputRole} from './kitchen-access-policy.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const f=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const val=(v,u='')=>v==null?'غير محسوب':(typeof v==='number'?f(v):v===true?'نعم':v===false?'لا':String(v))+(u?' '+u:'');
const bdi=v=>'<bdi>'+esc(v)+'</bdi>';
const rowKeys={base:['CAT-03','عمق الصف السفلي'],upper:['CAT-03','عمق الصف العلوي'],front:['CAT-06','خامة واجهة الوحدة الجديدة'],worktop:['CAT-17','خامة سطح العمل الجديد'],waste:['MFG-06','نسبة احتياط سطح العمل'],price:['MFG-09','سعر متر سطح العمل المربع']};
const physical=r=>r?.code==='CAT-17'&&r?.property===rowKeys.worktop[1]?kitchenWorktopFinishes:r?.code==='CAT-06'&&r?.property===rowKeys.front[1]?kitchenFrontFinishes:r?.code==='CAT-08'&&r?.property==='شكل واجهة الوحدة الجديدة'?kitchenFrontStyles:r?.code==='CAT-12'&&r?.property==='مقبض الوحدة الجديدة'?kitchenHandleStyles:null;
const isDepth=r=>r?.code==='CAT-03'&&[rowKeys.base[1],rowKeys.upper[1]].includes(r?.property);
const isWaste=r=>r?.code==='MFG-06'&&r.property===rowKeys.waste[1];
const isPrice=r=>r?.code==='MFG-09'&&r.property===rowKeys.price[1];
const levels={builtin:'إعداد الاستوديو',profile:'من القالب',project:'استثناء للمشروع',entity:'استثناء للعنصر',pending:'بانتظار مصدر'};
const types={number:'رقم',text:'نص',choice:'اختيار',boolean:'نعم / لا',date:'تاريخ'};
const modes={value:'قيمة محددة',unknown:'بانتظار معلومة','na':'لا ينطبق'};
const describe=r=>!r||r.origin==='pending'||r.mode==='unknown'?'بانتظار معلومة':r.mode==='na'?'لا ينطبق':physical(r)?.[r.value]?.label||val(r.value,r.unit);
const specOf=(key,itemId='')=>({code:rowKeys[key][0],property:rowKeys[key][1],itemId});
function opts(items,selected){return items.map(([k,v])=>'<option value="'+esc(k)+'"'+(String(k)===String(selected)?' selected':'')+'>'+esc(v)+'</option>').join('');}
const btn=(act,title,cls='',attr='')=>'<button type="button" data-df-do="'+act+'" class="'+cls+'" '+attr+'>'+esc(title)+'</button>';
const attr=(k,v)=>' '+k+'="'+esc(v)+'"';
const field=(s,html)=>'<label class="df-field"><span>'+esc(s)+'</span>'+html+'</label>';
const sourceTag=r=>'<span class="df-tag" data-origin="'+esc(r?.origin||'pending')+'">'+esc(levels[r?.origin]||r?.source||'بانتظار مصدر')+'</span>';
const num=v=>{const s=String(v??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replace(/٫/g,'.').replace(/−/g,'-');if(!/^[+-]?(?:(?:\d{1,3}(?:[٬,]\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(s))return null;const n=Number(s.replace(/[٬,]/g,''));return Number.isFinite(n)?n:null;};
const goodColor=x=>/^#[0-9a-f]{6}$/i.test(x||'')?x:'#b2b8aa';
function filtersText(e){return fold([e.code,e.name,e.group].join(' '));}
function idsIn(doc,calc){const pairs=new Map([['room',doc.room.name||'الغرفة']]);for(const w of roomArchitecture(doc.room).walls)pairs.set(w.id,w.label);for(const r of doc.kitchen.runs)pairs.set(r.id,(r.placement==='free'?'جزيرة':r.tier==='upper'?'صف علوي':'صف سفلي')+' · '+(pairs.get(r.wall)||r.id));for(const u of doc.kitchen.units)pairs.set(u.id,(kitchenUnitSpecs[u.kind]?.label||u.kind)+' · '+(pairs.get(u.runId)||u.runId));for(const f of doc.kitchen.features)pairs.set(f.id,f.id+' · '+(pairs.get(f.wall)||''));for(const m of calc.materials||[])pairs.set(m.finishId,'خامة السطح: '+m.label);for(const r of doc.room.fieldRegister?.records||[])if(!pairs.has(r.itemId))pairs.set(r.itemId,r.itemId);return pairs;}
export function comparisonRows(doc,spec){
 if(!spec?.code||!spec?.property)return [];const item=fold(spec.itemId),property=fold(spec.property);
 return (doc.room.fieldRegister?.records||[]).filter(r=>r.inputCode===spec.code&&fold(r.property)===property&&r.execution!=='excluded'&&(!item||fold(r.itemId)===item||fold(r.location).endsWith('['+item+']')));
}
const fixBtn=(name,inner,itemId='')=>btn('fix',inner,'df-small',attr('data-key',name)+attr('data-item',itemId));
const metric=(title,n,unit)=>'<div><dt>'+esc(title)+'</dt><dd>'+bdi(val(n,unit))+'</dd></div>';
function takeoffHTML(g,canEdit){const mats=g.materials||[],parts=g.fronts||[];
 const fix=(key,label,item)=>canEdit(rowKeys[key][0])?fixBtn(key,label,item):'';
 const tariff=g.estimatedCost!=null?val(g.estimatedCost,'ر.س'):(g.unpricedMaterials?f(g.unpricedMaterials)+' بلا سعر':'لا يوجد إجمالي');
 return '<section class="df-card"><div class="df-cap"><h3>الخامات في التصميم</h3><span class="df-tag">من الرسم</span></div>'+
 (mats.length?'<div class="df-materials">'+mats.map(m=>'<article><div class="df-material-head"><i style="background:'+goodColor(m.color)+'"></i><b>'+esc(m.label)+'</b><span>'+bdi(val(m.netM2,'م²'))+' صافي</span></div><dl class="df-mini">'+metric('قبل تفريغ الفتحات',m.grossM2,'م²')+metric('خصم فتحات الحوض والموقد',m.cutoutsM2,'م²')+metric('التوريد مع الاحتياط',m.orderM2,'م²')+metric('سعر المتر',m.priceM2??null,'ر.س')+'</dl><div class="df-actions">'+fix('waste','الاحتياط · '+(m.wastePct!=null?val(m.wastePct,'%'):'غير محسوب'),m.finishId)+fix('price',m.priceM2==null?'تعيين سعر هذه الخامة':'تعديل افتراضي السعر',m.finishId)+'</div><details class="df-origin"><summary>أساس الحساب والتسعير</summary><p>'+esc(m.wasteSource||'الاحتياط غير محدد')+' · الاحتياط</p><p>'+esc(m.priceSource||'السعر غير محدد')+' · السعر</p><p>التوريد التقديري = مساحة السطح قبل الفتحات × (1 + نسبة الاحتياط).</p><b>'+(m.includePricing===false?'مستبعد من تسعير السطح':m.cost==null?'ينتظر السعر أو نسبة الاحتياط':'تكلفة الخامة: '+bdi(val(m.cost,'ر.س')))+'</b></details></article>').join('')+'</div><div class="df-line"><b>تقدير خامات السطح</b><strong>'+bdi(tariff)+'</strong></div>'+(g.estimatedCost==null&&g.unpricedMaterials&&g.pricedCost>0?'<small class="df-help">المجموع الجزئي للخامات المسعّرة: '+bdi(val(g.pricedCost,'ر.س'))+'</small>':'')+(g.excludedMaterials?'<small class="df-help">خامات مستبعدة من التسعير: '+bdi(f(g.excludedMaterials))+'</small>':''):'<p class="df-help">لم يُرسم سطح عمل بعد.</p>')+
 (g.cladding?'<details><summary>كسوة الجدران · '+bdi(val(g.cladding.netM2,'م²'))+'</summary><dl class="df-mini">'+metric('قبل خصم الفتحات',g.cladding.grossM2,'م²')+metric('مساحة الفتحات',g.cladding.openingsM2,'م²')+metric('بعد خصم الفتحات',g.cladding.netM2,'م²')+metric('ارتفاع الكسوة',g.cladding.heightMM,'مم')+'</dl></details>':'')+
 (parts.length?'<details><summary>الوحدات حسب خامة الواجهة</summary><dl class="df-finish-list">'+parts.map(m=>'<div><dt><i style="background:'+goodColor(m.color)+'"></i>'+esc(m.label)+'</dt><dd>'+bdi(val(m.units,'وحدة'))+'</dd></div>').join('')+'</dl></details>':'')+'</section>';
}
export function mountDefaultsPanel(host,{getDoc,apply,onGuided,onRecords,onCatalog,getProjectKey}){
 let view='main',listMode='defaults',d=null,search='',limit=24,group='',profileConfirm='',profileName='',pendingImport=null,fileSeq=0,dirty=false,stale=false,boundKey=getProjectKey?.(),boundDoc=getDoc(),cachedDoc=null,g=null,status='',tone='ok',disposed=false;
 const opens=new Set(),q=s=>host.querySelector(s),scroll=()=>{const pane=host.closest?.('.fr-main');if(pane)pane.scrollTop=0;};
 const calc=()=>{if(getDoc()!==cachedDoc){cachedDoc=getDoc();g=calculateKitchenDefaults(cachedDoc);}return g;};
 const notify=(s='',kind='ok')=>{status=s;tone=kind;const el=q('[data-df-status]');if(el){el.textContent=s;el.dataset.kind=kind;el.hidden=!s;}};
 const role=()=>getProjectAccess(getDoc()).role;
 const managesProfile=()=>role()==='owner';
 const canEdit=code=>managesProfile()||role()==='editor'&&fieldInputRole(code)!=='owner'||(['rep','factory'].includes(role())&&fieldInputRole(code)===role());
 const canSee=code=>!['rep','factory'].includes(role())||fieldInputRole(code)===role();
 const canEditAny=()=>['owner','editor','rep','factory'].includes(role());
 const canGuide=()=>['owner','editor','rep'].includes(role());
 const denied=()=>{notify('لا تسمح صلاحية المشروع الحالية بتعديل هذا المدخل أو القالب.','error');return false;};
 const say=()=>'<p class="df-status" role="status" aria-live="polite" data-df-status data-kind="'+esc(tone)+'" '+(status?'':'hidden')+'>'+esc(status)+'</p>';
 function homeHTML(){const doc=getDoc(),g=calc(),profile=getProjectDefaultProfile(doc),rows=getEffectiveDefaults(doc).filter(r=>canSee(r.code)),local=managesProfile()?getReusableDefaults():null,exceptions=rows.filter(r=>['project','entity'].includes(r.origin));
  const shortcuts=[['base','السفلي'],['upper','العلوي'],['front','واجهة جديدة'],['worktop','سطح جديد']].filter(([k])=>canSee(rowKeys[k][0])).map(([k,s])=>{const row=resolveDefault(doc,specOf(k));return '<button type="button" data-df-do="fix" data-key="'+k+'" '+(canEdit(rowKeys[k][0])?'':'disabled')+'><span>'+s+'</span><strong>'+bdi(describe(row))+'</strong></button>';}).join('');
  const cfg=exceptions.length?'<details class="df-details" data-df-open="exceptions" '+(opens.has('exceptions')?'open':'')+'><summary>استثناءات هذا المشروع <span>'+f(exceptions.length)+'</span></summary>'+exceptions.slice(0,8).map(r=>propButton(r)).join('')+(exceptions.length>8?btn('all','استعراض بقية القيم','df-back'):'')+'</details>':'';
  return '<header class="df-hero"><small>'+esc(doc.room.name||'مشروع المطبخ')+'</small><h2>قيم المشروع</h2><span class="df-profile-pill">القالب: '+esc(profile?.name||'الاستوديو')+(profile?.version?' · '+f(profile.version):'')+'</span></header>'+say()+'<div class="df-home-actions">'+(canEditAny()?btn('any','تعديل استثناء','df-primary'):'')+btn('all','استعراض القيم','df-secondary')+'</div>'+
  '<dl class="df-kpis">'+metric('مساحة الغرفة الصافية',g.areaM2,'م²')+metric('محيط الجدران الداخلي',g.perimeterM,'م')+metric('طول أسطح العمل',g.worktopLengthM,'م')+metric('صافي السطح بعد الفتحات',g.worktopNetM2,'م²')+'</dl><p class="df-caption">تتحدّث الكميات من الرسم عند تغيير الأبعاد أو الخامة.</p>'+takeoffHTML(g,canEdit)+
  (shortcuts?'<section class="df-card"><div class="df-cap"><h3>عند إضافة وحدات جديدة</h3></div><div class="df-tiles">'+shortcuts+'</div></section>':'')+cfg+
  (managesProfile()?'<details class="df-details" data-df-open="profile" '+(opens.has('profile')?'open':'')+'><summary>القالب المتكرر للمشاريع الجديدة</summary><p class="df-help">يحفظ القالب القيم العامة وأسعار خامات الأسطح ونسب احتياطها على هذا الجهاز. تبقى استثناءات عناصر الموقع وقراءات الفني داخل المشروع.</p>'+
  field('اسم القالب','<input data-df-profile-name maxlength="90" value="'+esc(profileName||local?.name||'إعدادات المكتب')+'">')+
  '<div class="df-actions">'+btn('profile-save','حفظ كقالب للمشاريع الجديدة','df-secondary')+(local?btn('profile-load','استيراد «'+local.name+'» إلى المشروع','df-secondary'):'')+'</div>'+
  '<div class="df-actions df-transfer">'+btn('office-export','تنزيل قالب المكتب','df-secondary',local?'':'disabled title="احفظ قالبًا أولاً"')+btn('office-import','استيراد قالب المكتب','df-secondary')+'<input type="file" data-df-import hidden accept=".json,application/json"></div>'+
  (profileConfirm?'<div class="df-confirm"><p>'+(profileConfirm==='import'&&pendingImport?'حفظ «'+esc(pendingImport.name)+'» كقالب المكتب على هذا الجهاز؟ يحتوي '+f(pendingImport.rows.length)+' قيمة · إصدار الملف '+f(pendingImport.version)+'. لن يتغيّر المشروع المفتوح.':profileConfirm==='load'?'استبدال افتراضيات المشروع بنسخة القالب المحفوظة؟ تبقى استثناءات المشروع.':'حفظ القيم العامة وأسعار خامات الأسطح واحتياطها للمشاريع الجديدة على هذا الجهاز؟')+'</p>'+btn('profile-confirm','متابعة','df-primary')+btn('profile-cancel','إلغاء','df-secondary')+'</div>':'')+'</details>':'')+
  '<div class="df-home-actions">'+(onGuided&&canGuide()?btn('guided','التحقق في الموقع','df-secondary'):'')+(onRecords?btn('records','القراءات المسجّلة','df-secondary'):'')+'</div>';
 }
 function propButton(r){return '<button type="button" class="df-property" data-df-do="edit" '+(canEdit(r.code)?'':'disabled ')+attr('data-code',r.code)+attr('data-prop',r.property)+attr('data-item',r.itemId||'')+'><span><b>'+esc(r.property)+'</b><small>'+esc(r.itemId?idsIn(getDoc(),calc()).get(r.itemId)||r.itemId:fieldInputByCode.get(r.code)?.name||r.code)+'</small></span><span><strong>'+bdi(describe(r))+'</strong>'+sourceTag(r)+'</span></button>';}
 const subHead=t=>'<div class="df-title">'+btn('back','→ رجوع','df-back')+'<h2>'+esc(t)+'</h2></div>';
 function listHTML(){return subHead('استعراض قيم المشروع')+say()+'<div class="df-switch">'+btn('list-mode','الافتراضيات','',attr('data-mode','defaults')+attr('aria-pressed',listMode==='defaults'))+btn('list-mode','من الرسم والحساب','',attr('data-mode','facts')+attr('aria-pressed',listMode==='facts'))+'</div>'+field('بحث في القيم','<input type="search" data-df-search="list" '+attr('value',search)+' placeholder="اسم الخاصية أو البند">')+'<div data-df-results></div>'+(canEditAny()?btn('any','تعيين افتراضي لأي بند','df-primary'):'');}
 function listRows(){const box=q('[data-df-results]');if(!box)return;if(view==='list'&&listMode==='facts'){
 const a=(calc().facts||[]).filter(r=>canSee(r.code)&&fold([r.code,r.label,r.property,r.itemId,r.source].join(' ')).includes(fold(search)));
 box.innerHTML='<p class="df-caption">'+f(a.length)+' قيمة من التصميم الحالي</p>'+a.slice(0,limit).map(r=>'<div class="df-fact"><div><b>'+esc(r.label||r.property)+'</b> <strong>'+bdi(val(r.value,r.unit))+'</strong></div><small>'+esc(r.source||'الرسم')+'</small></div>').join('')+(a.length>limit?btn('more','عرض المزيد','df-secondary'):'');return;
 }if(view==='list'){const a=getEffectiveDefaults(getDoc()).filter(r=>canSee(r.code)&&fold([r.code,r.property,fieldInputByCode.get(r.code)?.name,r.itemId].join(' ')).includes(fold(search)));
 box.innerHTML='<p class="df-caption">'+f(a.length)+' قيمة معرّفة</p>'+a.slice(0,limit).map(propButton).join('')+(a.length>limit?btn('more','عرض المزيد','df-secondary'):'');return;}
 const terms=fold(search).split(' ').filter(Boolean);const a=fieldInputs.filter(e=>canEdit(e.code)&&(!group||group===e.group)&&terms.every(s=>filtersText(e).includes(s)));
 box.innerHTML='<p class="df-caption">'+f(a.length)+' بندًا مطابقًا</p>'+a.slice(0,limit).map(e=>'<button type="button" class="df-property" data-df-do="code" '+attr('data-code',e.code)+'><span><b>'+esc(e.name)+'</b><small>'+esc(e.group)+'</small></span><bdi>'+esc(e.code)+'</bdi></button>').join('')+(a.length>limit?btn('more','عرض المزيد','df-secondary'):'');}
 function pickerHTML(){const groups=[...new Set(fieldInputs.filter(e=>canEdit(e.code)).map(e=>e.group))];return subHead('تعيين افتراضي لبند')+say()+field('البحث في البنود','<input type="search" data-df-search="any" placeholder="مثل: فتحة الجهاز أو EQP-02" '+attr('value',search)+'>')+field('المجموعة','<select data-df-group>'+opts([['','كل المجموعات'],...groups.map(x=>[x,x])],group)+'</select>')+'<div data-df-results></div>';}
 function loadDraft(code,property='',itemId='',forceData=null){const old=property?resolveDefault(getDoc(),{code,property,itemId}):null;const known=old&&old.origin!=='pending';const fct=property?designDefault(getDoc(),{code,property,itemId}):null;const src=forceData||((known?old:fct)||{});
 d={code,property,itemId,scope:itemId?'entity':'project',type:src.type||'text',mode:known?old.mode||'value':(src.value!=null?'value':'value'),value:src.value??'',unit:src.unit||'',base:old,fact:fct};}
 function openWorktopValue(code,property,material){
  if(!['MFG-06','MFG-09'].includes(code)||!property||!material)return;
  if(!openEdit(code,property,material))return false;if(d.mode!=='value'){d.mode='value';render();}
  q('[name="value"]')?.focus?.({preventScroll:true});
 }
 function openEdit(code,property='',itemId=''){if(!fieldInputByCode.has(code))return false;if(!canEdit(code))return denied();loadDraft(code,property,itemId);dirty=false;stale=false;view='edit';boundDoc=getDoc();boundKey=getProjectKey?.();notify('');render();scroll();return true;}
 function editorHTML(){const doc=getDoc(),entry=fieldInputByCode.get(d.code),items=idsIn(doc,calc()),custom=physical(d);const picks=[...new Set([...getEffectiveDefaults(doc).filter(r=>r.code===d.code).map(r=>r.property),...(calc().facts||[]).filter(r=>r.code===d.code).map(r=>r.property),...String(entry.spec||'').split(/[،؛.]/).map(x=>x.trim()).filter(x=>x.length>2&&x.length<41)])];
 const base=d.property?resolveDefault(doc,d):null,inh=d.property?inheritedDefault(doc,d):null;const observed=comparisonRows(doc,d);const matched=base&&['entity','project'].includes(base.origin)&&String(base.itemId||'')===String(d.itemId||'');
 const hist=observed.length?'<details class="df-reads"><summary>القراءات المسجّلة لهذه الخاصية ('+f(observed.length)+')</summary>'+observed.slice(-8).map(v=>'<div><b>'+bdi(val(v.value,v.unit))+'</b> · '+esc(v.itemId)+' <small>'+esc(({measured:'مقاس ميدانيًا',confirmed:'مؤكّد',documented:'موثّق',conflict:'متعارض',na:'لا ينطبق',unknown:'غير معلوم'})[v.verification]||'قراءة مبدئية')+'</small></div>').join('')+(onRecords?btn('records','فتح جميع القراءات','df-back'):'')+'</details>':'';
 const conflict=observed.some(x=>x.verification==='conflict')||observed.some((r,i)=>observed.some((s,j)=>j<i&&s.itemId===r.itemId&&s.unit===r.unit&&s.value!=null&&r.value!=null&&String(s.value)!==String(r.value)));
 const src=d.fact?'<p class="df-help">من الرسم: '+bdi(val(d.fact.value,d.fact.unit))+' · '+esc(d.fact.source||'المخطط')+'</p>':'';
 function inputV(){
  if(d.mode!=='value')return '';
  if(isDepth(d))return '<div class="df-grid">'+field('العمق','<input name="value" inputmode="decimal" required '+attr('value',d.value)+'>')+field('الوحدة','<select name="unit">'+opts([['مم','مم'],['سم','سم'],['م','م']],d.unit||'مم')+'</select>')+'</div>';
  if(isPrice(d)||isWaste(d))return field(isPrice(d)?'السعر (ريال/م²)':'الاحتياط (%)','<input name="value" inputmode="decimal" required '+attr('value',d.value)+'>');
  if(custom)return field(d.code==='CAT-08'?'شكل الواجهة':d.code==='CAT-12'?'المقبض':'الخامة','<select name="value">'+opts(Object.entries(custom).map(([id,m])=>[id,m.label]),d.value)+'</select>');
  if(d.type==='boolean')return field('القيمة','<select name="value">'+opts([['','اختر…'],['true','نعم'],['false','لا']],String(d.value))+'</select>');
  return '<div class="df-grid">'+field('القيمة','<input name="value" type="'+(d.type==='date'?'date':'text')+'" inputmode="'+(d.type==='number'?'decimal':'text')+'" '+(d.type==='number'?'dir="ltr"':'')+' required '+attr('value',d.value)+'>')+(d.type==='number'?field('الوحدة','<input name="unit" maxlength="80" '+attr('value',d.unit)+'>'):'')+'</div>';
 }
 return subHead('تعديل الافتراضي')+say()+'<div class="df-identity"><bdi>'+esc(d.code)+'</bdi><strong>'+esc(entry.name)+'</strong></div><form data-df-edit><fieldset '+(canEdit(d.code)?'':'disabled')+' style="border:0;padding:0;margin:0;min-width:0">'+
 field('الخاصية','<input required name="property" list="df-properties" maxlength="300" autocomplete="off" '+attr('value',d.property)+' placeholder="اختر أو اكتب اسم الخاصية"><datalist id="df-properties">'+picks.map(p=>'<option '+attr('value',p)+'></option>').join('')+'</datalist>')+
 field('تطبيق الاستثناء على','<select name="scope">'+opts([['project','المشروع كله'],['entity','عنصر أو خامة بعينها']],d.scope)+'</select>')+
 (d.scope==='entity'?field('معرّف العنصر أو الخامة','<input name="itemId" required list="df-identities" maxlength="160" '+attr('value',d.itemId)+'><datalist id="df-identities">'+[...items].map(([id,l])=>'<option '+attr('value',id)+'>'+esc(l)+'</option>').join('')+'</datalist>')+(d.itemId&&items.has(d.itemId)?'<small class="df-scope-note">'+esc(items.get(d.itemId))+'</small>':''):'')+
 (d.property?'<div class="df-before">'+sourceTag(base)+' <strong>'+bdi(describe(base))+'</strong>'+(matched?' <small>عند استعادة الموروث: '+bdi(describe(inh))+'</small>':'')+'</div>':'')+src+hist+
 (conflict?'<p class="df-alert">يوجد اختلاف في القراءات المسجّلة. تعديل الافتراضي لا يحسمه.</p>':'')+
 '<div class="df-grid">'+field('حالة القيمة','<select name="mode" '+(isDepth(d)||custom?'disabled':'')+'>'+opts(isDepth(d)||custom?[['value','قيمة محددة']]:Object.entries(modes),d.mode)+'</select>')+(!custom&&!isDepth(d)&&!isWaste(d)&&!isPrice(d)&&d.mode==='value'?field('نوع القيمة','<select name="type">'+opts(Object.entries(types),d.type)+'</select>'):'')+'</div>'+inputV()+
 (d.mode==='unknown'?'<small class="df-help">يبقى الناتج المرتبط بهذه القيمة معلّقًا حتى تتوفر.</small>':d.mode==='na'?'<small class="df-help">يُستبعد البند من التقدير حيث تنطبق القاعدة.</small>':'')+
 '<div class="df-actions"><button type="submit" class="df-primary" '+(stale?'disabled':'')+'>حفظ استثناء المشروع</button>'+(matched?btn('reset','استعادة الموروث','df-secondary'):'')+'</div></fieldset></form>'+(!canEdit(d.code)?'<p class="df-alert">هذا المدخل للعرض فقط وفق صلاحيتك الحالية.</p>':'')+
 (stale?btn('reopen','مراجعة النسخة الحالية','df-secondary'):'');}
 function render(){if(disposed)return;host.innerHTML='<section class="df-panel" dir="rtl">'+(view==='main'?homeHTML():view==='edit'?editorHTML():view==='list'?listHTML():pickerHTML())+'<div data-df-leave hidden></div></section>';if(view==='list'||view==='pick')listRows();}
 let leave=null;
 function withGuard(fn){if(!dirty){fn();return;}leave=fn;const el=q('[data-df-leave]');if(el){el.hidden=false;el.className='df-confirm';el.innerHTML='<p>تجاهل التعديل غير المحفوظ؟</p>'+btn('discard','تجاهل ومتابعة','df-danger')+btn('stay','متابعة التعديل','df-secondary');el.querySelector('button')?.focus();}}
 function show(to,msg=''){++fileSeq;pendingImport=null;view=to;search='';group='';limit=24;dirty=false;stale=false;profileConfirm='';boundDoc=getDoc();boundKey=getProjectKey?.();notify(msg);render();scroll();}
 function sync(form){if(!form||!d)return;const get=n=>form.elements?.namedItem(n)?.value;
 for(const key of ['property','scope','type','mode','value','unit']){const x=get(key);if(x!=null)d[key]=x;}
 d.itemId=d.scope==='entity'?String(get('itemId')??d.itemId??'').trim():'';d.property=d.property.trim();}
 function finish(result,msg){if(!result?.ok){notify(result?.reason||'تعذّر حفظ الافتراضي.','error');return false;}
 const target=getDoc(),out=apply({...target,room:result.room},msg);if(!out?.ok||out.saved===false){notify(out?.reason||'تعذّر حفظ المشروع على هذا الجهاز.','error');return false;}
 cachedDoc=null;show('main',msg);return true;}
 function submit(e){if(!e.target.matches?.('[data-df-edit]'))return;e.preventDefault();if(!d||!canEdit(d.code)){denied();return;}if(stale||boundDoc!==getDoc()||boundKey!==getProjectKey?.()){stale=true;notify('تغيّر المشروع؛ راجع نسخته الحالية قبل الحفظ.','error');render();return;}sync(e.target);if(!d.property||d.scope==='entity'&&!d.itemId){notify('أدخل اسم الخاصية وحدّد العنصر.','error');return;}
 const custom=physical(d);if(isDepth(d)||isWaste(d)||isPrice(d))d.type='number';if(isPrice(d))d.unit='ريال/م²';if(isWaste(d))d.unit='%';
 const v=d.mode!=='value'?null:d.type==='boolean'?(d.value==='true'||d.value===true?true:d.value==='false'||d.value===false?false:null):d.type==='number'?num(d.value):String(d.value??'').trim();
 if(d.mode==='value'&&(v==null||v===''||custom&&!Object.hasOwn(custom,v))){notify('أدخل قيمة صالحة.','error');return;}
 if(isDepth(d)){const scale=({'مم':1,'سم':10,'م':1000})[d.unit];if(d.mode!=='value'||!scale||!Number.isFinite(v)||v*scale<150||v*scale>1500){notify('يجب أن يكون العمق بين 150 و1500 مم.','error');return;}}
 if(custom&&d.mode!=='value'){notify('اختر خامة متاحة للوحدات الجديدة.','error');return;}
 if(d.mode==='value'&&(isPrice(d)||isWaste(d))&&v<0){notify('لا يمكن استخدام قيمة سالبة لهذا الحساب.','error');return;}
 finish(setProjectDefault(getDoc(),{code:d.code,property:d.property,itemId:d.itemId,type:custom?'choice':d.type,mode:d.mode,value:v,unit:d.mode==='value'&&d.type==='number'?String(d.unit||'').trim():d.unit||''}),'حُفظ الاستثناء وأُعيد حساب التقدير.');}
 function click(e){const t=e.target.closest?.('[data-df-do]');if(!t||!host.contains(t))return;const a=t.dataset.dfDo;if(a==='stay'){leave=null;q('[data-df-leave]').hidden=true;return;}if(a==='discard'&&leave){const fn=leave;leave=null;dirty=false;fn();return;}
 if(a==='fix'){if(!Object.hasOwn(rowKeys,t.dataset.key))return;const sp=specOf(t.dataset.key,t.dataset.item||'');withGuard(()=>{if(!openEdit(sp.code,sp.property,sp.itemId))return;if(d.mode!=='value'){d.mode='value';render();}q('[name="value"]')?.focus?.({preventScroll:true});});return;}
 if(a==='edit'||a==='code'){withGuard(()=>openEdit(t.dataset.code,a==='edit'?t.dataset.prop:'',t.dataset.item||''));return;}
 if(a==='any'||a==='all'||a==='back'){if(a==='any'&&!canEditAny())return denied();withGuard(()=>show(a==='any'?'pick':a==='all'?'list':'main'));return;}
 if(a==='list-mode'){listMode=t.dataset.mode==='facts'?'facts':'defaults';search='';limit=24;render();return;}
 if(a==='more'){limit+=24;listRows();return;}
 if(a==='guided'||a==='records'){if(a==='guided'&&!canGuide())return denied();withGuard(()=>{dirty=false;(a==='guided'?onGuided:onRecords)?.();});return;}
 if(a==='reopen'){openEdit(d.code,d.property,d.itemId);return;}
 if(a==='reset'){if(!d||!canEdit(d.code))return denied();if(boundDoc!==getDoc()||stale)return notify('تغيّر المشروع؛ أعد فتح الاستثناء.','error');finish(resetProjectDefault(getDoc(),d),'أُزيل الاستثناء وعادت القيمة الموروثة.');return;}
 if(['office-export','office-import','profile-save','profile-load','profile-confirm'].includes(a)&&!managesProfile())return denied();
 if(a==='office-export'){try{const blob=new Blob([packOfficeTemplate(getReusableDefaults())],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='kitchen-office-template.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('جُهّز ملف قالب المكتب.');}catch(err){notify(err?.message||'تعذّر تنزيل القالب.','error');}return;}
 if(a==='office-import'){++fileSeq;pendingImport=null;profileConfirm='';opens.add('profile');render();const input=q('[data-df-import]');if(input){input.value='';input.click();}return;}
 if(a==='profile-save'||a==='profile-load'){++fileSeq;pendingImport=null;profileName=q('[data-df-profile-name]')?.value.trim()||'إعدادات المكتب';profileConfirm=a==='profile-save'?'save':'load';opens.add('profile');render();q('[data-df-do="profile-confirm"]')?.focus();return;}
 if(a==='profile-cancel'){++fileSeq;profileConfirm='';pendingImport=null;render();return;}
 if(a==='profile-confirm'){if(profileConfirm==='import'&&pendingImport){const r=saveReusableDefaults(pendingImport.rows,pendingImport.name);if(!r.ok){notify(r.reason||'تعذر حفظ القالب.','error');return;}profileName=r.profile.name;pendingImport=null;profileConfirm='';notify('حُفظ قالب المكتب للمشاريع الجديدة على هذا الجهاز.');render();return;}if(profileConfirm==='save'){const r=saveReusableDefaults(getDoc(),profileName);if(!r?.ok){notify(r?.reason||'تعذّر حفظ القالب.','error');return;}profileConfirm='';notify('حُفظ القالب للمشاريع الجديدة على هذا الجهاز.');render();}else if(profileConfirm==='load')finish(adoptReusableDefaults(getDoc()),'استورد المشروع نسخة القالب واحتفظ باستثناءاته.');}
 }
 function input(e){if(e.target.dataset?.dfSearch!=null){search=e.target.value;limit=24;listRows();return;}if(e.target.hasAttribute?.('data-df-profile-name')){profileName=e.target.value;return;}
 if(view==='edit'&&e.target.form?.matches?.('[data-df-edit]')){dirty=true;}}
 function change(e){const t=e.target;if(t.hasAttribute?.('data-df-import')){if(!managesProfile())return denied();const file=t.files?.[0],seq=++fileSeq,here=getDoc();pendingImport=null;profileConfirm='';opens.add('profile');if(!file)return;if(file.size>officeFileLimit){notify('يتجاوز حجم الملف 8 م.ب.','error');render();return;}file.text().then(txt=>{if(disposed||seq!==fileSeq||here!==getDoc()||view!=='main'||!managesProfile())return;pendingImport=unpackOfficeTemplate(txt);profileConfirm='import';notify('راجِع اسم القالب وعدد القيم قبل حفظه.');render();q('[data-df-do="profile-confirm"]')?.focus();}).catch(err=>{if(disposed||seq!==fileSeq)return;pendingImport=null;profileConfirm='';notify(err?.message||'تعذّر قراءة ملف القالب.','error');render();});return;}if(t.hasAttribute?.('data-df-group')){group=t.value;limit=24;listRows();return;}if(view!=='edit'||!t.form?.matches?.('[data-df-edit]'))return;
 if(!d||!canEdit(d.code))return denied();
 const oldScope=d.scope,oldItem=d.itemId,oldProp=d.property,oldType=d.type;sync(t.form);dirty=true;
 if(t.name==='property'&&d.property!==oldProp||t.name==='itemId'&&d.itemId!==oldItem||t.name==='scope'&&d.scope!==oldScope){const sc=d.scope;loadDraft(d.code,d.property,d.itemId);d.scope=sc;if(isDepth(d)||physical(d))d.mode='value';render();return;}
 if(t.name==='type'&&d.type!==oldType){d.value='';if(d.type!=='number')d.unit='';}
 if(['mode','type'].includes(t.name))render();
 }
 function toggle(e){const k=e.target?.dataset?.dfOpen;if(k){if(e.target.open)opens.add(k);else opens.delete(k);}}
 let accessRole=role();const unsubscribe=subscribeProjectAccess(()=>{const next=role();if(disposed||next===accessRole)return;accessRole=next;if(view==='edit')sync(q('[data-df-edit]'));if(!managesProfile()){++fileSeq;pendingImport=null;profileConfirm='';}render();});
 host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('change',change);host.addEventListener('submit',submit);host.addEventListener('toggle',toggle,true);render();
 return {openWorktopValue,isDirty:()=>dirty,refresh(){if(disposed)return;if(accessRole!==role()){accessRole=role();if(view==='edit')sync(q('[data-df-edit]'));render();return;}const ok=boundDoc===getDoc()&&boundKey===getProjectKey?.();if(view==='edit'&&dirty&&!ok){stale=true;notify('تغيّرت بيانات المشروع؛ راجع النسخة الحالية قبل تطبيق الاستثناء.','error');render();return;}if(view==='edit'&&ok)return;if(view==='edit')openEdit(d.code,d.property,d.itemId);else render();},destroy(){disposed=true;unsubscribe();leave=null;for(const [k,fn] of [['click',click],['input',input],['change',change],['submit',submit]])host.removeEventListener(k,fn);host.removeEventListener('toggle',toggle,true);host.replaceChildren();}};
}
