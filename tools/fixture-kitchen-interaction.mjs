import assert from 'node:assert/strict';
import {createKitchen,addRun,addKitchenUnitRaw} from '../public/kitchen-model.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';

// A single flexible neighbour makes the 2400 mm journey deterministic without
// replacing the real row solver, factory catalogue or project validators.
export function makeInteractionFixture({targetPinned=false,donorPinned=false}={}){
 const room={projectId:'K-1234567890ABCDEF',name:'اختبار تعديل العرض',width:500,length:500,height:275};
 const catalog=seedCatalog();catalog.approved=true;
 for(const item of catalog.items)item.price=item.kind==='panel'?100:10;
 Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
 const entries=[
  {id:'A',width:true,position:true},
  {id:'target',width:targetPinned,finish:true},
  {id:'C',width:donorPinned},
  {id:'D',width:true,position:true},
 ];
 const begun=addRun(createKitchen(room,'empty'),room,{id:'R',tier:'base',wall:'back',start:0,end:240,bottom:0,depth:60,height:86});
 assert(begun.ok,begun.reason);
 let kitchen=begun.kitchen;
 const units=entries.map((entry,index)=>{
  const target=entry.id==='target';
  const added=addKitchenUnitRaw(kitchen,room,{id:entry.id,kind:target?'drawers':'storage',runId:'R',u:index*60,width:60});
  assert(added.ok,added.reason);kitchen=added.kitchen;
  return {id:entry.id,family:target?'rice':'storage',startMm:index*600,widthMm:600,
   locks:{width:entry.width,position:entry.position===true,usage:false,finish:entry.finish===true},
   ...(target?{riceMode:'bags'}:{})};
 });
 room.workshop={catalog,rows:{R:{catalogVersion:String(catalog.layoutRevision),warnings:[],units}}};
 const doc=cleanIdea({room,kitchen});
 assert(doc,'The fixture must pass the real project validator');
 assert(buildFactoryQuote(doc).complete,'The fixture must have a complete factory quote');
 return doc;
}

export const widthIntent=(requestedValue,overrides={})=>({
 objectId:'target',property:'width',requestedValue,referenceEdge:null,
 inputKind:'number',explicitUserChange:true,...overrides,
});
