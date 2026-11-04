const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const number = (v) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(v);
const grip = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
const arrow = (up) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 ${up ? 15 : 9} 6 ${up ? -6 : 6} 6 ${up ? 6 : -6}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const boxArt = (small = false) => `<svg class="op-box-art${small ? ' op-small-art' : ''}" viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="61" cy="94" rx="44" ry="9" fill="#1d322f" opacity=".08"/><path d="m17 31 43-19 43 19-43 20Z" fill="#e6bd85"/><path d="M17 31v49l43 22V51Z" fill="#c8945d"/><path d="M60 51v51l43-22V31Z" fill="#dba970"/><path d="m46 18 42 20v17l-13 6V44L33 24Z" fill="#f8e8c8"/><path d="m29 60 21 10v16L29 76Z" fill="#fff8e8" opacity=".8"/><path d="m34 69 10 5" stroke="#ad7e4e" stroke-width="2"/><path d="M60 51v51" stroke="#b98851" stroke-width="1.5"/></svg>`;
const avatar = '<svg class="op-avatar" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="36" fill="#e9c59e"/><path d="M13 72c0-18 9-28 23-28s23 10 23 28" fill="#166353"/><path d="M28 40h16v13c-5 6-11 6-16 0Z" fill="#bb7e54"/><ellipse cx="36" cy="29" rx="14" ry="17" fill="#d79b6f"/><path d="M22 29c-4-17 4-24 15-23 11 1 17 8 13 24l-4-9-3-4-17 5Z" fill="#253a34"/><path d="M31 35q5 4 10 0" fill="none" stroke="#61452e" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="28" r="1.2" fill="#253a34"/><circle cx="42" cy="28" r="1.2" fill="#253a34"/><path d="m28 51 8 7 8-7" fill="none" stroke="#f1ddbe" stroke-width="2"/></svg>';

function shopArt(color = '#166353') {
  return `<svg class="op-shop-art" viewBox="0 0 300 160" aria-hidden="true"><ellipse cx="150" cy="146" rx="111" ry="10" fill="#1d322f" opacity=".07"/><rect x="53" y="22" width="194" height="120" rx="6" fill="#eadcc6"/><rect x="65" y="16" width="170" height="32" rx="5" fill="${color}"/><path d="M45 55h210l-10 29H55Z" fill="#faf6e8"/>${[0,2,4,6].map(i=>`<path d="M${45+i*30} 55h30l${i<3?3:-3} 29h-30Z" fill="${color}"/>`).join('')}<path d="M55 83h190" stroke="#beab8a" stroke-width="2"/><rect x="76" y="91" width="75" height="51" rx="2" fill="#78978a"/><path d="M113 92v49M77 114h73" stroke="#ebe3d2" stroke-width="4"/><rect x="170" y="91" width="52" height="51" rx="2" fill="#b88861"/><circle cx="211" cy="119" r="2.5" fill="#f9edda"/><path d="M50 143h200" stroke="#bca989" stroke-width="5" stroke-linecap="round"/><rect x="116" y="28" width="68" height="6" rx="3" fill="#f2e5cb" opacity=".9"/><rect x="102" y="38" width="96" height="3" rx="1.5" fill="#f2e5cb" opacity=".45"/></svg>`;
}

