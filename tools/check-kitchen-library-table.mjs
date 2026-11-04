import assert from 'node:assert/strict';
// A library as a table: the template, the export, and the import that reports every bad row before keeping any.
import {libraryDefs} from '../public/kitchen-library-defs.js';
import {createLibraryStore,memoryAdapter} from '../public/kitchen-library-store.js';
import {libraryColumns,templateRows,detectColumns,exportRows,toCSV,previewImport,applyImport,maxImportRows} from '../public/kitchen-library-table.js';
import {parseWorkshopTable} from '../public/kitchen-workshop-spreadsheet.js';

const fresh=()=>createLibraryStore({adapter:memoryAdapter(),now:()=>'2026-11-03T12:00:00.000Z'});
const head=['الاسم','الفئة','الماركة','رقم الموديل','العرض · جسم الجهاز','الارتفاع · جسم الجهاز','العمق · جسم الجهاز','العرض · حيز التركيب شامل الخلوص','الارتفاع · حيز التركيب شامل الخلوص','العمق · حيز التركيب شامل الخلوص','السعر','الحالة'];
const map=lib=>detectColumns(lib,head);

// ---------- the template ----------
const cols=libraryColumns('appliance');
assert.deepEqual(cols.slice(0,3).map(c=>c.key),['id','label','family']);assert.deepEqual(cols.slice(-3).map(c=>c.key),['price','status','note']);
assert.equal(cols.length,3+libraryDefs.appliance.fields.length+3);assert.deepEqual(templateRows('appliance')[0],cols.map(c=>c.label));
assert.deepEqual(libraryColumns('nonsense'),[]);
assert.deepEqual(map('appliance'),['label','family','attrs.brand','attrs.model','attrs.bodyWidthMm','attrs.bodyHeightMm','attrs.bodyDepthMm','attrs.spaceWidthMm','attrs.spaceHeightMm','attrs.spaceDepthMm','price','status'],'headers are recognised by their Arabic names');
assert.deepEqual(detectColumns('sink',['Name','Type','Price','Notes','???']),['label','family','price','note',''],'English headers work too and an unknown one is left unmapped');
assert.deepEqual(detectColumns('hardware',['رمز المورد','وحدة الشراء']),['attrs.code','attrs.unit']);

// ---------- importing a new library ----------
const n=v=>typeof v==='number'?v:Number(String(v).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)));
const row=(name,family,w,h,d,price,status,model='')=>[name,family,'ماركة س',model,w,h,d,n(w)+40,n(h)+20,n(d)+50,price,status];
const rows=[head,
 row('ثلاجة المعرض','ثلاجة','٦٠٠','١٨٥٠','٦٥٠','٤٥٠٠','معتمد','XR-1'),
 row('غسالة صحون المعرض','غسالة صحون',598,815,550,'','مسودة'),
 row('فرن المعرض','oven',595,595,550,'٢٢٠٠','approved')];
const store=fresh();let p=previewImport(store,'appliance',rows,map('appliance'));
assert.deepEqual(p.errors,[]);assert.deepEqual([p.added,p.updated,p.unchanged,p.validated.length],[3,0,0,3]);
assert.deepEqual(p.entries.map(e=>[e.line,e.state]),[['٢','added'],['٣','added'],['٤','added']]);
assert.equal(store.list('appliance',{source:'import'}).length,0,'a preview keeps nothing');
let applied=await applyImport(store,'appliance',p);assert.deepEqual([applied.ok,applied.count],[true,3]);
const fridge=store.list('appliance',{source:'import'}).find(r=>r.label==='ثلاجة المعرض');
assert.deepEqual([fridge.family,fridge.price,fridge.status,fridge.attrs.model,fridge.attrs.bodyWidthMm,fridge.source],['fridge',4500,'approved','XR-1',600,'import'],'family by its Arabic name, numerals read, status by its Arabic name');
assert.equal(store.list('appliance',{source:'import'}).find(r=>r.label==='فرن المعرض').family,'oven','a family key is accepted as well');
// the same file again is not a second copy
p=previewImport(store,'appliance',rows,map('appliance'));assert.deepEqual([p.errors.length,p.added,p.updated,p.unchanged,p.validated.length],[0,0,0,3,0],'importing the same file twice changes nothing');
assert.deepEqual(await applyImport(store,'appliance',p),{ok:true,count:0});
// a changed price in the file updates the same record
const changed=rows.map((r,i)=>i===1?[...r.slice(0,10),'٥٠٠٠',r[11]]:r);
p=previewImport(store,'appliance',changed,map('appliance'));assert.deepEqual([p.added,p.updated,p.unchanged],[0,1,2]);
await applyImport(store,'appliance',p);assert.equal(store.get('appliance',fridge.id).price,5000);assert.equal(store.list('appliance',{source:'import'}).length,3);

