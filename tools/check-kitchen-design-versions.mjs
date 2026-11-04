import assert from 'node:assert/strict';
// Customer-approved versions of the design and the record of changes after approval (the data dictionary's INS-07).
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {approvalState,cleanWorkshop} from '../public/kitchen-workshop-state.js';
import {cleanStudioRoom} from '../public/kitchen-studio-room.js';
import {cleanVersions,versionLimit,versionUnitLimit} from '../public/kitchen-design-version-clean.js';
import {unitSnapshot,diffUnits,describeChanges,hasUnitChanges,priceChange,recordCustomerVersion,versionsCardHTML,reasonFieldHTML,changeSheetHTML,sheetFor} from '../public/kitchen-design-versions.js';
import {downloadCustomerReport} from '../public/kitchen-report-preview.js';
import {encodeCloudProject,decodeCloudProject} from '../public/kitchen-workshop-sync-ui.js';
import {kitchenWorkGuide} from '../public/kitchen-work-guide.js';
import {confirmFixtureFitout} from './fixture-kitchen-fitout.mjs';

const mk=()=>{
 const room=makeChainExample();
 const run=planWorkshopRow(room,{wall:'back',tier:'base',startMm:1300,endMm:4300,rice:false,dishwasher:false,sink:false});
 const cat=run.doc.room.workshop.catalog??=seedCatalog();
 cat.approved=true;cat.items.forEach(i=>{i.price=i.kind==='piece'?5:10;});
 Object.assign(cat.terms,{labor:100,installation:50,delivery:30,marginPct:10,taxPct:15,worktop:'separate'});
 confirmFixtureFitout(run.doc);
 return run.doc;
};
const withApprovals=(doc,approvals)=>({...doc,room:{...doc.room,workshop:{...doc.room.workshop,approvals:{...doc.room.workshop.approvals,...approvals}}}});
const stamp=(key,name='م')=>({name,key,date:'2026-11-03T10:00:00.000Z'});
const widen=(doc,mmDelta)=>{
 const next=structuredClone(doc),u=next.kitchen.units.find(v=>next.room.workshop.rows['run-1'].units.some(e=>e.id===v.id));
 u.width+=mmDelta/10;next.room.workshop.rows['run-1'].units.find(e=>e.id===u.id).widthMm+=mmDelta;return next;
};
const hex=c=>c.repeat(64);

// ---------- what is saved ----------
const unit=(id,over={})=>({id,code:'U1',label:'خزانة تخزين',wall:'back',tier:'base',startMm:0,widthMm:600,front:'',...over});
const good=(n,over={})=>({n,date:'2026-11-03T10:00:00.000Z',name:'العميل أحمد',key:hex('a'),total:1000.5,reason:n>1?'توسيع الوحدة':'',released:false,units:[unit('u1')],...over});
assert.deepEqual(cleanVersions([]),[]);
assert.deepEqual(cleanVersions([good(1),good(2)]).map(v=>v.n),[1,2]);
assert.equal(cleanVersions([good(1)])[0].total,1000.5);assert.equal(cleanVersions([good(1,{total:null})])[0].total,null);
for(const [label,list] of [['numbered from 2',[good(2)]],['a gap',[good(1),good(3)]],['bad key',[good(1,{key:'xyz'})]],['no name',[good(1,{name:' '})]],['bad date',[good(1,{date:'yesterday'})]],
 ['negative total',[good(1,{total:-1})]],['long reason',[good(1,{reason:'ل'.repeat(401)})]],['released not boolean',[good(1,{released:'yes'})]],['units not a list',[good(1,{units:'u'})]],
 ['duplicate unit',[good(1,{units:[unit('u1'),unit('u1')]})]],['bad tier',[good(1,{units:[unit('u1',{tier:'middle'})]})]],['fractional width',[good(1,{units:[unit('u1',{widthMm:60.5})]})]],
 ['__proto__ id',[good(1,{units:[unit('__proto__')]})]],['not an array',{}],
 ['too many versions',Array.from({length:versionLimit+1},(_,i)=>good(i+1))],['too many units',[good(1,{units:Array.from({length:versionUnitLimit+1},(_,i)=>unit('u'+i))})]]])
 assert.equal(cleanVersions(list),null,label+' is refused');
