import assert from 'node:assert/strict';
// What the library manager shows for a record and what it reads back from the form.
import {libraryDefs} from '../public/kitchen-library-defs.js';
import {createLibraryStore,memoryAdapter} from '../public/kitchen-library-store.js';
import {summaryLines,rowHTML,formHTML,readForm,fmt} from '../public/kitchen-library-ui.js';

const lib=createLibraryStore({adapter:memoryAdapter()});

// ---------- what a row says ----------
const fridge=lib.get('appliance','gen-fridge-bottom-60');
assert.deepEqual(summaryLines(fridge),['الجسم: ٦٠٠ عرض × ١٬٨٥٠ ارتفاع × ٦٥٠ عمق مم','الحيز: ٦٤٠ عرض × ١٬٨٧٠ ارتفاع × ٧٠٠ عمق مم'],'a generic example shows sizes, no brand or model');
const hob=lib.get('appliance','gen-hob-gas-60');assert(summaryLines(hob).some(l=>l.startsWith('فتحة القص: ٥٦٠ عرض × ٤٩٠ عمق')),'the cut-out is shown when there is one');
const withMaker=await lib.save('appliance',{label:'ثلاجة المعرض',family:'fridge',attrs:{brand:'ماركة',model:'XR-1',manual:'دليل ٣',bodyWidthMm:600,bodyHeightMm:1850,bodyDepthMm:650,spaceWidthMm:640,spaceHeightMm:1870,spaceDepthMm:700}});
assert.deepEqual([summaryLines(withMaker.record)[0],summaryLines(withMaker.record).at(-1)],['ماركة · XR-1','المرجع: دليل ٣']);
assert.deepEqual(summaryLines(lib.get('sink','gen-steel-double-86')),['حوضان · فوق السطح · ٨٦٠ × ٥٠٠ مم','فتحة القص: ٨٢٠ × ٤٦٠ مم · أقل عرض للوحدة ٩٠٠ مم']);
assert.equal(summaryLines(lib.get('sink','gen-steel-single-60'))[0],'حوض واحد · فوق السطح · ٦٠٠ × ٥٠٠ مم');
assert.deepEqual(summaryLines(lib.get('hardware','gen-slide-45')),['الشراء بالطقم · طقم يمين ويسار · الطول ٤٥٠ مم · حمل ٣٠ كغ']);
assert.deepEqual(summaryLines(lib.get('handle','gen-bar-192')),['الشراء بالقطعة · ١٩٢ مم بين المسمارين']);
assert.deepEqual(summaryLines(lib.get('finish','oak')),['الواجهات والأسطح · بلا رمز مورد']);
assert.equal(lib.get('supplier','702.055.31').label,'هيكل خزانة حائط · ٤٠ × ٣٦٫٦ × ٨٠ سم','a frame is named in Arabic numerals like everything else');
assert.deepEqual(summaryLines(lib.get('supplier','502.056.26')),['٦٠٠ × ٥٩٠ × ٨٠٠ مم · رقم المنتج 502.056.26']);
assert.equal(fmt(1850),'١٬٨٥٠');

// ---------- the row ----------
let html=rowHTML(fridge);
assert(html.includes('data-lib-id="gen-fridge-bottom-60"')&&html.includes('بلا سعر')&&html.includes('مثال عام')&&html.includes('مسودة'));
assert(html.includes('data-lib-edit="gen-fridge-bottom-60"')&&html.includes('data-lib-hide="gen-fridge-bottom-60" data-to="hide">إخفاء'));
assert(!html.includes('data-lib-catalog'),'an appliance is not copied to the factory catalog');
html=rowHTML(lib.get('hardware','gen-hinge-110'));assert(html.includes('data-lib-catalog="gen-hinge-110"')&&!html.includes('disabled'));
const meter=await lib.save('hardware',{label:'شريط',family:'other',attrs:{unit:'meter'},price:12});html=rowHTML(meter.record);
assert.match(html,/data-lib-catalog="[^"]+" disabled title="يُسعَّر بالمتر"/);assert(html.includes('١٢ ر.س / متر'),'a decided price is shown with what it is per');
assert(rowHTML(lib.get('finish','oak')).includes('بلا سعر'));
const oakPriced=await lib.save('finish',{id:'oak',price:85});assert(rowHTML(oakPriced.record).includes('٨٥ ر.س / م²'),'a finish is priced per square metre');
assert(formHTML('finish',oakPriced.record).includes('السعر · ر.س للمتر المربع')&&formHTML('hardware',null).includes('السعر · ر.س لوحدة الشراء')&&formHTML('sink',null).includes('<label>السعر · ر.س<input'),'the form says it too');
await lib.setHidden('hardware','gen-hinge-110',true);html=rowHTML(lib.get('hardware','gen-hinge-110'));assert(html.includes('data-hidden="true"')&&html.includes('data-to="show">إظهار')&&html.includes('data-chip="hidden"'));
const risky=await lib.save('sink',{label:'حوض <img src=x onerror=alert(1)>',family:'other',attrs:{widthMm:800,depthMm:500},note:'a"b'});
html=rowHTML(risky.record);assert(!html.includes('<img'),'a name is text, never markup');assert(html.includes('&lt;img')&&html.includes('a&quot;b'));
const zero=await lib.save('hardware',{label:'مجانية',family:'other',attrs:{unit:'piece'},price:0});assert(rowHTML(zero.record).includes('٠ ر.س'),'zero is a price, not «بلا سعر»');

