// Supplement to the existing repeat lesson. Both counters consume ONE state.
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmt=(v,n=0)=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:n}).format(v);
export const spatialTimeSettings=Object.freeze({anchorX:125,segmentWidth:50,minimumPieces:1,maximumPieces:12,intervalMs:500});
export const spatialTimeKeyframes=Object.freeze([
  {x:125,y:100,t:0},{x:325,y:100,t:400},{x:325,y:100,t:1200},{x:225,y:100,t:1600},
]);
export function spatialTimeSamples(step=20){
  if(!Number.isFinite(step)||step<=0)throw new RangeError('Positive sample interval required');
  const out=[{...spatialTimeKeyframes[0]}];
  for(let i=1;i<spatialTimeKeyframes.length;i++){
    const a=spatialTimeKeyframes[i-1],b=spatialTimeKeyframes[i];
    for(let t=a.t+step;t<b.t;t+=step){const f=(t-a.t)/(b.t-a.t);out.push({x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y),t});}out.push({...b});
  }return out;
}
export function createSpatialTimeRecorder(){
  let p,start,now,held,released,interrupted,length,trail;
  function clear(){p=null;start=now=length=0;held=released=interrupted=false;trail=[];}
  function begin(point,time=0){if(!finite(point)||!Number.isFinite(time))return false;clear();p={x:point.x,y:point.y};start=now=time;held=true;trail.push({...p});return true;}
  function sample(point,time){
    if(!held||!finite(point)||!Number.isFinite(time)||time<now)return false;
    const d=Math.hypot(point.x-p.x,point.y-p.y);length+=d;p={x:point.x,y:point.y};now=time;
    if(d){trail.push({...p});if(trail.length>500)trail=trail.filter((_,i)=>i%2===0||i===trail.length-1);}
    return true;
  }
  function advance(time){if(!held||!Number.isFinite(time)||time<now)return false;now=time;return true;}
  function finish(point,time){if(!sample(point,time))return false;held=false;released=true;return true;}
  function cancel(time){if(!advance(time))return false;held=false;interrupted=true;return true;}
  function snapshot(){
    const r=spatialTimeSettings,extent=p?Math.max(0,p.x-r.anchorX):0,duration=now-start;
    return {current:p&&{...p},held,released,interrupted,duration,extent,pathLength:length,
      // This reproduces repeatMode.normalize/fromPoint, including its initial
      // minimum and nearest-segment quantization; it is NOT path accumulation.
      spatialPieces:p?Math.round(clamp(extent/r.segmentWidth,r.minimumPieces,r.maximumPieces)):null,
      timePulses:p?Math.floor(duration/r.intervalMs):null,trail:trail.map(v=>({...v}))};
  }
  clear();return {begin,sample,advance,finish,cancel,clear,snapshot};
}