// ---------- every bad row at once ----------
const mixed=[head,
 row('جيد','ثلاجة',600,1850,650,'','مسودة'),
 row('فئة غريبة','مكنسة',600,1850,650,'',''),
 row('رقم سيئ','ثلاجة','ستون',1850,650,'',''),
 row('حيز صغير','ثلاجة',600,1850,650,'','').map((v,i)=>i===7?500:v),
 row('جيد','ثلاجة',600,1850,650,'','مسودة'),
 row('','ثلاجة',600,1850,650,'',''),
 row('سعر سالب','ثلاجة',600,1850,650,'-5',''),
 row('حالة سيئة','ثلاجة',600,1850,650,'','نهائي'),
 [...row('خانات زائدة','ثلاجة',600,1850,650,'',''),'زائد'],
 row('=cmd','ثلاجة',600,1850,650,'','')];
const empty=fresh();p=previewImport(empty,'appliance',mixed,map('appliance'));
assert.equal(p.errors.length,9,'each bad row is named, the good one is not');assert.equal(p.added,1);
assert.match(p.errors[0],/^سطر ٣ · فئة غريبة — الفئة «مكنسة» غير معروفة\. المقبول: ثلاجة/);
assert(p.errors.some(e=>/سطر ٤ · رقم سيئ — .*رقم بين/.test(e)));assert(p.errors.some(e=>/سطر ٥ · حيز صغير — حيز التركيب أصغر/.test(e)));
assert(p.errors.some(e=>/سطر ٦ · جيد — السجل مكرر في الملف/.test(e)),'a repeat inside the file');
assert(p.errors.some(e=>/سطر ٧ — اكتب اسمًا/.test(e)));assert(p.errors.some(e=>/سطر ٨ · سعر سالب — السعر/.test(e)));
assert(p.errors.some(e=>/سطر ٩ · حالة سيئة — الحالة «نهائي» غير معروفة/.test(e)));assert(p.errors.some(e=>/سطر ١٠ · خانات زائدة — يتجاوز عدد الخانات/.test(e)));assert(p.errors.some(e=>/سطر ١١ · =cmd — اكتب اسمًا/.test(e)));
const refused=await applyImport(empty,'appliance',p);assert.equal(refused.ok,false);assert.equal(empty.counts('appliance').own,0,'nothing is kept while any row is wrong');
assert.equal((await applyImport(empty,'appliance',null)).ok,false);

// ---------- the table itself ----------
const bad=(table,mapping,pattern,why)=>{const r=previewImport(fresh(),'appliance',table,mapping);assert(r.errors.some(e=>pattern.test(e)),why+' → '+JSON.stringify(r.errors));};
bad([head],map('appliance'),/صف عناوين/,'a table needs at least one data row');
bad(rows,['','attrs.brand'],/اربط عمود الاسم/,'the name column is required');
bad(rows,['label','attrs.brand'],/اربط عمود الفئة/,'the family column is required');
bad(rows,['label','family','label'],/رُبط عمودان/,'two columns on one field');
bad(rows,['label','family','nonsense'],/ربط الأعمدة غير صالح/,'an unknown field');
bad([head,...Array.from({length:maxImportRows},()=>row('س','ثلاجة',600,1850,650,'','')),row('ص','ثلاجة',600,1850,650,'','')],map('appliance'),/يقبل الاستيراد/,'too many rows');
assert.equal(previewImport(fresh(),'nonsense',rows,[]).errors[0],'مكتبة غير معروفة.');
const blanks=previewImport(fresh(),'appliance',[head,row('جيد','ثلاجة',600,1850,650,'',''),['','','','','','','','','','','',''],head.map(()=>'')],map('appliance'));
assert.deepEqual([blanks.errors.length,blanks.added],[0,1],'an empty row in the file is skipped');

