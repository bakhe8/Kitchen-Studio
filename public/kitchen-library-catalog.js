// Copying library records into the project's factory catalog as bought pieces (sinks, hardware, handles). The catalog import does the
// checking and keeps its own rule: a new catalog version waits for the factory's approval before it prices anything.
import {previewCatalogImport,applyCatalogImport,detectCatalogColumns} from './kitchen-catalog-import.js';

export const catalogLibraries=Object.freeze(['sink','hardware','handle']);
const header=['رمز الصنف','اسم الصنف','نوع الخام','سعر الشراء','وحدة السعر'];
const skuPattern=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/;
export const canAddToCatalog=r=>catalogLibraries.includes(r?.library)&&r.attrs?.unit!=='meter';
// The supplier's code is the item code when there is one; otherwise a code made from the record, so adding it again updates the same item.
export const catalogCode=r=>skuPattern.test(r.attrs?.code||'')?r.attrs.code:('LIB-'+String(r.id).replace(/[^A-Za-z0-9._-]/g,'').slice(0,43));

export function catalogRows(records){
 const rows=[header],skipped=[];
 for(const r of records){
  if(!catalogLibraries.includes(r.library))skipped.push({label:r.label,reason:'هذه المكتبة لا تُضاف إلى كتالوج المصنع.'});
  else if(r.attrs.unit==='meter')skipped.push({label:r.label,reason:'يُسعَّر بالمتر. أضِفه من ملف الكتالوج مع طول العود.'});
  else rows.push([catalogCode(r),r.label.slice(0,84),'قطعة',r.price??'','قطعة']);
 }
 return {rows,skipped};
}
export function addToCatalog(doc,records){
 const {rows,skipped}=catalogRows(records);
 if(rows.length<2)return {ok:false,reason:skipped[0]?.reason||'اختر سجلًا أولًا.',skipped};
 const preview=previewCatalogImport(doc,rows,detectCatalogColumns(rows[0]));
 if(preview.errors.length)return {ok:false,reason:preview.errors[0],errors:preview.errors,skipped};
 if(!preview.next)return {ok:true,doc,unchanged:true,added:0,updated:0,count:preview.unchanged,skipped};
 const out=applyCatalogImport(doc,preview);
 return out.ok?{ok:true,doc:out.doc,added:preview.added,updated:preview.updated,count:preview.added+preview.updated,revision:preview.next.revision,skipped}:{ok:false,reason:out.reason,skipped};
}
