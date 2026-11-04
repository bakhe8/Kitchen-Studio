import {buildStudioLayout} from './kitchen-layouts.js';
import {addFeature,createKitchen} from './kitchen-model.js';
import {sourceLinks} from './kitchen-site-survey-model.js';
export const localRoomPresets=[
 {id:'villa',name:'فيلا · مطبخ بباب خدمة',dims:'4.40 × 3.80 م',note:'المقاس: سدرة VL1، روشن. مواضع الفتحات والخدمات مقترحة.',source:sourceLinks.sedra},
 {id:'apartment',name:'شقة · نافذة على منور',dims:'16.25 م²',note:'المساحة: شقق NAF 7. شكل المنور وأطوال الجدران والفتحات مقترحة.',source:sourceLinks.apartment},
 {id:'hasa',name:'مطبخ متصل بغرفة غسيل',dims:'4.60 × 3.40 م',note:'مقاس المطبخ: شرفة D، الأصالة بالأحساء. يظهر بالمخطط غسيل مستقل؛ مواقع الأبواب والخدمات هنا مقترحة.',source:sourceLinks.hasa}
];
export function makeSaudiRoom(id){
 const info=localRoomPresets.find(t=>t.id===id);if(!info)throw Error('نموذج غرفة غير معروف.');
 const apartment=id==='apartment',villa=id==='villa';
 const [width,length,height]=apartment?[430,400,290]:villa?[440,380,300]:[460,340,300];
 const room={name:info.name,width,length,height,floor:villa?'marble':'tile',architecture:{wallThickness:apartment?20:25,...(apartment?{cut:{kind:'notch',corner:'back-right',width:95,depth:100}}:{})},colors:{back:'stone',right:'sand',left:'stone',front:'sand'},cladding:{finish:apartment?'ivory-tile':villa?'sand-tile':'ivory-tile',height:apartment?180:villa?120:0,tileWidth:villa?90:60,tileHeight:villa?45:30},backsplash:{finish:'tile',height:65},sitePoints:[{id:'floor-gully',kind:'floor-drain',x:apartment?122:174,z:apartment?218:116,size:15}]};
 // Fixed features belong to this sample's building. Keep their established IDs
 // so a survey can still refer to a window or service from an older file.
 let kitchen=createKitchen(room,'empty');
 const add=(id,kind,wall,u,more={})=>{
  const result=addFeature(kitchen,room,{id,kind,wall,u,...more});
  if(!result.ok)throw Error(result.reason);
  kitchen=result.kitchen;
 };
 const [utilityWall,waterStart,drainStart]=apartment?['left',160.4,188.4]:villa?['back',185.4,213.4]:['back',196.4,224.4];
 if(apartment)add('set-fixture-8','window','return-back-right-x',12,{width:71,bottom:128,height:85,glazing:'frosted',adjacent:'lightwell'});
 else add('set-fixture-8','window','back',villa?165:176,{width:76,bottom:106,height:99,glazing:villa?'clear':'frosted',adjacent:villa?'yard':'outdoors'});
 add('set-fixture-9','water',utilityWall,waterStart);
 add('set-fixture-10','drain',utilityWall,drainStart);
 add('entry-door','door','front',apartment?70:28,{width:95,height:218,hinge:'right',swing:'in',adjacent:'corridor'});
 if(villa||id==='hasa')add('service-door','door','left',villa?102:55,{width:92,height:216,hinge:'left',swing:villa?'out':'sliding',adjacent:villa?'yard':'laundry'});
 if(villa)add('structural-pier','column','right',141,{width:34,depth:26});
 add('downstand','beam',apartment?'back':'left',apartment?114:(villa?198:175),{width:apartment?152:145,bottom:height-35,height:35,depth:32});
 add('extract','vent',apartment?'return-back-right-z':'right',apartment?37:90,{width:24,height:24,bottom:235});
 if(id==='hasa')add('service-heater','heater','right',190,{bottom:155,width:40,height:66,depth:42});
 return {room,kitchen};
}

// Reconstruct the authored furniture shipped in earlier sample projects.
// Site intake uses makeSaudiRoom and never invokes the layout generator.
export function makeFurnishedSaudiRoom(id){
 const {room,kitchen}=makeSaudiRoom(id);
 const layout=buildStudioLayout(room,id==='villa'?'island':'line',id==='apartment'?'left':'back',id==='hasa'?'linen':'oasis');
 if(!layout.ok)throw Error(layout.reason);
 const {runs,units}=layout.kitchen;
 return {room,kitchen:{...kitchen,runs,units,nextId:kitchen.nextId+runs.length+units.length}};
}
