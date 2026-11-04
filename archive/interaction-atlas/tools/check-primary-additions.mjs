import assert from 'node:assert/strict';
import {createButtonRecorder,createSampleInspector,buttonTraces,sampleButtonTrace} from '../dist/button-lab.js';
import {createSpatialTimeRecorder,spatialTimeSamples} from '../dist/spatial-time.js';

// Incoming position samples, including an unchanged release position, are
// distinct from clock-only advances or derived threshold events.
const raw=createSampleInspector(),metrics=createButtonRecorder(),a={x:100,y:50},b={x:140,y:50};
raw.begin(a,40000,'mouse');metrics.begin(a,0);raw.append(b,40020);metrics.sample(b,20);
for(let t=40;t<=800;t+=20)metrics.advance(t);
assert.equal(raw.snapshot().count,2,'Animation ticks cannot invent original mouse samples.');
raw.append(b,40810,'up');metrics.finish(b,810);
assert.deepEqual(raw.read(2),{x:140,y:50,t:810,phase:'up'});
assert.equal(raw.snapshot().source,'mouse');assert(raw.select(1));assert.deepEqual(raw.snapshot().row,{x:140,y:50,t:20,phase:'move'});
const before=metrics.snapshot();raw.select(0);raw.select(2);assert.deepEqual(metrics.snapshot(),before,'Inspecting a row must not change the completed gesture.');
assert.equal(raw.append(b,41000),false);assert.equal(raw.select(7),false);
raw.begin(a,80000,'mouse');raw.append(b,80020);raw.interrupt();assert.equal(raw.snapshot().status,'interrupted');assert.equal(raw.snapshot().count,2);assert.equal(raw.append(b,80040,'up'),false);assert.deepEqual(raw.read(0),{...a,t:0,phase:'down'});
const guide=sampleButtonTrace(buttonTraces.find(t=>t.id==='pause'));
raw.begin(guide[0],guide[0].t,'guide');for(const p of guide.slice(1,-1))raw.append(p,p.t);raw.append(guide.at(-1),guide.at(-1).t,'up');
assert.equal(raw.snapshot().source,'guide');assert.equal(raw.snapshot().count,66);raw.select(32);assert.deepEqual(raw.snapshot().row,{x:680,y:150,t:640,phase:'move'});assert.deepEqual(raw.read(65),{x:680,y:150,t:1300,phase:'up'});
raw.clear();assert.equal(raw.snapshot().count,0);assert.equal(raw.snapshot().row,null);

const shared=createSpatialTimeRecorder(),samples=spatialTimeSamples(),states=new Map();
shared.begin(samples[0],0);for(const p of samples.slice(1)){shared.sample(p,p.t);if([400,1200,1600].includes(p.t))states.set(p.t,shared.snapshot());}shared.finish(samples.at(-1),1600);
const result=t=>{const s=states.get(t);return [s.extent,s.pathLength,s.spatialPieces,s.timePulses];};
assert.deepEqual(result(400),[200,200,4,0]);assert.deepEqual(result(1200),[200,200,4,2]);assert.deepEqual(result(1600),[100,300,2,3]);
const frozen=shared.snapshot();assert.equal(shared.advance(5000),false);assert.deepEqual(shared.snapshot(),frozen);
// Same x with vertical motion: path length grows, horizontal extent does not.
shared.begin({x:200,y:0},100);shared.sample({x:200,y:100},599);let s=shared.snapshot();assert.equal(s.extent,75);assert.equal(s.pathLength,100);assert.equal(s.spatialPieces,2);assert.equal(s.timePulses,0);
shared.advance(600);assert.equal(shared.snapshot().timePulses,1);shared.sample({x:20,y:10},750);assert.equal(shared.snapshot().spatialPieces,1);shared.sample({x:1400,y:10},800);assert.equal(shared.snapshot().spatialPieces,12);
shared.cancel(850);s=shared.snapshot();assert(s.interrupted&&!s.released&&!s.held);assert.equal(shared.advance(1500),false);assert.equal(shared.snapshot().timePulses,1);
console.log('PASS: inspect true/synthetic x,y,t samples without generating or mutating input; shared horizontal extent vs held time, hold/return/bounds/cancel.');
