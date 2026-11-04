import assert from 'node:assert/strict';
import {previewCustomerReport,downloadCustomerReport} from '../public/kitchen-report-preview.js';
const nodes=new Map(),events=new Map(),frameEvents=new Map();
const opener={isConnected:true,focus(){this.focused=true;}};let clicked=false;
const page={body:{hasAttribute:()=>true},documentElement:{classList:{add:k=>assert.equal(k,'in-preview')}},querySelector:()=>null,
 querySelectorAll:()=>[],addEventListener(k,fn){frameEvents.set(k,fn);}};
const frame={contentDocument:page,contentWindow:{focus(){},print(){this.printed=true;},addEventListener(){}},addEventListener(k,fn){events.set('frame-'+k,fn);}};
function control(key){
 if(!nodes.has(key))nodes.set(key,{focus(){this.focused=true;},click(){clicked=true;}});
 return nodes.get(key);
}
const dialog={setAttribute(){},querySelector(k){return k==='iframe'?frame:control(k);},showModal(){this.open=true;},addEventListener(k,fn){events.set(k,fn);},
 close(){this.open=false;events.get('close')();},remove(){this.removed=true;}};
globalThis.document={activeElement:opener,body:{append(){}},createElement(tag){return tag==='dialog'?dialog:control('external-link');}};
const html='<html><head><title>عرض</title></head><body data-design-revision="D-0123456789ABCD"><a href="#details">التفاصيل</a><section id="details">ملف فعلي</section></body></html>';
previewCustomerReport(html);
assert.match(dialog.innerHTML,/sandbox="allow-same-origin allow-modals"/);assert.ok(dialog.open);events.get('frame-load')();
const download=control('[data-cp-download]');assert.equal(download.download,'عرض-تصميم-المطبخ-D-0123456789ABCD.html');
assert.equal(frame.srcdoc,html.replace('<head>','<head><base href="about:srcdoc">'),'preview embeds the same report with local fragment navigation');
assert.equal(frame.src,undefined);assert.equal(await (await fetch(download.href)).text(),html);
control('[data-cp-print]').onclick();assert.ok(frame.contentWindow.printed);
frameEvents.get('keydown')({key:'Escape',preventDefault(){}});assert.ok(dialog.removed&&opener.focused);
await assert.rejects(fetch(download.href));
const realTimer=globalThis.setTimeout;globalThis.setTimeout=(f,ms)=>{assert.equal(ms,12000);f();};try{downloadCustomerReport(html);}finally{globalThis.setTimeout=realTimer;}
assert.ok(clicked);assert.equal(control('external-link').download,download.download);
console.log('Customer preview and native download share the identical offline HTML and revision. Print, Escape, cleanup and opener focus verified.');
