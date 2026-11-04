import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {hasWorkshopCatalog,workshopCatalogView,catalogRecordStates,normalizeWorkshopCatalogs} from './kitchen-catalog-records.js';
import {wallPairReleaseIssues} from './kitchen-wall-pair-fit.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {baseModeNames,baseSupportTakeoff,cleanBaseSupportBook} from './kitchen-base-support.js';
import {cleanUpstandProfiles,worktopUpstandTakeoff} from './kitchen-worktop-upstand.js';
import {matchingPantryModel} from './kitchen-pantry-brief.js';
import {cleanLinearKits,calculateWallLighting,linearCollisionIssues} from './kitchen-linear-light.js';
import {cleanCornerRecipes} from './kitchen-corner-carcass.js';
import {cornerSolids} from './kitchen-corner-solid.js';
import {cleanWallAccessories,wallAssembly,accessoryChoice,accessoryCabinetIssues} from './kitchen-wall-accessory.js';
import {catalogDisplayColor,cleanFinishSlots,resolveFinishParts,bindHandleDrills,factoryUnitSize} from './kitchen-finish-parts.js';
import {siteReleaseIssues} from './kitchen-chain-model.js';
import {drawerPackIssues} from './kitchen-drawer-packing.js';
import {cleanScribePolicies,scribePiece} from './kitchen-wall-scribe.js';
import {cleanRunnerSpec,drawerRunnerPlans} from './kitchen-drawer-fit.js';
import {cleanTrimRecipes,makeTrimPieces} from './kitchen-factory-trims.js';
import {applyMaterialTerms,checkFactorySize,cleanPartEngineering,familyCADKind,familyProperties,finishBarEnds,isCustomFamily,selectHardware,recipeLineApplies} from './kitchen-factory-families.js';
export {checkFactorySize,familyCADKind,familyRecipeOptions,factoryLayoutKey,isCustomFamily,hardwareChoiceOptions} from './kitchen-factory-families.js';
import {cleanMachineBook,cleanPartOperations,machiningSheet} from './kitchen-machining.js';
import {cleanOffcuts,packedStock} from './kitchen-workshop-factory-stock.js';
import {cleanSpecialSheets,factorySpecialTargets,specialParts} from './kitchen-workshop-factory-special.js';
import {currentRiceWarnings} from './kitchen-production-row-rice.js';
import {currentDishwasherWarnings} from './kitchen-production-row-equipment.js';
// Workshop recipes consume actual CAD dimensions in millimetres. Project prices
// are per purchase unit: one bar, one sheet, or one discrete hardware piece.
import {wallOptionTakeoff} from './kitchen-chain-options.js';
import {kitchenGeometry} from './kitchen-model.js';
import {calculateKitchenDefaults} from './kitchen-defaults-calculations.js';
const familyKeys=['storage','rice','dishwasher','sink','upperStorage'];
export const factoryLabels={upperStorage:'خزانة علوية معلّقة',storage:'خزانة تخزين',rice:'درج أرز',dishwasher:'فتحة غسالة العميل',sink:'وحدة مجلى'};
export const factoryAxes={width:'عرض الوحدة',height:'ارتفاع الوحدة',frontWidth:'نصيب الواجهة من العرض',frontHeight:'نصيب الواجهة من الارتفاع',depth:'عمق الوحدة',fixed:'مقاس ثابت'};
export const factoryCounts={fixed:'لكل وحدة',front:'لكل درفة أو واجهة درج',handle:'لكل واجهة ذات يد',shelves:'لكل رف فعلي',dividers:'لكل قاطع فعلي'};
export {catalogDisplayColor} from './kitchen-finish-parts.js';
export const factoryKinds={bar:'قضيب أو لفة',panel:'لوح',piece:'قطعة'};
const legalId=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/.test(s)&&!inheritedName(s);
const textOK=(s,n=84)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const between=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const integer=(v,lo,hi)=>Number.isInteger(v)&&between(v,lo,hi);
const clone=o=>JSON.parse(JSON.stringify(o));
const one=(sku,name,kind,extra={})=>({sku,name,kind,role:'body',color:'',thicknessMm:0,stockLengthMm:0,stockWidthMm:0,kerfMm:0,stockUnits:null,available:true,price:null,...extra});
const line=(sku,label,count=1,axis='fixed',offsetMm=0,axis2='fixed',offset2Mm=0,role='body')=>({sku,label,count,axis,offsetMm,axis2,offset2Mm,role});
export const wallRates={'curtain':'ستارة / قطعة','heater-cover':'غطاء سخان / قطعة',cornice:'كورنيش / م',filler:'قفلة / م²'};
const emptyRates=()=>Object.fromEntries(Object.keys(wallRates).map(k=>[k,null]));
const emptyTerms=()=>({labor:null,installation:null,delivery:null,marginPct:null,taxPct:null,worktop:'separate'});
export function seedCatalog(){
 const items=[
  one('AL-20','قطاع إطار ألمنيوم ٢٠ مم','bar',{color:'فضي',thicknessMm:20,stockLengthMm:6000,kerfMm:3}),
  one('BODY-6','لوح جسم ٦ مم','panel',{thicknessMm:6,stockLengthMm:2440,stockWidthMm:1220,kerfMm:3}),
  one('FACE-6-W','لوح واجهة أبيض','panel',{role:'front',color:'أبيض',thicknessMm:6,stockLengthMm:2440,stockWidthMm:1220,kerfMm:3}),
  one('FACE-6-G','لوح واجهة رملي','panel',{role:'front',color:'رملي',thicknessMm:6,stockLengthMm:2440,stockWidthMm:1220,kerfMm:3}),
  one('EDGE','حافة الدرفة','bar',{stockLengthMm:5000}),
  one('UP-HANGER','طقم تعليق علوي','piece'),one('HINGE','مفصلة باب','piece'),one('PULL','يد باب أو درج','piece'),one('SLIDE','طقم سكتين لدرج الأرز','piece',{hardwareRole:'runner'}),
  one('RICE-BIN','حاوية الأرز','piece')
 ];
 const body=[
  line('AL-20','قائم جسم',4,'height'),line('AL-20','عارضة جسم',4,'width',-40),line('AL-20','رابط عمق',4,'depth',-40),
  line('BODY-6','جانب جسم',2,'height',-40,'depth',-40),line('BODY-6','قاعدة جسم',1,'width',-40,'depth',-40)
 ];
 const front=[{...line('FACE-6-W','حشوة واجهة',1,'frontHeight',-40,'frontWidth',-40,'front'),countMode:'front'},{...line('EDGE','حافة رأسية',2,'frontHeight',-4),countMode:'front'},{...line('EDGE','حافة أفقية',2,'frontWidth',-4),countMode:'front'},{...line('PULL','يد',1),countMode:'handle'}];
 const family=(key,minMm,maxMm,stepMm,recipe)=>({label:factoryLabels[key],minMm,maxMm,stepMm,recipe});
 return {version:1,revision:1,layoutRevision:1,terms:emptyTerms(),wallRates:emptyRates(),name:'كتالوج توضيحي للمشروع',approved:false,items,families:{
  upperStorage:family('upperStorage',200,1200,50,clone([...body,{...line('BODY-6','رف علوي',1,'width',-40,'depth',-40),countMode:'shelves'},{...line('BODY-6','قاطع رأسي',1,'height',-40,'depth',-40),countMode:'dividers'},...front,{...line('HINGE','مفصلة',2),countMode:'front'},line('UP-HANGER','طقم تعليق',1)])),
  storage:family('storage',200,1200,50,clone([...body,{...line('BODY-6','رف داخلي',1,'width',-40,'depth',-40),countMode:'shelves'},{...line('BODY-6','قاطع داخلي',1,'height',-40,'depth',-40),countMode:'dividers'},...front,{...line('HINGE','مفصلة',2),countMode:'front'}])),
  rice:family('rice',400,900,50,clone([...body,...front,{...line('SLIDE','طقم سحب',1),countMode:'front'},{...line('RICE-BIN','حاوية',1),when:'bin'}])),
  dishwasher:family('dishwasher',600,600,1,[]),sink:family('sink',600,1200,50,clone([...body,{...line('BODY-6','رف داخلي',1,'width',-40,'depth',-40),countMode:'shelves'},{...line('BODY-6','قاطع داخلي',1,'height',-40,'depth',-40),countMode:'dividers'},...front,{...line('HINGE','مفصلة',2),countMode:'front'}]))
 }};
}
export function cleanCatalogItems(source){
 if(!Array.isArray(source)||source.length<1||source.length>200)return null;
 const items=[],by=new Map();
 for(const i of source){
  if(!i||!legalId(i.sku)||by.has(i.sku)||!textOK(i.name)||!ownKey(factoryKinds,i.kind)||!['front','body'].includes(i.role)||i.role==='front'&&i.kind!=='panel'||typeof i.color!=='string'||i.color.length>65||!between(i.thicknessMm,0,500)||!between(i.kerfMm,0,40)||!(i.price===null||between(i.price,0,1e8)))return null;
  if(i.stockUnits!=null&&!integer(i.stockUnits,0,10000000)||i.available!=null&&typeof i.available!=='boolean')return null;
  if(!between(i.stockLengthMm,i.kind==='piece'?0:1,100000)||!between(i.stockWidthMm,i.kind==='panel'?1:0,100000))return null;
  const x=Object.fromEntries(['sku','name','kind','role','color','thicknessMm','stockLengthMm','stockWidthMm','kerfMm','price'].map(k=>[k,i[k]]));const hardwareRole=i.hardwareRole??(i.kind==='piece'&&i.sku==='SLIDE'&&i.name==='طقم سكتين لدرج الأرز'?'runner':'other');
  if(!['runner','other'].includes(hardwareRole)||hardwareRole==='runner'&&i.kind!=='piece')return null;
  if(i.runnerSpec!=null){x.runnerSpec=cleanRunnerSpec(i.runnerSpec);if(hardwareRole!=='runner'||!x.runnerSpec)return null;}
  const offcuts=cleanOffcuts(i.offcuts,i);if(!offcuts)return null;x.offcuts=offcuts;
  if(i.colorHex!=null&&i.colorHex!==''&&!/^#[0-9a-f]{6}$/i.test(i.colorHex))return null;
  if(i.colorHex)x.colorHex=i.colorHex.toLowerCase();
  if(i.sectionWidthMm!=null&&!between(i.sectionWidthMm,.001,5000)||i.gaugeMm!=null&&!between(i.gaugeMm,.001,500)||i.leadDays!=null&&!integer(i.leadDays,0,365))return null;
  if(i.sectionWidthMm!=null)x.sectionWidthMm=i.sectionWidthMm;if(i.gaugeMm!=null)x.gaugeMm=i.gaugeMm;if(i.leadDays!=null)x.leadDays=i.leadDays;
  if(i.massKgM2!=null){if(i.kind!=='panel'||!between(i.massKgM2,.00001,2000))return null;x.massKgM2=i.massKgM2;}
  if(i.grooveWidthMm!=null){if(i.kind!=='bar'||!between(i.grooveWidthMm,.001,500))return null;x.grooveWidthMm=i.grooveWidthMm;}
  if(i.specRef!=null&&i.specRef!==''){if(!textOK(i.specRef,180))return null;x.specRef=i.specRef.trim();}
  if(i.grooveDepthMm!=null){if(i.kind!=='bar'||!between(i.grooveDepthMm,0,500))return null;x.grooveDepthMm=i.grooveDepthMm;}
  x.hardwareRole=hardwareRole;x.stockUnits=i.stockUnits??null;x.available=i.available??true;items.push(x);by.set(x.sku,x);
 }
 return items;
}
export function cleanCatalog(c){
 if(!c||c.version!==1||!integer(c.revision,1,1e9)||!textOK(c.name)||typeof c.approved!=='boolean'||!c.families)return null;
 const items=cleanCatalogItems(c.items);if(!items)return null;
 const by=new Map(items.map(i=>[i.sku,i]));
 const families={};
 const extraKeys=Object.keys(c.families).filter(k=>!familyKeys.includes(k));
 if(extraKeys.length>60||extraKeys.some(k=>!isCustomFamily(k)))return null;
 for(const key of [...familyKeys,...extraKeys.sort()]){
  const f=ownKey(c.families,key)&&c.families[key];if(!f||!textOK(f.label)||!integer(f.minMm,1,12000)||!integer(f.maxMm,f.minMm,12000)||!integer(f.stepMm,1,12000)||!Array.isArray(f.recipe)||f.recipe.length>64||(!f.recipe.length&&key!=='dishwasher'&&!f.customerBay))return null;
  const properties=familyProperties(key,f,by);if(!properties)return null;
  const base=properties.base||key,recipe=[];
  for(const l of f.recipe){
   if(!l||!by.has(l.sku)||!textOK(l.label)||!ownKey(factoryCounts,l.countMode??'fixed')||!integer(l.count,1,100)||!ownKey(factoryAxes,l.axis)||!ownKey(factoryAxes,l.axis2)||!between(l.offsetMm,-12000,12000)||!between(l.offset2Mm,-12000,12000)||!['body','front'].includes(l.role)||l.role==='front'&&by.get(l.sku).role!=='front'||!['all','bags','bin'].includes(l.when??'all')||base!=='rice'&&l.when&&l.when!=='all')return null;
   const ops=cleanPartOperations(l.operations);if(ops===null||ops?.length&&by.get(l.sku).kind==='piece')return null;
   const engineering=cleanPartEngineering(l,by.get(l.sku),by);if(!engineering)return null;
   recipe.push({...engineering,...(ops?.length?{operations:ops}:{}),...Object.fromEntries(['sku','label','count','axis','offsetMm','axis2','offset2Mm','role'].map(k=>[k,l[k]])),when:l.when??'all',countMode:l.countMode??'fixed'});
  }
  const slots=cleanFinishSlots(f.finishSlots,recipe,by);if(!slots)return null;if(Object.keys(slots).length)properties.finishSlots=slots;
  if(f.drawerRunners!=null){const list=f.drawerRunners;if(familyCADKind(properties,base)!=='drawers'||!Array.isArray(list)||!list.length||list.length>32||new Set(list).size!==list.length||list.some(v=>!by.get(v)?.runnerSpec)||recipe.some(l=>by.get(l.sku).hardwareRole==='runner'&&l.hardwareRule))return null;properties.drawerRunners=[...list];}
  families[key]={label:f.label,minMm:f.minMm,maxMm:f.maxMm,stepMm:f.stepMm,...properties,recipe};
 }
 const terms=Object.fromEntries(Object.keys(emptyTerms()).map(k=>[k,c.terms?.[k]??emptyTerms()[k]]));
 const rates={...emptyRates()};for(const k of Object.keys(rates)){rates[k]=c.wallRates?.[k]??null;if(rates[k]!==null&&!between(rates[k],0,1e8))return null;}
 if(!['separate','include'].includes(terms.worktop)||['labor','installation','delivery','marginPct','taxPct'].some(k=>!(terms[k]===null||between(terms[k],0,k==='marginPct'||k==='taxPct'?100:1e8))))return null;
 if(c.layoutRevision!=null&&!integer(c.layoutRevision,1,c.revision))return null;
 const scribes=cleanScribePolicies(c.scribePolicies,by);if(!scribes)return null;
 const lights=cleanLinearKits(c.linearKits,by);if(!lights)return null;
 const accessories=cleanWallAccessories(c.wallAccessories,by);if(!accessories)return null;
 const cornerRecipes=cleanCornerRecipes(c.cornerRecipes,by);if(!cornerRecipes)return null;
 const trims=cleanTrimRecipes(c.trims,by);if(!trims)return null;
 const specials=cleanSpecialSheets(c.specials,items);if(!specials)return null;
 const book=cleanMachineBook(c.machining,items);if(book===null)return null;
 const baseSupport=c.baseSupport===undefined?undefined:cleanBaseSupportBook(c.baseSupport,by,families);
 const upstandProfiles=c.upstandProfiles===undefined?undefined:cleanUpstandProfiles(c.upstandProfiles,items);
 if(baseSupport===null||upstandProfiles===null)return null;
 const pin=c.teamSource;
 if(pin!=null&&(!/^[a-f0-9-]{16,64}$/i.test(pin.id)||!integer(pin.version,1,1e9)||!/^[a-f0-9]{64}$/.test(pin.digest)))return null;
 return {version:1,...(baseSupport?{baseSupport}:{}),...(upstandProfiles?{upstandProfiles}:{}),...(Object.keys(lights).length?{linearKits:lights}:{}),...(Object.keys(accessories).length?{wallAccessories:accessories}:{}),...(Object.keys(scribes).length?{scribePolicies:scribes}:{}),...(Object.keys(cornerRecipes).length?{cornerRecipes}:{}),...(Object.keys(trims).length?{trims}:{}),specials,...(book?{machining:book}:{}),...(pin?{teamSource:{id:pin.id,version:pin.version,digest:pin.digest}}:{}),revision:c.revision,layoutRevision:c.layoutRevision??c.revision,terms,wallRates:rates,name:c.name,approved:c.approved,items,families};
}
export function getFactoryCatalog(doc){return workshopCatalogView(doc?.room?.workshop)||seedCatalog();}
export function priceableWidth(f,width){return !!f&&between(width,f.minMm,f.maxMm)&&Math.abs((width-f.minMm)/f.stepMm-Math.round((width-f.minMm)/f.stepMm))<1e-6;}
const delta=(a,b)=>Math.abs(a-b)>1e-5;
const rnd=n=>Math.round(n*1000)/1000;
function livePieces(unit,run,entry,catalog,finishes,issues,geometry,runnerPlan,doc){
 const recipeId=entry.recipeId||entry.family,f=catalog.families[recipeId],base=f?.base||recipeId;
 if(!f||base!==entry.family||unit.kind!==familyCADKind(f,base)||unit.runId!==run.id){issues.push('تغيّر نوع أو صف الوحدة '+unit.id+'، أعد تعبئة الصف.');return null;}
 const {fronts,envelopeHeight,netHeight,dims}=factoryUnitSize(unit,run,geometry),{width,depth}=dims;
 if(netHeight<=0){issues.push(unit.id+' · لا يبقى ارتفاع للجسم بعد خصم فراغ القاعدة.');return null;}
 const factors={fixed:1,front:fronts,handle:unit.handleStyle==='handleless'?0:fronts,shelves:unit.interior?.shelves??0,dividers:unit.interior?.dividers??0};
 if(!checkFactorySize(f,width,envelopeHeight,depth)||delta(dims.width,entry.widthMm)||delta(unit.u*10,entry.startMm)){issues.push('مقاس أو موقع '+unit.id+' يخالف وصف الصف المعتمد.');return null;}
 if(!Object.values(dims).every(Number.isFinite)){issues.push('تنقص أبعاد الوحدة '+unit.id);return null;}
 if(entry.family==='rice'&&!['bags','bin','owned','dispenser'].includes(entry.riceMode)){issues.push('حدّد أكياس الأرز أو حاويته في '+unit.id);}

 if(entry.family==='rice'&&entry.riceMode==='dispenser'&&entry.pantrySupply&&!matchingPantryModel(doc,entry)){
  issues.push('موديل العيّاشة المثبت في الوصفة لا يطابق موديل العميل في المقابلة للوحدة '+unit.id+'.');return null;
 }
 if(entry.family==='rice'&&entry.riceMode==='dispenser'&&(!entry.pantrySupply||!f.recipe.some(l=>l.when==='bin'&&l.sku===entry.pantrySupply.sku&&catalog.items.find(i=>i.sku===l.sku)?.kind==='piece')))issues.push('يلزم مطابقة موديل العيّاشة بصنف قطعة معتمد في وصفة المصنع '+unit.id+'.');
 const pieces=[];
 const pick=finishes?.units?.[unit.id]?.frontSku||finishes?.frontSku;
 const by=new Map(catalog.items.map(i=>[i.sku,i])),parts=resolveFinishParts(f,finishes,unit.id,by);
 if(parts.issues.length){issues.push(...parts.issues);return null;}
 let panelMass=0,knownMass=true,frontPanels=0;
 for(const l of f.recipe){
  if(runnerPlan&&by.get(l.sku)?.hardwareRole==='runner')continue;
  if(unit.detail&&['shelves','dividers'].includes(l.countMode))continue;
  const count=l.count*factors[l.countMode??'fixed'];if(!count)continue;
  if(!recipeLineApplies(l,entry))continue;
  const original=by.get(l.sku),item=l.role==='front'&&pick?by.get(pick):parts.itemFor(l),sku=item?.sku;
  if(!item||l.role==='front'&&item.role!=='front'){issues.push('صنف الواجهة غير معرّف في '+unit.id);return null;}
  if(l.role==='front'&&f.frontSkus?.length&&!f.frontSkus.includes(sku)){issues.push('لوح الواجهة '+sku+' خارج بدائل عائلة '+f.label+' في '+unit.id+'.');return null;}
  if(l.role==='front'&&pick&&unit.frontColor&&catalogDisplayColor(item)!==unit.frontColor.toLowerCase()){
   issues.push('لون '+unit.id+' في الرسم يحتاج مطابقة مع عينة واجهة '+item.sku+'.');
  }
  if(l.grooveFit){
   const v=l.grooveFit,profile=parts.dimensions.get(v.sku);
   if(!Number.isFinite(profile?.grooveWidthMm)||!Number.isFinite(profile?.grooveDepthMm)){issues.push(l.label+' · أدخل عرض وعمق أخدود '+v.sku+' للتحقق من '+sku+'.');return null;}
   const clear=rnd(profile.grooveWidthMm-item.thicknessMm);
   if(clear<v.minClearMm||clear>v.maxClearMm||profile.grooveDepthMm<v.minEngageMm){issues.push(l.label+' · لا يطابق '+sku+' خلوص أو تعشيق القطاع '+v.sku+' وفق '+v.reference+'.');return null;}
  }
  if(l.role==='front'&&!l.grooveFit&&delta(item.thicknessMm,original.thicknessMm)){issues.push('سماكة واجهة '+unit.id+' تختلف عن وصفة '+original.sku+'، اعتمد وصفة ملائمة.');}
  const A=item.kind==='piece'?{value:null}:applyMaterialTerms(dims[l.axis]+l.offsetMm,l.termsA,parts.dimensions);
  const B=item.kind!=='panel'?{value:null}:applyMaterialTerms(dims[l.axis2]+l.offset2Mm,l.termsB,parts.dimensions);
  if(A.issue||B.issue){issues.push(unit.id+' · '+l.label+' · '+(A.issue||B.issue));return null;}
  if(A.value!==null&&A.value<=0||B.value!==null&&B.value<=0){issues.push('وصفة '+l.label+' تنتج مقاسًا غير صالح في '+unit.id);return null;}
  const bar=l.ends?finishBarEnds(A.value,item,l.ends):{a:A.value};
  if(bar.issue){issues.push(l.label+' · '+bar.issue);return null;}
  if(l.role==='front'&&item.kind==='panel'){
   frontPanels++;
   if(!Number.isFinite(item.massKgM2))knownMass=false;else panelMass+=bar.a*B.value*count*item.massKgM2/1e6;
  }
  pieces.push({...bar,b:B.value,count,...(l.hardwareRule?{hardwareRule:l.hardwareRule}:{}),...(l.operations?.length?{operations:l.operations}:{}),
   unitId:unit.id,runId:run.id,family:entry.family,...(entry.recipeId?{recipeId}:{}),sku,label:l.label,kind:item.kind});
 }
 bindHandleDrills(pieces,f.finishSlots?.handle,parts.actual.get('handle')?.sku,unit.id,issues,geometry);
 const mass=f.frontMassModel;
 const frontMass=fronts&&frontPanels&&knownMass&&mass?panelMass/fronts+2*(dims.frontWidth+dims.frontHeight)*mass.frameKgM/1000+mass.extraKg:null;
 const pins=finishes?.hardwareUnits?.[unit.id]||{};
 for(const [group,sku] of Object.entries(pins))if(entry.hardwareChoices?.[group]&&entry.hardwareChoices[group]!==sku)issues.push('صنف العتاد المثبت في الصف لا يطابق اختيار التشطيب '+group+' في '+unit.id+'.');
 const selection=selectHardware(pieces,{...dims,frontMass},unit.id,by,{...entry.hardwareChoices,...pins});issues.push(...selection.issues,...(runnerPlan?.issues||[]));return [...selection.rows,...(runnerPlan?.rows||[])];
}
// Re-pack only the newly issued physical parts for a scoped receipt. Never use
// whole-project package counts to reserve a remainder or a mixed release.
export function purchaseRequirements(catalog,pieces){
 const cat=catalog,issues=[],missing=[],releaseIssues=[],purchases=[];let subtotal=0;
 let plannedCuts=0;
 const by=new Map();for(const p of pieces){if(!by.has(p.sku))by.set(p.sku,[]);by.get(p.sku).push(p);}
 for(const item of cat.items){const p=by.get(item.sku);if(!p)continue;let amount;
  const count=p.reduce((s,v)=>s+v.count,0);
  if(item.kind!=='piece'&&(count>8000||(plannedCuts+=count)>24000)){issues.push('كمية '+item.sku+' تتجاوز حد تخطيط القص في المتصفح، راجع الورشة.');continue;}
  if(item.kind==='bar'||item.kind==='panel')amount=packedStock(item,p);
  else{const n=p.reduce((s,x)=>s+x.count,0);amount={qty:n,net:n,purchased:n,loss:0,unit:'قطعة'};}
  if(!amount){issues.push('لا يتسع خام '+item.sku+' للقطع المطلوبة واتجاهها مع عرض المنشار، راجع الصنف.');continue;}
  const cost=item.price==null?null:Math.round((amount.valueUnits??amount.qty)*item.price*100)/100;
  if(cost==null)missing.push(item.sku);else subtotal+=cost;

  const fromStock=amount.qty===0?0:item.stockUnits==null?null:Math.min(item.stockUnits,amount.qty),orderQty=fromStock===null?null:amount.qty-fromStock;
  if(!item.available&&orderQty!==0)releaseIssues.push('الصنف '+item.sku+' غير متاح للتوريد، والرصيد لا يثبت تغطية الاحتياج.');
  const orderCost=orderQty===0?0:orderQty===null||item.price===null?null:Math.round(orderQty*item.price*100)/100;
  purchases.push({fromStock,orderQty,orderCost,sku:item.sku,name:item.name,kind:item.kind,...amount,price:item.price,cost});
 }
 return {issues,missing,releaseIssues,purchases,subtotal};
}
export function buildFactoryQuote(doc,scope){
 const rawWorkshop=doc?.room?.workshop;
 if(rawWorkshop&&hasWorkshopCatalog(rawWorkshop)&&!rawWorkshop.catalog){const normalized=normalizeWorkshopCatalogs(rawWorkshop);if(normalized)doc={...doc,room:{...doc.room,workshop:normalized}};}
 const partial=scope!==undefined;
 const ids=scope?.unitIds,validScope=Array.isArray(ids)&&ids.length>0&&ids.length<=1024&&ids.every(v=>typeof v==='string'&&v.length<=80)&&new Set(ids).size===ids.length;
 const selected=new Set(validScope?ids:[]),includes=id=>!partial||selected.has(id);
 const cat=getFactoryCatalog(doc),workshop=doc?.room?.workshop||{},runs=doc?.kitchen?.runs||[],units=doc?.kitchen?.units||[],issues=[],missing=[],pieces=[],purchases=[],usedUnits=new Set(),skipped=new Set(),seen=new Set();
 const rows=workshop.rows||{},releaseIssues=[];let subtotal=0;
 if(workshop.wallPairs&&(!partial||validScope))releaseIssues.push(...wallPairReleaseIssues(doc,partial?{unitIds:[...selected]}:undefined));
 if(workshop.clientUsage?.pack?.groups.length&&(!partial||validScope))issues.push(...drawerPackIssues(doc,scope));
 if(partial&&(!validScope||[...selected].some(id=>!units.some(u=>u.id===id))))issues.push('نطاق الإفراج يتطلب وحدات حالية معروفة وغير مكررة.');
 const targets=factorySpecialTargets(doc).filter(t=>!partial||t.unitId&&includes(t.unitId)),specialBy=new Map(targets.map(t=>[t.id,t])),extras=[];
 let drawing;const geom=new Map();if(units.length){try{drawing=kitchenGeometry(doc.kitchen,doc.room);for(const u of drawing.units)geom.set(u.id,u);}catch{issues.push('تعذرت مطابقة هندسة الوحدات مع الرسم.');}}
 if(hasWorkshopCatalog(workshop)&&!workshopCatalogView(workshop))issues.push('الكتالوج المخزّن غير صالح. أعد استيراده.');

 if(partial&&validScope&&Object.keys(workshop.options||{}).length)releaseIssues.push(...accessoryCabinetIssues(doc,scope,kitchenGeometry(doc.kitchen,doc.room)));
 if(partial&&validScope)for(const [wall,o] of Object.entries(workshop.options||{}))if(o.linearLight?.state==='factory')releaseIssues.push(...linearCollisionIssues(kitchenGeometry(doc.kitchen,doc.room),wall,scope));
 const runnerPlans=drawerRunnerPlans(cat,rows,units,runs,workshop.finishes,doc);
 for(const [id,manifest] of Object.entries(rows)){
  const run=runs.find(r=>r.id===id);
  if(partial&&!manifest?.units?.some(u=>includes(u.id)))continue;
  if(!run||!Array.isArray(manifest?.units)){issues.push('صف مصنع غير موجود في الرسم: '+id);continue;}
  const chosen=manifest.units.filter(u=>includes(u.id));
  if(!partial){for(const warning of manifest.warnings||[])if(!String(warning).includes('وحدات يدوية محفوظة'))releaseIssues.push(String(warning));}
  else{
    const scoped={...manifest,units:chosen};
    releaseIssues.push(...currentDishwasherWarnings(doc,run,scoped),...currentRiceWarnings(doc,run,scoped));
    if(workshop.chains?.[run.wall]?.source!=='field')releaseIssues.push('لم يؤكد رفع الجدار للصف '+id+'.');
    if(chosen.some(u=>u.family==='sink')&&manifest.warnings.some(w=>w.includes('المجلى')))releaseIssues.push('تحقق من تغذية المجلى وصرفه في الصف '+id+'.');
  }
  if(String(manifest.catalogVersion)!==String(cat.layoutRevision))issues.push('تغيّر إصدار كتالوج الصف '+id+'، أعد تأكيد التعبئة.');
  for(const entry of chosen){
   if(seen.has(entry.id)){issues.push('تكرار الوحدة '+entry.id+' في حصر الصفوف.');continue;}seen.add(entry.id);
   const u=units.find(v=>v.id===entry.id);
   if(!u){issues.push('حُذفت الوحدة '+entry.id+' من الرسم.');continue;}
   const resolved=run.tier==='upper'&&entry.family==='storage'?{...entry,family:'upperStorage'}:entry;
   const cuts=livePieces(u,run,resolved,cat,workshop.finishes,issues,geom.get(u.id),runnerPlans.get(u.id),doc);
   if(cuts===null)continue;
   usedUnits.add(u.id);if(!cuts.length&&(entry.family==='dishwasher'||cat.families[entry.recipeId]?.customerBay))skipped.add(u.id);pieces.push(...cuts);
  }
 }
 // Only rows created by the managed upper-band workflow get the upper family.
 // A legacy or arbitrary cabinet remains explicitly outside factory coverage.
 for(const run of runs.filter(r=>r.tier==='upper'&&workshop.chains?.[r.wall]&&r.id.startsWith('wup-'+r.wall+'-')&&/^[0-9]+-[0-9]+$/.test(r.id.slice(('wup-'+r.wall+'-').length)))){
  for(const u of units.filter(x=>includes(x.id)&&x.runId===run.id&&x.kind==='storage'&&!seen.has(x.id))){
   if(partial&&workshop.chains?.[run.wall]?.source!=='field')releaseIssues.push('لم يؤكد رفع الجدار للعلوي '+run.id+'.');
   const entry={id:u.id,family:'upperStorage',startMm:u.u*10,widthMm:u.width*10};
   const cuts=livePieces(u,run,entry,cat,workshop.finishes,issues,geom.get(u.id),runnerPlans.get(u.id),doc);
   if(cuts){usedUnits.add(u.id);pieces.push(...cuts);}
  }
 }
 const builtCorners=targets.some(t=>t.kind==='corner'&&t.build)?new Map(cornerSolids(doc.room,workshop.corners,cat).map(s=>[s.id,s])):null;
 for(const t of targets){
  if(t.wall&&['curtain','heater-cover'].includes(t.kind)){
   const v=accessoryChoice(workshop.options[t.wall],t.kind,t.item.featureId),f=doc.kitchen.features.find(f=>f.id===t.item.featureId);
   if(v?.recipe&&f){const a=wallAssembly(doc.room,f,v,cat);
    if(!a||a.issues.length)issues.push(...(a?.issues||['تعذر حساب تجهيز الجدار المختار.']));else pieces.push(...a.pieces);
    releaseIssues.push(...siteReleaseIssues(doc,{walls:[t.wall]}));
    continue;
   }
  }
  if(t.wall&&['cornice','filler'].includes(t.kind)){
   const trim=makeTrimPieces(doc,t.wall,t.kind,cat);
   if(trim){issues.push(...trim.issues);releaseIssues.push(...trim.releaseIssues);pieces.push(...trim.pieces);continue;}
  }
  if(t.kind==='corner'&&t.build){
   const body=builtCorners?.get(t.id);
   if(!body?.build||body.issues.length){issues.push(...(body?.issues.length?body.issues:[t.label+' · راجع هندسة الجسم المقاس ووصفة الركن.']));continue;}
   if(t.technical)releaseIssues.push(t.technical);
   releaseIssues.push(...siteReleaseIssues(doc,{unitIds:[],runIds:[],walls:t.walls}));
   pieces.push(...body.build.pieces.map(p=>({...p,unitId:t.id,runId:t.walls.join('+'),family:'corner',recipeId:t.build.recipe})));
   continue;
  }
  const sheet=specialParts({...t,geometry:geom.get(t.unitId)},cat,issues,releaseIssues,doc);
  if(sheet){
   pieces.push(...sheet);
   if(t.unitId){usedUnits.add(t.unitId);if(cat.specials?.[t.id]?.bay)skipped.add(t.unitId);}
  }else if(t.kind==='corner'){
   issues.push(t.label+' يحتاج ورقة قطع عائدة إلى هذا الركن.');
   if(t.hardware){
    const item=cat.items.find(i=>i.sku===t.hardware&&i.kind==='piece');
    if(item)pieces.push({unitId:t.id,runId:t.walls.join('+'),family:'corner',sku:item.sku,label:'عتاد '+t.label,kind:'piece',a:null,b:null,count:1});
    else issues.push('رقم آلية '+t.label+' غير معرف في الكتالوج.');
   }
  }else if(t.kind==='inside')issues.push('تقسيم داخلي خاص في '+t.unitId+' يحتاج ورقة قطع.');
 }
 const outside=units.filter(u=>includes(u.id)&&!usedUnits.has(u.id));
 if(outside.length)issues.push('وحدات خارج الحصر أو تحتاج تحديثًا: '+outside.map(u=>u.id).join('، '));
 if(!usedUnits.size&&!targets.length&&!(!partial&&Object.values(workshop.options||{}).some(o=>o.linearLight?.state==='factory')))issues.push('لم يطبَّق صف من كتالوج المصنع على الرسم.');
 if(!partial)for(const wall of Object.keys(workshop.options||{})){
  const lights=calculateWallLighting(doc,wall,cat);
  if(lights){pieces.push(...lights.pieces);issues.push(...lights.issues,...linearCollisionIssues(kitchenGeometry(doc.kitchen,doc.room),wall));releaseIssues.push(...lights.releaseIssues,...siteReleaseIssues(doc,{walls:[wall]}));}
  const x=wallOptionTakeoff(doc,wall);issues.push(...x.pending);
  for(const o of x.items){
   const ours=o.readiness==='factory',key='wall:'+wall+':'+o.kind+(o.featureId?':'+o.featureId:''),target=specialBy.get(key);
   const inMaterials=ours&&target&&pieces.some(p=>p.unitId===key)&&((cat.specials?.[key]?.signature===target.signature)||!!workshop.options?.[wall]?.factoryTrim?.[o.kind]||!!(o.featureId&&accessoryChoice(workshop.options[wall],o.kind,o.featureId)?.recipe));
   const fee=ours&&!inMaterials?cat.wallRates[o.kind]:null,cost=inMaterials?0:fee==null?null:Math.round(o.quantity*fee*100)/100;
   if(ours&&!inMaterials&&cost==null)missing.push(wallRates[o.kind]);
   if(ours&&!inMaterials)releaseIssues.push(o.label+' على '+wall+' يحتاج ورقة قطع أو توريد خاصة.');
   const produced=pieces.filter(p=>p.unitId===key&&p.recipeId);
   const quantity=produced.length&&o.kind==='cornice'?produced.reduce((n,p)=>n+p.count*p.datumLengthMm,0)/1000:
    produced.length&&o.kind==='filler'?produced.reduce((n,p)=>n+p.count*p.a*p.b,0)/1e6:o.quantity;
   extras.push({...o,quantity,wall,fee,cost,inMaterials});
  }
 }
 for(const [wall,options] of Object.entries(workshop.options||{})){
  const records=(options.scribes||[]).filter(q=>includes(q.unitId));if(!records.length)continue;
  const scene=kitchenGeometry(doc.kitchen,doc.room);
  for(const q of records){
   const result=scribePiece(doc,wall,q,cat,scene);if(!result.ok){issues.push(result.reason);continue;}
   releaseIssues.push(...siteReleaseIssues(doc,{walls:[wall,q.against]}));
   pieces.push(result.part);
  }
 }
 const base=baseSupportTakeoff(doc,cat,partial?{unitIds:[...selected]}:undefined,pieces);
 pieces.push(...base.pieces);issues.push(...base.issues);releaseIssues.push(...base.releaseIssues);
 const openBase=base.units.filter(u=>includes(u.id)&&u.applicable&&(u.mode==='unknown'||u.apron==='unknown'));
 const fitoutPending=[];
 if(openBase.length)fitoutPending.push('لم يُحسم ارتكاز الدولاب أو ساتره للوحدات '+openBase.map(u=>u.id).join('، ')+'.');
 const stone=!partial&&drawing?worktopUpstandTakeoff(doc,cat,drawing):null;
 if(stone){
  pieces.push(...stone.pieces);issues.push(...stone.issues);releaseIssues.push(...stone.releaseIssues);
  fitoutPending.push(...stone.decisionIssues);
  for(const sill of (stone.sills||[]).filter(s=>s.mode==='supplier')){
   extras.push({label:'جلسة رخام أفقية · '+architectureWallLabel(sill.wall)+' · '+sill.windowId+' · '+sill.material+' · '+sill.fromMm+'–'+sill.toMm+' مم · عمق '+sill.depthMm+' مم · سماكة '+sill.thicknessMm+' مم',
    wall:sill.wall,kind:'windowSill',quantity:1,unit:'قطعة',readiness:'external',fee:null,cost:null,inMaterials:false});
  }
  for(const e of stone.supplier)extras.push({label:'نعلة رخام '+architectureWallLabel(e.wall)+' · منسوب القاعدة '+e.bottomMm+' مم · '+e.material+' · '+e.fromMm+'–'+e.toMm+' مم · مقطع '+e.heightMm+' × '+e.thicknessMm+' مم',wall:e.wall,kind:'upstand',quantity:e.lengthMm,unit:'مم',readiness:'external',fee:null,cost:null,inMaterials:false});
 }
 if((workshop.baseSupport||cat.baseSupport)&&openBase.length)issues.push(fitoutPending[0]);
 if(workshop.upstand&&stone)issues.push(...stone.decisionIssues);
 const fitoutSummary=[];
 if(base.known)for(const v of base.units.filter(u=>includes(u.id)&&u.applicable&&u.mode!=='unknown')){
  const number=units.findIndex(u=>u.id===v.id)+1;
  fitoutSummary.push('U'+number+' · '+baseModeNames[v.mode]+(v.mode==='legs'?' · '+v.legCount+' أرجل':'')+
    ' · '+(v.apron==='yes'?'ساتر أمامي بارتفاع '+v.apronHeightMm+' مم':v.apron==='none'?'بدون ساتر أمامي':'الساتر قيد القرار'));
 }
 if(workshop.upstand&&stone)for(const wall of stone.contactWalls){
  const choice=workshop.upstand.walls?.[wall]||workshop.upstand.choice;
  if(choice.mode==='none'){fitoutSummary.push(architectureWallLabel(wall)+' · بدون نعلة رخام');continue;}
  const parts=stone.segments.filter(s=>s.wall===wall);
  for(const s of parts)fitoutSummary.push(architectureWallLabel(wall)+' · نعلة '+s.material+' · '+s.lengthMm+' × '+s.heightMm+' × '+s.thicknessMm+' مم · '+(s.mode==='factory'?'من المصنع':'من مورّد الرخام'));
 }
 if(stone){
  const names={gap:'انقطاع بعرض البرواز',step:'شريط منخفض تحت الشباك',uniform:'ارتفاع موحّد على الجدار'};
  for(const win of stone.windows||[]){
   if(win.status!=='resolved'||!win.choice||!names[win.choice.kind])continue;
   fitoutSummary.push(architectureWallLabel(win.wall)+' · شباك عند '+win.fromMm+' مم · '+names[win.choice.kind]+
    (win.choice.kind==='gap'?'':' · '+win.effectiveHeightMm+' مم'));
  }
  for(const seam of stone.seamRequests||[]){
   if(seam.status!=='resolved')continue;
   const cuts=stone.pieces.filter(p=>p.jointReference&&p.runId===seam.wall&&p.fromMm>=seam.fromMm&&p.toMm<=seam.toMm);
   if(cuts.length>1)fitoutSummary.push(architectureWallLabel(seam.wall)+' · خط متصل من '+seam.fromMm+' إلى '+seam.toMm+' مم · محطات الوصل من بداية الجدار '+cuts.slice(0,-1).map(p=>p.toMm).join('، ')+' مم');
  }
  for(const s of stone.sills||[])fitoutSummary.push(architectureWallLabel(s.wall)+' · جلسة أفقية للشباك '+s.windowId+' · '+(s.toMm-s.fromMm)+' × '+s.depthMm+' × '+s.thicknessMm+' مم · '+(s.mode==='factory'?'من المصنع':'من المورّد'));
 }
 const purchasing=purchaseRequirements(cat,pieces);subtotal=purchasing.subtotal;
 purchases.push(...purchasing.purchases);issues.push(...purchasing.issues);missing.push(...purchasing.missing);releaseIssues.push(...purchasing.releaseIssues);
 const services={};let worktop=0;
 if(!partial)for(const [key,label] of Object.entries({labor:'أجور تصنيع',installation:'تركيب',delivery:'نقل',marginPct:'إضافة البيع ٪',taxPct:'الضريبة ٪'})){services[key]=cat.terms[key];if(services[key]===null)missing.push(label);}
 if(!partial&&cat.terms.worktop==='include'){
  try{const w=calculateKitchenDefaults(doc);worktop=!w.materials.length?0:!w.excludedMaterials?w.estimatedCost:null;}catch{worktop=null;}
  if(worktop===null)missing.push('تكلفة خامة سطح العمل');
 }
 const extraCost=extras.reduce((s,x)=>s+(x.cost??0),0);
 const complete=(!!usedUnits.size||!partial&&pieces.length>0)&&!issues.length&&!missing.length;
 const materialValue=!issues.length&&!purchases.some(p=>p.cost===null)&&pieces.length?Math.round(subtotal*100)/100:partial&&complete?0:null;
 const additionalPurchaseCost=!issues.length&&purchases.every(p=>p.orderCost!==null)?Math.round(purchases.reduce((a,p)=>a+p.orderCost,0)*100)/100:null;
 const work=machiningSheet(pieces,cat);releaseIssues.push(...work.issues);
 const knownCosts=subtotal+extraCost+(worktop||0)+(services.labor||0)+(services.installation||0)+(services.delivery||0);
 const saleBeforeTax=!partial&&complete?Math.round(knownCosts*(1+services.marginPct/100)*100)/100:null;
 const total=!partial&&complete?Math.round(saleBeforeTax*(1+services.taxPct/100)*100)/100:null;
 const states=catalogRecordStates(workshop),ownersApproved=states?Object.values(states).every(s=>s.approved):cat.approved;
 return {pieces,purchases,extras,...(fitoutSummary.length?{fitoutSummary}:{}),...(fitoutPending.length?{fitoutPending}:{}),operations:work.operations,machineIssues:work.issues,unrouted:work.unrouted,partial,selectedUnitIds:partial?[...selected].sort():undefined,materialValue,additionalPurchaseCost,releaseIssues:[...new Set(releaseIssues)],services,worktop,total,saleBeforeTax,worktopIncluded:!partial&&cat.terms.worktop==='include',issues:[...new Set(issues)],missing,subtotal:Math.round(subtotal*100)/100,complete,ready:complete&&ownersApproved&&!releaseIssues.length&&!fitoutPending.length,coveredUnits:usedUnits.size,totalUnits:partial?selected.size:units.length,customerBays:[...skipped],outside:outside.map(u=>u.id),catalogVersion:cat.revision,approved:cat.approved};
}
