import assert from 'node:assert/strict';
import {createShelfPlan,applyPreset} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,splitTarget,setScopedContent} from '../public/shelf-selection-model.js';
import {removalAt,checkRemovalAt} from '../public/shelf-point-model.js';
import {placeSizedScreen,removeSizedScreen,inspectSizedScreen} from '../public/shelf-sized-object.js';
import {bulkSetContent} from '../public/shelf-marquee.js';
import {collisionDescription,onScreenFace,removalItem,removalKey,removalDescription} from '../public/shelf-delete-target.js';

const root={kind:'cabinet'},base=splitTarget(applyPreset(createShelfPlan(),'empty'),root,'col').plan;
const [left,right]=scopedCells(base),board=scopedDividers(base).find(d=>d.kind==='cabinet');
for(const [a,b,keep] of [['books','plant','books'],['vase','vase','vase'],['empty','boxes','boxes'],['plant','empty','plant']]){
  const p=setScopedContent(setScopedContent(base,left.key,a),right.key,b),snapshot=JSON.stringify(p),check=checkRemovalAt(p,board.id),first=removalAt(p,board.id),both=a!=='empty'&&b!=='empty';
  assert.equal(check.canForce,both);if(both){
    assert.equal(first.plan,p);assert.equal(first.changed,false);assert.match(collisionDescription(check),/التأكيد/);
    assert.match(removalDescription(p,{dividerId:board.id}),/تأكيد/);
  }
  const final=both?removalAt(p,board.id,true):first;assert.ok(final.ok&&final.changed);
  assert.equal(scopedCells(final.plan)[0].content,keep);assert.equal(JSON.stringify(p),snapshot,'undo snapshot unchanged');
}
let p=splitTarget(base,{kind:'cell',key:left.key},'row').plan;
p=setScopedContent(p,right.key,'plant');
assert.equal(removalAt(p,board.id,true).ok,false,'force cannot discard a nested grid');
p=placeSizedScreen(p,right.key,{w:20,h:15}).plan;const leaves=scopedCells(p),filled=leaves.map((c,i)=>['books','plant','vase'][i]);
for(let i=0;i<leaves.length;i++)p=setScopedContent(p,leaves[i].key,filled[i]);
const rect=inspectSizedScreen(p).rect;assert.ok(onScreenFace(p,{x:rect.x+rect.w/2,y:rect.y+rect.h/2}));
assert.equal(onScreenFace(p,{x:rect.x,y:rect.y}),false,'transparent rounded corner is not a painted screen');
assert.equal(removalKey(removalItem({screen:true,hit:{dividerId:board.id},art:leaves[0]})),'screen');
const removed=removeSizedScreen(p).plan;assert.deepEqual(scopedCells(removed),scopedCells(p));assert.equal(inspectSizedScreen(removed),null);
const clear=bulkSetContent(p,[leaves[0].key,leaves[1].key],'empty');assert.equal(clear.count,2);assert.deepEqual(clear.plan.sizedObject,p.sizedObject);
assert.equal(scopedCells(clear.plan).find(c=>c.key===leaves[2].key).content,filled[2]);assert.deepEqual(scopedDividers(p),scopedDividers(clear.plan));
console.log('Delete: exact screen/ornament priority, safe scoped bulk clear, explicit protected merges, nested refusal and immutable undo snapshots OK.');
