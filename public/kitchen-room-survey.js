import {correctCadSurveyFeature,featureDimensionsMm,featureFromDimensionsMm} from './kitchen-cad-measurement.js';
import {surveySketch,bindRoomSketchInput} from './kitchen-room-sketch.js';
import {outputStamp,stampColumns} from './kitchen-output-stamp.js';
import {linkedReadingIndex,pointKinds} from './kitchen-chain-model.js';
import {newProjectDefaultRoom} from './kitchen-defaults-model.js';
import {wireSurveySketch} from './kitchen-survey-handles.js';
import {roomArchitecture,architectureWall,validateKitchenRoomArchitecture} from './kitchen-architecture.js';
import {pointTypes,checkSitePoints} from './kitchen-site-survey-model.js';
import {localRoomPresets,makeSaudiRoom} from './kitchen-room-presets.js';
import {addFeature,updateFeature,removeKitchenItem,kitchenFeatureSpecs as types} from './kitchen-model.js';
import {registerUnsavedWork} from './kitchen-unsaved-work.js';
const shapes={rectangle:'مستطيل',notch:'ردّة منور',chamfer:'ركن مشطوف',taper:'جدار غير متوازٍ'},corners={'back-right':'خلفي أيمن','back-left':'خلفي أيسر','front-right':'أمامي أيمن','front-left':'أمامي أيسر'};
const adj={corridor:'ممر داخلي',yard:'حوش',lightwell:'منور',laundry:'غرفة غسيل',outdoors:'الخارج'};
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n),mm=n=>Math.round(n*10),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(obj,value)=>Object.entries(obj).map(([id,label])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(label)+'</option>').join('');
const field=(name,control)=>'<label class="pr-field"><span>'+name+'</span>'+control+'</label>';
const select=(name,label,items,value)=>field(label,'<select name="'+name+'">'+options(items,value)+'</select>');
const numeric=(name,label,n,min=0,max=14000)=>field(label,'<input type="number" inputmode="numeric" name="'+name+'" min="'+min+'" max="'+max+'" step="1" required value="'+mm(n)+'">');
const action=(id,label,main=false)=>'<button type="button" data-survey-act="'+id+'" class="'+(main?'pr-primary':'')+'">'+label+'</button>';
export {surveySketch};
export function mountRoomSurvey(el,{getDoc,apply,closeOthers,opener,returnFocus,onFinishes,onSurveyReading,onStartWall}){
 const box=document.createElement('aside');box.className='pro-drawer room-survey';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-label','بناء الغرفة');el.append(box);
 box.innerHTML='<header class="pr-head"><span><i></i>بناء الغرفة</span><button type="button" aria-label="إغلاق بناء الغرفة" data-survey-act="close">×</button></header><div class="pr-inner"></div><p class="pr-msg" role="status" aria-live="polite"></p>';
 const q=s=>box.querySelector(s),inner=q('.pr-inner'),say=t=>q('.pr-msg').textContent=t||'';
 let handles=null;let tab='shape',point='',feature='',newKind='door',newFloor='floor-drain';
 let dirty=false,pending=null;
 registerUnsavedWork({atRisk:()=>!box.hidden&&dirty}); // typed in the room panel and not saved: the page must not be closed over it unasked
 const planInput=bindRoomSketchInput(box,{getDoc,blocked:(kind,id)=>dirty&&!(kind==='point'&&tab==='points'&&id===point),getPoint:currentPoint,select:selectSketch});
 function liveSketch(r,wall=null){
  const selected=tab==='points'&&point?{kind:'point',id:point}:tab==='features'&&feature?{kind:'feature',id:feature}:null;
  return surveySketch(r,getDoc(),wall,true,selected);
 }
 function guardSelection(go){
  if(!dirty){go();return;}
  pending=go;q('.pr-msg').innerHTML='<span>لديك تعديل لم يُحفظ.</span> '+action('keep-draft','متابعة التحرير')+' '+action('leave-draft','تجاهل التعديل والانتقال');
  q('[data-survey-act="keep-draft"]').focus({preventScroll:true});
 }
 function selectSketch(kind,id,proposal){
  const doc=getDoc();
  if(kind==='point'&&tab==='points'&&id===point){
   if(proposal)stagePoint(proposal);
   q('[name="x"]')?.focus({preventScroll:true});return;
  }
  guardSelection(()=>{
   if(getDoc()!==doc)return;
   if(kind==='wall'){
    if(architectureWall(doc.room,id)&&onStartWall){close(false);onStartWall(id);}
   }else if(kind==='feature'){
    const f=doc.kitchen.features.find(f=>f.id===id);if(!f)return;
    if(onSurveyReading){close(false);onSurveyReading(f.wall,f.id,proposal);}
    else{tab='features';feature=id;draw();q('[name="offset"]')?.focus();}
   }else if(kind==='point'&&doc.room.sitePoints?.some(p=>p.id===id)){
    tab='points';point=id;say('');draw();
    if(proposal)stagePoint(proposal);
    q('[name="x"]')?.focus({preventScroll:true});
   }
  });
 }
 const names={shape:'المسقط',features:'عناصر الجدار',points:'نقاط الأرضية',presets:'نماذج محلية'};
 function close(focus=false){planInput.cancel();pending=null;dirty=false;handles?.destroy();handles=null;box.hidden=true;opener?.setAttribute('aria-expanded','false');if(focus)(returnFocus?.()||opener)?.focus({preventScroll:true});}
 function open(sub='shape',id=''){closeOthers();tab=names[sub]?sub:'shape';if(tab==='points')point=id;if(tab==='features')feature=id;box.hidden=false;opener?.setAttribute('aria-expanded','true');say('');draw();q('[data-survey-act=close]').focus({preventScroll:true});}
 const tabs=()=>'<div class="pr-tabs survey-tabs">'+Object.entries(names).map(([id,l])=>'<button type="button" data-survey-tab="'+id+'" aria-pressed="'+(id===tab)+'">'+l+'</button>').join('')+'</div>';
 const measurement='<div class="survey-kicker">مقاسات الموقع <b>مم</b></div>';
 const submit=(label,del=null)=>'<div class="survey-actions"><button class="pr-primary" type="submit">'+label+'</button>'+(del?action('remove',del):'')+'</div>';
 const featureName=f=>(types[f.kind]?.label||f.kind)+(f.adjacent?' · '+adj[f.adjacent]:'');
 function shape(r){if(r.architecture?.outline)return '<div>'+liveSketch(r)+'<h3>غرفة ذات محيط مقاس</h3><p>تستخدم أضلاع المسقط المقاس في تبويبات التجهيزات والنقاط. لاستيراد محيط بديل استخدم «مسقط مقاس» في مسار التفصيل.</p>'+action('schedule','تنزيل رفع الموقع · CSV')+'</div>';const c=r.architecture?.cut;return '<form data-survey-form="shape"><div data-shape-preview>'+liveSketch(r)+'</div>'+measurement+'<div class="pr-fields">'+numeric('width','العرض الداخلي',r.width,600,12000)+numeric('length','العمق الداخلي',r.length,600,12000)+numeric('height','الارتفاع الصافي',r.height,600,6000)+numeric('thickness','سماكة الجدران',r.architecture?.wallThickness??20,10,1000)+'</div>'+select('kind','شكل المسقط',shapes,c?.kind||'rectangle')+'<div data-shape-detail>'+cutFields(c?.kind||'rectangle',c)+'</div>'+submit('تطبيق المسقط')+'</form>'+'<div class="survey-actions">'+action('finishes','تشطيبات الغرفة')+action('schedule','تنزيل رفع الموقع · CSV')+'</div>';}
 function cutFields(kind,c){if(kind==='rectangle')return '';return select('corner',kind==='taper'?'الطرف الأضيق':'موضع الركن',corners,c?.corner||'back-right')+'<div class="pr-fields">'+numeric('cutwidth',kind==='taper'?'فرق العرض بين الطرفين':'عرض القطع',c?.width??(kind==='taper'?8:85),1)+(kind==='taper'?'':numeric('cutdepth','عمق القطع',c?.depth??85,1))+'</div>';}
 function fromShape(form){const val=n=>form.elements.namedItem(n).value,n=k=>Number(val(k))/10,kind=val('kind'),r={...getDoc().room,width:n('width'),length:n('length'),height:n('height'),architecture:{wallThickness:n('thickness')}};if(kind!=='rectangle')r.architecture.cut={kind,corner:val('corner'),width:n('cutwidth'),depth:kind==='taper'?r.length:n('cutdepth')};return r;}
 function features(d){const r=d.room,existing=d.kitchen.features.find(f=>f.id===feature),kind=existing?.kind||newKind,base=types[kind],walls=roomArchitecture(r).walls,wall=architectureWall(r,existing?.wall)||walls.find(v=>v.id==='back')||walls[0],f=existing||{...base,kind,u:wall.start+5,bottom:kind==='beam'?r.height-base.height:base.bottom,height:['column','shaft'].includes(kind)?r.height:base.height};
 const linked=linkedReadingIndex(r,existing)>=0,center=pointKinds.has(kind);
 const dimensions=featureDimensionsMm(r,{...f,wall:wall.id});
 const correction=linked?action('correct-reading','تصحيح قياس الزيارة'):'';
 return correction+'<div data-wall-diagram>'+liveSketch(r,wall.id)+'</div>'+select('chooseFeature','العنصر',{'':'+ عنصر جديد',...Object.fromEntries(d.kitchen.features.map((v,i)=>[v.id,fmt(i+1)+' · '+featureName(v)+' · '+(architectureWall(r,v.wall)?.label||'')]))},existing?.id||'')+'<form data-survey-form="features">'+(existing?'':select('newFeatureKind','النوع',Object.fromEntries(Object.entries(types).map(([k,v])=>[k,v.label])),kind))+select('wall','الجدار',Object.fromEntries(walls.map(w=>[w.id,w.label+' · '+fmt(mm(w.length))+' مم'])),wall.id)+measurement+'<div class="pr-fields">'+numeric('offset',center?'من بداية الضلع إلى المركز':'من بداية الضلع إلى الطرف الأول',dimensions.u/10)+numeric('width','العرض',f.width,10,5000)+numeric('bottom',center?'ارتفاع المركز عن البلاط':'ارتفاع الأسفل عن البلاط',dimensions.bottom/10,0,6000)+numeric('height','الارتفاع',f.height,10,6000)+(!['window','door'].includes(kind)?numeric('depth','البروز',f.depth,10,5000):'')+'</div>'+(['door','window'].includes(kind)?select('adjacent',kind==='door'?'يفتح على':'تُطلّ على',{'':'غير محدد',...adj},f.adjacent||''):'')+(kind==='window'?select('glazing','الزجاج',{clear:'شفاف',frosted:'مصنفر'},f.glazing||'clear'):'')+(kind==='door'?'<div class="pr-fields">'+select('hinge','المفصلة',{'':'غير محددة',right:'يمين',left:'يسار'},f.hinge??(existing?'':'left'))+select('swing','حركة الباب',{'':'غير محدد',in:'للداخل',out:'للخارج',sliding:'سحّاب'},f.swing??(existing?'':'in'))+'</div>':'')+submit(existing?'حفظ العنصر':'إضافة العنصر',existing?'إزالة العنصر':null)+'</form>';}
 function currentPoint(id){
  const saved=getDoc().room.sitePoints?.find(p=>p.id===id);
  const form=tab==='points'&&point===id&&q('[data-survey-form="points"]');
  if(!saved||!form)return saved;
  const draft={...saved};
  for(const key of ['x','z','size','accessMargin']){
   const field=form.elements.namedItem(key);
   if(field&&Number.isFinite(field.valueAsNumber))draft[key]=field.valueAsNumber/10;
  }
  return draft;
 }
 function previewPoint(){
  const d=getDoc(),value=currentPoint(point),paper=q('[data-point-diagram]');
  if(!paper||!value)return;
  const r={...d.room,sitePoints:d.room.sitePoints.map(p=>p.id===value.id?value:p)};
  if(checkSitePoints(r).ok)paper.innerHTML=liveSketch(r);
 }
 function stagePoint(p){
  q('[name="x"]').value=p.x;q('[name="z"]').value=p.z;dirty=true;
  previewPoint();say('راجع الموضع ثم احفظ نقطة الأرضية.');
 }
 function points(r){const list=r.sitePoints||[],p=list.find(p=>p.id===point);return '<div data-point-diagram>'+liveSketch(r)+'</div>'+select('choosePoint','نقطة الأرضية',{'':'+ نقطة جديدة',...Object.fromEntries(list.map((p,i)=>[p.id,fmt(i+1)+' · '+pointTypes[p.kind]+' · '+fmt(mm(p.x))+' / '+fmt(mm(p.z))]))},p?.id||'')+'<form data-survey-form="points">'+select('pointKind','النوع',pointTypes,p?.kind||newFloor)+measurement+'<div class="pr-fields">'+numeric('x','من يسار المسقط',p?.x??r.width/2)+numeric('z','من خلف المسقط',p?.z??r.length/2)+numeric('size','عرض / قطر الغطاء',p?.size??15,10,1000)+((p?.kind||newFloor)==='floor-water'?'':numeric('accessMargin','فراغ خدمة إضافي حول الغطاء',p?.accessMargin??0,0,1500))+'</div>'+submit(p?'حفظ النقطة':'إضافة النقطة',p?'إزالة النقطة':null)+'</form>';}
 function presets(){return '<div class="survey-preset-list">'+localRoomPresets.map(p=>{const d=makeSaudiRoom(p.id);return '<article data-sample="'+p.id+'">'+surveySketch(d.room,d)+'<div><strong>'+p.name+'</strong><b dir="ltr">'+p.dims+'</b><small>'+p.note+'</small><a target="_blank" rel="noopener noreferrer" href="'+p.source+'">مرجع المقاس ↗</a></div>'+action('preset-'+p.id,'بدء الرفع بهذا المسقط')+'</article>';}).join('')+'</div><small class="pr-note">يستبدل المسقط المختار محتوى المشروع الحالي. راجع مواضع عناصره المقترحة عند رفع الجدران. يمكن التراجع.</small>';}
 function bindSketch(){const form=q('[data-survey-form="shape"]');if(!form)return;const r=fromShape(form);if(!validateKitchenRoomArchitecture(r).ok)return;const applyDraft=(w,d)=>{const wide=form.elements.namedItem('cutwidth'),deep=form.elements.namedItem('cutdepth');if(wide)wide.value=String(mm(w));if(deep)deep.value=String(mm(d));};handles=wireSurveySketch(q('[data-shape-preview]'),{room:r,onDraft:applyDraft,onFinish:(w,d)=>{applyDraft(w,d);dirty=true;live(form);}});}
 function draw(){planInput.cancel();pending=null;dirty=false;handles?.destroy();handles=null;const d=getDoc();inner.innerHTML=tabs()+(tab==='shape'?shape(d.room):tab==='features'?features(d):tab==='points'?points(d.room):presets());if(tab==='shape')bindSketch();}
 function live(form){handles?.destroy();handles=null;const r=fromShape(form),result=validateKitchenRoomArchitecture(r);if(!result.ok){q('[data-shape-preview]').textContent=result.reason;return;}q('[data-shape-preview]').innerHTML=liveSketch(r);bindSketch();}
 box.addEventListener('change',e=>{const t=e.target;
 if(t.name==='wall'&&q('[data-wall-diagram]'))q('[data-wall-diagram]').innerHTML=liveSketch(getDoc().room,t.value);
 if(t.name==='kind'){q('[data-shape-detail]').innerHTML=cutFields(t.value,getDoc().room.architecture?.cut);live(t.form);}
 if(t.name==='choosePoint'||t.name==='chooseFeature'){
  const isPoint=t.name==='choosePoint',next=t.value;
  if(dirty)t.value=isPoint?point:feature;
  guardSelection(()=>{if(isPoint)point=next;else feature=next;say('');draw();});
 }if(t.name==='newFeatureKind'){newKind=t.value;say('');draw();}
 });
 box.addEventListener('input',e=>{const form=e.target.form;if(form?.dataset.surveyForm)dirty=true;if(form?.dataset.surveyForm==='points')previewPoint();if(form?.dataset.surveyForm==='shape'&&e.target.name!=='kind')live(form);});
 function schedule(){const d=getDoc(),r=d.room,a=roomArchitecture(r),rows=[['رفع الموقع','المرجع','البدء مم','العرض/الطول مم','الارتفاع مم','عن الأرض مم','العمق/البروز مم','المجاور','نوع الحركة أو الزجاج'],['المسقط',shapes[r.architecture?.cut?.kind||'rectangle'],'',mm(r.width),mm(r.height),'',mm(r.length)],['سماكة الجدار','','',mm(a.wallThickness)],...a.walls.map(w=>[w.label,'من ('+mm(w.a.x)+'؛ '+mm(w.a.z)+') إلى ('+mm(w.b.x)+'؛ '+mm(w.b.z)+')','',mm(w.length)]),...d.kitchen.features.map(f=>{const w=architectureWall(r,f.wall);return [types[f.kind].label,w?.label,mm(f.u-(w?.start||0)),mm(f.width),mm(f.height),mm(f.bottom),mm(f.depth),adj[f.adjacent]||'',({in:'داخل',out:'خارج',sliding:'سحّاب',clear:'شفاف',frosted:'مصنفر'})[f.swing||f.glazing]||''];}),['نقاط الأرضية','الموضع من يسار وخلف المسقط','س مم','ص مم','مقاس الغطاء مم'],...(r.sitePoints||[]).map(p=>[pointTypes[p.kind],p.id,mm(p.x),mm(p.z),mm(p.size)])];const stamp=outputStamp(d,'المطبخ كاملًا','رفع الموقع'),tagged=stampColumns(stamp,rows[0],rows.slice(1));const csv='\uFEFF'+[tagged.headers,...tagged.rows].map(row=>row.map(col=>'"'+String(col??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),aEl=document.createElement('a');aEl.href=url;aEl.download='kitchen-site-survey-mm-'+stamp.revision+'.csv';aEl.click();setTimeout(()=>URL.revokeObjectURL(url),15000);say('جُهّز رفع الموقع بالمليمتر.');}
 function finished(d,msg){const r=apply(d,msg);if(!r?.ok||r.saved===false){say(r?.reason||'تعذّر تطبيق التعديل.');return false;}draw();say(msg);return true;}
 box.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const a=t.dataset.surveyAct;
 if(a==='keep-draft'){pending=null;say('');return;}
 if(a==='leave-draft'){const go=pending;pending=null;dirty=false;say('');go?.();return;}
 if(t.dataset.surveyTab){if(t.dataset.surveyTab===tab)return;guardSelection(()=>{tab=t.dataset.surveyTab;draw();say('');});}else if(a==='close')guardSelection(()=>close(true));else if(a==='correct-reading'){const f=getDoc().kitchen.features.find(v=>v.id===feature);if(f){close(false);onSurveyReading?.(f.wall,f.id);}}else if(a==='schedule')schedule();else if(a==='finishes'){close(false);onFinishes?.();}else if(a?.startsWith('preset-')){const n=makeSaudiRoom(a.slice(7));if(finished({...n,room:newProjectDefaultRoom(n.room)},'فُتح مسقط الغرفة لرفع الجدران.')){close(!onStartWall);onStartWall?.(roomArchitecture(n.room).walls[0].id);}}else if(a==='remove'){const d=getDoc(),linked=d.kitchen.features.find(v=>v.id===feature);if(tab==='features'&&linkedReadingIndex(d.room,linked)>=0){close(false);onSurveyReading?.(linked.wall,linked.id);return;}if(tab==='points'){const keep=point;point='';if(!finished({...d,room:{...d.room,sitePoints:d.room.sitePoints.filter(v=>v.id!==keep)}},'أُزيلت نقطة الأرضية.'))point=keep;}else{const out=removeKitchenItem(d.kitchen,feature,d.room);if(out.ok){const old=feature;feature='';if(!finished({...d,kitchen:out.kitchen},'أُزيل العنصر.'))feature=old;}else say(out.reason);}}});
 box.addEventListener('submit',e=>{e.preventDefault();const f=e.target,mode=f.dataset.surveyForm,d=getDoc(),v=k=>f.elements.namedItem(k)?.value,n=k=>Number(v(k))/10;
 if(mode==='shape'){const room=fromShape(f),valid=validateKitchenRoomArchitecture(room);if(!valid.ok)return say(valid.reason);return finished({...d,room:valid.room},'حُفظ مسقط الغرفة.');}
 if(mode==='points'){const id=point||('site-'+(globalThis.crypto?.randomUUID?.().slice(0,8)||Math.random().toString(36).slice(2,12))),pt={id,kind:v('pointKind'),x:n('x'),z:n('z'),size:n('size'),...(v('pointKind')!=='floor-water'&&e.target.elements.namedItem('accessMargin')?{accessMargin:n('accessMargin')}:{})},old=d.room.sitePoints||[],room={...d.room,sitePoints:point?old.map(i=>i.id===point?pt:i):[...old,pt]};const check=checkSitePoints(room);if(!check.ok)return say(check.reason);const was=point;point=id;if(!finished({...d,room},'حُفظت نقطة الأرضية.'))point=was;return;}
 const current=d.kitchen.features.find(i=>i.id===feature),kind=current?.kind||newKind,w=architectureWall(d.room,v('wall'));const patch=featureFromDimensionsMm(d.room,{...current,kind,wall:w.id,depth:current?.depth??types[kind].depth},{u:Number(v('offset')),width:Number(v('width')),bottom:Number(v('bottom')),height:Number(v('height')),depth:v('depth')==null?null:Number(v('depth'))});for(const k of ['glazing','hinge','swing','adjacent'])if(f.elements.namedItem(k))patch[k]=v(k)||undefined;
 let source=d;
 if(current&&linkedReadingIndex(d.room,current)>=0&&['wall','u','width','height','bottom','depth','hinge','swing'].some(k=>patch[k]!==current[k])){
   const corrected=correctCadSurveyFeature(d,current,patch);
   if(!corrected.ok)return say(corrected.reason);
   source=corrected.doc;
 }
 const out=current?updateFeature(source.kitchen,source.room,current.id,patch):addFeature(source.kitchen,source.room,patch);if(!out.ok)return say(out.reason);const old=feature;feature=out.id;if(!finished({...source,kitchen:out.kitchen},'حُفظ العنصر في موضعه.'))feature=old;});
 box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(pending){pending=null;say('');}else guardSelection(()=>close(true));}});return {close,open,active:()=>!box.hidden,refresh:()=>{if(!box.hidden)draw();}};
}
