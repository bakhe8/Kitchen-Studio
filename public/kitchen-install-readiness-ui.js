import {cleanInstallReadiness,linkInstallChange,certifyInstallDependency,evaluateInstallRoute,installReadinessIssues,routeKinds,workKinds} from './kitchen-install-readiness.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,label,v='',type='text')=>'<label>'+label+'<input data-ir="'+name+'" type="'+type+'" '+(type==='number'?'step="any" min="0"':'maxlength="170"')+' value="'+esc(v)+'"></label>';
const choose=(name,label,set,v)=>'<label>'+label+'<select data-ir="'+name+'">'+Object.entries(set).map(([k,t])=>'<option value="'+esc(k)+'" '+(k===v?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
const button=(k,v)=>'<button type="button" data-work-action="'+k+'">'+v+'</button>';
const uid=()=> 'ir-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
export function mountInstallReadiness(host,{getDoc,apply,tell,onAdvance}){
 let tab='dependency',draft=null,phase='cut',unit='';
 const old=()=>getDoc().room.workshop?.installReadiness||{routes:[],dependencies:[]};
 const ac=new AbortController(),value=k=>host.querySelector('[data-ir="'+k+'"]')?.value?.trim()||'';
 const number=v=>{const t=String(v??'').trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/٫/g,'.');return t?Number(t):null;};
 const n=k=>number(value(k));
 function fresh(){
  if(tab==='route')return {id:uid(),unitId:unit,name:'مسار دخول الوحدة',source:'',mode:'assembled',entry:'either',padding:0,margin:0,mass:null,stations:[{kind:'door',label:'باب الموقع',width:null,height:null}]};
  return {id:uid(),unitId:unit,name:'',kind:'finish',phase:'cut',trade:'',planRef:'',due:'',checks:[{label:'البعد المؤثر بالمليمتر',target:null,tolerance:null}]};
 }
 function station(s,i){
  const add=(k,name,v,t='text')=>field(i+'-'+k,name,v,t);
  return '<fieldset><legend>محطة '+(i+1)+'</legend>'+choose(i+'-kind','نوع المحطة',routeKinds,s.kind)+add('label','الاسم',s.label)+add('width','العرض الصافي مم',s.width,'number')+add('height','الارتفاع الصافي مم',s.height,'number')+
   (['lift','turn'].includes(s.kind)?add('depth','العمق الصافي مم',s.depth,'number'):'')+(s.kind==='lift'?add('capacity','الحمولة المتاحة بعد حساب الأشخاص والمعدات الأخرى، كجم',s.capacity,'number'):'')+(s.kind==='turn'?add('manoeuvre','مرجع تجربة مرور أو رسم مناولة معتمد للمسار البديل',s.manoeuvre)+add('reviewer','اسم من راجع تجربة المرور أو رسم المسار البديل',s.reviewer):'')+button('dropS-'+i,'إزالة المحطة')+'</fieldset>';
 }
 function capture(){
  if(!draft)return;
  const d=draft;d.name=value('name');d.unitId=unit;
  if(tab==='route'){d.source=value('source');d.mode=value('mode')||d.mode;d.entry=value('entry');d.padding=n('padding');d.margin=n('margin');d.mass=n('mass');
   if(d.mode==='section'){d.drawing=value('drawing');d.sizes=['cw','cd','ch'].map(n);}
   d.stations=d.stations.map((s,i)=>({kind:value(i+'-kind'),label:value(i+'-label'),width:n(i+'-width'),height:n(i+'-height'),depth:n(i+'-depth'),capacity:n(i+'-capacity'),manoeuvre:value(i+'-manoeuvre'),reviewer:value(i+'-reviewer')}));}
  else{d.kind=value('kind');d.trade=value('trade');d.phase=value('phase');d.due=value('due');d.planRef=value('ref');if(d.kind==='receipt')d.model=value('model');
   if(d.kind==='finish'&&host.querySelector('[data-ir="calc"]')?.checked)d.finish={axis:value('axis'),currentClear:n('clear'),required:n('required'),add:n('add'),remove:n('strip'),tolerance:n('clear-tol')};else delete d.finish;
   if(!['remove','relocate'].includes(d.kind))delete d.change;
   d.checks=d.checks.map((c,i)=>({label:value('l'+i),target:n('t'+i),tolerance:n('s'+i)}));}
 }
 function write(next,msg){
  const validated=cleanInstallReadiness(next);if(!validated){tell('أكمل مرجع البند والقياسات والمسؤول. لا تُستنتج قيمة للأبعاد الفارغة.');return false;}
  const doc=getDoc(),out=apply({...doc,room:{...doc.room,workshop:{...doc.room.workshop,installReadiness:validated}}},msg);return out?.ok!==false;
 }
 function save(withProof=false){
  capture();let d=draft;const store=old(),key=tab==='route'?'routes':'dependencies',list=store[key];
  if(['remove','relocate'].includes(d.kind)&&value('target')&&(!d.change||value('target')!==d.change.feature||d.kind==='relocate'&&(n('planned-u')!==d.change.plannedStation||n('planned-h')!==d.change.plannedBottom||n('move-tol')!==d.change.tolerance))){
   const rev=linkInstallChange(getDoc(),d,value('target'),{plannedStation:n('planned-u'),plannedBottom:n('planned-h'),tolerance:n('move-tol')});if(!rev.ok){tell(rev.reason);return;}d=rev.record;
  }
  if(withProof){const p={date:value('actual-date'),by:value('by'),ref:value('actual-ref'),model:value('actual-model'),finishedClear:n('finished-clear'),actual:d.checks.map((_,i)=>n('m'+i))};
   const checked=certifyInstallDependency(getDoc(),d,p);if(!checked.ok){tell(checked.reason);return;}d=checked.record;
  }else if(d.proof){const prev=list.find(x=>x.id===d.id),a={...d},b={...prev};delete a.proof;delete b.proof;if(JSON.stringify(a)!==JSON.stringify(b))delete d.proof;}
  if(write({...store,[key]:[...list.filter(x=>x.id!==d.id),d]},'حُفظ بند الجاهزية واحتُسب أثره.')){draft=null;render();}
 }
 function render(){
  const doc=getDoc(),units=doc.kitchen.units||[];if(!units.some(u=>u.id===unit))unit=units[0]?.id||'';
  if(!unit){host.innerHTML='<h3>جاهزية الموقع والوحدات</h3><p>حدّد وحدات المطبخ في الرسم ثم اربط بها الأعمال المسبقة أو مسار النقل.</p>'+(onAdvance?button('design','فتح تصميم المطبخ'):'');return;}
  if(!draft)draft=fresh();const d=draft,rr=tab==='route';
  const list=(rr?old().routes:old().dependencies).filter(x=>x.unitId===unit);
  const causes=installReadinessIssues(doc,{unitIds:[unit]},phase);
  const results='<section class="kf-readiness"><div>'+choose('viewPhase','فحص جاهزية الوحدة لمرحلة',{cut:'القص',ship:'النقل',install:'التركيب'},phase)+'</div><div><strong>'+(causes.length?causes.length+' بنود تحتاج مراجعة':'لا توجد عوائق مسجّلة')+'</strong>'+(causes.length?'<ul>'+causes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+'</div></section>';
  let h='<h3>جاهزية الموقع والوحدات</h3><div class="kf-select-bar">'+
    choose('unit','الوحدة',Object.fromEntries(units.map(u=>[u.id,u.id+' · '+Math.round(u.width*10)+' مم'])),unit)+choose('tab','السجل',{dependency:'قرار موقع أو استلام جهاز',route:'حزم ومسارات النقل'},tab)+
    choose('current','بند محفوظ',{'':'بند جديد',...Object.fromEntries(list.map(x=>[x.id,x.name]))},list.some(x=>x.id===d.id)?d.id:'')+
    '</div>'+results+'<div class="ws-card kf-readiness-form"><h4>'+(rr?'مسار النقل ومحطاته':'مواصفة البند والتحقق منه')+'</h4>'+field('name','اسم البند',d.name);
  if(rr){
   h+=field('source','مرجع الرفع أو قياسات المسار',d.source)+choose('mode','شكل الحزمة',{assembled:'الوحدة مجمعة بأبعاد CAD',section:'قطعة أو حزمة منفصلة من رسم تغليف موثّق'},d.mode)+
   (d.mode==='section'?field('drawing','مرجع رسم التجزئة أو الحزمة',d.drawing)+['cw','cd','ch'].map((k,i)=>field(k,['عرض الجزء مم','عمق الجزء مم','ارتفاع الجزء مم'][i],d.sizes?.[i],'number')).join(''):'')+
   field('padding','سمك التغليف على كل وجه مم',d.padding,'number')+field('margin','خلوص المناولة لكل جانب مم',d.margin,'number')+
   field('mass','كتلة الحزمة مع أدوات نقلها كجم، تلزم للمصعد',d.mass,'number')+choose('entry','اتجاه بداية الحمل',{either:'الاتجاهان متاحان',normal:'العرض أولًا',quarter:'العمق أولًا'},d.entry)+d.stations.map(station).join('')+
   button('addS','إضافة محطة للمسار')+button('save','حفظ وفحص الحزمة')+'<p>تُحافَظ على الوضعية بين المقاطع. يُفحص دوران قائم داخل البسطة. السلالم المائلة وإمالة الحزمة تتطلب رسم مناولة متخصصًا.</p>';
   const saved=list.find(x=>x.id===d.id);if(saved){const e=evaluateInstallRoute(doc,saved);h+='<p>نتيجة المسار المحفوظ · '+esc(e.ok?'يمر ضمن الحدود المقاسة.':e.issues.join(' '))+'</p>';}
  }else{
   const run=doc.kitchen.runs.find(r=>r.id===doc.kitchen.units.find(u=>u.id===unit)?.runId),c=d.change;
   const features=Object.fromEntries(doc.kitchen.features.filter(f=>f.wall===run?.wall).map(f=>[f.id,f.id+' · '+Math.round(f.u*10)+' مم']));
   if(c&&!features[c.feature])features[c.feature]=c.feature+' · المرجع السابق';
   const modelScope=['remove','relocate'].includes(d.kind)?choose('target','العنصر المقاس على الجدار',{'':'اعتماد بقياس مستقل',...features},c?.feature)+(d.kind==='relocate'?field('planned-u','بداية العنصر بعد النقل مم',c?.plannedStation,'number')+field('planned-h','أسفله بعد النقل مم',c?.plannedBottom,'number')+field('move-tol','سماحية موضع النقل مم',c?.tolerance,'number'):''):'';
   const fc=d.finish,finishFields=d.kind==='finish'?'<details '+(fc?'open':'')+'><summary>حساب الصافي المتوقع من طبقات التشطيب</summary><label><input type="checkbox" data-ir="calc" '+(fc?'checked':'')+'> احتساب الطبقات على محور واحد</label>'+choose('axis','البعد المتأثر',{width:'عرض',height:'ارتفاع',depth:'عمق'},fc?.axis||'width')+field('clear','الصافي الحالي مم',fc?.currentClear,'number')+field('add','مجموع السماكات المضافة من الجهتين مم',fc?.add,'number')+field('strip','مجموع السماكات المزالة من الجهتين مم',fc?.remove,'number')+field('required','صافي التركيب المطلوب مم',fc?.required,'number')+field('clear-tol','سماحية الفرق عن المخطط مم',fc?.tolerance,'number')+'</details>':'';
   h+=choose('kind','نوع الاعتماد',workKinds,d.kind)+choose('phase','موعد وجوب إنجازه',{cut:'قبل قص الوحدة',install:'قبل التركيب'},d.phase)+field('trade','مسؤول الإنجاز أو التوريد',d.trade)+
   field('due','الموعد المطلوب',d.due,'date')+field('ref','مرجع مواصفة التغيير أو أمر التوريد',d.planRef)+modelScope+finishFields+(d.kind==='receipt'?field('model','الموديل المعتمد في الطلب',d.model):'')+
   d.checks.map((c,i)=>'<fieldset><legend>قياس تحقق '+(i+1)+'</legend>'+field('l'+i,'اسم البعد أو الخلوص',c.label)+field('t'+i,'المستهدف مم',c.target,'number')+field('s'+i,'السماحية مم',c.tolerance,'number')+button('dropC-'+i,'إزالة القياس')+'</fieldset>').join('')+
   button('addC','إضافة قياس تحقق')+button('save','حفظ مواصفة البند')+'<details><summary>إثبات التنفيذ أو الاستلام والقياسات الفعلية</summary>'+
    field('by','اسم المعاين',d.proof?.by)+field('actual-date','تاريخ الإنجاز الفعلي',d.proof?.date,'date')+field('actual-ref','مرجع المحضر أو مستند الاستلام',d.proof?.ref)+
    (d.kind==='receipt'?field('actual-model','الموديل كما وصل',d.proof?.model):'')+(d.kind==='finish'?field('finished-clear','الصافي الفعلي بعد التنفيذ مم عند تفعيل حساب الطبقات',d.proof?.finishedClear,'number'):'')+d.checks.map((c,i)=>field('m'+i,'القراءة الفعلية · '+esc(c.label)+' مم',d.proof?.actual?.[i],'number')).join('')+button('prove','تسجيل النتيجة وفحص المطابقة')+'</details>';
  }
  if(list.some(x=>x.id===d.id))h+=button('remove','إزالة البند من النسخة المحلية');
  h+='</div>';host.innerHTML=h;
 }
 host.addEventListener('change',e=>{const k=e.target.dataset.ir;if(!k)return;
  if(k==='viewPhase'){capture();phase=value(k);render();}
  else if(k==='tab'||k==='unit'){if(k==='tab')tab=value(k);else unit=value(k);draft=null;render();}
  else if(k==='current'){const key=tab==='route'?'routes':'dependencies';draft=structuredClone(old()[key].find(r=>r.id===value(k))||fresh());render();}
  else if(k==='mode'||k==='kind'||k.endsWith('-kind')){capture();render();}
 },{signal:ac.signal});
 host.addEventListener('click',e=>{const op=e.target.closest('[data-work-action]')?.dataset.workAction;if(!op)return;
  if(op==='design'){onAdvance?.('whole');return;}
  if(op==='save'||op==='prove'){save(op==='prove');return;}
  if(op==='remove'){const key=tab==='route'?'routes':'dependencies',s=old();if(write({...s,[key]:s[key].filter(v=>v.id!==draft.id)},'حُذف البند من هذه النسخة.')){draft=null;render();}return;}
  capture();if(op==='addS')draft.stations.push({kind:'door',label:'فتحة أخرى'});else if(op==='addC')draft.checks.push({label:''});
  else if(op.startsWith('dropS-'))draft.stations.splice(Number(op.slice(6)),1);else if(op.startsWith('dropC-'))draft.checks.splice(Number(op.slice(6)),1);render();
 },{signal:ac.signal});
 render();return ()=>ac.abort();
}
