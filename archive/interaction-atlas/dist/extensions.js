const NS = 'http://www.w3.org/2000/svg';
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const fmt = value => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 }).format(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copyPoint = point => ({ x: point.x, y: point.y });
const setAttributes = (element, attributes) => { for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); };
const pathData = points => points.length ? points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ') : '';
const pointInRect = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
function pointerPoint(svg, event) { const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; const matrix = svg.getScreenCTM(); return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 }; }
function resample(points, count = 220) {
  if (points.length < 2) return points;
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths.at(-1) + distance(points[index - 1], points[index]));
  const total = lengths.at(-1);
  if (!total) return Array.from({ length: count }, () => copyPoint(points[0]));
  let segment = 1;
  return Array.from({ length: count }, (_, index) => {
    const at = index / (count - 1) * total;
    while (segment < lengths.length - 1 && lengths[segment] < at) segment++;
    const a = points[segment - 1], b = points[segment], span = lengths[segment] - lengths[segment - 1], fraction = span ? (at - lengths[segment - 1]) / span : 0;
    return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
  });
}
function createShell(container, caption, badge, scene, controls, cause, effect, extras = '') {
  container.innerHTML = `<section class="ext-root"><div class="ext-top"><span class="ext-caption">${caption}</span><span class="ext-badge">${badge}</span></div>${extras}<svg class="ext-board" viewBox="0 0 900 340" role="group" aria-label="${caption}">${scene}<g class="ext-demo-pointer" visibility="hidden"><circle r="19"/><path d="M-5-11V16l7-7 9 3-16-23Z"/></g></svg><div class="ext-controls">${controls}</div><div class="ext-causal"><span>نقرأ <strong>${cause}</strong></span><b aria-hidden="true">←</b><span>يحدث <strong>${effect}</strong></span></div></section>`;
  return { root: container.querySelector('.ext-root'), svg: container.querySelector('.ext-board'), badge: container.querySelector('.ext-badge') };
}
function createRuntime(svg, api) {
  const controller = new AbortController();
  let active = null, pending = null, frame = 0, version = 0, destroyed = false, lastMessage = '';
  const pointer = svg.querySelector('.ext-demo-pointer');
  const on = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: controller.signal });
  const emit = (kind, message, detail = '') => { const signature = `${kind}|${message}|${detail}`; if (!destroyed && signature !== lastMessage) { lastMessage = signature; api[kind]?.(message, detail); } };
  function release(gesture) { try { if (svg.hasPointerCapture(gesture.pointerId)) svg.releasePointerCapture(gesture.pointerId); } catch {} }
  function cancelGesture() { if (!active) return; const previous = active; active = null; release(previous); previous.cancel?.(); }
  function cancelPlayback() {
    version++; if (frame) cancelAnimationFrame(frame); frame = 0;
    if (pending) { const previous = pending; pending = null; previous.step.cancel?.(); previous.resolve(false); }
    pointer.setAttribute('visibility', 'hidden');
  }
  function stop() { cancelGesture(); cancelPlayback(); }
  on(window, 'pointermove', event => { if (event.pointerId !== active?.pointerId) return; event.preventDefault(); active.move?.(pointerPoint(svg, event)); }, { passive: false });
  on(window, 'pointerup', event => { if (event.pointerId !== active?.pointerId) return; const previous = active; active = null; release(previous); previous.end?.(pointerPoint(svg, event)); });
  on(window, 'pointercancel', event => { if (event.pointerId === active?.pointerId) cancelGesture(); });
  on(svg, 'lostpointercapture', () => { if (active) cancelGesture(); });
  on(window, 'blur', stop);
  on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  on(window, 'keydown', event => { if (event.key === 'Escape' && (active || pending)) { event.preventDefault(); stop(); } });
  function begin(event, callbacks) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stop(); event.preventDefault(); active = { ...callbacks, pointerId: event.pointerId }; callbacks.start?.(pointerPoint(svg, event));
    try { svg.setPointerCapture(event.pointerId); } catch {}
  }
  function animate(step, token) {
    return new Promise(resolve => {
      if (token !== version || destroyed) { resolve(false); return; }
      const samples = step.points ? resample(step.points) : null;
      const first = step.timeline ? step.timeline[0].point : samples[0];
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = step.duration || 2700;
      let started = null, lastIndex = 0;
      pending = { step, resolve }; step.start?.(first); pointer.setAttribute('visibility', 'visible');
      function tick(now) {
        if (token !== version || destroyed) return;
        if (started === null) started = now;
        const progress = clamp((now - started) / duration, 0, 1);
        let point;
        if (step.timeline) {
          let segment = 1; while (segment < step.timeline.length - 1 && step.timeline[segment].at < progress) segment++;
          const a = step.timeline[segment - 1], b = step.timeline[segment];
          const fraction = reduced ? (progress >= b.at ? 1 : 0) : clamp((progress - a.at) / (b.at - a.at), 0, 1);
          point = { x: a.point.x + (b.point.x - a.point.x) * fraction, y: a.point.y + (b.point.y - a.point.y) * fraction };
          step.move?.(point);
        } else {
          const visualProgress = reduced ? (progress < .45 ? 0 : progress < 1 ? .5 : 1) : progress;
          const index = Math.floor(visualProgress * (samples.length - 1));
          for (let i = lastIndex; i <= index; i++) step.move?.(samples[i]);
          lastIndex = index + 1; point = samples[index];
        }
        pointer.setAttribute('transform', `translate(${point.x + 10} ${point.y + 12})`);
        if (progress < 1) { frame = requestAnimationFrame(tick); return; }
        frame = 0; pending = null; step.end?.(point); pointer.setAttribute('visibility', 'hidden'); resolve(true);
      }
      frame = requestAnimationFrame(tick);
    });
  }
  async function playSteps(steps) { stop(); const token = version; for (const step of steps) { if (destroyed || token !== version) return; if (!(await animate(step, token))) return; } }
  return { on, emit, begin, stop, playSteps, destroy() { destroyed = true; stop(); controller.abort(); } };
}
function documentArt(label = 'بطاقة', identity = 'A-01') { return `<rect x="-66" y="-42" width="132" height="84" rx="12" fill="#fffdf5" stroke="#bdcdb0" stroke-width="2"/><path d="M-48-20h17v23h-17Z" fill="#dae7cb"/><path d="M-44-13h9m-9 6h9" stroke="#7e9f67" stroke-width="2"/><text class="ext-strong" x="13" y="-6">${label}</text><text class="ext-id" x="0" y="24">${identity}</text>`; }
function surface() { return '<rect x="45" y="20" width="810" height="295" rx="20" fill="#eff2e6" stroke="#d9e1ce" stroke-width="2"/>'; }