export function mountOperations(id, container, api) {
  const controller = new AbortController();
  let destroyed = false;
  let gesture = null;
  let lastEmission = '';
  const on = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: controller.signal });
  const emit = (method, message, detail = '') => {
    const signature = `${method}|${message}|${detail}`;
    if (!destroyed && signature !== lastEmission) { lastEmission = signature; api[method]?.(message, detail); }
  };
  function rememberControls() {
    const active = document.activeElement;
    let selector = '';
    let task = '';
    if (active && container.contains(active)) {
      for (const attr of ['data-op-transfer','data-op-assign','data-op-reorder']) {
        if (active.hasAttribute(attr)) { selector = `[${attr}="${active.getAttribute(attr)}"]`; break; }
      }
      if (active.hasAttribute('data-key')) {
        task = active.getAttribute('data-key');
        selector += `[data-key="${task}"]`;
      }
    }
    return { open: container.querySelector('.op-access')?.open || false, selector, task };
  }
  function restoreControls(state) {
    const details = container.querySelector('.op-access');
    if (details) details.open = state.open;
    let target = state.selector ? container.querySelector(state.selector) : null;
    if (target?.disabled && state.task) target = [...container.querySelectorAll(`[data-key="${state.task}"]`)].find(button => !button.disabled);
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }
  const inside = (event, rect) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  const release = () => { try { if (gesture && container.hasPointerCapture(gesture.pointerId)) container.releasePointerCapture(gesture.pointerId); } catch {} };
  const cancel = (silent = false) => {
    if (!gesture) return;
    const previous = gesture;
    release(); gesture = null;
    container.classList.remove('op-is-dragging');
    previous.cancel?.(silent);
  };
  function begin(event, callbacks) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    cancel(true);
    gesture = { ...callbacks, pointerId: event.pointerId };
    container.classList.add('op-is-dragging');
    try { container.setPointerCapture(event.pointerId); } catch {}
  }
  on(window, 'pointermove', event => { if (gesture?.pointerId === event.pointerId) { event.preventDefault(); gesture.move?.(event); } }, { passive: false });
  on(window, 'pointerup', event => {
    if (gesture?.pointerId !== event.pointerId) return;
    const previous = gesture;
    release(); gesture = null;
    container.classList.remove('op-is-dragging');
    previous.end?.(event);
  });
  on(window, 'pointercancel', event => { if (gesture?.pointerId === event.pointerId) cancel(); });
  on(window, 'keydown', event => { if (event.key === 'Escape' && gesture) { event.preventDefault(); cancel(); } });
  on(window, 'blur', () => cancel());

  function ghostFor(source, initial) {
    const bounds = source.getBoundingClientRect();
    const ghost = source.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.tabIndex = -1;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.querySelectorAll('button, input, select, textarea, a, [tabindex]').forEach(element => { element.tabIndex = -1; });
    ghost.classList.add('op-drag-ghost');
    Object.assign(ghost.style, { width: `${bounds.width}px`, height: `${bounds.height}px`, left: `${bounds.left}px`, top: `${bounds.top}px` });
    document.body.append(ghost);
    source.classList.add('op-picked');
    return {
      move(event) { ghost.style.left = `${bounds.left + event.clientX - initial.clientX}px`; ghost.style.top = `${bounds.top + event.clientY - initial.clientY}px`; },
      remove() { ghost.remove(); source.classList.remove('op-picked'); }
    };
  }

  function valueDemo() {
    let quantity = 12;
    const unitPrice = 6;
    container.innerHTML = `<div class="op-demo op-value-demo">
      <div class="op-value-product"><div class="op-product-art">${boxArt()}<span class="op-art-tag">مخزون المحل</span></div><div><span class="op-eyebrow">معاينة كمية الشراء</span><h3>صناديق البضاعة</h3><p>سعر الصندوق التجريبي <b>${number(unitPrice)} ر.س</b></p></div></div>
      <div class="op-value-numbers"><div><span>الكمية</span><strong data-op-quantity>${number(quantity)}</strong><small>صندوق</small></div><span class="op-value-multiply">×</span><div><span>الإجمالي</span><strong data-op-total>${number(quantity * unitPrice)}</strong><small>ر.س</small></div></div>
      <div class="op-slider-area"><div class="op-slider" role="slider" tabindex="0" aria-label="كمية الصناديق" aria-valuemin="0" aria-valuemax="40" aria-valuenow="12" aria-valuetext="١٢ صندوقًا"><span class="op-slider-rail"></span><span class="op-slider-fill"></span><span class="op-slider-thumb">${grip}</span></div><div class="op-slider-scale" aria-hidden="true">${[0,10,20,30,40].map(n=>`<span>${number(n)}</span>`).join('')}</div></div>
      <div class="op-value-note"><span class="op-live-dot"></span>العدد والإجمالي يتغيّران أثناء السحب</div>
      <details class="op-access"><summary>التحكم دون سحب</summary><div class="op-access-row"><button type="button" data-op-value="-1" aria-label="إنقاص الكمية">−</button><button type="button" data-op-value="1" aria-label="زيادة الكمية">+</button><span>أو ركّز المؤشر واستخدم الأسهم. هذه معاينة فقط.</span></div></details>
    </div>`;
    const slider = container.querySelector('.op-slider');
    function paint() {
      const pct = `${quantity / 40 * 100}%`;
      slider.style.setProperty('--op-value', pct);
      slider.setAttribute('aria-valuenow', String(quantity));
      slider.setAttribute('aria-valuetext', `${number(quantity)} صندوقًا`);
      container.querySelector('[data-op-quantity]').textContent = number(quantity);
      container.querySelector('[data-op-total]').textContent = number(quantity * unitPrice);
    }
    const message = () => `الكمية: ${number(quantity)} · الإجمالي: ${number(quantity * unitPrice)} ر.س`;
    function fromPointer(event) {
      const r = slider.getBoundingClientRect();
      const next = clamp(Math.round((event.clientX - r.left) / r.width * 40), 0, 40);
      if (next !== quantity) { quantity = next; paint(); emit('live', message(), 'القيمة تتغيّر مباشرة أثناء السحب.'); }
    }
    on(slider, 'pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const before = quantity;
      begin(event, {
        move: fromPointer,
        end: current => {
          fromPointer(current);
          if (quantity !== before) emit('done', message(), 'انتهت معاينة الكمية. لم تُنفّذ عملية شراء.');
          else emit('ready', 'اسحب المؤشر لتغيير الكمية.');
        },
        cancel: silent => { quantity = before; paint(); if (!silent) emit('ready', 'أُلغي السحب وعادت الكمية السابقة.'); }
      });
      if (gesture) fromPointer(event);
    });
    on(slider, 'keydown', event => {
      const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[event.key];
      if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const before = quantity;
      quantity = event.key === 'Home' ? 0 : event.key === 'End' ? 40 : clamp(quantity + delta, 0, 40);
      paint();
      if (quantity !== before) emit('done', message(), 'تغيّرت الكمية بلوحة المفاتيح.');
      else emit('ready', 'وصل المؤشر إلى حدّ الكمية.', message());
    });
    on(container, 'click', event => {
      const button = event.target.closest('[data-op-value]');
      if (!button) return;
      const before = quantity;
      quantity = clamp(quantity + Number(button.dataset.opValue), 0, 40);
      paint();
      if (quantity !== before) emit('done', message(), 'هذه معاينة لكمية الشراء.');
      else emit('ready', 'وصل المؤشر إلى حدّ الكمية.', message());
    });
    paint();
  }

  function sortDemo() {
    const tasks = {
      prepare: { title: 'تجهيز الطلبات', detail: 'الطلبات تنتظر التجهيز', symbol: '01', color: 'green' },
      stock: { title: 'تعويض المخزون', detail: 'تجهيز المواد لفترة العمل', symbol: '02', color: 'orange' },
      display: { title: 'ترتيب الواجهة', detail: 'تحسين عرض البضاعة', symbol: '03', color: 'blue' },
      clean: { title: 'تنظيف المحل', detail: 'إعداد المكان لليوم التالي', symbol: '04', color: 'sand' }
    };
    let order = Object.keys(tasks);
    function render() {
      const controls = rememberControls();
      container.innerHTML = `<div class="op-demo op-sort-demo"><div class="op-section-heading"><div><span class="op-eyebrow">قائمة التنفيذ</span><h3>أيّ مهمة تبدأ أولًا؟</h3></div><span class="op-soft-pill">${number(4)} مهام</span></div><div class="op-sort-list" role="list" aria-label="ترتيب المهام">${order.map((key, index) => `<div class="op-task-row" role="listitem" data-task="${key}"><span class="op-task-number">${number(index + 1)}</span><button type="button" class="op-task-grab" data-op-drag-task="${key}" aria-label="سحب ${tasks[key].title}"><span class="op-task-symbol op-${tasks[key].color}">${tasks[key].symbol}</span><span class="op-task-copy"><strong>${tasks[key].title}</strong><small>${tasks[key].detail}</small></span><span class="op-grip">${grip}</span></button><div class="op-task-arrows"><button type="button" data-op-reorder="-1" data-key="${key}" aria-label="رفع ${tasks[key].title}" ${index === 0 ? 'disabled' : ''}>${arrow(true)}</button><button type="button" data-op-reorder="1" data-key="${key}" aria-label="خفض ${tasks[key].title}" ${index === order.length - 1 ? 'disabled' : ''}>${arrow(false)}</button></div></div>`).join('')}<span class="op-insertion-line" hidden></span></div><div class="op-sort-footer"><span class="op-order-line"></span>التنفيذ يبدأ من الأعلى إلى الأسفل</div><details class="op-access"><summary>التحكم دون سحب</summary><p>استخدم زري الرفع والخفض بجانب كل مهمة لتغيير ترتيبها. لإلغاء السحب اضغط Escape.</p></details></div>`;
      restoreControls(controls);
    }
    function reorder(key, delta) {
      const before = order.indexOf(key);
      const after = clamp(before + delta, 0, order.length - 1);
      if (before === after) return;
      order.splice(before, 1); order.splice(after, 0, key); render();
      emit('done', `أصبحت «${tasks[key].title}» في المرتبة ${number(after + 1)}.`, 'تغيّر ترتيب التنفيذ الفعلي في القائمة.');
    }
    on(container, 'click', event => {
      const button = event.target.closest('[data-op-reorder]');
      if (button) reorder(button.dataset.key, Number(button.dataset.opReorder));
    });
    on(container, 'pointerdown', event => {
      const button = event.target.closest('[data-op-drag-task]');
      if (!button || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const key = button.dataset.opDragTask;
      const source = button.closest('.op-task-row');
      const list = container.querySelector('.op-sort-list');
      const line = container.querySelector('.op-insertion-line');
      const remaining = order.filter(item => item !== key);
      const ghost = ghostFor(source, event);
      let nextIndex = order.indexOf(key);
      const cleanup = () => { ghost.remove(); line.hidden = true; list.classList.remove('op-list-outside'); };
      const update = current => {
        ghost.move(current);
        const r = list.getBoundingClientRect();
        const valid = inside(current, r);
        list.classList.toggle('op-list-outside', !valid);
        line.hidden = !valid;
        if (!valid) { emit('live', 'أفلت داخل قائمة المهام.', 'الإفلات خارج القائمة يحفظ الترتيب السابق.'); return; }
        const rows = remaining.map(item => container.querySelector(`[data-task="${item}"]`));
        nextIndex = rows.filter(row => current.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2).length;
        const target = rows[nextIndex];
        const top = target ? target.getBoundingClientRect().top - r.top - 5 : rows.at(-1).getBoundingClientRect().bottom - r.top + 5;
        line.style.top = `${top}px`;
        emit('live', `موضع «${tasks[key].title}»: المرتبة ${number(nextIndex + 1)}.`, 'أفلت لتثبيت الأولوية الجديدة.');
      };
      begin(event, {
        move: update,
        end: current => {
          update(current);
          const moved = Math.hypot(current.clientX - event.clientX, current.clientY - event.clientY) > 5;
          const valid = inside(current, list.getBoundingClientRect());
          cleanup();
          if (!moved) { emit('ready', 'اسحب المهمة لأعلى أو لأسفل.'); return; }
          if (!valid) { emit('fail', 'لم يتغيّر الترتيب.', 'أفلت المهمة داخل قائمة التنفيذ.'); return; }
          const next = [...remaining]; next.splice(nextIndex, 0, key);
          if (next.join('|') === order.join('|')) { emit('ready', 'المهمة بقيت في المرتبة نفسها.'); return; }
          order = next; render();
          emit('done', `أصبحت «${tasks[key].title}» في المرتبة ${number(nextIndex + 1)}.`, 'تغيّرت أرقام المهام وترتيب التنفيذ.');
        },
        cancel: silent => { cleanup(); if (!silent) emit('ready', 'أُلغي السحب؛ بقي ترتيب المهام كما كان.'); }
      });
    });
    render();
  }

  function transferDemo() {
    let inventory = ['A', 'B', 'C'];
    let shelf = [];
    const capacity = 2;
    const box = (key, origin) => `<button type="button" class="op-box" data-op-box="${key}" data-origin="${origin}" aria-label="سحب الصندوق ${key} من ${origin === 'inventory' ? 'المخزون' : 'العرض'}">${boxArt()}<span>صندوق ${key}</span><i>${grip}</i></button>`;
    function render() {
      const controls = rememberControls();
      container.innerHTML = `<div class="op-demo op-transfer-demo"><div class="op-section-heading"><div><span class="op-eyebrow">البضاعة تتحرّك معك</span><h3>من المخزون إلى العرض</h3></div><span class="op-soft-pill">الإجمالي ${number(3)}</span></div><div class="op-transfer-layout"><section class="op-transfer-panel op-inventory" data-op-bin="inventory" aria-label="المخزون"><div class="op-bin-heading"><h4>المخزون</h4><span>${number(inventory.length)} صناديق</span></div><div class="op-bin-content">${inventory.map(key => box(key,'inventory')).join('')}${inventory.length === 0 ? '<span class="op-empty">المخزون فارغ</span>' : ''}</div><p class="op-zone-note">اسحب صندوقًا إلى الرف</p></section><span class="op-transfer-arrow" aria-hidden="true">←</span><section class="op-transfer-panel op-shelf" data-op-bin="shelf" aria-label="رف العرض"><div class="op-bin-heading"><h4>رف العرض</h4><span>${number(shelf.length)} / ${number(capacity)}</span></div><div class="op-bin-content">${Array.from({length:capacity}, (_,i) => shelf[i] ? box(shelf[i],'shelf') : '<span class="op-shelf-slot"><span>+</span><small>مكان فارغ</small></span>').join('')}</div><div class="op-shelf-plank"></div><p class="op-zone-note">${shelf.length === capacity ? 'الرف ممتلئ · أعد صندوقًا للمخزون لتوفير مساحة' : 'أفلت هنا · السعة صندوقان'}</p></section></div><div class="op-conservation"><span class="op-live-dot"></span><span>المخزون ${number(inventory.length)} + العرض ${number(shelf.length)} = ${number(3)} صناديق</span></div><details class="op-access"><summary>التحكم دون سحب</summary><div class="op-access-row"><button type="button" data-op-transfer="shelf">انقل صندوقًا إلى العرض</button><button type="button" data-op-transfer="inventory">أعد صندوقًا للمخزون</button></div></details></div>`;
      restoreControls(controls);
    }
    function transfer(key, target) {
      const origin = inventory.includes(key) ? 'inventory' : 'shelf';
      if (origin === target) { emit('ready', 'الصندوق بقي في مكانه.'); return; }
      if (target === 'shelf' && shelf.length >= capacity) { emit('fail', 'رف العرض ممتلئ.', 'أعد صندوقًا إلى المخزون أولًا. لم تتغيّر الكميات.'); return; }
      if (target === 'shelf') { inventory = inventory.filter(item => item !== key); shelf.push(key); }
      else { shelf = shelf.filter(item => item !== key); inventory.push(key); inventory.sort(); }
      render();
      emit('done', target === 'shelf' ? 'نُقل صندوق إلى رف العرض.' : 'أُعيد صندوق إلى المخزون.', `المخزون: ${number(inventory.length)} · العرض: ${number(shelf.length)} · الإجمالي: ${number(3)}`);
    }
    on(container, 'click', event => {
      const button = event.target.closest('[data-op-transfer]');
      if (!button) return;
      const target = button.dataset.opTransfer;
      const key = (target === 'shelf' ? inventory : shelf)[0];
      if (!key) { emit('fail', target === 'shelf' ? 'لا يوجد صندوق في المخزون.' : 'رف العرض فارغ.', 'لم تتغيّر الكميات.'); return; }
      transfer(key, target);
    });
    on(container, 'pointerdown', event => {
      const source = event.target.closest('[data-op-box]');
      if (!source || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const key = source.dataset.opBox;
      const origin = source.dataset.origin;
      const ghost = ghostFor(source, event);
      const zones = [...container.querySelectorAll('[data-op-bin]')];
      let moved = false;
      const targetAt = current => zones.find(zone => inside(current, zone.getBoundingClientRect()));
      const clear = () => zones.forEach(zone => zone.classList.remove('op-zone-valid','op-zone-invalid'));
      const cleanup = () => { ghost.remove(); clear(); };
      begin(event, {
        move: current => {
          ghost.move(current); clear();
          if (Math.hypot(current.clientX - event.clientX,current.clientY - event.clientY) > 5) moved = true;
          const zone = targetAt(current);
          if (!zone) { emit('live', 'اختر المخزون أو رف العرض.', 'الإفلات خارج المنطقتين يعيد الصندوق إلى مكانه.'); return; }
          const target = zone.dataset.opBin;
          const valid = target !== 'shelf' || origin === 'shelf' || shelf.length < capacity;
          zone.classList.add(valid ? 'op-zone-valid' : 'op-zone-invalid');
          emit('live', valid ? `أفلت في ${target === 'shelf' ? 'رف العرض' : 'المخزون'}.` : 'رف العرض ممتلئ.', valid ? 'ستتحدّث الكميتان عند الإفلات.' : 'لا توجد خانة متاحة لهذا الصندوق.');
        },
        end: current => {
          const zone = targetAt(current); cleanup();
          if (!moved) { emit('ready', 'اسحب الصندوق إلى رف العرض.'); return; }
          if (!zone) { emit('fail', 'عاد الصندوق إلى مكانه.', 'أفلت داخل المخزون أو رف العرض.'); return; }
          transfer(key, zone.dataset.opBin);
        },
        cancel: silent => { cleanup(); if (!silent) emit('ready', 'أُلغي النقل؛ بقيت الكميات كما كانت.'); }
      });
    });
    render();
  }

  function assignDemo() {
    let assignment = 'pool';
    const worker = () => `<button type="button" class="op-worker" data-op-worker aria-label="سحب بطاقة سالم إلى محل">${avatar}<span class="op-worker-copy"><strong>سالم</strong><small>${assignment === 'pool' ? 'متاح للعمل' : 'يعمل في محل الساحة'}</small></span><span class="op-grip">${grip}</span></button>`;
    function render() {
      const controls = rememberControls();
      container.innerHTML = `<div class="op-demo op-assign-demo"><div class="op-section-heading"><div><span class="op-eyebrow">حركة تُنشئ تكليفًا</span><h3>اختر مكان عمل سالم</h3></div><span class="op-soft-pill">${assignment === 'pool' ? 'عامل متاح' : 'تم التكليف'}</span></div><div class="op-worker-pool" data-op-shop="pool"><span class="op-pool-label">دون تكليف</span>${assignment === 'pool' ? worker() : '<span class="op-pool-empty">أعد بطاقة سالم هنا لإلغاء تكليفه</span>'}</div><div class="op-store-grid"><section class="op-store op-store-available" data-op-shop="square" aria-label="محل الساحة"><div class="op-store-header"><h4>محل الساحة</h4><span class="op-capacity ${assignment === 'square' ? 'op-capacity-full' : ''}">${number(assignment === 'square' ? 2 : 1)} / ${number(2)} عامل</span></div>${shopArt()}<p>${assignment === 'square' ? 'سالم ضمن فريق المحل' : 'توجد وظيفة متاحة'}</p><div class="op-store-worker-slot">${assignment === 'square' ? worker() : '<span class="op-drop-hint">+ أفلت سالم هنا</span>'}</div></section><section class="op-store op-store-full" data-op-shop="market" aria-label="محل السوق مكتمل"><div class="op-store-header"><h4>محل السوق</h4><span class="op-capacity op-capacity-full">${number(2)} / ${number(2)} عامل</span></div>${shopArt('#98795e')}<p>الفريق مكتمل</p><div class="op-store-worker-slot"><span class="op-full-hint"><span>×</span> لا يوجد شاغر</span></div></section></div><div class="op-assignment-status"><span class="op-live-dot"></span><span>التكليف الحالي: <b>${assignment === 'square' ? 'محل الساحة' : 'دون تكليف'}</b></span></div><details class="op-access"><summary>التحكم دون سحب</summary><div class="op-access-row"><button type="button" data-op-assign="square">تكليف في محل الساحة</button><button type="button" data-op-assign="market">جرّب المحل المكتمل</button><button type="button" data-op-assign="pool">إلغاء التكليف</button></div></details></div>`;
      restoreControls(controls);
    }
    function assign(target) {
      if (target === 'market') { emit('fail', 'محل السوق لا يستقبل عاملًا إضافيًا.', `الفريق مكتمل. بقي تكليف سالم ${assignment === 'square' ? 'في محل الساحة' : 'دون تغيير'}.`); return; }
      if (target === assignment) { emit('ready', target === 'pool' ? 'سالم متاح للعمل.' : 'سالم يعمل في هذا المحل بالفعل.'); return; }
      assignment = target; render();
      emit('done', target === 'square' ? 'تم تكليف سالم بالعمل في محل الساحة.' : 'أُلغي تكليف سالم وأصبح متاحًا.', target === 'square' ? 'انتقلت البطاقة وأصبح عدد العاملين ٢ من ٢.' : 'عاد عدد العاملين في محل الساحة إلى ١ من ٢.');
    }
    on(container, 'click', event => {
      const button = event.target.closest('[data-op-assign]');
      if (button) assign(button.dataset.opAssign);
    });
    on(container, 'pointerdown', event => {
      const source = event.target.closest('[data-op-worker]');
      if (!source || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const ghost = ghostFor(source, event);
      const zones = [...container.querySelectorAll('[data-op-shop]')];
      let moved = false;
      const targetAt = current => zones.find(zone => inside(current, zone.getBoundingClientRect()));
      const clear = () => zones.forEach(zone => zone.classList.remove('op-zone-valid','op-zone-invalid'));
      const cleanup = () => { ghost.remove(); clear(); };
      begin(event, {
        move: current => {
          ghost.move(current); clear();
          if (Math.hypot(current.clientX - event.clientX,current.clientY - event.clientY) > 5) moved = true;
          const zone = targetAt(current);
          if (!zone) { emit('live', 'اختر محلًا أو أعد سالم إلى «دون تكليف».', 'ستبقى مهمته الحالية إن أفلت خارج الأهداف.'); return; }
          const target = zone.dataset.opShop;
          zone.classList.add(target === 'market' ? 'op-zone-invalid' : 'op-zone-valid');
          emit('live', target === 'market' ? 'المحل مكتمل: لا يوجد شاغر.' : target === 'pool' ? 'أفلت ليصبح سالم دون تكليف.' : 'أفلت لتكليف سالم في محل الساحة.', target === 'market' ? 'الإفلات هنا لن يغيّر تكليف سالم.' : 'سيُعتمد القرار عند الإفلات.');
        },
        end: current => {
          const zone = targetAt(current); cleanup();
          if (!moved) { emit('ready', 'اسحب بطاقة سالم إلى محل يحتاج عاملًا.'); return; }
          if (!zone) { emit('fail', 'بقي تكليف سالم كما كان.', 'أفلت بطاقة العامل فوق وجهة واضحة.'); return; }
          assign(zone.dataset.opShop);
        },
        cancel: silent => { cleanup(); if (!silent) emit('ready', 'أُلغي السحب؛ بقي تكليف سالم كما كان.'); }
      });
    });
    render();
  }

  if (id === 'value') valueDemo();
  else if (id === 'sort') sortDemo();
  else if (id === 'transfer') transferDemo();
  else if (id === 'assign') assignDemo();
  else throw new Error(`Unknown operations demo: ${id}`);

  return () => { destroyed = true; cancel(true); controller.abort(); container.classList.remove('op-is-dragging'); };
}
