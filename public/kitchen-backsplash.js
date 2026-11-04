import {ownKey} from './kitchen-safe-keys.js';
// Shared vertical material layout. All patch coordinates are in actual wall
// centimetres: u increases to the right when facing the wall; v is UP from
// the finished floor. Empty design runs are guides and have no backsplash.
import {roomArchitecture} from './kitchen-architecture.js';
const EPS=1e-6,cache=new WeakMap();
const sw=(label,color,type,rough,metal,asset=null)=>Object.freeze({label,color,type,rough,metal,asset});
export const backsplashFinishes=Object.freeze({
 none:sw('بدون كسوة','#ffffff','paint',.8,0),
 tile:sw('بلاط عاجي مزجّج','#eae5d6','porcelain',.23,.014),
 marble:sw('رخام فاتح','#ddd9cf','marble',.24,.018,'marble'),
 wood:sw('خشب دافئ','#b38b66','wood',.41,.01,'wood'),
 steel:sw('فولاذ مصقول','#a2aaa8','metal',.3,.78)
});
export function backsplashSettings(raw){return {finish:ownKey(backsplashFinishes,raw?.finish)?raw.finish:'tile',
 height:Number.isFinite(raw?.height)?Math.max(10,Math.min(130,raw.height)):56};}
const p4=(x,X,v,V)=>({start:x,end:X,bottom:v,top:V});
const int=(a,b,l,h)=>Math.max(a,l)<Math.min(b,h)-EPS;
const num=v=>Number(v.toFixed(4));
const path=p=>'M'+num(p.start)+' '+num(p.bottom)+'h'+num(p.end-p.start)+'v'+num(p.top-p.bottom)+'h-'+num(p.end-p.start)+'Z';
const tileColors=['#eee8d9','#e7e2d5','#ede7d8','#eae6d9','#efeadd'];
const TILE_W=15,TILE_H=7.5,GROUT=.19;
function tileIn(p,out){
 const i0=Math.floor(p.bottom/TILE_H),i1=Math.ceil(p.top/TILE_H);
 for(let i=i0;i<i1;i++){const shift=(i%2)*TILE_W/2,lo=Math.max(p.bottom,i*TILE_H+GROUT/2),hi=Math.min(p.top,(i+1)*TILE_H-GROUT/2);if(hi-lo<=EPS)continue;
  const j0=Math.floor((p.start-shift)/TILE_W),j1=Math.ceil((p.end-shift)/TILE_W);
  for(let j=j0;j<j1;j++){const u=Math.max(p.start,j*TILE_W+shift+GROUT/2),U=Math.min(p.end,(j+1)*TILE_W+shift-GROUT/2);if(U-u<=EPS)continue;
   const shade=((i*7+j*13+i*j*3)%tileColors.length+tileColors.length)%tileColors.length;
   out.push({...p4(u,U,lo,hi),color:tileColors[shade]});
  }
 }
}
export function kitchenBacksplash(plan,g){
 const {finish,height}=backsplashSettings(plan?.kitchenSurfaces?.backsplash),key=finish+'/'+height,prior=cache.get(g);
 if(prior?.key===key)return prior.value;
 const WALLS=new Set((g.architecture?.walls||roomArchitecture(g.room).walls).map(w=>w.id));
 const sides=Object.fromEntries([...WALLS].map(w=>[w,{patches:[],tiles:[]}]));
 const result={finish,height,sides,material:backsplashFinishes[finish]};
 if(finish!=='none'){
  const H=g.room.height;
  for(const top of g.worktops){
   if(!WALLS.has(top.wall))continue;
   const a=top.start,b=top.end,low=top.bottom+top.height,high=Math.min(H,low+height);
   if(b-a<=EPS||high-low<=EPS)continue;
   const uppers=g.units.filter(u=>u.tier==='upper'&&u.wall===top.wall&&int(a,b,u.u,u.u+u.width)&&u.bottom<high-EPS&&u.bottom+u.height>low+EPS);
   const holes=g.features.filter(o=>o.wall===top.wall&&['window','door'].includes(o.kind)&&int(a,b,o.u,o.u+o.width)&&int(low,high,o.bottom,o.bottom+o.height));
   const cuts=[...new Set([a,b,...[...uppers,...holes].flatMap(o=>[Math.max(a,o.u),Math.min(b,o.u+o.width)])])].sort((x,y)=>x-y);
   const patches=[],last=new Map();
   for(let i=1;i<cuts.length;i++){
    const x=cuts[i-1],X=cuts[i],mid=(x+X)/2;if(X-x<=EPS)continue;
    const spans=o=>o.u<mid&&mid<o.u+o.width,cap=Math.min(high,...uppers.filter(spans).map(u=>u.bottom));
    if(cap-low<=EPS)continue;
    const occluded=holes.filter(spans).map(o=>[Math.max(low,o.bottom),Math.min(cap,o.bottom+o.height)]).filter(([l,h])=>h-l>EPS).sort((l,r)=>l[0]-r[0]);
    function strip(l,h){if(h-l<=EPS)return;const k=l+'|'+h,prev=last.get(k);
     if(prev&&Math.abs(prev.end-x)<EPS){prev.end=X;return;}
     const part={wall:top.wall,runId:top.runId,worktopId:top.id,...p4(x,X,l,h)};patches.push(part);last.set(k,part);
    }
    let cursor=low;for(const [l,h]of occluded){strip(cursor,l);cursor=Math.max(cursor,h);}strip(cursor,cap);
   }
   const side=sides[top.wall];side.patches.push(...patches);if(finish==='tile')for(const p of patches)tileIn(p,side.tiles);
  }
 }
 cache.set(g,{key,value:result});return result;
}
const textures={
 wood:'<path d="M0 3q9-2 18 0t18 .2t14-.7M0 7q11-.8 20 0t30 .2M0 13q8 1 15 0t25 .8t10-.4" fill="none" stroke="#775a43" stroke-width=".34" opacity=".55"/>',
 marble:'<g fill="none" stroke-linejoin="round"><path d="M-4 4l12 3 11 8 8 1 9 9 18 8M14 12l1 5-6 6m23-3 4-1 10 3" stroke="#8f928a" stroke-width=".55" opacity=".65"/><path d="m4 33 9-6 4-6 11-5" stroke="#fff9eb" stroke-width=".8"/></g>',
 steel:'<path d="M0 1h24m-19 1h31M0 4h32m-28 1h16M8 6h27" fill="none" stroke="#d0d4cf" stroke-width=".17" opacity=".65"/>'
};
/** Insert BEFORE light/shadow overlays inside the wall's own affine transform;
 * the wall retains its normal hit-testing semantics. */
