import assert from 'node:assert/strict';
import {kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
import * as placement from '../public/kitchen-placement.js';
import * as volumeArt from '../public/shelf-volume-contents.js';
import {createShelfPlan,updateWall,updateCab,applyPreset} from '../public/shelf-model.js';
import {commitDividerDrop,scopedCells,setScopedContent} from '../public/shelf-selection-model.js';
import {recordReleaseIssues} from '../public/kitchen-field-release.js';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {acceptPattern} from '../public/kitchen-surface-pattern.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {defaultPropertyKey} from '../public/kitchen-defaults-model.js';
// Inputs an editor or a file can control must not cost more than a budget. Sizes below are where the unbudgeted code took seconds to minutes.
const timed=fn=>{const t=performance.now(),v=fn();return [v,performance.now()-t];};

// 1. 256 cabinets stacked in one row used to produce 65,280 conflict objects (about 230 MB after the server re-checked a release).
{
 const R={width:1200,length:1200,height:300},limit=placement.CONFLICT_LIMIT??400;
 const k={version:1,nextId:1,runs:[{id:'r0',wall:'back',tier:'base',start:0,end:600,depth:60,bottom:0,height:86}],units:Array.from({length:256},(_,i)=>({id:'u'+i,runId:'r0',kind:'storage',u:0,width:100,open:false,interior:{shelves:1,dividers:0}})),features:[]};
 const g=kitchenGeometry(validateKitchen(JSON.parse(JSON.stringify(k)),R),R); // saving accepts a stacked row: overlap is a diagnostic, not a validation error
 assert(g.hardConflicts.length>0,'a stacked row is still reported as a conflict');
 assert(g.hardConflicts.length<=limit,'recorded conflicts stay within the budget, not '+g.hardConflicts.length);
 assert(g.hardConflicts.omitted>0,'dropped reports are counted');
 assert(g.conflicts.length>=g.hardConflicts.length,'the combined list still carries the kept conflicts');
}

// 2. Thousands of look-alike field readings made the baseline gate quadratic: 5000 readings took about 26 seconds.
{
 const records=Array.from({length:2500},(_,i)=>({id:'r'+i,inputCode:'SITE-01',itemId:'unit-sink',property:'عرض',revision:'',verification:'confirmed',value:100+i%3,unit:'mm',valueType:'number',execution:'required',shopCritical:true,assist:{baseline:'b'+i}}));
 const doc={room:{fieldRegister:{records}},kitchen:{units:[],runs:[],features:[]}};
 const [issues,ms]=timed(()=>recordReleaseIssues(doc));
 assert(ms<1500,'baseline gate took '+Math.round(ms)+' ms for 2500 readings');
 assert(issues.some(x=>x.includes('أكبر من 64')),'an absurd group is reported instead of silently trusted');
}

// 3. 48 polygons of 96 vertices cost about 2.8 s per surface check; a hole set beyond the vertex budget is refused with a reason, quickly.
{
 let doc=makeChainExample();doc=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{rice:false,dishwasher:false,sink:true}}).doc;
 doc.room.workshop.catalog=seedCatalog();doc.room.workshop.catalog.terms.worktop='include';doc.kitchen.runs[0].worktopThicknessMm=25;
 const top=kitchenGeometry(doc.kitchen,doc.room).worktops[0],sink=top.holes[0].unitId;
 const outer=[[0,0],[3000,0],[3000,600],[0,600]];
 const circle=(cx,cy,r,n)=>Array.from({length:n},(_,i)=>[+(cx+r*Math.cos(2*Math.PI*i/n)).toFixed(3),+(cy+r*Math.sin(2*Math.PI*i/n)).toFixed(3)]);
 const h={id:sink,modelRef:'SUP-400 fixture',shape:'rect',x:2300,y:130,width:400,depth:280,radius:25};
 const cuts=(count,vertices)=>Array.from({length:count},(_,i)=>({id:'extra:h'+i,modelRef:'cut '+i,shape:'polygon',points:circle(100+(i%12)*180,100+Math.floor(i/12)*140,10,vertices)}));
 const p={source:'T04 physical template',datum:'Rear / first cabinet end',materialRef:'Demo slab',limitRef:'Synthetic test limits',levelRef:'Post-install test level',inspector:'Fixture QA',date:'2026-10-31',fitToleranceMm:3,edgeGapMm:30,webMm:20,thicknessMm:25,outer};
 const [heavy,ms]=timed(()=>acceptPattern(doc,top,{...p,holes:[h,...cuts(47,96)]}));
 assert(!heavy.ok&&heavy.reason.includes('400'),'a 4,500-vertex hole set is refused with the budget in the reason');
 assert(ms<1000,'the refusal took '+Math.round(ms)+' ms');
 const modest=acceptPattern(doc,top,{...p,holes:[h,...cuts(3,40)]});
 assert(modest.ok,modest.reason); // 3 polygons of 40 vertices is well inside the budget
}

// 5. A 12x12 grid of plants in one cabinet made about 5 MB of SVG (8 such cabinets: 3.6 s and 42 MB). Decorated cells are capped; the grid itself is untouched.
{
 let p=createShelfPlan();p=updateWall(p,{w:256,h:226});p=updateCab(p,{x:8,y:8,w:240,h:210});p=applyPreset(p,'empty');
 for(let i=1;i<=11;i++)p=commitDividerDrop(p,{kind:'cabinet'},'col',{x:8+2+i*16-1,y:100}).plan;
 for(let i=1;i<=11;i++)p=commitDividerDrop(p,{kind:'cabinet'},'row',{x:100,y:8+2+i*16-1}).plan;
 for(const c of scopedCells(p))p=setScopedContent(p,c.key,'plant');
 assert.equal(scopedCells(p).length,144,'the cabinet still has all 144 cells');
 const limit=volumeArt.ART_CELL_LIMIT??48,faces=volumeArt.buildVolumeArt(p,{depth:35}),decorated=new Set(faces.map(f=>f.key));
 assert(decorated.size>0&&decorated.size<=limit,'decorated cells stay within the budget, not '+decorated.size);
}

// 4. The memo behind default-property folding must not change a single key.
{
 const a=defaultPropertyKey({code:'CAT-03',property:'عمق  الصف العلوي'}),b=defaultPropertyKey({code:'CAT-03',property:'عمق الصف العلوي '});
 assert.equal(a,b);assert.equal(a,defaultPropertyKey({code:'CAT-03',property:'عمق  الصف العلوي'}));
 for(let i=0;i<5000;i++)defaultPropertyKey({code:'CAT-03',property:'خاصية '+i}); // overflows the memo at least once
 assert.equal(defaultPropertyKey({code:'CAT-03',property:'ARABIC  Text'}),defaultPropertyKey({code:'CAT-03',property:'arabic text'}));
 assert.equal(defaultPropertyKey({code:'CAT-03',property:'عمق  الصف العلوي'}),a);
}
console.log('PASS: complexity budgets - stacked cabinets, look-alike field readings and heavy cut patterns stay bounded; default-key memo is behaviour-neutral.');
