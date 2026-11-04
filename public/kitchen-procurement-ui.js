const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(k,label,v='',type='text')=>'<label>'+label+'<input name="'+k+'" type="'+type+'" '+(type==='number'?'step="1" min="0" max="1000000"':'maxlength="120"')+' value="'+e(v)+'" required></label>';
export function mountProcurementPanel(host,{stock,selected,version,project,receipt,send,reload,reqId}){
 const view=stock.procurement,cur=stock.stocks.find(s=>s.key===selected);if(!view||!cur)return;
 let proposal=null,request=null,working=false;
 const policy=view.policies.find(x=>x.key===selected)?.policy||{},orders=view.orders.filter(o=>o.key===selected);
 const release=receipt?{project,revision:receipt.revision,scope:receipt.kind==='whole'?'whole':receipt.design_key}:null;
 const draw=()=>{
  host.innerHTML='<h3>توريد الصنف المختار</h3><p>'+e(cur.name)+'</p>'+
   (JSON.parse(selected)[7]===''?'<details><summary>سياسة التوريد لهذا المقاس واللون</summary><form data-pro="policy"><div class="kw-grid">'+field('supplier','المورّد',policy.supplier)+field('vendorSku','رقم الصنف عند المورّد',policy.vendorSku)+field('pack','وحدات الخام داخل العبوة',policy.pack,'number')+field('minimumPacks','أقل عدد عبوات لأمر الشراء',policy.minimumPacks,'number')+field('reorder','حد إعادة الطلب بعد الطلبات القائمة',policy.reorder,'number')+field('target','الرصيد المستهدف',policy.target,'number')+field('note','مرجع عرض المورد أو مراجعة السياسة')+'</div><button>حفظ السياسة</button></form></details>':'<p>البواقي لا تُطلب من المورد كخام كامل.</p>')+
  (release&&policy.supplier?'<form data-pro="propose"><p>يُحسب احتياج الصنف من إيصال التصنيع المحدد أعلاه.</p><button>احتساب اقتراح الشراء</button></form>':'')+
  (proposal?'<p>مطلوب في الإيصال '+e(proposal.demand)+' · فعلي '+e(proposal.physical)+' · محجوز '+e(proposal.held)+' · وارد مفتوح '+e(proposal.incoming)+' · مطلوب لأوامر أخرى '+e(proposal.committed)+' · صافي الرصيد بعد تلبية الاحتياج '+e(proposal.position)+'</p>'+
   (proposal.quantity?'<form data-pro="purchase"><p>'+e(policy.supplier)+' · '+e(policy.vendorSku)+' · '+e(proposal.quantity/policy.pack)+' عبوة = '+e(proposal.quantity)+' وحدة خام</p>'+field('note','رقم أمر الشراء')+'<button>إثبات بند أمر الشراء</button></form>':'<p>لا يحتاج هذا الصنف إلى أمر شراء إضافي.</p>'):'')+
   orders.map(o=>'<article><h4>'+e(o.reference)+' · '+e(o.supplier)+'</h4><p>طُلب '+e(o.ordered)+' · استُلم '+e(o.received)+' · متبقٍ '+e(o.open)+'</p>'+(o.open?'<form data-pro="delivery" data-order="'+e(o.id)+'">'+field('note','رقم سند التسليم الفعلي')+field('quantity','وحدات الخام المستلمة الآن','','number')+'<button>إثبات الاستلام وزيادة المخزون</button></form>':'<p>استُلم كامل الطلب. يظل احتياج الإيصال محسوبًا حتى حجز الخام أو إنهاء الارتباط.</p>')+'<details><summary>إنهاء ارتباط البند وإلغاء المتبقي إن وجد</summary><form data-pro="po-close" data-order="'+e(o.id)+'">'+field('note','سبب إلغاء المتبقي أو مرجعه')+'<button>إغلاق البند دون زيادة الرصيد</button></form></details></article>').join('')+'<p role="status" data-pro-status></p>';
 };
 draw();
 host.onsubmit=async ev=>{
  ev.preventDefault();ev.stopPropagation();if(working)return;
  const form=ev.target,b=Object.fromEntries(new FormData(form)),action=form.dataset.pro,body={action,note:b.note||'معاينة توريد'};
  if(action==='policy')Object.assign(body,{key:selected,version,stamp:stock.procurementStamp,policy:{supplier:b.supplier,vendorSku:b.vendorSku,...Object.fromEntries(['pack','minimumPacks','reorder','target'].map(k=>[k,Number(b[k])]))}});
  else if(action==='propose'||action==='purchase')Object.assign(body,release,{key:selected,...(action==='purchase'?{quantity:proposal.quantity,stamp:proposal.stamp}:{})});
  else Object.assign(body,{order:form.dataset.order,...(action==='delivery'?{quantity:Number(b.quantity)}:{})});
  working=true;host.querySelectorAll('button').forEach(x=>x.disabled=true);
  const key=JSON.stringify(body);if(!request||request.key!==key)request={key,id:reqId()};
  try{
   const data=await send({...body,request:request.id});request=null;
   if(action==='propose'){proposal=data.proposal;draw();}
   else await reload();
  }catch(err){host.querySelector('[data-pro-status]').textContent=err.message;}
  finally{working=false;host.querySelectorAll('button').forEach(x=>x.disabled=false);}
 };
}
