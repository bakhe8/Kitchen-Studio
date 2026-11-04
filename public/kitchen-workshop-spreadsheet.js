// Spreadsheet data stays on the tablet. Quoted fields may contain separators
// and line breaks, so paste from Excel and exported CSV use the same reader.
const maxBytes=2*1024*1024;
const maxRows=3000,maxColumns=90,maxCell=8000;
function delimiter(text){
 const counts=new Map([['\t',0],[';',0],[',',0]]);
 let quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"')i++;else quoted=!quoted;}
  else if(!quoted){
   if(char==='\r'||char==='\n')break;
   if(counts.has(char))counts.set(char,counts.get(char)+1);
  }
 }
 return [...counts].sort((a,b)=>b[1]-a[1])[0][0];
}
export function parseWorkshopTable(source){
 if(typeof source!=='string'||source.length>maxBytes)throw Error('حجم نص الجدول يتجاوز ٢ ميبيبايت.');
 let text=source.replace(/^\uFEFF/,'').replace(/^(?:[ \t]*\r?\n)+/,'');
 const spec=/^sep=([,;\t])\r?\n/i.exec(text);
 const separator=spec?spec[1]:delimiter(text);
 if(spec)text=text.slice(spec[0].length);
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 function endCell(){
  if(row.length>=maxColumns||cell.length>maxCell)throw Error('عدد الأعمدة أو طول الخانة يتجاوز حد الاستيراد.');
  row.push(cell.trim());cell='';closed=false;
 }
 function endRow(){
  endCell();if(row.some(Boolean))rows.push(row);row=[];
  if(rows.length>maxRows)throw Error('عدد صفوف الجدول يتجاوز ٣٠٠٠.');
 }
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'){
    if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}
   }else cell+=ch;
  }else if(ch===separator)endCell();
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;endRow();}
  else if(ch==='"'){
   if(cell||closed)throw Error('علامات تنصيص غير صالحة في الجدول.');
   quoted=true;
  }else if(closed){
   if(ch!==' '&&ch!=='\t')throw Error('يوجد نص بعد إغلاق الخانة المقتبسة.');
  }else cell+=ch;
 }
 if(quoted)throw Error('إحدى خانات الجدول تفتقد علامة التنصيص الختامية.');
 endRow();
 if(!rows.length)throw Error('الجدول فارغ.');
 return rows;
}
export async function openWorkshopTables(file){
 if(!file)throw Error('اختر ملفًا من الجهاز.');
 const ext=(file.name||'').split('.').pop().toLowerCase();
 if(ext==='xlsx'){
  const {readWorkshopSpreadsheet}=await import('./kitchen-workbook-reader.js');
  return readWorkshopSpreadsheet(file);
 }
 if(!['csv','tsv','txt'].includes(ext))throw Error('استخدم ملف XLSX أو CSV أو TSV، أو الصق الخلايا من Excel.');
 if(file.size>maxBytes)throw Error('حجم ملف النص يتجاوز ٢ ميبيبايت.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff?'utf-16be':'utf-8';
 let text;try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw Error('تعذر قراءة ترميز الجدول. احفظه بصيغة CSV UTF-8 أو الصق الخلايا من Excel.');}
 return {sheets:[{name:file.name,rows:parseWorkshopTable(text)}]};
}
