import {roomArchitecture} from './kitchen-architecture.js';
import {surveyNotebookSummary} from './kitchen-survey-notebook-model.js';
import {proposalNumber as n,escapeProposalText as esc,wallFacts} from './kitchen-proposal-presentation.js';
import {studioIcon} from './kitchen-tool-icons.js';

const button=(action,label,extra='')=>'<button type="button" data-wp="'+action+'" '+extra+'>'+label+'</button>';

// A presentation of the actual proposal controller, never a second project or draft.
export function decorateDesignerStudio(host,{doc,units,selected,face,measured,applied,persisted,canUndo,canRedo,redoDraft,editable,sheet}){
 const root=host.querySelector('.proposal-studio'),dom=host.ownerDocument;
 if(!root?.classList||!dom?.createElement)return;
 root.classList.add('designer-studio');
 const walls=roomArchitecture(doc.room).walls,unit=units.find(u=>u.id===selected);
 const wall=walls.find(w=>w.id===unit?.wall)||walls.find(w=>w.id===face)||walls.find(w=>measured.includes(w.id))||walls[0];
 const header=dom.createElement('header');header.className='ds-header';
 header.innerHTML='<div><p class="ds-eyebrow">المصمم / توزيع الوحدات</p><h2>مساحة التصميم</h2><p>'+esc(doc.room.name||'المشروع الحالي')+' · من قياسات دفتر الموقع</p></div><div class="ds-history" role="group" aria-label="سجل التصميم">'+
  button('design-undo',studioIcon('undo')+'<span>تراجع</span>','aria-label="تراجع عن '+(applied?'آخر تغيير محفوظ':'آخر تعديل في المسودة')+'" '+(canUndo?'':'disabled'))+
  button('design-redo',studioIcon('redo')+'<span>إعادة</span>','aria-label="إعادة '+(applied&&!redoDraft?'التغيير المحفوظ':'تعديل المسودة')+'" '+(canRedo?'':'disabled'))+
  '<small>'+(applied?(persisted?(redoDraft?'محفوظ · إعادة تعديل المسودة متاحة':'سجل المشروع المحفوظ'):'الحفظ يحتاج إعادة المحاولة'):'سجل مسودة التوزيع')+'</small></div>';
 root.prepend(header);
 const layout=root.querySelector('.pd-layout'),rail=dom.createElement('aside');rail.className='ds-objects';rail.setAttribute('aria-label','جدران المشروع ووحداته');
 rail.innerHTML='<div class="ds-rail-title"><small>من الموقع إلى التصميم</small><h3>الجدران والوحدات</h3></div><div data-ds-walls>'+walls.map(w=>button('ds-wall','<span>'+esc(w.label)+'</span><small>'+n(w.length*10)+' مم · '+(measured.includes(w.id)?'مكتمل الرفع':'رفع غير مكتمل')+'</small>','data-wall="'+esc(w.id)+'" aria-pressed="'+(wall?.id===w.id)+'"')).join('')+'</div><div class="ds-unit-heading"><h3>وحدات التوزيع</h3><b>'+n(units.length)+'</b></div><div data-ds-units>'+
  (units.length?units.slice().sort((a,b)=>String(a.wall).localeCompare(String(b.wall))||a.tier.localeCompare(b.tier)||a.startMm-b.startMm).map(u=>button('ds-unit','<bdi>'+esc(u.code)+'</bdi><span>'+esc(u.label)+'<small>'+n(u.widthMm)+' مم · '+(u.tier==='upper'?'علوي':'سفلي')+(units.some(v=>v.wall!==u.wall)?' · '+esc(walls.find(w=>w.id===u.wall)?.label||'جزيرة'):'')+'</small></span>','data-unit="'+esc(u.id)+'" aria-pressed="'+(selected===u.id)+'"')).join(''):'<p class="ds-empty">أكمل جدران التفصيل في دفتر الموقع، ثم ولّد توزيعًا لبدء العمل.</p>')+'</div>';
 layout.prepend(rail);
 let side=root.querySelector('.pd-side');if(!side){side=dom.createElement('aside');side.className='pd-side';layout.append(side);}
 if(!side.firstElementChild)side.innerHTML='<section class="ds-guide"><small>ابدأ من الوحدة</small><h3>المقاس في مكانه</h3><p>اختر وحدة من الرسم أو القائمة. اسحب حافتها لتغيير العرض أو مقبض الوسط لإعادة ترتيب الصف.</p><p>المعاينة تسبق التطبيق؛ زر حفظ التوزيع يكتب المشروع.</p></section>';
 const summary=wall&&surveyNotebookSummary(doc,wall.id),basis=dom.createElement('section');basis.className='ds-basis';
 if(summary)basis.innerHTML='<small>'+(unit&&!unit.wall?'الجزيرة · مرجع قياسات الغرفة':'أساس التوزيع')+'</small><h3>'+esc(wall.label)+'</h3><strong>'+n(summary.lengthMm)+' <small>مم</small></strong><p>'+esc(summary.status)+'</p>'+wallFacts(doc,[wall.id]).map(f=>'<p>'+esc(f.detail)+'</p>').join('')+button('ds-source','فتح قياسات دفتر الموقع','data-wall="'+esc(wall.id)+'"');
 side.append(basis);
 const canvas=root.querySelector('[data-wp-canvas]'),wrap=dom.createElement('div');wrap.className='ds-canvas-wrap';canvas.before(wrap);wrap.append(canvas);
 if(unit&&editable&&!sheet){const hud=dom.createElement('div');hud.className='ds-hud';hud.setAttribute('role','group');hud.setAttribute('aria-label','أدوات الوحدة المحددة');
  hud.innerHTML='<div class="ds-hud-heading"><bdi>'+esc(unit.code)+'</bdi><strong>'+esc(unit.label)+'</strong><span>'+n(unit.widthMm)+' مم</span></div><div class="ds-hud-tools">'+
   (unit.resizable?button('focus-width','المقاس الدقيق'):'')+(unit.movable?button('move-before','قبل السابقة')+button('move-after','بعد التالية'):'<span class="ds-locked">موضع ثابت</span>')+
   button('cancel-width','إلغاء المعاينة','hidden data-ds-cancel')+'</div>';wrap.append(hud);}
}

export function positionDesignerHud(host){
 const hud=host.querySelector('.ds-hud'),canvas=host.querySelector('[data-wp-canvas]');
 if(!hud?.style||!canvas?.getBoundingClientRect)return;
 const marker=canvas.querySelector('[data-wp-grip="move"]')||canvas.querySelector('[data-wp-grip]')||canvas.querySelector('.pd-selected-shape');
 if(!marker)return;
 const a=marker.getBoundingClientRect(),b=canvas.getBoundingClientRect();
 // Clamp to the canvas. HUD is a sibling of the replaced SVG, so input focus survives previews.
 const width=hud.offsetWidth||280,height=hud.offsetHeight||85;
 hud.style.left=Math.max(8,Math.min(b.width-width-8,a.x+a.width/2-b.x-width/2))+'px';
 hud.style.top=Math.max(8,Math.min(b.height-height-8,a.y-b.y-height-22))+'px';
}
