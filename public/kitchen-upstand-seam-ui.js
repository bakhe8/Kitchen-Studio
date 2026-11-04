// Surface supply is decided on the customer panel. Splicing an overlength
// factory strip is a separate operation with a wall-station drawing datum.
import {architectureWallLabel} from './kitchen-architecture.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {setUpstandSeamChoice} from './kitchen-worktop-upstand.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const label=s=>architectureWallLabel(s.wall)+' · '+number(s.fromMm)+'–'+number(s.toMm)+' مم';
function lengths(request){
 const bounds=[request.fromMm,...request.choice.stationsMm,request.toMm];
 return bounds.slice(1).map((v,i)=>number(v-bounds[i])+' مم').join(' + ');
}
function stations(value){return value.trim().split(/[\n؛;،]+/).map(s=>assistNumber(s.trim()));}
export function mountStoneSeams(host,{take,snapshot,catalog,getDoc,apply,tell,onSave,focus={},canSave=()=>true}){
 const rows=take.seamRequests||[],orphans=take.orphanSeams||[];
 if(!rows.length&&!orphans.length)return null;
 const root=document.createElement('section');root.className='uw-editor';host.replaceChildren(root);
 let active=rows.find(s=>s.key===focus.seamKey)||rows.find(s=>s.wall===focus.wall&&s.status!=='resolved')||rows.find(s=>s.status!=='resolved')||rows[0],dirty=false;
 const labels=new Map(rows.map(s=>[s.key,label(s)]));
 function draw(){
  dirty=false;
  let html='<header><h4>تحديد وصلات نعلة المصنع</h4></header>';
  if(active){
   if(rows.length>1)html+='<label class="kw-field"><span>قطاع النعلة</span><select data-uw-segment>'+rows.map(s=>'<option value="'+esc(s.key)+'"'+(s.key===active.key?' selected':'')+'>'+esc(labels.get(s.key))+'</option>').join('')+'</select></label>';
   else html+='<b>'+esc(labels.get(active.key))+'</b>';
   html+='<p>الطول المطلوب '+number(active.lengthMm??active.toMm-active.fromMm)+' مم، وطول الخام '+number(active.stockLengthMm)+' مم. يحدّد المصنع موضع كل وصلة على رسم التشغيل.</p>';
   if(active.status==='resolved')html+='<p><b>أطوال القطع المعتمدة</b> <bdi>'+lengths(active)+'</bdi></p>';
   else if(active.reason)html+='<p class="kw-hint">'+esc(active.reason)+'</p>';
   html+='<form data-uw-seam><label class="kw-field"><span>محطة كل وصلة من بداية الجدار (مم)، محطة واحدة في كل سطر</span><textarea dir="ltr" data-uw-stations rows="2" maxlength="720">'+esc((active.choice?.stationsMm||[]).join('\n'))+'</textarea></label>'+
    '<label class="kw-field"><span>مرجع رسم التشغيل أو اعتماد الوصلات</span><input data-uw-ref maxlength="160" value="'+esc(active.choice?.reference||'')+'"></label>'+
    '<div class="kw-actions"><button type="submit">اعتماد مواقع الوصلات</button><button type="button" data-uw-undo hidden>تجاهل التعديل</button>'+
    (active.choice?'<button type="button" data-uw-remove>إزالة تخطيط الوصلات</button>':'')+'</div></form>';
  }
  if(orphans.length)html+='<p>تغيّر القطاع الذي ارتبط به تخطيط سابق. راجع الحصر ثم أزل الارتباط القديم.</p>'+orphans.map((key,i)=>'<button type="button" data-uw-orphan="'+i+'">إزالة تخطيط سابق · '+esc(key)+'</button>').join('');
  root.innerHTML=html+'<p data-uw-msg role="status"></p>';
 }
 const notice=msg=>{root.querySelector('[data-uw-msg]').textContent=msg;tell?.(msg);};
 function save(key,choice){
  if(getDoc()!==snapshot){notice('تغيّر الرسم. أعد فتح قطاع النعلة الحالي.');return;}
  if(!canSave()){notice('احفظ تعديل الشباك أو تجاهله قبل حفظ تخطيط الوصلات.');return;}
  const res=setUpstandSeamChoice(snapshot,catalog,key,choice);
  if(!res.ok){notice(res.reason||'راجع محطات الوصلات ومقاس الخام.');return;}
  const saved=apply(res.doc,choice?'حُفظت محطات الوصلات وأعيد حساب قطع الرخام.':'أُزيل ارتباط تخطيط الوصلات.');
  if(saved?.ok===false||saved?.saved===false){notice(saved.reason||'تعذّر حفظ التخطيط.');return;}
  dirty=false;onSave(key);
 }
 root.oninput=e=>{
  if(!e.target.matches('[data-uw-stations],[data-uw-ref]'))return;
  dirty=true;root.querySelector('[data-uw-undo]').hidden=false;
 };
 root.onchange=e=>{
  if(!e.target.hasAttribute('data-uw-segment'))return;
  if(dirty){e.target.value=active.key;notice('احفظ التعديل أو تجاهله قبل الانتقال إلى قطاع آخر.');return;}
  const m=rows.find(s=>s.key===e.target.value);if(m){active=m;draw();}
 };
 root.onsubmit=e=>{
  if(!e.target.hasAttribute('data-uw-seam'))return;e.preventDefault();e.stopPropagation();
  const raw=root.querySelector('[data-uw-stations]').value,reference=root.querySelector('[data-uw-ref]').value.trim();
  const values=stations(raw);
  if(!reference||!raw.trim()||values.some(v=>v===null)){notice('أدخل محطات الوصلات الفعلية بالملليمتر ومرجع رسم التشغيل.');return;}
  save(active.key,{stationsMm:values,reference});
 };
 root.onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-uw-undo'))draw();
  else if(b.hasAttribute('data-uw-remove'))save(active.key,null);
  else if(b.hasAttribute('data-uw-orphan')){if(dirty){notice('احفظ تخطيط القطاع أو تجاهل تعديله أولًا.');return;}const key=orphans[Number(b.dataset.uwOrphan)];if(key)save(key,null);}
 };
 draw();return {hasDraft:()=>dirty,destroy(){root.remove();}};
}