function mountTurns(container, api) {
  const center = { x: 450, y: 164 }, radius = 105;
  const scene = `${surface()}<circle cx="450" cy="164" r="126" fill="#e5ecd9"/>${Array.from({ length: 24 }, (_, index) => { const angle = index * Math.PI / 12, a = 112, b = index % 6 ? 118 : 125; return `<path d="M${center.x + Math.cos(angle) * a} ${center.y + Math.sin(angle) * a}L${center.x + Math.cos(angle) * b} ${center.y + Math.sin(angle) * b}" stroke="#93ab7d" stroke-width="${index % 6 ? 1.5 : 3}"/>`; }).join('')}<circle cx="450" cy="164" r="105" fill="none" stroke="#c6d7b8" stroke-width="9"/><circle data-ext-turn-arc cx="450" cy="164" r="105" fill="none" stroke="#d38352" stroke-width="9" stroke-linecap="round"/><circle cx="450" cy="164" r="84" fill="#faf8ef" stroke="#d4dfc7"/><text data-ext-angle-display x="450" y="165" text-anchor="middle" fill="#166353" font-size="42" font-weight="700">٠°</text><text class="ext-label" x="450" y="195">زاوية الموضع الآن</text><g class="ext-grabbable ext-focusable" data-ext-turn-handle role="button" tabindex="0" aria-label="مقبض الدوران؛ السهمان يغيّران الزاوية بمقدار ١٥ درجة"><circle class="ext-focus-ring" r="23" fill="#166353" stroke="#fffdf5" stroke-width="4"/><path d="M-6-5h12m-12 10h12" stroke="#e6eed7" stroke-width="2.5" stroke-linecap="round"/></g><text class="ext-label" x="450" y="301">العودة إلى الموضع نفسه تحتفظ بالدورة التي قطعتها</text>`;
  const metrics = '<div class="ext-metrics"><div class="ext-metric"><span>الزاوية المتراكمة</span><strong data-ext-total-readout>٠°</strong></div><div class="ext-metric"><span>صافي الدورات الكاملة</span><strong data-ext-turns-readout>٠</strong></div></div>';
  const { root, svg, badge } = createShell(container, 'اسحب المقبض حول الدائرة، وأكمل دورة ثم تابع.', 'لم تبدأ دورة بعد', scene, '<button class="ext-button" data-ext-turn-by="90">ربع دورة +٩٠°</button><button class="ext-button" data-ext-turn-by="360">دورة كاملة +٣٦٠°</button><button class="ext-button" data-ext-turn-by="-90">عكس ربع دورة</button>', 'فروق الزاوية المتتابعة', 'دوران متراكم لا يُصفّر عند نقطة البداية', metrics);
  const ctx = createRuntime(svg, api), handle = svg.querySelector('[data-ext-turn-handle]');
  let total = 0, before = 0, lastAngle = 0;
  const angleAt = point => Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
  function render() {
    const current = ((total % 360) + 360) % 360, radians = current * Math.PI / 180;
    const turns = Math.sign(total) * Math.floor((Math.abs(total) + 1e-7) / 360);
    setAttributes(handle, { transform: `translate(${center.x + Math.cos(radians) * radius} ${center.y + Math.sin(radians) * radius})`, 'aria-label': `الزاوية الحالية ${fmt(current)} درجة، المتراكم ${fmt(total)} درجة. استخدم السهمين للدوران.` });
    const circumference = 2 * Math.PI * radius;
    svg.querySelector('[data-ext-turn-arc]').setAttribute('stroke-dasharray', `${current / 360 * circumference} ${circumference}`);
    svg.querySelector('[data-ext-angle-display]').textContent = `${fmt(current)}°`;
    root.querySelector('[data-ext-total-readout]').textContent = `${fmt(total)}°`;
    root.querySelector('[data-ext-turns-readout]').textContent = fmt(turns);
    root.dataset.extCurrentAngle = String(Number(current.toFixed(3)));
    root.dataset.extTotalAngle = String(Number(total.toFixed(3)));
    root.dataset.extTurnCount = String(turns);
    badge.textContent = turns ? `${fmt(turns)} دورة كاملة محفوظة` : 'تتبّع الزاوية المتراكمة';
  }
  function start(point) { before = total; lastAngle = angleAt(point); root.dataset.extPending = 'true'; }
  function move(point) {
    if (distance(point, center) < 32) return;
    const angle = angleAt(point);
    let delta = angle - lastAngle;
    if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
    total += delta; lastAngle = angle; render();
    ctx.emit('live', `الزاوية المتراكمة الآن ${fmt(total)}°.`, 'كل دورة كاملة تُضاف إلى المجموع حتى عندما يعود المقبض إلى موضعه السابق.');
  }
  function end(point) { move(point); root.dataset.extPending = 'false'; ctx.emit(Math.abs(total - before) > .1 ? 'done' : 'ready', `الموضع ${fmt(((total % 360) + 360) % 360)}°، والمتراكم ${fmt(total)}°.`, 'الإشارة الموجبة مع عقارب الساعة، والسالبة عكسها.'); }
  function cancel() { total = before; root.dataset.extPending = 'false'; render(); ctx.emit('ready', 'أُلغي السحب وعاد التراكم إلى قيمته السابقة.'); }
  ctx.on(svg, 'pointerdown', event => { if (event.target.closest('[data-ext-turn-handle]')) ctx.begin(event, { start, move, end, cancel }); });
  function increment(value) { ctx.stop(); total += value; render(); ctx.emit('done', `أُضيف ${fmt(value)}°؛ المتراكم ${fmt(total)}°.`, 'تغيّرت القراءة التراكمية مع بقاء قياس الموضع ضمن دورة واحدة.'); }
  root.querySelectorAll('[data-ext-turn-by]').forEach(button => ctx.on(button, 'click', () => increment(Number(button.dataset.extTurnBy))));
  ctx.on(handle, 'keydown', event => { const steps = { ArrowRight: 15, ArrowLeft: -15, ArrowUp: 90, ArrowDown: -90, Enter: 360, ' ': 360 }; if (event.key in steps) { event.preventDefault(); increment(steps[event.key]); } });
  render();
  return { destroy: ctx.destroy, play() { ctx.stop(); total = 0; render(); const points = Array.from({ length: 151 }, (_, index) => { const angle = index / 150 * Math.PI * 2.5; return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }; }); return ctx.playSteps([{ points, duration: 3200, start, move, end, cancel }]); } };
}

