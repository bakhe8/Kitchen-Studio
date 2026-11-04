const fmt = (value, digits = 0) => new Intl.NumberFormat('ar-SA', {maximumFractionDigits: digits}).format(value);
const pointCopy = point => ({x: point.x, y: point.y});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const inTarget = point => point.x >= 620 && point.x <= 740 && point.y >= 80 && point.y <= 200;
const rounded = value => Math.round(value * 1000) / 1000;

// This log is intentionally separate from animation ticks and derived rule events.
// Native rows come only from received down/move/up events; a system interruption
// closes the log without fabricating a position or a pointer-up sample.
export function createSampleInspector() {
  let rows=[], selected=-1, start=0, source=null, status='empty';
  const read=i=>i>=0&&i<rows.length?{...rows[i]}:null;
  function clear(){rows=[];selected=-1;start=0;source=null;status='empty';}
  function begin(p,time,origin='mouse'){
    if(!finitePoint(p)||!Number.isFinite(time)||!['mouse','guide'].includes(origin))return false;
    clear();source=origin;status='recording';start=time;selected=0;rows.push({x:p.x,y:p.y,t:0,phase:'down'});return true;
  }
  function append(p,time,phase='move'){
    if(status!=='recording'||!finitePoint(p)||!Number.isFinite(time)||!['move','up'].includes(phase))return false;
    const t=time-start;if(t<rows.at(-1).t)return false;
    rows.push({x:p.x,y:p.y,t,phase});if(phase==='up')status='released';return true;
  }
  function interrupt(){if(status!=='recording')return false;status='interrupted';return true;}
  function select(i){if(!Number.isInteger(i)||i<0||i>=rows.length)return false;selected=i;return true;}
  function snapshot(){return {source,status,count:rows.length,index:selected,row:read(selected)};}
  return {begin,append,interrupt,select,read,snapshot,clear};
}

export const buttonThresholds = Object.freeze({drag: 8, hold: 600, pause: 400, stillRadius: 2, speedWindow: 120});

