const NS = 'http://www.w3.org/2000/svg';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const copy = p => ({ x: p.x, y: p.y });
const point = p => ({ x: clamp(p.x, 0, 100), y: clamp(p.y, 0, 40) });
const fmt = n => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 }).format(n);
const coordinates = p => `س ${fmt(p.x)} · ص ${fmt(p.y)}`;
const round = n => Number(n.toFixed(3));
const attr = (el, values) => { for (const [key, value] of Object.entries(values)) el.setAttribute(key, value); };

// These transformations are shared by dragging, keyboard input and the guided run.
export function modifierPoint(origin, raw, locked) {
  const p = point(raw);
  return { x: p.x, y: locked ? origin.y : p.y };
}
export function magnetReadings(raw, target = { x: 68, y: 20 }, radius = 12) {
  const free = point(raw), distance = Math.hypot(free.x - target.x, free.y - target.y);
  return {
    free,
    grid: { x: Math.round(free.x / 20) * 20, y: Math.round(free.y / 20) * 20 },
    magnet: distance <= radius ? copy(target) : copy(free),
    snapped: distance <= radius,
    distance,
  };
}

function shell(id, container) {
  const modifier = id === 'modifier';
  container.innerHTML = `<section class="cctl-root" data-cctl-mode="${id}">
    <div class="cctl-heading"><strong>${modifier ? 'غيّر القيد واليد ما زالت في مكانها' : 'مدخل واحد · ثلاث قواعد للمكان'}</strong><span class="cctl-badge" data-cctl-status></span></div>
    <p class="cctl-intro">${modifier ? 'اسحب المربع بحرية، ثم اضغط Shift أثناء السحب لتثبيت الارتفاع عند بداية الحركة. اترك المفتاح لتعود إلى الحركة الحرة.' : 'حرّك المقبض إلى الدائرة ثم ابتعد عنها. الشبكة تقرّب إلى مضاعفات ٢٠، والالتقاط يجذب إلى هدف واحد عند مسافة ١٢ أو أقل.'}</p>
    ${modifier ? '' : `<div class="cctl-scenes">${[['free','حر','#27634f'],['grid','شبكة ٢٠','#ad774b'],['magnet','التقاط عند الاقتراب','#507c50']].map(([key,label,color]) => `<article class="cctl-card"><h3>${label}</h3><svg data-cctl-scene="${key}" viewBox="0 0 240 150" aria-label="${label}"></svg><output data-cctl-output="${key}" style="--cctl-output-color:${color}"></output></article>`).join('')}</div>`}
    <div class="cctl-board-heading"><strong>${modifier ? 'البرتقالي: موضع اليد · الأخضر: نتيجة القيد' : 'حرّك هذا المقبض؛ كل المشاهد تقرأ الموضع نفسه'}</strong><span>س: ٠–١٠٠ · ص: ٠–٤٠</span></div>
    <svg class="cctl-board" role="group" aria-label="${modifier ? 'مساحة تجربة المفتاح المساعد' : 'مساحة المدخل المشترك'}" viewBox="0 0 640 300">
      <g data-cctl-background></g>
      <g data-cctl-target></g>
      <line class="cctl-origin-line" data-cctl-axis />
      <line class="cctl-difference" data-cctl-difference />
      <g data-cctl-origin><rect x="-12" y="-12" width="24" height="24" rx="6" fill="none" stroke="#9aa88e" stroke-width="1.5" stroke-dasharray="3 3"/></g>
      <circle class="cctl-raw" data-cctl-raw r="8" />
      <g class="cctl-handle" data-cctl-handle role="button" tabindex="0" aria-label="مقبض السحب؛ الأسهم للتحريك، Enter للاعتماد، Escape للإلغاء">
        <circle r="24" fill="transparent"/>
        <rect class="cctl-handle-body" x="-13" y="-13" width="26" height="26" rx="7"/>
        <path d="M-5-3h10m-10 6h10" stroke="#fffdf5" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>
    <div class="cctl-metrics" data-cctl-metrics></div>
    ${modifier ? '<button type="button" class="cctl-lock" data-cctl-lock aria-pressed="false">تثبيت أفقي — بديل Shift</button><p class="cctl-lock-note">زر التثبيت يبقى مفعّلًا حتى تطفئه. مفتاح Shift يعمل ما دمت تضغطه؛ كلاهما يطبق القيد نفسه.</p>' : ''}
    <p class="cctl-observation" data-cctl-observation></p>
    <div class="cctl-controls"><button type="button" data-cctl-play class="cctl-primary">${modifier ? 'شاهد التبديل أثناء السحب' : 'شاهد البعيد والقريب'}</button><button type="button" data-cctl-reset>إعادة الضبط</button></div>
    <details class="cctl-help"><summary>جرّب بالنقر أو لوحة المفاتيح</summary><p>ابدأ التحريك ثم استخدم الأسهم، أو ركّز المقبض واضغط مفاتيح الأسهم. Enter يعتمد النتيجة وEscape يلغي المعاينة. ${modifier ? 'يمكن تبديل زر التثبيت بين خطوتين قبل الاعتماد، كما يمكن ضغط Shift وإفلاته أثناء استخدام الأسهم.' : 'الاقتراب والخروج يغيران معاينة الالتقاط؛ اعتماد النتيجة يحدث عند الإفلات.'}</p><div class="cctl-step-controls"><button type="button" data-cctl-begin>ابدأ تحريكًا</button><button type="button" data-cctl-step="-5,0" aria-label="تحريك يسارًا خمس وحدات">←</button><button type="button" data-cctl-step="5,0" aria-label="تحريك يمينًا خمس وحدات">→</button><button type="button" data-cctl-step="0,-5" aria-label="تحريك للأعلى خمس وحدات">↑</button><button type="button" data-cctl-step="0,5" aria-label="تحريك للأسفل خمس وحدات">↓</button><button type="button" data-cctl-commit>اعتماد الإفلات</button><button type="button" data-cctl-cancel>إلغاء الحركة</button></div></details>
  </section>`;
  return container.querySelector('.cctl-root');
}

