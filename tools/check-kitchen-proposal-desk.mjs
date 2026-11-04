// The proposal desk must never issue a previously calculated drawing after a
// changed selection is declined. Exercise the actual mounted UI handlers.
import assert from 'node:assert/strict';
import {mountRowStep} from '../public/kitchen-production-row-ui.js';
import {mountCornerUI} from '../public/kitchen-production-row-corner-ui.js';
import {createKitchen} from '../public/kitchen-model.js';
import {applyChain} from '../public/kitchen-chain-model.js';
import {mountWholePlan} from '../public/kitchen-whole-plan-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';
import {proposalComparisons,proposalUnits,customerReport} from '../public/kitchen-proposal-presentation.js';

const source=makeVisitExample();
source.room.workshop.decisionReview.active=false;
const original=structuredClone(source),generated=await proposeWholeKitchen(source,{walls:['back']});
assert(generated.ok);
const comparisons=proposalComparisons(generated.candidates.map(c=>c.doc));
const comparisonDoc=generated.candidates[0].doc,riceUnit=proposalUnits(comparisonDoc).find(u=>u.family==='rice');
const adjusted=previewKitchenWidthChange(comparisonDoc,riceUnit.id,100);
assert(adjusted.ok);
const changedComparisons=proposalComparisons([adjusted.doc,generated.candidates[1].doc]);
assert.equal(changedComparisons[0].title,'خزانة واحدة · ٨٠٠ مم');
assert(!changedComparisons[0].ids.includes(riceUnit.id));
assert.equal(comparisons[0].title,'خزانة واحدة · ٩٠٠ مم');
assert.equal(comparisons[1].title,'خزانتان · ٤٥٠ مم لكل منهما');
assert.equal(comparisons[1].ids.length,2);
const first=generated.candidates[0];
const report=customerReport({doc:first.doc,wallIds:['back'],example:true,questions:first.questions,comparison:comparisons[0]});
assert(report.includes('يراجعها الفني قبل التصنيع'));
assert(!report.includes('من تبويب تعبئة الصف للوحدة'));
assert(report.includes(comparisons[0].title));
assert.match(report,/<label for="view-0">الجدار الخلفي<\/label>/);
assert(report.includes('id="drawing-0"><h2>الجدار الخلفي</h2>'));

