import {drawingDXF,outputFilename} from './kitchen-drawing-output.js';
import {outputStamp} from './kitchen-output-stamp.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {kitchenGeometry,updateRun} from './kitchen-model.js';
import {acceptPattern,patternQuantities,surfaceDXF,verifiedPattern} from './kitchen-surface-pattern.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:4}).format(n);
const num=v=>assistNumber(v)??NaN;
const pts=s=>s.trim().split(/\n+/).map(line=>line.trim().split(/[,،\s]+/).map(num));
const rows=p=>(p||[]).map(q=>q.join(', ')).join('\n');
const text=(key,label,value='',type='text')=>'<label>'+esc(label)+'<input name="'+key+'" type="'+type+'" '+(type==='number'?'step="any" min="0"':'maxlength="180"')+' value="'+esc(value)+'"></label>';
const pointBox=(key,label,value)=>'<label>'+label+'<textarea name="'+key+'" rows="4" dir="ltr" placeholder="0, 0">'+esc(value)+'</textarea></label>';
const kinds={rect:'مستطيل أو مستطيل بزوايا مستديرة',circle:'دائرة',polygon:'مضلع مقاس'};
const defaults=(t,existing={})=>({source:'',datum:'',materialRef:'',limitRef:'',levelRef:'',inspector:'',date:'',edgeGapMm:'',webMm:'',fitToleranceMm:'',thicknessMm:'',
 ...existing,outerText:rows(existing.outer),holes:existing.holes?.map(h=>({...h,pointsText:rows(h.points)}))??t.holes.map(h=>({id:h.unitId,shape:'rect',modelRef:'',radius:'',pointsText:''}))});
