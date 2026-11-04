import {studioIcon} from './kitchen-tool-icons.js';

function reportURL(html){
 return URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
}
// A page may name itself (data-report-name, data-report-title on its body); the customer's design report does not, and keeps its names.
const bodyData=(html,name)=>html.match(new RegExp('<body\\b[^>]*\\bdata-'+name+'="([^"]+)"','i'))?.[1];
function reportFilename(html){
 const revision=html.match(/<body\b[^>]*\bdata-design-revision="(D-[A-F0-9]{14})"/i)?.[1];
 return (bodyData(html,'report-name')||'عرض-تصميم-المطبخ')+(revision?'-'+revision:'')+'.html';
}
export function downloadCustomerReport(html){
 const url=reportURL(html),a=document.createElement('a');
 a.href=url;a.download=reportFilename(html);
 document.body?.append(a);a.click();a.remove?.();
 setTimeout(()=>URL.revokeObjectURL(url),12000);
}
export function previewCustomerReport(html,opener=document.activeElement){
 const url=reportURL(html),dialog=document.createElement('dialog'),title=(bodyData(html,'report-title')||'معاينة عرض العميل').replace(/[<>"&]/g,'');
 dialog.className='customer-preview';dialog.setAttribute('aria-label',title);
 dialog.innerHTML='<header><div class="cp-heading">'+studioIcon('drawing')+'<strong>'+title+'</strong></div><div class="cp-actions"><a data-cp-download download>'+studioIcon('download')+'حفظ HTML</a><button type="button" data-cp-print disabled>'+studioIcon('print')+'طباعة</button><button class="cp-close" type="button" data-cp-close aria-label="إغلاق المعاينة" title="إغلاق المعاينة">'+studioIcon('close')+'</button></div></header><iframe title="عرض التصميم للعميل" sandbox="allow-same-origin allow-modals"></iframe>';
 const frame=dialog.querySelector('iframe'),close=dialog.querySelector('[data-cp-close]'),print=dialog.querySelector('[data-cp-print]');
 frame.addEventListener('load',()=>{
  if(!dialog.open)return;
  const page=frame.contentDocument;
  if(!page?.body?.hasAttribute('data-design-revision'))return;
  page.documentElement.classList.add('in-preview');
  page.querySelector('.print')?.setAttribute('hidden','');
  let collapsed=[];
  frame.contentWindow.addEventListener('beforeprint',()=>{
   collapsed=[...page.querySelectorAll('details:not([open])')];collapsed.forEach(d=>d.open=true);
  });
  frame.contentWindow.addEventListener('afterprint',()=>collapsed.forEach(d=>d.open=false));
  print.disabled=false;
  page.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close();}});
 });
 close.onclick=()=>dialog.close();
 print.onclick=()=>{frame.contentWindow?.focus();frame.contentWindow?.print();};
 const download=dialog.querySelector('[data-cp-download]');download.download=reportFilename(html);download.href=url;
 dialog.addEventListener('close',()=>{
  dialog.remove();URL.revokeObjectURL(url);
  if(opener?.isConnected)opener.focus({preventScroll:true});
 },{once:true});
 // Embed the generated document directly. Embedded browsers may intercept a
 // blob navigation as a download and leave the iframe at about:blank. The blob
 // remains the download source; the same script-free sandbox hosts the preview.
 // Fragment links in srcdoc otherwise inherit the app URL and reopen the app
 // inside the frame. Keep report navigation within this embedded document.
 const embedded=html.replace(/<head(\s[^>]*)?>/i,'$&<base href="about:srcdoc">');
 document.body.append(dialog);dialog.showModal();frame.srcdoc=embedded;close.focus({preventScroll:true});
}
