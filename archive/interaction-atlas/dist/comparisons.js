import {mountSpatialTime} from './spatial-time.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const arabic = value => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value);
let mountNumber = 0;

function node(tag, attributes = {}, text = '') {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  if (text) element.textContent = text;
  return element;
}

function point(svg, event) {
  const value = svg.createSVGPoint();
  value.x = event.clientX;
  value.y = event.clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? value.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
}

function storefront(renovated) {
  const wall = renovated ? '#f0e1c6' : '#d6d2c6';
  const dark = renovated ? '#166353' : '#777c6f';
  const pale = renovated ? '#f6eddb' : '#e2ded1';
  const glass = renovated ? '#98b5a0' : '#b4b9a8';
  const wood = renovated ? '#bd885c' : '#aaa08a';
  return `<g class="cmp-storefront">
    <rect x="247" y="67" width="406" height="212" rx="9" fill="#536747" opacity=".1"/>
    <rect x="255" y="58" width="390" height="212" rx="8" fill="${wall}" stroke="${renovated ? '#c6b596' : '#b9b8a7'}" stroke-width="2"/>
    <rect x="246" y="51" width="408" height="16" rx="5" fill="${pale}"/>
    <rect x="290" y="76" width="320" height="39" rx="7" fill="${dark}"/>
    <text x="450" y="103" class="cmp-store-name" fill="${pale}">بليله</text>
    <rect x="283" y="150" width="178" height="95" rx="3" fill="${glass}" stroke="${pale}" stroke-width="7"/>
    <path d="M341 151v94m60-94v94M285 204h174" stroke="${pale}" stroke-width="5"/>
    <path d="m294 158 32 40m30-40 30 40m30-40 30 40" stroke="#fff" opacity="${renovated ? '.25' : '.08'}" stroke-width="6"/>
    <rect x="499" y="145" width="92" height="115" rx="4" fill="${wood}"/>
    <rect x="509" y="156" width="72" height="71" rx="3" fill="${glass}"/>
    <path d="M545 156v71" stroke="${pale}" stroke-width="4"/>
    <circle cx="575" cy="241" r="3" fill="${pale}"/>
    <path d="M246 119h408l-10 37H256Z" fill="${pale}" stroke="${renovated ? '#b4b58e' : '#aaa99b'}"/>
    ${Array.from({ length: 7 }, (_, index) => `<path d="M${246 + index * 58} 119h29l${index < 3 ? 1 : -1} 37h-28Z" fill="${dark}"/>`).join('')}
    <path d="M256 155h388" stroke="${dark}" stroke-width="4"/>
    <rect x="269" y="257" width="363" height="13" rx="3" fill="${pale}"/>
    <path d="M270 273h362" stroke="${renovated ? '#b9a17d' : '#b2af9d'}" stroke-width="6" stroke-linecap="round"/>
    <g fill="${renovated ? '#d2a16b' : '#aaa48c'}"><ellipse cx="315" cy="232" rx="17" ry="7"/><ellipse cx="373" cy="232" rx="17" ry="7"/><ellipse cx="430" cy="232" rx="17" ry="7"/></g>
    ${[224, 677].map(x => `<g transform="translate(${x} 235)"><ellipse cy="30" rx="23" ry="6" fill="#54684c" opacity=".12"/><path d="M-17 0h34l-5 29H-12Z" fill="${renovated ? '#c69168' : '#b1aa91'}"/><ellipse cx="-9" cy="-12" rx="11" ry="23" transform="rotate(-26)" fill="${renovated ? '#779a67' : '#a3a58d'}"/><ellipse cx="8" cy="-13" rx="11" ry="24" transform="rotate(27)" fill="${renovated ? '#4f8265' : '#909b80'}"/><ellipse cy="-24" rx="10" ry="21" fill="${renovated ? '#92ad79' : '#a9ae95'}"/></g>`).join('')}
    ${renovated ? '<path d="M277 169v72m192-72v72" stroke="#f8f1d6" stroke-width="3" opacity=".75"/>' : '<g stroke="#a9a794" fill="none" stroke-width="2" opacity=".65"><path d="m269 84 8 13-6 18 11 13M619 170l-7 19 8 14-5 16M290 253l23-4 15 4"/></g>'}
  </g>`;
}