export function mountSurfacePattern(host,{getDoc,apply,tell,onAdvance,focus={}}){
 const ac=new AbortController();let snapshot=getDoc(),tops=kitchenGeometry(snapshot.kitchen,snapshot.room).worktops,draft,preview=null;
 const unit=focus.unitId&&snapshot.kitchen.units.find(u=>u.id===focus.unitId);
 const related=focus.unitId?(unit?tops.filter(t=>t.runId===unit.runId&&unit.u<t.end&&unit.u+unit.width>t.start):[]):
   focus.runId?tops.filter(t=>t.runId===focus.runId):[];
 let id=focus.topId?tops.find(t=>t.id===focus.topId)?.id:
   (focus.unitId||focus.runId)?(related.length===1?related[0].id:null):tops[0]?.id;
 const top=()=>tops.find(t=>t.id===id);
 const load=()=>{draft=top()?defaults(top(),snapshot.room.workshop?.surfacePatterns?.[id]):null;preview=null;};
 function read(){
  if(!draft)return;
  for(const el of host.querySelectorAll('[name]')){
   const key=el.name.split('.');if(key[0]==='h')draft.holes[Number(key[1])][key[2]]=el.value;else draft[key[0]]=el.value;
  }
 }
 const option=(v,name,active)=>'<option value="'+esc(v)+'" '+(active?'selected':'')+'>'+esc(name)+'</option>';
 function hole(h,i){
  const k='h.'+i+'.',extra=h.id.startsWith('extra:');
  let fields='<label>الشكل<select name="'+k+'shape" data-shape>'+Object.entries(kinds).map(([v,l])=>option(v,l,v===h.shape)).join('')+'</select></label>'+text(k+'modelRef','موديل القطعة ومرجع فتحة التركيب',h.modelRef);
  fields+=h.shape==='polygon'?pointBox(k+'pointsText','تتابع رؤوس الفتحة بالملليمتر',h.pointsText):text(k+'x',h.shape==='circle'?'مركز الطول X':'أقرب حد على محور الطول X',h.x,'number')+text(k+'y',h.shape==='circle'?'مركز العمق Y':'أقرب حد على محور العمق Y',h.y,'number')+(h.shape==='rect'?text(k+'width','عرض الفتحة',h.width,'number')+text(k+'depth','عمق الفتحة',h.depth,'number'):'')+text(k+'radius',h.shape==='circle'?'نصف القطر':'نصف قطر الزاوية (صفر للمربع)',h.radius,'number');
  const owner=snapshot.kitchen.units.find(u=>u.id===h.id);
  const title=owner?.kind==='sink'?'فتحة المجلى':owner?.kind==='hob'?'فتحة الموقد':'فتحة';
  return '<fieldset data-pattern-hole="'+esc(h.id)+'"><legend>'+title+' · '+esc(h.id)+'</legend>'+fields+(extra?'<button type="button" data-remove="'+i+'">إزالة الفتحة الإضافية</button>':'')+'</fieldset>';
 }
 function diagram(t,pattern){
  const nominalW=(t.end-t.start)*10,nominalH=t.depth*10;
  if(!(nominalW>0&&nominalH>0))return '';
  const polygon=points=>Array.isArray(points)&&points.length>=3&&points.length<=256&&points.every(p=>p.length===2&&p.every(Number.isFinite));
  const measured=polygon(pattern.outer),outline=measured?pattern.outer:[[0,0],[nominalW,0],[nominalW,nominalH],[0,nominalH]];
  const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]),x=Math.min(0,...xs),y=Math.min(0,...ys);
  const w=Math.max(nominalW,...xs)-x,h=Math.max(nominalH,...ys)-y,pad=Math.max(w,h)*.035;
  const holes=pattern.holes.map(hole=>{
   if(hole.shape==='polygon'&&polygon(hole.points))return '<polygon points="'+hole.points.map(p=>p.join(',')).join(' ')+'"/>';
   if(![hole.x,hole.y].every(Number.isFinite))return '';
   if(hole.shape==='circle'&&Number.isFinite(hole.radius)&&hole.radius>0)return '<circle cx="'+hole.x+'" cy="'+hole.y+'" r="'+hole.radius+'"/>';
   if(hole.shape==='rect'&&[hole.width,hole.depth].every(n=>Number.isFinite(n)&&n>0))return '<rect x="'+hole.x+'" y="'+hole.y+'" width="'+hole.width+'" height="'+hole.depth+'" rx="'+(Number.isFinite(hole.radius)?Math.max(0,hole.radius):0)+'"/>';
   return '';
  }).join('');
  return '<figure class="kf-pattern"><figcaption><b>'+(measured?'محيط النقاط المدخلة':'حيّز السطح في التصميم')+'</b><span>'+f(nominalW)+' × '+f(nominalH)+' مم في التصميم</span></figcaption><svg viewBox="'+[x-pad,y-pad,w+2*pad,h+2*pad].join(' ')+'" role="img" aria-label="رسم قطعة السطح والفتحات ذات الأبعاد المدخلة"><polygon class="kf-outline" data-measured="'+measured+'" points="'+outline.map(p=>p.join(',')).join(' ')+'"/><g class="kf-holes">'+holes+'</g></svg><small>'+(measured?'حدود وفتحات المسودة · يبدأ التحقق عند فحص القالب':'أدخل إحداثيات المحيط لإظهار القالب الميداني')+'</small></figure>';
 }
 function render(){
  const obsolete=Object.keys(snapshot.room.workshop?.surfacePatterns||{}).filter(k=>!tops.some(t=>t.id===k));
  const discard=k=>'<button type="button" data-discard="'+esc(k)+'">إزالة القالب '+esc(k)+' من النسخة الحالية</button>';
  const orphans=obsolete.length?'<section><p>توجد قوالب تخص قطعًا أزيلت من الرسم. اختر القالب المراد فصله.</p>'+obsolete.map(discard).join('')+'</section>':'';
  const t=top();
  const choices=tops.map(t=>option(t.id,t.id+' · '+f((t.end-t.start)*10)+' مم',t.id===id)).join('');
  if(!t){
   const available=related.length?related:tops;
   host.innerHTML=orphans+'<h3>قالب سطح العمل</h3>'+(tops.length?
    '<p>'+(related.length>1&&!focus.topId?'يضمّ الصف أكثر من قطعة سطح. اختر القطعة المقصودة.':'قطعة السطح المشار إليها غير متاحة في الرسم الحالي.')+'</p><label>قطعة السطح<select data-top>'+option('','اختر قطعة',true)+available.map(t=>option(t.id,t.id+' · '+f((t.end-t.start)*10)+' مم',false)).join('')+'</select></label>':
    '<p>أضف وحدات تحمل سطح عمل إلى الرسم أولًا.</p>'+(onAdvance?'<button type="button" data-design>فتح تصميم المطبخ</button>':''));
   return;
  }
  const stored=verifiedPattern(snapshot,t);
  host.innerHTML=orphans+'<h3>قالب سطح العمل المقاس</h3><p>على كل قطعة ابدأ من ركنها الخلفي عند بداية الصف. X مع امتداد الصف وY باتجاه واجهته. جميع الحدود نهائية بالملليمتر قبل تعويض أداة القص.</p><label>قطعة السطح<select data-top>'+choices+'</select></label><div data-pattern-plan>'+diagram(t,raw())+'</div><div class="ws-card kf-pattern-fields"><h4>مرجع الرفع وحدود القطعة</h4>'+text('source','رقم القالب أو الرسم الميداني',draft.source)+text('datum','وصف نقطة الصفر واتجاه القياس',draft.datum)+text('levelRef','مرجع تثبيت الوحدات وتسويتها',draft.levelRef)+text('materialRef','الخامة ومرجع المورد',draft.materialRef)+text('inspector','الفني المراجع',draft.inspector)+text('date','تاريخ الرفع',draft.date,'date')+pointBox('outerText','حدود القطعة المقاسة. كل سطر X ثم Y ولا تُكرّر النقطة الأولى.',draft.outerText)+'</div><div class="ws-card kf-pattern-fields"><h4>خامة السطح وسماحيات القص</h4>'+text('thicknessMm','سماكة القطعة الفعلية',draft.thicknessMm,'number')+text('limitRef','مرجع حدود خامة السطح وسماحية المطابقة',draft.limitRef)+text('edgeGapMm','أقل حافة مسموحة حول الفتحة',draft.edgeGapMm,'number')+text('webMm','أقل فاصل بين فتحتين',draft.webMm,'number')+text('fitToleranceMm','أقصى فرق مع حيز السطح في الرسم',draft.fitToleranceMm,'number')+'</div>'+draft.holes.map(hole).join('')+
    '<button data-extra>إضافة فتحة صنبور أو ملحق</button> <button data-check>فحص القالب</button> '+
    (preview?'<div data-pattern-result><p>مساحة الخام المستطيل '+f(preview.blankM2)+' م²، صافي التركيب '+f(preview.netM2)+' م².</p><button data-save>تأكيد القالب المقاس لهذه القطعة</button></div>':'')+
    '<button data-gauge>تطبيق السماكة المدخلة على أسطح الصف ومراجعة التعارضات</button>'+
    (stored?'<p>محفوظ · '+esc(stored.source)+'</p><button data-dxf>تنزيل هندسة القالب المحفوظ DXF بالملليمتر</button>':'')+(snapshot.room.workshop?.surfacePatterns?.[id]?discard(id):'')+'<p class="ws-subtle">DXF يرسم الحافة الفعلية ومسارات الفتحات. تحدد الورشة ترتيب التشغيل وتعويض أداة الماكينة.</p>';
 }
 function raw(){const shape=v=>v.shape==='polygon'?{points:pts(v.pointsText)}:v.shape==='circle'?{x:num(v.x),y:num(v.y),radius:num(v.radius)}:{x:num(v.x),y:num(v.y),width:num(v.width),depth:num(v.depth),radius:num(v.radius)};
  return {...draft,outer:pts(draft.outerText),...Object.fromEntries(['thicknessMm','webMm','edgeGapMm','fitToleranceMm'].map(k=>[k,num(draft[k])])),holes:draft.holes.map(v=>({...shape(v),id:v.id,shape:v.shape,modelRef:v.modelRef}))};
 }
 const click=e=>{
  const b=e.target.closest('button');if(!b)return;
  if('design'in b.dataset){onAdvance?.('whole');return;}
  read();
  if('discard' in b.dataset){
   if(getDoc()!==snapshot){tell('تغيّر المشروع. افتح القالب مجددًا.');return;}
   const w=snapshot.room.workshop,patterns={...w.surfacePatterns};delete patterns[b.dataset.discard];
   const r=apply({...snapshot,room:{...snapshot.room,workshop:{...w,surfacePatterns:patterns}}},'أزيل القالب من هذه النسخة. يمكنك التراجع عن العملية من الرسم.');
   if(r?.ok!==false){snapshot=getDoc();load();render();}return;
  }
  if('extra'in b.dataset){let index=1;while(draft.holes.some(h=>h.id==='extra:'+index))index++;draft.holes.push({id:'extra:'+index,shape:'circle',modelRef:''});preview=null;render();return;}
  if('remove'in b.dataset){draft.holes.splice(Number(b.dataset.remove),1);preview=null;render();return;}
  if(getDoc()!==snapshot){tell('تغيّر المشروع. أعد فتح القالب واختر القطعة الحالية.');return;}
  if('gauge'in b.dataset){const target=top(),gauge=num(draft.thicknessMm);if(!Number.isFinite(gauge)||gauge<=0){tell('أدخل سماكة موثّقة أولًا.');return;}
   const edit=updateRun(snapshot.kitchen,snapshot.room,target.runId,{worktopThicknessMm:gauge});if(!edit.ok){tell(edit.reason);return;}
   const result=apply({...snapshot,kitchen:edit.kitchen},'تحدّثت سماكة جميع أسطح هذا الصف. راجع الفتحات وارتفاع السطح.');if(result?.ok!==false){snapshot=getDoc();tops=kitchenGeometry(snapshot.kitchen,snapshot.room).worktops;preview=null;render();}return;
  }
  if('dxf'in b.dataset){try{const stamp=outputStamp(snapshot,id,'قالب سطح العمل المقاس'),blob=new Blob([drawingDXF(surfaceDXF(snapshot,top()),stamp)],{type:'application/dxf'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=outputFilename(stamp,id+'-mm','dxf');a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}catch(err){tell(err.message);}return;}
  const out=acceptPattern(snapshot,top(),raw());if(!out.ok){tell(out.reason);return;}
  if('save'in b.dataset){const result=apply(out.doc,'حُفظ القالب الرقمي وربطت الفتحات بوحداتها.');if(result?.ok===false)return;snapshot=getDoc();tops=kitchenGeometry(snapshot.kitchen,snapshot.room).worktops;load();}
  else preview=patternQuantities(out.doc.room.workshop.surfacePatterns[id]);render();
 };
 host.addEventListener('input',e=>{
  if(preview){preview=null;host.querySelector('[data-pattern-result]')?.remove();}
  if(e.target.name==='outerText'||e.target.name?.startsWith('h.')){
   read();host.querySelector('[data-pattern-plan]').innerHTML=diagram(top(),raw());
  }
 },{signal:ac.signal});
 host.addEventListener('change',e=>{if(e.target.matches('[data-top]')){id=e.target.value;load();render();}else if(e.target.matches('[data-shape]')){read();preview=null;render();}},{signal:ac.signal});
 host.addEventListener('click',click,{signal:ac.signal});load();render();
 if(focus.holeId&&id){
  const index=draft?.holes.findIndex(h=>h.id===focus.holeId)??-1;
  const input=index>=0&&host.querySelector('[name="h.'+index+'.modelRef"]');
  if(input){input.focus?.({preventScroll:true});input.scrollIntoView?.({block:'center'});}
 }
 return ()=>ac.abort();
}
