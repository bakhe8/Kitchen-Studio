// Receipt-only presentation. Never infer fronts, finishes or wall positions from
// the open project; checks are the nominal dimensions of the issued unit.
import {assistNumber} from './kitchen-measurement-identity.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=value=>finite(value)?value:typeof value==='string'?assistNumber(value):null;
const actualNumber=(check,value)=>{const n=number(value);return n!==null&&n>=0&&n<=100000&&(check.unit!=='قطعة'||Number.isInteger(n))?n:null;};
const fmt=value=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(value);
const coord=value=>String(Math.round(value*1000)/1000);
const validAnchor=anchor=>anchor?.kind==='front'&&finite(anchor.x)&&finite(anchor.y)&&anchor.x>=0&&anchor.x<=1&&anchor.y>=0&&anchor.y<=1;
const checkAnchor=(observation,key)=>observation?.anchor?.kind==='check'&&observation.anchor.key===key;
const text=(x,y,value,extra='')=>'<text x="'+coord(x)+'" y="'+coord(y)+'" text-anchor="middle" direction="rtl" '+extra+'>'+esc(value)+'</text>';
const line=(x1,y1,x2,y2,extra='')=>'<line x1="'+coord(x1)+'" y1="'+coord(y1)+'" x2="'+coord(x2)+'" y2="'+coord(y2)+'" vector-effect="non-scaling-stroke" '+extra+'/>';

function readingText(check,actual,tolerances){
 const measured=actualNumber(check,actual[check.key]),tolerance=number(tolerances[check.key]);
 if(measured===null)return '';
 const delta=Math.round((measured-check.nominal)*1e6)/1e6;
 return 'الفعلي '+fmt(measured)+' '+check.unit+' · الفرق '+(delta>0?'+':'')+fmt(delta)+(tolerance!==null?' · السماحة ±'+fmt(tolerance):'');
}

function checkCards(checks,{observations,selectedId,selectedCheck,actual,tolerances,draftAnchor},exclude=[]){
 const list=checks.filter(check=>!exclude.includes(check.key));
 if(!list.length)return '';
 return '<div class="dl-drawing-checks" aria-label="فحوص إيصال الوحدة">'+list.map(check=>{
  const notes=observations.filter(observation=>checkAnchor(observation,check.key));
  const selected=selectedCheck===check.key||notes.some(observation=>observation.id===selectedId);
  const reading=readingText(check,actual,tolerances),draft=draftAnchor?.kind==='check'&&draftAnchor.key===check.key;
  return '<button class="dl-drawing-check" type="button" data-delivery-check="'+esc(check.key)+'" aria-pressed="'+selected+'"><strong>'+esc(check.label)+'</strong><span>الاسمي '+esc(fmt(check.nominal))+' '+esc(check.unit)+'</span>'+(reading?'<small>'+esc(reading)+'</small>':'')+(notes.length?'<small>'+esc(fmt(notes.length))+' ملاحظات مرتبطة بهذا الفحص</small>':'')+(draft?'<small class="dl-anchor-pending">موضع الملاحظة الجديدة</small>':'')+'</button>';
 }).join('')+'</div>';
}

