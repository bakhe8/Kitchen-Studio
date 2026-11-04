import {mountProcurementPanel} from './kitchen-procurement-ui.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>n==null?'غير مجرود':new Intl.NumberFormat('ar-SA').format(n);
const managesStock=role=>role==='owner'||role==='store';
const reqId=()=>globalThis.crypto?.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(4)),v=>v.toString(16).padStart(8,'0')).join('-');
async function api(path,params={},post=null){
 const r=await fetch(path+'?'+new URLSearchParams(params),{method:post?'POST':'GET',credentials:'same-origin',cache:'no-store',...(post?{headers:{'Content-Type':'application/json','X-Studio-Request':'1'},body:JSON.stringify(post)}:{})});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('سجّل الدخول للوصول إلى المخزون المشترك.');
 const body=await r.json();if(!r.ok)throw Error(body.error||'تعذّر الوصول إلى خدمة المخزون.');return body;
}
export function mountInventoryStep(host,{getDoc,tell}){
 let versions=[],version=0,cats=[],projects=[],stock={stocks:[],reservations:[]},cat='',project='',sku='',receipt='',count='',note='',rs='',receipts=[],claim=null,working=false,closed=false,status='',retry=null;
 const countDrafts=new Map();
 const sel=(v,key)=>String(v)===String(key)?' selected':'';
 const option=(v,label,chosen)=>'<option value="'+safe(v)+'"'+sel(v,chosen)+'>'+safe(label)+'</option>';
 const btn=(a,l,off=false)=>'<button type="button" data-inv-act="'+a+'"'+(off?' disabled':'')+'>'+l+'</button>';
 const ref=()=>receipts.find(x=>(x.revision+':'+(x.kind==='whole'?'whole':x.design_key))===receipt);
 function render(){
  if(closed)return;
  const owned=managesStock(stock.role),cur=stock.stocks.find(x=>x.key===sku),selected=stock.reservations.find(x=>x.reservation===rs);
  host.innerHTML='<h2>مخزون المصنع المشترك</h2><div class="kf-select-bar">'+
   '<label>كتالوج الفريق<select data-inv="cat">'+options(cats,x=>x.id,x=>x.name,cat)+'</select></label>'+btn('refresh','تحديث المخزون')+(versions.length?'<label>أصناف إصدار الكتالوج<select data-inv="version">'+options(versions,x=>x.version,x=>'الإصدار '+x.version,version)+'</select></label>':'')+
   '</div><p role="status" class="kf-connection">'+safe(status||(working?'جارٍ قراءة الرصيد…':cat?'أرصدة الإصدار المحدد':'اختر كتالوجًا مشتركًا'))+'</p>'+
   (cat?'<article class="ws-card kf-stock"><h3>بطاقة رصيد الصنف</h3><label>الصنف ومقاس الخام<select data-inv="sku">'+options(stock.stocks,x=>x.key,x=>x.sku+' · '+x.name,sku)+'</select></label>'+
   (cur?'<dl class="kf-balances"><div><dt>الرصيد الفعلي</dt><dd>'+f(cur.physical)+'</dd></div><div><dt>محجوز</dt><dd>'+f(cur.held)+'</dd></div><div><dt>متاح للحجز</dt><dd>'+f(cur.free)+'</dd></div></dl>':'')+
   (owned?'<label>العدد الفعلي الكامل بعد الجرد أو التوريد<input type="number" min="0" max="1000000" step="1" data-inv="count" value="'+safe(count)+'"></label>':'')+'</article>':'')+
   (owned?'<label>مرجع الجرد أو إذن المخزون<input maxlength="240" data-inv="note" value="'+safe(note)+'"></label>'+btn('count','تسجيل العدد الفعلي',!cur)+
   '<article class="ws-card"><h3>حجز خام لإيصال صادر</h3><label>المشروع المحفوظ<select data-inv="project">'+options(projects,x=>x.id,x=>x.name,project)+'</select></label><label>الإيصال<select data-inv="receipt">'+options(receipts,x=>x.revision+':'+(x.kind==='whole'?'whole':x.design_key),x=>'نسخة '+x.revision+' · '+(x.kind==='whole'?'إفراج نهائي':'دفعة '+x.design_key.slice(0,9)),receipt)+'</select></label>'+btn('preview','اعرض الكميات قبل الحجز',!ref())+
   (claim?'<ul class="kf-stock-claim">'+claim.lines.map(l=>'<li data-state="'+(l.free==null?'attention':l.free<l.qty?'blocked':'ready')+'">'+(stock.stocks.some(s=>s.key===l.key)?'<button type="button" data-stock-key="'+safe(l.key)+'">'+safe(l.name)+' · '+safe(l.sku)+'</button>':safe(l.name))+' · مطلوب '+f(l.qty)+' / متاح '+f(l.free)+'</li>').join('')+'</ul>'+btn('reserve','تأكيد حجز كامل النطاق',claim.lines.some(l=>l.free==null||l.free<l.qty)):'')+'</article>'+
   '<article class="ws-card"><label>الحجوزات القائمة<select data-inv="rs">'+options(stock.reservations.filter(r=>r.state==='reserve'),x=>x.reservation,x=>(projects.find(y=>y.id===x.project)?.name||'مشروع')+' · نسخة '+x.revision+' · '+x.created,rs)+'</select></label>'+btn('cancel','إلغاء الحجز وإتاحة الخام',!selected)+' '+btn('consume','إثبات صرف الخام من الرصيد',!selected)+'</article><details><summary>آخر حركات الجرد والحجز والصرف</summary><ol>'+(stock.history||[]).map(x=>'<li>'+safe(({count:'جرد',reserve:'حجز',cancel:'إلغاء',consume:'صرف',policy:'سياسة توريد',purchase:'أمر شراء',delivery:'وارد فعلي','po-close':'إغلاق متبقي شراء'})[x.kind])+' · '+safe(x.note)+' · '+safe(x.created)+'</li>').join('')+'</ol></details>':'');
  if(owned&&!working){
   const slot=document.createElement('article');slot.className='ws-card';host.append(slot);
   mountProcurementPanel(slot,{stock,selected:sku,version,project,receipt:ref(),reqId,send:b=>api('/api/inventory',{id:cat},b),reload:()=>work(async()=>{await refresh();status='حُفظت حركة التوريد وحدّث الرصيد.';})});
  }
  if(working)host.querySelectorAll('button,select,input').forEach(el=>el.disabled=true);
 }
 function options(rows,key,label,chosen){return rows.map(x=>option(key(x),label(x),chosen)).join('');}
 async function loadReceipts(){
  const p=project,c=cat;receipts=[];const loaded=project?(await api('/api/inventory',{id:cat,project})).receipts:[];if(closed||p!==project||c!==cat)return;receipts=loaded;
  receipt=receipts.some(x=>x.revision+':'+(x.kind==='whole'?'whole':x.design_key)===receipt)?receipt:receipts.length?receipts[0].revision+':'+(receipts[0].kind==='whole'?'whole':receipts[0].design_key):'';
 }
 async function refresh(initialize=false){
  stock={stocks:[],reservations:[]};receipts=[];claim=null;
  if(initialize){const [c,p]=await Promise.all([api('/api/catalogs'),api('/api/projects')]);if(closed)return;cats=c.catalogs.filter(x=>managesStock(x.role));projects=p.projects.filter(x=>managesStock(x.role));cat=cats.find(x=>x.id===(cat||readWorkshopCatalog(getDoc().room.workshop)?.teamSource?.id))?.id||cats[0]?.id||'';project=projects.some(x=>x.id===project)?project:projects[0]?.id||'';}
  versions=cat?(await api('/api/catalogs',{id:cat,action:'versions'})).versions:[];
  version=versions.some(v=>v.version===version)?version:versions[0]?.version||0;
  stock=cat?await api('/api/inventory',{id:cat,...(version?{version}:{} )}):{stocks:[],reservations:[]};sku=stock.stocks.some(x=>x.key===sku)?sku:stock.stocks[0]?.key||'';
  rs=stock.reservations.find(x=>x.reservation===rs&&x.state==='reserve')?.reservation||stock.reservations.find(x=>x.state==='reserve')?.reservation||'';
  if(managesStock(stock.role))await loadReceipts();else receipts=[];claim=null;
 }
 async function work(fn){working=true;render();try{await fn();}catch(e){status=e.message;tell?.(status);}finally{working=false;render();}}
 function chooseStock(key){
  if(!stock.stocks.some(s=>s.key===key))return;
  countDrafts.set(sku,count);sku=key;count=countDrafts.get(key)||'';retry=null;render();
 }
 function input(e){const k=e.target.dataset.inv;if(k==='note')note=e.target.value;if(k==='count')count=e.target.value;}
 function change(e){
  const k=e.target.dataset.inv;if(!k||working||k==='note'||k==='count')return;
  const v=e.target.value;if(k==='sku'){chooseStock(v);return;}claim=null;retry=null;
  if(k==='cat'){if(!cats.some(x=>x.id===v))return;countDrafts.clear();count='';cat=v;version=0;work(()=>refresh());return;}if(k==='version'){if(!versions.some(x=>x.version===Number(v)))return;countDrafts.clear();count='';version=Number(v);work(()=>refresh());return;}if(k==='project'){if(!projects.some(x=>x.id===v))return;project=v;work(loadReceipts);return;}if(k==='receipt')receipt=v;if(k==='rs')rs=v;render();
 }
 function click(e){
  const item=e.target.closest('[data-stock-key]');
  if(item&&!working){chooseStock(item.dataset.stockKey);host.querySelector('[data-inv="sku"]')?.focus();return;}
  const a=e.target.closest('[data-inv-act]')?.dataset.invAct;if(!a||working)return;
  if(!['refresh','count','preview','reserve','cancel','consume'].includes(a)||a!=='refresh'&&!managesStock(stock.role))return;
  work(async()=>{
   if(a==='refresh'){await refresh(true);status='تم تحديث السجل.';return;}
   const target=ref();if(a!=='preview'&&!note.trim())throw Error('أدخل رقم المستند أو سبب الحركة أولًا.');
   const body={action:a,note:a==='preview'?'معاينة':note.trim()};
   if(a==='count'){
    const cur=stock.stocks.find(x=>x.key===sku);if(!cur||!count.trim()||!Number.isSafeInteger(Number(count))||Number(count)<0)throw Error('أدخل العدد الفعلي الصحيح.');
    Object.assign(body,{version,key:sku,physical:Number(count),expected:cur.physical});
   }else if(a==='preview'||a==='reserve'){if(!target)throw Error('اختر إيصالًا.');Object.assign(body,{project,revision:target.revision,scope:target.kind==='whole'?'whole':target.design_key});}
   else Object.assign(body,{reservation:rs});
   const key=JSON.stringify([cat,body]);if(!retry||retry.key!==key)retry={key,request:reqId()};
   const data=await api('/api/inventory',{id:cat},{...body,request:retry.request});retry=null;
   if(a==='preview'){claim=data;status='هذه معاينة. يجري اختبار الأرصدة مرة أخرى عند التأكيد.';return;}
   countDrafts.delete(sku);count='';note='';await refresh();status='سُجلت حركة المخزون مرة واحدة.';
  });
 }
 host.addEventListener('input',input);host.addEventListener('change',change);host.addEventListener('click',click);
 work(async()=>{await refresh(true);status=cats.length?'':'انشر كتالوجًا مشتركًا أولًا.';});
 return ()=>{closed=true;host.removeEventListener('input',input);host.removeEventListener('change',change);host.removeEventListener('click',click);};
}
