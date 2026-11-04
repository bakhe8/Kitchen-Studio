import assert from 'node:assert/strict';
import {createKitchen,kitchenGeometry} from '../public/kitchen-model.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {buildPhotoScene} from '../public/kitchen-photo-scene.js';
import {buildPhotoBVH,createPhotoFrame,renderPhotoRows} from '../public/kitchen-photo-trace.js';
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {getEffectiveDefaults} from '../public/kitchen-defaults-model.js';
import {recordReleaseIssues} from '../public/kitchen-field-release.js';
// Wall-clock budgets for the paths a user waits on. Each sits well above what an ordinary laptop measures (see the PASS line), so only a real
// slow-down trips it. Best of three runs; set KITCHEN_PERF_SCALE=3 on a slow or busy machine instead of editing the numbers.
const scale=Number(process.env.KITCHEN_PERF_SCALE)||1,report=[];
async function within(name,budgetMs,fn,runs=3){
 let best=Infinity;
 for(let i=0;i<runs;i++){const t=performance.now();await fn();best=Math.min(best,performance.now()-t);}
 report.push(name+' '+Math.round(best)+'/'+Math.round(budgetMs*scale)+' ms');
 assert(best<=budgetMs*scale,name+': best of '+runs+' took '+Math.round(best)+' ms, budget '+Math.round(budgetMs*scale)+' ms');
}
const room=createShelfPlan(),kitchen=createKitchen(room),tree=buildPhotoBVH(buildPhotoScene(room,kitchen));

await within('photo tracer 160x100, one pass',800,()=>{renderPhotoRows(createPhotoFrame(tree,160,100,{}),0,0,100,false);});
await within('geometry of a fresh default kitchen',300,()=>{kitchenGeometry(createKitchen(room),room);}); // a new object each run: geometry is cached per kitchen
await within('whole-kitchen proposals for two walls',2500,()=>proposeWholeKitchen(makeChainExample(),{walls:['back','right'],wanted:{sink:true,rice:true,dishwasher:true},riceMode:'bags'}),2);
const doc=makeChainExample();
await within('50 resolutions of the project defaults',150,()=>{for(let i=0;i<50;i++)getEffectiveDefaults(doc);});
const records=Array.from({length:1000},(_,i)=>({id:'r'+i,inputCode:'SITE-01',itemId:'item-'+i,property:'عرض',revision:'',verification:'confirmed',value:100,unit:'mm',valueType:'number',execution:'required',shopCritical:true,assist:{baseline:'b'+i}}));
await within('release gate over 1000 field readings',150,()=>{recordReleaseIssues({room:{fieldRegister:{records}},kitchen:{units:[],runs:[],features:[]}});});
console.log('PASS: performance budgets (best / budget) - '+report.join(' | '));
