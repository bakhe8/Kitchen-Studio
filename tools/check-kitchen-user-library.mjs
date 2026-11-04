import assert from 'node:assert/strict';
import {createUserTemplate,cleanUserTemplate,exportUserTemplates,readUserTemplates,mergeUserTemplates,placeUserTemplate,userTemplateSlots} from '../public/kitchen-user-library.js';
import {createKitchen,addRun,addUnit,addFeature,updateUnit,kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
import {shapeForUnit} from '../public/kitchen-project.js';
import {splitTarget,setScopedContent} from '../public/shelf-selection-model.js';
const room={width:360,length:300,height:260},base=r=>({room:r,kitchen:createKitchen(r,'empty')});
const put=o=>{assert(o.ok,o.reason);return o.kitchen;};
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const source=base(room);source.kitchen=put(addRun(source.kitchen,room,{id:'original-upper',wall:'back',tier:'upper',start:15,end:290}));
source.kitchen=put(addUnit(source.kitchen,room,{id:'original-cupboard',kind:'storage',runId:'original-upper',u:51,width:64.875,frontFinish:'teak',frontColor:'#3456a1',frontStyle:'fluted',handleStyle:'knob',doorHanding:'right',open:true}));
let u=source.kitchen.units[0],shape=shapeForUnit(u,kitchenGeometry(source.kitchen,room).units[0]);
const split=splitTarget(shape,{kind:'cell',key:'0:0'},'col');assert(split.ok);
shape=setScopedContent(split.plan,'0:0/0','vase');source.kitchen=put(updateUnit(source.kitchen,room,u.id,{detail:shape}));
u=source.kitchen.units[0];freeze(source);const savedOriginal=JSON.stringify(source);
const made=createUserTemplate(source,u.id,'  خزانتي اليمنى  ','unit-template-1');assert(made.ok);const t=made.template;
assert.equal(t.name,'خزانتي اليمنى');assert.deepEqual(t.reference,{tier:'upper',height:70,depth:34});
for(const attr of ['width','frontFinish','frontColor','handleStyle','frontStyle','doorHanding'])assert.equal(t.unit[attr],u[attr]);
assert.deepEqual(t.unit.detail,u.detail);assert.notEqual(t.unit.detail.cellGrids['0:0'].children,u.detail.cellGrids['0:0'].children);
for(const attr of ['runId','u','open','id'])assert(!Object.hasOwn(t.unit,attr));
assert(!createUserTemplate(source,'some-unrelated-id','مقترح').ok);assert(!createUserTemplate(source,u.id,'   ').ok);
const file=exportUserTemplates([t]);assert(file&&!file.includes('original-upper')&&!file.includes('original-cupboard'));
const recovered=readUserTemplates(file);assert(recovered.ok);assert.deepEqual(recovered.templates,[t]);assert.notEqual(recovered.templates[0].unit.detail,t.unit.detail);
const injected=JSON.parse(file);injected.templates[0].project={secret:42};injected.templates[0].unit.u=999;
injected.templates[0].unit.detail.room={arbitrary:'data'};
assert.deepEqual(readUserTemplates(JSON.stringify(injected)).templates,[t]);
const collision=structuredClone(t);collision.name='نموذجي الثاني';
const merged=mergeUserTemplates([t],[collision]);assert.equal(merged.count,1);assert.notEqual(merged.templates[1].id,t.id);
assert.equal(mergeUserTemplates(merged.templates,[collision,t]).count,0);
assert.equal(mergeUserTemplates([t],Array.from({length:32},(_,i)=>({...t,name:'جديد '+i,id:'x-'+i}))).ok,false);
for(const poison of [d=>d.version=37,d=>d.templates[0].unit.width=-7,d=>d.templates[0].unit.kind='unknown',
  d=>d.templates[0].unit.frontColor='url(#paint)',d=>d.templates[0].unit.doorHanding='all',
  d=>d.templates[0].unit.detail.cellGrids['0:0'].children[0].content='not-furniture',
  d=>d.templates.push(structuredClone(d.templates[0]))]){
  const bad=JSON.parse(file);poison(bad);assert(!readUserTemplates(JSON.stringify(bad)).ok);
}
assert(!readUserTemplates('not json').ok);assert(!readUserTemplates(' '.repeat(2_000_001)).ok);assert(!cleanUserTemplate({...t,id:'<iframe>'}));
// Another kitchen, unrelated room and row IDs; a window blocks the first
// dimensional gap. An explicit coordinate must never be moved silently.
const dest=base({...room,width:415});dest.kitchen=put(addRun(dest.kitchen,dest.room,{id:'another-wall',wall:'back',tier:'upper',start:0,end:350,height:76,depth:37}));
dest.kitchen=put(addFeature(dest.kitchen,dest.room,{id:'existing-window',kind:'window',wall:'back',u:0,width:104,bottom:140,height:65}));
const slots=userTemplateSlots(dest,t,'another-wall');assert(slots.length&&!slots.some(a=>a.start<=17&&17<=a.end));
const rejected=placeUserTemplate(dest,t,'another-wall',17);assert(!rejected.ok&&rejected.kitchen===dest.kitchen);assert.equal(rejected.conflict.type,'body-feature');
const accepted=placeUserTemplate(dest,t,'another-wall');assert(accepted.ok&&accepted.changed);const a=accepted.kitchen.units.find(u=>u.id===accepted.id);
assert.equal(a.u,slots[0].start);assert(!a.open);assert.equal(a.width,t.unit.width);assert.deepEqual(a.detail,t.unit.detail);assert.notEqual(a.detail,t.unit.detail);
const stored=JSON.stringify(t),planned=JSON.stringify(accepted.kitchen);const changed=put(updateUnit(accepted.kitchen,dest.room,a.id,{frontFinish:'walnut',doorHanding:'left',detail:setScopedContent(a.detail,'0:0/0','plant')}));
assert.equal(changed.units[0].detail.cellGrids['0:0'].children[0].content,'plant');assert.equal(JSON.stringify(t),stored);assert.equal(JSON.stringify(accepted.kitchen),planned);
assert.equal(JSON.stringify(source),savedOriginal);assert.deepEqual(validateKitchen(accepted.kitchen,dest.room),accepted.kitchen);
// A purchased-size reference cannot be smuggled in with a different stored
// height; genuine fixed-size appliances survive transfer at their real size.
const rejectedRef={...t,unit:{kind:'fridge',width:90,interior:{shelves:0,dividers:0}},reference:{tier:'base',height:70,depth:34}};
assert.equal(cleanUserTemplate(rejectedRef),null);
console.log('User library: selected real unit, optional handing/finish, detached nested interior, validated JSON export/import, safe merge, measured slots and immutable transfer to another kitchen passed.');
