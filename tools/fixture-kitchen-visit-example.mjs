// A fresh demonstration visit has records and a price book, but no cabinets
// and no signed site, customer, or release checks. It never touches storage.
import {makeChainExample,newChainRow,applyChain} from '../public/kitchen-chain-model.js';
import {readWallOptions,applyWallOptions} from '../public/kitchen-chain-options.js';
import {applyAnswer} from '../public/kitchen-assist-engine.js';
import {saveApplianceRequest} from '../public/kitchen-appliance-intake.js';
import {updateDecisionReview} from '../public/kitchen-project-decisions.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';

const exampleReference='مثال توضيحي لزيارة ٥ × ٥';
function result(value){
 if(!value.ok)throw Error(exampleReference+' · '+value.reason);
 return value;
}
export function makeVisitExample(){
 let doc=makeChainExample();
 doc.room.name=exampleReference;
 const catalog=seedCatalog();
 catalog.name='كتالوج مثال الزيارة · أسعار تعليمية';
 catalog.approved=true;
 for(const item of catalog.items)item.price=item.kind==='panel'?100:10;
 Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
 doc.room.workshop.catalog=catalog;
 // Keep the original two casing measurements and the customer's 4300 mm
 // stopping point. The electrical outlet is an independent wall station.
 const chain=structuredClone(doc.room.workshop.chains.back);
 const door=chain.rows.find(r=>r.kind==='door');
 const window=chain.rows.find(r=>r.kind==='window');
 door.frameRead={method:'station',distanceMm:1300};
 window.frameRead={method:'opposite',distanceMm:1800,wallLengthMm:5000};
 const stop=chain.rows.findIndex(r=>r.kind==='stop');
 chain.rows[stop]={...chain.rows[stop],from:'origin',gapMm:4300};
 chain.rows.splice(stop,0,{...newChainRow('electric','outlet'),from:'origin',gapMm:2600,bottomMm:500});
 doc=result(applyChain(doc,'back',chain)).doc;
 const upper=readWallOptions(doc,'back');
 upper.decisions={upper:true,cornice:true};
 upper.mode='gap';upper.bottomMm=1450;upper.heightMm=700;upper.depthMm=350;
 upper.curtains['chain-back-window']={state:'none',type:'roller',aboveMm:0,leftMm:0,rightMm:0,dropMm:1000,projectionMm:0};
 doc=result(applyWallOptions(doc,'back',upper)).doc;
 for(const [key,value] of [['packaging','bag'],['rice-qty',20],['bag-fill',5]]){
  const answer=result(applyAnswer(doc,'customer',key,value,{entityId:'pantry:طلب-تخزين',visit:{responsible:exampleReference}}));
  doc={...doc,room:answer.room};
 }
 doc=result(saveApplianceRequest(doc,{id:'visit-washer',kind:'dishwasher',placement:'bay',name:'غسالة العميل التجريبية',
  model:'DEMO-DW60',manual:'ورقة موديل افتراضية للمثال',body:{width:598,depth:550,height:815},space:{width:600,depth:600,height:860},wall:'back',recipe:'dishwasher',host:''})).doc;
 return result(updateDecisionReview(doc,{active:true,walls:['back']})).doc;
}
