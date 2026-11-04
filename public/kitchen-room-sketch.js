import {architectureWall,roomArchitecture} from './kitchen-architecture.js';
import {kitchenFeatureSpecs} from './kitchen-model.js';
import {pointKinds} from './kitchen-chain-model.js';
import {pointTypes} from './kitchen-site-survey-model.js';

const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const segment=(a,b)=>'M'+a.join(' ')+'L'+b.join(' ');
const line=(path,stroke,width)=>'<path d="'+path+'" fill="none" stroke="'+stroke+'" stroke-width="'+width+'"/>';
const hit=path=>'<path class="survey-plan-hit" d="'+path+'" fill="none" stroke="transparent" stroke-width="12" pointer-events="stroke"/>';

// Template thumbnails are illustrations. The live plan exposes the same
// geometry as stable targets for the wall reader and floor-point form.
export function surveySketch(raw,doc=null,selectedWall=null,interactive=false,selection=null){
 const a=roomArchitecture(raw),scale=Math.min(236/a.width,120/a.length);
 const width=a.width*scale,depth=a.length*scale,ox=(320-width)/2,oz=26;
 const xy=p=>[ox+p.x*scale,oz+p.z*scale];
 const shape=a.polygon.map(p=>xy(p).join(',')).join(' ');
 const group=(kind,id,title,art)=>{
  if(!interactive)return art;
  const active=selection?.kind===kind&&selection.id===id;
  return '<g class="survey-plan-item" data-plan-kind="'+kind+'" data-plan-id="'+esc(id)+'" role="button" tabindex="0" aria-label="'+esc(title)+'"'+(active?' data-current':'')+'><title>'+esc(title)+'</title>'+art+'</g>';
 };
 const walls=a.walls.map(w=>{
  const start=xy(w.a),end=xy(w.b),path=segment(start,end);
  let art='';
  if(w.id===selectedWall){
   const tip=[start[0]+(end[0]-start[0])*.72,start[1]+(end[1]-start[1])*.72];
   const k=Math.min(12,w.length*scale*.25),u=w.tangent.x*k,v=w.tangent.z*k;
   const arrow=segment([tip[0]-u+.45*v,tip[1]-v-.45*u],tip)+'L'+[tip[0]-u-.45*v,tip[1]-v+.45*u].join(' ');
   art=line(path,'#8e5627',2.5)+line(arrow,'#8e5627',2.5)+'<circle cx="'+start[0]+'" cy="'+start[1]+'" r="3.5" fill="#fff5de"/>';
  }
  return group('wall',w.id,'رفع '+w.label,art+(interactive?hit(path):''));
 }).join('');
 const features=(doc?.kitchen.features||[]).map(f=>{
  const w=architectureWall(raw,f.wall);
  if(!w||f.u<w.start-.01||f.u+f.width>w.end+.01)return '';
  const at=u=>xy({x:w.origin.x+u*w.tangent.x,z:w.origin.z+u*w.tangent.z});
  const path=segment(at(f.u),at(f.u+f.width)),[cx,cy]=at(f.u+f.width/2);
  const name=f.kind==='vent'?'فتحة تهوية الشفاط':kitchenFeatureSpecs[f.kind]?.label||f.kind;
  let art;
  if(pointKinds.has(f.kind)){
   if(!interactive)return '';
   art='<circle cx="'+cx+'" cy="'+cy+'" r="3" fill="#f2f8fa" stroke="#307788" stroke-width="1.8"/><circle cx="'+cx+'" cy="'+cy+'" r="6.5" fill="transparent"/>';
  }else{
   if(!interactive&&f.kind!=='window'&&f.kind!=='door')return '';
   art=line(path,f.kind==='window'?'#338c9b':f.kind==='door'?'#c68c4d':'#69756d',4)+(interactive?hit(path):'');
  }
  return group('feature',f.id,'تحرير '+name+' · '+w.label,art);
 }).join('');
 const points=(raw.sitePoints||[]).map(p=>{
  const [cx,cy]=xy(p);
  const art='<rect x="'+(cx-2.8)+'" y="'+(cy-2.8)+'" width="5.6" height="5.6" fill="#34666c"/>';
  return group('point',p.id,'تحرير '+(pointTypes[p.kind]||'نقطة أرضية'),art+(interactive?'<circle cx="'+cx+'" cy="'+cy+'" r="8" fill="transparent"/>':''));
 }).join('');
 return '<svg class="survey-sketch" viewBox="0 0 320 181" role="'+(interactive?'group':'img')+'" aria-label="مسقط الغرفة من الداخل"><defs><pattern id="survey-hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 5 0" stroke="#c4b594" stroke-width="1"/></pattern></defs><rect width="320" height="181" rx="12" fill="#f4f0e6"/><rect data-survey-envelope x="'+ox+'" y="'+oz+'" width="'+width+'" height="'+depth+'" fill="url(#survey-hatch)"/><polygon data-survey-outline points="'+shape+'" fill="#e4eee4" stroke="#3c5d50" stroke-width="4"/>'+walls+features+points+'<g pointer-events="none" fill="#344b40" font-size="11" font-family="Tahoma,Arial" text-anchor="middle"><text x="160" y="16">'+fmt.format(raw.width*10)+' مم</text><text data-survey-area x="160" y="93" font-size="15" font-weight="bold">'+fmt.format(a.area/10000)+' م²</text><text x="160" y="168">'+fmt.format(raw.length*10)+' مم عمقًا</text></g></svg>';
}

