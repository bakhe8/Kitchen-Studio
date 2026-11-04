// Golden orders that are meant to release use a documented integral carcass
// on a verified level floor and an explicit customer decision on the upstand.
import {readWorkshopCatalog} from '../public/kitchen-catalog-view.js';
export function confirmFixtureFitout(doc){
 const ws=doc.room.workshop,cat=readWorkshopCatalog(ws),rules={};
 for(const [family,f] of Object.entries(cat.families)){
  if(['upperStorage','dishwasher'].includes(f.base||family)||f.customerBay)continue;
  rules[family]={family,mode:'integral',label:'قاعدة جسم معتمدة للاختبار',reference:'QA-BODY-01',default:true,site:'any',
   minWidthMm:f.minMm,maxWidthMm:f.maxMm,bodyClearMm:0,apron:'none'};
 }
 (ws.factoryRecipes||cat).baseSupport={rules,aprons:{}};
 ws.baseSupport={units:{},runs:Object.fromEntries(doc.kitchen.runs.filter(r=>r.tier==='base').map(r=>[r.id,{reference:'QA-LEVEL-01'}]))};
 ws.upstand={choice:{mode:'none'},walls:{}};
 return doc;
}