// Raw input: one down, time-stamped positions, and one up or system interruption.
// All displayed measurements and rule decisions derive from that same record.
export function createButtonRecorder() {
  let points = [], origin = null, current = null, started = 0, now = 0, length = 0, maximumDisplacement = 0;
  let held = false, released = false, interrupted = false, firstDrag = null, lastHeading = null;
  let stillAnchor = null, stillSince = 0, targetSince = null, longestDwell = 0, maximumPause = 0;
  let flags = {}, events = [];
  const fire = (key, time) => { if (!flags[key]) { flags[key] = true; events.push({key, time}); } };
  function clear() {
    points = []; origin = current = stillAnchor = null; started = now = length = maximumDisplacement = 0;
    held = released = interrupted = false; firstDrag = lastHeading = targetSince = null;
    stillSince = longestDwell = maximumPause = 0; flags = {}; events = [];
  }
  function begin(point, time = 0) {
    if (!finitePoint(point) || !Number.isFinite(time)) return false;
    clear(); origin = pointCopy(point); current = pointCopy(point); stillAnchor = pointCopy(point);
    started = now = stillSince = time; held = true; targetSince = inTarget(point) ? time : null;
    points.push({...point, t: time, length: 0}); fire('press', 0); return true;
  }
  function sample(point, time) {
    if (!held || !finitePoint(point) || !Number.isFinite(time)) return false;
    time = Math.max(now, time); now = time;
    const step = distance(current, point);
    if (step > 0) {
      length += step;
      if (step >= .05) lastHeading = (Math.atan2(-(point.y - current.y), point.x - current.x) * 180 / Math.PI + 360) % 360;
      points.push({...point, t: time, length});
    }
    current = pointCopy(point);
    maximumDisplacement = Math.max(maximumDisplacement, distance(origin, current));
    if (firstDrag === null && maximumDisplacement >= buttonThresholds.drag) {
      firstDrag = now - started; fire('drag', firstDrag);
    }
    if (distance(stillAnchor, current) > buttonThresholds.stillRadius) {
      stillAnchor = pointCopy(current); stillSince = now;
    }
    const pause = now - stillSince;
    maximumPause = Math.max(maximumPause, pause);
    if (now - started >= buttonThresholds.hold) fire('hold', buttonThresholds.hold);
    if (pause >= buttonThresholds.pause) fire('pause', stillSince - started + buttonThresholds.pause);
    if (inTarget(current)) {
      if (targetSince === null) targetSince = now;
      longestDwell = Math.max(longestDwell, now - targetSince);
    } else targetSince = null;
    return true;
  }
  function advance(time) { return current ? sample(current, time) : false; }
  function finish(point, time, wasInterrupted = false) {
    if (!held) return false;
    sample(point, time); held = false; interrupted = wasInterrupted; released = !wasInterrupted;
    if (released) { fire('release', now - started); if (inTarget(current)) fire('target', now - started); }
    else fire('interrupt', now - started);
    return true;
  }
  function pathAt(time) {
    if (!points.length || time <= points[0].t) return 0;
    for (let i = points.length - 1; i > 0; i--) {
      const after = points[i], before = points[i - 1];
      if (time >= after.t) return after.length;
      if (time >= before.t) {
        const ratio = after.t === before.t ? 1 : (time - before.t) / (after.t - before.t);
        return before.length + (after.length - before.length) * ratio;
      }
    }
    return 0;
  }
  function snapshot() {
    const duration = Math.max(0, now - started), net = origin ? distance(origin, current) : 0;
    const recentTime = Math.min(duration, buttonThresholds.speedWindow);
    const speed = recentTime > 0 ? Math.max(0, (length - pathAt(now - recentTime)) / recentTime * 1000) : 0;
    const pause = origin ? now - stillSince : 0;
    return {
      active: !!origin, held, released, interrupted, duration, firstDrag,
      origin: origin && pointCopy(origin), current: current && pointCopy(current),
      dx: origin ? current.x - origin.x : 0, dy: origin ? current.y - origin.y : 0,
      displacement: net, maximumDisplacement, length, heading: lastHeading,
      speed, meanSpeed: duration > 0 ? length / duration * 1000 : 0,
      releaseSpeed: released ? speed : null, pause, maximumPause,
      targetDwell: targetSince === null ? 0 : now - targetSince, longestDwell,
      insideTarget: current ? inTarget(current) : false,
      kind: !origin ? 'ready' : interrupted ? 'interrupted' : firstDrag !== null ? 'drag' : duration >= buttonThresholds.hold ? 'hold' : 'click',
      flags: {...flags}, events: events.map(event => ({...event})),
      points: points.map(point => ({...point})),
    };
  }
  return {begin, sample, advance, finish, clear, snapshot};
}

export const buttonTraces = [
  {id: 'short', label: 'نقرة قصيرة', note: 'ضغط وإفلات دون حركة، قبل عتبة الاستمرار.', points: [{x:100,y:150,t:0},{x:100,y:150,t:180}]},
  {id: 'hold', label: 'ضغط طويل ثابت', note: 'مدة الضغط وزمن الثبات يزيدان معًا؛ لا يبدأ سحب.', points: [{x:100,y:150,t:0},{x:100,y:150,t:1000}]},
  {id: 'slow', label: 'سحب بطيء', note: 'يمر وقت طويل واليد تتحرك؛ الاستمرار لا يعني الثبات.', points: [{x:100,y:150,t:0},{x:680,y:150,t:1800}]},
  {id: 'fast', label: 'سحب سريع', note: 'المسافة والنهاية نفسهما في السحب البطيء؛ تغيّر الزمن والسرعة.', points: [{x:100,y:150,t:0},{x:680,y:150,t:300}]},
  {id: 'pause', label: 'سحب ثم وقفة', note: 'يبقى الزر مضغوطًا بعد توقف اليد؛ سرعة الإفلات تصبح صفرًا تقريبًا.', points: [{x:100,y:150,t:0},{x:680,y:150,t:500},{x:680,y:150,t:1300}]},
  {id: 'wait', label: 'انتظر ثم اسحب', note: 'الانتظار قبل بدء الحركة يختلف عن الوقفة بعد قطع المسار.', points: [{x:100,y:150,t:0},{x:100,y:150,t:800},{x:680,y:150,t:1100}]},
  {id: 'return', label: 'عد إلى البداية', note: 'الإزاحة النهائية صفر، لكن طول المسار محفوظ والحركة تظل سحبًا.', points: [{x:100,y:150,t:0},{x:680,y:150,t:600},{x:100,y:150,t:1200}]},
];