function board(root, mode) {
  const svg = root.querySelector('.cctl-board');
  let width = 640, scale = 5.84;
  const project = p => ({ x: 28 + p.x * scale, y: 30 + p.y * scale });
  const unproject = event => {
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = p.matrixTransform(matrix.inverse());
    return { x: (local.x - 28) / scale, y: (local.y - 30) / scale };
  };
  const translate = (selector, p) => { const at = project(p); root.querySelector(selector).setAttribute('transform', `translate(${at.x} ${at.y})`); };
  function measure() {
    const next = Math.max(260, svg.getBoundingClientRect().width || 640);
    if (Math.abs(next - width) < .3 && svg.dataset.cctlMeasured) return;
    width = next; scale = (width - 56) / 100;
    const height = scale * 40 + 60;
    svg.dataset.cctlMeasured = 'true';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;
    const end = project({ x: 100, y: 40 });
    root.querySelector('[data-cctl-background]').innerHTML = `<rect x="28" y="30" width="${100 * scale}" height="${40 * scale}" rx="12" fill="#edf2e4" stroke="#d6e0cb"/>${[20,40,60,80].map(x=>`<path d="M${project({x,y:0}).x} 30V${end.y}" stroke="#dce5d2" stroke-dasharray="2 5"/>`).join('')}<path d="M28 ${project({x:0,y:20}).y}H${end.x}" stroke="#dce5d2" stroke-dasharray="2 5"/><text x="28" y="18" class="cctl-axis-label">٠</text><text x="${end.x}" y="18" text-anchor="end" class="cctl-axis-label">س ١٠٠</text><text x="${end.x}" y="${end.y+20}" text-anchor="end" class="cctl-axis-label">ص ٤٠</text>`;
    mode.render();
  }
  return { svg, project, unproject, translate, measure, get scale() { return scale; } };
}

