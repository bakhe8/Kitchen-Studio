// Meshes in the SAME run-local centimetres as the main renderer. The boxes,
// tubes and faces therefore participate in its depth sort, ray hits, shadows
// and photographic scene, instead of being screen-space appliance stickers.
import {scopedCells,scopedDividers} from './shelf-selection-model.js';
import {effectiveFinish} from './shelf-group-finish.js';
import {buildVolumeArt} from './shelf-volume-contents.js';
import {kitchenHoodBlocks} from './kitchen-catalog.js';

const families=new Set(['fridge','freezer','oven-tower','hood','open-shelf','bottle-rack','pullout']);
const P=(x,y,z)=>({x,y,z}),steel='#a4adb0',dark='#39474a',glass='#718f96',inner='#d4d9d4',wood='#bc986d';
const XY=(x,y,z,w,h)=>[P(x,y,z),P(x+w,y,z),P(x+w,y+h,z),P(x,y+h,z)];
const XZ=(x,y,z,w,d)=>[P(x,y,z),P(x+w,y,z),P(x+w,y,z+d),P(x,y,z+d)];
const YZ=(x,y,z,h,d)=>[P(x,y,z),P(x,y+h,z),P(x,y+h,z+d),P(x,y,z+d)];
function localBox(emit,map,x,y,z,w,h,d,fill,tag){
  if(Math.min(w,h,d)<=0)return;
  const faces=[XY(x,y,z+d,w,h),XY(x,y,z,w,h).reverse(),XZ(x,y,z,w,d),XZ(x,y+h,z,w,d).reverse(),YZ(x,y,z,h,d).reverse(),YZ(x+w,y,z,h,d)];
  for(const face of faces)emit(face.map(map),fill,tag);
}
function frontGrip(m,x,y,z,w,style='bar',tag='equipment-handle'){
  if(style==='handleless'){m.emit(XY(x+w*.16,y,z,w*.68,1.1),'#373d3c',tag+'-recess');return;}
  if(style==='knob'){m.tube(P(x+w*.5,y+.7,z-.9),P(x+w*.5,y+.7,z),1.05,'#adaba0',tag+'-knob',8);return;}
  m.box(x+w*.22,y,z-.8,w*.56,1.3,.8,'#9d9c91',tag+'-bar');
}
function panelSkin(m,x,y,z,w,h,paint,o,factoryPull){
  m.box(x,y,z,w,h,1.08,paint,'equipment-cabinet-front');
  const front=z+1.09;
  if(o.frontStyle==='framed'){const k=Math.min(3,w*.09);for(const [a,b,c,d] of [[0,0,w,k],[0,h-k,w,k],[0,k,k,h-2*k],[w-k,k,k,h-2*k]])m.box(x+a,y+b,front,c,d,.24,paint,'equipment-frame');}
  if(o.frontStyle==='fluted'){const step=Math.max(2.8,w/16);for(let q=step*.5;q<w-.8;q+=step)m.box(x+q,y+.6,front,.55,h-1.2,.34,paint,'equipment-flute');}
  if(!factoryPull?.(m,o.factoryHandle,x,y,front,w,h))frontGrip(m,x,y+3,front+.13,w,o.handleStyle);
}
function coldDoor(ctx,leaf,kind){
  const {o,H,m}=ctx,w=leaf.leafWidth,h=leaf.height,t=leaf.thickness,open=o.open;
  const map=p=>{const yy=H-leaf.bottom-h+p.y;
    if(!open)return P(leaf.closed.u+p.x,yy,leaf.closed.offset+p.z);
    return leaf.hingeSide==='left'?P(leaf.hingeU+t-p.z,yy,leaf.hingeD+p.x):P(leaf.hingeU+p.z-t,yy,leaf.hingeD+w-p.x);};
  const fill=o.frontColor||ctx.paint||steel,box=(...p)=>localBox(m.emit,map,...p);
  const tiny=Math.min(.08,t*.12);
  box(0,0,tiny,w,h,t-2*tiny,fill,kind+'-door');
  const gripX=leaf.hingeSide==='left'?w-3.1:1.6,Hg=h*.32;
  box(gripX,h*.27,t-tiny,1.5,Hg,tiny,'#465151',kind+'-grip');
  if(leaf.index===0){const q=Math.min(12,w*.45);box((w-q)/2,h*.17,t-tiny,q,3,tiny*.65,'#253a3b',kind+'-display');
    box((w-q)/2+.7,h*.17+.9,t-tiny*.35,Math.min(q-1.5,4),.6,tiny*.35,'#9acac6',kind+'-display-lit');}
  if(open){const trayWidth=w-3;
    for(const f of [.40,.69])box(1.5,h*f,0,trayWidth,2,tiny,'#d8ddd4',kind+'-liner');}
}
export function drawKitchenEquipment(kind,ctx){
  if(!families.has(kind))return false;
  const {m,x,y,z,w,h,height,d,s,o,H}=ctx,{box,emit,tube}=m,front=z+d,bottom=y+height;
  const paint=o.frontColor||ctx.paint,th=Math.min(1.6,w*.055,d*.06),internal=(o.frontFinish||o.frontColor)?paint:wood;
  const decoration=(a,b,c,ww,hh,col,tag)=>emit(XY(a,b,c,ww,hh),col,tag);
  function shell(color,inside=inner,covered=true){
    box(x,y,z,th,h,d,color,kind+'-left-side');box(x+w-th,y,z,th,h,d,color,kind+'-right-side');
    box(x+th,y+h-th,z,w-2*th,th,d,color,kind+'-floor');if(covered)box(x+th,y,z,w-2*th,th,d,color,kind+'-roof');
    box(x+th,y+th,z+.1,w-2*th,h-2*th,th,inside,kind+'-back');
    if(height>h)box(x+.4,y+h,z+.5,w-.8,height-h,Math.max(1,d-4),'#535a51',kind+'-toe');
  }
  if(kind==='fridge'||kind==='freezer'){
    const coldSkin=o.frontColor||((o.frontFinish&&paint)||'#bdc5c3');shell(coldSkin,'#dce2da');
    if(kind==='fridge'){
      for(const f of [.22,.39,.56,.73]){const yy=y+h*f;box(x+th,yy,z+3,w-2*th,1.3,d-6,'#a0b9b5','fridge-glass-shelf');box(x+th,yy,front-5,w-2*th,1.95,1.1,'#ccd7d2','fridge-shelf-edge');}
      for(let i=0;i<2;i++)box(x+th+1+i*(w-2*th-2)/2,y+h*.79,z+5,(w-2*th-3)/2,h*.16,d-10,'#a6bcb3','fridge-crisper');
    }else for(let i=0;i<4;i++){const yy=y+h*.09+i*h*.204;
      box(x+th+1,yy,z+4,w-2*th-2,h*.177,d-9,'#bbcbd1','freezer-bin');
      decoration(x+w*.40,yy+3,front-4.95,w*.20,1.8,'#697d85','freezer-bin-pull');}
    for(const leaf of o.doorLeaves||[])coldDoor({...ctx,paint:coldSkin},leaf,kind);
    for(let i=0;i<6;i++)decoration(x+w*.18+i*w*.10,bottom-4.0,front-3.48,w*.06,1.25,'#414d4c',kind+'-grille');
  }else if(kind==='oven-tower'){
    shell(internal,'#756e62');const fy=H-o.bottom-82,ovenH=Math.min(57,height*.31),oy=fy-ovenH;
    panelSkin(m,x+.5,y+.5,front-1.5,w-1,Math.max(5,oy-y-12),internal,o);
    box(x+.5,oy-10,front-1.6,w-1,9.5,1.6,steel,'tower-control');decoration(x+w*.34,oy-8,front+.02,w*.32,4.3,'#233b3d','tower-display');
    for(const f of [.15,.85])tube(P(x+w*f,oy-5,front-.1),P(x+w*f,oy-5,front+.24),1.6,'#485051','tower-dial',10);
    box(x+2,oy,z+d*.25,w-4,ovenH,d*.30,'#394247','tower-cavity');
    if(o.openPart){const q=o.openPart;
      box(q.u,H-q.bottom-q.height,q.offset,q.width,q.height,q.depth,'#343e43','tower-open-glass-door');
      for(const f of [.48,.76]){box(x+2,oy+ovenH*f,z+d*.25,w-4,1.15,d*.69,steel,'tower-rack');}}
    else{box(x+.5,oy,front-1.6,w-1,ovenH,1.6,'#2e363b','tower-oven-door');decoration(x+w*.10,oy+7,front+.03,w*.8,ovenH-15,'#54666b','tower-oven-glazing');frontGrip(m,x,oy+2,front+.4,w,'bar','tower');}
    panelSkin(m,x+.5,fy+.75,front-1.5,w-1,Math.max(5,y+h-fy-1.3),internal,o);
  }else if(kind==='hood'){
    const c=o.frontColor||((o.frontFinish&&paint)||steel);
    for(const part of kitchenHoodBlocks(w,height,d))box(x+part.du,bottom-part.db-part.height,z,part.width,part.height,part.depth,c,part.part);
    const count=Math.max(4,Math.min(13,Math.floor(w/6)));
    for(let i=0;i<count;i++){const xx=x+w*.15+i*w*.69/count;
      emit(XZ(xx,bottom+.025,z+d*.21,w*.45/count,d*.54).reverse(),'#535f60','hood-filter-slot');}
    for(const f of [.11,.89]){emit(XZ(x+w*f-1.2,bottom+.03,front-4.5,2.4,2.0).reverse(),'#f2dda1','hood-task-lamp');}
    decoration(x+w*.72,bottom-4.8,front+.025,w*.19,1.9,'#4d595a','hood-controls');
  }else if(kind==='open-shelf'){
    shell(internal,internal,true);
    if(o.detail){
      const doc={...o.detail,cab:{x:0,y:0,w,h},depth:d,wall:{w:Math.max(60,w),h:Math.max(60,h)}},shade={oak:'#bb956c',walnut:'#7b5d45',ivory:'#dedccc'};
      for(const b of scopedDividers(doc).filter(v=>v.kind==='cabinet'))box(x+b.x,y+b.y,z+th,b.w,b.h,Math.max(1,d-th),internal,'open-shelf-local-board');
      for(const c of scopedCells(doc))decoration(x+c.x,y+c.y,z+th+.05,c.w,c.h,shade[effectiveFinish(doc,c.key)]||internal,'open-shelf-backing');
      for(const e of buildVolumeArt(doc,{depth:d}))emit(e.points.map(p=>P(x+p.x,y+p.y,z+p.z)),e.fill,'open-shelf-'+e.kind);
    }else{
      for(let i=0;i<(o.interior?.shelves||0);i++)box(x+th,y+(i+1)*h/(o.interior.shelves+1),z+th,w-2*th,th,d-th,internal,'open-shelf-board');
      for(let i=0;i<(o.interior?.dividers||0);i++)box(x+(i+1)*w/(o.interior.dividers+1),y+th,z+th,th,h-2*th,d-th,internal,'open-shelf-divider');
    }
  }else if(kind==='bottle-rack'){
    shell(internal,'#615448');const n=Math.max(1,Math.min(6,Math.round(w/14))),rows=Math.max(2,Math.min(6,Math.round(h/17))),sx=(w-2*th)/n,sy=(h-2*th)/rows;
    for(let i=1;i<n;i++)box(x+th+i*sx-.55,y+th,z+th,1.1,h-2*th,d-th,internal,'bottle-grid-post');
    for(let j=1;j<rows;j++)box(x+th,y+th+j*sy-.55,z+th,w-2*th,1.1,d-th,internal,'bottle-grid-shelf');
    for(let j=0;j<rows;j++)for(let i=0;i<n;i++)if((i+2*j)%3===0){
      const rad=Math.min(4.3,sx*.30,sy*.28,d*.13),cx=x+th+(i+.5)*sx,cy=y+th+(j+1)*sy-rad-.65,cz=front-4.5,cl=['#616e50','#855c48','#4c6758'][(i+j)%3];
      tube(P(cx,cy,z+3),P(cx,cy,cz-3),rad,cl,'bottle-body',8);
      tube(P(cx,cy,cz-3),P(cx,cy,cz+1.7),rad*.40,cl,'bottle-neck',7);tube(P(cx,cy,cz+1.7),P(cx,cy,cz+2.6),rad*.42,'#af9470','bottle-cork',7);
    }
  }else if(kind==='pullout'){
    shell(internal,'#8b7c65',false);
    const part=o.openPart,frontPlane=part?part.offset+part.depth:front,
      left=part?part.u:x+.55,ww=part?part.width:w-1.1,yy=part?H-part.bottom-part.height:y+.6,hh=part?part.height:h-1.2;
    if(part){for(const f of [.38,.86]){const by=yy+hh*f;box(left+.45,by,part.offset,ww-.9,1.6,part.depth-1.5,'#969e9a','pullout-tray');
      for(const a of [.8,ww-.8]){box(left+a,by-8,part.offset+.45,.72,.72,part.depth-2.1,steel,'pullout-gallery');
        for(const t of [1.,part.depth*.53,part.depth-2])box(left+a,by-8,part.offset+t,.65,8,.65,steel,'pullout-upright');}}
    }
    panelSkin(m,left,yy,frontPlane-1.45,ww,hh,internal,o,ctx.factoryPull);
  }return true;
}
