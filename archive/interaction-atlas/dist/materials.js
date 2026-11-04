const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const fmt = value => new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(value);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const set = (element,values) => { for(const [key,value] of Object.entries(values))element.setAttribute(key,value); };
const pathData = points => points.length ? points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') : '';
function svgPoint(svg,event){const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM().inverse());}
function segmentDistance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y;const fraction=dx||dy?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy),0,1):0;return Math.hypot(point.x-a.x-fraction*dx,point.y-a.y-fraction*dy);}
function sampledPath(points,count=64){
  if(points.length<2)return points;
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));
  const total=lengths.at(-1);if(!total)return Array.from({length:count},()=>({...points[0]}));
  const samples=[];let segment=1;
  for(let i=0;i<count;i++){const at=total*i/(count-1);while(segment<lengths.length-1&&lengths[segment]<at)segment++;const a=points[segment-1],b=points[segment],span=lengths[segment]-lengths[segment-1];const t=span?(at-lengths[segment-1])/span:0;samples.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  return samples;
}
function shell(container,caption,badge,scene,controls,cause,effect){
  container.innerHTML=`<section class="mat-root"><div class="mat-top"><span class="mat-caption">${caption}</span><span class="mat-badge">${badge}</span></div><svg class="mat-board" viewBox="0 0 900 300" role="group" aria-label="${caption}" tabindex="0">${scene}<g class="mat-demo-cursor" visibility="hidden"><circle r="17"/><path d="M-5-9 9 6 2 7 5 15 0 17-3 8-9 12Z"/></g></svg><div class="mat-controls">${controls}</div><div class="mat-causal"><span>نقرأ <strong>${cause}</strong></span><span class="mat-causal-arrow" aria-hidden="true">→</span><span>يحدث <strong>${effect}</strong></span></div></section>`;
  return{root:container.querySelector('.mat-root'),svg:container.querySelector('.mat-board'),badge:container.querySelector('.mat-badge')};
}
function runtime(svg,api){
  const controller=new AbortController();let active=null,destroyed=false,last='',frame=0,playback=0,pending=null;
  const cursor=svg.querySelector('.mat-demo-cursor');
  const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:controller.signal});
  const emit=(method,message,detail='')=>{const key=`${method}|${message}|${detail}`;if(!destroyed&&key!==last){last=key;api[method]?.(message,detail);}};
  const release=gesture=>{try{if(svg.hasPointerCapture(gesture.pointerId))svg.releasePointerCapture(gesture.pointerId);}catch{}};
  function cancelGesture(){if(!active)return;const current=active;active=null;release(current);current.cancel?.();}
  function stopPlayback(){playback++;if(frame)cancelAnimationFrame(frame);frame=0;if(pending){const step=pending;pending=null;step.callbacks.cancel?.();step.resolve(false);}cursor.setAttribute('visibility','hidden');}
  function stop(){cancelGesture();stopPlayback();}
  on(window,'pointermove',event=>{if(event.pointerId!==active?.pointerId)return;event.preventDefault();active.move?.(svgPoint(svg,event));},{passive:false});
  on(window,'pointerup',event=>{if(event.pointerId!==active?.pointerId)return;const current=active;active=null;release(current);current.end?.(svgPoint(svg,event));});
  on(window,'pointercancel',event=>{if(event.pointerId===active?.pointerId)cancelGesture();});
  on(svg,'lostpointercapture',()=>{if(active)cancelGesture();});
  on(window,'blur',stop);
  on(window,'keydown',event=>{if(event.key==='Escape'&&(active||pending)){event.preventDefault();stop();}});
  function begin(event,callbacks){if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;stop();event.preventDefault();active={...callbacks,pointerId:event.pointerId};callbacks.start?.(svgPoint(svg,event));try{svg.setPointerCapture(event.pointerId);}catch{}}
  function animate(step,token){
    return new Promise(resolve=>{
      if(token!==playback||destroyed){resolve(false);return;}
      const points=step.points,samples=sampledPath(points,180),duration=step.duration||2200;
      pending={callbacks:step,resolve};step.start?.(points[0]);cursor.setAttribute('visibility','visible');
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){for(const point of points)step.move?.(point);step.end?.(points.at(-1));pending=null;cursor.setAttribute('visibility','hidden');resolve(true);return;}
      let started=null,lastIndex=0;
      function tick(now){
        if(token!==playback||destroyed)return;
        if(started===null)started=now;
        const progress=clamp((now-started)/duration,0,1),index=Math.floor(progress*(samples.length-1));
        for(let i=lastIndex;i<=index;i++)step.move?.(samples[i]);lastIndex=index+1;
        const current=samples[index];cursor.setAttribute('transform',`translate(${current.x+14} ${current.y+17})`);
        if(progress<1){frame=requestAnimationFrame(tick);return;}
        frame=0;pending=null;step.end?.(points.at(-1));cursor.setAttribute('visibility','hidden');resolve(true);
      }
      frame=requestAnimationFrame(tick);
    });
  }
  async function playSteps(steps){stop();const token=playback;for(const step of steps){if(token!==playback||destroyed)return;const completed=await animate(step,token);if(!completed)return;}}
  return{on,emit,begin,stop,playSteps,destroy(){destroyed=true;stop();controller.abort();}};
}
function spongeArt(){return `<rect x="-39" y="-19" width="78" height="40" rx="12" fill="#678352"/><rect x="-39" y="-23" width="78" height="35" rx="12" fill="#e5cb6f"/><path d="M-27-11h16m16 0h15m-34 11h13m14 0h14" stroke="#c5ad56" stroke-width="3" stroke-linecap="round"/><circle cx="-28" cy="1" r="3" fill="#f3df92"/>`;}
function mountBrush(container,api){
  const dirt=Array.from({length:15},(_,index)=>({id:index,x:165+(index%5)*142+(index%2?8:-7),y:76+Math.floor(index/5)*64+(index%3-1)*8,radius:17+index%4}));
  const scene=`<ellipse cx="450" cy="263" rx="365" ry="18" fill="#1d322f" opacity=".06"/><rect x="65" y="30" width="770" height="228" rx="25" fill="#c39a72"/><rect x="65" y="23" width="770" height="225" rx="25" fill="#ead8b6"/>${[65,107,149,191,233].map(y=>`<path d="M85 ${y}h730" stroke="#d2bb92" stroke-width="1.2" opacity=".65"/>`).join('')}<rect x="80" y="37" width="740" height="197" rx="17" fill="none" stroke="#f8edcf" stroke-width="2"/>${dirt.map(spot=>`<g class="mat-dirt" data-dirt="${spot.id}" tabindex="0" role="button" aria-label="تنظيف البقعة ${fmt(spot.id+1)}"><circle class="mat-dirt-focus" cx="${spot.x}" cy="${spot.y}" r="${spot.radius+9}" fill="transparent"/><path d="M${spot.x-spot.radius} ${spot.y-3}q-4-17 14-15 13-11 21 4 14 10 1 21-16 7-29-1Z" fill="#9c7951" opacity=".72"/><circle cx="${spot.x+24}" cy="${spot.y-15}" r="3" fill="#ae8b61"/><circle cx="${spot.x-20}" cy="${spot.y+18}" r="3" fill="#ae8b61"/></g>`).join('')}<g class="mat-sponge" data-sponge transform="translate(105 224)">${spongeArt()}</g><text class="mat-small" x="450" y="284">تختفي البقع التي تمر بها الإسفنجة فقط</text>`;
  const{root,svg,badge}=shell(container,'اسحب الإسفنجة فوق البقع؛ جرّب تنظيف جزء من الطاولة أولًا.','٠٪ نظافة',scene,'<button class="mat-button" data-clean-one>تنظيف بقعة بالنقر</button><span class="mat-note">يمكن أيضًا النقر على أي بقعة، أو تحديدها بـ Tab ثم Enter.</span>','مسار الإسفنجة فوق السطح','إزالة البقع التي تتقاطع معها');
  const ctx=runtime(svg,api),sponge=svg.querySelector('[data-sponge]');let cleaned=new Set(),before=new Set(),position={x:105,y:224},savedPosition={...position},previous={...position};
  function render(){for(const spot of dirt){const element=svg.querySelector(`[data-dirt="${spot.id}"]`);element.dataset.clean=cleaned.has(spot.id);element.setAttribute('tabindex',cleaned.has(spot.id)?'-1':'0');}badge.innerHTML=`${fmt(Math.round(cleaned.size/dirt.length*100))}٪ نظافة <span class="mat-meter"><i style="width:${cleaned.size/dirt.length*100}%"></i></span>`;sponge.setAttribute('transform',`translate(${position.x} ${position.y})`);root.querySelector('[data-clean-one]').disabled=cleaned.size===dirt.length;}
  function start(p){before=new Set(cleaned);savedPosition={...position};previous={...p};}
  function move(p){position={x:clamp(p.x,85,815),y:clamp(p.y,43,230)};for(const spot of dirt)if(segmentDistance(spot,previous,position)<=spot.radius+24)cleaned.add(spot.id);previous={...position};render();ctx.emit('live',`أُزيلت ${fmt(cleaned.size)} من ${fmt(dirt.length)} بقعة.`, 'التغيير يحدث أثناء مرور الإسفنجة، وليس عند الإفلات فقط.');}
  function end(){if(cleaned.size>before.size)ctx.emit('done',cleaned.size===dirt.length?'أصبحت الطاولة نظيفة بالكامل.':`نظّفت ${fmt(cleaned.size-before.size)} بقع في هذه الحركة.`, `نسبة البقع المُزالة: ${fmt(Math.round(cleaned.size/dirt.length*100))}٪.`);else ctx.emit('ready','لم تمر الإسفنجة ببقعة جديدة.','اسحبها فوق البقع البنية.');}
  function cancel(){cleaned=new Set(before);position={...savedPosition};render();ctx.emit('ready','أُلغيت حركة التنظيف الأخيرة.','عادت البقع إلى حالتها قبل بداية السحب.');}
  ctx.on(svg,'pointerdown',event=>{if(event.target.closest('[data-sponge]'))ctx.begin(event,{start,move,end,cancel});});
  const cleanOne=id=>{ctx.stop();if(cleaned.has(id))return;cleaned.add(id);render();ctx.emit('done',`أُزيلت ${fmt(cleaned.size)} من ${fmt(dirt.length)} بقعة.`, 'نُفّذ التنظيف بالنقر. يمكنك تجربة السحب في بقية الطاولة.');};
  for(const element of svg.querySelectorAll('[data-dirt]')){ctx.on(element,'click',()=>cleanOne(Number(element.dataset.dirt)));ctx.on(element,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();cleanOne(Number(element.dataset.dirt));}});}
  ctx.on(root.querySelector('[data-clean-one]'),'click',()=>{const next=dirt.find(spot=>!cleaned.has(spot.id));if(next)cleanOne(next.id);});
  render();
  return{destroy:ctx.destroy,play(){ctx.stop();cleaned.clear();position={x:105,y:224};render();return ctx.playSteps([{points:[{...position},{x:150,y:76},{x:755,y:76},{x:755,y:140},{x:150,y:140},{x:150,y:204},{x:755,y:204}],duration:3300,start,move,end,cancel}]);}};
}
function chickpeasArt(){return `<ellipse cy="14" rx="42" ry="14" fill="#cab389"/>${[[-23,-4],[-1,-12],[21,-4],[-14,14],[10,13]].map(([x,y])=>`<path d="M${x-11} ${y}q-2-12 9-14 13 0 14 11-1 13-13 14-9-1-10-11Z" fill="#ddbb72" stroke="#b99756" stroke-width="1.3"/><path d="m${x-2} ${y-8} 3 9" stroke="#f3d99d" stroke-width="2" stroke-linecap="round"/>`).join('')}`;}
function spiceArt(){return `<ellipse cy="18" rx="38" ry="9" fill="#e8d1ad"/><path d="M-31 15-9-13q8-8 17 1l24 27Z" fill="#c8743e"/><path d="M-20 12-7-6q6-6 11 0l16 18Z" fill="#e59752"/><circle cx="-12" cy="7" r="2" fill="#af522e"/><circle cx="9" cy="9" r="2" fill="#ad532d"/><circle cx="2" cy="-2" r="1.8" fill="#f2b46c"/>`;}
function bowlContent(chickpeas,spice){
  const beans=chickpeas?Array.from({length:23},(_,i)=>{const angle=i*2.4,r=8+Math.sqrt(i)*14;const x=Math.cos(angle)*r,y=Math.sin(angle)*r*.39;return`<ellipse cx="${x}" cy="${y}" rx="10" ry="7" fill="${spice?'#d6a65e':'#e4c784'}" stroke="#ba9556" stroke-width=".7"/>`;}).join(''):'';
  const powder=spice?Array.from({length:35},(_,i)=>{const angle=i*2.4,r=10+Math.sqrt(i)*11;return`<circle cx="${Math.cos(angle)*r}" cy="${Math.sin(angle)*r*.34}" r="${i%3+1}" fill="#b55a32" opacity=".8"/>`;}).join(''):'';
  const herbs=chickpeas&&spice?`<path d="M-18-12q12-16 22-1-14 10-22 1m20 20q10-15 20-3-12 12-20 3M-49 2q6-10 13-1-7 9-13 1" fill="#6d8c4d"/>`:'';
  return`<ellipse cy="50" rx="119" ry="16" fill="#1d322f" opacity=".07"/><path d="M-113-5q7 83 113 89 106-6 113-89Z" fill="${chickpeas&&spice?'#39715c':'#739181'}"/><path d="M-97 15q18 52 97 57" fill="none" stroke="#fff" opacity=".12" stroke-width="7"/><ellipse cy="-5" rx="114" ry="47" fill="#faf2de" stroke="#5b7d69" stroke-width="5"/><ellipse cy="-5" rx="101" ry="37" fill="${spice?'#e4c28d':'#e7e1c9'}"/>${beans}${powder}${herbs}`;
}
function mountMix(container,api){
  const scene=`<rect x="55" y="28" width="230" height="220" rx="19" fill="#efe9d9"/><rect x="615" y="28" width="230" height="220" rx="19" fill="#efe9d9"/><text class="mat-strong" x="170" y="64">حمص مطبوخ</text><text class="mat-strong" x="730" y="64">بهارات</text><g class="mat-ingredient" data-ingredient="chickpeas" role="button" aria-label="إضافة حصة حمص" tabindex="0" transform="translate(170 123)"><circle class="mat-ingredient-focus" r="52" fill="#fff9e9"/>${chickpeasArt()}</g><g class="mat-ingredient" data-ingredient="spice" role="button" aria-label="إضافة جرعة بهارات" tabindex="0" transform="translate(730 123)"><circle class="mat-ingredient-focus" r="52" fill="#fff9e9"/>${spiceArt()}</g><text class="mat-label" data-source-chickpeas x="170" y="204">المتبقي: ١ حصة</text><text class="mat-label" data-source-spice x="730" y="204">المتبقي: ١ جرعة</text><ellipse class="mat-bowl-target" data-bowl-target cx="450" cy="157" rx="146" ry="112" fill="#f0f0e3" stroke="#d4ddc7" stroke-width="1.5" stroke-dasharray="7 6"/><g data-bowl-content transform="translate(450 142)"></g><text class="mat-strong" data-product x="450" y="45">كوّن طبقًا جديدًا</text><text class="mat-small" data-bowl-count x="450" y="279"></text><g class="mat-drag-ingredient" data-ingredient-ghost visibility="hidden"></g>`;
  const{root,svg,badge}=shell(container,'اسحب الحمص والبهارات إلى الوعاء، وشاهد تحوّل المكوّنات.','٠ من ٢ مكوّن',scene,'<button class="mat-button" data-add="chickpeas">إضافة الحمص بالنقر</button><button class="mat-button" data-add="spice">إضافة البهارات بالنقر</button>','المكوّن + الوعاء المستهدف','تكوين طبق بليلة متبّلة');
  const ctx=runtime(svg,api),ghost=svg.querySelector('[data-ingredient-ghost]'),target=svg.querySelector('[data-bowl-target]');let amounts={chickpeas:0,spice:0},dragged=null;
  const inside=p=>Math.pow((p.x-450)/145,2)+Math.pow((p.y-157)/112,2)<=1;
  function render(){const total=amounts.chickpeas+amounts.spice;badge.textContent=total===2?'الطبق جاهز':`${fmt(total)} من ${fmt(2)} مكوّن`;svg.querySelector('[data-bowl-content]').innerHTML=bowlContent(amounts.chickpeas,amounts.spice);svg.querySelector('[data-product]').textContent=total===2?'بليلة متبّلة':total?'أضف المكوّن الآخر':'كوّن طبقًا جديدًا';svg.querySelector('[data-bowl-count]').textContent=`داخل الوعاء: ${fmt(amounts.chickpeas)} حصة حمص + ${fmt(amounts.spice)} جرعة بهارات`;for(const key of ['chickpeas','spice']){const element=svg.querySelector(`[data-ingredient="${key}"]`);element.dataset.used=!!amounts[key];element.setAttribute('aria-disabled',!!amounts[key]);svg.querySelector(`[data-source-${key}]`).textContent=`المتبقي: ${fmt(1-amounts[key])} ${key==='chickpeas'?'حصة':'جرعة'}`;root.querySelector(`[data-add="${key}"]`).disabled=!!amounts[key];}}
  function add(key){if(amounts[key]){ctx.emit('fail','أُضيف هذا المكوّن بالفعل.','الكمية المتاحة منه أصبحت صفرًا.');return;}amounts[key]=1;render();if(amounts.chickpeas&&amounts.spice)ctx.emit('done','تكوّن طبق بليلة متبّلة.','انتقلت حصة الحمص وجرعة البهارات إلى منتج واحد؛ لم تتكرر أي كمية.');else ctx.emit('live',key==='chickpeas'?'أُضيفت حصة الحمص.':'أُضيفت جرعة البهارات.','أضف المكوّن الآخر حتى تتكوّن الوصفة النهائية.');}
  function start(key,p){dragged=key;ghost.innerHTML=key==='chickpeas'?chickpeasArt():spiceArt();set(ghost,{visibility:'visible',transform:`translate(${p.x} ${p.y})`});ctx.emit('live','اسحب المكوّن إلى داخل الوعاء.','ستُنقل الكمية عند الإفلات على الهدف.');}
  function move(p){ghost.setAttribute('transform',`translate(${p.x} ${p.y})`);target.dataset.active=inside(p);}
  function end(p){const key=dragged;dragged=null;ghost.setAttribute('visibility','hidden');target.dataset.active=false;if(inside(p))add(key);else ctx.emit('fail','لم يُضف المكوّن: أفلت داخل الوعاء.','بقيت الكمية في مصدرها.');}
  function cancel(){dragged=null;ghost.setAttribute('visibility','hidden');target.dataset.active=false;ctx.emit('ready','أُلغي السحب؛ بقيت الكمية في مصدرها.');}
  ctx.on(svg,'pointerdown',event=>{const element=event.target.closest('[data-ingredient]');if(!element)return;const key=element.dataset.ingredient;if(amounts[key]){ctx.emit('fail','لا توجد كمية أخرى من هذا المكوّن.');return;}ctx.begin(event,{start:p=>start(key,p),move,end,cancel});});
  for(const key of ['chickpeas','spice']){ctx.on(root.querySelector(`[data-add="${key}"]`),'click',()=>{ctx.stop();add(key);});ctx.on(svg.querySelector(`[data-ingredient="${key}"]`),'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();ctx.stop();add(key);}});}
  render();
  return{destroy:ctx.destroy,play(){ctx.stop();amounts={chickpeas:0,spice:0};render();return ctx.playSteps(['chickpeas','spice'].map(key=>({points:[{x:key==='chickpeas'?170:730,y:123},{x:key==='chickpeas'?310:590,y:89},{x:450,y:150}],duration:1400,start:p=>start(key,p),move,end,cancel})));}};
}
const circleTemplate=()=>Array.from({length:73},(_,i)=>({x:295+88*Math.cos(-Math.PI/2+i*Math.PI/36),y:149+88*Math.sin(-Math.PI/2+i*Math.PI/36)}));
const zTemplate=()=>[{x:174,y:65},{x:416,y:65},{x:174,y:235},{x:416,y:235}];
function recogniseShape(points){
  if(points.length<3)return null;
  const samples=sampledPath(points),xs=samples.map(p=>p.x),ys=samples.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),width=maxX-minX,height=maxY-minY;
  if(width<65||height<65)return null;
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const radii=samples.map(p=>Math.hypot(p.x-cx,p.y-cy)),radius=radii.reduce((sum,r)=>sum+r,0)/radii.length,variation=Math.sqrt(radii.reduce((sum,r)=>sum+(r-radius)**2,0)/radii.length)/radius;
  let turn=0;for(let i=1;i<samples.length;i++){let change=Math.atan2(samples[i].y-cy,samples[i].x-cx)-Math.atan2(samples[i-1].y-cy,samples[i-1].x-cx);while(change>Math.PI)change-=Math.PI*2;while(change< -Math.PI)change+=Math.PI*2;turn+=change;}
  if(distance(points[0],points.at(-1))<Math.min(width,height)*.3&&width/height>.65&&width/height<1.5&&variation<.22&&length/(2*Math.PI*radius)>.72&&length/(2*Math.PI*radius)<1.35&&Math.abs(turn)>4.8&&Math.abs(turn)<7.8)return'circle';
  const normalized=samples.map(p=>({x:(p.x-minX)/width,y:(p.y-minY)/height}));
  const ideal=sampledPath([{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]);
  const error=path=>Math.sqrt(path.reduce((sum,p,i)=>sum+(p.x-ideal[i].x)**2+(p.y-ideal[i].y)**2,0)/path.length);
  if(width/height>.7&&width/height<3&&Math.min(error(normalized),error([...normalized].reverse()))<.17)return'z';
  return null;
}
function mountGesture(container,api){
  const scene=`<rect x="55" y="20" width="500" height="255" rx="20" fill="#f1f0e6" stroke="#dddccd"/><path d="M78 42h26m-26 0v26M532 42h-26m26 0v26M78 253h26m-26 0v-26M532 253h-26m26 0v-26" stroke="#c4ceb8" stroke-width="2" fill="none"/><path class="mat-guide" data-shape-guide/><path class="mat-ink" data-ink/><rect x="584" y="20" width="264" height="255" rx="20" fill="#eaeedc"/><g transform="translate(656 130)"><ellipse class="mat-lamp-glow" data-lamp-glow cy="33" rx="63" ry="68" fill="#efd77f" opacity=".35"/><path d="M0-34v94M-25 63h50" stroke="#476b52" stroke-width="5" stroke-linecap="round"/><path d="M-24-47h48l18 50h-84Z" fill="#d8af6a"/><path d="M-22-43h12l-8 40h-15Z" fill="#edce95"/><ellipse cy="4" rx="42" ry="7" fill="#ac844e"/></g><g transform="translate(775 103)"><rect x="-39" y="-38" width="78" height="133" rx="7" fill="#d9c6a6"/><rect x="-28" y="-25" width="56" height="120" fill="#6e8b68"/><g class="mat-shop-shutter" data-gesture-door><rect x="-28" y="-25" width="56" height="120" fill="#bd9a74"/><path d="M-26-9h52M-26 7h52M-26 23h52M-26 39h52M-26 55h52M-26 71h52M-26 87h52" stroke="#a7835e" stroke-width="2"/></g><rect x="-43" y="-43" width="86" height="19" rx="4" fill="#5e7f5b"/></g><text class="mat-small" x="656" y="242" data-lamp-label>الإضاءة مطفأة</text><text class="mat-small" x="775" y="242" data-door-label>الباب مغلق</text>`;
  const controls='<button class="mat-button" data-guide="circle" aria-pressed="true"><svg viewBox="0 0 30 22" aria-hidden="true"><circle cx="15" cy="11" r="8"/></svg>دائرة: الإضاءة</button><button class="mat-button" data-guide="z" aria-pressed="false"><svg viewBox="0 0 30 22" aria-hidden="true"><path d="M5 4h20L5 18h20"/></svg>Z: الباب</button><button class="mat-button" data-apply-shape>تطبيق الشكل المختار</button>';
  const{root,svg,badge}=shell(container,'ارسم دائرة مغلقة أو حرف Z داخل مساحة الرسم.','بانتظار شكل واضح',scene,controls,'شكل المسار الذي رسمته','أمر مختلف بحسب الشكل');
  const ctx=runtime(svg,api),guide=svg.querySelector('[data-shape-guide]'),ink=svg.querySelector('[data-ink]');let selected='circle',points=[],previousInk='',previousInvalid='false',outside=false,lit=false,doorOpen=false;
  const inside=p=>p.x>=60&&p.x<=550&&p.y>=25&&p.y<=270;
  function renderOutputs(){svg.querySelector('[data-lamp-glow]').dataset.on=lit;svg.querySelector('[data-lamp-label]').textContent=lit?'الإضاءة تعمل':'الإضاءة مطفأة';svg.querySelector('[data-gesture-door]').setAttribute('transform',doorOpen?'translate(0 -25) scale(1 .08) translate(0 25)':'');svg.querySelector('[data-door-label]').textContent=doorOpen?'الباب مفتوح':'الباب مغلق';}
  function showGuide(shape){selected=shape;guide.setAttribute('d',pathData(shape==='circle'?circleTemplate():zTemplate()));root.querySelectorAll('[data-guide]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.guide===shape));}
  function start(p){previousInk=ink.getAttribute('d')||'';previousInvalid=ink.dataset.invalid||'false';points=[p];outside=false;ink.dataset.invalid=false;ink.setAttribute('d',pathData(points));badge.dataset.state='ready';badge.textContent='جارٍ قراءة الشكل';ctx.emit('live','ارسم الشكل ثم أفلت.','دائرة مغلقة للإضاءة، أو Z لفتح الباب وإغلاقه.');}
  function move(p){if(!inside(p))outside=true;if(distance(p,points.at(-1))<1)return;points.push(p);ink.setAttribute('d',pathData(points));}
  function execute(drawn){const result=outside?null:recogniseShape(drawn);if(!result){ink.dataset.invalid=true;badge.dataset.state='invalid';badge.textContent='الشكل غير واضح';ctx.emit('fail','لم يُتعرّف إلى دائرة أو حرف Z.','لم تتغير الإضاءة أو حالة الباب. اتبع أحد الدليلين وحاول مجددًا.');return;}ink.dataset.invalid=false;badge.dataset.state='ready';if(result==='circle'){lit=!lit;badge.textContent='دائرة ← الإضاءة';ctx.emit('done',lit?'تعرّف إلى دائرة: أُضيئت اللمبة.':'تعرّف إلى دائرة: أُطفئت اللمبة.','الناتج أمر تشغيل، وليس نقل الشكل إلى مكان آخر.');}else{doorOpen=!doorOpen;badge.textContent='Z ← الباب';ctx.emit('done',doorOpen?'تعرّف إلى حرف Z: فُتح الباب.':'تعرّف إلى حرف Z: أُغلق الباب.','شكل الحركة هو الذي يحدد الأمر المنفّذ.');}renderOutputs();}
  function end(p){move(p);execute(points);}
  function cancel(){ink.setAttribute('d',previousInk);ink.dataset.invalid=previousInvalid;badge.dataset.state='ready';badge.textContent='أُلغي الرسم';ctx.emit('ready','أُلغي الرسم؛ لم يتغيّر أي أمر.');}
  ctx.on(svg,'pointerdown',event=>{const p=svgPoint(svg,event);if(inside(p))ctx.begin(event,{start,move,end,cancel});});
  root.querySelectorAll('[data-guide]').forEach(button=>ctx.on(button,'click',()=>{ctx.stop();showGuide(button.dataset.guide);ink.setAttribute('d','');badge.dataset.state='ready';badge.textContent='اتبع الدليل المتقطع';ctx.emit('ready',selected==='circle'?'ارسم دائرة مغلقة لتبديل الإضاءة.':'ارسم حرف Z لتبديل حالة الباب.');}));
  ctx.on(root.querySelector('[data-apply-shape]'),'click',()=>{ctx.stop();outside=false;const drawn=selected==='circle'?circleTemplate():zTemplate();ink.setAttribute('d',pathData(drawn));execute(drawn);});
  showGuide('circle');renderOutputs();
  return{destroy:ctx.destroy,play(){ctx.stop();lit=false;doorOpen=false;renderOutputs();const template=selected==='circle'?circleTemplate():zTemplate();return ctx.playSteps([{points:template,duration:2700,start,move,end,cancel}]);}};
}
function mountThreshold(container,api){
  const scene=`<defs><clipPath id="mat-threshold-shop-clip"><rect x="366" y="70" width="168" height="81"/></clipPath></defs><ellipse cx="450" cy="160" rx="120" ry="11" fill="#1d322f" opacity=".06"/><rect x="344" y="23" width="212" height="132" rx="8" fill="#e4d6bd"/><rect x="355" y="27" width="190" height="36" rx="5" fill="#166353"/><text x="450" y="51" text-anchor="middle" font-size="16" font-weight="700" fill="#fff6df" direction="rtl">بليلة الحارة</text><rect x="366" y="70" width="168" height="81" fill="#708f74"/><g clip-path="url(#mat-threshold-shop-clip)"><path d="M380 137h140M395 105h48m26 0h35" stroke="#e3d4b0" stroke-width="8" stroke-linecap="round"/><g class="mat-shop-shutter" data-threshold-shutter><rect x="366" y="70" width="168" height="81" fill="#bba78b"/>${[82,94,106,118,130,142].map(y=>`<path d="M369 ${y}h162" stroke="#9e8d73" stroke-width="2"/>`).join('')}<rect x="431" y="132" width="38" height="5" rx="2" fill="#7c715e"/></g></g><path d="M337 155h226" stroke="#c5b69b" stroke-width="5" stroke-linecap="round"/><rect x="114" y="196" width="672" height="64" rx="32" fill="#e4e8d8"/><rect class="mat-slider-fill" data-slider-fill x="114" y="196" width="64" height="64" rx="32"/><path d="M693.2 186v85" stroke="#b58b58" stroke-width="2" stroke-dasharray="4 4"/><text class="mat-small" x="693.2" y="178">عتبة ٩٠٪</text><text class="mat-label" data-threshold-track x="445" y="233">اسحب حتى تتجاوز العلامة</text><g class="mat-slider-handle" data-threshold-handle transform="translate(146 228)" tabindex="0" role="slider" aria-label="مسافة السحب لتأكيد فتح المحل" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-orientation="horizontal"><circle class="mat-handle-body mat-handle-ring" r="30"/><path d="M-12 0h24m-7-7 7 7-7 7" stroke="#fff5dc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g><text class="mat-small" x="146" y="283">البداية</text><text class="mat-small" x="754" y="283">التأكيد</text>`;
  const controls='<button class="mat-button" data-move-end>تحريك إلى النهاية</button><button class="mat-button" data-confirm-position>تأكيد الموضع</button><button class="mat-button" data-close-shop disabled>إغلاق المحل</button><span class="mat-note">لوحة المفاتيح: السهمان للتحريك، ثم Enter للتأكيد.</span>';
  const{root,svg,badge}=shell(container,'أفلت بعد تجاوز ٩٠٪ لفتح المحل؛ السحب القصير لا ينفّذ الأمر.','المحل مغلق',scene,controls,'مسافة السحب عند الإفلات','تنفيذ الأمر بعد تجاوز العتبة');
  const ctx=runtime(svg,api),handle=svg.querySelector('[data-threshold-handle]'),fill=svg.querySelector('[data-slider-fill]'),label=svg.querySelector('[data-threshold-track]'),shutter=svg.querySelector('[data-threshold-shutter]');let progress=0,opened=false,before=0;
  const fromPoint=p=>clamp((p.x-146)/608,0,1);
  function render(){handle.style.transform=`translate(${146+progress*608}px, 228px)`;handle.setAttribute('aria-valuenow',Math.round(progress*100));handle.setAttribute('aria-disabled',opened);fill.setAttribute('width',64+progress*608);label.textContent=opened?'المحل مفتوح':progress>=.9?'أفلت لتأكيد الفتح':`المسافة ${fmt(Math.round(progress*100))}٪`;badge.textContent=opened?'المحل مفتوح':progress>=.9?'تجاوزت العتبة':'المحل مغلق';shutter.style.transform=opened?'translateY(-86px)':'translateY(0)';root.querySelector('[data-close-shop]').disabled=!opened;root.querySelector('[data-move-end]').disabled=opened;root.querySelector('[data-confirm-position]').disabled=opened;}
  function start(){before=progress;handle.dataset.returning=false;badge.dataset.state='ready';}
  function move(p){progress=fromPoint(p);render();ctx.emit('live',progress>=.9?'تجاوزت العتبة؛ أفلت لتأكيد الفتح.':`مسافة السحب: ${fmt(Math.round(progress*100))}٪.`, 'يبقى المحل مغلقًا حتى الإفلات بعد ٩٠٪.');}
  function commit(){if(opened)return;if(progress>=.9){opened=true;progress=1;badge.dataset.state='ready';render();ctx.emit('done','فُتح المحل بعد تجاوز عتبة التأكيد.','ارتفع الباب عند الإفلات. يمكنك إغلاق المحل وإعادة التجربة.');}else{const attempted=Math.round(progress*100);handle.dataset.returning=true;progress=0;render();badge.dataset.state='invalid';badge.textContent='السحب قصير';ctx.emit('fail',`توقف السحب عند ${fmt(attempted)}٪؛ لم يُفتح المحل.`, 'عاد المقبض إلى البداية لأن المسافة أقل من ٩٠٪.');}}
  function end(p){progress=fromPoint(p);commit();}
  function cancel(){progress=before;render();ctx.emit('ready','أُلغي السحب؛ بقي المحل مغلقًا.');}
  ctx.on(svg,'pointerdown',event=>{if(opened||!event.target.closest('[data-threshold-handle]'))return;ctx.begin(event,{start,move,end,cancel});});
  ctx.on(handle,'keydown',event=>{if(opened)return;if(['ArrowLeft','ArrowRight','Home','End','Enter','Escape'].includes(event.key)){event.preventDefault();ctx.stop();if(event.key==='Enter'){commit();return;}if(event.key==='Escape')progress=0;else if(event.key==='Home')progress=0;else if(event.key==='End')progress=1;else progress=clamp(progress+(event.key==='ArrowRight'?0.1:-0.1),0,1);badge.dataset.state='ready';render();ctx.emit('live',`مسافة التأكيد ${fmt(Math.round(progress*100))}٪.`, 'اضغط Enter لتأكيد الموضع.');}});
  ctx.on(root.querySelector('[data-move-end]'),'click',()=>{ctx.stop();progress=1;badge.dataset.state='ready';render();ctx.emit('live','تجاوزت العتبة؛ اضغط تأكيد الموضع لفتح المحل.');});
  ctx.on(root.querySelector('[data-confirm-position]'),'click',()=>{ctx.stop();commit();});
  ctx.on(root.querySelector('[data-close-shop]'),'click',()=>{ctx.stop();opened=false;progress=0;badge.dataset.state='ready';render();ctx.emit('ready','أُغلق المحل وأُعيد المقبض إلى البداية.');});
  render();
  return{destroy:ctx.destroy,play(){ctx.stop();opened=false;progress=0;badge.dataset.state='ready';render();return ctx.playSteps([{points:[{x:146,y:228},{x:530,y:228}],duration:1200,start,move,end,cancel},{points:[{x:530,y:228},{x:146,y:228}],duration:350},{points:[{x:146,y:228},{x:754,y:228}],duration:1800,start,move,end,cancel}]);}};
}
export function mountMaterials(id,container,api){
  if(id==='brush')return mountBrush(container,api);
  if(id==='mix')return mountMix(container,api);
  if(id==='gesture')return mountGesture(container,api);
  if(id==='threshold')return mountThreshold(container,api);
  throw new Error(`Unknown material interaction: ${id}`);
}
