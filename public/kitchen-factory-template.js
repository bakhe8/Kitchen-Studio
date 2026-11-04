import {cleanCatalog,factoryLayoutKey} from './kitchen-workshop-factory.js';
import {catalogRecordsFromWorkshop,normalizeWorkshopCatalogs} from './kitchen-catalog-records.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
// Accept published v1 catalogs as well as the three-record format. Decoding never
// promotes a draft record to approved and leaves project-specific fields alone.
export function decodePortableCatalog(raw){
 if(!raw||typeof raw!=='object')return null;
 if(raw.type!==undefined&&(raw.type!=='kitchen-catalog-records'||raw.version!==1))return null;
 const split=Object.hasOwn(raw,'storeCatalog')||Object.hasOwn(raw,'factoryRecipes')||Object.hasOwn(raw,'pricingTerms')||Object.hasOwn(raw,'catalogMeta');
 const records=catalogRecordsFromWorkshop(split||Object.hasOwn(raw,'catalog')?raw:{catalog:raw});
 return records?normalizeWorkshopCatalogs(records):null;
}
// The wire format carries independent approvals. The legacy composite remains a
// calculation view only; serializing that view would lose two approval records.
export function encodePortableCatalog(raw){
 const decoded=decodePortableCatalog(raw);if(!decoded)return null;
 const records=catalogRecordsFromWorkshop(decoded);
 records.storeCatalog.revision=1;records.factoryRecipes.revision=1;records.pricingTerms.revision=1;
 records.factoryRecipes.specials={};
 records.catalogMeta={...records.catalogMeta,revision:1,layoutRevision:1};delete records.catalogMeta.teamSource;
 return {type:'kitchen-catalog-records',version:1,...records};
}
// Template revisions are independent of a project's ordinal and custom cut sheets.
export function portableFactoryCatalog(c){
 const decoded=decodePortableCatalog(c),checked=decoded&&cleanCatalog(decoded.catalog);if(!checked)return null;
 const {teamSource,specials,revision,layoutRevision,...values}=checked;
 return {...values,revision:1,layoutRevision:1,specials:{}};
}
export function catalogFingerprint(c){
 const data=portableFactoryCatalog(c);if(!data)return '';
 return offlineDigest(new TextEncoder().encode(JSON.stringify({...data,approved:true})));
}
export function installPortableCatalog(doc,template){
 const w=doc.room.workshop||{},previous=normalizeWorkshopCatalogs(w),prev=previous?.catalog;
 const decoded=decodePortableCatalog(template),records=decoded&&catalogRecordsFromWorkshop(decoded),incoming=decoded?.catalog;
 if(!incoming)return null;
 const revision=(prev?.revision||0)+1;
 const same=prev&&factoryLayoutKey(prev)===factoryLayoutKey(incoming);
 const carryingSheets=Object.keys(prev?.specials||{}).length>0;
 const reviewed=!!prev?.approved&&catalogFingerprint(prev)===catalogFingerprint(incoming);
 records.factoryRecipes={...records.factoryRecipes,approved:records.factoryRecipes.approved&&(!carryingSheets||reviewed),specials:prev?.specials||{}};
 records.catalogMeta={...records.catalogMeta,revision,layoutRevision:same?prev.layoutRevision:revision};delete records.catalogMeta.teamSource;
 const next={...w,...records};delete next.catalog;
 const workshop=normalizeWorkshopCatalogs(next);if(!workshop)return null;
 return {...doc,room:{...doc.room,workshop}};
}
export function installTeamCatalog(doc,source,template){
 const encoded=encodePortableCatalog(template),incoming=encoded&&portableFactoryCatalog(encoded);
 if(!incoming?.approved||catalogFingerprint(incoming)!==source?.digest)return null;
 const installed=installPortableCatalog(doc,encoded);if(!installed)return null;
 const w=installed.room.workshop;
 const workshop=normalizeWorkshopCatalogs({...w,catalogMeta:{...w.catalogMeta,teamSource:source}});
 return workshop?{...installed,room:{...installed.room,workshop}}:null;
}
