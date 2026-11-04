// Source: each product's Saudi Arabic IKEA page, under «قياسات». Depth here
// is explicitly WITHOUT suspension rail, not the rounded system depth in H1.
import {addRun,addUnit,availableKitchenSlots,kitchenRoom} from './kitchen-model.js';
import {roomArchitecture,architectureWall,architectureWallLabel} from './kitchen-architecture.js';

const source=(code,tier,width,depth,height,rail,system)=>Object.freeze({article:code,tier,width,depth,height,rail,system,
  url:'https://www.ikea.com/sa/ar/p/metod-'+(tier==='base'?'base':'wall')+'-cabinet-white-'+code.replaceAll('.','')+'/'});
export const supplierFrames=Object.freeze([
  source('502.056.26','base',60,59,80,60,60),
  source('802.134.32','base',40,59,80,60,60),
  source('702.055.31','upper',40,36.6,80,37.6,37),
  source('802.055.40','upper',80,36.6,40,37.6,37)
]);
const byCode=code=>supplierFrames.find(s=>s.article===code);
const name=s=>s.tier==='base'?'هيكل خزانة قاعدة':'هيكل خزانة حائط';
const number=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}),f=n=>number.format(n);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-6;
const compatible=(r,s)=>!!r&&r.tier===s.tier&&same(r.height,s.height)&&same(r.depth,s.depth);
const dimensions=s=>[s.width,s.depth,s.height].map(f).join(' × ')+' سم';
const defaultBottom=(s,R)=>s.tier==='base'?0:Math.max(0,Math.min(145,R.height-s.height));
const fail=(k,reason)=>({ok:false,changed:false,kitchen:k,reason});
function independentId(k,s){
 const ids=new Set([...k.runs,...k.units,...k.features].map(v=>v.id)),stem='metod-'+s.article.replaceAll('.','')+'-';let i=1;
 while(ids.has(stem+i))i++;return stem+i;
}
function unitData(s,runId){return {kind:'open-shelf',runId,width:s.width,interior:{shelves:0,dividers:0},frontFinish:'ivory'};}

/** No caller mutation. A rejected second step also drops the temporary row.
 * The caller commits the returned kitchen once, so Undo restores both items. */
