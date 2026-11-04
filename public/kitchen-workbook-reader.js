// Bound the unpacked data and sparse grid before the workbook parser allocates
// its rectangular arrays. Values stay on the user's device.
const MiB=1024*1024;
class WorkbookLimit extends Error {}
function checkArchive(bytes,unzipSync){
 let total=0,files=0;
 const xml=unzipSync(bytes,{filter(entry){
  files++;total+=entry.originalSize;
  if(files>512||total>24*MiB||entry.originalSize>10*MiB)
   throw new WorkbookLimit('حجم بيانات Excel بعد فك الضغط كبير. احفظ جدول الأصناف أو القطع في ملف أصغر.');
  return /\.xml$/i.test(entry.name);
 }});
 let cells=0,sheets=0;
 for(const content of Object.values(xml)){
  const data=new TextDecoder().decode(content);
  if(!/<(?:[\w.-]+:)?sheetData(?:[\s/>])/.test(data))continue;
  if(/<(?:[\w.-]+:)?c\s+[^<>]*?\bt\s*=\s*["']e["']/.test(data))throw new WorkbookLimit('توجد خلية Excel فيها خطأ حسابي. صحّح قيم الكشف واحفظ المصنف مجددًا.');
  if(++sheets>24)throw new WorkbookLimit('الحد ٢٤ ورقة لكل ملف.');
  let lastRow=0,lastColumn=0;
  for(const cell of data.matchAll(/<(?:[\w.-]+:)?c\s+[^<>]*?\br\s*=\s*["']([A-Za-z]+)(\d+)["']/g)){
   const col=[...cell[1].toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
   lastRow=Math.max(lastRow,Number(cell[2]));lastColumn=Math.max(lastColumn,col);
   if(lastRow>5000||lastColumn>100)throw new WorkbookLimit('الورقة تتجاوز ٥٠٠٠ صف أو ١٠٠ عمود. انسخ نطاق البيانات المطلوب إلى ملف مستقل.');
  }
  cells+=lastRow*lastColumn;
  if(cells>600000)throw new WorkbookLimit('نطاق الجداول كبير. احتفظ بأوراق الأصناف أو كشف الورشة فقط.');
  // A formula with no saved result must not quietly become an empty price.
  if(/<(?:[\w.-]+:)?f[\s/>]/.test(data)){
   // One forward pass. The lazy ([\s\S]*?) used here before rescanned to the end of the sheet for every unclosed <c>,
   // so a crafted sheet cost O(n^2). An unclosed cell, and every cell after it, has nothing left to inspect.
   const open=/<(?:[\w.-]+:)?c(?:\s[^<>]*?)?(?<!\/)>/g,close=/<\/(?:[\w.-]+:)?c>/g;
   while(open.exec(data)){
    close.lastIndex=open.lastIndex;const tail=close.exec(data);if(!tail)break;
    const cell=data.slice(open.lastIndex,tail.index);open.lastIndex=close.lastIndex;
    if(/<(?:[\w.-]+:)?f[\s/>]/.test(cell)&&!/<(?:[\w.-]+:)?v(?:\s[^<>]*)?>\s*[^\s<]/.test(cell))
     throw new WorkbookLimit('يحتوي Excel على معادلة بلا نتيجة محفوظة. أعد الحساب والحفظ أو الصق القيم فقط.');
   }
  }
 }
}
export async function readWorkshopSpreadsheet(file){
 if(!file||!file.size||file.size>4*MiB)throw Error('اختر ملف Excel بصيغة XLSX لا يتجاوز ٤ ميبيبايت.');
 const {readXlsx,unzipSync}=await import('./vendor/workshop-xlsx.mjs');
 try{
  const data=await file.arrayBuffer();
  checkArchive(new Uint8Array(data),unzipSync);
  const parsed=await readXlsx(data);
  if(!parsed.length||parsed.length>24)throw new WorkbookLimit('يجب أن يحتوي الملف على ورقة واحدة إلى ٢٤ ورقة.');
  const sheets=parsed.map(({sheet,data:rows})=>{
   if(rows.length>5000||rows.some(row=>row.length>100))throw new WorkbookLimit('الورقة تتجاوز حد الصفوف أو الأعمدة.');
   return {name:sheet,rows:rows.map(row=>Array.from(row,v=>v==null?'':v instanceof Date?v.toISOString().slice(0,10):String(v)))};
  });
  return {sheets};
 }catch(error){
  if(error instanceof WorkbookLimit)throw error;
  throw Error('تعذّرت قراءة مصنف Excel. استخدم ملف XLSX سليمًا وغير محمي بكلمة مرور أو الصق الخلايا من Excel.');
 }
}
