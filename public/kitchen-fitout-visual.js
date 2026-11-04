// Carry only drawing data into the scene. Factory rates, supplier references
// and the site survey stay in the editable project.
import {baseSupportTakeoff} from './kitchen-base-support.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {worktopUpstandTakeoff} from './kitchen-worktop-upstand.js';
import {evaluateSurveyedSurfaces} from './kitchen-surveyed-surfaces.js';

export function installedFitout(room,kitchen){
 const w=room.workshop,catalog=readWorkshopCatalog(w)||{};
 if(!kitchen||(!w?.baseSupport&&!catalog.baseSupport&&!w?.upstand))return undefined;
 const doc={room,kitchen},units={},aprons=[];
 if(w.baseSupport||catalog.baseSupport){
  const base=baseSupportTakeoff(doc,catalog),samples=w.surfaces3d?evaluateSurveyedSurfaces(doc).results:[];
  const pads=new Map(samples.map(row=>[row.target,row.pads]));
  for(const u of base.units){
   const legs=(pads.get(u.id)||[]).flatMap(p=>{
    const footprint=u.pads[p.index-1];
    return footprint&&p.minLegMm>0?[{footprint,lengthMm:(p.maxLegMm+p.minLegMm)/2}]:[];
   });
   units[u.id]={applicable:u.applicable,mode:u.mode,bodyClearMm:u.bodyClearMm,recipeHeightBasis:u.recipeHeightBasis,apron:u.apron,legs};
  }
  for(const p of base.aprons)aprons.push({runId:p.runId,unitIds:p.unitIds,startMm:p.startMm,endMm:p.endMm,bottomMm:p.bottomMm,heightMm:p.heightMm,insetMm:p.insetMm,depthMm:p.depthMm,thicknessMm:p.thicknessMm,color:catalog.items?.find(i=>i.sku===p.sku)?.colorHex});
 }
 const take=w.upstand?worktopUpstandTakeoff(doc,catalog):null;
 const stone=(take?.segments||[]).map(s=>({wall:s.wall,fromMm:s.fromMm,toMm:s.toMm,bottomMm:s.bottomMm,heightMm:s.heightMm,thicknessMm:s.thicknessMm,color:s.color}));
 const sills=(take?.sills||[]).map(s=>({wall:s.wall,windowId:s.windowId,fromMm:s.fromMm,toMm:s.toMm,bottomMm:s.bottomMm,depthMm:s.depthMm,thicknessMm:s.thicknessMm,color:s.color}));
 return {units,aprons,stone,...(sills.length?{sills}:{})};
}
