const NS = 'http://www.w3.org/2000/svg';
const number = value => new Intl.NumberFormat('ar').format(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const attrs = (element, values) => { for (const [key, value] of Object.entries(values)) element.setAttribute(key, value); return element; };
const svgElement = (tag, values = {}, parent) => { const element = document.createElementNS(NS, tag); attrs(element, values); if (parent) parent.append(element); return element; };
function point(svg, event) { const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const matrix = svg.getScreenCTM(); return matrix ? p.matrixTransform(matrix.inverse()) : { x: 0, y: 0 }; }
function shell(container, caption, pill, content, help) {
  container.innerHTML = `<section class="geo-root"><div class="geo-top"><span class="geo-caption">${caption}</span><span class="geo-pill">${pill}</span></div><svg class="geo-svg" viewBox="0 0 900 470" aria-label="${caption}" tabindex="0">${content}</svg>${help}</section>`;
  return { root: container.querySelector('.geo-root'), svg: container.querySelector('.geo-svg'), pill: container.querySelector('.geo-pill') };
}
function pointerSession(svg, controller, callbacks) {
  let pointerId = null;
  const release = () => { const old = pointerId; pointerId = null; if (old !== null && svg.hasPointerCapture(old)) svg.releasePointerCapture(old); };
  const cancel = () => { if (pointerId === null) return; callbacks.cancel?.(); release(); };
  svg.addEventListener('pointerdown', event => {
    if (pointerId !== null || event.button !== 0 || !event.isPrimary) return;
    if (callbacks.start(point(svg, event), event) === false) return;
    event.preventDefault(); pointerId = event.pointerId;
    svg.setPointerCapture(pointerId);
  }, { signal: controller.signal });
  svg.addEventListener('pointermove', event => { if (event.pointerId === pointerId) callbacks.move(point(svg, event), event); }, { signal: controller.signal });
  svg.addEventListener('pointerup', event => { if (event.pointerId !== pointerId) return; callbacks.end(point(svg, event), event); release(); }, { signal: controller.signal });
  svg.addEventListener('pointercancel', event => { if (event.pointerId === pointerId) cancel(); }, { signal: controller.signal });
  svg.addEventListener('lostpointercapture', () => { if (pointerId !== null) { pointerId = null; callbacks.cancel?.(); } }, { signal: controller.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && pointerId !== null) { event.preventDefault(); cancel(); } }, { signal: controller.signal });
  window.addEventListener('blur', cancel, { signal: controller.signal });
  return () => { release(); controller.abort(); };
}
const plant = (x,y) => `<g transform="translate(${x} ${y})"><ellipse cy="20" rx="18" ry="7" fill="#ddd4bd"/><rect x="-10" y="1" width="20" height="22" rx="6" fill="#c59571"/><ellipse cx="-9" cy="-4" rx="11" ry="17" transform="rotate(-36)" fill="#8ca879"/><ellipse cx="8" cy="-4" rx="10" ry="17" transform="rotate(32)" fill="#5e8971"/><ellipse cy="-13" rx="9" ry="17" fill="#779b6a"/></g>`;
const floorGrid = (x, y, width, height, size = 40) => {
  let html = `<rect class="geo-floor" x="${x}" y="${y}" width="${width}" height="${height}" rx="22"/>`;
  for (let px = x + size; px < x + width; px += size) html += `<line class="geo-grid-line" x1="${px}" y1="${y+7}" x2="${px}" y2="${y+height-7}"/>`;
  for (let py = y + size; py < y + height; py += size) html += `<line class="geo-grid-line" x1="${x+7}" y1="${py}" x2="${x+width-7}" y2="${py}"/>`;
  return html;
};
function equipment(type) {
  if (type === 'table') return `<rect x="-33" y="-21" width="66" height="40" rx="7" fill="#d2b58e"/><rect x="-25" y="-15" width="50" height="28" rx="4" fill="#ead5b8"/><path d="M-24 23v6m48-6v6" stroke="#8c6b47" stroke-width="6" stroke-linecap="round"/>`;
  if (type === 'box') return `<path d="M-28-15 0-28 28-15 28 17 0 30-28 17Z" fill="#ce986c"/><path d="M-28-15 0-2 28-15M0-2V30" fill="none" stroke="#ae7850" stroke-width="2"/><path d="M-11-23 17-9 17 3 9 7 9-5-19-18Z" fill="#e7c6a1"/>`;
  if (type === 'pot') return `<ellipse cy="13" rx="31" ry="20" fill="#82968b"/><rect x="-31" y="-12" width="62" height="27" rx="10" fill="#9bb0a3"/><ellipse cy="-12" rx="31" ry="17" fill="#cfddd0"/><ellipse cy="-12" rx="24" ry="11" fill="#c69961"/><path d="M-33-6h-9m75 0h9" stroke="#6a8575" stroke-width="6" stroke-linecap="round"/>`;
  return `<rect x="-28" y="-24" width="56" height="49" rx="8" fill="#71907a"/><rect x="-20" y="-17" width="40" height="11" rx="3" fill="#b8c9a9"/><rect x="-20" y="3" width="40" height="14" rx="3" fill="#b8c9a9"/><path d="M-12-11H12M-12 10H12" stroke="#486653" stroke-width="2"/>`;
}
function mountSelect(container, api) {
  const controller = new AbortController();
  const items = [
    {id:'a',x:160,y:160,name:'طاولة تجهيز',type:'table'}, {id:'b',x:350,y:160,name:'صندوق بهارات',type:'box'},
    {id:'c',x:540,y:160,name:'وعاء طبخ',type:'pot'}, {id:'d',x:730,y:160,name:'رف أدوات',type:'shelf'},
    {id:'e',x:160,y:315,name:'صندوق مواد',type:'box'}, {id:'f',x:350,y:315,name:'طاولة تعبئة',type:'table'},
    {id:'g',x:540,y:315,name:'وعاء تقديم',type:'pot'}, {id:'h',x:730,y:315,name:'رف تخزين',type:'shelf'}
  ];
  const markup = `${floorGrid(55,65,790,350,39)}${plant(73,48)}${plant(826,435)}<text x="450" y="43" class="geo-label">مساحة تجهيز · اسحب من الفراغ</text>${items.map(item=>`<g class="geo-item" data-item="${item.id}" data-selected="false" role="button" aria-label="${item.name}" aria-pressed="false" tabindex="0" transform="translate(${item.x} ${item.y})"><rect class="geo-item-outline" x="-66" y="-56" width="132" height="112" rx="17"/><g transform="translate(0 -6)">${equipment(item.type)}</g><text class="geo-label" y="41">${item.name}</text><g class="geo-check"><circle cx="48" cy="-40" r="12" fill="#166353"/><path d="m43-40 4 4 7-8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`).join('')}<rect class="geo-marquee" x="0" y="0" width="0" height="0" rx="3" visibility="hidden"/>`;
  const help = `<div class="geo-legend"><span><i class="geo-dot"></i> عناصر متاحة</span><span><i class="geo-dot geo-dot-selected"></i> عناصر محدّدة</span></div><details class="geo-help"><summary>بديل بالنقر ولوحة المفاتيح</summary><p>انقر أي عنصر لتحديده أو إلغاء تحديده. يمكنك أيضًا الوصول إليه بمفتاح Tab ثم الضغط على Enter أو المسافة.</p><div class="geo-controls"><button class="geo-button" data-select-all>تحديد الكل</button><button class="geo-button" data-clear-selection>إلغاء التحديد</button></div></details>`;
  const {root, svg, pill} = shell(container,'اسحب مستطيلًا حول العناصر التي تريد تحديدها.','٠ عناصر محدّدة',markup,help);
  const marquee = svg.querySelector('.geo-marquee');
  let selected = new Set(); let before = new Set(); let start;
  const render = () => { for (const item of items) { const element = svg.querySelector(`[data-item="${item.id}"]`); const isSelected = selected.has(item.id); element.dataset.selected = isSelected; element.setAttribute('aria-pressed',isSelected); } pill.textContent=`${number(selected.size)} عناصر محدّدة`; };
  const report = () => selected.size ? api.done(`تم تحديد ${number(selected.size)} عناصر.`,items.filter(item=>selected.has(item.id)).map(item=>item.name).join('، ')) : api.ready('لا توجد عناصر داخل التحديد.','ارسم مستطيلًا يمر بمراكز العناصر، أو انقر عنصرًا مباشرة.');
  const toggle = id => { selected.has(id) ? selected.delete(id) : selected.add(id); render(); report(); };
  root.querySelectorAll('[data-item]').forEach(element=>{
    element.addEventListener('click',()=>toggle(element.dataset.item),{signal:controller.signal});
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();toggle(element.dataset.item);}},{signal:controller.signal});
  });
  root.querySelector('[data-select-all]').addEventListener('click',()=>{selected = new Set(items.map(item=>item.id)); render(); report();},{signal:controller.signal});
  root.querySelector('[data-clear-selection]').addEventListener('click',()=>{selected.clear(); render(); api.ready('تم إلغاء التحديد.');},{signal:controller.signal});
  const update = p => { const x = Math.min(start.x,p.x), y = Math.min(start.y,p.y), width = Math.abs(start.x-p.x), height = Math.abs(start.y-p.y); attrs(marquee,{x,y,width,height,visibility:'visible'}); selected = new Set(items.filter(item=>item.x>=x&&item.x<=x+width&&item.y>=y&&item.y<=y+height).map(item=>item.id)); render(); };
  return pointerSession(svg,controller,{
    start(p,event){if(event.target.closest('[data-item]')) return false; before = new Set(selected); start = p; update(p); api.live('ارسم حدود التحديد.','ستظهر العناصر المختارة باللون الأخضر.');},
    move(p){update(p);api.live(`${number(selected.size)} عناصر داخل المستطيل.`, 'أفلت لاعتماد التحديد، أو اضغط Escape للإلغاء.');},
    end(p){update(p);marquee.setAttribute('visibility','hidden'); report();},
    cancel(){selected = new Set(before); marquee.setAttribute('visibility','hidden');render();api.ready('أُلغي السحب؛ احتُفظ بالتحديد السابق.');}
  });
}
function mountArea(container, api) {
  const controller = new AbortController();
  const grid = {x:86,y:100,size:52,cols:14,rows:6};
  const blocked = (col,row) => col===6||col===7 ? 'aisle' : ((col>=1&&col<=3&&row<=1)||(col>=10&&col<=12&&row>=3&&row<=4)) ? 'shelf' : '';
  let cells = ''; for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.cols;col++) cells += `<rect class="geo-area-cell" data-blocked="${blocked(col,row)}" x="${grid.x+col*grid.size}" y="${grid.y+row*grid.size}" width="${grid.size}" height="${grid.size}"/>`;
  let labels = '';for(let col=0;col<grid.cols;col++)labels += `<text class="geo-label" x="${grid.x+(col+.5)*grid.size}" y="85">${number(col+1)}</text>`;for(let row=0;row<grid.rows;row++)labels += `<text class="geo-label" x="67" y="${grid.y+(row+.5)*grid.size+5}">${number(row+1)}</text>`;
  const shelves = `<g pointer-events="none"><rect x="148" y="110" width="136" height="84" rx="8" fill="#ad885c"/><rect x="156" y="118" width="120" height="30" rx="3" fill="#d9c19d"/><rect x="156" y="156" width="120" height="30" rx="3" fill="#d9c19d"/><path d="M190 120v26m48-26v26m-24 12v26" stroke="#ae9168" stroke-width="3"/><rect x="616" y="266" width="136" height="84" rx="8" fill="#ad885c"/><rect x="624" y="274" width="120" height="30" rx="3" fill="#d9c19d"/><rect x="624" y="312" width="120" height="30" rx="3" fill="#d9c19d"/><path d="M658 276v26m48-26v26m-24 12v26" stroke="#ae9168" stroke-width="3"/></g>`;
  const markup = `<rect x="75" y="89" width="750" height="334" rx="14" fill="#e1dacb"/>${cells}${labels}${shelves}<path d="M450 120v274" fill="none" stroke="#bfb297" stroke-width="2" stroke-dasharray="8 8"/><rect x="417" y="217" width="66" height="70" rx="11" fill="#e8e0ce"/><text class="geo-label" x="450" y="245">ممر</text><text class="geo-label" x="450" y="266">خدمة</text><g data-area-result></g><text x="450" y="448" class="geo-label">كل مربع = خانة واحدة · اترك الممر والأرفف خالية</text>`;
  const help = `<div class="geo-legend"><span><i class="geo-dot"></i> أرضية متاحة</span><span><i class="geo-dot geo-dot-aisle"></i> ممر محجوز</span><span><i class="geo-dot geo-dot-blocked"></i> أرفف ثابتة</span></div><details class="geo-help"><summary>تحديد المساحة بالأرقام</summary><p>اختر نقطة البداية وحجم المستطيل بالخانات. الأعمدة تُحسب من اليسار، والصفوف من الأعلى.</p><form class="geo-controls" data-area-form><label class="geo-field">العمود<input class="geo-input" name="col" type="number" min="1" max="14" value="1" required></label><label class="geo-field">الصف<input class="geo-input" name="row" type="number" min="1" max="6" value="4" required></label><label class="geo-field">العرض<input class="geo-input" name="width" type="number" min="1" max="14" value="4" required></label><label class="geo-field">الارتفاع<input class="geo-input" name="height" type="number" min="1" max="6" value="2" required></label><button class="geo-button geo-button-primary" type="submit">اعتماد المساحة</button></form></details>`;
  const {root,svg,pill} = shell(container,'حدّد مساحة تخزين فوق الخانات المتاحة.','لم تُحدّد مساحة',markup,help);
  const overlay = svg.querySelector('[data-area-result]'); let committed = null, preview = null, first;
  const contains = p => p.x>=grid.x&&p.y>=grid.y&&p.x<grid.x+grid.cols*grid.size&&p.y<grid.y+grid.rows*grid.size;
  const cellAt = p => ({col:clamp(Math.floor((p.x-grid.x)/grid.size),0,grid.cols-1),row:clamp(Math.floor((p.y-grid.y)/grid.size),0,grid.rows-1)});
  const make = (a,b) => ({col:Math.min(a.col,b.col),row:Math.min(a.row,b.row),width:Math.abs(a.col-b.col)+1,height:Math.abs(a.row-b.row)+1});
  const validity = area => {if(area.col<0||area.row<0||area.col+area.width>grid.cols||area.row+area.height>grid.rows)return 'حدّد المساحة داخل حدود الأرضية.';for(let r=area.row;r<area.row+area.height;r++)for(let c=area.col;c<area.col+area.width;c++){if(blocked(c,r)==='aisle')return 'اترك ممر الخدمة خاليًا.';if(blocked(c,r)==='shelf')return 'هذه المساحة تتداخل مع أرفف ثابتة.';}return '';};
  const render = area => { overlay.replaceChildren(); const invalid = area ? validity(area) : '';pill.dataset.state = invalid?'invalid':'ready'; if(!area){pill.textContent='لم تُحدّد مساحة';return;}const count=area.width*area.height;pill.textContent=invalid?'مساحة غير صالحة':`${number(count)} خانات تخزين`;svgElement('rect',{x:grid.x+area.col*grid.size+2,y:grid.y+area.row*grid.size+2,width:area.width*grid.size-4,height:area.height*grid.size-4,rx:7,class:'geo-area-overlay','data-valid':!invalid},overlay);const label = svgElement('text',{x:grid.x+(area.col+area.width/2)*grid.size,y:grid.y+(area.row+area.height/2)*grid.size+6,class:'geo-area-count','data-valid':!invalid},overlay);label.textContent=number(count);};
  const commit = area => {const invalid = validity(area);if(invalid){render(committed);pill.dataset.state='invalid';pill.textContent='المساحة غير متاحة';api.fail(invalid,'احتُفظ بالمساحة السابقة. جرّب الخانات الفارغة بجانب الممر.');return;}committed={...area};render(committed);api.done(`مساحة التخزين: ${number(area.width*area.height)} خانات.`,`${number(area.width)} أعمدة × ${number(area.height)} صفوف، داخل أرضية متاحة.`);};
  root.querySelector('[data-area-form]').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.target);const area={col:Number(form.get('col'))-1,row:Number(form.get('row'))-1,width:Number(form.get('width')),height:Number(form.get('height'))};if(!Object.values(area).every(Number.isInteger)||area.width<1||area.height<1){api.fail('أدخل أعدادًا صحيحة موجبة.');return;}commit(area);},{signal:controller.signal});
  return pointerSession(svg,controller,{
    start(p){if(!contains(p)){api.fail('ابدأ السحب داخل شبكة الأرضية.');return false;}first=cellAt(p);preview=make(first,first);render(preview);api.live('اسحب لتوسيع مساحة التخزين.','الأرفف وممر الخدمة غير متاحة للتخزين.');},
    move(p){preview=make(first,cellAt(p));render(preview);const invalid=validity(preview);api.live(invalid||`معاينة ${number(preview.width*preview.height)} خانات.`,invalid?'أفلت في مساحة متاحة، أو اضغط Escape للإلغاء.':'أفلت لاعتماد هذه المساحة.');},
    end(p){if(!contains(p)){render(committed);api.fail('أفلت داخل حدود أرضية التخزين.','احتُفظ بالمساحة السابقة.');return;}preview=make(first,cellAt(p));commit(preview);preview=null;},
    cancel(){preview=null;render(committed);api.ready('أُلغي التحديد؛ احتُفظ بالمساحة السابقة.');}
  });
}
function segmentHitsRect(a,b,rect) {
  let tMin=0,tMax=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-rect.x],[dx,rect.x+rect.width-a.x],[-dy,a.y-rect.y],[dy,rect.y+rect.height-a.y]]){
    if(p===0){if(q<0)return false;continue;}const t=q/p;if(p<0)tMin=Math.max(tMin,t);else tMax=Math.min(tMax,t);if(tMin>tMax)return false;
  }return true;
}
function mountPath(container, api) {
  const controller = new AbortController();
  const origin={x:135,y:250},destination={x:765,y:250};
  const obstacle={x:344,y:159,width:212,height:172};
  const markup = `${floorGrid(48,65,804,359,40)}<rect x="54" y="215" width="132" height="70" rx="20" fill="#e1e8da"/><rect x="710" y="207" width="135" height="86" rx="20" fill="#e6d4b7"/><g transform="translate(450 245)"><rect x="-98" y="-78" width="196" height="156" rx="16" fill="#e1d2b7" stroke="#beab89" stroke-width="2"/><rect x="-81" y="-60" width="162" height="54" rx="8" fill="#bc9469"/><rect x="-74" y="-53" width="148" height="39" rx="5" fill="#d9bb91"/><circle cx="-43" cy="-34" r="15" fill="#86937a"/><circle cx="-43" cy="-34" r="9" fill="#b3bc9b"/><rect x="-11" y="-46" width="65" height="23" rx="4" fill="#eee0c4"/><text class="geo-strong-label" y="28">منطقة تجهيز</text><text class="geo-label" y="51">مرّ من حولها</text></g>${plant(76,87)}${plant(829,406)}<path class="geo-route" data-committed-path d=""/><path class="geo-route geo-route-preview" data-preview-path d=""/><g class="geo-route-origin" role="group" aria-label="نقطة انطلاق المسار"><circle class="geo-pulse" cx="135" cy="250" r="42"/><circle class="geo-route-focus" cx="135" cy="250" r="29" fill="#166353" stroke="#edf2e5" stroke-width="7"/><path d="m126 250 6 6 12-13" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g><circle cx="765" cy="250" r="31" fill="#faf6e8" stroke="#b69566" stroke-width="2" stroke-dasharray="6 4"/><path d="M755 263v-28h20l-5 7 5 7h-20" fill="#d38352" stroke="#b37043" stroke-width="2" stroke-linejoin="round"/></g><text x="135" y="312" class="geo-strong-label">نقطة الانطلاق</text><text x="765" y="312" class="geo-strong-label">نقطة التسليم</text><circle class="geo-route-marker" data-traveller cx="135" cy="250" r="11" visibility="hidden"/>`;
  const help = `<div class="geo-legend"><span><i class="geo-dot geo-dot-selected"></i> مسار توصيل</span><span><i class="geo-dot geo-dot-blocked"></i> عائق ثابت</span></div><details class="geo-help"><summary>اختيار مسار بالنقر أو لوحة المفاتيح</summary><p>يمكنك اختيار طريق جاهز من حول منطقة التجهيز. هذه الأزرار تختار المسار مباشرة.</p><div class="geo-controls"><button class="geo-button" data-route="upper">اختيار الطريق العلوي</button><button class="geo-button" data-route="lower">اختيار الطريق السفلي</button></div></details>`;
  const {root,svg,pill}=shell(container,'ابدأ من الدائرة الخضراء وارسم طريقًا يصل إلى نقطة التسليم.','بانتظار المسار',markup,help);
  const committedPath=svg.querySelector('[data-committed-path]'),previewPath=svg.querySelector('[data-preview-path]'),traveller=svg.querySelector('[data-traveller]');
  let committed=[],draft=[],invalid=false;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const pathData=points=>points.length?points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '):'';
  const within=p=>p.x>=54&&p.x<=846&&p.y>=71&&p.y<=418;
  const restore = () => {previewPath.setAttribute('d','');pill.dataset.state='ready';pill.textContent=committed.length?'مسار معتمد':'بانتظار المسار';};
  const renderDraft=()=>{previewPath.setAttribute('d',pathData(draft));previewPath.dataset.valid=!invalid;pill.dataset.state=invalid?'invalid':'ready';pill.textContent=invalid?'المسار يمر بعائق':distance(draft.at(-1),destination)<=34?'أفلت لاعتماد المسار':'تابع نحو نقطة التسليم';};
  const append=p=>{if(!within(p))invalid=true;if(draft.length&&segmentHitsRect(draft.at(-1),p,obstacle))invalid=true;draft.push({x:p.x,y:p.y});renderDraft();};
  const commit=points=>{committed=points.map(p=>({...p}));committedPath.setAttribute('d',pathData(committed));restore();attrs(traveller,{cx:destination.x,cy:destination.y,visibility:'visible'});api.done('تم رسم مسار التوصيل.','المسار يربط نقطة الانطلاق بالتسليم ويمر من حول منطقة التجهيز.');};
  root.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{const y=button.dataset.route==='upper'?119:376;commit([origin,{x:255,y:250},{x:285,y},{x:615,y},{x:660,y:250},destination]);},{signal:controller.signal}));
  return pointerSession(svg,controller,{
    start(p){if(distance(p,origin)>42){api.fail('ابدأ من الدائرة الخضراء.','استمر بالضغط حتى تصل إلى نقطة التسليم.');return false;}draft=[{...origin}];invalid=false;append(p);api.live('ارسم المسار حول منطقة التجهيز.','واصل السحب حتى نقطة التسليم، ثم أفلت.');},
    move(p){if(distance(p,draft.at(-1))<2)return;append(p);api.live(invalid?'المسار يمر بعائق؛ لن يُعتمد.':distance(p,destination)<=34?'وصلت إلى نقطة التسليم.':'واصل رسم المسار.',invalid?'أفلت للمحاولة مجددًا، أو اضغط Escape للإلغاء.':distance(p,destination)<=34?'أفلت لاعتماد الطريق.':'تجنّب منطقة التجهيز في المنتصف.');},
    end(p){append(p);const arrived=distance(p,destination)<=34;if(!invalid&&arrived&&draft.length>2){if(segmentHitsRect(p,destination,obstacle))invalid=true;else{draft.push({...destination});commit(draft);return;}}restore();pill.dataset.state='invalid';pill.textContent=invalid?'مسار غير صالح':'المسار غير مكتمل';api.fail(invalid?'المسار يمر بعائق أو يتجاوز حدود الأرضية.':'أفلت داخل نقطة التسليم لإكمال المسار.','احتُفظ بالمسار السابق؛ ابدأ من الدائرة الخضراء وحاول مجددًا.');},
    cancel(){draft=[];restore();api.ready('أُلغي الرسم؛ احتُفظ بالمسار السابق.');}
  });
}
export function mountGeometry(id, container, api) {
  if(id==='select')return mountSelect(container,api);
  if(id==='area')return mountArea(container,api);
  if(id==='path')return mountPath(container,api);
  throw new Error(`Unknown geometry demo: ${id}`);
}
