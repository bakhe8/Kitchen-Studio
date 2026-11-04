import {creationDefaults} from './kitchen-defaults-calculations.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {wallPairDatum,cleanWallPairs,evaluateWallPair} from './kitchen-wall-pair.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numFormat=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const mm=x=>numFormat.format(x)+' مم';
const tiers={base:'السفلي',upper:'العلوي'};
const button=(act,label,attrs='')=>'<button type="button" data-pair-act="'+act+'" '+attrs+'>'+esc(label)+'</button>';
const field=(key,label,value,placeholder='')=>'<label>'+esc(label)+'<span class="sv-input"><input dir="ltr" inputmode="decimal" autocomplete="off" data-pair-value="'+key+'" value="'+esc(value)+'" placeholder="'+esc(placeholder)+'"><small>مم</small></span></label>';

export function wallPairPlanes(doc,wall,tier){
 const runs=doc.kitchen.runs.filter(r=>r.wall===wall&&r.tier===tier);
 const defs=creationDefaults(doc),round=v=>Math.round(v*100)/100;
 const plane=(depth,bottom,height)=>({depth:round(depth*10),height:round((bottom+height/2)*10)});
 const fallback=tier==='upper'?plane(defs.upperDepth,defs.upperBottom,defs.upperHeight):plane(defs.baseDepth,0,defs.baseHeight);
 const groups=[];
 for(const r of runs){
  if(![r.depth,r.bottom,r.height].every(Number.isFinite))continue;
  const p=plane(r.depth,r.bottom,r.height);if(!groups.some(g=>g.depth===p.depth&&g.height===p.height))groups.push(p);
 }
 return {planes:groups.length?groups:[fallback],source:groups.length?'الصف المرسوم':'إعدادات الصف المقترح'};
}

