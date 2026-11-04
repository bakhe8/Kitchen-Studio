// Authoring only: append the returned SVG fragment after the physical scene.
// q is an SVG point, NOT a client pixel. cm always means the same room world
// (x right, y DOWN, z from back to front) used by the model and renderer.
import {roomArchitecture,architectureWall} from './kitchen-architecture.js';
import {kitchenRunPoint,kitchenRunLocal,kitchenRunPolygon,kitchenWallLocal,kitchenWallSpan,kitchenUnitSpecs,isFreeKitchenRun} from './kitchen-model.js';

const E=1e-7,SEP=.095,MIN_DIR=.035;
const room=s=>s?.geometry?.room||s?.room,finite=Number.isFinite,xyz=(x,y,z)=>({x,y,z});
const sub=(a,b)=>xyz(a.x-b.x,a.y-b.y,a.z-b.z),add=(a,b,t)=>xyz(a.x+t*b.x,a.y+t*b.y,a.z+t*b.z),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const n=x=>Number(x.toFixed(4)),qPoint=q=>q&&finite(q.x)&&finite(q.y??q.z)?{x:q.x,y:q.y??q.z}:null;
const ray=(s,q)=>{q=qPoint(q);return s?.projection&&q?s.projection.ray(q.x,q.y):null;};
const lerp=(a,b,t)=>add(a,sub(b,a),t),layerOK=(r,l)=>!l||l==='all'||r?.tier===l;
const depth=(s,p)=>s.projection.projectPoint(p).depth;
const live=s=>!!s?.geometry&&!!s?.projection&&s.mode!=='closed';
function atPlane(r,key,position){if(!r||!finite(position)||Math.abs(r.direction[key])<MIN_DIR)return null;const p=add(r.origin,r.direction,(position-r.origin[key])/r.direction[key]);return [p.x,p.y,p.z].every(finite)?p:null;}
export function onHorizontal(s,q,worldY){return live(s)?atPlane(ray(s,q),'y',worldY):null;}
/** If the horizontal plane is nearly edge-on, a one-dimensional operation
 * can still follow a selected run's projected length or inward depth axis. */
