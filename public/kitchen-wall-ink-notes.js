// These annotations describe the uncommitted mark. They never write to a chain.
import {assistNumber} from './kitchen-measurement-identity.js';
import {pointKinds} from './kitchen-chain-model.js';
const ar=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const svgNumber=n=>Number(n.toFixed(2));
const dimNames={tapeGap:'مسافة الشريط',gapMm:'المسافة',widthMm:'العرض',bottomMm:'المنسوب',heightMm:'الارتفاع'};
export function wallInkNotes({svgData,proposal,values,tapeOnly=false}){
 const left=Number(svgData.inkLeft),top=Number(svgData.inkTop),w=Number(svgData.inkWidth),h=Number(svgData.inkHeight);
 const wall=Number(svgData.inkWallMm),ceiling=Number(svgData.inkHeightMm),floor=top+h;
 if(![left,top,w,h,wall,ceiling].every(Number.isFinite)||Math.min(w,h,wall,ceiling)<=0)return '';
 const get=key=>assistNumber(values[key]??proposal.row[key]);
 const gap=get('gapMm'),base=get('bottomMm');
 if(gap===null||base===null||base<0||base>ceiling)return '';
 const from=proposal.datumMm,to=from+gap;
 if(from<0||gap<0||to>wall)return '';
 const x=s=>left+w*s/wall,y=z=>floor-h*z/ceiling;
 const sx=x(to),sy=y(base),span=get('widthMm'),tall=get('heightMm');
 const isPoint=pointKinds.has(proposal.row.kind);
 const path=(d)=>'<path d="'+d+'" class="ink-note-rule"/>';
 const tag=(key,value,px,py)=>{
  const label=ar.format(value),boxWidth=Math.max(25,label.length*8+9);
  const tx=Math.min(left+w+9-boxWidth/2,Math.max(left-9+boxWidth/2,px));
  return '<g data-ink-edit="'+key+'" role="button" tabindex="0" class="ink-note-tag" aria-label="تعديل '+dimNames[key]+' '+label+' مم"><title>تعديل '+dimNames[key]+' · '+label+' مم</title>'+
    '<rect x="'+svgNumber(tx-boxWidth/2)+'" y="'+svgNumber(py-10)+'" width="'+boxWidth+'" height="20" rx="3"/>'+
    '<text x="'+svgNumber(tx)+'" y="'+svgNumber(py+4.5)+'" text-anchor="middle">'+label+'</text></g>';
 };
 function horizontal(key,value,a,b,yy){
  const l=svgNumber(a),r=svgNumber(b),v=svgNumber(yy);
  return path('M'+l+' '+v+'H'+r+'M'+l+' '+(v-3)+'v6M'+r+' '+(v-3)+'v6')+tag(key,value,(a+b)/2,v);
 }
 const ey=isPoint?sy:Math.min(sy,y(Math.min(ceiling,base+(tall||0))));
 // Keep the source gap and frame width on different lines even when both are short.
 let marks=horizontal(tapeOnly?'tapeGap':'gapMm',gap,x(from),sx,Math.min(floor-10,Math.max(top+11,ey-14)));
 if(tapeOnly)return '<g class="ink-note-measures">'+marks+'</g>';
 if(isPoint){
  const dx=Math.min(left+w-13,Math.max(left+13,sx+22)),a=svgNumber(dx);
  marks+=path('M'+a+' '+svgNumber(sy)+'V'+svgNumber(floor))+tag('bottomMm',base,dx,(sy+floor)/2);
 }else if(Number.isFinite(span)&&span>0&&to+span<=wall){
  marks+=horizontal('widthMm',span,sx,x(to+span),Math.max(top+31,Math.min(floor-11,ey+14)));
 }
 return '<g class="ink-note-measures">'+marks+'</g>';
}
