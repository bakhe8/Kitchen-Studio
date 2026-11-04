import {cornerFrontTargets,setCornerFront} from './kitchen-corner-finishes.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCornerFinish(host,{doc,catalog,onApply,onPreview,canEdit=()=>true,targetId}){
 const targets=cornerFrontTargets(doc,catalog).filter(t=>!targetId||t.id===targetId);if(!targets.length){host.replaceChildren();return;}
 const option=(v,l,selected)=>'<option value="'+esc(v)+'" '+(selected?'selected':'')+'>'+esc(l)+'</option>';
 host.innerHTML='<article class="ws-card"><h3>واجهة الركن ولونها</h3><p>هذا الاختيار يطبّق على الدرف والأوجه الثابتة في المستوى المحدد. تبقى الجوانب والرفوف مرتبطة بوصفة تصنيع الجسم.</p>'+(targetId?'':'<label>الركن<select data-finish-corner>'+targets.map(t=>option(t.id,t.recipe.label+' · '+t.id)).join('')+'</select></label>')+'<label>ألواح الواجهة التي اعتمدها المصنع<select data-corner-face></select></label><button type="button" data-set-corner-face>تطبيق واجهة هذا الركن</button><p data-corner-note></p></article>';
 const target=host.querySelector('[data-finish-corner]'),face=host.querySelector('[data-corner-face]'),note=host.querySelector('[data-corner-note]');
 function draw(){const t=targets.find(t=>t.id===(targetId||target.value));face.innerHTML=t.allowed.filter(i=>i.available!==false).map(i=>option(i.sku,i.name+' · '+i.sku,i.sku===t.current)).join('');note.textContent='الصنف المحفوظ '+t.current+' · '+t.recipe.reference;host.querySelector('button').disabled=!face.options.length;}
 if(target)target.onchange=draw;
 if(onPreview)face.onchange=()=>{if(canEdit())onPreview(targetId||target.value,face.value);};
 host.querySelector('button').onclick=()=>{if(!canEdit())return;try{onApply(setCornerFront(doc,catalog,targetId||target.value,face.value));}catch(err){note.textContent=err.message;}};draw();
}
