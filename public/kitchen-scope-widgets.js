// Transient widget input, not an archive. Only DTO.editable is sent to the server.
// No device template, legacy open slot or private catalog is read here.
import {createKitchen} from './kitchen-model.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
import {catalogFactoryFields} from './kitchen-catalog-view.js';
import {ownedWorkshopFields,repRoomFields} from './kitchen-project-scope.js';
import {fieldInputRole} from './kitchen-access-policy.js';
import {cleanCatalog,cleanCatalogItems} from './kitchen-workshop-factory.js';
import {pantryRequests} from './kitchen-pantry-brief.js';
const clone=v=>structuredClone(v),pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,clone(v[k])]));
export const scopeWidgetId=view=>'K-'+offlineDigest(new TextEncoder().encode(JSON.stringify([view.access.subject,view.project.id,view.access.role,view.access.scopeVersion]))).slice(0,16).toUpperCase();
export function scopeCatalogForWidget(view){
 const role=view.access.role,e=view.editable;
 if(role==='store')return e.storeCatalog?{...clone(e.storeCatalog),layoutRevision:e.storeCatalog.revision,families:{},terms:{},wallRates:{}}:null;
 if(role!=='factory'||!e.factoryRecipes)return null;
 // Commercial fields are explicitly unavailable. This adapter is only used by
 // recipe editors; no quote, template export or full-archive install consumes it.
 return {...clone(e.factoryRecipes),version:1,name:'وصفات المصنع',layoutRevision:e.factoryRecipes.revision,
  items:(view.context.materials||[]).map(i=>({...clone(i),...(i.runnerSpec?{runnerSpec:{...clone(i.runnerSpec),reference:'مرجع خاص لدى المتجر، غير متاح في هذا النطاق'}}:{}),price:null,stockUnits:null,offcuts:[],available:true})),
  terms:{labor:null,installation:null,delivery:null,marginPct:null,taxPct:null,worktop:'separate'},wallRates:{}};
}
export function scopeWidgetDocument(view){
 const role=view.access.role,e=view.editable,geometry=role==='rep'?e:view.context.geometry;
 const room={width:400,length:400,height:280,colors:{},...clone(geometry?.room||{}),projectId:scopeWidgetId(view)};
 room.name=role==='rep'?room.name||'مشروع الزيارة':role==='factory'?'بيانات التصنيع':'كتالوج المتجر';
 room.workshop={...clone(geometry?.workshop||{}),...Object.fromEntries(Object.entries(e.workshop||{}).filter(([,v])=>v!==null).map(([k,v])=>[k,clone(v)]))};
 if(e.fieldRegister)room.fieldRegister=clone(e.fieldRegister);
 if(e.defaults)room.defaults={version:1,base:{kind:'profile',name:'قيم دورك في المشروع',version:1,rows:clone(e.defaults.baseRows)},overrides:clone(e.defaults.overrides)};
 const catalog=scopeCatalogForWidget(view);if(role==='factory'&&catalog)room.workshop.catalog=catalog;
 const kitchen=clone(geometry?.kitchen||createKitchen(room,'empty'));
 // Redacted reference strings are not needed to display the physical geometry.
 if(role==='factory')for(const u of kitchen.units||[])if(u.modelSpec)u.modelSpec={...u.modelSpec,model:'مواصفة الجهاز',manual:'مرجع لدى المندوب'};
 return {room,kitchen};
}
export function scopeEditableFromWidget(view,doc,{files=view.editable.fieldFiles,photos=view.editable.photos}={}){
 const role=view.access.role,e=clone(view.editable);
 if(role==='store')return e; // Catalog editors write the owned record directly.
 if(role==='rep'){e.room=pick(doc.room,repRoomFields);e.kitchen=clone(doc.kitchen);e.photos=clone(photos||{});}
 e.workshop=Object.fromEntries(ownedWorkshopFields(role).map(k=>[k,doc.room.workshop?.[k]===undefined?null:clone(doc.room.workshop[k])]));
 if(role==='factory'&&e.workshop.referenceOrder){delete e.workshop.referenceOrder.materialCost;delete e.workshop.referenceOrder.approval;}
 e.fieldRegister={version:1,records:(doc.room.fieldRegister?.records||[]).filter(r=>fieldInputRole(r.inputCode)===role).map(clone)};
 e.defaults={baseRows:(doc.room.defaults?.base?.rows||[]).filter(r=>fieldInputRole(r.code)===role).map(clone),overrides:(doc.room.defaults?.overrides||[]).filter(r=>fieldInputRole(r.code)===role).map(clone)};
 const ids=new Set(e.fieldRegister.records.flatMap(r=>(r.attachments||[]).map(a=>a.id)));
 // Keep visible photo assets as well. Server validates references independently.
 if(role==='rep')for(const p of Object.values(e.room.photoRefs||{}))if(typeof p==='string')ids.add(p);
 e.fieldFiles=(files||[]).filter(f=>ids.has(f.id)||role==='rep'&&f.id.startsWith('asset-')).map(clone);
 return e;
}
export function scopeRecordFromCatalog(view,catalog){
 const role=view.access.role,key=role==='store'?'storeCatalog':'factoryRecipes',before=view.editable[key];
 if(!before)throw Error('يهيئ المالك هذا السجل أولًا.');
 // Canonicalize only data actually available to this role. Store items need no
 // factory scaffold; factory validation uses its real recipes and public specs.
 const normalized=role==='store'?{name:catalog.name,items:cleanCatalogItems(catalog.items)}:cleanCatalog(catalog);
 if(!normalized||role==='store'&&!normalized.items)throw Error('راجع قيم السجل وأبعاد الأصناف قبل الحفظ.');
 return {...clone(before),...pick(normalized,role==='store'?['name','items']:catalogFactoryFields),revision:before.revision+1,approved:false};
}
export function scopeDesignOptions(doc){const units=doc.kitchen.units||[],intake=doc.room.workshop?.applianceIntake||[];return {sink:!units.length||units.some(u=>u.kind==='sink'),dishwasher:units.some(u=>u.kind==='dishwasher')||intake.some(r=>r.kind==='dishwasher'),rice:pantryRequests(doc).some(r=>r.confirmed&&r.choice!=='none')||Object.values(doc.room.workshop?.rows||{}).some(r=>r.units?.some(u=>u.family==='rice'))};}
export function approvedSaleHTML(sale){
 if(sale?.status!=='approved'||!Number.isSafeInteger(sale.totalMinor)||sale.totalMinor<0)return '<p>لم يعتمد المالك سعر البيع لهذه النسخة بعد.</p>';
 return '<p>سعر البيع النهائي المعتمد</p><strong class="scope-sale">'+new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format(sale.totalMinor/100)+'</strong><p>للنسخة '+Number(sale.revision).toLocaleString('ar-SA')+'</p>';
}
