import {acceptDrawerPacking,drawerPackHosts,drawerPackIssues,proposeDrawerPacking} from './kitchen-drawer-packing.js';
import {cleanDrawerPack} from './kitchen-drawer-pack-data.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(id,label,value='',type='text')=>'<label>'+label+'<input required name="'+id+'" type="'+type+'" '+(type==='number'?'min=".001" step="any"':'maxlength="180"')+' value="'+esc(value)+'"></label>';
const dims=(p,label,v=[])=>'<fieldset><legend>'+label+' · مم</legend><div class="ws-inline">'+['العرض','العمق','الارتفاع'].map((l,i)=>field(p+i,l,v[i],'number')).join('')+'</div></fieldset>';
const signed=(k,l,v)=>'<label>'+l+'<input type="number" required min="-3000" max="3000" step="any" name="'+k+'" value="'+esc(v)+'"></label>';
const checked=v=>v?' checked':'';
const opt=(v,label,current)=>'<option value="'+esc(v)+'"'+(current===v?' selected':'')+'>'+esc(label)+'</option>';
const readSize=(f,k)=>[0,1,2].map(i=>Number(f.get(k+i)));
export function mountDrawerPack(host,{getDoc,apply,tell,scoped=false}){
 const ac=new AbortController(),signal=ac.signal;let preview=null,editB=null,editG=null,msg='';
 const data=()=>getDoc().room.workshop?.clientUsage?.pack||{groups:[],bays:[]};
 function showSlots(pack,slots){
  const summary=new Map();
  for(const p of slots){const name=pack.groups.find(g=>g.id===p.group)?.name||p.group,key=name+' · '+p.bay;summary.set(key,(summary.get(key)||0)+1);}
  return '<ul>'+[...summary].map(([s,n])=>'<li>'+esc(s)+' · '+n+' قطعة</li>').join('')+'</ul><details><summary>موضع كل قطعة داخل الدرج</summary>'+slots.map(p=>'<p>'+esc(pack.groups.find(g=>g.id===p.group)?.name||p.group)+' '+p.index+' · '+esc(p.bay)+' · <bdi>'+p.at.join('، ')+'</bdi> مم من بداية الحيز الحر'+(p.turn?' · دوران أفقي ٩٠°':'')+'</p>').join('')+'</details>';
 }
 function groupForm(p,g){
  return '<details '+(editG?'open':'')+'><summary>أغراض العميل · '+p.groups.length+'</summary>'+p.groups.map(g=>'<p>'+esc(g.name)+' × '+g.count+' <button data-edit-group="'+esc(g.id)+'">تعديل</button> <button data-drop-group="'+esc(g.id)+'">إزالة</button></p>').join('')+
   '<form data-pack-group>'+field('name','الغرض أو مجموعة القطع المتطابقة',g?.name)+dims('size','غلاف القطعة شامل المقبض أو الغطاء',g?.size)+field('count','عدد القطع المطلوبة',g?.count,'number')+field('massKg','الكتلة الإجمالية لقطعة واحدة مع محتواها · كجم',g?.massKg,'number')+'<label>اختيار العميل الملزم<select name="fixed">'+opt('',scoped?'يُترك اختيار الدرج لمراجعة المصنع':'اقتراح درج من الأدراج المتاحة',g?.fixed)+p.bays.map(b=>opt(b.id,b.id,g?.fixed)).join('')+'</select></label>'+
   [['rotate','يسمح بتدوير القطعة أفقيًا'],['stack','يسمح برص قطع متماثلة فوق بعضها'],['together','تبقى كل قطع المجموعة في درج واحد']].map(([k,l])=>'<label><input name="'+k+'" type="checkbox"'+checked(g?.[k])+'> '+l+'</label>').join('')+'<button>حفظ مجموعة الأغراض</button></form></details>';
 }
 function draw(){
  const doc=getDoc(),p=data(),g=p.groups.find(i=>i.id===editG);
  if(scoped){
   host.innerHTML='<section class="ws-card"><h3>أغراض العميل وقياسات الأدراج المسجّلة</h3><p>سجّل أغراض العميل ومقاساتها ووزنها واختياره للدرج. تبقى هذه طلبات للعميل؛ يراجع المصنع ملاءمة الأغراض وقياسات الأدراج واختيار السكة من سجله الفعلي. القياسات والتوزيع السابق أدناه للعرض، ولا يثبت عرضهما صلاحية التوزيع بعد تعديل الطلب.</p>'+
    '<details><summary>قياسات الأدراج المسجّلة · '+p.bays.length+'</summary>'+p.bays.map(b=>'<p><b>'+esc(b.id)+'</b> · الحيز <bdi>'+b.size.map(esc).join(' × ')+'</bdi> مم · المدخل <bdi>'+b.entry.map(esc).join(' × ')+'</bdi> مم'+(b.entryAt?' · بداية المدخل <bdi>'+b.entryAt.map(esc).join('، ')+'</bdi> مم':'')+' · مرجع القياس '+esc(b.reference)+'</p>').join('')+(p.bays.length?'':'<p>لم تُسجّل قياسات أدراج بعد.</p>')+'</details>'+groupForm(p,g)+
    (p.accepted?'<details><summary>التوزيع المسجّل سابقًا · '+esc(p.accepted.reference)+'</summary>'+showSlots(p,p.accepted.slots)+'</details>':'')+'</section>';
   return;
  }
  const hosts=drawerPackHosts(doc),b=p.bays.find(b=>b.id===editB);
  const options=[...hosts].map(([k,v])=>opt(k,k+(v.confirmed?'':' · فحص السكة معلّق'),editB)).join(''),warn=drawerPackIssues(doc);
  host.innerHTML='<section class="ws-card"><h3>أين تسع أغراض العميل؟</h3><p>اختر الأدراج التي يسمح العميل باستخدامها وقِس الجزء المستطيل الفارغ ومدخل الغرض بعد تثبيت السكة. استبعد الحيز المشغول بالأرز أو بأغراض سبق تسجيلها. تسجّل هنا الأغراض الإضافية ووزنها مرة واحدة.</p>'+
   '<details '+(editB?'open':'')+'><summary>أدراج متاحة · '+p.bays.length+'</summary>'+p.bays.map(b=>'<p>'+esc(b.id)+' · '+esc(b.reference)+' <button data-edit-bay="'+esc(b.id)+'">تعديل</button> <button data-drop-bay="'+esc(b.id)+'">إزالة</button></p>').join('')+
   (options?'<form data-pack-bay><label>الدرج (١ هو الأعلى)<select name="id">'+options+'</select></label>'+dims('size','الحيز الصافي الفارغ المتصل',b?.size)+dims('entry','الفتحة المتاحة فوق الدرج عند إدخال الغرض رأسيًا',b?.entry)+signed('entryX','بداية الفتحة من يسار الحيز الفارغ · مم',b?.entryAt?.[0])+signed('entryY','بداية الفتحة من مؤخرة الحيز الفارغ · مم',b?.entryAt?.[1])+field('reference','مرجع قياس الجزء الفارغ والمدخل',b?.reference)+'<label><input type="checkbox" name="allowAuto"'+checked(b?.allowAuto)+'> يسمح العميل بالاقتراح الآلي لهذا الدرج عند خلوّه من طلب مثبّت</label><button>حفظ قياس الدرج</button></form>':'<p>عرّف وصفة درج تختار طقم السحب لكل واجهة من بوابة المصنع. أضفها إلى الصف ثم أدخل قياسات التثبيت.</p>')+'</details>'+
   groupForm(p,g)+
   (p.accepted?'<details><summary>التوزيع المحفوظ · '+esc(p.accepted.reference)+'</summary>'+showSlots(p,p.accepted.slots)+'</details>':'')+
   '<form data-pack-preview>'+(p.accepted?'<label><input name="redistribute" type="checkbox"> طلب العميل إعادة توزيع المواضع السابقة التي لم يحدد لها درجًا</label>':'')+'<button>اقتراح توزيع وحساب السكك</button></form>'+
   (preview?.ok?'<h4>اقتراح بانتظار اعتماد العميل</h4>'+showSlots(p,preview.slots)+preview.selection.map(v=>'<p>'+esc(v.id)+' · '+esc(v.oldSku||'غير معيّن')+' ← '+esc(v.sku)+' · '+(v.price??'غير مسعّر')+' ر.س للزوج'+(v.price!=null&&v.oldPrice!=null?' · فرق '+Number((v.price-v.oldPrice).toFixed(2))+' ر.س':'')+'</p>').join('')+'<form data-pack-accept>'+field('reference','مرجع موافقة العميل على هذه المواضع')+'<button>اعتماد هذا التوزيع وتحديث الحصر</button></form>':'')+
   '<p role="status">'+esc(msg||warn[0]||'')+'</p></section>';
 }
 function save(next){const pack=cleanDrawerPack(scoped?{...data(),groups:next.groups}:next);if(!pack){tell('راجع مقاسات الأغراض وعددها وكتلتها والمرجع. الحد ٤٠ مجموعة و٨٠ قطعة.');return;}const d=getDoc(),w=d.room.workshop,r=apply({...d,room:{...d.room,workshop:{...w,clientUsage:{...w?.clientUsage,tasks:w?.clientUsage?.tasks||[],pack}}}},'حُفظت متطلبات أغراض العميل.');if(r?.ok!==false){preview=null;editB=null;editG=null;msg='';draw();}}
 const factoryReview=()=>tell('مراجعة قياسات الأدراج والتوزيع واختيار السكك تحتاج سجل المصنع الفعلي. يمكنك تعديل طلبات أغراض العميل هنا.');
 host.addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;const d=el.dataset,p=data();if(scoped&&(d.editBay||d.dropBay)){factoryReview();return;}if(d.editBay){editB=d.editBay;draw();}if(d.editGroup){editG=d.editGroup;draw();}if(d.dropGroup)save({...p,groups:p.groups.filter(x=>x.id!==d.dropGroup)});if(d.dropBay)save({...p,bays:p.bays.filter(x=>x.id!==d.dropBay)});},{signal});
 host.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const form=e.target;if(scoped&&(!form.hasAttribute('data-pack-group')||['data-pack-bay','data-pack-preview','data-pack-accept'].some(k=>form.hasAttribute(k)))){factoryReview();return;}const f=new FormData(form),p=data(),doc=getDoc();
  if(form.hasAttribute('data-pack-bay')){const id=f.get('id'),h=drawerPackHosts(doc).get(id);if(!h?.confirmed){tell('أكمل قياسات تثبيت السكة الحالية في تكوين الصف.');return;}const b={id,basis:h.basis,size:readSize(f,'size'),entry:readSize(f,'entry'),entryAt:[Number(f.get('entryX')),Number(f.get('entryY'))],reference:f.get('reference'),allowAuto:f.has('allowAuto')};save({...p,bays:[...p.bays.filter(v=>v.id!==id),b]});}
  if(form.hasAttribute('data-pack-group')){const id=editG||'g-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),g={id,name:f.get('name'),count:Number(f.get('count')),massKg:Number(f.get('massKg')),size:readSize(f,'size'),fixed:f.get('fixed'),rotate:f.has('rotate'),together:f.has('together'),stack:f.has('stack')};save({...p,groups:[...p.groups.filter(v=>v.id!==id),g]});}
  if(form.hasAttribute('data-pack-preview')){preview=proposeDrawerPacking(doc,{preserve:!f.has('redistribute')});msg=preview.ok?'الاقتراح جاهز لمراجعة العميل.':preview.reason;draw();}
  if(form.hasAttribute('data-pack-accept')){const next=acceptDrawerPacking(doc,preview,f.get('reference'));if(!next){tell('تغيّرت شروط التوزيع. أعد الاقتراح قبل اعتماده.');return;}if(apply(next,'حُفظ توزيع العميل وأعيد حساب اختيار السكك.')?.ok!==false){preview=null;msg='تم اعتماد توزيع الأغراض.';draw();}}
 },{signal});draw();return ()=>ac.abort();
}
