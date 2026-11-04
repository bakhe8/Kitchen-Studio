import assert from 'node:assert/strict';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {planSheet,elevationSheet} from '../public/kitchen-sheet.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';

const {candidates}=await proposeWholeKitchen(makeVisitExample());
const doc=candidates[0].doc;
const readDimensions=(sheet,type)=>[...sheet.matchAll(/<g data-sheet-dim="([^"]+)"[^>]*><title>([^<]+)<\/title>/g)].filter(m=>m[1]===type).map(m=>m[2]);
const expected=numbers=>numbers.map(n=>new Intl.NumberFormat('ar-SA').format(n));
const check=(doc,baseWidths)=>{
 const sheet=elevationSheet(doc,'back',true);
 assert.deepEqual(readDimensions(sheet,'overall'),['٥٬٠٠٠ مم']);
 assert.deepEqual(readDimensions(sheet,'opening-stations'),expected([400,900,700,1200,1800]),'only outer door/window casings divide the survey dimension chain');
 assert.deepEqual(readDimensions(sheet,'base-unit'),expected(baseWidths),'water/electric points and upper dividers must not split a lower cabinet width');
 assert.deepEqual(readDimensions(sheet,'upper-unit'),expected([700,600,500]));
 assert.equal([...sheet.matchAll(/data-sheet-label=""/g)].length,7);
 assert(!/NaN|Infinity/.test(sheet));
 return sheet;
};
check(doc,[600,900,600,900]);
const rice=proposalUnits(doc).find(u=>u.family==='rice');
const moved=previewKitchenWidthChange(doc,rice.id,100);
assert(moved.ok);check(moved.doc,[700,800,600,900]);
assert.deepEqual(readDimensions(elevationSheet(doc,'back',false),'base-unit'),expected([60,90,60,90]));
// On vertically stacked rows both width chains must survive, even when
// different widths are centred on exactly the same plan location.
const stack=structuredClone(doc),r=doc.kitchen.runs.find(row=>row.tier==='upper'),u=doc.kitchen.units.find(unit=>unit.runId===r.id);
stack.kitchen.runs.push({...r,id:'second-storey',bottom:220,height:50});
stack.kitchen.units.push({...u,id:'stacked-unit',runId:'second-storey',width:40});
assert.deepEqual(readDimensions(elevationSheet(stack,'back',true),'upper-unit'),expected([700,600,500,400]));
for(const [tier,count] of [['base',4],['upper',3]]){
 const plan=planSheet(doc,true,{tier,interactive:true});
 assert.equal([...plan.matchAll(/data-sheet-label=""/g)].length,count);
 assert.match(plan,/data-sheet-scale-cm="\d+"/);
 assert.equal([...plan.matchAll(/data-sheet-wall=/g)].length,4);
}
console.log('Independent casing, base, stacked-upper and overall dimension chains; direct unit targets, scale, cm/mm conversion and measured resize validated.');
