import assert from 'node:assert/strict';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {scenePlan} from '../public/kitchen-project.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {elevationSheet} from '../public/kitchen-sheet.js';
import {cleanWorkshop} from '../public/kitchen-workshop-state.js';

const cat=seedCatalog();cat.approved=true;
const leg={...cat.items.find(i=>i.sku==='HINGE'),sku:'FOOT',price:5};
const trim={...cat.items.find(i=>i.sku==='AL-20'),sku:'PL-80',sectionWidthMm:80,price:10};
cat.items.push(leg,trim);
cat.baseSupport={rules:{standard:{family:'storage',mode:'legs',site:'floor',default:true,minWidthMm:600,maxWidthMm:600,bodyClearMm:80,apron:'skirt',sku:'FOOT',count:4,supply:'assembly',reference:'QA-L',label:'طقم أرجل'}},aprons:{skirt:{label:'الساتر',sku:'PL-80',reference:'QA-P',heightMm:80,insetMm:40,thicknessMm:3,fixing:'included'}}};
const run={id:'r',wall:'back',tier:'base',start:20,end:80,height:86,depth:60,bottom:0,worktopThicknessMm:40};
const k={runs:[run],units:[{id:'a',kind:'storage',runId:'r',u:20,width:60}],features:[]};
const pads=[[20,20,25,25],[555,20,25,25],[20,550,25,25],[555,550,25,25]];
const w={catalog:cat,upstand:{choice:{mode:'supplier',heightMm:100,thicknessMm:20,material:'حجر اختبار'},walls:{}},
 surfaces3d:{patches:[[[0,0,0],[1500,0,0],[1500,1000,0]],[[1500,1000,0],[0,1000,0],[0,0,0]]].map((triangle,i)=>({id:'p'+i,kind:'floor',reference:'QA',errorMm:0,triangle})),
 checks:[{target:'a',reference:'QA',support:{mountMm:80,minLegMm:75,maxLegMm:90,maxPadDeltaMm:1,pads}}]}};
const room={width:500,height:290,length:450,workshop:w},doc={room,kitchen:k};
assert(cleanWorkshop(w));
const scene=()=>getKitchenPhotoMesh(scenePlan(room,k),k);
let mesh=scene();
const faces=tag=>mesh.faces.filter(f=>f.tag===tag),extents=(tag,axis)=>{const v=faces(tag).flatMap(f=>f.points.map(p=>p[axis]));return [Math.min(...v),Math.max(...v)];};
assert.equal(faces('cabinet-leg').length,24);
assert.deepEqual(extents('cabinet-leg','y'),[282,290]);
assert.deepEqual(extents('base-apron','x'),[20,80]);
assert.deepEqual(extents('base-apron','z'),[55.7,56]);
assert.deepEqual(extents('worktop-upstand','x'),[20,80]);
assert.deepEqual(extents('worktop-upstand','y'),[190,200]);
assert.deepEqual(extents('worktop-upstand','z'),[0,2]);
assert(elevationSheet(doc,'back',true).includes('data-sheet-upstand="back"'));
assert.equal(buildFactoryQuote(doc).extras.find(e=>e.kind==='upstand').quantity,600);
assert.equal(JSON.stringify(scenePlan(room,k).room.fitout).includes('QA-L'),false);
w.baseSupport={units:{a:{apron:'none'}},runs:{}};w.upstand={choice:{mode:'none'},walls:{}};
mesh=scene();
assert.equal(faces('cabinet-leg').length,24);assert.equal(faces('worktop-upstand').length,0);assert.equal(faces('base-apron').length,0);
assert.equal(buildFactoryQuote(doc).pieces.some(p=>p.sku==='PL-80'),false);
assert.equal(elevationSheet(doc,'back',true).includes('data-sheet-upstand'),false);
console.log('Verified the same physical legs, cover and supplier upstand in CAD, elevation and takeoff; changing the choices invalidates the cached mesh.');