function surroundings() {
  return `<rect x="55" y="22" width="790" height="268" rx="17" fill="#e8eddf"/>
    <path d="M55 251h790v39H55Z" fill="#dcdcca"/><path d="M55 277h790" stroke="#c2c6b3" stroke-width="2"/>
    <path d="M86 251V115h112v136M710 251V95h108v156" fill="#d8dfcc"/>
    <path d="M98 137h28v33H98Zm43 0h28v33h-28Zm586-18h29v35h-29Zm44 0h29v35h-29Z" fill="#c4d0b9"/>
    <path d="M97 198h73m556-4h75" stroke="#c4cfb7" stroke-width="7"/>
    <path d="M55 289h790" stroke="#c6ccb9" stroke-width="2"/>`;
}

function person(index, x, y) {
  const shirts = ['#c68757', '#406e5d', '#788d6b', '#b79b6a', '#6c8f91', '#ac745d', '#567f69', '#897d9a'];
  return `<g data-cmp-person="${index}" transform="translate(${x} ${y})"><ellipse cy="22" rx="12" ry="4" fill="#213e30" opacity=".14"/><path d="M-8 2h16l2 16h-20Z" fill="${shirts[index]}"/><circle cy="-7" r="8" fill="#d6a279"/><path d="M-8-9q0-11 9-8 8 2 6 10l-5-4-10 3Z" fill="#485044"/><path d="M-5 17v9m10-9v9" stroke="#526451" stroke-width="4" stroke-linecap="round"/></g>`;
}

function mix(a, b, ratio) {
  const parse = value => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16));
  return '#' + parse(a).map((channel, index) => Math.round(channel + (parse(b)[index] - channel) * ratio).toString(16).padStart(2, '0')).join('');
}

function revealMode(uid) {
  const left = 55, width = 790;
  return {
    min: 0, max: 100, step: 1, initial: 50,
    title: 'المشهد ثابت؛ أنت تكشف الجزء الآخر', control: 'موضع الفاصل',
    signal: ['موضع الفاصل', 'المساحة المكشوفة من الصورة'],
    label: 'مقارنة واجهة المحل قبل التجديد وبعده',
    markup: `<defs><clipPath id="${uid}-frame"><rect x="55" y="22" width="790" height="268" rx="17"/></clipPath><clipPath id="${uid}-reveal"><rect data-cmp-reveal-clip x="450" y="22" width="395" height="268"/></clipPath></defs>
      <g clip-path="url(#${uid}-frame)"><g data-cmp-before>${surroundings()}${storefront(false)}</g><g data-cmp-after clip-path="url(#${uid}-reveal)">${surroundings()}${storefront(true)}</g></g>
      <g class="cmp-scene-label"><rect x="74" y="35" width="116" height="30" rx="15" fill="#faf8f3"/><text x="132" y="55">قبل التجديد</text><rect x="707" y="35" width="120" height="30" rx="15" fill="#166353"/><text x="767" y="55" fill="#fff">بعد التجديد</text></g>
      <g data-cmp-divider><rect x="-35" y="22" width="70" height="268" fill="transparent"/><path d="M0 23V289" stroke="#fffdf7" stroke-width="6"/><path d="M0 23V289" stroke="#166353" stroke-width="2"/><circle cy="155" r="24" fill="#166353" stroke="#faf8f3" stroke-width="4"/><path d="m-6 148-7 7 7 7m12-14 7 7-7 7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>
      <text x="450" y="318" class="cmp-svg-note">اسحب الفاصل؛ تفاصيل المحل تبقى في مواضعها</text>`,
    normalize: value => Math.round(clamp(value, 0, 100)),
    hit: p => p.x >= 45 && p.x <= 855 && p.y >= 20 && p.y <= 291,
    fromPoint: p => (p.x - left) / width * 100,
    pointer: value => ({ x: left + width * value / 100, y: 155 }),
    output: value => `${arabic(value)}٪`,
    render(root, value) {
      const x = left + width * value / 100;
      const clip = root.querySelector('[data-cmp-reveal-clip]');
      clip.setAttribute('x', x); clip.setAttribute('width', left + width - x);
      root.querySelector('[data-cmp-divider]').setAttribute('transform', `translate(${x} 0)`);
      root.querySelector('[data-cmp-summary]').textContent = `${arabic(100 - value)}٪ من التجديد ظاهر`;
    },
    message: value => `المقارنة الآن: ${arabic(value)}٪ قبل التجديد، و${arabic(100 - value)}٪ بعده.`,
    detail: 'نقرأ مكان الفاصل؛ المشهدان متطابقان في الموضع ولا تتحرّك عناصرهما.',
    demo: [20, 88, 42]
  };
}

