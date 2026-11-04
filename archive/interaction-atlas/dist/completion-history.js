const NS = 'http://www.w3.org/2000/svg';
const clone = value => JSON.parse(JSON.stringify(value));
const fmt = value => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value);
const pointText = point => `س ${fmt(point.x)} · ص ${fmt(point.y)}`;
const samePoint = (a, b) => Math.abs(a.x - b.x) < .01 && Math.abs(a.y - b.y) < .01;
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const inside = (point, rect) => finitePoint(point) && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;

/** Committed snapshots only: previews, failed drops and cancellation never enter this history. */
export function createUndoHistory(initial) {
  const first = clone(initial);
  let entries = [{ value: clone(first), label: 'البداية' }], cursor = 0;
  return {
    get value() { return clone(entries[cursor].value); },
    get entries() { return clone(entries); },
    get cursor() { return cursor; },
    get canUndo() { return cursor > 0; },
    get canRedo() { return cursor < entries.length - 1; },
    commit(value, label) {
      if (JSON.stringify(value) === JSON.stringify(entries[cursor].value)) return false;
      entries = entries.slice(0, cursor + 1);
      entries.push({ value: clone(value), label }); cursor++;
      return true;
    },
    undo() { if (!cursor) return false; cursor--; return true; },
    redo() { if (cursor === entries.length - 1) return false; cursor++; return true; },
    reset() { entries = [{ value: clone(first), label: 'البداية' }]; cursor = 0; }
  };
}

export function acceptsHistoryPoint(point) {
  if (!finitePoint(point) || point.x < 80 || point.x > 820 || point.y < 72 || point.y > 268) return false;
  return !(point.x + 40 > 400 && point.x - 40 < 500 && point.y + 32 > 65 && point.y - 32 < 275);
}

export const initialDeletionItems = () => [
  { id: 'A-01', label: 'مخطط', x: 150, y: 130 },
  { id: 'B-02', label: 'ملاحظة', x: 320, y: 190 },
  { id: 'C-03', label: 'صورة', x: 460, y: 120 }
];

export function applyCardDrop(items, id, point) {
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return { ok: false, kind: 'missing', items: clone(items) };
  if (inside(point, { x: 650, y: 60, width: 205, height: 210 })) {
    return { ok: true, kind: 'delete', items: items.filter(item => item.id !== id).map(clone) };
  }
  if (inside(point, { x: 98, y: 76, width: 434, height: 188 })) {
    const moved = clone(items); moved[index] = { ...moved[index], x: Math.round(point.x), y: Math.round(point.y) };
    return { ok: true, kind: 'move', items: moved };
  }
  return { ok: false, kind: 'reject', items: clone(items) };
}

function toPoint(svg, event) {
  const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const matrix = svg.getScreenCTM(); return matrix ? point.matrixTransform(matrix.inverse()) : { x: NaN, y: NaN };
}

