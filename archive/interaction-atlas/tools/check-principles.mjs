import assert from 'node:assert/strict';
import {createMotionEstimator,createTimeResponseEngine,createCaptureReleaseEngine,speedComparisonTraces,principleTraceData} from '../dist/principle-lab.js';

const near=(got,want,tol=1e-6)=>assert.ok(Number.isFinite(got)&&Math.abs(got-want)<=tol,`${got} differs from ${want}`);
function replayMotion(points){const e=createMotionEstimator();e.begin(points[0],points[0].t);for(const p of points.slice(1))e.sample(p,p.t);e.finish(points.at(-1).t);return e.snapshot();}
const [a,b]=speedComparisonTraces.map(replayMotion);
near(a.velocity,200);near(b.velocity,200);near(a.acceleration,120);near(b.acceleration,-120);
assert.notEqual(a.current.x,b.current.x,'The two different histories were not replaced by one impossible fixed trace.');
assert(a.released&&b.released&&!a.held&&!b.held);
const motion=createMotionEstimator();motion.begin({x:30,y:20},0);
assert.equal(motion.snapshot().velocity,null);assert.equal(motion.sample({x:500,y:100},0),false);assert.equal(motion.snapshot().acceleration,null);
motion.sample({x:34,y:80},20);near(motion.snapshot().velocity,200);assert.equal(motion.snapshot().acceleration,null);
for(let t=40;t<=270;t+=10)motion.advance(t);
near(motion.snapshot().velocity,0);near(motion.snapshot().acceleration,0);motion.finish(270,true);assert(motion.snapshot().interrupted&&!motion.snapshot().released);assert.equal(motion.advance(500),false);

const time=createTimeResponseEngine();time.begin(false,0);time.advance(800);assert.equal(time.snapshot().dwell,0);
time.sample(true,800);time.advance(1299);assert.equal(time.snapshot().once,0);time.advance(1300);assert.equal(time.snapshot().once,1);assert.equal(time.snapshot().repeated,1);
time.advance(2400);let s=time.snapshot();assert.equal(s.dwell,1600);assert.equal(s.once,1);assert.equal(s.repeated,3);near(s.continuous,3.2);
time.sample(false,2500);assert.deepEqual([time.snapshot().dwell,time.snapshot().once,time.snapshot().repeated,time.snapshot().continuous],[0,0,0,0]);
time.sample(true,2700);time.advance(3200);assert.equal(time.snapshot().visits,2);assert.equal(time.snapshot().repeated,1);time.finish(3220,true);assert(time.snapshot().interrupted&&!time.snapshot().released);assert.equal(time.advance(9000),false);assert.equal(time.snapshot().dwell,520);
const guideTime=createTimeResponseEngine(),inside=p=>p.x>=275&&p.x<=525&&p.y>=32&&p.y<=178;
guideTime.begin(inside(principleTraceData.time[0]),0);for(const p of principleTraceData.time.slice(1))guideTime.sample(inside(p),p.t);guideTime.finish(1600);assert.deepEqual([guideTime.snapshot().once,guideTime.snapshot().repeated,guideTime.snapshot().continuous],[1,3,3.2]);

const magnet=createCaptureReleaseEngine(), point=d=>({x:400+d,y:105});magnet.begin(point(65),0);
assert.deepEqual(magnet.snapshot().models.map(m=>m.captured),[false,false]);magnet.sample(point(40),100);
assert.deepEqual(magnet.snapshot().models.map(m=>m.captured),[true,true]);magnet.sample(point(65),200);s=magnet.snapshot();
assert.deepEqual(s.models.map(m=>m.captured),[false,true]);assert.deepEqual(s.models.map(m=>m.output.x),[465,400]);near(s.distance,65);
magnet.sample(point(90),250);assert.equal(magnet.snapshot().models[1].captured,true);magnet.sample(point(90.01),260);assert.equal(magnet.snapshot().models[1].captured,false);
magnet.finish(300);assert(magnet.snapshot().released);assert.equal(magnet.sample(point(0),350),false);
const guideMagnet=createCaptureReleaseEngine();let first65=null;guideMagnet.begin(principleTraceData.capture[0],0);
for(const p of principleTraceData.capture.slice(1)){guideMagnet.sample(p,p.t);if(p.t===400)first65=guideMagnet.snapshot();}
guideMagnet.finish(1600);s=guideMagnet.snapshot();near(first65.distance,65);near(s.distance,65);assert.deepEqual(first65.models.map(m=>m.captured),[false,false]);assert.deepEqual(s.models.map(m=>m.captured),[false,true]);
console.log('PASS: motion estimates and matched speed; one-shot/periodic/integrated dwell; shared-trace stateful capture and release.');
