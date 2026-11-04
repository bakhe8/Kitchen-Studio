import {SHELF_LIMITS,sizedScreenLimits,readSizedScreen} from './shelf-model.js';
import {scopedCells,scopedDividers,targetInfo} from './shelf-selection-model.js';

const eps=1e-7,results=new WeakMap();
const num=new Intl.NumberFormat('ar',{maximumFractionDigits:3}),f=n=>num.format(n);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const sizeLabel=(w,h)=>`${f(w)} × ${f(h)} سم`;
const contains=(c,r)=>r.x>=c.x-eps && r.y>=c.y-eps && r.x+r.w<=c.x+c.w+eps && r.y+r.h<=c.y+c.h+eps;
const onlyRect=({x,y,w,h})=>({x,y,w,h});
function intersection(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),w=Math.min(a.x+a.w,b.x+b.w)-x,h=Math.min(a.y+a.h,b.y+b.h)-y;
  return w>eps&&h>eps?{x,y,w,h}:null;
}
function validSize(s){
  const {min,max}=sizedScreenLimits;
  return !!s&&[s.w,s.h].every(n=>Number.isFinite(n)&&n>=min&&n<=max);
}
const invalidSize=()=>`أدخل عرضًا وارتفاعًا بين ${f(sizedScreenLimits.min)} و${f(sizedScreenLimits.max)} سم.`;
const failure=(plan,reason)=>({ok:false,changed:false,plan,reason});
function withScreen(plan,obj){
  const p=plan.sizedObject;
  if(p&&Object.keys(obj).every(k=>obj[k]===p[k]))return {ok:true,changed:false,plan,reason:''};
  return {ok:true,changed:true,plan:{...plan,sizedObject:obj},reason:''};
}
/** Anchor the bottom centre in cabinet-relative centimetres, never to a
 * mutable row/column index. Translating the cabinet carries the screen;
 * moving a board through it or changing a cell's width never shifts/scales it. */
export function placeSizedScreen(plan,target,size){
  if(!validSize(size))return failure(plan,invalidSize());
  const key=typeof target==='string'?target:target?.kind==='cell'?target.key:null;
  const c=key&&scopedCells(plan).find(c=>c.key===key);if(!c)return failure(plan,'اختر فتحة واحدة داخل الدولاب لوضع الشاشة.');
  return withScreen(plan,{kind:'screen',w:size.w,h:size.h,centerX:c.x+c.w/2-plan.cab.x,bottomY:c.y+c.h-plan.cab.y});
}
export function resizeSizedScreen(plan,size){
  if(!plan.sizedObject)return failure(plan,'ضع الشاشة في خانة أولًا.');
  if(!validSize(size))return failure(plan,invalidSize());
  return withScreen(plan,{...plan.sizedObject,w:size.w,h:size.h});
}
export function removeSizedScreen(plan){
  if(!plan.sizedObject)return {ok:true,changed:false,plan,reason:''};
  const next={...plan};delete next.sizedObject;return {ok:true,changed:true,plan:next,reason:''};
}
export function inspectSizedScreen(plan){
  if(!plan?.sizedObject)return null;
  if(results.has(plan))return results.get(plan);
  const o=readSizedScreen(plan.sizedObject);if(!o)return null;
  const {cab:c}=plan,t=SHELF_LIMITS.frame;
  const rect={x:c.x+o.centerX-o.w/2,y:c.y+o.bottomY-o.h,w:o.w,h:o.h};
  const conflicts=[];
  function add(id,kind,label,obstacle,axis){
    const overlap=intersection(rect,obstacle);
    if(overlap)conflicts.push({id,kind,label,axis,rect:onlyRect(obstacle),overlap});
  }
  const x=c.x,y=c.y,r=x+c.w,b=y+c.h;
  add('frame:left','frame','جانب الإطار الأيسر',{x,y,w:t,h:c.h},'col');
  add('frame:right','frame','جانب الإطار الأيمن',{x:r-t,y,w:t,h:c.h},'col');
  add('frame:top','frame','أعلى الإطار',{x:x+t,y,w:c.w-2*t,h:t},'row');
  add('frame:bottom','frame','أسفل الإطار',{x:x+t,y:b-t,w:c.w-2*t,h:t},'row');
  for(const d of scopedDividers(plan)){
    if(d.kind!=='cabinet')continue; // wall planning lines are not timber
    const overlap=intersection(rect,d);if(!overlap)continue;
    const type=d.axis==='row'?'الرف الأفقي':'الفاصل الرأسي';
    const scope=d.owner.kind==='cabinet'?'الدولاب':targetInfo(plan,d.owner)?.label||'الخانة';
    conflicts.push({id:d.id,kind:'divider',axis:d.axis,label:type+' '+f(d.index+1)+' · '+scope,rect:onlyRect(d),overlap});
  }
  // Parts completely outside the cabinet are a real fit failure even if
  // the screen no longer intersects any wood after a radical cabinet resize.
  const rx=rect.x,ry=rect.y,rr=rx+rect.w,rb=ry+rect.h;
  if(rx<x-eps)add('outside:left','outside','خارج الدولاب من اليسار',{x:rx,y:ry,w:x-rx,h:rect.h},'col');
  if(rr>r+eps)add('outside:right','outside','خارج الدولاب من اليمين',{x:r,y:ry,w:rr-r,h:rect.h},'col');
  const midX=Math.max(x,rx),midW=Math.min(r,rr)-midX;
  if(midW>eps&&ry<y-eps)add('outside:top','outside','خارج الدولاب من الأعلى',{x:midX,y:ry,w:midW,h:y-ry},'row');
  if(midW>eps&&rb>b+eps)add('outside:bottom','outside','خارج الدولاب من الأسفل',{x:midX,y:b,w:midW,h:rb-b},'row');
  const opening=!conflicts.length&&scopedCells(plan).find(c=>contains(c,rect));
  const fits=!!opening,labels=conflicts.map(c=>c.label);
  const summary=fits?'تتسع الشاشة داخل الفتحة دون تداخل مع الخشب.':labels.length?'تعارض: '+labels.slice(0,3).join('؛ ')+(labels.length>3?' وغيرها.':'.'):'لا تقع الشاشة بكاملها داخل فتحة واحدة.';
  const result={kind:'screen',w:o.w,h:o.h,rect,centerX:o.centerX,bottomY:o.bottomY,fits,openingKey:opening?.key||null,conflicts,summary};
  results.set(plan,result);return result;
}

