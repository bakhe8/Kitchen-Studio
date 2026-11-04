import {evaluateTapChecks,saveTapCheck} from './kitchen-tap-window.js';
import {kitchenGeometry} from './kitchen-model.js';
import {verifiedPattern} from './kitchen-surface-pattern.js';
import {assistNumber} from './kitchen-measurement-identity.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(k,text,active)=>'<option value="'+esc(k)+'" '+(k===active?'selected':'')+'>'+esc(text)+'</option>';
const number=(name,label,value)=>'<label>'+label+'<input name="'+name+'" inputmode="decimal" value="'+esc(value)+'"></label>';
const text=(name,label,value)=>'<label>'+label+'<input name="'+name+'" maxlength="180" value="'+esc(value)+'"></label>';
const select=(name,label,entries,active)=>'<label>'+label+'<select name="'+name+'">'+entries.map(([k,v])=>option(k,v,active)).join('')+'</select></label>';
const dims={duMm:'إزاحة محور الجزء بطول الصف (مم)',ddMm:'إزاحة محوره نحو واجهة الصف (مم)',reachMm:'البعد الأقصى عن محوره في المسقط (مم)',radiusMm:'نصف عرض الغلاف في المسقط (مم)',bottomMm:'أدنى ارتفاع للجزء عن قاعدة الخلاط (مم)',topMm:'أعلى ارتفاع له عن القاعدة (مم)',fromDeg:'اتجاه البداية من محور الصف (درجة)',travelDeg:'مجال الحركة نحو العمق الموجب (درجة، حتى ٣٦٠)'};
const sashFields={planeMm:'بعد محور المفصلة عن وجه الجدار داخليًا',lowerInsetMm:'من أسفل البرواز إلى أسفل الضلفة',leafHeightMm:'ارتفاع الضلفة المتحركة',thickMm:'سماكة الضلفة الكاملة',handleMm:'أقصى بروز عتادها عن الضلفة',openDeg:'زاوية الفتح الفعلية القصوى بالدرجات'};
const mountFields={uMm:'من بداية وحدة المجلى إلى مركز فتحة الخلاط',dMm:'من خلف الصف إلى مركز الفتحة',diameterMm:'قطر الفتحة المقاسة',minDiameterMm:'أقل قطر فتحة يقبله الموديل',maxDiameterMm:'أكبر قطر فتحة يقبله الموديل',deckRiseMm:'ارتفاع سطح تثبيت الخلاط فوق سطح العمل'};
const empty=()=>({sinkId:'',windowId:'',model:'',reviewer:'',manual:'',source:'',mount:{kind:'deck',hole:''},sash:{},neck:{mode:'unknown'},lever:{mode:'unknown'}});
export function mountTapWindow(host,{getDoc,apply,tell,onAdvance,focus={}}){
 const ctl=new AbortController(),signal=ctl.signal;let d=empty(),selected='';
 const saved=()=>getDoc().room.workshop?.tapChecks||[];
 const pair=r=>r.sinkId+'/'+r.windowId;
 if(focus.sinkId&&getDoc().kitchen.units.some(u=>u.id===focus.sinkId&&u.kind==='sink')){
  const checks=saved().filter(v=>v.sinkId===focus.sinkId&&(!focus.windowId||v.windowId===focus.windowId));
  if(checks.length===1){d=structuredClone(checks[0]);selected=pair(d);}
  else{d.sinkId=focus.sinkId;if(getDoc().kitchen.features.some(f=>f.kind==='window'&&f.id===focus.windowId))d.windowId=focus.windowId;}
 }
 function change(k,v){const keys=k.split('.');let obj=d;for(const p of keys.slice(0,-1))obj=obj[p];obj[keys.at(-1)]=v;}
 function read(){for(const el of host.querySelectorAll('input,select')){if(el.name==='choose')continue;change(el.name,el.inputMode==='decimal'?assistNumber(el.value):el.value);}}
 const clone=v=>JSON.parse(JSON.stringify(v));
 function arm(k,label){
  const a=d[k];const opts=[['unknown','لم يُحدّد'],...(k==='lever'?[['none','الموديل بلا ذراع ظاهرة']]:[]),['fixed','غلاف ثابت'],['swivel','غلاف يتحرك حول محور رأسي']];
  return '<fieldset><legend>'+label+'</legend>'+select(k+'.mode','نوع الحركة الموثّق',opts,a.mode)+(['fixed','swivel'].includes(a.mode)?'<div class="ws-inline">'+Object.entries(dims).filter(([n])=>n!=='travelDeg'||a.mode==='swivel').map(([n,l])=>number(k+'.'+n,l,a[n])).join('')+'</div>':'')+'</fieldset>';
 }
 let openedSections=new Set(['mount']);
 function draw(){
  const doc=getDoc(),g=kitchenGeometry(doc.kitchen,doc.room),sinks=g.units.filter(u=>u.kind==='sink'),windows=g.features.filter(f=>f.kind==='window'),u=sinks.find(u=>u.id===d.sinkId),t=u&&g.worktops.find(t=>t.runId===u.runId&&t.start<=u.u&&t.end>=u.u+u.width);
  const pattern=t&&verifiedPattern(doc,t),holes=pattern?.holes.filter(h=>h.shape==='circle'&&h.id.startsWith('extra:'))||[];
  const result=evaluateTapChecks(doc);
  if((!sinks.length||!windows.length)&&!saved().length){
   host.innerHTML='<section class="ws-card dp-tap-empty"><h3>فحص حركة الخلاط والشباك</h3><p>اختر المجلى والشباك المقابل من المشروع لحساب الخلوص عند الفتح.</p><dl><div><dt>وحدة المجلى</dt><dd>'+ (sinks.length?'موجودة على الرسم':'أضف مجلى إلى التوزيع')+'</dd></div><div><dt>الشباك</dt><dd>'+(windows.length?'موجود في الرفع':'سجّل موضع الشباك وبروازه')+'</dd></div></dl>'+(onAdvance?'<button type="button" data-tap-route="'+(!windows.length?'survey':'whole')+'">'+(!windows.length?'فتح رفع الجدار':'فتح تصميم المطبخ')+'</button>':'')+'</section>';return;
  }
  const sheet=(key,title,body)=>'<details class="dp-tap-section" data-tap-section="'+key+'" '+(openedSections.has(key)?'open':'')+'><summary>'+title+'</summary>'+body+'</details>';
  host.innerHTML='<h3>الخلاط وفتح الشباك</h3><p>يفحص البرنامج حركة الضلفة الجانبية المحددة مع جسم الخلاط والعنق والذراع. ابدأ بموديل الخلاط ومصدر المقاسات. كل مسافة بالملليمتر وكل زاوية بالدرجات. الصفر اتجاه زيادة المحطة على الصف و٩٠° باتجاه واجهته.</p>'+
   select('choose','فحص محفوظ',[['','فحص جديد'],...saved().map(r=>[pair(r),r.model+' · '+r.sinkId+' / '+r.windowId])],selected)+'<form class="dp-tap-form">'+select('sinkId','وحدة المجلى',[['','اختر المجلى'],...sinks.map(u=>[u.id,u.id])],d.sinkId)+
   select('windowId','الشباك من رفع الموقع',[['','اختر الشباك'],...windows.map(f=>[f.id,f.id+' · '+f.wall])],d.windowId)+text('model','موديل الخلاط',d.model)+text('manual','دليل الموديل وصفحة الحركة والتركيب',d.manual)+text('source','مرجع قياس الشباك وموضع الخلاط',d.source)+text('reviewer','اسم الفني المراجع',d.reviewer)+
   sheet('mount','موضع القاعدة على السطح',select('mount.kind','مرجع الفتحة',[['deck','فتحة مقاسة على منصة المجلى'],['digital','فتحة دائرية إضافية في قالب سطح العمل']],d.mount.kind)+
   (d.mount.kind==='digital'?select('mount.hole','فتحة القالب المقاس',[['','اختر الفتحة'],...holes.map(h=>[h.id,h.id+' · '+h.modelRef])],d.mount.hole):'')+
   '<div class="ws-inline">'+Object.entries(mountFields).filter(([k])=>d.mount.kind==='deck'||!['uMm','dMm','diameterMm'].includes(k)).map(([k,l])=>number('mount.'+k,l,d.mount[k])).join('')+
   number('bodyRadiusMm','نصف قطر الغلاف الثابت للقاعدة والجسم',d.bodyRadiusMm)+number('bodyHeightMm','ارتفاع الجسم الثابت',d.bodyHeightMm)+number('clearanceMm','الفاصل الأدنى الموثق بين الخلاط والضلفة',d.clearanceMm)+'</div>')+
   sheet('sash','الضلفة التي تفتح للداخل','<p>تُؤخذ جهة المفصلة وعرض الضلفة وبُعد المفصلة عن البرواز من رفع الشباك.</p><div class="ws-inline">'+Object.entries(sashFields).map(([k,l])=>number('sash.'+k,l,d.sash[k])).join('')+'</div>')+sheet('arms','حركة العنق وذراع التشغيل',arm('neck','عنق الخلاط')+arm('lever','ذراع التشغيل'))+
   '<button>حفظ الفحص وإعادة حساب الخلوص</button></form>'+result.results.map(v=>'<article class="ws-card"><b>'+esc(v.sinkId)+' / '+esc(v.windowId)+'</b>'+v.parts.map(p=>'<p>'+p.label+' · أدنى خلوص محافظ '+p.clearanceMm+' مم</p>').join('')+'<p>'+esc(v.issues.join(' ')||'تتحقق مسافة الفصل ضمن حدود الحركة والمقاسات المدخلة.')+'</p><button type="button" data-remove-tap="'+esc(v.sinkId+'/'+v.windowId)+'">إزالة فحص هذا الزوج</button></article>').join('');
 }
 host.addEventListener('change',e=>{
  if(e.target.name==='choose'){selected=e.target.value;d=clone(saved().find(r=>pair(r)===selected)||empty());draw();return;}
  if(e.target.matches('select')){openedSections=new Set([...host.querySelectorAll('[data-tap-section][open]')].map(n=>n.dataset.tapSection));read();if(e.target.name==='sinkId')d.mount.hole='';draw();}
 },{signal});
 host.addEventListener('submit',e=>{
  e.preventDefault();read();if(!d.sinkId||!d.windowId){tell('حدّد المجلى والشباك من الرسم أولًا.');return;}
  const v=clone(d);for(const [k,defs] of [['mount',mountFields],['sash',sashFields],['neck',dims],['lever',dims]])for(const n of Object.keys(defs))v[k][n]??=null;
  for(const k of ['bodyRadiusMm','bodyHeightMm','clearanceMm'])v[k]??=null;
  for(const k of ['neck','lever'])if(v[k].mode==='fixed')v[k].travelDeg=0;
  const out=saveTapCheck(getDoc(),v);if(!out.ok){tell(out.reason);return;}
  if(apply(out.doc,'حُفظ فحص الخلاط والضلفة المحددة.')?.ok!==false){selected=pair(v);d=clone(saved().find(r=>pair(r)===selected)||v);draw();}
 },{signal});host.addEventListener('click',e=>{const route=e.target.closest('[data-tap-route]')?.dataset.tapRoute;if(route){onAdvance?.(route);return;}const p=e.target.closest('[data-remove-tap]')?.dataset.removeTap;if(!p)return;const doc=getDoc(),ws=doc.room.workshop;
  if(apply({...doc,room:{...doc.room,workshop:{...ws,tapChecks:saved().filter(r=>pair(r)!==p)}}},'أزيل فحص الخلاط والشباك.')?.ok!==false){selected='';d=empty();draw();}
 },{signal});draw();return ()=>ctl.abort();
}