assert.equal(cleanWorkshop({versions:[good(1)]}).versions[0].name,'العميل أحمد','the project validator keeps the versions');
assert.equal(cleanWorkshop({versions:[good(2)]}),null,'and refuses a damaged list instead of dropping it');
assert.equal(cleanWorkshop({}).versions,undefined);

// ---------- a first approval writes version 1 ----------
let doc=mk();
doc=withApprovals(doc,{structure:stamp(hex('0'))});            // placeholder; the real key is computed next
let state=await approvalState(doc);doc=withApprovals(doc,{structure:stamp(state.keys.structure)});
state=await approvalState(doc);
assert(state.valid.structure&&state.quote.complete,'the fixture is a priced, structure-approved design');
const snapshot=unitSnapshot(doc);
assert(snapshot.length>=1,'the fixture has units');assert.equal(snapshot[0].code,'U1');assert(Number.isInteger(snapshot[0].widthMm)&&snapshot[0].widthMm>0&&Number.isInteger(snapshot[0].startMm),'a unit snapshot is in whole millimetres');assert(['back','right','front','left'].includes(snapshot[0].wall)&&snapshot[0].tier==='base','and names its wall and level');assert.equal(new Set(snapshot.map(u=>u.code)).size,snapshot.length);
const first=recordCustomerVersion({doc,state,name:'العميل أحمد',date:'2026-11-03T10:00:00.000Z'});
assert(first.ok,first.reason);assert.equal(first.version.n,1);assert.equal(first.version.reason,'');assert.equal(first.version.total,Math.round(state.quote.total*100)/100);assert.equal(first.version.released,false);
assert.equal(first.doc.room.workshop.approvals.customer.key,state.keys.customer);assert.equal(first.doc.room.workshop.versions.length,1);
assert(cleanVersions(first.doc.room.workshop.versions),'what it writes passes the validator');
assert.deepEqual(cleanStudioRoom(first.doc.room).workshop.versions,first.doc.room.workshop.versions,'and survives loading the project');
let approved=first.doc;state=await approvalState(approved);
assert(state.valid.customer);
const again=recordCustomerVersion({doc:approved,state,name:'العميل أحمد'});assert.equal(again.ok,false);assert.match(again.reason,/معتمد بالفعل/,'the same design is not approved twice');

// ---------- a change after approval needs its reason, and is described ----------
const changed=widen(approved,100);
const state2=await approvalState(changed);
assert.notEqual(state2.keys.customer,state.keys.customer);assert.equal(state2.valid.customer,false,'the earlier approval turns stale');
const noReason=recordCustomerVersion({doc:changed,state:state2,name:'العميل أحمد',reason:'  '});assert.equal(noReason.ok,false);assert.match(noReason.reason,/اكتب سبب التعديل/);
const second=recordCustomerVersion({doc:changed,state:state2,name:'العميل أحمد',reason:'يريد العميل وحدة أوسع بجانب الموقد',date:'2026-11-05T09:00:00.000Z'});
assert(second.ok,second.reason);assert.equal(second.version.n,2);assert.equal(second.version.reason,'يريد العميل وحدة أوسع بجانب الموقد');
assert.equal(second.doc.room.workshop.versions.length,2);assert.equal(second.doc.room.workshop.versions[0].n,1,'the earlier version is kept as it was');
assert.deepEqual(second.doc.room.workshop.versions[0],approved.room.workshop.versions[0]);
const labels=new Map([['back','الجدار الخلفي'],['right','الجدار الأيمن'],['front','الجدار الأمامي'],['left','الجدار الأيسر']]);
const diff=diffUnits(first.version.units,second.version.units),said=describeChanges(diff,labels);
assert.equal(diff.resized.length,1,'exactly the widened unit is reported');assert(said.lines.some(l=>/^تغيّر عرض U\d+ «.+» من .+ إلى .+/.test(l)),said.lines.join(' | '));
assert.equal(diff.added.length+diff.removed.length+diff.retyped.length+diff.refinished.length+diff.moved.length,0);
const price=priceChange(first.version.total,second.version.total);assert(price.delta>0,'a wider cabinet costs more: '+price.text);assert.match(price.text,/^زيادة /);
// a release approval that existed before the change is remembered on the version
const releasedDoc=withApprovals(changed,{release:stamp(hex('9'),'مسؤول الورشة')});
const flagged=recordCustomerVersion({doc:releasedDoc,state:await approvalState(releasedDoc),name:'العميل أحمد',reason:'تعديل بعد التصنيع'});
assert(flagged.ok&&flagged.version.released===true);