function runtime(svg, api) {
  const controller = new AbortController();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cursor = svg.querySelector('[data-chist-pointer]');
  let native = null, scheduled = null, frame = 0, version = 0, destroyed = false, lastMessage = '';
  const on = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: controller.signal });
  function emit(kind, message, detail = '') {
    const signature = [kind, message, detail].join('|');
    if (!destroyed && signature !== lastMessage) { lastMessage = signature; api[kind]?.(message, detail); }
  }
  function release(pointerId) { try { if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId); } catch {} }
  function stopNative() { if (!native) return; const previous = native; native = null; release(previous.pointerId); previous.cancel?.(); }
  function stopPlayback() {
    version++; if (frame) cancelAnimationFrame(frame); frame = 0;
    if (scheduled) { const old = scheduled; scheduled = null; old.cancel?.(); old.resolve(false); }
    cursor.setAttribute('visibility', 'hidden');
  }
  const stop = () => { stopNative(); stopPlayback(); };
  function begin(event, callbacks) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stop(); event.preventDefault(); native = { ...callbacks, pointerId: event.pointerId };
    callbacks.start?.(toPoint(svg, event));
    try { svg.setPointerCapture(event.pointerId); } catch {}
  }
  on(window, 'pointermove', event => { if (native?.pointerId !== event.pointerId) return; event.preventDefault(); native.move?.(toPoint(svg, event)); }, { passive: false });
  on(window, 'pointerup', event => { if (native?.pointerId !== event.pointerId) return; const old = native; native = null; release(old.pointerId); old.end?.(toPoint(svg, event)); });
  on(window, 'pointercancel', event => { if (native?.pointerId === event.pointerId) stopNative(); });
  on(svg, 'lostpointercapture', () => { if (native) stopNative(); });
  function stepAnimation(step, token) {
    return new Promise(resolve => {
      if (destroyed || token !== version) { resolve(false); return; }
      let start = null;
      scheduled = { resolve, cancel: step.cancel }; step.start?.();
      function tick(now) {
        if (destroyed || token !== version) return;
        if (start === null) start = now;
        const progress = Math.min(1, (now - start) / (step.duration || 700));
        const movement = reduced ? (progress < .5 ? 0 : 1) : progress;
        if (step.from && step.to) {
          const point = { x: step.from.x + (step.to.x - step.from.x) * movement, y: step.from.y + (step.to.y - step.from.y) * movement };
          step.move?.(point); cursor.setAttribute('transform', `translate(${point.x + 8} ${point.y + 10})`); cursor.setAttribute('visibility', reduced ? 'hidden' : 'visible');
        }
        if (progress < 1) { frame = requestAnimationFrame(tick); return; }
        frame = 0; scheduled = null; cursor.setAttribute('visibility', 'hidden'); step.end?.(); resolve(true);
      }
      frame = requestAnimationFrame(tick);
    });
  }
  async function playSteps(steps) {
    stop(); const token = version;
    for (const step of steps) { if (destroyed || token !== version || !(await stepAnimation(step, token))) return false; }
    return true;
  }
  return { on, emit, begin, stop, playSteps, get nativeActive() { return !!native; }, destroy() { destroyed = true; stop(); controller.abort(); } };
}

function shell(container, id, title, explanation, scene, extraControls) {
  container.innerHTML = `<section class="chist-root" data-chist-mode="${id}"><div class="chist-intro"><strong>${title}</strong><p>${explanation}</p></div><div class="chist-stats" data-chist-stats></div><svg class="chist-board" viewBox="0 0 900 340" role="group" aria-label="${title}">${scene}<g data-chist-pointer visibility="hidden" aria-hidden="true"><circle r="21" fill="#d38352" opacity=".18"/><path d="M-4-10v25l7-7 8 2Z" fill="#fffdf5" stroke="#a56e3e" stroke-width="2"/></g></svg><p class="chist-observation" data-chist-observation></p><div class="chist-controls"><button type="button" data-chist-action="play" class="chist-primary">شاهد التسلسل</button><button type="button" data-chist-action="undo">تراجع عن آخر اعتماد</button><button type="button" data-chist-action="redo">أعِد الخطوة</button><button type="button" data-chist-action="cancel">إلغاء السحب الجاري</button><button type="button" data-chist-action="reset">إعادة البداية</button></div><details class="chist-alternatives"><summary>بدائل النقر ولوحة المفاتيح</summary><p>${id === 'history' ? 'ركّز البطاقة ثم حرّكها بالأسهم؛ Enter يعتمد الموضع وEscape يلغي المعاينة. الأزرار التالية تنفّذ الخطوات نفسها.' : 'ركّز بطاقة ثم استخدم الأسهم؛ Enter يفلتها وEscape يلغي السحب. اختر بطاقة من الأزرار لتنفيذ النقل أو الحذف دون سحب.'}</p><div class="chist-controls chist-alternative-controls">${extraControls}</div></details><div class="chist-history"><div class="chist-history-heading"><strong>سجل الحالات المعتمدة</strong><span data-chist-history-caption></span></div><ol data-chist-history></ol></div><p class="chist-rule">الإلغاء يوقف المعاينة الحالية · التراجع يستعيد اعتمادًا سابقًا · إعادة البداية تمسح سجل هذه التجربة.</p></section>`;
  const root = container.querySelector('.chist-root');
  return { root, svg: root.querySelector('.chist-board'), q: selector => root.querySelector(selector) };
}

