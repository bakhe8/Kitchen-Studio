import assert from 'node:assert/strict';
import {seedCatalog,cleanCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {readWorkshopCatalog} from '../public/kitchen-catalog-view.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {frontAppearanceSource,factoryFrontSurfaces} from '../public/kitchen-render-factory-fronts.js';
import {installedFitout} from '../public/kitchen-fitout-visual.js';
import {factoryHandleSummary} from '../public/kitchen-finish-parts.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {scenePlan} from '../public/kitchen-project.js';
import {elevationSheet,planSheet} from '../public/kitchen-sheet.js';
import {orderHandoffUnits,manufacturingKeys} from '../public/kitchen-order-domain.js';
import {serviceMountSignature} from '../public/kitchen-service-zones.js';
import {surfaceReleaseIssues} from '../public/kitchen-surface-release.js';
import {unitSnapshot} from '../public/kitchen-design-versions.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {snapFactoryWidthMm} from '../public/kitchen-proposal-change.js';

// The two joined cabinets, adjustable legs and shared apron follow the existing
// base-support example. A factory upstand and selected front make missing
// catalogs visible in the drawing as well as the production quantities.
const catalog=seedCatalog();catalog.approved=true;catalog.revision=7;catalog.layoutRevision=3;
catalog.items.forEach(i=>i.price=10);
Object.assign(catalog.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0,worktop:'include'});
const item=(source,sku,attrs={})=>({...catalog.items.find(i=>i.sku===source),sku,name:sku,...attrs});
catalog.items.push(item('HINGE','L-80'),item('HINGE','CLIP'),item('AL-20','PL-80',{sectionWidthMm:80,stockLengthMm:1800}),
 item('BODY-6','STONE',{thicknessMm:20,stockLengthMm:3200,stockWidthMm:1600,colorHex:'#867259'}));
catalog.items.find(i=>i.sku==='FACE-6-G').colorHex='#718b61';
catalog.families.storage.label='Split snapshot storage';
catalog.families.storage.finishSlots={handle:{source:'PULL',skus:['PULL'],labels:['يد'],mode:'matching',reference:'TEST-HANDLE'}};
catalog.baseSupport={rules:{legs:{family:'storage',mode:'legs',site:'any',default:true,minWidthMm:200,maxWidthMm:1200,
 bodyClearMm:80,apron:'p',count:4,sku:'L-80',supply:'assembly',reference:'QA-LEGS',label:'Legged storage'}},
 aprons:{p:{sku:'PL-80',label:'Shared apron',heightMm:80,thicknessMm:3,insetMm:40,reference:'QA-APRON',fixing:'separate',clipSku:'CLIP',clipsPerUnit:2}}};
catalog.upstandProfiles=[{id:'U1',sku:'STONE',heightMm:100,reference:'QA-UPSTAND'}];
const units=['a','b'].map((id,i)=>({id,runId:'r',kind:'storage',width:60,u:i*60}));
const legacy={room:{width:500,height:290,length:500,workshop:{catalog:cleanCatalog(catalog),
 rows:{r:{catalogVersion:'3',warnings:[],units:units.map(u=>({id:u.id,family:'storage',recipeId:'storage',startMm:u.u*10,widthMm:600}))}},
 finishes:{frontSku:'FACE-6-G'},upstand:{choice:{mode:'factory',profileId:'U1'},walls:{}}}},
 kitchen:{features:[],units,runs:[{id:'r',tier:'base',wall:'back',start:0,end:120,depth:60,height:86,bottom:0}]}};
assert(legacy.room.workshop.catalog,'The production fixture must have a valid catalog.');
const canonical={...legacy,room:{...legacy.room,workshop:normalizeWorkshopCatalogs(legacy.room.workshop)}};
assert(canonical.room.workshop);
const json=JSON.parse(JSON.stringify(canonical)),cloned=structuredClone(canonical);
for(const doc of [json,cloned])assert(!Object.hasOwn(doc.room.workshop,'catalog'),'Serialized snapshots have no compatibility property.');

