// The factory catalog set up once on this device. A new project starts from it, so its items are already priced and its recipes already
// approved on the first visit. It is the template the factory step has always saved under this key ("save as a template on the device").
import {decodePortableCatalog,encodePortableCatalog,installPortableCatalog} from './kitchen-factory-template.js';
import {catalogRecordsFromWorkshop,catalogRecordStates,hasWorkshopCatalog,normalizeWorkshopCatalogs} from './kitchen-catalog-records.js';
export const deviceCatalogKey='kitchen-factory-template:v1';
const storeOf=store=>store??globalThis.localStorage;
const termLabels={labor:'أجور التصنيع',installation:'التركيب',delivery:'النقل',marginPct:'إضافة البيع ٪',taxPct:'الضريبة ٪'};
const numbers=new Intl.NumberFormat('ar-SA');

export function readDeviceCatalog(store){
 try{
  const raw=storeOf(store)?.getItem(deviceCatalogKey),workshop=raw&&decodePortableCatalog(JSON.parse(raw));if(!workshop)return null;
  const value={type:'kitchen-catalog-records',version:1,...catalogRecordsFromWorkshop(workshop)};
  // Existing UI reads name/items/approved. These aliases are never serialized:
  // saving or copying a device template retains its three independent records.
  for(const key of Object.keys(workshop.catalog))if(!Object.hasOwn(value,key))Object.defineProperty(value,key,{enumerable:false,get:()=>workshop.catalog[key]});
  return value;
 }catch{return null;}
}
// Whether a catalog can price a project: its recipes are approved by the factory, every item has a price and the five sale terms are set.
export function catalogReadiness(catalog){
 const workshop=decodePortableCatalog(catalog);if(!workshop)return {state:'none'};
 catalog=workshop.catalog;const states=catalogRecordStates(workshop);
 const unpriced=catalog.items.filter(i=>!Number.isFinite(i.price)).map(i=>i.name||i.sku);
 const missingTerms=Object.entries(termLabels).filter(([k])=>!Number.isFinite(catalog.terms?.[k])).map(([,label])=>label);
 const pendingRecords=Object.entries(states).filter(([,s])=>!s.approved).map(([role])=>role);
 const facts={name:catalog.name,revision:catalog.revision,unpriced,missingTerms,pendingRecords};
 if(!catalog.approved)return {...facts,state:'draft'};
 return {...facts,state:unpriced.length||missingTerms.length||pendingRecords.length?'incomplete':'ready'};
}
export function readinessText(r){
 if(r.state==='none')return 'لا يوجد كتالوج مصنع محفوظ على هذا الجهاز، فلن تظهر أسعار في الزيارة. أعدّه مرة واحدة قبل الزيارة.';
 if(r.state==='draft')return 'كتالوج «'+r.name+'» المحفوظ على هذا الجهاز لم تُعتمد وصفاته بعد، فلن تبدأ به المشاريع الجديدة ولن تظهر أسعار. اعتمده ثم احفظه من جديد.';
 if(r.state==='incomplete'){
   const recordLabels={store:'اعتماد أصناف المتجر',pricing:'اعتماد شروط التسعير'};
   const gaps=[...(r.unpriced.length?[numbers.format(r.unpriced.length)+(r.unpriced.length===1?' صنف بلا سعر':' أصناف بلا سعر')]:[]),...r.missingTerms,...(r.pendingRecords||[]).filter(role=>recordLabels[role]).map(role=>recordLabels[role])];
  return 'كتالوج «'+r.name+'» معتمد لكن ينقصه: '+gaps.join('، ')+'. أكمله قبل الزيارة لتظهر الأسعار.';
 }
 return 'كتالوج المصنع جاهز على هذا الجهاز: «'+r.name+'» · إصدار '+numbers.format(r.revision)+' · معتمد. تبدأ به مشاريعك الجديدة ببنود مسعّرة.';
}
export const deviceReadiness=store=>catalogReadiness(readDeviceCatalog(store));

// A project that is just being created gets the device catalog, when the factory has approved it. A project that already has its own
// catalog (an opened file, a team template) is never touched.
export function withDeviceCatalog(doc,store){
 if(hasWorkshopCatalog(doc?.room?.workshop))return doc;
 const template=readDeviceCatalog(store);
 if(!template?.approved)return doc;
 const encoded=encodePortableCatalog(template),records=encoded&&catalogRecordsFromWorkshop(encoded);
 const workshop=records&&normalizeWorkshopCatalogs({...doc.room.workshop,...records});
 return workshop?{...doc,room:{...doc.room,workshop}}:doc;
}
// The device catalog for a project that is already open, keeping its approval. Custom cut sheets belong to the project and were checked
// against the catalog it had, so a project that carries any needs its recipes approved again by a person.
export function installDeviceCatalog(doc,template){
 const decoded=decodePortableCatalog(template);if(!decoded?.catalog?.approved)return null;
 return installPortableCatalog(doc,decoded);
}
