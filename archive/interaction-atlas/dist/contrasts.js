const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const fmt=(v,d=0)=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:d}).format(v);
const clone=value=>JSON.parse(JSON.stringify(value));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lineLength=points=>points.slice(1).reduce((sum,p,i)=>sum+dist(points[i],p),0);
const specs={
 'compare-constraint':{fixed:'إحداثيات اليد نفسها',variable:'حرية الحركة أو الالتقاط للشبكة',a:'حركة حرة',b:'التقاط كل ٢٠ وحدة',hint:'حرّك المقبض في الاتجاهين. قارن الإحداثيات الدقيقة.'},
 'compare-commit':{fixed:'قيمة السحب نفسها',variable:'لحظة تغيير القيمة الفعلية',a:'تعديل فوري',b:'معاينة ثم اعتماد',hint:'حرّك المدخل وأبق الزر مضغوطًا. قارن القيمة المعتمدة بالمعاينة، ثم أفلت.'},
 'compare-threshold':{fixed:'القيمة والعتبة ٨٠٪',variable:'العبور أو شرط الإفلات',a:'حدث عند عبور ٨٠٪',b:'شرط عند الإفلات',hint:'تجاوز ٨٠٪ ثم ارجع إلى ٤٠٪ قبل الإفلات.'},
 'compare-rate':{fixed:'إزاحة اليد عن المركز',variable:'موضع مباشر أو سرعة مع الزمن',a:'اليد تحدّد الموضع',b:'اليد تحدّد السرعة',hint:'اسحب بعيدًا عن المركز وابقَ ثابتًا لحظات.'},
 'compare-path':{fixed:'نقطة البداية والنهاية',variable:'قراءة النهاية أو المسار كله',a:'نقرأ نقطة النهاية',b:'نقرأ المسار كاملًا',hint:'ارسم من البداية إلى الوجهة؛ جرّب خطًا مباشرًا ثم التفافًا.'}
};

