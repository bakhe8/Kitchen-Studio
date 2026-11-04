import {architectureWall,architectureWallLabel} from './kitchen-architecture.js';
import {kitchenFeatureSpecs,kitchenUnitSpecs} from './kitchen-model.js';

const partNames={front:'الدرفة',drawer:'الدرج',handle:'اليد',shelf:'الرف',leg:'الرجل',inside:'التقسيم الداخلي',pullout:'السحّاب',accessory:'الإكسسوار',appliance:'الجهاز',divider:'الفاصل',back:'الظهر',body:'الجسم',hinge:'المفصلة',profile:'القطاع',edge:'الحافة'};
export function unitPartLabel(doc,unit,part,index){
 const position=doc.kitchen.units.findIndex(u=>u.id===unit.id);
 return (partNames[part]||'الجزء المحدد')+(index?' '+Number(index).toLocaleString('ar-SA'):'')+' · U'+(position+1)+' · '+(kitchenUnitSpecs[unit.kind]?.label||'وحدة');
}
const target=(route,focus,label)=>({route,focus,label});
export const sheetSelector=[
 'data-sheet-unit','data-dim-unit','data-sheet-feature','data-sheet-apron','data-sheet-upstand','data-plan-upstand','data-sheet-sill','data-plan-sill','data-sheet-worktop','data-sheet-accessory','data-k-site-point','data-k-wall-hit','data-k-wall-opening','data-k-door-guide','data-sheet-wall','data-sheet-run','data-sheet-floor','data-sheet-pair','data-sheet-window-choice'
].map(key=>'['+key+']').join(',');

// Use the nearest piece of actual artwork. Its unit/run and a part ordinal
// remain independent so the same handle SKU on two units is unambiguous.
export function sheetTarget(element,doc,face='plan'){
 const node=element?.closest?.(sheetSelector);if(!node)return null;
 const d=node.dataset;
 const featureBy=id=>doc.kitchen.features.find(f=>f.id===id);
 const runBy=id=>doc.kitchen.runs.find(r=>r.id===id);
 const findWall=id=>id&&architectureWall(doc.room,id);
 const unitId=d.sheetUnit||d.dimUnit,unit=unitId&&doc.kitchen.units.find(u=>u.id===unitId);
 if(unit){
  const part=d.sheetPart,focus={unitId:unit.id,runId:unit.runId},label=kitchenUnitSpecs[unit.kind]?.label||'وحدة';
  if(d.sheetHole===unit.id&&d.sheetTopId)return target('surface',{...focus,topId:d.sheetTopId,holeId:unit.id},unit.kind==='sink'?'فتحة المجلى في الرخام':'فتحة الجهاز في الرخام');
  if(!part)return target('unit',focus,label);
  const ordinal=Number(d.sheetIndex);
  if(Number.isInteger(ordinal)&&ordinal>0)focus.index=ordinal;
  return target('unit-part',{...focus,part},unitPartLabel(doc,unit,part,focus.index));
 }
 const featureId=d.sheetFeature||d.kWallOpening||d.kDoorGuide;
 if(featureId){
  const f=featureBy(featureId);
  return f?target('survey',{wall:f.wall,featureId:f.id,edit:true},kitchenFeatureSpecs[f.kind]?.label||'عنصر الجدار'):null;
 }
 const sill=d.sheetSill||d.planSill||d.sheetWindowChoice;
 if(sill){const f=featureBy(sill);return f?target('assembly',{section:'stone',wall:f.wall,windowId:f.id},'تفصيل الرخام عند الشباك'):null;}
 const wall=d.sheetWall||d.kWallHit||face;
 if(d.sheetPair&&findWall(wall))return target('survey',{wall,tier:d.sheetPair,pair:true},'قياس الظهر والوجه');
 if(d.sheetAccessory){
  const f=featureBy(d.sheetFeatureRef);
  if(f)return target('wallOptions',{wall:f.wall,featureId:f.id},f.kind==='window'?'ستارة الشباك':'غطاء السخان');
  if(!findWall(wall))return null;
  const role=d.sheetAccessory;
  if(d.sheetSection||role.includes('light'))return target('wallOptions',{wall,lighting:true,sectionId:d.sheetSection},'إنارة الدواليب');
  return target('wallOptions',{wall,op:role.includes('cornice')?'cornice/enabled':role.includes('filler')?'mode':undefined},'تجهيز الجدار');
 }
 const upstand=d.sheetUpstand||d.planUpstand;
 if(upstand&&findWall(upstand))return target('assembly',{section:'stone',wall:upstand},'نعلة الرخام');
 if(d.sheetApron){const r=runBy(d.sheetApron);return r?target('assembly',{section:'base',runId:r.id},'ساتر الأرجل'):null;}
 if(d.sheetWorktop){const r=runBy(d.sheetWorktop);return r?target('worktop',{runId:r.id,...(d.sheetTopId?{topId:d.sheetTopId}:{})},'سطح العمل'):null;}
 if(d.kSitePoint){const p=doc.room.sitePoints?.find(p=>p.id===d.kSitePoint);return p?target('floor-point',{pointId:p.id},'نقطة الأرضية'):null;}
 if(d.sheetRun){const r=runBy(d.sheetRun);return r?target('run',{runId:r.id},'الصف'):null;}
 if((d.sheetWall||d.kWallHit)&&findWall(wall))return target('survey',{wall},architectureWallLabel(wall));
 if(d.sheetFloor!==undefined)return target('room-surface',{surface:'floor'},'أرضية المطبخ');
 return null;
}