function mountDwell(container, api) {
  const hoverBounds = { x: 382, y: 52, width: 444, height: 253 };
  const targets = { designs: { x: 414, y: 165, width: 175, height: 125 }, notes: { x: 611, y: 165, width: 175, height: 125 } };
  const positions = { source: { x: 170, y: 164 }, designs: { x: 501.5, y: 241 }, notes: { x: 698.5, y: 241 } };
  const scene = `${surface()}<text class="ext-strong" x="170" y="67">المصدر</text><rect x="87" y="107" width="166" height="114" rx="15" fill="none" stroke="#c5d3b7" stroke-width="2" stroke-dasharray="6 5"/><text class="ext-small" data-ext-source-count x="170" y="271">ملف واحد</text><path d="M386 95V66q0-13 13-13h139l22 23h250q12 0 12 12v202q0 13-13 13H399q-13 0-13-13Z" fill="#d7bf87" stroke="#c4a86b" stroke-width="2"/><text class="ext-strong" x="604" y="119">مجلد المشروع</text><g data-ext-folder-closed><text class="ext-label" x="604" y="177">ابقَ فوق المجلد دون إفلات</text><rect class="ext-progress-track" x="454" y="211" width="300" height="14" rx="7"/><rect class="ext-progress-fill" data-ext-dwell-bar x="454" y="211" width="0" height="14" rx="7"/><text class="ext-small" data-ext-dwell-timer x="604" y="258">٠ / ٩٠٠ مللي ثانية</text></g><g data-ext-folder-open visibility="hidden">${Object.entries(targets).map(([key, rect]) => `<rect class="ext-folder-target" data-ext-folder-target="${key}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="13"/><text class="ext-label" x="${rect.x + rect.width / 2}" y="194">${key === 'designs' ? 'التصاميم' : 'الملاحظات'}</text>`).join('')}</g><g class="ext-grabbable ext-focusable" data-ext-dwell-document role="button" tabindex="0" aria-label="الملف A-01؛ اسحبه إلى المجلد، أو استخدم الأزرار أدناه">${documentArt('ملف')}</g><g class="ext-ghost" data-ext-dwell-ghost visibility="hidden">${documentArt('ملف')}</g>`;
  const controls = '<button class="ext-button" data-ext-open-folder>فتح المجلد بالنقر</button><button class="ext-button" data-ext-dwell-destination="designs" disabled>نقل إلى التصاميم</button><button class="ext-button" data-ext-dwell-destination="notes" disabled>نقل إلى الملاحظات</button><span class="ext-note" data-ext-dwell-location>موضع الملف: المصدر</span>';
  const { root, svg, badge } = createShell(container, 'احمل الملف فوق المجلد لمدة ٩٠٠ مللي ثانية، ثم اختر وجهة داخله.', 'المجلد مغلق', scene, controls, 'مدة البقاء فوق الهدف أثناء الحمل', 'فتح المجلد قبل الإفلات');
  const ctx = createRuntime(svg, api), item = svg.querySelector('[data-ext-dwell-document]'), ghost = svg.querySelector('[data-ext-dwell-ghost]');
  let opened = false, location = 'source', dragging = false, before = null, hoverStarted = null, hoverFrame = 0, progress = 0, lastPoint = positions.source;
  function stopHover(reset = true) { if (hoverFrame) cancelAnimationFrame(hoverFrame); hoverFrame = 0; hoverStarted = null; if (reset) progress = 0; }
  function render() {
    svg.querySelector('[data-ext-folder-closed]').setAttribute('visibility', opened ? 'hidden' : 'visible');
    svg.querySelector('[data-ext-folder-open]').setAttribute('visibility', opened ? 'visible' : 'hidden');
    svg.querySelector('[data-ext-dwell-bar]').setAttribute('width', progress * 300);
    svg.querySelector('[data-ext-dwell-timer]').textContent = `${fmt(Math.round(progress * 900))} / ٩٠٠ مللي ثانية`;
    item.setAttribute('transform', `translate(${positions[location].x} ${positions[location].y})`); item.setAttribute('visibility', dragging ? 'hidden' : 'visible');
    svg.querySelector('[data-ext-source-count]').textContent = location === 'source' ? 'ملف واحد في المصدر' : 'المصدر فارغ';
    root.querySelectorAll('[data-ext-dwell-destination]').forEach(button => { button.disabled = !opened || button.dataset.extDwellDestination === location; });
    const locationName = location === 'source' ? 'المصدر' : location === 'designs' ? 'التصاميم' : 'الملاحظات';
    root.querySelector('[data-ext-dwell-location]').textContent = `موضع الملف: ${locationName}`;
    badge.textContent = opened ? 'المجلد مفتوح؛ اختر وجهة' : progress > 0 ? `الانتظار ${fmt(Math.round(progress * 100))}٪` : 'المجلد مغلق';
    root.dataset.extFolderOpen = String(opened); root.dataset.extDwellProgress = String(Math.round(progress * 100)); root.dataset.extLocation = location; root.dataset.extPending = String(dragging);
  }
  function hoverTick(now) {
    hoverFrame = 0;
    if (!dragging || opened || hoverStarted === null || !pointInRect(lastPoint, hoverBounds)) return;
    progress = clamp((now - hoverStarted) / 900, 0, 1);
    if (progress >= 1) { opened = true; hoverStarted = null; render(); ctx.emit('live', 'فُتح المجلد والملف ما زال محمولًا.', 'حرّكه إلى التصاميم أو الملاحظات ثم أفلت.'); return; }
    render(); hoverFrame = requestAnimationFrame(hoverTick);
  }
  function start(point) { before = { opened, location }; dragging = true; lastPoint = copyPoint(point); setAttributes(ghost, { visibility: 'visible', transform: `translate(${point.x} ${point.y})` }); render(); }
  function move(point) {
    lastPoint = copyPoint(point); ghost.setAttribute('transform', `translate(${point.x} ${point.y})`);
    if (!opened) {
      if (pointInRect(point, hoverBounds)) { if (hoverStarted === null) { hoverStarted = performance.now(); hoverFrame = requestAnimationFrame(hoverTick); ctx.emit('live', 'ابقَ فوق المجلد دون إفلات.', 'الخروج منه قبل اكتمال ٩٠٠ مللي ثانية يُلغي المؤقت.'); } }
      else if (hoverStarted !== null) { stopHover(); render(); ctx.emit('live', 'خرجت من المجلد؛ أُعيد المؤقت إلى الصفر.'); }
    }
    for (const [key, rect] of Object.entries(targets)) svg.querySelector(`[data-ext-folder-target="${key}"]`).dataset.hover = String(opened && pointInRect(point, rect));
  }
  function finishVisual() { stopHover(false); dragging = false; ghost.setAttribute('visibility', 'hidden'); root.querySelectorAll('[data-ext-folder-target]').forEach(target => target.dataset.hover = 'false'); }
  function end(point) {
    const destination = opened ? Object.keys(targets).find(key => pointInRect(point, targets[key])) : null;
    finishVisual();
    if (destination) { location = destination; progress = 1; render(); ctx.emit('done', `انتقل الملف إلى ${destination === 'designs' ? 'التصاميم' : 'الملاحظات'}.`, 'فتح الانتظار المجلد أثناء الحمل، ثم حدّد الإفلات موضع الملف.'); }
    else { opened = before.opened; location = before.location; progress = opened ? 1 : 0; render(); ctx.emit('fail', 'لم ينتقل الملف؛ أفلت داخل وجهة مفتوحة.', 'احتُفظ بموضع الملف وحالة المجلد قبل الحركة.'); }
  }
  function cancel() { finishVisual(); opened = before.opened; location = before.location; progress = opened ? 1 : 0; render(); ctx.emit('ready', 'أُلغي الحمل وعادت حالة المجلد والملف السابقة.'); }
  ctx.on(svg, 'pointerdown', event => { if (event.target.closest('[data-ext-dwell-document]')) ctx.begin(event, { start, move, end, cancel }); });
  ctx.on(root.querySelector('[data-ext-open-folder]'), 'click', () => { ctx.stop(); stopHover(); opened = true; progress = 1; render(); ctx.emit('ready', 'فُتح المجلد بالنقر. اختر وجهة لنقل الملف.'); });
  ctx.on(item, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); root.querySelector('[data-ext-open-folder]').click(); } });
  root.querySelectorAll('[data-ext-dwell-destination]').forEach(button => ctx.on(button, 'click', () => { ctx.stop(); if (!opened) return; location = button.dataset.extDwellDestination; render(); ctx.emit('done', `انتقل الملف إلى ${location === 'designs' ? 'التصاميم' : 'الملاحظات'} بالنقر.`, 'هذا بديل متاح دون حمل المؤشر.'); }));
  render();
  return { destroy() { stopHover(); ctx.destroy(); }, play() { ctx.stop(); stopHover(); opened = false; location = 'source'; progress = 0; dragging = false; render(); return ctx.playSteps([{ timeline: [{ at: 0, point: positions.source }, { at: .23, point: { x: 604, y: 130 } }, { at: .75, point: { x: 604, y: 130 } }, { at: 1, point: positions.designs }], duration: 3300, start, move, end, cancel }]); } };
}