export function backsplashSvg(layout,wall,H,prefix){
 const side=layout.sides[wall];if(!side?.patches.length)return '';
 const ID=String(prefix||'kitchen').replace(/[^a-zA-Z0-9_-]/g,'_')+'-splash-'+wall;
 const mats=layout.material,geometry=side.patches.map(path).join('');let art='';
 if(layout.finish==='tile'){
   art='<path d="'+geometry+'" fill="#c7c5b7"/>';
   const colors=new Map();for(const t of side.tiles){if(!colors.has(t.color))colors.set(t.color,[]);colors.get(t.color).push(path(t));}
   for(const [color,paths]of colors)art+='<path d="'+paths.join('')+'" fill="'+color+'"/>';
 }else{
   const [w,h]=layout.finish==='wood'?[50,16]:layout.finish==='marble'?[50,35]:[36,7];
   art='<defs><pattern id="'+ID+'" patternUnits="userSpaceOnUse" width="'+w+'" height="'+h+'"><rect width="'+(w+.03)+'" height="'+(h+.03)+'" fill="'+mats.color+'"/>'+textures[layout.finish]+'</pattern></defs><path d="'+geometry+'" fill="url(#'+ID+')"/>';
 }
 return '<g data-k-backsplash="'+layout.finish+'" data-k-splash-wall="'+wall+'" pointer-events="none" transform="translate(0 '+num(H)+') scale(1 -1)">'+art+'</g>';
}
// Grout is a genuine narrow gap between tile faces, not a printed line on
// cabinets or glass. This layer stays attached to its wall in cutaway mode.
export function emitBacksplashQuads(layout,wall,H,emit){
 const side=layout.sides[wall];if(!side?.patches.length)return;
 const mat=layout.material;
 for(const p of side.patches)emit(p.start,H-p.top,p.end,H-p.bottom,.35,layout.finish==='tile'?{...mat,type:'plaster',color:'#c7c5b7',rough:.86,metal:0,asset:null}:mat);
 if(layout.finish==='tile')for(const t of side.tiles)emit(t.start,H-t.top,t.end,H-t.bottom,.41,{...mat,color:t.color});
}
