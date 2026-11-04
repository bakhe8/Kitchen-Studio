// Exercise real fieldInput, pending drafts and confirmation. The small event
// surface replaces the browser only; measurement parsing and guards stay real.
import assert from 'node:assert/strict';
import {mountWallInk} from '../public/kitchen-wall-ink-ui.js';

function fixture({notebook=true,rows}={}){
 const room={width:500,length:420,height:280};
 let chain={source:'field',rows:rows||[{id:'w',kind:'window',from:'origin',gapMm:400,widthMm:900,heightMm:1100,bottomMm:1000,depthMm:100}]},writes=0,paints=0,ink;
 const listeners=new Map(),fields=new Map(),labels=new Map();
 const notebookNode={};
 const host={
  contains:node=>[...fields.values(),...labels.values()].includes(node),
  addEventListener(type,fn,options){const list=listeners.get(type)||[];list.push({fn,capture:options===true||options?.capture});listeners.set(type,list);},
  removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(item=>item.fn!==fn));},
  querySelector(selector){return fields.get(selector.match(/^\[data-ink-value="([^"]+)"\]$/)?.[1])||null;}
 };
 function draw(){
  for(const node of fields.values())node.isConnected=false;
  fields.clear();labels.clear();
  for(const match of ink.editor().matchAll(/<label[^>]*>([\s\S]*?)<input([^>]*)><\/label>/g)){
   const attrs=match[2],key=attrs.match(/data-ink-value="([^"]+)"/)[1],value=attrs.match(/\svalue="([^"]*)"/)[1];
   const input={dataset:{inkValue:key},value,isConnected:true,focus(){this.focused=true;},select(){},
    hasAttribute:name=>name==='data-ink-value',closest:selector=>['[data-ink-value]','input,button,select,textarea,a'].includes(selector)?input:selector==='label'?label:selector==='.sv-notebook'&&notebook?notebookNode:null};
   const label={isConnected:true,querySelector:selector=>selector==='[data-ink-value]'?input:null,
    closest:selector=>selector==='label'?label:selector==='.sv-notebook'&&notebook?notebookNode:null,
    setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){delete this.capture;}};
   fields.set(key,input);labels.set(key,label);
  }
 }
 ink=mountWallInk(host,{room:()=>room,wall:()=>'back',chain:()=>chain,unadopted:()=>false,draw,dirty:()=>false,selected:()=>0,
  replace(next){chain=next;writes++;draw();},check:()=>({ok:true}),notify(){},onPaint(){paints++;},objectGapLabel:()=>'من المرجع',datumLabel:()=>'طرف العنصر السابق'});
 function fire(type,target=fields.get('widthMm'),more={}){
  const event={type,target,pointerId:4,isPrimary:true,pointerType:'mouse',button:0,clientX:100,clientY:30,
   preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},stopImmediatePropagation(){this.immediateStopped=true;},...more};
  for(const {fn} of [...(listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(event.immediateStopped)break;fn(event);}
  return event;
 }
 function input(key,value){const target=fields.get(key);target.value=value;ink.fieldInput(target);return target;}
 const key=(name,extra={})=>fire('keydown',fields.get('widthMm'),{key:name,...extra});
 const scrub=(kind,x=100,extra={})=>fire(kind,labels.get('widthMm'),{clientX:x,...extra});
 const action=(name,value)=>ink.handleClick({dataset:{[name]:value},hasAttribute:attr=>attr==='data-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())});
 return {ink,fire,input,key,scrub,action,draw,fields,labels,get chain(){return chain;},get writes(){return writes;},get paints(){return paints;},listeners};
}

// A missing arrow handler, wrong step, or premature confirmation changes the
// visible draft/committed chain assertions below.
const f=fixture();f.ink.selectDim(0,'widthMm','عرض البرواز');
assert(f.key('ArrowUp').defaultPrevented,'ArrowUp adjusts the focused millimetre input');
assert.equal(f.fields.get('widthMm').value,'901');
assert(f.paints>0,'the notebook receives the final pending state even without a paper SVG');
assert.match(f.ink.editor(),/value="901"/);
f.key('ArrowDown',{shiftKey:true});assert.equal(f.fields.get('widthMm').value,'891');
assert.equal(f.chain.rows[0].widthMm,900);assert.equal(f.writes,0,'precision edits remain provisional');
f.input('widthMm','٩٠٠٫٢٥');f.key('ArrowUp');assert.equal(f.fields.get('widthMm').value,'901.25');
f.input('widthMm','۹۰۰٫۲۵');f.key('ArrowDown');assert.equal(f.fields.get('widthMm').value,'899.25');
for(const raw of ['', '   ', 'غير صالح', '١٢٬٣', '٤٠٠ ٩٠٠']){
 f.input('widthMm',raw);const event=f.key('ArrowUp');assert.equal(f.fields.get('widthMm').value,raw);assert(!event.defaultPrevented);
 f.scrub('pointerdown');f.scrub('pointermove',130);f.scrub('pointerup',130);assert.equal(f.fields.get('widthMm').value,raw);
}
f.input('widthMm','900.125');
for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}]){assert(!f.key('ArrowUp',extra).defaultPrevented);assert.equal(f.fields.get('widthMm').value,'900.125');}
assert(!f.key('z',{ctrlKey:true}).defaultPrevented,'native text undo keeps its key event');
assert(!f.key('z',{metaKey:true}).defaultPrevented,'macOS text undo keeps its key event');
f.fire('pointerdown',f.fields.get('widthMm'));f.fire('pointermove',f.fields.get('widthMm'),{clientX:120});f.fire('pointerup',f.fields.get('widthMm'),{clientX:120});
assert.equal(f.fields.get('widthMm').value,'900.125','dragging inside an input retains native text selection');
assert(!f.scrub('pointerdown').defaultPrevented,'a label click keeps native focus behavior');
f.scrub('pointermove',104);assert.equal(f.fields.get('widthMm').value,'900.125');
f.scrub('pointerup',104);assert(!f.fire('click',f.labels.get('widthMm')).defaultPrevented);
f.scrub('pointerdown');assert(f.scrub('pointermove',105).defaultPrevented);assert.equal(f.fields.get('widthMm').value,'905.125');
f.scrub('pointermove',112);assert.equal(f.fields.get('widthMm').value,'912.125');
f.scrub('pointerup',112);assert.equal(f.writes,0);assert.equal(f.chain.rows[0].widthMm,900);
assert(f.fire('click',f.labels.get('widthMm')).defaultPrevented,'drag suppresses label focus click');
assert(!f.fire('click',f.labels.get('widthMm')).defaultPrevented,'a later click stays usable');
f.scrub('pointerdown',100,{pointerType:'touch'});f.scrub('pointermove',110,{pointerType:'touch',shiftKey:true});
assert.equal(f.fields.get('widthMm').value,'913.125','Shift uses one tenth millimetre per pixel');
f.scrub('pointercancel',110,{pointerType:'touch'});assert.equal(f.fields.get('widthMm').value,'912.125');
assert.match(f.ink.editor(),/value="912\.125"/,'pointercancel restores the real pending value');
f.scrub('pointerdown');f.scrub('pointermove',80);f.scrub('lostpointercapture',80);
assert.equal(f.fields.get('widthMm').value,'912.125');
f.scrub('pointerdown');f.scrub('pointermove',115);assert(f.key('Escape').defaultPrevented);
assert.equal(f.fields.get('widthMm').value,'912.125');assert(f.ink.hasPending(),'Escape cancels the scrub before closing its editor');
f.scrub('pointerup',115);assert.equal(f.writes,0);
f.input('widthMm','4700');f.key('ArrowUp');f.ink.confirm();assert.equal(f.writes,0,'existing geometry validation rejects an out-of-wall width');
f.input('widthMm','900');f.key('ArrowUp');f.ink.confirm();assert.equal(f.writes,1);assert.equal(f.chain.rows[0].widthMm,901);
assert.equal(f.chain.source,'field','precision controls preserve the measurement source');
f.ink.selectDim(0,'widthMm','عرض البرواز');f.scrub('pointerdown');f.scrub('pointermove',110);
const beforeDestroy=f.fields.get('widthMm');f.ink.destroy();assert.equal(beforeDestroy.value,'901');
assert([...f.listeners.values()].every(list=>!list.length),'all controller listeners are removed');

