// Factory review input contains only its own worksheet and public material
// dimensions. The server binds the sheet to the full project's geometry.
const clone=v=>structuredClone(v),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input=(key,label,value='',numeric=false)=>'<label>'+label+'<input data-special-field="'+key+'" value="'+esc(value??'')+'" '+(numeric?'type="number" min="0.001" step="any"':'maxlength="500"')+' required></label>';
export function mountScopedSpecial(host,{data,load,save,tell}){
 const ac=new AbortController();let dead=false,pending=false,busy=false,current=clone(data),draft;
 const blank=()=>({sku:current.items[0]?.sku||'',label:'',count:1,a:null,b:null,operation:''});
 function setup(){draft=clone(current.draft||{reviewer:'',measurement:'',drawing:'',instructions:'',lines:[blank()]});pending=false;draw();}
 const target=()=>current.targets.find(t=>t.id===current.targetId);
 function draw(){
  if(dead)return;if(!current.targets.length){host.innerHTML='<section class="ws-card"><h2>أوراق القطع الخاصة</h2><p>لا توجد تقسيمات أو عناصر خاصة تحتاج ورقة قطع في النسخة الحالية.</p></section>';return;}
  const t=target();host.innerHTML='<section class="ws-card"><h2>ورقة قطع ومراجعة المصنع</h2><p>سجّل القطع الفعلية وفق رسم التفصيل. يربط الخادم المراجعة بالهندسة الحالية؛ بعد حفظها راجع اعتماد وصفات المصنع.</p><label>العنصر<select data-special-target>'+current.targets.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===current.targetId?'selected':'')+'>'+esc(v.label)+'</option>').join('')+'</select></label><p>'+esc(t.label)+' · '+(t.current?'الورقة مرتبطة بالهندسة الحالية':'بانتظار مراجعة هندسة هذه النسخة')+'</p><form data-special-form>'+[['reviewer','اسم مراجع المصنع'],['measurement','مرجع القياس'],['drawing','رسم التفصيل وإصداره'],['instructions','مرجع الوصلات والثقوب والتركيب']].map(([k,l])=>input(k,l,draft[k])).join('')+
   (t.hardware?'<p>أدرج العتاد '+esc(t.hardware)+' بالعدد الفعلي.</p>':'')+
   (t.appliance?'<fieldset data-special-fit><legend>فتحة الجهاز</legend>'+input('model','موديل الجهاز',draft.fit?.model)+input('manual','مرجع تعليمات التركيب',draft.fit?.manual)+['required','available'].map(m=>['width','depth','height'].map(k=>input(m+'-'+k,(m==='required'?'المطلوب':'الصافي المقاس')+' · '+({width:'عرض',depth:'عمق',height:'ارتفاع'}[k])+' مم',draft.fit?.[m]?.[k],true)).join('')).join('')+'<label><input type="checkbox" data-special-bay '+(draft.bay?'checked':'')+'> حجز فتحة فقط؛ الجهاز يورده العميل ولا توجد قطع جسم</label></fieldset>':'')+
   '<div data-special-lines>'+(draft.bay?'':draft.lines.map((l,i)=>{const item=current.items.find(v=>v.sku===l.sku)||current.items[0];return '<fieldset data-special-line="'+i+'"><legend>قطعة '+(i+1)+'</legend>'+input('label','اسم القطعة',l.label)+'<label>الصنف<select data-special-field="sku">'+current.items.map(v=>'<option value="'+esc(v.sku)+'" '+(v.sku===l.sku?'selected':'')+'>'+esc(v.name)+' · '+esc(v.sku)+'</option>').join('')+'</select></label>'+input('count','عدد القطع',l.count,true)+(item?.kind!=='piece'?input('a','الطول النهائي · مم',l.a,true):'')+(item?.kind==='panel'?input('b','العرض النهائي · مم',l.b,true):'')+input('operation','اتجاه القطع أو مرجع العملية',l.operation)+'<button type="button" data-special-remove="'+i+'">إزالة القطعة</button></fieldset>';}).join(''))+'</div>'+(!draft.bay?'<button type="button" data-special-add>إضافة قطعة</button>':'')+'<button type="submit" data-special-save>حفظ ورقة المصنع على الخادم</button></form><p data-special-status role="status"></p></section>';
 }
 function collect(){if(!target())return;const form=host.querySelector('[data-special-form]'),read=(node,key)=>node.querySelector('[data-special-field="'+key+'"]')?.value.trim()||'';
  for(const k of ['reviewer','measurement','drawing','instructions'])draft[k]=read(form,k);
  if(target().appliance){draft.fit={model:read(form,'model'),manual:read(form,'manual'),required:{},available:{}};for(const m of ['required','available'])for(const k of ['width','depth','height'])draft.fit[m][k]=Number(read(form,m+'-'+k));}
  for(const row of form.querySelectorAll('[data-special-line]')){const l=draft.lines[Number(row.dataset.specialLine)];for(const k of ['sku','label','operation'])l[k]=read(row,k);l.count=Number(read(row,'count'));l.a=read(row,'a')?Number(read(row,'a')):null;l.b=read(row,'b')?Number(read(row,'b')):null;}
 }
 const controls=()=>host.querySelectorAll('input,select,button').forEach(v=>v.disabled=busy);
 async function work(fn){if(busy)return;busy=true;controls();try{await fn();}catch(error){if(!dead){tell(error.message);const status=host.querySelector('[data-special-status]');if(status)status.textContent=error.message;}}finally{busy=false;if(!dead)controls();}}
 host.addEventListener('input',e=>{if(!e.target.matches('[data-special-target]'))pending=true;},{signal:ac.signal});
 host.addEventListener('change',e=>{if(busy)return;
  if(e.target.matches('[data-special-target]')){const id=e.target.value;if(pending&&!confirm('ترك مسودة الورقة غير المحفوظة وفتح العنصر الآخر؟')){e.target.value=current.targetId;return;}void work(async()=>{try{const next=await load(id);if(!dead){current=next;setup();}}catch(error){if(!dead){const selector=host.querySelector('[data-special-target]');if(selector)selector.value=current.targetId;}throw error;}});return;}
  if(e.target.matches('[data-special-bay]')){collect();draft.bay=e.target.checked;if(draft.bay)draft.lines=[];else if(!draft.lines.length)draft.lines=[blank()];pending=true;draw();}
  if(e.target.dataset.specialField==='sku'){collect();pending=true;draw();}
 },{signal:ac.signal});
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.hasAttribute('data-special-add')){collect();if(draft.lines.length>=70){tell('حد الورقة ٧٠ بندًا.');return;}draft.lines.push(blank());pending=true;draw();}if(b.hasAttribute('data-special-remove')){collect();draft.lines.splice(Number(b.dataset.specialRemove),1);pending=true;draw();}},{signal:ac.signal});
 host.addEventListener('submit',e=>{if(!e.target.matches('[data-special-form]'))return;e.preventDefault();collect();void work(async()=>{const next=await save(current.targetId,clone(draft));if(!dead){current=next;setup();tell('حُفظت ورقة المصنع وربطت بهندسة المشروع. راجع اعتماد الوصفات.');}});},{signal:ac.signal});
 setup();return {hasPending:()=>pending||busy,destroy(){dead=true;ac.abort();host.replaceChildren();}};
}