// ---------- ids: update by id, keep the factory's own ----------
const own=fresh();await own.save('hardware',{label:'مفصلة خاصة',family:'hinge',attrs:{unit:'piece'}});
const mine=own.list('hardware',{source:'own'})[0];
const hh=['المعرف','الاسم','الفئة','وحدة الشراء','السعر'];const hm=detectColumns('hardware',hh);
p=previewImport(own,'hardware',[hh,[mine.id,'مفصلة خاصة','مفصلات','قطعة','٧']],hm);assert.deepEqual([p.errors.length,p.updated,p.added],[0,1,0]);
await applyImport(own,'hardware',p);assert.equal(own.get('hardware',mine.id).price,7);assert.equal(own.counts('hardware').own,1,'updated by id, not copied');
p=previewImport(own,'hardware',[hh,['bad id!','س','مفصلات','قطعة','']],hm);assert.match(p.errors[0],/المعرف يقبل الحروف/);
p=previewImport(own,'hardware',[hh,['manual-1','مفصلة جديدة','مفصلات','قطعة','']],hm);assert.deepEqual([p.errors.length,p.added],[0,1]);await applyImport(own,'hardware',p);assert.equal(own.get('hardware','manual-1').label,'مفصلة جديدة','a given id is kept');
// the shipped records take a price by id
const shippedId=own.list('hardware',{source:'generic'})[0].id;
p=previewImport(own,'hardware',[['المعرف','السعر','الحالة'],[shippedId,'٩٫٥','معتمد']],detectColumns('hardware',['المعرف','السعر','الحالة']));
assert.deepEqual([p.errors.length,p.updated,p.entries[0].shipped],[0,1,true]);await applyImport(own,'hardware',p);
assert.deepEqual([own.get('hardware',shippedId).price,own.get('hardware',shippedId).status],[9.5,'approved']);assert.equal(own.counts('hardware').own,2);
// a fixed library takes notes by id and nothing new
const fm=detectColumns('finish',['المعرف','السعر','رمز المورد']);
p=previewImport(own,'finish',[['المعرف','السعر','رمز المورد'],['oak','٨٥','EGG-H1180'],['walnut','١٢٠','']],fm);assert.deepEqual([p.errors.length,p.updated],[0,2]);
await applyImport(own,'finish',p);assert.equal(own.get('finish','oak').attrs.supplierCode,'EGG-H1180');assert.equal(own.get('finish','walnut').price,120);
p=previewImport(own,'finish',[['المعرف','السعر','رمز المورد'],['oak','٨٥','EGG-H1180']],fm);assert.deepEqual([p.updated,p.unchanged],[0,1],'the same supplier code and price are not a change');
p=previewImport(own,'finish',[['المعرف','السعر'],['new-finish','١']],detectColumns('finish',['المعرف','السعر']));assert.match(p.errors[0],/هذه المكتبة ثابتة في البرنامج/);
assert.equal(previewImport(own,'finish',[['الاسم','السعر'],['خامة','١']],detectColumns('finish',['الاسم','السعر'])).errors[0],'اربط عمود المعرف.');

// ---------- export, file, import ----------
const exported=exportRows(own,'hardware');
assert.deepEqual(exported[0],libraryColumns('hardware').map(c=>c.label));
const line=exported.find(r=>r[0]===shippedId);assert.deepEqual([line[1],line[2],line.at(-3),line.at(-2)],[own.get('hardware',shippedId).label,'مفصلات',9.5,'معتمد'],'names, not keys, and the price');
assert.equal(line[libraryColumns('hardware').findIndex(c=>c.key==='attrs.unit')],'قطعة','a choice is written as its name');
await own.setHidden('hardware',shippedId,true);
assert(!exportRows(own,'hardware',{includeHidden:false}).some(r=>r[0]===shippedId)&&exportRows(own,'hardware').some(r=>r[0]===shippedId),'hidden rows can be left out');
const csv=toCSV([['الاسم','ملاحظة'],['مفصلة, ١١٠°','قال "جيد"\nسطرين'],['عادي','']]);
assert.equal(csv.charCodeAt(0),0xfeff,'a BOM so Excel reads Arabic');assert.match(csv,/"مفصلة, ١١٠°","قال ""جيد""\nسطرين"\r\n/);
assert.deepEqual(parseWorkshopTable(csv),[['الاسم','ملاحظة'],['مفصلة, ١١٠°','قال "جيد"\nسطرين'],['عادي','']],'the reader returns what was written');
// the factory's own records survive a round trip through a file into another device
const sourceStore=fresh();await sourceStore.save('sink',{label:'حوض المعرض',family:'composite',attrs:{bowls:2,mount:'under',widthMm:1160,depthMm:500,drainer:'right'},price:1800,status:'approved',note:'من المعرض'});
const trip=parseWorkshopTable(toCSV(exportRows(sourceStore,'sink',{includeHidden:false})));
const target=fresh();const back=previewImport(target,'sink',trip,detectColumns('sink',trip[0]));
assert.deepEqual([back.errors.length,back.added,back.unchanged],[0,1,libraryDefs.sink?target.counts('sink').generic:0]);
await applyImport(target,'sink',back);const arrived=target.list('sink',{source:'import'})[0];
assert.deepEqual([arrived.label,arrived.family,arrived.price,arrived.attrs.mount,arrived.attrs.drainer,arrived.attrs.bowls,arrived.note],['حوض المعرض','composite',1800,'under','right',2,'من المعرض'],'a file moves a record between devices intact');

console.log('PASS: a library exports with readable names, imports from Arabic or English headers and Arabic numerals, reports every bad row before keeping any, never copies the same row twice, updates by id, and takes price, status and notes for the records the program ships.');
