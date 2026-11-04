import {pipeProfile,pipeStatus} from './kitchen-site-diagrams.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {cleanPipeRoutes,attestPipeRoute,evaluatePipeRoutes} from './kitchen-pipe-routes.js';
const html=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const names={gravity:'صرف بالجاذبية',pumped:'تصريف بمضخة',duct:'مجرى هواء الشفاط'};
const choice=(val,label,current)=>'<option value="'+html(val)+'" '+(val===current?'selected':'')+'>'+html(label)+'</option>';
const inp=(k,l,v='',num=false)=>'<label>'+l+'<input name="'+k+'" value="'+html(v)+'" '+(num?'type="number" min="0" step="any"':'maxlength="180"')+'></label>';
export function mountPipeRoutes(host,{getDoc,apply,tell}){
 const ac=new AbortController();let active='',kind='gravity';
 const source=()=>getDoc().room.workshop?.pipeRoutes||[];
 function draw(){
  const doc=getDoc(),all=source(),r=all.find(v=>v.id===active)||{},f=doc.kitchen.features.filter(v=>v.kind===(kind==='duct'?'vent':'drain'));
  const hasTargets=doc.kitchen.units.length>0&&f.length>0;
  const pointText=r.points?.map((p,i)=>[...p,...(i>0&&i<r.points.length-1&&r.fittings?.[i-1]!=null?[r.fittings[i-1]]:[])].join(', ')).join('\n')||'';
  host.innerHTML='<h2>مسار الصرف أو الشفاط</h2><p>اربط الوحدة بمخرجها، ثم سجّل مسار التنفيذ للتحقق من مواصفة الجهاز.</p><div class="site-route-tools"><label>المسارات<select data-active>'+choice('','مسار جديد',active)+all.map(v=>choice(v.id,v.source,active)).join('')+'</select></label><label>النوع<select data-kind>'+Object.entries(names).map(([k,v])=>choice(k,v,kind)).join('')+'</select></label></div><form class="site-pipe-form"><fieldset class="site-form-group"><legend>نقطتا الربط</legend><label>الوحدة<select name="unitId">'+doc.kitchen.units.map(u=>choice(u.id,u.id+' · '+u.kind,r.unitId)).join('')+'</select></label><label>مخرج الموقع<select name="featureId">'+f.map(f=>choice(f.id,f.id+' · '+f.wall,r.featureId)).join('')+'</select></label>'+
   (!hasTargets?'<p class="site-prereq">'+(!doc.kitchen.units.length?'أضف وحدة في تصميم المطبخ. ':'')+(!f.length?(kind==='duct'?'سجّل فتحة الشفاط على الجدار.':'سجّل مخرج الصرف على الجدار.'):'')+'</p>':'')+'</fieldset><fieldset class="site-form-group"><legend>مرجع التنفيذ وحدود المواصفة</legend>'+inp('source','مرجع المسار المقاس',r.source)+inp('manual','مرجع الموديل أو مواصفة المختص',r.manual)+inp('reviewer','الفني المراجع',r.reviewer)+inp('pipeMm','القطر الداخلي الفعلي',r.pipeMm,true)+inp('minPipeMm','أقل قطر مطلوب في المواصفة',r.minPipeMm,true)+inp('maxRunMm','حد الطول المسموح من المواصفة',r.maxRunMm,true)+inp('datumToleranceMm','سماحية مطابقة نقاط المخرج مع الرفع',r.datumToleranceMm,true)+
  (kind==='gravity'?inp('minSlopePct','أقل ميل هابط مطلوب (%)',r.minSlopePct,true):kind==='pumped'?inp('maxHeadMm','أقصى رفع مسموح للمضخة',r.maxHeadMm,true):'')+
  '</fieldset><div class="site-pipe-points"><label>نقاط المسار من الوحدة إلى المخرج · مم<small>X يمينًا، Y ارتفاعًا، Z للأمام. لكل سطر ثلاث قيم، ويمكن إضافة طول الوصلة للنقطة الداخلية. منسوب الصرف عند قاع الماسورة الداخلي.</small><textarea name="points" rows="5" dir="ltr">'+html(pointText)+'</textarea></label><div data-route-profile>'+pipeProfile(pointText)+'</div><p class="site-diagram-status" role="status" data-route-feedback>'+pipeStatus(pointText)+'</p></div><button '+(hasTargets?'':'disabled')+'>حفظ المسار وفحصه</button></form>'+
  evaluatePipeRoutes(doc).results.map(v=>'<div class="ws-card"><b>'+html(all.find(a=>a.id===v.id)?.source)+'</b><p>طول فعلي '+v.developedMm+' مم · مكافئ '+v.equivalentMm+' مم · أعلى رفع '+v.peakMm+' مم</p><p>'+html(v.issues.join(' ')||'ضمن الحدود المدخلة لهذا المسار.')+'</p><button data-delete="'+html(v.id)+'">إزالة هذا المسار</button></div>').join('');
 }
 function commit(all){const d=getDoc(),r=apply({...d,room:{...d.room,workshop:{...d.room.workshop,pipeRoutes:all}}},'تحدّث مسار التجهيز.');if(r?.ok!==false)draw();}
 host.addEventListener('input',e=>{
  if(e.target.name!=='points')return;
  host.querySelector('[data-route-profile]').innerHTML=pipeProfile(e.target.value);
  const node=host.querySelector('[data-route-feedback]'),status=pipeStatus(e.target.value);
  if(node.textContent!==status)node.textContent=status;
 },{signal:ac.signal});
 host.addEventListener('change',e=>{if(e.target.hasAttribute('data-active')){active=e.target.value;kind=source().find(v=>v.id===active)?.kind||'gravity';draw();}if(e.target.hasAttribute('data-kind')){kind=e.target.value;draw();}},{signal:ac.signal});
 host.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(b){active='';commit(source().filter(v=>v.id!==b.dataset.delete));}},{signal:ac.signal});
 host.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),str=k=>String(f.get(k)||'').trim(),n=k=>assistNumber(str(k))??NaN;
  const pts=str('points').split(/\n+/).map(s=>s.trim().split(/[,،\s]+/).map(v=>assistNumber(v)??NaN));
  if(pts.some((v,i)=>v.length<3||v.length>(i===0||i===pts.length-1?3:4))){tell('كل نقطة تحتاج ثلاثة إحداثيات، والداخلية تقبل طول الوصلة كقيمة رابعة.');return;}
  const r={id:active||('route-'+Date.now().toString(36)),kind,...Object.fromEntries(['unitId','featureId','source','manual','reviewer'].map(k=>[k,str(k)])),...Object.fromEntries(['pipeMm','minPipeMm','maxRunMm','datumToleranceMm','minSlopePct','maxHeadMm'].map(k=>[k,n(k)])),points:pts.map(v=>v.slice(0,3)),fittings:pts.slice(1,-1).map(v=>v[3]??null)};
  const v=attestPipeRoute(getDoc(),r);if(!v){tell('راجع القيم والمراجع والوحدة ومخرج الموقع قبل حفظ المسار.');return;}active=v.id;commit([...source().filter(p=>p.id!==v.id),v]);
 },{signal:ac.signal});draw();return ()=>ac.abort();
}
