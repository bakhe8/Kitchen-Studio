import {cleanCatalog,factoryLayoutKey} from './kitchen-workshop-factory.js';
import {catalogRecordNames,catalogFactoryFields} from './kitchen-catalog-view.js';
export {readWorkshopCatalog} from './kitchen-catalog-view.js';

// These records own stored data. The flat catalog is only the calculation and
// rendering adapter for the existing manufacturing model; it is never serialized.
const recordKeys=catalogRecordNames;
const factoryKeys=catalogFactoryFields;
const roleKeys={store:'storeCatalog',factory:'factoryRecipes',pricing:'pricingTerms'};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const ordinal=v=>Number.isInteger(v)&&v>=1&&v<=1e9;
const header=v=>object(v)&&v.version===1&&ordinal(v.revision)&&typeof v.approved==='boolean';
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
const allowed=(v,keys)=>Object.keys(v).every(k=>keys.includes(k));
const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const payload=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['version','revision','approved'].includes(k)));
const splitPresent=w=>recordKeys.some(k=>Object.hasOwn(w,k));
export const hasWorkshopCatalog=w=>object(w)&&(Object.hasOwn(w,'catalog')||splitPresent(w));

function splitFlat(c){
 const h={version:1,revision:c.revision,approved:c.approved};
 return {
  storeCatalog:{...h,name:c.name,items:c.items},
  factoryRecipes:{...h,...pick(c,factoryKeys)},
  pricingTerms:{...h,terms:c.terms,wallRates:c.wallRates},
  catalogMeta:{version:1,name:c.name,revision:c.revision,layoutRevision:c.layoutRevision,...(c.teamSource?{teamSource:c.teamSource}:{})}
 };
}
function flatFromRecords(r){
 return cleanCatalog({...pick(r.factoryRecipes,factoryKeys),...r.catalogMeta,approved:r.factoryRecipes.approved,
  name:r.storeCatalog.name,items:r.storeCatalog.items,terms:r.pricingTerms.terms,wallRates:r.pricingTerms.wallRates});
}
function checkedRecords(w){
 if(!recordKeys.every(k=>Object.hasOwn(w,k)))return null;
 const {storeCatalog:s,factoryRecipes:f,pricingTerms:p,catalogMeta:m}=w;
 if(!header(s)||!header(f)||!header(p)||!object(m)||m.version!==1||!ordinal(m.revision)||!ordinal(m.layoutRevision)||m.layoutRevision>m.revision||m.name!==s.name)return null;
 if(!allowed(s,['version','revision','approved','name','items'])||!allowed(f,['version','revision','approved',...factoryKeys])||
    !allowed(p,['version','revision','approved','terms','wallRates'])||!allowed(m,['version','name','revision','layoutRevision','teamSource']))return null;
 if(!Array.isArray(s.items)||!object(f.families)||!object(p.terms)||!object(p.wallRates))return null;
 const flat=flatFromRecords(w);if(!flat)return null;
 const records=splitFlat(flat);
 for(const k of ['storeCatalog','factoryRecipes','pricingTerms']){
  records[k].revision=w[k].revision;records[k].approved=w[k].approved;
 }
 return records;
}

export function catalogRecordsFromWorkshop(w){
 if(!object(w))return null;
 if(splitPresent(w)){
  const records=checkedRecords(w);if(!records)return null;
  // Both forms can arrive in an archive, but neither may hide a disagreement.
  if(Object.prototype.propertyIsEnumerable.call(w,'catalog')){
   const legacy=cleanCatalog(w.catalog);if(!legacy||!equal(legacy,flatFromRecords(records)))return null;
  }
  return records;
 }
 const legacy=cleanCatalog(w.catalog);return legacy?splitFlat(legacy):null;
}
export function workshopCatalogView(w){
 const records=catalogRecordsFromWorkshop(w);return records?flatFromRecords(records):null;
}
export function normalizeWorkshopCatalogs(w){
 if(!object(w))return null;
 if(!hasWorkshopCatalog(w))return {...w};
 const records=catalogRecordsFromWorkshop(w);if(!records)return null;
 const next={...w,...records};delete next.catalog;
 Object.defineProperty(next,'catalog',{value:flatFromRecords(records),enumerable:false,configurable:true});
 return next;
}
export function catalogRecordStates(w){
 const records=catalogRecordsFromWorkshop(w);if(!records)return null;
 return Object.fromEntries(Object.entries(roleKeys).map(([role,key])=>[role,pick(records[key],['revision','approved'])]));
}

