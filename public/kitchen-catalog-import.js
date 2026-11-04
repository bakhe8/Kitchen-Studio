import {ownKey} from './kitchen-safe-keys.js';
import {assistFold,assistNumber} from './kitchen-measurement-identity.js';
import {cleanCatalog,getFactoryCatalog,factoryKinds} from './kitchen-workshop-factory.js';
import {reconcileWorkshopCatalogs} from './kitchen-catalog-records.js';

export const importColumns={
 sku:['رمز الصنف','sku','item code','كود','كود الصنف','رمز','رقم الصنف'],
 name:['اسم الصنف','name','item name','description','الوصف','الصنف'],
 kind:['نوع الخام','kind','type','النوع','نوع الصنف','نوع'],
 role:['استخدام الخام','role','الاستخدام'],
 length:['طول الخام مم','stockLengthMm','stock length mm','طول العود مم','الطول مم','الطول ملم','طول اللوح مم'],
 width:['عرض الخام مم','stockWidthMm','stock width mm','عرض اللوح مم','العرض مم','العرض ملم'],
 thickness:['السماكة مم','thicknessMm','thickness mm','السماكة ملم','سمك مم','سماكة مم'],
 kerf:['فاقد المنشار مم','kerfMm','kerf mm','عرض القص مم','سماكة المنشار مم'],
 color:['اللون','color','colour'],
 price:['سعر الشراء','price','purchase price','شراء','السعر','سعر الوحدة','سعر'],
 basis:['وحدة السعر','price unit','price basis','priceBasis','وحدة الشراء','وحدة التسعير','الوحدة','unit'],
 currency:['العملة','currency']
};
const norm=s=>assistFold(s).replace(/[()[\]{}._-]/g,' ').replace(/\s+/g,' ').trim();
const aliases=new Map(Object.entries(importColumns).flatMap(([key,labels])=>labels.map(label=>[norm(label),key])));
export function detectCatalogColumns(headers){return headers.map(h=>aliases.get(norm(h))||'');}
const typeMap=new Map(),basisMap=new Map(),roleMap=new Map();
function mapWords(map,key,words){for(const word of words)map.set(norm(word),key);}
mapWords(typeMap,'bar',['bar','roll','linear','profile','قضيب','قضيب أو لفة','قطاع','تيوب','عود','لفة','شريط']);
mapWords(typeMap,'panel',['panel','sheet','لوح','ألواح']);
mapWords(typeMap,'piece',['piece','each','pcs','hardware','قطعة','حبة','اكسسوار','عدد']);
for(const [key,value] of typeMap)basisMap.set(key,value);
mapWords(basisMap,'m',['m','meter','metre','متر','م','متر طولي','ر.س/م','ريال/متر']);
mapWords(basisMap,'m2',['m2','m²','sqm','م٢','م2','م²','متر مربع','م مربع','ريال/متر مربع']);
mapWords(roleMap,'body',['body','جسم','هيكل']);
mapWords(roleMap,'front',['front','facade','واجهة','درفة']);
const dimensionFields={length:['stockLengthMm',100000],width:['stockWidthMm',100000],thickness:['thicknessMm',500],kerf:['kerfMm',40]};
const hasValue=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:6}).format(n);
const skuOK=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/;
const safeText=(s,max)=>s.length<=max&&!/^[=+@]/.test(s)&&!/[\u0000-\u001f\u007f]/.test(s);
function parseItem(row,previous){
 const sku=row.sku,name=row.name||previous?.name,kind=row.kind?typeMap.get(norm(row.kind)):previous?.kind;
 if(!name||!safeText(name,84))throw Error('أدخل اسم صنف صالحًا بطول أقصاه ٨٤ حرفًا.');
 if(!kind)throw Error('حدّد نوع الخام كقضيب أو لوح أو قطعة.');
 if(previous&&previous.kind!==kind)throw Error('نوع الخام يختلف عن صنف الكتالوج الذي يحمل الرمز نفسه.');
 const item=previous?{...previous}:{sku,name,kind,role:'body',color:'',thicknessMm:0,kerfMm:0,stockLengthMm:0,stockWidthMm:0,stockUnits:null,available:true,price:null};
 item.name=name;
 if(row.role){
  const role=roleMap.get(norm(row.role));
  if(!role||role==='front'&&kind!=='panel')throw Error('استخدام الخام جسم أو واجهة؛ الواجهة تتطلب لوحًا.');
  item.role=role;
 }
 if(row.color){if(!safeText(row.color,65))throw Error('راجع اسم اللون.');item.color=row.color;}
 for(const [key,[field,max]] of Object.entries(dimensionFields)){
  if(!hasValue(row[key]))continue;
  const value=assistNumber(row[key]);
  if(value===null||value<0||value>max)throw Error('راجع «'+importColumns[key][0]+'». يلزم رقم معلوم بالملليمتر.');
  if(value>0&&((key==='length'||key==='width'||key==='kerf')&&kind==='piece'||key==='width'&&kind==='bar'))throw Error('«'+importColumns[key][0]+'» لا ينطبق على نوع الخام.');
  item[field]=value;
 }
 if(kind!=='piece'&&item.stockLengthMm<1)throw Error('طول العود أو اللوح بالملليمتر مطلوب.');
 if(kind==='panel'&&item.stockWidthMm<1)throw Error('عرض اللوح بالملليمتر مطلوب.');
 if(!previous&&kind!=='piece'&&!hasValue(row.kerf))throw Error('فاقد المنشار مطلوب للخام الجديد. أدخل صفرًا عند انطباقه.');
 if(!previous&&kind==='panel'&&item.thicknessMm<=0)throw Error('أدخل سماكة اللوح الجديد بالملليمتر.');
 if(row.currency&&!['sar','ريال','ريال سعودي','ر س','ر.س','ر.س.','﷼'].some(v=>norm(v)===norm(row.currency)))throw Error('سعر الكتالوج بالريال السعودي؛ راجع عملة المصدر.');
 const basis=row.basis&&basisMap.get(norm(row.basis));
 if(row.basis&&(!basis||!(basis===kind||basis==='m'&&kind==='bar'||basis==='m2'&&kind==='panel')))throw Error('وحدة السعر لا تتفق مع نوع الخام.');
 let priceNote='';
 if(hasValue(row.price)){
  const price=assistNumber(row.price);
  if(price===null||price<0)throw Error('سعر الشراء يحتاج رقمًا موجبًا أو صفرًا صريحًا.');
  if(!basis)throw Error('حدّد وحدة السعر لتفريق سعر القطعة أو العود أو اللوح عن سعر المتر.');
  const factor=basis==='m'?item.stockLengthMm/1000:basis==='m2'?item.stockLengthMm*item.stockWidthMm/1e6:1;
  item.price=Number((price*factor).toFixed(6));if(item.price>1e8)throw Error('سعر وحدة الشراء أكبر من الحد المقبول.');
  priceNote=basis==='m'||basis==='m2'?fmt(price)+' × '+fmt(factor)+(basis==='m'?' م':' م²')+' = '+fmt(item.price)+' ر.س/'+(kind==='bar'?'عود':'لوح'):'';
 }
 return {item,priceNote};
}
export function previewCatalogImport(doc,rows,mapping,{catalog,validate=cleanCatalog}={}){
 const base=catalog||getFactoryCatalog(doc),result={doc,base,errors:[],entries:[],added:0,updated:0,unchanged:0,next:null};
 if(!Array.isArray(rows)||rows.length<2){result.errors.push('يلزم صف عناوين وصف صنف واحد على الأقل.');return result;}
 if(rows.length>201){result.errors.push('الكتالوج يقبل ٢٠٠ صنف كحد أقصى.');return result;}
 const active=mapping.filter(Boolean);
 if(!active.includes('sku'))result.errors.push('اربط عمود رمز الصنف قبل المطابقة.');
 if(new Set(active).size!==active.length)result.errors.push('تم ربط عمودين بنفس الحقل. اختر عمودًا واحدًا لكل حقل.');
 if(active.some(k=>!ownKey(importColumns,k)))result.errors.push('ربط الأعمدة غير صالح.');
 if(active.length<2)result.errors.push('اربط حقلًا واحدًا على الأقل إلى جانب رمز الصنف.');
 for(const [index,key] of mapping.entries()){
  if(!ownKey(dimensionFields,key))continue;
  const header=norm(rows[0][index]);
  if(/(?:^|[\s/])(cm|m|inch|inches|ft|سم|م|متر|سنتيمتر|بوصة|بوصه|انش|قدم)(?:$|[\s/])/.test(header)){
   result.errors.push('عنوان «'+rows[0][index]+'» يشير إلى وحدة طول مختلفة. حوّل القيم إلى ملليمترات وغيّر عنوان العمود قبل الاستيراد.');
  }
 }
 if(result.errors.length)return result;
 const items=new Map(base.items.map(item=>[item.sku,item]));
 const codes=new Map(base.items.map(item=>[item.sku.toLowerCase(),item.sku])),seen=new Set();
 for(let i=1;i<rows.length;i++){
  const cells=rows[i],row={};mapping.forEach((key,col)=>{if(key&&hasValue(cells[col]))row[key]=String(cells[col]).trim();});
  try{
   if(cells.slice(mapping.length).some(hasValue))throw Error('يتجاوز عدد الخانات صفّ العناوين.');
   if(!skuOK.test(row.sku||''))throw Error('رمز الصنف مطلوب ويقبل الحروف الإنجليزية والأرقام و . و - و _.');
   const lower=row.sku.toLowerCase();
   if(seen.has(lower))throw Error('رمز الصنف مكرر في الملف.');
   seen.add(lower);
   if(codes.has(lower)&&!items.has(row.sku))throw Error('طابق كتابة الرمز الموجود في الكتالوج «'+codes.get(lower)+'».');
   const old=items.get(row.sku),{item,priceNote}=parseItem(row,old);
   const labels={name:'الاسم',role:'الاستخدام',color:'اللون',stockLengthMm:'الطول',stockWidthMm:'العرض',thicknessMm:'السماكة',kerfMm:'فاقد المنشار',price:'سعر الشراء'};
   const changes=old?Object.keys(labels).filter(k=>old[k]!==item[k]).map(k=>({label:labels[k],before:old[k],after:item[k]})):[];
   const status=!old?'added':changes.length?'updated':'unchanged';
   result[status]++;result.entries.push({sku:item.sku,name:item.name,kind:factoryKinds[item.kind],price:item.price,status,changes,priceNote});items.set(item.sku,item);
  }catch(e){result.errors.push('سطر '+fmt(i+1)+(row.sku?' · '+row.sku:'')+' — '+e.message);}
 }
 if(items.size>200)result.errors.push('سيصبح عدد أصناف المشروع '+fmt(items.size)+'؛ حد الكتالوج ٢٠٠.');
 if(result.errors.length)return result;
 if(!result.added&&!result.updated)return result;
 const next=validate({...base,items:[...items.values()],revision:base.revision+1,layoutRevision:base.layoutRevision||base.revision,approved:false});
 if(!next)result.errors.push('تتعارض الأصناف المستوردة مع قيود الكتالوج أو وصفة مرتبطة بها. راجع المقاسات والأدوار قبل التطبيق.');
 else result.next=next;
 return result;
}
export function applyCatalogImport(doc,preview){
 if(!preview?.next||preview.errors.length)return {ok:false,reason:'أعد معاينة كشف صالح للتطبيق.'};
 if(preview.doc!==doc||JSON.stringify(preview.base)!==JSON.stringify(getFactoryCatalog(doc)))return {ok:false,reason:'تغير المشروع أو الكتالوج منذ المعاينة. أعد معاينة الملف.'};
 const workshop=reconcileWorkshopCatalogs({...doc.room.workshop,catalog:preview.next},doc.room.workshop||{catalog:preview.base});
 return workshop?{ok:true,doc:{...doc,room:{...doc.room,workshop}}}:{ok:false,reason:'تعذّر مطابقة أصناف المتجر مع سجلات المشروع.'};
}