function paintHistory(q, history, pending, describe) {
  q('[data-chist-history]').innerHTML = history.entries.map((entry, index) => `<li class="${index === history.cursor ? 'current' : index > history.cursor ? 'future' : ''}" ${index === history.cursor ? 'aria-current="step"' : ''}><small>${index ? `خطوة ${fmt(index)}` : 'البداية'}</small><strong>${entry.label}</strong><span>${describe(entry.value)}</span>${index === history.cursor ? '<em>الحالة الحالية</em>' : index > history.cursor ? '<em>يمكن إعادتها</em>' : ''}</li>`).join('');
  q('[data-chist-history-caption]').textContent = `${fmt(history.cursor)} اعتماد قبل الحالة الحالية · ${fmt(history.entries.length - history.cursor - 1)} قابل للإعادة`;
  q('[data-chist-action="undo"]').disabled = pending || !history.canUndo;
  q('[data-chist-action="redo"]').disabled = pending || !history.canRedo;
  q('[data-chist-action="cancel"]').disabled = !pending;
}

function mountHistory(container, api) {
  const initial = { x: 170, y: 160 }, history = createUndoHistory(initial);
  const scene = `<rect x="40" y="40" width="820" height="260" rx="20" class="chist-floor"/><path d="M80 85H820M80 160H820M80 235H820" stroke="#dfe7d5" stroke-width="1" stroke-dasharray="5 7"/><rect x="400" y="65" width="100" height="210" rx="12" fill="#e9dfcf" stroke="#c5ad8c" stroke-width="2"/><text x="450" y="158" class="chist-svg-label" fill="#93704b">عائق</text><text x="450" y="190" class="chist-svg-small" fill="#93704b">لا يقبل الإفلات</text><g data-chist-saved><rect x="-40" y="-32" width="80" height="64" rx="12" fill="none" stroke="#80986f" stroke-width="2" stroke-dasharray="5 4"/></g><g data-chist-handle role="button" tabindex="0" aria-label="بطاقة الموضع؛ الأسهم للمعاينة وEnter للاعتماد"><rect data-chist-actor x="-40" y="-32" width="80" height="64" rx="12" fill="#23634a" stroke="#fffdf5" stroke-width="3"/><path d="M-13-6h26m-26 12h26" stroke="#e8efdb" stroke-width="3" stroke-linecap="round"/></g><text x="170" y="326" class="chist-svg-small">إطار منقط = الموضع المعتمد</text>`;
  const { root, svg, q } = shell(container, 'history', 'المعاينة والإلغاء والتراجع', 'انقل البطاقة إلى موضعين صالحين، ثم جرّب الإلغاء والتراجع. العائق يختبر موضع الإفلات؛ يمكن المرور فوقه أثناء المعاينة.', scene, '<button type="button" data-chist-action="preset-a">اعتماد الموضع ١</button><button type="button" data-chist-action="preset-b">اعتماد الموضع ٢</button><button type="button" data-chist-action="preview">ابدأ معاينة فوق العائق</button><button type="button" data-chist-action="reject">جرّب إفلاتًا مرفوضًا</button>');
  const ctx = runtime(svg, api), handle = q('[data-chist-handle]');
  let pending = null, offset = { x: 0, y: 0 }, keyboard = false, action = 'ready', note = 'ابدأ بنقل البطاقة. لن يُضاف شيء إلى السجل حتى الإفلات الصالح.';
  function paint() {
    const saved = history.value, point = pending || saved, valid = acceptsHistoryPoint(point);
    handle.setAttribute('transform', `translate(${point.x} ${point.y})`);
    handle.setAttribute('aria-label', `بطاقة الموضع ${pointText(point)}. الأسهم للمعاينة وEnter للاعتماد وEscape للإلغاء.`);
    q('[data-chist-actor]').setAttribute('fill', pending ? valid ? '#6a9460' : '#b97650' : '#23634a');
    q('[data-chist-saved]').setAttribute('transform', `translate(${saved.x} ${saved.y})`);
    q('[data-chist-saved]').setAttribute('visibility', pending ? 'visible' : 'hidden');
    q('[data-chist-stats]').innerHTML = `<div><span>الموضع المعتمد</span><strong>${pointText(saved)}</strong></div><div><span>المعاينة الحالية</span><strong>${pending ? pointText(point) : 'لا يوجد سحب جارٍ'}</strong></div><div><span>صلاحية الإفلات</span><strong>${pending ? valid ? 'صالح' : 'مرفوض' : 'بانتظار السحب'}</strong></div>`;
    q('[data-chist-observation]').textContent = note;
    root.dataset.chistCommittedX = saved.x; root.dataset.chistCommittedY = saved.y;
    root.dataset.chistPreviewX = point.x; root.dataset.chistPreviewY = point.y;
    root.dataset.chistPending = String(!!pending); root.dataset.chistValid = String(valid);
    root.dataset.chistCursor = history.cursor; root.dataset.chistEntries = history.entries.length;
    root.dataset.chistCanUndo = String(history.canUndo); root.dataset.chistCanRedo = String(history.canRedo);
    root.dataset.chistLastAction = action;
    paintHistory(q, history, !!pending, pointText);
  }
  function begin(point = history.value) { pending = history.value; offset = { x: pending.x - point.x, y: pending.y - point.y }; action = 'preview'; note = 'الموضع المعتمد ثابت. البطاقة المتحركة معاينة حتى تفلتها.'; paint(); }
  function move(point) {
    if (!pending || !finitePoint(point)) return;
    pending = { x: Math.round(point.x + offset.x), y: Math.round(point.y + offset.y) };
    note = acceptsHistoryPoint(pending) ? 'المعاينة صالحة؛ الإفلات سيضيف اعتمادًا إلى السجل.' : 'المعاينة غير صالحة؛ الإفلات هنا يحفظ آخر اعتماد.';
    paint(); ctx.emit('live', note, `المعتمد: ${pointText(history.value)} · المعاينة: ${pointText(pending)}.`);
  }
  function end(point) {
    if (!pending) return; move(point); const next = pending; pending = null; keyboard = false;
    if (!acceptsHistoryPoint(next)) { action = 'reject'; note = 'رُفض الإفلات؛ بقي آخر موضع معتمد ولم تُضف خطوة.'; paint(); ctx.emit('fail', note, 'التراجع ما زال يشير إلى آخر اعتماد صالح.'); return; }
    const branched = history.canRedo, changed = history.commit(next, 'نقل البطاقة'); action = changed ? 'commit' : 'unchanged';
    note = changed ? branched ? 'اعتُمد موضع جديد بعد التراجع؛ أُلغي فرع الإعادة السابق.' : 'اعتُمد الموضع عند الإفلات وأُضيف إلى السجل.' : 'الموضع لم يتغير؛ لم تُضف خطوة مكررة.';
    paint(); ctx.emit(changed ? 'done' : 'ready', note, pointText(history.value));
  }
  function cancel() { if (!pending) return; pending = null; keyboard = false; action = 'cancel'; note = 'أُلغيت المعاينة فقط؛ آخر اعتماد وسجله محفوظان.'; paint(); ctx.emit('ready', note, `المعتمد: ${pointText(history.value)}.`); }
  function command(type, quiet = false) {
    if (!quiet) { ctx.stop(); cancel(); }
    if (type === 'undo' || type === 'redo') {
      const changed = history[type](); action = type;
      note = changed ? type === 'undo' ? 'استُعيد الاعتماد السابق؛ ما زال يمكن إعادة الخطوة.' : 'أُعيد الاعتماد الذي تراجعت عنه.' : 'لا توجد خطوة متاحة لهذا الإجراء.';
      paint(); ctx.emit(changed ? 'done' : 'ready', note, pointText(history.value));
    } else if (type === 'reset') {
      pending = null; keyboard = false; history.reset(); action = 'reset'; note = 'عادت البداية ومُسح سجل التجربة. هذا يختلف عن التراجع خطوة واحدة.'; paint(); ctx.emit('ready', note);
    } else if (type === 'preset-a' || type === 'preset-b' || type === 'reject' || type === 'preview') {
      const point = type === 'preset-a' ? { x: 300, y: 90 } : type === 'preset-b' ? { x: 680, y: 190 } : { x: 450, y: 160 };
      begin(); move(point); if (type === 'preview') keyboard = true; else end(point);
    }
  }
  ctx.on(svg, 'pointerdown', event => { if (event.target.closest('[data-chist-handle]')) { cancel(); ctx.begin(event, { start: begin, move, end, cancel }); } });
  ctx.on(window, 'keydown', event => {
    if (event.key === 'Escape') { if (pending) event.preventDefault(); ctx.stop(); cancel(); return; }
    if (!event.target.closest?.('[data-chist-handle]') && !keyboard) return;
    if (ctx.nativeActive) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ctx.stop(); if (pending) end(pending); else { begin(); keyboard = true; } return; }
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
    if (!delta) return; event.preventDefault(); ctx.stop(); if (!pending) begin(); keyboard = true; move({ x: pending.x + delta[0], y: pending.y + delta[1] });
  });
  const suspend = () => { ctx.stop(); cancel(); };
  ctx.on(window, 'blur', suspend); ctx.on(document, 'visibilitychange', () => { if (document.hidden) suspend(); });
  async function play() {
    ctx.stop(); cancel(); command('reset', true);
    const drag = (from, to, finish = 'commit', duration = 850) => ({ from, to, duration, start: () => begin(from), move, end: () => finish === 'cancel' ? cancel() : end(to), cancel });
    const pause = (operation, duration = 700) => ({ duration, start: () => command(operation, true) });
    const finished = await ctx.playSteps([
      drag(initial, { x: 300, y: 90 }), drag({ x: 300, y: 90 }, { x: 680, y: 190 }),
      drag({ x: 680, y: 190 }, { x: 450, y: 160 }, 'cancel'), drag({ x: 680, y: 190 }, { x: 450, y: 160 }),
      pause('undo'), pause('redo'), pause('undo'), drag({ x: 300, y: 90 }, { x: 700, y: 85 }), pause('undo')
    ]);
    if (finished) { action = 'demo-complete'; note = 'انتهينا عند الاعتماد الأول، لا عند البداية. المعاينة الملغاة والإفلات المرفوض لم يدخلا السجل؛ والفرع الجديد حلّ محل الإعادة القديمة.'; paint(); ctx.emit('done', 'التراجع أعاد خطوة معتمدة؛ إعادة البداية إجراء مختلف.', 'الآن س ٣٠٠، ص ٩٠. يمكنك إعادة الفرع الجديد إلى س ٧٠٠، ص ٨٥، أو التراجع إلى البداية.'); }
  }
  ctx.on(root, 'click', event => { const button = event.target.closest('[data-chist-action]'); if (!button) return; const type = button.dataset.chistAction; if (type === 'play') play(); else if (type === 'cancel') suspend(); else command(type); });
  paint();
  return { play, destroy() { ctx.destroy(); pending = null; } };
}