function timelineMode(uid) {
  const customerCounts = [1, 2, 3, 4, 6, 7, 5, 4, 6, 8, 7, 5, 2];
  const sales = [0, 18, 42, 78, 132, 198, 246, 282, 330, 396, 450, 480, 498];
  const snapshot = minute => {
    const hour = (minute - 480) / 60, index = Math.floor(hour), fraction = hour - index;
    return { customers: customerCounts[index], sales: Math.round(sales[index] + ((sales[index + 1] ?? sales[index]) - sales[index]) * fraction) };
  };
  const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return {
    min: 480, max: 1200, step: 15, initial: 720,
    title: 'لقطات من يوم المحل · بيانات افتراضية', control: 'وقت اللقطة',
    signal: ['موضع مؤشر الوقت', 'حالة المحل في تلك اللحظة'],
    label: 'شريط وقت يغيّر الإضاءة والزبائن والمبيعات الافتراضية',
    markup: `<defs><clipPath id="${uid}-day"><rect x="60" y="16" width="780" height="225" rx="16"/></clipPath></defs>
      <g clip-path="url(#${uid}-day)"><rect data-cmp-sky x="60" y="16" width="780" height="225" fill="#e8eee4"/>
        <path d="M60 207h780v34H60Z" fill="#d9ddcb"/><path d="M60 227h780" stroke="#bcc8b4" stroke-width="2"/>
        <g opacity=".65" fill="#c5d2ba"><path d="M88 205V95h130v110m461 0V80h137v125"/><path d="M110 60h62v35h-62m603-18h73v20h-73"/></g>
        <circle data-cmp-sun cx="150" cy="65" r="16" fill="#efcc8d"/>
        <g data-cmp-moon opacity="0"><circle cx="738" cy="54" r="14" fill="#ede9ce"/><circle cx="744" cy="48" r="13" fill="#223a4b"/></g>
        <g transform="translate(90 -25) scale(.8)">${storefront(true)}</g>
        <rect data-cmp-night x="60" y="16" width="780" height="225" fill="#102a3d" opacity="0"/>
        <g data-cmp-lamps opacity="0"><rect x="316" y="95" width="143" height="76" rx="3" fill="#ffe3a2" opacity=".57"/><rect x="497" y="100" width="58" height="57" rx="2" fill="#ffe3a2" opacity=".5"/><ellipse cx="374" cy="199" rx="85" ry="20" fill="#ffdc8a" opacity=".13"/><ellipse cx="526" cy="199" rx="52" ry="17" fill="#ffdc8a" opacity=".13"/></g>
        <g data-cmp-customers>${[[305,195],[350,204],[395,193],[438,207],[483,196],[529,204],[572,192],[614,205]].map((p, index) => person(index, ...p)).join('')}</g>
      </g>
      <path d="M100 285H800" stroke="#d7dfce" stroke-width="8" stroke-linecap="round"/>
      <path data-cmp-time-fill d="M100 285H333" stroke="#709e7d" stroke-width="8" stroke-linecap="round"/>
      ${[8, 10, 12, 14, 16, 18, 20].map(hour => { const x = 100 + (hour - 8) / 12 * 700; return `<path d="M${x} 275v20" stroke="#9aaf91" stroke-width="2"/><text x="${x}" y="315" class="cmp-time-tick">${String(hour).padStart(2, '0')}:00</text>`; }).join('')}
      <g data-cmp-playhead><rect x="-36" y="249" width="72" height="66" fill="transparent"/><path d="M0 259v40" stroke="#a36742" stroke-width="3"/><path d="m-12 252 12 13 12-13Z" fill="#d38352"/><circle cy="285" r="13" fill="#d38352" stroke="#fffdf6" stroke-width="3"/></g>`,
    normalize: value => clamp(Math.round(value / 15) * 15, 480, 1200),
    hit: p => p.x >= 70 && p.x <= 830 && p.y >= 246 && p.y <= 325,
    fromPoint: p => 480 + (p.x - 100) / 700 * 720,
    pointer: value => ({ x: 100 + (value - 480) / 720 * 700, y: 285 }),
    output: clock,
    render(root, value) {
      const data = snapshot(value), dusk = clamp((value - 960) / 240, 0, 1);
      const x = 100 + (value - 480) / 720 * 700;
      root.querySelector('[data-cmp-playhead]').setAttribute('transform', `translate(${x} 0)`);
      root.querySelector('[data-cmp-time-fill]').setAttribute('d', `M100 285H${x}`);
      root.querySelector('[data-cmp-sky]').setAttribute('fill', mix('#e8eee4', '#223a4b', dusk));
      root.querySelector('[data-cmp-night]').setAttribute('opacity', dusk * .45);
      root.querySelector('[data-cmp-lamps]').setAttribute('opacity', dusk);
      const sun = root.querySelector('[data-cmp-sun]');
      sun.setAttribute('cx', 150 + (value - 480) / 720 * 590);
      sun.setAttribute('cy', 65 - Math.sin((value - 480) / 720 * Math.PI) * 29);
      sun.setAttribute('opacity', clamp((1110 - value) / 90, 0, 1));
      root.querySelector('[data-cmp-moon]').setAttribute('opacity', clamp((value - 1080) / 120, 0, 1));
      root.querySelectorAll('[data-cmp-person]').forEach((element, index) => element.setAttribute('visibility', index < data.customers ? 'visible' : 'hidden'));
      root.querySelector('[data-cmp-summary]').textContent = `الزبائن: ${arabic(data.customers)} · مبيعات افتراضية ${arabic(data.sales)} ر.س`;
      root.dataset.cmpTime = String(value);
      root.dataset.cmpCustomers = String(data.customers);
      root.dataset.cmpSales = String(data.sales);
    },
    message: value => { const data = snapshot(value); return `اللقطة ${clock(value)}: عدد الزبائن ${arabic(data.customers)}، ومبيعات افتراضية ${arabic(data.sales)} ر.س.`; },
    detail: 'العودة إلى وقت سابق تعيد اللقطة نفسها؛ الأرقام توضيحية ولا تمثل مبيعات فعلية.',
    demo: [480, 1200, 840]
  };
}