const geometry=kitchenGeometry(legacy.kitchen,legacy.room),appearance=frontAppearanceSource(legacy.room.workshop),quote=buildFactoryQuote(legacy);
assert.equal(geometry.units[0].baseSupport.bodyClearMm,80);
assert.equal(quote.pieces.find(p=>p.unitId==='a'&&p.label==='قائم جسم').a,780);
assert.equal(quote.pieces.find(p=>p.family==='baseApron').a,1200);
assert(quote.pieces.some(p=>p.family==='upstand'&&p.sku==='STONE'));
assert.equal(factoryFrontSurfaces(legacy.kitchen,appearance).get('a').color,'#718b61');
assert(factoryHandleSummary(legacy).length);
assert(surfaceReleaseIssues(legacy).length,'An included top without a final template must remain blocked.');
const photoPlan=doc=>{const plan=scenePlan(doc.room,doc.kitchen);return {...plan,room:{...plan.room,workshop:doc.room.workshop}};};
const originalText=JSON.stringify(legacy),canonicalText=JSON.stringify(json);
const readers={
 geometry:doc=>kitchenGeometry(doc.kitchen,doc.room),
 appearance:doc=>frontAppearanceSource(doc.room.workshop),
 fitout:doc=>installedFitout(doc.room,doc.kitchen),
 frontSurfaces:doc=>factoryFrontSurfaces(doc.kitchen,frontAppearanceSource(doc.room.workshop)),
 handles:doc=>factoryHandleSummary(doc),
 // Face basis methods are fresh closures; compare their material and polygon
 // payload, while the full source geometry is compared independently above.
 photo:doc=>JSON.parse(JSON.stringify(getKitchenPhotoMesh(photoPlan(doc),doc.kitchen).faces)),
 elevation:doc=>elevationSheet(doc),
 plan:doc=>planSheet(doc),
 quote:doc=>buildFactoryQuote(doc),
 handoff:doc=>orderHandoffUnits(doc),
 manufacturing:doc=>manufacturingKeys(doc),
 service:doc=>serviceMountSignature(doc,'a'),
 surface:doc=>surfaceReleaseIssues(doc),
 snapshot:doc=>unitSnapshot(doc),
 proposal:doc=>proposalUnits(doc),
 snappedWidth:doc=>snapFactoryWidthMm(doc,'a',625)
};
for(const [name,read] of Object.entries(readers)){
 const expected=read(legacy);
 for(const [format,doc] of [['JSON',json],['structuredClone',cloned]])assert.deepEqual(read(doc),expected,name+' must survive '+format+' split snapshots.');
}
assert.equal(JSON.stringify(legacy),originalText,'Readers must not mutate the legacy document.');
assert.equal(JSON.stringify(json),canonicalText,'Readers must not synthesize or attach a serialized catalog.');
assert.equal(unitSnapshot(json)[0].label,'Split snapshot storage');
assert.equal(proposalUnits(json)[0].label,'Split snapshot storage');

const partial={catalog:{items:[{sku:'VISUAL',kind:'panel',role:'front',colorHex:'#123456'}],families:{storage:{recipe:[{sku:'VISUAL',role:'front'}]}}},
 rows:{r:{units:[{id:'a',family:'storage'}]}},finishes:{frontSku:'VISUAL'}};
assert.equal(readWorkshopCatalog(partial),partial.catalog,'Partial drawing catalogs retain their original fields.');
assert.equal(factoryFrontSurfaces(legacy.kitchen,frontAppearanceSource(partial)).get('a').color,'#123456');
assert.equal(readWorkshopCatalog({}),null);assert.equal(readWorkshopCatalog(null),null);
assert.equal(frontAppearanceSource({rows:{}}),null,'No source catalog must not introduce demo materials.');
console.log('PASS: JSON and cloned split snapshots preserve geometry, front appearance, fitout, drawings, takeoff, handoff, manufacturing signatures and labels; partial visual views remain readable without seeding.');