function mountDelete(container, api) {
  const history = createUndoHistory(initialDeletionItems());
  const scene = `<rect x="40" y="40" width="550" height="260" rx="20" class="chist-floor"/><text x="315" y="27" class="chist-svg-small">مساحة العناصر الموجودة</text><rect x="650" y="60" width="205" height="210" rx="20" fill="#f1e5d8" stroke="#c88c65" stroke-width="2" data-chist-trash/><path d="M714 132h76m-62 0 5 62h38l5-62m-31-12h16m-20 25v35m15-35v35" stroke="#9c6848" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="752" y="230" class="chist-svg-label" fill="#935f3e">هدف الحذف</text><text x="752" y="300" class="chist-svg-small">اعتماد عند الإفلات</text><g data-chist-delete-ghost visibility="hidden"><rect x="-58" y="-36" width="116" height="72" rx="12" fill="none" stroke="#8b9d7e" stroke-width="2" stroke-dasharray="5 5"/></g><g data-chist-cards></g>`;
  const extra = '<div class="chist-card-picker" data-chist-picker></div><button type="button" data-chist-action="selection">إلغاء / إعادة التحديد</button><button type="button" data-chist-action="move">انقل المحدد داخل المساحة</button><button type="button" data-chist-action="delete">أفلت المحدد على الحذف</button><button type="button" data-chist-action="preview">عاين الحذف دون إفلات</button><button type="button" data-chist-action="reject">جرّب هدفًا غير صالح</button>';
  const { root, svg, q } = shell(container, 'delete', 'الحذف يغيّر مجموعة العناصر', 'نقل البطاقة داخل المساحة يحفظ هويتها. إفلات مركزها على هدف الحذف يزيل سجلها من المجموعة الحالية؛ التراجع يستعيد السجل نفسه.', scene, extra);
  const ctx = runtime(svg, api), cards = q('[data-chist-cards]');
  let selected = 'A-01', pending = null, offset = { x: 0, y: 0 }, keyboard = false, action = 'ready', note = 'ثلاثة سجلات موجودة. إلغاء تحديد بطاقة لا يزيلها من المجموعة.';
  const itemLabel = item => `${item.label} ${item.id}`;
  function selectedItem() { return history.value.find(item => item.id === selected); }
  function reconcileSelection() { if (selected && !history.value.some(item => item.id === selected)) selected = history.value[0]?.id || null; }
  function paint() {
    const items = history.value;
    cards.querySelectorAll('[data-chist-card]').forEach(node => { if (!items.some(item => item.id === node.dataset.chistCard)) node.remove(); });
    for (const [index, item] of items.entries()) {
      let node = cards.querySelector(`[data-chist-card="${item.id}"]`);
      if (!node) { node = document.createElementNS(NS, 'g'); node.dataset.chistCard = item.id; node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); node.innerHTML = '<rect x="-58" y="-36" width="116" height="72" rx="12"/><text class="chist-svg-card-label" y="-3"></text><text class="chist-svg-card-id" y="24"></text>'; cards.append(node); }
      if (cards.children[index] !== node) cards.insertBefore(node, cards.children[index] || null);
      const moving = pending?.id === item.id, point = moving ? pending.point : item;
      node.setAttribute('transform', `translate(${point.x} ${point.y})`);
      node.setAttribute('aria-label', `${itemLabel(item)}؛ ${selected === item.id ? 'محددة' : 'غير محددة'}. الأسهم للحركة وEnter للإفلات.`);
      node.setAttribute('aria-pressed', String(selected === item.id));
      node.querySelector('rect').setAttribute('fill', moving ? '#e4ecd6' : selected === item.id ? '#dcead1' : '#fffdf5');
      node.querySelector('rect').setAttribute('stroke', selected === item.id ? '#3f7a4e' : '#b8c8a9'); node.querySelector('rect').setAttribute('stroke-width', selected === item.id ? '3' : '2');
      node.querySelector('.chist-svg-card-label').textContent = item.label; node.querySelector('.chist-svg-card-id').textContent = item.id;
    }
    const ghost = q('[data-chist-delete-ghost]'), carried = pending && items.find(item => item.id === pending.id);
    ghost.setAttribute('visibility', carried ? 'visible' : 'hidden');
    if (carried) ghost.setAttribute('transform', `translate(${carried.x} ${carried.y})`);
    const drop = pending ? applyCardDrop(items, pending.id, pending.point) : null;
    q('[data-chist-trash]').setAttribute('fill', drop?.kind === 'delete' ? '#e6d0bb' : '#f1e5d8');
    q('[data-chist-stats]').innerHTML = `<div><span>السجلات الموجودة</span><strong>${fmt(items.length)} بطاقات</strong></div><div><span>المحدد الآن</span><strong dir="auto">${selected || 'لا شيء'}</strong></div><div><span>الإفلات المقترح</span><strong>${drop ? drop.kind === 'delete' ? 'حذف سجل' : drop.kind === 'move' ? 'نقل السجل نفسه' : 'هدف مرفوض' : 'لا توجد معاينة'}</strong></div>`;
    q('[data-chist-observation]').textContent = note;
    q('[data-chist-picker]').innerHTML = items.map(item => `<button type="button" data-chist-select="${item.id}" aria-pressed="${selected === item.id}">اختر ${item.label} <bdi>${item.id}</bdi></button>`).join('') || '<span>المجموعة فارغة؛ أعد سجلًا بالتراجع.</span>';
    for (const type of ['move', 'delete', 'preview', 'reject']) q(`[data-chist-action="${type}"]`).disabled = !selectedItem();
    q('[data-chist-action="selection"]').disabled = !items.length;
    paintHistory(q, history, !!pending, value => `${fmt(value.length)} بطاقات · ${value.map(item => item.id).join('، ') || 'فارغة'}`);
    root.dataset.chistItemIds = items.map(item => item.id).join(','); root.dataset.chistItems = JSON.stringify(items); root.dataset.chistItemCount = items.length;
    root.dataset.chistSelected = selected || ''; root.dataset.chistPending = String(!!pending); root.dataset.chistDrop = drop?.kind || 'none';
    root.dataset.chistCursor = history.cursor; root.dataset.chistEntries = history.entries.length; root.dataset.chistCanUndo = String(history.canUndo); root.dataset.chistCanRedo = String(history.canRedo);
    root.dataset.chistLastAction = action;
  }
  function begin(id, point) {
    const item = history.value.find(item => item.id === id); if (!item) return false;
    selected = id; pending = { id, point: { x: item.x, y: item.y } };
    const hand = point || item; offset = { x: item.x - hand.x, y: item.y - hand.y };
    action = 'preview'; note = 'البطاقة المحمولة ما زالت سجلًا موجودًا؛ لم يُعتمد شيء بعد.'; paint(); return true;
  }
  function move(point) {
    if (!pending || !finitePoint(point)) return;
    pending.point = { x: Math.round(point.x + offset.x), y: Math.round(point.y + offset.y) };
    const result = applyCardDrop(history.value, pending.id, pending.point);
    note = result.kind === 'delete' ? 'أنت فوق هدف الحذف؛ السجل باقٍ حتى الإفلات.' : result.kind === 'move' ? 'الإفلات داخل المساحة ينقل السجل ويحفظ هويته وعدد البطاقات.' : 'هذا الهدف غير صالح؛ الإفلات يعيد البطاقة إلى موضعها المعتمد.';
    paint(); ctx.emit('live', note, `السجلات الحالية: ${fmt(history.value.length)}.`);
  }
  function end(point) {
    if (!pending) return; move(point); const id = pending.id, result = applyCardDrop(history.value, id, pending.point);
    pending = null; keyboard = false;
    if (!result.ok) { action = 'reject'; note = 'رُفض الإفلات؛ الهوية والموضع والعدد وسجل الاعتمادات محفوظة.'; paint(); ctx.emit('fail', note); return; }
    const changed = history.commit(result.items, result.kind === 'delete' ? `حذف ${id}` : `نقل ${id}`);
    action = changed ? result.kind : 'selection';
    note = changed ? result.kind === 'delete' ? `أُزيل سجل ${id} من المجموعة الحالية. التراجع يعيد هويته وموضعه وترتيبه.` : `نُقل ${id}؛ عدد السجلات وهوياتها لم يتغيرا.` : `اختيرت ${id} دون نقل أو حذف؛ لم تُضف خطوة إلى السجل.`;
    reconcileSelection(); paint(); ctx.emit(changed ? 'done' : 'ready', note, `السجلات الآن: ${history.value.map(item => item.id).join('، ') || 'لا توجد بطاقات'}.`);
  }
  function cancel() { if (!pending) return; pending = null; keyboard = false; action = 'cancel'; note = 'أُلغي الحمل؛ لم يُحذف أي سجل ولم يتغير موضعه.'; paint(); ctx.emit('ready', note, `السجلات: ${fmt(history.value.length)}.`); }
  function command(type, quiet = false) {
    if (!quiet) { ctx.stop(); cancel(); }
    if (type === 'undo' || type === 'redo') {
      const changed = history[type](); action = type; reconcileSelection();
      note = changed ? type === 'undo' ? 'استُعيدت المجموعة السابقة بالهويات والمواضع والترتيب نفسها.' : 'أُعيد الإجراء المعتمد نفسه.' : 'لا توجد خطوة متاحة لهذا الإجراء.';
      paint(); ctx.emit(changed ? 'done' : 'ready', note, `السجلات: ${history.value.map(item => item.id).join('، ') || 'المجموعة فارغة'}.`);
    } else if (type === 'reset') {
      history.reset(); selected = 'A-01'; pending = null; keyboard = false; action = 'reset'; note = 'عادت البطاقات الثلاث إلى البداية ومُسح السجل.'; paint(); ctx.emit('ready', note);
    } else if (type === 'selection') {
      selected = selected ? null : history.value[0]?.id || null; action = 'selection'; note = 'التحديد فقط تغيّر. عدد السجلات ومواضعها وسجل الاعتمادات كما هي.'; paint(); ctx.emit('done', note);
    } else if (['move', 'delete', 'preview', 'reject'].includes(type)) {
      const item = selectedItem(); if (!item) return;
      const point = type === 'move' ? { x: item.x === 190 && item.y === 225 ? 150 : 190, y: item.x === 190 && item.y === 225 ? 130 : 225 } : type === 'reject' ? { x: 620, y: 175 } : { x: 752, y: 160 };
      begin(item.id); move(point); if (type === 'preview') keyboard = true; else end(point);
    }
  }
  ctx.on(svg, 'pointerdown', event => {
    const card = event.target.closest('[data-chist-card]'); if (!card) return;
    cancel(); const id = card.dataset.chistCard; ctx.begin(event, { start: point => begin(id, point), move, end, cancel });
  });
  ctx.on(window, 'keydown', event => {
    if (event.key === 'Escape') { if (pending) event.preventDefault(); ctx.stop(); cancel(); return; }
    const card = event.target.closest?.('[data-chist-card]'); if (!card && !keyboard) return;
    if (ctx.nativeActive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); ctx.stop(); if (pending) { end(pending.point); q('[data-chist-action="undo"]').focus(); } else if (card) { begin(card.dataset.chistCard); keyboard = true; } return;
    }
    const delta = { ArrowLeft: [-25, 0], ArrowRight: [25, 0], ArrowUp: [0, -25], ArrowDown: [0, 25] }[event.key];
    if (!delta) return; event.preventDefault(); ctx.stop(); if (!pending && !begin(card.dataset.chistCard)) return; keyboard = true; move({ x: pending.point.x + delta[0], y: pending.point.y + delta[1] });
  });
  const suspend = () => { ctx.stop(); cancel(); };
  ctx.on(window, 'blur', suspend); ctx.on(document, 'visibilitychange', () => { if (document.hidden) suspend(); });
  async function play() {
    ctx.stop(); cancel(); command('reset', true);
    const drag = (from, to, finish = 'commit') => ({ from, to, duration: 850, start: () => begin('A-01', from), move, end: () => finish === 'cancel' ? cancel() : end(to), cancel });
    const finished = await ctx.playSteps([
      { duration: 700, start: () => command('selection', true) },
      drag({ x: 150, y: 130 }, { x: 190, y: 225 }),
      drag({ x: 190, y: 225 }, { x: 752, y: 160 }, 'cancel'),
      drag({ x: 190, y: 225 }, { x: 620, y: 175 }),
      drag({ x: 190, y: 225 }, { x: 752, y: 160 }),
      { duration: 900, start: () => command('undo', true) },
      { duration: 900, start: () => command('redo', true) }
    ]);
    if (finished) { action = 'demo-complete'; note = 'الآن بطاقتان: الحذف أزال A-01 فعلًا. جرّب التراجع لتستعيدها في موضعها المنقول وترتيبها الأول، ثم تراجع مرة أخرى لإلغاء النقل.'; paint(); ctx.emit('done', 'النقل حافظ على الهوية؛ الحذف أزال سجلًا؛ التراجع يستعيده.', 'المجموعة الحالية B-02، C-03. التراجع يعيد A-01 إلى س ١٩٠، ص ٢٢٥ في بداية المجموعة.'); }
  }
  ctx.on(root, 'click', event => {
    const picker = event.target.closest('[data-chist-select]');
    if (picker) { ctx.stop(); cancel(); selected = picker.dataset.chistSelect; action = 'selection'; note = 'اختيرت البطاقة فقط؛ السجلات والمواضع كما هي.'; paint(); ctx.emit('ready', note); return; }
    const button = event.target.closest('[data-chist-action]'); if (!button) return;
    const type = button.dataset.chistAction; if (type === 'play') play(); else if (type === 'cancel') suspend(); else command(type);
  });
  paint();
  return { play, destroy() { ctx.destroy(); pending = null; } };
}

export function mountCompletionHistory(id, container, api) {
  if (id === 'history') return mountHistory(container, api);
  if (id === 'delete') return mountDelete(container, api);
  throw new Error(`Unknown history example: ${id}`);
}
