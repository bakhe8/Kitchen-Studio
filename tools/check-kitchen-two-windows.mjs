import assert from 'node:assert/strict';
// Two windows on one project: the later save must not silently erase the earlier one (it used to: the last writer won).
// Each "window" is its own instance of the project module (own memory) over one shared localStorage, as two browser tabs have.
class Store{
 constructor(){this.mem=new Map;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
const store=globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
const listeners=[];globalThis.addEventListener=(type,fn)=>listeners.push([type,fn]);globalThis.removeEventListener=(type,fn)=>{const i=listeners.findIndex(l=>l[0]===type&&l[1]===fn);if(i>=0)listeners.splice(i,1);};
const A=await import('../public/kitchen-project.js?window=a'),B=await import('../public/kitchen-project.js?window=b');
const renamed=(doc,name)=>({...doc,room:{...doc.room,name}});
const storedName=()=>JSON.parse(store.getItem('atlas-kitchen:project:v1')).room.name;

assert(A.saveProject(A.newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'الأصل'},store)));
const docA=A.openKitchenProject(),docB=B.openKitchenProject();
assert.equal(A.projectChangedElsewhere(),false);assert.equal(B.projectChangedElsewhere(),false);

// window A saves; window B, still holding the old document, is refused instead of overwriting
const first=A.commitProject(docA,renamed(docA,'من النافذة الأولى'));assert(first.ok&&first.saved);assert.equal(storedName(),'من النافذة الأولى');
assert.equal(A.projectChangedElsewhere(),false,'the window that saved is up to date');
assert.equal(B.projectChangedElsewhere(),true);
const refused=B.commitProject(docB,renamed(docB,'من النافذة الثانية'));
assert.equal(refused.ok,false);assert.equal(refused.code,'stale-project');assert.equal(refused.reason,B.staleProjectMessage);assert.equal(refused.saved,false);
assert.equal(storedName(),'من النافذة الأولى','the earlier save survives');
assert.equal(B.undoProject(docB),null,'undo is refused too');assert.equal(B.redoProject(docB),null);
assert.equal(storedName(),'من النافذة الأولى');

// after reloading, window B holds the current document and can save again
const fresh=B.openKitchenProject();assert.equal(fresh.room.name,'من النافذة الأولى');assert.equal(B.projectChangedElsewhere(),false);
const second=B.commitProject(fresh,renamed(fresh,'بعد إعادة التحميل'));assert(second.ok&&second.saved);assert.equal(storedName(),'بعد إعادة التحميل');
assert.equal(A.projectChangedElsewhere(),true,'and now window A is the stale one');
assert.equal(A.commitProject(first.ok?renamed(docA,'من النافذة الأولى'):docA,renamed(docA,'تعديل قديم')).code,'stale-project');

// a window that changes nothing is not told off, and a single window keeps working through any number of saves
assert.deepEqual(A.commitProject(docA,docA),{ok:true,changed:false,saved:true});
let cur=A.openKitchenProject();for(let i=0;i<5;i++){const r=A.commitProject(cur,renamed(cur,'تعديل '+i));assert(r.ok&&r.saved,r.reason);cur=renamed(cur,'تعديل '+i);}
assert.equal(storedName(),'تعديل 4');assert.equal(A.projectChangedElsewhere(),false);
assert(A.undoProject(cur),'undo still works in one window');

// the "storage" event reaches only the window that did not make the change
const backgroundListeners=listeners.slice(),told=[],stop=B.watchProjectChanges(m=>told.push(m));
assert.equal(listeners.length,backgroundListeners.length+1,'The watcher installs one listener alongside shared-access monitoring.');
for(const [,fn] of listeners)fn({key:'atlas-kitchen:project:v1'});
assert.deepEqual(told,[B.staleProjectMessage]);
for(const [,fn] of listeners)fn({key:'something-else'});assert.equal(told.length,1,'other keys are ignored');
B.openKitchenProject();for(const [,fn] of listeners)fn({key:'atlas-kitchen:project:v1'});assert.equal(told.length,1,'a window that is up to date stays quiet');
stop();assert.deepEqual(listeners,backgroundListeners,'Stopping the watcher removes exactly its listener and preserves shared-access monitoring.');
console.log('PASS: two windows - the later save is refused with a reason instead of erasing the earlier one; reload recovers; one window is unaffected; storage events warn at once.');
