import {cornerBuilds,cornerRoles,cornerLimits,cleanCornerBuild} from './kitchen-corner-carcass.js';
import {assistNumber} from './kitchen-measurement-identity.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(k,label,selected)=>'<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(label)+'</option>';
const tiers={base:'السفلي',upper:'العلوي',tall:'بكامل الارتفاع'};
export function cornerBuildForm(tier,q,catalog,j){
 const build=q?.build,recipes=Object.entries(catalog?.cornerRecipes||{});
 const list=recipes.filter(([,r])=>tier==='base'?r.tier!=='upper':r.tier==='upper');
 const pick=option('','ورقة تفصيل خاصة بالمشروع',build?.recipe)+list.map(([id,r])=>option(id,r.label+' · '+tiers[r.tier],build?.recipe)).join('')+
  (build&&!list.some(([id])=>id===build.recipe)?option(build.recipe,'وصفة سابقة غير متاحة · '+build.recipe,build.recipe):'');
 const arms=['a','b'].map(side=>'<div class="ws-card"><b>ضلع '+esc(j[side].label)+'</b><label>ما سيخزّنه العميل<input name="'+tier+'Use'+side+'" maxlength="100" value="'+esc(build?.arms[side].use)+'"></label><label>مناسيب أسفل الرفوف من أسفل جسم الركن (مم)<input dir="ltr" name="'+tier+'Shelves'+side+'" placeholder="250 / 520" value="'+esc(build?.arms[side].shelves.join(' / '))+'"></label></div>').join('');
 return '<div class="ws-card"><b>تركيب الركن الداخلي</b><label>وصفة الورشة<select name="'+tier+'Recipe" data-select-corner-recipe>'+pick+'</select></label>'+
   '<div data-corner-build-fields '+(build?'':'hidden')+'><label>الجسم<select name="'+tier+'Mode">'+Object.entries(cornerBuilds).map(([k,l])=>option(k,l,build?.mode)).join('')+'</select></label><label>الضلع المستمر حتى ركن الجدارين<select name="'+tier+'Through">'+['a','b'].map(k=>option(k,j[k].label,build?.through)).join('')+'</select></label>'+
   '<p>جهة الدخول تُختار من «الوصول إلى الزاوية». تحسب الوصفة الدرف والأوجه الثابتة كلًا على حدة. أدخل مناسيب الرفوف التي طلبها العميل واترك الخانة فارغة للحيّز المفتوح.</p>'+arms+'</div>'+
   (list.length?'':'<p>يضيف المصنع وصفاته من كتالوج المصنع ← وصفات الركن.</p>')+'</div>';
}
export function readCornerBuild(form,tier){
 const recipe=form.get(tier+'Recipe');if(!recipe)return undefined;
 const arms={};for(const side of ['a','b']){
  const raw=String(form.get(tier+'Shelves'+side)||'').trim();
  arms[side]={use:String(form.get(tier+'Use'+side)||'').trim(),shelves:raw?raw.split(/[\/،,;؛\s]+/).map(v=>assistNumber(v)):[]};
 }
 return cleanCornerBuild({recipe,mode:form.get(tier+'Mode'),through:form.get(tier+'Through'),arms});
}
export function mountCornerRecipes(host,{catalog,save,refresh,notice}){
 let selected=Object.keys(catalog.cornerRecipes||{})[0]||'';
 function draw(){
  const recipe=catalog.cornerRecipes?.[selected]||{};
  const skuField=([k,l])=>{
   const kind=['bodySku','shelfSku','frontSku'].includes(k)?'panel':k==='edgeSku'?'bar':'piece';
   return '<label>'+l+'<select name="'+k+'" required>'+option('','اختر الصنف',recipe[k])+catalog.items.filter(i=>i.kind===kind&&(k!=='frontSku'||i.role==='front')).map(i=>option(i.sku,i.name+' · '+i.sku,recipe[k])).join('')+'</select></label>';
  };
  host.innerHTML='<h3>وصفة ركن قائم من ألواح متصلة</h3><p>تُقص أسطح كل ضلع كقطع مستطيلة بوصلات تناكبية حسب الرسم الذي يعتمده المصنع. الجسم المشترك مفتوح بين الضلعين. للصندوقين ظهران منفصلان عند الوصلة وجانبان فاصلان. تحدد هذه الوصفة الألواح والحواف وعتاد الدرفة ذات المفصلة الخارجية والأطقم الكاملة التي تُصرف من المخزون.</p><label>الوصفة<select data-corner-pick>'+option('','وصفة جديدة',selected)+Object.entries(catalog.cornerRecipes||{}).map(([k,r])=>option(k,r.label,selected)).join('')+'</select></label>'+
   '<form data-corner-factory><div class="kw-grid"><label>رمز الوصفة<input required name="id" dir="ltr" maxlength="48" value="'+esc(selected)+'" '+(selected?'readonly':'')+'></label><label>اسم الوصفة<input required name="label" maxlength="85" value="'+esc(recipe.label)+'"></label><label>المستوى المقصود<select name="tier">'+Object.entries(tiers).map(([k,l])=>option(k,l,recipe.tier)).join('')+'</select></label><label>مرجع رسم التجميع وعتاد الوصل والخلوص<input required name="reference" maxlength="160" value="'+esc(recipe.reference)+'"></label>'+Object.entries(cornerRoles).map(skuField).join('')+'<div><b>ألواح واجهة بديلة معتمدة بعد تثبيت التصميم</b><p>اختر بدائل من نفس السماكة لئلا تتغير خلوصات الدرف.</p>'+catalog.items.filter(i=>i.role==='front'&&i.kind==='panel').map(i=>'<label><input type="checkbox" name="faceAlt" value="'+esc(i.sku)+'" '+(recipe.frontSkus?.includes(i.sku)?'checked':'')+'>'+esc(i.name)+'</label>').join('')+'</div>'+
   Object.entries(cornerLimits).map(([k,l])=>'<label>'+l+(k==='hingesPerDoor'?'':' (مم)')+'<input required type="number" name="'+k+'" min="0" step="'+(k==='hingesPerDoor'?'1':'any')+'" value="'+esc(recipe[k])+'"></label>').join('')+'</div><button>حفظ وصفة الركن</button></form>';
 }
 host.addEventListener('change',e=>{if(e.target.hasAttribute('data-corner-pick')){selected=e.target.value;draw();}});
 host.addEventListener('submit',e=>{
  const form=e.target.closest('[data-corner-factory]');if(!form)return;e.preventDefault();e.stopPropagation();
  const data=new FormData(form),d=Object.fromEntries(data),key=d.id;delete d.id;delete d.faceAlt;const alternatives=data.getAll('faceAlt').filter(k=>k!==d.frontSku);if(alternatives.length)d.frontSkus=alternatives;
  if(!selected&&Object.hasOwn(catalog.cornerRecipes||{},key)){notice('رمز الوصفة مستخدم. اختر الوصفة الحالية لتعديلها.');return;}
  for(const k of Object.keys(cornerLimits))d[k]=assistNumber(d[k]);
  if(save(c=>{c.cornerRecipes={...c.cornerRecipes,[key]:d};}))refresh();
 });
 draw();
}
// A front elevation of each wing shows the customer's shelves behind its front.
// Higher Y means a higher position on the vertical assembly drawing.
export function cornerBuildPreview(solid){
 if(!solid?.build)return '';
 const {issues,doors,bodyCount,panels}=solid.build;
 if(issues.length||!panels.length)return '<p>'+esc(issues[0]||'أكمل قياس الركن.')+'</p>';
 const rows=['a','b'].map(side=>{
  const face=panels.find(p=>p.side===side&&['fixed','door'].includes(p.tag));if(!face)return '';
  const shelves=panels.filter(p=>p.side===side&&p.tag==='shelf');
  const h=Math.max(...panels.map(p=>p.y1)),width=doors.find(d=>d.side===side)?.w||Math.max(face.x1-face.x0,face.z1-face.z0),px=Math.max(45,Math.min(110,100*width/h));
  const svg='<svg role="img" aria-label="مناسيب الرفوف خلف الواجهة" width="'+(px+10)+'" height="112" viewBox="0 0 '+(px+10)+' 112"><rect x="5" y="5" width="'+px+'" height="100" fill="#faf5df" stroke="#807660"/>'+shelves.map(p=>'<path stroke="#475f55" stroke-width="2" d="M5 '+(105-100*p.y0/h)+'h'+px+'"/>').join('')+'</svg>';
  return '<div>'+svg+'<p>الضلع '+(side==='a'?'الأول':'الثاني')+' · '+(face.tag==='door'?'درفة':'وجه ثابت')+' · '+(shelves.length?'مناسيب الرفوف '+shelves.map(p=>p.y0).join('، ')+' مم':'دون رفوف')+'</p></div>';
 }).join('');
 return '<div class="ws-card"><b>'+esc(bodyCount===2?'مقطع تركيب صندوقين مستقلين':'مقطع الجسم الركني المشترك')+'</b><div class="ws-inline">'+rows+'</div></div>';
}
