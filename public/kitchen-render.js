import {faceComponent,openDrawerIndex} from './kitchen-cad-parts.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {renderGrain} from './kitchen-render-grain.js';
import {roomSurfaceLight} from './kitchen-surface-light.js';
import {factoryFrontSurfaces,frontAppearanceSource} from './kitchen-render-factory-fronts.js';
import {paintSelectedParts,factoryHandleMounts} from './kitchen-finish-parts.js';
// Kitchen solids are generated exclusively from kitchenGeometry. Coordinates,
// openings, collisions and counter extents are shared with the plan editor.
import {drawKitchenEquipment} from './kitchen-equipment.js';
import {scopedCells,scopedDividers} from './shelf-selection-model.js';
import {effectiveFinish} from './shelf-group-finish.js';
import {buildVolumeArt} from './shelf-volume-contents.js';
import {kitchenGeometry,kitchenRunPoint,kitchenRunLocal} from './kitchen-model.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {getRoom,wallLocalToRoom} from './shelf-room-model.js';
import {makeRoomProjection} from './shelf-room-render.js';
import {buildKitchenBuilding,wallWorld,wallLocal} from './kitchen-building-render.js';
import {buildVolumePartition,visitVolumePartition,classifyVolumeFace,splitVolumeFace} from './shelf-volume.js';

const E=1e-6,n=v=>Number(v.toFixed(4)),pt=(x,y,z)=>({x,y,z}),sub=(a,b)=>pt(a.x-b.x,a.y-b.y,a.z-b.z),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>pt(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const mag=q=>Math.hypot(q.x,q.y,q.z),unit=q=>{const l=mag(q);return l>E?pt(q.x/l,q.y/l,q.z/l):null;},sum=(a,b)=>pt(a.x+b.x,a.y+b.y,a.z+b.z),mul=(a,k)=>pt(a.x*k,a.y*k,a.z*k);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const tintColor=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s)?s:null;
const cache=new WeakMap(),sun=unit(pt(-.48,-.84,.55));
// The axis-aligned rect is a broad-phase bound only. A 37° island, its
// stone hole and the swept drawer all use the model's actual oriented polygon.
const footprint=o=>Array.isArray(o?.polygon)?o.polygon:[];
function inFoot(q,ps){let sign=0;if(ps.length<3)return false;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],v=(b.x-a.x)*(q.z-a.z)-(b.z-a.z)*(q.x-a.x);if(Math.abs(v)<E)continue;const s=Math.sign(v);if(sign&&s!==sign)return false;sign=s;}return !!sign;}
const atHeight=(ps,y)=>ps.map(p=>pt(p.x,y,p.z));
const basisCache=new WeakMap();
function runBasis(g,id){
  let table=basisCache.get(g);if(!table){table=new Map();basisCache.set(g,table);}
  if(table.has(id))return table.get(id);const r=g.runs.find(v=>v.id===id);if(!r)return null;
  const o=kitchenRunPoint(g.room,r,0,0),x=kitchenRunPoint(g.room,r,1,0),z=kitchenRunPoint(g.room,r,0,1);
  const origin=pt(o.x,0,o.z),T=pt(x.x-o.x,0,x.z-o.z),D=pt(z.x-o.x,0,z.z-o.z);
  const basis={r,origin,T,D,world:p=>pt(origin.x+p.x*T.x+p.z*D.x,p.y,origin.z+p.x*T.z+p.z*D.z),local:p=>kitchenRunLocal(g.room,r,p)};
  table.set(id,basis);return basis;
}
function inRun(b,o){
  const ps=footprint(o).map(b.local);if(ps.length<3)return null;
  const xs=ps.map(q=>q.u),zs=ps.map(q=>q.d),x=Math.min(...xs),z=Math.min(...zs);
  return {x,z,w:Math.max(...xs)-x,d:Math.max(...zs)-z};
}
function validRect(r){return r&&[r.x,r.z,r.w,r.d].every(Number.isFinite)&&r.w>0&&r.d>0;}
const XY=(x,y,w,h,z)=>[pt(x,y,z),pt(x+w,y,z),pt(x+w,y+h,z),pt(x,y+h,z)];
const XZ=(x,y,z,w,d)=>[pt(x,y,z),pt(x+w,y,z),pt(x+w,y,z+d),pt(x,y,z+d)];
const YZ=(x,y,z,h,d)=>[pt(x,y,z),pt(x,y+h,z),pt(x,y+h,z+d),pt(x,y,z+d)];
const edgedFronts=new Set(['door-front','open-hinged-door','drawer-front','open-drawer-front','island-rear-finish','dishwasher-front','oven-door','fridge-door','freezer-door','pullout-front']);
const colors={body:'#a4967b',cream:'#e1dfcf',sage:'#849c89',oak:'#c6a57a',interior:'#adac97',shadow:'#4b554d',toe:'#525955',handle:'#928677',
  stone:'#ecdfc5',stoneEdge:'#cfc2a9',steel:'#aab7b7',steelDark:'#677b7e',glass:'#263c42',rim:'#63777a',ink:'#37474b'};
