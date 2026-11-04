import {surveyNotebookSummary} from './kitchen-survey-notebook-model.js';
import {studioIcon} from './kitchen-tool-icons.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const mm=value=>Number.isFinite(value)?number.format(value)+' مم':'—';
const action=(act,text,attrs='')=>`<button type="button" data-chain-act="${act}" ${attrs}>${text}</button>`;

// Rehouse the real survey controls. Their controllers, identities, validation,
// pending values and delegated events remain owned by mountChainStep/wall ink.
export function arrangeSurveyNotebook(host){
 const root=host.querySelector('.sv');if(!root||root.classList.contains('sv-walk-review'))return;
 root.classList.add('sv-notebook');
 const doc=root.ownerDocument,make=(tag,cls,html='')=>{const node=doc.createElement(tag);node.className=cls;node.innerHTML=html;return node;};
 const head=make('header','sv-notebook-head','<div><small>رفع الموقع · القياسات بالملليمتر</small><h2>دفتر الموقع</h2><p data-notebook-project></p></div><div class="sv-notebook-history">'+
  action('notebook-undo',studioIcon('undo')+'<span>تراجع</span>','aria-label="تراجع عن آخر تغيير محفوظ في المشروع"')+
  action('notebook-redo',studioIcon('next')+'<span>إعادة</span>','aria-label="إعادة آخر تغيير في المشروع"')+'<span data-notebook-history-hint></span></div>');
 root.prepend(head);
 const work=root.querySelector('.sv-work'),rail=make('aside','sv-notebook-objects','<h3>جدران الموقع</h3><div data-notebook-walls></div>');
 rail.setAttribute('aria-label','الجدران والقراءات');
 const map=root.querySelector('[data-chain-map]');if(map)rail.append(map);
 rail.append(make('h3','','قراءات هذا الجدار'));
 const readings=root.querySelector('.sv-reading-tray');if(readings)rail.append(readings);
 rail.append(make('p','sv-notebook-empty','<span data-notebook-empty></span>'));
 const inspector=make('aside','sv-notebook-inspector');inspector.setAttribute('aria-label','القياسات ومراجعة الجدار');
 const aside=root.querySelector('.sv-ink-aside'),form=root.querySelector('.sv-form');
 if(aside)inspector.append(aside);if(form)inspector.append(form);
 const inkEditor=inspector.querySelector('.sv-ink-editor');
 if(inkEditor?.querySelector('[data-ink-value]'))inkEditor.append(make('small','sv-notebook-precision-hint','للدقة: ↑↓ يغيّر ١ مم، ومع Shift يغيّر ١٠ مم. اسحب عنوان القياس للتعديل؛ ومع Shift تكون الخطوة ٠٫١ مم.'));
 inspector.append(make('section','sv-notebook-review','<h3>مراجعة الجدار</h3><p data-notebook-state role="status" aria-live="polite"></p><dl><div><dt>مصدر القياسات</dt><dd data-notebook-source></dd></div><div><dt>إغلاق القياسات المطبّقة</dt><dd data-notebook-closure></dd></div></dl><p data-notebook-recovery></p>'+action('proof','مراجعة وتأكيد الجدار','aria-expanded="false"')+'<small>التأكيد يسجّل اسم الفني ومرجع الزيارة مع القياسات الحالية.</small>'));
 work.prepend(rail);work.append(inspector);
 const desk=root.querySelector('.sv-paper-desk');
 if(desk)desk.append(make('div','sv-notebook-hud','<span data-notebook-selection></span>'+action('notebook-focus','القياسات')+'<button type="button" data-ink-action="confirm" data-notebook-apply>تطبيق</button><button type="button" data-ink-action="cancel">إلغاء</button>'));
 const save=root.querySelector('[data-chain-act="save"]');if(save)save.insertAdjacentHTML('beforeend','<span>حفظ الرفع</span>');
}

