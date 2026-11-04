// Deltas from different deltaMode units are never raw-summed.
// This example's conversion to a teaching quantity is a policy, not hardware calibration.
const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const val=n=>nf.format(n),stepText=n=>(n>0?'+':'')+val(n),unitNames=['بكسل','سطر','صفحة'];
export const quietMs=400;
export const wheelGuide=[{t:0,dx:0,dy:80,mode:0},{t:120,dx:0,dy:40,mode:0},{t:240,dx:0,dy:-1,mode:1},{t:850,dx:0,dy:1,mode:2}];
export function wheelModel(){
 let qty,count,group,last,log,sums,open,now,point;
 function reset(){qty=50;count=group=0;last=null;log=[];sums=[0,0,0];open=false;now=0;point=null;}
 function advance(t){if(!Number.isFinite(t)||t<now)return;now=t;if(last!==null&&now-last>=quietMs)open=false;}
 function add({dx=0,dy,mode,t,buttons=0,modified=false,x=null,y=null}){
   if(buttons!==0||modified||!Number.isFinite(t)||t<now||!Number.isFinite(dy)||!Number.isFinite(dx)||![0,1,2].includes(mode)||(!dy&&!dx))return false;
   advance(t);if(!open)group++;open=true;count++;const delta=mode===0?dy/40:dy;const before=qty;qty=Math.max(0,Math.min(100,qty+delta));sums[mode]+=dy;
   const gap=last===null?null:t-last;last=t;point=Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
   log.unshift({seq:count,group,t,gap,dx,dy,mode,delta,before,qty,point});if(log.length>12)log.pop();return true;
 }
 function state(){return {qty,count,group,open,last,sums:[...sums],point,rows:[...log]};}reset();return {add,advance,reset,state};
}
export function mountWheelTrace(container,report){
 const m=wheelModel(),ctl=new AbortController();let origin=null,mode='mouse',timer=0,frame=0,disposed=false;const labels=['التغير الرأسي الأخير','المجموعة الزمنية','عدد الأحداث'];
 container.innerHTML=`<div class="ch-board-legend"><span data-w-source>إدخال مباشر</span><span>تدوير رأسي · لا يتطلب ضغطة</span></div>
 <div class="wheel-pad" role="region" aria-label="سطح تدوير البكرة دون ضغط"><span>ضع المؤشر هنا ودوّر البكرة</span><div class="wheel-dial"><strong data-w-value>٥٠</strong><small>من ١٠٠</small></div><div class="wheel-meter"><i></i></div><span class="wheel-pad-state"></span></div>
 <div class="ch-metrics">${labels.map((l,i)=>`<div><small>${l}</small><strong data-w-k="${i}">—</strong></div>`).join('')}</div>
 <p class="wheel-sums"></p>
 <details class="wheel-read"><summary>ما الذي قرأناه وكيف غيّر الكمية؟</summary><p>نقرأ التغير الأفقي والرأسي ووحدته كما أبلغه المتصفح. في هذا المثال فقط، نضيف وحدة كمية لكل ٤٠ بكسل رأسيًا أو لكل سطر أو صفحة. الإشارة السالبة تنقص الكمية، ولا نتجاوز ٠ أو ١٠٠. لا نستنتج عدد أسنان البكرة أو دورانها الفيزيائي من هذه الأرقام.</p><p>موضع المؤشر سياق للحدث. نضع فاصلًا بين المجموعات بعد ٤٠٠ ملث من الصمت؛ لا ننتظر إفلات زر. قد يرسل جهاز تمرير آخر أحداثًا مماثلة، فلا يستنتج المختبر اسم الجهاز من الحدث.</p></details>
 <div class="wheel-log"><h3>سجل التدوير</h3><p>آخر ١٢ حدثًا، الأحدث أولًا. الزمن منذ أول حدث في هذا التسجيل.</p><ol></ol></div>`;
 const $=s=>container.querySelector(s),pad=$('.wheel-pad'),ul=$('.wheel-log ol'),clock=()=>performance.now();
 function paint(){const s=m.state(),r=s.rows[0];container.dataset.source=mode;container.dataset.qty=s.qty;container.dataset.groups=s.group;container.dataset.events=s.count;
 $('[data-w-source]').textContent=mode==='guide'?'عرض مضبوط · ليس تدويرًا فعليًا':'إدخال مباشر';$('[data-w-value]').textContent=val(s.qty);$('.wheel-meter i').style.width=s.qty+'%';
 $('.wheel-pad-state').textContent=!s.count?'جاهز · القيمة الابتدائية ٥٠':s.open?'تصل تغيرات · المجموعة الحالية '+val(s.group):'انقضت مهلة الصمت · بقيت الكمية محفوظة';
 $('[data-w-k="0"]').textContent=r?val(r.dy)+' '+unitNames[r.mode]:'—';$('[data-w-k="1"]').textContent=s.count?val(s.group):'—';$('[data-w-k="2"]').textContent=val(s.count);
 $('.wheel-sums').textContent='مجموع التغيّر الرأسي حسب الوحدة: '+s.sums.map((v,i)=>val(v)+' '+unitNames[i]).join(' · ');
 ul.innerHTML=s.rows.length?s.rows.map(a=>`<li><span><b>المجموعة ${val(a.group)}</b> · ${val(a.t)} ملث</span><span>أفقي ${val(a.dx)} · رأسي ${val(a.dy)} ${unitNames[a.mode]}</span><span>الفاصل: ${a.gap===null?'أول حدث':val(a.gap)+' ملث'}</span><span>الخطوة: <bdi>${stepText(a.delta)}</bdi></span><span>الكمية: من ${val(a.before)} إلى <strong>${val(a.qty)}</strong></span></li>`).join(''):'<li>لم يصل حدث تدوير بعد.</li>';}
 function clearTasks(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=0;}
 function reset(){clearTasks();m.reset();origin=null;mode='mouse';paint();report('جاهز للتدوير داخل السطح.');}
 function scheduleEnd(t){clearTimeout(timer);timer=setTimeout(()=>{if(disposed)return;m.advance(t+quietMs);paint();report('انتهت المجموعة وفق مهلة الصمت. الكمية '+val(m.state().qty)+'.');},quietMs);}
 pad.addEventListener('wheel',e=>{if((e.buttons??0)!==0||e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||![0,1,2].includes(e.deltaMode)||(!e.deltaX&&!e.deltaY))return;
   if(mode==='guide')reset();const time=clock();if(origin===null)origin=time;const t=time-origin;
   const prior=m.state().group;if(!m.add({dx:e.deltaX,dy:e.deltaY,mode:e.deltaMode,t,buttons:e.buttons,x:e.clientX,y:e.clientY}))return;if(e.cancelable)e.preventDefault();paint();if(m.state().group!==prior)report('بدأت مجموعة تدوير جديدة.');scheduleEnd(t);
 },{passive:false,signal:ctl.signal});
 function play(){reset();mode='guide';const start=clock();let i=0;report('عرض مضبوط لأربعة أحداث بوحدات مختلفة.');function tick(wall){if(disposed)return;const t=wall-start;
   while(i<wheelGuide.length&&wheelGuide[i].t<=t)m.add(wheelGuide[i++]);m.advance(t);paint();if(t<wheelGuide.at(-1).t+quietMs)frame=requestAnimationFrame(tick);else {frame=0;report('أربعة أحداث في مجموعتين؛ أصبحت الكمية ٥٣.');}}
 frame=requestAnimationFrame(tick);}
 reset();return {reset,play,destroy(){disposed=true;clearTasks();ctl.abort();}};
}
