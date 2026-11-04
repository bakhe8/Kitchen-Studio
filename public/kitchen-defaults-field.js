// Resolve a proposed manual entry without manufacturing a measurement or
// allowing a generic template to overwrite evidence for the selected object.
import {resolveDefault} from './kitchen-defaults-model.js';
import {designDefault} from './kitchen-defaults-calculations.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
const norm=s=>String(s??'').trim().normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const val=r=>r.value??null;
export function manualDefault(doc,{code,property,itemId='',location=''}){
 if(!property?.trim())return null;
 const linked=String(location||'').match(/\[([^\]]+)\]\s*$/)?.[1]||'';
 const matches=(doc.room?.fieldRegister?.records||[]).filter(r=>r.inputCode===code&&norm(r.property)===norm(property)&&r.execution!=='excluded'&&((r.itemId===itemId&&(!linked||!r.location?.match(/\[([^\]]+)\]\s*$/)||r.location.endsWith('['+linked+']')))||linked&&r.location?.endsWith('['+linked+']')));
 if(matches.length){
  const unique=new Set(matches.map(r=>JSON.stringify([r.value,r.unit,r.verification==='na',r.verification==='unknown'])));
  if(unique.size>1||matches.some(r=>r.verification==='conflict'))return {mode:'unknown',origin:'conflict',source:'هناك قراءات مختلفة للعنصر. راجعها قبل استخدام قيمة أخرى.'};
  const r=matches.at(-1);return {mode:r.verification==='na'?'na':r.value===null||r.verification==='unknown'?'unknown':'value',value:val(r),type:r.valueType,unit:r.unit,origin:'record',source:'قراءة مسجلة للعنصر · '+(r.source||r.itemId)};
 }
 const spec={code,property,itemId},direct=resolveDefault(doc,spec),via=linked?resolveDefault(doc,{...spec,itemId:linked}):null,cfg=(via?.origin==='entity'&&direct?.origin!=='entity')?via:direct;
 const design=(linked?designDefault(doc,{...spec,itemId:linked}):null)||designDefault(doc,spec)||designDefault(doc,{code,property,itemId:''});
 if(design)return {mode:'value',value:design.value,type:design.type,unit:design.unit||'',origin:design.origin,source:design.source};
 if(!cfg)return null;const v=cfg.value,table=property==='خامة واجهة الوحدة الجديدة'?kitchenFrontFinishes:property==='خامة سطح العمل الجديد'?kitchenWorktopFinishes:null;
 return {...cfg,value:table?.[v]?.label??v};
}
