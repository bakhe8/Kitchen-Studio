import {surveyedDesignRange} from './kitchen-chain-model.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {cornerBuildForm,readCornerBuild,cornerBuildPreview} from './kitchen-corner-carcass-ui.js';
import {cornerBodyForm,readCornerBody} from './kitchen-corner-body-ui.js';
import {cornerSolids} from './kitchen-corner-solid.js';
import {connectedWallCorners,cornerMotionIssues} from './kitchen-production-row-corners.js';
import {applyWorkshopCorner} from './kitchen-production-row.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices=(items,k)=>items.map(([v,l])=>'<option value="'+esc(v)+'"'+(v===k?' selected':'')+'>'+esc(l)+'</option>').join('');
const level=(tier,title,j,c,defaultOn,catalog)=>'<fieldset class="dp-corner-level"><legend><label><input type="checkbox" name="'+tier+'On" '+(c||defaultOn?'checked':'')+'> '+title+'</label></legend><div class="dp-corner-body">'+
'<div class="ws-inline">'+[['a',j.a],['b',j.b]].map(([x,w])=>'<label>امتداد '+esc(w.label)+' · مم<input type="number" min="100" max="3000" name="'+tier+x+'Mm" value="'+(c?.[x+'Mm']??900)+'"></label>').join('')+'</div>'+
 '<div class="dp-corner-bars" aria-label="نسبة امتداد الركن على الجدارين">'+[['a',j.a],['b',j.b]].map(([key,w])=>'<div data-corner-span="'+tier+key+'Mm"><span>'+esc(w.label)+'</span><b><i></i></b><output></output></div>').join('')+'</div>'+