const redrawn=fixture();redrawn.ink.selectDim(0,'widthMm','عرض البرواز');
redrawn.scrub('pointerdown');redrawn.scrub('pointermove',112);const oldLabel=redrawn.labels.get('widthMm');redrawn.draw();
redrawn.fire('lostpointercapture',oldLabel);assert.equal(redrawn.fields.get('widthMm').value,'900','a redraw during capture cannot keep a cancelled value visible');
assert.match(redrawn.ink.editor(),/value="900"/);redrawn.ink.destroy();

// The shared editor also serves local face entry. Its existing keyboard and
// pointer behavior must remain unchanged outside the production notebook.
const local=fixture({notebook:false});local.ink.selectDim(0,'widthMm','عرض البرواز');
assert(!local.key('ArrowUp').defaultPrevented);local.scrub('pointerdown');local.scrub('pointermove',130);local.scrub('pointerup',130);
assert.equal(local.fields.get('widthMm').value,'900');local.ink.destroy();

// The tape and origin inputs describe the same physical station. Interrupted
// scrubbing must restore both draft fields and the explicit datum selection.
const tape=fixture({rows:[
 {id:'d',kind:'door',gapMm:400,widthMm:900,heightMm:2100,bottomMm:0,depthMm:100},
 {id:'w',kind:'window',gapMm:700,widthMm:900,heightMm:1100,bottomMm:1000,depthMm:100}
]});
tape.ink.selectObject({index:1,key:'1',row:tape.chain.rows[1],stationMm:2000,widthMm:900});
assert.equal(tape.fields.get('tapeGap').value,'700');
const tapeLabel=tape.labels.get('tapeGap');
tape.fire('pointerdown',tapeLabel);tape.fire('pointermove',tapeLabel,{clientX:108});
assert.equal(tape.fields.get('tapeGap').value,'708');assert.equal(tape.fields.get('gapMm').value,'2008');
tape.fire('pointercancel',tapeLabel);assert.equal(tape.fields.get('tapeGap').value,'700');assert.equal(tape.fields.get('gapMm').value,'2000');
assert(!tape.ink.provisional());tape.ink.confirm();assert.equal(tape.writes,0,'cancelled tape scrub makes no derived reading');tape.ink.destroy();

const pair=fixture({rows:[]});pair.action('inkTool','window');pair.action('inkAction','type');
pair.fire('paste',pair.fields.get('gapMm'),{clipboardData:{getData:()=>'٤٠٠ ٩٠٠'}});
pair.scrub('pointerdown');pair.scrub('pointermove',120);pair.scrub('pointercancel');
pair.fire('keydown',pair.fields.get('gapMm'),{key:'Enter'});
assert.equal(pair.writes,1,'cancelled scrub restores the supplied-pair confirmation semantics');
assert.equal(pair.chain.rows[0].gapMm,400);assert.equal(pair.chain.rows[0].widthMm,900);pair.ink.destroy();
console.log('Survey precision: millimetre arrows, Arabic parsing, label mouse/touch scrubbing, exact cancellation, tape pairing, confirmation guards, native undo keys and cleanup.');
