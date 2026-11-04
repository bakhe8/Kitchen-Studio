import {outputApprovalState} from './kitchen-workshop-state.js';
import {offlineDigest} from './kitchen-workshop-revision.js';

export {newKitchenReference,identifiedProject} from './kitchen-project-identity.js';
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
export function outputStamp(doc,scope,purpose,{state=outputApprovalState(doc),issued=new Date().toISOString()}={}){
 const {room}=doc,{valid}=state;
 // The approval receipt covers the customer order. Presentation finishes are also visible on the signed image.
 const backgrounds=Object.fromEntries(Object.entries(room.photoRefs||{}).filter(([,id])=>id&&id!=='off'));
 const appearance=[room.colors||{},room.cladding??null,room.floor||'wood',room.backsplash||{finish:'tile',height:56},backgrounds];
 const revision='D-'+offlineDigest(new TextEncoder().encode(JSON.stringify([state.keys.customer,ordered(appearance)]))).slice(0,14).toUpperCase();
 return {project:room.projectId||'مثال أو ملف قديم بلا رقم',revision,scope,purpose,issued,valid,
  status:valid.release?'معتمد للتصنيع':valid.customer?'معتمد من العميل':valid.structure?'الهيكل معتمد':'قيد المراجعة'};
}
export function stampText(s){
 return ['المشروع '+s.project,'نسخة التصميم '+s.revision,s.scope,s.purpose,s.status].join(' · ');
}
export function stampColumns(s,headers,rows){
 const prefix=[s.project,s.revision,s.scope,s.purpose,s.status,s.issued];
 return {headers:['رقم المشروع','نسخة التصميم','النطاق','غرض الملف','حالة اعتماد التصميم','تاريخ الإخراج',...headers],
  rows:(rows.length?rows:[Array(headers.length).fill('')]).map(r=>[...prefix,...r])};
}
