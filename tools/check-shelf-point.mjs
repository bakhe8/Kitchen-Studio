import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan} from '../public/shelf-model.js';
import {targetInfo,scopedDividers,splitTarget,setScopedContent,selectedTarget,commitDividerDrop} from '../public/shelf-selection-model.js';
import {pointContext,checkRemovalAt,removalAt} from '../public/shelf-point-model.js';

const cab={kind:'cabinet'},wall={kind:'wall'},c=key=>({kind:'cell',key}),z=key=>({kind:'zone',key});
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const base=freeze(createShelfPlan()),saved=JSON.stringify(base),leaf=c('0:0'),box=targetInfo(base,leaf);
const at=(r,dx=r.w/2,dy=r.h/2)=>({x:r.x+dx,y:r.y+dy});
const p=freeze(at(box,21.625,18.875)),hit=freeze({target:leaf});
const action=(menu,id)=>menu.actions.find(a=>a.id===id),near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const split=(plan,t,a)=>{const r=splitTarget(plan,t,a);assert(r.ok,r.reason);return freeze(r.plan);};

// A plain pick edits its leaf. A secondary click can retain the selected
// cabinet ONLY because it is an ancestor at this very point. Switching scope
// changes line length, not the stored pointer coordinates or saved plan.
const picked=pointContext(base,hit,p,leaf),wide=pointContext(base,hit,p,cab);
assert.deepEqual(picked.target,leaf);assert.deepEqual(wide.target,cab);assert.deepEqual(wide.hitTarget,leaf);
assert.deepEqual(picked.scopes.map(s=>s.id),['scope:cell:0:0','scope:cabinet','scope:wall']);
assert.equal(wide.scopes.filter(s=>s.active).length,1);assert.equal(wide.scopes.find(s=>s.active).id,'scope:cabinet');
assert.equal(wide.insertLabel,'الدولاب كله');assert.deepEqual(wide.point,p);assert(!Object.hasOwn(wide,'plan'));
for(const ctx of [picked,wide])for(const a of ctx.actions){assert(!a.disabled,a.reason);assert.deepEqual(a.target,ctx.target);near(a.cm,a.axis==='col'?p.x:p.y);assert(a.preview);}
near(action(picked,'insert-row').preview.x2-action(picked,'insert-row').preview.x1,box.w);
near(action(wide,'insert-row').preview.x2-action(wide,'insert-row').preview.x1,base.cab.w-4);
const row=action(wide,'insert-row'),applied=commitDividerDrop(base,row.target,row.axis,wide.point);assert(applied.ok);assert.deepEqual(applied.preview,row.preview);assert(validatePlan(applied.plan));
assert.deepEqual(pointContext(base,hit,p,c('2:1')).target,leaf,'An unrelated current cell must not capture a point outside its lineage.');
const switched=pointContext(base,hit,p,leaf,{scopeOverride:cab});assert.deepEqual(switched.target,cab);assert.deepEqual(switched.point,p);

// A click over the cabinet never creates a wall line behind it. A deliberate
// wall choice remains selectable, but explains why this same point is blocked.
const hiddenByDefault=pointContext(base,hit,p,wall);assert.deepEqual(hiddenByDefault.target,leaf);assert(!hiddenByDefault.occluded);
const behind=pointContext(base,hit,p,leaf,{scopeOverride:wall});assert.deepEqual(behind.target,wall);assert(behind.occluded);
assert(behind.actions.length===2&&behind.actions.every(a=>a.disabled&&a.code==='occluded-wall'&&!a.preview));assert.equal(behind.scopes.find(s=>s.active).id,'scope:wall');
const offcentre={x:box.x+4,y:p.y},tight=pointContext(base,hit,offcentre,leaf);assert(action(tight,'insert-col').disabled);assert.equal(action(tight,'insert-col').code,'requested-clearance');
near(action(tight,'insert-col').preview.cm,offcentre.x);assert.deepEqual(tight.target,leaf);assert(!action(tight,'insert-row').disabled);

// Deep lineage is spatial and stable: leaf -> local containing group ->
// original base cell -> cabinet -> wall. An explicit sibling is ignored.
const nested=split(split(base,c('1:1'),'col'),c('1:1/0'),'row'),sub=c('1:1/0/1'),subPt=at(targetInfo(nested,sub));
const deep=pointContext(nested,{target:sub},subPt,c('1:1/0'));
assert.deepEqual(deep.scopes.map(s=>s.id),['scope:cell:1:1/0/1','scope:cell:1:1/0','scope:cell:1:1','scope:cabinet','scope:wall']);
assert.deepEqual(deep.target,c('1:1/0'));assert.deepEqual(pointContext(nested,{target:sub},subPt,c('1:1/1')).target,sub);
const localBoard=scopedDividers(nested).find(d=>d.owner.key==='1:1/0'&&d.axis==='row');
const localMenu=pointContext(nested,{target:localBoard.owner,dividerId:localBoard.id},{x:localBoard.x+4,y:localBoard.cm},cab);
assert.equal(localMenu.kind,'divider');assert.equal(localMenu.dividerId,localBoard.id);assert.deepEqual(localMenu.target,localBoard.owner);
assert.match(localMenu.title,/الرفّ الأفقي رقم ١ من الأعلى/);assert(localMenu.title.includes(targetInfo(nested,localBoard.owner).label));
assert.deepEqual(localMenu.actions.map(a=>a.id),['remove-divider']);assert.equal(action(localMenu,'remove-divider').index,localBoard.index);

