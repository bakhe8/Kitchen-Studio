import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {prepareWorkbookReader} from '../scripts/prepare-workbook-reader.mjs';
import {openWorkshopTables} from '../public/kitchen-workshop-spreadsheet.js';
await prepareWorkbookReader();
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rels='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function file(cells){
 const xml={
  'xl/workbook.xml':'<workbook xmlns="'+ns+'" xmlns:r="'+rels+'"><sheets><sheet name="مرجع الورشة" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rels+'/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':'<worksheet xmlns="'+ns+'"><sheetData><row r="1">'+cells+'</row></sheetData></worksheet>',
 };
 const archive=zipSync(Object.fromEntries(Object.entries(xml).map(([key,v])=>[key,strToU8(v)])));
 return new File([archive],'مرجع.xlsx');
}
const computed='<c r="A1" t="inlineStr"><is><t>عارضة جسم</t></is></c><c r="B1"><f>550-40</f><v>510</v></c>';
const result=await openWorkshopTables(file(computed));
assert.deepEqual(result.sheets,[{name:'مرجع الورشة',rows:[['عارضة جسم','510']]}]);
await assert.rejects(openWorkshopTables(file('<c r="A1"><f>10+2</f><v></v></c>')),/معادلة بلا نتيجة/);
await assert.rejects(openWorkshopTables(file('<c r="A1" t="e"><v>#REF!</v></c>')),/خطأ حسابي/);
await assert.rejects(openWorkshopTables(file('<c r="XFD5000"><v>1</v></c>')),/١٠٠ عمود/);
await assert.rejects(openWorkshopTables(new File(['not a workbook'],'broken.xlsx')),/تعذّرت قراءة/);
await assert.rejects(openWorkshopTables(new File([new Uint8Array(4*1024*1024+1)],'large.xlsx')),/يتجاوز/);
// Hostile sheets used to cost O(n^2): every unclosed <c> rescanned to the end of the sheet looking for </c>, and every
// value tag without a closing '>' rescanned the rest of its cell. A few hundred KB then froze the page for minutes.
for(const [label,cells] of [['unclosed cells','<c r="A1"><f>1</f>'+'<c r="A1">'.repeat(80000)],['value tags without a close','<c r="A1"><f>1</f>'+'<v '.repeat(120000)+'</c>']]){
 const started=performance.now();
 await openWorkshopTables(file(cells)).catch(()=>{});
 assert(performance.now()-started<3000,label+' must be scanned in linear time');
}
console.log('Local XLSX import preserves Arabic text and cached formula results; rejects uncached/error cells, overlarge sparse grids, invalid and oversized workbooks.');
