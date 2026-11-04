import {outputStamp,stampText} from './kitchen-output-stamp.js';

const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filePart=s=>String(s).replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,100);
export function outputFilename(stamp,base,ext){
 const project=filePart(stamp.project)||'project',receipt=stamp.release?'-r'+stamp.cloudRevision+'-'+stamp.release.split(':')[1].slice(0,12):'';
 return (filePart(base)||'kitchen')+'-'+project+'-'+stamp.revision+receipt+'.'+ext;
}
export function releaseFileStamp(doc,cloudProject,receipt,scope,purpose){
 const common=outputStamp(doc,scope,purpose,{issued:receipt.issued});
 return {...common,project:doc.room.projectId||cloudProject,projectName:doc.room.name||cloudProject,cloudRevision:receipt.revision,release:receipt.receipt,status:'صادر بإيصال تصنيع'};
}
export function drawingDXF(source,stamp){
 const fields={PROJECT:stamp.project,DESIGN:stamp.revision,SCOPE:stamp.scope,PURPOSE:stamp.purpose,STATUS:stamp.status,ISSUED:stamp.issued,
  ...(stamp.release?{CLOUD_REVISION:stamp.cloudRevision,RECEIPT:stamp.release}:{})};
 // Group 999 is a comment, not an entity. Keep legacy ASCII readers and their geometry untouched.
 const comments=Object.entries(fields).map(([key,value])=>{
  const safe=String(value).replace(/[\x00-\x1f\x7f]/g,' ').replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  return (key+'='+safe).match(/.{1,230}/g).map(line=>'999\r\n'+line+'\r\n').join('');
 }).join('');
 return comments+source;
}
export function drawingSVG(source,stamp){
 const tag=source.match(/^\s*<svg\b[^>]*>/)?.[0],box=tag?.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/[ ,]+/).map(Number);
 if(!box||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)throw Error('تعذّر تحديد نطاق الرسم للتصدير.');
 const width=1200,height=width*box[3]/box[2],footer=82;
 // Nest the original viewBox without translating its geometry, including negative origins.
 const nested=source.replace(tag,tag.replace(/\s(?:width|height)="[^"]*"/g,'').slice(0,-1)+' width="'+width+'" height="'+height+'">');
 const line=(y,s,size)=>'<text x="1182" y="'+y+'" direction="rtl" text-anchor="start" font-family="sans-serif" font-size="'+size+'" fill="#183c34">'+xml(s)+'</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+(height+footer)+'" viewBox="0 0 '+width+' '+(height+footer)+'"><title>'+xml(stampText(stamp))+'</title>'+nested+'<rect y="'+height+'" width="'+width+'" height="'+footer+'" fill="#f8f8f4"/>'+
  line(height+32,stamp.purpose+' · '+stamp.scope+' · '+stamp.status+' · '+stamp.issued.slice(0,10),20)+
  line(height+64,'رقم المشروع '+stamp.project+'   |   نسخة التصميم '+stamp.revision,21)+'</svg>';
}
