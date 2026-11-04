// Orthographic survey elevation. Stations are local to the technician's start
// corner, even when an architectural return offsets the wall's CAD origin.
import {surveySymbolPaths,surveySizeGrip} from './kitchen-survey-symbols.js';
import {chainLabels,pointKinds} from './kitchen-chain-model.js';

const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const n=value=>Number(value.toFixed(3));
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const labels={door:'باب',window:'شباك',drain:'صرف',electric:'كهرباء',water:'ماء',vent:'فتحة تهوية الشفاط',gas:'غاز',heater:'سخان',start:'بداية الدواليب',stop:'نهاية الدواليب',corner:'الركن التالي'};
const kindName=k=>labels[k]||chainLabels[k]||'عنصر';
const line=(x1,y1,x2,y2,style)=>`<path class="wsheet-${style}" d="M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}"/>`;
const rect=(x,y,w,h,style)=>`<rect class="wsheet-${style}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>`;
const text=(x,y,value,style='number')=>`<text class="wsheet-${style}" text-anchor="middle" x="${n(x)}" y="${n(y)}" direction="rtl">${esc(value)}</text>`;
const tick=(x,y)=>line(x-2.3,y+3.2,x+2.3,y-3.2,'tick');
const mm=value=>fmt.format(value)+' مم';
const isMark=kind=>kind==='start'||kind==='stop'||kind==='corner';

function fieldTarget(i,key){
  return {attrs:` data-chain-hit="${i}" data-chain-focus="${key}" class="wsheet-field-hit"`};
}
function dimH(a,b,y,value,tag,showLabel=true,target=null){
  if(b<=a)return '';
  const hit=target?rect(a,y-18,b-a,25,'hit'):'';
  return `<g data-survey-dim="${tag}" data-mm="${n(value)}"${target?.attrs||''}><title>${mm(value)}</title>`+
    line(a,y,b,y,'measure')+tick(a,y)+tick(b,y)+(showLabel?text((a+b)/2,y-5,fmt.format(value)):'')+hit+'</g>';
}
function dimV(x,top,bottom,value,tag,target=null){
  if(bottom<=top)return '';
  const label=bottom-top>Math.max(32,fmt.format(value).length*9+6)?
    `<g transform="translate(${n(x-5)} ${n((top+bottom)/2)}) rotate(-90)">${text(0,0,fmt.format(value))}</g>`:'';
  const hit=target?rect(x-19,top,26,bottom-top,'hit'):'';
  return `<g data-survey-dim="${tag}" data-mm="${n(value)}"${target?.attrs||''}><title>${mm(value)}</title>`+
    line(x,top,x,bottom,'measure')+tick(x,top)+tick(x,bottom)+label+hit+'</g>';
}
function widthField(row){return row.frameRead?'frameDistance':'widthMm';}
function gapReference(rows,i){
  if(i===0||rows[i].from==='origin')return 'ركن البداية';
  const last=rows[i-1].kind;
  if(pointKinds.has(last))return 'مركز '+kindName(last);
  return isMark(last)?kindName(last):'طرف '+kindName(last)+' البعيد';
}

