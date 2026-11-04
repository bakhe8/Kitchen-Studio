// Closed, physical placement only. An extended drawer or opened door is a
// simulation result and NEVER a reason to prevent placing its owner.
import {convexIntersection,polygonArea,polygonBounds} from './kitchen-oriented.js';

import {roomArchitecture,architectureWall,architectureWallPoint,architectureWallLabels as wallName} from './kitchen-architecture.js';

const eps=1e-7,area=p=>Math.abs(polygonArea(p));
const faceName={left:'الحد الأيسر للغرفة',right:'الحد الأيمن للغرفة',back:'الجدار الخلفي',front:'الجدار الأمامي',floor:'الأرضية',ceiling:'السقف'};
const opening=o=>o.kind==='door'||o.kind==='window';
const structure=o=>['column','shaft','heater','beam'].includes(o.kind),service=o=>!opening(o)&&!structure(o);
function name(o){
  return o.label??(o.tier==='upper'?'صف علوي':o.placement==='free'?'جزيرة':'صف أرضي');
}
const rank={'door-swing':3.5,'opening-opening':0,'opening-service':1,'feature-feature':2,'body-feature':3,'top-feature':4,'body-body':5,'top-body':6,'top-top':7,'run-overlap':8,'outside-room':9,'wall-span':-1};
function explanation(type,a,b){
  const first='«'+name(a)+'»',second=b?'«'+name(b)+'»':'';
  switch(type){
    case 'opening-opening':{
      const pair=a.kind!==b.kind?'فتحتا الباب والنافذة':a.kind==='window'?'فتحتا النافذتين':'فتحتا البابين';
      return 'تتداخل '+pair+' على '+wallName[a.wall]+'. غيّر الموضع أو الارتفاع.';
    }
    case 'opening-service':return 'موضع '+second+' داخل فتحة '+(a.kind==='window'?'النافذة':'الباب')+'. انقل التوصيلة إلى جزء مصمت.';
    case 'door-swing':return 'يعوق '+second+' حركة '+(a.kind==='window'?'الشباك':'الباب')+' على '+wallName[a.wall]+'. راجع موقع الضلفة ومجال حركتها.';
    case 'feature-feature':return 'يتداخل '+first+' مع '+second+' عند هذا الارتفاع.';
    case 'run-overlap':return 'يتقاطع امتدادان على الارتفاع نفسه. غيّر موضع الصف.';
    case 'body-feature':case 'top-feature':
      if(opening(b))return 'يحجب '+first+' فتحة '+(b.kind==='window'?'النافذة':'الباب')+'. غيّر الموضع أو الارتفاع.';
      return 'يصطدم '+first+' بـ'+second+' عند هذا الارتفاع.';
    default:return 'يتداخل '+first+' مع '+second+' عند هذا الارتفاع.';
  }
}
const seg=(a,b)=>({bottom:Math.max(a.bottom,b.bottom),height:Math.min(a.bottom+a.height,b.bottom+b.height)-Math.max(a.bottom,b.bottom)});
const overlapRect=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>eps&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>eps;
const keyOf=o=>(o.role||'item')+':'+o.id;
const rectpoly=(x,z,r,b)=>[{x,z},{x:r,z},{x:r,z:b},{x,z:b}];

