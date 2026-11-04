// One primary button, position and time. No modifier or secondary gesture.
const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const copy = p => p ? {x:p.x, y:p.y} : null;
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const nf = new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
const number = x => Number.isFinite(x) ? nf.format(Math.abs(x)<1e-7?0:x) : '—';
const signed = x => Number.isFinite(x) ? (x>1e-7?'＋':'')+number(x) : '—';
const round = n => Number.isFinite(n)?Math.round(n*10000)/10000:null;
const ids = ['speed-acceleration','time-responses','capture-release'];
export const principleSettings = Object.freeze({windowMs:200, minAccelerationSpan:80, periodMs:500, rate:2, capture:40, releases:[40,90], anchor:{x:400,y:105}});

// Local quadratic least squares in normalized time u∈[-1,0], evaluated at now.
// Normalization and a relative position origin avoid large timestamp/coordinate powers.
function fitMotion(points) {
  if(points.length<2) return {velocity:null, acceleration:null, span:0, samples:points.length};
  const last=points.at(-1), first=points[0], span=last.t-first.t, sec=span/1000;
  if(!(sec>0)) return {velocity:null,acceleration:null,span:0,samples:points.length};
  const simple={velocity:(last.x-first.x)/sec,acceleration:null,span,samples:points.length};
  if(points.length<3 || span<principleSettings.minAccelerationSpan) return simple;
  const m=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for(const p of points){
    const u=(p.t-last.t)/span, basis=[1,u,u*u], x=p.x-last.x;
    for(let i=0;i<3;i++){ for(let j=0;j<3;j++) m[i][j]+=basis[i]*basis[j]; m[i][3]+=basis[i]*x; }
  }
  for(let k=0;k<3;k++){
    let p=k; for(let i=k+1;i<3;i++) if(Math.abs(m[i][k])>Math.abs(m[p][k])) p=i;
    if(Math.abs(m[p][k])<1e-10) return simple;
    [m[k],m[p]]=[m[p],m[k]]; const divisor=m[k][k];
    for(let j=k;j<4;j++)m[k][j]/=divisor;
    for(let i=0;i<3;i++)if(i!==k){const f=m[i][k];for(let j=k;j<4;j++)m[i][j]-=f*m[k][j];}
  }
  return {...simple,velocity:m[1][3]/sec,acceleration:2*m[2][3]/(sec*sec)};
}

export function createMotionEstimator() {
  let points, history, current, start, now, held, released, interrupted, fit;
  function clear(){points=[];history=[];current=null;start=now=0;held=released=interrupted=false;fit=fitMotion([]);}
  function begin(p,t=0){if(!finitePoint(p)||!Number.isFinite(t))return false;clear();current=copy(p);start=now=t;held=true;points.push({x:p.x,t});return true;}
  function sample(p,t){
    if(!held||!finitePoint(p)||!Number.isFinite(t)||t<=now)return false;
    now=t; current=copy(p); points.push({x:p.x,t});
    const cut=t-principleSettings.windowMs;
    while(points.length>1&&points[0].t<cut)points.shift();
    fit=fitMotion(points);
    if(fit.velocity!==null && (!history.length || t-history.at(-1).t>=20)){
      history.push({t,v:fit.velocity});
      while(history.length>160 || (history.length>1&&t-history[0].t>3000))history.shift();
    }
    return true;
  }
  function advance(t){return current?sample(current,t):false;}
  function finish(t,wasInterrupted=false){if(!held||!Number.isFinite(t)||t<now)return false;advance(t);held=false;interrupted=!!wasInterrupted;released=!interrupted;return true;}
  function snapshot(){return {held,released,interrupted,current:copy(current),duration:now-start,...fit,speed:fit.velocity===null?null:Math.abs(fit.velocity),history:history.map(p=>({...p}))};}
  clear();return {begin,sample,advance,finish,clear,snapshot};
}