export function sampleButtonTrace(trace, interval = 20) {
  const samples = [trace.points[0]];
  for (let i = 1; i < trace.points.length; i++) {
    const before = trace.points[i - 1], after = trace.points[i];
    for (let time = before.t + interval; time < after.t; time += interval) {
      const f = (time - before.t) / (after.t - before.t);
      samples.push({x: before.x + (after.x - before.x) * f, y: before.y + (after.y - before.y) * f, t: time});
    }
    samples.push({...after});
  }
  return samples;
}

const eventLabels = {press:'بدء الضغط',hold:'استمرار ٦٠٠ ملث',drag:'بدء السحب',pause:'ثبات ٤٠٠ ملث',release:'الإفلات',target:'الإفلات داخل الهدف',interrupt:'انقطاع من النظام'};
const kindLabels = {ready:'بانتظار الضغط',click:'نقرة قصيرة',hold:'ضغط طويل دون سحب',drag:'سحب',interrupted:'حركة منقطعة'};
const ruleCards = [
  ['press','عند بدء الضغط','أثر فوري من لحظة النزول.'],
  ['hold','بعد استمرار الضغط','٦٠٠ ملث والزر ما زال مضغوطًا؛ الحركة مسموحة.'],
  ['drag','عند بدء السحب','تجاوز بُعد البداية ٨ وحدات، ولو عدت إليها لاحقًا.'],
  ['pause','بعد ثبات المؤشر','٤٠٠ ملث داخل نطاق اهتزاز صغير، مع بقاء الضغط.'],
  ['release','عند الإفلات','الزر أصبح متروكًا، مهما كان موضع النهاية.'],
  ['target','إفلات داخل الهدف','الإفلات وحده مع وقوع النهاية داخل المستطيل.'],
];

