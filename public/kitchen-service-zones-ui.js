import {zoneElevation} from './kitchen-site-diagrams.js';
import {roomArchitecture,architectureWall} from './kitchen-architecture.js';
import {cleanServiceZones,evaluateServiceZones,serviceClasses,serviceMountSignature,serviceOpeningSignature,zoneKinds} from './kitchen-service-zones.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(a,b,v)=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>';
const select=(id,label,values,value)=>'<label>'+esc(label)+'<select name="'+id+'">'+values.map(([a,b])=>option(a,b,value)).join('')+'</select></label>';
const text=(id,label,value,num=false)=>'<label>'+esc(label)+'<input name="'+id+'" value="'+esc(value)+'" '+(num?'type="number" step="any" inputmode="decimal"':'maxlength="160"')+'></label>';
const action=(id,label)=>'<button type="button" data-z-action="'+id+'">'+esc(label)+'</button>';
const empty={zones:[],mounts:{}};
export function mountServiceZones(host,{getDoc,apply,tell}){
 const ctl=new AbortController();let edit=null,zoneType='access',service='valve',selectedUnitId=null,openingUnit=null,openingZone=null;
 const raw=()=>getDoc().room.workshop?.serviceZones||empty;
 const read=()=>Object.fromEntries([...host.querySelectorAll('form[data-zone] [name]')].map(el=>[el.name,el.value]));
 const mergeDraft=()=>{const draft=read();edit={...edit,...draft};};
 function render(){
  const doc=getDoc(),s=raw(),walls=roomArchitecture(doc.room).walls,z=edit||{},wall=z.wall||doc.room.workshop?.activeWall||walls[0].id;
  const {issues,lighting}=evaluateServiceZones(doc);
  const drivers=s.zones.filter(i=>i.kind==='access'&&i.service==='driver');
  const unitList=doc.kitchen.units.filter(u=>doc.kitchen.runs.find(r=>r.id===u.runId)?.wall);
  const unit=unitList.find(u=>u.id===selectedUnitId)||unitList[0],m=unit?s.mounts?.[unit.id]:null;
  const servicePorts=s.zones.filter(q=>q.kind==='access');
  const chosenZone=servicePorts.find(q=>q.id===openingZone)||servicePorts[0], candidates=chosenZone?unitList.filter(u=>['sink','storage','open-shelf'].includes(u.kind)&&doc.kitchen.runs.find(r=>r.id===u.runId)?.wall===chosenZone.wall):[];
  const inside=candidates.find(u=>u.id===openingUnit)||candidates[0],port=inside?s.openings?.[chosenZone.id+'|'+inside.id]:null;
  host.innerHTML='<h2>حيز الخدمات والتثبيت والإنارة</h2><p>أضف ما يؤثر في هذا المطبخ من دليل جهاز أو رفع ميداني. قِس على وجه الجدار من بدايته، والارتفاع من الأرض المشطبة. جميع الأطوال بالملليمتر.</p>'+
   '<details class="ws-card site-zone-register" '+(s.zones.length?'open':'')+'><summary>الخدمات المسجلة · '+new Intl.NumberFormat('ar-SA').format(s.zones.length)+'</summary>'+(s.zones.length?s.zones.map(i=>'<p><b>'+esc(i.name)+'</b> · '+esc(zoneKinds[i.kind])+' · '+esc(architectureWall(doc.room,i.wall)?.label||i.wall)+' <button type="button" data-zone-edit="'+i.id+'">تعديل</button> <button type="button" data-zone-remove="'+i.id+'">إزالة</button></p>').join(''):'<p>لا توجد نطاقات مسجلة.</p>')+'</details>'+
   '<form class="ws-card site-zone-form" data-zone><h3>'+((edit&&s.zones.some(x=>x.id===edit.id))?'تعديل عنصر':'إضافة عنصر')+'</h3><fieldset class="site-form-group"><legend>موقع التجهيز وتعريفه</legend>'+
   select('wall','الجدار',walls.map(w=>[w.id,w.label]),wall)+select('kind','طريقة التعامل',Object.entries(zoneKinds),zoneType)+select('service','التجهيز',Object.entries(serviceClasses),service)+
   text('name','اسم في المشروع',z.name)+text('ref','مرجع القياس أو دليل الموديل',z.ref)+'</fieldset><div data-zone-elevation>'+zoneElevation(doc.room,wall,s.zones,{...z,kind:zoneType})+'</div><fieldset class="site-form-group"><legend>الحدود الفعلية على الجدار · مم</legend>'+text('startMm','بداية الامتداد على الجدار',z.startMm,true)+text('endMm','نهاية الامتداد على الجدار',z.endMm,true)+
   text('bottomMm',zoneType==='light'?'ارتفاع أول نقطة':'منسوب الحافة السفلى',z.bottomMm,true)+text('topMm',zoneType==='light'?'ارتفاع النقطة الأخيرة':'منسوب الحافة العليا',z.topMm,true)+
   (zoneType==='solid'||zoneType==='access'?text('depthMm','بروز الجسم أو كامل عمق الحيز الذي يحتاجه الفني',z.depthMm,true):'')+
   (zoneType==='light'?text('wattsPerM','واط لكل متر من دليل الشريط، اختياري',z.wattsPerM,true)+select('driverId','محوّل هذا المقطع، إذا كان ضمن المشروع',[['','غير مربوط'],...drivers.map(i=>[i.id,i.name])],z.driverId):'')+
   (zoneType==='access'&&service==='driver'?text('capacityW','قدرة الخرج الموثقة للمحوّل بالواط، اختياري',z.capacityW,true):'')+
   '</fieldset><div class="ws-inline">'+action('save','حفظ العنصر وفحص الرسم')+action('clear','بدء عنصر جديد')+'</div></form>'+
   (s.zones.some(i=>i.kind==='noDrill')&&unit?'<section class="ws-card"><h3>مخطط تثبيت الوحدة</h3><p>موضع كل ثقب في رسم الورشة بالملليمتر من بداية الوحدة وأسفلها. يمكن توثيق استقلال وحدة سفلية عن الحائط. الوحدة المعلّقة تحتاج نقاطًا محددة.</p>'+
   select('mountUnit','الوحدة',unitList.map(u=>[u.id,u.id+' · '+(doc.kitchen.runs.find(r=>r.id===u.runId)?.wall||'')]),unit.id)+
   select('mountMode','أسلوب التثبيت',[['wall','ثقوب في الجدار'],['free','سفلية مستقلة حسب رسم المصنع']],m?.mode)+text('drawing','مرجع مخطط التثبيت المعتمد',m?.drawing)+
   '<label>كل سطر يمثل ثقبًا بصيغة المسافة الأفقية ثم الرأسية، مثل ١٥٠، ٧٠٠<textarea name="points" rows="3">'+esc(m?.points.map(p=>p.join(', ')).join('\n')||'')+'</textarea></label>'+action('mount','حفظ مخطط التثبيت')+'</section>':'')+
   (servicePorts.length?'<details class="ws-card"><summary>توثيق فتحة صيانة فعلية داخل وحدة</summary><p>للوحدة الموجودة على الرسم ذات باب قابل للفتح أو الفك. أدخل قياسات الفتحة الصافية ومسافة المرور التي راجعها الفني حتى الجدار. يؤثر هذا التوثيق في الوحدة المحددة فقط.</p>'+
   select('openingZone','حيز الخدمة',servicePorts.map(q=>[q.id,q.name]),chosenZone?.id)+(inside?select('openingUnit','وحدة الخدمة',candidates.map(u=>[u.id,u.id]),inside.id)+
   text('drawingOpen','مرجع رسم ومسار الفتحة',port?.drawing)+[['start','بداية الفتحة من بداية الوحدة'],['end','نهاية الفتحة من بداية الوحدة'],['bottom','بداية الارتفاع من أسفل جسم الوحدة'],['top','نهاية الارتفاع من أسفل الجسم'],['depth','عمق الحيز المفتوح الفعلي حتى التجهيز']].map(([k,label])=>text('port-'+k,label,port?.[k],true)).join('')+
   '<label><input name="reviewed" type="checkbox"> تحقق الفني ميدانيًا من مرور الخدمة دون فك جسم الدولاب ووفق دليل التجهيز</label>'+action('opening','حفظ قياسات فتحة الصيانة'):'<p>اختر حيزًا على جدار به وحدة حوض أو تخزين أو رف مفتوح.</p>')+'</details>':'')+
   '<section class="ws-card"><h3>نتيجة المراجعة الحالية</h3>'+(issues.length?'<ul>'+issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>':'<p>لا يوجد تعارض محسوب للنطاقات المسجلة مع الرسم الحالي.</p>')+
   (lighting.length?'<h4>حصر مقاطع الإنارة المسجلة</h4><ul>'+lighting.map(l=>'<li>'+esc(l.name)+' · '+(l.lengthMm/1000).toFixed(3)+' م · '+(l.powerW===null?'القدرة غير مسجلة':l.powerW.toFixed(2)+' واط')+(l.driver?' · '+esc(l.driver):'')+'</li>').join('')+'</ul>':'')+
   '<small>تحتاج أحمال الدوائر الكهربائية والمخارج والاشتراطات المتخصصة مراجعة المختص.</small></section>';
 }
 function commit(s,msg){
  if(!cleanServiceZones(s)){tell('راجع الأطوال والمراجع والقيم العددية في النموذج.');return false;}
  const d=getDoc(),r=apply({...d,room:{...d.room,workshop:{...d.room.workshop,serviceZones:s}}},msg);return r?.ok!==false;
 }
 const asNum=v=>v==null||String(v).trim()===''?null:Number(v);
 function previewZone(){const v=read(),box=host.querySelector('[data-zone-elevation]');if(box)box.innerHTML=zoneElevation(getDoc().room,v.wall,raw().zones,{...v,id:edit?.id});}
 host.addEventListener('input',e=>{if(['startMm','endMm','bottomMm','topMm'].includes(e.target.name))previewZone();},{signal:ctl.signal});
 host.addEventListener('change',e=>{
  if(e.target.name==='wall'){previewZone();return;}
  if(e.target.name==='openingUnit'||e.target.name==='openingZone'){if(e.target.name==='openingUnit')openingUnit=e.target.value;else openingZone=e.target.value;mergeDraft();render();return;}
  if(e.target.name==='mountUnit'){selectedUnitId=e.target.value;mergeDraft();render();return;}
  if(e.target.name==='kind'||e.target.name==='service'){mergeDraft();zoneType=edit.kind;service=edit.service;render();}
 },{signal:ctl.signal});
 host.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn)return;
  const s=raw(),d=getDoc(),i=btn.dataset.zoneEdit;
  if(i){edit=structuredClone(s.zones.find(v=>v.id===i));zoneType=edit.kind;service=edit.service;render();return;}
  const del=btn.dataset.zoneRemove;
  if(del){if(commit({...s,zones:s.zones.filter(v=>v.id!==del),openings:Object.fromEntries(Object.entries(s.openings||{}).filter(([,p])=>p.zoneId!==del))},'أُزيل حيز الخدمة. يمكن التراجع عن التغيير.')){edit=null;render();}return;}
  const job=btn.dataset.zAction;
  if(job==='clear'){edit=null;zoneType='access';service='valve';render();return;}
  if(job==='save'){
   const z=read();z.id=edit?.id||'z-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
   for(const f of ['startMm','endMm','bottomMm','topMm','depthMm','wattsPerM','capacityW'])if(Object.hasOwn(z,f))z[f]=asNum(z[f]);
   if(!z.driverId)delete z.driverId;
   const edge=architectureWall(d.room,z.wall);
   if(!edge||Math.max(z.startMm,z.endMm)>(edge.end-edge.start)*10+.00001||Math.max(z.bottomMm,z.topMm)>d.room.height*10){tell('النطاق خارج حدود الجدار المقاس.');return;}
   const c=cleanServiceZones({...s,zones:[...s.zones.filter(v=>v.id!==z.id),z]});
   if(!c){tell('أدخل اسمًا ومرجعًا وأبعادًا صالحة، واجعل النهاية بعد البداية.');return;}
   if(commit(c,'حُفظ حيز الخدمة وحُدثت نتيجة الفحص.')){edit=null;render();}return;
  }
  if(job==='opening'){
   const get=k=>host.querySelector('[name="'+k+'"]').value,unitId=get('openingUnit'),zone=s.zones.find(v=>v.id===get('openingZone'));
   if(!zone)return;
   const data={zoneId:zone.id,unitId,drawing:get('drawingOpen'),signature:serviceOpeningSignature(d,zone,unitId),reviewed:host.querySelector('[name="reviewed"]').checked};
   for(const k of ['start','end','bottom','top','depth'])data[k]=asNum(get('port-'+k));
   if(commit({...s,openings:{...s.openings,[zone.id+'|'+unitId]:data}},'رُبطت فتحة الصيانة بالوحدة وأُعيد فحص الحيز.'))render();
  }
  if(job==='mount'){
   const get=k=>host.querySelector('[name="'+k+'"]').value;
   const uid=get('mountUnit'),mode=get('mountMode'),drawing=get('drawing').trim();
   const digits=v=>v.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/٫/g,'.');
   const tokens=get('points').trim().split(/[\n;]/).filter(l=>l.trim()).map(l=>digits(l).trim().split(/[،,\s]+/).map(Number));
   if(commit({...s,mounts:{...s.mounts,[uid]:{mode,drawing,signature:serviceMountSignature(d,uid),points:mode==='free'?[]:tokens}}},'حُفظ مرجع التثبيت الخاص بالوحدة.')){selectedUnitId=uid;render();}
  }
 },{signal:ctl.signal});
 host.addEventListener('submit',e=>{e.preventDefault();host.querySelector('[data-z-action="save"]').click();},{signal:ctl.signal});
 render();return ()=>ctl.abort();
}
