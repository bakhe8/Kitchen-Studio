import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {machiningSheet,processNames} from './kitchen-machining.js';
import {elevationSheet} from './kitchen-sheet.js';
import {proposalScene} from './kitchen-proposal-presentation.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positive=value=>finite(value)&&value>0;
const num=value=>String(Math.round(value*1000)/1000);
const fmt=value=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(value);
const stroke=' vector-effect="non-scaling-stroke"';
const text=(x,y,value,size=18,more='')=>'<text x="'+num(x)+'" y="'+num(y)+'" font-size="'+num(size)+'" font-family="system-ui, sans-serif"'+(/\bfill=/.test(more)?'':' fill="#355247"')+' text-anchor="middle" direction="rtl" '+more+'>'+esc(value)+'</text>';
const rect=(x,y,w,h,more='')=>'<rect x="'+num(x)+'" y="'+num(y)+'" width="'+num(w)+'" height="'+num(h)+'" '+more+'/>';
const line=(x1,y1,x2,y2,more='')=>'<line x1="'+num(x1)+'" y1="'+num(y1)+'" x2="'+num(x2)+'" y2="'+num(y2)+'" '+more+'/>';
const svg=(box,title,body,view)=>'<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(title)+'" data-production-drawing="'+esc(view)+'" viewBox="'+box.map(num).join(' ')+'" preserveAspectRatio="xMidYMid meet"><title>'+esc(title)+'</title>'+body+'</svg>';
const empty=caption=>({html:svg([0,0,640,240],caption,text(320,120,caption,17),'empty'),caption});
const sameDimension=(a,b)=>a===b||(a==null&&b==null);
const pointsMarkup=points=>points.map(([x,y])=>num(x)+','+num(y)).join(' ');
const validPoints=points=>Array.isArray(points)&&points.length>=3&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite));

function pieceOutline(piece,catalog,w,h){
 const edge=piece.cutEnvelope;
 if(edge&&positive(edge.width)&&Array.isArray(edge.left)&&Array.isArray(edge.right)&&edge.left.length===2&&edge.right.length===2&&[...edge.left,...edge.right].every(finite)){
  return {points:[[edge.left[0],0],[edge.right[0],0],[edge.right[1],edge.width],[edge.left[1],edge.width]],caption:'حدود المقطع بعد قص الأطراف من غلاف القص المحسوب.'};
 }
 if(validPoints(piece.scribe?.points)){
  const shape=piece.scribe,grain=catalog.scribePolicies?.[piece.recipeId]?.grain;
  const swapped=grain==='vertical'||grain==null&&w===shape.blankHeightMm&&h===shape.blankWidthMm&&w!==h;
  const points=shape.points.map(([x,y])=>swapped?[y,x]:[x,y]);
  if(points.every(([x,y])=>x>=0&&y>=0&&x<=w+.001&&y<=h+.001))return {points,caption:'مسار الحشوة المرفوع داخل مستطيل الخام؛ اتجاه المحاور مطابق لاتجاه الخام.'};
  return {caption:'غلاف الخام المستطيل؛ تعذّرت مطابقة اتجاه مسار الحشوة، راجع مصدره.'};
 }
 return {caption:piece.cornerCut?'مستطيل قطعة الركن من التفصيل؛ موضعها التجميعي يُراجع في رسم الوحدة.':'غلاف القص المستطيل؛ وجه التشغيل ومرجع التثبيت من الوصفة.'};
}