/** Wall coordinates; add AFTER cabinet wood and BEFORE interaction overlays.
 * No local clip path or auto-fit transform. Numeric SVG geometry makes the
 * exported/downloaded view stand alone, without the inspector stylesheet. */
export function renderSizedScreen(plan,{preview=false,exportMode=false}={}){
  const s=inspectSizedScreen(plan);if(!s)return '';
  const {x,y,w,h}=s.rect,edge=Math.min(w*.055,h*.075,1),round=Math.min(w,h)*.025;
  const inner={x:x+edge,y:y+edge,w:w-2*edge,h:h-2*edge};
  const text=sizeLabel(w,h),a=[`<g data-sized-screen="true" data-screen-fit="${s.fits}" data-screen-width="${w}" data-screen-height="${h}" pointer-events="none" role="img" aria-label="${esc('شاشة '+text+'. '+s.summary)}"><title>${esc('شاشة '+text+'. '+s.summary)}</title>`];
  const box=(r,attrs)=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${attrs}/>`;
  a.push(box(s.rect,`data-screen-case="" rx="${round}" fill="#17282f"`),box(inner,`rx="${round*.55}" fill="#345865"`));
  a.push(`<path d="M ${inner.x},${inner.y} h ${inner.w} v ${inner.h*.24} L ${inner.x},${inner.y+inner.h*.85} Z" fill="#56828c" opacity=".75"/>`);
  a.push(`<circle cx="${x+w*.91}" cy="${y+h-edge*.5}" r="${edge*.2}" fill="#9ed7bd"/>`);
  if(!preview||exportMode||!s.fits){
    for(const hit of s.conflicts)a.push(box(hit.overlap,`data-screen-hit="${esc(hit.id)}" fill="#e76444" fill-opacity=".72"`));
    if(!s.fits)a.push(box({x:x+edge/4,y:y+edge/4,w:w-edge/2,h:h-edge/2},`rx="${round}" fill="none" stroke="#ab3826" stroke-width="${edge/2}" stroke-dasharray="${edge*2} ${edge}"`));
  }
  const font=Math.min(3,h*.13,w/(text.length+2)*1.25);
  if(!preview&&font>.22)a.push(`<text x="${x+w/2}" y="${y+h*.62}" fill="#fff" text-anchor="middle" direction="rtl" font-family="Tahoma,Arial,sans-serif" font-size="${font}">${esc(text)}</text>`);
  a.push('</g>');return a.join('');
}

/** No implicit edits on input/change/update. The parent commits each button
 * through its usual history/persistence path. If no leaf is active, onApply
 * receives null and the parent can arm a one-click placement on the canvas. */
export function mountSizedScreenPanel(host,{onApply,onResize,onRemove}={}){
  if(!host)return {update(){},destroy(){}};
  host.classList.add('sp-sized-object');
  host.innerHTML=`<div class="sp-screen-title"><svg width="20" height="18" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2" width="20" height="13" rx="1.7"/><path d="M8 18h8m-4-3v3"/></svg><h3>شاشة بمقاس فعلي</h3></div>
    <p class="sp-screen-help">أدخل المقاس الخارجي للشاشة. يبقى حجمها ثابتًا عند تحريك الرفوف، ويظهر موضع التداخل بالأحمر.</p>
    <div class="sp-screen-fields"><label>العرض (سم)<input type="number" step="any" min="0.1" max="1200" inputmode="decimal" dir="ltr" data-screen-w value="60"></label><label>الارتفاع (سم)<input type="number" step="any" min="0.1" max="1200" inputmode="decimal" dir="ltr" data-screen-h value="35"></label></div>
    <div class="sp-screen-actions"><button type="button" data-screen-apply>اختر خانة على الرسم</button><button type="button" data-screen-resize hidden>تعديل مقاس الشاشة</button><button type="button" data-screen-remove hidden>إزالة الشاشة</button></div>
    <p class="sp-screen-error" data-screen-error role="status" hidden></p><p class="sp-screen-state" data-screen-state role="status"></p>
    <details data-screen-details hidden><summary>تفاصيل التداخل</summary><ul data-screen-conflicts></ul></details>`;
  const q=k=>host.querySelector('[data-screen-'+k+']');
  const w=q('w'),h=q('h'),apply=q('apply'),resize=q('resize'),remove=q('remove'),state=q('state'),details=q('details'),list=q('conflicts'),error=q('error');
  let chosen=null,placed=false,lastDims=null,prevDetail='';
  const note=(node,s)=>{if(node.textContent!==s)node.textContent=s;};
  const showError=s=>{error.hidden=!s;note(error,s||'');};
  function action(event){
    const button=event.target.closest('button');if(!button||!host.contains(button))return;
    if(button===remove){if(placed)onRemove?.();return;}
    if(button!==apply&&button!==resize)return;
    const size={w:w.valueAsNumber,h:h.valueAsNumber};
    if(!validSize(size)){showError(invalidSize());return;}
    showError('');
    if(button===apply)onApply?.(chosen,size);else if(placed)onResize?.(size);
  }
  const edited=()=>showError('');
  host.addEventListener('click',action);host.addEventListener('input',edited);
  function update(plan,target){
    if(!plan)return;
    const oldKey=chosen?.key,leaf=target?.kind==='cell'?targetInfo(plan,target):null;
    chosen=leaf?.leaf && leaf.content!==null?{kind:'cell',key:leaf.key}:null;
    const s=inspectSizedScreen(plan);placed=!!s;const dims=s?s.w+'|'+s.h:null;
    if(dims!==lastDims||oldKey!==chosen?.key)showError('');
    if(s&&dims!==lastDims){w.value=String(s.w);h.value=String(s.h);}
    lastDims=dims;
    note(apply,chosen?(placed?'انقل الشاشة إلى الخانة':'ضع الشاشة في الخانة'):'اختر خانة على الرسم');
    resize.hidden=!placed;remove.hidden=!placed;state.dataset.fit=s?(s.fits?'yes':'no'):'empty';
    note(state,s?sizeLabel(s.w,s.h)+' · '+s.summary:'لم توضع شاشة في التصميم.');
    const content=s?.conflicts.map(c=>c.label)||[];
    const stamp=content.join('\n');details.hidden=!content.length;
    if(stamp!==prevDetail){list.innerHTML=content.map(label=>'<li>'+esc(label)+'</li>').join('');prevDetail=stamp;}
  }
  return {update,destroy(){host.removeEventListener('click',action);host.removeEventListener('input',edited);host.replaceChildren();}};
}
