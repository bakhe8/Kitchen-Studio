import assert from 'node:assert/strict';
import {cleanDeliveryObservation,deliveryObservations} from '../public/kitchen-delivery-domain.js';

const unit={id:'unit-1',checks:[{key:'width',nominal:600,unit:'مم'},{key:'height',nominal:800,unit:'مم'},{key:'depth',nominal:560,unit:'مم'}]};
const input={text:'  TEST scratch on front  ',severity:'blocking',anchor:{kind:'front',x:.25,y:.6}};
const clean=cleanDeliveryObservation(unit,input);assert.deepEqual(clean,{...input,text:'TEST scratch on front'});
assert.deepEqual(input.text,'  TEST scratch on front  ');clean.anchor.x=1;assert.equal(input.anchor.x,.25);
for(const bad of [null,{},[],{...input,id:'forged'},{...input,severity:'severe'},{...input,text:''},{...input,text:'a'.repeat(501)},{...input,anchor:{kind:'front',x:'0.3',y:.4}},{...input,anchor:{kind:'front',x:NaN,y:.4}},{...input,anchor:{kind:'front',x:-.1,y:.4}},{...input,anchor:{kind:'front',x:1.1,y:.4}},{...input,anchor:{kind:'front',x:.1,y:.4,unit:'unit-2'}}])assert.equal(cleanDeliveryObservation(unit,bad),null);
assert(cleanDeliveryObservation(unit,{...input,anchor:{kind:'front',x:0,y:1}}));
const surface={id:'surface:top',checks:[{key:'edge-0',nominal:500,unit:'مم'}]};
assert.equal(cleanDeliveryObservation(surface,input),null);
assert.equal(cleanDeliveryObservation({...unit,checks:unit.checks.map(c=>c.key==='height'?{...c,nominal:0}:c)},input),null);
assert.deepEqual(cleanDeliveryObservation(surface,{...input,severity:'info',anchor:{kind:'check',key:'edge-0'}}),{text:'TEST scratch on front',severity:'info',anchor:{kind:'check',key:'edge-0'}});
assert.equal(cleanDeliveryObservation(surface,{...input,anchor:{kind:'check',key:'width'}}),null);
assert.equal(cleanDeliveryObservation(unit,{...input,anchor:{kind:'check',key:'edge-0'}}),null);
assert.equal(cleanDeliveryObservation(unit,{...input,anchor:{kind:'check',key:'width',x:0}}),null);
console.log('PASS observation validation: exact schema, released checks, front eligibility, finite bounds, text and immutability');

const observation={id:'request-note-0001',...cleanDeliveryObservation(unit,input)};
const events=[{unit:unit.id,seq:4,action:'observe',state:'packed',data:{observation}},{unit:'unit-2',seq:4,action:'resolve',state:'packed',data:{observationId:observation.id,note:'Wrong unit'}},{unit:unit.id,seq:5,action:'install',state:'installed',data:{note:'Private note'}}];
const before=JSON.stringify(events),open=deliveryObservations(events);assert.equal(open.length,1);assert.equal(open[0].resolved,false);assert.equal(open[0].resolution,null);assert.equal(open[0].unit,unit.id);
events.push({unit:unit.id,seq:6,action:'resolve',state:'installed',data:{observationId:observation.id,note:'  TEST repaired and rechecked  '}});
const resolved=deliveryObservations(events);assert.equal(resolved[0].resolved,true);assert.equal(resolved[0].resolution,'TEST repaired and rechecked');
assert.equal(JSON.stringify(events.slice(0,3)),before);resolved[0].anchor.x=1;assert.equal(observation.anchor.x,.25);
assert.equal(deliveryObservations([{unit:unit.id,action:'resolve',data:{observationId:'missing',note:'unused'}}]).length,0);
assert.equal(deliveryObservations([{unit:unit.id,action:'observe',data:{observation:{...observation,severity:'bogus'}}}]).length,0);
assert.deepEqual(deliveryObservations(null),[]);
console.log('PASS event projection: immutable open/resolved observations, unit isolation and private-note exclusion');
