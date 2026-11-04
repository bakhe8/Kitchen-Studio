import assert from 'node:assert/strict';
import {intakeRoomDrawing} from '../public/kitchen-intake-drawing.js';

const bounds=(svg,part)=>{
 const shape=svg.match(new RegExp('<g data-visit-shape="'+part+'" data-measured="([^"]+)">([\\s\\S]*?)</g>'));
 assert.ok(shape,part);
 const rect=shape[2].match(part==='plan'?/<rect[^>]+\/><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/:/<rect class="visit-volume-back" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/);
 assert.ok(rect,part);
 return {measured:shape[1]==='true',x:+rect[1],y:+rect[2],w:+rect[3],h:+rect[4]};
};
const sizes=[{width:980,height:480},{width:730,height:680},{width:1380,height:580},{width:320,height:220}];
for(const size of sizes){
 const first=intakeRoomDrawing({},size),chipWidth=size.width<560?104:124;
 assert.equal(bounds(first.svg,'plan').measured,false);assert.equal(bounds(first.svg,'volume').measured,false);
 assert.equal((first.svg.match(/data-visit-measure="/g)||[]).length,3);
 for(const [key,anchor] of Object.entries(first.anchors)){
  assert.ok(first.svg.includes('aria-controls="visit-'+key+'"'));
  assert.ok(anchor.x-chipWidth/2>=0&&anchor.x+chipWidth/2<=size.width,key+' inline');
  assert.ok(anchor.y-29>=0&&anchor.y+29<=size.height,key+' block');
 }
 const a=Object.values(first.anchors);
 for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)
  assert.ok(Math.abs(a[i].x-a[j].x)>=chipWidth||Math.abs(a[i].y-a[j].y)>=58,'input targets must not overlap');
 for(const [widthMm,lengthMm,heightMm] of [[4200,3100,2800],[600,12000,6000],[12000,600,600],[5000,5000,2800]]){
  const result=intakeRoomDrawing({widthMm,lengthMm,heightMm},size);
  assert.deepEqual(result.anchors,first.anchors,'active inputs stay in place while the measured room changes');
  const plan=bounds(result.svg,'plan'),section=bounds(result.svg,'volume');
  assert.ok(result.svg.includes('visit-volume-floor'));
  assert.ok(section.x>=0&&section.x+section.w<=size.width);
  assert.ok(section.y>=0&&section.y+section.h<=size.height);
  assert.ok(plan.measured&&section.measured);
  assert.ok(Math.abs(plan.w*lengthMm/widthMm-plan.h)<.2,'plan has measured aspect ratio');
  assert.ok(Math.abs(section.w*heightMm/widthMm-section.h)<.2,'cutaway back wall has measured aspect ratio');
  assert.ok(Math.abs(plan.w-section.w)<.02,'both views share scale');
 }
}
const partial=intakeRoomDrawing({widthMm:3200,lengthMm:2600,heightMm:null});
assert.ok(bounds(partial.svg,'plan').measured);assert.ok(!bounds(partial.svg,'volume').measured);
assert.match(partial.svg,/input|إدخال العرض الداخلي، ٣٬٢٠٠ مم/);assert.ok(!partial.svg.includes('سم'));
assert.match(intakeRoomDrawing({},sizes[0]).svg,/data-visit-layout="across"/);
assert.match(intakeRoomDrawing({},sizes[1]).svg,/data-visit-layout="stack"/);
console.log('Scale-correct plan/cutaway elevation, responsive arrangement, stable non-overlapping native input positions and schematic unmeasured spans verified.');
