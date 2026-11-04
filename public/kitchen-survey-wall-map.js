import {ownKey} from './kitchen-safe-keys.js';
// Project x to the right and depth (z) down, exactly as on the room plan.
// The measured edge begins at a, which may differ from a clipped wall's CAD origin.
const number = new Intl.NumberFormat('ar-SA', {useGrouping:false});
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = v => Number(v.toFixed(2));
const mapW=166,mapH=112,margin=18;
const stateText={saved:'رفع محفوظ',draft:'تعديلات غير محفوظة'};

export function surveyWallMap(walls,activeWall,statuses={},interactive=false){
  if(!walls.length)return '';
  const points=walls.flatMap(w=>[w.a,w.b]);
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
  const scale=Math.min((mapW-2*margin)/(maxX-minX),(mapH-2*margin)/(maxZ-minZ));
  const x=v=>mapW/2+(v-(minX+maxX)/2)*scale,y=v=>mapH/2+(v-(minZ+maxZ)/2)*scale;
  const edges=walls.map((wall,i)=>{
    const ax=x(wall.a.x),ay=y(wall.a.z),bx=x(wall.b.x),by=y(wall.b.z);
    const len=Math.hypot(bx-ax,by-ay),state=ownKey(stateText,statuses[wall.id])?statuses[wall.id]:'';
    return {wall,ax,ay,bx,by,len,tx:(bx-ax)/len,ty:(by-ay)/len,i,active:wall.id===activeWall,state};
  });
  const active=edges.find(e=>e.active);
  const ordered=active?[active,...edges.filter(e=>!e.active)]:edges;
  const title=e=>'الجدار '+number.format(e.i+1)+' · '+e.wall.label+(e.state?' · '+stateText[e.state]:'');
  const attr=e=>'data-survey-wall-id="'+esc(e.wall.id)+'" data-wall-state="'+(e.state||'unrecorded')+'"';
  const contour=edges.map(e=>n(e.ax)+','+n(e.ay)).join(' ');
  function segment(e){
    const path='M'+n(e.ax)+' '+n(e.ay)+' L'+n(e.bx)+' '+n(e.by);
    const color=e.active?'#245e51':e.state==='saved'?'#4f625c':e.state==='draft'?'#866744':'#86918e';
    return '<g '+attr(e)+(interactive?' tabindex="0" role="button" aria-label="'+esc(title(e))+'" aria-pressed="'+e.active+'"':'')+' style="cursor:pointer"><title>'+esc(title(e))+'</title>'+
      '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(e.active?3.6:e.state?2.1:1.6)+'"'+(e.state==='draft'?' stroke-dasharray="4 2"':'')+'/>'+
      (interactive?'<rect x="'+n((e.ax+e.bx)/2-16)+'" y="'+n((e.ay+e.by)/2-16)+'" width="32" height="32" fill="transparent"/>':'')+
      '<path d="'+path+'" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/></g>';
  }
  let direction='';
  if(active){
    const {ax,ay,bx,by,tx,ty,len}=active,tipX=ax+(bx-ax)*.72,tipY=ay+(by-ay)*.72;
    const size=Math.min(5.1,len*.23),baseX=tipX-tx*size,baseY=tipY-ty*size;
    direction='<g pointer-events="none" data-survey-direction=""><circle cx="'+n(ax)+'" cy="'+n(ay)+'" r="3.3" fill="#fff" stroke="#245e51" stroke-width="1.8"/>'+
      '<path d="M'+n(baseX-ty*size*.67)+' '+n(baseY+tx*size*.67)+'L'+n(tipX)+' '+n(tipY)+'L'+n(baseX+ty*size*.67)+' '+n(baseY-tx*size*.67)+'" fill="none" stroke="#245e51" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }
  // Prioritise the active number and avoid stacking labels at short return
  // walls. All edges remain selectable in the full wall selector.
  const placed=[];
  function badge(e){
    const width=e.i<9?14:20,hh=8,hw=width/2;
    for(const offset of [10,16,24,-12]){
      for(const t of [.5,.33,.67]){
        const originX=e.ax+(e.bx-e.ax)*t,originY=e.ay+(e.by-e.ay)*t;
        const px=Math.max(hw+1,Math.min(mapW-hw-1,originX+e.ty*offset));
        const py=Math.max(hh+1,Math.min(mapH-hh-1,originY-e.tx*offset));
        if(placed.some(p=>Math.abs(p.x-px)<p.hw+hw+1&&Math.abs(p.y-py)<hh*2))continue;
        placed.push({x:px,y:py,hw});
        return '<g '+attr(e)+' style="cursor:pointer"><title>'+esc(title(e))+'</title>'+
          (Math.abs(offset)>12?'<path d="M'+n(originX)+' '+n(originY)+'L'+n(px)+' '+n(py)+'" stroke="#8b9790" stroke-width=".75"/>':'')+
          '<rect x="'+n(px-hw)+'" y="'+n(py-hh)+'" width="'+width+'" height="16" rx="3" fill="'+(e.active?'#245e51':'#fff')+'"/>'+
          '<text x="'+n(px)+'" y="'+n(py+4.2)+'" text-anchor="middle" font-size="12" font-weight="'+(e.active?'700':'600')+'" fill="'+(e.active?'#fff':'#3d4b46')+'">'+number.format(e.i+1)+'</text></g>';
      }
    }
    return '';
  }
  const labels=ordered.map(badge).join('');
  const caption=active?'مسقط الغرفة · '+title(active)+' · الدائرة ركن البداية والسهم اتجاه الرفع':'مسقط الغرفة وترتيب الجدران';
  return '<svg class="sv-wall-map" xmlns="http://www.w3.org/2000/svg" role="'+(interactive?'group':'img')+'" aria-label="'+esc(caption)+'" width="'+mapW+'" height="'+mapH+'" viewBox="0 0 '+mapW+' '+mapH+'" font-family="Tahoma,Arial,sans-serif" style="display:block;max-width:100%;height:auto;direction:ltr"><title>'+esc(caption)+'</title>'+
    '<polygon data-survey-wall-outline="" points="'+contour+'" fill="#f4f6f3"/>'+edges.map(segment).join('')+direction+labels+'</svg>';
}
