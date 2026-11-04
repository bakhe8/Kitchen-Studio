import {kitchenRoom,createKitchen,addRun,addUnit,addFeature,availableKitchenSlots} from './kitchen-model.js';

export function copyKitchenUnit(k,room,sourceId,runId,u){
 const source=k.units.find(v=>v.id===sourceId),run=k.runs.find(v=>v.id===runId);
 if(!source||!run||!Number.isFinite(u))return {ok:false,changed:false,kitchen:k,reason:'اختر وحدة أصلية وصفًا وموضعًا صالحًا للنسخة.'};
 const copy=JSON.parse(JSON.stringify(source));delete copy.id;
 return addUnit(k,room,{...copy,runId,u,open:false});
}
export function copyDestinations(k,room,id){
 const source=k.units.find(u=>u.id===id);if(!source)return [];
 return k.runs.map(run=>{
  const occupants=k.units.filter(u=>u.runId===run.id).sort((a,b)=>a.u-b.u);
  const {id:originalId,u:originalOffset,...properties}=source;
  const gaps=availableKitchenSlots(k,room,{...properties,runId:run.id,open:false}).map(s=>({start:s.start,end:s.end+source.width}));
  return {run,gaps,occupants};
 });
}
export function createCreativeKitchen(input){
 const r=kitchenRoom(input),W=r.width,L=r.length,H=r.height;
 if(W<220||L<206||H<168)return null;
 let k=createKitchen(input,'empty');
 const use=v=>{if(v.ok){k=v.kitchen;return true;}return false;};
 const rowEnd=Math.min(W-10,425);
 if(!use(addRun(k,input,{id:'idea-wall',wall:'back',tier:'base',start:10,end:rowEnd,depth:57,height:85,worktopFinish:'limestone'})))return null;
 const spare=Math.min(52,Math.floor(W*.22)),avail=rowEnd-10-spare,sinkW=Math.min(77,Math.floor(avail*.39)),hobW=Math.min(64,Math.floor(avail*.3)),storeW=avail-sinkW-hobW;
 let u=10;
 for(const [id,kind,width,frontFinish] of [['idea-pantry','storage',storeW,'ivory'],['idea-sink','sink',sinkW,'ivory'],['idea-hob','hob',hobW,'ivory']]){
   if(!use(addUnit(k,input,{id,runId:'idea-wall',kind,u,width,frontFinish})))return null;u+=width;
 }
 const sinkStart=10+storeW,sinkMid=sinkStart+sinkW/2;
 const winW=Math.min(98,sinkW+12),low=Math.min(109,H-56),winH=Math.min(91,H-low-8);
 use(addFeature(k,input,{id:'idea-window',kind:'window',wall:'back',u:sinkMid-winW/2,width:winW,bottom:low,height:winH}));
 use(addFeature(k,input,{id:'idea-drain',kind:'drain',wall:'back',u:sinkMid-4}));
 use(addFeature(k,input,{id:'idea-water',kind:'water',wall:'back',u:sinkMid-14}));
 const upperW=Math.min(storeW,Math.max(36,sinkStart-18)),bottom=Math.min(145,H-54);
 if(use(addRun(k,input,{id:'idea-upper',wall:'back',tier:'upper',start:10,end:10+upperW,depth:32,height:Math.min(66,H-bottom-4),bottom})))
   use(addUnit(k,input,{id:'idea-upper-storage',runId:'idea-upper',kind:'storage',width:upperW,u:10,frontFinish:'oak'}));
 const len=Math.min(152,Math.floor(W*.47)),depth=Math.min(72,Math.floor(L*.23)),angle=12,a=angle*Math.PI/180;
 const x=+((rowEnd+10)*.51-len/2*Math.cos(a)+depth/2*Math.sin(a)).toFixed(2),z=+(Math.min(L*.64,225)-len/2*Math.sin(a)-depth/2*Math.cos(a)).toFixed(2);
 if(!use(addRun(k,input,{id:'idea-island',placement:'free',tier:'base',x,z,angle,length:len,depth,height:88,worktopFinish:'porcelain'})))return null;
 const first=Math.min(48,Math.floor(len*.4));
 if(!use(addUnit(k,input,{id:'idea-island-drawers',runId:'idea-island',kind:'drawers',u:0,width:first,frontFinish:'walnut'})))return null;
 if(!use(addUnit(k,input,{id:'idea-island-cabinet',runId:'idea-island',kind:'storage',u:first,width:len-first,frontFinish:'walnut'})))return null;
 return k;
}
