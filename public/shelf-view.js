// View preferences are local to this browser, independent of the editable design/history.
const key='atlas-shelves:workspace-view:v1';
const limit=(v,a,b)=>Math.min(b,Math.max(a,v)),finite=(v,d)=>Number.isFinite(v)?v:d;
export const homeCamera=Object.freeze({yaw:24,pitch:12,zoom:1});
export function normalizeView(v={}){
  const c=v?.camera||{};
  return {volume:v?.volume!==false,camera:{yaw:limit(finite(c.yaw,24),-55,55),pitch:limit(finite(c.pitch,12),-15,32),zoom:limit(finite(c.zoom,1),.7,2)}};
}
export function mountWorkspaceView({beforeChange,onChange,onModeChange,announce}){
  let init={};try{init=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
  let {volume,camera}=normalizeView(init),room=new URLSearchParams(location.search).get('view')==='room'||init?.room===true,orbit=false,gesture=null,raf=0;
  const unitOnly=document.body.dataset.projectMode==='kitchen-unit';if(unitOnly){room=false;volume=new URLSearchParams(location.search).get('space')!=='top';camera={...homeCamera};}
  const q=id=>document.getElementById('shelf-'+id),space=q('canvas-mat'),spin=q('orbit'),home=q('view-home'),frac=new Intl.NumberFormat('ar-SA',{style:'percent',maximumFractionDigits:0});
  const state={get room(){return room;},get volume(){return volume;},showDetail(){switchView(true,false,false);},get camera(){return camera;},get orbit(){return orbit;},stopOrbit,refresh};
  function save(){if(unitOnly)return;try{localStorage.setItem(key,JSON.stringify({volume,camera,room}));}catch{}}
  function refresh(){document.body.dataset.spaceView=room?'room':volume?'volume':'front';document.body.dataset.viewOrbit=String(orbit);
    q('view-room').setAttribute('aria-pressed',String(room));q('view-volume').setAttribute('aria-pressed',String(!room&&volume));q('view-front').setAttribute('aria-pressed',String(!room&&!volume));
    q('camera-tools').hidden=room||!volume;q('view-title').textContent=room?'المشهد المعماري':volume?'ورشة ثلاثية الأبعاد':'الواجهة الأمامية';
    spin.setAttribute('aria-pressed',String(orbit));spin.setAttribute('aria-label',orbit?'إنهاء التدوير':'تدوير المشهد');spin.querySelector('span').textContent=orbit?'إنهاء التدوير':'تدوير المشهد';
    q('view-percent').textContent=frac.format(camera.zoom);q('view-minus').disabled=camera.zoom<=.701;q('view-plus').disabled=camera.zoom>=1.999;
    space.setAttribute('aria-label',room?'الغرفة من جميع الجهات':orbit?'اسحب بالزر الأيسر لتدوير المشهد.':'مساحة تصميم الجدار والدولاب');
  }
  function paint(){if(raf)cancelAnimationFrame(raf);raf=0;refresh();onChange();}
  function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
  function finish(e,write=true){const g=gesture;if(!g||e&&e.pointerId!==g.id)return;gesture=null;delete document.body.dataset.cameraDrag;
    try{space.releasePointerCapture(g.id);}catch{}if(write)save();if(raf)paint();}
  function stopOrbit(){finish(null);if(orbit){orbit=false;refresh();}}
  function switchView(v,newRoom=false,notify=true){if(unitOnly&&newRoom||v===volume&&newRoom===room)return;const changedRoom=room!==newRoom;beforeChange();stopOrbit();volume=v;room=newRoom;if(changedRoom){try{const u=new URL(location.href);if(room)u.searchParams.set('view','room');else if(u.searchParams.get('view')==='room')u.searchParams.delete('view');history.replaceState(history.state,'',u.href);}catch{}}save();if(changedRoom)onModeChange?.(room);paint();if(notify)announce(room?'الغرفة كاملة. اسحب لتدويرها أو انقر لاختيار جدار.':v?'مساحة ثلاثية الأبعاد. اسحب الألواح لتعديلها، أو اختر «تدوير المشهد» لتغيير زاوية النظر.':'واجهة أمامية بالمقياس نفسه. التقسيم والتحديد محفوظان.');}
  q('view-room').addEventListener('click',()=>switchView(true,true));
  q('view-volume').addEventListener('click',()=>switchView(true));q('view-front').addEventListener('click',()=>switchView(false));
  spin.addEventListener('click',()=>{if(!volume)return;beforeChange();finish(null);orbit=!orbit;paint();announce(orbit?'اسحب داخل الرسم لتدويره. اضغط «إنهاء التدوير» أو اختر أداة للعودة إلى التعديل.':'عدت إلى تحرير الدولاب من الزاوية الحالية.');});
  function change(patch){camera=normalizeView({camera:{...camera,...patch}}).camera;}
  function stepZoom(dir){beforeChange();finish(null);change({zoom:Math.round((camera.zoom+.15*dir)*100)/100});save();paint();}
  q('view-minus').addEventListener('click',()=>stepZoom(-1));q('view-plus').addEventListener('click',()=>stepZoom(1));
  home.addEventListener('click',()=>{beforeChange();finish(null);camera={...homeCamera};save();paint();announce('استُعيدت زاوية البداية والتقريب.');});
  spin.addEventListener('keydown',e=>{const a={ArrowLeft:{yaw:camera.yaw-5},ArrowRight:{yaw:camera.yaw+5},ArrowUp:{pitch:camera.pitch+4},ArrowDown:{pitch:camera.pitch-4}}[e.key];
    if(!a||!volume)return;e.preventDefault();beforeChange();change(a);save();paint();});
  document.addEventListener('pointerdown',e=>{if(orbit&&e.target.closest?.('#shelf-dock,#shelf-inspector,#shelf-properties-toggle,#shelf-file-menu,#shelf-axis-switch'))stopOrbit();},{capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&orbit){e.preventDefault();e.stopImmediatePropagation();stopOrbit();paint();}},{capture:true});
  const capt={capture:true,passive:false};
  space.addEventListener('pointerdown',e=>{if(!volume||!orbit||!e.target.closest?.('.shc-board,.sp-compare-frame'))return;
    e.preventDefault();e.stopImmediatePropagation();if(gesture||!e.isPrimary||e.button!==0)return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch};document.body.dataset.cameraDrag='true';space.setPointerCapture(e.pointerId);
  },capt);
  function move(e){const g=gesture;if(!g||e.pointerId!==g.id)return;change({yaw:g.yaw+(e.clientX-g.x)*.24,pitch:g.pitch+(e.clientY-g.y)*.21});schedule();}
  space.addEventListener('pointermove',e=>{if(!orbit||!volume)return;e.stopImmediatePropagation();if(gesture){e.preventDefault();move(e);}},capt);
  space.addEventListener('pointerup',e=>{if(!orbit||!volume)return;e.stopImmediatePropagation();if(gesture){move(e);finish(e);}},capt);
  space.addEventListener('contextmenu',e=>{if(orbit){e.preventDefault();e.stopImmediatePropagation();}},capt);
  ['pointercancel','lostpointercapture'].forEach(name=>space.addEventListener(name,e=>finish(e)));
  window.addEventListener('blur',()=>finish(null));refresh();return state;
}
