import assert from 'node:assert/strict';
import {productionDrawing} from '../public/kitchen-production-drawing.js';
import {seedCatalog,getFactoryCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {makeQuoteReadyFixture} from './fixture-kitchen-quote-ready.mjs';

const catalog=seedCatalog(),item=catalog.items.find(i=>i.sku==='BODY-6'),bar=catalog.items.find(i=>i.sku==='AL-20');
Object.assign(item,{stockLengthMm:2000,stockWidthMm:1000,offcuts:[{ref:'باقي <&>',count:1,lengthMm:600,widthMm:400}]});
Object.assign(bar,{stockLengthMm:6000,sectionWidthMm:40,thicknessMm:20,gaugeMm:5});
catalog.machining={strict:false,machines:[{id:'TEST-CNC',name:'اختبار <آلة>',datum:'ركن <&> وجه "أ"',skus:[item.sku,bar.sku],ops:['drill','mill','miter','size','scribe'],maxLength:6000,maxWidth:2000,maxThickness:30,minTolerance:.1,clampMargin:0,maxAngle:90,minBendRadius:1,setupMin:0,dailyMin:480}]};
const doc={room:{width:500,length:500,height:280,workshop:{catalog}},kitchen:{units:[],runs:[],features:[]}};
assert.equal(getFactoryCatalog(doc).machining.machines[0].id,'TEST-CNC','fixture uses the actual catalog reader');
const op={kind:'drill',machine:'TEST-CNC',reference:'مخطط <test> & "A"',tolerance:.2,xFrom:'end',yFrom:'start',x:25,y:30,diameter:8,depth:2,length:0,width:0,angle:0,radius:0,minutes:1};
const p={unitId:'u<&"',runId:'r',family:'storage',sku:item.sku,kind:'panel',label:'جانب <script>alert(1)</script> & "A"',a:400,b:200,count:2,operations:[op,{...op,kind:'mill',xFrom:'start',x:100,y:80,length:40,width:20}]};
const other={...p,unitId:'u2',label:'لوح ثانٍ',a:300,b:150,count:1,operations:[]};
const hardware={unitId:'h',sku:'HANDLE',kind:'piece',label:'يد',a:null,b:null,count:1};
const quote={pieces:[hardware,p,other],purchases:[{sku:item.sku,kind:'panel',layout:[
 {ref:'خام 1',source:'stock',unitId:p.unitId,label:p.label,xMm:12,yMm:25,a:p.a,b:p.b},
 {ref:'خام 1',source:'stock',unitId:other.unitId,label:other.label,xMm:500,yMm:50,a:other.a,b:other.b},
 {ref:'باقي <&> #1',source:'offcut',unitId:p.unitId,label:p.label,xMm:0,yMm:0,a:p.a,b:p.b}
],leftovers:[{ref:'خام 1',source:'stock',xMm:0,yMm:300,lengthMm:2000,widthMm:700},{ref:'باقي <&> #1',source:'offcut',xMm:401,yMm:0,lengthMm:199,widthMm:400}]}]};
const before=JSON.stringify({doc,quote}),outputs=[];
function render(q=quote,options={}){const result=productionDrawing(doc,q,{pieceIndex:1,...options});outputs.push(result.html);return result;}

const operation=render(quote,{operationIndex:0});
assert.match(operation.html,/<rect x="0" y="0" width="400" height="200" data-production-plane=""/);
assert.match(operation.html,/<circle cx="375" cy="30" r="4"/,'end-relative X comes from machiningSheet');
assert.match(operation.html,/<rect x="80" y="70" width="40" height="20"/,'mill is centred at its actual point');
assert.match(operation.html,/data-production-drag="0"/);assert.match(operation.html,/data-production-drag="1"/);
assert.match(operation.html,/data-production-operation="0" data-selected="true"/);
assert(operation.html.indexOf('data-production-operation="1"')<operation.html.indexOf('data-production-operation="0"'),'selected marker paints last without renumbering');
assert.match(operation.html,/&lt;script&gt;/);assert(!operation.html.includes('<script>'));
assert.match(operation.html,/مخطط &lt;test&gt; &amp; &quot;A&quot;/);assert.match(operation.html,/ركن &lt;&amp;&gt;/);

const cut=render(quote,{view:'cut',unitId:p.unitId});
assert.equal((cut.html.match(/data-production-stock-source=/g)||[]).length,2,'fresh and offcut groups both render');
assert.match(cut.html,/<rect x="12" y="25" width="400" height="200"/,'packing coordinates are used unchanged');
assert.match(cut.html,/<rect x="500" y="50" width="300" height="150"/,'other unit remains on the shared project stock');
assert.match(cut.html,/<rect x="0" y="0" width="600" height="400"/,'offcut has its recorded dimensions');
assert.equal((cut.html.match(/data-production-piece="1"/g)||[]).length,2,'repeated physical instances map to their unique full-quote source index');
assert.match(cut.html,/data-production-piece="2"/);assert(!cut.html.includes('data-production-piece="0"'));
assert.match(cut.html,/data-production-leftover=""/);assert.match(cut.html,/باقي &lt;&amp;&gt; #1/);

const ambiguous=render({...quote,pieces:[...quote.pieces,structuredClone(p)]},{view:'cut'});
assert(!ambiguous.html.includes('data-production-piece="1"'),'ambiguous identical rows do not guess a source');
assert.match(ambiguous.html,/aria-disabled="true"/);assert.match(ambiguous.caption,/متعدد|بلا مصدر وحيد/);
assert.match(ambiguous.html,/data-production-piece="2"/,'unrelated exact sources stay selectable');
const mismatched=structuredClone(quote);mismatched.purchases[0].layout[0].a=401;
assert.match(render(mismatched,{view:'cut'}).html,/تعذّرت مطابقة مصدر القطعة/,'dimensions participate in source identity');
const badOffcut=structuredClone(quote);badOffcut.purchases[0].layout[2].ref='unknown';
assert.match(render(badOffcut,{view:'cut'}).caption,/تعذّرت مطابقة مرجع/,'unknown offcut dimensions are never fabricated');

const barPiece={...p,sku:bar.sku,kind:'bar',a:600,b:null,operations:[{...op,x:40,yFrom:'end',y:10}]};
const barImage=render({pieces:[hardware,barPiece],purchases:[]});
assert.match(barImage.html,/width="600" height="40" data-production-plane/);
assert.match(barImage.html,/<circle cx="560" cy="30" r="4"/,'bar section and both axis origins remain physical mm');
const angled=render({pieces:[hardware,{...barPiece,cutEnvelope:{width:40,left:[0,20],right:[580,600]},operations:[{...op,kind:'miter',x:0,y:0,angle:45}]}],purchases:[]});
assert.match(angled.html,/points="0,0 580,0 600,40 20,40"/);assert(!angled.html.includes('data-production-drag='),'miter is selectable but not draggable');
assert.match(angled.html,/data-production-operation="0"/);
const scribe={...p,a:800,b:60,operations:[],scribe:{blankHeightMm:800,blankWidthMm:60,points:[[0,0],[30,0],[40,400],[30,800],[0,800]]}};
assert.match(render({pieces:[hardware,scribe],purchases:[]}).html,/points="0,0 0,30 400,40 800,30 800,0"/,'measured scribe path follows the blank orientation');
assert.match(render({pieces:[hardware,{...p,cornerCut:{tag:'deck'},operations:[]}],purchases:[]}).caption,/مستطيل قطعة الركن/);
assert.match(render(quote,{pieceIndex:0}).caption,/صنف توريد/);
assert.match(render(quote,{pieceIndex:999}).caption,/اختر قطعة/);
assert.match(render({...quote,partial:true},{view:'cut'}).caption,/حصر المشروع كاملًا/);
assert.match(render({pieces:[hardware,{...barPiece,a:null}],purchases:[]}).caption,/أكمل طول القطعة/);
assert.equal(JSON.stringify({doc,quote}),before,'rendering never changes the catalog, pieces or packing');

const real=await makeQuoteReadyFixture(),realQuote=buildFactoryQuote(real),index=realQuote.pieces.findIndex(p=>real.kitchen.units.some(u=>u.id===p.unitId));
const unit=productionDrawing(real,realQuote,{view:'unit',pieceIndex:index});outputs.push(unit.html);
assert.match(unit.html,/data-sheet-face="back"/,'unit view uses its actual wall');
assert.match(unit.html,/data-production-selected="true"/);assert.match(unit.caption,/ليست محضر تجميع/);
for(const html of outputs){
 assert(html.startsWith('<svg'));assert(!/\b(?:NaN|Infinity)\b/.test(html));
 assert(!html.includes('data-production-view='),'drawing does not shadow delegated view-button selectors');
 for(const tag of html.match(/<[^!?/][^>]*>/g)||[]){
  const names=[...tag.matchAll(/([\w:-]+)\s*=\s*"[^"]*"/g)].map(m=>m[1]);
  assert.equal(new Set(names).size,names.length,'SVG attributes are unique: '+tag.slice(0,150));
 }
}
console.log('Production drawing: exact plane/axis origins, drill and mill geometry, shared full-quote packing and offcut dimensions, unambiguous full indices, safe labels, derived outlines, actual wall rendering and immutability.');