function operationDrawing(doc,piece,operationIndex){
 const catalog=getFactoryCatalog(doc),item=catalog.items.find(v=>v.sku===piece.sku);
 if(!['bar','panel'].includes(piece.kind))return empty('هذا صنف توريد بالقطعة؛ لا يوجد له مستوى قص خام.');
 const w=piece.a,h=piece.kind==='panel'?piece.b:item?.sectionWidthMm;
 if(!positive(w)||!positive(h))return empty('أكمل طول القطعة وعرض اللوح أو عرض المقطع الحقيقي لعرض التشغيل.');
 const font=Math.max(12,Math.min(32,w*.035)),margin=font*4,outline=pieceOutline(piece,catalog,w,h);
 const checked=machiningSheet([piece],catalog),ops=checked.operations;
 let body=rect(0,0,w,h,'data-production-plane="" fill="#f0e8d4" stroke="#879b83" stroke-width="1.4"'+stroke);
 if(outline.points)body+='<polygon points="'+pointsMarkup(outline.points)+'" fill="#dce8d4" stroke="#416957" stroke-width="1.7"'+stroke+'/>';
 body+=line(0,-font*1.5,w,-font*1.5,'stroke="#8c9e8b" stroke-width="1"'+stroke)+text(w/2,-font*2,fmt(w)+' مم',font);
 body+=text(-font*1.4,h/2,fmt(h)+' مم',font,'transform="rotate(-90 '+num(-font*1.4)+' '+num(h/2)+')"');
 body+='<circle cx="0" cy="0" r="'+num(font*.27)+'" fill="#263f49"/>'+text(0,-font*.45,'0',font*.8);
 const drawOp=(op,index)=>{
  const chosen=index===operationIndex,color=!op.ok?'#ad4d3d':chosen?'#126d56':'#365e72',size=Math.max(font*.48,2);
  let art='',x=op.x,y=op.y;
  if(!finite(x)||!finite(y))return '';
  if(op.kind==='drill')art='<circle cx="'+num(x)+'" cy="'+num(y)+'" r="'+num(op.diameter/2)+'" fill="#ffffff95" stroke="'+color+'" stroke-width="2"'+stroke+'/>';
  else if(op.kind==='mill')art=rect(x-op.length/2,y-op.width/2,op.length,op.width,'fill="#c4ded299" stroke="'+color+'" stroke-width="2"'+stroke);
  else if(op.kind==='size'){art=rect(0,0,op.length,op.width,'fill="none" stroke="'+color+'" stroke-width="2" stroke-dasharray="7 4"'+stroke);x=op.length/2;y=0;}
  else if(op.kind==='miter'||op.kind==='bend'){art=line(x,0,x,h,'stroke="'+color+'" stroke-width="2" stroke-dasharray="6 3"'+stroke);y=h/2;}
  else if(op.kind==='scribe'&&outline.points){art='<polygon points="'+pointsMarkup(outline.points)+'" fill="none" stroke="'+color+'" stroke-width="2.5"'+stroke+'/>';x=w/2;y=h/2;}
  art+=line(x-size,y,x+size,y,'stroke="'+color+'" stroke-width="1.3"'+stroke)+line(x,y-size,x,y+size,'stroke="'+color+'" stroke-width="1.3"'+stroke);
  const draggable=['drill','mill'].includes(op.kind),title=(index+1)+' · '+(processNames[op.kind]||op.kind)+' · X '+fmt(op.x)+' / Y '+fmt(op.y)+' مم · '+op.reference+' · '+op.datum+(op.ok?'':' · يحتاج مراجعة القدرة');
  art+='<circle cx="'+num(x)+'" cy="'+num(y)+'" r="'+num(Math.max(size,1))+'" fill="transparent" stroke="transparent" stroke-width="44"'+stroke+(draggable?' data-production-drag="'+index+'"':'')+' />';
  art+=text(x+font*.9,y-font*.75,String(index+1),font,'fill="'+color+'" pointer-events="none"');
  return '<g data-production-operation="'+index+'" data-selected="'+chosen+'" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title>'+art+'</g>';
 };
 // Paint the selected operation last without changing its source index.
 for(let i=0;i<ops.length;i++)if(i!==operationIndex)body+=drawOp(ops[i],i);
 if(ops[operationIndex])body+=drawOp(ops[operationIndex],operationIndex);
 const caption=piece.label+' · '+piece.sku+' · '+fmt(w)+' × '+fmt(h)+' مم. '+outline.caption+(ops.length?' علامة العملية مرتبطة بإحداثيات الوصفة؛ تحقق القدرة مستقل.':' لا توجد عمليات مسجّلة لهذه القطعة.');
 return {html:svg([-margin,-margin,w+2*margin,h+2*margin],caption,body,'operation'),caption};
}

