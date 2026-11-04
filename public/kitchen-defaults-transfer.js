// A portable OFFICE TEMPLATE, not a kitchen project backup. Canonicalize with
// the same allowlist/range checks used by the project snapshot and only permit
// documented envelope fields. Read/import preparation never writes anywhere.
import {cleanProjectDefaults} from './kitchen-defaults-model.js';
export const officeFileLimit=8*1024*1024;
const kind='kitchen-office-defaults',error=m=>{throw Error(m);};
const keys=(o,allowed)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
function checked(profile){
 if(!keys(profile,['kind','version','name','rows'])||profile.kind!=='profile'||!Array.isArray(profile.rows)||profile.rows.length>1600||!profile.rows.every(r=>keys(r,['code','property','itemId','type','unit','mode','value'])))error('محتوى الملف ليس قالب مكتب صالحًا.');
 const data=cleanProjectDefaults({version:1,base:profile,overrides:[]});
 if(!data)error('القالب غير صالح أو يتضمن إعدادات تخص عناصر مشروع.');
 return data.base;
}
export function packOfficeTemplate(profile){
 if(!profile)error('احفظ قالب المكتب على هذا الجهاز قبل تنزيله.');
 const body=JSON.stringify({type:kind,version:1,profile:checked(profile)},null,2);
 if(new Blob([body]).size>officeFileLimit)error('يتجاوز حجم القالب الحد المتاح (8 م.ب).');return body;
}
export function unpackOfficeTemplate(text){
 if(typeof text!=='string'||text.length>officeFileLimit||new Blob([text]).size>officeFileLimit)error('يتجاوز حجم الملف الحد المتاح (8 م.ب).');
 let data;try{data=JSON.parse(text);}catch{error('تعذّرت قراءة JSON. اختر ملف قالب المكتب الصحيح.');}
 if(!keys(data,['type','version','profile'])||data.type!==kind||data.version!==1)error('اختر ملف قالب مكتب من الاستوديو، وليس ملف المشروع.');
 return checked(data.profile);
}
