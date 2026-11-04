import {ownKey} from './kitchen-safe-keys.js';
import {outlineWallId,validateMeasuredOutline,excludedOutlinePieces} from './kitchen-measured-outline.js';
// Measured INSIDE faces, in cm: x right, z front. Follow the floor boundary
// back -> right -> front -> left, keeping the room on the positive local d
// side. Existing straight walls retain their original u=0 reference point
// even when the first section of their physical wall has been cut away.
import {convexIntersection} from './kitchen-oriented.js';
const P=(x,z)=>({x,z}),E=1e-7;
const cardinal=['back','right','front','left'];
export const architectureCorners=Object.freeze(['back-left','back-right','front-right','front-left']);
const cornersAr=['الخلفي الأيسر','الخلفي الأيمن','الأمامي الأيمن','الأمامي الأيسر'];
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const labels={back:'الجدار الخلفي',front:'الجدار الأمامي',left:'الجدار الأيسر',right:'الجدار الأيمن'};
for(const [i,c] of architectureCorners.entries())for(const [suffix,s] of Object.entries({x:'ردّة العرض',z:'ردّة العمق',diagonal:'الجدار المشطوف'}))labels['return-'+c+'-'+suffix]=s+' · الركن '+cornersAr[i];
export const architectureWallLabels=Object.freeze(labels);
export const architectureWallLabel=id=>ownKey(labels,id)?labels[id]:outlineWallId(id)?'ضلع الرفع '+Number(id.slice(5)):'جدار غير موجود';
export const architectureWallIdKnown=id=>typeof id==='string'&&(ownKey(labels,id)||outlineWallId(id));
const sub=(a,b)=>P(a.x-b.x,a.z-b.z),add=(a,b)=>P(a.x+b.x,a.z+b.z),scale=(v,n)=>P(v.x*n,v.z*n),dot=(a,b)=>a.x*b.x+a.z*b.z;
const length=v=>Math.hypot(v.x,v.z),unit=v=>scale(v,1/length(v)),turn=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
function source(input){
  if(input?.wall&&input.cab){
    const r=input.room||{},w=input.wall;return {width:r.width??w.w,length:r.length??300,height:r.height??w.h,
      ...(r.architecture??input.architecture?{architecture:r.architecture??input.architecture}:{}),
      ...(r.sitePoints??input.sitePoints?{sitePoints:r.sitePoints??input.sitePoints}:{})};
  }
  return input||{};
}
export function measuredKitchenRoom(input){
  const r=source(input);if(![r.width,r.length,r.height].every(v=>Number.isFinite(v)&&v>0))return {width:360,length:300,height:260};
  return {width:r.width,length:r.length,height:r.height,...(r.architecture?{architecture:r.architecture}:{}),...(r.sitePoints?{sitePoints:r.sitePoints}:{})};
}
export function validateKitchenRoomArchitecture(input){
  const r=source(input),{width:W,length:L,height:H}=r;
  const no=reason=>({ok:false,reason,room:null});
  if(![W,L,H].every(Number.isFinite)||W<60||L<60||H<60||W>1200||L>1200||H>600)return no('أدخل عرضًا وطولًا بين ٦٠ و١٢٠٠ سم وارتفاعًا بين ٦٠ و٦٠٠ سم.');
  if(r.architecture==null)return {ok:true,reason:'',room:{...r}};
  if(!plain(r.architecture))return no('تعريف شكل الغرفة غير صالح.');
  const t=r.architecture.wallThickness??20;if(!Number.isFinite(t)||t<1||t>100)return no('سمك الجدار بين ١ و١٠٠ سم.');
  const cut=r.architecture.cut,architecture={wallThickness:t};
  if(r.architecture.outline!=null){
    if(cut!=null)return no('اختر مسقط الرؤوس أو القالب ذي الردّة.');
    const v=validateMeasuredOutline(r.architecture.outline,W,L);if(!v.ok)return no(v.reason);architecture.outline=v.outline;
  }
  if(cut!=null){
    if(!plain(cut)||!['notch','chamfer','taper'].includes(cut.kind)||!architectureCorners.includes(cut.corner))return no('اختر شكل الركن واتجاهه من القائمة.');
    if(!Number.isFinite(cut.width)||cut.width<.1-E||cut.width>W-.1+E)return no('يجب أن يبقى جزء من عرض الجدار بعد طرح مقاس الركن.');
    if(cut.kind!=='taper'&&(!Number.isFinite(cut.depth)||cut.depth<.1-E||cut.depth>L-.1+E))return no('أدخل عمقًا للركن يترك جزءًا من طول الجدار.');
    architecture.cut={kind:cut.kind,corner:cut.corner,width:cut.width,depth:cut.kind==='taper'?L:cut.depth};
  }
  return {ok:true,reason:'',room:{...r,architecture}};
}
function signature(W,L,H,c,t){return [W,L,H,t,c?.kind,c?.corner,c?.width,c?.depth].join('|');}
const shapes=new Map();
export function roomArchitecture(input){
  const r=measuredKitchenRoom(input),W=r.width,L=r.length,H=r.height,checked=validateKitchenRoomArchitecture(r);
  const c=checked.ok?checked.room.architecture?.cut:null,t=checked.room?.architecture?.wallThickness??20,outline=checked.room?.architecture?.outline,key=signature(W,L,H,c,t)+(outline?'|'+JSON.stringify(outline.vertices):'');
  if(shapes.has(key))return shapes.get(key);
  const old=[P(0,0),P(W,0),P(W,L),P(0,L)],idx=c?architectureCorners.indexOf(c.corner):-1;
  const nodes=old.map(p=>({a:p,b:p,inner:null})),walls=[],excluded=[];
  if(c){
    const C=old[idx],prev=old[(idx+3)%4],next=old[(idx+1)%4],v=nodes[idx];
    const clip=neighbor=>{const dir=unit(sub(neighbor,C));return add(C,scale(dir,dir.x?c.width:c.depth));};
    const A=clip(prev),B=clip(next),inner=sub(add(A,B),C);
    if(c.kind==='taper'){
      const shifted=P(C.x===0?c.width:W-c.width,C.z);v.a=v.b=shifted;
      excluded.push([C,shifted,P(C.x,C.z===0?L:0)]);
    }else{
      v.a=A;v.b=B;v.inner=c.kind==='notch'?inner:null;
      excluded.push(v.inner?[C,A,inner,B]:[C,A,B]);
    }
  }
  function edge(id,a,b,orig=null){
    const tangent=unit(sub(b,a)),inward=P(-tangent.z,tangent.x),len=length(sub(b,a));
    const start=orig?dot(sub(a,orig),tangent):0,origin=orig||a,end=start+len;
    walls.push({id,label:architectureWallLabel(id),a,b,start,end,uMin:start,uMax:end,length:len,origin,tangent,inward});
  }
  if(outline){
    const ps=outline.vertices;for(let i=0;i<ps.length;i++)edge(ps[i].id,ps[i],ps[(i+1)%ps.length]);
    excluded.push(...excludedOutlinePieces(ps,L));
  }else for(let i=0;i<4;i++){
    const n=nodes[i];
    if(i===idx&&c.kind!=='taper'){
      const prefix='return-'+c.corner+'-';
      if(n.inner){const suffix=(p,q)=>Math.abs(p.x-q.x)>E?'x':'z';edge(prefix+suffix(n.a,n.inner),n.a,n.inner);edge(prefix+suffix(n.inner,n.b),n.inner,n.b);}
      else edge(prefix+'diagonal',n.a,n.b);
    }
    const a=n.b,b=nodes[(i+1)%4].a,ref=old[i];
    const card=Math.abs(a.x-b.x)<E||Math.abs(a.z-b.z)<E;
    edge(cardinal[i],a,b,card?ref:null);
  }
  const polygon=walls.map(w=>w.a),area=Math.abs(polygon.reduce((s,q,i)=>s+q.x*polygon[(i+1)%polygon.length].z-q.z*polygon[(i+1)%polygon.length].x,0))/2;
  const arch={width:W,length:L,height:H,wallThickness:t,cut:c||null,...(outline?{measured:true}:{}),polygon,walls,excluded,area,key,
    minX:0,minZ:0,maxX:W,maxZ:L};
  if(shapes.size>100)shapes.delete(shapes.keys().next().value);shapes.set(key,arch);return arch;
}
export function architectureWall(input,id){return roomArchitecture(input).walls.find(w=>w.id===id)||null;}
export function architectureContains(input,p){
  if(!p||![p.x,p.z].every(Number.isFinite))return false;
  const a=roomArchitecture(input);if(p.x< -E||p.x>a.width+E||p.z< -E||p.z>a.length+E)return false;
  let inside=false;
  for(const {a:b,b:c} of a.walls){
    if(Math.abs(turn(b,c,p))<E*Math.max(1,length(sub(c,b)))&&dot(sub(p,b),sub(p,c))<=E)return true;
    if((b.z>p.z)!==(c.z>p.z)&&p.x<(c.x-b.x)*(p.z-b.z)/(c.z-b.z)+b.x)inside=!inside;
  }
  return inside;
}
export function architectureWallPoint(input,id,u,d=0){
  const w=architectureWall(input,id);return w?P(w.origin.x+w.tangent.x*u+w.inward.x*d,w.origin.z+w.tangent.z*u+w.inward.z*d):null;
}
export function architectureWallLocal(input,id,p){
  const w=architectureWall(input,id);if(!w||!p)return null;const v=sub(p,w.origin);return {u:dot(v,w.tangent),d:dot(v,w.inward)};
}

// Convex floor object: checking corners alone can miss a diagonal crossing
// the corner of a concave room. Touching a measured face is allowed.
export function architectureContainsPolygon(input,polygon){
  if(!Array.isArray(polygon)||polygon.length<3||!polygon.every(p=>architectureContains(input,p)))return false;
  return !roomArchitecture(input).excluded.some(missing=>convexIntersection(polygon,missing).length);
}
export function architectureContainsDisc(input,p,radius){
  if(!Number.isFinite(radius)||radius<0||!architectureContains(input,p))return false;
  for(const wall of roomArchitecture(input).walls){
    const d=sub(p,wall.a),u=Math.min(wall.length,Math.max(0,dot(d,wall.tangent)));
    const nearest=add(wall.a,scale(wall.tangent,u));
    if(length(sub(p,nearest))+E<radius)return false;
  }
  return true;
}
