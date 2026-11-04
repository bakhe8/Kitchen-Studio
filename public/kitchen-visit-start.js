import {intakeRoomDrawing} from './kitchen-intake-drawing.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {newProjectDefaultRoom} from './kitchen-defaults-model.js';
import {readPerimeterDraft,clearPerimeterDraft} from './kitchen-perimeter-draft.js';
import {newSurveyProject} from './kitchen-project.js';
import {projectArchiveSizeLimit} from './kitchen-field-files.js';
import {mountSavedProjects} from './kitchen-saved-projects-ui.js';
import {openSavedNow,deleteSavedProject,takeSwitchNotice,pruneOrphanDrafts} from './kitchen-project-switch.js';
import {deviceReadiness,readinessText} from './kitchen-device-catalog.js';

const format = new Intl.NumberFormat('ar-SA');
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields = [
  {key:'widthMm', label:'العرض الداخلي',short:'العرض', limit:12000},
  {key:'lengthMm', label:'العمق الداخلي',short:'العمق', limit:12000},
  {key:'heightMm', label:'ارتفاع السقف',short:'الارتفاع', limit:6000}
];

function readingField(f,index){
  return `<label class="visit-coordinate" data-anchor="${f.key}" for="visit-${f.key}"><span class="visit-field-label"><i aria-hidden="true">${format.format(index+1)}</i>${f.label}</span><span class="visit-value"><input name="${f.key}" id="visit-${f.key}" inputmode="numeric" enterkeyhint="${f.key==='heightMm'?'go':'next'}" required autocomplete="off" aria-label="${f.label} بالملليمتر" placeholder="أدخل القياس" dir="ltr"><small>مم</small></span></label>`;
}
const validReading=(value,field)=>Number.isInteger(value)&&value>=600&&value<=field.limit;
const readingError=field=>'أدخل قياسًا صحيحًا من ٦٠٠ إلى '+format.format(field.limit)+' مم.';