// Resolve semantic drawing picks at navigation time against the current
// project. Merely selecting a part never changes a material or a dimension.
export function workshopPartTarget(doc,route,focus={}){
 const ws=doc.room.workshop||{};
 if(route==='unit')route='placement';
 if(route==='unit-part'){
  const u=doc.kitchen.units.find(u=>u.id===focus.unitId);
  if(!u)return null;
  const f={...focus,unitId:u.id,runId:u.runId},part=f.part;
  const managed=ws.rows?.[u.runId]?.units?.find(v=>v.id===u.id);
  if(part==='leg')return target('assembly',{...f,section:'base'},'ارتكاز الوحدة');
  if(part==='tap')return target('tap',{sinkId:u.id},'خلاط المجلى');
  if(part==='appliance'){
   const record=ws.applianceIntake?.find(r=>r.host===u.id);
   return record?target('intake',{requestId:record.id},'جهاز العميل'):target('appliances',f,'مطابقة الجهاز');
  }
  if(part==='drawer'&&managed){
   const drawerFocus=u.kind==='drawers'&&f.index?{...f,drawerIndex:f.index}:f;
   return target('row',drawerFocus,'تخصيص الدرج');
  }
  if(part==='inside'||!managed&&['pullout','divider','shelf','drawer'].includes(part)){
   return kitchenUnitSpecs[u.kind]?.editableInterior?target('unit-interior',f,'داخل الوحدة'):target(managed?'row':'placement',f,'خصائص الوحدة');
  }
  if(!managed&&(part==='front'||part==='handle'))return target('cad-material',f,partNames[part]);
  if(managed)return target('finish',{...f,part:part==='pullout'?'accessory':part},partNames[part]);
  return target('placement',f,'خصائص الوحدة');
 }
 if(route==='run'){
  const r=doc.kitchen.runs.find(r=>r.id===focus.runId);
  if(!r)return null;
  return target(ws.rows?.[r.id]?'row':'cad-run',focus,'الصف');
 }
 if(route==='worktop'){
  if(!doc.kitchen.runs.some(r=>r.id===focus.runId))return null;
  return target('top-detail',focus,'سطح العمل');
 }
 if(route==='room-surface'){
  if(focus.surface==='ceiling')return target('surfaces3d',{...focus,kind:'ceiling'},'منسوب السقف');
  if(focus.surface==='threshold'||focus.surface==='skirting')return target('field-part',focus,focus.surface==='threshold'?'عتبة المدخل':'نعلة الجدار');
  return target('room-finish',focus,'تشطيب الغرفة');
 }
 return target(route,focus,'');
}