// One small editor lives on the current wall. Raw input strings survive
// redraws; neither sketch lengths nor rough stroke coordinates become field readings.
export function wallPairEditor(host,{getDoc,wall,shownLength,apply,draw,notify,staged=false}){
 let form=null,changed=false,pendingLeave=null,original='',savedDatum='';
 function saved(){return getDoc().room.workshop?.wallPairs?.[wall()]||{};}
 function begin(tier){
  if(!Object.hasOwn(tiers,tier))tier='base';
  const r=saved()[tier],options=wallPairPlanes(getDoc(),wall(),tier),p=options.planes.length===1?options.planes[0]:{};
  form={tier,back:r?.backMm??'',front:r?.frontMm??'',depth:r?.depthMm??p.depth??'',height:r?.heightMm??p.height??'',error:r?.errorMm??'',side:r?.anchor?.side||'',
   offset:r?.anchor?Math.abs(r.anchor.offsetMm):'',direction:r?.anchor&&((r.anchor.side==='start'?1:-1)*r.anchor.offsetMm)<0?'out':'in',evidence:!!r?.anchor,planeOpen:options.planes.length>1&&!r,rebased:false};
  original=JSON.stringify(r??null);savedDatum=wallPairDatum(getDoc(),wall());changed=false;pendingLeave=null;
 }
 function open(tier){begin(tier==='base'||tier==='upper'?tier:saved().base||!saved().upper?'base':'upper');draw('[data-pair-value="back"]');}
 function close(runLeave=false){form=null;changed=false;const proceed=pendingLeave;pendingLeave=null;draw('[data-chain-act="pair"]');if(runLeave)proceed?.();}
 function collect(){
  if(!form)return null;
  const f=form,r=saved()[f.tier];
  const record={backMm:assistNumber(f.back),frontMm:assistNumber(f.front),depthMm:assistNumber(f.depth),heightMm:assistNumber(f.height),
   datum:r&&!f.rebased?r.datum:savedDatum};
  if(f.error!=='')record.errorMm=assistNumber(f.error);
  if(f.side){const v=assistNumber(f.offset);if(v===null||v<0)return null;record.anchor={side:f.side,offsetMm:(f.side==='start'?1:-1)*(f.direction==='out'?-1:1)*v};}
  return cleanWallPairs({[wall()]:{[f.tier]:record}})?.[wall()]?.[f.tier]??null;
 }
 function result(){
  const r=collect();if(!r)return '<span>أدخل القياسين عند المنسوب نفسه وبين جانبي الجدار كاملًا.</span>';
  const out=evaluateWallPair(getDoc(),wall(),r),delta=out.differenceMm;
  const diff=Number.isFinite(delta)?'<strong>'+(delta===0?'العرضان متساويان':(delta<0?'يضيق عند الوجه بمقدار ':'يتّسع عند الوجه بمقدار ')+mm(Math.abs(delta)))+'</strong>':'';
  if(staged&&!['stale','invalid'].includes(out.status))return diff+'<p>تُراجع مواقع الطرفين عند اكتمال محيط الغرفة.</p>';
  if(out.frontTrend==='level-or-within-error'&&delta!==0)return '<strong>فرق القياسين '+mm(Math.abs(delta))+'</strong>'+'<p>هذا الفرق ضمن دقة القياسين ولا يكفي لإثبات تضييق أو اتساع.</p>'+(out.status==='resolved'?'<p>العرض المحافظ '+mm(out.clearMm)+' قبل سماحات التركيب.</p>':'<p>'+esc(out.reason)+'</p>');
  if(out.status==='resolved')return diff+'<p>العرض المشترك قبل السماحات <b>'+mm(out.clearMm)+'</b> · '+(out.source==='outline'?'تحدّد الطرف من المحيط المقاس.':out.source==='scan'?'تحدّد الطرف من رفع الجدار المجاور.':'تحدّد الطرف من قياس الإزاحة.')+'</p>';
  if(out.status==='unlocated')return diff+'<p>يمكن حفظ القياسين الآن. عند تفصيل الطرف نحتاج موضع أحد الجانبين على خط عمودي معلوم.</p>';
  return diff+'<p class="sv-error">'+esc(out.reason)+'</p>';
 }
 function paint(){
  const n=host.querySelector('[data-pair-result]');if(n)n.innerHTML=result();
  const r=collect(),state=r&&evaluateWallPair(getDoc(),wall(),r);
  const extra=host.querySelector('[data-pair-offer]');
  if(extra)extra.hidden=!!form?.evidence||!state||!(state.status==='unlocated'||staged&&state.status==='resolved');
 }
 function html(){
  if(!form)return '';
  const f=form,opts=wallPairPlanes(getDoc(),wall(),f.tier),r=saved()[f.tier],stale=r&&evaluateWallPair(getDoc(),wall(),r).status==='stale'&&!f.rebased;
  return '<section class="sv-pair" data-pair-editor aria-label="قياس الظهر والوجه"><header><h3>قياس الظهر والوجه</h3><div role="group" aria-label="مستوى الصف">'+Object.entries(tiers).map(([k,t])=>button('tier-'+k,t,'aria-pressed="'+(k===f.tier)+'"')).join('')+'</div></header>'+
   '<p>من بداية هذا الجدار إلى نهايته، وعلى نفس الارتفاع.</p><div class="sv-pair-values">'+field('back','عند الظهر',f.back,'الرسم '+numFormat.format(shownLength()))+field('front','عند الوجه',f.front)+'</div>'+
   '<details data-pair-plane '+(f.planeOpen?'open':'')+'><summary>خط القياس · '+(f.depth!==''?'عمق '+mm(assistNumber(f.depth)??0):'اختر عمق الصف')+' · '+(f.height!==''?'منسوب '+mm(assistNumber(f.height)??0):'حدّد المنسوب')+'</summary>'+
   '<p>'+esc(opts.source)+' · اضبط العمق والمنسوب إذا قست عند خط مختلف.</p>'+(opts.planes.length>1?'<label>خط من الرسم<select data-pair-plane-pick><option value="">اختر بحسب موضع القياس</option>'+opts.planes.map((p,i)=>'<option value="'+i+'">عمق '+mm(p.depth)+' · منسوب '+mm(p.height)+'</option>').join('')+'</select></label>':'')+
   '<div class="sv-pair-values">'+field('depth','عمق خط الوجه عن الظهر',f.depth)+field('height','الارتفاع عن الأرض',f.height)+field('error','خطأ القياس الأقصى إن عُرف',f.error)+'</div></details>'+
   '<div class="sv-pair-result" data-pair-result aria-live="polite">'+result()+'</div><div data-pair-offer hidden>'+button('anchor','تحديد موضع أحد الطرفين')+'</div>'+
   (f.evidence?'<div class="sv-pair-evidence"><p>قِس من إسقاط ركن الظهر عموديًا إلى جانبه عند خط الوجه. أدخل صفرًا فقط إذا تحققت من التطابق.</p><div class="sv-pair-values"><label>الطرف المقاس<select data-pair-value="side">'+[['','اختر الطرف'],['start','طرف بداية الجدار'],['end','طرف نهاية الجدار']].map(([v,t])=>'<option value="'+v+'" '+(v===f.side?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>اتجاه الإزاحة<select data-pair-value="direction"><option value="in">للداخل</option><option value="out" '+(f.direction==='out'?'selected':'')+'>للخارج</option></select></label>'+field('offset','إزاحة الطرف المقاس',f.offset)+'</div>'+button('no-anchor','الاكتفاء بالقياسين')+'</div>':'')+
   (stale?'<p class="sv-error">تغيّر مرجع الجدار منذ الرفع. أعد التحقق من الأبعاد قبل ربطها بالمحيط الحالي.</p>'+button('rebase','راجعت القياس على الجدار الحالي'):'')+
   '<div class="sv-pair-actions">'+button('save','حفظ القياسين','class="sv-primary"')+button('close',changed?'تجاهل التعديل':'إغلاق')+(r?button('remove','حذف القياس المحفوظ'):'')+'</div></section>';
 }
 function store(record){
  const doc=getDoc(),w=doc.room.workshop||{},tier=form.tier;
  if(JSON.stringify(saved()[tier]??null)!==original||wallPairDatum(doc,wall())!==savedDatum){notify('تغيّر الجدار أو قياسه المحفوظ. افتح القياس من جديد.',true);return;}
  const pairs={...w.wallPairs},thisWall={...pairs[wall()]};
  if(record)thisWall[tier]=record;else delete thisWall[tier];
  if(Object.keys(thisWall).length)pairs[wall()]=thisWall;else delete pairs[wall()];
  const workshop={...w};if(Object.keys(pairs).length)workshop.wallPairs=pairs;else delete workshop.wallPairs;
  const message=record?(staged?'حُفظ القياس في مسودة المحيط.':'حُفظ قياس الظهر والوجه.'):'حُذف قياس الظهر والوجه لهذا الصف.';
  const res=apply({...doc,room:{...doc.room,workshop}},message);
  if(res?.ok===false||res?.saved===false){notify(res.reason||'تعذّر حفظ القياس. بقي القياسان مفتوحين.',true);return;}
  close(true);notify(message);
 }
 function act(a){
  if(!form)return false;
  if(a==='close'){close(true);return true;}
  if(a.startsWith('tier-')){
   const t=a.slice(5);if(t===form.tier)return true;
   if(changed){notify('احفظ تعديل الصف الحالي أو تجاهله قبل اختيار صف آخر.',true);return true;}
   begin(t);draw();return true;
  }
  if(a==='save'){
   const r=collect();
   if(!r||form.evidence&&!form.side){notify('أكمل القياسين وعمق خطهما ومنسوبهما، وأكمل إزاحة الطرف أو اختر الاكتفاء بالقياسين.',true);return true;}
   const checked=evaluateWallPair(getDoc(),wall(),r);if(['stale','invalid'].includes(checked.status)){notify(checked.reason,true);return true;}
   store(r);return true;
  }
  if(a==='remove'){store(null);return true;}
  if(a==='anchor'){form.evidence=true;draw('[data-pair-value="side"]');return true;}
  if(a==='no-anchor'){if(form.side||form.offset!=='')changed=true;Object.assign(form,{side:'',offset:'',direction:'in',evidence:false});draw();return true;}
  if(a==='rebase'){form.rebased=true;changed=true;draw();return true;}
  return false;
 }
 function input(t){
  if(!form)return false;
  if(t.hasAttribute?.('data-pair-plane-pick')){
   const p=t.value!==''&&wallPairPlanes(getDoc(),wall(),form.tier).planes[Number(t.value)];
   if(p){form.depth=p.depth;form.height=p.height;changed=true;draw();}return true;
  }
  const k=t.dataset?.pairValue;
  if(!['back','front','depth','height','error','side','direction','offset'].includes(k))return false;
  form[k]=t.value;changed=true;paint();return true;
 }
 function leave(proceed){
  if(!form)return true;
  if(!changed){form=null;return true;}
  pendingLeave=proceed;notify('القياسان غير محفوظين. احفظهما أو اختر تجاهل التعديل.',true);return false;
 }
 return {open,active:()=>!!form,dirty:()=>!!form&&changed,leave,html,paint,act,input,reset:()=>{form=null;changed=false;pendingLeave=null;},
  toggle:t=>{if(form&&t.hasAttribute?.('data-pair-plane'))form.planeOpen=t.open;}};
}
