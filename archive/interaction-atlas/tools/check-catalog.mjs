import assert from 'node:assert/strict';
import {axes,profiles,examples,exampleById,buttonExampleIds,valueById,filteredExamples} from '../dist/explorer-model.js';
import {lessons,learningRoutes} from '../dist/learning-guide.js';
import {signalLayers,discriminatingPairs} from '../dist/button-map.js';

const axisIds=['context','input','rule','constraint','timing','effect'];
assert.deepEqual(axes.map(a=>a.id),axisIds,'The teaching model has six named axes.');
assert.equal(new Set(examples.map(m=>m.id)).size,examples.length,'Duplicate example identifiers.');
assert.equal(Object.keys(profiles).length,examples.length,'Profile/catalog mismatch.');
assert.equal(valueById.size,axes.reduce((sum,a)=>sum+a.values.length,0),'Duplicate facet identifiers.');
for(const axis of axes){
  assert(axis.label&&axis.description&&axis.question,`Incomplete axis ${axis.id}`);
  for(const value of axis.values){
    assert(value.id.startsWith(axis.id+'.'),`Facet namespace ${value.id}`);
    assert(['core','extension'].includes(value.scope),`Missing scope ${value.id}`);
    assert(value.label&&value.description,`Incomplete facet ${value.id}`);
  }
}
for(const example of examples){
  const profile=profiles[example.id];assert(profile,`Missing profile ${example.id}`);
  assert(example.name&&example.title&&example.instruction,`Incomplete example ${example.id}`);
  assert(['principle','application','composition','comparison'].includes(profile.kind),`Invalid kind ${example.id}`);
  for(const axis of axisIds){
    const full=profile.axes[axis]||[],partial=profile.partial?.[axis]||[];
    assert(full.length+partial.length,`Empty axis ${example.id}/${axis}`);
    assert(profile.explanations[axis],`Missing explanation ${example.id}/${axis}`);
    assert.equal(new Set([...full,...partial]).size,full.length+partial.length,`Duplicated full/partial evidence ${example.id}/${axis}`);
    for(const id of [...full,...partial]){
      const value=valueById.get(id);assert(value,`Unknown facet ${example.id}: ${id}`);
      assert.equal(value.axis,axis,`Misclassified facet ${example.id}: ${id}`);
      assert.notEqual(value.scope,'extension',`Hardware extension incorrectly claimed by ${example.id}: ${id}`);
    }
  }
}
for(const id of ['move','pan','select','area','path','transform','value','sort','transfer','assign','signals','chain','reveal','momentum','repeat','brush','mix','timeline','elastic','gesture','threshold','flow'])assert(exampleById.has(id),`Legacy route removed: ${id}`);
for(const value of valueById.values())if(value.scope==='extension')assert.equal(filteredExamples({filters:[value.id]}).length,0,`Extension incorrectly reaches a demonstration: ${value.id}`);
assert(!exampleById.has('modifier'),'A modifier-key example is outside the one-button catalog.');
for(const id of ['input.modifier','input.pressure','input.tilt','input.multipoint'])assert(!valueById.has(id),`Extra input channel remains in the active taxonomy: ${id}`);
assert.deepEqual(filteredExamples({view:'button'}).map(m=>m.id),buttonExampleIds,'The input view must expose the two foundational demonstrations.');
assert.deepEqual(Object.keys(lessons).sort(),examples.map(m=>m.id).sort(),'Every example needs a teaching contract.');
for(const [id,lesson] of Object.entries(lessons)){
  for(const field of ['goal','tryThis','boundary'])assert(lesson[field]?.trim(),`Missing learning field ${id}/${field}`);
  assert(exampleById.has(lesson.compare?.id),`Missing comparison target for ${id}`);
  assert.notEqual(lesson.compare.id,id,`An example cannot compare only to itself: ${id}`);
  assert(lesson.compare.reason?.trim(),`Missing comparison rationale for ${id}`);
}
assert.equal(new Set(learningRoutes.map(route=>route.id)).size,learningRoutes.length,'Duplicate learning routes.');
const inRoutes=new Set();
for(const route of learningRoutes){
  assert(route.title&&route.question&&route.takeaway,`Incomplete route ${route.id}`);
  assert(route.steps.length>=2,`A comparison route needs multiple examples: ${route.id}`);
  assert.equal(new Set(route.steps.map(step=>step.id)).size,route.steps.length,`Duplicate step in ${route.id}`);
  for(const step of route.steps){assert(exampleById.has(step.id),`Unknown route step ${route.id}/${step.id}`);assert(step.why,`Missing purpose ${route.id}/${step.id}`);inRoutes.add(step.id);}
}
assert.equal(inRoutes.size,examples.length,'The learning routes must include every example.');
for(const layer of signalLayers){assert(layer.title&&layer.description&&layer.items.length,`Incomplete signal layer ${layer.id}`);for(const item of layer.items){assert(item.label&&item.detail,`Incomplete signal item ${layer.id}`);for(const id of item.examples)assert(exampleById.has(id),`Unknown signal-map example ${id}`);}}
for(const pair of discriminatingPairs){assert(pair.title&&pair.variable&&pair.keep&&pair.tryThis,`Incomplete comparison question ${pair.id}`);for(const id of pair.examples)assert(exampleById.has(id),`Unknown paired example ${id}`);}
for(const [id,facet] of [['button-trace','input.pause'],['button-phases','timing.press'],['button-phases','timing.drag-start']])assert(Object.values(profiles[id].axes).flat().includes(facet),`Missing declared foundational behavior ${id}/${facet}`);
console.log(JSON.stringify({examples:examples.length,axes:axes.length,descriptiveValues:valueById.size,lessons:Object.keys(lessons).length,learningRoutes:learningRoutes.length,signalLayers:signalLayers.length,comparisonQuestions:discriminatingPairs.length}));
