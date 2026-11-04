// Rendering and geometry must not import catalog validation: that would load the
// factory/chain model while the geometry model itself is still initializing.
// Persisted records are validated at project/import boundaries. This module only
// projects their fields for readers, including deliberately partial scene views.
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const catalogRecordNames=['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'];
export const catalogFactoryFields=['families','baseSupport','upstandProfiles','linearKits','wallAccessories','scribePolicies','cornerRecipes','trims','specials','machining'];
export function readWorkshopCatalog(w){
 if(!object(w))return null;
 if(!catalogRecordNames.some(k=>Object.hasOwn(w,k)))return w.catalog??null;
 if(!catalogRecordNames.every(k=>object(w[k])))return null;
 const {storeCatalog:s,factoryRecipes:f,pricingTerms:p,catalogMeta:m}=w;
 if(!Array.isArray(s.items)||!object(f.families)||!object(p.terms)||!object(p.wallRates))return null;
 return {...Object.fromEntries(catalogFactoryFields.filter(k=>f[k]!==undefined).map(k=>[k,f[k]])),
  version:1,name:s.name,revision:m.revision,layoutRevision:m.layoutRevision,approved:f.approved,
  items:s.items,terms:p.terms,wallRates:p.wallRates,...(m.teamSource?{teamSource:m.teamSource}:{})};
}
