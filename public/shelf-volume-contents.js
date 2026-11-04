import {ownKey} from './kitchen-safe-keys.js';
// Convex world-space faces for the shelf renderer. x: right; y: down; z:
// out from the wall. Display ornaments may fit a smaller opening; the screen
// is a measured physical reference and never goes through that fitting path.
import {scopedCells} from './shelf-selection-model.js';
import {inspectSizedScreen} from './shelf-sized-object.js';

const pt=(x,y,z)=>({x,y,z});
const add=(a,b)=>pt(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>pt(a.x-b.x,a.y-b.y,a.z-b.z);
const mult=(a,s)=>pt(a.x*s,a.y*s,a.z*s);
const cross=(a,b)=>pt(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const unit=a=>{const d=Math.hypot(a.x,a.y,a.z);return d?mult(a,1/d):pt(0,1,0);};
const YUP=pt(0,-1,0),YDOWN=pt(0,1,0),FRONT=pt(0,0,1);
function face(out,points,fill,tag,normal) {
  if(normal&&dot(cross(sub(points[1],points[0]),sub(points[2],points[0])),normal)<0)points=points.slice().reverse();
  out.push({points,fill,tag,twoSided:true});
}
function panel(out,x,y,z,w,h,fill,tag){face(out,[pt(x,y,z),pt(x+w,y,z),pt(x+w,y+h,z),pt(x,y+h,z)],fill,tag,FRONT);}
// A book can lean: offset its top edge in x, rather than painting a rotated
// rectangle on the back panel. Its covers, head, spine and back remain solid.
function block(out,x,y,z,w,h,d,color,tag,lean=0){
  const c=typeof color==='string'?{body:color}:color;
  const b=[pt(x,y+h,z),pt(x+w,y+h,z),pt(x+w,y+h,z+d),pt(x,y+h,z+d)];
  const t=b.map(v=>pt(v.x+lean,y,v.z));
  face(out,t,c.top||c.body,tag,YUP);face(out,b,c.bottom||c.body,tag,YDOWN);
  for(let i=0;i<4;i++){const j=(i+1)%4;
    const normal=[pt(0,0,-1),pt(1,0,0),FRONT,pt(-1,0,0)][i];
    face(out,[b[i],b[j],t[j],t[i]],i===2?(c.front||c.body):c.body,tag,normal);
  }
}
function ring(cx,y,cz,r,n){return Array.from({length:n},(_,i)=>{const a=2*Math.PI*i/n+Math.PI/n;return pt(cx+r*Math.cos(a),y,cz+r*Math.sin(a));});}
function ringSides(out,a,b,cx,cz,fill,tag){
  for(let i=0;i<a.length;i++){const j=(i+1)%a.length;
    face(out,[a[i],a[j],b[j],b[i]],fill,tag,pt((a[i].x+a[j].x)/2-cx,0,(a[i].z+a[j].z)/2-cz));
  }
}
function stem(out,a,b,width,color){
  const axis=unit(sub(b,a)),right=unit(cross(axis,Math.abs(axis.z)<.85?FRONT:YDOWN)),front=unit(cross(axis,right));
  const mk=(center,s)=>Array.from({length:3},(_,i)=>add(center,add(mult(right,Math.cos(i*2*Math.PI/3)*s),mult(front,Math.sin(i*2*Math.PI/3)*s))));
  const A=mk(a,width),B=mk(b,width*.6);
  for(let i=0;i<3;i++){const j=(i+1)%3;face(out,[A[i],A[j],B[j],B[i]],color,'stem',sub(mult(add(A[i],A[j]),.5),a));}
}

const booksPalette=['#435f5d','#c27b56','#738978','#ead1a0','#936f57','#556c80','#a79164'];
function books(seed){
  const o=[];let x=0;
  for(let i=0;i<5;i++){
    const w=[3.5,4.4,3.9,5.0,3.7][i],h=[23,18.5,22.5,20,25][(seed+i)%5],d=14+[1,0,2.4,1.8,0][i];
    const lean=i===4?4.2:0,z=(i%2)*.8,col=booksPalette[(seed+2*i)%booksPalette.length];
    block(o,x,-h,z,w,h,d,{body:col,top:'#e6dbc4'},'book',lean);
    for(const [y,barH] of [[-h*.73,.66],[-h*.68,.3],[-h*.17,.47]]){
      // Keep the spine markings flush with the sloping book, not axis-aligned.
      const left=x+w*.15-(y/h)*lean,right=left+w*.70,bottom=left-barH/h*lean;
      face(o,[pt(left,y,z+d+.035),pt(right,y,z+d+.035),pt(bottom+w*.7,y+barH,z+d+.035),pt(bottom,y+barH,z+d+.035)],'#e8d5aa','spine-band',FRONT);
    }
    x+=w+.24;
  }return o;
}
function boxes(seed){
  const o=[],cloth=['#a6967f','#8b9b88','#a67e67'],caps=['#bca98c','#a5b29d','#bd9581'];
  function box(x,y,z,w,h,d,k){
    const fill=cloth[k%3];
    block(o,x,y,z,w,h,d,fill,'box');
    block(o,x-.35,y-1.35,z-.42,w+.7,1.55,d+.84,caps[k%3],'box-lid');
    panel(o,x+w*.33,y+h*.32,z+d+.04,w*.34,h*.33,'#746250','label-holder');
    panel(o,x+w*.36,y+h*.355,z+d+.075,w*.28,h*.235,'#e5d7b9','box-label');
    panel(o,x+w*.41,y+h*.455,z+d+.12,w*.16,.30,'#9a8972','label-ink');
  }
  box(0,-12,0,27,12,22,seed);box(3.2,-23.3,2,21,10,17,seed+1);return o;
}
function vase(seed){
  const o=[],n=8,cx=0,cz=0;
  const palette=[['#779a92','#97b7ac','#55766f'],['#b07a59','#c6916d','#805740'],['#c5bda6','#ded6bd','#8c8778']][seed%3];
  const profile=[[0,5.3],[-5.3,9.2],[-12.6,10],[-21.8,4.4],[-28,3.55],[-28.8,4.05]];
  const rings=profile.map(([y,r])=>ring(cx,y,cz,r,n));
  for(let i=1;i<rings.length;i++)ringSides(o,rings[i-1],rings[i],cx,cz,i===rings.length-1?palette[1]:palette[0],'ceramic');
  // A real opening with an inner dark throat, visible from a higher camera.
  const neck=rings.at(-1),inner=ring(cx,-28.8,cz,2.8,n),deep=ring(cx,-27.25,cz,2.65,n);
  for(let i=0;i<n;i++){const j=(i+1)%n;
    face(o,[neck[i],neck[j],inner[j],inner[i]],palette[1],'vase-lip',YUP);
    face(o,[inner[i],inner[j],deep[j],deep[i]],palette[2],'inner-throat',pt(-inner[i].x,0,-inner[i].z));
  }
  face(o,deep,palette[2],'vase-mouth',YUP);
  face(o,rings[0],palette[2],'foot',YDOWN);return o;
}
const leafColours=[['#476d51','#779262'],['#69865f','#96ad75'],['#3b624f','#668669'],['#536d40','#899858']];
function plant(seed){
  const o=[],n=8,pot=seed%2?'#b67d5f':'#c9bc99';
  const base=ring(0,0,0,5,n),upper=ring(0,-10,0,7.1,n),lip=ring(0,-11.4,0,7.5,n);
  ringSides(o,base,upper,0,0,pot,'pot');ringSides(o,upper,lip,0,0,seed%2?'#cf9672':'#e0d5b4','pot-lip');
  face(o,base,'#887059','pot-base',YDOWN);face(o,lip,'#61533e','soil',YUP);
  // A real folded blade has a projecting midrib; its triangular planes stay
  // non-coplanar at oblique angles. A stem is a narrow triangular prism.
  const blades=[[-11,-22,1],[-6,-29,-6],[1,-34,1],[8,-27,-3],[12,-21,5],[-4,-20,9]];
  blades.forEach(([x,y,z],i)=>{
    const base=pt((i%3-1)*.95,-11.4,(i%2-.5)*1.7),tip=pt(x,y,z);
    const baseToTip=sub(tip,base),root=add(base,mult(baseToTip,.40)),mid=add(root,mult(sub(tip,root),.45));
    const width=3.1+(i%3)*.5;
    const lateral=mult(unit(pt(z||1,0,-x||1)),width);
    const l=add(mid,lateral),r=sub(mid,lateral),ridge=add(mid,pt(0,-2.6,1.25));
    const [dark,light]=leafColours[(seed+i)%leafColours.length];
    stem(o,base,root,.48,'#66724e');
    face(o,[root,l,ridge],light,'leaf',YUP);face(o,[l,tip,ridge],light,'leaf',YUP);
    face(o,[root,ridge,r],dark,'leaf',YUP);face(o,[ridge,tip,r],dark,'leaf',YUP);
  });return o;
}

const models=new Map(),makers={books,boxes,plant,vase};
export const ART_CELL_LIMIT=48;
function shape(kind,seed){
  const id=kind+':'+seed;if(models.has(id))return models.get(id);
  const faces=makers[kind](seed),min=pt(Infinity,Infinity,Infinity),max=pt(-Infinity,-Infinity,-Infinity);
  for(const f of faces)for(const q of f.points)for(const k of ['x','y','z']){min[k]=Math.min(min[k],q[k]);max[k]=Math.max(max[k],q[k]);}
  const m={faces,min,max,span:sub(max,min)};models.set(id,m);return m;
}
function appendDecor(out,cell,depth) {
  if(!ownKey(makers,cell.content))return;
  // Stable repeatable styling for local children and top-level cells.
  let seed=7+17*cell.col+31*cell.row;
  for(const ch of cell.key.split('/').slice(1))seed=seed*7+Number(ch);
  seed=Math.abs(seed)%7;
  const m=shape(cell.content,seed),edge=Math.min(1.8,cell.w*.05,cell.h*.05);
  const back=Math.min(1.65,depth*.12),front=depth-Math.min(1.7,depth*.055);
  const scale=Math.min(1,(cell.w-2*edge)/m.span.x,(cell.h-edge)/m.span.y,(front-back)/m.span.z);
  if(!(scale>0))return;
  const clear=cell.w-2*edge-scale*m.span.x;
  const x=cell.x+edge+clear*[.28,.51,.62,.43,.56,.39,.67][seed]-m.min.x*scale;
  const y=cell.y+cell.h-m.max.y*scale;
  // Stand close enough to the front to be readable; retain an actual gap
  // behind and in front of the object when the cabinet has spare depth.
  const z=back+(.61+.045*(seed%3))*(front-back-scale*m.span.z)-m.min.z*scale;
  for(const f of m.faces)out.push({...f,kind:cell.content,key:cell.key,
    points:f.points.map(q=>pt(x+q.x*scale,y+q.y*scale,z+q.z*scale))});
}

function appendScreen(out,plan,depth) {
  const s=inspectSizedScreen(plan);if(!s)return;
  const o=[],{x,y,w,h}=s.rect,border=Math.min(.9,w*.048,h*.065),zFront=depth-Math.min(depth*.06,1.20);
  // Cabinet depth is a view assumption; the screen has only two authored
  // dimensions. Give its case a slim nominal thickness, never rescale x/y.
  const thick=Math.min(3,Math.max(.05,zFront*.20)),zBack=Math.max(0,zFront-thick);
  block(o,x,y,zBack,w,h,zFront-zBack,{body:'#34474a',front:'#17282f',top:'#465b5b'},'screen-case');
  const surfaceGap=Math.min(depth*.001,.003),glass=zFront+2*surfaceGap;
  panel(o,x+border,y+border,glass,w-2*border,h-2*border,'#345865','screen-glass');
  const ix=x+border,iy=y+border,iw=w-2*border,ih=h-2*border;
  face(o,[pt(ix,iy,glass+surfaceGap),pt(ix+iw,iy,glass+surfaceGap),pt(ix+iw,iy+ih*.22,glass+surfaceGap),pt(ix,iy+ih*.72,glass+surfaceGap)],'#527b84','screen-reflection',FRONT);
  // These are visual witnesses of the *existing* front-elevation fit check.
  // Timber occludes part of the real case, so mark the physical board's front
  // face at the measured overlap. Outside-cabinet marks stay on the glass.
  if(!s.fits)for(const c of s.conflicts){
    const r=c.overlap,z=c.kind==='outside'?glass+.014:depth+.017;
    panel(o,r.x,r.y,z,r.w,r.h,c.kind==='outside'?'#ad644c':'#cd6046','screen-conflict:'+c.id);
    o.at(-1).conflictId=c.id;o.at(-1).diagnostic=true;
  }
  for(const f of o)out.push({...f,kind:'screen',key:'screen',screenFits:s.fits});
}

const scenes=new WeakMap();
/** Returned faces and points are read-only by contract. Renderer may cache
 * and reproject them for different cameras without rebuilding the scene. */
export function buildVolumeArt(plan,{depth=35}={}) {
  if(!plan?.cab||!Number.isFinite(depth)||depth<=0)return [];
  const cached=scenes.get(plan);if(cached?.depth===depth)return cached.faces;
  const faces=[];
  // A 12x12 grid of plants made about 5 MB of SVG for one cabinet (8 such cabinets: 3.6 s and 42 MB). Real interiors decorate a handful of cells.
  let decorated=0;
  for(const c of scopedCells(plan)){if(!ownKey(makers,c.content))continue;if(decorated++>=ART_CELL_LIMIT)break;appendDecor(faces,c,depth);}
  appendScreen(faces,plan,depth);
  scenes.set(plan,{depth,faces});return faces;
}
