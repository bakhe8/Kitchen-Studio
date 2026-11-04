// The secondary-only workspace reads the same pointer units for every viewport.
const startBox={x:180,y:105}, W=720,H=210, halfX=46,halfY=29;
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const pos=(p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function secondaryModel(){
 let box,origin,grab,raw,held,phase,count,from,to;
 const reset=()=>{box={...startBox};origin={...box};grab=null;raw=null;held=false;phase='ready';count=0;from=to=0;};
 function down(p,t,button=2,buttons=2){if(held||button!==2||buttons!==2||!pos(p)||!Number.isFinite(t)||Math.abs(p.x-box.x)>halfX||Math.abs(p.y-box.y)>halfY)return false;origin={...box};grab={...p};raw={...p};held=true;phase='held';from=to=t;count=1;return true;}
 function move(p,t){if(!held||!pos(p)||!Number.isFinite(t)||t<to)return false;raw={...p};to=t;count++;box={x:clamp(origin.x+p.x-grab.x,halfX,W-halfX),y:clamp(origin.y+p.y-grab.y,halfY,H-halfY)};return true;}
 function up(p,t){if(!move(p,t))return false;held=false;phase='release';return true;}
 function cancel(){if(!held)return;held=false;box={...origin};phase='interrupted';}
 function state(){return {box:{...box},grab:grab&&{...grab},raw:raw&&{...raw},delta:grab&&{x:raw.x-grab.x,y:raw.y-grab.y},held,phase,count,duration:to-from};}reset();return {reset,down,move,up,cancel,state};
}
const secTrace=[{t:0,x:180,y:105},{t:240,x:240,y:90},{t:570,x:420,y:70},{t:900,x:470,y:110},{t:1250,x:420,y:135}];
export function mountSecondaryDrag(container,report){
 const model=secondaryModel(), b=new AbortController(),on=(el,k,fn)=>el.addEventListener(k,fn,{signal:b.signal});let pid=null,raf=0,mode='mouse',disposed=false;
 container.innerHTML=`<div class="ch-board-shell"><div class="ch-board-legend"><span data-source>ماوس مباشر</span><span>لوحة ٧٢٠ × ٢١٠ وحدة</span></div>
 <svg class="ch-secondary-board" viewBox="0 0 720 210" role="img" aria-label="سطح السحب بالزر الثانوي: صندوق يمكن سحبه"><defs><pattern id="channel-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.3" fill="#afbeac"/></pattern></defs><rect width="720" height="210" fill="url(#channel-grid-dots)"/><path data-guide stroke="#b0723f" stroke-width="3" stroke-dasharray="5 7" fill="none"/><g data-box><rect x="-45" y="-28" width="90" height="56" rx="10" fill="#276954" stroke="#153f33" stroke-width="2"/><path d="M-45 -10h90M-9 -27v17l9 -4 9 4v-17" stroke="#c3d0b2" fill="#aebc96"/><path d="M-11 10h22m-17 -5-5 5 5 5m12-10 5 5-5 5" fill="none" stroke="#fff" stroke-width="2"/></g><circle data-raw r="5" fill="#e89e58" stroke="#78491d" display="none"/></svg>
 <div class="ch-metrics"><div><small>الزر المسجّل</small><strong data-button>—</strong></div><div><small>إزاحة المؤشر (س، ص)</small><strong data-delta dir="ltr">—</strong></div><div><small>موضع الصندوق (س، ص)</small><strong data-pos dir="ltr">—</strong></div></div><p data-phase class="ch-phase"></p></div>`;
 const $=s=>container.querySelector(s),board=$('svg');function pt(e){const m=board.getScreenCTM();if(!m)return null;const p=board.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(m.inverse());return {x:q.x,y:q.y};}
 function paint(){const s=model.state();$('[data-source]').textContent=mode==='guide'?'عرض مضبوط · ليس ضغطًا فعليًا':'ماوس مباشر';$('[data-box]').setAttribute('transform',`translate(${s.box.x} ${s.box.y})`);$('[data-guide]').setAttribute('d',s.grab?`M${s.grab.x} ${s.grab.y}L${s.raw.x} ${s.raw.y}`:'');const point=$('[data-raw]');point.setAttribute('display',s.raw?'inline':'none');if(s.raw){point.setAttribute('cx',s.raw.x);point.setAttribute('cy',s.raw.y);}
 $('[data-button]').textContent=s.grab?'الثانوي':'—';$('[data-pos]').textContent=ar(s.box.x)+' ، '+ar(s.box.y);$('[data-delta]').textContent=s.delta?ar(s.delta.x)+' ، '+ar(s.delta.y):'—';
 $('[data-phase]').textContent=({ready:'جاهز · اضغط بالزر الثانوي على الصندوق نفسه.',held:'الزر الثانوي مضغوط · يتتبّع الصندوق الإزاحة.',release:'إفلات · اعتُمد موضع الصندوق.',interrupted:'انقطع السحب · عاد الصندوق إلى آخر موضع معتمد.'})[s.phase];container.dataset.phase=s.phase;container.dataset.source=mode;}
 function stopAnimation(){if(raf)cancelAnimationFrame(raf);raf=0;}
 function release(){const old=pid;pid=null;if(old!==null&&board.hasPointerCapture(old))board.releasePointerCapture(old);}
 function cancel(){if(pid===null&&!model.state().held)return;stopAnimation();model.cancel();release();paint();report('انقطع التسجيل دون اعتماد إفلات.');}
 function reset(){stopAnimation();release();model.reset();mode='mouse';paint();report('جاهز لسحب جديد بالزر الثانوي وحده.');}
 on(board,'contextmenu',e=>e.preventDefault());
 const modified=e=>e.ctrlKey||e.altKey||e.shiftKey||e.metaKey;
 on(board,'pointerdown',e=>{if(e.pointerType!=='mouse'||e.isPrimary===false||e.button!==2||e.buttons!==2||modified(e))return;const p=pt(e);if(!p)return;
 if(mode==='guide'){reset();}if(!model.down(p,performance.now(),e.button,e.buttons))return;e.preventDefault();pid=e.pointerId;mode='mouse';board.setPointerCapture(pid);paint();report('بدأ السحب بالزر الثانوي.');});
 on(window,'mousedown',e=>{if(pid!==null&&(e.button!==2||e.buttons!==2))cancel();});
 on(board,'pointermove',e=>{if(pid===null||e.pointerId!==pid)return;if(e.buttons!==2||modified(e)){cancel();return;}const p=pt(e);if(p){model.move(p,performance.now());paint();}});
 on(board,'pointerup',e=>{if(pid===null||e.pointerId!==pid)return;if(e.button!==2||e.buttons!==0||modified(e)){cancel();return;}const p=pt(e);if(!p){cancel();return;}model.up(p,performance.now());release();paint();report('انتهى السحب واعتمد موضع الصندوق.');});
 on(board,'pointercancel',cancel);on(board,'lostpointercapture',e=>{if(e.pointerId===pid)cancel();});on(window,'blur',cancel);on(document,'visibilitychange',()=>{if(document.hidden)cancel();});
 function play(){reset();mode='guide';const begin=performance.now();let i=1;model.down(secTrace[0],0);paint();report('عرض مضبوط للسحب بالثانوي.');function tick(t){if(disposed)return;while(i<secTrace.length&&t-begin>=secTrace[i].t){const p=secTrace[i++];if(i===secTrace.length)model.up(p,p.t);else model.move(p,p.t);}paint();if(i<secTrace.length)raf=requestAnimationFrame(tick);else {raf=0;report('انتهى العرض: انتقل الصندوق ٢٤٠ وحدة أفقيًا و٣٠ وحدة رأسيًا.');}}raf=requestAnimationFrame(tick);}
 reset();return {play,reset,destroy(){disposed=true;stopAnimation();release();b.abort();}};
}
