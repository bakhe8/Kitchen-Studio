const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input=(k,label,v,type='text')=>'<label>'+label+'<input name="'+k+'" type="'+type+'" '+(type==='number'?'step="any" min="0"':'maxlength="180"')+' value="'+e(v)+'" required></label>';
const optionalNumber=(k,l,v)=>input(k,l,v,'number').replace('required>','>');
const options=(v,w)=>v.map(([id,l])=>'<option value="'+e(id)+'" '+(id===w?'selected':'')+'>'+e(l)+'</option>').join('');
const select=(k,l,v,w)=>'<label>'+l+'<select name="'+k+'">'+options(v,w)+'</select></label>';
const ends=[['square','نهاية قائمة بلا رَدّة'],['return','ردّة جانبية إلى الجدار'],['join','وصل مع كورنيش الجدار المجاور']];
export function mountFactoryTrims(host,{getDoc,apply,read,update,message}){
 let id='',kind='cornice';const tell=text=>{message?.(text);host.querySelector('[data-trim-status]').textContent=text;};
 const draw=()=>{
  const doc=getDoc(),catalog=read(),book=catalog.trims||{},r=book[id];
  if(r)kind=r.kind;
  const items=catalog.items.filter(v=>v.kind===(kind==='cornice'?'bar':'panel'));
  const applications=[];
  for(const [wall,o] of Object.entries(doc.room.workshop?.options||{}))for(const t of ['cornice','filler']){
   if(t==='cornice'&&!o.cornice.enabled||t==='filler'&&(o.mode!=='filler'||o.fillerBy!=='factory'))continue;
   const active=o.factoryTrim?.[t],available=Object.entries(book).filter(([,template])=>template.kind===t);
   applications.push('<form class="ws-card" data-trim-wall="'+e(wall)+'" data-kind="'+t+'"><b>'+e(wall)+' · '+(t==='cornice'?'كورنيش':'قفلة')+'</b>'+
    select('template','تفصيل هذا الجدار',[['','ورقة خاصة أو تقدير مستقل'],...available.map(([k,x])=>[k,x.label+' · '+k])],active?.recipe||'')+
    (t==='cornice'?'<div class="kw-grid">'+select('start','طرف بداية أول مقطع',ends,active?.start||(o.cornice.returns?'return':'square'))+select('end','طرف نهاية آخر مقطع',ends,active?.end||(o.cornice.returns?'return':'square'))+'</div>':'')+'<button>تطبيق على هذا الجدار</button></form>');
  }
  host.innerHTML='<p>تُعاد الوصفة عند تغيير المقاس. يمكن اختيار رَدّات ظاهرة أو وصل كورنيشين يلتقيان في الرسم. إذا كانت الوصلة تتطلب امتدادًا داخل ركن محجوز، يلزم تفصيله الخاص.</p>'+
   select('which','الوصفة',[['','إضافة وصفة تشطيب'],...Object.entries(book).map(([k,x])=>[k,x.label+' · '+k])],id)+
   (r?'<p>نوع الوصفة · '+(kind==='cornice'?'كورنيش':'قفلة')+'</p>':select('kind','النوع',[['cornice','قطاع كورنيش'],['filler','ألواح قفلة']],kind))+
   '<form data-trim-form><div class="kw-grid">'+(r?'<input name="id" type="hidden" value="'+e(id)+'">':input('id','رمز فريد باللاتينية',id))+input('label','الاسم',r?.label)+input('reference','مرجع المخطط أو ورقة المورد',r?.reference)+select('sku','الصنف الفعلي',items.map(v=>[v.sku,v.name+' · '+v.sku]),r?.sku)+
   (kind==='cornice'?input('heightMm','ارتفاع القطاع المثبت بالملليمتر',r?.heightMm,'number')+input('projectionMm','البروز في مستوى القص بالملليمتر',r?.projectionMm,'number'):
    input('minWidthMm','أقصر لوح قفلة مسموح',r?.minWidthMm,'number')+input('maxWidthMm','أطول لوح قفلة مسموح',r?.maxWidthMm,'number')+input('jointGapMm','فاصل بين اللوحين بالملليمتر',r?.jointGapMm,'number')+select('grain','يمتد عرض القفلة على',[['length','طول لوح الخام'],['across','عرض لوح الخام']],r?.grain||'length'))+
   select('machine','ماكينة تنفيذ اختيارية',[['','مسار غير معيّن'],...(catalog.machining?.machines||[]).filter(m=>m.ops.includes(kind==='cornice'?'miter':'size')).map(m=>[m.id,m.name])],r?.route?.machine||'')+optionalNumber('tolerance','سماحة تشغيل الماكينة مم',r?.route?.tolerance)+optionalNumber('minutes','دقائق لكل عملية',r?.route?.minutes)+
   '</div><button>حفظ وصفة التشطيب في الكتالوج</button></form><h4>اختيار الوصفة للجدار</h4>'+(applications.join('')||'<p>بعد اختيار كورنيش أو قفلة من المصنع في رفع الجدار، يظهر موضع تطبيق الوصفة هنا.</p>')+'<p data-trim-status role="status"></p>';
 };
 host.onchange=ev=>{const t=ev.target;if(t.name==='which'){id=t.value;draw();}else if(t.name==='kind'){kind=t.value;draw();}};
 host.onsubmit=ev=>{
  ev.preventDefault();ev.stopPropagation();const f=ev.target,d=Object.fromEntries(new FormData(f));
  if(f.hasAttribute('data-trim-form')){
   const type=kind,recipe={kind:type,label:d.label,reference:d.reference,sku:d.sku};
   const nums=type==='cornice'?['heightMm','projectionMm']:['minWidthMm','maxWidthMm','jointGapMm'];
   for(const n of nums)recipe[n]=d[n]===''?null:Number(d[n]);
   if(type==='filler')recipe.grain=d.grain;
   if(d.machine)recipe.route={machine:d.machine,tolerance:d.tolerance===''?null:Number(d.tolerance),minutes:d.minutes===''?null:Number(d.minutes)};
   if(!id&&Object.hasOwn(read().trims||{},d.id)){tell('رمز الوصفة مستخدم.');return;}
   if(update(c=>{c.trims={...c.trims,[d.id]:recipe};})){id=d.id;draw();tell('حُفظت وصفة التشطيب.');}else tell('راجع نوع الخام ومقاس القطاع أو حدود تقسيم اللوح.');
  }else{
   const wall=f.dataset.trimWall,k=f.dataset.kind,doc=getDoc(),w=doc.room.workshop,o=w?.options?.[wall];if(!o)return;
   const selected=d.template;if(selected&&read().trims?.[selected]?.kind!==k){tell('أعد اختيار وصفة موجودة في الكتالوج.');return;}
   const factoryTrim={...o.factoryTrim};if(!selected)delete factoryTrim[k];else factoryTrim[k]={recipe:selected,...(k==='cornice'?{start:d.start,end:d.end}:{})};
   const change=apply({...doc,room:{...doc.room,workshop:{...w,options:{...w.options,[wall]:{...o,factoryTrim}}}}},'تحدّثت وصفة تشطيب الجدار.');
   if(change?.ok===false){tell(change.reason);return;}draw();tell('راجِع القطع المولّدة في الحصر.');
  }
 };draw();
}
