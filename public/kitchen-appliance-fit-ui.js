import {deviceNames,appliancePorts,appliancePlacements,portLabel,cleanApplianceSchedule,evaluateApplianceFit,applianceFitKey} from './kitchen-appliance-fit.js';
import {kitchenUnitSpecs} from './kitchen-model.js';
import {architectureWallLabel} from './kitchen-architecture.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(k,v,x)=>'<option value="'+esc(k)+'"'+(x===k?' selected':'')+'>'+esc(v)+'</option>';
const select=(key,title,entries,current)=>'<label>'+esc(title)+'<select data-kaf="'+key+'">'+entries.map(([k,v])=>opt(k,v,current)).join('')+'</select></label>';
const number=(k,title,v)=>'<label>'+title+'<input data-kaf="'+k+'" type="number" min="0" step="any" value="'+esc(v??'')+'"></label>';
const txt=(k,title,v)=>'<label>'+title+'<input maxlength="160" data-kaf="'+k+'" value="'+esc(v)+'"></label>';
const btn=(k,t)=>'<button type="button" data-af-act="'+k+'">'+esc(t)+'</button>';
const axisLabels={width:'العرض',depth:'العمق',height:'الارتفاع'};
const numFormat=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3});
const triplet=()=>({width:null,depth:null,height:null}),placeNames={counter:'فوق سطح العمل',bay:'فتحة مخصصة للجهاز',inside:'داخل الوحدة'};
const makeId=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-'));
function fresh(kind='microwave'){return {id:makeId('ap'),kind,host:'',name:'',model:'',manual:'',siteRef:'',placement:appliancePlacements[kind][0],required:triplet(),measured:triplet(),offset:[null,null,null],frontMm:null,watts:null,circuit:'',bearing:'unknown',power:appliancePorts[kind].includes('electric')?'electric':'unknown',connections:Object.fromEntries(appliancePorts[kind].map(k=>[k,{id:'',pathMm:null,maxMm:null}]))};}
const validSize=n=>Number.isFinite(n)&&n>=1&&n<=12000;
function readingComparison(d){
 const checked=Object.keys(axisLabels).filter(axis=>validSize(d.required[axis])&&validSize(d.measured[axis]));
 const short=checked.filter(axis=>d.measured[axis]<d.required[axis]);
 const missing=Object.keys(axisLabels).filter(axis=>!checked.includes(axis));
 return {tone:short.length?'short':missing.length?'pending':'fits',
  text:short.length?'نقص في '+short.map(axis=>axisLabels[axis]+' '+numFormat.format(d.required[axis]-d.measured[axis])+' مم').join(' و'):missing.length?'يلزم قياس '+missing.map(axis=>axisLabels[axis]).join(' و'):'لا نقص بين القراءات الثلاث'};
}
// Each outline uses the same origin and millimetre scale. Do not draw an
// unknown span or imply that a dimension comparison confirms the installation.
function bayPreview(d){
 const state=readingComparison(d);
 const views=[['height','واجهة'],['depth','مسقط']].map(([axis,title])=>({axis,title,
  outlines:['required','measured'].filter(key=>validSize(d[key].width)&&validSize(d[key][axis]))}));
 const extents=views.flatMap(v=>v.outlines.map(key=>({w:d[key].width,h:d[key][v.axis]})));
 const scale=extents.length?Math.min(108/Math.max(...extents.map(v=>v.w)),88/Math.max(...extents.map(v=>v.h))):0;
 const pictures=views.filter(v=>v.outlines.length).map(({axis,title,outlines})=>{
  const widest=Math.max(...outlines.map(k=>d[k].width))*scale,left=(120-widest)/2;
  const shapes=outlines.map(k=>{
   const width=d[k].width*scale,height=d[k][axis]*scale;
   return '<rect class="dp-bay-'+k+'" x="'+left+'" y="'+(96-height)+'" width="'+width+'" height="'+height+'"/>';
  }).join('');
  return '<button type="button" class="dp-bay-view" data-af-axis="'+axis+'" aria-label="تعديل '+axisLabels[axis]+' المتاح من '+title+' الحيز"><svg viewBox="0 0 120 103" aria-hidden="true" focusable="false"><path d="M3 96H117" stroke="#c4d1cf"/>'+shapes+'</svg><span>'+title+' · '+axisLabels[axis]+'</span></button>';
 }).join('');
 return '<section class="dp-bay-preview" data-tone="'+state.tone+'"><header><b>مقارنة الحيّز قبل الإزاحة</b><strong>'+state.text+'</strong></header>'+
  (pictures?'<div class="dp-bay-views">'+pictures+'</div><div class="dp-bay-key"><span>الحيز المطلوب</span><span>المتاح المقاس</span></div>':'')+'</section>';
}
function savedFitPanel(key,title,report,opened){
 const issues=report.issues,loads=report.loads.filter(load=>load.selected);
 return '<details class="dp-saved-result" data-fit-saved="'+key+'"'+(opened?' open':'')+'><summary><strong>'+esc(title)+'</strong><span>'+(!issues.length?'لا توجد ملاحظات':'ملاحظات · '+numFormat.format(issues.length))+'</span></summary>'+
  (issues.length?'<ul>'+issues.map(v=>'<li>'+esc(v)+'</li>').join(''):'<p>الحيّز والخدمات والأحمال المسجلة ضمن الحدود الموثّقة.</p>')+
  loads.map(v=>'<p>'+esc(v.label)+' · '+(v.known?numFormat.format(v.watts):'غير معلوم')+' / '+(v.allowedW===null?'غير معلوم':numFormat.format(v.allowedW))+' واط</p>').join('')+'</details>';
}
export function mountApplianceFit(host,{getDoc,apply,tell,focus={}}){
 const signaler=new AbortController(),signal=signaler.signal;let announcement=null,base=getDoc(),d=fresh(),c=null,note='',verified=false;
 const schedule=()=>getDoc().room.workshop?.applianceFit||{devices:[],circuits:[]};
 const hostUnit=base.kitchen.units.find(u=>u.id===focus.unitId);
 function newDevice(){
  if(!hostUnit)return fresh();
  const kind=hostUnit.kind==='oven-tower'?'oven':hostUnit.kind;
  return {...fresh(Object.hasOwn(deviceNames,kind)?kind:'other'),host:hostUnit.id};
 }
 const recordsForPage=()=>schedule().devices.filter(v=>!hostUnit||v.host===hostUnit.id);
 const drafts=new Map();
 let dirty=false;
 function chooseDevice(id){
  const draft=drafts.get(id),saved=schedule().devices.find(v=>v.id===id);
  d=draft?.device||(saved?structuredClone(saved):newDevice());
  verified=draft?draft.verified:!!d.proof&&d.proof===applianceFitKey(getDoc(),d);
  dirty=!!draft;drafts.delete(id);note='';
 }
 function switchDevice(id){
  if(dirty)drafts.set(schedule().devices.some(v=>v.id===d.id)?d.id:'',{device:d,verified});
  chooseDevice(id);render();
 }
 chooseDevice(recordsForPage()[0]?.id||'');
 const newCircuit=()=>({id:makeId('cct'),label:'',reference:'',allowedW:null,outlets:[]});
 function setVal(obj,key,val){const tokens=key.split('.');let n=obj;for(const p of tokens.slice(0,-1))n=n[p];n[tokens.at(-1)]=val;}
 function fitDifference(axis){
  const need=d.required[axis],free=d.measured[axis];
  if(![need,free].every(validSize))return '<span class="dp-pending">—</span>';
  const diff=free-need;
  return '<span class="dp-diff" data-short="'+(diff<0)+'">'+(diff===0?'مطابق':(diff<0?'نقص ':'فائض ')+numFormat.format(Math.abs(diff)))+'</span>';
 }
 function focusField(key){
  const field=host.querySelector('[data-kaf="'+key+'"]');
  if(!field)return;
  const drawer=field.closest('[data-fit-drawer]');if(drawer)drawer.open=true;
  field.focus();
 }
 function missingRef(){return ['model','manual','siteRef'].find(key=>!d[key].trim());}
 function render(){
  clearTimeout(announcement);
  const openDrawers=new Set([...host.querySelectorAll('[data-fit-drawer][open]')].map(el=>el.dataset.fitDrawer));
  const activeField=host.ownerDocument?.activeElement;
  const restoreKey=host.contains?.(activeField)&&activeField?.dataset.kaf;
  const drawer=(key,title,body)=>'<details class="dp-fit-drawer" data-fit-drawer="'+key+'" '+(openDrawers.has(key)?'open':'')+'><summary>'+title+'</summary><div>'+body+'</div></details>';
  const doc=getDoc(),s=schedule(),active=s.devices.find(x=>x.id===d.id);
  const records=recordsForPage();
  if(active&&!records.includes(active))records.push(active);
  const codes=new Map(doc.kitchen.units.map((u,i)=>[u.id,'U'+(i+1)]));
  const resultOpen=new Set([...host.querySelectorAll('[data-fit-saved][open]')].map(el=>el.dataset.fitSaved));
  const cards=[];
  if(s.devices.length){
   const all=evaluateApplianceFit(doc);
   const otherUnits=active&&s.devices.some(v=>v.host!==active.host);
   if(active){
    const report=otherUnits?evaluateApplianceFit(doc,{unitIds:[active.host]}):all;
    cards.push(savedFitPanel('unit','الفحص المحفوظ للوحدة '+(codes.get(active.host)||active.host),report,resultOpen.has('unit')));
   }
   if(!active||otherUnits)cards.push(savedFitPanel('project','الفحص المحفوظ للمشروع كاملًا',all,resultOpen.has('project')));
  }
  const hosts=doc.kitchen.units.map(u=>{const r=doc.kitchen.runs.find(r=>r.id===u.runId);return [u.id,(kitchenUnitSpecs[u.kind]?.label||u.kind)+' · '+(r?.wall?architectureWallLabel(r.wall):'جزيرة')+' · '+codes.get(u.id)];});
  if(d.host&&!codes.has(d.host))hosts.push([d.host,'وحدة لم تعد في الرسم · '+d.host]);
  const hasElectric=appliancePorts[d.kind].includes('electric')||d.power==='electric';
  const axes=Object.entries(axisLabels);
  const fits='<table class="dp-fit-table"><caption>مطابقة حيز التركيب · مم</caption><thead><tr><th>المحور</th><th>مطلوب مع الخلوص</th><th>المتاح الصافي</th><th>الفرق</th></tr></thead><tbody>'+axes.map(([axis,label])=>{
   const cell=(key,title)=>'<td><input aria-describedby="dp-diff-'+axis+'" aria-label="'+label+' '+title+' بالملليمتر" data-kaf="d.'+key+'.'+axis+'" type="number" min="1" max="12000" step="any" value="'+esc(d[key][axis]??'')+'"></td>';
   return '<tr><th scope="row">'+label+'</th>'+cell('required','المطلوب')+cell('measured','المتاح')+ '<td id="dp-diff-'+axis+'" data-fit-diff="'+axis+'">'+fitDifference(axis)+'</td></tr>';
  }).join('')+'</tbody></table>';
  const serviceHTML=Object.entries(portLabel).map(([p,l])=>{
   if(p==='electric'&&!hasElectric)return '';const mandatory=p==='electric'?hasElectric:appliancePorts[d.kind].includes(p),conn=d.connections[p];
   return '<fieldset><legend>'+(mandatory?l+' · مطلوبة للموديل':'<label><input type="checkbox" data-af-service="'+p+'"'+(conn?' checked':'')+'> يحتاج '+l+'</label>')+'</legend>'+
   (conn?select('d.connections.'+p+'.id','النقطة من الرفع',[['','حدّد المخرج'],...doc.kitchen.features.filter(f=>f.kind===p).map(f=>[f.id,architectureWallLabel(f.wall)+' · '+f.id])],conn.id)+
    '<div class="ws-inline">'+number('d.connections.'+p+'.pathMm','طول المسار المقاس · مم',conn.pathMm)+number('d.connections.'+p+'.maxMm','حد الموديل للتوصيل · مم',conn.maxMm)+'</div>':'')+'</fieldset>';
  }).join('');
  const references=txt('d.name','اسم الجهاز عند العميل',d.name)+txt('d.model','الموديل أو وصف القطعة المقاسة',d.model)+txt('d.manual','مرجع دليل التركيب أو مواصفة القطعة',d.manual)+txt('d.siteRef','مرجع قياس الفني للحيز الصافي',d.siteRef)+(active?btn('removeDevice','إزالة هذا التجهيز'):'');
  const position='<fieldset><legend>إزاحة الجهاز من بداية الوحدة وظهرها وقاعدتها · مم</legend><div class="ws-inline">'+['على العرض','على العمق','رأسيًا'].map((l,i)=>number('d.offset.'+i,l,d.offset[i])).join('')+'</div></fieldset>'+
   number('d.frontMm','حيز فتح الجهاز أو سحبه أمامه · مم',d.frontMm)+(d.placement==='bay'?select('d.bearing','ارتكاز الأرجل',[['unknown','غير مؤكد'],['same','على مستوى مقاس واحد'],['mixed','على أكثر من مستوى']],d.bearing):'');
  const services=(!appliancePorts[d.kind].includes('electric')?select('d.power','الكهرباء',[['unknown','لم يُحسم'],['electric','جهاز يعمل بالكهرباء'],['passive','قطعة دون كهرباء']],d.power):'')+
   serviceHTML+(hasElectric?number('d.watts','الحمل المدون على الموديل · واط',d.watts)+select('d.circuit','الدائرة الموثقة',[['','اختر الدائرة'],...s.circuits.map(v=>[v.id,v.label||v.id])],d.circuit):'');
  host.innerHTML='<header class="dp-fit-head"><h3>مطابقة حيز الجهاز</h3>'+select('choose',hostUnit?'تجهيزات هذه الوحدة':'التجهيز',[['','تجهيز جديد'],...records.map(v=>[v.id,(v.name||deviceNames[v.kind])+' · '+(codes.get(v.host)||v.host)+(drafts.has(v.id)?' · مسودة':'')])],active?d.id:'')+(active?btn('newDevice',drafts.has('')?'متابعة تجهيز جديد':'تجهيز جديد'):'')+'</header>'+
   '<div class="dp-fit-work"><section class="ws-card dp-appliance-fit"><div class="dp-fit-target">'+select('d.kind','نوع الجهاز',Object.entries(deviceNames),d.kind)+select('d.host','الوحدة الحاضنة',[['','اختر الوحدة من الرسم'],...hosts],d.host)+
   select('d.placement','مكان التركيب',appliancePlacements[d.kind].map(k=>[k,placeNames[k]]),d.placement)+'</div>'+fits+'<span class="dp-sr" aria-live="polite" aria-atomic="true" data-fit-announce></span>'+
   '<div class="dp-fit-actionbar">'+btn('device','حفظ وفحص التجهيز')+'<p role="status" data-af-note>'+esc(note)+'</p></div>'+(cards.length?'<div class="dp-fit-report">'+cards.join('')+'</div>':'')+'</section>'+
   '<div class="dp-fit-review"><div data-bay-preview>'+bayPreview(d)+'</div><section class="ws-card dp-fit-evidence"><h4>مراجعة تجهيز الوحدة</h4>'+drawer('refs','بيانات الجهاز ومراجع القياس',references)+drawer('position','موضع الجهاز وخلوص الفتح',position)+drawer('services','مخارج الخدمات والحمل الكهربائي',services)+
   '<label class="dp-fit-verify"><input type="checkbox" data-af-verify'+(verified?' checked':'')+'> <span>راجع الفني الموديل والمراجع والقياسات عند هذه الوحدة</span></label></section>'+
   '<details class="ws-card"'+(c?' open':'')+'><summary>دوائر الأجهزة وقدرة التشغيل المتاحة</summary>'+select('circuit','الدائرة',[['','دائرة جديدة'],...s.circuits.map(v=>[v.id,v.label||v.id])],c?.id||'')+
   (c?txt('c.label','اسم الدائرة',c.label)+txt('c.reference','مرجع الفني المختص أو المخطط المعتمد',c.reference)+number('c.allowedW','القدرة المخصصة لهذه الأجهزة بعد الأحمال الأخرى · واط',c.allowedW)+
   '<p>المخارج المرتبطة بهذه الدائرة حسب الرفع</p>'+doc.kitchen.features.filter(f=>f.kind==='electric').map(f=>'<label><input type="checkbox" data-af-outlet="'+esc(f.id)+'"'+(c.outlets.includes(f.id)?' checked':'')+'> '+esc(architectureWallLabel(f.wall)+' · '+f.id)+'</label>').join('')+btn('saveCircuit','حفظ الدائرة')+(s.circuits.some(v=>v.id===c.id)?btn('removeCircuit','إزالة الدائرة'):''):btn('newCircuit','إضافة دائرة'))+'</details></div></div>';
  if(restoreKey)focusField(restoreKey);
 }
 function save(next){if(base!==getDoc()){note='تغيّر المشروع. افتح الخطوة من جديد قبل حفظ هذه البيانات.';render();return false;}const v=cleanApplianceSchedule(next);if(!v){note='راجع المقاسات الموجبة والمخارج. لا يجوز إسناد مخرج كهرباء إلى دائرتين.';render();return false;}
  const doc=getDoc(),res=apply({...doc,room:{...doc.room,workshop:{...doc.room.workshop,applianceFit:v}}},'حُفظت بيانات مطابقة التجهيز.');
  if(res?.ok===false){note=res.reason;render();return false;}base=getDoc();note=res?.saved===false?'أعيد الحساب في هذه الجلسة وتعذّر الحفظ في المتصفح.':'حُفظت المراجعة وأعيد الحساب.';tell?.(note);return true;}
 host.addEventListener('input',e=>{
  const el=e.target,key=el.dataset.kaf;if(!key||!key.includes('.'))return;
  const [prefix,...rest]=key.split('.'),obj=prefix==='c'?c:d;if(!obj)return;
  const val=el.type==='number'?(el.value===''?null:el.valueAsNumber):el.value;
  if(prefix==='d'){dirty=true;verified=false;delete d.proof;}
  setVal(obj,rest.join('.'),val);
  if(prefix==='d'&&['required','measured'].includes(rest[0])){
   const axis=rest[1],cell=host.querySelector('[data-fit-diff="'+axis+'"]');
   if(cell){
    cell.innerHTML=fitDifference(axis);host.querySelector('[data-bay-preview]').innerHTML=bayPreview(d);
    clearTimeout(announcement);
    announcement=setTimeout(()=>{
     const readout=host.querySelector('[data-fit-announce]');
     if(readout)readout.textContent=axisLabels[axis]+' · '+(cell.textContent==='—'?'أدخل القياسين للمقارنة':cell.textContent+' مم');
    },300);
   }
  }
  const verify=host.querySelector('[data-af-verify]');if(verify)verify.checked=verified;
 },{signal});
 host.addEventListener('change',e=>{
  const el=e.target,k=el.dataset.kaf;
  if(k==='choose'){switchDevice(el.value);return;}
  if(k==='circuit'){c=structuredClone(schedule().circuits.find(v=>v.id===el.value)||newCircuit());c.outlets??=[];render();}
  if(el.matches('[data-af-verify]')){
   const missing=el.checked&&missingRef();
   if(missing){el.checked=false;verified=false;const status=host.querySelector('[data-af-note]');note='أكمل مرجع الموديل وقياس الموقع قبل توثيق المراجعة.';status.textContent=note;focusField('d.'+missing);}
   else{verified=el.checked;dirty=true;}
  }
  if(el.matches('[data-af-outlet]')){const id=el.dataset.afOutlet;c.outlets=c.outlets.filter(v=>v!==id);if(el.checked)c.outlets.push(id);}
  if(el.matches('[data-af-service]')){dirty=true;if(el.checked)d.connections[el.dataset.afService]={id:'',pathMm:null,maxMm:null};else delete d.connections[el.dataset.afService];verified=false;render();}
  if(k==='d.host'){
   const u=getDoc().kitchen.units.find(v=>v.id===d.host),m=u?.modelSpec;
   if(m){d.model=m.model;d.manual=m.manual;d.required={width:m.widthMm,depth:m.depthMm,height:m.heightMm};
    if(appliancePlacements[d.kind].includes('bay'))d.placement='bay';
    d.siteRef='';d.measured=triplet();d.offset=[null,null,null];verified=false;delete d.proof;render();}
  }
  if(k==='d.kind'){const nd=fresh(el.value);d={...nd,id:d.id,host:d.host,name:d.name};verified=false;render();}
  if(k==='d.power'){if(d.power==='electric')d.connections.electric??={id:'',pathMm:null,maxMm:null};else{d.watts=null;d.circuit='';delete d.connections.electric;}verified=false;render();}
  if(k==='d.placement')render();
 },{signal});
 host.addEventListener('keydown',e=>{
  const key=e.target.dataset.kaf||'';
  if(e.key!=='Enter'||e.isComposing||!/^d\.(required|measured)\.(width|depth|height)$/.test(key))return;
  e.preventDefault();
  if(!e.target.reportValidity())return;
  const [,group,axis]=key.split('.'),axes=Object.keys(axisLabels),next=axes[axes.indexOf(axis)+1];
  if(next)focusField('d.'+group+'.'+next);
  else if(group==='required')focusField('d.measured.width');
  else host.querySelector('[data-af-act="device"]').focus();
 },{signal});
 host.addEventListener('click',e=>{
  const axis=e.target.closest('[data-af-axis]')?.dataset.afAxis;
  if(Object.hasOwn(axisLabels,axis)){focusField('d.measured.'+axis);return;}
  const a=e.target.closest('[data-af-act]')?.dataset.afAct;if(!a)return;const s=schedule();
  if(a==='newDevice'){switchDevice('');focusField('d.kind');return;}
  if(a==='newCircuit'){c=newCircuit();render();return;}
  if(a==='saveCircuit'&&c){if(save({...s,circuits:[...s.circuits.filter(o=>o.id!==c.id),c]})){c=null;render();}return;}
  if(a==='removeCircuit'&&c){if(save({...s,circuits:s.circuits.filter(o=>o.id!==c.id)})){c=null;render();}return;}
  if(a==='removeDevice'){if(save({...s,devices:s.devices.filter(o=>o.id!==d.id)})){chooseDevice(recordsForPage()[0]?.id||'');render();}return;}
  if(a==='device'){
   if(!d.host){note='اختر وحدة موجودة في الرسم.';render();focusField('d.host');return;}
   const invalid=host.querySelector('.dp-appliance-fit input:invalid');
   if(invalid){note='راجع حدود القياس المبيّنة لهذا الحقل.';host.querySelector('[data-af-note]').textContent=note;focusField(invalid.dataset.kaf);invalid.reportValidity();return;}
   if(verified)d.proof=applianceFitKey(getDoc(),d);else delete d.proof;
   const devices=s.devices.some(v=>v.id===d.id)?s.devices.map(v=>v.id===d.id?d:v):[...s.devices,d];
   if(save({...s,devices})){d=structuredClone(schedule().devices.find(v=>v.id===d.id));dirty=false;render();}}
 },{signal});
 render();const dispose=()=>{clearTimeout(announcement);signaler.abort();};
 dispose.hasPending=()=>dirty||drafts.size>0;return dispose;
}