export function surveyWallSheet(d,readings,wallMm,roomMm,selected=-1,references=[],wallStartCm=0,prompt='',fromDrawing=false){
  if(!Number.isFinite(wallMm)||!Number.isFinite(roomMm)||wallMm<=0||roomMm<=0)return '';
  const scale=Math.min(448/wallMm,236/roomMm);
  const w=wallMm*scale,h=roomMm*scale,sheetWidth=Math.max(310,w+100);
  const left=(sheetWidth-w)/2,right=left+w,ceiling=58,floor=ceiling+h;
  const x=value=>left+value*scale, y=value=>floor-value*scale;
  const items=readings.map((r,i)=>({r,i,row:d.rows[i]})).filter(({r,row})=>row&&r.id===row.id);
  const active=items.find(v=>v.i===selected||v.row.featureId&&'cad:'+v.row.featureId===selected);
  const activeOrigin=active?((active.i===0||active.row.from==='origin')?0:readings[active.i-1].nextMm):null;
  const hasGap=active&&active.r.refMm>activeOrigin;
  const hasWidth=active&&active.r.nextMm>active.r.refMm;
  const stations=[...new Set([0,...items.flatMap(({r})=>[r.refMm,r.nextMm])])].sort((a,b)=>a-b);
  const hasInteriorStation=(a,b)=>stations.some(s=>s>a&&s<b);
  const extraGap=hasGap&&hasInteriorStation(activeOrigin,active.r.refMm);
  const extraWidth=hasWidth&&hasInteriorStation(active.r.refMm,active.r.nextMm);
  // Reserve both dimension lanes so selecting a mark does not rescale the sheet.
  const height=floor+90;
  const strokes=[];
  const topWitness=p=>line(p,17,p,ceiling-1,'witness');
  strokes.push(rect(left,ceiling,w,h,'wall'),topWitness(left),topWitness(right),dimH(left,right,24,wallMm,'overall',true,{attrs:' data-survey-pair class="wsheet-field-hit" aria-label="قياس الظهر والوجه"'}));
  // A metre on the drafting grid always corresponds to a metre of measured wall.
  const grid=[];
  if(scale*1000>=15){
    for(let u=1000;u<wallMm;u+=1000)grid.push('M'+n(x(u))+' '+n(ceiling+1)+'V'+n(floor-1));
    for(let z=1000;z<roomMm;z+=1000)grid.push('M'+n(left+1)+' '+n(y(z))+'H'+n(right-1));
  }
  if(grid.length)strokes.push('<path class="wsheet-grid" d="'+grid.join(' ')+'"/>');
  if(prompt&&!items.length&&!references.length&&w>195&&h>76){
    strokes.push('<g class="wsheet-empty" aria-hidden="true">'+text((left+right)/2,(ceiling+floor)/2,prompt,'prompt')+'</g>');
  }
  strokes.push(line(left-17,ceiling,left-2,ceiling,'witness'),line(left-17,floor,left-2,floor,'witness'),dimV(left-14,ceiling,floor,roomMm,'height'));
  strokes.push(line(left-4,floor,right+4,floor,'floor'),text(right+23,floor+4,'±٠','muted'));
  strokes.push(text(sheetWidth-26,22,'مم','muted'));

  // Keep actual artwork at its physical size. The transparent target and the
  // keyboard-usable reading list allow selecting even a very small outlet.
  function feature({r,row,i,referenceId}){
    const kind=row.kind,mark=isMark(kind),point=pointKinds.has(kind),opening=kind==='door'||kind==='window';
    const a=x(r.refMm),b=x(r.nextMm),base=y(row.bottomMm||0),top=y((row.bottomMm||0)+(row.heightMm||0)),mid=(a+b)/2;
    const name=kindName(kind),label=referenceId?'من الرسم':fmt.format(i+1);
    const title=label+' · '+name+' · '+(point?'المركز عند ':'')+mm(r.refMm)+(b>a?' – '+mm(r.nextMm):'');
    let shape='',labelX=mid,labelY=mark?ceiling+19:point?base:top+(base-top)/2;
    if(mark){
      shape=line(a,ceiling+2,a,floor-1,'marker')+`<path class="wsheet-flag" d="M${n(a-4)} ${n(ceiling+1)}h8l-4 6z"/>`;
    }else if(point){
      const actualW=(row.widthMm||0)*scale,actualH=(row.heightMm||0)*scale;
      shape=rect(a-actualW/2,base-actualH/2,actualW,actualH,'utility')+
        // The register symbol is centred at the measured service coordinate.
        // Its round surround distinguishes it from the outlet's actual outline.
        `<g class="wsheet-service" data-service-symbol="${kind}" transform="translate(${n(a)} ${n(base)})"><circle class="wsheet-center" r="8"/><path d="${surveySymbolPaths[kind]}" transform="translate(-5.8 -5.8) scale(.483)"/></g>`;
    }else{
      shape=rect(a,top,b-a,base-top,opening?'opening':'obstacle');
      if(opening&&b-a>15&&base-top>16){
        shape+=rect(a+2.5,top+2.5,b-a-5,base-top-5,'lite');
        // Glass shine is an elevation convention. Do not invent mullions or
        // specify the number, handedness or opening direction of the sashes.
        if(kind==='window'&&b-a>=29&&base-top>=28){
          shape+=line(b-19,top+19,b-9,top+9,'glass')+line(b-17,top+24,b-8,top+15,'glass');
        }
        if(kind==='door'&&row.hinge&&row.swing!=='sliding'){
          const knobX=row.hinge==='left'?b-7:a+7;
          shape+=line(knobX,base-(base-top)*.48,knobX+(row.hinge==='left'?-5:5),base-(base-top)*.48,'door-lever');
        }
      }
    }
    // Short numeric tags fit between jambs; defer overlapping labels to the
    // reading register. Render the selected target last at its true station.
    const fullWidth=name.length*9+24,inside=!mark&&!point&&b-a>fullWidth+6&&base-top>27;
    const nameOutside=(point||mark)&&w>fullWidth+6;
    const caption=referenceId?(inside||nameOutside?name:''):(inside||nameOutside?name+' '+label:label);
    if(!inside&&(point||mark))labelY+=point?(base-ceiling<24?19:-12):0;
    const half=inside||nameOutside?fullWidth/2:10;
    labelX=Math.max(left+half,Math.min(right-half,labelX));labelY=Math.max(ceiling+13,Math.min(floor-6,labelY));
    const box={l:labelX-half,r:labelX+half,t:labelY-12,b:labelY+6};
    const overlaps=placed.some(p=>box.l<p.r&&box.r>p.l&&box.t<p.b&&box.b>p.t);
    let tag='';
    if(caption&&!overlaps){placed.push(box);tag=text(labelX,labelY,caption,'tag');}
    const hitY=point?base:mark?ceiling+12:(top+base)/2;
    const halo=point||mark||b-a<24?`<circle cx="${n(mid)}" cy="${n(hitY)}" r="12" class="wsheet-hit"/>`:'';
    const token=referenceId?'cad:'+referenceId:i,current=referenceId?token===selected:active?.i===i;
    const grips=current&&!point&&!mark?
      surveySizeGrip(esc(token),n(b),n((top+base)/2),'widthMm')+surveySizeGrip(esc(token),n(mid),n(top),'heightMm'):'';
    if(referenceId)return `<g tabindex="0" role="button" class="wsheet-cad-reference wsheet-item${current?' wsheet-current':''}" data-cad-reference="${esc(referenceId)}" data-chain-hit="${esc(token)}" data-wall-kind="${esc(kind)}" data-source="${referenceId||fromDrawing?'drawing':'reading'}" aria-pressed="${!!current}" aria-label="${esc(title)}"><title>${esc(title)}</title>${shape}${tag}${halo}${grips}</g>`;
    return `<g data-chain-hit="${i}" data-survey-ref-mm="${n(r.refMm)}" data-survey-end-mm="${n(r.nextMm)}" class="wsheet-item${current?' wsheet-current':''}" tabindex="0" role="button" data-wall-kind="${esc(kind)}" data-source="${referenceId||fromDrawing?'drawing':'reading'}" aria-pressed="${!!current}" aria-label="${esc(title)}"><title>${esc(title)}</title>${shape}${tag}${halo}${grips}</g>`;
  }
  const placed=[];
  const selectedShape=active?feature(active):'';
  const measuredShapes=items.filter(v=>v!==active).map(feature);
  for(const f of references){
    const point=pointKinds.has(f.kind),widthMm=f.width*10,heightMm=f.height*10;
    const refMm=(f.u-wallStartCm)*10+(point?widthMm/2:0);
    strokes.push(feature({referenceId:f.id,r:{refMm,nextMm:point?refMm:refMm+widthMm},
      row:{kind:f.kind,widthMm,heightMm,bottomMm:f.bottom*10+(point?heightMm/2:0)}}));
  }
  strokes.push(...measuredShapes,selectedShape);
  // Adjacent stations are derived from geometry. Only extend this string up
  // to the last real reading. The full wall length above comes from the room.
  const dimY=floor+23;
  for(const s of stations)strokes.push(line(x(s),floor+3,x(s),dimY+5,'witness'));
  for(let i=1;i<stations.length;i++){
    const a=stations[i-1],b=stations[i],width=b-a;
    // A computed spacing between unrelated stations cannot edit a raw reading.
    // Only the exact source span is interactive. Co-located independent
    // measurements are kept separate in the register.
    const targets=[];
    for(const v of items){
      const origin=v.i===0||v.row.from==='origin'?0:readings[v.i-1].nextMm;
      if(v.r.refMm===a&&v.r.nextMm===b)targets.push(fieldTarget(v.i,widthField(v.row)));
      if(origin===a&&v.r.refMm===b)targets.push(fieldTarget(v.i,'gapMm'));
    }
    const selectedGap=hasGap&&a===activeOrigin&&b===active.r.refMm;
    const selectedWidth=hasWidth&&a===active.r.refMm&&b===active.r.nextMm;
    const show=width*scale>fmt.format(width).length*8.7+7;
    if(selectedGap||selectedWidth){
      const target=fieldTarget(active.i,selectedGap?'gapMm':widthField(active.row));
      strokes.push(`<g class="wsheet-active-dim" data-survey-dim="station" data-mm="${n(width)}">`,
        dimH(x(a),x(b),dimY,width,selectedGap?'selected-gap':'selected-width',show,target),'</g>');
    }else strokes.push(dimH(x(a),x(b),dimY,width,'station',show,targets.length===1?targets[0]:null));
  }
  if(extraGap||extraWidth){
    const start=active.r.refMm,end=active.r.nextMm,gy=floor+51;
    strokes.push('<g class="wsheet-active-dim">');
    for(const v of new Set([...(extraGap?[activeOrigin,start]:[]),...(extraWidth?[start,end]:[])]))
      strokes.push(line(x(v),dimY+6,x(v),gy+5,'witness'));
    if(extraGap){
      const gap=start-activeOrigin;
      strokes.push(dimH(x(activeOrigin),x(start),gy,gap,'selected-gap',gap*scale>fmt.format(gap).length*9+10,fieldTarget(active.i,'gapMm')));
    }
    if(extraWidth){
      const width=end-start;
      strokes.push(dimH(x(start),x(end),gy,width,'selected-width',width*scale>fmt.format(width).length*9+10,fieldTarget(active.i,widthField(active.row))));
    }
    strokes.push('</g>');
  }
  if(active&&!isMark(active.row.kind)){
    const row=active.row,baseMm=row.bottomMm,dimX=right+16;
    strokes.push('<g class="wsheet-active-dim">');
    if(baseMm>0){
      strokes.push(line(right+2,y(baseMm),dimX+5,y(baseMm),'witness'),line(right+2,floor,dimX+5,floor,'witness'),
        dimV(dimX,y(baseMm),floor,baseMm,pointKinds.has(row.kind)?'selected-center-height':'selected-bottom-height',fieldTarget(active.i,'bottomMm')));
    }
    if(!pointKinds.has(row.kind)&&row.heightMm>0){
      const top=y(baseMm+row.heightMm);
      strokes.push(line(right+2,top,dimX+5,top,'witness'),line(right+2,y(baseMm),dimX+5,y(baseMm),'witness'),
        dimV(dimX,top,y(baseMm),row.heightMm,'selected-feature-height',fieldTarget(active.i,'heightMm')));
    }
    strokes.push('</g>');
  }
  const directionLine=text(left+20,height-6,'٠ · البداية','muted')+line(left+54,height-10,left+75,height-10,'measure')+
    `<path class="wsheet-tick" d="M${n(left+71)} ${n(height-13)}l4 3 -4 3"/>`;
  const referenceLegend=references.length||fromDrawing?text(sheetWidth/2,height+12,'الخط المتقطّع · عنصر من الرسم','muted'):'';
  const sheetHeight=height+20;
  const description=active?kindName(active.row.kind)+' · '+mm(active.r.refMm-activeOrigin)+' من '+gapReference(d.rows,active.i):'تُقرأ الواجهة من ركن البداية في اتجاه السهم.';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="survey-wall-sheet" tabindex="0" data-ink-left="${n(left)}" data-ink-top="${n(ceiling)}" data-ink-width="${n(w)}" data-ink-height="${n(h)}" data-ink-wall-mm="${wallMm}" data-ink-height-mm="${roomMm}" role="group" aria-label="واجهة الجدار ومواضع القياسات بالملليمتر" viewBox="0 0 ${n(sheetWidth)} ${n(sheetHeight)}" preserveAspectRatio="xMidYMid meet" direction="ltr"><title>واجهة الجدار · ${mm(wallMm)} × ${mm(roomMm)}</title><desc>${esc(description)}</desc>${strokes.join('')}${directionLine}${referenceLegend}</svg>`;
}
