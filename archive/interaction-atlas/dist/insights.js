import { mountConsequences } from './consequences.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const bowl='<ellipse cx="0" cy="4" rx="31" ry="8" fill="#294d3a" opacity=".12"/><path d="M-32-15H32Q28 13 0 14T-32-15" fill="#f2e2bc" stroke="#ad976e" stroke-width="2"/><ellipse cx="0" cy="-15" rx="32" ry="10" fill="#c4a45e" stroke="#ad976e" stroke-width="2"/><g fill="#e8c782"><circle cx="-17" cy="-17" r="6"/><circle cx="-5" cy="-20" r="6"/><circle cx="9" cy="-18" r="6"/><circle cx="21" cy="-15" r="5"/><circle cx="-5" cy="-10" r="6"/><circle cx="10" cy="-9" r="5"/></g><path d="M-13-21l5 6M4-21l3 7" stroke="#7b965d" stroke-width="2"/>';

function mountSignals(container,api){
 const ac=new AbortController();const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:ac.signal});
 let value=35,before=35,dragging=false,frame=0,demonstrating=false,demoBefore=35,rangeCancelled=false;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 container.innerHTML=`<div class="ins-root" data-insight="signals">
 <div class="ins-input-heading"><span><i></i> حركة اليد المشتركة</span><output data-ins-value>35%</output></div>
 <div class="ins-shared-control" dir="ltr"><input class="ins-range" type="range" min="0" max="100" step="1" value="35" aria-label="المسافة المشتركة للمقارنة"><span class="ins-demo-pointer" hidden aria-hidden="true"><svg viewBox="0 0 24 27"><path d="M3 2v20l6-6 5 9 5-3-5-9h8Z" fill="#d38352" stroke="white" stroke-width="1.8"/></svg></span></div>
 <div class="ins-branches" aria-hidden="true"><svg viewBox="0 0 900 27" preserveAspectRatio="none"><path d="M450 0v10H150v15M450 10H750v15M450 10v15" fill="none" stroke="#c3d1bb" stroke-width="1.5"/><circle cx="150" cy="25" r="2" fill="#92aa83"/><circle cx="450" cy="25" r="2" fill="#92aa83"/><circle cx="750" cy="25" r="2" fill="#92aa83"/></svg></div>
 <div class="ins-cards">
 <article class="ins-card"><div class="ins-card-title"><span>01</span><h3>نقرأها كموضع</h3></div><svg class="ins-card-scene" viewBox="0 0 260 157" role="img" aria-label="وعاء يتحرّك أفقيًا"><rect x="17" y="33" width="226" height="89" rx="9" fill="#e9e5d5"/><path d="M25 60H235M25 88H235" stroke="#d8d4c0" stroke-width="1"/><path d="M45 125H215" stroke="#b2bfa4" stroke-width="2" stroke-dasharray="4 6"/><path d="m208 120 7 5-7 5" fill="none" stroke="#9eb18f" stroke-width="2"/><g data-ins-moving transform="translate(105 90)">${bowl}</g></svg><div class="ins-card-result"><output data-ins-position>35%</output><span>موضع الوعاء</span></div></article>
 <article class="ins-card"><div class="ins-card-title"><span>02</span><h3>نقرأها كزاوية</h3></div><svg class="ins-card-scene" viewBox="0 0 260 157" role="img" aria-label="وعاء يتغير ميله"><circle cx="130" cy="89" r="53" fill="#edf1e4" stroke="#d3ddc5" stroke-dasharray="4 5"/><path d="M62 89H198M130 24V146" stroke="#d8e1ce" stroke-width="1"/><path d="M140 89h53" stroke="#c5b18d" stroke-dasharray="4 4"/><g data-ins-tilting transform="translate(130 89) rotate(26)">${bowl}<path d="M32-13h13" stroke="#b59a71" stroke-width="4" stroke-linecap="round"/></g><circle cx="130" cy="89" r="3" fill="#d38352"/></svg><div class="ins-card-result"><output data-ins-angle>26°</output><span>ميل الوعاء</span></div></article>
 <article class="ins-card"><div class="ins-card-title"><span>03</span><h3>نقرأها كوقت</h3></div><svg class="ins-card-scene" viewBox="0 0 260 157" role="img" aria-label="حالة محل في الوقت المختار"><rect data-ins-sky x="17" y="15" width="226" height="124" rx="9" fill="#e7eee0"/><circle data-ins-sun cx="204" cy="43" r="11" fill="#e7bd70"/><path data-ins-moon d="M208 31a13 13 0 1 0 12 19 13 13 0 0 1-12-19" fill="#f0e8c4" opacity="0"/><rect x="72" y="56" width="116" height="77" rx="4" fill="#e5d3b1"/><rect x="81" y="45" width="98" height="25" rx="3" fill="#466f55"/><rect x="66" y="72" width="128" height="17" rx="2" fill="#f7f0d8"/><path d="M75 72v17M99 72v17M123 72v17M147 72v17M171 72v17M189 72v17" stroke="#66876b" stroke-width="12"/><rect data-ins-window x="85" y="97" width="43" height="36" rx="2" fill="#a4b9a3"/><path d="M106 98v34M86 113h40" stroke="#eee8cf" stroke-width="3"/><rect x="142" y="97" width="31" height="36" rx="2" fill="#b09264"/><path d="M63 135H197" stroke="#b7b99d" stroke-width="4" stroke-linecap="round"/></svg><div class="ins-card-result"><output data-ins-time>12:15</output><span>اللحظة المعروضة</span></div></article>
 </div>
 <div class="ins-reading"><span>المعلومة نفسها: <b>المسافة الأفقية</b></span><span aria-hidden="true">←</span><span>ثلاث قواعد مستقلة، وثلاث نتائج.</span></div>
 <details class="ins-help"><summary>ماذا يشرح هذا المثال؟</summary><p>نرسل حركة المؤشر نفسها إلى ثلاثة نماذج للمقارنة. كل نموذج يترجم القيمة إلى شيء مختلف. لتجربة الأسهم، ركّز المؤشر بمفتاح Tab.</p></details>
 </div>`;
 const range=container.querySelector('.ins-range'),pointer=container.querySelector('.ins-demo-pointer');
 const q=s=>container.querySelector(s);
 function draw(){
  const u=value/100,angle=Math.round(u*75),minutes=480+Math.round(u*720/15)*15,hour=Math.floor(minutes/60),minute=minutes%60;
  range.value=value;range.style.setProperty('--ins-percent',value+'%');range.setAttribute('aria-valuetext',`${value} بالمئة`);
  q('[data-ins-value]').textContent=value+'%';q('[data-ins-position]').textContent=value+'%';q('[data-ins-angle]').textContent=angle+'°';q('[data-ins-time]').textContent=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
  q('[data-ins-moving]').setAttribute('transform',`translate(${45+u*170} 88)`);q('[data-ins-tilting]').setAttribute('transform',`translate(130 89) rotate(${angle})`);
  const night=hour>=18; q('[data-ins-sky]').setAttribute('fill',night?'#344e55':hour>=16?'#e9dbc0':'#e7eee0');q('[data-ins-sun]').setAttribute('opacity',night?'0':'1');q('[data-ins-moon]').setAttribute('opacity',night?'1':'0');q('[data-ins-window]').setAttribute('fill',night?'#e6c47a':'#a4b9a3');
  pointer.style.left=`calc(14px + (100% - 28px) * ${u})`;
  container.querySelector('.ins-root').dataset.position=value;container.querySelector('.ins-root').dataset.angle=angle;container.querySelector('.ins-root').dataset.time=minutes;
 }
 function stop(){cancelAnimationFrame(frame);frame=0;demonstrating=false;pointer.hidden=true;}
 function report(method){api[method]('المسافة نفسها أعطت موضعًا وزاوية ووقتًا',`الموضع ${value}% · الميل ${q('[data-ins-angle]').textContent} · الوقت ${q('[data-ins-time]').textContent}`);}
 on(range,'pointerdown',event=>{if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;stop();before=value;dragging=true;rangeCancelled=false;});
 on(range,'input',()=>{if(rangeCancelled){range.value=value;return;}value=+range.value;draw();report('live');});
 on(range,'change',()=>{if(rangeCancelled){range.value=value;return;}value=+range.value;draw();dragging=false;report('done');});
 on(window,'pointerup',()=>{if(dragging){dragging=false;value=+range.value;draw();report('done');}});
 const rollback=()=>{if(!dragging)return;dragging=false;rangeCancelled=true;value=before;draw();api.ready('أُلغي السحب وعادت المقارنة إلى حالتها السابقة.');};
 on(range,'keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){stop();rangeCancelled=false;}});
 on(range,'pointercancel',rollback);on(window,'blur',()=>{rollback();if(demonstrating){stop();value=demoBefore;draw();api.ready('توقّف العرض التلقائي.');}});
 on(window,'keydown',e=>{if(e.key==='Escape'){rollback();if(demonstrating){stop();value=demoBefore;draw();api.ready('أُلغي العرض التلقائي.');}}});
 draw();
 function play(){stop();dragging=false;rangeCancelled=false;demoBefore=value;demonstrating=true;pointer.hidden=reduced;const start=performance.now(),duration=reduced?2500:3800;const points=[35,85,10,65];api.live('شاهد: نحرّك المؤشر مرة واحدة','راقب استجابة النماذج الثلاثة للحركة نفسها.');const tick=now=>{const p=clamp((now-start)/duration,0,1),section=Math.min(2,Math.floor(p*3)),t=clamp(p*3-section,0,1),e=t*t*(3-2*t);value=reduced?points[Math.min(3,Math.floor(p*4))]:Math.round(points[section]+(points[section+1]-points[section])*e);draw();if(p<1)frame=requestAnimationFrame(tick);else{demonstrating=false;pointer.hidden=true;report('done');}};frame=requestAnimationFrame(tick);}
 return {destroy(){stop();ac.abort();},play};
}
export function mountInsights(id,container,api){return id==='chain'?mountConsequences(container,api):mountSignals(container,api);}
