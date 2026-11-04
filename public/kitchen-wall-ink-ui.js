import {surveySymbol,surveySizeGrip} from './kitchen-survey-symbols.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {editSurveyFeatureChain,featureFromDimensionsMm} from './kitchen-cad-measurement.js';
// A mark is provisional until the technician accepts its measurements.
// Keep tentative values separate from both the committed CAD and wall draft.
import {makeWallInkProposal,stageWallInkBatch,reviewWallObject} from './kitchen-wall-ink-model.js';
import {suggestWallOpening,parseWallInkDimensions} from './kitchen-wall-ink-recognition.js';
import {wallInkNotes} from './kitchen-wall-ink-notes.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {chainLabels,resolveChain,pointKinds} from './kitchen-chain-model.js';
import {mountWallInkGestures,wallInkPoint} from './kitchen-wall-ink-gestures.js';
import {mountDrawingContext} from './kitchen-drawing-context.js';
import {mountDrawingViewport} from './kitchen-drawing-viewport.js';
import {mountSurveyPrecision} from './kitchen-survey-precision.js';

const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pen:'قلم',door:'باب',window:'شباك',water:'ماء',electric:'كهرباء',drain:'صرف',gas:'غاز',vent:'فتحة تهوية الشفاط'};
const moreKinds=['drain','gas','vent'];
const insertNames={door:'باب',window:'شباك',water:'مخرج ماء',electric:'مقبس كهرباء',drain:'فتحة صرف',gas:'مخرج غاز',vent:'فتحة تهوية الشفاط'};
const button=(k,l,extra='')=>'<button type="button" data-ink-action="'+k+'" '+extra+'>'+l+'</button>';
const attr=(b,k)=>b.hasAttribute?.(k);
const datums={door:'من طرف الباب البعيد',window:'من طرف الشباك البعيد',water:'من مركز مخرج الماء',electric:'من مركز المقبس',drain:'من مركز الصرف',gas:'من مركز الغاز',vent:'من مركز فتحة تهوية الشفاط',start:'من بداية الدواليب',stop:'من نهاية الدواليب',corner:'من الركن'};
const physicalExtras=new Set(['widthMm','heightMm','depthMm']);
const allowedDim=new Set(['gapMm','widthMm','heightMm','bottomMm','frameDistance']);
const openings=k=>k==='door'||k==='window';
const approxMm=v=>fmt.format(Math.round(v/10)*10);
const asNumber=v=>typeof v==='number'?v:assistNumber(v);
const cleanMm=n=>Math.round(n*1e6)/1e6;