export function mountContrasts(id,container,api){
 const spec=specs[id];if(!spec)throw new Error(`Unknown contrast ${id}`);
 const ac=new AbortController(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const on=(el,event,fn,opts={})=>el.addEventListener(event,fn,{...opts,signal:ac.signal});
 let destroyed=false,raf=0,inFrame=false,playback=null,activePointer=null,keyboard=false,mode,previousMessage='';
 const say=(kind,text,detail='')=>{const signature=kind+'|'+text+'|'+detail;if(!destroyed&&signature!==previousMessage){previousMessage=signature;api[kind]?.(text,detail);}};
 container.innerHTML=`<section class="ctr-root" data-contrast="${id}"><div class="ctr-factors"><span><b>الثابت</b> ${spec.fixed}</span><span><b>المتغيّر</b> ${spec.variable}</span></div><div class="ctr-scenes"><article class="ctr-card"><h3><i>أ</i>${spec.a}</h3><svg class="ctr-scene" viewBox="0 0 320 145" data-ctr-scene="a" aria-label="${spec.a}" role="img"></svg><output class="ctr-output" data-ctr-output="a"></output></article><article class="ctr-card"><h3><i>ب</i>${spec.b}</h3><svg class="ctr-scene" viewBox="0 0 320 145" data-ctr-scene="b" aria-label="${spec.b}" role="img"></svg><output class="ctr-output" data-ctr-output="b"></output></article></div><div class="ctr-shared-heading"><strong>مدخل واحد للمشهدين</strong><span data-ctr-input-output></span></div><svg class="ctr-input" role="group" aria-label="المقبض المشترك للمقارنة"></svg><p class="ctr-observation" data-ctr-observation>${spec.hint}</p><div class="ctr-controls"><button type="button" data-ctr-play>شاهد المقارنة</button>${id==='compare-path'?'<button type="button" data-ctr-route="straight">مسار مباشر</button><button type="button" data-ctr-route="detour">مسار ملتف</button>':''}<button type="button" data-ctr-reset>إعادة الضبط</button></div><details class="ctr-help"><summary>التحكم بلوحة المفاتيح</summary><p>ركّز المقبض بمفتاح Tab، ثم استخدم الأسهم. اضغط Enter للإفلات وEscape للإلغاء. أزرار الأمثلة تعمل أيضًا بلوحة المفاتيح.</p></details></section>`;
 const root=container.querySelector('.ctr-root'),input=root.querySelector('.ctr-input');
 const q=s=>root.querySelector(s),sceneA=q('[data-ctr-scene="a"]'),sceneB=q('[data-ctr-scene="b"]');
 let width=600,height=id==='compare-path'?150:id==='compare-constraint'?112:88,inputHandle,inputTrail,inputTarget,inputAxis;
 const is2d=id==='compare-constraint'||id==='compare-path';
 const toScreen=p=>({x:28+p.x/100*(width-56),y:is2d?24+p.y/100*(height-48):height*.42});
 const fromEvent=event=>{const r=input.getBoundingClientRect();return{x:clamp(((event.clientX-r.left)/r.width*width-28)/(width-56)*100),y:is2d?clamp(((event.clientY-r.top)/r.height*height-24)/(height-48)*100):50};};
 const cardPoint=p=>({x:24+p.x*2.72,y:22+p.y*1.01});
 const cardPolyline=points=>points.map(p=>{const s=cardPoint(p);return `${s.x.toFixed(2)},${s.y.toFixed(2)}`;}).join(' ');
 const cardBase=(grid=false)=>`<rect x="10" y="8" width="300" height="128" rx="12" fill="#f5f7ef" stroke="#dbe4d3"/>${grid?[0,20,40,60,80,100].map(n=>`<path d="M${24+n*2.72} 22v101M24 ${22+n*1.01}h272" stroke="#d8e3ce" stroke-width="1"/>`).join(''):''}`;
 const actor=(p,color='#166353',ghost=false)=>{const s=cardPoint(p);return`<rect x="${s.x-13}" y="${s.y-12}" width="26" height="24" rx="7" fill="${ghost?'none':color}" stroke="${ghost?color:'#fffdf7'}" stroke-width="${ghost?2:3}" ${ghost?'stroke-dasharray="4 3"':''}/>${ghost?'':`<path d="M${s.x-5} ${s.y}h10" stroke="#d7e5cb" stroke-width="2" stroke-linecap="round"/>`}`;};
 function inputMarkup(){
  const p80=toScreen({x:80,y:50}),center=toScreen({x:50,y:50});
  input.setAttribute('viewBox',`0 0 ${width} ${height}`);
  input.innerHTML=`<rect x="5" y="5" width="${width-10}" height="${height-10}" rx="12" fill="#eef3e7" stroke="#dce5d3"/>${is2d?[20,40,60,80].map(n=>{const s=toScreen({x:n,y:n});return`<path d="M${s.x} 17v${height-34}M17 ${s.y}h${width-34}" stroke="#dee7d5" stroke-width="1"/>`;}).join(''):`<path d="M28 ${center.y}H${width-28}" stroke="#bbcdb0" stroke-width="5" stroke-linecap="round"/><path d="M${center.x} ${center.y-12}v24" stroke="#8fa780" stroke-width="1.5"/>${[0,50,100].map(n=>{const s=toScreen({x:n,y:50});return`<text x="${s.x}" y="${height-13}" text-anchor="middle" class="ctr-svg-label">${fmt(n)}${id==='compare-threshold'?'٪':''}</text>`;}).join('')}`}${id==='compare-threshold'?`<path d="M${p80.x} 13v42" stroke="#d38352" stroke-width="2" stroke-dasharray="4 3"/><text x="${p80.x}" y="${height-13}" text-anchor="middle" class="ctr-svg-label ctr-orange">٨٠</text>`:''}<polyline data-ctr-input-trail fill="none" stroke="#739b66" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><g data-ctr-target></g><g data-ctr-handle role="button" tabindex="0" aria-label="المقبض المشترك؛ الأسهم للحركة وEnter للإفلات"><circle r="26" fill="transparent"/><circle r="15" fill="#166353" stroke="#fffdf7" stroke-width="3"/><path d="M-5-3h10M-5 3h10" stroke="#dce9d2" stroke-width="1.6" stroke-linecap="round"/></g><g data-ctr-demo-pointer visibility="hidden" aria-hidden="true"><circle r="19" fill="#d38352" opacity=".18"/><path d="M-4-9v22l6-6 7 1Z" fill="#fffaf0" stroke="#b07848" stroke-width="1.5"/></g>`;
  inputHandle=q('[data-ctr-handle]');inputTrail=q('[data-ctr-input-trail]');inputTarget=q('[data-ctr-target]');inputAxis=q('[data-ctr-demo-pointer]');
 }
 function paintInput(p,trail=[]){const s=toScreen(p);inputHandle.setAttribute('transform',`translate(${s.x} ${s.y})`);inputHandle.setAttribute('aria-valuetext',is2d?`س ${fmt(p.x,1)} ص ${fmt(p.y,1)}`:fmt(p.x,1));inputTrail.setAttribute('points',trail.map(p=>{const a=toScreen(p);return`${a.x},${a.y}`;}).join(' '));q('[data-ctr-input-output]').textContent=is2d?`س ${fmt(p.x,1)} · ص ${fmt(p.y,1)}`:`${fmt(p.x,1)}${id==='compare-threshold'?'٪':''}`;}
 function hand(p,visible=true){const s=toScreen(p);inputAxis.setAttribute('visibility',visible?'visible':'hidden');inputAxis.setAttribute('transform',`translate(${s.x+5} ${s.y+8})`);}
 const output=(side,text)=>q(`[data-ctr-output="${side}"]`).textContent=text;
 const observe=text=>q('[data-ctr-observation]').textContent=text;
 function ensureFrame(){if(destroyed||raf||inFrame)return;raf=requestAnimationFrame(frame);}
 function frame(now){raf=0;if(destroyed)return;inFrame=true;if(playback){const job=playback;job.step(now-job.started,now);if(playback===job&&now-job.started>=job.duration){playback=null;hand(mode.input(),false);}}const running=!playback&&(mode.tick?.(now)||false);inFrame=false;if(!destroyed&&!raf&&(playback||running))raf=requestAnimationFrame(frame);}
 function releaseCapture(){if(activePointer!==null){try{if(input.hasPointerCapture(activePointer))input.releasePointerCapture(activePointer);}catch{}}}
 function cancelActive(silent=false){if(activePointer===null&&!keyboard)return;releaseCapture();activePointer=null;keyboard=false;mode.cancel(silent);}
 function stopPlayback(restore=true){if(!playback)return;playback=null;hand(mode.input(),false);if(restore)mode.cancel(true);}
 function reset(){stopPlayback();cancelActive(true);mode.reset();previousMessage='';say('ready',spec.hint,'الثابت: '+spec.fixed+' · المتغيّر: '+spec.variable);}
 function run(duration,step){stopPlayback();cancelActive(true);mode.reset();playback={duration,step,started:performance.now()};ensureFrame();}
 // Autoplay samples its declared input path, independent of how often the screen renders.
 function scripted(keyframes,duration,end,options={}){
  let cursor=-1,started=false,lastPaint=-Infinity;const samples=[];
  for(let i=1;i<keyframes.length;i++){const a=keyframes[i-1],b=keyframes[i],count=Math.max(1,Math.ceil((b.t-a.t)/25));for(let j=i===1?0:1;j<=count;j++){const f=j/count;samples.push({t:a.t+(b.t-a.t)*f,p:{x:a.p.x+(b.p.x-a.p.x)*f,y:a.p.y+(b.p.y-a.p.y)*f}});}}
  run(duration,(elapsed,now)=>{const origin=now-elapsed;if(!started){started=true;mode.start(keyframes[0].p,origin+keyframes[0].t);}let changed=false;while(cursor+1<samples.length&&samples[cursor+1].t<=elapsed){cursor++;mode.move(samples[cursor].p,origin+samples[cursor].t,true);changed=true;}if(changed&&(!reduced||elapsed-lastPaint>=600)){mode.paint();lastPaint=elapsed;}if(!reduced&&cursor>=0&&!options.finished)hand(samples[cursor].p);if(elapsed>=keyframes.at(-1).t&&!options.finished){options.finished=true;mode.release(keyframes.at(-1).p,origin+keyframes.at(-1).t);hand(mode.input(),false);end?.();}});
 }

 function constraint(){
  let p={x:34,y:52},before=null;
  const snapped=()=>({x:Math.round(p.x/20)*20,y:Math.round(p.y/20)*20});
  function paint(){const s=snapped();sceneA.innerHTML=cardBase(true)+actor(p);sceneB.innerHTML=cardBase(true)+actor(s,'#517b46');output('a',`س ${fmt(p.x,1)} · ص ${fmt(p.y,1)}`);output('b',`س ${fmt(s.x)} · ص ${fmt(s.y)}`);paintInput(p);observe(`القيمة نفسها (${fmt(p.x,1)}، ${fmt(p.y,1)}) تُقرب في المشهد ب إلى (${fmt(s.x)}، ${fmt(s.y)}).`);}
  function start(){before=clone(p);}
  function move(next,_now,quiet=false){p={x:clamp(next.x),y:clamp(next.y)};if(!quiet){paint();say('live','إحداثيات مشتركة؛ مخرجان مختلفان.','المشهد أ حر، والمشهد ب يلتقط لأقرب تقاطع من الشبكة.');}}
  function release(next,now){move(next,now);before=null;say('done','ظهرت نتيجة القيدين من المدخل نفسه.',`حر: ${fmt(p.x,1)}، ${fmt(p.y,1)} · شبكة: ${fmt(snapped().x)}، ${fmt(snapped().y)}.`);}
  function cancel(silent=false){if(!before)return;p=before;before=null;paint();if(!silent)say('ready','أُلغي السحب وعاد المشهدان إلى البداية.');}
  function reset(){p={x:34,y:52};before=null;paint();}
  function play(){scripted([{t:300,p:{x:34,y:52}},{t:1500,p:{x:77,y:23}},{t:2800,p:{x:53,y:67}}],3300);}
  reset();return{input:()=>p,start,move,release,cancel,reset,paint,play};
 }
 function commit(){
  let value=30,immediate=30,committed=30,pending=false;
  function paint(){sceneA.innerHTML=cardBase()+actor({x:immediate,y:50});sceneB.innerHTML=cardBase()+actor({x:committed,y:50})+(pending?actor({x:value,y:50},'#d38352',true):'');output('a',`القيمة الفعلية: ${fmt(immediate,1)}`);output('b',`المعتمدة: ${fmt(committed,1)}${pending?' · المعاينة: '+fmt(value,1):''}`);paintInput({x:value,y:50});observe(pending?'أ تغيّر بالفعل. ب ما زال يحتفظ بالقيمة السابقة ويعرض إطار المعاينة.':'الإطار البرتقالي معاينة؛ المربع الممتلئ هو القيمة الفعلية.');}
  function start(){pending=true;}
  function move(p,_now,quiet=false){value=clamp(p.x);immediate=value;if(!quiet){paint();say('live','اليسار تغيّر فعليًا؛ اليمين يعرض معاينة.','أبق الزر مضغوطًا لترى الفرق؛ عند الإفلات تُعتمد قيمة الجانب المؤجل.');}}
  function release(p,now){move(p,now,true);committed=value;pending=false;paint();say('done','اعتُمدت المعاينة عند الإفلات.',`أ وب أصبحا ${fmt(value,1)}؛ لكن أ تغيّر أثناء الحركة وب عند الإفلات.`);}
  function cancel(silent=false){if(!pending)return;pending=false;paint();observe(`أ بقي ${fmt(immediate,1)} لأنه عُدّل فورًا. أُلغيت معاينة ب وبقي معتمدًا عند ${fmt(committed,1)}.`);if(!silent)say('ready','أُلغيت المعاينة وحدها؛ التعديل الفوري باقٍ.',`اليسار: ${fmt(immediate,1)} · اليمين: ${fmt(committed,1)}.`);}
  function reset(){value=immediate=committed=30;pending=false;paint();}
  function play(){scripted([{t:300,p:{x:30,y:50}},{t:1600,p:{x:78,y:50}},{t:2600,p:{x:78,y:50}}],3200);}
  reset();return{input:()=>({x:value,y:50}),start,move,release,cancel,reset,paint,play};
 }
 function threshold(){
  let value=20,latched=false,releasedResult=null,pending=false,before=20;
  const indicator=(on)=>`<circle cx="160" cy="72" r="34" fill="${on?'#dcebd4':'#e8ece1'}" stroke="${on?'#7eab6b':'#c5d0ba'}" stroke-width="2"/><path d="${on?'m144 72 11 11 22-25':'M147 72h26'}" stroke="${on?'#387549':'#9dab91'}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  function paint(){sceneA.innerHTML=cardBase()+indicator(latched,latched?'وقع الحدث':'لم يقع الحدث');sceneB.innerHTML=cardBase()+indicator(releasedResult===true,pending?'بانتظار الإفلات':releasedResult===null?'لم تُفلت بعد':releasedResult?'الشرط متحقق':'الشرط غير متحقق');output('a',latched?'حدث ثابت حتى إعادة الضبط':'العبور من أقل من ٨٠ إلى ٨٠ أو أكثر');output('b',releasedResult===null?'لم يُختبر بعد':`آخر إفلات: ${releasedResult?'نجاح':'لم يتحقق'}`);paintInput({x:value,y:50});observe(latched&&pending?'وقع حدث العبور. الرجوع تحت العتبة لا يمحو هذا الحدث.':spec.hint);}
  function start(){pending=true;before=value;}
  function move(p,_now,quiet=false){const previous=value;value=clamp(p.x);if(previous<80&&value>=80)latched=true;if(!quiet){paint();say('live',latched?'وقع حدث العبور وبقي مسجلًا.':'لم تعبر العتبة بعد.','شرط المشهد ب ينتظر قيمة الإفلات.');}}
  function release(p,now){move(p,now,true);pending=false;releasedResult=value>=80;paint();observe(`عند الإفلات ${fmt(value)}٪: حدث العبور ${latched?'وقع':'لم يقع'}، وشرط الإفلات ${releasedResult?'تحقق':'لم يتحقق'}.`);say('done','اختُبرت قيمة الإفلات مستقلةً عن حدث العبور.',`حدث العبور: ${latched?'وقع':'لم يقع'} · شرط الإفلات: ${releasedResult?'تحقق':'لم يتحقق'}.`);}
  function cancel(silent=false){if(!pending)return;value=before;pending=false;paint();observe('أُلغي الإفلات. أي حدث عبور وقع يبقى ثابتًا حتى إعادة الضبط.');if(!silent)say('ready','أُلغي الإفلات دون محو حدث العبور.',latched?'الحدث المسجّل ما زال ظاهرًا في أ.':'لم يقع حدث عبور.');}
  function reset(){value=20;latched=false;releasedResult=null;pending=false;paint();}
  function play(){scripted([{t:250,p:{x:20,y:50}},{t:1350,p:{x:95,y:50}},{t:1750,p:{x:95,y:50}},{t:2850,p:{x:40,y:50}}],3400);}
  reset();return{input:()=>({x:value,y:50}),start,move,release,cancel,reset,paint,play};
 }
 function rate(){
  let handValue=50,position=50,lastTime=0,before=null,active=false,duration=0;
  const speed=()=>((handValue-50)/50)*30;
  function integrate(now){if(!active){lastTime=now;return;}const dt=Math.max(0,(now-lastTime)/1000);position=clamp(position+speed()*dt);if(Math.abs(speed())>.01)duration+=dt;lastTime=now;}
  function paint(){sceneA.innerHTML=cardBase()+`<path d="M24 72.5h272" stroke="#cfdbc6" stroke-width="2"/>`+actor({x:handValue,y:50});sceneB.innerHTML=cardBase()+`<path d="M24 72.5h272" stroke="#cfdbc6" stroke-width="2"/>`+actor({x:position,y:50},'#537c49');output('a',`الموضع: ${fmt(handValue,1)}`);output('b',`الموضع: ${fmt(position,1)} · السرعة: ${fmt(speed(),1)}/ث`);paintInput({x:handValue,y:50});observe(active?`المدخل ${fmt(handValue,1)}؛ الزمن خارج المركز ${fmt(duration,1)} ث. أ يتبع الموضع، وب ${Math.abs(speed())<.01?'ثابت لأن السرعة صفر':position===0||position===100?'وصل إلى حدّه':'يتحرك مع مرور الوقت'}.`:`المدخل في المركز: أ عند ٥٠، وب احتفظ بموضعه ${fmt(position,1)} وتوقف.`);}
  function start(_p,now){before={handValue,position,duration};active=true;lastTime=now;}
  function move(p,now,quiet=false){integrate(now);handValue=clamp(p.x);if(!quiet){paint();say('live','اليد تحدّد الموضع في أ والسرعة في ب.',`السرعة في ب: ${fmt(speed(),1)} وحدة/ث.`);}if(active&&Math.abs(speed())>0)ensureFrame();}
  function release(p,now){move(p,now,true);active=false;before=null;handValue=50;paint();say('done','عاد المدخل للمركز؛ توقفت السرعة وبقي الموضع المتراكم.',`أ: ٥٠ · ب: ${fmt(position,1)} · كلاهما ضمن ٠–١٠٠.`);}
  function cancel(silent=false){if(!before)return;({handValue,position,duration}=before);before=null;active=false;paint();if(!silent)say('ready','أُلغي السحب وعادت لقطة البداية للمشهدين.');}
  function reset(){handValue=position=50;duration=0;active=false;before=null;lastTime=performance.now();paint();}
  function tick(now){if(!active||Math.abs(speed())<.01)return false;integrate(now);paint();return true;}
  function play(){scripted([{t:250,p:{x:50,y:50}},{t:850,p:{x:80,y:50}},{t:2850,p:{x:80,y:50}}],3450);}
  reset();return{input:()=>({x:handValue,y:50}),start,move,release,cancel,reset,paint,play,tick};
 }
 function path(){
  const startPoint={x:12,y:50},endPoint={x:88,y:50};
  let points=[clone(startPoint)],saved=[clone(startPoint)],pending=false,inputPoint=clone(startPoint),histories=[];
  function reached(){return dist(points.at(-1),endPoint)<=8;}
  function paint(){const last=points.at(-1),a=cardPoint(startPoint),b=cardPoint(endPoint);const endpoints=`<circle cx="${a.x}" cy="${a.y}" r="8" fill="#166353"/><circle cx="${b.x}" cy="${b.y}" r="11" fill="#f2e5d2" stroke="#c79359" stroke-width="2"/>`;sceneA.innerHTML=cardBase()+endpoints+actor(last);sceneB.innerHTML=cardBase()+endpoints+`<polyline points="${cardPolyline(points)}" fill="none" stroke="#528459" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`+actor(last);output('a',`النهاية: (${fmt(last.x,1)}، ${fmt(last.y,1)})`);output('b',`طول المسار: ${fmt(lineLength(points),1)} وحدة`);paintInput(inputPoint,points);const target=toScreen(endPoint),start=toScreen(startPoint);inputTarget.innerHTML=`<circle cx="${target.x}" cy="${target.y}" r="20" fill="#f5e8d6" stroke="#c79359" stroke-width="2"/><circle cx="${target.x}" cy="${target.y}" r="6" fill="#c79359"/><circle cx="${start.x}" cy="${start.y}" r="19" fill="none" stroke="#8eab7e" stroke-width="1.5" stroke-dasharray="3 4"/>`;observe(histories.length>1?`نهاية واحدة (٨٨، ٥٠)؛ آخر طولين: ${fmt(histories.at(-2),1)} و${fmt(histories.at(-1),1)} وحدة.`:pending?'المشهد أ يقرأ آخر نقطة؛ ب يجمع أطوال مقاطع الخط المرسوم فعلًا.':spec.hint);}
  function start(){saved=clone(points);points=[clone(startPoint)];inputPoint=clone(startPoint);pending=true;}
  function move(p,_now,quiet=false){if(!pending)return;const next={x:clamp(p.x),y:clamp(p.y)};if(dist(next,points.at(-1))>.05)points.push(next);inputPoint=next;if(!quiet){paint();say('live','النهاية وحدها لا تحدّد طول الطريق.',`الطول الحالي من مقاطع المسار: ${fmt(lineLength(points),1)} وحدة.`);}}
  function release(p,now){move(p,now,true);if(!reached()){points=saved;inputPoint=clone(startPoint);pending=false;paint();say('fail','لم يصل المسار إلى دائرة الوجهة.','بقي آخر مسار معتمد. ابدأ من الدائرة الخضراء وحاول مجددًا.');return;}if(dist(points.at(-1),endPoint)>.001)points.push(clone(endPoint));pending=false;inputPoint=clone(startPoint);saved=clone(points);histories.push(lineLength(points));paint();say('done','وصلت إلى النهاية نفسها عبر مسار مقاس فعلًا.',`النهاية (٨٨، ٥٠) · طول المسار ${fmt(lineLength(points),1)} وحدة.`);}
  function cancel(silent=false){if(!pending)return;points=saved;pending=false;inputPoint=clone(startPoint);paint();if(!silent)say('ready','أُلغي الرسم وبقي آخر مسار معتمد.');}
  function reset(){points=[clone(startPoint)];saved=clone(points);inputPoint=clone(startPoint);histories=[];pending=false;paint();}
  function samplesFor(route){const sequence=[];let length=0;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],segment=dist(a,b),count=Math.ceil(segment);for(let j=i===1?0:1;j<=count;j++){const f=j/count;sequence.push({s:length+segment*f,p:{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}});}length+=segment;}return sequence.map(x=>({...x,t:x.s/length}));}
  function play(kind='both'){
   const direct=[startPoint,endPoint],detour=[startPoint,{x:30,y:15},{x:68,y:15},endPoint];
   const runs=kind==='both'?[{route:direct,start:300,end:1550},{route:detour,start:2350,end:4400}]:[{route:kind==='straight'?direct:detour,start:300,end:2700}];
   runs.forEach(r=>{r.samples=samplesFor(r.route);r.index=-1;r.started=false;r.finished=false;});
   run(kind==='both'?4850:3200,(elapsed,now)=>{const origin=now-elapsed;for(const r of runs){if(elapsed<r.start||r.finished)continue;if(!r.started){r.started=true;start();}const progress=clamp((elapsed-r.start)/(r.end-r.start),0,1);while(r.index+1<r.samples.length&&r.samples[r.index+1].t<=progress){r.index++;move(r.samples[r.index].p,origin+r.start+(r.end-r.start)*r.samples[r.index].t,true);}if(!reduced)paint();if(!reduced)hand(inputPoint);if(elapsed>=r.end){release(endPoint,origin+r.end);r.finished=true;hand(inputPoint,false);}}});
  }
  reset();return{input:()=>inputPoint,start,move,release,cancel,reset,paint,play};
 }
 function measure(){const r=input.getBoundingClientRect(),nextWidth=Math.max(270,r.width||600);if(Math.abs(nextWidth-width)>.5){stopPlayback();cancelActive(true);width=nextWidth;inputMarkup();mode?.paint();}}
 inputMarkup();measure();
 mode=id==='compare-constraint'?constraint():id==='compare-commit'?commit():id==='compare-threshold'?threshold():id==='compare-rate'?rate():path();
 on(input,'pointerdown',event=>{if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0)||!event.target.closest('[data-ctr-handle]'))return;event.preventDefault();stopPlayback();cancelActive(true);activePointer=event.pointerId;try{input.setPointerCapture(event.pointerId);}catch{}mode.start(mode.input(),performance.now());});
 on(window,'pointermove',event=>{if(activePointer!==event.pointerId)return;event.preventDefault();mode.move(fromEvent(event),performance.now());},{passive:false});
 on(window,'pointerup',event=>{if(activePointer!==event.pointerId)return;releaseCapture();activePointer=null;mode.release(fromEvent(event),performance.now());});
 on(window,'pointercancel',event=>{if(activePointer===event.pointerId)cancelActive();});
 on(window,'keydown',event=>{const focused=event.target.closest?.('[data-ctr-handle]');if(event.key==='Escape'&&(activePointer!==null||keyboard||playback)){event.preventDefault();cancelActive();if(playback){stopPlayback();say('ready','توقّف العرض. بقيت الحالة حسب قاعدة هذه المقارنة.');}return;}if(!focused&&!keyboard)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();stopPlayback();if(keyboard){mode.release(mode.input(),performance.now());keyboard=false;}else{mode.start(mode.input(),performance.now());keyboard=true;}return;}const delta={ArrowRight:[5,0],ArrowLeft:[-5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[event.key];if(!delta)return;event.preventDefault();stopPlayback();if(!keyboard){mode.start(mode.input(),performance.now());keyboard=true;}const p=mode.input();mode.move({x:clamp(p.x+delta[0]),y:clamp(p.y+(is2d?delta[1]:0))},performance.now());});
 const pause=()=>{cancelActive();if(playback){stopPlayback();say('ready','توقّف العرض عند مغادرة الصفحة.');}};
 on(window,'blur',pause);on(document,'visibilitychange',()=>{if(document.hidden)pause();});
 on(root,'click',event=>{if(event.target.closest('[data-ctr-reset]'))reset();else if(event.target.closest('[data-ctr-play]'))mode.play();else{const button=event.target.closest('[data-ctr-route]');if(button)mode.play(button.dataset.ctrRoute);}});
 const observer=new ResizeObserver(measure);observer.observe(input);
 return{play(){mode.play();},destroy(){if(destroyed)return;destroyed=true;stopPlayback();cancelActive(true);if(raf)cancelAnimationFrame(raf);raf=0;ac.abort();observer.disconnect();}};
}
