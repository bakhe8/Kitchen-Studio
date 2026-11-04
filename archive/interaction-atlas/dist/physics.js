const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const arabic = (value, digits = 0) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const copy = value => JSON.parse(JSON.stringify(value));
let instanceNumber = 0;

export function mountPhysics(id, container, api) {
  const signalController = new AbortController();
  const uid = `phy-${++instanceNumber}`;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const on = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: signalController.signal });
  let destroyed = false, raf = 0, frameTime = 0, inFrame = false, pointer = null, playback = null, mode = null;
  let lastMessage = '';
  const emit = (kind, message, detail = '') => {
    const signature = `${kind}|${message}|${detail}`;
    if (!destroyed && signature !== lastMessage) { lastMessage = signature; api[kind]?.(message, detail); }
  };
  const definitions = {
    momentum: { labels: ['مسافة السحب', 'سرعة الإفلات', 'اتجاه الحركة'], cause: ['الاتجاه + سرعة السحب', 'حركة تستمر بعد الإفلات'], controls: '<button type="button" data-phy-speed="slow">دفعة بطيئة</button><button type="button" data-phy-speed="fast">دفعة سريعة</button><span>المسافة نفسها · سرعة مختلفة</span>' },
    elastic: { labels: ['الإزاحة عن الأصل', 'تغيّر طول الشريط', 'حالة الشريط'], cause: ['مسافة السحب', 'تمدد ثم عودة إلى الأصل'], controls: '<button type="button" data-phy-pull="short">شدّ خفيف</button><button type="button" data-phy-pull="long">شدّ أكبر</button><span>الدائرة المتقطعة هي موضع البداية</span>' },
    flow: { labels: ['زاوية الميل', 'معدل الصب', 'زمن الصب'], cause: ['الميل + مدة البقاء مائلًا', 'كمية تنتقل إلى الكوب'], controls: '<button type="button" data-phy-tilt="20">ميل خفيف</button><button type="button" data-phy-tilt="65">صبّ بزاوية ٦٥°</button><button type="button" data-phy-stop>إيقاف الصب</button>' }
  };
  const definition = definitions[id];
  if (!definition) throw new Error(`Unknown physics demo: ${id}`);
  container.innerHTML = `<section class="phy-root phy-${id}" aria-label="تجربة ${id === 'momentum' ? 'السرعة والاندفاع' : id === 'elastic' ? 'الشد والمرونة' : 'الميل والصب'}">
    <div class="phy-metrics">${definition.labels.map((label, index) => `<div><span>${label}</span><strong data-phy-metric="${index}">—</strong></div>`).join('')}</div>
    <svg class="phy-scene" role="group" aria-label="مساحة السحب التفاعلية">
      <defs><pattern id="${uid}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#cbd4c4" opacity=".7"/></pattern><marker id="${uid}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="#d38352" stroke-width="1.8" stroke-linejoin="round"/></marker></defs>
      <g data-phy-world></g>
      <g class="phy-demo-pointer" data-phy-pointer visibility="hidden" aria-hidden="true"><circle r="18" fill="#d38352" opacity=".15"/><path d="m-5-10 0 23 6-6 7 1Z" fill="#fffdf8" stroke="#a4653d" stroke-width="1.5" stroke-linejoin="round"/><circle class="phy-pointer-contact" cx="-5" cy="-10" r="3" fill="#d38352"/></g>
    </svg>
    <div class="phy-causal"><span>${definition.cause[0]}</span><b aria-hidden="true">←</b><strong>${definition.cause[1]}</strong></div>
    <div class="phy-controls" aria-label="أمثلة يمكن تشغيلها بلوحة المفاتيح">${definition.controls}</div>
    <p class="phy-note">محاكاة توضيحية · ${id === 'flow' ? '<span data-phy-conservation>الإناء ١٠٠ + الكوب ٠ = ١٠٠ وحدة</span>' : 'يمكنك السحب بنفسك أو تشغيل المثال بالأزرار'}</p>
  </section>`;
  const root = container.querySelector('.phy-root');
  const svg = container.querySelector('.phy-scene');
  const world = container.querySelector('[data-phy-world]');
  const hand = container.querySelector('[data-phy-pointer]');
  let width = 640, height = 238;
  const metric = (index, value) => { const target = root.querySelector(`[data-phy-metric="${index}"]`); if (target.textContent !== value) target.textContent = value; };
  const handAt = (point, pressed = true) => { hand.setAttribute('visibility', 'visible'); hand.setAttribute('transform', `translate(${point.x + 5} ${point.y + 10})`); hand.classList.toggle('phy-pressed', pressed); };
  const hideHand = () => hand.setAttribute('visibility', 'hidden');
  const position = event => {
    const rect = svg.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
  };
  function ensureFrame() {
    if (destroyed || raf || inFrame) return;
    frameTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (destroyed) return;
    inFrame = true;
    const dt = clamp((now - frameTime) / 1000, 0, .06);
    frameTime = now;
    if (playback) {
      const current = playback;
      current.run(now - current.started, now);
      if (playback === current && now - current.started >= current.duration) { playback = null; hideHand(); current.finish?.(); }
    }
    const active = mode?.tick?.(dt, now) || false;
    inFrame = false;
    if (!destroyed && (active || playback) && !raf) raf = requestAnimationFrame(frame);
  }
  function releaseCapture() {
    if (!pointer) return;
    try { if (svg.hasPointerCapture(pointer.id)) svg.releasePointerCapture(pointer.id); } catch {}
  }
  function cancelPointer(silent = false) {
    if (!pointer) return;
    releaseCapture(); pointer = null;
    svg.classList.remove('phy-dragging');
    mode.cancel(silent);
  }
  function stopPlayback(restore = true) {
    if (!playback) return;
    playback = null; hideHand();
    if (restore) mode?.cancel(true);
  }
  function beginPlayback(duration, run, finish) {
    stopPlayback(); cancelPointer(true);
    mode.reset(); lastMessage = '';
    playback = { duration, run, finish, started: performance.now() };
    emit('live', 'شاهد حركة المؤشر ثم جرّبها بنفسك.', 'المثال يستخدم التفاعل نفسه الذي تتحكم فيه بالسحب.');
    ensureFrame();
  }
  const background = () => `<rect x="12" y="10" width="${width - 24}" height="${height - 20}" rx="18" fill="#f8f9f2" stroke="#e0e6d9"/><rect x="13" y="11" width="${width - 26}" height="${height - 22}" rx="17" fill="url(#${uid}-grid)"/>`;

  function createMomentum() {
    const radius = 21;
    let state, pending = null, samples = [], offset = { x: 0, y: 0 }, suppressTravel = false;
    let elements;
    function initial() { return { x: width * .23, y: height * .55, vx: 0, vy: 0, distance: 0, speed: 0, direction: '—', trail: [], moving: false, release: null }; }
    function draw() {
      world.innerHTML = `${background()}<path d="M${width * .22} ${height * .56}h${width * .36}" fill="none" stroke="#dce4d6" stroke-width="1.5" stroke-dasharray="4 6"/><polyline data-phy-trail fill="none" stroke="#77a38b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity=".48"/><line data-phy-vector stroke="#d38352" stroke-width="1.8" marker-end="url(#${uid}-arrow)" visibility="hidden"/><circle data-phy-puck-shadow r="24" fill="#1d322f" opacity=".08"/><g class="phy-grabbable" data-phy-handle="momentum" role="button" tabindex="0" aria-label="اسحب القرص وأفلته؛ أو استخدم أزرار الدفعة أسفل الرسم"><circle r="${radius}" fill="#166353" stroke="#faf8f3" stroke-width="4"/><circle r="10" fill="none" stroke="#b5cfb9" stroke-width="1.5" opacity=".7"/><path d="M-4 0h8M0-4v8" stroke="#e5eddc" stroke-width="1.4" stroke-linecap="round"/></g><text x="${width / 2}" y="${height - 28}" text-anchor="middle" class="phy-svg-caption">اسحب القرص ثم أفلت أثناء الحركة</text>`;
      elements = { puck: world.querySelector('[data-phy-handle]'), shadow: world.querySelector('[data-phy-puck-shadow]'), trail: world.querySelector('[data-phy-trail]'), vector: world.querySelector('[data-phy-vector]') };
      paint();
    }
    function direction(vx, vy) {
      if (Math.hypot(vx, vy) < 4) return 'ثابت';
      const angle = Math.atan2(vy, vx) * 180 / Math.PI;
      return ['يمين', 'يمين وأسفل', 'أسفل', 'يسار وأسفل', 'يسار', 'يسار وأعلى', 'أعلى', 'يمين وأعلى'][Math.round((angle + 360) % 360 / 45) % 8];
    }
    function paint() {
      if (!suppressTravel) {
        elements.puck.setAttribute('transform', `translate(${state.x} ${state.y})`);
        elements.shadow.setAttribute('cx', state.x + 3); elements.shadow.setAttribute('cy', state.y + 5);
        elements.trail.setAttribute('points', state.trail.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
        if (state.release && state.speed > 2) {
          const length = clamp(state.speed * .15, 18, 80);
          elements.vector.setAttribute('visibility', 'visible');
          for (const [key, value] of Object.entries({ x1: state.release.x, y1: state.release.y, x2: state.release.x + state.release.vx / state.speed * length, y2: state.release.y + state.release.vy / state.speed * length })) elements.vector.setAttribute(key, value);
        } else elements.vector.setAttribute('visibility', 'hidden');
      }
      metric(0, `${arabic(state.distance)} وحدة`); metric(1, `${arabic(state.speed)} وحدة/ث`); metric(2, state.direction);
    }
    function sample(point, time) {
      samples.push({ ...point, time });
      while (samples.length > 2 && samples[1].time < time - 120) samples.shift();
    }
    function velocity() {
      if (samples.length < 2) return { x: 0, y: 0 };
      const first = samples[0], last = samples.at(-1), dt = Math.max(16, last.time - first.time) / 1000;
      return { x: clamp((last.x - first.x) / dt, -1200, 1200), y: clamp((last.y - first.y) / dt, -1200, 1200) };
    }
    function start(point, now) {
      suppressTravel = false;
      pending = copy(state); offset = { x: point.x - state.x, y: point.y - state.y };
      state.vx = state.vy = 0; state.moving = false; state.trail = [{ x: state.x, y: state.y }]; state.release = null;
      state.distance = 0; state.speed = 0; samples = []; sample({ x: state.x, y: state.y }, now); paint();
    }
    function move(point, now) {
      if (!pending) return;
      state.x = clamp(point.x - offset.x, radius + 15, width - radius - 15);
      state.y = clamp(point.y - offset.y, radius + 14, height - radius - 25);
      sample({ x: state.x, y: state.y }, now);
      const v = velocity(); state.distance = Math.hypot(state.x - pending.x, state.y - pending.y);
      state.direction = direction(state.x - pending.x, state.y - pending.y);
      state.speed = Math.hypot(v.x, v.y);
      if (distance(state, state.trail.at(-1)) > 2) state.trail.push({ x: state.x, y: state.y });
      paint(); emit('live', 'الاتجاه والسرعة يتكوّنان من حركة يدك.', 'أفلت أثناء الحركة لتشاهد استمرار القرص.');
    }
    function release(point, now) {
      if (!pending) return;
      move(point, now);
      const v = velocity(); pending = null;
      state.vx = v.x; state.vy = v.y; state.speed = Math.hypot(v.x, v.y); state.direction = direction(v.x, v.y);
      state.release = { x: state.x, y: state.y, vx: v.x, vy: v.y };
      state.moving = state.speed > 8;
      if (reduced && state.moving) {
        state.x = clamp(state.x + state.vx / 2.6, radius + 15, width - radius - 15);
        state.y = clamp(state.y + state.vy / 2.6, radius + 14, height - radius - 25);
        state.trail.push({ x: state.x, y: state.y }); state.vx = state.vy = 0; state.moving = false;
      }
      paint();
      if (state.moving) { emit('live', 'أفلتَّ القرص؛ الحركة مستمرة ثم تتباطأ.', `سرعة الإفلات: ${arabic(state.speed)} وحدة/ث.`); ensureFrame(); }
      else emit(state.speed > 8 ? 'done' : 'ready', state.speed > 8 ? 'ظهرت نتيجة الدفعة دون حركة ممتدة.' : 'القرص توقف عند الإفلات.', state.speed > 8 ? 'وضع تقليل الحركة مفعّل.' : 'جرّب الإفلات أثناء سحب أسرع.');
    }
    function tick(dt) {
      if (!state.moving) return false;
      const damping = Math.exp(-2.6 * dt);
      state.x += state.vx * dt; state.y += state.vy * dt; state.vx *= damping; state.vy *= damping;
      const left = radius + 15, right = width - radius - 15, top = radius + 14, bottom = height - radius - 25;
      if (state.x < left || state.x > right) { state.x = clamp(state.x, left, right); state.vx *= -.55; }
      if (state.y < top || state.y > bottom) { state.y = clamp(state.y, top, bottom); state.vy *= -.55; }
      if (distance(state, state.trail.at(-1)) > 2) { state.trail.push({ x: state.x, y: state.y }); if (state.trail.length > 100) state.trail.shift(); }
      if (Math.hypot(state.vx, state.vy) < 5) {
        state.vx = state.vy = 0; state.moving = false;
        emit('done', 'استمر القرص بعد الإفلات ثم توقّف.', `سرعة الإفلات ${arabic(state.speed)} وحدة/ث · الاتجاه ${state.direction}.`);
      }
      paint(); return state.moving;
    }
    function reset() { pending = null; suppressTravel = false; state = initial(); samples = []; draw(); }
    function cancel(silent = false) {
      if (!pending) return;
      state = pending; pending = null; samples = []; suppressTravel = false; paint();
      if (state.moving) ensureFrame();
      if (!silent) emit('ready', 'أُلغي السحب وعاد القرص إلى حالته السابقة.');
    }
    function play(speed = 'fast') {
      const dragDuration = speed === 'slow' ? 1050 : 250;
      let started = false, released = false, from, to, dragStartedAt;
      beginPlayback(3600, (elapsed, now) => {
        if (!started) {
          started = true;
          from = { x: state.x, y: state.y };
          to = { x: from.x + clamp(width * .13, 35, 70), y: from.y - 13 };
          dragStartedAt = now - elapsed + 350;
          start(from, dragStartedAt);
        }
        if (elapsed < 350) { handAt(from); return; }
        const dragElapsed = clamp(elapsed - 350, 0, dragDuration);
        const fraction = dragElapsed / dragDuration;
        const sampleTime = dragStartedAt + dragElapsed;
        const point = lerp(from, to, fraction);
        if (!released) {
          if (fraction >= 1) { suppressTravel = false; release(point, sampleTime); released = true; hideHand(); }
          else { suppressTravel = reduced; move(point, sampleTime); handAt(reduced ? from : point); }
        }
      });
    }
    function resize(oldWidth, oldHeight) {
      const scaleX = width / oldWidth, scaleY = height / oldHeight;
      state.x *= scaleX; state.y *= scaleY;
      state.trail = state.trail.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
      if (state.release) { state.release.x *= scaleX; state.release.y *= scaleY; }
      draw();
    }
    state = initial(); draw();
    return { start, move, release, cancel, reset, tick, play, resize };
  }

  function createElastic() {
    let state, pending = null, offset = { x: 0, y: 0 }, elements;
    const anchor = () => ({ x: width * .18, y: height * .51 });
    const home = () => ({ x: width * .57, y: height * .51 });
    function initial() { return { ...home(), vx: 0, vy: 0, settling: false, lastDisplacement: 0, lastStretch: 0 }; }
    function draw() {
      const a = anchor(), h = home();
      world.innerHTML = `${background()}<path d="M${a.x} ${a.y}H${h.x}" stroke="#aebda6" stroke-width="2" stroke-dasharray="5 5"/><circle cx="${h.x}" cy="${h.y}" r="24" fill="none" stroke="#aebda6" stroke-width="1.5" stroke-dasharray="4 5"/><rect x="${a.x - 14}" y="${a.y - 41}" width="18" height="82" rx="5" fill="#d4ddce" stroke="#a9b99e"/><path d="M${a.x - 9} ${a.y - 29}v58" stroke="#91a384" stroke-width="2" stroke-dasharray="2 5"/><path data-phy-band fill="#6b9a7d" opacity=".2"/><path data-phy-coil fill="none" stroke="#3d7a5e" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><line data-phy-displacement stroke="#d38352" stroke-width="1.4" stroke-dasharray="4 4"/><g class="phy-grabbable" data-phy-handle="elastic" role="button" tabindex="0" aria-label="اسحب الطرف الأخضر لشد الشريط؛ أو استخدم أزرار الشد أسفل الرسم"><circle r="22" fill="#166353" stroke="#faf8f3" stroke-width="4"/><path d="M-7-4h14M-7 4h14" stroke="#c9dcc3" stroke-width="2" stroke-linecap="round"/></g><text x="${h.x}" y="${height - 27}" class="phy-svg-caption" text-anchor="middle">الموضع الأصلي</text>`;
      elements = { handle: world.querySelector('[data-phy-handle]'), band: world.querySelector('[data-phy-band]'), coil: world.querySelector('[data-phy-coil]'), displacement: world.querySelector('[data-phy-displacement]') };
      paint();
    }
    function paint() {
      const a = anchor(), h = home(), len = Math.max(1, distance(a, state));
      const ux = (state.x - a.x) / len, uy = (state.y - a.y) / len, nx = -uy, ny = ux;
      const thickness = clamp(12 * distance(a, h) / len, 5, 19);
      const top = { x: a.x + nx * thickness, y: a.y + ny * thickness };
      elements.band.setAttribute('d', `M${top.x},${top.y}Q${(a.x + state.x) / 2 + nx * thickness * .65},${(a.y + state.y) / 2 + ny * thickness * .65} ${state.x + nx * 7},${state.y + ny * 7}L${state.x - nx * 7},${state.y - ny * 7}Q${(a.x + state.x) / 2 - nx * thickness * .65},${(a.y + state.y) / 2 - ny * thickness * .65} ${a.x - nx * thickness},${a.y - ny * thickness}Z`);
      const points = [{ x: a.x, y: a.y }];
      for (let i = 1; i <= 20; i++) { const t = i / 21; const wave = Math.sin(t * Math.PI * 10) * thickness; points.push({ x: a.x + ux * len * t + nx * wave, y: a.y + uy * len * t + ny * wave }); }
      points.push({ x: state.x, y: state.y });
      elements.coil.setAttribute('d', points.map((p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
      elements.handle.setAttribute('transform', `translate(${state.x} ${state.y})`);
      for (const [name, value] of Object.entries({ x1: h.x, y1: h.y, x2: state.x, y2: state.y })) elements.displacement.setAttribute(name, value);
      const displacement = distance(state, h);
      const stretch = (len / distance(a, h) - 1) * 100;
      metric(0, `${arabic(displacement)} وحدة`); metric(1, `${stretch > 0 ? '+' : ''}${arabic(stretch)}٪`);
      metric(2, pending ? 'مشدود' : state.settling ? 'يعود' : state.lastDisplacement > 0 ? 'عاد إلى الأصل' : 'ثابت');
    }
    function start(point) { pending = copy(state); offset = { x: point.x - state.x, y: point.y - state.y }; state.vx = state.vy = 0; state.settling = false; }
    function move(point) {
      if (!pending) return;
      state.x = clamp(point.x - offset.x, anchor().x + 35, width - 38); state.y = clamp(point.y - offset.y, 39, height - 44);
      paint(); emit('live', 'كلما أبعدت الطرف زاد الشدّ.', 'الخط المتقطع يحفظ موضع البداية. أفلت لترى العودة.');
    }
    function release(point) {
      if (!pending) return;
      move(point); state.lastDisplacement = distance(state, home()); state.lastStretch = (distance(state, anchor()) / distance(home(), anchor()) - 1) * 100; pending = null;
      if (state.lastDisplacement < 1) { paint(); emit('ready', 'اسحب الطرف بعيدًا عن دائرته الأصلية.'); return; }
      if (reduced) { Object.assign(state, home(), { vx: 0, vy: 0, settling: false }); paint(); emit('done', 'عاد الطرف إلى موضعه الأصلي.', 'عُرضت العودة مباشرة احترامًا لتقليل الحركة.'); }
      else { state.settling = true; ensureFrame(); emit('live', 'أفلتَّ الطرف؛ الشريط يعيده إلى الأصل.', `الإزاحة عند الإفلات: ${arabic(state.lastDisplacement)} وحدة.`); }
    }
    function tick(dt) {
      if (!state.settling) return false;
      const h = home();
      // Substeps keep the illustrative spring stable on a slower device.
      const steps = Math.max(1, Math.ceil(dt / .012)), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        state.vx += ((h.x - state.x) * 105 - state.vx * 12) * step;
        state.vy += ((h.y - state.y) * 105 - state.vy * 12) * step;
        state.x += state.vx * step; state.y += state.vy * step;
      }
      if (distance(state, h) < .35 && Math.hypot(state.vx, state.vy) < 2) {
        Object.assign(state, h, { vx: 0, vy: 0, settling: false });
        emit('done', 'تمدّد الشريط ثم عاد إلى موضعه الأصلي.', `الإزاحة التي سبّبتها: ${arabic(state.lastDisplacement)} وحدة.`);
      }
      paint(); return state.settling;
    }
    function reset() { pending = null; state = initial(); draw(); }
    function cancel(silent = false) { if (!pending) return; state = pending; pending = null; paint(); if (state.settling) ensureFrame(); if (!silent) emit('ready', 'أُلغي الشدّ وعادت الحالة السابقة.'); }
    function play(kind = 'long') {
      let started = false, released = false, from, to;
      beginPlayback(3600, (elapsed, now) => {
        if (!started) { started = true; from = home(); to = { x: from.x + Math.min(width * (kind === 'short' ? .09 : .24), width - 39 - from.x), y: from.y - (kind === 'short' ? 10 : 44) }; start(from, now); }
        if (elapsed < 350) { handAt(from); return; }
        const fraction = clamp((elapsed - 350) / 850, 0, 1), eased = fraction * fraction * (3 - 2 * fraction);
        const point = lerp(from, to, reduced ? (fraction < 1 ? 0 : 1) : eased);
        if (!released) {
          if (elapsed >= 1600) { release(point, now); released = true; hideHand(); }
          else { move(point, now); handAt(point); }
        }
      });
    }
    function resize(oldWidth, oldHeight) { state.x *= width / oldWidth; state.y *= height / oldHeight; if (!state.settling) Object.assign(state, home()); draw(); }
    state = initial(); draw();
    return { start, move, release, cancel, reset, tick, play, resize };
  }

  function createFlow() {
    const total = 100, capacity = 100, threshold = 30;
    let state, pending = null, angleOffset = 0, elements;
    const pivot = () => ({ x: width * .45, y: height * .44 });
    const radius = () => Math.min(91, width * .25);
    const knobAt = angle => { const p = pivot(), theta = (angle - 30) * Math.PI / 180; return { x: p.x + Math.cos(theta) * radius(), y: p.y + Math.sin(theta) * radius() }; };
    const pointerAngle = p => Math.atan2(p.y - pivot().y, p.x - pivot().x) * 180 / Math.PI + 30;
    const rate = () => state.source > .0001 && state.cup < capacity - .0001 ? Math.max(0, state.angle - threshold) / 50 * 30 : 0;
    function initial() { return { angle: 0, source: total, cup: 0, duration: 0, lastTime: performance.now(), lastTransferred: 0 }; }
    const vesselShape = 'M-95-29H-23L0 0-18 8-26 98Q-27 105-35 105H-83Q-92 105-93 96Z';
    const vesselInside = [{ x: -89, y: -22 }, { x: -26, y: -22 }, { x: -8, y: 0 }, { x: -23, y: 9 }, { x: -31, y: 98 }, { x: -86, y: 98 }];
    function polygonArea(points) { return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2; }
    function submergedPolygon(level, angle) {
      const nx = Math.sin(angle), ny = Math.cos(angle), result = [];
      for (let i = 0; i < vesselInside.length; i++) {
        const a = vesselInside[i], b = vesselInside[(i + 1) % vesselInside.length];
        const da = a.x * nx + a.y * ny - level, db = b.x * nx + b.y * ny - level;
        if (da >= 0) result.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); result.push(lerp(a, b, t)); }
      }
      return result;
    }
    function liquidPath() {
      if (state.source <= .0001) return '';
      const theta = state.angle * Math.PI / 180;
      const heights = vesselInside.map(p => p.x * Math.sin(theta) + p.y * Math.cos(theta));
      let lo = Math.min(...heights) - 1, hi = Math.max(...heights) + 1;
      const target = polygonArea(vesselInside) * state.source / total;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (polygonArea(submergedPolygon(mid, theta)) > target) lo = mid; else hi = mid; }
      return submergedPolygon((lo + hi) / 2, theta).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + 'Z';
    }
    function draw() {
      const p = pivot(), k0 = knobAt(0), k1 = knobAt(80), cupTop = height - 87, cupBottom = height - 24;
      world.innerHTML = `${background()}<defs><clipPath id="${uid}-jug-clip"><path d="${vesselShape}"/></clipPath><clipPath id="${uid}-cup-clip"><path d="M${p.x - 28} ${cupTop}l7 ${cupBottom - cupTop}h54l7-${cupBottom - cupTop}Z"/></clipPath></defs><path d="M${k0.x} ${k0.y}A${radius()} ${radius()} 0 0 1 ${k1.x} ${k1.y}" fill="none" stroke="#d8c9b3" stroke-width="1.5" stroke-dasharray="4 6"/><g data-phy-vessel><path d="M-95-5C-131-12-132 56-94 55" fill="none" stroke="#aebfb1" stroke-width="8"/><path d="${vesselShape}" fill="#e7eee4" fill-opacity=".75" stroke="#8ca68e" stroke-width="2"/><path data-phy-source-liquid fill="#70ab9b" fill-opacity=".75" clip-path="url(#${uid}-jug-clip)"/><path d="M-86 27v48" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/><path d="M-95-29H-23L0 0" fill="none" stroke="#64876c" stroke-width="3" stroke-linecap="round"/></g><path data-phy-stream d="M${p.x} ${p.y}Q${p.x + 10} ${cupTop - 23} ${p.x + 6} ${cupTop + 15}" fill="none" stroke="#70ab9b" stroke-width="5" stroke-linecap="round" visibility="hidden"/><path d="M${p.x - 29} ${cupTop}l7 ${cupBottom - cupTop}h56l7-${cupBottom - cupTop}" fill="#f6f8f2" stroke="#9fb1a2" stroke-width="2"/><rect data-phy-cup-liquid x="${p.x - 28}" width="69" y="${cupBottom}" height="0" fill="#70ab9b" fill-opacity=".85" clip-path="url(#${uid}-cup-clip)"/><path d="M${p.x - 29} ${cupTop}h70" stroke="#9fb1a2" stroke-width="2"/><path d="M${p.x - 17} ${cupTop + 14}l4 31" stroke="#fff" stroke-width="3" opacity=".8" stroke-linecap="round"/><circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#d38352"/><line data-phy-knob-arm x1="${p.x}" y1="${p.y}" stroke="#d38352" stroke-width="1.4" stroke-dasharray="3 4"/><g class="phy-grabbable" data-phy-handle="flow" role="button" tabindex="0" aria-label="اسحب المقبض البرتقالي إلى أسفل لإمالة الإناء؛ أو استخدم الأزرار أسفل الرسم"><circle r="18" fill="#d38352" stroke="#fffdf8" stroke-width="4"/><path d="M-5-4h10M-5 4h10" stroke="#fff6e7" stroke-width="1.7" stroke-linecap="round"/></g><text class="phy-svg-caption" x="${width - 25}" y="${height - 31}" text-anchor="end">${width < 440 ? 'فوق ٣٠° يبدأ الصب' : 'حافظ على الميل لتستمر الكمية بالانتقال'}</text>`;
      elements = { vessel: world.querySelector('[data-phy-vessel]'), sourceLiquid: world.querySelector('[data-phy-source-liquid]'), stream: world.querySelector('[data-phy-stream]'), cupLiquid: world.querySelector('[data-phy-cup-liquid]'), knob: world.querySelector('[data-phy-handle]'), arm: world.querySelector('[data-phy-knob-arm]'), cupTop, cupBottom };
      paint();
    }
    function paint() {
      const p = pivot(), k = knobAt(state.angle), currentRate = rate();
      elements.vessel.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${state.angle})`);
      elements.sourceLiquid.setAttribute('d', liquidPath());
      elements.knob.setAttribute('transform', `translate(${k.x} ${k.y})`);
      elements.arm.setAttribute('x2', k.x); elements.arm.setAttribute('y2', k.y);
      const fill = state.cup / capacity * (elements.cupBottom - elements.cupTop - 3);
      elements.cupLiquid.setAttribute('y', elements.cupBottom - fill); elements.cupLiquid.setAttribute('height', fill + (fill > 0 ? 1 : 0));
      elements.stream.setAttribute('visibility', currentRate > 0 ? 'visible' : 'hidden');
      elements.stream.setAttribute('stroke-width', String(clamp(currentRate / 6, 2, 5)));
      metric(0, `${arabic(state.angle)}°`); metric(1, `${arabic(currentRate, 1)} وحدة/ث`); metric(2, `${arabic(state.duration, 1)} ث`);
      root.querySelector('[data-phy-conservation]').textContent = `الإناء ${arabic(state.source, 1)} + الكوب ${arabic(state.cup, 1)} = ${arabic(total)} وحدة`;
    }
    function integrate(now) {
      const seconds = Math.max(0, now - state.lastTime) / 1000; state.lastTime = now;
      const currentRate = rate();
      if (currentRate <= 0 || seconds <= 0) return false;
      const amount = Math.min(state.source, capacity - state.cup, currentRate * seconds);
      state.cup = clamp(state.cup + amount, 0, capacity); state.source = total - state.cup; state.duration += amount / currentRate;
      if (state.source <= .0001 || state.cup >= capacity - .0001) { state.source = 0; state.cup = total; emit('live', 'توقّف الصب تلقائيًا: الإناء فارغ والكوب ممتلئ.', 'بقي مجموع السائل ١٠٠ وحدة.'); }
      paint(); return rate() > 0;
    }
    function start(point, now) { pending = copy(state); angleOffset = state.angle - pointerAngle(point); state.lastTime = now; }
    function move(point, now) {
      if (!pending) return;
      integrate(now);
      state.angle = clamp(pointerAngle(point) + angleOffset, 0, 80); paint();
      if (rate() > 0) { ensureFrame(); emit('live', 'السائل ينتقل ما دام الإناء مائلًا.', 'ميل أكبر يرفع المعدل؛ وقت أطول ينقل كمية أكبر.'); }
      else if (state.source > 0) emit('live', 'الميل الحالي لا يكفي للصب.', 'ابدأ الصب بتجاوز زاوية ٣٠°، ثم حافظ على الميل.');
    }
    function release(point, now) {
      if (!pending) return;
      move(point, now);
      const transferred = state.cup - pending.cup; pending = null; state.angle = 0; state.lastTransferred = transferred; paint();
      if (transferred > .01) emit('done', `انتقلت ${arabic(transferred, 1)} وحدة إلى الكوب.`, 'عاد الإناء قائمًا وتوقّف الصب. مجموع السائل محفوظ.');
      else emit('ready', 'لم تنتقل كمية من السائل.', 'يحتاج الصب إلى ميل يتجاوز ٣٠° ووقت عند هذا الميل.');
    }
    function tick(_dt, now) { return integrate(now); }
    function cancel(silent = false) {
      if (!pending) return;
      state = pending; pending = null; state.lastTime = performance.now(); paint();
      if (!silent) emit('ready', 'أُلغي السحب وعادت الكميتان إلى بداية الحركة.');
    }
    function reset() { pending = null; state = initial(); draw(); }
    function play(angle = 65) {
      let started = false, released = false;
      beginPlayback(3900, (elapsed, now) => {
        if (!started) { started = true; start(knobAt(0), now); }
        const fraction = clamp((elapsed - 300) / 550, 0, 1);
        const targetAngle = angle * (reduced ? (fraction < 1 ? 0 : 1) : fraction * fraction * (3 - 2 * fraction));
        const point = knobAt(targetAngle);
        if (!released) {
          if (elapsed >= 2850) { release(point, now); released = true; hideHand(); }
          else { move(point, now); handAt(point); }
        }
      });
    }
    function stop() {
      if (playback) { playback = null; hideHand(); }
      if (pointer) { releaseCapture(); pointer = null; svg.classList.remove('phy-dragging'); }
      if (pending) release(knobAt(state.angle), performance.now());
      else { state.angle = 0; paint(); emit('ready', 'الإناء قائم والصب متوقف.'); }
    }
    function resize() { draw(); }
    state = initial(); draw();
    return { start, move, release, cancel, reset, tick, play, stop, resize };
  }

  function measure() {
    const rect = svg.getBoundingClientRect(), oldWidth = width, oldHeight = height;
    const nextWidth = Math.max(260, rect.width), nextHeight = rect.height || 238;
    if (Math.abs(nextWidth - width) < .5 && Math.abs(nextHeight - height) < .5) return;
    stopPlayback(); cancelPointer(true);
    width = nextWidth; height = nextHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (mode) mode.resize(oldWidth, oldHeight);
  }
  measure();
  mode = id === 'momentum' ? createMomentum() : id === 'elastic' ? createElastic() : createFlow();
  on(svg, 'pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !event.target.closest('[data-phy-handle]')) return;
    event.preventDefault(); stopPlayback(); cancelPointer(true);
    pointer = { id: event.pointerId };
    try { svg.setPointerCapture(event.pointerId); } catch {}
    svg.classList.add('phy-dragging');
    mode.start(position(event), performance.now());
  });
  on(window, 'pointermove', event => { if (pointer?.id !== event.pointerId) return; event.preventDefault(); mode.move(position(event), performance.now()); }, { passive: false });
  on(window, 'pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    releaseCapture(); pointer = null; svg.classList.remove('phy-dragging');
    mode.release(position(event), performance.now());
  });
  on(window, 'pointercancel', event => { if (pointer?.id === event.pointerId) cancelPointer(); });
  on(window, 'keydown', event => {
    if (event.key !== 'Escape' || (!pointer && !playback)) return;
    event.preventDefault(); cancelPointer();
    if (playback) { stopPlayback(); emit('ready', 'توقّف المثال. يمكنك بدء تجربة جديدة.'); }
  });
  const pause = () => { cancelPointer(); if (playback) { stopPlayback(); emit('ready', 'توقّف المثال عند مغادرة الصفحة.'); } };
  on(window, 'blur', pause);
  on(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  on(root, 'click', event => {
    const speed = event.target.closest('[data-phy-speed]'), pull = event.target.closest('[data-phy-pull]'), tilt = event.target.closest('[data-phy-tilt]');
    if (speed) mode.play(speed.dataset.phySpeed);
    else if (pull) mode.play(pull.dataset.phyPull);
    else if (tilt) mode.play(Number(tilt.dataset.phyTilt));
    else if (event.target.closest('[data-phy-stop]')) mode.stop?.();
  });
  on(svg, 'keydown', event => {
    if (!event.target.closest('[data-phy-handle]')) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mode.play(); }
  });
  const resizeObserver = new ResizeObserver(measure); resizeObserver.observe(svg);
  return {
    play() { mode.play(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopPlayback(); cancelPointer(true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0; signalController.abort(); resizeObserver.disconnect(); hideHand();
    }
  };
}
