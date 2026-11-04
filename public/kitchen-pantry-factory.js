import {ownKey} from './kitchen-safe-keys.js';
import {cleanCatalog} from './kitchen-workshop-factory.js';
export function addGeneralDrawerRecipe(c,key,label,reference){
 if(!/^custom-[a-z0-9][a-z0-9-]{0,38}$/.test(key)||ownKey(c.families,key)||!label?.trim()||!reference?.trim())return false;
 const origin=c.families.rice,recipe=origin?.recipe.filter(l=>!l.when||l.when==='all');if(!recipe?.length)return false;
 const generic={...structuredClone(origin),base:'storage',cadKind:'drawers',label:label.trim(),reference:reference.trim(),recipe:structuredClone(recipe)};
 delete generic.finishSlots;
 for(const [part,slot] of Object.entries(origin.finishSlots||{}))if(slot.labels.every(s=>recipe.some(l=>l.sku===slot.source&&l.label===s))){generic.finishSlots={...generic.finishSlots,[part]:structuredClone(slot)};}
 const candidate={...c,families:{...c.families,[key]:generic}};if(!cleanCatalog(candidate))return false;c.families[key]=generic;return true;
}
export function mountGeneralDrawerRecipe(host,{save,selectFamily,notice}){
 host.innerHTML='<details><summary>تعريف وحدة أدراج لأي استخدام يختاره العميل</summary><form><p>ابدأ بخطوط الجسم والأدراج والسحب العامة في وصفة المصنع، ثم راجعها قبل اعتماد العائلة. تستبعد العملية البنود المشروطة بالأرز والحاوية.</p><label>رمز العائلة<input name="code" required maxlength="39" pattern="[a-z0-9][a-z0-9-]{0,38}" placeholder="general-drawers"></label><label>اسم يظهر للمندوب<input required name="label" maxlength="84" value="وحدة أدراج متعددة الاستخدام"></label><label>مرجع وصفة المصنع<input required name="reference" maxlength="180"></label><button>إنشاء وصفة أدراج عامة للمراجعة</button></form></details>';
 host.onsubmit=e=>{e.preventDefault();e.stopPropagation();const f=new FormData(e.target),key='custom-'+f.get('code').trim();
  let ok=false;const saved=save(c=>{ok=addGeneralDrawerRecipe(c,key,f.get('label'),f.get('reference'));});
  if(ok&&saved)selectFamily(key);else notice('تعذّر تعريف هذه العائلة. راجع الرمز ومكوّنات الوصفة ومرجع المصنع.');
 };
}
