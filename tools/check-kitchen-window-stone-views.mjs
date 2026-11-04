import assert from 'node:assert/strict';
import {scenePlan} from '../public/kitchen-project.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {planSheet,elevationSheet,sheetTables} from '../public/kitchen-sheet.js';
import {customerReport} from '../public/kitchen-proposal-presentation.js';
import {worktopUpstandTakeoff,setUpstandWindowChoice} from '../public/kitchen-worktop-upstand.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';

const catalog=seedCatalog();catalog.approved=true;
catalog.items.push({...catalog.items.find(i=>i.sku==='BODY-6'),sku:'QA-STONE',colorHex:'#a4a19c',name:'حجر اختباري',thicknessMm:20,stockLengthMm:3300});
catalog.upstandProfiles=[{id:'H100',sku:'QA-STONE',heightMm:100,minCutHeightMm:35,reference:'QA / H100'}];
const upstand={choice:{mode:'factory',profileId:'H100'},walls:{},windowChoices:{}};
const room={width:500,length:450,height:280,workshop:{catalog,upstand}};
const run={id:'r',wall:'back',tier:'base',start:50,end:330,height:86,bottom:0,depth:60,worktopThicknessMm:40};
const window=(id,u,bottom)=>({id,wall:'back',kind:'window',u,width:60,bottom,height:100,depth:4});
const k={runs:[run],units:[{id:'base',kind:'storage',runId:'r',u:50,width:260}],features:[window('left',100,96),window('right',170,90)]};
const doc={room,kitchen:k};
const take=()=>worktopUpstandTakeoff(doc,catalog);
const at=id=>take().windows.find(w=>w.windowId===id);
function save(id,choice){
 const saved=setUpstandWindowChoice(doc,catalog,at(id).key,choice);assert(saved.ok,saved.reason);
 room.workshop=saved.doc.room.workshop;
}
const scene=()=>getKitchenPhotoMesh(scenePlan(room,k),k);
const extent=(faces,axis)=>{assert(faces.length);const all=faces.flatMap(f=>f.points.map(p=>p[axis]));return [Math.min(...all),Math.max(...all)];};
const under=(mesh,station)=>mesh.faces.filter(f=>f.tag==='worktop-upstand'&&f.wall==='back'&&Math.min(...f.points.map(p=>p.x))<station&&Math.max(...f.points.map(p=>p.x))>station);

save('left',{kind:'step',clearanceMm:10,operationChecked:true,reference:'QA-motion'});
save('right',{kind:'gap',sill:{mode:'supplier',material:'حجر الجلسة',thicknessMm:20,depthMm:120,insetStartMm:20,lengthMm:560,verified:true,reference:'QA-SILL'}});
const take1=take();assert.equal(at('left').status,'resolved');assert.equal(at('right').sillStatus,'resolved');assert.equal(take1.sills.length,1);
let mesh=scene(),sills=mesh.faces.filter(f=>f.tag==='horizontal-stone-sill');
assert.deepEqual(extent(sills,'x'),[172,228]);assert.deepEqual(extent(sills,'z'),[-12,0]);assert.deepEqual(extent(sills,'y'),[190,192]);
assert.deepEqual(extent(under(mesh,120),'y'),[185,190]);
assert.deepEqual(extent(under(mesh,165),'y'),[180,190],'narrow masonry pier retains its upright strip');
assert.deepEqual(under(mesh,180),[],'a horizontal sill does not add an upright strip');
const covered=(face,x)=>Math.min(...face.points.map(p=>p.x))<x&&Math.max(...face.points.map(p=>p.x))>x;
const genericSill=mesh.faces.filter(f=>f.id==='right'&&f.tag==='window-sill'&&covered(f,200));
assert(genericSill.every(f=>Math.max(...f.points.map(p=>p.z))<=-12),'the schematic trim may not conceal verified stone');
const oldWindow=mesh.faces.filter(f=>f.id==='left'&&f.tag==='window-sill');assert(extent(oldWindow,'z')[1]>0);
const elevation=elevationSheet(doc,'back',true),plan=planSheet(doc,true);
assert(elevation.includes('data-sheet-upstand="back" data-height-mm="50"'));
assert(elevation.includes('data-sheet-sill="right" data-sill-depth-mm="120"'));
assert(plan.includes('data-plan-sill="right" data-sill-depth-mm="120"'));
assert(plan.includes('data-plan-upstand="back" data-height-mm="50"'));
assert(!planSheet(doc,true,{tier:'upper'}).includes('data-plan-sill'));
const table=sheetTables(doc,'back',true);assert(table.includes('جلسات الشبابيك الأفقية الإضافية'));assert(table.includes('تنخفض تحت الشباك'));
assert(!sheetTables(doc,'left',true).includes('جلسات الشبابيك الأفقية الإضافية'));
const report=customerReport({doc});
assert(report.includes('جلسة')&&report.includes('قطعة · خارج سعر المصنع')&&report.includes('data-plan-sill="right"'));
assert(!JSON.stringify(scenePlan(room,k).room.fitout).includes('QA-SILL'));

save('left',{kind:'uniform',clearanceMm:10,operationChecked:true,reference:'QA-motion'});
mesh=scene();assert.deepEqual(extent(under(mesh,165),'y'),[185,190]);assert.deepEqual(extent(under(mesh,120),'y'),[185,190]);
k.features[1]={...k.features[1],u:171};mesh=scene();
assert(!mesh.faces.some(f=>f.tag==='horizontal-stone-sill'),'stale field evidence no longer creates a sill');
assert(!planSheet(doc,true).includes('data-plan-sill'));assert(!elevationSheet(doc,'back',true).includes('data-sheet-sill'));
console.log('Window treatment and verified recessed sill match physical 3D geometry, plan, elevation and customer handoff; changed casing invalidates the sill.');