function boardPoint(svg,event){const m=svg.getScreenCTM();if(!m)return null;const v=svg.createSVGPoint();v.x=event.clientX;v.y=event.clientY;const p=v.matrixTransform(m.inverse());return{x:p.x,y:p.y};}
export function mountSpatialTime(container,api={}){
  container.innerHTML=`<section class="st-lab" data-spatial-time>
    <header class="st-head"><div><small>مقارنة داخل تجربة التكرار على مسافة</small><h3>هل يولّد الانتظار قطعة مكانية؟</h3></div><span data-st-source>فأرة مباشرة</span></header>
    <p>اضغط بالزر الأساسي على السطح واسحب يمينًا، اثبت لحظة، ثم ارجع والزر ما زال مضغوطًا. السطح يسجّل موضعًا وزمنًا مشتركين، وتقرأ القاعدتان السجل في اللحظة نفسها.</p>
    <svg class="st-board" viewBox="0 0 900 180" role="group" aria-label="سطح السجل المشترك للامتداد والزمن"><rect width="900" height="180" rx="14" fill="#edf3e7"/><path d="M125 103H725" stroke="#b1c4a6" stroke-width="2"/>${Array.from({length:13},(_,i)=>`<path d="M${125+50*i} 91v25" stroke="#a9bda0" stroke-width="1.5"/>`).join('')}<path d="M125 53v86" stroke="#24664c" stroke-width="3"/><text class="st-svg-label" x="125" y="37" text-anchor="middle">مرساة ثابتة</text><path data-st-trail fill="none" stroke="#bf875c" stroke-width="2" opacity=".75"/><line data-st-extent-line x1="125" y1="128" x2="125" y2="128" stroke="#307350" stroke-width="4"/><circle data-st-pointer r="9" fill="#be7b4f" stroke="#fffdf7" stroke-width="3" visibility="hidden"/><text class="st-svg-label" x="450" y="165" text-anchor="middle">كل تدريجة أفقية = ٥٠ وحدة من إحداثيات اللوحة</text></svg>
    <div class="st-common"><strong data-st-phase>بانتظار ضغطة</strong><span>زمن الضغط: <output data-st-duration>—</output></span><span>الامتداد: <output data-st-extent>—</output></span><span>طول الطريق: <output data-st-path>—</output></span></div>
    <div class="st-results"><article><div class="st-result-label">القاعدة المكانية</div><h4>قطع السياج بحسب الامتداد</h4><strong data-st-pieces>—</strong><div class="st-fence" data-st-fence aria-hidden="true"></div><p>الامتداد الأفقي الموجب من المرساة ÷ ٥٠، ثم التقريب إلى أقرب عدد وتقييده بين قطعة و١٢. الرجوع يقلّل الامتداد ولو زاد طول الطريق.</p></article><article><div class="st-result-label">القاعدة الزمنية</div><h4>أثر عند كل نصف ثانية</h4><strong data-st-pulses>—</strong><div class="st-pulses" data-st-pulse-marks aria-hidden="true"></div><p>أثر لكل ٥٠٠ ملث مكتملة من بدء الضغط، أينما كان المؤشر. الثبات يستمر معه العد، والرجوع لا يمحو الزمن السابق.</p></article></div>
    <div class="st-proof" data-st-proof></div>
    <details><summary>ما الثابت، وما الذي اختلف؟</summary><p>الإشارة واحدة: ضغطة واحدة والموضع وخط الزمن نفسيهما. للسياج قطعة دنيا، وللعداد الزمني صفر قبل اكتمال أول فترة؛ قارن تغيّر كل ناتج عند الثبات والرجوع. طول الطريق معروض لتمييزه عن الامتداد، ولا يتحكم في عدد القطع هنا. الساعة تحسب كامل الضغط لا مدة زيارة هدف. عند الإفلات أو مقاطعة النظام تتوقف القاعدتان.</p></details>
    <div class="st-controls"><button type="button" data-st-play>شغّل تسجيل الحركة والثبات والرجوع</button><button type="button" data-st-reset>مسح المقارنة</button><small>التسجيل المضبوط وسيلة مشاهدة؛ قيمه ليست تسجيلًا لفأرتك.</small></div>
  </section>`;
  const root=container.querySelector('[data-spatial-time]'),q=s=>root.querySelector(s),svg=q('.st-board'),engine=createSpatialTimeRecorder();
  const controller=new AbortController(),on=(target,name,fn,opts={})=>target.addEventListener(name,fn,{...opts,signal:controller.signal});
  let pointerId=null,source='mouse',began=0,raf=0,version=0,pending=null,broken=false,lastPaint=-Infinity,lastFeedback=-Infinity,checkpoints=[];
  const elapsed=()=>Math.max(0,performance.now()-began);
  const emit=(method,msg,detail='')=>{if(!broken)api[method]?.(msg,detail);};
  function stopLoop(){version++;if(raf)cancelAnimationFrame(raf);raf=0;if(pending){const done=pending;pending=null;done(false);}}
  function uncapture(){const old=pointerId;pointerId=null;if(old!==null)try{if(svg.hasPointerCapture(old))svg.releasePointerCapture(old);}catch{}}
  function paint(force=false){
    const wall=performance.now();if(!force&&wall-lastPaint<50)return;lastPaint=wall;const s=engine.snapshot(),active=!!s.current;
    root.dataset.stMode=source;root.dataset.stHeld=String(s.held);root.dataset.stReleased=String(s.released);root.dataset.stInterrupted=String(s.interrupted);
    for(const [key,v]of Object.entries({stDuration:s.duration,stExtent:s.extent,stPathLength:s.pathLength,stPieces:s.spatialPieces,stPulses:s.timePulses}))root.dataset[key]=active?String(Math.round(v*1000)/1000):'';
    q('[data-st-source]').textContent=source==='guide'?'تسجيل مضبوط · إشارة محاكاة':'فأرة مباشرة';
    q('[data-st-phase]').textContent=s.interrupted?'انقطعت الضغطة دون إفلات':s.released?'انتهت الضغطة وتجمّدت النتائج':s.held?'الزر الأساسي مضغوط':'بانتظار ضغطة';
    q('[data-st-duration]').textContent=active?`${fmt(s.duration)} ملث`:'—';q('[data-st-extent]').textContent=active?`${fmt(s.extent,1)} وحدة`:'—';q('[data-st-path]').textContent=active?`${fmt(s.pathLength,1)} وحدة`:'—';
    q('[data-st-pieces]').textContent=active?fmt(s.spatialPieces):'—';q('[data-st-pulses]').textContent=active?fmt(s.timePulses):'—';
    q('[data-st-trail]').setAttribute('d',s.trail.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '));q('[data-st-extent-line]').setAttribute('x2',String(125+clamp(s.extent,0,760)));
    const dot=q('[data-st-pointer]');dot.setAttribute('visibility',active?'visible':'hidden');if(active){dot.setAttribute('cx',s.current.x);dot.setAttribute('cy',s.current.y);}
    q('[data-st-fence]').innerHTML=Array.from({length:s.spatialPieces||0},()=>'<i></i>').join('');const marks=Math.min(14,s.timePulses||0);
    q('[data-st-pulse-marks]').innerHTML=Array.from({length:marks},()=>'<i></i>').join('')+((s.timePulses||0)>marks?'<span>…</span>':'');
    q('[data-st-proof]').innerHTML=checkpoints.length?`<table><caption>لحظات من التسجيل المضبوط نفسه</caption><thead><tr><th>اللحظة</th><th>الامتداد</th><th>قطع</th><th>آثار زمنية</th></tr></thead><tbody>${checkpoints.map(c=>`<tr data-st-checkpoint="${c.duration}"><th>${c.label} · ${fmt(c.duration)} ملث</th><td>${fmt(c.extent)}</td><td>${fmt(c.pieces)}</td><td>${fmt(c.pulses)}</td></tr>`).join('')}</tbody></table>`:'<p>راقب القيم عند الثبات ثم الرجوع، أو شغّل التسجيل المضبوط لمقارنة لحظاته المحفوظة.</p>';
    if(s.held&&wall-lastFeedback>350){lastFeedback=wall;emit('live','القاعدتان تقرآن التسجيل نفسه.',`الامتداد ${fmt(s.extent,1)} وحدة · زمن الضغط ${fmt(s.duration)} ملث.`);}
  }
  function reset(silent=false){stopLoop();uncapture();engine.clear();source='mouse';checkpoints=[];paint(true);if(!silent)emit('ready','اسحب واثبت ثم ارجع.','التكرار المكاني يقرأ الامتداد؛ والتكرار الزمني يقرأ مدة الضغط.');}
  function suspend(silent=true){const s=engine.snapshot();if(!s.held)return;engine.cancel(source==='mouse'?elapsed():s.duration);stopLoop();uncapture();paint(true);if(!silent)emit('ready','توقّف السجل قبل الإفلات.','المقاطعة لا تضيف صف إفلات ولا آثارًا زمنية لاحقة.');}
  function feedback(){const s=engine.snapshot();emit('done',`من الضغطة نفسها: عدد القطع ${fmt(s.spatialPieces)}، وعدد الآثار الزمنية ${fmt(s.timePulses)}.`,`الامتداد ${fmt(s.extent,1)} وحدة، وطول الطريق ${fmt(s.pathLength,1)}، وزمن الضغط ${fmt(s.duration)} ملث.`);}
  on(svg,'pointerdown',event=>{
    if(broken||pointerId!==null||event.pointerType!=='mouse'||event.isPrimary===false||event.button!==0||event.buttons!==1)return;
    const p=boardPoint(svg,event);if(!p)return;event.preventDefault();reset(true);pointerId=event.pointerId;began=performance.now();engine.begin(p,0);
    try{svg.setPointerCapture(pointerId);}catch{}paint(true);const token=version;
    function tick(){if(broken||version!==token||pointerId===null)return;engine.advance(elapsed());paint();raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
  });
  on(window,'pointermove',event=>{if(pointerId===null||event.pointerId!==pointerId)return;if(event.buttons!==1){suspend(false);return;}const p=boardPoint(svg,event);if(p){event.preventDefault();engine.sample(p,elapsed());paint();}},{passive:false});
  on(window,'pointerup',event=>{if(pointerId===null||event.pointerId!==pointerId||event.button!==0)return;const p=boardPoint(svg,event);if(!p){suspend(false);return;}engine.finish(p,elapsed());stopLoop();uncapture();paint(true);feedback();});
  on(window,'pointercancel',event=>{if(pointerId!==null&&event.pointerId===pointerId)suspend(false);});on(svg,'lostpointercapture',event=>{if(pointerId!==null&&event.pointerId===pointerId)suspend(false);});
  on(window,'blur',()=>suspend(false));on(document,'visibilitychange',()=>{if(document.hidden)suspend(false);});
  function play(){
    if(broken)return Promise.resolve(false);reset(true);source='guide';const points=spatialTimeSamples(),last=points.at(-1);engine.begin(points[0],0);paint(true);const token=version;let i=1,start=null;
    return new Promise(resolve=>{pending=resolve;function tick(wall){
      if(broken||version!==token)return;if(start===null)start=wall;const t=Math.min(last.t,Math.max(0,wall-start));
      while(i<points.length&&points[i].t<=t){const p=points[i++];engine.sample(p,p.t);
        if([400,1200,1600].includes(p.t)){const s=engine.snapshot();checkpoints.push({label:p.t===400?'بعد التقدّم':p.t===1200?'بعد الثبات':'بعد الرجوع',duration:s.duration,extent:s.extent,pieces:s.spatialPieces,pulses:s.timePulses});}}
      if(t>=last.t){engine.finish(last,last.t);raf=0;pending=null;paint(true);feedback();resolve(true);return;}paint();raf=requestAnimationFrame(tick);
    }raf=requestAnimationFrame(tick);});
  }
  on(q('[data-st-play]'),'click',play);on(q('[data-st-reset]'),'click',()=>reset());reset(true);
  return {play,reset:()=>reset(),suspend,destroy(){if(broken)return;broken=true;stopLoop();uncapture();controller.abort();}};
}
