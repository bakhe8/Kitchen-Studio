import {riceFit} from './kitchen-production-row-rice.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(value,label,current)=>'<option value="'+value+'"'+(value===current?' selected':'')+'>'+label+'</option>';
export function riceForm(unit,e,autoCount=0,request=null){
 if(!['bags','bin','owned','dispenser'].includes(unit.riceMode))return '<p>لتدقيق حجم درج الأرز وحمولته، اختر الأكياس أو الحاوية في أعلى الصف ثم طبّق الاختيار.</p>';
 const key=unit.riceMode==='bags'?'الكيس المعبّأ':'الحاوية';
 const field=(k,label,v,min=.001)=>'<label>'+label+'<input type="number" name="'+k+'" required min="'+min+'" step="any" value="'+esc(v??'')+'"></label>';
 const txt=(k,l)=>'<label>'+l+'<input name="'+k+'" maxlength="160" required value="'+esc(e?.[k]||'')+'"></label>';
 const xyz=(k,l)=>'<strong>'+l+' · مم</strong><div class="ws-inline">'+[['w','عرض'],['d','عمق'],['h','ارتفاع']].map(([a,b])=>field(k+a,b,e?.[k]?.[a])).join('')+'</div>';
 const match=request?.confirmed&&request.choice!=='none'&&request.mode===unit.riceMode;
 const amount=match&&request.amountKg!=null?request.amountKg:e?.amountKg,pack=match&&request.packageKg!=null?request.packageKg:e?.packageKg;
 const summary=e?riceFit(e):null;
 return '<details><summary>فحص سعة درج الأرز والسكة</summary><form data-pwr-rice="'+esc(unit.id)+'">'+
  '<p class="ws-subtle">يعتمد الحساب على أبعاد '+key+'، وتقاس مساحة درج واحد بعد تركيب السكة والواجهات.</p><div class="ws-inline">'+
  (match?'<p>القيم المؤكدة من مقابلة العميل · '+esc(request.id)+(e&&(amount!==e.amountKg||pack!==e.packageKg)?' · تغيّر الطلب بعد الفحص. راجع القيم الجديدة واحفظ الفحص.':'')+'</p>':'')+field('amountKg','مطلوب العميل · كجم',amount)+field('packageKg','كمية الأرز داخل '+key+' · كجم',pack)+'</div>'+
  xyz('pack','أبعاد '+key)+xyz('inside','الحيّز الداخلي الصافي بعد التركيب')+
  '<label>طريقة الرص<select name="layers">'+opt('one','طبقة واحدة',e?.layers)+opt('stack','يسمح بالتكديس رأسياً',e?.layers)+'</select></label><div class="ws-inline">'+
  (autoCount?'<label>أي درج يحمل كامل هذا الأرز؟<select name="drawerIndex" required><option value="">اختر رقم الدرج</option>'+Array.from({length:autoCount},(_,i)=>opt(i+1,i+1,e?.drawerIndex)).join('')+'</select></label>':txt('sku','رمز السكة المستخدم في وصفة المصنع')+txt('manual','دليل موديل السكة ومرجع الحمولة'))+txt('source','مصدر مقاسات الدرج والعبوة')+'</div>'+
  (autoCount?'':('<label>أساس الحمولة في دليل السكة<select name="ratingBasis" required><option value="">اختر من الدليل</option>'+opt('moving','شامل وزن الدرج المتحرك',e?.ratingBasis)+opt('payload','حمولة المحتويات فقط',e?.ratingBasis)+'</select></label>'+
  '<div class="ws-inline">'+field('loadKg','حمولة السكة المسموحة · كجم',e?.loadKg)+field('drawerKg','وزن الدرج المتحرك فارغًا · كجم',e?.drawerKg,0)+'</div>'))+'<div>'+field('packagingKg','وزن الحاويات أو الأغلفة الفارغة معًا · كجم',e?.packagingKg,0)+'</div>'+
  (summary?'<p>للكمية المطلوبة '+summary.packages+' عبوة. يتسع الترتيب المحسوب لـ '+summary.capacity+'، '+(autoCount?'ويضاف إلى وزن درج الأرز '+summary.totalKg+' كجم.':'وتبلغ حمولة المقارنة '+summary.totalKg+' كجم.')+'</p>':'')+
  '<button type="submit">حساب السعة والحمولة</button></form></details>';
}
export function readRiceForm(form){
 const f=new FormData(form),result={};
 for(const k of ['amountKg','packageKg','drawerKg','packagingKg','loadKg'])result[k]=Number(f.get(k));
 for(const k of ['layers','ratingBasis','sku','source','manual'])result[k]=String(f.get(k)||'').trim();
 for(const group of ['pack','inside'])result[group]=Object.fromEntries(['w','d','h'].map(k=>[k,Number(f.get(group+k))]));
 if(f.has('drawerIndex'))result.drawerIndex=Number(f.get('drawerIndex'));return result;
}
