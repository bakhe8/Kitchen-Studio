import {updateRun,updateUnit,kitchenUnitSpecs,applyKitchenCatalogEntry} from './kitchen-model.js';
import {finishMembers,handlePreviewNote} from './kitchen-finish-parts.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {roomFaceLabels} from './shelf-room-model.js';
import {copyKitchenUnit,copyDestinations} from './kitchen-creative-model.js';
import {kitchenFrontFinishes as fronts,kitchenWorktopFinishes as tops,kitchenMaterialFamilies} from './kitchen-materials.js';
import {studioCatalogEntries,kitchenFrontStyles,kitchenHandleStyles,kitchenDoorHandings} from './kitchen-catalog.js';
const n=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(x);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wallTitle=(r,i,arr)=>r.placement==='free'?'جزيرة '+n(arr.filter(v=>v.placement==='free').findIndex(v=>v.id===r.id)+1):(roomFaceLabels[r.wall]||'صف')+' · '+(r.tier==='upper'?'علوي':'سفلي')+' · '+n(r.start)+'–'+n(r.end)+' سم';
const swatches=(type,map,chosen)=>Object.entries(map).map(([v,p])=>'<button type="button" class="kmat-choice" data-swatch="'+type+'" data-value="'+v+'" aria-pressed="'+(v===chosen)+'" aria-label="'+(type==='front'?'واجهة ':'سطح ')+p.label+'" title="'+p.label+'"><i class="kmat-chip" data-texture="'+p.texture+'" style="--kmat:'+p.color+';--kmat-line:'+p.ink+'"></i><span>'+p.label+'</span></button>').join('');
const tint=(key,label,value)=>'<label class="kcreative-tint">'+label+'<input type="color" data-tint="'+key+'" aria-label="'+label+'" value="'+(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:'#819885')+'"></label>';
const scale=(v,start,len)=>Math.max(0,Math.min(100,100*(v-start)/len));
export function mountKitchenCreative(slot,{getKitchen,getPlan,getSelection,onCommit,onSelect,onTemplate,note}){
 if(!slot)return {refresh(){},destroy(){}};
 const ac=new AbortController(),listen=(k,fn)=>slot.addEventListener(k,fn,{signal:ac.signal});
 let templateFocus=null,key=null,stamp=null,copyMode=false,destId=null,offset=null,materialOpen=false,search='',family='';
 const choice=(caption,section,map,selected,defaultName)=>'<label class="kcreative-field">'+caption+'<select data-c-style="'+section+'"><option value="">'+defaultName+'</option>'+Object.entries(map).map(([id,v])=>'<option value="'+id+'"'+(id===selected?' selected':'')+'>'+v.label+'</option>').join('')+'</select></label>';
 function filterMaterials(){
  const groups={front:new Set(studioCatalogEntries({section:'front',query:search,family}).map(e=>e.id)),top:new Set(studioCatalogEntries({section:'worktop',query:search,family}).map(e=>e.id))};
  let count=0;for(const b of slot.querySelectorAll?.('[data-swatch]')||[]){b.hidden=!groups[b.dataset.swatch]?.has(b.dataset.value);if(!b.hidden)count++;}
  const result=slot.querySelector('[data-c-found]');if(result)result.textContent=count?'العينات المتاحة: '+n(count):'لا توجد عينة تطابق البحث.';
 }
 function ctx(){
  const s=getSelection?.(),k=getKitchen(),u=s?.kind==='unit'?k.units.find(v=>v.id===s.id):null,
    r=u?k.runs.find(v=>v.id===u.runId):s?.kind==='run'?k.runs.find(v=>v.id===s.id):null;
  return {s,k,u,r};
 }
 function refresh(show=true){
  const {s,k,u,r}=ctx();
  if(!show||!r){slot.hidden=true;return;}
  slot.hidden=false;const id=s.kind+'/'+s.id;
  if(id!==key){templateFocus=null;copyMode=false;destId=null;offset=null;materialOpen=false;search='';family='';key=id;stamp=null;}
  const sig=JSON.stringify([id,k,copyMode,destId,offset,materialOpen,templateFocus]);if(stamp===sig)return;stamp=sig;
  const heading=u?'واجهة الوحدة':'سطح العمل';
  let h='<div class="kcreative">';
  if(u&&kitchenUnitSpecs[u.kind]?.configurableHanding)h+='<label class="kcreative-field">فتح ضلف الخزانة<select data-c-door-handing>'+Object.entries(kitchenDoorHandings).map(([id,v])=>'<option value="'+id+'"'+(id===(u.doorHanding||'auto')?' selected':'')+'>'+v.label+'</option>').join('')+'</select></label><p class="kcreative-note">اليمين واليسار كما تراهما وأنت تواجه الخزانة. جرّب النتيجة بأداة اختبار الفتح.</p>';
  h+='<button class="kcreative-toggle" type="button" data-c-action="mat" aria-expanded="'+materialOpen+'"><b>الخامات والألوان</b><span>'+(materialOpen?'−':'+')+'</span></button>';
  if(materialOpen){
   const spec=u&&kitchenUnitSpecs[u.kind];
   if(spec?.frontStyles)h+=choice('هيئة الواجهة','front-style',kitchenFrontStyles,u.frontStyle,'هيئة التصميم الأصلية');
   if(spec?.handles){
    const room=getPlan()?.room,ws=room?.workshop,cat=readWorkshopCatalog(ws);
    const managed=cat?.families&&finishMembers({room,kitchen:k},cat).find(e=>e.id===u.id);
    const f=managed&&cat.families[managed.family],handle=f?.finishSlots?.handle;
    if(handle?.drilling){
     const sku=ws.finishes?.partUnits?.[u.id]?.handle||ws.finishes?.partDefaults?.handle||handle.source;
     h+=choice('اليد على الواجهة','handle',{handleless:kitchenHandleStyles.handleless},u.handleStyle==='handleless'?'handleless':'','موديل المصنع · '+safe(sku))+
      '<p class="kcreative-note">'+safe(handlePreviewNote(handle,sku,f.recipe))+' غيّر الموديل من تشطيب أجزاء الوحدة.</p>';
    }else h+=choice('نوع المقبض','handle',kitchenHandleStyles,u.handleStyle,'مقبض التصميم الأصلي');
   }
   if(templateFocus&&onTemplate)h+='<button type="button" data-c-action="template">قياس قالب هذه القطعة</button>';
   if(u||r.tier==='base')h+='<label class="kcreative-field">بحث في خامات الاستوديو<input type="search" data-c-mat-search value="'+safe(search)+'" placeholder="مثلاً: رخام أو جوز"></label><label class="kcreative-field">عائلة الخامة<select data-c-mat-family><option value="">كل العائلات</option>'+Object.entries(kitchenMaterialFamilies).map(([fid,label])=>'<option value="'+fid+'"'+(fid===family?' selected':'')+'>'+label+'</option>').join('')+'</select></label><p class="kcreative-note" data-c-found role="status"></p>';
   if(u)h+='<p class="kcreative-cap">'+heading+' فقط</p><div class="kmat-grid">'+swatches('front',fronts,u.frontFinish)+'</div>'+tint('front','لون واجهة من اختيارك',u.frontColor||fronts[u.frontFinish]?.color);
   if(r.tier==='base')h+='<p class="kcreative-cap">سطح العمل لهذا الصف</p><div class="kmat-grid">'+swatches('top',tops,r.worktopFinish)+'</div>'+tint('top','لون سطح من اختيارك',r.worktopColor||tops[r.worktopFinish]?.color||'#d9cbb0');
   if(!u&&r.tier!=='base')h+='<p>اختر وحدة في الصف العلوي لتغيير لون واجهتها.</p>';
  }
  if(u){h+='<button class="kcreative-toggle" type="button" data-c-action="copy" aria-expanded="'+copyMode+'"><b>نسخ الوحدة إلى موضع آخر</b><span>'+(copyMode?'−':'+')+'</span></button>';
   if(copyMode){
    const ds=copyDestinations(k,getPlan(),u.id),available=ds.filter(d=>d.gaps.length);
    const dst=available.find(d=>d.run.id===destId)||available.find(d=>d.run.id===r.id)||available[0];
    if(!dst)h+='<p class="kcreative-note">العرض المطلوب '+n(u.width)+' سم. لا يتسع أي فراغ للنسخة الآن؛ مدّد صفًا أو ارسم جزيرة ثم أعد النسخ.</p>';
    else{
      destId=dst.run.id;if(offset===null)offset=dst.gaps[0].start;
      h+='<label class="kcreative-field">صف الوجهة<select data-copy-dest>'+available.map(d=>'<option value="'+safe(d.run.id)+'" '+(d.run.id===destId?'selected':'')+'>'+safe(wallTitle(d.run,0,k.runs))+'</option>').join('')+'</select></label>';
      h+='<label class="kcreative-field">بداية النسخة (سم)<input data-copy-offset type="number" step="any" value="'+safe(offset)+'" dir="ltr"></label>';
      h+='<div class="kcopy-preview" aria-label="معاينة الصف: الوحدات الموجودة والموضع المقترح للنسخة" dir="ltr">'+dst.occupants.map(v=>'<span style="left:'+scale(v.u,dst.run.start,dst.run.end-dst.run.start)+'%;width:'+scale(v.width,0,dst.run.end-dst.run.start)+'%"></span>').join('')+'<i data-copy-outline></i></div><p class="kcreative-note" data-copy-note></p><button type="button" data-c-action="apply" class="kcopy-submit">ضع النسخة هنا</button>';
    }
   }
  }
  slot.innerHTML=h+'</div>';if(materialOpen)filterMaterials();if(u&&copyMode)copyPreview();
 }
 function copyPreview(){
  const {k,u}=ctx(),run=k.runs.find(v=>v.id===destId),input=slot.querySelector('[data-copy-offset]');if(!u||!run||!input)return;
  const v=input.value.trim()===''?NaN:Number(input.value),ok=copyKitchenUnit(k,getPlan(),u.id,run.id,v);
  const out=slot.querySelector('[data-copy-outline]'),msg=slot.querySelector('[data-copy-note]'),button=slot.querySelector('[data-c-action=apply]'),len=run.end-run.start;
  out.style.left=scale(v,run.start,len)+'%';out.style.width=scale(u.width,0,len)+'%';out.dataset.valid=String(ok.ok);out.hidden=!Number.isFinite(v);
  button.disabled=!ok.ok;msg.textContent=ok.ok?'نسخة مستقلة بعرض '+n(u.width)+' سم، من '+n(v)+' إلى '+n(v+u.width)+' سم. تحتفظ بالتقسيم والواجهة وتأخذ عمق صف الوجهة وارتفاعه.':ok.reason;
 }
 listen('input',e=>{if(e.target.matches?.('[data-c-mat-search]')){search=e.target.value;filterMaterials();return;}if(e.target.matches?.('[data-copy-offset]')){offset=e.target.value;copyPreview();}});
 listen('change',e=>{if(e.target.dataset?.tint){
   const {k,u,r}=ctx(),v=e.target.value;if(!r||!/^#[0-9a-f]{6}$/i.test(v))return;
   const ret=e.target.dataset.tint==='front'&&u?updateUnit(k,getPlan(),u.id,{frontColor:v}):updateRun(k,getPlan(),r.id,{worktopColor:v});
   if(ret.ok&&ret.changed)onCommit(ret.kitchen,'حُفظ اللون الذي اخترته.');stamp=null;refresh(true);return;
  }if(e.target.matches?.('[data-c-door-handing]')){
   const {k,u}=ctx();if(!u)return;const ret=updateUnit(k,getPlan(),u.id,{doorHanding:e.target.value});
   if(!ret.ok){note?.(ret.reason,'warn');return;}if(ret.changed)onCommit(ret.kitchen,'تغيّر فتح ضلف الخزانة.');stamp=null;refresh(true);return;
  }if(e.target.matches?.('[data-c-mat-family]')){family=e.target.value;filterMaterials();return;}
  if(e.target.dataset?.cStyle){
   const {k,u,s}=ctx();if(!u)return;const section=e.target.dataset.cStyle,v=e.target.value,field=section==='handle'?'handleStyle':'frontStyle';
   const ret=v?applyKitchenCatalogEntry(k,getPlan(),{id:v,section},s):updateUnit(k,getPlan(),u.id,{[field]:null});
   if(!ret.ok){note?.(ret.reason,'warn');return;}if(ret.changed)onCommit(ret.kitchen,section==='handle'?'تغيّر مقبض الوحدة.':'تغيّرت هيئة واجهة الوحدة.');stamp=null;refresh(true);return;
  }if(e.target.matches?.('[data-copy-dest]')){destId=e.target.value;offset=null;stamp=null;refresh(true);}});
 listen('click',e=>{
  const b=e.target.closest?.('button');if(!b||!slot.contains(b)||b.disabled)return;
  const {k,u,r}=ctx();if(!r)return;
  if(b.dataset.swatch){
   const isFront=b.dataset.swatch==='front',v=b.dataset.value;
   const ret=isFront&&u&&fronts[v]?updateUnit(k,getPlan(),u.id,{frontFinish:v,frontColor:null}):!isFront&&tops[v]?updateRun(k,getPlan(),r.id,{worktopFinish:v,worktopColor:null}):null;
   if(!ret?.ok){if(ret?.reason)note?.(ret.reason,'warn');return;}if(ret.changed)onCommit(ret.kitchen,isFront?'تغيّر تشطيب واجهة الوحدة.':'تغيّر تشطيب سطح هذا الصف.');stamp=null;refresh(true);return;
  }
  const act=b.dataset.cAction;
  if(act==='template'&&onTemplate&&r.id===templateFocus?.runId){onTemplate({...templateFocus});return;}
  if(act==='mat'){materialOpen=!materialOpen;stamp=null;refresh(true);}
  if(act==='copy'){copyMode=!copyMode;stamp=null;refresh(true);}
  if(act==='apply'&&u){
   const input=slot.querySelector('[data-copy-offset]');const result=copyKitchenUnit(k,getPlan(),u.id,destId,input&&input.value.trim()!==''?+input.value:NaN);
   if(!result.ok){note?.(result.reason,'warn');copyPreview();return;}
   copyMode=false;stamp=null;onCommit(result.kitchen,'أُضيفت نسخة مستقلة من '+(kitchenUnitSpecs[u.kind]?.label||'الوحدة')+'. بقي الأصل في مكانه.');onSelect?.('unit',result.id);
  }
 });
 function inspectMaterial(part,focus={}){
  const {u,r}=ctx();if(!r)return false;refresh(true);
  materialOpen=true;search='';family='';
  templateFocus=part==='worktop'&&onTemplate?{runId:r.id,...(focus.topId?{topId:focus.topId}:{}),...(focus.unitId?{unitId:focus.unitId}:{})}:null;
  stamp=null;refresh(true);
  const style=part==='handle'?'[data-c-style="handle"]':part==='front'?'[data-c-style="front-style"]':null;
  const control=(style&&slot.querySelector(style))||slot.querySelector(u?'[data-swatch="front"]':'[data-swatch="top"]')||slot.querySelector('[data-c-action="mat"]');
  control?.focus?.({preventScroll:true});control?.scrollIntoView?.({block:'nearest'});return true;
 }
 return {refresh,inspectMaterial,destroy(){ac.abort();slot.replaceChildren();}};
}