export function prepareSupplierPlacement(k,room,article,where){
 const s=byCode(article);if(!k||!s||!where)return fail(k,'اختر مرجعًا ووجهة للإدراج.');
 if(!Number.isFinite(where.u)||where.u<0)return fail(k,'أدخل بداية غير سالبة بالسنتيمتر.');
 let base=k,runId=where.runId,created=false;
 if(where.mode==='new'){
   if(!architectureWall(room,where.wall)||!Number.isFinite(where.bottom)||where.bottom<0)return fail(k,'حدّد الجدار وارتفاع قاعدة الهيكل عن الأرض.');
   const run=addRun(k,room,{wall:where.wall,tier:s.tier,start:where.u,end:where.u+s.width,depth:s.depth,height:s.height,bottom:where.bottom});
   if(!run.ok)return fail(k,run.reason);
   const actual=run.kitchen.runs.find(v=>v.id===run.id);
   if(!actual||!compatible(actual,s)||!same(actual.start,where.u)||!same(actual.end,where.u+s.width))
     return fail(k,'الركن أو الصف المجاور لا يسمح بمقاس الإطار كاملًا في هذا الموضع.');
   base=run.kitchen;runId=run.id;created=true;
 }else if(where.mode==='existing'){
   if(!compatible(k.runs.find(v=>v.id===runId),s))return fail(k,'يلزم صف من النوع نفسه يطابق عمق الهيكل وارتفاعه بالضبط.');
 }else return fail(k,'اختر صفًا قائمًا أو صفًا جديدًا.');
 const out=addUnit(base,room,{...unitData(s,runId),id:independentId(k,s),u:where.u});
 if(!out.ok)return fail(k,out.reason);
 return {...out,runId,created};
}
function runName(run){return (run.wall?architectureWallLabel(run.wall):'جزيرة')+' · '+f(run.start)+'–'+f(run.end)+' سم';}
function suggested(k,r,s){
 for(const run of k.runs.filter(v=>compatible(v,s))){
   // Some legacy rows have an occupied first coordinate. Check dimensional
   // gap edges as well, but accept only a full physical placement.
   const coords=new Set([run.start,...k.units.filter(u=>u.runId===run.id).map(u=>u.u+u.width),...availableKitchenSlots(k,r,unitData(s,run.id)).map(v=>v.start)]);
   for(const u of [...coords].sort((a,b)=>a-b)){
     const where={mode:'existing',runId:run.id,u};
     if(prepareSupplierPlacement(k,r,s.article,where).ok)return where;
   }
 }
 const R=kitchenRoom(r),bottom=defaultBottom(s,R);
 for(const {id:wall,start,end:L} of roomArchitecture(r).walls){
   const coords=new Set([start,L-s.width,...k.runs.filter(v=>v.wall===wall).flatMap(v=>[v.end,v.start-s.width]),...k.features.filter(v=>v.wall===wall).flatMap(v=>[v.u+v.width,v.u-s.width])]);
   for(const u of [...coords].filter(u=>u>=start-.00001&&u+s.width<=L+.00001).sort((a,b)=>a-b)){
     const where={mode:'new',wall,u,bottom};if(prepareSupplierPlacement(k,r,s.article,where).ok)return where;
   }
 }
 return {mode:'new',wall:'back',u:architectureWall(r,'back').start,bottom};
}
const options=(list,val)=>list.map(([v,t])=>'<option value="'+esc(v)+'" '+(v===val?'selected':'')+'>'+esc(t)+'</option>').join('');
function drawing(s){
 const scale=Math.min(52/s.width,57/s.height),W=s.width*scale,H=s.height*scale,D=s.depth*scale*.29;
 const x=(100-W-D)/2,y=(80-H+D*.4)/2,t=2.3;
 // Original empty-envelope sketch; not a manufacturer photograph or shop drawing.
 return '<svg viewBox="0 0 100 80" aria-hidden="true" fill="none" stroke="#677c71" stroke-width=".9"><ellipse cx="50" cy="'+(y+H+2)+'" rx="'+(W/2+D*.7)+'" ry="3" fill="#dce1d3" stroke="none"/><path d="M'+x+' '+y+'l'+D+' '+(-D*.45)+'h'+W+'l-'+D+' '+D*.45+'z" fill="#f2f1e6"/><path d="M'+(x+W)+' '+y+'l'+D+' '+(-D*.45)+'v'+H+'l-'+D+' '+D*.45+'z" fill="#c8d0c2"/><path d="M'+x+' '+y+'h'+W+'v'+H+'H'+x+'z" fill="#f7f6eb"/><path d="M'+(x+t)+' '+(y+t)+'h'+(W-2*t)+'v'+(H-2*t)+'H'+(x+t)+'z" fill="#dfe5d9"/><path d="m'+(x+t)+' '+(y+H-t)+' '+(D*.7)+' '+(-D*.34)+'v-'+(H-2*t-D*.34)+'m0 '+(H-2*t-D*.34)+'h'+(W-2*t-D*.7)+'" stroke="#a0b09e"/></svg>';
}
const sourceLink=s=>'<a href="'+s.url+'" target="_blank" rel="noopener noreferrer">صفحة المنتج على إيكيا السعودية ↗</a>';
export function mountSupplierReferences(el,{getDoc,getKit,apply,tell,focusReturn}={}){
 if(!el||!getDoc||!apply)throw new TypeError('Supplier references need a host and document controller');
 const d=el.ownerDocument,ac=new AbortController(),cssURL=new URL('./kitchen-supplier.css',import.meta.url).href;
 if(![...d.querySelectorAll('link[rel="stylesheet"]')].some(l=>l.href===cssURL)){
   const link=d.createElement('link');link.rel='stylesheet';link.href=cssURL;d.head.append(link);
 }
 const box=d.createElement('aside');box.id='k-supplier-panel';box.className='pro-drawer ksup';box.setAttribute('role','dialog');box.setAttribute('aria-labelledby','ksup-heading');box.hidden=true;
 box.innerHTML='<header class="pr-head"><span id="ksup-heading"><i></i>مراجع المصنّع</span><button type="button" data-sup-action="close" aria-label="إغلاق مراجع المصنّع">×</button></header><div class="pr-inner ksup-inner"></div>';
 el.append(box);const body=box.querySelector('.ksup-inner'),q=s=>box.querySelector(s);
 let code=null,where=null,opener=null;
 const listen=(event,fn)=>box.addEventListener(event,fn,{signal:ac.signal});
 const value=n=>{const i=q('[name="'+n+'"]');return i&&i.value.trim()!==''?i.valueAsNumber:NaN;};
 function restore(){if(typeof focusReturn==='function'){const target=focusReturn();target?.focus?.({preventScroll:true});}else (focusReturn||opener)?.focus?.({preventScroll:true});}
 function close(returnFocus=true){if(box.hidden)return;box.hidden=true;code=null;where=null;if(returnFocus)restore();}
 function open(trigger){opener=trigger?.focus?trigger:d.activeElement;code=null;where=null;box.hidden=false;render();q('[data-sup-action="close"]').focus({preventScroll:true});}
 function render(){
  if(box.hidden)return;
  const doc=getDoc(),s=byCode(code);if(!s){
    body.innerHTML='<p class="ksup-kicker">IKEA السعودية · METOD</p><h2>هياكل بمقاسات منشورة</h2><p>الأبعاد أدناه للهيكل وحده، دون ماسورة التعليق. ينشئ الاستوديو إطارًا مفتوحًا بهذه الأبعاد.</p><div class="ksup-grid">'+supplierFrames.map(x=>'<article>'+drawing(x)+'<div><h3>'+name(x)+'</h3><b dir="ltr">'+dimensions(x).replace(' سم','')+'</b> سم<p>عرض × عمق × ارتفاع</p><bdi class="ksup-number">'+x.article+'</bdi><div class="ksup-links"><button type="button" data-sup-pick="'+x.article+'">اختر الموضع</button>'+sourceLink(x)+'</div></div></article>').join('')+'</div>';
    return;
  }
  const matches=doc.kitchen.runs.filter(run=>compatible(run,s)),R=kitchenRoom(doc.room);
  body.innerHTML='<button type="button" data-sup-action="back" class="ksup-back">عودة إلى المراجع</button><p class="ksup-kicker">METOD · '+name(s)+'</p><h2><bdi>'+dimensions(s)+'</bdi></h2><p class="ksup-number">رقم المنتج <bdi>'+s.article+'</bdi></p>'+sourceLink(s)+
  '<p>عمق الهيكل المستخدم <b>'+f(s.depth)+' سم</b>. عمق النظام '+f(s.system)+' سم، ومع ماسورة التعليق '+f(s.rail)+' سم. لا يضيف النموذج الماسورة أو واجهة للهيكل.</p>'+
  '<form data-sup-form><label>الوجهة<select name="dest">'+options([...(matches.map(run=>[run.id,'صف مطابق · '+runName(run)])),['new','إنشاء صف خاص بهذا الإطار']],where.mode==='new'?'new':where.runId)+'</select></label>'+
  (where.mode==='new'?'<label>الجدار<select name="wall">'+options(roomArchitecture(doc.room).walls.map(w=>[w.id,w.label]),where.wall)+'</select></label>':'')+
  '<div class="ksup-fields"><label>بداية الهيكل (سم)<input type="number" name="u" required step="any" min="0" value="'+(Number.isFinite(where.u)?where.u:'')+'"></label>'+
  (where.mode==='new'?'<label>عن الأرض (سم)<input type="number" name="bottom" required min="0" max="'+R.height+'" step="any" value="'+(Number.isFinite(where.bottom)?where.bottom:'')+'"></label>':'')+'</div>'+
  '<p class="ksup-help">تُقاس البداية من مرجع الجدار أو بداية الجزيرة. عند اقتطاع ركن يبقى مرجع الجدار المستقيم في مكانه. منسوب التركيب من اختيارك.</p>'+
  '<div class="ksup-result" data-sup-result role="status"></div><button type="submit" class="ksup-submit">أضف الإطار إلى التصميم</button></form>'+
  '<p class="ksup-fine">التمثيل حجمي قابل للتحرير؛ تفاصيل الألواح والتثبيت من وثائق المصنّع. قد يظهر سطح العمل الذي يحسبه الاستوديو مستقلًا فوق الصف السفلي.</p>';
  preview();
 }
 function read(){
  if(!where)return;where={...where,u:value('u')};
  if(where.mode==='new')where={...where,wall:q('[name="wall"]').value,bottom:value('bottom')};
 }
 function checked(){const doc=getDoc();return prepareSupplierPlacement(doc.kitchen,doc.room,code,where);}
 function preview(){if(!code||!where)return;const result=checked(),desk=q('[data-sup-result]'),btn=q('.ksup-submit');btn.disabled=!result.ok;desk.dataset.valid=String(result.ok);
  desk.textContent=result.ok?(where.mode==='new'?'يتّسع الموضع للصف والإطار. يُضافان معًا بخطوة واحدة.':'تطابق أبعاد الصف، والموضع متاح للهيكل.'):(result.reason||'الموضع لا يتّسع للإطار.');
 }
 listen('click',e=>{const b=e.target.closest?.('button');if(!b||!box.contains(b))return;
  if(b.dataset.supAction==='close'){close();return;}
  if(b.dataset.supAction==='back'){const old=code;code=null;where=null;render();q('[data-sup-pick="'+old+'"]')?.focus();return;}
  if(b.dataset.supPick&&byCode(b.dataset.supPick)){code=b.dataset.supPick;const doc=getDoc();where=suggested(doc.kitchen,doc.room,byCode(code));render();q('[name="dest"]')?.focus();}
 });
 listen('change',e=>{if(!where)return;const t=e.target;
  if(t.name==='dest'){const R=getDoc().room,s=byCode(code),k=getDoc().kitchen;
   if(t.value==='new'){where={mode:'new',wall:'back',u:architectureWall(R,'back').start,bottom:defaultBottom(s,kitchenRoom(R))};}
   else {const r=k.runs.find(x=>x.id===t.value);if(!r)return;const allowed=availableKitchenSlots(k,R,unitData(s,r.id));where={mode:'existing',runId:r.id,u:allowed[0]?.start??r.start};}
   render();q('[name="dest"]').focus();return;
  }
  read();preview();
 });
 listen('input',e=>{if(where&&e.target.matches('input')){read();preview();}});
 listen('submit',e=>{if(!e.target.matches('[data-sup-form]'))return;e.preventDefault();read();const doc=getDoc(),r=prepareSupplierPlacement(doc.kitchen,doc.room,code,where);
   if(!r.ok){preview();tell?.('لم يُدرج الإطار: '+r.reason);return;}
   const msg='أُدرج إطار مفتوح بمقاس METOD '+code+' · '+dimensions(byCode(code))+'.';
   const commit=apply({...doc,kitchen:r.kitchen},msg);if(commit?.ok===false||commit?.changed===false){preview();return;}
   close(false);getKit?.()?.inspectItem?.('unit',r.id);tell?.(msg);
 });
 listen('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 return {open,close,destroy(){ac.abort();box.remove();}};
}