function mountRelations(container, api) {
  const targetBounds = { x: 553, y: 31, width: 294, height: 280 };
  const sourcePosition = { x: 201, y: 158 };
  const scene = `${surface()}<rect x="61" y="31" width="294" height="280" rx="17" fill="#e7eddc"/><rect class="ext-relation-target" data-ext-relation-target x="553" y="31" width="294" height="280" rx="17"/><text class="ext-strong" x="208" y="70">المصدر</text><text class="ext-strong" x="700" y="67">الهدف</text><text class="ext-small" data-ext-relation-source-label x="208" y="268">عنصر أصلي واحد</text><g data-ext-relation-link></g><g class="ext-grabbable ext-focusable" data-ext-relation-source role="button" tabindex="0" aria-label="الوصفة الأصلية A-01؛ اسحبها إلى الهدف أو اضغط Enter" transform="translate(201 158)">${documentArt('الوصفة')}</g><g data-ext-relation-items></g><g class="ext-ghost" data-ext-relation-ghost visibility="hidden">${documentArt('الوصفة')}</g>`;
  const tabs = '<div class="ext-tabs" role="tablist" aria-label="عملية السحب"><button class="ext-button" role="tab" aria-selected="true" data-ext-relation-tab="move">نقل</button><button class="ext-button" role="tab" aria-selected="false" data-ext-relation-tab="copy">نسخ</button><button class="ext-button" role="tab" aria-selected="false" data-ext-relation-tab="link">ربط</button></div>';
  const controls = '<button class="ext-button" data-ext-relation-apply>تنفيذ العملية بالنقر</button><span class="ext-note" data-ext-relation-rule></span>';
  const { root, svg, badge } = createShell(container, 'اختر العملية ثم اسحب الوصفة نفسها إلى الهدف. تبديل العملية يعيد المثال.', 'العملية: نقل', scene, controls, 'العملية المختارة + وجهة الإفلات', 'تغيير العضوية أو إنشاء هوية أو علاقة', tabs);
  const ctx = createRuntime(svg, api), ghost = svg.querySelector('[data-ext-relation-ghost]'), sourceElement = svg.querySelector('[data-ext-relation-source]'), targetElement = svg.querySelector('[data-ext-relation-target]');
  let operation = 'move', source = ['A-01'], target = ['B-01'], links = [], nextId = 2, dragging = false;
  const names = { move: 'نقل', copy: 'نسخ', link: 'ربط' };
  const rules = { move: 'النقل يغيّر العضوية ويحفظ هوية A-01.', copy: 'النسخ يُبقي الأصل ويُنشئ هوية جديدة. سعة الهدف ٣ عناصر.', link: 'الربط يُبقي العنصرين ويُنشئ وصلة A-01 → B-01.' };
  function render() {
    root.querySelectorAll('[data-ext-relation-tab]').forEach(button => button.setAttribute('aria-selected', button.dataset.extRelationTab === operation));
    sourceElement.setAttribute('visibility', source.length && !dragging ? 'visible' : 'hidden');
    svg.querySelector('[data-ext-relation-source-label]').textContent = source.length ? 'الأصل موجود: A-01' : 'أُزيل الأصل من المصدر';
    svg.querySelector('[data-ext-relation-items]').innerHTML = target.map((identity, index) => `<g data-ext-target-identity="${identity}" transform="translate(700 ${115 + index * 82})"><rect x="-106" y="-33" width="212" height="66" rx="11" fill="${identity === 'B-01' ? '#d8e4c8' : '#fffaf0'}" stroke="#b5c7a5" stroke-width="2"/><text class="ext-label" x="0" y="-5">${identity === 'B-01' ? 'قائمة اليوم' : identity === 'A-01' ? 'الوصفة الأصلية' : 'نسخة من الوصفة'}</text><text class="ext-id" x="0" y="21">${identity}</text></g>`).join('');
    svg.querySelector('[data-ext-relation-link]').innerHTML = links.length ? '<path class="ext-link" d="M270 158C390 72 506 71 594 115"/><circle cx="270" cy="158" r="5" fill="#3f835c"/><path d="m582 105 14 11-17 4" fill="none" stroke="#3f835c" stroke-width="4" stroke-linejoin="round"/><rect x="385" y="88" width="115" height="30" rx="15" fill="#e3efd7"/><text class="ext-small" x="442" y="109">وصلة واحدة</text>' : '';
    root.querySelector('[data-ext-relation-rule]').textContent = rules[operation];
    root.querySelector('[data-ext-relation-apply]').disabled = !source.length || (operation === 'copy' && target.length >= 3) || (operation === 'link' && links.length > 0);
    badge.textContent = `العملية: ${names[operation]} · المصدر ${fmt(source.length)} / الهدف ${fmt(target.length)}`;
    root.dataset.extOperation = operation; root.dataset.extSourceIds = source.join(','); root.dataset.extTargetIds = target.join(','); root.dataset.extLinkCount = String(links.length); root.dataset.extLinks = links.map(link => `${link.from}:${link.to}`).join(','); root.dataset.extPending = String(dragging);
  }
  function reset() { source = ['A-01']; target = ['B-01']; links = []; nextId = 2; dragging = false; ghost.setAttribute('visibility', 'hidden'); targetElement.dataset.hover = 'false'; badge.dataset.invalid = 'false'; render(); }
  function apply() {
    if (!source.length) { render(); ctx.emit('fail', 'لم يبقَ عنصر في المصدر لنقله.'); return; }
    if (operation === 'move') { source = []; target.push('A-01'); render(); ctx.emit('done', 'انتقلت A-01 من المصدر إلى الهدف.', 'بقيت الهوية نفسها، وتغيّرت عضوية العنصر فقط.'); }
    else if (operation === 'copy') {
      if (target.length >= 3) { render(); ctx.emit('fail', 'الهدف ممتلئ؛ لم تُنشأ نسخة إضافية.', 'سعة هذا المثال ثلاثة عناصر في الهدف.'); return; }
      const identity = `A-${String(nextId++).padStart(2, '0')}`; target.push(identity); render(); ctx.emit('done', `أُنشئت النسخة ${identity} وبقي الأصل A-01.`, 'للنسخة هوية مستقلة عن الأصل.');
    } else {
      if (links.length) { render(); ctx.emit('fail', 'الوصلة موجودة بالفعل؛ لم تتكرر.', 'لم تتغير عضوية أي عنصر.'); return; }
      links.push({ from: 'A-01', to: 'B-01' }); render(); ctx.emit('done', 'أُنشئت وصلة من A-01 إلى B-01.', 'بقي العنصر الأصلي في المصدر، وبقيت قائمة اليوم في الهدف.');
    }
  }
  function start(point) { dragging = true; setAttributes(ghost, { visibility: 'visible', transform: `translate(${point.x} ${point.y})` }); badge.dataset.invalid = 'false'; render(); }
  function move(point) { ghost.setAttribute('transform', `translate(${point.x} ${point.y})`); targetElement.dataset.hover = String(pointInRect(point, targetBounds)); ctx.emit('live', `العملية المختارة: ${names[operation]}.`, rules[operation]); }
  function finish() { dragging = false; ghost.setAttribute('visibility', 'hidden'); targetElement.dataset.hover = 'false'; }
  function end(point) { finish(); if (pointInRect(point, targetBounds)) apply(); else { badge.dataset.invalid = 'true'; render(); ctx.emit('fail', 'لم تُنفّذ العملية؛ أفلت داخل الهدف.', 'لم تتغير الهويات أو العضوية أو الوصلات.'); } }
  function cancel() { finish(); render(); ctx.emit('ready', 'أُلغي السحب دون تغيير العملية أو البيانات.'); }
  ctx.on(svg, 'pointerdown', event => { if (source.length && event.target.closest('[data-ext-relation-source]')) ctx.begin(event, { start, move, end, cancel }); });
  ctx.on(root.querySelector('[data-ext-relation-apply]'), 'click', () => { ctx.stop(); apply(); });
  ctx.on(sourceElement, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ctx.stop(); apply(); } });
  const tabButtons = [...root.querySelectorAll('[data-ext-relation-tab]')];
  tabButtons.forEach((button, index) => {
    ctx.on(button, 'click', () => { ctx.stop(); operation = button.dataset.extRelationTab; reset(); ctx.emit('ready', `اختيرت عملية ${names[operation]}.`, 'أُعيد المثال إلى عنصر في المصدر وعنصر في الهدف.'); });
    ctx.on(button, 'keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = tabButtons[(index + (event.key === 'ArrowLeft' ? 1 : 2)) % 3]; next.click(); next.focus(); } });
  });
  reset();
  return { destroy: ctx.destroy, play() { ctx.stop(); reset(); return ctx.playSteps([{ points: [sourcePosition, { x: 430, y: 112 }, { x: 700, y: 115 }], duration: 2400, start, move, end, cancel }]); } };
}