export function mountWallInk(host,api){
 let tool='pen',pending=null,earlier=[],undo=null,warning='',waiting=null;
 const canDraw=()=>!waiting&&!api.unadopted()&&(!pending||pending.mode==='new');
 const count=()=>earlier.length+(pending?.mode==='new'?1:0);
 const currentBatch=()=>pending?.mode==='new'?[...earlier,pending]:earlier;
 const q=s=>host.querySelector(s);
 const context=()=>({room:api.room(),wall:api.wall(),chain:api.chain()});
 function viewTools(){
  const view=(key,title)=>button(key,studioIcon(key),'data-ink-camera aria-label="'+title+'" title="'+title+'"');
  return '<div class="sv-sheet-camera" role="group" aria-label="عرض ورقة الجدار">'+view('zoom-in','تكبير الجدار')+view('fit','عرض الجدار كاملًا')+view('zoom-out','تصغير الجدار')+'</div>';
 }
 const toolButton=k=>'<button type="button" class="sv-ink-tool" data-ink-tool="'+k+'" aria-pressed="'+(tool===k)+'" title="'+esc(insertNames[k]||'قلم الرسم')+'">'+surveySymbol(k)+esc(labels[k])+'</button>';
 function draftStatus(){
  if(!pending)return '';
  if(pending.mode==='choose')return 'موضع مرسوم · اختر نوع العنصر';
  if(pending.mode==='object'&&objectChanged())return 'تعديل بانتظار التطبيق';
  if(pending.mode==='existing'&&asNumber(pending.values[pending.key])!==pending.old)return 'تعديل بانتظار التطبيق';
  if(pending.mode==='object')return pending.hit.referenceId?'عنصر من الرسم · قيد المراجعة':'خصائص العنصر المحدد';
  if(pending.mode==='existing')return 'مراجعة قياس العنصر المحدد';
  return count()>1?fmt.format(count())+' عناصر بانتظار التثبيت':(labels[pending.proposal.row.kind]||'عنصر')+' · بانتظار التثبيت';
 }
 function provisional(){
  if(!pending)return false;
  if(pending.mode==='object')return objectChanged();
  if(pending.mode==='existing')return asNumber(pending.values[pending.key])!==pending.old;
  return true;
 }
 function paperPrompt(){
  if(pending||!canDraw())return '';
  if(tool==='pen')return 'ارسم فتحة أو حدّد موضع خدمة';
  if(openings(tool))return 'اسحب بين طرفي برواز '+(tool==='door'?'الباب':'الشباك');
  return 'المس مركز '+insertNames[tool];
 }
 function toolbar(){
  if(!canDraw()&&!pending&&api.unadopted())return '<div class="sv-ink-tools sv-ink-stagebar"><span>اضغط عنصرًا لعرض مقاساته، أو اسحبه إلى موضعه على الجدار.</span></div>';
  if(!canDraw())return pending?'<div class="sv-ink-tools sv-ink-stagebar" data-ink-stagebar><span>'+esc(pending.mode==='choose'?'حدد نوع العلامة على الجدار':'راجع قياس العنصر على الورقة')+'</span></div>':'';

  return '<div class="sv-ink-tools" role="group" aria-label="أدوات الرسم على الجدار">'+['pen','door','window','water','electric'].map(toolButton).join('')+
   '<details class="sv-ink-more" data-ink-more><summary title="الصرف والغاز والتهوية"'+(moreKinds.includes(tool)?' class="sv-service-active"':'')+'>'+esc(moreKinds.includes(tool)?labels[tool]:'خدمات')+'</summary><div>'+moreKinds.map(toolButton).join('')+'</div></details></div>';
 }
 function note(){
  if(pending||api.unadopted())return '';
  const text=tool==='pen'?'اسحب لرسم فتحة أو لتحريك عنصر. اضغط مطوّلًا لخيارات الموضع.':openings(tool)?'اسحب بين طرفي البرواز الخارجي.':'المس موضع مركز المخرج.';
  const undoLabel=undo?.count>1?'تراجع عن تثبيت الرسومات':'تراجع عن آخر رسم';
  return '<div class="sv-ink-note"><span>'+text+'</span>'+button('type',studioIcon('keyboard')+'إدخال قياس','title="إدخال قياس العنصر بالأرقام"')+(undo?button('undo',studioIcon('undo'),'aria-label="'+undoLabel+'" title="'+undoLabel+'"'):'')+'</div>';
 }
 function caption(p,k){
  if(k==='gapMm')return p.referenceKind?(datums[p.referenceKind]||'من طرف العنصر السابق'):'من ركن البداية';
  if(k==='bottomMm')return pointKinds.has(p.row.kind)?'ارتفاع المركز':'ارتفاع أسفل البرواز';
  return k==='widthMm'?'عرض البرواز':k==='heightMm'?'الارتفاع':'قياس البرواز';
 }
 function sourceCaption(mark){
  if(mark.gesture.typed)return 'قياسات الشريط';
  if(mark.proposal.fields.every(key=>mark.edits.has(key)&&Number.isFinite(asNumber(mark.values[key]))))return 'أبعاد مدخلة بالملليمتر';
  if(mark.proposal.inferredFields?.length)return mark.proposal.preset==='repeat'?'تقديري · بمقاس آخر عنصر مماثل':'تقديري · مع مقاس افتراضي';
  return mark.edits.size?'تقدير الرسم مع تصحيح يدوي':'تقدير الرسم · أقرب ١٠ مم';
 }
 function editor(){
  if(!pending)return '';
  let body='';
  if(pending.mode==='choose'){
   body='<b>ما العنصر في هذا الموضع؟</b><div class="sv-ink-kinds">'+Object.keys(labels).filter(k=>k!=='pen').map(k=>button('kind-'+k,esc(labels[k]))).join('')+'</div>';
  }else if(pending.mode==='object'){
   const o=pending,kind=o.hit.row.kind;
   const keys=Object.keys(o.values),point=pointKinds.has(kind);
   const extra=keys.filter(k=>point?physicalExtras.has(k):k==='depthMm');
   const input=(key,title,value,attrs='')=>'<label>'+esc(title)+' <small>مم</small><input data-ink-value="'+key+'" inputmode="decimal" dir="ltr" autocomplete="off" value="'+esc(value)+'" '+attrs+'></label>';
   const fields=ks=>'<div class="sv-ink-fields">'+ks.map(k=>input(k,o.captions[k],o.values[k])).join('')+'</div>';
   const position=o.tape?'<fieldset class="sv-tape-position"><legend>'+esc(point?'موضع مركز المخرج':openings(kind)?'موضع أول طرف للبرواز':'موضع أول طرف للعنصر')+'</legend><div class="sv-ink-fields">'+
    input('tapeGap','من '+o.tape.label,o.tape.raw??relativeGap(o),'aria-label="'+esc(api.objectGapLabel(o.candidate.chain.rows,o.candidate.index))+' بالملليمتر"')+
    input('gapMm','من ركن البداية',o.values.gapMm,'aria-label="'+esc(o.captions.gapMm)+' بالملليمتر"')+'</div></fieldset>':'';
   return '<section class="sv-ink-editor sv-ink-object" aria-label="خصائص العنصر على الجدار"><div class="sv-ink-title">'+surveySymbol(kind)+'<strong>'+esc(labels[kind]||chainLabels[kind])+'</strong><small>'+(o.hit.referenceId?'من الرسم · مقاسات مقترحة':'قياس على الجدار')+'</small></div>'+
    (o.suggested?'<small>اقتراح السحب · راجع المقاسات بالملليمتر</small>':'')+position+fields(keys.filter(k=>!extra.includes(k)&&!(o.tape&&k==='gapMm')))+
    (extra.length?'<details><summary>'+(point?'أبعاد المخرج والبروز':'البروز من الجدار')+'</summary>'+fields(extra)+'</details>':'')+
    button('confirm',o.hit.referenceId?'استخدام هذه المقاسات في الرفع':'تطبيق القياسات','class="sv-ink-primary"')+button('cancel','إلغاء')+
    (o.hit.referenceId?'':'<button type="button" data-chain-act="reading-details" class="sv-reading-details">تفاصيل القياس وترتيبه</button>')+
    '<p class="sv-ink-error" data-ink-preview-hint hidden></p><p class="sv-ink-error" data-ink-error role="status">'+esc(warning)+'</p></section>';
  }else if(pending.mode==='existing'){
   body=(pending.suggested?'<small>اقتراح السحب · القياس السابق '+esc(fmt.format(pending.old))+' مم</small>':'')+'<label class="sv-ink-dimension">'+esc(pending.label)+' <small>مم</small><input data-ink-existing data-chain-prop="'+pending.key+'" data-ink-value="'+pending.key+'" inputmode="decimal" dir="ltr" autocomplete="off" value="'+esc(pending.values[pending.key])+'"></label>'+button('confirm','تطبيق القياس','class="sv-ink-primary"');
  }else{
   const {proposal,values}=pending;
   const kind=proposal.row.kind;
   const chooser=!pending.gesture.typed&&openings(kind)?'<div class="sv-ink-kinds" role="group" aria-label="نوع الفتحة">'+['door','window'].map(k=>button('kind-'+k,esc(labels[k]),'aria-pressed="'+(kind===k)+'"')).join('')+'</div>':'<b>'+esc(labels[kind])+'</b>';
   const field=k=>'<label>'+esc(caption(proposal,k))+' <small>مم</small><input inputmode="decimal" autocomplete="off" dir="ltr" data-ink-value="'+k+'" value="'+esc(values[k])+'"></label>';
   body='<div class="sv-ink-title">'+chooser+'<span data-ink-source>'+sourceCaption(pending)+'</span></div><div class="sv-ink-fields">'+proposal.fields.map(field).join('')+'</div>'+(pending.gesture.typed&&proposal.fields.includes('widthMm')?'<small class="sv-ink-shortcut">يمكن كتابة المسافة والعرض معًا، مثل <bdi>٤٠٠ ٩٠٠</bdi>.</small>':'')+
    button('confirm','تثبيت القياسات'+(count()>1?' ('+fmt.format(count())+')':''),'class="sv-ink-primary"');
  }
  const batch=pending.mode==='existing'?'':'<p class="sv-ink-batch">'+(count()>1?(count()===2?'عنصران في المسودة':fmt.format(count())+' عناصر في المسودة'):'مسودة الرسم')+' · يمكنك رسم العنصر التالي قبل التثبيت</p>';
  return '<section class="sv-ink-editor'+(pending.mode==='existing'?' sv-ink-existing':'')+'" aria-label="قياس على الرسم">'+batch+body+
   button('cancel',pending.mode==='existing'?'إلغاء التعديل':earlier.length?'تراجع عن آخر رسم':'إلغاء الرسم')+'<p class="sv-ink-error" data-ink-preview-hint hidden></p><p class="sv-ink-error" data-ink-error role="status">'+esc(warning)+'</p></section>';
 }
 function show(msg){
  warning=msg;const p=q('[data-ink-error]');if(p)p.textContent=msg;
  api.notify(msg,true);
 }
 function guard(){
  return '<div class="sv-guard" role="alert"><b>يوجد رسم لم تثبّت قياساته.</b><div>'+
   button('stay','متابعة القياس')+button('discard-leave','تجاهل الرسم ومتابعة')+'</div></div>';
 }
 function start(gesture,kind=gesture.kind){
  if(api.unadopted()){show('توجد عناصر مرسومة لهذا الجدار. استخدم عناصر الرسم للرفع أولًا.');return;}
  const replacing=pending?.gesture===gesture,ctx=context();
  // The renderer may suggest another type for the *same* mark. Only a new
  // gesture advances the sequence. Validate before replacing anything.
  if(!replacing&&pending?.mode==='new'&&typeof pending.values.gapMm==='string')unpack(pending,pending.values.gapMm);
  const prefix=replacing?earlier:currentBatch();
  const staged=prefix.length?stageWallInkBatch({...ctx,items:prefix}):{ok:true,chain:ctx.chain};
  if(!staged.ok){show(staged.reason);return;}
  const spatial=prefix.length?api.check?.(staged.chain):null;
  if(spatial?.ok===false){show(spatial.reason);return;}
  if(kind==='pen'){
   if(!gesture.typed&&!gesture.tap&&gesture.dragged!==false){
    kind=suggestWallOpening(gesture.start,gesture.end,api.room().height*10);
   }else{
    earlier=prefix;pending={mode:'choose',gesture};warning='';api.draw();return;
   }
  }
  const result=makeWallInkProposal({...ctx,chain:staged.chain,...gesture,kind,dragged:gesture.dragged??!gesture.tap});
  if(!result.ok){show(result.reason);return;}
  const values=Object.fromEntries(result.fields.map(k=>[k,result.row[k]??''])),edits=new Set();
  if(replacing&&pending?.mode==='new'){
   for(const k of pending.edits)if(Object.hasOwn(values,k)){values[k]=pending.values[k];edits.add(k);}
  }
  earlier=prefix;pending={mode:'new',proposal:result,gesture,values,edits};
  warning='';api.draw(gesture.typed?'[data-ink-value="gapMm"]':undefined);
 }
 function selectDim(index,key,label,suggested){
  const row=api.chain().rows[index];if(!row||!allowedDim.has(key))return false;
  const old=key==='frameDistance'?row.frameRead?.distanceMm:row[key];
  if(old==null)return false;
  // A literal numeric edit has no other mandatory properties to re-enter.
  pending={mode:'existing',index,key,label,values:{[key]:suggested??old},rowId:row.id,suggested:suggested!=null,old};
  warning='';api.draw('[data-chain-prop="'+key+'"]');q('[data-ink-existing]')?.select?.();return true;
 }
 function sameObject(hit){const h=pending?.mode==='object'?pending.hit:null;
  return !!(h&&hit&&(h.referenceId?h.referenceId===hit.referenceId:!hit.referenceId&&h.row.id===hit.row.id));
 }
 function selectObject(hit,focusKey,changes={}){
  if(!hit)return false;
  if(sameObject(hit)&&Object.keys(changes).length){
   if(pending.tape&&Object.hasOwn(changes,'gapMm'))pending.tape.raw=null;
   Object.assign(pending.values,changes);pending.suggested=true;warning='';api.draw();return true;
  }
  const ctx=context(),candidate=reviewWallObject(ctx.room,ctx.wall,ctx.chain,hit);
  if(!candidate.ok){show(candidate.reason);return false;}
  api.onInspect?.(hit);
  const row=candidate.chain.rows[candidate.index],kind=row.kind,point=pointKinds.has(kind);
  const measured=Object.hasOwn(row,'widthMm');
  const keys=['gapMm'];
  if(measured)keys.push('bottomMm','widthMm','heightMm','depthMm');
  const captions={gapMm:measured?(point?'مركز المخرج من ركن البداية':'طرف العنصر من ركن البداية'):api.objectGapLabel(candidate.chain.rows,candidate.index),
    bottomMm:point?'ارتفاع المركز عن الأرض':'ارتفاع الأسفل عن الأرض',heightMm:'الارتفاع',
    widthMm:openings(kind)?'عرض البرواز كاملًا':point?'عرض المخرج':'عرض العنصر',depthMm:'البروز من وجه الجدار'};
  const original=Object.fromEntries(keys.map(k=>[k,k==='gapMm'&&measured?hit.stationMm:k==='widthMm'&&!point?hit.widthMm:row[k]]));
  const previous=candidate.chain.rows[candidate.index-1];
  // Both fields address the same physical position. Keep the saved chain's
  // datum and use the absolute station for existing drag and preview paths.
  const tape=measured&&previous&&row.from!=='origin'&&!hit.referenceId?
    {baseMm:cleanMm(hit.stationMm-row.gapMm),label:api.datumLabel(previous),raw:null}:null;
  pending={mode:'object',hit,candidate,captions,original,values:{...original,...changes},tape,suggested:Object.keys(changes).length>0};
  if(tape&&focusKey==='gapMm'&&!Object.keys(changes).length)focusKey='tapeGap';
  warning='';api.draw(focusKey?'[data-ink-value="'+focusKey+'"]':undefined);
  if(focusKey)q('[data-ink-value="'+focusKey+'"]')?.select?.();
  return true;
 }
 function relativeGap(o){
  const station=asNumber(o.values.gapMm);
  return Number.isFinite(station)?cleanMm(station-o.tape.baseMm):'';
 }
 function editedReading(){return pending?.mode==='object'&&!pending.hit.referenceId&&objectChanged();}
 function objectChanged(){return pending?.mode==='object'&&Object.entries(pending.original).some(([k,v])=>asNumber(pending.values[k])!==v);}
 function objectRow(o){
  const r={...o.candidate.chain.rows[o.candidate.index]};
  for(const [key,raw] of Object.entries(o.values)){
   const value=asNumber(raw);
   if(!Number.isFinite(value))return null;
   r[key]=value;
  }
  return r;
 }
 function confirm(){
  if(!pending||pending.mode==='choose')return;
  const ctx=context();let result;
  if(pending.mode==='new'&&typeof pending.values.gapMm==='string')unpack(pending,pending.values.gapMm);
  if(pending.mode==='object'){
   const o=pending,row=objectRow(o),{index}=o.candidate;
   if(o.tape?.raw!=null&&asNumber(o.tape.raw)<0){show('أدخل مسافة الشريط من المرجع بقيمة صفر أو أكثر.');q('[data-ink-value="tapeGap"]')?.focus();return;}
   if(!row){show('أكمل المقاسات بالملليمتر.');return;}
   if(!o.hit.referenceId&&!objectChanged()){clear();api.draw();return;}
   if('widthMm' in row){
    const feature=featureFromDimensionsMm(ctx.room,{kind:row.kind,wall:ctx.wall},
     {u:row.gapMm,width:row.widthMm,height:row.heightMm,bottom:row.bottomMm,depth:row.depthMm});
    const edited=editSurveyFeatureChain(ctx.room,ctx.wall,o.candidate.chain,index,feature);
    result={...edited,index};
   }else{
    const chain={...o.candidate.chain,rows:o.candidate.chain.rows.slice()};chain.rows[index]=row;
    result={...resolveChain(ctx.room,ctx.wall,chain),chain,index};
   }
  }else if(pending.mode==='existing'){
   const {key,index,rowId,values}=pending;
   const value=asNumber(values[key]);const chain=structuredClone(ctx.chain),row=chain.rows[index];
   if(!row||row.id!==rowId||!Number.isFinite(value)){show('أدخل قياسًا صالحًا بالملليمتر.');return;}
   if(key==='frameDistance'){if(!row.frameRead){show('تغيّر مرجع البرواز.');return;}row.frameRead.distanceMm=value;}
   else row[key]=value;
   result=resolveChain(ctx.room,ctx.wall,chain);
   result={...result,chain,index};
  }else result=stageWallInkBatch({...ctx,items:currentBatch()});
  if(!result.ok){show(result.reason);return;}
  const check=api.check?.(result.chain);
  if(check?.ok===false){show(check.reason);return;}
  const before=structuredClone(ctx.chain),wasDirty=api.dirty();
  undo={before,wasDirty,after:JSON.stringify(result.chain),wall:ctx.wall,selected:api.selected(),count:count()};
  clear();
  api.replace(result.chain,result.index,true);
  q('[data-ink-tool="'+tool+'"]')?.focus({preventScroll:true});return true;
 }
 function clear(){earlier=[];pending=null;waiting=null;warning='';}
 function dropLast(){
  waiting=null;warning='';pending=earlier.pop()||null;
  api.draw(pending?undefined:'[data-ink-tool="'+tool+'"]');
 }
 function handleClick(b){
  if(attr(b,'data-ink-edit')&&(pending?.mode==='new'||pending?.mode==='object')){
   const key=b.dataset.inkEdit;
   if(Object.hasOwn(pending.values,key)||key==='tapeGap'&&pending.tape){
    const input=q('[data-ink-value="'+key+'"]');input?.focus({preventScroll:true});input?.select();input?.scrollIntoView?.({block:'nearest'});
   }
   return true;
  }
  if(attr(b,'data-ink-tool')){
   if(pending?.mode==='object'&&!objectChanged())clear();
   if(!canDraw()){show('أكمل القياس الحالي أو ألغِه أولًا.');return true;}
   if(Object.hasOwn(labels,b.dataset.inkTool)){tool=b.dataset.inkTool;api.draw('[data-ink-tool="'+tool+'"]');}
   return true;
  }
  if(!attr(b,'data-ink-action'))return false;
  const a=b.dataset.inkAction;
  if(['zoom-in','zoom-out','fit'].includes(a)){
   if(a==='fit')viewport.reset();else viewport.zoomBy(a==='zoom-in'?1.35:1/1.35);paint();return true;
  }
  if(a==='stay'){waiting=null;api.draw();return true;}
  if(a==='discard-leave'){const next=waiting;clear();api.draw();next?.();return true;}
  if(a==='cancel'){dropLast();return true;}
  if(a==='undo'){
   if(!pending&&undo&&undo.wall===api.wall()&&undo.after===JSON.stringify(api.chain())){
    const old=undo;undo=null;api.replace(old.before,old.selected,old.wasDirty);
   }
   return true;
  }
  if(a==='type'&&!pending){start({kind:tool,typed:true,tap:true,dragged:false});return true;}
  if(a==='confirm'){confirm();return true;}
  if(a.startsWith('kind-')&&pending&&Object.hasOwn(labels,a.slice(5))){if(pending.proposal?.row.kind!==a.slice(5))start(pending.gesture,a.slice(5));return true;}
  return true;
 }
 function fieldInput(t){
  if(!pending||!attr(t,'data-ink-value'))return false;
  const key=t.dataset.inkValue;
  if(pending.mode==='object'&&pending.tape){
   if(key==='tapeGap'){
    const value=asNumber(t.value);
    pending.tape.raw=t.value;
    const station=value!==null&&value>=0?cleanMm(pending.tape.baseMm+value):'';
    pending.values.gapMm=station;
    const other=q('[data-ink-value="gapMm"]');if(other)other.value=String(station);
    warning='';const error=q('[data-ink-error]');if(error)error.textContent='';
    paint();return true;
   }
   if(key==='gapMm'){
    pending.tape.raw=null;
    const station=asNumber(t.value),other=q('[data-ink-value="tapeGap"]');
    if(other)other.value=station===null?'':String(cleanMm(station-pending.tape.baseMm));
   }
  }
  if(Object.hasOwn(pending.values||{},key)){
   if(t.value!==String(pending.values[key])&&asNumber(t.value)!==asNumber(pending.values[key]))pending.pairSupplied=false;
   pending.values[key]=t.value;pending.edits?.add(key);warning='';const p=q('[data-ink-error]');if(p)p.textContent='';
   paint();
  }
  return true;
 }
 function beginPrecisionScrub(){
  if(!pending||waiting)return null;
  const owner=pending,values={...owner.values},edits=owner.edits&&new Set(owner.edits),pairSupplied=owner.pairSupplied,tapeRaw=owner.tape?.raw,beforeWarning=warning;
  const fields=Object.keys(values).concat(owner.tape?['tapeGap']:[]).map(key=>q('[data-ink-value="'+key+'"]')).filter(Boolean);
  const text=fields.map(input=>[input,input.value]);
  return ()=>{
   if(pending!==owner)return;
   owner.values=values;owner.pairSupplied=pairSupplied;if(edits)owner.edits=edits;if(owner.tape)owner.tape.raw=tapeRaw;
   for(const [input,value] of text){
    input.value=value;const current=q('[data-ink-value="'+input.dataset.inkValue+'"]');if(current)current.value=value;
   }
   warning=beforeWarning;const error=q('[data-ink-error]');if(error)error.textContent=warning;paint();
  };
 }
 function unpack(p,text){
  const parts=parseWallInkDimensions(text,p.proposal.fields);
  if(!parts)return false;
  Object.assign(p.values,parts);p.pairSupplied=true;Object.keys(parts).forEach(key=>p.edits.add(key));
  for(const [key,value] of Object.entries(parts)){
   const input=q('[data-ink-value="'+key+'"]');if(input)input.value=String(value);
  }
  paint();return true;
 }
 function onPaste(e){
  if(pending?.mode!=='new'||e.target.dataset.inkValue!=='gapMm')return;
  const raw=e.clipboardData?.getData('text');
  if(!unpack(pending,raw))return;
  e.preventDefault();q('[data-ink-action="confirm"]')?.focus({preventScroll:true});
 }
 function onKey(e){
  if(e.isComposing)return;
  if(precision.keydown(e))return;
  if(['Enter',' '].includes(e.key)&&attr(e.target,'data-ink-edit')){
   e.preventDefault();e.stopPropagation();handleClick(e.target);return;
  }
  // A focused tool starts an exact reading as soon as the technician types.
  // It may follow a valid freehand mark in the same unconfirmed batch.
  if(canDraw()&&tool!=='pen'&&e.target.dataset?.inkTool===tool&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/^[0-9٠-٩۰-۹]$/.test(e.key)){
   e.preventDefault();const previous=pending;start({kind:tool,typed:true,tap:true,dragged:false});
   const input=q('[data-ink-value="gapMm"]');
   if(pending!==previous&&pending?.mode==='new'&&input){pending.values.gapMm=e.key;input.value=e.key;input.focus({preventScroll:true});}
   return;
  }
  if(!pending)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dropLast();return;}
  if(e.key!=='Enter'||!attr(e.target,'data-ink-value'))return;
  e.preventDefault();e.stopPropagation();
  const k=e.target.dataset.inkValue,p=pending.proposal;
  if(pending.mode==='new'&&k==='gapMm'&&(pending.pairSupplied||unpack(pending,pending.values[k]))){confirm();return;}
  if(pending.mode==='new'&&k==='gapMm'&&p.fields.includes('widthMm')){
   const next=q('[data-ink-value="widthMm"]');next?.focus();next?.select();return;
  }
  confirm();
 }
 function paint(){
  paintPreview();api.onPaint?.();
 }
 function paintPreview(){
  const objectActions=q('[data-object-save-footer]'),wallActions=q('[data-wall-save-footer]');
  if(objectActions&&wallActions){
   const editing=editedReading()&&!waiting;objectActions.hidden=!editing;wallActions.hidden=!!editing;
  }
  if(pending){
   const state=q('[data-chain-state]');
   if(state){state.textContent=draftStatus();state.classList.toggle('sv-dirty',provisional()||api.dirty());}
  }
  const source=q('[data-ink-source]');
  if(source&&pending?.mode==='new')source.textContent=sourceCaption(pending);
  const board=q('[data-survey-elevation]'),svg=board?.querySelector?.('svg.survey-wall-sheet');
  if(!svg)return;
  svg.querySelector('[data-ink-preview]')?.remove();
  if(!pending)return;
  const ds=svg.dataset,hint=q('[data-ink-preview-hint]');
  if(hint){hint.hidden=true;hint.textContent='';}
  if(!(Number(ds.inkWidth)>0&&Number(ds.inkHeight)>0))return;
  const insert=body=>{if(body)svg.insertAdjacentHTML('beforeend','<g data-ink-preview="">'+body+'</g>');};
  function warn(msg){if(hint){hint.hidden=false;hint.textContent=msg;}}
  if(pending.mode==='object'){
   const o=pending,r=objectRow(o);
   if(o.tape?.raw!=null&&asNumber(o.tape.raw)<0)warn('مسافة الشريط من المرجع يجب أن تكون صفرًا أو أكثر.');
   if(o.tape&&o.tape.raw==null&&relativeGap(o)<0)warn('الموضع قبل القياس السابق. عند التطبيق يصبح ركن البداية مرجع هذا القياس.');
   if(!r||!objectChanged())return;
   const gap=r.gapMm-o.original.gapMm,station=o.hit.stationMm+gap;
   const width=r.widthMm;
   if(width!=null){
    const row={...r,gapMm:station,widthMm:width};
    const drawing=drawMark(ds,{proposal:{row,datumMm:0,stationMm:station},values:row},true,warn,false);
    const key=esc(o.hit.key),xx=Number(ds.inkLeft)+station*Number(ds.inkWidth)/Number(ds.inkWallMm),
     yy=Number(ds.inkTop)+(1-r.bottomMm/Number(ds.inkHeightMm))*Number(ds.inkHeight);
    const w=width*Number(ds.inkWidth)/Number(ds.inkWallMm),h=r.heightMm*Number(ds.inkHeight)/Number(ds.inkHeightMm);
    const point=pointKinds.has(r.kind),inside=station>=0&&station+(point?0:width)<=Number(ds.inkWallMm)&&r.bottomMm>=0&&r.bottomMm+(point?0:r.heightMm)<=Number(ds.inkHeightMm);
    const target=point?'<circle cx="'+xx+'" cy="'+yy+'" r="10" class="wsheet-hit"/>':
     '<rect x="'+xx+'" y="'+(yy-h)+'" width="'+w+'" height="'+h+'" class="wsheet-hit"/>'+surveySizeGrip(key,xx+w,yy-h/2,'widthMm')+surveySizeGrip(key,xx+w/2,yy-h,'heightMm');
    const tapeNote=o.tape&&gap!==0&&inside?wallInkNotes({svgData:ds,proposal:{datumMm:o.tape.baseMm,row},values:{...row,gapMm:relativeGap(o)},tapeOnly:true}):'';
    insert('<g data-ink-cue="correction">'+drawing+tapeNote+(inside?'<g data-chain-hit="'+key+'" class="wsheet-item">'+target+'</g>':'')+'</g>');
   }else insert(locationCue(ds,{xMm:station,zMm:Number(ds.inkHeightMm)},'correction',chainLabels[r.kind]));
   return;
  }
  if(pending.mode==='existing'){
   const anchor=svg.querySelector('[data-chain-hit="'+pending.index+'"][data-chain-focus="'+pending.key+'"]');
   const canvas=svg.closest('.sv-ink-canvas');
   if(anchor&&canvas){
    const box=anchor.getBoundingClientRect(),outer=canvas.getBoundingClientRect();
    canvas.style.setProperty('--ink-x',Math.max(0,Math.min(outer.width,box.x+box.width/2-outer.x))+'px');
    canvas.style.setProperty('--ink-y',Math.max(0,box.y-outer.y)+'px');
   }
   const {index,key,values,old}=pending,value=asNumber(values[key]),hit=api.readHit?.(index);
   if(!hit||value===old)return;
   const delta=(value??old)-old,row=hit.row;
   const station=hit.stationMm+(key==='gapMm'?delta:0),width=hit.widthMm+
    (key==='frameDistance'?(row.frameRead?.method==='opposite'?-delta:delta):key==='widthMm'?delta:key==='gapMm'&&row.frameRead?-delta:0);
   const adjusted={...row,gapMm:station,widthMm:pointKinds.has(row.kind)?row.widthMm:width};
   if(key==='heightMm'||key==='bottomMm')adjusted[key]=value;
   if(openings(row.kind)||pointKinds.has(row.kind)){
    insert('<g data-ink-cue="correction">'+drawMark(ds,{proposal:{row:adjusted,datumMm:0,stationMm:station},values:adjusted},true,warn,false)+'</g>');
   }
   return;
  }
  let body=currentBatch().map(item=>drawMark(ds,item,item===pending,warn)).join('');
  if(pending.mode==='choose'&&pending.gesture.start){
   body+=locationCue(ds,pending.gesture.start,'choose','اختر نوع العنصر');
  }
  insert(body);
 }
 function locationCue(ds,point,kind,label){
  if(!point||!Number.isFinite(point.xMm+point.zMm))return '';
  const wall=Number(ds.inkWallMm),ceiling=Number(ds.inkHeightMm),left=Number(ds.inkLeft),top=Number(ds.inkTop);
  const w=Number(ds.inkWidth),h=Number(ds.inkHeight);
  const x=left+w*Math.min(1,Math.max(0,point.xMm/wall)),y=top+h*(1-Math.min(1,Math.max(0,point.zMm/ceiling)));
  const tx=Math.max(left+35,Math.min(left+w-35,x)),ty=Math.max(top+15,Math.min(top+h-8,y-10));
  return '<g data-ink-cue="'+kind+'" class="ink-location" pointer-events="none"><circle cx="'+x+'" cy="'+y+'" r="5"/>'+
   '<path d="M'+(x-9)+' '+y+'h18 M'+x+' '+(y-9)+'v18"/><text x="'+tx+'" y="'+ty+'" text-anchor="middle">'+esc(label)+'</text></g>';
 }
 function drawMark(ds,item,latest,warn,notes=true){
  const p=item.proposal,r=p.row,v=item.values,wall=Number(ds.inkWallMm),ceiling=Number(ds.inkHeightMm);
  const xScale=Number(ds.inkWidth)/wall,zScale=Number(ds.inkHeight)/ceiling;
  const gap=asNumber(v.gapMm),base=asNumber(v.bottomMm??r.bottomMm),height=asNumber(v.heightMm??r.heightMm),width=asNumber(v.widthMm??r.widthMm);
  const start=Number.isFinite(gap)?p.datumMm+gap:null,isService=pointKinds.has(r.kind);
  const alert=(reason,kind)=>{
   if(latest)warn(reason);
   const point=item.gesture?.start||(Number.isFinite(p.stationMm)?{xMm:p.stationMm,zMm:r.bottomMm||0}:null);
   return locationCue(ds,Number.isFinite(start)&&Number.isFinite(base)?{xMm:start,zMm:base}:point,kind,labels[r.kind]);
  };
  if(start===null||!Number.isFinite(base)||(!isService&&!(width>0&&height>0)))return alert('أكمل المقاسات ليظهر إطار العنصر.','incomplete');
  if(gap<0||start>wall||base<0||base>ceiling)return alert('موضع العنصر خارج الجدار. عدّل القياس قبل تثبيته.','bounds');
  const x=Number(ds.inkLeft)+start*xScale,y=Number(ds.inkTop)+Number(ds.inkHeight)-base*zScale;
  let mark='',cue='';
  if(isService){
   mark='<circle cx="'+x+'" cy="'+y+'" r="5"/><path d="M'+(x-10)+' '+y+'h20 M'+x+' '+(y-10)+'v20"/>';
   if(start-width/2<0||start+width/2>wall||base-height/2<0||base+height/2>ceiling)
    cue=alert('يتجاوز طرف التجهيز حدود الجدار. راجع موضع المركز قبل التثبيت.','bounds');
  }else{
   // Crop only the provisional ink. The proposed dimensions stay exact in
   // the editor and confirmation still checks them against the whole wall.
   const pixelWidth=Math.min(width,wall-start)*xScale,pixelHeight=Math.min(height,ceiling-base)*zScale;
   mark='<rect x="'+x+'" y="'+(y-pixelHeight)+'" width="'+pixelWidth+'" height="'+pixelHeight+'"/>';
   if(r.kind==='window'&&pixelWidth>35)mark+='<path d="M'+(x+pixelWidth/2)+' '+(y-pixelHeight)+'v'+pixelHeight+'" class="ink-window-line"/>';
   if(start+width>wall+.000001||base+height>ceiling+.000001)
    cue=alert('تتجاوز مقاسات الفتحة حدود الجدار. يظهر الجزء الواقع داخله حتى تصحّح العرض أو المنسوب أو الارتفاع.','bounds');
  }
  const isPoint=pointKinds.has(r.kind),right=Number(ds.inkLeft)+Number(ds.inkWidth);
  const labelX=isPoint?Math.min(right-15,x+15):x+width*xScale/2;
  const labelY=isPoint?Math.max(Number(ds.inkTop)+13,y-9):y-height*zScale/2+4;
  if(!cue&&(isPoint||(width*xScale>=35&&height*zScale>=25)))mark+='<text class="ink-shape-caption" text-anchor="middle" x="'+labelX+'" y="'+labelY+'">'+esc(labels[r.kind]||chainLabels[r.kind])+'</text>';
  return '<g class="'+(latest?'sv-ink-current-shape':'sv-ink-staged-shape')+'" pointer-events="none" aria-hidden="true" fill="#d3ece460" stroke="'+(cue?'#945822':latest?'#176853':'#5c8176')+'" stroke-width="'+(latest?2:1.4)+'" stroke-dasharray="5 3">'+mark+'</g>'+
   cue+(latest&&notes&&!cue?wallInkNotes({svgData:ds,proposal:p,values:v}):'');
 }
 const getSvg=()=>q('[data-survey-elevation]')?.querySelector?.('svg.survey-wall-sheet');
 function moveObject(hit,dx,dz=0){
  const row=hit.row,changes={gapMm:('widthMm' in row?hit.stationMm:row.gapMm)+dx};
  if(!['start','stop','corner'].includes(row.kind))changes.bottomMm=row.bottomMm+dz;
  return selectObject(hit,null,changes);
 }
 const editable=()=>!waiting&&(!pending||pending.mode==='object'&&!objectChanged());
 const gestures=mountWallInkGestures(host,{getTool:()=>!waiting&&(editable()||canDraw()||pending?.mode==='object')?tool:null,allowBlank:()=>canDraw()||editable()&&!api.unadopted(),
  onGesture:g=>{if(pending?.mode==='object')clear();start(g);},
  readHit:i=>{
   const hit=api.readHit(i);
   if(sameObject(hit)&&objectChanged()){
    const row=objectRow(pending);
    return row?{...hit,stationMm:'widthMm' in row?row.gapMm:hit.stationMm+row.gapMm-pending.original.gapMm,widthMm:row.widthMm??0,row}:null;
   }
   return editable()?hit:null;
  },
  onResize:(hit,key,value)=>selectObject(hit,null,{[key]:value}),
  onMove:moveObject,onAdjust:(hit,key,value)=>{
   if(!editable())return;
   if(pending?.mode==='object')clear();
   api.editReading(hit.key,key,hit.referenceId&&key==='gapMm'?hit.stationMm+value-hit.row.gapMm:value);
  }
 });
 const canNavigate=()=>!waiting&&!gestures.inProgress()&&!q('[data-pair-editor]');
 const viewport=mountDrawingViewport(host,{getSvg,canNavigate,cancelGesture:gestures.cancel});
 const menus=mountDrawingContext(host,{getSvg,cancelGesture:gestures.cancel,actionsAt(event,svg){
  if(!canNavigate())return null;
  const actions=[],action=(label,run)=>actions.push({label,run:()=>{if(svg===getSvg()&&canNavigate())run();}});
  const item=event.target?.closest?.('[data-chain-hit]');
  const hit=item?api.readHit(item.dataset.chainHit):event.keyboard?api.readHit(api.selected()):null;
  const point=event.keyboard?null:wallInkPoint(svg,event.clientX,event.clientY);
  let title='ورقة الجدار';
  const missing=api.missingReading?.();
  if(pending?.mode==='object'){
   title=labels[pending.hit.row.kind]||chainLabels[pending.hit.row.kind];
   action('تطبيق القياسات',confirm);action('إغلاق الخصائص',dropLast);
  }else if(pending){
   title=pending.mode==='existing'?'تصحيح القياس الحالي':'مسودة عناصر الجدار';
   if(pending.mode==='choose')action('تحديد نوع العنصر',()=>q('[data-ink-action^="kind-"]')?.focus());
   else{
    const key=pending.mode==='existing'?pending.key:pending.proposal.fields.find(k=>!Number.isFinite(asNumber(pending.values[k])))||pending.proposal.fields[0];
    const label=pending.mode==='existing'?pending.label:caption(pending.proposal,key);
    action('تحرير '+label,()=>{const input=q('[data-ink-value="'+key+'"]');input?.focus();input?.select?.();});
    action(pending.mode==='existing'?'تطبيق القياس':'تثبيت القياسات',confirm);
   }
   action(pending.mode==='existing'?'إلغاء التعديل':earlier.length?'تراجع عن آخر رسم':'إلغاء الرسم',dropLast);
  }else if(hit){
   const {row,key:index}=hit,edge=row.frameRead?'frameDistance':'widthMm';
   title=(labels[row.kind]||chainLabels[row.kind]||'قياس')+' · '+fmt.format(hit.stationMm)+' مم من الركن';
   const chosen=item?.dataset.chainFocus;
   const edit=(key,label)=>{if(!chosen||chosen===key)action(label,()=>api.editReading(index,key));};
   edit('gapMm','تصحيح المسافة من المرجع');
   if(openings(row.kind))edit(edge,row.frameRead?'تصحيح قياس الطرف البعيد':'تصحيح عرض البرواز');
   if(pointKinds.has(row.kind)||row.kind==='window')edit('bottomMm',pointKinds.has(row.kind)?'تصحيح ارتفاع المركز':'تصحيح ارتفاع أسفل البرواز');
   if(openings(row.kind))edit('heightMm','تصحيح الارتفاع');
   action('خصائص العنصر',()=>selectObject(hit));
  }else if(api.unadopted()){action('استخدام عناصر الرسم للرفع',api.adoptDrawing);
  }else if(missing){
   title=missing.text;
   action('إكمال القياس الناقص',()=>api.editReading(missing.i,missing.key));
  }else if(point&&canDraw()&&!item){
   title='إضافة هنا · نحو '+approxMm(point.xMm)+' مم من الركن';
   for(const kind of tool==='pen'?['window','door','water','electric']:[tool]){
    action('إضافة '+insertNames[kind],()=>start({kind,start:point,end:point,tap:true,dragged:false}));
   }
  }
  if(!actions.length){
   action('تكبير الرسم',()=>viewport.zoomBy(1.35));
   action('عرض الجدار كاملًا',()=>viewport.reset());
  }
  return {title,actions};
 }});
 function syncSheet(){
  const svg=getSvg();if(!svg)return;
  viewport.sync(svg,svg.getAttribute('viewBox'),[api.wall(),svg.dataset.inkWallMm,svg.dataset.inkHeightMm].join('/'));
 }
 const precision=mountSurveyPrecision(host,{onInput:fieldInput,beginScrub:beginPrecisionScrub,canEdit:()=>!!pending&&!waiting});
 host.addEventListener('keydown',onKey);host.addEventListener('paste',onPaste);
 return {toolbar,viewTools,note,editor,paint,syncSheet,editedReading,confirm,draftStatus,provisional,paperPrompt,guard,selectDim,selectObject,moveObject,objectTarget:()=>pending?.mode==='object'?(pending.hit.referenceId?'cad:'+pending.hit.referenceId:pending.hit.key):null,handleClick,fieldInput,clear,forgetUndo(){undo=null;},
  drawingTool:()=>tool,active:()=>editable()||canDraw(),existing:()=>pending?.mode==='existing'||pending?.mode==='object',dismissInspection(){
   if(pending?.mode==='object'&&!objectChanged()){clear();return;}
   if(pending?.mode==='existing'){
    const {index,key,values}=pending,row=api.chain().rows[index];
    if(row&&asNumber(values[key])===(key==='frameDistance'?row.frameRead?.distanceMm:row[key]))clear();
   }
  },hasPending:()=>!!pending,hasGuard:()=>!!waiting,
  requestLeave(next){if(!pending)return true;waiting=next;api.draw('[data-ink-action="stay"]');return false;},
  destroy(){precision.destroy();menus.destroy();viewport.destroy();gestures();host.removeEventListener('keydown',onKey);host.removeEventListener('paste',onPaste);}
 };
}
