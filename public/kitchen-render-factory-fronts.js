// Only the appearance and membership of priced fronts is needed by the scene.
// Keep customer and pricing data out of drawing and photography payloads.
import {catalogDisplayColor,finishMembers} from './kitchen-finish-parts.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';

export function frontAppearanceSource(workshop){
  const catalog=readWorkshopCatalog(workshop);
  if(!catalog||(!workshop.rows&&!workshop.chains))return null;
  const items=(catalog.items||[]).filter(i=>i.kind==='panel'&&i.role==='front')
    .map(i=>({sku:i.sku,color:catalogDisplayColor(i)}));
  const families=Object.fromEntries(Object.entries(catalog.families||{}).map(([key,f])=>[
    key,[...new Set(f.recipe.filter(line=>line.role==='front').map(line=>line.sku))]
  ]));
  const rows=Object.fromEntries(Object.entries(workshop.rows||{}).map(([key,row])=>[
    key,{units:row.units.map(({id,family,recipeId})=>({id,family,recipeId}))}
  ]));
  const units=Object.fromEntries(Object.entries(workshop.finishes?.units||{}).map(([key,v])=>[key,v.frontSku]));
  return {catalog:{items,families},rows,chains:Object.fromEntries(Object.keys(workshop.chains||{}).map(w=>[w,true])),
    frontSku:workshop.finishes?.frontSku,units};
}

export function factoryFrontSurfaces(kitchen,source){
  const paints=new Map();
  if(!source)return paints;
  const materials=new Map(source.catalog.items.map(i=>[i.sku,i]));
  const members=finishMembers({kitchen,room:{workshop:source}},source.catalog);
  for(const unit of members){
    const skus=source.catalog.families[unit.family];
    if(!skus?.length)continue; // The customer's freestanding appliance has no factory facade.
    const selected=source.units[unit.id]||source.frontSku||(skus.length===1?skus[0]:null);
    const material=materials.get(selected);
    if(material)paints.set(unit.id,material);
  }
  return paints;
}
