import assert from 'node:assert/strict';
import {seedCatalog,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {newSurveyProject,saveProject,storedKitchenProject,openKitchenProject,commitProject,undoProject,redoProject,forgetProjectHistory} from '../public/kitchen-project.js';
import {archiveProject,readSavedProject} from '../public/kitchen-project-library.js';
import {encodeCloudProject} from '../public/kitchen-workshop-sync-ui.js';

class Store {
 constructor(){this.data=new Map();}
 get length(){return this.data.size;}
 key(i){return [...this.data.keys()][i]??null;}
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){this.data.set(k,String(v));}
 removeItem(k){this.data.delete(k);}
}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const key='atlas-kitchen:project:v1';
const legacy=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'Legacy catalog preservation'},localStorage);
const cat=seedCatalog();cat.approved=true;cat.items.forEach((i,n)=>i.price=n+1);Object.assign(cat.terms,{labor:100,installation:50,delivery:25,marginPct:10,taxPct:15});
legacy.room.workshop={catalog:cat};
const expected=JSON.parse(JSON.stringify(getFactoryCatalog(legacy)));
assert.equal(saveProject(legacy),true);
const saved=JSON.parse(localStorage.getItem(key));
assert(saved.room.workshop.storeCatalog,'local saves persist a separate store record');
assert(saved.room.workshop.factoryRecipes&&saved.room.workshop.pricingTerms);
assert.equal(Object.hasOwn(saved.room.workshop,'catalog'),false,'the compatibility view is not serialized');
let opened=openKitchenProject();
assert.deepEqual(getFactoryCatalog(opened),expected,'opening preserves the legacy business values');
assert.deepEqual(getFactoryCatalog(JSON.parse(JSON.stringify(opened))),expected,'raw split snapshots remain readable');
const changed=structuredClone(opened),flat=structuredClone(getFactoryCatalog(opened));
flat.items[0].price+=7;flat.revision++;flat.approved=false;
changed.room.workshop.catalog=flat;
const result=commitProject(opened,changed);
assert(result.ok&&result.saved&&result.next,'commit exposes the normalized next document');
assert.equal(result.next.room.workshop.storeCatalog.approved,false);
assert.equal(result.next.room.workshop.factoryRecipes.approved,true,'a price edit preserves factory approval');
assert.equal(result.next.room.workshop.pricingTerms.approved,true);
assert.equal(getFactoryCatalog(result.next).items[0].price,expected.items[0].price+7);
const undone=undoProject(result.next);assert(undone?.saved);
assert.deepEqual(getFactoryCatalog(undone.next),expected,'undo restores all three records');
const redone=redoProject(undone.next);assert(redone?.saved);
assert.equal(getFactoryCatalog(redone.next).items[0].price,expected.items[0].price+7);
assert.equal(archiveProject(redone.next).ok,true);
const archive=readSavedProject(redone.next.room.projectId);assert(archive.ok);
assert(!Object.hasOwn(archive.project.room.workshop,'catalog'));
assert.equal(getFactoryCatalog(archive.project).items[0].price,expected.items[0].price+7);
const cloud=JSON.parse((await encodeCloudProject(redone.next)).raw);
assert(cloud.design.room.workshop.storeCatalog&&!Object.hasOwn(cloud.design.room.workshop,'catalog'));
// A stale tab still cannot overwrite the newer saved three-record snapshot.
const stale=openKitchenProject();localStorage.setItem(key,localStorage.getItem(key)+' ');
const rejected=commitProject(stale,{...stale,room:{...stale.room,name:'stale'}});
assert.equal(rejected.code,'stale-project');
assert.equal(storedKitchenProject().room.name,legacy.room.name);
forgetProjectHistory();
console.log('PASS: legacy catalogs persist as three records through save/reopen, scoped edits, undo/redo, library, cloud and stale-tab protection.');