export function onRunAxis(s,q,run,anchor,axis='u'){
  q=qPoint(q);if(!live(s)||!q||!run||!anchor||![anchor.x,anchor.y,anchor.z].every(finite))return null;
  const R=room(s),p0=kitchenRunPoint(R,run,0,0),p1=kitchenRunPoint(R,run,axis==='d'?0:1,axis==='d'?1:0),v=xyz(p1.x-p0.x,0,p1.z-p0.z),A=s.projection.projectPoint(anchor),B=s.projection.projectPoint(add(anchor,v,1)),dx=B.x-A.x,dy=B.y-A.y,l=dx*dx+dy*dy;
  if(l<MIN_DIR*MIN_DIR)return null;const p=add(anchor,v,((q.x-A.x)*dx+(q.y-A.y)*dy)/l);
  return {...p,...kitchenRunLocal(R,run,p)};
}
export function onWall(s,q,{wall=null,offset=0,locked=false}={}){
  q=qPoint(q);if(!live(s)||!q||!finite(offset)||locked&&!wall)return null;
  const rr=ray(s,q),R=room(s),physical=locked?null:s.hitTest(q.x,q.y),segments=roomArchitecture(R).walls;
  const options=wall?segments.filter(w=>w.id===wall):segments.filter(w=>s.visibleSurfaces.includes(w.id));
  let best=null,near=-Infinity;
  for(const w0 of options){
    const w=w0.id;if(!locked&&!s.visibleSurfaces.includes(w))continue;
    const N=w0.inward,a=w0.a,den=rr.direction.x*N.x+rr.direction.z*N.z;if(Math.abs(den)<MIN_DIR)continue;
    const t=((a.x-rr.origin.x)*N.x+(a.z-rr.origin.z)*N.z+offset)/den,p=add(rr.origin,rr.direction,t);
    const local=kitchenWallLocal(R,w,p),bottom=R.height-p.y,z=depth(s,p);
    if(!locked){
      if(local.u<w0.start-E||local.u>w0.end+E||bottom< -E||bottom>R.height+E)continue;
      // An unclamped start belongs to a real, exposed wall. In particular,
      // clicking a cabinet's front cannot start a new run on the wall behind.
      if(!physical||physical.part!=='surface'||physical.surface!==w||physical.buildingSide&&physical.buildingSide!=='interior')continue;
    }
    if(z>near){near=z;best={wall:w,u:local.u,d:local.d,bottom,world:p};}
  }
  return best;
}
function prism(s,run,start,end,q){
  const rr=ray(s,q),R=room(s);if(!rr||end-start<E)return null;const a=kitchenRunLocal(R,run,rr.origin),b=kitchenRunLocal(R,run,add(rr.origin,rr.direction,1)),yy=R.height-run.bottom-run.height;
  const at=[a.u,rr.origin.y,a.d],v=[b.u-a.u,rr.direction.y,b.d-a.d],mins=[start,yy,0],maxs=[end,yy+run.height,run.depth];
  let lo=-Infinity,hi=Infinity;
  for(let i=0;i<3;i++){if(Math.abs(v[i])<E){if(at[i]<mins[i]-E||at[i]>maxs[i]+E)return null;continue;}
    const p=(mins[i]-at[i])/v[i],q=(maxs[i]-at[i])/v[i];lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));if(hi<lo-E)return null;}
  return finite(hi)?add(rr.origin,rr.direction,hi):null;
}
function identify(s,kind,id,run,world,extra={}){
  const local=run?kitchenRunLocal(room(s),run,world):null;
  return {kind,id,runId:run?.id,wall:run?.wall??extra.wall??null,world,planeY:world.y,...(local?{u:local.u,d:local.d}:{}),...extra};
}
export function pickVolume(s,q,{layer='all',intent='select'}={}){
  q=qPoint(q);if(!live(s)||!q)return null;
  const g=s.geometry,H=s.hitTest(q.x,q.y),R=g.room;
  // Physical, visible occupants get priority over unbuilt guide volumes.
  // A layer filter is NOT an x-ray into the run behind the visible cabinet.
  if(H&&H.part!=='surface'){
    if(H.part==='fixture')return ['select','feature'].includes(intent)?identify(s,'feature',H.id,null,H.world,{wall:H.wall,bottom:R.height-H.world.y,material:H}):null;
    const unitId=H.part==='module'?H.id:H.unitId,unit=unitId&&g.units.find(v=>v.id===unitId),r=g.runs.find(v=>v.id===(unit?.runId||H.runId));
    if(!r||!layerOK(r,layer)||intent==='feature')return null;
    return identify(s,intent==='select'&&unit?'unit':'run',intent==='select'&&unit?unit.id:r.id,r,H.world,{unitId:unit?.id,material:H});
  }
  if(H?.part==='surface'&&H.sitePointId&&intent==='select')return {kind:'surface',surface:'floor',world:H.world,planeY:H.world.y,sitePointId:H.sitePointId,siteKind:H.siteKind};
  if(intent!=='feature'){
    let winner=null,nearest=-Infinity;for(const r of g.runs){if(!layerOK(r,layer))continue;
      for(const gap of r.gaps||[]){const p=prism(s,r,gap.start,gap.end,q);if(!p)continue;
        const z=depth(s,p);if(z<=nearest||H&&depth(s,H.world)>z+SEP)continue;nearest=z;winner=identify(s,'run',r.id,r,p,{empty:true,gap:{start:gap.start,end:gap.end}});}
    }if(winner)return winner;
  }
  return H?.part==='surface'?{kind:'surface',surface:H.surface,sitePointId:H.sitePointId,siteKind:H.siteKind,wall:architectureWall(R,H.surface)?H.surface:null,world:H.world,planeY:H.world.y,bottom:R.height-H.world.y}:null;
}
function frontVisible(s,p){
  const a=s.projection.projectPoint(p),bounds=s.bounds;if(!finite(a.x)||!finite(a.y)||a.x<bounds.x||a.x>bounds.x+bounds.w||a.y<bounds.y||a.y>bounds.y+bounds.h)return false;
  const hit=s.hitTest(a.x,a.y);return !hit||depth(s,hit.world)<=a.depth+SEP;
}
function local(s,r,u,d,y){const p=kitchenRunPoint(room(s),r,u,d);return xyz(p.x,y,p.z);}
function onWireInside(lo,hi,a,b){
  if(a< -E&&b< -E)return null;if(a>=-E&&b>=-E)return [lo,hi];
  const t=-a/(b-a);return a<0?[Math.max(lo,t),hi]:[lo,Math.min(hi,t)];
}
// Analytic clipping against the projected, BSP-split physical faces supplied
// by renderKitchenRoom. A long dashed guide cannot pass through a nearer
// piece of timber simply because its midpoint happened to be unobstructed.
function visibleSegments(s,a,b){
  const P=s.projection,A=P.projectPoint(a),B=P.projectPoint(b),dx=B.x-A.x,dy=B.y-A.y;
  if(dx*dx+dy*dy<E)return [];
  const faces=s.editOccluders;if(!faces)return frontVisible(s,lerp(a,b,.5))?[[A,B]]:[];
  const minX=Math.min(A.x,B.x),maxX=Math.max(A.x,B.x),minY=Math.min(A.y,B.y),maxY=Math.max(A.y,B.y),ranges=[];
  for(const r of faces){
    if(minX>r.x1+E||maxX<r.x0-E||minY>r.y1+E||maxY<r.y0-E)continue;
    const f=r.f,den=dot(f.N,P.eye);if(den<E)continue;
    const nearA=f.D-dot(f.N,a)-SEP*den,nearB=f.D-dot(f.N,b)-SEP*den;let interval=onWireInside(0,1,nearA,nearB);if(!interval)continue;
    for(let i=0;i<r.ps.length;i++){
      const x=r.ps[i],y=r.ps[(i+1)%r.ps.length],ex=y.x-x.x,ey=y.y-x.y,f0=ex*(A.y-x.y)-ey*(A.x-x.x),f1=f0+ex*dy-ey*dx;
      interval=onWireInside(interval[0],interval[1],f0,f1);if(!interval||interval[0]>=interval[1]-E){interval=null;break;}
    }if(interval){if(interval[0]<E&&interval[1]>1-E)return [];ranges.push(interval);}
  }
  if(!ranges.length)return [[A,B]];ranges.sort((u,v)=>u[0]-v[0]);let t=0,out=[];
  const p=t=>({x:A.x+dx*t,y:A.y+dy*t});
  for(const [l,h] of ranges){if(l>t+E)out.push([p(t),p(l)]);t=Math.max(h,t);if(t>=1-E)break;}if(t<1-E)out.push([p(t),p(1)]);return out;
}
const subpath=segments=>segments.map(([a,b])=>'M'+n(a.x)+' '+n(a.y)+'L'+n(b.x)+' '+n(b.y)).join('');
function edges(s,poly,bottom,height,hard=false){
  if(!Array.isArray(poly)||poly.length<3||!finite(bottom)||!finite(height))return '';
  const y=room(s).height-bottom-height,a=poly.map(p=>xyz(p.x,y,p.z)),b=poly.map(p=>xyz(p.x,y+height,p.z));
  const line=(u,v)=>subpath(hard?[[s.projection.projectPoint(u),s.projection.projectPoint(v)]]:visibleSegments(s,u,v));
  return a.map((p,i)=>{const j=(i+1)%a.length;return line(p,a[j])+line(b[i],b[j])+line(p,b[i]);}).join('');
}
const countFormat=new Intl.NumberFormat('ar');
function runTitle(r,g){
  if(isFreeKitchenRun(r))return 'جزيرة '+countFormat.format(g.runs.filter(isFreeKitchenRun).findIndex(v=>v.id===r.id)+1);
  return (r.tier==='upper'?'علوي · ':'أرضي · ')+({back:'الخلف',front:'الأمام',left:'اليسار',right:'اليمين'}[r.wall]||'الجدار');
}