// ---------- describing changes ----------
const a=[unit('a',{code:'U1',startMm:0}),unit('b',{code:'U2',startMm:600}),unit('c',{code:'U3',startMm:1200,front:'أبيض'}),unit('d',{code:'U4',startMm:1800}),unit('e',{code:'U5',startMm:2400,label:'أدراج'})];
const b=[unit('a',{code:'U1',startMm:0,widthMm:700}),unit('b',{code:'U2',startMm:700}),unit('c',{code:'U3',startMm:1300,front:'رمادي'}),unit('e',{code:'U4',startMm:1900,label:'خزانة تخزين',wall:'right',tier:'upper'}),unit('f',{code:'U5',startMm:2500,widthMm:450})];
const d=diffUnits(a,b),lines=describeChanges(d,labels).lines;
assert(hasUnitChanges(d));assert.equal(hasUnitChanges(diffUnits(a,a)),false,'no change, nothing to say');
assert(lines.includes('تغيّر عرض U1 «خزانة تخزين» من ٦٠٠ مم إلى ٧٠٠ مم'),lines.join(' | '));
assert(lines.some(l=>l.startsWith('أُضيفت «خزانة تخزين» (٤٥٠ مم) على الجدار الخلفي · سفلي')));
assert(lines.some(l=>l.startsWith('أُزيلت «خزانة تخزين» (U4، ٦٠٠ مم) من الجدار الخلفي · سفلي')));
assert(lines.some(l=>l==='تغيّرت واجهة U3 من «أبيض» إلى «رمادي»'));
assert(lines.some(l=>l.includes('تغيّر نوع U4 من «أدراج» إلى «خزانة تخزين»')));
assert(lines.some(l=>l.includes('انتقلت U4')&&l.includes('الجدار الأيمن · علوي')));
assert(lines.some(l=>l==='تزحزح موضع وحدة واحدة على جدارها بسبب التعديلات')||lines.some(l=>l.startsWith('تزحزح موضع')),'units that only slid are counted, not listed one by one');
// the same change on several units is one line
const white=Array.from({length:5},(_,i)=>unit('w'+i,{code:'U'+(i+1),startMm:i*600,front:'أبيض'})),grey=white.map(u=>({...u,front:'رمادي'}));
const together=describeChanges(diffUnits(white,grey),labels).lines;
assert.deepEqual(together,['تغيّرت واجهة ٥ وحدات من «أبيض» إلى «رمادي» (U1، U2، U3، U4، U5)'],'all the fronts changed together: one line');
const mixed=describeChanges(diffUnits(white,grey.map((u,i)=>i<2?u:{...u,front:'أخضر'})),labels).lines;
assert.equal(mixed.length,2,'two different changes: two lines');assert(mixed[0].includes('وحدتان')&&mixed[1].includes('٣ وحدات'));
const many=diffUnits(Array.from({length:30},(_,i)=>unit('o'+i)),[]),big=describeChanges(many,labels);
assert.equal(big.lines.length,12);assert.equal(big.more,18,'a large change lists the first lines and counts the rest');
assert.equal(priceChange(null,100).delta,null);assert.match(priceChange(null,100).text,/بانتظار/);assert.equal(priceChange(100,100).text,'بقي السعر كما هو');assert.match(priceChange(120,100).text,/^انخفاض /);

