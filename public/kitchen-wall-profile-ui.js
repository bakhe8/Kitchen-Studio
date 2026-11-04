import {roomArchitecture} from './kitchen-architecture.js';
import {parseWallXYZ,fitWallBand,saveScanDraft,reviewScanBand,removeScanBand} from './kitchen-wall-profile.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const field=(k,label,value='',number=false)=>'<label>'+esc(label)+'<input name="'+k+'" value="'+esc(value)+'" '+(number?'type="number" step="any" min="0"':'maxlength="120"')+'></label>';
const button=(k,label)=>'<button type="button" data-scan-act="'+k+'">'+esc(label)+'</button>';
const format='unit=mm\naxes=X:right,Y:up,Z:front\norigin=rear-left-finished-floor\nreference=اسم ملف الرفع الميداني\nback 600 300 5\nback 1200 300 9\nback 600 900 8\nback 1200 900 14';
export function mountWallProfiles(host,{getDoc,apply,tell}){
 const ctrl=new AbortController();let imported='',draft=null,chosen='';
 function render(){
  const doc=getDoc(),s=doc.room.workshop?.wallProfiles||{sources:{},bands:[]},wallList=roomArchitecture(doc.room).walls;
  let wall=doc.room.workshop?.activeWall||wallList[0]?.id;
  const b=s.bands.find(v=>v.id===chosen),fit=b?fitWallBand(doc,s.sources[b.sourceId],b):null;
  host.innerHTML='<h2>مسح الجدار واستقامته</h2><p>استورد نقاطًا مسجلة أصلًا بمحاور الغرفة، ومسماة بمعرّفات جدران الرسم. يعيد البرنامج إسقاط كل نقطة على جدارها ويحسب البروز عند محطات وارتفاعات متعددة. لأكبر بروز مقاس يدويًا استخدم «ميل الجدار» في تبويب رفع الجدار.</p>'+
  '<details><summary>تنسيق ملف XYZ المسمى</summary><p>حدد mm أو m في الترويسة. الإحداثيات مرتبة X يمينًا، Y ارتفاعًا من الأرض المشطبة، Z للأمام، ونقطة الصفر عند مرجع المستطيل الحاوي. بعد اسم الجدار يأتي X ثم Y ثم Z. هذا مثال على صيغة الحقول فقط.</p><pre dir="ltr">'+esc(format)+'</pre></details>'+
  '<form class="ws-card" data-scan><fieldset class="site-form-group"><legend>ملف نقاط الرفع</legend><label>فتح ملف النقاط<input type="file" accept=".xyz,.txt,.csv,text/plain" data-scan-file></label><label>أو الصق الترويسة والنقاط<textarea rows="6" name="raw" dir="ltr" maxlength="160000">'+esc(imported)+'</textarea></label>'+
  '</fieldset><fieldset class="site-form-group"><legend>الحيز المراد فحصه</legend><label>معرّف الجدار في الملف<select name="wall">'+wallList.map(w=>'<option '+(w.id===wall?'selected':'')+' value="'+w.id+'">'+esc(w.label)+' · '+w.id+'</option>').join('')+'</select></label>'+
  field('low','حد الشريحة السفلي من الأرض بالملليمتر','',true)+field('high','حد الشريحة العلوي بالملليمتر','',true)+'</fieldset><fieldset class="site-form-group"><legend>معايير التغطية والمطابقة</legend>'+field('pitchX','أكبر مسافة تغطية أفقية تقبلها للخلية بالملليمتر','',true)+field('pitchY','أكبر مسافة تغطية رأسية تقبلها للخلية بالملليمتر','',true)+field('tol','إبراز النقاط التي يتجاوز انحرافها عن السطح الملائم هذا المقدار بالملليمتر','',true)+'</fieldset>'+button('preview','حساب المطابقة والتغطية')+'<div data-scan-preview></div></form>'+
  (s.bands.length?'<section class="ws-card"><h3>الشرائح المسجلة</h3>'+s.bands.map(k=>'<p>'+esc(k.wall)+' · '+fmt(k.low)+'–'+fmt(k.high)+' مم · '+(k.review?'معاينة موثقة':'مسودة')+' <button type="button" data-choose-scan="'+k.id+'">التفاصيل والتحقق</button></p>').join('')+'</section>':'')+
  (b?'<section class="ws-card"><h3>توثيق أكبر بروز عبر كامل الشريحة</h3>'+(fit?.ok?stats(fit):esc(fit?.reason))+
  field('bound','الحد المحافظ عبر الشريحة حسب معاينة الفني، مم',b.review?.boundMm,true)+field('who','اسم الفني',b.review?.name)+field('ref','مرجع تحقق مستقل وتغطية ما بين العينات',b.review?.ref)+
  '<label><input name="attest" type="checkbox"> تأكدت من محور الجدار وأطراف الشريحة وأكبر بروز بين محطات القياس</label>'+button('attest','اعتماد الحيز وتحديث الجدار')+' '+button('remove','إزالة شريحة المسح')+'</section>':'');
 }
 function stats(f){return '<div class="site-scan-results"><h3>'+esc(f.reference)+'</h3><dl><div><dt>أكبر بروز</dt><dd>'+fmt(f.peakMm)+' مم</dd></div><div><dt>النقاط المقاسة</dt><dd>'+fmt(f.n)+'</dd></div><div><dt>نطاق الجدار</dt><dd>'+fmt(f.from)+'–'+fmt(f.to)+' مم</dd></div></dl><p>الميل الطولي '+fmt(f.slopeX*1000)+' مم/م، والميل الرأسي '+(f.slopeY==null?'غير محسوم':fmt(f.slopeY*1000)+' مم/م')+'. أقصى باقي '+fmt(f.maxResidual)+' مم، والجذر التربيعي لمتوسط مربعات البواقي '+fmt(f.rms)+' مم. عدد النقاط فوق الحد الذي طلبته '+fmt(f.outliers)+'. تبقى هذه النقاط داخلة في أكبر بروز.</p><p>خلايا غير مغطاة '+fmt(f.missing)+' من '+fmt(f.cellCount)+' · '+(f.bandOK?'يمكن طلب التحقق الميداني':'لا تكفي هذه العيّنات لاعتماد حيز متصل')+'.</p></div>';}
 const find=n=>host.querySelector('[name="'+n+'"]'),value=n=>find(n).value.trim(),readNum=n=>value(n)===''?null:Number(value(n));
 host.addEventListener('input',e=>{if(e.target.closest('form')){draft=null;const preview=host.querySelector('[data-scan-preview]');if(preview)preview.replaceChildren();}},{signal:ctrl.signal});
 host.addEventListener('change',async e=>{if(!e.target.matches('[data-scan-file]'))return;const f=e.target.files?.[0];if(!f)return;
  if(f.size>260000){tell('ملف كبير. قسّمه حسب الغرفة أو الجدار.');return;}const raw=await f.text();if(ctrl.signal.aborted)return;const result=parseWallXYZ(raw);if(!result.ok){tell(result.reason);return;}
  imported=raw;find('raw').value=raw;draft=null;host.querySelector('[data-scan-preview]').replaceChildren();tell('قُرئت '+fmt(result.points)+' نقطة. حدّد الشريحة ومعايير التغطية.');},{signal:ctrl.signal});
 host.addEventListener('submit',e=>{e.preventDefault();host.querySelector('[data-scan-act="preview"]').click();},{signal:ctrl.signal});
 host.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const doc=getDoc(),job=btn.dataset.scanAct;
  if(btn.dataset.chooseScan){chosen=btn.dataset.chooseScan;render();return;}
  if(job==='preview'){const b={wall:value('wall'),low:readNum('low'),high:readNum('high'),pitchX:readNum('pitchX'),pitchY:readNum('pitchY'),tol:readNum('tol')};imported=value('raw');const f=fitWallBand(doc,imported,b);
   if(!f.ok){draft=null;tell(f.reason);return;}draft={doc,b,raw:imported};host.querySelector('[data-scan-preview]').innerHTML=stats(f)+button('save','حفظ نتيجة المسح كمسودة');return;}
  let result,msg;
  if(job==='save'&&draft){if(doc!==draft.doc){tell('تغيّر الرسم. أعد المعاينة.');return;}result=saveScanDraft(doc,draft.raw,draft.b);msg='حُفظ الملف الأصلي ونتيجة الشريحة للمراجعة.';if(result.ok)chosen=result.band.id;}
  if(job==='attest'){if(!find('attest').checked){tell('يلزم تحقق ميداني من الحيز الكامل.');return;}
   result=reviewScanBand(doc,chosen,{boundMm:readNum('bound'),ref:value('ref'),name:value('who')});msg='أضيف الحيز المحافظ للجدار على الارتفاعات المحددة فقط.';}
  if(job==='remove'){result=removeScanBand(doc,chosen);msg='أُزيلت الشريحة والحيز المرتبط بها. يمكن التراجع.';}
  if(!result)return;if(!result.ok){tell(result.reason);return;}if(apply(result.doc,msg)?.ok===false)return;draft=null;if(job==='remove')chosen='';render();
 },{signal:ctrl.signal});
 render();return ()=>ctrl.abort();
}