function cutDrawing(doc,quote,piece,pieceIndex){
 const catalog=getFactoryCatalog(doc),item=catalog.items.find(v=>v.sku===piece.sku),purchase=quote.purchases?.find(v=>v.sku===piece.sku);
 if(!item||!purchase||!['bar','panel'].includes(item.kind))return empty('لا يتوفر توزيع قص خام لهذا الصنف في الحصر الحالي.');
 const isPanel=item.kind==='panel',stockHeight=isPanel?item.stockWidthMm:item.sectionWidthMm;
 if(!positive(item.stockLengthMm)||!positive(stockHeight))return empty('أبعاد الخام أو عرض المقطع غير مكتملة لعرض التوزيع.');
 const offcuts=new Map();
 for(const cut of item.offcuts||[])for(let n=1;n<=cut.count;n++)offcuts.set(cut.ref+' #'+n,{w:cut.lengthMm,h:isPanel?cut.widthMm:stockHeight});
 const groups=new Map();
 const groupFor=row=>{
  const key=JSON.stringify([row.source,row.ref]);if(groups.has(key))return groups.get(key);
  const dims=row.source==='stock'?{w:item.stockLengthMm,h:stockHeight}:row.source==='offcut'?offcuts.get(row.ref):null;
  const group={source:row.source,ref:row.ref,w:dims?.w,h:dims?.h,parts:[],leftovers:[]};groups.set(key,group);return group;
 };
 for(const row of purchase.layout||[])groupFor(row).parts.push(row);
 for(const row of purchase.leftovers||[])groupFor(row).leftovers.push(row);
 const list=[...groups.values()];if(!list.length)return empty('لا يوجد توزيع قص محسوب لهذا الصنف بعد.');
 if(list.some(g=>!positive(g.w)||!positive(g.h)))return empty('تعذّرت مطابقة مرجع أحد البواقي بأبعاده المسجّلة. راجع كتالوج الخام.');
 const matches=row=>quote.pieces.flatMap((p,index)=>p.sku===piece.sku&&p.unitId===row.unitId&&p.label===row.label&&sameDimension(p.a,row.a)&&sameDimension(p.b,row.b)?[index]:[]);
 const maxW=Math.max(...list.map(g=>g.w)),maxH=Math.max(...list.map(g=>g.h)),font=Math.max(20,Math.min(55,maxW*.022)),gap=font*4;
 const cols=Math.min(3,Math.ceil(Math.sqrt(list.length))),rows=Math.ceil(list.length/cols),cellW=maxW+gap,cellH=maxH+gap;
 const hash=Array.from(String(piece.sku)).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7),pattern='ps-cut-hatch-'+hash;
 let body='<defs><pattern id="'+pattern+'" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 18L18 0M15 21L21 15" fill="none" stroke="#a7b59d" stroke-width="1.3"/></pattern></defs>';
 let ambiguous=0;
 list.forEach((group,n)=>{
  const dx=(n%cols)*cellW+gap/2,dy=Math.floor(n/cols)*cellH+gap*.7;
  body+='<g data-production-stock="'+esc(group.ref)+'" data-production-stock-source="'+esc(group.source)+'" transform="translate('+num(dx)+' '+num(dy)+')">';
  body+=text(group.w/2,-font*.8,(group.source==='offcut'?'باقٍ · ':'خام · ')+group.ref+' · '+fmt(group.w)+' × '+fmt(group.h)+' مم',font);
  body+=rect(0,0,group.w,group.h,'fill="#f5eddb" stroke="#82947a" stroke-width="1.5"'+stroke);
  for(const left of group.leftovers){
   const height=isPanel?left.widthMm:group.h;
   if(![left.xMm,isPanel?left.yMm:0].every(finite)||!positive(left.lengthMm)||!positive(height))continue;
   body+=rect(left.xMm,isPanel?left.yMm:0,left.lengthMm,height,'data-production-leftover="" fill="url(#'+pattern+')" stroke="#9eaf95" stroke-width=".8"'+stroke);
  }
  for(const row of group.parts){
   const x=row.xMm,y=isPanel?row.yMm:0,w=row.a,h=isPanel?row.b:group.h;
   if(![x,y].every(finite)||!positive(w)||!positive(h))continue;
   const hit=matches(row),unique=hit.length===1,active=unique&&hit[0]===pieceIndex;
   if(!unique)ambiguous++;
   const title=row.unitId+' · '+row.label+' · '+fmt(w)+' × '+fmt(h)+' مم · X '+fmt(x)+' / Y '+fmt(y)+(unique?'':' · '+(hit.length?'مصدر متعدد المطابقات؛ التحديد معطل':'تعذّرت مطابقة مصدر القطعة؛ التحديد معطل'));
   body+='<g'+(unique?' data-production-piece="'+hit[0]+'"':' aria-disabled="true"')+' data-selected="'+active+'"><title>'+esc(title)+'</title>';
   body+=rect(x,y,w,h,'fill="'+(active?'#bad9bf':'#dce7d0')+'" stroke="'+(active?'#176b57':'#839b7a')+'" stroke-width="'+(active?'2.8':'1')+'"'+stroke);
   if(w>font*2&&h>font*.85)body+=text(x+w/2,y+h/2+font*.3,row.unitId,font*.85,'pointer-events="none"');
   body+='</g>';
  }
  body+='</g>';
 });
 const caption=piece.sku+' · توزيع خام المشروع كاملًا، بما فيه الوحدات الأخرى والبواقي. الفراغ بين القطع يتبع عرض المنشار؛ لا يمثل حجز مخزون.'+(ambiguous?' '+fmt(ambiguous)+' مواضع بلا مصدر وحيد؛ التحديد منها معطل.':'');
 return {html:svg([0,0,cols*cellW,rows*cellH],caption,body,'cut'),caption};
}

