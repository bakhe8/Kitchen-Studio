import {assistNumber} from './kitchen-measurement-identity.js';
import {cleanMeasureFit,evaluateMeasureFit,bindMeasureCheck} from './kitchen-measure-fit.js';
import {roomArchitecture} from './kitchen-architecture.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const axes={width:'عرض الوحدة',height:'ارتفاعها',depth:'عمقها',closure:'إغلاق سلسلة الجدار'};
const field=(k,l,type='text')=>'<label>'+l+'<input name="'+k+'" type="'+type+'" '+(type==='number'?'min="0" step="any"':'maxlength="180"')+'></label>';
const option=(a,b)=>'<option value="'+esc(a)+'">'+esc(b)+'</option>';
export function mountMeasureFit(host,{getDoc,apply,tell}){
 const ctl=new AbortController();const state=()=>getDoc().room.workshop?.measureFit||{instruments:[],checks:[]};
 let axis=getDoc().kitchen.units.length?'width':'closure';const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
 function draw(){
  const d=getDoc(),s=state(),results=evaluateMeasureFit(d),tools=s.instruments.map(i=>option(i.id,i.label)).join('');
  const axesList=Object.entries(axes).map(([a,l])=>'<option value="'+a+'" '+(a===axis?'selected':'')+'>'+l+'</option>').join('');
  const targets=axis==='closure'?roomArchitecture(d.room).walls.map(w=>option(w.id,w.label)):d.kitchen.units.map(u=>option(u.id,u.id+' · '+u.width*10+' مم'));
  host.innerHTML='<h2>سماح القياس والتركيب</h2><p>عرّف الأداة مرة. حدّد الفتحات أو الجدران الحرجة فقط، فيحسب البرنامج أسوأ فرق ممكن من القراءات وحدود دقة الجهاز وسماحية المصنع.</p><details class="ws-card" '+(!tools?'open':'')+'><summary>أدوات القياس ('+s.instruments.length+')</summary>'+s.instruments.map(i=>'<p>'+esc(i.label)+' · ± ('+i.fixedMm+' مم + '+i.perMetreMm+' مم/م) · '+esc(i.spec)+'</p>').join('')+
   '<form data-tool class="site-form-group">'+field('label','اسم أو رقم الأداة')+field('spec','مرجع مواصفة الدقة أو المعايرة')+field('fixed','حد الخطأ الثابت بالملليمتر','number')+field('metre','الجزء المتناسب مم لكل متر (أدخل صفرًا إذا ثبت ذلك)','number')+'<button>إضافة الأداة</button></form></details>'+
   '<label>ما الذي نتحقق منه؟<select data-axis>'+axesList+'</select></label>'+
   (tools?'<form class="ws-card" data-rule><fieldset class="site-form-group"><legend>المرجع وحدود الدقة</legend><label>المرجع في الرسم<select name="target">'+targets.join('')+'</select></label>'+field('reference','اسم الفحص ومرجع السماح')+'<label>أداة القراءة<select name="tool">'+tools+'</select></label>'+
    (axis==='closure'?'<label>أداة قطع سلسلة الجدار<select name="chainTool">'+tools+'</select></label>':field('allowance','خلوص التركيب المطلوب من المصنع · مم','number'))+
    field('tolerance',axis==='closure'?'أقصى فرق إغلاق مسموح · مم':'الزيادة التصنيعية القصوى للوحدة · مم','number')+
    '</fieldset><fieldset class="site-form-group"><legend>قراءات الموقع</legend><label>'+(axis==='closure'?'قراءة مستقلة لطول الجدار':'الفتحة الصافية بعد التشطيب')+'<textarea name="readings" rows="3" placeholder="وسط | 602"></textarea></label><small>كل سطر: اسم الموضع | القيمة بالملليمتر. كرّر الاسم للقراءات المستقلة في الموضع نفسه. ويمكن كتابة @ ثم معرّف قراءة رقمية من سجل الفني بدل الرقم.</small></fieldset>'+(!targets.length?'<p class="site-prereq">يتطلب هذا الفحص وحدة في الرسم. لفحص جدار فقط اختر إغلاق سلسلة الجدار.</p>':'')+'<button '+(targets.length?'':'disabled')+'>حفظ الفحص وحسابه</button></form>':'')+
    s.checks.map(c=>{const r=results.results.find(v=>v.id===c.id);return '<div class="ws-card site-fit-result" data-status="'+(r?.status==='ok'?'ok':'hold')+'"><span>'+(r?.status==='ok'?'ضمن السماح':'يحتاج مراجعة')+'</span><b>'+esc(c.reference)+'</b><p>'+esc(r?.why||((r?.status==='ok'?'مطابق':'معلّق')+' · '+(c.axis==='closure'?'أسوأ فرق محتمل '+r?.worstMm+' مم':'المتاح عند أضيق موضع '+r?.availableMin+' إلى '+r?.availableMax+' مم، المطلوب '+r?.neededMm+' مم')))+'</p><button data-del="'+esc(c.id)+'">إزالة الفحص</button></div>';}).join('');
 }
 function save(s){const clean=cleanMeasureFit(s);if(!clean){tell('راجع المراجع والقراءات والدقة والسماح. أدخل صفرًا صراحةً عند انطباقه.');return;}const doc=getDoc(),r=apply({...doc,room:{...doc.room,workshop:{...doc.room.workshop,measureFit:clean}}},'حُفظ فحص السماح.');if(r?.ok!==false)draw();}
 host.addEventListener('change',e=>{if(e.target.hasAttribute('data-axis')){axis=e.target.value;draw();}},{signal:ctl.signal});
 host.addEventListener('click',e=>{const k=e.target.closest('[data-del]')?.dataset.del;if(k)save({...state(),checks:state().checks.filter(c=>c.id!==k)});},{signal:ctl.signal});
 host.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),s=state(),str=k=>String(f.get(k)||'').trim(),n=k=>assistNumber(str(k))??NaN;
  if(e.target.hasAttribute('data-tool')){save({...s,instruments:[...s.instruments,{id:id(),label:str('label'),spec:str('spec'),fixedMm:n('fixed'),perMetreMm:n('metre')}]});return;}
  const readings=str('readings').split(/\n+/).map(v=>{const [station,value]=v.split('|').map(x=>x.trim());return {station,instrument:str('tool'),...(value?.startsWith('@')?{recordId:value.slice(1)}:{mm:assistNumber(value)??NaN})};});
  save({...s,checks:[...s.checks,bindMeasureCheck(getDoc(),{id:id(),target:str('target'),axis,reference:str('reference'),toleranceMm:n('tolerance'),allowanceMm:axis==='closure'?0:n('allowance'),chainInstrument:str('chainTool'),readings})]});
 },{signal:ctl.signal});draw();return ()=>ctl.abort();
}
