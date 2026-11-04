import {buildFactoryQuote,cleanCatalog,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {hasWorkshopCatalog,reconcileWorkshopCatalogs,workshopCatalogView} from './kitchen-catalog-records.js';

const termKeys=['labor','installation','delivery','marginPct','taxPct','worktop'];
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const keys=value=>Reflect.ownKeys(value);
const numeric=(value,max)=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max;
const finite=value=>Number.isFinite(value)?value:null;
const difference=(after,before)=>after===null||before===null?null:Math.round((after-before)*100)/100;

/**
 * Preview only supported commercial edits against this project's real catalog.
 * Numeric inputs are already parsed: null means unpriced; zero is a real price.
 * Throws on malformed edits/catalogs. The caller owns permission, source revision,
 * persistence and approval actions; this function neither saves nor signs data.
 * Changes are {kind:'price',sku,before,after} or {kind:'term',field,before,after}.
 */
export function reviewQuotePreview(doc,edits={}){
 if(!doc?.room||!doc?.kitchen||!Array.isArray(doc.kitchen.units)||!Array.isArray(doc.kitchen.runs))throw Error('تعذّر قراءة مشروع عرض السعر.');
 if(!record(edits)||keys(edits).some(k=>!['prices','terms'].includes(k)))throw Error('تعديل عرض السعر يتطلب أسعار أصناف أو شروط بيع معروفة.');
 for(const key of ['prices','terms'])if(Object.hasOwn(edits,key)&&!record(edits[key]))throw Error('راجع سجل '+(key==='prices'?'أسعار الأصناف.':'شروط البيع.'));
 const w=doc.room.workshop||{},stored=hasWorkshopCatalog(w);
 if(stored&&!workshopCatalogView(w))throw Error('الكتالوج المخزّن غير صالح. راجع سجلات الكتالوج.');
 const base=getFactoryCatalog(doc),bySku=new Map(base.items.map(item=>[item.sku,item])),changes=[];
 for(const sku of keys(edits.prices||{})){
  if(typeof sku!=='string'||!bySku.has(sku))throw Error('الصنف المطلوب غير موجود في كتالوج المشروع.');
  const value=edits.prices[sku];
  if(!numeric(value,1e8))throw Error('سعر الصنف يجب أن يكون رقمًا من صفر إلى 100000000 أو قيمة غير مسعّرة.');
  const before=bySku.get(sku).price;if(value!==before)changes.push({kind:'price',sku,before,after:value});
 }
 for(const field of keys(edits.terms||{})){
  if(!termKeys.includes(field))throw Error('شرط البيع المطلوب غير معروف.');
  const value=edits.terms[field];
  if(field==='worktop'?!['separate','include'].includes(value):!numeric(value,['marginPct','taxPct'].includes(field)?100:1e8))throw Error('راجع قيمة شرط البيع؛ النسبة من صفر إلى 100 والقيمة المالية غير سالبة أو غير محسومة.');
  const before=base.terms[field];if(value!==before)changes.push({kind:'term',field,before,after:value});
 }
 let candidate=doc;
 if(changes.length){
  const catalog=structuredClone(base);
  for(const change of changes){
   if(change.kind==='price')catalog.items.find(item=>item.sku===change.sku).price=change.after;
   else catalog.terms[change.field]=change.after;
  }
  catalog.revision=base.revision+1;
  // Commercial edits never change the factory layout revision or grant approval.
  const clean=cleanCatalog(catalog);if(!clean)throw Error('تعذّر إعداد كتالوج الأسعار. راجع القيم أو إصدار السجل.');
  const authoritative=stored?w:{...w,catalog:base};
  const workshop=reconcileWorkshopCatalogs({...w,catalog:clean},authoritative);
  if(!workshop)throw Error('تعذّر تحديث سجلات الكتالوج لهذا العرض.');
  candidate={...doc,room:{...doc.room,workshop}};
 }
 const previousQuote=buildFactoryQuote(doc),quote=candidate===doc?previousQuote:buildFactoryQuote(candidate);
 const total=finite(quote.total),previousTotal=finite(previousQuote.total),materialValue=finite(quote.materialValue),previousMaterialValue=finite(previousQuote.materialValue);
 return {doc:candidate,quote,previousQuote,total,previousTotal,delta:difference(total,previousTotal),materialValue,previousMaterialValue,materialDelta:difference(materialValue,previousMaterialValue),changed:changes.length>0,changes};
}

/** Actual source identities; shared packed material costs are never allocated to units. */
export function quoteProvenance(doc,quote=buildFactoryQuote(doc)){
 const byUnit=new Map(),byMaterial=new Map();
 for(const piece of quote.pieces){
  if(!byMaterial.has(piece.sku))byMaterial.set(piece.sku,[]);byMaterial.get(piece.sku).push(piece);
  if(typeof piece.unitId==='string'){
   if(!byUnit.has(piece.unitId))byUnit.set(piece.unitId,[]);byUnit.get(piece.unitId).push(piece);
  }
 }
 const purchases=new Map(quote.purchases.map(p=>[p.sku,p]));
 for(const sku of purchases.keys())if(!byMaterial.has(sku))byMaterial.set(sku,[]);
 return {
  units:[...byUnit].map(([unitId,pieces])=>({unitId,runIds:[...new Set(pieces.map(p=>p.runId).filter(id=>typeof id==='string'))],skus:[...new Set(pieces.map(p=>p.sku))],pieces})),
  materials:[...byMaterial].map(([sku,pieces])=>({sku,unitIds:[...new Set(pieces.map(p=>p.unitId).filter(id=>typeof id==='string'))],pieces,purchase:purchases.get(sku)||null}))
 };
}
