import {finishMembers,finishParts,setFacePanel} from './kitchen-finish-parts.js';
import {reviewPartChoice,patchHardwareFinish} from './kitchen-finish-parts-ui.js';
import {cornerFrontTargets,setCornerFront} from './kitchen-corner-finishes.js';
import {buildFactoryQuote,cleanCatalog,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {hasWorkshopCatalog,workshopCatalogView} from './kitchen-catalog-records.js';

const known=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const difference=(after,before)=>known(after)!==null&&known(before)!==null?Math.round((after-before)*100)/100:null;
const problems=quote=>[...new Set([...(quote.issues||[]),...(quote.machineIssues||[])])];

function currentCatalog(doc,catalog){
 if(!doc?.room||!Array.isArray(doc.kitchen?.units)||!Array.isArray(doc.kitchen?.runs))throw Error('المشروع الحالي غير صالح لمعاينة التشطيب.');
 if(hasWorkshopCatalog(doc.room.workshop)&&!workshopCatalogView(doc.room.workshop))throw Error('كتالوج المشروع غير صالح. أعد فتح النسخة الحالية.');
 const supplied=cleanCatalog(catalog);
 if(!supplied)throw Error('كتالوج اختيارات التشطيب غير صالح. أعد فتح النسخة الحالية.');
 // The owning UI supplies its current catalog and guards document identity.
 // Quote construction always reads the document's authoritative catalog, so a
 // detached display catalog cannot invent a purchase price or a factory recipe.
 return supplied;
}

function targetScope(doc,catalog,scope){
 const members=finishMembers(doc,catalog);
 if(scope==='all'){
  if(!members.length)throw Error('لا توجد وحدات مصنع مؤهلة في نطاق التشطيب.');
  return null;
 }
 if(typeof scope==='string'&&members.some(u=>u.id===scope))return {unitIds:[scope]};
 // Factory corner ids are real manufacturing targets, but the partial quote
 // API accepts rectangular CAD units only. Their complete quote is authoritative.
 if(typeof scope==='string'&&cornerFrontTargets(doc,catalog).some(c=>c.id===scope))return null;
 throw Error('تغيّرت الوحدة أو نطاق التشطيب. أعد تحديدها.');
}

function noNewProblems(before,after){
 const existing=new Set(problems(before)),added=problems(after).find(message=>!existing.has(message));
 if(added)throw Error(added);
}

/**
 * Review an immutable finish candidate, including a corner from setCornerFront.
 * Throws on new recipe/machining problems, invalid catalogs or insufficient
 * discontinued stock. Existing unrelated release/price gaps remain visible.
 * delta is the complete project's SALE total difference; materialDelta is its
 * packed-material difference. Unknown/nonfinite amounts are always null.
 * scopedMaterialValue is available only for a real rectangular unit scope.
 * This function never saves, signs approvals, or changes either input document.
 */
export function reviewFinishCandidate(before,after,catalog,{scope,sku}={}){
 const actual=currentCatalog(before,catalog);
 if(before.room.projectId!==after?.room?.projectId)throw Error('تغيّر المشروع أثناء معاينة التشطيب.');
 currentCatalog(after,actual);
 const partial=targetScope(before,actual,scope);
 targetScope(after,actual,scope);
 const previousQuote=buildFactoryQuote(before),quote=buildFactoryQuote(after);
 const previousScopedQuote=partial?buildFactoryQuote(before,partial):null,scopedQuote=partial?buildFactoryQuote(after,partial):null;
 if(partial)noNewProblems(previousScopedQuote,scopedQuote);
 noNewProblems(previousQuote,quote);
 if(sku){
  const item=getFactoryCatalog(after).items.find(i=>i.sku===sku);
  if(!item)throw Error('صنف التشطيب غير موجود في كتالوج المشروع.');
  if(!item.available){
   const need=quote.purchases.find(p=>p.sku===sku);
   if(need&&(known(need.fromStock)===null||need.fromStock<need.qty))throw Error('المخزون لا يغطي كل وحدات المشروع من الصنف '+sku+' المتوقف توريده.');
  }
 }
 const total=known(quote.total),previousTotal=known(previousQuote.total),materialValue=known(quote.materialValue),previousMaterialValue=known(previousQuote.materialValue);
 return {doc:after,delta:difference(total,previousTotal),total,previousTotal,
  materialValue,previousMaterialValue,materialDelta:difference(materialValue,previousMaterialValue),
  scopedMaterialValue:known(scopedQuote?.materialValue),previousScopedMaterialValue:known(previousScopedQuote?.materialValue),
  scopedMaterialDelta:difference(scopedQuote?.materialValue,previousScopedQuote?.materialValue),
  issues:problems(quote),quote,previousQuote,scopedQuote,previousScopedQuote};
}

/** Build and review one catalog choice. part is front, corner, a published finish
 * part, or mechanisms with a named hardware group. scope is a unit id or all; rated
 * hardware remains unit-specific. sku=null resets component/hardware overrides.
 * Front choices retain setFacePanel's existing starter-catalog approval policy.
 */
export function reviewFinishPreview(doc,catalog,{scope,part,sku,group}={}){
 const actual=currentCatalog(doc,catalog);
 targetScope(doc,actual,scope);
 let after;
 if(part==='front')after=setFacePanel(doc,actual,scope,sku);
 else if(part==='corner')after=setCornerFront(doc,actual,scope,sku);
 else if(part==='mechanisms'){
  if(scope==='all'||!doc.kitchen.units.some(u=>u.id===scope))throw Error('اختر وحدة واحدة لتحديد مجموعة العتاد.');
  if(typeof group!=='string'||!group.trim())throw Error('اختر مجموعة عتاد من وصفة الوحدة.');
  after=patchHardwareFinish(doc,actual,scope,group,sku);
 }else if(Object.hasOwn(finishParts,part))after=reviewPartChoice(doc,actual,scope,part,sku).doc;
 else throw Error('نوع قطعة التشطيب غير معروف.');
 return reviewFinishCandidate(doc,after,actual,{scope,sku});
}
