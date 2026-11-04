import {familyCADKind,familyRecipeOptions,isCustomFamily} from './kitchen-factory-families.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(pairs,current)=>pairs.map(([key,label])=>'<option value="'+esc(key)+'" '+(key===current?'selected':'')+'>'+esc(label)+'</option>').join('');
const number=(k,label,value='',min=1,max=6000)=>'<label>'+label+'<input name="'+k+'" type="number" min="'+min+'" max="'+max+'" step="1" value="'+esc(value)+'"></label>';
const line=(key,label,value='')=>'<label>'+label+'<input name="'+key+'" maxlength="160" value="'+esc(value)+'"></label>';
export const rowDevices=new Set(['dishwasher','oven','oven-tower','fridge','freezer','hood','hob','microwave','laundry-bay']);
export const isDeviceRecipe=(f,base)=>rowDevices.has(familyCADKind(f,base));
function modelFields(m={}){
 return '<fieldset data-pr-model><legend>الحيّز الخارجي من دليل موديل الجهاز</legend>'+line('model','الموديل',m.model)+line('manual','مرجع دليل المقاسات',m.manual)+
 '<p>عرض الوحدة هو عرض حجز الجهاز. أدخل ارتفاع وعمق حيز التركيب بالمليمتر شامل سماحات الموديل. تُراجع الفتحة الفعلية والخدمات في أجهزة العميل.</p><div class="ws-inline">'+
 number('modelHeight','الارتفاع (مم)',m.heightMm,100,4000)+number('modelDepth','العمق (مم)',m.depthMm,100,1500)+'</div></fieldset>';
}
export function readRowModel(data,widthMm){
 const model=String(data.get('model')||'').trim(),manual=String(data.get('manual')||'').trim(),H=data.get('modelHeight'),D=data.get('modelDepth');
 if(!model&&!manual&&!H&&!D)return null;
 return {model,manual,widthMm,heightMm:Number(H),depthMm:Number(D)};
}
export function recipeChoices(catalog,upper){return Object.entries(catalog.families).filter(([key,f])=>upper?(f.base||key)==='upperStorage':(f.base||key)!=='upperStorage').map(([key,f])=>[key,f.label]);}
export function fillerControl(catalog,upper,current){
 const b=upper?'upperStorage':'storage';
 const choices=familyRecipeOptions(catalog,b).filter(([k])=>['storage','open-shelf'].includes(familyCADKind(catalog.families[k],b))&&!catalog.families[k].customerBay);
 if(choices.length<2)return '';
 return '<label>وصفة وحدات التخزين التي تملأ المساحات المتبقية<select name="fillerRecipeId">'+opts(choices,current||b)+'</select></label>';
}
export function variantAddition(catalog,upper){
 const choices=recipeChoices(catalog,upper).filter(([k])=>isCustomFamily(k));
 if(!choices.length)return '<p class="ws-subtle">تظهر وصفات المصنع الخاصة هنا بعد تعريفها من وصفات المشروع أو استيراد كتالوجه المنشور.</p>';
 return '<details class="ws-card"><summary>إضافة وحدة من وصفة المصنع</summary><form data-pwr-add><label>الوصفة المنشورة<select name="recipeId">'+opts(choices,'')+'</select></label>'+
 number('widthMm','العرض (مم)',catalog.families[choices[0][0]].minMm,200,2400)+line('use','استخدام العميل (اختياري)')+
 number('startMm','موضع مثبّت (مم من بداية الجدار). اتركه فارغًا للتوزيع الآلي.','',0,17000)+
 '<div data-pr-count>'+number('drawerCount','عدد واجهات الأدراج',3,1,8)+'</div>'+modelFields()+'<button type="submit">معاينة إضافة الوحدة وإعادة التعبئة</button></form></details>';
}
export const recipeModelFields=modelFields;
export function refreshRecipeForm(form,catalog){
 const key=form.elements.recipeId?.value??form.elements.family?.value,def=catalog.families[key];
 if(!def)return;
 const kind=familyCADKind(def,def.base||key);
 for(const [selector,visible] of [['[data-pr-count]',kind==='drawers'],['[data-pr-model]',rowDevices.has(kind)]]){
  const block=form.querySelector(selector);if(!block)continue;
  block.hidden=!visible;for(const input of block.querySelectorAll('input'))input.disabled=!visible;
 }
}
