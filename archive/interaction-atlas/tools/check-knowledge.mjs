// Validate the published knowledge graph and the integrity of the evidence
// ledger. This checks data contracts, not pointer behavior in a browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {examples} from '../dist/catalog.js';
import {lessons} from '../dist/learning-guide.js';
import {catalogVersion,concepts,objectives,evidence,browserChecks,archivedPrimaryBrowserChecks,currentPrimaryBrowserChecks,getExampleRecord,getEvidence} from '../dist/knowledge-model.js';

const unique = (values,what) => assert.equal(new Set(values).size,values.length,`Duplicate ${what}`);
const by = arr => Object.fromEntries(arr.map(x=>[x.id,x]));
const nonempty = value => typeof value==='string' && value.trim().length>0;
const allowedTypes = new Set(['signal','measurement','rule','constraint','composition','application','context']);
const allowedConstruction = new Set(['original','derived','primitive','composite','application']);
const allowedAxes = new Set(['signal','measure','response','phases','contrast','boundaries','composition','application']);
const allowedReview = new Set(['source-reviewed','browser-verified','unreviewed']);
const allowedCoverage = new Set(['direct','partial','missing','unreviewed','na']);
const ex = by(examples), con = by(concepts), obj = by(objectives);
assert(nonempty(catalogVersion.id) && nonempty(catalogVersion.title) && nonempty(catalogVersion.description));
unique(examples.map(x=>x.id),'example id'); unique(concepts.map(x=>x.id),'concept id'); unique(objectives.map(x=>x.id),'objective id');
unique(evidence.map(e=>`${e.exampleId}/${e.objectiveId}`),'evidence pair');
assert.deepEqual(new Set(concepts.flatMap(c=>c.exampleIds)),new Set(Object.keys(ex)),'Concept links must cover exactly the live catalog.');
assert.deepEqual(new Set(evidence.map(e=>e.exampleId)),new Set(Object.keys(ex)),'Evidence links must cover exactly the live catalog.');

for(const c of concepts){
  assert(allowedTypes.has(c.type) && allowedConstruction.has(c.construction),`Unknown type/build ${c.id}`);
  assert(nonempty(c.label)&&nonempty(c.definition)&&nonempty(c.family),`Missing definition ${c.id}`);
  for(const key of ['derivesFrom','composedOf','uses','contrasts']){
    assert(Array.isArray(c[key])); unique(c[key],`${c.id}.${key}`);
    for(const id of c[key]) assert(con[id]&&id!==c.id,`Invalid concept link ${c.id}.${key} -> ${id}`);
  }
  if(c.construction==='derived')assert(c.derivesFrom.length,`Undefined derivation for ${c.id}`);
  if(c.construction==='composite')assert(c.composedOf.length,`Undefined components for ${c.id}`);
  unique(c.exampleIds,`${c.id}.exampleIds`);
  for(const id of c.exampleIds)assert(getExampleRecord(id)?.conceptIds.includes(c.id),`Missing inverse ${id}->${c.id}`);
}
// A circular definition cannot explain the basis of an item. Comparisons and
// use references are intentionally excluded from this dependency check.
const done=new Set(),active=new Set();
function visit(id){if(done.has(id))return;assert(!active.has(id),`Circular derivation/composition at ${id}`);active.add(id);for(const dep of [...con[id].derivesFrom,...con[id].composedOf])visit(dep);active.delete(id);done.add(id);}
for(const c of concepts)visit(c.id);
for(const o of objectives){
  assert(con[o.conceptId]&&allowedAxes.has(o.axis)&&nonempty(o.label)&&nonempty(o.family),`Invalid objective ${o.id}`);
  assert(['single','tool'].includes(o.scope),`Invalid objective scope ${o.id}`);
}