// Visible wall zones offer planning actions; an explicitly reported hidden
// wall guide cannot bypass cabinet foreground. No insertion on frame/material.
const zones=split(base,wall,'col'),left=z('wall/0'),wpt={x:29,y:27};
const zm=pointContext(zones,{target:left},wpt,left);assert.deepEqual(zm.scopes.map(s=>s.id),['scope:zone:wall/0','scope:wall']);assert(zm.actions.every(a=>a.label.includes('تخطيط')&&!a.disabled));
assert.deepEqual(pointContext(zones,{target:left},wpt,wall).target,wall);
const wd=scopedDividers(zones).find(d=>d.kind==='wall'),wm=pointContext(zones,{target:wall,dividerId:wd.id},{x:wd.cm,y:20},wall);
assert.equal(wm.kind,'divider');assert.match(wm.title,/الحدّ الرأسي/);assert(!action(wm,'insert-row'));
const occluded=pointContext(zones,{target:wall,dividerId:wd.id},{x:wd.cm,y:130},wall);
assert.equal(occluded.kind,'point');assert.equal(occluded.target.kind,'cell');assert(!action(occluded,'remove-divider'));
const frame=pointContext(base,{target:cab},{x:base.cab.x+.25,y:p.y},cab);assert.equal(frame.kind,'frame');assert.equal(frame.actions.length,0);
assert.equal(pointContext(base,hit,{x:-100,y:0},leaf).actions.length,0);
assert.equal(pointContext(base,hit,{x:NaN,y:0},leaf).actions.length,0);
const stale=pointContext(base,{target:cab,dividerId:'retired-id'},p,cab);assert.equal(stale.code,'invalid-divider');assert(!stale.actions.length);

// Remove the FIRST of multiple existing axes, not the default last. A grip's
// hit box can extend off centre; the reported, valid divider ID wins.
const rows=scopedDividers(base).filter(d=>d.owner.kind==='cabinet'&&d.axis==='row');assert(rows.length>1);
const first=rows[0],menu=pointContext(base,{target:cab,dividerId:first.id},{x:base.cab.x+30,y:first.cm+3},c('0:0'));
assert.equal(menu.kind,'divider');assert.equal(menu.actions.length,1);assert.equal(menu.actions[0].dividerId,first.id);
assert.deepEqual(menu.scopes.map(s=>s.id),['scope:cabinet','scope:wall']);assert(checkRemovalAt(base,first.id).ok);
const removed=removalAt(base,first.id);assert(removed.ok&&removed.changed);assert.deepEqual(removed.plan.rows,[base.rows[1]]);assert(validatePlan(removed.plan));
assert.equal(removalAt(base,'unknown',true).plan,base);

// A named divider still honours content confirmation and refuses destroying
// nested groups even when a caller asks to force a content merge.
const conflicted=freeze(setScopedContent(base,'1:0','vase')),ck=checkRemovalAt(conflicted,first.id);
assert(!ck.ok&&ck.canForce&&ck.conflicts.length);const needs=pointContext(conflicted,{target:cab,dividerId:first.id},{x:90,y:first.cm},cab).actions[0];
assert(needs.needsConfirmation&&!needs.disabled);assert.equal(removalAt(conflicted,first.id).plan,conflicted);
const forced=removalAt(conflicted,first.id,true);assert(forced.ok);assert.deepEqual(forced.plan.rows,[base.rows[1]]);
const protectedPlan=freeze(setScopedContent(split(base,c('0:0'),'row'),'1:0','vase')),col0=scopedDividers(protectedPlan).find(d=>d.owner.kind==='cabinet'&&d.axis==='col'&&d.index===0);
const refuse=checkRemovalAt(protectedPlan,col0.id);assert.equal(refuse.code,'nested-conflict');assert(!refuse.canForce);
assert.equal(removalAt(protectedPlan,col0.id,true).plan,protectedPlan);assert.equal(JSON.stringify(base),saved);assert.deepEqual(selectedTarget(base),c('1:1'));
console.log('PASS: point-scoped ancestor selection, cabinet/wall occlusion, exact-preview insert actions, material identity, and exact-index protected removal.');
