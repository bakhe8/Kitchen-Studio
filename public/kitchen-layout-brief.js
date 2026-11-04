const money=x=>Number.isFinite(x)&&x>=0&&x<=1e9&&Math.abs(x*100-Math.round(x*100))<.0001;
export const priorityLabels={contract:'تكلفة المشروع',storage:'عرض التخزين العام',travel:'المسافة بين الغسالة والمجلى',cuts:'عدد قطع الخام',alignment:'محاذاة فواصل العلوي والسفلي'};
export function cleanLayoutBrief(raw){
 if(!raw||!['none','fixed','preferred'].includes(raw.mode)||typeof raw.reference!=='string'||!raw.reference.trim()||raw.reference.length>160||!raw.weights||typeof raw.weights!=='object')return null;
 const w={};for(const k of Object.keys(priorityLabels)){const n=raw.weights[k]??0;if(!Number.isInteger(n)||n<0||n>5)return null;w[k]=n;}
 if(!Object.values(w).some(n=>n))return null;
 if(raw.mode!=='none'&&(!money(raw.capSar)||!money(raw.extraSar)||typeof raw.scope!=='string'||!raw.scope.trim()||raw.scope.length>240))return null;
 return {mode:raw.mode,reference:raw.reference.trim(),weights:w,...(raw.mode!=='none'?{capSar:raw.capSar,extraSar:raw.extraSar,scope:raw.scope.trim()}:{})};
}
export function compareBudget(quote,b){
 if(!b||b.mode==='none')return {status:'open',total:quote.total};
 if(!quote.complete||!Number.isFinite(quote.total)||!Number.isFinite(b.extraSar))return {status:'unknown',total:null};
 const value=Math.round(quote.total*100)+Math.round(b.extraSar*100),rest=Math.round(b.capSar*100)-value;
 return {status:rest<0?'over':'within',total:value/100,margin:rest/100};
}
export function budgetHold(quote,brief){
 if(brief?.mode!=='fixed')return '';
 const b=compareBudget(quote,brief);
 return b.status==='unknown'?'ينتظر السقف المالي اكتمال عرض المشروع على أساس البنود والضريبة المتفق عليهما.':b.status==='over'?'يتجاوز عرض المشروع سقف العميل بمقدار '+(-b.margin)+' ر.س ضمن النطاق الموثق.':'';
}
// Local coordinates are on the same wall. An unmatched divider above an
// opening is outside the overlap and does not count as a bad alignment.
export function dividerMismatch(doc,walls){
 let sum=0,count=0;
 for(const wall of walls){
  const spans=tier=>doc.kitchen.runs.filter(r=>r.wall===wall&&r.tier===tier).flatMap(r=>doc.kitchen.units.filter(u=>u.runId===r.id).map(u=>[u.u*10,(u.u+u.width)*10]));
  const upper=spans('upper'),base=spans('base');
  function seams(a,b){for(const v of new Set(a.flat())){if(!a.some(p=>Math.abs(p[0]-v)<.01)||!a.some(p=>Math.abs(p[1]-v)<.01))continue;
    const faces=b.filter(([from,to])=>v>=from-.01&&v<=to+.01);if(!faces.length)continue;
    sum+=Math.min(...faces.flat().map(x=>Math.abs(x-v)));count++;
  }}
  seams(upper,base);seams(base,upper);
 }return count?Math.round(sum/count*1000)/1000:null;
}
export function rankByBrief(list,brief){
 const keys=Object.keys(priorityLabels).filter(k=>brief.weights[k]>0),metrics=c=>({contract:c.budget.total,storage:c.storageWidthMm,travel:c.travelComparable?c.serviceDistanceMm:null,cuts:c.cuts,alignment:c.alignmentMm});
 const bounds=Object.fromEntries(keys.map(k=>{const vs=list.map(c=>metrics(c)[k]).filter(Number.isFinite);return [k,vs.length?[Math.min(...vs),Math.max(...vs)]:null];}));
 for(const c of list){
  const values=metrics(c);c.rankScores={};let score=0,total=0;c.unknownMetrics=[];
  for(const k of keys){const w=brief.weights[k],range=bounds[k],n=values[k];if(!range)continue;
   total+=w;if(!Number.isFinite(n)){c.unknownMetrics.push(k);c.rankScores[k]=null;continue;}
   const part=range[1]===range[0]?1:k==='storage'?(n-range[0])/(range[1]-range[0]):(range[1]-n)/(range[1]-range[0]);
   score+=w*part;c.rankScores[k]=Math.round(part*w*100)/100;
  }c.rankScore=total?Math.round(100*score/total):null;
 }
 const status=c=>c.budget.status==='within'?0:c.budget.status==='over'?1:2;
 return list.sort((a,b)=>Number(a.provisional)-Number(b.provisional)||(brief.mode==='preferred'?status(a)-status(b):0)||a.unknownMetrics.length-b.unknownMetrics.length||(b.rankScore??-1)-(a.rankScore??-1)||a.changed-b.changed||a.key.localeCompare(b.key));
}