function modifierMode(root, api, getBoard) {
  let committed = { x: 20, y: 12 }, raw = copy(committed), origin = copy(committed), pending = false;
  let physicalShift = false, latched = false, lastLock = false;
  const locked = () => physicalShift || latched;
  const output = () => pending ? modifierPoint(origin, raw, locked()) : copy(committed);
  const say = (kind, title, detail = '') => api[kind]?.(title, detail);
  function render() {
    const b = getBoard(); if (!b) return;
    const result = output(), rawAt = b.project(raw), outAt = b.project(result), axisAt = b.project(origin);
    b.translate('[data-cctl-handle]', result); b.translate('[data-cctl-origin]', committed);
    attr(root.querySelector('[data-cctl-raw]'), { cx: rawAt.x, cy: rawAt.y, visibility: pending ? 'visible' : 'hidden' });
    attr(root.querySelector('[data-cctl-axis]'), { x1: 28, x2: b.project({x:100,y:0}).x, y1: axisAt.y, y2: axisAt.y, visibility: pending && locked() ? 'visible' : 'hidden' });
    attr(root.querySelector('[data-cctl-difference]'), { x1: rawAt.x, y1: rawAt.y, x2: outAt.x, y2: outAt.y, visibility: pending && locked() ? 'visible' : 'hidden' });
    const button = root.querySelector('[data-cctl-lock]');
    button.setAttribute('aria-pressed', String(latched));
    button.textContent = latched ? 'التثبيت الأفقي مفعّل — أطفئه للتحرير' : 'تثبيت أفقي — بديل Shift';
    root.querySelector('[data-cctl-status]').textContent = pending ? (locked() ? 'معاينة مقيدة أفقيًا' : 'معاينة حرة') : 'موضع معتمد';
    root.querySelector('[data-cctl-metrics]').innerHTML = `<div><span>موضع اليد الخام</span><strong>${coordinates(raw)}</strong></div><div><span>${pending ? 'المعاينة' : 'المعتمد'}</span><strong>${coordinates(result)}</strong></div><div><span>القيد ${pending ? 'الآن' : 'للحركة التالية'}</span><strong>${locked() ? 'أفقي' : 'حر'}${physicalShift ? ' · Shift مضغوط' : ''}</strong></div>`;
    root.dataset.cctlPending = String(pending); root.dataset.cctlRawX = String(round(raw.x)); root.dataset.cctlRawY = String(round(raw.y));
    root.dataset.cctlOutputX = String(round(result.x)); root.dataset.cctlOutputY = String(round(result.y));
    root.dataset.cctlCommittedX = String(round(committed.x)); root.dataset.cctlCommittedY = String(round(committed.y));
    root.dataset.cctlLocked = String(locked()); root.dataset.cctlShift = String(physicalShift); root.dataset.cctlLastLock = String(lastLock);
    root.querySelector('[data-cctl-commit]').disabled = !pending;
    root.querySelector('[data-cctl-cancel]').disabled = !pending;
    root.querySelector('[data-cctl-handle]').setAttribute('aria-label', `مقبض السحب: ${coordinates(result)}. ${locked() ? 'التثبيت الأفقي مفعّل' : 'حركة حرة'}. الأسهم للتحريك، Enter للاعتماد.`);
  }
  function observation(text) { root.querySelector('[data-cctl-observation]').textContent = text; }
  function begin() {
    if (pending) return;
    origin = copy(committed); raw = copy(committed); pending = true; render();
    observation('المربع المنقّط هو الموضع المعتمد. المربع الأخضر يعرض نتيجة الحركة قبل اعتمادها.');
    say('live', 'بدأت معاينة الحركة.', 'غيّر موضع اليد أو بدّل Shift قبل الإفلات.');
  }
  function move(p, quiet = false) {
    if (!pending) return;
    raw = point(p); render();
    if (!quiet) {
      observation(locked() ? `اليد عند ${coordinates(raw)}، لكن الارتفاع يبقى ${fmt(origin.y)} لأن القيد أفقي.` : 'الموضع يتبع اليد في الاتجاهين. ضغط Shift الآن يغيّر النتيجة دون تغيير موضع اليد.');
      say('live', locked() ? 'تثبيت الارتفاع أثناء الحركة.' : 'الحركة حرة في الاتجاهين.', `المعاينة: ${coordinates(output())}.`);
    }
  }
  function commit() {
    if (!pending) return;
    lastLock = locked(); committed = output(); pending = false; render();
    observation(`اعتُمد الموضع (${coordinates(committed)}) عند الإفلات بقيد ${lastLock ? 'أفقي' : 'حر'}. تغيير المفتاح بعد الإفلات يؤثر في الحركة التالية فقط.`);
    say('done', 'اعتُمدت نتيجة القيد الذي كان فعّالًا عند الإفلات.', `الموضع: ${coordinates(committed)} · القيد عند الاعتماد: ${lastLock ? 'أفقي' : 'حر'}.`);
  }
  function cancel(silent = false) {
    if (!pending) return;
    pending = false; raw = copy(committed); origin = copy(committed); render();
    observation('أُلغيت المعاينة؛ بقي آخر موضع معتمد كما هو.');
    if (!silent) say('ready', 'أُلغي السحب وبقي الموضع المعتمد.', coordinates(committed));
  }
  function setShift(value) {
    if (physicalShift === value) return;
    physicalShift = value; render();
    if (pending) {
      observation(locked() ? 'تغيّر القيد فورًا: بقي موضع اليد نفسه، وعاد ارتفاع المعاينة إلى ارتفاع بداية هذه الحركة.' : 'توقف التثبيت: عادت المعاينة إلى موضع اليد الحالي من دون بدء سحب جديد.');
      say('live', locked() ? 'Shift قيّد الحركة أفقيًا.' : 'إفلات Shift أعاد الحركة الحرة.', `المعاينة الآن: ${coordinates(output())}.`);
    }
  }
  function setLatch(value, quiet = false) {
    latched = value; render();
    if (!quiet) {
      observation(locked() ? 'التثبيت فعّال: يُحفظ ارتفاع بداية الحركة. أطفئ الزر واترك Shift للعودة إلى الحركة الحرة.' : 'القيد حر: يتبع الناتج الإحداثيين الأفقي والرأسي.');
      if (pending) say('live', locked() ? 'فُعّل القيد أثناء الحركة.' : 'أُلغي القيد أثناء الحركة.', `موضع اليد لم يتغيّر؛ المعاينة ${coordinates(output())}.`);
    }
  }
  function reset() { committed={x:20,y:12};raw=copy(committed);origin=copy(committed);pending=false;physicalShift=false;latched=false;lastLock=false;render();observation('ابدأ بحركة مائلة، ثم بدّل Shift مع بقاء الضغط على زر الفأرة.'); }
  return { render, begin, move, commit, cancel, reset, raw:()=>copy(raw), basis:output, pending:()=>pending, setShift, toggle:()=>setLatch(!latched),
    steps:()=>[
      { at:0, p:{x:20,y:12}, note:'١ / حركة حرة في الاتجاهين.' },
      { at:900, p:{x:48,y:29}, note:'موضع اليد والمعاينة متطابقان في الحركة الحرة.' },
      { at:1450, p:{x:48,y:29}, action:()=>setLatch(true,true), note:'٢ / فُعّل التثبيت واليد ثابتة: عاد الارتفاع إلى ١٢.' },
      { at:2250, p:{x:72,y:33}, note:'تحركت اليد إلى ارتفاع ٣٣؛ المعاينة ما زالت عند ١٢.' },
      { at:2750, p:{x:72,y:33}, action:()=>setLatch(false,true), note:'٣ / أُطفئ التثبيت: وصلت المعاينة فورًا إلى موضع اليد.' },
      { at:3400, p:{x:72,y:33}, action:()=>setLatch(true,true), note:'٤ / نعيد القيد ثم نعتمد النتيجة عند الإفلات.' },
      { at:3950, p:{x:72,y:33}, action:commit },
    ], observation };
}