function shell(id, container) {
  const phases = id === 'button-phases';
  container.innerHTML = `<section class="sbtn-root" data-sbtn-mode="${id}">
    <div class="sbtn-heading"><strong>${phases?'الإشارة نفسها، وتوقيت الأثر يتغيّر':'راقب ما تحمله حركة زر واحد'}</strong><span class="sbtn-source" data-sbtn-source>تجربة مباشرة بالفأرة</span></div>
    <p class="sbtn-intro">اضغط الزر الأساسي داخل اللوحة، تحرك أو اثبت، ثم أفلت. ${phases?'البطاقات تقرأ الدورة نفسها بقواعد مختلفة.':'يبدأ سجل جديد مع كل ضغط؛ تُحفظ قياسات الدورة بعد الإفلات.'}</p>
    <div class="sbtn-cycle" aria-label="دورة الضغط"><span data-sbtn-cycle="press">١ · بداية الضغط</span><i aria-hidden="true">←</i><span data-sbtn-cycle="held">٢ · حركة أو ثبات مع الضغط</span><i aria-hidden="true">←</i><span data-sbtn-cycle="released">٣ · الإفلات</span></div>
    ${phases?`<div class="sbtn-rules">${ruleCards.map(([key,title,detail])=>`<article class="sbtn-rule" data-sbtn-rule="${key}"><div><b data-sbtn-rule-mark="${key}" aria-hidden="true">○</b><h3>${title}</h3></div><p>${detail}</p><output data-sbtn-rule-output="${key}">لم يحدث بعد</output></article>`).join('')}</div>`:''}
    <div class="sbtn-board-heading"><strong data-sbtn-phase>اضغط في أي موضع داخل اللوحة</strong><span>إحداثيات بوحدات المثال</span></div>
    <svg class="sbtn-board" viewBox="0 0 800 280" role="group" aria-label="سطح تسجيل ضغط الزر الأساسي وحركة المؤشر">
      <defs><pattern id="sbtn-grid-${id}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dfe6d6" stroke-width="1"/></pattern><clipPath id="sbtn-clip-${id}"><rect x="20" y="30" width="760" height="220" rx="16"/></clipPath></defs>
      <rect x="20" y="30" width="760" height="220" rx="16" fill="#edf2e5" stroke="#cbd9bd"/>
      <rect x="20" y="30" width="760" height="220" rx="16" fill="url(#sbtn-grid-${id})"/>
      <rect x="620" y="80" width="120" height="120" rx="12" class="sbtn-target" data-sbtn-target/>
      <text x="680" y="105" text-anchor="middle" class="sbtn-svg-small">هدف الإفلات</text>
      <g clip-path="url(#sbtn-clip-${id})"><path data-sbtn-path class="sbtn-path"/><line data-sbtn-displacement class="sbtn-net"/><circle data-sbtn-start r="8" class="sbtn-start" visibility="hidden"/><g data-sbtn-pointer visibility="hidden"><circle r="13" class="sbtn-pointer-ring"/><circle r="5" fill="#fffdf5"/></g></g>
      ${phases?'':`<g clip-path="url(#sbtn-clip-${id})" pointer-events="none"><g data-sbtn-sample-marker visibility="hidden" aria-hidden="true"><circle r="16" fill="none" stroke="#9e582c" stroke-width="3" stroke-dasharray="5 3"/><path d="M-20 0h8m24 0h8M0 -20v8m0 24v8" fill="none" stroke="#9e582c" stroke-width="2"/></g></g>`}
      <text x="40" y="272" class="sbtn-svg-small">المسار: أخضر · الإزاحة من البداية: خط منقط</text>
    </svg>
    <div class="sbtn-status" data-sbtn-status role="status">الزر متروك. لا توجد دورة مسجّلة بعد.</div>
    ${phases?'':`<section class="sbtn-inspector" aria-label="فاحص عينات الموضع والزمن" data-sbtn-inspector>
      <div class="sbtn-inspector-head"><h3>افحص عينة من سجل الضغطة</h3><span data-sbtn-sample-source>لا يوجد سجل</span></div>
      <p>اختر أي عينة لترى موضعها وعلامتها النحاسية على المسار. هذه أدوات قراءة، ولا تغيّر السجل أو تُضاف إلى الضغطة.</p>
      <fieldset data-sbtn-sample-tools disabled><legend>اختيار العينة</legend><label>رقم العينة <output data-sbtn-sample-number>—</output><input data-sbtn-sample-index type="range" min="1" max="1" value="1" step="1" aria-label="رقم العينة المراد فحصها"/></label>
      <div class="sbtn-sample-jumps"><button type="button" data-sbtn-sample-jump="first">الأولى</button><button type="button" data-sbtn-sample-jump="middle">الوسطى</button><button type="button" data-sbtn-sample-jump="last">الأخيرة</button></div></fieldset>
      <table class="sbtn-sample-table"><caption>العينة المختارة · الإحداثيات بوحدات اللوحة والزمن منذ الضغط</caption><thead><tr><th>الحدث</th><th>س (x)</th><th>ص (y)</th><th>الزمن (ملث)</th></tr></thead><tbody><tr><td data-sbtn-sample-phase>—</td><td data-sbtn-sample-x>—</td><td data-sbtn-sample-y>—</td><td data-sbtn-sample-t>—</td></tr></tbody></table>
      <p class="sbtn-sample-note" data-sbtn-sample-note>ابدأ ضغطة حقيقية أو شغّل تسجيلًا مضبوطًا. يظهر مصدر العينات هنا.</p>
    </section>`}
    <div class="sbtn-metrics" data-sbtn-metrics></div>
    <details class="sbtn-measurement-notes"><summary>كيف تُقرأ هذه القياسات؟</summary><p>مدة الضغط من النزول إلى الإفلات. الثبات يُقاس منذ آخر خروج من نطاق اهتزاز قدره وحدتان؛ والبقاء فوق الهدف يخص موضعًا محددًا. السرعة الحالية وسرعة الإفلات تقدير من طول المسار خلال آخر ١٢٠ ملث، والمتوسط يضم الوقفات. لا نقيس قوة ضغط الزر.</p><p>عتبات ٨ وحدات و٦٠٠ و٤٠٠ ملث اختيارات تعليمية لهذه التجربة؛ ليست قواعد ثابتة للماوس أو لكل برنامج. كل دورة هنا ضغط واحد حتى إفلاته؛ النقرات المتتابعة تحتاج سجلًا يربط عدة دورات.</p></details>
    <div class="sbtn-event-heading"><strong>ما الذي حدث ومتى؟</strong><span>الزمن منذ بدء الضغط</span></div><ol class="sbtn-events" data-sbtn-events></ol>
    <div class="sbtn-demo-tools"><div><strong>قارن إشارات مضبوطة</strong><p>هذه الأزرار تشغّل أمثلة مسجّلة. لا تضيف أزرارًا أو مفاتيح إلى الحركة المدروسة.</p></div><div class="sbtn-presets">${buttonTraces.map(trace=>`<button type="button" data-sbtn-preset="${trace.id}">${trace.label}</button>`).join('')}</div><button type="button" class="sbtn-reset" data-sbtn-reset>مسح التسجيل</button></div>
  </section>`;
  return container.querySelector('.sbtn-root');
}

