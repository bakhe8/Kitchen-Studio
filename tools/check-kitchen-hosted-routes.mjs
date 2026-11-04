import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {studioEntryResponse} from '../worker/studio-entry.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const main=read('public/index.html'),unit=read('public/unit.html');
assert.ok(main.includes('kitchen-app.js')&&unit.includes('script'));
for(const [path,html] of [['/?tool=row',main],['/?tool=row&panel=workshop&step=survey',main],['/index.html',main],['/unit.html?view=kitchen-unit&unit=k-37',unit]]){
 const request=new Request('https://studio.example'+path);
 const r=studioEntryResponse(request,main,unit);assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/text\/html/);assert.equal(await r.text(),html);
 const head=studioEntryResponse(new Request(request,{method:'HEAD'}),main,unit);assert.equal(await head.text(),'');assert.equal(head.headers.get('Location'),null);
 for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(existsSync(new URL('../public/'+m[1],import.meta.url)),m[1]);
}
// Entry documents carry framing, referrer and feature headers. Scripts are report-only until the browser console is clean.
for(const path of ['/','/index.html','/unit.html']){
 const r=studioEntryResponse(new Request('https://studio.example'+path),main,unit);
 assert.equal(r.headers.get('X-Frame-Options'),'SAMEORIGIN');
 assert.equal(r.headers.get('Referrer-Policy'),'same-origin');
 assert.match(r.headers.get('Permissions-Policy'),/geolocation=\(\)/);
 assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
 const csp=r.headers.get('Content-Security-Policy-Report-Only');assert.match(csp,/script-src 'self'/);assert.match(csp,/object-src 'none'/);
 assert.equal(r.headers.get('Content-Security-Policy'),null,'not enforced yet');
}
for(const path of ['/examples/kitchen-5x5.html','/examples/kitchen-5x5.svg']){
 for(const method of ['GET','HEAD']){
  const retired=studioEntryResponse(new Request('https://studio.example'+path+'?v=62',{method}),main,unit);
  assert.equal(retired.status,410);
  assert.equal(retired.headers.get('Cache-Control'),'no-store');
  assert.ok(!(await retired.text()).includes('<svg'));
 }
}
for(const path of ['/api/projects','/kitchen-app.js','/studio-mark.svg'])assert.equal(studioEntryResponse(new Request('https://studio.example'+path),main,unit),null);
assert.equal(studioEntryResponse(new Request('https://studio.example/',{method:'POST'}),main,unit),null);
console.log('Hosted routes: root and unit URLs retain queries, exact Arabic HTML and local assets, HEAD and API passthrough.');
