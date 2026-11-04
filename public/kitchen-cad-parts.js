// Pick the actual visible face. A unit remains the owner of its drag gesture;
// a stationary pick can edit the smaller component or the room surface.
const handles=new Set(['pull','pull-highlight','pull-post','open-door-pull','open-pull-highlight','knob','knob-post','bar-post','bar-handle','recessed-grip']);
const fronts=new Set(['door-front','open-hinged-door','open-hinged-panel','recessed-panel','front-rail','front-flute','island-rear-finish','equipment-cabinet-front','equipment-frame','equipment-flute','tall-seam','open-door-seam']);
const appliances=new Set(['fridge','freezer','oven','oven-tower','dishwasher','hob','hood']);
export function faceComponent(kind,tag){
 if(tag==='cabinet-leg')return 'leg';
 if(appliances.has(kind))return 'appliance';
 if(handles.has(tag)||tag?.startsWith('equipment-handle'))return 'handle';
 if(kind==='drawers'&&(tag?.includes('drawer')||fronts.has(tag)))return 'drawer';
 if(fronts.has(tag))return 'front';
 if(tag==='interior-shelf'||tag==='open-shelf-board'||tag==='bottle-grid-shelf')return 'shelf';
 if(tag?.startsWith('interior-')||tag?.startsWith('open-shelf-')||tag==='bottle-grid-post')return 'inside';
 if(kind==='pullout'&&tag?.startsWith('pullout-'))return 'pullout';
 return null;
}

// Cabinet ordinals are counted from the top on both drawings. Read the
// actual open tray elevation, using the body clear height above the supports.
export function openDrawerIndex(u){
 const op=u.openPart;if(u.kind!=='drawers'||!op)return undefined;
 const toe=u.baseSupport?.applicable?Math.min(u.height,u.baseSupport.bodyClearMm/10):u.bottom<1?Math.min(9,u.height*.12):0;
 const count=u.drawerCount||3,bodyHeight=u.height-toe,fromTop=u.bottom+u.height-(op.bottom+op.height/2);
 return Math.min(count,Math.max(1,1+Math.floor(fromTop/bodyHeight*count)));
}

export function cadPartTarget(hit,g,layer='all'){
 if(!hit||hit.sitePointId)return null;
 const {part,tag,wall,id,kind,runId}=hit;
 const target=(route,focus)=>({route,focus});
 if(part==='surface'){
  if(tag==='backsplash'||tag==='wall-cladding'||tag==='tile-skirting'||tag==='skirting-edge'){
   const surface=tag==='backsplash'?'backsplash':tag==='wall-cladding'?'cladding':'skirting';
   return target('room-surface',{surface,wall:hit.surface});
  }
  return hit.surface==='floor'||hit.surface==='ceiling'?target('room-surface',{surface:hit.surface}):
   hit.surface?target('survey',{wall:hit.surface}):null;
 }
 if(part==='corner'){
  const c=(g.cornerBodies||[]).find(c=>c.id===id);
  return c&&(layer==='all'||c.tier==='tall'||layer===c.tier)?target('corner',{joint:c.joint,tier:c.tier}):null;
 }
 if(part==='fixture'){
  if(tag==='door-threshold')return target('room-surface',{surface:'threshold',wall,featureId:id});
  if(kind==='under-light')return target('wallOptions',{wall,lighting:true,sectionId:hit.sectionId});
  if(kind?.startsWith('curtain-')||kind?.startsWith('cover-'))return target('wallOptions',{wall,featureId:id});
  if(kind==='upstand'||kind==='window-sill-stone')return target('assembly',{section:'stone',wall,...(kind==='window-sill-stone'?{windowId:id}:{})});
  return null;
 }
 const u=g.units.find(o=>o.id===(part==='module'?id:hit.unitId)),run=g.runs.find(r=>r.id===(runId||u?.runId));
 if(!run||(layer!=='all'&&run.tier!==layer))return null;
 if(part==='worktop')return target('worktop',{runId:run.id,topId:id,...(u?{unitId:u.id}:{})});
 if(tag==='base-apron')return target('assembly',{section:'base',runId:run.id,part:'apron'});
 if(!u)return null;
 if(kind==='sink'&&['sink-rim','sink-wall','sink-bottom','sink-drain'].includes(tag)){
  const slab=g.worktops?.find(t=>t.runId===run.id&&t.holes?.some(h=>h.unitId===u.id));
  if(slab)return target('surface',{runId:run.id,topId:slab.id,unitId:u.id,holeId:u.id});
 }
 if(tag?.startsWith('faucet')||tag?.startsWith('mixer-'))return target('tap',{sinkId:u.id,wall:u.wall});
 if(tag==='cabinet-leg')return target('assembly',{section:'base',runId:run.id,unitId:u.id,part:'leg'});
 const component=hit.component||faceComponent(kind,tag);
 return component?target('unit-part',{unitId:u.id,runId:run.id,part:component,...(hit.index?{index:hit.index}:{}),...(hit.leafId?{leafId:hit.leafId}:{})}):null;
}