export function mountVisitStart(openEditor){
  const main=document.createElement('main');
  main.id='kitchen-workspace';main.className='visit-start';main.tabIndex=-1;
  main.innerHTML=`<div class="visit-top"><header class="visit-mast"><div><img src="./studio-mark.svg" width="38" height="38" alt=""><strong>استوديو المطابخ</strong><span class="visit-mast-stage">زيارة الموقع</span></div><nav class="visit-file-actions" aria-label="ملفات الاستوديو"><button type="button" data-file-open>${studioIcon('file')} فتح ملف مشروع</button><a href="?panel=workshop&amp;step=home">${studioIcon('plan')} بوابات العمل</a></nav><input hidden type="file" accept=".json,application/json" aria-label="ملف مشروع الاستوديو"></header><section class="visit-saved" data-saved-projects hidden></section><section class="visit-catalog" data-catalog-status></section></div>
  <form class="visit-sheet" novalidate aria-labelledby="visit-title">
    <div class="visit-context">
      <div class="visit-title"><h1 id="visit-title">رفع مطبخ جديد</h1><span>ابدأ بأبعاد الغرفة، ثم سجّل تفاصيل كل جدار.</span></div>
      <label class="visit-project">اسم المشروع <small>اختياري</small><input name="name" maxlength="64" autocomplete="off" placeholder="اسم العميل أو المشروع"></label>
      <div class="visit-method"><span>طريقة الرفع</span><div role="group" aria-label="طريقة رفع الغرفة"><span class="visit-current-method">${studioIcon('check')} غرفة مستطيلة</span><button type="button" data-open-perimeter>جدارًا جدارًا</button></div></div>
    </div>
    <section class="visit-board" aria-labelledby="visit-board-title">
      <header class="visit-board-top"><h2 id="visit-board-title">${studioIcon('ruler')} لوحة القياس</h2><span>بين وجهي التشطيب <b>مم</b></span></header>
      <div class="visit-paper"><div class="visit-graphic"></div>${fields.map(readingField).join('')}</div>
    </section>
    <footer class="visit-submit"><div class="visit-progress"><div class="visit-count" aria-live="polite"><b data-visit-count></b></div><div class="visit-jumps" role="group" aria-label="انتقال إلى قياس">${fields.map(f=>'<button type="button" data-meter="'+f.key+'" aria-controls="visit-'+f.key+'" aria-label="تعديل '+f.label+'">'+studioIcon('check')+'<span>'+f.short+'</span></button>').join('')}</div><span data-visit-tip aria-live="polite"></span></div><p class="visit-message" role="status"></p>
      <button class="visit-next" type="submit"><span data-next-label></span> ${studioIcon('next')}</button></footer>
  </form>
  <dialog class="visit-dialog visit-perimeter" aria-label="إدخال محيط الجدران"><header><strong>محيط الغرفة</strong><button type="button" data-close-perimeter>رجوع</button></header><div class="ws-content" data-outline-host></div><p data-outline-msg role="status"></p></dialog>
`;
  document.body.append(main);
  document.querySelector('.sp-skip').href='#kitchen-workspace';
  const q=s=>main.querySelector(s), form=q('form'), msg=q('.visit-message'), file=q('input[type=file]'),perimeter=q('.visit-perimeter');
  let busy=false,visibleDraftRevision=null;
  const graphic=q('.visit-graphic');
  const roomValues=()=>Object.fromEntries(fields.map(f=>[f.key,assistNumber(form.elements[f.key].value)]));
  const countNode=q('[data-visit-count]'),tipNode=q('[data-visit-tip]');
  const fieldNodes=Object.fromEntries(fields.map(f=>[f.key,q('[data-anchor="'+f.key+'"]')]));
  const meters=Object.fromEntries(fields.map(f=>[f.key,q('[data-meter="'+f.key+'"]')]));
  for(const {key} of fields)meters[key].addEventListener('click',()=>{
    const input=form.elements[key];input.focus();input.select();
  });
  const nextLabel=q('[data-next-label]');
  const redraw=()=>{
    const values=roomValues();
    for(const f of fields)if(!validReading(values[f.key],f))values[f.key]=null;
    const width=graphic.clientWidth||960,height=graphic.clientHeight||460;
    const {svg,anchors}=intakeRoomDrawing(values,{width,height});
    graphic.innerHTML=svg;
    // Fields stay mounted as portable native inputs so resizing and editing
    // the graph never replaces the active input, its value or its caret.
    const next=fields.find(f=>values[f.key]===null);
    for(const {key} of fields){
      const node=fieldNodes[key],anchor=anchors[key];
      node.style.left=(100*anchor.x/width)+'%';
      node.style.top=(100*anchor.y/height)+'%';
      node.dataset.measured=String(values[key]!==null);
      node.dataset.next=String(next?.key===key);
      meters[key].dataset.measured=node.dataset.measured;
      meters[key].dataset.next=node.dataset.next;
    }
    const known=fields.filter(f=>values[f.key]!==null).length;
    const action=next?'إدخال '+next.label:'بدء رفع الجدار الأول';
    if(nextLabel.textContent!==action)nextLabel.textContent=action;
    const count=format.format(known)+' من ٣ مقاسات';
    const tip=next?'اختر القياس على الرسم وأدخله بالملليمتر':'اكتملت أبعاد الغرفة';
    if(countNode.textContent!==count)countNode.textContent=count;
    if(tipNode.textContent!==tip)tipNode.textContent=tip;
  };
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(redraw):null;
  observer?.observe(graphic);
  const open=async (getDoc,imported,fromPerimeter=false)=>{
    if(busy)return {ok:false,reason:'جارٍ حفظ المشروع.'};busy=true;form.querySelector('[type=submit]').disabled=true;q('[data-file-open]').disabled=true;
    try{
      const doc=await getDoc(),prior=fromPerimeter?null:readPerimeterDraft();
      if(prior&&prior.revision!==visibleDraftRevision){refreshPerimeterLabel();throw Error('تغيّرت مسودة الرفع في نافذة أخرى. راجعها قبل فتح مشروع آخر.');}
      if(prior&&!window.confirm('توجد مسودة رفع جدارًا جدارًا. هل تفتح هذا المشروع وتستبدل المسودة بعد نجاح الحفظ؟')){
        return {ok:false,reason:'بقيت مسودة الرفع محفوظة.'};
      }
      await openEditor(doc,imported);perimeterDispose?.();
      if(prior)await clearPerimeterDraft(undefined,prior.revision);
      observer?.disconnect();main.remove();return {ok:true,saved:true};
    }
    catch(e){msg.textContent=e.message||'تعذّر فتح المشروع.';return {ok:false,reason:msg.textContent};}
    finally{busy=false;form.querySelector('[type=submit]').disabled=false;q('[data-file-open]').disabled=false;}
  };
  function focusMeasurement(event){
    if(busy||event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    let key=event.target.closest?.('[data-visit-measure]')?.dataset.visitMeasure;
    if(!key&&event.type==='click'){
      const shape=event.target.closest?.('[data-visit-shape]')?.dataset.visitShape;
      if(shape==='volume')key='heightMm';
      if(shape==='plan')key=fields.slice(0,2).find(f=>!validReading(assistNumber(form.elements[f.key].value),f))?.key||'widthMm';
    }
    if(!fields.some(f=>f.key===key))return;
    event.preventDefault?.();const input=form.elements[key];input.focus();input.select();
  }
  graphic.addEventListener('click',focusMeasurement);
  graphic.addEventListener('keydown',focusMeasurement);
  form.addEventListener('input',e=>{
    e.target.setCustomValidity('');msg.textContent='';
    if(e.target!==form.elements.name)redraw();
  });
  form.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing||busy)return;
    const index=fields.findIndex(f=>form.elements[f.key]===e.target);
    if(index<0||index===fields.length-1)return;
    e.preventDefault();
    if(!validReading(assistNumber(e.target.value),fields[index])){
      e.target.setCustomValidity(readingError(fields[index]));e.target.reportValidity();return;
    }
    const next=form.elements[fields[index+1].key];next.focus();next.select();
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();const values=roomValues();
    for(const f of fields){
      const n=values[f.key];
      if(!validReading(n,f)){
        const input=form.elements[f.key];input.focus();input.select();
        if(input.value.trim()){input.setCustomValidity(readingError(f));input.reportValidity();}
        return;
      }
    }
    void open(()=>newSurveyProject({...values,name:form.elements.name.value}),false);
  });
  q('[data-file-open]').onclick=()=>file.click();
  file.onchange=()=>{
    const archive=file.files?.[0];file.value='';if(!archive)return;
    void open(async()=>{
      if(archive.size>projectArchiveSizeLimit)throw Error('الملف أكبر من ١٢٨ م.ب.');
      const {decodeCloudProject}=await import('./kitchen-workshop-sync-ui.js');
      let data;try{data=JSON.parse(await archive.text());}catch{throw Error('اختر ملف مشروع صالحًا بصيغة JSON.');}
      return decodeCloudProject(data);
    },true);
  };
  let perimeterLoad=null,perimeterDispose=null;
  const perimeterEntry=q('[data-open-perimeter]');
  const outlineMsg=q('[data-outline-msg]');
  function refreshPerimeterLabel(){
    const saved=readPerimeterDraft();visibleDraftRevision=saved?.revision||null;
    perimeterEntry.textContent=saved?'استئناف الرفع جدارًا جدارًا':'جدارًا جدارًا';
    perimeterEntry.title=saved?'فتح مسودة المحيط المحفوظة في هذا المتصفح':'أدخل طول كل جدار واتجاهه وما عليه بالترتيب';
  }
  refreshPerimeterLabel();
  // Projects put aside earlier stay one tap away, so starting another visit never means losing the first.
  pruneOrphanDrafts();
  mountSavedProjects(q('[data-saved-projects]'),{notice:takeSwitchNotice(),
    onOpen:id=>openSavedNow(id),
    onDelete:id=>deleteSavedProject(id)});
  // Prices come from the factory catalog set up on this device; say now whether it is ready, not after the visit.
  const catalogBox=q('[data-catalog-status]'),catalog=deviceReadiness();
  catalogBox.dataset.state=catalog.state;
  catalogBox.innerHTML='<div class="vc-box"><p>'+escapeText(readinessText(catalog))+'</p><a href="?panel=workshop&amp;step=template">'+(catalog.state==='ready'?'مراجعة الكتالوج':'إعداد الكتالوج')+'</a></div>';
  function leavePerimeter(){
    const close=()=>perimeter.close();
    if(!perimeterDispose?.requestLeave||perimeterDispose.requestLeave(close)!==false)close();
  }
  q('[data-close-perimeter]').onclick=leavePerimeter;
  perimeter.addEventListener('cancel',event=>{event.preventDefault();leavePerimeter();});
  perimeter.addEventListener('close',()=>{refreshPerimeterLabel();perimeterEntry.focus();});
  perimeterEntry.onclick=async()=>{
    if(!perimeter.open)perimeter.showModal();
    outlineMsg.textContent='';
    if(perimeterDispose)return;
    try{
      perimeterLoad??=import('./kitchen-measured-outline-ui.js');
      const {mountMeasuredOutline}=await perimeterLoad;
      if(perimeterDispose||!main.isConnected)return;
      const typedHeight=assistNumber(form.elements.heightMm.value);
      perimeterDispose=mountMeasuredOutline(q('[data-outline-host]'),{
        initial:true,initialHeightMm:Number.isInteger(typedHeight)&&typedHeight>=600&&typedHeight<=6000?typedHeight:null,
        getDoc:()=>null,tell:()=>{},
        apply:next=>open(()=>({...next,room:newProjectDefaultRoom({...next.room,name:(form.elements.name.value.trim()||next.room.architecture?.outline?.reference||'مشروع مطبخ').slice(0,64)})}),false,true),
        onAdvance:()=>{}
      });
    }catch{perimeterLoad=null;outlineMsg.textContent='تعذّر فتح رسم المحيط.';}
  };
  redraw();
}