function magnetMode(root, api, getBoard) {
  const target={x:68,y:20}, radius=12;
  let raw={x:20,y:12}, committed=copy(raw), pending=false;
  const say=(kind,title,detail='')=>api[kind]?.(title,detail);
  const observation=text=>{root.querySelector('[data-cctl-observation]').textContent=text;};
  function miniScene(key, result) {
    const s=1.8, project=p=>({x:30+p.x*s,y:38+p.y*s}), p=project(result), t=project(target);
    const grid=key==='grid'?Array.from({length:6},(_,i)=>`<path d="M${30+i*36} 38v72" stroke="#dfd8c7"/>`).join('')+Array.from({length:3},(_,i)=>`<path d="M30 ${38+i*36}h180" stroke="#dfd8c7"/>`).join(''):'';
    const snap=key==='magnet'?`<circle cx="${t.x}" cy="${t.y}" r="${radius*s}" fill="#e2edda" stroke="#8fa77c" stroke-dasharray="4 3"/>`:'';
    return `<rect x="30" y="38" width="180" height="72" rx="9" fill="#f2f4e9" stroke="#dce4d1"/>${grid}${snap}<path d="M${t.x-5} ${t.y}h10M${t.x} ${t.y-5}v10" stroke="#a0ae92" stroke-width="1.5"/><rect x="${p.x-8}" y="${p.y-8}" width="16" height="16" rx="4" fill="${key==='grid'?'#ad774b':key==='magnet'?'#507c50':'#27634f'}"/><text x="120" y="137" text-anchor="middle" class="cctl-mini-label">${key==='free'?'الموضع كما هو':key==='grid'?'أقرب مضاعف للعدد ٢٠':'هدف واحد: س ٦٨ · ص ٢٠'}</text>`;
  }
  function render() {
    const b=getBoard();if(!b)return;
    const result=magnetReadings(raw,target,radius), t=b.project(target), r=b.project(raw), c=magnetReadings(committed,target,radius);
    root.querySelector('[data-cctl-target]').innerHTML=`<circle cx="${t.x}" cy="${t.y}" r="${radius*b.scale}" class="cctl-radius ${result.snapped?'is-near':''}"/><path d="M${t.x-7} ${t.y}h14M${t.x} ${t.y-7}v14" stroke="#698759" stroke-width="2"/>`;
    b.translate('[data-cctl-handle]',raw);b.translate('[data-cctl-origin]',committed);
    attr(root.querySelector('[data-cctl-raw]'),{visibility:'hidden'});attr(root.querySelector('[data-cctl-axis]'),{visibility:'hidden'});
    attr(root.querySelector('[data-cctl-difference]'),{x1:r.x,y1:r.y,x2:t.x,y2:t.y,visibility:'visible'});
    for(const key of ['free','grid','magnet']){
      root.querySelector(`[data-cctl-scene="${key}"]`).innerHTML=miniScene(key,result[key]);
      root.querySelector(`[data-cctl-output="${key}"]`).innerHTML=`<strong>${coordinates(result[key])}</strong><span>${pending?'معاينة · المعتمد: '+coordinates(c[key]):'معتمد عند الإفلات'}</span>`;
    }
    root.querySelector('[data-cctl-status]').textContent=result.snapped?'داخل دائرة الالتقاط':'خارج دائرة الالتقاط';
    root.querySelector('[data-cctl-metrics]').innerHTML=`<div><span>المسافة إلى الهدف</span><strong>${fmt(result.distance)}</strong></div><div><span>شرط الالتقاط</span><strong>١٢ وحدة أو أقل</strong></div><div><span>${pending?'المعاينة الآن':'آخر نتيجة معتمدة'}</span><strong>${result.snapped?'التقاط إلى الهدف':'موضع حر خارج النطاق'}</strong></div>`;
    root.dataset.cctlPending=String(pending);root.dataset.cctlRawX=String(round(raw.x));root.dataset.cctlRawY=String(round(raw.y));
    root.dataset.cctlGridX=String(result.grid.x);root.dataset.cctlGridY=String(result.grid.y);
    root.dataset.cctlMagnetX=String(round(result.magnet.x));root.dataset.cctlMagnetY=String(round(result.magnet.y));
    root.dataset.cctlSnapped=String(result.snapped);root.dataset.cctlDistance=String(round(result.distance));
    root.dataset.cctlCommittedX=String(round(committed.x));root.dataset.cctlCommittedY=String(round(committed.y));
    root.querySelector('[data-cctl-commit]').disabled=!pending;root.querySelector('[data-cctl-cancel]').disabled=!pending;
    root.querySelector('[data-cctl-handle]').setAttribute('aria-label',`المدخل المشترك ${coordinates(raw)}. المسافة إلى الهدف ${fmt(result.distance)}. الأسهم للتحريك، Enter للاعتماد.`);
  }
  function begin(){if(pending)return;raw=copy(committed);pending=true;render();observation('المشاهد الثلاثة تعاين المدخل نفسه. الإفلات يعتمد النتيجة، والإلغاء يستعيد آخر مدخل معتمد.');say('live','بدأت مقارنة القواعد الثلاث من مدخل واحد.');}
  function move(p,quiet=false){if(!pending)return;raw=point(p);render();if(!quiet){const r=magnetReadings(raw,target,radius);observation(r.snapped?'اليد داخل الدائرة: الالتقاط يضع الناتج على الهدف ٦٨،٢٠؛ الشبكة تختار مضاعفات ٢٠.':'اليد خارج الدائرة: الالتقاط يساوي الموضع الحر. الشبكة ما زالت تقرّب في كل المساحة.');say('live',r.snapped?'الاقتراب فعّل الالتقاط إلى الهدف.':'الخروج من الدائرة حرّر موضع الالتقاط.',`المسافة ${fmt(r.distance)}؛ حد الالتقاط ١٢.`);}}
  function commit(){if(!pending)return;committed=copy(raw);pending=false;render();const r=magnetReadings(raw,target,radius);observation(`اعتُمدت ثلاثة مخارج للمدخل نفسه: حر (${coordinates(r.free)})، شبكة (${coordinates(r.grid)})، التقاط (${coordinates(r.magnet)}).`);say('done','اعتُمدت نتائج القواعد الثلاث من الموضع نفسه.',`حر: ${coordinates(r.free)} · شبكة: ${coordinates(r.grid)} · التقاط: ${coordinates(r.magnet)}.`);}
  function cancel(silent=false){if(!pending)return;pending=false;raw=copy(committed);render();observation('أُلغيت المعاينة وعادت المشاهد الثلاثة إلى آخر مدخل معتمد.');if(!silent)say('ready','أُلغي السحب وبقيت النتائج السابقة.',coordinates(committed));}
  function reset(){raw={x:20,y:12};committed=copy(raw);pending=false;render();observation('جرّب الاقتراب حتى ١٢ وحدة، ثم الابتعاد. الالتقاط لا يعمل خارج هذه الدائرة.');}
  return {render,begin,move,commit,cancel,reset,raw:()=>copy(raw),basis:()=>copy(raw),pending:()=>pending,
    steps:()=>[
      {at:0,p:{x:20,y:12},note:'١ / بعيد: موضع الالتقاط يطابق الحركة الحرة.'},
      {at:850,p:{x:48,y:12},note:'بعيد عن الهدف: الشبكة وحدها تقرّب.'},
      {at:1650,p:{x:61,y:15},note:'٢ / قريب: داخل نصف القطر ١٢، فيلتقط الناتج الهدف ٦٨،٢٠.'},
      {at:2600,p:{x:84,y:33},note:'٣ / خارج الدائرة مجددًا: يتحرر الالتقاط ويعود إلى موضع اليد.'},
      {at:3500,p:{x:62,y:16},note:'٤ / نفس المدخل: حر ٦٢،١٦ · شبكة ٦٠،٢٠ · التقاط ٦٨،٢٠.'},
      {at:4100,p:{x:62,y:16},action:commit},
    ],observation};
}