const vecs={move:'M-5 0H5M0-5V5M-5 0l2-2m-2 2l2 2M5 0l-2-2m2 2l-2 2M0-5l-2 2m2-2l2 2M0 5l-2-2m2 2l2-2',rotate:'M4-2a4.8 4.8 0 1 0 .3 3.5M4-5v3.3H.7',width:'M-5 0H5M-5 0l2-2m-2 2l2 2M5 0l-2-2m2 2l-2 2'};
function handle(s,id,kind,caption,world,px,angle=0){
  const q=s.projection.projectPoint(world),icon=kind==='island-rotate'?'rotate':kind==='island-move'?'move':'width';
  const degrees=((angle%180)+180)%180,axis=degrees<22.5||degrees>=157.5?'x':degrees<67.5?'diagonal-down':degrees<112.5?'z':'diagonal-up';
  return `<g data-k-handle="${kind}" data-k-owner="${esc(id)}" data-k-axis="${axis}" data-k-x="${n(world.x)}" data-k-y="${n(world.y)}" data-k-z="${n(world.z)}" transform="translate(${n(q.x)} ${n(q.y)}) scale(${n(px)})" role="group" aria-roledescription="مقبض سحب" aria-label="${esc(caption)}" pointer-events="visiblePainted"><title>${esc(caption)}</title><circle r="10.5" fill="transparent"/><circle r="7.7" fill="${icon==='move'?'#365c4b':'#775334'}" stroke="#fffae8" stroke-width="1.35"/><path d="${vecs[icon]}" transform="rotate(${icon==='width'?n(angle):0})" fill="none" stroke="#fff9e4" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/></g>`;
}
function tag(s,r,p,px,selected){const q=s.projection.projectPoint(p),name=runTitle(r,s.geometry),w=12+name.length*6.7;
  return `<g data-k-v-run="${esc(r.id)}" data-k-id="${esc(r.id)}" data-k-kind="run" transform="translate(${n(q.x)} ${n(q.y)}) scale(${n(px)})" role="group" aria-label="اختيار ${esc(name)}" pointer-events="visiblePainted"><title>اختيار ${esc(name)}</title><rect x="${n(-w/2)}" y="-7.5" width="${n(w)}" height="15" rx="4" fill="${selected?'#d8c99e':'#f0eddd'}" stroke="#7c806c" stroke-width=".75"/><text x="0" y=".3" text-anchor="middle" dominant-baseline="central" direction="rtl" fill="#384b3e" font-family="Tahoma,Arial,sans-serif" font-size="10" pointer-events="none">${esc(name)}</text></g>`;}
