// A structural test of channel isolation, declared scope, and attribution.
// Component model tests and native/guide browser observations are separate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getChannelDataset,concepts as primaryConcepts,archivedPrimaryBrowserChecks} from '../dist/knowledge-model.js';
import {inputExamples,inputExampleById,inputChannels,getChannelInfo} from '../dist/input-catalog.js';

const ids=['primary','secondary','wheel'];
assert.deepEqual(inputChannels.map(c=>c.id),ids);
assert.equal(getChannelInfo('middle'),undefined);assert.equal(getChannelDataset('unknown'),undefined);
assert.equal(getChannelDataset(''),undefined);assert.equal(getChannelDataset('mixed'),undefined);
assert.deepEqual(inputExamples.map(e=>e.id).sort(),['secondary-drag','wheel-trace']);
const unique=(xs,description)=>assert.equal(new Set(xs).size,xs.length,`Duplicate ${description}`);
const primary=getChannelDataset('primary');
assert.equal(primary.concepts,primaryConcepts,'Existing primary imports must remain valid.');
assert.equal(primary.examples.length,40);
assert.equal(primary.examples.filter(ex=>primary.getExampleRecord(ex.id).scope!=='tool').length,39);
assert.equal(primary.objectives.filter(o=>o.scope!=='tool').length,64);
assert.equal(primary.getExampleRecord('history').scope,'tool');
assert.equal(primary.getEvidence('delete','tools.history').scope,'tool');
assert.equal(Object.keys(archivedPrimaryBrowserChecks).length,11);

const seenExamples=new Set(),seenConcepts=new Set(),seenGoals=new Set();
for(const channel of ids){
  const d=getChannelDataset(channel);assert.equal(d.channel,channel);assert.equal(d.channelInfo,getChannelInfo(channel));
  for(const field of ['catalogVersion','examples','concepts','objectives','evidence','getExampleRecord','getEvidence','browserChecks'])assert(d[field],`${channel}: missing ${field}`);
  const cs=new Map(d.concepts.map(c=>[c.id,c])),os=new Map(d.objectives.map(o=>[o.id,o])),es=new Set(d.examples.map(ex=>ex.id));
  unique(d.evidence.map(e=>`${e.exampleId}/${e.objectiveId}`),`${channel} evidence pair`);
  for(const c of d.concepts){
    assert.equal(c.channel,channel);assert(!seenConcepts.has(c.id),`A concept record was shared instead of scoped: ${c.id}`);seenConcepts.add(c.id);
    for(const k of ['derivesFrom','composedOf','uses','contrasts'])for(const id of c[k])assert(cs.has(id),`Cross-channel or missing ${c.id}/${k}/${id}`);
    for(const link of c.sharedWith||[]){
      assert(link.channel!==channel&&getChannelDataset(link.channel).concepts.some(t=>t.id===link.conceptId),`Bad semantic reference ${c.id}`);
      assert(link.reason?.trim(),`Explain similarity for ${c.id}`);
      assert(!link.status&&!link.reviewed,'A semantic reference must never contain coverage credit.');
    }
    for(const id of c.exampleIds)assert(es.has(id)&&d.getExampleRecord(id).conceptIds.includes(c.id),`Missing inverse concept relation ${c.id}/${id}`);
  }
  for(const o of d.objectives){assert.equal(o.channel,channel);assert(cs.has(o.conceptId));assert(!seenGoals.has(o.id));seenGoals.add(o.id);}
  for(const ex of d.examples){
    assert(!seenExamples.has(ex.id));seenExamples.add(ex.id);const r=d.getExampleRecord(ex.id);assert.equal(r.channel,channel);
    assert(r.objectiveIds.every(id=>os.has(id)));assert(r.conceptIds.every(id=>cs.has(id)));
    if(channel!=='primary'){
      assert.equal(inputExampleById.get(ex.id),ex);assert.equal(ex.channel,channel);assert.equal(r.scope,'study');
      assert(r.completion.some(g=>g.id===`${ex.id}.browser`));
      assert(ex.lesson.goal&&ex.lesson.tryThis&&ex.lesson.boundary);
      assert(primary.getExampleRecord(ex.lesson.compare.id));assert.equal(ex.lesson.compare.channel,'primary');
    }
  }
  for(const ev of d.evidence){
    assert.equal(ev.channel,channel);assert(es.has(ev.exampleId)&&os.has(ev.objectiveId));assert.equal(d.getEvidence(ev.exampleId,ev.objectiveId),ev);
    assert(['direct','partial','missing','unreviewed'].includes(ev.status));assert(ev.test?.trim()&&ev.observation?.trim());
    if(ev.status!=='unreviewed'){assert.notEqual(ev.reviewed,'unreviewed');assert(readFileSync(new URL(`../${ev.source.split(' · ')[0]}`,import.meta.url),'utf8').length);}
    if(ev.browserCheck){
      assert.equal(d.browserChecks[`${ev.exampleId}/${ev.objectiveId}`],ev.browserCheck);
      assert(ev.browserCheck.method&&ev.browserCheck.result&&ev.browserCheck.scenario);
      if(!ev.browserCheckHistorical)assert.equal(ev.browserCheck.version,d.catalogVersion.id);
      if(channel!=='primary')assert.equal(ev.browserCheckHistorical,false,'A primary historical check must not credit an extension.');
    }
  }
  for(const foreign of ids.filter(id=>id!==channel)){
    const other=getChannelDataset(foreign),f=other.examples[0],goal=other.objectives[0];
    assert.equal(d.getExampleRecord(f.id),undefined);
    assert.equal(d.getEvidence(f.id,goal.id).status,'na');
    assert.equal(d.getEvidence(d.examples[0].id,goal.id).status,'na');
  }
}
const wheel=getChannelDataset('wheel'),sec=getChannelDataset('secondary');
assert.equal(wheel.channelInfo.episodeKind,'timed-wheel-events');
assert(!wheel.channelInfo.requiredChannels.some(c=>c.includes('button')));
assert(!sec.channelInfo.requiredChannels.includes('primary-button'));
assert.equal(wheel.getEvidence('wheel-trace','measure.duration').status,'na');
assert.equal(primary.getEvidence('button-trace','wheel.response.quantity').status,'na');
assert.equal(sec.getEvidence('secondary-drag','response.follow').status,'na');
assert(wheel.objectives.some(o=>o.id==='wheel.response.quantity'));
assert(sec.objectives.some(o=>o.id==='secondary.application.move'));
assert.notEqual(wheel.getEvidence('wheel-trace','wheel.response.quantity').source,primary.getEvidence('value','response.mapping').source);
console.log(JSON.stringify(ids.map(id=>{const d=getChannelDataset(id);return {channel:id,version:d.catalogVersion.id,studiedExamples:d.examples.filter(e=>d.getExampleRecord(e.id).scope!=='tool').length,objectivesInScope:d.objectives.filter(o=>o.scope!=='tool').length,evidence:d.evidence.length,observedPairs:d.evidence.filter(e=>e.browserCheck).length,historicalPairs:d.evidence.filter(e=>e.browserCheckHistorical).length};}),null,2));