export function createTimeResponseEngine() {
  let held, released, interrupted, started, now, entered, inside, visits;
  function clear(){held=released=interrupted=inside=false;started=now=visits=0;entered=null;}
  function begin(isInside,t=0){if(!Number.isFinite(t))return false;clear();held=true;started=now=t;inside=!!isInside;if(inside){entered=t;visits=1;}return true;}
  function sample(isInside,t){if(!held||!Number.isFinite(t)||t<now)return false;now=t;const next=!!isInside;if(next&&!inside){entered=t;visits++;}if(!next)entered=null;inside=next;return true;}
  function advance(t){return sample(inside,t);}
  function finish(t,wasInterrupted=false){if(!advance(t))return false;held=false;interrupted=!!wasInterrupted;released=!interrupted;return true;}
  function snapshot(){const dwell=inside&&entered!==null?Math.max(0,now-entered):0;return {held,released,interrupted,duration:now-started,inside,dwell,visits,once:dwell>=principleSettings.periodMs?1:0,repeated:Math.floor(dwell/principleSettings.periodMs),continuous:dwell*principleSettings.rate/1000};}
  clear();return {begin,sample,advance,finish,clear,snapshot};
}

export function createCaptureReleaseEngine() {
  let held,released,interrupted,started,now,current,distance,models;
  const {anchor,capture,releases}=principleSettings;
  function clear(){held=released=interrupted=false;started=now=0;current=null;distance=null;models=releases.map(limit=>({limit,captured:false,before:false,everCaptured:false,lastTransition:null}));}
  function sample(p,t){
    if(!held||!finitePoint(p)||!Number.isFinite(t)||t<now)return false;
    current=copy(p);now=t;distance=Math.hypot(p.x-anchor.x,p.y-anchor.y);
    for(const m of models){
      m.before=m.captured;
      if(!m.captured && distance<=capture)m.captured=true;
      else if(m.captured && distance>m.limit)m.captured=false;
      if(m.before!==m.captured){m.lastTransition={from:m.before,to:m.captured,time:t-started,distance};if(m.captured)m.everCaptured=true;}
    }
    return true;
  }
  function begin(p,t=0){if(!finitePoint(p)||!Number.isFinite(t))return false;clear();held=true;started=now=t;return sample(p,t);}
  function advance(t){if(!held||!Number.isFinite(t)||t<now)return false;now=t;return true;}
  function finish(t,wasInterrupted=false){if(!advance(t))return false;held=false;interrupted=!!wasInterrupted;released=!interrupted;return true;}
  function snapshot(){return {held,released,interrupted,duration:now-started,current:copy(current),distance,models:models.map(m=>({...m,lastTransition:m.lastTransition&&{...m.lastTransition},output:copy(m.captured?anchor:current)}))};}
  clear();return {begin,sample,advance,finish,clear,snapshot};
}

// Both straight records start at x=100 and reach v=200 at 1 s. Their prior
// positions and distances differ by design: acceleration is not independent of the trace.
export const speedComparisonTraces = [120,-120].map(a=>Array.from({length:51},(_,i)=>{
  const t=i*20,s=t/1000;return {x:100+(200-a)*s+.5*a*s*s,y:105,t};
}));
const timeTrace=Array.from({length:81},(_,i)=>({x:400+55*Math.sin(i/8),y:105+24*Math.sin(i/10),t:i*20}));
const magnetKeys=[[590,0],[465,400],[420,800],[465,1200],[465,1600]];
const magnetTrace=Array.from({length:81},(_,i)=>{const t=i*20;let j=1;while(j<magnetKeys.length-1&&t>magnetKeys[j][1])j++;const [x0,t0]=magnetKeys[j-1],[x1,t1]=magnetKeys[j];return {x:x0+(x1-x0)*(t-t0)/(t1-t0),y:105,t};});
export const principleTraceData={time:timeTrace,capture:magnetTrace};
const insideTarget=p=>p.x>=275&&p.x<=525&&p.y>=32&&p.y<=178;

