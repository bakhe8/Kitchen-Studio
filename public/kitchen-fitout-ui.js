import {ensureFactoryStyles} from './kitchen-workshop-factory-ui.js';
import {mountBaseSupport} from './kitchen-base-support-ui.js';
import {mountWorktopUpstand} from './kitchen-worktop-upstand-ui.js';

// A schematic section distinguishes the floor support from the vertical stone return.
function sectionIcon(stone){
 const highlight=stone?'M33 11V6h4v11H7v-6z':'M10 33h4v6h-4z M30 33h4v6h-4z';
 return '<svg aria-hidden="true" viewBox="0 0 44 44" width="44" height="44"><path d="M6 39h33V3 M8 17h27v16H8z M33 11V6h4v11H7v-6z M10 33h4v6h-4z M30 33h4v6h-4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="'+highlight+'" fill="#c38e4b" stroke="#915b20" stroke-width="1.3"/></svg>';
}
export function mountFitout(host,args){
 ensureFactoryStyles();
 const panel=document.createElement('section');
 panel.className='kw-factory kw-fitout';
 panel.innerHTML='<header><h3>تجهيز الصف السفلي</h3><p>يتحدد ارتكاز كل دولاب من وصفة المصنع ورفع الموقع. اختَر الساتر ونعلة الرخام بحسب اتفاق العميل.</p></header><nav class="kw-actions" aria-label="تفاصيل الصف"><button type="button" data-fitout="base">'+sectionIcon(false)+'الارتكاز وساتر الأرجل</button><button type="button" data-fitout="stone">'+sectionIcon(true)+'نعلة الرخام على الجدار</button></nav><div data-fitout-editor></div><aside data-fitout-leave hidden role="alert"><p>لديك تعديل لم يُحفظ في تجهيز الصف.</p><button type="button" data-fitout-stay>متابعة التعديل</button> <button type="button" data-fitout-discard>تجاهل التعديل والانتقال</button></aside><footer class="kw-actions"><button type="button" data-route="row">عرض الصف ووحداته</button><button type="button" data-route="factory">فتح وصفات المصنع</button></footer>';
 host.replaceChildren(panel);
 const body=panel.querySelector('[data-fitout-editor]'),leave=panel.querySelector('[data-fitout-leave]'),edited=new Set();
 let clean,pending=null,pageKey='';
 const changed=e=>{if(e.target.closest('form')&&!e.target.closest('[data-window-form]'))edited.add(e.target);};
 body.addEventListener('input',changed);body.addEventListener('change',changed);
 function requestLeave(proceed){
  if(!clean?.hasDraft?.()&&![...edited].some(el=>body.contains(el)))return true;
  pending=proceed;leave.hidden=false;leave.querySelector('[data-fitout-stay]').focus();return false;
 }
 leave.onclick=e=>{
  if(e.target.hasAttribute('data-fitout-stay')){pending=null;leave.hidden=true;return;}
  if(e.target.hasAttribute('data-fitout-discard')){const go=pending;pending=null;edited.clear();leave.hidden=true;go?.();}
 };
 function commit(doc,msg){
  const saved=args.apply(doc,msg);
  if(saved?.ok!==false&&saved?.saved!==false){
   edited.clear();const go=pending;pending=null;leave.hidden=true;if(go)queueMicrotask(go);
  }
  return saved;
 }
 function show(page){
  pageKey=page;edited.clear();
  if(args.focus)args.focus.section=page;
  if(typeof clean==='function')clean();else clean?.destroy?.();
  body.replaceChildren();
  for(const btn of panel.querySelectorAll('[data-fitout]'))btn.setAttribute('aria-pressed',String(btn.dataset.fitout===page));
  clean=(page==='stone'?mountWorktopUpstand:mountBaseSupport)(body,{...args,mode:'project',apply:commit});
 }
 panel.querySelector('nav').onclick=e=>{const page=e.target.closest('button')?.dataset.fitout;if(page&&page!==pageKey&&requestLeave(()=>show(page)))show(page);};
 panel.querySelector('footer').onclick=e=>{const id=e.target.closest('button')?.dataset.route;if(id)args.onAdvance?.(id,id==='factory'?{tab:'unitBases'}:{});};
 show(args.focus?.section==='stone'?'stone':'base');
 const destroy=()=>{pending=null;if(typeof clean==='function')clean();else clean?.destroy?.();panel.remove();};
 destroy.requestLeave=requestLeave;return destroy;
}
