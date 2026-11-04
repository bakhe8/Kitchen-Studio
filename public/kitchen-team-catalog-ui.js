import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {catalogFingerprint,encodePortableCatalog,installTeamCatalog} from './kitchen-factory-template.js';
import {hasWorkshopCatalog} from './kitchen-catalog-records.js';
import {getProjectAccess,validateProjectEdit} from './kitchen-project-access.js';
const catalogRoles={owner:'مالك',reader:'قراءة',store:'المتجر',factory:'المصنع'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>globalThis.crypto.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
async function send(q,body){
 const r=await fetch('/api/catalogs?'+new URLSearchParams(q),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'X-Studio-Request':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('تعذّر الاتصال ببوابة الفريق. سجّل الدخول بالمتصفح ثم أعد المحاولة.');
 const data=await r.json();if(!r.ok)throw Error(data.error||'تعذر تنفيذ الطلب.');return data;
}
export function mountTeamCatalogStep(host,{getDoc,apply,tell}){
 let closed=false,running=false,ready=false,list=[],chosen='',preview=null,versions=[],members=[],msg='جارٍ الاتصال…',command=null;
 const act=(a,t)=>'<button type="button" data-tc="'+a+'">'+esc(t)+'</button>';
 const choice=()=>list.find(c=>c.id===chosen);
 function draw(){
  if(closed)return;
  const doc=getDoc(),local=getFactoryCatalog(doc),pin=local.teamSource,c=choice(),access=getProjectAccess(doc);
  const scoped=preview?.type==='kitchen-catalog-view',candidate=preview&&!scoped&&installTeamCatalog(doc,{id:preview.id,version:preview.version,digest:preview.digest},preview.catalogRecords||preview.catalog);
  const mayApply=candidate&&validateProjectEdit(doc,candidate).ok;
  host.innerHTML='<h2>كتالوجات فريق المصنع</h2><section class="kf-version"><div><small>الإصدار المطبق على المشروع</small><h3>'+esc(local.name)+'</h3></div><span class="kf-badge">'+(pin?'إصدار المصنع '+pin.version+(catalogFingerprint(local)===pin.digest?' · يطابق الإصدار المنشور':' · يحتوي تعديلات محلية'):'قالب على الجهاز')+'</span><p>'+local.items.length+' صنفًا · '+Object.keys(local.families).length+' عائلات وحدات</p></section>'+
  '<p role="status">'+esc(msg)+'</p>'+act('refresh','تحديث القائمة')+(ready?'':' <a target="_top" href="/signin-with-chatgpt?return_to=%2F%3Fpanel%3Dworkshop%26step%3Dteam">تسجيل الدخول</a>')+
  (ready?'<div class="ws-card"><h3>قوالب المصنع المتاحة لحسابك</h3>'+(list.length?'<label>الكتالوج<select data-tc-pick>'+list.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===chosen?'selected':'')+'>'+esc(v.name)+' · '+v.version+' · '+esc(catalogRoles[v.role]||'صلاحية غير معروفة')+'</option>').join('')+'</select></label>'+act('preview','معاينة آخر إصدار')+' '+act('history','عرض الإصدارات السابقة'):'<p>لم ينشر أو يشارك معك كتالوج بعد.</p>')+
  (versions.length?'<label>الإصدارات<select data-tc-version>'+versions.map(v=>'<option value="'+v.version+'">'+v.version+' · '+esc(v.created)+'</option>').join('')+'</select></label>'+act('older','معاينة الإصدار المحدد'):'')+
  (scoped?'<div class="kf-version-compare"><p>هذا الكتالوج يعرض بيانات دورك فقط. افتحه من كتالوجات مساحة المشروع المشتركة؛ لا يُطبّق كقالب كامل.</p></div>':preview?'<div class="kf-version-compare"><small>الإصدار المحدد للمعاينة</small><b>'+esc(preview.catalog.name)+' · الإصدار '+preview.version+'</b><p>'+preview.catalog.items.length+' صنفًا · '+Object.keys(preview.catalog.families).length+' عائلات. يتغير كتالوج هذا المشروع عند التطبيق وتحتاج الاعتمادات المتأثرة إلى مراجعة.</p>'+(mayApply?act('apply','تطبيق هذا الإصدار على المشروع'):'<p>تطبيق هذه السجلات يحتاج صلاحية صاحبها في المشروع.</p>')+'</div>':'')+'</div>'+(['local','ready'].includes(access.status)&&access.role==='owner'?'<details class="kf-admin"><summary>نشر قالب معتمد</summary><p>راجع وصدّق وصفات المصنع محليًا أولًا. يُنشر القالب المشترك دون الرسومات وقطع المشروع الخاصة. تغيّر المخزون في أي مشروع لا يحجز رصيدًا للمشاريع الأخرى.</p>'+act('new','نشر كتالوج جديد')+(c?.role==='owner'?' '+act('next','نشر إصدار جديد في الكتالوج المحدد') :'')+'</details>':''):'')+
  (ready&&c?.role==='owner'?'<div class="ws-card"><h3>مشاركو الكتالوج</h3><p>يشترط أن يفتح المشارك مشاريع الفريق أو هذه البوابة بحسابه أول مرة.</p><label>بريد الحساب<input type="email" data-tc-email maxlength="254"></label><label>الصلاحية<select data-tc-role><option value="reader">قراءة</option><option value="store">المتجر · الأصناف والأسعار</option><option value="factory">المصنع · الوصفات</option></select></label>'+act('grant','منح الصلاحية')+' '+act('revoke','إلغاء الوصول')+' '+act('members','عرض الحسابات')+'<p>'+members.map(m=>esc(m.email)+' · '+esc(catalogRoles[m.role]||'قراءة')).join('، ')+'</p></div>':'');
  if(running)for(const el of host.querySelectorAll('button,select'))el.disabled=true;
 }
 async function refresh(){const d=await send({});list=d.catalogs;ready=true;if(!list.some(v=>v.id===chosen))chosen=list[0]?.id||'';msg=d.truncated?'تظهر أحدث ١٥٠ مشاركة.':'القائمة محدثة.';}
 async function run(fn){
  if(running)return;running=true;draw();
  try{await fn();}catch(e){msg=e.message;tell?.(msg);}
  finally{running=false;draw();}
 }
 async function handle(e){
  const type=e.target.closest('[data-tc]')?.dataset.tc;if(!type||running)return;
  const version=host.querySelector('[data-tc-version]')?.value,email=host.querySelector('[data-tc-email]')?.value.trim()||'';
  await run(async()=>{
   const selected=choice();
   if(type==='refresh'){await refresh();return;}
   if(type==='history'){versions=(await send({id:chosen,action:'versions'})).versions;return;}
   if(type==='preview'||type==='older'){preview=await send({id:chosen,...(type==='older'?{version}:{})});return;}
   if(type==='apply'&&preview){if(preview.type==='kitchen-catalog-view')throw Error('بيانات الدور لا تُستورد كقالب كامل.');
    const cur=getDoc(),next=installTeamCatalog(cur,{id:preview.id,version:preview.version,digest:preview.digest},preview.catalogRecords||preview.catalog);
    if(!next)throw Error('القالب غير صالح لهذا المشروع أو تعذر حفظ القطع الخاصة به.');
    const allowed=validateProjectEdit(cur,next);if(!allowed.ok)throw Error(allowed.reason);
    const res=apply(next,'طُبِّق إصدار كتالوج الفريق.');if(res?.ok===false)throw Error(res.reason);msg='حُفظ الإصدار '+preview.version+' في هذا المشروع. تُراجع الصفوف التي تغيّرت حدودها.';return;}
   if(type==='members'){members=(await send({id:chosen,action:'members'})).members;return;}
   if(type==='grant'||type==='revoke'){if(selected?.role!=='owner')throw Error('إدارة المشاركين لمالك الكتالوج.');if(!email)throw Error('أدخل بريد الحساب.');const role=host.querySelector('[data-tc-role]')?.value||'reader';await send({id:chosen,action:type==='grant'?'share':'revoke'},{email,role});
    members=(await send({id:chosen,action:'members'})).members;msg='حُدّث الوصول لحساب '+email;return;}
   if(type==='new'||type==='next'){
    const access=getProjectAccess(getDoc());if(!['local','ready'].includes(access.status)||access.role!=='owner')throw Error('نشر القالب الكامل من حساب المالك. استخدم مساحة دورك لتعديل سجلك.');
    if(type==='next'&&selected?.role!=='owner')throw Error('استخدم مساحة دورك لنشر السجل المسموح به في هذا الكتالوج.');
    const doc=getDoc(),model=encodePortableCatalog(hasWorkshopCatalog(doc.room.workshop)?doc.room.workshop:getFactoryCatalog(doc));if(!model?.factoryRecipes.approved)throw Error('اعتمد وصفات الكتالوج من بوابة المصنع قبل النشر.');
    const key=[type,chosen,selected?.version||0,JSON.stringify(model)].join('|');
    if(!command||command.key!==key)command={key,id:type==='new'?uuid():chosen,rid:uuid(),expected:type==='new'?0:selected.version};
    const out=await send({action:'publish',id:command.id,request:command.rid,expected:command.expected},model);command=null;chosen=out.id;
    await refresh();preview=null;members=[];versions=[];msg='نُشر الإصدار '+out.version+'. يمكن للمالك مشاركة الكتالوج مع المندوبين.';return;
   }
  });
 }
 const change=e=>{if(e.target.hasAttribute('data-tc-pick')){chosen=e.target.value;versions=[];members=[];preview=null;draw();}};
 host.addEventListener('click',handle);host.addEventListener('change',change);
 run(refresh);return ()=>{closed=true;host.removeEventListener('click',handle);host.removeEventListener('change',change);};
}
