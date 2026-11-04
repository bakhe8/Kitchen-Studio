import {buildFactoryQuote,cleanCatalog,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {hasWorkshopCatalog,reconcileWorkshopCatalogs,workshopCatalogView} from './kitchen-catalog-records.js';
import {cleanPartOperations,machiningSheet} from './kitchen-machining.js';
import {finishMembers,resolveFinishParts} from './kitchen-finish-parts.js';
import {factorySpecialTargets} from './kitchen-workshop-factory-special.js';

const copy=value=>structuredClone(value);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
const equal=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const sameSource=(a,b)=>a.family===b.family&&a.line===b.line&&a.specialId===b.specialId;
const opKeys=['kind','machine','reference','tolerance','xFrom','yFrom','x','y','diameter','depth','length','width','angle','radius','minutes','provider','confirmation','leadDays'];

function context(doc,quote){
 if(!doc?.room||!Array.isArray(doc?.kitchen?.units)||!Array.isArray(doc.kitchen.runs)||!Array.isArray(doc.kitchen.features))throw Error('تعذّر قراءة مشروع قطع الورشة.');
 const w=doc.room.workshop||{};
 if(hasWorkshopCatalog(w)&&!workshopCatalogView(w))throw Error('الكتالوج المخزّن غير صالح. راجع سجلات المصنع.');
 const catalog=getFactoryCatalog(doc),q=quote??buildFactoryQuote(doc);
 if(!q||q.partial||!Array.isArray(q.pieces))throw Error('تحديد مصدر القطعة يتطلب حصر المشروع كاملًا.');
 return {doc,w,catalog,quote:q,items:new Map(catalog.items.map(i=>[i.sku,i])),members:new Map(finishMembers(doc,catalog).map(m=>[m.id,m])),targets:factorySpecialTargets(doc)};
}

function elementDestination(ctx,piece,target){
 if(['baseApron','baseSupport'].includes(piece.family))return {step:'assembly',focus:{section:'base',runId:piece.runId,unitId:piece.unitId}};
 if(piece.family==='upstand')return {step:'assembly',focus:{section:'stone',wall:piece.runId}};
 if(piece.family==='windowSill'){
  const window=ctx.doc.kitchen.features.find(f=>f.wall===piece.runId&&f.kind==='window'&&piece.unitId.startsWith('sill:'+f.id+':'));
  return {step:'assembly',focus:{section:'stone',wall:piece.runId,...(window?{windowId:window.id}:{})}};
 }
 if(piece.cornerCut||piece.family==='corner'){
  const joint=Object.keys(ctx.w.corners||{}).find(j=>['base','upper','tall'].some(t=>'corner:'+j+':'+t===piece.unitId));
  if(joint)return {step:'corner',focus:{joint}};
 }
 if(piece.scribe){
  const wall=ctx.doc.kitchen.runs.find(r=>r.id===piece.runId)?.wall;
  return {step:'factory',focus:{tab:'trims',unitId:piece.unitId,...(wall?{wall}:{}),...(piece.scribe.anchor?{anchor:piece.scribe.anchor}:{})}};
 }
 const item=target?.item,wall=target?.wall||item?.wall;
 if(item&&wall){
  if(['upstand','windowSill'].includes(item.kind))return {step:'assembly',focus:{section:'stone',wall,...(item.featureId?{windowId:item.featureId}:{})}};
  const op={cornice:'cornice/enabled',filler:'fillerBy'}[item.kind];
  return {step:'wallOptions',focus:{wall,...(item.featureId?{featureId:item.featureId}:{}),...(op?{op}:{}),...(item.kind==='lighting'?{lighting:true}:{})}};
 }
 return null;
}

function sourceAt(ctx,index){
 const piece=Number.isInteger(index)&&index>=0?ctx.quote.pieces[index]:null;
 const result={family:null,line:null,label:piece?.label||'',editable:false,reason:'لم تعد القطعة المحددة موجودة في الحصر الحالي.',operations:copy(piece?.operations||[]),focus:{tab:'recipes'}};
 if(!piece)return result;
 const linked=ctx.targets.find(t=>t.id===piece.unitId||t.id===piece.family+':'+piece.unitId),destination=elementDestination(ctx,piece,linked);
 if(destination)Object.assign(result,destination);
 const reject=(reason,extra={})=>({...result,...extra,editable:false,reason});
 // Resolve generated components before material kind or coincidentally named
 // recipes: a support leg is a supply item but belongs to its assembly policy.
 if(piece.cornerCut||piece.scribe||piece.stationMm!=null||piece.jointReference||['baseSupport','baseApron','upstand','windowSill'].includes(piece.family))return reject('هذه القطعة مولّدة من تفصيل التجميع أو الرفع؛ راجع محرر مصدرها.');
 if(!['panel','bar'].includes(piece.kind))return reject('هذا صنف توريد بالقطعة؛ لا يملك عملية قص خام قابلة للتحرير هنا.',destination||{focus:{tab:'items',sku:piece.sku}});
 const family=piece.recipeId||piece.family,rule=Object.hasOwn(ctx.catalog.families,family)?ctx.catalog.families[family]:null;
 if(rule){
  const member=ctx.members.get(piece.unitId),unit=ctx.doc.kitchen.units.find(u=>u.id===piece.unitId);
  if(!member||member.family!==family||!unit||unit.runId!==piece.runId)return reject('تعذّرت مطابقة القطعة بوحدة ووصفة حاليتين.');
  const target=rule.finishSlots?.handle?.drilling?.target;
  if(target&&(piece.label===target||piece.label.startsWith(target+' · '))){
   const line=rule.recipe.findIndex(l=>l.label===target);
   return reject('عمليات هذه الواجهة مولّدة من سياسة تخريم اليد؛ راجع مصدر التشطيب بدل تعديل نسخة القطعة.',{family,line:line>=0?line:null,focus:{tab:'recipes',family,...(line>=0?{line}:{})}});
  }
  const parts=resolveFinishParts(rule,ctx.w.finishes,piece.unitId,ctx.items);
  if(parts.issues.length)return reject('تعذّرت مطابقة مصدر القطعة مع تشطيب الوحدة الحالي.',{family,focus:{tab:'recipes',family}});
  const front=ctx.w.finishes?.units?.[piece.unitId]?.frontSku||ctx.w.finishes?.frontSku;
  const matches=rule.recipe.flatMap((line,i)=>{
   const item=line.role==='front'&&front?ctx.items.get(front):parts.itemFor(line);
   return line.label===piece.label&&item?.sku===piece.sku&&item.kind===piece.kind?[i]:[];
  });
  if(matches.length!==1)return reject(matches.length?'مصدر القطعة متعدد المطابقات؛ افتح الوصفة لتحديد السطر صراحة.':'لم تُطابق القطعة سطرًا مباشرًا في الوصفة؛ قد يكون مصدرها مولّدًا.',{family,focus:{tab:'recipes',family}});
  const line=matches[0],operations=rule.recipe[line].operations||[],focus={tab:'recipes',family,line};
  if(!equal(operations,piece.operations||[]))return reject('عمليات القطعة مولّدة أو معدّلة من مصدر آخر؛ راجع الوصفة المرتبطة.',{family,line,focus:{tab:'recipes',family,line}});
  return {...result,family,line,editable:true,reason:'',operations:copy(operations),focus};
 }
 const matches=[];
 for(const target of ctx.targets){
  if(target.build||(target.unitId||target.id)!==piece.unitId||target.kind!==piece.family)continue;
  const sheet=ctx.catalog.specials?.[target.id];
  if(!sheet||sheet.signature!==target.signature||sheet.drawing!==piece.drawing)continue;
  sheet.lines.forEach((line,i)=>{
   if(line.label===piece.label&&line.sku===piece.sku&&line.a===piece.a&&line.b===piece.b&&line.count===piece.count&&line.operation===piece.operation)matches.push({target,sheet,line:i});
  });
 }
 if(matches.length!==1)return reject(matches.length?'مصدر الورقة الخاصة متعدد المطابقات.':'لا يوجد مصدر مباشر قابل للتحرير لهذه القطعة.');
 const {target,sheet,line}=matches[0],operations=sheet.lines[line].operations||[],specialId=target.id,location=elementDestination(ctx,piece,target)||{step:'factory',focus:{tab:'special',targetId:specialId}};
 if(!equal(operations,piece.operations||[]))return reject('عمليات الورقة الخاصة لا تطابق القطعة الحالية.',{family:'@'+specialId,specialId,line,...location});
 return {...result,family:'@'+specialId,specialId,line,editable:true,reason:'',operations:copy(operations),...location};
}

/**
 * Resolve a row of the full project quote to one existing recipe/special line.
 * Unsupported or ambiguous generated parts return editable:false with a reason.
 * operations is a detached copy. Optional quote must be this document's full quote;
 * piece indices belong to that snapshot, so callers retain document identity.
 */
export function productionPieceSource(doc,pieceIndex,quote){
 try{return sourceAt(context(doc,quote),pieceIndex);}
 catch(error){return {family:null,line:null,label:'',editable:false,reason:error.message,operations:[],focus:{tab:'recipes'}};}
}

function affected(ctx,source){
 const result=[];
 for(let index=0;index<ctx.quote.pieces.length;index++){
  const found=sourceAt(ctx,index);if(found.editable&&sameSource(found,source))result.push(index);
 }
 return result;
}

/**
 * Replace or append one existing-schema operation; never saves or approves.
 * Every actual piece sharing this recipe is checked, including other units.
 * Throws on invalid input/provenance/new machining problems. No-op keeps doc.
 * affectedPieceIndices refer to the resulting full quote, never a filtered list.
 */
export function reviewProductionPreview(doc,input){
 if(!record(input)||Reflect.ownKeys(input).some(k=>!['pieceIndex','operationIndex','operation'].includes(k)))throw Error('حدّد قطعة وعملية واحدة من الحصر الحالي.');
 const ctx=context(doc),{pieceIndex,operationIndex}=input,source=sourceAt(ctx,pieceIndex);
 if(!source.editable)throw Error(source.reason);
 if(!Number.isInteger(operationIndex)||operationIndex<0||operationIndex>source.operations.length)throw Error('موضع العملية لم يعد يطابق عمليات المصدر الحالي.');
 if(!record(input.operation)||Reflect.ownKeys(input.operation).some(k=>!opKeys.includes(k)))throw Error('بيانات عملية التشغيل غير صالحة.');
 const normalized=cleanPartOperations([input.operation]);if(!normalized)throw Error('راجع أبعاد العملية وسماحتها ومرجعها وبيانات المورد الخارجي.');
 const operation=normalized[0],beforeIndices=affected(ctx,source),previousQuote=ctx.quote;
 const pack=(candidate,quote,indices,changed)=>({doc:candidate,quote,previousQuote,changed,source,operation,affectedUnitIds:[...new Set(indices.map(i=>quote.pieces[i].unitId))],affectedPieceIndices:indices});
 if(operationIndex<source.operations.length&&equal(operation,source.operations[operationIndex]))return pack(doc,previousQuote,beforeIndices,false);
 const catalog=copy(ctx.catalog),line=source.specialId?catalog.specials[source.specialId].lines[source.line]:catalog.families[source.family].recipe[source.line];
 line.operations??=[];line.operations[operationIndex]=operation;
 if(!cleanPartOperations(line.operations))throw Error('قائمة عمليات المصدر غير صالحة أو تجاوزت حد العمليات.');
 catalog.revision=ctx.catalog.revision+1;
 const clean=cleanCatalog(catalog);if(!clean)throw Error('تعذّر التحقق من كتالوج المصنع بعد تعديل العملية.');
 const baseline=hasWorkshopCatalog(ctx.w)?ctx.w:{...ctx.w,catalog:ctx.catalog};
 const workshop=reconcileWorkshopCatalogs({...ctx.w,catalog:clean},baseline);if(!workshop)throw Error('تعذّر تحديث سجل المصنع لهذا التعديل.');
 const candidate={...doc,room:{...doc.room,workshop}},next=context(candidate),indices=affected(next,source);
 if(!indices.length||indices.length!==beforeIndices.length)throw Error('تغيّر ارتباط القطع بمصدر العملية. أعد فتح الحصر الحالي.');
 // Per-operation validation is required even when a pre-existing error has the
 // same message: the quote intentionally deduplicates machine issue strings.
 for(const index of indices){
  const piece=next.quote.pieces[index];
  if(!equal(piece.operations?.[operationIndex],operation))throw Error('تغيّر ترتيب العمليات المولّدة لهذه القطعة. راجع مصدرها.');
  const checked=machiningSheet([{...piece,operations:[operation]}],next.catalog);
  if(checked.operations.length!==1||!checked.operations[0].ok)throw Error(checked.issues.join(' ')||'عملية التشغيل غير صالحة لإحدى القطع المتأثرة.');
 }
 const existing=new Set([...previousQuote.issues,...previousQuote.machineIssues]),added=[...next.quote.issues,...next.quote.machineIssues].filter(issue=>!existing.has(issue));
 if(added.length)throw Error([...new Set(added)].join(' '));
 return pack(candidate,next.quote,indices,true);
}