// Both a drain cover and its measured access margin must be reachable from
// above a base run or island. Water supplies are service points, not covers.
export function floorAccessEnvelopes(room){
  return (room.sitePoints||[]).filter(p=>p.kind==='floor-drain'||p.kind==='floor-cleanout').map(p=>{
    const half=p.size/2+(p.accessMargin||0),polygon=rectpoly(p.x-half,p.z-half,p.x+half,p.z+half);
    return {id:p.id,role:'floor-service-access',kind:'column',label:p.kind==='floor-drain'?'غطاء البلاعة وحيّز الوصول':'فتحة التسليك وحيّز الوصول',polygon,rect:polygonBounds(polygon),bottom:0,height:room.height};
  });
}
// Only a surveyed, explicitly inward room door reserves its quarter turn.
// A door left unspecified in an old design is not automatically a reservation.
// Same jamb datum, leaf radius and handedness as the plan symbol. The chord
// sagitta is bounded by 0.005 cm (0.05 mm), including the widest allowed door.
export function inwardDoorSectors(g){
  const out=[];
  for(const door of g.features){
    if(!opening(door))continue;
    if(door.swing==='sliding'&&['before','after'].includes(door.parking)){
      if(!door.leafWidth||!door.parkDepth)continue;
      const from=door.parking==='before'?door.u-door.leafWidth:door.u+door.width;
      const polygon=[[from,0],[from+door.leafWidth,0],[from+door.leafWidth,door.parkDepth],[from,door.parkDepth]].map(([u,d])=>architectureWallPoint(g.room,door.wall,u,d));
      if(polygon.every(Boolean))out.push({...door,role:'sliding-leaf-parking',polygon,rect:polygonBounds(polygon)});
      continue;
    }
    if(door.swing!=='in')continue;
    const wall=architectureWall(g.room,door.wall);if(!wall)continue;
    const R=door.leafWidth??door.width,sign=door.hinge==='right'?-1:1,hingeU=door.u+(sign<0?door.width:0)+sign*(door.hingeInset??0),
      hinge=architectureWallPoint(g.room,door.wall,hingeU,0),maxAngle=2*Math.acos(1-Math.min(.005,R)/R),
      steps=Math.max(2,Math.ceil((Math.PI/2)/maxAngle)),polygon=[hinge];
    for(let i=0;i<=steps;i++){
      const a=i/steps*Math.PI/2,t=i===steps?0:sign*R*Math.cos(a),d=i===0?0:R*Math.sin(a);
      polygon.push({x:hinge.x+wall.tangent.x*t+wall.inward.x*d,z:hinge.z+wall.tangent.z*t+wall.inward.z*d});
    }
    out.push({...door,role:'room-door-swing',polygon,rect:polygonBounds(polygon)});
  }
  return out;
}

