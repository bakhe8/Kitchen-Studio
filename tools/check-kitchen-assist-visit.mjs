import assert from 'node:assert/strict';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {readVisitContext,saveVisitContext,clearVisitContext} from '../public/kitchen-assist-visit.js';
import {applyAnswer} from '../public/kitchen-assist-engine.js';
class Session {m=new Map;getItem(key){return this.m.get(key)??null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
globalThis.sessionStorage=new Session();const room=makeFurnishedSaudiRoom('villa'),empty={responsible:'',date:'',revision:''};
assert.deepEqual(readVisitContext(room),empty);assert.equal(saveVisitContext(room,{date:'2025-02-30'}).ok,false);assert.deepEqual(readVisitContext(room),empty);
const info={responsible:'فني تجريبي',date:'2026-10-01',revision:'زيارة اختبار'};
assert(saveVisitContext(room,info).ok);let r=applyAnswer(room,'equipment','bearing','zero',{visit:readVisitContext(room)});assert(r.ok,r.reason);
assert.deepEqual([r.record.responsible,r.record.date,r.record.revision],[info.responsible,info.date,info.revision]);
const changed={...room,room:r.room};assert.deepEqual(readVisitContext(changed),info);
assert.deepEqual((await import('../public/kitchen-assist-visit.js?reload-check')).readVisitContext(JSON.parse(JSON.stringify(changed))),info,'same saved project reloaded in the tab keeps explicit defaults');
// A distinct import even of an identically sized, named preset never acquires the old attribution.
assert.deepEqual(readVisitContext(makeFurnishedSaudiRoom('villa')),empty);assert.deepEqual(readVisitContext(changed),info);
assert(clearVisitContext(changed).ok);assert.deepEqual(readVisitContext(changed),empty);
assert.deepEqual([r.record.responsible,r.record.date,r.record.revision],[info.responsible,info.date,info.revision],'clearing defaults cannot rewrite original evidence');
console.log('Visit context: no automatic dates, valid/invalid dates, clean isolation of duplicate imports, session reload continuity, use once and clear without altering recorded evidence.');
