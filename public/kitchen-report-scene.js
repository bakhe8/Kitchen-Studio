import {scenePlan} from './kitchen-project.js';
import {kitchenRunPoint} from './kitchen-model.js';
import {renderKitchenRoom} from './kitchen-render.js';

const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Keep the architecture at its measured coordinates, including the returns
// of openings. Only fitted units and corner fittings are scoped to a proposal.
function sceneScope(doc,wallIds){
 if(wallIds==null)return doc;
 const selected=new Set(wallIds),{room,kitchen}=doc;
 const runs=kitchen.runs.filter(r=>r.wall&&selected.has(r.wall)),runIds=new Set(runs.map(r=>r.id));
 const units=kitchen.units.filter(u=>runIds.has(u.runId));
 const workshop=room.workshop&&{...room.workshop};
 if(workshop?.corners)workshop.corners=Object.fromEntries(Object.entries(workshop.corners).filter(([,c])=>selected.has(c.a)||selected.has(c.b)));
 if(workshop?.options)workshop.options=Object.fromEntries(Object.entries(workshop.options).filter(([wall])=>selected.has(wall)));
 return {room:workshop?{...room,workshop}:room,kitchen:{...kitchen,runs,units}};
}

// Look towards the fronts rather than the backs of the units. The same
// wall normal is also valid for an angled island or a non-rectangular room.
function camera(room,kitchen){
 const widths=new Map();
 for(const u of kitchen.units)widths.set(u.runId,(widths.get(u.runId)||0)+u.width);
 const normals=[];
 for(const run of kitchen.runs){
  if(!widths.has(run.id))continue;
  const a=kitchenRunPoint(room,run,0,0),b=kitchenRunPoint(room,run,0,1);
  if(a&&b)normals.push({x:b.x-a.x,z:b.z-a.z,w:widths.get(run.id)});
 }
 if(!normals.length)return {yaw:28,pitch:24};
 normals.sort((a,b)=>b.w-a.w);
 const first=normals[0],facing=Math.atan2(first.x,first.z);
 if(normals.every(n=>n.x*first.x+n.z*first.z>.99))return {yaw:facing*180/Math.PI+17,pitch:15};
 let best=0,yaw=facing;
 for(let i=0;i<36;i++){
  const angle=facing+i*Math.PI/18,x=Math.sin(angle),z=Math.cos(angle);
  const score=normals.reduce((sum,n)=>sum+n.w*Math.max(0,n.x*x+n.z*z),0);
  if(score>best+.001){best=score;yaw=angle;}
 }
 return {yaw:yaw*180/Math.PI,pitch:25};
}

function framing(scene){
 const bounds={l:Infinity,t:Infinity,r:-Infinity,b:-Infinity};
 function include(v){
  bounds.l=Math.min(bounds.l,v.x0);bounds.t=Math.min(bounds.t,v.y0);
  bounds.r=Math.max(bounds.r,v.x1);bounds.b=Math.max(bounds.b,v.y1);
 }
 for(const v of scene.editOccluders)if(['module','corner','worktop'].includes(v.f.part))include(v);
 if(!Number.isFinite(bounds.l))return null;
 const span=bounds.r-bounds.l,occupied=[bounds.l-span*.07,bounds.r+span*.07];
 // Keep windows above the work surface and nearby door frames in view.
 for(const v of scene.editOccluders){
  if(v.f.opening&&v.x0>=occupied[0]&&v.x1<=occupied[1])include(v);
 }
 const w=bounds.r-bounds.l,h=bounds.b-bounds.t,padX=Math.max(w*.055,12),padY=Math.max(h*.075,12);
 return [bounds.l-padX,bounds.t-padY,w+padX*2,h+padY*2].map(n=>Number(n.toFixed(2))).join(' ');
}

// The editor repeats its hit metadata and paint on every facet. Store shared
// paint once inside the exported image and keep facets in their painter order.
function printFaces(html){
 const paints=new Map(),rules=[];
 const art=html.replace(/\sdata-[\w-]+="[^"]*"/g,'').replace(/ pointer-events="none"/g,'')
  .replace(/<polygon\s+points="([^"]+)" fill="([^"]+)" stroke="([^"]+)" stroke-width="([^"]+)" stroke-linejoin="round"\/>/g,(_,points,fill,stroke,width)=>{
   const key=fill+'|'+stroke+'|'+width;
   if(!paints.has(key)){
    const name='cr-ink-'+paints.size;paints.set(key,name);
    rules.push('.cr-scene .'+name+'{fill:'+fill+';stroke:'+stroke+';stroke-width:'+width+';stroke-linejoin:round}');
   }
   // Two decimal places in projected centimetres are ample for the illustration.
   const coordinates=points.replace(/-?\d+\.\d{3,}/g,v=>String(Number(Number(v).toFixed(2))));
   return '<polygon class="'+paints.get(key)+'" points="'+coordinates+'"/>';
  });
 return '<style>'+rules.join('')+'</style>'+art;
}

export function customerSceneOverview(doc,{wallIds=null,label='منظور مجسّم للتصميم'}={}){
 const {room,kitchen}=sceneScope(doc,wallIds);
 if(!kitchen.units.length&&!Object.keys(room.workshop?.corners||{}).length)return '';
 const plan=scenePlan(room,kitchen);
 if(wallIds&&plan.room.fitout){
  for(const kind of ['stone','sills'])if(plan.room.fitout[kind])plan.room.fitout[kind]=plan.room.fitout[kind].filter(s=>wallIds.includes(s.wall));
 }
 const scene=renderKitchenRoom(plan,{kitchen,...camera(room,kitchen),mode:'cutaway',showConflicts:false,prefix:'cr-scene'});
 const frame=framing(scene);if(!frame)return '';
 // The display SVG reuses the painter's order, lighting, fitted material and
 // opening geometry. Omit editor picking attributes and internal part codes.
 const art=printFaces(scene.html);
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" class="cr-scene" data-kitchen-3d="" aria-label="'+escape(label)+'" viewBox="'+frame+'" preserveAspectRatio="xMidYMid meet"><title>'+escape(label)+'</title>'+art+'</svg>';
}