const labels={
  'speed-acceleration':{title:'قياسان من الموضع والزمن',hint:'اسحب أفقيًا؛ اليمين موجب. تعرض المقارنة تسجيلين يتساويان في السرعة بعد ثانية واحدة.',guide:'تشغيل تسجيلَي السرعة',ready:'اضغط داخل السطح واسحب أفقيًا أو شغّل المقارنة.',limit:'سرعة أفقية موقّعة وتسارع أفقي موقّع بوحدات اللوحة. في الحركة يمينًا تعني إشارة التسارع الموجبة ازدياد السرعة والسالبة تباطؤها. الملاءمة محلية لآخر ٢٠٠ ملث؛ يلزم موضعان مؤقتان للسرعة وثلاث عينات على امتداد ٨٠ ملث على الأقل للتسارع. قد تتذبذب التقديرات مع اهتزاز اليد. اللوحة لا تقيس قوة الضغط.'},
  'time-responses':{title:'مدة واحدة، ثلاث استجابات',hint:'أبقِ الزر مضغوطًا داخل الهدف الملوّن. الحركة داخله مسموحة؛ الخروج يصفر قيم الزيارة والعودة تبدأ زيارة جديدة.',guide:'تشغيل زيارة ١٫٦ ثانية',ready:'اضغط داخل الهدف، أو اسحب إليه من خارجه، وابقَ فيه.',limit:'الزمن هنا منذ آخر دخول إلى الهدف في الضغطة، لا منذ آخر حركة للمؤشر. الأثر الأول يحدث عند ٥٠٠ ملث، والتكرار عند كل مضاعف مكتمل لها، والمقدار المستمر يزداد وحدتين في الثانية. لا تراكم بعد الإفلات أو مقاطعة النظام.'},
  'capture-release':{title:'مؤشر خام واحد وموضعان ناتجان',hint:'ابدأ خارج الدائرتين. ادخل الدائرة الصغيرة ثم ابتعد إلى المنطقة الواقعة بين الدائرتين أثناء الضغط.',guide:'تشغيل الاقتراب والابتعاد',ready:'اسحب المؤشر إلى مركز الجذب ثم ابتعد بين الحدين.',limit:'المسافة محسوبة من المؤشر الخام إلى المركز، لا من العنصر الملتقط. يبدأ الالتقاط عند ٤٠ أو أقل، ويستمر حتى تجاوز حد الفك فقط. المسافة ٩٠ بالضبط لا تفك النموذج الثاني. يُحتفظ بآخر مشهد بعد الإفلات للمشاهدة.'}
};
const dot=(p,color='#376f60',radius=7)=>p?`<circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2"/>`:'';
function capturePlot(s,m){
  const project=p=>p?{x:150+(p.x-400)*.32,y:55+(p.y-105)*.32}:null;
  const raw=project(s.current), out=project(m.output);
  return `<svg class="pr-magnet-map" viewBox="0 0 300 110" role="img" aria-label="موضع العنصر ${m.captured?'عند مركز الجذب':'يتبع المؤشر الخام'}"><rect x="1" y="1" width="298" height="108" rx="10" fill="#eef3eb"/><circle cx="150" cy="55" r="${m.limit*.32}" fill="#f5eddf" stroke="#b69363" stroke-dasharray="3 3"/><circle cx="150" cy="55" r="12.8" fill="#d6e8d7" stroke="#5f9677"/><circle cx="150" cy="55" r="3" fill="#396d57"/>${raw&&out?`<line x1="${raw.x}" y1="${raw.y}" x2="${out.x}" y2="${out.y}" stroke="#997950" stroke-dasharray="3 2"/><rect x="${out.x-5}" y="${out.y-5}" width="10" height="10" rx="2" fill="#166353"/><circle cx="${raw.x}" cy="${raw.y}" r="7.5" fill="none" stroke="#ad6844" stroke-width="2"/>`:''}</svg>`;
}
function metric(label,value,unit=''){return `<div class="pr-metric"><span>${label}</span><strong>${value}</strong><small>${unit}</small></div>`;}
function linePlot(history,sharedScale=false){
  if(history.length<2)return '<span class="pr-quiet">يظهر منحنى السرعة مع ورود العينات.</span>';
  const vmin=sharedScale?0:Math.min(0,...history.map(p=>p.v)),vmax=sharedScale?340:Math.max(1,...history.map(p=>p.v)),t0=sharedScale?0:history[0].t,span=sharedScale?1000:Math.max(1,history.at(-1).t-t0);
  const path=history.map((p,i)=>`${i?'L':'M'}${(12+236*(p.t-t0)/span).toFixed(2)} ${(58-47*(p.v-vmin)/(vmax-vmin)).toFixed(2)}`).join(' ');
  const refY=58-47*200/340;
  return `<svg class="pr-spark" viewBox="0 0 260 68" role="img" aria-label="السرعة الأفقية مع الزمن، من ${number(vmin)} إلى ${number(vmax)} وحدة لكل ثانية"><path d="M12 8V58H248" fill="none" stroke="#b7c7bb"/>${sharedScale?`<path d="M12 ${refY}H248" fill="none" stroke="#a78256" stroke-dasharray="4 3"/>`:''}<path d="${path}" fill="none" stroke="#267560" stroke-width="2.5"/></svg><small class="pr-quiet">${sharedScale?'مقياس مشترك: الزمن ٠–١ ث، والخط المنقّط سرعة ٢٠٠.':`السرعة الأفقية مع الزمن · المجال ${number(vmin)} إلى ${number(vmax)} وحدة/ث`}</small>`;
}
function shell(id,container){
  const l=labels[id];let bg='';
  if(id==='speed-acceleration')bg='<path d="M30 105H770" stroke="#8caa99" stroke-width="2" stroke-dasharray="5 6"/><text x="400" y="175" text-anchor="middle">المحور الأفقي · اليمين موجب</text>';
  if(id==='time-responses')bg='<rect x="275" y="32" width="250" height="146" rx="16" fill="#dcf0de" stroke="#579574" stroke-width="2"/><text x="400" y="63" text-anchor="middle">منطقة البقاء</text>';
  if(id==='capture-release')bg='<circle cx="400" cy="105" r="90" fill="#f6edda" stroke="#b89458" stroke-dasharray="6 5" stroke-width="2"/><circle cx="400" cy="105" r="40" fill="#ddeddf" stroke="#579574" stroke-width="2"/><circle cx="400" cy="105" r="5" fill="#376f60"/><text x="400" y="207" text-anchor="middle">المركز · حد الالتقاط ٤٠ · حد الفك الثاني ٩٠</text>';
  container.innerHTML=`<section class="pr-lab" data-principle="${id}"><header class="pr-header"><strong>${l.title}</strong><span data-pr-source>تجربة مباشرة بالفأرة</span></header><p class="pr-hint">${l.hint}</p><svg class="pr-board" viewBox="0 0 800 215" role="group" aria-label="سطح تسجيل ضغطة الزر الأساسي: ${l.title}"><defs><pattern id="pr-grid-${id}" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#d9e3d9"/></pattern></defs><rect width="800" height="215" rx="14" fill="#eef3eb"/><rect width="800" height="215" rx="14" fill="url(#pr-grid-${id})"/>${bg}<g data-pr-pointer></g></svg><div class="pr-status" data-pr-status>بانتظار ضغطة واحدة</div><div data-pr-values></div><div data-pr-compare></div><details class="pr-note"><summary>ماذا نثبت، وماذا نقيس؟</summary><p>${l.limit}</p></details><div class="pr-controls"><button type="button" data-pr-play>${l.guide}</button><button type="button" data-pr-reset>مسح السجل</button><small>تشغيل التسجيل ومسحه أداتان للمشاهدة، وليستا جزءًا من الضغطة الأصلية.</small></div></section>`;
  return container.querySelector('.pr-lab');
}
function localPoint(svg,event){const matrix=svg.getScreenCTM();if(!matrix)return null;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(matrix.inverse());return {x:clamp(q.x,0,800),y:clamp(q.y,0,215)};}

