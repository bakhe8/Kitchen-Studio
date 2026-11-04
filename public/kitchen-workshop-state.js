import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {normalizeWorkshopCatalogs,catalogRecordStates} from './kitchen-catalog-records.js';
import {cleanReferenceOrder} from './kitchen-reference-order.js';
import {cleanWallPairs} from './kitchen-wall-pair.js';
import {cleanBaseSupportChoices} from './kitchen-base-support.js';
import {cleanUpstandSpec} from './kitchen-worktop-upstand.js';
import {cleanTapChecks,tapWindowIssues} from './kitchen-tap-window.js';
import {cleanDecisionReview,configuredCorners,decisionIssues} from './kitchen-project-decisions.js';
import {cleanCornerFronts} from './kitchen-corner-finishes.js';
import {cleanApplianceIntake,intakeIssues} from './kitchen-appliance-intake.js';
import {cleanFinishSelection,finishGeometryChanges} from './kitchen-finish-parts.js';
import {cleanLayoutBrief,budgetHold} from './kitchen-layout-brief.js';
import {cleanMeasuredSurfaces,surveyedSurfaceIssues} from './kitchen-surveyed-surfaces.js';
import {cleanMeasureFit,evaluateMeasureFit} from './kitchen-measure-fit.js';
import {cleanPipeRoutes,evaluatePipeRoutes} from './kitchen-pipe-routes.js';
import {cleanInstallReadiness,installReadinessIssues} from './kitchen-install-readiness.js';
import {cleanCutPatterns} from './kitchen-surface-pattern.js';
import {cleanWallProfiles,profileIssues} from './kitchen-wall-profile.js';
import {cleanClientUsage,clientUsageIssues} from './kitchen-client-usage.js';
import {cleanApplianceSchedule,evaluateApplianceFit} from './kitchen-appliance-fit.js';
import {cleanServiceZones,serviceZoneIssues} from './kitchen-service-zones.js';
import {cleanSurfaceTemplate,surfaceReleaseIssues} from './kitchen-surface-release.js';
import {currentRiceWarnings} from './kitchen-production-row-rice.js';
import {currentDishwasherWarnings} from './kitchen-production-row-equipment.js';
import {revisionDigest,offlineDigest} from './kitchen-workshop-revision.js';
import {cleanChainOptions} from './kitchen-chain-options.js';
import {cleanProductionCorners,cornerMotionIssues} from './kitchen-production-row-corners.js';
import {recordReleaseIssues} from './kitchen-field-release.js';
import {kitchenGeometry,kitchenUnitSpecs,kitchenFeatureSpecs,surveyDesignConflicts} from './kitchen-model.js';
import {cleanChains,siteReleaseIssues,linkedReadingIndex} from './kitchen-chain-model.js';
import {cleanProductionRows,rowModelIssues} from './kitchen-production-row.js';
import {getFactoryCatalog,buildFactoryQuote} from './kitchen-workshop-factory.js';
import {cleanVersions} from './kitchen-design-version-clean.js';