function repeatMode() {
  const anchor = 125, segmentWidth = 50;
  return {
    min: 1, max: 12, step: 1, initial: 4,
    title: 'امتداد واحد يولّد قطعًا متكرّرة', control: 'طول السياج',
    signal: ['المسافة من نقطة البداية', 'عدد قطع السياج'],
    label: 'اسحب نهاية السياج لتوليد قطع إضافية من نقطة ثابتة',
    markup: `<rect x="60" y="24" width="780" height="260" rx="17" fill="#e7edde"/>
      <path d="M60 225h780v59H60Z" fill="#e1e4d1"/><path d="M85 257H815" stroke="#c2cdb3" stroke-width="2"/>
      ${[180, 300, 420, 540, 660, 780].map(x => `<path d="m${x} 75 4-9 4 9m-8 0 4-4 4 4" fill="none" stroke="#c7d2bb" stroke-width="2"/>`).join('')}
      <path d="M125 184H725" stroke="#b7c7a9" stroke-width="2" stroke-dasharray="5 7"/>
      ${Array.from({ length: 13 }, (_, index) => `<path d="M${anchor + index * segmentWidth} 245v12" stroke="#b0c2a0" stroke-width="2"/>`).join('')}
      <g data-cmp-segments></g>
      <g data-cmp-anchor><path d="M117 113 125 103 133 113V234H117Z" fill="#166353"/><circle cx="125" cy="104" r="9" fill="#faf8f3" stroke="#166353" stroke-width="3"/><path d="M125 81V66" stroke="#85a47d" stroke-width="2"/><text x="125" y="52" class="cmp-anchor-label">بداية ثابتة</text></g>
      <g data-cmp-fence-end><path d="M-7 113 0 103 7 113V234H-7Z" fill="#966943"/><rect x="-34" y="101" width="68" height="140" fill="transparent"/><circle cy="184" r="23" fill="#d38352" stroke="#faf8f3" stroke-width="4"/><path d="m-6 177-7 7 7 7m12-14 7 7-7 7" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></g>
      <path data-cmp-length-line d="M125 275H325" stroke="#71976a" stroke-width="2"/>
      <text x="450" y="315" class="cmp-svg-note">كل مسافة إضافية تضيف قطعة؛ الرجوع يزيل القطع الزائدة</text>`,
    normalize: value => Math.round(clamp(value, 1, 12)),
    hit: p => p.x >= 95 && p.x <= 790 && p.y >= 93 && p.y <= 260,
    fromPoint: p => (p.x - anchor) / segmentWidth,
    pointer: value => ({ x: anchor + value * segmentWidth, y: 184 }),
    output: value => `${arabic(value)} قطع`,
    render(root, value) {
      const group = root.querySelector('[data-cmp-segments]');
      if (group.childElementCount !== value) {
        group.replaceChildren();
        for (let index = 0; index < value; index++) {
          const segment = node('g', { 'data-cmp-segment': index + 1, transform: `translate(${anchor + index * segmentWidth} 0)` });
          segment.innerHTML = `<path d="M0 147h50v12H0Zm0 48h50v12H0Z" fill="#b58b5d"/><path d="M1 154h48m-48 48h48" stroke="#947047" opacity=".4"/>
            ${[5, 17, 29, 41].map(x => `<path d="M${x} 130l4-6 4 6v100h-8Z" fill="${index % 2 ? '#d8b688' : '#dfbf93'}" stroke="#b38c5d" stroke-width=".8"/>`).join('')}
            <path d="M-4 116 0 111 4 116v119h-8Z" fill="#b58a58"/><circle cx="0" cy="152" r="1.4" fill="#765d3c"/><circle cx="0" cy="201" r="1.4" fill="#765d3c"/>`;
          group.append(segment);
        }
      }
      const end = anchor + value * segmentWidth;
      root.querySelector('[data-cmp-fence-end]').setAttribute('transform', `translate(${end} 0)`);
      root.querySelector('[data-cmp-length-line]').setAttribute('d', `M125 268v9m0-4H${end}m0-5v9`);
      root.querySelector('[data-cmp-summary]').textContent = `${arabic(value)} قطع متصلة · نقطة البداية ثابتة`;
      root.dataset.cmpSegments = String(value);
    },
    message: value => `امتدّ السياج إلى ${arabic(value)} قطع متصلة.`,
    detail: 'نقرأ طول الامتداد ونولّد عددًا مناسبًا من القطع؛ نقطة البداية تبقى ثابتة.',
    demo: [2, 11, 6]
  };
}