export function bindRoomSketchInput(box,{getDoc,select,blocked,getPoint}){
 let drag=null,suppressClick=false;
 const target=e=>e.target.closest?.('[data-plan-kind]');
 const position=(e,svg)=>{
  const matrix=svg.getScreenCTM();if(!matrix)return null;
  const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(matrix.inverse());
 };
 function end(){
  const old=drag;if(!old)return;
  drag=null;old.target.removeAttribute('transform');
  if(old.target.hasPointerCapture?.(old.id))old.target.releasePointerCapture(old.id);
 }
 box.addEventListener('pointerdown',e=>{
  suppressClick=false;
  const item=target(e);if(!item||drag||e.button!==0||e.isPrimary===false||item.dataset.planKind==='wall'||blocked(item.dataset.planKind,item.dataset.planId))return;
  const doc=getDoc(),svg=item.ownerSVGElement,p=position(e,svg);if(!p)return;
  const f=item.dataset.planKind==='feature'?doc.kitchen.features.find(f=>f.id===item.dataset.planId):null;
  const wall=f&&architectureWall(doc.room,f.wall);
  const point=!f&&getPoint(item.dataset.planId);
  if(!point&&!wall)return;
  drag={id:e.pointerId,target:item,doc,svg,p,clientX:e.clientX,clientY:e.clientY,wall,f,point,scale:Math.min(236/doc.room.width,120/doc.room.length),moved:false,proposal:null};
  try{item.setPointerCapture(e.pointerId);}catch{end();}
 });
 function move(e){
  const d=drag;if(!d||d.id!==e.pointerId)return;
  if(!d.moved&&Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)<5)return;
  const p=position(e,d.svg);if(!p)return;
  let dx=(p.x-d.p.x)/d.scale,dz=(p.y-d.p.y)/d.scale;
  if(d.f){
   const t=d.wall.tangent;
   const du=Math.max(d.wall.start-d.f.u,Math.min(d.wall.end-d.f.width-d.f.u,dx*t.x+dz*t.z));
   dx=du*t.x;dz=du*t.z;
   d.proposal={stationMm:Math.round((d.f.u-d.wall.start+du+(pointKinds.has(d.f.kind)?d.f.width/2:0))*10)};
  }else{
   const margin=d.point.size/2+(d.point.accessMargin||0);
   dx=Math.max(margin-d.point.x,Math.min(d.doc.room.width-margin-d.point.x,dx));
   dz=Math.max(margin-d.point.z,Math.min(d.doc.room.length-margin-d.point.z,dz));
   d.proposal={x:Math.round((d.point.x+dx)*10),z:Math.round((d.point.z+dz)*10)};
  }
  d.moved=true;e.preventDefault();d.target.setAttribute('transform','translate('+dx*d.scale+' '+dz*d.scale+')');
 }
 box.addEventListener('pointermove',move);
 box.addEventListener('pointerup',e=>{
  const d=drag;if(!d||e.pointerId!==d.id)return;
  move(e);end();
  if(d.moved){suppressClick=true;if(d.doc===getDoc())select(d.target.dataset.planKind,d.target.dataset.planId,d.proposal);}
 });
 for(const type of ['pointercancel','lostpointercapture'])box.addEventListener(type,e=>{if(drag?.id===e.pointerId&&e.target===drag.target)end();});
 box.addEventListener('click',e=>{const t=target(e);if(!t)return;if(suppressClick&&e.detail!==0){suppressClick=false;return;}select(t.dataset.planKind,t.dataset.planId);});
 box.addEventListener('keydown',e=>{
  if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end();return;}
  const t=target(e);if(!t||![' ','Enter'].includes(e.key))return;e.preventDefault();select(t.dataset.planKind,t.dataset.planId);
 });
 return {cancel:end};
}
