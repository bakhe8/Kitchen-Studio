// Native inputs and dimension lines share CSS-pixel coordinates. Schematic
// spans are used only for drawing until the rep records the corresponding axis.
const readings={
 widthMm:{label:'العرض الداخلي',limit:12000},
 lengthMm:{label:'العمق الداخلي',limit:12000},
 heightMm:{label:'ارتفاع السقف',limit:6000}
};
const number=new Intl.NumberFormat('ar-SA');
const round=n=>Math.round(n*100)/100;
const extent=(n,fallback)=>Number.isFinite(n)&&n>0?Math.round(n):fallback;
function reading(value,limit){
 return Number.isInteger(value)&&value>=600&&value<=limit?value:null;
}

function dimension(key,value,hitPath,marks,heading=''){
 const label=readings[key].label,description=value===null?'غير مقاس':number.format(value)+' مم';
 return '<g class="visit-axis" data-visit-measure="'+key+'" role="button" tabindex="0" aria-controls="visit-'+key+'" aria-label="إدخال '+label+'، '+description+'">'+
  '<title>'+label+' · '+description+'</title><path class="visit-measure-line" d="'+marks+'"/>'+
  '<path class="visit-dim-hit" d="'+hitPath+'"/>'+heading+'</g>';
}
function verticalMarks(x,top,bottom,edge){
 return `M${x} ${top}V${bottom} M${x-6} ${top}H${edge-4} M${x-6} ${bottom}H${edge-4} M${x-4} ${top+4}l8 -8 M${x-4} ${bottom+4}l8 -8`;
}
function horizontalMarks(left,right,y,edge){
 return `M${left} ${y}H${right} M${left} ${edge+4}V${y+6} M${right} ${edge+4}V${y+6} M${left-4} ${y+4}l8 -8 M${right-4} ${y+4}l8 -8`;
}
function panelTitle(x,y,title,measured){
 return `<rect x="${x-85}" y="${y-19}" width="170" height="27" fill="transparent"/><text x="${x}" y="${y}" class="visit-pane-name" text-anchor="middle" direction="rtl">${title}${measured?'':' · تخطيطي'}</text>`;
}
function floorPlan(x,y,w,d,values){
 const complete=values.widthMm!==null&&values.lengthMm!==null;
 const area=complete&&w>=106&&d>=64?number.format(Number((values.widthMm*values.lengthMm/1e6).toFixed(2))):null;
 return `<g data-visit-shape="plan" data-measured="${complete}"><rect x="${x-3}" y="${y-3}" width="${w+6}" height="${d+6}" class="visit-plan-wall"/><rect x="${x}" y="${y}" width="${w}" height="${d}" fill="url(#visit-plan-paper)" class="visit-plan-floor"/>
 <path class="visit-span-axis" data-known="${values.widthMm!==null}" d="M${x} ${y}h${w} M${x} ${y+d}h${w}"/>
 <path class="visit-span-axis" data-known="${values.lengthMm!==null}" d="M${x} ${y}v${d} M${x+w} ${y}v${d}"/>
 ${area===null?'':`<text x="${x+w/2}" y="${y+d/2-3}" text-anchor="middle" class="visit-area" direction="rtl">${area} م²</text><text x="${x+w/2}" y="${y+d/2+17}" text-anchor="middle" class="visit-area-label">مساحة الأرضية</text>`}</g>`;
}

