import assert from 'node:assert/strict';
// Whether the project has been copied out of the browser, and whether it changed after the last copy.
class Store{
 constructor(){this.mem=new Map;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
 key(i){return [...this.mem.keys()][i]??null;}
 get length(){return this.mem.size;}
}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
const {recordBackup,backupStatus,backupText,backupReminder,backupKey}=await import('../public/kitchen-backup-status.js');

// ---------- never copied out ----------
const mem=new Store,noon=Date.UTC(2026,10,3,12,15); // 15:15 in Riyadh
assert.equal(backupStatus({store:mem,projectId:'K-1',text:'a'}).state,'never');
assert.match(backupText({state:'never'}),/لم تُؤخذ نسخة احتياطية.*ضاع المشروع/);
assert.equal(backupStatus({store:mem,projectId:'',text:'a'}).state,'unknown','a project without an identity cannot be tracked');
assert.equal(backupText({state:'unknown'}),'');

// ---------- copied, then changed ----------
assert.equal(recordBackup({store:mem,projectId:'K-1',text:'a',kind:'file',now:noon}),true);
let s=backupStatus({store:mem,projectId:'K-1',text:'a'});
assert.deepEqual([s.state,s.kind,s.at],['current','file',noon]);
assert.match(backupText(s),/آخر نسخة احتياطية: ملف المشروع · ٣\s*نوفمبر.*٣:١٥.*لم يتغيّر المشروع بعدها\./);
s=backupStatus({store:mem,projectId:'K-1',text:'a, then edited'});
assert.equal(s.state,'changed');assert.match(backupText(s),/تغيّر المشروع بعدها، فخذ نسخة جديدة\./);
assert.equal(backupStatus({store:mem,projectId:'K-2',text:'a'}).state,'never','another project has its own record');
// the latest copy wins, wherever it went
recordBackup({store:mem,projectId:'K-1',text:'a, then edited',kind:'cloud',now:noon+60000});
s=backupStatus({store:mem,projectId:'K-1',text:'a, then edited'});assert.deepEqual([s.state,s.kind],['current','cloud']);
assert.match(backupText(s),/آخر نسخة احتياطية: السحابة/);

// ---------- records that cannot be trusted ----------
assert.equal(recordBackup({store:mem,projectId:'K-1',text:'a',kind:'email'}),false,'only a file or the cloud counts');
assert.equal(recordBackup({store:mem,projectId:'',text:'a',kind:'file'}),false);
assert.equal(recordBackup({store:mem,projectId:'K-1',text:null,kind:'file'}),false,'with no stored project there is nothing to compare later');
mem.setItem(backupKey('K-3'),'{not json');assert.equal(backupStatus({store:mem,projectId:'K-3',text:'a'}).state,'never','a damaged record reads as never');
mem.setItem(backupKey('K-3'),JSON.stringify({at:'yesterday',kind:'file',stamp:'x'}));assert.equal(backupStatus({store:mem,projectId:'K-3',text:'a'}).state,'never');
mem.setItem(backupKey('K-3'),JSON.stringify({at:noon,kind:'usb',stamp:'x'}));assert.equal(backupStatus({store:mem,projectId:'K-3',text:'a'}).state,'never');
const blocked={getItem(){throw new Error('storage blocked');},setItem(){throw new Error('storage blocked');}};
assert.equal(recordBackup({store:blocked,projectId:'K-1',text:'a',kind:'file'}),false,'blocked storage cannot keep the record');
assert.equal(backupStatus({store:blocked,projectId:'K-1',text:'a'}).state,'never');

// ---------- the reminder after a milestone ----------
assert.match(backupReminder({state:'never'}),/لم تُؤخذ نسخة احتياطية.*نزّل ملف المشروع من «ملف المشروع»/);
assert.match(backupReminder({state:'changed'}),/تغيّر المشروع بعد آخر نسخة احتياطية/);
assert.equal(backupReminder({state:'current'}),'');assert.equal(backupReminder({state:'unknown'}),'');

// ---------- downloading the project file records the copy ----------
const {newSurveyProject,saveProject,savedProjectText}=await import('../public/kitchen-project.js');
const {downloadFieldProject}=await import('../public/kitchen-studio-panels.js');
const saved=[],realTimeout=globalThis.setTimeout;
globalThis.document={createElement:()=>({click(){saved.push(this.download);},remove(){}}),body:{append(){}}};
URL.createObjectURL=()=>'blob:test';URL.revokeObjectURL=()=>{};
globalThis.setTimeout=(fn,ms,...rest)=>ms>=30000?0:realTimeout(fn,ms,...rest); // the download link's clean-up timer would hold the process open
const doc=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'مشروع اختبار'},globalThis.localStorage),id=doc.room.projectId;
assert.ok(id,'a new project has an identity');
assert.equal(saveProject(doc),true);
const state=()=>backupStatus({projectId:id,text:savedProjectText()}).state;
assert.equal(state(),'never','before any download');
await downloadFieldProject(doc);
assert.equal(saved.length,1);assert.match(saved[0],/مشروع اختبار-مطبخ\.json$/);
assert.equal(state(),'current','the file just made holds the project as stored');
const renamed={...doc,room:{...doc.room,name:'اسم آخر'}};assert.equal(saveProject(renamed),true);
assert.equal(state(),'changed','a later edit makes the file out of date');
await downloadFieldProject(renamed);assert.equal(state(),'current','a new file brings it up to date');
assert.equal(backupStatus({projectId:id,text:savedProjectText()}).kind,'file');
globalThis.setTimeout=realTimeout;

console.log('PASS: the project remembers when it was last copied out (file or cloud), says so plainly, flags edits made after the copy, and reminds after the customer approval or release when it was never copied.');
