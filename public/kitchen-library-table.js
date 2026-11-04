// A library as a table: the columns of its template, the rows to export, and the preview of an import. Excel, CSV and pasted cells all arrive
// here as rows of text, so a file is checked the same way as a form: every bad row is reported at once and nothing is kept until all are valid.
import {libraryDefs,statusNames} from './kitchen-library-defs.js';
import {assistFold,assistNumber} from './kitchen-measurement-identity.js';
import {idPattern} from './kitchen-library-store.js';

export const maxImportRows=500;
const norm=s=>assistFold(s).replace(/[()[\]{}._·\-/]/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>new Intl.NumberFormat('ar-SA').format(n);
const plain=label=>String(label).replace(/\s*·\s*(?:مم|سم|كغ)\s*$/,'');
const empty=v=>v===undefined||v===null||String(v).trim()==='';
const common={
 id:['id','المعرف','رمز السجل'],label:['name','label','الاسم','اسم','الوصف','اسم الصنف','الاسم الكامل'],family:['family','type','الفئة','النوع','نوع','الصنف'],
 price:['price','السعر','سعر','سعر الشراء','سعر الوحدة','التكلفة'],status:['status','الحالة'],note:['note','notes','ملاحظة','ملاحظات']
};
// Columns in template order: id, name, family, the library's own fields, price, status, note.
export function libraryColumns(library){
 const def=libraryDefs[library];if(!def)return [];
 return [
  {key:'id',label:'المعرف',aliases:common.id},{key:'label',label:'الاسم',aliases:common.label},{key:'family',label:'الفئة',aliases:common.family},
  ...def.fields.map(f=>({key:'attrs.'+f.key,label:f.label,aliases:[f.key,f.label,plain(f.label)],field:f})),
  {key:'price',label:'السعر',aliases:common.price},{key:'status',label:'الحالة',aliases:common.status},{key:'note',label:'ملاحظة',aliases:common.note}
 ];
}
export const templateRows=library=>[libraryColumns(library).map(c=>c.label)];
export function detectColumns(library,headers){
 const byAlias=new Map;
 for(const c of libraryColumns(library))for(const a of c.aliases)if(!byAlias.has(norm(a)))byAlias.set(norm(a),c.key);
 return headers.map(h=>byAlias.get(norm(h))||'');
}
const familyLabel=(def,k)=>def.families[k]??k;
const pickLabel=(f,v)=>f.options?.[v]??v;
// What a person reads in the file: names, not internal keys.
export function exportRows(store,library,{includeHidden=true}={}){
 const def=libraryDefs[library],cols=libraryColumns(library);
 const value=(r,c)=>c.key==='id'?r.id:c.key==='label'?r.label:c.key==='family'?familyLabel(def,r.family):c.key==='price'?(r.price??''):c.key==='status'?statusNames[r.status]:c.key==='note'?r.note:
  (v=>v===undefined?'':c.field.type==='pick'?pickLabel(c.field,v):v)(r.attrs[c.key.slice(6)]);
 return [cols.map(c=>c.label),...store.list(library,{includeHidden}).map(r=>cols.map(c=>value(r,c)))];
}
export function toCSV(rows){
 const cell=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 return '﻿'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}

function byWords(options,text){
 const t=norm(text);
 return Object.entries(options).find(([k,l])=>norm(k)===t||norm(l)===t)?.[0];
}
const statusWords={draft:['draft','مسودة','مسوده'],approved:['approved','معتمد','معتمدة','معتمده']};
function parseStatus(text){
 const t=norm(text);return Object.entries(statusWords).find(([,words])=>words.some(w=>norm(w)===t))?.[0];
}

// Check a table against a library without keeping anything. `mapping` has one column key (or '') per column of the table.
export function previewImport(store,library,rows,mapping){
 const def=libraryDefs[library],result={errors:[],entries:[],validated:[],added:0,updated:0,unchanged:0};
 if(!def){result.errors.push('مكتبة غير معروفة.');return result;}
 if(!Array.isArray(rows)||rows.length<2){result.errors.push('يلزم صف عناوين وصف واحد على الأقل.');return result;}
 if(rows.length>maxImportRows+1){result.errors.push('يقبل الاستيراد '+fmt(maxImportRows)+' سجلًا في المرة الواحدة.');return result;}
 const active=mapping.filter(Boolean);
 // A row names its record either by id (to update one that exists, such as a price for a record the program ships) or by name and family.
 if(!active.includes('id')&&(def.closed||!active.includes('label')||!active.includes('family')))
  result.errors.push(def.closed?'اربط عمود المعرف.':!active.includes('label')?'اربط عمود الاسم.':'اربط عمود الفئة.');
 if(new Set(active).size!==active.length)result.errors.push('رُبط عمودان بالحقل نفسه. اختر عمودًا واحدًا لكل حقل.');
 const valid=new Set(libraryColumns(library).map(c=>c.key));
 if(active.some(k=>!valid.has(k)))result.errors.push('ربط الأعمدة غير صالح.');
 if(result.errors.length)return result;
 const own=store.list(library,{includeHidden:true,source:'own'}).concat(store.list(library,{includeHidden:true,source:'import'}));
 const seen=new Set;
 for(let i=1;i<rows.length;i++){
  const cells=rows[i],line=fmt(i+1),row={attrs:{}};
  if(!mapping.some((key,col)=>key&&!empty(cells[col])))continue;
  mapping.forEach((key,col)=>{
   if(!key||empty(cells[col]))return;
   const v=String(cells[col]).trim();
   if(key.startsWith('attrs.'))row.attrs[key.slice(6)]=v;else row[key]=v;
  });
  const name=row.label||row.id||'';
  try{
   if(cells.slice(mapping.length).some(v=>!empty(v)))throw Error('يتجاوز عدد الخانات صفّ العناوين.');
   if(row.id&&!idPattern.test(row.id))throw Error('المعرف يقبل الحروف الإنجليزية والأرقام و . و - و _.');
   if(row.family){const f=byWords(def.families,row.family);if(!f)throw Error('الفئة «'+row.family+'» غير معروفة. المقبول: '+Object.values(def.families).join('، ')+'.');row.family=f;}
   for(const f of def.fields){
    if(f.type!=='pick'||empty(row.attrs[f.key]))continue;
    const k=byWords(f.options,row.attrs[f.key]);if(!k)throw Error('«'+plain(f.label)+'» القيمة «'+row.attrs[f.key]+'» غير معروفة. المقبول: '+Object.values(f.options).join('، ')+'.');row.attrs[f.key]=k;
   }
   if(row.status){const s=parseStatus(row.status);if(!s)throw Error('الحالة «'+row.status+'» غير معروفة. المقبول: مسودة أو معتمد.');row.status=s;}
   // An existing record is found by its id, or else by the same name in the same family among the factory's own records.
   let match=row.id?store.get(library,row.id):null;
   if(!match&&!row.id&&row.label)match=own.find(r=>r.family===row.family&&norm(r.label)===norm(row.label))||null;
   if(!match&&row.id&&(!row.label||!row.family))throw Error(def.closed?'هذه المكتبة ثابتة في البرنامج؛ لا تقبل سجلات جديدة.':'المعرف «'+row.id+'» غير موجود في المكتبة. لإضافة سجل جديد أدخل اسمه وفئته.');
   if(!match&&!row.id&&!row.label&&!row.family)throw Error('أدخل المعرف، أو الاسم والفئة.');
   const key=match?match.id:'new:'+norm(row.label)+'/'+row.family;
   if(seen.has(key))throw Error('السجل مكرر في الملف.');
   seen.add(key);
   const input=match?(match.shipped?{...row,id:match.id,price:row.price??match.price,status:row.status??match.status,note:row.note??match.note}:
     {...match,...row,id:match.id,attrs:{...match.attrs,...row.attrs},price:'price' in row?row.price:match.price,status:row.status??match.status,note:'note' in row?row.note:match.note}):
     {...row,source:'import'};
   const v=store.validate(library,input);
   if(!v.ok)throw Error(v.reason);
   const before=match,after=v.kind==='note'?{...match,...v.note,attrs:v.note.supplierCode?{...match.attrs,supplierCode:v.note.supplierCode}:match.attrs}:v.record;
   const same=before&&['label','family','price','status','note'].every(k=>String(before[k]??'')===String(after[k]??''))&&JSON.stringify(before.attrs)===JSON.stringify(after.attrs);
   const state=!before?'added':same?'unchanged':'updated';
   result[state]++;result.entries.push({line,label:after.label||name,state,shipped:!!match?.shipped});
   if(state!=='unchanged')result.validated.push(v);
  }catch(e){result.errors.push('سطر '+line+(name?' · '+name:'')+' — '+e.message);}
 }
 return result;
}
export async function applyImport(store,library,preview){
 if(!preview||preview.errors.length)return {ok:false,reason:'صحّح الملاحظات ثم أعد المعاينة.'};
 if(!preview.validated.length)return {ok:true,count:0};
 return store.commit(library,preview.validated);
}
