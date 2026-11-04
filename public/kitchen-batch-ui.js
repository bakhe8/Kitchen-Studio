const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(x);
const label={drawers:'أدراج',sink:'مجلى',storage:'تخزين',dishwasher:'فتحة غسالة',tall:'دولاب طويل',fridge:'ثلاجة'};
export function batchControls(doc,selection,batches,whole,proposal,owner){
 const issued=new Set(batches.flatMap(b=>{try{return JSON.parse(b.unit_ids);}catch{return [];}}));
 const units=doc.kitchen.units.map(u=>'<label><input type="checkbox" data-batch-unit="'+esc(u.id)+'" '+(selection.has(u.id)?'checked ':'')+(issued.has(u.id)||whole?'disabled':'')+'> '+esc(label[u.kind]||u.kind)+' · '+esc(u.id)+' · '+num(u.width*10)+' مم'+(issued.has(u.id)||whole?' · سبق الإصدار':'')+'</label>');
 return '<details class="ws-card" open><summary><b>دفعة قطع لوحدات مختارة</b></summary><p>بعد موافقة العميل على العرض يمكن إطلاق وحدات جاهزة وتأجيل البقية. قيمة الخامات المحسوبة لهذه الدفعة مستقلة عن إجمالي البيع والتركيب.</p>'+
 '<button data-sync="batches">تحديث إيصالات الدفعات</button>'+batches.map(b=>'<p>الإصدار '+num(b.revision)+' · '+esc(JSON.parse(b.unit_ids).join('، '))+' · '+num(b.material_minor/100)+' ر.س للخامات</p>').join('')+
 (owner?units.join('')+'<button data-sync="batch-preview">فحص الوحدات المحددة</button>':'')+
 (proposal?'<p>'+esc(proposal.issues.length?proposal.issues.join(' '):'الوحدات جاهزة. قيمة خام الدفعة '+num(proposal.quote.materialValue)+' ر.س.')+'</p>'+
 (!proposal.issues.length?'<button data-sync="batch-issue">إيداع دفعة لهذه الوحدات</button>':''):'')+'</details>';
}