const object=v=>!!v && typeof v==='object' && !Array.isArray(v);
const id=s=>typeof s==='string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,70}$/.test(s)&&!inheritedName(s);
const stamp=v=>object(v) && /^[0-9a-f]{64}$/.test(v.key) && typeof v.name==='string' && !!v.name.trim() && v.name.length<=90 && typeof v.date==='string' && Number.isFinite(Date.parse(v.date));
export function cleanWorkshop(raw){
 if(!object(raw))return null;
 const catalogFields=Object.fromEntries(['catalog','storeCatalog','factoryRecipes','pricingTerms','catalogMeta'].filter(k=>Object.prototype.propertyIsEnumerable.call(raw,k)).map(k=>[k,raw[k]]));
 const w=normalizeWorkshopCatalogs(catalogFields);if(!w)return null;
 for(const [key,clean] of Object.entries({referenceOrder:cleanReferenceOrder,wallPairs:cleanWallPairs,baseSupport:cleanBaseSupportChoices,upstand:cleanUpstandSpec,tapChecks:cleanTapChecks,decisionReview:cleanDecisionReview,applianceIntake:cleanApplianceIntake,chains:cleanChains,layoutBrief:cleanLayoutBrief,rows:cleanProductionRows,options:cleanChainOptions,corners:cleanProductionCorners,surfaceTemplate:cleanSurfaceTemplate,surfacePatterns:cleanCutPatterns,surfaces3d:cleanMeasuredSurfaces,measureFit:cleanMeasureFit,pipeRoutes:cleanPipeRoutes,installReadiness:cleanInstallReadiness,serviceZones:cleanServiceZones,clientUsage:cleanClientUsage,applianceFit:cleanApplianceSchedule,wallProfiles:cleanWallProfiles})){
   if(raw[key]===undefined)continue;
   const value=clean(raw[key]);if(!value)return null;w[key]=value;
 }
 if(raw.guideFinishReview!==undefined){if(typeof raw.guideFinishReview!=='string'||!/^[0-9a-f]{64}$/.test(raw.guideFinishReview))return null;w.guideFinishReview=raw.guideFinishReview;}
 if(raw.activeWall!==undefined){if(!id(raw.activeWall))return null;w.activeWall=raw.activeWall;}
 if(raw.finishes!==undefined){
   const f=raw.finishes;if(!object(f)||(f.frontSku!==undefined&&!id(f.frontSku)))return null;
   w.finishes={};if(f.frontSku)w.finishes.frontSku=f.frontSku;
   if(f.cornerFronts!==undefined){const faces=cleanCornerFronts(f.cornerFronts);if(!faces)return null;w.finishes.cornerFronts=faces;}
   if(f.partDefaults!==undefined){const choices=cleanFinishSelection(f.partDefaults);if(!choices)return null;w.finishes.partDefaults=choices;}
   if(f.partCoverage!==undefined){
     if(!object(f.partCoverage))return null;w.finishes.partCoverage={};
     for(const [k,list] of Object.entries(f.partCoverage)){
       if(!ownKey(w.finishes.partDefaults||{},k)||!Array.isArray(list)||list.length>1200||list.some(v=>!id(v))||new Set(list).size!==list.length)return null;
       w.finishes.partCoverage[k]=[...list];
     }
   }
   if(f.hardwareUnits!==undefined){
     if(!object(f.hardwareUnits)||Object.keys(f.hardwareUnits).length>1200)return null;w.finishes.hardwareUnits={};
     for(const [uid,groups] of Object.entries(f.hardwareUnits)){
       if(!id(uid)||['__proto__','constructor','prototype'].includes(uid)||!object(groups)||Object.keys(groups).length>64)return null;
       if(Object.entries(groups).some(([g,sku])=>!g.trim()||g.length>50||['__proto__','constructor','prototype'].includes(g)||!id(sku)))return null;
       w.finishes.hardwareUnits[uid]={...groups};
     }
   }
   if(f.partUnits!==undefined){if(!object(f.partUnits)||Object.keys(f.partUnits).length>1200)return null;
     w.finishes.partUnits={};for(const [uid,c] of Object.entries(f.partUnits)){
       const choices=cleanFinishSelection(c);if(!id(uid)||['__proto__','constructor','prototype'].includes(uid)||!choices)return null;
       w.finishes.partUnits[uid]=choices;
     }
   }
   if(f.units!==undefined){if(!object(f.units)||Object.keys(f.units).length>1200)return null;
     w.finishes.units={};for(const [uid,choice] of Object.entries(f.units)){
       if(!id(uid)||['__proto__','constructor','prototype'].includes(uid)||!object(choice)||!id(choice.frontSku))return null;
       w.finishes.units[uid]={frontSku:choice.frontSku};
     }
   }
 }
 if(raw.versions!==undefined){const versions=cleanVersions(raw.versions);if(!versions)return null;w.versions=versions;}
 if(raw.approvals!==undefined){
   if(!object(raw.approvals))return null;w.approvals={};
   for(const k of ['structure','customer','release']){
     if(raw.approvals[k]===undefined)continue;const s=raw.approvals[k];if(!stamp(s))return null;
     w.approvals[k]={key:s.key,name:s.name.trim(),date:s.date};
   }
 }
 return w;
}
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(!object(v))return v;
 return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])]));
}
async function digest(v){
 return revisionDigest(JSON.stringify(canonical(v)));
}
const without=(o,keys)=>Object.fromEntries(Object.entries(o||{}).filter(([k])=>!keys.includes(k)));
// A saved site reading can uncover a design collision. Keep the two identities
// so the designer goes straight to the affected unit without editing the survey.
export function surveyDesignReview(doc){
 const features=doc.kitchen.features.filter(f=>linkedReadingIndex(doc.room,f)>=0);
 if(!features.length)return null;
 const hit=surveyDesignConflicts(doc.kitchen,doc.room,new Set(features.map(f=>f.id)))[0];
 if(!hit)return null;
 const unit=doc.kitchen.units.find(u=>hit.ids.includes(u.id)),feature=features.find(f=>hit.ids.includes(f.id));
 const reason='يتعارض موضع «'+kitchenUnitSpecs[unit.kind].label+'» في التصميم مع «'+kitchenFeatureSpecs[feature.kind].label+'» في الرفع. راجع موضع الوحدة قبل الاعتماد.';
 return {id:hit.id,unitId:unit.id,reason};
}
function* approvalInputs(doc,existingQuote){
 const w=doc.room.workshop||{},cat=getFactoryCatalog(doc),a=w.approvals||{};
 const {runs,units,features}=doc.kitchen;
 const frontKeys=['frontColor','frontFinish','open'];
 const panels=Object.fromEntries(cat.items.filter(i=>i.kind==='panel'&&i.role==='front').map(i=>[i.sku,i.thicknessMm]));
 const productionRows=Object.values(w.rows||{}).flatMap(row=>row.units),entries=new Map(productionRows.map(e=>[e.id,e]));
 const finishThickness=units.filter(u=>u.kind==='drawers'||u.kind==='storage'||u.kind==='sink'||entries.get(u.id)?.recipeId).map(u=>{
   const r=runs.find(r=>r.id===u.runId),family=r?.tier==='upper'?'upperStorage':u.kind==='drawers'?'rice':u.kind;
   const baseSku=cat.families[entries.get(u.id)?.recipeId||family]?.recipe.find(l=>l.role==='front')?.sku;
   const actual=w.finishes?.units?.[u.id]?.frontSku||w.finishes?.frontSku||baseSku;
   return [u.id,panels[actual]??null];
 });
 const geo={finishThickness,room:without(doc.room,['workshop','colors','floor','cladding','backsplash','name','defaults','photoRefs','fieldRegister','projectId']),features,
   chains:w.chains,options:w.options,corners:w.corners,rows:Object.fromEntries(Object.entries(w.rows||{}).map(([k,v])=>[k,{units:v.units.map(u=>without(u,['locks','open']))}])),
   runs:runs.map(r=>without(r,['worktopFinish','worktopColor','fillDefaults'])),units:units.map(u=>without(u,frontKeys)),
   recipes:Object.fromEntries(Object.entries(cat.families).map(([k,f])=>[k,{min:f.minMm,max:f.maxMm,step:f.stepMm,recipe:f.recipe}])),
   profiles:cat.items.filter(i=>i.role!=='front').map(i=>({sku:i.sku,thicknessMm:i.thicknessMm}))};
 const quote=existingQuote||buildFactoryQuote(doc);
 // A workshop-only inspection, an inventory count, or a note cannot change the customer's order.
 // Keep the old signature readable on a document whose historical inputs are identical.
 const oldStructure=(yield geo);
 const {chains,...designGeo}=geo;
 const checkedChains=chains&&Object.fromEntries(Object.entries(chains).map(([wall,chain])=>[wall,chain.rows]));
 const applicable=Object.entries(cat.families).filter(([k,f])=>productionRows.some(u=>(u.recipeId||u.family)===k)).map(([k,f])=>[k,Object.fromEntries(['base','cadKind','minHeightMm','maxHeightMm','heightStepMm','minDepthMm','maxDepthMm','depthStepMm','frontSkus','frontMassModel','customerBay'].filter(a=>f[a]!==undefined).map(a=>[a,f[a]]))]).filter(([,f])=>Object.keys(f).length);
 const sections=cat.items.map(i=>[i.sku,Object.fromEntries(['sectionWidthMm','gaugeMm','grooveDepthMm','grooveWidthMm','massKgM2'].filter(k=>i[k]!==undefined).map(k=>[k,i[k]]))]).filter(([,v])=>Object.keys(v).length);
 const trimKeys=[...new Set(Object.values(w.options||{}).flatMap(o=>Object.values(o.factoryTrim||{}).map(v=>v.recipe)))].sort();
 const usedTrims=trimKeys.length?trimKeys.map(k=>[k,cat.trims?.[k]]):undefined;
 const scribeKeys=[...new Set(Object.values(w.options||{}).flatMap(o=>(o.scribes||[]).map(v=>v.recipe)))].sort();
 const usedScribePolicies=scribeKeys.length?scribeKeys.map(k=>[k,cat.scribePolicies?.[k]]):undefined;
 const familyGeometry=applicable.length||sections.length?{applicable,sections}:undefined;
 const partGeometry=finishGeometryChanges(doc,cat);
 const partPolicies=Object.entries(cat.families).filter(([k,f])=>f.finishSlots&&Object.values(w.rows||{}).some(row=>row.units.some(u=>(u.recipeId||u.family)===k))||f.finishSlots&&k==='upperStorage'&&runs.some(r=>r.tier==='upper')).map(([k,f])=>[k,f.finishSlots]);
 const physicalOptions=w.options&&Object.fromEntries(Object.entries(w.options).map(([wall,o])=>[wall,{...o,curtains:Object.fromEntries(Object.entries(o.curtains||{}).map(([id,v])=>[id,without(v,['pose'])]))}]));
 const cornerKeys=[...new Set(Object.values(w.corners||{}).flatMap(c=>[c.base?.build?.recipe,c.upper?.build?.recipe]).filter(Boolean))].sort();
 const accessoryKeys=[...new Set(Object.values(w.options||{}).flatMap(o=>[...Object.values(o.curtains||{}),...Object.values(o.heaters||{})].map(v=>v.recipe).filter(Boolean)))].sort();
 function selectedRecipes(keys,book){
   if(!keys.length)return undefined;
   return keys.map(k=>{const rule=book?.[k],skus=new Set(Object.values(rule||{}).filter(v=>typeof v==='string'));
    const thicknesses=cat.items.filter(i=>skus.has(i.sku)&&i.thicknessMm!==undefined).map(i=>[i.sku,i.thicknessMm]);
    return [k,rule,thicknesses];});
 }
 const lightKeys=[...new Set(Object.values(w.options||{}).filter(o=>o.linearLight?.state==='factory').map(o=>o.linearLight.recipe).filter(Boolean))].sort();
 const lightPolicies=selectedRecipes(lightKeys,cat.linearKits);
 const cornerPolicies=selectedRecipes(cornerKeys,cat.cornerRecipes),accessoryPolicies=selectedRecipes(accessoryKeys,cat.wallAccessories);
 const fitout=w.baseSupport||w.upstand||cat.baseSupport||cat.upstandProfiles?{base:w.baseSupport,upstand:w.upstand,rules:cat.baseSupport,profiles:cat.upstandProfiles}:undefined;
 const structure=(yield {...designGeo,fitout,options:physicalOptions,cornerPolicies,accessoryPolicies,lightPolicies,decisionReview:w.decisionReview,applianceIntake:w.applianceIntake?.length?w.applianceIntake:undefined,partGeometry,familyGeometry,usedTrims,usedScribePolicies,surfaces3d:w.surfaces3d,wallProfiles:w.wallProfiles,serviceZones:w.serviceZones,clientUsage:w.clientUsage,applianceFit:w.applianceFit,chains:checkedChains,specialParts:Object.keys(cat.specials||{}).length?cat.specials:undefined});
 const clearance=Object.entries(w.rows||{}).map(([id,r])=>[id,r.equipmentChecks??null,r.riceChecks??null,...(r.drawerChecks?[r.drawerChecks]:[])]);
 const sale={total:quote.total,terms:cat.terms,extras:quote.extras,worktop:quote.worktop,items:quote.purchases.map(p=>[p.sku,p.name,p.qty,p.price,p.cost]),pieces:quote.pieces};
 const customer=(yield {structure,layoutBrief:w.layoutBrief,finishes:w.finishes,runs,units:units.map(u=>without(u,['open'])),sale,structuralApproval:a.structure});
 const release=(yield {customer,customerApproval:a.customer,technical:clearance,wallPairs:Object.keys(w.wallPairs||{}).length?w.wallPairs:undefined,tapChecks:w.tapChecks,measureFit:w.measureFit,pipeRoutes:w.pipeRoutes,installReadiness:w.installReadiness,surfaceTemplate:w.surfaceTemplate,surfacePatterns:w.surfacePatterns,observations:doc.room.fieldRegister,attested:w.chains,quote});
 const oldCustomer=a.customer&&(yield {structure:oldStructure,cat,finishes:w.finishes,runs,units:units.map(u=>without(u,['open'])),fields:doc.room.fieldRegister,defaults:doc.room.defaults,options:w.options,structuralApproval:a.structure});
 const valid={structure:!!a.structure&&(a.structure.key===structure||(!fitout&&!partPolicies.length&&!partGeometry&&!usedTrims&&!usedScribePolicies&&!w.surfaces3d&&!familyGeometry&&!w.wallProfiles&&!w.serviceZones&&!w.clientUsage&&!w.applianceFit&&!Object.keys(cat.specials||{}).length&&!w.applianceIntake?.length&&!w.decisionReview&&!cornerPolicies&&!accessoryPolicies&&!lightPolicies&&a.structure.key===oldStructure)),customer:!!a.customer&&(a.customer.key===customer||!fitout&&!w.layoutBrief&&a.customer.key===oldCustomer)&&!budgetHold(quote,w.layoutBrief),release:!!a.release&&a.release.key===release};
 valid.structure=valid.structure&&!intakeIssues(doc).length&&!decisionIssues(doc).length;valid.customer=valid.structure&&valid.customer;valid.release=valid.customer&&valid.release;
 return {keys:{structure,customer,release},valid,quote,designReview:surveyDesignReview(doc)};
}
// Exports and interactive approval use the same inputs and SHA-256 keys.
export async function approvalState(doc){
 const inputs=approvalInputs(doc);let step=inputs.next();
 while(!step.done)step=inputs.next(await digest(step.value));
 return step.value;
}
export function outputApprovalState(doc,quote){
 const inputs=approvalInputs(doc,quote);let step=inputs.next();
 while(!step.done){
  const bytes=new TextEncoder().encode(JSON.stringify(canonical(step.value)));
  step=inputs.next(offlineDigest(bytes));
 }
 return step.value;
}
// Release and the guided workflow must consult the same checks. Keep their
// origins here so a failed site measurement can reopen its own editor.
export function releaseConcernGroups(doc,state,scope){
 const w=doc.room.workshop||{},groups=[];
 const add=(origin,issues,focus)=>{if(issues.length)groups.push({origin,issues:[...new Set(issues)],...(focus?{focus}:{})});};
 const hold=w.layoutBrief&&budgetHold(scope?buildFactoryQuote(doc):state.quote,w.layoutBrief);if(hold)add('budget',[hold]);
 if(!state.valid.customer)add('customer',['اعتمد التصميم وعرض العميل الحالي أولًا.']);
 const owners=catalogRecordStates(w);
 if(owners){
  if(!owners.store.approved)add('catalog',['راجع أصناف المتجر وأسعار الشراء واعتمد سجل المتجر الحالي.']);
  if(!owners.factory.approved)add('catalog',['راجع وصفات المصنع واعتمد سجل التصنيع الحالي.']);
  if(!owners.pricing.approved)add('prices',['راجع شروط التسعير واعتمد سجل التسعير الحالي.']);
 }else if(!state.quote.approved)add('catalog',['راجع الكتالوج واعتمده باسم المصنع.']);
 add('quote',state.quote.issues||[]);add('production',state.quote.releaseIssues||[]);add('fitout',state.quote.fitoutPending||[]);
 if(state.quote.missing?.length)add('prices',['بنود ناقصة في الحصر: '+state.quote.missing.join('، ')]);
 if(!state.quote.ready&&!groups.length)add('quote',['أكمل الحصر قبل إطلاق التصنيع.']);
 if(!doc.kitchen.units.length&&!configuredCorners(w))add('empty',['لا توجد وحدات للتصنيع.']);
 for(const r of doc.kitchen.runs.filter(r=>w.rows?.[r.id]&&(!scope||scope.runIds.includes(r.id)))){
  const manifest=w.rows[r.id],subset=scope?{...manifest,units:manifest.units.filter(u=>scope.unitIds.includes(u.id))}:manifest;
  add('row',currentDishwasherWarnings(doc,r,subset),{runId:r.id});
  add('row',currentRiceWarnings(doc,r,subset),{runId:r.id});
 }
 const collision=kitchenGeometry(doc.kitchen,doc.room).conflicts.find(c=>!scope||!Array.isArray(c.ids)||c.ids.some(id=>scope.unitIds.includes(id)||scope.runIds.includes(id)));
 if(collision)add('collision',['تعارض هندسي في الموضع المحدد. '+(collision.label||collision.type)]);
 if(!scope)add('surface',surfaceReleaseIssues(doc));
 add('tap',tapWindowIssues(doc,scope));add('decisions',decisionIssues(doc));add('intake',intakeIssues(doc,scope));
 add('surfaces3d',surveyedSurfaceIssues(doc,scope));add('row',rowModelIssues(doc,scope));add('corner',cornerMotionIssues(doc,scope));
 add('logistics',installReadinessIssues(doc,scope,'cut'));add('measure',evaluateMeasureFit(doc,scope).issues);
 add('routes',evaluatePipeRoutes(doc,scope).issues);add('profile',profileIssues(doc,scope));add('uses',clientUsageIssues(doc,scope));
 add('appliances',evaluateApplianceFit(doc,scope).issues);add('zones',serviceZoneIssues(doc,scope));
 const locations=new Map();
 const site=siteReleaseIssues(doc,scope,(message,origin,focus)=>{if(!locations.has(message))locations.set(message,{origin,focus});});
 for(const issue of site){const location=locations.get(issue);add(location?.origin||'survey',[issue],location?.focus);}
 add('field',recordReleaseIssues(doc,scope));
 return groups;
}
export function releaseConcerns(doc,state,scope){
 return [...new Set(releaseConcernGroups(doc,state,scope).flatMap(g=>g.issues))];
}
export async function batchReleaseState(doc,input,state){
 if(!Array.isArray(input)||!input.length||input.length>256||new Set(input).size!==input.length||input.some(id=>typeof id!=='string'||!doc.kitchen.units.some(u=>u.id===id)))return {issues:['اختر وحدات موجودة ومتميزة في الرسم.']};
 const unitIds=[...input].sort(),selected=doc.kitchen.units.filter(u=>unitIds.includes(u.id));
 const runIds=[...new Set(selected.map(u=>u.runId))],walls=[...new Set(doc.kitchen.runs.filter(r=>runIds.includes(r.id)).map(r=>r.wall).filter(Boolean))];
 const scope={unitIds,runIds,walls},full=state||await approvalState(doc),quote=buildFactoryQuote(doc,{unitIds});
 const issues=releaseConcerns(doc,{valid:full.valid,quote},scope);
 if(!quote.pieces.length||quote.materialValue==null)issues.push('لا توجد قائمة قطع مسعّرة لهذه الدفعة.');
 const produced=new Set(quote.pieces.map(p=>p.unitId));
 if(unitIds.some(id=>!produced.has(id)))issues.push('اختر وحدات يصنّعها المصنع. فتحات الأجهزة المورّدة من العميل خارج أمر القطع.');
 const key=await digest({revision:full.keys.release,unitIds,materialValue:quote.materialValue,pieces:quote.pieces});
 return {scope,key,quote,issues:[...new Set(issues)]};
}
