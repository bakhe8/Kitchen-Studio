import {mountWallLights} from './kitchen-linear-light-ui.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {wallAccessoryApproval} from './kitchen-wall-accessory.js';
import {applyWallOptions,buildUpperRows,readWallOptions,wallOptionTakeoff} from './kitchen-chain-options.js';
import {surveyedDesignRange} from './kitchen-chain-model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const select=(key,label,choices,value)=>'<label>'+label+'<select data-op="'+key+'">'+Object.entries(choices).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
const num=(key,label,value)=>'<label>'+label+' <small>مم</small><input aria-label="'+label+'" type="number" inputmode="decimal" step="any" min="0" data-op="'+key+'" value="'+esc(value)+'"></label>';
const check=(key,label,value)=>'<label class="kco-check"><input type="checkbox" data-op="'+key+'"'+(value?' checked':'')+'>'+label+'</label>';
const ready={factory:'من المصنع',existing:'قائم',external:'طرف خارجي',review:'قيد المراجعة'};

export function mountWallOptions(host,{getDoc,apply,wall,onSaved}){
 let options=structuredClone(readWallOptions(getDoc(),wall));
 let note='',open=false;
 const map=()=>getDoc().kitchen.features.filter(f=>f.wall===wall);
 const curtainDefault=f=>({state:'none',type:'roller',leftMm:0,rightMm:0,aboveMm:0,dropMm:Math.round(f.height*10),projectionMm:0});
 const heaterDefault=()=>({state:'exposed',model:'',reviewed:false,leftMm:null,rightMm:null,aboveMm:null,belowMm:null,frontMm:null});
 const path=(v,keys)=>keys.reduce((p,k)=>p[k],v);
 function recorder(e){
  const key=e.target.dataset.op;if(!key)return;
  const parts=key.split('/'),prop=parts.pop();
  if(parts[0]==='curtains'||parts[0]==='heaters'){
   const list=options[parts[0]],id=parts[1],f=map().find(v=>v.id===id);if(!f)return;
   if(prop==='state'&&!e.target.value){delete list[id];return;}
   list[id]??=parts[0]==='curtains'?curtainDefault(f):heaterDefault();
  }
  if(key==='mode'||key==='cornice/enabled'){
   const d=options.decisions??={};d[key==='mode'?'upper':'cornice']=!!e.target.value;
   if(!e.target.value)return;
  }
  const obj=path(options,parts);
  if(e.target.type==='number')obj[prop]=e.target.value===''?null:e.target.valueAsNumber;
  else if(e.target.type==='checkbox')obj[prop]=e.target.checked;
  else obj[prop]=key==='cornice/enabled'?e.target.value==='on':e.target.value;
  const doc=getDoc(),book=readWorkshopCatalog(doc.room.workshop)?.wallAccessories||{};
  if(key==='mode'&&obj.mode==='none'){obj.cornice.enabled=false;obj.cornice.reviewed=false;if(obj.factoryTrim){delete obj.factoryTrim.cornice;delete obj.factoryTrim.filler;}}
  if(parts[0]==='curtains'){
   if(prop==='state'&&obj.state!=='factory'||prop==='type'||prop==='recipe'&&!obj.recipe){delete obj.recipe;delete obj.pose;}
   if(prop==='recipe'&&obj.recipe&&book[obj.recipe]){obj.type=book[obj.recipe].kind;obj.projectionMm=book[obj.recipe].projection;obj.pose||='closed';}
  }
  if(parts[0]==='heaters'){
   if(prop==='state'&&obj.state!=='cover'||prop==='recipe'&&!obj.recipe)delete obj.recipe;
   if(prop!=='reviewed'){obj.reviewed=false;delete obj.kitProof;}
   if(prop==='reviewed'&&obj.recipe&&obj.reviewed)obj.kitProof=wallAccessoryApproval(doc.room,doc.kitchen,wall,parts[1],readWorkshopCatalog(doc.room.workshop),options);
   if(!obj.reviewed)delete obj.kitProof;
  }
  if(parts[0]==='cornice'&&prop!=='reviewed')obj.reviewed=false;
  if(parts[0]==='profiles'&&prop==='type'&&['ledge','skirting'].includes(obj.type))obj.bottomMm=0;
 }
 function draw(){
  const features=map(),windows=features.filter(f=>f.kind==='window'),heaters=features.filter(f=>f.kind==='heater'),o=options,c=o.cornice;
  const book=readWorkshopCatalog(getDoc().room.workshop)?.wallAccessories||{};
  function recipeSelect(path,v,types){
   const records=Object.entries(book).filter(([,r])=>types.includes(r.kind)),list=Object.fromEntries([['','تفصيل خاص مستقل'],...records.map(([key,r])=>[key,r.label+' · '+r.reference])]);
   if(v.recipe&&!Object.hasOwn(list,v.recipe))list[v.recipe]='وصفة مفقودة أو مختلفة · '+v.recipe;
   return select(path+'recipe','النظام من بوابة المصنع',list,v.recipe||'')+(!records.length?'<small>يمكن للمصنع إضافة نظام قابل لإعادة الاستخدام في «ستائر وأغطية السخانات».</small>':'');
  }
  const current=(o.decisions?.upper??(o.mode!=='gap'||getDoc().kitchen.runs.some(r=>r.id.startsWith('wup-'+wall+'-'))))?o.mode:'';
  const modes=[['','لم يُحسم'],['none','دون علوي'],['gap','فراغ فوق الصف'],['tall','حتى السقف'],['two','صفّان مستقلان'],['filler','قفلة ثابتة']];
  let form='<fieldset class="dp-upper-modes"><legend>نهاية الصف العلوي</legend>'+modes.map(([key,label])=>'<label><input type="radio" name="upper-mode-'+esc(wall)+'" data-op="mode" value="'+key+'" '+(current===key?'checked':'')+'><i class="dp-upper-silhouette" data-mode="'+key+'" aria-hidden="true"></i><span>'+label+'</span></label>').join('')+'</fieldset>'+
   (o.mode==='none'?'':'<div class="kc-fields">'+num('bottomMm','منسوب أسفل العلوي',o.bottomMm)+num('depthMm','عمق الوحدة',o.depthMm)+
   (['gap','filler'].includes(o.mode)?num('heightMm','ارتفاع الجسم القابل للفتح',o.heightMm):'')+
   (o.mode==='two'?num('upperTierMm','ارتفاع الصف الثاني',o.upperTierMm):'')+
   (o.mode!=='gap'?num('headMm','الفراغ المطلوب عند السقف',o.headMm):'')+'</div>');
  if(o.mode==='filler')form+=select('fillerBy','من ينفذ القفلة؟',{factory:'لوح من المصنع',external:'جبس أو عمل خارجي'},o.fillerBy);
  if(o.mode!=='none')form+=select('cornice/enabled','كورنيش زخرفي على حافة الدواليب',{'':'لم يُحسم',off:'بدون كورنيش',on:'كورنيش من المصنع'},(o.decisions?.cornice??c.enabled)?(c.enabled?'on':'off'):'');
  if(c.enabled)form+='<div class="kc-fields">'+num('cornice/heightMm','ارتفاع قطاع الكورنيش',c.heightMm)+num('cornice/projectionMm','بروزه أمام الواجهة',c.projectionMm)+'</div>'+check('cornice/returns','تشطيب جانبيّ طرفَي كل مقطع',c.returns) +check('cornice/reviewed','راجع فني المصنع مسار الفتح مع قطاع الكورنيش واعتمده',c.reviewed);
  for(const [i,f] of windows.entries()){
   const v=o.curtains[f.id]||curtainDefault(f),k='curtains/'+f.id+'/';
   form+='<div class="kco-item"><b>ستارة الشباك '+fmt(i+1)+' · بداية البرواز '+fmt(f.u*10)+' مم</b>'+select(k+'state','طلب العميل',{'':'لم يُحسم',none:'بدون ستارة',existing:'ستارة قائمة تبقى',factory:'توفير من المصنع',external:'تركيب من طرف آخر'},o.curtains[f.id]?.state||'');
   if(v.state!=='none')form+=select(k+'type','النوع',{roller:'رول',track:'ستارة بمجرى',other:'تفصيل آخر'},v.type)+'<div class="kc-fields">'+num(k+'leftMm','امتداد قبل البرواز',v.leftMm)+num(k+'rightMm','امتداد بعد البرواز',v.rightMm)+num(k+'aboveMm','التثبيت فوق البرواز',v.aboveMm)+num(k+'dropMm','النزول من التثبيت',v.dropMm)+num(k+'projectionMm','البروز داخل المطبخ',v.projectionMm)+'</div>';
   if(v.state==='factory')form+=recipeSelect(k,v,['roller','track'])+(v.recipe?select(k+'pose','وضع الستارة المعروض للعميل',{closed:'مسدلة',parked:'مجمّعة للسماح بفتح الشباك'},v.pose||'closed')+'<small>يحتفظ التوزيع بمكان الستارة عند إسدالها. يتحقق البرنامج من فتح الضلفة بعد جمعها.</small>':'');
   form+='</div>';
  }
  for(const [i,f] of heaters.entries()){
   const v=o.heaters[f.id]||heaterDefault(),k='heaters/'+f.id+'/';
   form+='<div class="kco-item"><b>السخان '+fmt(i+1)+' · '+fmt(f.u*10)+' مم</b>'+select(k+'state','رغبة العميل',{'':'لم يُحسم',exposed:'يبقى ظاهرًا',cover:'غطاء خدمة بواجهة مماثلة'},o.heaters[f.id]?.state||'');
   if(!o.heaters[f.id]){form+='</div>';continue;}
   form+='<label>موديل السخان<input type="text" maxlength="100" data-op="'+k+'model" value="'+esc(v.model)+'"></label><label>مرجع دليل التركيب والصيانة<input data-op="'+k+'manual" maxlength="160" value="'+esc(v.manual||'')+'"></label><p>أدخل خلوصات دليل الموديل. يمكن ترك القيمة مجهولة حتى مراجعتها.</p><div class="kc-fields">'+
   num(k+'leftMm','الخلوص قبل الجهاز',v.leftMm)+num(k+'rightMm','الخلوص بعده',v.rightMm)+num(k+'aboveMm','فوق الجهاز',v.aboveMm)+num(k+'belowMm','تحته',v.belowMm)+num(k+'frontMm','حيز العمل أمامه',v.frontMm)+'</div>'+
   (v.state==='cover'?recipeSelect(k,v,['heater']):'')+(v.state==='cover'&&book[v.recipe]?'<p>مرجع السماح بالتغطية · '+esc(book[v.recipe].permission)+' · موديل '+esc(book[v.recipe].model)+'</p>':'')+check(k+'reviewed','تحققت من دليل موديل الجهاز والخلوصات وطريقة التغطية وفك الواجهة عند اختيار غطاء',v.reviewed)+'</div>';
  }
  const profileTypes={ledge:'عتبة أو تعلية تحت الدواليب',skirting:'نعلة جدار قائمة',ceiling:'هبوط سقف',lean:'أقصى بروز جدار مائل عند هذا الارتفاع'};
  form+='<details class="kco-item"><summary>التعلية والنعلة وهبوط السقف وميل الجدار</summary><p>حدّد المقطع المتأثر فقط. مسافات البداية والنهاية من بداية ضلع الجدار الفعلي. عند الميل أدخل أكبر بروز مقاس في نطاق الارتفاع، ويمكن تسجيل أكثر من نطاق.</p>';
  for(const [i,p] of (o.profiles||[]).entries()){
   const k='profiles/'+i+'/';
   form+=select(k+'type','نوع المقطع',profileTypes,p.type)+'<div class="kc-fields">'+num(k+'fromMm','بداية المقطع',p.fromMm)+num(k+'toMm','نهاية المقطع',p.toMm)+
    (p.type==='ceiling'||p.type==='lean'?num(k+'bottomMm','ارتفاع أسفل المنطقة',p.bottomMm):'')+num(k+'topMm','منسوب أعلى المنطقة',p.topMm)+num(k+'depthMm','البروز الأفقي أو عمق التعلية',p.depthMm)+'</div>'+
    '<label>مرجع القياس<input maxlength="160" data-op="'+k+'reference" value="'+esc(p.reference)+'"></label><button type="button" data-opt-act="remove-profile" data-index="'+i+'">إزالة المقطع</button>';
  }
  form+='<p><button type="button" data-opt-act="profile">إضافة مقطع مقاس</button></p></details>';
  form+='<details><summary>إنارة أسفل الدواليب</summary><div data-wall-lights></div></details>';
  const take=wallOptionTakeoff(getDoc(),wall),range=surveyedDesignRange(getDoc(),wall);
  const summary=take.items.map(i=>'<li>'+esc(i.label)+' · '+fmt(i.quantity)+' '+esc(i.unit)+' · '+ready[i.readiness]+'</li>').join('')+take.pending.map(p=>'<li>'+esc(p)+'</li>').join('');
  host.innerHTML='<details class="kco-options"'+(open?' open':'')+'><summary>العلوي والستارة والسخان</summary><div class="kco-form">'+form+
   '<div class="kc-actions"><button data-opt-act="save" type="button">حفظ الخيارات</button>'+(range?'<button data-opt-act="draw" class="kc-primary" type="button">'+(o.mode==='none'?'تطبيق جدار بلا صف علوي على الرسم':'توليد العلوي على الرسم')+'</button>':'')+'</div>'+
   (range?.upperBandSpans.length>1?'<p>الصف الثاني المتاح '+range.upperBandSpans[1].map(s=>fmt(s.endMm-s.startMm)).join(' + ')+' مم</p>':'')+
   (summary?'<ul>'+summary+'</ul>':'')+'<div data-opt-msg aria-live="polite">'+esc(note)+'</div></div></details>';
  mountWallLights(host.querySelector('[data-wall-lights]'),{getDoc,wall,options});
  host.querySelector('details').ontoggle=e=>{open=e.target.open;};
 }
 host.oninput=e=>recorder(e);
 host.onchange=e=>{if(!e.target.dataset.op)return;recorder(e);if(e.target.type==='checkbox'||e.target.type==='radio'||e.target.tagName==='SELECT'){open=true;draw();if(e.target.type==='radio')host.querySelector('[data-op="mode"]:checked')?.focus({preventScroll:true});}};
 host.onclick=e=>{
  const act=e.target.closest('[data-opt-act]')?.dataset.optAct;if(!act)return;
  if(act==='profile'){
   const list=options.profiles??=[];if(list.length>=32)return;
   let id=1;while(list.some(p=>p.id==='p'+id))id++;
   list.push({id:'p'+id,type:'ledge',fromMm:0,toMm:null,bottomMm:0,topMm:null,depthMm:null,reference:''});
   open=true;draw();host.querySelector('[data-opt-act="profile"]').closest('details').open=true;return;
  }
  if(act==='remove-profile'){options.profiles.splice(Number(e.target.dataset.index),1);open=true;draw();host.querySelector('[data-opt-act="profile"]').closest('details').open=true;return;}
  const doc=getDoc(),configured=applyWallOptions(doc,wall,options);
  if(!configured.ok){note=configured.reason;open=true;draw();return;}
  const result=act==='draw'?buildUpperRows(configured.doc,wall):configured;
  if(!result.ok){note=result.reason;open=true;draw();return;}
  const status=apply(result.doc,'حُفظت خيارات هذا الجدار.');
  note=status?.ok===false?status.reason:act==='draw'?(options.mode==='none'?'أزيل العلوي الآلي لهذا الجدار، مع حفظ الصفوف المستقلة.':'ظهر العلوي في المسقط والمجسم.'):'حُفظت خيارات الجدار وتحدّثت المساحات المتاحة.';
  open=true;onSaved?.();draw();
 };
 draw();
}