function polygonArea(points) { return Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0)) / 2; }
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index], b = polygon[previous];
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const at = length ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1) : 0;
    if (Math.hypot(point.x - a.x - at * dx, point.y - a.y - at * dy) < 1) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function polygonCrossesItself(points) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let a = 0; a < points.length; a++) for (let b = a + 2; b < points.length; b++) {
    if (a === 0 && b === points.length - 1) continue;
    const p = points[a], q = points[(a + 1) % points.length], r = points[b], s = points[(b + 1) % points.length];
    if (cross(p, q, r) * cross(p, q, s) < -1e-6 && cross(r, s, p) * cross(r, s, q) < -1e-6) return true;
  }
  return false;
}
function mountLasso(container, api) {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, x: 145 + (index % 5) * 150, y: index < 5 ? 101 : 238 }));
  const demoPath = [{ x: 80, y: 42 }, { x: 510, y: 42 }, { x: 540, y: 140 }, { x: 470, y: 164 }, { x: 85, y: 155 }, { x: 80, y: 42 }];
  const scene = `${surface()}${items.map(item => `<g class="ext-lasso-item ext-clickable ext-focusable" data-ext-lasso-item="${item.id}" data-selected="false" role="button" aria-pressed="false" aria-label="العنصر ${fmt(item.id)}" tabindex="0" transform="translate(${item.x} ${item.y})"><rect class="ext-item-bg ext-focus-ring" x="-43" y="-39" width="86" height="78" rx="15"/><path d="M-23-16h46v30h-46Z" fill="#d2bc8d"/><path d="M-23-16 0-27 23-16 0-4Z" fill="#e5d4ad"/><path d="M0-4v18" stroke="#b59a6e" stroke-width="2"/><text class="ext-id" x="0" y="32">${fmt(item.id)}</text><g class="ext-check"><circle cx="32" cy="-28" r="12" fill="#166353"/><path d="m26-28 4 4 8-9" stroke="#fff" stroke-width="2" fill="none"/></g></g>`).join('')}<path class="ext-lasso-path" data-ext-lasso-path d="" pointer-events="none"/><circle data-ext-lasso-origin r="28" fill="none" stroke="#6c9861" stroke-width="2" stroke-dasharray="4 5" visibility="hidden" pointer-events="none"/>`;
  const { root, svg, badge } = createShell(container, 'ارسم حدًا مغلقًا حول العناصر، ثم أفلت بالقرب من نقطة البداية.', '٠ عناصر محدّدة', scene, '<button class="ext-button" data-ext-lasso-three>تحديد العناصر ١، ٢، ٣ بالنقر</button><button class="ext-button" data-ext-lasso-clear>مسح التحديد</button><span class="ext-note">يمكن أيضًا تحديد العناصر منفردة بالنقر أو Enter.</span>', 'المسار المغلق الذي رسمته', 'تحديد مراكز العناصر داخل حدوده');
  const ctx = createRuntime(svg, api), ink = svg.querySelector('[data-ext-lasso-path]'), origin = svg.querySelector('[data-ext-lasso-origin]');
  let selected = new Set(), before = new Set(), points = [], oldInk = '', oldInvalid = 'false', outside = false, tooLong = false;
  const bounds = { x: 50, y: 25, width: 800, height: 285 };
  function render() { for (const item of items) { const element = svg.querySelector(`[data-ext-lasso-item="${item.id}"]`); element.dataset.selected = String(selected.has(item.id)); element.setAttribute('aria-pressed', selected.has(item.id)); } badge.textContent = `${fmt(selected.size)} عناصر محدّدة`; root.dataset.extSelectedIds = [...selected].sort((a, b) => a - b).join(','); root.dataset.extSelectedCount = String(selected.size); }
  function start(point) { before = new Set(selected); points = [copyPoint(point)]; outside = false; tooLong = false; oldInk = ink.getAttribute('d') || ''; oldInvalid = ink.dataset.invalid || 'false'; ink.dataset.invalid = 'false'; ink.setAttribute('d', pathData(points)); setAttributes(origin, { cx: point.x, cy: point.y, visibility: 'visible' }); badge.dataset.invalid = 'false'; root.dataset.extPending = 'true'; ctx.emit('live', 'ارسم محيطًا ثم عُد إلى دائرة البداية.'); }
  function move(point) { if (!pointInRect(point, bounds)) outside = true; if (distance(point, points.at(-1)) < 2) return; if (points.length >= 800) { tooLong = true; return; } points.push(copyPoint(point)); ink.setAttribute('d', pathData(points)); badge.textContent = points.length > 5 && distance(point, points[0]) <= 28 ? 'قريب من البداية؛ يمكنك الإفلات' : 'أغلق المسار حول العناصر'; }
  function end(point) {
    move(point); root.dataset.extPending = 'false'; origin.setAttribute('visibility', 'hidden');
    const length = points.slice(1).reduce((sum, item, index) => sum + distance(item, points[index]), 0);
    let error = outside ? 'ارسم المسار داخل مساحة التحديد.' : tooLong ? 'المسار طويل جدًا؛ جرّب محيطًا أبسط.' : points.length < 6 || length < 120 || polygonArea(points) < 1600 ? 'المسار قصير جدًا لتكوين مساحة تحديد.' : distance(points[0], points.at(-1)) > 28 ? 'المسار مفتوح؛ عُد إلى نقطة البداية قبل الإفلات.' : '';
    const polygon = [...points]; if (polygon.length > 1 && distance(polygon[0], polygon.at(-1)) < 1) polygon.pop();
    if (!error && polygonCrossesItself(polygon)) error = 'المسار يتقاطع مع نفسه؛ ارسم حدًا بسيطًا.';
    if (error) { selected = new Set(before); render(); ink.dataset.invalid = 'true'; badge.dataset.invalid = 'true'; root.dataset.extLassoClosed = 'false'; ctx.emit('fail', error, 'احتُفظ بالتحديد السابق دون تغيير.'); return; }
    selected = new Set(items.filter(item => pointInPolygon(item, polygon)).map(item => item.id)); ink.setAttribute('d', pathData(points) + 'Z'); ink.dataset.invalid = 'false'; root.dataset.extLassoClosed = 'true'; render();
    ctx.emit(selected.size ? 'done' : 'ready', selected.size ? `حدّد المسار ${fmt(selected.size)} عناصر داخل حدوده.` : 'المسار مغلق، لكنه لا يحتوي مراكز عناصر.', 'التحديد يتبع شكل المضلع الذي رسمته، وليس مستطيلًا حوله.');
  }
  function cancel() { selected = new Set(before); ink.setAttribute('d', oldInk); ink.dataset.invalid = oldInvalid; origin.setAttribute('visibility', 'hidden'); root.dataset.extPending = 'false'; render(); ctx.emit('ready', 'أُلغي الرسم واحتُفظ بالتحديد السابق.'); }
  ctx.on(svg, 'pointerdown', event => { const point = pointerPoint(svg, event); if (!event.target.closest('[data-ext-lasso-item]') && pointInRect(point, bounds)) ctx.begin(event, { start, move, end, cancel }); });
  function toggle(id) { ctx.stop(); selected.has(id) ? selected.delete(id) : selected.add(id); badge.dataset.invalid = 'false'; render(); ctx.emit(selected.size ? 'done' : 'ready', `التحديد الحالي: ${fmt(selected.size)} عناصر.`, 'هذا بديل التحديد الفردي بالنقر أو لوحة المفاتيح.'); }
  svg.querySelectorAll('[data-ext-lasso-item]').forEach(element => { ctx.on(element, 'click', () => toggle(Number(element.dataset.extLassoItem))); ctx.on(element, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(Number(element.dataset.extLassoItem)); } }); });
  ctx.on(root.querySelector('[data-ext-lasso-three]'), 'click', () => { ctx.stop(); start(demoPath[0]); demoPath.slice(1).forEach(move); end(demoPath.at(-1)); });
  ctx.on(root.querySelector('[data-ext-lasso-clear]'), 'click', () => { ctx.stop(); selected.clear(); ink.setAttribute('d', ''); badge.dataset.invalid = 'false'; root.dataset.extLassoClosed = 'false'; render(); ctx.emit('ready', 'أُلغي تحديد جميع العناصر.'); });
  render(); root.dataset.extLassoClosed = 'false';
  return { destroy: ctx.destroy, play() { ctx.stop(); selected.clear(); ink.setAttribute('d', ''); render(); return ctx.playSteps([{ points: demoPath, duration: 3000, start, move, end, cancel }]); } };
}

