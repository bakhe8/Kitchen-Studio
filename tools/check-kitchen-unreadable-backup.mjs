import assert from 'node:assert/strict';
import * as project from '../public/kitchen-project.js';
const {newSurveyProject,saveProject,storedKitchenProject,restoreProject}=project,unreadableProjectBackups=s=>project.unreadableProjectBackups?.(s)??[];
// A saved project this version cannot read must survive the next save. Before, the first save of a new project overwrote it silently.
class Store{
 constructor(){this.mem=new Map;this.full=false;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){if(this.full&&k.includes(':unreadable:'))throw new Error('quota');this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
const store=globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
const mk=name=>newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name},store);
const projectKey='atlas-kitchen:project:v1',stored=()=>store.getItem(projectKey);
const damage=text=>{const o=JSON.parse(text);o.kitchen.units=[{id:'broken',runId:'missing-run',kind:'storage',u:0,width:-5}];return JSON.stringify(o);};

// a readable project saves without leaving any copy behind
const first=mk('الأول');assert(saveProject(first));assert(storedKitchenProject(store));assert.deepEqual(unreadableProjectBackups(store),[]);
for(let i=0;i<3;i++)assert(saveProject({...first,room:{...first.room,name:'تعديل '+i}}));
assert.deepEqual(unreadableProjectBackups(store),[],'ordinary edits never create copies');

// the stored project becomes unreadable (an invalid unit), then a new project is started: the old text is kept byte for byte
const bad=damage(stored());store.setItem(projectKey,bad);assert.equal(storedKitchenProject(store),null);
// the page keeps the text it last wrote, so make the change look like it came from elsewhere (another tab, an older version)
assert(saveProject(mk('الثاني')));
let kept=unreadableProjectBackups(store);assert.equal(kept.length,1);assert.equal(store.getItem(kept[0].key),bad,'the unreadable text is preserved exactly');assert(storedKitchenProject(store),'the new project is stored and readable');
assert.equal(restoreProject(store).room.name,'الثاني');

// saving again does not copy the (now readable) project
assert(saveProject(mk('الثالث')));assert.equal(unreadableProjectBackups(store).length,1);

// text that is not even JSON is kept too; only the newest three copies stay
for(const raw of ['{broken json one','{broken json two','{broken json three','{broken json four']){store.setItem(projectKey,raw);assert(saveProject(mk('جديد')));}
kept=unreadableProjectBackups(store);assert.equal(kept.length,3);
assert.deepEqual(kept.map(k=>store.getItem(k.key)),['{broken json two','{broken json three','{broken json four'],'oldest copies are dropped first');
assert(kept.every((k,i)=>i===0||kept[i-1].stamp<k.stamp),'copies sort oldest to newest');

// a full store must not block the save the user asked for
store.full=true;store.setItem(projectKey,'{not a project');assert(saveProject(mk('الأخير')),'saving still works when the copy cannot be written');assert(storedKitchenProject(store));
console.log('PASS: an unreadable saved project is kept (newest three) before it is replaced; readable saves leave no copies; a full store never blocks saving.');
