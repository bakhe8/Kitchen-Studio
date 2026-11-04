// Build a portable triangle scene from the current design, in physical centimetres.
// No projection, light baking or SVG crosses this API.
import {getKitchenPhotoMesh} from './kitchen-render.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
const arr=p=>[p.x,p.y,p.z],V=(x,y,z)=>({x,y,z}),unique=a=>[...new Set(a)].sort((l,r)=>l-r);
const srgb=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const hex=h=>[1,3,5].map(i=>srgb(parseInt(h.slice(i,i+2),16)/255));
const facePaint=new Set(['side','top','door-front','open-hinged-door','open-hinged-panel','recessed-panel','island-rear-finish','open-drawer-front','drawer-front','oven-door','dishwasher-front','front-rail','front-flute','refrigerator-door','freezer-door','pullout-front']);
const makeKey=m=>[m.type,m.color,m.asset,m.rough,m.metal,m.wall,m.cladding,m.tileWidth,m.tileHeight,m.backsplash,m.frosted,m.glazing,m.adjacent,m.tile,...m.U,...m.V,m.photo].join(':');
function surface(f){
 const facade=facePaint.has(f.tag)||/finish|flute|facade|fridge-door|freezer-door|pullout-front|door-panel|front-rail|equipment-(cabinet-front|frame)|hood-(canopy|chimney)|open-shelf-(board|roof|floor|local-board)|bottle-grid-(post|shelf)|-left-side|-right-side/.test(f.tag),finished=f.part==='worktop'||facade;
 const name=f.part==='worktop'?f.worktopFinish:facade?f.frontFinish:null, prop=(f.part==='worktop'?kitchenWorktopFinishes:kitchenFrontFinishes)[name];
 let type=prop?.texture||'paint';
 if(!prop){if(f.part==='worktop')type='stone';else if(/oven-glass|tower-oven-glazing|tower-open-glass|hob-glass|control-strip|screen-glass|microwave-glass|oven-window/.test(f.tag))type='glass';else if(/sink-|faucet|tap|mixer|pull|handle|knob|hinge|stainless|oven-control|hood-|rack-wire|steel|dishwasher-front|fridge-door|freezer-door|drain|dial|latch|burner/.test(f.tag))type='metal';else if(/interior-|drawer-side|drawer-bottom|bottle-|door-leaf|door-panel/.test(f.tag)||facade&&f.kind==='tall')type='wood';}
 const N=f.N||{x:0,y:0,z:1},T=f.basis?.T||V(1,0,0),D=f.basis?.D||V(0,0,1),vert=Math.abs(N.y)<.6;
 const U=vert&&Math.abs(T.x*N.x+T.z*N.z)>.65?arr(D):arr(T), B=vert?[0,1,0]:arr(D);
 return {type,color:f.color||'#c4baab',rough:prop?.roughness??({metal:.23,stone:.32,glass:.105,wood:.46}[type]||.65),metal:prop?.metalness??(type==='metal'?.77:.017),asset:finished?name||type:type,tile:prop?.patternCm||(type==='wood'?32:50),U,V:B,wall:f.part==='fixture'&&!['column','shaft'].includes(f.kind)?f.wall:null};
}
export function buildPhotoScene(plan,kitchen){
 const {faces,geometry:g,room:R,building}=getKitchenPhotoMesh(plan,kitchen),{width:W,height:H,length:L}=R;
 const vertices=[],ids=[],materials=[],catalog=new Map(),windows=building.windows; const statistics={sourceFaces:faces.length};
 function poly(ps,m){if(ps.length<3)return;const key=makeKey(m);let id=catalog.get(key);if(id==null){id=materials.length;catalog.set(key,id);materials.push({...m,rgb:hex(m.color)});}const v=ps[0];for(let i=1;i<ps.length-1;i++){const b=ps[i],c=ps[i+1];vertices.push(v.x,v.y,v.z,b.x-v.x,b.y-v.y,b.z-v.z,c.x-v.x,c.y-v.y,c.z-v.z);ids.push(id);}}
 // The architectural mesh already contains true openings, recessed sashes,
 // thin glass, tiled floor, reveal returns, structural solids and site points.
 // Keep the hollow space empty: no bounding-box floor or shadow wall behind it.
 for(const f of faces){if(f.tag==='sky-reflection'||/pull-highlight|open-pull-highlight/.test(f.tag))continue;poly(f.points,f.mat?{...f.mat,wall:f.mat.wall??f.wall}:surface(f));}
 const bounds=g.units.map(u=>[u.rect.x,u.rect.z,u.rect.x+u.rect.w,u.rect.z+u.rect.d,u.bottom,u.bottom+u.height]);
 const extents=bounds.length?[Math.min(...bounds.map(q=>q[0])),Math.min(...bounds.map(q=>q[1])),Math.max(...bounds.map(q=>q[2])),Math.max(...bounds.map(q=>q[3])),Math.min(...bounds.map(q=>q[4])),Math.max(...bounds.map(q=>q[5]))]:[0,0,W,L,0,H*.76];
 const wallPlanes=Object.fromEntries(building.segments.map(s=>[s.id,{x:s.a.x,z:s.a.z,nx:s.inward.x,nz:s.inward.z}])),aim=g.units.reduce((v,u)=>{const wall=wallPlanes[u.wall];if(wall){v[0]+=wall.nx*u.width;v[1]+=wall.nz*u.width;}return v;},[0,0]);let suggestedYaw=Math.hypot(...aim)>1?Math.atan2(aim[0],aim[1])*180/Math.PI:26;const nearest=Math.round(suggestedYaw/90)*90;if(Math.abs(nearest-suggestedYaw)<10)suggestedYaw=nearest+(nearest>90?-18:18);if(suggestedYaw>180)suggestedYaw-=360;
 return {outline:building.outline,wallPlanes,wallThickness:building.wallThickness,suggestedYaw,hasIsland:g.runs.some(r=>r.placement==='free'),vertices:new Float32Array(vertices),ids:new Uint16Array(ids),materials,room:{width:W,height:H,length:L},extents,windows,statistics};
}
