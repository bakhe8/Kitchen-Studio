import {ownKey} from './kitchen-safe-keys.js';
import {studioIcon} from './kitchen-tool-icons.js';
import {mountDrawingContext} from './kitchen-drawing-context.js';
import {mountDrawingViewport} from './kitchen-drawing-viewport.js';
import {linkedReadingIndex,pointKinds} from './kitchen-chain-model.js';
import {correctCadSurveyFeature,featureDimensionsMm,featureFromDimensionsMm} from './kitchen-cad-measurement.js';
import {checkSitePoints,pointTypes} from './kitchen-site-survey-model.js';
import {wallPhotoForFeature} from './kitchen-wall-photo-assets.js';
import {kitchenRowStrip} from './kitchen-row-strip.js';
import {fillKitchenRow,pinKitchenFillUnit,releaseKitchenFillUnit,restoreKitchenFillGaps} from './kitchen-model.js';
import {creationDefaults} from './kitchen-defaults-calculations.js';
import {kitchenUnitAllowed} from './kitchen-catalog.js';
import {roomFaceLabels} from './shelf-room-model.js';
import {roomArchitecture,architectureWall,architectureContains,architectureWallLabel} from './kitchen-architecture.js';
import {surveyDoorMark,surveyFloorPointMark,surveyPlanBounds,surveyWallBand} from './kitchen-sheet.js';
import {kitchenRoom,kitchenRunPoint,kitchenRunLocal,kitchenRunPolygon,transformFreeRun,createKitchen,kitchenGeometry,kitchenUnitSpecs,kitchenFeatureSpecs,kitchenWallPoint,kitchenWallLocal,addRun,updateRun,addUnit,updateUnit,addFeature,updateFeature,removeKitchenItem,suggestKitchenFix} from './kitchen-model.js';
import {cadPartTarget,faceComponent,openDrawerIndex} from './kitchen-cad-parts.js';
import {mountKitchenCreative} from './kitchen-creative.js';
import {previewKitchenWidthChange,snapFactoryWidthMm,factoryWidthEditable,factoryGeometryReason} from './kitchen-proposal-change.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {onHorizontal,onWall,onRunAxis,pickVolume,volumeEditOverlay} from './kitchen-volume-edit.js';
import {renderKitchenRoom} from './kitchen-render.js';

const ns='http://www.w3.org/2000/svg',fmt=new Intl.NumberFormat('ar',{maximumFractionDigits:1}),f=v=>fmt.format(v),cm=v=>f(v)+' سم',wn=id=>roomFaceLabels[id]||architectureWallLabel(id)||id;
const esc=t=>String(t??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const n=v=>Number.isFinite(v)?Number(v.toFixed(3)):0,clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),round=x=>Math.round(x*2)/2;
const free=e=>e?.placement==='free', runName=e=>free(e)?'جزيرة / صف حر':e?.wall?wn(e.wall):'صف';
const polygonOf=o=>o?.polygon?.length>=3?o.polygon:null;
const rectPoints=r=>[{x:r.x,z:r.z},{x:r.x+r.w,z:r.z},{x:r.x+r.w,z:r.z+r.d},{x:r.x,z:r.z+r.d}];
const pointsOf=o=>polygonOf(o)||(o?.rect?rectPoints(o.rect):[]);
const shape=(o,attrs)=>polygonOf(o)?'<polygon points="'+o.polygon.map(ap).join(' ')+'" '+attrs+'/>':rsvg(o?.rect,attrs);
const polygonPath=o=>{const pts=pointsOf(o);return pts.length?'M'+pts.map(ap).join('L')+'Z':'';};
const inShape=(p,o)=>{const pts=pointsOf(o);if(!p||pts.length<3)return false;let pos=false,neg=false;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],c=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);pos||=c>1e-6;neg||=c< -1e-6;}return !(pos&&neg);};
const centerOf=o=>{const pts=pointsOf(o);return pts.length?{x:pts.reduce((a,p)=>a+p.x,0)/pts.length,z:pts.reduce((a,p)=>a+p.z,0)/pts.length}:null;};
const runTitle=(r,all)=>free(r)?'جزيرة '+f((all||[]).filter(free).findIndex(e=>e.id===r.id)+1):runName(r);
const resizeAxis=(run,room)=>{const axis=free(run)?run.angle:((t)=>t?Math.atan2(t.z,t.x)*180/Math.PI:0)(architectureWall(room,run.wall)?.tangent);return ['x','diagonal-down','z','diagonal-up'][Math.round((((axis%180)+180)%180)/45)%4];};
const adjustAngle=a=>Math.round((((a+180)%360+360)%360-180)*10)/10;
const bearing=(a,b)=>Math.atan2(b.z-a.z,b.x-a.x)*180/Math.PI;
const tint=(v,fallback)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback;
const darkColor=c=>{const s=tint(c,'#eeeeee').slice(1),v=[0,2,4].map(i=>parseInt(s.slice(i,i+2),16));return v[0]*.2126+v[1]*.7152+v[2]*.0722<122;};
const openParts=u=>u?.openParts??(u?.openPart?[u.openPart]:[]);
const zOrder=o=>(o.bottom||0)+(o.height||0);
const byPaintHeight=(a,b)=>a.elevation-b.elevation||a.order-b.order;
// Same physical outlines and height ordering as the plan paint pass. A pair of
// side-hinged leaves never creates a pickable rectangle in the air between them.
function testPlanUnit(g,p,layer){
 let best=null,order=0;
 for(const u of g.units){if(layer!=='all'&&u.tier!==layer)continue;
  for(const shape of [u,...(u.open?openParts(u):(u.doorLeaves||[]).map(l=>l.closed).filter(Boolean))]){const current={unit:u,elevation:zOrder(shape),order:++order};
   if(inShape(p,shape)&&(!best||byPaintHeight(current,best)>0))best=current;}
 }
 return best?.unit||null;
}
const tierName=t=>t==='upper'?'علوي':'سفلي';
const ap=(p)=>n(p.x)+','+n(p.z),span=(r,w)=>architectureWall(r,w)?.end??0,minU=(r,w)=>architectureWall(r,w)?.start??0;
const rsvg=(r,attrs='')=>r?`<rect x="${n(r.x)}" y="${n(r.z)}" width="${n(Math.max(0,r.w))}" height="${n(Math.max(0,r.d))}" ${attrs}/>`:'';
const inside=(p,r)=>!!(p&&r&&p.x>=r.x&&p.x<=r.x+r.w&&p.z>=r.z&&p.z<=r.z+r.d),ctr=r=>({x:r.x+r.w/2,z:r.z+r.d/2});
const tx=(p,s,size,fill='#354939',extra='')=>'<text x="'+n(p.x)+'" y="'+n(p.z)+'" text-anchor="middle" dominant-baseline="middle" font-family="Tahoma,Arial,sans-serif" font-size="'+n(size)+'" fill="'+fill+'" direction="rtl" pointer-events="none" '+extra+'>'+esc(s)+'</text>';
const arrow=(a,b,attrs)=>'<line x1="'+n(a.x)+'" y1="'+n(a.z)+'" x2="'+n(b.x)+'" y2="'+n(b.z)+'" '+attrs+'/>';
const uLabel=k=>kitchenUnitSpecs[k]?.label||k, featLabel=k=>kitchenFeatureSpecs[k]?.label||k;
const pathBand=(room,wall,a,b,d,e)=>[kitchenWallPoint(room,wall,a,d),kitchenWallPoint(room,wall,b,d),kitchenWallPoint(room,wall,b,e),kitchenWallPoint(room,wall,a,e)].map(ap).join(' ');
const defaultWidth=(spec,fallback)=>Number(spec?.width)||fallback;
const getConflictIds=c=>[...(c?.ids||[]),c?.unitId,c?.otherId,c?.featureId,c?.firstId,c?.secondId].filter(Boolean);
const glyphs={shaft:'M-5-5H5V5H-5zM-3 3l6-6m-6 2 2-2m2 6 2-2',beam:'M-6-3H6v6H-6zm0 1h12m-12 2H6',heater:'M-4-5h8v10h-8zm1 3h6m-6 2h6m-6 2h6',fridge:'M-5-6H5V6H-5Zm0 5H5m-7-3v2m0 3v2',freezer:'M-5-6H5V6H-5Zm5 2v8m-3-6 6 4m-6 0 6-4','oven-tower':'M-5-6H5V6H-5Zm1 3h8m-7 2h6v4h-6z',hood:'M-2-6h4v5l4 4H-6l4-4zM-6 5H6','open-shelf':'M-6-4v9m12-9v9m-12-4H6m-12 4H6','bottle-rack':'M-6-5H6V5H-6Zm0 0L6-5m0 10L-6-5',pullout:'M-4-5h8v10h-8zm1 3h6m-6 4h6m-4-2h2',storage:'M-6-4h12v8H-6zm6 0v8',drawers:'M-6-4h12v8H-6zm0 4h12m-7-2h2m-2 4h2',sink:'M-6-3h12v7H-6zm1 1q4 5 8 0M1-3v-2h3',dishwasher:'M-6-5h12v10H-6zm0 3h12m-8 3q2 4 5 0',hob:'M-6-5h12v10H-6zM-4-2a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M1 1a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',oven:'M-6-5h12v10H-6zm2 3h8v5h-8z',tall:'M-4-6h8V6h-8zm0 5h8',window:'M-6-4H6v8H-6zm6 0v8',door:'M-4 5v-10h8v10m-3-4h1',water:'M0-6q-8 9 0 12q8-3 0-12z',drain:'M-5-4h10v8H-5zm2 2v4m3-4v4m3-4v4',electric:'M1-6l-5 7h4l-1 5 5-8H0z',gas:'M0-6q-1 4-4 7 0 5 5 4 6-2 0-10z',vent:'M-5-4H5v8H-5zm2 2h6m-6 2h6m-6 2h6',column:'M-4-5h8v10h-8z'};
const glyph=(p,k,s,color)=>'<g transform="translate('+ap(p)+') scale('+n(s)+')" pointer-events="none" fill="none" stroke="'+color+'" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="'+(glyphs[k]||glyphs.storage)+'"/></g>';
const floorPlanPaint=Object.freeze({
 wood:{base:'#e7decb',tile:[79,22],ink:'#aa9777',mark:'M0 0h79M0 11h79M19 0v11m40 0v11'},
 stone:{base:'#c9cdc3',tile:[37,35],ink:'#9ca598',mark:'M2 3l2 1m14 17 3-1m10 8 2 1m-25 1 2 1'},
 marble:{base:'#efeee6',tile:[57,48],ink:'#bbbdb2',mark:'M0 6l12 4 6 9 15 4 9 11 15 7m-26-19-6 3-4 9'},
 tile:{base:'#e1e4dc',tile:[33,33],ink:'#a9b4a5',mark:'M0 33V0h33'}
});
const layerNames={all:'الصفّان',base:'السفلي',upper:'العلوي'};
const toolNames={select:'تحديد وتحريك',run:'رسم صف',unit:'وضع وحدة',feature:'تجهيز ثابت',test:'اختبار الفتح',measure:'قياس'};
const icons={select:'M5 3v16l4-5 4 7 3-2-4-7 7-1z',run:'M3 5v14h18m-14-4h10m-10-4h6',unit:'M3 5h18v15H3zm9 0v15m-3-8v3m6-3v3',feature:'M3 7h18v11H3zm9 0v11M3 4h18',test:'M5 4h14v15H5zm2 8 7 5V9l-7-4z',measure:'m3 15 12-12 6 6L9 21zM13 5l3 3m-6 0 2 2m-5 1 3 3m-6 0 2 2'};
const icon=(path)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="'+path+'"/></svg>';
let counter=0;

