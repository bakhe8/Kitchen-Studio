import assert from 'node:assert/strict';
import {openWorkspace} from '../public/kitchen-workspace-entry.js';

// A small DOM/event surface exercises entry decisions without mounting an
// editor or assuming how its responsive layout is implemented.
class Node {
  children=[];listeners=new Map();dataset={};attributes=new Map();parent=null;innerHTML='';
  constructor(tag){this.tagName=tag;}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  prepend(node){node.parent=this;this.children.unshift(node);}
  replaceChildren(...nodes){for(const child of this.children)child.parent=null;this.children=[];this.append(...nodes);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  querySelector(selector){
    if(selector==='button'&&this.innerHTML.includes('<button'))return this.button??=(new Node('button'));
    return null;
  }
  addEventListener(type,fn){const listeners=this.listeners.get(type)||new Set();listeners.add(fn);this.listeners.set(type,listeners);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type){for(const fn of [...this.listeners.get(type)||[]])fn({target:this});}
}
function surface(width,search=''){
  const body=new Node('body'),created=[],tablet=new Node('media');
  tablet.matches=width>=768;
  globalThis.location={href:'https://kitchen.example/kitchen-editor.html'+search};
  globalThis.document={body,documentElement:{dataset:{}},createElement(tag){const node=new Node(tag);created.push(node);return node;}};
  globalThis.window={matchMedia(query){assert.equal(query,'(min-width: 768px)');return tablet;}};
  let calls=0;
  const mounted={editor:'one mounted instance'};
  return {body,created,tablet,mounted,get calls(){return calls;},
    start:()=>openWorkspace(()=>{calls++;return mounted;}),
    resize(nextWidth){tablet.matches=nextWidth>=768;tablet.emit('change');}};
}
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name);}

await check('direct survey cold entry opens at phone width without a gate or iframe',async()=>{
  for(const width of [390,767]){
    const page=surface(width,'?panel=workshop&step=survey&wall=right');
    const opened=page.start();
    assert.equal(page.calls,1,'the responsive survey starts immediately on a narrow screen');
    assert.strictEqual(await opened,page.mounted);
    assert.equal(document.documentElement.dataset.workspaceOpen,'');
    assert.deepEqual(page.created,[],'direct survey entry creates neither width notice nor tablet iframe');
    page.resize(1024);page.resize(390);page.resize(768);
    assert.equal(page.calls,1,'rotating an open survey never remounts unfinished work');
    assert.equal(page.tablet.listeners.get('change')?.size||0,0);
  }
});

await check('narrow CAD and every other route retain the tablet-width gate and user opt-in',async()=>{
  for(const search of ['', '?panel=workshop&step=whole', '?panel=workshop&step=photo', '?panel=project&step=survey', '?step=survey', '?panel=workshop']){
    const page=surface(390,search),opened=page.start();
    assert.equal(page.calls,0,search||'default CAD');
    assert.equal(page.body.children.length,1);
    const notice=page.body.children[0];
    assert.equal(notice.className,'studio-width-note');
    assert.equal(page.created.filter(node=>node.tagName==='iframe').length,0,'the iframe waits for explicit opt-in');
    notice.querySelector('button').emit('click');
    await opened;
    assert.equal(page.calls,0,'tablet iframe owns the editor rather than a second parent instance');
    const frames=page.created.filter(node=>node.tagName==='iframe');
    assert.equal(frames.length,1);
    const target=new URL(frames[0].src),original=new URL(location.href);
    assert.equal(target.pathname,original.pathname);
    assert.equal(target.searchParams.get('workspace'),'tablet');
    for(const [key,value] of original.searchParams)assert.equal(target.searchParams.get(key),value);
    assert.equal(page.body.children[0].className,'studio-scroll-sheet');
    assert.equal(page.tablet.listeners.get('change')?.size||0,0,'the completed width gate leaves no resize listener');
    page.resize(1024);page.resize(390);
    assert.equal(page.calls,0);
    assert.equal(page.created.filter(node=>node.tagName==='iframe').length,1);
  }
});

await check('existing wide entry opens its editor directly and ignores later resize',async()=>{
  const page=surface(768,'?panel=workshop&step=row');
  assert.strictEqual(await page.start(),page.mounted);
  assert.equal(page.calls,1);
  assert.deepEqual(page.created,[]);
  page.resize(390);page.resize(1200);
  assert.equal(page.calls,1);
});

await check('a gated CAD page may widen once without remounting or creating a tablet iframe',async()=>{
  const page=surface(390),opened=page.start();
  const notice=page.body.children[0],button=notice.querySelector('button');
  page.resize(767);assert.equal(page.calls,0);
  page.resize(768);
  assert.strictEqual(await opened,page.mounted);
  assert.equal(page.calls,1);
  assert.equal(page.body.children.length,0);
  assert.equal(page.created.some(node=>node.tagName==='iframe'),false);
  assert.equal(page.tablet.listeners.get('change')?.size||0,0);
  assert.equal(button.listeners.get('click')?.size||0,0);
  page.resize(390);page.resize(1024);button.emit('click');
  assert.equal(page.calls,1,'obsolete width controls cannot start another editor');
});

console.log(`Kitchen survey workspace: ${count} entry groups passed.`);
