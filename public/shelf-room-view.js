// Room camera and inspection live outside the design history. Only the named
// attachment action requests a change to the plan; picking never moves it.
import {renderShelfRoom} from './shelf-room-render.js';
import {getRoom,roomWallIds,roomFaceLabels,roomWallSize,attachCabinet} from './shelf-room-model.js';

const ns='http://www.w3.org/2000/svg',num=new Intl.NumberFormat('ar',{maximumFractionDigits:1});
const home=Object.freeze({yaw:32,pitch:24});
const wrap=x=>(x%360+360)%360,clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const faces=[...roomWallIds,'floor','ceiling'],wallId=id=>roomWallIds.includes(id);
const faceName=id=>roomFaceLabels[id]||'سطح الغرفة';
const dim=(w,h)=>num.format(w)+' × '+num.format(h)+' سم';
const icons={
 cut:'<path d="m3 8.5 9-5 9 5-9 5z" stroke-dasharray="2 2"/><path d="M3 9v7l9 5 9-5V9M12 21v-7"/>',
 shell:'<path d="m3 7.5 9-5 9 5v9l-9 5-9-5zM3 7.5l9 5 9-5m-9 5v9"/>',
 home:'<path d="M4.5 9a8 8 0 1 1-.1 6m.1-10v4.5H9"/>',
 edit:'<path d="M5 19V5h14v14Zm0-8h14m-8 0v8"/>',
 ruler:'<path d="m3 14 11-11 7 7-11 11zM12 5l3 3m-6 0 2 2m-5 1 3 3"/>',
 attach:'<path d="M5 4h14v16H5zM9 10h8m-3-3 3 3-3 3"/>'
};
const ico=k=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[k]+'</svg>';
let serial=0;

