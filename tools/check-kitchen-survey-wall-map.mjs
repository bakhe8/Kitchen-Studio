import assert from 'node:assert/strict';
import {roomArchitecture} from '../public/kitchen-architecture.js';
import {parseMeasuredOutline} from '../public/kitchen-measured-outline.js';
import {surveyWallMap} from '../public/kitchen-survey-wall-map.js';

const approx=(a,b)=>assert(Math.abs(a-b)<.025,`${a} ≠ ${b}`);
function verify(room){
  const walls=roomArchitecture(room).walls;
  for(const [i,active] of walls.entries()){
    const markup=surveyWallMap(walls,active.id,{[active.id]:'draft'});
    const pts=markup.match(/data-survey-wall-outline="" points="([^"]+)"/)[1].split(' ').map(pair=>pair.split(',').map(Number));
    assert.equal(pts.length,walls.length);
    assert.deepEqual(new Set(Array.from(markup.matchAll(/data-survey-wall-id="([^"]+)"/g),m=>m[1])),new Set(walls.map(w=>w.id)));
    const current=markup.match(/data-survey-direction=""><circle cx="([^"]+)" cy="([^"]+)"/);
    approx(+current[1],pts[i][0]);approx(+current[2],pts[i][1]);
    // The same positive scale is used for x and z, even on rotated short
    // returns. Mirroring the canvas for RTL would reverse the technician's walk.
    const p0=pts[0],zero=walls[0].a;
    const long=walls.reduce((best,w,j)=>Math.abs(w.a.x-zero.x)>Math.abs(walls[best].a.x-zero.x)?j:best,0);
    const scale=(pts[long][0]-p0[0])/(walls[long].a.x-zero.x);
    assert(scale>0);
    for(let j=0;j<walls.length;j++){
      approx(pts[j][0],p0[0]+(walls[j].a.x-zero.x)*scale);
      approx(pts[j][1],p0[1]+(walls[j].a.z-zero.z)*scale);
    }
    assert(!markup.includes('NaN')&&!markup.includes('Infinity'));
  }
  return walls;
}
const rect={width:500,length:410,height:280};
const walls=verify(rect);
assert.deepEqual(walls.map(w=>w.id),['back','right','front','left']);
const cut=verify({...rect,architecture:{cut:{kind:'notch',corner:'back-left',width:70,depth:45}}});
assert(cut.find(w=>w.id==='back').start>0);
verify({...rect,architecture:{cut:{kind:'chamfer',corner:'front-right',width:60,depth:80}}});
const measured=parseMeasuredOutline({reference:'اختبار',unit:'mm',heightMm:2800,vertices:[[600,0],[5000,400],[5000,4000],[0,4000],[0,1000]]});
assert(measured.ok);verify(measured.room);
const html=surveyWallMap(walls,'left',{back:'draft',left:'saved'});
assert(html.includes('data-survey-wall-id="back" data-wall-state="draft"')&&html.includes('data-survey-wall-id="left" data-wall-state="saved"'));
assert(html.includes('تعديلات غير محفوظة')&&html.includes('رفع محفوظ')&&!html.includes('موثّق'));
assert.equal(surveyWallMap([],'back'),'');
console.log('True-scale room locator follows current perimeter order and physical start for rectangle, notch, chamfer and measured outline; jump targets and non-attestation states checked.');