const sourceCache=new Map();
function checkSource(source){
  const path=source.split(' · ')[0];
  assert(/^dist\/[\w-]+\.js$/.test(path),`Missing source component: ${source}`);
  if(!sourceCache.has(path))sourceCache.set(path,readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
  assert(sourceCache.get(path).length,`Empty source component: ${path}`);
}
for(const e of examples){
  const r=getExampleRecord(e.id); assert(r,`Missing record ${e.id}`);
  assert(['single','tool'].includes(r.scope));assert(nonempty(r.contribution)&&nonempty(r.scopeNote));
  assert(r.conceptIds.length&&r.objectiveIds.length,`No declared interpretation or objectives for ${e.id}`);
  unique(r.conceptIds,`${e.id}.conceptIds`);unique(r.objectiveIds,`${e.id}.objectiveIds`);
  for(const id of r.conceptIds)assert(con[id]?.exampleIds.includes(e.id),`Missing inverse ${id}->${e.id}`);
  for(const id of r.objectiveIds)assert(obj[id]&&getEvidence(e.id,id).status!=='na',`No evidence disposition for targeted ${e.id}/${id}`);
  assert(lessons[e.id]?.goal&&lessons[e.id]?.tryThis&&lessons[e.id]?.boundary,`No teaching contract ${e.id}`);
  assert(r.completion.length>=4,`Missing implementation, boundary, explanation or interaction requirement for ${e.id}`);
  unique(r.completion.map(s=>s.id),`${e.id}.completion`);
  for(const s of r.completion)assert(nonempty(s.label)&&nonempty(s.detail)&&allowedReview.has(s.status),`Invalid execution gate ${s.id}`);
  const br=r.completion.find(s=>s.id===`${e.id}.browser`);
  assert(br,`Missing explicit browser gate for ${e.id}`);
  assert.equal(br.status==='browser-verified',!!browserChecks[`${e.id}/@completion`],`An objective check was promoted to a whole-example browser pass: ${e.id}`);
}
for(const item of evidence){
  const r=getExampleRecord(item.exampleId), o=obj[item.objectiveId];
  assert(r&&o&&r.objectiveIds.includes(o.id),`Dangling evidence ${item.exampleId}/${item.objectiveId}`);
  assert(r.conceptIds.includes(o.conceptId),`Objective concept missing on ${item.exampleId}`);
  assert(allowedCoverage.has(item.status)&&item.status!=='na'&&allowedReview.has(item.reviewed));
  assert(nonempty(item.role)&&nonempty(item.observation)&&nonempty(item.test),`Claim without role, observation or check ${item.exampleId}/${item.objectiveId}`);
  assert.equal(getEvidence(item.exampleId,item.objectiveId),item);
  if(item.reviewed!=='unreviewed')checkSource(item.source);
  if(item.status==='unreviewed')assert.equal(item.reviewed,'unreviewed');
  else assert.notEqual(item.reviewed,'unreviewed',`Coverage claimed without a review: ${item.exampleId}/${item.objectiveId}`);
  const check=browserChecks[`${item.exampleId}/${item.objectiveId}`];
  assert.equal(item.reviewed==='browser-verified',!!check,`Browser provenance mismatch ${item.exampleId}/${item.objectiveId}`);
  assert.equal(item.scope,r.scope==='tool'||o.scope==='tool'?'tool':'single','Review scope must not count later tools as part of one press.');
}
for(const [key,b] of Object.entries(browserChecks)){
  const [exampleId,objectiveId]=key.split('/');
  assert(ex[exampleId]&&(objectiveId==='@completion'||getExampleRecord(exampleId).objectiveIds.includes(objectiveId)),`Orphan browser check ${key}`);
  for(const field of ['date','version','environment','method','scenario','result'])assert(nonempty(b[field]),`Browser check ${key} lacks ${field}`);
  const archived=archivedPrimaryBrowserChecks[key]===b;
  assert.equal(b.version,archived?'one-press-knowledge-2026-10-31':catalogVersion.id,`Observation at ${key} must retain the build that was actually checked.`);
  if(objectiveId!=='@completion')assert.equal(getEvidence(exampleId,objectiveId).browserCheckHistorical,archived,`Incorrect historical/current flag at ${key}`);
}
// The eleven previous observations stay byte-for-byte identical to their
// published record. An additional current check must not restamp that ledger.
const digest=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
assert.equal(digest(archivedPrimaryBrowserChecks),'70212f1940faa7d457f53e041738349b50932619bdf2a0c7a83572bfaa7af7b0','A historical primary check was altered or restamped.');
assert.equal(Object.keys(archivedPrimaryBrowserChecks).length,11);
assert.equal(digest(objectives.map(o=>[o.id,o.scope])),'19b6d91ef332e70be6b12a28d38ad614f579cbc7ce24bcc2186522c1b522ee5f','The previously declared primary objective IDs or scopes changed.');
assert.equal(Object.keys(currentPrimaryBrowserChecks).filter(k=>k.includes('secondary')||k.includes('wheel')).length,0,'An extension observation leaked into the primary ledger.');

// Guard the distinctions that the earlier tag-based index lost.
assert.equal(getExampleRecord('history').scope,'tool');
assert.equal(getExampleRecord('delete').scope,'single');
assert.equal(getEvidence('delete','application.delete').scope,'single');
assert.equal(getEvidence('delete','tools.history').scope,'tool');
assert.equal(getEvidence('signals','measure.angle').status,'na','A converted output angle is not an input-angle measurement.');
assert.equal(getEvidence('repeat','response.periodic').status,'direct','Only the added shared-record comparison demonstrates temporal repetition in repeat.');
assert(getEvidence('repeat','response.periodic').source.startsWith('dist/spatial-time.js · '),'Spatial fence code alone does not establish a temporal repetition.');
assert.equal(getEvidence('repeat','contrast.distance-time').status,'direct');
assert.equal(getEvidence('time-responses','contrast.distance-time').status,'partial','A direct comparison in repeat does not promote a separate time-only panel.');
assert.equal(getEvidence('button-trace','signal.sample-readout').status,'direct');
assert.equal(getEvidence('compare-rate','measure.acceleration').status,'na','Interpreting position as output rate does not measure acceleration.');
assert(!con['button-state'].derivesFrom.length&&!con['timestamps'].derivesFrom.length);
assert(con.acceleration.derivesFrom.includes('speed')&&con.acceleration.type==='measurement');
assert(con.hysteresis.composedOf.includes('state-memory')&&con.hysteresis.type==='constraint');
const counts=arr=>arr.reduce((sum,key)=>(sum[key]=(sum[key]||0)+1,sum),{});
console.log(JSON.stringify({scope:catalogVersion.id,examples:examples.length,exampleScopes:counts(examples.map(e=>getExampleRecord(e.id).scope)),concepts:concepts.length,objectives:objectives.length,recordedPairs:evidence.length,coverage:counts(evidence.map(x=>x.status)),review:counts(evidence.map(x=>x.reviewed)),reviewedComponentFiles:sourceCache.size,check:'knowledge references, declared scope and evidence provenance; not a browser run'},null,2));
