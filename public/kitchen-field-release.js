// Apply explicit unresolved field evidence only to the parts that depend on it.
// Photos and tentative design ideas are not field measurements.
import {fieldInputByCode} from './kitchen-field-catalog.js';
import {convertAssistUnit,assistFold,measurementBaseline} from './kitchen-measurement-identity.js';
const unresolved=new Set(['unknown','preliminary','estimated','conflict']);
const assured=new Set(['measured','documented','confirmed']);
const technical=/^(SITE|MEP|EQP|CAT|COR|MFG|INS)-/;
// measurementBaseline hashes the whole group once per candidate, so a crafted register of look-alike readings cost O(n²): 5000 of them took about 26 seconds.
const BASELINE_GROUP_LIMIT=64;
const globalIds=new Set(['room','project','order','الغرفة','المشروع']);
function targetRefs(r){const m=r.location?.match(/\[([^\]]+)\]\s*$/);return [r.itemId,m?.[1]].filter(Boolean);}
function applies(doc,record,scope){
 if(!scope)return true;
 const refs=targetRefs(record),units=new Set(scope.unitIds),runs=new Set(scope.runIds),walls=new Set(scope.walls);
 if(refs.some(x=>units.has(x)||runs.has(x)||walls.has(x)||globalIds.has(x)))return true;
 const known=new Set([...doc.kitchen.units,...doc.kitchen.runs,...doc.kitchen.features].map(x=>x.id));
 const allWalls=new Set([...doc.kitchen.runs.map(r=>r.wall),...Object.keys(doc.room.workshop?.chains||{})].filter(Boolean));
 for(const ref of refs){const feature=doc.kitchen.features.find(f=>f.id===ref);if(feature&&walls.has(feature.wall))return true;}
 if(refs.some(x=>known.has(x)||allWalls.has(x)))return false;
 // A required record without a scope has to be assigned; guessing could issue the wrong unit.
 return true;
}
const label=r=>(fieldInputByCode.get(r.inputCode)?.name||r.inputCode)+' · '+r.itemId+' · '+r.property;
function sameValue(a,b){
 if(a.valueType!==b.valueType)return false;
 if(a.valueType==='number'){const value=convertAssistUnit(a.value,a.unit,b.unit);return value!==null&&Math.abs(value-b.value)<1e-6;}
 return String(a.value).trim()===String(b.value).trim()&&assistFold(a.unit)===assistFold(b.unit);
}
export function recordReleaseIssues(doc,scope){
 const groups=new Map(),issues=new Set();
 const rows=(doc.room.fieldRegister?.records||[]).filter(r=>r.execution!=='excluded'&&(technical.test(r.inputCode)||r.shopCritical===true)&&applies(doc,r,scope));
 for(const r of rows){
  const key=JSON.stringify([r.inputCode,r.itemId,assistFold(r.property),r.revision||'']);
  const g=groups.get(key)||[];g.push(r);groups.set(key,g);
 }
 for(const all of groups.values()){
  if(all.length>BASELINE_GROUP_LIMIT)issues.add('عدد قراءات الخاصية الواحدة أكبر من '+BASELINE_GROUP_LIMIT+': '+label(all[0])+'. أبقِ القراءات الفعلية فقط قبل التصنيع.');
  const resolved=all.length>BASELINE_GROUP_LIMIT?undefined:all.find(r=>assured.has(r.verification)&&r.assist?.baseline&&r.assist.baseline===measurementBaseline(all.filter(o=>o.id!==r.id)));
  const active=resolved?[resolved]:all.filter(r=>r.verification!=='na');
  if(!active.length)continue;
  for(const r of active)if(r.verification==='conflict'||((r.shopCritical||r.execution==='required')&&unresolved.has(r.verification))){
   issues.add('رفع ينتظر الحسم قبل التصنيع: '+label(r)+' ('+r.id+'). راجع القيمة أو حدّد نطاقها في سجل الفني.');
  }
  const measured=active.filter(r=>assured.has(r.verification)&&r.value!=null);
  if(measured.length>1&&measured.slice(1).some(b=>!sameValue(measured[0],b))){
   issues.add('قراءتان مؤكدتان مختلفتان للخاصية نفسها: '+label(measured[0])+'. راجع المصدرين.');
  }
 }
 return [...issues];
}