function meshTools(faces,plan,wall,meta){
  const basis=meta.basis,world=basis?basis.world:wall==='world'?p=>p:p=>wallLocalToRoom(plan,wall,p);
  function emit(ps,color,tag,flags){
    if(!ps||ps.length<3)return;const points=ps.map(world),N=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));if(!N)return;
    const rim=edgedFronts.has(tag)&&Math.abs(N.y)<E&&meta.basis&&Math.abs(dot(N,meta.basis.D))>.999?points:undefined;
    const component=meta.part==='module'?faceComponent(meta.kind,tag):null;
    faces.push({...meta,...flags,...(component?{component}:{}),points,N,D:dot(N,points[0]),color,tag,...(rim?{rim}:{})});
  }
  function box(x,y,z,w,h,d,color,tag){
    if(w<=E||h<=E||d<=E)return;const paint=typeof color==='string'?{all:color}:color,at=name=>paint[name]||paint.all;
    emit(XY(x,y,w,h,z+d),at('front'),tag);emit(XY(x,y,w,h,z).reverse(),at('back'),tag);
    emit(XZ(x,y,z,w,d),at('top'),tag);emit(XZ(x,y+h,z,w,d).reverse(),at('bottom'),tag);
    emit(YZ(x,y,z,h,d).reverse(),at('side'),tag);emit(YZ(x+w,y,z,h,d),at('side'),tag);
  }
  function tube(a,b,r,paint,tag,sides=7,baseFlags){
    const axis=unit(sub(b,a));if(!axis||r<=0)return;const v=unit(cross(axis,Math.abs(axis.y)<.85?pt(0,1,0):pt(1,0,0))),u=cross(axis,v);
    const ring=c=>Array.from({length:sides},(_,i)=>sum(c,sum(mul(v,r*Math.cos(i*Math.PI*2/sides)),mul(u,r*Math.sin(i*Math.PI*2/sides)))));
    const A=ring(a),B=ring(b);emit([...A].reverse(),paint,tag,baseFlags);emit(B,paint,tag);for(let i=0;i<sides;i++){const j=(i+1)%sides;emit([A[i],A[j],B[j],B[i]],paint,tag);}
  }
  return {emit,box,tube};
}
// The door's own (right,down,front) axes rotate with the hinge. Map the
// actual closed/open solid, not a preview swing sector or the combined AABB of
// two leaves. The rendered panel, inset grip, grain and hit all share this frame.
function styleFront(m,o,x,y,z,w,h,paint){
  if(o.frontStyle==='framed'){const r=Math.min(3.4,w*.09,h*.09),edge=shade(paint,1.025);m.box(x,y,z,w,r,.26,edge,'front-rail');m.box(x,y+h-r,z,w,r,.26,edge,'front-rail');m.box(x,y+r,z,r,h-2*r,.26,edge,'front-rail');m.box(x+w-r,y+r,z,r,h-2*r,.26,edge,'front-rail');}
  if(o.frontStyle==='fluted'){const count=Math.min(30,Math.max(4,Math.round(w/2.5))),step=w/count;
    // Shallow curved reeding, not rectangular sticks casting alternating black stripes.
    const rib=(j,i,yy)=>pt(x+(j+i/6)*step,yy,z+.012+.21*(1-Math.cos(i*Math.PI/3))*.5);
    for(let j=0;j<count;j++)for(let i=0;i<6;i++)m.emit([rib(j,i,y+.35),rib(j,i+1,y+.35),rib(j,i+1,y+h-.35),rib(j,i,y+h-.35)],paint,'front-flute');}

}
function stylePull(m,o,x,y,z,len){
  if(!o.handleStyle)return false;
  if(o.handleStyle==='handleless'){m.emit(XY(x,y,len,.68,z+.04),colors.shadow,'recessed-grip');return true;}
  if(o.handleStyle==='knob'){const a=pt(x+len/2,y+.8,z);m.tube(a,pt(a.x,a.y,z+1.25),.60,colors.handle,'knob-post',8);m.tube(pt(a.x,a.y,z+1.25),pt(a.x,a.y,z+1.95),1.12,colors.handle,'knob',10);return true;}
  if(o.handleStyle==='bar'){const yy=y+.8;for(const xx of [x+1,x+len-1])m.tube(pt(xx,yy,z),pt(xx,yy,z+1.75),.48,colors.handle,'bar-post',6);m.tube(pt(x,yy,z+1.75),pt(x+len,yy,z+1.75),.60,colors.handle,'bar-handle',8);return true;}return false;
}
// Coordinates on the face use the same cut panel, drill model and handing
// as the shop. Unspecified visual dimensions produce a schematic profile.
function factoryPull(m,mount,x,y,z,w,h,side){
 if(!mount)return false;
 const pts=mount.locate(w*10,h*10,side).map(p=>pt(x+p.x/10,y+p.y/10,z));
 if(!pts.length)return true;
 const visual=mount.visual,single=pts.length===1;
 const r=(visual?.diameter??(single?22:12))/20,projection=(visual?.projection??22)/10;
 const depth=single?projection*.6:projection-r;
 const caps=pts.map(p=>pt(p.x,p.y,z+depth));
 for(let i=0;i<pts.length;i++)m.tube(pts[i],caps[i],Math.min(r*.65,depth),colors.handle,single?'knob-post':'bar-post',8,{handleMount:true,partSku:mount.sku});
 if(single)m.tube(caps[0],pt(pts[0].x,pts[0].y,z+projection),r,colors.handle,'knob',12);
 else{
  const along=unit(sub(caps[1],caps[0])),extension=(visual?.overhang??6)/10;
  m.tube(sub(caps[0],mul(along,extension)),sum(caps[1],mul(along,extension)),r,colors.handle,'bar-handle',10);
 }
 return true;
}
function hingedLeaf(faces,plan,runFrame,o,leaf,paint,finish,tint,upper){
  const open=o.open===true,part=open?leaf.opened:leaf.closed,raw=part&&inRun(runFrame,part);
  if(!raw||!Number.isFinite(part.height)||part.height<=0)return;
  const right=leaf.hingeSide==='right',base=runFrame.world(pt(
    open&&!right?raw.x+raw.w:raw.x,
    getRoom(plan).height-part.bottom-part.height,
    open&&right?raw.z+raw.d:raw.z));
  const T=open?mul(runFrame.D,right?-1:1):runFrame.T,D=open?mul(runFrame.T,right?1:-1):runFrame.D;
  const w=open?raw.d:raw.w,t=open?raw.w:raw.d,h=part.height;
  const basis={r:runFrame.r,origin:base,T,D,world:p=>pt(base.x+p.x*T.x+p.z*D.x,base.y+p.y,base.z+p.x*T.z+p.z*D.z)};
  const meta={part:'module',id:o.id,kind:o.kind,wall:o.wall??null,basis,runId:o.runId,frontFinish:kitchenFrontFinishes[o.frontFinish]?o.frontFinish:null,
    frontColor:tint,leafId:leaf.id,hingeSide:leaf.hingeSide,doorAngle:open?(part.angle??leaf.angle):0,leafOpen:open};
  const m=meshTools(faces,plan,o.wall,meta),panelTag=open?'open-hinged-door':'door-front';
  m.box(0,0,0,w,h,t,{all:paint,back:shade(paint,1.04)},panelTag);
  styleFront(m,o,0,0,t,w,h,paint);
  if(!o.frontStyle&&w>23&&h>29){const e=Math.min(2.8,w*.07),inset=finish?shade(paint,.946):paint===colors.sage?'#798e7e':paint===colors.oak?'#bd986b':'#d5d5c5';
    m.emit(XY(e,e,w-2*e,h-2*e,t),inset,open?'open-hinged-panel':'recessed-panel');}
  if(o.kind==='tall'&&h>118)m.emit(XY(.18,h*.28,w-.36,.55,t),colors.shadow,open?'open-door-seam':'tall-seam');
  // The inset pull is nearest the FREE edge, opposite the hinge, and remains
  // within the same solid the collision checker measures. A pair opens apart.
  const len=Math.min(14,w*.47),margin=Math.max(.8,Math.min(3,w*.10)),xx=right?margin:w-len-margin,yy=upper?h-4:3.2;
  if(!factoryPull(m,o.factoryHandle,0,0,t,w,h,leaf.hingeSide)&&!stylePull(m,o,xx,yy,t,len)){m.emit(XY(xx,yy,len,1.75,t),colors.handle,open?'open-door-pull':'pull');
  m.emit(XY(xx+.4,yy+.25,len-.8,.45,t),'#b6a085',open?'open-pull-highlight':'pull-highlight');}
  if(open){
    const hinge=right?w-Math.min(1.75,w*.08):.38,plate=Math.min(1.35,w*.06);
    for(const v of [.14,.84])m.emit(XY(hinge,h*v,plate,Math.min(3.1,h*.06),0).reverse(),'#a4a8a0','inner-hinge-plate');
  }
}
function carcass(faces,plan,g,o){
  const basis=runBasis(g,o.runId),r=basis&&inRun(basis,o);if(!r||!validRect(o.rect))return;
  const wall=o.wall??null,{x,z,w,d}=r,H=g.room.height,bottom=o.bottom||0,height=o.height;
  if(!Number.isFinite(height)||height<=0)return;
  const top=H-bottom-height,end=H-bottom,kind=o.kind,upper=['upper','wall'].includes(o.tier)||bottom>85,tall=kind==='tall'||o.tier==='tall',toe=o.baseSupport?.applicable?Math.min(height,o.baseSupport.bodyClearMm/10):bottom<1?Math.min(9,height*.12):0,
    y=top,h=height-toe,faceZ=z+d,s=Math.min(1.65,w*.04,h*.035,d*.1),tint=tintColor(o.frontColor),finish=kitchenFrontFinishes[o.frontFinish]||(tint?{texture:'paint',color:tint}:null),paint=tint||finish?.color||(tall?colors.oak:upper?colors.cream:colors.sage),
    m=meshTools(faces,plan,wall,{part:'module',id:o.id,kind,wall,basis,frontFinish:kitchenFrontFinishes[o.frontFinish]?o.frontFinish:null,frontColor:tint,frontStyle:o.frontStyle,handleStyle:o.handleStyle,runId:o.runId||o.run}),{box,emit}=m;
  if(o.baseSupport?.mode==='legs')for(const leg of o.baseSupport.legs||[]){
    const [lx,lz,lw,ld]=leg.footprint;
    box(x+lx/10,end-toe,z+lz/10,lw/10,leg.lengthMm/10,ld/10,colors.steelDark,'cabinet-leg');
  }
  if(drawKitchenEquipment(kind,{m,x,y,z,w,h,height,d,toe,s,paint,o,H,factoryPull}))return;
  // Open body: no solid top across the sink/hob aperture.
  box(x,y,z,s,h,d,paint,'side');box(x+w-s,y,z,s,h,d,paint,'side');
  box(x+s,y+h-s,z,w-2*s,s,d,colors.interior,'floor');box(x+s,y,z,w-2*s,h-s,Math.min(s,d*.15),colors.interior,'back');
  if(basis.r.placement==='free'){
    // The rear is another real facade of an island/peninsula. It lives on
    // depth zero of THIS run, not on an arbitrary room wall.
    emit(XY(x,y,w,h,z).reverse(),paint,'island-rear-finish');
  }
  if(upper||tall)box(x+s,y,z,w-2*s,s,d,paint,'top');
  if(kind==='storage'||tall){
    const exact=o.detail?.cab;
    if(exact){
      // Read the editor's normalized partition tree at the real clear-body
      // size. Shared boards stay full-length and nested ones stay local.
      const detail={...o.detail,cab:{x:0,y:0,w,h},depth:d,wall:{w:Math.max(60,w),h:Math.max(60,h)}},
        finish={oak:'#c5a477',walnut:'#846249',ivory:'#dfdfd2'},core=finish[detail.finish]||colors.oak;
      for(const board of scopedDividers(detail).filter(item=>item.kind==='cabinet'))box(x+board.x,y+board.y,z+s,board.w,board.h,Math.max(1,d-2*s),core,'interior-divider');
      for(const cell of scopedCells(detail))emit(XY(x+cell.x,y+cell.y,cell.w,cell.h,z+s+.08),finish[effectiveFinish(detail,cell.key)]||core,'interior-backing');
      for(const ornament of buildVolumeArt(detail,{depth:d}))emit(ornament.points.map(p=>pt(x+p.x,y+p.y,z+p.z)),ornament.fill,'interior-'+ornament.kind);
    }else{
      const rows=o.interior?.shelves||0,cols=o.interior?.dividers||0;
      for(let j=1;j<=rows;j++)box(x+s,y+j*h/(rows+1)-.85,z+s,w-2*s,1.7,Math.max(1,d-3*s),colors.oak,'interior-shelf');
      for(let j=1;j<=cols;j++)box(x+j*w/(cols+1)-.85,y+s,z+s,1.7,h-2*s,Math.max(1,d-3*s),colors.oak,'interior-divider');
    }
  }
  const gap=Math.min(.48,w*.015),frontDepth=Math.min(1.65,d*.12),pull=Math.min(14,w*.42);
  const pullH=(xx,yy,zz,len=pull,style=colors.handle)=>{if(len<1||stylePull(m,o,xx,yy,zz,len))return;
    // Inset handle on the measured front: no unmodelled protrusion at the
    // front edge of a fully extended drawer or dishwasher aisle clearance.
    emit(XY(xx,yy,len,1.75,zz+.016),style,'pull');emit(XY(xx+.55,yy+.30,len-1.10,.43,zz+.019),'#b2a081','pull-highlight');
  };
  function door(xx,yy,ww,hh,face=paint){
    box(xx,yy,faceZ-frontDepth,ww,hh,frontDepth,face,'door-front');
    styleFront(m,o,xx,yy,faceZ,ww,hh,face);
    if(!o.frontStyle&&ww>23&&hh>29){const ed=Math.min(2.8,ww*.07),inset=finish?shade(face,.946):face===colors.sage?'#798e7e':face===colors.oak?'#bd986b':'#d5d5c5';
      emit(XY(xx+ed,yy+ed,ww-2*ed,hh-2*ed,faceZ+.025),inset,'recessed-panel');}
    if(!factoryPull(m,o.factoryHandle,xx,yy,faceZ,ww,hh))pullH(xx+(ww-pull)/2,upper?yy+hh-4:yy+3.2,faceZ+.035);
  }
  const op=o.openPart&&validRect(o.openPart.rect)?o.openPart:null;
  const ox=op?inRun(basis,op):null,oy=op?H-op.bottom-op.height:0;
  if(kind==='dishwasher'){
    if(op){
      const thick=Math.min(2.2,h*.08);box(ox.x,oy,ox.z,ox.w,op.height,ox.d,colors.steel,'open-dishwasher-door');
      if(ox.w>7&&ox.d>6)emit(XZ(ox.x+2.2,oy-.02,ox.z+2.5,ox.w-4.4,ox.d-5),colors.steelDark,'stainless-door-inset');
      for(const k of [.43,.75]){
        const ry=y+h*k;box(x+s+1,ry,z+3,w-2*s-2,.8,d-7,colors.steelDark,'rack-base');
        const rz=faceZ-3;for(let t=0;t<7;t++){const xx=x+s+2+(w-2*s-4)*t/6;box(xx,ry-3.4,rz,.65,3.4,.65,colors.steel,'rack-wire');}box(x+s+1,ry-3.4,rz,w-2*s-2,.65,.7,colors.steel,'rack-rail');
      }
    }else{
      box(x+gap,y+.25,faceZ-frontDepth,w-2*gap,h-.5,frontDepth,finish?paint:colors.steel,'dishwasher-front');
      emit(XY(x+gap+.55,y+.85,w-2*gap-1.1,Math.min(6,h*.15),faceZ+.025),colors.ink,'control-strip');
      pullH(x+w*.18,y+8,faceZ+.04,w*.64,colors.steelDark);
      emit(XY(x+w*.78,y+2.1,w*.09,1.1,faceZ+.045),'#9ab9a6','status-light');
    }
  }else if(kind==='drawers'){
    const count=o.drawerCount||3,opened=(openDrawerIndex(o)||0)-1;
    for(let k=0;k<count;k++){
      const first=faces.length;
      if(k===opened){const q=ox,th=Math.min(1.5,op.height*.15);
        box(q.x,oy+op.height-th,q.z,q.w,th,q.d,colors.oak,'drawer-bottom');box(q.x,oy,q.z,th,op.height,q.d,colors.oak,'drawer-side');box(q.x+q.w-th,oy,q.z,th,op.height,q.d,colors.oak,'drawer-side');box(q.x,oy,q.z,q.w,op.height,th,colors.oak,'drawer-back');const fx=o.factoryHandle?x+gap:q.x,fy=o.factoryHandle?y+k*h/count+gap/2:oy,fw=o.factoryHandle?w-2*gap:q.w,fh=o.factoryHandle?h/count-gap:op.height;
        box(fx,fy,q.z+q.d-th,fw,fh,th,paint,'open-drawer-front');styleFront(m,o,fx,fy,q.z+q.d,fw,fh,paint);
        if(!factoryPull(m,o.factoryHandle,fx,fy,q.z+q.d,fw,fh))pullH(q.x+(q.w-pull)/2,oy+Math.min(3,op.height*.25),q.z+q.d);
      }else{const yy=y+k*h/count+gap/2;box(x+gap,yy,faceZ-frontDepth,w-2*gap,h/count-gap,frontDepth,paint,'drawer-front');styleFront(m,o,x+gap,yy,faceZ,w-2*gap,h/count-gap,paint);if(!factoryPull(m,o.factoryHandle,x+gap,yy,faceZ,w-2*gap,h/count-gap))pullH(x+(w-pull)/2,yy+Math.min(3,h/8),faceZ);}
      for(let j=first;j<faces.length;j++)faces[j].index=k+1;
    }
  }else if(kind==='oven'){
    const head=Math.min(9,h*.16);box(x+gap,y+gap,faceZ-frontDepth,w-2*gap,head,frontDepth,colors.steel,'oven-control');
    if(op){box(ox.x,oy,ox.z,ox.w,op.height,ox.d,colors.glass,'open-oven-door');}
    else{box(x+gap,y+head+.6,faceZ-frontDepth,w-2*gap,h-head-1,frontDepth,finish?paint:colors.ink,'oven-door');emit(XY(x+w*.11,y+head+h*.16,w*.78,h*.50,faceZ+.03),colors.glass,'oven-glass');pullH(x+w*.18,y+head+2,faceZ,w*.64,colors.steel);}
    for(const t of [.14,.82])m.tube(pt(x+w*t,y+head*.5,faceZ),pt(x+w*t,y+head*.5,faceZ+1),Math.min(1.55,head*.26),colors.ink,'oven-dial',8);
  }else{
    if(Array.isArray(o.doorLeaves)&&o.doorLeaves.length){
      for(const leaf of o.doorLeaves)hingedLeaf(faces,plan,basis,o,leaf,paint,finish,tint,upper);
    }else{
      const columns=w>=68?2:1;for(let j=0;j<columns;j++)door(x+j*w/columns+gap,y+gap,w/columns-2*gap,h-2*gap);
      if(tall&&h>118)emit(XY(x+gap,y+h*.28,w-2*gap,.55,faceZ+.045),colors.shadow,'tall-seam');
    }
  }
}
// Build the top as framed stone around real through-holes: a ray at the
// sink reaches its bowl, not an intact virtual slab. No bridge across gaps.
function worktop(faces,plan,g,o,idx){
  const basis=runBasis(g,o.runId),r=basis&&inRun(basis,o);if(!validRect(r))return;const y=g.room.height-o.bottom-o.height,endY=y+o.height;
  const id=o.id||'worktop-'+idx,meta={part:'worktop',id,kind:'worktop',wall:o.wall??null,basis,worktopFinish:kitchenWorktopFinishes[o.worktopFinish]?o.worktopFinish:null,worktopColor:tintColor(o.worktopColor??basis.r.worktopColor),runId:o.runId||o.run},m=meshTools(faces,plan,'world',meta);
  const topColor=meta.worktopColor||kitchenWorktopFinishes[o.worktopFinish]?.color||colors.stone,edge=meta.worktopFinish||meta.worktopColor?shade(topColor,.90):colors.stoneEdge;
  const hs=(o.holes||[]).map(h=>inRun(basis,h)).filter(validRect).map(h=>({x:Math.max(r.x,h.x),z:Math.max(r.z,h.z),X:Math.min(r.x+r.w,h.x+h.w),Z:Math.min(r.z+r.d,h.z+h.d)})).filter(h=>h.X-h.x>E&&h.Z-h.z>E);
  const sorted=a=>[...new Set(a)].sort((a,b)=>a-b),xs=sorted([r.x,r.x+r.w,...hs.flatMap(h=>[h.x,h.X])]),zs=sorted([r.z,r.z+r.d,...hs.flatMap(h=>[h.z,h.Z])]);
  const stone=(i,j)=>{if(i<0||i>=xs.length-1||j<0||j>=zs.length-1)return false;const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;return !hs.some(h=>x>h.x&&x<h.X&&z>h.z&&z<h.Z);};
  for(let i=0;i+1<xs.length;i++)for(let j=0;j+1<zs.length;j++)if(stone(i,j)){
    const x=xs[i],z=zs[j],w=xs[i+1]-x,d=zs[j+1]-z;
    m.emit(XZ(x,y,z,w,d),topColor,'stone-top');m.emit(XZ(x,endY,z,w,d).reverse(),edge,'stone-under');
    if(!stone(i-1,j))m.emit(YZ(x,y,z,o.height,d).reverse(),edge,'stone-edge');
    if(!stone(i+1,j))m.emit(YZ(x+w,y,z,o.height,d),edge,'stone-edge');
    if(!stone(i,j-1))m.emit(XY(x,y,w,o.height,z).reverse(),edge,'stone-edge');
    if(!stone(i,j+1))m.emit(XY(x,y,w,o.height,z+d),edge,'stone-edge');
  }
}
function applianceTop(faces,plan,g,o){
  if(!o.cutout)return;const basis=runBasis(g,o.runId),r=basis&&inRun(basis,o.cutout);if(!r)return;
  const {x,z,w,d}=r,matched=g.worktops.find(t=>t.runId===o.runId&&t.holes?.some(h=>h.unitId===o.id||h.id===o.cutout.id));if(!matched)return;
  const y=g.room.height-matched.bottom-matched.height,m=meshTools(faces,plan,o.wall,{part:'module',id:o.id,kind:o.kind,wall:o.wall??null,basis,runId:o.runId||o.run});
  if(o.kind==='sink'){
    const {rim,tapRadius:rr,tapBack}=o.cutout.sinkFitting,depth=Math.min(16,o.height*.30),ix=Math.min(2,w*.08,d*.08);
    // Real recessed bowl: side normals face the inside of the basin.
    m.box(x-rim,y-.45,z-rim,w+rim*2,.48,rim,'#bcc8c5','sink-rim');m.box(x-rim,y-.45,z+d,w+rim*2,.48,rim,'#bcc8c5','sink-rim');
    m.box(x-rim,y-.45,z,rim,.48,d,'#bcc8c5','sink-rim');m.box(x+w,y-.45,z,rim,.48,d,'#bcc8c5','sink-rim');
    const topP=XZ(x,y,z,w,d),bottomP=XZ(x+ix,y+depth,z+ix,w-ix*2,d-2*ix);
    for(let i=0;i<4;i++){const j=(i+1)%4;m.emit([topP[i],topP[j],bottomP[j],bottomP[i]],colors.steel,'sink-wall');}
    m.emit(bottomP,'#91a5a5','sink-bottom');
    m.tube(pt(x+w*.52,y+depth,z+d*.52),pt(x+w*.52,y+depth-.22,z+d*.52),Math.min(2.7,w*.07,d*.07),'#576b6e','sink-drain',10);
    // Single-lever gooseneck tap, with a real spout over the bowl. The neck
    // has a continuous arch so its silhouette reads at room-camera distance.
    const fx=x+w*.58,fz=z-tapBack,span=Math.min(15.5,tapBack+d*.45),rise=Math.min(32,w*.61),alloy='#737d80';
    m.tube(pt(fx,y+.08,fz),pt(fx,y-1.05,fz),rr*2.0,'#788184','faucet-foot',12);
    m.tube(pt(fx,y-1,fz),pt(fx,y-9.4,fz),rr*1.36,alloy,'faucet-body',12);
    m.tube(pt(fx,y-8.9,fz),pt(fx,y-rise+span*.5,fz),rr,alloy,'faucet',12);
    const arch=t=>pt(fx,y-rise+span*.5-Math.sin(t)*span*.5,fz+span*.5*(1-Math.cos(t)));
    for(let i=1;i<=11;i++)m.tube(arch(Math.PI*(i-1)/11),arch(Math.PI*i/11),rr,alloy,'faucet',11);
    const tip=arch(Math.PI);m.tube(tip,pt(tip.x,tip.y+3.4,tip.z),rr*1.11,'#667074','faucet-nozzle',11);
    m.tube(pt(fx,y-6.9,fz),pt(fx+rr*2.1,y-6.9,fz),rr*.95,'#6a7272','mixer-joint',10);m.tube(pt(fx+rr*2.1,y-6.9,fz),pt(fx+rr*3.1,y-13.2,fz+.2),rr*.41,'#6d7677','mixer-lever',9);
  }else{
    m.box(x-.7,y-.55,z-.7,w+1.4,.65,d+1.4,{all:'#2b393e',top:'#34484e'},'hob-glass');
    for(const [cx,cz,r] of [[.25,.30,.14],[.72,.32,.17],[.29,.72,.18],[.75,.74,.12]]){
      const radius=Math.min(w,d)*r,N=14,rr=radius*.87,level=y-.59;
      for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,q=(t,size)=>pt(x+cx*w+Math.cos(t)*size,level,z+cz*d+Math.sin(t)*size);m.emit([q(a,radius),q(b,radius),q(b,rr),q(a,rr)],'#879b9d','hob-ring');}
    }
  }
}
function fixture(faces,plan,g,o,building){
  const seg=building.byId.get(o.wall);if(!seg||!validRect(o.rect)||o.kind==='window'||o.kind==='door')return;const wall=seg.id,{u:x,width:w}=o,y=g.room.height-o.bottom-o.height,h=o.height,kind=o.kind,z=0,d=o.depth??Math.max(.35,...(o.polygon||[]).map(p=>wallLocal(seg,p).d));
  const basis={r:{},origin:pt(seg.origin.x,0,seg.origin.z),T:pt(seg.tangent.x,0,seg.tangent.z),D:pt(seg.inward.x,0,seg.inward.z),world:p=>wallWorld(seg,p.x,p.y,p.z)};
  const m=meshTools(faces,plan,wall,{part:'fixture',id:o.id,kind,wall,basis,attached:true}),{box,emit,tube}=m;
  if(['column','shaft','beam'].includes(kind)){box(x,y,z,w,h,d,{all:kind==='shaft'?'#d2cabb':'#c8c5b7',front:'#d8d4c7'},'fixed-'+kind);return;}
  if(kind==='heater'){const r=Math.min(w*.46,d*.44);tube(pt(x+w*.5,y+r*.28,z+d/2),pt(x+w*.5,y+h-r*.36,z+d/2),r,'#d8dadd','heater-cylinder',16);for(const off of [-.2,.2])tube(pt(x+w*(.5+off),y+h-r*.30,z+d*.5),pt(x+w*(.5+off),y+h,z+d*.5),Math.min(1,w*.035),'#728387','heater-port',8);box(x+w*.38,y+h*.68,z+d*.85,w*.24,h*.10,Math.min(2,d*.12),'#9ba6a7','heater-control');return;}
  if(kind==='electric'||kind==='vent'||kind==='exhaust'){
    box(x,y,z,w,h,Math.max(.3,d),kind!=='electric'?'#c6c6b7':'#e4e3d6','service-plate');const pz=z+d+.03;
    if(kind!=='electric')for(let j=1;j<7;j++)emit(XY(x+w*.1,y+h*j/8,w*.8,h*.033,pz),'#73837c','vent-slot');
    else for(const t of [.34,.63])emit(XY(x+w*t,y+h*.40,w*.085,h*.17,pz),'#59645e','socket');
  }else{
    const shade={water:'#557f99',drain:'#8e7665',gas:'#d09f56'}[kind]||'#899e8e',r=Math.min(w,h)*.36;
    tube(pt(x+w/2,y+h/2,z),pt(x+w/2,y+h/2,z+d+.1),r,shade,'service-port',9);
  }
}
// Keep each broad stone surface on its actual plane before subdividing the
// other solids. Its SVG can then be ONE path with holes; antialiasing must
// not introduce artificial seams across a continuous countertop.
function countertopTree(faces,levels){
  if(!faces.length||!levels.length)return buildVolumePartition(faces);
  const i=Math.floor(levels.length/2),y=levels[i],N=pt(0,1,0),pos=[],neg=[],co=[];
  for(const f of faces){const side=classifyVolumeFace(f,N,y);if(!side)co.push(f);else if(side===1)pos.push(f);else if(side===2)neg.push(f);else{const [p,m]=splitVolumeFace(f,N,y);if(p)pos.push(p);if(m)neg.push(m);}}
  return {N,co,pos:countertopTree(pos,levels.slice(i+1)),neg:countertopTree(neg,levels.slice(0,i))};
}
function buildScene(plan,k,g){
  const building=buildKitchenBuilding(plan,g),faces=[...building.faces];
  const pricedFronts=factoryFrontSurfaces(k,plan.room?.frontAppearance||frontAppearanceSource(plan.room?.workshop));
  const mounts=factoryHandleMounts(plan.room,k,g);
  for(const u of g.units){
    const material=pricedFronts.get(u.id),start=faces.length,body={...u,factoryHandle:mounts.get(u.id)};
    if(material){body.frontFinish=null;body.frontColor=material.color||'#d8d7d1';}
    carcass(faces,plan,g,body);
    if(material)for(let i=start;i<faces.length;i++)if(facadeTags.has(faces[i].tag)&&!['top','side','front-rail'].includes(faces[i].tag))faces[i].partSku=material.sku;
    applianceTop(faces,plan,g,u);
  }
  for(const corner of g.cornerBodies||[]){
   const m=meshTools(faces,plan,'world',{part:'corner',id:corner.id,kind:'corner',tier:corner.tier});
   for(const part of corner.panels?.length?corner.panels:corner.parts){
    const above=part.polygon.map(p=>pt(p.x,g.room.height-part.bottom-part.height,p.z)),below=part.polygon.map(p=>pt(p.x,g.room.height-part.bottom,p.z));
    const tag=part.tag?'corner-'+part.tag:null,shade=part.color||(part.tag==='door'?'#d2bfa5':'#b8c7ae');
    m.emit(above,shade,tag||'corner-top');m.emit([...below].reverse(),part.color||'#879481',tag||'corner-base');
    for(let i=0;i<above.length;i++){const j=(i+1)%above.length;m.emit([above[i],above[j],below[j],below[i]],part.tag?shade:'#a0b098',tag||'corner-side');}
   }
  }
  for(const body of g.wallAccessories||[]){
   const m=meshTools(faces,plan,'world',{part:'fixture',id:body.featureId,kind:body.role,wall:body.wall,sectionId:body.section});
   const above=body.polygon.map(p=>pt(p.x,g.room.height-(body.y+body.h)/10,p.z)),below=body.polygon.map(p=>pt(p.x,g.room.height-body.y/10,p.z));
   m.emit(above,body.color,body.role);m.emit([...below].reverse(),body.color,body.role);
   for(let i=0;i<above.length;i++){const j=(i+1)%above.length;m.emit([above[i],above[j],below[j],below[i]],body.color,body.role);}
  }
  const fitout=plan.room?.fitout;
  for(const a of fitout?.aprons||[]){
   const basis=runBasis(g,a.runId);if(!basis)continue;
   const m=meshTools(faces,plan,'world',{part:'module',id:a.unitIds[0],runId:a.runId,kind:'base-apron',wall:basis.r.wall,basis});
   m.box(a.startMm/10,g.room.height-(a.bottomMm+a.heightMm)/10,(a.depthMm-a.insetMm-a.thicknessMm)/10,(a.endMm-a.startMm)/10,a.heightMm/10,a.thicknessMm/10,tintColor(a.color)||colors.toe,'base-apron');
  }
  function wallStone(s,horizontal){
   const wall=building.byId.get(s.wall);if(!wall)return;
   const kind=horizontal?'window-sill-stone':'upstand',tag=horizontal?'horizontal-stone-sill':'worktop-upstand';
   const m=meshTools(faces,plan,'world',{part:'fixture',id:horizontal?s.windowId:'upstand-'+s.wall+'-'+s.fromMm,kind,wall:s.wall});
   const left=s.fromMm/10,right=s.toMm/10,bottom=g.room.height-s.bottomMm/10,top=bottom-(horizontal?s.thicknessMm:s.heightMm)/10,
    rear=horizontal?-s.depthMm/10:0,front=horizontal?0:s.thicknessMm/10;
   const a=wallWorld(wall,left,top,front),b=wallWorld(wall,right,top,front),c=wallWorld(wall,right,bottom,front),d=wallWorld(wall,left,bottom,front),
    A=wallWorld(wall,left,top,rear),B=wallWorld(wall,right,top,rear),C=wallWorld(wall,right,bottom,rear),D=wallWorld(wall,left,bottom,rear);
   for(const face of [[a,b,c,d],[A,B,b,a],[A,a,d,D],[B,C,c,b]])m.emit(face,tintColor(s.color)||colors.stoneEdge,tag);
   if(horizontal){m.emit([D,d,c,C],tintColor(s.color)||colors.stoneEdge,tag);m.emit([B,A,D,C],tintColor(s.color)||colors.stoneEdge,tag);}
  }
  for(const s of fitout?.stone||[])wallStone(s,false);
  for(const s of fitout?.sills||[])wallStone(s,true);
  g.worktops.forEach((w,i)=>worktop(faces,plan,g,w,i));g.features.forEach(f=>fixture(faces,plan,g,f,building));
  paintSelectedParts(plan.room,k,faces);
  return {building,faces,tree:countertopTree(faces,[...new Set(g.worktops.map(t=>g.room.height-t.bottom-t.height))].sort((a,b)=>a-b))};
}
function modelScene(plan,k){
  const r=getRoom(plan),catalog=readWorkshopCatalog(plan.room?.workshop),stamp=JSON.stringify([r.width,r.height,r.length,plan.room?.frontAppearance||frontAppearanceSource(plan.room?.workshop),plan.room?.architecture,plan.room?.fitout,plan.room?.workshop?.finishes,plan.room?.workshop?.rows&&Object.entries(plan.room.workshop.rows).map(([id,r])=>[id,r.units.map(e=>[e.id,e.family,e.recipeId,e.riceMode,e.pantrySupply?.sku])]),catalog?.families&&Object.entries(catalog.families).map(([id,f])=>[id,f.finishSlots,f.finishSlots?f.recipe:undefined]),plan.room?.workshop?.corners,plan.room?.workshop?.options,catalog?.wallAccessories,catalog?.linearKits,catalog?.items?.map(i=>[i.sku,i.color,i.colorHex,i.thicknessMm,i.stockLengthMm,i.kerfMm,i.sectionWidthMm,i.gaugeMm,i.grooveWidthMm,i.grooveDepthMm,i.massKgM2]),plan.room?.cladding,plan.room?.sitePoints,plan.room?.layers,plan.wallColor,plan.kitchenSurfaces]);let c=cache.get(k);
  if(c&&c.stamp===stamp)return c;
  const g=kitchenGeometry(k,plan);c={stamp,g,...buildScene(plan,k,g)};cache.set(k,c);return c;
}
// Source polygons before camera projection, BSP clipping, selection or lighting.
// Photography triangulates these physical surfaces, never the editing SVG.
export function getKitchenPhotoMesh(plan,k=plan.kitchen){
  const c=modelScene(plan,k);return {faces:c.faces,geometry:c.g,room:c.g.room,building:c.building};
}
function shade(color,k){const hex=/^#[0-9a-f]{6}$/i.test(color)?color:'#b9b4a3';return '#'+[1,3,5].map(i=>Math.min(255,Math.max(0,Math.round(parseInt(hex.slice(i,i+2),16)*k))).toString(16).padStart(2,'0')).join('');}
function insidePoly(x,y,ps){let s=0;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],d=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(d)<E)continue;const c=Math.sign(d);if(s&&s!==c)return false;s=c;}return !!s;}
const points=ps=>ps.map(p=>n(p.x)+','+n(p.y)).join(' ');
// Highlight only real perimeter edges. BSP cuts through a facade must never
// leave a decorative seam in the middle of a door or drawer face.
function edgeLighting(face,screen){
  if(!face.rim)return '';
  let light='',shade='';
  for(let i=0;i<face.points.length;i++){
    const j=(i+1)%face.points.length,p=face.points[i],q=face.points[j];
    const edge=face.rim.findIndex((a,idx)=>{
      const b=face.rim[(idx+1)%face.rim.length],d=sub(b,a);
      return mag(cross(d,sub(p,a)))<.001&&mag(cross(d,sub(q,a)))<.001;
    });
    if(edge<0)continue;
    const line='M'+n(screen[i].x)+' '+n(screen[i].y)+'L'+n(screen[j].x)+' '+n(screen[j].y);
    if(edge===0||edge===3)light+=line;else shade+=line;
  }
  const stroke=(d,color,opacity)=>d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width=".36" opacity="'+opacity+'" pointer-events="none"/>':'';
  return stroke(light,'#fffdf6',.68)+stroke(shade,'#3f4544',.46);
}
function selectedOutline(P,box,id){
  const {rect:r,bottom,height,H}=box,y=H-bottom-height;if(!validRect(r)||!Number.isFinite(y))return '';
  const ps=footprint(box);if(ps.length<3)return '';const hull=[...atHeight(ps,y),...atHeight(ps,y+height)].map(P.projectPoint).sort((a,b)=>a.x-b.x||a.y-b.y);
  function turn(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
  const top=[],low=[];for(const q of hull){while(low.length>=2&&turn(low.at(-2),low.at(-1),q)<=E)low.pop();low.push(q);}for(const q of [...hull].reverse()){while(top.length>=2&&turn(top.at(-2),top.at(-1),q)<=E)top.pop();top.push(q);}
  return `<polygon data-kitchen-selected="${esc(id)}" points="${points(low.slice(0,-1).concat(top.slice(0,-1)))}" fill="none" stroke="#146b59" stroke-width="1.35" stroke-dasharray="5 2.8" stroke-linejoin="round" pointer-events="none"/>`;
}
function witness(P,g,conflict){
  const legacy=conflict.polygons?.length?conflict.polygons:[footprint(conflict)];
  const patches=conflict.patches?.length?conflict.patches:legacy.map(polygon=>({polygon,bottom:conflict.bottom,height:conflict.height}));
  let shape='';for(const patch of patches){
    const {polygon:poly,bottom,height}=patch;if(!Array.isArray(poly)||poly.length<3||![height,bottom].every(Number.isFinite)||height<=0)continue;
    const y=g.room.height-bottom-height,a=atHeight(poly,y).map(P.projectPoint),b=atHeight(poly,y+height).map(P.projectPoint);
    shape+=`<g data-kitchen-overlap-patch="" data-patch-bottom="${n(bottom)}" data-patch-height="${n(height)}" data-patch-parts="${esc((patch.partIds||[]).join(' '))}"><polygon data-conflict-footprint="${esc(poly.map(p=>n(p.x)+','+n(p.z)).join(' '))}" points="${points(a)}" fill="#cb583a" opacity=".42"/>`;
    const edges=[...a.map((q,i)=>[q,a[(i+1)%a.length]]),...b.map((q,i)=>[q,b[(i+1)%b.length]]),...a.map((q,i)=>[q,b[i]])];
    for(const [q,r] of edges)shape+=`<line x1="${n(q.x)}" y1="${n(q.y)}" x2="${n(r.x)}" y2="${n(r.y)}" stroke="#a13c2e" stroke-width="1.05" stroke-dasharray="3 1.5"/>`;
    shape+='</g>';
  }
  return shape?`<g data-kitchen-conflict="${esc(conflict.type)}" data-conflict-id="${esc(conflict.id)}" data-world-bottom="${n(conflict.bottom)}" data-world-height="${n(conflict.height)}" pointer-events="none"><title>${esc(conflict.label)}</title>${shape}</g>`:'';
}
const facadeTags=new Set(['side','top','door-front','recessed-panel','open-hinged-door','open-hinged-panel','drawer-front','open-drawer-front','island-rear-finish','dishwasher-front','oven-door','front-rail','front-flute','fridge-door','freezer-door','pullout-front','open-shelf-frame','open-shelf-board']);
function appliedFinish(f){
  if(f.part==='worktop'&&(f.worktopFinish||f.worktopColor))return {key:f.worktopFinish||'custom',type:'worktop',tint:f.worktopColor,data:kitchenWorktopFinishes[f.worktopFinish]||{texture:'stone'}};
  if((f.frontFinish||f.frontColor)&&(facadeTags.has(f.tag)||/^(hood-(canopy|chimney)|equipment-(cabinet-front|frame|flute)|open-shelf-(left-side|right-side|floor|roof|board|local-board)|bottle-grid-(post|shelf)|[a-z-]+-(left-side|right-side)|freezer-door)$/.test(f.tag)))return {key:f.frontFinish||'custom',type:'front',tint:f.frontColor,data:kitchenFrontFinishes[f.frontFinish]||{texture:'paint'}};
  return null;
}
function finishPaint(P,prefix,patterns,f,base,finish){
  const tex=finish?.data.texture||(['stone-top','horizontal-stone-sill','worktop-upstand'].includes(f.tag)?'stone':f.tag==='dishwasher-front'?'metal':(f.kind==='tall'&&facadeTags.has(f.tag)||f.tag==='door-leaf')?'wood':'paint');
  if(tex==='paint')return base;
  const grain=tex!=='wood'?null:f.tag==='finished-floor'?'floorWood':f.tag==='door-leaf'||['oak','ash','smoked-oak'].includes(finish?.key)?'veneer':null;
  const frame=f.basis,T=frame?.T||pt(1,0,0),D=frame?.D||pt(0,0,1),Y=pt(0,1,0);
  const horizontal=Math.abs(f.N.y)>.9999;
  const u=horizontal?T:Math.abs(dot(f.N,T))>.9999?D:Math.abs(dot(f.N,D))>.9999?T:null,v=horizontal?D:Y;if(!u)return base;
  // Map centimetres on THIS face to SVG coordinates: no cardinal-angle
  // shortcut, no texture changing direction when a free run is rotated.
  const origin=frame?.origin||pt(0,0,0),projectedOrigin=P.projectPoint(sum(origin,mul(f.N,f.D-dot(f.N,origin))));
  const A={x:dot(P.u,u),y:dot(P.v,u)},B={x:dot(P.u,v),y:dot(P.v,v)},matrix=[A.x,A.y,B.x,B.y,projectedOrigin.x,projectedOrigin.y].map(n).join(' ');
  if(Math.abs(A.x*B.y-A.y*B.x)<E)return base;
  const key=[tex,finish?.key||'',grain||'',base,matrix].join('/');
  if(!patterns.has(key)){
    const id=prefix+'-finish-'+patterns.size,ink=finish?.tint?shade(finish.tint,.65):finish?.data.ink||(tex==='wood'?'#765d44':'#8c8574'),sz=grain==='floorWood'?165:grain?86:tex==='stone'?22:tex==='porcelain'?38:tex==='metal'?6:17;
    let mark='';
    if(grain){
      const grainKey='swatch-'+grain,srcId=prefix+'-'+grainKey;
      if(!patterns.has(grainKey))patterns.set(grainKey,{id:srcId,html:'<image id="'+srcId+'" width="1" height="1" preserveAspectRatio="none" href="'+renderGrain[grain]+'"/>'});
      mark='<use href="#'+srcId+'" transform="scale('+sz+')" opacity="'+(grain==='floorWood'?'.32':'.21')+'" style="mix-blend-mode:soft-light"/>';
    }else if(tex==='stone'||tex==='quartz'){
      const fleck=finish?.key==='charcoal'?'#c5c7c4':ink;
      mark=`<g fill="${fleck}" opacity=".43"><circle cx="3.4" cy="7.2" r=".26"/><circle cx="16.7" cy="3.8" r=".32"/><circle cx="12" cy="18.4" r=".17"/><circle cx="20.3" cy="13" r=".24"/></g><path d="M0 17.2Q5 16.6 7.8 14.1T15 13.7" fill="none" stroke="${fleck}" opacity=".33" stroke-width=".21"/>`;
    }else if(tex==='porcelain'||tex==='marble'){
      mark=`<path d="M-.6 29Q7 25 13 18.5T24.4 7.6T39 -1M13 18.5Q17.2 16.2 20 11.5" fill="none" stroke="${ink}" opacity=".53" stroke-width=".34"/><path d="M0 30q7-4.8 12.5-10.1" fill="none" stroke="#fff" opacity=".7" stroke-width=".45"/>`;
    }else if(tex==='metal'){
      mark='<g stroke="#d6dfd9" opacity=".22" stroke-width=".14"><path d="M0 1.1h6M0 3.8h6"/></g>';
    }else if(tex==='wood'){
      // Grain runs lengthwise on a worktop and vertically on a door.
      const strokes='<path d="M2.1 -.2q-.55 4.1 .06 8t.13 9.6M6.4 -.2q.52 5.2-.25 8.1t-.05 9.6M12.1 -.2q-1.1 3.2-.3 6.3t.18 11.3" fill="none" stroke="'+ink+'" opacity=".36" stroke-width=".23"/><path d="M9.2 0q.3 5.5-.1 8.4t-.21 8.8" fill="none" stroke="#f4d9af" opacity=".24" stroke-width=".19"/>';
      mark=horizontal?'<g transform="translate(17 0) rotate(90)">'+strokes+'</g>':strokes;
    }
    patterns.set(key,{id,html:`<pattern id="${id}" data-mesh-texture="${tex}" width="${sz}" height="${sz}" patternUnits="userSpaceOnUse" patternTransform="matrix(${matrix})"><rect width="${sz+.045}" height="${sz+.045}" fill="${base}"/>${mark}</pattern>`});
  }
  return 'url(#'+patterns.get(key).id+')';
}
export function renderKitchenRoom(plan,opts={}){
  const k=opts.kitchen||plan.kitchen;if(!k)throw new Error('renderKitchenRoom requires a kitchen plan.');
  const c=modelScene(plan,k),g=c.g,building=c.building,prefix=String(opts.prefix||'kitchen-room').replace(/[^a-zA-Z0-9_-]/g,'_'),patterns=new Map(),P=opts.projection||makeRoomProjection(plan,opts),closedRoom=opts.mode==='closed'||opts.mode==='solid';
  if(!opts.projection){const points=building.outer.flatMap(q=>[P.project(q.x,0,q.z),P.project(q.x,g.room.height,q.z)]),sw=2*Math.max(...points.map(p=>Math.abs(p.x))),sh=2*Math.max(...points.map(p=>Math.abs(p.y))),pad=Math.min(23,Math.max(8,Math.max(sw,sh)*.035)),w=(sw+2*pad)/P.zoom,h=(sh+2*pad)/P.zoom;P.bounds={x:-w/2,y:-h/2,w,h};P.viewBox=[-w/2,-h/2,w,h].map(n).join(' ');}
  const normalSign=closedRoom?-1:1,visible=new Set(building.segments.filter(s=>(s.inward.x*P.eye.x+s.inward.z*P.eye.z)*normalSign>E).map(s=>s.id));if(-P.eye.y*normalSign>E)visible.add('floor');if(P.eye.y*normalSign>E)visible.add('ceiling');const shell={projection:P,bounds:P.bounds,viewBox:P.viewBox,visibleSurfaces:[...visible],mode:closedRoom?'closed':'cutaway',room:g.room,selectedSurface:opts.selectedSurface||null};
  const photoFor=id=>{const p=opts.photos instanceof Map?opts.photos.get(id):opts.photos?.[id]||(id===(opts.photoWall||'back')?opts.photoUrl:null);return typeof p==='string'&&(/^data:image\/(jpeg|png|webp|avif);base64,[a-zA-Z0-9+/=]+$/.test(p)||p.startsWith('blob:'))?p:null;};
  function wallPhoto(f,base){const id=f.surface,s=building.byId.get(id),src=photoFor(id);if(!src||!s||f.tag!=='wall-plaster')return base;const key='photo-'+id;if(!patterns.has(key)){const a=P.projectPoint(wallWorld(s,s.start,0,0)),b=P.projectPoint(wallWorld(s,s.start+1,0,0)),v=P.projectPoint(wallWorld(s,s.start,1,0)),matrix=[b.x-a.x,b.y-a.y,v.x-a.x,v.y-a.y,a.x,a.y].map(n).join(' '),pid=prefix+'-'+key;patterns.set(key,{id:pid,html:'<pattern id="'+pid+'" data-room-photo="'+esc(id)+'" width="'+n(s.length)+'" height="'+n(g.room.height)+'" patternUnits="userSpaceOnUse" patternTransform="matrix('+matrix+')"><image href="'+esc(src)+'" width="'+n(s.length)+'" height="'+n(g.room.height)+'" preserveAspectRatio="none"/></pattern>'});}return 'url(#'+patterns.get(key).id+')';}
  function tiledWall(f,base){const m=f.mat,s=building.byId.get(f.wall),key='tile:'+f.wall;if(!m?.cladding||!s)return base;if(!patterns.has(key)){const y=g.room.height-Math.ceil(g.room.height/m.tileHeight)*m.tileHeight,z=.18,a=P.projectPoint(wallWorld(s,s.start,y,z)),b=P.projectPoint(wallWorld(s,s.start+1,y,z)),c=P.projectPoint(wallWorld(s,s.start,y+1,z)),matrix=[b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y].map(n).join(' '),id=prefix+'-cladding-'+patterns.size,w=n(m.tileWidth),h=n(m.tileHeight),joint=shade(base,.78),lip=shade(base,1.055);
    patterns.set(key,{id,html:'<pattern id="'+id+'" data-cladding-pattern="'+esc(m.cladding)+'" patternUnits="userSpaceOnUse" width="'+w+'" height="'+h+'" patternTransform="matrix('+matrix+')"><rect width="'+(w+.03)+'" height="'+(h+.03)+'" fill="'+base+'"/><path d="M.13 '+h+'V.13H'+w+'" stroke="'+joint+'" stroke-width=".27" fill="none"/><path d="M.39 '+h+'V.39H'+w+'" stroke="'+lip+'" stroke-width=".14" fill="none"/></pattern>'});}return 'url(#'+patterns.get(key).id+')';}
  // Glazing without a site photograph transmits neutral daylight.
  function glazingPaint(f,base){if(!f.mat?.glazing)return base;const key='glazing:'+f.id;if(!patterns.has(key)){const seg=building.byId.get(f.wall),opening=g.features.find(o=>o.id===f.id);if(!seg||!opening)return base;const ps=f.points,z=wallLocal(seg,ps[0]).d,y=g.room.height-opening.bottom-opening.height,a=P.projectPoint(wallWorld(seg,opening.u,y,z)),b=P.projectPoint(wallWorld(seg,opening.u+1,y,z)),c=P.projectPoint(wallWorld(seg,opening.u,y+1,z)),matrix=[b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y].map(n).join(' '),w=opening.width,h=opening.height,pid=prefix+'-glass-'+patterns.size,inside=['corridor','laundry','lightwell'].includes(f.adjacent),frosted=f.mat.frosted;
    const light=frosted?'#e2e8e3':inside?'#d4d6cc':'#dbe7e8',high=inside?'#e9e8e0':'#f7f9f6',low=inside?'#bcc1b8':'#bbc9c7';
    const gid=pid+'-light',glass='<linearGradient id="'+gid+'" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="'+high+'"/><stop offset=".56" stop-color="'+light+'"/><stop offset="1" stop-color="'+low+'"/></linearGradient>';
    patterns.set(key,{id:pid,html:glass+'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="'+n(w)+'" height="'+n(h)+'" patternTransform="matrix('+matrix+')"><rect width="'+n(w)+'" height="'+n(h)+'" fill="url(#'+gid+')"/>'+(frosted?'':'<path d="M0 0H'+n(w*.46)+'L0 '+n(h*.82)+'Z" fill="#fff" opacity=".14"/>')+'</pattern>'});}return 'url(#'+patterns.get(key).id+')';}
  const records=[],chosen=opts.selectedId||null,paintedStone=new Set();let polygons='';
  const surfaceLight=roomSurfaceLight(P,g,building,prefix,patterns);
  visitVolumePartition(c.tree,P.eye,f=>{
    if(!closedRoom&&opts.inspectInteriorId===f.id&&(f.kind==='storage'||f.kind==='tall')&&['door-front','recessed-panel','pull','pull-post','pull-highlight','tall-seam'].includes(f.tag))return;
    if(f.building){if(!visible.has(f.surface||f.wall)||f.mat?.cladding&&photoFor(f.wall))return;if(f.side==='interior'&&closedRoom||f.side==='exterior'&&!closedRoom||f.side==='edge'&&(closedRoom||f.adjacent&&visible.has(f.adjacent)))return;}
    else if(closedRoom)return;else if(f.part==='fixture'&&!['column','shaft'].includes(f.kind)&&!visible.has(f.wall))return;
    if(dot(f.N,P.eye)<=E)return;
    const ps=f.points.map(P.projectPoint),xs=ps.map(q=>q.x),ys=ps.map(q=>q.y),base=shade(f.color,.74+.31*Math.max(0,dot(f.N,sun))+.07*Math.max(0,-f.N.y)),finish=appliedFinish(f),surfTexture=f.mat?.type?.startsWith('floor-')?f.mat.type.slice(6):f.mat?.type;
    let fill=f.building?wallPhoto(f,base):finishPaint(P,prefix,patterns,f,base,finish);if(f.building&&fill===base&&['wood','marble','stone','metal'].includes(surfTexture))fill=finishPaint(P,prefix,patterns,f,base,{key:surfTexture,data:{texture:surfTexture}});
    if(f.mat?.cladding)fill=tiledWall(f,base);if(f.mat?.glazing)fill=glazingPaint(f,fill);
    // Match neighbouring BSP fragments at their sample boundaries; the skin
    // is opaque, so no object on the far side bleeds through a nearer one.
    const attributes=f.part==='surface'?`data-room-surface="${esc(f.surface)}" data-building-face="${esc(f.tag)}"${f.mat?.cladding?' data-wall-cladding="'+esc(f.mat.cladding)+'"':''}${f.sitePoint?' data-site-point="'+esc(f.sitePoint)+'"':''}${f.mat?.backsplash?' data-k-backsplash="'+esc(f.mat.backsplash)+'" data-k-splash-wall="'+esc(f.wall)+'"':''}`:`data-kitchen-3d-part="${f.part}" data-kitchen-3d-id="${esc(f.id)}" data-kitchen-3d-kind="${esc(f.kind)}" data-kitchen-face="${esc(f.tag)}"${f.component?' data-kitchen-component="'+esc(f.component)+'"':''}${f.index?' data-kitchen-index="'+f.index+'"':''}${f.partSku?' data-factory-part-sku="'+esc(f.partSku)+'"':''}${f.opening?' data-room-opening="'+esc(f.id)+'"':''}${f.mat?.glazing?' data-kitchen-glazing="'+(f.mat.frosted?'frosted':'clear')+'"':''}${f.hinge?' data-door-hand="'+esc(f.hinge)+'"':''}${f.swing?' data-door-swing="'+esc(f.swing)+'"':''}${f.leafId?' data-door-leaf="'+esc(f.leafId)+'" data-hinge-side="'+esc(f.hingeSide)+'" data-door-angle="'+n(f.doorAngle)+'"':''}${finish?' data-kitchen-'+finish.type+'-finish="'+esc(finish.key)+'"':''}${finish?.tint?' data-kitchen-'+finish.type+'-color="'+esc(finish.tint)+'"':''}${f.basis?.r.placement==='free'?' data-kitchen-free-run="'+esc(f.runId)+'"':''}`;
    if(f.tag==='stone-top'&&building.segments.length===4&&!plan.room?.architecture?.cut&&!plan.room?.architecture?.outline){
      if(!paintedStone.has(f.id)){
        paintedStone.add(f.id);const slab=g.worktops.find(t=>t.id===f.id),y=g.room.height-slab.bottom-slab.height;
        const ring=o=>{const ps=atHeight(footprint(o),y).map(P.projectPoint);return 'M'+ps.map(q=>n(q.x)+' '+n(q.y)).join('L')+'Z';};
        const d=ring(slab)+(slab.holes||[]).map(ring).join('');
        polygons+=`<path ${attributes} d="${d}" fill="${fill}" fill-rule="evenodd" stroke="${base}" stroke-width=".12" stroke-linejoin="round"/>`;
      }
    }else polygons+=`<polygon ${attributes} points="${points(ps)}" fill="${fill}" stroke="${f.building?fill:base}" stroke-width="${['wall-plaster','wall-cladding','wall-exterior','ceiling-soffit','finished-floor','roof-exterior','masonry-cut-edge'].includes(f.tag)?'.72':f.tag==='door-leaf'||edgedFronts.has(f.tag)?'.46':'.15'}" stroke-linejoin="round"/>`;

    const light=!closedRoom&&!(f.building&&photoFor(f.wall))&&surfaceLight(f);
    if(light)polygons+='<path d="M'+ps.map(q=>n(q.x)+' '+n(q.y)).join('L')+'Z" fill="'+light+'" pointer-events="none"/>';
    polygons+=edgeLighting(f,ps);
    records.push({f,ps,x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)});
  });
  const obj=chosen&&[...g.units,...g.features,...g.runs,...g.worktops].find(x=>x.id===chosen),outline=!closedRoom&&obj?selectedOutline(P,{...obj,H:g.room.height},chosen):'';
  const witnesses=!closedRoom&&opts.showConflicts!==false?g.conflicts.map(v=>witness(P,g,v)).join(''):'';
  const html=`<defs>${[...patterns.values()].map(p=>p.html).join('')}</defs><g data-kitchen-3d="" data-kitchen-state="${closedRoom?'closed':'cutaway'}">${polygons}</g>`+outline+witnesses;
  function hitTest(x,y){
    if(x&&typeof x==='object'){y=x.y;x=x.x;}if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const ray=P.ray(x,y);let best=null,along=-Infinity;
    for(const r of records){if(x<r.x0-E||x>r.x1+E||y<r.y0-E||y>r.y1+E||!insidePoly(x,y,r.ps))continue;
      const f=r.f,den=dot(f.N,ray.direction),t=(f.D-dot(f.N,ray.origin))/den;if(t<along-E)continue;along=t;
      const world=sum(ray.origin,mul(ray.direction,t));best={part:f.part,id:f.id,kind:f.kind,wall:f.wall,tag:f.tag,runId:f.runId,world,...(f.component?{component:f.component}:{}),...(f.index?{index:f.index}:{}),...(f.sectionId?{sectionId:f.sectionId}:{}),...(f.surface?{surface:f.surface,buildingSide:f.side}:{}),...(f.sitePoint?{sitePointId:f.sitePoint,siteKind:f.siteKind}:{}),...(f.leafId?{leafId:f.leafId,hingeSide:f.hingeSide,doorAngle:f.doorAngle}:{})};
    }
    if(!best)return null;
    if(best.part==='worktop'){const below=g.units.find(u=>u.runId===best.runId&&inFoot(best.world,footprint(u)));if(below)best.unitId=below.id;}
    return best;
  }
  return {...shell,html,building,geometry:g,hitTest,editOccluders:records};
}