export function deliveryDrawing(unit,{observations=[],selectedId='',selectedCheck='',draftAnchor=null,actual={},tolerances={}}={}){
 const checks=Array.isArray(unit?.checks)?unit.checks.filter(check=>check&&typeof check.key==='string'&&finite(check.nominal)&&check.nominal>=0):[];
 observations=Array.isArray(observations)?observations.filter(observation=>observation&&typeof observation.id==='string'):[];
 actual=actual&&typeof actual==='object'?actual:{};tolerances=tolerances&&typeof tolerances==='object'?tolerances:{};
 const state={observations,selectedId,selectedCheck,draftAnchor,actual,tolerances};
 const dimension=key=>checks.find(check=>check.key===key&&check.unit==='مم'&&check.nominal>0);
 const width=dimension('width'),height=dimension('height'),depth=dimension('depth');
 const label=String(unit?.name||unit?.id||'الوحدة');
 if(!width||!height||!depth){
  return '<figure class="dl-drawing dl-drawing-fallback"><figcaption>فحوص من إيصال الإصدار؛ لا تتوفر أبعاد جسم كاملة لرسم هذه الوحدة.</figcaption>'+checkCards(checks,state)+(checks.length?'':'<p class="dl-empty">لا توجد فحوص أبعاد متاحة لهذه الوحدة.</p>')+'</figure>';
 }
 // The front fits a fixed frame without changing its width-to-height ratio.
 // All pin coordinates use the actual front rect, not the surrounding SVG.
 const scale=Math.min(310/width.nominal,246/height.nominal),w=width.nominal*scale,h=height.nominal*scale;
 const x=320-w/2,y=192-h/2,bottom=y+h;
 const checkNotes=key=>observations.filter(observation=>checkAnchor(observation,key));
 const dimensionGroup=(check,art,hit)=>{
  const notes=checkNotes(check.key),selected=check.key===selectedCheck||notes.some(observation=>observation.id===selectedId),draft=draftAnchor?.kind==='check'&&draftAnchor.key===check.key;
  const measured=actualNumber(check,actual[check.key]),tolerance=number(tolerances[check.key]);
  const outside=measured!==null&&tolerance!==null&&Math.abs(Math.round((measured-check.nominal)*1e6)/1e6)>tolerance;
  const name=check.label+' · الاسمي '+fmt(check.nominal)+' '+check.unit+(readingText(check,actual,tolerances)?' · '+readingText(check,actual,tolerances):'')+(notes.length?' · '+fmt(notes.length)+' ملاحظات':'')+(draft?' · موضع الملاحظة الجديدة':'');
  return '<g class="dl-dimension" role="button" tabindex="0" data-delivery-check="'+esc(check.key)+'" aria-pressed="'+selected+'" aria-label="'+esc(name)+'" data-noted="'+(notes.length>0)+'" data-outside="'+outside+'" data-draft="'+draft+'"><title>'+esc(name)+'</title>'+hit+art+'</g>';
 };
 const dimensionLabel=check=>check.label+' · '+fmt(check.nominal)+' '+check.unit;
 const actualLabel=check=>{const value=actualNumber(check,actual[check.key]);return value===null?'': 'الفعلي '+fmt(value)+' '+check.unit;};
 let body='<rect class="dl-body-plane" data-delivery-plane="" x="'+coord(x)+'" y="'+coord(y)+'" width="'+coord(w)+'" height="'+coord(h)+'" fill="#eee9d9" stroke="#718c7d" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
 body+=text(320,39,'جسم الوحدة · أبعاد الإيصال','class="dl-diagram-label" pointer-events="none"');
 body+=line(x,y-9,x,y-23,'class="dl-origin" pointer-events="none"')+line(x-9,y,x-23,y,'class="dl-origin" pointer-events="none"');
 body+=text(x-7,y-31,'0','class="dl-origin-label" pointer-events="none"');
 const wy=bottom+30;
 body+=dimensionGroup(width,
  line(x,wy,x+w,wy)+line(x,wy-6,x,wy+6)+line(x+w,wy-6,x+w,wy+6)+text(320,wy+27,dimensionLabel(width),'class="dl-dimension-label"')+text(320,wy+49,actualLabel(width),'class="dl-reading-label"'),
  '<rect class="dl-dimension-hit" x="130" y="'+coord(wy-14)+'" width="380" height="68" rx="8"/>');
 const hx=x-37,hy=y+h/2;
 body+=dimensionGroup(height,
  line(hx,y,hx,bottom)+line(hx-6,y,hx+6,y)+line(hx-6,bottom,hx+6,bottom)+text(hx-17,hy,dimensionLabel(height),'class="dl-dimension-label" transform="rotate(-90 '+coord(hx-17)+' '+coord(hy)+')"')+text(hx-40,hy,actualLabel(height),'class="dl-reading-label" transform="rotate(-90 '+coord(hx-40)+' '+coord(hy)+')"'),
  '<rect class="dl-dimension-hit" x="'+coord(hx-58)+'" y="'+coord(Math.min(y,hy-140))+'" width="75" height="'+coord(Math.max(h,280))+'" rx="8"/>');
 body+=dimensionGroup(depth,
  text(320,421,dimensionLabel(depth),'class="dl-dimension-label"')+text(320,445,actualLabel(depth),'class="dl-reading-label"'),
  '<rect class="dl-dimension-hit dl-depth-hit" x="140" y="397" width="360" height="62" rx="8"/>');
 const pin=(observation,index)=>{
  if(!validAnchor(observation.anchor))return '';
  const px=x+observation.anchor.x*w,py=y+observation.anchor.y*h,selected=observation.id===selectedId;
  const name='ملاحظة '+fmt(index+1)+' · '+(observation.resolved?'مغلقة':observation.severity==='blocking'?'مانعة للاستلام':'للمتابعة')+' · '+String(observation.text||'');
  return '<g class="dl-drawing-pin" role="button" tabindex="0" data-delivery-pin="'+esc(observation.id)+'" aria-pressed="'+selected+'" aria-label="'+esc(name)+'" data-severity="'+(observation.severity==='blocking'?'blocking':'info')+'" data-resolved="'+(observation.resolved===true)+'" transform="translate('+coord(px)+' '+coord(py)+')"><title>'+esc(name)+'</title><circle class="dl-pin-hit" r="19"/><circle class="dl-pin-halo" r="23" vector-effect="non-scaling-stroke" pointer-events="none"/><circle class="dl-pin-ring" r="16" vector-effect="non-scaling-stroke"/>'+text(0,6,fmt(index+1),'class="dl-pin-number" pointer-events="none"')+'</g>';
 };
 // Selected pin is painted last; its displayed number remains its list index.
 observations.forEach((observation,index)=>{if(observation.id!==selectedId)body+=pin(observation,index);});
 observations.forEach((observation,index)=>{if(observation.id===selectedId)body+=pin(observation,index);});
 if(validAnchor(draftAnchor)){
  const px=x+draftAnchor.x*w,py=y+draftAnchor.y*h;
  body+='<g class="dl-draft-pin" transform="translate('+coord(px)+' '+coord(py)+')" pointer-events="none" aria-label="موضع الملاحظة الجديدة"><circle r="20" vector-effect="non-scaling-stroke"/>'+line(-8,0,8,0)+line(0,-8,0,8)+'</g>';
 }
 const caption='مخطط من أبعاد إيصال الإصدار؛ لا يعرض تفاصيل الواجهة أو الخامة. مواضع الملاحظات نسبية من أعلى يسار الجسم.';
 return '<figure class="dl-drawing"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 470" preserveAspectRatio="xMidYMid meet" role="group" aria-label="'+esc('فحص '+label+' من إيصال الإصدار')+'" data-delivery-drawing="front"><title>'+esc(label+' · مخطط أبعاد الإيصال')+'</title>'+body+'</svg><figcaption>'+caption+'</figcaption>'+checkCards(checks,state,['width','height','depth'])+'</figure>';
}
