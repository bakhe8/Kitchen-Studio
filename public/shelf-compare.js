import {renderShelfVolume} from './shelf-volume.js';
import {validatePlan} from './shelf-model.js';
import {comparisonArtwork} from './shelf-canvas.js';
const key='atlas-shelves:compare-a:v1';
// Clip the two entire scenes along a vertical line in screen space. A and B
// must use the same camera matrix, framing, wall photo, cm scale and floor.
export function comparisonVolume(a,b,photo,camera){
  const base={...a,wall:b.wall,wallColor:b.wallColor,cab:{...a.cab,y:b.wall.h-a.wall.h+a.cab.y}};
  const options={yaw:camera.yaw,pitch:camera.pitch,photoUrl:photo};
  const right=renderShelfVolume(b,{...options,depth:b.depth??36,prefix:'sp3-b'}),left=renderShelfVolume(base,{...options,depth:a.depth??36,projection:right.projection,prefix:'sp3-a'});
  const box=right.bounds||right.projection.bounds,z=camera.zoom||1,w=box.w/z,h=box.h/z,x=box.x+(box.w-w)/2,y=box.y+(box.h-h)/2;
  const commonWall='<g transform="translate('+(-x)+' '+(-y)+')">'+right.wallHtml+'</g>';
  const leftDefs=left.wallHtml.match(/^<defs>[\s\S]*?<\/defs>/)?.[0]||'';
  const group=(id,html)=>'<g clip-path="url(#sp3-clip-'+id+')"><g transform="translate('+(-x)+' '+(-y)+')">'+html+'</g></g>';
  return {w,total:h,svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="الخيار المحفوظ يسار خط المقارنة والتصميم الحالي يمينه، بمنظور ثلاثي الأبعاد"><defs><clipPath id="sp3-clip-a"><rect data-compare-clip="a" x="0" width="'+w/2+'" y="0" height="'+h+'"/></clipPath><clipPath id="sp3-clip-b"><rect data-compare-clip="b" x="'+w/2+'" width="'+w/2+'" y="0" height="'+h+'"/></clipPath></defs>'+commonWall+leftDefs+group('a',left.cabinetHtml)+group('b',right.cabinetHtml)+'</svg>'};
}
export function mountComparison({getPlan,getPhoto,getView=()=>({volume:false}),onEdit,say}){
  const q=id=>document.getElementById('shelf-'+id),wrap=q('comparison'),stage=q('compare-stage'),frame=q('compare-frame'),image=q('compare-image'),scene=q('scene'),slider=q('compare-range'),save=q('compare-save'),toggle=q('compare-toggle'),edit=q('compare-edit'),hint=q('compare-hint');
  let baseline=null,mode=false,show=false,confirm=false,persisted=true,lastPlan=null,lastBase=null,lastPhoto=null,width=1,pos=50,drag=null,lastView=null;
  try{const saved=localStorage.getItem(key);if(saved)baseline=validatePlan(JSON.parse(saved));}catch{}
  function updatePosition(v){
    pos=Math.max(0,Math.min(100,Number(v)));frame.style.setProperty('--split',pos+'%');slider.value=String(pos);
    slider.setAttribute('aria-valuetext',new Intl.NumberFormat('ar',{maximumFractionDigits:0}).format(pos)+'٪ من الخيار أ');
    const a=image.querySelector('[data-compare-clip="a"]'),b=image.querySelector('[data-compare-clip="b"]');
    if(a&&b){const x=width*pos/100;a.setAttribute('width',x);b.setAttribute('x',x);b.setAttribute('width',width-x);}
    frame.querySelector('.sp-option-a').hidden=pos<10;frame.querySelector('.sp-option-b').hidden=pos>90;
  }
  function paint(){
    wrap.hidden=!mode;stage.hidden=!(mode&&show&&baseline);scene.hidden=!stage.hidden;
    if(!mode)return;
    toggle.hidden=!baseline;edit.hidden=!baseline;
    save.textContent=confirm?'تأكيد استبدال أ':baseline?'استبدل أ بالتصميم الحالي':'احفظ التصميم كخيار أ';
    toggle.textContent=show?'عرض ب وحده':'عرض المقارنة';toggle.setAttribute('aria-pressed',String(show));
    hint.textContent=!baseline?'احفظ هذه النسخة، ثم جرّب تغيير التقسيم أو الخامة في الخيار ب.':confirm?'اضغط التأكيد لاستبدال الخيار أ. يبقى ب كما هو.':!persisted?'الخيار أ متاح لهذه الجلسة فقط؛ تعذّر حفظه في المتصفح.':show?'اسحب الخط على الرسم: أ على اليسار، وب على اليمين. خلفية الجدار ومقياسه مشتركان.':'الخيار أ محفوظ. عُد لتعديل ب، أو اعرض الخيارين على الجدار نفسه.';
    if(stage.hidden)return;
    const plan=getPlan(),photo=getPhoto(),view=getView(),viewKey=view.volume?JSON.stringify(view.camera):'front';
    if(lastPlan!==plan||lastBase!==baseline||lastPhoto!==photo||lastView!==viewKey){
      lastView=viewKey;const art=view.volume?comparisonVolume(baseline,plan,photo,view.camera):comparisonArtwork(baseline,plan,photo);width=art.w;image.innerHTML=art.svg;frame.style.setProperty('--comparison-ar',art.w/art.total);lastPlan=plan;lastPhoto=photo;lastBase=baseline;
    }
    updatePosition(pos);
  }
  save.addEventListener('click',()=>{
    if(baseline&&!confirm){confirm=true;paint();return;}
    baseline=JSON.parse(JSON.stringify(getPlan()));persisted=true;
    try{localStorage.setItem(key,JSON.stringify(baseline));}catch{persisted=false;}
    confirm=false;show=false;pos=50;paint();say(persisted?'حُفظ الخيار أ. اختر «عدّل الخيار ب» لتجربة فكرة أخرى.':'احتُفظ بالخيار أ في هذه الجلسة؛ مساحة التخزين المحلية غير متاحة.');
  });
  edit.addEventListener('click',()=>{confirm=false;onEdit();});
  toggle.addEventListener('click',()=>{confirm=false;show=!show;paint();});
  slider.addEventListener('input',()=>updatePosition(slider.value));
  const point=e=>{const box=frame.getBoundingClientRect();if(box.width)updatePosition(100*(e.clientX-box.left)/box.width);};
  frame.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;drag=e.pointerId;frame.setPointerCapture(drag);point(e);});
  frame.addEventListener('pointermove',e=>{if(drag===e.pointerId)point(e);});
  frame.addEventListener('pointerup',e=>{if(drag!==e.pointerId)return;point(e);drag=null;});
  for(const event of ['pointercancel','lostpointercapture'])frame.addEventListener(event,()=>{drag=null;});
  return {refresh(preview){if(mode!==preview){mode=preview;confirm=false;show=!!baseline&&mode;}paint();}};
}
