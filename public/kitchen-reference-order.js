// Older projects can carry the original shop bill and its review stamp.
// Validate these records during restore/import without changing their contents.
const within=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const optional=(n,min,max)=>n===null||within(n,min,max);
const text=(v,limit)=>typeof v==='string'&&v.trim().length>0&&v.length<=limit;
const emptyable=(v,limit)=>typeof v==='string'&&v.length<=limit;
const dateOK=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function shopLine(row){
 if(!row||!text(row.unitId,200)||!text(row.sku,96)||!text(row.label,240))return null;
 if(!Number.isSafeInteger(row.count)||!within(row.count,1,1000000))return null;
 const a=row.a??null,b=row.b??null;
 if(!optional(a,0.000001,1e7)||!optional(b,0.000001,1e7)||a===null&&b!==null)return null;
 const result={unitId:row.unitId.trim(),sku:row.sku.trim(),label:row.label.trim(),a,b,count:row.count};
 for(const [key,limit] of [['sourceUnitId',200],['sourceSku',96],['sourceLabel',240]]){
  if(row[key]===undefined)continue;
  if(!text(row[key],limit))return null;
  result[key]=row[key].trim();
 }
 return result;
}
export function cleanReferenceOrder(raw){
 if(!raw||!emptyable(raw.orderNo,160)||!Array.isArray(raw.lines)||raw.lines.length>5000)return null;
 const toleranceMm=raw.toleranceMm??null,materialCost=raw.materialCost??null;
 if(!optional(toleranceMm,0,1000)||!optional(materialCost,0,1e10)||materialCost!==null&&Math.abs(materialCost*100-Math.round(materialCost*100))>.0001)return null;
 const lines=raw.lines.map(shopLine);if(lines.includes(null))return null;
 const order={orderNo:raw.orderNo.trim(),toleranceMm,materialCost,lines};
 if(raw.approval!=null){
  const v=raw.approval;
  if(!/^[0-9a-f]{64}$/.test(v.stamp)||!text(v.reviewer,100)||!dateOK(v.date))return null;
  order.approval={stamp:v.stamp,reviewer:v.reviewer.trim(),date:v.date};
 }
 return order;
}
