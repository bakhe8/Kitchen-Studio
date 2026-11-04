import assert from 'node:assert/strict';
// Wall-photo previews live in localStorage next to the project. Nothing ever removed them, and a restore that failed half way kept the photos it had
// already written, so the quota filled until not even a small edit could be saved. This check models that quota.
class Store{
 constructor(){this.mem=new Map;this.limit=Infinity;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 get used(){let n=0;for(const [k,v] of this.mem)n+=k.length+v.length;return n;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){v=String(v);const old=this.mem.get(k),next=this.used-(old===undefined?0:k.length+old.length)+k.length+v.length;if(next>this.limit)throw new Error('QuotaExceededError');this.mem.set(k,v);}
 removeItem(k){this.mem.delete(k);}
}
const store=globalThis.localStorage=new Store,session=globalThis.sessionStorage=new Store;
const jpeg=(c,n)=>'data:image/jpeg;base64,'+c.repeat(n),pre='studio-photo:';
const orphanKey=pre+'pic-'+'a'.repeat(24),usedKey=pre+'pic-'+'b'.repeat(24),sessKey=pre+'pic-'+'s'.repeat(24);
// what an earlier session left behind: one preview nothing mentions, one that a stored idea still refers to, one that only the undo history
// (session storage) refers to, and unrelated data
store.setItem(orphanKey,jpeg('A',8000));store.setItem(usedKey,jpeg('B',8000));store.setItem(sessKey,jpeg('S',1000));
store.setItem('kitchen-ideas:test',JSON.stringify({room:{photoRefs:{back:'pic-'+'b'.repeat(24)}}}));store.setItem('unrelated:data','x'.repeat(1000));
session.setItem('atlas-kitchen:undo:v1',JSON.stringify([{room:{photoRefs:{back:'pic-'+'s'.repeat(24)}}}]));
// the modules are imported only now: they note which previews already existed when the page opened
const room=await import('../public/kitchen-studio-room.js'),assets=await import('../public/kitchen-wall-photo-assets.js'),project=await import('../public/kitchen-project.js');
const doc=project.newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'الصور'},store),size=JSON.stringify(doc).length;
const keys=()=>[...store.mem.keys()].filter(k=>k.startsWith(pre)).sort();

// 1. A full store: saving the project drops the preview nothing refers to, keeps the one that is referred to, and the save goes through.
store.limit=store.used+size-4000;
assert(project.saveProject(doc),'the save succeeds after unreferenced previews are dropped');
assert.deepEqual(keys(),[usedKey,sessKey],'the orphan is gone; the previews that an idea or the undo history refer to stay');
assert.equal(store.getItem('unrelated:data').length,1000);assert(store.getItem('kitchen-ideas:test'));assert(project.storedKitchenProject(store));

// 2. A restore that fails half way leaves nothing behind (it used to keep the photos it had already written).
const A=jpeg('C',3000),B=jpeg('D',9000),before=store.used;store.limit=store.used+5000;
await assert.rejects(assets.restoreWallPhotos(doc.room,{back:A,left:B},new Map()),/ممتلئة/);
assert.deepEqual(keys(),[usedKey,sessKey],'the first photo is rolled back with the second');assert.equal(store.used,before,'the store is exactly as it was');
store.limit=Infinity;const ok=await assets.restoreWallPhotos(doc.room,{back:A,left:jpeg('D',100)},new Map());
assert.equal(Object.keys(ok.photoRefs).length>=2,true);assert.equal(keys().length,4,'a successful restore keeps both photos');

// 3. A preview written during this session is never dropped, even when nothing refers to it yet (its project may not be saved).
const mine=pre+'pic-'+'c'.repeat(24);assert(room.setStoredPhoto(mine,jpeg('E',2000)));
const bigger={...doc,room:{...doc.room,name:'x'.repeat(5000)}};store.limit=store.used+100;
assert.equal(project.saveProject(bigger),false,'nothing can be freed, so the save still fails honestly');assert(store.getItem(mine),'the session preview survives');

// 4. A preview that was stored before but written again now belongs to this session.
store.limit=Infinity;assert(room.setStoredPhoto(usedKey,jpeg('B',8000)));store.removeItem('kitchen-ideas:test');
store.limit=store.used+100;assert.equal(project.saveProject(bigger),false);assert(store.getItem(usedKey),'a re-written preview is protected');

console.log('PASS: photo previews - an orphan is dropped when the store is full; previews referred to by an idea, the undo history, or written this session are kept; a half-done restore leaves nothing.');
