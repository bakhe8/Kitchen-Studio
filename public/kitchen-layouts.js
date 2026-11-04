import {creationDefaults} from './kitchen-defaults-calculations.js';
import {architectureWall} from './kitchen-architecture.js';
import {createKitchen,kitchenRoom,addRun,addUnit,addFeature,kitchenWallPoint} from './kitchen-model.js';
export const layouts=Object.freeze([
 ['line','خطّي','جدار واحد'],['corner','زاوية L','جداران متجاوران'],['wrap','حرف U','ثلاثة جدران'],['galley','متوازٍ','صفّان متقابلان'],['island','جزيرة','وسط الغرفة'],['peninsula','شبه جزيرة','طرف متصل بالجدار'],['blank','فارغ','تصميم من الصفر']
].map(([id,label,hint])=>({id,label,hint})));
export const palettes={oasis:{label:'زيتوني وبلوط',front:'sage',upper:'oak',top:'carrara',style:'flat',handle:'bar'},linen:{label:'عاجي وجوز',front:'ivory',upper:'walnut',top:'limestone',style:'framed',handle:'knob'},ink:{label:'حبري وفولاذ',front:'navy',upper:'ivory',top:'brushed-steel',style:'flat',handle:'handleless'}};
const walls=['back','right','front','left'];
export function buildStudioLayout(input,layout='island',wall='back',look='oasis',options={}){
 const room=kitchenRoom(input),i=walls.indexOf(wall),preset=look==='project'?creationDefaults(input):null;
 // Named gallery looks are authored examples. The designer's Project choice
 // instead inherits the profile into the newly generated geometry.
 const pal=preset?{...palettes.oasis,front:preset.frontFinish,upper:preset.frontFinish,top:preset.worktopFinish,style:preset.frontStyle,handle:preset.handleStyle}:palettes[look]||palettes.oasis;
 const bd=preset?.baseDepth??60,ud=preset?.upperDepth??32;
 let k=createKitchen(room,'empty');const measured=Array.isArray(options.features);if(measured)k={...k,features:options.features.map(f=>({...f}))};
 if(layout==='blank')return {ok:true,kitchen:k};if(!layouts.some(v=>v.id===layout)||i<0)return {ok:false,reason:'توزيع غير معروف.'};
 const aw=architectureWall(room,wall);if(!aw)return {ok:false,reason:'الجدار المختار غير موجود.'};const W=aw.length,L=i%2?room.width:room.length,H=room.height;
 const needW=layout==='wrap'?246:layout==='island'?252:layout==='peninsula'?240:180,needL={line:110,corner:180,wrap:188,galley:210,island:255,peninsula:235}[layout];
 if(W<needW||L<needL||H<212)return {ok:false,reason:'يتطلب هذا النموذج '+needW+' × '+needL+' سم وارتفاع 212 سم.'};
 const put=r=>{if(!r.ok)throw Error(r.reason);k=r.kitchen;return r.id;};let ix=1;
 const run=(wall,tier,start,end,extra={})=>put(addRun(k,room,{id:'set-row-'+ix++,wall,tier,start,end,depth:tier==='upper'?ud:bd,...(preset?{height:tier==='upper'?preset.upperHeight:preset.baseHeight,...(tier==='upper'?{bottom:preset.upperBottom}:{})}:{}),worktopFinish:pal.top,...extra}));
 const unit=(r,kind,u,width,extra={})=>put(addUnit(k,room,{id:'set-unit-'+ix++,kind,runId:r,u,width,frontFinish:['fridge','freezer','dishwasher','hood','oven','oven-tower'].includes(kind)?'brushed-steel':pal.front,...(['storage','drawers','sink','hob','pullout','tall'].includes(kind)?{frontStyle:pal.style,handleStyle:pal.handle}:{}),...extra}));
 const feature=(kind,u,extra={})=>put(addFeature(k,room,{id:'set-fixture-'+ix++,wall,kind,u,...extra}));
 try{
 const start=aw.start+6,len=Math.min(Math.floor(W-12),490),base=run(wall,'base',start,start+len);let pos=start;
 const fridge=len>=255?Math.min(80,Math.round(len*.195)):0;
 const sink=Math.min(80,Math.floor(len*.27)),hob=Math.min(75,Math.floor(len*.24)),dw=len>=320?60:0;
 const spare=len-fridge-sink-hob-dw,prep=spare>=93?Math.floor(spare*.58):spare,tail=spare-prep;
 if(fridge){unit(base,'fridge',pos,fridge);pos+=fridge;}
 const upperStart=pos;unit(base,'drawers',pos,prep);pos+=prep;
 const sx=pos;unit(base,'sink',pos,sink);pos+=sink;if(dw){unit(base,'dishwasher',pos,dw);pos+=dw;}
 const hx=pos;unit(base,'hob',pos,hob);pos+=hob;if(tail>=20)unit(base,'storage',pos,tail);
 const bottom=preset?preset.upperBottom:Math.min(151,H-65);const wr=Math.min(sink,Math.max(34,sink-4));
 if(!measured){feature('window',sx+(sink-wr)/2,{width:wr,bottom:106,height:Math.min(99,H-116)});
 feature('water',sx+sink*.28);feature('drain',sx+sink*.63);}
 if(prep>=28){const r=run(wall,'upper',upperStart,upperStart+prep,{bottom,height:preset?preset.upperHeight:Math.min(68,H-bottom-3)});unit(r,'storage',upperStart,prep,{frontFinish:pal.upper});}
 const hd=run(wall,'upper',hx,hx+hob,{bottom,height:preset?preset.upperHeight:58});unit(hd,'hood',hx,hob);
 const sec=(wallN,lo,hi,which)=>{const edge=architectureWall(room,wallN);if(!edge)throw Error('هذا الجدار غير موجود.');lo=Math.max(lo,edge.start+2);hi=Math.min(hi,edge.end-2);if(hi-lo<40)throw Error('طول الجدار المتاح لا يكفي للصف.');
 const row=run(wallN,'base',lo,hi),width=hi-lo;
 const tall=width>=140&&which==='outer'?60:0,a=lo+tall;if(tall)unit(row,'oven-tower',lo,tall,{frontFinish:pal.upper});
 const rest=hi-a,split=rest>=95?Math.min(75,Math.round(rest*.48)):rest;
 unit(row,'storage',a,split,{frontFinish:pal.upper});if(rest-split>=20)unit(row,'drawers',a+split,rest-split);
 };
 if(layout==='corner'||layout==='wrap')sec(walls[(i+3)%4],Math.max(8,L-265),L-bd-8,'outer');
 if(layout==='wrap')sec(walls[(i+1)%4],bd+8,Math.min(L-8,260),'inner');
 if(layout==='galley')sec(walls[(i+2)%4],Math.max(8,W-345),W-8,'outer');
 if(layout==='island'||layout==='peninsula'){
   const len2=Math.min(layout==='island'?170:185,Math.round(W*(layout==='island'?.45:.55))),depth=Math.min(77,Math.round(L*.23));
   const x=layout==='island'?(W-len2)/2:0,z=Math.min(L-depth-35,Math.max(126,L*.54)),p=kitchenWallPoint(room,wall,aw.start+x,z);
   const r=put(addRun(k,room,{id:'set-island',tier:'base',placement:'free',x:p.x,z:p.z,angle:i*90,length:len2,depth,height:preset?preset.baseHeight:87,worktopFinish:pal.top}));
   const draws=Math.round(len2*.49);unit(r,'drawers',0,draws,{frontFinish:pal.upper,frontStyle:preset?pal.style:'fluted'});unit(r,'storage',draws,len2-draws,{frontFinish:pal.upper,frontStyle:preset?pal.style:'fluted'});
 }
 return {ok:true,kitchen:k};
 }catch(err){return {ok:false,reason:err.message||'لا يتسع هذا الموضع للتوزيع.'};}
}