'<label>الوصول إلى الزاوية<select name="'+tier+'access">'+choices([['a',j.a.label],['b',j.b.label],['both','من الجهتين']],c?.access||'a')+'</select></label>'+
'<label>ما بداخلها؟<select name="'+tier+'inside">'+choices([['shelves','رفوف ثابتة'],['empty','حيّز فارغ'],['carousel','سلة دوّارة'],['pullout','سحّاب ركني'],['custom','تفصيل خاص']],c?.inside||'shelves')+'</select></label>'+
'<label>مرجع الإكسسوار أو وصف التفصيل<input name="'+tier+'sku" maxlength="90" value="'+esc(c?.sku||'')+'"></label>'+cornerBodyForm(tier,c?.body)+cornerBuildForm(tier,c,catalog,j)+'</div></fieldset>';
export function mountCornerUI(host,{getDoc,apply,tell,refresh,onAdvance,focus={}}){
 const controller=new AbortController(),signal=controller.signal;
 const joints=connectedWallCorners(getDoc().room);let id=joints.find(j=>j.id===focus.joint)?.id||joints.find(j=>getDoc().room.workshop?.corners?.[j.id])?.id||joints[0]?.id;
 function updateSpans(fieldset){
  const spans=[...fieldset.querySelectorAll('[data-corner-span]')].map(line=>{
   const input=fieldset.querySelector('[name="'+line.dataset.cornerSpan+'"]');
   return {line,value:input?.valueAsNumber};
  });
  const max=Math.max(1,...spans.map(({value})=>Number.isFinite(value)?value:0));
  for(const {line,value} of spans){
   const measured=Number.isFinite(value)&&value>=100&&value<=3000;
   line.querySelector('i').style.inlineSize=(measured?100*value/max:0)+'%';
   line.querySelector('output').textContent=measured?new Intl.NumberFormat('ar-SA').format(value)+' مم':'أدخل الامتداد';
  }
 }
 function draw(){
  const j=joints.find(q=>q.id===id);if(!j){host.textContent='لم يتعرّف الرسم على جدارين متصلين.';return;}
  const c=getDoc().room.workshop?.corners?.[id],saved=c?cornerSolids(getDoc().room,{[id]:c}):[];
  const location='<label class="dp-joint-picker">نقطة التقاء الجدارين<select data-corner-joint>'+choices(joints.map(j=>[j.id,j.a.label+' × '+j.b.label+(getDoc().room.workshop?.corners?.[j.id]?' · محجوزة':'')]),id)+'</select></label>';
  const missing=!c&&[j.a,j.b].find(w=>!surveyedDesignRange(getDoc(),w.id));
  if(missing){
   host.innerHTML=location+'<p>يتطلب تفصيل هذه الزاوية رفع امتداد الدواليب على الجدارين المتصلين.</p>'+
    (onAdvance?'<button type="button" data-corner-survey="'+esc(missing.id)+'">رفع '+esc(missing.label)+'</button>':'');return;
  }
  host.innerHTML=location+'<form class="dp-corner-form"><label><input type="checkbox" name="tall" '+(c?.tall?'checked':'')+'> زاوية واحدة بكامل الارتفاع</label>'+
  level('base','زاوية سفلية',j,c?.base,!c,readWorkshopCatalog(getDoc().room.workshop))+level('upper','زاوية علوية مستقلة',j,c?.upper,false,readWorkshopCatalog(getDoc().room.workshop))+
  saved.map(cornerBuildPreview).join('')+(c?cornerMotionIssues(getDoc(),{unitIds:['corner:'+id+':'+(c.tall?'tall':'base'),'corner:'+id+':upper']}).map(msg=>'<p>'+esc(msg)+'</p>').join(''):'')+
  '<p class="ws-subtle">يُحجز امتداد الركن على الصفين المتصلين. تُعرض مواصفات الفتح والتخزين للورشة، ويُستكمل تسعير الزاوية بعد مطابقة وصفة المصنع.</p>'+
  '<button type="submit">حفظ الزاوية وإعادة حساب الصفوف</button> '+(c?'<button type="button" data-corner-delete>إلغاء الزاوية</button>':'')+'</form>';
  const fieldsets=host.querySelectorAll('fieldset');fieldsets[1].hidden=!!c?.tall;for(const fs of fieldsets){updateSpans(fs);const active=fs.querySelector('input[type=checkbox]').checked;for(const el of fs.querySelectorAll('input:not([type=checkbox]),select'))el.disabled=!active;}
 }
 function commit(c){
  const doc=getDoc(),j=joints.find(q=>q.id===id);
  if(c&&!doc.room.workshop?.corners?.[id]&&[j.a,j.b].some(w=>!surveyedDesignRange(doc,w.id))){draw();return;}
  const r=applyWorkshopCorner(doc,id,c);if(!r.ok){tell(r.reason);return;}
  const v=apply(r.doc,'حُدّث الركن المشترك وصفوفه.');if(v?.ok===false){tell(v.reason);return;}refresh();
 }
 host.addEventListener('input',e=>{
  if(/^(base|upper)[ab]Mm$/.test(e.target.name))updateSpans(e.target.closest('.dp-corner-level'));
 },{signal});
 host.addEventListener('change',e=>{
  if(e.target.matches('[data-corner-joint]')){id=e.target.value;draw();}
  if(e.target.matches('[data-select-corner-recipe]')){
   e.target.closest('.ws-card').querySelector('[data-corner-build-fields]').hidden=!e.target.value;
   if(e.target.value){const fs=e.target.closest('fieldset'),input=fs?.querySelector('input[name$="Body"]');if(input){input.checked=true;input.closest('details').open=true;}}
  }
  if(e.target.name==='tall'){const fs=host.querySelectorAll('fieldset');fs[1].hidden=e.target.checked;if(e.target.checked){const toggle=fs[0].querySelector('input[type=checkbox]');toggle.checked=true;for(const el of fs[0].querySelectorAll('[disabled]'))el.disabled=false;}}
  if(e.target.name.endsWith('On'))for(const el of e.target.closest('fieldset').querySelectorAll('input:not([type=checkbox]),select'))el.disabled=!e.target.checked;
 },{signal});
 host.addEventListener('click',e=>{const wall=e.target.closest('[data-corner-survey]')?.dataset.cornerSurvey;if(wall){onAdvance?.('survey',{wall});return;}if(e.target.closest('[data-corner-delete]'))commit(null);},{signal});
 host.addEventListener('submit',e=>{
  e.preventDefault();e.stopPropagation();const f=new FormData(e.target),j=joints.find(q=>q.id===id);
  const c={a:j.a.id,b:j.b.id,tall:f.has('tall')};
  for(const tier of ['base','upper'])if(f.has(tier+'On')&&!(c.tall&&tier==='upper')){const build=readCornerBuild(f,tier),body=readCornerBody(f,tier);if(build===null||build&&!body){tell('أكمل أبعاد جسم الركن ومنسوب كل رف فعلي بالملليمتر.');return;}if(build){const rec=readWorkshopCatalog(getDoc().room.workshop)?.cornerRecipes?.[build.recipe];if(rec?.tier!==(c.tall?'tall':tier)){tell('اختر وصفة مصنع مطابقة لمستوى الركن.');return;}}if(body===null){tell('أكمل الأبعاد الرقمية ومراجع جسم الركن وحركته.');return;}c[tier]={...(build?{build}:{}),...(body?{body}:{}),aMm:Number(f.get(tier+'aMm')),bMm:Number(f.get(tier+'bMm')),access:f.get(tier+'access'),inside:f.get(tier+'inside'),sku:String(f.get(tier+'sku')||'').trim()};}
  if(c.tall)c.upper=c.base?{...c.base}:null;
  if(!c.base&&!c.upper){tell('اختر مستوى الزاوية أو استخدم إلغاء الزاوية.');return;}
  commit(c);
 },{signal});
 draw();
 if(['base','upper','tall'].includes(focus.tier)&&id===focus.joint){
  const field=host.querySelector('[name="'+(focus.tier==='tall'?'tall':focus.tier+'On')+'"]');
  field?.focus({preventScroll:true});field?.scrollIntoView?.({block:'nearest'});}
 return ()=>controller.abort();
}
