import assert from 'node:assert/strict';
import {buildVolumeArt} from '../public/shelf-volume-contents.js';
import {createShelfPlan,applyPreset} from '../public/shelf-model.js';
import {splitTarget,scopedCells,moveScopedDivider,setScopedContent} from '../public/shelf-selection-model.js';
import {inspectSizedScreen,placeSizedScreen,resizeSizedScreen} from '../public/shelf-sized-object.js';

const base=createShelfPlan(),snapshot=JSON.stringify(base);
const ext=(faces,k)=>{const vals=faces.flatMap(f=>f.points.map(p=>p[k]));return [Math.min(...vals),Math.max(...vals)];};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const delta=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=(a,b,c)=>{const ab=delta(b,a),ac=delta(c,a);return [ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];};
function checkDecor(p,depth) {
  const faces=buildVolumeArt(p,{depth}),leaves=scopedCells(p);
  for(const c of leaves) {
    const own=faces.filter(f=>f.key===c.key);
    if(c.content==='empty'){assert(!own.length);continue;}
    assert(own.length>5&&own.every(f=>f.kind===c.content));
    const [l,r]=ext(own,'x'),[t,b]=ext(own,'y'),[back,front]=ext(own,'z');
    assert(l>c.x&&r<c.x+c.w&&r-l>1e-7);assert(t>c.y);near(b,c.y+c.h);
    assert(back>0&&front<depth&&front-back>Math.min(depth*.05,.20),'ornament must project through depth inside the cabinet');
    let side=false,top=false,frontFace=false;
    for(const face of own){
      assert(/^#[\da-f]{6}$/i.test(face.fill));
      const ps=face.points.map(p=>[p.x,p.y,p.z]);assert(ps.length>=3&&ps.flat().every(Number.isFinite));
      const n=norm(...ps.slice(0,3)),len=Math.hypot(...n);assert(len>1e-10,`zero-area face: ${c.content} ${face.tag}`);
      if(Math.abs(n[0])/len>.5)side=true;if(Math.abs(n[1])/len>.5)top=true;if(Math.abs(n[2])/len>.5)frontFace=true;
      // Non-triangle faces must be planar for renderer triangulation.
      for(const q of ps.slice(3))assert(Math.abs(delta(q,ps[0]).reduce((v,x,i)=>v+x*n[i],0))/len<1e-7);
    }
    assert(side&&top&&frontFace,`flat billboard: ${c.content}`);
  }
  return faces;
}
const faces=checkDecor(base,36);assert.equal(buildVolumeArt(base,{depth:36}),faces);
assert.deepEqual(new Set(faces.map(f=>f.kind)), new Set(['books','vase','plant','boxes']));
const thin=checkDecor(base,5);assert.notDeepEqual(ext(faces,'z'),ext(thin,'z'));
assert.deepEqual(buildVolumeArt(applyPreset(base,'empty'),{depth:36}),[]);
const divided=splitTarget(base,{kind:'cell',key:'1:1'},'col').plan;
const inner=setScopedContent(divided,'1:1/1','vase'),sub=checkDecor(inner,23);
assert(sub.some(f=>f.key==='1:1/0')&&sub.some(f=>f.key==='1:1/1')&&!sub.some(f=>f.key==='1:1'));

const p=placeSizedScreen(base,'1:1',{w:60.375,h:35.125}).plan;
function screen(p,depth){
  const s=inspectSizedScreen(p),all=buildVolumeArt(p,{depth}),f=all.filter(q=>q.kind==='screen'&&!q.diagnostic),body=f.filter(q=>q.tag==='screen-case');
  assert.equal(body.length,6);const [x0,x1]=ext(body,'x'),[y0,y1]=ext(body,'y'),[z0,z1]=ext(body,'z');
  near(x0,s.rect.x);near(y0,s.rect.y);near(x1-x0,s.w);near(y1-y0,s.h);assert(z0>=0&&z1>z0&&z1<depth);
  const hits=all.filter(q=>q.diagnostic);assert.deepEqual(hits.map(q=>q.conflictId),s.conflicts.map(q=>q.id));
  for(const [i,hit] of hits.entries()){
    const conflict=s.conflicts[i],r=conflict.overlap;
    const [x0,x1]=ext([hit],'x'),[y0,y1]=ext([hit],'y');near(x0,r.x);near(x1,r.x+r.w);near(y0,r.y);near(y1,r.y+r.h);
    if(conflict.kind!=='outside')assert(ext([hit],'z')[0]>depth,'conflict should remain visible on the solid board');
    assert.equal(hit.key,'screen');
  }
}
screen(p,36);screen(p,5);
const blocked=moveScopedDivider(p,'cabinet:col:0',inspectSizedScreen(p).rect.x+2);assert(!inspectSizedScreen(blocked).fits);screen(blocked,36);
const outside=resizeSizedScreen(p,{w:310.625,h:160}).plan;screen(outside,20);
assert.equal(JSON.stringify(base),snapshot);
console.log('Volumetric contents: closed/depth-bearing solids, nested clearances, stable keys, authored screen dimensions and physical overlap marks passed.');
