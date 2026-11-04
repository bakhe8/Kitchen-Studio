import {assistNumber} from './kitchen-measurement-identity.js';
import {wallPlane,measurePlaneOpening,storePlanePhoto,planePhotoCoverage} from './kitchen-photo-plane.js';
import {photoOpeningProposal} from './kitchen-workshop-photo.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const corners=['أسفل عند بداية الجدار','أسفل باتجاه نهايته','أعلى باتجاه النهاية','أعلى عند البداية'];
const fields=[['x','المسافة من بداية الجدار لأول مرجع'],['y','ارتفاع المرجع الأول عن الأرض'],['w','عرض المستطيل المعلوم'],['h','ارتفاعه'],['cx','مسافة نقطة التحقق من بداية الجدار'],['cy','منسوب نقطة التحقق'],['t','أقصى خطأ مقبول في نقطة التحقق']];
export function mountPhotoPlane(host,{getDoc,apply,tell,wall,imageUrl,getPhoto,photoId,openForm,signal}){
 const doc=getDoc();let control=[],frame=[],mode='control',photo=photoId,kind='window',busy=false;
 const source=()=>doc.room.fieldRegister?.records.find(r=>r.id==='plane-'+photo+'-'+wall);
 let saved=null;try{saved=JSON.parse(source()?.notes||'null')?.calibration;}catch{}
 if(saved){control=[...saved.pixels,saved.checkPixel];mode='frame';}
 const values=saved?[...saved.origin,...saved.size,...saved.checkMm,saved.tolerance]:[];
 host.innerHTML='<h3>قياس برواز من صورة مائلة</h3><p>على مستوى البرواز نفسه حدّد أركان مستطيل معلوم المقاس، ثم نقطة تحقق خامسة قِستها بشكل مستقل. تغطي المعايرة المساحة داخل المراجع الأربعة. سجّل الأبعاد من ركن بداية الجدار ومن الأرض المشطبة بالملليمتر.</p><label>مرجع القياسات<input data-ref maxlength="170" value="'+esc(saved?.reference)+'"></label>'+
 fields.map(([k,l],i)=>'<label>'+l+' (مم)<input data-n="'+k+'" inputmode="decimal" value="'+esc(values[i])+'"></label>').join('')+
 '<p><button data-action="control">تعيين المراجع الخمسة من جديد</button> <button data-action="frame">تحديد برواز جديد</button> <button data-action="undo">تراجع عن آخر نقطة</button></p><p data-prompt role="status"></p><div class="pha-image"><img src="'+esc(imageUrl)+'" alt="الصورة الأصلية لتعيين نقاط الضبط"><svg data-map viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="اختيار نقاط المعايرة والبرواز"></svg></div><label>نوع البرواز<select data-kind><option value="window">نافذة</option><option value="door">باب</option></select></label><div data-result></div><button data-action="coverage">حفظ تغطية الصورة لهذا الجدار</button> <button data-action="save">حفظ البرواز المستخرج ومراجعته للرسم</button><div data-coverage></div><div data-past></div>';
 const field=k=>host.querySelector('[data-n="'+k+'"]'),n=k=>assistNumber(field(k).value);
 const cal=()=>({pixels:control.slice(0,4),checkPixel:control[4],origin:[n('x'),n('y')],size:[n('w'),n('h')],checkMm:[n('cx'),n('cy')],tolerance:n('t'),reference:host.querySelector('[data-ref]').value.trim()});
 function draw(){
  const c=cal(),doc=getDoc(),p=wallPlane(doc,wall,c),m=frame.length===4&&measurePlaneOpening(doc,wall,c,frame);
  const list=mode==='control'?control:frame,step=list.length;
  host.querySelector('[data-prompt]').textContent=mode==='control'?(step<4?'اضغط على مرجع '+(step+1)+' · '+corners[step]:step===4?'اضغط على نقطة التحقق الخامسة.':'اكتمل تحديد المراجع. حدّد البرواز أو احفظ التغطية.'):(step<4?'اضغط على الطرف الخارجي للبرواز · '+corners[step]:'اكتملت أركان البرواز.');
  const shape=(points,color)=>points.length>1?'<polyline style="fill:none;stroke:'+color+';stroke-width:.45" points="'+points.slice(0,4).concat(points.length>=4?[points[0]]:[]).map(([x,y])=>x*100+','+y*100).join(' ')+'"/>':'';
  host.querySelector('[data-map]').innerHTML=shape(control,'#78ffbf')+shape(frame,'#ffd568')+[...control,...frame].map(([x,y],i)=>'<circle vector-effect="non-scaling-stroke" cx="'+x*100+'" cy="'+y*100+'" r=".85"/><text x="'+(x*100+1)+'" y="'+y*100+'" style="font-size:3px;stroke-width:.2">'+(i<control.length?i+1:i-control.length+1)+'</text>').join('');
  host.querySelector('[data-result]').textContent=control.length<5?'':!p.ok?p.reason:m&&!m.ok?m.reason:'فرق نقطة التحقق '+fmt(p.residual)+' مم.'+(m?.ok?' البرواز '+fmt(m.width)+' × '+fmt(m.height)+' مم، يبدأ على '+fmt(m.gapMm)+' مم، ومنسوب أسفله '+fmt(m.bottomMm)+' مم.':'');
  host.querySelector('[data-action="save"]').disabled=busy||!m?.ok;host.querySelector('[data-action="coverage"]').disabled=busy||!p.ok;
  const v=planePhotoCoverage(doc,wall),g=v?.largest;
  host.querySelector('[data-coverage]').textContent=v?'مساحة المستوى الموثق بالصور '+fmt(v.coveredM2)+' من '+fmt(v.wallM2)+' م².'+(g?' منطقة تحتاج لقطة مرجعية من '+fmt(g.fromMm)+' إلى '+fmt(g.toMm)+' مم وبارتفاع '+fmt(g.bottomMm)+' إلى '+fmt(g.topMm)+' مم.':'')+(v.stale.length?' تغيّر الجدار بعد معايرة صور سابقة.':''):'';
  const existing=(doc.room.fieldRegister?.records||[]).filter(r=>r.valueType==='polygon'&&photo&&r.attachments?.[0]?.id===photo&&r.id.startsWith('wa-')).map(r=>Number(r.itemId.split('-').at(-1))).filter(v=>photoOpeningProposal(doc,photo,v,wall)?.calibration?.mode==='perspective');
  host.querySelector('[data-past]').innerHTML=existing.map(v=>'<button data-review="'+v+'">مراجعة قياس البرواز رقم '+v+' للرسم</button>').join(' ');
 }
 host.addEventListener('input',draw,{signal});host.addEventListener('change',e=>{if(e.target.matches('[data-kind]'))kind=e.target.value;},{signal});
 host.addEventListener('click',async e=>{
  if(busy)return;
  if(e.target.closest('[data-map]')){const rect=host.querySelector('[data-map]').getBoundingClientRect(),list=mode==='control'?control:frame;if(list.length<(mode==='control'?5:4))list.push([(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height].map(n=>Math.max(0,Math.min(1,n))));draw();return;}
  const review=e.target.closest('[data-review]');if(review){openForm(photo,Number(review.dataset.review));return;}
  const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;
  if(a==='control'){control=[];frame=[];mode='control';}else if(a==='frame'){if(!wallPlane(getDoc(),wall,cal()).ok){tell('أكمل معايرة الصورة أولًا.');return;}frame=[];mode='frame';}else if(a==='undo'){(mode==='control'?control:frame).pop();}
  else{
   const before=getDoc(),c=cal(),choice={kind,corners:frame.map(p=>[...p])};busy=true;draw();
   try{const ref=await getPhoto();if(signal.aborted||getDoc()!==before||!host.isConnected)return;
    const out=storePlanePhoto(before,wall,ref,c,a==='save'?choice:null);if(!out.ok){tell(out.reason);return;}
    if(apply(out.doc,'حُفظت معايرة الصورة وربطت بهذا الجدار.')?.ok===false)return;
    photo=ref.id;if(out.number){draw();openForm(photo,out.number);}else tell('حُفظ نطاق التغطية الموثق.');
   }catch(err){tell(err.message);}finally{busy=false;if(host.isConnected)draw();}return;
  }draw();
 },{signal});draw();
}