function mountSingleComparison(id, container, api) {
  const uid = `cmp-${++mountNumber}`;
  const factories = { reveal: revealMode, timeline: timelineMode, repeat: repeatMode };
  if (!factories[id]) throw new Error(`Unknown comparison demo: ${id}`);
  const mode = factories[id](uid);
  const controller = new AbortController();
  let destroyed = false, state = mode.initial, gesture = null, rangeGesture = null, rangeCancelled = false, animation = null, frameId = 0, lastFeedback = '';
  const on = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: controller.signal });
  container.innerHTML = `<section class="cmp-root cmp-${id}" data-cmp-mode="${id}">
    <div class="cmp-top"><span class="cmp-caption">${mode.title}</span><output class="cmp-summary" data-cmp-summary></output></div>
    <svg class="cmp-scene" viewBox="0 0 900 330" role="group" aria-label="${mode.label}">${mode.markup}
      <g class="cmp-demo-pointer" data-cmp-pointer visibility="hidden" pointer-events="none"><circle r="17" fill="#d38352" opacity=".17"/><circle r="8" fill="#faf8f3" stroke="#d38352" stroke-width="2"/><path d="M0 0v34l9-9 8 15 7-4-8-14 13-2Z" fill="#fffdf8" stroke="#1d322f" stroke-width="2.3" stroke-linejoin="round"/></g>
    </svg>
    <div class="cmp-controls"><label for="${uid}-range">${mode.control}</label><input id="${uid}-range" class="cmp-range" data-cmp-slider type="range" min="${mode.min}" max="${mode.max}" step="${mode.step}" value="${state}" aria-label="${mode.control}"/><output class="cmp-value" data-cmp-value for="${uid}-range"></output></div>
    <div class="cmp-signal"><span>نقرأ:</span><strong>${mode.signal[0]}</strong><span class="cmp-signal-arrow" aria-hidden="true">←</span><span>${mode.signal[1]}</span><span class="cmp-auto-label" data-cmp-auto hidden>مثال تلقائي</span></div>
  </section>`;
  const root = container.querySelector('.cmp-root'), svg = root.querySelector('.cmp-scene'), range = root.querySelector('[data-cmp-slider]'), pointer = root.querySelector('[data-cmp-pointer]'), autoLabel = root.querySelector('[data-cmp-auto]');
  function emit(method, message, detail = mode.detail) {
    const signature = `${method}|${message}|${detail}`;
    if (!destroyed && signature !== lastFeedback) { lastFeedback = signature; api[method]?.(message, detail); }
  }
  function setValue(value, phase) {
    state = mode.normalize(value);
    range.value = String(state);
    range.setAttribute('aria-valuetext', mode.output(state));
    root.querySelector('[data-cmp-value]').textContent = mode.output(state);
    root.dataset.cmpValue = String(state);
    mode.render(root, state);
    if (phase) emit(phase, mode.message(state));
  }
  function releaseGesture(cancelled = false, silent = false, event) {
    if (!gesture) return;
    const previous = gesture; gesture = null;
    try { if (svg.hasPointerCapture(previous.id)) svg.releasePointerCapture(previous.id); } catch {}
    root.classList.remove('cmp-dragging');
    if (cancelled) {
      setValue(previous.before);
      if (!silent) emit('ready', 'أُلغي السحب؛ عادت الحالة السابقة.');
    } else {
      if (event) setValue(mode.fromPoint(point(svg, event)));
      emit(state === previous.before ? 'ready' : 'done', state === previous.before ? 'بقيت الحالة كما كانت. جرّب موضعًا آخر.' : mode.message(state));
    }
  }
  function releaseRange(cancelled = false, silent = false) {
    if (!rangeGesture) return;
    const previous = rangeGesture; rangeGesture = null;
    if (cancelled) { rangeCancelled = true; setValue(previous.before); if (!silent) emit('ready', 'أُلغي السحب؛ عادت الحالة السابقة.'); }
    else emit(state === previous.before ? 'ready' : 'done', state === previous.before ? 'بقيت الحالة كما كانت.' : mode.message(state));
  }
  function stopAnimation(restore = false, silent = true) {
    if (!animation) return;
    const previous = animation; animation = null;
    cancelAnimationFrame(frameId); frameId = 0;
    pointer.setAttribute('visibility', 'hidden'); autoLabel.hidden = true; root.classList.remove('cmp-playing');
    if (restore) setValue(previous.before);
    if (!silent) emit('ready', 'توقّف المثال؛ يمكنك تجربة الحركة بنفسك.');
  }
  on(svg, 'pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0 || gesture) return;
    const p = point(svg, event); if (!mode.hit(p)) return;
    event.preventDefault(); stopAnimation(); releaseRange(true, true);
    gesture = { id: event.pointerId, before: state };
    svg.setPointerCapture(event.pointerId); root.classList.add('cmp-dragging');
    setValue(mode.fromPoint(p), 'live');
  });
  on(svg, 'pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    event.preventDefault(); setValue(mode.fromPoint(point(svg, event)), 'live');
  });
  on(svg, 'pointerup', event => { if (gesture?.id === event.pointerId) releaseGesture(false, false, event); });
  on(svg, 'pointercancel', event => { if (gesture?.id === event.pointerId) releaseGesture(true); });
  on(svg, 'lostpointercapture', event => { if (gesture?.id === event.pointerId) releaseGesture(true); });
  on(range, 'pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0) return;
    stopAnimation(); releaseGesture(true, true);
    rangeCancelled = false;
    rangeGesture = { id: event.pointerId, before: state };
  });
  on(range, 'input', () => { if (rangeCancelled) { range.value = String(state); return; } stopAnimation(); setValue(Number(range.value), 'live'); });
  on(range, 'change', () => { if (rangeCancelled) { range.value = String(state); return; } if (!rangeGesture) setValue(Number(range.value), 'done'); });
  on(range, 'keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) { rangeCancelled = false; stopAnimation(); }
  });
  on(window, 'pointerup', event => { if (rangeGesture?.id === event.pointerId) releaseRange(); });
  on(window, 'pointercancel', event => { if (rangeGesture?.id === event.pointerId) releaseRange(true); });
  on(window, 'keydown', event => {
    if (event.key !== 'Escape' || (!gesture && !rangeGesture && !animation)) return;
    event.preventDefault(); releaseGesture(true); releaseRange(true); stopAnimation(true, false);
  });
  on(window, 'blur', () => { releaseGesture(true); releaseRange(true); stopAnimation(true, false); });
  setValue(state);

  function play() {
    if (destroyed) return;
    releaseGesture(true, true); releaseRange(true, true); stopAnimation();
    const before = state, reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animation = { before }; const run = animation;
    const duration = reduced ? 2500 : 3300;
    let began = null, lastStep = -1;
    setValue(mode.demo[0], 'live');
    pointer.setAttribute('visibility', 'visible'); autoLabel.hidden = false;
    autoLabel.textContent = reduced ? 'مثال بخطوات' : 'مثال تلقائي'; root.classList.add('cmp-playing');
    const drawPointer = value => { const p = mode.pointer(value); pointer.setAttribute('transform', `translate(${p.x} ${p.y})`); };
    drawPointer(mode.demo[0]);
    function tick(timestamp) {
      if (destroyed || animation !== run) return;
      if (began === null) began = timestamp;
      const progress = clamp((timestamp - began) / duration, 0, 1);
      let value;
      if (reduced) {
        const step = progress < .4 ? 0 : progress < .8 ? 1 : 2;
        value = mode.demo[step];
        if (step !== lastStep) { setValue(value, 'live'); drawPointer(value); lastStep = step; }
      } else {
        const section = progress <= .62 ? 0 : 1;
        const local = section === 0 ? progress / .62 : (progress - .62) / .38;
        const eased = local * local * (3 - 2 * local);
        value = mode.demo[section] + (mode.demo[section + 1] - mode.demo[section]) * eased;
        setValue(value, 'live'); drawPointer(value);
      }
      if (progress < 1) frameId = requestAnimationFrame(tick);
      else { animation = null; frameId = 0; pointer.setAttribute('visibility', 'hidden'); autoLabel.hidden = true; root.classList.remove('cmp-playing'); setValue(mode.demo[2], 'done'); }
    }
    frameId = requestAnimationFrame(tick);
  }
  return {
    play,
    suspend(){stopAnimation();releaseGesture(true,true);releaseRange(true,true);},
    destroy() {
      if (destroyed) return;
      destroyed = true; stopAnimation(); releaseGesture(true, true); releaseRange(true, true);
      controller.abort(); root.classList.remove('cmp-dragging', 'cmp-playing');
    }
  };
}