export function mountCompletionControls(id,container,api) {
  if(!['modifier','magnet'].includes(id))throw new Error(`Unsupported completion control: ${id}`);
  const root=shell(id,container),controller=new AbortController();
  let geometry=null,activePointer=null,pointerStart=null,rawStart=null,keyboard=false,destroyed=false,raf=0,version=0,finishPlay=null;
  const emit={};for(const name of ['ready','live','done','fail'])emit[name]=(...args)=>{if(!destroyed)api[name]?.(...args);};
  const mode=id==='modifier'?modifierMode(root,emit,()=>geometry):magnetMode(root,emit,()=>geometry);
  geometry=board(root,mode);const {svg}=geometry;
  const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:controller.signal});
  const releaseCapture=()=>{const pointerId=activePointer;activePointer=null;if(pointerId!==null)try{if(svg.hasPointerCapture(pointerId))svg.releasePointerCapture(pointerId);}catch{}};
  function stopPlayback(){version++;if(raf)cancelAnimationFrame(raf);raf=0;if(finishPlay){const done=finishPlay;finishPlay=null;done(false);}root.dataset.cctlPlaying='false';}
  function cancel(silent=false){stopPlayback();releaseCapture();keyboard=false;mode.cancel(silent);}
  function stop(){cancel();mode.setShift?.(false);}
  function beginKeyboard(){if(activePointer!==null)return;stopPlayback();if(!mode.pending())mode.begin();keyboard=true;}
  function commit(){stopPlayback();releaseCapture();keyboard=false;mode.commit();}
  function reset(){cancel(true);mode.reset();emit.ready('عاد المثال إلى حالته الأولى.','يمكنك السحب أو استخدام بدائل التحكم بالنقر.');}
  function shifted(event){mode.setShift?.(Boolean(event.shiftKey));}
  function nativePoint(event){const now=geometry.unproject(event);return{x:rawStart.x+now.x-pointerStart.x,y:rawStart.y+now.y-pointerStart.y};}
  on(svg,'pointerdown',event=>{
    if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||!event.target.closest('[data-cctl-handle]'))return;
    event.preventDefault();cancel(true);shifted(event);mode.begin();pointerStart=geometry.unproject(event);rawStart=mode.raw();activePointer=event.pointerId;
    try{svg.setPointerCapture(event.pointerId);}catch{}
  });
  on(window,'pointermove',event=>{if(event.pointerId!==activePointer)return;event.preventDefault();shifted(event);mode.move(nativePoint(event));},{passive:false});
  on(window,'pointerup',event=>{if(event.pointerId!==activePointer)return;shifted(event);mode.move(nativePoint(event),true);releaseCapture();keyboard=false;mode.commit();});
  on(window,'pointercancel',event=>{if(event.pointerId===activePointer)cancel();});
  on(svg,'lostpointercapture',()=>{if(activePointer!==null)cancel();});
  on(window,'keydown',event=>{
    const belongs=root.contains(event.target),handle=event.target.closest?.('[data-cctl-handle]');
    if(event.key==='Shift'){if(mode.pending()||belongs)mode.setShift?.(true);return;}
    if(event.key==='Escape'&&(mode.pending()||finishPlay)){event.preventDefault();cancel();return;}
    if(!handle&&!keyboard)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();shifted(event);if(mode.pending())commit();else beginKeyboard();return;}
    const delta={ArrowRight:[5,0],ArrowLeft:[-5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[event.key];
    if(!delta||activePointer!==null)return;
    event.preventDefault();beginKeyboard();shifted(event);const p=mode.raw();mode.move({x:p.x+delta[0],y:p.y+delta[1]});
  });
  on(window,'keyup',event=>{if(event.key==='Shift')mode.setShift?.(false);});
  on(window,'blur',stop);on(document,'visibilitychange',()=>{if(document.hidden)stop();});
  on(root,'click',event=>{
    if(event.target.closest('[data-cctl-lock]')){if(finishPlay)cancel();mode.toggle?.();return;}
    if(event.target.closest('[data-cctl-reset]')){reset();return;}
    if(event.target.closest('[data-cctl-play]')){play();return;}
    if(event.target.closest('[data-cctl-begin]')){beginKeyboard();return;}
    if(event.target.closest('[data-cctl-commit]')){commit();return;}
    if(event.target.closest('[data-cctl-cancel]')){cancel();return;}
    const step=event.target.closest('button[data-cctl-step]');
    if(step){
      const delta=step.dataset.cctlStep.split(',').map(Number);
      if(delta.length!==2||!delta.every(Number.isFinite))return;
      beginKeyboard();const p=mode.raw();mode.move({x:p.x+delta[0],y:p.y+delta[1]});
    }
  });
  function play(){
    cancel(true);mode.reset();mode.begin();const steps=mode.steps(),token=version,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.cctlPlaying='true';root.dataset.cctlPlayStep='0';let started=null,index=0;
    return new Promise(resolve=>{
      finishPlay=resolve;
      function tick(now){
        if(destroyed||token!==version)return;
        if(started===null)started=now;const elapsed=now-started;
        while(index<steps.length&&steps[index].at<=elapsed){
          const step=steps[index];if(step.p)mode.move(step.p,true);step.action?.();if(step.note)mode.observation(step.note);root.dataset.cctlPlayStep=String(index+1);index++;
        }
        if(index===steps.length){raf=0;finishPlay=null;root.dataset.cctlPlaying='false';resolve(true);return;}
        if(!reduced&&index>0){const a=steps[index-1],b=steps[index],f=clamp((elapsed-a.at)/(b.at-a.at),0,1);if(a.p&&b.p)mode.move({x:a.p.x+(b.p.x-a.p.x)*f,y:a.p.y+(b.p.y-a.p.y)*f},true);}
        raf=requestAnimationFrame(tick);
      }
      raf=requestAnimationFrame(tick);
    });
  }
  geometry.measure();mode.reset();const observer=new ResizeObserver(()=>geometry.measure());observer.observe(svg);
  return{play,destroy(){if(destroyed)return;destroyed=true;cancel(true);controller.abort();observer.disconnect();}};
}