const events={},node={focus(){},scrollIntoView(){}},canvas={querySelectorAll(){return [];}};
let selection=null,current=source,applied=0,downloaded=0,advanced='',focusTarget;
const host={innerHTML:'',querySelector(selector){
 if(selector==='[data-wp-canvas]')return canvas;
 if(selector==='[data-plan-controls]')return selection;
 return node;
},addEventListener(name,handler){events[name]=handler;}};
globalThis.document={createElement:()=>({click(){downloaded++;}})};
function decide(wall){
 selection={querySelectorAll(){return [{value:wall}];},elements:{namedItem(k){return {checked:k==='sink'||k==='dishwasher'||k==='rice'};}}};
}
async function click(attrs){
 const b={dataset:attrs,hasAttribute(attr){const key=attr.slice(5).replace(/-([a-z])/g,(_,ch)=>ch.toUpperCase());return Object.hasOwn(attrs,key);}};
 return events.click({target:{closest:s=>s==='button'?b:null}});
}
const submitted=()=>events.submit({preventDefault(){},target:{matches:s=>s==='[data-plan-controls]'}});
const change=wall=>{decide(wall);events.change({target:{name:'wall',value:wall,closest:s=>s==='[data-plan-controls]'?selection:null,matches:()=>false}});};
async function until(text){for(let i=0;i<300&&!host.innerHTML.includes(text);i++)await new Promise(r=>setTimeout(r,5));assert(host.innerHTML.includes(text),text);}
const options={getDoc:()=>current,apply(next){current=next;applied++;return {ok:true,saved:true};},tell(){},onAdvance(step,focus){advanced=step;focusTarget=focus;}};
const dispose=mountWholePlan(host,options);
decide('back');submitted();await until('data-wp="apply"');
assert(canvas.innerHTML.includes('data-sheet-face="back"'));
assert(host.innerHTML.includes(comparisons[0].title));
assert.match(host.innerHTML,/pd-layout pd-overview/);
assert(!host.innerHTML.includes('data-width-change'));
const chooseUnit=id=>events.change({target:{value:id,closest:()=>null,matches:selector=>selector==='[data-wp-unit]'}});
chooseUnit(riceUnit.id);
assert(host.innerHTML.includes('data-width-change'));
await click({wp:'clear-unit'});
assert(!host.innerHTML.includes('data-width-change')&&host.innerHTML.includes('data-wp="apply"'));
chooseUnit(riceUnit.id);
await click({wp:'plus'});
assert(host.innerHTML.includes('value="700" aria-label="عرض الوحدة'));
change('right');
assert(!host.innerHTML.includes('data-wp="apply"')&&!host.innerHTML.includes('١٬١٤٠ ر.س')&&!host.innerHTML.includes('data-wp="report"'));
await click({wp:'apply'});await click({wp:'report'});await click({wp:'approve'});
assert.equal(applied,0);assert.equal(downloaded,0);assert.equal(advanced,'');
submitted();await until('بيانات التوزيع');
assert(host.innerHTML.includes('خارج')||host.innerHTML.includes('الجدران'));
assert(!host.innerHTML.includes('data-wp="apply"'));
await click({wp:'apply'});await click({wp:'report'});assert.equal(applied,0);assert.equal(downloaded,0);
selection=null;await click({wp:'restore'});assert(host.innerHTML.includes('data-wp="apply"'));
assert(host.innerHTML.includes('value="700" aria-label="عرض الوحدة'));
assert.deepEqual(source,original);await click({wp:'apply'});assert.equal(applied,1);assert(!dispose.hasPending());
await click({wp:'undo'});assert.equal(applied,2,'one undo on the saved proposal must restore the live project immediately');
assert.equal(current.room.workshop.rows[current.kitchen.runs[0].id].units.find(u=>u.family==='rice').widthMm,600);
assert.equal(current.kitchen.units.find(u=>u.kind==='drawers').width,60);assert(!dispose.hasPending());dispose();
const reopened=mountWholePlan(host,options);
assert.doesNotMatch(host.innerHTML,/data-wp="demo"/);
await click({wp:'demo'});assert.equal(applied,2);
assert.ok(host.innerHTML.includes('data-wp="current"'));
await click({wp:'current'});
assert(!host.innerHTML.includes('data-width-change')&&host.innerHTML.includes('data-wp="approve"'));
chooseUnit(riceUnit.id);
assert.match(host.innerHTML,/value="600" aria-label="عرض الوحدة/);
assert.match(host.innerHTML,/تحديد استخدام الوحدة/);
const origin=reopened.selectionForReturn();
assert.equal(origin.unitId,riceUnit.id);
node.value='850';advanced='';await click({wp:'usage'});assert.equal(advanced,'','do not discard a typed width');
delete node.value;await click({wp:'usage'});assert.deepEqual([advanced,focusTarget],['uses',{unitId:riceUnit.id}]);
reopened();
const savedUsage={id:'coffee',name:'خزّن <القهوة>',purpose:'activity',unitId:riceUnit.id};
current={...current,room:{...current.room,workshop:{...current.room.workshop,clientUsage:{tasks:[savedUsage]}}}};
const afterUsage=mountWholePlan(host,{...options,focus:origin});
assert.match(host.innerHTML,/خزّن &lt;القهوة&gt;/);
assert.equal(afterUsage.selectionForReturn().unitId,riceUnit.id);
advanced='';await click({wp:'usage',useId:'other'});assert.equal(advanced,'');
await click({wp:'usage',useId:'coffee'});assert.deepEqual(focusTarget,{unitId:riceUnit.id,taskId:'coffee'});
await click({wp:'plus'});assert.equal(afterUsage.selectionForReturn(),null);
assert.match(host.innerHTML,/تطبيق التصميم وتحديد الاستخدام/);
assert(!host.innerHTML.includes('data-use-id="coffee"'),'do not display saved activities as draft records');
afterUsage();
const missingTarget=mountWholePlan(host,{...options,focus:{...origin,unitId:'removed-cabinet'}});
assert.equal(missingTarget.selectionForReturn(),null);assert(!host.innerHTML.includes('data-width-change'));missingTarget();
// A structural change kept only in the session is not a saved cabinet handoff.
const unsaved=mountWholePlan(host,{...options,focus:origin,apply(next){current=next;return {ok:true,saved:false};}});
await click({wp:'plus'});advanced='';await click({wp:'usage'});
assert.equal(advanced,'');assert.equal(unsaved.selectionForReturn(),null);
assert(!host.innerHTML.includes('data-use-id="coffee"'));unsaved();

console.log('Mounted proposal desk: real cabinet alternatives, measured elevation, customer/field separation, guarded export/commit and removal of the old sample handoff.');

// Direct stage selection must not offer cabinets on the strength of one saved service.
const room={width:400,length:400,height:280};
current=applyChain({room,kitchen:createKitchen(room,'empty')},'back',{rows:[{id:'water',kind:'water',gapMm:700,heightMm:60,widthMm:60,depthMm:40,bottomMm:650}]}).doc;
selection=null;const beforeWrites=applied;
const emptyDesk=mountWholePlan(host,options);
assert(!host.innerHTML.includes('data-wp="generate"'));assert(host.innerHTML.includes('data-wp="survey"'));emptyDesk();
let handoff=null;
const directed={...options,onAdvance(route,focus){handoff={route,focus};}};
const rowExit=mountRowStep(host,{...directed,focus:{wall:'back'}});
assert(!host.innerHTML.includes('data-pwr-plan')&&host.innerHTML.includes('data-pwr-survey'));
events.click({target:{closest:selector=>selector==='[data-pwr-survey]'?node:null}});
assert.deepEqual(handoff,{route:'survey',focus:{wall:'back'}});rowExit();
const cornerExit=mountCornerUI(host,directed);assert(!host.innerHTML.includes('<form>')&&host.innerHTML.includes('data-corner-survey'));cornerExit();
assert.equal(applied,beforeWrites);
console.log('A preliminary site reading opens survey handoffs in whole design, factory row and corner editors without adding furniture.');

current=comparisonDoc;
const row=Object.values(current.room.workshop.rows).find(r=>r.units.some(u=>u.id===riceUnit.id));
const trackEvents={},focused=[];
const card=id=>({getAttribute:()=>id,open:false,querySelector:selector=>({focus(){focused.push([id,selector]);},scrollIntoView(){}})});
const cards=row.units.map(u=>card(u.id)),fieldset={querySelector:()=>({checked:true}),querySelectorAll:()=>[]};
const child={querySelector:()=>node,addEventListener(){},querySelectorAll:s=>s==='fieldset'?[fieldset,fieldset]:[]};
globalThis.document={createElement:()=>({querySelector:()=>child})};
const rowHost={addEventListener:(event,fn)=>{trackEvents[event]=fn;},append(){},querySelector:()=>node,querySelectorAll:s=>s==='[data-pwr-id]'?cards:[]};
const rowClose=mountRowStep(rowHost,{...options,focus:{runId:riceUnit.runId,unitId:riceUnit.id,drawerIndex:2}});
assert.deepEqual(focused.at(-1),[riceUnit.id,'[name="drawer1"]']);
assert(rowHost.innerHTML.includes('data-pwr-track="'+riceUnit.id+'"'));
const other=row.units.find(u=>u.id!==riceUnit.id).id;
trackEvents.click({target:{closest:s=>s==='[data-pwr-track]'?{getAttribute:()=>other,hasAttribute:()=>false}:null}});
assert.deepEqual(focused.at(-1),[other,'summary']);
assert.equal(applied,beforeWrites);
rowClose();console.log('Saved row strip opens its own cabinet; a second-drawer deep link focuses drawer 2 without saving.');