// ---------- the form ----------
html=formHTML('appliance',null);
assert(html.includes('<h3>إضافة جهاز</h3>')&&html.includes('name="label"')&&html.includes('name="family"')&&html.includes('name="a.bodyWidthMm"')&&html.includes('name="a.spaceDepthMm"')&&html.includes('name="price"')&&html.includes('name="status"'));
assert(html.includes('<option value="fridge" selected>ثلاجة</option>'),'the first family is chosen');
assert(/<legend>جسم الجهاز · مم<\/legend>.*<label><span>العرض <b aria-hidden="true">\*<\/b><\/span><input name="a\.bodyWidthMm" inputmode="decimal" dir="ltr" value="" required>/.test(html),'a required size is marked and numeric, inside the box of its group');
assert(html.includes('<legend>حيز التركيب شامل الخلوص · مم</legend>')&&html.includes('<legend>فتحة القص في الخزانة أو السطح · مم</legend>'),'the three sizes of the body, the bay and the cut-out sit in their own boxes');
assert(html.indexOf('name="a.brand"')<html.indexOf('<legend>جسم الجهاز'),'the maker and model come before the sizes');
assert(!/<label>الاسم <b/.test(html),'the asterisk is inside the label text, so it stays on the same line');
assert(!html.includes('data-lib-delete')&&!html.includes('data-lib-copy'),'a new record has nothing to delete or copy');
html=formHTML('appliance',withMaker.record);
assert(html.includes('تعديل «ثلاجة المعرض»')&&html.includes('value="XR-1"')&&html.includes('value="600"')&&html.includes('data-lib-delete')&&html.includes('data-lib-copy>نسخ<'));
// a record the program ships can take a price, a status, a note and (finish) the supplier's code, nothing else
html=formHTML('appliance',fridge);
assert(html.includes('ملاحظات على «ثلاجة سفلية التجميد ٦٠ سم»')&&html.includes('مثال عام يأتي مع البرنامج')&&html.includes('<dl class="klib-facts">')&&!html.includes('name="label"')&&!html.includes('name="a.bodyWidthMm"'));
assert(html.includes('name="price"')&&html.includes('name="note"')&&html.includes('data-lib-copy>نسخ للتعديل<')&&!html.includes('data-lib-delete'));
html=formHTML('finish',lib.get('finish','oak'));assert(html.includes('name="a.supplierCode"')&&!html.includes('data-lib-copy'),'a finish takes a supplier code and cannot be copied (the library is fixed)');
assert(!html.includes('name="a.use"')&&!html.includes('name="a.colorHex"'),'what the drawing fixes is not editable');
html=formHTML('hardware',null);assert(html.includes('<select name="a.unit"><option value="">—</option><option value="piece">قطعة</option>'));
assert(formHTML('sink',null).includes('maxlength="60"'),'text fields carry their limit');

// ---------- reading the form back ----------
const form=new Map([['label','حوض جديد'],['family','stainless'],['price','١٢٠٠'],['status','approved'],['note',''],['a.widthMm','٨٠٠'],['a.depthMm','500'],['a.bowls','2'],['a.mount','top'],['a.brand','']]);
const get=k=>form.has(k)?form.get(k):null;
const input=readForm('sink',get,null);
assert.deepEqual([input.label,input.family,input.price,input.status,input.id],['حوض جديد','stainless','١٢٠٠','approved',undefined]);
assert.deepEqual(input.attrs,{brand:'',bowls:'2',mount:'top',widthMm:'٨٠٠',depthMm:'500'},'only the fields of the form are read');
const saved=await lib.save('sink',input);assert(saved.ok,saved.reason);assert.deepEqual([saved.record.price,saved.record.attrs.widthMm,saved.record.attrs.bowls],[1200,800,2],'the numerals typed on the form are read as numbers');
assert.equal(readForm('sink',get,saved.record).id,saved.record.id,'an edit keeps the record\'s id');
const note=readForm('appliance',k=>({price:'٣٠٠٠',status:'approved',note:'سعر المعرض'})[k]??null,fridge);
assert.deepEqual(note,{price:'٣٠٠٠',status:'approved',note:'سعر المعرض',attrs:{},id:'gen-fridge-bottom-60'},'a shipped record sends only its notes');
const code=readForm('finish',k=>({price:'',status:'draft',note:'','a.supplierCode':'EGG-1'})[k]??null,lib.get('finish','oak'));assert.equal(code.attrs.supplierCode,'EGG-1');
for(const id of Object.keys(libraryDefs))assert(formHTML(id,null)||libraryDefs[id].closed===undefined,id+' draws a form');

console.log('PASS: the manager describes each library\'s records in plain Arabic lines, never renders a name as markup, offers the factory catalog only where it applies, draws a form from each library\'s own fields, limits a shipped record to its notes, and reads Arabic numerals back from the form.');
