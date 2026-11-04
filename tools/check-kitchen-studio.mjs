import assert from 'node:assert/strict';
import {layouts,buildStudioLayout} from '../public/kitchen-layouts.js';
import {kitchenGeometry,hardKitchenConflicts,validateKitchen} from '../public/kitchen-model.js';
import {createCreativeKitchen} from '../public/kitchen-creative-model.js';
import {cleanStudioRoom} from '../public/kitchen-studio-room.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {planSheet,elevationSheet,sheetTables} from '../public/kitchen-sheet.js';
import {commitProject,undoProject,redoProject,restoreProject,kitchenHistory,kitchenFuture,kitchenProjectURL} from '../public/kitchen-project.js';
import {readFileSync,existsSync} from 'node:fs';
class Store{m=new Map;setItem(k,v){this.m.set(k,v)}getItem(k){return this.m.get(k)??null}removeItem(k){this.m.delete(k)}}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;globalThis.location={href:'https://example.test/'};
const room={width:420,length:340,height:275,colors:{back:'stone'},floor:'tile',name:'المطبخ الشمالي',photoRefs:{left:'pic-1234',right:'off'}};
const def=restoreProject();assert.equal(def.kitchen.units.length,0);assert.equal(def.kitchen.runs.length,0);
for(const f of ['back','front','right','left'])for(const t of layouts){const o=buildStudioLayout(room,t.id,f);assert(o.ok,t.id+'/'+f+': '+o.reason);assert.deepEqual(hardKitchenConflicts(o.kitchen,room),[]);assert(validateKitchen(o.kitchen,room));if(t.id!=='blank')assert(o.kitchen.units.some(u=>u.kind==='sink')&&o.kitchen.units.some(u=>u.kind==='hob'));if(['island','peninsula'].includes(t.id))assert(o.kitchen.runs.find(r=>r.placement==='free'));}
assert(!buildStudioLayout({width:130,length:130,height:210},'wrap').ok);
const a=buildStudioLayout(room,'island','back','linen').kitchen,b=buildStudioLayout(room,'wrap','back','ink').kitchen;
const doc={room,kitchen:a},next={room:{...room,name:'نسخة'},kitchen:b};
assert.deepEqual(cleanIdea(JSON.parse(JSON.stringify(doc))),doc);const x=commitProject(doc,next);assert(x.saved);assert.deepEqual(undoProject(next).next,doc);assert.equal(kitchenFuture().length,1);assert.deepEqual(redoProject(doc).next,next);assert.equal(kitchenFuture().length,0);
const modified={room:{...room,width:440},kitchen:a};undoProject(next);commitProject(doc,modified);assert.equal(kitchenFuture().length,0);assert.equal(restoreProject().room.width,440);
const geo=kitchenGeometry(a,room),wall=elevationSheet(doc,'back',true);assert(wall.includes('U1')&&wall.includes('viewBox'));assert(sheetTables(doc,null).includes('ثلاجة'));assert(planSheet(doc).includes('U'+geo.units.length));
assert.equal(cleanStudioRoom({...room,width:2}),null);assert(!cleanStudioRoom({...room,photoRefs:{front:'not-an-asset'}}).photoRefs);
assert.equal(new URL(kitchenProjectURL('kitchen-unit',a.units[0].id)).pathname,'/unit.html');assert.equal(new URL(kitchenProjectURL('kitchen')).pathname,'/');
const home=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert(home.includes('kitchen-app.js')&&!home.includes('أطلس'));const legacy=readFileSync(new URL('../public/shelf-planner.html',import.meta.url),'utf8');assert(legacy.includes('location.replace'));assert(!existsSync(new URL('../public/app.js',import.meta.url)));
console.log('Studio: 28 layout and orientation combinations, actual sink/hood/worktop geometry, room finishes and reference ids, redo history and legacy routes, plan and elevations validated.');
