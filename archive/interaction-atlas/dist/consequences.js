const number = value => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = value => value * value * (3 - 2 * value);
const sourcePositions = [146, 198, 250];
const sourceX = key => sourcePositions[['A', 'B', 'C'].indexOf(key)];
const targetPositions = [670, 724];
const sourceGate = 198, targetGate = 700, walkwayY = 264;

function boxArt() {
  return '<path d="M-20-13 0-23 20-13 20 15 0 26-20 15Z" fill="#ce9a64" stroke="#a27649" stroke-width="1.1"/><path d="M-20-13 0-3 20-13 0-23Z" fill="#e5bd88"/><path d="M0-3v29l20-11v-28Z" fill="#d7a56e"/><path d="m-7-20 20 10v10l-7 4v-10l-20-10Z" fill="#f7e6c7"/><path d="M-14 0-5 5v10l-9-5Z" fill="#fff4df" opacity=".7"/>';
}

function svgPoint(svg, event) {
  const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? p.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
}

export function mountConsequences(container, api) {
  const controller = new AbortController();
  const on = (element, name, callback, options = {}) => element.addEventListener(name, callback, { ...options, signal: controller.signal });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let destroyed = false, drag = null, demonstration = null, transport = null;
  let demoFrame = 0, transportFrame = 0, lastMessage = '', sourceSignature = '', targetSignature = '';
  let state = initial();
  function initial() {
    return { warehouse: ['A', 'B', 'C'], carried: null, shop: [], reserved: null, busy: false, workerX: 450, walking: false, gait: 0,
      worker: 'متاح للعمل', task: 'بانتظار أمر النقل', phase: 'idle', steps: ['pending', 'pending', 'pending', 'pending'] };
  }
  container.innerHTML = `<section class="con-root" data-con-root>
    <div class="con-metrics" aria-label="كميات الصناديق في المحاكاة">
      <div class="con-metric"><span>المستودع</span><strong data-con-warehouse>٣</strong><small data-con-reserved>لا يوجد حجز</small></div><span class="con-plus" aria-hidden="true">+</span>
      <div class="con-metric"><span>في الطريق</span><strong data-con-transit>٠</strong><small>يحمله العامل</small></div><span class="con-plus" aria-hidden="true">+</span>
      <div class="con-metric"><span>المحل</span><strong data-con-shop>٠</strong><small>السعة: صندوقان</small></div><span class="con-equals" aria-hidden="true">=</span>
      <div class="con-metric con-total"><span>الإجمالي</span><strong data-con-total>٣</strong><small>محفوظ دائمًا</small></div>
    </div>
    <svg class="con-scene" viewBox="0 0 900 320" role="group" aria-label="مستودع ومحل على قطعتين منفصلتين، وعامل ينقل الصناديق عبر ممر المشاة">
      <rect x="76" y="24" width="248" height="207" rx="14" fill="#e9e4d5" stroke="#d2c8b2" stroke-width="1.5"/>
      <rect x="576" y="24" width="248" height="207" rx="14" fill="#e5eddd" stroke="#c6d5bb" stroke-width="1.5" data-con-destination/>
      <text x="200" y="47" class="con-lot-label">قطعة المستودع</text><text x="700" y="47" class="con-lot-label">قطعة المحل</text>
      <g data-con-warehouse-building><path d="M105 92 200 63 295 92v96H105Z" fill="#d6c6a9" stroke="#b2a183" stroke-width="1.5"/><path d="M100 93 200 61 300 93" fill="none" stroke="#b4a589" stroke-width="9" stroke-linejoin="round"/><rect x="152" y="129" width="96" height="59" fill="#9caa94"/><path d="M157 140h86m-86 12h86m-86 12h86m-86 12h86" stroke="#c6d0bb" stroke-width="3"/><rect x="145" y="94" width="110" height="27" rx="4" fill="#6e7f65"/><text x="200" y="113" class="con-store-label">المستودع</text></g>
      <g data-con-shop-building><rect x="612" y="76" width="176" height="112" rx="6" fill="#eddec2" stroke="#c6b593" stroke-width="1.5"/><rect x="632" y="84" width="136" height="25" rx="5" fill="#166353"/><text x="700" y="103" class="con-store-label">محل بليله</text><rect x="629" y="142" width="76" height="46" fill="#8da78f"/><path d="M667 143v44m-37-23h74" stroke="#f4ead5" stroke-width="4"/><rect x="722" y="142" width="47" height="46" fill="#bb8d62"/><circle cx="759" cy="169" r="2" fill="#f9ebd2"/><path d="M605 115h190l-7 27H612Z" fill="#f9f0db"/>${Array.from({ length: 5 }, (_, index) => `<path d="M${605 + index * 38} 115h19v27h-18Z" fill="#467963"/>`).join('')}<path d="M612 142h176" stroke="#406b55" stroke-width="2"/></g>
      <g data-con-source-boxes></g><g data-con-target-boxes></g>
      <rect x="35" y="244" width="830" height="57" rx="12" fill="#dce0d3" stroke="#c8d1bf" stroke-width="1.2"/><path d="M55 273H845" stroke="#f6f6e8" stroke-width="3" stroke-dasharray="15 14"/><path d="M198 232v10m502-10v10" stroke="#a9b99f" stroke-width="2"/>
      <path d="M210 259H681m-8-6 8 6-8 6" fill="none" stroke="#8ca17f" stroke-width="1.5" stroke-dasharray="5 6" opacity=".65"/>
      <text x="450" y="318" class="con-walkway-label">ممر المشاة · المباني داخل قطعها</text>
      <g data-con-worker transform="translate(450 264)"><ellipse cy="29" rx="22" ry="6" fill="#314c37" opacity=".15"/><g data-con-legs><path d="M-6 14v15m12-15v15" stroke="#53644f" stroke-width="6" stroke-linecap="round"/></g><path d="M-12-8h24l3 24h-30Z" fill="#166353"/><path d="M-11-3-17 11m28-14 8 13" stroke="#cf966a" stroke-width="5" stroke-linecap="round"/><circle cy="-22" r="11" fill="#d4a079"/><path d="M-11-25q1-15 14-10 11 4 7 14l-6-8-13 5Z" fill="#405344"/><path d="m-5-13 5 3 5-3" fill="none" stroke="#997353" stroke-width="1.5"/><g data-con-carried-box transform="translate(17 1) scale(.6)" visibility="hidden">${boxArt()}</g></g>
      <g data-con-ghost visibility="hidden" pointer-events="none" class="con-ghost">${boxArt()}</g>
      <g data-con-demo-pointer visibility="hidden" pointer-events="none"><circle r="17" fill="#d38352" opacity=".2"/><path d="M0 0v32l9-9 8 14 6-4-8-14 12-2Z" fill="#fffdf7" stroke="#243f33" stroke-width="2.1" stroke-linejoin="round"/></g>
    </svg>
    <div class="con-worker-status"><span class="con-status-dot"></span><span>العامل: <strong data-con-worker-status>متاح للعمل</strong></span><span class="con-task" data-con-task>بانتظار أمر النقل</span></div>
    <ol class="con-steps" aria-label="نتائج أمر النقل">${['التحقق من الوجهة', 'حجز صندوق', 'تكليف العامل', 'التسليم'].map((title, index) => `<li data-con-step="${index}" data-status="pending"><span class="con-step-mark">${number(index + 1)}</span><span>${title}</span></li>`).join('')}</ol>
    <div class="con-actions"><button type="button" data-con-command>تنفيذ أمر النقل</button><span data-con-hint>اسحب صندوقًا من المستودع إلى قطعة المحل</span></div>
    <p class="con-explanation">محاكاة محلية · الفعل الواحد حدّث المخزون والتكليف وحركة العامل</p>
  </section>`;
  const root = container.querySelector('[data-con-root]'), svg = root.querySelector('.con-scene');
  const ghost = root.querySelector('[data-con-ghost]'), cursor = root.querySelector('[data-con-demo-pointer]');
  const destination = root.querySelector('[data-con-destination]'), command = root.querySelector('[data-con-command]');
  const worker = root.querySelector('[data-con-worker]');
  const emit = (method, message, detail = '') => {
    const signature = `${method}|${message}|${detail}`;
    if (!destroyed && signature !== lastMessage) { lastMessage = signature; api[method]?.(message, detail); }
  };
  const dropInside = p => p.x >= 576 && p.x <= 824 && p.y >= 24 && p.y <= 231;
  const sourcePoint = key => ({ x: sourceX(key), y: 201 });

  function render() {
    const supply = state.warehouse.join(','), stock = state.shop.join(',');
    if (supply !== sourceSignature || !root.querySelector('[data-con-source-boxes]').children.length) {
      sourceSignature = supply;
      root.querySelector('[data-con-source-boxes]').innerHTML = state.warehouse.map(key => `<g data-con-box="${key}" class="con-source-box" role="button" tabindex="0" aria-label="نقل الصندوق ${key} إلى المحل" transform="translate(${sourceX(key)} 201)"><rect x="-27" y="-29" width="54" height="56" rx="6" fill="transparent"/><rect class="con-reserved-outline" x="-26" y="-29" width="52" height="57" rx="7" fill="none" stroke="#166353" stroke-width="2" stroke-dasharray="4 3" visibility="hidden"/>${boxArt()}</g>`).join('');
    }
    if (stock !== targetSignature || !root.querySelector('[data-con-target-boxes]').children.length) {
      targetSignature = stock;
      root.querySelector('[data-con-target-boxes]').innerHTML = targetPositions.map((x, index) => state.shop[index] ? `<g data-con-delivered-box="${state.shop[index]}" transform="translate(${x} 201)">${boxArt()}</g>` : `<rect x="${x - 23}" y="176" width="46" height="49" rx="6" fill="#f2f5e8" stroke="#b7c9a9" stroke-width="1.5" stroke-dasharray="4 4"/>`).join('');
    }
    root.querySelectorAll('[data-con-box]').forEach(element => {
      element.setAttribute('aria-disabled', String(state.busy));
      element.querySelector('.con-reserved-outline').setAttribute('visibility', element.dataset.conBox === state.reserved ? 'visible' : 'hidden');
    });
    root.querySelector('[data-con-warehouse]').textContent = number(state.warehouse.length);
    root.querySelector('[data-con-transit]').textContent = number(state.carried ? 1 : 0);
    root.querySelector('[data-con-shop]').textContent = number(state.shop.length);
    root.querySelector('[data-con-total]').textContent = number(state.warehouse.length + (state.carried ? 1 : 0) + state.shop.length);
    root.querySelector('[data-con-reserved]').textContent = state.reserved ? 'منها صندوق محجوز' : 'لا يوجد حجز';
    root.querySelector('[data-con-worker-status]').textContent = state.worker;
    root.querySelector('[data-con-task]').textContent = state.task;
    root.querySelector('[data-con-hint]').textContent = state.busy ? 'أمر النقل قيد التنفيذ؛ انتظر وصول العامل' : state.shop.length === 2 ? 'المحل ممتلئ؛ جرّب النقل لترى رفض الوجهة' : 'اسحب صندوقًا من المستودع إلى قطعة المحل';
    root.querySelectorAll('[data-con-step]').forEach((element, index) => {
      element.dataset.status = state.steps[index];
      element.querySelector('.con-step-mark').textContent = state.steps[index] === 'done' ? '✓' : number(index + 1);
      element.setAttribute('aria-label', `${['التحقق من الوجهة', 'حجز صندوق', 'تكليف العامل', 'التسليم'][index]}: ${state.steps[index] === 'done' ? 'اكتمل' : state.steps[index] === 'active' ? 'قيد التنفيذ' : 'بانتظار التنفيذ'}`);
    });
    worker.setAttribute('transform', `translate(${state.workerX.toFixed(2)} ${walkwayY})`);
    root.querySelector('[data-con-legs]').setAttribute('transform', `rotate(${state.walking && !reduced ? Math.sin(state.gait) * 6 : 0} 0 14)`);
    root.querySelector('[data-con-carried-box]').setAttribute('visibility', state.carried ? 'visible' : 'hidden');
    command.disabled = state.busy || Boolean(demonstration);
    root.dataset.conPhase = state.phase;
    root.dataset.conWarehouse = String(state.warehouse.length);
    root.dataset.conTransit = state.carried ? '1' : '0';
    root.dataset.conShop = String(state.shop.length);
    root.dataset.conReserved = state.reserved ? '1' : '0';
    root.dataset.conBusy = String(state.busy);
    root.dataset.conTotal = String(state.warehouse.length + (state.carried ? 1 : 0) + state.shop.length);
    root.classList.toggle('con-busy', state.busy);
  }

  function removeDrag() {
    if (!drag) return;
    const previous = drag; drag = null;
    if (previous.pointerId !== null) { try { if (svg.hasPointerCapture(previous.pointerId)) svg.releasePointerCapture(previous.pointerId); } catch {} }
    root.querySelectorAll('.con-picked').forEach(element => element.classList.remove('con-picked'));
    ghost.setAttribute('visibility', 'hidden');
    destination.classList.remove('con-drop-valid', 'con-drop-invalid');
    root.classList.remove('con-dragging');
  }
  function cancelDrag(silent = false) {
    if (!drag) return;
    removeDrag();
    if (!silent) emit('ready', 'أُلغي السحب؛ بقيت الكميات والتكليف كما كانت.', 'لم يُعتمد أمر نقل.');
  }
  function cancelDemo(silent = true) {
    if (!demonstration) return;
    demonstration = null; cancelAnimationFrame(demoFrame); demoFrame = 0;
    if (drag?.automatic) cancelDrag(true);
    cursor.setAttribute('visibility', 'hidden'); render();
    if (!silent) emit('ready', 'توقّف المثال قبل اعتماد النقل.', 'يمكنك سحب الصندوق بنفسك.');
  }
  function startDrag(key, p, pointerId = null, automatic = false) {
    const origin = sourcePoint(key);
    drag = { key, start: p, origin, pointerId, automatic };
    const source = root.querySelector(`[data-con-box="${key}"]`);
    source?.classList.add('con-picked');
    ghost.setAttribute('transform', `translate(${origin.x} ${origin.y})`);
    ghost.setAttribute('visibility', 'visible'); root.classList.add('con-dragging');
    if (pointerId !== null) svg.setPointerCapture(pointerId);
    emit('live', 'اسحب الصندوق إلى قطعة المحل.', 'الكميات لم تتغيّر بعد؛ يُفحص الهدف عند الإفلات.');
  }
  function moveDrag(p) {
    if (!drag) return;
    ghost.setAttribute('transform', `translate(${drag.origin.x + p.x - drag.start.x} ${drag.origin.y + p.y - drag.start.y})`);
    const inside = dropInside(p), full = state.shop.length >= 2;
    destination.classList.toggle('con-drop-valid', inside && !full);
    destination.classList.toggle('con-drop-invalid', inside && full);
    if (inside) emit('live', full ? 'المحل ممتلئ؛ لن يُعتمد النقل.' : 'الوجهة متاحة — أفلت لإصدار أمر النقل.', full ? 'سيبقى الصندوق في المستودع والتكليف دون تغيير.' : 'الإفلات يبدأ الحجز والتكليف وحركة العامل.');
    else emit('live', 'اسحب الصندوق إلى قطعة المحل.', 'الممر ليس وجهة تخزين.');
  }
  function finishDrag(p) {
    if (!drag) return;
    const key = drag.key; removeDrag();
    if (!dropInside(p)) { emit('fail', 'لم يُعتمد النقل؛ الصندوق بقي في المستودع.', 'أفلت داخل قطعة المحل. الممر يبقى خاليًا من التخزين.'); return; }
    requestTransfer(key);
  }

  function requestTransfer(key = state.warehouse[0]) {
    if (destroyed) return;
    if (state.busy) { emit('live', 'العامل ينفّذ أمر النقل الحالي.', 'ابدأ أمرًا آخر بعد اكتمال التسليم.'); return; }
    if (state.shop.length >= 2) { emit('fail', 'المحل ممتلئ؛ لا توجد سعة لصندوق إضافي.', 'بقيت الكميات والتكليف كما كانت. السعة صندوقان.'); return; }
    if (!state.warehouse.includes(key)) { emit('fail', 'لا يوجد صندوق متاح للنقل.', 'لم تتغيّر الكميات.'); return; }
    cancelDemo(); cancelDrag(true);
    state.busy = true; state.phase = 'validation'; state.steps = ['active', 'pending', 'pending', 'pending'];
    state.worker = 'بانتظار التكليف'; state.task = 'التحقق من سعة الوجهة';
    const run = { key, startX: state.workerX, began: null, validated: false, reserved: false, assigned: false, picked: false };
    transport = run;
    emit('live', '١ · التحقق من الوجهة.', 'المحل يملك مساحة متاحة؛ المخزون لم ينقص بعد.');
    render();
    function tick(timestamp) {
      if (destroyed || transport !== run) return;
      if (run.began === null) run.began = timestamp;
      const elapsed = timestamp - run.began;
      if (elapsed >= 180 && !run.validated) {
        run.validated = true; state.steps[0] = 'done'; state.steps[1] = 'active'; state.phase = 'reservation'; state.reserved = key;
        state.task = 'صندوق محجوز لأمر النقل';
        emit('live', '٢ · حُجز صندوق في المستودع.', `المستودع ما زال يضم ${number(state.warehouse.length)} صناديق؛ الحجز ليس نقلًا ماديًا.`);
      }
      if (elapsed >= 450 && !run.reserved) {
        run.reserved = true; state.steps[1] = 'done'; state.steps[2] = 'active'; state.phase = 'assignment';
        state.worker = 'تسلّم مهمة النقل'; state.task = `التكليف: إيصال الصندوق ${key} إلى المحل`;
        emit('live', '٣ · أُسند أمر النقل إلى العامل.', 'سيذهب العامل إلى المستودع ثم يحمل الصندوق إلى المحل.');
      }
      if (elapsed >= 650 && !run.assigned) { run.assigned = true; state.steps[2] = 'done'; state.steps[3] = 'active'; state.phase = 'approach'; state.worker = 'يتجه إلى المستودع'; }
      if (elapsed >= 650 && elapsed < 1750) {
        let amount = clamp((elapsed - 650) / 1100, 0, 1); if (reduced) amount = Math.floor(amount * 3) / 3;
        state.workerX = run.startX + (sourceGate - run.startX) * ease(amount); state.walking = true;
      }
      if (elapsed >= 1750 && !run.picked) {
        run.picked = true; state.warehouse = state.warehouse.filter(item => item !== key); state.reserved = null; state.carried = key;
        state.phase = 'carrying'; state.worker = 'يحمل الصندوق إلى المحل'; state.workerX = sourceGate;
        emit('live', '٤ · العامل يحمل الصندوق عبر الممر.', `المستودع ${number(state.warehouse.length)} + في الطريق ١ + المحل ${number(state.shop.length)} = ٣ صناديق.`);
      }
      if (elapsed >= 1750 && elapsed < 3400) {
        let amount = clamp((elapsed - 1750) / 1650, 0, 1); if (reduced) amount = Math.floor(amount * 4) / 4;
        state.workerX = sourceGate + (targetGate - sourceGate) * ease(amount); state.walking = true;
      }
      state.gait = elapsed / 85;
      if (elapsed >= 3400) {
        state.carried = null; state.shop.push(key); state.reserved = null; state.busy = false; state.phase = 'delivered'; state.workerX = targetGate; state.walking = false;
        state.worker = 'أكمل التسليم'; state.task = 'متاح لأمر نقل جديد'; state.steps = ['done', 'done', 'done', 'done'];
        transport = null; transportFrame = 0; render();
        emit('done', 'اكتمل التسليم؛ الفعل الواحد حدّث المخزون والتكليف وحركة العامل.', `المستودع ${number(state.warehouse.length)} + في الطريق ٠ + المحل ${number(state.shop.length)} = ٣ صناديق.`);
        return;
      }
      render(); transportFrame = requestAnimationFrame(tick);
    }
    transportFrame = requestAnimationFrame(tick);
  }

  on(svg, 'pointerdown', event => {
    const source = event.target.closest('[data-con-box]');
    if (!source || event.isPrimary === false || event.button !== 0 || drag && !drag.automatic) return;
    event.preventDefault();
    if (state.busy) { emit('live', 'انتظر وصول العامل إلى المحل.', 'هناك أمر نقل واحد قيد التنفيذ.'); return; }
    cancelDemo(); cancelDrag(true);
    startDrag(source.dataset.conBox, svgPoint(svg, event), event.pointerId);
  });
  on(svg, 'pointermove', event => { if (drag?.pointerId === event.pointerId) { event.preventDefault(); moveDrag(svgPoint(svg, event)); } });
  on(svg, 'pointerup', event => { if (drag?.pointerId === event.pointerId) finishDrag(svgPoint(svg, event)); });
  on(svg, 'pointercancel', event => { if (drag?.pointerId === event.pointerId) cancelDrag(); });
  on(svg, 'lostpointercapture', event => { if (drag?.pointerId === event.pointerId) cancelDrag(); });
  on(svg, 'keydown', event => {
    const source = event.target.closest('[data-con-box]');
    if (source && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); requestTransfer(source.dataset.conBox); }
  });
  on(command, 'click', () => requestTransfer());
  on(window, 'keydown', event => {
    if (event.key !== 'Escape') return;
    if (demonstration) { event.preventDefault(); cancelDemo(false); }
    else if (drag) { event.preventDefault(); cancelDrag(); }
  });
  on(window, 'blur', () => { cancelDemo(false); cancelDrag(); });
  render();

  function reset() {
    cancelDemo(); cancelDrag(true); cancelAnimationFrame(transportFrame); transportFrame = 0; transport = null;
    state = initial(); sourceSignature = ''; targetSignature = ''; render();
  }
  function play() {
    if (destroyed) return;
    reset();
    const key = state.warehouse[0], start = sourcePoint(key), finish = { x: 700, y: 183 };
    const run = { began: null }; demonstration = run;
    startDrag(key, start, null, true); cursor.setAttribute('visibility', 'visible'); render();
    cursor.setAttribute('transform', `translate(${start.x} ${start.y})`);
    function tick(timestamp) {
      if (destroyed || demonstration !== run) return;
      if (run.began === null) run.began = timestamp;
      const amount = clamp((timestamp - run.began) / 1000, 0, 1);
      const movement = reduced ? (amount < .55 ? 0 : 1) : ease(amount);
      const p = { x: start.x + (finish.x - start.x) * movement, y: start.y + (finish.y - start.y) * movement - (reduced ? 0 : Math.sin(movement * Math.PI) * 63) };
      moveDrag(p); cursor.setAttribute('transform', `translate(${p.x} ${p.y})`);
      if (amount < 1) demoFrame = requestAnimationFrame(tick);
      else {
        demonstration = null; demoFrame = 0; cursor.setAttribute('visibility', 'hidden');
        finishDrag(finish); render();
      }
    }
    demoFrame = requestAnimationFrame(tick);
  }
  return {
    play,
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelDemo(); cancelDrag(true); cancelAnimationFrame(transportFrame); transportFrame = 0; transport = null;
      controller.abort();
    }
  };
}
