import assert from 'node:assert/strict';
import {packFieldFiles,unpackFieldFiles} from '../public/kitchen-field-files.js';
const text='قياس 550 مم\n'.repeat(12544),blob=new Blob([text],{type:'text/plain'}),meta={id:'doc-inspect',size:blob.size,type:blob.type,name:'رفع.txt'};
const room={fieldRegister:{version:1,records:[{attachments:[meta]},{attachments:[{...meta,name:'مرجع قراءة ثانية.txt'}]}]}};
const portable=await packFieldFiles(room,{get:async id=>id===meta.id?blob:null});assert.equal(portable.length,1);
const remote=unpackFieldFiles(JSON.parse(JSON.stringify(room)),JSON.parse(JSON.stringify(portable)));assert.equal(remote.get(meta.id).type,'text/plain');assert.equal(await remote.get(meta.id).text(),text);
assert.throws(()=>unpackFieldFiles(room,[]));assert.throws(()=>unpackFieldFiles(room,[{id:'different',data:portable[0].data}]));assert.throws(()=>unpackFieldFiles(room,[{id:meta.id,data:'@'.repeat(portable[0].data.length)}]));
await assert.rejects(packFieldFiles(room,{get:async()=>null}));assert.deepEqual(await packFieldFiles({}),[]);assert.equal(unpackFieldFiles({},[]).size,0);
console.log('Portable technician documents: shared attachments round-trip byte for byte once, missing/bad payloads rejected, legacy documents stay importable.');
