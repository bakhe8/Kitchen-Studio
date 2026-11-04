// Convex polygons in the physical x,z floor plane (cm). Bounds are only
// used for broad-phase rejection or drawing a label, never as an oriented hit.
const EPS=1e-8;
const turn=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
export const polygonArea=p=>p.length<3?0:p.reduce((s,b,i)=>s+turn(p[0],b,p[(i+1)%p.length]),0)/2;
export function polygonBounds(poly) {
  if(!poly?.length)return null;
  let x=Infinity,z=Infinity,r=-Infinity,b=-Infinity;
  for(const p of poly){x=Math.min(p.x,x);z=Math.min(p.z,z);r=Math.max(p.x,r);b=Math.max(p.z,b);}
  return {x,z,w:r-x,d:b-z};
}
function clean(poly){
  const result=[],near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<EPS;
  for(const p of poly)if(!result.length||!near(result.at(-1),p))result.push(p);
  if(result.length>1&&near(result[0],result.at(-1)))result.pop();
  return result.length>=3&&Math.abs(polygonArea(result))>EPS?result:[];
}
function clip(poly,distance) {
  if(!poly.length)return [];
  const out=[];let prev=poly.at(-1),a=distance(prev);
  for(const p of poly){const b=distance(p),old=a>=0,fresh=b>=0;
    if(old!==fresh){const t=a/(a-b);out.push({x:prev.x+t*(p.x-prev.x),z:prev.z+t*(p.z-prev.z)});}
    if(fresh)out.push(p);
    prev=p;a=b;
  }
  return clean(out);
}
export function convexIntersection(a,b){
  if(!a?.length||!b?.length)return [];
  const A=polygonBounds(a),B=polygonBounds(b);
  if(Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x)<=EPS||
    Math.min(A.z+A.d,B.z+B.d)-Math.max(A.z,B.z)<=EPS)return [];
  const sign=Math.sign(polygonArea(b));if(!sign)return [];
  let poly=a;
  for(let i=0;i<b.length&&poly.length;i++){const p=b[i],q=b[(i+1)%b.length];poly=clip(poly,r=>sign*turn(p,q,r));}
  return poly;
}
// Split a convex footprint at the four boundaries without double counting
// protruding corners. More than one disjoint exterior patch can exist.
export function outsidePieces(poly,room){
  const pieces=[];let inside=poly;
  for(const side of [p=>p.x,p=>room.width-p.x,p=>p.z,p=>room.length-p.z]){
    if(!inside.length)break;const outside=clip(inside,p=>-side(p));if(outside.length)pieces.push(outside);
    inside=clip(inside,side);
  }
  return pieces.sort((a,b)=>Math.abs(polygonArea(b))-Math.abs(polygonArea(a)));
}