export function syncSurveyNotebook(host,{doc,wall,walls,chain,chains,dirty,pending,pendingWork,canHistory,proof,selection}){
 const root=host.querySelector('.sv-notebook');if(!root)return;
 const state=surveyNotebookSummary(doc,wall,chain,{dirty:dirty.has(wall),pending});
 const text=(selector,value)=>{const node=root.querySelector(selector);if(node&&node.textContent!==value)node.textContent=value;};
 text('[data-notebook-project]',state.projectName||doc.room.name||'مشروع المطبخ');
 root.dataset.projectId=state.projectId;root.dataset.wallId=wall;
 root.dataset.notebookStatus=pending?'pending':!state.valid?'invalid':dirty.has(wall)?'dirty':state.proofValid?'confirmed':chain?.attestation||chain?.source==='field'?'review':state.readingCount?'saved':'empty';
 text('[data-notebook-state]',state.status);
 text('[data-notebook-source]',state.sourceLabel);
 text('[data-notebook-closure]',!state.readingCount?'لم يُقَس الركن بعد':!state.valid?state.error:state.closed?'قياس الركن مطابق':`المتبقي المحسوب ${mm(state.remainingMm)} · لم يُقَس الركن`);
 text('[data-notebook-recovery]',pending?'معاينة القياس لم تُطبّق بعد. تطبيق القياس يضيفه إلى مسودة الجدار؛ حفظ الرفع يحفظه في المشروع.':dirty.size?'قياسات لم تُحفظ في المشروع بعد. حفظ الرفع يتحقق من القياسات ويحفظها في المشروع.':'الحفظ والتأكيد مرتبطان بهذا المشروع وهذا الجدار.');
 text('[data-notebook-empty]',state.readingCount?'':'المس الرسم أو اختر أداة لإضافة أول قياس. يمكنك أيضًا استخدام إدخال بالأرقام.');
 text('[data-notebook-history-hint]',pendingWork?'أكمل القياس واحفظ الرفع قبل تراجع المشروع.':'سجل التغييرات المحفوظة في المشروع');
 for(const [act,forward] of [['notebook-undo',false],['notebook-redo',true]]){
  const button=root.querySelector(`[data-chain-act="${act}"]`);
  button.disabled=pendingWork||!canHistory?.(forward);
  button.title=pendingWork?'أكمل القياس واحفظ الرفع أو ألغِ التعديل أولًا':forward?'إعادة تغيير محفوظ':'تراجع عن تغيير محفوظ';
 }
 for(const button of root.querySelectorAll('[data-chain-act="proof"]'))button.setAttribute('aria-expanded',String(proof));
 const list=root.querySelector('[data-notebook-walls]');
 // Stable buttons keep keyboard focus during live updates.
 if(!list.children.length)list.innerHTML=walls.map((w,i)=>`<button type="button" class="sv-notebook-wall" data-survey-wall-id="${esc(w.id)}"><i>${number.format(i+1)}</i><span><strong>${esc(w.label)}</strong><small data-notebook-wall-detail></small></span><span data-notebook-wall-state></span></button>`).join('');
 for(const button of list.children){
  const id=button.dataset.surveyWallId,s=surveyNotebookSummary(doc,id,chains.get(id)||doc.room.workshop?.chains?.[id],{dirty:dirty.has(id),pending:id===wall&&pending});
  button.setAttribute('aria-pressed',String(id===wall));
  button.dataset.state=s.proofValid?'confirmed':dirty.has(id)?'dirty':'saved';
  button.querySelector('[data-notebook-wall-detail]').textContent=mm(s.lengthMm)+' · '+number.format(s.readingCount)+' قياس';
  button.querySelector('[data-notebook-wall-state]').textContent=id===wall&&pending?'قيد التعديل':dirty.has(id)?'مسودة':s.proofValid?'موثّق':s.readingCount?'محفوظ':'لم يُرفع';
 }
 const hud=root.querySelector('.sv-notebook-hud'),editor=root.querySelector('.sv-ink-editor');
 if(!hud)return;
 hud.hidden=!editor;if(!editor)return;
 text('[data-notebook-selection]',editor.querySelector('.sv-ink-title strong,.sv-ink-title b,.sv-ink-title .sv-ink-kinds [aria-pressed="true"]')?.textContent||(editor.classList.contains('sv-ink-existing')?selection:'')||'قياس على الجدار');
 hud.querySelector('[data-notebook-apply]').hidden=!pending||!editor.querySelector('[data-ink-action="confirm"]');
 // Anchor beside the selected object, clamped inside its drawing desk. Numeric
 // controls remain in the inspector so a small drawing never hides a field.
 const desk=hud.parentElement,box=desk.getBoundingClientRect();
 const anchor=root.querySelector('[data-ink-preview]')||root.querySelector('.wsheet-current');
 const item=anchor?.getBoundingClientRect();
 const x=item?item.left+item.width/2-box.left:box.width/2;
 const y=item?item.bottom-box.top+12:box.height-60;
 hud.style.left=Math.max(8,Math.min(box.width-hud.offsetWidth-8,x-hud.offsetWidth/2))+'px';
 hud.style.top=Math.max(56,Math.min(box.height-hud.offsetHeight-8,y))+'px';
}