function pointFromEvent(svg, event) {
  const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const matrix = svg.getScreenCTM(); return matrix ? point.matrixTransform(matrix.inverse()) : {x:0,y:0};
}

export function mountButtonLab(id, container, api) {
  if (!['button-trace','button-phases'].includes(id)) throw new Error(`Unknown single-button demonstration: ${id}`);
  const root = shell(id, container), svg = root.querySelector('.sbtn-board'), q = selector => root.querySelector(selector);
  const recorder = createButtonRecorder(), inspector=id==='button-trace'?createSampleInspector():null, controller = new AbortController(), on = (target, event, fn, options = {}) => target.addEventListener(event, fn, {...options, signal:controller.signal});
  let pointerId = null, beganAt = 0, raf = 0, version = 0, resolvePlayback = null, destroyed = false;
  let source = 'mouse', preset = '', note = '', lastPaint = 0, lastLive = 0;
  const emit = (kind, message, detail = '') => { if (!destroyed) api[kind]?.(message, detail); };
  const releaseCapture = () => { const old = pointerId; pointerId = null; if (old !== null) try { if (svg.hasPointerCapture(old)) svg.releasePointerCapture(old); } catch {} };
  function stopFrames() { version++; if (raf) cancelAnimationFrame(raf); raf = 0; if (resolvePlayback) { const resolve = resolvePlayback; resolvePlayback = null; resolve(false); } }
  function paintInspector(){
    if(!inspector)return;const s=inspector.snapshot(),r=s.row,el=q('[data-sbtn-inspector]'),slider=q('[data-sbtn-sample-index]'),marker=q('[data-sbtn-sample-marker]');
    el.dataset.sampleCount=String(s.count);el.dataset.sampleIndex=String(s.index);el.dataset.sampleSource=s.source||'none';el.dataset.samplePhase=r?.phase||'';el.dataset.sampleStatus=s.status;
    el.dataset.sampleX=r?String(r.x):'';el.dataset.sampleY=r?String(r.y):'';el.dataset.sampleT=r?String(r.t):'';
    q('[data-sbtn-sample-tools]').disabled=!s.count;slider.max=String(Math.max(1,s.count));slider.value=String(s.index+1||1);
    const pos=s.count?`${fmt(s.index+1)} من ${fmt(s.count)}`:'—';q('[data-sbtn-sample-number]').textContent=pos;slider.setAttribute('aria-valuetext',pos);
    q('[data-sbtn-sample-source]').textContent=s.source==='mouse'?'أحداث فعلية من الفأرة':s.source==='guide'?'عينات مولّدة للتسجيل المضبوط':'لا يوجد سجل';
    q('[data-sbtn-sample-phase]').textContent=r?({down:'بدء الضغط',move:'عينة أثناء الضغط',up:'الإفلات'}[r.phase]):'—';
    for(const k of ['x','y','t'])q(`[data-sbtn-sample-${k}]`).textContent=r?fmt(r[k],2):'—';
    marker.setAttribute('visibility',r?'visible':'hidden');if(r)marker.setAttribute('transform',`translate(${r.x} ${r.y})`);
    const outside=r&&(r.x<20||r.x>780||r.y<30||r.y>250);
    q('[data-sbtn-sample-note]').textContent=(s.source==='mouse'?'السجل الأصلي هنا هو ما استلمته الصفحة من أحداث الفأرة، محوّلًا إلى إحداثيات اللوحة. الزمن من طابع الحدث، ولا نضيف صفوفًا حين تتقدّم ساعة العرض واليد ثابتة.':s.source==='guide'?'هذه مواضع وأوقات مصطنعة معلنة، تولّدها إعادة تشغيل المسار المضبوط؛ ليست عينات التقطناها من فأرتك.':'ابدأ ضغطة حقيقية أو شغّل تسجيلًا مضبوطًا. يظهر مصدر العينات هنا.')+(s.status==='interrupted'?' انقطعت الدورة؛ لا يوجد صف إفلات مصطنع.':'')+(outside?' موضع العينة خارج مساحة الرسم المرئية.':'');
  }
  function paint(force = false) {
    const clock = performance.now(); if (!force && clock - lastPaint < 50) return; lastPaint = clock;
    const state = recorder.snapshot(), p = state.current;
    const phase = !state.active ? 'اضغط في أي موضع داخل اللوحة' : state.interrupted ? 'انقطعت الدورة دون إفلات مسجّل' : state.released ? `أُفلت الزر · ${kindLabels[state.kind]}` : state.pause >= buttonThresholds.pause ? 'الزر مضغوط · المؤشر ثابت' : state.firstDrag !== null ? 'الزر مضغوط · سحب' : 'الزر مضغوط · قبل عتبة السحب';
    q('[data-sbtn-phase]').textContent = phase;
    q('[data-sbtn-source]').textContent = source === 'guide' ? 'عرض مضبوط · إشارة محاكاة' : 'تجربة مباشرة بالفأرة';
    q('[data-sbtn-cycle="press"]').classList.toggle('done', state.active);
    q('[data-sbtn-cycle="held"]').classList.toggle('active', state.held);
    q('[data-sbtn-cycle="held"]').classList.toggle('done', state.active && !state.held);
    q('[data-sbtn-cycle="released"]').classList.toggle('done', state.released);
    q('[data-sbtn-target]').classList.toggle('inside', state.insideTarget);
    const stride = Math.max(1, Math.floor(state.points.length / 450));
    const drawPoints = state.points.filter((_, index) => index % stride === 0 || index === state.points.length - 1);
    q('[data-sbtn-path]').setAttribute('d', drawPoints.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' '));
    const net = q('[data-sbtn-displacement]'); net.setAttribute('visibility', state.active ? 'visible' : 'hidden');
    if (p) {
      for (const [key,value] of Object.entries({x1:state.origin.x,y1:state.origin.y,x2:p.x,y2:p.y})) net.setAttribute(key,value);
      q('[data-sbtn-start]').setAttribute('cx',state.origin.x); q('[data-sbtn-start]').setAttribute('cy',state.origin.y);
      q('[data-sbtn-pointer]').setAttribute('transform',`translate(${p.x} ${p.y})`);
    }
    q('[data-sbtn-start]').setAttribute('visibility',state.active?'visible':'hidden'); q('[data-sbtn-pointer]').setAttribute('visibility',state.active?'visible':'hidden');
    paintInspector();
    root.dataset.sbtnHeld = String(state.held); root.dataset.sbtnReleased = String(state.released); root.dataset.sbtnInterrupted = String(state.interrupted);
    root.dataset.sbtnSource = source; root.dataset.sbtnPreset = preset; root.dataset.sbtnKind = state.kind;
    for (const key of ['duration','displacement','maximumDisplacement','length','speed','meanSpeed','pause','maximumPause','targetDwell','longestDwell']) root.dataset['sbtn'+key[0].toUpperCase()+key.slice(1)] = String(rounded(state[key]));
    root.dataset.sbtnReleaseSpeed = state.releaseSpeed === null ? '' : String(rounded(state.releaseSpeed));
    root.dataset.sbtnFirstDrag = state.firstDrag === null ? '' : String(rounded(state.firstDrag));
    root.dataset.sbtnFlags = JSON.stringify(state.flags); root.dataset.sbtnEvents = JSON.stringify(state.events);
    root.dataset.sbtnX = p ? String(rounded(p.x)) : ''; root.dataset.sbtnY = p ? String(rounded(p.y)) : '';
    const time = value => `${fmt(value)} ملث`, speed = value => `${fmt(value,1)} وحدة/ث`;
    const metrics = [
      ['مدة الضغط',time(state.duration)],['قبل بدء السحب',state.firstDrag===null?'لم تبدأ حركة سحب':time(state.firstDrag)],
      ['الإزاحة عن البداية',`${fmt(state.displacement,1)} وحدة`],['طول المسار',`${fmt(state.length,1)} وحدة`],
      ['الثبات الحالي / الأخير',time(state.pause)],['أطول بقاء فوق الهدف',time(state.longestDwell)],
      ['السرعة الحالية التقريبية',speed(state.speed)],['متوسط السرعة',speed(state.meanSpeed)],
      ['سرعة الإفلات',state.releaseSpeed===null?'تُقرأ عند الإفلات':speed(state.releaseSpeed)],
      ['اتجاه آخر حركة',state.heading===null?'لا توجد حركة':`${fmt(state.heading)}° · من اليمين عكس الساعة`],
    ];
    q('[data-sbtn-metrics]').innerHTML = metrics.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    const status = !state.active ? 'الزر متروك. لا توجد دورة مسجّلة بعد.' : state.interrupted ? 'المقاطعة من النظام لا تُحسب إفلاتًا مقصودًا؛ احتُفظ بما قيس قبل الانقطاع.' : state.released ? `الزر متروك الآن. تصنيف هذه الدورة: ${kindLabels[state.kind]}.` : 'الزر ما زال مضغوطًا؛ القياسات تتحدث حتى لو توقفت اليد.';
    const statusText = note ? `${status} ${note}` : status;
    if (q('[data-sbtn-status]').textContent !== statusText) q('[data-sbtn-status]').textContent = statusText;
    q('[data-sbtn-events]').innerHTML = state.events.length ? [...state.events].sort((a,b)=>a.time-b.time).map(event=>`<li class="${event.key==='interrupt'?'interrupted':''}"><strong>${eventLabels[event.key]}</strong><span>${time(event.time)}</span></li>`).join('') : '<li class="sbtn-empty">ابدأ ضغطة لترى التسلسل.</li>';
    if (id === 'button-phases') for (const [key] of ruleCards) {
      const fired = !!state.flags[key], card = q(`[data-sbtn-rule="${key}"]`), event = state.events.find(event=>event.key===key);
      card.classList.toggle('fired',fired); card.dataset.fired = String(fired);
      q(`[data-sbtn-rule-mark="${key}"]`).textContent = fired ? '✓' : '○';
      q(`[data-sbtn-rule-output="${key}"]`).textContent = fired ? `حدث عند ${time(event.time)}` : state.interrupted ? 'لم يحدث قبل الانقطاع' : state.released ? 'لم يتحقق في هذه الدورة' : 'لم يحدث بعد';
    }
    if (state.held && clock - lastLive > 180) { lastLive = clock; emit('live',phase,`مدة الضغط ${time(state.duration)} · طول المسار ${fmt(state.length,1)} وحدة.`); }
  }
  function finalFeedback() {
    const state = recorder.snapshot();
    if (state.interrupted) emit('ready','انقطعت الدورة دون إفلات مقصود.','ابدأ ضغطة جديدة؛ المقاطعة ليست زرًا إضافيًا في التجربة.');
    else emit('done',`انتهت دورة زر واحد: ${kindLabels[state.kind]}.`,`مدة الضغط ${fmt(state.duration)} ملث · الإزاحة ${fmt(state.displacement,1)} · طول المسار ${fmt(state.length,1)} · سرعة الإفلات ${fmt(state.releaseSpeed||0,1)} وحدة/ث.`);
  }
  function interrupt(reason, silent = false) {
    const state = recorder.snapshot(); stopFrames(); releaseCapture();
    if (state.held) {
      inspector?.interrupt();
      const time = source === 'mouse' ? performance.now() - beganAt : state.duration;
      recorder.finish(state.current,time,true); note = reason; if (!silent) { paint(true); finalFeedback(); }
    }
  }
  function tickNative(token) {
    if (destroyed || token !== version || pointerId === null) return;
    recorder.advance(performance.now() - beganAt); paint(); raf = requestAnimationFrame(()=>tickNative(token));
  }
  function reset() { interrupt('',true); recorder.clear();inspector?.clear(); source='mouse';preset='';note='';paint(true);emit('ready','اضغط الزر الأساسي ثم تحرك أو اثبت وأفلت.','الاتجاه والسرعة والمدة تُقرأ من الدورة نفسها.'); }
  on(svg,'pointerdown',event=>{
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.buttons !== 1 || event.isPrimary === false || pointerId !== null) return;
    const point = pointFromEvent(svg,event); if (point.x<20||point.x>780||point.y<30||point.y>250) return;
    event.preventDefault();interrupt('',true);source='mouse';preset='';note='';beganAt=performance.now();recorder.begin(point,0);inspector?.begin(point,event.timeStamp,'mouse');pointerId=event.pointerId;
    try { svg.setPointerCapture(pointerId); } catch {}
    paint(true);const token=version;raf=requestAnimationFrame(()=>tickNative(token));
  });
  on(window,'pointermove',event=>{if(pointerId===null||event.pointerId!==pointerId)return;if(event.buttons!==1){interrupt('تغيّرت حالة الزر خارج دورة الإدخال المحددة.');return;}event.preventDefault();const p=pointFromEvent(svg,event);inspector?.append(p,event.timeStamp);recorder.sample(p,performance.now()-beganAt);paint();},{passive:false});
  on(window,'pointerup',event=>{if(pointerId===null||event.pointerId!==pointerId||event.button!==0)return;const p=pointFromEvent(svg,event);inspector?.append(p,event.timeStamp,'up');recorder.finish(p,performance.now()-beganAt);stopFrames();releaseCapture();paint(true);finalFeedback();});
  on(window,'pointercancel',event=>{if(event.pointerId===pointerId)interrupt('أوقف النظام التقاط المؤشر.');});
  on(svg,'lostpointercapture',()=>{if(pointerId!==null)interrupt('انقطع التقاط المؤشر.');});
  on(window,'blur',()=>interrupt('فقدت الصفحة التركيز.'));
  on(document,'visibilitychange',()=>{if(document.hidden)interrupt('أصبحت الصفحة غير ظاهرة.');});
  function play(presetId='pause') {
    const trace=buttonTraces.find(item=>item.id===presetId)||buttonTraces.find(item=>item.id==='pause');
    interrupt('',true);source='guide';preset=trace.id;note=trace.note;
    const samples=sampleButtonTrace(trace),end=samples[samples.length-1].t;
    recorder.begin(samples[0],0);inspector?.begin(samples[0],0,'guide');paint(true);const token=version;let index=1,started=null,lastGuidePaint=0;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The displayed guide always measures its declared sample times, including coarse RAFs.
    return new Promise(resolve=>{
      resolvePlayback=resolve;
      function tick(clock){
        if(destroyed||token!==version)return;
        if(started===null)started=clock;
        const elapsed=Math.min(end,clock-started);
        while(index<samples.length&&samples[index].t<=elapsed){const point=samples[index++];recorder.sample(point,point.t);if(index<samples.length)inspector?.append(point,point.t);}
        if(elapsed>=end){const last=samples[samples.length-1];inspector?.append(last,end,'up');recorder.finish(last,end);raf=0;resolvePlayback=null;paint(true);finalFeedback();resolve(true);return;}
        // No interpolated measurements are invented between the declared samples.
        if(!reduced)paint();else if(elapsed-lastGuidePaint>=200){paint(true);lastGuidePaint=elapsed;}
        raf=requestAnimationFrame(tick);
      }
      raf=requestAnimationFrame(tick);
    });
  }
  on(root,'click',event=>{const button=event.target.closest('button[data-sbtn-preset]');if(button){play(button.dataset.sbtnPreset);return;}if(event.target.closest('button[data-sbtn-reset]'))reset();});
  if(inspector){on(q('[data-sbtn-sample-index]'),'input',event=>{inspector.select(Number(event.currentTarget.value)-1);paintInspector();});on(root,'click',event=>{const b=event.target.closest('[data-sbtn-sample-jump]');if(!b)return;const n=inspector.snapshot().count;if(!n)return;inspector.select(b.dataset.sbtnSampleJump==='first'?0:b.dataset.sbtnSampleJump==='middle'?Math.floor((n-1)/2):n-1);paintInspector();});}
  reset();
  return {play:()=>play('pause'),destroy(){if(destroyed)return;destroyed=true;interrupt('',true);controller.abort();}};
}
