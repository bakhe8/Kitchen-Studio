// The list of saved projects with open and delete, shown on the intake page and inside the project file panel.
// The host decides what opening means (it swaps the project and reloads); this only asks, shows the answer and keeps the list current.
import {listSavedProjects} from './kitchen-project-library.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numerals=new Intl.NumberFormat('ar-SA');
const stamp=new Intl.DateTimeFormat('ar-SA',{calendar:'gregory',day:'numeric',month:'long',hour:'numeric',minute:'2-digit',timeZone:'Asia/Riyadh'});
const facts=p=>[numerals.format(p.units)+' وحدات',numerals.format(p.surveyedWalls)+' جدران مرفوعة',p.savedAt?stamp.format(new Date(p.savedAt)):''].filter(Boolean).join(' · ');
export function mountSavedProjects(host,{exceptId=null,notice='',store,onOpen,onDelete}){
 let confirming=null,message=notice,tone='',busy=false;
 host.classList?.add('saved-projects');host.setAttribute?.('aria-label','المشاريع المحفوظة');
 function draw(){
  const items=listSavedProjects({store,exceptId});
  host.hidden=!items.length&&!message;
  if(host.hidden){host.innerHTML='';return;}
  host.innerHTML=(items.length?'<h3>مشاريعي المحفوظة <b>'+numerals.format(items.length)+'</b></h3>':'')+
   (items.length?'<ul>'+items.map(p=>{
    const name=esc(p.name),sure=confirming===p.id;
    return '<li data-saved-id="'+esc(p.id)+'"><div class="sp-info"><strong>'+name+'</strong><small>'+esc(facts(p))+'</small>'+(sure?'<small class="sp-warn">يُحذف هذا المشروع نهائيًا من هذا المتصفح.</small>':'')+'</div>'+
     '<div class="sp-actions">'+(sure?
      '<button type="button" data-saved-delete-confirm="'+esc(p.id)+'" aria-label="تأكيد حذف مشروع '+name+'">تأكيد الحذف</button><button type="button" data-saved-cancel>إلغاء</button>':
      '<button type="button" data-saved-open="'+esc(p.id)+'" aria-label="فتح مشروع '+name+'"'+(busy?' disabled':'')+'>فتح</button><button type="button" data-saved-delete="'+esc(p.id)+'" aria-label="حذف مشروع '+name+'"'+(busy?' disabled':'')+'>حذف</button>')+'</div></li>';
   }).join('')+'</ul>':'')+
   '<p class="sp-note" role="status" data-tone="'+tone+'">'+esc(message)+'</p>';
 }
 function say(text,kind=''){message=text;tone=kind;}
 host.onclick=event=>{
  const button=event.target.closest?.('button');if(!button||!host.contains(button)||busy)return;
  const open=button.dataset.savedOpen,ask=button.dataset.savedDelete,sure=button.dataset.savedDeleteConfirm;
  if(open){
   busy=true;say('جارٍ فتح المشروع…');draw();
   const result=onOpen(open);
   if(result?.ok===false){busy=false;say(result.reason||'تعذّر فتح المشروع.','error');draw();}
   return;
  }
  if(ask){confirming=ask;say('');draw();host.querySelector('[data-saved-delete-confirm]')?.focus();return;}
  if(sure){
   const result=onDelete(sure);confirming=null;
   say(result?.ok===false?(result.reason||'تعذّر الحذف.'):'حُذف المشروع المحفوظ.',result?.ok===false?'error':'');draw();return;
  }
  if(button.hasAttribute('data-saved-cancel')){confirming=null;say('');draw();}
 };
 draw();
 return {refresh:draw,destroy(){host.onclick=null;}};
}