// Keep the original fence and its controls intact. The supplementary panel is
// another view of repeat, with a shared record, not a new catalog example.
export function mountComparisons(id,container,api){
  if(id!=='repeat')return mountSingleComparison(id,container,api);
  const uid=`repeat-view-${++mountNumber}`,controller=new AbortController();
  container.innerHTML=`<nav class="st-view-nav" role="tablist" aria-label="عرض تجربة التكرار"><span>داخل هذه التجربة</span><button type="button" role="tab" id="${uid}-f-tab" aria-controls="${uid}-f" aria-selected="true" data-repeat-view="fence">بناء السياج</button><button type="button" role="tab" id="${uid}-c-tab" aria-controls="${uid}-c" aria-selected="false" data-repeat-view="compare">قارن الامتداد بالزمن</button></nav><div class="st-mode-panel" role="tabpanel" id="${uid}-f" aria-labelledby="${uid}-f-tab" data-repeat-panel="fence"></div><div class="st-mode-panel" role="tabpanel" id="${uid}-c" aria-labelledby="${uid}-c-tab" data-repeat-panel="compare" hidden></div>`;
  let active=null,destroyed=false;const modules={},names=['fence','compare'];
  const guard=name=>Object.fromEntries(['ready','live','done','fail'].map(method=>[method,(...args)=>{if(!destroyed&&active===name)api[method]?.(...args);}])) ;
  function choose(name,quiet=false){
    if(destroyed||!names.includes(name)||name===active)return;
    if(active)modules[active]?.suspend?.(true);active=name;
    for(const key of names){container.querySelector(`[data-repeat-view="${key}"]`).setAttribute('aria-selected',String(key===name));container.querySelector(`[data-repeat-panel="${key}"]`).hidden=key!==name;}
    const panel=container.querySelector(`[data-repeat-panel="${name}"]`);
    if(!modules[name])modules[name]=name==='fence'?mountSingleComparison('repeat',panel,guard(name)):mountSpatialTime(panel,guard(name));
    if(!quiet)api.ready?.(name==='fence'?'اسحب نهاية السياج لتغيير عدد القطع.':'اسحب واثبت ثم ارجع في السطح المشترك.',name==='fence'?'العدد يعتمد على الامتداد الأفقي من مرساة ثابتة.':'نفس الموضع والزمن يصلان إلى القاعدتين.');
  }
  container.querySelector('.st-view-nav').addEventListener('click',e=>{const tab=e.target.closest('[data-repeat-view]');if(tab)choose(tab.dataset.repeatView);},{signal:controller.signal});
  choose('fence',true);
  return {play:()=>modules[active]?.play?.(),destroy(){if(destroyed)return;destroyed=true;controller.abort();for(const module of Object.values(modules))module.destroy();}};
}
