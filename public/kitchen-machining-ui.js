import {processNames,candidateFinishDate} from './kitchen-machining.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(k,l,v,req=false)=>'<label>'+l+'<input type="number" name="'+k+'" min="0" step="any" '+(req?'required':'')+' value="'+e(v)+'"></label>';
const text=(k,l,v)=>'<label>'+l+'<input name="'+k+'" maxlength="160" required value="'+e(v)+'"></label>';
const opts=(o,x)=>Object.entries(o).map(([k,l])=>'<option value="'+e(k)+'" '+(String(k)===String(x)?'selected':'')+'>'+e(l)+'</option>').join('');
const sel=(k,l,o,v)=>'<label>'+l+'<select name="'+k+'">'+opts(o,v)+'</select></label>';
const map=(arr)=>Object.fromEntries(arr);
export function mountMachineBook(host,{read,update,message}){
 const recipes=c=>({...c.families,...Object.fromEntries(Object.entries(c.specials||{}).map(([id,s])=>['@'+id,{label:'ورقة خاصة · '+s.drawing+' · '+id,recipe:s.lines}]))});
 let wanted='',family='storage',line=0,which=0;const draw=()=>{
  const c=read(),book=c.machining||{strict:false,machines:[]},ms=book.machines,empty={ops:[],skus:[]},m=ms.find(m=>m.id===wanted)||empty;
  const families=recipes(c),recipe=families[family].recipe,part=recipe[line],ops=part?.operations||[],op=ops[which]||{kind:'drill',xFrom:'start',yFrom:'start'};
  const works=Object.entries(processNames),catalog=c.items.filter(i=>i.kind!=='piece');
  host.innerHTML='<h4>قدرة الماكينة ومرجع الصفر</h4><p>تعتمد الآلة لصنف خام بعينه. يفحص البرنامج غلاف القطعة والسماحة ومساحة التثبيت. طول القطعة المثنية يأتي من وصفة الفرد المعتمدة.</p>'+
   '<label><input type="checkbox" data-mstrict '+(book.strict?'checked':'')+'> اشترط مسار تشغيل مسجّلًا لكل قطعة خام قبل الإفراج</label>'+
   sel('chooseMachine','الماكينة',map([['','+ تعريف ماكينة'],...ms.map(v=>[v.id,v.name])]),wanted)+
   '<form data-mf="machine"><div class="kw-grid">'+text('id','رمز الماكينة',m.id)+text('name','الاسم',m.name)+text('datum','مرجع الصفر والمثبت',m.datum)+
   n('maxLength','أطول قطعة (مم)',m.maxLength,true)+n('maxWidth','أقصى عرض (مم)',m.maxWidth,true)+n('maxThickness','أقصى سماكة أو ارتفاع مقطع (مم)',m.maxThickness,true)+n('minTolerance','أضيق سماحة ممكنة (± مم)',m.minTolerance,true)+n('clampMargin','هامش الماسك حول القطعة (مم)',m.clampMargin,true)+n('maxAngle','أقصى زاوية (درجة)',m.maxAngle,true)+n('minBendRadius','أقل نصف قطر للثني (مم)',m.minBendRadius,true)+n('setupMin','إعداد العملية الواحدة (دقيقة)',m.setupMin)+n('dailyMin','دقائق العمل المتاحة لهذه الخطة يوميًا',m.dailyMin)+'</div>'+
   '<fieldset><legend>عمليات هذه الماكينة</legend>'+works.map(([k,v])=>'<label><input type="checkbox" name="ops" value="'+k+'" '+(m.ops.includes(k)?'checked':'')+'> '+v+'</label>').join('')+'</fieldset><fieldset><legend>الأصناف المعتمدة</legend>'+catalog.map(i=>'<label><input type="checkbox" name="skus" value="'+e(i.sku)+'" '+(m.skus.includes(i.sku)?'checked':'')+'> '+e(i.name+' · '+i.sku)+'</label>').join('')+'</fieldset><button>حفظ تعريف الماكينة</button></form>'+
   '<h4>تعليمات مرتبطة بقطعة من الوصفة</h4>'+sel('family','عائلة الوحدة',map(Object.entries(families).map(([k,f])=>[k,f.label])),family)+
   sel('line','قطعة الوصفة',map(recipe.map((r,i)=>[i,r.label+' · '+r.sku])),line)+(part?sel('which','العملية',map([...ops.map((a,i)=>[i,processNames[a.kind]+' · '+a.machine]),[ops.length,'+ عملية جديدة']]),which)+
   '<form data-mf="operation"><div class="kw-grid">'+sel('machine','التنفيذ',map([['external','مورد خارجي معتمد'],...ms.map(m=>[m.id,m.name])]),op.machine)+sel('kind','العملية',processNames,op.kind)+text('reference','مرجع مخطط التشغيل ووجه القطعة',op.reference)+n('tolerance','السماحة المطلوبة (± مم)',op.tolerance,true)+
   sel('xFrom','مرجع X',{start:'من أول الطول',end:'من آخر الطول'},op.xFrom)+n('x','مسافة المحور X (مم)',op.x??0,true)+sel('yFrom','مرجع Y',{start:'من أول العرض',end:'من آخر العرض'},op.yFrom)+n('y','مسافة المحور Y (مم)',op.y??0,true)+
   n('diameter','قطر الثقب (مم)',op.diameter??0)+n('depth','عمق الثقب أو الجيب (مم)',op.depth??0)+n('length','طول الجيب من مركزه (مم)',op.length??0)+n('width','عرض الجيب حول المركز (مم)',op.width??0)+n('angle','زاوية الطرف أو الثني (درجة)',op.angle??0)+n('radius','نصف قطر الثني (مم)',op.radius??0)+n('minutes','دقائق التشغيل لكل قطعة',op.minutes)+
   '<label>المورد الخارجي<input name="provider" value="'+e(op.provider)+'"></label><label>مرجع قبول المورد وتحققه من القدرة<input name="confirmation" value="'+e(op.confirmation)+'"></label>'+n('leadDays','مدة العمل الخارجي (أيام)',op.leadDays)+'</div><button>حفظ العملية</button> '+(ops[which]?'<button type="button" data-mremove>حذف هذه العملية</button>':'')+'</form>':'<p>هذه العائلة لا تحتوي قطعًا.</p>')+'<p role="status" data-mnote></p>';
 };
 const msg=s=>{const el=host.querySelector('[data-mnote]');if(el)el.textContent=s;message?.(s);};
 const change=(cb)=>{const ok=update(c=>{c.machining??={strict:false,machines:[]};cb(c);});draw();msg(ok?'حُفظ التعديل. راجع إصدار الكتالوج قبل الإفراج.':'تعذّر الحفظ. راجع الحدود والأصناف والبيانات المطلوبة.');};
 host.onchange=ev=>{const t=ev.target;
  if(t.hasAttribute('data-mstrict')){change(c=>{c.machining.strict=t.checked;});return;}
  if(t.name==='chooseMachine')wanted=t.value;else if(t.name==='family'){family=t.value;line=0;which=0;}else if(t.name==='line'){line=Number(t.value);which=0;}else if(t.name==='which')which=Number(t.value);else return;draw();};
 host.onclick=ev=>{if(ev.target.hasAttribute('data-mremove'))change(c=>{recipes(c)[family].recipe[line].operations.splice(which,1);which=0;});};
 host.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();const form=ev.target,data=new FormData(form),v=Object.fromEntries(data);
  if(form.dataset.mf==='machine'){v.ops=data.getAll('ops');v.skus=data.getAll('skus');for(const k of ['maxLength','maxWidth','maxThickness','minTolerance','clampMargin','maxAngle','minBendRadius','setupMin','dailyMin'])v[k]=v[k]===''?null:Number(v[k]);
   if(wanted&&v.id!==wanted||!wanted&&read().machining?.machines.some(m=>m.id===v.id)){msg('رمز الماكينة ثابت ويجب أن يكون فريدًا.');return;}
   change(c=>{const a=c.machining.machines,idx=a.findIndex(m=>m.id===v.id);if(idx<0)a.push(v);else a[idx]=v;wanted=v.id;});}
  else{for(const k of ['tolerance','x','y','diameter','depth','length','width','angle','radius','minutes','leadDays'])v[k]=v[k]===''?null:Number(v[k]);
   change(c=>{const p=recipes(c)[family].recipe[line];p.operations??=[];p.operations[which]=v;});}
 };draw();
}
export function shopOperationsPanel(host,quote,catalog,download){
 host.innerHTML='<details><summary>عمليات الماكينات وموعد الورشة التقديري</summary><p>يتبع ملف التشغيل القطع والوصفات المرتبطة بهذا الحصر. تُطابق الورشة مرجع الصفر والتثبيت قبل التشغيل.</p><p>عمليات معرفة '+quote.operations.length+' · بنود خام بلا برنامج تشغيل '+quote.unrouted.length+'</p><button type="button" data-mcsv>تنزيل جدول التشغيل CSV</button><h4>تقدير موعد انتهاء التصنيع</h4><p>أيام التوريد تقويمية والموردون يبدأون معًا. تُجمع أيام محطات التشغيل بالتتابع حسب الطاقة المخصصة. لا يحجز الحساب ماكينة أو موعد تركيب.</p><label>بداية الخطة<input type="date" data-mstart></label><fieldset><legend>أيام عمل هذه الورشة</legend>'+['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].map((v,i)=>'<label><input type="checkbox" data-mday value="'+i+'"> '+v+'</label>').join('')+'</fieldset><button type="button" data-mdate>حساب التاريخ</button><p role="status" data-mresult></p></details>';
 host.onclick=ev=>{
  if(ev.target.hasAttribute('data-mdate')){const res=candidateFinishDate(quote,catalog,host.querySelector('[data-mstart]').value,[...host.querySelectorAll('[data-mday]:checked')].map(x=>Number(x.value)));host.querySelector('[data-mresult]').textContent=res.issues.length?res.issues.join(' '):'تقدير نهاية التصنيع '+res.date+' · '+res.workdays+' أيام تشغيل و'+res.leadDays+' أيام مهلة تقويمية.';}
  if(ev.target.hasAttribute('data-mcsv'))download(['حالة','الوحدة','الصنف','القطعة','العدد','العملية','المحطة','مرجع التشغيل','مرجع التثبيت','X مم','Y مم','طرف مرجعي','قطر مم','عمق مم','طول الجيب','عرض الجيب','زاوية درجة','نصف قطر مم','سماحة مم'],quote.operations.map(o=>[o.ok?'حسب القدرة المعرفة':'معلق',o.unitId,o.sku,o.part,o.count,processNames[o.kind],o.station,o.reference,o.datum,o.x,o.y,o.edge,o.diameter,o.depth,o.length,o.width,o.angle,o.radius,o.tolerance]));
 };
}