// Subdivide joined surfaces by their real supports. A separate unit remains
// the same support when a slab is renamed, lengthened, split, or joined.
// Subtract each hosted cutout in local u/depth; its orientation survives.
function panels(g){
  const tops=[];
  for(const u of g.units){
    if(u.tier!=='base'||u.supportsWorktop===false)continue;
    const [a,b,,d]=u.polygon,point=(h,t)=>({x:a.x+(b.x-a.x)*h/u.width+(d.x-a.x)*t/u.depth,z:a.z+(b.z-a.z)*h/u.width+(d.z-a.z)*t/u.depth});
    const top={...u,role:'slab',label:'سطح '+u.label,bottom:u.bottom+u.height,height:4,pieces:[]};
    function part(lo,hi,back,front){
      if(hi-lo<=eps||front-back<=eps)return;
      top.pieces.push([point(lo,back),point(hi,back),point(hi,front),point(lo,front)]);
    }
    const hole=u.cutout;
    if(hole){const l=hole.u-u.u,r=l+hole.width,back=hole.offset,front=back+hole.depth;
      part(0,l,0,u.depth);part(r,u.width,0,u.depth);part(l,r,0,back);part(l,r,front,u.depth);
    }else top.pieces.push(u.polygon);
    tops.push(top);
  }
  return tops;
}
// One entry per distinct pair, so 256 cabinets stacked in a row produced 65,280 of them (about 230 MB once the server re-checked a release).
// A few hundred already say "this layout cannot be built"; the rest only add weight.
export const CONFLICT_LIMIT=400;
export function closedPlacementConflicts(g){
  const hits=new Map(),tops=panels(g),architecture=g.architecture??roomArchitecture(g.room);
  let overflow=0;
  const floorAccess=floorAccessEnvelopes(g.room);
  function add(type,a,b,pieces,heightRange,label=null,suffix='',measure=null){
    if(!pieces.length||heightRange.height<=eps)return;
    const stableKey=type+'|'+[keyOf(a),...(b?[keyOf(b)]:[])].sort().join('|')+(suffix?'|'+suffix:'');
    const score=measure??pieces.reduce((s,p)=>s+area(p)*heightRange.height,0);if(score<=eps)return;
    const ids=b?[a.id,b.id]:[a.id],patches=pieces.map(polygon=>({polygon,...heightRange,partIds:ids}));
    const old=hits.get(stableKey);
    if(old){old.patches.push(...patches);old.polygons.push(...pieces);old.measure+=score;old.rect=polygonBounds(old.polygons.flat());return;}
    if(hits.size>=CONFLICT_LIMIT){overflow++;return;}
    hits.set(stableKey,{id:stableKey,stableKey,type,kind:type,hard:true,ids,polygon:pieces[0],polygons:[...pieces],rect:polygonBounds(pieces.flat()),patches,
      ...heightRange,measure:score,label:label||explanation(type,a,b)});
  }
  function collide(type,a,b,wallArea=false){
    const y=seg(a,b);if(y.height<=eps||!overlapRect(a.rect,b.rect))return;
    const pieces=[];
    for(const pa of a.pieces??[a.polygon])for(const pb of b.pieces??[b.polygon]){
      const p=convexIntersection(pa,pb);if(p.length)pieces.push(p);
    }
    // Same-wall openings occupy wall AREA; changing decorative frame depth
    // cannot make an opening-in-opening violation better or worse.
    const measure=wallArea?(Math.min(a.u+a.width,b.u+b.width)-Math.max(a.u,b.u))*y.height:null;
    add(type,a,b,pieces,y,null,'',measure);
  }
  for(let i=0;i<g.features.length;i++)for(let j=i+1;j<g.features.length;j++){
    const a=g.features[i],b=g.features[j];
    if(a.wall===b.wall&&opening(a)&&opening(b))collide('opening-opening',a,b,true);
    else if(a.wall===b.wall&&((opening(a)&&service(b))||(opening(b)&&service(a))))collide('opening-service',opening(a)?a:b,opening(a)?b:a,true);
    else if(structure(a)||structure(b))collide('feature-feature',a,b);
  }
  const solidFeatures=g.features.filter(f=>!service(f)),bodies=g.units.flatMap(u=>u.bodyParts??[u]);
  for(const unit of g.units.filter(u=>u.tier==='base'))for(const cover of floorAccess)collide('body-feature',unit,cover);
  for(let i=0;i<bodies.length;i++){
    const a=bodies[i];for(let j=i+1;j<bodies.length;j++)if(a.id!==bodies[j].id)collide('body-body',a,bodies[j]);
    for(const f of solidFeatures)collide('body-feature',a,f);
  }
  for(let i=0;i<tops.length;i++){
    const top=tops[i];
    for(const f of solidFeatures)collide('top-feature',top,f);
    for(const u of bodies)if(top.id!==u.id)collide('top-body',top,u);
    for(let j=i+1;j<tops.length;j++)collide('top-top',top,tops[j]);
  }
  for(const swing of inwardDoorSectors(g)){
    for(const solid of [...bodies,...tops,...g.features.filter(structure)])collide('door-swing',swing,solid);
  }
  // A run reserves room for other runs of overlapping height; its EMPTY
  // range is not a physical blocking body in front of a window or column.
  for(let i=0;i<g.runs.length;i++)for(let j=i+1;j<g.runs.length;j++)collide('run-overlap',g.runs[i],g.runs[j]);
  // Retain the pre-cut datum for the straight walls. Material cannot be
  // mounted on an imaginary continuation even if its front lies over floor.
  // On a plain rectangle the original outside-room diagnostics suffice.
  if(architecture.cut||architecture.measured)for(const o of [...g.runs,...g.features]){
    if(!o.wall)continue;
    const wall=architectureWall(g.room,o.wall);if(!wall)continue;
    const start=o.u??o.start,end=o.end??(o.u+o.width);
    for(const [a,b,which] of [[start,Math.min(end,wall.start),'start'],[Math.max(start,wall.end),end,'end']]){
      if(b-a<=eps)continue;
      const points=[[a,0],[b,0],[b,o.depth],[a,o.depth]].map(([u,d])=>architectureWallPoint(g.room,o.wall,u,d));
      add('wall-span',o,null,[points],{bottom:o.bottom,height:o.height},'يمتد «'+name(o)+'» خارج الجزء المبني من '+wall.label+'. غيّر موضعه أو طوله.',o.wall+':'+which,(b-a)*o.height);
    }
  }
  for(const o of [...g.runs,...bodies,...g.features,...tops]){
    const q=o.rect,l=q.x,r=l+q.w,t=q.z,b=t+q.d,W=g.room.width,A=g.room.length,H=g.room.height,p=o.pieces??[o.polygon];
    const bound=(face,poly,y)=>add('outside-room',o,null,poly,y,'يتجاوز «'+name(o)+'» '+faceName[face]+'.',face);
    const side=(face,poly)=>bound(face,p.map(x=>convexIntersection(x,poly)).filter(x=>x.length),{bottom:o.bottom,height:o.height});
    if(l< -eps)side('left',rectpoly(l-1,t-1,0,b+1));if(r>W+eps)side('right',rectpoly(W,t-1,r+1,b+1));
    if(t< -eps)side('back',rectpoly(l-1,t-1,r+1,0));if(b>A+eps)side('front',rectpoly(l-1,A,r+1,b+1));
    for(const cut of architecture.excluded){
      const pieces=p.map(x=>convexIntersection(x,cut)).filter(x=>x.length);
      add('outside-room',o,null,pieces,{bottom:o.bottom,height:o.height},'يدخل «'+name(o)+'» في الجزء المستبعد من مساحة الغرفة.','cut:'+(architecture.cut?.corner??'perimeter'));
    }
    if(o.bottom< -eps)bound('floor',p,{bottom:o.bottom,height:Math.min(-o.bottom,o.height)});
    if(o.bottom+o.height>H+eps){const floor=Math.max(H,o.bottom);bound('ceiling',p,{bottom:floor,height:o.bottom+o.height-floor});}
  }
  const list=[...hits.values()].sort((a,b)=>rank[a.type]-rank[b.type]);
  Object.defineProperty(list,'omitted',{value:overflow}); // reports dropped after the limit; not enumerable, so the list stays an ordinary array for every caller and comparison
  return list;
}

