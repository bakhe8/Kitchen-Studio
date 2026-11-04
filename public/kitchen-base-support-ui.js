import {baseModeNames,baseSupportTakeoff,pruneBaseSupportChoices,cleanBaseSupportBook,cleanBaseSupportChoices} from './kitchen-base-support.js';
import {getFactoryCatalog,cleanCatalog} from './kitchen-workshop-factory.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {kitchenUnitSpecs} from './kitchen-catalog.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(label,control)=>'<label class="kw-field"><span>'+esc(label)+'</span>'+control+'</label>';
const pick=(name,label,pairs,value)=>field(label,'<select name="'+name+'">'+pairs.map(([k,l])=>'<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>');
const input=(name,label,value,type='text',required=true)=>field(label,'<input name="'+name+'" type="'+type+'" '+(type==='number'?'min="0" step="any"':'maxlength="180"')+' value="'+esc(value)+'" '+(required?'required':'')+'>');
const names=book=>Object.entries(book).map(([k,v])=>[k,v.label+' · '+k]);
const listItems=(c,filter)=>c.items.filter(filter).map(i=>[i.sku,i.name+' · '+i.sku]);
const numFmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const wp=(doc,workshop)=>({...doc,room:{...doc.room,workshop}});
const blank=()=>({rules:{},aprons:{}});
export function mountBaseSupport(host,{getDoc,apply,tell,mode='project',read,update,focus={}}){
 let formKind='rule',which='',runId=focus.runId||'',unitId=focus.unitId||'',method='legs',fixing='included',notice='';
 const catalog=()=>read?.()||getFactoryCatalog(getDoc());
 function report(message){notice=message;tell?.(message);const el=host.querySelector('[data-support-notice]');if(el)el.textContent=message;}
 function projectSettings(doc,c){
  const runs=doc.kitchen.runs.filter(r=>r.tier==='base');
  const plan=baseSupportTakeoff(doc,c),orphans=plan.orphanIssues.length?'<p>'+plan.orphanIssues.map(esc).join('<br>')+'</p><button type="button" data-support-prune>إزالة ارتباطات العناصر المحذوفة</button>':'';
  if(!runs.length)return orphans+'<p>أضف صفًا سفليًا لتحديد ارتكازه.</p>';
  const r=runs.find(x=>x.id===runId)||runs[0];runId=r.id;
  const inRun=plan.units.filter(u=>u.runId===r.id),eligible=inRun.filter(u=>u.applicable);
  const units=doc.kitchen.units.filter(u=>u.runId===r.id);
  if(unitId&&!eligible.some(u=>u.id===unitId))unitId='';
  const target=unitId?eligible.find(x=>x.id===unitId):null;
  const chosen=doc.room.workshop?.baseSupport?.[unitId?'units':'runs']?.[unitId||runId]||{};
  const book=c.baseSupport||blank(),options=Object.entries(book.rules).filter(([,p])=>eligible.some(u=>(!unitId||unitId===u.id)&&u.compatibleFamilies?.includes(p.family)));
  const unitLabel=u=>(kitchenUnitSpecs[units.find(x=>x.id===u.id)?.kind]?.label||'وحدة')+' · '+u.id;
  const summary=(target?[target]:inRun).map(u=>{
   if(!u.applicable)return '<li>'+esc(unitLabel(u))+' · جهاز أو حيز توريد منفصل</li>';
   const legs=u.mode==='legs'?' · '+numFmt(u.legCount)+' أرجل ('+esc(u.legSku)+')':'';
   const apron=u.apron==='none'?'بدون ساتر':u.apron==='yes'?'ساتر أمامي '+numFmt(u.apronHeightMm)+' مم':'الساتر غير محدد';
   const warning=[...u.issues,...u.releaseIssues].map(s=>'<small>'+esc(s)+'</small>').join(' ');
   return '<li><strong>'+esc(unitLabel(u))+'</strong> · '+esc(baseModeNames[u.mode])+legs+' · '+apron+(warning?'<br>'+warning:'')+'</li>';
  }).join('');
  const runLabel=rr=>(rr.placement==='free'?'صف حر':architectureWallLabel(rr.wall))+' · '+rr.id;
  return orphans+'<p>ترث الوحدات تفصيل المصنع بحسب عائلتها وعرضها والتعلية المقاسة. يمكنك تخصيص ساتر الواجهة أو طريقة الارتكاز للصف أو لدولاب واحد.</p>'+
   '<div class="kw-grid">'+pick('supportRun','الصف',runs.map(v=>[v.id,runLabel(v)]),runId)+
   pick('supportUnit','تطبيق الاختيار على',[['','الصف كاملًا'],...eligible.map(u=>[u.id,unitLabel(u)])],unitId)+'</div>'+
   (eligible.length?'<form data-support-project><div class="kw-grid">'+pick('rule','طريقة ارتكاز الدولاب',[['',unitId?'اتباع الصف والمصنع':'تلقائي من كتالوج المصنع'],...options.map(([k,v])=>[k,v.label+' · '+baseModeNames[v.mode]])],chosen.rule||'')+
   pick('apron','ساتر الأرجل الأمامي',[['',unitId?'اتباع الصف والمصنع':'اتباع تفصيل المصنع'],['none','بدون ساتر'],...names(book.aprons)],chosen.apron||'')+
   input('reference','مرجع معاينة الارتكاز أو مراجعة التثبيت (عند الحاجة)',chosen.reference,'text',false)+'</div><button>حفظ اختيار '+(unitId?'الوحدة':'الصف')+'</button></form>':'')+
   '<ul>'+summary+'</ul>'+(!Object.keys(book.rules).length?'<p>تُضاف تفاصيل الأرجل والقواعد وأصناف السواتر من بوابة المصنع.</p>':'');
 }
 function factorySettings(c){
  const book=c.baseSupport||blank(),isRule=formKind==='rule',group=isRule?book.rules:book.aprons,f=group[which]||{};
  const subtitle=isRule?'تفصيل ارتكاز':'ساتر أمامي',pieces=listItems(c,i=>i.kind==='piece');
  const common=input('id','رمز التفصيل باللاتينية',which)+input('label','اسم التفصيل',f.label)+input('reference','مرجع رسم المصنع أو دليل المورد',f.reference);
  let extra;
  if(isRule){
   const families=Object.entries(c.families).filter(([id,v])=>id!=='dishwasher'&&id!=='upperStorage'&&v.base!=='upperStorage'&&!v.customerBay).map(([k,v])=>[k,v.label]);
   extra=pick('family','عائلة التصنيع',families,f.family)+pick('mode','طريقة الارتكاز',Object.entries(baseModeNames).filter(([k])=>!['unknown','excluded'].includes(k)),method)+
    pick('site','موضع تطبيق التفصيل',[['any','على أي موضع مطابق للمعاينة'],['floor','أرضية الصف العادية'],['platform','فوق تعلية مقاسة تغطي الوحدة']],f.site||'any')+
    input('minWidthMm','أقل عرض مشمول (مم)',f.minWidthMm,'number')+input('maxWidthMm','أكبر عرض مشمول (مم)',f.maxWidthMm,'number')+
    (['legs','suspended'].includes(method)?input('bodyClearMm','فراغ أسفل الجسم فوق منسوب الصف (مم)',f.bodyClearMm,'number')+
    pick('sku',method==='legs'?'صنف الرجل الواحدة':'صنف طقم التثبيت',pieces,f.sku)+input('count',method==='legs'?'عدد الأرجل للوحدة وفق المخطط':'عدد أطقم التثبيت للوحدة',f.count,'number')+
    pick('recipeHeightBasis','مرجع ارتفاعات قطع الجسم والواجهات',[['net','من أسفل الجسم بعد خصم فراغ القاعدة'],['envelope','من ارتفاع الصف الكامل؛ الخصم موجود في سطور الوصفة']],f.recipeHeightBasis||'net')+
    pick('supply','توريد العتاد',[['assembly','أضفه عند تطبيق هذا التفصيل'],['family','محسوب داخل وصفة الجسم']],f.supply||'assembly'):'')+
    pick('apron','قرار الساتر الافتراضي',[['none','بدون ساتر'],...names(book.aprons)],f.apron||'none')+
    field('تطبيق تلقائي على المقاسات المطابقة','<input type="checkbox" name="automatic" '+(f.default?'checked':'')+'>');
  }else{
   const stock=listItems(c,i=>i.kind==='bar'||i.kind==='panel');
   extra=pick('sku','خام الساتر من مخزون المصنع',stock,f.sku)+input('heightMm','ارتفاع الساتر (مم)',f.heightMm,'number')+
    input('insetMm','تراجع وجه الساتر خلف الواجهة (مم)',f.insetMm,'number')+input('thicknessMm','سمك الساتر (مم)',f.thicknessMm,'number')+
    pick('fixing','تثبيت الساتر القابل للفك',[['included','المشابك متضمنة في توريد الساتر'],['separate','مشابك بصنف مستقل']],fixing)+
    (fixing==='separate'?pick('clipSku','صنف المشبك',pieces,f.clipSku)+input('clipsPerUnit','عدد المشابك لكل وحدة وفق المخطط',f.clipsPerUnit,'number'):'');
  }
  return '<p>يستخدم المندوب التفاصيل التي يُدخلها المصنع. يؤخذ عدد الأرجل من مرجع التفصيل، ويُحسب الساتر على الوحدات المتلاصقة التي اختاره العميل لها.</p>'+
   '<div class="kw-grid">'+pick('supportForm','نوع التفصيل',[['rule','ارتكاز الدولاب'],['apron','ساتر قابل للفك']],formKind)+pick('supportWhich',subtitle,[['','إضافة تفصيل جديد'],...names(group)],which)+'</div>'+
   '<form data-support-factory><div class="kw-grid">'+common+extra+'</div><button>حفظ '+subtitle+' في الكتالوج</button></form>';
 }
 function draw(){host.innerHTML=(mode==='factory'?factorySettings(catalog()):projectSettings(getDoc(),catalog()))+'<p role="status" data-support-notice>'+esc(notice)+'</p>';}
 function factoryDraft(f){
  const d=Object.fromEntries(new FormData(f)),isRule=formKind==='rule';
  const r={label:d.label,reference:d.reference};
  if(isRule){
   Object.assign(r,{family:d.family,mode:d.mode,site:d.site,default:d.automatic==='on',apron:d.apron,minWidthMm:Number(d.minWidthMm),maxWidthMm:Number(d.maxWidthMm),bodyClearMm:Number(d.bodyClearMm||0)});
   if(['legs','suspended'].includes(r.mode))Object.assign(r,{sku:d.sku,count:Number(d.count),supply:d.supply,recipeHeightBasis:d.recipeHeightBasis});
  }else{
   Object.assign(r,{sku:d.sku,heightMm:Number(d.heightMm),insetMm:Number(d.insetMm),thicknessMm:Number(d.thicknessMm),fixing:d.fixing});
   if(r.fixing==='separate')Object.assign(r,{clipSku:d.clipSku,clipsPerUnit:Number(d.clipsPerUnit)});
  }
  return {id:d.id.trim(),group:isRule?'rules':'aprons',r};
 }
 function change(ev){
  const t=ev.target;if(!['supportForm','supportWhich','supportRun','supportUnit','fixing','mode'].includes(t.name))return;
  if(t.name==='mode'||t.name==='fixing'){
   // Preserve partially entered fields while revealing only relevant controls.
   const f=t.closest('form'),draft=Object.fromEntries(new FormData(f));
   if(t.name==='mode')method=t.value;else fixing=t.value;draw();
   const next=host.querySelector('form');
   for(const [k,v] of Object.entries(draft)){const el=next.elements.namedItem(k);if(el&&el.type!=='checkbox')el.value=v;}
   if(next.elements.automatic)next.elements.automatic.checked=!!draft.automatic;
   return;
  }
  if(t.name==='supportRun'){runId=t.value;unitId='';}
  if(t.name==='supportUnit')unitId=t.value;
  if(t.name==='supportForm'){formKind=t.value;which='';method='legs';fixing='included';}
  if(t.name==='supportWhich'){
   which=t.value;const b=catalog().baseSupport||blank();method=b.rules[which]?.mode||'legs';fixing=b.aprons[which]?.fixing||'included';
  }
  notice='';draw();
 }
 function submit(ev){
  const f=ev.target;if(!f.matches('[data-support-factory],[data-support-project]'))return;
  ev.preventDefault();ev.stopPropagation();
  const doc=getDoc(),c=catalog();
  if(mode==='factory'){
   const {id,group,r}=factoryDraft(f),book=structuredClone(c.baseSupport||blank());
   if(which&&id!==which||!which&&Object.hasOwn(book[group],id)){report('استخدم رمزًا جديدًا أو اختر التفصيل الموجود للتعديل.');return;}
   if(!/^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(id)||['constructor','prototype','__proto__'].includes(id)){report('أدخل رمز تفصيل صالحًا باللاتينية.');return;}
   book[group][id]=r;
   const clean=cleanBaseSupportBook(book,new Map(c.items.map(i=>[i.sku,i])),c.families);
   if(!clean){report('راجع نطاق العرض ومرجع التفصيل والكمية. يتطابق ارتفاع القطاع مع عرض مقطعه، وسمك الساتر اللوحي مع سمك الخام. لا تتداخل نطاقات تفصيلين تلقائيين للعائلة والموضع نفسيهما.');return;}
   let ok;
   if(update)ok=update(draft=>{draft.baseSupport=clean;});
   else{
    const next=cleanCatalog({...c,revision:c.revision+1,baseSupport:clean,approved:false});
    if(!next){report('تعذّر التحقق من الكتالوج.');return;}
    const result=apply(wp(doc,{...doc.room.workshop,catalog:next}),'حُفظ تفصيل القاعدة في المصنع.');ok=result?.ok!==false&&result?.saved!==false;
   }
   if(!ok){report('تعذّر حفظ تفصيل القاعدة.');return;}
   which=id;
  }else{
   const d=Object.fromEntries(new FormData(f)),data=structuredClone(doc.room.workshop?.baseSupport||{runs:{},units:{}});
   const group=data[unitId?'units':'runs'],id=unitId||runId;group[id]=Object.fromEntries(Object.entries(d).filter(([,v])=>v.trim()).map(([k,v])=>[k,v.trim()]));
   const choices=cleanBaseSupportChoices(data);
   if(!choices){report('راجع مرجع المعاينة والاختيارات.');return;}
   const result=apply(wp(doc,{...doc.room.workshop,baseSupport:choices}),'تحدّث ارتكاز الوحدات وساتر الواجهة.');
   if(result?.ok===false||result?.saved===false){report(result.reason||'تعذّر حفظ اختيار القاعدة.');return;}
  }
  notice=mode==='factory'?'حُفظ التفصيل في كتالوج المصنع.':'حُفظ الاختيار وأعيد حساب الوحدات والساتر.';draw();tell?.(notice);
 }
 function click(ev){
  if(!ev.target.closest('[data-support-prune]'))return;
  const next=pruneBaseSupportChoices(getDoc()),result=apply(next,'أزيلت ارتباطات القواعد التي لم تعد في المشروع.');
  if(result?.ok===false||result?.saved===false)report(result.reason||'تعذّر تنظيف الاختيارات.');else draw();
 }
 host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('submit',submit);draw();
 return ()=>{host.removeEventListener('click',click);host.removeEventListener('change',change);host.removeEventListener('submit',submit);};
}
