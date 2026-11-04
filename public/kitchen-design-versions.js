// Versions of the design that the customer approved, and the record of what changed between them (INS-07: changes after approval).
// An approval itself only keeps a fingerprint, so each customer approval also writes a version: who, when, the price, a compact list of
// the units, and (after the first) why the customer asked for the change. The next change is then described against that version.
import {kitchenUnitSpecs} from './kitchen-model.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {kitchenFrontFinishes} from './kitchen-materials.js';
import {factoryFrontSurfaces,frontAppearanceSource} from './kitchen-render-factory-fronts.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {customerSheetStyle} from './kitchen-customer-sheet-style.js';
import {cleanVersions,versionLimit} from './kitchen-design-version-clean.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numbers=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const num=n=>Number.isFinite(n)?numbers.format(n):'—';
const mm=n=>num(n)+' مم';
const sar=n=>Number.isFinite(n)?num(n)+' ر.س':'بانتظار اكتمال التسعير';
const day=ms=>new Intl.DateTimeFormat('ar-SA',{calendar:'gregory',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Riyadh'}).format(new Date(ms));
const unitWord=n=>n===1?'وحدة واحدة':n===2?'وحدتان':num(n)+(n>=3&&n<=10?' وحدات':' وحدة');
const wallLabels=doc=>new Map(roomArchitecture(doc.room).walls.map(w=>[w.id,w.label]));
const where=(u,labels)=>(u.wall?labels.get(u.wall)||u.wall:'الجزيرة')+(u.tier?' · '+(u.tier==='upper'?'علوي':'سفلي'):'');

// The name of the front each unit has, the way the customer's report names it.
function frontNames(doc){
 const cat=getFactoryCatalog(doc),items=new Map(cat.items.map(i=>[i.sku,i])),out=new Map();
 const fronts=factoryFrontSurfaces(doc.kitchen,frontAppearanceSource(doc.room.workshop));
 for(const u of doc.kitchen.units){
  const resolved=fronts.get(u.id),item=resolved&&items.get(resolved.sku);
  if(item?.kind==='panel'&&item.role==='front')out.set(u.id,String(item.name||item.sku).slice(0,80));
  else if(u.frontColor||kitchenFrontFinishes[u.frontFinish])out.set(u.id,((kitchenFrontFinishes[u.frontFinish]?.label||'لون مخصص')+(u.frontColor?' '+u.frontColor:'')).slice(0,80));
 }
 return out;
}
export function unitSnapshot(doc){
 const w=doc.room.workshop||{},catalog=readWorkshopCatalog(w),runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const entries=new Map(Object.values(w.rows||{}).flatMap(row=>row.units||[]).map(e=>[e.id,e]));
 const fronts=frontNames(doc);
 return doc.kitchen.units.map((u,i)=>{
  const r=runs.get(u.runId),entry=entries.get(u.id),kind=kitchenUnitSpecs[u.kind]?.label||u.kind;
  const label=entry?.use||(entry?.family==='rice'?'درج الأرز':catalog?.families?.[entry?.recipeId]?.label||kind);
  return {id:u.id,code:'U'+(i+1),label:String(label).slice(0,80),wall:r?.wall||'',tier:r?.tier==='upper'?'upper':r?.tier==='base'?'base':'',
   startMm:Math.round(u.u*10),widthMm:Math.round(u.width*10),front:fronts.get(u.id)||''};
 });
}
const versionTotal=quote=>quote?.complete&&Number.isFinite(quote.total)?Math.round(quote.total*100)/100:null;

// What differs between two lists of units. Ids pair the units; a unit that only slid along its wall because a neighbour changed is
// counted, not listed.
export function diffUnits(before,after){
 const was=new Map(before.map(u=>[u.id,u])),now=new Map(after.map(u=>[u.id,u]));
 const diff={added:after.filter(u=>!was.has(u.id)),removed:before.filter(u=>!now.has(u.id)),resized:[],retyped:[],refinished:[],moved:[],shifted:0};
 for(const u of after){
  const p=was.get(u.id);if(!p)continue;
  if(p.widthMm!==u.widthMm)diff.resized.push({before:p,after:u});
  if(p.label!==u.label)diff.retyped.push({before:p,after:u});
  if(p.front!==u.front)diff.refinished.push({before:p,after:u});
  if(p.wall!==u.wall||p.tier!==u.tier)diff.moved.push({before:p,after:u});
  else if(p.startMm!==u.startMm&&p.widthMm===u.widthMm)diff.shifted++;
 }
 return diff;
}
export const hasUnitChanges=d=>!!(d.added.length||d.removed.length||d.resized.length||d.retyped.length||d.refinished.length||d.moved.length||d.shifted);
const grouped=(items,key)=>{const by=new Map();for(const it of items){const k=key(it);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}return [...by.values()];};
export function describeChanges(diff,labels,{limit=12}={}){
 const lines=[];
 for(const {before:p,after:u} of diff.resized)lines.push('تغيّر عرض '+u.code+' «'+u.label+'» من '+mm(p.widthMm)+' إلى '+mm(u.widthMm));
 for(const u of diff.added)lines.push('أُضيفت «'+u.label+'» ('+mm(u.widthMm)+') على '+where(u,labels));
 for(const u of diff.removed)lines.push('أُزيلت «'+u.label+'» ('+u.code+'، '+mm(u.widthMm)+') من '+where(u,labels));
 // The same change made to several units (all the fronts turned another colour) is one line that names them.
 const listed=g=>g.map(x=>x.after.code).slice(0,8).join('، ')+(g.length>8?'…':'');
 for(const g of grouped(diff.retyped,({before:p,after:u})=>p.label+'→'+u.label)){
  const {before:p,after:u}=g[0];
  lines.push(g.length===1?'تغيّر نوع '+u.code+' من «'+p.label+'» إلى «'+u.label+'»':'تغيّر نوع '+unitWord(g.length)+' من «'+p.label+'» إلى «'+u.label+'» ('+listed(g)+')');
 }
 for(const g of grouped(diff.refinished,({before:p,after:u})=>p.front+'→'+u.front)){
  const {before:p,after:u}=g[0],was=p.front||'بلا اختيار',now=u.front||'بلا اختيار';
  lines.push(g.length===1?'تغيّرت واجهة '+u.code+' من «'+was+'» إلى «'+now+'»':'تغيّرت واجهة '+unitWord(g.length)+' من «'+was+'» إلى «'+now+'» ('+listed(g)+')');
 }
 for(const {before:p,after:u} of diff.moved)lines.push('انتقلت '+u.code+' «'+u.label+'» من '+where(p,labels)+' إلى '+where(u,labels));
 if(diff.shifted)lines.push('تزحزح موضع '+unitWord(diff.shifted)+' على جدارها بسبب التعديلات');
 return {lines:lines.slice(0,limit),more:Math.max(0,lines.length-limit)};
}
export function priceChange(before,after){
 const delta=Number.isFinite(before)&&Number.isFinite(after)?Math.round((after-before)*100)/100:null;
 return {before,after,delta,text:delta===null?'فرق السعر بانتظار اكتمال التسعير':delta===0?'بقي السعر كما هو':(delta>0?'زيادة ':'انخفاض ')+sar(Math.abs(delta))};
}

export function makeVersion({doc,state,quote,name,date,reason=''}){
 const w=doc.room.workshop||{},versions=w.versions||[];
 return {n:versions.length+1,date,name,key:state.keys.customer,total:versionTotal(quote||state.quote),reason:String(reason).trim().slice(0,400),released:!!w.approvals?.release,units:unitSnapshot(doc)};
}
// Recording the customer's approval also records the version. A change after an earlier version needs its reason.
export function recordCustomerVersion({doc,state,quote,name,reason='',date=new Date().toISOString()}){
 const w=doc.room.workshop||{},versions=w.versions||[],last=versions.at(-1);
 if(last&&last.key===state.keys.customer)return {ok:false,reason:'هذا الإصدار معتمد بالفعل (رقم '+num(last.n)+'). لا توجد تغييرات تحتاج اعتمادًا جديدًا.'};
 if(last&&!String(reason).trim())return {ok:false,reason:'اكتب سبب التعديل أو ما طلبه العميل قبل تسجيل الموافقة.'};
 if(versions.length>=versionLimit)return {ok:false,reason:'بلغ سجل الإصدارات حدّه ('+num(versionLimit)+' إصدارًا).'};
 const version=makeVersion({doc,state,quote,name,date,reason});
 if(!cleanVersions([...versions,version]))return {ok:false,reason:'تعذّر تسجيل الإصدار: بيانات الوحدات غير صالحة.'};
 const approvals={...w.approvals,customer:{name,key:state.keys.customer,date}};
 return {ok:true,version,doc:{...doc,room:{...doc.room,workshop:{...w,approvals,versions:[...versions,version]}}}};
}

// ---------- the card on the approvals screen ----------
const listItems=items=>'<ul class="dv-changes">'+items.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';
function changesBlock(doc,last,state,quote){
 const labels=wallLabels(doc),diff=diffUnits(last.units,unitSnapshot(doc)),{lines,more}=describeChanges(diff,labels);
 const price=priceChange(last.total,versionTotal(quote||state.quote));
 const priceBox='<div class="dv-price"><span>السعر المعتمد <b>'+esc(sar(last.total))+'</b></span><span>السعر الآن <b>'+esc(sar(price.after))+'</b></span><strong>'+esc(price.text)+'</strong></div>';
 const listed=lines.length?listItems(lines)+(more?'<p class="ws-subtle">و'+esc(num(more))+' تغييرات أخرى.</p>':''):
  '<p class="ws-subtle">لا يظهر تغيير في الوحدات. تغيّرت بيانات أخرى في التصميم أو الأسعار أو الخامات؛ راجع الاعتمادات أعلاه.</p>';
 return '<h4>ما تغيّر منذ الإصدار '+esc(num(last.n))+'</h4>'+listed+priceBox;
}
export function versionsCardHTML({doc,state,quote}){
 const w=doc.room.workshop||{},versions=w.versions||[],last=versions.at(-1);
 let status,body='';
 if(!last){
  status=w.approvals?.customer?'اعتماد بلا إصدار مسجّل':'لا إصدار معتمد';
  body='<p class="ws-subtle">'+(w.approvals?.customer?'اعتماد سابق بلا لقطة للمقارنة. يبدأ سجل الإصدارات من اعتماد العميل التالي.':'يبدأ سجل الإصدارات عند تسجيل موافقة العميل. كل تعديل بعد ذلك يُقارَن بالإصدار المعتمد.')+'</p>';
 }else{
  const same=state.keys.customer===last.key;
  status=same?'الإصدار '+num(last.n)+' معتمد':'تعديل بانتظار الاعتماد';
  body='<p>آخر إصدار معتمد <b>رقم '+esc(num(last.n))+'</b> · باسم '+esc(last.name)+' · '+esc(day(Date.parse(last.date)))+' · '+esc(sar(last.total))+'</p>'+
   (same?'<p class="ws-subtle">لا توجد تغييرات منذ هذا الإصدار.</p>':changesBlock(doc,last,state,quote)+
    (w.approvals?.release?'<p class="dv-warn">سبق إطلاق إصدار للتصنيع. أبلغ المصنع بهذا التعديل ليراجع ما اشتُري أو قُصّ قبل أن يوافق العميل.</p>':'')+
    '<button type="button" class="ws-action" data-ws-action="preview-change" data-version="pending">معاينة ورقة التعديل</button>');
 }
 const history=versions.length?'<details class="dv-history"><summary>سجل الإصدارات ('+esc(num(versions.length))+')</summary><ol>'+[...versions].reverse().map(v=>
  '<li><b>الإصدار '+esc(num(v.n))+'</b> · '+esc(day(Date.parse(v.date)))+' · وافق '+esc(v.name)+' · '+esc(sar(v.total))+(v.reason?'<br><span>السبب: '+esc(v.reason)+'</span>':'')+
  (v.n>1?' <button type="button" class="ws-action" data-ws-action="preview-change" data-version="'+esc(v.n)+'">ورقة التعديل</button>':'')+'</li>').join('')+'</ol></details>':'';
 return '<article class="ws-card dv-card"><header><h3>إصدارات التصميم</h3><span class="ws-state">'+esc(status)+'</span></header>'+body+history+'</article>';
}
// Shown beside the customer's approval only when this approval will be a change to an earlier version.
export function reasonFieldHTML({doc,state}){
 const last=(doc.room.workshop?.versions||[]).at(-1);
 if(!last||last.key===state.keys.customer)return '';
 return '<label class="dv-reason">سبب التعديل أو ما طلبه العميل<textarea data-ws-reason maxlength="400" rows="3" placeholder="مثال: طلب العميل توسيع الوحدة بجانب الموقد وتغيير لون الواجهات"></textarea></label>';
}

// ---------- the sheet the customer can read and sign ----------
function reportMark(){return '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#20463d"/><g fill="none" stroke="#edcf96" stroke-width="1.5" stroke-linejoin="round"><path d="m16 5 10 5.5v11L16 27 6 21.5v-11zM6 10.5 16 16l10-5.5M16 16v11"/><path d="m11 8 10 5.5"/></g></svg>';}
const sheetStyle=customerSheetStyle+`
.change-sheet{padding-block:30px 22px;display:grid;gap:20px}.change-sheet h1{font-size:30px;line-height:1.3}
.change-sheet .kicker{color:var(--warm);font-weight:700}.change-sheet .state{color:var(--muted)}
.change-sheet .meta{display:flex;flex-wrap:wrap;gap:6px 26px;color:var(--muted);font-size:14px}
.change-sheet section{border-top:1px solid var(--line);padding-top:14px}.change-sheet h2{font-size:19px;margin-bottom:8px}
.change-sheet ul{margin:0;padding-inline-start:22px;display:grid;gap:6px}
.change-sheet .reason{background:var(--ks-attention-soft);border-inline-start:4px solid var(--ks-attention);padding:10px 14px;border-radius:var(--ks-radius-control);white-space:pre-wrap}
.change-sheet .price{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.change-sheet .price div{border:1px solid var(--line);border-radius:var(--ks-radius-control);padding:12px 14px}.change-sheet .price small{display:block;color:var(--muted)}.change-sheet .price strong{font-size:20px}
.change-sheet .warn{background:var(--ks-attention-soft);border-inline-start:4px solid var(--ks-attention);padding:10px 14px;border-radius:var(--ks-radius-control)}
.change-sheet .sign{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}.change-sheet .sign div{border-top:1px solid var(--ks-line);padding-top:6px;min-height:64px;color:var(--muted)}
@media(max-width:720px){.change-sheet .price,.change-sheet .sign{grid-template-columns:1fr}}
@media print{.change-sheet{padding-block:8px}.change-sheet section{break-inside:avoid}}`;
export function changeSheetHTML({doc,version,previous,pending=false}){
 const labels=wallLabels(doc),name=doc.room.name||'مشروع المطبخ';
 const diff=diffUnits(previous?.units||[],version.units),{lines,more}=describeChanges(diff,labels,{limit:40});
 const price=priceChange(previous?.total??null,version.total);
 const revision='D-'+version.key.slice(0,14).toUpperCase();
 const status=pending?'تعديل مقترح بانتظار موافقة العميل':'معتمد من العميل';
 const title='ورقة تعديل · '+name+' · الإصدار '+num(version.n);
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>'+sheetStyle+'</style></head>'+
  '<body data-design-revision="'+esc(revision)+'" data-report-name="ورقة-تعديل-المطبخ-الإصدار-'+esc(version.n)+'" data-report-title="معاينة ورقة التعديل">'+
  '<header class="mast"><div class="brand">'+reportMark()+'<span>استوديو المطابخ</span></div><button type="button" class="print" onclick="window.print()">طباعة / PDF</button></header>'+
  '<main class="change-sheet"><div><p class="kicker">ورقة تعديل بعد الاعتماد</p><h1>'+esc(name)+'</h1><p class="state">الإصدار '+esc(num(version.n))+(previous?' بدل الإصدار '+esc(num(previous.n)):'')+' · '+esc(status)+'</p></div>'+
  '<div class="meta"><span>رقم المشروع <bdi>'+esc(doc.room.projectId||'—')+'</bdi></span><span>التاريخ '+esc(day(Date.parse(version.date)))+'</span>'+(pending?'':'<span>وافق باسم العميل '+esc(version.name)+'</span>')+'<span>نسخة التصميم <bdi>'+esc(revision)+'</bdi></span></div>'+
  '<section><h2>سبب التعديل</h2>'+(version.reason?'<p class="reason">'+esc(version.reason)+'</p>':'<p class="state">لم يُكتب سبب بعد.</p>')+'</section>'+
  '<section><h2>ما الذي تغيّر</h2>'+(lines.length?'<ul>'+lines.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+(more?'<p class="state">و'+esc(num(more))+' تغييرات أخرى.</p>':''):'<p class="state">لا يظهر تغيير في الوحدات؛ التغيير في الخامات أو الأسعار أو بيانات أخرى.</p>')+'</section>'+
  '<section><h2>أثر السعر</h2><div class="price"><div><small>السعر المعتمد سابقًا</small><strong>'+esc(sar(price.before))+'</strong></div><div><small>السعر بعد التعديل</small><strong>'+esc(sar(price.after))+'</strong></div><div><small>الفرق</small><strong>'+esc(price.text)+'</strong></div></div></section>'+
  (version.released?'<section class="warn"><strong>سبق إطلاق إصدار للتصنيع.</strong> يُبلغ المصنع بهذا التعديل ليراجع ما اشتُري أو قُصّ قبل متابعة الإنتاج.</section>':'')+
  '<section><h2>الموافقة</h2><div class="sign"><div>اسم العميل وتوقيعه'+(pending?'':' — '+esc(version.name))+'</div><div>التاريخ</div><div>المندوب</div><div>ملاحظات</div></div></section></main>'+
  '<footer><strong>استوديو المطابخ</strong><span>'+esc(status)+'</span><bdi>'+esc(revision)+'</bdi></footer></body></html>';
}
// The sheet of a recorded version, or of the change that is waiting for approval.
export function sheetFor({doc,state,quote,which,reason='',date=new Date().toISOString()}){
 const versions=doc.room.workshop?.versions||[];
 if(which==='pending'){
  const previous=versions.at(-1);
  return changeSheetHTML({doc,previous,pending:true,version:makeVersion({doc,state,quote,name:'',date,reason})});
 }
 const n=Number(which),version=versions.find(v=>v.n===n);
 return version?changeSheetHTML({doc,version,previous:versions.find(v=>v.n===n-1)}):null;
}