function resolveDraft(s,d){
  if(!d)return null;if(Array.isArray(d.polygon))return d;
  const R=room(s),tier=d.tier||'base',run={...d,start:d.start??0,end:d.end??d.length,depth:d.depth??(tier==='upper'?34:60)};
  if(!finite(run.end)||!finite(run.start)||!finite(run.depth)||run.depth<=0)return null;
  const start=Math.min(run.start,run.end),width=Math.abs(run.end-run.start);if(width<E)return null;
  return {...d,polygon:kitchenRunPolygon(R,run,start,width,run.depth),bottom:d.bottom??(tier==='upper'?145:0),height:d.height??(tier==='upper'?70:86)};
}
export function volumeEditOverlay(s,o={}){
  if(!live(s)||o.clean)return '';const g=s.geometry,R=g.room,px=Math.max(.09,Math.min(9,finite(o.px)?o.px:1)),tool=o.tool||'select',sel=o.selected||{},gs=o.gesture;
  const target=g.runs.find(r=>r.id===(sel.kind==='run'?sel.id:null)),unitSel=g.units.find(u=>u.id===(sel.kind==='unit'?sel.id:null));
  const relevant=g.runs.filter(r=>layerOK(r,o.layer)),drawTags=tool==='select'||tool==='unit',reserve=[],icons=[],labels=[];let guides='',draft='';
  const guard=(p,spacing)=>{const q=s.projection.projectPoint(p),b=s.bounds;return q.x>=b.x+8*px&&q.x<=b.x+b.w-8*px&&q.y>=b.y+8*px&&q.y<=b.y+b.h-8*px&&!reserve.some(k=>Math.hypot(q.x-k.x,q.y-k.y)<(k.r+spacing)*px)&&frontVisible(s,p);};
  const reserveAt=(p,r)=>reserve.push({...s.projection.projectPoint(p),r});
  const topY=(r,u)=>{const cap=g.worktops.find(t=>t.runId===r.id&&u>=t.start-E&&u<=t.end+E);return R.height-(cap?cap.bottom+cap.height:r.bottom+r.height);};
  if(!gs?.moved&&tool==='select'&&unitSel&&o.allowWidth!==false&&!kitchenUnitSpecs[unitSel.kind]?.fixedWidth){
    const r=g.runs.find(r=>r.id===unitSel.runId);if(r&&layerOK(r,o.layer)){
      const u=unitSel.u+unitSel.width,y=Math.min(R.height-unitSel.bottom-unitSel.height,topY(r,u))-.12,vh=R.height-unitSel.bottom;
      const choices=[local(s,r,u,r.depth*.73,y),local(s,r,u,r.depth*.34,y),local(s,r,u,r.depth,y),local(s,r,u,0,y),local(s,r,u,r.depth+.07,y+4),local(s,r,u,0,vh-4),local(s,r,u,r.depth+.1,vh-4)];
      const p=choices.find(p=>guard(p,9));if(p){const a=s.projection.projectPoint(p),next=local(s,r,u+1,kitchenRunLocal(R,r,p).d,p.y),b=s.projection.projectPoint(next),angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(Math.hypot(b.x-a.x,b.y-a.y)>=MIN_DIR){icons.push(handle(s,unitSel.id,'width','اسحب لتغيير عرض الوحدة من طرفها',p,px,angle));reserveAt(p,10);}}
    }
  }
  if(!gs?.moved&&tool==='select'&&target?.wall&&layerOK(target,o.layer)){
    const r=target,Y=R.height-r.bottom-r.height;
    const fractions=[.5,.30,.70,.12,.88],samples=fractions.map(f=>r.start+(r.end-r.start)*f);
    // Counters are discontinuous at e.g. full-height appliances. Anchor to a
    // real visible counter edge before trying the nominal cabinet envelope.
    const counters=g.worktops.filter(t=>t.runId===r.id).sort((a,b)=>(b.end-b.start)-(a.end-a.start));
    const counterEdges=counters.flatMap(t=>fractions.map(f=>local(s,r,t.start+(t.end-t.start)*f,t.depth,R.height-t.bottom-t.height-.25)));
    const choices=[...counterEdges,...samples.flatMap(u=>[local(s,r,u,r.depth,topY(r,u)-.25),local(s,r,u,r.depth+2.6,Y+5),local(s,r,u,r.depth+2.6,Y+r.height*.5),local(s,r,u,r.depth+2.6,Y+r.height-3)])];
    const p=choices.find(v=>guard(v,10));
    if(p){
      const l=kitchenRunLocal(R,r,p),a=s.projection.projectPoint(p),b=s.projection.projectPoint(local(s,r,l.u,l.d+1,p.y));
      if(Math.hypot(b.x-a.x,b.y-a.y)>=MIN_DIR){const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
        icons.push(handle(s,r.id,'run-depth','اسحب لتغيير عمق الصف '+(r.tier==='upper'?'العلوي':'السفلي'),p,px,angle));reserveAt(p,11);}
    }
  }
  if(!gs?.moved&&tool==='select'&&target&&isFreeKitchenRun(target)&&layerOK(target,o.layer)&&Math.abs(s.projection.eye.y)>=MIN_DIR){
    const r=target,mid=(r.start+r.end)/2;
    const tryHandle=(kind,label,positions)=>{const p=positions.find(p=>guard(p,10));if(p){icons.push(handle(s,r.id,kind,label,p,px));reserveAt(p,10);}};
    const m=[.5,.38,.68,.2,.84].flatMap(f=>{const u=r.start+(r.end-r.start)*f,y=topY(r,u)-.15;return [local(s,r,u,r.depth*.5,y),local(s,r,u,r.depth*.86,y),local(s,r,u,r.depth*.14,y),local(s,r,u,r.depth+.1,y+7),local(s,r,u,-.1,y+7)];});
    tryHandle('island-move','اسحب لتحريك الجزيرة',m);
    const rot=[r.end,r.start,r.end-(r.length*.12)].flatMap(u=>{const y=topY(r,u)-.22;return [.75,.22,1,0].map(f=>local(s,r,u,r.depth*f,y));});
    tryHandle('island-rotate','اسحب لتدوير الجزيرة حول مركزها',rot);
  }
  if(o.showGuides!==false){
    for(const r of relevant){
      const selected=target?.id===r.id,lineColor=selected?'#786538':r.tier==='upper'?'#667d84':'#677d67';
      for(const gap of r.gaps||[]){
        const poly=kitchenRunPolygon(R,r,gap.start,gap.end-gap.start,r.depth),d=edges(s,poly,r.bottom,r.height);
        if(d)guides+=`<path data-k-empty-run="${esc(r.id)}" data-k-tier="${esc(r.tier)}" d="${d}" stroke="${lineColor}" stroke-opacity=".77" stroke-width="${n((selected?1.4:1.05)*px)}" stroke-dasharray="${n(4*px)} ${n(3*px)}" stroke-linejoin="round" fill="none" pointer-events="none"/>`;
      }
    }
    if(drawTags&&!gs?.moved)for(const r of [...relevant].sort((a,b)=>Number(b.id===target?.id)-Number(a.id===target?.id))){
      const chosen=r.id===target?.id,positions=[.5,.25,.75,.12,.88].flatMap(v=>{const u=r.start+(r.end-r.start)*v,y=topY(r,u)-.25;return [local(s,r,u,r.depth*.20,y),local(s,r,u,r.depth*.67,y),local(s,r,u,r.depth+.12,y+6),local(s,r,u,-.12,y+6)];});
      const p=positions.find(p=>guard(p,24));if(p){labels.push(tag(s,r,p,px,chosen));reserveAt(p,24);}
    }
  }
  const proposed=resolveDraft(s,o.draft||gs?.draft),blocked=o.block||gs?.block;
  if(proposed){const ok=proposed.ok??gs?.result?.ok??true,d=edges(s,proposed.polygon,proposed.bottom??0,proposed.height??86,true);
    if(d)draft+=`<path data-k-draft="${ok?'valid':'blocked'}" d="${d}" fill="none" stroke="${ok?'#2d785a':'#b44336'}" stroke-width="${n(1.7*px)}" stroke-dasharray="${n(6*px)} ${n(3*px)}"/>`;
  }
  if(blocked?.run&&finite(blocked.limit)){const r=blocked.run,u=blocked.limit,y=R.height-r.bottom-r.height,z=blocked.depth??r.depth,ps=[local(s,r,u,0,y),local(s,r,u,z,y),local(s,r,u,z,y+r.height),local(s,r,u,0,y+r.height)].map(s.projection.projectPoint);
    draft+=`<polygon data-k-blocked="" points="${ps.map(p=>n(p.x)+','+n(p.y)).join(' ')}" fill="#b34432" fill-opacity=".19" stroke="#a53d32" stroke-width="${n(1.4*px)}"/>`;}
  return `<g data-k-volume-edit="">${guides}<g pointer-events="none">${draft}</g>${labels.join('')}${icons.join('')}</g>`;
}