const storeOnlyFields=new Set(['price','stockUnits','available','offcuts','leadDays','name']);
function engineeringChanged(before,after,beforeWorkshop,afterWorkshop){
 const ids=new Set([...before.storeCatalog.items,...after.storeCatalog.items].map(i=>i.sku)),used=new Set();
 const visit=v=>{if(typeof v==='string'&&ids.has(v))used.add(v);else if(Array.isArray(v))v.forEach(visit);else if(object(v))Object.values(v).forEach(visit);};
 visit(payload(before.factoryRecipes));visit(payload(after.factoryRecipes));
 // Published finish/runner alternatives are already visited in the recipes.
 // Legacy front recipes without a restricted frontSkus list accept every front
 // panel, and project choices can select an SKU absent from the base recipe.
 for(const records of [before,after]){
  const openFronts=Object.values(records.factoryRecipes.families).some(f=>!f.frontSkus?.length&&f.recipe.some(l=>l.role==='front'));
  if(openFronts)for(const item of records.storeCatalog.items)if(item.kind==='panel'&&item.role==='front')used.add(item.sku);
 }
 for(const workshop of [beforeWorkshop,afterWorkshop])for(const field of ['finishes','rows','baseSupport','upstand','corners','options'])visit(workshop?.[field]);
 const descriptors=items=>new Map(items.map(i=>[i.sku,Object.fromEntries(Object.entries(i).filter(([k])=>!storeOnlyFields.has(k)))]));
 const old=descriptors(before.storeCatalog.items),next=descriptors(after.storeCatalog.items);
 return [...used].some(sku=>!equal(old.get(sku),next.get(sku)));
}
export function reconcileWorkshopCatalogs(nextW,beforeW){
 if(!object(nextW))return null;
 if(!Object.prototype.propertyIsEnumerable.call(nextW,'catalog'))return normalizeWorkshopCatalogs(nextW);
 const flat=cleanCatalog(nextW.catalog);if(!flat)return null;
 const before=catalogRecordsFromWorkshop(beforeW),incoming=splitFlat(flat);
 if(!before)return normalizeWorkshopCatalogs({...nextW,...incoming,catalog:flat});
 const result={...incoming};let changed=false;
 for(const key of ['storeCatalog','factoryRecipes','pricingTerms']){
  const edited=!equal(payload(before[key]),payload(incoming[key]));changed||=edited;
  if(edited&&before[key].revision===1e9)return null;
  result[key]=edited?{...incoming[key],revision:before[key].revision+1,approved:false}:before[key];
 }
 if(engineeringChanged(before,result,beforeW,nextW)&&result.factoryRecipes.approved){result.factoryRecipes={...result.factoryRecipes,approved:false};changed=true;}
 // Legacy approval-only actions describe recipes. A content edit never grants
 // approval implicitly and an old editor's aggregate `false` cannot revoke an
 // untouched factory approval after changing a price or commercial term.
 if(!changed&&flat.approved!==before.factoryRecipes.approved){result.factoryRecipes={...result.factoryRecipes,approved:flat.approved};changed=true;}
 if(!equal(before.catalogMeta.teamSource,incoming.catalogMeta.teamSource))changed=true;
 if(changed){
  if(before.catalogMeta.revision===1e9)return null;
  const revision=Math.max(before.catalogMeta.revision+1,flat.revision);
  result.catalogMeta={...incoming.catalogMeta,revision,layoutRevision:factoryLayoutKey(flatFromRecords(before))===factoryLayoutKey(flat)?before.catalogMeta.layoutRevision:revision};
 }else result.catalogMeta=before.catalogMeta;
 const next={...nextW,...result};delete next.catalog;
 return normalizeWorkshopCatalogs(next);
}
export function approveWorkshopCatalogRecord(w,role){
 if(typeof role!=='string'||!Object.hasOwn(roleKeys,role))return null;
 const records=catalogRecordsFromWorkshop(w);if(!records)return null;
 const key=roleKeys[role],next={...w,...records,[key]:{...records[key],approved:true}};delete next.catalog;
 return normalizeWorkshopCatalogs(next);
}