export function mountKitchenView(host,{getProject,onCommitProject,onFactoryRow,getPlan,getKitchen,getRoom,onCommit,onReject,onEditUnit,onRoomDimensions,requireSurvey,onSurveyPoint,onInspectPart,onWindowUpstand,onSurveyReading,onReadingPhoto,onLibrary,onLayouts,getPhotos,onUndo,canUndo,initialViewport,scoped=false}={}){
 if(!host||!getPlan||!getKitchen||!onCommit)throw new Error('Kitchen view requires plan, kitchen, and commit');
 const id='kitstudio'+(++counter),win=host.ownerDocument.defaultView,ac=new AbortController(),on=(el,e,fn,opts={})=>el.addEventListener(e,fn,{...opts,signal:ac.signal});
 const options=(pairs,k)=>pairs.map(([v,t])=>'<option value="'+esc(v)+'" '+(v===k?'selected':'')+'>'+esc(t)+'</option>').join('');
 const toolButtons=Object.entries(toolNames).map(([k,label])=>'<button type="button" data-k-tool="'+k+'" title="'+label+'" aria-label="'+label+'" aria-pressed="'+(k==='select')+'">'+icon(icons[k])+'<span class="kit-tool-label">'+label+'</span></button>').join('');
 const layoutAction=onLayouts?'<button type="button" data-k-act="layouts">التوزيعات</button>':'<button type="button" data-k-act="empty-kitchen">مطبخ فارغ</button>';
 host.hidden=true;host.classList.add('kit-host');host.innerHTML=`<section class="kit" dir="rtl" aria-label="مساحة تصميم المطبخ">
 <header class="kit-command"><div class="kit-view" role="group" aria-label="طريقة العرض">
 <button type="button" data-k-view="top" aria-pressed="true">${icon('M3 4h18v16H3zm0 6h6v10m0-13h7v4h-4v6')}<span>المسقط</span></button><button type="button" data-k-view="volume" aria-pressed="false">${icon('m3 7 9-5 9 5v11l-9 5-9-5zm0 0 9 5 9-5m-9 5v11')}<span>مجسّم</span></button></div>
 <div class="kit-quick" data-k-quick></div></header>
 <div class="kit-mat"><svg class="kit-stage" xmlns="${ns}" role="group" tabindex="0" aria-label="مسقط المطبخ بالسنتيمتر" direction="ltr" preserveAspectRatio="xMidYMid meet"></svg><div class="kit-preview-note" data-k-preview-note hidden aria-hidden="true"></div>
 <details class="kit-palette kit-dock" open><summary aria-label="أدوات الرسم" title="أدوات الرسم">${studioIcon('settings')}<strong data-k-active-tool>تحديد</strong></summary><div class="kit-tools" role="group" aria-label="أدوات التحرير">${toolButtons}<button type="button" data-k-act="inspect" title="خصائص التحديد أو إدخال الموضع بالأرقام" aria-expanded="false">${icon('M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11M10 4v4m5 2v4m-9 2v4')}<span class="kit-tool-label" data-k-inspect-label>الخصائص</span></button><button type="button" data-k-act="remove" title="حدّد عنصرًا لحذفه" aria-label="حذف التحديد" disabled>${icon('M3 6h18M9 6V3h6v3M6 8l1 13h10l1-13M10 10v8m4-8v8')}<span class="kit-tool-label">حذف التحديد</span></button></div><button type="button" class="kit-label-toggle" data-k-act="tool-labels" aria-pressed="false" title="عرض أسماء الأدوات" aria-label="عرض أسماء الأدوات">${studioIcon('list')}<span>الأسماء</span></button></details>
 <aside class="kit-panel" data-k-panel hidden aria-label="خصائص التحديد"><div class="kit-panel-h"><div><span class="kit-panel-type">الخصائص</span><strong data-k-panel-title>التحديد</strong></div><button type="button" data-k-act="close" aria-label="إغلاق الخصائص" title="إغلاق الخصائص">${studioIcon('close')}</button></div><div data-k-panel-body></div><div data-k-creative hidden></div></aside>
 <div class="kit-canvas-meta" aria-hidden="true"><span class="kit-cross">⌖</span><span data-k-room-size></span><i></i><span>سنتيمتر</span></div></div>
 <div class="kit-foot"><div class="kit-state"><i aria-hidden="true"></i><p data-k-note class="kit-status" role="status" aria-live="polite">اختر عنصرًا لعرض مقاسه. الزر الأيمن أو اللمس المطوّل يفتح أوامره.</p></div><div class="kit-foot-links"><button type="button" data-k-act="room">أبعاد الغرفة</button>${layoutAction}<details class="kit-guide"><summary aria-label="دليل استخدام الأداة" title="دليل استخدام الأداة">${studioIcon('help')}</summary><div><strong data-k-guide-title>التحديد</strong><p data-k-guide-text>انقر على قطعة لتحديدها.</p><small>المقاسات بالسنتيمتر.</small></div></details></div></div>
 <div class="kit-reset-check" data-k-check hidden><span data-k-check-msg></span><button type="button" data-k-act="replace">استبدال المطبخ</button><button type="button" data-k-act="cancel-replace">إلغاء</button></div></section>`;
 const root=host.querySelector('.kit'),q=s=>root.querySelector(s),svg=q('.kit-stage'),quick=q('[data-k-quick]'),panel=q('[data-k-panel]'),body=q('[data-k-panel-body]'),title=q('[data-k-panel-title]'),status=q('[data-k-note]'),check=q('[data-k-check]');
 let ruler=null,rulerLayer=null,rulerMoveFrame=0,rulerPointer=null;let previewLayer=null,ghost=null,hoverFrame=0,hoverEvent=null,placementCache=null,ghostStamp='',lastOver=null,previousRoomSize='';const previewNote=q('[data-k-preview-note]');if(previewNote)previewNote.hidden=true;
 let creative=null,inspectInteriorId=null,runPlacement='wall',freeDepth=60;const wallDepth={base:60,upper:34};let view=initialViewport?.view==='volume'?'volume':'top',orbit=false,tool='select',tier='base',layer='all',unitKind='storage',featKind='window',wantWidth=null,selected=null,opened=false,emptyRequest=null,visible=false,dead=false,gesture=null,frame=0,vol=null,quickStamp='',panelStamp='',prevKitchen=null,baseK=null,geoCache=null,geoRoom=null,geoK=null,lastScene=null,focusConflict=null,camera={yaw:Number.isFinite(initialViewport?.yaw)?initialViewport.yaw%360:32,pitch:Number.isFinite(initialViewport?.pitch)?clamp(initialViewport.pitch,-60,72):25};
 let seenPlan=null,roomCache=null,factoryPreview=null,viewKey='',drawingZoom=1,gripZoom=1;
 const factoryMember=u=>u&&getProject?.()?.room.workshop?.rows?.[u.runId]?.units.find(e=>e.id===u.id);
 const resizable=u=>{
   if(!u||kitchenUnitSpecs[u.kind]?.fixedWidth)return false;
   const member=factoryMember(u);
   return !member||!scoped&&factoryWidthEditable(getProject(),u,member);
 };
 let testSource=null,testKitchen=null;
 const current=()=>{const saved=getKitchen();return tool==='test'&&testSource===saved&&testKitchen?testKitchen:saved;},room=()=>{const source=getRoom?.();if(source?.workshop?.wallPairs)return source;const plan=getPlan();if(seenPlan!==plan||!roomCache){seenPlan=plan;const R=kitchenRoom(plan);roomCache={...R,...(plan.room?.workshop?{workshop:plan.room.workshop}:{}),sitePoints:plan?.room?.sitePoints??plan?.kitchenSurfaces?.sitePoints??R.sitePoints??[]};}return roomCache;};
 // Drawing-tool drafts may be overridden locally. A profile change refreshes
 // only the creation tools, never the geometry of rows already on the drawing.
 let defaultRoom=null,activeNew=null,profileStamp='';
 function syncCreationDefaults(){const owner=getRoom?.()||null;if(owner===defaultRoom&&activeNew)return;
  const next=owner?creationDefaults({room:owner,kitchen:current()}):{baseDepth:60,upperDepth:34,frontFinish:null,worktopFinish:null};defaultRoom=owner;
  const sig=JSON.stringify(next);if(activeNew&&sig===profileStamp)return;
  if(!activeNew||activeNew.baseDepth!==next.baseDepth)wallDepth.base=next.baseDepth;if(!activeNew||activeNew.upperDepth!==next.upperDepth)wallDepth.upper=next.upperDepth;
  activeNew=next;profileStamp=sig;placementCache=null;quickStamp=panelStamp='';
 }
 const rowDefaults=()=>Object.fromEntries(['frontStyle','handleStyle','frontFinish'].filter(key=>activeNew?.[key]!=null).map(key=>[key,activeNew[key]]));
 const newRunSpec=(s)=>({autoFill:true,fillDefaults:rowDefaults(),...((s.tier==='upper'&&Number.isFinite(activeNew?.upperBottom))?{bottom:activeNew.upperBottom}:{}),...(Number.isFinite(activeNew?.baseHeight)?{height:s.tier==='upper'?activeNew.upperHeight:activeNew.baseHeight}:{}),...((s.tier!=='upper'&&activeNew?.worktopFinish)?{worktopFinish:activeNew.worktopFinish}:{}),...s});
 const newUnitSpec=(s)=>({...((kitchenUnitSpecs[s.kind]?.frontStyles&&activeNew?.frontStyle)?{frontStyle:activeNew.frontStyle}:{}),...((kitchenUnitSpecs[s.kind]?.handles&&activeNew?.handleStyle)?{handleStyle:activeNew.handleStyle}:{}),...((kitchenUnitSpecs[s.kind]?.frontStyles&&activeNew?.frontFinish)?{frontFinish:activeNew.frontFinish}:{}),...s});
 const note=(t,tone='')=>{if(status.textContent!==t)status.textContent=t;if(status.dataset.tone!==tone)status.dataset.tone=tone;};
 const scopedRowReason='مقاسات هذا الصف مرتبطة بوصفات المصنع. افتح بدائل التوزيع المحسوبة على الخادم لمراجعة تعديلها.';
 const scopedLayouts=()=>{note(scopedRowReason);onLayouts?.();};
 const geom=(k,r)=>{if(geoK!==k||r!==geoRoom){geoCache=kitchenGeometry(k,r);geoK=k;geoRoom=r;}return geoCache;};
 const lookup=(g,s=selected)=>s?(s.kind==='unit'?g.units:s.kind==='feature'?g.features:g.runs).find(x=>x.id===s.id):null;
 const nameOf=(s,e)=>!e?'التفاصيل':s.kind==='unit'?uLabel(e.kind):s.kind==='feature'?featLabel(e.kind):free(e)?runTitle(e,geom(current(),room()).runs):'صف '+tierName(e.tier)+' · '+wn(e.wall);
 const setSelection=(kind,id,show=true)=>{if(factoryPreview?.change.unitId!==id)factoryPreview=null;if(kind!=='unit'||id!==inspectInteriorId)inspectInteriorId=null;selected=id?{kind,id}:null;opened=!!selected&&show;panelStamp='';};
 const pointEvent=e=>{const m=svg.getScreenCTM();if(!m)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const a=p.matrixTransform(m.inverse());return Number.isFinite(a.x+a.y)?{x:a.x,z:a.y}:null;};
 const nearest=(r,p)=>{const scores=roomArchitecture(r).walls.map(edge=>{const w=edge.id,l=kitchenWallLocal(r,w,p);return {wall:w,...l,dist:Math.hypot(l.d,l.u-clamp(l.u,edge.start,edge.end))};}).sort((a,b)=>a.dist-b.dist);return scores[0];};
 const placeRun=(g,r,p,kind,desired=null)=>{const pool=g.runs.filter(v=>(!kind||kitchenUnitAllowed(kind,v))&&(!desired||v.tier===desired)&&(layer==='all'||v.tier===layer));let best=null;
 for(const run of pool){const l=kitchenRunLocal(r,run,p);if(l.u<run.start-1e-6||l.u>run.end+1e-6||l.d< -1e-6||l.d>run.depth+1e-6)continue;
 const score=desired?Math.abs(l.d-run.depth*.5):run.tier==='upper'&&l.d<=run.depth?0:1+Math.abs(l.d-run.depth*.65);if(!best||score<best.score)best={run,l,score};}return best;};
 const infoSnap=()=>({view,orbit,tool,testOpenIds:tool==='test'?current().units.filter(u=>u.open).map(u=>u.id):null,measurement:ruler?.b?{a:{...ruler.a},b:{...ruler.b},...measureValues(ruler.a,ruler.b)}:null,inspectInteriorId,selected:selected?{...selected}:null,selectedId:selected?.id||null,unitKind,featureKind:featKind,tier,layer,runPlacement,freeDepth,...camera});
 function topDrawing(k,g,r,clean=false){
 const W=r.width,L=r.length,m=clamp(Math.max(W,L)*.096,18,102),sc=clamp(Math.min(W,L)/290,.45,3),screen=svg.getBoundingClientRect?.(),pixel=clean?(W+2*m)/1100:Math.max((W+2*m)/(screen?.width||860),(L+2*m)/(screen?.height||530))/drawingZoom,s=Math.max(sc*4.6,pixel*10.2),major=Math.max(W,L)>750?100:Math.max(W,L)>450?50:25;
 const defs='<defs><pattern id="'+id+'-grid" x="0" y="0" width="'+major+'" height="'+major+'" patternUnits="userSpaceOnUse"><path d="M'+major+' 0H0V'+major+'" fill="none" stroke="#d4d6c8" stroke-width=".45"/></pattern><pattern id="'+id+'-danger" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="6" height="6" fill="#d34832" fill-opacity=".18"/><path d="M0 0v6" stroke="#be4633" stroke-width="1.7"/></pattern></defs>';
 const pat=(texture,bg)=>{
   if(!['wood','stone','porcelain'].includes(texture))return '';const key=texture+(darkColor(bg)?'l':'d');if(!textures.has(key)){
    const stroke=darkColor(bg)?'#eff1e0':'#5e564c',t=texture==='wood'?12:texture==='stone'?8:22;
    const ink=texture==='wood'?'<path d="M0 2q3 -1 6 0t6 0M0 8q2 1 4 0t8 0" fill="none" stroke="'+stroke+'" stroke-width=".48"/>':texture==='stone'?'<g fill="'+stroke+'"><circle cx="2" cy="2" r=".65"/><circle cx="6" cy="6" r=".4"/></g>':'<path d="m-2 23 11-10 2-5L21 0" fill="none" stroke="'+stroke+'" stroke-width=".5"/>';
    textures.set(key,'<pattern id="'+id+'-mat-'+key+'" width="'+t+'" height="'+t+'" patternUnits="userSpaceOnUse">'+ink+'</pattern>');}return 'url(#'+id+'-mat-'+key+')';
 };const textures=new Map();
 const floorId=getPlan()?.kitchenSurfaces?.floor,floor=floorPlanPaint[floorId],A=roomArchitecture(r),floorPoly=A.polygon.map(ap).join(' '),irregular=A.walls.length!==4||A.walls.some(w=>Math.abs(w.tangent.x*w.tangent.z)>.00001);
 const floorPattern=floor?'<defs><pattern id="'+id+'-floor" width="'+floor.tile[0]+'" height="'+floor.tile[1]+'" patternUnits="userSpaceOnUse"><path d="'+floor.mark+'" fill="none" stroke="'+floor.ink+'" stroke-width=".55"/></pattern></defs>':'';
 const floorShape=at=>'<polygon points="'+floorPoly+'" '+at+'/>';
 let html=defs+floorPattern+surveyWallBand(r,g.features,{px:pixel,interactive:!clean&&tool==='select'&&!!onInspectPart})+floorShape('data-k-floor="'+(floor?floorId:'plain')+'" fill="'+(floor?.base||'#f2f1e6')+'" stroke="#626a59" stroke-width="'+n(sc*2.3)+'"')+(floor?floorShape('fill="url(#'+id+'-floor)" opacity=".56" pointer-events="none"'):'')+floorShape('fill="url(#'+id+'-grid)" opacity="'+(floor?'.63':'1')+'" pointer-events="none"');
 if(irregular){
   const thickness=r.architecture?.wallThickness??20;
   for(const w of A.walls){const norm=w.inward,o={x:-norm.x,z:-norm.z},off=Math.max(5*sc,Math.min(thickness*.47,13*pixel)),from={x:w.a.x+off*o.x,z:w.a.z+off*o.z},to={x:w.b.x+off*o.x,z:w.b.z+off*o.z},bal={x:(from.x+to.x)/2,z:(from.z+to.z)/2},ang=adjustAngle(Math.atan2(w.tangent.z,w.tangent.x)*180/Math.PI),rot=ang>90?ang-180:ang< -90?ang+180:ang;
    html+='<g data-k-wall-edge="'+esc(w.id)+'" data-k-wall-span="'+n(w.length)+'" pointer-events="none"><title>'+esc(w.label+' · '+cm(w.length))+'</title>'+arrow(w.a,w.b,'stroke="#58665f" stroke-width="'+n(sc*1.5)+'"')+arrow(from,to,'stroke="#8a988e" stroke-width="'+n(sc*.5)+'"');
    for(const x of [from,to])html+=arrow({x:x.x-2*sc*o.x,z:x.z-2*sc*o.z},{x:x.x+2*sc*o.x,z:x.z+2*sc*o.z},'stroke="#829084" stroke-width="'+n(sc*.6)+'"');
    if(w.length>18*pixel)html+='<g transform="rotate('+n(rot)+' '+n(bal.x)+' '+n(bal.z)+')">'+tx(bal,cm(w.length),Math.max(sc*3.4,pixel*8.7),'#3a5147','paint-order="stroke" stroke="#f3f2e6" stroke-width="'+n(2.1*sc)+'"')+'</g>';
    html+='</g>';
    if(!clean&&tool==='select'&&onInspectPart)html+=arrow(from,to,'data-k-wall-hit="'+esc(w.id)+'" stroke="transparent" stroke-width="'+n(12*pixel)+'" pointer-events="stroke"');
   }
 }
 const dimHit=(a,b,key)=>!clean&&tool==='select'&&onRoomDimensions?arrow(a,b,'data-k-room-dimension="'+key+'" stroke="transparent" stroke-width="'+n(16*pixel)+'" pointer-events="stroke"'):'';
 const dimLine=(a,b,p,label)=>arrow(a,b,'stroke="#727b69" stroke-width="'+n(sc*.65)+'"')+[a,b].map(q=>Math.abs(a.z-b.z)<.01?arrow({x:q.x,z:q.z-2*sc},{x:q.x,z:q.z+2*sc},'stroke="#727b69" stroke-width="'+sc+'"'):arrow({x:q.x-2*sc,z:q.z},{x:q.x+2*sc,z:q.z},'stroke="#727b69" stroke-width="'+sc+'"')).join('')+tx(p,label,s,'#465642','paint-order="stroke" stroke="#f8f6ed" stroke-width="'+n(2.8*sc)+'"');
 if(!irregular)html+=dimLine({x:0,z:-m*.58},{x:W,z:-m*.58},{x:W/2,z:-m*.58},'عرض الغرفة '+cm(W))+dimHit({x:0,z:-m*.58},{x:W,z:-m*.58},'width');
 if(!irregular)html+=arrow({x:W+m*.44,z:0},{x:W+m*.44,z:L},'stroke="#727b69" stroke-width="'+n(sc*.6)+'"')+`<g transform="rotate(90 ${W+m*.44} ${L/2})">${tx({x:W+m*.44,z:L/2},'طول الغرفة '+cm(L),s,'#465642','paint-order="stroke" stroke="#f8f6ed" stroke-width="'+n(3*sc)+'"')}</g>`+dimHit({x:W+m*.44,z:0},{x:W+m*.44,z:L},'length');
 const attrId=(kind,obj)=>'data-k-id="'+esc(obj.id)+'" data-k-kind="'+kind+'"';
 const outline=(kind,obj)=>!clean&&selected?.id===obj.id&&selected.kind===kind?'#905b22':'';
 for(const run of g.runs){if(layer!=='all'&&run.tier!==layer&&!clean)continue;const upper=run.tier==='upper',sel=outline('run',run);
 html+='<g '+attrId('run',run)+'>'+shape(run,'fill="'+(upper?'#b1c7c0':'#e2d8b7')+'" fill-opacity="'+(upper?.22:.7)+'" stroke="'+(sel||(upper?'#42747b':'#9e905f'))+'" stroke-width="'+n(sc*(sel?1.9:.9))+'" '+(upper?'stroke-dasharray="4 2"':''))+'</g>';
 }
 // One continuous top over each model span; actual holes are cut with even-odd geometry.
 if(layer!=='upper'||clean)for(const t of g.worktops||[]){
   const rr=g.runs.find(q=>q.id===t.runId),finish=kitchenWorktopFinishes[rr?.worktopFinish],color=tint(rr?.worktopColor,finish?.color||'#b9b19b'),styled=!!(rr?.worktopColor||finish),path=polygonPath(t)+(t.holes||[]).map(h=>polygonPath(h)).join(''),decor=styled&&pat(finish?.texture||'stone',color);
   html+='<path data-k-worktop="'+esc(t.runId)+'" data-k-worktop-color="'+color+'" d="'+path+'" fill-rule="evenodd" fill="'+color+'" fill-opacity="'+(styled?'.95':'.38')+'" stroke="'+(finish?.ink||'#988d73')+'" stroke-width="'+n(.6*sc)+'" pointer-events="none"/>';
   if(decor)html+='<path d="'+path+'" fill-rule="evenodd" fill="'+decor+'" opacity=".24" pointer-events="none"/>';
 }
 for(const b of g.wallAccessories||[]){
  const hit=!clean&&onInspectPart?'data-k-accessory="'+esc(b.featureId)+'" data-k-role="'+esc(b.role)+'" data-k-wall="'+esc(b.wall)+'"'+(b.section?' data-k-section="'+esc(b.section)+'"':''):'pointer-events="none"';
  html+='<path d="'+polygonPath(b)+'" fill="'+b.color+'" stroke="#64685e" stroke-width=".6" opacity=".85" '+hit+'><title>'+esc(b.role==='under-light'?'إنارة أسفل الدواليب':b.role.startsWith('cover')?'غطاء السخان':b.role==='curtain-head'?'مجرى الستارة':'قماش الستارة')+'</title></path>';
 }
 for(const c of g.cornerBodies||[]){
  if(layer!=='all'&&c.tier!=='tall'&&c.tier!==layer&&!clean)continue;
  if(c.polygon)html+='<path data-corner-solid="'+esc(c.id)+'" d="'+polygonPath(c)+'" fill="#b3c3ac" stroke="#526a52"><title>'+esc(c.id)+'</title></path>';
  for(const p of c.install||[])html+='<path data-corner-solid="'+esc(c.id)+'" data-corner-part="'+esc(p.tag)+'" d="'+polygonPath(p)+'" fill="'+(p.tag==='door'?'#bb885c':'#667a68')+'" stroke="#526a52" stroke-width=".6"><title>'+esc(p.tag==='door'?'درفة متحركة':p.tag==='joint'?'فاصل بين صندوقين':'وجه ثابت')+'</title></path>';
  if(c.sweep&&!clean)html+='<path data-corner-solid="'+esc(c.id)+'" d="'+polygonPath(c.sweep)+'" fill="#dda96b" fill-opacity=".2" stroke="#975c29" stroke-dasharray="4 2"><title>حيز حركة إكسسوار الركن</title></path>';
 }
 const units=g.units,objects=[];let paintOrder=0;
 for(const u of units){if(layer!=='all'&&u.tier!==layer&&!clean)continue;const upper=u.tier==='upper',sel=outline('unit',u),run=g.runs.find(v=>v.id===u.runId),rect=u.rect;
 let unitHtml='';const center=centerOf(u),local=kitchenRunPoint(r,run,u.u+u.width*.5,Math.min(u.depth*.82,u.depth-3)),gp=upper?center:local;
 const front=kitchenFrontFinishes[u.frontFinish],work=kitchenWorktopFinishes[run.worktopFinish],hasWork=!upper&&kitchenUnitSpecs[u.kind]?.worktop!==false&&!!(work||run.worktopColor),customFront=!!(front||u.frontColor),stroke=sel||front?.ink||(upper?'#45777e':'#667658'),fill=tint(u.frontColor,front?.color||(upper?'#c4d6d1':u.kind==='tall'?'#b49a72':'#c6caaa'));
 const dark=darkColor(hasWork?tint(run.worktopColor,work?.color):fill),faceInk=dark?'#fff6dd':upper?'#2e5e65':'#414d40';
 unitHtml+='<g '+attrId('unit',u)+' data-k-open-state="'+(u.open?'open':'closed')+'" data-k-front-color="'+fill+'">'+shape(u,'fill="'+fill+'" fill-opacity="'+(hasWork?.2:upper?.67:.86)+'" stroke="'+stroke+'" stroke-width="'+n(sc*(sel?2.4:.95))+'" '+(upper?'stroke-dasharray="3 2"':''))+'<title>'+esc(uLabel(u.kind)+' · '+cm(u.width))+'</title>';
 if(customFront&&!hasWork){const decor=pat(front?.texture||'paint',fill);if(decor)unitHtml+=shape(u,'fill="'+decor+'" opacity=".23" pointer-events="none"');}
 if(customFront||hasWork){const aa=kitchenRunPoint(r,run,u.u,u.depth-1),bb=kitchenRunPoint(r,run,u.u+u.width,u.depth-1);unitHtml+=arrow(aa,bb,'stroke="'+fill+'" stroke-width="'+n(3*sc)+'" pointer-events="none"');}
 if(u.cutout){unitHtml+=shape(u.cutout,(u.kind==='sink'&&!clean?'data-k-basin="'+esc(u.id)+'" ':'')+'fill="'+(u.kind==='sink'?'#c3dedc':'#545c55')+'" stroke="#627875" stroke-width="'+n(sc*.85)+'" rx="'+n(1.2*sc)+'"');}
 unitHtml+=glyph(gp,u.kind,Math.min(sc*1.05,u.width/23,Math.max(.25,u.depth/24)),faceInk);
 if(u.width>34&&u.depth>21){const lbs={fridge:'ثلاجة',freezer:'مجمّد','oven-tower':'برج فرن',hood:'شفاط','open-shelf':'رف مفتوح','bottle-rack':'رف زجاجات',pullout:'سحّابة',storage:'تخزين',tall:'خزانة طويلة',drawers:'أدراج',sink:'حوض',oven:'فرن',dishwasher:'غسالة',hob:'موقد'};const font=Math.min(u.width*.19,u.depth*.23,Math.max(sc*4.7,pixel*9.1));unitHtml+=tx({x:gp.x,z:clamp(gp.z+Math.max(6.2*sc,8*pixel),rect.z+font*.6,rect.z+rect.d-font*.55)},lbs[u.kind]||uLabel(u.kind),font,faceInk,'paint-order="stroke" stroke="'+(dark?'#35463e':'#f1f0e0')+'" stroke-width=".75"');}if(!u.open)for(const leaf of u.doorLeaves||[])if(leaf.closed?.polygon)unitHtml+=shape(leaf.closed,'data-k-closed-leaf="'+esc(leaf.id)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+n(.65*sc)+'" pointer-events="visiblePainted"');
 unitHtml+='</g>';objects.push({html:unitHtml,elevation:zOrder(u),order:++paintOrder});
 for(const part of openParts(u)){
    const hinged=part.kind==='hinged-door',ink=hinged?(customFront?fill:upper?'#94b4ac':'#c4aa7b'):'#d9ae67',edge='#885b2c';
    let leafHtml='<g '+attrId('unit',u)+'><title>'+esc(uLabel(u.kind)+' · '+tierName(u.tier)+' · انقر لإغلاق الواجهة')+'</title>'+shape(part,'data-k-id="'+esc(u.id)+'" data-k-kind="unit" data-k-open="'+esc(u.id)+'" data-k-leaf="'+esc(part.id||u.id)+'" data-k-part="'+esc(part.kind)+'" fill="'+ink+'" fill-opacity="'+(hinged?'.97':'.45')+'" stroke="'+edge+'" stroke-width="'+n((hinged?.85:.9)*sc)+'" '+(hinged?'':'stroke-dasharray="3 1.5" ')+'pointer-events="visiblePainted"');
    if(hinged&&part.hinge)leafHtml+='<circle cx="'+n(part.hinge.x)+'" cy="'+n(part.hinge.z)+'" r="'+n(.85*sc)+'" fill="#6a5236" pointer-events="none"/>';
    objects.push({html:leafHtml+'</g>',elevation:zOrder(part),order:++paintOrder});
 }
 }
 html+=objects.sort(byPaintHeight).map(o=>o.html).join('');
 if(layer!=='upper'||clean)for(const t of g.worktops||[]){const rr=g.runs.find(x=>x.id===t.runId),a=kitchenRunPoint(r,rr,t.start,t.depth),b=kitchenRunPoint(r,rr,t.end,t.depth);if(!clean&&onInspectPart)html+=arrow(a,b,'data-k-stone-run="'+esc(t.runId)+'" data-k-stone-piece="'+esc(t.id)+'" stroke="transparent" stroke-width="'+n(6*pixel)+'" pointer-events="stroke"');html+=arrow(a,b,'data-k-worktop-edge="'+esc(t.id)+'" stroke="#89764f" stroke-width="'+n(1.5*sc)+'" pointer-events="none"');}
 for(const a of g.features){const sel=outline('feature',a),isWall=['window','door'].includes(a.kind),geo=kitchenWallPoint(r,a.wall,a.u+a.width/2,isWall?0:4),structural=['column','shaft','beam'].includes(a.kind),service=!isWall&&!structural,hot=service?'#396b80':structural?'#796f68':'#6b8994';
 html+='<g '+attrId('feature',a)+'><title>'+esc(featLabel(a.kind)+' · '+wn(a.wall))+'</title>';
 if(!structural)html+=shape(a,'data-k-feature-footprint="" fill="#c8d9d7" fill-opacity=".48" stroke="#72898a" stroke-width="'+n(.45*sc)+'"');
 if(isWall){const aa=kitchenWallPoint(r,a.wall,a.u,0),bb=kitchenWallPoint(r,a.wall,a.u+a.width,0);html+=arrow(aa,bb,'stroke="'+(sel||'#fcfcf1')+'" stroke-width="'+n(5*sc)+'"')+arrow(aa,bb,'stroke="'+(sel||hot)+'" stroke-width="'+n(1.8*sc)+'"');}
 else if(structural&&a.rect)html+=shape(a,'data-k-structure="'+esc(a.kind)+'" fill="'+(a.kind==='beam'?'#d0bca3':a.kind==='shaft'?'#a7a4b2':'#a49a88')+'" fill-opacity="'+(a.kind==='beam'?'.48':'.9')+'" stroke="'+(sel||'#74695b')+'" stroke-width="'+n(sc)+'" '+(a.kind==='beam'?'stroke-dasharray="4 2"':''));
 if(a.kind==='door')html+=surveyDoorMark(r,a,{px:pixel});
 html+='<circle cx="'+n(geo.x)+'" cy="'+n(geo.z)+'" r="'+n((service?5.2:3.5)*sc)+'" fill="#f7f9ef" stroke="'+(sel||hot)+'" stroke-width="'+n(sel?sc*1.8:sc*.8)+'"/>'+glyph(geo,a.kind,sc*(service?.62:.45),sel||hot)+'</g>';
 }
 for(const service of r.sitePoints||[])html+=surveyFloorPointMark(service,{px:pixel,interactive:!clean&&tool==='select'});
 for(const c of g.conflicts||[]){if(c.rect)html+=shape(c,'fill="url(#'+id+'-danger)" stroke="#a84432" stroke-width="'+n(sc*.85)+'" pointer-events="none"');}
 const se=lookup(g),selUnit=selected?.kind==='unit'&&se;
 if(selUnit&&!clean){
   const u=se,ds=u.nearestDrain,drain=ds&&g.features.find(v=>v.id===ds.id);
   if(drain){const a=centerOf(u.cutout||u),b=kitchenWallPoint(r,drain.wall,drain.u+drain.width*.5,2);html+=arrow(a,b,'stroke="#2d7895" stroke-dasharray="3 2" stroke-width="'+n(sc)+'" pointer-events="none"');}
   if(view==='top'&&tool==='select'&&resizable(u)&&!gesture?.moved){
     const rr=g.runs.find(e=>e.id===u.runId),cp=kitchenRunPoint(r,rr,u.u+u.width,u.depth*.70),end=kitchenRunPoint(r,rr,u.u+u.width+1,u.depth*.70);
     const angle=Math.atan2(end.z-cp.z,end.x-cp.x)*180/Math.PI,widthMm=Math.round(u.width*10);
     html+='<g data-k-handle="width" data-k-axis="'+resizeAxis(rr,r)+'" data-k-owner="'+esc(u.id)+'" transform="translate('+ap(cp)+') scale('+n(pixel)+')" role="group" aria-label="اسحب طرف الوحدة لتغيير العرض"><title>اسحب طرف الوحدة لتغيير العرض</title><circle r="19" fill="transparent"/><circle r="9" fill="#775334" stroke="#fff9e4" stroke-width="1.4"/><path transform="rotate('+n(angle)+')" d="M-5 0H5M-5 0l2-2m-2 2 2 2M5 0 3-2m2 2-2 2" fill="none" stroke="white" stroke-width="1.5" pointer-events="none"/><g pointer-events="none" data-k-width-mm="'+widthMm+'"><rect x="-24" y="-28" width="48" height="16" rx="4" fill="#fff9ea" stroke="#b39c72"/><text x="0" y="-17" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="10" direction="rtl">'+f(widthMm)+' مم</text></g></g>';
   }
 }
 // Wall rows grow from the fixed back face. Lower-row handles preferentially land on the counter's front edge.
 if(!clean&&view==='top'&&tool==='select'&&selected?.kind==='run'&&se?.wall&&(layer==='all'||layer===se.tier)&&!gesture?.moved){
   const rr=se,t=g.worktops.filter(t=>t.runId===rr.id).sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0],u=t?(t.start+t.end)/2:(rr.start+rr.end)/2,p=kitchenRunPoint(r,rr,u,rr.depth),ax=architectureWall(r,rr.wall).inward,
     hint='اسحب لتغيير عمق الصف ال'+tierName(rr.tier),
     angle=Math.atan2(ax.z,ax.x)*180/Math.PI,axis=['x','diagonal-down','z','diagonal-up'][Math.round((((angle%180)+180)%180)/45)%4];
   html+='<g data-k-handle="run-depth" data-k-owner="'+esc(rr.id)+'" data-k-axis="'+axis+'" transform="translate('+n(p.x)+' '+n(p.z)+') rotate('+n(angle)+') scale('+n(pixel)+')" role="group" aria-label="'+hint+'"><title>'+hint+'</title><circle r="13" fill="transparent"/><circle r="8.5" fill="#775334" stroke="#fffae8" stroke-width="1.4"/><path d="M-5 0h10M-5 0l2-2m-2 2 2 2M5 0 3-2m2 2-2 2" fill="none" stroke="#fff9e4" stroke-width="1.4" pointer-events="none"/></g>';
 }
 // The entire island stays selectable even when every centimetre of it is occupied.
 if(!clean&&tool==='select'&&layer!=='upper')for(const run of g.runs.filter(free)){
   const chosen=selected?.kind==='run'&&selected.id===run.id,mid=run.length/2,a=kitchenRunPoint(r,run,mid,-5*pixel);
   const bw=38*pixel,bh=15*pixel;
   html+='<g data-k-id="'+esc(run.id)+'" data-k-kind="run" data-k-island-tag="" aria-label="تحديد الجزيرة كاملة" cursor="move"><title>اختر الجزيرة كاملة أو اسحب الشارة لنقلها</title><rect x="'+n(a.x-bw/2)+'" y="'+n(a.z-bh/2)+'" width="'+n(bw)+'" height="'+n(bh)+'" rx="'+n(4*pixel)+'" fill="'+(chosen?'#774928':'#f4ecdb')+'" stroke="#956e42" stroke-width="'+n(pixel)+'"/>'+tx({x:a.x,z:a.z+pixel*.4},runTitle(run,g.runs),9*pixel,chosen?'#fff7e7':'#694826')+'</g>';
   if(chosen&&!gesture?.moved){
     const pivot=kitchenRunPoint(r,run,mid,run.depth/2),roll=kitchenRunPoint(r,run,run.length+14*pixel,run.depth/2);
     html+=shape(run,'data-k-island-outline="" fill="none" stroke="#8e5726" stroke-width="'+n(pixel*1.45)+'" stroke-dasharray="'+n(4*pixel)+' '+n(2*pixel)+'" pointer-events="none"')+arrow(kitchenRunPoint(r,run,run.length,run.depth/2),roll,'stroke="#946334" stroke-width="'+n(1.2*pixel)+'" pointer-events="none"');
     for(const [key,at,label,mark] of [['island-move',pivot,'نقل الجزيرة كاملة','✥'],['island-rotate',roll,'تدوير حول المركز','↻']]){
       html+='<g data-k-handle="'+key+'" data-k-owner="'+esc(run.id)+'" data-k-x="'+n(at.x)+'" data-k-z="'+n(at.z)+'" aria-label="'+label+'"><title>'+label+'</title><circle cx="'+n(at.x)+'" cy="'+n(at.z)+'" r="'+n(12*pixel)+'" fill="transparent"/><circle cx="'+n(at.x)+'" cy="'+n(at.z)+'" r="'+n(8.5*pixel)+'" fill="#794d2b" stroke="#fff6de" stroke-width="'+n(1.6*pixel)+'"/>'+tx({x:at.x,z:at.z+pixel*.2},mark,14*pixel,'#fff8ec')+'</g>';
     }
   }
 }
 if(!clean&&gesture?.block){const b=gesture.block;html+=b.item?shape(b.item,'data-k-blocker="" fill="url(#'+id+'-danger)" stroke="#a4462f" stroke-width="'+n(1.45*sc)+'" pointer-events="none"'):'';const a=kitchenRunPoint(r,b.run,b.limit,0),z=kitchenRunPoint(r,b.run,b.limit,b.depth);html+=arrow(a,z,'stroke="#a4462f" stroke-dasharray="3 1" stroke-width="'+n(1.7*sc)+'" pointer-events="none"');}
 if(!clean&&selected?.kind==='feature'&&tool==='select'){const item=g.features.find(f=>f.id===selected.id);if(item)html+=shape(item,'data-k-inspect-ref="'+esc(item.id)+'" fill="none" stroke="#146b59" vector-effect="non-scaling-stroke" stroke-width="2" stroke-dasharray="4 2" pointer-events="none"');}
 if(!clean&&gesture?.draft){const d=gesture.draft,points=free(d)?kitchenRunPolygon(r,d,0,d.length,d.depth,0).map(ap).join(' '):pathBand(r,d.wall,d.start,d.end,0,d.depth??(d.tier==='upper'?34:60));html+='<polygon data-k-draft="" points="'+points+'" stroke-width="'+n(sc*1.5)+'" stroke-dasharray="4 2" stroke="'+(gesture.result?.ok?'#4c754d':'#b34932')+'" fill="'+(gesture.result?.ok?'#88bf83':'#dba390')+'" fill-opacity=".35" pointer-events="none"/>';}
 const bar=major*2;html+=arrow({x:0,z:L+m*.47},{x:bar,z:L+m*.47},'stroke="#59634d" stroke-width="'+n(1.1*sc)+'"')+tx({x:bar/2,z:L+m*.75},cm(bar),s*.88);
 const bounds=surveyPlanBounds(r,gesture?.k?.features||g.features,m);
 return {html:(textures.size?'<defs>'+[...textures.values()].join('')+'</defs>':'')+html,viewBox:[bounds.x,bounds.y,bounds.w,bounds.h].join(' '),bounds};
 }
 function quickUI(g,r){
 const del=q('[data-k-act="remove"]'),item=lookup(g),occupied=item&&selected.kind==='run'&&g.units.some(v=>v.runId===item.id&&(!item.autoFill||v.fillRole!=='auto'));
 del.hidden=tool!=='select'||orbit||!item;del.disabled=del.hidden||!!occupied;del.title=!item?'حدّد عنصرًا لحذفه':occupied?(item.autoFill?'انقل الوحدات المثبّتة أو أزلها قبل حذف الصف':'انقل وحدات الصف أو أزلها قبل حذف الصف'):'حذف '+nameOf(selected,item)+'؛ يمكن التراجع.';
 const key=[view,orbit,tool,tier,layer,runPlacement,freeDepth,wallDepth[tier],unitKind,featKind,wantWidth,g.conflicts?.length,selected?.id,opened,!!ruler,roomArchitecture(r).key].join('|');if(key===quickStamp)return;quickStamp=key;
 for(const b of root.querySelectorAll('[data-k-tool]'))b.setAttribute('aria-pressed',String(tool===b.dataset.kTool));
 for(const b of root.querySelectorAll('[data-k-view]'))b.setAttribute('aria-pressed',String(view===b.dataset.kView));
 const a=q('.kit-tools [data-k-act="inspect"]');
 a.hidden=tool==='measure'||orbit||tool==='select'&&!!item;
 a.setAttribute('aria-expanded',String(opened));
 const inspectLabel=tool==='test'?'نتائج اختبار الفتح':'الخصائص';
 a.setAttribute('aria-label',inspectLabel);a.title=inspectLabel;q('[data-k-inspect-label]').textContent=inspectLabel;
 q('[data-k-active-tool]').textContent={select:'تحديد',run:'صف',unit:'وحدة',feature:'تجهيز',test:'اختبار',measure:'قياس'}[tool];
 const topo=roomArchitecture(r),perimeter=topo.walls.reduce((sum,w)=>sum+w.length,0),meter=q('[data-k-room-size]');meter.textContent=f(r.width)+' × '+f(r.length)+' × '+f(r.height)+((r.architecture?.cut||r.architecture?.outline)?' · محيط '+f(perimeter):'');
 meter.title='المساحة الداخلية '+f(topo.area/10000)+' م² · المحيط '+cm(perimeter)+' · سماكة الجدار '+cm(topo.wallThickness);
 const sel=(key,cap,opts,v)=>'<label><span>'+cap+'</span><select data-k-choice="'+key+'" aria-label="'+cap+'">'+options(opts,v)+'</select></label>';
 const size=(key,cap,v,lo,hi)=>'<label><span>'+cap+'</span><input data-k-choice="'+key+'" aria-label="'+cap+' بالسنتيمتر" type="number" min="'+lo+'" max="'+hi+'" step="any" dir="ltr" value="'+n(v)+'"></label>';
 let h='',tip='';
 if(tool==='run'){
   h+=sel('run-placement','الصف',[['wall','على جدار'],['free','جزيرة حرة']],runPlacement);
   h+=runPlacement==='free'?size('island-depth','العمق',freeDepth,15,150):sel('tier','الطبقة',[['base','سفلي'],['upper','علوي']],tier)+size('wall-depth','عمق الصف',wallDepth[tier],15,150);
   tip=runPlacement==='free'?'اسحب على الأرض لرسم جزيرة وتعبئتها. اختر وحدة لتخصيصها.':'اسحب لرسم صف وتعبئته. بعد الإفلات اختر وحدة لتخصيصها. في المجسّم ابدأ الصف العلوي عند ارتفاع تركيبه.';
 }else if(tool==='unit'){
   const spec=kitchenUnitSpecs[unitKind],layers=['base','upper'].filter(t=>kitchenUnitAllowed(unitKind,t)).map(t=>[t,tierName(t)]);
   h+=sel('unit','الوحدة',Object.entries(kitchenUnitSpecs).map(([k,s])=>[k,s.label]),unitKind)+sel('unit-tier','الصف',layers,layer)+size('width','العرض',wantWidth??defaultWidth(spec,60),20,240);
   if(spec.height)h+='<span class="kit-spec-tag">ارتفاع '+cm(spec.height)+'</span>';
   tip='اختر النوع والعرض، ثم انقر على موضع الوحدة. في الصف التلقائي تتكيّف الوحدات المحيطة.';
 }else if(tool==='feature'){
   h+=sel('feature','التجهيز',Object.entries(kitchenFeatureSpecs).map(([k,s])=>[k,s.label]),featKind);
   tip=view==='volume'?'انقر على وجه الجدار عند ارتفاع التجهيز. الأخضر يعني أن الموضع متاح، والأحمر يوضح العائق.':'اختر موضعًا بمحاذاة الجدار. افتح الخصائص لإدخال الموقع والارتفاع بالأرقام.';
 }else if(tool==='measure'){
   h='<output class="kit-measure-output" data-k-measure-output aria-live="off"></output><button type="button" data-k-act="clear-measure" class="kit-compact-action" title="مسح القياس" aria-label="مسح القياس" '+(ruler?'':'disabled')+'>'+studioIcon('trash')+'</button>';
   tip=view==='top'?'اسحب بين نقطتين في المسقط لقياس المسافة الأفقية بالسنتيمتر.':'اضغط على سطح ظاهر واسحب إلى سطح آخر. المسافة المستقيمة محسوبة في الغرفة، مع فرق الارتفاع والمسافة الأفقية.';
 }else if(tool==='test'){
   h+=sel('test-layer','طبقة الاختبار',Object.entries(layerNames),layer)+'<button type="button" data-k-act="conflicts">التداخلات · '+f(g.conflicts?.length||0)+'</button>';
   tip='اختبر فتح الضلف وإغلاقها في معاينة مؤقتة. اختر طبقة واحدة إذا تراكب الصفان في المسقط؛ التداخل يحسب في وضع الفتح المعروض.';
 }else{h+=sel('layer',view==='volume'?'طبقة التحديد':'الطبقة',Object.entries(layerNames),layer);tip='انقر لتحديد القطعة. اسحب مقبض الطرف لتغيير العرض. الزر الأيمن أو اللمس المطوّل يفتح أوامر القطعة. لفّ البكرة للتقريب واضغطها واسحب لتحريك الرسم. على التابلت قرّب وحرّك بإصبعين. اضغط ٠ لإظهار الرسم كاملًا.';}
 if(view==='volume'){
   h+='<span class="kit-camera-choice"><button data-k-act="orbit" type="button" aria-pressed="'+orbit+'" title="تدوير المجسم" aria-label="تدوير المجسم">'+studioIcon('rotate')+'</button><button data-k-act="home" type="button" aria-label="زاوية البداية" title="زاوية البداية">'+icon('M4 9a8 8 0 1 1-.1 6M4 4v5h5')+'</button></span>';
   if(orbit)tip='اسحب لتدوير المشهد، أو انقر عنصرًا لفتح خصائصه.';
 }
 if(tool==='select'&&item)h+='<button type="button" data-k-act="inspect" class="kit-selected-action" aria-expanded="'+opened+'">خصائص '+esc(nameOf(selected,item))+'</button>';
 if(onLibrary&&tool==='unit')h+='<button type="button" data-k-act="library" class="kit-library-action">تصفح الوحدات</button>';
 quick.innerHTML=h;q('[data-k-guide-title]').textContent=toolNames[tool];q('[data-k-guide-text]').textContent=tip;if(tool==='measure')paintRuler();
 }
 const field=(key,label,value)=>'<label>'+label+' <input type="number" data-k-field="'+key+'" name="'+key+'" step="any" required dir="ltr" value="'+n(value)+'"></label>';
 const depthField=(v,label='عمق الصف (سم)')=>'<label>'+label+' <input name="depth" data-k-field="depth" type="number" dir="ltr" required min="15" max="150" step="0.1" value="'+n(v)+'"></label>';
 const action=(id,label,prim=false)=>'<button type="button" data-k-act="'+id+'" '+(prim?'class="kit-primary"':'')+'>'+esc(label)+'</button>';
 function dimensionFields(room,item){
  const values=featureDimensionsMm(room,item),point=pointKinds.has(item.kind);
  return field('u',point?'من ركن الجدار إلى المركز (مم)':'من الركن إلى الطرف الأول (مم)',values.u)+
    field('width',point?'عرض الفتحة (مم)':'العرض الخارجي (مم)',values.width)+
    field('bottom',point?'ارتفاع المركز عن الأرض (مم)':'من الأرض إلى الأسفل (مم)',values.bottom)+
    field('height','الارتفاع (مم)',values.height)+(['column','shaft','beam','heater'].includes(item.kind)?field('depth','البروز (مم)',values.depth):'');
 }
 function panelUI(g,r,k){
 panel.hidden=!opened;if(!opened)return;const e=lookup(g),sel=selected;
 // Do not replace focused inputs just because the parent refreshed its view.
 const sig=JSON.stringify([selected,view,tool,inspectInteriorId,e?.id,focusConflict,k,r.width,r.length,r.height]);if(sig===panelStamp)return;panelStamp=sig;
 title.textContent=e?nameOf(sel,e):tool==='test'?'اختبار الاستخدام':'ملخص المطبخ';let h='';
 if(e&&tool==='select'){
 const own=sel.kind==='run'?e:g.runs.find(v=>v.id===e.runId),isFree=free(own),w=e.wall||own?.wall;
 h+='<p class="kit-info">'+esc(isFree?runTitle(own,g.runs)+' · مستقلة عن الجدران':wn(w))+(sel.kind==='unit'?' · صف '+tierName(e.tier):'')+'</p>';
 if(own?.autoFill)h+=kitchenRowStrip(k,own.id,sel.kind==='unit'?e.id:'');
 if(sel.kind==='unit'){
   const fixed=!!kitchenUnitSpecs[e.kind]?.fixedWidth,openable=!!kitchenUnitSpecs[e.kind]?.openable,managed=!!own?.autoFill;
   const recipe=factoryMember(e);
   if(recipe){
     const pending=!scoped&&factoryPreview?.change.unitId===e.id?factoryPreview.change:null;
     h+='<p class="kit-sub">وحدة من صف المصنع · البداية '+f(recipe.startMm)+' مم</p>';
     if(scoped)h+='<p>'+scopedRowReason+'</p>';
     else if(factoryWidthEditable(getProject(),e,recipe))h+='<form data-k-form="factory-width"><div class="kit-fields">'+field('widthMm','عرض الوحدة (مم)',pending?.changes.find(c=>c.unitId===e.id)?.afterWidthMm??e.width*10)+'</div><button type="submit">معاينة أثر المقاس</button></form>';
     else h+='<p>مقاس الوحدة مثبّت في صف المصنع.</p>';
     if(pending){
       h+='<section class="kit-factory-preview" aria-label="أثر تعديل صف المصنع"><strong>معاينة قبل الحفظ</strong><ul>'+pending.changes.map(c=>'<li>'+esc(c.label)+' · '+f(c.beforeWidthMm)+' ← '+f(c.afterWidthMm)+' مم'+(c.beforeStartMm!==c.afterStartMm?' · البداية الجديدة '+f(c.afterStartMm)+' مم':'')+'</li>').join('')+'</ul>';
       if(pending.protectedUnits.length)h+='<p>بقيت في مواضعها · '+pending.protectedUnits.map(p=>esc(p.label)).join('، ')+'</p>';
       h+='<p>'+(pending.price.deltaSar===null?'فرق السعر معلّق حتى اكتمال التسعير.':'فرق سعر المطبخ '+pending.price.deltaSar.toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س.')+'</p>'+(pending.hold?'<p class="kit-warn" role="status">'+esc(pending.hold)+'</p>':action('confirm-factory-width','تطبيق على الرسم والحصر',true))+action('cancel-factory-width','إلغاء التعديل')+'</section>';
     }
     if(scoped?onLayouts:onFactoryRow)h+=action('factory-row',scoped?'مراجعة بدائل الصف على الخادم':'تخصيص وحدات هذا الصف');
   }else if(managed){
     const automatic=e.fillRole==='auto';
     h+='<p class="kit-fill-state" data-k-fill-state="'+(automatic?'auto':'fixed')+'"><strong>'+(automatic?'وحدة تلقائية':'وحدة مثبّتة')+'</strong><span>'+(automatic?'تتكيّف مع بقية الصف':'موضعها ومقاسها محفوظان')+'</span></p>';
     const kinds=Object.entries(kitchenUnitSpecs).filter(([key])=>kitchenUnitAllowed(key,own)).map(([key,x])=>[key,x.label]);
     h+='<form data-k-form="unit"><label class="kit-fill-kind">نوع الوحدة <select name="fillKind">'+options(kinds,e.kind)+'</select></label><div class="kit-fields">'+field('u','من بداية الصف (سم)',e.u-own.start).replace('type="number"','type="number" min="0" max="'+n(own.end-own.start)+'"')+field('width','العرض (سم)',e.width).replace('type="number"','type="number"'+(fixed?' readonly':''))+'</div><div class="kit-row"><button type="submit" class="kit-primary">حفظ التخصيص</button>'+action(automatic?'pin-fill':'release-fill',automatic?'تثبيت موضعها ومقاسها':'إعادتها للتعبئة التلقائية')+'</div><p hidden data-k-fill-error class="kit-warn" role="alert"></p></form>';
   }
   const cl=e.clearance||{};h+='<dl class="kit-measures">'+[['العرض',e.width],['الارتفاع',e.height],['العمق',e.depth]].map(([cap,v])=>'<div><dt>'+cap+'</dt><dd>'+f(v)+'<small> سم</small></dd></div>').join('')+'</dl>'+(managed?'':'<p>فراغ الصف: '+cm(cl.before||0)+' قبل الوحدة، و'+cm(cl.after||0)+' بعدها.</p>');
   if(e.nearestDrain)h+='<p class="kit-plumb">أقرب مصرف: '+cm(e.nearestDrain.distance)+' من الحوض.</p>';
   else if(e.kind==='sink')h+='<p class="kit-warn">لم يُضف مصرف. اختر «تجهيز ثابت» لوضعه.</p>';
   if(e.kind==='sink')h+='<p>'+ (e.windowId?'الحوض بمحاذاة نافذة.':'لا توجد نافذة فوق مركز الحوض.')+(e.nearestWater?' أقرب نقطة مياه: '+cm(e.nearestWater.distance)+'.':'')+'</p>';
   if(own?.wall&&!isFree){
     h+='<form class="kit-row-depth-form" data-k-form="wall-row-depth"><div class="kit-fields">'+depthField(own.depth,'عمق الصف '+layerNames[own.tier]+' (سم)')+'<button type="submit">تطبيق على الصف</button></div>';
     if(kitchenUnitSpecs[e.kind]?.depth!=null)h+='<small>عمق '+esc(uLabel(e.kind))+' ثابت: '+cm(e.depth)+'.</small>';
     h+='</form>';
   }
   h+=action('parent-run',isFree?'اختيار الجزيرة كاملة':'تحديد الصف '+layerNames[own.tier]+' كاملًا');
   if(fixed)h+='<p>مقاس الجهاز ثابت. يمكنك تغيير موضعه.</p>';
   if(!managed&&!recipe)h+='<form data-k-form="unit"><div class="kit-fields">'+field('u','البداية (سم)',e.u)+(fixed?'':field('width','العرض (سم)',e.width))+'</div><button type="submit">'+(fixed?'تطبيق الموضع':'تطبيق الموضع والعرض')+'</button></form>';
   if(view==='volume'&&tool==='select'&&!e.open&&['storage','tall'].includes(e.kind))h+='<button type="button" data-k-act="inspect-interior" aria-pressed="'+(inspectInteriorId===e.id)+'">'+(inspectInteriorId===e.id?'إظهار الواجهة':'كشف داخل الخزانة')+'</button>';
   h+='<div class="kit-row">'+(openable?action('toggle',e.open?'إغلاق الواجهة':'اختبار فتح الواجهة'):'')+(onEditUnit&&kitchenUnitSpecs[e.kind]?.editableInterior?action('interior','تحرير داخل الوحدة'):'')+'</div>';
 }else if(sel.kind==='run'){
   if(!e.autoFill)h+=action('fill-row','تعبئة الصف',true)+'<p class="kit-sub">تبقى الوحدات الحالية في أماكنها.</p>';
   else if(e.fillGaps?.length)h+=action('restore-fill','إعادة تعبئة الفراغات المحجوزة');
   const gaps=e.gaps||[],mid=isFree?kitchenRunPoint(r,e,e.length/2,e.depth/2):null;h+='<p>طول الصف '+cm(e.end-e.start)+' · '+(gaps.length?'فراغاته: '+gaps.map(z=>cm(z.width)).join('، '):'لا يوجد فراغ بين وحداته.')+'</p><form data-k-form="run"><div class="kit-fields">'+(isFree?field('centerX','مركز الجزيرة من اليسار (سم)',mid.x)+field('centerZ','مركز الجزيرة من الخلف (سم)',mid.z)+field('angle','الزاوية (°)',e.angle)+field('length','الطول (سم)',e.length):field('start','البداية (سم)',e.start)+field('end','النهاية (سم)',e.end))+depthField(e.depth,isFree?'عمق الجزيرة (سم)':e.tier==='upper'?'عمق الصف العلوي (سم)':'عمق الصف السفلي (سم)')+'</div><details><summary>الارتفاع ومنسوب التركيب</summary><div class="kit-fields">'+field('height','الارتفاع (سم)',e.height)+field('bottom','عن الأرض (سم)',e.bottom)+'</div></details><button>تطبيق أبعاد الصف</button></form>'+action('add-in-run','إضافة وحدة إلى هذا الصف');
 }else{
   const source=getRoom?.()||r,measured=linkedReadingIndex(source,e)>=0;
   if(measured){
    const edge=architectureWall(source,e.wall),start=edge?.start||0;
    if(getProject&&onCommitProject){
     h+='<form data-k-form="survey-feature"><div class="kit-fields">'+dimensionFields(source,e)+'</div><button type="submit" class="kit-primary">حفظ قياس الجدار</button> <button type="submit" data-k-preview-survey>معاينة فقط</button></form>'+
      '<p class="kit-sub">اسحب العنصر لتعديل موضعه، ثم احفظ القراءة. تبقى مواضع العناصر المجاورة ثابتة.</p>'+action('correct-survey-reading','فتح القراءة في ورقة الجدار');
    }else h+='<p class="kit-sub">المقاسات من رفع الجدار بالملليمتر. اختر تصحيح القراءة أو عاين بديلًا مؤقتًا.</p>'+
     action('correct-survey-reading','تصحيح قياس الزيارة',true)+
     '<form data-k-form="preview-survey-feature"><div class="kit-fields">'+field('u','من بداية الجدار (مم)',(e.u-start)*10)+field('width','العرض الخارجي (مم)',e.width*10)+field('bottom','من الأرض إلى الأسفل (مم)',e.bottom*10)+field('height','الارتفاع (مم)',e.height*10)+'</div><button>معاينة بديل على الرسم</button></form>';
    if(e.kind==='window')h+='<form data-k-form="measured-glazing"><label>الزجاج <select name="glazing">'+options([['','غير محدد'],['clear','شفاف'],['frosted','مصنفر']],e.glazing||'')+'</select></label><button>حفظ نوع الزجاج</button></form>';
    }else h+='<form data-k-form="site-feature"><div class="kit-fields">'+dimensionFields(source,e)+'</div>'+(e.kind==='door'?'<div class="kit-fields"><label>المفصلة <select name="hinge">'+options([['','غير محدد'],['left','اليسار'],['right','اليمين']],e.hinge||'')+'</select></label><label>الفتح <select name="swing">'+options([['','غير محدد'],['in','للداخل'],['out','للخارج'],['sliding','سحّاب']],e.swing||'')+'</select></label></div>':e.kind==='window'?'<label>الزجاج <select name="glazing">'+options([['','غير محدد'],['clear','شفاف'],['frosted','مصنفر']],e.glazing||'')+'</select></label>':'')+'<button>تطبيق التجهيز</button></form>';
   if(onReadingPhoto&&wallPhotoForFeature(source,e.id))h+=action('reading-photo','صورة القياس الأصلية');
   if(e.kind==='window'&&onWindowUpstand)h+=action('window-upstand','نعلة الرخام عند هذا الشباك');
 }
 if(!(sel.kind==='unit'&&own?.autoFill))h+='<p class="kit-sub">'+(isFree?(sel.kind==='run'?'يُحفظ مركز الجزيرة عند تغيير الزاوية وحدها. زاوية ٠° نحو اليمين، و٩٠° نحو مقدّمة الغرفة. اسحب ↻ في الرسم لتدويرها.':'تُقاس بداية الوحدة على طول الجزيرة، من بداية حافتها الخلفية.'):'تُقاس البداية من يسار الجدار عند النظر إليه من داخل الغرفة.')+'</p>';
 }else if(['run','unit','feature'].includes(tool)){
   const initialWall=architectureWall(r,'back')||roomArchitecture(r).walls[0],wr='<label>ضلع الغرفة <select name="wall">'+options(roomArchitecture(r).walls.map(v=>[v.id,v.label+' · '+cm(v.length)]),initialWall.id)+'</select></label><p class="kit-sub" data-k-wall-range>المجال على المرجع: '+cm(initialWall.start)+' – '+cm(initialWall.end)+'.</p>';
   if(tool==='run'&&runPlacement==='free'){title.textContent='جزيرة بالأبعاد';h+='<p>حدّد بداية الحافة الخلفية، ثم طولها وزاويتها. زاوية ٠° نحو اليمين، و٩٠° نحو مقدّمة الغرفة.</p><form data-k-form="new-island"><div class="kit-fields">'+field('x','من يسار الغرفة (سم)',Math.round(r.width*.23))+field('z','من الجدار الخلفي (سم)',Math.round(r.length*.43))+field('angle','الزاوية (°)',0)+field('length','الطول (سم)',Math.min(120,Math.floor(r.width*.48)))+field('depth','العمق (سم)',freeDepth)+'</div><button>إضافة الجزيرة</button></form>';}
   else if(tool==='run'){title.textContent='صف بالأبعاد';h+='<form data-k-form="new-run">'+wr+'<div class="kit-fields">'+field('start','البداية (سم)',initialWall.start)+field('end','النهاية (سم)',Math.min(initialWall.start+150,initialWall.end))+depthField(wallDepth[tier])+'</div><button>إضافة صف '+tierName(tier)+'</button></form>';}
   if(tool==='feature'){title.textContent=featLabel(featKind);h+='<form data-k-form="new-feature">'+wr+'<div class="kit-fields">'+field('u','البداية (سم)',initialWall.start)+field('width','العرض (سم)',defaultWidth(kitchenFeatureSpecs[featKind],8))+'</div><details><summary>ارتفاع التجهيز وتركيبه</summary><div class="kit-fields">'+field('bottom','عن الأرض (سم)',kitchenFeatureSpecs[featKind].bottom)+field('height','ارتفاع التجهيز (سم)',kitchenFeatureSpecs[featKind].height)+'</div></details><button>إضافة التجهيز</button></form>';}
   if(tool==='unit'){const runs=g.runs.filter(t=>t.tier===layer);title.textContent='وضع '+uLabel(unitKind);
     if(!runs.length)h+='<p>ارسم صفًا '+tierName(layer)+' أولًا لوضع الوحدة فيه.</p>';
     else h+='<form data-k-form="new-unit"><label>الصف <select name="runId">'+options(runs.map((v,i)=>[v.id,runTitle(v,g.runs)+' · '+(free(v)?cm(v.length)+'، '+f(v.angle)+'°':cm(v.start)+'–'+cm(v.end))]),runs[0].id)+'</select></label><p>اترك البداية فارغة ليختار البرنامج موضعًا متاحًا.</p><label>البداية (سم) <input type="number" name="startOpt" step="any" dir="ltr"></label><button>إضافة الوحدة</button></form>';}
 }else if(tool==='select'){
   if(g.runs.length)h+='<label class="kit-run-jump">اختيار صف كامل <select data-k-jump aria-label="اختيار صف كامل"><option value="">اختر الصف</option>'+options(g.runs.map(v=>[v.id,runTitle(v,g.runs)+' · '+(free(v)?cm(v.length):tierName(v.tier)+' '+cm(v.start)+'–'+cm(v.end))]),'')+'</select></label>';
   h+='<p>'+f(g.runs.length)+' صفوف · '+f(g.units.length)+' وحدات · '+f(g.features.length)+' تجهيزات ثابتة.</p><p>سطح العمل: '+f(g.worktops?.length||0)+' امتدادات متصلة. فتحات الحوض والموقد: '+f(g.cutouts?.length||0)+'.</p>';
 }
 if(tool==='test'||tool==='select'&&(!e||(g.conflicts||[]).some(c=>getConflictIds(c).includes(e.id)))){
   const conflicts=g.conflicts||[];h+='<div class="kit-tests"><h4>التداخلات الحالية · '+f(conflicts.length)+'</h4>';if(tool==='test')h+='<p>هذا اختبار مؤقت لحركة الضلف. تُحسب التداخلات في الوضع المعروض، ويعود التصميم إلى وضعه المحفوظ عند مغادرة الاختبار.</p>';
   if(!conflicts.length)h+='<p>لا يوجد تداخل مُسجّل في الوضع الحالي. افتح وحدتين متجاورتين لاختبار المساحة أمامهما.</p>';
   for(const c of conflicts){const fix=suggestKitchenFix(k,r,c.id);h+='<div class="kit-conflict"><p>'+esc(c.label||c.reason||'تداخل بين عنصرين')+'</p>'+(fix?'<button type="button" data-k-fix="'+esc(c.id)+'">'+(tool==='test'?'مراجعة التصحيح المقترح · ':'تطبيق حل · ')+esc(fix.reason||'نقل الوحدة إلى موضع متاح')+'</button>':'')+'</div>';}
   h+='</div>';
 }
 body.innerHTML=h;
 }
 function paint(k=current(),full=true){
 if(dead||!visible||!k)return;const r=room(),g=geom(k,r);
 if(selected&&!lookup(g))setSelection(null,null,false);
 const scenePlan=getPlan(),vkey=[k,scenePlan,r.width,r.length,r.height,view,orbit,inspectInteriorId,camera.yaw,camera.pitch,selected?.kind,selected?.id,tool,layer,gesture?.draft?.start,gesture?.draft?.end,gesture?.draft?.x,gesture?.draft?.z,gesture?.draft?.angle,gesture?.draft?.length,gesture?.block?.limit,!!gesture?.moved];
 const nextKey=[view,getRoom?.()?.projectId||'',r.width,r.length,r.height].join('|');
 if(viewKey!==nextKey){viewKey=nextKey;drawingZoom=1;lastScene=null;}
 if(!lastScene||lastScene.length!==vkey.length||vkey.some((v,i)=>lastScene[i]!==v)){
  const d=view==='volume'?(vol=renderKitchenRoom(scenePlan,{kitchen:k,...camera,...(gesture?.scene&&gesture.kind!=='orbit'?{projection:gesture.scene.projection}:{}),mode:'cutaway',prefix:id+'-volume',selectedId:selected?.id,inspectInteriorId:inspectInteriorId||undefined,photos:getPhotos?.()||{}})):topDrawing(k,g,r);
  viewport.sync(svg,d.viewBox,viewKey);gripZoom=drawingZoom;let overlay='';
  if(view==='volume'&&!orbit&&!['test','measure'].includes(tool)){const M=svg.getScreenCTM?.(),scale=M&&Math.hypot(M.a,M.b)||1,dr=gesture?.draft;
    const draft=dr?{polygon:free(dr)?kitchenRunPolygon(r,dr,0,dr.length,dr.depth):kitchenRunPolygon(r,dr,dr.start,dr.end-dr.start,dr.depth??(dr.tier==='upper'?34:60)),bottom:dr.bottom??(dr.tier==='upper'?145:0),height:dr.height??(dr.tier==='upper'?70:86),ok:!!gesture.result?.ok,label:free(dr)?'جزيرة':'صف '+tierName(dr.tier)}:null;
    overlay=volumeEditOverlay(vol,{selected,tool,layer,allowWidth:resizable(selected?.kind==='unit'?lookup(g):null),px:1/scale,gesture:gesture?{kind:gesture.kind,moved:gesture.moved,block:gesture.block}:null,draft,showGuides:true});
  }
  svg.innerHTML=d.html+overlay+'<g data-k-preview-layer="" pointer-events="none" aria-hidden="true"></g><g data-k-ruler-layer="" pointer-events="none" aria-hidden="true"></g>';rulerLayer=svg.querySelector('[data-k-ruler-layer]');paintRuler();previewLayer=svg.querySelector('[data-k-preview-layer]');ghostStamp='';paintGhost();svg.dataset.kView=view;svg.dataset.kTool=tool;svg.dataset.kOrbit=String(view==='volume'&&orbit);svg.setAttribute('aria-label',view==='top'?'مسقط علوي للمطبخ بالسنتيمتر':orbit?'مجسّم المطبخ؛ اسحب لتدوير الكاميرا':'تعديل المطبخ في المجسّم بواسطة '+toolNames[tool]);lastScene=vkey;
 }
 if(full){quickUI(g,r);panelUI(g,r,k);creative?.refresh(visible&&opened&&tool==='select');}
 }
 function refresh(show=true){syncCreationDefaults();visible=!!show;host.hidden=!visible;if(!visible){testSource=testKitchen=null;contextMenu.close();clearGhost();cancelGesture();creative?.refresh(false);return;}const k=current(),R=room(),rk=[R.width,R.length,R.height,JSON.stringify(R.architecture||null)].join('/');if(k!==prevKitchen||rk!==previousRoomSize){contextMenu.close();if(prevKitchen)ruler=null;clearGhost();prevKitchen=k;previousRoomSize=rk;panelStamp='';}paint(k);}
 function drawSoon(){if(!frame)frame=win.requestAnimationFrame(()=>{frame=0;paint(gesture?.result?.ok?gesture.result.kitchen:current(),false);});}
 function endDrag(){const d=gesture;gesture=null;if(rulerMoveFrame)win.cancelAnimationFrame(rulerMoveFrame);rulerMoveFrame=0;rulerPointer=null;delete root.dataset.kDrag;if(frame)win.cancelAnimationFrame(frame);frame=0;if(d)try{if(svg.hasPointerCapture(d.id))svg.releasePointerCapture(d.id);}catch{}return d;}
 function cancelGesture(){clearGhost();if(!gesture)return;const prior=endDrag();lastScene=null;if(visible){paint();if(prior.moved&&prior.kind!=='orbit')note('أُلغي السحب. بقي التصميم كما كان.');}}
 function reject(reason){const text='لم يُعتمد التغيير: '+(reason||'لا يمكن تنفيذ هذا التعديل هنا.');note(text,'warn');onReject?.(text);return false;}
 function commitKitchenOnly(next,message){
   const issue=factoryGeometryReason(getProject?.(),next);
   if(issue)return {ok:false,reason:scoped?scopedRowReason:issue};
   return onCommit(next,message);
 }
 function commit(res,msg,what=null,open=false){
 clearGhost();if(!res?.ok){reject(res?.reason);paint();return false;}
 if(res.changed===false||res.kitchen===current()){note(res.reason||'لم يتغيّر التصميم.');paint();return false;}
 const result=commitKitchenOnly(res.kitchen,msg+(res.clamped&&res.reason?' '+res.reason:''));
 if(result?.ok===false){reject(result.reason);paint();return false;}
 if(what)setSelection(what,res.id,open);
 panelStamp='';lastScene=null;paint();note(msg+(res.clamped&&res.reason?' '+res.reason:''));return true;
 }
 function finishNewRow(res){
 if(!res?.ok){commit(res,'');return;}
 const rr=res.kitchen.runs.find(x=>x.id===res.id),count=res.kitchen.units.filter(x=>x.runId===res.id).length;
 tool='select';layer='all';foldSmallPalette();quickStamp='';
 const message=count?(free(rr)?'عُبّئت الجزيرة':'عُبّئ الصف')+' · '+f(count)+' وحدات. '+(res.stats?.blockedCm>0?'تُرك '+cm(res.stats.blockedCm)+' للعوائق ومساحة الفتح. ':'')+(res.stats?.unfilledCm>0?'المتبقي دون عرض الخزانة: '+cm(res.stats.unfilledCm)+'. ':'')+'اختر وحدة لتخصيصها.':'أُنشئ الصف؛ لا تتسع المساحة المتاحة لوحدة.';
 commit(res,message,'run',true);
 }
 function foldSmallPalette(){if(win.matchMedia?.('(max-width:650px)')?.matches)q('.kit-palette').open=false;}
 function mode(next){contextMenu.close();if(tool!==next){ruler=null;testSource=testKitchen=null;factoryPreview=null;}foldSmallPalette();clearGhost();cancelGesture();orbit=false;inspectInteriorId=null;tool=next;opened=false;if(next==='test'){selected=null;layer='all';}else if(next==='run'||next==='unit'||next==='feature'){selected=null;layer=next==='run'?tier:next==='unit'?(kitchenUnitAllowed(unitKind,tier)?tier:(kitchenUnitSpecs[unitKind]?.tiers||['base'])[0]):'all';}
 else if(next==='select')layer='all';else if(next==='measure')selected=null;
 quickStamp='';panelStamp='';lastScene=null;paint();if(next==='run')note(runPlacement==='free'?'اسحب على الأرض لرسم الجزيرة وتعبئتها، أو أدخل مقاسها في الخصائص.':'اسحب على الجدار من بداية الصف إلى نهايته لتعبئته، أو أدخل المقاس في الخصائص.');if(next==='measure')note(view==='volume'?'اسحب من سطح ظاهر إلى سطح آخر لقياس المسافة.':'اسحب بين نقطتين في المسقط لقياس المسافة الأفقية.');if(next==='test')note('اختر واجهة من الصف العلوي أو السفلي لاختبار الفتح. يمكنك ترك أكثر من واجهة مفتوحة وملاحظة التداخل.');}
 function toggleUnit(u){
 if(!u)return;if(!kitchenUnitSpecs[u.kind]?.openable){note('هذا العنصر لا يملك واجهة قابلة للفتح.');return;}
 if(tool!=='test'){mode('test');setSelection('unit',u.id,false);}
 const k=current(),unit=k.units.find(item=>item.id===u.id);if(!unit)return;
 const out=updateUnit(k,room(),unit.id,{open:!unit.open});if(!out.ok){reject(out.reason);return;}
 testSource=getKitchen();testKitchen=out.kitchen;
 const clashes=geom(testKitchen,room()).conflicts||[];
 if(clashes.length)opened=true;
 panelStamp='';lastScene=null;paint();
 const message=(unit.open?'أُغلقت واجهة ':'فُتحت واجهة ')+uLabel(unit.kind)+' في معاينة الاختبار.';
 note(message+(clashes.length?' '+clashes.map(c=>c.label).filter(Boolean).join(' · '):''),clashes.length?'warn':undefined);
 }
 function volumePick(scene,q,layerKey=layer,intent=tool){
   if(!scene||!q)return null;
   if(intent==='test'){
     // Physical mesh first. Empty run guides, labels and hidden tier geometry
     // cannot intercept a click; the cabinet carcass owns its visible shelves.
     const h=scene.hitTest(q.x,q.z);if(!h)return null;
     if(h.part==='surface')return {kind:'surface',surface:h.surface,world:h.world};
     if(h.part==='fixture')return {kind:'feature',id:h.id,world:h.world};
     const uid=h.part==='module'?h.id:h.part==='worktop'?h.unitId:null,unit=uid&&scene.geometry.units.find(o=>o.id===uid);
     if(!unit||layerKey!=='all'&&unit.tier!==layerKey)return null;
     return {kind:'unit',id:unit.id,runId:unit.runId,world:h.world,material:h};
   }
   return pickVolume(scene,{x:q.x,y:q.z},{layer:layerKey,intent:['unit','feature','run'].includes(intent)?intent:'select'});

 }
 function pickAt(e,p,g,r,vhit=null){
 if(view==='volume'){
   const tag=e.target?.closest?.('[data-k-v-run]')||e.target?.closest?.('[data-k-island-tag]'),id=tag?.dataset.kId||tag?.dataset.kOwner||tag?.dataset.kVRun;
   if(tool!=='test'&&id&&g.runs.some(v=>v.id===id))return {kind:'run',id};
   return vhit?.id&&['unit','run','feature'].includes(vhit.kind)?{kind:vhit.kind,id:vhit.id}:null;
 }
 const opening=e.target?.closest?.('[data-k-wall-opening]')?.dataset.kWallOpening;
 if(opening&&tool==='select')return {kind:'feature',id:opening};
 const el=e.target?.closest?.('[data-k-id]');
 if(tool==='test'){
   const fixed=el?.dataset.kKind==='feature'?g.features.find(f=>f.id===el.dataset.kId):g.features.find(f=>inShape(p,f));if(fixed)return {kind:'feature',id:fixed.id};
   const u=testPlanUnit(g,p,layer);return u?{kind:'unit',id:u.id}:null;
 }
 if(el&&['unit','feature','run'].includes(el.dataset.kKind))return {kind:el.dataset.kKind,id:el.dataset.kId};
 const feature=[...g.features].reverse().find(x=>inShape(p,x));if(feature)return {kind:'feature',id:feature.id};
 const u=[...g.units].sort((a,b)=>(b.tier==='upper')-(a.tier==='upper')).find(x=>(layer==='all'||layer===x.tier)&&(inShape(p,x)||openParts(x).some(part=>inShape(p,part))));if(u)return {kind:'unit',id:u.id};const run=placeRun(g,r,p);return run?{kind:'run',id:run.run.id}:null;
 }
 function proposed(d,p,k,r,g){
 const w=d.wall,loc=d.run?kitchenRunLocal(r,d.run,p):w?kitchenWallLocal(r,w,p):null;
 if(d.kind==='run-depth'){
   const value=clamp(Math.round(10*(d.run.depth+loc.d-d.initialD))/10,15,150);
   const res=updateRun(k,r,d.run.id,{depth:value});
   const o={...d.run,depth:value,polygon:kitchenRunPolygon(r,d.run,d.run.start,d.run.end-d.run.start,value)};
   d.depthValue=value;return packageProposal(res,'run',o,r,k);
 }
 if(d.kind==='island-draw'){const dx=p.x-d.origin.x,dz=p.z-d.origin.z;d.draft={placement:'free',tier:'base',x:round(d.origin.x),z:round(d.origin.z),angle:adjustAngle(bearing(d.origin,p)),length:round(Math.hypot(dx,dz)),depth:freeDepth,start:0};d.draft=newRunSpec(d.draft);d.draft.end=d.draft.length;return addRun(k,r,d.draft);}
 if(d.kind==='island-move'||d.kind==='island-rotate'){const patch=d.kind==='island-move'?{dx:round(p.x-d.origin.x),dz:round(p.z-d.origin.z)}:{angle:adjustAngle(d.run.angle+bearing(d.pivot,p)-d.fromAngle)};
    const out=transformFreeRun(k,r,d.run.id,patch);if(!out.ok){const angle=patch.angle??d.run.angle,rad=angle*Math.PI/180,offX=(d.run.length*Math.cos(rad)-d.run.depth*Math.sin(rad))/2,offZ=(d.run.length*Math.sin(rad)+d.run.depth*Math.cos(rad))/2;d.draft={...d.run,angle,x:d.pivot.x+(patch.dx||0)-offX,z:d.pivot.z+(patch.dz||0)-offZ};}else d.draft=null;return out;}
 if(d.kind==='run'){const a=clamp(round(d.local),minU(r,w),span(r,w)),b=clamp(round(loc.u),minU(r,w),span(r,w));d.draft=newRunSpec({wall:w,start:Math.min(a,b),end:Math.max(a,b),tier,depth:wallDepth[tier],...(Number.isFinite(d.rowBottom)?{bottom:d.rowBottom}:{})});return addRun(k,r,d.draft);}
 if(d.kind==='resize'){
   const rawWidth=d.entity.width+loc.u-d.local;
   if(factoryMember(d.entity)){
     if(scoped)return {ok:false,reason:scopedRowReason};
     const doc=getProject(),widthMm=snapFactoryWidthMm(doc,d.entity.id,rawWidth*10),width=widthMm/10;
     if(d.factoryDoc===doc&&d.widthMm===widthMm)return d.result;
     d.factoryDoc=doc;d.widthMm=widthMm;
     const delta=widthMm-Math.round(d.entity.width*10),out=delta?previewKitchenWidthChange(doc,d.entity.id,delta,{withEffects:false,edge:'end'}):{ok:true,doc};
     return packageProposal({...out,kitchen:out.doc.kitchen},'unit',out.ok?{...d.entity,...out.doc.kitchen.units.find(u=>u.id===d.entity.id)}:{...d.entity,width},r,k);
   }
   const width=round(rawWidth);return packageProposal(updateUnit(k,r,d.entity.id,{width}),'unit',{...d.entity,width},r,k);}
 if(d.kind==='move-unit'){
   if(factoryMember(d.entity))return {ok:false,reason:scoped?scopedRowReason:'موضع الوحدة مرتبط بوصفة المصنع. افتح تخصيص وحدات هذا الصف لتعديل موضعها.'};
   const slot=d.scene?d.destinationRun&&{run:d.destinationRun}:placeRun(g,r,p,null,d.entity.tier),v=slot?.run||g.runs.find(v=>v.id===d.entity.runId),u=round(kitchenRunLocal(r,v,p).u-d.offset);
   return packageProposal(updateUnit(k,r,d.entity.id,{runId:v.id,u}),'unit',{...d.entity,runId:v.id,u},r,k);
 }
 if(d.kind==='move-feature'&&d.scene){
   const l=d.wallAim;if(!l)return null;const obj=d.entity,max=span(r,l.wall)-obj.width,patch={wall:l.wall,u:round(clamp(l.u-d.offset,minU(r,l.wall),max))};
   if(!['door','column','shaft'].includes(obj.kind))patch.bottom=round(clamp(l.bottom-d.verticalGrab,0,Math.max(0,r.height-obj.height)));d.featureCandidate={...obj,...patch};return packageProposal(updateFeature(k,r,obj.id,patch),'feature',{...obj,...patch},r,k);
 }
 if(d.kind==='move-feature'){const l=d.surveyed?{...kitchenWallLocal(r,d.wall,p),wall:d.wall}:nearest(r,p),patch={wall:l.wall,u:round(clamp(l.u-d.offset,minU(r,l.wall),span(r,l.wall)-d.entity.width))};d.featureCandidate={...d.entity,...patch};return packageProposal(updateFeature(k,r,d.entity.id,patch),'feature',{...d.entity,...patch},r,k);}
 return null;
 }
 const previewShape=(subject,o,r,k)=>{
   if(!o)return null;
   if(subject==='feature'){
     const spec=kitchenFeatureSpecs[o.kind];if(!spec||!architectureWall(r,o.wall))return null;
     const u=o.u,w=o.width??spec.width,d=o.depth??spec.depth,bottom=o.bottom??spec.bottom,height=o.height??spec.height;
     if(![u,w,d,bottom,height].every(Number.isFinite)||Math.min(w,d,height)<=0)return null;
     return {kind:o.kind,name:featLabel(o.kind),wall:o.wall,polygon:kitchenRunPolygon(r,{wall:o.wall},u,w,d),bottom,height};
   }
   if(subject==='unit'){
     const run=k.runs.find(v=>v.id===o.runId);if(!run||![o.u,o.width].every(Number.isFinite)||o.width<=0)return null;
     return {kind:o.kind,name:uLabel(o.kind),polygon:kitchenRunPolygon(r,run,o.u,o.width,kitchenUnitSpecs[o.kind]?.depth??run.depth),bottom:run.bottom,height:kitchenUnitSpecs[o.kind]?.height??run.height};
   }
   if(subject==='run'&&o.polygon?.length)return {kind:'run',name:runName(o),polygon:o.polygon,bottom:o.bottom,height:o.height};
   return null;
 };
 const packageProposal=(res,subject,o,r,k)=>({...res,preview:previewShape(subject,o,r,k)});
 function clearGhost(){
   if(hoverFrame)win.cancelAnimationFrame(hoverFrame);hoverFrame=0;hoverEvent=null;lastOver=null;placementCache=null;ghost=null;ghostStamp='';
   if(previewLayer?.innerHTML)previewLayer.innerHTML='';if(previewNote){previewNote.hidden=true;previewNote.textContent='';}
 }
 function showGhost(res,detail='',quiet=false){
   if(!res?.preview){ghost=null;ghostStamp='';if(previewLayer?.innerHTML)previewLayer.innerHTML='';if(previewNote){const t=res&&!res.ok?res.reason||'اختر موضعًا صالحًا.':'';previewNote.hidden=!t;if(t){previewNote.dataset.state='blocked';if(previewNote.textContent!==t)previewNote.textContent=t;}}return;}
   let why=res.reason||'';
   if(!res.ok&&res.conflict?.ids){const k=current(),ids=new Set(res.conflict.ids.filter(v=>v!==res.attemptedId)),v=k.features.find(f=>ids.has(f.id))||k.units.find(u=>ids.has(u.id))||k.runs.find(run=>ids.has(run.id));
     if(v)why='يتداخل الموضع مع '+(kitchenFeatureSpecs[v.kind]?.label||kitchenUnitSpecs[v.kind]?.label||runName(v))+(v.wall?' على '+wn(v.wall):'')+'.';
   }
   ghost={shape:res.preview,ok:res.ok,reason:why,detail,quiet,conflict:res.conflict};paintGhost();
 }
 function paintGhost(){
   if(!visible||dead||!previewLayer||!ghost)return;
   const {shape:S,ok,reason,conflict,detail,quiet}=ghost;if(!S?.polygon?.length)return;
   const key=[view,camera.yaw,camera.pitch,S.kind,S.bottom,S.height,...S.polygon.map(ap),ok,reason,detail,quiet,conflict?.id].join('|');if(key===ghostStamp)return;ghostStamp=key;
   const paint=ok?'#18744d':'#b6382d',state=ok?'valid':'blocked',mark='data-k-proposal="'+state+'" data-k-proposal-kind="'+esc(S.kind)+'"',contract=' vector-effect="non-scaling-stroke" stroke-linejoin="round" pointer-events="none"';
   const draw=(s,blocked=false)=>{const poly=s.polygon;if(!Array.isArray(poly)||poly.length<3)return '';
     const color=blocked?'#a22e27':paint,fill=blocked?'.28':'.24',st=' stroke="'+color+'" '+contract;
     if(view==='top')return '<polygon points="'+poly.map(ap).join(' ')+'" fill="'+color+'" fill-opacity="'+fill+'" stroke-width="'+(blocked?'1.25':'2.7')+'"'+st+'/>';
     const P=vol?.projection;if(!P)return '';const y=room().height-s.bottom,a=poly.map(p=>P.project(p.x,y-s.height,p.z)),b=poly.map(p=>P.project(p.x,y,p.z)),fmt=pts=>pts.map(p=>n(p.x)+','+n(p.y)).join(' '),edges=a.map((p,i)=>'M'+n(p.x)+' '+n(p.y)+'L'+n(b[i].x)+' '+n(b[i].y)).join('');
     const front=poly.length===4?[a[2],a[3],b[3],b[2]]:a;
     return '<polygon points="'+fmt(front)+'" fill="'+color+'" fill-opacity="'+fill+'" stroke-width="'+(blocked?'1.3':'2.4')+'"'+st+'/>'+
       '<polygon points="'+fmt(a)+'" fill="'+color+'" fill-opacity=".12" stroke-width="1.35"'+st+'/>'+
       '<polygon points="'+fmt(b)+'" fill="none" stroke-width="1" stroke-dasharray="4 2"'+st+'/>'+
       '<path d="'+edges+'" fill="none" stroke-width="1.15"'+st+'/>';
   };
   const patches=!ok?(conflict?.patches||[]).slice(0,3):[];previewLayer.innerHTML='<g '+mark+'>'+draw(S)+patches.map(o=>draw(o,true)).join('')+'</g>';
   if(previewNote){const text=detail||S.name+' · '+(ok?'موضع متاح':reason||'هذا الموضع غير متاح');previewNote.hidden=quiet;previewNote.dataset.state=state;if(previewNote.textContent!==text)previewNote.textContent=text;}
 }
 function enqueueHover(e){
   if(!visible||dead||orbit||gesture||!['feature','unit'].includes(tool)||e.buttons!==0||e.pointerType==='touch'||e.isPrimary===false)return;
   hoverEvent={clientX:e.clientX,clientY:e.clientY};if(hoverFrame)return;
   hoverFrame=win.requestAnimationFrame(()=>{hoverFrame=0;const ev=hoverEvent;hoverEvent=null;if(!ev||!visible||dead||gesture||orbit)return;
     const k=current();if(lastOver?.k===k&&Math.hypot(lastOver.x-ev.clientX,lastOver.y-ev.clientY)<1.25)return;
     lastOver={k,x:ev.clientX,y:ev.clientY};const q=pointEvent(ev),r=room();if(!q){clearGhost();return;}
     const result=placementAt(k,r,geom(k,r),view==='volume'?vol:null,q);showGhost(result);
   });
 }
 // Coordinates use the room model throughout: x/z lie in the floor and +y
 // points down. A camera change only re-projects the retained endpoints.
 function measureValues(a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;return {distance:Math.hypot(dx,dy,dz),horizontal:Math.hypot(dx,dz),vertical:Math.abs(dy)};}
 function measureText(a,b){const v=measureValues(a,b);return 'المسافة '+cm(v.distance)+(v.vertical>.05?' · أفقي '+cm(v.horizontal)+' · رأسي '+cm(v.vertical):'');}
 function measureHit(scene,q,r){
   if(!q)return null;
   if(!scene)return architectureContains(r,q)?{x:q.x,y:r.height,z:q.z,part:'floor',label:'المسقط'}:null;
   const h=scene.hitTest(q.x,q.z),w=h?.world;if(!w||![w.x,w.y,w.z].every(Number.isFinite)||h.part==='surface'&&h.surface==='floor'&&(!architectureContains(r,w)||h.buildingSide&&h.buildingSide!=='interior'))return null;
   return {x:w.x,y:w.y,z:w.z,part:h.part,label:h.part==='surface'?wn(h.surface):h.part==='fixture'?featLabel(h.kind):h.part==='worktop'?'سطح العمل':uLabel(h.kind)};
 }
 function paintRuler(){
   if(!rulerLayer)return;const active=gesture?.kind==='measure'?{a:gesture.a,b:gesture.b}:ruler,output=tool==='measure'?q('[data-k-measure-output]'):null;
   if(tool!=='measure'||!active?.a){if(rulerLayer.innerHTML)rulerLayer.innerHTML='';if(output)output.textContent=view==='volume'?'اسحب بين سطحين ظاهرين.':'اسحب بين نقطتين في المسقط.';return;}
   const a=active.a,b=active.b,p=w=>view==='volume'?vol?.projection.project(w.x,w.y,w.z):{x:w.x,y:w.z},A=p(a),B=b&&p(b);if(!A)return;
   const M=svg.getScreenCTM?.(),px=1/(M&&Math.hypot(M.a,M.b)||1),xy=P=>n(P.x)+','+n(P.y);
   const pin=(P,l)=>'<g transform="translate('+xy(P)+')"><circle r="'+n(4.8*px)+'" fill="#fff6d6" stroke="#174b4e" stroke-width="'+n(1.8*px)+'"/><text x="'+n(7*px)+'" y="'+n(-7*px)+'" text-anchor="middle" fill="#123c3c" paint-order="stroke" stroke="#fff9e8" stroke-width="'+n(2*px)+'" font-family="Tahoma,Arial" font-size="'+n(11*px)+'">'+l+'</text></g>';
   let html=pin(A,'أ');
   if(B){const v=measureValues(a,b),span=Math.hypot(B.x-A.x,B.y-A.y),projectedOnly=view==='top'&&v.vertical>.05;
     const detail=projectedOnly?'أفقي '+cm(v.horizontal):cm(v.distance),cx=(A.x+B.x)/2,cy=(A.y+B.y)/2-(span<20*px?20:10)*px,boxW=(18+detail.length*7.4)*px,h=21*px;
     const points='x1="'+n(A.x)+'" y1="'+n(A.y)+'" x2="'+n(B.x)+'" y2="'+n(B.y)+'"';
     html='<line '+points+' stroke="#fbf9dd" stroke-width="'+n(4.2*px)+'"/><line '+points+' stroke="#1a6662" stroke-width="'+n(2*px)+'" stroke-dasharray="'+n(6*px)+' '+n(2.5*px)+'"/>'+html+(span>9*px?pin(B,'ب'):'')+
       '<g transform="translate('+n(cx)+' '+n(cy)+')"><rect x="'+n(-boxW/2)+'" y="'+n(-h/2)+'" width="'+n(boxW)+'" height="'+n(h)+'" rx="'+n(4*px)+'" fill="#164c48"/><text direction="rtl" text-anchor="middle" dominant-baseline="middle" fill="#fff9e8" font-family="Tahoma,Arial" font-weight="600" font-size="'+n(12*px)+'">'+esc(detail)+'</text></g>';
     if(output)output.textContent=measureText(a,b);
   }else if(output)output.textContent='اختر نقطة النهاية على سطح ظاهر.';
   rulerLayer.innerHTML='<g data-k-ruler="" pointer-events="none">'+html+'</g>';
 }
 const cssPoint=q=>({x:q.x,y:q.z});
 const finiteWorld=w=>!!w&&[w.x,w.y,w.z].every(Number.isFinite);
 function placementAt(k,r,g,scene,q){
   if(!scene&&!architectureContains(r,q))return {ok:false,reason:'هذه النقطة خارج حدود الغرفة الفعلية.'};
   let spec,subject=tool,obscured='';
   if(tool==='feature'){
     const type=kitchenFeatureSpecs[featKind],w=defaultWidth(type,6),h=type.height??6,base=['door','column','shaft'].includes(featKind);
     let at;
     if(scene){
       const hit=scene.hitTest(q.x,q.z);
       if(hit?.part==='surface'&&(!hit.buildingSide||hit.buildingSide==='interior')&&architectureWall(r,hit.surface)&&scene.visibleSurfaces.includes(hit.surface)&&finiteWorld(hit.world)){
         at=onWall(scene,cssPoint(q),{wall:hit.surface,locked:true});if(at&&(at.u<minU(r,hit.surface)-.001||at.u>span(r,hit.surface)+.001||at.bottom<-.001||at.bottom>r.height+.001))at=null;
       }
       // A visible architectural fixture owns its wall. If that face covers
       // the pointer, still show the exact rejected prism; never click through
       // a freestanding island or an unrelated / hidden wall.
       if(!at){const wall=hit?.wall;
         if(hit?.part!=='surface'&&architectureWall(r,wall)&&scene.visibleSurfaces.includes(wall)){
           at=onWall(scene,cssPoint(q),{wall,locked:true});
           if(at&&(at.u<minU(r,wall)||at.u>span(r,wall)||at.bottom<0||at.bottom>r.height))at=null;
           if(at)obscured=hit.part==='fixture'?'تجهيز ثابت يحجب موضع الجدار هنا.':'اختر جزءًا مكشوفًا من الجدار؛ الوحدة تحجب هذه النقطة.';
         }
       }
       if(!at)return {ok:false,reason:'اختر وجه جدار ظاهرًا في الغرفة. دوّر المشهد إذا كان الموضع محجوبًا.'};
     }else{at=nearest(r,q);if(at.dist>Math.min(r.width,r.length)*.22)return {ok:false,reason:'اختر موضع التجهيز بمحاذاة أحد الجدران.'};}
     const bottom=scene&&!base?round(clamp(at.bottom-h/2,0,Math.max(0,r.height-h))):type.bottom??0;
     spec={kind:featKind,wall:at.wall,u:round(clamp(at.u-w/2,minU(r,at.wall),Math.max(minU(r,at.wall),span(r,at.wall)-w))),bottom,width:w};
   }else{
     let run,uHit;
     if(scene){const picked=volumePick(scene,q,layer,'unit'),runId=picked?.runId||(picked?.kind==='run'?picked.id:null);run=g.runs.find(v=>v.id===runId);
       if(!run||!finiteWorld(picked?.world))return {ok:false,reason:'اختر الجزء المتاح من الصف المظلّل. أدر المشهد لرؤية الصف إذا حجبه لوح أو جهاز.'};
       if(layer!=='all'&&layer!==run.tier||!kitchenUnitAllowed(unitKind,run))return {ok:false,reason:'هذا صف من طبقة أخرى. اختر صفًا مناسبًا للوحدة أو غيّر الطبقة.'};
       uHit=Number.isFinite(picked.u)?picked.u:kitchenRunLocal(r,run,picked.world).u;
     }else{const hit=placeRun(g,r,q,unitKind);if(!hit)return {ok:false,reason:'انقر داخل المساحة المظلّلة لصف قائم، أو ارسم صفًا أولًا.'};run=hit.run;uHit=hit.l.u;}
     const w=wantWidth??defaultWidth(kitchenUnitSpecs[unitKind],60);
     spec=newUnitSpec({runId:run.id,kind:unitKind,width:w,u:round(clamp(uHit-w/2,run.start,Math.max(run.start,run.end-w)))});
   }
   const key=[roomArchitecture(r).key,subject,obscured,...Object.values(spec)].join('|');if(placementCache?.k===k&&placementCache.key===key)return placementCache.result;
   let out=subject==='feature'?addFeature(k,r,spec):addUnit(k,r,spec);
   if(obscured&&out.ok)out={ok:false,changed:false,kitchen:k,reason:obscured,code:'occluded-wall'};
   const result=packageProposal(out,subject,spec,r,k);placementCache={k,key,result};return result;
 }
 function volumeDestination(d,q,r,g){
   const scene=d.scene,at=cssPoint(q);
   if(d.kind==='run-depth')return onRunAxis(scene,at,d.run,d.anchor,'d');
   if(d.kind==='run'){const w=onWall(scene,at,{wall:d.wall,locked:true});return w?.world||null;}
   if(d.kind==='move-feature'){
     const visible=d.surveyed?null:onWall(scene,at),w=visible&&visible.wall!==d.wall?visible:onWall(scene,at,{wall:d.wall,offset:d.mountOffset,locked:true});
     d.wallAim=w;return w?.world||null;
   }
   if(d.kind==='move-unit'){
     d.destinationRun=null;const pick=volumePick(scene,q,d.entity.tier,'unit'),destId=pick?.runId||(pick?.kind==='run'?pick.id:null),dest=g.runs.find(v=>v.id===destId);
     if(dest?.tier===d.entity.tier&&dest.id!==d.run.id&&finiteWorld(pick.world)){d.destinationRun=dest;return pick.world;}
   }
   const world=onHorizontal(scene,at,d.planeY);
   if(world)return world;
   if(['resize','move-unit'].includes(d.kind)&&d.run&&d.anchor)return onRunAxis(scene,at,d.run,d.anchor);
   return null;
 }
 function beginVolume(e,q,k,r,g){
   const scene=vol;if(!scene)return null;
   const qv=cssPoint(q),grip=e.target?.closest?.('[data-k-handle]'),tag=e.target?.closest?.('[data-k-v-run]')||e.target?.closest?.('[data-k-island-tag]');
   const face=onInspectPart&&!grip&&!tag&&(tool==='select'||orbit)?scene.hitTest(qv.x,qv.y):null;
   const direct=cadPartTarget(face,g,layer),orbitDrag=()=>({kind:'orbit',cam:{...camera},s:null});
   if(orbit){const hit=volumePick(scene,q,layer,'select');return {...orbitDrag(),s:pickAt(e,q,g,r,hit),pointId:hit?.sitePointId,inspect:direct};}
   if(tool==='measure'){const a=measureHit(scene,q,r);if(!a){note('ابدأ القياس على سطح ظاهر في الغرفة.','warn');return null;}return {kind:'measure',scene,a,b:null};}
   if(tool==='run'){
     if(runPlacement==='free'){const f=scene.hitTest(qv.x,qv.y);if(f?.part!=='surface'||f.surface!=='floor'||f.buildingSide&&f.buildingSide!=='interior'||!finiteWorld(f.world)||!architectureContains(r,f.world)){note('ابدأ على جزء ظاهر من الأرضية، ثم اسحب لرسم حافة الجزيرة.','warn');return null;}
        return {kind:'island-draw',origin:f.world,anchor:f.world,planeY:r.height,scene};}
     const w=onWall(scene,qv);if(!w){note('ابدأ على وجه جدار ظاهر، ثم اسحب بمحاذاته. لا يمكن الرسم من خلف وحدة.','warn');return null;}
     return {kind:'run',wall:w.wall,local:w.u,anchor:w.world,scene,rowBottom:tier==='upper'?round(clamp(w.bottom,0,Math.max(0,r.height-(activeNew?.upperHeight??70)))):0};
   }
   if(tool==='unit'||tool==='feature')return {kind:'place',scene,anchor:null};
   const vh=volumePick(scene,q,layer,tool),s=pickAt(e,q,g,r,vh),ent=lookup(g,s),part=grip?.dataset.kHandle;
   if(tool==='select'&&vh?.sitePointId&&!grip)return {kind:'site-point',pointId:vh.sitePointId,scene,anchor:vh.world,planeY:vh.world?.y};
   if(tool==='select'&&part==='run-depth'&&selected?.kind==='run'){
     const run=lookup(g);if(!run||run.id!==grip.dataset.kOwner||!run.wall||(layer!=='all'&&layer!==run.tier))return null;
     const anchor={x:Number(grip.dataset.kX),y:Number(grip.dataset.kY),z:Number(grip.dataset.kZ)};
     const start=finiteWorld(anchor)&&onRunAxis(scene,qv,run,anchor,'d');
     if(!start){note('دوّر المشهد قليلًا ليظهر اتجاه عمق الصف.','warn');return null;}
     return {kind:'run-depth',s:selected,entity:run,run,scene,anchor,initialD:start.d};
   }
   if(tool==='select'&&grip&&['width','island-move','island-rotate'].includes(part)){
     const u=selected?.kind==='unit'?lookup(g):null,run=part==='width'?g.runs.find(v=>v.id===u?.runId):selected?.kind==='run'?lookup(g):null;
     if(!run||grip.dataset.kOwner!==(part==='width'?u?.id:run.id)||part==='width'&&!resizable(u)||part!=='width'&&!free(run))return null;
     const art={x:Number(grip.dataset.kX),y:Number(grip.dataset.kY),z:Number(grip.dataset.kZ)};if(!finiteWorld(art))return null;
     const anchor=onHorizontal(scene,qv,art.y)||(part==='width'?onRunAxis(scene,qv,run,art):null);
     if(!anchor){note('لا يظهر اتجاه المقبض بوضوح من هذه الزاوية. دوّر المشهد قليلًا ثم اسحب.','warn');return null;}
     const pivot=kitchenRunPoint(r,run,run.length/2,run.depth/2);
     return {kind:part==='width'?'resize':part,s:selected,entity:u||run,run,local:kitchenRunLocal(r,run,anchor).u,origin:anchor,fromAngle:part==='island-rotate'?bearing(pivot,anchor):null,pivot,scene,planeY:art.y,anchor:{...anchor,y:art.y}};
   }
   if(direct&&(face.part!=='module'||face.tag==='base-apron')&&!(face.part==='surface'&&s?.kind==='run'))return {...orbitDrag(),inspect:direct};
   if(!s||!ent){
     const physical=scene.hitTest(qv.x,qv.y);
     if((tool==='select'||tool==='test')&&(!physical||physical.part==='surface'))return orbitDrag();
     if(tool==='select'||tool==='test')note('لا يمكن اختيار عنصر مخفي خلف العنصر الظاهر. غيّر الطبقة أو اتجاه النظر.','warn');
     return null;
   }
   const run=s.kind==='run'?ent:g.runs.find(v=>v.id===ent.runId),vplane=run?r.height-run.bottom-run.height:null;
   let origin=vh?.world;if(tag&&s.kind==='run'&&run){
     const ty=Number(tag.dataset.kY),plane=Number.isFinite(ty)?ty:vplane;
     origin=onHorizontal(scene,qv,plane)||{...kitchenRunPoint(r,run,(run.start+run.end)/2,run.depth*.5),y:plane};
   }
   if(!finiteWorld(origin))return null;const common={s,inspect:direct,entity:ent,run,scene,anchor:origin,planeY:origin.y,origin,wall:ent.wall};
   if(tool==='test')return {...common,kind:'pick'};
   if(s.kind==='unit'&&run){const loc=kitchenRunLocal(r,run,origin);return {...common,kind:'move-unit',local:loc.u,offset:loc.u-ent.u};}
   if(s.kind==='feature'){const loc=kitchenWallLocal(r,ent.wall,origin);return {...common,kind:'move-feature',local:loc.u,offset:loc.u-ent.u,mountOffset:loc.d,verticalGrab:r.height-origin.y-ent.bottom};}
   if(free(run)){const pivot=kitchenRunPoint(r,run,run.length/2,run.depth/2);return {...common,kind:'island-move',pivot};}
   return {...common,kind:'pick'};
 }
 function armPointer(e,d,k,q){
   clearGhost();gesture={...d,k,source:getProject?.(),surveyed:d.kind==='move-feature'&&linkedReadingIndex(getRoom?.()||room(),d.entity)>=0,id:e.pointerId,cx:e.clientX,cy:e.clientY,threshold:e.pointerType==='touch'?8:4,q,lastQ:q,last:d.origin||d.anchor||q,moved:false};
   try{svg.setPointerCapture(e.pointerId);}catch{}svg.focus?.({preventScroll:true});e.preventDefault();
   if(d.kind==='measure')paintRuler();
   if(d.kind==='place'){const r=room();showGhost(placementAt(k,r,geom(k,r),d.scene||null,q));}
 }
 const withinCanvas=e=>{const b=svg.getBoundingClientRect?.();return !b||!Number.isFinite(b.right)||e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom;};
 function readDrag(d,e){
 if((d.kind==='place'||d.kind==='run-depth'||d.kind==='site-point'||d.kind==='move-feature')&&!withinCanvas(e)){d.outsideStage=true;d.result=null;clearGhost();return;}d.outsideStage=false;
 if(d.k!==current()){cancelGesture();return;}const q=pointEvent(e);if(!q){d.result=null;return;}d.lastQ=q;
 const dx=e.clientX-d.cx,dy=e.clientY-d.cy;if(!d.moved&&Math.hypot(dx,dy)<d.threshold)return;d.moved=true;root.dataset.kDrag=d.kind;
 if(d.kind==='inspect-part')return;
 if(d.kind==='measure'){d.b=withinCanvas(e)?measureHit(d.scene||null,q,room()):null;paintRuler();return;}
 if(d.kind==='orbit'){camera={yaw:(d.cam.yaw+dx*.4+3600)%360,pitch:clamp(d.cam.pitch+dy*.26,-60,72)};drawSoon();return;}
 const r=room(),g=geom(d.k,r);
 if(d.kind==='site-point'){
  if(!d.source||!onCommitProject)return;
  const original=d.source.room.sitePoints?.find(v=>v.id===d.pointId);
  const start=d.anchor||d.q,target=d.scene?onHorizontal(d.scene,cssPoint(q),d.planeY):q;
  if(!original||!target){d.siteMove=null;clearGhost();return;}
  const cm=v=>Math.round(v*10)/10,point={...original,x:cm(original.x+target.x-start.x),z:cm(original.z+target.z-start.z)};
  const changedRoom={...d.source.room,sitePoints:d.source.room.sitePoints.map(v=>v.id===point.id?point:v)};
  const checked=checkSitePoints(changedRoom);
  d.siteMove={...checked,room:changedRoom};
  const h=point.size/2,polygon=[{x:point.x-h,z:point.z-h},{x:point.x+h,z:point.z-h},{x:point.x+h,z:point.z+h},{x:point.x-h,z:point.z+h}];
  showGhost({...checked,preview:{kind:point.kind,name:pointTypes[point.kind],polygon,bottom:0,height:1}},'من اليسار '+f(point.x*10)+' مم · من الخلف '+f(point.z*10)+' مم');return;
 }
 if(d.scene&&d.kind==='pick')return;
 if(d.kind==='place'){
   d.result=placementAt(d.k,r,g,d.scene||null,q);d.last=q;showGhost(d.result);return;
 }
 const pt=d.scene?volumeDestination(d,q,r,g):q;
 if(!pt){showGhost(null);d.result=null;d.draft=null;d.invalid=true;d.notice='هذا السحب لا يحدّد موضعًا صالحًا من زاوية النظر الحالية. دوّر المشهد ثم أعد المحاولة.';note(d.notice,'warn');drawSoon();return;}
 d.invalid=false;d.last=pt;d.result=proposed(d,pt,d.k,r,g);
 if(d.result){
   d.block=null;let obstacle='';
   if(!d.result.ok&&d.kind==='resize'){
     const u=d.entity,run=g.runs.find(v=>v.id===u.runId),next=g.units.filter(v=>v.runId===u.runId&&(!run?.autoFill||v.fillRole!=='auto')&&v.u>=u.u+u.width-.01&&v.id!==u.id).sort((a,b)=>a.u-b.u)[0],limit=next?.u??run.end,after=Math.max(0,limit-u.u-u.width);
     if(d.result.code==='unit-overlap'||d.result.code==='unit-bounds'){
       d.block={run:g.runs.find(v=>v.id===u.runId),depth:u.depth,limit,item:next};
       obstacle=' '+(next?'أول عائق: '+uLabel(next.kind):'العائق: نهاية الصف')+'. أكبر عرض متاح من هذه البداية '+cm(u.width+after)+'.';
     }
   }
   const c=d.result.ok&&d.kind==='resize'?geom(d.result.kitchen,r).units.find(v=>v.id===d.entity.id):null;
   const text=!d.result.ok?d.result.reason+obstacle:d.factoryDoc?'العرض '+f(d.widthMm)+' مم · أفلت لمراجعة أثره على صف المصنع.':d.kind==='run-depth'?'عمق الصف ال'+tierName(d.run.tier)+' '+cm(d.depthValue)+'.':d.kind==='resize'&&c&&d.run?.autoFill?'العرض '+cm(c.width)+' · يتكيّف باقي الصف.':d.kind==='resize'&&c?'العرض '+cm(c.width)+' · تغيّر الفراغ بعد الوحدة من '+cm(d.entity.clearance?.after||0)+' إلى '+cm(c.clearance?.after||0)+'.':d.kind==='island-draw'?'جزيرة · طول '+cm(d.draft.length)+' × عمق '+cm(freeDepth)+' · زاوية '+f(d.draft.angle)+'°.':d.kind==='island-rotate'||d.kind==='island-move'?(d.result.reason||'الجزيرة ووحداتها تتحرك معًا. زاوية '+f(d.result.kitchen.runs.find(v=>v.id===d.run.id)?.angle??d.run.angle)+'°.'):d.kind==='run'?'صف '+tierName(tier)+' · '+wn(d.wall)+' · الطول '+cm(d.draft.end-d.draft.start)+'.':'أفلت لاعتماد الموضع.';
   d.notice=text;if(d.result.preview)showGhost(d.result,d.kind==='run-depth'||d.kind==='resize'&&(d.result.ok||obstacle)?text:'');else note(text,d.result.ok?'':'warn');drawSoon();
 }
 }
 // Resolve actions against the same visible geometry as a normal selection.
 // Merely opening a menu must not select, place or commit anything.
 function pendingInspector(){
   if(!opened||panel.hidden)return null;
   const field=[...body.querySelectorAll('form input,form select')].find(input=>
     input.tagName==='SELECT'
       ? input.selectedIndex!==Math.max(0,[...input.options].findIndex(option=>option.defaultSelected))
       : input.value!==input.defaultValue);
   return field||(factoryPreview?body.querySelector('[data-k-act="confirm-factory-width"],[data-k-act="cancel-factory-width"]'):null);
 }
 function retainPendingInspector(){
   const field=pendingInspector();if(!field)return false;
   note('طبّق تعديل الخصائص أو أغلقها قبل الانتقال إلى أداة أخرى.','warn');field.focus();return true;
 }
 // Use the foremost actual plan mark. Clear floor behind an empty row still
 // belongs to that row's placement outline.
 function planPartAt(e,p,g,r){
   const mark=selector=>e.target?.closest?.(selector)?.dataset;
   const wall=mark('[data-k-wall-hit]'),accessory=mark('[data-k-accessory]'),stone=mark('[data-k-stone-run]'),corner=mark('[data-corner-solid]');
   let hit;
   const basin=mark('[data-k-basin]');
   if(basin)hit={part:'module',id:basin.kBasin,kind:'sink',tag:'sink-bottom'};
   else if(wall)hit={part:'surface',surface:wall.kWallHit};
   else if(corner)hit={part:'corner',id:corner.cornerSolid};
   else if(stone)hit={part:'worktop',id:stone.kStonePiece,runId:stone.kStoneRun};
   else if(accessory)hit={part:'fixture',id:accessory.kAccessory,kind:accessory.kRole,wall:accessory.kWall,sectionId:accessory.kSection};
   else if(mark('[data-k-floor]')&&!pickAt(e,p,g,r))hit={part:'surface',surface:'floor'};
   return cadPartTarget(hit,g,layer);
 }
 function inspectPicked(t){
   if(t.route==='room-dimension'){onRoomDimensions?.(t.focus.dimension);return;}
   const f=t.focus,feature=f.featureId||f.windowId,unit=f.unitId||f.sinkId;
   orbit=false;
   if(t.route==='worktop')setSelection('run',f.runId,false);
   else if(unit)setSelection('unit',unit,false);
   else if(f.runId)setSelection('run',f.runId,false);
   else if(feature)setSelection('feature',feature,false);
   else setSelection(null);
   paint();onInspectPart?.(t.route,f);
 }
 function drawingActions(event){
   if(!visible||dead||host.inert||host.closest?.('[inert]'))return null;
   const draft=pendingInspector();
   if(draft)return {title:'تعديل في الخصائص لم يُحسم',actions:[{label:'متابعة التعديل الحالي',run:()=>draft.focus()}]};
   const k=current(),r=room(),g=geom(k,r),source=getRoom?.()||r,p=pointEvent(event);
   const hit=view==='volume'&&p?volumePick(vol,p,layer,tool==='test'?'test':'select'):null;
   const grip=event.target?.closest?.('[data-k-handle]');
   const owner=grip&&selected?.id===grip.dataset.kOwner?selected:null;
   const picked=event.keyboard?selected:owner||(p?pickAt(event,p,g,r,hit):null);
   const item=lookup(g,picked);
   const pointId=!event.keyboard&&(event.target?.closest?.('[data-k-site-point]')?.dataset.kSitePoint||hit?.sitePointId);
   const actions=[],activeTool=tool,activeView=view,orbiting=orbit;
   const add=(label,run)=>actions.push({label,run:()=>{
     if(!visible||dead||host.inert||host.closest?.('[inert]')||k!==current()||source!==(getRoom?.()||room())||activeTool!==tool||activeView!==view||orbiting!==orbit)return;
     run();
   }});
   const inspect=selector=>{
     if(!inspectItem(picked.kind,picked.id))return;
     const field=selector&&body.querySelector(selector);
     if(field){field.focus();field.select?.();}
   };
   if(orbit){
     add('زاوية البداية',()=>{camera={yaw:32,pitch:25};lastScene=null;paint();});
     add('إنهاء تدوير المنظر',()=>{orbit=false;quickStamp='';lastScene=null;paint();});
     return {title:'تدوير المنظور',actions};
   }
   if(tool==='measure'){
     const at=!event.keyboard&&p?measureHit(view==='volume'?vol:null,p,r):null;
     if(at)add(ruler&&!ruler.b?'نهاية القياس هنا':'بداية القياس هنا',()=>{
       ruler=ruler&&!ruler.b?{a:ruler.a,b:at}:{a:at,b:null};quickStamp='';paint();
       note(ruler.b?measureText(ruler.a,ruler.b):'حدّد نهاية القياس على الرسم.');
     });
     if(ruler)add('مسح القياس',()=>{ruler=null;quickStamp='';paint();});
     if(!actions.length)add('إظهار الرسم كاملًا',()=>viewport.reset());
     return {title:'قياس مسافة',actions};
   }
   if(tool==='test'){
     if(picked?.kind==='unit'&&kitchenUnitSpecs[item?.kind]?.openable)add(item.open?'إغلاق الواجهة في الاختبار':'فتح الواجهة في الاختبار',()=>{setSelection('unit',item.id,false);toggleUnit(item);});
     add('عرض نتائج التداخلات',()=>{opened=true;panelStamp='';paint();});
     if(testKitchen)add('إعادة الاختبار من التصميم المحفوظ',()=>{testSource=testKitchen=null;selected=null;lastScene=null;panelStamp='';paint();});
     return {title:'اختبار فتح الواجهات',actions};
   }
   if(['unit','feature','run'].includes(tool)){
     const label=tool==='unit'?uLabel(unitKind):tool==='feature'?featLabel(featKind):runPlacement==='free'?'الجزيرة':'الصف';
     if(tool!=='run'&&p&&!event.keyboard){
       const placement=placementAt(k,r,g,view==='volume'?vol:null,p);
       if(placement.ok)add('إضافة '+label+' هنا',()=>commit(placement,'أُضيفت القطعة في الموضع المحدد.',tool));
       else add('سبب تعذّر الإضافة هنا',()=>{note(placement.reason,'warn');showGhost(placement,'',true);});
     }
     add('إدخال أبعاد '+label,()=>{selected=null;opened=true;panelStamp='';paint();body.querySelector('form input,form select')?.focus();});
     return {title:'إضافة '+label,actions};
   }
   if(pointId&&onSurveyPoint&&r.sitePoints?.some(v=>v.id===pointId)){
     add('مراجعة قياس نقطة الأرضية',()=>onSurveyPoint(pointId));
     return {title:'نقطة في الأرضية',actions};
   }
   if(onInspectPart&&!event.keyboard&&!grip&&p){
     const actual=view==='top'?planPartAt(event,p,g,r):cadPartTarget(vol?.hitTest(p.x,p.z),g,layer);
     if(actual&&!(actual.route==='survey'&&picked?.kind==='run'))add('تحرير الجزء المشار إليه',()=>inspectPicked(actual));
   }
   if(item&&picked.kind==='unit'){
     if(scoped&&factoryMember(item)&&onLayouts)add('مراجعة بدائل الصف على الخادم',scopedLayouts);
     if(resizable(item))add('تعديل عرض الوحدة',()=>inspect(factoryMember(item)?'[name="widthMm"]':'[data-k-form="unit"] [name="width"]'));
     else add('مقاسات الوحدة ومواصفاتها',()=>inspect());
     if(kitchenUnitSpecs[item.kind]?.openable)add(item.open?'إغلاق الواجهة':'اختبار فتح الواجهة',()=>{
       selectUnit(item.id,{open:false});toggleUnit(item);
     });
     if(onEditUnit&&kitchenUnitSpecs[item.kind]?.editableInterior)add('تعديل التقسيم الداخلي',()=>onEditUnit(item.id));
     add('اختيار الصف كاملًا',()=>inspectItem('run',item.runId));
   }else if(item&&picked.kind==='feature'){
     if(onSurveyReading&&linkedReadingIndex(source,item)>=0)add('تصحيح قياس الزيارة',()=>onSurveyReading(item.wall,item.id));
     add('مقاسات '+featLabel(item.kind),()=>inspect('[name="width"]'));
     const photo=onReadingPhoto&&wallPhotoForFeature(source,item.id);
     if(photo)add('صورة القياس الأصلية',()=>onReadingPhoto(item.wall,photo.id));
     if(item.kind==='window'&&onWindowUpstand)add('نعلة الرخام عند هذا الشباك',()=>onWindowUpstand(item.wall,item.id));
   }else if(item&&picked.kind==='run'){
     add('تعديل عمق '+(free(item)?'الجزيرة':'الصف'),()=>inspect('[data-k-form="run"] [name="depth"]'));
     if(scoped&&onLayouts&&getProject?.()?.room.workshop?.rows?.[item.id])add('مراجعة بدائل الصف على الخادم',scopedLayouts);
     else if(!scoped&&onFactoryRow&&getProject?.()?.room.workshop?.rows?.[item.id])add('تخصيص وحدات صف المصنع',()=>onFactoryRow(item.id));
     else add('عرض الوحدات والفراغات',()=>inspect());
   }else{
     add('قياس مسافة على الرسم',()=>activateTool('measure'));
     add(view==='top'?'عرض المجسّم':'عرض المسقط',()=>selectView(view==='top'?'volume':'top'));
     add('إظهار الرسم كاملًا',()=>viewport.reset());
     if(onRoomDimensions)add('أبعاد الغرفة',onRoomDimensions);
   }
   return {title:item?nameOf(picked,item)+(picked.kind==='unit'?' · '+f(item.width*10)+' مم':''):'رسم المطبخ',actions};
 }
 const contextMenu=mountDrawingContext(root,{getSvg:()=>svg,actionsAt:drawingActions,cancelGesture});
 // Keep grab targets at their displayed size while a wheel/pinch is in
 // progress. Changing a grip transform leaves the captured SVG and CAD mesh intact.
 function zoomGrips(scale){
   drawingZoom=scale;
   for(const grip of svg.querySelectorAll('[data-k-handle][transform]')){
     const base=grip.dataset.kGripBase??grip.getAttribute('transform');
     grip.dataset.kGripBase=base;
     grip.setAttribute('transform',base+' scale('+n(gripZoom/scale)+')');
   }
 }
 const viewport=mountDrawingViewport(root,{getSvg:()=>svg,cancelGesture,canNavigate:()=>visible&&!gesture&&!host.inert,onZoom:zoomGrips});
 const simple=e=>e.isPrimary!==false&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey;
 on(svg,'pointerdown',e=>{
 if(!visible||gesture||!simple(e)||e.buttons!==1)return;
 if(pendingInspector()){note('طبّق تعديل الخصائص أو أغلقها قبل العمل على قطعة أخرى.','warn');return;}
 const p=pointEvent(e);if(!p)return;const k=current(),r=room(),g=geom(k,r);
 if(view==='volume'){const d=beginVolume(e,p,k,r,g);if(d)armPointer(e,d,k,p);return;}
 if(tool==='measure'){const a=measureHit(null,p,r);if(!a){note('ابدأ من داخل حدود المسقط.','warn');return;}armPointer(e,{kind:'measure',a,b:null},k,p);return;}
 const dimension=e.target?.closest?.('[data-k-room-dimension]')?.dataset.kRoomDimension;
 if(tool==='select'&&dimension&&onRoomDimensions){armPointer(e,{kind:'inspect-part',inspect:{route:'room-dimension',focus:{dimension}}},k,p);return;}
 if(tool==='select'&&onInspectPart){
   const inspect=planPartAt(e,p,g,r);if(inspect&&!inspect.focus.holeId){armPointer(e,{kind:'inspect-part',inspect},k,p);return;}
 }
 if(!architectureContains(r,p)&&!e.target?.closest?.('[data-k-wall-opening]')&&!e.target?.closest?.('[data-k-handle]')&&!e.target?.closest?.('[data-k-island-tag]')){note('ابدأ داخل حدود الغرفة الفعلية.','warn');return;}
 const pointId=e.target?.closest?.('[data-k-site-point]')?.dataset.kSitePoint;if(pointId&&tool==='select'){armPointer(e,{kind:'site-point',pointId},k,p);return;}
 const s=pickAt(e,p,g,r),ent=lookup(g,s);
 const grip=e.target.closest?.('[data-k-handle]'),part=grip?.dataset.kHandle,own=s?.kind==='run'?ent:g.runs.find(x=>x.id===ent?.runId),wall=ent?.wall,local=own?kitchenRunLocal(r,own,p).u:wall?kitchenWallLocal(r,wall,p).u:0,at=nearest(r,p);
 let d={kind:'pick',s,entity:ent,wall,local,run:own};if(tool==='run'&&runPlacement==='free'){if(!architectureContains(r,p)){note('ابدأ داخل مساحة الغرفة.','warn');return;}d={kind:'island-draw',origin:p};}
 else if(tool==='run'){
 if(!architectureContains(r,p)||at.dist>Math.min(r.width,r.length)*.23){note('ابدأ قريبًا من الجدار الذي تريد تثبيت الصف عليه.','warn');return;}d={kind:'run',wall:at.wall,local:at.u};
 }else if(['unit','feature'].includes(tool))d={kind:'place'};
 else if(tool==='select'&&part==='run-depth'&&selected?.kind==='run'){
   const run=lookup(g);if(!run||run.id!==grip.dataset.kOwner||!run.wall||(layer!=='all'&&layer!==run.tier))return;
   d={kind:'run-depth',s:selected,entity:run,run,initialD:kitchenRunLocal(r,run,p).d};
 }
 else if(tool==='select'&&['island-move','island-rotate'].includes(part)&&selected?.kind==='run'){const run=lookup(g);if(!free(run)||grip.dataset.kOwner!==run.id)return;const pivot=kitchenRunPoint(r,run,run.length/2,run.depth/2);d={kind:part,s:selected,run,pivot,origin:p,fromAngle:bearing(pivot,p)};}
 else if(tool==='select'&&grip&&selected?.kind==='unit'&&part==='width'){const u=lookup(g);if(!resizable(u)||grip.dataset.kOwner&&grip.dataset.kOwner!==u.id)return;const run=g.runs.find(v=>v.id===u.runId);d={kind:'resize',s:selected,entity:u,run,wall:u.wall,local:kitchenRunLocal(r,run,p).u};}
 else if(tool==='select'&&s?.kind==='run'&&free(own)){d={...d,kind:'island-move',pivot:kitchenRunPoint(r,own,own.length/2,own.depth/2),origin:p};}
 else if(tool==='select'&&ent&&s.kind==='unit')d={...d,kind:'move-unit',offset:local-ent.u};
 else if(tool==='select'&&ent&&s.kind==='feature')d={...d,kind:'move-feature',offset:local-ent.u};
 if(onInspectPart&&tool==='select'&&d.kind==='move-unit'){
   if(e.target.closest?.('[data-k-basin]'))d.inspect=planPartAt(e,p,g,r);
   const leaf=e.target.closest?.('[data-k-closed-leaf]')||e.target.closest?.('[data-k-leaf]');
   if(leaf){const kind=leaf.dataset.kPart,part=kind==='drawer'?(ent.kind==='pullout'?'pullout':'drawer'):kind==='door'||faceComponent(ent.kind,'door-front')==='appliance'?'appliance':'front';
     const index=openDrawerIndex(ent),leafId=part==='front'&&(leaf.dataset.kClosedLeaf||leaf.dataset.kLeaf);
     d.inspect={route:'unit-part',focus:{unitId:ent.id,runId:own.id,part,...(index?{index}:{}),...(leafId?{leafId}:{})}};}
 }
 armPointer(e,d,k,p);
 });
 on(svg,'pointerleave',()=>{if(!gesture||gesture.kind==='place')clearGhost();});
 on(svg,'pointermove',e=>{if(!gesture){enqueueHover(e);return;}if(e.pointerId!==gesture.id)return;if(e.buttons!==1||e.isPrimary===false||e.altKey||e.metaKey||e.ctrlKey||e.shiftKey){cancelGesture();return;}e.preventDefault();if(gesture.kind==='measure'){rulerPointer={clientX:e.clientX,clientY:e.clientY};if(!rulerMoveFrame)rulerMoveFrame=win.requestAnimationFrame(()=>{rulerMoveFrame=0;const q=rulerPointer;rulerPointer=null;if(q&&gesture?.kind==='measure')readDrag(gesture,q);});return;}readDrag(gesture,e);});
 on(svg,'pointerup',e=>{
 if(!gesture||gesture.id!==e.pointerId)return;if(!simple(e)||e.buttons!==0){cancelGesture();return;}
 readDrag(gesture,e);const d=endDrag();clearGhost();if(!d)return;const k=current(),r=room(),g=geom(k,r);e.preventDefault();lastScene=null;
 if(!d.moved&&d.inspect){if(!d.source||getProject?.()===d.source)inspectPicked(d.inspect);return;}
 if(d.kind==='inspect-part')return;
 if(d.kind==='site-point'){
  if(d.moved&&onCommitProject&&d.source){
   if(d.outsideStage||!d.siteMove?.ok||getProject()!==d.source){reject(d.siteMove?.reason||'تعذّر تثبيت نقطة الأرضية في هذا الموضع.');paint();return;}
   const saved=onCommitProject({...d.source,room:d.siteMove.room},'حُفظ موضع نقطة الأرضية.');
   if(saved?.ok===false)reject(saved.reason);else if(saved?.saved!==false)note('حُفظ موضع نقطة الأرضية.');paint();return;
  }
  if(!d.moved){const sp=r.sitePoints?.find(v=>v.id===d.pointId);if(sp){note(({'floor-drain':'صرف أرضي','floor-cleanout':'فتحة تسليك','floor-water':'تغذية أرضية'}[sp.kind]||'نقطة أرضية')+' · من اليسار '+cm(sp.x)+'، من الخلف '+cm(sp.z)+'.');onSurveyPoint?.(sp.id);}}paint();return;}
 if(d.kind==='measure'){
   if(d.moved&&d.b&&measureValues(d.a,d.b).distance>1e-6){ruler={a:d.a,b:d.b};note(measureText(d.a,d.b)+'.');}
   else note(d.moved?'لم يُسجّل قياس؛ أفلت فوق سطح ظاهر.':'اسحب من نقطة البداية إلى نقطة نهاية مختلفة.');
   quickStamp='';paint();return;
 }
 if(d.kind==='orbit'){
  if(!d.moved&&orbit&&(d.s||d.pointId)){
   orbit=false;if(d.pointId){onSurveyPoint?.(d.pointId);paint();}else inspectItem(d.s.kind,d.s.id);
  }else if(d.moved)paint();
  return;
 }
 if(d.outsideStage){reject('موضع الإفلات خارج مساحة الرسم.');paint();return;}
 if(d.kind==='place'){
   const out=d.moved?d.result:placementAt(k,r,g,d.scene||null,d.lastQ);if(out)commit(out,tool==='feature'?'أُضيف '+featLabel(featKind)+' على الوجه المختار.':'أُضيفت '+uLabel(unitKind)+' إلى الصف المختار.',tool==='feature'?'feature':'unit');else paint();return;
 }
 if(d.moved&&d.kind==='move-feature'&&linkedReadingIndex(getRoom?.()||r,d.entity)>=0){
  setSelection('feature',d.entity.id,true);paint();
  if(getProject&&onCommitProject){
   if(d.invalid||!d.featureCandidate||getProject()!==d.source){reject(d.notice||'تغيّرت القراءة أثناء سحبها.');return;}
   const correction=correctCadSurveyFeature(d.source,d.entity,d.featureCandidate),values=featureDimensionsMm(r,d.featureCandidate);
   for(const input of body.querySelectorAll('form[data-k-form="survey-feature"] [data-k-field]'))input.value=String(values[input.dataset.kField]);
   showGhost(packageProposal(correction,'feature',d.featureCandidate,r,k),'موضع مقترح · راجع القياس ثم احفظه');
   note(correction.ok?'راجع الموضع واضغط «حفظ قياس الجدار».':correction.reason,correction.ok?'':'warn');return;
  }
  if(d.result)showGhost(d.result,'معاينة بديل مؤقت · قياس الزيارة محفوظ');
  note('بقي موضع القياس محفوظًا. لتعديل موضعه افتح تصحيح قياس الزيارة.');return;
 }
 if(d.moved){if(d.invalid){reject(d.notice);paint();return;}
 if(d.result){if(!d.result.ok){reject(d.notice||d.result.reason);paint();return;}
 if(d.factoryDoc){previewFactoryWidth(d.entity,d.widthMm,'end');return;}
 if(d.kind==='island-draw'||d.kind==='run')finishNewRow(d.result);
 else {setSelection(d.s.kind,d.s.id,true);commit(d.result,d.run?.autoFill&&['resize','move-unit'].includes(d.kind)?'ثُبّت تخصيص الوحدة وأُعيد توزيع الباقي.':d.kind==='run-depth'?'حُفظ عمق الصف ال'+tierName(d.run.tier)+': '+cm(d.depthValue)+'.':d.kind==='resize'?'تغيّر عرض الوحدة ضمن الفراغ المتاح.':d.kind==='island-move'?'نُقلت الجزيرة بوحداتها وسطحها.':d.kind==='island-rotate'?'دارت الجزيرة ووحداتها حول مركزها.':'نُقلت القطعة إلى موضعها الجديد.');}return;}
 paint();return;
 }
 if(d.kind==='island-draw'){note('اسحب بين نقطتين لتحديد طول الجزيرة واتجاهها.');return;}
 if(d.kind==='run'){note('اسحب مسافة على امتداد الجدار لرسم صف؛ النقرة وحدها لا ترسمه.');return;}
 if(tool==='test'&&(!d.s||d.s.kind!=='unit')){note(d.s?.kind==='feature'?'هذا تجهيز ثابت؛ اختر واجهة وحدة لاختبار الفتح.':'لم تُختر واجهة. انقر على جسم خزانة أو أحد أجزائها المفتوحة.');return;}
 if(d.s){setSelection(d.s.kind,d.s.id,tool!=='test');if(tool==='test'&&d.s.kind==='unit'){toggleUnit(lookup(g));return;}const item=lookup(g,d.s);
  const hint=d.s.kind==='unit'?' · '+f(item.width*10)+' مم'+(resizable(item)?' · اسحب مقبض العرض عند الطرف.':'.'):d.s.kind==='run'&&item?.wall?' · اسحب المقبض عند وجه الصف لتغيير عمقه.':'.';
  note(nameOf(d.s,item)+hint);}
 else {setSelection(null,null,false);note('لا يوجد عنصر محدد.');}paint();
 });
 for(const ev of ['pointercancel','lostpointercapture'])on(svg,ev,e=>{
   // On touch the old SVG child may lose implicit capture to the drawing.
   if(ev==='lostpointercapture'&&e.target!==svg&&svg.hasPointerCapture?.(e.pointerId))return;
   if(gesture?.id===e.pointerId)cancelGesture();else if(!gesture)clearGhost();
 });on(win,'blur',cancelGesture);
 on(win,'pointerdown',e=>{if(gesture&&(e.pointerId!==gesture.id||e.isPrimary===false||e.button!==0))cancelGesture();},{capture:true});on(win,'mousedown',e=>{if(gesture&&(e.button!==0||e.buttons!==1))cancelGesture();},{capture:true});
 if(host.ownerDocument?.addEventListener)on(host.ownerDocument,'visibilitychange',()=>{if(host.ownerDocument.hidden)cancelGesture();});
 function selectView(next){if(!['volume','top'].includes(next)||dead||next!==view&&retainPendingInspector())return false;contextMenu.close();cancelGesture();view=next;if(view!=='volume')inspectInteriorId=null;orbit=false;quickStamp='';lastScene=null;paint();return true;}
 function setCamera(opts={}){if(!opts||!Number.isFinite(opts.yaw)&&!Number.isFinite(opts.pitch)||dead)return false;cancelGesture();orbit=false;camera={yaw:Number.isFinite(opts.yaw)?opts.yaw%360:camera.yaw,pitch:Number.isFinite(opts.pitch)?clamp(opts.pitch,-60,72):camera.pitch};quickStamp='';lastScene=null;paint();return true;}
 function activateTool(next,opts={}){
   if(dead||!ownKey(toolNames,next)||retainPendingInspector())return false;opts=opts||{};const requested=opts.tier;
   if(requested!==undefined&&!['base','upper'].includes(requested))return false;
   if((next==='unit'||next==='run')&&requireSurvey?.())return false;
   if(next==='unit'){
     const kind=opts.unitKind??unitKind;if(!ownKey(kitchenUnitSpecs,kind))return false;
     unitKind=kind;const use=requested??tier;tier=kitchenUnitAllowed(kind,use)?use:(kitchenUnitSpecs[kind].tiers||['base'])[0];wantWidth=Number.isFinite(opts.width)&&opts.width>=20&&opts.width<=240?opts.width:null;
   }else if(next==='feature'){if(opts.featureKind!==undefined&&!ownKey(kitchenFeatureSpecs,opts.featureKind))return false;featKind=opts.featureKind??featKind;}
   else if(next==='run'){runPlacement=opts.runPlacement==='free'||opts.runPlacement==='wall'?opts.runPlacement:runPlacement;tier=runPlacement==='free'?'base':requested??tier;}
   mode(next);if(next==='unit')note('انقر في الصف '+(tier==='upper'?'العلوي':'السفلي')+' لوضع '+uLabel(unitKind)+'.');else if(next==='feature')note('اختر موضع '+featLabel(featKind)+' على الجدار.');
   return true;
 }
 function inspectItem(kind,id){if(!['feature','unit','run'].includes(kind)||!current())return false;const r=room(),item=lookup(geom(current(),r),{kind,id});if(!item)return false;
   cancelGesture();ruler=null;orbit=false;inspectInteriorId=null;tool='select';if(layer!=='all'&&item.tier&&layer!==item.tier)layer=item.tier;setSelection(kind,id,true);quickStamp='';lastScene=null;paint();note('التحديد: '+nameOf({kind,id},item)+'.');return true;}
 function selectUnit(id,opts={}){const u=current()?.units.find(e=>e.id===id);if(!u)return false;cancelGesture();ruler=null;orbit=false;tool='select';layer='all';setSelection('unit',id,opts.open!==false);paint();return true;}
 function cleanView(){const k=getKitchen(),r=room(),g=geom(k,r),v=view==='volume'?renderKitchenRoom(getPlan(),{kitchen:k,...camera,mode:'cutaway',prefix:id+'-export',inspectInteriorId:inspectInteriorId||undefined,photos:getPhotos?.()||{}}):topDrawing(k,g,r,true),b=v.bounds;
 return '<svg xmlns="'+ns+'" width="1400" height="'+Math.round(1400*b.h/b.w)+'" viewBox="'+v.viewBox+'"><title>مخطط المطبخ · '+(view==='volume'?'منظور مجسّم':'مسقط علوي بالسنتيمتر')+'</title><rect x="'+n(b.x)+'" y="'+n(b.y)+'" width="'+n(b.w)+'" height="'+n(b.h)+'" fill="#f7f5eb"/>'+v.html+'</svg>';}
 on(quick,'change',e=>{
 const which=e.target.dataset.kChoice,val=e.target.value;if(!which)return;contextMenu.close();clearGhost();
 if(which==='run-placement'){runPlacement=val==='free'?'free':'wall';if(runPlacement==='free')tier='base';layer=tier;setSelection(null);note(runPlacement==='free'?'اسحب في أرضية الغرفة لرسم الجزيرة بأي اتجاه.':'اسحب على امتداد الجدار لتحديد الصف.');}else if(which==='wall-depth'){const v=e.target.valueAsNumber;if(!Number.isFinite(v)||v<15||v>150){note('عمق الصف بين ١٥ و١٥٠ سم.','warn');e.target.value=String(wallDepth[tier]);return;}wallDepth[tier]=v;}else if(which==='island-depth'){const v=e.target.valueAsNumber;if(!Number.isFinite(v)||v<15||v>150){note('اختر عمقًا بين ١٥ و١٥٠ سم.','warn');e.target.value=String(freeDepth);return;}freeDepth=v;}else if(which==='tier'){tier=val;layer=val;}else if(which==='unit-tier'){tier=val;layer=val;}else if(which==='unit'){unitKind=val;if(!kitchenUnitAllowed(val,layer))tier=layer=(kitchenUnitSpecs[val]?.tiers||['base'])[0];wantWidth=null;}else if(which==='width'){const w=e.target.valueAsNumber;if(!Number.isFinite(w)||w<20||w>240){note('أدخل عرضًا بين ٢٠ و٢٤٠ سم.','warn');return;}wantWidth=w;}
 else if(which==='feature')featKind=val;else if(which==='test-layer'){layer=ownKey(layerNames,val)?val:'all';selected=null;opened=false;note((view==='volume'?'طبقة الاختبار: ':'الطبقة المعروضة للاختبار: ')+layerNames[layer]+'.');}else if(which==='layer')layer=val;quickStamp='';panelStamp='';paint();});
 function previewFactoryWidth(unit,widthMm,edge){
   if(scoped){reject(scopedRowReason);return;}
   const source=getProject(),delta=widthMm-Math.round(unit.width*10);
   factoryPreview=null;panelStamp='';
   setSelection('unit',unit.id,true);
   if(!delta){paint();note('هذا هو العرض المحفوظ.');return;}
   const change=previewKitchenWidthChange(source,unit.id,delta,{edge,explicitUserChange:true,inputKind:edge?'grip':'number'});
   if(!change.ok){paint();reject(change.reason);return;}
   factoryPreview={source,change};paint();note('راجع الوحدات المتأثرة ثم طبّق التعديل.');
 }
 on(body,'input',e=>{
   if(ghost)clearGhost();
   if(factoryPreview&&e.target?.name==='widthMm'){
     factoryPreview=null;
     const confirm=body.querySelector('[data-k-act="confirm-factory-width"]');
     if(confirm)confirm.closest('section')?.remove();
   }
 });
 on(body,'change',e=>{if(e.target.name==='fillKind'){
   const u=selected?.kind==='unit'?current()?.units?.find(x=>x.id===selected.id):null,input=e.target.form?.elements?.namedItem('width'),spec=kitchenUnitSpecs[e.target.value];if(!u||!input||!spec)return;
   input.readOnly=!!spec.fixedWidth&&e.target.value===u.kind;
   if(e.target.value===u.kind)input.value=String(u.width);else if(spec.fixedWidth)input.value=String(defaultWidth(spec,u.width));
   return;
 }if(e.target.name==='depth'&&e.target.form?.dataset.kForm==='new-run'){const v=e.target.valueAsNumber;if(v>=15&&v<=150){wallDepth[tier]=v;const bar=quick.querySelector('[data-k-choice="wall-depth"]');if(bar)bar.value=String(v);}return;}if(e.target.name==='wall'){const w=architectureWall(room(),e.target.value),form=e.target.form;if(w&&form){const range=form.querySelector('[data-k-wall-range]');if(range)range.textContent='المجال على المرجع: '+cm(w.start)+' – '+cm(w.end)+'.';for(const name of ['u','start','end']){const inp=form.elements?.namedItem(name);if(inp){inp.min=String(w.start);inp.max=String(w.end);if(inp.valueAsNumber<w.start||inp.valueAsNumber>w.end)inp.value=String(name==='end'?w.end:w.start);}}}return;}if(!e.target.hasAttribute?.('data-k-jump')||!e.target.value)return;const run=geom(current(),room()).runs.find(v=>v.id===e.target.value);if(run){setSelection('run',run.id,true);paint();}});
 on(body,'submit',e=>{
 const form=e.target.closest('[data-k-form]');if(!form)return;e.preventDefault();if(tool==='measure'||tool==='test'||orbit)return;const k=current(),r=room(),g=geom(k,r),obj=lookup(g);
 const fields={};for(const input of form.querySelectorAll('[data-k-field]')){if(!Number.isFinite(input.valueAsNumber)){reject('أدخل قيمة رقمية لكل مقاس.');return;}fields[input.dataset.kField]=input.valueAsNumber;}
 const kind=form.dataset.kForm,Q=name=>form.elements?.namedItem?.(name);
 if(kind==='new-island'){finishNewRow(addRun(k,r,newRunSpec({...fields,placement:'free',tier:'base'})));return;}
 if(kind==='new-run'){finishNewRow(addRun(k,r,newRunSpec({...fields,wall:Q('wall').value,tier})));return;}
 if(kind==='new-feature'){const spec={...fields,wall:Q('wall').value,kind:featKind},res=addFeature(k,r,spec);
   if(!commit(res,'أُضيف التجهيز بالأبعاد المحددة.','feature')&&!res.ok)showGhost(packageProposal(res,'feature',spec,r,k),'',true);return;}
 if(kind==='new-unit'){const val=Q('startOpt').value.trim();commit(addUnit(k,r,newUnitSpec({runId:Q('runId').value,kind:unitKind,width:wantWidth??defaultWidth(kitchenUnitSpecs[unitKind],60),...(val?{u:Number(val)}:{})})),'أُضيفت الوحدة في الصف.','unit');return;}
 if(!obj)return;
 if(kind==='factory-width'){previewFactoryWidth(obj,fields.widthMm);return;}
 if(kind==='wall-row-depth'&&selected.kind==='unit'){const row=g.runs.find(v=>v.id===obj.runId);if(!row?.wall||free(row))return;commit(updateRun(k,r,row.id,{depth:fields.depth}),'حُدّث عمق الصف '+layerNames[row.tier]+' إلى '+cm(fields.depth)+'.');return;}
 if(kind==='unit'&&selected.kind==='unit'){
   const own=g.runs.find(v=>v.id===obj.runId),kindField=Q('fillKind');
   if(own?.autoFill){
     if(fields.u!==undefined)fields.u+=own.start;
     if(kindField&&kindField.value!==obj.kind)fields.kind=kindField.value;
     const result=updateUnit(k,r,obj.id,fields);
     if(!commit(result,'حُفظ تخصيص الوحدة وأُعيد توزيع باقي الصف.')&&!result.ok){
       showGhost(packageProposal(result,'unit',{...obj,...fields},r,k),'',true);
       const why=body.querySelector('[data-k-fill-error]');if(why){why.hidden=false;why.textContent=result.reason;}
     }
     return;
   }
 }
 if(kind==='survey-feature'&&getProject&&onCommitProject&&obj){
  const doc=getProject(),candidate=featureFromDimensionsMm(doc.room,obj,fields),result=correctCadSurveyFeature(doc,obj,candidate);
  if(!result.ok||e.submitter?.hasAttribute?.('data-k-preview-survey')){
   showGhost(packageProposal(result,'feature',candidate,r,k),'معاينة قياس الجدار');note(result.ok?'راجع الموضع ثم احفظ القياس.':result.reason,result.ok?'':'warn');return;
  }
  const saved=onCommitProject(result.doc,'حُفظ قياس العنصر في رفع الجدار.');
  if(saved?.ok===false||saved?.saved===false){reject(saved.reason||'تعذّر حفظ القراءة.');return;}
  clearGhost();panelStamp='';paint();note('حُفظ قياس العنصر في رفع الجدار.');return;
 }
 if(kind==='preview-survey-feature'&&linkedReadingIndex(getRoom?.()||r,obj)>=0){
  const edge=architectureWall(r,obj.wall),patch={u:(edge?.start||0)+fields.u/10,width:fields.width/10,bottom:fields.bottom/10,height:fields.height/10};
  const result=updateFeature(k,r,obj.id,patch);
  showGhost(packageProposal(result,'feature',{...obj,...patch},r,k),'معاينة بديل مؤقت · قياس الزيارة محفوظ');
  note(result.ok?'معاينة على الرسم فقط. لتعديل القياس افتح تصحيح قياس الزيارة.':result.reason);return;
 }
 if(kind==='measured-glazing'){commit(updateFeature(k,r,obj.id,{glazing:Q('glazing').value||undefined}),'حُفظ نوع زجاج الشباك.');return;}
 if(kind==='site-feature'){
  const feature=featureFromDimensionsMm(r,obj,fields);
  for(const key of Object.keys(fields))fields[key]=feature[key];
 }
 if(kind==='feature'||kind==='site-feature'){for(const k0 of ['hinge','swing','glazing']){const entry=Q(k0);if(entry)fields[k0]=entry.value||undefined;}}
 if(kind==='run'&&free(obj)){
   const {centerX,centerZ,angle,length,depth,...rest}=fields,pivot=kitchenRunPoint(r,obj,obj.length/2,obj.depth/2);
   const similar=(a,b)=>Math.abs(a-b)<.0006,dx=similar(centerX,pivot.x)?0:centerX-pivot.x,dz=similar(centerZ,pivot.z)?0:centerZ-pivot.z;
   const onlyPose=similar(obj.length,length)&&similar(obj.depth,depth)&&similar(obj.height,rest.height)&&similar(obj.bottom,rest.bottom);
   const ca=similar(angle,obj.angle)?obj.angle:angle,off=kitchenRunPoint(r,{...obj,x:0,z:0,angle:ca},length/2,depth/2);
   const result=onlyPose?transformFreeRun(k,r,obj.id,{dx,dz,angle:ca}):updateRun(k,r,obj.id,{...rest,angle:ca,length,depth,x:pivot.x+dx-off.x,z:pivot.z+dz-off.z});
   commit(result,'طُبّق موضع الجزيرة ومقاسها واتجاهها.');return;
 }
 const result=selected.kind==='unit'?updateUnit(k,r,obj.id,fields):selected.kind==='feature'?updateFeature(k,r,obj.id,fields):updateRun(k,r,obj.id,fields);if(!commit(result,'طُبّقت خصائص '+nameOf(selected,obj)+'.')&&!result.ok&&['feature','unit'].includes(selected.kind))showGhost(packageProposal(result,selected.kind,{...obj,...fields},r,k),'',true);
 });
 on(root,'click',e=>{
 const b=e.target.closest?.('button');if(!b||b.disabled||!root.contains(b)||!visible)return;
 if(b.dataset.kAct==='tool-labels'){
  const dock=q('.kit-palette'),show=b.getAttribute('aria-pressed')!=='true';
  dock.toggleAttribute('data-show-labels',show);b.setAttribute('aria-pressed',String(show));return;
 }
 const k=current(),r=room(),g=geom(k,r);
 if(b.dataset.kRowUnit){inspectItem('unit',b.dataset.kRowUnit);return;}
 if(b.dataset.kView){selectView(b.dataset.kView);return;}
 if(b.dataset.kTool){if(retainPendingInspector()||(['run','unit'].includes(b.dataset.kTool)&&requireSurvey?.()))return;mode(b.dataset.kTool);if(win.matchMedia?.('(max-width:650px)')?.matches){const p=b.closest('.kit-palette');if(p)p.open=false;}return;}
 if(b.dataset.kAct==='empty-kitchen'&&!onLayouts){
   if(k.runs.length||k.units.length||k.features.length){
    emptyRequest=k;q('[data-k-check-msg]').textContent='بدء مطبخ فارغ وإزالة الصفوف والوحدات والتجهيزات الحالية؟ يمكنك التراجع.';check.hidden=false;return;
   }
   resetKitchen();return;
 }
 if(b.dataset.kFix){const candidate=suggestKitchenFix(k,r,b.dataset.kFix);if(!candidate){note('تغيّرت الحالة؛ افحص التداخل مجددًا.','warn');return;}
   if(tool==='test'){
     const unit=g.units.find(u=>u.id===candidate.unitId);if(!unit)return;
     if(factoryMember(unit)&&(scoped||onFactoryRow)){if(scoped)scopedLayouts();else onFactoryRow(unit.runId);return;}
     mode('select');inspectItem('unit',unit.id);
     const row=g.runs.find(v=>v.id===unit.runId),input=body.querySelector('[data-k-form="unit"] [name="u"]');
     if(input){input.value=String(n(candidate.u-(row?.autoFill?row.start:0)));input.focus();input.select?.();}
     note('الموضع المقترح '+cm(candidate.u)+' على مرجع الصف. راجع التعديل قبل تطبيقه.');return;
   }
   if(tool!=='select')return;
   commit(updateUnit(k,r,candidate.unitId,{u:candidate.u,runId:candidate.runId}),'نُقلت الوحدة وزال التداخل مع بقاء الواجهتين مفتوحتين.');opened=true;panelStamp='';paint();return;}
 const act=b.dataset.kAct,obj=lookup(g);if(!act)return;
 if((tool==='test'||tool==='measure')&&!['close','inspect','conflicts','clear-measure','orbit','home','replace','cancel-replace','layouts','room'].includes(act))return;
 if(act==='correct-survey-reading'&&obj){onSurveyReading?.(obj.wall,obj.id);return;}
 if(act==='reading-photo'&&obj){const image=wallPhotoForFeature(getRoom?.()||r,obj.id);if(image)onReadingPhoto?.(obj.wall,image.id);return;}
 if(act==='remove'&&selected?.kind==='feature'&&linkedReadingIndex(getRoom?.()||r,obj)>=0){
  note('تُزال القراءة من ورقة الجدار حتى تتحدّث الفتحة وحصرها معًا.');onSurveyReading?.(obj.wall,obj.id);return;
 }
 if(act==='factory-row'&&factoryMember(obj)){if(scoped)scopedLayouts();else onFactoryRow?.(obj.runId);return;}
 if(act==='cancel-factory-width'){factoryPreview=null;panelStamp='';paint();return;}
 if(act==='confirm-factory-width'){
   if(scoped){reject(scopedRowReason);return;}
   if(!factoryPreview||factoryPreview.source!==getProject()||factoryPreview.change.unitId!==obj?.id){factoryPreview=null;panelStamp='';paint();reject('تغيّر المشروع. أعد معاينة عرض الوحدة.');return;}
   if(factoryPreview.change.hold){reject(factoryPreview.change.hold);return;}
   const next=factoryPreview.change.doc,out=onCommitProject(next,'حُفظ مقاس الوحدة والوحدات المتأثرة وحصر صف المصنع.');
   if(out?.ok===false){reject(out.reason);return;}
   factoryPreview=null;panelStamp='';paint();note('حُفظ مقاس الوحدة وأُعيد حساب صف المصنع.');return;
 }
 if(act==='window-upstand'&&selected?.kind==='feature'&&obj?.kind==='window'){
  const form=body.querySelector('[data-k-form="site-feature"],[data-k-form="survey-feature"],[data-k-form="preview-survey-feature"]');
  if(form&&[...form.querySelectorAll('input')].some(field=>field.value!==field.defaultValue)){
   note('طبّق تعديل مقاسات الشباك أولًا حتى تطابق المعاينة البرواز الحالي.','warn');return;
  }
  onWindowUpstand?.(obj.wall,obj.id);return;
 }
 if(act==='close'){clearGhost();opened=false;panel.hidden=true;creative?.refresh(false);quickStamp='';paint();return;}
 if(act==='inspect'||act==='conflicts'){foldSmallPalette();opened=true;if(act==='conflicts'&&tool!=='test'){tool='test';layer='all';inspectInteriorId=null;selected=null;}panelStamp='';paint();return;}
 if(act==='room'){onRoomDimensions?.();return;}
 if(act==='layouts'){onLayouts?.();return;}if(act==='library'){onLibrary?.('unit');return;}
 if(act==='clear-measure'){cancelGesture();ruler=null;quickStamp='';paint();note('مُسح القياس.');return;}
 if(act==='orbit'&&view==='volume'){contextMenu.close();cancelGesture();orbit=!orbit;quickStamp='';lastScene=null;paint();note(orbit?'اسحب أي مكان لتدوير الكاميرا.':'عدت إلى '+toolNames[tool]+' دون تغيير زاوية النظر.');return;}
 if(act==='home'){clearGhost();cancelGesture();camera={yaw:32,pitch:25};lastScene=null;paint();return;}
 if(act==='cancel-replace'){emptyRequest=null;check.hidden=true;return;}
 if(act==='replace'){const confirmed=emptyRequest&&emptyRequest===k;emptyRequest=null;check.hidden=true;if(confirmed)resetKitchen();return;}
 if(!obj)return;
 if(act==='fill-row'&&selected.kind==='run'){commit(fillKitchenRow(k,r,obj.id,{defaults:rowDefaults()}),'فُعّلت التعبئة. اختر وحدة لتخصيصها.');return;}
 if(act==='restore-fill'&&selected.kind==='run'){commit(restoreKitchenFillGaps(k,r,obj.id),'أُعيدت الفراغات المحجوزة إلى التعبئة.');return;}
 if(act==='pin-fill'&&selected.kind==='unit'){commit(pinKitchenFillUnit(k,r,obj.id),'ثُبّت موضع الوحدة ومقاسها.');return;}
 if(act==='release-fill'&&selected.kind==='unit'){
   const rr=obj.runId,out=releaseKitchenFillUnit(k,r,obj.id);
   if(out.ok&&!out.kitchen.units.some(x=>x.id===obj.id)){const next=out.id&&out.kitchen.units.find(x=>x.id===out.id&&x.runId===rr);setSelection(next?'unit':'run',next?.id||rr,true);}
   commit(out,'عادت مساحة الوحدة إلى التعبئة التلقائية.');return;
 }
 if(act==='parent-run'&&selected.kind==='unit'){tool='select';layer='all';setSelection('run',obj.runId,true);paint();note('اختيار الصف كاملًا: '+runTitle(lookup(g),g.runs)+'.');return;}
 if(act==='inspect-interior'&&view==='volume'&&tool==='select'&&selected.kind==='unit'&&!obj.open&&['storage','tall'].includes(obj.kind)){inspectInteriorId=inspectInteriorId===obj.id?null:obj.id;panelStamp='';lastScene=null;paint();note(inspectInteriorId?'كُشفت التقسيمات داخل الخزانة. لم يتغير التصميم.':'ظهرت واجهة الخزانة من جديد.');return;}
 if(act==='interior'&&selected.kind==='unit'&&kitchenUnitSpecs[obj.kind]?.editableInterior){onEditUnit?.(obj.id);return;}
 if(act==='toggle'&&selected.kind==='unit'){toggleUnit(obj);return;}
 if(act==='add-in-run'){if(requireSurvey?.())return;tier=obj.tier;mode('unit');layer=obj.tier;if(!kitchenUnitAllowed(unitKind,tier))unitKind=Object.keys(kitchenUnitSpecs).find(k=>kitchenUnitAllowed(k,tier))||'storage';wantWidth=null;quickStamp='';paint();return;}
 if(act==='remove'){const name=nameOf(selected,obj),held=selected.kind==='unit'&&g.runs.find(row=>row.id===obj.runId)?.autoFill,a=removeKitchenItem(k,obj.id,r);if(!a.ok){reject(a.reason);return;}cancelGesture();setSelection(null);commit(a,'حُذف '+name+(held?' وتُرك مكانها فارغًا.':'.')+' يمكن التراجع عن الحذف.');}
 });
 on(root,'keydown',e=>{if(e.key==='Escape'&&(ghost||hoverFrame||previewNote&&!previewNote.hidden))clearGhost();});
 on(svg,'keydown',e=>{if(e.key==='Escape'){cancelGesture();if(orbit){orbit=false;quickStamp='';lastScene=null;}opened=false;panel.hidden=true;paint();return;}if(!gesture&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['+','=','-','0'].includes(e.key)){
   e.preventDefault();if(e.key==='0')viewport.reset();else viewport.zoomBy(e.key==='-'?1/1.25:1.25);return;
 }if(view!=='volume')return;const s=e.shiftKey?30:10,d={ArrowRight:[s,0],ArrowLeft:[-s,0],ArrowUp:[0,s],ArrowDown:[0,-s]}[e.key];if(!d&&e.key!=='Home')return;e.preventDefault();cancelGesture();camera=d?{yaw:(camera.yaw+d[0]+360)%360,pitch:clamp(camera.pitch+d[1],-60,72)}:{yaw:32,pitch:25};lastScene=null;paint();});
 function resetKitchen(){emptyRequest=null;check.hidden=true;cancelGesture();setSelection(null);mode('select');onCommit(createKitchen(getPlan(),'empty'),'بدأ مطبخ فارغ.');paint();}
 // HUD dimensions use the SVG's *physical* screen CTM. The surrounding HTML
 // stage reports layout changes (including late styles) independently of SVG
 // geometry, so repainting a handle cannot itself trigger a resize loop.
 let stageW=-1,stageH=-1;
 const stageObserver=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{
   if(dead||!visible)return;
   const box=svg.getBoundingClientRect();if(!box.width||!box.height||Math.abs(box.width-stageW)<.1&&Math.abs(box.height-stageH)<.1)return;
   stageW=box.width;stageH=box.height;lastScene=null;drawSoon();
 }):null;
 stageObserver?.observe(q('.kit-mat'));
 const slot=q('[data-k-creative]');if(slot?.nodeType===1)creative=mountKitchenCreative(slot,{getKitchen,getPlan,getSelection:()=>selected,onTemplate:onInspectPart?(focus)=>{
   const g=geom(current(),room()),pieces=g.worktops.filter(t=>t.runId===focus.runId);
   if(!pieces.length||focus.topId&&!pieces.some(t=>t.id===focus.topId)||focus.unitId&&!g.units.some(u=>u.id===focus.unitId&&u.runId===focus.runId)){note('تغيّرت قطعة السطح. اخترها مجددًا من الرسم.','warn');return;}
   onInspectPart('surface',focus);
 }:null,onCommit:(next,message)=>{const result=commitKitchenOnly(next,message);if(result?.ok===false)reject(result.reason);return result;},onSelect:(kind,ident)=>{setSelection(kind,ident,true);paint();},note});
 function suspendDrawingInput(){
   contextMenu.close();cancelGesture();
   if(testKitchen||ruler){testSource=testKitchen=null;ruler=null;quickStamp='';lastScene=null;paint();}
 }
 return {refresh,suspendDrawingInput,activateTool,selectView,setCamera,selectUnit,inspectItem,inspectMaterial(kind,id,part,focus={}){if(!inspectItem(kind,id))return false;return creative?.inspectMaterial(part,focus)??false;},exportSvg:cleanView,getState:infoSnap,destroy(){if(dead)return;refresh(false);dead=true;viewport.destroy();contextMenu.destroy();stageObserver?.disconnect();if(frame)win.cancelAnimationFrame(frame);frame=0;creative?.destroy?.();ac.abort();host.replaceChildren();host.classList.remove('kit-host');}};
}
