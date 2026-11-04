const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(k,label,value,type='number')=>'<label>'+label+'<input required name="'+k+'" type="'+type+'" '+(type==='number'?'min="0" step="any"':'maxlength="180"')+' value="'+esc(value)+'"></label>';
const specs={minWidthMm:'أدنى عرض داخلي لتركيب الطقم · مم',maxWidthMm:'أقصى عرض داخلي · مم',minDepthMm:'أدنى عمق متاح للتثبيت · مم',maxDepthMm:'أقصى عمق مسموح · مم',minGapMm:'أدنى خلوص في كل جانب · مم',maxGapMm:'أقصى خلوص في كل جانب · مم',travelMm:'مشوار الطقم الكامل · مم',movingKg:'أقصى كتلة متحركة للزوج كاملًا، شاملة الدرج · كجم'};
const dims={clearWidthMm:'العرض الداخلي بين سطحي تثبيت السكك · مم',clearDepthMm:'العمق الصافي للتركيب · مم',leftGapMm:'الخلوص بين صندوق الدرج والجنب الأيسر · مم',rightGapMm:'الخلوص في الجانب الأيمن · مم',minTravelMm:'مشوار السحب المطلوب للاستخدام · مم',freeTravelMm:'أقصى بروز مقاس متاح أمام الدرج · مم',emptyKg:'وزن الصندوق المتحرك وواجهته فارغًا · كجم',contentsKg:'وزن المحتويات الإضافية دون الأرز المسجل في فحص التعبئة · كجم'};
export function runnerItemForm(item){
 if(item?.hardwareRole!=='runner')return '';
 return '<details><summary>مواصفة طقم السكتين من المورد</summary><form data-edit="runnerSpec"><p>وحدة الشراء زوج كامل. أدخل الحد الموثق للوزن المتحرك الكلي عند امتداد الطقم.</p><div class="kw-grid">'+Object.entries(specs).map(([k,l])=>field(k,l,item.runnerSpec?.[k])).join('')+field('reference','دليل الموديل وصفحة المقاسات والحمولة',item.runnerSpec?.reference,'text')+'</div><button>حفظ مواصفة الطقم</button></form></details>';
}
export function runnerFamilyForm(f,itemList){
 return '<details><summary>اختيار سكك كل درج حسب طلب العميل</summary><form data-edit="drawerRunners"><p>أدخل رموز الأطقم بالترتيب المفضّل في هذه الوصفة، طقم لكل سطر. يحل الاختيار الفردي محل بنود السكك الثابتة لهذه العائلة. إفراغ القائمة يعيد تنفيذ بنودها الثابتة.</p><p>أطقم لها مواصفات موثقة · '+itemList.filter(i=>i.runnerSpec).map(i=>esc(i.sku)).join('، ')+'</p><textarea dir="ltr" name="ranked">'+esc((f.drawerRunners||[]).join('\n'))+'</textarea><button>حفظ ترتيب الأطقم المعتمدة للوصفة</button></form></details>';
}
export const readRunnerSpec=form=>Object.fromEntries([...Object.keys(specs).map(k=>[k,form.get(k)?.trim()?Number(form.get(k)):NaN]),['reference',String(form.get('reference')||'')]]);
export const readDrawerMeasurements=form=>({...Object.fromEntries(Object.keys(dims).map(k=>[k,form.get(k)?.trim()?Number(form.get(k)):NaN])),reference:String(form.get('reference')||''),pin:String(form.get('pin')||'')});
export function drawerFitForms(entry,count,checks,runnerPlan,skus){
 if(!skus?.length&&!checks)return '';
 return '<details><summary>قياسات تركيب السكة وحمولة كل درج</summary>'+Array.from({length:count},(_,i)=>{
  const n=i+1,v=checks?.[n]||{},pick=runnerPlan?.rows.find(x=>x.drawerIndex===n);
  return '<details><summary>الدرج '+n+' · '+esc(entry.drawerUses?.[i]||entry.use||'تخزين')+'</summary><form data-pwr-drawer="'+esc(entry.id)+'" data-index="'+n+'"><div class="ws-inline">'+Object.entries(dims).map(([k,l])=>field(k,l,v[k])).join('')+field('reference','مرجع صافي التثبيت والأوزان',v.reference,'text')+'</div><label>تفضيل العميل<select name="pin"><option value="">اختيار آلي حسب ترتيب المصنع</option>'+[...new Set([...(skus||[]),...(v.pin?[v.pin]:[])])].map(s=>'<option value="'+esc(s)+'" '+(s===v.pin?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label><button>حساب طقم الدرج</button>'+(checks?.[n]?' <button type="button" data-remove-drawer="'+esc(entry.id)+'" data-index="'+n+'">إزالة فحص هذا الدرج</button>':'')+'</form>'+
   (pick?'<p>طقم '+esc(pick.sku)+' · وزن متحرك '+pick.movingKg+' كجم · مشوار '+pick.travelMm+' مم · '+esc(pick.runnerReference)+'</p>':'')+'</details>';
 }).join('')+(runnerPlan?.issues||[]).map(m=>'<p>'+esc(m)+'</p>').join('')+'</details>';
}
