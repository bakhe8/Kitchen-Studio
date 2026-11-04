// Generate a separate test project. Does not read or change the user's project
// and leaves structure/customer/release approval for the actual review UI.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeQuoteReadyFixture} from './fixture-kitchen-quote-ready.mjs';
import {checkedPortableArchive} from '../public/kitchen-archive-validation.js';
import {buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {approvalState} from '../public/kitchen-workshop-state.js';

const doc=await makeQuoteReadyFixture();
const archive={type:'kitchen-studio',version:2,design:doc,photos:{},fieldFiles:[],fixture:{
 testOnly:true,syntheticPrices:true,syntheticSurvey:true,syntheticFactoryEvidence:true,
 purpose:'مشروع افتراضي لاختبار الحصر والحفظ وموافقة العميل عبر الواجهة؛ ليس عرضًا تجاريًا أو توثيق قياسات بشرية.',
 expected:{totalSar:1060,structureApproved:false,customerApproved:false,releaseApproved:false}
}};
const checked=checkedPortableArchive(JSON.parse(JSON.stringify(archive)));assert(checked.doc);
const state=await approvalState(checked.doc);assert(!state.valid.structure&&!state.valid.customer&&!state.valid.release);
const quote=buildFactoryQuote(checked.doc);assert(quote.ready&&quote.complete);assert.equal(quote.total,1060);
const destination=new URL('../docs/kitchen-studio/quote-studio-review/input-project.json',import.meta.url);
await mkdir(new URL('.',destination),{recursive:true});
await writeFile(destination,JSON.stringify(archive,null,2)+'\n','utf8');
console.log(JSON.stringify({output:fileURLToPath(destination),testOnly:true,projectId:doc.room.projectId,name:doc.room.name,
 units:doc.kitchen.units.length,total:quote.total,complete:quote.complete,ready:quote.ready,approvals:state.valid},null,2));