// In this oblique cutaway the back wall is a true elevation: both it and
// the plan have the same millimetre scale. Depth recedes into the paper.
function roomVolume(x,y,w,h,dx,dy,values){
 const right=round(x+w),base=round(y+h),backLeft=round(x+dx),backRight=round(right+dx),backBase=round(base-dy);
 const backTop=round(y-dy),complete=Object.values(values).every(n=>n!==null);
 return `<g data-visit-shape="volume" data-measured="${complete}">
 <rect class="visit-volume-back" x="${backLeft}" y="${backTop}" width="${w}" height="${h}"/>
 <path class="visit-volume-side" d="M${x} ${y}l${dx} ${-dy}v${h}l${-dx} ${dy}Z"/>
 <path class="visit-volume-floor" d="M${x} ${base}l${dx} ${-dy}h${w}l${-dx} ${dy}Z"/>
 <path class="visit-volume-wall-cap" d="M${x} ${y}L${backLeft} ${backTop}H${backRight}"/>
 <path class="visit-volume-ghost" d="M${x} ${y}h${w}l${dx} ${-dy} M${right} ${y}V${base}"/>
 <path class="visit-volume-inner" d="M${backLeft} ${backTop}V${backBase}H${backRight} M${backLeft} ${backBase}L${x} ${base}"/>
 <path class="visit-span-axis" data-known="${values.heightMm!==null}" d="M${x} ${base}V${y}"/>
 </g>`;
}
export function intakeRoomDrawing(values={},viewport={}){
 const width=extent(viewport.width,600),height=extent(viewport.height,420);
 const w=reading(values.widthMm,12000),d=reading(values.lengthMm,12000),h=reading(values.heightMm,6000);
 const measurements={widthMm:w,lengthMm:d,heightMm:h};
 const span=w||d||h||1,depth=d||span*.73,ceiling=h||span*.58;
 const across=width>=600&&width/height>=1.48;
 const pad=Math.min(14,width*.024),split=across?14:12,chipW=width<560?104:124,chipH=58;
 const rail=chipW+10,head=32,tail=chipH+12;
 const panelW=across?(width-2*pad-split)/2:width-2*pad,drawableW=Math.max(1,panelW-rail-7);
 const usableH=Math.max(1,height-2*pad-head-tail-(across?0:head+split+8));
 const planSpace=across?usableH:usableH*.56,volumeSpace=across?usableH:usableH-planSpace;
 const scale=Math.min(drawableW/(span+depth*.32),planSpace/depth,volumeSpace/(ceiling+depth*.24));
 const wallW=round(span*scale),planD=round(depth*scale),wallH=round(ceiling*scale);
 const dx=round(planD*.32),dy=round(planD*.24);
 const planPanelX=pad+(across?panelW+split:0),volumePanelX=pad;
 const midX=panelX=>round(panelX+rail+drawableW/2);
 const planMid=midX(planPanelX),volumeMid=midX(volumePanelX);
 const planOrigin=pad+head,volumeOrigin=across?planOrigin:planOrigin+planSpace+tail+split+head;
 const planCenter=round(planOrigin+planSpace/2),volumeCenter=round(volumeOrigin+volumeSpace/2);
 const planLeft=round(planMid-wallW/2),planTop=round(planCenter-planD/2),planRight=round(planLeft+wallW),planBottom=round(planTop+planD);
 const volumeLeft=round(volumeMid-(wallW+dx)/2),volumeTop=round(volumeCenter-(wallH+dy)/2+dy),volumeBase=round(volumeTop+wallH);
 const depthX=round(planPanelX+chipW/2+2),ceilingX=round(volumePanelX+chipW/2+2);
 const widthY=round(planOrigin+planSpace+chipH/2+8);
 const fieldY=y=>Math.max(chipH/2+2,Math.min(height-chipH/2-2,y));
 const anchors={widthMm:{x:planMid,y:widthY},lengthMm:{x:depthX,y:fieldY(planCenter)},heightMm:{x:ceilingX,y:fieldY(volumeCenter)}};
 const separator=across?`M${round(width/2)} ${pad}V${height-pad}`:`M${pad} ${round(planOrigin+planSpace+tail+split/2)}H${width-pad}`;
 const svg=`<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="group" direction="ltr" aria-label="مسقط أرضية الغرفة ومنظور يوضح ارتفاع السقف" data-visit-layout="${across?'across':'stack'}">
 <defs><pattern id="visit-plan-paper" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#f2f7f5"/><circle cx="1" cy="1" r=".7" fill="#b7cac7"/></pattern><pattern id="visit-volume-floor" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#e2ece8"/><path d="M-4 12 12 0m-4 12L24 0" stroke="#cadbd4" stroke-width=".7"/></pattern></defs>
 <path d="${separator}" stroke="#d3dcdb" stroke-dasharray="3 5"/>
 ${floorPlan(planLeft,planTop,wallW,planD,measurements)}
 ${roomVolume(volumeLeft,volumeTop,wallW,wallH,dx,dy,measurements)}
 ${dimension('widthMm',w,`M${planLeft} ${widthY}H${planRight} M${planLeft} ${planTop}H${planRight} M${planLeft} ${planBottom}H${planRight}`,horizontalMarks(planLeft,planRight,widthY,planBottom),panelTitle(planMid,planOrigin-12,'المسقط الأفقي',w!==null&&d!==null))}
 ${dimension('lengthMm',d,`M${depthX} ${planTop}V${planBottom} M${planLeft} ${planTop}V${planBottom} M${planRight} ${planTop}V${planBottom}`,verticalMarks(depthX,planTop,planBottom,planLeft))}
 ${dimension('heightMm',h,`M${ceilingX} ${volumeTop}V${volumeBase} M${volumeLeft} ${volumeTop}V${volumeBase} M${volumeLeft+dx} ${volumeTop-dy}v${wallH}`,verticalMarks(ceilingX,volumeTop,volumeBase,volumeLeft),panelTitle(volumeMid,volumeOrigin-12,'منظور الغرفة',w!==null&&d!==null&&h!==null))}
 </svg>`;
 return {svg,anchors};
}