// ---------- the card ----------
const fresh=mk(),freshState=await approvalState(fresh);
let html=versionsCardHTML({doc:fresh,state:freshState,quote:freshState.quote});
assert.match(html,/لا إصدار معتمد/);assert.match(html,/يبدأ سجل الإصدارات/);assert.equal(reasonFieldHTML({doc:fresh,state:freshState}),'');
const legacy=withApprovals(approved,{});delete legacy.room.workshop.versions;
html=versionsCardHTML({doc:legacy,state,quote:state.quote});assert.match(html,/بلا لقطة للمقارنة/);
html=versionsCardHTML({doc:approved,state,quote:state.quote});
assert.match(html,/الإصدار ١ معتمد/);assert.match(html,/لا توجد تغييرات منذ هذا الإصدار/);assert.doesNotMatch(html,/data-version="pending"/);assert.doesNotMatch(html,/data-version="1"/,'version 1 has no change sheet');
assert.equal(reasonFieldHTML({doc:approved,state}),'','no reason is asked while nothing changed');
html=versionsCardHTML({doc:changed,state:state2,quote:state2.quote});
assert.match(html,/تعديل بانتظار الاعتماد/);assert.match(html,/ما تغيّر منذ الإصدار ١/);assert.match(html,/<li>تغيّر عرض U\d+/);assert.match(html,/class="dv-price"/);assert.match(html,/زيادة /);assert.match(html,/data-version="pending"/);assert.doesNotMatch(html,/dv-warn/);
assert.match(reasonFieldHTML({doc:changed,state:state2}),/<textarea data-ws-reason/);
html=versionsCardHTML({doc:releasedDoc,state:await approvalState(releasedDoc),quote:state2.quote});assert.match(html,/dv-warn[^>]*>سبق إطلاق إصدار للتصنيع/);
html=versionsCardHTML({doc:second.doc,state:await approvalState(second.doc),quote:state2.quote});
assert.match(html,/سجل الإصدارات \(٢\)/);assert.match(html,/السبب: يريد العميل وحدة أوسع بجانب الموقد/);assert.match(html,/data-version="2"/);
assert(html.indexOf('الإصدار ٢')<html.indexOf('الإصدار ١'),'newest first');

// ---------- text from people is text, never markup ----------
const hostile=structuredClone(second.doc);hostile.room.name='<img src=x onerror=alert(1)>';
hostile.room.workshop.versions[1].name='<script>alert(1)</script>';hostile.room.workshop.versions[1].reason='<b onclick=x>سبب</b> & "اقتباس"';
const hs=await approvalState(hostile);
for(const out of [versionsCardHTML({doc:hostile,state:hs,quote:hs.quote}),sheetFor({doc:hostile,state:hs,quote:hs.quote,which:'2'}),sheetFor({doc:hostile,state:hs,quote:hs.quote,which:'pending',reason:'<i>x</i>'})]){
 assert(!/<img src=x|<script>alert|<b onclick|<i>x<\/i>/.test(out),'markup from names and reasons is escaped');
}

