import {mountStoneSeams} from './kitchen-upstand-seam-ui.js';
import {mountUpstandWindowEditor} from './kitchen-upstand-window-ui.js';
import {architectureWallLabel,roomArchitecture} from './kitchen-architecture.js';
import {assistNumber} from './kitchen-measurement-identity.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {cleanUpstandProfiles,cleanUpstandSpec,worktopUpstandTakeoff} from './kitchen-worktop-upstand.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const opt=(v,label,picked)=>'<option value="'+esc(v)+'"'+(v===picked?' selected':'')+'>'+esc(label)+'</option>';
const field=(label,control)=>'<label class="kw-field"><span>'+esc(label)+'</span>'+control+'</label>';
const optionalMm=v=>v?.trim()?(assistNumber(v)??NaN):undefined;
const dim=(name,value)=>'<input name="'+name+'" inputmode="decimal" value="'+esc(value)+'" placeholder="مم">';
const sameEdge=(a,b)=>['wall','bottomMm','fromMm','toMm'].every(k=>a[k]===b[k]);
const modes={undecided:'لم يحسمه العميل',none:'بدون نعلة رخام',supplier:'نعلة مع مورّد الرخام',factory:'نعلة من كتالوج المصنع'};
const fallback=()=>({choice:{mode:'undecided'},walls:{}});
function choiceControls(choice,cat){
 const sel=field('طلب العميل','<select name="strip-mode">'+Object.entries(modes).map(([k,v])=>opt(k,v,choice.mode)).join('')+'</select>');
 const profiles=cat.upstandProfiles||[],options=profiles.map(p=>{const item=cat.items.find(i=>i.sku===p.sku);return opt(p.id,item.name+' · '+ar(p.heightMm)+' × '+ar(item.thicknessMm)+' مم · '+p.reference,choice.profileId);});
 if(choice.profileId&&!profiles.some(p=>p.id===choice.profileId))options.unshift(opt(choice.profileId,'وصفة مفقودة · '+choice.profileId,choice.profileId));
 const factory=field('وصفة شريط الرخام','<select name="strip-profile">'+opt('','اختر الوصفة',choice.profileId||'')+options.join('')+'</select>')+(!profiles.length?'<p>يضيف المصنع الوصفة في الكتالوج تحت «قواعد الوحدات ونعلة الرخام».</p>':'');
 const supplier=field('الخامة أو مرجع عينة الرخام','<input maxlength="160" name="strip-material" value="'+esc(choice.material)+'">')+field('ارتفاع النعلة (مم)',dim('strip-h',choice.heightMm))+field('سماكتها (مم)',dim('strip-t',choice.thicknessMm))+'<details><summary>تخفيض الارتفاع عند الشبابيك</summary>'+field('أقل ارتفاع يجيزه المورّد (مم)',dim('strip-min',choice.minCutHeightMm))+'<small>عند تركه فارغًا يُستخدم الارتفاع الأصلي وحده.</small></details>';
 return sel+'<div data-strip-mode="factory"'+(choice.mode==='factory'?'':' hidden')+'>'+factory+'</div><div data-strip-mode="supplier"'+(choice.mode==='supplier'?'':' hidden')+'>'+supplier+'</div>';
}
function readChoice(form){
 const value=name=>form.elements.namedItem(name).value,mode=value('strip-mode');
 if(mode==='factory')return {mode,profileId:value('strip-profile')};
 if(mode==='supplier')return {mode,material:value('strip-material'),heightMm:assistNumber(value('strip-h')),thicknessMm:assistNumber(value('strip-t')),minCutHeightMm:optionalMm(value('strip-min'))};
 return {mode};
}
function report(take,interactive){
 const pick=(kind,index,label)=>interactive?'<button type="button" data-strip-report="'+kind+'" data-strip-index="'+index+'">'+label+'</button>':label;
 const strips=!take.segments.length?'<p>لا توجد قطع نعلة محسوبة في الرسم الحالي.</p>': '<div class="kw-tbl"><table><thead><tr><th>الجدار</th><th>من ← إلى (مم)</th><th>الطول × الارتفاع (مم)</th><th>الخامة والتوريد</th></tr></thead><tbody>'+take.segments.map((s,i)=>'<tr><td>'+esc(architectureWallLabel(s.wall))+'</td><td>'+pick('segment',i,'<bdi>'+ar(s.fromMm)+' – '+ar(s.toMm)+'</bdi>')+'</td><td>'+'<bdi>'+ar(s.lengthMm)+' × '+ar(s.heightMm)+'</bdi>'+(s.needsTemplate?' · يحتاج تفصيلًا':'')+'</td><td>'+esc(s.material)+' · '+(s.mode==='factory'?'المصنع':'مع المورد خارج مشتريات الدواليب')+'</td></tr>').join('')+'</tbody></table></div>';
 const sills=(take.sills||[]).map((s,i)=>'<li>'+pick('sill',i,esc(architectureWallLabel(s.wall))+' · '+ar(s.lengthMm)+' × '+ar(s.depthMm)+' × '+ar(s.thicknessMm)+' مم')+' · '+esc(s.material)+' · '+(s.mode==='factory'?'المصنع':'المورد')+'</li>').join('');
 return strips+(sills?'<h4>جلسات أفقية مستقلة عن سطح العمل</h4><ul>'+sills+'</ul>':'');
}
export function mountWorktopUpstand(host,{getDoc,apply,tell,focus={},onAdvance}){
 const box=document.createElement('section');box.className='kw-factory';host.replaceChildren(box);
 let selected=focus.wall||'',snapshot=null,take,spec,exceptions=!!focus.wall&&!focus.windowKey&&!focus.windowId,windowEditor,seamEditor;
 const windowFocus={...focus};
 function openStrip(s){
  if(!s||!onAdvance)return;
  if(getDoc()!==snapshot){notify('تغيّر المشروع. افتح حصر الحواف الحالي.');return;}
  const edge=take.edges.find(e=>sameEdge(e,s.ref||s));
  if(!edge){notify('تخصيص هذه القطعة يتطلب حفظ معاينة الشباك أولًا.');return;}
  onAdvance('assembly',{section:'stone',wall:edge.wall,edge:{wall:edge.wall,fromMm:edge.fromMm,toMm:edge.toMm,bottomMm:edge.bottomMm}});
 }
 const notify=s=>{const status=box.querySelector('[role=status]');if(status)status.textContent=s;tell?.(s);};
 function render(){
  windowEditor?.destroy();windowEditor=null;seamEditor?.destroy();seamEditor=null;
  snapshot=getDoc();spec=cleanUpstandSpec(snapshot.room.workshop?.upstand)||fallback();
  const cat=getFactoryCatalog(snapshot);take=worktopUpstandTakeoff(snapshot,cat);
  const walls=roomArchitecture(snapshot.room).walls.map(w=>w.id).filter(w=>take.contactWalls.includes(w)||Object.hasOwn(spec.walls,w));
  if(!walls.includes(selected))selected=walls[0]||'';
  const stale=Object.keys(spec.walls).filter(w=>!walls.includes(w)),omitted=spec.omitted||[];
  const scopeForm=(s,scope)=>'<form data-strip-choice="'+scope+'">'+choiceControls(s,cat)+'<button type="submit">'+(scope==='project'?'اعتماد الاختيار للمطبخ':'تطبيق على هذا الجدار')+'</button></form>';
  const wallPick=selected?field('الحافة الملامسة للجدار','<select data-strip-wall>'+walls.map(w=>opt(w,architectureWallLabel(w),selected)).join('')+'</select>')+scopeForm(spec.walls[selected]||spec.choice,'wall')+(Object.hasOwn(spec.walls,selected)?'<button type="button" data-strip-inherit>استعادة اختيار المطبخ لهذا الجدار</button>':''):'';
  const edgeChecks=take.edges.filter(s=>s.wall===selected);
  const list=edgeChecks.length?'<fieldset><legend>الأجزاء المطلوبة على هذا الجدار</legend>'+edgeChecks.map(s=>'<label><input data-strip-edge="'+take.edges.indexOf(s)+'" type="checkbox" '+(s.omitted?'':'checked')+'> من '+ar(s.fromMm)+' إلى '+ar(s.toMm)+' مم · منسوب السطح '+ar(s.bottomMm)+' مم</label>').join('')+'</fieldset>':'';
  const retired=omitted.filter(x=>!take.edges.some(e=>sameEdge(e,x))).map(x=>'<button type="button" data-strip-reset="'+omitted.indexOf(x)+'">إلغاء استثناء '+esc(architectureWallLabel(x.wall))+' '+ar(x.fromMm)+'–'+ar(x.toMm)+' مم</button>').join('');
  const retiredWindows=(take.orphanWindows||[]).map(key=>{const [wall,id,base]=key.split('/');return '<button type="button" data-strip-orphan="'+esc(key)+'">إزالة ارتباط شباك '+esc(id)+' · '+esc(architectureWallLabel(wall))+' · '+ar(Number(base))+' مم</button>';}).join('');
  const notices=[...take.issues,...take.releaseIssues,...take.decisionIssues];
  box.innerHTML='<header><h3>نعلة رخام السطح</h3><p>الشريط القائم على الرخام عند التقائه بالجدار. يشمل اختيار العميل الحواف الخلفية والجانبية الملامسة للجدران. تظهر معالجة كل شباك بعد تحديد خامة النعلة وارتفاعها.</p></header>'+scopeForm(spec.choice,'project')+'<div data-strip-window-editor></div>'+
   '<details data-strip-exceptions'+(exceptions?' open':'')+'><summary>تخصيص جدار أو استثناء قطعة</summary>'+wallPick+list+retired+stale.map(w=>'<button type="button" data-strip-old-wall="'+esc(w)+'">إلغاء تخصيص '+esc(architectureWallLabel(w))+'</button>').join('')+'</details>'+
   retiredWindows+'<div data-strip-seams></div><h4>الحصر من الرسم</h4>'+report(take,!!onAdvance)+(notices.length?'<details><summary>بنود تنتظر قرارًا أو قياسًا ('+ar(notices.length)+')</summary><ul>'+notices.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>':'')+'<p role="status" aria-live="polite"></p>';
  seamEditor=mountStoneSeams(box.querySelector('[data-strip-seams]'),{take,snapshot,catalog:cat,getDoc,apply,tell:notify,focus:windowFocus,canSave:()=>!windowEditor?.hasDraft(),onSave:key=>{windowFocus.seamKey=key;render();}});
  const applyWindow=(doc,msg)=>seamEditor?.hasDraft()?{ok:false,reason:'احفظ تعديل وصلات النعلة أو تجاهله أولًا.'}:apply(doc,msg);
  windowEditor=mountUpstandWindowEditor(box.querySelector('[data-strip-window-editor]'),{getDoc,apply:applyWindow,tell:notify,focus:windowFocus,snapshot,catalog:cat,take,onStrip:onAdvance?openStrip:undefined,onSave:key=>{windowFocus.windowKey=key;render();}});
  if(focus.edge){const index=take.edges.findIndex(e=>sameEdge(e,focus.edge));const target=box.querySelector('[data-strip-edge="'+index+'"]');target?.focus({preventScroll:true});target?.scrollIntoView?.({block:'nearest'});}
 }
 function save(next){
  if(windowEditor?.hasDraft()||seamEditor?.hasDraft()){notify('احفظ تعديل الشباك أو الوصلات أو تجاهله أولًا.');return;}
  if(getDoc()!==snapshot){render();notify('تغير المشروع. راجع الحواف الحالية.');return;}
  const clean=cleanUpstandSpec(next);
  if(!clean){notify('اختر وصفة مصنع، أو أدخل خامة المورد وارتفاع النعلة وسماكتها بالملليمتر.');return;}
  const result=apply({...snapshot,room:{...snapshot.room,workshop:{...snapshot.room.workshop,upstand:clean}}},'حُفظ اختيار نعلة الرخام وأعيد حساب الحواف.');
  if(result?.ok===false||result?.saved===false){notify(result.reason||'تعذر حفظ اختيار النعلة.');return;}
  render();
 }
 box.onchange=e=>{
  const el=e.target;
  if(el.name==='strip-mode'){el.form.querySelectorAll('[data-strip-mode]').forEach(g=>{g.hidden=g.dataset.stripMode!==el.value;});return;}
  if(el.matches('[data-strip-wall]')){if(windowEditor?.hasDraft()||seamEditor?.hasDraft()){el.value=selected;notify('احفظ تعديل الشباك أو الوصلات أو تجاهله أولًا.');return;}selected=el.value;exceptions=true;render();}
  if(el.matches('[data-strip-edge]')){exceptions=true;const {wall,fromMm,toMm,bottomMm}=take.edges[Number(el.dataset.stripEdge)],s={wall,fromMm,toMm,bottomMm},omitted=(spec.omitted||[]).filter(x=>!sameEdge(x,s));
   if(!el.checked)omitted.push(s);save({...spec,omitted});}
 };
 box.onsubmit=e=>{
  const form=e.target;if(!form.matches('[data-strip-choice]'))return;e.preventDefault();e.stopPropagation();
  const q=readChoice(form);exceptions=form.dataset.stripChoice==='wall';
  if(exceptions)save({...spec,walls:{...spec.walls,[selected]:q}});
  else save({...spec,choice:q});
 };
 box.onclick=e=>{
  const btn=e.target.closest('button');if(!btn)return;
  if(btn.dataset.stripReport){
   const index=Number(btn.dataset.stripIndex);
   if(btn.dataset.stripReport==='segment')openStrip(take.segments[index]);
   else if(btn.dataset.stripReport==='sill'){const s=take.sills[index];if(s&&getDoc()===snapshot)onAdvance?.('assembly',{section:'stone',wall:s.wall,windowKey:s.key});}
   return;
  }
  if(btn.matches('[data-strip-orphan]')&&(take.orphanWindows||[]).includes(btn.dataset.stripOrphan)){
   const windowChoices={...spec.windowChoices};delete windowChoices[btn.dataset.stripOrphan];save({...spec,windowChoices});return;
  }
  if(btn.matches('[data-strip-reset]')){exceptions=true;save({...spec,omitted:(spec.omitted||[]).filter((_,i)=>i!==Number(btn.dataset.stripReset))});}
  if(btn.matches('[data-strip-inherit],[data-strip-old-wall]')){exceptions=true;const walls={...spec.walls};delete walls[btn.dataset.stripOldWall||selected];save({...spec,walls});}
 };
 render();
 const destroy=()=>{windowEditor?.destroy();seamEditor?.destroy();box.remove();};
 destroy.hasDraft=()=>Boolean(windowEditor?.hasDraft()||seamEditor?.hasDraft());return destroy;
}
export function mountUpstandProfiles(host,{read,update,notice}){
 const box=document.createElement('section');host.replaceChildren(box);let selected='';
 function render(){
  const cat=read(),profiles=cat.upstandProfiles||[],p=profiles.find(p=>p.id===selected),items=cat.items.filter(i=>i.kind==='panel'&&i.thicknessMm>0);
  box.innerHTML='<h4>وصفات نعلة رخام السطح</h4><p>اختر صنف لوح الرخام الفعلي من الخامات. تُؤخذ السماكة وأبعاد اللوح وعرض المنشار وسعر الشراء من صنفه. الوصفة للشرائط المستقيمة، وفي الركن القائم تتوقف إحدى القطعتين عند وجه القطعة الأخرى.</p>'+
   field('الوصفة','<select data-strip-recipe>'+opt('','وصفة جديدة',selected)+profiles.map(p=>opt(p.id,p.id+' · '+p.reference,selected)).join('')+'</select>')+
   '<form data-strip-new>'+field('رمز الوصفة','<input name="strip-id" maxlength="48" value="'+esc(p?.id)+'" pattern="[A-Za-z0-9][A-Za-z0-9_.\\-]{0,47}" '+(p?'readonly':'required')+'>')+
   field('صنف لوح الحجر','<select required name="strip-sku">'+opt('','اختر صنف الرخام',p?.sku||'')+items.map(i=>opt(i.sku,i.name+' · '+i.sku+' · '+ar(i.thicknessMm)+' مم',p?.sku)).join('')+'</select>')+
   field('ارتفاع القطعة (مم)',dim('strip-height',p?.heightMm))+field('أقل ارتفاع قص تجيزه الوصفة (مم، اختياري)',dim('strip-min',p?.minCutHeightMm))+field('مرجع وصفة المصنع','<input name="strip-ref" maxlength="160" required value="'+esc(p?.reference)+'">')+
   '<button type="submit">حفظ وصفة النعلة</button></form>'+(p?'<button type="button" data-strip-delete>حذف الوصفة</button>':'')+'<p role="status"></p>';
 }
 const tell=s=>{box.querySelector('[role=status]').textContent=s;notice?.(s);};
 box.onchange=e=>{if(e.target.matches('[data-strip-recipe]')){selected=e.target.value;render();}};
 box.onsubmit=e=>{
  if(!e.target.matches('[data-strip-new]'))return;e.preventDefault();e.stopPropagation();
  const data=new FormData(e.target),id=String(data.get('strip-id')).trim(),cat=read(),old=cat.upstandProfiles||[],p={id,sku:data.get('strip-sku'),reference:data.get('strip-ref'),heightMm:assistNumber(data.get('strip-height')),minCutHeightMm:optionalMm(data.get('strip-min'))};
  if(!selected&&old.some(q=>q.id===id)){tell('رمز وصفة النعلة مستخدم.');return;}
  const next=cleanUpstandProfiles([...old.filter(q=>q.id!==selected),p],cat.items);
  if(!next){tell('راجع الرمز ومرجع الوصفة وصنف اللوح وارتفاع القطعة مقارنةً بعرض الخام.');return;}
  if(update(c=>{c.upstandProfiles=next;})){selected=id;render();tell('حُفظت وصفة النعلة. يُتاح القص بعد اعتماد الكتالوج.');}
 };
 box.onclick=e=>{if(!e.target.closest('[data-strip-delete]'))return;
  if(update(c=>{c.upstandProfiles=(c.upstandProfiles||[]).filter(p=>p.id!==selected);})){selected='';render();tell('حُذفت الوصفة. تظهر الحواف التي تعتمد عليها للمراجعة.');}
 };
 render();return ()=>box.remove();
}
