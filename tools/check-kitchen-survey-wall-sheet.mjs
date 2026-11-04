// The survey uses outside frame datums and service centres. Wall bounds and
// glyph geometry must use one scale without confusing a cursor for an edge.
import assert from 'node:assert/strict';
import {roomArchitecture} from '../public/kitchen-architecture.js';
import {newChainRow,resolveChain} from '../public/kitchen-chain-model.js';
import {surveyWallSheet} from '../public/kitchen-survey-wall-sheet.js';

const room={width:500,length:500,height:280};
const row=(kind,id,values)=>({...newChainRow(kind,id),...values});
const draft={rows:[
  row('door','d',{gapMm:400,widthMm:900}),
  row('window','w',{gapMm:700,frameRead:{method:'opposite',wallLengthMm:5000,distanceMm:1800}}),
  row('water','m',{from:'origin',gapMm:2600,bottomMm:505}),
  row('stop','e',{from:'origin',gapMm:4300}),
  row('corner','c',{gapMm:700}),
]};
const solved=resolveChain(room,'back',draft);
assert(solved.ok,solved.reason);
const draw=(selection,readings=solved.readings)=>surveyWallSheet(draft,readings,5000,2800,selection);
const html=draw(1),size=html.match(/class="wsheet-wall"[^>]+width="([\d.]+)" height="([\d.]+)"/);
assert(size);assert(Math.abs(Number(size[1])/Number(size[2])-5000/2800)<.0001,'One physical scale in both axes');
assert(html.includes('data-chain-hit="1" data-survey-ref-mm="2000" data-survey-end-mm="3200" class="wsheet-item wsheet-current"'));
assert(html.includes('data-survey-dim="selected-gap" data-mm="700"'));
assert(html.includes('data-survey-dim="selected-width" data-mm="1200" data-chain-hit="1" data-chain-focus="frameDistance"'));
assert(html.includes('data-survey-dim="selected-feature-height" data-mm="'+draft.rows[1].heightMm+'" data-chain-hit="1" data-chain-focus="heightMm"'));
assert(html.includes('data-survey-dim="station" data-mm="900" data-chain-hit="0" data-chain-focus="widthMm"'));
assert(html.includes('data-survey-dim="height" data-mm="2800"'));
assert(html.includes('data-survey-dim="overall" data-mm="5000"'));
assert(html.includes('data-survey-dim="selected-bottom-height" data-mm="'+draft.rows[1].bottomMm+'"'));
// An origin-referenced outlet can lie inside the horizontal extent of a higher
// window. It must retain its own true station and the independent centre datum.
const selectedTap=draw(2);
const viewBoxOf=html=>html.match(/viewBox="([^"]+)"/)[1];
assert.equal(viewBoxOf(selectedTap),viewBoxOf(draw(-1)),'selecting an element must not shrink the wall under the pointer');
assert(selectedTap.includes('data-chain-hit="2" data-survey-ref-mm="2600" data-survey-end-mm="2600"'));
assert(selectedTap.includes('data-survey-dim="selected-gap" data-mm="2600"'));
assert(selectedTap.includes('data-survey-dim="selected-center-height" data-mm="505"'));
const prefix=draw(4,solved.readings.slice(0,2));
assert.deepEqual([...prefix.matchAll(/data-chain-hit="(\d+)" data-survey-ref-mm/g)].map(m=>m[1]),['0','1']);
assert.deepEqual([...prefix.matchAll(/data-survey-dim="station" data-mm="([^"]+)/g)].map(m=>+m[1]),[400,900,700,1200]);
assert(!prefix.includes('wsheet-item wsheet-current')&&!prefix.includes('data-mm="1800"'),'No remaining span mistaken for a separate reading');
const returns={...room,architecture:{wallThickness:20,cut:{kind:'notch',corner:'back-left',width:50,depth:40}}};
const edge=roomArchitecture(returns).walls.find(w=>w.id==='back');
assert(edge.start>0);
const cut={rows:[row('electric','plug',{gapMm:550})]};
const checks=resolveChain(returns,edge.id,cut);assert(checks.ok,checks.reason);
const offsetDrawing=surveyWallSheet(cut,checks.readings,edge.length*10,2800,0);
assert(offsetDrawing.includes('data-survey-ref-mm="550"')&&offsetDrawing.includes('data-survey-dim="overall" data-mm="4500"'));
const blank=surveyWallSheet({rows:[]},[],600,6000,-1);
assert(!blank.includes('data-chain-hit')&&!blank.includes('NaN')&&!blank.includes('Infinity'));
const prompt='اسحب بين طرفي برواز الشباك';
assert.match(surveyWallSheet({rows:[]},[],5000,2800,-1,[],0,prompt), /class="wsheet-prompt"/);
assert(!surveyWallSheet(draft,solved.readings,5000,2800,-1,[],0,prompt).includes('wsheet-prompt'));
const tools=['water','drain','electric','gas','vent'];
const services={rows:tools.map((kind,i)=>row(kind,'p'+i,{gapMm:500}))};
const serviceReadings=resolveChain(room,'back',services);
assert(serviceReadings.ok);
const symbols=surveyWallSheet(services,serviceReadings.readings,5000,2800,0);
for(const kind of tools)assert(symbols.includes('data-service-symbol="'+kind+'"'));
assert.match(html,/wsheet-glass/);
assert.match(html,/data-wall-kind="window" data-source="reading" aria-pressed="true"/);
assert.match(surveyWallSheet(draft,solved.readings,5000,2800,1,[],0,'',true), /data-source="drawing"/);
assert(!html.includes('wsheet-door-lever'),'An unrecorded handing must not add a handle to the elevation');
assert.equal(surveyWallSheet({rows:[]},[],Infinity,2800),'');
console.log('Measured survey elevations: equal axis scaling, casing-to-casing and origin gaps, centre heights, offset wall origins, partial chains and empty room preserved.');