export function mountRoomView(host,{getPlan,getPhoto,getPhotos,getPhotoOrigin,onAttach,onEdit,onDimensions,onViewChange}={}){
  if(!host||typeof getPlan!=='function')throw new TypeError('Room view requires a host and a plan');
  const id='sroom-'+(++serial),ac=new AbortController(),win=host.ownerDocument.defaultView;
  const listen=(node,name,fn,options)=>node.addEventListener(name,fn,{...options,signal:ac.signal});
  const op=(v,text)=>'<option value="'+v+'">'+text+'</option>';
  host.classList.add('sroom-host');host.hidden=true;
  host.innerHTML=`<div class="sroom" dir="rtl">
    <div class="sroom-line">
      <div class="sroom-switch" role="group" aria-label="عرض الغرفة">
        <button type="button" data-room-mode="cutaway" aria-pressed="true">${ico('cut')}<span>كشف الداخل</span></button>
        <button type="button" data-room-mode="closed" aria-pressed="false">${ico('shell')}<span>غرفة مغلقة</span></button>
      </div>
      <button type="button" class="sroom-home" data-room-home aria-label="استعادة زاوية البداية" title="استعادة زاوية البداية">${ico('home')}<span>زاوية البداية</span></button>
    </div>
    <figure class="sroom-figure">
      <svg class="sroom-scene" xmlns="${ns}" preserveAspectRatio="xMidYMid meet" direction="ltr" tabindex="0" role="group" aria-label="مجسّم الغرفة؛ اسحب للتدوير أو انقر لاختيار سطح" aria-describedby="${id}-guide"></svg>
      <figcaption class="sroom-caption" id="${id}-guide"><span class="sroom-dot" aria-hidden="true"></span><span>اسحب لتدور حول الغرفة، وانقر على سطح لتحديده.</span><span class="sroom-sr">يمكنك استخدام مفاتيح الأسهم للتدوير واختيار أي سطح من القائمة التالية.</span></figcaption>
    </figure>
    <div class="sroom-details">
      <div class="sroom-selection"><label><span>السطح المحدد</span><select data-room-face aria-label="اختر سطح الغرفة"><optgroup label="الجدران">${roomWallIds.map(k=>op(k,faceName(k))).join('')}</optgroup><optgroup label="سطحان أفقيان">${['floor','ceiling'].map(k=>op(k,faceName(k))).join('')}</optgroup></select></label>
        <span class="sroom-size" data-room-size dir="auto"></span></div>
      <p class="sroom-fact"><i aria-hidden="true"></i><span data-room-location></span><span class="sroom-visibility" data-room-visibility hidden></span></p>
      <div class="sroom-actions">
        <button type="button" data-room-attach hidden>${ico('attach')}<span>انقل الدولاب إلى هذا الجدار</span></button>
        <button type="button" data-room-edit>${ico('edit')}<span>تحرير الدولاب</span></button>
        <button type="button" data-room-dimensions>${ico('ruler')}<span>أبعاد الغرفة</span></button>
      </div><p class="sroom-limit" data-room-reason hidden></p>
    </div>
    <span class="sroom-sr" role="status" aria-live="polite" data-room-status></span>
  </div>`;
  const q=s=>host.querySelector(s),root=q('.sroom'),svg=q('.sroom-scene'),select=q('[data-room-face]'),reason=q('[data-room-reason]'),attach=q('[data-room-attach]'),size=q('[data-room-size]'),location=q('[data-room-location]'),live=q('[data-room-status]');
  const visibility=q('[data-room-visibility]');
  const request=fn=>win.requestAnimationFrame(fn),cancel=id=>win.cancelAnimationFrame(id);
  let mode='cutaway',surface=null,camera={...home},frame=0,drag=null,visible=false,dead=false,rendered=null,renderStamp=null,chromeStamp=null,first=true;
  function state(){return {surface,wallId:wallId(surface)?surface:null,mode,...camera};}
  function indicate(text){if(live.textContent!==text)live.textContent=text;}
  const validPhoto=u=>typeof u==='string'&&u.length>0;
  function photoMap(p){
    const map=getPhotos?.();if(map&&typeof map==='object')return Object.fromEntries(roomWallIds.filter(k=>validPhoto(map[k])).map(k=>[k,map[k]]));
    const url=getPhoto?.();if(!validPhoto(url))return {};
    const at=getPhotoOrigin?.(p);return {[wallId(at)?at:'back']:url};
  }
  function same(a,b){return a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);}
  function paint(withChrome=false){
    if(!visible||dead)return;const p=getPlan(),r=getRoom(p),photos=photoMap(p);
    if(first){surface=r.attachedWall;first=false;}
    const stamp=[p,mode,surface,camera.yaw,camera.pitch,...roomWallIds.map(k=>photos[k])];
    if(!same(renderStamp,stamp)){
      rendered=renderShelfRoom(p,{...camera,mode,selectedSurface:surface,photos,prefix:id+'-fig'});
      svg.setAttribute('viewBox',rendered.viewBox);svg.innerHTML=rendered.html;renderStamp=stamp;
      svg.dataset.roomYaw=String(camera.yaw);svg.dataset.roomPitch=String(camera.pitch);
      root.dataset.roomViewMode=mode;root.dataset.roomSelected=surface;
      const hidden=!rendered.visibleSurfaces.includes(surface);
      const hint=hidden?(mode==='cutaway'?'حدود السطح المكشوف متقطّعة.':'السطح على الجهة الأخرى؛ دوّر الغرفة لرؤيته.'):'';
      visibility.hidden=!hint;if(visibility.textContent!==hint)visibility.textContent=hint;
    }
    if(withChrome||!chromeStamp){
      const key=[p,mode,surface];if(same(key,chromeStamp))return;chromeStamp=key;
      for(const b of host.querySelectorAll('button[data-room-mode]'))b.setAttribute('aria-pressed',String(b.dataset.roomMode===mode));
      select.value=surface;
      const vertical=wallId(surface),measures=vertical?roomWallSize(p,surface):{w:r.width,h:r.length};
      size.textContent=(vertical?'العرض × الارتفاع: ':'العرض × الطول: ')+dim(measures.w,measures.h);
      location.textContent='الدولاب على '+faceName(r.attachedWall)+'.';
      attach.hidden=!vertical||surface===r.attachedWall;const test=attach.hidden?null:attachCabinet(p,surface);
      attach.disabled=!!test&&!test.ok;
      const msg=test&&!test.ok?test.reason:test?.clamped?(test.reason||'سيُعدّل موضع الدولاب على الجدار ليبقى داخل حدوده.'):'';
      reason.hidden=!msg;reason.textContent=msg;
      q('[data-room-edit]').title='تحرير الدولاب على '+faceName(r.attachedWall);
    }
  }
  function schedule(){if(!frame&&visible)frame=request(()=>{frame=0;paint();});}
  function now(){if(frame)cancel(frame);frame=0;paint(true);}
  function choose(face,announce=true){
    if(!faces.includes(face))return false;const changed=surface!==face;surface=face;now();
    if(announce)indicate(faceName(face)+'، '+size.textContent+'. '+location.textContent+(visibility.hidden?'':' '+visibility.textContent));
    if(changed)onViewChange?.(state());return true;
  }
  function viewPoint(e){
    try{const m=svg.getScreenCTM();if(!m)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(m.inverse());}catch{return null;}
  }
  function selectAt(e){
    const q=viewPoint(e),hit=q&&rendered?.hitTest(q.x,q.y);if(!hit)return;
    choose(hit.surface);if(hit.part==='cabinet')indicate('الدولاب على '+faceName(hit.surface)+'. استخدم «تحرير الدولاب» لتعديل الرفوف.');
  }
  const armed=e=>e.button===0&&e.isPrimary!==false&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.shiftKey;
  function cleanupDrag(){
    const d=drag;drag=null;delete root.dataset.roomDrag;
    if(d)try{if(svg.hasPointerCapture(d.id))svg.releasePointerCapture(d.id);}catch{}
    return d;
  }
  function move(e){
    const d=drag;if(!d||e.pointerId!==d.id)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<d.threshold)return;
    d.moved=true;root.dataset.roomDrag='true';camera={yaw:wrap(d.yaw+dx*.42),pitch:clamp(d.pitch+dy*.29,-65,72)};schedule();
  }
  listen(svg,'pointerdown',e=>{
    if(drag){if(e.pointerId!==drag.id||e.buttons!==1)cleanupDrag();return;}
    if(!visible||!armed(e)||e.buttons!==1)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,...camera,moved:false,threshold:e.pointerType==='touch'?8:4};
    try{svg.setPointerCapture(e.pointerId);}catch{}svg.focus?.({preventScroll:true});e.preventDefault();
  });
  listen(svg,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(e.buttons!==1||e.isPrimary===false){cleanupDrag();return;}e.preventDefault();move(e);});
  listen(svg,'pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(!armed(e)||e.buttons!==0){cleanupDrag();return;}move(e);
    const d=cleanupDrag();e.preventDefault();if(d.moved){now();onViewChange?.(state());}else selectAt(e);
  });
  for(const name of ['pointercancel','lostpointercapture'])listen(svg,name,e=>{if(drag?.id===e.pointerId)cleanupDrag();});
  listen(win,'blur',()=>cleanupDrag());
  listen(svg,'keydown',e=>{
    const step=e.shiftKey?30:10,d={ArrowRight:[step,0],ArrowLeft:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key];
    if(!visible||e.altKey||e.metaKey||e.ctrlKey||!d&&e.key!=='Home')return;
    e.preventDefault();cleanupDrag();camera=d?{yaw:wrap(camera.yaw+d[0]),pitch:clamp(camera.pitch+d[1],-65,72)}:{...home};now();onViewChange?.(state());
  });
  listen(select,'change',()=>{cleanupDrag();choose(select.value);});
  listen(root,'click',e=>{
    const b=e.target.closest?.('button');if(!visible||!b||!root.contains(b)||b.disabled)return;
    cleanupDrag();
    if(b.dataset.roomMode){
      if(b.dataset.roomMode!==mode){mode=b.dataset.roomMode;now();onViewChange?.(state());indicate(mode==='closed'?'غرفة مغلقة: تظهر الأسطح الخارجية.':'كُشف الداخل مع بقاء الجدران في المخطط.');}
    }else if(b.hasAttribute('data-room-home')){
      camera={...home};now();onViewChange?.(state());indicate('استُعيدت زاوية البداية.');
    }else if(b===attach){
      const p=getPlan();if(!wallId(surface)||getRoom(p).attachedWall===surface)return;
      const test=attachCabinet(p,surface);if(!test.ok){reason.hidden=false;reason.textContent=test.reason;return;}
      onAttach?.(surface);if(!dead){now();if(getRoom(getPlan()).attachedWall===surface)indicate('نُقل الدولاب إلى '+faceName(surface)+'.');}
    }else if(b.hasAttribute('data-room-edit'))onEdit?.(getRoom(getPlan()).attachedWall);
    else if(b.hasAttribute('data-room-dimensions'))onDimensions?.(surface);
  });
  function refresh(show=true){if(dead)return;visible=!!show;host.hidden=!visible;if(!visible){if(frame)cancel(frame);frame=0;cleanupDrag();return;}now();}
  function exportSvg(){
    const p=getPlan(),room=renderShelfRoom(p,{...camera,mode,selectedSurface:null,photos:photoMap(p),prefix:id+'-export'}),b=room.bounds||room.projection.bounds;
    return '<svg xmlns="'+ns+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="1400" height="'+Math.round(1400*b.h/b.w)+'" viewBox="'+room.viewBox+'"><title>الغرفة والدولاب — '+(mode==='closed'?'غرفة مغلقة':'كشف الداخل')+'</title><rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="#f3efe5"/>'+room.html+'</svg>';
  }
  return {refresh,exportSvg,getState:state,destroy(){if(dead)return;refresh(false);dead=true;ac.abort();host.replaceChildren();host.classList.remove('sroom-host');}};
}
