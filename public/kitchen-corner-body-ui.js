import {cleanCornerBody} from './kitchen-corner-solid.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bodyFields={depthAMm:'عمق الضلع الأول عموديًا على جداره',depthBMm:'عمق الضلع الثاني عموديًا على جداره',bottomMm:'منسوب أسفل الجسم عن أرضية التشطيب',heightMm:'ارتفاع الجسم'};
const moveFields={offsetMm:'بداية التركيب من أول الواجهة المتاحة',floorMm:'ارتفاع أسفل الآلية عن أسفل الجسم',widthMm:'عرض الآلية المغلقة',depthMm:'عمقها المغلق',heightMm:'ارتفاع غلاف الآلية',clearWidthMm:'عرض فتحة الواجهة الصافي المقاس',clearHeightMm:'ارتفاع الفتحة الصافي المقاس',openingWidthMm:'أقل عرض فتحة في دليل المورد',openingHeightMm:'أقل ارتفاع فتحة في الدليل',sweepMm:'أقصى بروز متحرك أمام الواجهة',sweepWidthMm:'عرض غلاف الحركة الكامل'};
const fields=(prefix,defs,source)=>'<div class="ws-inline">'+Object.entries(defs).map(([key,label])=>'<label>'+label+' · مم<input type="number" min="0" max="6000" step="any" name="'+prefix+key+'" value="'+esc(source?.[key])+'"></label>').join('')+'</div>';
const ref=(prefix,source,label)=>'<label>'+label+'<input name="'+prefix+'reference" maxlength="180" value="'+esc(source?.reference)+'"></label>';
export function cornerBodyForm(tier,body){
 const p=tier+'Body',m=tier+'Move';
 return '<details><summary>أبعاد جسم الركن وفتحة الإكسسوار وحركته</summary><label><input type="checkbox" name="'+p+'" '+(body?'checked':'')+'> تسجيل جسم الزاوية بالملمتر</label>'+fields(p,bodyFields,body)+ref(p,body,'مرجع رسم الجسم أو الرفع')+
 '<label><input type="checkbox" name="'+m+'" '+(body?.motion?'checked':'')+'> تحديد غلاف حركة الآلية من دليل الصنف</label><label>واجهة خروج الآلية<select name="'+m+'side"><option value="a">الضلع الأول</option><option value="b" '+(body?.motion?.side==='b'?'selected':'')+'>الضلع الثاني</option></select></label>'+
 fields(m,moveFields,body?.motion)+ref(m,body?.motion,'صفحة الدليل أو مرجع الرسم الحركي')+'</details>';
}
export function readCornerBody(form,tier){
 const p=tier+'Body',m=tier+'Move';
 if(!form.has(p))return form.has(m)?null:undefined;
 const data=(prefix,defs)=>({...Object.fromEntries(Object.keys(defs).map(k=>{const v=form.get(prefix+k);return [k,v==null||v===''?null:Number(v)];})),reference:String(form.get(prefix+'reference')||'').trim()});
 const body=data(p,bodyFields);if(form.has(m))body.motion={...data(m,moveFields),side:form.get(m+'side')};
 return cleanCornerBody(body);
}
