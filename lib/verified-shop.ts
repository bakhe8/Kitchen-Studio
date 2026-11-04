import {approvalState,batchReleaseState,manufacturingKeys,orderHandoffUnits,cleanIdea,kitchenGeometry,readChainRange,releaseConcerns,catalogRecordsFromWorkshop,catalogRecordStates,hasWorkshopCatalog} from "./generated-shop-domain.mjs";

type Archive={design?:{room?:{workshop?:{catalog?:unknown;storeCatalog?:unknown;factoryRecipes?:unknown;pricingTerms?:unknown;catalogMeta?:unknown;referenceOrder?:{approval?:unknown};approvals?:{release?:unknown}}}}};
// Compare by JSON value rather than object key order, which an import may alter.
function stable(value:unknown):string{
 if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
 if(value&&typeof value==="object")return "{"+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+":"+stable(v)).join(",")+"}";
 return JSON.stringify(value)??"null";
}
export function unchangedFactoryAuthority(previous:Archive,next:Archive){
 const old=previous?.design?.room?.workshop,updated=next?.design?.room?.workshop;
 const before=hasWorkshopCatalog(old)?catalogRecordsFromWorkshop(old):null,after=hasWorkshopCatalog(updated)?catalogRecordsFromWorkshop(updated):null;
 if(hasWorkshopCatalog(old)&&!before||hasWorkshopCatalog(updated)&&!after)return false;
 if(stable(before)!==stable(after))return false;
 // Editors may invalidate a stamp by removing it. Only owners can create/change it.
 if(updated?.referenceOrder?.approval&&stable(old?.referenceOrder?.approval)!==stable(updated.referenceOrder.approval))return false;
 return !updated?.approvals?.release||stable(updated.approvals.release)===stable(old?.approvals?.release);
}
function readDesign(raw:unknown){
 return cleanIdea(raw&&typeof raw==="object"&&"design" in raw?raw.design:null);
}
// Only the server may expose a sale total. A typed customer stamp is not proof
// of owner authorization; the trusted actor log or owner-issued receipt is.
export async function approvedSale(db:D1Database,id:string,revision:number,currentRevision:number,digest:string,archive:unknown){
 const pending={status:'pending'};
 if(revision!==currentRevision)return pending;
 const doc=readDesign(archive);if(!doc)return pending;
 const state=await approvalState(doc),stamp=doc.room.workshop?.approvals?.customer,records=catalogRecordStates(doc.room.workshop);
 const total=state.quote.total;
 if(typeof total!=='number')return pending;
 const totalMinor=Math.round(total*100);
 if(!stamp||!state.valid.customer||!state.quote.ready||!records||!Object.values(records).every((r:any)=>r.approved)||!Number.isSafeInteger(totalMinor))return pending;
 const log=await db.prepare(`SELECT 1 FROM studio_approvals a JOIN studio_projects p ON p.id=a.project_id
  WHERE a.project_id=? AND a.kind='customer' AND a.subject='' AND a.revision<=? AND a.actor=p.owner
  AND a.stamp_key=? AND a.stamp_name=? AND a.stamp_date=? LIMIT 1`).bind(id,revision,stamp.key,stamp.name,stamp.date).first();
 const release=log?null:await db.prepare(`SELECT 1 FROM studio_releases r JOIN studio_projects p ON p.id=r.project_id
  WHERE r.project_id=? AND r.revision=? AND r.issuer=p.owner AND r.digest=? AND r.total_minor=?`).bind(id,revision,digest,totalMinor).first();
 return log||release?{status:'approved',totalMinor,currency:'SAR',revision}:pending;
}
export async function inspectShopRelease(raw:unknown){
 const doc=readDesign(raw);
 if(!doc)return {issues:["الرسم أو الكتالوج لا يجتاز فحص بنية الاستوديو."]};
 const state=await approvalState(doc),issues=releaseConcerns(doc,state),w=doc.room.workshop;
 const records=catalogRecordStates(w);
 if(!records?.factory.approved)issues.push("الكتالوج بحاجة إلى اعتماد المصنع.");
 if(!records?.store.approved)issues.push("أصناف المتجر بحاجة إلى اعتماد.");
 if(!records?.pricing.approved)issues.push("شروط التسعير بحاجة إلى اعتماد.");
 if(!doc.kitchen.units.length||!doc.kitchen.runs.length)issues.push("لا توجد وحدات موثّقة يمكن إطلاقها للتصنيع.");
 if(typeof state.quote.total!=="number"||!Number.isSafeInteger(Math.round(state.quote.total*100)))issues.push("إجمالي السعر غير مؤكد.");
 return {issues:[...new Set(issues)],key:state.keys.release,totalMinor:Math.round((state.quote.total||0)*100)};
}

export async function inspectUnitBatch(raw:unknown,unitIds:unknown){
 const doc=readDesign(raw);
 if(!doc)return {issues:["تعذّر التحقق من الرسم والكتالوج المحفوظين."]};
 const b=await batchReleaseState(doc,unitIds);
 const minor=b.quote?.materialValue==null?null:Math.round(b.quote.materialValue*100);
 if(!Number.isSafeInteger(minor))return {issues:[...b.issues,"قيمة خام الدفعة غير مؤكدة."]};
 return {issues:b.issues,key:b.key,unitIds:b.scope?.unitIds,materialMinor:minor};
}

export function manufacturingScope(raw:unknown){
 const doc=readDesign(raw);if(!doc)throw Error('Invalid archived kitchen');
 return {unitKeys:manufacturingKeys(doc),targets:orderHandoffUnits(doc).map(u=>u.id)};
}