export function mountPrincipleLab(id,container,api={}){
  if(!ids.includes(id))throw new Error(`Unknown principle experiment: ${id}`);
  const root=shell(id,container), q=s=>root.querySelector(s), board=q('.pr-board'), pointer=q('[data-pr-pointer]'), values=q('[data-pr-values]'), compare=q('[data-pr-compare]');
  const speed=id==='speed-acceleration',timed=id==='time-responses';
  const model=speed?createMotionEstimator():timed?createTimeResponseEngine():createCaptureReleaseEngine(), second=speed?createMotionEstimator():null;
  const controller=new AbortController(), on=(target,name,fn)=>target.addEventListener(name,fn,{signal:controller.signal});
  let pointerId=null,current=null,source='mouse',startClock=0,raf=0,version=0,settle=null,destroyed=false,lastPaint=-Infinity,lastLive=-Infinity;
  const emit=(kind,message,detail='')=>{if(!destroyed)api[kind]?.(message,detail);};
  const stopFrames=()=>{version++;if(raf)cancelAnimationFrame(raf);raf=0;if(settle){const done=settle;settle=null;done(false);}};
  const releaseCapture=()=>{const old=pointerId;pointerId=null;if(old!==null)try{if(board.hasPointerCapture(old))board.releasePointerCapture(old);}catch{}};
  const elapsed=()=>Math.max(0,performance.now()-startClock);
  function begin(p,t){current=copy(p);return model.begin(timed?insideTarget(p):p,t);}
  function sample(p,t){current=copy(p);return model.sample(timed?insideTarget(p):p,t);}
  function paint(force=false){
    const wall=performance.now();if(!force&&wall-lastPaint<50)return;lastPaint=wall;
    const s=model.snapshot(), b=second?.snapshot(), l=labels[id], active=current!==null;
    root.dataset.prSource=source;root.dataset.prHeld=String(s.held);root.dataset.prReleased=String(s.released);root.dataset.prInterrupted=String(s.interrupted);
    q('[data-pr-source]').textContent=source==='guide'?'تسجيل مضبوط · عرض محاكى':'تجربة مباشرة بالفأرة';
    const phase=!active?'بانتظار ضغطة واحدة':s.interrupted?'انقطعت الضغطة دون إفلات مسجّل':s.released?'انتهى التسجيل بالإفلات · آخر القياسات محفوظة':'الزر مضغوط';
    q('[data-pr-status]').textContent=`${phase}${active?' · '+number(s.duration)+' ملث':''}`;
    if(speed){
      pointer.innerHTML=dot(current&&{x:current.x,y:source==='guide'?80:105})+(source==='guide'?dot(b.current&&{x:b.current.x,y:130},'#ba7950'): '');
      root.dataset.prVelocity=String(round(s.velocity)??'');root.dataset.prAcceleration=String(round(s.acceleration)??'');
      root.dataset.prVelocityB=String(round(b.velocity)??'');root.dataset.prAccelerationB=String(round(b.acceleration)??'');
      values.innerHTML=`<div class="pr-metrics">${metric(source==='guide'?'سرعة التسجيل أ':'السرعة الأفقية الموقّعة',signed(s.velocity),'وحدة/ث')}${metric(source==='guide'?'تسارع التسجيل أ':'التسارع الأفقي الموقّع',signed(s.acceleration),'وحدة/ث²')}${metric('امتداد نافذة التقدير',number(s.span),'ملث · حدّها ٢٠٠')}</div>`;
      if(source==='guide')compare.innerHTML=`<div class="pr-pair">${[s,b].map((v,i)=>`<article><strong>${i?'ب · كان يتباطأ':'أ · كان يتسارع'} نحو اليمين</strong>${linePlot(v.history,true)}<div class="pr-numbers"><span>سرعة <b>${signed(v.velocity)}</b> وحدة/ث</span><span>تسارع <b>${signed(v.acceleration)}</b> وحدة/ث²</span></div></article>`).join('')}</div><p class="pr-take">${s.released?'عند ١٠٠٠ ملث: السرعة الأفقية +٢٠٠ في كليهما، والتسارع +١٢٠ و−١٢٠ وحدة/ث². ثبتنا قيمة السرعة عند المقارنة؛ تاريخا الموضع مختلفان.':'السجلان على خط مستقيم، ونقارن سرعة كل منهما عند لحظة واحدة. موضعا النهاية وطول المسافتين ليسا شرطين ثابتين.'}</p>`;
      else compare.innerHTML=`<div class="pr-single-plot">${linePlot(s.history)}</div><p class="pr-take">${s.acceleration===null?'يلزم وقت وعينات كافية لإظهار التسارع. جرّب العرض المضبوط للمقارنة الدقيقة.':'زيادة السرعة الموقعة أو نقصانها يحدده التسارع الأفقي. بعد استقرار المؤشر مدة النافذة يقترب القياسان من الصفر.'}</p>`;
    } else if(timed){
      pointer.innerHTML=dot(current);root.dataset.prDwell=String(round(s.dwell));root.dataset.prOnce=String(s.once);root.dataset.prRepeated=String(s.repeated);root.dataset.prContinuous=String(round(s.continuous));
      values.innerHTML=`<div class="pr-visit"><strong>${s.inside?'المؤشر داخل الهدف':'المؤشر خارج الهدف'}</strong><span>مدة الزيارة: ${number(s.dwell)} ملث</span><span>الزيارة ${number(s.visits)}</span></div><div class="pr-metrics">${metric('أثر واحد بعد نصف ثانية',number(s.once),'وحدة')}${metric('أثر كل نصف ثانية',number(s.repeated),'وحدات منفصلة')}${metric('تراكم بمعدل ٢ وحدة/ث',number(s.continuous),'وحدة متصلة')}</div>`;
      compare.innerHTML=`<p class="pr-take">${s.dwell>=1600?'تجاوزت الزيارة ١٫٦ ث أو بلغتها. كل قيمة ناتجة من المدة نفسها وقاعدة مختلفة.':s.inside?'يتقدم زمن الزيارة حتى حين تثبت اليد. الحركة داخل المنطقة لا تبدأ زيارة ثانية.':'الدخول إلى الهدف أثناء الضغط يبدأ حساب زيارة جديدة.'}</p>`;
    } else {
      pointer.innerHTML=dot(current,'#b67449');root.dataset.prDistance=String(round(s.distance)??'');root.dataset.prCapturedA=String(s.models[0].captured);root.dataset.prCapturedB=String(s.models[1].captured);
      values.innerHTML=`<div class="pr-visit"><strong>المسافة الخام: ${number(s.distance)} وحدة</strong><span>حد الالتقاط المشترك: ٤٠</span></div>`;
      compare.innerHTML=`<div class="pr-pair">${s.models.map((m,i)=>{const tr=m.lastTransition;return `<article><strong>${i?'ب · فك فوق ٩٠':'أ · فك فوق ٤٠'}</strong>${capturePlot(s,m)}<div class="pr-model ${m.captured?'is-captured':''}">${m.captured?'ملتقط عند المركز':'حر ويتبع المؤشر'}</div><div class="pr-quiet">${m.everCaptured?'سبق أن التقط في هذه الضغطة':'لم يلتقط في هذه الضغطة'}</div><div class="pr-quiet">آخر انتقال: ${tr?`${tr.to?'حر ← ملتقط':'ملتقط ← حر'} عند ${number(tr.time)} ملث`:'—'}</div><div class="pr-quiet">موضع العنصر: ${m.output?`(${number(m.output.x)}، ${number(m.output.y)})`:'—'}</div></article>`;}).join('')}</div><div class="pr-quiet">الحلقة البرتقالية: المؤشر الخام · المربع الأخضر: موضع العنصر بعد القيد.</div><p class="pr-take">${s.models[0].captured!==s.models[1].captured?'اختلفت النتيجتان عند المؤشر نفسه: الأول تجاوز حد فكه، والثاني يتذكر الالتقاط السابق ولم يتجاوز ٩٠.':'راقب ما يحدث داخل ٤٠، ثم عد إلى مسافة بين ٤٠ و٩٠ دون إفلات الزر.'}</p>`;
    }
    if(s.held&&wall-lastLive>400){lastLive=wall;emit('live',l.title,source==='guide'?'عرض تسجيل مضبوط بساعة واحدة.':'تُقرأ الضغطة المباشرة أثناء استمرارها.');}
  }
  function finalFeedback(cancelled=false){
    if(cancelled){emit('fail','انقطعت دورة الإدخال','توقفت القراءة وحُفظت آخر القيم؛ لم تُصنع إشارة إفلات.');return;}
    const s=model.snapshot();
    if(speed&&s.acceleration===null){emit('fail','انتهت الضغطة قبل اكتمال تقدير التسارع','حرّك المؤشر على مدى ٨٠ ملث على الأقل لتتوافر ثلاث عينات مؤقتة في نافذة القياس.');return;}
    if(timed&&s.visits===0){emit('fail','لم تبدأ زيارة الهدف','ادخل المنطقة الملوّنة أثناء استمرار الضغط كي تعمل قواعد الزمن.');return;}
    if(speed)emit('done',source==='guide'?'سرعة متساوية وتسارع مختلف في اللحظة المرجعية':'حُفظت قراءة الحركة الأفقية',source==='guide'?'تسجيلان مستقلان؛ عند ثانية واحدة بلغت السرعة ٢٠٠، والتسارع +١٢٠ أو −١٢٠.':`السرعة ${signed(s.velocity)} وحدة/ث، والتسارع ${signed(s.acceleration)} وحدة/ث².`);
    else if(timed)emit('done','انتهت الزيارة وتوقف الزمن',`مدة الزيارة الأخيرة ${number(s.dwell)} ملث: ${number(s.once)} مرة أولى، ${number(s.repeated)} تكرارًا، ${number(s.continuous)} وحدة متراكمة.`);
    else emit('done','تجمّدت حالتا الانجذاب عند الإفلات',`المسافة ${number(s.distance)}؛ النموذج أ ${s.models[0].captured?'ملتقط':'حر'}، وب ${s.models[1].captured?'ملتقط':'حر'}.`);
  }
  function reset(silent=false){stopFrames();releaseCapture();model.clear();second?.clear();current=null;source='mouse';paint(true);if(!silent)emit('ready',labels[id].ready);}
  function interrupt(){if(pointerId===null&&!(source==='guide'&&model.snapshot().held))return;const t=source==='guide'?model.snapshot().duration:elapsed();model.finish(t,true);second?.finish(t,true);stopFrames();releaseCapture();paint(true);finalFeedback(true);}
  on(board,'pointerdown',event=>{
    if(destroyed||pointerId!==null||event.button!==0||event.isPrimary===false||(event.pointerType&&event.pointerType!=='mouse')||event.buttons!==1)return;
    const p=localPoint(board,event);if(!p)return;event.preventDefault();reset(true);startClock=performance.now();pointerId=event.pointerId;
    try{board.setPointerCapture(pointerId);}catch{}begin(p,0);paint(true);const token=version;
    function tick(){if(destroyed||pointerId===null||version!==token)return;model.advance(elapsed());paint();raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
  });
  on(board,'pointermove',event=>{if(event.pointerId!==pointerId||pointerId===null)return;if(event.buttons!==1){interrupt();return;}const p=localPoint(board,event);if(p){sample(p,elapsed());paint();}});
  on(window,'pointerup',event=>{if(event.pointerId!==pointerId||pointerId===null||event.button!==0)return;const p=localPoint(board,event),t=elapsed();if(p)sample(p,t);model.finish(t);stopFrames();releaseCapture();paint(true);finalFeedback();});
  on(board,'pointercancel',event=>{if(event.pointerId===pointerId)interrupt();});
  on(board,'lostpointercapture',event=>{if(event.pointerId===pointerId)interrupt();});
  on(window,'blur',interrupt);on(document,'visibilitychange',()=>{if(document.hidden)interrupt();});
  function play(){
    if(destroyed)return Promise.resolve(false);reset(true);source='guide';const traces=speed?speedComparisonTraces:timed?[timeTrace]:[magnetTrace];const trace=traces[0],end=trace.at(-1).t;
    begin(trace[0],0);if(speed)second.begin(traces[1][0],0);let i=1,start=null;const token=version;paint(true);
    return new Promise(resolve=>{settle=resolve;function tick(wall){
      if(destroyed||version!==token)return;if(start===null)start=wall;const t=Math.min(end,Math.max(0,wall-start));
      while(i<trace.length&&trace[i].t<=t){sample(trace[i],trace[i].t);if(speed)second.sample(traces[1][i],traces[1][i].t);i++;}
      if(t>=end){model.finish(end);second?.finish(end);settle=null;raf=0;paint(true);finalFeedback();resolve(true);return;}
      paint();raf=requestAnimationFrame(tick);
    }raf=requestAnimationFrame(tick);});
  }
  on(q('[data-pr-play]'),'click',play);on(q('[data-pr-reset]'),'click',()=>reset());reset();
  return {play,reset:()=>reset(),destroy(){if(destroyed)return;destroyed=true;stopFrames();releaseCapture();controller.abort();}};
}
