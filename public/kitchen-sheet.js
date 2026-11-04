import {factoryFrontSurfaces,frontAppearanceSource} from './kitchen-render-factory-fronts.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {pointKinds} from './kitchen-chain-model.js';
import {drawingBookMarkup} from './kitchen-drawing-book.js';
import {outputStamp} from './kitchen-output-stamp.js';
import {factoryHandleMounts} from './kitchen-finish-parts.js';
import {evaluateWallPair} from './kitchen-wall-pair.js';
import {worktopUpstandTakeoff} from './kitchen-worktop-upstand.js';
import {baseSupportTakeoff} from './kitchen-base-support.js';
import {evaluateSurveyedSurfaces} from './kitchen-surveyed-surfaces.js';
import {kitchenGeometry,kitchenUnitSpecs,kitchenFeatureSpecs,kitchenWallPoint} from './kitchen-model.js';
import {roomArchitecture,architectureWall} from './kitchen-architecture.js';
import {kitchenOuterOutline} from './kitchen-building-render.js';
import {kitchenFrontFinishes} from './kitchen-materials.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const number=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
const n=x=>Number(x.toFixed(4)),ap=p=>n(p.x)+','+n(p.z);
const text=(x,y,s,size=10,anchor='middle',color='#264946',more='')=>'<text x="'+n(x)+'" y="'+n(y)+'" font-family="Tahoma,Arial,sans-serif" font-size="'+n(size)+'" fill="'+color+'" text-anchor="'+anchor+'" direction="rtl" '+more+'>'+esc(s)+'</text>';
const fixedLabels={'floor-drain':'صرف أرضي','floor-cleanout':'فتحة تسليك','floor-water':'تغذية أرضية'};
const perimeter=A=>A.walls.reduce((a,w)=>a+w.length,0);
const realPoints=doc=>doc.room.sitePoints||[];
export function sheetFaces(doc){const g=kitchenGeometry(doc.kitchen,doc.room);return [['plan','المسقط العام'],...roomArchitecture(doc.room).walls.map(w=>[w.id,w.label]),...g.runs.filter(r=>r.placement==='free').map((r,i)=>[r.id,'واجهة الجزيرة '+number(i+1)])];}
// Report the same datum used on the survey paper, even for an offset wall.
export function sheetFeatureReadout(room,f){
 const wall=architectureWall(room,f.wall),point=pointKinds.has(f.kind);
 const position=(f.u-(wall?.start??0)+(point?f.width/2:0))*10;
 const fields=point?[['مركز النقطة من ركن البداية',position],['ارتفاع المركز عن الأرض',(f.bottom+f.height/2)*10]]:
  [['الطرف الأول من ركن البداية',position],['عرض العنصر',f.width*10],['ارتفاع الأسفل عن الأرض',f.bottom*10],['الارتفاع',f.height*10]];
 return '<p class="pd-site-wall">'+esc(wall?.label||f.wall)+'</p><dl class="pd-site-values">'+
  fields.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+number(value)+' مم</dd></div>').join('')+'</dl>';
}
function swingGeom(room,f){
 const hand=f.hinge==='right'?-1:1,start=f.u+(hand<0?f.width:0)+hand*(f.hingeInset??0),radius=f.leafWidth??f.width,side=f.swing==='out'?-1:1;
 const at=(u,d)=>kitchenWallPoint(room,f.wall,u,d),joint=at(start,0);
 if(!joint)return null;
 return {joint,at,start,hand,side,arc:Array.from({length:19},(_,i)=>{const ang=i*Math.PI/36;return at(start+hand*radius*Math.cos(ang),side*radius*Math.sin(ang));})};
}
export function surveyDoorMark(room,f,{px=1}={}){
 if(f.kind!=='door'||!Number.isFinite(f.width)||f.width<=0)return '';
 const z=Number.isFinite(px)?px:1,ink='#786247';
 if(!['in','out','sliding'].includes(f.swing)){
  const L=kitchenWallPoint(room,f.wall,f.u,0),R=kitchenWallPoint(room,f.wall,f.u+f.width,0);if(!L||!R)return '';
  return '<g data-k-door-guide="'+esc(f.id)+'" data-k-door-swing="unspecified" pointer-events="none"><title>فتحة باب · حركة الفتح غير محددة</title><path d="M'+ap(L)+'L'+ap(R)+'" fill="none" stroke="'+ink+'" stroke-width="'+n(z)+'"/></g>';
 }
 const a=swingGeom(room,f);if(!a)return '';
 if(f.swing==='sliding'){
  const u=f.u+.08*f.width,U=f.u+.92*f.width,d=Math.min(3.5,f.width*.06),L=a.at(u,d),R=a.at(U,d);
  return '<g data-k-door-guide="'+esc(f.id)+'" data-k-door-swing="sliding" pointer-events="none"><title>باب سحّاب</title><path d="M'+ap(L)+'L'+ap(R)+'M'+ap(a.at(f.u+.24*f.width,d*1.9))+'L'+ap(a.at(f.u+.68*f.width,d*1.9))+'" stroke="'+ink+'" stroke-width="'+n(1.2*z)+'" fill="none"/></g>';
 }
 const end=a.arc.at(-1);
 return '<g data-k-door-guide="'+esc(f.id)+'" data-k-door-hinge="'+(f.hinge==='right'?'right':'left')+'" data-k-door-swing="'+(f.swing==='out'?'out':'in')+'" pointer-events="none"><title>دليل فتح الباب '+(f.swing==='out'?'للخارج':'للداخل')+'</title><path d="M'+ap(a.joint)+'L'+ap(end)+'" stroke="'+ink+'" stroke-width="'+n(1.4*z)+'"/><path d="M'+a.arc.map(ap).join('L')+'" fill="none" stroke="'+ink+'" stroke-width="'+n(.78*z)+'" stroke-dasharray="'+n(3*z)+' '+n(1.6*z)+'"/><circle cx="'+n(a.joint.x)+'" cy="'+n(a.joint.z)+'" r="'+n(1.2*z)+'" fill="'+ink+'"/></g>';
}
// Intersect the actual opening span with its own supporting wall. At true
// corners use the same exterior mitre as the solid 3D room; inside a span
// the opening reveal is perpendicular to this wall, including sloped returns.
export function surveyWallBand(room,features=[],{px=1,technical=false,interactive=false}={}){
 const A=roomArchitecture(room),O=kitchenOuterOutline(A),T=A.wallThickness,out=[];
 A.walls.forEach((w,i)=>{
   const at=(u,d=0)=>({x:w.origin.x+u*w.tangent.x+d*w.inward.x,z:w.origin.z+u*w.tangent.z+d*w.inward.z}),outer=u=>Math.abs(u-w.start)<1e-6?O[i]:Math.abs(u-w.end)<1e-6?O[(i+1)%O.length]:at(u,-T);
   const holes=features.filter(o=>o.wall===w.id&&(o.kind==='door'||o.kind==='window')&&Number.isFinite(o.u+o.width)&&o.width>0).map(o=>({id:o.id,type:o.kind,start:Math.max(w.start,o.u),end:Math.min(w.end,o.u+o.width)})).filter(h=>h.end>h.start);
   const us=[...new Set([w.start,w.end,...holes.flatMap(o=>[o.start,o.end])])].sort((a,b)=>a-b);
   for(let j=1;j<us.length;j++){const a=us[j-1],b=us[j],m=(a+b)/2,h=holes.find(h=>m>h.start&&m<h.end);if(h){
       if(h.type==='window'){const L1=at(a,-T*.4),R1=at(b,-T*.4),L2=at(a,-T*.55),R2=at(b,-T*.55);out.push('<path '+(interactive?'data-k-wall-opening="'+esc(h.id)+'" ':'')+'d="M'+ap(L1)+'L'+ap(R1)+'M'+ap(L2)+'L'+ap(R2)+'" stroke="#71989a" stroke-width="'+n(px*.85)+'"/>');}continue;}
     out.push('<polygon '+(interactive?'data-k-wall-hit="'+esc(w.id)+'" ':'')+'points="'+[at(a),at(b),outer(b),outer(a)].map(ap).join(' ')+'" fill="'+(technical?'#5b6770':'#d5d3c6')+'" stroke="'+(technical?'#303d44':'#9d9e91')+'" stroke-width="'+n(px*(technical?.85:.53))+'" />');
   }
 });
 return '<g data-k-masonry-thickness="'+n(T)+'"'+(interactive?'':' pointer-events="none"')+'>'+out.join('')+'</g>';
}
export function surveyPlanBounds(room,features,padding,extraPoints=[]){
 const A=roomArchitecture(room),pts=[...A.polygon,...kitchenOuterOutline(A),...extraPoints];
 for(const f of features||[])if(f.kind==='door'&&f.swing==='out'){const arc=swingGeom(room,f);if(arc)pts.push(...arc.arc);}
 const xs=pts.map(p=>p.x),zs=pts.map(p=>p.z),xmin=Math.min(...xs)-padding,xmax=Math.max(...xs)+padding,zmin=Math.min(...zs)-padding,zmax=Math.max(...zs)+padding;
 return {x:xmin,y:zmin,w:xmax-xmin,h:zmax-zmin};
}
export function surveyFloorPointMark(p,{px=1,interactive=false}={}){
 if(!p||!fixedLabels[p.kind]||![p.x,p.z,p.size].every(Number.isFinite)||p.size<=0)return '';
 const z=p.size/2,t=Math.max(.23,Math.min(px*1.1,p.size*.12)),c=p.kind==='floor-water'?'#3e7283':'#586b68',size=p.size;
 const circle='<circle r="'+n(z)+'" fill="#f0f2e4" stroke="'+c+'" stroke-width="'+n(t)+'"/>',drain=p.kind==='floor-drain';
 const body=drain?'<rect x="'+n(-z)+'" y="'+n(-z)+'" width="'+n(size)+'" height="'+n(size)+'" fill="#e5e9dc" stroke="'+c+'" stroke-width="'+n(t)+'"/>':circle;
 const path=drain?[-.48,0,.48].map(k=>'M'+n(-z*.72)+' '+n(k*z)+'h'+n(z*1.44)).join(''):p.kind==='floor-cleanout'?'M'+n(-z*.65)+' '+n(z*.48)+'l'+n(z*1.3)+' '+n(-z*.96):'M0 '+n(-z*.6)+'v'+n(z*1.2)+'M'+n(-z*.6)+' 0h'+n(z*1.2);
 return '<g transform="translate('+n(p.x)+' '+n(p.z)+')" data-k-site-point="'+esc(p.id)+'" data-k-site-kind="'+p.kind+'" pointer-events="'+(interactive?'visiblePainted':'none')+'"><title>'+esc(fixedLabels[p.kind]+' · '+number(size)+' سم')+'</title>'+body+'<path d="'+path+'" fill="none" stroke="'+c+'" stroke-width="'+n(t)+'"/></g>';
}
const ink='#253943',softInk='#526672',dimInk='#506571',hair='#94a2a6';
const line=(x1,y1,x2,y2,color=ink,width=1,attrs='')=>'<path d="M'+n(x1)+' '+n(y1)+'L'+n(x2)+' '+n(y2)+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" '+attrs+'/>';
const box=(x,y,w,h,fill,stroke=ink,width=1,attrs='')=>'<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+esc(fill)+'" stroke="'+esc(stroke)+'" stroke-width="'+width+'" '+attrs+'/>';
const dimText=(x,y,value,size)=>text(x,y,value,size,'middle',ink,'style="text-shadow:var(--ks-shadow-dimension-halo)" font-weight="550"');
function horizontalDimension(a,b,y,label,attrs=''){
 const width=b-a;if(width<.001)return '';
 const tick=x=>line(x,y-4,x,y+4,hair,.8)+line(x-2.3,y+2.8,x+2.3,y-2.8,dimInk,1.3);
 const font=width>=label.length*8+5?15:12;
 const visible=width>=label.length*6.1+5;
 return '<g '+attrs+'><title>'+esc(label)+'</title>'+line(a,y,b,y,hair,.9)+tick(a)+tick(b)+(visible?dimText((a+b)/2,y-4,label,font):'')+'</g>';
}
// Codes are drawing references rather than a physical label on the cabinet.
// Keeping the label and its hit area linked matters when the two tiers overlap.
function unitTag(u,code,x,y,span,interactive=true){
 if(span<15)return '<title>'+esc(code+' · '+u.label)+'</title>';
 const width=Math.min(21+6*(code.length-1),span-2),font=Math.max(8,Math.min(15,width/(code.length*.64)));
 return '<g data-sheet-unit="'+esc(u.id)+'" data-sheet-label=""'+(interactive?'':' pointer-events="none"')+'><rect x="'+n(x-width/2)+'" y="'+n(y-9.5)+'" width="'+n(width)+'" height="19" rx="2" fill="#fff" fill-opacity=".94" stroke="#9eaaa8" stroke-width=".55"/>'+
 text(x,y+font*.34,code,font,'middle',ink,'font-weight="650"')+'</g>';
}
const componentAttrs=(unitId,part,index)=>'data-sheet-unit="'+esc(unitId)+'" data-sheet-part="'+part+'"'+(index?' data-sheet-index="'+index+'"':'');
function elevationHandle(mount,x,y,w,h,S,side,unitId,index){
 if(!mount)return '';
 const points=mount.locate(w*10/S,h*10/S,side).map(p=>({x:x+p.x*S/10,y:y+p.y*S/10}));
 if(!points.length)return '';
 const diameter=(mount.visual?.diameter??(points.length===1?22:12))*S/10;
 const circles=points.map(p=>'<circle cx="'+n(p.x)+'" cy="'+n(p.y)+'" r="'+n(points.length===1?diameter/2:.65)+'" fill="'+ink+'"/>').join('');
 const [a,b]=points;
 const target=b?line(a.x,a.y,b.x,b.y,'transparent',Math.max(diameter,8),'stroke-linecap="round" pointer-events="stroke"'):'<circle cx="'+n(a.x)+'" cy="'+n(a.y)+'" r="'+n(Math.max(diameter/2,5))+'" fill="transparent"/>';
 return '<g data-sheet-handle="'+esc(mount.sku)+'" '+componentAttrs(unitId,'handle',index)+' pointer-events="all"><title>'+esc(mount.sku)+'</title>'+target+(b?line(a.x,a.y,b.x,b.y,softInk,n(diameter),'stroke-linecap="round"'):'')+circles+'</g>';
}
function elevationUnit(u,code,dx,dy,S,samples,mount,labelUnit){
 const x=dx(u.u),y=dy(u.bottom+u.height),w=u.width*S,h=u.height*S;
 const upper=u.tier==='upper',kind=u.kind;
 const color=u.frontColor||kitchenFrontFinishes[u.frontFinish]?.color;
 // Colour is a light wash in the technical elevation so outlines stay legible,
 // including on dark front finishes. Only a known finish gets a colour wash.
 const support=u.baseSupport,toe=support?.applicable?Math.min(h,support.bodyClearMm*S/10):u.bottom<1?Math.min(9,u.height*.12)*S:0,frontH=h-toe;
 let art=box(x,y,w,support?.applicable?frontH:h,'#f8f9f8',ink,1.6,'data-sheet-unit="'+esc(u.id)+'" data-sheet-tier="'+esc(u.tier)+'"');
 art+='<g pointer-events="none">';
 if(color)art+=box(x+1,y+1,Math.max(0,w-2),Math.max(0,(support?.applicable?frontH:h)-2),color,'none',0,'opacity=".26"');
 if(support?.mode==='legs'&&support.apron!=='yes'){
  const legs=support.legs||(samples||[]).map(p=>({footprint:support.pads?.[p.index-1],lengthMm:(p.minLegMm+p.maxLegMm)/2}));
  for(const leg of legs){
   if(!leg.footprint||leg.lengthMm<=0)continue;
   const [station,,width]=leg.footprint;
   art+=box(x+station*S/10,y+frontH,width*S/10,leg.lengthMm*S/10,'#c2c9c6',softInk,.7,'data-sheet-leg="'+esc(u.id)+'" '+componentAttrs(u.id,'leg',leg.index)+' pointer-events="all"');
  }
 }
 if(toe)art+=line(x,y+frontH,x+w,y+frontH,softInk,.9);
 if(kind==='drawers'){
  const count=u.drawerCount||3;
  const gap=Math.min(.48,u.width*.015)*S;
  for(let i=1;i<count;i++)art+=line(x,y+frontH*i/count,x+w,y+frontH*i/count,ink,.95);
  for(let i=0;i<count;i++){
   const top=y+frontH*i/count+gap/2;
   art+=box(x+gap,top,w-2*gap,frontH/count-gap,'transparent','none',0,componentAttrs(u.id,'drawer',i+1)+' pointer-events="all"');
   art+=elevationHandle(mount,x+gap,top,w-2*gap,frontH/count-gap,S,undefined,u.id,i+1);
  }
 }else if(u.doorLeaves?.length){
  for(const [i,leaf] of u.doorLeaves.entries()){
   const lx=dx(leaf.closed.u),ly=dy(leaf.bottom+leaf.height),lw=S*leaf.leafWidth,lh=S*leaf.height;
   art+=box(lx,ly,lw,lh,'transparent',softInk,.65,componentAttrs(u.id,'front',i+1)+' pointer-events="all"');
   art+=elevationHandle(mount,lx,ly,lw,lh,S,leaf.hingeSide,u.id,i+1);
   const hinge=leaf.hingeSide==='left'?lx:lx+lw,handle=leaf.hingeSide==='left'?lx+lw:lx;
   if(lw>16&&lh>18)art+=line(handle,ly+2,hinge,ly+lh/2,hair,.8,'stroke-dasharray="3 2"')+line(hinge,ly+lh/2,handle,ly+lh-2,hair,.8,'stroke-dasharray="3 2"');
  }
 }else if(kind==='pullout'){
  art+=box(x,y,w,frontH,'transparent','none',0,componentAttrs(u.id,'pullout')+' pointer-events="all"');
  art+=elevationHandle(mount,x+.55*S,y+.6*S,w-1.1*S,frontH-1.2*S,S,undefined,u.id);
 }
 else if(kind==='open-shelf'){
  const count=u.interior?.shelves||0;
  for(let i=1;i<=count;i++){
   const level=y+frontH*i/(count+1);
   art+=line(x,level,x+w,level,ink,1.45)+line(x,level,x+w,level,'transparent',8,componentAttrs(u.id,'shelf',i)+' pointer-events="stroke"');
  }
 }else if(kind==='dishwasher')art+=line(x,y+Math.min(6*S,h*.15),x+w,y+Math.min(6*S,h*.15),ink,1);
 art+='</g>';
 return art+labelUnit(u,code,x+w/2,y+frontH*(upper?.5:.55),w);
}
function dimensionLanes(units){
 const lanes=[];
 for(const unit of [...units].sort((a,b)=>a.bottom-b.bottom||a.u-b.u)){
  // Stacked runs can have different dividers at the exact same wall station.
  let lane=lanes.find(l=>l.bottom===unit.bottom&&l.units.every(u=>unit.u>=u.u+u.width-1e-6||unit.u+unit.width<=u.u+1e-6));
  if(!lane){lane={bottom:unit.bottom,units:[]};lanes.push(lane);}
  lane.units.push(unit);
 }
 return lanes;
}
export function elevationSheet(doc,face='back',mm=false,widthGrip=null,{customer=false,labelUnit=unitTag}={}){
 const G=kitchenGeometry(doc.kitchen,doc.room),free=G.runs.find(r=>r.id===face&&r.placement==='free'),wall=architectureWall(doc.room,face);
 if(!free&&!wall)return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 90">'+text(200,48,'اختر ضلعًا موجودًا في المسقط')+'</svg>';
 const start=free?free.start:wall.start,span=free?free.length:wall.length,H=G.room.height;
 const items=G.units.filter(u=>free?u.runId===face:u.wall===face),fixed=free?[]:G.features.filter(f=>f.wall===face);
 const openings=fixed.filter(f=>f.kind==='door'||f.kind==='window'),base=dimensionLanes(items.filter(u=>u.tier!=='upper')),upper=dimensionLanes(items.filter(u=>u.tier==='upper'));
 const X=40,Y=36+(openings.length?26:0)+upper.length*26,S=Math.min(500/span,290/H),w=span*S,h=H*S;
 const dx=u=>X+(u-start)*S,dy=v=>Y+(H-v)*S,bottom=dy(0),edge=X+w,fmt=v=>number(mm?v*10:v),unit=mm?'مم':'سم';
 const rowName=(y,s)=>text(edge+7,y,s,12,'end',softInk);
 const spanOwner=free?'data-sheet-run="'+esc(free.id)+'"':'data-sheet-wall="'+esc(face)+'"';
 let html=box(X,Y,w,h,'#fff','#8c9b9e',1.2,spanOwner);
 // The witness starts at the casing's outer edge, or the cabinet's overall
 // edge. Draw it behind the geometry so it never obscures a visible front.
 const witness=(station,from,to)=>line(dx(station),from,dx(station),to,'#aebabe',.7,'pointer-events="none"');
 for(const f of openings){
  const head=dy(f.bottom+f.height)-2;
  html+=witness(f.u,head,53)+witness(f.u+f.width,head,53);
 }
 for(const [i,lane] of upper.entries())for(const u of lane.units){
  const head=dy(u.bottom+u.height)-2,y=Y-8-i*26;
  html+=witness(u.u,head,y)+witness(u.u+u.width,head,y);
 }
 for(const [i,lane] of base.entries())for(const u of lane.units){
  const sill=dy(u.bottom)+2,y=bottom+21+i*26;
  html+=witness(u.u,sill,y)+witness(u.u+u.width,sill,y);
 }
 for(const f of fixed){
  const x=dx(f.u),y=dy(f.bottom+f.height),fw=f.width*S,fh=f.height*S,code='F'+(G.features.indexOf(f)+1);
  const opening=openings.includes(f),structure=['beam','shaft','column'].includes(f.kind),color=opening?'#edf3f5':structure?'#e2e5e4':'#e9e2d2';
  html+='<g data-sheet-feature="'+esc(f.id)+'"><title>'+esc(code+' · '+(kitchenFeatureSpecs[f.kind]?.label||f.kind))+'</title>'+box(x,y,fw,fh,color,ink,opening?1.6:1);
  if(f.kind==='window'&&fw>10&&fh>10){
   html+=box(x+2.4,y+2.4,fw-4.8,fh-4.8,'none','#8da1ac',.8)+line(x+fw/2,y+2.4,x+fw/2,y+fh-2.4,'#798c99',1.1);
  }
  if(fw>42&&fh>28&&opening){
   const caption=f.kind==='door'?'باب':'شباك';
   html+=dimText(x+fw/2,y+fh*.45,caption,15)+text(x+fw/2,y+fh*.45+14,code,11,'middle',softInk);
  }else if(fw>22&&fh>15)html+=text(x+fw/2,y+fh*.43,code,13,'middle',softInk);
  html+='</g>';
 }
 for(const b of G.wallAccessories.filter(b=>!free&&b.wall===face)){
  html+=box(dx(b.x/10),dy((b.y+b.h)/10),b.w*S/10,b.h*S/10,b.color,ink,.9,'data-sheet-accessory="'+esc(b.role)+'" data-sheet-wall="'+esc(b.wall)+'" data-sheet-feature-ref="'+esc(b.featureId)+'"'+(b.section?' data-sheet-section="'+esc(b.section)+'"':''));
 }
 const measured=doc.room.workshop?.surfaces3d&&items.some(u=>u.baseSupport?.mode==='legs')?evaluateSurveyedSurfaces(doc,{unitIds:items.map(u=>u.id)}).results:[];
 const samples=new Map(measured.map(r=>[r.target,r.pads])),handleMounts=factoryHandleMounts(doc.room,doc.kitchen,G);
 const fronts=factoryFrontSurfaces(doc.kitchen,frontAppearanceSource(doc.room.workshop));
 for(const u of items){
  const mount=handleMounts.get(u.id);
  const material=fronts.get(u.id),unit=material?{...u,frontFinish:null,frontColor:material.color||'#d8d7d1'}:u;
  html+=elevationUnit(unit,'U'+(G.units.indexOf(u)+1),dx,dy,S,samples.get(u.id),customer&&mount?{...mount,sku:'يد الوحدة'}:mount,labelUnit);
 }
 const catalog=readWorkshopCatalog(doc.room.workshop),supports=catalog?.baseSupport;
 if(supports)for(const p of baseSupportTakeoff(doc,catalog).aprons){
  if(!items.some(u=>u.runId===p.runId))continue;
  html+=box(dx(p.startMm/10),dy((p.bottomMm+p.heightMm)/10),(p.endMm-p.startMm)*S/10,p.heightMm*S/10,'#cad1cd',softInk,.8,'data-sheet-apron="'+esc(p.runId)+'" data-sheet-wall="'+esc(face)+'"');
 }
 const stone=!free&&doc.room.workshop?.upstand?worktopUpstandTakeoff(doc,catalog,G):null;
 for(const s of stone?.segments||[]){
  if(s.wall!==face)continue;
  html+=box(dx(s.fromMm/10),dy((s.bottomMm+s.heightMm)/10),s.lengthMm*S/10,s.heightMm*S/10,s.color||'#dad3c7',ink,.8,'data-sheet-upstand="'+esc(s.wall)+'" data-height-mm="'+n(s.heightMm)+'"');
 }
 for(const t of G.worktops.filter(t=>free?t.runId===free.id:t.wall===face))html+=box(dx(t.start),dy(t.bottom+t.height),(t.end-t.start)*S,t.height*S,'#d6dbd9',ink,1.1,'data-sheet-worktop="'+esc(t.runId)+'" data-sheet-top-id="'+esc(t.id)+'" data-sheet-wall="'+esc(face)+'"');
 // Seen edge-on, a flush sill is behind the slab; indicate its measured span
 // at the top plane rather than painting a second upright band.
 for(const s of stone?.sills||[]){
  if(s.wall!==face)continue;
  const level=dy((s.bottomMm+s.thicknessMm)/10);
  html+='<g data-sheet-sill="'+esc(s.windowId)+'" data-sill-depth-mm="'+n(s.depthMm)+'"><title>جلسة شباك أفقية · عمق '+number(s.depthMm)+' مم</title>'+line(dx(s.fromMm/10),level,dx(s.toMm/10),level,'transparent',8,'pointer-events="stroke"')+line(dx(s.fromMm/10),level,dx(s.toMm/10),level,'#3d6962',1.7,'stroke-dasharray="4 2"')+'</g>';
 }
 html+='<g pointer-events="none">'+line(X-6,bottom,edge+7,bottom,ink,2.1)+rowName(bottom-3,'±٠');
 html+=horizontalDimension(X,edge,23,fmt(span)+' '+unit,'data-sheet-dim="overall" pointer-events="all" '+spanOwner)+line(X,24,X,Y-1,hair,.65)+line(edge,24,edge,Y-1,hair,.65);
 html+=line(X-15,Y,X-15,bottom,hair,.9)+line(X-20,Y,X-7,Y,dimInk,.85)+line(X-20,bottom,X-7,bottom,dimInk,.85)+
 '<g transform="translate('+n(X-20)+' '+n(Y+h/2)+') rotate(-90)">'+dimText(0,-2,fmt(H)+' '+unit,15)+'</g>';
 if(openings.length){
  const stops=[...new Set([start,start+span,...openings.flatMap(f=>[f.u,f.u+f.width])])].filter(p=>p>=start&&p<=start+span).sort((a,b)=>a-b);
  for(let i=1;i<stops.length;i++)html+=horizontalDimension(dx(stops[i-1]),dx(stops[i]),49,fmt(stops[i]-stops[i-1]),'data-sheet-dim="opening-stations" pointer-events="all" '+spanOwner);
  html+=rowName(47,'البراويز');
 }
 for(const [tier,lanes,title] of [['base',base,'سفلي'],['upper',upper,'علوي']]){
  for(const [i,lane] of lanes.entries()){
   const y=tier==='upper'?Y-12-i*26:bottom+24+i*26;
   for(const u of lane.units)html+=horizontalDimension(dx(u.u),dx(u.u+u.width),y,fmt(u.width),'data-sheet-dim="'+tier+'-unit" data-dim-unit="'+esc(u.id)+'" pointer-events="all"');
   html+=rowName(y-2,title+(lanes.length>1?' '+number(i+1):''));
  }
 }
 html+='</g>';
 const edited=widthGrip&&items.find(u=>u.id===widthGrip.id);
 if(edited){const y=dy(edited.bottom+edited.height*.55);html+=widthGrip.draw({x:dx(edited.u),y},{x:dx(edited.u+edited.width),y});}
 const label=free?'واجهة الجزيرة':wall.label,datum=start?' · البداية على مرجع الجدار '+fmt(start)+' '+unit:'';
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(label)+'" data-sheet-face="'+esc(face)+'" data-sheet-origin="'+n(start)+'" data-sheet-span="'+n(span)+'" viewBox="0 0 '+n(edge+67)+' '+n(bottom+(base.length?8+base.length*26:14))+'" preserveAspectRatio="xMidYMid meet"><title>'+esc(label+datum)+'</title>'+html+'</svg>';
}
function table(cols,rows,targets=[],book=null){
 const body=rows.map((row,index)=>{
  const pick=targets[index];
  const cells=row.map((value,column)=>'<td>'+(pick&&column===0?'<button type="button" class="pr-sheet-row-pick">'+esc(value)+'</button>':esc(value))+'</td>').join('');
  return '<tr'+(pick?' '+pick:'')+'>'+cells+'</tr>';
 }).join('');
 const head=book?'<tr class="schedule-head"><th scope="colgroup" colspan="'+cols.length+'">'+esc(book.title)+'<small>'+esc(book.scope)+'</small></th></tr>':'';
 return '<table class="studio-table"><thead>'+head+'<tr>'+cols.map(s=>'<th scope="col">'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table>';
}
export function sheetTables(doc,face,mm=false,interactive=false,bookScope=''){
 const schedule=(title,cols,rows,targets)=>bookScope&&!rows.length?'':table(cols,rows,targets,bookScope?{title,scope:bookScope}:null);
 const heading=label=>bookScope?'':'<h4>'+label+'</h4>';
 const attr=(name,value)=>name+'="'+esc(value)+'"';
 const links=(items,key,id='id')=>interactive?items.map(item=>attr(key,item[id])):[];
 const G=kitchenGeometry(doc.kitchen,doc.room),all=!face||face==='plan',rows=G.units.filter(u=>all||u.wall===face||u.runId===face),fixed=G.features.filter(u=>all||u.wall===face),f=n=>number(n*(mm?10:1)),unit=mm?'مم':'سم';
 const t=schedule('وحدات الدواليب',['رقم','الوحدة','عرض × ارتفاع × عمق ('+unit+')','منسوب القاعدة','الواجهة'],rows.map(u=>['U'+(G.units.indexOf(u)+1),kitchenUnitSpecs[u.kind]?.label||u.kind,[u.width,u.height,u.depth].map(f).join(' × '),f(u.bottom),kitchenFrontFinishes[u.frontFinish]?.label||'افتراضي']),links(rows,'data-sheet-unit'));
 const featureFields=o=>{
  const label=kitchenFeatureSpecs[o.kind]?.label||o.kind,code='F'+(G.features.indexOf(o)+1),dims=[o.width,o.height,o.depth].map(f).join(' × ');
  if(!bookScope)return [code,label,f(o.u),dims,f(o.bottom)];
  const point=pointKinds.has(o.kind),wallStart=architectureWall(doc.room,o.wall)?.start??0;
  const datum=point?'مركز النقطة':o.kind==='door'||o.kind==='window'?'طرف البرواز الخارجي / أسفله':'طرف العنصر الأول / أسفله';
  return [code,label,datum,f(o.u-wallStart+(point?o.width/2:0)),dims,f(o.bottom+(point?o.height/2:0))];
 };
 const featureColumns=bookScope?['الرمز','التجهيز','مرجع القياس','من ركن بداية الجدار ('+unit+')','عرض × ارتفاع × بروز ('+unit+')','من الأرض ('+unit+')']:['رقم','التجهيز الثابت','البداية على الجدار ('+unit+')','عرض × ارتفاع × بروز','عن الأرض'];
 const features=fixed.length?schedule('الفتحات والتجهيزات الثابتة',featureColumns,fixed.map(featureFields),links(fixed,'data-sheet-feature')):'';
 const services=all&&realPoints(doc).length?schedule('تجهيزات الأرضية',['النقطة الأرضية','من اليسار ('+unit+')','من الخلف','العرض / القطر'],realPoints(doc).map(p=>[fixedLabels[p.kind]||p.kind,f(p.x),f(p.z),f(p.size)]),links(realPoints(doc),'data-k-site-point')):'';
 const pairs=[],pairLinks=[];
 for(const [wall,tiers] of Object.entries(doc.room.workshop?.wallPairs||{})){
  if(!all&&face!==wall)continue;
  for(const [tier,pair] of Object.entries(tiers)){
   const fit=evaluateWallPair(doc,wall,pair);
   const change=fit.differenceMm,trend=change<0?'تضييق ':change>0?'اتساع ':'';
   if(interactive)pairLinks.push(attr('data-sheet-wall',wall)+' '+attr('data-sheet-pair',tier));
   pairs.push([architectureWall(doc.room,wall)?.label||wall,tier==='upper'?'علوي':'سفلي',number(pair.backMm),number(pair.frontMm),
    number(pair.depthMm),number(pair.heightMm),change==null?'—':trend+number(Math.abs(change)),fit.status==='resolved'?number(fit.clearMm):fit.reason]);
  }
 }
 const measured=pairs.length?heading('قياس الظهر والوجه (مم)')+schedule('قياس الظهر والوجه (مم)',['الجدار','الصف','الظهر','الوجه','عمق القياس','الارتفاع عن الأرض','فرق العرض','العرض المشترك قبل السماحات أو سبب تعليقه'],pairs,pairLinks):'';
 const stone=doc.room.workshop?.upstand?worktopUpstandTakeoff(doc,readWorkshopCatalog(doc.room.workshop),G):null;
 const stoneWindows=(stone?.windows||[]).filter(w=>(all||w.wall===face)&&(w.conflict||w.choice));
 const treatments=stoneWindows.map(w=>{
  const windowIndex=G.features.findIndex(f=>f.id===w.windowId);
  const kind={gap:'انقطاع عند البرواز',step:'تنخفض تحت الشباك',uniform:'ارتفاع موحّد للجدار'}[w.choice?.kind];
  return [architectureWall(doc.room,w.wall)?.label||w.wall,'F'+(windowIndex+1),number(w.fromMm)+' – '+number(w.toMm),number(w.rawClearMm),
   w.status==='resolved'&&kind?kind+(w.choice.kind==='gap'?'':' · '+number(w.effectiveHeightMm)+' مم'):w.reason||'بانتظار حسم التفصيل'];
 });
 const sills=(stone?.sills||[]).filter(s=>all||s.wall===face);
 const sillRows=sills.map(s=>[architectureWall(doc.room,s.wall)?.label||s.wall,'F'+(G.features.findIndex(f=>f.id===s.windowId)+1),
  [s.lengthMm,s.depthMm,s.thicknessMm].map(number).join(' × '),number(s.bottomMm+s.thicknessMm),s.mode==='factory'?'المصنع':'مورّد الرخام']);
 return t+features+services+measured+
  (treatments.length?heading('تفصيل النعلة عند الشباك')+schedule('تفصيل النعلة عند الشباك',['الجدار','الشباك','الموضع على الجدار (مم)','من سطح الرخام إلى أسفل البرواز (مم)','تفصيل النعلة'],treatments,links(stoneWindows,'data-sheet-window-choice','windowId')):'')+
  (sillRows.length?heading('جلسات الشبابيك الأفقية الإضافية')+schedule('جلسات الشبابيك الأفقية الإضافية',['الجدار','الشباك','الطول × العمق × السماكة (مم)','منسوب الوجه العلوي (مم)','التوريد'],sillRows,links(sills,'data-sheet-sill','windowId')):'');
}
export function planSheet(doc,mm=false,{tier,interactive=false,widthGrip=null,wallIds=null,labelUnit=unitTag}={}){
 const G=kitchenGeometry(doc.kitchen,doc.room),A=roomArchitecture(doc.room),S=500/Math.max(A.width,A.length);
 const stone=tier!=='upper'&&doc.room.workshop?.upstand?worktopUpstandTakeoff(doc,readWorkshopCatalog(doc.room.workshop),G):null;
 const stoneRect=(s,d)=>[[s.fromMm,0],[s.toMm,0],[s.toMm,d],[s.fromMm,d]].map(([u,z])=>kitchenWallPoint(doc.room,s.wall,u/10,z/10));
 const inScope=v=>!wallIds||wallIds.includes(v.wall);
 const sills=(stone?.sills||[]).filter(inScope).map(s=>({s,points:stoneRect(s,-s.depthMm)}));
 const B=surveyPlanBounds(doc.room,G.features,46/S,sills.flatMap(v=>v.points)),tx=p=>(p.x-B.x)*S,ty=p=>(p.z-B.y)*S,proj=p=>n(tx(p))+','+n(ty(p)),transform='translate('+n(-B.x*S)+' '+n(-B.y*S)+') scale('+n(S)+')';
 const fmt=v=>number(v*(mm?10:1)),unit=mm?'مم':'سم',onTier=u=>inScope(u)&&(!tier||(u.tier==='upper'?'upper':'base')===tier);
 const units=G.units.filter(onTier),unitIds=new Set(units.map(u=>u.id));
 const poly=(points,fill,stroke,width,attrs='')=>'<polygon points="'+points.map(proj).join(' ')+'" fill="'+esc(fill)+'" stroke="'+stroke+'" stroke-width="'+width+'" '+attrs+'/>';
 let h='<g transform="'+transform+'">'+surveyWallBand(doc.room,G.features,{px:1/S,technical:true,interactive})+'</g>'+poly(A.polygon,'#fff','#4a5d65',1.45,'data-sheet-floor=""');
 for(const r of G.runs.filter(onTier))h+=poly(r.polygon,'none',hair,.8,'data-sheet-run="'+esc(r.id)+'" stroke-dasharray="4 2"');
 for(const u of [...units].sort((a,b)=>(a.tier==='upper')-(b.tier==='upper'))){
  const overhead=u.tier==='upper'&&!tier;
  h+=poly(u.polygon,overhead?'none':u.tier==='upper'?'#eaf0f3':'#e4ebe8',ink,overhead?1.05:1.4,'data-sheet-unit="'+esc(u.id)+'" data-sheet-tier="'+esc(u.tier)+'"'+(overhead?' stroke-dasharray="5 3"':''));
 }
 for(const c of G.cutouts.filter(c=>unitIds.has(c.unitId))){
  const owner=G.worktops.find(t=>t.holes.some(h=>h.unitId===c.unitId));
  const cut=owner?' data-sheet-hole="'+esc(c.unitId)+'" data-sheet-top-id="'+esc(owner.id)+'"':'';
  h+=poly(c.polygon,c.kind==='sink'?'#d6e2e6':'#7b8486','#546974',1.05,'data-sheet-unit="'+esc(c.unitId)+'"'+cut);
 }
 for(const o of G.features)h+=poly(o.polygon,['beam','shaft','column'].includes(o.kind)?'#bec6c7':'#d0dfe3','#546974',1,'data-sheet-feature="'+esc(o.id)+'" '+(o.kind==='beam'?'stroke-dasharray="5 2" fill-opacity=".5"':''));
 for(const s of (stone?.segments||[]).filter(inScope))h+=poly(stoneRect(s,s.thicknessMm),s.color||'#d1c5ae',softInk,.65,'data-plan-upstand="'+esc(s.wall)+'" data-height-mm="'+n(s.heightMm)+'"'+(interactive?'':' pointer-events="none"'));
 for(const {s,points} of sills)h+='<g data-plan-sill="'+esc(s.windowId)+'" data-sill-depth-mm="'+n(s.depthMm)+'"'+(interactive?'':' pointer-events="none"')+'><title>جلسة شباك أفقية · عمق '+number(s.depthMm)+' مم</title>'+poly(points,s.color||'#dbd2c0',ink,.8)+'</g>';
 for(const u of units){
  const p=u.polygon.reduce((c,i)=>({x:c.x+i.x/u.polygon.length,z:c.z+i.z/u.polygon.length}),{x:0,z:0});
  const wall=architectureWall(doc.room,u.wall);
  if(!tier&&wall){
   const shift=u.depth*(u.tier==='upper'?-.23:.23);p.x+=wall.inward.x*shift;p.z+=wall.inward.z*shift;
  }
  const x=tx(p),y=ty(p),code='U'+(G.units.indexOf(u)+1);
  if(interactive){
   const xs=u.polygon.map(pt=>pt.x);
   const span=labelUnit===unitTag?u.width:Math.min(u.width,Math.max(...xs)-Math.min(...xs));
   h+=labelUnit(u,code,x,y,span*S);
  }else h+=dimText(x,y+4,code,12);
 }
 h+='<g transform="'+transform+'">'+G.features.filter(o=>o.kind==='door').map(o=>surveyDoorMark(doc.room,o,{px:1/S})).join('')+realPoints(doc).map(p=>surveyFloorPointMark(p,{px:1/S,interactive})).join('')+'</g>';
 for(const [i,w] of A.walls.entries()){
  const T=w.tangent,N=w.inward,doorExtent=Math.max(0,...G.features.filter(o=>o.wall===w.id&&o.kind==='door'&&o.swing==='out').map(o=>o.leafWidth??o.width));
  const offset=Math.max(A.wallThickness,doorExtent)*S+21,shift=(p,d)=>({x:tx(p)-N.x*d,y:ty(p)-N.z*d});
  const a=shift(w.a,offset),b=shift(w.b,offset),center=shift({x:(w.a.x+w.b.x)/2,z:(w.a.z+w.b.z)/2},offset);
  const angle=Math.atan2(T.z,T.x)*180/Math.PI,rot=angle>90?angle-180:angle< -90?angle+180:angle;
  let marks='';
  for(const p of [w.a,w.b]){
   const e=shift(p,A.wallThickness*S+2),f=shift(p,offset+4),end=shift(p,offset);
   marks+=line(e.x,e.y,f.x,f.y,hair,.7)+line(end.x-2*T.x-2.5*N.x,end.y-2*T.z-2.5*N.z,end.x+2*T.x+2.5*N.x,end.y+2*T.z+2.5*N.z,dimInk,1.2);
  }
  const label=w.length*S>80?'ج'+number(i+1)+' · '+fmt(w.length):fmt(w.length);
  h+='<g data-sheet-wall="'+esc(w.id)+'" data-sheet-length="'+n(w.length)+'"'+(interactive?'':' pointer-events="none"')+'><title>'+esc(w.label+' · '+fmt(w.length)+' '+unit)+'</title>'+
   line(a.x,a.y,b.x,b.y,hair,1)+marks+'<g transform="translate('+n(center.x)+' '+n(center.y)+') rotate('+n(rot)+')">'+dimText(0,-3,label,w.length*S>48?15:11)+'</g></g>';
 }
 const edited=widthGrip&&units.find(u=>u.id===widthGrip.id);
 if(edited){
  const [a,b,c,d]=edited.polygon,mid=(p,q)=>({x:(tx(p)+tx(q))/2,y:(ty(p)+ty(q))/2});
  h+=widthGrip.draw(mid(a,d),mid(b,c));
 }
 const drawingWidth=B.w*S,WW=Math.max(320,drawingWidth),foot=B.h*S,barCm=[200,100,50,25,10,5,1].find(v=>v*S<=Math.min(WW*.25,115))||1,bar=barCm*S;
 const footprint='المحيط '+fmt(perimeter(A))+' '+unit+'  ·  المساحة '+number(A.area/10000)+' م²',thickness='الجدار '+fmt(A.wallThickness)+' '+unit,compact=WW<415;
 if(WW>drawingWidth)h='<g transform="translate('+n((WW-drawingWidth)/2)+' 0)">'+h+'</g>';
 h+=line(12,foot,WW-12,foot,'#c2ccd0',1)+text(WW-12,foot+19,compact?footprint:footprint+'  ·  '+thickness,13,'start',softInk);
 if(compact)h+=text(WW-12,foot+35,thickness,12,'start',softInk);
 h+='<g data-sheet-scale-cm="'+barCm+'"><title>مقياس خطي</title>'+line(12,foot+28,12+bar,foot+28,ink,2.4)+line(12,foot+24,12,foot+30,ink,1.4)+line(12+bar,foot+24,12+bar,foot+30,ink,1.4)+text(12+bar/2,foot+19,fmt(barCm)+' '+unit,12,'middle',ink)+'</g>';
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="مسقط المطبخ" data-sheet-perimeter="'+n(perimeter(A))+'" data-sheet-area="'+n(A.area)+'" viewBox="0 0 '+n(WW)+' '+n(foot+(compact?42:35))+'"><title>مسقط المطبخ</title>'+h+'</svg>';
}
export function kitchenDrawingBook(doc,mm=false,stamp=outputStamp(doc,'المطبخ كاملًا','لوحات المقاسات')){
 const geom=kitchenGeometry(doc.kitchen,doc.room),architecture=roomArchitecture(doc.room),name=doc.room.name||'مشروع مطبخ';
 const unit=mm?'مم':'سم',f=value=>number(value*(mm?10:1)),dim=value=>f(value)+' '+unit;
 const walls=architecture.walls,planCode='P-01';
 const code=(prefix,i)=>prefix+'-'+String(i+1).padStart(2,'0');
 const scope=(code,title)=>code+' · '+title+' · '+stamp.revision;
 const wallRows=walls.map((w,i)=>['ج'+number(i+1),w.label,f(w.length),f(w.start),f(w.end),code('E',i)]);
 const planTitle='المسقط العام',planScope=scope(planCode,planTitle);
 let planTables=table(['رمز المسقط','الضلع','الطول ('+unit+')','البداية على مرجع الضلع','النهاية على المرجع','لوحة الواجهة'],wallRows,[],{title:'جدول أضلاع الغرفة',scope:planScope});
 const points=realPoints(doc);
 if(points.length)planTables+=table(['النقطة الأرضية','من اليسار ('+unit+')','من الخلف ('+unit+')','العرض / القطر ('+unit+')'],points.map(p=>[fixedLabels[p.kind]||p.kind,f(p.x),f(p.z),f(p.size)]),[],{title:'تجهيزات الموقع · الأرضية',scope:planScope});
 const sheets=[{code:planCode,title:planTitle,note:'أبعاد المسقط على حدود الغرفة. يُقرأ طول كل ضلع من جدول الأضلاع.',drawing:planSheet(doc,mm),tables:planTables,
  facts:[['المساحة الداخلية',number(architecture.area/10000)+' م²'],['محيط الغرفة',dim(perimeter(architecture))],['سماكة الجدار',dim(architecture.wallThickness)],['عدد الدواليب',number(geom.units.length)]],
  showUnits:geom.units.length>0,showFeatures:false}];
 for(const [id,title] of sheetFaces(doc).slice(1)){
  const wall=architectureWall(doc.room,id),run=wall?null:geom.runs.find(r=>r.id===id);
  const folio=code('E',sheets.length-1),chain=wall&&doc.room.workshop?.chains?.[id];
  const count=geom.units.filter(u=>wall?u.wall===id:u.runId===id).length;
  const fixtures=wall?geom.features.filter(o=>o.wall===id):[];
  const source=chain?.source==='field'?'رفع ميداني مسجّل':chain?.source==='example'?'مثال توضيحي':'رسم المشروع';
  const facts=[['طول '+(wall?'الجدار':'الصف'),dim(wall?wall.length:run.length)],['ارتفاع الغرفة',dim(architecture.height)],['عدد الدواليب',number(count)],['مصدر الواجهة',source]];
  if(chain?.attestation?.reference)facts.push(['مرجع الرفع المسجّل',chain.attestation.reference]);
  sheets.push({code:folio,title,note:'الأبعاد الخارجية للتخطيط. تُراجع قياسات الموقع ومواصفات الأجهزة قبل التصنيع.',drawing:elevationSheet(doc,id,mm),
   facts,showUnits:count>0,showFeatures:fixtures.length>0,tables:sheetTables(doc,id,mm,false,scope(folio,title))});
 }
 return drawingBookMarkup({name,stamp,unit,sheets});
}
export function printKitchen(doc,mm=false){
 const win=window.open('','_blank');if(!win)return false;
 win.opener=null;win.document.write(kitchenDrawingBook(doc,mm));win.document.close();return true;
}