function mountGroup(container, api) {
  const pieces = [{ id: 'one', x: 110, y: 68, width: 110, height: 78 }, { id: 'two', x: 242, y: 103, width: 100, height: 78 }, { id: 'three', x: 153, y: 202, width: 110, height: 78 }];
  const bounds = { x: 55, y: 35, width: 790, height: 265 }, obstacle = { x: 435, y: 90, width: 160, height: 130 };
  const scene = `${surface()}<rect x="435" y="90" width="160" height="130" rx="16" fill="#d6bc92" stroke="#bd9c6e" stroke-width="2"/><path d="M448 104h134v30H448Zm0 43h134v29H448Z" fill="#e5cea8"/><path d="M467 107v23m42-23v23m42-23v23" stroke="#b69263" stroke-width="3"/><text class="ext-label" x="515" y="202">عائق ثابت</text><rect x="611" y="43" width="227" height="250" rx="16" fill="none" stroke="#b6ca9e" stroke-width="2" stroke-dasharray="7 7"/><text class="ext-small" x="723" y="325">مساحة صالحة للمجموعة</text>${pieces.map((piece, index) => `<g class="ext-group-piece ext-grabbable ext-focusable" data-ext-group-piece="${piece.id}" tabindex="0" role="button" aria-label="العنصر ${fmt(index + 1)} من المجموعة؛ اسحب لتحريك الثلاثة معًا، أو استخدم الأسهم"><rect class="ext-piece-surface ext-focus-ring" width="${piece.width}" height="${piece.height}" rx="12" fill="${index === 1 ? '#b8c8a5' : '#d9c396'}" stroke="#9eb18c" stroke-width="2"/><rect x="10" y="10" width="${piece.width - 20}" height="35" rx="6" fill="#f4edda" opacity=".72"/><text class="ext-strong" x="${piece.width / 2}" y="66">${fmt(index + 1)}</text></g>`).join('')}<rect class="ext-group-border" data-ext-group-border x="100" y="58" width="252" height="232" rx="16"/>`;
  const controls = '<button class="ext-button" data-ext-group-place="right">انقل المجموعة إلى اليمين</button><button class="ext-button" data-ext-group-place="obstacle">جرّب موضع العائق</button><button class="ext-button" data-ext-group-place="home">أعد المجموعة إلى البداية</button><span class="ext-note">يمكن تحريك المجموعة بالأسهم عند التركيز على أي عنصر.</span>';
  const { root, svg, badge } = createShell(container, 'اسحب أي عنصر لتحريك الثلاثة معًا؛ تُقبل المجموعة أو تُرفض كاملة.', '٣ عناصر مترابطة', scene, controls, 'إزاحة واحدة للمجموعة كلها', 'الحفاظ على المسافات وفحص صلاحية كل عنصر');
  const ctx = createRuntime(svg, api), border = svg.querySelector('[data-ext-group-border]');
  let offset = { x: 0, y: 0 }, preview = { x: 0, y: 0 }, before = { x: 0, y: 0 }, anchor = null, pending = false;
  function validity(candidate) {
    for (const piece of pieces) {
      const x = piece.x + candidate.x, y = piece.y + candidate.y;
      if (x < bounds.x || y < bounds.y || x + piece.width > bounds.x + bounds.width || y + piece.height > bounds.y + bounds.height) return 'أحد العناصر يتجاوز حدود المساحة.';
      if (x < obstacle.x + obstacle.width + 4 && x + piece.width > obstacle.x - 4 && y < obstacle.y + obstacle.height + 4 && y + piece.height > obstacle.y - 4) return 'أحد العناصر يتداخل مع العائق.';
    }
    return '';
  }
  function render() {
    const error = validity(preview);
    for (const piece of pieces) { const element = svg.querySelector(`[data-ext-group-piece="${piece.id}"]`); element.setAttribute('transform', `translate(${piece.x + preview.x} ${piece.y + preview.y})`); element.dataset.valid = String(!error); element.dataset.extX = String(piece.x + preview.x); element.dataset.extY = String(piece.y + preview.y); }
    setAttributes(border, { x: 100 + preview.x, y: 58 + preview.y, 'data-valid': !error });
    badge.dataset.invalid = String(!!error); badge.textContent = error ? 'المجموعة في موضع غير صالح' : pending ? 'يمكن اعتماد المجموعة كاملة' : '٣ عناصر · المسافات محفوظة';
    root.dataset.extGroupOffsetX = String(offset.x); root.dataset.extGroupOffsetY = String(offset.y); root.dataset.extPreviewOffsetX = String(preview.x); root.dataset.extPreviewOffsetY = String(preview.y); root.dataset.extGroupValid = String(!error); root.dataset.extPending = String(pending);
    root.dataset.extGroupPositions = JSON.stringify(pieces.map(piece => ({ id: piece.id, x: piece.x + offset.x, y: piece.y + offset.y })));
  }
  function start(point) { before = copyPoint(offset); preview = copyPoint(offset); anchor = copyPoint(point); pending = true; root.dataset.extLastOutcome = 'pending'; render(); }
  function move(point) { preview = { x: before.x + point.x - anchor.x, y: before.y + point.y - anchor.y }; render(); const error = validity(preview); ctx.emit('live', error || 'تحرّكت العناصر الثلاثة بالإزاحة نفسها.', error ? 'الإفلات هنا يعيد المجموعة كاملة إلى موضعها السابق.' : 'أفلت لاعتماد مواضع المجموعة معًا.'); }
  function commit() {
    const error = validity(preview); pending = false;
    if (error) { preview = copyPoint(offset); render(); badge.dataset.invalid = 'true'; badge.textContent = 'رُفضت المجموعة كاملة'; root.dataset.extLastOutcome = 'rejected'; ctx.emit('fail', `${error} لم يُنقل أي عنصر.`, 'عادت المجموعة كاملة مع الحفاظ على المسافات السابقة.'); return; }
    const changed = distance(offset, preview) > .1; offset = copyPoint(preview); render(); root.dataset.extLastOutcome = changed ? 'accepted' : 'unchanged'; ctx.emit(changed ? 'done' : 'ready', changed ? 'انتقلت العناصر الثلاثة معًا، وبقيت المسافات بينها كما هي.' : 'بقيت المجموعة في موضعها السابق.', 'فُحصت الحدود والعائق لكل عنصر قبل اعتماد أي موضع.');
  }
  function end(point) { move(point); commit(); }
  function cancel() { offset = copyPoint(before); preview = copyPoint(before); pending = false; render(); root.dataset.extLastOutcome = 'cancelled'; ctx.emit('ready', 'أُلغي السحب وعادت المجموعة كلها إلى مواضعها السابقة.'); }
  ctx.on(svg, 'pointerdown', event => { if (event.target.closest('[data-ext-group-piece]')) ctx.begin(event, { start, move, end, cancel }); });
  function place(candidate) { ctx.stop(); preview = copyPoint(candidate); render(); commit(); }
  root.querySelectorAll('[data-ext-group-place]').forEach(button => ctx.on(button, 'click', () => place({ x: { home: 0, obstacle: 300, right: 500 }[button.dataset.extGroupPlace], y: 0 })));
  svg.querySelectorAll('[data-ext-group-piece]').forEach(element => ctx.on(element, 'keydown', event => {
    const directions = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
    if (directions[event.key]) { event.preventDefault(); place({ x: offset.x + directions[event.key].x, y: offset.y + directions[event.key].y }); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); place({ x: offset.x === 500 ? 0 : 500, y: 0 }); }
  }));
  render(); root.dataset.extLastOutcome = 'initial';
  return { destroy: ctx.destroy, play() { ctx.stop(); offset = { x: 0, y: 0 }; preview = copyPoint(offset); pending = false; render(); const from = { x: 165, y: 107 }, invalid = { x: 465, y: 107 }, valid = { x: 665, y: 107 }; return ctx.playSteps([{ points: [from, invalid], duration: 1100, start, move, end, cancel }, { points: [invalid, from], duration: 350 }, { points: [from, valid], duration: 1600, start, move, end, cancel }]); } };
}

export function mountExtensions(id, container, api) {
  const factories = { turns: mountTurns, dwell: mountDwell, relations: mountRelations, lasso: mountLasso, group: mountGroup };
  if (!factories[id]) throw new Error(`Unknown extension interaction: ${id}`);
  return factories[id](container, api);
}
