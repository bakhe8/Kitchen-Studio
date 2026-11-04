import assert from 'node:assert/strict';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen,reviewWholeProposal} from '../public/kitchen-whole-plan.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';
import {customerReport,proposalView,proposalUnits,proposalScene,proposalComparisons,alternativeStrip,purchaseNote} from '../public/kitchen-proposal-presentation.js';
import {commitProject,undoProject,redoProject,restoreProject} from '../public/kitchen-project.js';
import {buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';

function memory(){const values=new Map();return {setItem:(k,v)=>values.set(k,String(v)),getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)};}
globalThis.localStorage=memory();globalThis.sessionStorage=memory();
const src=makeVisitExample(),res=await proposeWholeKitchen(src);assert(res.ok,res.reason);
const first=res.candidates[0],rice=proposalUnits(first.doc).find(u=>u.family==='rice'),edit=previewKitchenWidthChange(first.doc,rice.id,100);
assert(edit.ok,edit.reason);assert(purchaseNote(first.quote,buildFactoryQuote(edit.doc),edit));assert.equal(src.kitchen.units.length,0);
const report=customerReport({doc:edit.doc,before:first.doc,change:edit,wallIds:['back'],example:true,questions:reviewWholeProposal(edit.doc,['back'])});
for(const s of ['data-kitchen-3d','مسقط المطبخ','قبل التعديل الأخير','بعد التعديل الأخير','تغيّرت أبعاد القص','الأكياس الأصلية','قرارات وقياسات باقية','١٬١٤٠ ر.س'])assert(report.includes(s),s);
assert(!report.includes('http://terminal.local')&&!report.includes('تكلفة إضافية للشراء'));
const originalCount=localStorage.getItem('atlas-kitchen:project:v1');assert.equal(originalCount,null);
assert(commitProject(src,edit.doc).saved);const opened=restoreProject();assert.equal(opened.kitchen.units.find(u=>u.id===rice.id).width,70);
const undone=undoProject(opened);assert(undone);assert.deepEqual(undone.next,{...src,room:{...src.room,workshop:normalizeWorkshopCatalogs(src.room.workshop)}});const redone=redoProject(undone.next);assert(redone);assert.deepEqual(redone.next,opened);
const hostile=structuredClone(edit.doc);hostile.room.name='<script>unsafe()</script>';
const printed=customerReport({doc:hostile,wallIds:['back']});assert(printed.includes('&lt;script&gt;unsafe()&lt;/script&gt;')&&!printed.includes('<script>unsafe()'));
assert(proposalView(opened,'back').includes('data-sheet-face="back"'));console.log('Shared CAD to printable Arabic model/plan/both elevations, honest known prices and missing proofs, confirmed rice count, one persistent proposal commit and undo/redo, sanitized imported labels.');

// The client can distinguish the preview finish from a catalog selection.
// Factory cut recipes/stock codes, data from another wall and private
// purchase amounts do not belong in the customer HTML.
const presentation=structuredClone(first.doc),firstRice=presentation.room.workshop.rows[rice.runId].units.find(u=>u.id===rice.id);
firstRice.drawerUses=['','أكياس <قهوة>'];
presentation.room.workshop.finishes={units:{[rice.id]:{frontSku:'FACE-6-G'}}};
const one=customerReport({doc:presentation,saved:true});
for(const value of ['عينة الواجهة المختارة','لوح واجهة رملي','الواجهة حسب وصفة المصنع','سطح العمل في الرسم','أكياس &lt;قهوة&gt;','الدرج ٢','عرض التصميم المحفوظ','@page','beforeprint'])assert.ok(one.includes(value),value);
assert.doesNotMatch(one,/FACE-6-G|AL-20|تكلفة إضافية للشراء|href="https?:|src="https?:/);
const other=customerReport({doc:presentation,wallIds:['right']});
assert.doesNotMatch(other,/أكياس &lt;قهوة&gt;|لوح واجهة رملي|data-sheet-unit="unit-2"|١٬١٤٠ ر.س/);
assert.ok(other.includes('سعر هذا النطاق غير محسوب على حدة.'));

const {factoryFrontSurfaces,frontAppearanceSource}=await import('../public/kitchen-render-factory-fronts.js');
const actual=factoryFrontSurfaces(first.doc.kitchen,frontAppearanceSource(first.doc.room.workshop)).get(rice.id);
assert.equal(actual.sku,'FACE-6-W');assert.ok(printed.includes('style="--swatch:'+actual.color+'"'));
assert.ok(printed.includes('الواجهة حسب وصفة المصنع')&&printed.includes('لوح واجهة أبيض'));
assert.ok(!printed.includes('أخضر مريمي')&&!printed.includes('عينة الواجهة المختارة'));
assert.ok(report.includes('عرض توضيحي')&&!report.includes('رقم المشروع <bdi>مثال أو ملف قديم'));

const designs=res.candidates.map(c=>c.doc),choices=proposalComparisons(designs);
for(const face of ['back','plan']){
 const sheet=proposalScene(first.doc,face,'sheet',{interactive:true,tier:'base'}).html;
 for(const kind of ['sink','dishwasher','rice','storage'])assert(sheet.includes('data-proposal-symbol="'+kind+'"'),face+' '+kind);
 assert(sheet.includes('data-sheet-unit="'+rice.id+'" data-sheet-label=""'));
 assert(!proposalScene(first.doc,face).html.includes('pd-cabinet-tag'));
}
for(const [i,c] of choices.entries()){
 const strip=alternativeStrip(proposalUnits(designs[i]),c.ids);
 assert.equal([...strip.matchAll(/class="pd-alt-change"/g)].length,c.ids.length);
}
assert(!report.includes('pd-cabinet-tag')&&!report.includes('pd-alt-strip'));
console.log('Cabinet symbols reflect actual units; the working sheet keeps selection targets, localized alternatives highlight the differing units, and customer sheets keep their print labels.');
