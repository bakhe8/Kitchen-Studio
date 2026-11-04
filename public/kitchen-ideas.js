import {identifiedHistoryFrame} from './kitchen-project-identity.js';
import {validateKitchen,kitchenGeometry,kitchenUnitSpecs,kitchenRoom} from './kitchen-model.js';
import {cleanStudioRoom} from './kitchen-studio-room.js';
import {scenePlan} from './kitchen-project.js';
import {kitchenFrontFinishes} from './kitchen-materials.js';
const storeKey='atlas-kitchen:ideas:v1',fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanIdea(doc){
 if(!doc?.room||!doc.kitchen)return null;const r=doc.room;
 if(![r.width,r.length,r.height].every(Number.isFinite)||r.width<60||r.length<60||r.height<60||r.width>1200||r.length>1200||r.height>600)return null;
 const room=cleanStudioRoom(r);if(!room)return null;
 const kitchen=validateKitchen(doc.kitchen,scenePlan(room));return kitchen?{room,kitchen}:null;
}
export function ideaPreview(doc){
 const r=scenePlan(doc.room),g=kitchenGeometry(doc.kitchen,r),p=pts=>pts.map(q=>q.x.toFixed(2)+','+q.z.toFixed(2)).join(' ');
 const poly=(a,col,att='')=>'<polygon points="'+p(a)+'" fill="'+col+'" '+att+'/>';
 const group=(list,col,att='')=>list.filter(u=>u.polygon?.length).map(u=>poly(u.polygon,typeof col==='string'?col:col(u),att)).join('');
 return '<svg class="kidea-thumb" aria-hidden="true" viewBox="-12 -12 '+(doc.room.width+24)+' '+(doc.room.length+24)+'" preserveAspectRatio="xMidYMid meet"><polygon points="'+p(g.architecture.polygon)+'" fill="#fcfbf3" stroke="#81907a" stroke-width="4"/>'+group(g.runs,'#e5dfcf','stroke="#aca58d" stroke-width="2"')+group(g.units.filter(u=>u.tier!=='upper'),u=>u.frontColor||kitchenFrontFinishes[u.frontFinish]?.color||'#97a68b','stroke="#687367" stroke-width="2"')+group(g.units.filter(u=>u.tier==='upper'),'#cddaca','fill-opacity=".48" stroke="#648071" stroke-dasharray="6 4" stroke-width="2"')+group(g.cutouts,u=>u.kind==='sink'?'#97bdc1':'#354546')+'</svg>';
}
export function mountKitchenIdeas(panel,{getDoc,apply,focusReturn}){
 const q=s=>panel.querySelector(s),list=q('[data-ideas-list]'),name=q('[data-idea-name]'),msg=q('[data-idea-msg]');let removed=null;
 const read=()=>{try{const a=JSON.parse(localStorage.getItem(storeKey)||'[]');return Array.isArray(a)?a.filter(v=>typeof v?.id==='string'&&typeof v.name==='string'&&v.doc?.kitchen):[];}catch{return [];}};
 function put(a){try{localStorage.setItem(storeKey,JSON.stringify(a));return true;}catch{msg.textContent='لا توجد مساحة كافية للحفظ. بقيت البدائل الموجودة محفوظة.';return false;}}
 function draw(){const items=read();list.innerHTML=items.length?items.map(it=>{const d=cleanIdea(it.doc);if(!d)return '';
  return '<article data-idea="'+esc(it.id)+'">'+ideaPreview(d)+'<div class="kidea-text"><b>'+esc(it.name)+'</b><small>'+fmt(d.kitchen.units.length)+' وحدات · '+fmt(d.room.width)+' × '+fmt(d.room.length)+' سم</small><button type="button" data-idea-open>استعمل هذا البديل</button></div><button class="kidea-remove" type="button" data-idea-remove aria-label="إزالة '+esc(it.name)+'">×</button></article>';}).join(''):'<p>لم تحفظ بدائل بعد. احفظ التصميم الحالي باسم، ثم جرّب توزيعًا آخر.</p>';q('[data-idea-recover]').hidden=!removed;}
 function close(){panel.hidden=true;focusReturn()?.focus?.({preventScroll:true});}
 q('[data-ideas-close]').addEventListener('click',close);
 q('form').addEventListener('submit',e=>{e.preventDefault();const a=read(),doc=cleanIdea(getDoc());if(!doc){msg.textContent='تعذّر حفظ التخطيط الحالي.';return;}
  if(a.length>=16){msg.textContent='احذف بديلًا لم تعد تحتاجه قبل حفظ فكرة جديدة.';return;}
  const text=name.value.trim().slice(0,60)||'فكرة '+fmt(a.length+1);const id='i'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  if(put([{id,name:text,doc},...a])){name.value='';draw();msg.textContent='حُفظ «'+text+'». تعديلاتك التالية لا تغيّر هذه النسخة.';}
 });
 list.addEventListener('click',e=>{const b=e.target.closest('button'),id=b?.closest('article')?.dataset.idea;if(!id)return;
  const a=read(),v=a.find(x=>x.id===id);if(!v)return;
  if(b.hasAttribute('data-idea-open')){const d=cleanIdea(v.doc);if(!d)return;const result=apply(identifiedHistoryFrame(d,getDoc()),'استُعيد البديل «'+v.name+'». يمكنك التراجع لاستعادة التصميم السابق.');if(result?.ok===false){msg.textContent='تعذّر تطبيق البديل: '+result.reason;return;}close();}
  if(b.hasAttribute('data-idea-remove')&&put(a.filter(x=>x.id!==id))){removed=v;draw();msg.textContent='أُزيل البديل من القائمة. التصميم على الرسم لم يتغيّر.';}
 });
 q('[data-idea-recover]').addEventListener('click',()=>{const a=read();if(removed&&!a.some(v=>v.id===removed.id)&&put([removed,...a])){removed=null;draw();msg.textContent='استُعيد البديل.';}});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 return {open(){panel.hidden=false;draw();msg.textContent='';name.focus({preventScroll:true});},close};
}
