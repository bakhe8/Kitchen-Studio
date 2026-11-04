import {surveyWallMap} from './kitchen-survey-wall-map.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {mountPhotoPlane} from './kitchen-photo-plane-ui.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {wallPhotoSources,saveWallPhoto,legacyWallSource,wallPhotoForFeature} from './kitchen-wall-photo-assets.js';
import {readWallPhotos} from './kitchen-studio-room.js';
import {fieldAttachmentStore} from './kitchen-field-files.js';
import {suggestWallRects,rectFromPoints,photoMetric,registerPhotoHints,photoClasses,photoOpeningProposal,placeMeasuredPhotoOpening} from './kitchen-workshop-photo.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const opt=(v,t,k)=>'<option value="'+esc(v)+'"'+(v===k?' selected':'')+'>'+esc(t)+'</option>';
export function mountPhotoAssist(host,{getDoc,apply,tell,onAdvance,focus={}}){
 const controller=new AbortController(),signal=controller.signal;
 let image=null,imageUrl='',ref=null,w=0,h=0,boxes=[],select=0,tool='pick',start=null,cal=null,calMm='',plane=false,seq=0,serial=0,saving=false;
 const walls=roomArchitecture(getDoc().room).walls;
 let wall=walls.find(v=>v.id===(focus.wall||getDoc().room.workshop?.activeWall))?.id||walls[0].id;
 let openingDraft=null,planeController=null;

 function currentHint(b){
  if(!b||!ref||!inst())return null;
  const proposal=photoOpeningProposal(getDoc(),ref.id,b.number,wall);
  if(!proposal||proposal.kind!==b.kind||JSON.stringify(proposal.calibration)!==JSON.stringify(inst()))return null;
  const corners=JSON.parse(proposal.coordinates);
  return Math.max(Math.abs(corners[0][0]-b.x1),Math.abs(corners[0][1]-b.y1),Math.abs(corners[2][0]-b.x2),Math.abs(corners[2][1]-b.y2))<.000011?proposal:null;
 }
 function openingForm(p){
  const dim=(k,l,value='')=>'<label>'+l+' (مم)<input type="number" step="any" min="'+(['widthMm','heightMm','depthMm'].includes(k)?10:0)+'" required name="'+k+'" value="'+esc(value)+'"></label>';
  return '<form data-photo-opening class="ws-card"><h3>إضافة '+photoClasses[p.kind][0]+' إلى الرسم</h3><p>العرض والارتفاع المقترحان تقديريان. صحّحهما بالقياس من الطرف الخارجي للبرواز، ثم أدخل موقع الفتحة المقاس ميدانيًا.</p>'+dim('widthMm','العرض الخارجي',p.width)+dim('heightMm','الارتفاع الخارجي',p.height)+dim('gapMm','من بداية الجدار إلى أول برواز',p.gapMm)+dim('bottomMm','من الأرض المشطبة إلى أسفل البرواز',p.bottomMm)+dim('depthMm','البروز من وجه الجدار')+(p.kind==='door'?'<label>حركة الباب<select name="swing" required><option value="">اختر</option><option value="in">إلى الداخل</option><option value="out">إلى الخارج</option><option value="sliding">سحّاب</option></select></label><label>جهة المفصلة للباب المفصلي<select name="hinge"><option value="">اختر عند الحاجة</option><option value="left">يسار</option><option value="right">يمين</option></select></label>':'')+'<label><input type="checkbox" name="confirmed" required> قست الموقع والبروز وراجعت عرض البرواز وارتفاعه في الموقع.</label><button type="submit">تطبيق الفتحة المقاسة على الرسم</button><button type="button" data-pha-cancel-opening>إبقاء الرسم كما هو</button></form>';
 }

 function savedChoices(){return wallPhotoSources(getDoc().room,wall);}
 function linkedOpenings(){
  if(!ref)return '';
  const doc=getDoc(),openings=doc.kitchen.features.filter(f=>f.wall===wall&&wallPhotoForFeature(doc.room,f.id)?.id===ref.id);
  return openings.length?'<div class="ws-card"><h3>الفتحات المرتبطة بهذه الصورة في الرسم</h3>'+openings.map(f=>'<button type="button" data-pha-measured="'+esc(f.id)+'">'+(f.kind==='window'?'شباك':'باب')+' · الرسم الحالي '+fmt(f.width*10)+' × '+fmt(f.height*10)+' مم · فتح قياسات الجدار</button>').join(' ')+'</div>':'';
 }
 function inst(){return cal&&plane?{...cal,mm:Number(calMm)}:null;}
 function render(){
  planeController?.abort();planeController=null;
  const sources=savedChoices(),room=getDoc().room,legacy=!room.photoRefs?.[wall]?.startsWith('asset-')&&Boolean(readWallPhotos(room)[wall]);
  const keepSourceOpen=host.querySelector('.pha-source-picker')?.open;
  const sourceButton=(glyph,label,accept,capture=false)=>'<label class="pha-file-control">'+studioIcon(glyph)+'<span>'+label+'</span><input type="file" accept="'+accept+'" '+(capture?'capture="environment" ':'')+'data-pha-file aria-label="'+label+'"></label>';
  const sourceCard='<div class="ws-card pha-source">'+(!image?'<div class="site-photo-map">'+surveyWallMap(walls,wall,{},true)+'</div>':'')+'<label>الجدار<select data-pha-wall>'+walls.map(a=>opt(a.id,a.label,wall)).join('')+'</select></label>'+
   '<div class="pha-files">'+sourceButton('camera','التقاط صورة','image/*',true)+sourceButton('upload','رفع صورة','image/jpeg,image/png,image/webp')+'</div>'+
   (sources.length||legacy?'<label>صور الزيارة لهذا الجدار<select data-pha-restore><option value="">اختر صورة محفوظة</option>'+sources.map(f=>opt(f.id,f.name,ref?.id)).join('')+(legacy?opt('legacy','صورة خلفية الجدار المحفوظة',''):'')+'</select></label>':'')+'</div>';
  const source=image?'<details class="pha-source-picker"'+(keepSourceOpen?' open':'')+'><summary>'+studioIcon('image')+'<b>'+esc(walls.find(v=>v.id===wall)?.label)+'</b><span>'+esc(ref?.name||'صورة الزيارة')+'</span><small>تغيير الصورة</small></summary>'+sourceCard+'</details>':
   '<h2>صورة الجدار</h2><p>اختر الجدار ثم التقط صورة أو افتح صورة محفوظة لتحديد الفتحات والخدمات.</p>'+sourceCard;
  const toolButton=(key,glyph,label,title)=>'<button type="button" data-pha-tool="'+key+'" aria-pressed="'+(key===tool)+'" aria-label="'+title+'" title="'+title+'">'+studioIcon(glyph)+(label?'<span>'+label+'</span>':'')+'</button>';
  const keepCalibrationOpen=tool==='cal'||Boolean(cal)||host.querySelector('[data-pha-calibration]')?.open;
  host.innerHTML=source+
   (image?'<div class="pha-bench" style="--pha-ratio:'+w/h+'"><div class="ws-card pha-paper"><div class="pha-workbar" role="group" aria-label="تعليم صورة الجدار">'+
    toolButton('pick','target','','تحديد عنصر من الصورة')+toolButton('mark','frame','رسم الحدود','رسم مستطيل على الصورة')+
    (boxes[select]?toolButton('correct','pen','تصحيح','تصحيح حدود العنصر المحدد'):'')+toolButton('cal','ruler','مرجع القياس','تعيين خط القياس')+'</div>'+
    '<p data-pha-prompt aria-live="polite"></p><div class="pha-film"><div class="pha-image"><img alt="صورة الجدار التي رفعها الفني" src="'+esc(imageUrl)+'"><svg data-pha-overlay viewBox="0 0 '+w+' '+h+'" aria-label="حدود العناصر فوق صورة الجدار"></svg></div></div></div>'+
    '<div class="pha-inspector"><details class="ws-card pha-calibration" data-pha-calibration'+(keepCalibrationOpen?' open':'')+'><summary>'+studioIcon('ruler')+'معايرة صورة أمامية</summary><label>طول المرجع الأفقي (مم)<input data-pha-mm type="number" min="1" max="20000" step="any" value="'+esc(calMm)+'"></label><label><input type="checkbox" data-pha-plane '+(plane?'checked':'')+'> تحققت أن الصورة أمامية والعنصر والمرجع على مستوى الجدار نفسه</label><small>العرض والارتفاع من الصورة تقديريان. يُقاس البروز والمنسوب في الموقع.</small><button type="button" data-pha-reset>إلغاء المعايرة</button></details>'+
    '<div class="ws-card"><h3>عناصر الصورة</h3><div data-pha-list></div><button type="button" class="primary" data-pha-save>'+studioIcon('save')+'حفظ العناصر في سجل الفني</button></div></div></div>':'')+
    linkedOpenings()+
    '<div class="pha-actions">'+(image?'<button type="button" data-advanced-open>'+studioIcon('frame')+'معايرة المنظور والتغطية</button>':'')+
    '<button type="button" data-pha-next>متابعة رفع الجدار'+studioIcon('next')+'</button></div>'+(image?'<section data-advanced-plane style="--pha-ratio:'+w/h+'"></section>':'');
  draw();
 }
 function draw(){
  openingDraft=null;
  const overlay=host.querySelector('[data-pha-overlay]');if(!overlay)return;
  const prompt=host.querySelector('[data-pha-prompt]');
  prompt.textContent=tool==='pick'?'اضغط على المستطيل أو حدده من القائمة.':tool==='cal'?(start?'اضغط على نهاية المرجع الأفقي.':'اضغط على بداية طول أفقي معلوم، ثم نهايته.'):(start?'اضغط على الزاوية المقابلة.':'اضغط على الزاوية الأولى للعنصر.');
  const n=(x)=>Math.round(x*1000)/1000;
  const marks=boxes.map((b,i)=>'<rect x="'+n(b.x1*w)+'" y="'+n(b.y1*h)+'" width="'+n((b.x2-b.x1)*w)+'" height="'+n((b.y2-b.y1)*h)+'" class="'+(i===select?'active':b.checked?'included':'')+'"/><text x="'+n(b.x1*w+2)+'" y="'+n(b.y1*h+14)+'" font-size="'+Math.max(w,h)*.04+'">'+b.number+'</text>').join('');
  const selectedLine=cal?'<line x1="'+cal.a[0]*w+'" x2="'+cal.b[0]*w+'" y1="'+cal.a[1]*h+'" y2="'+cal.b[1]*h+'"/>':'';
  overlay.innerHTML=marks+selectedLine+(start?'<circle cx="'+start[0]*w+'" cy="'+start[1]*h+'" r="'+Math.max(w,h)*.012+'"/>':'');
  host.querySelector('[data-pha-list]').innerHTML=boxes.length?boxes.map((b,i)=>{
    const measured=photoMetric(b,inst(),w,h);
    return '<div class="pha-row"><label><input data-pha-check="'+i+'" type="checkbox" '+(b.checked?'checked':'')+'> رقم '+fmt(b.number)+'</label><button type="button" data-pha-select="'+i+'" aria-pressed="'+(i===select)+'" aria-label="تحديد عنصر الصورة '+fmt(b.number)+'" title="تحديد عنصر الصورة '+fmt(b.number)+'">'+studioIcon('target')+'</button>'+
     '<label>النوع<select data-pha-class="'+i+'">'+opt('','اختر النوع',b.kind)+Object.entries(photoClasses).map(([k,[l]])=>opt(k,l,b.kind)).join('')+'</select></label>'+
     (measured?'<small>عرض '+fmt(measured.width)+'، ارتفاع '+fmt(measured.height)+' مم · تقديري</small>':'')+(currentHint(b)?'<button type="button" data-pha-opening="'+i+'">مراجعة فتحة رقم '+fmt(b.number)+' وإضافتها للرسم</button>':'')+'</div>';}).join(''):'<p>لم يظهر مستطيل واضح. اضغط «رسم الحدود» ثم حدّد زاويتين.</p>';
 }
 async function loadPhoto(blob,stored=null,background=false){
  const token=++serial,doc=getDoc(),side=wall,previous=imageUrl,url=URL.createObjectURL(blob),im=new Image();im.src=url;
  try{
   try{await im.decode();}catch{throw Error('تعذّرت قراءة الصورة. افتح ملف JPG أو PNG أو WebP صالحًا.');}
   if(signal.aborted||token!==serial){URL.revokeObjectURL(url);return;}
   const W=im.naturalWidth,H=im.naturalHeight;if(!W||!H||W*H>64000000)throw Error('مقاس الصورة غير مدعوم. استخدم صورة أصغر.');
   const canvas=document.createElement('canvas'),s=Math.min(1,320/Math.max(W,H));canvas.width=Math.max(1,Math.round(W*s));canvas.height=Math.max(1,Math.round(H*s));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,canvas.width,canvas.height);
   const candidates=suggestWallRects(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
   if(!stored){
    const saved=await saveWallPhoto(doc.room,side,blob,{background});
    if(signal.aborted||token!==serial||side!==wall||doc!==getDoc()){URL.revokeObjectURL(url);return;}
    const result=apply({...doc,room:saved.room},'حُفظ أصل الصورة لهذا الجدار وأصبح متاحًا للخلفية والقياس.');
    if(result?.ok===false)throw Error(result.reason);stored=saved.ref;
   }
   if(signal.aborted||token!==serial){URL.revokeObjectURL(url);return;}
   image=im;imageUrl=url;ref=stored;w=W;h=H;select=0;tool='pick';start=null;cal=null;calMm='';plane=false;seq=0;
   const polygons=(getDoc().room.fieldRegister?.records||[]).filter(r=>r.id.startsWith('wa-')&&r.valueType==='polygon'&&r.attachments?.[0]?.id===stored.id);
   seq=Math.max(0,...polygons.map(r=>Number(r.itemId.split('-').at(-1))).filter(Number.isInteger));
   const kept=[];
    for(const r of polygons){
     try{const pts=JSON.parse(r.value),m=JSON.parse(r.notes),dim=rectFromPoints(pts[0],pts[2]);if(m.wall!==wall||m.origin==='plane'||!dim||!photoClasses[m.kind])continue;
      const id=Number(r.itemId.split('-').at(-1));if(!Number.isInteger(id))continue;
      kept.push({...dim,number:id,origin:m.origin,kind:m.kind,checked:true});
      if(m.calibration){cal={a:m.calibration.a,b:m.calibration.b};calMm=m.calibration.mm;plane=true;}
     }catch{}
    }
   boxes=kept.length?kept:candidates.map(b=>({...b,number:++seq,origin:'candidate',kind:'',checked:false}));
   if(previous)URL.revokeObjectURL(previous);render();tell('هذه صورة زيارة للجدار. راجع حدود العناصر ثم أكّد المقاسات ميدانيًا.');
  }catch(e){URL.revokeObjectURL(url);if(!signal.aborted)tell(e.message||'تعذّر قراءة الصورة.');}
 }
 async function openSaved(id){
  const token=++serial,side=wall;
  try{
   if(id==='legacy'){const old=legacyWallSource(getDoc().room,wall);if(old)await loadPhoto(old,null,true);return;}
   const source=savedChoices().find(f=>f.id===id);if(!source)return;
   const blob=await fieldAttachmentStore.get(id);
   if(signal.aborted||side!==wall||serial!==token)return;
   if(!blob)throw Error('أصل الصورة غير متاح على هذا الجهاز. استعد ملف المشروع.');
   await loadPhoto(blob,source);
  }catch(error){if(!signal.aborted)tell(error.message);}
 }
 function selectWall(id){
  if(id===wall||!walls.some(w=>w.id===id))return;
  serial++;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl='';image=null;ref=null;boxes=[];openingDraft=null;start=null;wall=id;render();
 }
 host.addEventListener('keydown',e=>{
  const edge=e.target.closest?.('[data-survey-wall-id][role=button]');
  if(!edge||!['Enter',' '].includes(e.key))return;e.preventDefault();
  selectWall(edge.dataset.surveyWallId);host.querySelector('[data-survey-wall-id="'+wall+'"][role=button]')?.focus();
 },{signal});
 host.addEventListener('change',async e=>{
  const t=e.target;
  if(t.closest('[data-photo-opening],[data-advanced-plane]'))return;
  if(t.matches('[data-pha-file]')){
   const f=t.files[0];if(f){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>24*1024*1024){tell('اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز ٢٤ م.ب.');return;}await loadPhoto(f);}return;
  }
  if(t.matches('[data-pha-restore]')){if(t.value)await openSaved(t.value);return;}
  if(t.matches('[data-pha-wall]')){
   selectWall(t.value);return;
  }
  if(t.matches('[data-pha-check]'))boxes[Number(t.dataset.phaCheck)].checked=t.checked;
  if(t.matches('[data-pha-class]')){const b=boxes[Number(t.dataset.phaClass)];b.kind=t.value;b.checked=!!t.value;}
  if(t.matches('[data-pha-plane]'))plane=t.checked;
  draw();
 },{signal});
 host.addEventListener('input',e=>{if(e.target.matches('[data-pha-mm]')){calMm=e.target.value;draw();}},{signal});
 host.addEventListener('submit',e=>{
  const form=e.target.closest('[data-photo-opening]');if(!form)return;
  e.preventDefault();const b=openingDraft?.box,p=openingDraft?.plane?photoOpeningProposal(getDoc(),openingDraft.photo,openingDraft.number,wall):currentHint(b);
  if(!openingDraft||openingDraft.doc!==getDoc()||!p||p.stamp!==openingDraft.stamp){draw();tell('تغيّرت بيانات الصورة أو الرسم. راجع الفتحة من جديد.');return;}
  const data=new FormData(form),measured={};
  for(const k of ['widthMm','heightMm','gapMm','bottomMm','depthMm'])measured[k]=data.get(k)===''?null:Number(data.get(k));
  measured.swing=data.get('swing');measured.hinge=data.get('hinge');
  const result=placeMeasuredPhotoOpening(getDoc(),{photoId:openingDraft.photo||ref.id,number:openingDraft.number||b.number,wall,stamp:p.stamp,confirmed:data.has('confirmed'),measured});
  if(!result.ok){tell(result.reason);return;}
  const saved=apply(result.doc,'أضيفت الفتحة المقاسة إلى الرسم وسلسلة الجدار.');if(saved?.ok===false){tell(saved.reason);return;}render();
 },{signal});
 host.addEventListener('click',async e=>{
  const edge=e.target.closest('[data-survey-wall-id]');
  if(edge){selectWall(edge.dataset.surveyWallId);return;}
  const t=e.target.closest('button')||e.target.closest('[data-pha-overlay]');
  if(!t)return;
  if(t.hasAttribute('data-pha-measured')){onAdvance?.('survey',{wall,featureId:t.dataset.phaMeasured});return;}
  if(t.hasAttribute('data-advanced-open')){
   const target=host.querySelector('[data-advanced-plane]');planeController?.abort();planeController=new AbortController();openingDraft=null;
   mountPhotoPlane(target,{getDoc,apply,tell,wall,imageUrl,photoId:ref?.id,signal:planeController.signal,
    getPhoto:async()=>ref,
    openForm:(photo,number)=>{const p=photoOpeningProposal(getDoc(),photo,number,wall);if(!p)return;
     host.querySelector('[data-photo-opening]')?.remove();openingDraft={plane:true,photo,number,stamp:p.stamp,doc:getDoc()};
     target.insertAdjacentHTML('afterend',openingForm(p));host.querySelector('[data-photo-opening] input')?.focus();}
   });return;
  }
  if(t.closest('[data-advanced-plane]'))return;
  if(t.hasAttribute('data-pha-opening')){
   const b=boxes[Number(t.dataset.phaOpening)],p=currentHint(b);if(!p){tell('احفظ التصنيف والمعايرة قبل إضافة الفتحة.');return;}
   draw();openingDraft={doc:getDoc(),stamp:p.stamp,box:b};host.querySelector('[data-pha-list]').insertAdjacentHTML('beforeend',openingForm(p));host.querySelector('[data-photo-opening] input')?.focus();return;
  }
  if(t.hasAttribute('data-pha-cancel-opening')){t.closest('form')?.remove();openingDraft=null;draw();return;}
  if(t.hasAttribute('data-pha-reset')){cal=null;calMm='';plane=false;start=null;tool='pick';render();return;}
  if(t.hasAttribute('data-pha-next')){onAdvance?.('survey',{wall});return;}
  if(t.hasAttribute('data-pha-tool')){tool=t.dataset.phaTool;start=null;render();host.querySelector('[data-pha-tool="'+tool+'"]')?.focus?.({preventScroll:true});return;}
  if(t.hasAttribute('data-pha-select')){select=Number(t.dataset.phaSelect);tool='pick';start=null;draw();return;}
  if(t.hasAttribute('data-pha-overlay')){
   const b=t.getBoundingClientRect();if(b.width<1||b.height<1)return;
   const p=[(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height].map(x=>Math.max(0,Math.min(1,x)));
   if(tool==='pick'){
    const hits=boxes.map((v,i)=>({v,i})).filter(({v})=>p[0]>=v.x1&&p[0]<=v.x2&&p[1]>=v.y1&&p[1]<=v.y2).sort((a,b)=>(a.v.x2-a.v.x1)*(a.v.y2-a.v.y1)-(b.v.x2-b.v.x1)*(b.v.y2-b.v.y1));
    if(hits.length)select=hits[0].i;
   }else if(!start)start=p;
   else if(tool==='cal'){cal={a:start,b:p};start=null;tool='pick';}
   else{
    const rect=rectFromPoints(start,p);if(!rect){tell('حدّد زاويتين متقابلتين ومتباعدتين.');start=null;draw();return;}
    if(tool==='correct'&&boxes[select])Object.assign(boxes[select],rect,{origin:'manual'});
    else if(boxes.length<32){boxes.push({...rect,number:++seq,origin:'manual',kind:'',checked:true});select=boxes.length-1;}
    else tell('الحد الأقصى اثنان وثلاثون عنصرًا في الصورة.');
    tool='pick';start=null;
   }
   render();return;
  }
  if(!t.hasAttribute('data-pha-save')||saving)return;
  const src=getDoc(),selected=boxes.filter(v=>v.checked).map(b=>({...b})),calibration=inst();
  if(!selected.length||selected.some(b=>!photoClasses[b.kind])){tell('حدّد عنصرًا واختر نوع كل عنصر أدرجته.');return;}
  if((cal||calMm||plane)&&!photoMetric(selected[0],calibration,w,h)){tell('أكمل خط المعايرة وقيمته وتأكيد مستوى الجدار، أو ألغ المعايرة لحفظ حدود الصورة فقط.');return;}
  if(!ref)return;
  saving=true;t.disabled=true;
  try{
   const result=registerPhotoHints(src,{wall,selected,photo:ref,w,h,calibration});if(!result.ok)throw Error(result.reason);
   const saved=apply(result.doc,'حُفظت الحدود وتقديرات الصورة في سجل الفني للمراجعة الميدانية.');if(saved?.ok===false)throw Error(saved.reason);
   render();
  }catch(err){if(!signal.aborted)tell(err.message||'تعذّر حفظ المرفق.');}
  finally{saving=false;t.disabled=false;}
 },{signal});
 render();if(focus.photoId)void openSaved(focus.photoId);
 const dispose=()=>{controller.abort();planeController?.abort();serial++;if(imageUrl)URL.revokeObjectURL(imageUrl);};
 dispose.commandContext=()=>({wall});return dispose;
}
