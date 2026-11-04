import {ownKey} from './kitchen-safe-keys.js';
// Defaults govern proposals and estimates. They never attest a survey reading.
// A project carries the exact base values and their version; a reusable profile
// is local until explicitly adopted. No late lookup of a template from another device.
import {fieldInputByCode} from './kitchen-field-catalog.js';
import {kitchenFrontStyles,kitchenHandleStyles} from './kitchen-catalog.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {defaultSeeds} from './kitchen-defaults-seeds.js';
const globalKey='kitchen-studio:reusable-defaults:v1',MAX=1600;
const types=new Set(['text','number','boolean','choice','date']),modes=new Set(['value','na','unknown']);
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x), fail=s=>{throw Error(s);};
const text=(s,max,required=false)=>{if(s==null&&!required)return '';if(typeof s!=='string'||s.trim().length>max||/[\u0000-\u0008\u000b-\u000c\u000e-\u001f]/.test(s)||required&&!s.trim())fail('النص فارغ أو أطول من الحد المسموح.');return s.trim();};
const roomOf=d=>d?.room??d;
const storage=()=>{try{return globalThis.localStorage||null;}catch{return null;}};
const normMemo=new Map(),normText=s=>s.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
// Every default lookup folds the same few hundred property names again; a bounded memo keeps that off the hot path (a non-string still throws inside normText).
const norm=s=>{let v=normMemo.get(s);if(v===undefined){v=normText(s);if(normMemo.size>=4096)normMemo.clear();normMemo.set(s,v);}return v;};
function rowKey(code,property,itemId=''){return JSON.stringify([code,norm(property),itemId]);}
export function defaultPropertyKey(spec){return rowKey(spec.code,String(spec.property||''),spec.itemId||'');}
function number(v){if(typeof v==='number')return v;if(typeof v!=='string'||!v.trim())return NaN;const s=v.trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replace(/٫/g,'.').replace(/−/g,'-');if(!/^[+-]?(?:(?:\d{1,3}(?:[,٬]\d{3})+)|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s))return NaN;return Number(s.replace(/[,٬]/g,''));}
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function row(raw){
 if(!plain(raw)||!fieldInputByCode.has(raw.code))fail('اختر بندًا من قاموس المدخلات.');
 const property=text(raw.property,240,true),itemId=text(raw.itemId,180),type=raw.type??'text',mode=raw.mode??'value',unit=text(raw.unit,60);
 if(!types.has(type)||!modes.has(mode))fail('نوع القيمة أو طريقة استعمالها غير صالح.');
 let value=null;
 if(mode==='value'){const v=raw.value;if(type==='number'){value=number(v);if(!Number.isFinite(value)||Math.abs(value)>1e15)fail('أدخل رقمًا صالحًا للافتراضي.');}
 else if(type==='boolean'){if(v===true||v==='true')value=true;else if(v===false||v==='false')value=false;else fail('اختر نعم أو لا.');}
 else{value=text(v,2200,true);if(type==='date'&&!isDate(value))fail('أدخل تاريخًا صالحًا.');}}
 const r={code:raw.code,property,itemId,type,unit,mode,value};validateCurated(r);return r;
}
const commercial=(r)=>r?.code==='MFG-09'&&norm(r.property)===norm('سعر متر سطح العمل المربع')?'price':r?.code==='MFG-06'&&norm(r.property)===norm('نسبة احتياط سطح العمل')?'waste':'';
const templateItem=r=>!r.itemId||commercial(r)&&ownKey(kitchenWorktopFinishes,r.itemId);
function validateCurated(r){
 if(r.mode!=='value')return;const prop=norm(r.property),u=norm(r.unit).replace(/ة/g,'ه'),c=commercial(r);
 if(c){if(r.type!=='number'||r.value<0)fail('سعر الخامة والاحتياط يحتاجان إلى رقم غير سالب.');if(c==='price'&&!['ريال/م2','رس/م2','sar/m2','ريالسعودي/م2'].includes(u.replace(/[.\s]/g,'')))fail('أدخل سعر الخامة بالريال للمتر المربع.');if(c==='waste'&&!['%','٪','بالمئه','بالمائه'].includes(u))fail('وحدة الاحتياط نسبة مئوية (%).');return;}
 const bands=new Map([['عمق الصف العلوي',[150,1500]],['عمق الصف السفلي',[150,1500]],['ارتفاع جسم الصف العلوي',[150,4000]],['ارتفاع جسم الصف السفلي',[150,4000]],['منسوب تركيب الصف العلوي',[0,6000]]]),band=bands.get(prop);
 if(r.code==='CAT-03'&&band){
  const scales={مم:1,ملم:1,ملليمتر:1,مليمتر:1,mm:1,سم:10,سنتيمتر:10,cm:10,م:1000,متر:1000,m:1000},v=ownKey(scales,u)?r.value*scales[u]:NaN;
  if(r.type!=='number'||!Number.isFinite(v)||v<band[0]||v>band[1])fail(r.property+' بين '+band[0]+' و'+band[1]+' مم. استخدم مم أو سم أو م.');return;
 }
 const table=r.code==='CAT-06'&&prop===norm('خامة واجهة الوحدة الجديدة')?kitchenFrontFinishes:r.code==='CAT-17'&&prop===norm('خامة سطح العمل الجديد')?kitchenWorktopFinishes:r.code==='CAT-08'&&prop===norm('شكل واجهة الوحدة الجديدة')?kitchenFrontStyles:r.code==='CAT-12'&&prop===norm('مقبض الوحدة الجديدة')?kitchenHandleStyles:null;
 if(table&&(!['choice','text'].includes(r.type)||!ownKey(table,r.value)&&!Object.values(table).some(e=>norm(e.label)===norm(r.value))))fail('اختر '+r.property+' من مكتبة الاستوديو.');
}
function rows(src,base=false){if(!Array.isArray(src)||src.length>MAX)fail('قائمة الافتراضيات غير صالحة أو كبيرة جدًا.');const seen=new Set();return src.map(v=>{const r=row(v),k=defaultPropertyKey(r);if(seen.has(k))fail('تكرّر الافتراضي نفسه في النطاق ذاته.');if(base&&!templateItem(r))fail('لا يشمل القالب المشترك استثناءات عناصر المشروع. يمكن مشاركة سعر واحتياط خامة من الكتالوج.');seen.add(k);return r;});}
const defaultBase=()=>({kind:'builtin',name:'افتراضيات الاستوديو',version:1,rows:rows(defaultSeeds,true)});
function profile(src){if(!plain(src)||!['builtin','profile'].includes(src.kind)||!Number.isSafeInteger(src.version)||src.version<1||src.version>1e9)fail('مرجع إصدار قالب الافتراضيات غير صالح.');return {kind:src.kind,name:text(src.name,100,true),version:src.version,rows:rows(src.rows,true)};}
function project(raw){if(!plain(raw)||raw.version!==1)fail('صيغة افتراضيات المشروع غير مدعومة.');return {version:1,base:profile(raw.base),overrides:rows(raw.overrides)};}
export function cleanProjectDefaults(raw){if(raw==null)return null;try{return project(raw);}catch{return null;}}
export function getReusableDefaults(store=storage()){try{const s=store?.getItem(globalKey);if(!s)return null;const p=profile(JSON.parse(s));return p.kind==='profile'?p:null;}catch{return null;}}
export function getProjectDefaultProfile(doc){return roomOf(doc)?.defaults?project(roomOf(doc).defaults).base:defaultBase();}
function config(doc){const r=roomOf(doc);return r?.defaults?project(r.defaults):{version:1,base:defaultBase(),overrides:[]};}
export function newProjectDefaultRoom(room,store=storage()){if(room.defaults!=null)return room;const p=getReusableDefaults(store)||defaultBase();return {...room,defaults:{version:1,base:p,overrides:[]}};}
export function expectedDefaultSource(code){const head=String(code||'').split('-')[0];return ({SITE:'ينتظر قياس الموقع',MEP:'ينتظر تحديد الخدمة أو قياس الموقع',DOC:'ينتظر توثيق الموقع أو المرجع',USE:'ينتظر اختيار العميل',PRJ:'ينتظر بيانات المشروع أو قرار العميل',EQP:'ينتظر مواصفة الجهاز أو اختيار الموديل',CAT:'ينتظر كتالوج المصنع أو مواصفة المورد',MFG:'ينتظر قاعدة المصنع أو عرض المورد',DES:'ينتظر قرار التصميم',INS:'ينتظر توثيق التركيب أو الاعتماد'})[head]||'غير محدد بعد';}
function decorate(r,origin,p){
 const src=origin==='entity'?'استثناء العنصر · '+r.itemId:origin==='project'?'استثناء المشروع':p.name+' · إصدار '+p.version;
 return {...r,key:defaultPropertyKey(r),origin,source:src,version:p.version};
}
function resolved(doc){const cfg=config(doc),p=cfg.base,merged=new Map;const shadow=new Set(cfg.overrides.filter(r=>!r.itemId).map(defaultPropertyKey));for(const r of p.rows){if(r.itemId&&shadow.has(rowKey(r.code,r.property,'')))continue;merged.set(defaultPropertyKey(r),decorate(r,p.kind,p));}for(const r of cfg.overrides)merged.set(defaultPropertyKey(r),decorate(r,r.itemId?'entity':'project',p));return {cfg,map:merged};}
export function getEffectiveDefaults(doc){return [...resolved(doc).map.values()];}
function pending(s){const type=types.has(s.type)?s.type:'text',r={code:s.code,property:s.property,itemId:s.itemId||'',type,unit:s.unit||'',value:null,mode:'unknown'};return {...r,key:defaultPropertyKey(r),origin:'pending',source:expectedDefaultSource(r.code),version:null};}
function find(doc,s,strip=false){
 if(!s||!fieldInputByCode.has(s.code)||typeof s.property!=='string'||!norm(s.property))return null;
 const cfg=config(doc),p=cfg.base,keys=[s.property,...(Array.isArray(s.aliases)?s.aliases:[])].filter(v=>typeof v==='string'&&norm(v)).map(norm),ids=[...new Set([s.itemId||'',''])];
 for(const id of ids){if(strip&&(s.itemId||'')===id)continue;for(const k of keys){const r=cfg.overrides.find(a=>a.itemId===id&&a.code===s.code&&norm(a.property)===k);if(r)return decorate(r,id?'entity':'project',p);}}
 for(const id of ids)for(const k of keys){const r=p.rows.find(a=>a.itemId===id&&a.code===s.code&&norm(a.property)===k);if(r)return decorate(r,p.kind,p);}
 return pending(s);
}
export const resolveDefault=(doc,spec)=>find(doc,spec);
export const inheritedDefault=(doc,spec)=>find(doc,spec,true);
function update(doc,fn){try{const room=roomOf(doc);if(!plain(room))fail('المشروع غير متاح.');const cfg=config(room);fn(cfg);const checked=project(cfg);return {ok:true,room:{...room,defaults:checked}};}catch(e){return {ok:false,reason:e.message};}}
export function setProjectDefault(doc,draft){return update(doc,c=>{const r=row(draft),key=defaultPropertyKey(r),i=c.overrides.findIndex(x=>defaultPropertyKey(x)===key);if(i<0)c.overrides.push(r);else c.overrides[i]=r;});}
export function resetProjectDefault(doc,spec){return update(doc,c=>{if(!spec||!fieldInputByCode.has(spec.code)||typeof spec.property!=='string')fail('مرجع الاستثناء غير صالح.');const key=defaultPropertyKey(spec);c.overrides=c.overrides.filter(a=>defaultPropertyKey(a)!==key);});}
export function saveReusableDefaults(docOrRows,name='قالب العمل',store=storage()){
 try{if(!store)fail('تعذّر الوصول إلى تخزين هذا المتصفح.');const prior=getReusableDefaults(store),arr=Array.isArray(docOrRows)?rows(docOrRows.filter(r=>plain(r)&&typeof r.property==='string'&&templateItem(r)),true):getEffectiveDefaults(docOrRows).filter(templateItem).map(row);
 const p=profile({name:name||'قالب العمل',kind:'profile',version:(prior?.version||0)+1,rows:arr});
 if(prior&&prior.name===p.name&&JSON.stringify(prior.rows)===JSON.stringify(p.rows))return {ok:true,profile:prior,changed:false};
 try{store.setItem(globalKey,JSON.stringify(p));}catch{fail('تعذّر حفظ القالب في هذا المتصفح. بقيت افتراضيات المشروع كما هي.');}
 return {ok:true,profile:p,changed:true};
 }catch(e){return {ok:false,reason:e.message};}
}
export function adoptReusableDefaults(doc,p=getReusableDefaults()){return update(doc,c=>{if(!p)fail('لا يوجد قالب محفوظ في هذا المتصفح.');const source=profile(p);if(source.kind!=='profile')fail('اختر قالب عمل محفوظًا.');c.base=source;});}