// ---------- the sheet ----------
const sheet=sheetFor({doc:second.doc,state:await approvalState(second.doc),quote:state2.quote,which:'2'});
assert.match(sheet,/<body data-design-revision="D-[A-F0-9]{14}" data-report-name="ورقة-تعديل-المطبخ-الإصدار-2" data-report-title="معاينة ورقة التعديل">/);
for(const piece of ['ورقة تعديل بعد الاعتماد','الإصدار ٢ بدل الإصدار ١','معتمد من العميل','وافق باسم العميل العميل أحمد','سبب التعديل','يريد العميل وحدة أوسع بجانب الموقد','ما الذي تغيّر','تغيّر عرض U','أثر السعر','السعر المعتمد سابقًا','السعر بعد التعديل','الفرق','اسم العميل وتوقيعه'])assert(sheet.includes(piece),'the sheet says: '+piece);
assert(!sheet.includes('سبق إطلاق إصدار للتصنيع'),'no release warning when nothing was released');
const pending=sheetFor({doc:changed,state:state2,quote:state2.quote,which:'pending',reason:'طلب العميل تغيير العرض'});
assert.match(pending,/تعديل مقترح بانتظار موافقة العميل/);assert.match(pending,/طلب العميل تغيير العرض/);assert.doesNotMatch(pending,/وافق باسم العميل/);assert.match(pending,/الإصدار ٢ بدل الإصدار ١/);
assert.match(sheetFor({doc:releasedDoc,state:await approvalState(releasedDoc),quote:state2.quote,which:'pending'}),/سبق إطلاق إصدار للتصنيع/);
assert.equal(sheetFor({doc:second.doc,state,quote:state.quote,which:'9'}),null,'an unknown version has no sheet');
assert.equal(sheetFor({doc:second.doc,state,quote:state.quote,which:'1'})!==null,true);

// ---------- the record travels with the project (cloud copy and project file) ----------
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i]??null,get length(){return store.size;}};
const packed=await encodeCloudProject(second.doc);
assert(packed.raw.includes('يريد العميل وحدة أوسع بجانب الموقد'),'the reason is in the copy that is sent');
const opened=await decodeCloudProject(JSON.parse(packed.raw));
assert.deepEqual(opened.room.workshop.versions,second.doc.room.workshop.versions,'opening that copy brings every version back');
assert.equal(opened.room.workshop.approvals.customer.name,'العميل أحمد');

// ---------- the project guide asks the right question ----------
const customerTask=async d=>{const r=await kitchenWorkGuide(d);return [r.current,...r.tasks,...r.later].find(t=>t?.id==='production:customer');};
const firstAsk=await customerTask(doc);
assert.equal(firstAsk.question,'هل يعتمد العميل التصميم وعرضه الحالي؟','before any version: the ordinary question');
// a width change also unsettles the structure approval; once the structure is approved again the question about the change appears
assert.equal(await customerTask(changed),undefined,'the structure is asked about first');
const restamped=withApprovals(changed,{structure:stamp((await approvalState(changed)).keys.structure)});
const changeAsk=await customerTask(restamped);
assert.equal(changeAsk.question,'هل يوافق العميل على التعديل الجديد؟','after a version: the question is about the change');
assert.match(changeAsk.why,/بعد الإصدار ١ المعتمد/);assert.match(changeAsk.why,/سبب التعديل/);

// ---------- the file name follows the page ----------
const link={click(){},remove(){}};let revoked=0;
globalThis.document={createElement:()=>link,body:{append(){}}};globalThis.URL.createObjectURL=()=>'blob:x';globalThis.URL.revokeObjectURL=()=>{revoked++;};
downloadCustomerReport(sheet);assert.match(link.download,/^ورقة-تعديل-المطبخ-الإصدار-2-D-[A-F0-9]{14}\.html$/);
downloadCustomerReport('<body data-design-revision="D-0123456789ABCD">عرض</body>');assert.equal(link.download,'عرض-تصميم-المطبخ-D-0123456789ABCD.html','the customer report keeps its own name');

console.log('PASS: the customer approval writes numbered versions; a change after approval needs its reason and is listed with its price effect; the card and the sheet say it plainly and escape names and reasons; the project keeps the record.');