/** Exact one-dimensional configuration space for translating one NEW unit on
 * its run. Clip each obstacle to the moving piece's depth strip before
 * projecting onto u: projecting an entire rotated bounding box would hide
 * real available slots. Endpoints are allowed (mere touching).
 */
export function fittingStarts(g,run,prototype,toLocal){
  let lo=run.start,hi=run.end-prototype.width;
  const architecture=g.architecture??roomArchitecture(g.room);
  if(run.wall){const wall=architectureWall(g.room,run.wall);if(!wall)return [];lo=Math.max(lo,wall.start);hi=Math.min(hi,wall.end-prototype.width);}
  if(hi<lo-eps)return [];
  const top=panels({units:[prototype]})[0],all=[...(prototype.bodyParts??[prototype]),...(top?[top]:[])];
  if(all.some(e=>e.bottom< -eps||e.bottom+e.height>g.room.height+eps))return [];
  const a=prototype.polygon[0],b=prototype.polygon[1],ux=(b.x-a.x)/prototype.width,uz=(b.z-a.z)/prototype.width;
  function constrain(value,rate,max){
    if(Math.abs(rate)<1e-12){if(value< -eps||value>max+eps){lo=1;hi=0;}return;}
    const t0=prototype.u-value/rate,t1=prototype.u+(max-value)/rate;
    lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
  }
  for(const p of prototype.polygon){constrain(p.x,ux,g.room.width);constrain(p.z,uz,g.room.length);}
  if(hi<lo-eps)return [];
  let ranges=[[lo,Math.max(lo,hi)]];
  function subtract(left,right){
    const next=[];
    for(const [s,e] of ranges){
      if(right<=s+eps||left>=e-eps){next.push([s,e]);continue;}
      if(left>=s-eps)next.push([s,Math.max(s,Math.min(left,e))]);
      if(right<=e+eps)next.push([Math.min(e,Math.max(right,s)),e]);
    }
    ranges=next;
  }
  const local=p=>{const q=toLocal(p);return {x:q.u,z:q.d};};
  for(const o of [...g.units.flatMap(u=>u.bodyParts??[u]),...g.features.filter(f=>!service(f)),...panels(g),...inwardDoorSectors(g),...(run.tier==='base'?floorAccessEnvelopes(g.room):[]),...architecture.excluded.map(polygon=>({polygon,bottom:0,height:g.room.height}))]){
    const relevant=all.filter(v=>seg(v,o).height>eps);if(!relevant.length)continue;
    const obst=(o.pieces??[o.polygon]).map(poly=>poly.map(local));
    for(const v of relevant)for(const block of v.pieces??[v.polygon]){
      const B=polygonBounds(block.map(local));
      const leftOffset=B.x-prototype.u,rightOffset=leftOffset+B.w;
      for(const p of obst){
        const P=polygonBounds(p);
        if(Math.min(P.z+P.d,B.z+B.d)-Math.max(P.z,B.z)<=eps)continue;
        const partial=convexIntersection(p,rectpoly(P.x-1,B.z,P.x+P.w+1,B.z+B.d));if(!partial.length)continue;
        const m=polygonBounds(partial);subtract(m.x-rightOffset,m.x+m.w-leftOffset);
        if(!ranges.length)return [];
      }
    }
  }
  return ranges.map(([start,end])=>({start,end,u:start}));
}
