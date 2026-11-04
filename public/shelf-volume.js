import {ownKey} from './kitchen-safe-keys.js';
// World: cm, x right / y down / z from wall towards viewer. Rotation has a
// FIXED world origin, independent of the cabinet and its depth. A and B can
// therefore use the same viewBox, photo registration and physical scale.
import {SHELF_LIMITS,shelfDepthLimits} from './shelf-model.js';
import {scopedCells,scopedDividers} from './shelf-selection-model.js';
import {effectiveFinish} from './shelf-group-finish.js';
import {buildVolumeArt} from './shelf-volume-contents.js';

const EPS=1e-7,rad=Math.PI/180;
const clamp=(x,lo,hi,alt)=>Math.min(hi,Math.max(lo,Number.isFinite(x)?x:alt));
const n=v=>Number(v.toFixed(5)),att=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pt=(x,y,z)=>({x,y,z}),sub=(a,b)=>pt(a.x-b.x,a.y-b.y,a.z-b.z),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>pt(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const norm=q=>{const m=Math.hypot(q.x,q.y,q.z);return m>EPS?pt(q.x/m,q.y/m,q.z/m):null;};
const front=pt(0,0,1),left=pt(-1,0,0),right=pt(1,0,0),top=pt(0,-1,0),bottom=pt(0,1,0);
const XY=(x,y,w,h,z)=>[pt(x,y,z),pt(x+w,y,z),pt(x+w,y+h,z),pt(x,y+h,z)];
const YZ=(x,y,h,z,d)=>[pt(x,y,z),pt(x,y+h,z),pt(x,y+h,z+d),pt(x,y,z+d)];
const XZ=(x,y,w,z,d)=>[pt(x,y,z),pt(x+w,y,z),pt(x+w,y,z+d),pt(x,y,z+d)];
const xyOf=ps=>ps.map(p=>n(p.x)+','+n(p.y)).join(' ');
const worldDepth=(plan,opt={})=>clamp(opt.depth??plan.depth,shelfDepthLimits.min,shelfDepthLimits.max,shelfDepthLimits.initial);
export const volumeCameraLimits=Object.freeze({minYaw:-55,maxYaw:55,minPitch:-15,maxPitch:32,defaultYaw:24,defaultPitch:12});
const floorDepth=(p,d)=>Math.max(d+12,clamp(p.wall.h*.28,25,86,56));
export function makeShelfProjection(plan,opts={}){
  const yaw=clamp(opts.yaw,-55,55,24),pitch=clamp(opts.pitch,-15,32,12),depth=worldDepth(plan,opts);
  const cy=Math.cos(yaw*rad),sy=Math.sin(yaw*rad),cp=Math.cos(pitch*rad),sp=Math.sin(pitch*rad);
  const u=pt(cy,0,-sy),v=pt(sy*sp,cp,cy*sp),eye=pt(sy*cp,-sp,cy*cp);
  const project=(x,y,z=0)=>({x:cy*x-sy*z,y:sp*sy*x+cp*y+sp*cy*z,depth:eye.x*x+eye.y*y+eye.z*z});
  const unproject=(sx,sy0,z=0)=>{const x=(sx+sy*z)/cy;return pt(x,(sy0-v.x*x-v.z*z)/cp,z);};
  const projectPoint=(p,z=p.z??0)=>project(p.x,p.y,z),unprojectPoint=(p,z=0)=>unproject(p.x,p.y,z);
  const c=plan.cab,w=plan.wall,f=floorDepth(plan,depth);
  const samples=[...XY(0,0,w.w,w.h,0),...XZ(0,w.h,w.w,0,f),...XY(c.x,c.y,c.w,c.h,depth)].map(p=>projectPoint(p));
  const pad=clamp(opts.pad??Math.max(5,Math.min(w.w,w.h)*.022),0,100,7);
  const xs=samples.map(p=>p.x),ys=samples.map(p=>p.y),x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;
  const bounds={x,y,w:Math.max(...xs)+pad-x,h:Math.max(...ys)+pad-y};
  const viewBox=[bounds.x,bounds.y,bounds.w,bounds.h].map(n).join(' ');
  return {yaw,pitch,depth,u,v,eye,project,unproject,projectPoint,unprojectPoint,bounds,viewBox};
}

const woods={oak:'#c69b68',walnut:'#79563f',ivory:'#e2dfd2'};
const walls={sand:['#f2eadc','#d8c9b0'],sage:['#e2e9dc','#c3d0ba'],stone:['#edebea','#c9c6c2']};
function tint(hex,k){const h=/^#[\da-f]{6}$/i.test(hex)?hex:'#ac997f';return '#'+[1,3,5].map(i=>Math.min(255,Math.max(0,Math.round(parseInt(h.slice(i,i+2),16)*k))).toString(16).padStart(2,'0')).join('');}
function face(points,meta){const normal=meta.normal||norm(cross(sub(points[1],points[0]),sub(points[2],points[0])));if(!normal)return null;return {...meta,points,N:normal,D:dot(normal,points[0])};}
function add(arr,pts,meta){const f=face(pts,meta);if(f)arr.push(f);}
function normalizeWood(w){return ownKey(woods,w)?w:'oak';}
const meshCache=new WeakMap();
function mesh(plan,depth){
  const old=meshCache.get(plan);if(old?.depth===depth)return old;
  const f=SHELF_LIMITS.frame,c=plan.cab,x=c.x,y=c.y,w=c.w,h=c.h,z=depth,back=Math.min(1,depth*.16),finish=normalizeWood(plan.finish);
  const cells=scopedCells(plan),boards=scopedDividers(plan).filter(d=>d.kind==='cabinet'),faces=[];
  const wood=(part,side,normal,mat=finish,extra={})=>({part,face:side,normal,mat,...extra});
  // Only exposed boundary surfaces of the joined wooden shell. Do not emit
  // internal coplanar caps on the joint between a shelf and its support.
  // The wall editor never sees this rear face; the room orbit can look
  // through a cut-away supporting wall from behind or exactly edge-on.
  add(faces,XY(x,y,w,h,0),wood('frame','back',pt(0,0,-1),finish,{axis:'col',shade:.85}));
  for(const [side,normal,pts] of [['left',left,YZ(x,y,h,0,z)],['right',right,YZ(x+w,y,h,0,z)],['top',top,XZ(x,y,w,0,z)],['bottom',bottom,XZ(x,y+h,w,0,z)]])
    add(faces,pts,wood('frame',side,normal));
  for(const [rx,ry,rw,rh,axis] of [[x,y,f,h,'col'],[x+w-f,y,f,h,'col'],[x+f,y,w-2*f,f,'row'],[x+f,y+h-f,w-2*f,f,'row']])
    add(faces,XY(rx,ry,rw,rh,z),wood('frame','front',front,finish,{axis}));
  for(const d of boards)add(faces,XY(d.x,d.y,d.w,d.h,z),wood('divider','front',front,finish,{dividerId:d.id,axis:d.axis}));
  // Index each real board face (not just its centre): a nested local board
  // has a short span and must not capture another coplanar board's wall.
  const idx=new Map(),qkey=(ax,pos)=>ax+':'+Math.round(pos*1e6);
  for(const d of boards){const vert=d.axis==='col',a=vert?d.x:d.y,extent=vert?d.w:d.h;for(const pos of [a,a+extent]){const k=qkey(d.axis,pos);if(!idx.has(k))idx.set(k,[]);idx.get(k).push(d);}}
  function touching(axis,pos,at){return (idx.get(qkey(axis,pos))||[]).find(d=>axis==='col'?at>=d.y-EPS&&at<=d.y+d.h+EPS:at>=d.x-EPS&&at<=d.x+d.w+EPS);}
  for(const r of cells){const a=r.x,b=r.y,rw=r.w,rh=r.h,mat=normalizeWood(effectiveFinish(plan,r.key));
    add(faces,XY(a,b,rw,rh,back),wood('cell','back',front,mat,{key:r.key,axis:'col',shade:.90}));
    for(const [ax,pos,mid,name,normal,pts] of [
      ['col',a,b+rh/2,'right',right,YZ(a,b,rh,back,z-back)],['col',a+rw,b+rh/2,'left',left,YZ(a+rw,b,rh,back,z-back)],
      ['row',b,a+rw/2,'bottom',bottom,XZ(a,b,rw,back,z-back)],['row',b+rh,a+rw/2,'top',top,XZ(a,b+rh,rw,back,z-back)]
    ]){const d=touching(ax,pos,mid);add(faces,pts,wood(d?'divider':'frame',name,normal,mat,{key:r.key,axis:ax,dividerId:d?.id,shade:.90}));}
  }
  for(const art of buildVolumeArt(plan,{depth})){
    const screen=art.kind==='screen',meta={part:screen?'screen':'art',face:'surface',key:art.key,kind:art.kind,tag:art.tag,diagnostic:!!art.diagnostic,fill:art.fill,twoSided:!!art.twoSided};add(faces,art.points,meta);
  }
  // Keep all back panels and front rails unfragmented. They are parallel
  // global occlusion planes; arbitrary BSP cuts through those broad visible
  // surfaces create antialiased seams where no physical join exists.
  const byFront=planeLayers(faces,depth),byBack=planeLayers(byFront.neg,back);
  const middle={N:front,co:byBack.co,neg:bsp(byBack.neg),pos:bsp(byBack.pos)};
  const scene={faces,depth,tree:{N:front,co:byFront.co,neg:middle,pos:bsp(byFront.pos)}};meshCache.set(plan,scene);return scene;
}

// Binary space partition in WORLD space. A board can be the height of the
// entire cabinet: sorting polygons by average depth would paint over nearby
// objects at one end. Split straddling convex faces at physical face planes
// and traverse far to near. The tree is reusable when the camera rotates.
function classify(f,N,D){let pos=false,neg=false;for(const p of f.points){const ds=dot(N,p)-D;if(ds>EPS)pos=true;else if(ds<-EPS)neg=true;if(pos&&neg)return 3;}return pos?1:neg?2:0;}
function split(f,N,D){
  const a=[],b=[],v=f.points;let p=v[v.length-1],dp=dot(N,p)-D;
  for(const q of v){const dq=dot(N,q)-D;if(dp>EPS&&dq<-EPS||dp<-EPS&&dq>EPS){const t=dp/(dp-dq),m=pt(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,p.z+(q.z-p.z)*t);a.push(m);b.push(m);}
    if(dq>=-EPS)a.push(q);if(dq<=EPS)b.push(q);p=q;dp=dq;
  }return [a,b].map(points=>points.length>=3?{...f,points}:null);
}
function planeLayers(faces,z){
  const pos=[],neg=[],co=[];
  for(const f of faces){const side=classify(f,front,z);if(!side)co.push(f);else if(side===1)pos.push(f);else if(side===2)neg.push(f);else{const [p,m]=split(f,front,z);if(p)pos.push(p);if(m)neg.push(m);}}
  return {pos,neg,co};
}
function bsp(faces){
  if(!faces.length)return null;
  // A balanced sample keeps large and nested layouts practical. Prefer
  // partitions that do not cut faces, and group coplanar pieces together.
  let best=faces[0],score=Infinity;const count=Math.min(faces.length,12);
  for(let i=0;i<count;i++){const f=faces[Math.floor(i*faces.length/count)],N=f.N,D=f.D;let p=0,m=0,k=0;
    for(const a of faces){const v=classify(a,N,D);if(v===3)k++;else if(v===1)p++;else if(v===2)m++;}
    const s=6*k+Math.abs(p-m)-.25*(faces.length-p-m-k);if(s<score){best=f;score=s;}}
  const N=best.N,D=best.D,co=[],pos=[],neg=[];
  for(const f of faces){const v=classify(f,N,D);if(!v)co.push(f);else if(v===1)pos.push(f);else if(v===2)neg.push(f);else{const [p,m]=split(f,N,D);if(p)pos.push(p);if(m)neg.push(m);}}
  if(!co.length){ // Protect against malformed nonplanar input, not scene order.
    co.push(best);for(const a of [pos,neg])for(let i=a.length-1;i>=0;i--)if(a[i]===best||a[i].points.every(p=>best.points.includes(p)))a.splice(i,1);
  }
  return {N,co,pos:bsp(pos),neg:bsp(neg)};
}
function visit(node,eye,fn){if(!node)return;const positive=dot(node.N,eye)>=0;visit(positive?node.neg:node.pos,eye,fn);node.co.forEach(fn);visit(positive?node.pos:node.neg,eye,fn);}

function safePhoto(url){if(typeof url!=='string')return '';if(/^data:image\/(png|jpeg|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(url))return url;if(/^blob:/.test(url)){try{return typeof location!=='undefined'&&new URL(url).origin===location.origin?url:'';}catch{}}return '';}
function pointInside(x,y,ps){let sign=0;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],d=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(d)<EPS)continue;const s=Math.sign(d);if(sign&&s!==sign)return false;sign=s;}return true;}
const light=norm(pt(-.44,-.74,.86));
function labelAttrs(f,d){return 'data-vol-part="'+f.part+'" data-vol-face="'+f.face+'"'+(f.dividerId?' data-vol-divider="'+att(f.dividerId)+'"':'')+(f.key&&f.part!=='screen'?' data-vol-cell="'+att(f.key)+'"':'')+(f.part==='art'?' data-shelf-art-key="'+att(f.key)+'" data-shelf-art-kind="'+att(f.kind)+'"':'')+(f.tag?' data-vol-tag="'+att(f.tag)+'"':'')+(f.mat?' data-vol-finish="'+f.mat+'"':'')+(f.diagnostic?' data-vol-diagnostic="" pointer-events="none"':'')+(f.points.every(p=>Math.abs(p.z-f.points[0].z)<EPS)?' data-vol-z="'+n(f.points[0].z)+'"':'');}
export function renderShelfVolume(plan,opts={}){
  const P=opts.projection||makeShelfProjection(plan,opts),depth=worldDepth(plan,opts),prefix=String(opts.prefix||'vol').replace(/[^a-zA-Z0-9_-]/g,'_');
  const project=p=>P.projectPoint(p),path=ps=>xyOf(ps.map(project)),w=plan.wall,c=plan.cab,wall=walls[plan.wallColor]||walls.sand,f=floorDepth(plan,depth),scene=mesh(plan,depth);
  const patterns=new Map(),records=[],ww=XY(0,0,w.w,w.h,0),ff=XZ(0,w.h,w.w,0,f);
  function record(face,ps){if(face.diagnostic)return;const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);records.push({face,ps,x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)});}
  function style(face){
    let N=face.N;if(face.twoSided&&dot(N,P.eye)<0)N=pt(-N.x,-N.y,-N.z);
    const amount=.76+.28*Math.max(0,dot(N,opts.lightDirection||light));if(!face.mat)return face.diagnostic?'#c95739':tint(face.fill,amount);
    const axis=face.face==='front'||face.face==='back'?(face.axis==='row'?'xy':'yx'):face.face==='top'||face.face==='bottom'?'xz':'yz',key=face.mat+'-'+axis+'-'+face.face+'-'+(face.shade||1);
    if(!patterns.has(key)){
      const id=prefix+'-wood-'+patterns.size,m=face.mat,shade=(face.shade||1)*amount,base=tint(woods[m],shade),grain=m==='ivory'?.12:.36;
      const o=P.project(0,0,0),vecA=axis==='xy'||axis==='xz'?P.project(1,0,0):P.project(0,1,0);
      const l=axis==='xy'?P.project(0,1,0):axis==='yx'?P.project(1,0,0):P.project(0,0,1);
      const a={x:vecA.x-o.x,y:vecA.y-o.y},b={x:l.x-o.x,y:l.y-o.y};
      patterns.set(key,{id,html:`<pattern id="${id}" patternUnits="userSpaceOnUse" width="28" height="5.5" patternTransform="matrix(${n(a.x)} ${n(a.y)} ${n(b.x)} ${n(b.y)} 0 0)"><rect width="28.04" height="5.54" fill="${base}"/><g fill="none" stroke="${tint(base,.73)}" opacity="${grain}" stroke-width=".17"><path d="M-.3 1.3C6 .8 10 2.6 17 1.4S25 .9 28.3 1.3M-.3 4.3Q8 3.2 15 4.4T28.3 4.1"/></g><path d="M3 2.8q4 -.6 8 .05m8 .8q2 .2 5 -.16" fill="none" stroke="${tint(base,1.22)}" opacity=".38" stroke-width=".13"/></pattern>`});
    }return 'url(#'+patterns.get(key).id+')';
  }
  const plw=face(ww,{part:'wall',face:'back',normal:front}),plf=face(ff,{part:'floor',face:'top',normal:top});
  if(!opts.cabinetOnly){record(plw,ww.map(project));if(P.pitch>EPS)record(plf,ff.map(project));}
  const photo=safePhoto(opts.photoUrl),p0=P.project(0,0,0),px=P.project(1,0,0),py=P.project(0,1,0),matrix=`matrix(${n(px.x)} ${n(px.y)} ${n(py.x)} ${n(py.y)} ${n(p0.x)} ${n(p0.y)})`;
  const floor=P.pitch>EPS?`<polygon data-vol-part="floor" data-vol-face="top" points="${path(ff)}" fill="url(#${prefix}-floor)"/>`+Array.from({length:Math.max(0,Math.floor(w.w/38))},(_,i)=>{const xx=(i+1)*38;return `<polyline points="${path([pt(xx,w.h,0),pt(xx,w.h,f)])}" fill="none" stroke="#ad9c86" stroke-width=".36" opacity=".52" pointer-events="none"/>`;}).join(''):'';
  const wallHtml=`<defs><linearGradient id="${prefix}-wall" x2=".8" y2="1"><stop stop-color="${wall[0]}"/><stop offset="1" stop-color="${wall[1]}"/></linearGradient><linearGradient id="${prefix}-floor" x2=".3" y2="1"><stop stop-color="#afa08a"/><stop offset=".24" stop-color="#caba9f"/><stop offset="1" stop-color="#e0d3be"/></linearGradient><filter id="${prefix}-shadow" x="-.3" y="-.3" width="1.6" height="1.65"><feGaussianBlur stdDeviation="${n(Math.min(4.8,depth*.075))}"/></filter><clipPath id="${prefix}-wallclip"><polygon points="${path(ww)}"/></clipPath></defs><polygon data-vol-part="wall" data-vol-face="back" points="${path(ww)}" fill="url(#${prefix}-wall)"/>${photo?`<image data-vol-wall-photo="" href="${att(photo)}" x="0" y="0" width="${w.w}" height="${w.h}" transform="${matrix}" preserveAspectRatio="none" pointer-events="none"/>`:`<g transform="${matrix}" pointer-events="none"><rect x="0" y="${n(w.h-3.1)}" width="${w.w}" height="3.1" fill="${wall[0]}"/><path d="M0 ${n(w.h-3.1)}H${w.w}" stroke="${wall[1]}" stroke-width=".5"/></g>`}${floor}`;
  const shadow=`<g clip-path="url(#${prefix}-wallclip)" pointer-events="none"><polygon points="${path(XY(c.x+depth*.13,c.y+depth*.18,c.w,c.h,0))}" fill="#382e24" fill-opacity=".24" filter="url(#${prefix}-shadow)"/></g>`;
  let solids='';const backWash=prefix+'-back-wash',backTop=prefix+'-back-top';
  visit(scene.tree,P.eye,fc=>{
    const orient=dot(fc.N,P.eye);if(fc.twoSided?Math.abs(orient)<EPS:orient<EPS)return;
    const ps=fc.points.map(project);record(fc,ps);
    const coords=xyOf(ps),paint=style(fc);
    solids+=`<polygon ${labelAttrs(fc,depth)} points="${coords}" fill="${paint}"${fc.mat?' stroke="'+paint+'" stroke-width=".10" stroke-linejoin="round"':''}${fc.diagnostic?' opacity=".65"':''}/>`;
    if(fc.part==='cell'&&fc.face==='back')solids+=`<polygon points="${coords}" fill="url(#${backWash})" pointer-events="none"/><polygon points="${coords}" fill="url(#${backTop})" pointer-events="none"/>`;
  });
  const cabinetHtml=`<defs><radialGradient id="${backWash}" cx=".55" cy=".54" r=".74"><stop offset=".48" stop-color="#34281c" stop-opacity="0"/><stop offset=".91" stop-color="#34281c" stop-opacity=".11"/><stop offset="1" stop-color="#34281c" stop-opacity=".20"/></radialGradient><linearGradient id="${backTop}" x2="0" y2="1"><stop stop-color="#241e17" stop-opacity=".18"/><stop offset=".19" stop-color="#241e17" stop-opacity=".045"/><stop offset=".56" stop-color="#241e17" stop-opacity="0"/></linearGradient>${[...patterns.values()].map(v=>v.html).join('')}</defs>${opts.cabinetOnly?'':shadow}<g data-volume-cabinet="" data-depth="${n(depth)}">${solids}</g>`;
  // Frozen editor projection or arbitrary 360° room orbit. In the latter
  // case z need not increase towards the camera (a side view has constant z).
  function hitTest(x,y){
    if(typeof x==='object'&&x){y=x.y;x=x.x;}if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const ray=P.ray?P.ray(x,y):{origin:P.unproject(x,y,0),direction:P.eye},a=ray.origin,dir=ray.direction;
    let best=null,highest=-Infinity;
    for(const r of records){if(x<r.x0-EPS||x>r.x1+EPS||y<r.y0-EPS||y>r.y1+EPS||!pointInside(x,y,r.ps))continue;const q=r.face,den=dot(q.N,dir);if(Math.abs(den)<EPS)continue;
      const along=(q.D-dot(q.N,a))/den;if(along<highest-EPS)continue;highest=along;const p=pt(a.x+along*dir.x,a.y+along*dir.y,a.z+along*dir.z),z=p.z;
      best={part:q.part,face:q.face,p,z,...(q.key?{key:q.key}:{}),...(q.dividerId?{dividerId:q.dividerId}:{}),...(q.kind?{kind:q.kind}:{}),...(q.tag?{tag:q.tag}:{})};
    }return best;
  }
  return {html:wallHtml+cabinetHtml,wallHtml,cabinetHtml,viewBox:P.viewBox,bounds:P.bounds,projection:P,hitTest,depth};
}

/** Reuse the actual cabinet mesh, material textures and physical hit test.
 * A room camera supplies project/projectPoint, eye in cabinet-local axes,
 * and a ray whose origin and direction are likewise cabinet-local. */
export function renderCabinetForProjection(plan,projection,options={}){
  const r=renderShelfVolume(plan,{...options,projection,cabinetOnly:true});return {html:r.cabinetHtml,hitTest:r.hitTest,depth:r.depth};
}

// Other orthographic room occupants can reuse the same convex-face painter.
export {bsp as buildVolumePartition,visit as visitVolumePartition,classify as classifyVolumeFace,split as splitVolumeFace};
