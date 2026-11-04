import assert from 'node:assert/strict';
import {createShelfPlan,applyPreset,validatePlan,moveCab,updateCab,readSizedScreen} from '../public/shelf-model.js';
import {scopedCells,scopedDividers,splitTarget,moveScopedDivider} from '../public/shelf-selection-model.js';
import {placeSizedScreen,resizeSizedScreen,removeSizedScreen,inspectSizedScreen,renderSizedScreen} from '../public/shelf-sized-object.js';

const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const cell=(p,k)=>scopedCells(p).find(c=>c.key===k);
const round=p=>assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
const base=createShelfPlan(),snapshot=JSON.stringify(base);
for(const target of [null,{kind:'wall'},{kind:'cabinet'},'no:such:key'])
  assert.equal(placeSizedScreen(base,target,{w:55,h:30}).plan,base);
for(const size of [{w:40,h:0},{w:NaN,h:10},{w:'60',h:10},{w:1201,h:30}])
  assert.equal(placeSizedScreen(base,'1:1',size).plan,base);
assert.equal(inspectSizedScreen(base),null);assert.equal(renderSizedScreen(base),'');
assert.equal(resizeSizedScreen(base,{w:12,h:23}).plan,base);assert.equal(removeSizedScreen(base).plan,base);
const initialSize={w:60.375,h:34.25},result=placeSizedScreen(base,{kind:'cell',key:'1:1'},initialSize);
assert(result.ok&&result.changed);const withTV=result.plan,s=inspectSizedScreen(withTV),opening=cell(base,'1:1');
assert(s.fits);assert.equal(s.openingKey,'1:1');assert.deepEqual(s.conflicts,[]);
near(s.rect.x+s.w/2,opening.x+opening.w/2);near(s.rect.y+s.h,opening.y+opening.h);assert.equal(s.w,initialSize.w);assert.equal(s.h,initialSize.h);
const html=renderSizedScreen(withTV);assert(html.includes('data-screen-fit="true"')&&html.includes('width="60.375" height="34.25" data-screen-case'));assert(!html.includes('scale('));
assert.equal(resizeSizedScreen(withTV,initialSize).plan,withTV);round(withTV);assert.equal(withTV.version,base.version);
assert.deepEqual(withTV.cells,base.cells);assert.deepEqual(withTV.cab,base.cab);assert.equal(JSON.stringify(base),snapshot);

// Matching the precise opening is a fit, even when all four edges touch.
const exactly=resizeSizedScreen(withTV,{w:opening.w,h:opening.h}).plan;
assert(inspectSizedScreen(exactly).fits);round(exactly);
// A single real rack column moves into the freestanding screen. Moving it
// back restores the fit, without moving the screen, scaling it or toggling
// any stored conflict bit. Both edit and exported SVG describe the collision.
const cut=scopedDividers(withTV).find(d=>d.id==='cabinet:col:0');
const obstructed=moveScopedDivider(withTV,cut.id,s.rect.x+3);
const blocked=inspectSizedScreen(obstructed);
assert(!blocked.fits);assert.equal(blocked.openingKey,null);assert.deepEqual(blocked.rect,s.rect);
const hit=blocked.conflicts.find(c=>c.id===cut.id);assert(hit&&hit.axis==='col');near(hit.overlap.w,2);near(hit.overlap.h,s.h);
assert.equal(blocked.conflicts.length,1);
assert(renderSizedScreen(obstructed,{preview:true}).includes('data-screen-hit="cabinet:col:0"'));
assert(renderSizedScreen(obstructed,{exportMode:true}).includes('data-screen-hit="cabinet:col:0"'));
assert.equal(obstructed.sizedObject,withTV.sizedObject);
assert(inspectSizedScreen(moveScopedDivider(obstructed,cut.id,cut.cm)).fits);round(obstructed);
const moved=moveCab(withTV,5,-3),ms=inspectSizedScreen(moved);
near(ms.rect.x,s.rect.x+5);near(ms.rect.y,s.rect.y-3);near(ms.w,s.w);near(ms.h,s.h);

// An oversized user size is preserved intentionally, both on placement and
// round trip. A shelf touching its base isn't an overlap; a shelf through
// its interior is. A single screen can overlap both frame and several boards.
const wider=resizeSizedScreen(withTV,{w:310.625,h:145.125}).plan;
assert.equal(wider.sizedObject.centerX,withTV.sizedObject.centerX);round(wider);
const huge=inspectSizedScreen(wider);assert(!huge.fits);assert(huge.conflicts.some(c=>c.kind==='frame'));
assert(huge.conflicts.some(c=>c.kind==='outside')&&huge.conflicts.some(c=>c.kind==='divider'&&c.axis==='row'));
assert.equal(huge.rect.w,310.625);assert.equal(huge.rect.h,145.125);
const newLocation=placeSizedScreen(wider,'2:2',initialSize).plan;
assert.notEqual(newLocation.sizedObject.centerX,wider.sizedObject.centerX);assert.equal(newLocation.sizedObject.w,initialSize.w);round(newLocation);
const removed=removeSizedScreen(wider);assert(removed.changed);assert(!Object.hasOwn(removed.plan,'sizedObject'));round(removed.plan);
// History holds the immutable pre-edit plan; it can recover exact dimensions
// and conflict state after removal, and pre-placement legacy JSON stays bare.
assert.equal(inspectSizedScreen(wider).w,310.625);assert.equal(inspectSizedScreen(withTV).w,60.375);round(base);
// Splitting the occupied opening produces a real timber conflict, but a wall
// planning line through exactly the same spot has zero material thickness.
const tree=splitTarget(withTV,{kind:'cell',key:'1:1'},'col').plan;
assert.equal(placeSizedScreen(tree,'1:1',{w:10,h:20}).plan,tree);
assert(inspectSizedScreen(tree).conflicts.some(c=>c.id==='cell:1:1:col:0'));
const deep=placeSizedScreen(tree,'1:1/1',{w:10,h:9}).plan;assert.equal(inspectSizedScreen(deep).openingKey,'1:1/1');round(deep);
const planning=splitTarget(withTV,{kind:'wall'},'col').plan;
assert(inspectSizedScreen(planning).fits);round(planning);
// A major resize may leave the still full-size reference entirely outside,
// without crossing any boards at all; it must not be reported as fitting.
const small=updateCab(applyPreset(withTV,'empty'),{w:40,h:25});assert(!inspectSizedScreen(small).fits);
assert(inspectSizedScreen(small).conflicts.some(c=>c.kind==='outside'));round(small);
for(const bad of [{...withTV.sizedObject,h:Infinity},{...withTV.sizedObject,kind:'vase'},
  {...withTV.sizedObject,centerX:-2},null]){
  assert.equal(readSizedScreen(bad),null);assert.equal(validatePlan({...withTV,sizedObject:bad}),null);
}
console.log('Sized screen: exact cm, moving/nested boards, frame and outside conflicts, drawing, legacy/v2 persistence and immutable undo passed.');
