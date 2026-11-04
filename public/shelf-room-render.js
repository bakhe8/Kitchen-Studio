import {ownKey} from './kitchen-safe-keys.js';
// A convex room has a useful exact visibility rule: a ray from inside exits
// through a near face. Removing precisely those near faces leaves its far
// shell behind every interior object. A closed opaque shell occludes all of
// the furniture. No projected rectangle is used as a substitute for a wall.
import {getRoom,roomFaces,roomWallData,roomFaceLabels,wallLocalToRoom,roomToWallLocal} from './shelf-room-model.js';
import {renderCabinetForProjection} from './shelf-volume.js';
import {shelfDepth} from './shelf-model.js';

const E=1e-8,rad=Math.PI/180,num=v=>Number(v.toFixed(5)),point=(x,y,z)=>({x,y,z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,minus=(a,b)=>point(a.x-b.x,a.y-b.y,a.z-b.z);
const scale=(a,t)=>point(a.x*t,a.y*t,a.z*t),add=(a,b)=>point(a.x+b.x,a.y+b.y,a.z+b.z);
const clamp=(a,low,high,fallback)=>Math.max(low,Math.min(high,Number.isFinite(a)?a:fallback));
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const color={sand:['#f4e9d6','#d6c5aa'],sage:['#e8ede0','#becbb7'],stone:['#ebece9','#c8c9c3']};
const fmt=pts=>pts.map(p=>num(p.x)+','+num(p.y)).join(' ');
const normalizedYaw=v=>{const a=Number.isFinite(v)?v:32;return ((a+180)%360+360)%360-180;};
export function makeRoomProjection(plan,opts={}){
  const r=getRoom(plan),yaw=normalizedYaw(opts.yaw),pitch=clamp(opts.pitch,-85,85,24),zoom=clamp(opts.zoom,.55,2.5,1);
  const sy=Math.sin(yaw*rad),cy=Math.cos(yaw*rad),sp=Math.sin(pitch*rad),cp=Math.cos(pitch*rad);
  const u=point(cy,0,-sy),v=point(sy*sp,cp,cy*sp),eye=point(sy*cp,-sp,cy*cp),center=point(r.width/2,r.height/2,r.length/2);
  const projectPoint=p=>{const d=minus(p,center);return {x:dot(d,u),y:dot(d,v),depth:dot(d,eye)};};
  const project=(x,y,z)=>projectPoint(point(x,y,z));
  const ray=(x,y)=>({origin:add(center,add(scale(u,x),scale(v,y))),direction:eye});
  // Centred at the same physical point throughout a full revolution. Set
  // extents from the actual eight corners; zoom changes framing only.
  const w=Math.abs(u.x)*r.width+Math.abs(u.z)*r.length,h=Math.abs(v.x)*r.width+Math.abs(v.y)*r.height+Math.abs(v.z)*r.length;
  const pad=Math.max(7,Math.min(25,Math.max(w,h)*.042)),bw=(w+2*pad)/zoom,bh=(h+2*pad)/zoom;
  const bounds={x:-bw/2,y:-bh/2,w:bw,h:bh},viewBox=[bounds.x,bounds.y,bw,bh].map(num).join(' ');
  return {yaw,pitch,zoom,eye,u,v,center,project,projectPoint,ray,bounds,viewBox};
}
const photoSafe=url=>{
  if(typeof url!=='string')return '';
  if(/^data:image\/(png|jpeg|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(url))return url;
  if(url.startsWith('blob:')){try{return typeof location!=='undefined'&&new URL(url).origin===location.origin?url:'';}catch{}}
  return '';
};
const floorLike=id=>id==='floor'||id==='ceiling';
function faceSurface(plan,r,id,x,y){
  return floorLike(id)?point(x,id==='ceiling'?0:r.height,y):wallLocalToRoom(plan,id,point(x,y,0));
}
function wallProjection(plan,P,id){
  const origin=wallLocalToRoom(plan,id,point(0,0,0)),axis=['x','y','z'].map(k=>minus(wallLocalToRoom(plan,id,{x:0,y:0,z:0,[k]:1}),origin));
  const localVector=e=>point(...axis.map(n=>dot(e,n))),eye=localVector(P.eye);
  const projectPoint=p=>P.projectPoint(wallLocalToRoom(plan,id,p));
  return {yaw:P.yaw,pitch:P.pitch,eye,bounds:P.bounds,viewBox:P.viewBox,projectPoint,project:(x,y,z=0)=>projectPoint(point(x,y,z)),
    ray:(x,y)=>({origin:roomToWallLocal(plan,id,P.ray(x,y).origin),direction:eye}),localVector};
}
function projectMatrix(P,fn){
  const a=P.projectPoint(fn(0,0)),b=P.projectPoint(fn(1,0)),c=P.projectPoint(fn(0,1));
  return `matrix(${[b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y].map(num).join(' ')})`;
}
function insideFace(r,f,p){
  return p.x>=-E&&p.x<=r.width+E&&p.y>=-E&&p.y<=r.height+E&&p.z>=-E&&p.z<=r.length+E;
}
const sun=point(-.40,-.77,.50);
function shade(hex,amount){
  return '#'+[1,3,5].map(i=>Math.min(255,Math.max(0,Math.round(parseInt(hex.slice(i,i+2),16)*amount))).toString(16).padStart(2,'0')).join('');
}
function environmentDefs(prefix){
  const id=s=>prefix+'-'+s;
  return `<defs>
    <pattern id="${id('boards')}" patternUnits="userSpaceOnUse" width="108" height="38"><rect width="108.05" height="38.05" fill="#ceb992"/><rect y="19" width="108.05" height="19.05" fill="#d6c4a3"/><path d="M0 .2h108M0 19.1h108M.15 0v19M55 19v19" fill="none" stroke="#aa9473" stroke-opacity=".66" stroke-width=".54"/><g fill="none" stroke="#a88b64" stroke-width=".22" opacity=".52"><path d="M0 6c18-1.4 21 .9 39 .2s47-2 69-.8M0 11q24 1.3 43 0t65-.3M1 27q26-1.4 47 .2t58-.3M0 33c24-1.1 37 .3 57 .1s39-1.5 51-.6"/><path d="M14 10q6-1.3 14-.1q-8 .6-14 .1m53 18q8-1.5 16-.2q-7 .7-16 .2"/></g></pattern>
    <pattern id="${id('tile')}" patternUnits="userSpaceOnUse" width="60" height="60"><rect width="60.1" height="60.1" fill="#c8c9c0"/><path d="M0 60V0h60" stroke="#94988e" stroke-width=".6" fill="none"/></pattern>
    <pattern id="${id('stone')}" patternUnits="userSpaceOnUse" width="75" height="48"><rect width="75.1" height="48.1" fill="#7c8079"/><path d="M0 48V0h75m-75 24h75m-40 0v24" stroke="#a2a39b" stroke-width=".7" fill="none"/></pattern>
    <pattern id="${id('marble')}" patternUnits="userSpaceOnUse" width="80" height="80"><rect width="80.1" height="80.1" fill="#e2ded3"/><path d="M0 80V0h80m-88 57 30-21 11-1 16-14 18-4 16-15" stroke="#aaa89e" stroke-width=".55" fill="none"/></pattern>
    <pattern id="${id('roof')}" patternUnits="userSpaceOnUse" width="32" height="64"><rect width="32.05" height="64.05" fill="#a5aeaa"/><path d="M.6 0V64" stroke="#83918b" stroke-width=".85"/><path d="M1.6 0V64" stroke="#cbd1c9" stroke-width=".45"/></pattern>
    <linearGradient id="${id('cove')}" x2="0" y2="1"><stop stop-color="#584f40" stop-opacity=".22"/><stop offset="1" stop-color="#584f40" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id('corner')}" x2="1" y2="0"><stop stop-color="#5f584a" stop-opacity=".12"/><stop offset=".17" stop-color="#5f584a" stop-opacity="0"/><stop offset=".84" stop-color="#5f584a" stop-opacity="0"/><stop offset="1" stop-color="#5f584a" stop-opacity=".095"/></linearGradient>
    <filter id="${id('soft')}" x="-.3" y="-.3" width="1.65" height="1.65"><feGaussianBlur stdDeviation="2.9"/></filter>
    <filter id="${id('groundsoft')}" x="-.4" y="-.5" width="1.8" height="2"><feGaussianBlur stdDeviation="6.5"/></filter>
  </defs>`;
}
function wallArt(plan,room,f,P,prefix,opts,closed,selected,photo){
  const {id,w,h}=f,local=(u,v)=>faceSurface(plan,room,id,u,v),m=projectMatrix(P,local),ps=fmt(f.points.map(P.projectPoint));
  const walls=f.kind==='wall',N=closed?scale(f.inward,-1):f.inward;
  const t=.90+.13*Math.max(0,dot(N,sun)),paint=walls?(color[roomWallData(plan,id).color]||color.sand):null;
  const base=closed?(id==='ceiling'?'url(#'+prefix+'-roof)':id==='floor'?'#9c9a91':shade('#e0dfd2',t))
    :id==='floor'?'url(#'+prefix+'-'+({'tile':'tile','stone':'stone','marble':'marble'}[plan.kitchenSurfaces?.floor]||'boards')+')':id==='ceiling'?'#edeee6':shade(paint[0],t);
  let art=`<rect width="${w}" height="${h}" fill="${base}"/>`;
  if(closed&&walls){
    const band=Math.min(8,h*.05);
    art+=`<path d="M0 ${num(h-band)}H${w}V${h}H0Z" fill="${shade('#b6b9aa',t)}"/><path d="M0 3.5H${w}M0 ${num(h-band)}H${w}" fill="none" stroke="#b7b9a9" stroke-width=".65"/>`;
  }else if(!closed&&walls){
    if(photo)art+=`<image data-room-photo="${id}" href="${esc(photo)}" width="${w}" height="${h}" preserveAspectRatio="none" pointer-events="none"/>`;
    art+=`<rect width="${w}" height="${h}" fill="url(#${prefix}-corner)"/><rect width="${w}" height="${num(Math.min(15,h*.12))}" fill="url(#${prefix}-cove)" opacity=".47"/>`;
    if(!photo)art+=`<rect y="${num(h-4)}" width="${w}" height="4" fill="${shade(paint[0],1.045)}"/><path d="M0 ${num(h-4)}H${w}M0 ${num(h-.32)}H${w}" fill="none" stroke="${shade(paint[1],.90)}" stroke-width=".55"/>`;
    if(id===room.attachedWall&&!opts.hideCabinet){
      const c=plan.cab,d=shelfDepth(plan),off=d*.115;
      art+=`<svg width="${w}" height="${h}" overflow="hidden" pointer-events="none"><rect x="${num(c.x+off)}" y="${num(c.y+d*.15)}" width="${c.w}" height="${c.h}" fill="#413b2f" opacity=".23" filter="url(#${prefix}-soft)"/></svg>`;
    }
  }else if(!closed&&id==='ceiling'){
    art+=`<rect width="${w}" height="${h}" fill="url(#${prefix}-corner)" opacity=".58"/><rect x="2" y="2" width="${num(w-4)}" height="${num(h-4)}" fill="none" stroke="#c8cbbf" stroke-width=".8"/>`;
  }
  if(!closed&&typeof opts.surfaceOverlay==='function')art+=opts.surfaceOverlay(id,w,h)||'';
  const holes=walls&&Array.isArray(opts.wallOpenings?.[id])?opts.wallOpenings[id].filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0):[];
  if(holes.length){const mask=prefix+'-open-'+id;
    art=`<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/>${holes.map(b=>`<rect data-room-opening="${esc(b.id||'')}" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" fill="black"/>`).join('')}</mask></defs><g mask="url(#${mask})">${art}</g>`;
  }
  const rim=selected?'#33745b':closed?'#9b9f91':'#9b9480',weight=selected?1.25:closed?.60:.55;
  return `<g data-room-surface="${id}" data-room-side="${closed?'exterior':'interior'}"${selected?' data-room-selected=""':''}><title>${roomFaceLabels[id]}</title><g transform="${m}">${art}</g><polygon points="${ps}" stroke="${rim}" stroke-width="${weight}" fill="none" stroke-linejoin="round" pointer-events="none"/></g>`;
}
function hiddenMark(plan,room,selected,P){
  const f=roomFaces(plan).find(q=>q.id===selected);if(!f)return '';
  const pts=f.kind==='wall'?[f.points[3],f.points[2]]:f.points.concat(f.points[0]),u=P.projectPoint;
  let bits=`<polyline points="${fmt(pts.map(u))}" fill="none" stroke="#2f7559" stroke-width="1.6" stroke-dasharray="5 3" stroke-linecap="round"/>`;
  if(f.kind==='wall')for(const p of pts)bits+=`<line x1="${num(u(p).x)}" y1="${num(u(p).y)}" x2="${num(u({...p,y:p.y-6}).x)}" y2="${num(u({...p,y:p.y-6}).y)}" stroke="#2f7559" stroke-width="1.3"/>`;
  return `<g data-room-cut-surface="${selected}" pointer-events="none"><title>${roomFaceLabels[selected]} · محجوب في هذا المنظور</title>${bits}</g>`;
}
function photosFor(opts,id){const p=opts.photos,custom=p instanceof Map?p.get(id):p&&ownKey(p,id)?p[id]:undefined;
  return photoSafe(custom??(id===(opts.photoWall||'back')?opts.photoUrl:undefined));
}
export function renderShelfRoom(plan,opts={}){
  const room=getRoom(plan),P=opts.projection||makeRoomProjection(plan,opts),closed=opts.mode==='closed'||opts.mode==='solid',mode=closed?'closed':'cutaway';
  const selected=opts.selectedSurface||null,prefix=String(opts.prefix||'shelf-room').replace(/[^a-zA-Z0-9_-]/g,'_');
  const all=roomFaces(plan),visible=all.filter(f=>dot(f.inward,P.eye)*(closed?-1:1)>E),visibleSurfaces=visible.map(f=>f.id);
  const floor=all.find(f=>f.id==='floor'),baseShadow=P.pitch>0&&floor?`<g pointer-events="none" data-room-ground-shadow=""><polygon points="${fmt(floor.points.map(q=>P.projectPoint({...q,y:q.y+3})))}" fill="#696250" opacity=".17" filter="url(#${prefix}-groundsoft)"/></g>`:'';
  let body=visible.map(f=>wallArt(plan,room,f,P,prefix,opts,closed,f.id===selected,photosFor(opts,f.id))).join('');
  let cabinet=null,local=null;
  if(!closed&&!opts.hideCabinet){
    const wall=room.attachedWall;local=wallProjection(plan,P,wall);
    if(visibleSurfaces.includes('floor')){
      const c=plan.cab,d=shelfDepth(plan),gap=room.height-c.y-c.h;if(gap<65){
        const a=.16*Math.max(0,1-gap/65),corners=[[c.x-1,0],[c.x+c.w+1,0],[c.x+c.w+1,d+4],[c.x-1,d+4]].map(([x,z])=>P.projectPoint(wallLocalToRoom(plan,wall,point(x,room.height,z))));
        body+=`<polygon points="${fmt(corners)}" fill="#534831" opacity="${num(a)}" filter="url(#${prefix}-soft)" pointer-events="none"/>`;
      }
    }
    cabinet=renderCabinetForProjection(plan,local,{prefix:prefix+'-unit',lightDirection:local.localVector(sun)});
    body+=`<g data-room-cabinet="${esc(wall)}" data-room-cab-depth="${cabinet.depth}">${cabinet.html}</g>`;
  }
  if(!closed&&selected&&!visibleSurfaces.includes(selected))body+=hiddenMark(plan,room,selected,P);
  const html=environmentDefs(prefix)+`<g data-room-view="${mode}" data-room-attached="${esc(room.attachedWall)}">${baseShadow}${body}</g>`;
  function hitTest(x,y){if(typeof x==='object'&&x){y=x.y;x=x.x;}if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    // Supporting wall is a context for a cabinet hit, not a second cabinet.
    const material=cabinet?.hitTest(x,y);if(material)return {part:'cabinet',surface:room.attachedWall,world:wallLocalToRoom(plan,room.attachedWall,material.p),material};
    const ray=P.ray(x,y);let best=null,z=-Infinity;
    for(const f of visible){const den=dot(f.inward,ray.direction);if(Math.abs(den)<E)continue;const t=dot(f.inward,minus(f.points[0],ray.origin))/den,world=add(ray.origin,scale(ray.direction,t));if(t<=z||!insideFace(room,f,world))continue;z=t;best={part:'surface',surface:f.id,world};}
    return best;
  }
  return {html,viewBox:P.viewBox,bounds:P.bounds,projection:P,room,mode,selectedSurface:selected,visibleSurfaces,attachedWall:room.attachedWall,hitTest};
}
