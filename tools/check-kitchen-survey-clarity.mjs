import assert from 'node:assert/strict';
// The wall survey screen speaks plainly: "measurement", not "reading"; counts are said properly; the review screen says why it cannot go on.
class Store{
 constructor(){this.mem=new Map;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
globalThis.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};globalThis.cancelAnimationFrame=()=>{};
const {newSurveyProject}=await import('../public/kitchen-project.js');
const {mountChainStep,walkNeedsEnd,walkNeedsAnything,endNeeded}=await import('../public/kitchen-chain-ui.js');

class View{
 html='';handlers={};nodes=new Map();
 set innerHTML(v){this.html=v;}
 get innerHTML(){return this.html;}
 querySelector(q){
  if(!/^\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=|chain-prop=|chain-map|end-hint)/.test(q))return null;
  if(!this.nodes.has(q))this.nodes.set(q,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelector(){return null;},focus(){},select(){},scrollIntoView(){}});
  return this.nodes.get(q);
 }
 addEventListener(name,handler){this.handlers[name]=handler;}
 removeEventListener(name){delete this.handlers[name];}
 event(type,dataset={},attrs=[],value=''){
  const target={tagName:type==='click'?'BUTTON':type==='input'?'INPUT':'SELECT',dataset,value,closest:()=>target,hasAttribute:a=>attrs.includes(a)};
  this.handlers[type]({target});
 }
 act(action){this.event('click',{chainAct:action});}
 add(k){this.event('click',{addReading:k},['data-add-reading']);}
 input(k,v){this.event('input',{chainProp:k},[],v);}
}
const retired=/قراءة|قراءات|القراءة|القراءات|قراءتي|سلسلة|مرجع المسافة|تجاوز/;
let doc=newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'وضوح'});
const api={getDoc:()=>doc,apply:next=>{doc=next;return {ok:true,saved:true};},onAdvance(){}};
const view=new View;let control=mountChainStep(view,api);

// ---------- a wall with nothing on it ----------
assert.match(view.html,/لا قياسات/,'an empty wall says so');assert.doesNotMatch(view.html,retired,'no retired word on the empty wall screen');
assert.match(view.html,/الجدار التالي · دون قياس هذا الجدار/,'moving on from an empty wall says what that means');
assert.match(view.html,/إدخال بالأرقام/);assert.match(view.html,/الظهر والوجه · اختياري/,'the back-and-face step says it is optional');
assert.match(view.html,/data-add-reading="stop" title="[^"]*تنتهي الدواليب/,'the end-of-cabinets button explains itself');
assert.match(view.html,/data-add-reading="corner" title="[^"]*ينتهي عنده الجدار/,'the corner button explains itself');
assert.equal(view.nodes.get('[data-end-hint]')?.hidden,true,'an empty wall shows no end-marker hint');

// ---------- counts are said the way people say them ----------
const counts=[];
for(let i=0;i<11;i++){
 view.add('electric');view.input('gapMm','١٠٠');
 counts.push(view.html.match(/site-reading-count">· ([^<]*)</)?.[1]);
}
assert.deepEqual(counts.slice(0,4),['قياس واحد','قياسان','٣ قياسات','٤ قياسات']);
assert.equal(counts[9],'١٠ قياسات');assert.equal(counts[10],'١١ قياسًا');
assert.doesNotMatch(view.html,retired,'no retired word while editing a measurement');
assert.match(view.html,/تُقاس المسافة من/);assert.match(view.html,/القياس السابق/);assert.match(view.html,/aria-label="قياس \d|aria-label="قياس ١/);
assert.match(view.html,/الجدار التالي|حفظ الجدار والانتقال للتالي/,'a wall with measurements offers the ordinary next step');

// ---------- the end-marker explanation is written on the screen, because a tablet has no hover ----------
const note=view.nodes.get('[data-end-hint]');
assert(view.html.includes('<div class="sv-ends-hint" data-end-hint hidden><p>'+endNeeded+'</p>'),'the explanation is on the screen');
const card=view.html.slice(view.html.indexOf('data-end-hint hidden>'),view.html.indexOf('data-chain-act="pair"')>0?view.html.indexOf('data-chain-act="pair"'):undefined);
assert(card.includes('class="sv-ends-actions"><button type="button" data-add-reading="stop"')&&card.includes('>نهاية الدواليب<')&&card.includes('data-add-reading="corner"')&&card.includes('>ركن نهاية الجدار<'),'with the two buttons it names, so they are one tap away');
assert.equal(note.hidden,false,'measurements without an end marker: the hint is shown');
assert(endNeeded.includes('«نهاية الدواليب»')&&endNeeded.includes('«ركن نهاية الجدار»'),'it names both buttons');
view.add('stop');
assert.equal(note.hidden,true,'once the wall has its end marker the hint goes away');
control.destroy();

// ---------- the review screen says what is missing ----------
doc=newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'مراجعة'});
const empty=new View;control=mountChainStep(empty,api);
empty.act('review');
assert.match(empty.html,/مراجعة رفع الجدران/);assert.match(empty.html,/لا قياسات/);assert.doesNotMatch(empty.html,retired);
assert.match(empty.html,/id="sv-review-hint"[^>]*>[^<]*لم يُسجَّل أي قياس بعد/,'with nothing measured the reason is on the screen');assert.equal(walkNeedsAnything.includes('نهاية الدواليب'),true);
assert.match(empty.html,/data-chain-act="finish-walk"[^>]*disabled[^>]*aria-describedby="sv-review-hint"/,'the button is off and points at its reason');
empty.act('back-to-wall');

// a wall with measurements but no end of cabinets: still off, with the exact missing step
empty.add('window');empty.input('gapMm','٥٠٠');empty.input('widthMm','٩٠٠');
empty.act('review');
assert.match(empty.html,/١ · الجدار الخلفي[\s\S]*?قياس واحد/,'the wall row counts its measurement');
assert(empty.html.includes(walkNeedsEnd),'the reason names the missing step');assert.doesNotMatch(empty.html,/لم يُسجَّل أي قياس بعد/);
assert.match(empty.html,/data-chain-act="finish-walk"[^>]*disabled/);
empty.act('back-to-wall');

// marking where the cabinets end makes it ready, even before the wall is saved
empty.add('stop');empty.input('gapMm','١٥٠٠');
empty.act('review');
assert.doesNotMatch(empty.html,/sv-review-hint/,'ready: no reason is shown');assert.doesNotMatch(empty.html,/data-chain-act="finish-walk"[^>]*disabled/,'ready: the button is on');
assert.match(empty.html,/تحديد جدران الدواليب مع العميل/);
control.destroy();

console.log('PASS: the survey screen uses plain wording (no "reading"), says counts properly, explains its end buttons and the optional step, and the review screen shows why it cannot go on.');