/** Pure SVG projection. All indices refer to the supplied complete quote.
 * No repacking, document changes, approvals, or permission decisions occur here.
 * operation coordinates are physical millimetres, with a plane rooted at 0,0.
 */
export function productionDrawing(doc,quote,{view='operation',pieceIndex=0,unitId,operationIndex=0}={}){
 if(quote?.partial)return empty('مراجعة التصنيع تتطلب حصر المشروع كاملًا؛ افتح النسخة الحالية.');
 const piece=Number.isInteger(pieceIndex)?quote?.pieces?.[pieceIndex]:null;
 if(!piece)return empty('اختر قطعة موجودة من حصر المشروع.');
 if(view==='unit'){
  const id=unitId&&unitId!=='all'?unitId:piece.unitId,unit=doc.kitchen.units.find(u=>u.id===id),run=unit&&doc.kitchen.runs.find(r=>r.id===unit.runId);
  if(run){
   const face=run.placement==='free'?run.id:run.wall;
   let html=elevationSheet(doc,face,true);
   const target='data-sheet-unit="'+esc(id)+'"';html=html.split(target).join(target+' data-production-selected="true"');
   return {html,caption:'واجهة الوحدة '+id+' ضمن صفها · الأبعاد بالملليمتر من التصميم الحالي، وليست محضر تجميع منفّذ.'};
  }
  return {html:proposalScene(doc,'volume','production-assembly',{selectedId:id,frameUnits:true}).html,caption:'موضع مصدر القطعة '+id+' ضمن التصميم الحالي؛ القطع المولّدة تُراجع مع تفصيل مصدرها.'};
 }
 if(view==='cut')return cutDrawing(doc,quote,piece,pieceIndex);
 return operationDrawing(doc,piece,operationIndex);
}
